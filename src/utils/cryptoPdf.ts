import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { WatermarkColorPreset, WatermarkConfig } from '../types/system';

// In-memory cache + IndexedDB persistent vault so uploaded & watermarked PDFs survive refreshes
const pdfBinaryStore = new Map<string, Uint8Array>();

const IDB_NAME = 'rw_pdf_vault_db';
const IDB_STORE = 'pdf_binaries';

function openVaultDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function putBinaryToIdb(key: string, bytes: Uint8Array): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      tx.objectStore(IDB_STORE).put(copy.buffer, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteBinaryFromIdb(key: string): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearAllIdbBinaries(): Promise<void> {
  pdfBinaryStore.clear();
  const db = await openVaultDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function hydratePdfBinariesFromStore(keys: string[]): Promise<void> {
  const missing = keys.filter((k) => !pdfBinaryStore.has(k));
  if (missing.length === 0) return;
  const db = await openVaultDb();
  if (!db) return;

  await Promise.all(
    missing.map(
      (key) =>
        new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = () => {
              const res = req.result;
              if (res instanceof ArrayBuffer) {
                pdfBinaryStore.set(key, new Uint8Array(res));
              } else if (res instanceof Uint8Array) {
                pdfBinaryStore.set(key, res);
              }
              resolve();
            };
            req.onerror = () => resolve();
          } catch {
            resolve();
          }
        })
    )
  );
}

export function savePdfBinary(key: string, bytes: Uint8Array): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  pdfBinaryStore.set(key, copy);
  void putBinaryToIdb(key, copy);
}

export function getPdfBinary(key: string): Uint8Array | undefined {
  return pdfBinaryStore.get(key);
}

export function deletePdfBinary(key: string): void {
  pdfBinaryStore.delete(key);
  void deleteBinaryFromIdb(key);
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
  embeddedWatermarkCode?: string;
}

export async function inspectPdfBytes(bytes: Uint8Array): Promise<PdfInspection> {
  if (!hasPdfMagicHeader(bytes)) {
    throw new Error('File does not begin with a valid %PDF- header.');
  }
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const keywords = doc.getKeywords() || '';
  const subject = doc.getSubject() || '';
  const match = `${keywords} ${subject}`.match(/WM-TRACK:(WM-[A-Z0-9]+)/i);
  return {
    pageCount: doc.getPageCount(),
    title: doc.getTitle(),
    author: doc.getAuthor(),
    embeddedWatermarkCode: match?.[1]?.toUpperCase(),
  };
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
    recipientCode: string;
    recipientEmail: string;
    documentId: string;
    watermarkCode: string;
    dateLabel: string;
  }
): string {
  return template
    .replaceAll('{{recipient_name}}', params.recipientName)
    .replaceAll('{{recipient_id}}', params.recipientCode)
    .replaceAll('{{recipient_email}}', params.recipientEmail)
    .replaceAll('{{document_id}}', `DOC-${params.documentId.slice(0, 8).toUpperCase()}`)
    .replaceAll('{{watermark_id}}', params.watermarkCode)
    .replaceAll('{{date}}', params.dateLabel);
}

