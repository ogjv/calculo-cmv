import type { AppSection } from "../hooks/useSessionWorkspace";
import { getNavigationIcon } from "./appChrome";

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

type ReaderHelpModule = {
  id: string;
  section: AppSection;
  eyebrow: string;
  title: string;
  description: string;
  source: string;
  markers: {
    label: string;
    definition: string;
    origin: string;
  }[];
  readingTips: string[];
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
    fileName: "Relatório de DRE por grupo da receita e despesa por caixa",
    acceptedFiles: ".xls ou .xlsx",
    imageSrc: `${import.meta.env.BASE_URL}guia-dre.png`,
    imageAlt: "Tela de exportação do relatório de DRE",
    sourcePath: ["DRE", "Receita/Despesa p/ Grupo", "Despesa por caixa", "Exportar Excel"],
    setup: ["Tipo de despesa: Despesa por caixa", "Informar período inicial e final", "Exportar Excel"],
    notes: [
      "Importe um período por vez para manter o histórico mensal organizado.",
      "As nomenclaturas podem variar entre restaurantes; o sistema tenta identificar equivalências automaticamente.",
      "Depois de importar, confira os principais indicadores antes de considerar o mês validado."
    ]
  }
];

const uniqueHelpModules = helpModules.filter((module, index, modules) => modules.findIndex((candidate) => candidate.id === module.id) === index);

const readerHelpModules: ReaderHelpModule[] = [
  {
    id: "reader-dashboard",
    section: "dashboard",
    eyebrow: "Dashboard",
    title: "Como interpretar vendas, custos e CMV",
    description:
      "Esta aba transforma vendas e fichas técnicas em uma leitura prática de rentabilidade por produto, grupo e período.",
    source: "As informações combinam o arquivo de vendas do período com a ficha técnica correspondente daquele mesmo período.",
    markers: [
      {
        label: "Receita",
        definition: "Total vendido no recorte analisado. Ajuda a entender quais itens e grupos concentram o faturamento.",
        origin: "Vem do relatório de vendas."
      },
      {
        label: "Quantidade",
        definition: "Volume vendido de cada item. É útil para separar produtos populares de produtos apenas caros.",
        origin: "Vem do relatório de vendas."
      },
      {
        label: "Preço",
        definition: "Preço médio praticado para o item no período. Serve como referência para avaliar posicionamento e variações.",
        origin: "Vem da combinação entre vendas e ficha técnica."
      },
      {
        label: "Custo unitário",
        definition: "Custo teórico de uma unidade vendida. É a base para entender se a margem do produto está saudável.",
        origin: "Vem da ficha técnica."
      },
      {
        label: "CMV",
        definition: "Percentual do custo sobre a venda. Quanto maior, maior a pressão de custo sobre aquele item ou grupo.",
        origin: "Calculado a partir de custo e receita."
      },
      {
        label: "Participação por grupo",
        definition: "Mostra o peso de cada grupo no faturamento e no custo. Ajuda a identificar onde está a maior influência no resultado.",
        origin: "Calculado a partir dos itens vendidos."
      }
    ],
    readingTips: [
      "Observe primeiro os grupos com maior participação na receita; eles têm mais impacto na operação.",
      "Produtos com alto volume e CMV elevado merecem prioridade, porque qualquer ajuste gera efeito maior.",
      "Compare receita, custo unitário e CMV antes de concluir que um produto vende bem de forma saudável."
    ]
  },
  {
    id: "reader-dre",
    section: "dre",
    eyebrow: "Análise de DRE",
    title: "Como ler o resultado financeiro",
    description:
      "Esta aba organiza receitas, custos e despesas para mostrar a saúde econômica da operação no período selecionado.",
    source: "As informações vêm do modelo de DRE analítico do restaurante, respeitando o período selecionado.",
    markers: [
      {
        label: "Receita operacional",
        definition: "Base principal de vendas da operação. É o denominador usado para calcular os principais percentuais da DRE.",
        origin: "Vem das linhas de receita operacional do DRE."
      },
      {
        label: "Insumos / CMV sobre receita",
        definition: "Mostra quanto os produtos vendidos consumiram da receita. É um dos principais indicadores de eficiência de cardápio.",
        origin: "Vem dos grupos de insumos, CMV, alimentos, bebidas ou equivalentes."
      },
      {
        label: "Pessoal / CMO sobre receita",
        definition: "Indica o peso da mão de obra na receita. Ajuda a avaliar escala, produtividade e pressão da folha.",
        origin: "Vem dos grupos de pessoal, CMO, folha ou equivalentes."
      },
      {
        label: "Despesas operacionais",
        definition: "Reúne gastos necessários para manter a operação funcionando, além de insumos e pessoal.",
        origin: "Vem dos grupos operacionais do DRE."
      },
      {
        label: "Margem operacional",
        definition: "Resultado da operação antes de itens não operacionais. Ajuda a medir se o restaurante é saudável na atividade principal.",
        origin: "Calculada a partir da receita operacional e das despesas operacionais."
      },
      {
        label: "Margem final",
        definition: "Resultado final do período depois de todas as entradas e saídas consideradas no DRE.",
        origin: "Vem do saldo final ou do resultado consolidado do DRE."
      }
    ],
    readingTips: [
      "Comece pela receita operacional e depois compare insumos, pessoal e estrutura sobre essa base.",
      "Margem operacional saudável com margem final ruim pode indicar impacto de despesas não recorrentes ou não operacionais.",
      "Use os pontos de atenção para identificar onde está a maior pressão financeira do período."
    ]
  },
  {
    id: "reader-goods-entry",
    section: "goods-entry",
    eyebrow: "Entrada de mercadorias",
    title: "Como acompanhar compras e abastecimento",
    description:
      "Esta aba mostra como as compras estão distribuídas por período, grupo e fornecedor, facilitando controle de abastecimento.",
    source: "As informações vêm dos lançamentos de entrada de mercadorias, com data, fornecedor, grupo, nota e valor.",
    markers: [
      {
        label: "Total comprado",
        definition: "Soma das entradas no recorte filtrado. Ajuda a acompanhar o volume financeiro de compras.",
        origin: "Vem dos valores das entradas de mercadorias."
      },
      {
        label: "Fornecedores ativos",
        definition: "Quantidade de fornecedores presentes no recorte. Ajuda a entender concentração ou dispersão de compras.",
        origin: "Vem do campo fornecedor das entradas."
      },
      {
        label: "Participação por grupo",
        definition: "Mostra quais grupos concentram mais compras. Ajuda a enxergar onde o caixa está sendo consumido.",
        origin: "Calculada agrupando as entradas por grupo."
      },
      {
        label: "Participação por fornecedor",
        definition: "Mostra o peso de cada fornecedor nas compras. É útil para negociação e análise de dependência.",
        origin: "Calculada agrupando as entradas por fornecedor."
      },
      {
        label: "Ritmo de abastecimento",
        definition: "Mostra a evolução das compras ao longo do tempo. Ajuda a identificar picos, sazonalidade e compras fora do padrão.",
        origin: "Calculado a partir das datas das notas ou competências."
      },
      {
        label: "Filtros",
        definition: "Permitem analisar períodos, grupos e fornecedores específicos sem alterar a base principal.",
        origin: "Aplicados sobre os dados já disponíveis na aba."
      }
    ],
    readingTips: [
      "Use o filtro de datas para comparar períodos equivalentes e evitar conclusões distorcidas.",
      "Fornecedores com alta participação merecem acompanhamento próximo de preço, prazo e qualidade.",
      "Picos de compra podem ser normais, mas devem fazer sentido com estoque, eventos ou sazonalidade."
    ]
  }
];

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

