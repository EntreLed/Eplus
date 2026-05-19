import { API_URL } from '../../utils/api'
import { useCallback, useEffect, useState } from "react"
import "./forms_css/Forms.css"
import Notificacao from "../Notificacao"
import CustomSelect from "./CustomSelect"
import ImageUpload from "./ImageUpload"

const TIPOS_CONTROLO = ["MONO", "CCT", "RGB", "RGBW", "RGB CCT", "RGB DIGITAL(IC)", "RGBW DIGITAL(IC)", "Receivers e Drivers"]
const TIPOS_SINAL = ["RF", "Push-dim", "Gateway(wi-fi)", "Plug in", "PIR sensor"]
const CERTIFICACOES = ["CE", "RoHS", "CB", "TUV", "UL", "ETL", "FCC", "EAC"]

function entradaVazia() { return { tipo_input: "", voltagem_min: "", voltagem_max: "" } }
function saidaVazia() { return { numero_canais: "", amperes_por_canal: "" } }
function limiteVazio() { return { voltagem: "", potencia_max_w: "" } }

function parseAlimentacao(str) {
    if (!str) return ["", ""]
    const m = str.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/)
    return m ? [m[1], m[2]] : ["", str]
}

function produtoVazio(d) {
    return {
        nome: d?.nome ?? "",
        descricao: d?.descricao ?? "",
        garantia_anos: d?.garantia_anos ?? "",
        imagem_url: null,
        imagem_extra_url: null,
        imagem_url_atual: d?.imagem_url ?? "",
        imagem_extra_url_atual: d?.imagem_extra_url ?? "",
        ficha_tecnica_url: d?.ficha_tecnica_url ?? ""
    }
}

function controladorVazio(d) {
    return {
        ip: d?.ip ?? "",
        comprimento_mm: d?.comprimento_mm ?? "",
        largura_mm: d?.largura_mm ?? "",
        altura_mm: d?.altura_mm ?? "",
        cor: d?.cor ?? "",
        unidades_por_caixa: d?.unidades_por_caixa ?? "",
        certificacoes: Array.isArray(d?.certificacoes) ? d.certificacoes : (d?.certificacoes ? d.certificacoes.split(", ").filter(Boolean) : []),
        preco: d?.preco ?? ""
    }
}

function comandoVazio(d) {
    return {
        numero_zonas: d?.numero_zonas ?? "",
        cor: d?.cor ?? "",
        preco: d?.preco ?? ""
    }
}

function MultiCheck({ titulo, opcoes, selecionados, onChange }) {
    function toggle(op) {
        onChange(selecionados.includes(op)
            ? selecionados.filter(x => x !== op)
            : [...selecionados, op])
    }
    return (
        <div>
            <h3>{titulo}</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {opcoes.map(op => (
                    <label key={op} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={selecionados.includes(op)}
                            onChange={() => toggle(op)}
                        />
                        {op}
                    </label>
                ))}
            </div>
        </div>
    )
}

function CompatSelect({ titulo, itens, selecionados, onToggle, idKey, nomeKey }) {
    return (
        <div>
            <h3>{titulo}</h3>
            {itens.length === 0
                ? <p style={{ fontSize: 13, color: "#888" }}>Nenhum disponível</p>
                : <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                    {itens.map(item => (
                        <label key={item[idKey]} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={selecionados.includes(item[idKey])}
                                onChange={() => onToggle(item[idKey])}
                            />
                            {item[nomeKey]}
                        </label>
                    ))}
                </div>
            }
        </div>
    )
}

function ListaEntradas({ entradas, setEntradas }) {
    function alterar(campo, val) {
        setEntradas([{ ...entradas[0], [campo]: val }])
    }
    const e = entradas[0] || entradaVazia()
    return (
        <div>
            <h3>Entrada</h3>
            <div className="form-row">
                <CustomSelect value={e.tipo_input} onChange={ev => alterar("tipo_input", ev.target.value)}>
                    <option value="">Tipo input</option>
                    <option value="VDC">VDC</option>
                    <option value="VAC">VAC</option>
                </CustomSelect>
                <input placeholder="V mín" type="number" value={e.voltagem_min} onChange={ev => alterar("voltagem_min", ev.target.value)} />
                <input placeholder="V máx" type="number" value={e.voltagem_max} onChange={ev => alterar("voltagem_max", ev.target.value)} />
            </div>
        </div>
    )
}

function ListaSaidas({ saidas, setSaidas }) {
    function alterar(campo, val) {
        setSaidas([{ ...saidas[0], [campo]: val }])
    }
    const s = saidas[0] || saidaVazia()
    return (
        <div>
            <h3>Saída</h3>
            <div className="form-row">
                <input placeholder="Nº canais" type="number" value={s.numero_canais} onChange={ev => alterar("numero_canais", ev.target.value)} />
                <input placeholder="A/canal" type="number" value={s.amperes_por_canal} onChange={ev => alterar("amperes_por_canal", ev.target.value)} />
            </div>
        </div>
    )
}

