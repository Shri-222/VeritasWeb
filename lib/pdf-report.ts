import { jsPDF } from 'jspdf';
import {
  getCaptureManifestHash,
  getCaptureScreenshotPath,
  type OwnedCaptureRecord,
} from './captures.ts';
import type { CaptureVerificationResult } from './verification.ts';
import { resolveCaptureStorageProvider } from './storage/index.ts';

if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, writable: true });
}

type ReportInput = {
  capture: OwnedCaptureRecord;
  verification: CaptureVerificationResult;
  generatedAt: string;
};

type Rgb = [number, number, number];

const COLORS = {
  ink: [17, 24, 39] as Rgb,
  cover: [8, 9, 16] as Rgb,
  purple: [124, 58, 237] as Rgb,
  deepPurple: [36, 18, 77] as Rgb,
  cyan: [34, 211, 238] as Rgb,
  green: [22, 163, 74] as Rgb,
  amber: [217, 119, 6] as Rgb,
  red: [220, 38, 38] as Rgb,
  page: [247, 247, 250] as Rgb,
  white: [255, 255, 255] as Rgb,
  muted: [100, 116, 139] as Rgb,
  border: [203, 213, 225] as Rgb,
  softPurple: [245, 243, 255] as Rgb,
  softGreen: [240, 253, 244] as Rgb,
  softAmber: [255, 251, 235] as Rgb,
  softRed: [254, 242, 242] as Rgb,
  code: [17, 24, 39] as Rgb,
  codeText: [229, 231, 235] as Rgb,
};

const IMPORTANT_HEADERS = ['content-type', 'last-modified', 'etag', 'cache-control', 'date', 'server', 'location'];

function stringifyValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  });
}

function headersObject(headers: unknown) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {};
  return Object.entries(headers).reduce<Record<string, unknown>>((result, [key, value]) => {
    result[key.toLowerCase()] = value;
    return result;
  }, {});
}

function resultLabel(match: boolean | undefined) {
  if (match === true) return 'Match';
  if (match === false) return 'No match';
  return 'Not available';
}

