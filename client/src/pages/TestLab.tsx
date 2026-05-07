/**
 * TestLab — Admin-only model comparison page
 * Accessible at /test-lab — requires admin cookie
 * Lets you upload an image, pick a model, and compare results side-by-side
 */
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash2, Clock, Zap, FlaskConical, Loader2 } from "lucide-react";

const MODELS = [
  { id: "forge",                   label: "Forge (מנוס)",         tag: "fallback",   color: "bg-blue-100 text-blue-800",   note: "image+prompt editing" },
  { id: "dall-e-2",                label: "DALL-E 2",             tag: "openai",     color: "bg-gray-100 text-gray-700",   note: "image+prompt editing" },
  { id: "gpt-image-1-mini",        label: "gpt-image-1-mini",     tag: "openai",     color: "bg-green-100 text-green-800", note: "text-to-image" },
  { id: "gpt-image-1",             label: "gpt-image-1",          tag: "openai",     color: "bg-green-100 text-green-800", note: "text-to-image" },
  { id: "gpt-image-1.5",           label: "gpt-image-1.5",        tag: "openai",     color: "bg-green-100 text-green-800", note: "text-to-image" },
  { id: "gpt-image-2",             label: "gpt-image-2",          tag: "current",    color: "bg-purple-100 text-purple-800", note: "text-to-image · active" },
  { id: "gpt-image-2-2026-04-21",  label: "gpt-image-2 (Apr 26)", tag: "openai",     color: "bg-purple-100 text-purple-800", note: "text-to-image" },
];

interface Result {
  model: string;
  imageUrl: string;
  durationMs: number;
  promptUsed: string;
  error?: string;
}

export default function TestLab() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [singleLine, setSingleLine] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(["forge"]);
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState<string[]>([]);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function toggleModel(id: string) {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function runTest() {
    if (!imageFile || selectedModels.length === 0) return;
    setRunning(selectedModels);

    // Run all selected models in parallel
    const promises = selectedModels.map(async (model) => {
      const form = new FormData();
      form.append("image", imageFile);
      form.append("model", model);
      form.append("description", description);
      form.append("singleLine", String(singleLine));

      const startMs = Date.now();
      try {
        const resp = await fetch("/api/test-lab", { method: "POST", body: form, credentials: "include" });
        const data = await resp.json();
        if (!resp.ok) {
          return { model, imageUrl: "", durationMs: Date.now() - startMs, promptUsed: "", error: data.message || "Unknown error" } as Result;
        }
        return { model, imageUrl: data.imageUrl, durationMs: data.durationMs, promptUsed: data.promptUsed } as Result;
      } catch (err) {
        return { model, imageUrl: "", durationMs: Date.now() - startMs, promptUsed: "", error: String(err) } as Result;
      }
    });

    const newResults = await Promise.all(promises);
    setResults((prev) => [...newResults, ...prev]);
    setRunning([]);
  }

  function clearResults() {
    setResults([]);
  }

  const isRunning = running.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <FlaskConical className="w-7 h-7 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Test Lab — Model Comparison</h1>
            <p className="text-sm text-gray-500">השווה בין מודלים שונים — Forge, DALL-E 2, gpt-image-1, gpt-image-2</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: controls */}
          <div className="space-y-4">
            {/* Image upload */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">תמונת קלט</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" className="max-h-48 mx-auto rounded object-contain" />
                  ) : (
                    <div className="py-6 text-gray-400">
                      <Upload className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">לחץ להעלאת תמונה</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {imageFile && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{imageFile.name}</p>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">תיאור (אופציונלי)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="תיאור האובייקט בתמונה..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">אפשרויות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Switch id="single-line" checked={singleLine} onCheckedChange={setSingleLine} />
                  <Label htmlFor="single-line" className="text-sm">Single-line mode</Label>
                </div>
              </CardContent>
            </Card>

            {/* Model selector */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">בחר מודלים להרצה</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {MODELS.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedModels.includes(m.id)
                        ? "border-purple-400 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => toggleModel(m.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(m.id)}
                      onChange={() => {}}
                      className="accent-purple-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.label}</p>
                      <p className="text-xs text-gray-400">{m.note}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.color}`}>
                      {m.tag}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Run button */}
            <Button
              className="w-full"
              disabled={!imageFile || selectedModels.length === 0 || isRunning}
              onClick={runTest}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  מריץ {running.length} מודל{running.length > 1 ? "ים" : ""}...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  הרץ השוואה ({selectedModels.length} מודל{selectedModels.length !== 1 ? "ים" : ""})
                </>
              )}
            </Button>

            {results.length > 0 && (
              <Button variant="outline" className="w-full" onClick={clearResults}>
                <Trash2 className="w-4 h-4 mr-2" />
                נקה תוצאות
              </Button>
            )}
          </div>

          {/* Right panel: results */}
          <div className="lg:col-span-2">
            {/* Running indicators */}
            {isRunning && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {running.map((model) => (
                  <Card key={model} className="border-purple-200">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                      <div>
                        <p className="text-sm font-medium">{MODELS.find((m) => m.id === model)?.label ?? model}</p>
                        <p className="text-xs text-gray-400">מעבד...</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Results grid */}
            {results.length === 0 && !isRunning && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <FlaskConical className="w-12 h-12 mb-3 opacity-30" />
                <p>העלה תמונה, בחר מודלים ולחץ הרץ</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((result, i) => {
                const modelInfo = MODELS.find((m) => m.id === result.model);
                return (
                  <Card key={`${result.model}-${i}`} className={result.error ? "border-red-200" : "border-gray-200"}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">
                          {modelInfo?.label ?? result.model}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {(result.durationMs / 1000).toFixed(1)}s
                          </Badge>
                          {modelInfo && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${modelInfo.color}`}>
                              {modelInfo.tag}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      {result.error ? (
                        <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 break-words">
                          <strong>שגיאה:</strong> {result.error}
                        </div>
                      ) : (
                        <img
                          src={result.imageUrl}
                          alt={`result-${result.model}`}
                          className="w-full rounded border border-gray-100 object-contain bg-white"
                          style={{ maxHeight: 320 }}
                        />
                      )}
                      {result.promptUsed && (
                        <div className="mt-2">
                          <button
                            className="text-xs text-gray-400 hover:text-gray-600 underline"
                            onClick={() => setExpandedPrompt(expandedPrompt === `${result.model}-${i}` ? null : `${result.model}-${i}`)}
                          >
                            {expandedPrompt === `${result.model}-${i}` ? "הסתר פרומפט" : "הצג פרומפט"}
                          </button>
                          {expandedPrompt === `${result.model}-${i}` && (
                            <pre className="mt-1 text-xs bg-gray-50 border rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                              {result.promptUsed}
                            </pre>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
