export function initBgEffect(container, gridCanvas, lightCanvas, dropCanvas, cursorDot = null) {
  if (!container || !gridCanvas || !lightCanvas || !dropCanvas) return () => {}

  const gCtx = gridCanvas.getContext('2d')
  const lCtx = lightCanvas.getContext('2d')
  const dCtx = dropCanvas.getContext('2d')

  const C = 38

  const CONFIG = {
    bgColor: '#013634',
    accentColor: [200, 255, 80],
    lanternRadius: 180,
    dropMinSpeed: 110,
    dropMaxSpeed: 220,
    dropMinTail: 70,
    dropMaxTail: 130,
    spawnMin: 3000,
    spawnMax: 7000,
    initDensity: 0.08,
    cursorRadius: 200,
  }

  let W, H
  let totalCols = 0, totalRows = 0
  let mouseX = -999, mouseY = -999
  let smoothMX = -999, smoothMY = -999
  let drops = []
  let nextSpawn = 0
  let lastTime = performance.now()
  let animId = null
  let colPositions = []
  let rowPositions = []

  function resize() {
    W = container.offsetWidth
    H = container.offsetHeight
    ;[gridCanvas, lightCanvas, dropCanvas].forEach(c => {
      c.width = W
      c.height = H
    })
    totalCols = Math.ceil(W / C) + 1
    totalRows = Math.ceil(H / C) + 1
    colPositions = []
    rowPositions = []
    for (let i = 0; i < totalCols; i++) colPositions.push(i * C + 0.5)
    for (let i = 0; i < totalRows; i++) rowPositions.push(i * C + 0.5)
    drops = []
    spawnInitial()
  }

  function onMouseMove(e) {
    const rect = container.getBoundingClientRect()
    const lx = e.clientX - rect.left
    const ly = e.clientY - rect.top
    if (lx >= 0 && lx <= W && ly >= 0 && ly <= H) {
      mouseX = lx
      mouseY = ly
      if (cursorDot) {
        cursorDot.style.left = e.clientX + 'px'
        cursorDot.style.top = e.clientY + 'px'
        cursorDot.style.opacity = '1'
      }
    } else {
      mouseX = -999; mouseY = -999
      if (cursorDot) cursorDot.style.opacity = '0'
    }
  }

  function onMouseLeave() {
    mouseX = -999; mouseY = -999
    if (cursorDot) cursorDot.style.opacity = '0'
  }

  function drawGrid() {
    gCtx.clearRect(0, 0, W, H)
    gCtx.fillStyle = CONFIG.bgColor
    gCtx.fillRect(0, 0, W, H)
    const R = CONFIG.cursorRadius
    const hasMouse = smoothMX > 0
    gCtx.lineWidth = 0.5
    colPositions.forEach(x => {
      let alpha = 0.07
      if (hasMouse && Math.abs(x - smoothMX) < R)
        alpha = 0.07 + 0.13 * (1 - Math.abs(x - smoothMX) / R)
      gCtx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`
      gCtx.beginPath(); gCtx.moveTo(x, 0); gCtx.lineTo(x, H); gCtx.stroke()
    })
    rowPositions.forEach(y => {
      let alpha = 0.07
      if (hasMouse && Math.abs(y - smoothMY) < R)
        alpha = 0.07 + 0.13 * (1 - Math.abs(y - smoothMY) / R)
      gCtx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`
      gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(W, y); gCtx.stroke()
    })
  }

  function drawLantern(mx, my) {
    lCtx.clearRect(0, 0, W, H)
    if (mx < 0) return
    const R = CONFIG.lanternRadius
    const og = lCtx.createRadialGradient(mx, my, 0, mx, my, R)
    og.addColorStop(0, 'rgba(200,255,80,0.13)')
    og.addColorStop(0.25, 'rgba(200,255,80,0.09)')
    og.addColorStop(0.55, 'rgba(200,255,80,0.04)')
    og.addColorStop(1, 'rgba(200,255,80,0)')
    lCtx.beginPath(); lCtx.arc(mx, my, R, 0, Math.PI * 2)
    lCtx.fillStyle = og; lCtx.fill()
    const ig = lCtx.createRadialGradient(mx, my, 0, mx, my, 40)
    ig.addColorStop(0, 'rgba(255,255,220,0.10)')
    ig.addColorStop(0.5, 'rgba(255,255,200,0.04)')
    ig.addColorStop(1, 'rgba(255,255,200,0)')
    lCtx.beginPath(); lCtx.arc(mx, my, 40, 0, Math.PI * 2)
    lCtx.fillStyle = ig; lCtx.fill()
  }

  function makeV(init) {
    const tl = CONFIG.dropMinTail + Math.random() * (CONFIG.dropMaxTail - CONFIG.dropMinTail)
    const col = Math.floor(Math.random() * totalCols)
    return {
      type: 'v', px: colPositions[col],
      y: init ? -Math.random() * (H + tl) : -tl,
      speed: CONFIG.dropMinSpeed + Math.random() * (CONFIG.dropMaxSpeed - CONFIG.dropMinSpeed),
      tailLen: tl
    }
  }
  function makeH(init) {
    const tl = CONFIG.dropMinTail + Math.random() * (CONFIG.dropMaxTail - CONFIG.dropMinTail)
    const row = Math.floor(Math.random() * totalRows)
    return {
      type: 'h', py: rowPositions[row],
      x: init ? -Math.random() * (W + tl) : -tl,
      speed: CONFIG.dropMinSpeed + Math.random() * (CONFIG.dropMaxSpeed - CONFIG.dropMinSpeed),
      tailLen: tl
    }
  }
  function spawnInitial() {
    const nV = Math.max(1, Math.floor(totalCols * CONFIG.initDensity))
    const nH = Math.max(1, Math.floor(totalRows * CONFIG.initDensity))
    for (let i = 0; i < nV; i++) drops.push(makeV(true))
    for (let i = 0; i < nH; i++) drops.push(makeH(true))
  }
  function drawDrops(dt) {
    dCtx.clearRect(0, 0, W, H)
    const [r, g, b] = CONFIG.accentColor
    drops = drops.filter(d => {
      if (d.type === 'v') {
        d.y += d.speed * dt
        const head = d.y, tail = d.y - d.tailLen
        if (head > H + d.tailLen) return false
        const grad = dCtx.createLinearGradient(0, tail, 0, head)
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`)
        grad.addColorStop(0.5, `rgba(${r},${g},${b},0.5)`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0.95)`)
        dCtx.beginPath(); dCtx.strokeStyle = grad; dCtx.lineWidth = 1
        dCtx.moveTo(d.px, Math.max(0, tail)); dCtx.lineTo(d.px, Math.min(H, head)); dCtx.stroke()
        dCtx.beginPath(); dCtx.arc(d.px, Math.min(H - 1, head), 1.5, 0, Math.PI * 2)
        dCtx.fillStyle = '#dfffaa'; dCtx.fill()
        return true
      } else {
        d.x += d.speed * dt
        const head = d.x, tail = d.x - d.tailLen
        if (head > W + d.tailLen) return false
        const grad = dCtx.createLinearGradient(tail, 0, head, 0)
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`)
        grad.addColorStop(0.5, `rgba(${r},${g},${b},0.5)`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0.95)`)
        dCtx.beginPath(); dCtx.strokeStyle = grad; dCtx.lineWidth = 1
        dCtx.moveTo(Math.max(0, tail), d.py); dCtx.lineTo(Math.min(W, head), d.py); dCtx.stroke()
        dCtx.beginPath(); dCtx.arc(Math.min(W - 1, head), d.py, 1.5, 0, Math.PI * 2)
        dCtx.fillStyle = '#dfffaa'; dCtx.fill()
        return true
      }
    })
  }
  function spawnRandom(ts) {
    if (ts < nextSpawn) return
    drops.push(Math.random() < 0.5 ? makeH(false) : makeV(false))
    nextSpawn = ts + CONFIG.spawnMin + Math.random() * (CONFIG.spawnMax - CONFIG.spawnMin)
  }

  function loop(ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05)
    lastTime = ts
    smoothMX += (mouseX - smoothMX) * 0.1
    smoothMY += (mouseY - smoothMY) * 0.1
    drawGrid()
    drawLantern(mouseX < 0 ? -999 : smoothMX, mouseX < 0 ? -999 : smoothMY)
    drawDrops(dt)
    spawnRandom(ts)
    animId = requestAnimationFrame(loop)
  }

  resize()
  window.addEventListener('resize', resize)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseleave', onMouseLeave)
  animId = requestAnimationFrame(loop)

  return () => {
    window.removeEventListener('resize', resize)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseleave', onMouseLeave)
    if (animId) cancelAnimationFrame(animId)
  }
}