function OwnerHelpPage() {
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

function ReaderHelpPage() {
  return (
    <section className="help-page">
      <div className="help-hero card">
        <div>
          <span className="eyebrow">Central de orientação</span>
          <h2>Entenda as análises do sistema</h2>
          <p>
            Use esta página como apoio para interpretar os principais indicadores. O objetivo é deixar claro o que cada
            informação representa, de onde ela vem e como ela pode ajudar na leitura do restaurante.
          </p>
        </div>
      </div>

      <div className="reader-help-grid">
        {readerHelpModules.map((module) => (
          <article className="card help-module-card reader-help-card" key={module.id}>
            <div className="help-module-head">
              <span className="help-module-icon">
                {getNavigationIcon(module.section)}
              </span>
              <div>
                <span className="eyebrow">{module.eyebrow}</span>
                <h3>{module.title}</h3>
              </div>
            </div>

            <p>{module.description}</p>

            <div className="reader-help-source">
              <span className="eyebrow">Base das informações</span>
              <p>{module.source}</p>
            </div>

            <div className="reader-marker-list">
              {module.markers.map((marker) => (
                <article className="reader-marker-card" key={`${module.id}-${marker.label}`}>
                  <div>
                    <span>{marker.label}</span>
                    <p>{marker.definition}</p>
                  </div>
                  <small>{marker.origin}</small>
                </article>
              ))}
            </div>

            <div className="help-setup-box reader-tips-box">
              <span className="eyebrow">Como analisar na prática</span>
              <ul>
                {module.readingTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HelpPage({ canManageOperationalData = false }: { canManageOperationalData?: boolean }) {
  return canManageOperationalData ? <OwnerHelpPage /> : <ReaderHelpPage />;
}
