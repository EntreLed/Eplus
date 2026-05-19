import { API_URL } from '../utils/api'
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getUserRole } from "../utils/auth"
import "./estilosPages/PaginaProduto.css"

const corPorCodigo = {
  "A": "#9e9e9e",
  "B": "#1a1a1a",
  "W": "#f5f5f5",
  "RAL": "linear-gradient(135deg, #e63946, #f4a261, #2a9d8f, #457b9d, #6a4c93, #e63946)"
}

function estiloCorDot(codigo) {
  const valor = corPorCodigo[codigo?.toUpperCase()]
  if (!valor) return {}
  if (valor.startsWith("linear-gradient")) return { backgroundImage: valor }
  return { background: valor }
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

      {/* ── Hero ── */}
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

          {/* Instalações (perfis) */}
          {produto.instalacoes?.length > 0 && (
            <div className="pp-instalacoes">
              <span className="pp-label">Instalação:</span>
              <div className="pp-tags">
                {produto.instalacoes.map(tipo => (
                  <span key={tipo} className="pp-tag">{tipo}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tipos de cor (fitas LED) */}
          {tipo === "fita_led" && produto.tipos_cor && (
            <div className="pp-instalacoes">
              <span className="pp-label">Tipo de cor:</span>
              <div className="pp-tags">
                {produto.tipos_cor.split(" + ").map(t => (
                  <span key={t} className="pp-tag">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tipos de controlo (comando) */}
          {tipo === "comando" && produto.tipos_controlo?.length > 0 && (
            <div className="pp-instalacoes">
              <span className="pp-label">Tipos de controlo:</span>
              <div className="pp-tags">
                {produto.tipos_controlo.map(t => <span key={t} className="pp-tag">{t}</span>)}
              </div>
            </div>
          )}

          {/* Tipos de controlo e sinal (kit) */}
          {tipo === "kit" && produto.receiver?.receiver_tipos_controlo?.length > 0 && (
            <div className="pp-instalacoes">
              <span className="pp-label">Tipos de controlo:</span>
              <div className="pp-tags">
                {produto.receiver.receiver_tipos_controlo.map(t => <span key={t} className="pp-tag">{t}</span>)}
              </div>
            </div>
          )}
          {tipo === "kit" && produto.receiver?.receiver_tipos_sinal?.length > 0 && (
            <div className="pp-instalacoes">
              <span className="pp-label">Tipos de sinal:</span>
              <div className="pp-tags">
                {produto.receiver.receiver_tipos_sinal.map(t => <span key={t} className="pp-tag">{t}</span>)}
              </div>
            </div>
          )}
        </div>
        </div>
      </section>

      {/* ── Características (power) ── */}
      {tipo === "power" && produto.caracteristicas?.length > 0 && (
        <section className="pp-secao">
          <h2>Características</h2>
          <div className="pp-tags">
            {produto.caracteristicas.map((texto, i) => (
              <span key={i} className="pp-tag">{texto}</span>
            ))}
          </div>
        </section>
      )}

      {/* ── Especificações técnicas ── */}
      <section className="pp-secao">
        <h2>Especificações Técnicas</h2>

        {tipo === "perfil" && (
          <>
            <table className="pp-tabela">
              <tbody>
                {produto.material && <tr><td>Material</td><td>{produto.material}</td></tr>}
                {produto.largura_externa_mm != null && <tr><td>Largura externa</td><td>{produto.largura_externa_mm} mm</td></tr>}
                {produto.altura_externa_mm != null && <tr><td>Altura externa</td><td>{produto.altura_externa_mm} mm</td></tr>}
                {produto.espacamento_interno_mm != null && <tr><td>Espaçamento interno</td><td>{produto.espacamento_interno_mm} mm</td></tr>}
                {produto.potencia_max_w_m != null && <tr><td>Potência máxima</td><td>{produto.potencia_max_w_m} W/m</td></tr>}
                {produto.max_largura_fita_mm != null && <tr><td>Largura máx. fita LED</td><td>{produto.max_largura_fita_mm} mm</td></tr>}
                {produto.max_quantidade_fitas != null && <tr><td>Quantidade máx. fitas</td><td>{produto.max_quantidade_fitas}</td></tr>}
                {produto.garantia_anos != null && <tr><td>Garantia</td><td>{produto.garantia_anos} anos</td></tr>}
              </tbody>
            </table>
            {produto.imagem_medidas_url && (
              <div className="pp-imagem-medidas-wrap">
                <img src={produto.imagem_medidas_url} alt="Diagrama de medidas" className="pp-imagem-medidas" />
              </div>
            )}
          </>
        )}

        {tipo === "fita_led" && (
          <table className="pp-tabela">
            <tbody>
              {produto.potencia_w_m != null && <tr><td>Potência</td><td>{produto.potencia_w_m} W/m</td></tr>}
              {produto.tipo_led && <tr><td>Tipo LED</td><td>{produto.tipo_led}</td></tr>}
              {produto.quantidade_leds_m != null && <tr><td>Quantidade de LEDs/m</td><td>{produto.quantidade_leds_m}</td></tr>}
              {produto.angulo_abertura != null && <tr><td>Ângulo de abertura</td><td>{produto.angulo_abertura}°</td></tr>}
              {produto.dimavel != null && <tr><td>Dimável</td><td>{produto.dimavel ? "Sim" : "Não"}</td></tr>}
              {produto.cri != null && <tr><td>CRI</td><td>{produto.cri}</td></tr>}
              {produto.macadam != null && <tr><td>MacAdam</td><td>{produto.macadam}</td></tr>}
              {produto.eficiencia_lm_w != null && <tr><td>Eficiência</td><td>{produto.eficiencia_lm_w} lm/W</td></tr>}
              {produto.horario_trabalho_h && <tr><td>Horário de trabalho</td><td>{produto.horario_trabalho_h}</td></tr>}
              {produto.largura_mm != null && <tr><td>Largura</td><td>{produto.largura_mm} mm</td></tr>}
              {produto.altura_mm != null && <tr><td>Altura</td><td>{produto.altura_mm} mm</td></tr>}
              {produto.comprimento_corte_mm != null && <tr><td>Comprimento de corte</td><td>{produto.comprimento_corte_mm} mm</td></tr>}
              {produto.comprimento_max_alimentacao_m != null && <tr><td>Comp. máx. alimentação única</td><td>{produto.comprimento_max_alimentacao_m} m</td></tr>}
              {produto.comprimento_max_circuito_m != null && <tr><td>Comp. máx. circuito fechado</td><td>{produto.comprimento_max_circuito_m} m</td></tr>}
              {produto.garantia_anos != null && <tr><td>Garantia</td><td>{produto.garantia_anos} anos</td></tr>}
            </tbody>
          </table>
        )}

        {tipo === "neon" && (
          <table className="pp-tabela">
            <tbody>
              {produto.potencia_w_m != null && <tr><td>Potência</td><td>{produto.potencia_w_m} W/m</td></tr>}
              {produto.quantidade_leds != null && <tr><td>Quantidade de LEDs</td><td>{produto.quantidade_leds}</td></tr>}
              {produto.angulo_abertura != null && <tr><td>Ângulo de abertura</td><td>{produto.angulo_abertura}°</td></tr>}
              {produto.dimavel != null && <tr><td>Dimável</td><td>{produto.dimavel ? "Sim" : "Não"}</td></tr>}
              {produto.cri != null && <tr><td>CRI</td><td>{produto.cri}</td></tr>}
              {produto.macadam != null && <tr><td>MacAdam</td><td>{produto.macadam}</td></tr>}
              {produto.material && <tr><td>Material</td><td>{produto.material}</td></tr>}
              {produto.horario_trabalho_h && <tr><td>Horário de trabalho</td><td>{produto.horario_trabalho_h} h</td></tr>}
              {produto.largura_mm != null && <tr><td>Largura</td><td>{produto.largura_mm} mm</td></tr>}
              {produto.altura_mm != null && <tr><td>Altura</td><td>{produto.altura_mm} mm</td></tr>}
              {produto.comprimento_max_alimentacao_unica_m != null && <tr><td>Comp. máx. alimentação única</td><td>{produto.comprimento_max_alimentacao_unica_m} m</td></tr>}
              {produto.comprimento_max_circuito_fechado_m != null && <tr><td>Comp. máx. circuito fechado</td><td>{produto.comprimento_max_circuito_fechado_m} m</td></tr>}
              {produto.garantia_anos != null && <tr><td>Garantia</td><td>{produto.garantia_anos} anos</td></tr>}
            </tbody>
          </table>
        )}

        {tipo === "neon" && produto.imagem_medidas_url && (
          <div className="pp-imagem-medidas-wrap">
            <img src={produto.imagem_medidas_url} alt="Diagrama de medidas" className="pp-imagem-medidas" />
          </div>
        )}

        {tipo === "controlador" && (
          <>
            <table className="pp-tabela">
              <tbody>
                {produto.ip != null && <tr><td>IP</td><td>IP{produto.ip}</td></tr>}
                {produto.comprimento_mm != null && <tr><td>Comprimento</td><td>{produto.comprimento_mm} mm</td></tr>}
                {produto.largura_mm != null && <tr><td>Largura</td><td>{produto.largura_mm} mm</td></tr>}
                {produto.altura_mm != null && <tr><td>Altura</td><td>{produto.altura_mm} mm</td></tr>}
                {produto.cor && <tr><td>Cor</td><td>{produto.cor}</td></tr>}
                {produto.unidades_por_caixa != null && <tr><td>Unidades por caixa</td><td>{produto.unidades_por_caixa}</td></tr>}
                {produto.certificacoes?.length > 0 && (
                  <tr>
                    <td>Certificações</td>
                    <td>{Array.isArray(produto.certificacoes) ? produto.certificacoes.join(", ") : produto.certificacoes}</td>
                  </tr>
                )}
                {produto.preco != null && <tr><td>Preço</td><td>{Number(produto.preco).toFixed(2)} €</td></tr>}
                {produto.garantia_anos != null && <tr><td>Garantia</td><td>{produto.garantia_anos} anos</td></tr>}
              </tbody>
            </table>

            {produto.tipos_controlo?.length > 0 && (
              <div className="pp-instalacoes" style={{ marginTop: 12 }}>
                <span className="pp-label">Tipos de controlo:</span>
                <div className="pp-tags">
                  {produto.tipos_controlo.map(t => <span key={t} className="pp-tag">{t}</span>)}
                </div>
              </div>
            )}
            {produto.tipos_sinal?.length > 0 && (
              <div className="pp-instalacoes" style={{ marginTop: 8 }}>
                <span className="pp-label">Tipos de sinal:</span>
                <div className="pp-tags">
                  {produto.tipos_sinal.map(t => <span key={t} className="pp-tag">{t}</span>)}
                </div>
              </div>
            )}

            {produto.entradas?.length > 0 && (
              <>
                <h3>Entradas</h3>
                <table className="pp-tabela">
                  <thead><tr><th>Tipo</th><th>V mín</th><th>V máx</th></tr></thead>
                  <tbody>
                    {produto.entradas.map((e, i) => (
                      <tr key={i}>
                        <td>{e.tipo_input ?? "—"}</td>
                        <td>{e.voltagem_min != null ? `${e.voltagem_min} V` : "—"}</td>
                        <td>{e.voltagem_max != null ? `${e.voltagem_max} V` : "—"}</td>
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
                        <td>{s.numero_canais ?? "—"}</td>
                        <td>{s.amperes_por_canal != null ? `${s.amperes_por_canal} A` : "—"}</td>
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
                        <td>{l.voltagem != null ? `${l.voltagem} V` : "—"}</td>
                        <td>{l.potencia_max_w != null ? `${l.potencia_max_w} W` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {produto.compatibilidades?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3>Comandos Compatíveis</h3>
                <div className="pp-tags">
                  {produto.compatibilidades.map(c => (
                    <span key={c.comando_id} className="pp-tag">{c.nome}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tipo === "comando" && (
          <>
            <table className="pp-tabela">
              <tbody>
                {produto.tipo_alimentacao && <tr><td>Alimentação</td><td>{produto.tipo_alimentacao}</td></tr>}
                {produto.frequencias?.length > 0 && <tr><td>Frequência</td><td>{produto.frequencias.map(f => `${f} MHz`).join(" / ")}</td></tr>}
                {produto.numero_zonas != null && <tr><td>Nº de zonas</td><td>{produto.numero_zonas}</td></tr>}
                {produto.comprimento_mm != null && <tr><td>Comprimento</td><td>{produto.comprimento_mm} mm</td></tr>}
                {produto.largura_mm != null && <tr><td>Largura</td><td>{produto.largura_mm} mm</td></tr>}
                {produto.altura_mm != null && <tr><td>Altura</td><td>{produto.altura_mm} mm</td></tr>}
                {produto.cor && <tr><td>Cor</td><td>{produto.cor}</td></tr>}
                {produto.preco != null && <tr><td>Preço</td><td>{Number(produto.preco).toFixed(2)} €</td></tr>}
                {produto.garantia_anos != null && <tr><td>Garantia</td><td>{produto.garantia_anos} anos</td></tr>}
              </tbody>
            </table>

            {produto.entradas?.length > 0 && (
              <>
                <h3>Entradas</h3>
                <table className="pp-tabela">
                  <thead><tr><th>Tipo</th><th>V mín</th><th>V máx</th></tr></thead>
                  <tbody>
                    {produto.entradas.map((e, i) => (
                      <tr key={i}>
                        <td>{e.tipo_input ?? "—"}</td>
                        <td>{e.voltagem_min != null ? `${e.voltagem_min} V` : "—"}</td>
                        <td>{e.voltagem_max != null ? `${e.voltagem_max} V` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

          </>
        )}

        {tipo === "kit" && (
          <table className="pp-tabela">
            <tbody>
              {produto.preco != null && <tr><td>Preço de cada peça do kit</td><td>{Number(produto.preco).toFixed(2)} €</td></tr>}
            </tbody>
          </table>
        )}

        {tipo === "power" && (
          <table className="pp-tabela">
            <tbody>
              {produto.potencia_w != null && <tr><td>Potência</td><td>{produto.potencia_w} W</td></tr>}
              {produto.tensao_saida_v != null && <tr><td>Tensão de saída</td><td>{produto.tensao_saida_v} V</td></tr>}
              {produto.corrente_saida_a != null && <tr><td>Corrente de saída</td><td>{produto.corrente_saida_a} A</td></tr>}
              {produto.comprimento_mm != null && <tr><td>Comprimento</td><td>{produto.comprimento_mm} mm</td></tr>}
              {produto.largura_mm != null && <tr><td>Largura</td><td>{produto.largura_mm} mm</td></tr>}
              {produto.altura_mm != null && <tr><td>Altura</td><td>{produto.altura_mm} mm</td></tr>}
              {produto.ip_rating && <tr><td>IP Rating</td><td>{produto.ip_rating}</td></tr>}
              {produto.preco != null && <tr><td>Preço</td><td>{Number(produto.preco).toFixed(2)} €</td></tr>}
              {produto.garantia_anos != null && <tr><td>Garantia</td><td>{produto.garantia_anos} anos</td></tr>}
            </tbody>
          </table>
        )}

        {tipo === "acessorio" && (
          <>
            <table className="pp-tabela">
              <tbody>
                {produto.preco != null && <tr><td>Preço</td><td>{Number(produto.preco).toFixed(2)} €</td></tr>}
                {produto.garantia_anos != null && <tr><td>Garantia</td><td>{produto.garantia_anos} anos</td></tr>}
                {produto.tipo_acessorio === "interruptor" && produto.especifico?.tipologia && <tr><td>Tipologia</td><td>{produto.especifico.tipologia}</td></tr>}
                {produto.tipo_acessorio === "interruptor" && produto.especifico?.cor && <tr><td>Cor</td><td>{produto.especifico.cor}</td></tr>}
                {produto.tipo_acessorio === "interruptor" && produto.especifico?.sensor && <tr><td>Sensor</td><td>{produto.especifico.sensor}</td></tr>}
                {produto.tipo_acessorio === "interruptor" && produto.especifico?.cabo_mm != null && <tr><td>Cabo</td><td>{produto.especifico.cabo_mm} m</td></tr>}
                {produto.tipo_acessorio === "interruptor" && produto.especifico?.distancia_min_m != null && <tr><td>Distância mín</td><td>{produto.especifico.distancia_min_m} m</td></tr>}
                {produto.tipo_acessorio === "interruptor" && produto.especifico?.distancia_max_m != null && <tr><td>Distância máx</td><td>{produto.especifico.distancia_max_m} m</td></tr>}

                {produto.tipo_acessorio === "conector_uniao" && produto.especifico?.material && <tr><td>Material</td><td>{produto.especifico.material}</td></tr>}
                {produto.tipo_acessorio === "conector_uniao" && produto.especifico?.tipo_conexao && <tr><td>Tipo de conexão</td><td>{produto.especifico.tipo_conexao}</td></tr>}
                {produto.tipo_acessorio === "conector_uniao" && produto.especifico?.corrente_a != null && <tr><td>Corrente</td><td>{produto.especifico.corrente_a} A</td></tr>}
                {produto.tipo_acessorio === "conector_uniao" && produto.especifico?.largura_mm != null && <tr><td>Largura</td><td>{produto.especifico.largura_mm} mm</td></tr>}
                {produto.tipo_acessorio === "conector_uniao" && produto.especifico?.numero_vias != null && <tr><td>Nº de vias</td><td>{produto.especifico.numero_vias}</td></tr>}

                {produto.tipo_acessorio === "cabo_encaixe" && produto.especifico?.tipologia && <tr><td>Tipologia</td><td>{produto.especifico.tipologia}</td></tr>}
                {produto.tipo_acessorio === "cabo_encaixe" && produto.especifico?.tipo_ligacao && <tr><td>Tipo de ligação</td><td>{produto.especifico.tipo_ligacao}</td></tr>}
                {produto.tipo_acessorio === "cabo_encaixe" && produto.especifico?.ip != null && <tr><td>IP</td><td>{produto.especifico.ip}</td></tr>}
                {produto.tipo_acessorio === "cabo_encaixe" && produto.especifico?.corrente_a != null && <tr><td>Corrente</td><td>{produto.especifico.corrente_a} A</td></tr>}

                {produto.tipo_acessorio === "clipe_tampa" && produto.especifico?.tipo && <tr><td>Tipo</td><td>{produto.especifico.tipo}</td></tr>}
                {produto.tipo_acessorio === "clipe_tampa" && produto.especifico?.tipologia && <tr><td>Tipologia</td><td>{produto.especifico.tipologia}</td></tr>}
                {produto.tipo_acessorio === "clipe_tampa" && produto.especifico?.material && <tr><td>Material</td><td>{produto.especifico.material}</td></tr>}

                {produto.tipo_acessorio === "ligador_fio" && produto.especifico?.tipo && <tr><td>Tipo</td><td>{produto.especifico.tipo}</td></tr>}
                {produto.tipo_acessorio === "ligador_fio" && produto.especifico?.tipologia && <tr><td>Tipologia</td><td>{produto.especifico.tipologia}</td></tr>}
                {produto.tipo_acessorio === "ligador_fio" && produto.especifico?.unidades_por_caixa != null && <tr><td>Unidades por caixa</td><td>{produto.especifico.unidades_por_caixa}</td></tr>}
                {produto.tipo_acessorio === "ligador_fio" && produto.especifico?.voltagem_v != null && <tr><td>Voltagem</td><td>{produto.especifico.voltagem_v} V</td></tr>}
                {produto.tipo_acessorio === "ligador_fio" && produto.especifico?.ip != null && <tr><td>IP</td><td>{produto.especifico.ip}</td></tr>}

                {produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.tipo && <tr><td>Tipo</td><td>{produto.especifico.tipo}</td></tr>}
                {produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.tipologia && <tr><td>Tipologia</td><td>{produto.especifico.tipologia}</td></tr>}
                {produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.comprimento_mm != null && <tr><td>Comprimento</td><td>{produto.especifico.comprimento_mm} mm</td></tr>}
                {produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.largura_mm != null && <tr><td>Largura</td><td>{produto.especifico.largura_mm} mm</td></tr>}
                {produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.quantidade_ml != null && <tr><td>Quantidade</td><td>{produto.especifico.quantidade_ml} ml</td></tr>}
                {produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.tempo_cura && <tr><td>Tempo de cura</td><td>{produto.especifico.tempo_cura}</td></tr>}
                {produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.cor && <tr><td>Cor</td><td>{produto.especifico.cor}</td></tr>}
                {produto.tipo_acessorio === "fixacao_cola" && produto.especifico?.forca_psi != null && <tr><td>Força</td><td>{produto.especifico.forca_psi} PSI</td></tr>}

                {produto.tipo_acessorio === "ficha" && produto.especifico?.tipologia && <tr><td>Tipologia</td><td>{produto.especifico.tipologia}</td></tr>}
                {produto.tipo_acessorio === "ficha" && produto.especifico?.medida && <tr><td>Medida</td><td>{produto.especifico.medida}</td></tr>}
                {produto.tipo_acessorio === "ficha" && produto.especifico?.descricao_extra && <tr><td>Descrição</td><td>{produto.especifico.descricao_extra}</td></tr>}

                {produto.tipo_acessorio === "manga" && produto.especifico?.diametro_normal_mm != null && <tr><td>Diâmetro inicial</td><td>{produto.especifico.diametro_normal_mm} mm</td></tr>}
                {produto.tipo_acessorio === "manga" && produto.especifico?.diametro_pos_aquecimento_mm != null && <tr><td>Diâmetro pós-aquecimento</td><td>{produto.especifico.diametro_pos_aquecimento_mm} mm</td></tr>}
                {produto.tipo_acessorio === "manga" && produto.especifico?.rolo_m != null && <tr><td>Rolo</td><td>{produto.especifico.rolo_m} m</td></tr>}

                {produto.tipo_acessorio === "ferro_solda" && produto.especifico?.tipologia && <tr><td>Tipologia</td><td>{produto.especifico.tipologia}</td></tr>}
                {produto.tipo_acessorio === "ferro_solda" && produto.especifico?.descricao_extra && <tr><td>Descrição</td><td>{produto.especifico.descricao_extra}</td></tr>}

                {produto.tipo_acessorio === "fio_paralelo" && produto.especifico?.tipologias?.length > 0 && <tr><td>Tipologia</td><td>{produto.especifico.tipologias.join(", ")}</td></tr>}
              </tbody>
            </table>

            {produto.especifico?.tipos_controlo?.length > 0 && (
              <div className="pp-instalacoes" style={{ marginTop: 12 }}>
                <span className="pp-label">Tipos de controlo:</span>
                <div className="pp-tags">
                  {produto.especifico.tipos_controlo.map(t => <span key={t} className="pp-tag">{t}</span>)}
                </div>
              </div>
            )}

            {produto.especifico?.tipologias?.length > 0 && produto.tipo_acessorio === "conector_uniao" && (
              <div className="pp-instalacoes" style={{ marginTop: 12 }}>
                <span className="pp-label">Tipologias:</span>
                <div className="pp-tags">
                  {produto.especifico.tipologias.map(t => <span key={t} className="pp-tag">{t}</span>)}
                </div>
              </div>
            )}

            {produto.especifico?.capacidades?.length > 0 && (
              <div className="pp-instalacoes" style={{ marginTop: 12 }}>
                <span className="pp-label">Capacidades:</span>
                <div className="pp-tags">
                  {produto.especifico.capacidades.map(c => <span key={c} className="pp-tag">{c}</span>)}
                </div>
              </div>
            )}

            {produto.especifico?.resistencias?.length > 0 && (
              <div className="pp-instalacoes" style={{ marginTop: 12 }}>
                <span className="pp-label">Resistências:</span>
                <div className="pp-tags">
                  {produto.especifico.resistencias.map(r => <span key={r} className="pp-tag">{r}</span>)}
                </div>
              </div>
            )}

            {produto.especifico?.tensoes?.length > 0 && (
              <>
                <h3>Tensões</h3>
                {produto.especifico.tensoes.map((t, i) => (
                  <div key={i} style={{ marginBottom: "16px" }}>
                    <h4>Tensão de entrada</h4>
                    <table className="pp-tabela">
                      <tbody>
                        <tr><td>Tipo</td><td>{t.tipo_tensao ?? "—"}</td></tr>
                        {t.voltagem_v != null && <tr><td>Voltagem</td><td>{t.voltagem_v} V</td></tr>}
                        {t.voltagem_min_v != null && <tr><td>Voltagem mín</td><td>{t.voltagem_min_v} V</td></tr>}
                        {t.voltagem_max_v != null && <tr><td>Voltagem máx</td><td>{t.voltagem_max_v} V</td></tr>}
                        {t.corrente_max_a != null && <tr><td>Corrente máxima</td><td>{t.corrente_max_a} A</td></tr>}
                      </tbody>
                    </table>

                    {t.potencias?.length > 0 && (
                      <table className="pp-tabela" style={{ marginTop: "8px" }}>
                        <thead>
                          <tr><th>Tensão saída (V)</th><th>Potência (W)</th></tr>
                        </thead>
                        <tbody>
                          {t.potencias.map((p, j) => (
                            <tr key={j}>
                              <td>{p.voltagem_v ?? "—"}</td>
                              <td>{p.potencia_max_w ?? "—"}</td>
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
                        {produto.tipo_acessorio === "fio_paralelo" && <td>{v.rolo_m != null ? `${v.rolo_m} m` : "—"}</td>}
                        <td>{v.preco != null ? `${Number(v.preco).toFixed(2)} €` : "—"}</td>
                        <td>{v.ativo ? "Ativo" : "Inativo"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

      </section>

      {/* ── Certificados (power) ── */}
      {tipo === "power" && produto.certificacoes?.length > 0 && (
        <section className="pp-secao">
          <h2>Certificados</h2>
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
        </section>
      )}

      {/* ── Variantes / Acabamentos (perfis) ── */}
      {tipo === "perfil" && produto.acabamentos?.length > 0 && (
        <section className="pp-secao">
          <h2>Variantes</h2>
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
                      <td>{m.preco != null ? `${Number(m.preco).toFixed(2)} €` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {/* ── Difusores compatíveis (perfis) ── */}
      {tipo === "perfil" && produto.difusores?.length > 0 && (
        <section className="pp-secao">
          <h2>Difusores Compatíveis</h2>
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
                        <td>{v.referencia ?? "—"}</td>
                        <td>{v.comprimento_m} m</td>
                        <td>{v.preco != null ? `${Number(v.preco).toFixed(2)} €` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Artigos / Versões (fitas LED) ── */}
      {tipo === "fita_led" && produto.versoes?.length > 0 && (
        <section className="pp-secao">
          <h2>Artigos</h2>
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
                        <td>{o.referencia ?? "—"}</td>
                        <td>{o.temperatura_cor ?? "—"}</td>
                        <td>{o.intensidade_luminosa_lm != null ? `${o.intensidade_luminosa_lm} lm` : "—"}</td>
                        <td>{o.preco_metro != null ? `${Number(o.preco_metro).toFixed(2)} €` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Dimensões (neon) ── */}
      {tipo === "neon" && produto.dimensoes?.length > 0 && (
        <section className="pp-secao">
          <h2>Dimensões disponíveis</h2>
          <table className="pp-tabela">
            <tbody>
              <tr>
                <td>{produto.dimensoes.map(d => `${d.comprimento_m} m`).join(" - ")}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* ── Versões / Variantes (neon) ── */}
      {tipo === "neon" && produto.versoes?.length > 0 && (
        <section className="pp-secao">
          <h2>Artigos</h2>
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
                        <td>{va.referencia ?? "—"}</td>
                        <td>{va.temperatura_cor ? `${va.temperatura_cor} K` : va.tipo_cor ?? "—"}</td>
                        <td>{va.intensidade_luminosa_lm != null ? `${va.intensidade_luminosa_lm} lm/m` : "—"}</td>
                        <td>{va.preco_metro != null ? `${Number(va.preco_metro).toFixed(2)} €` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Compatibilidade (controlador) ── */}
      {tipo === "controlador" && produto.compatibilidades?.length > 0 && (
        <section className="pp-secao">
          <h2>Comandos Compatíveis</h2>
          <div className="pp-tags">
            {produto.compatibilidades.map(c => (
              <span key={c.comando_id} className="pp-tag">{c.comando_nome}</span>
            ))}
          </div>
        </section>
      )}

      {/* ── Compatibilidade (comando) ── */}
      {tipo === "comando" && produto.compatibilidades?.length > 0 && (
        <section className="pp-secao">
          <h2>Dispositivos Compatíveis</h2>
          <div className="pp-tags">
            {produto.compatibilidades.map(c => (
              <span key={c.controlador_id} className="pp-tag">{c.nome}</span>
            ))}
          </div>
        </section>
      )}

      {/* ── Receiver do kit ── */}
      {tipo === "kit" && produto.receiver && (
        <section className="pp-secao">
          <h2>Receiver</h2>
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
          <table className="pp-tabela">
            <tbody>
              {produto.receiver.ip != null && <tr><td>IP</td><td>IP{produto.receiver.ip}</td></tr>}
              {produto.receiver.comprimento_mm != null && <tr><td>Comprimento</td><td>{produto.receiver.comprimento_mm} mm</td></tr>}
              {produto.receiver.largura_mm != null && <tr><td>Largura</td><td>{produto.receiver.largura_mm} mm</td></tr>}
              {produto.receiver.altura_mm != null && <tr><td>Altura</td><td>{produto.receiver.altura_mm} mm</td></tr>}
              {produto.receiver.cor && <tr><td>Cor</td><td>{produto.receiver.cor}</td></tr>}
              {produto.receiver.certificacoes?.length > 0 && <tr><td>Certificações</td><td>{produto.receiver.certificacoes.join(", ")}</td></tr>}
              {produto.receiver.receiver_frequencias?.length > 0 && <tr><td>Frequência entrada</td><td>{produto.receiver.receiver_frequencias.join(" / ")} MHz</td></tr>}
              {produto.receiver.receiver_garantia_anos != null && <tr><td>Garantia</td><td>{produto.receiver.receiver_garantia_anos} anos</td></tr>}
            </tbody>
          </table>
          {produto.receiver.receiver_tipos_controlo?.length > 0 && (
            <div className="pp-instalacoes" style={{ marginTop: 12 }}>
              <span className="pp-label">Tipos de controlo:</span>
              <div className="pp-tags">
                {produto.receiver.receiver_tipos_controlo.map(t => <span key={t} className="pp-tag">{t}</span>)}
              </div>
            </div>
          )}
          {produto.receiver.receiver_tipos_sinal?.length > 0 && (
            <div className="pp-instalacoes" style={{ marginTop: 8 }}>
              <span className="pp-label">Tipos de sinal:</span>
              <div className="pp-tags">
                {produto.receiver.receiver_tipos_sinal.map(t => <span key={t} className="pp-tag">{t}</span>)}
              </div>
            </div>
          )}
          {produto.receiver.entradas?.length > 0 && (
            <>
              <h3>Entradas</h3>
              <table className="pp-tabela">
                <thead><tr><th>Tipo</th><th>V mín</th><th>V máx</th></tr></thead>
                <tbody>
                  {produto.receiver.entradas.map((e, i) => (
                    <tr key={i}>
                      <td>{e.tipo_input ?? "—"}</td>
                      <td>{e.voltagem_min != null ? `${e.voltagem_min} V` : "—"}</td>
                      <td>{e.voltagem_max != null ? `${e.voltagem_max} V` : "—"}</td>
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
                      <td>{s.numero_canais ?? "—"}</td>
                      <td>{s.amperes_por_canal != null ? `${s.amperes_por_canal} A` : "—"}</td>
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
                      <td>{l.voltagem != null ? `${l.voltagem} V` : "—"}</td>
                      <td>{l.potencia_max_w != null ? `${l.potencia_max_w} W` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      {/* ── Remote do kit ── */}
      {tipo === "kit" && produto.remote && (
        <section className="pp-secao">
          <h2>Remote</h2>
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
          <table className="pp-tabela">
            <tbody>
              {produto.remote.remote_certificacoes?.length > 0 && <tr><td>Certificações</td><td>{produto.remote.remote_certificacoes.join(", ")}</td></tr>}
              {produto.remote.tipo_alimentacao && <tr><td>Alimentação</td><td>{produto.remote.tipo_alimentacao}</td></tr>}
              {produto.remote.frequencias?.length > 0 && <tr><td>Frequência</td><td>{produto.remote.frequencias.join(" / ")} MHz</td></tr>}
              {produto.remote.remote_comprimento_mm != null && <tr><td>Comprimento</td><td>{produto.remote.remote_comprimento_mm} mm</td></tr>}
              {produto.remote.remote_largura_mm != null && <tr><td>Largura</td><td>{produto.remote.remote_largura_mm} mm</td></tr>}
              {produto.remote.remote_altura_mm != null && <tr><td>Altura</td><td>{produto.remote.remote_altura_mm} mm</td></tr>}
              {produto.remote.remote_cor && <tr><td>Cor</td><td>{produto.remote.remote_cor}</td></tr>}
            </tbody>
          </table>
        </section>
      )}

    </div>
  )
}

export default PaginaProduto
