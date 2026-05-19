import { API_URL } from '../../utils/api'
import { useState, useCallback } from "react"
import "./forms_css/Forms.css"
import Notificacao from "../Notificacao"
import CustomSelect from "./CustomSelect"
import ImageUpload from "./ImageUpload"

function versaoVazia() {
  return {
    voltagem_v: "",
    ip: "",
    ativo: true,
    variantes: []
  }
}

function varianteVazia() {
  return {
    tipo_variante: "temperatura", // "temperatura" ou "cor"
    temperatura_cor: "",
    tipo_cor: "",
    intensidade_luminosa_lm: "",
    preco_metro: "",
    ativo: true
  }
}

// para quando abrir com o editar
function estadoVersao(dadosIniciais) {
  const v = dadosIniciais?.versoes?.[0]
  if (!v) return versaoVazia()
  return {
    voltagem_v: String(v.voltagem_v ?? ""),
    ip: String(v.ip ?? ""),
    ativo: v.ativo ?? true,
    variantes: (v.variantes ?? []).map(va => ({
      tipo_variante: va.temperatura_cor ? "temperatura" : "cor",
      temperatura_cor: String(va.temperatura_cor ?? ""),
      tipo_cor: va.tipo_cor ?? "",
      intensidade_luminosa_lm: String(va.intensidade_luminosa_lm ?? ""),
      preco_metro: String(va.preco_metro ?? ""),
      ativo: va.ativo ?? true
    }))
  }
}


