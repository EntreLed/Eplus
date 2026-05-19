import { API_URL } from '../../utils/api'
import { useState, useCallback } from "react"
import "./forms_css/Forms.css"
import Notificacao from "../Notificacao"
import CustomSelect from "./CustomSelect"
import ImageUpload from "./ImageUpload"

const subcategorias = [
  "Superfície",
  "Luminária / suspensão",
  "Encastrar",
  "Canto",
  "Degraus",
  "Pladur / emassar",
  "Cerâmico"
]

const tiposInstalacao = [
  "Superficie",
  "Suspensão",
  "Canto",
  "Encastrar",
  "Pladur",
  "Escada",
  "Cerâmicos"
]

const acabamentosDisponiveis = [
  { id: 1, nome: "cizento anodizado", cor: "#9E9E9E" },
  { id: 2, nome: "preto", cor: "#1a1a1a" },
  { id: 3, nome: "branco", cor: "#FFFFFF" },
  { id: 4, nome: "ral", cor: "linear-gradient(135deg,#e74c3c,#f39c12,#2ecc71,#3498db)" }
]

const medidasPerfil = ["2m", "4m", "6m"]
const medidasDifusor = ["2m", "3m", "4m", "6m", "20m", "50m"]

const tiposDifusores = [
  "opalino",
  "opalino com aba",
  "opalino, silicone flexível",
  "transparente",
  "preto"
]

function estadoAcabamentos(dadosIniciais) {
  return acabamentosDisponiveis.map(a => {
    const dadosAcab = dadosIniciais?.acabamentos?.find(x => x.acabamento === a.nome)
    return {
      acabamento_id: a.id,
      nome: a.nome,
      medidas: Object.fromEntries(
        medidasPerfil.map(m => {
          const dim = parseFloat(m)
          const medidaExistente = dadosAcab?.medidas.find(x => parseFloat(x.dimensao_m) === dim)
          if (medidaExistente) {
            return [m, { ativo: true, preco: String(medidaExistente.preco ?? "") }]
          }
          return [m, { ativo: false, preco: "" }]
        })
      )
    }
  })
}

function estadoDifusores(dadosIniciais) {
  return tiposDifusores.map(nome => {
    const dadosDif = dadosIniciais?.difusores?.find(d => d.nome === nome)
    return {
      nome,
      medidas: Object.fromEntries(
        medidasDifusor.map(m => {
          const dim = parseFloat(m)
          const varianteExistente = dadosDif?.variantes?.find(v => parseFloat(v.comprimento_m) === dim)
          if (varianteExistente) {
            return [m, { ativo: true, referencia: varianteExistente.referencia ?? "", preco: String(varianteExistente.preco ?? "") }]
          }
          return [m, { ativo: false, referencia: "", preco: "" }]
        })
      )
    }
  })
}