export function generateCaptureReportPdf({ capture, verification, generatedAt }: ReportInput) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const bottom = pageHeight - 46;
  let cursor = 0;
  let isCover = true;

  const setFill = (color: Rgb) => pdf.setFillColor(...color);
  const setDraw = (color: Rgb) => pdf.setDrawColor(...color);
  const setText = (color: Rgb) => pdf.setTextColor(...color);
  const wrap = (value: unknown, width: number, font = 'helvetica', size = 9) => {
    pdf.setFont(font, 'normal');
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(stringifyValue(value), width);
    return Array.isArray(lines) ? lines : [lines];
  };
  const measureWrappedTextHeight = (value: unknown, width: number, size = 9, lineHeight = size + 4, font = 'helvetica') => wrap(value, width, font, size).length * lineHeight;

  function drawHeader() {
    if (isCover) return;
    setFill(COLORS.cover);
    pdf.rect(0, 0, pageWidth, 58, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    setText(COLORS.white);
    pdf.text('VeritasWeb', margin, 25);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    setText(COLORS.cyan);
    pdf.text('Evidence Preservation Report', margin, 42);
    setText(COLORS.white);
    pdf.text(`Capture ${capture.id.slice(0, 12)}...`, pageWidth - margin, 32, { align: 'right' });
    cursor = 88;
  }

  function drawFooter() {
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      setText(COLORS.muted);
      pdf.text('VeritasWeb Evidence Preservation Report', margin, pageHeight - 24);
      pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: 'right' });
    }
  }

  function addPage() {
    pdf.addPage();
    isCover = false;
    setFill(COLORS.page);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    drawHeader();
  }

  function ensureSpace(requiredHeight: number) {
    if (cursor + requiredHeight <= bottom) return;
    addPage();
  }

  function sectionTitle(title: string) {
    ensureSpace(34);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    setText(COLORS.ink);
    pdf.text(title, margin, cursor);
    setDraw(COLORS.purple);
    pdf.setLineWidth(1.5);
    pdf.line(margin, cursor + 8, margin + 42, cursor + 8);
    setDraw(COLORS.border);
    pdf.setLineWidth(0.6);
    pdf.line(margin + 50, cursor + 8, pageWidth - margin, cursor + 8);
    cursor += 28;
  }

  function drawCard(x: number, y: number, width: number, height: number, fill = COLORS.white, stroke = COLORS.border) {
    setFill(fill);
    setDraw(stroke);
    pdf.setLineWidth(0.7);
    pdf.roundedRect(x, y, width, height, 6, 6, 'FD');
  }

  function addWrappedText(value: unknown, options: { width: number; size?: number; color?: Rgb; bold?: boolean; font?: 'helvetica' | 'courier'; lineHeight?: number; gap?: number; x?: number }) {
    const size = options.size ?? 9;
    const lineHeight = options.lineHeight ?? size + 4;
    const lines = wrap(value, options.width, options.font ?? 'helvetica', size);
    const height = lines.length * lineHeight;
    ensureSpace(height + (options.gap ?? 0));
    pdf.setFont(options.font ?? 'helvetica', options.bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    setText(options.color ?? COLORS.ink);
    pdf.text(lines, options.x ?? margin, cursor);
    cursor += height + (options.gap ?? 0);
    return height;
  }

  function addKeyValueRow(label: string, value: unknown, width = contentWidth) {
    const labelWidth = 145;
    const labelHeight = 10;
    const valueHeight = measureWrappedTextHeight(value, width - labelWidth, 8.3, 11);
    ensureSpace(labelHeight + valueHeight + 10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    setText(COLORS.muted);
    pdf.text(label.toUpperCase(), margin, cursor);
    addWrappedText(value, { x: margin + labelWidth, width: width - labelWidth, size: 8.3, lineHeight: 11, gap: 5 });
    return Math.max(labelHeight, valueHeight) + 5;
  }

  function addCodeBlock(value: unknown, options: { width?: number; size?: number; maxLinesPerPage?: number } = {}) {
    const width = options.width ?? contentWidth - 24;
    const size = options.size ?? 7;
    const lineHeight = size + 3;
    const lines = wrap(value, width - 18, 'courier', size);
    const maxLinesPerPage = options.maxLinesPerPage ?? 30;
    let index = 0;
    while (index < lines.length || (lines.length === 0 && index === 0)) {
      const remaining = lines.length - index;
      const count = Math.min(maxLinesPerPage, Math.max(1, remaining));
      const blockHeight = count * lineHeight + 18;
      ensureSpace(blockHeight + 8);
      drawCard(margin, cursor, width, blockHeight, COLORS.code, COLORS.code);
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(size);
      setText(COLORS.codeText);
      pdf.text(lines.slice(index, index + count), margin + 9, cursor + 13);
      cursor += blockHeight + 8;
      index += count;
      if (index < lines.length) addPage();
      if (lines.length === 0) break;
    }
  }

  function drawVerificationBadge() {
    const verified = verification.status === 'VERIFIED';
    const color = verified ? COLORS.green : verification.status === 'FAILED' ? COLORS.red : COLORS.amber;
    const fill = verified ? COLORS.softGreen : verification.status === 'FAILED' ? COLORS.softRed : COLORS.softAmber;
    const text = verified ? 'INTEGRITY VERIFIED' : verification.status.replaceAll('_', ' ');
    setFill(fill);
    setDraw(color);
    pdf.roundedRect(pageWidth - margin - 178, 94, 178, 30, 6, 6, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    setText(color);
    pdf.text(text, pageWidth - margin - 89, 113, { align: 'center' });
  }

  function addDisclaimer() {
    const text = 'VeritasWeb verifies whether stored artifacts match their recorded hashes. It does not independently establish legal admissibility and does not replace formal chain-of-custody, notarization, expert review, or jurisdiction-specific procedures.';
    const height = measureWrappedTextHeight(text, contentWidth - 32, 8.2, 11) + 34;
    ensureSpace(height + 8);
    drawCard(margin, cursor, contentWidth, height, COLORS.softAmber, COLORS.amber);
    const start = cursor + 18;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    setText(COLORS.ink);
    pdf.text('Limitations', margin + 16, start);
    cursor = start + 15;
    addWrappedText(text, { x: margin + 16, width: contentWidth - 32, size: 8.2, lineHeight: 11, gap: 8 });
  }

  function addCover() {
    setFill(COLORS.cover);
    pdf.rect(0, 0, pageWidth, 190, 'F');
    setFill(COLORS.deepPurple);
    pdf.rect(0, 0, pageWidth * 0.34, 190, 'F');
    setText(COLORS.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('VeritasWeb', margin, 48);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    setText(COLORS.cyan);
    pdf.text('Evidence Preservation Report', margin, 67);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(25);
    setText(COLORS.white);
    pdf.text('Stored evidence,', margin, 116);
    pdf.text('clearly accounted for.', margin, 145);
    setText(COLORS.cyan);
    pdf.setFontSize(8);
    pdf.text('Generated from stored capture artifacts and metadata', margin, 170);
    setText(COLORS.white);
    pdf.setFontSize(8);
    pdf.text(`Generated ${formatDate(generatedAt)}`, pageWidth - margin, 170, { align: 'right' });
    drawVerificationBadge();

    cursor = 224;
    sectionTitle('Record Summary');
    const leftWidth = (contentWidth - 18) / 2;
    const leftX = margin;
    const rightX = margin + leftWidth + 18;
    const rows: Array<[string, unknown]> = [
      ['Capture ID', capture.id], ['Monitor ID', capture.monitor_id], ['Page Title', capture.page_title],
      ['Captured At', formatDate(capture.captured_at ?? capture.timestamp)], ['Original URL', capture.original_url],
      ['Final URL', capture.final_url], ['HTTP Status', capture.status_code], ['Trigger Type', capture.trigger_type],
    ];
    for (let index = 0; index < rows.length; index += 2) {
      const pair = rows.slice(index, index + 2);
      const heights = pair.map(([, value]) => measureWrappedTextHeight(value, leftWidth - 24, 8.2, 11) + 28);
      const height = Math.max(...heights);
      ensureSpace(height);
      pair.forEach(([label, value], pairIndex) => {
        const x = pairIndex === 0 ? leftX : rightX;
        drawCard(x, cursor, leftWidth, height, COLORS.white, COLORS.border);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.2);
        setText(COLORS.muted);
        pdf.text(label.toUpperCase(), x + 12, cursor + 16);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.2);
        setText(COLORS.ink);
        pdf.text(wrap(value, leftWidth - 24, 'helvetica', 8.2), x + 12, cursor + 29);
      });
      cursor += height + 10;
    }
    cursor += 2;
    addDisclaimer();
  }

  function addScreenshotPage() {
    addPage();
    sectionTitle('Visual Evidence');
    const frameTop = cursor;
    const frameHeight = 430;
    ensureSpace(frameHeight + 60);
    drawCard(margin, frameTop, contentWidth, frameHeight, COLORS.white, COLORS.border);
    let included = false;
    if (verification.artifacts?.screenshotBuffer) {
      try {
        const data = `data:image/png;base64,${verification.artifacts.screenshotBuffer.toString('base64')}`;
        const properties = pdf.getImageProperties(data);
        const availableWidth = contentWidth - 32;
        const availableHeight = frameHeight - 34;
        const scale = Math.min(availableWidth / properties.width, availableHeight / properties.height);
        const width = properties.width * scale;
        const height = properties.height * scale;
        pdf.addImage(data, 'PNG', margin + (contentWidth - width) / 2, frameTop + 17 + (availableHeight - height) / 2, width, height);
        included = true;
      } catch (error) {
        console.error('[pdf-report:screenshot]', error);
      }
    }
    if (!included) {
      addWrappedText('Screenshot artifact could not be embedded in this report. The original stored artifact remains available in the evidence bundle.', { x: margin + 16, width: contentWidth - 32, size: 9, color: COLORS.muted, gap: 8 });
    }
    cursor = frameTop + frameHeight + 18;
    addKeyValueRow('Screenshot included', included ? 'Yes' : 'No');
    addKeyValueRow('Screenshot artifact', getCaptureScreenshotPath(capture));
    addKeyValueRow('Note', 'The original full-resolution screenshot is preserved in the stored evidence artifacts and bundle.');
  }

  function addVerificationPage() {
    addPage();
    sectionTitle('Integrity Verification');
    addWrappedText('The following values compare recorded hashes with hashes recomputed from the stored artifacts.', { width: contentWidth, size: 9, color: COLORS.muted, gap: 14 });
    const columns = [{ label: 'Artifact', width: 92 }, { label: 'Stored Hash', width: 174 }, { label: 'Computed Hash', width: 174 }, { label: 'Result', width: contentWidth - 440 }];
    const rows = [
      ['Screenshot', verification.checks.screenshot?.stored ?? capture.screenshot_sha256, verification.checks.screenshot?.computed, resultLabel(verification.checks.screenshot?.match)],
      ['HTML', verification.checks.html?.stored ?? capture.html_sha256, verification.checks.html?.computed, resultLabel(verification.checks.html?.match)],
      ['Manifest', verification.checks.manifest?.stored ?? getCaptureManifestHash(capture), verification.checks.manifest?.computed, resultLabel(verification.checks.manifest?.match)],
    ];
    const headerHeight = 28;
    ensureSpace(headerHeight + rows.length * 50 + 80);
    const tableTop = cursor;
    setFill(COLORS.ink);
    pdf.rect(margin, tableTop, contentWidth, headerHeight, 'F');
    let x = margin;
    columns.forEach((column) => { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); setText(COLORS.white); pdf.text(column.label, x + 8, tableTop + 18); x += column.width; });
    cursor = tableTop + headerHeight;
    rows.forEach((row, rowIndex) => {
      const wrapped = row.map((value, index) => wrap(value, columns[index].width - 14, index === 1 || index === 2 ? 'courier' : 'helvetica', index === 1 || index === 2 ? 6.5 : 8));
      const height = Math.max(38, ...wrapped.map((lines) => lines.length * 9 + 18));
      setFill(rowIndex % 2 === 0 ? COLORS.white : COLORS.page);
      setDraw(COLORS.border);
      pdf.rect(margin, cursor, contentWidth, height, 'FD');
      let cellX = margin;
      wrapped.forEach((lines, index) => {
        pdf.setFont(index === 1 || index === 2 ? 'courier' : 'helvetica', index === 0 ? 'bold' : 'normal');
        pdf.setFontSize(index === 1 || index === 2 ? 6.5 : 8);
        setText(index === 3 ? (row[3] === 'Match' ? COLORS.green : row[3] === 'No match' ? COLORS.red : COLORS.amber) : COLORS.ink);
        pdf.text(lines, cellX + 8, cursor + 16);
        cellX += columns[index].width;
      });
      cursor += height;
    });
    cursor += 18;
    addKeyValueRow('Overall status', verification.status);
    addKeyValueRow('Verification timestamp', verification.verifiedAt);
    addKeyValueRow('Previous capture hash', capture.previous_capture_hash);
  }

  function addArtifactsPage() {
    addPage();
    sectionTitle('Evidence Artifacts');
    addKeyValueRow('Screenshot storage path', getCaptureScreenshotPath(capture));
    addKeyValueRow('HTML storage path', capture.html_path);
    addKeyValueRow('Manifest storage path', capture.manifest_path);
    addKeyValueRow(
      'Storage provider',
      resolveCaptureStorageProvider(capture.storage_provider) === 'supabase'
        ? 'Supabase private Storage'
        : 'R2 private object storage'
    );
    cursor += 8;
    sectionTitle('Capture Metadata');
    addKeyValueRow('Original URL', capture.original_url);
    addKeyValueRow('Final URL', capture.final_url);
    addKeyValueRow('Page title', capture.page_title);
    addKeyValueRow('HTTP status', capture.status_code);
    addKeyValueRow('Captured at', formatDate(capture.captured_at ?? capture.timestamp));
    addKeyValueRow('Trigger type', capture.trigger_type);
    cursor += 8;
    sectionTitle('Important HTTP Headers');
    const headers = headersObject(capture.headers);
    const important = IMPORTANT_HEADERS.reduce<Record<string, unknown>>((result, key) => { if (headers[key] !== undefined) result[key] = headers[key]; return result; }, {});
    addCodeBlock(JSON.stringify(important, null, 2), { size: 7 });
  }

  function addTechnicalAppendix() {
    addPage();
    sectionTitle('Technical Appendix - HTTP Response Headers');
    addWrappedText('Full response headers are rendered below as stored metadata. Long headers continue onto additional pages as needed.', { width: contentWidth, size: 9, color: COLORS.muted, gap: 12 });
    addCodeBlock(JSON.stringify(headersObject(capture.headers), null, 2), { size: 7, maxLinesPerPage: 31 });
    cursor += 4;
    sectionTitle('Limitations and Methodology');
    const limitations = [
      'This report verifies whether stored artifacts match their recorded hashes.',
      'It does not independently establish legal admissibility.',
      'It does not replace formal chain-of-custody, notarization, expert review, or jurisdiction-specific procedures.',
      'Website content may vary by geography, authentication state, cookies, scripts, browser behavior, or time.',
      'The report is generated from stored capture data and does not recapture the website.',
    ];
    limitations.forEach((item) => addWrappedText(`- ${item}`, { width: contentWidth - 16, size: 8.7, lineHeight: 12, x: margin + 8, gap: 3 }));
    cursor += 8;
    addWrappedText('Generated by VeritasWeb. System-generated report from stored evidence artifacts and metadata.', { width: contentWidth, size: 8.5, color: COLORS.muted, gap: 4 });
  }

  addCover();
  addScreenshotPage();
  addVerificationPage();
  addArtifactsPage();
  addTechnicalAppendix();
  drawFooter();
  return Buffer.from(pdf.output('arraybuffer'));
}
