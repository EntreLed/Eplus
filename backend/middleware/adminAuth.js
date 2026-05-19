import jwt from "jsonwebtoken"

export default function adminAuth(req,res,next){

  const token = req.cookies?.token

  if(!token){
    return res.status(401).json({erro:"Token não fornecido"})
  }

  try{

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if(decoded.role !== "administrador"){
      return res.status(403).json({
        erro:"Acesso apenas para administradores"
      })
    }

    req.user = decoded

    next()

  }catch(error){

    return res.status(401).json({
      erro:"Token inválido"
    })

  }

}