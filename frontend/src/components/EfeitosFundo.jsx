import { useEffect, useRef } from "react"
import { initBgEffect } from "../utils/EfeitoBG"

export default function EfeitosFundo({ className }) {
  const wrapperRef = useRef(null)
  const gridRef   = useRef(null)
  const lightRef  = useRef(null)
  const dropRef   = useRef(null)

  useEffect(() => {
    return initBgEffect(wrapperRef.current, gridRef.current, lightRef.current, dropRef.current)
  }, [])

  return (
    <div ref={wrapperRef} className={className}>
      <canvas ref={gridRef} />
      <canvas ref={lightRef} />
      <canvas ref={dropRef} />
    </div>
  )
}
