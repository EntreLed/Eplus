import express from "express"
import { pool } from "../db.js"
import cloudinary from "../config/cloudinary.js"
import adminAuth from "../middleware/adminAuth.js"

const router = express.Router()

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

// Apaga definitivamente um produto desativado.
// Verifica dependências antes de apagar e elimina imagens do Cloudinary.

router.delete("/:id", adminAuth, async (req, res) => {
  const { id } = req.params
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // 1. Verificar se produto existe e está desativado
    const { rows: [produto] } = await client.query(
      `SELECT produto_id, categoria, subcategoria, imagem_url, imagem_extra_url, nome, ativo
       FROM produtos WHERE produto_id = $1`,
      [id]
    )
    if (!produto) {
      await client.query("ROLLBACK")
      return res.status(404).json({ erro: "Produto não encontrado" })
    }
    if (produto.ativo !== false) {
      await client.query("ROLLBACK")
      return res.status(400).json({ erro: "Apenas produtos desativados podem ser eliminados." })
    }

    const { categoria, subcategoria } = produto

    // 2. Verificar dependências — impedir apagar se referenciado noutros produtos
    const bloqueios = []

    // Controlador usado em kits
    if (categoria === "controlador" && subcategoria !== "Comando" && subcategoria !== "Kit") {
      const { rows } = await client.query(
        `SELECT p.nome FROM kits_controladores kc
         JOIN produtos p ON p.produto_id = kc.produto_id
         WHERE kc.controlador_id = (
           SELECT controlador_id FROM controladores WHERE produto_id = $1
         )`,
        [id]
      )
      if (rows.length > 0)
        bloqueios.push(`Controlador usado nos kits: ${rows.map(r => r.nome).join(", ")}`)
    }

    // Comando usado em kits ou compatibilidades
    if (categoria === "controlador" && subcategoria === "Comando") {
      const { rows: kitsRows } = await client.query(
        `SELECT p.nome FROM kits_controladores kc
         JOIN produtos p ON p.produto_id = kc.produto_id
         WHERE kc.comando_id = (
           SELECT comando_id FROM comandos WHERE produto_id = $1
         )`,
        [id]
      )
      if (kitsRows.length > 0)
        bloqueios.push(`Comando usado nos kits: ${kitsRows.map(r => r.nome).join(", ")}`)

      const { rows: compatRows } = await client.query(
        `SELECT p.nome FROM compatibilidade_comando_controlador cc
         JOIN controladores c ON c.controlador_id = cc.controlador_id
         JOIN produtos p ON p.produto_id = c.produto_id
         WHERE cc.comando_id = (
           SELECT comando_id FROM comandos WHERE produto_id = $1
         )`,
        [id]
      )
      if (compatRows.length > 0)
        bloqueios.push(`Comando compatível com controladores: ${compatRows.map(r => r.nome).join(", ")}`)
    }

    if (bloqueios.length > 0) {
      await client.query("ROLLBACK")
      return res.status(409).json({
        erro: "Produto não pode ser eliminado devido a dependências.",
        bloqueios
      })
    }

    // 3. Recolher imagens para eliminar do Cloudinary depois do commit
    const imagens = [produto.imagem_url, produto.imagem_extra_url].filter(Boolean)

    // 4. Apagar registos específicos por tipo (em ordem segura)
    if (categoria === "perfil") {
      const { rows: [p] } = await client.query(`SELECT perfil_id FROM perfis WHERE produto_id = $1`, [id])
      if (p) {
        await client.query(`DELETE FROM variantes_perfis WHERE perfil_id = $1`, [p.perfil_id])
        await client.query(`DELETE FROM variantes_difusores WHERE difusor_id IN (SELECT difusor_id FROM perfil_difusores WHERE perfil_id = $1)`, [p.perfil_id])
        await client.query(`DELETE FROM perfil_difusores WHERE perfil_id = $1`, [p.perfil_id])
        await client.query(`DELETE FROM perfis WHERE perfil_id = $1`, [p.perfil_id])
      }
    } else if (categoria === "fita_led") {
      const { rows: [f] } = await client.query(`SELECT fita_led_id FROM fitas_led WHERE produto_id = $1`, [id])
      if (f) {
        await client.query(`DELETE FROM opcoes_fitas_led WHERE versao_id IN (SELECT versao_id FROM versoes_fitas_led WHERE fita_led_id = $1)`, [f.fita_led_id])
        await client.query(`DELETE FROM versoes_fitas_led WHERE fita_led_id = $1`, [f.fita_led_id])
        await client.query(`DELETE FROM fitas_led WHERE fita_led_id = $1`, [f.fita_led_id])
      }
    } else if (categoria === "neon") {
      const { rows: [n] } = await client.query(`SELECT modelo_neon_id FROM modelos_neon WHERE produto_id = $1`, [id])
      if (n) {
        await client.query(`DELETE FROM variantes_neon WHERE versao_neon_id IN (SELECT versao_neon_id FROM versoes_neon WHERE modelo_neon_id = $1)`, [n.modelo_neon_id])
        await client.query(`DELETE FROM versoes_neon WHERE modelo_neon_id = $1`, [n.modelo_neon_id])
        await client.query(`DELETE FROM modelos_neon WHERE modelo_neon_id = $1`, [n.modelo_neon_id])
      }
    } else if (categoria === "controlador" && subcategoria !== "Comando" && subcategoria !== "Kit") {
      const { rows: [c] } = await client.query(`SELECT controlador_id FROM controladores WHERE produto_id = $1`, [id])
      if (c) {
        await client.query(`DELETE FROM tipos_controlo_controladores WHERE controlador_id = $1`, [c.controlador_id])
        await client.query(`DELETE FROM tipos_sinal_controladores WHERE controlador_id = $1`, [c.controlador_id])
        await client.query(`DELETE FROM frequencias_controladores WHERE controlador_id = $1`, [c.controlador_id])
        await client.query(`DELETE FROM certificacoes_controladores WHERE controlador_id = $1`, [c.controlador_id])
        await client.query(`DELETE FROM entradas_controladores WHERE controlador_id = $1`, [c.controlador_id])
        await client.query(`DELETE FROM saidas_controladores WHERE controlador_id = $1`, [c.controlador_id])
        await client.query(`DELETE FROM limites_potencia_controladores WHERE controlador_id = $1`, [c.controlador_id])
        await client.query(`DELETE FROM controladores WHERE controlador_id = $1`, [c.controlador_id])
      }
    } else if (categoria === "controlador" && subcategoria === "Comando") {
      const { rows: [c] } = await client.query(`SELECT comando_id FROM comandos WHERE produto_id = $1`, [id])
      if (c) {
        await client.query(`DELETE FROM frequencias_comandos WHERE comando_id = $1`, [c.comando_id])
        await client.query(`DELETE FROM tipos_controlo_comandos WHERE comando_id = $1`, [c.comando_id])
        await client.query(`DELETE FROM certificacoes_comandos WHERE comando_id = $1`, [c.comando_id])
        await client.query(`DELETE FROM entradas_comandos WHERE comando_id = $1`, [c.comando_id])
        await client.query(`DELETE FROM comandos WHERE comando_id = $1`, [c.comando_id])
      }
    } else if (categoria === "controlador" && subcategoria === "Kit") {
      const { rows: [k] } = await client.query(`SELECT kit_controlador_id FROM kits_controladores WHERE produto_id = $1`, [id])
      if (k) {
        await client.query(`DELETE FROM kits_controladores WHERE kit_controlador_id = $1`, [k.kit_controlador_id])
      }
    } else if (categoria === "power") {
      await client.query(`DELETE FROM certificacoes_power WHERE produto_id = $1`, [id])
      await client.query(`DELETE FROM fontes_alimentacao WHERE produto_id = $1`, [id])
    } else if (categoria === "acessorios") {
      const { rows: [a] } = await client.query(`SELECT acessorio_id FROM acessorios WHERE produto_id = $1`, [id])
      if (a) {
        // Apaga todas as sub-tabelas de acessório (cada tipo tem as suas)
        for (const tabela of [
          "interruptores", "conectores_uniao", "cabos_encaixe",
          "clipes_tampas", "ligadores_fio", "fixacao_colas",
          "fios_paralelos", "fichas", "mangas_termoretrateis", "ferros_soldas"
        ]) {
          await client.query(`DELETE FROM ${tabela} WHERE acessorio_id = $1`, [a.acessorio_id]).catch(() => {})
        }
        await client.query(`DELETE FROM acessorios WHERE acessorio_id = $1`, [a.acessorio_id])
      }
    }

    // 5. Apagar o produto principal
    await client.query(`DELETE FROM produtos WHERE produto_id = $1`, [id])

    await client.query("COMMIT")

    // 6. Eliminar imagens do Cloudinary (após commit — não é reversível)
    await Promise.all(imagens.map(eliminarImagemCloudinary))

    res.json({ mensagem: `Produto "${produto.nome}" eliminado com sucesso.` })

  } catch (err) {
    await client.query("ROLLBACK")
    console.error("Erro ao eliminar produto:", err)
    res.status(500).json({ erro: "Erro interno ao eliminar produto.", detalhe: err.message })
  } finally {
    client.release()
  }
})

