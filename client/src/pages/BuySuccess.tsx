import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

interface OrderDetails {
  tokens: number;
  amount: string;
  currency: string;
  orderId: string;
  newBalance: number;
}

export default function BuySuccess() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const payerId = params.get("PayerID");

    if (!token) {
      setStatus("failed");
      return;
    }

    fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, payerId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setOrder(data);
          setStatus("success");
          setTimeout(() => setShowConfetti(true), 100);
        } else {
          setStatus("failed");
        }
      })
      .catch(() => setStatus("failed"));
  }, []);

  const confettiParticles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.5}s`,
    duration: `${1.5 + Math.random() * 2}s`,
    color: ["#3b82f6", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#f97316"][i % 6],
    size: `${6 + Math.random() * 8}px`,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-center p-4">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
          {confettiParticles.map((p) => (
            <div
              key={p.id}
              className="absolute top-0 rounded-sm"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                animation: `fall ${p.duration} ${p.delay} ease-in forwards`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pop-in {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .pop-in { animation: pop-in 0.6s ease-out forwards; }
      `}</style>

      <div className="relative z-20 max-w-md w-full">
        {status === "verifying" && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-600/30 border-2 border-blue-400/50 flex items-center justify-center">
              <svg className="animate-spin w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">{t("buySuccessVerifying")}</h1>
            <p className="text-blue-300 text-sm">{t("buySuccessProcessing")}</p>
          </div>
        )}

        {status === "success" && order && (
          <div className="text-center pop-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 border-2 border-green-400/60 flex items-center justify-center shadow-lg shadow-green-500/20">
              <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-green-300 to-emerald-200 bg-clip-text text-transparent">
              {t("buySuccessTitle")}
            </h1>
            <p className="text-blue-200 mb-8">{t("buySuccessSubtitle")}</p>

            <div className="bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-400/30 rounded-2xl p-6 mb-6 shadow-xl">
              <div className="text-6xl font-black text-white mb-1">+{order.tokens}</div>
              <div className="text-blue-200 text-sm uppercase tracking-widest">{t("buySuccessTokensAdded")}</div>

              <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-sm">
                <div className="flex justify-between text-blue-300">
                  <span>{t("buySuccessOrderId")}</span>
                  <span className="font-mono text-white text-xs">{order.orderId.slice(0, 16)}…</span>
                </div>
                <div className="flex justify-between text-blue-300">
                  <span>{t("buySuccessAmount")}</span>
                  <span className="font-semibold text-white">{order.amount} {order.currency}</span>
                </div>
                <div className="flex justify-between text-blue-300">
                  <span>{t("buySuccessNewBalance")}</span>
                  <span className="font-bold text-green-300">{order.newBalance} tokens</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate("/")}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-900/40 transition-all hover:scale-[1.02] text-lg"
            >
              🎨 {t("buySuccessStartDesigning")}
            </button>
          </div>
        )}

        {status === "failed" && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 border-2 border-red-400/50 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-3 text-red-300">{t("buySuccessFailed")}</h1>
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => navigate("/buy")}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
              >
                {t("tryAgain")}
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
              >
                {t("back")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
