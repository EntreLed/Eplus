import { useEffect, useRef, useState } from "react"
import { isTokenValido } from "../utils/auth"

import PerfilForm from "../components/forms/PerfilForm"
import FitaLedForm from "../components/forms/FitaLedForm"
import NeonForm from "../components/forms/NeonForm"
import ControladorForm from "../components/forms/ControladorForm"
import FonteAlimentacaoForm from "../components/forms/FonteAlimentacaoForm"
import AcessorioForm from "../components/forms/AcessorioForm"

import "./estilosPages/GestaoProdutos.css"

const categorias = [
  "Perfis",
  "Fitas LED",
  "Neon",
  "Controladores",
  "Power",
  "Acessórios"
]

function GestaoProdutos() {

  useEffect(() => {
    if (!isTokenValido()) window.location.replace("/login")
  }, [])

  const [categoria, setCategoria] = useState("Perfis")
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const barRef = useRef(null)
  const btnRefs = useRef({})

  useEffect(() => {
    const btn = btnRefs.current[categoria]
    const bar = barRef.current
    if (!btn || !bar) return
    const barRect = bar.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    setIndicator({ left: btnRect.left - barRect.left, width: btnRect.width })
  }, [categoria])

  function renderForm() {
    switch (categoria) {
      case "Perfis": return <PerfilForm />
      case "Fitas LED": return <FitaLedForm />
      case "Neon": return <NeonForm />
      case "Controladores": return <ControladorForm />
      case "Power": return <FonteAlimentacaoForm />
      case "Acessórios": return <AcessorioForm />
      default: return <p>Categoria não encontrada</p>
    }
  }

  return (
    <div className="gestao-container">

      <div className="gestao-header">
        <div className="gestao-header-inner">
          <div>
            <div className="gestao-header-label">MODERAÇÃO</div>
            <h1>Gestão de Produtos</h1>
          </div>
        </div>
      </div>

      <div className="gestao-body">

        <div className="barra-categorias" ref={barRef}>
          <div
            className="categoria-indicator"
            style={{ left: indicator.left, width: indicator.width }}
          />
          {categorias.map(cat => (
            <button
              key={cat}
              ref={el => { btnRefs.current[cat] = el }}
              className={categoria === cat ? "categoria-ativa" : "categoria"}
              onClick={() => setCategoria(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="form-area" key={categoria}>
          <div className="form-area-bar">{categoria.toUpperCase()}</div>
          {renderForm()}
        </div>

      </div>

    </div>
  )
}

export default GestaoProdutos
