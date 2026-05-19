import express from "express"
import jwt from "jsonwebtoken"
import { pool } from "../db.js"
import cloudinary from "../config/cloudinary.js"
import upload from "../middleware/upload.js"
import streamifier from "streamifier"

const router = express.Router()

// Helper: upload de imagens para o Cloudinary na pasta fitas_led

function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "fitas_led" },
      (error, result) => {
        if (result) resolve(result)
        else reject(error)
      }
    )
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

// Helper: extrai o public_id a partir de uma URL do Cloudinary.
// Necessário para eliminar a imagem antiga quando é substituída.

function extrairPublicId(url) {
  if (!url) return null
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/)
  return match ? match[1] : null
}

// Helpers: geração automática de referências ──────────────────────────────
// Produto > nome em maiúsculas, espaços → "-" ex: "ECOB"
// Versão > {nome}{potencia}W{voltagem}V{IP}IP ex: "ECOB9W12V24IP"
// Opção > {nome}{potencia}W{voltagem}V{temp}K{IP}IP ex: "ECOB9W12V3000K24IP"

function gerarReferenciaProduto(nome, potencia, tipos_cor) {
  const n = (nome ?? "").toUpperCase().trim().replace(/\s+/g, "-")
  const pot = potencia ? `${potencia}W` : ""
  const cor = tipos_cor ? `(${tipos_cor})` : ""
  return `${n}-${pot}${cor}`
}

function gerarReferenciaVersao(nome, potencia, voltagem_v, ip) {
  const n = (nome ?? "").toUpperCase().trim().replace(/\s+/g, "-")
  const pot = potencia ? `${potencia}W` : ""
  const volt = voltagem_v ? `${voltagem_v}V` : ""
  const iVal = ip ? `IP${ip}` : ""
  return `${n}${pot}${volt}${iVal}`
}

function gerarReferenciaOpcao(nome, potencia, voltagem_v, temperatura_cor, ip) {
  const n = (nome ?? "").toUpperCase().trim().replace(/\s+/g, "-")
  const pot = potencia ? `${potencia}W` : ""
  const volt = voltagem_v ? `${voltagem_v}V` : ""
  const temp = temperatura_cor ? `${temperatura_cor}K` : ""
  const iVal = ip ? `IP${ip}` : ""
  return `${n}${pot}${volt}${temp}${iVal}`
}

// Helper: elimina uma imagem do Cloudinary se existir.
// Chamado sempre após o COMMIT para não misturar erros externos com a transação.

async function eliminarImagemCloudinary(url) {
  const publicId = extrairPublicId(url)
  if (!publicId) return
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (err) {
    // Apenas regista — não impede o resto da operação
    console.error("Erro ao eliminar imagem do Cloudinary:", publicId, err.message)
  }
}

