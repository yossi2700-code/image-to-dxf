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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663365044246/SslVmktvndMoFSwH.png"
              alt="לוגו"
              className="w-10 h-10 rounded-lg object-contain shrink-0"
            />
            <div>
              <h1 className="text-base font-bold leading-tight">דשבורד ניהול</h1>
              <p className="text-xs text-muted-foreground">מעקב שימוש ופעילות</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { window.location.href = "/"; }}>
              חזור לאפליקציה
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="text-muted-foreground gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              יציאה
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6" dir="rtl">
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
        {/* Registered Users + Actions */}
        <Card>
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
        </Card>
      </main>
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
