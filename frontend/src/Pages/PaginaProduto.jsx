import { API_URL } from '../utils/api'
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getUserRole } from "../utils/auth"
import ListaTags from "../components/ListaTags"
import SecaoPagina from "../components/SecaoPagina"
import TabelaEspecificacoes from "../components/TabelaEspecificacoes"
import "./estilosPages/PaginaProduto.css"

const corPorCodigo = {
  "A": "#9e9e9e",
  "B": "#1a1a1a",
  "W": "#f5f5f5",
  "RAL": "repeating-linear-gradient(90deg, #e63946 0% 20%, #f4a261 20% 40%, #2a9d8f 40% 60%, #457b9d 60% 80%, #6a4c93 80% 100%)"
}

function estiloCorDot(codigo) {
  const valor = corPorCodigo[codigo?.toUpperCase()]
  return valor ? { background: valor } : {}
}

function PaginaProduto() {

  const { id } = useParams()
  const navigate = useNavigate()
  const [produto, setProduto] = useState(null)
  const [tipo, setTipo] = useState(null)
  const [erro, setErro] = useState(null)
  const role = getUserRole()?.toLowerCase()
  const podeEditar = role === "administrador" || role === "moderador"

  useEffect(() => {
    async function carregar() {
      const tipoRes = await fetch(`${API_URL}/api/produto/${id}`)
      if (!tipoRes.ok) {
        setErro("Produto não encontrado")
        return
      }
      const { tipo, endpoint } = await tipoRes.json()

      const res = await fetch(`${API_URL}/api/${endpoint}/${id}`)
      if (!res.ok) {
        setErro("Produto não encontrado")
        return
      }
      const data = await res.json()
      setProduto(data)
      setTipo(tipo)
    }
    carregar()
  }, [id])

  if (erro) return (
    <div className="pp-erro">
      <p>{erro}</p>
      <button onClick={() => navigate(-1)}>Voltar</button>
    </div>
  )

  if (!produto) return <div className="pp-loading">A carregar...</div>

  return (
    <div className="pp-container">

      <div className="pp-topbar">
        <div className="pp-topbar-inner">
          <button className="pp-voltar" onClick={() => navigate(-1)}>Voltar</button>
          {podeEditar && (
            <div className="pp-acoes-admin">
              {produto.ativo === false && (
                <span className="pp-badge-desativado">DESATIVADO</span>
              )}
              <button className="pp-btn-editar" onClick={() => navigate(`/produto/${id}/editar`)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hero */}
      <section className="pp-hero">
        <div className="pp-hero-inner">
        <div className="pp-imagens">
          <img
            src={produto.imagem_url}
            alt={produto.nome}
            className="pp-imagem-principal"
          />
          {produto.imagem_extra_url && tipo !== "acessorio" && (
            <img
              src={produto.imagem_extra_url}
              alt={`${produto.nome} extra`}
              className="pp-imagem-extra"
            />
          )}
        </div>

        <div className="pp-info">
          <p className="pp-categoria">
            {produto.categoria || (tipo === "kit" ? "Kit" : "")}
            {produto.subcategoria ? ` › ${produto.subcategoria.replace(/_/g, " ")}` : ""}
            {tipo === "acessorio" && produto.tipo_acessorio ? ` › ${produto.tipo_acessorio.replace(/_/g, " ")}` : ""}
          </p>
          <div className="pp-nome-linha">
            <h1 className="pp-nome">{produto.nome}</h1>
            {produto.ficha_tecnica_url && (
              <a
                href={produto.ficha_tecnica_url}
                target="_blank"
                rel="noopener noreferrer"
                className="pp-ficha-tecnica-btn"
              >
                Ficha Técnica (PDF)
              </a>
            )}
          </div>
          <p className="pp-ref">Ref: {produto.referencia}</p>

          {produto.descricao && (
            <p className="pp-descricao">{produto.descricao}</p>
          )}

          <ListaTags label="Instalação:" items={produto.instalacoes} />

          {tipo === "fita_led" && produto.tipos_cor && (
            <ListaTags label="Tipo de cor:" items={produto.tipos_cor.split(" + ")} />
          )}

          <ListaTags label="Tipos de controlo:" items={tipo === "comando" ? produto.tipos_controlo : null} />

          {tipo === "kit" && (
            <>
              <ListaTags label="Tipos de controlo:" items={produto.receiver?.receiver_tipos_controlo} />
              <ListaTags label="Tipos de sinal:" items={produto.receiver?.receiver_tipos_sinal} />
            </>
          )}
        </div>
        </div>
      </section>

      {/* Características (power) */}
      {tipo === "power" && produto.caracteristicas?.length > 0 && (
        <SecaoPagina title="Características">
          <ListaTags items={produto.caracteristicas} />
        </SecaoPagina>
      )}

      {/* Especificações técnicas */}
      <SecaoPagina title="Especificações Técnicas">

        {tipo === "perfil" && (
          <>
            <TabelaEspecificacoes rows={[
              { label: "Material", value: produto.material },
              { label: "Largura externa", value: produto.largura_externa_mm != null ? `${produto.largura_externa_mm} mm` : null },
              { label: "Altura externa", value: produto.altura_externa_mm != null ? `${produto.altura_externa_mm} mm` : null },
              { label: "Espaçamento interno", value: produto.espacamento_interno_mm != null ? `${produto.espacamento_interno_mm} mm` : null },
              { label: "Potência máxima", value: produto.potencia_max_w_m != null ? `${produto.potencia_max_w_m} W/m` : null },
              { label: "Largura máx. fita LED", value: produto.max_largura_fita_mm != null ? `${produto.max_largura_fita_mm} mm` : null },
              { label: "Quantidade máx. fitas", value: produto.max_quantidade_fitas },
              { label: "Garantia", value: produto.garantia_anos != null ? `${produto.garantia_anos} anos` : null },
            ]} />
            {produto.imagem_medidas_url && (
              <div className="pp-imagem-medidas-wrap">
                <img src={produto.imagem_medidas_url} alt="Diagrama de medidas" className="pp-imagem-medidas" />
              </div>
            )}
          </>
        )}

        {tipo === "fita_led" && (
          <TabelaEspecificacoes rows={[
            { label: "Potência", value: produto.potencia_w_m != null ? `${produto.potencia_w_m} W/m` : null },
            { label: "Tipo LED", value: produto.tipo_led },
            { label: "Quantidade de LEDs/m", value: produto.quantidade_leds_m },
            { label: "Ângulo de abertura", value: produto.angulo_abertura != null ? `${produto.angulo_abertura}°` : null },
            { label: "Dimável", value: produto.dimavel != null ? (produto.dimavel ? "Sim" : "Não") : null },
            { label: "CRI", value: produto.cri },
            { label: "MacAdam", value: produto.macadam },
            { label: "Eficiência", value: produto.eficiencia_lm_w != null ? `${produto.eficiencia_lm_w} lm/W` : null },
            { label: "Horário de trabalho", value: produto.horario_trabalho_h },
            { label: "Largura", value: produto.largura_mm != null ? `${produto.largura_mm} mm` : null },
            { label: "Altura", value: produto.altura_mm != null ? `${produto.altura_mm} mm` : null },
            { label: "Comprimento de corte", value: produto.comprimento_corte_mm != null ? `${produto.comprimento_corte_mm} mm` : null },
            { label: "Comp. máx. alimentação única", value: produto.comprimento_max_alimentacao_m != null ? `${produto.comprimento_max_alimentacao_m} m` : null },
            { label: "Comp. máx. circuito fechado", value: produto.comprimento_max_circuito_m != null ? `${produto.comprimento_max_circuito_m} m` : null },
            { label: "Garantia", value: produto.garantia_anos != null ? `${produto.garantia_anos} anos` : null },
          ]} />
        )}

        {tipo === "neon" && (
          <>
            <TabelaEspecificacoes rows={[
              { label: "Potência", value: produto.potencia_w_m != null ? `${produto.potencia_w_m} W/m` : null },
              { label: "Quantidade de LEDs", value: produto.quantidade_leds },
              { label: "Ângulo de abertura", value: produto.angulo_abertura != null ? `${produto.angulo_abertura}°` : null },
              { label: "Dimável", value: produto.dimavel != null ? (produto.dimavel ? "Sim" : "Não") : null },
              { label: "CRI", value: produto.cri },
              { label: "MacAdam", value: produto.macadam },
              { label: "Material", value: produto.material },
              { label: "Horário de trabalho", value: produto.horario_trabalho_h != null ? `${produto.horario_trabalho_h} h` : null },
              { label: "Largura", value: produto.largura_mm != null ? `${produto.largura_mm} mm` : null },
              { label: "Altura", value: produto.altura_mm != null ? `${produto.altura_mm} mm` : null },
              { label: "Comp. máx. alimentação única", value: produto.comprimento_max_alimentacao_unica_m != null ? `${produto.comprimento_max_alimentacao_unica_m} m` : null },
              { label: "Comp. máx. circuito fechado", value: produto.comprimento_max_circuito_fechado_m != null ? `${produto.comprimento_max_circuito_fechado_m} m` : null },
              { label: "Garantia", value: produto.garantia_anos != null ? `${produto.garantia_anos} anos` : null },
            ]} />
            {produto.imagem_medidas_url && (
              <div className="pp-imagem-medidas-wrap">
                <img src={produto.imagem_medidas_url} alt="Diagrama de medidas" className="pp-imagem-medidas" />
              </div>
            )}
          </>
        )}

        {tipo === "controlador" && (
          <>
            <TabelaEspecificacoes rows={[
              { label: "IP", value: produto.ip != null ? `IP${produto.ip}` : null },
              { label: "Comprimento", value: produto.comprimento_mm != null ? `${produto.comprimento_mm} mm` : null },
              { label: "Largura", value: produto.largura_mm != null ? `${produto.largura_mm} mm` : null },
              { label: "Altura", value: produto.altura_mm != null ? `${produto.altura_mm} mm` : null },
              { label: "Cor", value: produto.cor },
              { label: "Unidades por caixa", value: produto.unidades_por_caixa },
              { label: "Certificações", value: produto.certificacoes?.length > 0 ? (Array.isArray(produto.certificacoes) ? produto.certificacoes.join(", ") : produto.certificacoes) : null },
              { label: "Preço", value: produto.preco != null ? `${Number(produto.preco).toFixed(2)} €` : null },
              { label: "Garantia", value: produto.garantia_anos != null ? `${produto.garantia_anos} anos` : null },
            ]} />

            <ListaTags label="Tipos de controlo:" items={produto.tipos_controlo} style={{ marginTop: 12 }} />
            <ListaTags label="Tipos de sinal:" items={produto.tipos_sinal} style={{ marginTop: 8 }} />

            {produto.entradas?.length > 0 && (
              <>
                <h3>Entradas</h3>
                <table className="pp-tabela">
                  <thead><tr><th>Tipo</th><th>V mín</th><th>V máx</th></tr></thead>
                  <tbody>
                    {produto.entradas.map((e, i) => (
                      <tr key={i}>
                        <td>{e.tipo_input ?? "-"}</td>
                        <td>{e.voltagem_min != null ? `${e.voltagem_min} V` : "-"}</td>
                        <td>{e.voltagem_max != null ? `${e.voltagem_max} V` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {produto.saidas?.length > 0 && (
              <>
                <h3>Saídas</h3>
                <table className="pp-tabela">
                  <thead><tr><th>Nº canais</th><th>A/canal</th></tr></thead>
                  <tbody>
                    {produto.saidas.map((s, i) => (
                      <tr key={i}>
                        <td>{s.numero_canais ?? "-"}</td>
                        <td>{s.amperes_por_canal != null ? `${s.amperes_por_canal} A` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {produto.limites_potencia?.length > 0 && (
              <>
                <h3>Limites de Potência</h3>
                <table className="pp-tabela">
                  <thead><tr><th>Voltagem</th><th>Potência máx</th></tr></thead>
                  <tbody>
                    {produto.limites_potencia.map((l, i) => (
                      <tr key={i}>
                        <td>{l.voltagem != null ? `${l.voltagem} V` : "-"}</td>
                        <td>{l.potencia_max_w != null ? `${l.potencia_max_w} W` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {produto.compatibilidades?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3>Comandos Compatíveis</h3>
                <ListaTags items={produto.compatibilidades.map(c => c.nome)} />
              </div>
            )}
          </>
        )}

        {tipo === "comando" && (
          <>
            <TabelaEspecificacoes rows={[
              { label: "Alimentação", value: produto.tipo_alimentacao },
              { label: "Frequência", value: produto.frequencias?.length > 0 ? produto.frequencias.map(f => `${f} MHz`).join(" / ") : null },
              { label: "Nº de zonas", value: produto.numero_zonas },
              { label: "Comprimento", value: produto.comprimento_mm != null ? `${produto.comprimento_mm} mm` : null },
              { label: "Largura", value: produto.largura_mm != null ? `${produto.largura_mm} mm` : null },
              { label: "Altura", value: produto.altura_mm != null ? `${produto.altura_mm} mm` : null },
              { label: "Cor", value: produto.cor },
              { label: "Preço", value: produto.preco != null ? `${Number(produto.preco).toFixed(2)} €` : null },
              { label: "Garantia", value: produto.garantia_anos != null ? `${produto.garantia_anos} anos` : null },
            ]} />

            {produto.entradas?.length > 0 && (
              <>
                <h3>Entradas</h3>
                <table className="pp-tabela">
                  <thead><tr><th>Tipo</th><th>V mín</th><th>V máx</th></tr></thead>
                  <tbody>
                    {produto.entradas.map((e, i) => (
                      <tr key={i}>
                        <td>{e.tipo_input ?? "-"}</td>
                        <td>{e.voltagem_min != null ? `${e.voltagem_min} V` : "-"}</td>
                        <td>{e.voltagem_max != null ? `${e.voltagem_max} V` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {tipo === "kit" && (
          <TabelaEspecificacoes rows={[
            { label: "Preço de cada peça do kit", value: produto.preco != null ? `${Number(produto.preco).toFixed(2)} €` : null },
          ]} />
        )}

        {tipo === "power" && (
          <TabelaEspecificacoes rows={[
            { label: "Potência", value: produto.potencia_w != null ? `${produto.potencia_w} W` : null },
            { label: "Tensão de saída", value: produto.tensao_saida_v != null ? `${produto.tensao_saida_v} V` : null },
            { label: "Corrente de saída", value: produto.corrente_saida_a != null ? `${produto.corrente_saida_a} A` : null },
            { label: "Comprimento", value: produto.comprimento_mm != null ? `${produto.comprimento_mm} mm` : null },
            { label: "Largura", value: produto.largura_mm != null ? `${produto.largura_mm} mm` : null },
            { label: "Altura", value: produto.altura_mm != null ? `${produto.altura_mm} mm` : null },
            { label: "IP Rating", value: produto.ip_rating },
            { label: "Preço", value: produto.preco != null ? `${Number(produto.preco).toFixed(2)} €` : null },
            { label: "Garantia", value: produto.garantia_anos != null ? `${produto.garantia_anos} anos` : null },
          ]} />
        )}

        {tipo === "acessorio" && (
          <>
            <TabelaEspecificacoes rows={[
              { label: "Preço", value: produto.preco != null ? `${Number(produto.preco).toFixed(2)} €` : null },
              { label: "Garantia", value: produto.garantia_anos != null ? `${produto.garantia_anos} anos` : null },
              { label: "Tipologia", value: produto.tipo_acessorio === "interruptor" ? produto.especifico?.tipologia : null },
              { label: "Cor", value: produto.tipo_acessorio === "interruptor" ? produto.especifico?.cor : null },
              { label: "Sensor", value: produto.tipo_acessorio === "interruptor" ? produto.especifico?.sensor : null },
              { label: "Cabo", value: produto.tipo_acessorio === "interruptor" && produto.especifico?.cabo_mm != null ? `${produto.especifico.cabo_mm} m` : null },
              { label: "Distância mín", value: produto.tipo_acessorio === "interruptor" && produto.especifico?.distancia_min_m != null ? `${produto.especifico.distancia_min_m} m` : null },
              { label: "Distância máx", value: produto.tipo_acessorio === "interruptor" && produto.especifico?.distancia_max_m != null ? `${produto.especifico.distancia_max_m} m` : null },
              { label: "Material", value: produto.tipo_acessorio === "conector_uniao" ? produto.especifico?.material : null },
              { label: "Tipo de conexão", value: produto.tipo_acessorio === "conector_uniao" ? produto.especifico?.tipo_conexao : null },
              { label: "Corrente", value: produto.tipo_acessorio === "conector_uniao" && produto.especifico?.corrente_a != null ? `${produto.especifico.corrente_a} A` : null },
              { label: "Largura", value: produto.tipo_acessorio === "conector_uniao" && produto.especifico?.largura_mm != null ? `${produto.especifico.largura_mm} mm` : null },
              { label: "Nº de vias", value: produto.tipo_acessorio === "conector_uniao" ? produto.especifico?.numero_vias : null },
              { label: "Tipologia", value: produto.tipo_acessorio === "cabo_encaixe" ? produto.especifico?.tipologia : null },
              { label: "Tipo de ligação", value: produto.tipo_acessorio === "cabo_encaixe" ? produto.especifico?.tipo_ligacao : null },
              { label: "IP", value: produto.tipo_acessorio === "cabo_encaixe" && produto.especifico?.ip != null ? produto.especifico.ip : null },
              { label: "Corrente", value: produto.tipo_acessorio === "cabo_encaixe" && produto.especifico?.corrente_a != null ? `${produto.especifico.corrente_a} A` : null },
              { label: "Tipo", value: produto.tipo_acessorio === "clipe_tampa" ? produto.especifico?.tipo : null },
              { label: "Tipologia", value: produto.tipo_acessorio === "clipe_tampa" ? produto.especifico?.tipologia : null },
              { label: "Material", value: produto.tipo_acessorio === "clipe_tampa" ? produto.especifico?.material : null },
              { label: "Tipo", value: produto.tipo_acessorio === "ligador_fio" ? produto.especifico?.tipo : null },
              { label: "Tipologia", value: produto.tipo_acessorio === "ligador_fio" ? produto.especifico?.tipologia : null },
              { label: "Unidades por caixa", value: produto.tipo_acessorio === "ligador_fio" ? produto.especifico?.unidades_por_caixa : null },
              { label: "Voltagem", value: produto.tipo_acessorio === "ligador_fio" && produto.especifico?.voltagem_v != null ? `${produto.especifico.voltagem_v} V` : null },
              { label: "IP", value: produto.tipo_acessorio === "ligador_fio" && produto.especifico?.ip != null ? produto.especifico.ip : null },
              { label: "Tipo", value: produto.tipo_acessorio === "fixacao_cola" ? produto.especifico?.tipo : null },
              { label: "Tipologia", value: produto.tipo_acessorio === "fixacao_cola" ? produto.especifico?.tipologia : null },
              { label: "Comprimento", value: produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.comprimento_mm != null ? `${produto.especifico.comprimento_mm} mm` : null },
              { label: "Largura", value: produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.largura_mm != null ? `${produto.especifico.largura_mm} mm` : null },
              { label: "Quantidade", value: produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.quantidade_ml != null ? `${produto.especifico.quantidade_ml} ml` : null },
              { label: "Tempo de cura", value: produto.tipo_acessorio === "fixacao_cola" ? produto.especifico?.tempo_cura : null },
              { label: "Cor", value: produto.tipo_acessorio === "fixacao_cola" ? produto.especifico?.cor : null },
              { label: "Força", value: produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.forca_psi != null ? `${produto.especifico.forca_psi} PSI` : null },
              { label: "Tipologia", value: produto.tipo_acessorio === "ficha" ? produto.especifico?.tipologia : null },
              { label: "Medida", value: produto.tipo_acessorio === "ficha" ? produto.especifico?.medida : null },
              { label: "Descrição", value: produto.tipo_acessorio === "ficha" ? produto.especifico?.descricao_extra : null },
              { label: "Diâmetro inicial", value: produto.tipo_acessorio === "manga" && produto.especifico?.diametro_normal_mm != null ? `${produto.especifico.diametro_normal_mm} mm` : null },
              { label: "Diâmetro pós-aquecimento", value: produto.tipo_acessorio === "manga" && produto.especifico?.diametro_pos_aquecimento_mm != null ? `${produto.especifico.diametro_pos_aquecimento_mm} mm` : null },
              { label: "Rolo", value: produto.tipo_acessorio === "manga" && produto.especifico?.rolo_m != null ? `${produto.especifico.rolo_m} m` : null },
              { label: "Tipologia", value: produto.tipo_acessorio === "ferro_solda" ? produto.especifico?.tipologia : null },
              { label: "Descrição", value: produto.tipo_acessorio === "ferro_solda" ? produto.especifico?.descricao_extra : null },
              { label: "Tipologia", value: produto.tipo_acessorio === "fio_paralelo" && produto.especifico?.tipologias?.length > 0 ? produto.especifico.tipologias.join(", ") : null },
            ]} />

            <ListaTags label="Tipos de controlo:" items={produto.especifico?.tipos_controlo} style={{ marginTop: 12 }} />

            {produto.especifico?.tipologias?.length > 0 && produto.tipo_acessorio === "conector_uniao" && (
              <ListaTags label="Tipologias:" items={produto.especifico.tipologias} style={{ marginTop: 12 }} />
            )}

            <ListaTags label="Capacidades:" items={produto.especifico?.capacidades} style={{ marginTop: 12 }} />
            <ListaTags label="Resistências:" items={produto.especifico?.resistencias} style={{ marginTop: 12 }} />

            {produto.especifico?.tensoes?.length > 0 && (
              <>
                <h3>Tensões</h3>
                {produto.especifico.tensoes.map((t, i) => (
                  <div key={i} style={{ marginBottom: "16px" }}>
                    <h4>Tensão de entrada</h4>
                    <TabelaEspecificacoes rows={[
                      { label: "Tipo", value: t.tipo_tensao ?? "-" },
                      { label: "Voltagem", value: t.voltagem_v != null ? `${t.voltagem_v} V` : null },
                      { label: "Voltagem mín", value: t.voltagem_min_v != null ? `${t.voltagem_min_v} V` : null },
                      { label: "Voltagem máx", value: t.voltagem_max_v != null ? `${t.voltagem_max_v} V` : null },
                      { label: "Corrente máxima", value: t.corrente_max_a != null ? `${t.corrente_max_a} A` : null },
                    ]} />
                    {t.potencias?.length > 0 && (
                      <table className="pp-tabela" style={{ marginTop: "8px" }}>
                        <thead>
                          <tr><th>Tensão saída (V)</th><th>Potência (W)</th></tr>
                        </thead>
                        <tbody>
                          {t.potencias.map((p, j) => (
                            <tr key={j}>
                              <td>{p.voltagem_v ?? "-"}</td>
                              <td>{p.potencia_max_w ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </>
            )}

            {produto.especifico?.variantes?.length > 0 && (
              <>
                <h3>Variantes</h3>
                <table className="pp-tabela">
                  <thead>
                    <tr>
                      <th>Referência</th>
                      {produto.tipo_acessorio === "fio_paralelo" && <th>Rolo</th>}
                      <th>Preço</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produto.especifico.variantes.map(v => (
                      <tr key={v.referencia}>
                        <td>{v.referencia}</td>
                        {produto.tipo_acessorio === "fio_paralelo" && <td>{v.rolo_m != null ? `${v.rolo_m} m` : "-"}</td>}
                        <td>{v.preco != null ? `${Number(v.preco).toFixed(2)} €` : "-"}</td>
                        <td>{v.ativo ? "Ativo" : "Inativo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

      </SecaoPagina>

      {/* Certificados (power) */}
      {tipo === "power" && produto.certificacoes?.length > 0 && (
        <SecaoPagina title="Certificados">
          {produto.certificacoes.map(c => (
            <div key={c.certificacao_id} style={{ marginBottom: "16px" }}>
              <span className="pp-tag" style={{ marginBottom: "8px", display: "inline-block" }}>{c.modelo}</span>
              {c.imagens?.length > 0 && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                  {c.imagens.map((url, i) => (
                    <img key={i} src={url} alt={`${c.modelo} ${i + 1}`} style={{ height: "60px", objectFit: "contain", borderRadius: "4px", border: "1px solid #eee" }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </SecaoPagina>
      )}

      {/* Variantes / Acabamentos (perfis) */}
      {tipo === "perfil" && produto.acabamentos?.length > 0 && (
        <SecaoPagina title="Variantes">
          {produto.acabamentos.map(acab => (
            <div key={acab.acabamento} className="pp-acabamento">
              <div className="pp-acabamento-header">
                {acab.codigo_cor && (
                  <span className="pp-cor-dot" style={estiloCorDot(acab.codigo_cor)} />
                )}
                <h3>{acab.acabamento}</h3>
              </div>
              <table className="pp-tabela">
                <thead>
                  <tr>
                    <th>Referência</th>
                    <th>Dimensão</th>
                    <th>Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {acab.medidas.map(m => (
                    <tr key={m.referencia}>
                      <td>{m.referencia}</td>
                      <td>{m.dimensao_m} m</td>
                      <td>{m.preco != null ? `${Number(m.preco).toFixed(2)} €` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </SecaoPagina>
      )}

      {/* Difusores compatíveis (perfis) */}
      {tipo === "perfil" && produto.difusores?.length > 0 && (
        <SecaoPagina title="Difusores Compatíveis">
          {produto.difusores.map(dif => (
            <div key={dif.difusor_id} className="pp-difusor">
              <h3>{dif.nome}</h3>
              {dif.descricao && <p className="pp-dif-desc">{dif.descricao}</p>}
              {dif.variantes?.length > 0 && (
                <table className="pp-tabela">
                  <thead>
                    <tr>
                      <th>Referência</th>
                      <th>Comprimento</th>
                      <th>Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dif.variantes.map((v, i) => (
                      <tr key={i}>
                        <td>{v.referencia ?? "-"}</td>
                        <td>{v.comprimento_m} m</td>
                        <td>{v.preco != null ? `${Number(v.preco).toFixed(2)} €` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </SecaoPagina>
      )}

      {/* Artigos / Versões (fitas LED) */}
      {tipo === "fita_led" && produto.versoes?.length > 0 && (
        <SecaoPagina title="Artigos">
          {produto.versoes.map(v => (
            <div key={v.versao_fita_led_id} className="pp-acabamento">
              <div className="pp-acabamento-header">
                <h3>
                  {v.voltagem_v ? `${v.voltagem_v}V` : ""}
                  {v.ip ? ` — IP${v.ip}` : ""}
                  {v.rolo_m ? ` — Rolo: ${v.rolo_m} m` : ""}
                </h3>
              </div>

              {v.imagem_url && (
                <img src={v.imagem_url} alt={`versão IP${v.ip}`} style={{ height: "80px", borderRadius: "4px", marginBottom: "10px" }} />
              )}

              {v.opcoes?.length > 0 && (
                <table className="pp-tabela">
                  <thead>
                    <tr>
                      <th>Referência</th>
                      <th>Temp. cor</th>
                      <th>Int. Luminosa</th>
                      <th>PVP/metro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.opcoes.map(o => (
                      <tr key={o.opcao_fita_led_id}>
                        <td>{o.referencia ?? "-"}</td>
                        <td>{o.temperatura_cor ?? "-"}</td>
                        <td>{o.intensidade_luminosa_lm != null ? `${o.intensidade_luminosa_lm} lm` : "-"}</td>
                        <td>{o.preco_metro != null ? `${Number(o.preco_metro).toFixed(2)} €` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </SecaoPagina>
      )}

      {/* Dimensões (neon) */}
      {tipo === "neon" && produto.dimensoes?.length > 0 && (
        <SecaoPagina title="Dimensões disponíveis">
          <table className="pp-tabela">
            <tbody>
              <tr>
                <td>{produto.dimensoes.map(d => `${d.comprimento_m} m`).join(" - ")}</td>
              </tr>
            </tbody>
          </table>
        </SecaoPagina>
      )}

      {/* Versões / Variantes (neon) */}
      {tipo === "neon" && produto.versoes?.length > 0 && (
        <SecaoPagina title="Artigos">
          {produto.versoes.map(v => (
            <div key={v.versao_neon_id} className="pp-acabamento">
              <div className="pp-acabamento-header">
                <h3>
                  {v.voltagem_v ? `${v.voltagem_v}V` : ""}
                  {v.ip ? ` — IP${v.ip}` : ""}
                </h3>
              </div>
              {v.variantes?.length > 0 && (
                <table className="pp-tabela">
                  <thead>
                    <tr>
                      <th>Referência</th>
                      <th>Cor / Temp.</th>
                      <th>Int. Luminosa</th>
                      <th>PVP/metro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.variantes.map(va => (
                      <tr key={va.variante_neon_id}>
                        <td>{va.referencia ?? "-"}</td>
                        <td>{va.temperatura_cor ? `${va.temperatura_cor} K` : va.tipo_cor ?? "-"}</td>
                        <td>{va.intensidade_luminosa_lm != null ? `${va.intensidade_luminosa_lm} lm/m` : "-"}</td>
                        <td>{va.preco_metro != null ? `${Number(va.preco_metro).toFixed(2)} €` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </SecaoPagina>
      )}

      {/* Compatibilidade (comando) */}
      {tipo === "comando" && produto.compatibilidades?.length > 0 && (
        <SecaoPagina title="Dispositivos Compatíveis">
          <ListaTags items={produto.compatibilidades.map(c => c.nome)} />
        </SecaoPagina>
      )}

      {/* Receiver do kit */}
      {tipo === "kit" && produto.receiver && (
        <SecaoPagina title="Receiver">
          <div className="pp-imagens" style={{ marginBottom: 16 }}>
            {produto.receiver.receiver_imagem_extra_url && (
              <img src={produto.receiver.receiver_imagem_extra_url} alt="Medidas receiver" className="pp-imagem-extra" />
            )}
          </div>
          <p className="pp-ref">Ref: {produto.receiver.receiver_referencia}</p>
          {produto.receiver.receiver_descricao && <p className="pp-descricao">{produto.receiver.receiver_descricao}</p>}
          {produto.receiver.receiver_ficha_tecnica_url && (
            <a href={produto.receiver.receiver_ficha_tecnica_url} target="_blank" rel="noopener noreferrer" className="pp-ficha-tecnica-btn">
              Ficha Técnica Receiver (PDF)
            </a>
          )}
          <TabelaEspecificacoes rows={[
            { label: "IP", value: produto.receiver.ip != null ? `IP${produto.receiver.ip}` : null },
            { label: "Comprimento", value: produto.receiver.comprimento_mm != null ? `${produto.receiver.comprimento_mm} mm` : null },
            { label: "Largura", value: produto.receiver.largura_mm != null ? `${produto.receiver.largura_mm} mm` : null },
            { label: "Altura", value: produto.receiver.altura_mm != null ? `${produto.receiver.altura_mm} mm` : null },
            { label: "Cor", value: produto.receiver.cor },
            { label: "Certificações", value: produto.receiver.certificacoes?.length > 0 ? produto.receiver.certificacoes.join(", ") : null },
            { label: "Frequência entrada", value: produto.receiver.receiver_frequencias?.length > 0 ? `${produto.receiver.receiver_frequencias.join(" / ")} MHz` : null },
            { label: "Garantia", value: produto.receiver.receiver_garantia_anos != null ? `${produto.receiver.receiver_garantia_anos} anos` : null },
          ]} />
          <ListaTags label="Tipos de controlo:" items={produto.receiver.receiver_tipos_controlo} style={{ marginTop: 12 }} />
          <ListaTags label="Tipos de sinal:" items={produto.receiver.receiver_tipos_sinal} style={{ marginTop: 8 }} />
          {produto.receiver.entradas?.length > 0 && (
            <>
              <h3>Entradas</h3>
              <table className="pp-tabela">
                <thead><tr><th>Tipo</th><th>V mín</th><th>V máx</th></tr></thead>
                <tbody>
                  {produto.receiver.entradas.map((e, i) => (
                    <tr key={i}>
                      <td>{e.tipo_input ?? "-"}</td>
                      <td>{e.voltagem_min != null ? `${e.voltagem_min} V` : "-"}</td>
                      <td>{e.voltagem_max != null ? `${e.voltagem_max} V` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {produto.receiver.saidas?.length > 0 && (
            <>
              <h3>Saídas</h3>
              <table className="pp-tabela">
                <thead><tr><th>Nº canais</th><th>A/canal</th></tr></thead>
                <tbody>
                  {produto.receiver.saidas.map((s, i) => (
                    <tr key={i}>
                      <td>{s.numero_canais ?? "-"}</td>
                      <td>{s.amperes_por_canal != null ? `${s.amperes_por_canal} A` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {produto.receiver.limites?.length > 0 && (
            <>
              <h3>Limites de Potência</h3>
              <table className="pp-tabela">
                <thead><tr><th>Voltagem</th><th>Potência máx</th></tr></thead>
                <tbody>
                  {produto.receiver.limites.map((l, i) => (
                    <tr key={i}>
                      <td>{l.voltagem != null ? `${l.voltagem} V` : "-"}</td>
                      <td>{l.potencia_max_w != null ? `${l.potencia_max_w} W` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </SecaoPagina>
      )}

      {/* Remote do kit */}
      {tipo === "kit" && produto.remote && (
        <SecaoPagina title="Remote">
          <div className="pp-imagens" style={{ marginBottom: 16 }}>
            {produto.remote.remote_imagem_url && (
              <img src={produto.remote.remote_imagem_url} alt="Remote" className="pp-imagem-principal" />
            )}
            {produto.remote.remote_imagem_extra_url && (
              <img src={produto.remote.remote_imagem_extra_url} alt="Medidas remote" className="pp-imagem-extra" />
            )}
          </div>
          <p className="pp-ref">Ref: {produto.remote.remote_referencia}</p>
          {produto.remote.remote_descricao && <p className="pp-descricao">{produto.remote.remote_descricao}</p>}
          {produto.remote.remote_ficha_tecnica_url && (
            <a href={produto.remote.remote_ficha_tecnica_url} target="_blank" rel="noopener noreferrer" className="pp-ficha-tecnica-btn">
              Ficha Técnica Remote (PDF)
            </a>
          )}
          <TabelaEspecificacoes rows={[
            { label: "Certificações", value: produto.remote.remote_certificacoes?.length > 0 ? produto.remote.remote_certificacoes.join(", ") : null },
            { label: "Alimentação", value: produto.remote.tipo_alimentacao },
            { label: "Frequência", value: produto.remote.frequencias?.length > 0 ? `${produto.remote.frequencias.join(" / ")} MHz` : null },
            { label: "Comprimento", value: produto.remote.remote_comprimento_mm != null ? `${produto.remote.remote_comprimento_mm} mm` : null },
            { label: "Largura", value: produto.remote.remote_largura_mm != null ? `${produto.remote.remote_largura_mm} mm` : null },
            { label: "Altura", value: produto.remote.remote_altura_mm != null ? `${produto.remote.remote_altura_mm} mm` : null },
            { label: "Cor", value: produto.remote.remote_cor },
          ]} />
        </SecaoPagina>
      )}

    </div>
  )
}

export default PaginaProduto
