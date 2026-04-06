/**
 * FreeDXF Home — community free DXF files page at /free
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, ArrowRight, Download, Layers, Sparkles, ArrowLeft } from "lucide-react";
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
  lineCount: number | null;
  downloadCount: number | null;
  createdAt: string;
}

interface Category {
  name: string;
  count: number;
}

export default function FreeDxfHome() {
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalFiles, setTotalFiles] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [filesRes, catsRes] = await Promise.all([
          fetch("/api/freedxf/files?limit=12").then(r => r.json()),
          fetch("/api/freedxf/categories").then(r => r.json()),
        ]);
        setFiles(filesRes.files || []);
        setTotalFiles(filesRes.total || 0);
        setCategories(catsRes.categories || []);
      } catch (err) {
        console.error("Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/free/browse?search=${encodeURIComponent(search.trim())}`);
    }
  };

  const getTitle = (file: SharedFile) =>
    (language === "he" && file.titleHe) ? file.titleHe : (file.title || "Untitled");

  return (
    <div className="min-h-screen bg-white">
      {/* Back to main site */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-purple-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {language === "he" ? "חזרה לכלי העיצוב" : "Back to Design Tools"}
          </Link>
          <span className="text-xs text-gray-400">{t("freeNav" as any)}</span>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 start-10 w-32 h-32 border border-white/30 rounded-full" />
          <div className="absolute bottom-10 end-20 w-48 h-48 border border-white/20 rounded-full" />
          <div className="absolute top-1/2 start-1/3 w-24 h-24 border border-white/20 rotate-45" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 relative">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-3">
              {t("freeHeroTitle" as any)}
            </h1>
            <p className="text-xl sm:text-2xl text-white/80 font-light mb-6">
              {t("freeHeroSubtitle" as any)}
            </p>
            <p className="text-base text-white/70 mb-8 max-w-xl mx-auto">
              {t("freeHeroDesc" as any)}
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="max-w-lg mx-auto">
              <div className="relative">
                <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("freeSearchPlaceholder" as any)}
                  className="w-full ps-12 pe-32 py-4 rounded-2xl bg-white text-gray-900 placeholder-gray-400 text-base shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button
                  type="submit"
                  className="absolute end-2 top-1/2 -translate-y-1/2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {t("freeSearch" as any)}
                </button>
              </div>
            </form>

            {/* Stats */}
            <div className="flex items-center justify-center gap-8 mt-8 text-white/70 text-sm">
              <div className="flex items-center gap-1.5">
                <Download className="w-4 h-4" />
                <span>{totalFiles} {t("freeFiles" as any)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                <span>{categories.length} {t("freeCategoriesCount" as any)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>100% {t("freeFree" as any)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("freeCategories" as any)}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/free/browse"
              className="px-4 py-2 rounded-full text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              {t("freeCatAll" as any)} ({totalFiles})
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href={`/free/browse?category=${encodeURIComponent(cat.name)}`}
                className="px-4 py-2 rounded-full text-sm font-medium bg-gray-50 text-gray-600 hover:bg-purple-50 hover:text-purple-600 border border-gray-200 transition-colors"
              >
                {cat.name} ({cat.count})
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest Files */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("freeLatest" as any)}
          </h2>
          <Link
            href="/free/browse"
            className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
          >
            {t("freeBrowseAll" as any)}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-xl animate-pulse aspect-square" />
            ))}
          </div>
        ) : files.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((file) => (
              <Link
                key={file.id}
                href={`/free/file/${file.id}`}
                className="group block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="relative aspect-square bg-gray-50 overflow-hidden">
                  {file.previewImageUrl ? (
                    <img
                      src={file.previewImageUrl}
                      alt={getTitle(file)}
                      className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Layers className="w-12 h-12 text-gray-200" />
                    </div>
                  )}
                  <div className="absolute top-3 start-3">
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold text-white bg-green-500">
                      {t("freeFree" as any)}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-purple-600 transition-colors">
                    {getTitle(file)}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {file.lineCount != null && file.lineCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {file.lineCount.toLocaleString()} {t("freeLines" as any)}
                        </span>
                      )}
                      {file.downloadCount != null && file.downloadCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Download className="w-3 h-3" />
                          {file.downloadCount}
                        </span>
                      )}
                    </div>
                    {file.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">
                        {file.category}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Layers className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {t("freeNoFiles" as any)}
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {t("freeNoFilesDesc" as any)}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 transition-opacity"
            >
              {t("freeTryTools" as any)}
            </Link>
          </div>
        )}
      </section>

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            {t("freeCreateOwn" as any)}
          </h2>
          <p className="text-gray-600 mb-6 max-w-lg mx-auto">
            {t("freeCreateOwnDesc" as any)}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 transition-opacity shadow-lg"
          >
            {t("freeTryTools" as any)}
          </Link>
          <p className="text-xs text-gray-400 mt-3">
            {t("freeFreeTokens" as any)}
          </p>
        </div>
      </section>
    </div>
  );
}
