import express from "express"
import jwt from "jsonwebtoken"
import { pool } from "../db.js"
import cloudinary from "../config/cloudinary.js"
import upload from "../middleware/upload.js"
import streamifier from "streamifier"

const router = express.Router()

function uploadBuffer(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "power" },
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

// Agrupa ficheiros de certificação por índice: cert_imagem_0, cert_imagem_1, ...
// Múltiplos ficheiros com o mesmo fieldname são suportados pelo multer upload.any()
async function uploadCertificacaoImagens(ficheiros) {
    // { 0: [url1, url2], 1: [url3], ... }
    const resultado = {}
    for (const file of ficheiros) {
        const match = file.fieldname.match(/^cert_imagem_(\d+)$/)
        if (!match) continue
        const i = parseInt(match[1])
        const r = await uploadBuffer(file.buffer)
        if (!resultado[i]) resultado[i] = []
        resultado[i].push(r.secure_url)
    }
    return resultado
}

// POST /api/power
router.post("/", upload.any(), async (req, res) => {
    try {
        let produto = req.body.produto
        let fonte = req.body.fonte
        let certificacoes = req.body.certificacoes
        let caracteristicas = req.body.caracteristicas

        if (typeof produto === "string") produto = JSON.parse(produto)
        if (typeof fonte === "string") fonte = JSON.parse(fonte)
        if (typeof certificacoes === "string") certificacoes = JSON.parse(certificacoes)
        if (typeof caracteristicas === "string") caracteristicas = JSON.parse(caracteristicas)

        const ficheirosPorNome = {}
        const ficheirosCert = []

        for (const file of req.files ?? []) {
            if (file.fieldname === "imagem_url") ficheirosPorNome.imagem_url = file
            else if (file.fieldname.startsWith("cert_imagem_")) ficheirosCert.push(file)
        }

        let imagem_url = null
        if (ficheirosPorNome.imagem_url) {
            const r = await uploadBuffer(ficheirosPorNome.imagem_url.buffer)
            imagem_url = r.secure_url
        }

        // Upload imagens das certificações (múltiplas por modelo)
        const certNovasUrls = await uploadCertificacaoImagens(ficheirosCert)

        if (!produto?.referencia?.trim())
            return res.status(400).json({ erro: "A referência é obrigatória.", campo: "referencia" })

        const { rows: dupRef } = await pool.query(
            `SELECT produto_id FROM produtos WHERE LOWER(referencia) = LOWER($1)`,
            [produto.referencia.trim()]
        )
        if (dupRef.length > 0)
            return res.status(409).json({ erro: "Já existe uma fonte de alimentação com esta referência.", campo: "referencia" })

        await pool.query("BEGIN")

        // nome = referencia (não tem campo nome separado)
        const { rows: [{ produto_id }] } = await pool.query(
            `INSERT INTO produtos
                (referencia, nome, categoria, subcategoria, descricao, garantia_anos, imagem_url, imagem_extra_url, ficha_tecnica_url, ativo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,null,$8,true)
             RETURNING produto_id`,
            [
                produto.referencia,
                produto.referencia,
                "power",
                fonte.subcategoria || null,
                produto.descricao || null,
                parseInt(produto.garantia_anos) || null,
                imagem_url,
                produto.ficha_tecnica_url || null
            ]
        )

        const { rows: [{ fonte_alimentacao_id }] } = await pool.query(
            `INSERT INTO fontes_alimentacao
                (produto_id, subcategoria, potencia_w, tensao_saida_v,
                 corrente_saida_a, comprimento_mm, largura_mm, altura_mm, preco, ip_rating, ativo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
             RETURNING fonte_alimentacao_id`,
            [
                produto_id,
                fonte.subcategoria || null,
                parseFloat(fonte.potencia_w) || null,
                parseFloat(fonte.tensao_saida_v) || null,
                parseFloat(fonte.corrente_saida_a) || null,
                parseFloat(fonte.comprimento_mm) || null,
                parseFloat(fonte.largura_mm) || null,
                parseFloat(fonte.altura_mm) || null,
                parseFloat(fonte.preco) || null,
                fonte.ip_rating || null
            ]
        )

        for (let i = 0; i < (certificacoes ?? []).length; i++) {
            const cert = certificacoes[i]
            if (!cert.modelo) continue

            // Upsert pelo campo codigo = modelo
            const { rows: [{ certificacao_id }] } = await pool.query(
                `INSERT INTO certificacoes (codigo, nome)
                 VALUES ($1,$2)
                 ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
                 RETURNING certificacao_id`,
                [cert.modelo, cert.modelo]
            )

            // Combinar URLs novas uploadadas para este índice
            const novasUrls = certNovasUrls[i] ?? []
            const imagensFinais = novasUrls

            await pool.query(
                `INSERT INTO fonte_certificacoes (fonte_alimentacao_id, certificacao_id, imagem_url)
                 VALUES ($1,$2,$3)
                 ON CONFLICT DO NOTHING`,
                [fonte_alimentacao_id, certificacao_id, JSON.stringify(imagensFinais)]
            )
        }

        for (const texto of caracteristicas ?? []) {
            if (!texto) continue

            const { rows: [{ caracteristica_fonte_id }] } = await pool.query(
                `INSERT INTO caracteristicas_fontes (nome)
                 VALUES ($1)
                 ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
                 RETURNING caracteristica_fonte_id`,
                [texto]
            )

            await pool.query(
                `INSERT INTO fonte_caracteristicas (fonte_alimentacao_id, caracteristica_fonte_id)
                 VALUES ($1,$2)
                 ON CONFLICT DO NOTHING`,
                [fonte_alimentacao_id, caracteristica_fonte_id]
            )
        }

        await pool.query("COMMIT")
        res.status(201).json({ success: true, fonte_alimentacao_id })

    } catch (error) {
        await pool.query("ROLLBACK")
        console.error("Erro ao criar fonte de alimentação:", error)
        res.status(500).json({ erro: "Erro ao criar fonte de alimentação", detalhe: error.message })
    }
})