function ListaLimites({ limites, setLimites }) {
    function alterar(i, campo, val) {
        setLimites(limites.map((l, j) => j === i ? { ...l, [campo]: val } : l))
    }
    return (
        <div>
            <h3>Limites de Potência</h3>
            {limites.map((l, i) => (
                <div key={i} className="form-row" style={{ marginTop: 4 }}>
                    <input placeholder="Potência máx (W)" type="number" value={l.potencia_max_w} onChange={ev => alterar(i, "potencia_max_w", ev.target.value)} />
                    <input placeholder="Voltagem (V)" type="number" value={l.voltagem} onChange={ev => alterar(i, "voltagem", ev.target.value)} />
                    <button type="button" className="form-btn-remover" onClick={() => setLimites(limites.filter((_, j) => j !== i))}>−</button>
                </div>
            ))}
            <button type="button" className="form-btn-add" style={{ marginTop: 8 }} onClick={() => setLimites([...limites, limiteVazio()])}>+ Limite</button>
        </div>
    )
}

function ListaFrequencias({ frequencias, setFrequencias }) {
    return (
        <div>
            <h3>Frequências</h3>
            {frequencias.map((f, i) => (
                <div key={i} className="form-row" style={{ marginTop: 4 }}>
                    <input placeholder="ex: 434 MHz" value={f} onChange={ev => setFrequencias(prev => prev.map((x, j) => j === i ? ev.target.value : x))} />
                    {frequencias.length > 1 && (
                        <button type="button" className="form-btn-remover" onClick={() => setFrequencias(prev => prev.filter((_, j) => j !== i))}>−</button>
                    )}
                </div>
            ))}
            <button type="button" className="form-btn-add" onClick={() => setFrequencias(prev => [...prev, ""])}>+ Frequência</button>
        </div>
    )
}

