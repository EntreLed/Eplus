import express from "express"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { pool } from "../db.js"

const router = express.Router()

router.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body

    const result = await pool.query(
      "SELECT u.*, r.nome AS role FROM utilizadores u JOIN roles r ON u.role_id = r.role_id WHERE u.email = $1",
      [email]
    )

    const user = result.rows[0]

    if (!user) {
      return res.status(401).json({ erro: "Credenciais inválidas" })
    }

    if (!user.ativo) {
      return res.status(403).json({ erro: "Conta inativa" })
    }

    const passwordValida = await bcrypt.compare(
      password,
      user.password_hash
    )

    if (!passwordValida) {
      return res.status(401).json({ erro: "Credenciais inválidas" })
    }

    const exp = Math.floor(Date.now() / 1000) + 3600
    const token = jwt.sign(
      { id: user.utilizador_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    )

    const isProd = process.env.NODE_ENV === "production"
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "strict",
      maxAge: 3600000,
    })

    res.json({ role: user.role, exp })

  } catch (error) {

    console.error(error)

    res.status(500).json({
      erro: "Erro no login"
    })

  }

})

router.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "strict" })
  res.json({ success: true })
})

export default router
