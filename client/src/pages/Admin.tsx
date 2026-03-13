import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  Upload,
  Sparkles,
  TrendingUp,
  Calendar,
  Clock,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  Users,
  ChevronDown,
  ChevronUp,
  FileCode2,
  Coins,
  Plus,
  History,
  Ban,
  ShieldCheck,
  RefreshCw,
  Settings,
  User,
  KeyRound,
  CheckCircle2,
  Wrench,
  Mail,
  CreditCard,
  Gift,
  Bug,
  Crown,
  Newspaper,
  CircleDot,
  AlertCircle,
  CheckCircle,
  XCircle,
  Search,
  Pencil,
  Trash2,
  Star,
} from "lucide-react";

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const loginMutation = trpc.admin.login.useMutation({
    onSuccess: () => {
      toast.success("כניסה בוצעה בהצלחה");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message ?? "קוד גישה שגוי");
      setPin("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    loginMutation.mutate({ pin: pin.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="p-8">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">דשבורד ניהול</h2>
              <p className="text-sm text-muted-foreground">הכנס את קוד הגישה שלך</p>
            </div>
            <form onSubmit={handleSubmit} className="w-full space-y-3">
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  placeholder="קוד גישה"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="text-center text-lg tracking-widest pr-10"
                  autoFocus
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!pin.trim() || loginMutation.isPending}
              >
                {loginMutation.isPending ? "מתחבר..." : "כניסה"}
              </Button>
            </form>
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← חזור לאפליקציה
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/// ─── Activity Section ─────────────────────────────────────────────────────
type RecentEvent = {
  id: number;
  type: string;
  segmentCount: number | null;
  ipAnon: string | null;
  imageUrl: string | null;
  createdAt: Date;
  appUserId: number | null;
  userName: string | null;
  userEmail: string | null;
};

function ActivitySection({ recent, recentLoading }: { recent: RecentEvent[] | undefined; recentLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "convert" | "ai">("all");

  const filtered = (recent ?? []).filter((ev) => {
    const matchSearch = !search ||
      (ev.userName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (ev.userEmail ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" ||
      (typeFilter === "convert" && ev.type === "convert") ||
      (typeFilter === "ai" && ev.type !== "convert");
    return matchSearch && matchType;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              היסטוריית פעולות
            </CardTitle>
            <span className="text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">
              {filtered.length} פעולות
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="חפש לפי שם או מייל..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-[220px] h-8 text-sm"
            />
            <div className="flex gap-1">
              {(["all", "convert", "ai"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTypeFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    typeFilter === f
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f === "all" ? "הכל" : f === "convert" ? "המרה" : "AI"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {recentLoading ? (
          <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-500">
                  <th className="text-right py-2 px-3 font-medium">תמונה</th>
                  <th className="text-right py-2 px-3 font-medium">משתמש</th>
                  <th className="text-right py-2 px-3 font-medium">סוג</th>
                  <th className="text-right py-2 px-3 font-medium">קווים</th>
                  <th className="text-right py-2 px-3 font-medium">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ev) => (
                  <tr key={ev.id} className="border-b last:border-0 hover:bg-blue-50/40 transition-colors">
                    <td className="py-2 px-3">
                      {ev.imageUrl ? (
                        <img src={ev.imageUrl} alt="" className="w-10 h-10 object-cover rounded-lg border shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg border bg-slate-100 flex items-center justify-center">
                          <Upload className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {ev.userName || ev.userEmail ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{ev.userName || ev.userEmail?.split("@")[0]}</p>
                          {ev.userEmail && <p className="text-xs text-slate-400">{ev.userEmail}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">אורח</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        ev.type === "convert" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      }`}>
                        {ev.type === "convert" ? <><Upload className="w-3 h-3" />המרה</> : <><Sparkles className="w-3 h-3" />AI</>}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 font-mono text-sm">{(ev.segmentCount ?? 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{new Date(ev.createdAt).toLocaleString("he-IL")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{search ? `לא נמצאו תוצאות עבור "${search}"` : "אין פעולות עדיין"}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: daily, isLoading: dailyLoading } = trpc.admin.dailyActivity.useQuery();
  const { data: recent, isLoading: recentLoading } = trpc.admin.recentEvents.useQuery();
  const { data: registeredUsers, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.usersWithTokens.useQuery();
  const { data: userActionsData, isLoading: actionsLoading } = trpc.admin.userActions.useQuery();
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [editingLimit, setEditingLimit] = useState<number | null>(null);
  const [limitInput, setLimitInput] = useState("");
  const [addingTokensUser, setAddingTokensUser] = useState<number | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenHistoryUser, setTokenHistoryUser] = useState<number | null>(null);

  const setUserLimitMutation = trpc.admin.setUserLimit.useMutation({
    onSuccess: () => {
      toast.success("המגבלה עודכנה בהצלחה");
      setEditingLimit(null);
      refetchUsers();
    },
    onError: (err) => toast.error(err.message ?? "שגיאה בעדכון"),
  });

  const addTokensMutation = trpc.admin.addTokens.useMutation({
    onSuccess: (data) => {
      toast.success(`אסימונים נוספו! יתרה חדשה: ${data.balanceAfter}`);
      setAddingTokensUser(null);
      setTokenInput("");
      refetchUsers();
    },
    onError: (err) => toast.error(err.message ?? "שגיאה בהוספת אסימונים"),
  });

  const blockUserMutation = trpc.admin.blockUser.useMutation({
    onSuccess: () => { toast.success("המשתמש נחסם"); refetchUsers(); },
    onError: (err) => toast.error(err.message ?? "שגיאה בחסימה"),
  });

  const unblockUserMutation = trpc.admin.unblockUser.useMutation({
    onSuccess: () => { toast.success("החסימה הוסרה"); refetchUsers(); },
    onError: (err) => toast.error(err.message ?? "שגיאה בשחרור חסימה"),
  });

  const { data: maintenanceData, refetch: refetchMaintenance } = trpc.admin.getMaintenanceMode.useQuery();
  const setMaintenanceMutation = trpc.admin.setMaintenanceMode.useMutation({
    onSuccess: (data) => { toast.success(data.enabled ? "מצב תחזוקה הופעל" : "מצב תחזוקה כבה"); refetchMaintenance(); },
    onError: (err) => toast.error(err.message ?? "שגיאה"),
  });

  const sendPasswordResetMutation = trpc.admin.sendPasswordReset.useMutation({
    onSuccess: () => toast.success("מייל איפוס סיסמא נשלח"),
    onError: (err) => toast.error(err.message ?? "שגיאה בשליחת מייל"),
  });

  // Auto-refresh token balances every 30 seconds
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const interval = setInterval(() => { refetchUsers(); }, 30000);
    return () => clearInterval(interval);
  }, [refetchUsers]);

  const { data: tokenHistory, isLoading: tokenHistoryLoading } = trpc.admin.userTokenHistory.useQuery(
    { userId: tokenHistoryUser ?? 0 },
    { enabled: tokenHistoryUser !== null }
  );

  const logoutMutation = trpc.admin.logout.useMutation({
    onSuccess: () => {
      utils.admin.check.invalidate();
      onLogout();
    },
  });

  const chartData = (() => {
    if (!daily) return [];
    const map = new Map(daily.map((d) => [d.date, d]));
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = map.get(key);
      result.push({
        date: key.slice(5),
        "המרות": entry?.converts ?? 0,
        "יצירות AI": entry?.aiGenerations ?? 0,
      });
    }
    return result;
  })();

  const [activeSection, setActiveSection] = useState<"overview" | "activity" | "users" | "consents" | "payments" | "settings" | "email" | "campaign" | "bugs" | "subscriptions" | "news">("overview");

  // ── Enhanced users (with subscription info) ──
  const { data: enhancedUsers, isLoading: enhancedUsersLoading, refetch: refetchEnhanced } = trpc.admin.usersEnhanced.useQuery(
    undefined, { enabled: activeSection === "users" }
  );

  // ── Bug reports ──
  const [bugStatusFilter, setBugStatusFilter] = useState<"all" | "new" | "investigating" | "resolved" | "ignored">("all");
  const { data: bugData, isLoading: bugLoading, refetch: refetchBugs } = trpc.admin.getBugReports.useQuery(
    { status: bugStatusFilter === "all" ? undefined : bugStatusFilter },
    { enabled: activeSection === "bugs" }
  );
  const updateBugMutation = trpc.admin.updateBugStatus.useMutation({
    onSuccess: () => { toast.success("סטטוס עודכן"); refetchBugs(); },
    onError: (e) => toast.error(e.message),
  });

  // ── Subscription plans ──
  const { data: subPlans, isLoading: subPlansLoading, refetch: refetchSubPlans } = trpc.admin.getSubscriptionPlans.useQuery(
    undefined, { enabled: activeSection === "subscriptions" }
  );
  const { data: userSubs, isLoading: userSubsLoading, refetch: refetchUserSubs } = trpc.admin.getUserSubscriptions.useQuery(
    undefined, { enabled: activeSection === "subscriptions" }
  );
  const upsertPlanMutation = trpc.admin.upsertSubscriptionPlan.useMutation({
    onSuccess: () => { toast.success("תוכנית נשמרה"); refetchSubPlans(); setEditingPlan(null); },
    onError: (e) => toast.error(e.message),
  });
  const deletePlanMutation = trpc.admin.deleteSubscriptionPlan.useMutation({
    onSuccess: () => { toast.success("תוכנית נמחקה"); refetchSubPlans(); },
    onError: (e) => toast.error(e.message),
  });
  const assignSubMutation = trpc.admin.assignSubscription.useMutation({
    onSuccess: () => { toast.success("מנוי הוקצה בהצלחה"); refetchUserSubs(); setAssigningSubUser(null); },
    onError: (e) => toast.error(e.message),
  });
  const cancelSubMutation = trpc.admin.cancelSubscription.useMutation({
    onSuccess: () => { toast.success("מנוי בוטל"); refetchUserSubs(); },
    onError: (e) => toast.error(e.message),
  });
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ planId: "", name: "", dailyConversions: "10", priceILS: "", priceUSD: "", discountPercent: "0", badge: "" as "" | "recommended" | "best_value" | "sale", sortOrder: "0" });
  const [assigningSubUser, setAssigningSubUser] = useState<number | null>(null);
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assignMonths, setAssignMonths] = useState("1");

  // ── News items ──
  const { data: newsData, isLoading: newsLoading, refetch: refetchNews } = trpc.admin.getNewsItems.useQuery(
    undefined, { enabled: activeSection === "news" }
  );
  const upsertNewsMutation = trpc.admin.upsertNewsItem.useMutation({
    onSuccess: () => { toast.success("פריט נשמר"); refetchNews(); setEditingNews(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteNewsMutation = trpc.admin.deleteNewsItem.useMutation({
    onSuccess: () => { toast.success("פריט נמחק"); refetchNews(); },
    onError: (e) => toast.error(e.message),
  });
  const [editingNews, setEditingNews] = useState<number | null>(null);
  const [newsForm, setNewsForm] = useState({ title: "", content: "", emoji: "", isPublished: 1, sortOrder: "0" });

  // ── Bulk Email state ──
  const CAMPAIGN_EMAIL_SUBJECT = "עדכונים חדשים ב-AI DXF + 15 אסימונים חינם";
  const CAMPAIGN_EMAIL_BODY = `<p style="font-size:15px; color:#374151; line-height:1.8; margin:0 0 16px;">שלום {{name}},</p>
<p style="font-size:15px; color:#374151; line-height:1.8; margin:0 0 16px;">תודה שנרשמת לאתר AI DXF. הוספנו יכולות חדשות ורצינו לעדכן אותך.</p>
<p style="font-size:14px; font-weight:bold; color:#1e1b4b; margin:0 0 10px;">מה חדש באתר:</p>
<p style="font-size:14px; color:#374151; line-height:1.8; margin:0 0 6px;">&#10024; יצירת תמונה מטקסט (AI Create) — תאר בטקסט מה אתה רוצה וה-AI יצור תמונה ויהפוך אותה לקובץ DXF.</p>
<p style="font-size:14px; color:#374151; line-height:1.8; margin:0 0 6px;">&#128176; רכישת אסימונים — עכשיו ניתן לרכוש אסימונים נוספים ישירות מהאתר.</p>
<p style="font-size:14px; color:#374151; line-height:1.8; margin:0 0 20px;">&#128247; ממשק משופר — עיצוב חדש ומהיר יותר עם תצוגה מקדימה.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef9c3; border:1px solid #fde68a; border-radius:8px; margin-bottom:20px;">
<tr><td style="padding:16px 20px; direction:rtl; text-align:right;">
<p style="margin:0 0 6px; font-size:15px; font-weight:bold; color:#92400e;">מתנה מיוחדת: 15 אסימונים נוספים</p>
<p style="margin:0; font-size:13px; color:#78350f; line-height:1.7;">כל משתמש רשום שייכנס לאתר דרך הקישור הזה יקבל 15 אסימונים שיתווספו אוטומטית לחשבונו.</p>
</td></tr>
</table>
<p style="text-align:center; margin:0 0 8px;">
<a href="https://dxfai.net/?campaign=email_bonus_2026_03" style="display:inline-block; background:#4f46e5; color:#ffffff; font-size:15px; font-weight:bold; padding:12px 36px; text-decoration:none; border-radius:6px;">כניסה לאתר וקבלת האסימונים</a>
</p>`;
  const CAMPAIGN_EMAIL_TEXT = `שלום {{name}},\n\nתודה שנרשמת לאתר AI DXF.\n\nמה חדש:\n- יצירת תמונה מטקסט (AI Create)\n- רכישת אסימונים\n- ממשק משופר\n\nמתנה מיוחדת: 15 אסימונים נוספים לכל מי שנכנס דרך הקישור:\nhttps://dxfai.net/?campaign=email_bonus_2026_03\n\nAI DXF - dxfai.net`;

  const [emailSubject, setEmailSubject] = useState(CAMPAIGN_EMAIL_SUBJECT);
  const [emailBody, setEmailBody] = useState(CAMPAIGN_EMAIL_BODY);
  const [emailPlainText, setEmailPlainText] = useState(CAMPAIGN_EMAIL_TEXT);
  const [emailSending, setEmailSending] = useState(false);
  const sendBulkEmailMutation = trpc.admin.sendBulkEmail.useMutation({
    onSuccess: (data) => {
      toast.success(`נשלח ל-${data.sent} משתמשים${data.failed > 0 ? ` (${data.failed} נכשלו)` : ""}`);
      setEmailSending(false);
    },
    onError: (e) => { toast.error("שגיאה: " + e.message); setEmailSending(false); },
  });

  const { data: consentData, isLoading: consentLoading } = trpc.admin.consentRecords.useQuery(
    undefined,
    { enabled: activeSection === "consents" }
  );

  const [paypalStatusFilter, setPaypalStatusFilter] = useState<"all" | "completed" | "pending" | "failed">("all");
  const { data: paypalOrdersData, isLoading: paypalOrdersLoading } = trpc.admin.paypalOrders.useQuery(
    undefined,
    { enabled: activeSection === "payments" }
  );
  const filteredPaypalOrders = paypalOrdersData
    ? paypalStatusFilter === "all"
      ? paypalOrdersData
      : paypalOrdersData.filter(o => o.status === paypalStatusFilter)
    : [];
  const { data: packagePricesData, isLoading: packagePricesLoading, refetch: refetchPrices } = trpc.admin.getPackagePrices.useQuery(
    undefined,
    { enabled: activeSection === "payments" }
  );
  const updatePriceMutation = trpc.admin.updatePackagePrice.useMutation({
    onSuccess: () => { toast.success("מחיר עודכן בהצלחה!"); refetchPrices(); setEditingPriceId(null); },
    onError: (e) => toast.error("שגיאה: " + e.message),
  });
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<string, Record<string, string | boolean | number | null>>>({});
  const ALL_CURRENCIES = ["USD", "EUR", "ILS", "GBP", "AUD", "CAD", "JPY"] as const;

  // ── Token Costs state ───
  const { data: tokenCostsData, isLoading: tokenCostsLoading, refetch: refetchTokenCosts } = trpc.admin.getTokenCosts.useQuery(
    undefined,
    { enabled: activeSection === "payments" }
  );
  const updateTokenCostMutation = trpc.admin.updateTokenCost.useMutation({
    onSuccess: () => { toast.success("עלות עודכנה בהצלחה!"); refetchTokenCosts(); setEditingCostAction(null); },
    onError: (e) => toast.error("שגיאה: " + e.message),
  });
  const [editingCostAction, setEditingCostAction] = useState<string | null>(null);
  const [costEdits, setCostEdits] = useState<Record<string, number>>({});

  // הה Settings state ההה
  const [settingsName, setSettingsName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // הה Add Package state ההה
  const [showAddPackage, setShowAddPackage] = useState(false);
  const emptyPkg = { packageId: "", label: "", tokenAmount: "", priceILS: "", priceUSD: "", priceEUR: "", priceGBP: "", priceAUD: "", priceCAD: "", priceJPY: "", discountPercent: "", badge: "" as "" | "recommended" | "best_value" | "sale" | "trial", imageUrl: "" };
  const [newPkg, setNewPkg] = useState(emptyPkg);
  const addPackageMutation = trpc.admin.addPackage.useMutation({
    onSuccess: () => { toast.success("חבילה נוספה!"); refetchPrices(); setShowAddPackage(false); setNewPkg(emptyPkg); },
    onError: (e) => toast.error("שגיאה: " + e.message),
  });
  const deletePackageMutation = trpc.admin.deletePackage.useMutation({
    onSuccess: () => { toast.success("חבילה נמחקה"); refetchPrices(); },
    onError: (e) => toast.error("שגיאה: " + e.message),
  });

  // הה Contact Settings state ההה
  const { data: contactSettings, refetch: refetchContact } = trpc.admin.getContactSettings.useQuery(
    undefined, { enabled: activeSection === "settings" }
  );
  const { data: campaignData, isLoading: campaignLoading } = trpc.admin.getCampaignRedemptions.useQuery(
    {},
    { enabled: activeSection === "campaign" }
  );
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const updateContactMutation = trpc.admin.updateContactSettings.useMutation({
    onSuccess: () => { toast.success("פרטי קשר עודכנו!"); refetchContact(); },
    onError: (e) => toast.error("שגיאה: " + e.message),
  });
  useEffect(() => {
    if (contactSettings) {
      setContactEmail(contactSettings.supportEmail ?? "");
      setContactWhatsapp(contactSettings.whatsappNumber ?? "");
    }
  }, [contactSettings]);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Top Header */}
      <header className="border-b bg-white sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663365044246/SslVmktvndMoFSwH.png"
              alt="לוגו"
              className="w-9 h-9 rounded-lg object-contain shrink-0"
            />
            <div>
              <h1 className="text-sm font-bold leading-tight text-slate-800">דשבורד ניהול</h1>
              <p className="text-xs text-slate-400">מעקב שימוש ופעילות</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { window.location.href = "/"; }} className="text-xs">
              ← חזור לאפליקציה
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()} className="text-slate-400 gap-1.5 text-xs">
              <LogOut className="w-3.5 h-3.5" />יציאה
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <aside className="w-48 shrink-0 hidden md:block">
          <nav className="bg-white rounded-xl border shadow-sm p-2 sticky top-20 space-y-1">
            {([
              { id: "overview", label: "סקירה כללית", icon: TrendingUp },
              { id: "activity", label: "פעילות", icon: Activity },
              { id: "users", label: "משתמשים", icon: Users },
              { id: "subscriptions", label: "מנויים", icon: Crown },
              { id: "bugs", label: "דוחות באגים", icon: Bug },
              { id: "news", label: "חדשות", icon: Newspaper },
              { id: "consents", label: "הסכמות", icon: CheckCircle2 },
              { id: "payments", label: "תשלומי PayPal", icon: CreditCard },
              { id: "email", label: "שליחת מייל", icon: Mail },
              { id: "campaign", label: "קמפיין מייל", icon: Gift },
              { id: "settings", label: "הגדרות", icon: Settings },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full text-right flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === id
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile Tab Bar */}
        <div className="md:hidden w-full mb-4">
          <div className="flex flex-wrap bg-white rounded-xl border shadow-sm p-1 gap-1">
            {([
              { id: "overview", label: "סקירה", icon: TrendingUp },
              { id: "activity", label: "פעילות", icon: Activity },
              { id: "users", label: "משתמשים", icon: Users },
              { id: "subscriptions", label: "מנויים", icon: Crown },
              { id: "bugs", label: "באגים", icon: Bug },
              { id: "news", label: "חדשות", icon: Newspaper },
              { id: "consents", label: "הסכמות", icon: CheckCircle2 },
              { id: "payments", label: "PayPal", icon: CreditCard },
              { id: "email", label: "מייל", icon: Mail },
              { id: "campaign", label: "קמפיין", icon: Gift },
              { id: "settings", label: "הגדרות", icon: Settings },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === id ? "bg-blue-600 text-white" : "text-slate-500"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 min-w-0 space-y-5">

        {/* ── OVERVIEW SECTION ── */}
        {activeSection === "overview" && (
          <>
        {/* Stats */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="p-5"><div className="h-16 bg-muted animate-pulse rounded-lg" /></CardContent></Card>
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Activity} label="סה״כ פעולות" value={stats.total} sub="מאז ההשקה" />
              <StatCard icon={Calendar} label="היום" value={stats.today} color="text-blue-600" />
              <StatCard icon={Upload} label="המרות תמונה" value={stats.totalConvert} sub="סה״כ" />
              <StatCard icon={Sparkles} label="יצירות AI" value={stats.totalAi} sub="סה״כ" color="text-purple-600" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={TrendingUp} label="השבוע" value={stats.thisWeek} sub="7 ימים אחרונים" />
              <StatCard icon={Calendar} label="החודש" value={stats.thisMonth} sub="30 ימים אחרונים" />
            </div>
          </>
        ) : null}

        {/* Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              פעילות 30 ימים אחרונים
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="המרות" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="יצירות AI" fill="#a855f7" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              פעולות אחרונות
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : recent && recent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-right py-2 pr-2 font-medium">תמונה</th>
                      <th className="text-right py-2 pr-2 font-medium">סוג</th>
                      <th className="text-right py-2 font-medium">קווים</th>
                      <th className="text-right py-2 font-medium">IP</th>
                      <th className="text-right py-2 font-medium">תאריך ושעה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((ev) => (
                      <tr key={ev.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-2">
                          {ev.imageUrl ? (
                            <img
                              src={ev.imageUrl}
                              alt="תמונה מקורית"
                              className="w-10 h-10 object-cover rounded border"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center">
                              <Upload className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
                            ${ev.type === "convert" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                            {ev.type === "convert" ? <><Upload className="w-3 h-3" />המרה</> : <><Sparkles className="w-3 h-3" />AI</>}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">{(ev.segmentCount ?? 0).toLocaleString()}</td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">{ev.ipAnon ?? "—"}</td>
                        <td className="py-2 text-muted-foreground text-xs">{new Date(ev.createdAt).toLocaleString("he-IL")}</td>
                      </tr>
                    ))}

                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                אין פעולות עדיין. ברגע שמשתמשים יתחילו להשתמש — הנתונים יופיעו כאן.
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}

        {/* ── ACTIVITY SECTION ── */}
        {activeSection === "activity" && (
          <ActivitySection recent={recent} recentLoading={recentLoading} />
        )}

        {/* ── USERS SECTION ── */}
        {activeSection === "users" && <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              משתמשים רשומים
              {(enhancedUsers ?? registeredUsers) && (
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {(enhancedUsers ?? registeredUsers)!.length} משתמשים
                </span>
              )}
              <button
                className="mr-auto text-muted-foreground hover:text-primary transition-colors"
                onClick={() => { refetchUsers(); refetchEnhanced(); }}
                title="רענן נתונים"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(enhancedUsersLoading || usersLoading) ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : (enhancedUsers ?? registeredUsers) && (enhancedUsers ?? registeredUsers)!.length > 0 ? (
              <div className="space-y-2">
                {(enhancedUsers ?? registeredUsers)!.map((u) => {
                  const isExpanded = expandedUser === u.id;
                  const lastAction = u.lastAction;
                  const lastPurchase = (u as { lastPurchase?: { packageId: string; priceAmount: number; currency: string } }).lastPurchase;
                  const subscription = (u as { subscription?: { planId: string; periodEnd: Date | string } | null }).subscription;
                  const actionLabel = lastAction?.actionType === "ai_generate" ? "יצירת AI" : lastAction?.actionType === "convert" ? "המרה" : lastAction?.actionType === "download" ? "הורדה" : null;
                  // Activity dot: green = active last 24h, yellow = active last 7d, gray = inactive
                  const lastActivityMs = lastAction ? Date.now() - new Date(lastAction.createdAt).getTime() : Infinity;
                  const activityDot = lastActivityMs < 86400000 ? "bg-green-500" : lastActivityMs < 604800000 ? "bg-yellow-400" : "bg-gray-300";
                  const activityTitle = lastActivityMs < 86400000 ? "פעיל ב-24 שעות אחרונות" : lastActivityMs < 604800000 ? "פעיל ב-7 ימים אחרונים" : "לא פעיל";
                  return (
                    <div key={u.id} className="border rounded-lg overflow-hidden">
                      {/* User row */}
                      <button
                        className="w-full text-right px-3 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                      >
                        {/* Activity dot */}
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${activityDot}`} title={activityTitle} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{u.name ?? <span className="text-muted-foreground">ללא שם</span>}</span>
                            <span className="text-xs text-muted-foreground font-mono">{u.email}</span>
                            {u.isBlocked ? <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">חסום</span> : null}
                            {subscription && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <Crown className="w-2.5 h-2.5" />{subscription.planId}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                            <span>נרשם: {new Date(u.createdAt).toLocaleDateString("he-IL")}</span>
                            {u.lastLoginAt && <span>כניסה: {new Date(u.lastLoginAt).toLocaleDateString("he-IL")}</span>}
                            {lastAction && (
                              <span className="text-slate-500">
                                פעולה אחרונה: <span className="font-medium text-slate-700">{actionLabel}</span> לפני {Math.round((Date.now() - new Date(lastAction.createdAt).getTime()) / 60000)} דקות
                              </span>
                            )}
                            {lastPurchase && (
                              <span className="text-green-600 font-medium">רכישה: {lastPurchase.packageId} ({lastPurchase.priceAmount} {lastPurchase.currency})</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          {/* Token balance badge + add */}
                          {addingTokensUser === u.id ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Input
                                type="number"
                                min={1}
                                max={10000}
                                placeholder="כמות"
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value)}
                                className="w-16 h-6 text-xs px-1 py-0"
                                dir="ltr"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                                disabled={addTokensMutation.isPending}
                                onClick={() => {
                                  const val = parseInt(tokenInput, 10);
                                  if (val > 0) addTokensMutation.mutate({ userId: u.id, amount: val });
                                }}
                              >
                                הוסף
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 px-1 text-xs" onClick={() => setAddingTokensUser(null)}>✕</Button>
                            </div>
                          ) : (
                            <button
                              className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium hover:bg-blue-200 transition-colors"
                              onClick={(e) => { e.stopPropagation(); setAddingTokensUser(u.id); setTokenInput(""); }}
                              title="לחץ להוספת אסימונים"
                            >
                              <Coins className="w-3 h-3" />
                              {u.tokenBalance ?? 0} אסימונים
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                          {/* Block/Unblock button */}
                          <button
                            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors flex items-center gap-1 ${
                              u.isBlocked
                                ? "bg-red-100 text-red-700 hover:bg-red-200"
                                : "bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (u.isBlocked) {
                                unblockUserMutation.mutate({ userId: u.id });
                              } else {
                                if (confirm(`לחסום את ${u.name ?? u.email}?`)) {
                                  blockUserMutation.mutate({ userId: u.id });
                                }
                              }
                            }}
                            title={u.isBlocked ? "שחרר חסימה" : "חסום משתמש"}
                          >
                            {u.isBlocked ? <><ShieldCheck className="w-3 h-3" /> חסום</> : <Ban className="w-3 h-3" />}
                          </button>
                          {/* Password reset button */}
                          <button
                            className="text-xs text-muted-foreground hover:text-blue-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`לשלוח מייל איפוס סיסמא ל-${u.email}?`)) {
                                sendPasswordResetMutation.mutate({ userId: u.id });
                              }
                            }}
                            title="שלח איפוס סיסמא"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          {/* Token history toggle */}
                          <button
                            className="text-xs text-muted-foreground hover:text-primary transition-colors"
                            onClick={(e) => { e.stopPropagation(); setTokenHistoryUser(tokenHistoryUser === u.id ? null : u.id); }}
                            title="היסטוריית אסימונים"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </button>
                      {/* Expanded actions */}
                      {isExpanded && (() => {
                        const userActs = userActionsData?.filter((a) => a.appUserId === u.id) ?? [];
                        return (
                        <div className="border-t bg-muted/20 px-3 py-2">
                          {actionsLoading ? (
                            <div className="h-8 bg-muted animate-pulse rounded" />
                          ) : userActs.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">אין פעולות עדיין.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b">
                                  <th className="text-right py-1.5 pr-2 font-medium">סוג</th>
                                  <th className="text-right py-1.5 pr-2 font-medium">תיאור</th>
                                  <th className="text-right py-1.5 font-medium">תאריך</th>
                                  <th className="text-right py-1.5 font-medium">תצוגה / הורדה</th>
                                </tr>
                              </thead>
                              <tbody>
                                {userActs.map((a) => (
                                  <tr key={a.id} className="border-b last:border-0">
                                    <td className="py-1.5 pr-2">
                                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                        a.actionType === "ai_generate"
                                          ? "bg-purple-100 text-purple-700"
                                          : a.actionType === "convert"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-green-100 text-green-700"
                                      }`}>
                                        {a.actionType === "ai_generate" ? "יצירת AI" : a.actionType === "convert" ? "המרה" : "הורדה"}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-2 text-muted-foreground max-w-[140px] truncate">{a.description ?? "—"}</td>
                                    <td className="py-1.5 text-muted-foreground">{new Date(a.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}</td>
                                    <td className="py-1.5">
                                      <div className="flex items-center gap-2">
                                        {a.imageUrl && (
                                          <a href={a.imageUrl} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-700" title="תצוגה">
                                            <span className="text-xs underline">תמונה</span>
                                          </a>
                                        )}
                                        {a.dxfUrl ? (
                                          <a href={a.dxfUrl} download className="text-primary hover:underline flex items-center gap-1 text-xs">
                                            <FileCode2 className="w-3 h-3" />DXF
                                          </a>
                                        ) : "—"}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                        );
                      })()}
                      {/* Token history panel */}
                      {tokenHistoryUser === u.id && (
                        <div className="border-t bg-blue-50/50 px-3 py-2">
                          <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                            <Coins className="w-3 h-3" /> היסטוריית אסימונים
                          </p>
                          {tokenHistoryLoading ? (
                            <div className="h-8 bg-muted animate-pulse rounded" />
                          ) : !tokenHistory || tokenHistory.length === 0 ? (
                            <p className="text-xs text-muted-foreground">אין היסטוריה עדיין.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b">
                                  <th className="text-right py-1 font-medium">סוג</th>
                                  <th className="text-right py-1 font-medium">כמות</th>
                                  <th className="text-right py-1 font-medium">יתרה</th>
                                  <th className="text-right py-1 font-medium">תאריך</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tokenHistory.map((tx) => (
                                  <tr key={tx.id} className="border-b last:border-0">
                                    <td className="py-1">
                                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                        tx.reason === "signup_grant" ? "bg-green-100 text-green-700" :
                                        tx.reason === "admin_add" ? "bg-blue-100 text-blue-700" :
                                        "bg-red-100 text-red-700"
                                      }`}>
                                        {tx.reason === "signup_grant" ? "מתנה" : tx.reason === "admin_add" ? "הוספה" : "ניכוי"}
                                      </span>
                                    </td>
                                    <td className={`py-1 font-mono font-semibold ${
                                      tx.amount > 0 ? "text-green-600" : "text-red-600"
                                    }`}>{tx.amount > 0 ? "+" : ""}{tx.amount}</td>
                                    <td className="py-1 font-mono">{tx.balanceAfter}</td>
                                    <td className="py-1 text-muted-foreground">{new Date(tx.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                אין משתמשים רשומים עדיין.
              </div>
            )}
          </CardContent>
        </Card>}
        {/* ── BUGS SECTION ── */}
        {activeSection === "bugs" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bug className="w-4 h-4 text-red-500" />
                    דוחות באגים
                    {bugData && <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{bugData.length}</span>}
                  </CardTitle>
                  <div className="flex gap-1">
                    {(["all", "new", "investigating", "resolved", "ignored"] as const).map(s => (
                      <button key={s} onClick={() => setBugStatusFilter(s)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          bugStatusFilter === s ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}>
                        {s === "all" ? "הכל" : s === "new" ? "חדש" : s === "investigating" ? "בבדיקה" : s === "resolved" ? "נפתר" : "בוטל"}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {bugLoading ? (
                  <div className="p-4 space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
                ) : !bugData || bugData.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Bug className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">אין דוחות באגים עדיין</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {bugData.map((bug) => (
                      <div key={bug.id} className="p-3 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                bug.errorType === "convert_failed" ? "bg-red-100 text-red-700" :
                                bug.errorType === "ai_failed" ? "bg-purple-100 text-purple-700" :
                                bug.errorType === "download_failed" ? "bg-orange-100 text-orange-700" :
                                "bg-gray-100 text-gray-700"
                              }`}>
                                {bug.errorType === "convert_failed" ? "כשלון המרה" :
                                 bug.errorType === "ai_failed" ? "כשלון AI" :
                                 bug.errorType === "download_failed" ? "כשלון הורדה" : "אחר"}
                              </span>
                              {bug.feature && <span className="text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">{bug.feature}</span>}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                bug.status === "new" ? "bg-yellow-100 text-yellow-700" :
                                bug.status === "investigating" ? "bg-blue-100 text-blue-700" :
                                bug.status === "resolved" ? "bg-green-100 text-green-700" :
                                "bg-gray-100 text-gray-500"
                              }`}>
                                {bug.status === "new" ? "חדש" : bug.status === "investigating" ? "בבדיקה" : bug.status === "resolved" ? "נפתר" : "בוטל"}
                              </span>
                            </div>
                            {bug.errorMessage && <p className="text-xs text-muted-foreground font-mono truncate">{bug.errorMessage}</p>}
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {bug.userName && <span className="font-medium text-slate-700">{bug.userName}</span>}
                              {bug.userEmail && <span>{bug.userEmail}</span>}
                              {bug.ipAnon && <span className="font-mono">{bug.ipAnon}</span>}
                              <span>{new Date(bug.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}</span>
                            </div>
                            {bug.adminNote && <p className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded">הערה: {bug.adminNote}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {bug.status !== "investigating" && (
                              <button onClick={() => updateBugMutation.mutate({ id: bug.id, status: "investigating" })}
                                className="p-1 rounded hover:bg-blue-100 text-blue-500 transition-colors" title="סמן כבבדיקה">
                                <Search className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {bug.status !== "resolved" && (
                              <button onClick={() => updateBugMutation.mutate({ id: bug.id, status: "resolved" })}
                                className="p-1 rounded hover:bg-green-100 text-green-500 transition-colors" title="סמן כנפתר">
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {bug.status !== "ignored" && (
                              <button onClick={() => updateBugMutation.mutate({ id: bug.id, status: "ignored" })}
                                className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors" title="בטל">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── SUBSCRIPTIONS SECTION ── */}
        {activeSection === "subscriptions" && (
          <div className="space-y-5">
            {/* Plans management */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    תוכניות מנוי
                  </CardTitle>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                    onClick={() => { setEditingPlan("new"); setPlanForm({ planId: "", name: "", dailyConversions: "10", priceILS: "", priceUSD: "", discountPercent: "0", badge: "", sortOrder: "0" }); }}>
                    <Plus className="w-3.5 h-3.5" /> הוסף תוכנית
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {editingPlan && (
                  <div className="mb-4 p-4 border rounded-xl bg-muted/30 space-y-3">
                    <p className="text-sm font-semibold">{editingPlan === "new" ? "תוכנית חדשה" : "עריכת תוכנית"}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">מזהה (ID)</label>
                        <Input value={planForm.planId} onChange={e => setPlanForm(p => ({...p, planId: e.target.value}))} placeholder="basic" className="h-8 text-sm" disabled={editingPlan !== "new"} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">שם</label>
                        <Input value={planForm.name} onChange={e => setPlanForm(p => ({...p, name: e.target.value}))} placeholder="בסיס" className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">המרות ביום</label>
                        <Input type="number" value={planForm.dailyConversions} onChange={e => setPlanForm(p => ({...p, dailyConversions: e.target.value}))} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">מחיר בשקל (ILS)</label>
                        <Input value={planForm.priceILS} onChange={e => setPlanForm(p => ({...p, priceILS: e.target.value}))} placeholder="49" className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">מחיר בדולר (USD)</label>
                        <Input value={planForm.priceUSD} onChange={e => setPlanForm(p => ({...p, priceUSD: e.target.value}))} placeholder="14" className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">הנחה %</label>
                        <Input type="number" min={0} max={100} value={planForm.discountPercent} onChange={e => setPlanForm(p => ({...p, discountPercent: e.target.value}))} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">תג</label>
                        <select value={planForm.badge} onChange={e => setPlanForm(p => ({...p, badge: e.target.value as "" | "recommended" | "best_value" | "sale"}))} className="h-8 text-sm border rounded px-2 w-full">
                          <option value="">אין</option>
                          <option value="recommended">מומלץ</option>
                          <option value="best_value">הכי משתלם</option>
                          <option value="sale">מבצע</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">סדר תצוגה</label>
                        <Input type="number" value={planForm.sortOrder} onChange={e => setPlanForm(p => ({...p, sortOrder: e.target.value}))} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs" onClick={() => upsertPlanMutation.mutate({
                        planId: planForm.planId, name: planForm.name,
                        dailyConversions: parseInt(planForm.dailyConversions) || 10,
                        priceILS: planForm.priceILS, priceUSD: planForm.priceUSD,
                        discountPercent: parseInt(planForm.discountPercent) || 0,
                        badge: planForm.badge || null,
                        sortOrder: parseInt(planForm.sortOrder) || 0,
                      })} disabled={upsertPlanMutation.isPending}>שמור</Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditingPlan(null)}>בטל</Button>
                    </div>
                  </div>
                )}
                {subPlansLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
                ) : !subPlans || subPlans.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">אין תוכניות עדיין. לחץ הוסף כדי ליצור אחת.</div>
                ) : (
                  <div className="space-y-2">
                    {subPlans.map(plan => (
                      <div key={plan.planId} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{plan.name}</span>
                            {plan.badge && <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              plan.badge === "recommended" ? "bg-blue-100 text-blue-700" :
                              plan.badge === "best_value" ? "bg-green-100 text-green-700" :
                              "bg-orange-100 text-orange-700"
                            }`}>{plan.badge === "recommended" ? "מומלץ" : plan.badge === "best_value" ? "הכי משתלם" : "מבצע"}</span>}
                            {!plan.isActive && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">לא פעיל</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{plan.dailyConversions} המרות/יום • ₪{plan.priceILS} / ${plan.priceUSD}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingPlan(plan.planId); setPlanForm({ planId: plan.planId, name: plan.name, dailyConversions: String(plan.dailyConversions), priceILS: plan.priceILS, priceUSD: plan.priceUSD, discountPercent: String(plan.discountPercent ?? 0), badge: (plan.badge ?? "") as "" | "recommended" | "best_value" | "sale", sortOrder: String(plan.sortOrder ?? 0) }); }}
                            className="p-1.5 rounded hover:bg-blue-100 text-blue-500">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { if (confirm("למחוק תוכנית?")) deletePlanMutation.mutate({ planId: plan.planId }); }}
                            className="p-1.5 rounded hover:bg-red-100 text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active user subscriptions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  מנויים פעילים
                  {userSubs && <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{userSubs.length}</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {userSubsLoading ? (
                  <div className="p-4 space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
                ) : !userSubs || userSubs.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">אין מנויים פעילים</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="py-2 px-3 text-right font-medium">משתמש</th>
                          <th className="py-2 px-3 text-right font-medium">תוכנית</th>
                          <th className="py-2 px-3 text-right font-medium">סטטוס</th>
                          <th className="py-2 px-3 text-right font-medium">פג</th>
                          <th className="py-2 px-3 text-right font-medium">פעולות</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {userSubs.map(sub => (
                          <tr key={sub.id} className="hover:bg-muted/20">
                            <td className="py-2 px-3">
                              <p className="text-sm font-medium">{sub.userName ?? sub.userEmail?.split("@")[0]}</p>
                              <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{sub.planId}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                sub.status === "active" ? "bg-green-100 text-green-700" :
                                sub.status === "cancelled" ? "bg-red-100 text-red-600" :
                                "bg-gray-100 text-gray-600"
                              }`}>{sub.status === "active" ? "פעיל" : sub.status === "cancelled" ? "בוטל" : sub.status}</span>
                            </td>
                            <td className="py-2 px-3 text-xs text-muted-foreground">
                              {new Date(sub.periodEnd).toLocaleDateString("he-IL")}
                            </td>
                            <td className="py-2 px-3">
                              {sub.status === "active" && (
                                <button onClick={() => { if (confirm("לבטל מנוי?")) cancelSubMutation.mutate({ subscriptionId: sub.id }); }}
                                  className="text-xs text-red-500 hover:text-red-700 transition-colors">בטל</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assign subscription to user */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="w-4 h-4 text-purple-500" />
                  הקצאת מנוי למשתמש
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">ID משתמש</label>
                    <Input type="number" placeholder="123" value={assigningSubUser ?? ""} onChange={e => setAssigningSubUser(parseInt(e.target.value) || null)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">תוכנית</label>
                    <select value={assignPlanId} onChange={e => setAssignPlanId(e.target.value)} className="h-8 text-sm border rounded px-2 w-full">
                      <option value="">בחר תוכנית</option>
                      {(subPlans ?? []).map(p => <option key={p.planId} value={p.planId}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">חודשים</label>
                    <Input type="number" min={1} max={24} value={assignMonths} onChange={e => setAssignMonths(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex items-end">
                    <Button size="sm" className="w-full text-xs" disabled={!assigningSubUser || !assignPlanId || assignSubMutation.isPending}
                      onClick={() => assignSubMutation.mutate({ userId: assigningSubUser!, planId: assignPlanId, months: parseInt(assignMonths) || 1 })}>
                      הקצא
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── NEWS SECTION ── */}
        {activeSection === "news" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-blue-500" />
                    פריטי חדשות
                  </CardTitle>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                    onClick={() => { setEditingNews(-1); setNewsForm({ title: "", content: "", emoji: "", isPublished: 1, sortOrder: "0" }); }}>
                    <Plus className="w-3.5 h-3.5" /> הוסף פריט
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {editingNews !== null && (
                  <div className="mb-4 p-4 border rounded-xl bg-muted/30 space-y-3">
                    <p className="text-sm font-semibold">{editingNews === -1 ? "פריט חדש" : "עריכת פריט"}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">אימוג׳י</label>
                        <Input value={newsForm.emoji} onChange={e => setNewsForm(p => ({...p, emoji: e.target.value}))} placeholder="✨" className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">סדר תצוגה</label>
                        <Input type="number" value={newsForm.sortOrder} onChange={e => setNewsForm(p => ({...p, sortOrder: e.target.value}))} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">כותרת</label>
                      <Input value={newsForm.title} onChange={e => setNewsForm(p => ({...p, title: e.target.value}))} placeholder="פיצר שיפור חדש" className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">תוכן</label>
                      <textarea value={newsForm.content} onChange={e => setNewsForm(p => ({...p, content: e.target.value}))} rows={3}
                        className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="תיאור קצר של העדכון..." />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={newsForm.isPublished === 1} onChange={e => setNewsForm(p => ({...p, isPublished: e.target.checked ? 1 : 0}))} className="rounded" />
                        פורסם
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs" onClick={() => upsertNewsMutation.mutate({
                        id: editingNews > 0 ? editingNews : undefined,
                        title: newsForm.title, content: newsForm.content,
                        emoji: newsForm.emoji || undefined,
                        isPublished: newsForm.isPublished,
                        sortOrder: parseInt(newsForm.sortOrder) || 0,
                      })} disabled={upsertNewsMutation.isPending}>שמור</Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditingNews(null)}>בטל</Button>
                    </div>
                  </div>
                )}
                {newsLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
                ) : !newsData || newsData.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">אין פריטי חדשות עדיין</div>
                ) : (
                  <div className="space-y-2">
                    {newsData.map(item => (
                      <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/20">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {item.emoji && <span className="text-lg">{item.emoji}</span>}
                            <span className="font-medium text-sm">{item.title}</span>
                            {!item.isPublished && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">טיוטא</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.content}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setEditingNews(item.id); setNewsForm({ title: item.title, content: item.content, emoji: item.emoji ?? "", isPublished: item.isPublished, sortOrder: String(item.sortOrder ?? 0) }); }}
                            className="p-1.5 rounded hover:bg-blue-100 text-blue-500">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { if (confirm("למחוק?")) deleteNewsMutation.mutate({ id: item.id }); }}
                            className="p-1.5 rounded hover:bg-red-100 text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── CONSENTS SECTION ── */}
        {activeSection === "consents" && (
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  רשומות הסכמה לתנאי שימוש ופרטיות
                </CardTitle>
              </CardHeader>
              <CardContent>
                {consentLoading ? (
                  <div className="py-8 flex justify-center">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : !consentData || consentData.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    אין רשומות הסכמה עדיין.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="pb-2 text-right font-medium">אימייל</th>
                          <th className="pb-2 text-right font-medium">גרסת תנאים</th>
                          <th className="pb-2 text-right font-medium">גרסת פרטיות</th>
                          <th className="pb-2 text-right font-medium">IP</th>
                          <th className="pb-2 text-right font-medium">תאריך</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {consentData.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="py-2 font-mono text-xs">{row.email ?? "-"}</td>
                            <td className="py-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                {row.termsVersion}
                              </span>
                            </td>
                            <td className="py-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                {row.privacyVersion}
                              </span>
                            </td>
                            <td className="py-2 font-mono text-xs text-muted-foreground">{row.ipAnon ?? "-"}</td>
                            <td className="py-2 text-xs text-muted-foreground">
                              {new Date(row.consentAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      סה"כ {consentData.length} רשומות הסכמה
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── PAYPAL ORDERS SECTION ── */}
        {activeSection === "payments" && (
          <div className="space-y-5">
            {/* Token Costs Management */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  עלות טוקנים לפעולה (מחירון המרות)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">קבע כמה טוקנים עולה כל פעולה. שינוי ייכנס לתוקף מידי.</p>
              </CardHeader>
              <CardContent>
                {tokenCostsLoading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">טוען...</div>
                ) : !tokenCostsData || tokenCostsData.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">אין נתוני עלויות</div>
                ) : (
                  <div className="space-y-2">
                    {tokenCostsData.map((item) => (
                      <div key={item.action} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.label || item.action}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.action}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {editingCostAction === item.action ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="h-7 w-20 text-sm text-center"
                                  defaultValue={item.cost}
                                  onChange={(e) => setCostEdits(prev => ({ ...prev, [item.action]: parseInt(e.target.value) || 0 }))}
                                />
                                <span className="text-xs text-muted-foreground">טוקנים</span>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => setEditingCostAction(null)}>בטל</Button>
                              <Button
                                size="sm"
                                onClick={() => updateTokenCostMutation.mutate({
                                  action: item.action,
                                  cost: costEdits[item.action] ?? item.cost,
                                })}
                                disabled={updateTokenCostMutation.isPending}
                              >
                                {updateTokenCostMutation.isPending ? "שומר..." : "שמור"}
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                item.cost === 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                              }`}>
                                {item.cost === 0 ? "חינם" : `${item.cost} טוקנים`}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingCostAction(item.action); setCostEdits(prev => ({ ...prev, [item.action]: item.cost })); }}
                              >
                                ערוך
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Package Prices Management */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-500" />
                    ניהול מחירי חבילות
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setShowAddPackage(v => !v)} className="gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" /> הוסף חבילה
                  </Button>
                </div>
                {showAddPackage && (
                    <div className="mt-3 p-3 border rounded-lg bg-slate-50 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">חבילה חדשה</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">כמות אסימונים</label>
                        <Input className="h-7 text-xs mt-0.5" type="number" placeholder="200" value={newPkg.tokenAmount}
                          onChange={e => {
                            const amt = e.target.value;
                            const autoId = amt ? `tokens_${amt}` : "";
                            const autoLabel = amt ? `${amt} אסימונים` : "";
                            setNewPkg(p => {
                              // Update packageId if it's empty or still matches auto-pattern (not manually edited)
                              const isAutoId = !p.packageId || /^tokens_\d*$/.test(p.packageId);
                              const isAutoLabel = !p.label || /^\d+ אסימונים$/.test(p.label);
                              return {
                                ...p,
                                tokenAmount: amt,
                                packageId: isAutoId ? autoId : p.packageId,
                                label: isAutoLabel ? autoLabel : p.label,
                              };
                            });
                          }}
                          dir="ltr" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">שם תצוגה</label>
                        <Input className="h-7 text-xs mt-0.5" placeholder="200 אסימונים" value={newPkg.label} onChange={e => setNewPkg(p => ({ ...p, label: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">מזהה טכני (יוצר אוטומטית, למשל tokens_200)</label>
                        <Input className="h-7 text-xs mt-0.5" placeholder="tokens_200" value={newPkg.packageId} onChange={e => setNewPkg(p => ({ ...p, packageId: e.target.value }))} dir="ltr" maxLength={32} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">מחיר ב-שקל (יישום אוטומטי לשאר)</label>
                        <Input className="h-7 text-xs mt-0.5" type="number" placeholder="49" value={newPkg.priceILS}
                          onChange={e => {
                            const ils = parseFloat(e.target.value) || 0;
                            const rates: Record<string, number> = { USD: 0.27, EUR: 0.25, GBP: 0.21, AUD: 0.42, CAD: 0.37, JPY: 41 };
                            setNewPkg(p => ({ ...p, priceILS: e.target.value, priceUSD: (ils * rates.USD).toFixed(2), priceEUR: (ils * rates.EUR).toFixed(2), priceGBP: (ils * rates.GBP).toFixed(2), priceAUD: (ils * rates.AUD).toFixed(2), priceCAD: (ils * rates.CAD).toFixed(2), priceJPY: Math.round(ils * rates.JPY).toString() }));
                          }}
                          dir="ltr" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">הנחה באחוזים (0 = אין הנחה, 20 = 20% הנחה)</label>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Input className="h-7 text-xs w-24" type="number" placeholder="0" min={0} max={100} value={newPkg.discountPercent} onChange={e => setNewPkg(p => ({ ...p, discountPercent: e.target.value }))} dir="ltr" />
                          <span className="text-xs text-muted-foreground">%</span>
                          {newPkg.discountPercent && parseInt(newPkg.discountPercent) > 0 && newPkg.priceILS ? (
                            <span className="text-xs text-green-600 font-medium">
                              מחיר לאחר הנחה: ₪{(parseFloat(newPkg.priceILS) * (1 - parseInt(newPkg.discountPercent) / 100)).toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">ציור/תמונה לכרטיס (URL, אופציונלי)</label>
                        <Input className="h-7 text-xs mt-0.5" placeholder="https://..." value={newPkg.imageUrl} onChange={e => setNewPkg(p => ({ ...p, imageUrl: e.target.value }))} dir="ltr" />
                        {newPkg.imageUrl && (
                          <img src={newPkg.imageUrl} alt="תצוגה מקדימה" className="mt-1 h-16 w-auto rounded border object-cover" onError={e => (e.currentTarget.style.display='none')} />
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">תגית מיוחדת (אופציונלי)</label>
                        <div className="flex gap-2 mt-0.5 flex-wrap">                          {(["", "recommended", "best_value", "sale", "trial"] as const).map(opt => (
                            <button key={opt} type="button"
                              onClick={() => setNewPkg(p => ({ ...p, badge: opt as typeof p.badge }))}
                              className={`px-2 py-1 rounded text-xs border transition-all ${
                                newPkg.badge === opt
                                  ? opt === "recommended" ? "bg-blue-500 text-white border-blue-500"
                                  : opt === "best_value" ? "bg-green-500 text-white border-green-500"
                                  : opt === "sale" ? "bg-red-500 text-white border-red-500"
                                  : opt === "trial" ? "bg-purple-500 text-white border-purple-500"
                                  : "bg-slate-200 text-slate-600 border-slate-300"
                                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                              }`}>
                              {opt === "" ? "אין תגית" : opt === "recommended" ? "★ מומלץ" : opt === "best_value" ? "💰 הכי משתלם" : opt === "sale" ? "🔥 במבצע" : "🌟 התנסות"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => setShowAddPackage(false)} className="text-xs">בטל</Button>
                      <Button size="sm" className="text-xs"
                        disabled={!newPkg.packageId || !newPkg.label || !newPkg.tokenAmount || !newPkg.priceILS || addPackageMutation.isPending}
                        onClick={() => addPackageMutation.mutate({
                          packageId: newPkg.packageId,
                          label: newPkg.label,
                          tokenAmount: parseInt(newPkg.tokenAmount),
                          priceILS: newPkg.priceILS,
                          priceUSD: newPkg.priceUSD || "0",
                          priceEUR: newPkg.priceEUR || "0",
                          priceGBP: newPkg.priceGBP || "0",
                          priceAUD: newPkg.priceAUD || "0",
                          priceCAD: newPkg.priceCAD || "0",
                          priceJPY: newPkg.priceJPY || "0",
                          discountPercent: newPkg.discountPercent ? parseInt(newPkg.discountPercent) : 0,
                          badge: (newPkg.badge || null) as "recommended" | "best_value" | "sale" | null | undefined,
                          imageUrl: newPkg.imageUrl || null,
                        })}
                      >
                        {addPackageMutation.isPending ? "שומר..." : "הוסף חבילה"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {packagePricesLoading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">טוען...</div>
                ) : !packagePricesData || packagePricesData.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">אין חבילות</div>
                ) : (
                  <div className="space-y-4">
                    {packagePricesData.map((pkg) => (
                      <div key={pkg.packageId} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="font-semibold text-sm">{pkg.label || pkg.packageId}</span>
                            <span className="text-xs text-muted-foreground mr-2">({pkg.tokenAmount} אסימונים)</span>
                          </div>
                          {editingPriceId === pkg.packageId ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setEditingPriceId(null)}>בטל</Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const edits = priceEdits[pkg.packageId] || {};
                                  const enabledList = ALL_CURRENCIES
                                    .filter(c => (edits[`enabled_${c}`] ?? (pkg.enabledCurrencies ? pkg.enabledCurrencies.split(",").includes(c) : true)) === true)
                                    .join(",");
                                  updatePriceMutation.mutate({
                                    packageId: pkg.packageId,
                                    priceUSD: String(edits.priceUSD ?? pkg.priceUSD),
                                    priceEUR: String(edits.priceEUR ?? pkg.priceEUR),
                                    priceILS: String(edits.priceILS ?? pkg.priceILS),
                                    priceGBP: String(edits.priceGBP ?? pkg.priceGBP),
                                    priceAUD: String(edits.priceAUD ?? pkg.priceAUD),
                                    priceCAD: String(edits.priceCAD ?? pkg.priceCAD),
                                    priceJPY: String(edits.priceJPY ?? pkg.priceJPY),
                                    label: edits.label ? String(edits.label) : pkg.label ?? undefined,
                                    enabledCurrencies: enabledList || null,
                                    discountPercent: typeof edits.discountPercent === 'number' ? edits.discountPercent : (pkg.discountPercent ?? 0),
                                    badge: (edits.badge !== undefined ? edits.badge : pkg.badge) as "recommended" | "best_value" | "sale" | "trial" | null | undefined,
                                    imageUrl: edits.imageUrl !== undefined ? (edits.imageUrl as string | null) : (pkg.imageUrl ?? null),
                                  });
                                }}
                                disabled={updatePriceMutation.isPending}
                              >
                                {updatePriceMutation.isPending ? "שומר..." : "שמור"}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setEditingPriceId(pkg.packageId); setPriceEdits(prev => ({ ...prev, [pkg.packageId]: {} })); }}>
                                ערוך מחירים
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50 border-red-200"
                                disabled={deletePackageMutation.isPending}
                                onClick={() => {
                                  if (confirm(`למחוק את החבילה "${pkg.label || pkg.packageId}"?`)) {
                                    deletePackageMutation.mutate({ packageId: pkg.packageId });
                                  }
                                }}
                              >
                                מחק
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Currency toggles */}
                        {editingPriceId === pkg.packageId && (
                          <div className="mb-3 p-3 bg-muted/40 rounded-lg">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">מטבעות פעילים (כבה להסתרת מטבע מהלקוחות)</p>
                            <div className="flex flex-wrap gap-2">
                              {ALL_CURRENCIES.map((c) => {
                                const defaultEnabled = pkg.enabledCurrencies ? pkg.enabledCurrencies.split(",").includes(c) : true;
                                const isEnabled = priceEdits[pkg.packageId]?.[`enabled_${c}`] ?? defaultEnabled;
                                return (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setPriceEdits(prev => ({
                                      ...prev,
                                      [pkg.packageId]: { ...(prev[pkg.packageId] || {}), [`enabled_${c}`]: !isEnabled }
                                    }))}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                                      isEnabled
                                        ? "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                        : "bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:text-gray-500 line-through"
                                    }`}
                                  >
                                    {c}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {([
                            { key: "priceUSD", label: "USD ($)", val: pkg.priceUSD, cur: "USD" },
                            { key: "priceEUR", label: "EUR (€)", val: pkg.priceEUR, cur: "EUR" },
                            { key: "priceILS", label: "ILS (₪)", val: pkg.priceILS, cur: "ILS" },
                            { key: "priceGBP", label: "GBP (£)", val: pkg.priceGBP, cur: "GBP" },
                            { key: "priceAUD", label: "AUD (A$)", val: pkg.priceAUD, cur: "AUD" },
                            { key: "priceCAD", label: "CAD (C$)", val: pkg.priceCAD, cur: "CAD" },
                            { key: "priceJPY", label: "JPY (¥)", val: pkg.priceJPY, cur: "JPY" },
                          ] as const).map(({ key, label, val, cur }) => {
                            const defaultEnabled = pkg.enabledCurrencies ? pkg.enabledCurrencies.split(",").includes(cur) : true;
                            const isEnabled = editingPriceId === pkg.packageId
                              ? (priceEdits[pkg.packageId]?.[`enabled_${cur}`] ?? defaultEnabled)
                              : defaultEnabled;
                            return (
                            <div key={key} className={isEnabled ? "" : "opacity-40"}>
                              <label className="text-xs text-muted-foreground block mb-1">
                                {label}
                                {!isEnabled && <span className="ml-1 text-red-400">(כבוי)</span>}
                              </label>
                              {editingPriceId === pkg.packageId ? (
                                <Input
                                  className="h-7 text-sm"
                                  defaultValue={val}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    setPriceEdits(prev => ({
                                      ...prev,
                                      [pkg.packageId]: { ...(prev[pkg.packageId] || {}), [key]: newVal }
                                    }));
                                    // Auto-convert from ILS
                                    if (key === "priceILS" && newVal && !isNaN(parseFloat(newVal))) {
                                      const ils = parseFloat(newVal);
                                      const rates: Record<string, number> = { USD: 0.27, EUR: 0.25, GBP: 0.21, AUD: 0.42, CAD: 0.37, JPY: 41 };
                                      setPriceEdits(prev => ({
                                        ...prev,
                                        [pkg.packageId]: {
                                          ...(prev[pkg.packageId] || {}),
                                          priceILS: newVal,
                                          priceUSD: (ils * rates.USD).toFixed(2),
                                          priceEUR: (ils * rates.EUR).toFixed(2),
                                          priceGBP: (ils * rates.GBP).toFixed(2),
                                          priceAUD: (ils * rates.AUD).toFixed(2),
                                          priceCAD: (ils * rates.CAD).toFixed(2),
                                          priceJPY: Math.round(ils * rates.JPY).toString(),
                                        }
                                      }));
                                    }
                                  }}
                                />
                              ) : (
                                <span className="font-medium">{val}</span>
                              )}
                            </div>
                            );
                          })}
                        </div>
                        {/* Discount + Badge fields */}
                        {editingPriceId === pkg.packageId ? (
                          <div className="mt-3 pt-3 border-t space-y-3">
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">הנחה באחוזים (0 = אין הנחה)</label>
                              <div className="flex items-center gap-2">
                                <Input
                                  className="h-7 text-sm w-24"
                                  type="number"
                                  min={0}
                                  max={100}
                                  defaultValue={pkg.discountPercent ?? 0}
                                  onChange={(e) => setPriceEdits(prev => ({
                                    ...prev,
                                    [pkg.packageId]: { ...(prev[pkg.packageId] || {}), discountPercent: parseInt(e.target.value) || 0 }
                                  }))}
                                  dir="ltr"
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                                {(() => {
                                  const discRaw = priceEdits[pkg.packageId]?.discountPercent;
                                  const disc = typeof discRaw === 'number' ? discRaw : (pkg.discountPercent ?? 0);
                                  const price = parseFloat(String(priceEdits[pkg.packageId]?.priceILS ?? pkg.priceILS));
                                  return disc > 0 && price > 0 ? (
                                    <span className="text-xs text-green-600 font-medium">מחיר לאחר הנחה: ₪{(price * (1 - disc / 100)).toFixed(2)}</span>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                            <div className="col-span-2 mt-1">
                              <label className="text-xs text-muted-foreground block mb-1">ציור/תמונה לכרטיס (URL)</label>
                              <Input
                                className="h-7 text-xs"
                                placeholder="https://..."
                                dir="ltr"
                                value={String(priceEdits[pkg.packageId]?.imageUrl ?? pkg.imageUrl ?? "")}
                                onChange={e => setPriceEdits(prev => ({
                                  ...prev,
                                  [pkg.packageId]: { ...(prev[pkg.packageId] || {}), imageUrl: e.target.value || null }
                                }))}
                              />
                              {(() => {
                                const url = String(priceEdits[pkg.packageId]?.imageUrl ?? pkg.imageUrl ?? "");
                                return url ? <img src={url} alt="" className="mt-1 h-14 w-auto rounded border object-cover" onError={e => (e.currentTarget.style.display='none')} /> : null;
                              })()}
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">תגית מיוחדת</label>
                              <div className="flex gap-2 flex-wrap">
                                {(["none", "recommended", "best_value", "sale", "trial"] as const).map(opt => {
                                  const currentBadge = String(priceEdits[pkg.packageId]?.badge ?? pkg.badge ?? "none");
                                  const isSelected = currentBadge === opt || (opt === "none" && !currentBadge);
                                  return (
                                    <button key={opt} type="button"
                                      onClick={() => setPriceEdits(prev => ({
                                        ...prev,
                                        [pkg.packageId]: { ...(prev[pkg.packageId] || {}), badge: opt === "none" ? null : opt }
                                      }))}
                                      className={`px-2 py-1 rounded text-xs border transition-all ${
                                        isSelected
                                          ? opt === "recommended" ? "bg-blue-500 text-white border-blue-500"
                                          : opt === "best_value" ? "bg-green-500 text-white border-green-500"
                                          : opt === "sale" ? "bg-red-500 text-white border-red-500"
                                          : opt === "trial" ? "bg-purple-500 text-white border-purple-500"
                                          : "bg-slate-200 text-slate-600 border-slate-300"
                                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                                      }`}>
                                      {opt === "none" ? "אין" : opt === "recommended" ? "★ מומלץ" : opt === "best_value" ? "💰 הכי משתלם" : opt === "sale" ? "🔥 במבצע" : "🌟 התנסות"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {pkg.discountPercent && pkg.discountPercent > 0 ? (
                              <>
                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200">
                                  הנחה {pkg.discountPercent}%
                                </span>
                                <span className="text-xs text-muted-foreground">מחיר לאחר הנחה: ₪{(parseFloat(pkg.priceILS) * (1 - pkg.discountPercent / 100)).toFixed(2)}</span>
                              </>
                            ) : null}
                            {pkg.badge ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
                                pkg.badge === "recommended" ? "bg-blue-100 text-blue-700 border-blue-200"
                                : pkg.badge === "best_value" ? "bg-green-100 text-green-700 border-green-200"
                                : pkg.badge === "sale" ? "bg-orange-100 text-orange-700 border-orange-200"
                                : "bg-purple-100 text-purple-700 border-purple-200"
                              }`}>
                                {pkg.badge === "recommended" ? "★ מומלץ" : pkg.badge === "best_value" ? "💰 הכי משתלם" : pkg.badge === "sale" ? "🔥 במבצע" : "🌟 התנסות"}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-500" />
                    תשלומי PayPal
                  </CardTitle>
                  <div className="flex gap-1 text-xs flex-wrap">
                    {(["all", "completed", "pending", "failed"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setPaypalStatusFilter(f)}
                        className={`px-2 py-1 rounded-full border transition-colors ${
                          paypalStatusFilter === f
                            ? f === "completed" ? "bg-green-100 text-green-700 border-green-300"
                              : f === "pending" ? "bg-amber-100 text-amber-700 border-amber-300"
                              : f === "failed" ? "bg-red-100 text-red-700 border-red-300"
                              : "bg-slate-200 text-slate-700 border-slate-300"
                            : "bg-white text-muted-foreground border-border hover:bg-slate-50"
                        }`}
                      >
                        {f === "completed" ? "✅ הושלמו" : f === "pending" ? "🟠 לא הושלמו" : f === "failed" ? "❌ נכשלו" : "הכל"}
                        {paypalOrdersData && (
                          <span className="mr-1 opacity-60">
                            ({f === "all" ? paypalOrdersData.length : paypalOrdersData.filter(o => o.status === f).length})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {paypalOrdersLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">טוען...</div>
                ) : filteredPaypalOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {paypalStatusFilter === "completed" ? "אין תשלומים שהושלמו עדיין" :
                     paypalStatusFilter === "pending" ? "אין הזמנות שלא הושלמו" :
                     paypalStatusFilter === "failed" ? "אין הזמנות שנכשלו" :
                     "אין הזמנות PayPal עדיין"}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Revenue summary cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-600 font-medium">✅ הושלמו</p>
                        <p className="text-lg font-bold text-green-700">{(paypalOrdersData ?? []).filter(o => o.status === "completed").length}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-amber-600 font-medium">🟠 עצרו באמצע</p>
                        <p className="text-lg font-bold text-amber-700">{(paypalOrdersData ?? []).filter(o => o.status === "pending").length}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-blue-600 font-medium">הכנסה ב-ILS</p>
                        <p className="text-lg font-bold text-blue-700">
                          ₪{(paypalOrdersData ?? []).filter(o => o.status === "completed" && o.currency === "ILS").reduce((sum, o) => sum + parseFloat(String(o.priceAmount || 0)), 0).toFixed(0)}
                        </p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-purple-600 font-medium">אסימונים נמכרו</p>
                        <p className="text-lg font-bold text-purple-700">{(paypalOrdersData ?? []).filter(o => o.status === "completed").reduce((sum, o) => sum + (o.tokenAmount || 0), 0)}</p>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 rounded-lg text-right">
                          <th className="py-2 pr-3 font-semibold text-muted-foreground text-xs rounded-r-lg">תאריך</th>
                          <th className="py-2 pr-2 font-semibold text-muted-foreground text-xs">משתמש</th>
                          <th className="py-2 pr-2 font-semibold text-muted-foreground text-xs">חבילה</th>
                          <th className="py-2 pr-2 font-semibold text-muted-foreground text-xs">סכום</th>
                          <th className="py-2 pr-2 font-semibold text-muted-foreground text-xs">אסימונים</th>
                          <th className="py-2 pr-2 font-semibold text-muted-foreground text-xs rounded-l-lg">סטטוס</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPaypalOrders.map((order) => (
                          <tr key={order.id} className="border-b hover:bg-slate-50/80 transition-colors group">
                            <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(order.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                            </td>
                            <td className="py-2.5 pr-2">
                              <div>
                                <p className="text-sm font-medium">{order.userName || order.userEmail?.split('@')[0] || '—'}</p>
                                <p className="text-xs text-muted-foreground">{order.userEmail || '—'}</p>
                              </div>
                            </td>
                            <td className="py-2.5 pr-2">
                              <span className="bg-slate-100 text-slate-700 rounded-md px-2 py-0.5 text-xs font-medium">{order.packageId}</span>
                            </td>
                            <td className="py-2.5 pr-2">
                              <span className="font-bold text-green-600">{order.priceAmount}</span>
                              <span className="text-xs text-muted-foreground mr-1">{order.currency}</span>
                            </td>
                            <td className="py-2.5 pr-2">
                              <span className="bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5 text-xs font-bold">
                                +{order.tokenAmount}
                              </span>
                            </td>
                            <td className="py-2.5 pr-2">
                              <div className="flex flex-col gap-0.5">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit ${
                                  order.status === "completed" ? "bg-green-100 text-green-700" :
                                  order.status === "pending" ? "bg-amber-100 text-amber-700" :
                                  "bg-red-100 text-red-700"
                                }`}>
                                  {order.status === "completed" ? (
                                    <>✅ הושלם</>
                                  ) : order.status === "pending" ? (
                                    <>🟠 עצר לפני אישור</>
                                  ) : (
                                    <>❌ נכשל</>
                                  )}
                                </span>
                                {order.status === "pending" && (
                                  <span className="text-xs text-muted-foreground">
                                    יצר הזמנה, לא אישר ב-PayPal
                                  </span>
                                )}
                                {order.status === "completed" && order.completedAt && (
                                  <span className="text-xs text-green-600">
                                    הושלם {new Date(order.completedAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-muted-foreground mt-3 text-left">
                      מציג {filteredPaypalOrders.length} הזמנות
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        {/* ── SETTINGS SECTION ── */}
        {activeSection === "settings" && (
          <div className="space-y-5">
            {/* Maintenance Mode */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-orange-500" />
                  מצב תחזוקה
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">
                      {maintenanceData?.enabled ? "מצב תחזוקה פעיל" : "מצב תחזוקה כבוי"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {maintenanceData?.enabled
                        ? "האתר מוצג הודעת תחזוקה לכל המשתמשים"
                        : "האתר פעיל באופן רגיל"}
                    </p>
                  </div>
                  <Button
                    variant={maintenanceData?.enabled ? "destructive" : "outline"}
                    size="sm"
                    disabled={setMaintenanceMutation.isPending}
                    onClick={() => setMaintenanceMutation.mutate({ enabled: !maintenanceData?.enabled })}
                    className="shrink-0"
                  >
                    {setMaintenanceMutation.isPending
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : maintenanceData?.enabled
                        ? "כבה תחזוקה"
                        : "הפעל תחזוקה"}
                  </Button>
                </div>
              </CardContent>
            </Card>
            {/* Update Name */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  עדכון שם תצוגה
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="שם מלא"
                  value={settingsName}
                  onChange={e => setSettingsName(e.target.value)}
                  dir="rtl"
                />
                <Button
                  className="w-full"
                  disabled={nameLoading || !settingsName.trim()}
                  onClick={async () => {
                    setNameLoading(true);
                    try {
                      const r = await fetch("/api/app-auth/update-profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: settingsName.trim() }),
                        credentials: "include",
                      });
                      const data = await r.json();
                      if (!r.ok) throw new Error(data.error || "שגיאה");
                      toast.success("השם עודכן בהצלחה");
                      setSettingsName("");
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : "שגיאה בעדכון שם");
                    } finally {
                      setNameLoading(false);
                    }
                  }}
                >
                  {nameLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> שמור שם</>}
                </Button>
              </CardContent>
            </Card>

            {/* Contact Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4 text-green-500" />
                  פרטי קשר לשירות לקוחות
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">כפתור הוואצאפ ומייל באתר יפנו לכתובת אלו בלחיצה</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">מייל תמיכה</label>
                  <Input
                    type="email"
                    placeholder="support@dxfai.net"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">מספר וואצאפ (כולל קידומת מדינה, למשל 972501234567)</label>
                  <Input
                    type="tel"
                    placeholder="972501234567"
                    value={contactWhatsapp}
                    onChange={e => setContactWhatsapp(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={updateContactMutation.isPending}
                  onClick={() => updateContactMutation.mutate({ supportEmail: contactEmail, whatsappNumber: contactWhatsapp })}
                >
                  {updateContactMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> שמור פרטי קשר</>}
                </Button>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  שינוי סיסמה
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Input
                    type={showCurrentPw ? "text" : "password"}
                    placeholder="סיסמה נוכחית"
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    dir="rtl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showNewPw ? "text" : "password"}
                    placeholder="סיסמה חדשה (לפחות 6 תווים)"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    dir="rtl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Input
                  type="password"
                  placeholder="אשר סיסמה חדשה"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  dir="rtl"
                />
                <Button
                  className="w-full"
                  disabled={pwLoading || !currentPw || !newPw || newPw !== confirmPw}
                  onClick={async () => {
                    if (newPw !== confirmPw) { toast.error("הסיסמאות אינן תואמות"); return; }
                    setPwLoading(true);
                    try {
                      const r = await fetch("/api/app-auth/change-password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
                        credentials: "include",
                      });
                      const data = await r.json();
                      if (!r.ok) throw new Error(data.error || "שגיאה");
                      toast.success("הסיסמה שונתה בהצלחה");
                      setCurrentPw(""); setNewPw(""); setConfirmPw("");
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : "שגיאה בשינוי סיסמה");
                    } finally {
                      setPwLoading(false);
                    }
                  }}
                >
                  {pwLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" /> שנה סיסמה</>}
                </Button>
                {newPw && confirmPw && newPw !== confirmPw && (
                  <p className="text-xs text-destructive text-center">הסיסמאות אינן תואמות</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── BULK EMAIL SECTION ── */}
        {activeSection === "email" && (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="w-5 h-5 text-indigo-500" />
                  שליחת מייל לכל הרשומים
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  ⚠️ המייל ישלח לכל המשתמשים הרשומים עם כתובת מייל. ניתן להשתמש ב-<code className="bg-amber-100 px-1 rounded">&#123;&#123;name&#125;&#125;</code> בגוף המייל כדי להוסיף את שם המשתמש.
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">נושא המייל</label>
                  <Input
                    placeholder="לדוגמה: עדכון חשוב מ-DXF AI ✨"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="text-right"
                    dir="rtl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">גוף המייל (HTML מותר)</label>
                  <textarea
                    className="w-full min-h-[200px] rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y font-mono"
                    placeholder={`<p>שלום {{name}},</p>\n<p>יש לנו חדשות מרגשות עבורך!</p>`}
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    dir="ltr"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!emailSubject.trim() || !emailBody.trim() || emailSending}
                    onClick={() => {
                      if (!confirm("לשלוח מייל בדיקה למשתמש הראשון בלבד?")) return;
                      setEmailSending(true);
                      sendBulkEmailMutation.mutate({ subject: emailSubject, htmlBody: emailBody, plainText: emailPlainText, testOnly: true });
                    }}
                    className="gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    שלח בדיקה (משתמש אחד)
                  </Button>

                  <Button
                    size="sm"
                    disabled={!emailSubject.trim() || !emailBody.trim() || emailSending}
                    onClick={() => {
                      if (!confirm("לשלוח את המייל לכל המשתמשים הרשומים? פעולה זו לא ניתנת לביטול.")) return;
                      setEmailSending(true);
                      sendBulkEmailMutation.mutate({ subject: emailSubject, htmlBody: emailBody, plainText: emailPlainText, testOnly: false });
                    }}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {emailSending ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> שולח...</>
                    ) : (
                      <><Mail className="w-4 h-4" /> שלח לכולם</>
                    )}
                  </Button>
                </div>

                <div className="bg-slate-50 border rounded-lg p-3 text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-600">טיפים:</p>
                  <p>• השתמש ב-<code className="bg-slate-100 px-1 rounded">&#123;&#123;name&#125;&#125;</code> לאישיות — יוחלף בשם הפרטי של המשתמש</p>
                  <p>• ניתן להוסיף HTML כגון <code className="bg-slate-100 px-1 rounded">&lt;strong&gt;</code>, <code className="bg-slate-100 px-1 rounded">&lt;a href="..."&gt;</code>, <code className="bg-slate-100 px-1 rounded">&lt;p&gt;</code></p>
                  <p>• בדוק תמיד עם "שלח בדיקה" לפני שליחה לכולם</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── CAMPAIGN REPORT SECTION ── */}
        {activeSection === "campaign" && (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gift className="w-5 h-5 text-purple-500" />
                  דוח קמפיין מייל — מי תבע 15 אסימונים
                </CardTitle>
              </CardHeader>
              <CardContent>
                {campaignLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : !campaignData || campaignData.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Gift className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">עדיין אף אחד לא תבע את הבונוס</p>
                    <p className="text-xs mt-1">הלקוחות יופיעו כאן לאחר שילחצו על הקישור במייל</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-center">
                        <div className="text-2xl font-bold text-purple-700">{campaignData.length}</div>
                        <div className="text-xs text-purple-500">תבעו בונוס</div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-center">
                        <div className="text-2xl font-bold text-green-700">{campaignData.reduce((s, r) => s + r.tokensAwarded, 0)}</div>
                        <div className="text-xs text-green-500">אסימונים חולקו</div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-slate-500 text-right">
                            <th className="pb-2 font-medium">שם</th>
                            <th className="pb-2 font-medium">מייל</th>
                            <th className="pb-2 font-medium">קמפיין</th>
                            <th className="pb-2 font-medium">אסימונים</th>
                            <th className="pb-2 font-medium">תאריך</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {campaignData.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                              <td className="py-2 font-medium">{row.userName || '—'}</td>
                              <td className="py-2 text-slate-500 text-xs">{row.userEmail || '—'}</td>
                              <td className="py-2">
                                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">{row.campaignCode}</span>
                              </td>
                              <td className="py-2">
                                <span className="font-bold text-green-600">+{row.tokensAwarded}</span>
                              </td>
                              <td className="py-2 text-slate-400 text-xs">
                                {new Date(row.redeemedAt).toLocaleString('he-IL')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        </main>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Admin() {
  const { data: checkData, isLoading } = trpc.admin.check.useQuery();
  const [forceShow, setForceShow] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAuthenticated = checkData?.authenticated || forceShow;

  if (!isAuthenticated) {
    return <LoginScreen onSuccess={() => setForceShow(true)} />;
  }

  return <Dashboard onLogout={() => setForceShow(false)} />;
}
