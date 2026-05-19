import express from "express"
import jwt from "jsonwebtoken"
import { pool } from "../db.js"
import cloudinary from "../config/cloudinary.js"
import upload from "../middleware/upload.js"
import streamifier from "streamifier"

const router = express.Router()

// ── Helpers ──────────────────────────────────────────────────────────────────

function uploadBuffer(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "acessorios" },
            (error, result) => {
                if (result) resolve(result)
                else reject(error)
            }
        )
        streamifier.createReadStream(buffer).pipe(stream)
    })
}

function extrairPublicId(url) {
    if (!url) return null
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/)
    return match ? match[1] : null
}

async function eliminarImagemCloudinary(url) {
    const publicId = extrairPublicId(url)
    if (!publicId) return
    try {
        await cloudinary.uploader.destroy(publicId)
    } catch (err) {
        console.error("Erro ao eliminar imagem do Cloudinary:", publicId, err.message)
    }
}

function verTodosFromToken(req) {
    const token = req.cookies?.token
    if (!token) return false
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const role = decoded.role?.toLowerCase()
        return role === "administrador" || role === "moderador"
    } catch (_) {
        return false
    }
}

function n(val) {
    const v = parseFloat(val)
    return isFinite(v) ? v : null
}

function i(val) {
    const v = parseInt(val)
    return isFinite(v) ? v : null
}

// ── Inserir dados específicos por tipo ────────────────────────────────────────

