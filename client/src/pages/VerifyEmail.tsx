import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function VerifyEmail() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("קישור לא תקין — חסר טוקן אימות.");
      return;
    }

    fetch(`/api/app-auth/verify-email?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          // If server returned user data, store login flag so Home.tsx picks it up
          if (data.user) {
            localStorage.setItem("app_user_logged_in", "1");
          }
          setStatus("success");
          setMessage("המייל אומת בהצלחה! ✅");
          // Auto-redirect to home after 2 seconds
          setTimeout(() => navigate("/"), 2000);
        } else {
          setStatus("error");
          setMessage(data.error || "שגיאה באימות המייל.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("שגיאת רשת — נסה שוב.");
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f0f0ff 0%, #faf5ff 50%, #f0f9ff 100%)",
        fontFamily: "sans-serif",
        direction: "rtl",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "48px 40px",
          maxWidth: "420px",
          width: "90%",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(99,102,241,0.12)",
          border: "1px solid #e8eaf0",
        }}
      >
        {status === "loading" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏳</div>
            <h2 style={{ color: "#1e1b4b", marginBottom: "8px" }}>מאמת את המייל...</h2>
            <p style={{ color: "#6b7280" }}>אנא המתן</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>🎉</div>
            <h2 style={{ color: "#1e1b4b", marginBottom: "8px" }}>המייל אומת בהצלחה!</h2>
            <p style={{ color: "#6b7280", marginBottom: "8px" }}>
              החשבון שלך מאומת ואתה מחובר. מעביר אותך לאתר...
            </p>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>
              (מועבר אוטומטית תוך שניה)
            </p>
            <button
              onClick={() => navigate("/")}
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                border: "none",
                borderRadius: "50px",
                padding: "12px 32px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🚀 עבור לאתר עכשיו
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>❌</div>
            <h2 style={{ color: "#dc2626", marginBottom: "8px" }}>שגיאה באימות</h2>
            <p style={{ color: "#6b7280", marginBottom: "24px" }}>{message}</p>
            <button
              onClick={() => navigate("/")}
              style={{
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: "50px",
                padding: "12px 32px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              חזור לאתר
            </button>
          </>
        )}
      </div>
    </div>
  );
}
