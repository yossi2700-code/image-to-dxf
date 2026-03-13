import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Coins,
  Plus,
  Minus,
  Clock,
  MessageCircle,
  Zap,
  Image,
  Scan,
  Wand2,
  RefreshCw,
} from "lucide-react";

const WHATSAPP_NUMBER = "972501234567"; // Replace with actual number
const WHATSAPP_MSG_HE = "שלום, אני מעוניין/ת לרכוש אסימונים לאפליקציית ממיר תמונה ל-DXF";
const WHATSAPP_MSG_EN = "Hello, I would like to purchase tokens for the Image to DXF app";

type Transaction = {
  id: number;
  amount: number;
  reason: string;
  description: string | null;
  balanceAfter: number;
  createdAt: Date;
};

function reasonLabel(reason: string, isRtl: boolean): string {
  const map: Record<string, [string, string]> = {
    ai_generate: ["יצירת AI", "AI Generate"],
    ai_trace: ["AI Outline", "AI Outline"],
    ai_refine: ["תיקון AI", "AI Refine"],
    admin_add: ["הוספה ע\"י מנהל", "Added by Admin"],
    signup_bonus: ["בונוס הרשמה", "Signup Bonus"],
    convert: ["המרה", "Convert"],
  };
  const pair = map[reason];
  if (pair) return isRtl ? pair[0] : pair[1];
  return reason;
}

function reasonIcon(reason: string) {
  if (reason === "ai_generate") return <Image className="w-3.5 h-3.5" />;
  if (reason === "ai_trace") return <Scan className="w-3.5 h-3.5" />;
  if (reason === "ai_refine") return <Wand2 className="w-3.5 h-3.5" />;
  if (reason === "admin_add" || reason === "signup_bonus") return <Plus className="w-3.5 h-3.5" />;
  return <Zap className="w-3.5 h-3.5" />;
}

export default function Tokens() {
  const { isRtl, language } = useLanguage();
  const [, navigate] = useLocation();

  const { data: balanceData, isLoading: balanceLoading, refetch } = trpc.tokens.balance.useQuery();
  const { data: history, isLoading: historyLoading } = trpc.tokens.history.useQuery();

  const balance = balanceData?.balance ?? 0;
  const loggedIn = balanceData?.loggedIn ?? false;

  const whatsappMsg = language === "he" ? WHATSAPP_MSG_HE : WHATSAPP_MSG_EN;
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMsg)}`;

  // Cost table
  const costs = [
    { action: isRtl ? "יצירת AI (3 תמונות)" : "AI Generate (3 images)", cost: 3, icon: <Image className="w-4 h-4 text-purple-500" /> },
    { action: isRtl ? "AI Outline (3 ווריאציות)" : "AI Outline (3 variations)", cost: 5, icon: <Scan className="w-4 h-4 text-blue-500" /> },
    { action: isRtl ? "תיקון AI" : "AI Refine", cost: 2, icon: <Wand2 className="w-4 h-4 text-green-500" /> },
    { action: isRtl ? "המרת תמונה (העלאה)" : "Image Upload (Convert)", cost: 0, icon: <Zap className="w-4 h-4 text-yellow-500" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-1.5 text-muted-foreground"
          >
            {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {isRtl ? "חזרה" : "Back"}
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-bold leading-tight">
              {isRtl ? "ניהול אסימונים" : "Token Management"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isRtl ? "יתרה, היסטוריה ורכישה" : "Balance, history & purchase"}
            </p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto space-y-5">
        {/* Balance Card */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-blue-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {isRtl ? "יתרת אסימונים" : "Token Balance"}
                  </p>
                  {balanceLoading ? (
                    <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                  ) : (
                    <p className="text-3xl font-bold text-primary">{balance.toLocaleString()}</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refetch()}
                className="text-muted-foreground"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {!loggedIn && (
              <div className="text-sm text-muted-foreground bg-white/60 rounded-lg p-3 text-center">
                {isRtl ? "יש להתחבר כדי לראות את היתרה" : "Please sign in to view your balance"}
              </div>
            )}

            {loggedIn && balance < 5 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <p className="font-semibold">
                  {isRtl ? "⚠️ יתרה נמוכה" : "⚠️ Low Balance"}
                </p>
                <p className="text-xs mt-0.5">
                  {isRtl
                    ? "יש לך פחות מ-5 אסימונים. כדי להמשיך להשתמש בתכונות AI, רכוש אסימונים נוספים."
                    : "You have fewer than 5 tokens. Purchase more to continue using AI features."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purchase CTA */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800 text-sm">
                  {isRtl ? "רכישת אסימונים" : "Purchase Tokens"}
                </h3>
                <p className="text-xs text-green-700 mt-1">
                  {isRtl
                    ? "יש לטעון אסימונים להמשך שימוש בתכונה"
                    : "Purchase tokens to continue using the app"}
                </p>
                <a
                  href="/buy"
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <Coins className="w-4 h-4" />
                  {isRtl ? "לרכישת אסימונים" : "Buy Tokens"}
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Token Costs */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {isRtl ? "עלות לפעולה" : "Cost per Action"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {costs.map((c) => (
                <div key={c.action} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2 text-sm">
                    {c.icon}
                    <span>{c.action}</span>
                  </div>
                  <Badge variant={c.cost === 0 ? "secondary" : "outline"} className="font-mono text-xs">
                    {c.cost === 0
                      ? (isRtl ? "חינם" : "Free")
                      : `${c.cost} ${isRtl ? "אסימונים" : "tokens"}`}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              {isRtl ? "היסטוריית עסקאות" : "Transaction History"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {!loggedIn ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isRtl ? "יש להתחבר כדי לראות את ההיסטוריה" : "Please sign in to view history"}
              </p>
            ) : historyLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : !history || history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isRtl ? "אין עסקאות עדיין" : "No transactions yet"}
              </p>
            ) : (
              <div className="space-y-1">
                {(history as Transaction[]).map((tx) => {
                  const isDebit = tx.amount < 0;
                  const date = new Date(tx.createdAt).toLocaleString(
                    language === "he" ? "he-IL" : "en-US",
                    { dateStyle: "short", timeStyle: "short" }
                  );
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2 border-b last:border-0 gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          isDebit ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"
                        }`}>
                          {isDebit ? <Minus className="w-3.5 h-3.5" /> : reasonIcon(tx.reason)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{reasonLabel(tx.reason, isRtl)}</p>
                          <p className="text-xs text-muted-foreground">{date}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isDebit ? "text-red-600" : "text-green-600"}`}>
                          {isDebit ? "" : "+"}{tx.amount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isRtl ? "יתרה:" : "Bal:"} {tx.balanceAfter}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
