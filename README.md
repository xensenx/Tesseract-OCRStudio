# Tesseract OCR Studio

**Vision-language transcription. No OCR engine required.**

[Visit Tesseract OCR Studio](https://tesseract-ocr-studio.vercel.app/)

Tesseract OCR Studio is an AI-powered document intelligence tool that transforms the way we interact with physical and digital documents. Instead of relying on traditional Optical Character Recognition (OCR) engines that match pixel patterns, Tesseract leverages advanced Vision-Language Models (VLMs) to contextually understand and transcribe documents.

By using state-of-the-art AI, Tesseract can effortlessly handle complex layouts, rotated text, and degraded scans, producing precise machine-readable data.

## 🚀 Key Features

*   **AI Vision, Not OCR:** Replaces pixel-level pattern matching with context-aware vision-language understanding using Google's Gemma 3 27B IT model.
*   **Dual-Key Parallel Processing:** To dramatically accelerate transcription, the tool uses two Google API keys working simultaneously. A 13-page document takes just ~4 minutes instead of 52.
*   **Local Rendering:** Drop any PDF (up to 15 pages). `pdf.js` renders each page locally at 2× scale to ensure high-quality input for the AI.
*   **Structured Exports:** Download your transcribed text as a raw `TXT` file or a formatted, structured `PDF`.
*   **AI Summarization:** Get a quick bulleted summary of your processed document using the same powerful AI models.
*   **Privacy First:** API keys are securely loaded from a Vercel serverless function (`/api/config`) and are never exposed in the client-side source code.

## 🛠️ Technology Stack

*   **Frontend:** Pure HTML5, CSS3 (Modern, responsive, animated UI), and Vanilla JavaScript.
*   **PDF Processing:** `pdf.js` for high-quality local rendering.
*   **PDF Generation:** `pdfmake` for structured PDF exports.
*   **Markdown Parsing:** `marked.js` for rendering AI summaries.
*   **AI Engine:** Google Generative AI (Gemma 3 27B IT) via REST API.
*   **Backend / Serverless:** Vercel Functions (Node.js) for secure API key injection.

## ⚙️ How it Works

1.  **Upload:** Drop a PDF document (up to 15 pages) into the tool.
2.  **Render:** The browser uses `pdf.js` to render every page of the document locally into high-resolution images.
3.  **Batch & Process:** The pages are split into two batches. Two separate API keys fire simultaneously, processing the batches in parallel to maximize speed.
4.  **Extract & Merge:** The AI contextually extracts text from each page image. Results are merged in proper order.
5.  **Export:** Review the transcription, generate an AI summary, or download the output as a `.txt` or `.pdf` file.

## 💻 Running Locally

To run this project locally, you will need to set up the environment variables for the Google API keys, as the tool relies on a Vercel Serverless function (`/api/config.js`) to serve them.

### Prerequisites
*   [Node.js](https://nodejs.org/) installed
*   [Vercel CLI](https://vercel.com/docs/cli) installed (`npm i -g vercel`)
*   Two [Google Gemini API Keys](https://aistudio.google.com/app/apikey)

### Setup

1.  **Clone the repository**
2.  **Create a `.env.local` file** in the root of the project and add your API keys:
    ```env
    GEMMA_API_KEY_ONE=your_first_google_api_key_here
    GEMMA_API_KEY_TWO=your_second_google_api_key_here
    ```
3.  **Run the local development server** using Vercel CLI:
    ```bash
    vercel dev
    ```
4.  Open `http://localhost:3000` in your browser.

## ℹ️ About

This project demonstrates the power of utilizing Vision-Language Models for document transcription and understanding, bypassing the limitations of traditional OCR software. Built with performance in mind, it utilizes parallel processing and local rendering to deliver fast and accurate results.
