import { useState } from "react";
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
  const { data: registeredUsers, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.users.useQuery();
  const { data: userActionsData, isLoading: actionsLoading } = trpc.admin.userActions.useQuery();
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [editingLimit, setEditingLimit] = useState<number | null>(null);
  const [limitInput, setLimitInput] = useState("");

  const setUserLimitMutation = trpc.admin.setUserLimit.useMutation({
    onSuccess: () => {
      toast.success("המגבלה עודכנה בהצלחה");
      setEditingLimit(null);
      refetchUsers();
    },
    onError: (err) => toast.error(err.message ?? "שגיאה בעדכון"),
  });

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
                <span className="mr-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {registeredUsers.length} משתמשים
                </span>
              )}
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
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {actions.length} פעולות
                          </span>
                          {/* Limit badge + edit */}
                          {editingLimit === u.id ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Input
                                type="number"
                                min={0}
                                placeholder="מגבלה"
                                value={limitInput}
                                onChange={(e) => setLimitInput(e.target.value)}
                                className="w-16 h-6 text-xs px-1 py-0"
                                dir="ltr"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                className="h-6 px-2 text-xs"
                                disabled={setUserLimitMutation.isPending}
                                onClick={() => {
                                  const val = limitInput === "" ? null : parseInt(limitInput, 10);
                                  setUserLimitMutation.mutate({ userId: u.id, maxActions: val });
                                }}
                              >
                                שמור
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1 text-xs"
                                onClick={() => setEditingLimit(null)}
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <button
                              className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium hover:bg-orange-200 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLimit(u.id);
                                setLimitInput("");
                              }}
                              title="לחץ לשינוי מגבלה"
                            >
                              מגבלה: {(u as { maxActions?: number | null }).maxActions ?? 10}
                            </button>
                          )}
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
