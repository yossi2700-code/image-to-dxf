/**
 * Converts a PDF file to a PNG image (first page) via the server endpoint.
 * Returns a File object that can be used exactly like an uploaded image file.
 */
export async function convertPdfToImage(pdfFile: File): Promise<File> {
  const formData = new FormData();
  formData.append("file", pdfFile);

  const res = await fetch("/api/pdf-to-image", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Failed to convert PDF to image");
  }

  const data = await res.json();
  if (!data.dataUrl) throw new Error("No image data returned from PDF conversion");

  // Convert base64 dataUrl → Blob → File
  const base64 = data.dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });

  // Name the file after the original PDF but with .png extension
  const pngName = pdfFile.name.replace(/\.pdf$/i, ".png");
  return new File([blob], pngName, { type: "image/png" });
}

/**
 * Returns true if the file is a PDF.
 */
export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
