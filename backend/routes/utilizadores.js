import express from "express"
import { pool } from "../db.js"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import adminAuth from "../middleware/adminAuth.js"

const router = express.Router()

// CRIAR UTILIZADOR
router.post("/", adminAuth, async (req,res)=>{

  try{

    const { nome,email,password,role_id } = req.body

    const existing = await pool.query(
      `SELECT utilizador_id FROM utilizadores WHERE email = $1`,
      [email]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ erro: "Já existe uma conta com esse email." })
    }

    const password_hash = await bcrypt.hash(password,10)

    const result = await pool.query(
      `
      INSERT INTO utilizadores
      (nome,email,password_hash,role_id,ativo)
      VALUES ($1,$2,$3,$4,true)
      RETURNING utilizador_id, nome, email, ativo, role_id
      `,
      [nome,email,password_hash,role_id]
    )

    res.json(result.rows[0])

  }catch(error){

    console.error(error)

    res.status(500).json({
      erro:"Erro ao criar conta"
    })

  }

})


// LISTAR UTILIZADORES
router.get("/", adminAuth, async (req,res)=>{

  try{

    const result = await pool.query(
      `
      SELECT 
      u.utilizador_id,
      u.nome,
      u.email,
      u.ativo,
      r.role_id,
      r.nome AS role
      FROM utilizadores u
      JOIN roles r
      ON r.role_id = u.role_id
      ORDER BY u.utilizador_id
      `
    )

    res.json(result.rows)

  }catch(error){

    console.error(error)

    res.status(500).json({
      erro:"Erro ao listar utilizadores"
    })

  }

})


// ATUALIZAR UTILIZADOR
router.put("/:id", adminAuth, async (req,res)=>{

  try{

    const { id } = req.params

    const { nome,email,password,role_id,ativo } = req.body

    const emailExiste = await pool.query(
      `SELECT utilizador_id FROM utilizadores WHERE email = $1 AND utilizador_id != $2`,
      [email, id]
    )
    if (emailExiste.rows.length > 0) {
      return res.status(409).json({ erro: "Já existe outra conta com esse email." })
    }

    if(password){

      const password_hash = await bcrypt.hash(password,10)

      await pool.query(
        `
        UPDATE utilizadores
        SET
          nome=$1,
          email=$2,
          password_hash=$3,
          role_id=$4,
          ativo=$5
        WHERE utilizador_id=$6
        `,
        [nome,email,password_hash,role_id,ativo,id]
      )

    }else{

      await pool.query(
        `
        UPDATE utilizadores
        SET
          nome=$1,
          email=$2,
          role_id=$3,
          ativo=$4
        WHERE utilizador_id=$5
        `,
        [nome,email,role_id,ativo,id]
      )

    }

    res.json({success:true})

  }catch(error){

    console.error(error)

    res.status(500).json({
      erro:"Erro ao atualizar conta"
    })

  }

})

//APAGAR UTILIZADOR/desativar utilizador
router.delete("/:id", adminAuth, async(req,res)=>{

  try{

    const { id } = req.params

    if(req.user.id == id){
      return res.status(400).json({
        erro:"Não pode desativar a sua própria conta"
      })
    }

    const { rows: [alvo] } = await pool.query(
      `SELECT r.nome AS role FROM utilizadores u JOIN roles r ON r.role_id = u.role_id WHERE u.utilizador_id = $1`,
      [id]
    )
    if (alvo?.role === "administrador") {
      const { rows: [count] } = await pool.query(
        `SELECT COUNT(*) AS total FROM utilizadores u JOIN roles r ON r.role_id = u.role_id WHERE r.nome = 'administrador' AND u.ativo = true`
      )
      if (parseInt(count.total) <= 1) {
        return res.status(400).json({ erro: "Não é possível desativar o último administrador." })
      }
    }

    await pool.query(
      `UPDATE utilizadores SET ativo = false WHERE utilizador_id = $1`,
      [id]
    )

    res.json({success:true})

  }catch(error){

    console.error(error)

    res.status(500).json({
      erro:"Erro ao desativar conta"
    })

  }

})

// ELIMINAR UTILIZADOR PERMANENTEMENTE (só contas desativadas)
router.delete("/:id/permanente", adminAuth, async(req,res)=>{

  try{

    const { id } = req.params

    const { rows: [utilizador] } = await pool.query(
      `SELECT utilizador_id, ativo FROM utilizadores WHERE utilizador_id = $1`,
      [id]
    )

    if (!utilizador) {
      return res.status(404).json({ erro: "Utilizador não encontrado." })
    }

    if (utilizador.ativo !== false) {
      return res.status(400).json({ erro: "Apenas contas desativadas podem ser eliminadas permanentemente." })
    }

    await pool.query(`DELETE FROM utilizadores WHERE utilizador_id = $1`, [id])

    res.json({ success: true })

  }catch(error){

    console.error(error)

    res.status(500).json({
      erro:"Erro ao eliminar conta"
    })

  }

})

export default router