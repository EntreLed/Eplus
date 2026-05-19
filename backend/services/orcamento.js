import PDFDocument from "pdfkit"
import nodemailer from "nodemailer"

function escaparHTML(str) {
  if (!str) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const VERDE = "#1f7a63"
const CINZA_LABEL = "#888888"
const CINZA_LINHA = "#e0e0e0"
const PRETO = "#111111"

function secao(doc, titulo) {
  doc.moveDown(0.8)
  doc.fillColor(VERDE).fontSize(11).font("Helvetica-Bold").text(titulo.toUpperCase())
  doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor(VERDE).lineWidth(1).stroke()
  doc.moveDown(0.6)
}

function linhaSeparadora(doc) {
  doc.moveDown(0.4)
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(CINZA_LINHA).lineWidth(0.5).stroke()
  doc.moveDown(0.4)
}

function peca(doc, label, nome, ref, precoTexto) {
  if (!nome) return

  doc.fillColor(CINZA_LABEL).fontSize(8).font("Helvetica-Bold").text(label.toUpperCase())

  const y = doc.y
  doc.fillColor(PRETO).fontSize(10).font("Helvetica").text(nome, 50, y, { width: 380 })

  if (precoTexto) {
    doc.fillColor(VERDE).fontSize(10).font("Helvetica-Bold")
       .text(precoTexto, 50, y, { width: 495, align: "right" })
  }

  if (ref) {
    doc.fillColor(CINZA_LABEL).fontSize(8).font("Helvetica").text(ref)
  }

  linhaSeparadora(doc)
}


export function gerarPDF(dados) {

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument({ margin: 50, size: "A4" })
    const buffers = []

    doc.on("data", chunk => buffers.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(buffers)))
    doc.on("error", reject)

    const { nome, localidade, empresa, telefone, email, opcaoLabel, comprimentoTotal, precoTotal, textoOriginal, kit } = dados

    doc.rect(50, 50, 495, 55).fill(VERDE)
    doc.fillColor("white").fontSize(20).font("Helvetica-Bold")
       .text("Orçamento configurador", 50, 65, { width: 495, align: "center" })
    doc.fillColor("white").fontSize(9).font("Helvetica")
       .text(`Emitido em: ${new Date().toLocaleDateString("pt-PT")}`, 50, 90, { width: 495, align: "center" })

    doc.y = 125

    secao(doc, "Dados do Cliente")

    doc.fillColor(PRETO).fontSize(10).font("Helvetica")
    doc.text(`Nome: ${nome}`)
    if (empresa) doc.text(`Empresa: ${empresa}`)
    if (localidade) doc.text(`Localidade: ${localidade}`)
    doc.text(`Telefone: ${telefone}`)
    doc.text(`E-mail: ${email}`)

    if (textoOriginal) {
      secao(doc, "Descrição do Projeto")
      doc.fillColor(PRETO).fontSize(10).font("Helvetica")
         .text(textoOriginal, { width: 495 })
      doc.moveDown(0.4)
    }


    const tituloConf =
      `Configuração — ${opcaoLabel} `

    secao(doc, tituloConf)

    // Fita LED
    const fitaPreco = kit.fita?.preco_metro != null 
      ? `${(Number(kit.fita.preco_metro) * comprimentoTotal).toFixed(2)} €`
      : kit.fita?.preco_metro != null
        ? `${Number(kit.fita.preco_metro).toFixed(2)} €/m`
        : null

    peca(doc, "Fita LED", kit.fita?.nome, kit.fita?.referencia, fitaPreco)

    // Perfil / Variante
    const varianteNome = kit.variante
      ? `${kit.perfil?.nome ?? "Perfil"} — ${kit.variante.acabamento}, ${kit.variante.dimensao_m}m`
      : kit.perfil?.nome ?? null

    const varianteRef = kit.variante?.referencia ?? kit.perfil?.referencia ?? null
    const variantePreco = kit.variante?.preco != null
      ? `${Number(kit.variante.preco).toFixed(2)} €`
      : null

    peca(doc, "Perfil / Variante", varianteNome, varianteRef, variantePreco)

    // Difusor
    const difusorNome = kit.difusor
      ? `${kit.difusor.difusor_nome}, ${kit.difusor.comprimento_m}m`
      : null

    const difusorPreco = kit.difusor?.preco != null
      ? `${Number(kit.difusor.preco).toFixed(2)} €`
      : null

    peca(doc, "Difusor", difusorNome, kit.difusor?.referencia, difusorPreco)

    // Controlador
    const ctrlPreco = kit.controlador?.preco != null
      ? `${Number(kit.controlador.preco).toFixed(2)} €`
      : null

    peca(doc, "Controlador", kit.controlador?.nome, kit.controlador?.referencia, ctrlPreco)

    // Fonte de Alimentação
    const fontePreco = kit.fonte?.preco != null
      ? `${Number(kit.fonte.preco).toFixed(2)} €`
      : null

    peca(doc, "Fonte de Alimentação", kit.fonte?.nome, kit.fonte?.referencia, fontePreco)

    // Comando
    const cmdPreco = kit.comando?.preco != null
      ? `${Number(kit.comando.preco).toFixed(2)} €`
      : null

    peca(doc, "Comando", kit.comando?.nome, kit.comando?.referencia, cmdPreco)

    doc.moveDown(0.5)
    doc.rect(50, doc.y, 495, 36).fill("#edf7f3")
    doc.moveDown(0.3)
    doc.fillColor(VERDE).fontSize(14).font("Helvetica-Bold")
       .text(`Total estimado: ${Number(precoTotal).toFixed(2)} €`, 50, doc.y - 2, { width: 485, align: "right" })

    doc.moveDown(2)

    doc.fillColor(CINZA_LABEL).fontSize(8).font("Helvetica")
       .text("Os preços são meramente indicativos e estão sujeitos a alteração.", { align: "center" })
       .text("Orçamento gerado automaticamente pelo Configurador IA.", { align: "center" })

    doc.end()

  })

}


