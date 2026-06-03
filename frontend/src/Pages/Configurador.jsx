import { API_URL } from '../utils/api'
import { useState, useEffect, useMemo } from "react"
import { FaWandMagicSparkles } from "react-icons/fa6"
import "../Pages/estilosPages/Configurador.css"

import ReCAPTCHA from "react-google-recaptcha"


const corPorCodigo = {
  "A": "#9e9e9e",
  "B": "#1a1a1a",
  "W": "#f5f5f5",
  "RAL": "repeating-linear-gradient(90deg, #e63946 0% 20%, #f4a261 20% 40%, #2a9d8f 40% 60%, #457b9d 60% 80%, #6a4c93 80% 100%)"
}

function estiloCorDot(codigo) {
  const valor = corPorCodigo[codigo?.toUpperCase()]
  return valor ? { background: valor } : {}
}

const HISTORICO_KEY = "configurador_historico"
const HISTORICO_MAX = 5

function Configurador() {

  const [texto, setTexto] = useState("")
  const [resultados, setResultados] = useState([])
  const [dadosIA, setDadosIA] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null)
  const [comControlador, setComControlador] = useState(true)
  const [comFonte, setComFonte] = useState(true)
  const [historico, setHistorico] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORICO_KEY) || "[]")
    } catch {
      return []
    }
  })

  const guardarNoHistorico = (textoPrompt, resultadosNovos, dadosIANovos) => {
    const entrada = { texto: textoPrompt, resultados: resultadosNovos, dadosIA: dadosIANovos, data: Date.now() }
    setHistorico(prev => {
      const semDuplicado = prev.filter(e => e.texto !== textoPrompt)
      const novo = [entrada, ...semDuplicado].slice(0, HISTORICO_MAX)
      localStorage.setItem(HISTORICO_KEY, JSON.stringify(novo))
      return novo
    })
  }

  const restaurarEntrada = (entrada) => {
    setTexto(entrada.texto)
    setResultados(entrada.resultados)
    setDadosIA(entrada.dadosIA)
    setErro(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const limparHistorico = () => {
    localStorage.removeItem(HISTORICO_KEY)
    setHistorico([])
  }

  const configurar = async () => {
    if (!texto.trim()) return

    setLoading(true)
    setErro(null)
    setResultados([])
    setDadosIA(null)

    try {
      const resIA = await fetch(`${API_URL}/api/interpretar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto })
      })
      const interpretado = await resIA.json()

      const dadosConfigurador = {
        ...interpretado,
        texto_original: texto,
        zonas: (interpretado.zonas || []).map(z => ({
          ...z,
          sem_controlador: !comControlador || undefined,
          sem_fonte: !comFonte ? true : z.sem_fonte,
          sem_fonte_manual: !comFonte || undefined,
        }))
      }

      const resConfig = await fetch(`${API_URL}/api/configurador`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dadosConfigurador)
      })
      const resultado = await resConfig.json()

      if (resultado.erro) {
        setErro(resultado.erro)
        return
      }

      const novosResultados = resultado.resultados || []
      setDadosIA(interpretado)
      setResultados(novosResultados)
      guardarNoHistorico(texto, novosResultados, interpretado)

    } catch (e) {
      setErro("Erro ao comunicar com o servidor.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="configurador-wrapper">

      {/* Header escuro */}
      <div className="configurador-page-head">
        <div className="configurador-page-head-inner">
          <h1>Configurador IA</h1>
          <p className="configurador-subtitle">Descreva o seu projeto e receba automaticamente o kit led ideal.</p>
        </div>
      </div>

      {/* Área de input */}
      <div className="configurador-input-section">
        <div className="configurador-input-wrap">
          <textarea
            className="configurador-textarea"
            placeholder="Ex: quero iluminar o perímetro da sala de estar, 4×5m, luz quente, com comando RF...
(Apenas uma zona)"
            value={texto}
            onChange={e => setTexto(e.target.value)}
          />
          <div className="configurador-input-bar">
            <div className="configurador-checkboxes">
              <label className="configurador-checkbox-label">
                <input
                  type="checkbox"
                  checked={comControlador}
                  onChange={e => setComControlador(e.target.checked)}
                />
                Controlador
              </label>
              <label className="configurador-checkbox-label">
                <input
                  type="checkbox"
                  checked={comFonte}
                  onChange={e => setComFonte(e.target.checked)}
                />
                Fonte
              </label>
            </div>
            <button
              className="configurador-btn"
              onClick={configurar}
              disabled={loading}
            >
              {loading
                ? <span>CONFIGURAR<span className="cfg-dots"><span>.</span><span>.</span><span>.</span></span></span>
                : <span className="cfg-btn-inner">CONFIGURAR <FaWandMagicSparkles /></span>
              }
            </button>
          </div>
        </div>
        {erro && <p className="configurador-erro configurador-erro-alinhado">{erro}</p>}
      </div>

      {resultados.length > 0 && (
        <div className="configurador-resultados">
          {resultados.map((zona, idx) => (
            <KitZona
              key={idx}
              zona={zona}
              idx={idx}
              total={resultados.length}
              zoneConstraints={dadosIA?.zonas?.[idx]}
              textoOriginal={texto}
              comControlador={comControlador}
              comFonte={comFonte}
            />
          ))}
        </div>
      )}

      {historico.length > 0 && (
        <div className="historico-section">
          <div className="historico-header">
            <h2 className="historico-titulo">Histórico de pesquisas</h2>
            <button className="historico-limpar" onClick={limparHistorico}>Limpar histórico</button>
          </div>
          <div className="historico-lista">
            {historico.map((entrada, idx) => (
              <div key={entrada.data} className="historico-entrada">
                <div className="historico-entrada-info">
                  <span className="historico-numero">{idx + 1}</span>
                  <span className="historico-texto">{entrada.texto}</span>
                  <span className="historico-data">{new Date(entrada.data).toLocaleString("pt-PT")}</span>
                </div>
                <button
                  className="historico-restaurar"
                  onClick={() => restaurarEntrada(entrada)}
                >
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}


const OPCOES_CONFIG = [
  { key: "basica", label: "Básica", descricao: "Menor custo total" },
  { key: "solida", label: "Sólida", descricao: "Melhor relação qualidade/preço" },
  { key: "premium", label: "Premium", descricao: "Maior eficiência e qualidade" },
]

function KitZona({ zona, idx, total, zoneConstraints, textoOriginal }) {

  const [kitConfirmado, setKitConfirmado] = useState(null)

  return (
    <div className="zona-kit">

      {total > 1 && (
        <p className="zona-titulo">Zona {idx + 1}</p>
      )}

      {!kitConfirmado ? (
        <div className="opcoes-grid">
          {OPCOES_CONFIG.map(o => (
            <OpcaoColuna
              key={o.key}
              config={o}
              kit={zona.opcoes?.[o.key]}
              comprimentoTotal={zona.comprimento_total_m}
              textoOriginal={textoOriginal}
              onConfirmar={() => setKitConfirmado({ key: o.key, kit: zona.opcoes?.[o.key] })}
            />
          ))}
        </div>
      ) : (
        <PainelPersonalizacao
          kitKey={kitConfirmado.key}
          kit={kitConfirmado.kit}
          zoneConstraints={zoneConstraints}
          comprimentoTotal={zona.comprimento_total_m}
          textoOriginal={textoOriginal}
          onCancelar={() => setKitConfirmado(null)}
        />
      )}

    </div>
  )
}


function OpcaoColuna({ config, kit, comprimentoTotal, textoOriginal, onConfirmar }) {

  const [downloading, setDownloading] = useState(false)

  const precoExibir = (() => {
    if (!kit) return null
    if (kit.preco_total > 0) return kit.preco_total
    const precFita = (kit.fita?.preco_metro != null && comprimentoTotal)
      ? Number(kit.fita.preco_metro) * comprimentoTotal
      : 0
    const numFontes = (kit.num_alimentacoes ?? 1) > 1 ? 2 : 1
    const precFonte = Number(kit.fonte?.preco || 0) * numFontes
    const precCtrl = kit.controlador?.sem_controlador ? 0 : Number(kit.controlador?.preco || 0)
    const precCmd = Number(kit.comando?.preco || 0)
    const total = Math.round((precFita + precFonte + precCtrl + precCmd) * 100) / 100
    return total > 0 ? total : null
  })()

  const downloadPDF = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`${API_URL}/api/orcamento/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opcaoLabel: config.label,
          comprimentoTotal: comprimentoTotal ?? null,
          precoTotal: kit.preco_total ?? 0,
          textoOriginal: textoOriginal ?? null,
          kit: {
            fita: kit.fita,
            perfil: kit.perfil,
            controlador: kit.controlador,
            fonte: kit.fonte,
            comando: kit.comando,
          }
        })
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `kit-${config.key}-${Date.now()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // falha silenciosa — o botão volta ao estado normal
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={`opcao-coluna opcao-coluna-${config.key}`}>

      <div className="opcao-header">
        <div className="opcao-header-top">
          <div className="opcao-header-left">
            <span className="opcao-header-badge">{config.label[0]}</span>
            <span className="opcao-header-label">{config.label}</span>
          </div>
          {precoExibir != null && (
            <span className="opcao-header-preco">
              {Number(precoExibir).toFixed(2)} €
            </span>
          )}
        </div>
        <span className="opcao-header-desc">{config.descricao}</span>
        {comprimentoTotal != null && (
          <span className="opcao-header-comprimento">
            Comprimento total: {Number(comprimentoTotal).toFixed(2)} m
          </span>
        )}
      </div>

      {kit?.fita?.preco_metro == null && kit && (
        <p className="kit-aviso-medida">⚠ Preço exclusivo por medida</p>
      )}

      {kit?.num_alimentacoes > 1 && (
        <p className="kit-aviso-alimentacao">
          ⚠ {kit.num_alimentacoes} pontos de alimentação necessários
          {kit.num_alimentacoes === 2 ? " (alimentação paralela)" : ""}
        </p>
      )}

      {kit ? (
        <>
          <div className="opcao-pecas">
            <PecaCard label="Fita LED" peca={kit.fita} detalhes={detalhesFita} />
            <PecaCard label="Perfil" peca={kit.perfil} detalhes={detalhesPerfil} />
            <PecaCard label="Controlador" peca={kit.controlador} detalhes={detalhesControlador} />
            <PecaCard label="Fonte" peca={kit.fonte} detalhes={detalhesFonte} avisoExtra={kit.aviso_fonte} />
            <PecaCard label="Comando" peca={kit.comando} detalhes={detalhesComando} />
          </div>
          <div className="opcao-footer">
            <button
              className="btn-download-pdf"
              onClick={downloadPDF}
              disabled={downloading}
              title="Exportar esta lista como PDF"
            >
              {downloading ? "A gerar..." : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 5, verticalAlign: "middle", flexShrink: 0}}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                  PDF
                </>
              )}
            </button>
            <button className={`btn-confirmar btn-confirmar-${config.key}`} onClick={onConfirmar}>
              Confirmar esta opção
            </button>
          </div>
        </>
      ) : (
        <p className="configurador-sem-opcao">Sem combinação disponível.</p>
      )}

    </div>
  )
}


function PainelPersonalizacao({ kitKey, kit, zoneConstraints, comprimentoTotal, textoOriginal, onCancelar }) {

  const [perfisCompativeis] = useState(Array.isArray(kit.perfisCompativeis) ? kit.perfisCompativeis : [])
  const [perfilId, setPerfilId] = useState(kit.perfil?.produto_id ?? null)
  const [dadosPerfil, setDadosPerfil] = useState(null)
  const [varianteEscolhida, setVarianteEscolhida] = useState(null)
  const [difusorEscolhido, setDifusorEscolhido] = useState(null)
  const [loadingPerfil, setLoadingPerfil] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)

  const config = OPCOES_CONFIG.find(o => o.key === kitKey) ?? OPCOES_CONFIG[1]

  const precoPersonalizado = useMemo(() => {
    const base = parseFloat(kit.preco_total || 0)
    const varPreco = parseFloat(varianteEscolhida?.preco || 0)
    const difPreco = parseFloat(difusorEscolhido?.preco || 0)
    return Math.round((base + varPreco + difPreco) * 100) / 100
  }, [kit.preco_total, varianteEscolhida, difusorEscolhido])

  const perfilAtual = useMemo(() =>
    perfisCompativeis.find(p => p.produto_id === perfilId)
    ?? (kit.perfil ? { ...kit.perfil } : null)
  , [perfisCompativeis, perfilId, kit.perfil])

  useEffect(() => {
    if (!perfilId) return
    setLoadingPerfil(true)
    setVarianteEscolhida(null)
    setDifusorEscolhido(null)
    fetch(`${API_URL}/api/perfis/${perfilId}`)
      .then(r => r.json())
      .then(data => {
        setDadosPerfil(data)
        setLoadingPerfil(false)
      })
      .catch(() => setLoadingPerfil(false))
  }, [perfilId])

  const difusoresFiltrados = useMemo(() => {
    if (!varianteEscolhida || !dadosPerfil?.difusores) return []
    return dadosPerfil.difusores
      .map(d => ({
        ...d,
        variantes: d.variantes.filter(v =>
          parseFloat(v.comprimento_m) === parseFloat(varianteEscolhida.dimensao_m)
        )
      }))
      .filter(d => d.variantes.length > 0)
  }, [varianteEscolhida, dadosPerfil])

  const selecaoCompleta = varianteEscolhida && difusorEscolhido

  return (
    <>
      <div className={`painel-personalizacao painel-personalizacao-${kitKey}`}>

        <div className="painel-header">
          <div className="painel-header-info">
            <div className="painel-badge-wrap">
              <div className="painel-badge-row">
                <span className={`painel-badge painel-badge-${kitKey}`}>{config.label}</span>
                <span className="painel-preco">{Number(precoPersonalizado).toFixed(2)} €</span>
              </div>
              {comprimentoTotal != null && (
                <span className="painel-comprimento">Comprimento total: {Number(comprimentoTotal).toFixed(2)} m</span>
              )}
            </div>
            {(varianteEscolhida || difusorEscolhido) && (
              <span className="painel-preco-detalhe">
                base {Number(kit.preco_total).toFixed(2)} €
                {varianteEscolhida?.preco ? ` + ${Number(varianteEscolhida.preco).toFixed(2)} € (variante)` : ""}
                {difusorEscolhido?.preco ? ` + ${Number(difusorEscolhido.preco).toFixed(2)} € (difusor)` : ""}
              </span>
            )}
          </div>
          <button className="painel-cancelar" onClick={onCancelar}>Voltar às opções</button>
        </div>

        <div className="painel-kit-resumo">
          <PecaCardCompacta label="Fita LED" peca={kit.fita} />
          <PecaCardCompacta label="Controlador" peca={kit.controlador} />
          <PecaCardCompacta label="Fonte" peca={kit.fonte} />
          <PecaCardCompacta label="Comando" peca={kit.comando} />
        </div>

        {!kit.perfil && (
          <div className="painel-secao painel-secao-acao">
            <button
              className="btn-orcamento"
              onClick={() => setMostrarForm(true)}
            >
              Pedir Orçamento
            </button>
          </div>
        )}

        {kit.perfil && (
          <>
            <div className="painel-secao">
              <h3 className="painel-secao-titulo">Perfil</h3>

              {(
                <div className="perfil-lista">
                  {perfisCompativeis.map(p => (
                    <button
                      key={p.produto_id}
                      className={`perfil-item${p.produto_id === perfilId ? " selecionado" : ""}`}
                      onClick={() => setPerfilId(p.produto_id)}
                    >
                      {p.imagem_url && (
                        <img src={p.imagem_url} alt={p.nome} className="perfil-item-img" />
                      )}
                      <div className="perfil-item-info">
                        <span className="perfil-item-nome">{p.nome}</span>
                        <span className="perfil-item-ref">{p.referencia}</span>
                        {p.tipos_instalacao?.length > 0 && (
                          <span className="perfil-item-tipo">{p.tipos_instalacao.join(", ")}</span>
                        )}
                      </div>
                    </button>
                  ))}
                  {perfisCompativeis.length === 0 && (
                    <p className="painel-vazio">Sem perfis compatíveis encontrados.</p>
                  )}
                </div>
              )}
            </div>

            {perfilId && (
              <div className="painel-secao">
                <h3 className="painel-secao-titulo">Variante do perfil</h3>
                {loadingPerfil ? (
                  <p className="painel-loading">A carregar variantes...</p>
                ) : dadosPerfil?.acabamentos?.length > 0 ? (
                  <div className="variantes-lista">
                    {dadosPerfil.acabamentos.map(ac => (
                      <div key={ac.acabamento} className="variante-grupo">
                        <div className="variante-grupo-header">
                          {ac.codigo_cor && (
                            <span className="variante-cor-dot" style={estiloCorDot(ac.codigo_cor)} />
                          )}
                          <span className="variante-grupo-nome">{ac.acabamento}</span>
                        </div>
                        <div className="variante-medidas">
                          {ac.medidas.map(m => (
                            <button
                              key={m.referencia}
                              className={`variante-medida-btn${varianteEscolhida?.referencia === m.referencia ? " selecionado" : ""}`}
                              onClick={() => {
                                setVarianteEscolhida({ ...m, acabamento: ac.acabamento })
                                setDifusorEscolhido(null)
                              }}
                            >
                              <span className="variante-medida-dim">{m.dimensao_m}m</span>
                              <span className="variante-medida-ref">{m.referencia}</span>
                              {m.preco != null && (
                                <span className="variante-medida-preco">{Number(m.preco).toFixed(2)} €</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="painel-vazio">Sem variantes disponíveis para este perfil.</p>
                )}
              </div>
            )}

            {varianteEscolhida && (
              <div className="painel-secao">
                <h3 className="painel-secao-titulo">
                  Difusor
                  <span className="painel-secao-subtitulo"> — {varianteEscolhida.dimensao_m}m (mesmo comprimento)</span>
                </h3>
                {difusoresFiltrados.length > 0 ? (
                  <div className="difusor-lista">
                    {difusoresFiltrados.map(d => (
                      <div key={d.difusor_id} className="difusor-grupo">
                        <p className="difusor-nome">{d.nome}</p>
                        {d.descricao && <p className="difusor-desc">{d.descricao}</p>}
                        <div className="difusor-variantes">
                          {d.variantes.map(v => (
                            <button
                              key={v.referencia}
                              className={`difusor-item-btn${difusorEscolhido?.referencia === v.referencia ? " selecionado" : ""}`}
                              onClick={() => setDifusorEscolhido({ ...v, difusor_nome: d.nome })}
                            >
                              <span className="difusor-item-ref">{v.referencia}</span>
                              <span className="difusor-item-dim">{v.comprimento_m}m</span>
                              {v.preco != null && (
                                <span className="difusor-item-preco">{Number(v.preco).toFixed(2)} €</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="painel-vazio">Sem difusores disponíveis para {varianteEscolhida.dimensao_m}m.</p>
                )}
              </div>
            )}

            {selecaoCompleta && (
              <div className="painel-secao painel-secao-acao">
                <div className="selecao-resumo-inline">
                  <span className="selecao-resumo-item">
                    <strong>Perfil:</strong> {perfilAtual?.nome}
                  </span>
                  <span className="selecao-resumo-sep">·</span>
                  <span className="selecao-resumo-item">
                    <strong>Variante:</strong> {varianteEscolhida.referencia}
                  </span>
                  <span className="selecao-resumo-sep">·</span>
                  <span className="selecao-resumo-item">
                    <strong>Difusor:</strong> {difusorEscolhido.referencia}
                  </span>
                </div>
                <button
                  className="btn-orcamento"
                  onClick={() => setMostrarForm(true)}
                >
                  Pedir Orçamento
                </button>
              </div>
            )}
          </>
        )}

      </div>

      {mostrarForm && (
        <FormOrcamento
          kit={kit}
          kitKey={kitKey}
          varianteEscolhida={varianteEscolhida}
          difusorEscolhido={difusorEscolhido}
          perfilAtual={perfilAtual}
          comprimentoTotal={comprimentoTotal}
          precoTotal={precoPersonalizado}
          textoOriginal={textoOriginal}
          onFechar={() => setMostrarForm(false)}
        />
      )}
    </>
  )
}


function FormOrcamento({ kit, kitKey, varianteEscolhida, difusorEscolhido, perfilAtual, comprimentoTotal, precoTotal, textoOriginal, onFechar }) {

  const [nome, setNome] = useState("")
  const [empresa, setEmpresa] = useState("")
  const [localidade, setLocalidade] = useState("")
  const [telefone, setTelefone] = useState("")
  const [email, setEmail] = useState("")
  const [captchaToken, setCaptchaToken] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState(null)

  const config = OPCOES_CONFIG.find(o => o.key === kitKey) ?? OPCOES_CONFIG[1]

  const enviar = async e => {
    e.preventDefault()
    setEnviando(true)
    setErro(null)

    try {
      const res = await fetch(`${API_URL}/api/orcamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          empresa: empresa.trim(),
          localidade: localidade.trim(),
          telefone: telefone.trim(),
          email: email.trim(),
          opcaoLabel: config.label,
          comprimentoTotal: comprimentoTotal ?? null,
          precoTotal,
          textoOriginal: textoOriginal ?? null,
          captchaToken,
          kit: {
            fita: kit.fita,
            perfil: perfilAtual,
            variante: varianteEscolhida,
            difusor: difusorEscolhido,
            controlador: kit.controlador,
            fonte: kit.fonte,
            comando: kit.comando,
          }
        })
      })

      const data = await res.json()
      if (data.sucesso) setSucesso(true)
      else setErro(data.erro || "Erro desconhecido.")
    } catch {
      setErro("Erro ao comunicar com o servidor.")
    } finally {
      setEnviando(false)
    }
  }

  const fitaPrecoTexto = kit.fita?.preco_metro != null && comprimentoTotal
    ? `${(Number(kit.fita.preco_metro) * comprimentoTotal).toFixed(2)} €`
    : kit.fita?.preco_metro != null
      ? `${Number(kit.fita.preco_metro).toFixed(2)} €/m`
      : null

  const linhasPreview = [
    { label: "Fita LED", nome: kit.fita?.nome, ref: kit.fita?.referencia, preco: fitaPrecoTexto },
    { label: "Perfil / Variante", nome: varianteEscolhida ? `${perfilAtual?.nome} — ${varianteEscolhida.acabamento} ${varianteEscolhida.dimensao_m}m` : perfilAtual?.nome,
      ref: varianteEscolhida?.referencia,
      preco: varianteEscolhida?.preco != null ? `${Number(varianteEscolhida.preco).toFixed(2)} €` : null },
    { label: "Difusor", nome: difusorEscolhido ? `${difusorEscolhido.difusor_nome} ${difusorEscolhido.comprimento_m}m` : null,
      ref: difusorEscolhido?.referencia,
      preco: difusorEscolhido?.preco != null ? `${Number(difusorEscolhido.preco).toFixed(2)} €` : null },
    { label: "Controlador", nome: kit.controlador?.sem_controlador ? null : kit.controlador?.nome, ref: kit.controlador?.referencia,
      preco: kit.controlador?.sem_controlador || kit.controlador?.preco == null ? null : `${Number(kit.controlador.preco).toFixed(2)} €` },
    { label: "Fonte", nome: kit.fonte?.nome, ref: kit.fonte?.referencia,
      preco: kit.fonte?.preco != null ? `${Number(kit.fonte.preco).toFixed(2)} €` : null },
    { label: "Comando", nome: kit.comando?.nome, ref: kit.comando?.referencia,
      preco: kit.comando?.preco != null ? `${Number(kit.comando.preco).toFixed(2)} €` : null },
  ].filter(l => l.nome)

  return (
    <div className="form-orcamento-overlay" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="form-orcamento">

        <div className="form-orcamento-header">
          <h2>Pedido de Orçamento</h2>
          <button className="form-orcamento-fechar" onClick={onFechar}>✕</button>
        </div>

        {sucesso ? (
          <div className="form-orcamento-sucesso">
            <p className="form-sucesso-icone">✓</p>
            <p className="form-sucesso-titulo">Orçamento enviado!</p>
            <p className="form-sucesso-desc">Receberá uma resposta em breve.</p>
            <p className="form-sucesso-desc">Obrigado por utilizar o nosso configurador.</p>
            <button className="btn-orcamento" onClick={onFechar}>Fechar</button>
          </div>
        ) : (
          <div className="form-orcamento-corpo">

            <div className="form-orcamento-preview">
              <h3 className="preview-titulo">Resumo da configuração — <span className={`preview-opcao-badge preview-opcao-badge-${kitKey}`}>{config.label}</span></h3>
              {comprimentoTotal && (
                <p className="preview-comprimento">Comprimento total: {comprimentoTotal}m</p>
              )}
              <div className="preview-lista">
                {linhasPreview.map((l, i) => (
                  <div key={i} className="preview-linha">
                    <div className="preview-linha-info">
                      <span className="preview-linha-label">{l.label}</span>
                      <span className="preview-linha-nome">{l.nome}</span>
                      {l.ref && <span className="preview-linha-ref">{l.ref}</span>}
                    </div>
                    {l.preco && <span className="preview-linha-preco">{l.preco}</span>}
                  </div>
                ))}
              </div>
              <div className="preview-total">
                <span>Total estimado</span>
                {kit.fita?.preco_metro != null
                  ? <span className="preview-total-valor">{Number(precoTotal).toFixed(2)} €</span>
                  : <span className="preview-total-valor preview-total-sob-consulta">Sob consulta</span>
                }
              </div>
            </div>

            <form className="form-orcamento-fields" onSubmit={enviar}>
              <h3 className="form-fields-titulo">Os seus dados</h3>

              <label className="form-label">
                Nome *
                <input
                  className="form-input"
                  type="text"
                  required
                  placeholder="Nome completo"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </label>

              <label className="form-label">
                Empresa
                <input
                  className="form-input"
                  type="text"
                  placeholder="Nome da empresa (opcional)"
                  value={empresa}
                  onChange={e => setEmpresa(e.target.value)}
                />
              </label>

              <label className="form-label">
                Localidade
                <input
                  className="form-input"
                  type="text"
                  placeholder="Cidade / Localidade"
                  value={localidade}
                  onChange={e => setLocalidade(e.target.value)}
                />
              </label>

              <label className="form-label">
                Telefone *
                <input
                  className="form-input"
                  type="tel"
                  required
                  placeholder="9XX XXX XXX"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value.replace(/[^\d\s+]/g, ""))}
                />
              </label>

              <label className="form-label">
                E-mail *
                <input
                  className="form-input"
                  type="email"
                  required
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </label>

              {erro && <p className="form-erro">{erro}</p>}


              <ReCAPTCHA
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                onChange={token => setCaptchaToken(token)}
                onExpired={() => setCaptchaToken(null)}
              />

              <button
                type="submit"
                className="btn-orcamento"
                disabled={enviando || !captchaToken}
              >
                {enviando ? "A enviar..." : "Enviar orçamento"}
              </button>
            </form>

          </div>
        )}

      </div>
    </div>
  )
}


