import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { getUserRole, isTokenValido } from "../utils/auth"
import "./components_css/Navbar.css"

function Navbar() {

  const token = isTokenValido()
  const role = getUserRole()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuAberto, setMenuAberto] = useState(false)

  function isActive(path) {
    if (path === "/admin") return location.pathname === "/admin"
    return location.pathname.startsWith(path)
  }

  function fechar() { setMenuAberto(false) }

  return (
    <nav className="nav">
      <div className="nav-inner">

        {/* Logo */}
        <Link to="/" className="nav-logo" onClick={fechar}>
          <img src="/icons/eplus-logo.png" alt="EPLUS Lighting" className="nav-logo-img" />
        </Link>

        {/* Links (desktop) */}
        <div className="nav-links">
          <Link to="/configurador" className={`nav-link${isActive("/configurador") ? " ativo" : ""}`}>
            Configurador AI
            {isActive("/configurador") && <span className="nav-link-underline" />}
          </Link>

          <Link to="/catalogo" className={`nav-link${isActive("/catalogo") ? " ativo" : ""}`}>
            Catálogo
            {isActive("/catalogo") && <span className="nav-link-underline" />}
          </Link>

          {token && (
            <Link to="/admin/produtos" className={`nav-link${isActive("/admin/produtos") ? " ativo" : ""}`}>
              Produtos
              {isActive("/admin/produtos") && <span className="nav-link-underline" />}
            </Link>
          )}

          {token && role === "administrador" && (
            <Link to="/admin" className={`nav-link${isActive("/admin") ? " ativo" : ""}`}>
              Administração
              {isActive("/admin") && <span className="nav-link-underline" />}
            </Link>
          )}

          {token && role === "administrador" && (
            <Link to="/admin/logs" className={`nav-link${isActive("/admin/logs") ? " ativo" : ""}`}>
              Logs
              {isActive("/admin/logs") && <span className="nav-link-underline" />}
            </Link>
          )}
        </div>

        {/* Direita (desktop) */}
        <div className="nav-right">
          <a onClick={() => navigate("/servicos")} className="nav-servicos" style={{ cursor: "pointer" }}>
            <img src="/icons/servicos.png" alt="Serviços" className="nav-servicos-img" />
            <span className="nav-servicos-texto">SERVIÇOS DE PERSONALIZAÇÃO</span>
          </a>
        </div>

        {/* Hambúrguer (mobile) */}
        <button className="nav-hamburger" onClick={() => setMenuAberto(o => !o)} aria-label="Menu">
          <span />
          <span />
          <span />
        </button>

      </div>

      {/* Overlay + menu lateral mobile */}
      {menuAberto && (
        <div className="nav-mobile-overlay" onClick={fechar}>
          <div className="nav-mobile-menu" onClick={e => e.stopPropagation()}>
            <button className="nav-mobile-close" onClick={fechar}>✕</button>

            <Link to="/configurador" className={`nav-mobile-link${isActive("/configurador") ? " ativo" : ""}`} onClick={fechar}>
              Configurador AI
            </Link>
            <Link to="/catalogo" className={`nav-mobile-link${isActive("/catalogo") ? " ativo" : ""}`} onClick={fechar}>
              Catálogo
            </Link>
            <Link to="/servicos" className={`nav-mobile-link${isActive("/servicos") ? " ativo" : ""}`} onClick={fechar}>
              Serviços
            </Link>
            {token && (
              <Link to="/admin/produtos" className={`nav-mobile-link${isActive("/admin/produtos") ? " ativo" : ""}`} onClick={fechar}>
                Produtos
              </Link>
            )}
            {token && role === "administrador" && (
              <Link to="/admin" className={`nav-mobile-link${isActive("/admin") ? " ativo" : ""}`} onClick={fechar}>
                Administração
              </Link>
            )}
            {token && role === "administrador" && (
              <Link to="/admin/logs" className={`nav-mobile-link${isActive("/admin/logs") ? " ativo" : ""}`} onClick={fechar}>
                Logs
              </Link>
            )}
          </div>
        </div>
      )}

    </nav>
  )
}

export default Navbar
