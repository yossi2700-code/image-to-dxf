/**
 * AdminTracking.tsx — Dedicated admin page for user tracking
 * Shows all registered users + per-user click event history
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
  User,
  Coins,
  Chrome,
  Activity,
  ArrowLeft,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

// Action label map for display
const ACTION_LABELS: Record<string, string> = {
  btn_convert: "המר תמונה",
  btn_download_dxf: "הורד DXF",
  btn_download_svg: "הורד SVG",
  btn_ai_generate: "צור 3 עיצובים (AI)",
  btn_portrait_detect: "צור פורטרט",
  btn_buy_credits: "קנה קרדיטים",
  btn_refine: "שפר ציור",
  btn_precision_redraw: "דייק ציור",
  btn_suggestion_chip: "הצעת שיפור",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

// Color badge for action type
function ActionBadge({ action }: { action: string }) {
  const colorMap: Record<string, string> = {
    btn_convert: "bg-blue-100 text-blue-700",
    btn_download_dxf: "bg-green-100 text-green-700",
    btn_download_svg: "bg-teal-100 text-teal-700",
    btn_ai_generate: "bg-purple-100 text-purple-700",
    btn_portrait_detect: "bg-pink-100 text-pink-700",
    btn_buy_credits: "bg-yellow-100 text-yellow-700",
    btn_refine: "bg-orange-100 text-orange-700",
    btn_precision_redraw: "bg-cyan-100 text-cyan-700",
  };
  const cls = colorMap[action] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {actionLabel(action)}
    </span>
  );
}

// ─── User Row with expandable click history ───────────────────────────────────
function UserRow({ user, searchTerm }: {
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
  searchTerm: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actionFilter, setActionFilter] = useState("");

  const { data: clicks, isLoading: clicksLoading } = trpc.tracking.adminUserClicks.useQuery(
    { userId: user.id, limit: 500 },
    { enabled: expanded }
  );

  const filteredClicks = clicks?.filter(c =>
    !actionFilter || c.action.includes(actionFilter)
  );

  const isGoogle = !!user.googleId;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* User header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
          style={{ background: isGoogle ? 'linear-gradient(135deg, #4285F4, #34A853)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          {(user.name ?? user.email)[0]?.toUpperCase() ?? "?"}
        </div>

        {/* Name + email */}
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

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 shrink-0">
          <div className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-yellow-500" />
            <span className="font-medium text-gray-700">{user.tokenBalance}</span>
          </div>
          <div className="flex items-center gap-1">
            <MousePointerClick className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium text-indigo-600">{user.clickCount ?? 0}</span>
            <span className="text-gray-400">לחיצות</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>{timeAgo(user.lastLoginAt)}</span>
          </div>
        </div>

        {/* Expand icon */}
        <div className="shrink-0 text-gray-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded click history */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          {/* User details row */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-3 pb-3 border-b border-gray-200">
            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{user.email}</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />נרשם: {formatDate(user.createdAt)}</span>
            <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5" />כניסה אחרונה: {formatDate(user.lastLoginAt)}</span>
            <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-yellow-500" />{user.tokenBalance} קרדיטים</span>
            <span className="flex items-center gap-1"><MousePointerClick className="w-3.5 h-3.5 text-indigo-500" />{user.clickCount ?? 0} לחיצות סה"כ</span>
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
            {actionFilter && (
              <button onClick={() => setActionFilter("")} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>

          {/* Click list */}
          {clicksLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
              טוען היסטוריית לחיצות...
            </div>
          ) : !filteredClicks || filteredClicks.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">
              {actionFilter ? "אין לחיצות מסוג זה" : "אין לחיצות רשומות עדיין"}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {filteredClicks.map(click => (
                <div key={click.id}
                  className="flex items-start gap-3 px-3 py-2 bg-white rounded-lg border border-gray-100 text-xs hover:border-indigo-200 transition-colors">
                  {/* Action badge */}
                  <div className="shrink-0 mt-0.5">
                    <ActionBadge action={click.action} />
                  </div>
                  {/* Page */}
                  {click.page && (
                    <span className="text-gray-400 shrink-0 mt-0.5 hidden sm:block">{click.page}</span>
                  )}
                  {/* Metadata */}
                  {click.metadata && (
                    <span className="text-gray-500 truncate flex-1">{click.metadata}</span>
                  )}
                  {/* Timestamp */}
                  <span className="text-gray-400 shrink-0 ml-auto">{formatDate(click.createdAt)}</span>
                </div>
              ))}
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

  // Check admin auth
  const { data: authCheck } = trpc.admin.check.useQuery();
  const isAdmin = authCheck?.authenticated;

  // Users list with click counts
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = trpc.tracking.adminUsers.useQuery(
    undefined,
    { enabled: !!isAdmin }
  );

  // Global click feed
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
          <Button onClick={() => navigate("/admin")}>כניסת מנהל</Button>
        </div>
      </div>
    );
  }

  // Filter users by search
  const filteredUsers = users?.filter(u => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (u.name ?? "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }) ?? [];

  const totalClicks = users?.reduce((s, u) => s + (u.clickCount ?? 0), 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 dir-rtl" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/admin")}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            title="חזרה לניהול"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-indigo-500" />
              מעקב משתמשים
            </h1>
            <p className="text-xs text-gray-500">רשימת משתמשים + היסטוריית לחיצות</p>
          </div>
          <button
            onClick={() => { refetchUsers(); refetchFeed(); }}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            title="רענן"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-0">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "users" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Users className="w-4 h-4 inline ml-1.5" />
            משתמשים ({users?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("feed")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "feed" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Activity className="w-4 h-4 inline ml-1.5" />
            פיד לחיצות
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: "משתמשים רשומים", value: users?.length ?? 0, color: "text-indigo-600", bg: "bg-indigo-50" },
            { icon: MousePointerClick, label: "סה\"כ לחיצות", value: totalClicks, color: "text-purple-600", bg: "bg-purple-50" },
            { icon: Activity, label: "משתמשים פעילים", value: users?.filter(u => (u.clickCount ?? 0) > 0).length ?? 0, color: "text-green-600", bg: "bg-green-50" },
            { icon: Coins, label: "ממוצע קרדיטים", value: users?.length ? Math.round(users.reduce((s, u) => s + u.tokenBalance, 0) / users.length) : 0, color: "text-yellow-600", bg: "bg-yellow-50" },
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

        {/* Users tab */}
        {activeTab === "users" && (
          <>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="חפש לפי שם או מייל..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pr-9 text-sm bg-white"
                dir="rtl"
              />
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
                  {filteredUsers.length} משתמשים — לחץ על שורה להצגת היסטוריית לחיצות
                </p>
                {filteredUsers.map(user => (
                  <UserRow key={user.id} user={user} searchTerm={searchTerm} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Feed tab — global click stream */}
        {activeTab === "feed" && (
          <div>
            <p className="text-xs text-gray-400 mb-3">300 הלחיצות האחרונות מכל המשתמשים</p>
            {feedLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                טוען...
              </div>
            ) : !allClicks || allClicks.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <MousePointerClick className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>אין לחיצות רשומות עדיין</p>
                <p className="text-xs mt-1">לחיצות יתחילו להופיע כאן לאחר שמשתמשים ישתמשו באפליקציה</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allClicks.map(click => (
                  <div key={click.id}
                    className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm hover:border-indigo-200 transition-colors shadow-sm">
                    {/* User avatar */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      {(click.userName ?? click.userEmail ?? "?")[0]?.toUpperCase() ?? "?"}
                    </div>
                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800 text-xs">{click.userName ?? click.userEmail ?? "אנונימי"}</span>
                        {click.userEmail && click.userName && (
                          <span className="text-gray-400 text-xs hidden sm:block">{click.userEmail}</span>
                        )}
                      </div>
                      {click.page && <div className="text-xs text-gray-400">{click.page}</div>}
                    </div>
                    {/* Action */}
                    <ActionBadge action={click.action} />
                    {/* Time */}
                    <span className="text-xs text-gray-400 shrink-0">{timeAgo(click.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