async function inserirEspecifico(tipo, acessorio_id, esp) {
    switch (tipo) {
        case "interruptor": {
            const { rows: [{ interruptor_id }] } = await pool.query(
                `INSERT INTO interruptores (acessorio_id, tipologia, cor, sensor, cabo_mm, distancia_min_m, distancia_max_m)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING interruptor_id`,
                [acessorio_id, esp.tipologia || null, esp.cor || null, esp.sensor || null,
                 n(esp.cabo_m ?? esp.cabo_mm), n(esp.distancia_min_m), n(esp.distancia_max_m)]
            )
            for (const tc of esp.tipos_controlo ?? []) {
                if (!tc) continue
                await pool.query(
                    `INSERT INTO tipos_controlo_interruptores (interruptor_id, tipo_controlo) VALUES ($1,$2)`,
                    [interruptor_id, tc]
                )
            }
            for (const tensao of esp.tensoes ?? []) {
                const { rows: [{ tensao_id }] } = await pool.query(
                    `INSERT INTO tensoes_interruptores (interruptor_id, tipo_tensao, voltagem_v, voltagem_min_v, voltagem_max_v, corrente_max_a)
                     VALUES ($1,$2,$3,$4,$5,$6) RETURNING tensao_id`,
                    [interruptor_id, tensao.tipo_tensao || null, n(tensao.voltagem_v), n(tensao.voltagem_min_v), n(tensao.voltagem_max_v), n(tensao.corrente_max_a)]
                )
                for (const pot of tensao.potencias ?? []) {
                    await pool.query(
                        `INSERT INTO potencias_tensoes_interruptores (tensao_id, voltagem_v, potencia_max_w)
                         VALUES ($1,$2,$3)`,
                        [tensao_id, n(pot.voltagem_v), n(pot.potencia_max_w)]
                    )
                }
            }
            return interruptor_id
        }

        case "conector_uniao": {
            const { rows: [{ conector_uniao_id }] } = await pool.query(
                `INSERT INTO conectores_uniao (acessorio_id, material, tipo_conexao, tem_fio, corrente_a, largura_mm, numero_vias)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING conector_uniao_id`,
                [acessorio_id, esp.material || null, esp.tipo_conexao || null,
                 esp.tem_fio ?? false, n(esp.corrente_a), n(esp.largura_mm), i(esp.numero_vias)]
            )
            for (const tip of esp.tipologias ?? []) {
                if (!tip) continue
                await pool.query(
                    `INSERT INTO tipologias_conectores_uniao (conector_uniao_id, tipologia) VALUES ($1,$2)`,
                    [conector_uniao_id, tip]
                )
            }
            return conector_uniao_id
        }

        case "cabo_encaixe": {
            const { rows: [{ cabo_encaixe_id }] } = await pool.query(
                `INSERT INTO cabos_encaixe (acessorio_id, tipologia, tipo_ligacao, ip, corrente_a)
                 VALUES ($1,$2,$3,$4,$5) RETURNING cabo_encaixe_id`,
                [acessorio_id, esp.tipologia || null, esp.tipo_ligacao || null,
                 i(esp.ip), n(esp.corrente_a)]
            )
            return cabo_encaixe_id
        }

        case "clipe_tampa": {
            const { rows: [{ clipe_tampa_id }] } = await pool.query(
                `INSERT INTO clipes_tampas (acessorio_id, tipo, tipologia, material)
                 VALUES ($1,$2,$3,$4) RETURNING clipe_tampa_id`,
                [acessorio_id, esp.tipo || null, esp.tipologia || null, esp.material || null]
            )
            return clipe_tampa_id
        }

        case "ligador_fio": {
            const { rows: [{ ligador_fio_id }] } = await pool.query(
                `INSERT INTO ligadores_fio (acessorio_id, tipo, tipologia, unidades_por_caixa, voltagem_v, ip)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING ligador_fio_id`,
                [acessorio_id, esp.tipo || null, esp.tipologia || null,
                 i(esp.unidades_por_caixa), n(esp.voltagem_v), i(esp.ip)]
            )
            for (const cap of esp.capacidades ?? []) {
                if (!cap) continue
                await pool.query(
                    `INSERT INTO capacidades_ligadores_fio (ligador_fio_id, capacidade) VALUES ($1,$2)`,
                    [ligador_fio_id, cap]
                )
            }
            return ligador_fio_id
        }

        case "fixacao_cola": {
            const { rows: [{ fixacao_cola_id }] } = await pool.query(
                `INSERT INTO fixacao_colas (acessorio_id, tipo, tipologia, comprimento_mm, largura_mm, quantidade_ml, tempo_cura, cor, forca_psi)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING fixacao_cola_id`,
                [acessorio_id, esp.tipo || null, esp.tipologia || null, n(esp.comprimento_mm),
                 n(esp.largura_mm), n(esp.quantidade_ml), esp.tempo_cura || null, esp.cor || null, n(esp.forca_psi)]
            )
            for (const res of esp.resistencias ?? []) {
                if (!res) continue
                await pool.query(
                    `INSERT INTO resistencias_fixacao_colas (fixacao_cola_id, resistencia) VALUES ($1,$2)`,
                    [fixacao_cola_id, res]
                )
            }
            return fixacao_cola_id
        }

        case "fio_paralelo": {
            const { rows: [{ fio_paralelo_id }] } = await pool.query(
                `INSERT INTO fios_paralelos (acessorio_id) VALUES ($1) RETURNING fio_paralelo_id`,
                [acessorio_id]
            )
            for (const tip of esp.tipologias ?? []) {
                if (!tip) continue
                await pool.query(
                    `INSERT INTO tipologias_fios_paralelos (fio_paralelo_id, tipologia) VALUES ($1,$2)`,
                    [fio_paralelo_id, tip]
                )
            }
            return fio_paralelo_id
        }

        case "ficha": {
            const { rows: [{ ficha_id }] } = await pool.query(
                `INSERT INTO fichas (acessorio_id, tipologia, medida, descricao_extra)
                 VALUES ($1,$2,$3,$4) RETURNING ficha_id`,
                [acessorio_id, esp.tipologia || null, esp.medida || null, esp.descricao_extra || null]
            )
            return ficha_id
        }

        case "manga": {
            const { rows: [{ manga_termoretratil_id }] } = await pool.query(
                `INSERT INTO mangas_termoretrateis (acessorio_id, diametro_normal_mm, diametro_pos_aquecimento_mm, rolo_m)
                 VALUES ($1,$2,$3,$4) RETURNING manga_termoretratil_id`,
                [acessorio_id, n(esp.diametro_normal_mm), n(esp.diametro_pos_aquecimento_mm), n(esp.rolo_m)]
            )
            return manga_termoretratil_id
        }

        case "ferro_solda": {
            const { rows: [{ ferro_solda_id }] } = await pool.query(
                `INSERT INTO ferros_soldas (acessorio_id, tipologia, descricao_extra)
                 VALUES ($1,$2,$3) RETURNING ferro_solda_id`,
                [acessorio_id, esp.tipologia || null, esp.descricao_extra || null]
            )
            return ferro_solda_id
        }

        default:
            throw new Error(`Tipo de acessório desconhecido: ${tipo}`)
    }
}