export async function applyVisiblePdfWatermark(params: {
  sourceBytes: Uint8Array;
  documentId: string;
  originalSha256: string;
  recipientCode: string;
  recipientName: string;
  recipientEmail: string;
  classification: string;
  watermarkCode: string;
  issueDate: string;
  config: WatermarkConfig;
}): Promise<{
  watermarkedBytes: Uint8Array;
  watermarkedSha256: string;
  overlayText: string;
}> {
  // Load from a defensive copy so sourceBytes (the original PDF) is never mutated
  const sourceCopy = new Uint8Array(params.sourceBytes.byteLength);
  sourceCopy.set(params.sourceBytes);

  const pdfDoc = await PDFDocument.load(sourceCopy, { ignoreEncryption: true });
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const shortDocId = `DOC-${params.documentId.slice(0, 8).toUpperCase()}`;
  const overlayText = interpolateWatermarkText(params.config.overlayTemplate, {
    recipientName: params.recipientName,
    recipientCode: params.recipientCode,
    recipientEmail: params.recipientEmail,
    documentId: params.documentId,
    watermarkCode: params.watermarkCode,
    dateLabel: params.issueDate,
  });

  const color = presetToRgb(params.config.colorPreset);
  const pages = pdfDoc.getPages();

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();
    const textWidth = fontBold.widthOfTextAtSize(overlayText, params.config.fontSize);

    // Primary diagonal watermark centered on page
    const centerX = Math.max(40, width / 2 - textWidth * 0.35);
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

    // Secondary tracking line containing Recipient Name, Recipient ID, Document ID, Issue Date, Tracking ID
    page.drawText(
      `${params.recipientName} (${params.recipientCode}) · ${shortDocId} · ${params.issueDate} · ${params.watermarkCode}`,
      {
        x: Math.max(36, width * 0.1),
        y: height * 0.74,
        size: Math.max(9.5, Math.round(params.config.fontSize * 0.5)),
        font: fontBold,
        color,
        opacity: Math.max(0.08, params.config.opacity * 0.78),
        rotate: degrees(params.config.rotationDeg),
      }
    );

    if (params.config.includeCornerBadge) {
      page.drawText(
        `${params.classification.toUpperCase()} · ${shortDocId} · ${params.watermarkCode} · P${idx + 1}/${pages.length}`,
        {
          x: Math.max(24, width - 305),
          y: height - 22,
          size: 7.5,
          font: fontMono,
          color,
          opacity: Math.min(0.9, params.config.opacity + 0.45),
        }
      );
    }

    if (params.config.includeFooterStamp) {
      const footerLine = `Recipient: ${params.recipientName} (${params.recipientCode}) | Doc: ${shortDocId} | Date: ${params.issueDate} | Track: ${params.watermarkCode}`;
      page.drawText(footerLine, {
        x: 24,
        y: 15,
        size: 6.8,
        font: fontMono,
        color: rgb(0.28, 0.33, 0.41),
        opacity: 0.9,
      });
    }
  });

  const existingKeywords = pdfDoc.getKeywords() || '';
  const trackingTag = `WM-TRACK:${params.watermarkCode}|REC:${params.recipientCode}|DOC:${shortDocId}|DATE:${params.issueDate}`;
  pdfDoc.setKeywords([existingKeywords, trackingTag].filter(Boolean));
  pdfDoc.setSubject(
    `Watermarked Copy for ${params.recipientName} (${params.recipientCode}) - ${params.watermarkCode} - Issued ${params.issueDate}`
  );

  const watermarkedBytes = await pdfDoc.save();
  const watermarkedSha256 = await computeSha256Hex(watermarkedBytes);

  return {
    watermarkedBytes,
    watermarkedSha256,
    overlayText,
  };
}

export async function generateReportPdfBytes(params: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: string[][];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const pageWidth = 842; // Landscape A4
  const pageHeight = 595;
  const margin = 36;
  const lineHeight = 18;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = (targetPage: typeof page, pageNumber: number) => {
    targetPage.drawText(params.title, {
      x: margin,
      y: pageHeight - margin,
      size: 15,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    });
    targetPage.drawText(`${params.subtitle} · Generated ${new Date().toLocaleString()}`, {
      x: margin,
      y: pageHeight - margin - 18,
      size: 9,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.48),
    });
    targetPage.drawText(`Page ${pageNumber}`, {
      x: pageWidth - margin - 45,
      y: pageHeight - margin,
      size: 9,
      font: fontMono,
      color: rgb(0.4, 0.45, 0.52),
    });

    const headerY = pageHeight - margin - 44;
    const colWidth = (pageWidth - margin * 2) / params.headers.length;
    params.headers.forEach((h, idx) => {
      targetPage.drawText(h.slice(0, 26), {
        x: margin + idx * colWidth,
        y: headerY,
        size: 8.5,
        font: fontBold,
        color: rgb(0.03, 0.57, 0.7),
      });
    });

    targetPage.drawLine({
      start: { x: margin, y: headerY - 6 },
      end: { x: pageWidth - margin, y: headerY - 6 },
      thickness: 0.75,
      color: rgb(0.8, 0.84, 0.88),
    });

    return headerY - 22;
  };

  let pageNumber = 1;
  y = drawHeader(page, pageNumber);

  const colWidth = (pageWidth - margin * 2) / params.headers.length;
  const maxChars = Math.max(14, Math.floor(colWidth / 5.2));

  if (params.rows.length === 0) {
    page.drawText('No records matched the current filter.', {
      x: margin,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.56),
    });
  } else {
    for (const row of params.rows) {
      if (y < margin + 28) {
        pageNumber += 1;
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = drawHeader(page, pageNumber);
      }
      row.forEach((cell, idx) => {
        const clean = String(cell ?? '').replace(/[^\x20-\x7E]/g, ' ');
        const clipped = clean.length > maxChars ? `${clean.slice(0, maxChars - 1)}...` : clean;
        page.drawText(clipped, {
          x: margin + idx * colWidth,
          y,
          size: 8,
          font: fontRegular,
          color: rgb(0.12, 0.16, 0.23),
        });
      });
      y -= lineHeight;
    }
  }

  return pdfDoc.save();
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