function ControladorForm({ dadosIniciais }) {

    const modoEdicao = !!dadosIniciais

    function inferirTipo() {
        if (!dadosIniciais) return "dispositivo"
        if (dadosIniciais.kit_controlador_id !== undefined) return "kit"
        if (dadosIniciais.subcategoria === "Comando") return "comando"
        return "dispositivo"
    }

    const [tipo, setTipo] = useState(inferirTipo)

    const [comandosDisponiveis, setComandosDisponiveis] = useState([])
    const [dispositivosDisponiveis, setDispositivosDisponiveis] = useState([])

    useEffect(() => {
        // standalone=true exclui remotes e receivers que já fazem parte de kits
        fetch(`${API_URL}/api/comandos?standalone=true`)
            .then(r => r.json()).then(setComandosDisponiveis).catch(() => {})
        fetch(`${API_URL}/api/controladores?standalone=true`)
            .then(r => r.json()).then(setDispositivosDisponiveis).catch(() => {})
    }, [])

    const [produto, setProduto] = useState(() => produtoVazio(dadosIniciais))
    const [controlador, setControlador] = useState(() => controladorVazio(dadosIniciais))
    const [entradas, setEntradas] = useState(() => dadosIniciais?.entradas?.length ? dadosIniciais.entradas : [entradaVazia()])
    const [saidas, setSaidas] = useState(() => dadosIniciais?.saidas?.length ? dadosIniciais.saidas : [saidaVazia()])
    const [limites, setLimites] = useState(() => dadosIniciais?.limites_potencia?.length ? dadosIniciais.limites_potencia : [limiteVazio()])
    const [tiposControlo, setTiposControlo] = useState(() => dadosIniciais?.tipos_controlo ?? [])
    const [tiposSinal, setTiposSinal] = useState(() => dadosIniciais?.tipos_sinal ?? [])
    const [compatDisp, setCompatDisp] = useState(() => dadosIniciais?.compatibilidades?.map(c => c.comando_id) ?? [])

    const [produtoCmd, setProdutoCmd] = useState(() => produtoVazio(tipo === "comando" ? dadosIniciais : null))
    const [comando, setComando] = useState(() => comandoVazio(tipo === "comando" ? dadosIniciais : null))
    const [entradasCmd, setEntradasCmd] = useState(() => tipo === "comando" && dadosIniciais?.entradas?.length ? dadosIniciais.entradas : [entradaVazia()])
    const [tiposControloCmd, setTiposControloCmd] = useState(() => tipo === "comando" ? (dadosIniciais?.tipos_controlo ?? []) : [])
    const [compatCmd, setCompatCmd] = useState(() => tipo === "comando" ? (dadosIniciais?.compatibilidades?.map(c => c.controlador_id) ?? []) : [])
    const [alimentacaoQtd, setAlimentacaoQtd] = useState(() => parseAlimentacao(tipo === "comando" ? dadosIniciais?.tipo_alimentacao : null)[0])
    const [alimentacaoTipo, setAlimentacaoTipo] = useState(() => parseAlimentacao(tipo === "comando" ? dadosIniciais?.tipo_alimentacao : null)[1])
    const [frequencias, setFrequencias] = useState(() => {
        if (tipo !== "comando") return modoEdicao ? [] : [""]
        // Novo schema: array de números em dadosIniciais.frequencias
        if (Array.isArray(dadosIniciais?.frequencias) && dadosIniciais.frequencias.length > 0)
            return dadosIniciais.frequencias.map(v => String(v))
        // Fallback legado: string separada por vírgula
        const f = dadosIniciais?.frequencia
        if (f) return f.split(",").map(s => s.trim()).filter(Boolean)
        return modoEdicao ? [] : [""]
    })

    const [kitGarantia, setKitGarantia] = useState(() => tipo === "kit" ? (dadosIniciais?.receiver?.receiver_garantia_anos ?? "") : "")
    const [kitTiposControlo, setKitTiposControlo] = useState(() => tipo === "kit" ? (dadosIniciais?.receiver?.receiver_tipos_controlo ?? []) : [])
    const [kitTiposSinal, setKitTiposSinal] = useState(() => tipo === "kit" ? (dadosIniciais?.receiver?.receiver_tipos_sinal ?? []) : [])
    const [kitFrequencias, setKitFrequencias] = useState(() => {
        if (tipo !== "kit") return [""]
        const freqs = dadosIniciais?.receiver?.receiver_frequencias
        return Array.isArray(freqs) && freqs.length > 0 ? freqs.map(v => String(v)) : [""]
    })

    const [receiverModo, setReceiverModo] = useState("novo")
    const [remoteModo, setRemoteModo] = useState("novo")
    const [receiverExistenteId, setReceiverExistenteId] = useState("")
    const [remoteExistenteId, setRemoteExistenteId] = useState("")

    const [kitProduto, setKitProduto] = useState(() => ({
        nome: dadosIniciais?.nome ?? "",
        preco: dadosIniciais?.preco ?? ""
    }))

    const [receiver, setReceiver] = useState(() => {
        const r = dadosIniciais?.receiver
        return {
            descricao: r?.receiver_descricao ?? "",
            ficha_tecnica_url: r?.receiver_ficha_tecnica_url ?? "",
            imagem_url: null,
            imagem_extra_url: null,
            imagem_url_atual: r?.receiver_imagem_url ?? "",
            imagem_extra_url_atual: r?.receiver_imagem_extra_url ?? "",
            ip: r?.ip ?? "",
            comprimento_mm: r?.comprimento_mm ?? "",
            largura_mm: r?.largura_mm ?? "",
            altura_mm: r?.altura_mm ?? "",
            cor: r?.cor ?? "",
            unidades_por_caixa: r?.unidades_por_caixa ?? "",
            certificacoes: Array.isArray(r?.certificacoes) ? r.certificacoes : (r?.certificacoes ? r.certificacoes.split(", ").filter(Boolean) : []),
            entradas: r?.entradas?.length ? r.entradas : [entradaVazia()],
            saidas: r?.saidas?.length ? r.saidas : [saidaVazia()],
            limites_potencia: r?.limites?.length ? r.limites : [limiteVazio()]
        }
    })

    const [remote, setRemote] = useState(() => {
        const rm = dadosIniciais?.remote
        return {
            descricao: rm?.remote_descricao ?? "",
            ficha_tecnica_url: rm?.remote_ficha_tecnica_url ?? "",
            imagem_url: null,
            imagem_extra_url: null,
            imagem_url_atual: rm?.remote_imagem_url ?? "",
            imagem_extra_url_atual: rm?.remote_imagem_extra_url ?? "",
            tipo_alimentacao: rm?.tipo_alimentacao ?? "",
            comprimento_mm: rm?.remote_comprimento_mm ?? "",
            largura_mm: rm?.remote_largura_mm ?? "",
            altura_mm: rm?.remote_altura_mm ?? "",
            cor: rm?.remote_cor ?? "",
            certificacoes: Array.isArray(rm?.remote_certificacoes) ? rm.remote_certificacoes : (rm?.remote_certificacoes ? String(rm.remote_certificacoes).split(", ").filter(Boolean) : [])
        }
    })

    function alt(setter, campo, valor) {
        setter(prev => ({ ...prev, [campo]: valor }))
    }

    function toggleCompat(setList, id) {
        const n = Number(id)
        setList(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
    }

    const [toast, setToast] = useState({ mensagem: "", tipo: "sucesso" })
    const [errosDisp, setErrosDisp] = useState({})
    const [erroComando, setErroComando] = useState(null)
    const [errosKit, setErrosKit] = useState({})
    const fecharToast = useCallback(() => setToast(t => ({ ...t, mensagem: "" })), [])

    async function guardarDispositivo(e) {
        e.preventDefault()
        if (!produto.nome?.trim()) { setErrosDisp({ nome: "O nome é obrigatório." }); return }
        setErrosDisp({})

        const fd = new FormData()
        fd.append("produto", JSON.stringify({ nome: produto.nome, descricao: produto.descricao, garantia_anos: produto.garantia_anos, imagem_url_atual: produto.imagem_url_atual, imagem_extra_url_atual: produto.imagem_extra_url_atual, ficha_tecnica_url: produto.ficha_tecnica_url || null }))
        fd.append("controlador", JSON.stringify({ ...controlador }))
        fd.append("entradas", JSON.stringify(entradas))
        fd.append("saidas", JSON.stringify(saidas))
        fd.append("limites_potencia", JSON.stringify(limites))
        fd.append("tipos_controlo", JSON.stringify(tiposControlo))
        fd.append("tipos_sinal", JSON.stringify(tiposSinal))
        fd.append("compatibilidades", JSON.stringify(compatDisp))
        if (produto.imagem_url) fd.append("imagem_url", produto.imagem_url)
        if (produto.imagem_extra_url) fd.append("imagem_extra_url", produto.imagem_extra_url)

        const url = modoEdicao ? `${API_URL}/api/controladores/${dadosIniciais.produto_id}` : `${API_URL}/api/controladores`
        const method = modoEdicao ? "PUT" : "POST"

        try {
            const res = await fetch(url, { method, body: fd, credentials: "include" })
            const data = await res.json()
            if (!res.ok) {
                if (data.campo) setErrosDisp({ [data.campo]: data.erro })
                setToast({ mensagem: data.erro || data.detalhe || "Erro", tipo: "erro" })
                return
            }
            setToast({ mensagem: modoEdicao ? "Dispositivo atualizado com sucesso!" : "Dispositivo criado com sucesso!", tipo: "sucesso" })
            setErrosDisp({})
        } catch { setToast({ mensagem: "Erro de ligação", tipo: "erro" }) }
    }

    async function guardarComando(e) {
        e.preventDefault()
        setErroComando(null)
        if (!produtoCmd.nome?.trim()) return setErroComando("O nome é obrigatório.")

        const tipo_alimentacao = [alimentacaoQtd, alimentacaoTipo].filter(Boolean).join(" ") || null
        const frequenciasNumericas = frequencias.map(v => parseFloat(v)).filter(v => isFinite(v))

        const fd = new FormData()
        fd.append("produto", JSON.stringify({ nome: produtoCmd.nome, descricao: produtoCmd.descricao, garantia_anos: produtoCmd.garantia_anos, imagem_url_atual: produtoCmd.imagem_url_atual, imagem_extra_url_atual: produtoCmd.imagem_extra_url_atual, ficha_tecnica_url: produtoCmd.ficha_tecnica_url || null }))
        fd.append("comando", JSON.stringify({ ...comando, tipo_alimentacao, frequencias: frequenciasNumericas }))
        fd.append("entradas", JSON.stringify(entradasCmd))
        fd.append("tipos_controlo", JSON.stringify(tiposControloCmd))
        fd.append("compatibilidades", JSON.stringify(compatCmd))
        if (produtoCmd.imagem_url) fd.append("imagem_url", produtoCmd.imagem_url)
        if (produtoCmd.imagem_extra_url) fd.append("imagem_extra_url", produtoCmd.imagem_extra_url)

        const url = modoEdicao ? `${API_URL}/api/comandos/${dadosIniciais.produto_id}` : `${API_URL}/api/comandos`
        const method = modoEdicao ? "PUT" : "POST"

        try {
            const res = await fetch(url, { method, body: fd, credentials: "include" })
            const data = await res.json()
            if (!res.ok) { setErroComando(data.erro || data.detalhe || "Erro desconhecido."); return }
            setToast({ mensagem: modoEdicao ? "Comando atualizado com sucesso!" : "Comando criado com sucesso!", tipo: "sucesso" })
            setErroComando(null)
        } catch { setErroComando("Erro de ligação ao servidor.") }
    }

    const kitNome = `EASY${kitTiposControlo.length ? "-" + kitTiposControlo.join("-") : ""}`

    async function guardarKit(e) {
        e.preventDefault()
        const novosErrosKit = {}
        if (kitTiposControlo.length === 0) novosErrosKit.tipos_controlo = "Seleciona pelo menos um tipo de controlo."
        if (receiverModo === "existente" && !receiverExistenteId) novosErrosKit.receiver = "Seleciona um dispositivo existente."
        if (remoteModo === "existente" && !remoteExistenteId) novosErrosKit.remote = "Seleciona um comando existente."
        if (Object.keys(novosErrosKit).length > 0) { setErrosKit(novosErrosKit); return }
        setErrosKit({})

        const kitFreqNums = kitFrequencias.map(v => parseFloat(v)).filter(v => isFinite(v))

        const receiverPayload = receiverModo === "existente"
            ? { controlador_id: receiverExistenteId }
            : { ...receiver, garantia_anos: kitGarantia, tipos_controlo: kitTiposControlo, tipos_sinal: kitTiposSinal, frequencias: kitFreqNums }

        const remotePayload = remoteModo === "existente"
            ? { comando_id: remoteExistenteId }
            : { ...remote, garantia_anos: kitGarantia, tipos_controlo: kitTiposControlo, frequencias: kitFreqNums }

        const fd = new FormData()
        fd.append("produto", JSON.stringify({ nome: kitNome, preco: kitProduto.preco }))
        fd.append("receiver", JSON.stringify(receiverPayload))
        fd.append("remote", JSON.stringify(remotePayload))
        if (receiverModo === "novo" && receiver.imagem_url) fd.append("receiver_imagem_url", receiver.imagem_url)
        if (receiverModo === "novo" && receiver.imagem_extra_url) fd.append("receiver_imagem_extra_url", receiver.imagem_extra_url)
        if (remoteModo === "novo" && remote.imagem_url) fd.append("remote_imagem_url", remote.imagem_url)
        if (remoteModo === "novo" && remote.imagem_extra_url) fd.append("remote_imagem_extra_url", remote.imagem_extra_url)

        const url = modoEdicao ? `${API_URL}/api/kits/${dadosIniciais.produto_id}` : `${API_URL}/api/kits`
        const method = modoEdicao ? "PUT" : "POST"

        try {
            const res = await fetch(url, { method, body: fd, credentials: "include" })
            const data = await res.json()
            if (!res.ok) {
                setToast({ mensagem: data.erro || data.detalhe || "Erro", tipo: "erro" })
                return
            }
            setToast({ mensagem: modoEdicao ? "Kit atualizado com sucesso!" : "Kit criado com sucesso!", tipo: "sucesso" })
            setErrosKit({})
        } catch { setToast({ mensagem: "Erro de ligação", tipo: "erro" }) }
    }

    return (
        <>
        <div className="form-container">

            {!modoEdicao && (
                <h2>Novo {tipo === "comando" ? "Comando" : tipo === "kit" ? "Kit" : "Controlador"}</h2>
            )}

            {/* seletor de tipo, só visível na criação */}
            {!modoEdicao && (
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                    {[
                        { valor: "dispositivo", label: "Outro dispositivo (receiver / amp / driver)" },
                        { valor: "comando", label: "Comando / Remote" },
                        { valor: "kit", label: "Kit" }
                    ].map(op => (
                        <label key={op.valor} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                            <input
                                type="radio"
                                name="tipo_controlador"
                                value={op.valor}
                                checked={tipo === op.valor}
                                onChange={() => setTipo(op.valor)}
                            />
                            {op.label}
                        </label>
                    ))}
                </div>
            )}

            {tipo === "dispositivo" && (
                <form onSubmit={guardarDispositivo}>

                    <h3>Produto</h3>
                    <label>Nome *</label>
                    <input placeholder="Nome" value={produto.nome} onChange={e => { alt(setProduto, "nome", e.target.value); setErrosDisp(prev => ({ ...prev, nome: "" })) }} style={errosDisp.nome ? { borderColor: "red" } : {}} />
                    {errosDisp.nome && <span className="campo-erro">{errosDisp.nome}</span>}
                    <label>Descrição</label>
                    <textarea placeholder="Descrição do produto" value={produto.descricao} onChange={e => alt(setProduto, "descricao", e.target.value)} style={{ resize: "none" }} />
                    <label>Ficha Técnica (URL do PDF)</label>
                    <input type="url" placeholder="https://..." value={produto.ficha_tecnica_url} onChange={e => alt(setProduto, "ficha_tecnica_url", e.target.value)} />
                    <label>Garantia (anos)</label>
                    <input type="number" min="0" placeholder="0" value={produto.garantia_anos} onChange={e => alt(setProduto, "garantia_anos", e.target.value)} />

                    <ImageUpload
                      label={`Imagem principal${modoEdicao && produto.imagem_url_atual ? " (substituir)" : ""}`}
                      currentUrl={produto.imagem_url_atual}
                      onChange={file => alt(setProduto, "imagem_url", file)}
                    />
                    <ImageUpload
                      label={`Imagem de medidas${modoEdicao && produto.imagem_extra_url_atual ? " (substituir)" : ""}`}
                      currentUrl={produto.imagem_extra_url_atual}
                      onChange={file => alt(setProduto, "imagem_extra_url", file)}
                    />

                    <h3>Especificações</h3>
                    <label>IP</label>
                    <input type="number" min="0" placeholder="0" value={controlador.ip} onChange={e => alt(setControlador, "ip", e.target.value)} />
                    <label>Comprimento (mm)</label>
                    <input type="number" step="0.1" placeholder="0" value={controlador.comprimento_mm} onChange={e => alt(setControlador, "comprimento_mm", e.target.value)} />
                    <label>Largura (mm)</label>
                    <input type="number" step="0.1" placeholder="0" value={controlador.largura_mm} onChange={e => alt(setControlador, "largura_mm", e.target.value)} />
                    <label>Altura (mm)</label>
                    <input type="number" step="0.1" placeholder="0" value={controlador.altura_mm} onChange={e => alt(setControlador, "altura_mm", e.target.value)} />
                    <label>Cor</label>
                    <input placeholder="ex: Preto" value={controlador.cor} onChange={e => alt(setControlador, "cor", e.target.value)} />
                    <label>Unidades por caixa</label>
                    <input type="number" min="0" placeholder="0" value={controlador.unidades_por_caixa} onChange={e => alt(setControlador, "unidades_por_caixa", e.target.value)} />
                    <MultiCheck titulo="Certificações" opcoes={CERTIFICACOES} selecionados={controlador.certificacoes} onChange={v => alt(setControlador, "certificacoes", v)} />
                    <label>Preço (€)</label>
                    <input type="number" step="0.01" placeholder="0" value={controlador.preco} onChange={e => alt(setControlador, "preco", e.target.value)} />

                    <MultiCheck titulo="Tipos de controlo" opcoes={TIPOS_CONTROLO} selecionados={tiposControlo} onChange={setTiposControlo} />
                    <MultiCheck titulo="Tipos de sinal" opcoes={TIPOS_SINAL} selecionados={tiposSinal} onChange={setTiposSinal} />

                    <ListaEntradas entradas={entradas} setEntradas={setEntradas} />
                    <ListaSaidas saidas={saidas} setSaidas={setSaidas} />
                    <ListaLimites limites={limites} setLimites={setLimites} />

                    <CompatSelect
                        titulo="Comandos compatíveis"
                        itens={comandosDisponiveis}
                        selecionados={compatDisp}
                        onToggle={id => toggleCompat(setCompatDisp, id)}
                        idKey="comando_id"
                        nomeKey="nome"
                    />

                    <button type="submit" className="form-button">{modoEdicao ? "Guardar alterações" : "Criar dispositivo"}</button>
                </form>
            )}

            {tipo === "comando" && (
                <form onSubmit={guardarComando}>

                    <h3>Produto</h3>
                    <label>Nome *</label>
                    <input placeholder="Nome" value={produtoCmd.nome} onChange={e => alt(setProdutoCmd, "nome", e.target.value)} />
                    <label>Descrição</label>
                    <textarea placeholder="Descrição do produto" value={produtoCmd.descricao} onChange={e => alt(setProdutoCmd, "descricao", e.target.value)} style={{ resize: "none" }} />
                    <label>Ficha Técnica (URL do PDF)</label>
                    <input type="url" placeholder="https://..." value={produtoCmd.ficha_tecnica_url} onChange={e => alt(setProdutoCmd, "ficha_tecnica_url", e.target.value)} />
                    <label>Garantia (anos)</label>
                    <input type="number" min="0" placeholder="0" value={produtoCmd.garantia_anos} onChange={e => alt(setProdutoCmd, "garantia_anos", e.target.value)} />

                    <ImageUpload
                      label={`Imagem principal${modoEdicao && produtoCmd.imagem_url_atual ? " (substituir)" : ""}`}
                      currentUrl={produtoCmd.imagem_url_atual}
                      onChange={file => alt(setProdutoCmd, "imagem_url", file)}
                    />
                    <ImageUpload
                      label={`Imagem de medidas${modoEdicao && produtoCmd.imagem_extra_url_atual ? " (substituir)" : ""}`}
                      currentUrl={produtoCmd.imagem_extra_url_atual}
                      onChange={file => alt(setProdutoCmd, "imagem_extra_url", file)}
                    />

                    <h3>Especificações</h3>

                    <h3>Alimentação por pilhas</h3>
                    <div className="form-row" style={{ marginBottom: 8 }}>
                        <input type="number" min="0" style={{ width: 80 }} placeholder="Qtd" value={alimentacaoQtd} onChange={e => setAlimentacaoQtd(e.target.value)} />
                        <input placeholder="Tipo (ex: Pilhas AAA)" value={alimentacaoTipo} onChange={e => setAlimentacaoTipo(e.target.value)} />
                    </div>

                    <ListaEntradas entradas={entradasCmd} setEntradas={setEntradasCmd} />

                    <ListaFrequencias frequencias={frequencias} setFrequencias={setFrequencias} />

                    <label>Nº de zonas</label>
                    <input type="number" min="0" placeholder="0" value={comando.numero_zonas} onChange={e => alt(setComando, "numero_zonas", e.target.value)} />
                    <label>Cor</label>
                    <input placeholder="ex: Preto" value={comando.cor} onChange={e => alt(setComando, "cor", e.target.value)} />
                    <label>Preço (€)</label>
                    <input type="number" step="0.01" placeholder="0" value={comando.preco} onChange={e => alt(setComando, "preco", e.target.value)} />

                    <MultiCheck titulo="Tipos de controlo" opcoes={TIPOS_CONTROLO} selecionados={tiposControloCmd} onChange={setTiposControloCmd} />

                    <CompatSelect
                        titulo="Dispositivos compatíveis"
                        itens={dispositivosDisponiveis}
                        selecionados={compatCmd}
                        onToggle={id => toggleCompat(setCompatCmd, id)}
                        idKey="controlador_id"
                        nomeKey="nome"
                    />

                    {erroComando && <p style={{ color: "red", marginBottom: 8 }}>{erroComando}</p>}
                    <button type="submit" className="form-button">{modoEdicao ? "Guardar alterações" : "Criar comando"}</button>
                </form>
            )}

            {tipo === "kit" && (
                <form onSubmit={guardarKit}>

                    <h3>Kit</h3>
                    <div style={{ marginBottom: 8 }}>
                        <h3>Nome do kit (automático)</h3>
                        <p style={{ padding: "4px 0", color: "#555" }}>{kitNome || "(seleciona o tipo de controlo abaixo)"}</p>
                    </div>
                    <label>Preço de cada peça (€)</label>
                    <input type="number" step="0.01" placeholder="0" value={kitProduto.preco} onChange={e => alt(setKitProduto, "preco", e.target.value)} />
                    <label>Garantia (anos)</label>
                    <input type="number" min="0" placeholder="0" value={kitGarantia} onChange={e => setKitGarantia(e.target.value)} />
                    <MultiCheck titulo="Tipos de controlo" opcoes={TIPOS_CONTROLO} selecionados={kitTiposControlo} onChange={setKitTiposControlo} />
                    <MultiCheck titulo="Tipos de sinal" opcoes={TIPOS_SINAL} selecionados={kitTiposSinal} onChange={setKitTiposSinal} />
                    <ListaFrequencias frequencias={kitFrequencias} setFrequencias={setKitFrequencias} />

                    {/* RECEIVER */}
                    <h3>Receiver</h3>

                    {!modoEdicao && (
                        <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                            {["novo", "existente"].map(op => (
                                <label key={op} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                    <input type="radio" name="receiverModo" value={op} checked={receiverModo === op} onChange={() => setReceiverModo(op)} />
                                    {op === "novo" ? "Criar novo" : "Usar existente"}
                                </label>
                            ))}
                        </div>
                    )}

                    {receiverModo === "existente" ? (
                        <CustomSelect value={receiverExistenteId} onChange={e => setReceiverExistenteId(e.target.value)}>
                            <option value="">-- Selecionar dispositivo --</option>
                            {dispositivosDisponiveis.map(d => (
                                <option key={d.controlador_id} value={d.controlador_id}>{d.nome}</option>
                            ))}
                        </CustomSelect>
                    ) : (
                        <>
                            <label>Descrição</label>
                            <textarea placeholder="Descrição do receiver" value={receiver.descricao} onChange={e => alt(setReceiver, "descricao", e.target.value)} style={{ resize: "none" }} />
                            <label>Ficha Técnica (URL do PDF)</label>
                            <input type="url" placeholder="https://..." value={receiver.ficha_tecnica_url} onChange={e => alt(setReceiver, "ficha_tecnica_url", e.target.value)} />

                            <ImageUpload
                              label={`Imagem principal receiver${modoEdicao && receiver.imagem_url_atual ? " (substituir)" : ""}`}
                              currentUrl={receiver.imagem_url_atual}
                              onChange={file => alt(setReceiver, "imagem_url", file)}
                            />
                            <ImageUpload
                              label={`Imagem de medidas receiver${modoEdicao && receiver.imagem_extra_url_atual ? " (substituir)" : ""}`}
                              currentUrl={receiver.imagem_extra_url_atual}
                              onChange={file => alt(setReceiver, "imagem_extra_url", file)}
                            />

                            <label>IP</label>
                            <input type="number" min="0" placeholder="0" value={receiver.ip} onChange={e => alt(setReceiver, "ip", e.target.value)} />
                            <label>Comprimento (mm)</label>
                            <input type="number" step="0.1" placeholder="0" value={receiver.comprimento_mm} onChange={e => alt(setReceiver, "comprimento_mm", e.target.value)} />
                            <label>Largura (mm)</label>
                            <input type="number" step="0.1" placeholder="0" value={receiver.largura_mm} onChange={e => alt(setReceiver, "largura_mm", e.target.value)} />
                            <label>Altura (mm)</label>
                            <input type="number" step="0.1" placeholder="0" value={receiver.altura_mm} onChange={e => alt(setReceiver, "altura_mm", e.target.value)} />
                            <label>Cor</label>
                            <input placeholder="ex: Preto" value={receiver.cor} onChange={e => alt(setReceiver, "cor", e.target.value)} />
                            <label>Unidades por caixa</label>
                            <input type="number" min="0" placeholder="0" value={receiver.unidades_por_caixa} onChange={e => alt(setReceiver, "unidades_por_caixa", e.target.value)} />
                            <MultiCheck titulo="Certificações (receiver)" opcoes={CERTIFICACOES} selecionados={receiver.certificacoes} onChange={v => alt(setReceiver, "certificacoes", v)} />

                            <ListaEntradas entradas={receiver.entradas} setEntradas={v => setReceiver(prev => ({ ...prev, entradas: v }))} />
                            <ListaSaidas saidas={receiver.saidas} setSaidas={v => setReceiver(prev => ({ ...prev, saidas: v }))} />
                            <ListaLimites limites={receiver.limites_potencia} setLimites={v => setReceiver(prev => ({ ...prev, limites_potencia: v }))} />
                        </>
                    )}

                    {/* REMOTE */}
                    <h3>Remote</h3>

                    {!modoEdicao && (
                        <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                            {["novo", "existente"].map(op => (
                                <label key={op} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                    <input type="radio" name="remoteModo" value={op} checked={remoteModo === op} onChange={() => setRemoteModo(op)} />
                                    {op === "novo" ? "Criar novo" : "Usar existente"}
                                </label>
                            ))}
                        </div>
                    )}

                    {remoteModo === "existente" ? (
                        <CustomSelect value={remoteExistenteId} onChange={e => setRemoteExistenteId(e.target.value)}>
                            <option value="">-- Selecionar comando --</option>
                            {comandosDisponiveis.map(c => (
                                <option key={c.comando_id} value={c.comando_id}>{c.nome}</option>
                            ))}
                        </CustomSelect>
                    ) : (
                        <>
                            <label>Descrição</label>
                            <textarea placeholder="Descrição do remote" value={remote.descricao} onChange={e => alt(setRemote, "descricao", e.target.value)} style={{ resize: "none" }} />
                            <label>Ficha Técnica (URL do PDF)</label>
                            <input type="url" placeholder="https://..." value={remote.ficha_tecnica_url} onChange={e => alt(setRemote, "ficha_tecnica_url", e.target.value)} />

                            <ImageUpload
                              label={`Imagem principal remote${modoEdicao && remote.imagem_url_atual ? " (substituir)" : ""}`}
                              currentUrl={remote.imagem_url_atual}
                              onChange={file => alt(setRemote, "imagem_url", file)}
                            />
                            <ImageUpload
                              label={`Imagem de medidas remote${modoEdicao && remote.imagem_extra_url_atual ? " (substituir)" : ""}`}
                              currentUrl={remote.imagem_extra_url_atual}
                              onChange={file => alt(setRemote, "imagem_extra_url", file)}
                            />

                            <MultiCheck titulo="Certificações (remote)" opcoes={CERTIFICACOES} selecionados={remote.certificacoes} onChange={v => alt(setRemote, "certificacoes", v)} />
                            <label>Tipo de alimentação</label>
                            <input placeholder="ex: Pilhas AAA" value={remote.tipo_alimentacao} onChange={e => alt(setRemote, "tipo_alimentacao", e.target.value)} />
                            <label>Comprimento (mm)</label>
                            <input type="number" step="0.1" placeholder="0" value={remote.comprimento_mm} onChange={e => alt(setRemote, "comprimento_mm", e.target.value)} />
                            <label>Largura (mm)</label>
                            <input type="number" step="0.1" placeholder="0" value={remote.largura_mm} onChange={e => alt(setRemote, "largura_mm", e.target.value)} />
                            <label>Altura (mm)</label>
                            <input type="number" step="0.1" placeholder="0" value={remote.altura_mm} onChange={e => alt(setRemote, "altura_mm", e.target.value)} />
                            <label>Cor</label>
                            <input placeholder="ex: Preto" value={remote.cor} onChange={e => alt(setRemote, "cor", e.target.value)} />
                        </>
                    )}

                    {errosKit.tipos_controlo && <span className="campo-erro">{errosKit.tipos_controlo}</span>}
                    {errosKit.receiver && <span className="campo-erro">{errosKit.receiver}</span>}
                    {errosKit.remote && <span className="campo-erro">{errosKit.remote}</span>}
                    <button type="submit" className="form-button">{modoEdicao ? "Guardar alterações" : "Criar kit"}</button>
                </form>
            )}

        </div>
        <Notificacao mensagem={toast.mensagem} tipo={toast.tipo} onClose={fecharToast} />
        </>
    )
}

export default ControladorForm

