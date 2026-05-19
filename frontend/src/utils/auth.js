export function getUserRole() {
  return localStorage.getItem("userRole")
}

export function isTokenValido() {
  const exp = localStorage.getItem("userExp")
  if (!exp) return false
  return parseInt(exp) * 1000 > Date.now()
}

export async function fetchAutenticado(url, opcoes = {}) {
  const res = await fetch(url, {
    ...opcoes,
    credentials: "include",
    headers: { ...opcoes.headers },
  })
  if (res.status === 401) {
    localStorage.removeItem("userRole")
    localStorage.removeItem("userExp")
    window.location.replace("/sessao-expirada")
  }
  if (res.status === 403) {
    window.location.replace("/sem-permissao")
  }
  return res
}
