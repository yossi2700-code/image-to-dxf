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
  const { data: registeredUsers, isLoading: usersLoading } = trpc.admin.users.useQuery();

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
        {/* Registered Users */}
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-right py-2 pr-2 font-medium">שם</th>
                      <th className="text-right py-2 pr-2 font-medium">אימייל</th>
                      <th className="text-right py-2 font-medium">תאריך הרשמה</th>
                      <th className="text-right py-2 font-medium">כניסה אחרונה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredUsers.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-2 font-medium">{u.name ?? <span className="text-muted-foreground">ללא שם</span>}</td>
                        <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">{u.email}</td>
                        <td className="py-2 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("he-IL")}</td>
                        <td className="py-2 text-xs text-muted-foreground">{new Date(u.lastLoginAt).toLocaleDateString("he-IL")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
