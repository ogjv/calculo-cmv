type HelpModule = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  fileName: string;
  acceptedFiles: string;
  imageSrc: string;
  imageAlt: string;
  sourcePath: string[];
  setup: string[];
  notes: string[];
};

const helpModules: HelpModule[] = [
  {
    id: "dashboard-fichas-tecnicas",
    eyebrow: "Dashboard",
    title: "Fichas técnicas",
    description: "Arquivo usado para buscar custo unitário, preço e composição dos produtos vendidos no período.",
    fileName: "Relatório de Ficha Técnica",
    acceptedFiles: ".xls ou .xlsx",
    imageSrc: `${import.meta.env.BASE_URL}guia-fichas-tecnicas.png`,
    imageAlt: "Tela de exportação do relatório de fichas técnicas",
    sourcePath: ["Ficha Técnica", "Ficha técnica", "Exportar para Excel"],
    setup: ["Tipo do relatório: Sintético", "Com ficha técnica", "Incluir produtos inativos", "Mostrar custo das mercadorias: pelo preço médio"],
    notes: [
      "Deve ser enviado junto com o arquivo de vendas do mesmo período.",
      "É importante incluir produtos inativos para evitar itens vendidos sem ficha técnica.",
      "O custo será usado como base do CMV teórico do Dashboard."
    ]
  },
  {
    id: "dashboard-vendas",
    eyebrow: "Dashboard",
    title: "Vendas",
    description: "Arquivo usado para identificar os itens vendidos, quantidades, receita e competência analisada.",
    fileName: "Resumo dos produtos vendidos",
    acceptedFiles: ".xls ou .xlsx",
    imageSrc: `${import.meta.env.BASE_URL}guia-vendas.png`,
    imageAlt: "Tela de configuração do relatório de vendas",
    sourcePath: ["Relatórios de controle", "Totalização", "Configurar", "Resumo dos produtos vendidos"],
    setup: ["Selecionar Resumo dos produtos vendidos", "Tipo: P Venda", "Salvar", "Exportar/emitir em Excel"],
    notes: [
      "Este arquivo define o mês ou período do carregamento no Dashboard.",
      "Envie sempre em par com a ficha técnica vigente daquele mesmo período.",
      "Evite misturar vendas de um restaurante com ficha técnica de outra unidade."
    ]
  },
  {
    id: "entrada-mercadorias",
    eyebrow: "Entrada de mercadorias",
    title: "Compras e abastecimento",
    description: "Use esta etapa para acompanhar volume comprado, fornecedores, grupos de compra e evolução das entradas.",
    fileName: "Relatório de entrada de mercadorias",
    acceptedFiles: ".xls ou .xlsx",
    imageSrc: `${import.meta.env.BASE_URL}guia-entradas-de-mercadorias.png`,
    imageAlt: "Tela de exportação do relatório de entrada de mercadorias",
    sourcePath: ["Entrada de mercadorias", "Entrada de mercadorias por grupo e subgrupo", "Exportar para Excel"],
    setup: ["Grupo: TODOS", "Sub-Grupo: TODOS", "Todas as mercadorias", "Informar intervalo de Data da Nota", "Exportar para Excel"],
    notes: [
      "O sistema acumula arquivos importados em momentos diferentes.",
      "Entradas duplicadas são ignoradas quando possuem a mesma data, nota e valor.",
      "A terceira linha do arquivo é usada para identificar o período do relatório."
    ]
  },
  {
    id: "dre",
    eyebrow: "Análise de DRE",
    title: "Resultado financeiro",
    description: "Use esta etapa para analisar receitas, despesas, margem operacional, margem final e estrutura sobre receita.",
    fileName: "Relatório de DRE analítico",
    acceptedFiles: ".xls ou .xlsx",
    imageSrc: `${import.meta.env.BASE_URL}guia-dre.png`,
    imageAlt: "Tela de exportação do relatório de DRE",
    sourcePath: ["DRE", "Receita/Despesa p/ Grupo", "Despesa por competência", "Exportar Excel"],
    setup: ["Tipo de despesa: Despesa por competência", "Informar período inicial e final", "Exportar Excel"],
    notes: [
      "Importe uma competência por vez para manter o histórico mensal organizado.",
      "As nomenclaturas podem variar entre restaurantes; o sistema tenta identificar equivalências automaticamente.",
      "Depois de importar, confira os principais indicadores antes de considerar o mês validado."
    ]
  }
];

const uniqueHelpModules = helpModules.filter((module, index, modules) => modules.findIndex((candidate) => candidate.id === module.id) === index);

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h7l3 3v13H7z" />
      <path d="M14 4v4h4" />
      <path d="M9.5 11h5" />
      <path d="M9.5 14h5" />
      <path d="M9.5 17h3" />
    </svg>
  );
}

export function HelpPage() {
  return (
    <section className="help-page">
      <div className="help-hero card">
        <div>
          <span className="eyebrow">Central de orientação</span>
          <h2>Arquivos corretos para cada análise</h2>
          <p>
            Use esta página como guia rápido para saber qual relatório importar em cada aba do sistema. A ideia é reduzir
            erros de upload e garantir que cada indicador seja calculado com a base correta.
          </p>
        </div>
      </div>

      <div className="help-module-grid">
        {uniqueHelpModules.map((module) => (
          <article className="card help-module-card" key={module.id}>
            <div className="help-module-head">
              <span className="help-module-icon">
                <HelpIcon />
              </span>
              <div>
                <span className="eyebrow">{module.eyebrow}</span>
                <h3>{module.title}</h3>
              </div>
            </div>

            <p>{module.description}</p>

            <figure className="help-reference-shot">
              <img src={module.imageSrc} alt={module.imageAlt} loading="lazy" />
              <figcaption>{module.imageAlt}</figcaption>
            </figure>

            <div className="help-file-box">
              <span>Arquivo necessário</span>
              <strong>{module.fileName}</strong>
              <small>Formato aceito: {module.acceptedFiles}</small>
            </div>

            <div className="help-route-box">
              <span className="eyebrow">Caminho no sistema</span>
              <div className="help-route">
                {module.sourcePath.map((step, index) => (
                  <span key={`${module.id}-${step}`}>
                    {step}
                    {index < module.sourcePath.length - 1 ? <small>→</small> : null}
                  </span>
                ))}
              </div>
            </div>

            <div className="help-setup-box">
              <span className="eyebrow">Configuração recomendada</span>
              <ul>
                {module.setup.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <ul className="help-checklist">
              {module.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
