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
            { folder: "neon" },
            (error, result) => {
                if (result) resolve(result)
                else reject(error)
            }
        )
        streamifier.createReadStream(buffer).pipe(stream)
    })
}

//para apagar imagem antiga do cloudinary quando adiciona uma nova
function extrairPublicId(url) {
    if (!url) return null
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/)
    return match ? match[1] : null
}

//para criar a referencia para cada tabela

// "Neon Long" → "NEON-LONG"
function gerarReferenciaProduto(nome) {
    return (nome ?? "").toUpperCase().trim().replace(/\s+/g, "-")
}

//referencia sem temperatura - tabela da versao
// "NEON-LONG11W12VIP65"
function gerarReferenciaVersao(nome, potencia_w_m, voltagem_v, ip) {
    const base = gerarReferenciaProduto(nome)
    const potencia = potencia_w_m ? `${potencia_w_m}W` : ""
    const volt = voltagem_v ? `${voltagem_v}V` : ""
    const valor_ip = ip ? `IP${ip}` : ""
    return `${base}${potencia}${volt}${valor_ip}`
}

//referencia completa por cor - tabela variante
// "NEON-LONG11W12V3000KIP65" ou "NEON-LONG11W12VRGBIP65"
function gerarReferenciaVariante(nome, potencia_w_m, voltagem_v, ip, temperatura_cor, tipo_cor) {
    const base = gerarReferenciaProduto(nome)
    const potencia = potencia_w_m ? `${potencia_w_m}W` : ""
    const voltagem = voltagem_v ? `${voltagem_v}V` : ""
    const cor = temperatura_cor ? `${temperatura_cor}K` : (tipo_cor ?? "").toUpperCase().trim()
    const valor_ip = ip ? `IP${ip}` : ""
    return `${base}${potencia}${voltagem}${cor}${valor_ip}`
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

// POST /api/neon
router.post("/",
    upload.any(),
    async (req, res) => {
        try {
            let produto = req.body.produto
            let modelo = req.body.modelo
            let dimensoes = req.body.dimensoes
            let versoes = req.body.versoes

            if (typeof produto === "string") produto = JSON.parse(produto)
            if (typeof modelo === "string") modelo = JSON.parse(modelo)
            if (typeof dimensoes === "string") dimensoes = JSON.parse(dimensoes)
            if (typeof versoes === "string") versoes = JSON.parse(versoes)

            const ficheirosPorNome = {}
            for (const file of req.files ?? []) {
                ficheirosPorNome[file.fieldname] = file
            }

            // Upload imagens do produto
            let imagem_url = null
            let imagem_extra_url = null

            if (ficheirosPorNome.imagem_url) {
                const r = await uploadBuffer(ficheirosPorNome.imagem_url.buffer)
                imagem_url = r.secure_url
            }
            if (ficheirosPorNome.imagem_extra_url) {
                const r = await uploadBuffer(ficheirosPorNome.imagem_extra_url.buffer)
                imagem_extra_url = r.secure_url
            }

            // Upload imagens do modelo
            let imagem_medidas_url = null
            let imagem_extra_modelo_url = null

            if (ficheirosPorNome.imagem_medidas_url) {
                const r = await uploadBuffer(ficheirosPorNome.imagem_medidas_url.buffer)
                imagem_medidas_url = r.secure_url
            }
            if (ficheirosPorNome.imagem_extra_modelo_url) {
                const r = await uploadBuffer(ficheirosPorNome.imagem_extra_modelo_url.buffer)
                imagem_extra_modelo_url = r.secure_url
            }

            if (!produto?.nome?.trim())
                return res.status(400).json({ erro: "O nome é obrigatório.", campo: "nome" })

            const { rows: dupNome } = await pool.query(
                `SELECT produto_id FROM produtos WHERE LOWER(nome) = LOWER($1)`,
                [produto.nome.trim()]
            )
            if (dupNome.length > 0)
                return res.status(409).json({ erro: "Já existe um neon com este nome.", campo: "nome" })

            await pool.query("BEGIN")

            const { rows: [{ produto_id }] } = await pool.query(
                `INSERT INTO produtos
                    (referencia,
                    nome,
                    categoria,
                    descricao,
                    garantia_anos,
                    imagem_url,
                    imagem_extra_url,
                    ficha_tecnica_url,
                    ativo)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
                 RETURNING produto_id`,
                [
                    gerarReferenciaProduto(produto.nome),
                    produto.nome,
                    produto.categoria || "neon",
                    produto.descricao || null,
                    parseInt(produto.garantia_anos) || null,
                    imagem_url,
                    imagem_extra_url,
                    produto.ficha_tecnica_url || null
                ]
            )

            // Insert modelos_neon
            const { rows: [{ modelo_neon_id }] } = await pool.query(
                `INSERT INTO modelos_neon
                    (produto_id,
                    potencia_w_m,
                    angulo_abertura,
                    dimavel,
                    quantidade_leds,
                    cri,
                    macadam,
                    material,
                    horario_trabalho,
                    largura_mm,
                    altura_mm,
                    comprimento_max_alimentacao_unica_m,
                    comprimento_max_circuito_fechado_m,
                    imagem_medidas_url,
                    imagem_extra_url)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                RETURNING modelo_neon_id`,
                [
                    produto_id,
                    parseFloat(modelo.potencia_w_m) || null,
                    parseFloat(modelo.angulo_abertura) || null,
                    modelo.dimavel === true || modelo.dimavel === "true",
                    parseInt(modelo.quantidade_leds) || null,
                    parseFloat(modelo.cri) || null,
                    parseFloat(modelo.macadam) || null,
                    modelo.material || null,
                    modelo.horario_trabalho || null,
                    parseFloat(modelo.largura_mm) || null,
                    parseFloat(modelo.altura_mm) || null,
                    parseFloat(modelo.comprimento_max_alimentacao_unica_m) || null,
                    parseFloat(modelo.comprimento_max_circuito_fechado_m) || null,
                    imagem_medidas_url,
                    imagem_extra_modelo_url
                ]
            )

            // Insert dimensoes_modelos_neon
            for (const dim of dimensoes ?? []) {
                await pool.query(
                    `INSERT INTO dimensoes_modelos_neon
                        (modelo_neon_id,
                        comprimento_m,
                        comprimento_min_m,
                        comprimento_max_m)
                    VALUES ($1,$2,$3,$4)`,
                    [
                        modelo_neon_id,
                        parseFloat(dim.comprimento_m) || null,
                        parseFloat(dim.comprimento_min_m) || null,
                        parseFloat(dim.comprimento_max_m) || null
                    ]
                )
            }

            // Insert versoes_neon e variantes_neon
            for (const versao of versoes ?? []) {
                const { rows: [{ versao_neon_id }] } = await pool.query(
                    `INSERT INTO versoes_neon
                        (modelo_neon_id,
                        referencia,
                        voltagem_v,
                        ip,
                        ativo)
                    VALUES ($1,$2,$3,$4,$5)
                    RETURNING versao_neon_id`,
                    [
                        modelo_neon_id,
                        gerarReferenciaVersao(produto.nome, modelo.potencia_w_m, versao.voltagem_v, versao.ip),
                        parseInt(versao.voltagem_v) || null,
                        parseInt(versao.ip) || null,
                        versao.ativo === true || versao.ativo === "true"
                    ]
                )

                for (const variante of versao.variantes ?? []) {
                    await pool.query(
                        `INSERT INTO variantes_neon
                            (versao_neon_id,
                            referencia,
                            tipo_cor,
                            temperatura_cor,
                            intensidade_luminosa_lm,
                            preco_metro,
                            ativo)
                        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                        [
                            versao_neon_id,
                            gerarReferenciaVariante(produto.nome, modelo.potencia_w_m, versao.voltagem_v, versao.ip, variante.temperatura_cor, variante.tipo_cor),
                            variante.tipo_cor || null,
                            variante.temperatura_cor || null,
                            parseFloat(variante.intensidade_luminosa_lm) || null,
                            parseFloat(variante.preco_metro) || null,
                            variante.ativo === true || variante.ativo === "true"
                        ]
                    )
                }
            }

            await pool.query("COMMIT")
            res.status(201).json({ success: true, modelo_neon_id })

        } catch (error) {
            await pool.query("ROLLBACK")
            console.error("Erro ao criar um neon:", error)
            res.status(500).json({ erro: "Erro ao criar um neon", detalhe: error.message })
        }
    }
)

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

        const where = verTodos ? "" : "WHERE p.ativo = true"
        const mainSelect = `
            SELECT
                p.produto_id,
                p.nome,
                p.categoria,
                p.subcategoria,
                p.imagem_url,
                p.ativo,
                n.modelo_neon_id,
                n.potencia_w_m,
                n.quantidade_leds
            FROM produtos p
            JOIN modelos_neon n ON n.produto_id = p.produto_id
            ${where}
            ORDER BY p.nome ASC`

        if (req.query.pagina !== undefined) {
            const pagina = Math.max(1, parseInt(req.query.pagina) || 1)
            const limite = Math.min(120, Math.max(1, parseInt(req.query.limite) || 60))
            const offset = (pagina - 1) * limite
            const { rows: [{ total }] } = await pool.query(
                `SELECT COUNT(*) AS total FROM produtos p JOIN modelos_neon n ON n.produto_id = p.produto_id ${where}`
            )
            const { rows } = await pool.query(mainSelect + ` LIMIT $1 OFFSET $2`, [limite, offset])
            return res.json({ dados: rows, total: parseInt(total) })
        }

        const { rows } = await pool.query(mainSelect)
        res.json(rows)
    } catch (error) {
        console.error("Erro ao buscar neon: ", error)
        res.status(500).json({ erro: "Erro ao buscar neon ", detalhe: error.message})
    }
})

router.get("/:id", async (req, res) => {
    const { id } = req.params

    try {
        // Buscar produto + modelo
        const { rows: [neon] } = await pool.query(
            `SELECT
                p.produto_id,
                p.referencia,
                p.nome,
                p.categoria,
                p.descricao,
                p.garantia_anos,
                p.imagem_url,
                p.imagem_extra_url,
                p.ficha_tecnica_url,
                p.ativo,
                n.modelo_neon_id,
                n.potencia_w_m,
                n.angulo_abertura,
                n.dimavel,
                n.quantidade_leds,
                n.cri,
                n.macadam,
                n.material,
                n.horario_trabalho,
                n.largura_mm,
                n.altura_mm,
                n.comprimento_max_alimentacao_unica_m,
                n.comprimento_max_circuito_fechado_m,
                n.imagem_medidas_url,
                n.imagem_extra_url AS imagem_extra_modelo_url
            FROM produtos p
            JOIN modelos_neon n ON n.produto_id = p.produto_id
            WHERE p.produto_id = $1`,
            [id]
        )

        if (!neon) {
            return res.status(404).json({ erro: "Neon não encontrado" })
        }

        // Buscar dimensões do modelo
        const { rows: dimensoes } = await pool.query(
            `SELECT
                dimensao_id,
                comprimento_m,
                comprimento_min_m,
                comprimento_max_m
            FROM dimensoes_modelos_neon
            WHERE modelo_neon_id = $1
            ORDER BY dimensao_id ASC`,
            [neon.modelo_neon_id]
        )

        // Buscar versões
        const { rows: versoes } = await pool.query(
            `SELECT
                versao_neon_id,
                referencia,
                voltagem_v,
                ip,
                ativo
            FROM versoes_neon
            WHERE modelo_neon_id = $1
            ORDER BY versao_neon_id ASC`,
            [neon.modelo_neon_id]
        )

        // Buscar variantes de todas as versões
        const versaoIds = versoes.map(v => v.versao_neon_id)
        const variantesPorVersao = {}

        if (versaoIds.length > 0) {
            const { rows: variantes } = await pool.query(
                `SELECT
                    variante_neon_id,
                    versao_neon_id,
                    referencia,
                    tipo_cor,
                    temperatura_cor,
                    intensidade_luminosa_lm,
                    preco_metro,
                    ativo
                FROM variantes_neon
                WHERE versao_neon_id = ANY($1)
                ORDER BY variante_neon_id ASC`,
                [versaoIds]
            )

            // Agrupar variantes pela versão correspondente
            for (const variante of variantes) {
                const vid = variante.versao_neon_id
                if (!variantesPorVersao[vid]) variantesPorVersao[vid] = []
                variantesPorVersao[vid].push(variante)
            }
        }

        // Injetar variantes dentro de cada versão
        const versoesComVariantes = versoes.map(v => ({
            ...v,
            variantes: variantesPorVersao[v.versao_neon_id] ?? []
        }))

        res.json({
            ...neon,
            dimensoes,
            versoes: versoesComVariantes
        })

    } catch (error) {
        console.error("Erro ao buscar neon:", error)
        res.status(500).json({ erro: "Erro ao buscar neon", detalhe: error.message })
    }
})

router.put("/:id",
    upload.any(),
    async (req, res) => {
        const { id } = req.params

        try {
            let produto = req.body.produto
            let modelo = req.body.modelo
            let dimensoes = req.body.dimensoes
            let versoes = req.body.versoes

            if (typeof produto === "string") produto = JSON.parse(produto)
            if (typeof modelo === "string") modelo = JSON.parse(modelo)
            if (typeof dimensoes === "string") dimensoes = JSON.parse(dimensoes)
            if (typeof versoes === "string") versoes = JSON.parse(versoes)

            const ficheirosPorNome = {}
            for (const file of req.files ?? []) {
                ficheirosPorNome[file.fieldname] = file
            }

            // Imagens do produto: novo ficheiro ou manter URL atual
            let imagem_url = produto.imagem_url_atual || null
            let imagem_extra_url = produto.imagem_extra_url_atual || null

            if (ficheirosPorNome.imagem_url) {
                const r = await uploadBuffer(ficheirosPorNome.imagem_url.buffer)
                imagem_url = r.secure_url
            }
            if (ficheirosPorNome.imagem_extra_url) {
                const r = await uploadBuffer(ficheirosPorNome.imagem_extra_url.buffer)
                imagem_extra_url = r.secure_url
            }

            // Imagens do modelo: novo ficheiro ou manter URL atual
            let imagem_medidas_url = modelo.imagem_medidas_url_atual || null
            let imagem_extra_modelo_url = modelo.imagem_extra_modelo_url_atual || null

            if (ficheirosPorNome.imagem_medidas_url) {
                const r = await uploadBuffer(ficheirosPorNome.imagem_medidas_url.buffer)
                imagem_medidas_url = r.secure_url
            }
            if (ficheirosPorNome.imagem_extra_modelo_url) {
                const r = await uploadBuffer(ficheirosPorNome.imagem_extra_modelo_url.buffer)
                imagem_extra_modelo_url = r.secure_url
            }

            if (!produto?.nome?.trim())
                return res.status(400).json({ erro: "O nome é obrigatório.", campo: "nome" })

            const { rows: dupNome } = await pool.query(
                `SELECT produto_id FROM produtos WHERE LOWER(nome) = LOWER($1) AND produto_id != $2`,
                [produto.nome.trim(), id]
            )
            if (dupNome.length > 0)
                return res.status(409).json({ erro: "Já existe outro neon com este nome.", campo: "nome" })

            // Buscar URLs atuais antes de qualquer alteração
            // Necessário para saber quais eliminar do Cloudinary no final
            const { rows: [urlsAtuais] } = await pool.query(
                `SELECT
                    p.imagem_url,
                    p.imagem_extra_url,
                    n.imagem_medidas_url, 
                    n.imagem_extra_url AS imagem_extra_modelo_url
                FROM produtos p
                JOIN modelos_neon n ON n.produto_id = p.produto_id
                WHERE p.produto_id = $1`,
                [id]
            )

            await pool.query("BEGIN")

            const { rows: [{ modelo_neon_id }] } = await pool.query(
                `SELECT modelo_neon_id FROM modelos_neon WHERE produto_id = $1`,
                [id]
            )

            // Update produtos
            await pool.query(
                `UPDATE produtos SET
                    referencia = $1,
                    nome = $2,
                    descricao = $3,
                    garantia_anos = $4,
                    imagem_url = $5,
                    imagem_extra_url = $6,
                    ficha_tecnica_url = $7
                WHERE produto_id = $8`,
                [
                    gerarReferenciaProduto(produto.nome),
                    produto.nome,
                    produto.descricao || null,
                    parseInt(produto.garantia_anos) || null,
                    imagem_url,
                    imagem_extra_url,
                    produto.ficha_tecnica_url || null,
                    id
                ]
            )

            // Update modelos_neon
            await pool.query(
                `UPDATE modelos_neon SET
                    potencia_w_m = $1,
                    angulo_abertura = $2,
                    dimavel = $3,
                    quantidade_leds = $4,
                    cri = $5,
                    macadam = $6,
                    material = $7,
                    horario_trabalho = $8,
                    largura_mm = $9,
                    altura_mm = $10,
                    comprimento_max_alimentacao_unica_m = $11,
                    comprimento_max_circuito_fechado_m = $12,
                    imagem_medidas_url = $13,
                    imagem_extra_url = $14
                WHERE modelo_neon_id = $15`,
                [
                    parseFloat(modelo.potencia_w_m) || null,
                    parseFloat(modelo.angulo_abertura) || null,
                    modelo.dimavel === true || modelo.dimavel === "true",
                    parseInt(modelo.quantidade_leds) || null,
                    parseFloat(modelo.cri) || null,
                    parseFloat(modelo.macadam) || null,
                    modelo.material || null,
                    modelo.horario_trabalho || null,
                    parseFloat(modelo.largura_mm) || null,
                    parseFloat(modelo.altura_mm) || null,
                    parseFloat(modelo.comprimento_max_alimentacao_unica_m) || null,
                    parseFloat(modelo.comprimento_max_circuito_fechado_m) || null,
                    imagem_medidas_url,
                    imagem_extra_modelo_url,
                    modelo_neon_id
                ]
            )

            // Apagar e reinserir dimensões
            await pool.query(
                `DELETE FROM dimensoes_modelos_neon WHERE modelo_neon_id = $1`,
                [modelo_neon_id]
            )

            for (const dim of dimensoes ?? []) {
                await pool.query(
                    `INSERT INTO dimensoes_modelos_neon
                        (modelo_neon_id,
                        comprimento_m,
                        comprimento_min_m,
                        comprimento_max_m)
                    VALUES ($1,$2,$3,$4)`,
                    [
                        modelo_neon_id,
                        parseFloat(dim.comprimento_m) || null,
                        parseFloat(dim.comprimento_min_m) || null,
                        parseFloat(dim.comprimento_max_m) || null
                    ]
                )
            }

            // Apagar variantes e versões existentes (ON DELETE CASCADE trata as variantes)
            await pool.query(
                `DELETE FROM versoes_neon WHERE modelo_neon_id = $1`,
                [modelo_neon_id]
            )

            // Reinserir versões e variantes
            for (const versao of versoes ?? []) {
                const { rows: [{ versao_neon_id }] } = await pool.query(
                    `INSERT INTO versoes_neon
                        (modelo_neon_id,
                        referencia,
                        voltagem_v,
                        ip,
                        ativo)
                    VALUES ($1,$2,$3,$4,$5)
                    RETURNING versao_neon_id`,
                    [
                        modelo_neon_id,
                        gerarReferenciaVersao(produto.nome, modelo.potencia_w_m, versao.voltagem_v, versao.ip),
                        parseInt(versao.voltagem_v) || null,
                        parseInt(versao.ip) || null,
                        versao.ativo === true || versao.ativo === "true"
                    ]
                )

                for (const variante of versao.variantes ?? []) {
                    await pool.query(
                        `INSERT INTO variantes_neon
                            (versao_neon_id,
                            referencia,
                            tipo_cor,
                            temperatura_cor,
                            intensidade_luminosa_lm,
                            preco_metro,
                            ativo)
                        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                        [
                            versao_neon_id,
                            gerarReferenciaVariante(produto.nome, modelo.potencia_w_m, versao.voltagem_v, versao.ip, variante.temperatura_cor, variante.tipo_cor),
                            variante.tipo_cor || null,
                            variante.temperatura_cor || null,
                            parseFloat(variante.intensidade_luminosa_lm) || null,
                            parseFloat(variante.preco_metro) || null,
                            variante.ativo === true || variante.ativo === "true"
                        ]
                    )
                }
            }

            await pool.query("COMMIT")

            // Elimina imagens órfãs do Cloudinary - feito após o COMMIT para não interferir com a transação
            if (ficheirosPorNome.imagem_url) await eliminarImagemCloudinary(urlsAtuais.imagem_url)
            if (ficheirosPorNome.imagem_extra_url) await eliminarImagemCloudinary(urlsAtuais.imagem_extra_url)
            if (ficheirosPorNome.imagem_medidas_url) await eliminarImagemCloudinary(urlsAtuais.imagem_medidas_url)
            if (ficheirosPorNome.imagem_extra_modelo_url) await eliminarImagemCloudinary(urlsAtuais.imagem_extra_modelo_url)

            res.json({ success: true })

        } catch (error) {
            await pool.query("ROLLBACK")
            console.error("Erro ao editar neon:", error)
            res.status(500).json({ erro: "Erro ao editar neon", detalhe: error.message })
        }
    }
)

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
