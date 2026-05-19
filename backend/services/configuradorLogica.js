import { pool } from "../db.js"

const log = (...args) => process.env.NODE_ENV !== "production" && console.log(...args)

//Converte uma string de pesquisa num padrão ILIKE
function likeFlexivel(str) {
  return "%" + str.trim().replace(/[\s-]+/g, "%") + "%"
}

// Compara duas strings ignorando diferenças entre espaços e hífens.
// "EASY RGBW" === "EASY-RGBW" === "EASY_RGBW" após normalização.
function matchFlexivel(str, termo) {
  const norm = s => s.toUpperCase().replace(/[\s_-]+/g, "")
  return norm(str).includes(norm(termo))
}


// Se o utilizador especificou um produto concreto, vai à BD buscar as propriedades
// técnicas reais (voltagem, tipo de instalação, etc.) para que os filtros seguintes
// funcionem corretamente com esse produto.
async function derivarConstraints(zona) {

  const constraints = { ...zona }
  const pec = zona.pecas_especificadas || {}

  // Kit especificado → voltagem DC de saída do receiver do kit
  if (pec.referencia_kit && !constraints.tensao_v) {
    const { rows } = await pool.query(`
      SELECT lp.voltagem
      FROM kits_controladores kc
      JOIN produtos kp ON kp.produto_id = kc.produto_id
      JOIN controladores c ON c.controlador_id = kc.controlador_id
      JOIN limites_potencia_controladores lp ON lp.controlador_id = c.controlador_id
      WHERE kp.ativo = TRUE
      AND (kp.referencia ILIKE $1 OR kp.nome ILIKE $1)
      AND lp.voltagem IS NOT NULL
      ORDER BY lp.voltagem
      LIMIT 1
    `, [likeFlexivel(pec.referencia_kit)])
    if (rows[0]?.voltagem) constraints.tensao_v = rows[0].voltagem
  }

  // Neon especificado → voltagem da versão do neon
  if (pec.referencia_neon && !constraints.tensao_v) {
    const { rows } = await pool.query(`
      SELECT vn.voltagem_v
      FROM modelos_neon mn
      JOIN produtos p ON p.produto_id = mn.produto_id
      JOIN versoes_neon vn ON vn.modelo_neon_id = mn.modelo_neon_id
      WHERE p.ativo = TRUE
      AND (p.referencia ILIKE $1 OR p.nome ILIKE $1)
      LIMIT 1
    `, [likeFlexivel(pec.referencia_neon)])
    if (rows[0]?.voltagem_v) constraints.tensao_v = rows[0].voltagem_v
  }

  // Fita especificada → voltagem da versão da fita
  if (pec.referencia_fita && !constraints.tensao_v) {
    const { rows } = await pool.query(`
      SELECT v.voltagem_v
      FROM fitas_led f
      JOIN produtos p ON p.produto_id = f.produto_id
      JOIN versoes_fitas_led v ON v.fita_led_id = f.fita_led_id
      WHERE p.ativo = TRUE
      AND (p.referencia ILIKE $1 OR p.nome ILIKE $1)
      LIMIT 1
    `, [likeFlexivel(pec.referencia_fita)])
    if (rows[0]?.voltagem_v) constraints.tensao_v = rows[0].voltagem_v
  }

  // Controlador standalone especificado → voltagem DC de saída do controlador
  // Só deriva tensao_v se o controlador tiver exatamente uma voltagem — se tiver várias,
  // é multi-voltagem e não se deve forçar nenhuma (deixar buscarFitas sem filtro de tensão)
  if (pec.referencia_controlador && !constraints.tensao_v) {
    const { rows } = await pool.query(`
      SELECT lp.voltagem
      FROM controladores c
      JOIN produtos p ON p.produto_id = c.produto_id
      JOIN limites_potencia_controladores lp ON lp.controlador_id = c.controlador_id
      WHERE p.ativo = TRUE
      AND (p.referencia ILIKE $1 OR p.nome ILIKE $1)
      AND lp.voltagem IS NOT NULL
    `, [likeFlexivel(pec.referencia_controlador)])
    if (rows.length === 1) constraints.tensao_v = rows[0].voltagem
  }

  // Perfil especificado → derivar tipo_instalacao se não estiver definido,
  // para que o scoring e os filtros posteriores já saibam o tipo de instalação
  if (pec.referencia_perfil && !constraints.tipo_instalacao) {
    const { rows } = await pool.query(`
      SELECT ARRAY_AGG(DISTINCT ti.nome) FILTER (WHERE ti.nome IS NOT NULL) AS tipos_instalacao
      FROM perfis pf
      JOIN produtos p ON p.produto_id = pf.produto_id
      LEFT JOIN perfil_instalacoes pi ON pi.perfil_id = pf.perfil_id
      LEFT JOIN tipos_instalacao ti ON ti.tipo_instalacao_id = pi.tipo_instalacao_id
      WHERE p.ativo = TRUE
      AND (p.referencia ILIKE $1 OR p.nome ILIKE $1)
      GROUP BY pf.perfil_id
      LIMIT 1
    `, [likeFlexivel(pec.referencia_perfil)])
    if (rows[0]?.tipos_instalacao?.[0]) {
      constraints.tipo_instalacao = rows[0].tipos_instalacao[0]
    }
  }

  return constraints

}


export async function buscarPerfisCandidatos(fita, zona) {
  const zonaLimpa = {
    ...zona,
    pecas_especificadas: {
      ...(zona?.pecas_especificadas || {}),
      referencia_perfil: undefined
    }
  }
  return buscarPerfis([fita], zonaLimpa)
}

export async function configurar(dados) {

  try {

    const tipo_projeto = dados?.tipo_projeto || "fita_perfil"
    const zonas = dados?.zonas || []

    if (zonas.length === 0) {
      return { erro: "Nenhuma zona recebida." }
    }

    if (tipo_projeto === "multi_zona" || zonas.length > 1) {
      return { erro: "O configurador processa uma zona de cada vez. Por favor descreva apenas um espaço ou zona por pedido (ex: só a sala, só o corredor)." }
    }

    const zona = zonas[0]

    // Regra de negócio: escada → Receiver 008 obrigatório (a menos que o utilizador especifique outro)
    if (zona.tipo_instalacao === "escada" && !zona.pecas_especificadas?.referencia_controlador) {
      zona.pecas_especificadas = { ...(zona.pecas_especificadas || {}), referencia_controlador: "ECT-RECEIVER-008" }
    }

    const pec = zona.pecas_especificadas || {}
    const temPeca = Object.values(pec).some(v => v != null)
    const zonaVazia =
      zona.comprimento_m == null &&
      zona.tipo_calculo == null &&
      zona.tensao_v == null &&
      zona.tipo_cor == null &&
      zona.secoes == null &&
      zona.subtipo_neon == null &&
      zona.tipo_instalacao == null &&
      zona.tipo_controlo == null &&
      !temPeca
    if (zonaVazia)
      return { erro: "Não foi possível interpretar o texto introduzido. Por favor descreva o projeto com mais detalhe (ex: comprimento, tipo de espaço, cor de luz)." }

    const textoDescricao = ((zona.descricao || "") + " " + (zona.ambiente || "")).toLowerCase()
    const palavrasPublicidade = ["publicidade", "publicitário", "publicitária", "reclamo", "reclamos", "sign", "sinal luminoso", "sinais luminosos", "letreiro", "lightbox", "caixa de luz", "caixa luminosa"]
    if (palavrasPublicidade.some(p => textoDescricao.includes(p)))
      return { erro: "Temos uma gama de Sign mas não consta neste configurador." }

    const resultado = tipo_projeto === "neon"
      ? await kitNeon(zona)
      : await kitFitaPerfil(zona)

    if (!resultado) return { resultados: [] }

    const resposta = { resultados: [resultado] }

    // Log silencioso — nunca bloqueia a resposta
    try {
      const textoPrompt = dados.texto_original || null
      if (textoPrompt) {
        await pool.query(
          "INSERT INTO logs_prompts_configurador (texto_prompt) VALUES ($1)",
          [textoPrompt]
        )
      }
    } catch (_) {}

    return resposta

  } catch (err) {
    console.error("[configurador] erro inesperado:", err)
    return { erro: "Erro interno do configurador." }
  }

}


