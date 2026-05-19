import { API_URL } from '../../utils/api'
import { useState, useCallback } from "react"
import "./forms_css/Forms.css"
import Notificacao from "../Notificacao"
import CustomSelect from "./CustomSelect"
import ImageUpload from "./ImageUpload"

const TIPOS_CONTROLO = ["Toque", "Movimento", "Passagem de mão"]
const TIPOLOGIAS_CONECTOR = ["MONO", "CCT", "RGB", "RGBW"]
const TIPOS_LIGACAO_CABO = ["Ligações de fio", "Ligações rápidas"]
const TIPOS_CLIPE = ["Clips", "Tampas e cola"]
const TIPOS_LIGADOR = ["Caixas de estanque e gel", "Ligações de fio"]
const TIPOS_FIXACAO = ["Dupla face", "Colas"]

function inferSubcategoria(d) {
  const tipo = d?.tipo_acessorio
  if (!tipo) return ""
  if (tipo === "interruptor") return "interruptores"
  if (["conector_uniao", "cabo_encaixe", "clipe_tampa", "ligador_fio", "fixacao_cola"].includes(tipo))
    return "ligacoes_fitas_led"
  return "cabos"
}

function produtoVazio(d) {
  return {
    referencia: d?.referencia ?? "",
    nome: d?.nome ?? "",
    descricao: d?.descricao ?? "",
    garantia_anos: d?.garantia_anos ?? "",
    imagem_url: null,
    imagem_extra_url: null,
    imagem_url_atual: d?.imagem_url ?? "",
    imagem_extra_url_atual: d?.imagem_extra_url ?? "",
    ficha_tecnica_url: d?.ficha_tecnica_url ?? "",
  }
}

function alt(setter, campo, valor) {
  setter(prev => ({ ...prev, [campo]: valor }))
}

function MultiCheck({ label, opcoes, selecionados, onChange }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {opcoes.map(op => (
          <label key={op} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selecionados.includes(op)}
              onChange={e => {
                if (e.target.checked) onChange([...selecionados, op])
                else onChange(selecionados.filter(x => x !== op))
              }}
            />
            {op}
          </label>
        ))}
      </div>
    </div>
  )
}

function ListaDinamica({ label, items, onChange, placeholder }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {items.map((v, i) => (
        <div key={i} className="form-row" style={{ marginBottom: "6px" }}>
          <input
            value={v}
            placeholder={placeholder}
            onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n) }}
          />
          <button type="button" className="form-btn-remover" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, ""])}>+ Adicionar</button>
    </div>
  )
}

function ListaPotencias({ items, onChange }) {
  function altPot(i, campo, valor) {
    const n = [...items]
    n[i] = { ...n[i], [campo]: valor }
    onChange(n)
  }
  return (
    <div>
      <h3>Potências de saída</h3>
      {items.map((p, i) => (
        <div key={i} className="form-row" style={{ marginBottom: "6px" }}>
          <input type="number" step="any" value={p.voltagem_v} placeholder="Tensão (V)"
            onChange={e => altPot(i, "voltagem_v", e.target.value)} />
          <input type="number" step="any" value={p.potencia_max_w} placeholder="Potência máx (W)"
            onChange={e => altPot(i, "potencia_max_w", e.target.value)} />
          <button type="button" className="form-btn-remover" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { voltagem_v: "", potencia_max_w: "" }])}>
        + Adicionar potência
      </button>
    </div>
  )
}

function ListaSaidas({ items, onChange }) {
  function altSaida(i, campo, valor) {
    const n = [...items]
    n[i] = { ...n[i], [campo]: valor }
    onChange(n)
  }
  return (
    <div className="form-group">
      <label>Tensões de saída</label>
      {items.map((s, i) => (
        <div key={i} className="form-row" style={{ marginBottom: "6px" }}>
          <input type="number" step="any" value={s.voltagem_v} placeholder="Tensão (V)"
            onChange={e => altSaida(i, "voltagem_v", e.target.value)} />
          <input type="number" step="any" value={s.potencia_max_w} placeholder="Potência (W)"
            onChange={e => altSaida(i, "potencia_max_w", e.target.value)} />
          <button type="button" className="form-btn-remover" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { voltagem_v: "", potencia_max_w: "" }])}>
        + Adicionar tensão de saída
      </button>
    </div>
  )
}