function PerfilForm({ dadosIniciais }) {

  const modoEdicao = !!dadosIniciais

  const [produto, setProduto] = useState(() => ({
    nome: dadosIniciais?.nome ?? "",
    categoria: dadosIniciais?.categoria ?? "perfil",
    subcategoria: dadosIniciais?.subcategoria ?? "",
    descricao: dadosIniciais?.descricao ?? "",
    garantia_anos: dadosIniciais?.garantia_anos ?? "",
    imagem_url: null,
    imagem_extra_url: null,
    imagem_url_atual: dadosIniciais?.imagem_url ?? "",
    imagem_extra_url_atual: dadosIniciais?.imagem_extra_url ?? "",
    ficha_tecnica_url: dadosIniciais?.ficha_tecnica_url ?? ""
  }))

  const [perfil, setPerfil] = useState(() => ({
    material: dadosIniciais?.material ?? "",
    espacamento_interno_mm: dadosIniciais?.espacamento_interno_mm ?? "",
    largura_externa_mm: dadosIniciais?.largura_externa_mm ?? "",
    altura_externa_mm: dadosIniciais?.altura_externa_mm ?? "",
    potencia_max_w_m: dadosIniciais?.potencia_max_w_m ?? "",
    max_largura_fita_mm: dadosIniciais?.max_largura_fita_mm ?? "",
    max_quantidade_fitas: dadosIniciais?.max_quantidade_fitas ?? "",
    imagem_medidas_url: null,
    imagem_medidas_url_atual: dadosIniciais?.imagem_medidas_url ?? ""
  }))

  const [instalacoes, setInstalacoes] = useState(() => dadosIniciais?.instalacoes ?? [])
  const [acabamentosSelecionados, setAcabamentosSelecionados] = useState(() => estadoAcabamentos(dadosIniciais))
  const [difusores, setDifusores] = useState(() => estadoDifusores(dadosIniciais))
  const [toast, setToast] = useState({ mensagem: "", tipo: "sucesso" })
  const [erros, setErros] = useState({})
  const fecharToast = useCallback(() => setToast(t => ({ ...t, mensagem: "" })), [])

  function alterarProduto(campo, valor) {
    setProduto(prev => ({ ...prev, [campo]: valor }))
  }

  function alterarPerfil(campo, valor) {
    setPerfil(prev => ({ ...prev, [campo]: valor }))
  }

  function toggleInstalacao(tipo) {
    setInstalacoes(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    )
  }

  function toggleMedidaAcabamento(aIndex, medida) {
    setAcabamentosSelecionados(prev => {
      const novos = structuredClone(prev)
      novos[aIndex].medidas[medida].ativo = !novos[aIndex].medidas[medida].ativo
      return novos
    })
  }

  function alterarPrecoAcabamento(aIndex, medida, valor) {
    setAcabamentosSelecionados(prev => {
      const novos = structuredClone(prev)
      novos[aIndex].medidas[medida].preco = valor
      return novos
    })
  }

  function toggleMedidaDifusor(dIndex, medida) {
    setDifusores(prev => {
      const novos = structuredClone(prev)
      novos[dIndex].medidas[medida].ativo = !novos[dIndex].medidas[medida].ativo
      return novos
    })
  }

  function alterarPrecoDifusor(dIndex, medida, valor) {
    setDifusores(prev => {
      const novos = structuredClone(prev)
      novos[dIndex].medidas[medida].preco = valor
      return novos
    })
  }

  function alterarReferenciaDifusor(dIndex, medida, valor) {
    setDifusores(prev => {
      const novos = structuredClone(prev)
      novos[dIndex].medidas[medida].referencia = valor
      return novos
    })
  }

  async function guardar() {

    const novosErros = {}
    if (!produto.nome?.trim()) novosErros.nome = "O nome é obrigatório."
    if (!produto.subcategoria?.trim()) novosErros.subcategoria = "A subcategoria é obrigatória."
    if (!produto.imagem_url && !produto.imagem_url_atual) novosErros.imagem_url = "A imagem é obrigatória."
    if (Object.keys(novosErros).length > 0) { setErros(novosErros); return }
    setErros({})

    const produtoPayload = {
      nome: produto.nome,
      categoria: produto.categoria,
      subcategoria: produto.subcategoria,
      descricao: produto.descricao,
      garantia_anos: produto.garantia_anos,
      imagem_url_atual: produto.imagem_url_atual,
      imagem_extra_url_atual: produto.imagem_extra_url_atual,
      ficha_tecnica_url: produto.ficha_tecnica_url || null
    }

    const perfilPayload = {
      material: perfil.material,
      espacamento_interno_mm: perfil.espacamento_interno_mm,
      largura_externa_mm: perfil.largura_externa_mm,
      altura_externa_mm: perfil.altura_externa_mm,
      potencia_max_w_m: perfil.potencia_max_w_m,
      max_largura_fita_mm: perfil.max_largura_fita_mm,
      max_quantidade_fitas: perfil.max_quantidade_fitas,
      imagem_medidas_url_atual: perfil.imagem_medidas_url_atual
    }

    const formData = new FormData()
    formData.append("produto", JSON.stringify(produtoPayload))
    formData.append("perfil", JSON.stringify(perfilPayload))
    formData.append("instalacoes", JSON.stringify(instalacoes))
    formData.append("acabamentos", JSON.stringify(acabamentosSelecionados))
    formData.append("difusores", JSON.stringify(difusores))

    if (produto.imagem_url)
      formData.append("imagem_url", produto.imagem_url)
    if (produto.imagem_extra_url)
      formData.append("imagem_extra_url", produto.imagem_extra_url)
    if (perfil.imagem_medidas_url)
      formData.append("imagem_medidas_url", perfil.imagem_medidas_url)

    const url = modoEdicao ? `${API_URL}/api/perfis/${dadosIniciais.produto_id}` : `${API_URL}/api/perfis`
    const method = modoEdicao ? "PUT" : "POST"

    try {
      const res = await fetch(url, { method, credentials: "include", body: formData })
      const data = await res.json()

      if (!res.ok) {
        if (data.campo) setErros({ [data.campo]: data.erro })
        setToast({ mensagem: data.erro || data.detalhe || "Erro desconhecido", tipo: "erro" })
        return
      }

      setToast({ mensagem: modoEdicao ? "Perfil atualizado com sucesso!" : "Perfil criado com sucesso!", tipo: "sucesso" })
      setErros({})
    } catch (error) {
      setToast({ mensagem: "Erro de rede.", tipo: "erro" })
    }
  }

  return (
    <>
    <div className="form-container">

      <h2>{modoEdicao ? "Editar Perfil" : "Novo Perfil"}</h2>

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
        label={`Imagem principal *${modoEdicao && produto.imagem_url_atual ? " (substituir)" : ""}`}
        currentUrl={produto.imagem_url_atual}
        onChange={file => { alterarProduto("imagem_url", file); setErros(prev => ({ ...prev, imagem_url: "" })) }}
        error={erros.imagem_url}
      />

      <ImageUpload
        label={`Imagem extra${modoEdicao && produto.imagem_extra_url_atual ? " (substituir)" : ""}`}
        currentUrl={produto.imagem_extra_url_atual}
        onChange={file => alterarProduto("imagem_extra_url", file)}
      />

      <h4>Tipos de Instalação</h4>

      {tiposInstalacao.map(t => (
        <label key={t} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={instalacoes.includes(t)}
            onChange={() => toggleInstalacao(t)}
          />
          {t}
        </label>
      ))}

      <h3>Detalhes técnicos</h3>

      <label>Material</label>
      <input
        placeholder="ex: Alumínio"
        value={perfil.material}
        onChange={e => alterarPerfil("material", e.target.value)}
      />

      <label>Espaçamento interno (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={perfil.espacamento_interno_mm}
        onChange={e => alterarPerfil("espacamento_interno_mm", e.target.value)}
      />

      <label>Largura externa (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={perfil.largura_externa_mm}
        onChange={e => alterarPerfil("largura_externa_mm", e.target.value)}
      />

      <label>Altura externa (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={perfil.altura_externa_mm}
        onChange={e => alterarPerfil("altura_externa_mm", e.target.value)}
      />

      <label>Potência máxima (W/m)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={perfil.potencia_max_w_m}
        onChange={e => alterarPerfil("potencia_max_w_m", e.target.value)}
      />

      <label>Largura máx. fita (mm)</label>
      <input
        type="number" step="0.01" min="0"
        placeholder="0"
        value={perfil.max_largura_fita_mm}
        onChange={e => alterarPerfil("max_largura_fita_mm", e.target.value)}
      />

      <label>Nº máx. fitas</label>
      <input
        type="number" min="1"
        placeholder="1"
        value={perfil.max_quantidade_fitas}
        onChange={e => alterarPerfil("max_quantidade_fitas", e.target.value)}
      />

      <ImageUpload
        label={`Imagem de medidas${modoEdicao && perfil.imagem_medidas_url_atual ? " (substituir)" : ""}`}
        currentUrl={perfil.imagem_medidas_url_atual}
        onChange={file => alterarPerfil("imagem_medidas_url", file)}
      />

      <h2>Acabamentos do Perfil</h2>

      {acabamentosSelecionados.map((a, aIndex) => {
        const dadosAcab = acabamentosDisponiveis.find(x => x.id === a.acabamento_id)
        const isGradient = dadosAcab?.cor?.startsWith("linear-gradient")
        return (
        <div key={a.acabamento_id} className="sub-form">
          <h4 style={{ display: "flex", alignItems: "center" }}>
            <span
              className="acabamento-cor-dot"
              style={isGradient
                ? { background: dadosAcab.cor }
                : { background: dadosAcab?.cor ?? "#ccc" }
              }
            />
            {a.nome}
          </h4>

          {medidasPerfil.map(m => (
            <div key={m} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                checked={a.medidas[m].ativo}
                onChange={() => toggleMedidaAcabamento(aIndex, m)}
              />
              <label>{m}</label>

              {a.medidas[m].ativo && (
                <input
                  type="number" step="0.01" min="0"
                  placeholder="Preço"
                  value={a.medidas[m].preco}
                  onChange={e => alterarPrecoAcabamento(aIndex, m, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )})}

      <h2>Difusores</h2>

      {difusores.map((d, dIndex) => (
        <div key={d.nome} className="sub-form">
          <h4>{d.nome}</h4>

          {medidasDifusor.map(m => (
            <div key={m} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                checked={d.medidas[m].ativo}
                onChange={() => toggleMedidaDifusor(dIndex, m)}
              />
              <label>{m}</label>

              {d.medidas[m].ativo && (
                <>
                  <input
                    placeholder="Referência"
                    value={d.medidas[m].referencia}
                    onChange={e => alterarReferenciaDifusor(dIndex, m, e.target.value)}
                  />
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="Preço"
                    value={d.medidas[m].preco}
                    onChange={e => alterarPrecoDifusor(dIndex, m, e.target.value)}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      ))}

      <button className="form-button" onClick={guardar}>
        {modoEdicao ? "Guardar Alterações" : "Guardar Perfil"}
      </button>

    </div>
    <Notificacao mensagem={toast.mensagem} tipo={toast.tipo} onClose={fecharToast} />
    </>
  )
}

export default PerfilForm