function NeonForm({ dadosIniciais }) {

  const modoEdicao = !!dadosIniciais

  const [produto, setProduto] = useState(() => ({
    nome: dadosIniciais?.nome ?? "",
    descricao: dadosIniciais?.descricao ?? "",
    garantia_anos: dadosIniciais?.garantia_anos ?? "",
    imagem_url: null,
    imagem_extra_url: null,
    imagem_url_atual: dadosIniciais?.imagem_url ?? "",
    imagem_extra_url_atual: dadosIniciais?.imagem_extra_url ?? "",
    ficha_tecnica_url: dadosIniciais?.ficha_tecnica_url ?? ""
  }))

  const [modelo, setModelo] = useState(() => ({
    potencia_w_m: dadosIniciais?.potencia_w_m ?? "",
    angulo_abertura: dadosIniciais?.angulo_abertura ?? "",
    dimavel: dadosIniciais?.dimavel ?? false,
    quantidade_leds: dadosIniciais?.quantidade_leds ?? "",
    cri: dadosIniciais?.cri ?? "",
    macadam: dadosIniciais?.macadam ?? "",
    material: dadosIniciais?.material ?? "",
    horario_trabalho: dadosIniciais?.horario_trabalho ?? "",
    largura_mm: dadosIniciais?.largura_mm ?? "",
    altura_mm: dadosIniciais?.altura_mm ?? "",
    comprimento_max_alimentacao_unica_m: dadosIniciais?.comprimento_max_alimentacao_unica_m ?? "",
    comprimento_max_circuito_fechado_m: dadosIniciais?.comprimento_max_circuito_fechado_m ?? "",
    imagem_medidas_url: null,
    imagem_extra_modelo_url: null,
    imagem_medidas_url_atual: dadosIniciais?.imagem_medidas_url ?? "",
    imagem_extra_modelo_url_atual: dadosIniciais?.imagem_extra_modelo_url ?? ""
  }))

  const [dimensoes, setDimensoes] = useState(() => {
    const lista = dadosIniciais?.dimensoes ?? []
    return lista.length > 0 ? lista.map(d => String(d.comprimento_m ?? "")) : [""]
  })

  const [versao, setVersao] = useState(() => estadoVersao(dadosIniciais))
  const [toast, setToast] = useState({ mensagem: "", tipo: "sucesso" })
  const [erros, setErros] = useState({})
  const fecharToast = useCallback(() => setToast(t => ({ ...t, mensagem: "" })), [])

  function alterarProduto(campo, valor) {
    setProduto(prev => ({ ...prev, [campo]: valor }))
  }

  function alterarModelo(campo, valor) {
    setModelo(prev => ({ ...prev, [campo]: valor }))
  }

  function alterarDimensao(index, valor) {
    setDimensoes(prev => prev.map((d, i) => i === index ? valor : d))
  }

  function adicionarDimensao() {
    setDimensoes(prev => [...prev, ""])
  }

  function removerDimensao(index) {
    setDimensoes(prev => prev.filter((_, i) => i !== index))
  }

  function alterarVersao(campo, valor) {
    setVersao(prev => ({ ...prev, [campo]: valor }))
  }

  // Variantes
  function adicionarVariante() {
    setVersao(prev => {
      const novos = structuredClone(prev)
      novos.variantes.push(varianteVazia())
      return novos
    })
  }

  function removerVariante(vaIndex) {
    setVersao(prev => {
      const novos = structuredClone(prev)
      novos.variantes = novos.variantes.filter((_, i) => i !== vaIndex)
      return novos
    })
  }

  function alterarVariante(vaIndex, campo, valor) {
    setVersao(prev => {
      const novos = structuredClone(prev)
      novos.variantes[vaIndex][campo] = valor
      return novos
    })
  }

  function toggleVariante(vaIndex) {
    setVersao(prev => {
      const novos = structuredClone(prev)
      novos.variantes[vaIndex].ativo = !novos.variantes[vaIndex].ativo
      return novos
    })
  }

  async function guardar() {

    const novosErros = {}
    if (!produto.nome?.trim()) novosErros.nome = "O nome é obrigatório."
    if (!modelo.potencia_w_m) novosErros.potencia_w_m = "A potência (W/m) é obrigatória."
    if (Object.keys(novosErros).length > 0) { setErros(novosErros); return }
    setErros({})

    const produtoPayload = {
      nome: produto.nome,
      descricao: produto.descricao,
      garantia_anos: produto.garantia_anos,
      imagem_url_atual: produto.imagem_url_atual,
      imagem_extra_url_atual: produto.imagem_extra_url_atual,
      ficha_tecnica_url: produto.ficha_tecnica_url || null
    }

    const modeloPayload = {
      potencia_w_m: modelo.potencia_w_m,
      angulo_abertura: modelo.angulo_abertura,
      dimavel: modelo.dimavel,
      quantidade_leds: modelo.quantidade_leds,
      cri: modelo.cri,
      macadam: modelo.macadam,
      material: modelo.material,
      horario_trabalho: modelo.horario_trabalho,
      largura_mm: modelo.largura_mm,
      altura_mm: modelo.altura_mm,
      comprimento_max_alimentacao_unica_m: modelo.comprimento_max_alimentacao_unica_m,
      comprimento_max_circuito_fechado_m: modelo.comprimento_max_circuito_fechado_m,
      imagem_medidas_url_atual: modelo.imagem_medidas_url_atual,
      imagem_extra_modelo_url_atual: modelo.imagem_extra_modelo_url_atual
    }

    const dimensoesPayload = dimensoes
      .filter(d => d !== "")
      .map(d => ({ comprimento_m: parseFloat(d) }))

    const versoesPayload = [{
      voltagem_v: versao.voltagem_v,
      ip: versao.ip,
      ativo: versao.ativo,
      variantes: versao.variantes.map(va => ({
        tipo_cor: va.tipo_variante === "cor" ? va.tipo_cor : null,
        temperatura_cor: va.tipo_variante === "temperatura" ? va.temperatura_cor : null,
        intensidade_luminosa_lm: va.intensidade_luminosa_lm,
        preco_metro: va.preco_metro,
        ativo: va.ativo
      }))
    }]

    const formData = new FormData()
    formData.append("produto", JSON.stringify(produtoPayload))
    formData.append("modelo", JSON.stringify(modeloPayload))
    formData.append("dimensoes", JSON.stringify(dimensoesPayload))
    formData.append("versoes", JSON.stringify(versoesPayload))

    if (produto.imagem_url) formData.append("imagem_url", produto.imagem_url)
    if (produto.imagem_extra_url) formData.append("imagem_extra_url", produto.imagem_extra_url)
    if (modelo.imagem_medidas_url) formData.append("imagem_medidas_url", modelo.imagem_medidas_url)
    if (modelo.imagem_extra_modelo_url) formData.append("imagem_extra_modelo_url", modelo.imagem_extra_modelo_url)

    const url = modoEdicao
      ? `${API_URL}/api/neon/${dadosIniciais.produto_id}`
      : `${API_URL}/api/neon`
    const method = modoEdicao ? "PUT" : "POST"

    try {
      const res = await fetch(url, { method, credentials: "include", body: formData })
      const data = await res.json()

      if (!res.ok) {
        if (data.campo) setErros({ [data.campo]: data.erro })
        setToast({ mensagem: data.erro || data.detalhe || "Erro desconhecido", tipo: "erro" })
        return
      }

      setToast({ mensagem: modoEdicao ? "Neon atualizado com sucesso!" : "Neon criado com sucesso!", tipo: "sucesso" })
      setErros({})
    } catch (error) {
      setToast({ mensagem: "Erro de rede.", tipo: "erro" })
    }
  }

  return (
    <>
    <div className="form-container">

      <h2>{modoEdicao ? "Editar Neon" : "Novo Neon"}</h2>

      {/* Produto */}

      <label>Nome *</label>
      <input
        placeholder="Nome"
        value={produto.nome}
        onChange={e => { alterarProduto("nome", e.target.value); setErros(prev => ({ ...prev, nome: "" })) }}
        style={erros.nome ? { borderColor: "red" } : {}}
      />
      {erros.nome && <span className="campo-erro">{erros.nome}</span>}

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

      {/* Especificações Técnicas */}

      <h3>Especificações Técnicas</h3>

      <label>Potência (W/m) *</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={modelo.potencia_w_m}
        onChange={e => alterarModelo("potencia_w_m", e.target.value)}
      />

      <label>Ângulo de abertura (°)</label>
      <input
        type="number" step="0.1" min="0"
        placeholder="0"
        value={modelo.angulo_abertura}
        onChange={e => alterarModelo("angulo_abertura", e.target.value)}
      />

      <label>Quantidade de LEDs</label>
      <input
        type="number" min="0"
        placeholder="0"
        value={modelo.quantidade_leds}
        onChange={e => alterarModelo("quantidade_leds", e.target.value)}
      />

      <label>CRI</label>
      <input
        type="number" step="0.1" min="0"
        placeholder="0"
        value={modelo.cri}
        onChange={e => alterarModelo("cri", e.target.value)}
      />

      <label>MacAdam</label>
      <input
        type="number" step="0.1" min="0"
        placeholder="0"
        value={modelo.macadam}
        onChange={e => alterarModelo("macadam", e.target.value)}
      />

      <label>Material</label>
      <input
        placeholder="ex: Silicone"
        value={modelo.material}
        onChange={e => alterarModelo("material", e.target.value)}
      />

      <label>Horário de trabalho</label>
      <input
        placeholder="ex: 50000h"
        value={modelo.horario_trabalho}
        onChange={e => alterarModelo("horario_trabalho", e.target.value)}
      />

      <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={modelo.dimavel}
          onChange={e => alterarModelo("dimavel", e.target.checked)}
        />
        Dimável
      </label>

      <label>Largura (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={modelo.largura_mm}
        onChange={e => alterarModelo("largura_mm", e.target.value)}
      />

      <label>Altura (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={modelo.altura_mm}
        onChange={e => alterarModelo("altura_mm", e.target.value)}
      />

      <label>Comprimento máx. alimentação única (m)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={modelo.comprimento_max_alimentacao_unica_m}
        onChange={e => alterarModelo("comprimento_max_alimentacao_unica_m", e.target.value)}
      />

      <label>Comprimento máx. circuito fechado (m)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={modelo.comprimento_max_circuito_fechado_m}
        onChange={e => alterarModelo("comprimento_max_circuito_fechado_m", e.target.value)}
      />

      <ImageUpload
        label={`Imagem medidas${modoEdicao && modelo.imagem_medidas_url_atual ? " (substituir)" : ""}`}
        currentUrl={modelo.imagem_medidas_url_atual}
        onChange={file => alterarModelo("imagem_medidas_url", file)}
      />

      {/* Dimensão */}

      <h3>Dimensão</h3>

      <div className="sub-form">

        {dimensoes.map((val, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="number" step="0.01" min="0"
              placeholder="Dimensão (m)"
              value={val}
              onChange={e => alterarDimensao(i, e.target.value)}
            />
            {dimensoes.length > 1 && (
              <button
                type="button"
                className="form-btn-remover"
                onClick={() => removerDimensao(i)}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button type="button" className="form-button" onClick={adicionarDimensao}>
          + Dimensão
        </button>

      </div>

      {/* Versão */}

      <h3>Versão</h3>

      <div className="sub-form">

        <label>Voltagem (V)</label>
        <input
          type="number" min="0"
          placeholder="0"
          value={versao.voltagem_v}
          onChange={e => alterarVersao("voltagem_v", e.target.value)}
        />

        <label>IP</label>
        <input
          type="number" min="0"
          placeholder="0"
          value={versao.ip}
          onChange={e => alterarVersao("ip", e.target.value)}
        />

        {modoEdicao && (
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={versao.ativo}
              onChange={e => alterarVersao("ativo", e.target.checked)}
            />
            Ativo
          </label>
        )}

        {/* Variantes */}
        <h4>Variantes</h4>

        {versao.variantes.map((va, vaIndex) => (
          <div key={vaIndex} className="sub-form" style={{ padding: "10px 12px", gap: "8px" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="checkbox"
                  checked={va.ativo}
                  onChange={() => toggleVariante(vaIndex)}
                />
                Variante {vaIndex + 1}
              </label>
              <button
                type="button"
                className="form-btn-remover"
                onClick={() => removerVariante(vaIndex)}
              >
                ✕
              </button>
            </div>

            {va.ativo && (
              <>
                <CustomSelect
                  value={va.tipo_variante}
                  onChange={e => alterarVariante(vaIndex, "tipo_variante", e.target.value)}
                >
                  <option value="temperatura">Temperatura de cor (K)</option>
                  <option value="cor">Tipo de cor</option>
                </CustomSelect>

                {va.tipo_variante === "temperatura" ? (
                  <input
                    type="number" min="0"
                    placeholder="Temperatura (ex: 3000)"
                    value={va.temperatura_cor}
                    onChange={e => alterarVariante(vaIndex, "temperatura_cor", e.target.value)}
                  />
                ) : (
                  <input
                    placeholder="Cor (ex: RGB, VERDE)"
                    value={va.tipo_cor}
                    onChange={e => alterarVariante(vaIndex, "tipo_cor", e.target.value)}
                  />
                )}

                <input
                  type="number" step="0.01" min="0"
                  placeholder="Intensidade luminosa (lm/m)"
                  value={va.intensidade_luminosa_lm}
                  onChange={e => alterarVariante(vaIndex, "intensidade_luminosa_lm", e.target.value)}
                />

                <input
                  type="number" step="0.01" min="0"
                  placeholder="Preço/metro"
                  value={va.preco_metro}
                  onChange={e => alterarVariante(vaIndex, "preco_metro", e.target.value)}
                />
              </>
            )}

          </div>
        ))}

        <button type="button" className="form-button" onClick={adicionarVariante}>
          + Variante
        </button>

      </div>

      <button className="form-button" onClick={guardar}>
        {modoEdicao ? "Guardar Alterações" : "Guardar Neon"}
      </button>

    </div>
    <Notificacao mensagem={toast.mensagem} tipo={toast.tipo} onClose={fecharToast} />
    </>
  )
}

export default NeonForm