// GET /api/power
router.get("/", async (req, res) => {
    try {
        let verTodos = false
        const token = req.cookies?.token
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET)
                const role = decoded.role?.toLowerCase()
                if (role === "administrador" || role === "moderador") verTodos = true
            } catch (_) {}
        }

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
                f.fonte_alimentacao_id,
                f.potencia_w,
                f.tensao_saida_v,
                f.corrente_saida_a,
                f.preco,
                f.ip_rating
            FROM produtos p
            JOIN fontes_alimentacao f ON f.produto_id = p.produto_id
            ${where}
            ORDER BY p.referencia ASC`

        if (req.query.pagina !== undefined) {
            const pagina = Math.max(1, parseInt(req.query.pagina) || 1)
            const limite = Math.min(120, Math.max(1, parseInt(req.query.limite) || 60))
            const offset = (pagina - 1) * limite
            const { rows: [{ total }] } = await pool.query(
                `SELECT COUNT(*) AS total FROM produtos p JOIN fontes_alimentacao f ON f.produto_id = p.produto_id ${where}`,
                [...params]
            )
            const { rows } = await pool.query(mainSelect + ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limite, offset])
            return res.json({ dados: rows, total: parseInt(total) })
        }

        const { rows } = await pool.query(mainSelect, params)
        res.json(rows)
    } catch (error) {
        console.error("Erro ao buscar fontes de alimentação:", error)
        res.status(500).json({ erro: "Erro ao buscar fontes de alimentação", detalhe: error.message })
    }
})

// GET /api/power/:id
router.get("/:id", async (req, res) => {
    const { id } = req.params
    try {
        const { rows: [power] } = await pool.query(
            `SELECT
                p.produto_id,
                p.referencia,
                p.nome,
                p.categoria,
                p.subcategoria,
                p.descricao,
                p.garantia_anos,
                p.imagem_url,
                p.ficha_tecnica_url,
                p.ativo,
                f.fonte_alimentacao_id,
                f.potencia_w,
                f.tensao_saida_v,
                f.corrente_saida_a,
                f.comprimento_mm,
                f.largura_mm,
                f.altura_mm,
                f.preco,
                f.ip_rating
            FROM produtos p
            JOIN fontes_alimentacao f ON f.produto_id = p.produto_id
            WHERE p.produto_id = $1`,
            [id]
        )

        if (!power) return res.status(404).json({ erro: "Fonte de alimentação não encontrada" })

        const { rows: certRows } = await pool.query(
            `SELECT c.certificacao_id, c.codigo AS modelo, fc.imagem_url
             FROM fonte_certificacoes fc
             JOIN certificacoes c ON c.certificacao_id = fc.certificacao_id
             WHERE fc.fonte_alimentacao_id = $1
             ORDER BY c.codigo ASC`,
            [power.fonte_alimentacao_id]
        )

        // Converter JSON array de imagens
        const certificacoes = certRows.map(c => ({
            ...c,
            imagens: (() => {
                try { return JSON.parse(c.imagem_url) ?? [] }
                catch { return c.imagem_url ? [c.imagem_url] : [] }
            })()
        }))

        const { rows: caractRows } = await pool.query(
            `SELECT cf.caracteristica_fonte_id, cf.nome AS texto
             FROM fonte_caracteristicas fca
             JOIN caracteristicas_fontes cf ON cf.caracteristica_fonte_id = fca.caracteristica_fonte_id
             WHERE fca.fonte_alimentacao_id = $1
             ORDER BY cf.nome ASC`,
            [power.fonte_alimentacao_id]
        )

        const caracteristicas = caractRows.map(c => c.texto)

        res.json({ ...power, certificacoes, caracteristicas })

    } catch (error) {
        console.error("Erro ao buscar fonte de alimentação:", error)
        res.status(500).json({ erro: "Erro ao buscar fonte de alimentação", detalhe: error.message })
    }
})

// PUT /api/power/:id
router.put("/:id", upload.any(), async (req, res) => {
    const { id } = req.params
    try {
        let produto = req.body.produto
        let fonte = req.body.fonte
        let certificacoes = req.body.certificacoes
        let caracteristicas = req.body.caracteristicas

        if (typeof produto === "string") produto = JSON.parse(produto)
        if (typeof fonte === "string") fonte = JSON.parse(fonte)
        if (typeof certificacoes === "string") certificacoes = JSON.parse(certificacoes)
        if (typeof caracteristicas === "string") caracteristicas = JSON.parse(caracteristicas)

        const ficheirosPorNome = {}
        const ficheirosCert = []

        for (const file of req.files ?? []) {
            if (file.fieldname === "imagem_url") ficheirosPorNome.imagem_url = file
            else if (file.fieldname.startsWith("cert_imagem_")) ficheirosCert.push(file)
        }

        let imagem_url = produto.imagem_url_atual || null
        if (ficheirosPorNome.imagem_url) {
            const r = await uploadBuffer(ficheirosPorNome.imagem_url.buffer)
            imagem_url = r.secure_url
        }

        const certNovasUrls = await uploadCertificacaoImagens(ficheirosCert)

        const { rows: [urlsAtuais] } = await pool.query(
            `SELECT p.imagem_url FROM produtos p WHERE p.produto_id = $1`,
            [id]
        )

        if (!produto?.referencia?.trim())
            return res.status(400).json({ erro: "A referência é obrigatória.", campo: "referencia" })

        const { rows: dupRef } = await pool.query(
            `SELECT produto_id FROM produtos WHERE LOWER(referencia) = LOWER($1) AND produto_id != $2`,
            [produto.referencia.trim(), id]
        )
        if (dupRef.length > 0)
            return res.status(409).json({ erro: "Já existe outra fonte de alimentação com esta referência.", campo: "referencia" })

        await pool.query("BEGIN")

        const { rows: [{ fonte_alimentacao_id }] } = await pool.query(
            `SELECT fonte_alimentacao_id FROM fontes_alimentacao WHERE produto_id = $1`,
            [id]
        )

        await pool.query(
            `UPDATE produtos SET
                referencia = $1, nome = $2, descricao = $3, garantia_anos = $4,
                imagem_url = $5, subcategoria = $6, ficha_tecnica_url = $7
             WHERE produto_id = $8`,
            [
                produto.referencia,
                produto.referencia,
                produto.descricao || null,
                parseInt(produto.garantia_anos) || null,
                imagem_url,
                fonte.subcategoria || null,
                produto.ficha_tecnica_url || null,
                id
            ]
        )

        await pool.query(
            `UPDATE fontes_alimentacao SET
                subcategoria = $1, potencia_w = $2,
                tensao_saida_v = $3, corrente_saida_a = $4,
                comprimento_mm = $5, largura_mm = $6, altura_mm = $7,
                preco = $8, ip_rating = $9
             WHERE fonte_alimentacao_id = $10`,
            [
                fonte.subcategoria || null,
                parseFloat(fonte.potencia_w) || null,
                parseFloat(fonte.tensao_saida_v) || null,
                parseFloat(fonte.corrente_saida_a) || null,
                parseFloat(fonte.comprimento_mm) || null,
                parseFloat(fonte.largura_mm) || null,
                parseFloat(fonte.altura_mm) || null,
                parseFloat(fonte.preco) || null,
                fonte.ip_rating || null,
                fonte_alimentacao_id
            ]
        )

        await pool.query(`DELETE FROM fonte_certificacoes WHERE fonte_alimentacao_id = $1`, [fonte_alimentacao_id])
        await pool.query(`DELETE FROM fonte_caracteristicas WHERE fonte_alimentacao_id = $1`, [fonte_alimentacao_id])

        for (let i = 0; i < (certificacoes ?? []).length; i++) {
            const cert = certificacoes[i]
            if (!cert.modelo) continue

            const { rows: [{ certificacao_id }] } = await pool.query(
                `INSERT INTO certificacoes (codigo, nome)
                 VALUES ($1,$2)
                 ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
                 RETURNING certificacao_id`,
                [cert.modelo, cert.modelo]
            )

            // imagens_manter = URLs existentes que o utilizador não removeu
            // certNovasUrls[i] = novas imagens enviadas agora
            const imagensFinais = [
                ...(cert.imagens_manter ?? []),
                ...(certNovasUrls[i] ?? [])
            ]

            await pool.query(
                `INSERT INTO fonte_certificacoes (fonte_alimentacao_id, certificacao_id, imagem_url)
                 VALUES ($1,$2,$3)`,
                [fonte_alimentacao_id, certificacao_id, JSON.stringify(imagensFinais)]
            )
        }

        for (const texto of caracteristicas ?? []) {
            if (!texto) continue

            const { rows: [{ caracteristica_fonte_id }] } = await pool.query(
                `INSERT INTO caracteristicas_fontes (nome)
                 VALUES ($1)
                 ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
                 RETURNING caracteristica_fonte_id`,
                [texto]
            )

            await pool.query(
                `INSERT INTO fonte_caracteristicas (fonte_alimentacao_id, caracteristica_fonte_id)
                 VALUES ($1,$2)`,
                [fonte_alimentacao_id, caracteristica_fonte_id]
            )
        }

        await pool.query("COMMIT")

        if (ficheirosPorNome.imagem_url) await eliminarImagemCloudinary(urlsAtuais.imagem_url)

        res.json({ success: true })

    } catch (error) {
        await pool.query("ROLLBACK")
        console.error("Erro ao editar fonte de alimentação:", error)
        res.status(500).json({ erro: "Erro ao editar fonte de alimentação", detalhe: error.message })
    }
})

// PATCH /api/power/:id/ativo
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
        console.error("Erro ao alterar ativo:", error)
        res.status(500).json({ erro: "Erro ao alterar estado", detalhe: error.message })
    }
})

export default router
