/**
 * FreeDXF Browse — browse/search community DXF files at /free/browse
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Search, Layers, X, ArrowLeft } from "lucide-react";
import { Download } from "lucide-react";
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
  lineCount: number | null;
  downloadCount: number | null;
  createdAt: string;
}

interface Category {
  name: string;
  count: number;
}

const PAGE_SIZE = 24;

export default function FreeDxfBrowse() {
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const categoryParam = params.get("category") || "";
  const searchParam = params.get("search") || "";

  const [files, setFiles] = useState<SharedFile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(searchParam);
  const [activeCategory, setActiveCategory] = useState(categoryParam);

  const loadFiles = useCallback(async (reset = true, cat?: string, q?: string) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const offset = reset ? 0 : files.length;
      const category = cat ?? activeCategory;
      const query = q ?? search;
      const sp = new URLSearchParams();
      if (category) sp.set("category", category);
      if (query.trim()) sp.set("search", query.trim());
      sp.set("limit", String(PAGE_SIZE));
      sp.set("offset", String(offset));

      const res = await fetch(`/api/freedxf/files?${sp.toString()}`).then(r => r.json());
      setFiles(prev => reset ? (res.files || []) : [...prev, ...(res.files || [])]);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeCategory, search, files.length]);

  // Load categories once
  useEffect(() => {
    fetch("/api/freedxf/categories").then(r => r.json()).then(res => setCategories(res.categories || [])).catch(console.error);
  }, []);

  // Load files when category changes
  useEffect(() => {
    loadFiles(true);
  }, [activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (search.trim()) sp.set("search", search.trim());
    if (activeCategory) sp.set("category", activeCategory);
    navigate(`/free/browse?${sp.toString()}`);
    loadFiles(true);
  };

  const handleCategoryClick = (cat: string) => {
    const newCat = cat === activeCategory ? "" : cat;
    setActiveCategory(newCat);
    const sp = new URLSearchParams();
    if (search.trim()) sp.set("search", search.trim());
    if (newCat) sp.set("category", newCat);
    navigate(`/free/browse?${sp.toString()}`);
  };

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("");
    navigate("/free/browse");
    loadFiles(true, "", "");
  };

  const hasMore = files.length < total;
  const hasFilters = !!activeCategory || !!search.trim();

  const getTitle = (file: SharedFile) =>
    (language === "he" && file.titleHe) ? file.titleHe : (file.title || "Untitled");

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/free" className="text-gray-400 hover:text-purple-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("freeBrowseTitle" as any)}
            </h1>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("freeSearchPlaceholder" as any)}
                className="w-full ps-10 pe-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 transition-opacity"
            >
              {t("freeSearch" as any)}
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleCategoryClick("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !activeCategory
                ? "bg-purple-600 text-white"
                : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-purple-50 hover:text-purple-600"
            }`}
          >
            {t("freeCatAll" as any)}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => handleCategoryClick(cat.name)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat.name
                  ? "bg-purple-600 text-white"
                  : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-purple-50 hover:text-purple-600"
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* Active filters & count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-400">
            {t("freeShowing" as any)} {files.length} {t("freeOf" as any)} {total} {t("freeFiles" as any)}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-600 transition-colors"
            >
              <X className="w-3 h-3" />
              {t("freeClearFilters" as any)}
            </button>
          )}
        </div>

        {/* Files grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-xl animate-pulse aspect-square" />
            ))}
          </div>
        ) : files.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
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
                            {file.lineCount.toLocaleString()}
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

            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => loadFiles(false)}
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-xl text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? "..." : t("freeLoadMore" as any)}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <Layers className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {t("freeNoResults" as any)}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {t("freeNoResultsDesc" as any)}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                {t("freeClearAll" as any)}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