async function inserirVariantes(tipo, especifico_id, variantes) {
    const tabelas = {
        interruptor: { tabela: "variantes_interruptores", fk: "interruptor_id", extra: [] },
        conector_uniao: { tabela: "variantes_conectores_uniao", fk: "conector_uniao_id", extra: [] },
        cabo_encaixe: { tabela: "variantes_cabos_encaixe", fk: "cabo_encaixe_id", extra: [] },
        clipe_tampa: { tabela: "variantes_clipes_tampas", fk: "clipe_tampa_id", extra: [] },
        ligador_fio: { tabela: "variantes_ligadores_fio", fk: "ligador_fio_id", extra: [] },
        fixacao_cola: { tabela: "variantes_fixacao_colas", fk: "fixacao_cola_id", extra: [] },
        fio_paralelo: { tabela: "variantes_fios_paralelos", fk: "fio_paralelo_id", extra: ["rolo_m"] },
        ficha: { tabela: "variantes_fichas", fk: "ficha_id", extra: [] },
        manga: { tabela: "variantes_mangas_termoretrateis", fk: "manga_termoretratil_id", extra: [] },
        ferro_solda: { tabela: "variantes_ferros_soldas", fk: "ferro_solda_id", extra: [] },
    }

    const cfg = tabelas[tipo]
    if (!cfg) return

    for (const v of variantes ?? []) {
        if (!v.referencia) continue
        if (tipo === "fio_paralelo") {
            await pool.query(
                `INSERT INTO ${cfg.tabela} (${cfg.fk}, referencia, rolo_m, preco, ativo)
                 VALUES ($1,$2,$3,$4,$5)`,
                [especifico_id, v.referencia, n(v.rolo_m), n(v.preco), v.ativo ?? true]
            )
        } else {
            await pool.query(
                `INSERT INTO ${cfg.tabela} (${cfg.fk}, referencia, preco, ativo)
                 VALUES ($1,$2,$3,$4)`,
                [especifico_id, v.referencia, n(v.preco), v.ativo ?? true]
            )
        }
    }
}

// ── POST /api/acessorios ──────────────────────────────────────────────────────

router.post("/", upload.any(), async (req, res) => {
    try {
        let produto = req.body.produto
        let acessorio = req.body.acessorio
        let especifico = req.body.especifico
        let variantes = req.body.variantes

        if (typeof produto === "string") produto = JSON.parse(produto)
        if (typeof acessorio === "string") acessorio = JSON.parse(acessorio)
        if (typeof especifico === "string") especifico = JSON.parse(especifico)
        if (typeof variantes === "string") variantes = JSON.parse(variantes)

        const tipo = acessorio?.tipo_acessorio
        if (!tipo) return res.status(400).json({ erro: "tipo_acessorio é obrigatório" })

        if (!produto?.referencia?.trim())
            return res.status(400).json({ erro: "A referência é obrigatória.", campo: "referencia" })
        if (!produto?.nome?.trim())
            return res.status(400).json({ erro: "O nome é obrigatório.", campo: "nome" })

        const { rows: dup } = await pool.query(
            `SELECT produto_id FROM produtos WHERE LOWER(referencia) = LOWER($1) OR LOWER(nome) = LOWER($2)`,
            [produto.referencia.trim(), produto.nome.trim()]
        )
        if (dup.length > 0)
            return res.status(409).json({ erro: "Já existe um produto com esta referência ou nome.", campo: "referencia" })

        let imagem_url = null
        let imagem_extra_url = null
        for (const file of req.files ?? []) {
            if (file.fieldname === "imagem_url") {
                const r = await uploadBuffer(file.buffer)
                imagem_url = r.secure_url
            } else if (file.fieldname === "imagem_extra_url") {
                const r = await uploadBuffer(file.buffer)
                imagem_extra_url = r.secure_url
            }
        }

        await pool.query("BEGIN")

        const { rows: [{ produto_id }] } = await pool.query(
            `INSERT INTO produtos (referencia, nome, categoria, subcategoria, descricao, garantia_anos, imagem_url, imagem_extra_url, ficha_tecnica_url, ativo)
             VALUES ($1,$2,'acessorios',$3,$4,$5,$6,$7,$8,true) RETURNING produto_id`,
            [
                produto.referencia,
                produto.nome || produto.referencia,
                produto.subcategoria || null,
                produto.descricao || null,
                i(produto.garantia_anos),
                imagem_url,
                imagem_extra_url,
                produto.ficha_tecnica_url || null
            ]
        )

        const { rows: [{ acessorio_id }] } = await pool.query(
            `INSERT INTO acessorios (produto_id, tipo_acessorio, preco, ativo)
             VALUES ($1,$2,$3,true) RETURNING acessorio_id`,
            [produto_id, tipo, n(acessorio.preco)]
        )

        const especifico_id = await inserirEspecifico(tipo, acessorio_id, especifico ?? {})
        await inserirVariantes(tipo, especifico_id, variantes)

        await pool.query("COMMIT")
        res.status(201).json({ success: true, produto_id, acessorio_id })

    } catch (error) {
        await pool.query("ROLLBACK")
        console.error("Erro ao criar acessório:", error)
        res.status(500).json({ erro: "Erro ao criar acessório", detalhe: error.message })
    }
})

