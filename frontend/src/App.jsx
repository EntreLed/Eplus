import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"

import Navbar from "./components/Navbar"
import Footer from "./components/Footer"
import AvisoCookies from "./components/AvisoCookies"
import RotaProtegida from "./components/RotaProtegida"

import Home from "./Pages/Home"
import Catalogo from "./Pages/Catalogo"
import Configurador from "./Pages/Configurador"
import Login from "./Pages/Login"
import Admin from "./Pages/Admin"
import GestaoProdutos from "./Pages/GestaoProdutos"
import PaginaProduto from "./Pages/PaginaProduto"
import EditarProduto from "./Pages/EditarProduto"
import Logs from "./Pages/Logs"
import Servicos from "./Pages/Servicos"
import Erro401 from "./Pages/Erro401"
import Erro403 from "./Pages/Erro403"
import Erro404 from "./Pages/Erro404"

function Layout() {

  const location = useLocation()
  const esconderNavbar = ["/login"].includes(location.pathname)
  const esconderFooter = ["/login", "/"].includes(location.pathname)

  return (
    <>
      {!esconderNavbar && <Navbar/>}
      <AvisoCookies/>
      <Routes>

        <Route path="/" element={<Home/>} />

        <Route path="/catalogo" element={<Catalogo/>} />

        <Route path="/configurador" element={<Configurador/>} />

        <Route path="/login" element={<Login/>} />

        <Route path="/admin" element={<RotaProtegida role="administrador"><Admin/></RotaProtegida>} />

        <Route path="/admin/produtos" element={<RotaProtegida role="administrador"><GestaoProdutos/></RotaProtegida>} />

        <Route path="/produto/:id" element={<PaginaProduto/>} />

        <Route path="/produto/:id/editar" element={<RotaProtegida role="administrador"><EditarProduto/></RotaProtegida>} />

        <Route path="/admin/logs" element={<RotaProtegida role="administrador"><Logs/></RotaProtegida>} />

        <Route path="/servicos" element={<Servicos/>} />

        <Route path="/sessao-expirada" element={<Erro401/>} />
        <Route path="/sem-permissao" element={<Erro403/>} />
        <Route path="*" element={<Erro404/>} />

      </Routes>
      {!esconderNavbar && <Footer/>}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Layout/>
    </BrowserRouter>
  )
}

export default App
