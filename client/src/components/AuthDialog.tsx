import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, Sparkles, Zap, Gift, AlertCircle } from "lucide-react";

/** Why the dialog was opened — controls the header message shown to the user */
export type AuthReason = "unregistered" | "limit" | "generic";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** @deprecated Use authReason instead */
  limitReached?: boolean;
  /** Reason for opening — determines the header copy */
  authReason?: AuthReason;
  onSuccess: (user: { id: number; email: string; name: string | null }) => void;
}

type Mode = "login" | "register" | "forgot";

function ReasonHeader({ reason }: { reason: AuthReason }) {
  if (reason === "unregistered") {
    return (
      <>
        <div className="flex items-center justify-center mb-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', border: '1px solid #c7d2fe' }}>
            <Gift className="w-8 h-8 text-indigo-500" />
          </div>
        </div>
        <DialogTitle className="text-center text-xl font-bold text-gray-800">
          הרשמה חינמית — 30 שניות בלבד
        </DialogTitle>
        <DialogDescription className="text-center text-sm mt-1">
          כדי להשתמש ב-AI יש צורך בחשבון חינמי.
        </DialogDescription>
        {/* Benefits list */}
        <div className="mt-3 space-y-2">
          {[
            { icon: "✨", text: "AI Outline — המר תמונה לקווי חריטה" },
            { icon: "🎨", text: "AI יצירה — צור עיצוב מטקסט" },
            { icon: "📄", text: "AI סקיצה — חלץ ציורים ממסמכים" },
            { icon: "💾", text: "הורדת DXF / PDF / Vector" },
          ].map(({ icon, text }, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-base shrink-0">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (reason === "limit") {
    return (
      <>
        <div className="flex items-center justify-center mb-3">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
            <Zap className="w-7 h-7 text-orange-500" />
          </div>
        </div>
        <DialogTitle className="text-center text-xl">הגעת למגבלת האסימונים</DialogTitle>
        <DialogDescription className="text-center">
          הירשם בחינם וקבל <strong>אסימונים נוספים</strong> לשימוש ב-AI!
        </DialogDescription>
      </>
    );
  }

  // generic
  return (
    <>
      <DialogTitle className="text-center text-xl">
        הרשמה / כניסה
      </DialogTitle>
      <DialogDescription className="text-center">
        צור חשבון חינמי או כנס לחשבון קיים
      </DialogDescription>
    </>
  );
}

export function AuthDialog({ open, onOpenChange, limitReached, authReason, onSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    try { return localStorage.getItem("auth_remember_me") !== "false"; } catch { return true; }
  });
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  // Resolve effective reason (support legacy limitReached prop)
  const reason: AuthReason = authReason ?? (limitReached ? "limit" : "generic");

  // Always reset to register mode when dialog opens
  useEffect(() => {
    if (open) {
      setMode("register");
      setName("");
      setEmail("");
      setPassword("");
      setInlineError(null);
      setForgotSent(false);
    }
  }, [open]);

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setLoading(false);
    setInlineError(null);
    setForgotSent(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setInlineError(null);
    try {
      const res = await fetch("/api/app-auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, origin: window.location.origin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInlineError(data.error ?? "שגיאה. נסה שוב.");
      } else {
        setForgotSent(true);
      }
    } catch {
      setInlineError("שגיאת רשת. נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") return handleForgot(e);
    if (!email || !password) return;
    setLoading(true);

    try {
      const endpoint = mode === "register" ? "/api/app-auth/register" : "/api/app-auth/login";
      const body = mode === "register" ? { name, email, password } : { email, password, rememberMe };
      try { localStorage.setItem("auth_remember_me", String(rememberMe)); } catch { /* ignore */ }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setInlineError(data.error ?? "שגיאה. נסה שוב.");
        setLoading(false);
        return;
      }

      toast.success(mode === "register" ? "נרשמת בהצלחה! 🎉" : "ברוך הבא! 👋");
      reset();
      onOpenChange(false);
      onSuccess(data.user);
    } catch {
      setInlineError("שגיאת רשת. נסה שוב.");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          {/* Show reason-specific header only when NOT in login mode */}
          {mode === "register" ? (
            <ReasonHeader reason={reason} />
          ) : mode === "forgot" ? (
            <>
              <DialogTitle className="text-center text-xl">שכחתי סיסמא</DialogTitle>
              <DialogDescription className="text-center">הכנס את האימייל שלך ונשלח לך קישור לאיפוס סיסמא</DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="text-center text-xl">כניסה לחשבון</DialogTitle>
              <DialogDescription className="text-center">כנס לחשבון שלך</DialogDescription>
            </>
          )}
        </DialogHeader>

        {inlineError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 mt-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{inlineError}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {forgotSent ? (
            <div className="text-center py-4 space-y-2">
              <div className="text-4xl">📧</div>
              <p className="font-semibold text-gray-800">מייל נשלח!</p>
              <p className="text-sm text-muted-foreground">בדוק את התיבת הדואר שלך ולחץ על הקישור לאיפוס סיסמא.</p>
              <button type="button" className="text-primary underline text-sm" onClick={() => { setMode("login"); reset(); }}>חזור לכניסה</button>
            </div>
          ) : (
            <>
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">שם (אופציונלי)</Label>
              <div className="relative">
                <User className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="השם שלך"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pr-9"
                  dir="rtl"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">אימייל</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pr-9"
                dir="ltr"
              />
            </div>
          </div>

          {mode !== "forgot" && (
          <div className="space-y-1.5">
            <Label htmlFor="password">סיסמה</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder={mode === "register" ? "לפחות 6 תווים" : "הסיסמה שלך"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 6 : 1}
                className="pr-9"
                dir="ltr"
              />
            </div>
          </div>
          )}

          {mode === "login" && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(v) => setRememberMe(v === true)}
                />
                <label
                  htmlFor="rememberMe"
                  className="text-sm text-muted-foreground cursor-pointer select-none"
                >
                  זכור אותי
                </label>
              </div>
              <button type="button" className="text-xs text-muted-foreground underline hover:text-primary" onClick={() => { setMode("forgot"); reset(); }}>שכחתי סיסמא</button>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 text-base font-bold"
            style={mode === "register" ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none' } : {}}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מעבד...</>
            ) : mode === "register" ? (
              <><Sparkles className="w-4 h-4 ml-1.5" />הרשם חינם עכשיו</>
            ) : mode === "forgot" ? (
              "שלח קישור לאיפוס"
            ) : (
              "כניסה"
            )}
          </Button>
          </>)}
        </form>

        <div className="text-center text-sm text-muted-foreground mt-2">
          {mode === "register" ? (
            <>
              כבר יש לך חשבון?{" "}
              <button
                type="button"
                className="text-primary underline hover:no-underline font-medium"
                onClick={() => { setMode("login"); reset(); }}
              >
                כנס כאן
              </button>
            </>
          ) : mode === "forgot" ? (
            <>
              זכרת את הסיסמא?{" "}
              <button
                type="button"
                className="text-primary underline hover:no-underline font-medium"
                onClick={() => { setMode("login"); reset(); }}
              >
                חזור לכניסה
              </button>
            </>
          ) : (
            <>
              אין לך חשבון?{" "}
              <button
                type="button"
                className="text-primary underline hover:no-underline font-medium"
                onClick={() => { setMode("register"); reset(); }}
              >
                הרשם חינם
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
