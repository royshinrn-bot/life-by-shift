import { useState, useEffect } from "react"
import LifeByShift from "./LifeByShift.jsx"

export default function App() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      minHeight: "100vh",
      background: "#e0e0e0",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
    }}>
      <div style={{
        width: "390px",
        minHeight: "100vh",
        background: "#fff",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 40px rgba(0,0,0,0.15)",
      }}>
        {loading ? <SplashScreen /> : <LifeByShift />}
      </div>
    </div>
  )
}

function SplashScreen() {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "#0d1433",
      fontFamily: "-apple-system,'SF Pro Display',sans-serif",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "url(/splash.png)",
        backgroundSize: "cover",
        backgroundPosition: "center top",
      }} />

      {/* 스피너 */}
      <div style={{
        position: "absolute",
        bottom: "12%",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
      }}>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "4px solid rgba(255,255,255,0.2)",
          borderTop: "4px solid #FFD54F",
          animation: "spin 0.9s linear infinite",
        }} />
      </div>
    </div>
  )
}
