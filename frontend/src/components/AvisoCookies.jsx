import { useState, useEffect } from "react"
import "./components_css/AvisoCookies.css"

function AvisoCookies() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const aceite = localStorage.getItem("cookies_aceites")
    if (!aceite) setVisivel(true)
  }, [])

  function aceitar() {
    localStorage.setItem("cookies_aceites", "true")
    setVisivel(false)
  }

  function recusar() {
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div className="cookie-banner">
      <div className="cookie-banner-inner">
        <div className="cookie-banner-texto">
          <span className="cookie-banner-titulo">Utilização de Cookies</span>
          <span className="cookie-banner-desc">
            Este site utiliza cookies essenciais para garantir o correto funcionamento da plataforma.
            Ao continuar a navegar, aceita a sua utilização.
          </span>
        </div>
        <div className="cookie-banner-acoes">
          <button className="cookie-banner-btn-recusar" onClick={recusar}>
            Recusar
          </button>
          <button className="cookie-banner-btn-aceitar" onClick={aceitar}>
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}

export default AvisoCookies