function ListaTensoes({ tensoes, onChange }) {
  const t = tensoes[0] || {}
  const mostraIntervalo = t.tem_intervalo === true

  function altEntrada(campo, valor) {
    onChange([{ ...t, [campo]: valor }])
  }

  function altSaida(j, campo, valor) {
    const n = { ...t }
    const pots = [...(n.potencias ?? [])]
    pots[j] = { ...pots[j], [campo]: valor }
    n.potencias = pots
    onChange([n])
  }

  function removeSaida(j) {
    const n = { ...t }
    n.potencias = (n.potencias ?? []).filter((_, k) => k !== j)
    onChange([n])
  }

  function addSaida() {
    const n = { ...t }
    n.potencias = [...(n.potencias ?? []), { voltagem_v: "", potencia_max_w: "" }]
    onChange([n])
  }

  return (
    <div className="form-group">
      <label>Tensão de entrada</label>

      <div className="form-row" style={{ marginBottom: "10px" }}>
        <CustomSelect
          value={t.tipo_tensao || "VDC"}
          onChange={e => altEntrada("tipo_tensao", e.target.value)}
          style={{ maxWidth: "100px" }}
        >
          <option value="VDC">VDC</option>
          <option value="VAC">VAC</option>
        </CustomSelect>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={mostraIntervalo}
            onChange={e => {
              onChange([{ ...t, tem_intervalo: e.target.checked, voltagem_v: "", voltagem_min_v: "", voltagem_max_v: "" }])
            }}
          />
          Intervalo
        </label>
      </div>

      {mostraIntervalo ? (
        <div className="form-row" style={{ marginBottom: "10px" }}>
          <input type="number" step="any" value={t.voltagem_min_v ?? ""} placeholder="Tensão mín (V)"
            onChange={e => altEntrada("voltagem_min_v", e.target.value)} />
          <input type="number" step="any" value={t.voltagem_max_v ?? ""} placeholder="Tensão máx (V)"
            onChange={e => altEntrada("voltagem_max_v", e.target.value)} />
        </div>
      ) : (
        <div style={{ marginBottom: "10px" }}>
          <input type="number" step="any" value={t.voltagem_v ?? ""} placeholder="Tensão (V)"
            onChange={e => altEntrada("voltagem_v", e.target.value)} />
        </div>
      )}

      <div className="sub-form">
        <h3>Tensões de saída</h3>

        <div className="form-group">
          <label>Corrente máxima (A)</label>
          <input type="number" step="any" value={t.corrente_max_a ?? ""} placeholder="Corrente máx (A)"
            onChange={e => altEntrada("corrente_max_a", e.target.value)} />
        </div>

        <label>Tensão (V) e Potência (W)</label>
        {(t.potencias ?? []).map((p, j) => (
          <div key={j} className="form-row" style={{ marginBottom: "6px" }}>
            <input type="number" step="any" value={p.voltagem_v ?? ""} placeholder="Tensão (V)"
              onChange={e => altSaida(j, "voltagem_v", e.target.value)} />
            <input type="number" step="any" value={p.potencia_max_w ?? ""} placeholder="Potência (W)"
              onChange={e => altSaida(j, "potencia_max_w", e.target.value)} />
            <button type="button" className="form-btn-remover" onClick={() => removeSaida(j)}>✕</button>
          </div>
        ))}
        <button type="button" className="form-btn-add" onClick={addSaida}>
          + Tensão/Potência
        </button>
      </div>
    </div>
  )
}

const TIPOS_LIGACOES = [
  { value: "conector_uniao", label: "Conector de União" },
  { value: "cabo_encaixe", label: "Cabo de Encaixe" },
  { value: "clipe_tampa", label: "Clipe e Tampa" },
  { value: "ligador_fio", label: "Ligador de Fio" },
  { value: "fixacao_cola", label: "Fixação e Cola" },
]

