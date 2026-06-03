import "dotenv/config"
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { rateLimit } from "express-rate-limit"

import authRoutes from "./routes/auth.js"

import OpenAI from "openai"

import produtoRoutes from "./routes/produto.js"
import perfisRoutes from "./routes/perfis.js"
import fitasLedRoutes from "./routes/fitas_led.js"
import neonRoutes from "./routes/neon.js"
import configuradorRoutes from "./routes/configurador.js"
import utilizadoresRoutes from "./routes/utilizadores.js"
import { controladorRouter, comandoRouter, kitRouter} from "./routes/controladores.js"
import powerRoutes from "./routes/fontes_alimentacao.js"
import acessoriosRoutes from "./routes/acessorios.js"
import orcamentoRoutes from "./routes/orcamento.js"
import logsRoutes from "./routes/logs.js"

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: "50kb" }))

app.use("/api/auth", authRoutes)

app.use("/images", express.static("images"))

app.use("/api/produto", produtoRoutes)
app.use("/api/perfis", perfisRoutes)
app.use("/api/fitas_led", fitasLedRoutes)
app.use("/api/neon", neonRoutes)

app.use("/api/controladores", controladorRouter)
app.use("/api/comandos", comandoRouter)
app.use("/api/kits", kitRouter)
app.use("/api/power", powerRoutes)
app.use("/api/acessorios", acessoriosRoutes)

app.use("/api/configurador", configuradorRoutes)
app.use("/api/orcamento", orcamentoRoutes)

app.use("/api/utilizadores", utilizadoresRoutes)
app.use("/api/logs", logsRoutes)

app.get("/", (req,res)=>{
  res.json({message:"Backend a funcionar"})
})

const mistral = new OpenAI({
  baseURL: "https://api.mistral.ai/v1",
  apiKey: process.env.MISTRAL_API_KEY,
})

const limitarIA = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados pedidos. Tente novamente mais tarde." },
})

