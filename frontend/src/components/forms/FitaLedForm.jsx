import { API_URL } from '../../utils/api'
import { useState, useCallback } from "react"
import "./forms_css/Forms.css"
import Notificacao from "../Notificacao"
import CustomSelect from "./CustomSelect"
import ImageUpload from "./ImageUpload"

const subcategorias = [
  "ECOB",
  "EFFI",
  "EPRO",
  "EPRO-S",
  "ELIGHT",
  "EPORT"
]

function versaoVazia() {
  return {
    voltagem_v: "",
    ip: "",
    rolos: [""],
    ativo: true,
    imagem: null,
    imagem_url_atual: "",
    opcoes: []
  }
}

function opcaoVazia() {
  return {
    temperatura_cor: "",
    intensidade_luminosa_lm: "",
    preco_metro: "",
    ativo: true
  }
}

//para quando abrir com o editar
function estadoVersoes(dadosIniciais) {
  if (!dadosIniciais?.versoes?.length) return []
  return dadosIniciais.versoes.map(v => ({
    voltagem_v: String(v.voltagem_v ?? ""),
    ip: String(v.ip ?? ""),
    rolos: v.rolo_m ? String(v.rolo_m).split(", ").map(r => r.trim()) : [""],
    ativo: v.ativo ?? true,
    imagem: null,
    imagem_url_atual: v.imagem_url ?? "",
    opcoes: (v.opcoes ?? []).map(o => ({
      temperatura_cor: o.temperatura_cor ?? "",
      intensidade_luminosa_lm: String(o.intensidade_luminosa_lm ?? ""),
      preco_metro: String(o.preco_metro ?? ""),
      ativo: o.ativo ?? true
    }))
  }))
}

