/**
 * FreeDXF File Detail — view and download a shared DXF file at /free/file/:id
 */
import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Download, ArrowLeft, Layers, ExternalLink, Lock, Tag, Calendar } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface SharedFile {
  id: number;
  title: string | null;
  titleHe: string | null;
  description: string | null;
  descriptionHe: string | null;
  category: string | null;
  tags: string | null;
  feature: string | null;
  previewImageUrl: string | null;
  svgPreview?: string | null;
  dxfUrl: string | null;
  lineCount: number | null;
  downloadCount: number | null;
  createdAt: string;
}

export default function FreeDxfFileDetail() {
  const { id } = useParams<{ id: string }>();
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const [file, setFile] = useState<SharedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appUser, setAppUser] = useState<{ id: number; email: string } | null>(null);

  // Check if user is logged in
  useEffect(() => {
    fetch("/api/app-auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.user) setAppUser(d.user); })
      .catch(() => {});
  }, []);

  // Load file details
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/freedxf/files/${id}`)
      .then(r => {
        if (!r.ok) throw new Error("File not found");
        return r.json();
      })
      .then(res => setFile(res.file))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    if (!file) return;
    if (!appUser) {
      // Redirect to login — user needs to be logged in
      navigate(`/?login=1&redirect=/free/file/${file.id}`);
      return;
    }

    setDownloading(true);
    try {
      const res = await fetch(`/api/freedxf/files/${file.id}/download`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.error === "AUTH_REQUIRED") {
          navigate(`/?login=1&redirect=/free/file/${file.id}`);
          return;
        }
        throw new Error(data.message || "Download failed");
      }
      const data = await res.json();
      // Trigger download
      const a = document.createElement("a");
      a.href = data.dxfUrl;
      a.download = (data.title || `freedxf-${file.id}`) + ".dxf";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert(t("freeDownloadFailed" as any));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Layers className="w-16 h-16 text-gray-200" />
        <h2 className="text-lg font-medium text-gray-600">{error || "File not found"}</h2>
        <Link
          href="/free/browse"
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
        >
          {t("freeBrowseAll" as any)}
        </Link>
      </div>
    );
  }

  const title = (language === "he" && file.titleHe) ? file.titleHe : (file.title || "Untitled");
  const description = (language === "he" && file.descriptionHe) ? file.descriptionHe : file.description;
  const tags = file.tags?.split(",").map(t => t.trim()).filter(Boolean) || [];
  const date = new Date(file.createdAt).toLocaleDateString(language === "he" ? "he-IL" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Link href="/free/browse" className="hover:text-purple-600 flex items-center gap-1 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t("freeBack" as any)}
            </Link>
            <span>/</span>
            {file.category && (
              <>
                <Link
                  href={`/free/browse?category=${encodeURIComponent(file.category)}`}
                  className="hover:text-purple-600 transition-colors"
                >
                  {file.category}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-gray-700 font-medium truncate">{title}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Preview */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="aspect-square bg-gray-50 flex items-center justify-center p-8">
              {file.svgPreview ? (
                <div
                  className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full"
                  dangerouslySetInnerHTML={{ __html: file.svgPreview }}
                />
              ) : file.previewImageUrl ? (
                <img
                  src={file.previewImageUrl}
                  alt={title}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <Layers className="w-24 h-24 text-gray-200" />
              )}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="mb-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-green-500">
                {t("freeFree" as any)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{title}</h1>

            {description && (
              <p className="text-gray-600 mb-4 leading-relaxed">{description}</p>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-400">
              {file.category && (
                <Link
                  href={`/free/browse?category=${encodeURIComponent(file.category)}`}
                  className="flex items-center gap-1.5 hover:text-purple-600 transition-colors"
                >
                  <Tag className="w-4 h-4" />
                  {file.category}
                </Link>
              )}
              {file.lineCount != null && file.lineCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  {file.lineCount.toLocaleString()} {t("freeLines" as any)}
                </span>
              )}
              {file.downloadCount != null && file.downloadCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Download className="w-4 h-4" />
                  {file.downloadCount} {t("freeDownloads" as any)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {date}
              </span>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/free/browse?search=${encodeURIComponent(tag)}`}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            )}

            {/* Download button */}
            <div className="space-y-3">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg"
              >
                {downloading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {language === "he" ? "מוריד..." : "Downloading..."}
                  </>
                ) : appUser ? (
                  <>
                    <Download className="w-5 h-5" />
                    {t("freeDownloadDxf" as any)}
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    {t("freeLoginToDownload" as any)}
                  </>
                )}
              </button>

              {!appUser && (
                <p className="text-xs text-gray-400 text-center">
                  {t("freeRegRequired" as any)}
                </p>
              )}
            </div>

            {/* Created with dxfai.ai */}
            <div className="mt-8 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-sm text-gray-400 mb-2">
                {t("freeCreatedWith" as any)}
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
              >
                <div className="w-6 h-6 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                  <span className="text-white font-bold text-[8px]">AI</span>
                </div>
                dxfai.ai — AI-Powered DXF Creation
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <p className="text-xs text-gray-400 mt-2">
                {language === "he"
                  ? "צרו קבצי DXF משלכם עם AI. המרת תמונות, יצירת עיצובים ועוד."
                  : "Create your own DXF files with AI. Convert images, generate designs, and more."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