function PecaCard({ label, peca, detalhes, avisoExtra }) {
  if (!peca || peca.sem_controlador) {
    return (
      <div className="kit-peca-ausente">
        <span>{label} — n/a</span>
      </div>
    )
  }

  if (peca.aviso) {
    return (
      <div className="kit-peca">
        <div className="kit-peca-label">{label}</div>
        <div className="kit-peca-aviso">{peca.aviso}</div>
      </div>
    )
  }

  const linhas = detalhes(peca)

  return (
    <div className="kit-peca">
      <div className="kit-peca-label">{label}</div>
      <div className="kit-peca-body">
        {peca.imagem_url ? (
          <img className="kit-peca-img" src={peca.imagem_url} alt={peca.nome} />
        ) : (
          <div className="kit-peca-sem-img">sem imagem</div>
        )}
        <div className="kit-peca-info">
          <p className="kit-peca-nome">{peca.nome}</p>
          <p className="kit-peca-ref">{peca.referencia}</p>
          {linhas.map((l, i) => (
            <p key={i} className="kit-peca-detalhe">{l}</p>
          ))}
          {peca.preco != null && (
            <p className="kit-peca-preco">{Number(peca.preco).toFixed(2)} €</p>
          )}
          {peca.preco_metro != null ? (
            <p className="kit-peca-preco">{Number(peca.preco_metro).toFixed(2)} €/m</p>
          ) : peca.preco == null && (
            <p className="kit-peca-sob-consulta">Sob consulta</p>
          )}
        </div>
      </div>
      {avisoExtra && <p className="kit-aviso-fonte">⚠ {avisoExtra}</p>}
    </div>
  )
}


