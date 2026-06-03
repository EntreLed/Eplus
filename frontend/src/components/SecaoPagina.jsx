export default function SecaoPagina({ title, children }) {
  return (
    <section className="pp-secao">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