async function kitFitaPerfil(zona) {

  try {

    const comprimentoTotal = calcularComprimento(zona)
    const comprimentoMax = calcularComprimentoMax(zona)

    const constraints = await derivarConstraints(zona)
    log("[configurador] constraints derivados:", JSON.stringify({
      tensao_v: constraints.tensao_v,
      tipo_instalacao: constraints.tipo_instalacao,
      ip_minimo: constraints.ip_minimo,
      pecas: constraints.pecas_especificadas,
    }))

    const fitas = await buscarFitas(constraints)
    log("[configurador] fitas encontradas:", fitas.length, fitas.map(f => `${f.referencia} ${f.voltagem_v}V`))

    if (fitas.length === 0)
      return { erro: "Não foi encontrada nenhuma fita LED compatível com os requisitos pedidos." }

    const semFonte = constraints.sem_fonte === true
    const semControlador = constraints.sem_controlador === true

    const comandosPrimeiro = semControlador ? [] : await buscarComandosPrimeiro(constraints)
    const controladorIdsFromComandos = comandosPrimeiro.length > 0
      ? [...new Set(comandosPrimeiro.flatMap(c => c.controladores_compativeis || []).filter(Boolean))]
      : null

    const [perfis, controladores, kitsCtrl] = await Promise.all([
      buscarPerfis(fitas, constraints),
      semControlador ? Promise.resolve([]) : buscarControladores(fitas, constraints, comprimentoMax, controladorIdsFromComandos),
      semControlador ? Promise.resolve([]) : buscarKits(fitas, constraints, comprimentoMax, controladorIdsFromComandos)
    ])

    let fontesMap = null
    if (!semFonte) {
      log(`\n=== [FONTES-INDIVIDUAL] iniciando pesquisa individual para ${fitas.length} fita(s) ===`)
      const resultados = await Promise.all(fitas.map(f => buscarFontes(f, comprimentoMax, constraints)))
      fontesMap = new Map(fitas.map((f, i) => [f.fita_led_id ?? f.produto_id, resultados[i]]))
      const totalFontes = resultados.reduce((s, a) => s + a.length, 0)
      log(`=== [FONTES-INDIVIDUAL] resumo: ${fitas.length} fita(s) pesquisadas | total fontes candidatas: ${totalFontes} | por fita: ${fitas.map((f, i) => `${f.referencia}→${resultados[i].length}`).join(", ")} ===\n`)
    }

    log("[configurador] perfis encontrados:", perfis.length, perfis.map(p => p.referencia))
    log("[configurador] controladores:", controladores.length, "| kitsCtrl:", kitsCtrl.length, kitsCtrl.map(k => k.nome))

    const avisoControlador = semControlador
      ? null
      : (controladores.length === 0 && kitsCtrl.length === 0)
        ? "Precisamos de mais detalhes sobre o seu projeto para lhe oferecer um controlador compatível"
        : null

    if (!semFonte && fontesMap !== null && [...fontesMap.values()].every(arr => arr.length === 0))
      return { erro: "Não foi encontrada nenhuma fonte de alimentação compatível com a fita encontrada." }

    const comandos = semControlador ? [] : await buscarComandos(controladores)

    const opcoes = escolher3Kits(fitas, perfis, controladores, fontesMap, comandos, kitsCtrl, constraints, comprimentoMax, comprimentoTotal, avisoControlador, semControlador)
    log("[configurador] opcoes finais:", opcoes ? Object.keys(opcoes).map(k => `${k}: ${opcoes[k]?.controlador?.nome}`) : null)

    if (!opcoes) {
      if (perfis.length > 0)
        return { erro: "Não existe nenhum perfil no catálogo com capacidade suficiente para a fita encontrada no tipo de instalação pedido." }
      return { erro: "Não foi possível gerar uma sugestão com os produtos disponíveis." }
    }

    return {
      comprimento_total_m: comprimentoTotal,
      opcoes
    }

  } catch (err) {
    console.error("[kitFitaPerfil] erro:", err)
    return null
  }

}


async function kitNeon(zona) {

  try {

    const comprimentoTotal = calcularComprimento(zona)
    const comprimentoMax = calcularComprimentoMax(zona)

    const constraints = await derivarConstraints(zona)
    log("[configurador-neon] constraints derivados:", JSON.stringify({
      tensao_v: constraints.tensao_v,
      ip_minimo: constraints.ip_minimo,
      pecas: constraints.pecas_especificadas,
    }))

    const neons = await buscarNeons(constraints)
    log("[configurador-neon] neons encontrados:", neons.length, neons.map(n => `${n.referencia} ${n.voltagem_v}V`))

    if (neons.length === 0)
      return { erro: "Não foi encontrado nenhum produto NEON compatível com os requisitos pedidos." }

    const semFonte = constraints.sem_fonte === true
    const semControlador = constraints.sem_controlador === true

    const comandosPrimeiro = semControlador ? [] : await buscarComandosPrimeiro(constraints)
    const controladorIdsFromComandos = comandosPrimeiro.length > 0
      ? [...new Set(comandosPrimeiro.flatMap(c => c.controladores_compativeis || []).filter(Boolean))]
      : null

    // Neon não tem perfil — não chamar buscarPerfis
    const [controladores, kitsCtrl] = await Promise.all([
      semControlador ? Promise.resolve([]) : buscarControladores(neons, constraints, comprimentoMax, controladorIdsFromComandos),
      semControlador ? Promise.resolve([]) : buscarKits(neons, constraints, comprimentoMax, controladorIdsFromComandos)
    ])

    let fontesMap = null
    if (!semFonte) {
      log(`\n=== [FONTES-INDIVIDUAL] iniciando pesquisa individual para ${neons.length} neon(s) ===`)
      const resultados = await Promise.all(neons.map(f => buscarFontes(f, comprimentoMax, constraints)))
      fontesMap = new Map(neons.map((f, i) => [f.fita_led_id ?? f.produto_id, resultados[i]]))
      const totalFontes = resultados.reduce((s, a) => s + a.length, 0)
      log(`=== [FONTES-INDIVIDUAL] resumo: ${neons.length} neon(s) pesquisados | total fontes candidatas: ${totalFontes} | por neon: ${neons.map((f, i) => `${f.referencia}→${resultados[i].length}`).join(", ")} ===\n`)
    }

    log("[configurador-neon] controladores:", controladores.length, "| kitsCtrl:", kitsCtrl.length)

    const avisoControlador = semControlador
      ? null
      : (controladores.length === 0 && kitsCtrl.length === 0)
        ? "Precisamos de mais detalhes sobre o seu projeto para lhe oferecer um controlador compatível"
        : null

    if (!semFonte && fontesMap !== null && [...fontesMap.values()].every(arr => arr.length === 0))
      return { erro: "Não foi encontrada nenhuma fonte de alimentação compatível com o NEON encontrado." }

    const comandos = semControlador ? [] : await buscarComandos(controladores)

    // Perfis sempre vazios — escolher3Kits trata perfil null naturalmente
    const opcoes = escolher3Kits(neons, [], controladores, fontesMap, comandos, kitsCtrl, constraints, comprimentoMax, comprimentoTotal, avisoControlador, semControlador)
    log("[configurador-neon] opcoes finais:", opcoes ? Object.keys(opcoes).map(k => `${k}: ${opcoes[k]?.controlador?.nome}`) : null)

    if (!opcoes)
      return { erro: "Não foi possível gerar uma sugestão com os produtos NEON disponíveis." }

    return {
      comprimento_total_m: comprimentoTotal,
      opcoes
    }

  } catch (err) {
    console.error("[kitNeon] erro:", err)
    return null
  }

}


