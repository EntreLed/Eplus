const S = {
  pageHead: { background: "#013634", padding: "28px 0 24px" },
  pageHeadInner: { maxWidth: 1200, margin: "0 auto", padding: "0 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
  pageHeadLabel: { fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  pageTitle: { fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: -0.3, margin: 0 },
  statChip: { display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 16px" },
  statNum: { fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 },
}

export default function CabecalhoPagina({ label, title, stats = [], action }) {
  return (
    <div style={S.pageHead}>
      <div style={S.pageHeadInner}>
        <div>
          {label && <div style={S.pageHeadLabel}>{label}</div>}
          <h1 style={S.pageTitle}>{title}</h1>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {stats.map((s, i) => (
            <div key={i} style={S.statChip}>
              <span style={{ ...S.statNum, ...(s.color ? { color: s.color } : {}) }}>{s.num}</span>
              <span style={S.statLabel}>{s.label}</span>
            </div>
          ))}
          {action && (
            <button style={action.style} onClick={action.onClick}>
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
