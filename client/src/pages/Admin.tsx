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

// ─── Dashboard ────────────────────────────────────────────────────────────────
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

  const [activeSection, setActiveSection] = useState<"overview" | "activity" | "users" | "consents" | "payments" | "settings">("overview");

  const { data: consentData, isLoading: consentLoading } = trpc.admin.consentRecords.useQuery(
    undefined,
    { enabled: activeSection === "consents" }
  );

  const { data: paypalOrdersData, isLoading: paypalOrdersLoading } = trpc.admin.paypalOrders.useQuery(
    undefined,
    { enabled: activeSection === "payments" }
  );
  const { data: packagePricesData, isLoading: packagePricesLoading, refetch: refetchPrices } = trpc.admin.getPackagePrices.useQuery(
    undefined,
    { enabled: activeSection === "payments" }
  );
  const updatePriceMutation = trpc.admin.updatePackagePrice.useMutation({
    onSuccess: () => { toast.success("מחיר עודכן בהצלחה!"); refetchPrices(); setEditingPriceId(null); },
    onError: (e) => toast.error("שגיאה: " + e.message),
  });
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<string, Record<string, string | boolean>>>({});
  const ALL_CURRENCIES = ["USD", "EUR", "ILS", "GBP", "AUD", "CAD", "JPY"] as const;
  // ── Settings state ───
  const [settingsName, setSettingsName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

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
              { id: "consents", label: "הסכמות", icon: CheckCircle2 },
              { id: "payments", label: "תשלומי PayPal", icon: CreditCard },
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
          <div className="flex bg-white rounded-xl border shadow-sm p-1 gap-1">
            {([
              { id: "overview", label: "סקירה", icon: TrendingUp },
              { id: "activity", label: "פעילות", icon: Activity },
              { id: "users", label: "משתמשים", icon: Users },
              { id: "consents", label: "הסכמות", icon: CheckCircle2 },
              { id: "payments", label: "PayPal", icon: CreditCard },
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard icon={TrendingUp} label="השבוע" value={stats.thisWeek} sub="7 ימים אחרונים" />
              <StatCard icon={Calendar} label="החודש" value={stats.thisMonth} sub="30 ימים אחרונים" />
              <StatCard icon={Clock} label="סה״כ קווים שנוצרו" value={stats.totalSegments.toLocaleString()} sub="קטעי וקטור" />
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                פעולות אחרונות (כל המשתמשים)
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
                              <img src={ev.imageUrl} alt="" className="w-10 h-10 object-cover rounded border" />
                            ) : (
                              <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center">
                                <Upload className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                              ev.type === "convert" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                            }`}>
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
                <div className="py-8 text-center text-muted-foreground text-sm">אין פעולות עדיין.</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── USERS SECTION ── */}
        {activeSection === "users" && <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              משתמשים רשומים
              {registeredUsers && (
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {registeredUsers.length} משתמשים
                </span>
              )}
              <button
                className="mr-auto text-muted-foreground hover:text-primary transition-colors"
                onClick={() => refetchUsers()}
                title="רענן נתונים"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : registeredUsers && registeredUsers.length > 0 ? (
              <div className="space-y-2">
                {registeredUsers.map((u) => {
                  const actions = userActionsData?.filter((a) => a.appUserId === u.id) ?? [];
                  const isExpanded = expandedUser === u.id;
                  return (
                    <div key={u.id} className="border rounded-lg overflow-hidden">
                      {/* User row */}
                      <button
                        className="w-full text-right px-3 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{u.name ?? <span className="text-muted-foreground">ללא שם</span>}</span>
                            <span className="text-xs text-muted-foreground font-mono">{u.email}</span>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>נרשם: {new Date(u.createdAt).toLocaleDateString("he-IL")}</span>
                            <span>כניסה אחרונה: {new Date(u.lastLoginAt).toLocaleDateString("he-IL")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {actions.length} פעולות
                          </span>
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
                      {isExpanded && (
                        <div className="border-t bg-muted/20 px-3 py-2">
                          {actionsLoading ? (
                            <div className="h-8 bg-muted animate-pulse rounded" />
                          ) : actions.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">אין פעולות עדיין.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b">
                                  <th className="text-right py-1.5 pr-2 font-medium">סוג</th>
                                  <th className="text-right py-1.5 pr-2 font-medium">תיאור</th>
                                  <th className="text-right py-1.5 pr-2 font-medium">קווים</th>
                                  <th className="text-right py-1.5 font-medium">תאריך</th>
                                  <th className="text-right py-1.5 font-medium">DXF</th>
                                </tr>
                              </thead>
                              <tbody>
                                {actions.map((a) => (
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
                                    <td className="py-1.5 pr-2 text-muted-foreground max-w-[160px] truncate">{a.description ?? "—"}</td>
                                    <td className="py-1.5 pr-2">{(a.segmentCount ?? 0).toLocaleString()}</td>
                                    <td className="py-1.5 text-muted-foreground">{new Date(a.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}</td>
                                    <td className="py-1.5">
                                      {a.dxfUrl ? (
                                        <a href={a.dxfUrl} download className="text-primary hover:underline flex items-center gap-1">
                                          <FileCode2 className="w-3 h-3" />הורד
                                        </a>
                                      ) : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
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
            {/* Package Prices Management */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-500" />
                  ניהול מחירי חבילות
                </CardTitle>
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
                                  });
                                }}
                                disabled={updatePriceMutation.isPending}
                              >
                                {updatePriceMutation.isPending ? "שומר..." : "שמור"}
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => { setEditingPriceId(pkg.packageId); setPriceEdits(prev => ({ ...prev, [pkg.packageId]: {} })); }}>
                              ערוך מחירים
                            </Button>
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
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  תשלומי PayPal
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paypalOrdersLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">טוען...</div>
                ) : !paypalOrdersData || paypalOrdersData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    אין הזמנות PayPal עדיין
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-right">
                          <th className="pb-2 pr-2 font-medium text-muted-foreground">תאריך</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground">משתמש</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground">חבילה</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground">סכום</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground">מטבע</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground">אסימונים</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground">סטטוס</th>
                          <th className="pb-2 pr-2 font-medium text-muted-foreground">PayPal ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paypalOrdersData.map((order) => (
                          <tr key={order.id} className="border-b hover:bg-slate-50 transition-colors">
                            <td className="py-2 pr-2 text-xs text-muted-foreground">
                              {new Date(order.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                            </td>
                            <td className="py-2 pr-2">{order.appUserId}</td>
                            <td className="py-2 pr-2 font-medium">{order.packageId}</td>
                            <td className="py-2 pr-2 font-bold text-green-600">{order.priceAmount}</td>
                            <td className="py-2 pr-2 text-xs">{order.currency}</td>
                            <td className="py-2 pr-2">
                              <span className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs font-medium">
                                +{order.tokensCredited}
                              </span>
                            </td>
                            <td className="py-2 pr-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                order.status === "completed" ? "bg-green-100 text-green-700" :
                                order.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-2 pr-2 text-xs text-muted-foreground font-mono">
                              {order.paypalOrderId ? order.paypalOrderId.slice(0, 12) + "..." : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-muted-foreground mt-3 text-left">
                      סה"כ {paypalOrdersData.length} הזמנות |
                      הכנסה: {paypalOrdersData.filter(o => o.status === "completed").reduce((sum, o) => sum + parseFloat(String(o.priceAmount || 0)), 0).toFixed(2)} USD
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
