const estilo = { padding: 32, textAlign: "center", color: "#9BAFAD", fontSize: 14 }

export default function CarregandoVazio({ loading, empty, loadingMsg = "A carregar...", emptyMsg = "Sem resultados.", children }) {
  if (loading) return <div style={estilo}>{loadingMsg}</div>
  if (empty) return <div style={estilo}>{emptyMsg}</div>
  return children
}