async function buscarNeons(zona) {

  const condicoes = ["p.ativo = TRUE", "vn.ativo = TRUE", "var.ativo = TRUE"]
  const params = []
  let i = 1

  if (zona.ip_minimo) {
     if (zona.ip_minimo <= 20) {
       condicoes.push(`(vn.ip IS NULL OR vn.ip >= $${i++})`)
     } else {
       condicoes.push(`vn.ip >= $${i++}`)
     }
     params.push(zona.ip_minimo)
   }

  // se o neon foi especificado pelo nome, o tipo_cor pode já ter sido deduzido — não filtrar
  if (zona.tipo_cor && !zona.pecas_especificadas?.referencia_neon) {
    const tc = zona.tipo_cor.toUpperCase()
    if (tc === "MONO") {
      condicoes.push(`(var.tipo_cor IS NULL OR (var.tipo_cor ILIKE '%W%' AND var.tipo_cor NOT ILIKE '%RGB%' AND var.tipo_cor NOT ILIKE '%CCT%'))`)
    } else if (tc === "CCT") {
      condicoes.push(`(var.tipo_cor ILIKE '%CCT%' AND var.tipo_cor NOT ILIKE '%RGB%')`)
    } else if (tc === "RGB") {
      condicoes.push(`(var.tipo_cor ILIKE '%RGB%' AND var.tipo_cor NOT ILIKE '%W%' AND var.tipo_cor NOT ILIKE '%CCT%')`)
    } else if (tc === "RGBW") {
      condicoes.push(`(var.tipo_cor ILIKE '%RGB%' AND var.tipo_cor ILIKE '%W%')`)
    } else if (tc === "RGB_CCT") {
      condicoes.push(`(var.tipo_cor ILIKE '%RGB%' AND var.tipo_cor ILIKE '%CCT%')`)
    } else if (tc === "DIGITAL") {
      condicoes.push(`var.tipo_cor ILIKE '%DIGITAL%'`)
    }
  }

  // Potência mínima pedida
  if (zona.potencia_w_m) {
    condicoes.push(`mn.potencia_w_m >= $${i++}`)
    params.push(zona.potencia_w_m)
  }

  // Voltagem pedida (ou derivada do neon especificado)
  if (zona.tensao_v) {
    condicoes.push(`vn.voltagem_v = $${i++}`)
    params.push(zona.tensao_v)
  }

  // CRI mínimo pedido
  if (zona.cri_minimo) {
    condicoes.push(`mn.cri >= $${i++}`)
    params.push(zona.cri_minimo)
  }

  // Referência ou nome específico de neon pedido pelo utilizador
  const refNeon = zona.pecas_especificadas?.referencia_neon
  if (refNeon) {
    condicoes.push(`(p.referencia ILIKE $${i} OR p.nome ILIKE $${i})`)
    params.push(likeFlexivel(refNeon))
    i++
  }

  // Subtipo neon: "360" → ângulo 360° (mangueira/iluminação 360); "long" → produto LONG
  if (zona.subtipo_neon === "360") {
    condicoes.push(`(mn.angulo_abertura = 360 OR p.nome ILIKE '%360%' OR p.referencia ILIKE '%360%')`)
  } else if (zona.subtipo_neon === "long") {
    condicoes.push(`(p.nome ILIKE '%LONG%' OR p.referencia ILIKE '%LONG%')`)
  }

  const construirSQL = (conds) => `
    SELECT * FROM (
      SELECT DISTINCT ON (mn.modelo_neon_id)
        mn.modelo_neon_id AS fita_led_id,
        mn.largura_mm,
        mn.potencia_w_m,
        var.tipo_cor AS tipos_cor,
        mn.dimavel,
        NULL::numeric AS eficiencia_lm_w,
        mn.comprimento_max_alimentacao_unica_m AS comprimento_max_alimentacao_m,
        mn.cri,
        p.produto_id,
        p.nome,
        p.referencia,
        p.imagem_url,
        vn.voltagem_v,
        vn.ip,
        var.temperatura_cor,
        var.preco_metro
      FROM modelos_neon mn
      JOIN produtos p ON p.produto_id = mn.produto_id
      JOIN versoes_neon vn ON vn.modelo_neon_id = mn.modelo_neon_id
      JOIN variantes_neon var ON var.versao_neon_id = vn.versao_neon_id
      WHERE ${conds.join(" AND ")}
      ORDER BY mn.modelo_neon_id,
        CASE WHEN var.tipo_cor ILIKE '%RGB%' THEN 0
             WHEN var.tipo_cor IS NOT NULL THEN 1
             ELSE 2 END
    ) sub
    ORDER BY sub.potencia_w_m DESC NULLS LAST, sub.cri DESC NULLS LAST
    LIMIT 10
  `

  const temFiltroTemp = zona.temperatura_cor_k != null && !(zona.tipo_cor || "").toUpperCase().includes("RGB")

  if (temFiltroTemp) {
    const { rows: exatas } = await pool.query(
      construirSQL([...condicoes, `var.temperatura_cor::text = $${i}`]),
      [...params, String(zona.temperatura_cor_k)]
    )
    if (exatas.length > 0) return exatas

    const temp = zona.temperatura_cor_k
    const min = temp < 3000 ? temp : temp - 500
    const max = temp + 500
    const { rows: tolerancia } = await pool.query(
      construirSQL([...condicoes, `NULLIF(REGEXP_REPLACE(var.temperatura_cor, '[^0-9.]', '', 'g'), '')::numeric BETWEEN $${i} AND $${i + 1}`]),
      [...params, min, max]
    )
    return tolerancia
  }

  const { rows } = await pool.query(construirSQL(condicoes), params)
  return rows

}


function calcularComprimento(zona) {

  if (zona.tipo_calculo && !zona.dimensoes) return zona.comprimento_m ?? null

  const d = zona.dimensoes || {}

  const calculos = {
    perimetro_retangulo: () => (d.largura + d.comprimento) * 2,
    perimetro_retangulos: () => (d.retangulos || []).reduce((soma, r) => soma + (r.largura + r.comprimento) * 2, 0),
    perimetro_sala: () => Math.sqrt(d.area_m2) * 4,
    multiplicacao: () => d.unidades * d.comprimento_por_unidade_m,
  }

  const fn = calculos[zona.tipo_calculo]
  if (fn) return fn()

  // Fallback: se dimensoes tem comprimento e largura calcula perímetro, senão usa comprimento direto
  if (d.comprimento != null && d.largura != null) return (d.comprimento + d.largura) * 2
  if (d.comprimento != null) return d.comprimento
  return zona.comprimento_m ?? null

}


// Comprimento do maior segmento — usado para dimensionar fonte e controlador
function calcularComprimentoMax(zona) {

  if (zona.comprimento_max_segmento_m != null) return zona.comprimento_max_segmento_m
  if (zona.comprimento_m != null) return zona.comprimento_m
  if (zona.tipo_calculo && !zona.dimensoes) return null

  const d = zona.dimensoes || {}

  const calculos = {
    perimetro_retangulo: () => Math.max(d.largura || 0, d.comprimento || 0),
    perimetro_retangulos: () => Math.max(...(d.retangulos || []).map(r => Math.max(r.largura || 0, r.comprimento || 0))),
    perimetro_sala: () => Math.sqrt(d.area_m2 || 0),
    multiplicacao: () => d.comprimento_por_unidade_m || 0,
  }

  const fn = calculos[zona.tipo_calculo]
  return fn ? fn() : (zona.comprimento_m ?? null)

}


async function buscarFitas(zona) {

  const condicoes = ["p.ativo = TRUE", "v.ativo = TRUE", "o.ativo = TRUE"]
  const params = []
  let i = 1

  if (zona.ip_minimo) {
     if (zona.ip_minimo <= 20) {
       condicoes.push(`(v.ip IS NULL OR v.ip >= $${i++})`)
     } else {
       condicoes.push(`v.ip >= $${i++}`)
     }
     params.push(zona.ip_minimo)
   }

  // tipos_cor na BD são combinações de "W", "CCT", "RGB", "DIGITAL" separadas por " + "
  // Se o kit foi especificado pelo nome, o tipo_cor pode já ter sido deduzido do nome (ex: "EASY RGBW")
  // e não deve ser usado para filtrar fitas — senão perde candidatos válidos.
  if (zona.tipo_cor && !zona.pecas_especificadas?.referencia_kit) {
    const tc = zona.tipo_cor.toUpperCase()
    if (tc === "MONO") {
      condicoes.push(`(f.tipos_cor IS NULL OR (f.tipos_cor ILIKE '%W%' AND f.tipos_cor NOT ILIKE '%RGB%' AND f.tipos_cor NOT ILIKE '%CCT%' AND f.tipos_cor NOT ILIKE '%DIGITAL%'))`)
    } else if (tc === "CCT") {
      condicoes.push(`(f.tipos_cor ILIKE '%CCT%' AND f.tipos_cor NOT ILIKE '%RGB%')`)
    } else if (tc === "RGB") {
      condicoes.push(`(f.tipos_cor ILIKE '%RGB%' AND f.tipos_cor NOT ILIKE '%W%' AND f.tipos_cor NOT ILIKE '%CCT%')`)
    } else if (tc === "RGBW") {
      condicoes.push(`(f.tipos_cor ILIKE '%RGB%' AND f.tipos_cor ILIKE '%W%')`)
    } else if (tc === "RGB_CCT") {
      condicoes.push(`(f.tipos_cor ILIKE '%RGB%' AND f.tipos_cor ILIKE '%CCT%')`)
    } else if (tc === "DIGITAL") {
      condicoes.push(`f.tipos_cor ILIKE '%DIGITAL%'`)
    }
  }

  // Potência mínima pedida — filtro duro
  if (zona.potencia_w_m) {
    condicoes.push(`f.potencia_w_m >= $${i++}`)
    params.push(zona.potencia_w_m)
  }

  // Voltagem pedida (ou derivada de produto especificado) — filtro duro
  if (zona.tensao_v) {
    condicoes.push(`v.voltagem_v = $${i++}`)
    params.push(zona.tensao_v)
  }

  // Sem pontos visíveis → apenas fitas ECOB (filtro duro)
  if (zona.sem_pontos_visiveis) {
    condicoes.push(`(p.nome ILIKE '%ECOB%' OR p.referencia ILIKE '%ECOB%')`)
  }

  // CRI mínimo pedido — filtro duro
  if (zona.cri_minimo) {
    condicoes.push(`f.cri >= $${i++}`)
    params.push(zona.cri_minimo)
  }

  // Referência ou nome específico de fita pedido pelo utilizador
  const refFita = zona.pecas_especificadas?.referencia_fita
  if (refFita) {
    condicoes.push(`(p.referencia ILIKE $${i} OR p.nome ILIKE $${i})`)
    params.push(likeFlexivel(refFita))
    i++
  }

  const construirSQL = (conds) => `
    SELECT * FROM (
      SELECT DISTINCT ON (f.fita_led_id)
        f.fita_led_id,
        f.largura_mm,
        f.potencia_w_m,
        f.tipos_cor,
        f.dimavel,
        f.eficiencia_lm_w,
        f.comprimento_max_alimentacao_m,
        f.cri,
        p.produto_id,
        p.nome,
        p.referencia,
        p.imagem_url,
        v.voltagem_v,
        v.ip,
        v.rolo_m,
        o.temperatura_cor,
        o.preco_metro
      FROM fitas_led f
      JOIN produtos p ON p.produto_id = f.produto_id
      JOIN versoes_fitas_led v ON v.fita_led_id = f.fita_led_id
      JOIN opcoes_fitas_led o ON o.versao_fita_led_id = v.versao_fita_led_id
      WHERE ${conds.join(" AND ")}
      ORDER BY f.fita_led_id
    ) sub
    ORDER BY sub.eficiencia_lm_w DESC NULLS LAST, sub.cri DESC NULLS LAST
    LIMIT 10
  `

  const temFiltroTemp = zona.temperatura_cor_k != null && !(zona.tipo_cor || "").toUpperCase().includes("RGB")

  if (temFiltroTemp) {
    const { rows: exatas } = await pool.query(
      construirSQL([...condicoes, `o.temperatura_cor::text = $${i}`]),
      [...params, String(zona.temperatura_cor_k)]
    )
    if (exatas.length > 0) return exatas

    const temp = zona.temperatura_cor_k
    const min = temp < 3000 ? temp : temp - 500
    const max = temp + 500
    const { rows: tolerancia } = await pool.query(
      construirSQL([...condicoes, `NULLIF(REGEXP_REPLACE(o.temperatura_cor, '[^0-9.]', '', 'g'), '')::numeric BETWEEN $${i} AND $${i + 1}`]),
      [...params, min, max]
    )
    return tolerancia
  }

  const { rows } = await pool.query(construirSQL(condicoes), params)
  return rows

}


