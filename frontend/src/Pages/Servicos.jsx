import { useState } from "react"
import { FaEye, FaListUl, FaShoppingCart, FaGift, FaRocket, FaSitemap } from "react-icons/fa"
import "./estilosPages/Servicos.css"

const FASES = [
  {
    titulo: "Ideia", angulo: 180, Icone: FaEye,
    desc: "O seu projeto começa com uma visão. Nesta fase, as suas ideias ganham forma, onde o tipo de produtos e os efeitos de iluminação são definidos. É o momento de explorar as possibilidades da nossa vasta gama, preparando o terreno para a criação de um design luminoso único e personalizado à sua medida."
  },
  {
    titulo: "Produtos", angulo: 144, Icone: FaListUl,
    desc: "Seleção detalhada de fitas LED, perfis, drivers e conectores com o apoio da nossa equipa comercial, garantindo a combinação certa de componentes para cada projeto específico."
  },
  {
    titulo: "Encomenda", angulo: 108, Icone: FaShoppingCart,
    desc: "Submissão à equipa comercial com processo de verificação transparente. Acompanhamento personalizado em cada etapa da encomenda até à confirmação final."
  },
  {
    titulo: "Preparação", angulo: 72, Icone: FaGift,
    desc: "Ajustes personalizados incluindo cortes e montagens para que todos os materiais cheguem prontos a instalar, reduzindo significativamente o tempo em obra."
  },
  {
    titulo: "Envio", angulo: 36, Icone: FaRocket,
    desc: "Embalagem cuidada com promessa de entrega em 48 horas úteis após confirmação da encomenda, com rastreio completo e acompanhamento até à entrega."
  },
  {
    titulo: "Instalação", angulo: 0, Icone: FaSitemap,
    desc: "Fase final que requer profissionais eletricistas certificados, cumprindo todas as normas de segurança para garantir uma instalação perfeita e durável."
  },
]

const passos = [
  {
    num: "01",
    titulo: "Análise do espaço e intenção",
    desc: "Cada ambiente tem características próprias. O primeiro passo é analisar as dimensões, a funcionalidade do espaço e o tipo de iluminação pretendido. A luz será direta para destacar elementos, ou indireta para um efeito mais difuso e aconchegante? Será funcional, como num escritório, ou decorativa, para criar uma atmosfera única?"
  },
  {
    num: "02",
    titulo: "Escolha do tipo de perfil",
    desc: "Os perfis de alumínio são a base da luminária. Ajudamo-lo a escolher a opção ideal para o seu projeto:",
    items: [
      "Superfície: Instalação fácil em tetos ou paredes.",
      "Encastrar: Para uma integração total na arquitetura.",
      "Canto: Ideal para transições elegantes entre superfícies.",
      "Gesso ou Cerâmica: Para uma fusão perfeita com o acabamento.",
      "Flexível ou Rígido: Para se adaptar a formas curvas ou retas.",
    ]
  },
  {
    num: "03",
    titulo: "Definição do tipo de luz",
    desc: "A escolha da fita LED e do difusor dita a intensidade e o ambiente do espaço.",
    items: [
      "Intensidade: Desde uma presença suave para orientação até uma iluminação intensa para espaços de trabalho.",
      "Temperatura de Cor: Quente (acolhedor), Neutra (versátil) ou Fria (moderna).",
      "Cor: Opções RGB ou RGBW para efeitos coloridos e dinâmicos.",
    ]
  },
  {
    num: "04",
    titulo: "Seleção do método de fixação",
    desc: "A forma como o perfil será instalado impacta o design e a funcionalidade final. As opções incluem: suspenso, inserido (em tetos/paredes), apoiado (em móveis) ou soluções de elevada resistência."
  },
  {
    num: "05",
    titulo: "Escolha da cor e acabamento do perfil",
    desc: "O acabamento do perfil é um detalhe crucial. Para além do alumínio natural, dispomos de acabamentos standard em Preto Lacado e Branco Lacado. Para uma personalização total, podemos lacar os perfis em qualquer cor da paleta RAL, garantindo uma harmonia perfeita com o seu projeto."
  },
  {
    num: "06",
    titulo: "Definição da alimentação e controlo",
    desc: "Garantimos o funcionamento perfeito da sua luminária, selecionando a alimentação adequada para evitar perdas de intensidade e o sistema de controlo ideal: desde um simples liga/desliga a dimmers, sensores de presença ou controlos smart."
  },
  {
    num: "07",
    titulo: "Produção e entrega da sua luminária",
    desc: "Com todas as escolhas feitas, a nossa equipa técnica trata do resto. Produzimos a sua luminária à medida e enviamos pronta a instalar, com todas as ligações, conexões e fontes preparadas."
  },
]

