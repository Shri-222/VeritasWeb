import { jsPDF } from 'jspdf';
import {
  getCaptureManifestHash,
  getCaptureScreenshotPath,
  type OwnedCaptureRecord,
} from '@/lib/captures';
import type { CaptureVerificationResult } from '@/lib/verification';

if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'node' },
    writable: true,
  });
}

type ReportInput = {
  capture: OwnedCaptureRecord;
  verification: CaptureVerificationResult;
  generatedAt: string;
};

type Rgb = [number, number, number];

const COLORS = {
  navy: [7, 11, 20] as Rgb,
  surface: [248, 250, 252] as Rgb,
  card: [255, 255, 255] as Rgb,
  border: [203, 213, 225] as Rgb,
  muted: [100, 116, 139] as Rgb,
  text: [15, 23, 42] as Rgb,
  cyan: [6, 182, 212] as Rgb,
  green: [34, 197, 94] as Rgb,
  amber: [245, 158, 11] as Rgb,
  red: [239, 68, 68] as Rgb,
  softCyan: [236, 254, 255] as Rgb,
  softGreen: [240, 253, 244] as Rgb,
  softAmber: [255, 251, 235] as Rgb,
  softRed: [254, 242, 242] as Rgb,
};

const IMPORTANT_HEADERS = [
  'content-type',
  'last-modified',
  'etag',
  'cache-control',
  'date',
  'server',
];

function stringifyValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 'Not recorded';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';

  return new Date(value).toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

function headersObject(headers: unknown) {
  if (
    !headers ||
    typeof headers !== 'object' ||
    Array.isArray(headers)
  ) {
    return {};
  }

  return Object.entries(headers).reduce<Record<string, unknown>>(
    (result, [key, value]) => {
      result[key.toLowerCase()] = value;
      return result;
    },
    {}
  );
}

function resultLabel(match: boolean | undefined) {
  if (match === true) return 'Match';
  if (match === false) return 'No match';

  return 'Not available';
}