async function buscarPerfis(fitas, zona) {

  if (fitas.length === 0) return []

  const minLargura = Math.min(...fitas.map(f => parseFloat(f.largura_mm)))
  const minPotencia = Math.min(...fitas.map(f => parseFloat(f.potencia_w_m || 0)))

  const condicoes = ["p.ativo = TRUE", `pf.max_largura_fita_mm >= $1`]
  const params = [minLargura]
  let i = 2

  // Pré-filtro de potência: só elimina perfis que não aguentam nem a fita menos potente.
  // A verificação exata por fita individual é feita depois em escolher3Kits.
  if (minPotencia > 0) {
    condicoes.push(`(pf.potencia_max_w_m IS NULL OR pf.potencia_max_w_m >= $${i++})`)
    params.push(minPotencia * 0.9)
  }

  // Referência ou nome específico pedido pelo utilizador
  const refPerfil = zona.pecas_especificadas?.referencia_perfil
  if (refPerfil) {
    condicoes.push(`(p.referencia ILIKE $${i} OR p.nome ILIKE $${i})`)
    params.push(likeFlexivel(refPerfil))
    i++
  }

  if (zona.tipo_instalacao) {
    condicoes.push(`
      EXISTS (
        SELECT 1 FROM perfil_instalacoes pi
        JOIN tipos_instalacao ti ON ti.tipo_instalacao_id = pi.tipo_instalacao_id
        WHERE pi.perfil_id = pf.perfil_id AND ti.nome ILIKE $${i++}
      )
    `)
    params.push(zona.tipo_instalacao)
  }

  if (zona.perfil_largura_max_mm) {
    condicoes.push(`pf.largura_externa_mm <= $${i++}`)
    params.push(zona.perfil_largura_max_mm)
  }

  if (zona.perfil_altura_max_mm) {
    condicoes.push(`pf.altura_externa_mm <= $${i++}`)
    params.push(zona.perfil_altura_max_mm)
  }

  const sql = `
    SELECT
      pf.perfil_id,
      pf.max_largura_fita_mm,
      pf.max_quantidade_fitas,
      pf.largura_externa_mm,
      pf.altura_externa_mm,
      pf.potencia_max_w_m,
      p.produto_id,
      p.nome,
      p.referencia,
      p.imagem_url,
      ARRAY_AGG(DISTINCT ti.nome) FILTER (WHERE ti.nome IS NOT NULL) AS tipos_instalacao
    FROM perfis pf
    JOIN produtos p ON p.produto_id = pf.produto_id
    LEFT JOIN perfil_instalacoes pi ON pi.perfil_id = pf.perfil_id
    LEFT JOIN tipos_instalacao ti ON ti.tipo_instalacao_id = pi.tipo_instalacao_id
    WHERE ${condicoes.join(" AND ")}
    GROUP BY pf.perfil_id, pf.max_largura_fita_mm, pf.max_quantidade_fitas,
             pf.largura_externa_mm, pf.altura_externa_mm, pf.potencia_max_w_m,
             p.produto_id, p.nome, p.referencia, p.imagem_url
    LIMIT 10
  `

  const { rows } = await pool.query(sql, params)
  return rows

}


async function buscarControladores(fitas, zona, comprimento, controladorIdsAllowed = null) {

  if (fitas.length === 0) return []

  const voltagens = [...new Set(fitas.map(f => f.voltagem_v).filter(Boolean))]
  if (voltagens.length === 0) return []

  const condicoes = [
    "p.ativo = TRUE",
    // Excluir receivers que fazem parte de um kit — esses são geridos por buscarKits
    "c.controlador_id NOT IN (SELECT controlador_id FROM kits_controladores)",
    // Amplificadores só aparecem se o utilizador os pedir explicitamente
    ...(zona.amplificador ? [] : ["p.nome NOT ILIKE '%AMP%' AND p.referencia NOT ILIKE '%AMP%'"]),
    // Gateways só aparecem se o utilizador pedir controlo gateway/Wi-Fi multi-zona
    ...(zona.gateway || zona.tipo_controlo === "GATEWAY" ? [] : ["p.nome NOT ILIKE '%GATEWAY%' AND p.referencia NOT ILIKE '%GATEWAY%'"])
  ]
  const params = []
  let i = 1

  condicoes.push(`
    EXISTS (
      SELECT 1 FROM entradas_controladores e
      CROSS JOIN unnest($${i++}::int[]) AS v(volt)
      WHERE e.controlador_id = c.controlador_id
      AND e.voltagem_min <= v.volt
      AND e.voltagem_max >= v.volt
    )
  `)
  params.push(voltagens)

  if (comprimento) {
    // Usa potência mínima do grupo para não excluir controladores que servem NEONs menos potentes.
    // A verificação exata por NEON individual é feita depois em escolher3Kits.
    const potencias = fitas.map(f => f.potencia_w_m || 0).filter(p => p > 0)
    const potNecessaria = (potencias.length > 0 ? Math.min(...potencias) : 0) * comprimento * 1.2
    if (potNecessaria > 0) {
      condicoes.push(`
        (
          NOT EXISTS (SELECT 1 FROM limites_potencia_controladores lp WHERE lp.controlador_id = c.controlador_id)
          OR EXISTS (
            SELECT 1 FROM limites_potencia_controladores lp
            WHERE lp.controlador_id = c.controlador_id
            AND lp.potencia_max_w >= $${i++}
          )
        )
      `)
      params.push(potNecessaria)
    }
  }

  if (zona.num_fitas_paralelas && zona.num_fitas_paralelas > 1) {
    condicoes.push(`
      EXISTS (
        SELECT 1 FROM saidas_controladores s
        WHERE s.controlador_id = c.controlador_id
        AND s.numero_canais >= $${i++}
      )
    `)
    params.push(zona.num_fitas_paralelas)
  }

  // sem_fonte pode ser deduzido do texto (ex: "driver AC") ou marcado manualmente;
  // só filtra por AC se vier do texto, não quando o utilizador desativou a fonte manualmente
  if (zona.sem_fonte && !zona.sem_fonte_manual) {
    condicoes.push(`
      EXISTS (
        SELECT 1 FROM entradas_controladores e
        WHERE e.controlador_id = c.controlador_id
        AND e.tipo_input ILIKE '%AC%'
      )
    `)
  }

  const refCtrl = zona.pecas_especificadas?.referencia_controlador
  if (refCtrl) {
    condicoes.push(`(p.referencia ILIKE $${i} OR p.nome ILIKE $${i})`)
    params.push(likeFlexivel(refCtrl))
    i++
  }

  // filtro de IP — desativado temporariamente
   if (zona.ip_minimo) {
     condicoes.push(`(c.ip IS NULL OR c.ip >= $${i++})`)
     params.push(zona.ip_minimo)
   }

  // pesquisa invertida — quando se parte do comando, restringir aos controladores compatíveis
  if (controladorIdsAllowed && controladorIdsAllowed.length > 0) {
    condicoes.push(`c.controlador_id = ANY($${i++}::int[])`)
    params.push(controladorIdsAllowed)
  }

  const sql = `
    SELECT
      c.controlador_id,
      c.ip,
      c.preco,
      p.produto_id,
      p.nome,
      p.referencia,
      p.imagem_url,
      ARRAY_AGG(DISTINCT tc.tipo_controlo)
        FILTER (WHERE tc.tipo_controlo IS NOT NULL) AS tipos_controlo,
      ARRAY_AGG(DISTINCT ts.tipo_sinal)
        FILTER (WHERE ts.tipo_sinal IS NOT NULL) AS tipos_sinal,
      JSON_AGG(DISTINCT jsonb_build_object('voltagem', lp.voltagem, 'potencia_max_w', lp.potencia_max_w))
        FILTER (WHERE lp.voltagem IS NOT NULL) AS limites_potencia
    FROM controladores c
    JOIN produtos p ON p.produto_id = c.produto_id
    LEFT JOIN tipos_controlo_controladores tc ON tc.controlador_id = c.controlador_id
    LEFT JOIN tipos_sinal_controladores ts ON ts.controlador_id = c.controlador_id
    LEFT JOIN limites_potencia_controladores lp ON lp.controlador_id = c.controlador_id
    WHERE ${condicoes.join(" AND ")}
    GROUP BY c.controlador_id, p.produto_id, p.nome, p.referencia, p.imagem_url
    ORDER BY c.preco ASC NULLS LAST
    LIMIT 20
  `

  const { rows } = await pool.query(sql, params)
  return rows

}