const servicos = [
  { titulo: "Corte de Perfil", desc: "Corte personalizado de perfil de alumínio à medida exata do cliente." },
  { titulo: "Solda", desc: "Ponto de solda profissional ou soldadura de fios nas fitas LED e componentes." },
  { titulo: "Aplicação de Fita LED", desc: "Montagem da fita LED no interior do perfil com fixação e dissipação adequadas." },
  { titulo: "Aplicação de Fita Adesiva 3M", desc: "Colagem de fita adesiva 3M VHB de dupla face nos perfis para uma fixação segura." },
  { titulo: "Aplicação de Componentes", desc: "Integração de sensores, interruptores, difusores, tampas e fontes no perfil." },
  { titulo: "Montagem em Fita LED/Neon", desc: "Preparação de ligações, tampas e sensores em fita LED/Neon." },
  { titulo: "Aplicações de Uniões", desc: "Montagem e colagem de uniões lineares ou de canto entre módulos ou fitas." },
  { titulo: "Preparação de Fontes", desc: "Instalação de fichas de ligação e preparação de fontes de alimentação." },
  { titulo: "Etiquetas Personalizadas", desc: "Impressão e aplicação de etiquetas com a referência ou dados do cliente." },
]

// Arco: sistema de coordenadas 900 × 460, centro do círculo em (450, 460), raio 370
const CX = 450, CY = 460, R = 370
const ITEM_R = 36

function pos(angulo) {
  const rad = angulo * Math.PI / 180
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) }
}