const TIPOS_CABOS = [
  { value: "fio_paralelo", label: "Fio Paralelo" },
  { value: "ficha", label: "Ficha" },
  { value: "manga", label: "Manga Termorretráctil" },
  { value: "ferro_solda", label: "Ferro e Solda" },
]

const SUBCATEGORIA_POR_TIPO = {
  interruptor: "interruptores",
  conector_uniao: "ligacoes_fitas_led",
  cabo_encaixe: "ligacoes_fitas_led",
  clipe_tampa: "ligacoes_fitas_led",
  ligador_fio: "ligacoes_fitas_led",
  fixacao_cola: "ligacoes_fitas_led",
  fio_paralelo: "cabos",
  ficha: "cabos",
  manga: "cabos",
  ferro_solda: "cabos",
}

const NOMES_BOTAO = {
  interruptor: "Criar interruptor",
  conector_uniao: "Criar conector de união",
  cabo_encaixe: "Criar cabo de encaixe",
  clipe_tampa: "Criar clipe e tampa",
  ligador_fio: "Criar ligador de fio",
  fixacao_cola: "Criar fixação e cola",
  fio_paralelo: "Criar fio paralelo",
  ficha: "Criar ficha",
  manga: "Criar manga",
  ferro_solda: "Criar ferro e solda",
}

