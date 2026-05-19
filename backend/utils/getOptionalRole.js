import jwt from "jsonwebtoken"

export function getOptionalRole(req) {
  const token = req.cookies?.token
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET).role?.toLowerCase()
  } catch (_) {
    return null
  }
}
