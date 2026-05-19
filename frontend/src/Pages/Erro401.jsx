import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { API_URL } from "../utils/api"

export default function Erro401() {
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.removeItem("userRole")
    localStorage.removeItem("userExp")
    fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {})
    const timer = setTimeout(() => navigate("/login"), 3000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "1rem",
      padding: "2rem",
      textAlign: "center"
    }}>
      <h1 style={{ fontSize: "6rem", fontWeight: "bold", color: "var(--color-primary)", margin: 0, lineHeight: 1 }}>401</h1>
      <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "var(--color-dark)", margin: 0 }}>Sessão expirada</h2>
      <p style={{ color: "var(--color-muted)", maxWidth: "400px" }}>
        A tua sessão expirou. Serás redireccionado para o login em instantes.
      </p>
      <button className="btn-primary" onClick={() => navigate("/login")}>
        Ir para o login
      </button>
    </div>
  )
}