function AcessorioForm({ dadosIniciais: d }) {
  const modoEdicao = !!d

  const [produto, setProduto] = useState(() => produtoVazio(d))
  const [subcategoria, setSubcategoria] = useState(() => inferSubcategoria(d))
  const [tipoAtivo, setTipoAtivo] = useState(() => d?.tipo_acessorio ?? "")
  const [preco, setPreco] = useState(() => d?.preco ?? "")
  const [toast, setToast] = useState({ mensagem: "", tipo: "sucesso" })
  const [erros, setErros] = useState({})
  const fecharToast = useCallback(() => setToast(t => ({ ...t, mensagem: "" })), [])

  const [interruptor, setInterruptor] = useState(() => ({
    tipologia: d?.especifico?.tipologia ?? "",
    cor: d?.especifico?.cor ?? "",
    sensor: d?.especifico?.sensor ?? "",
    cabo_m: d?.especifico?.cabo_mm ?? "", // DB column: cabo_mm
    distancia_min_m: d?.especifico?.distancia_min_m ?? "",
    distancia_max_m: d?.especifico?.distancia_max_m ?? "",
    tipos_controlo: d?.especifico?.tipos_controlo ?? [],
  }))
  const [tensoes, setTensoes] = useState(() =>
    d?.especifico?.tensoes?.length > 0
      ? d.especifico.tensoes
      : [{ tipo_tensao: "VDC", tem_intervalo: false, voltagem_v: "", voltagem_min_v: "", voltagem_max_v: "", corrente_max_a: "", potencias: [] }]
  )

  const [conectorUniao, setConectorUniao] = useState(() => ({
    material: d?.especifico?.material ?? "",
    tipo_conexao: d?.especifico?.tipo_conexao ?? "",
    tem_fio: d?.especifico?.tem_fio ?? false,
    corrente_a: d?.especifico?.corrente_a ?? "",
    largura_mm: d?.especifico?.largura_mm ?? "",
    numero_vias: d?.especifico?.numero_vias ?? "",
    tipologias: d?.especifico?.tipologias ?? [],
  }))

  const [caboEncaixe, setCaboEncaixe] = useState(() => ({
    tipologia: d?.especifico?.tipologia ?? "",
    tipo_ligacao: d?.especifico?.tipo_ligacao ?? "",
    ip: d?.especifico?.ip ?? "",
    corrente_a: d?.especifico?.corrente_a ?? "",
  }))

  const [clipeTampa, setClipeTampa] = useState(() => ({
    tipo: d?.especifico?.tipo ?? "",
    tipologia: d?.especifico?.tipologia ?? "",
    material: d?.especifico?.material ?? "",
  }))

  const [ligadorFio, setLigadorFio] = useState(() => ({
    tipo: d?.especifico?.tipo ?? "",
    tipologia: d?.especifico?.tipologia ?? "",
    unidades_por_caixa: d?.especifico?.unidades_por_caixa ?? "",
    voltagem_v: d?.especifico?.voltagem_v ?? "",
    ip: d?.especifico?.ip ?? "",
    capacidades: d?.especifico?.capacidades ?? [],
  }))

  const [fixacaoCola, setFixacaoCola] = useState(() => ({
    tipo: d?.especifico?.tipo ?? "",
    tipologia: d?.especifico?.tipologia ?? "",
    comprimento_mm: d?.especifico?.comprimento_mm ?? "",
    largura_mm: d?.especifico?.largura_mm ?? "",
    quantidade_ml: d?.especifico?.quantidade_ml ?? "",
    tempo_cura: d?.especifico?.tempo_cura ?? "",
    cor: d?.especifico?.cor ?? "",
    forca_psi: d?.especifico?.forca_psi ?? "",
    resistencias: d?.especifico?.resistencias ?? [],
  }))

  const [fioParalelo, setFioParalelo] = useState(() => ({
    tipologia: d?.especifico?.tipologias?.[0] ?? "",
    rolo_m: d?.especifico?.variantes?.[0]?.rolo_m?.toString() ?? "",
  }))

  const [ficha, setFicha] = useState(() => ({
    tipologia: d?.especifico?.tipologia ?? "",
    medida: d?.especifico?.medida ?? "",
    descricao_extra: d?.especifico?.descricao_extra ?? "",
  }))

  const [manga, setManga] = useState(() => ({
    diametro_normal_mm: d?.especifico?.diametro_normal_mm ?? "",
    diametro_pos_aquecimento_mm: d?.especifico?.diametro_pos_aquecimento_mm ?? "",
    rolo_m: d?.especifico?.rolo_m ?? "",
  }))

  const [ferroSolda, setFerroSolda] = useState(() => ({
    tipologia: d?.especifico?.tipologia ?? "",
    descricao_extra: d?.especifico?.descricao_extra ?? "",
  }))

  function selecionarSubcategoria(sub) {
    setSubcategoria(sub)
    setTipoAtivo(sub === "interruptores" ? "interruptor" : "")
  }

  async function guardar(e) {
    e.preventDefault()
    if (!tipoAtivo) { setToast({ mensagem: "Seleciona o tipo de acessório.", tipo: "erro" }); return }

    const novosErros = {}
    if (!produto.referencia?.trim()) novosErros.referencia = "A referência é obrigatória."
    if (!produto.nome?.trim() && tipoAtivo === "interruptor") novosErros.nome = "O nome é obrigatório."
    if (Object.keys(novosErros).length > 0) { setErros(novosErros); return }
    setErros({})

    const fd = new FormData()
    if (produto.imagem_url) fd.append("imagem_url", produto.imagem_url)
    if (produto.imagem_extra_url) fd.append("imagem_extra_url", produto.imagem_extra_url)

    fd.append("produto", JSON.stringify({
      referencia: produto.referencia,
      nome: produto.nome || produto.referencia,
      subcategoria: SUBCATEGORIA_POR_TIPO[tipoAtivo],
      descricao: produto.descricao,
      garantia_anos: produto.garantia_anos,
      imagem_url_atual: produto.imagem_url_atual,
      imagem_extra_url_atual: produto.imagem_extra_url_atual,
      ficha_tecnica_url: produto.ficha_tecnica_url || null,
    }))

    fd.append("acessorio", JSON.stringify({ tipo_acessorio: tipoAtivo, preco }))

    let especificoPayload = {}
    let variantesPayload = []

    switch (tipoAtivo) {
      case "interruptor":
        especificoPayload = { ...interruptor, tensoes }
        break
      case "conector_uniao":
        especificoPayload = { ...conectorUniao }
        break
      case "cabo_encaixe":
        especificoPayload = { ...caboEncaixe }
        break
      case "clipe_tampa":
        especificoPayload = { ...clipeTampa }
        break
      case "ligador_fio":
        especificoPayload = { ...ligadorFio }
        break
      case "fixacao_cola":
        especificoPayload = { ...fixacaoCola }
        break
      case "fio_paralelo":
        especificoPayload = { tipologias: fioParalelo.tipologia ? [fioParalelo.tipologia] : [] }
        if (fioParalelo.rolo_m) {
          variantesPayload = [{ referencia: `${fioParalelo.rolo_m}m`, rolo_m: fioParalelo.rolo_m, preco, ativo: true }]
        }
        break
      case "ficha":
        especificoPayload = { ...ficha }
        break
      case "manga":
        especificoPayload = { ...manga }
        break
      case "ferro_solda":
        especificoPayload = { ...ferroSolda }
        break
    }

    fd.append("especifico", JSON.stringify(especificoPayload))
    fd.append("variantes", JSON.stringify(variantesPayload))

    const url = modoEdicao
      ? `${API_URL}/api/acessorios/${d.produto_id}`
      : `${API_URL}/api/acessorios`
    const method = modoEdicao ? "PUT" : "POST"

    try {
      const res = await fetch(url, {
        method,
        credentials: "include",
        body: fd,
      })
      if (res.ok) {
        setToast({ mensagem: modoEdicao ? "Acessório atualizado com sucesso!" : "Acessório criado com sucesso!", tipo: "sucesso" })
        setErros({})
      } else {
        const err = await res.json()
        if (err.campo) setErros({ [err.campo]: err.erro })
        setToast({ mensagem: err.erro || err.detalhe || "Erro desconhecido", tipo: "erro" })
      }
    } catch (err) {
      setToast({ mensagem: "Erro de ligação: " + err.message, tipo: "erro" })
    }
  }

  function renderCamposEspecificos() {
    switch (tipoAtivo) {

      case "interruptor": return (
        <>
          <ListaTensoes tensoes={tensoes} onChange={setTensoes} />

          <MultiCheck
            label="Tipo de controlo"
            opcoes={TIPOS_CONTROLO}
            selecionados={interruptor.tipos_controlo}
            onChange={v => alt(setInterruptor, "tipos_controlo", v)}
          />

          <div className="form-group">
            <label>Tipologia</label>
            <input value={interruptor.tipologia}
              onChange={e => alt(setInterruptor, "tipologia", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Cabo (m) <span style={{ color: "#888", fontWeight: 400 }}>(opcional)</span></label>
            <input type="number" step="any" value={interruptor.cabo_m}
              onChange={e => alt(setInterruptor, "cabo_m", e.target.value)} />
          </div>

          {interruptor.tipos_controlo.includes("Movimento") && (
            <div className="form-group">
              <label>Distância de ação mín. (m)</label>
              <input type="number" step="any" value={interruptor.distancia_min_m}
                onChange={e => alt(setInterruptor, "distancia_min_m", e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label>Distância de ação máx. (m) <span style={{ color: "#888", fontWeight: 400 }}>(opcional)</span></label>
            <input type="number" step="any" value={interruptor.distancia_max_m}
              onChange={e => alt(setInterruptor, "distancia_max_m", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Sensor <span style={{ color: "#888", fontWeight: 400 }}>(opcional)</span></label>
            <input value={interruptor.sensor}
              onChange={e => alt(setInterruptor, "sensor", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Cor</label>
            <input value={interruptor.cor}
              onChange={e => alt(setInterruptor, "cor", e.target.value)} />
          </div>
        </>
      )

      case "conector_uniao": return (
        <>
          <div className="form-group">
            <label>Material</label>
            <input value={conectorUniao.material}
              onChange={e => alt(setConectorUniao, "material", e.target.value)} />
          </div>

          <MultiCheck
            label="Tipologias"
            opcoes={TIPOLOGIAS_CONECTOR}
            selecionados={conectorUniao.tipologias}
            onChange={v => alt(setConectorUniao, "tipologias", v)}
          />

          <div className="form-group">
            <label>Tipo de conexão</label>
            <CustomSelect
              value={conectorUniao.tipo_conexao}
              onChange={e => {
                const val = e.target.value
                const temFio = val === "cravar_com_fio" || val === "click_com_fio"
                setConectorUniao(prev => ({ ...prev, tipo_conexao: val, tem_fio: temFio }))
              }}
            >
              <option value="">-- selecionar --</option>
              <option value="cravar_sem_fio">Cravar (sem fio)</option>
              <option value="cravar_com_fio">Cravar (com fio)</option>
              <option value="click_com_fio">Click (com fio)</option>
              <option value="soldar">Soldar (sem fio)</option>
            </CustomSelect>
          </div>

          <div className="form-group">
            <label>Corrente (A)</label>
            <input type="number" step="any" value={conectorUniao.corrente_a}
              onChange={e => alt(setConectorUniao, "corrente_a", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Largura (mm)</label>
            <input type="number" step="any" value={conectorUniao.largura_mm}
              onChange={e => alt(setConectorUniao, "largura_mm", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Vias</label>
            <input type="number" value={conectorUniao.numero_vias}
              onChange={e => alt(setConectorUniao, "numero_vias", e.target.value)} />
          </div>
        </>
      )

      case "cabo_encaixe": return (
        <>
          <div className="form-group">
            <label>Tipo de ligação</label>
            <CustomSelect value={caboEncaixe.tipo_ligacao}
              onChange={e => alt(setCaboEncaixe, "tipo_ligacao", e.target.value)}>
              <option value="">-- selecionar --</option>
              {TIPOS_LIGACAO_CABO.map(t => <option key={t} value={t}>{t}</option>)}
            </CustomSelect>
          </div>

          <div className="form-group">
            <label>IP</label>
            <input type="number" value={caboEncaixe.ip}
              onChange={e => alt(setCaboEncaixe, "ip", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Tipologia</label>
            <input value={caboEncaixe.tipologia}
              onChange={e => alt(setCaboEncaixe, "tipologia", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Corrente (A)</label>
            <input type="number" step="any" value={caboEncaixe.corrente_a}
              onChange={e => alt(setCaboEncaixe, "corrente_a", e.target.value)} />
          </div>
        </>
      )

      case "clipe_tampa": return (
        <>
          <div className="form-group">
            <label>Tipo</label>
            <CustomSelect value={clipeTampa.tipo}
              onChange={e => alt(setClipeTampa, "tipo", e.target.value)}>
              <option value="">-- selecionar --</option>
              {TIPOS_CLIPE.map(t => <option key={t} value={t}>{t}</option>)}
            </CustomSelect>
          </div>

          <div className="form-group">
            <label>Tipologia</label>
            <input value={clipeTampa.tipologia}
              onChange={e => alt(setClipeTampa, "tipologia", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Material</label>
            <input value={clipeTampa.material}
              onChange={e => alt(setClipeTampa, "material", e.target.value)} />
          </div>
        </>
      )

      case "ligador_fio": return (
        <>
          <div className="form-group">
            <label>Tipo</label>
            <CustomSelect value={ligadorFio.tipo}
              onChange={e => alt(setLigadorFio, "tipo", e.target.value)}>
              <option value="">-- selecionar --</option>
              {TIPOS_LIGADOR.map(t => <option key={t} value={t}>{t}</option>)}
            </CustomSelect>
          </div>

          <div className="form-group">
            <label>Tipologia</label>
            <input value={ligadorFio.tipologia}
              onChange={e => alt(setLigadorFio, "tipologia", e.target.value)} />
          </div>

          <ListaDinamica
            label="Capacidades"
            items={ligadorFio.capacidades}
            onChange={v => alt(setLigadorFio, "capacidades", v)}
            placeholder="ex: 2x2C"
          />

          <div className="form-group">
            <label>Unidades por caixa</label>
            <input type="number" value={ligadorFio.unidades_por_caixa}
              onChange={e => alt(setLigadorFio, "unidades_por_caixa", e.target.value)} />
          </div>

          {ligadorFio.tipo === "Ligações de fio" && (
            <>
              <div className="form-group">
                <label>Voltagem (V)</label>
                <input type="number" step="any" value={ligadorFio.voltagem_v}
                  onChange={e => alt(setLigadorFio, "voltagem_v", e.target.value)} />
              </div>

              <div className="form-group">
                <label>IP</label>
                <input type="number" value={ligadorFio.ip}
                  onChange={e => alt(setLigadorFio, "ip", e.target.value)} />
              </div>
            </>
          )}
        </>
      )

      case "fixacao_cola": return (
        <>
          <div className="form-group">
            <label>Tipo</label>
            <CustomSelect value={fixacaoCola.tipo}
              onChange={e => alt(setFixacaoCola, "tipo", e.target.value)}>
              <option value="">-- selecionar --</option>
              {TIPOS_FIXACAO.map(t => <option key={t} value={t}>{t}</option>)}
            </CustomSelect>
          </div>

          <div className="form-group">
            <label>Tipologia</label>
            <input value={fixacaoCola.tipologia}
              onChange={e => alt(setFixacaoCola, "tipologia", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Comprimento (mm)</label>
            <input type="number" step="any" value={fixacaoCola.comprimento_mm}
              onChange={e => alt(setFixacaoCola, "comprimento_mm", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Largura (mm)</label>
            <input type="number" step="any" value={fixacaoCola.largura_mm}
              onChange={e => alt(setFixacaoCola, "largura_mm", e.target.value)} />
          </div>

          {fixacaoCola.tipo === "Colas" && (
            <>
              <div className="form-group">
                <label>Dimensões (ml)</label>
                <input type="number" step="any" value={fixacaoCola.quantidade_ml}
                  onChange={e => alt(setFixacaoCola, "quantidade_ml", e.target.value)} />
              </div>

              <div className="form-group">
                <label>Tempo de cura</label>
                <input value={fixacaoCola.tempo_cura} placeholder="ex: 24h"
                  onChange={e => alt(setFixacaoCola, "tempo_cura", e.target.value)} />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Cor</label>
            <input value={fixacaoCola.cor}
              onChange={e => alt(setFixacaoCola, "cor", e.target.value)} />
          </div>

          <ListaDinamica
            label="Resistências"
            items={fixacaoCola.resistencias}
            onChange={v => alt(setFixacaoCola, "resistencias", v)}
            placeholder="ex: UV"
          />

          <div className="form-group">
            <label>Força (PSI)</label>
            <input type="number" step="any" value={fixacaoCola.forca_psi}
              onChange={e => alt(setFixacaoCola, "forca_psi", e.target.value)} />
          </div>
        </>
      )

      case "fio_paralelo": return (
        <>
          <div className="form-group">
            <label>Tipologia</label>
            <input value={fioParalelo.tipologia}
              placeholder="ex: 2x0.5mmÂ²"
              onChange={e => setFioParalelo(prev => ({ ...prev, tipologia: e.target.value }))} />
          </div>

          <div className="form-group">
            <label>Medida de rolo (m)</label>
            <input type="number" step="any" value={fioParalelo.rolo_m}
              placeholder="ex: 100"
              onChange={e => setFioParalelo(prev => ({ ...prev, rolo_m: e.target.value }))} />
          </div>
        </>
      )

      case "ficha": return (
        <>
          <div className="form-group">
            <label>Tipologia</label>
            <input value={ficha.tipologia}
              onChange={e => alt(setFicha, "tipologia", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Medida</label>
            <input value={ficha.medida}
              onChange={e => alt(setFicha, "medida", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Descrição extra</label>
            <textarea value={ficha.descricao_extra}
              onChange={e => alt(setFicha, "descricao_extra", e.target.value)} />
          </div>
        </>
      )

      case "manga": return (
        <>
          <div className="form-group">
            <label>Diâmetro inicial (mm)</label>
            <input type="number" step="any" value={manga.diametro_normal_mm}
              onChange={e => alt(setManga, "diametro_normal_mm", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Diâmetro após aquecimento (mm)</label>
            <input type="number" step="any" value={manga.diametro_pos_aquecimento_mm}
              onChange={e => alt(setManga, "diametro_pos_aquecimento_mm", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Medida de rolo (m)</label>
            <input type="number" step="any" value={manga.rolo_m}
              onChange={e => alt(setManga, "rolo_m", e.target.value)} />
          </div>
        </>
      )

      case "ferro_solda": return (
        <>
          <div className="form-group">
            <label>Tipologia</label>
            <input value={ferroSolda.tipologia}
              onChange={e => alt(setFerroSolda, "tipologia", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Descrição extra</label>
            <textarea value={ferroSolda.descricao_extra}
              onChange={e => alt(setFerroSolda, "descricao_extra", e.target.value)} />
          </div>
        </>
      )

      default: return null
    }
  }

  return (
    <>
    <form onSubmit={guardar} className="form-container">

      {/* Subcategoria */}
      <div className="form-group">
        <label>Subcategoria</label>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[
            { value: "interruptores", label: "Interruptores" },
            { value: "ligacoes_fitas_led", label: "Ligações fitas LED" },
            { value: "cabos", label: "Cabos" },
          ].map(s => (
            <label key={s.value}
              style={{ display: "flex", alignItems: "center", gap: "4px", cursor: modoEdicao ? "default" : "pointer" }}>
              <input
                type="radio"
                name="subcategoria"
                value={s.value}
                checked={subcategoria === s.value}
                onChange={() => !modoEdicao && selecionarSubcategoria(s.value)}
                disabled={modoEdicao}
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      {/* Tipo — apenas para ligacoes_fitas_led e cabos */}
      {subcategoria === "ligacoes_fitas_led" && (
        <div className="form-group">
          <label>Tipo</label>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {TIPOS_LIGACOES.map(t => (
              <label key={t.value}
                style={{ display: "flex", alignItems: "center", gap: "4px", cursor: modoEdicao ? "default" : "pointer" }}>
                <input
                  type="radio"
                  name="tipo"
                  value={t.value}
                  checked={tipoAtivo === t.value}
                  onChange={() => !modoEdicao && setTipoAtivo(t.value)}
                  disabled={modoEdicao}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {subcategoria === "cabos" && (
        <div className="form-group">
          <label>Tipo</label>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {TIPOS_CABOS.map(t => (
              <label key={t.value}
                style={{ display: "flex", alignItems: "center", gap: "4px", cursor: modoEdicao ? "default" : "pointer" }}>
                <input
                  type="radio"
                  name="tipo"
                  value={t.value}
                  checked={tipoAtivo === t.value}
                  onChange={() => !modoEdicao && setTipoAtivo(t.value)}
                  disabled={modoEdicao}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Campos comuns + específicos */}
      {tipoAtivo && (
        <>
          <div className="form-group">
            <label>Referência *</label>
            <input
              value={produto.referencia}
              onChange={e => { alt(setProduto, "referencia", e.target.value); setErros(prev => ({ ...prev, referencia: "" })) }}
              style={erros.referencia ? { borderColor: "red" } : {}}
            />
            {erros.referencia && <span className="campo-erro">{erros.referencia}</span>}
          </div>

          {tipoAtivo === "interruptor" && (
            <div className="form-group">
              <label>Nome *</label>
              <input value={produto.nome}
                onChange={e => { alt(setProduto, "nome", e.target.value); setErros(prev => ({ ...prev, nome: "" })) }}
                style={erros.nome ? { borderColor: "red" } : {}}
              />
              {erros.nome && <span className="campo-erro">{erros.nome}</span>}
            </div>
          )}

          <div className="form-group">
            <label>Descrição</label>
            <textarea value={produto.descricao}
              onChange={e => alt(setProduto, "descricao", e.target.value)} />
          </div>

          <div className="form-group">
            <label>Ficha Técnica (URL do PDF)</label>
            <input type="url" placeholder="https://..."
              value={produto.ficha_tecnica_url}
              onChange={e => alt(setProduto, "ficha_tecnica_url", e.target.value)} />
          </div>

          <ImageUpload
            label={`Imagem principal${modoEdicao && produto.imagem_url_atual ? " (substituir)" : ""}`}
            currentUrl={produto.imagem_url_atual}
            onChange={file => alt(setProduto, "imagem_url", file)}
          />

          {renderCamposEspecificos()}

          <div className="form-group">
            <label>Preço (€)</label>
            <input type="number" step="0.01" value={preco}
              onChange={e => setPreco(e.target.value)} />
          </div>

          <button type="submit" className="form-button">
            {modoEdicao ? "Guardar alterações" : (NOMES_BOTAO[tipoAtivo] ?? "Criar acessório")}
          </button>
        </>
      )}

    </form>
    <Notificacao mensagem={toast.mensagem} tipo={toast.tipo} onClose={fecharToast} />
    </>
  )
}

export default AcessorioForm