function PecaCardCompacta({ label, peca }) {
  if (!peca || peca.sem_controlador) return null
  if (peca.aviso) {
    return (
      <div className="peca-compacta">
        <span className="peca-compacta-label">{label}</span>
        <span className="peca-compacta-nome kit-peca-aviso-compacto">{peca.aviso}</span>
      </div>
    )
  }
  return (
    <div className="peca-compacta">
      <span className="peca-compacta-label">{label}</span>
      <span className="peca-compacta-nome">{peca.nome}</span>
      <span className="peca-compacta-ref">{peca.referencia}</span>
    </div>
  )
}


// Detalhes por tipo de peça

const detalhesFita = peca => [
  peca.voltagem_v && `${peca.voltagem_v}V`,
  peca.ip && `IP${peca.ip}`,
  peca.tipos_cor ? peca.tipos_cor : "Branco",
  peca.temperatura_cor && `${peca.temperatura_cor}K`,
  peca.potencia_w_m && `${peca.potencia_w_m} W/m`,
  peca.eficiencia_lm_w && `${peca.eficiencia_lm_w} lm/W`,
  peca.cri && `CRI ${peca.cri}`,
].filter(Boolean)

const detalhesPerfil = peca => [
  peca.tipos_instalacao?.length && peca.tipos_instalacao.join(", "),
  peca.max_largura_fita_mm && `Fita máx. ${peca.max_largura_fita_mm} mm`,
  peca.potencia_max_w_m && `Pot. máx. ${peca.potencia_max_w_m} W/m`,
].filter(Boolean)

const detalhesControlador = peca => [
  peca.tipos_controlo?.length && peca.tipos_controlo.join(", "),
  peca.ip && `IP${peca.ip}`,
].filter(Boolean)

const detalhesFonte = peca => [
  peca.tensao_saida_v && `${peca.tensao_saida_v}V`,
  peca.potencia_w && `${peca.potencia_w}W`,
].filter(Boolean)

const detalhesComando = peca => [
  peca.tipos_controlo?.length && peca.tipos_controlo.join(", "),
].filter(Boolean)


export default Configurador
