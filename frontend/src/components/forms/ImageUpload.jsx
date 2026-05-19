import { useState, useEffect } from "react"

const MAX_SIZE_MB = 5
const MAX_WIDTH = 4000
const MAX_HEIGHT = 4000

function ImageUpload({ label, currentUrl, onChange, error, style }) {
  const [preview, setPreview] = useState(null)
  const [cleared, setCleared] = useState(false)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  function handle(e) {
    const file = e.target.files[0] ?? null
    if (preview) URL.revokeObjectURL(preview)
    setAviso(null)

    if (file) {
      const sizeMB = file.size / (1024 * 1024)
      if (sizeMB > MAX_SIZE_MB) {
        setAviso(`Imagem demasiado pesada (${sizeMB.toFixed(1)} MB). Máximo: ${MAX_SIZE_MB} MB.`)
      }
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        if (img.width > MAX_WIDTH || img.height > MAX_HEIGHT) {
          setAviso(prev => (prev ? prev + " " : "") + `Dimensões muito grandes (${img.width}×${img.height}px). Máximo: ${MAX_WIDTH}×${MAX_HEIGHT}px.`)
        }
        URL.revokeObjectURL(url)
      }
      img.src = url
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }
    setCleared(false)
    onChange(file)
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setCleared(true)
    onChange(null)
  }

  const shown = preview || (!cleared && currentUrl)

  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      {shown && (
        <div style={{ position: "relative", display: "inline-block", width: "fit-content", marginBottom: "6px" }}>
          <img
            src={shown}
            alt=""
            style={{
              height: "72px",
              display: "block",
              borderRadius: "6px",
              border: "1.5px solid #DDE8E7",
              objectFit: "contain",
              background: "#F4F9F8",
              padding: "4px"
            }}
          />
          <button
            type="button"
            onClick={clear}
            style={{
              position: "absolute",
              top: "-6px",
              right: "-6px",
              background: "#C0392B",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              width: "18px",
              height: "18px",
              cursor: "pointer",
              fontSize: "10px",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Spartan MB', sans-serif",
              fontWeight: 700,
              lineHeight: 1,
              flexShrink: 0
            }}
          >
            ✕
          </button>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handle}
        style={error ? { ...style, borderColor: "#E74C3C", borderStyle: "solid" } : style}
      />
      {aviso && <span className="campo-erro">{aviso}</span>}
      {error && <span className="campo-erro">{error}</span>}
    </div>
  )
}

export default ImageUpload
