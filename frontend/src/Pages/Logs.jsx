import { API_URL } from '../utils/api'
import { useEffect, useState } from "react"
import { isTokenValido, fetchAutenticado } from "../utils/auth"

function Logs() {

  const [logs, setLogs] = useState([])
  const [carregando, setCarregando] = useState(true)

  async function carregarLogs() {
    if (!isTokenValido()) { window.location.replace("/login"); return }
    setCarregando(true)
    try {
      const response = await fetchAutenticado(`${API_URL}/api/logs`)
      const data = await response.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch {
      setLogs([])
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregarLogs() }, [])

  function formatarData(iso) {
    if (!iso) return "—"
    const d = new Date(iso)
    return d.toLocaleString("pt-PT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    })
  }

  return (
    <div style={{ background: "#F4F9F8", minHeight: "calc(100vh - 68px)" }}>

      {/* Header */}
      <div style={lgS.pageHead}>
        <div style={lgS.pageHeadInner}>
          <div>
            <div style={lgS.pageHeadLabel}>ADMINISTRAÇÃO</div>
            <h1 style={lgS.pageTitle}>Logs do Configurador</h1>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={lgS.statChip}>
              <span style={lgS.statNum}>{logs.length}</span>
              <span style={lgS.statLabel}>Total</span>
            </div>
            <button style={lgS.refreshBtn} onClick={carregarLogs}>
              ↻ ATUALIZAR
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div style={lgS.tableSection}>
        <div style={lgS.tableBar}>PROMPTS REGISTADOS</div>
        <div style={{ background: "#fff", borderRadius: "0 0 8px 8px", overflow: "hidden", border: "1.5px solid #DDE8E7", borderTop: "none" }}>
          {carregando ? (
            <div style={{ padding: 32, textAlign: "center", color: "#9BAFAD", fontSize: 14 }}>A carregar...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#9BAFAD", fontSize: 14 }}>Nenhum log registado.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Prompt</th>
                  <th style={{ width: 180 }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ color: "#9BAFAD", fontWeight: 400, fontSize: 12 }}>{log.id}</td>
                    <td style={{ color: "#013634", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: 700 }}>
                      {log.texto_prompt}
                    </td>
                    <td style={{ color: "#5A7472", fontSize: 12, whiteSpace: "nowrap" }}>
                      {formatarData(log.criado_em)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  )

}

const lgS = {
  pageHead: { background: "#013634", padding: "28px 0 24px" },
  pageHeadInner: { maxWidth: 1200, margin: "0 auto", padding: "0 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
  pageHeadLabel: { fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  pageTitle: { fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: -0.3, margin: 0 },
  statChip: { display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 16px" },
  statNum: { fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 },
  refreshBtn: { background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 900, padding: "10px 20px", letterSpacing: 1, fontFamily: "'Spartan MB', sans-serif" },
  tableSection: { maxWidth: 1200, margin: "0 auto", padding: "28px 32px 64px" },
  tableBar: { background: "#013634", color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 800, letterSpacing: 2, padding: "9px 16px", borderRadius: "8px 8px 0 0" },
}

export default Logs