function FitaLedForm({ dadosIniciais }) {

  const modoEdicao = !!dadosIniciais

  const [produto, setProduto] = useState(() => ({
    referencia: dadosIniciais?.referencia ?? "",
    nome: dadosIniciais?.nome ?? "",
    categoria: dadosIniciais?.categoria ?? "fita_led",
    subcategoria: dadosIniciais?.subcategoria ?? "",
    descricao: dadosIniciais?.descricao ?? "",
    garantia_anos: dadosIniciais?.garantia_anos ?? "",
    imagem_url: null,
    imagem_extra_url: null,
    imagem_url_atual: dadosIniciais?.imagem_url ?? "",
    imagem_extra_url_atual: dadosIniciais?.imagem_extra_url ?? "",
    ficha_tecnica_url: dadosIniciais?.ficha_tecnica_url ?? ""
  }))

  const [fita, setFita] = useState(() => ({
    angulo_abertura: dadosIniciais?.angulo_abertura ?? "",
    dimavel: dadosIniciais?.dimavel ?? false,
    quantidade_leds_m: dadosIniciais?.quantidade_leds_m ?? "",
    cri: dadosIniciais?.cri ?? "",
    macadam: dadosIniciais?.macadam ?? "",
    tipo_led: dadosIniciais?.tipo_led ?? "",
    eficiencia_lm_w: dadosIniciais?.eficiencia_lm_w ?? "",
    horario_trabalho_h: dadosIniciais?.horario_trabalho_h ?? "",
    largura_mm: dadosIniciais?.largura_mm ?? "",
    altura_mm: dadosIniciais?.altura_mm ?? "",
    comprimento_corte_mm: dadosIniciais?.comprimento_corte_mm ?? "",
    potencia_w_m: dadosIniciais?.potencia_w_m ?? "",
    comprimento_max_alimentacao_m: dadosIniciais?.comprimento_max_alimentacao_m ?? "",
    comprimento_max_circuito_m: dadosIniciais?.comprimento_max_circuito_m ?? "",
    tipos_cor: dadosIniciais?.tipos_cor
      ? dadosIniciais.tipos_cor.split(" + ").map(t => t.trim())
      : []
  }))

  const [versoes, setVersoes] = useState(() => estadoVersoes(dadosIniciais))
  const [toast, setToast] = useState({ mensagem: "", tipo: "sucesso" })
  const [erros, setErros] = useState({})
  const fecharToast = useCallback(() => setToast(t => ({ ...t, mensagem: "" })), [])

  function alterarProduto(campo, valor) {
    setProduto(prev => ({ ...prev, [campo]: valor }))
  }

  function alterarFita(campo, valor) {
    setFita(prev => ({ ...prev, [campo]: valor }))
  }

  function toggleTipoCor(tipo) {
    setFita(prev => {
      const jaExiste = prev.tipos_cor.includes(tipo)
      return {
        ...prev,
        tipos_cor: jaExiste
          ? prev.tipos_cor.filter(t => t !== tipo)
          : [...prev.tipos_cor, tipo]
      }
    })
  }

  function adicionarVersao() {
    setVersoes(prev => [...prev, versaoVazia()])
  }

  function removerVersao(vIndex) {
    setVersoes(prev => prev.filter((_, i) => i !== vIndex))
  }

  function alterarVersao(vIndex, campo, valor) {
    setVersoes(prev => {
      const novos = structuredClone(prev)
      novos[vIndex][campo] = valor
      return novos
    })
  }

  function adicionarRolo(vIndex) {
    setVersoes(prev => {
      const novos = structuredClone(prev)
      novos[vIndex].rolos.push("")
      return novos
    })
  }

  function removerRolo(vIndex, rIndex) {
    setVersoes(prev => {
      const novos = structuredClone(prev)
      novos[vIndex].rolos = novos[vIndex].rolos.filter((_, i) => i !== rIndex)
      return novos
    })
  }

  function alterarRolo(vIndex, rIndex, valor) {
    setVersoes(prev => {
      const novos = structuredClone(prev)
      novos[vIndex].rolos[rIndex] = valor
      return novos
    })
  }

  function adicionarOpcao(vIndex) {
    setVersoes(prev => {
      const novos = structuredClone(prev)
      novos[vIndex].opcoes.push(opcaoVazia())
      return novos
    })
  }

  function removerOpcao(vIndex, oIndex) {
    setVersoes(prev => {
      const novos = structuredClone(prev)
      novos[vIndex].opcoes = novos[vIndex].opcoes.filter((_, i) => i !== oIndex)
      return novos
    })
  }

  function toggleOpcao(vIndex, oIndex) {
    setVersoes(prev => {
      const novos = structuredClone(prev)
      novos[vIndex].opcoes[oIndex].ativo = !novos[vIndex].opcoes[oIndex].ativo
      return novos
    })
  }

  function alterarOpcao(vIndex, oIndex, campo, valor) {
    setVersoes(prev => {
      const novos = structuredClone(prev)
      novos[vIndex].opcoes[oIndex][campo] = valor
      return novos
    })
  }

  async function guardar() {

    const novosErros = {}
    if (!produto.nome?.trim()) novosErros.nome = "O nome é obrigatório."
    if (!produto.subcategoria?.trim()) novosErros.subcategoria = "A subcategoria é obrigatória."
    if (!fita.potencia_w_m) novosErros.potencia_w_m = "A potência (W/m) é obrigatória."
    if (!fita.tipos_cor?.length) novosErros.tipos_cor = "O tipo de cor é obrigatório."
    if (Object.keys(novosErros).length > 0) { setErros(novosErros); return }
    setErros({})

    // Nome gerado automaticamente: "{subcategoria} {potencia}W {tipos_cor}"
    // Ex: "EPRO 24W CCT + RGB"
    const nomeGerado = fita.tipos_cor.length > 0
      ? `${produto.subcategoria} ${fita.potencia_w_m}W ${fita.tipos_cor.join(" + ")}`
      : `${produto.subcategoria} ${fita.potencia_w_m}W`

    const produtoPayload = {
      nome: nomeGerado,
      categoria: produto.categoria,
      subcategoria: produto.subcategoria,
      descricao: produto.descricao,
      garantia_anos: produto.garantia_anos,
      imagem_url_atual: produto.imagem_url_atual,
      imagem_extra_url_atual: produto.imagem_extra_url_atual,
      ficha_tecnica_url: produto.ficha_tecnica_url || null
    }

    const fitaPayload = {
      angulo_abertura: fita.angulo_abertura,
      dimavel: fita.dimavel,
      quantidade_leds_m: fita.quantidade_leds_m,
      cri: fita.cri,
      macadam: fita.macadam,
      tipo_led: fita.tipo_led,
      eficiencia_lm_w: fita.eficiencia_lm_w,
      horario_trabalho_h: fita.horario_trabalho_h,
      largura_mm: fita.largura_mm,
      altura_mm: fita.altura_mm,
      comprimento_corte_mm: fita.comprimento_corte_mm,
      potencia_w_m: fita.potencia_w_m,
      comprimento_max_alimentacao_m: fita.comprimento_max_alimentacao_m,
      comprimento_max_circuito_m: fita.comprimento_max_circuito_m,
      tipos_cor: fita.tipos_cor.join(" + ") || null
    }

    const versoesPayload = versoes.map(v => ({
      voltagem_v: v.voltagem_v,
      ip: v.ip,
      rolo_m: v.rolos.filter(r => r.trim() !== "").join(", "),
      ativo: v.ativo,
      imagem_url_atual: v.imagem_url_atual,
      opcoes: v.opcoes
    }))

    const formData = new FormData()
    formData.append("produto",JSON.stringify(produtoPayload))
    formData.append("fita",JSON.stringify(fitaPayload))
    formData.append("versoes",JSON.stringify(versoesPayload))

    if (produto.imagem_url) formData.append("imagem_url", produto.imagem_url)
    if (produto.imagem_extra_url) formData.append("imagem_extra_url", produto.imagem_extra_url)

    //imagens por versao
    versoes.forEach((v, i) => {
      if (v.imagem) formData.append(`imagem_versao_${i}`, v.imagem)
    })

    const url = modoEdicao
      ? `${API_URL}/api/fitas_led/${dadosIniciais.produto_id}`
      : `${API_URL}/api/fitas_led`
    const method = modoEdicao ? "PUT" : "POST"

    try {
      const res = await fetch(url, { method, credentials: "include", body: formData })
      const data = await res.json()

      if (!res.ok) {
        if (data.campo) setErros({ [data.campo]: data.erro })
        setToast({ mensagem: data.erro || data.detalhe || "Erro desconhecido", tipo: "erro" })
        return
      }

      setToast({ mensagem: modoEdicao ? "Fita atualizada com sucesso!" : "Fita criada com sucesso!", tipo: "sucesso" })
      setErros({})
    } catch (error) {
      setToast({ mensagem: "Erro de rede.", tipo: "erro" })
    }
  }

  return (
    <>
    <div className="form-container">

      <h2>{modoEdicao ? "Editar Fita LED" : "Nova Fita LED"}</h2>

      {/* Produto */}

      <label>Nome *</label>
      <input
        placeholder="Nome"
        value={produto.nome}
        onChange={e => { alterarProduto("nome", e.target.value); setErros(prev => ({ ...prev, nome: "" })) }}
        style={erros.nome ? { borderColor: "red" } : {}}
      />
      {erros.nome && <span className="campo-erro">{erros.nome}</span>}

      <label>Subcategoria *</label>
      <CustomSelect
        value={produto.subcategoria}
        onChange={e => { alterarProduto("subcategoria", e.target.value); setErros(prev => ({ ...prev, subcategoria: "" })) }}
      >
        <option value="">Selecionar...</option>
        {subcategorias.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </CustomSelect>
      {erros.subcategoria && <span className="campo-erro">{erros.subcategoria}</span>}

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
        label={`Imagem principal${modoEdicao && produto.imagem_url_atual ? " (substituir)" : ""}`}
        currentUrl={produto.imagem_url_atual}
        onChange={file => alterarProduto("imagem_url", file)}
      />

      <ImageUpload
        label={`Imagem extra${modoEdicao && produto.imagem_extra_url_atual ? " (substituir)" : ""}`}
        currentUrl={produto.imagem_extra_url_atual}
        onChange={file => alterarProduto("imagem_extra_url", file)}
      />

      {/*Especificações técnicas */}

      <h3>Especificações Técnicas</h3>

      <label>Tipo de LED</label>
      <input
        placeholder="ex: SMD2835"
        value={fita.tipo_led}
        onChange={e => alterarFita("tipo_led", e.target.value)}
      />

      <label>Ângulo de abertura (°)</label>
      <input
        type="number" step="0.1" min="0"
        placeholder="0"
        value={fita.angulo_abertura}
        onChange={e => alterarFita("angulo_abertura", e.target.value)}
      />

      <label>Quantidade de LEDs/m</label>
      <input
        type="number" min="0"
        placeholder="0"
        value={fita.quantidade_leds_m}
        onChange={e => alterarFita("quantidade_leds_m", e.target.value)}
      />

      <label>CRI</label>
      <input
        type="number" step="0.1" min="0"
        placeholder="0"
        value={fita.cri}
        onChange={e => alterarFita("cri", e.target.value)}
      />

      <label>MacAdam</label>
      <input
        type="number" step="0.1" min="0"
        placeholder="0"
        value={fita.macadam}
        onChange={e => alterarFita("macadam", e.target.value)}
      />

      <label>Eficiência (lm/W)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fita.eficiencia_lm_w}
        onChange={e => alterarFita("eficiencia_lm_w", e.target.value)}
      />

      <label>Potência (W/m) *</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fita.potencia_w_m}
        onChange={e => { alterarFita("potencia_w_m", e.target.value); setErros(prev => ({ ...prev, potencia_w_m: "" })) }}
        style={erros.potencia_w_m ? { borderColor: "red" } : {}}
      />
      {erros.potencia_w_m && <span className="campo-erro">{erros.potencia_w_m}</span>}

      <label>Horário de trabalho</label>
      <input
        placeholder="ex: 50000h"
        value={fita.horario_trabalho_h}
        onChange={e => alterarFita("horario_trabalho_h", e.target.value)}
      />

      <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={fita.dimavel}
          onChange={e => alterarFita("dimavel", e.target.checked)}
        />
        Dimável
      </label>

      <label>Largura (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fita.largura_mm}
        onChange={e => alterarFita("largura_mm", e.target.value)}
      />

      <label>Altura (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fita.altura_mm}
        onChange={e => alterarFita("altura_mm", e.target.value)}
      />

      <label>Comprimento de corte (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fita.comprimento_corte_mm}
        onChange={e => alterarFita("comprimento_corte_mm", e.target.value)}
      />

      <label>Comprimento máx. alimentação (m)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fita.comprimento_max_alimentacao_m}
        onChange={e => alterarFita("comprimento_max_alimentacao_m", e.target.value)}
      />

      <label>Comprimento máx. circuito (m)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={fita.comprimento_max_circuito_m}
        onChange={e => alterarFita("comprimento_max_circuito_m", e.target.value)}
      />

      <label>Tipo de cor *</label>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {["CCT", "W", "RGB", "DIGITAL"].map(tipo => (
          <label key={tipo} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="checkbox"
              checked={fita.tipos_cor.includes(tipo)}
              onChange={() => { toggleTipoCor(tipo); setErros(prev => ({ ...prev, tipos_cor: "" })) }}
            />
            {tipo}
          </label>
        ))}
      </div>
      {erros.tipos_cor && <span className="campo-erro">{erros.tipos_cor}</span>}

      {/*Versões - subform*/}
      <h2>Versões</h2>

      {versoes.map((v, vIndex) => (
        <div key={vIndex} className="sub-form">

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4>Versão {vIndex + 1}</h4>
            <button
              type="button"
              onClick={() => removerVersao(vIndex)}
              style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: "14px" }}
            >
              Remover
            </button>
          </div>

          <input
            type="number" min="0"
            placeholder="Voltagem (V)"
            value={v.voltagem_v}
            onChange={e => alterarVersao(vIndex, "voltagem_v", e.target.value)}
          />

          <input
            type="number" min="0"
            placeholder="IP"
            value={v.ip}
            onChange={e => alterarVersao(vIndex, "ip", e.target.value)}
          />

          <label>Rolos (m)</label>
          {v.rolos.map((rolo, rIndex) => (
            <div key={rIndex} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="number" step="0.01" min="0"
                placeholder="Tamanho do rolo (m)"
                value={rolo}
                onChange={e => alterarRolo(vIndex, rIndex, e.target.value)}
                style={{ flex: 1 }}
              />
              {v.rolos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerRolo(vIndex, rIndex)}
                  style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer" }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" className="form-button" onClick={() => adicionarRolo(vIndex)}>
            + Rolo
          </button>

          {modoEdicao && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={v.ativo}
                onChange={e => alterarVersao(vIndex, "ativo", e.target.checked)}
              />
              Ativo
            </label>
          )}

          <ImageUpload
            label={`Imagem${modoEdicao && v.imagem_url_atual ? " (substituir)" : ""}`}
            currentUrl={v.imagem_url_atual}
            onChange={file => alterarVersao(vIndex, "imagem", file)}
          />

          {/*Opções desta versão*/}
          <h4>Opções</h4>

          {v.opcoes.map((o, oIndex) => (
            <div key={oIndex} className="sub-form" style={{ padding: "10px 12px", gap: "8px" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={o.ativo}
                    onChange={() => toggleOpcao(vIndex, oIndex)}
                  />
                  Opção {oIndex + 1}
                </label>
                <button
                  type="button"
                  className="form-btn-remover"
                  onClick={() => removerOpcao(vIndex, oIndex)}
                >
                  ✕
                </button>
              </div>

              {o.ativo && (
                <div className="form-row">
                  <input
                    placeholder="Temperatura cor"
                    value={o.temperatura_cor}
                    onChange={e => alterarOpcao(vIndex, oIndex, "temperatura_cor", e.target.value)}
                  />
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="Intensidade (lm)"
                    value={o.intensidade_luminosa_lm}
                    onChange={e => alterarOpcao(vIndex, oIndex, "intensidade_luminosa_lm", e.target.value)}
                  />
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="Preço/metro"
                    value={o.preco_metro}
                    onChange={e => alterarOpcao(vIndex, oIndex, "preco_metro", e.target.value)}
                  />
                </div>
              )}

            </div>
          ))}

          <button type="button" className="form-button" onClick={() => adicionarOpcao(vIndex)}>
            + Opção
          </button>

        </div>
      ))}

      <button type="button" className="form-button" onClick={adicionarVersao}>
        + Adicionar Versão
      </button>

      <button className="form-button" onClick={guardar}>
        {modoEdicao ? "Guardar Alterações" : "Guardar Fita LED"}
      </button>

    </div>
    <Notificacao mensagem={toast.mensagem} tipo={toast.tipo} onClose={fecharToast} />
    </>
  )
}

export default FitaLedForm

