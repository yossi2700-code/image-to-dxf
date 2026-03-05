import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Lock, Loader2 } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("הסיסמה חייבת להכיל לפחות 6 תווים"); return; }
    if (password !== confirm) { setError("הסיסמאות אינן תואמות"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/app-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה. ייתכן שהקישור פג תוקף.");
      } else {
        setDone(true);
      }
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-gray-800">קישור לא תקין</h1>
          <p className="text-sm text-muted-foreground">הקישור לאיפוס סיסמא אינו תקין.</p>
          <Button variant="outline" onClick={() => setLocation("/")}>חזור לדף הבית</Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h1 className="text-xl font-bold text-gray-800">הסיסמה עודכנה!</h1>
          <p className="text-sm text-muted-foreground">כעת תוכל להתחבר עם הסיסמה החדשה.</p>
          <Button onClick={() => setLocation("/")}>חזור לדף הבית</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir="rtl">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7 text-indigo-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">איפוס סיסמא</h1>
          <p className="text-sm text-muted-foreground mt-1">הכנס סיסמא חדשה לחשבון שלך</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">סיסמה חדשה</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="לפחות 6 תווים"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pr-9"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">אימות סיסמה</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirm"
                type="password"
                placeholder="הכנס שוב את הסיסמה"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="pr-9"
                dir="ltr"
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-11 text-base font-bold" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מעדכן...</> : "עדכן סיסמא"}
          </Button>
        </form>
      </div>
    </div>
  );
}
