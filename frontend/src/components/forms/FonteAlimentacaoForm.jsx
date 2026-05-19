import { API_URL } from '../../utils/api'
import { useState, useCallback } from "react"
import "./forms_css/Forms.css"
import Notificacao from "../Notificacao"
import CustomSelect from "./CustomSelect"
import ImageUpload from "./ImageUpload"

const SUBCATEGORIAS = [
  "POS", "DIN", "WALL POWER", "FTPC DALI", "FTPC DALI-WP",
  "FTPC VFC", "FTPC FP", "FTPC PL/E", "GPV", "GLSV/GV6",
  "NFC DRIVER", "GTPC-S", "GTPC-D"
]

function certVazia() {
  return { modelo: "", novasImagens: [], imagensAtuais: [] }
}

function FonteAlimentacaoForm({ dadosIniciais }) {

  const modoEdicao = !!dadosIniciais

  const [produto, setProduto] = useState(() => ({
    referencia: dadosIniciais?.referencia ?? "",
    descricao: dadosIniciais?.descricao ?? "",
    garantia_anos: dadosIniciais?.garantia_anos ?? "",
    imagem_url: null,
    imagem_url_atual: dadosIniciais?.imagem_url ?? "",
    ficha_tecnica_url: dadosIniciais?.ficha_tecnica_url ?? ""
  }))

  const [fonte, setFonte] = useState(() => ({
    subcategoria: dadosIniciais?.subcategoria ?? "",
    potencia_w: dadosIniciais?.potencia_w ?? "",
    tensao_saida_v: dadosIniciais?.tensao_saida_v ?? "",
    corrente_saida_a: dadosIniciais?.corrente_saida_a ?? "",
    comprimento_mm: dadosIniciais?.comprimento_mm ?? "",
    largura_mm: dadosIniciais?.largura_mm ?? "",
    altura_mm: dadosIniciais?.altura_mm ?? "",
    preco: dadosIniciais?.preco ?? "",
    ip_rating: dadosIniciais?.ip_rating ?? ""
  }))

  // Certificações: [{modelo, novasImagens: [File], imagensAtuais: [url]}]
  const [certificacoes, setCertificacoes] = useState(() =>
    dadosIniciais?.certificacoes?.length > 0
      ? dadosIniciais.certificacoes.map(c => ({
          modelo: c.modelo ?? "",
          novasImagens: [],
          imagensAtuais: c.imagens ?? []
        }))
      : []
  )

  // Características: array de strings
  const [caracteristicas, setCaracteristicas] = useState(() =>
    dadosIniciais?.caracteristicas ?? []
  )
  const [toast, setToast] = useState({ mensagem: "", tipo: "sucesso" })
  const [erros, setErros] = useState({})
  const fecharToast = useCallback(() => setToast(t => ({ ...t, mensagem: "" })), [])

  function alterarProduto(campo, valor) {
    setProduto(prev => ({ ...prev, [campo]: valor }))
  }

  function alterarFonte(campo, valor) {
    setFonte(prev => ({ ...prev, [campo]: valor }))
  }

  // Certificações
  function adicionarCert() { setCertificacoes(prev => [...prev, certVazia()]) }
  function removerCert(i) { setCertificacoes(prev => prev.filter((_, idx) => idx !== i)) }

  function alterarCertModelo(i, valor) {
    setCertificacoes(prev => prev.map((c, idx) => idx === i ? { ...c, modelo: valor } : c))
  }

  function adicionarImagensCert(i, ficheiros) {
    setCertificacoes(prev => prev.map((c, idx) =>
      idx === i ? { ...c, novasImagens: [...c.novasImagens, ...ficheiros] } : c
    ))
  }

  function removerNovaImagemCert(certIdx, imgIdx) {
    setCertificacoes(prev => prev.map((c, idx) =>
      idx === certIdx
        ? { ...c, novasImagens: c.novasImagens.filter((_, i) => i !== imgIdx) }
        : c
    ))
  }

  function removerImagemAtualCert(certIdx, imgIdx) {
    setCertificacoes(prev => prev.map((c, idx) =>
      idx === certIdx
        ? { ...c, imagensAtuais: c.imagensAtuais.filter((_, i) => i !== imgIdx) }
        : c
    ))
  }

  // Características
  function adicionarCaract() { setCaracteristicas(prev => [...prev, ""]) }
  function removerCaract(i) { setCaracteristicas(prev => prev.filter((_, idx) => idx !== i)) }
  function alterarCaract(i, valor) {
    setCaracteristicas(prev => prev.map((c, idx) => idx === i ? valor : c))
  }

  async function guardar() {
    const novosErros = {}
    if (!produto.referencia?.trim()) novosErros.referencia = "A referência é obrigatória."
    if (!fonte.subcategoria?.trim()) novosErros.subcategoria = "A subcategoria é obrigatória."
    for (let i = 0; i < certificacoes.length; i++) {
      if (!certificacoes[i].modelo?.trim()) {
        novosErros[`cert_${i}`] = "O modelo da certificação é obrigatório."
      }
    }
    if (Object.keys(novosErros).length > 0) { setErros(novosErros); return }
    setErros({})

    const produtoPayload = {
      referencia: produto.referencia,
      descricao: produto.descricao,
      garantia_anos: produto.garantia_anos,
      imagem_url_atual: produto.imagem_url_atual,
      ficha_tecnica_url: produto.ficha_tecnica_url || null
    }

    const fontePayload = {
      subcategoria: fonte.subcategoria,
      potencia_w: fonte.potencia_w,
      tensao_saida_v: fonte.tensao_saida_v,
      corrente_saida_a: fonte.corrente_saida_a,
      comprimento_mm: fonte.comprimento_mm,
      largura_mm: fonte.largura_mm,
      altura_mm: fonte.altura_mm,
      preco: fonte.preco,
      ip_rating: fonte.ip_rating
    }

    // Certificações: enviar modelo + URLs a manter (novas imagens vão como ficheiros)
    const certificacoesPayload = certificacoes.map(c => ({
      modelo: c.modelo,
      imagens_manter: c.imagensAtuais
    }))

    const caracteristicasPayload = caracteristicas.filter(t => t.trim() !== "")

    const formData = new FormData()
    formData.append("produto", JSON.stringify(produtoPayload))
    formData.append("fonte", JSON.stringify(fontePayload))
    formData.append("certificacoes", JSON.stringify(certificacoesPayload))
    formData.append("caracteristicas", JSON.stringify(caracteristicasPayload))

    if (produto.imagem_url) formData.append("imagem_url", produto.imagem_url)

    // Múltiplas imagens por certificação: cert_imagem_{certIndex} (repetido)
    certificacoes.forEach((cert, i) => {
      cert.novasImagens.forEach(file => {
        formData.append(`cert_imagem_${i}`, file)
      })
    })

    const url = modoEdicao
      ? `${API_URL}/api/power/${dadosIniciais.produto_id}`
      : `${API_URL}/api/power`
    const method = modoEdicao ? "PUT" : "POST"

    try {
      const res = await fetch(url, {
        method,
        credentials: "include",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.campo) setErros({ [data.campo]: data.erro })
        setToast({ mensagem: data.erro || data.detalhe || "Erro desconhecido", tipo: "erro" })
        return
      }
      setToast({ mensagem: modoEdicao ? "Fonte de alimentação atualizada com sucesso!" : "Fonte de alimentação criada com sucesso!", tipo: "sucesso" })
      setErros({})
    } catch (error) {
      setToast({ mensagem: "Erro de rede.", tipo: "erro" })
    }
  }

  return (
    <>
    <div className="form-container">

      <h2>{modoEdicao ? "Editar Fonte de Alimentação" : "Nova Fonte de Alimentação"}</h2>

      {/* Referência */}

      <label>Referência *</label>
      <input
        placeholder="Referência"
        value={produto.referencia}
        onChange={e => { alterarProduto("referencia", e.target.value); setErros(prev => ({ ...prev, referencia: "" })) }}
        style={erros.referencia ? { borderColor: "red" } : {}}
      />
      {erros.referencia && <span className="campo-erro">{erros.referencia}</span>}

      <label>Descrição</label>
      <textarea
        placeholder="Descrição do produto"
        value={produto.descricao}
        onChange={e => alterarProduto("descricao", e.target.value)}
        style={{ resize: "none", height: "100px" }}
      />

      <label>Ficha Técnica (URL do PDF)</label>
      <input
        type="url"
        placeholder="https://..."
        value={produto.ficha_tecnica_url}
        onChange={e => alterarProduto("ficha_tecnica_url", e.target.value)}
      />

      <label>Garantia (anos)</label>
      <input
        type="number" min="0"
        placeholder="0"
        value={produto.garantia_anos}
        onChange={e => alterarProduto("garantia_anos", e.target.value)}
      />

      <ImageUpload
        label={`Imagem${modoEdicao && produto.imagem_url_atual ? " (substituir)" : ""}`}
        currentUrl={produto.imagem_url_atual}
        onChange={file => alterarProduto("imagem_url", file)}
      />

      {/* Especificações Técnicas */}

      <h3>Especificações Técnicas</h3>

      <label>Subcategoria *</label>
      <CustomSelect
        value={fonte.subcategoria}
        onChange={e => alterarFonte("subcategoria", e.target.value)}
      >
        <option value="">Selecionar...</option>
        {SUBCATEGORIAS.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </CustomSelect>

      <label>Potência (W)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fonte.potencia_w}
        onChange={e => alterarFonte("potencia_w", e.target.value)}
      />

      <label>Tensão de saída (V)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fonte.tensao_saida_v}
        onChange={e => alterarFonte("tensao_saida_v", e.target.value)}
      />

      <label>Corrente de saída (A)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fonte.corrente_saida_a}
        onChange={e => alterarFonte("corrente_saida_a", e.target.value)}
      />

      <label>Comprimento (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fonte.comprimento_mm}
        onChange={e => alterarFonte("comprimento_mm", e.target.value)}
      />

      <label>Largura (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fonte.largura_mm}
        onChange={e => alterarFonte("largura_mm", e.target.value)}
      />

      <label>Altura (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fonte.altura_mm}
        onChange={e => alterarFonte("altura_mm", e.target.value)}
      />

      <label>Preço (€)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fonte.preco}
        onChange={e => alterarFonte("preco", e.target.value)}
      />

      <label>IP Rating</label>
      <input
        placeholder="ex: IP65"
        value={fonte.ip_rating}
        onChange={e => alterarFonte("ip_rating", e.target.value)}
      />

      {/* Certificações */}

      <h3>Certificados</h3>

      <div className="sub-form">
        {certificacoes.map((cert, i) => (
          <div key={i} style={{ marginBottom: "10px", padding: "12px", border: "1.5px solid #DDE8E7", borderRadius: "6px", background: "#fff" }}>

            <div className="form-row" style={{ marginBottom: "8px" }}>
              <input
                placeholder="Modelo (ex: POS, ALM) *"
                value={cert.modelo}
                onChange={e => alterarCertModelo(i, e.target.value)}
              />
              <button type="button" className="form-btn-remover" onClick={() => removerCert(i)}>✕</button>
            </div>

            {/* Imagens actuais (modo edição) */}
            {cert.imagensAtuais.length > 0 && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                {cert.imagensAtuais.map((url, j) => (
                  <div key={j} style={{ position: "relative" }}>
                    <img src={url} alt={`cert ${i} img ${j}`} style={{ width: "60px", height: "60px", objectFit: "contain", borderRadius: "4px", border: "1px solid #eee" }} />
                    <button
                      type="button"
                      onClick={() => removerImagemAtualCert(i, j)}
                      style={{ position: "absolute", top: "-6px", right: "-6px", background: "#c0392b", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", cursor: "pointer", fontSize: "11px", lineHeight: "18px", padding: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pré-visualização de novas imagens */}
            {cert.novasImagens.length > 0 && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                {cert.novasImagens.map((file, j) => (
                  <div key={j} style={{ position: "relative" }}>
                    <img src={URL.createObjectURL(file)} alt="nova" style={{ width: "60px", height: "60px", objectFit: "contain", borderRadius: "4px", border: "1px solid #b2d8cf" }} />
                    <button
                      type="button"
                      onClick={() => removerNovaImagemCert(i, j)}
                      style={{ position: "absolute", top: "-6px", right: "-6px", background: "#c0392b", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", cursor: "pointer", fontSize: "11px", lineHeight: "18px", padding: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label style={{ fontSize: "13px", color: "#555", cursor: "pointer" }}>
              + Adicionar imagens
              <input
                type="file" accept="image/*" multiple
                style={{ display: "none" }}
                onChange={e => adicionarImagensCert(i, Array.from(e.target.files))}
              />
            </label>

          </div>
        ))}

        <button type="button" className="form-button" onClick={adicionarCert}>
          + Modelo Certificado
        </button>
      </div>

      {/* Características */}

      <h3>Características</h3>

      <div className="sub-form">
        {caracteristicas.map((texto, i) => (
          <div key={i} className="form-row" style={{ marginBottom: "6px" }}>
            <input
              placeholder="Característica (ex: Proteção contra curto-circuito)"
              value={texto}
              onChange={e => alterarCaract(i, e.target.value)}
            />
            <button type="button" className="form-btn-remover" onClick={() => removerCaract(i)}>✕</button>
          </div>
        ))}
        <button type="button" className="form-button" onClick={adicionarCaract}>
          + Característica
        </button>
      </div>

      <button className="form-button" onClick={guardar}>
        {modoEdicao ? "Guardar Alterações" : "Guardar Fonte de Alimentação"}
      </button>

    </div>
    <Notificacao mensagem={toast.mensagem} tipo={toast.tipo} onClose={fecharToast} />
    </>
  )
}

export default FonteAlimentacaoForm

