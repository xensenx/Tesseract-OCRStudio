/**
 * Tesseract OCR Studio — script.js
 *
 * Pipeline:
 *   PDF upload → pdf.js renders pages serially (shared canvas) → base64 PNG array
 *   → Split into 2 batches → Key 1 + Key 2 process their batches in parallel (Promise.all)
 *   → Within each batch, all pages fire simultaneously (Promise.all)
 *   → Results merged in page order → TXT / PDF export
 *
 * API keys come ONLY from the Vercel serverless endpoint /api/config.
 * They are NEVER exposed in client-side source.
 *
 * Vercel env vars:
 *   GEMMA_API_KEY_ONE  — first Google API key
 *   GEMMA_API_KEY_TWO  — second Google API key
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */

const GEMMA_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent';

const MAX_PAGES = 15;

// pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';


/* ══════════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════════ */

const state = {
  // Slides
  currentSlide: 0,
  totalSlides: 5,

  // Document
  pdfFile: null,
  pdfDoc:  null,

  // API keys loaded from /api/config
  keyOne: null,
  keyTwo: null,

  // Results
  extractedPages: [],  // [{ pageNum, text }]
  mergedText: '',

  // Progress tracking
  doneCount: 0,
  totalPages: 0,
};


/* ══════════════════════════════════════════════════════════════
   DOM REFERENCES
══════════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);

// Slides
const presentation   = $('presentation');
const slides         = document.querySelectorAll('.slide');
const slideDots      = $('slideDots');
const prevBtn        = $('prevBtn');
const nextBtn        = $('nextBtn');
const launchToolBtn  = $('launchToolBtn');

// Tool shell
const toolInterface  = $('toolInterface');
const backToSlides   = $('backToSlidesBtn');
const statusDot      = $('statusDot');
const apiStatusText  = $('apiStatusText');

// Engine status card
const ksSpinner      = $('ksSpinner');
const ksText         = $('ksText');

// Upload
const dropZone       = $('dropZone');
const fileInput      = $('fileInput');
const fileInfo       = $('fileInfo');
const fileName       = $('fileName');
const fileMeta       = $('fileMeta');
const removeFile     = $('removeFile');

// Batch plan panel
const batchInfoSection = $('batchInfoSection');
const batchKey1Pages   = $('batchKey1Pages');
const batchKey2Pages   = $('batchKey2Pages');

// Process
const processBtn     = $('processBtn');
const processBtnText = $('processBtnText');

// Right-panel states
const stateIdle       = $('stateIdle');
const stateProcessing = $('stateProcessing');
const stateResults    = $('stateResults');

// Processing UI
const procPhase      = $('procPhase');
const procSub        = $('procSub');
const progressBar    = $('progressBar');
const progressLabel  = $('progressLabel');
const progressPct    = $('progressPct');

// Results
const resultsMeta    = $('resultsMeta');
const downloadTxtBtn = $('downloadTxtBtn');
const downloadPdfBtn = $('downloadPdfBtn');
const viewPreviewBtn = $('viewPreviewBtn');
const summaryBtn     = $('summaryBtn');
const previewSection = $('previewSection');
const previewScroll  = $('previewScroll');
const summarySection = $('summarySection');
const summarySpinner = $('summarySpinner');
const summaryContent = $('summaryContent');
const resetBtn       = $('resetBtn');

// Error
const errorLog       = $('errorLog');
const errorLogMsg    = $('errorLogMsg');

// Shared canvas
const renderCanvas   = $('renderCanvas');
const renderCtx      = renderCanvas.getContext('2d');


/* ══════════════════════════════════════════════════════════════
   SLIDES
══════════════════════════════════════════════════════════════ */

function buildDots() {
  slideDots.innerHTML = '';
  for (let i = 0; i < state.totalSlides; i++) {
    const btn = document.createElement('button');
    btn.className = 'slide-dot' + (i === 0 ? ' active' : '');
    btn.setAttribute('aria-label', `Slide ${i + 1}`);
    btn.addEventListener('click', () => goToSlide(i));
    slideDots.appendChild(btn);
  }
}