app.post("/api/interpretar", limitarIA, async (req,res)=>{
    try{

      const { texto } = req.body

      const prompt = `
      És um extrator de dados técnicos para iluminação LED. Preenches o JSON com o que está no texto. Campo não mencionado → null. Nunca inventas, calculas nem deduzes.

      REGRAS:
      1. Campo não mencionado → null.
      2. Nunca preenchas comprimento_m E dimensoes ao mesmo tempo.
      3. Ambiguidade → null.

      tipo_projeto: "fita_perfil"(padrão) | "neon"(menciona NEON/néon) | "multi_zona"(2+ locais DISTINTOS, ex: sala E quarto)
      IMPORTANTE: vários retângulos ou secções no MESMO espaço/projeto → tipo_projeto:"fita_perfil" com tipo_calculo:"perimetro_retangulos" (NÃO é multi_zona)

      comprimento:
      - metros diretos → comprimento_m:X, tipo_calculo:null, dimensoes:null
      - retângulo (AxB) → tipo_calculo:"perimetro_retangulo", dimensoes:{largura,comprimento}
      - múltiplos retângulos no mesmo projeto → tipo_calculo:"perimetro_retangulos", dimensoes:{retangulos:[{largura,comprimento},{largura,comprimento},...]}
      - área m² → tipo_calculo:"perimetro_sala", dimensoes:{area_m2,altura_teto_m}
      - unidades×metros → tipo_calculo:"multiplicacao", dimensoes:{unidades,comprimento_por_unidade_m}

      tipo_cor (exato ou null):
      "MONO" → branco fixo, luz branca, branco quente/frio, branco simples
      "CCT" → branco ajustável, dual white, temperatura ajustável, valor Kelvin isolado (ex:3000K)
      "RGB" → RGB sem branco (cores apenas, sem canal branco)
      "RGBW" → RGB com branco fixo, RGBW, RGB+W, RGB e branco, 4 canais com branco
      "RGB_CCT" → RGB com branco ajustável, RGB+CCT, 5 canais
      "DIGITAL" → fita digital/endereçável, LEDs individuais controláveis, efeitos de movimento, escadaria com sensor, efeito persiana, animações
      null → não mencionado | "luz indireta","ambiente agradável" → null
      IMPORTANTE: se o utilizador menciona um kit por nome (ex: "kit EASY RGBW"), NÃO inferir tipo_cor a partir do nome do kit — tipo_cor só é preenchido se o utilizador descrever explicitamente a cor da fita que quer.

      ip_minimo (número ou null):
      20 → sala,quarto,corredor,escritório,cozinha seca,teto,sanca,loja,armazém
      44 → casa de banho,wc,duche,cozinha húmida
      54 → varanda coberta,marquise
      65 → exterior,jardim,fachada,terraço,piscina(borda)
      67 → fonte,lago,espelho de água
      68 → dentro da piscina,submerso
      null → ambiente não mencionado

      tipo_instalacao (exato ou null — APENAS um destes valores exatos, nunca outro):
      "superficie" → aplicado,sobreposto,na parede,no teto,rodapé,parapeito,prateleira,móvel,armário,estante,dentro do móvel
      "suspensão" → suspenso,pendente,pendurado
      "canto" → canto,esquina
      "encastrar" → encastrado,embutido,rebaixado,SANCA,teto falso,teto rebaixado,teto de gesso,iluminação indireta de teto
      "pladur" → pladur,gesso cartonado,teto falso(material)
      "escada" → escada,degrau
      "cerâmicos" → cerâmica,azulejo
      null → não mencionado
      NUNCA escrevas "sanca" — quando o utilizador menciona sanca, o valor correto é sempre "encastrar".
      NUNCA uses "movel" em tipo_instalacao — "movel" só existe em tipo_fonte.

      tipo_controlo (exato ou null):
      "RF" → telecomando RF,comando rádio
      "PUSH-DIM" → botão dimmer,push-dim
      "GATEWAY" → wifi,app,smarthome,temporizador,bluetooth
      "PLUG IN" → ficha,tomada
      null → não mencionado

      tipo_sinal (exato ou null):
      "PIR sensor" → sensor de movimento/presença,quando passo,acende ao passar,deteta movimento
      null → não mencionado

      sem_pontos_visiveis (true ou null):
      true → "sem pontos visíveis","luz contínua","ECOB","fita contínua sem pontos"
      null → não mencionado

      cri_minimo (número ou null):
      90 → "CRI alto","rigor de cor","sala de cirurgia","museu","atelier"
      80 → "CRI bom","loja de roupa","exposição"
      null → não mencionado

      perfil_largura_max_mm (número ou null):
      número → utilizador menciona largura máxima do perfil, ex: "perfil que caiba em 20mm","rebaixo de 15mm de largura"
      null → não mencionado

      perfil_altura_max_mm (número ou null):
      número → utilizador menciona altura/profundidade máxima do perfil, ex: "perfil com menos de 10mm de altura","sanca com 8mm de profundidade"
      null → não mencionado

      sem_fonte (true ou null):
      true → "sem fonte","driver","sem espaço para fonte","não quer fonte","sem alimentação externa","driver AC","fonte integrada"
      null → não mencionado | mencionar voltagem ("24V","12V","alimentado a 24Vdc") NÃO implica sem_fonte — é apenas a tensão de alimentação

      num_fitas_paralelas (número ou null):
      número → utilizador menciona múltiplas fitas ligadas ao mesmo controlador em paralelo, ex: "3 fitas","4 canais","2 fitas no mesmo controlador"
      2 → cenário de corredor/rampa/caminho com fita nos DOIS LADOS paralelos: "cada lado","ambos os lados","dos dois lados","de cada lado","delinear o caminho" quando implica fita em dois lados paralelos
      ATENÇÃO: quando num_fitas_paralelas=2 por ser corredor/rampa, comprimento_m deve ser o comprimento DE UM SÓ LADO (ex: "7 metros de cada lado" → comprimento_m:7, num_fitas_paralelas:2). NUNCA usar tipo_calculo:"perimetro_retangulo" neste caso.
      null → não mencionado | uma única fita → null

      tipo_controlo_parede (true ou null):
      true → "interruptor","botão na parede","controlo pela parede","panel","painel","wall panel","wall controller"
      null → não mencionado

      tipo_fonte (exato ou null):
      "movel" → prateleira,móvel,armário,estante,gaveta,rack de madeira,imobiliário,dentro do móvel,interior do móvel
      "quadro" → quadro elétrico,painel elétrico,calha DIN,din rail,quadro técnico,caixa elétrica
      null → não mencionado | equipamento industrial/comercial (arca frigorífica,frigorífico,vitrina,máquina) → null

      subtipo_neon (exato ou null — apenas quando tipo_projeto="neon"):
      "360" → mangueira,iluminação 360,neon 360,360 graus,ângulo 360,iluminação em redor,luz à volta
      "long" → neon long,neon comprido,NEON-LONG,variante long
      null → não mencionado | neon genérico sem subtipo

      pecas_especificadas → preenche apenas o que o utilizador nomeia explicitamente:
      referencia_fita → nome ou referência da fita mencionada
      referencia_neon → nome ou referência de produto neon mencionado (apenas quando tipo_projeto="neon")
      referencia_perfil → nome ou referência do perfil mencionado
      referencia_controlador → nome ou referência de controlador/receiver standalone mencionado
      referencia_kit → nome ou referência de kit (receiver+remote vendido junto) mencionado
      referencia_comando → nome ou referência de comando/telecomando/panel específico mencionado

      RESPOSTA: apenas JSON puro, sem markdown.
      {"tipo_projeto":null,"zonas":[{"descricao":null,"comprimento_m":null,"tipo_calculo":null,"dimensoes":null,"tipo_cor":null,"temperatura_cor_k":null,"tipo_instalacao":null,"ambiente":null,"ip_minimo":null,"tensao_v":null,"potencia_w_m":null,"tipo_controlo":null,"tipo_sinal":null,"dimavel":null,"sem_pontos_visiveis":null,"cri_minimo":null,"secoes":null,"num_fontes":null,"comprimento_max_segmento_m":null,"perfil_largura_max_mm":null,"perfil_altura_max_mm":null,"sem_fonte":null,"num_fitas_paralelas":null,"tipo_controlo_parede":null,"tipo_fonte":null,"subtipo_neon":null,"pecas_especificadas":{"referencia_fita":null,"referencia_neon":null,"referencia_perfil":null,"referencia_controlador":null,"referencia_kit":null,"referencia_comando":null}}]}

      EXEMPLOS:

      Texto: "Sala com fita rgbw, parede de 10m."
      {"tipo_projeto":"fita_perfil","zonas":[{"descricao":"sala","comprimento_m":10,"tipo_calculo":null,"dimensoes":null,"tipo_cor":"RGBW","temperatura_cor_k":null,"tipo_instalacao":null,"ambiente":"sala","ip_minimo":20,"tensao_v":null,"potencia_w_m":null,"tipo_controlo":null,"dimavel":null,"secoes":null,"num_fontes":null,"comprimento_max_segmento_m":null,"pecas_especificadas":{"referencia_fita":null,"referencia_perfil":null,"referencia_controlador":null}}]}

      Texto: "Sala de 40m2, altura do teto 2.8m."
      {"tipo_projeto":"fita_perfil","zonas":[{"descricao":"sala","comprimento_m":null,"tipo_calculo":"perimetro_sala","dimensoes":{"area_m2":40,"altura_teto_m":2.8},"tipo_cor":null,"temperatura_cor_k":null,"tipo_instalacao":null,"ambiente":"sala","ip_minimo":20,"tensao_v":null,"potencia_w_m":null,"tipo_controlo":null,"dimavel":null,"secoes":null,"num_fontes":null,"comprimento_max_segmento_m":null,"pecas_especificadas":{"referencia_fita":null,"referencia_perfil":null,"referencia_controlador":null}}]}

      Texto: "Parede jardim 22m e piscina 4x8m à volta."
      {"tipo_projeto":"multi_zona","zonas":[{"descricao":"parede jardim","comprimento_m":22,"tipo_calculo":null,"dimensoes":null,"tipo_cor":null,"temperatura_cor_k":null,"tipo_instalacao":null,"ambiente":"jardim","ip_minimo":65,"tensao_v":null,"potencia_w_m":null,"tipo_controlo":null,"dimavel":null,"secoes":null,"num_fontes":null,"comprimento_max_segmento_m":null,"pecas_especificadas":{"referencia_fita":null,"referencia_perfil":null,"referencia_controlador":null}},{"descricao":"piscina","comprimento_m":null,"tipo_calculo":"perimetro_retangulo","dimensoes":{"largura":4,"comprimento":8},"tipo_cor":null,"temperatura_cor_k":null,"tipo_instalacao":null,"ambiente":"piscina","ip_minimo":65,"tensao_v":null,"potencia_w_m":null,"tipo_controlo":null,"dimavel":null,"secoes":null,"num_fontes":null,"comprimento_max_segmento_m":null,"pecas_especificadas":{"referencia_fita":null,"referencia_perfil":null,"referencia_controlador":null}}]}

      Texto: "Fita SL2-RGB-24V-14W em perfil encastrado, teto cozinha, 8m, controlador RF."
      {"tipo_projeto":"fita_perfil","zonas":[{"descricao":"teto cozinha","comprimento_m":8,"tipo_calculo":null,"dimensoes":null,"tipo_cor":"RGB","temperatura_cor_k":null,"tipo_instalacao":"encastrar","ambiente":"cozinha","ip_minimo":20,"tensao_v":24,"potencia_w_m":14,"tipo_controlo":"RF","dimavel":null,"secoes":null,"num_fontes":null,"comprimento_max_segmento_m":null,"pecas_especificadas":{"referencia_fita":"SL2-RGB-24V-14W","referencia_perfil":null,"referencia_controlador":null}}]}

      Texto: "Sala com sanca em todo o perímetro, fita LED branca quente."
      {"tipo_projeto":"fita_perfil","zonas":[{"descricao":"sanca sala","comprimento_m":null,"tipo_calculo":"perimetro_sala","dimensoes":null,"tipo_cor":"MONO","temperatura_cor_k":null,"tipo_instalacao":"encastrar","ambiente":"sala","ip_minimo":20,"tensao_v":null,"potencia_w_m":null,"tipo_controlo":null,"dimavel":null,"secoes":null,"num_fontes":null,"comprimento_max_segmento_m":null,"pecas_especificadas":{"referencia_fita":null,"referencia_neon":null,"referencia_perfil":null,"referencia_controlador":null,"referencia_kit":null,"referencia_comando":null}}]}

      Texto: "Rampa de entrada com 7 metros de cada lado, exterior."
      {"tipo_projeto":"fita_perfil","zonas":[{"descricao":"rampa entrada","comprimento_m":7,"tipo_calculo":null,"dimensoes":null,"tipo_cor":null,"temperatura_cor_k":null,"tipo_instalacao":"superficie","ambiente":"exterior","ip_minimo":65,"tensao_v":null,"potencia_w_m":null,"tipo_controlo":null,"dimavel":null,"secoes":null,"num_fontes":null,"comprimento_max_segmento_m":null,"sem_fonte":null,"num_fitas_paralelas":2,"tipo_controlo_parede":null,"tipo_fonte":null,"subtipo_neon":null,"pecas_especificadas":{"referencia_fita":null,"referencia_neon":null,"referencia_perfil":null,"referencia_controlador":null,"referencia_kit":null,"referencia_comando":null}}]}

      TEXTO: ${texto}
      `


      const result = await mistral.chat.completions.create({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
      })

      let resposta = result.choices[0].message.content

      const inicio = resposta.indexOf("{")
      const fim = resposta.lastIndexOf("}") + 1

      const jsonString = resposta.slice(inicio, fim)

      const json = JSON.parse(jsonString)

      res.json(json)

    }catch(error){

      console.error(error)

      res.status(500).json({
        error:"Erro na IA"
      })

    }

  })

const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{
  console.log(`Servidor a correr na porta ${PORT}`)
})