// POST /api/fitas_led 
router.post("/",
  upload.any(),
  async (req, res) => {
    try {
      // Os dados chegam como strings JSON dentro do FormData

      let produto = req.body.produto
      let fita = req.body.fita
      let versoes = req.body.versoes

      if (typeof produto === "string") produto = JSON.parse(produto)
      if (typeof fita === "string") fita = JSON.parse(fita)
      if (typeof versoes === "string") versoes = JSON.parse(versoes)

      // Permite aceder a qualquer ficheiro pelo nome sem iterar o array.

      const ficheirosPorNome = {}
      for (const file of req.files ?? []) {
        ficheirosPorNome[file.fieldname] = file
      }

      // Upload das imagens do produto e da fita

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


      if (!produto?.subcategoria?.trim())
        return res.status(400).json({ erro: "A subcategoria é obrigatória.", campo: "subcategoria" })
      if (!fita?.potencia_w_m)
        return res.status(400).json({ erro: "A potência (W/m) é obrigatória.", campo: "potencia_w_m" })
      if (!fita?.tipos_cor?.trim())
        return res.status(400).json({ erro: "O tipo de cor é obrigatório.", campo: "tipos_cor" })

      const referenciaGerada = gerarReferenciaProduto(produto.subcategoria, fita.potencia_w_m, fita.tipos_cor)
      const { rows: dupRef } = await pool.query(
        `SELECT produto_id FROM produtos WHERE LOWER(referencia) = LOWER($1)`,
        [referenciaGerada]
      )
      if (dupRef.length > 0)
        return res.status(409).json({ erro: "Já existe uma fita com esta referência (mesma subcategoria, potência e tipo de cor).", campo: "referencia" })

      await pool.query("BEGIN")

      const { rows: [{ produto_id }] } = await pool.query(
        `INSERT INTO produtos
           (referencia,
           nome,
           categoria,
           subcategoria,
           descricao,
           garantia_anos,
           imagem_url,
           imagem_extra_url,
           ficha_tecnica_url,
           ativo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
         RETURNING produto_id`,
        [
          referenciaGerada,
          referenciaGerada,
          produto.categoria || "fita_led",
          produto.subcategoria || null,
          produto.descricao || null,
          parseInt(produto.garantia_anos) || null,
          imagem_url,
          imagem_extra_url,
          produto.ficha_tecnica_url || null
        ]
      )

      // Inserir da tabela de fitas led
      const { rows: [{ fita_led_id }] } = await pool.query(
        `INSERT INTO fitas_led
           (produto_id,
           angulo_abertura,
           dimavel,
           quantidade_leds_m,
           cri,
           macadam,
           tipo_led,
           eficiencia_lm_w,
           horario_trabalho_h,
           largura_mm,
           altura_mm,
           comprimento_corte_mm,
           potencia_w_m,
           comprimento_max_alimentacao_m,
           comprimento_max_circuito_m,
           tipos_cor)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING fita_led_id`,
        [
          produto_id,
          parseFloat(fita.angulo_abertura) || null,
          fita.dimavel === true || fita.dimavel === "true",
          parseInt(fita.quantidade_leds_m) || null,
          parseFloat(fita.cri) || null,
          parseFloat(fita.macadam) || null,
          fita.tipo_led || null,
          parseFloat(fita.eficiencia_lm_w) || null,
          fita.horario_trabalho_h || null,
          parseFloat(fita.largura_mm) || null,
          parseFloat(fita.altura_mm) || null,
          parseFloat(fita.comprimento_corte_mm) || null,
          parseFloat(fita.potencia_w_m) || null,
          parseFloat(fita.comprimento_max_alimentacao_m) || null,
          parseFloat(fita.comprimento_max_circuito_m) || null,
          fita.tipos_cor || null
        ]
      )

      /* Insert das tabelas de versoesFitas e das opçoesFitas, 
       cada versao representa uma combinação de voltagem ip e rolo tendo tambem uma imagem para cada uma dessas combinações
       Dentro de cada versao tem se as opções cor, temperatura, ...
      */
      for (let i = 0; i < versoes.length; i++) {
        const versao = versoes[i]

        let imagem_versao_url = null
        const ficheiroVersao = ficheirosPorNome[`imagem_versao_${i}`]
        if (ficheiroVersao) {
          const r = await uploadBuffer(ficheiroVersao.buffer)
          imagem_versao_url = r.secure_url
        }

        const { rows: [{ versao_fita_led_id }] } = await pool.query(
          `INSERT INTO versoes_fitas_led
             (fita_led_id,
             referencia,
             voltagem_v,
             ip,
             rolo_m,
             ativo,
             imagem_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING versao_fita_led_id`,
          [
            fita_led_id,
            gerarReferenciaVersao(produto.subcategoria, fita.potencia_w_m, versao.voltagem_v, versao.ip),
            parseInt(versao.voltagem_v) || null,
            parseInt(versao.ip) || null,
            versao.rolo_m || null,
            versao.ativo === true || versao.ativo === "true",
            imagem_versao_url
          ]
        )

        //insere opções para versao
        for (const opcao of versao.opcoes ?? []) {
          await pool.query(
            `INSERT INTO opcoes_fitas_led
               (versao_fita_led_id,
               referencia,
               temperatura_cor,
               intensidade_luminosa_lm,
               preco_metro,
               ativo)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              versao_fita_led_id,
              gerarReferenciaOpcao(produto.subcategoria, fita.potencia_w_m, versao.voltagem_v, opcao.temperatura_cor, versao.ip),
              opcao.temperatura_cor || null,
              parseFloat(opcao.intensidade_luminosa_lm) || null,
              parseFloat(opcao.preco_metro) || null,
              opcao.ativo === true || opcao.ativo === "true"
            ]
          )
        }
      }

      await pool.query("COMMIT")
      res.status(201).json({ success: true, fita_led_id })

    } catch (error) {
      await pool.query("ROLLBACK")
      console.error("Erro ao criar fita:", error)
      res.status(500).json({ erro: "Erro ao criar fita ", detalhe: error.message })
    }
  }
)

//Para a listagem das fitas - mesma logica dos perfis quanto a tar ativo ou nao
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
         p.nome,
         p.categoria,
         p.subcategoria,
         p.imagem_url,
         p.ativo,
         f.fita_led_id,
         f.tipo_led,
         f.potencia_w_m,
         f.quantidade_leds_m,
         f.tipos_cor
       FROM produtos p
       JOIN fitas_led f ON f.produto_id = p.produto_id
       ${where}
       ORDER BY p.nome ASC`

    if (req.query.pagina !== undefined) {
      const pagina = Math.max(1, parseInt(req.query.pagina) || 1)
      const limite = Math.min(120, Math.max(1, parseInt(req.query.limite) || 60))
      const offset = (pagina - 1) * limite
      const { rows: [{ total }] } = await pool.query(
        `SELECT COUNT(*) AS total FROM produtos p JOIN fitas_led f ON f.produto_id = p.produto_id ${where}`,
        [...params]
      )
      const { rows } = await pool.query(mainSelect + ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limite, offset])
      return res.json({ dados: rows, total: parseInt(total) })
    }

    const { rows } = await pool.query(mainSelect, params)
    res.json(rows)

  } catch (error) {
    console.error("Erro ao buscar fitas:", error)
    res.status(500).json({ erro: "Erro ao buscar fitas ", detalhe: error.message })
  }
})

//Para a pagina de detalhes com os detalhes todos de uma fita
router.get("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const { rows: [fita] } = await pool.query(
      `SELECT
         p.produto_id,
         p.referencia,
         p.nome,
         p.categoria,
         p.subcategoria,
         p.descricao,
         p.garantia_anos,
         p.imagem_url,
         p.imagem_extra_url,
         p.ficha_tecnica_url,
         p.ativo,
         f.fita_led_id,
         f.angulo_abertura,
         f.dimavel,
         f.quantidade_leds_m,
         f.cri,
         f.macadam,
         f.tipo_led,
         f.eficiencia_lm_w,
         f.horario_trabalho_h,
         f.largura_mm,
         f.altura_mm,
         f.comprimento_corte_mm,
         f.potencia_w_m,
         f.comprimento_max_alimentacao_m,
         f.comprimento_max_circuito_m,
         f.tipos_cor
       FROM produtos p
       JOIN fitas_led f ON f.produto_id = p.produto_id
       WHERE p.produto_id = $1`,
      [id]
    )

    if (!fita) {
      return res.status(404).json({ erro: "Fita led não encontrada" })
    }

    // Para dar as versoes dessa fita
    const { rows: versoes } = await pool.query(
      `SELECT
         versao_fita_led_id,
         referencia,
         voltagem_v,
         ip,
         rolo_m,
         ativo,
         imagem_url
       FROM versoes_fitas_led
       WHERE fita_led_id = $1
       ORDER BY versao_fita_led_id ASC`,
      [fita.fita_led_id]
    )

    // Opções de todas as versões

    const versaoIds = versoes.map(v => v.versao_fita_led_id)
    const opcoesPorVersao = {}

    if (versaoIds.length > 0) {
      const { rows: opcoes } = await pool.query(
        `SELECT
           opcao_fita_led_id,
           versao_fita_led_id,
           referencia,
           tipo_cor,
           temperatura_cor,
           intensidade_luminosa_lm,
           preco_metro,
           ativo
         FROM opcoes_fitas_led
         WHERE versao_fita_led_id = ANY($1)
         ORDER BY opcao_fita_led_id ASC`,
        [versaoIds]
      )

      // Agrupar opções pelo id da versão correspondente
      for (const opcao of opcoes) {
        const vid = opcao.versao_fita_led_id
        if (!opcoesPorVersao[vid]) opcoesPorVersao[vid] = []
        opcoesPorVersao[vid].push(opcao)
      }
    }

    // Injetar as opções dentro de cada versão antes de devolver
    const versoesComOpcoes = versoes.map(v => ({
      ...v,
      opcoes: opcoesPorVersao[v.versao_fita_led_id] ?? []
    }))

    res.json({
      ...fita,
      versoes: versoesComOpcoes
    })

  } catch (error) {
    console.error("Erro ao buscar fita:", error)
    res.status(500).json({ erro: "Erro ao buscar fita", detalhe: error.message })
  }
})

