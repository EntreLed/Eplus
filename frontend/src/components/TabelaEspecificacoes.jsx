export default function TabelaEspecificacoes({ rows, style }) {
  const visible = rows.filter(r => r.value != null && r.value !== false && r.value !== "")
  if (!visible.length) return null
  return (
    <table className="pp-tabela" style={style}>
      <tbody>
        {visible.map((r, i) => (
          <tr key={i}>
            <td>{r.label}</td>
            <td>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
