import { API_URL } from '../utils/api'
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getUserRole, isTokenValido, fetchAutenticado } from "../utils/auth"
import PerfilForm from "../components/forms/PerfilForm"
import FitaLedForm from "../components/forms/FitaLedForm"
import NeonForm from "../components/forms/NeonForm"
import ControladorForm from "../components/forms/ControladorForm"
import FonteAlimentacaoForm from "../components/forms/FonteAlimentacaoForm"
import AcessorioForm from "../components/forms/AcessorioForm"
import "./estilosPages/EditarProduto.css"

function EditarProduto() {

  const { id } = useParams()
  const navigate = useNavigate()
  const [produto, setProduto] = useState(null)
  const [tipo, setTipo] = useState(null)
  const [erro, setErro] = useState(null)

  const role = getUserRole()?.toLowerCase()
  const isAdmin = role === "administrador"

  const [modalApagar, setModalApagar] = useState(false)
  const [apagarErro, setApagarErro] = useState(null)
  const [apagarLoading, setApagarLoading] = useState(false)
  const [apagarSucesso, setApagarSucesso] = useState(false)

  async function confirmarApagar() {
    setApagarLoading(true)
    setApagarErro(null)
    try {
      const res = await fetchAutenticado(`${API_URL}/api/produto/${id}`, {
        method: "DELETE"
      })
      const data = await res.json()
      if (!res.ok) {
        const detalhe = data.bloqueios?.length
          ? data.bloqueios.join("\n")
          : data.erro
        setApagarErro(detalhe)
        setApagarLoading(false)
        return
      }
      setApagarSucesso(true)
      setTimeout(() => navigate("/catalogo"), 1800)
    } catch {
      setApagarErro("Erro de ligação ao servidor.")
      setApagarLoading(false)
    }
  }

  const endpointPorTipo = {
    perfil: "perfis",
    fita_led: "fitas_led",
    neon: "neon",
    controlador: "controladores",
    comando: "comandos",
    kit: "kits",
    power: "power",
    acessorio: "acessorios"
  }

  async function toggleAtivo() {
    const endpoint = endpointPorTipo[tipo]
    const res = await fetchAutenticado(`${API_URL}/api/${endpoint}/${id}/ativo`, {
      method: "PATCH"
    })
    if (res.ok) {
      const data = await res.json()
      setProduto(prev => ({ ...prev, ativo: data.ativo }))
    }
  }

  useEffect(() => {
    async function carregarProduto() {
      if (!isTokenValido()) { window.location.replace("/login"); return }

      const tentativas = [
        { url: `${API_URL}/api/perfis/${id}`, tipo: "perfil" },
        { url: `${API_URL}/api/fitas_led/${id}`, tipo: "fita_led" },
        { url: `${API_URL}/api/neon/${id}`, tipo: "neon" },
        { url: `${API_URL}/api/controladores/${id}`, tipo: "controlador" },
        { url: `${API_URL}/api/comandos/${id}`, tipo: "comando" },
        { url: `${API_URL}/api/kits/${id}`, tipo: "kit" },
        { url: `${API_URL}/api/power/${id}`, tipo: "power" },
        { url: `${API_URL}/api/acessorios/${id}`, tipo: "acessorio" },
      ]

      for (const t of tentativas) {
        const res = await fetchAutenticado(t.url)
        if (res.ok) {
          const data = await res.json()
          setProduto(data)
          setTipo(t.tipo)
          return
        }
      }

      setErro("Produto não encontrado")
    }

    carregarProduto()
  }, [id])

  if (erro) return (
    <div style={{ padding: "40px" }}>
      <p style={{ color: "red" }}>{erro}</p>
      <button onClick={() => navigate(-1)}>Voltar</button>
    </div>
  )

  if (!produto) return <div style={{ padding: "40px" }}>A carregar...</div>

  function renderForm() {
    switch (tipo) {
      case "perfil": return <PerfilForm dadosIniciais={produto} />
      case "fita_led": return <FitaLedForm dadosIniciais={produto} />
      case "neon": return <NeonForm dadosIniciais={produto} />
      case "controlador": return <ControladorForm dadosIniciais={produto} />
      case "comando": return <ControladorForm dadosIniciais={produto} />
      case "kit": return <ControladorForm dadosIniciais={produto} />
      case "power": return <FonteAlimentacaoForm dadosIniciais={produto} />
      case "acessorio": return <AcessorioForm dadosIniciais={produto} />
      default: return <p>A categoria "{produto.categoria}" ainda não suporta edição.</p>
    }
  }

  const nomesTipo = { perfil: "Perfil", fita_led: "Fita LED", neon: "Neon", controlador: "Controlador", comando: "Comando", kit: "Kit", power: "Power", acessorio: "Acessório" }

  return (
    <div className="editar-container">

      <div className="editar-header">
        <div className="editar-header-inner">
          <div>
            <div className="editar-header-label">MODERAÇÃO</div>
            <h1>Editar {nomesTipo[tipo]}: {produto.nome}</h1>
            {produto.referencia && <div className="editar-header-ref">Ref: {produto.referencia}</div>}
          </div>
        </div>
      </div>

      <div className="editar-body">
        <div className="editar-actions">
          <button onClick={() => navigate(-1)} className="editar-voltar">Voltar</button>
          <div style={{ display: "flex", gap: "8px" }}>
            {isAdmin && produto.ativo === false && (
              <button
                className="editar-btn-apagar"
                onClick={() => { setModalApagar(true); setApagarErro(null) }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Eliminar produto
              </button>
            )}
            <button
              onClick={toggleAtivo}
              className={produto.ativo ? "editar-btn-desativar" : "editar-btn-ativar"}
            >
              {produto.ativo ? "Desativar produto" : "Ativar produto"}
            </button>
          </div>
        </div>
        <div className="editar-form-area">
          <div className="editar-form-bar">{(nomesTipo[tipo] || "").toUpperCase()}</div>
          {renderForm()}
        </div>
      </div>

      {modalApagar && (
        <div className="editar-modal-overlay" onClick={() => !apagarLoading && !apagarSucesso && setModalApagar(false)}>
          <div className="editar-modal" onClick={e => e.stopPropagation()}>
            {apagarSucesso ? (
              <>
                <div style={{ marginBottom: 16, textAlign: "center" }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1f7a63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="9 12 11 14 15 10"/>
                  </svg>
                </div>
                <h3 className="editar-modal-titulo">Produto eliminado!</h3>
                <p className="editar-modal-sub">
                  O produto <strong>"{produto.nome}"</strong> foi eliminado com sucesso. A redirecionar...
                </p>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 16, textAlign: "center" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </div>
                <h3 className="editar-modal-titulo">Eliminar produto?</h3>
                <p className="editar-modal-sub">
                  Esta ação é <strong>irreversível</strong>. O produto <strong>"{produto.nome}"</strong> e todas as suas imagens serão permanentemente eliminados.
                </p>
                {apagarErro && (
                  <div className="editar-modal-erro">
                    <strong>Não é possível eliminar:</strong>
                    <p>{apagarErro}</p>
                  </div>
                )}
                <div className="editar-modal-acoes">
                  <button className="editar-modal-btn-cancelar" onClick={() => setModalApagar(false)} disabled={apagarLoading}>
                    Cancelar
                  </button>
                  <button className="editar-modal-btn-confirmar" onClick={confirmarApagar} disabled={apagarLoading}>
                    {apagarLoading ? "A eliminar..." : "Sim, eliminar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

export default EditarProduto