// Soft delete 
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

/* UPDATE de uma fita led
Apaga todas as opções e versões existentes e reinsere tudo com dados novos
Das imagens se vier um ficheiro novo dá upload caso contrario mantem tudo*/
router.put("/:id",
  upload.any(),
  async (req, res) => {
    const { id } = req.params

    try {

      let produto = req.body.produto
      let fita = req.body.fita
      let versoes = req.body.versoes

      if (typeof produto === "string") produto = JSON.parse(produto)
      if (typeof fita === "string") fita = JSON.parse(fita)
      if (typeof versoes === "string") versoes = JSON.parse(versoes)

      const ficheirosPorNome = {}
      for (const file of req.files ?? []) {
        ficheirosPorNome[file.fieldname] = file
      }

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

      // ── Buscar URLs de imagens atuais antes de qualquer alteração ──────
      // Necessário para saber quais eliminar do Cloudinary no final,
      // caso sejam substituídas por novas ou removidas pelo utilizador.

      if (!produto?.subcategoria?.trim())
        return res.status(400).json({ erro: "A subcategoria é obrigatória.", campo: "subcategoria" })
      if (!fita?.potencia_w_m)
        return res.status(400).json({ erro: "A potência (W/m) é obrigatória.", campo: "potencia_w_m" })
      if (!fita?.tipos_cor?.trim())
        return res.status(400).json({ erro: "O tipo de cor é obrigatório.", campo: "tipos_cor" })

      const referenciaGerada = gerarReferenciaProduto(produto.subcategoria, fita.potencia_w_m, fita.tipos_cor)
      const { rows: dupRef } = await pool.query(
        `SELECT produto_id FROM produtos WHERE LOWER(referencia) = LOWER($1) AND produto_id != $2`,
        [referenciaGerada, id]
      )
      if (dupRef.length > 0)
        return res.status(409).json({ erro: "Já existe outra fita com esta referência (mesma subcategoria, potência e tipo de cor).", campo: "referencia" })

      const { rows: [urlsAtuais] } = await pool.query(
        `SELECT p.imagem_url, p.imagem_extra_url
         FROM produtos p
         WHERE p.produto_id = $1`,
        [id]
      )
      const { rows: versoesAtuais } = await pool.query(
        `SELECT imagem_url FROM versoes_fitas_led
         WHERE fita_led_id = (SELECT fita_led_id FROM fitas_led WHERE produto_id = $1)`,
        [id]
      )
      const urlsVersoesAntigas = versoesAtuais.map(v => v.imagem_url).filter(Boolean)

      await pool.query("BEGIN")

      const { rows: [{ fita_led_id }] } = await pool.query(
        `SELECT fita_led_id FROM fitas_led WHERE produto_id = $1`,
        [id]
      )

      await pool.query(
        `UPDATE produtos SET
           referencia = $1,
           nome = $2,
           subcategoria = $3,
           descricao = $4,
           garantia_anos = $5,
           imagem_url = $6,
           imagem_extra_url = $7,
           ficha_tecnica_url = $8
         WHERE produto_id = $9`,
        [
          referenciaGerada,
          referenciaGerada,
          produto.subcategoria || null,
          produto.descricao || null,
          parseInt(produto.garantia_anos) || null,
          imagem_url,
          imagem_extra_url,
          produto.ficha_tecnica_url || null,
          id
        ]
      )

      await pool.query(
        `UPDATE fitas_led SET
           angulo_abertura = $1,
           dimavel = $2,
           quantidade_leds_m = $3,
           cri = $4,
           macadam = $5,
           tipo_led = $6,
           eficiencia_lm_w = $7,
           horario_trabalho_h = $8,
           largura_mm = $9,
           altura_mm = $10,
           comprimento_corte_mm = $11,
           potencia_w_m = $12,
           comprimento_max_alimentacao_m = $13,
           comprimento_max_circuito_m = $14,
           tipos_cor = $15
         WHERE fita_led_id = $16`,
        [
          parseFloat(fita.angulo_abertura) || null,
          fita.dimavel === true || fita.dimavel === "true",
          parseInt(fita.quantidade_leds_m) || null,
          parseFloat(fita.cri) || null,
          parseFloat(fita.macadam) || null,
          fita.tipo_led || null,
          parseFloat(fita.eficiencia_lm_w) || null,
          fita.horario_trabalho_h || null,
          parseFloat(fita.largura_mm) || null,
          parseFloat(fita.altura_mm) || null,
          parseFloat(fita.comprimento_corte_mm) || null,
          parseFloat(fita.potencia_w_m) || null,
          parseFloat(fita.comprimento_max_alimentacao_m) || null,
          parseFloat(fita.comprimento_max_circuito_m) || null,
          fita.tipos_cor || null,
          fita_led_id
        ]
      )

      // Para apagar versoes e opçoes existentes 
      await pool.query(
        `DELETE FROM opcoes_fitas_led
         WHERE versao_fita_led_id IN (
           SELECT versao_fita_led_id FROM versoes_fitas_led WHERE fita_led_id = $1
         )`,
        [fita_led_id]
      )

      await pool.query(
        `DELETE FROM versoes_fitas_led WHERE fita_led_id = $1`,
        [fita_led_id]
      )

      // Reinsere VERSOES e OPCOES 
      for (let i = 0; i < versoes.length; i++) {
        const versao = versoes[i]

        // Imagem da versão: novo ficheiro ou URL atual
        let imagem_versao_url = versao.imagem_url_atual || null
        const ficheiroVersao = ficheirosPorNome[`imagem_versao_${i}`]
        if (ficheiroVersao) {
          const r = await uploadBuffer(ficheiroVersao.buffer)
          imagem_versao_url = r.secure_url
        }

        const { rows: [{ versao_fita_led_id }] } = await pool.query(
          `INSERT INTO versoes_fitas_led
             (fita_led_id,
             referencia,
             voltagem_v,
             ip,
             rolo_m,
             ativo,
             imagem_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING versao_fita_led_id`,
          [
            fita_led_id,
            gerarReferenciaVersao(produto.subcategoria, fita.potencia_w_m, versao.voltagem_v, versao.ip),
            parseInt(versao.voltagem_v) || null,
            parseInt(versao.ip) || null,
            versao.rolo_m || null,
            versao.ativo === true || versao.ativo === "true",
            imagem_versao_url
          ]
        )

        for (const opcao of versao.opcoes ?? []) {
          await pool.query(
            `INSERT INTO opcoes_fitas_led
               (versao_fita_led_id,
               referencia,
               temperatura_cor,
               intensidade_luminosa_lm,
               preco_metro,
               ativo)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              versao_fita_led_id,
              gerarReferenciaOpcao(produto.subcategoria, fita.potencia_w_m, versao.voltagem_v, opcao.temperatura_cor, versao.ip),
              opcao.temperatura_cor || null,
              parseFloat(opcao.intensidade_luminosa_lm) || null,
              parseFloat(opcao.preco_metro) || null,
              opcao.ativo === true || opcao.ativo === "true"
            ]
          )
        }
      }

      await pool.query("COMMIT")

      // Elimina imagens órfãs do Cloudinary- feito após o COMMIT para não interferir com a transação.

      if (ficheirosPorNome.imagem_url) await eliminarImagemCloudinary(urlsAtuais.imagem_url)
      if (ficheirosPorNome.imagem_extra_url) await eliminarImagemCloudinary(urlsAtuais.imagem_extra_url)

      const urlsVersoesNovas = new Set(versoes.map(v => v.imagem_url_atual).filter(Boolean))
      for (const urlAntiga of urlsVersoesAntigas) {
        if (!urlsVersoesNovas.has(urlAntiga)) await eliminarImagemCloudinary(urlAntiga)
      }

      res.json({ success: true })

    } catch (error) {
      await pool.query("ROLLBACK")
      console.error("Erro ao editar fita:", error)
      res.status(500).json({ erro: "Erro ao editar fita ", detalhe: error.message })
    }
  }
)

export default router
