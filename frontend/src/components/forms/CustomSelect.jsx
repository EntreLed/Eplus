import { useState, useRef, useEffect, Children } from "react"
import "./forms_css/CustomSelect.css"

function CustomSelect({ value, onChange, children, style, className, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const options = []
  Children.forEach(children, child => {
    if (!child) return
    const v = child.props?.value ?? ""
    const label = child.props?.children
    options.push({ value: v, label: label != null ? String(label) : String(v), isPlaceholder: v === "" })
  })

  const current = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  function select(val) {
    onChange({ target: { value: val } })
    setOpen(false)
  }

  const isEmpty = !current || current.value === ""

  return (
    <div
      ref={ref}
      className={`cs-wrap${open ? " cs-open" : ""}${className ? " " + className : ""}`}
      style={style}
    >
      <button
        type="button"
        className="cs-trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        <span className={`cs-value${isEmpty ? " cs-placeholder" : ""}`}>
          {current?.label || ""}
        </span>
        <svg className="cs-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="cs-dropdown">
          {options.map((opt, i) => (
            <div
              key={i}
              className={`cs-option${opt.value === value ? " cs-selected" : ""}${opt.isPlaceholder ? " cs-placeholder-opt" : ""}`}
              onMouseDown={() => select(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CustomSelect
