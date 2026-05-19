import express from "express"
import adminAuth from "../middleware/adminAuth.js"
import { pool } from "../db.js"

const router = express.Router()

router.get("/", adminAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, texto_prompt, criado_em FROM logs_prompts_configurador ORDER BY criado_em DESC"
    )
    res.json(rows)
  } catch (err) {
    console.error("[logs] erro:", err)
    res.status(500).json({ erro: "Erro ao carregar logs." })
  }
})

export default router
