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
    </div>
  )
}
