/**
 * AdminTracking.tsx — Dedicated admin page for user tracking
 * Shows all registered users + per-user click event history as a timeline
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Users,
  MousePointerClick,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  Clock,
  Mail,
  Coins,
  Chrome,
  Activity,
  ArrowLeft,
  Filter,
  LayoutGrid,
  Navigation,
  Wand2,
  Download,
  LogIn,
  ShoppingCart,
  History,
  User,
  Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(d: Date | string | null | undefined) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

// ─── Action config — icon + color + Hebrew label ──────────────────────────────
type ActionConfig = { label: string; color: string; bg: string; icon: React.ReactNode };

function getActionConfig(action: string): ActionConfig {
  const map: Record<string, ActionConfig> = {
    // Tab switches
    tab_switch_ai:       { label: "עבר ל: AI Create",       color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200",  icon: <Wand2 className="w-3 h-3" /> },
    tab_switch_trace:    { label: "עבר ל: תמונה לקווים",    color: "text-teal-700",   bg: "bg-teal-50 border-teal-200",      icon: <Layers className="w-3 h-3" /> },
    tab_switch_face:     { label: "עבר ל: פורטרט",          color: "text-purple-700", bg: "bg-purple-50 border-purple-200",  icon: <User className="w-3 h-3" /> },
    "tab_switch_cnc-relief": { label: "עבר ל: CNC Relief",  color: "text-orange-700", bg: "bg-orange-50 border-orange-200",  icon: <Layers className="w-3 h-3" /> },
    tab_switch_redraw:   { label: "עבר ל: Document Redraw", color: "text-cyan-700",   bg: "bg-cyan-50 border-cyan-200",      icon: <Layers className="w-3 h-3" /> },
    // Nav
    nav_account:         { label: "ניווט: אזור אישי",       color: "text-violet-700", bg: "bg-violet-50 border-violet-200",  icon: <User className="w-3 h-3" /> },
    nav_history:         { label: "ניווט: היסטוריה",        color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",      icon: <History className="w-3 h-3" /> },
    nav_buy:             { label: "ניווט: קנה קרדיטים",     color: "text-green-700",  bg: "bg-green-50 border-green-200",    icon: <ShoppingCart className="w-3 h-3" /> },
    nav_pricing:         { label: "פתח מחירון",             color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200",  icon: <ShoppingCart className="w-3 h-3" /> },
    open_auth_dialog:    { label: "פתח דיאלוג התחברות",     color: "text-rose-700",   bg: "bg-rose-50 border-rose-200",      icon: <LogIn className="w-3 h-3" /> },
    // Actions
    btn_convert:         { label: "לחץ: המר תמונה",         color: "text-teal-700",   bg: "bg-teal-50 border-teal-200",      icon: <Wand2 className="w-3 h-3" /> },
    btn_ai_generate:     { label: "לחץ: צור 3 עיצובים",     color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200",  icon: <Wand2 className="w-3 h-3" /> },
    btn_portrait_detect: { label: "לחץ: צור פורטרט",        color: "text-purple-700", bg: "bg-purple-50 border-purple-200",  icon: <User className="w-3 h-3" /> },
    btn_download_dxf:    { label: "לחץ: הורד DXF",          color: "text-green-700",  bg: "bg-green-50 border-green-200",    icon: <Download className="w-3 h-3" /> },
    btn_download_svg:    { label: "לחץ: הורד SVG",          color: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200",icon: <Download className="w-3 h-3" /> },
    btn_buy_credits:     { label: "לחץ: קנה קרדיטים",       color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",    icon: <ShoppingCart className="w-3 h-3" /> },
    btn_refine:          { label: "לחץ: שפר ציור",          color: "text-orange-700", bg: "bg-orange-50 border-orange-200",  icon: <Wand2 className="w-3 h-3" /> },
  };
  return map[action] ?? {
    label: action,
    color: "text-gray-600",
    bg: "bg-gray-50 border-gray-200",
    icon: <MousePointerClick className="w-3 h-3" />,
  };
}

// ─── Timeline dot ─────────────────────────────────────────────────────────────
function TimelineDot({ action }: { action: string }) {
  const cfg = getActionConfig(action);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── User Row with expandable timeline ────────────────────────────────────────
function UserRow({ user }: {
  user: {
    id: number;
    name: string | null;
    email: string;
    googleId: string | null;
    tokenBalance: number;
    createdAt: Date;
    lastLoginAt: Date;
    clickCount: number;
    lastClickAt: Date | null;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const [actionFilter, setActionFilter] = useState("");

  const { data: clicks, isLoading: clicksLoading } = trpc.tracking.adminUserClicks.useQuery(
    { userId: user.id, limit: 500 },
    { enabled: expanded }
  );

  const filteredClicks = clicks?.filter(c =>
    !actionFilter || c.action.toLowerCase().includes(actionFilter.toLowerCase()) ||
    (c.label ?? "").toLowerCase().includes(actionFilter.toLowerCase())
  );

  const isGoogle = !!user.googleId;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* User header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
          style={{ background: isGoogle ? 'linear-gradient(135deg, #4285F4, #34A853)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          {(user.name ?? user.email)[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm truncate">{user.name ?? "—"}</span>
            {isGoogle && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600 border border-blue-200">
                <Chrome className="w-3 h-3" /> Google
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate">{user.email}</div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 shrink-0">
          <div className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-yellow-500" />
            <span className="font-medium text-gray-700">{user.tokenBalance}</span>
          </div>
          <div className="flex items-center gap-1">
            <MousePointerClick className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium text-indigo-600">{user.clickCount ?? 0}</span>
            <span className="text-gray-400">פעולות</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>{timeAgo(user.lastLoginAt)}</span>
          </div>
        </div>
        <div className="shrink-0 text-gray-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded timeline */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          {/* User meta */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-3 pb-3 border-b border-gray-200">
            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{user.email}</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />נרשם: {formatDate(user.createdAt)}</span>
            <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5" />כניסה אחרונה: {formatDate(user.lastLoginAt)}</span>
            <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-yellow-500" />{user.tokenBalance} קרדיטים</span>
            <span className="flex items-center gap-1"><MousePointerClick className="w-3.5 h-3.5 text-indigo-500" />{user.clickCount ?? 0} פעולות</span>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="סנן לפי פעולה..."
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 w-48"
            />
            {actionFilter && <button onClick={() => setActionFilter("")} className="text-xs text-gray-400 hover:text-gray-600">✕</button>}
          </div>

          {/* Timeline */}
          {clicksLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
              טוען מסע משתמש...
            </div>
          ) : !filteredClicks || filteredClicks.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">
              {actionFilter ? "אין פעולות מסוג זה" : "אין פעולות רשומות עדיין"}
            </div>
          ) : (
            <div className="relative max-h-80 overflow-y-auto pr-1">
              {/* Vertical line */}
              <div className="absolute right-3 top-0 bottom-0 w-px bg-gray-200" />
              <div className="space-y-2 pr-8">
                {filteredClicks.map((click, i) => (
                  <div key={click.id} className="relative">
                    {/* Dot on timeline */}
                    <div className="absolute -right-5 top-2 w-2 h-2 rounded-full bg-indigo-400 border-2 border-white" />
                    <div className="flex items-start gap-2 bg-white rounded-lg border border-gray-100 px-3 py-2 hover:border-indigo-200 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <TimelineDot action={click.action} />
                          {click.metadata && (
                            <span className="text-xs text-gray-500 truncate max-w-[200px]">{click.metadata}</span>
                          )}
                        </div>
                        {click.page && (
                          <div className="text-xs text-gray-400 mt-0.5">📍 {click.page}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 shrink-0 mt-0.5">{formatDate(click.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main AdminTracking Page ──────────────────────────────────────────────────
export default function AdminTracking() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "feed">("users");

  const { data: authCheck } = trpc.admin.check.useQuery();
  const isAdmin = authCheck?.authenticated;

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = trpc.tracking.adminUsers.useQuery(
    undefined,
    { enabled: !!isAdmin }
  );

  const { data: allClicks, isLoading: feedLoading, refetch: refetchFeed } = trpc.tracking.adminAllClicks.useQuery(
    { limit: 300 },
    { enabled: !!isAdmin && activeTab === "feed" }
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-600 mb-4">גישה מוגבלת — נדרשת כניסת מנהל</p>
          <button onClick={() => navigate("/admin")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            כניסת מנהל
          </button>
        </div>
      </div>
    );
  }

  const filteredUsers = users?.filter(u => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (u.name ?? "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  }) ?? [];

  const totalClicks = users?.reduce((s, u) => s + (u.clickCount ?? 0), 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/admin")}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-indigo-500" />
              מעקב פעולות משתמשים
            </h1>
            <p className="text-xs text-gray-500">כל לחיצה, מעבר טאב, וניווט — בזמן אמת</p>
          </div>
          <button onClick={() => { refetchUsers(); refetchFeed(); }}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-0">
          {[
            { id: "users", icon: Users, label: `משתמשים (${users?.length ?? 0})` },
            { id: "feed", icon: Activity, label: "פיד פעולות" },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id}
              onClick={() => setActiveTab(id as "users" | "feed")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === id ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: "משתמשים רשומים", value: users?.length ?? 0, color: "text-indigo-600", bg: "bg-indigo-50" },
            { icon: MousePointerClick, label: "סה\"כ פעולות", value: totalClicks, color: "text-purple-600", bg: "bg-purple-50" },
            { icon: Activity, label: "משתמשים פעילים", value: users?.filter(u => (u.clickCount ?? 0) > 0).length ?? 0, color: "text-green-600", bg: "bg-green-50" },
            { icon: Navigation, label: "ממוצע פעולות", value: users?.length ? Math.round(totalClicks / users.length) : 0, color: "text-teal-600", bg: "bg-teal-50" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-3 flex items-center gap-3`}>
              <Icon className={`w-5 h-5 ${color} shrink-0`} />
              <div>
                <div className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">מה נרשם:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { action: "tab_switch_ai", label: "מעבר טאב" },
              { action: "nav_history", label: "ניווט לדף" },
              { action: "btn_convert", label: "לחיצת כפתור" },
              { action: "btn_ai_generate", label: "יצירת AI" },
              { action: "btn_download_dxf", label: "הורדה" },
              { action: "open_auth_dialog", label: "פתיחת התחברות" },
            ].map(({ action, label }) => (
              <TimelineDot key={action} action={action} />
            ))}
          </div>
        </div>

        {/* Users tab */}
        {activeTab === "users" && (
          <>
            <div className="relative mb-4">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input type="text" placeholder="חפש לפי שם או מייל..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pr-9 text-sm bg-white" dir="rtl" />
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                טוען משתמשים...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>לא נמצאו משתמשים</p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400 mb-3">
                  {filteredUsers.length} משתמשים — לחץ על שורה לתצוגת מסע המשתמש
                </p>
                {filteredUsers.map(user => (
                  <UserRow key={user.id} user={user} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Feed tab */}
        {activeTab === "feed" && (
          <div>
            <p className="text-xs text-gray-400 mb-3">300 הפעולות האחרונות מכל המשתמשים — בסדר כרונולוגי הפוך</p>
            {feedLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                טוען...
              </div>
            ) : !allClicks || allClicks.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <MousePointerClick className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>אין פעולות רשומות עדיין</p>
                <p className="text-xs mt-1">פעולות יתחילו להופיע כאן לאחר שמשתמשים ישתמשו באפליקציה</p>
                <p className="text-xs mt-1 text-indigo-500">💡 יש לפרסם את האתר (Publish) כדי שהמעקב יפעל על הגרסה החיה</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allClicks.map(click => {
                  const cfg = getActionConfig(click.action);
                  return (
                    <div key={click.id}
                      className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-indigo-200 transition-colors shadow-sm">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                        {(click.userName ?? click.userEmail ?? "?")[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-800 text-xs">{click.userName ?? click.userEmail ?? "אנונימי"}</span>
                          {click.page && <span className="text-gray-400 text-xs hidden sm:block">📍 {click.page}</span>}
                        </div>
                        {click.metadata && <div className="text-xs text-gray-500 truncate">{click.metadata}</div>}
                      </div>
                      <TimelineDot action={click.action} />
                      <span className="text-xs text-gray-400 shrink-0">{timeAgo(click.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
