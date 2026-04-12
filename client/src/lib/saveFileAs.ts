/**
 * saveFileAs — cross-platform "Save As" dialog helper
 *
 * Behavior by platform:
 *  - Desktop (Chrome/Edge/Opera) → File System Access API → native "Save As" dialog
 *  - Android (Chrome) → File System Access API → native "Save As" dialog
 *  - iOS (Safari/Chrome) → Share Sheet (navigator.share) — unchanged, works great
 *  - Firefox / Safari desktop → fallback to direct download (API not supported)
 *  - Any error → fallback to direct download
 */

type MimeType = "application/dxf" | "application/octet-stream" | "application/pdf" | "image/png" | "image/tiff" | "image/jpeg" | "image/svg+xml";

interface SaveOptions {
  blob: Blob;
  filename: string; // e.g. "my-design.dxf"
  mimeType: MimeType;
}

/** Returns true if the File System Access API showSaveFilePicker is available */
function hasSaveFilePicker(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

/** Returns true if running on iOS (iPhone/iPad) */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** Returns true if running on Android */
function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** Returns true if running on a desktop browser (not iOS, not Android) */
function isDesktop(): boolean {
  return !isIOS() && !isAndroid();
}

/**
 * Main entry point.
 * - iOS → Share Sheet
 * - Desktop + Android with File System Access API → Save As dialog
 * - Everything else → direct download
 */
export async function saveFileAs({ blob, filename, mimeType }: SaveOptions): Promise<void> {
  // ── iOS: use Share Sheet (works great, don't change) ─────────────────────
  if (isIOS()) {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return; // user cancelled
        // fall through to direct download
      }
    }
    // iOS fallback: direct download
    triggerDirectDownload(blob, filename);
    return;
  }

  // ── Desktop + Android: try File System Access API (Save As dialog) ───────
  if (hasSaveFilePicker()) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const description = ext === "dxf" ? "DXF Files" : ext === "pdf" ? "PDF Files" : "Files";
    const accept: Record<string, string[]> = {};
    accept[mimeType] = [`.${ext}`];

    try {
      // @ts-expect-error - showSaveFilePicker is not in TS lib yet
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description, accept }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return; // user cancelled dialog
      // API failed → fall through to direct download
    }
  }

  // ── Android without File System Access API: try Share Sheet ──────────────
  if (isAndroid()) {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        // fall through
      }
    }
  }

  // ── Final fallback: direct download ──────────────────────────────────────
  triggerDirectDownload(blob, filename);
}

function triggerDirectDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
