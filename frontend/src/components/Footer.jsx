import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { getUserRole, isTokenValido } from "../utils/auth"
import { API_URL } from "../utils/api"
import "./components_css/Footer.css"

function Footer() {
  const token = isTokenValido()
  const role = getUserRole()
  const navigate = useNavigate()

  const [cliques, setCliques] = useState(0)
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickFora(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownAberto(false)
      }
    }
    document.addEventListener("mousedown", handleClickFora)
    return () => document.removeEventListener("mousedown", handleClickFora)
  }, [])

  async function logout() {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" })
    } catch (_) {}
    localStorage.removeItem("userRole")
    localStorage.removeItem("userExp")
    window.location.href = "/"
  }

  function handleLogoClick() {
    if (token) {
      setDropdownAberto(a => !a)
      return
    }
    const novo = cliques + 1
    setCliques(novo)
    if (novo >= 3) {
      setCliques(0)
      navigate("/login")
    }
  }

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button className="footer-logo-btn" onClick={handleLogoClick} aria-label="EPLUS">
            <img src="/icons/eplus-logo.png" alt="EPLUS Lighting" className="footer-logo" />
          </button>

          {dropdownAberto && token && (
            <div className="footer-dropdown">
              <div className="footer-dropdown-role">
                {role === "administrador" ? "Administrador" : "Moderador"}
              </div>
              <button className="footer-dropdown-btn" onClick={logout}>
                Sair
              </button>
            </div>
          )}
        </div>

        <span className="footer-copy">&copy; {new Date().getFullYear()} EPLUS Lighting. Todos os direitos reservados.</span>
      </div>
    </footer>
  )
}

export default Footer
