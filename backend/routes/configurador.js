/*import express from "express"
import { configurar } from "../services/configurador.js"

const router = express.Router()

router.post("/", async (req, res) => {

  try {

    const resultado = await configurar(req.body)

    res.json(resultado)

  } catch (error) {

    console.error(error)
    res.status(500).json({ erro: "Erro no configurador" })

  }

})

export default router*/


import express from "express"
import { configurar, buscarPerfisCandidatos } from "../services/configuradorLogica.js"

const router = express.Router()

router.post("/", async (req, res) => {

  try {

    const dados = req.body

    const resultado = await configurar(dados)

    res.json(resultado)

  } catch (error) {

    console.error(error)

    res.status(500).json({
      erro: "Erro no configurador"
    })

  }

})

router.post("/perfis-compativeis", async (req, res) => {

  try {

    const { fita, zona } = req.body

    if (!fita) return res.status(400).json({ erro: "Fita em falta" })

    const perfis = await buscarPerfisCandidatos(fita, zona || {})

    res.json(perfis)

  } catch (error) {

    console.error(error)

    res.status(500).json({ erro: "Erro ao buscar perfis compatíveis" })

  }

})

export default router