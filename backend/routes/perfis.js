import express from "express"
import jwt from "jsonwebtoken"
import { pool } from "../db.js"
import cloudinary from "../config/cloudinary.js"
import upload from "../middleware/upload.js"
import streamifier from "streamifier"

const router = express.Router()

// Helpers

const codigoAcabamento = {
  "cizento anodizado": "A",
  "preto": "B",
  "branco": "W",
  "ral": "RAL"
}

function gerarReferenciaProduto(nome) {
  return nome
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "")
}

function gerarReferenciaPerfil(base, nomeAcabamento, medida) {
  const codigo = codigoAcabamento[nomeAcabamento] ?? nomeAcabamento.toUpperCase()
  if (medida === "2m") return `${base}-${codigo}`
  return `${base}-${codigo}-${medida.toUpperCase()}`
}

function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "perfis" },
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

// Helper: elimina uma imagem do Cloudinary se existir.
// Chamado após o COMMIT para não interferir com a transação.

async function eliminarImagemCloudinary(url) {
  const publicId = extrairPublicId(url)
  if (!publicId) return
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (err) {
    console.error("Erro ao eliminar imagem do Cloudinary:", publicId, err.message)
  }
}

// POST /api/perfis

router.post("/",
  upload.fields([
    { name: "imagem_url" },
    { name: "imagem_extra_url" },
    { name: "imagem_medidas_url" }
  ]),
  async (req, res) => {
    try {

      // Parse do body

      let produto = req.body.produto
      let perfil = req.body.perfil
      let instalacoes = req.body.instalacoes
      let acabamentos = req.body.acabamentos
      let difusores = req.body.difusores

      if (typeof produto === "string") produto = JSON.parse(produto)
      if (typeof perfil === "string") perfil = JSON.parse(perfil)
      if (typeof instalacoes === "string") instalacoes = JSON.parse(instalacoes)
      if (typeof acabamentos === "string") acabamentos = JSON.parse(acabamentos)
      if (typeof difusores === "string") difusores = JSON.parse(difusores)

      // Uploads de imagens

      let imagem_url = null
      let imagem_extra_url = null
      let imagem_medidas_url = null

      if (req.files?.imagem_url?.[0]) {
        const r = await uploadBuffer(req.files.imagem_url[0].buffer)
        imagem_url = r.secure_url
      }
      if (req.files?.imagem_extra_url?.[0]) {
        const r = await uploadBuffer(req.files.imagem_extra_url[0].buffer)
        imagem_extra_url = r.secure_url
      }
      if (req.files?.imagem_medidas_url?.[0]) {
        const r = await uploadBuffer(req.files.imagem_medidas_url[0].buffer)
        imagem_medidas_url = r.secure_url
      }

      if (!produto?.nome?.trim())
        return res.status(400).json({ erro: "O nome é obrigatório.", campo: "nome" })
      if (!produto?.subcategoria?.trim())
        return res.status(400).json({ erro: "A subcategoria é obrigatória.", campo: "subcategoria" })
      if (!imagem_url)
        return res.status(400).json({ erro: "A imagem é obrigatória.", campo: "imagem_url" })

      const { rows: dupNome } = await pool.query(
        `SELECT produto_id FROM produtos WHERE LOWER(nome) = LOWER($1)`,
        [produto.nome.trim()]
      )
      if (dupNome.length > 0)
        return res.status(409).json({ erro: "Já existe um perfil com este nome.", campo: "nome" })

      await pool.query("BEGIN")

      // 1. PRODUTO

      const referenciaProduto = gerarReferenciaProduto(produto.nome)

      const { rows: [{ produto_id }] } = await pool.query(
        `INSERT INTO produtos
           (referencia, nome, categoria, subcategoria, descricao,
            garantia_anos, imagem_url, imagem_extra_url, ficha_tecnica_url, ativo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
         RETURNING produto_id`,
        [
          referenciaProduto,
          produto.nome,
          produto.categoria || "perfil",
          produto.subcategoria || null,
          produto.descricao || null,
          parseInt(produto.garantia_anos) || null,
          imagem_url,
          imagem_extra_url,
          produto.ficha_tecnica_url || null
        ]
      )

      // 2. PERFIL

      const { rows: [{ perfil_id }] } = await pool.query(
        `INSERT INTO perfis
           (produto_id, material, espacamento_interno_mm, largura_externa_mm,
            altura_externa_mm, potencia_max_w_m, max_largura_fita_mm,
            max_quantidade_fitas, imagem_medidas_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING perfil_id`,
        [
          produto_id,
          perfil.material || null,
          parseFloat(perfil.espacamento_interno_mm) || null,
          parseFloat(perfil.largura_externa_mm) || null,
          parseFloat(perfil.altura_externa_mm) || null,
          parseFloat(perfil.potencia_max_w_m) || null,
          parseFloat(perfil.max_largura_fita_mm) || null,
          parseInt(perfil.max_quantidade_fitas) || null,
          imagem_medidas_url
        ]
      )

      // 3. PERFIL_INSTALACOES
      // tipos_instalacao é lookup — SELECT para buscar o id, INSERT na tabela de relação

      for (const tipo of instalacoes) {
        const { rows } = await pool.query(
          `SELECT tipo_instalacao_id FROM tipos_instalacao WHERE nome = $1`,
          [tipo]
        )
        if (!rows.length) continue

        await pool.query(
          `INSERT INTO perfil_instalacoes (perfil_id, tipo_instalacao_id)
           VALUES ($1,$2)`,
          [perfil_id, rows[0].tipo_instalacao_id]
        )
      }

      // 4. VARIANTES_PERFIS
      // acabamentos é lookup — SELECT para buscar o id, INSERT uma variante por medida ativa

      for (const acabamento of acabamentos) {
        const { rows } = await pool.query(
          `SELECT acabamento_id FROM acabamentos WHERE nome = $1`,
          [acabamento.nome]
        )
        if (!rows.length) continue

        const acabamento_id = rows[0].acabamento_id

        for (const [medida, data] of Object.entries(acabamento.medidas)) {
          if (!data.ativo) continue

          const referencia = gerarReferenciaPerfil(
            referenciaProduto,
            acabamento.nome,
            medida
          )

          await pool.query(
            `INSERT INTO variantes_perfis
               (perfil_id, dimensao_m, referencia, preco, ativo, acabamento_id)
             VALUES ($1,$2,$3,$4,true,$5)`,
            [
              perfil_id,
              parseFloat(medida.replace("m", "")),
              referencia,
              parseFloat(data.preco) || null,
              acabamento_id
            ]
          )
        }
      }

      // 5. PERFIL_DIFUSORES + VARIANTES_DIFUSORES

      for (const difusor of difusores) {

        const temMedidasAtivas = Object.values(difusor.medidas).some(d => d.ativo)
        if (!temMedidasAtivas) continue

        const { rows } = await pool.query(
          `SELECT difusor_id FROM difusores WHERE nome = $1`,
          [difusor.nome]
        )
        if (!rows.length) continue

        const difusor_id = rows[0].difusor_id

        await pool.query(
          `INSERT INTO perfil_difusores (perfil_id, difusor_id)
           VALUES ($1,$2)
           ON CONFLICT (perfil_id, difusor_id) DO NOTHING`,
          [perfil_id, difusor_id]
        )

        for (const [medida, data] of Object.entries(difusor.medidas)) {
          if (!data.ativo) continue

          await pool.query(
            `INSERT INTO variantes_difusores
               (difusor_id, comprimento_m, referencia, preco, ativo, perfil_id)
             VALUES ($1,$2,$3,$4,true,$5)
             ON CONFLICT (perfil_id, referencia) DO NOTHING`,
            [
              difusor_id,
              parseFloat(medida.replace("m", "")),
              data.referencia || null,
              parseFloat(data.preco) || null,
              perfil_id
            ]
          )
        }
      }

      // COMMIT

      await pool.query("COMMIT")
      res.status(201).json({ success: true, perfil_id })

    } catch (error) {
      await pool.query("ROLLBACK")
      console.error("Erro ao criar perfil:", error)
      res.status(500).json({ erro: "Erro ao criar perfil", detalhe: error.message })
    }
  }
)

