import { Navigate } from "react-router-dom"
import { isTokenValido, getUserRole } from "../utils/auth"

export default function RotaProtegida({ children, role }) {
  if (!isTokenValido()) return <Navigate to="/login" replace />
  if (role && getUserRole() !== role) return <Navigate to="/sem-permissao" replace />
  return children
}