// ── GET /api/acessorios ───────────────────────────────────────────────────────

router.get("/", async (req, res) => {
    try {
        const verTodos = verTodosFromToken(req)
        const subcatFiltro = req.query.subcategoria || null
        const conds = []
        const params = []
        if (!verTodos) conds.push("p.ativo = true")
        if (subcatFiltro) { params.push(subcatFiltro); conds.push(`p.subcategoria = $${params.length}`) }
        const where = conds.length ? "WHERE " + conds.join(" AND ") : ""

        const mainSelect = `
            SELECT
                p.produto_id,
                p.referencia,
                p.nome,
                p.categoria,
                p.subcategoria,
                p.imagem_url,
                p.ativo,
                a.acessorio_id,
                a.tipo_acessorio,
                a.preco
             FROM produtos p
             JOIN acessorios a ON a.produto_id = p.produto_id
             ${where}
             ORDER BY a.tipo_acessorio ASC, p.nome ASC`

        if (req.query.pagina !== undefined) {
            const pagina = Math.max(1, parseInt(req.query.pagina) || 1)
            const limite = Math.min(120, Math.max(1, parseInt(req.query.limite) || 60))
            const offset = (pagina - 1) * limite
            const { rows: [{ total }] } = await pool.query(
                `SELECT COUNT(*) AS total FROM produtos p JOIN acessorios a ON a.produto_id = p.produto_id ${where}`,
                [...params]
            )
            const { rows } = await pool.query(mainSelect + ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limite, offset])
            return res.json({ dados: rows, total: parseInt(total) })
        }

        const { rows } = await pool.query(mainSelect, params)
        res.json(rows)
    } catch (error) {
        console.error("Erro ao buscar acessórios:", error)
        res.status(500).json({ erro: "Erro ao buscar acessórios", detalhe: error.message })
    }
})