async function buscarKits(fitas, zona, comprimento, controladorIdsAllowed = null) {

  if (fitas.length === 0) return []

  const voltagens = [...new Set(fitas.map(f => f.voltagem_v).filter(Boolean))]
  if (voltagens.length === 0) return []

  const condicoes = [
    "kp.ativo = TRUE",
    // Gateways só aparecem se o utilizador pedir controlo gateway/Wi-Fi multi-zona
    ...(zona.gateway || zona.tipo_controlo === "GATEWAY" ? [] : [
      "kp.nome NOT ILIKE '%GATEWAY%' AND kp.referencia NOT ILIKE '%GATEWAY%'",
      "rp.nome NOT ILIKE '%GATEWAY%' AND rp.referencia NOT ILIKE '%GATEWAY%'"
    ])
  ]
  const params = []
  let i = 1

  // Voltagem de entrada do receiver tem de cobrir a voltagem da fita
  condicoes.push(`
    EXISTS (
      SELECT 1 FROM entradas_controladores e
      CROSS JOIN unnest($${i++}::int[]) AS v(volt)
      WHERE e.controlador_id = c.controlador_id
      AND e.voltagem_min <= v.volt
      AND e.voltagem_max >= v.volt
    )
  `)
  params.push(voltagens)

  if (comprimento) {
    const potNecessaria = Math.max(...fitas.map(f => f.potencia_w_m || 0)) * comprimento * 1.2
    if (potNecessaria > 0) {
      condicoes.push(`
        EXISTS (
          SELECT 1 FROM limites_potencia_controladores lp
          WHERE lp.controlador_id = c.controlador_id
          AND lp.potencia_max_w >= $${i++}
        )
      `)
      params.push(potNecessaria)
    }
  }

  if (zona.num_fitas_paralelas && zona.num_fitas_paralelas > 1) {
    condicoes.push(`
      EXISTS (
        SELECT 1 FROM saidas_controladores s
        WHERE s.controlador_id = c.controlador_id
        AND s.numero_canais >= $${i++}
      )
    `)
    params.push(zona.num_fitas_paralelas)
  }

  if (zona.sem_fonte && !zona.sem_fonte_manual) {
    condicoes.push(`
      EXISTS (
        SELECT 1 FROM entradas_controladores e
        WHERE e.controlador_id = c.controlador_id
        AND e.tipo_input ILIKE '%AC%'
      )
    `)
  }

  // filtro de IP no receiver — desativado temporariamente
   if (zona.ip_minimo) {
     condicoes.push(`(c.ip IS NULL OR c.ip >= $${i++})`)
     params.push(zona.ip_minimo)
   }

  // pesquisa invertida — restringir aos kits cujo receiver é compatível com os comandos encontrados
  if (controladorIdsAllowed && controladorIdsAllowed.length > 0) {
    condicoes.push(`c.controlador_id = ANY($${i++}::int[])`)
    params.push(controladorIdsAllowed)
  }

  const refKit = zona.pecas_especificadas?.referencia_kit
  if (refKit) {
    condicoes.push(`(kp.referencia ILIKE $${i} OR kp.nome ILIKE $${i})`)
    params.push(likeFlexivel(refKit))
    i++
  }

  const sql = `
    SELECT
      kc.kit_controlador_id,
      kc.controlador_id,
      kc.comando_id,
      kp.produto_id,
      kp.nome,
      kp.referencia,
      kp.imagem_url,
      c.ip,
      c.preco AS receiver_preco,
      cmd.preco AS remote_preco,
      rp.produto_id AS remote_produto_id,
      rp.nome AS remote_nome,
      rp.referencia AS remote_referencia,
      rp.imagem_url AS remote_imagem_url,
      ARRAY_AGG(DISTINCT tc.tipo_controlo)
        FILTER (WHERE tc.tipo_controlo IS NOT NULL) AS tipos_controlo,
      ARRAY_AGG(DISTINCT tcc.tipo_controlo)
        FILTER (WHERE tcc.tipo_controlo IS NOT NULL) AS remote_tipos_controlo,
      JSON_AGG(DISTINCT jsonb_build_object('voltagem', lp.voltagem, 'potencia_max_w', lp.potencia_max_w))
        FILTER (WHERE lp.voltagem IS NOT NULL) AS limites_potencia
    FROM kits_controladores kc
    JOIN produtos kp ON kp.produto_id = kc.produto_id
    JOIN controladores c ON c.controlador_id = kc.controlador_id
    JOIN comandos cmd ON cmd.comando_id = kc.comando_id
    JOIN produtos rp ON rp.produto_id = cmd.produto_id
    LEFT JOIN tipos_controlo_controladores tc ON tc.controlador_id = c.controlador_id
    LEFT JOIN tipos_controlo_comandos tcc ON tcc.comando_id = cmd.comando_id
    LEFT JOIN limites_potencia_controladores lp ON lp.controlador_id = c.controlador_id
    WHERE ${condicoes.join(" AND ")}
    GROUP BY
      kc.kit_controlador_id, kc.controlador_id, kc.comando_id,
      kp.produto_id, kp.nome, kp.referencia, kp.imagem_url,
      c.ip, c.preco,
      cmd.preco,
      rp.produto_id, rp.nome, rp.referencia, rp.imagem_url
    ORDER BY c.preco ASC NULLS LAST
    LIMIT 20
  `

  const { rows } = await pool.query(sql, params)

  // Transforma cada linha numa estrutura compatível com o loop de kits.
  // Receiver e remote têm preços individuais — calcularPrecoTotal soma-os naturalmente.
  return rows.map(row => ({
    controlador_id: row.controlador_id,
    ip: row.ip,
    preco: row.receiver_preco,
    produto_id: row.produto_id,
    nome: row.nome,
    referencia: row.referencia,
    imagem_url: row.imagem_url,
    tipos_controlo: row.tipos_controlo,
    limites_potencia: row.limites_potencia,
    is_kit: true,
    kit_id: row.kit_controlador_id,
    comando_kit: {
      produto_id: row.remote_produto_id,
      nome: row.remote_nome,
      referencia: row.remote_referencia,
      imagem_url: row.remote_imagem_url,
      tipos_controlo: row.remote_tipos_controlo,
      preco: row.remote_preco,
    }
  }))

}


