import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import {
  User,
  Lock,
  CreditCard,
  Coins,
  HeadphonesIcon,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Mail,
  Loader2,
  LogOut,
  ShoppingBag,
  Crown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface AppUser {
  id: number;
  email: string;
  name: string | null;
}

interface TokenTx {
  id: number;
  amount: number;
  reason: string;
  description: string | null;
  balanceAfter: number;
  createdAt: string | Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function reasonLabel(reason: string, isRtl: boolean): string {
  const map: Record<string, [string, string]> = {
    signup_bonus: ["בונוס הרשמה", "Signup bonus"],
    ai_trace: ["AI Outline", "AI Outline"],
    ai_generate: ["AI יצירה", "AI Create"],
    ai_refine: ["תיקון AI", "AI Refine"],
    convert: ["המרה", "Convert"],
    admin_add: ["הוספה ידנית", "Manual add"],
    face_detect: ["פורטרט", "Portrait"],
    ai_sketch: ["AI סקיצה", "AI Sketch"],
  };
  const pair = map[reason];
  if (!pair) return reason;
  return isRtl ? pair[0] : pair[1];
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-5 mb-4"
      style={{ background: "#ffffff", border: "1px solid #e8eaf0", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: color }}
        >
          <Icon className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Account() {
  const { isRtl } = useLanguage();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Token history collapse
  const [txExpanded, setTxExpanded] = useState(false);

  // Change password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Update profile
  const [displayName, setDisplayName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Token data
  const { data: tokenData } = trpc.tokens.balance.useQuery();
  const { data: txHistory } = trpc.tokens.history.useQuery();

  // Purchase history
  const { data: purchaseHistory } = trpc.purchases.list.useQuery();
  const [purchasesExpanded, setPurchasesExpanded] = useState(false);

  // Load user on mount
  useEffect(() => {
    fetch("/api/app-auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user ?? null);
        if (d.user?.name) setDisplayName(d.user.name);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/app-auth/logout", { method: "POST", credentials: "include" });
    localStorage.removeItem("app_user_logged_in");
    window.location.href = "/";
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error(isRtl ? "הסיסמאות החדשות אינן תואמות" : "New passwords do not match");
      return;
    }
    if (newPw.length < 6) {
      toast.error(isRtl ? "הסיסמה חייבת להכיל לפחות 6 תווים" : "Password must be at least 6 characters");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/app-auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      toast.success(isRtl ? "הסיסמה שונתה בהצלחה!" : "Password changed successfully!");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setPwLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error(isRtl ? "השם לא יכול להיות ריק" : "Name cannot be empty");
      return;
    }
    setProfileLoading(true);
    try {
      const res = await fetch("/api/app-auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      toast.success(isRtl ? "הפרטים עודכנו בהצלחה!" : "Profile updated successfully!");
      setUser((u) => u ? { ...u, name: displayName.trim() } : u);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setProfileLoading(false);
    }
  };

  // Not logged in
  if (!loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8f9fb" }} dir={isRtl ? "rtl" : "ltr"}>
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{isRtl ? "נדרשת התחברות" : "Login required"}</h1>
          <p className="text-gray-500 text-sm mb-5">{isRtl ? "יש להתחבר כדי לגשת לאזור האישי" : "Please log in to access your account"}</p>
          <Link href="/">
            <button className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              {isRtl ? "חזרה לדף הבית" : "Back to Home"}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const visibleTx = txExpanded ? (txHistory ?? []) : (txHistory ?? []).slice(0, 3);

  return (
    <div className="min-h-screen" style={{ background: "#f8f9fb" }} dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20"
        style={{ background: "#ffffff", borderBottom: "1px solid #e8eaf0", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
      >
        <div className="container py-3 flex items-center gap-3">
          {/* Back */}
          <Link href="/">
            <button className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">
              {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              {isRtl ? "חזרה" : "Back"}
            </button>
          </Link>
          <div className="flex-1" />
          {/* Title */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">{isRtl ? "האזור האישי" : "My Account"}</span>
          </div>
          <div className="flex-1" />
          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isRtl ? "התנתק" : "Logout"}</span>
          </button>
        </div>
      </header>

      <main className="py-6" style={{ maxWidth: "640px", margin: "0 auto", padding: "24px 16px" }}>
        {/* ── Welcome ── */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        ) : (
          <>
            {/* User greeting */}
            <div className="mb-5 rounded-2xl p-4 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white" }}>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate">{user?.name || user?.email}</p>
                <p className="text-white/70 text-xs truncate">{user?.email}</p>
              </div>
              {tokenData && (
                <div className="text-center shrink-0">
                  <p className="text-2xl font-black">{tokenData.balance}</p>
                  <p className="text-white/70 text-xs">{isRtl ? "אסימונים" : "tokens"}</p>
                </div>
              )}
            </div>

            {/* ── 1. Update Profile ── */}
            <SectionCard icon={User} title={isRtl ? "עדכון פרטים" : "Update Profile"} color="linear-gradient(135deg, #6366f1, #8b5cf6)">
              <form onSubmit={handleUpdateProfile} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{isRtl ? "שם תצוגה" : "Display name"}</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={isRtl ? "השם שלך" : "Your name"}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{isRtl ? "אימייל" : "Email"}</label>
                  <input
                    type="email"
                    value={user?.email ?? ""}
                    disabled
                    className="w-full border border-gray-100 rounded-xl px-3 py-2.5 text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">{isRtl ? "לא ניתן לשנות אימייל כרגע" : "Email cannot be changed at this time"}</p>
                </div>
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}
                >
                  {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isRtl ? "שמור שינויים" : "Save changes"}
                </button>
              </form>
            </SectionCard>

            {/* ── 2. Change Password ── */}
            <SectionCard icon={Lock} title={isRtl ? "החלפת סיסמה" : "Change Password"} color="linear-gradient(135deg, #0d9488, #06b6d4)">
              <form onSubmit={handleChangePassword} className="space-y-3">
                {/* Current password */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{isRtl ? "סיסמה נוכחית" : "Current password"}</label>
                  <div className="relative">
                    <input
                      type={showCurrent ? "text" : "password"}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-gray-50 pr-10"
                      style={{ paddingInlineEnd: "2.5rem" }}
                    />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute inset-y-0 end-3 flex items-center text-gray-400 hover:text-gray-600">
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {/* New password */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{isRtl ? "סיסמה חדשה" : "New password"}</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-gray-50"
                      style={{ paddingInlineEnd: "2.5rem" }}
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute inset-y-0 end-3 flex items-center text-gray-400 hover:text-gray-600">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {/* Confirm */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{isRtl ? "אישור סיסמה חדשה" : "Confirm new password"}</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-gray-50"
                    />
                    {confirmPw && (
                      <span className="absolute inset-y-0 end-3 flex items-center">
                        {confirmPw === newPw
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <AlertCircle className="w-4 h-4 text-red-400" />}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #0d9488, #06b6d4)", boxShadow: "0 2px 8px rgba(13,148,136,0.3)" }}
                >
                  {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {isRtl ? "שנה סיסמה" : "Change password"}
                </button>
              </form>
            </SectionCard>

            {/* ── 3. Tokens & Payment ── */}
            <SectionCard icon={Coins} title={isRtl ? "אסימונים ותשלום" : "Tokens & Payment"} color="linear-gradient(135deg, #d97706, #f59e0b)">
              {/* Balance */}
              <div className="flex items-center justify-between p-3 rounded-xl mb-3" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                <div>
                  <p className="text-xs text-amber-600 font-medium">{isRtl ? "יתרת אסימונים" : "Token balance"}</p>
                  <p className="text-2xl font-black text-amber-700">{tokenData?.balance ?? 0}</p>
                </div>
                <Coins className="w-8 h-8 text-amber-400" />
              </div>

              {/* Payment methods placeholder */}
              <div className="p-3 rounded-xl mb-3" style={{ background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-medium text-gray-500">{isRtl ? "אמצעי תשלום" : "Payment methods"}</p>
                </div>
                <p className="text-xs text-gray-400">{isRtl ? "אפשרות זו תהיה זמינה בקרוב" : "This option will be available soon"}</p>
              </div>

              {/* Token history collapsible */}
              <div>
                <button
                  onClick={() => setTxExpanded(!txExpanded)}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  style={{ border: "1px solid #e8eaf0" }}
                >
                  <span>{isRtl ? `היסטוריית אסימונים (${(txHistory ?? []).length})` : `Token history (${(txHistory ?? []).length})`}</span>
                  {txExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {(txHistory ?? []).length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {visibleTx.map((tx: TokenTx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs"
                        style={{ background: tx.amount > 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${tx.amount > 0 ? "#bbf7d0" : "#fecaca"}` }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 truncate">{reasonLabel(tx.reason, isRtl)}</p>
                          {tx.description && <p className="text-gray-400 truncate">{tx.description}</p>}
                        </div>
                        <div className="text-end shrink-0 ms-2">
                          <p className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                          </p>
                          <p className="text-gray-400">{isRtl ? "יתרה" : "bal"}: {tx.balanceAfter}</p>
                        </div>
                      </div>
                    ))}
                    {!txExpanded && (txHistory ?? []).length > 3 && (
                      <button
                        onClick={() => setTxExpanded(true)}
                        className="w-full text-center text-xs text-indigo-500 hover:text-indigo-700 py-1 font-medium"
                      >
                        {isRtl ? `הצג עוד ${(txHistory ?? []).length - 3} רשומות ▼` : `Show ${(txHistory ?? []).length - 3} more ▼`}
                      </button>
                    )}
                  </div>
                )}
                {(txHistory ?? []).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">{isRtl ? "אין עדיין היסטוריית אסימונים" : "No token history yet"}</p>
                )}
              </div>
            </SectionCard>

            {/* ── 3b. Purchase History ── */}
            <SectionCard icon={ShoppingBag} title={isRtl ? "היסטוריית רכישות" : "Purchase History"} color="linear-gradient(135deg, #0d9488, #06b6d4)">
              {!purchaseHistory || purchaseHistory.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400">{isRtl ? "אין עדיין רכישות" : "No purchases yet"}</p>
                  <Link href="/buy">
                    <button className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #0d9488, #06b6d4)" }}>
                      {isRtl ? "רכוש אסימונים" : "Purchase Tokens"}
                    </button>
                  </Link>
                </div>
              ) : (
                <div>
                  <div className="space-y-2">
                    {(purchasesExpanded ? purchaseHistory : purchaseHistory.slice(0, 3)).map((p) => {
                      const date = new Date(p.completedAt ?? p.createdAt).toLocaleDateString(
                        isRtl ? "he-IL" : "en-US",
                        { year: "numeric", month: "short", day: "numeric" }
                      );
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs"
                          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                              <Coins className="w-3.5 h-3.5 text-teal-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-700">+{p.tokenAmount} {isRtl ? "אסימונים" : "tokens"}</p>
                              <p className="text-gray-400">{date}</p>
                            </div>
                          </div>
                          <div className="text-end shrink-0">
                            <p className="font-bold text-teal-700">{p.priceAmount} {p.currency}</p>
                            <p className="text-gray-400 font-mono" style={{ fontSize: "10px" }}>{p.paypalOrderId.slice(0, 12)}…</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {purchaseHistory.length > 3 && (
                    <button
                      onClick={() => setPurchasesExpanded(!purchasesExpanded)}
                      className="w-full mt-2 text-center text-xs text-teal-600 hover:text-teal-800 py-1 font-medium"
                    >
                      {purchasesExpanded
                        ? (isRtl ? "הצג פחות ▲" : "Show less ▲")
                        : (isRtl ? `הצג עוד ${purchaseHistory.length - 3} ▼` : `Show ${purchaseHistory.length - 3} more ▼`)}
                    </button>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                    <Link href="/buy">
                      <button className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #0d9488, #06b6d4)" }}>
                        {isRtl ? "רכוש אסימונים נוספים" : "Purchase More Tokens"}
                      </button>
                    </Link>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* ── 4. Subscription ── */}
            <SectionCard icon={Crown} title={isRtl ? "המנוי שלי" : "My Subscription"} color="linear-gradient(135deg, #7c3aed, #a855f7)">
              <div className="p-4 rounded-xl text-center" style={{ background: "linear-gradient(135deg, #faf5ff, #f3e8ff)", border: "1px solid #e9d5ff" }}>
                <Crown className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <p className="font-bold text-purple-700 text-sm mb-1">{isRtl ? "תוכנית פרימיום — בקרוב" : "Premium Plan — Coming Soon"}</p>
                <p className="text-xs text-purple-500">{isRtl ? "מנויים יקבלו אסימונים חודשיים, עיבוד מהיר יותר ותמיכה מועדפת" : "Subscribers will get monthly tokens, faster processing, and priority support"}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                  <span>🔔</span>
                  {isRtl ? "עדכן אותי כשיהיה זמין" : "Notify me when available"}
                </div>
              </div>
            </SectionCard>
            {/* ── 5. Support ── */}
            <SectionCard icon={HeadphonesIcon} title={isRtl ? "פנייה לתמיכה" : "Contact Support"} color="linear-gradient(135deg, #374151, #6b7280)">
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  {isRtl
                    ? "נתקלת בבעיה? שלח לנו מייל ונחזור אליך בהקדם."
                    : "Having an issue? Send us an email and we'll get back to you shortly."}
                </p>
                <a
                  href="mailto:support@dxfai.net"
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #374151, #6b7280)", boxShadow: "0 2px 8px rgba(55,65,81,0.25)", display: "inline-flex" }}
                >
                  <Mail className="w-4 h-4" />
                  support@dxfai.net
                </a>
                <p className="text-xs text-gray-400">
                  {isRtl ? "זמן מענה ממוצע: עד 24 שעות" : "Average response time: up to 24 hours"}
                </p>
              </div>
            </SectionCard>
          </>
        )}
      </main>
    </div>
  );
}
