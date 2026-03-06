import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bell, Save, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function AdminAnnouncement() {
  const [pin, setPin] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [text, setText] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [pinError, setPinError] = useState("");

  const { data, isLoading } = trpc.announcement.get.useQuery();

  // Populate form when data loads
  useEffect(() => {
    if (data) {
      setText(data.text);
      setEnabled(data.enabled);
    }
  }, [data]);

  const setMutation = trpc.announcement.set.useMutation({
    onSuccess: () => {
      toast.success("הבנר עודכן בהצלחה!");
    },
    onError: (e) => {
      toast.error(e.message || "שגיאה בשמירה");
    },
  });

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setPinError("הכנס PIN תקין");
      return;
    }
    // Try to verify by making a test mutation
    setPinVerified(true);
    setPinError("");
  };

  const handleSave = () => {
    setMutation.mutate({ text, enabled, adminPin: pin });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowRight className="w-4 h-4" />
              חזרה לאתר
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ניהול בנר עדכונים</h1>
              <p className="text-sm text-gray-500">עדכן את הטקסט שמופיע מעל הקרוסל</p>
            </div>
          </div>

          {!pinVerified ? (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PIN ניהול</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="הכנס PIN"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  maxLength={10}
                  autoFocus
                />
                {pinError && <p className="text-red-500 text-sm mt-1">{pinError}</p>}
              </div>
              <Button type="submit" className="w-full" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                כניסה
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Preview */}
              {text && enabled && (
                <div
                  className="rounded-xl px-4 py-3 text-sm font-medium text-center"
                  style={{ background: "linear-gradient(135deg, #ede9fe, #ddd6fe)", color: "#4c1d95" }}
                >
                  <span className="mr-2">✨</span>
                  {text}
                </div>
              )}

              {/* Text editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  טקסט הבנר
                  <span className="text-gray-400 font-normal mr-2">({text.length}/500 תווים)</span>
                </label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="לדוגמה: 🎉 פיצ'ר חדש! עכשיו ניתן לייצא ל-SVG ישירות מהאתר"
                  rows={3}
                  maxLength={500}
                  className="resize-none"
                />
              </div>

              {/* Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-700">הצג בנר</p>
                  <p className="text-xs text-gray-500">כבה כדי להסתיר את הבנר מהמשתמשים</p>
                </div>
                <button
                  onClick={() => setEnabled(!enabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${enabled ? "bg-indigo-500" : "bg-gray-300"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-0.5"}`}
                  />
                </button>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSave}
                disabled={setMutation.isPending}
                className="w-full gap-2"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
              >
                {setMutation.isPending ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                שמור עדכונים
              </Button>

              {/* Tips */}
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">💡 טיפים לטקסט טוב:</p>
                <p>• השתמש באמוג'י לתשומת לב: 🎉 ✨ 🚀 🔥</p>
                <p>• ציין תאריך: "מרץ 2026 — פיצ'ר חדש!"</p>
                <p>• שמור קצר ומעניין (עד 100 תווים)</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
