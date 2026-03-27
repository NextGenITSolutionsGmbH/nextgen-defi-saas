import { chromium } from "playwright";

/**
 * Converts an HTML string to a PDF buffer using Playwright's Chromium.
 * Used by the export-gen worker for tax report PDF generation.
 */
export async function convertHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