// Transition types varied per slide pair for visual interest
const TRANSITION_TYPES = ['slide', 'fade', 'zoom', 'rise', 'fade'];

function goToSlide(index) {
  if (index < 0) return;
  if (index >= state.totalSlides) { launchTool(); return; }

  const direction = index > state.currentSlide ? 'forward' : 'backward';
  const transType = TRANSITION_TYPES[index] || 'slide';
  const outSlide  = slides[state.currentSlide];
  const inSlide   = slides[index];

  // Set transition type on wrapper for CSS to pick up
  presentation.dataset.transition = transType;
  presentation.dataset.direction  = direction;

  outSlide.classList.add('exit');
  outSlide.classList.remove('active');
  outSlide.classList.remove('entering');
  inSlide.classList.add('active');
  inSlide.classList.add('entering');

  setTimeout(() => {
    outSlide.classList.remove('exit');
    inSlide.classList.remove('entering');
    delete presentation.dataset.transition;
    delete presentation.dataset.direction;
  }, 2000);

  state.currentSlide = index;
  document.querySelectorAll('.slide-dot').forEach((d, i) =>
    d.classList.toggle('active', i === state.currentSlide));
}

prevBtn.addEventListener('click', () => goToSlide(state.currentSlide - 1));
nextBtn.addEventListener('click', () => goToSlide(state.currentSlide + 1));
launchToolBtn.addEventListener('click', launchTool);
backToSlides.addEventListener('click', backToPresentation);

document.addEventListener('keydown', e => {
  if (!toolInterface.classList.contains('hidden')) return;
  if (e.key === 'Enter' || e.key === 'ArrowRight') goToSlide(state.currentSlide + 1);
  if (e.key === 'ArrowLeft') goToSlide(state.currentSlide - 1);
});

function launchTool() {
  presentation.style.cssText = 'opacity:0;transform:scale(0.97);transition:opacity 0.5s ease,transform 0.5s ease';
  setTimeout(() => {
    presentation.classList.add('hidden');
    toolInterface.classList.remove('hidden');
  }, 500);
}

function backToPresentation() {
  toolInterface.classList.add('hidden');
  presentation.classList.remove('hidden');
  presentation.style.cssText = 'opacity:1;transform:scale(1)';
}


/* ══════════════════════════════════════════════════════════════
   API KEY LOADING — from /api/config (Vercel serverless)
══════════════════════════════════════════════════════════════ */

