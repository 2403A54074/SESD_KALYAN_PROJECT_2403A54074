import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { WatermarkColorPreset, WatermarkConfig } from '../types/system';

// Session binary store for genuine uploaded, generated, and watermarked PDFs
const pdfBinaryStore = new Map<string, Uint8Array>();

export function savePdfBinary(key: string, bytes: Uint8Array): void {
  pdfBinaryStore.set(key, bytes);
}

export function getPdfBinary(key: string): Uint8Array | undefined {
  return pdfBinaryStore.get(key);
}

export function deletePdfBinary(key: string): void {
  pdfBinaryStore.delete(key);
}

export function clearPdfBinaries(): void {
  pdfBinaryStore.clear();
}

export function createPdfBlobUrl(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export function downloadPdfBytes(bytes: Uint8Array, fileName: string): void {
  const url = createPdfBlobUrl(bytes);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function computeSha256Hex(input: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const normalized = new Uint8Array(bytes.byteLength);
  normalized.set(bytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', normalized.buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeStringSha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return computeSha256Hex(data);
}

export async function computeHmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hasPdfMagicHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

export interface PdfInspection {
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  embeddedAttribution?: string;
}

export async function inspectPdfBytes(bytes: Uint8Array): Promise<PdfInspection> {
  if (!hasPdfMagicHeader(bytes)) {
    throw new Error('File does not begin with a valid %PDF- header.');
  }
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const keywords = doc.getKeywords() || '';
  const subject = doc.getSubject() || '';
  let embeddedAttribution: string | undefined;

  const markerSource = `${keywords} ${subject}`;
  const match = markerSource.match(/RW-ATTR:([A-Za-z0-9_-]+):([^\s;]+)/);
  if (match) {
    embeddedAttribution = `${match[1]} (${match[2]})`;
  }

  return {
    pageCount: doc.getPageCount(),
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject,
    keywords,
    embeddedAttribution,
  };
}

export async function generateSamplePdf(options: {
  title: string;
  classification: string;
  ownerName: string;
  sections: { heading: string; body: string }[];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(options.title);
  pdfDoc.setAuthor(options.ownerName);
  pdfDoc.setSubject(`Classification: ${options.classification}`);
  pdfDoc.setCreator('Digital Document Watermarking & Ephemeral SMTP-Webhook Relay System');

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Header band
  page1.drawRectangle({
    x: 0,
    y: height - 92,
    width,
    height: 92,
    color: rgb(0.059, 0.09, 0.165),
  });

  page1.drawText('CONTROLLED ENGINEERING DOCUMENT', {
    x: 48,
    y: height - 34,
    size: 9,
    font: fontMono,
    color: rgb(0.133, 0.827, 0.933),
  });

  page1.drawText(options.title, {
    x: 48,
    y: height - 60,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page1.drawText(`Classification: ${options.classification}  |  Custodian: ${options.ownerName}`, {
    x: 48,
    y: height - 78,
    size: 9,
    font: fontRegular,
    color: rgb(0.796, 0.835, 0.882),
  });

  let cursorY = height - 135;

  for (const section of options.sections) {
    page1.drawText(section.heading, {
      x: 48,
      y: cursorY,
      size: 12,
      font: fontBold,
      color: rgb(0.059, 0.09, 0.165),
    });
    cursorY -= 18;

    const words = section.body.split(' ');
    let line = '';
    const maxChars = 84;
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxChars) {
        page1.drawText(line.trim(), {
          x: 48,
          y: cursorY,
          size: 10,
          font: fontRegular,
          color: rgb(0.2, 0.255, 0.333),
        });
        cursorY -= 15;
        line = word;
      } else {
        line = (line + ' ' + word).trim();
      }
    }
    if (line.trim()) {
      page1.drawText(line.trim(), {
        x: 48,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: rgb(0.2, 0.255, 0.333),
      });
      cursorY -= 26;
    }
  }

  // Page 2 for multi-page watermark verification
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawText('Appendix A — Cryptographic Attribution & Relay Protocol', {
    x: 48,
    y: height - 72,
    size: 14,
    font: fontBold,
    color: rgb(0.059, 0.09, 0.165),
  });
  page2.drawText(
    'This second page validates multi-page visible watermarking and SHA-256 integrity sealing.',
    {
      x: 48,
      y: height - 102,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.255, 0.333),
    }
  );
  page2.drawText(
    'Every recipient copy embeds an immutable footer reference and diagonal attribution stamp.',
    {
      x: 48,
      y: height - 120,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.255, 0.333),
    }
  );

  return pdfDoc.save();
}

function presetToRgb(preset: WatermarkColorPreset) {
  switch (preset) {
    case 'cyan':
      return rgb(0.031, 0.569, 0.698);
    case 'violet':
      return rgb(0.486, 0.227, 0.929);
    case 'crimson':
      return rgb(0.863, 0.149, 0.149);
    case 'navy':
    default:
      return rgb(0.059, 0.09, 0.165);
  }
}

export function interpolateWatermarkText(
  template: string,
  params: {
    recipientName: string;
    recipientEmail: string;
    watermarkCode: string;
    dateLabel: string;
  }
): string {
  return template
    .replaceAll('{{recipient_name}}', params.recipientName)
    .replaceAll('{{recipient_email}}', params.recipientEmail)
    .replaceAll('{{watermark_id}}', params.watermarkCode)
    .replaceAll('{{date}}', params.dateLabel);
}

export async function applyVisiblePdfWatermark(params: {
  sourceBytes: Uint8Array;
  originalSha256: string;
  recipientName: string;
  recipientEmail: string;
  classification: string;
  watermarkCode: string;
  config: WatermarkConfig;
}): Promise<{
  watermarkedBytes: Uint8Array;
  watermarkedSha256: string;
  overlayText: string;
}> {
  const pdfDoc = await PDFDocument.load(params.sourceBytes, { ignoreEncryption: true });
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const dateLabel = new Date().toISOString().slice(0, 10);
  const overlayText = interpolateWatermarkText(params.config.overlayTemplate, {
    recipientName: params.recipientName,
    recipientEmail: params.recipientEmail,
    watermarkCode: params.watermarkCode,
    dateLabel,
  });

  const color = presetToRgb(params.config.colorPreset);
  const pages = pdfDoc.getPages();

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();
    const textWidth = fontBold.widthOfTextAtSize(overlayText, params.config.fontSize);

    // Primary diagonal watermark centered on page
    const centerX = Math.max(40, width / 2 - (textWidth * 0.35));
    const centerY = height / 2 - 20;

    page.drawText(overlayText, {
      x: centerX,
      y: centerY,
      size: params.config.fontSize,
      font: fontBold,
      color,
      opacity: params.config.opacity,
      rotate: degrees(params.config.rotationDeg),
    });

    // Secondary diagonal watermark at upper/lower offset for leak resilience
    page.drawText(`${params.recipientEmail} · ${params.watermarkCode}`, {
      x: Math.max(48, width * 0.16),
      y: height * 0.74,
      size: Math.max(12, Math.round(params.config.fontSize * 0.65)),
      font: fontBold,
      color,
      opacity: Math.max(0.08, params.config.opacity * 0.75),
      rotate: degrees(params.config.rotationDeg),
    });

    if (params.config.includeCornerBadge) {
      page.drawText(`${params.classification.toUpperCase()} · ${params.watermarkCode} · P${idx + 1}/${pages.length}`, {
        x: Math.max(32, width - 255),
        y: height - 22,
        size: 8,
        font: fontMono,
        color,
        opacity: Math.min(0.9, params.config.opacity + 0.45),
      });
    }

    if (params.config.includeFooterStamp) {
      const footerLine = `Issued to: ${params.recipientName} <${params.recipientEmail}> | ID: ${params.watermarkCode} | Master SHA-256: ${params.originalSha256.slice(0, 16)}...`;
      page.drawText(footerLine, {
        x: 32,
        y: 16,
        size: 7.5,
        font: fontMono,
        color: rgb(0.28, 0.33, 0.41),
        opacity: 0.85,
      });
    }
  });

  // Embed structured attribution marker in PDF metadata for forensic inspection
  const existingKeywords = pdfDoc.getKeywords() || '';
  const attributionTag = `RW-ATTR:${params.watermarkCode}:${params.recipientEmail};MASTER:${params.originalSha256.slice(0, 16)}`;
  pdfDoc.setKeywords([existingKeywords, attributionTag].filter(Boolean));
  pdfDoc.setSubject(`Watermarked Copy for ${params.recipientEmail} (${params.watermarkCode})`);

  const watermarkedBytes = await pdfDoc.save();
  const watermarkedSha256 = await computeSha256Hex(watermarkedBytes);

  return {
    watermarkedBytes,
    watermarkedSha256,
    overlayText,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function shortHash(hash: string, prefix = 12, suffix = 8): string {
  if (!hash || hash.length <= prefix + suffix) return hash;
  return `${hash.slice(0, prefix)}…${hash.slice(-suffix)}`;
}