export function generateCaptureReportPdf({
  capture,
  verification,
  generatedAt,
}: ReportInput) {
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 38;
  const contentWidth = pageWidth - margin * 2;
  const screenshotPath = getCaptureScreenshotPath(capture);
  const manifestHash = getCaptureManifestHash(capture);
  const headers = headersObject(capture.headers);
  const importantHeaders = IMPORTANT_HEADERS.reduce<Record<string, unknown>>(
    (result, header) => {
      if (headers[header] !== undefined) {
        result[header] = headers[header];
      }
      return result;
    },
    {}
  );

  function setFill(color: Rgb) {
    pdf.setFillColor(color[0], color[1], color[2]);
  }

  function setDraw(color: Rgb) {
    pdf.setDrawColor(color[0], color[1], color[2]);
  }

  function setText(color: Rgb) {
    pdf.setTextColor(color[0], color[1], color[2]);
  }

  function wrap(text: unknown, width: number) {
    const lines = pdf.splitTextToSize(stringifyValue(text), width);
    return Array.isArray(lines) ? lines : [lines];
  }

  function addWrappedText({
    text,
    x,
    y,
    width,
    size = 9,
    color = COLORS.text,
    bold = false,
    lineHeight = size + 4,
  }: {
    text: unknown;
    x: number;
    y: number;
    width: number;
    size?: number;
    color?: Rgb;
    bold?: boolean;
    lineHeight?: number;
  }) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    setText(color);

    const lines = wrap(text, width);
    pdf.text(lines, x, y);
    return y + lines.length * lineHeight;
  }

  function drawCard(x: number, y: number, width: number, height: number) {
    setFill(COLORS.card);
    setDraw(COLORS.border);
    pdf.roundedRect(x, y, width, height, 6, 6, 'FD');
  }

  function drawHeader() {
    setFill(COLORS.navy);
    pdf.rect(0, 0, pageWidth, 66, 'F');
    setText(COLORS.card);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('VeritasWeb', margin, 28);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text('Evidence Preservation Report', margin, 45);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(
      `Verification Status: ${verification.status}`,
      pageWidth - margin,
      28,
      { align: 'right' }
    );
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(
      `Generated: ${formatDate(generatedAt)}`,
      pageWidth - margin,
      45,
      { align: 'right' }
    );
  }

  function sectionTitle(title: string, y: number) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    setText(COLORS.text);
    pdf.text(title, margin, y);
    setDraw(COLORS.border);
    pdf.line(margin, y + 8, pageWidth - margin, y + 8);
    return y + 24;
  }

  function labelValue(
    label: string,
    value: unknown,
    x: number,
    y: number,
    width: number
  ) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    setText(COLORS.muted);
    pdf.text(label.toUpperCase(), x, y);

    return addWrappedText({
      text: value,
      x,
      y: y + 13,
      width,
      size: 8,
      lineHeight: 11,
    });
  }

  function addFooter() {
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      setText(COLORS.muted);
      pdf.text(
        `VeritasWeb Evidence Preservation Report - Page ${page} of ${pageCount}`,
        margin,
        pageHeight - 24
      );
    }
  }

  function addSummaryBox() {
    const y = 92;
    drawCard(margin, y, contentWidth, 260);
    let cursor = y + 26;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    setText(COLORS.text);
    pdf.text('Record Summary', margin + 18, cursor);
    cursor += 28;

    const gap = 18;
    const colWidth = (contentWidth - 36 - gap) / 2;
    const leftX = margin + 18;
    const rightX = leftX + colWidth + gap;

    cursor = labelValue('Capture ID', capture.id, leftX, cursor, colWidth) + 10;
    cursor = labelValue('Monitor ID', capture.monitor_id, leftX, cursor, colWidth) + 10;
    cursor = labelValue(
      'Page Title',
      capture.page_title,
      leftX,
      cursor,
      colWidth
    ) + 10;
    cursor = labelValue(
      'Captured At',
      formatDate(capture.captured_at ?? capture.timestamp),
      leftX,
      cursor,
      colWidth
    );

    let rightCursor = y + 54;
    rightCursor = labelValue(
      'Original URL',
      capture.original_url,
      rightX,
      rightCursor,
      colWidth
    ) + 10;
    rightCursor = labelValue(
      'Final URL',
      capture.final_url,
      rightX,
      rightCursor,
      colWidth
    ) + 10;
    rightCursor = labelValue(
      'HTTP Status',
      capture.status_code,
      rightX,
      rightCursor,
      colWidth
    ) + 10;
    labelValue(
      'Trigger Type',
      capture.trigger_type,
      rightX,
      rightCursor,
      colWidth
    );
  }

  function addDisclaimerBox(y: number) {
    setFill(COLORS.softAmber);
    setDraw(COLORS.amber);
    pdf.roundedRect(margin, y, contentWidth, 72, 6, 6, 'FD');
    addWrappedText({
      text: 'Disclaimer',
      x: margin + 16,
      y: y + 20,
      width: contentWidth - 32,
      size: 10,
      bold: true,
    });
    addWrappedText({
      text:
        'This report verifies stored artifacts against recorded hashes. It does not independently prove legal admissibility and does not replace formal chain-of-custody or jurisdiction-specific evidence procedures.',
      x: margin + 16,
      y: y + 40,
      width: contentWidth - 32,
      size: 8.5,
      lineHeight: 12,
    });
  }

  function addStatusStrip() {
    const y = 386;
    const statusColor =
      verification.status === 'VERIFIED'
        ? COLORS.green
        : verification.status === 'FAILED'
          ? COLORS.red
          : COLORS.amber;
    const statusFill =
      verification.status === 'VERIFIED'
        ? COLORS.softGreen
        : verification.status === 'FAILED'
          ? COLORS.softRed
          : COLORS.softAmber;

    setFill(statusFill);
    setDraw(statusColor);
    pdf.roundedRect(margin, y, contentWidth, 74, 6, 6, 'FD');

    labelValue('Verification Status', verification.status, margin + 16, y + 22, 135);
    labelValue('Overall Result', verification.message, margin + 170, y + 22, 165);
    labelValue(
      'Report Source',
      'Stored capture data',
      margin + 360,
      y + 22,
      contentWidth - 376
    );
  }

  function addScreenshotPage() {
    pdf.addPage();
    drawHeader();
    let y = sectionTitle('Visual Screenshot', 96);
    drawCard(margin, y, contentWidth, 330);
    y += 18;

    let screenshotIncluded = false;
    let screenshotReason = 'No screenshot artifact available.';

    if (verification.artifacts?.screenshotBuffer) {
      try {
        const imageData = `data:image/png;base64,${verification.artifacts.screenshotBuffer.toString('base64')}`;
        const imageProperties = pdf.getImageProperties(imageData);
        const imageWidth = contentWidth - 40;
        const imageHeight =
          (imageProperties.height * imageWidth) / imageProperties.width;
        const displayHeight = Math.min(imageHeight, 286);

        pdf.addImage(
          imageData,
          'PNG',
          margin + 20,
          y,
          imageWidth,
          displayHeight
        );
        screenshotIncluded = true;
      } catch (error) {
        console.error('[pdf-report:screenshot]', error);
        screenshotReason = 'Screenshot artifact could not be embedded.';
      }
    }

    if (!screenshotIncluded) {
      addWrappedText({
        text: screenshotReason,
        x: margin + 20,
        y: y + 30,
        width: contentWidth - 40,
        size: 10,
        color: COLORS.muted,
      });
    }

    y = sectionTitle('Integrity Verification', 468);
    addVerificationTable(y);
  }

  function addVerificationTable(y: number) {
    const columns = [
      { label: 'Artifact', width: 86 },
      { label: 'Stored Hash', width: 178 },
      { label: 'Computed Hash', width: 178 },
      { label: 'Result', width: 70 },
    ];
    const rows = [
      {
        artifact: 'Screenshot',
        stored: verification.checks.screenshot?.stored ?? capture.screenshot_sha256,
        computed: verification.checks.screenshot?.computed,
        result: resultLabel(verification.checks.screenshot?.match),
      },
      {
        artifact: 'HTML',
        stored: verification.checks.html?.stored ?? capture.html_sha256,
        computed: verification.checks.html?.computed,
        result: resultLabel(verification.checks.html?.match),
      },
      {
        artifact: 'Manifest',
        stored: verification.checks.manifest?.stored ?? manifestHash,
        computed: verification.checks.manifest?.computed,
        result: resultLabel(verification.checks.manifest?.match),
      },
    ];

    let x = margin;
    setFill(COLORS.navy);
    pdf.rect(margin, y, contentWidth, 28, 'F');
    columns.forEach((column) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      setText(COLORS.card);
      pdf.text(column.label, x + 8, y + 18);
      x += column.width;
    });

    let rowY = y + 28;
    rows.forEach((row, index) => {
      const rowValues = [
        row.artifact,
        row.stored,
        row.computed,
        row.result,
      ];
      const wrapped = rowValues.map((value, columnIndex) =>
        wrap(value, columns[columnIndex].width - 14)
      );
      const rowHeight = Math.max(
        34,
        ...wrapped.map((lines) => lines.length * 10 + 14)
      );

      setFill(index % 2 === 0 ? COLORS.card : COLORS.surface);
      setDraw(COLORS.border);
      pdf.rect(margin, rowY, contentWidth, rowHeight, 'FD');

      let cellX = margin;
      wrapped.forEach((lines, columnIndex) => {
        pdf.setFont(
          columnIndex === 0 || columnIndex === 3 ? 'helvetica' : 'courier',
          columnIndex === 0 ? 'bold' : 'normal'
        );
        pdf.setFontSize(columnIndex === 0 || columnIndex === 3 ? 8 : 6.7);
        setText(
          rowValues[3] === 'Match' && columnIndex === 3
            ? COLORS.green
            : rowValues[3] === 'No match' && columnIndex === 3
              ? COLORS.red
              : COLORS.text
        );
        pdf.text(lines, cellX + 8, rowY + 16);
        cellX += columns[columnIndex].width;
      });

      rowY += rowHeight;
    });
  }

  function addArtifactsAndMetadataPage() {
    pdf.addPage();
    drawHeader();
    let y = sectionTitle('Evidence Artifacts', 96);
    const artifactRows = [
      ['Screenshot path', screenshotPath],
      ['HTML path', capture.html_path],
      ['Manifest path', capture.manifest_path],
    ];

    artifactRows.forEach(([label, value]) => {
      drawCard(margin, y, contentWidth, 48);
      labelValue(String(label), value, margin + 16, y + 18, contentWidth - 32);
      y += 58;
    });

    y = sectionTitle('HTTP Response Metadata', y + 12);
    drawCard(margin, y, contentWidth, 168);
    let metadataY = y + 22;
    metadataY = addWrappedText({
      text: 'Important headers',
      x: margin + 16,
      y: metadataY,
      width: contentWidth - 32,
      size: 9,
      bold: true,
    }) + 4;
    metadataY = addWrappedText({
      text: JSON.stringify(importantHeaders, null, 2),
      x: margin + 16,
      y: metadataY,
      width: contentWidth - 32,
      size: 7,
      color: COLORS.muted,
      lineHeight: 9,
    }) + 8;

    const fullHeaderLines = wrap(
      JSON.stringify(headers, null, 2),
      contentWidth - 32
    );
    addWrappedText({
      text: 'Full response headers',
      x: margin + 16,
      y: metadataY,
      width: contentWidth - 32,
      size: 9,
      bold: true,
    });
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(6.5);
    setText(COLORS.muted);
    pdf.text(fullHeaderLines.slice(0, 16), margin + 16, metadataY + 14);
    if (fullHeaderLines.length > 16) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.text(
        'Additional headers omitted from this preview section due to space.',
        margin + 16,
        y + 152
      );
    }

    y += 194;
    y = sectionTitle('Limitations', y);
    const limitations = [
      'Stored artifact verification only.',
      'No independent legal admissibility guarantee.',
      'No formal chain-of-custody or notarization is provided by this report.',
      'Content can vary by region, cookies, authentication state, scripts, browser behavior, or time.',
      'Report generated from stored data, not live recapture.',
    ];
    drawCard(margin, y, contentWidth, 132);
    let limitY = y + 22;
    limitations.forEach((item) => {
      limitY = addWrappedText({
        text: `- ${item}`,
        x: margin + 16,
        y: limitY,
        width: contentWidth - 32,
        size: 8.5,
        lineHeight: 12,
      });
    });
  }

  drawHeader();
  addSummaryBox();
  addStatusStrip();
  addDisclaimerBox(492);
  addWrappedText({
    text: 'Generated by VeritasWeb as a system-generated report from stored capture artifacts and metadata.',
    x: margin,
    y: 600,
    width: contentWidth,
    size: 9,
    color: COLORS.muted,
  });
  addScreenshotPage();
  addArtifactsAndMetadataPage();
  addFooter();

  return Buffer.from(pdf.output('arraybuffer'));
}