// ── GET /api/acessorios/:id ───────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
    const { id } = req.params
    try {
        const { rows: [base] } = await pool.query(
            `SELECT
                p.produto_id, p.referencia, p.nome, p.categoria, p.subcategoria,
                p.descricao, p.garantia_anos, p.imagem_url, p.imagem_extra_url, p.ficha_tecnica_url, p.ativo,
                a.acessorio_id, a.tipo_acessorio, a.preco
             FROM produtos p
             JOIN acessorios a ON a.produto_id = p.produto_id
             WHERE p.produto_id = $1`,
            [id]
        )
        if (!base) return res.status(404).json({ erro: "Acessório não encontrado" })

        const tipo = base.tipo_acessorio
        const acessorio_id = base.acessorio_id
        let especifico = null

        switch (tipo) {
            case "interruptor": {
                const { rows: [int_row] } = await pool.query(
                    `SELECT * FROM interruptores WHERE acessorio_id = $1`, [acessorio_id]
                )
                if (int_row) {
                    const { rows: tipos_controlo } = await pool.query(
                        `SELECT tipo_controlo FROM tipos_controlo_interruptores WHERE interruptor_id = $1`,
                        [int_row.interruptor_id]
                    )
                    const { rows: tensoes } = await pool.query(
                        `SELECT * FROM tensoes_interruptores WHERE interruptor_id = $1`,
                        [int_row.interruptor_id]
                    )
                    for (const t of tensoes) {
                        const { rows: potencias } = await pool.query(
                            `SELECT * FROM potencias_tensoes_interruptores WHERE tensao_id = $1`,
                            [t.tensao_id]
                        )
                        t.potencias = potencias
                    }
                    const { rows: variantes } = await pool.query(
                        `SELECT * FROM variantes_interruptores WHERE interruptor_id = $1`,
                        [int_row.interruptor_id]
                    )
                    especifico = { ...int_row, tipos_controlo: tipos_controlo.map(r => r.tipo_controlo), tensoes, variantes }
                }
                break
            }
            case "conector_uniao": {
                const { rows: [cu_row] } = await pool.query(
                    `SELECT * FROM conectores_uniao WHERE acessorio_id = $1`, [acessorio_id]
                )
                if (cu_row) {
                    const { rows: tipologias } = await pool.query(
                        `SELECT tipologia FROM tipologias_conectores_uniao WHERE conector_uniao_id = $1`,
                        [cu_row.conector_uniao_id]
                    )
                    const { rows: variantes } = await pool.query(
                        `SELECT * FROM variantes_conectores_uniao WHERE conector_uniao_id = $1`,
                        [cu_row.conector_uniao_id]
                    )
                    especifico = { ...cu_row, tipologias: tipologias.map(r => r.tipologia), variantes }
                }
                break
            }
            case "cabo_encaixe": {
                const { rows: [ce_row] } = await pool.query(
                    `SELECT * FROM cabos_encaixe WHERE acessorio_id = $1`, [acessorio_id]
                )
                if (ce_row) {
                    const { rows: variantes } = await pool.query(
                        `SELECT * FROM variantes_cabos_encaixe WHERE cabo_encaixe_id = $1`,
                        [ce_row.cabo_encaixe_id]
                    )
                    especifico = { ...ce_row, variantes }
                }
                break
            }
            case "clipe_tampa": {
                const { rows: [ct_row] } = await pool.query(
                    `SELECT * FROM clipes_tampas WHERE acessorio_id = $1`, [acessorio_id]
                )
                if (ct_row) {
                    const { rows: variantes } = await pool.query(
                        `SELECT * FROM variantes_clipes_tampas WHERE clipe_tampa_id = $1`,
                        [ct_row.clipe_tampa_id]
                    )
                    especifico = { ...ct_row, variantes }
                }
                break
            }
            case "ligador_fio": {
                const { rows: [lf_row] } = await pool.query(
                    `SELECT * FROM ligadores_fio WHERE acessorio_id = $1`, [acessorio_id]
                )
                if (lf_row) {
                    const { rows: capacidades } = await pool.query(
                        `SELECT capacidade FROM capacidades_ligadores_fio WHERE ligador_fio_id = $1`,
                        [lf_row.ligador_fio_id]
                    )
                    const { rows: variantes } = await pool.query(
                        `SELECT * FROM variantes_ligadores_fio WHERE ligador_fio_id = $1`,
                        [lf_row.ligador_fio_id]
                    )
                    especifico = { ...lf_row, capacidades: capacidades.map(r => r.capacidade), variantes }
                }
                break
            }
            case "fixacao_cola": {
                const { rows: [fc_row] } = await pool.query(
                    `SELECT * FROM fixacao_colas WHERE acessorio_id = $1`, [acessorio_id]
                )
                if (fc_row) {
                    const { rows: resistencias } = await pool.query(
                        `SELECT resistencia FROM resistencias_fixacao_colas WHERE fixacao_cola_id = $1`,
                        [fc_row.fixacao_cola_id]
                    )
                    const { rows: variantes } = await pool.query(
                        `SELECT * FROM variantes_fixacao_colas WHERE fixacao_cola_id = $1`,
                        [fc_row.fixacao_cola_id]
                    )
                    especifico = { ...fc_row, resistencias: resistencias.map(r => r.resistencia), variantes }
                }
                break
            }
            case "fio_paralelo": {
                const { rows: [fp_row] } = await pool.query(
                    `SELECT * FROM fios_paralelos WHERE acessorio_id = $1`, [acessorio_id]
                )
                if (fp_row) {
                    const { rows: tipologias } = await pool.query(
                        `SELECT tipologia FROM tipologias_fios_paralelos WHERE fio_paralelo_id = $1`,
                        [fp_row.fio_paralelo_id]
                    )
                    const { rows: variantes } = await pool.query(
                        `SELECT * FROM variantes_fios_paralelos WHERE fio_paralelo_id = $1`,
                        [fp_row.fio_paralelo_id]
                    )
                    especifico = { ...fp_row, tipologias: tipologias.map(r => r.tipologia), variantes }
                }
                break
            }
            case "ficha": {
                const { rows: [fi_row] } = await pool.query(
                    `SELECT * FROM fichas WHERE acessorio_id = $1`, [acessorio_id]
                )
                if (fi_row) {
                    const { rows: variantes } = await pool.query(
                        `SELECT * FROM variantes_fichas WHERE ficha_id = $1`,
                        [fi_row.ficha_id]
                    )
                    especifico = { ...fi_row, variantes }
                }
                break
            }
            case "manga": {
                const { rows: [mg_row] } = await pool.query(
                    `SELECT * FROM mangas_termoretrateis WHERE acessorio_id = $1`, [acessorio_id]
                )
                if (mg_row) {
                    const { rows: variantes } = await pool.query(
                        `SELECT * FROM variantes_mangas_termoretrateis WHERE manga_termoretratil_id = $1`,
                        [mg_row.manga_termoretratil_id]
                    )
                    especifico = { ...mg_row, variantes }
                }
                break
            }
            case "ferro_solda": {
                const { rows: [fs_row] } = await pool.query(
                    `SELECT * FROM ferros_soldas WHERE acessorio_id = $1`, [acessorio_id]
                )
                if (fs_row) {
                    const { rows: variantes } = await pool.query(
                        `SELECT * FROM variantes_ferros_soldas WHERE ferro_solda_id = $1`,
                        [fs_row.ferro_solda_id]
                    )
                    especifico = { ...fs_row, variantes }
                }
                break
            }
        }

        res.json({ ...base, especifico })

    } catch (error) {
        console.error("Erro ao buscar acessório:", error)
        res.status(500).json({ erro: "Erro ao buscar acessório", detalhe: error.message })
    }
})

