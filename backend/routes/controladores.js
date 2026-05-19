import express from "express"
import jwt from "jsonwebtoken"
import { pool } from "../db.js"
import cloudinary from "../config/cloudinary.js"
import upload from "../middleware/upload.js"
import streamifier from "streamifier"

export const controladorRouter = express.Router()
export const comandoRouter = express.Router()
export const kitRouter = express.Router()

// ── Helpers ──────────────────────────────────────────────────────────────────

function uploadBuffer(buffer, folder) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder },
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

// Dispositivos e comandos standalone: ECT-NOME
function gerarReferencia(nome) {
    return "ECT-" + (nome ?? "").toUpperCase().trim().replace(/\s+/g, "-")
}

// Kit: NOME (sem ECT-)
function gerarReferenciaKit(nome) {
    return (nome ?? "").toUpperCase().trim().replace(/\s+/g, "-")
}

// Receiver do kit: ECT-NOME-RECEIVER
function gerarReferenciaKitReceiver(nomeKit) {
    const base = (nomeKit ?? "").toUpperCase().trim().replace(/\s+/g, "-")
    return "ECT-" + base + "-RECEIVER"
}

// Remote do kit: ECT-NOME-REMOTE
function gerarReferenciaKitRemote(nomeKit) {
    const base = (nomeKit ?? "").toUpperCase().trim().replace(/\s+/g, "-")
    return "ECT-" + base + "-REMOTE"
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

// ── Helpers para tabelas normalizadas ────────────────────────────────────────


async function setTiposControloComando(comando_id, tipos) {
    await pool.query(`DELETE FROM tipos_controlo_comandos WHERE comando_id = $1`, [comando_id])
    for (const t of tipos ?? []) {
        if (!t) continue
        await pool.query(`INSERT INTO tipos_controlo_comandos (comando_id, tipo_controlo) VALUES ($1,$2)`, [comando_id, t])
    }
}

async function setEntradasComando(comando_id, entradas) {
    await pool.query(`DELETE FROM entradas_comandos WHERE comando_id = $1`, [comando_id])
    for (const e of entradas ?? []) {
        await pool.query(
            `INSERT INTO entradas_comandos (comando_id, tipo_input, voltagem_min, voltagem_max) VALUES ($1,$2,$3,$4)`,
            [comando_id, e.tipo_input || null, parseFloat(e.voltagem_min) || null, parseFloat(e.voltagem_max) || null]
        )
    }
}

async function setFrequenciasComando(comando_id, freqs) {
    await pool.query(`DELETE FROM frequencias_comandos WHERE comando_id = $1`, [comando_id])
    for (const f of freqs ?? []) {
        if (f === null || f === undefined || f === "") continue
        const val = parseFloat(String(f))
        if (!isFinite(val)) continue
        await pool.query(`INSERT INTO frequencias_comandos (comando_id, frequencia_mhz) VALUES ($1,$2)`, [comando_id, val])
    }
}

async function setFrequenciasControlador(controlador_id, freqs) {
    await pool.query(`DELETE FROM frequencias_controladores WHERE controlador_id = $1`, [controlador_id])
    for (const f of freqs ?? []) {
        if (f === null || f === undefined || f === "") continue
        const val = parseFloat(String(f))
        if (!isFinite(val)) continue
        await pool.query(`INSERT INTO frequencias_controladores (controlador_id, frequencia_mhz) VALUES ($1,$2)`, [controlador_id, val])
    }
}

async function setCertificacoesControlador(controlador_id, certs) {
    await pool.query(`DELETE FROM certificacoes_controladores WHERE controlador_id = $1`, [controlador_id])
    for (const c of certs ?? []) {
        if (!c) continue
        await pool.query(`INSERT INTO certificacoes_controladores (controlador_id, certificacao) VALUES ($1,$2)`, [controlador_id, c])
    }
}

async function setTiposControloControlador(controlador_id, tipos) {
    await pool.query(`DELETE FROM tipos_controlo_controladores WHERE controlador_id = $1`, [controlador_id])
    for (const t of tipos ?? []) {
        if (!t) continue
        await pool.query(`INSERT INTO tipos_controlo_controladores (controlador_id, tipo_controlo) VALUES ($1,$2)`, [controlador_id, t])
    }
}

// Requer tabela: CREATE TABLE tipos_sinal_controladores (id SERIAL PRIMARY KEY, controlador_id INT REFERENCES controladores(controlador_id) ON DELETE CASCADE, tipo_sinal TEXT NOT NULL);
async function setTiposSinalControlador(controlador_id, sinais) {
    await pool.query(`DELETE FROM tipos_sinal_controladores WHERE controlador_id = $1`, [controlador_id])
    for (const s of sinais ?? []) {
        if (!s) continue
        await pool.query(`INSERT INTO tipos_sinal_controladores (controlador_id, tipo_sinal) VALUES ($1,$2)`, [controlador_id, s])
    }
}

// Requer tabela: CREATE TABLE certificacoes_comandos (id SERIAL PRIMARY KEY, comando_id INT REFERENCES comandos(comando_id) ON DELETE CASCADE, certificacao TEXT NOT NULL);
async function setCertificacoesComando(comando_id, certs) {
    await pool.query(`DELETE FROM certificacoes_comandos WHERE comando_id = $1`, [comando_id])
    for (const c of certs ?? []) {
        if (!c) continue
        await pool.query(`INSERT INTO certificacoes_comandos (comando_id, certificacao) VALUES ($1,$2)`, [comando_id, c])
    }
}

function normalizarCerts(val) {
    if (Array.isArray(val)) return val.filter(Boolean)
    if (val && typeof val === "string") return val.split(/,\s*|\s*,\s*|,\s*/).map(s => s.trim()).filter(Boolean)
    return []
}

function normalizarFreqs(cmd) {
    // Aceita array de números ou string separada por vírgula
    if (Array.isArray(cmd?.frequencias)) return cmd.frequencias.map(v => parseFloat(v)).filter(v => isFinite(v))
    if (cmd?.frequencia) return cmd.frequencia.split(",").map(s => parseFloat(s.trim())).filter(v => isFinite(v))
    return []
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLADORES (receivers, amps, drivers)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/controladores
controladorRouter.post("/", upload.any(), async (req, res) => {
    try {
        let produto = req.body.produto
        let controlador = req.body.controlador
        let entradas = req.body.entradas
        let saidas = req.body.saidas
        let limites = req.body.limites_potencia
        let tiposControlo = req.body.tipos_controlo
        let tiposSinal = req.body.tipos_sinal
        let compatibilidades = req.body.compatibilidades

        if (typeof produto === "string") produto = JSON.parse(produto)
        if (typeof controlador === "string") controlador = JSON.parse(controlador)
        if (typeof entradas === "string") entradas = JSON.parse(entradas)
        if (typeof saidas === "string") saidas = JSON.parse(saidas)
        if (typeof limites === "string") limites = JSON.parse(limites)
        if (typeof tiposControlo === "string") tiposControlo = JSON.parse(tiposControlo)
        if (typeof tiposSinal === "string") tiposSinal = JSON.parse(tiposSinal)
        if (typeof compatibilidades === "string") compatibilidades = JSON.parse(compatibilidades)

        if (produto?.nome) produto.nome = produto.nome.toUpperCase().trim()

        const ficheirosPorNome = {}
        for (const file of req.files ?? []) ficheirosPorNome[file.fieldname] = file

        let imagem_url = null
        let imagem_extra_url = null

        if (ficheirosPorNome.imagem_url) {
            const r = await uploadBuffer(ficheirosPorNome.imagem_url.buffer, "control")
            imagem_url = r.secure_url
        }
        if (ficheirosPorNome.imagem_extra_url) {
            const r = await uploadBuffer(ficheirosPorNome.imagem_extra_url.buffer, "control")
            imagem_extra_url = r.secure_url
        }

        if (!imagem_url) return res.status(400).json({ erro: "A imagem principal é obrigatória." })
        if (!produto?.nome?.trim()) return res.status(400).json({ erro: "O nome é obrigatório.", campo: "nome" })

        const { rows: dupNomeCtrl } = await pool.query(
            `SELECT produto_id FROM produtos WHERE LOWER(nome) = LOWER($1)`,
            [produto.nome.trim()]
        )
        if (dupNomeCtrl.length > 0)
            return res.status(409).json({ erro: "Já existe um controlador com este nome.", campo: "nome" })

        await pool.query("BEGIN")

        const { rows: [{ produto_id }] } = await pool.query(
            `INSERT INTO produtos
                (referencia, nome, categoria, descricao, garantia_anos, imagem_url, imagem_extra_url, ficha_tecnica_url, ativo)
             VALUES ($1,$2,'controlador',$3,$4,$5,$6,$7,true)
             RETURNING produto_id`,
            [
                gerarReferencia(produto.nome),
                produto.nome,
                produto.descricao || null,
                parseInt(produto.garantia_anos) || null,
                imagem_url,
                imagem_extra_url,
                produto.ficha_tecnica_url || null
            ]
        )

        const { rows: [{ controlador_id }] } = await pool.query(
            `INSERT INTO controladores
                (produto_id, ip, comprimento_mm, largura_mm, altura_mm, cor, unidades_por_caixa, garantia_anos, preco)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING controlador_id`,
            [
                produto_id,
                parseInt(controlador.ip) || null,
                parseFloat(controlador.comprimento_mm) || null,
                parseFloat(controlador.largura_mm) || null,
                parseFloat(controlador.altura_mm) || null,
                controlador.cor || null,
                parseInt(controlador.unidades_por_caixa) || null,
                parseInt(produto.garantia_anos) || null,
                parseFloat(controlador.preco) || null
            ]
        )

        await setCertificacoesControlador(controlador_id, normalizarCerts(controlador.certificacoes))
        await setTiposControloControlador(controlador_id, tiposControlo ?? [])
        await setTiposSinalControlador(controlador_id, tiposSinal ?? [])

        for (const e of entradas ?? []) {
            await pool.query(
                `INSERT INTO entradas_controladores (controlador_id, tipo_input, voltagem_min, voltagem_max) VALUES ($1,$2,$3,$4)`,
                [controlador_id, e.tipo_input || null, parseFloat(e.voltagem_min) || null, parseFloat(e.voltagem_max) || null]
            )
        }
        for (const s of saidas ?? []) {
            await pool.query(
                `INSERT INTO saidas_controladores (controlador_id, numero_canais, amperes_por_canal) VALUES ($1,$2,$3)`,
                [controlador_id, parseInt(s.numero_canais) || null, parseFloat(s.amperes_por_canal) || null]
            )
        }
        for (const l of limites ?? []) {
            await pool.query(
                `INSERT INTO limites_potencia_controladores (controlador_id, voltagem, potencia_max_w) VALUES ($1,$2,$3)`,
                [controlador_id, parseFloat(l.voltagem) || null, parseFloat(l.potencia_max_w) || null]
            )
        }
        for (const cmd_id of compatibilidades ?? []) {
            await pool.query(
                `INSERT INTO compatibilidade_comando_controlador (controlador_id, comando_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [controlador_id, cmd_id]
            )
        }

        await pool.query("COMMIT")
        res.status(201).json({ success: true, controlador_id })

    } catch (error) {
        await pool.query("ROLLBACK")
        console.error("Erro ao criar controlador:", error)
        res.status(500).json({ erro: "Erro ao criar controlador", detalhe: error.message })
    }
})

// GET /api/controladores
controladorRouter.get("/", async (req, res) => {
    try {
        const verTodos = verTodosFromToken(req)
        const standalone = req.query.standalone === "true"

        const condicoes = []
        if (!verTodos) condicoes.push("p.ativo = true")
        if (standalone) condicoes.push("p.referencia NOT LIKE '%-RECEIVER'")
        const where = condicoes.length ? "WHERE " + condicoes.join(" AND ") : ""

        const mainSelect = `
            SELECT
                p.produto_id,
                p.nome,
                p.categoria,
                p.subcategoria,
                p.imagem_url,
                p.ativo,
                c.controlador_id,
                c.ip,
                c.preco,
                ARRAY_AGG(DISTINCT tc.tipo_controlo) FILTER (WHERE tc.tipo_controlo IS NOT NULL) AS tipos_controlo
             FROM produtos p
             JOIN controladores c ON c.produto_id = p.produto_id
             LEFT JOIN tipos_controlo_controladores tc ON tc.controlador_id = c.controlador_id
             ${where}
             GROUP BY p.produto_id, p.nome, p.categoria, p.subcategoria, p.imagem_url, p.ativo, c.controlador_id, c.ip, c.preco
             ORDER BY p.nome ASC`

        if (req.query.pagina !== undefined) {
            const pagina = Math.max(1, parseInt(req.query.pagina) || 1)
            const limite = Math.min(120, Math.max(1, parseInt(req.query.limite) || 60))
            const offset = (pagina - 1) * limite
            const { rows: [{ total }] } = await pool.query(
                `SELECT COUNT(*) AS total FROM produtos p JOIN controladores c ON c.produto_id = p.produto_id ${where}`
            )
            const { rows } = await pool.query(mainSelect + ` LIMIT $1 OFFSET $2`, [limite, offset])
            return res.json({ dados: rows, total: parseInt(total) })
        }

        const { rows } = await pool.query(mainSelect)
        res.json(rows)
    } catch (error) {
        console.error("Erro ao buscar controladores:", error)
        res.status(500).json({ erro: "Erro ao buscar controladores", detalhe: error.message })
    }
})

// GET /api/controladores/:id
controladorRouter.get("/:id", async (req, res) => {
    const { id } = req.params

    try {
        const { rows: [ctrl] } = await pool.query(
            `SELECT
                p.produto_id, p.referencia, p.nome, p.categoria, p.subcategoria,
                p.descricao, p.garantia_anos, p.imagem_url, p.imagem_extra_url, p.ficha_tecnica_url, p.ativo,
                c.controlador_id, c.ip, c.comprimento_mm, c.largura_mm, c.altura_mm,
                c.cor, c.unidades_por_caixa, c.garantia_anos AS ctrl_garantia_anos, c.preco
             FROM produtos p
             JOIN controladores c ON c.produto_id = p.produto_id
             WHERE p.produto_id = $1`,
            [id]
        )

        if (!ctrl) return res.status(404).json({ erro: "Controlador não encontrado" })

        const { rows: entradas } = await pool.query(
            `SELECT entrada_controlador_id, tipo_input, voltagem_min, voltagem_max
             FROM entradas_controladores WHERE controlador_id = $1 ORDER BY entrada_controlador_id`,
            [ctrl.controlador_id]
        )
        const { rows: saidas } = await pool.query(
            `SELECT saida_controlador_id, numero_canais, amperes_por_canal
             FROM saidas_controladores WHERE controlador_id = $1 ORDER BY saida_controlador_id`,
            [ctrl.controlador_id]
        )
        const { rows: limites_potencia } = await pool.query(
            `SELECT limite_potencia_id, voltagem, potencia_max_w
             FROM limites_potencia_controladores WHERE controlador_id = $1 ORDER BY limite_potencia_id`,
            [ctrl.controlador_id]
        )
        const { rows: certs } = await pool.query(
            `SELECT certificacao FROM certificacoes_controladores WHERE controlador_id = $1`,
            [ctrl.controlador_id]
        )
        const { rows: tipos } = await pool.query(
            `SELECT tipo_controlo FROM tipos_controlo_controladores WHERE controlador_id = $1`,
            [ctrl.controlador_id]
        )
        const { rows: sinais } = await pool.query(
            `SELECT tipo_sinal FROM tipos_sinal_controladores WHERE controlador_id = $1`,
            [ctrl.controlador_id]
        )
        const { rows: compatibilidades } = await pool.query(
            `SELECT cc.comando_id, p.nome
             FROM compatibilidade_comando_controlador cc
             JOIN comandos c ON c.comando_id = cc.comando_id
             JOIN produtos p ON p.produto_id = c.produto_id
             WHERE cc.controlador_id = $1
             ORDER BY p.nome ASC`,
            [ctrl.controlador_id]
        )

        const resposta = {
            ...ctrl,
            certificacoes: certs.map(r => r.certificacao),
            tipos_controlo: tipos.map(r => r.tipo_controlo),
            tipos_sinal: sinais.map(r => r.tipo_sinal),
            entradas,
            saidas,
            limites_potencia,
            compatibilidades
        }
        res.json(resposta)

    } catch (error) {
        console.error("Erro ao buscar controlador:", error)
        res.status(500).json({ erro: "Erro ao buscar controlador", detalhe: error.message })
    }
})

// PUT /api/controladores/:id
controladorRouter.put("/:id", upload.any(), async (req, res) => {
    const { id } = req.params

    try {
        let produto = req.body.produto
        let controlador = req.body.controlador
        let entradas = req.body.entradas
        let saidas = req.body.saidas
        let limites = req.body.limites_potencia
        let tiposControlo = req.body.tipos_controlo
        let tiposSinal = req.body.tipos_sinal
        let compatibilidades = req.body.compatibilidades

        if (typeof produto === "string") produto = JSON.parse(produto)
        if (typeof controlador === "string") controlador = JSON.parse(controlador)
        if (typeof entradas === "string") entradas = JSON.parse(entradas)
        if (typeof saidas === "string") saidas = JSON.parse(saidas)
        if (typeof limites === "string") limites = JSON.parse(limites)
        if (typeof tiposControlo === "string") tiposControlo = JSON.parse(tiposControlo)
        if (typeof tiposSinal === "string") tiposSinal = JSON.parse(tiposSinal)
        if (typeof compatibilidades === "string") compatibilidades = JSON.parse(compatibilidades)

        if (produto?.nome) produto.nome = produto.nome.toUpperCase().trim()

        const ficheirosPorNome = {}
        for (const file of req.files ?? []) ficheirosPorNome[file.fieldname] = file

        let imagem_url = produto.imagem_url_atual || null
        let imagem_extra_url = produto.imagem_extra_url_atual || null

        if (ficheirosPorNome.imagem_url) {
            const r = await uploadBuffer(ficheirosPorNome.imagem_url.buffer, "control")
            imagem_url = r.secure_url
        }
        if (ficheirosPorNome.imagem_extra_url) {
            const r = await uploadBuffer(ficheirosPorNome.imagem_extra_url.buffer, "control")
            imagem_extra_url = r.secure_url
        }

        if (!produto?.nome?.trim()) return res.status(400).json({ erro: "O nome é obrigatório.", campo: "nome" })

        const { rows: dupNomeCtrl } = await pool.query(
            `SELECT produto_id FROM produtos WHERE LOWER(nome) = LOWER($1) AND produto_id != $2`,
            [produto.nome.trim(), id]
        )
        if (dupNomeCtrl.length > 0)
            return res.status(409).json({ erro: "Já existe outro controlador com este nome.", campo: "nome" })

        const { rows: [urlsAtuais] } = await pool.query(
            `SELECT imagem_url, imagem_extra_url FROM produtos WHERE produto_id = $1`,
            [id]
        )

        await pool.query("BEGIN")

        const { rows: [{ controlador_id }] } = await pool.query(
            `SELECT controlador_id FROM controladores WHERE produto_id = $1`,
            [id]
        )

        await pool.query(
            `UPDATE produtos SET
                referencia = $1, nome = $2, descricao = $3, garantia_anos = $4,
                imagem_url = $5, imagem_extra_url = $6, ficha_tecnica_url = $7
             WHERE produto_id = $8`,
            [
                gerarReferencia(produto.nome),
                produto.nome,
                produto.descricao || null,
                parseInt(produto.garantia_anos) || null,
                imagem_url,
                imagem_extra_url,
                produto.ficha_tecnica_url || null,
                id
            ]
        )

        await pool.query(
            `UPDATE controladores SET
                ip = $1, comprimento_mm = $2, largura_mm = $3, altura_mm = $4,
                cor = $5, unidades_por_caixa = $6, garantia_anos = $7, preco = $8
             WHERE controlador_id = $9`,
            [
                parseInt(controlador.ip) || null,
                parseFloat(controlador.comprimento_mm) || null,
                parseFloat(controlador.largura_mm) || null,
                parseFloat(controlador.altura_mm) || null,
                controlador.cor || null,
                parseInt(controlador.unidades_por_caixa) || null,
                parseInt(produto.garantia_anos) || null,
                parseFloat(controlador.preco) || null,
                controlador_id
            ]
        )

        await setCertificacoesControlador(controlador_id, normalizarCerts(controlador.certificacoes))
        await setTiposControloControlador(controlador_id, tiposControlo ?? [])
        await setTiposSinalControlador(controlador_id, tiposSinal ?? [])

        await pool.query(`DELETE FROM entradas_controladores WHERE controlador_id = $1`, [controlador_id])
        await pool.query(`DELETE FROM saidas_controladores WHERE controlador_id = $1`, [controlador_id])
        await pool.query(`DELETE FROM limites_potencia_controladores WHERE controlador_id = $1`, [controlador_id])

        for (const e of entradas ?? []) {
            await pool.query(
                `INSERT INTO entradas_controladores (controlador_id, tipo_input, voltagem_min, voltagem_max) VALUES ($1,$2,$3,$4)`,
                [controlador_id, e.tipo_input || null, parseFloat(e.voltagem_min) || null, parseFloat(e.voltagem_max) || null]
            )
        }
        for (const s of saidas ?? []) {
            await pool.query(
                `INSERT INTO saidas_controladores (controlador_id, numero_canais, amperes_por_canal) VALUES ($1,$2,$3)`,
                [controlador_id, parseInt(s.numero_canais) || null, parseFloat(s.amperes_por_canal) || null]
            )
        }
        for (const l of limites ?? []) {
            await pool.query(
                `INSERT INTO limites_potencia_controladores (controlador_id, voltagem, potencia_max_w) VALUES ($1,$2,$3)`,
                [controlador_id, parseFloat(l.voltagem) || null, parseFloat(l.potencia_max_w) || null]
            )
        }

        await pool.query(`DELETE FROM compatibilidade_comando_controlador WHERE controlador_id = $1`, [controlador_id])
        for (const cmd_id of compatibilidades ?? []) {
            await pool.query(
                `INSERT INTO compatibilidade_comando_controlador (controlador_id, comando_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [controlador_id, cmd_id]
            )
        }

        await pool.query("COMMIT")

        if (ficheirosPorNome.imagem_url) await eliminarImagemCloudinary(urlsAtuais.imagem_url)
        if (ficheirosPorNome.imagem_extra_url) await eliminarImagemCloudinary(urlsAtuais.imagem_extra_url)

        res.json({ success: true })

    } catch (error) {
        await pool.query("ROLLBACK")
        console.error("Erro ao editar controlador:", error)
        res.status(500).json({ erro: "Erro ao editar controlador", detalhe: error.message })
    }
})

// PATCH /api/controladores/:id/ativo
controladorRouter.patch("/:id/ativo", async (req, res) => {
    const { id } = req.params
    try {
        const { rows: [produto] } = await pool.query(
            `UPDATE produtos SET ativo = NOT ativo WHERE produto_id = $1 RETURNING ativo`,
            [id]
        )
        if (!produto) return res.status(404).json({ erro: "Produto não encontrado" })
        res.json({ ativo: produto.ativo })
    } catch (error) {
        console.error("Erro ao alterar ativo:", error)
        res.status(500).json({ erro: "Erro ao alterar estado", detalhe: error.message })
    }
})

// ═══════════════════════════════════════════════════════════════════════════════
// COMANDOS (remotes standalone)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/comandos
comandoRouter.post("/", upload.any(), async (req, res) => {
    try {
        let produto = req.body.produto
        let comando = req.body.comando
        let tiposControlo = req.body.tipos_controlo
        let compatibilidades = req.body.compatibilidades
        let entradas = req.body.entradas

        if (typeof produto === "string") produto = JSON.parse(produto)
        if (typeof comando === "string") comando = JSON.parse(comando)
        if (typeof tiposControlo === "string") tiposControlo = JSON.parse(tiposControlo)
        if (typeof compatibilidades === "string") compatibilidades = JSON.parse(compatibilidades)
        if (typeof entradas === "string") entradas = JSON.parse(entradas)

        if (produto?.nome) produto.nome = produto.nome.toUpperCase().trim()

        const ficheirosPorNome = {}
        for (const file of req.files ?? []) ficheirosPorNome[file.fieldname] = file

        let imagem_url = null
        let imagem_extra_url = null

        if (ficheirosPorNome.imagem_url) {
            const r = await uploadBuffer(ficheirosPorNome.imagem_url.buffer, "control")
            imagem_url = r.secure_url
        }
        if (ficheirosPorNome.imagem_extra_url) {
            const r = await uploadBuffer(ficheirosPorNome.imagem_extra_url.buffer, "control")
            imagem_extra_url = r.secure_url
        }

        if (!imagem_url) return res.status(400).json({ erro: "A imagem principal é obrigatória." })
        if (!produto?.nome?.trim()) return res.status(400).json({ erro: "O nome é obrigatório.", campo: "nome" })

        await pool.query("BEGIN")

        let referencia = gerarReferencia(produto.nome)
        const { rows: [refExistente] } = await pool.query(
            `SELECT 1 FROM produtos WHERE referencia = $1 LIMIT 1`, [referencia]
        )
        if (refExistente) {
            if (!comando.cor) return res.status(409).json({ erro: "Já existe um comando com este nome. Preenche a cor para diferenciar a referência." })
            referencia = gerarReferencia(produto.nome + " " + comando.cor)
            const { rows: [refCorExistente] } = await pool.query(
                `SELECT 1 FROM produtos WHERE referencia = $1 LIMIT 1`, [referencia]
            )
            if (refCorExistente) return res.status(409).json({ erro: "Já existe um comando com este nome e esta cor. Altera o nome ou a cor." })
        }

        const { rows: [{ produto_id }] } = await pool.query(
            `INSERT INTO produtos
                (referencia, nome, categoria, subcategoria, descricao, garantia_anos, imagem_url, imagem_extra_url, ficha_tecnica_url, ativo)
             VALUES ($1,$2,'controlador','Comando',$3,$4,$5,$6,$7,true)
             RETURNING produto_id`,
            [
                referencia,
                produto.nome,
                produto.descricao || null,
                parseInt(produto.garantia_anos) || null,
                imagem_url,
                imagem_extra_url,
                produto.ficha_tecnica_url || null
            ]
        )

        const { rows: [{ comando_id }] } = await pool.query(
            `INSERT INTO comandos
                (produto_id, tipo_alimentacao, numero_zonas, comprimento_mm, largura_mm, altura_mm,
                 cor, garantia_anos, vendido_individualmente, preco)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING comando_id`,
            [
                produto_id,
                comando.tipo_alimentacao || null,
                parseInt(comando.numero_zonas) || null,
                parseFloat(comando.comprimento_mm) || null,
                parseFloat(comando.largura_mm) || null,
                parseFloat(comando.altura_mm) || null,
                comando.cor || null,
                parseInt(produto.garantia_anos) || null,
                comando.vendido_individualmente === true || comando.vendido_individualmente === "true",
                parseFloat(comando.preco) || null
            ]
        )

        await setFrequenciasComando(comando_id, normalizarFreqs(comando))
        await setTiposControloComando(comando_id, tiposControlo ?? [])
        await setEntradasComando(comando_id, entradas ?? [])

        for (const ctrl_id of compatibilidades ?? []) {
            await pool.query(
                `INSERT INTO compatibilidade_comando_controlador (controlador_id, comando_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [ctrl_id, comando_id]
            )
        }

        await pool.query("COMMIT")
        res.status(201).json({ success: true, comando_id })

    } catch (error) {
        await pool.query("ROLLBACK")
        console.error("Erro ao criar comando:", error)
        res.status(500).json({ erro: "Erro ao criar comando", detalhe: error.message })
    }
})

// GET /api/comandos
comandoRouter.get("/", async (req, res) => {
    try {
        const verTodos = verTodosFromToken(req)
        const standalone = req.query.standalone === "true"

        const condicoes = []
        if (!verTodos) condicoes.push("p.ativo = true")
        if (standalone) condicoes.push("p.referencia NOT LIKE '%-REMOTE'")
        const where = condicoes.length ? "WHERE " + condicoes.join(" AND ") : ""

        const mainSelect = `
            SELECT
                p.produto_id,
                p.nome,
                p.categoria,
                p.subcategoria,
                p.imagem_url,
                p.ativo,
                c.comando_id,
                c.preco,
                ARRAY_AGG(DISTINCT tc.tipo_controlo) FILTER (WHERE tc.tipo_controlo IS NOT NULL) AS tipos_controlo
             FROM produtos p
             JOIN comandos c ON c.produto_id = p.produto_id
             LEFT JOIN tipos_controlo_comandos tc ON tc.comando_id = c.comando_id
             ${where}
             GROUP BY p.produto_id, p.nome, p.categoria, p.subcategoria, p.imagem_url, p.ativo, c.comando_id, c.preco
             ORDER BY p.nome ASC`

        if (req.query.pagina !== undefined) {
            const pagina = Math.max(1, parseInt(req.query.pagina) || 1)
            const limite = Math.min(120, Math.max(1, parseInt(req.query.limite) || 60))
            const offset = (pagina - 1) * limite
            const { rows: [{ total }] } = await pool.query(
                `SELECT COUNT(*) AS total FROM produtos p JOIN comandos c ON c.produto_id = p.produto_id ${where}`
            )
            const { rows } = await pool.query(mainSelect + ` LIMIT $1 OFFSET $2`, [limite, offset])
            return res.json({ dados: rows, total: parseInt(total) })
        }

        const { rows } = await pool.query(mainSelect)
        res.json(rows)
    } catch (error) {
        console.error("Erro ao buscar comandos:", error)
        res.status(500).json({ erro: "Erro ao buscar comandos", detalhe: error.message })
    }
})

// GET /api/comandos/:id
comandoRouter.get("/:id", async (req, res) => {
    const { id } = req.params

    try {
        const { rows: [cmd] } = await pool.query(
            `SELECT
                p.produto_id, p.referencia, p.nome, p.categoria, p.subcategoria,
                p.descricao, p.garantia_anos, p.imagem_url, p.imagem_extra_url, p.ficha_tecnica_url, p.ativo,
                c.comando_id, c.tipo_alimentacao, c.numero_zonas,
                c.comprimento_mm, c.largura_mm, c.altura_mm,
                c.cor, c.garantia_anos AS cmd_garantia_anos,
                c.vendido_individualmente, c.preco
             FROM produtos p
             JOIN comandos c ON c.produto_id = p.produto_id
             WHERE p.produto_id = $1`,
            [id]
        )

        if (!cmd) return res.status(404).json({ erro: "Comando não encontrado" })

        const { rows: freqs } = await pool.query(
            `SELECT frequencia_mhz FROM frequencias_comandos WHERE comando_id = $1 ORDER BY frequencia_mhz`,
            [cmd.comando_id]
        )
        const { rows: tipos } = await pool.query(
            `SELECT tipo_controlo FROM tipos_controlo_comandos WHERE comando_id = $1`,
            [cmd.comando_id]
        )
        const { rows: compatibilidades } = await pool.query(
            `SELECT cc.controlador_id, p.nome
             FROM compatibilidade_comando_controlador cc
             JOIN controladores c ON c.controlador_id = cc.controlador_id
             JOIN produtos p ON p.produto_id = c.produto_id
             WHERE cc.comando_id = $1
             ORDER BY p.nome ASC`,
            [cmd.comando_id]
        )
        const { rows: entradas } = await pool.query(
            `SELECT tipo_input, voltagem_min, voltagem_max FROM entradas_comandos WHERE comando_id = $1`,
            [cmd.comando_id]
        )

        res.json({
            ...cmd,
            frequencias: freqs.map(r => r.frequencia_mhz),
            tipos_controlo: tipos.map(r => r.tipo_controlo),
            compatibilidades,
            entradas
        })

    } catch (error) {
        console.error("Erro ao buscar comando:", error)
        res.status(500).json({ erro: "Erro ao buscar comando", detalhe: error.message })
    }
})

// PUT /api/comandos/:id
comandoRouter.put("/:id", upload.any(), async (req, res) => {
    const { id } = req.params

    try {
        let produto = req.body.produto
        let comando = req.body.comando
        let tiposControlo = req.body.tipos_controlo
        let compatibilidades = req.body.compatibilidades
        let entradas = req.body.entradas

        if (typeof produto === "string") produto = JSON.parse(produto)
        if (typeof comando === "string") comando = JSON.parse(comando)
        if (typeof tiposControlo === "string") tiposControlo = JSON.parse(tiposControlo)
        if (typeof compatibilidades === "string") compatibilidades = JSON.parse(compatibilidades)
        if (typeof entradas === "string") entradas = JSON.parse(entradas)

        if (produto?.nome) produto.nome = produto.nome.toUpperCase().trim()

        const ficheirosPorNome = {}
        for (const file of req.files ?? []) ficheirosPorNome[file.fieldname] = file

        let imagem_url = produto.imagem_url_atual || null
        let imagem_extra_url = produto.imagem_extra_url_atual || null

        if (ficheirosPorNome.imagem_url) {
            const r = await uploadBuffer(ficheirosPorNome.imagem_url.buffer, "control")
            imagem_url = r.secure_url
        }
        if (ficheirosPorNome.imagem_extra_url) {
            const r = await uploadBuffer(ficheirosPorNome.imagem_extra_url.buffer, "control")
            imagem_extra_url = r.secure_url
        }

        const { rows: [urlsAtuais] } = await pool.query(
            `SELECT imagem_url, imagem_extra_url FROM produtos WHERE produto_id = $1`,
            [id]
        )

        let referencia = gerarReferencia(produto.nome)
        const { rows: [refExistente] } = await pool.query(
            `SELECT 1 FROM produtos WHERE referencia = $1 AND produto_id != $2 LIMIT 1`, [referencia, id]
        )
        if (refExistente) {
            if (!comando.cor) return res.status(409).json({ erro: "Já existe um comando com este nome. Preenche a cor para diferenciar a referência." })
            referencia = gerarReferencia(produto.nome + " " + comando.cor)
            const { rows: [refCorExistente] } = await pool.query(
                `SELECT 1 FROM produtos WHERE referencia = $1 AND produto_id != $2 LIMIT 1`, [referencia, id]
            )
            if (refCorExistente) return res.status(409).json({ erro: "Já existe um comando com este nome e esta cor. Altera o nome ou a cor." })
        }

        await pool.query("BEGIN")

        const { rows: [{ comando_id }] } = await pool.query(
            `SELECT comando_id FROM comandos WHERE produto_id = $1`,
            [id]
        )

        await pool.query(
            `UPDATE produtos SET
                referencia = $1, nome = $2, descricao = $3, garantia_anos = $4,
                imagem_url = $5, imagem_extra_url = $6, ficha_tecnica_url = $7
             WHERE produto_id = $8`,
            [
                referencia,
                produto.nome,
                produto.descricao || null,
                parseInt(produto.garantia_anos) || null,
                imagem_url,
                imagem_extra_url,
                produto.ficha_tecnica_url || null,
                id
            ]
        )

        await pool.query(
            `UPDATE comandos SET
                tipo_alimentacao = $1, numero_zonas = $2,
                comprimento_mm = $3, largura_mm = $4, altura_mm = $5,
                cor = $6, garantia_anos = $7,
                vendido_individualmente = $8, preco = $9
             WHERE comando_id = $10`,
            [
                comando.tipo_alimentacao || null,
                parseInt(comando.numero_zonas) || null,
                parseFloat(comando.comprimento_mm) || null,
                parseFloat(comando.largura_mm) || null,
                parseFloat(comando.altura_mm) || null,
                comando.cor || null,
                parseInt(produto.garantia_anos) || null,
                comando.vendido_individualmente === true || comando.vendido_individualmente === "true",
                parseFloat(comando.preco) || null,
                comando_id
            ]
        )

        await setFrequenciasComando(comando_id, normalizarFreqs(comando))
        await setTiposControloComando(comando_id, tiposControlo ?? [])
        await setEntradasComando(comando_id, entradas ?? [])

        await pool.query(`DELETE FROM compatibilidade_comando_controlador WHERE comando_id = $1`, [comando_id])
        for (const ctrl_id of compatibilidades ?? []) {
            await pool.query(
                `INSERT INTO compatibilidade_comando_controlador (controlador_id, comando_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [ctrl_id, comando_id]
            )
        }

        await pool.query("COMMIT")

        if (ficheirosPorNome.imagem_url) await eliminarImagemCloudinary(urlsAtuais.imagem_url)
        if (ficheirosPorNome.imagem_extra_url) await eliminarImagemCloudinary(urlsAtuais.imagem_extra_url)

        res.json({ success: true })

    } catch (error) {
        await pool.query("ROLLBACK")
        console.error("Erro ao editar comando:", error)
        res.status(500).json({ erro: "Erro ao editar comando", detalhe: error.message })
    }
})

// PATCH /api/comandos/:id/ativo
comandoRouter.patch("/:id/ativo", async (req, res) => {
    const { id } = req.params
    try {
        const { rows: [produto] } = await pool.query(
            `UPDATE produtos SET ativo = NOT ativo WHERE produto_id = $1 RETURNING ativo`,
            [id]
        )
        if (!produto) return res.status(404).json({ erro: "Produto não encontrado" })
        res.json({ ativo: produto.ativo })
    } catch (error) {
        console.error("Erro ao alterar ativo:", error)
        res.status(500).json({ erro: "Erro ao alterar estado", detalhe: error.message })
    }
})

// ═══════════════════════════════════════════════════════════════════════════════
// KITS
// Kit: referencia = NOME imagem_url = imagem do kit
// Receiver: referencia = ECT-NOME-RECEIVER imagem_url + imagem_extra_url (medidas)
// Remote: referencia = ECT-NOME-REMOTE imagem_url + imagem_extra_url (medidas)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/kits
kitRouter.post("/", upload.any(), async (req, res) => {
    try {
        let produto = req.body.produto
        let receiver = req.body.receiver
        let remote = req.body.remote

        if (typeof produto === "string") produto = JSON.parse(produto)
        if (typeof receiver === "string") receiver = JSON.parse(receiver)
        if (typeof remote === "string") remote = JSON.parse(remote)

        if (produto?.nome) produto.nome = produto.nome.toUpperCase().trim()

        const ficheirosPorNome = {}
        for (const file of req.files ?? []) ficheirosPorNome[file.fieldname] = file

        let receiver_imagem_url = null
        let receiver_imagem_extra_url = null
        let remote_imagem_url = null
        let remote_imagem_extra_url = null

        if (ficheirosPorNome.receiver_imagem_url) {
            const r = await uploadBuffer(ficheirosPorNome.receiver_imagem_url.buffer, "control")
            receiver_imagem_url = r.secure_url
        }
        if (ficheirosPorNome.receiver_imagem_extra_url) {
            const r = await uploadBuffer(ficheirosPorNome.receiver_imagem_extra_url.buffer, "control")
            receiver_imagem_extra_url = r.secure_url
        }
        if (ficheirosPorNome.remote_imagem_url) {
            const r = await uploadBuffer(ficheirosPorNome.remote_imagem_url.buffer, "control")
            remote_imagem_url = r.secure_url
        }
        if (ficheirosPorNome.remote_imagem_extra_url) {
            const r = await uploadBuffer(ficheirosPorNome.remote_imagem_extra_url.buffer, "control")
            remote_imagem_extra_url = r.secure_url
        }

        if (receiver.controlador_id == null && !receiver_imagem_url) return res.status(400).json({ erro: "A imagem do receiver é obrigatória." })
        if (remote.comando_id == null && !remote_imagem_url) return res.status(400).json({ erro: "A imagem do remote é obrigatória." })

        const nomeKit = produto.nome

        await pool.query("BEGIN")

        // 1. Produto do kit
        const { rows: [{ produto_id: kit_produto_id }] } = await pool.query(
            `INSERT INTO produtos
                (referencia, nome, categoria, subcategoria, descricao, imagem_url, ativo)
             VALUES ($1,$2,'controlador','Kit',$3,$4,true)
             RETURNING produto_id`,
            [gerarReferenciaKit(nomeKit), nomeKit, produto.descricao || null, receiver_imagem_url || "none"]
        )

        // 2. Receiver — criar novo ou usar existente
        let controlador_id
        if (receiver.controlador_id) {
            controlador_id = parseInt(receiver.controlador_id)
        } else {
            const { rows: [{ produto_id: receiver_produto_id }] } = await pool.query(
                `INSERT INTO produtos
                    (referencia, nome, categoria, descricao, garantia_anos, imagem_url, imagem_extra_url, ficha_tecnica_url, ativo)
                 VALUES ($1,$2,'controlador',$3,$4,$5,$6,$7,true)
                 RETURNING produto_id`,
                [
                    gerarReferenciaKitReceiver(nomeKit),
                    receiver.nome || (nomeKit + " Receiver"),
                    receiver.descricao || null,
                    parseInt(receiver.garantia_anos) || null,
                    receiver_imagem_url || "none",
                    receiver_imagem_extra_url,
                    receiver.ficha_tecnica_url || null
                ]
            )

            const { rows: [{ controlador_id: novo_ctrl_id }] } = await pool.query(
                `INSERT INTO controladores
                    (produto_id, ip, comprimento_mm, largura_mm, altura_mm, cor, unidades_por_caixa, garantia_anos, preco)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 RETURNING controlador_id`,
                [
                    receiver_produto_id,
                    parseInt(receiver.ip) || null,
                    parseFloat(receiver.comprimento_mm) || null,
                    parseFloat(receiver.largura_mm) || null,
                    parseFloat(receiver.altura_mm) || null,
                    receiver.cor || null,
                    parseInt(receiver.unidades_por_caixa) || null,
                    parseInt(receiver.garantia_anos) || null,
                    parseFloat(produto.preco) || null
                ]
            )
            controlador_id = novo_ctrl_id

            await setCertificacoesControlador(controlador_id, normalizarCerts(receiver.certificacoes))
            await setTiposControloControlador(controlador_id, receiver.tipos_controlo ?? [])
            await setTiposSinalControlador(controlador_id, receiver.tipos_sinal ?? [])
            await setFrequenciasControlador(controlador_id, normalizarFreqs(receiver))

            for (const e of receiver.entradas ?? []) {
                await pool.query(
                    `INSERT INTO entradas_controladores (controlador_id, tipo_input, voltagem_min, voltagem_max) VALUES ($1,$2,$3,$4)`,
                    [controlador_id, e.tipo_input || null, parseFloat(e.voltagem_min) || null, parseFloat(e.voltagem_max) || null]
                )
            }
            for (const s of receiver.saidas ?? []) {
                await pool.query(
                    `INSERT INTO saidas_controladores (controlador_id, numero_canais, amperes_por_canal) VALUES ($1,$2,$3)`,
                    [controlador_id, parseInt(s.numero_canais) || null, parseFloat(s.amperes_por_canal) || null]
                )
            }
            for (const l of receiver.limites_potencia ?? []) {
                await pool.query(
                    `INSERT INTO limites_potencia_controladores (controlador_id, voltagem, potencia_max_w) VALUES ($1,$2,$3)`,
                    [controlador_id, parseFloat(l.voltagem) || null, parseFloat(l.potencia_max_w) || null]
                )
            }
        }

        // 3. Remote — criar novo ou usar existente
        let comando_id
        if (remote.comando_id) {
            comando_id = parseInt(remote.comando_id)
        } else {
            const { rows: [{ produto_id: remote_produto_id }] } = await pool.query(
                `INSERT INTO produtos
                    (referencia, nome, categoria, subcategoria, descricao, garantia_anos, imagem_url, imagem_extra_url, ficha_tecnica_url, ativo)
                 VALUES ($1,$2,'controlador','Comando',$3,$4,$5,$6,$7,true)
                 RETURNING produto_id`,
                [
                    gerarReferenciaKitRemote(nomeKit),
                    remote.nome || (nomeKit + " Remote"),
                    remote.descricao || null,
                    parseInt(remote.garantia_anos) || null,
                    remote_imagem_url,
                    remote_imagem_extra_url,
                    remote.ficha_tecnica_url || null
                ]
            )

            const { rows: [{ comando_id: novo_cmd_id }] } = await pool.query(
                `INSERT INTO comandos
                    (produto_id, tipo_alimentacao, comprimento_mm, largura_mm, altura_mm,
                     cor, garantia_anos, preco)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 RETURNING comando_id`,
                [
                    remote_produto_id,
                    remote.tipo_alimentacao || null,
                    parseFloat(remote.comprimento_mm) || null,
                    parseFloat(remote.largura_mm) || null,
                    parseFloat(remote.altura_mm) || null,
                    remote.cor || null,
                    parseInt(receiver.garantia_anos) || null,
                    parseFloat(produto.preco) || null
                ]
            )
            comando_id = novo_cmd_id

            await setFrequenciasComando(comando_id, normalizarFreqs(remote))
            await setTiposControloComando(comando_id, receiver.tipos_controlo ?? [])
            await setCertificacoesComando(comando_id, normalizarCerts(remote.certificacoes))
        }

        // 4. Kit
        const { rows: [{ kit_controlador_id }] } = await pool.query(
            `INSERT INTO kits_controladores (produto_id, controlador_id, comando_id, preco)
             VALUES ($1,$2,$3,$4)
             RETURNING kit_controlador_id`,
            [kit_produto_id, controlador_id, comando_id, parseFloat(produto.preco) || null]
        )

        await pool.query("COMMIT")
        res.status(201).json({ success: true, kit_controlador_id, controlador_id, comando_id })

    } catch (error) {
        await pool.query("ROLLBACK")
        console.error("Erro ao criar kit:", error)
        res.status(500).json({ erro: "Erro ao criar kit", detalhe: error.message })
    }
})

// GET /api/kits
kitRouter.get("/", async (req, res) => {
    try {
        const verTodos = verTodosFromToken(req)

        const where = verTodos ? "" : "WHERE p.ativo = true"
        const mainSelect = `
            SELECT
                p.produto_id,
                p.nome,
                p.categoria,
                p.subcategoria,
                p.imagem_url,
                p.ativo,
                k.kit_controlador_id,
                k.preco,
                pc.nome AS receiver_nome,
                pm.nome AS remote_nome,
                ARRAY_AGG(DISTINCT tc.tipo_controlo) FILTER (WHERE tc.tipo_controlo IS NOT NULL) AS tipos_controlo
             FROM produtos p
             JOIN kits_controladores k ON k.produto_id = p.produto_id
             LEFT JOIN controladores c ON c.controlador_id = k.controlador_id
             LEFT JOIN produtos pc ON pc.produto_id = c.produto_id
             LEFT JOIN comandos cm ON cm.comando_id = k.comando_id
             LEFT JOIN produtos pm ON pm.produto_id = cm.produto_id
             LEFT JOIN tipos_controlo_controladores tc ON tc.controlador_id = k.controlador_id
             ${where}
             GROUP BY p.produto_id, p.nome, p.categoria, p.subcategoria, p.imagem_url, p.ativo, k.kit_controlador_id, k.preco, pc.nome, pm.nome
             ORDER BY p.nome ASC`

        if (req.query.pagina !== undefined) {
            const pagina = Math.max(1, parseInt(req.query.pagina) || 1)
            const limite = Math.min(120, Math.max(1, parseInt(req.query.limite) || 60))
            const offset = (pagina - 1) * limite
            const { rows: [{ total }] } = await pool.query(
                `SELECT COUNT(*) AS total FROM produtos p JOIN kits_controladores k ON k.produto_id = p.produto_id ${where}`
            )
            const { rows } = await pool.query(mainSelect + ` LIMIT $1 OFFSET $2`, [limite, offset])
            return res.json({ dados: rows, total: parseInt(total) })
        }

        const { rows } = await pool.query(mainSelect)
        res.json(rows)
    } catch (error) {
        console.error("Erro ao buscar kits:", error)
        res.status(500).json({ erro: "Erro ao buscar kits", detalhe: error.message })
    }
})

// GET /api/kits/:id
kitRouter.get("/:id", async (req, res) => {
    const { id } = req.params

    try {
        const { rows: [kit] } = await pool.query(
            `SELECT
                p.produto_id, p.referencia, p.nome, p.descricao, p.imagem_url, p.ativo,
                k.kit_controlador_id, k.controlador_id, k.comando_id, k.preco
             FROM produtos p
             JOIN kits_controladores k ON k.produto_id = p.produto_id
             WHERE p.produto_id = $1`,
            [id]
        )

        if (!kit) return res.status(404).json({ erro: "Kit não encontrado" })

        // Receiver
        const { rows: [receiverRow] } = await pool.query(
            `SELECT
                p.produto_id AS receiver_produto_id,
                p.referencia AS receiver_referencia,
                p.nome AS receiver_nome,
                p.descricao AS receiver_descricao,
                p.garantia_anos AS receiver_garantia_anos,
                p.imagem_url AS receiver_imagem_url,
                p.imagem_extra_url AS receiver_imagem_extra_url,
                p.ficha_tecnica_url AS receiver_ficha_tecnica_url,
                c.controlador_id,
                c.ip, c.comprimento_mm, c.largura_mm, c.altura_mm,
                c.cor, c.unidades_por_caixa,
                c.garantia_anos AS receiver_ctrl_garantia_anos,
                c.preco AS receiver_preco
             FROM controladores c
             JOIN produtos p ON p.produto_id = c.produto_id
             WHERE c.controlador_id = $1`,
            [kit.controlador_id]
        )

        const { rows: receiver_certs } = await pool.query(`SELECT certificacao FROM certificacoes_controladores WHERE controlador_id = $1`, [kit.controlador_id])
        const { rows: receiver_tipos } = await pool.query(`SELECT tipo_controlo FROM tipos_controlo_controladores WHERE controlador_id = $1`, [kit.controlador_id])
        const { rows: receiver_sinais } = await pool.query(`SELECT tipo_sinal FROM tipos_sinal_controladores WHERE controlador_id = $1`, [kit.controlador_id])
        const { rows: receiver_freqs } = await pool.query(`SELECT frequencia_mhz FROM frequencias_controladores WHERE controlador_id = $1 ORDER BY frequencia_mhz`, [kit.controlador_id])
        const { rows: receiver_entradas } = await pool.query(`SELECT tipo_input, voltagem_min, voltagem_max FROM entradas_controladores WHERE controlador_id = $1`, [kit.controlador_id])
        const { rows: receiver_saidas } = await pool.query(`SELECT numero_canais, amperes_por_canal FROM saidas_controladores WHERE controlador_id = $1`, [kit.controlador_id])
        const { rows: receiver_limites } = await pool.query(`SELECT voltagem, potencia_max_w FROM limites_potencia_controladores WHERE controlador_id = $1`, [kit.controlador_id])

        // Remote
        const { rows: [remoteRow] } = await pool.query(
            `SELECT
                p.produto_id AS remote_produto_id,
                p.referencia AS remote_referencia,
                p.nome AS remote_nome,
                p.descricao AS remote_descricao,
                p.garantia_anos AS remote_garantia_anos,
                p.imagem_url AS remote_imagem_url,
                p.imagem_extra_url AS remote_imagem_extra_url,
                p.ficha_tecnica_url AS remote_ficha_tecnica_url,
                c.comando_id,
                c.tipo_alimentacao, c.numero_zonas,
                c.comprimento_mm AS remote_comprimento_mm,
                c.largura_mm AS remote_largura_mm,
                c.altura_mm AS remote_altura_mm,
                c.cor AS remote_cor,
                c.garantia_anos AS remote_cmd_garantia_anos,
                c.vendido_individualmente,
                c.preco AS remote_preco
             FROM comandos c
             JOIN produtos p ON p.produto_id = c.produto_id
             WHERE c.comando_id = $1`,
            [kit.comando_id]
        )

        const { rows: remote_freqs } = await pool.query(`SELECT frequencia_mhz FROM frequencias_comandos WHERE comando_id = $1 ORDER BY frequencia_mhz`, [kit.comando_id])
        const { rows: remote_tipos } = await pool.query(`SELECT tipo_controlo FROM tipos_controlo_comandos WHERE comando_id = $1`, [kit.comando_id])
        const { rows: remote_certs } = await pool.query(`SELECT certificacao FROM certificacoes_comandos WHERE comando_id = $1`, [kit.comando_id])

        res.json({
            ...kit,
            receiver: {
                ...receiverRow,
                certificacoes: receiver_certs.map(r => r.certificacao),
                receiver_tipos_controlo: receiver_tipos.map(r => r.tipo_controlo),
                receiver_tipos_sinal: receiver_sinais.map(r => r.tipo_sinal),
                receiver_frequencias: receiver_freqs.map(r => r.frequencia_mhz),
                entradas: receiver_entradas,
                saidas: receiver_saidas,
                limites: receiver_limites
            },
            remote: {
                ...remoteRow,
                frequencias: remote_freqs.map(r => r.frequencia_mhz),
                remote_tipos_controlo: remote_tipos.map(r => r.tipo_controlo),
                remote_certificacoes: remote_certs.map(r => r.certificacao)
            }
        })

    } catch (error) {
        console.error("Erro ao buscar kit:", error)
        res.status(500).json({ erro: "Erro ao buscar kit", detalhe: error.message })
    }
})

// PUT /api/kits/:id
kitRouter.put("/:id", upload.any(), async (req, res) => {
    const { id } = req.params

    try {
        let produto = req.body.produto
        let receiver = req.body.receiver
        let remote = req.body.remote

        if (typeof produto === "string") produto = JSON.parse(produto)
        if (typeof receiver === "string") receiver = JSON.parse(receiver)
        if (typeof remote === "string") remote = JSON.parse(remote)

        if (produto?.nome) produto.nome = produto.nome.toUpperCase().trim()

        const ficheirosPorNome = {}
        for (const file of req.files ?? []) ficheirosPorNome[file.fieldname] = file

        let receiver_imagem_url = receiver.imagem_url_atual || null
        let receiver_imagem_extra_url = receiver.imagem_extra_url_atual || null
        let remote_imagem_url = remote.imagem_url_atual || null
        let remote_imagem_extra_url = remote.imagem_extra_url_atual || null

        if (ficheirosPorNome.receiver_imagem_url) {
            const r = await uploadBuffer(ficheirosPorNome.receiver_imagem_url.buffer, "control")
            receiver_imagem_url = r.secure_url
        }
        if (ficheirosPorNome.receiver_imagem_extra_url) {
            const r = await uploadBuffer(ficheirosPorNome.receiver_imagem_extra_url.buffer, "control")
            receiver_imagem_extra_url = r.secure_url
        }
        if (ficheirosPorNome.remote_imagem_url) {
            const r = await uploadBuffer(ficheirosPorNome.remote_imagem_url.buffer, "control")
            remote_imagem_url = r.secure_url
        }
        if (ficheirosPorNome.remote_imagem_extra_url) {
            const r = await uploadBuffer(ficheirosPorNome.remote_imagem_extra_url.buffer, "control")
            remote_imagem_extra_url = r.secure_url
        }

        const { rows: [kitsRow] } = await pool.query(`SELECT controlador_id, comando_id FROM kits_controladores WHERE produto_id = $1`, [id])
        const { rows: [receiverUrls] } = await pool.query(`SELECT p.imagem_url, p.imagem_extra_url FROM produtos p JOIN controladores c ON c.produto_id = p.produto_id WHERE c.controlador_id = $1`, [kitsRow.controlador_id])
        const { rows: [remoteUrls] } = await pool.query(`SELECT p.imagem_url, p.imagem_extra_url FROM produtos p JOIN comandos c ON c.produto_id = p.produto_id WHERE c.comando_id = $1`, [kitsRow.comando_id])

        const nomeKit = produto.nome

        await pool.query("BEGIN")

        await pool.query(
            `UPDATE produtos SET referencia=$1, nome=$2, descricao=$3, imagem_url=$4 WHERE produto_id=$5`,
            [gerarReferenciaKit(nomeKit), nomeKit, produto.descricao || null, receiver_imagem_url || "none", id]
        )
        await pool.query(`UPDATE kits_controladores SET preco=$1 WHERE produto_id=$2`, [parseFloat(produto.preco) || null, id])

        // Receiver
        const { rows: [{ produto_id: receiver_produto_id }] } = await pool.query(
            `SELECT p.produto_id FROM produtos p JOIN controladores c ON c.produto_id = p.produto_id WHERE c.controlador_id = $1`,
            [kitsRow.controlador_id]
        )

        await pool.query(
            `UPDATE produtos SET referencia=$1, nome=$2, descricao=$3, garantia_anos=$4, imagem_url=$5, imagem_extra_url=$6, ficha_tecnica_url=$7 WHERE produto_id=$8`,
            [gerarReferenciaKitReceiver(nomeKit), receiver.nome || (nomeKit + " Receiver"), receiver.descricao || null, parseInt(receiver.garantia_anos) || null, receiver_imagem_url || "none", receiver_imagem_extra_url, receiver.ficha_tecnica_url || null, receiver_produto_id]
        )

        await pool.query(
            `UPDATE controladores SET ip=$1, comprimento_mm=$2, largura_mm=$3, altura_mm=$4, cor=$5, unidades_por_caixa=$6, garantia_anos=$7, preco=$8 WHERE controlador_id=$9`,
            [parseInt(receiver.ip) || null, parseFloat(receiver.comprimento_mm) || null, parseFloat(receiver.largura_mm) || null, parseFloat(receiver.altura_mm) || null, receiver.cor || null, parseInt(receiver.unidades_por_caixa) || null, parseInt(receiver.garantia_anos) || null, parseFloat(produto.preco) || null, kitsRow.controlador_id]
        )

        await setCertificacoesControlador(kitsRow.controlador_id, normalizarCerts(receiver.certificacoes))
        await setTiposControloControlador(kitsRow.controlador_id, receiver.tipos_controlo ?? [])
        await setTiposSinalControlador(kitsRow.controlador_id, receiver.tipos_sinal ?? [])
        await setFrequenciasControlador(kitsRow.controlador_id, normalizarFreqs(receiver))

        await pool.query(`DELETE FROM entradas_controladores WHERE controlador_id = $1`, [kitsRow.controlador_id])
        await pool.query(`DELETE FROM saidas_controladores WHERE controlador_id = $1`, [kitsRow.controlador_id])
        await pool.query(`DELETE FROM limites_potencia_controladores WHERE controlador_id = $1`, [kitsRow.controlador_id])

        for (const e of receiver.entradas ?? []) {
            await pool.query(`INSERT INTO entradas_controladores (controlador_id, tipo_input, voltagem_min, voltagem_max) VALUES ($1,$2,$3,$4)`, [kitsRow.controlador_id, e.tipo_input || null, parseFloat(e.voltagem_min) || null, parseFloat(e.voltagem_max) || null])
        }
        for (const s of receiver.saidas ?? []) {
            await pool.query(`INSERT INTO saidas_controladores (controlador_id, numero_canais, amperes_por_canal) VALUES ($1,$2,$3)`, [kitsRow.controlador_id, parseInt(s.numero_canais) || null, parseFloat(s.amperes_por_canal) || null])
        }
        for (const l of receiver.limites_potencia ?? []) {
            await pool.query(`INSERT INTO limites_potencia_controladores (controlador_id, voltagem, potencia_max_w) VALUES ($1,$2,$3)`, [kitsRow.controlador_id, parseFloat(l.voltagem) || null, parseFloat(l.potencia_max_w) || null])
        }

        // Remote
        const { rows: [{ produto_id: remote_produto_id }] } = await pool.query(
            `SELECT p.produto_id FROM produtos p JOIN comandos c ON c.produto_id = p.produto_id WHERE c.comando_id = $1`,
            [kitsRow.comando_id]
        )

        await pool.query(
            `UPDATE produtos SET referencia=$1, nome=$2, descricao=$3, garantia_anos=$4, imagem_url=$5, imagem_extra_url=$6, ficha_tecnica_url=$7 WHERE produto_id=$8`,
            [gerarReferenciaKitRemote(nomeKit), remote.nome || (nomeKit + " Remote"), remote.descricao || null, parseInt(remote.garantia_anos) || null, remote_imagem_url, remote_imagem_extra_url, remote.ficha_tecnica_url || null, remote_produto_id]
        )

        await pool.query(
            `UPDATE comandos SET tipo_alimentacao=$1, comprimento_mm=$2, largura_mm=$3, altura_mm=$4, cor=$5, garantia_anos=$6, preco=$7 WHERE comando_id=$8`,
            [remote.tipo_alimentacao || null, parseFloat(remote.comprimento_mm) || null, parseFloat(remote.largura_mm) || null, parseFloat(remote.altura_mm) || null, remote.cor || null, parseInt(receiver.garantia_anos) || null, parseFloat(produto.preco) || null, kitsRow.comando_id]
        )

        await setFrequenciasComando(kitsRow.comando_id, normalizarFreqs(remote))
        await setTiposControloComando(kitsRow.comando_id, receiver.tipos_controlo ?? [])
        await setCertificacoesComando(kitsRow.comando_id, normalizarCerts(remote.certificacoes))

        await pool.query("COMMIT")

        if (ficheirosPorNome.receiver_imagem_url) await eliminarImagemCloudinary(receiverUrls.imagem_url)
        if (ficheirosPorNome.receiver_imagem_extra_url) await eliminarImagemCloudinary(receiverUrls.imagem_extra_url)
        if (ficheirosPorNome.remote_imagem_url) await eliminarImagemCloudinary(remoteUrls.imagem_url)
        if (ficheirosPorNome.remote_imagem_extra_url) await eliminarImagemCloudinary(remoteUrls.imagem_extra_url)

        res.json({ success: true })

    } catch (error) {
        await pool.query("ROLLBACK")
        console.error("Erro ao editar kit:", error)
        res.status(500).json({ erro: "Erro ao editar kit", detalhe: error.message })
    }
})

// PATCH /api/kits/:id/ativo
kitRouter.patch("/:id/ativo", async (req, res) => {
    const { id } = req.params
    try {
        const { rows: [produto] } = await pool.query(
            `UPDATE produtos SET ativo = NOT ativo WHERE produto_id = $1 RETURNING ativo`,
            [id]
        )
        if (!produto) return res.status(404).json({ erro: "Produto não encontrado" })
        res.json({ ativo: produto.ativo })
    } catch (error) {
        console.error("Erro ao alterar ativo:", error)
        res.status(500).json({ erro: "Erro ao alterar estado", detalhe: error.message })
    }
})
