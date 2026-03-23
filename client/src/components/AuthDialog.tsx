import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663365044246/hnDFdLkzVGYJYdws9hbnLw/logo-dxfai-final_6d4eec74.png";

// Google GSI type accessor (avoids conflict with @types/google.maps)
type GoogleGSI = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: object) => void;
      prompt: () => void;
    };
  };
};
const getGoogleGSI = (): GoogleGSI | undefined => (window as unknown as { google?: GoogleGSI }).google;

/** Why the dialog was opened — controls the header message shown to the user */
export type AuthReason = "unregistered" | "limit" | "generic" | "campaign_bonus";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** @deprecated Use authReason instead */
  limitReached?: boolean;
  /** Reason for opening — determines the header copy */
  authReason?: AuthReason;
  /** Which mode to open in: 'login' or 'register'. Defaults to 'register'. */
  initialMode?: "login" | "register";
  onSuccess: (user: { id: number; email: string; name: string | null }, isNewRegistration?: boolean) => void;
}

type Mode = "login" | "register" | "forgot";

// Google Sign-In Button component — custom styled button that triggers Google One Tap
function GoogleSignInButton({ onSuccess, onError, disabled }: {
  onSuccess: (credential: string) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const init = () => {
      const gsi = getGoogleGSI();
      if (!gsi) return;
      gsi.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            setLoading(false);
            onSuccess(response.credential);
          } else {
            setLoading(false);
            onError("התחברות דרך Google נכשלה");
          }
        },
      } as Parameters<GoogleGSI["accounts"]["id"]["initialize"]>[0]);
      setGsiReady(true);
    };

    if (getGoogleGSI()) {
      init();
    } else {
      const interval = setInterval(() => {
        if (getGoogleGSI()) {
          clearInterval(interval);
          init();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  const handleClick = () => {
    const gsi = getGoogleGSI();
    if (!gsi) { onError("גוגל לא זמין, נסה שוב"); return; }
    setLoading(true);
    gsi.accounts.id.prompt();
    // If prompt closes without credential, reset loading after 30s
    setTimeout(() => setLoading(false), 30000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading || !gsiReady}
      className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
      ) : (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      )}
      <span>המשך עם Google</span>
    </button>
  );
}

export function AuthDialog({ open, onOpenChange, limitReached, authReason, initialMode, onSuccess }: AuthDialogProps) {
  const { t, isRtl } = useLanguage();
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    try { return localStorage.getItem("auth_remember_me") !== "false"; } catch { return true; }
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  // Resolve effective reason (support legacy limitReached prop)
  const reason: AuthReason = authReason ?? (limitReached ? "limit" : "generic");

  // Reset to initialMode (or register) when dialog opens
  useEffect(() => {
    if (open) {
      setMode(initialMode ?? "register");
      setName("");
      setEmail("");
      setPassword("");
      setTermsAccepted(false);
      setTermsError(false);
      setInlineError(null);
      setForgotSent(false);
    }
  }, [open]);

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setTermsAccepted(false);
    setTermsError(false);
    setLoading(false);
    setInlineError(null);
    setForgotSent(false);
  };

  const handleGoogleSuccess = async (credential: string) => {
    setLoading(true);
    setInlineError(null);
    try {
      const res = await fetch("/api/app-auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInlineError(data.error ?? t("authErrorGeneric"));
        setLoading(false);
        return;
      }
      reset();
      onOpenChange(false);
      onSuccess(data.user, data.isNewUser);
      if (!data.isNewUser) toast.success(t("authWelcomeBack"));
    } catch {
      setInlineError(t("authErrorNetwork"));
      setLoading(false);
    }
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
        credentials: "include",
        body: JSON.stringify({ email, origin: window.location.origin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInlineError(data.error ?? t("authErrorGeneric"));
      } else {
        setForgotSent(true);
      }
    } catch {
      setInlineError(t("authErrorNetwork"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") return handleForgot(e);
    if (!email || !password) return;

    if (mode === "register" && !name.trim()) {
      setInlineError("שם הוא שדה חובה. אנא הכנס את שמך.");
      setTimeout(() => document.getElementById("name")?.focus(), 50);
      return;
    }

    if (mode === "register" && !termsAccepted) {
      setTermsError(true);
      setInlineError(t("authTermsRequired"));
      document.getElementById("termsAccepted")?.closest(".terms-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === "register" ? "/api/app-auth/register" : "/api/app-auth/login";
      const campaignCode = new URLSearchParams(window.location.search).get("campaign") || undefined;
      const body = mode === "register"
        ? { name, email, password, termsAccepted: true, termsVersion: "2026-03-10", privacyVersion: "2026-03-10", campaignCode }
        : { email, password, rememberMe, campaignCode };
      try { localStorage.setItem("auth_remember_me", String(rememberMe)); } catch { /* ignore */ }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setInlineError(data.error ?? t("authErrorGeneric"));
        setLoading(false);
        return;
      }

      if (data.campaignBonusAwarded) {
        toast.success(`🎁 קיבלת ${data.campaignTokens} אסימונים בונוס! הם נוספו לחשבונך.`, { duration: 5000 });
      } else if (mode === "login") {
        toast.success(t("authWelcomeBack"));
      }
      reset();
      onOpenChange(false);
      onSuccess(data.user, mode === "register");
    } catch {
      setInlineError(t("authErrorNetwork"));
      setLoading(false);
    }
  };

  // Header copy based on mode and reason
  const getHeaderTitle = () => {
    if (mode === "login") return t("authLoginTitle");
    if (mode === "forgot") return t("authForgotTitle");
    if (reason === "limit") return t("authLimitTitle");
    if (reason === "campaign_bonus") return t("authCampaignTitle");
    return t("authUnregisteredTitle");
  };

  const getHeaderDesc = () => {
    if (mode === "login") return t("authLoginDesc");
    if (mode === "forgot") return t("authForgotDesc");
    if (reason === "limit") return t("authLimitDesc");
    if (reason === "campaign_bonus") return t("authCampaignDesc");
    return t("authUnregisteredDesc");
  };

  const showGoogleButton = mode !== "forgot" && !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Header with gradient */}
        <div
          className="px-6 pt-6 pb-5 text-center"
          style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)" }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img
              src={LOGO_URL}
              alt="dxfai"
              className="w-14 h-14 rounded-xl shadow-lg"
            />
          </div>
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-bold text-center">
              {getHeaderTitle()}
            </DialogTitle>
            <DialogDescription className="text-indigo-200 text-sm text-center mt-1">
              {getHeaderDesc()}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 bg-white">
          {inlineError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{inlineError}</span>
            </div>
          )}

          {forgotSent ? (
            <div className="text-center py-4 space-y-2">
              <div className="text-4xl">📧</div>
              <p className="font-semibold text-gray-800">{t("authEmailSent")}</p>
              <p className="text-sm text-muted-foreground">{t("authEmailSentDesc")}</p>
              <button type="button" className="text-primary underline text-sm" onClick={() => { setMode("login"); reset(); }}>{t("authBackToLogin")}</button>
            </div>
          ) : (
            <>
              {/* Google Sign-In */}
              {showGoogleButton && (
                <div className="mb-4">
                  <GoogleSignInButton
                    onSuccess={handleGoogleSuccess}
                    onError={(msg) => setInlineError(msg)}
                    disabled={loading}
                  />
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 shrink-0">או המשך עם אימייל</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "register" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                      {t("authNameLabel")} <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input
                        id="name"
                        type="text"
                        placeholder={t("authNamePlaceholder")}
                        value={name}
                        onChange={(e) => { setName(e.target.value); if (inlineError && e.target.value.trim()) setInlineError(null); }}
                        className={`pr-9 border-gray-200 focus:border-indigo-400 focus-visible:ring-indigo-300 ${inlineError && !name.trim() ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                        dir="rtl"
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">{t("authEmailLabel")}</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pr-9 border-gray-200 focus:border-indigo-400 focus-visible:ring-indigo-300"
                      dir="ltr"
                    />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">{t("authPasswordLabel")}</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder={mode === "register" ? t("authPasswordPlaceholderRegister") : t("authPasswordPlaceholderLogin")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={mode === "register" ? 6 : 1}
                        className="pr-9 border-gray-200 focus:border-indigo-400 focus-visible:ring-indigo-300"
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
                      <label htmlFor="rememberMe" className="text-sm text-gray-500 cursor-pointer select-none">
                        {t("authRememberMe")}
                      </label>
                    </div>
                    <button type="button" className="text-xs text-gray-400 underline hover:text-indigo-600" onClick={() => { setMode("forgot"); reset(); }}>
                      {t("authForgotPassword")}
                    </button>
                  </div>
                )}

                {mode === "register" && (
                  <div
                    className={`terms-box flex items-start gap-2.5 rounded-lg p-3 transition-all duration-200 ${
                      termsError
                        ? "bg-red-50 border-2 border-red-400 animate-pulse"
                        : "bg-gray-50 border border-gray-200"
                    }`}
                    dir={isRtl ? "rtl" : "ltr"}
                  >
                    <Checkbox
                      id="termsAccepted"
                      checked={termsAccepted}
                      onCheckedChange={(v) => {
                        setTermsAccepted(v === true);
                        if (v === true) { setTermsError(false); setInlineError(null); }
                      }}
                      className={`mt-0.5 shrink-0 ${termsError ? "border-red-500 data-[state=unchecked]:border-red-500" : ""}`}
                    />
                    <label
                      htmlFor="termsAccepted"
                      className={`text-sm cursor-pointer leading-relaxed select-none ${
                        termsError ? "text-red-700 font-medium" : "text-gray-600"
                      }`}
                    >
                      {t("authTermsCheckbox")}{" "}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline hover:text-indigo-800 mx-1" onClick={(e) => e.stopPropagation()}>
                        {t("authTermsLink")}
                      </a>
                      {" "}{t("authTermsAnd")}{" "}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline hover:text-indigo-800 mx-1" onClick={(e) => e.stopPropagation()}>
                        {t("authPrivacyLink")}
                      </a>
                      {" "}{t("authTermsSuffix")}
                    </label>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold rounded-lg"
                  style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", color: "white" }}
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 ml-2 animate-spin" />{t("authProcessing")}</>
                  ) : mode === "register" ? (
                    t("authRegisterFree")
                  ) : mode === "forgot" ? (
                    t("authSendReset")
                  ) : (
                    t("authLogin")
                  )}
                </Button>
              </form>

              <div className="text-center text-sm text-gray-500 mt-4">
                {mode === "register" ? (
                  <>
                    {t("authAlreadyHaveAccount")}{" "}
                    <button type="button" className="text-indigo-600 underline hover:no-underline font-medium" onClick={() => { setMode("login"); reset(); }}>
                      {t("authEnterHere")}
                    </button>
                  </>
                ) : mode === "forgot" ? (
                  <>
                    {t("authRememberedPassword")}{" "}
                    <button type="button" className="text-indigo-600 underline hover:no-underline font-medium" onClick={() => { setMode("login"); reset(); }}>
                      {t("authBackToLogin")}
                    </button>
                  </>
                ) : (
                  <>
                    {t("authNoAccount")}{" "}
                    <button type="button" className="text-indigo-600 underline hover:no-underline font-medium" onClick={() => { setMode("register"); reset(); }}>
                      {t("authRegisterFreeShort")}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
