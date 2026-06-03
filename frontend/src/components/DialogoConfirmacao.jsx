import Popup from "./Popup"
import "./components_css/Popup.css"

const btnStyle = {
  base: { border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 900, padding: "10px 20px", letterSpacing: 1.2, fontFamily: "'Spartan MB', sans-serif" },
}

export default function DialogoConfirmacao({ isOpen, titulo, mensagem, mensagemBold, labelConfirmar, corConfirmar = "#C0392B", onConfirmar, onCancelar }) {
  if (!isOpen) return null
  return (
    <Popup titulo={titulo} onClose={onCancelar}>
      {mensagemBold && <p style={{ fontSize: 14, color: "#C0392B", fontWeight: 700 }}>{mensagemBold}</p>}
      {mensagem && <p style={{ fontSize: 14, color: "#5A7472" }}>{mensagem}</p>}
      <div className="popup-buttons">
        <button style={{ ...btnStyle.base, background: corConfirmar, color: "#fff" }} onClick={onConfirmar}>
          {labelConfirmar}
        </button>
        <button className="btn-ghost" onClick={onCancelar}>Cancelar</button>
      </div>
    </Popup>
  )
}