async function loadApiKeys() {
  setKeyStatus('loading', 'Fetching API keys from server…');

  try {
    const res = await fetch('/api/config');

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server returned ${res.status}`);
    }

    const { keyOne, keyTwo } = await res.json();

    if (!keyOne || !keyTwo) {
      throw new Error('One or both API keys missing from server response');
    }

    state.keyOne = keyOne;
    state.keyTwo = keyTwo;

    setKeyStatus('ready', 'Engine active');
    statusDot.classList.add('active');
    apiStatusText.textContent = 'Active';
    checkProcessReady();

  } catch (err) {
    console.error('[loadApiKeys]', err);
    setKeyStatus('error', 'Engine down — invalid API configuration');
    statusDot.classList.add('error');
    apiStatusText.textContent = 'Down';
  }
}

function setKeyStatus(type, msg) {
  ksText.textContent = msg;
  ksSpinner.style.display = type === 'loading' ? 'block' : 'none';
  const card = $('keyStatusCard');
  card.className = 'key-status-card key-status-card--' + type;
}


/* ══════════════════════════════════════════════════════════════
   FILE UPLOAD
══════════════════════════════════════════════════════════════ */

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
removeFile.addEventListener('click', clearFile);

async function handleFile(file) {
  if (file.type !== 'application/pdf') { alert('Please upload a PDF file.'); return; }

  state.pdfFile = file;
  const arrayBuffer = await file.arrayBuffer();

  try {
    state.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const total  = Math.min(state.pdfDoc.numPages, MAX_PAGES);

    fileName.textContent = file.name;
    fileMeta.textContent = `${(file.size / 1024).toFixed(0)} KB · ${total} page${total !== 1 ? 's' : ''} (max ${MAX_PAGES})`;

    fileInfo.classList.remove('hidden');
    dropZone.classList.add('hidden');

    // Show batch split plan
    showBatchPlan(total);
    checkProcessReady();

  } catch (err) {
    console.error('PDF load error:', err);
    alert('Could not load PDF. Please try another file.');
    clearFile();
  }
}

function clearFile() {
  state.pdfFile = null;
  state.pdfDoc  = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  dropZone.classList.remove('hidden');
  batchInfoSection.classList.add('hidden');
  checkProcessReady();
}

/**
 * Display how pages will be split between the two keys.
 * Key 1 gets ceil(n/2), Key 2 gets floor(n/2).
 * If odd, Key 1 gets the extra page.
 */
function showBatchPlan(total) {
  const k1Count = Math.ceil(total / 2);   // e.g. 13 → 7
  const k2Count = Math.floor(total / 2);  // e.g. 13 → 6

  const k1Pages = Array.from({ length: k1Count }, (_, i) => i + 1);
  const k2Pages = Array.from({ length: k2Count }, (_, i) => k1Count + i + 1);

  batchKey1Pages.textContent = `Pages ${k1Pages[0]}–${k1Pages[k1Pages.length - 1]} (${k1Count} pages)`;
  batchKey2Pages.textContent = k2Count > 0
    ? `Pages ${k2Pages[0]}–${k2Pages[k2Pages.length - 1]} (${k2Count} pages)`
    : 'No pages';

  batchInfoSection.classList.remove('hidden');
}

function checkProcessReady() {
  processBtn.disabled = !(state.pdfDoc && state.keyOne && state.keyTwo);
}


/* ══════════════════════════════════════════════════════════════
   MAIN PROCESSING PIPELINE
══════════════════════════════════════════════════════════════ */

processBtn.addEventListener('click', startProcessing);

async function startProcessing() {
  if (!state.pdfDoc || !state.keyOne || !state.keyTwo) return;

  // Reset
  state.extractedPages = [];
  state.mergedText     = '';
  state.doneCount      = 0;

  showState('processing');
  processBtn.disabled = true;
  processBtnText.textContent = 'Processing…';
  errorLog.classList.add('hidden');
  errorLogMsg.textContent = '';

  const totalPages = Math.min(state.pdfDoc.numPages, MAX_PAGES);
  state.totalPages = totalPages;

  buildPageTiles(totalPages);
  updateProgress(0, totalPages);
  setPhase('Preparing document', 'Loading pages…');

  try {
    // ── STEP 1: Render ALL pages to base64 serially ──────────────
    // Canvas is a single shared DOM element; rendering must be serial.
    setPhase('Rendering pages', 'Converting all pages to images…');
    const pageImages = []; // index 0 = page 1

    for (let p = 1; p <= totalPages; p++) {
      setProcSub(`Rendering page ${p} of ${totalPages}…`);
      setTileState(p, 'rendering');
      pageImages.push(await renderPageToBase64(p));
      // Brief yield to keep UI responsive
      await delay(20);
    }

    // ── STEP 2: Split pages into two batches ─────────────────────
    // Key 1: pages 1 … ceil(n/2)   (gets extra page if odd)
    // Key 2: pages ceil(n/2)+1 … n
    const splitIdx = Math.ceil(totalPages / 2); // last index (1-based) for key 1

    // batch = array of { pageNum, base64 }
    const batch1 = pageImages
      .slice(0, splitIdx)
      .map((img, i) => ({ pageNum: i + 1, base64: img }));

    const batch2 = pageImages
      .slice(splitIdx)
      .map((img, i) => ({ pageNum: splitIdx + i + 1, base64: img }));

    // ── STEP 3: Update UI for extraction phase ─────────────────
    setPhase('Extracting text with AI', `${batch1.length} pages → Key 1 · ${batch2.length} pages → Key 2`);

    // ── STEP 4: Fire both batches in parallel ─────────────────────
    // Within each batch, all pages also fire simultaneously.
    const [results1, results2] = await Promise.all([
      processBatch(batch1, state.keyOne, 1),
      processBatch(batch2, state.keyTwo, 2),
    ]);

    // Merge results from both batches (already sorted internally)
    state.extractedPages = [...results1, ...results2]
      .sort((a, b) => a.pageNum - b.pageNum);

    // ── STEP 5: Merge & clean ─────────────────────────────────────
    setPhase('Formatting document', 'Merging and cleaning text…');
    await delay(200);
    state.mergedText = mergeAndClean(state.extractedPages);

    showResults(totalPages);

  } catch (err) {
    console.error('Processing error:', err);
    setPhase('Error', err.message);
    showError(`Fatal: ${err.message}`);
    processBtn.disabled = false;
    processBtnText.textContent = 'Process Document';
  }
}

/**
 * Process a batch of pages with one API key.
 * All pages in the batch fire simultaneously via Promise.all.
 *
 * @param {Array<{pageNum:number, base64:string}>} batch
 * @param {string} apiKey
 * @param {number} batchNum  1 or 2 (for UI labels)
 * @returns {Promise<Array<{pageNum:number, text:string}>>}
 */
async function processBatch(batch, apiKey, batchNum) {
  // Fire all pages in this batch at once
  const promises = batch.map(({ pageNum, base64 }) =>
    extractTextFromImage(base64, apiKey, pageNum, batchNum)
  );

  const results = await Promise.allSettled(promises);

  return results.map((result, i) => {
    const pageNum = batch[i].pageNum;
    if (result.status === 'fulfilled') {
      setTileState(pageNum, 'done');
      incrementProgress();
      return { pageNum, text: result.value };
    } else {
      const msg = result.reason?.message || 'Unknown error';
      console.error(`[Batch ${batchNum}] Page ${pageNum} failed:`, msg);
      setTileState(pageNum, 'error');
      showError(`Page ${pageNum} (Key ${batchNum}): ${msg}`);
      incrementProgress();
      return { pageNum, text: `[Page ${pageNum}: transcription failed — ${msg}]` };
    }
  });
}

/**
 * Render one PDF page to a base64 PNG string.
 * Must be called serially because it uses the shared hidden canvas.
 */
async function renderPageToBase64(pageNum) {
  const page     = await state.pdfDoc.getPage(pageNum);
  const scale    = 1.4; // ~150 DPI for A4 — good balance of quality vs payload size
  const viewport = page.getViewport({ scale });

  renderCanvas.width  = viewport.width;
  renderCanvas.height = viewport.height;

 // Improve quality when scaling the PDF render
  renderCtx.imageSmoothingEnabled = true;
  renderCtx.imageSmoothingQuality = "high";

  renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
  renderCtx.fillStyle = '#ffffff';
  renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

  await page.render({ canvasContext: renderCtx, viewport }).promise;

  // Strip "data:image/png;base64," prefix — API wants raw base64
  return renderCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

/**
 * Send one page image to Gemma 3 27B IT and return the transcribed text.
 * Structured identically to the working Python reference implementation.
 *
 * @param {string} base64Image  raw base64 PNG (no data: prefix)
 * @param {string} apiKey
 * @param {number} pageNum      for logging
 * @param {number} batchNum     for logging
 */
async function extractTextFromImage(base64Image, apiKey, pageNum, batchNum) {
  const prompt = `You are a document transcription system.
Transcribe the text in this document image exactly.
Rules:
* Output ONLY the text
* Preserve headings
* Preserve numbering
* Preserve line breaks
* Do NOT summarize
* Do NOT explain anything
* Do NOT correct spelling
* Return only the transcription.`;

  // Payload mirrors the working Python reference exactly
  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Image,
          },
        },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
    },
  };

  const response = await fetch(`${GEMMA_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    let errBody = {};
    try { errBody = JSON.parse(rawText); } catch (_) {}
    const msg = errBody?.error?.message || `HTTP ${response.status}: ${rawText.slice(0, 200)}`;
    console.error(`[Key ${batchNum} / Page ${pageNum}] API error:`, rawText);
    throw new Error(msg);
  }

  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (_) {
    console.error(`[Key ${batchNum} / Page ${pageNum}] Non-JSON response:`, rawText.slice(0, 300));
    throw new Error('Non-JSON response from API: ' + rawText.slice(0, 120));
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map(p => p.text || '').join('').trim();
}

/**
 * Merge page texts in order and clean formatting.
 */
function mergeAndClean(pages) {
  const sorted = [...pages].sort((a, b) => a.pageNum - b.pageNum);
  return sorted
    .map(p => p.text)
    .join('\n\n— — —\n\n')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim();
}


/* ══════════════════════════════════════════════════════════════
   RESULTS & EXPORTS
══════════════════════════════════════════════════════════════ */

function showResults(totalPages) {
  showState('results');
  resultsMeta.textContent =
    `${totalPages} page${totalPages !== 1 ? 's' : ''} processed · ${state.mergedText.length.toLocaleString()} characters`;
  processBtn.disabled = false;
  processBtnText.textContent = 'Process Document';
}

downloadTxtBtn.addEventListener('click', () => {
  triggerDownload(
    new Blob([state.mergedText], { type: 'text/plain;charset=utf-8' }),
    'tesseract-transcription.txt'
  );
});

downloadPdfBtn.addEventListener('click', generatePDF);

function generatePDF() {
  const lines   = state.mergedText.split('\n');
  const content = [];

  content.push({ text: 'Tesseract OCR Studio — Transcribed Document', style: 'title', margin: [0,0,0,12] });
  content.push({ canvas: [{ type: 'line', x1:0, y1:0, x2:515, y2:0, lineWidth:1, lineColor:'#cccccc' }], margin:[0,0,0,16] });

  lines.forEach(line => {
    if (line.startsWith('— — —')) {
      content.push({ text: '', pageBreak: 'after' });
    } else if (line.trim() === '') {
      content.push({ text: ' ', margin: [0,2] });
    } else {
      const isHeading = /^[A-Z0-9 .]+$/.test(line.trim()) && line.trim().length < 80;
      content.push({
        text: line,
        style: isHeading ? 'heading' : 'body',
        margin: [0, isHeading ? 8 : 0, 0, isHeading ? 4 : 0],
      });
    }
  });

  pdfMake.createPdf({
    content,
    styles: {
      title:   { fontSize: 16, bold: true, font: 'Roboto', color: '#111111' },
      heading: { fontSize: 12, bold: true, font: 'Roboto', color: '#222222' },
      body:    { fontSize: 10, font: 'Roboto', color: '#333333', lineHeight: 1.5 },
    },
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [60, 50, 60, 50],
  }).download('tesseract-transcription.pdf');
}

viewPreviewBtn.addEventListener('click', () => {
  const visible = !previewSection.classList.contains('hidden');
  previewSection.classList.toggle('hidden', visible);
  if (!visible) {
    previewScroll.textContent = state.mergedText;
    viewPreviewBtn.style.borderColor = 'var(--accent2)';
    viewPreviewBtn.style.color = 'var(--accent2)';
    setTimeout(() => previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  } else {
    viewPreviewBtn.style.borderColor = '';
    viewPreviewBtn.style.color = '';
  }
});

summaryBtn.addEventListener('click', generateSummary);

async function generateSummary() {
  if (!state.mergedText) { alert('No text available.'); return; }
  // Use key 1 for summary (text-only, no image)
  const apiKey = state.keyOne;
  if (!apiKey) { alert('API key not loaded.'); return; }

  summarySection.classList.remove('hidden');
  summarySpinner.classList.remove('hidden');
  summaryContent.textContent = '';
  summaryBtn.disabled = true;

  try {
    const response = await fetch(`${GEMMA_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Summarize this document clearly using bullet points.\n\n${state.mergedText.substring(0, 8000)}` }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    summaryContent.textContent =
      (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text || '').join('').trim()
      || 'No summary generated.';

  } catch (err) {
    summaryContent.textContent = `Summary failed: ${err.message}`;
  } finally {
    summarySpinner.classList.add('hidden');
    summaryBtn.disabled = false;
    setTimeout(() => summarySection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

resetBtn.addEventListener('click', resetUI);

function resetUI() {
  state.extractedPages = [];
  state.mergedText     = '';
  state.pdfDoc         = null;
  state.pdfFile        = null;
  state.doneCount      = 0;
  fileInput.value      = '';
  previewSection.classList.add('hidden');
  summarySection.classList.add('hidden');
  fileInfo.classList.add('hidden');
  batchInfoSection.classList.add('hidden');
  dropZone.classList.remove('hidden');
  errorLog.classList.add('hidden');
  errorLogMsg.textContent = '';
  processBtn.disabled  = true;
  processBtnText.textContent = 'Process Document';
  showState('idle');
}


/* ══════════════════════════════════════════════════════════════
   UI HELPERS
══════════════════════════════════════════════════════════════ */

function showState(name) {
  stateIdle.classList.add('hidden');
  stateProcessing.classList.add('hidden');
  stateResults.classList.add('hidden');
  if (name === 'idle')       stateIdle.classList.remove('hidden');
  if (name === 'processing') stateProcessing.classList.remove('hidden');
  if (name === 'results')    stateResults.classList.remove('hidden');
}

function setPhase(phase, sub) {
  procPhase.textContent = phase;
  if (sub !== undefined) procSub.textContent = sub;
}

function setProcSub(sub) {
  procSub.textContent = sub;
}

/** Atomically increment done counter and update bar */
function incrementProgress() {
  state.doneCount++;
  updateProgress(state.doneCount, state.totalPages);
}

function updateProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  progressBar.style.width  = pct + '%';
  progressLabel.textContent = `${done} / ${total} page${total !== 1 ? 's' : ''}`;
  progressPct.textContent   = pct + '%';
}

/** Build per-page tiles (no-op — old tile UI removed) */
function buildPageTiles(total) {
  // Kept as no-op for pipeline compatibility
}

function setTileState(pageNum, status) {
  // Update phase sub-text to show activity
  const labels = { rendering: 'RENDER', processing: 'READING', done: '✓ DONE', error: '✗ ERR' };
  if (status === 'rendering') {
    setProcSub(`Rendering page ${pageNum}…`);
  } else if (status === 'done') {
    setProcSub(`Page ${pageNum} complete`);
  } else if (status === 'error') {
    setProcSub(`Page ${pageNum} failed`);
  }
}

function showError(msg) {
  errorLog.classList.remove('hidden');
  errorLogMsg.textContent = msg;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}


/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */

(function init() {
  buildDots();
  showState('idle');

  // Apply entering class to initial slide for staggered animations
  slides[0].classList.add('entering');
  setTimeout(() => slides[0].classList.remove('entering'), 2000);

  // Load API keys from server immediately on page load
  loadApiKeys();

  // ── Video fade at loop boundary ──
  const bgVideo = $('bgVideo');
  if (bgVideo) {
    bgVideo.addEventListener('timeupdate', () => {
      if (bgVideo.duration && bgVideo.currentTime > bgVideo.duration - 1.5) {
        bgVideo.classList.add('video-fading');
      }
    });
    bgVideo.addEventListener('seeked', () => {
      // After loop restarts (seek to 0), remove fade
      if (bgVideo.currentTime < 1) {
        // Small delay so the fade-in transition is visible
        setTimeout(() => bgVideo.classList.remove('video-fading'), 50);
      }
    });
  }

  console.log('%cTesseract OCR Studio', 'color:#e8f04a;font-weight:bold;font-size:16px');
  console.log('Mode: Dual-key parallel · Key 1 → batch A · Key 2 → batch B · Promise.all');
})();
