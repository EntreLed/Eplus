import express from "express"
import { gerarPDF, gerarPDFLista, enviarEmail } from "../services/orcamento.js"

const router = express.Router()

router.post("/", async (req, res) => {

  try {

    const dados = req.body

    if (!dados.nome?.trim() || !dados.email?.trim() || !dados.telefone?.trim() || !dados.kit) {
      return res.status(400).json({ erro: "Dados incompletos: nome, telefone, email e kit são obrigatórios." })
    }

    const { captchaToken } = dados

    const respGoogle = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`,
      { method: "POST" }
    )
    const resultado = await respGoogle.json()

    if (!resultado.success) {
      return res.status(400).json({ erro: "Captcha inválido. Tenta novamente." })
    }

    const pdfBuffer = await gerarPDF(dados)
    await enviarEmail(pdfBuffer, dados)

    res.json({ sucesso: true })

  } catch (err) {
    console.error("[orçamento] erro:", err)
    res.status(500).json({ erro: "Erro ao gerar ou enviar o orçamento." })
  }

})

router.post("/download", async (req, res) => {

  try {

    const { kit, opcaoLabel, comprimentoTotal, textoOriginal, precoTotal } = req.body

    if (!kit) return res.status(400).json({ erro: "Kit em falta." })

    const dados = {
      opcaoLabel: opcaoLabel ?? "Lista",
      textoOriginal: textoOriginal ?? null,
      kit,
    }

    const pdfBuffer = await gerarPDFLista(dados)

    const nomeArq = `kit-${(opcaoLabel ?? "lista").toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.pdf`
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArq}"`)
    res.send(pdfBuffer)

  } catch (err) {
    console.error("[orçamento/download] erro:", err)
    res.status(500).json({ erro: "Erro ao gerar o PDF." })
  }

})

export default router