// GET /api/perfis

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
         p.descricao,
         p.imagem_url,
         p.imagem_extra_url,
         p.ativo,
         pf.perfil_id,
         pf.material,
         pf.espacamento_interno_mm,
         pf.largura_externa_mm,
         pf.altura_externa_mm,
         pf.potencia_max_w_m,
         pf.imagem_medidas_url,
         STRING_AGG(DISTINCT ti.nome, ', ') AS tipos_instalacao
       FROM produtos p
       JOIN perfis pf ON pf.produto_id = p.produto_id
       LEFT JOIN perfil_instalacoes pi ON pi.perfil_id = pf.perfil_id
       LEFT JOIN tipos_instalacao ti ON ti.tipo_instalacao_id = pi.tipo_instalacao_id
       ${where}
       GROUP BY p.produto_id, pf.perfil_id
       ORDER BY p.nome ASC`

    if (req.query.pagina !== undefined) {
      const pagina = Math.max(1, parseInt(req.query.pagina) || 1)
      const limite = Math.min(120, Math.max(1, parseInt(req.query.limite) || 60))
      const offset = (pagina - 1) * limite
      const countParams = [...params]
      const { rows: [{ total }] } = await pool.query(
        `SELECT COUNT(*) AS total FROM produtos p JOIN perfis pf ON pf.produto_id = p.produto_id ${where}`,
        countParams
      )
      const dataParams = [...params, limite, offset]
      const { rows } = await pool.query(mainSelect + ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, dataParams)
      return res.json({ dados: rows, total: parseInt(total) })
    }

    const { rows } = await pool.query(mainSelect, params)
    res.json(rows)
  } catch (error) {
    console.error("Erro ao buscar perfis:", error)
    res.status(500).json({ erro: "Erro ao buscar perfis", detalhe: error.message })
  }
})

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try{
    //Tras os dados do produto e perfil com base no id
    const { rows: [perfil] } = await pool.query(
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
        pf.perfil_id,
        pf.material,
        pf.espacamento_interno_mm,
        pf.largura_externa_mm,
        pf.altura_externa_mm,
        pf.potencia_max_w_m,
        pf.max_largura_fita_mm,
        pf.max_quantidade_fitas,
        pf.imagem_medidas_url
      FROM produtos p
      JOIN perfis pf ON pf.produto_id=p.produto_id
      WHERE p.produto_id = $1`,
      [id]
    )

    if (!perfil) {
      return res.status(404).json({ erro: "Perfil não encontrado" })
    }

    //vai buscar os tipos de instalação associados a esse id
    const { rows: instalacoes } = await pool.query(
      `SELECT ti.nome
      FROM perfil_instalacoes pi
      JOIN tipos_instalacao ti ON ti.tipo_instalacao_id = pi.tipo_instalacao_id
      WHERE pi.perfil_id = $1`,
      [perfil.perfil_id]
    )

    //Variantes - acabamentos e medidas
    const { rows: variantes } = await pool.query(
      `SELECT
         vp.referencia,
         vp.dimensao_m,
         vp.preco,
         a.nome AS acabamento,
         a.codigo_cor
       FROM variantes_perfis vp
       JOIN acabamentos a ON a.acabamento_id = vp.acabamento_id
       WHERE vp.perfil_id = $1 AND vp.ativo = true
       ORDER BY a.nome, vp.dimensao_m`,
      [perfil.perfil_id]
    )

    //Difusores compatíveis e variantes
    const { rows: difusores } = await pool.query(
      `SELECT
         d.difusor_id,
         d.nome,
         d.descricao,
         vd.referencia,
         vd.comprimento_m,
         vd.preco
       FROM perfil_difusores pd
       JOIN difusores d ON d.difusor_id = pd.difusor_id
       LEFT JOIN variantes_difusores vd ON vd.difusor_id = d.difusor_id AND vd.perfil_id = pd.perfil_id AND vd.ativo = true
       WHERE pd.perfil_id = $1
       ORDER BY d.nome, vd.comprimento_m`,
      [perfil.perfil_id]
    )

    //Agrupar difusores - evita repetição do nome
    const difusoresAgrupados = difusores.reduce((acc, row) => {
      const existente = acc.find(d => d.difusor_id === row.difusor_id)
      const variante = {
        referencia: row.referencia,
        comprimento_m: row.comprimento_m,
        preco: row.preco
      }
      if (existente) {
        existente.variantes.push(variante)
      } else {
        acc.push({
          difusor_id: row.difusor_id,
          nome: row.nome,
          descricao: row.descricao,
          variantes: [variante]
        })
      }
      return acc
    }, [])

    //Agrupar variantes por acabamento
    const variantesAgrupadas = variantes.reduce((acc, row) => {
      const existente = acc.find(a => a.acabamento === row.acabamento)
      const medida = {
        referencia: row.referencia,
        dimensao_m: row.dimensao_m,
        preco: row.preco
      }
      if (existente) {
        existente.medidas.push(medida)
      } else {
        acc.push({
          acabamento: row.acabamento,
          codigo_cor: row.codigo_cor,
          medidas: [medida]
        })
      }
      return acc
    }, [])

    res.json({
      ...perfil,
      instalacoes: instalacoes.map(i => i.nome),
      acabamentos: variantesAgrupadas,
      difusores: difusoresAgrupados
    })

  } catch (error) {
    console.error("Erro ao buscar perfil:", error)
    res.status(500).json({ erro: "Erro ao buscar perfil", detalhe: error.message })
  }

})

