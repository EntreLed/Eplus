import { API_URL } from '../utils/api'
import { useEffect, useState } from "react"
import Popup from "../components/Popup"
import DialogoConfirmacao from "../components/DialogoConfirmacao"
import CabecalhoPagina from "../components/CabecalhoPagina"
import "../components/components_css/Popup.css"
import { isTokenValido, fetchAutenticado } from "../utils/auth"

function Admin(){

  const [contas,setContas] = useState([])
  const [mostrarPopup,setMostrarPopup] = useState(false)

  const [mostrarPopupDelete,setMostrarPopupDelete] = useState(false)
  const [contaParaApagar,setContaParaApagar] = useState(null)

  const [mostrarPopupEliminar,setMostrarPopupEliminar] = useState(false)
  const [contaParaEliminar,setContaParaEliminar] = useState(null)

  const [novaConta,setNovaConta] = useState({
    utilizador_id:null,
    nome:"",
    email:"",
    password:"",
    confirmarPassword:"",
    role_id:2,
    ativo:true
  })


  async function carregarContas(){
    if (!isTokenValido()) { window.location.replace("/login"); return }
    const response = await fetchAutenticado(`${API_URL}/api/utilizadores`)
    const data = await response.json()
    setContas(Array.isArray(data) ? data : [])
  }

  useEffect(()=>{
    carregarContas()
  },[])



  function abrirEdicao(conta){

    setNovaConta({
      utilizador_id:conta.utilizador_id,
      nome:conta.nome,
      email:conta.email,
      password:"",
      confirmarPassword:"",
      role_id:conta.role_id,
      ativo:conta.ativo
    })

    setMostrarPopup(true)

  }


  async function criarConta(){

    if(novaConta.password !== novaConta.confirmarPassword){
      alert("Passwords não coincidem")
      return
    }

    let url = `${API_URL}/api/utilizadores`
    let method = "POST"

    if(novaConta.utilizador_id){
      url += "/"+novaConta.utilizador_id
      method = "PUT"
    }

    const response = await fetchAutenticado(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novaConta)
    })

    await response.json()

    await carregarContas()

    setMostrarPopup(false)

  }

  function apagarConta(id){
    setContaParaApagar(id)
    setMostrarPopupDelete(true)
  }

  async function confirmarApagar(){

    await fetchAutenticado(
      `${API_URL}/api/utilizadores/` + contaParaApagar,
      { method: "DELETE" }
    )

    setMostrarPopupDelete(false)
    setContaParaApagar(null)
    await carregarContas()
  }

  function eliminarConta(id){
    setContaParaEliminar(id)
    setMostrarPopupEliminar(true)
  }

  async function confirmarEliminar(){

    await fetchAutenticado(
      `${API_URL}/api/utilizadores/` + contaParaEliminar + "/permanente",
      { method: "DELETE" }
    )

    setMostrarPopupEliminar(false)
    setContaParaEliminar(null)
    await carregarContas()
  }

  const roleLabel = { 1: "Administrador", 2: "Moderador" }
  const ativas = contas.filter(c => c.ativo).length

  return(

    <div style={{ background: "#F4F9F8", minHeight: "calc(100vh - 68px)" }}>

      <CabecalhoPagina
        label="ADMINISTRAÇÃO"
        title="Gestão de Contas"
        stats={[
          { num: contas.length, label: "Total" },
          { num: ativas, label: "Ativas", color: "#CEF60C" },
        ]}
        action={{
          label: "+ NOVA CONTA",
          style: adS.newBtn,
          onClick: () => {
            setNovaConta({ utilizador_id:null, nome:"", email:"", password:"", confirmarPassword:"", role_id:2, ativo:true })
            setMostrarPopup(true)
          }
        }}
      />

      {/* Tabela */}
      <div style={adS.tableSection}>
        <div style={adS.tableBar}>UTILIZADORES</div>
        <div style={{ background: "#fff", borderRadius: "0 0 8px 8px", overflow: "hidden", border: "1.5px solid #DDE8E7", borderTop: "none" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Nome</th>
                <th>Email</th>
                <th>Função</th>
                <th>Estado</th>
                <th style={{ width: 90 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => (
                <tr key={"conta_"+conta.utilizador_id}>
                  <td style={{ color: "#9BAFAD", fontWeight: 400, fontSize: 12 }}>{conta.utilizador_id}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={adS.avatar}>{conta.nome?.charAt(0).toUpperCase()}</div>
                      <span style={{ fontWeight: 700, color: "#013634" }}>{conta.nome}</span>
                    </div>
                  </td>
                  <td style={{ color: "#5A7472", fontSize: 13 }}>{conta.email}</td>
                  <td>
                    <span className={`badge ${conta.role_id === 1 ? "badge-lime" : "badge-green"}`}>
                      {conta.role || roleLabel[conta.role_id]}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${conta.ativo ? "badge-green" : "badge-red"}`}>
                      {conta.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={adS.actionBtn} title="Editar" onClick={() => abrirEdicao(conta)}>✏</button>
                      {conta.ativo ? (
                        <button style={{ ...adS.actionBtn, color: "#C0392B", borderColor: "#F5C6C6" }} title="Desativar" onClick={() => apagarConta(conta.utilizador_id)}>🗑</button>
                      ) : (
                        <button style={{ ...adS.actionBtn, color: "#C0392B", borderColor: "#F5C6C6", background: "#FFF0F0" }} title="Eliminar permanentemente" onClick={() => eliminarConta(conta.utilizador_id)}>✕</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Popup criar/editar conta */}
      {mostrarPopup && (
        <Popup
          titulo={novaConta.utilizador_id ? "Editar Conta" : "Criar Nova Conta"}
          onClose={() => setMostrarPopup(false)}
        >
          <input
            className="form-input"
            placeholder="Nome"
            value={novaConta.nome}
            onChange={e => setNovaConta({...novaConta, nome: e.target.value})}
          />
          <input
            className="form-input"
            placeholder="Email"
            value={novaConta.email}
            onChange={e => setNovaConta({...novaConta, email: e.target.value})}
          />
          <input
            className="form-input"
            type="password"
            placeholder="Password"
            value={novaConta.password}
            onChange={e => setNovaConta({...novaConta, password: e.target.value})}
          />
          <input
            className="form-input"
            type="password"
            placeholder="Repetir password"
            value={novaConta.confirmarPassword}
            onChange={e => setNovaConta({...novaConta, confirmarPassword: e.target.value})}
          />
          <select
            className="form-select"
            value={novaConta.role_id}
            onChange={e => setNovaConta({...novaConta, role_id: parseInt(e.target.value)})}
          >
            <option value={2}>Moderador</option>
            <option value={1}>Administrador</option>
          </select>
          <select
            className="form-select"
            value={String(novaConta.ativo)}
            onChange={e => setNovaConta({...novaConta, ativo: e.target.value === "true"})}
          >
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
          <div className="popup-buttons">
            <button style={adS.submitBtn} onClick={criarConta}>
              {novaConta.utilizador_id ? "Guardar alterações" : "Criar conta"}
            </button>
            <button className="btn-ghost" onClick={() => setMostrarPopup(false)}>Cancelar</button>
          </div>
        </Popup>
      )}

      <DialogoConfirmacao
        isOpen={mostrarPopupDelete}
        titulo="Confirmar desativação"
        mensagem="Tem a certeza que pretende desativar esta conta?"
        labelConfirmar="Desativar"
        onConfirmar={confirmarApagar}
        onCancelar={() => setMostrarPopupDelete(false)}
      />

      <DialogoConfirmacao
        isOpen={mostrarPopupEliminar}
        titulo="Eliminar conta permanentemente"
        mensagemBold="Atenção: esta ação é irreversível."
        mensagem="A conta será eliminada definitivamente da base de dados. Tem a certeza?"
        labelConfirmar="Eliminar permanentemente"
        onConfirmar={confirmarEliminar}
        onCancelar={() => setMostrarPopupEliminar(false)}
      />

    </div>

  )

}

const adS = {
  tableSection: { maxWidth: 1200, margin: "0 auto", padding: "28px 32px 64px" },
  tableBar: { background: "#013634", color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 800, letterSpacing: 2, padding: "9px 16px", borderRadius: "8px 8px 0 0" },
  avatar: { width: 32, height: 32, borderRadius: "50%", background: "#E6F3F2", color: "#03736F", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  actionBtn: { background: "none", border: "1px solid #DDE8E7", borderRadius: 4, cursor: "pointer", width: 30, height: 30, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#5A7472", fontFamily: "'Spartan MB', sans-serif" },
  submitBtn: { background: "#013634", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 900, padding: "10px 20px", letterSpacing: 1.2, fontFamily: "'Spartan MB', sans-serif" },
  newBtn: { background: "#CEF60C", color: "#013634", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 900, padding: "10px 20px", letterSpacing: 1, fontFamily: "'Spartan MB', sans-serif" },
}

export default Admin
