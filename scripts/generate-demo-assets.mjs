import { chromium } from 'playwright';
import { jsPDF } from 'jspdf';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('public/demo');
const url = 'https://www.iana.org/domains/reserved';
const capturedAt = new Date().toISOString();

function stable(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === 'object') return Object.keys(value).sort().reduce((result, key) => { result[key] = stable(value[key]); return result; }, {});
  return value;
}

function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

await fs.mkdir(output, { recursive: true });
const browserCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
let executablePath;
for (const candidate of browserCandidates) {
  try { await fs.access(candidate); executablePath = candidate; break; } catch { /* try next installed browser */ }
}
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
const html = await page.content();
const screenshotPath = path.join(output, 'iana-screenshot.png');
await page.screenshot({ path: screenshotPath, fullPage: true });
await fs.writeFile(path.join(output, 'iana-page.html'), html, 'utf8');
const pageTitle = await page.title();
await browser.close();

const screenshot = await fs.readFile(screenshotPath);
const screenshotSha256 = hash(screenshot);
const htmlSha256 = hash(Buffer.from(html, 'utf8'));
const manifest = {
  captured_at: capturedAt,
  final_url: url,
  headers: { 'content-type': response?.headers()['content-type'] ?? 'text/html; charset=UTF-8' },
  hash_algorithm: 'sha256',
  html_path: '/demo/iana-page.html',
  html_sha256: htmlSha256,
  monitor_id: 'demo-iana-reserved-domains',
  original_url: url,
  page_title: pageTitle,
  previous_capture_hash: null,
  schema_version: 'veritasweb.capture.v1',
  screenshot_path: '/demo/iana-screenshot.png',
  screenshot_sha256: screenshotSha256,
  status_code: response?.status() ?? 200,
  trigger_type: 'demo',
};
const manifestJson = JSON.stringify(stable(manifest));
const manifestSha256 = hash(Buffer.from(manifestJson, 'utf8'));
await fs.writeFile(path.join(output, 'sample-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
await fs.writeFile(path.join(output, 'sample-metadata.json'), JSON.stringify({ capture_id: 'demo-iana-reserved-domains', ...manifest, manifest_sha256: manifestSha256 }, null, 2), 'utf8');

const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
const width = pdf.internal.pageSize.getWidth();
const height = pdf.internal.pageSize.getHeight();
const margin = 42;
const contentWidth = width - margin * 2;
pdf.setFillColor(8, 9, 16); pdf.rect(0, 0, width, 150, 'F');
pdf.setFillColor(36, 18, 77); pdf.rect(0, 0, width * 0.34, 150, 'F');
pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); pdf.text('VeritasWeb', margin, 44);
pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(34, 211, 238); pdf.text('Evidence Preservation Report', margin, 63);
pdf.setFont('helvetica', 'bold'); pdf.setFontSize(21); pdf.setTextColor(255, 255, 255); pdf.text('Demo Record', margin, 105);
pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text('Bundled IANA sample - read-only demonstration', margin, 125);
pdf.setFillColor(240, 253, 244); pdf.setDrawColor(22, 163, 74); pdf.roundedRect(width - margin - 145, 88, 145, 28, 5, 5, 'FD'); pdf.setTextColor(22, 163, 74); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.text('INTEGRITY VERIFIED', width - margin - 72, 106, { align: 'center' });
let y = 190;
pdf.setTextColor(17, 24, 39); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text('Record Summary', margin, y); y += 24;
pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(100, 116, 139); pdf.text('Page title', margin, y); pdf.setTextColor(17, 24, 39); pdf.text(pageTitle, margin + 110, y); y += 18;
pdf.setTextColor(100, 116, 139); pdf.text('URL', margin, y); pdf.setTextColor(17, 24, 39); pdf.text(url, margin + 110, y); y += 18;
pdf.setTextColor(100, 116, 139); pdf.text('HTTP status', margin, y); pdf.setTextColor(17, 24, 39); pdf.text(`${response?.status() ?? 200} OK`, margin + 110, y); y += 18;
pdf.setTextColor(100, 116, 139); pdf.text('Captured at', margin, y); pdf.setTextColor(17, 24, 39); pdf.text(capturedAt, margin + 110, y); y += 32;
const image = `data:image/png;base64,${screenshot.toString('base64')}`;
const properties = pdf.getImageProperties(image);
const maxWidth = contentWidth;
const maxHeight = 290;
const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height);
const imageWidth = properties.width * scale;
const imageHeight = properties.height * scale;
pdf.setDrawColor(203, 213, 225); pdf.rect(margin, y, contentWidth, maxHeight + 24); pdf.addImage(image, 'PNG', margin + (contentWidth - imageWidth) / 2, y + 12, imageWidth, imageHeight); y += maxHeight + 44;
pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(17, 24, 39); pdf.text('SHA-256 Integrity', margin, y); y += 18; pdf.setFont('courier', 'normal'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139); pdf.text(`Screenshot  ${screenshotSha256}`, margin, y); y += 12; pdf.text(`HTML       ${htmlSha256}`, margin, y); y += 12; pdf.text(`Manifest   ${manifestSha256}`, margin, y); y += 28;
pdf.setFillColor(255, 251, 235); pdf.setDrawColor(217, 119, 6); pdf.roundedRect(margin, y, contentWidth, 54, 5, 5, 'FD'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(17, 24, 39); pdf.text('Limitations', margin + 12, y + 17); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text('This bundled sample demonstrates stored-artifact verification only. It does not independently establish legal admissibility.', margin + 12, y + 34);
pdf.setFontSize(7); pdf.setTextColor(100, 116, 139); pdf.text('Generated by VeritasWeb - sample data, not a private user capture', margin, height - 26);
await fs.writeFile(path.join(output, 'sample-report.pdf'), Buffer.from(pdf.output('arraybuffer')));
console.log(JSON.stringify({ url, title: pageTitle, status: response?.status() ?? 200, screenshotSha256, htmlSha256, manifestSha256 }, null, 2));
