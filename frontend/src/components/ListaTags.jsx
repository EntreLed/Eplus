export default function ListaTags({ label, items, style }) {
  if (!items?.length) return null
  if (label) {
    return (
      <div className="pp-instalacoes" style={style}>
        <span className="pp-label">{label}</span>
        <div className="pp-tags">
          {items.map(t => <span key={t} className="pp-tag">{t}</span>)}
        </div>
      </div>
    )
  }
  return (
    <div className="pp-tags" style={style}>
      {items.map(t => <span key={t} className="pp-tag">{t}</span>)}
    </div>
  )
}