// PATCH /api/perfis/:id/ativo

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

// PUT /api/perfis/:id

router.put("/:id",
  upload.fields([
    { name: "imagem_url" },
    { name: "imagem_extra_url" },
    { name: "imagem_medidas_url" }
  ]),
  async (req, res) => {
    const { id } = req.params

    try {
      let produto = req.body.produto
      let perfil = req.body.perfil
      let instalacoes = req.body.instalacoes
      let acabamentos = req.body.acabamentos
      let difusores = req.body.difusores

      if (typeof produto === "string") produto = JSON.parse(produto)
      if (typeof perfil === "string") perfil = JSON.parse(perfil)
      if (typeof instalacoes === "string") instalacoes = JSON.parse(instalacoes)
      if (typeof acabamentos === "string") acabamentos = JSON.parse(acabamentos)
      if (typeof difusores === "string") difusores = JSON.parse(difusores)

      // Imagens: upload se novo ficheiro, senão mantém URL atual

      // Buscar URLs de imagens atuais antes de qualquer alteração
      // Necessário para saber quais eliminar do Cloudinary no final.

      if (!produto?.nome?.trim())
        return res.status(400).json({ erro: "O nome é obrigatório.", campo: "nome" })
      if (!produto?.subcategoria?.trim())
        return res.status(400).json({ erro: "A subcategoria é obrigatória.", campo: "subcategoria" })

      const { rows: dupNome } = await pool.query(
        `SELECT produto_id FROM produtos WHERE LOWER(nome) = LOWER($1) AND produto_id != $2`,
        [produto.nome.trim(), id]
      )
      if (dupNome.length > 0)
        return res.status(409).json({ erro: "Já existe outro perfil com este nome.", campo: "nome" })

      const { rows: [urlsAtuais] } = await pool.query(
        `SELECT p.imagem_url, p.imagem_extra_url, pf.imagem_medidas_url
         FROM produtos p
         JOIN perfis pf ON pf.produto_id = p.produto_id
         WHERE p.produto_id = $1`,
        [id]
      )

      let imagem_url = produto.imagem_url_atual || null
      let imagem_extra_url = produto.imagem_extra_url_atual || null
      let imagem_medidas_url = perfil.imagem_medidas_url_atual || null

      if (req.files?.imagem_url?.[0]) {
        const r = await uploadBuffer(req.files.imagem_url[0].buffer)
        imagem_url = r.secure_url
      }
      if (req.files?.imagem_extra_url?.[0]) {
        const r = await uploadBuffer(req.files.imagem_extra_url[0].buffer)
        imagem_extra_url = r.secure_url
      }
      if (req.files?.imagem_medidas_url?.[0]) {
        const r = await uploadBuffer(req.files.imagem_medidas_url[0].buffer)
        imagem_medidas_url = r.secure_url
      }

      if (!imagem_url)
        return res.status(400).json({ erro: "A imagem é obrigatória.", campo: "imagem_url" })

      await pool.query("BEGIN")

      // 1. Buscar perfil_id a partir do produto_id

      const { rows: [{ perfil_id }] } = await pool.query(
        `SELECT perfil_id FROM perfis WHERE produto_id = $1`,
        [id]
      )

      // 2. Atualizar PRODUTO

      await pool.query(
        `UPDATE produtos SET
           nome = $1,
           subcategoria = $2,
           descricao = $3,
           garantia_anos = $4,
           imagem_url = $5,
           imagem_extra_url = $6,
           ficha_tecnica_url = $7
         WHERE produto_id = $8`,
        [
          produto.nome,
          produto.subcategoria || null,
          produto.descricao || null,
          parseInt(produto.garantia_anos) || null,
          imagem_url,
          imagem_extra_url,
          produto.ficha_tecnica_url || null,
          id
        ]
      )

      // 3. Atualizar PERFIL

      await pool.query(
        `UPDATE perfis SET
           material = $1,
           espacamento_interno_mm = $2,
           largura_externa_mm = $3,
           altura_externa_mm = $4,
           potencia_max_w_m = $5,
           max_largura_fita_mm = $6,
           max_quantidade_fitas = $7,
           imagem_medidas_url = $8
         WHERE perfil_id = $9`,
        [
          perfil.material || null,
          parseFloat(perfil.espacamento_interno_mm) || null,
          parseFloat(perfil.largura_externa_mm) || null,
          parseFloat(perfil.altura_externa_mm) || null,
          parseFloat(perfil.potencia_max_w_m) || null,
          parseFloat(perfil.max_largura_fita_mm) || null,
          parseInt(perfil.max_quantidade_fitas) || null,
          imagem_medidas_url,
          perfil_id
        ]
      )

      // 4. Instalações: apagar e reinserir

      await pool.query(`DELETE FROM perfil_instalacoes WHERE perfil_id = $1`, [perfil_id])

      for (const tipo of instalacoes) {
        const { rows } = await pool.query(
          `SELECT tipo_instalacao_id FROM tipos_instalacao WHERE nome = $1`, [tipo]
        )
        if (!rows.length) continue
        await pool.query(
          `INSERT INTO perfil_instalacoes (perfil_id, tipo_instalacao_id) VALUES ($1,$2)`,
          [perfil_id, rows[0].tipo_instalacao_id]
        )
      }

      // 5. Variantes de perfil: apagar e reinserir

      await pool.query(`DELETE FROM variantes_perfis WHERE perfil_id = $1`, [perfil_id])

      const referenciaProduto = gerarReferenciaProduto(produto.nome)

      for (const acabamento of acabamentos) {
        const { rows } = await pool.query(
          `SELECT acabamento_id FROM acabamentos WHERE nome = $1`, [acabamento.nome]
        )
        if (!rows.length) continue

        const acabamento_id = rows[0].acabamento_id

        for (const [medida, data] of Object.entries(acabamento.medidas)) {
          if (!data.ativo) continue

          const referencia = gerarReferenciaPerfil(referenciaProduto, acabamento.nome, medida)

          await pool.query(
            `INSERT INTO variantes_perfis (perfil_id, dimensao_m, referencia, preco, ativo, acabamento_id)
             VALUES ($1,$2,$3,$4,true,$5)`,
            [perfil_id, parseFloat(medida.replace("m", "")), referencia, parseFloat(data.preco) || null, acabamento_id]
          )
        }
      }

      // 6. Difusores: atualizar variantes por perfil

      await pool.query(`DELETE FROM variantes_difusores WHERE perfil_id = $1`, [perfil_id])
      await pool.query(`DELETE FROM perfil_difusores WHERE perfil_id = $1`, [perfil_id])

      for (const difusor of difusores) {
        const temMedidasAtivas = Object.values(difusor.medidas).some(d => d.ativo)
        if (!temMedidasAtivas) continue

        const { rows } = await pool.query(
          `SELECT difusor_id FROM difusores WHERE nome = $1`, [difusor.nome]
        )
        if (!rows.length) continue

        const difusor_id = rows[0].difusor_id

        await pool.query(
          `INSERT INTO perfil_difusores (perfil_id, difusor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [perfil_id, difusor_id]
        )

        for (const [medida, data] of Object.entries(difusor.medidas)) {
          if (!data.ativo) continue

          const comprimento = parseFloat(medida.replace("m", ""))

          const { rowCount } = await pool.query(
            `UPDATE variantes_difusores
               SET referencia = $3, preco = $4, ativo = true
             WHERE difusor_id = $1 AND comprimento_m = $2 AND perfil_id = $5`,
            [difusor_id, comprimento, data.referencia || null, parseFloat(data.preco) || null, perfil_id]
          )

          if (rowCount === 0) {
            await pool.query(
              `INSERT INTO variantes_difusores (difusor_id, comprimento_m, referencia, preco, ativo, perfil_id)
               VALUES ($1,$2,$3,$4,true,$5)
               ON CONFLICT (perfil_id, referencia) DO UPDATE SET preco = EXCLUDED.preco, ativo = true`,
              [difusor_id, comprimento, data.referencia || null, parseFloat(data.preco) || null, perfil_id]
            )
          }
        }
      }

      await pool.query("COMMIT")

      // Eliminar imagens órfãs do Cloudinary
      // Feito após o COMMIT para não interferir com a transação.
      // Elimina a URL antiga apenas se chegou um novo ficheiro para a substituir.

      if (req.files?.imagem_url?.[0]) await eliminarImagemCloudinary(urlsAtuais.imagem_url)
      if (req.files?.imagem_extra_url?.[0]) await eliminarImagemCloudinary(urlsAtuais.imagem_extra_url)
      if (req.files?.imagem_medidas_url?.[0]) await eliminarImagemCloudinary(urlsAtuais.imagem_medidas_url)

      res.json({ success: true })

    } catch (error) {
      await pool.query("ROLLBACK")
      console.error("Erro ao editar perfil:", error)
      res.status(500).json({ erro: "Erro ao editar perfil", detalhe: error.message })
    }
  }
)

export default router