async function buscarFontes(fita, comprimento, zona) {

  if (!fita?.voltagem_v) return []

  log(`\n=== [FONTES-INDIVIDUAL] buscando para fita ${fita.referencia} (${fita.voltagem_v}V | ${fita.potencia_w_m}W/m) | comprimento: ${comprimento}m | ip_minimo: ${zona?.ip_minimo ?? null} | tipo_fonte: ${zona?.tipo_fonte ?? null} ===`)

  const condicoes = [
    "p.ativo = TRUE",
    "f.ativo = TRUE",
    // Tensão de saída exata à voltagem desta fita
    `f.tensao_saida_v = $1`,
    // NFC DRIVER nunca é sugerido pelo configurador (produto de nicho, não de kit standard)
    "f.subcategoria NOT ILIKE '%NFC%'"
  ]
  const params = [fita.voltagem_v]
  let i = 2

  let potNecessaria = 0

  if (fita.potencia_w_m) {
    const comprimentoCalculado = comprimento ?? calcularComprimento(zona)
    const comprimentoCalculo = comprimentoCalculado || parseFloat(fita.rolo_m) || null

    if (comprimentoCalculo) {
      const maxAlim = fita.comprimento_max_alimentacao_m
        ? parseFloat(fita.comprimento_max_alimentacao_m)
        : null

      const numAlim = (maxAlim && comprimento)
        ? Math.ceil(comprimento / maxAlim)
        : 1

      const compPorFonte = numAlim > 1
        ? comprimentoCalculo / 2
        : comprimentoCalculo

      potNecessaria =
        (parseFloat(fita.potencia_w_m) || 0) *
        compPorFonte *
        1.2

      condicoes.push(`f.potencia_w >= $${i++}`)
      params.push(potNecessaria)
    }
  }

  if (zona?.ip_minimo) {
    if (zona.ip_minimo <= 20) {
      condicoes.push(`(f.ip_rating IS NULL OR NULLIF(REGEXP_REPLACE(f.ip_rating, '[^0-9]', '', 'g'), '')::int >= $${i++})`)
    } else {
      condicoes.push(`NULLIF(REGEXP_REPLACE(f.ip_rating, '[^0-9]', '', 'g'), '')::int >= $${i++}`)
    }
    params.push(zona.ip_minimo)
  }

  // Filtro por tipo de instalação da fonte:
  // "movel" → fontes para imobiliário/prateleiras: referências FTPC ou GTPC
  // "quadro" → fontes para quadro elétrico (calha DIN): referências DIN/DLR/DL2/DRP/DRM
  if (zona?.tipo_fonte === "movel") {
    condicoes.push(`(p.referencia ILIKE '%FTPC%' OR p.referencia ILIKE '%GTPC%')`)
  } else if (zona?.tipo_fonte === "quadro") {
    condicoes.push(`(
      p.referencia ILIKE '%DIN%' OR
      p.referencia ILIKE '%DLR%' OR
      p.referencia ILIKE '%DL2%' OR
      p.referencia ILIKE '%DRP%' OR
      p.referencia ILIKE '%DRM%'
    )`)
  }

  const sql = `
    SELECT
      f.fonte_alimentacao_id,
      f.potencia_w,
      f.tensao_saida_v,
      f.ip_rating,
      f.preco,
      p.produto_id,
      p.nome,
      p.referencia,
      p.imagem_url
    FROM fontes_alimentacao f
    JOIN produtos p ON p.produto_id = f.produto_id
    WHERE ${condicoes.join(" AND ")}
    ORDER BY f.potencia_w ASC
    LIMIT 20
  `

  const { rows } = await pool.query(sql, params)

  // filtrar só fontes válidas
  const fontesValidas = rows.filter(f => f.potencia_w >= potNecessaria)

  // escolher a mais próxima
  const melhorFonte = fontesValidas
    .map(f => ({
      ...f,
      excesso: f.potencia_w - potNecessaria
    }))
    .sort((a, b) => a.excesso - b.excesso)[0]

  // fallback: se não houver nenhuma (caso raro), usa a maior disponível
  const resultadoFinal = melhorFonte
    ? [melhorFonte]
    : rows.slice(-1)

  log(`=== [FONTES-INDIVIDUAL] resultado para ${fita.referencia}: ${
    resultadoFinal.map(f => `${f.referencia} ${f.potencia_w}W`).join(", ") || "nenhuma"
  } ===\n`)

  return resultadoFinal

}


// pesquisa invertida — encontrar o comando/painel primeiro, depois derivar os controladores compatíveis
async function buscarComandosPrimeiro(zona) {

  const condicoes = ["p.ativo = TRUE"]
  const params = []
  let i = 1

  const refComando = zona.pecas_especificadas?.referencia_comando
  if (refComando) {
    condicoes.push(`(p.referencia ILIKE $${i} OR p.nome ILIKE $${i})`)
    params.push(likeFlexivel(refComando))
    i++
  } else if (zona.tipo_controlo_parede) {
    condicoes.push(`(p.nome ILIKE $${i} OR p.referencia ILIKE $${i})`)
    params.push(`%panel%`)
    i++
  } else {
    return []
  }

  const sql = `
    SELECT
      cmd.comando_id,
      cmd.preco,
      p.produto_id,
      p.nome,
      p.referencia,
      p.imagem_url,
      ARRAY_AGG(DISTINCT tc.tipo_controlo)
        FILTER (WHERE tc.tipo_controlo IS NOT NULL) AS tipos_controlo,
      ARRAY_AGG(DISTINCT ccc.controlador_id)
        FILTER (WHERE ccc.controlador_id IS NOT NULL) AS controladores_compativeis
    FROM comandos cmd
    JOIN produtos p ON p.produto_id = cmd.produto_id
    LEFT JOIN tipos_controlo_comandos tc ON tc.comando_id = cmd.comando_id
    LEFT JOIN compatibilidade_comando_controlador ccc ON ccc.comando_id = cmd.comando_id
    WHERE ${condicoes.join(" AND ")}
    GROUP BY cmd.comando_id, p.produto_id, p.nome, p.referencia, p.imagem_url
    LIMIT 10
  `

  const { rows } = await pool.query(sql, params)
  return rows

}


async function buscarComandos(controladores) {

  if (controladores.length === 0) return []

  const controladorIds = controladores.map(c => c.controlador_id)

  const sql = `
    SELECT
      cmd.comando_id,
      cmd.preco,
      p.produto_id,
      p.nome,
      p.referencia,
      p.imagem_url,
      ARRAY_AGG(DISTINCT tc.tipo_controlo)
        FILTER (WHERE tc.tipo_controlo IS NOT NULL) AS tipos_controlo,
      ARRAY_AGG(DISTINCT ccc.controlador_id)
        FILTER (WHERE ccc.controlador_id IS NOT NULL) AS controladores_compativeis
    FROM comandos cmd
    JOIN produtos p ON p.produto_id = cmd.produto_id
    LEFT JOIN tipos_controlo_comandos tc ON tc.comando_id = cmd.comando_id
    LEFT JOIN compatibilidade_comando_controlador ccc ON ccc.comando_id = cmd.comando_id
    WHERE p.ativo = TRUE
    AND EXISTS (
      SELECT 1 FROM compatibilidade_comando_controlador
      WHERE comando_id = cmd.comando_id
      AND controlador_id = ANY($1::int[])
    )
    GROUP BY cmd.comando_id, p.produto_id, p.nome, p.referencia, p.imagem_url
    LIMIT 50
  `

  const { rows } = await pool.query(sql, [controladorIds])
  return rows

}


function calcularPrecoTotal(kit, comprimentoTotal) {
  const precFita = parseFloat(kit.fita?.preco_metro || 0) * (comprimentoTotal || 1)
  const numFontes = (kit.num_alimentacoes ?? 1) > 1 ? 2 : 1
  const precFonte = parseFloat(kit.fonte?.preco || 0) * numFontes
  const precControlador = parseFloat(kit.controlador?.preco || 0)
  const precComando = parseFloat(kit.comando?.preco || 0)
  return Math.round((precFita + precFonte + precControlador + precComando) * 100) / 100
}


