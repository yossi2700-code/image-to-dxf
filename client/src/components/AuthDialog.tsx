import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, Sparkles } from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If true, show a "limit reached" message above the form */
  limitReached?: boolean;
  onSuccess: (user: { id: number; email: string; name: string | null }) => void;
}

type Mode = "login" | "register";

export function AuthDialog({ open, onOpenChange, limitReached, onSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    try {
      const endpoint = mode === "register" ? "/api/app-auth/register" : "/api/app-auth/login";
      const body = mode === "register" ? { name, email, password } : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "שגיאה");
        setLoading(false);
        return;
      }

      toast.success(mode === "register" ? "נרשמת בהצלחה! 🎉" : "ברוך הבא! 👋");
      reset();
      onOpenChange(false);
      onSuccess(data.user);
    } catch {
      toast.error("שגיאת רשת. נסה שוב.");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          {limitReached ? (
            <>
              <div className="flex items-center justify-center mb-3">
                <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-orange-500" />
                </div>
              </div>
              <DialogTitle className="text-center text-xl">הגעת למגבלת ההמרות היומית</DialogTitle>
              <DialogDescription className="text-center">
                הירשם בחינם וקבל <strong>5 המרות ביום</strong> במקום 3!
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="text-center text-xl">
                {mode === "register" ? "הרשמה חינמית" : "כניסה לחשבון"}
              </DialogTitle>
              <DialogDescription className="text-center">
                {mode === "register"
                  ? "צור חשבון וקבל 5 המרות ביום"
                  : "כנס לחשבון שלך"}
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מעבד...</>
            ) : mode === "register" ? (
              "הרשם חינם"
            ) : (
              "כניסה"
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground mt-2">
          {mode === "register" ? (
            <>
              כבר יש לך חשבון?{" "}
              <button
                type="button"
                className="text-primary underline hover:no-underline"
                onClick={() => { setMode("login"); reset(); }}
              >
                כנס כאן
              </button>
            </>
          ) : (
            <>
              אין לך חשבון?{" "}
              <button
                type="button"
                className="text-primary underline hover:no-underline"
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