export function gerarPDFLista(dados) {

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument({ margin: 50, size: "A4" })
    const buffers = []

    doc.on("data", chunk => buffers.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(buffers)))
    doc.on("error", reject)

    const { opcaoLabel, textoOriginal, kit } = dados

    doc.rect(50, 50, 495, 55).fill(VERDE)
    doc.fillColor("white").fontSize(20).font("Helvetica-Bold")
       .text("Lista de Materiais do configurador", 50, 65, { width: 495, align: "center" })
    doc.fillColor("white").fontSize(9).font("Helvetica")
       .text(`Gerado em: ${new Date().toLocaleDateString("pt-PT")}`, 50, 90, { width: 495, align: "center" })

    doc.y = 125

    secao(doc, "Categoria")
    doc.fillColor(PRETO).fontSize(12).font("Helvetica-Bold").text(opcaoLabel)
    doc.moveDown(0.4)

    if (textoOriginal) {
      secao(doc, "Descrição do Projeto")
      doc.fillColor(PRETO).fontSize(10).font("Helvetica")
         .text(textoOriginal, { width: 495 })
      doc.moveDown(0.4)
    }

    secao(doc, "Lista de Materiais")

    const itens = [
      { label: "Fita LED", nome: kit.fita?.nome, ref: kit.fita?.referencia },
      { label: "Perfil", nome: kit.perfil?.nome, ref: kit.perfil?.referencia },
      { label: "Controlador", nome: kit.controlador?.aviso ? null : kit.controlador?.nome, ref: kit.controlador?.referencia },
      { label: "Fonte de Alimentação", nome: kit.fonte?.nome, ref: kit.fonte?.referencia },
      { label: "Comando", nome: kit.comando?.nome, ref: kit.comando?.referencia },
    ].filter(i => i.nome)

    for (const item of itens) {
      doc.fillColor(CINZA_LABEL).fontSize(8).font("Helvetica-Bold").text(item.label.toUpperCase())
      doc.fillColor(PRETO).fontSize(10).font("Helvetica").text(item.nome)
      if (item.ref) {
        doc.fillColor(CINZA_LABEL).fontSize(8).font("Helvetica").text(item.ref)
      }
      linhaSeparadora(doc)
    }

    if (kit.controlador?.aviso) {
      doc.moveDown(0.4)
      doc.fillColor(CINZA_LABEL).fontSize(9).font("Helvetica-Bold").text("CONTROLADOR")
      doc.fillColor("#b45309").fontSize(9).font("Helvetica").text(kit.controlador.aviso)
      linhaSeparadora(doc)
    }

    doc.moveDown(2)
    doc.fillColor(CINZA_LABEL).fontSize(8).font("Helvetica")
       .text("Lista gerada automaticamente pelo Configurador IA.", { align: "center" })

    doc.end()

  })

}


export async function enviarEmail(pdfBuffer, dados) {

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  const data = new Date().toLocaleDateString("pt-PT")
  const nomeArq = `orcamento-${dados.nome.replace(/\s+/g, "-")}-${Date.now()}.pdf`

  await transporter.sendMail({
    from: `"Configurador LED" <${process.env.SMTP_USER}>`,
    to: process.env.ORCAMENTO_EMAIL,
    subject: `Pedido de orçamento — ${dados.nome} — ${data}`,
    html: `
      <p>Foi recebido um novo pedido de orçamento.</p>
      <table cellpadding="6" style="border-collapse:collapse; font-family:sans-serif; font-size:14px;">
        <tr><td><strong>Nome</strong></td><td>${escaparHTML(dados.nome)}</td></tr>
        <tr><td><strong>Empresa</strong></td><td>${escaparHTML(dados.empresa) || "—"}</td></tr>
        <tr><td><strong>Localidade</strong></td><td>${escaparHTML(dados.localidade) || "—"}</td></tr>
        <tr><td><strong>Telefone</strong></td><td>${escaparHTML(dados.telefone)}</td></tr>
        <tr><td><strong>E-mail</strong></td><td>${escaparHTML(dados.email)}</td></tr>
        <tr><td><strong>Opção</strong></td><td>${escaparHTML(dados.opcaoLabel)}</td></tr>
        <tr><td><strong>Total estimado</strong></td><td>${Number(dados.precoTotal).toFixed(2)} €</td></tr>
      </table>
      <p>O orçamento detalhado segue em anexo.</p>
    `,
    attachments: [{
      filename: nomeArq,
      content: pdfBuffer,
      contentType: "application/pdf",
    }],
  })

}