// ── PATCH /api/acessorios/:id/ativo ──────────────────────────────────────────

router.patch("/:id/ativo", async (req, res) => {
    const { id } = req.params
    try {
        const { rows: [produto] } = await pool.query(
            `UPDATE produtos SET ativo = NOT ativo WHERE produto_id = $1 RETURNING ativo`,
            [id]
        )
        if (!produto) return res.status(404).json({ erro: "Produto não encontrado" })
        res.json({ ativo: produto.ativo })
    } catch (error) {
        console.error("Erro ao alternar ativo:", error)
        res.status(500).json({ erro: "Erro ao alternar ativo", detalhe: error.message })
    }
})

// ── PUT /api/acessorios/:id ───────────────────────────────────────────────────

router.put("/:id", upload.any(), async (req, res) => {
    const { id } = req.params
    try {
        let produto = req.body.produto
        let acessorio = req.body.acessorio
        let especifico = req.body.especifico
        let variantes = req.body.variantes

        if (typeof produto === "string") produto = JSON.parse(produto)
        if (typeof acessorio === "string") acessorio = JSON.parse(acessorio)
        if (typeof especifico === "string") especifico = JSON.parse(especifico)
        if (typeof variantes === "string") variantes = JSON.parse(variantes)

        // Buscar imagem atual e acessorio_id
        const { rows: [atual] } = await pool.query(
            `SELECT p.imagem_url, p.imagem_extra_url, a.acessorio_id, a.tipo_acessorio
             FROM produtos p
             JOIN acessorios a ON a.produto_id = p.produto_id
             WHERE p.produto_id = $1`,
            [id]
        )
        if (!atual) return res.status(404).json({ erro: "Acessório não encontrado" })

        if (!produto?.referencia?.trim())
            return res.status(400).json({ erro: "A referência é obrigatória.", campo: "referencia" })
        if (!produto?.nome?.trim())
            return res.status(400).json({ erro: "O nome é obrigatório.", campo: "nome" })

        const { rows: dup } = await pool.query(
            `SELECT produto_id FROM produtos WHERE (LOWER(referencia) = LOWER($1) OR LOWER(nome) = LOWER($2)) AND produto_id != $3`,
            [produto.referencia.trim(), produto.nome.trim(), id]
        )
        if (dup.length > 0)
            return res.status(409).json({ erro: "Já existe outro produto com esta referência ou nome.", campo: "referencia" })

        const tipo = atual.tipo_acessorio
        const acessorio_id = atual.acessorio_id

        let imagem_url = produto.imagem_url_atual ?? atual.imagem_url
        let imagem_extra_url = produto.imagem_extra_url_atual ?? atual.imagem_extra_url
        const velhaImagem = atual.imagem_url
        const velhaImagemExtra = atual.imagem_extra_url

        for (const file of req.files ?? []) {
            if (file.fieldname === "imagem_url") {
                const r = await uploadBuffer(file.buffer)
                imagem_url = r.secure_url
            } else if (file.fieldname === "imagem_extra_url") {
                const r = await uploadBuffer(file.buffer)
                imagem_extra_url = r.secure_url
            }
        }

        await pool.query("BEGIN")

        await pool.query(
            `UPDATE produtos SET referencia=$1, nome=$2, subcategoria=$3, descricao=$4,
             garantia_anos=$5, imagem_url=$6, imagem_extra_url=$7, ficha_tecnica_url=$8 WHERE produto_id=$9`,
            [
                produto.referencia,
                produto.nome || produto.referencia,
                produto.subcategoria || null,
                produto.descricao || null,
                i(produto.garantia_anos),
                imagem_url,
                imagem_extra_url,
                produto.ficha_tecnica_url || null,
                id
            ]
        )

        await pool.query(
            `UPDATE acessorios SET preco=$1 WHERE acessorio_id=$2`,
            [n(acessorio.preco), acessorio_id]
        )

        // Apagar e reinserir dados específicos e variantes
        await eliminarEspecifico(tipo, acessorio_id)
        const especifico_id = await inserirEspecifico(tipo, acessorio_id, especifico ?? {})
        await inserirVariantes(tipo, especifico_id, variantes)

        await pool.query("COMMIT")

        if (velhaImagem && velhaImagem !== imagem_url) eliminarImagemCloudinary(velhaImagem)
        if (velhaImagemExtra && velhaImagemExtra !== imagem_extra_url) eliminarImagemCloudinary(velhaImagemExtra)

        res.json({ success: true })

    } catch (error) {
        await pool.query("ROLLBACK")
        console.error("Erro ao atualizar acessório:", error)
        res.status(500).json({ erro: "Erro ao atualizar acessório", detalhe: error.message })
    }
})

async function eliminarEspecifico(tipo, acessorio_id) {
    const tabelas = {
        interruptor: "interruptores",
        conector_uniao: "conectores_uniao",
        cabo_encaixe: "cabos_encaixe",
        clipe_tampa: "clipes_tampas",
        ligador_fio: "ligadores_fio",
        fixacao_cola: "fixacao_colas",
        fio_paralelo: "fios_paralelos",
        ficha: "fichas",
        manga: "mangas_termoretrateis",
        ferro_solda: "ferros_soldas",
    }
    const tabela = tabelas[tipo]
    if (tabela) {
        await pool.query(`DELETE FROM ${tabela} WHERE acessorio_id = $1`, [acessorio_id])
    }
}

export default router