// GET /api/produto/:id
// Devolve { tipo } com base na categoria/subcategoria do produto.
// Usado pelo frontend para saber qual endpoint específico chamar,
// evitando chamadas 404 sequenciais.

const tipoParaEndpoint = {
  perfil: "perfis",
  fita_led: "fitas_led",
  neon: "neon",
  controlador: "controladores",
  comando: "comandos",
  kit: "kits",
  power: "power",
  acessorio: "acessorios",
}

router.get("/todos", async (req, res) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina) || 1)
    const limite = Math.min(120, Math.max(1, parseInt(req.query.limite) || 60))
    const offset = (pagina - 1) * limite
    const seed = req.query.seed || "s"

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM produtos WHERE ativo = true`),
      pool.query(
        `SELECT produto_id, referencia, nome, categoria, subcategoria, imagem_url
         FROM produtos
         WHERE ativo = true
         ORDER BY md5(produto_id::text || $1)
         LIMIT $2 OFFSET $3`,
        [seed, limite, offset]
      ),
    ])

    res.json({ dados: dataRes.rows, total: parseInt(countRes.rows[0].total) })
  } catch (error) {
    console.error("Erro ao buscar todos os produtos:", error)
    res.status(500).json({ erro: "Erro ao buscar todos os produtos", detalhe: error.message })
  }
})

router.get("/categorias", async (req, res) => {
  try {
    const [perfis, fitasLed, power, acessorios] = await Promise.all([
      pool.query(`SELECT DISTINCT subcategoria FROM produtos WHERE categoria = 'perfil' AND ativo = true AND subcategoria IS NOT NULL ORDER BY subcategoria`),
      pool.query(`SELECT DISTINCT subcategoria FROM produtos WHERE categoria = 'fita_led' AND ativo = true AND subcategoria IS NOT NULL ORDER BY subcategoria`),
      pool.query(`SELECT DISTINCT subcategoria FROM produtos WHERE categoria = 'power' AND ativo = true AND subcategoria IS NOT NULL ORDER BY subcategoria`),
      pool.query(`SELECT DISTINCT subcategoria FROM produtos WHERE categoria = 'acessorios' AND ativo = true AND subcategoria IS NOT NULL ORDER BY subcategoria`),
    ])

    res.json([
      { nome: "Perfis", subcategorias: perfis.rows.map(r => r.subcategoria) },
      { nome: "Fitas LED", subcategorias: fitasLed.rows.map(r => r.subcategoria) },
      { nome: "Neon", subcategorias: [] },
      { nome: "Controladores", subcategorias: [] },
      { nome: "Comandos", subcategorias: [] },
      { nome: "Kits", subcategorias: [] },
      { nome: "Power", subcategorias: power.rows.map(r => r.subcategoria) },
      { nome: "Acessórios", subcategorias: acessorios.rows.map(r => r.subcategoria) },
    ])
  } catch (error) {
    console.error("Erro ao buscar categorias:", error)
    res.status(500).json({ erro: "Erro ao buscar categorias", detalhe: error.message })
  }
})

router.get("/pesquisa", async (req, res) => {
  const { q } = req.query
  if (!q || q.trim().length < 2) return res.json({ dados: [], total: 0 })

  try {
    const termo = `%${q.trim()}%`
    const { rows } = await pool.query(
      `SELECT produto_id, referencia, nome, categoria, subcategoria, imagem_url
       FROM produtos
       WHERE ativo = true AND (
         LOWER(nome) LIKE LOWER($1) OR
         LOWER(referencia) LIKE LOWER($1)
       )
       ORDER BY nome ASC
       LIMIT 60`,
      [termo]
    )
    res.json({ dados: rows, total: rows.length })
  } catch (error) {
    console.error("Erro na pesquisa:", error)
    res.status(500).json({ erro: "Erro na pesquisa", detalhe: error.message })
  }
})

router.get("/KitAleatorio", async (req, res) => {
  try {
    const categorias = [
      { label: "FITA LED", categoria: "fita_led" },
      { label: "PERFIL", categoria: "perfil" },
      { label: "CONTROLADOR", categoria: "controlador" },
      { label: "FONTE", categoria: "power" },
      { label: "COMANDO", categoria: "comando" },
    ]

    const resultados = await Promise.all(
      categorias.map(async ({ label, categoria }) => {
        const isComando = categoria === "comando"
        const isControlador = categoria === "controlador"
        const { rows } = await pool.query(
          isComando
            ? `SELECT nome, referencia, imagem_url
               FROM produtos
               WHERE categoria = 'controlador' AND subcategoria = 'Comando' AND ativo = true
               ORDER BY RANDOM()
               LIMIT 1`
            : isControlador
            ? `SELECT nome, referencia, imagem_url
               FROM produtos
               WHERE categoria = 'controlador' AND (subcategoria NOT IN ('Comando', 'Kit') OR subcategoria IS NULL) AND ativo = true
               ORDER BY RANDOM()
               LIMIT 1`
            : `SELECT nome, referencia, imagem_url
               FROM produtos
               WHERE categoria = $1 AND ativo = true
               ORDER BY RANDOM()
               LIMIT 1`,
          isComando || isControlador ? [] : [categoria]
        )
        const p = rows[0]
        return {
          label,
          nome: p?.nome ?? "--",
          referencia: p?.referencia ?? "--",
          imagem_url: p?.imagem_url ?? null,
        }
      })
    )

    res.json(resultados)
  } catch (error) {
    console.error("Erro no kit aleatorio:", error)
    res.status(500).json({ erro: "Erro ao buscar kit aleatorio", detalhe: error.message })
  }
})

router.get("/:id", async (req, res) => {
  const { id } = req.params

  try {
    const { rows: [produto] } = await pool.query(
      `SELECT categoria, subcategoria FROM produtos WHERE produto_id = $1`,
      [id]
    )

    if (!produto) return res.status(404).json({ erro: "Produto não encontrado" })

    let tipo
    if (produto.categoria === "controlador") {
      if (produto.subcategoria === "Comando") tipo = "comando"
      else if (produto.subcategoria === "Kit") tipo = "kit"
      else tipo = "controlador"
    } else if (produto.categoria === "acessorios") {
      tipo = "acessorio"
    } else {
      tipo = produto.categoria
    }

    res.json({ tipo, endpoint: tipoParaEndpoint[tipo] })

  } catch (error) {
    console.error("Erro ao buscar tipo de produto:", error)
    res.status(500).json({ erro: "Erro ao buscar produto", detalhe: error.message })
  }
})

export default router
