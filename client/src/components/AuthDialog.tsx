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

// Google Sign-In Button — uses renderButton (iframe) for cross-browser/mobile compatibility
// The iframe is rendered inside a centered wrapper. We use CSS to stretch it to full width.
function GoogleSignInButton({ onSuccess, onError, disabled }: {
  onSuccess: (credential: string) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
}) {
  const btnRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    // Load GSI script dynamically (not in <head>) to avoid render-blocking
    const loadGSI = () => {
      if (document.querySelector('script[src*="accounts.google.com/gsi"]')) return; // already loading
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    };
    loadGSI();

    const init = () => {
      const gsi = getGoogleGSI();
      if (!gsi || !btnRef.current) return;

      // Measure container width for the iframe
      const width = containerRef.current?.offsetWidth ?? 360;

      gsi.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            onSuccess(response.credential);
          } else {
            onError("התחברות דרך Google נכשלה");
          }
        },
      } as Parameters<GoogleGSI["accounts"]["id"]["initialize"]>[0]);

      gsi.accounts.id.renderButton(btnRef.current, {
        type: "standard",
        shape: "rectangular",
        theme: "outline",
        text: "continue_with",
        size: "large",
        width: String(Math.min(width, 400)),
        locale: "he",
      });
      setLoaded(true);
    };

    if (getGoogleGSI()) {
      // Small delay so container has rendered and has a width
      setTimeout(init, 50);
    } else {
      const interval = setInterval(() => {
        if (getGoogleGSI()) {
          clearInterval(interval);
          setTimeout(init, 50);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full transition-opacity ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      {/* overflow-hidden clips the iframe to our container width */}
      <div className="w-full overflow-hidden rounded-md">
        <div ref={btnRef} className="w-full" />
      </div>
      {!loaded && (
        <div className="w-full h-11 rounded-md border border-gray-200 bg-white flex items-center justify-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>טוען...</span>
        </div>
      )}
    </div>
  );
}

export function AuthDialog({ open, onOpenChange, limitReached, authReason, initialMode, onSuccess }: AuthDialogProps) {
  const { t, isRtl, language } = useLanguage();
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
        body: JSON.stringify({ email, origin: window.location.origin, language }),
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
