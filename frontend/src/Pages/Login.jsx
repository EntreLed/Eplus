import { API_URL } from '../utils/api'
import { useState } from "react"
import "./estilosPages/Login.css"
import EfeitosFundo from "../components/EfeitosFundo"

function Login() {

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [erroEmail, setErroEmail] = useState("")
  const [erroPass, setErroPass] = useState("")
  const [showPass, setShowPass] = useState(false)

  async function login() {
    setErroEmail("")
    setErroPass("")

    if (!email.trim()) { setErroEmail("Introduza o seu email."); return }
    if (!password.trim()) { setErroPass("Introduza a sua password."); return }

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      })
      const data = await response.json()
      if (data.role) {
        localStorage.setItem("userRole", data.role)
        localStorage.setItem("userExp", String(data.exp))
        if (data.token) localStorage.setItem("token", data.token)
        window.location.href = "/"
      } else if (data.erro) {
        setErroPass(data.erro)
      } else {
        setErroPass("Email ou password incorretos.")
      }
    } catch (error) {
      console.error(error)
      setErroPass("Erro ao comunicar com o servidor.")
    }
  }

  return (
    <div className="login-wrapper">

      <EfeitosFundo className="login-bg-scene" />

      <div className="login-card">

        <div className="login-header">
          <img src="/icons/eplus-logo.png" alt="EPLUS Lighting" className="login-logo-img" />
          <div className="login-badge">ACESSO RESTRITO</div>
        </div>

        <div className="login-body">
          <h1 className="login-title">Iniciar sessão</h1>

          <div className="login-form">

            <div className="form-group">
              <label>Email</label>
              <input
                className={`form-input${erroEmail ? " login-input-erro" : ""}`}
                type="email"
                placeholder="email@eplus.pt"
                value={email}
                onChange={e => { setEmail(e.target.value); setErroEmail("") }}
                onKeyDown={e => e.key === "Enter" && login()}
              />
              {erroEmail && <span className="login-field-erro">{erroEmail}</span>}
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="login-password-wrap">
                <input
                  className={`form-input${erroPass ? " login-input-erro" : ""}`}
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErroPass("") }}
                  onKeyDown={e => e.key === "Enter" && login()}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                >
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {erroPass && <span className="login-field-erro">{erroPass}</span>}
            </div>

            <button className="login-btn" onClick={login}>
              ENTRAR
            </button>

          </div>
        </div>

        <button className="login-back-btn" onClick={() => window.location.href = "/"}>
          Voltar ao início
        </button>

      </div>
    </div>
  )
}

export default Login