function Servicos() {
  const [selecionado, setSelecionado] = useState(0)

  return (
    <div className="serv-container">

      {/* Hero */}
      <div className="serv-hero">
        <div className="serv-hero-inner">
          <div className="serv-hero-badge">SERVIÇOS E PERSONALIZAÇÃO</div>
          <h1 className="serv-hero-titulo">O seu projeto de iluminação, criado à sua medida.</h1>
          <p className="serv-hero-sub">
            Na EPLUS LIGHTING, acreditamos que cada espaço é único e merece uma solução de iluminação que o complemente na perfeição. O nosso serviço de personalização combina planeamento individual com uma execução técnica de excelência, permitindo-nos transformar a sua visão em realidade. Todo o processo é realizado em Portugal, pela nossa equipa de especialistas.
          </p>
        </div>
      </div>

      <div className="serv-body">

        {/* Processo em arco */}
        <section className="serv-secao">
          <div className="serv-secao-header">
            <div className="serv-secao-bar" />
            <h2 className="serv-secao-titulo">O Nosso Processo</h2>
          </div>
          <p className="serv-arco-intro">Apresentamos-lhe o nosso processo de trabalho, pensado para o guiar em cada decisão, de forma simples e acompanhada.</p>

          <div className="serv-arco-wrap">
            <svg
              className="serv-arco-svg"
              viewBox="0 0 900 460"
              preserveAspectRatio="xMidYMid meet"
              overflow="visible"
            >
              {/* Arco */}
              <path
                d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
                fill="none"
                stroke="#013634"
                strokeWidth="1.5"
              />

              {/* Itens */}
              {FASES.map((f, i) => {
                const { x, y } = pos(f.angulo)
                const ativo = selecionado === i
                const Icone = f.Icone
                return (
                  <g key={i} className={`serv-arco-item${ativo ? " serv-arco-item--ativo" : ""}`} onClick={() => setSelecionado(i)}>
                    <circle cx={x} cy={y} r={ITEM_R} className={`serv-arco-circulo${ativo ? " serv-arco-circulo--ativo" : ""}`} />
                    <foreignObject x={x - 12} y={y - 12} width="24" height="24">
                      <div xmlns="http://www.w3.org/1999/xhtml" className={`serv-arco-icone${ativo ? " serv-arco-icone--ativo" : ""}`}>
                        <Icone />
                      </div>
                    </foreignObject>
                    <text x={x} y={y + ITEM_R + 18} className={`serv-arco-label${ativo ? " serv-arco-label--ativo" : ""}`}>
                      {f.titulo}
                    </text>
                  </g>
                )
              })}

              {/* Descrição no centro */}
              <foreignObject x="200" y="240" width="500" height="200">
                <div xmlns="http://www.w3.org/1999/xhtml" className="serv-arco-desc">
                  <p className="serv-arco-desc-texto">{FASES[selecionado].desc}</p>
                </div>
              </foreignObject>
            </svg>
          </div>
        </section>

        {/* Como criamos a sua luminária */}
        <section className="serv-secao serv-secao-guia">
          <div className="serv-secao-header">
            <div className="serv-secao-bar" />
            <h2 className="serv-secao-titulo">Como criamos a sua luminária perfeita: O processo em 7 simples passos</h2>
          </div>
          <p className="serv-guia-intro">O nosso método colaborativo garante que o resultado final corresponde exatamente às suas necessidades estéticas e funcionais.</p>
          <div className="serv-passos-lista">
            {passos.map((p, i) => (
              <div key={p.num} className="serv-passo-item-bloco">
                <div className="serv-passo-header">
                  <span className="serv-passo-num-badge">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="serv-passo-titulo-lista">{p.titulo}</h3>
                </div>
                <p className="serv-passo-desc-lista">{p.desc}</p>
                {p.items && (
                  <ul className="serv-passo-items">
                    {p.items.map((item, idx) => (
                      <li key={idx} className="serv-passo-item">{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Serviços Técnicos */}
        <section className="serv-secao">
          <div className="serv-secao-header">
            <div className="serv-secao-bar" />
            <h2 className="serv-secao-titulo">A nossa expertise ao seu dispor: serviços técnicos</h2>
          </div>
          <p className="serv-tecnico-intro">Por trás de um processo simples para si, está uma equipa técnica especializada e um conjunto de serviços de precisão que garantem a qualidade de cada peça que produzimos.</p>
          <div className="serv-tabela-scroll">
            <table className="serv-tecnico-tabela">
              <thead>
                <tr>
                  <th className="serv-tabela-th">Serviço</th>
                  <th className="serv-tabela-th">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map(s => (
                  <tr key={s.titulo} className="serv-tabela-tr">
                    <td className="serv-tabela-td serv-tabela-td-nome">{s.titulo}</td>
                    <td className="serv-tabela-td">{s.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Contacto */}
        <section className="serv-contacto">
          <div className="serv-contacto-inner">
            <div className="serv-contacto-texto">
              <h2 className="serv-contacto-titulo">Tem um projecto ou uma ideia?<br />Fale Connosco.</h2>
              <p className="serv-contacto-sub">A nossa equipa está inteiramente disponível para o ajudar a escolher e a desenvolver a solução perfeita para o seu projeto. Contacte-nos e vamos transformar a sua visão em realidade.</p>
            </div>
            <div className="serv-contacto-info">
              <div className="serv-contacto-chip">
                <span className="serv-contacto-chip-label">Morada</span>
                <span className="serv-contacto-chip-valor">Rua Campo de Viriato 94, 3510-122 Viseu</span>
              </div>
              <div className="serv-contacto-chip">
                <span className="serv-contacto-chip-label">Telefone</span>
                <span className="serv-contacto-chip-valor">+351 232 093 154</span>
              </div>
              <div className="serv-contacto-chip">
                <span className="serv-contacto-chip-label">Email</span>
                <span className="serv-contacto-chip-valor">info@eplus.lighting</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

export default Servicos
