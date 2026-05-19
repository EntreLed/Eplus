import { memo } from "react"
import { useNavigate } from "react-router-dom"
import { getUserRole } from "../utils/auth"
import "./components_css/CardProdutos.css"

function CardProdutos({ produto }) {

  const navigate = useNavigate()
  const role = getUserRole()?.toLowerCase()
  const podeVerBadge = role === "administrador" || role === "moderador"

  return (
    <div className="card">

      <div className="card-img-wrap">
        {produto.imagem_url
          ? <img src={produto.imagem_url} alt={produto.nome} className="card-image" loading="lazy" />
          : <div className="card-img-placeholder">
              <div className="card-img-stripes" />
              <span className="card-img-label">{produto.categoria?.replace("_", " ").toUpperCase()}</span>
            </div>
        }
        {podeVerBadge && produto.ativo === false && (
          <span className="card-badge-desativado">DESATIVADO</span>
        )}
      </div>

      <div className="card-label-bar">
        {(produto.categoria || "produto").replace(/_/g, " ").toUpperCase()}
        {produto.subcategoria && ` › ${produto.subcategoria.replace(/_/g, " ").toUpperCase()}`}
        {produto.categoria === "acessorios" && produto.tipo_acessorio && ` › ${produto.tipo_acessorio.replace(/_/g, " ").toUpperCase()}`}
      </div>

      
      <div className="card-content">
        <h3 className="card-nome">{produto.nome || produto.referencia}</h3>

        {/* Detalhes específicos por categoria — mantidos na íntegra */}
        {produto.categoria === "fita_led" ? (
          <>
            {produto.quantidade_leds_m && <p className="card-detalhe">{produto.quantidade_leds_m} LEDs/m</p>}
          </>
        ) : produto.categoria === "neon" ? (
          <>
            {produto.potencia_w_m && <p className="card-detalhe">{produto.potencia_w_m} W/m</p>}
          </>
        ) : produto.categoria === "power" ? (
          <>
            {produto.potencia_w && <p className="card-detalhe">{produto.potencia_w} W</p>}
          </>
        ) : produto.categoria === "acessorios" ? (
          <>
            {produto.tipo_acessorio && <p className="card-detalhe">{produto.tipo_acessorio.replace(/_/g, " ")}</p>}
          </>
        ) : produto.categoria === "controlador" ? (
          <>
            {(produto.tipos_controlo?.length > 0) && (
              <p className="card-detalhe">{produto.tipos_controlo.join(" - ")}</p>
            )}
          </>
        ) : (
          <>
            {produto.tipos_instalacao && <p className="card-detalhe">{produto.tipos_instalacao}</p>}
          </>
        )}
      </div>

      <button className="card-button" onClick={() => {
        sessionStorage.setItem("_catalogo_scroll", window.scrollY)
        navigate(`/produto/${produto.produto_id}`)
      }}>
        VER DETALHES
      </button>

    </div>
  )
}

export default memo(CardProdutos)