function escolher3Kits(fitas, perfis, controladores, fontesMap, comandos, kitsCtrl, zona, comprimento, comprimentoTotal, avisoControlador = null, semControlador = false) {

  if (!fitas.length) return null
  if (!semControlador && !controladores.length && !kitsCtrl.length && !avisoControlador) return null
  if (fontesMap !== null && [...fontesMap.values()].every(arr => arr.length === 0)) return null

  const regras = [

    // Perfil tem o tipo de instalação pedido (case-insensitive)
    kit => zona.tipo_instalacao && kit.perfil?.tipos_instalacao?.some(
      t => t.toLowerCase() === zona.tipo_instalacao.toLowerCase()
    ) ? 10 : 0,

    // Perfil bem dimensionado em potência
    kit => {
      if (!kit.perfil) return 0
      const potFita = parseFloat(kit.fita.potencia_w_m || 0)
      const potMax = parseFloat(kit.perfil.potencia_max_w_m || 0)
      if (potFita === 0 || potMax === 0) return 0
      const racio = potMax / potFita
      if (racio >= 1.0 && racio <= 1.5) return 5
      if (racio > 1.5 && racio <= 2.5) return 3
      return 1
    },

    // Fita bem ajustada à largura do perfil (rácio largura fita / max perfil próximo de 1)
    kit => {
      if (!kit.perfil) return 0
      const largFita = parseFloat(kit.fita.largura_mm || 0)
      const largMax = parseFloat(kit.perfil.max_largura_fita_mm || 0)
      if (largFita === 0 || largMax === 0) return 0
      const racio = largFita / largMax
      if (racio >= 0.8) return 4
      if (racio >= 0.5) return 2
      return 0
    },

    // Controlador suporta o tipo de controlo pedido (case-insensitive)
    kit => zona.tipo_controlo && kit.controlador.tipos_controlo?.some(
      t => t.toLowerCase() === zona.tipo_controlo.toLowerCase()
    ) ? 10 : 0,

    // Controlador suporta o tipo de sinal pedido (ex: PIR sensor)
    kit => zona.tipo_sinal && kit.controlador.tipos_sinal?.some(
      t => t.toLowerCase() === zona.tipo_sinal.toLowerCase()
    ) ? 10 : 0,

    // Comando suporta o tipo de controlo pedido (case-insensitive)
    kit => zona.tipo_controlo && kit.comando?.tipos_controlo?.some(
      t => t.toLowerCase() === zona.tipo_controlo.toLowerCase()
    ) ? 5 : 0,

    // Temperatura de cor da fita corresponde ao pedido
    kit => {
      const tempFita = String(kit.fita.temperatura_cor ?? "").toUpperCase()
      const tiposFita = String(kit.fita.tipos_cor ?? "").toUpperCase()
      const tipoCorPedido = (zona.tipo_cor || "").toUpperCase()
      if (zona.temperatura_cor_k && parseFloat(kit.fita.temperatura_cor) === parseFloat(zona.temperatura_cor_k)) return 8
      if (tipoCorPedido.includes("RGB") && (tempFita.includes("RGB") || tiposFita.includes("RGB"))) return 8
      if (tipoCorPedido.includes("DIGITAL") && (tempFita.includes("DIGITAL") || tiposFita.includes("DIGITAL"))) return 8
      return 0
    },

    // IP interior: prefere IP20 (bónus leve, sem penalizar outros)
    kit => {
      const ipMin = zona.ip_minimo || 20
      if (ipMin >= 65) return 0
      const ipFita = parseFloat(kit.fita.ip || 0)
      if (ipFita <= 20) return 3
      if (ipFita <= 44) return 1
      return 0
    },

    // ECOB pedido (sem pontos visíveis)
    kit => zona.sem_pontos_visiveis && (
      (kit.fita.nome || "").toUpperCase().includes("ECOB") ||
      (kit.fita.referencia || "").toUpperCase().includes("ECOB")
    ) ? 8 : 0,

    // CRI — bónus por atingir ou superar o mínimo pedido
    kit => {
      if (!zona.cri_minimo) return 0
      const cri = parseFloat(kit.fita.cri || 0)
      if (cri >= zona.cri_minimo + 10) return 6
      if (cri >= zona.cri_minimo) return 3
      return 0
    },

    // Fonte mais próxima (mas acima) da potência necessária
    // Com múltiplas fontes usa comprimentoTotal/2; caso contrário usa comprimentoMax ou rolo mínimo
    kit => {
      if (!kit.fonte || !kit.fita.potencia_w_m) return 0
      const comp = (kit.num_alimentacoes ?? 1) > 1 && comprimentoTotal
        ? comprimentoTotal / 2
        : (comprimento || parseFloat(kit.fita.rolo_m) || 0)
      if (!comp) return 0
      const necessaria = parseFloat(kit.fita.potencia_w_m) * comp * 1.2
      const potencia = parseFloat(kit.fonte.potencia_w)
      if (potencia < necessaria) return 0
      const racio = potencia / necessaria
      return Math.floor(10 / racio)
    },

    // Fonte com IP ajustado ao mínimo pedido (não sobredimensionada em IP)
    kit => {
      if (!kit.fonte || !zona.ip_minimo || zona.ip_minimo < 44) return 0
      const ipFonte = parseInt((kit.fonte.ip_rating || "0").replace(/[^0-9]/g, "")) || 0
      if (ipFonte === 0) return 0
      if (ipFonte >= zona.ip_minimo && ipFonte <= zona.ip_minimo + 10) return 4
      if (ipFonte >= zona.ip_minimo) return 2
      return 0
    },

    // Alta eficiência (>= 100 lm/W)
    kit => (parseFloat(kit.fita.eficiencia_lm_w) || 0) >= 100 ? 3 : 0,

    // Penalização por múltiplos pontos de alimentação
    kit => {
      const n = kit.num_alimentacoes ?? 1
      if (n <= 1) return 0
      return -3 * (n - 1)
    },

  ]

  const calcularScore = kit => regras.reduce((total, fn) => total + fn(kit), 0)

  const todosKits = []
  const perfisOkPorFita = new Map()

  for (const fita of fitas) {

    const maxAlim = fita.comprimento_max_alimentacao_m ? parseFloat(fita.comprimento_max_alimentacao_m) : null
    const num_alimentacoes = (maxAlim && comprimento) ? Math.ceil(comprimento / maxAlim) : 1
    const multiFonte = num_alimentacoes > 1
    const aviso_fonte = multiFonte ? "São necessárias 2 fontes de alimentação — preço inclui as 2 unidades" : null

    const potNecessaria = (() => {
      if (multiFonte && comprimentoTotal) {
        return (parseFloat(fita.potencia_w_m) || 0) * (comprimentoTotal / 2) * 1.2
      }
      const segmento = maxAlim && comprimento ? Math.min(comprimento, maxAlim) : (comprimento || 0)
      return segmento ? (parseFloat(fita.potencia_w_m) || 0) * segmento * 1.2 : 0
    })()

    const perfisOk = perfis.filter(p => {
      const larguraOk = parseFloat(p.max_largura_fita_mm) >= parseFloat(fita.largura_mm)
      const quantidadeOk = parseInt(p.max_quantidade_fitas) >= 1
      const potFita = parseFloat(fita.potencia_w_m || 0)
      const potMaxPerf = parseFloat(p.potencia_max_w_m || 999)
      const potenciaOk = potFita === 0 || potMaxPerf >= potFita * 0.9
      return larguraOk && quantidadeOk && potenciaOk
    })
    perfisOkPorFita.set(fita.fita_led_id, perfisOk)
    log(`[configurador] perfisOk para ${fita.referencia}:`, perfisOk.length, perfisOk.map(p => p.referencia))

    const fontesOk = fontesMap === null
      ? [null]
      : (fontesMap.get(fita.fita_led_id ?? fita.produto_id) || [])
    log(`=== [FONTES-INDIVIDUAL] kit-loop ${fita.referencia}: ${fontesOk[0] === null ? "sem fonte (manual)" : fontesOk.length + " fontes disponíveis — " + fontesOk.map(f => `${f.referencia} ${f.potencia_w}W`).join(", ")} ===`)

    // Compatibilidade de cores: controlador RGB não serve fita mono/CCT e vice-versa
    const fitaTemRGB = (fita.tipos_cor || "").toUpperCase().includes("RGB")
    const fitaTemCCT = (fita.tipos_cor || "").toUpperCase().includes("CCT")
    const coresCompativeis = ctrl => {
      const nomeCtrl = ((ctrl.nome || "") + " " + (ctrl.referencia || "")).toUpperCase()
      const tiposCtrl = (ctrl.tipos_controlo || []).map(t => t.toUpperCase())
      const ctrlTemRGB = nomeCtrl.includes("RGB") || tiposCtrl.some(t => t.includes("RGB"))
      const ctrlTemMONO = tiposCtrl.length === 0 || tiposCtrl.some(t => t === "MONO" || t.includes("CCT"))
      // Fita RGB → controlador tem de suportar RGB
      if (fitaTemRGB) return ctrlTemRGB
      // Fita MONO/CCT → controlador tem de suportar MONO (mesmo que também suporte RGB)
      return ctrlTemMONO
    }
    // Compatibilidade de cores para comandos: além de RGB, verifica CCT vs MONO
    // Verifica tanto o nome/referência como o array tipos_controlo da BD
    // Usa .some() em vez de .includes() para detetar substrings ("RGBW" contém "RGB")
    const comandoCompativelCores = cmd => {
      const nomeCmd = ((cmd.nome || "") + " " + (cmd.referencia || "")).toUpperCase()
      const tiposCmd = (cmd.tipos_controlo || []).map(t => t.toUpperCase())
      const cmdTemRGB = nomeCmd.includes("RGB") || tiposCmd.some(t => t.includes("RGB"))
      const cmdTemCCT = nomeCmd.includes("CCT") || tiposCmd.some(t => t.includes("CCT"))
      if (fitaTemRGB !== cmdTemRGB) return false
      // Fita MONO (sem RGB, sem CCT) não pode receber comando CCT
      if (!fitaTemRGB && !fitaTemCCT && cmdTemCCT) return false
      return true
    }

    // Verificar se há controladores compatíveis com esta fita por tipo de cor
    // Se não há, pular fita — garante que fitas RGB só se combinam com ctrl RGB, etc.
    if (!semControlador) {
      const temCtrlCompativelCores = 
        (controladores.length > 0 && controladores.some(c => coresCompativeis(c))) ||
        (kitsCtrl.length > 0 && kitsCtrl.some(k => coresCompativeis(k)))
      if (!temCtrlCompativelCores) {
        log(`[configurador] fita ${fita.referencia} rejeitada: sem controladores com compatibilidade de cores (${fitaTemRGB ? "RGB" : "não-RGB"})`)
        continue
      }
    }

    const limiteOk = (lp, voltagem_v) =>
      Math.abs(parseFloat(lp.voltagem) - parseFloat(voltagem_v)) < 0.01 &&
      (lp.potencia_max_w == null || parseFloat(lp.potencia_max_w) >= potNecessaria)

    const controladoresOk = controladores.filter(c =>
      coresCompativeis(c) &&
      c.limites_potencia?.some(lp => limiteOk(lp, fita.voltagem_v))
    )

    // Se limites_potencia for null/vazio, confiar na verificação de voltagem feita em buscarKits
    const kitsCtrlOk = kitsCtrl.filter(k => {
      if (!coresCompativeis(k)) return false
      if (!k.limites_potencia || k.limites_potencia.length === 0) return true
      return k.limites_potencia.some(lp => limiteOk(lp, fita.voltagem_v))
    })

    if (!controladoresOk.length && !kitsCtrlOk.length) {
      if (semControlador) {
        const ctrlVazio = { aviso: null, preco: 0, controlador_id: null, tipos_controlo: [], limites_potencia: null, sem_controlador: true }
        const perfisIterA = perfisOk.length > 0 ? perfisOk : [null]
        if (fontesOk.length) {
          for (const perfil of perfisIterA) {
            for (const fonte of fontesOk) {
              const kit = { fita, perfil, controlador: ctrlVazio, fonte, comando: null, num_alimentacoes, aviso_fonte }
              todosKits.push({ ...kit, score: calcularScore(kit), preco_total: calcularPrecoTotal(kit, comprimentoTotal) })
            }
          }
        }
        continue
      }
      if (!avisoControlador || !fontesOk.length) continue
      const ctrlPlaceholder = { aviso: avisoControlador, preco: 0, controlador_id: null, tipos_controlo: [], limites_potencia: null }
      const perfisIterA = perfisOk.length > 0 ? perfisOk : [null]
      for (const perfil of perfisIterA) {
        for (const fonte of fontesOk) {
          const kit = { fita, perfil, controlador: ctrlPlaceholder, fonte, comando: null, num_alimentacoes, aviso_fonte }
          todosKits.push({ ...kit, score: calcularScore(kit), preco_total: calcularPrecoTotal(kit, comprimentoTotal) })
        }
      }
      continue
    }
    if (!fontesOk.length) continue

    const perfisIter = perfisOk.length > 0 ? perfisOk : [null]

    for (const perfil of perfisIter) {

      // ── Controladores standalone + comando compatível 
      for (const controlador of controladoresOk) {

        const comandosOk = comandos.filter(c => {
          if (!c.controladores_compativeis?.includes(controlador.controlador_id)) return false
          // Gateway só aparece como comando se explicitamente pedido
          if (!zona.gateway) {
            const nomeCmd = ((c.nome || "") + " " + (c.referencia || "")).toUpperCase()
            if (nomeCmd.includes("GATEWAY")) return false
          }
          const ok = comandoCompativelCores(c)
          if (!ok) log(`[configurador] comando rejeitado (cor incompatível com fita ${fita.referencia}): ${c.nome} | tipos_controlo: ${JSON.stringify(c.tipos_controlo)}`)
          return ok
        })
        const comandosIter = comandosOk.length > 0 ? comandosOk : [null]

        for (const comando of comandosIter) {
          for (const fonte of fontesOk) {

            const kit = { fita, perfil, controlador, fonte, comando, num_alimentacoes, aviso_fonte }
            const score = calcularScore(kit)
            const preco_total = calcularPrecoTotal(kit, comprimentoTotal)
            todosKits.push({ ...kit, score, preco_total })

          }
        }
      }

      // Kits (receiver+remote fixo, não separar)
      for (const kitCtrl of kitsCtrlOk) {

        // Gateway só aparece se explicitamente pedido — verificar também o remote bundlado
        if (!zona.gateway) {
          const nomeKit = ((kitCtrl.nome || "") + " " + (kitCtrl.referencia || "")).toUpperCase()
          const nomeCmd = ((kitCtrl.comando_kit?.nome || "") + " " + (kitCtrl.comando_kit?.referencia || "")).toUpperCase()
          if (nomeKit.includes("GATEWAY") || nomeCmd.includes("GATEWAY")) continue
        }

        for (const fonte of fontesOk) {

          const kit = { fita, perfil, controlador: kitCtrl, fonte, comando: kitCtrl.comando_kit, num_alimentacoes, aviso_fonte }
          const score = calcularScore(kit)
          const preco_total = calcularPrecoTotal(kit, comprimentoTotal)
          todosKits.push({ ...kit, score, preco_total })

        }
      }
    }
  }

  if (todosKits.length === 0) return null

  // se o utilizador especificou um produto, todas as 3 opções têm de o incluir
  let base = todosKits

  const refKit = zona.pecas_especificadas?.referencia_kit
  const refFita = zona.pecas_especificadas?.referencia_fita
  const refNeon = zona.pecas_especificadas?.referencia_neon
  const refCtrl = zona.pecas_especificadas?.referencia_controlador
  const refPerfil = zona.pecas_especificadas?.referencia_perfil
  const refComando = zona.pecas_especificadas?.referencia_comando

  const contemProduto = (k) => {
    if (refKit) {
      return k.controlador.is_kit &&
        (matchFlexivel(k.controlador.nome || "", refKit) ||
         matchFlexivel(k.controlador.referencia || "", refKit))
    }
    if (refFita) {
      return (matchFlexivel(k.fita.nome || "", refFita) ||
              matchFlexivel(k.fita.referencia || "", refFita))
    }
    if (refNeon) {
      return (matchFlexivel(k.fita.nome || "", refNeon) ||
              matchFlexivel(k.fita.referencia || "", refNeon))
    }
    if (refCtrl) {
      return (matchFlexivel(k.controlador.nome || "", refCtrl) ||
              matchFlexivel(k.controlador.referencia || "", refCtrl))
    }
    if (refPerfil) {
      return k.perfil != null &&
        (matchFlexivel(k.perfil.nome || "", refPerfil) ||
         matchFlexivel(k.perfil.referencia || "", refPerfil))
    }
    if (refComando) {
      return k.comando != null &&
        (matchFlexivel(k.comando.nome || "", refComando) ||
         matchFlexivel(k.comando.referencia || "", refComando))
    }
    return true
  }

  const temEspecificado = refKit || refFita || refNeon || refCtrl || refPerfil || refComando
  if (temEspecificado) {
    const match = todosKits.filter(contemProduto)
    if (match.length > 0) base = match
  }

  // preferir kits com perfil; se havia candidatos mas nenhum passou os filtros, não há solução
  const kitsComPerfil = base.filter(k => k.perfil !== null)
  if (perfis.length > 0 && kitsComPerfil.length === 0) return null
  const kitsParaEscolha = kitsComPerfil.length > 0 ? kitsComPerfil : base

  
  // Sólida: kit com maior score de compatibilidade (sem critério de preço)
  let solida = [...kitsParaEscolha].sort((a, b) => b.score - a.score)[0]

  // Básica: kit mais barato; preferir diferente da sólida
  const outrosParaBasica = kitsParaEscolha.filter(k => k !== solida)
  const candidatosBasica = outrosParaBasica.length > 0 ? outrosParaBasica : kitsParaEscolha
  let basica = [...candidatosBasica].sort((a, b) => a.preco_total - b.preco_total)[0]

  // Premium: kit mais caro; preferir diferente da sólida
  const outrosParaPremium = kitsParaEscolha.filter(k => k !== solida)
  const candidatosPremium = outrosParaPremium.length > 0 ? outrosParaPremium : kitsParaEscolha
  let premium = [...candidatosPremium].sort((a, b) => b.preco_total - a.preco_total)[0]

  if (temEspecificado && base !== todosKits) {
    if (!contemProduto(basica)) {
      basica = [...base].sort((a, b) => a.preco_total - b.preco_total)[0]
    }
    if (!contemProduto(solida)) {
      solida = [...base].sort((a, b) => b.score - a.score)[0]
    }
    if (!contemProduto(premium)) {
      premium = [...base].sort((a, b) => b.score - a.score)[0]
    }
  }

  const comPerfisOk = kit => ({
    ...kit,
    perfisCompativeis: perfisOkPorFita.get(kit.fita.fita_led_id) ?? []
  })

  const [kitBasica, kitSolida, kitPremium] = [basica, solida, premium]
    .sort((a, b) => (a.preco_total ?? 0) - (b.preco_total ?? 0))

  return {
    basica: comPerfisOk(kitBasica),
    solida: comPerfisOk(kitSolida),
    premium: comPerfisOk(kitPremium),
  }

}
