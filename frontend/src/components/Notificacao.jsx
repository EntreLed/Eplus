import { useEffect } from "react"
import "./components_css/Notificacao.css"

export default function Notificacao({ mensagem, tipo, onClose }) {
  useEffect(() => {
    if (!mensagem) return
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [mensagem, onClose])

  if (!mensagem) return null

  return (
    <div className={`toast toast--${tipo}`}>
      <span>{mensagem}</span>
      <button className="toast__fechar" onClick={onClose}>✕</button>
    </div>
  )
}
