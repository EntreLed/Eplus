import { useNavigate } from "react-router-dom"

export default function Erro403() {
  const navigate = useNavigate()

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
      <h1 style={{ fontSize: "6rem", fontWeight: "bold", color: "var(--color-primary)", margin: 0, lineHeight: 1 }}>403</h1>
      <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "var(--color-dark)", margin: 0 }}>Sem permissão</h2>
      <p style={{ color: "var(--color-muted)", maxWidth: "400px" }}>
        Não tens permissão para aceder a esta página.
      </p>
      <button className="btn-primary" onClick={() => navigate("/")}>
        Voltar ao início
      </button>
    </div>
  )
}
