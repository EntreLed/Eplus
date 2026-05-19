import { API_URL } from '../utils/api'
import { useEffect, useRef, useState } from "react"

import CardProdutos from "../components/CardProdutos"
import "./estilosPages/Catalogo.css"

const BASE = `${API_URL}/api`
const POR_PAGINA = 60
const ESTADO_KEY = "_catalogo_estado"

function getSeed() {
  const key = "_catalogo_seed"
  let s = sessionStorage.getItem(key)
  if (!s) { s = Math.random().toString(36).slice(2, 10); sessionStorage.setItem(key, s) }
  return s
}

function lerEstado() {
  try { return JSON.parse(sessionStorage.getItem(ESTADO_KEY)) || {} }
  catch { return {} }
}

const CATEGORIA_ENDPOINT = {
  "Perfis": `${BASE}/perfis`,
  "Fitas LED": `${BASE}/fitas_led`,
  "Neon": `${BASE}/neon`,
  "Controladores": `${BASE}/controladores`,
  "Comandos": `${BASE}/comandos`,
  "Kits": `${BASE}/kits`,
  "Power": `${BASE}/power`,
  "Acessórios": `${BASE}/acessorios`,
}

function Catalogo() {

  const estadoGuardado = lerEstado()

  const [categorias, setCategorias] = useState([])
  const [categoriaAtiva, setCategoriaAtiva] = useState(estadoGuardado.categoriaAtiva ?? "Todos")
  const [subcategoriaAtiva, setSubcategoriaAtiva] = useState(estadoGuardado.subcategoriaAtiva ?? null)
  const [paginaAtual, setPaginaAtual] = useState(estadoGuardado.paginaAtual ?? 1)
  const [expandidas, setExpandidas] = useState(estadoGuardado.expandidas ?? {})

  const [dados, setDados] = useState([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(false)

  const [pesquisa, setPesquisa] = useState(estadoGuardado.pesquisa ?? "")
  const [pesquisaAtiva, setPesquisaAtiva] = useState(estadoGuardado.pesquisaAtiva ?? "")
  const debounceRef = useRef(null)

  const [drawerAberto, setDrawerAberto] = useState(false)

  useEffect(() => {
    fetch(`${BASE}/produto/categorias`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setCategorias(data)
        const guardado = lerEstado().expandidas ?? {}
        setExpandidas(Object.fromEntries(data.map(c => [c.nome, guardado[c.nome] ?? false])))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    sessionStorage.setItem(ESTADO_KEY, JSON.stringify({
      categoriaAtiva,
      subcategoriaAtiva,
      paginaAtual,
      expandidas,
      pesquisa,
      pesquisaAtiva,
    }))
  }, [categoriaAtiva, subcategoriaAtiva, paginaAtual, expandidas, pesquisa, pesquisaAtiva])

  function handlePesquisa(valor) {
    setPesquisa(valor)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setPesquisaAtiva(valor.trim()), 350)
  }

  useEffect(() => {
    const controller = new AbortController()
    setCarregando(true)

    let url
    if (pesquisaAtiva.length >= 2) {
      url = `${BASE}/produto/pesquisa?q=${encodeURIComponent(pesquisaAtiva)}`
    } else if (categoriaAtiva === "Todos") {
      url = `${BASE}/produto/todos?pagina=${paginaAtual}&limite=${POR_PAGINA}&seed=${getSeed()}`
    } else {
      const endpoint = CATEGORIA_ENDPOINT[categoriaAtiva]
      url = `${endpoint}?pagina=${paginaAtual}&limite=${POR_PAGINA}`
      if (subcategoriaAtiva) url += `&subcategoria=${encodeURIComponent(subcategoriaAtiva)}`
    }

    fetch(url, { credentials: "include", signal: controller.signal })
      .then(r => r.json())
      .then(({ dados, total }) => {
        setDados(dados || [])
        setTotal(total || 0)
        setCarregando(false)
        const scrollGuardado = sessionStorage.getItem("_catalogo_scroll")
        if (scrollGuardado) {
          sessionStorage.removeItem("_catalogo_scroll")
          requestAnimationFrame(() => window.scrollTo({ top: parseInt(scrollGuardado), behavior: "instant" }))
        }
      })
      .catch(err => { if (err.name !== "AbortError") setCarregando(false) })

    return () => controller.abort()
  }, [categoriaAtiva, subcategoriaAtiva, paginaAtual, pesquisaAtiva])

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }) }, [paginaAtual])

  function fecharTodas(exceto = null) {
    setExpandidas(prev =>
      Object.fromEntries(Object.keys(prev).map(k => [k, k === exceto ? !prev[k] : false]))
    )
  }

  function selecionarCategoria(nome) {
    setExpandidas(prev =>
      Object.fromEntries(Object.keys(prev).map(k => [k, k === nome ? !prev[k] : false]))
    )
    setCategoriaAtiva(nome)
    setSubcategoriaAtiva(null)
    setPaginaAtual(1)
    setDrawerAberto(false)
  }

  function selecionarSubcategoria(catNome, sub) {
    setExpandidas(prev =>
      Object.fromEntries(Object.keys(prev).map(k => [k, k === catNome]))
    )
    setCategoriaAtiva(catNome)
    setSubcategoriaAtiva(sub)
    setPaginaAtual(1)
    setDrawerAberto(false)
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div className="catalogo-layout">

      {/* Linha de cabeçalho */}
      <div className="catalogo-header-row">

        <div className="catalogo-sidebar-header">
          <p
            className={`sidebar-titulo${categoriaAtiva === "Todos" ? " ativa" : ""}`}
            onClick={() => { setCategoriaAtiva("Todos"); setSubcategoriaAtiva(null); setPaginaAtual(1) }}
          >Índice geral</p>
        </div>

        <div className="catalogo-topbar">
          <div className="catalogo-topbar-row">
            <div className="catalogo-topbar-left">
              {/* Botão filtros (só aparece em mobile) */}
              <button className="catalogo-filtros-btn" onClick={() => setDrawerAberto(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
                Filtros
              </button>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: 18, fontWeight: 900, color: "#013634", letterSpacing: -0.3, margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {pesquisaAtiva.length >= 2
                    ? <><span style={{ fontWeight: 400, opacity: 0.5 }}>Resultados para </span>"{pesquisaAtiva}"</>
                    : categoriaAtiva === "Todos" ? "Todos os produtos" : categoriaAtiva
                  }
                  {!pesquisaAtiva && subcategoriaAtiva ? <span style={{ fontWeight: 400, opacity: 0.7 }}> / {subcategoriaAtiva.replace(/_/g, " ")}</span> : ""}
                </h1>
                <p style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", margin: 0 }}>
                  {total} produto{total !== 1 ? "s" : ""}
                  {!pesquisaAtiva && totalPaginas > 1 ? ` · página ${paginaAtual} de ${totalPaginas}` : ""}
                </p>
              </div>
            </div>

            <div className="catalogo-pesquisa-wrap catalogo-pesquisa-wrap-full">
              <svg className="catalogo-pesquisa-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="catalogo-pesquisa-input"
                type="text"
                placeholder="Pesquisar produto"
                value={pesquisa}
                onChange={e => handlePesquisa(e.target.value)}
              />
              {pesquisa && (
                <button className="catalogo-pesquisa-clear" onClick={() => { setPesquisa(""); setPesquisaAtiva("") }}>✕</button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Overlay do drawer (mobile) */}
      {drawerAberto && (
        <div className="catalogo-drawer-overlay" onClick={() => setDrawerAberto(false)} />
      )}

      {/* Linha de corpo */}
      <div className="catalogo-body-row">

      {/* Sidebar */}
      <aside className={`catalogo-sidebar${drawerAberto ? " drawer-aberto" : ""}`}>

        <div className="catalogo-sidebar-drawer-header">
          <span>Categorias</span>
          <button className="catalogo-drawer-close" onClick={() => setDrawerAberto(false)}>✕</button>
        </div>

        <p
          className={`sidebar-titulo${categoriaAtiva === "Todos" ? " ativa" : ""}`}
          onClick={() => { setCategoriaAtiva("Todos"); setSubcategoriaAtiva(null); setPaginaAtual(1); setDrawerAberto(false) }}
        >Índice geral</p>

        {categorias.map(cat => (
          <div key={cat.nome}>

            <button
              className={`sidebar-categoria ${categoriaAtiva === cat.nome ? "ativa" : ""}`}
              onClick={() => selecionarCategoria(cat.nome)}
            >
              {cat.nome}
              {cat.subcategorias.length > 0 && (
                <span
                  className={`sidebar-seta ${expandidas[cat.nome] ? "aberta" : ""}`}
                  onClick={e => { e.stopPropagation(); fecharTodas(cat.nome) }}
                >
                  ▾
                </span>
              )}
            </button>

            <ul className={`sidebar-subcategorias${expandidas[cat.nome] ? " aberta" : ""}`}>
              {cat.subcategorias.map(sub => (
                <li
                  key={sub}
                  className={subcategoriaAtiva === sub && categoriaAtiva === cat.nome ? "ativa" : ""}
                  onClick={() => selecionarSubcategoria(cat.nome, sub)}
                >
                  {sub.replace(/_/g, " ")}
                </li>
              ))}
            </ul>

          </div>
        ))}

      </aside>

      {/* Conteúdo */}
      <main className="catalogo-conteudo">

        {carregando ? (
          <div className="catalogo-loading">
            <div className="catalogo-loading-spinner" />
            <p>A carregar produtos…</p>
          </div>
        ) : (
          <div className="catalogo-conteudo-pad">
            {dados.length === 0 ? (
              <p style={{ color: "#9BAFAD", fontSize: 15, textAlign: "center", paddingTop: 60 }}>Nenhum produto encontrado.</p>
            ) : (
              <div className="catalogo-grid">
                {dados.map(p => (
                  <CardProdutos key={p.produto_id} produto={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {totalPaginas > 1 && (
          <div className="catalogo-paginacao">
            <button
              className="pag-btn"
              onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
            >‹</button>

            {Array.from({ length: totalPaginas }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPaginas || Math.abs(n - paginaAtual) <= 2)
              .reduce((acc, n, idx, arr) => {
                if (idx > 0 && n - arr[idx - 1] > 1) acc.push("…")
                acc.push(n)
                return acc
              }, [])
              .map((item, idx) =>
                item === "…"
                  ? <span key={`sep-${idx}`} className="pag-sep">…</span>
                  : <button
                      key={item}
                      className={`pag-btn${paginaAtual === item ? " ativa" : ""}`}
                      onClick={() => setPaginaAtual(item)}
                    >{item}</button>
              )
            }

            <button
              className="pag-btn"
              onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
            >›</button>
          </div>
        )}

      </main>

      </div>

    </div>
  )
}

export default Catalogo
