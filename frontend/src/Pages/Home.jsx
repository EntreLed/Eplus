import { API_URL } from '../utils/api'
import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import "./estilosPages/Home.css"
import EfeitosFundo from "../components/EfeitosFundo"

const frases = [
  'da tua loja',
  'do teu escritório',
  'da tua casa',
  'do teu hotel',
  'do teu restaurante',
  'do teu estúdio',
]

function Home() {

  const navigate = useNavigate()

  const [TextosTitulos, setTextosTitulos] = useState('')
  const [kitItems, setKitItems] = useState([])

  useEffect(() => {
    fetch(`${API_URL}/api/produto/KitAleatorio`)
      .then(r => r.json())
      .then(data => setKitItems(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let wi = 0, ci = 0, deleting = false
    let timer
    const SPEED_TYPE = 70
    const SPEED_DELETE = 40
    const PAUSE_FULL = 2200
    const PAUSE_EMPTY = 300
    function tick() {
      const frase = frases[wi]
      if (!deleting) {
        ci++
        setTextosTitulos(frase.slice(0, ci))
        if (ci === frase.length) { deleting = true; timer = setTimeout(tick, PAUSE_FULL); return }
        timer = setTimeout(tick, SPEED_TYPE)
      } else {
        ci--
        setTextosTitulos(frase.slice(0, ci))
        if (ci === 0) { deleting = false; wi = (wi + 1) % frases.length; timer = setTimeout(tick, PAUSE_EMPTY); return }
        timer = setTimeout(tick, SPEED_DELETE)
      }
    }
    timer = setTimeout(tick, 1200)
    return () => clearTimeout(timer)
  }, [])

  const features = [
    { num: "01", title: "Catálogo Completo", desc: "Perfis, fitas LED, neon, controladores, fontes e acessórios numa plataforma." },
    { num: "02", title: "Configurador IA", desc: "Descreve o teu projeto e recebe automaticamente o kit LED mais adequado." },
    { num: "03", title: "Orçamento Rápido", desc: "Personaliza componentes e solicita orçamento em segundos." },
  ]

  const categories = [
    { name: "Perfis", desc: "Alumínio para fitas LED" },
    { name: "Fitas LED", desc: "ECOB e EPRO" },
    { name: "Neon", desc: "Flex neon 24V" },
    { name: "Controladores", desc: "RF, WiFi, DALI" },
    { name: "Power", desc: "POS, DIN, GPV..." },
    { name: "Acessórios", desc: "Interruptores, cabos" },
  ]

  return (
    <div className="home-wrapper">

      {/* Hero */}
      <section className="home-hero">
        <EfeitosFundo className="home-bg-scene" />
        <div className="home-hero-inner">

          <div className="home-hero-left">
            <div className="home-hero-badge">
              <span className="home-hero-badge-dot"></span>
              Sistema LED Profissional
            </div>
            <h1 className="home-hero-title">
              Iluminação<br />
              <span className="home-hero-title-accent">
                {TextosTitulos}
              </span>
              <span className="home-hero-cursor" />
              <br />
              automaticamente configurada.
            </h1>
            <p className="home-hero-sub">
              Configure, personalize e peça orçamento ao instante.<br />
              A gama mais completa do mercado português.
            </p>
            <div className="home-hero-ctas">
              <button className="home-cta-primary" onClick={() => navigate("/configurador")}>
                CONFIGURADOR LED 
              </button>
              <button className="home-cta-secondary" onClick={() => navigate("/catalogo")}>
                VER CATÁLOGO
              </button>
            </div>
          </div>

          {/* Card decorativo */}
          <div className="home-hero-right">
            <div className="home-hero-card">
              <div className="home-hero-card-bar">Kit gerado</div>
              {kitItems.map((item, i) => (
                <div key={i} className="home-hero-item">
                  <div className="home-hero-item-bar">{item.label}</div>
                  <div className="home-hero-item-body">
                    <div
                      className="home-hero-item-thumb"
                      style={item.imagem_url ? { backgroundImage: `url(${item.imagem_url})`, backgroundSize: 'cover' } : {}}
                    />
                    <div>
                      <p className="home-hero-item-nome">{item.nome}</p>
                      <p className="home-hero-item-ref">{item.referencia}</p>
                    </div>
                  </div>
                </div>
              ))}
              <button className="home-hero-card-btn" onClick={() => navigate("/configurador")}>
                CONFIGURAR AGORA
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* Como funciona */}
      <section className="home-section">
        <div className="home-container">
          <div className="home-section-head">
            <div className="home-section-bar" />
            <h2 className="home-section-title">Como funciona</h2>
          </div>
          <div className="home-feat-grid">
            {features.map((f, i) => (
              <div key={i} className="home-feat-card">
                <div className="home-feat-num">{f.num}</div>
                <h3 className="home-feat-title">{f.title}</h3>
                <p className="home-feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categorias */}
      <section className="home-section-dark">
        <EfeitosFundo className="home-bg-scene" />
        <div className="home-container home-cat-content">
          <div className="home-cat-header">
            <div>
              <div className="home-section-head">
                <div className="home-section-bar home-section-bar-lime" />
                <h2 className="home-section-title home-section-title-white">Categorias de Produto</h2>
              </div>
              <p className="home-cat-sub">Toda a gama EPlus num só lugar</p>
            </div>
            <button className="home-cta-secondary-dark" onClick={() => navigate("/catalogo")}>
              Ver todos
            </button>
          </div>
          <div className="home-cat-grid">
            {categories.map((cat, i) => (
              <div key={i} className="home-cat-card" onClick={() => navigate("/catalogo")}>
                <h3>{cat.name}</h3>
                <p>{cat.desc}</p>
                <span className="home-cat-card-arrow">&rarr;</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="home-section home-section-white">
        <div className="home-container">
          <div className="home-cta-banner">
            <div className="home-cta-banner-accent" />
            <div className="home-cta-banner-content">
              <h2 className="home-cta-banner-title">Tem um projeto em mente?</h2>
              <p className="home-cta-banner-desc">
                Use o Configurador e receba o kit LED ideal em segundos.
              </p>
              <button className="home-cta-primary" onClick={() => navigate("/configurador")}>
                INICIAR CONFIGURAÇÃO
              </button>
            </div>
          </div>
        </div>
      </section>


    </div>
  )
}

export default Home
