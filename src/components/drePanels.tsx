/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { DreImportData, DrePeriodData } from "../types";
import { formatCurrency, formatPercent } from "../utils/cmv";

const drePalette = ["#2f6f5e", "#c9823a", "#b84e3f", "#496f9f", "#8b6f47", "#6f7785", "#a55c7a", "#5f7f4f"];
const shortMonthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const DRE_TOTAL_PERIOD = "__ALL_DRE_PERIODS__";
const DRE_SELECTION_SEPARATOR = ",";

export type DrePanelCopy = {
  navDre: string;
  dreParsedTitle: string;
  dreEmptyTitle: string;
  dreEmptyText: string;
  dreUploadTitle: string;
  dreUploadAction: string;
  dreUploadHint: string;
  dreProcessing: string;
  drePeriod: string;
  dreSelectPeriod: string;
  dreRevenue: string;
  dreOutflows: string;
  dreFinalBalance: string;
  dreResultMap: string;
  dreResultMapText: string;
  dreSectionChart: string;
  dreSectionChartText: string;
  dreParticipationTitle: string;
  dreParticipationText: string;
  dreStrategicTitle: string;
  dreStrategicText: string;
  dreRevenueConcentration: string;
  dreNoData: string;
  dreLargestExpense: string;
  dreFinalMargin: string;
  dreExpenseRatio: string;
  dreRestaurantDiagnostics: string;
  dreRestaurantDiagnosticsText: string;
  dreFinalMarginCard: string;
  dreOperationalMarginCard: string;
  dreInputsOnRevenue: string;
  drePeopleOnRevenue: string;
  dreStructureOnRevenue: string;
  dreHealthy: string;
  dreCritical: string;
  dreAttention: string;
  dreAttentionPoints: string;
  dreRevenueMixTitle: string;
  dreRevenueMixText: string;
  dreMenuMixTitle: string;
  dreMenuMixText: string;
  dreCardFeesTitle: string;
  dreCardFeesText: string;
  dreRevenueVsExpenses: string;
  dreRevenueVsExpensesText: string;
  dreOperationalResultChart: string;
  dreOperationalResultChartText: string;
  total: string;
};

export type DreAnalysisPanelProps = {
  data?: DreImportData;
  periods: DrePeriodData[];
  selectedPeriod: string;
  error?: string;
  processing?: boolean;
  canManageData: boolean;
  copy: DrePanelCopy;
  onImport: (file: File) => void;
  onSelectPeriod: (period: string) => void;
  onRemovePeriod?: (period: string) => void;
};

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(radians),
    y: cy + r * Math.sin(radians)
  };
};

const buildArcPath = (
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
) => {
  const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
    "Z"
  ].join(" ");
};

function IconTrash() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

const normalizeDreLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const matchesAnyDreTerm = (label: string, terms: string[]) => {
  const normalized = normalizeDreLabel(label);
  return terms.some((term) => normalized.includes(normalizeDreLabel(term)));
};

const matchesAnyDreExactTerm = (label: string, terms: string[]) => {
  const normalized = normalizeDreLabel(label).trim();
  return terms.some((term) => normalized === normalizeDreLabel(term).trim());
};

const DRE_INPUT_TERMS = [
  "INSUMOS",
  "CMV",
  "CUSTO DA MERCADORIA",
  "CUSTO DAS MERCADORIAS",
  "CUSTO DOS PRODUTOS",
  "CUSTOS DOS PRODUTOS",
  "CUSTO DE VENDAS",
  "CUSTOS VARIAVEIS"
];

const DRE_OPERATIONAL_EXPENSE_TERMS = [
  "DESPESAS OPERACIONAIS",
  "GASTOS OPERACIONAIS",
  "DESPESAS FIXAS",
  "GASTOS FIXOS",
  "ESTRUTURA"
];

const DRE_PEOPLE_TERMS = [
  "PESSOAL",
  "PERSONAL",
  "FOLHA",
  "SALARIO",
  "SALARIOS",
  "MAO DE OBRA",
  "ENCARGOS",
  "RH",
  "EQUIPE",
  "COLABORADORES"
];

const DRE_PEOPLE_EXACT_TERMS = ["CMO"];

const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: value >= 1000000 ? 1 : 0
  }).format(value);

const getDreGroupValue = (group: DreImportData["sections"][number]["groups"][number]) =>
  group.total?.value ?? group.lines.reduce((sum, line) => sum + line.value, 0);

const getDreSectionValue = (section: DreImportData["sections"][number]) =>
  section.total?.value ?? section.groups.reduce((sum, group) => sum + getDreGroupValue(group), 0);

const isDreNonOperationalLabel = (label: string) => {
  const normalized = normalizeDreLabel(label);
  return normalized.includes("NAO OPERACIONAL") || normalized.includes("NAO OPERACIONAIS");
};

const isDreOperationalRevenueLabel = (label: string) => {
  const normalized = normalizeDreLabel(label);
  return !isDreNonOperationalLabel(label) && (
    normalized.includes("RECEITAS OPERACIONAIS") ||
    normalized.includes("RECEITA OPERACIONAL")
  );
};

const isDreRevenueLabel = (label: string) => {
  const normalized = normalizeDreLabel(label);
  return normalized.includes("RECEITA") && !normalized.includes("RECEITA LIQUIDA") && !isDreNonOperationalLabel(label);
};

const isDreResultLabel = (label: string) => {
  const normalized = normalizeDreLabel(label);
  return normalized.includes("RESULTADO") || normalized.includes("SALDO") || normalized.includes("MARGEM");
};

const findDreSectionByIncludes = (data: DreImportData, terms: string[]) =>
  data.sections.find((section) => {
    return matchesAnyDreTerm(section.label, terms);
  });

const findDreGroupByIncludes = (data: DreImportData, terms: string[]) => {
  for (const section of data.sections) {
    const group = section.groups.find((item) => {
      return matchesAnyDreTerm(item.label, terms);
    });

    if (group) {
      return { section, group };
    }
  }

  return undefined;
};

const findDreSummaryValueByMatcher = (data: DreImportData, matcher: (label: string) => boolean) =>
  data.summary.find((item) => matcher(item.label) && item.value > 0)?.value;

const findDreAnySummaryValueByMatcher = (data: DreImportData, matcher: (label: string) => boolean) =>
  data.summary.find((item) => matcher(item.label))?.value;

const getDreOperationalResultValue = (data: DreImportData) =>
  findDreAnySummaryValueByMatcher(data, (label) => {
    const normalized = normalizeDreLabel(label);
    return normalized.includes("RESULTADO OPERACIONAL") && !normalized.includes("PERCENTUAL");
  });

const getDreFinalBalanceValue = (data: DreImportData) =>
  findDreAnySummaryValueByMatcher(data, (label) => normalizeDreLabel(label).includes("SALDO FINAL")) ??
  getDreOperationalResultValue(data);

const findDreGroupsByIncludes = (data: DreImportData, terms: string[]) =>
  data.sections.flatMap((section) =>
    section.groups
      .filter((group) => matchesAnyDreTerm(group.label, terms))
      .map((group) => ({ section, group }))
  );

const findDreGroupsByExact = (data: DreImportData, terms: string[]) =>
  data.sections.flatMap((section) =>
    section.groups
      .filter((group) => matchesAnyDreExactTerm(group.label, terms))
      .map((group) => ({ section, group }))
  );

const getDreInputsValue = (data: DreImportData) => {
  const inputsSection = findDreSectionByIncludes(data, DRE_INPUT_TERMS);
  if (inputsSection) {
    return getDreSectionValue(inputsSection);
  }

  return findDreGroupsByIncludes(data, DRE_INPUT_TERMS).reduce((sum, item) => sum + getDreGroupValue(item.group), 0);
};

const getDrePeopleValue = (data: DreImportData) => {
  const peopleGroups = [
    ...findDreGroupsByIncludes(data, DRE_PEOPLE_TERMS),
    ...findDreGroupsByExact(data, DRE_PEOPLE_EXACT_TERMS)
  ];

  if (peopleGroups.length > 0) {
    const uniqueGroups = new Map(peopleGroups.map((item) => [`${item.section.label}::${item.group.label}`, item]));
    return [...uniqueGroups.values()].reduce((sum, item) => sum + getDreGroupValue(item.group), 0);
  }

  const peopleSection = findDreSectionByIncludes(data, [...DRE_PEOPLE_TERMS, "GASTO COM PESSOAL"]);
  return peopleSection ? getDreSectionValue(peopleSection) : 0;
};

const getDreOperationalExpenseValue = (data: DreImportData) => {
  const operationalSection = findDreSectionByIncludes(data, DRE_OPERATIONAL_EXPENSE_TERMS);
  return operationalSection ? getDreSectionValue(operationalSection) : 0;
};

const getDreRevenueSections = (data: DreImportData) => {
  const operationalRevenueSections = data.sections.filter((section) => isDreOperationalRevenueLabel(section.label));

  if (operationalRevenueSections.length > 0) {
    return operationalRevenueSections;
  }

  return data.sections.filter((section) => isDreRevenueLabel(section.label));
};

export const getDreRevenueValue = (data: DreImportData) => {
  const operationalRevenueSummary = findDreSummaryValueByMatcher(data, (label) => {
    const normalized = normalizeDreLabel(label);
    return isDreOperationalRevenueLabel(label) && normalized.includes("TOTAL");
  });

  if (operationalRevenueSummary !== undefined) {
    return operationalRevenueSummary;
  }

  const operationalRevenueSections = data.sections.filter((section) => isDreOperationalRevenueLabel(section.label));
  const operationalRevenueFromSections = operationalRevenueSections.reduce((sum, section) => sum + getDreSectionValue(section), 0);

  if (operationalRevenueFromSections > 0) {
    return operationalRevenueFromSections;
  }

  const netRevenueSummary = findDreSummaryValueByMatcher(data, (label) => normalizeDreLabel(label).includes("RECEITA LIQUIDA"));

  if (netRevenueSummary !== undefined) {
    return netRevenueSummary;
  }

  const genericRevenueSummary = findDreSummaryValueByMatcher(data, (label) => {
    const normalized = normalizeDreLabel(label);
    return normalized.includes("TOTAL") && normalized.includes("RECEITA") && !isDreNonOperationalLabel(label);
  });

  return genericRevenueSummary ?? getDreRevenueSections(data).reduce((sum, section) => sum + getDreSectionValue(section), 0);
};

const getDreExpenseValue = (data: DreImportData) =>
  findDreSummaryValueByMatcher(data, (label) => {
    const normalized = normalizeDreLabel(label);
    return (
      normalized.includes("TOTAL") &&
      (normalized.includes("DESPESAS") || normalized.includes("GASTOS")) &&
      !normalized.includes("OPERACIONAIS") &&
      !normalized.includes("OPERACIONAL")
    );
  }) ??
  (() => {
    const revenueSectionLabels = new Set(getDreRevenueSections(data).map((section) => section.label));
    return data.sections
      .filter((section) => !revenueSectionLabels.has(section.label))
      .reduce((sum, section) => sum + getDreSectionValue(section), 0);
  })();

export const getDreRevenueGroups = (data: DreImportData) =>
  getDreRevenueSections(data)
    .flatMap((section) => {
      const normalizedSection = normalizeDreLabel(section.label);

      return section.groups.flatMap((group) => {
        const normalizedGroup = normalizeDreLabel(group.label);
        const groupValue = getDreGroupValue(group);
        const hasInternalBreakdown = group.lines.some((line) => line.value > 0);
        const groupCandidate = {
          section,
          group,
          label: group.label,
          value: groupValue,
          normalized: normalizedGroup
        };

        if (normalizedGroup !== normalizedSection && groupValue > 0) {
          return [groupCandidate];
        }

        if (hasInternalBreakdown) {
          return group.lines.map((line) => ({
            section,
            group,
            label: line.label,
            value: line.value,
            normalized: normalizeDreLabel(line.label)
          }));
        }

        return [];
      });
    })
    .filter(
      (item) =>
        !item.normalized.includes("TOTAL") &&
        !item.normalized.includes("DIFERENCA DE CAIXA") &&
        !item.normalized.includes("INFORMADO PELOS CAIXAS") &&
        !item.normalized.includes("COMPUTADO NO MOMENTO")
    )
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);

const getDreRevenueLineGroups = (data: DreImportData) =>
  getDreRevenueSections(data)
    .flatMap((section) =>
      section.groups.flatMap((group) =>
        group.lines.map((line) => ({
          section,
          group,
          label: line.label,
          value: line.value,
          normalized: normalizeDreLabel(line.label)
        }))
      )
    )
    .filter((item) => !item.normalized.includes("TOTAL") && !item.normalized.includes("DIFERENCA DE CAIXA"))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);

const findDrePrimaryRevenueGroup = (data: DreImportData) =>
  getDreRevenueGroups(data)[0] ?? getDreRevenueLineGroups(data)[0];

const findDreRevenueLeader = (data: DreImportData) => {
  const primaryGroup = findDrePrimaryRevenueGroup(data);

  if (primaryGroup) {
    return {
      label: primaryGroup.label,
      value: primaryGroup.value
    };
  }

  return undefined;
};

const findDreCardFeesGroup = (data: DreImportData) => {
  const revenueSectionLabels = new Set(getDreRevenueSections(data).map((section) => section.label));
  const groups = data.sections
    .filter((section) => !revenueSectionLabels.has(section.label))
    .flatMap((section) =>
      section.groups.map((group) => ({
        section,
        group,
        normalized: normalizeDreLabel(group.label)
      }))
    );

  return (
    groups.find(
      (item) =>
        item.normalized.includes("TARIFA") &&
        (item.normalized.includes("CARTAO") || item.normalized.includes("CARTOES") || item.normalized.includes("VALE"))
    ) ??
    groups.find((item) => item.normalized.includes("CARTAO") || item.normalized.includes("CARTOES"))
  );
};

const getDrePeriodShortLabel = (data: DreImportData) => {
  if (data.period?.month && data.period.year) {
    return `${shortMonthLabels[data.period.month - 1]}/${String(data.period.year).slice(-2)}`;
  }

  return data.period?.rawLabel ?? data.sheetName;
};

export const getDrePeriodKey = (data: DreImportData, fallback: string) => {
  if (data.period?.month && data.period.year) {
    return `${data.period.year}-${String(data.period.month).padStart(2, "0")}`;
  }

  return fallback;
};

export const getDrePeriodLabel = (data: DreImportData, fallback: string) => {
  if (data.period?.month && data.period.year) {
    return `${shortMonthLabels[data.period.month - 1]}/${data.period.year}`;
  }

  return data.period?.rawLabel ?? fallback;
};

const getDrePeriodYear = (period?: DrePeriodData) =>
  period?.data.period?.year ?? (period?.key.match(/^(\d{4})-/)?.[1] ? Number(period.key.slice(0, 4)) : undefined);

const getDreTone = (label: string, value: number) => {
  if (isDreRevenueLabel(label)) {
    return "good";
  }

  if (isDreResultLabel(label)) {
    return value >= 0 ? "good" : "bad";
  }

  return "bad";
};

const getDreRatioTone = (value: number, goodMax: number, attentionMax: number) => {
  if (!Number.isFinite(value)) {
    return "mid";
  }

  if (value <= goodMax) {
    return "good";
  }

  if (value <= attentionMax) {
    return "mid";
  }

  return "bad";
};

const buildConsolidatedDreData = (periods: DrePeriodData[]): DreImportData | undefined => {
  if (periods.length === 0) {
    return undefined;
  }

  const summaryMap = new Map<string, DreImportData["summary"][number]>();
  const sectionMap = new Map<
    string,
    {
      label: string;
      totalValue: number;
      rowNumber: number;
      groups: Map<
        string,
        {
          label: string;
          totalValue: number;
          rowNumber: number;
          lines: Map<string, DreImportData["sections"][number]["groups"][number]["lines"][number]>;
        }
      >;
    }
  >();

  periods.forEach((period) => {
    period.data.summary.forEach((line) => {
      const summaryKey = normalizeDreLabel(line.label);
      const current = summaryMap.get(summaryKey);
      summaryMap.set(summaryKey, {
        label: current?.label ?? line.label,
        value: (current?.value ?? 0) + line.value,
        rowNumber: current?.rowNumber ?? line.rowNumber
      });
    });

    period.data.sections.forEach((section) => {
      const sectionKey = normalizeDreLabel(section.label);
      const sectionEntry =
        sectionMap.get(sectionKey) ??
        {
          label: section.label,
          totalValue: 0,
          rowNumber: section.total?.rowNumber ?? 0,
          groups: new Map()
        };

      sectionEntry.totalValue += getDreSectionValue(section);

      section.groups.forEach((group) => {
        const groupKey = normalizeDreLabel(group.label);
        const groupEntry =
          sectionEntry.groups.get(groupKey) ??
          {
            label: group.label,
            totalValue: 0,
            rowNumber: group.total?.rowNumber ?? 0,
            lines: new Map()
          };

        groupEntry.totalValue += getDreGroupValue(group);

        group.lines.forEach((line) => {
          const lineKey = normalizeDreLabel(line.label);
          const currentLine = groupEntry.lines.get(lineKey);
          groupEntry.lines.set(lineKey, {
            label: currentLine?.label ?? line.label,
            value: (currentLine?.value ?? 0) + line.value,
            rowNumber: currentLine?.rowNumber ?? line.rowNumber
          });
        });

        sectionEntry.groups.set(groupKey, groupEntry);
      });

      sectionMap.set(sectionKey, sectionEntry);
    });
  });

  return {
    sheetName: "Total",
    restaurantName: periods[0].data.restaurantName,
    reportTitle: periods[0].data.reportTitle,
    analysisTitle: "Análise total",
    period: {
      rawLabel: "Total"
    },
    summary: [...summaryMap.values()],
    sections: [...sectionMap.values()].map((section) => ({
      label: section.label,
      total: {
        label: section.label,
        value: section.totalValue,
        rowNumber: section.rowNumber
      },
      groups: [...section.groups.values()].map((group) => ({
        label: group.label,
        total: {
          label: group.label,
          value: group.totalValue,
          rowNumber: group.rowNumber
        },
        lines: [...group.lines.values()]
      }))
    }))
  };
};

type DreTrendPoint = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  operationalResult: number;
};

const buildDreTrendPoints = (periods: DrePeriodData[]): DreTrendPoint[] =>
  [...periods]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((period) => ({
      key: period.key,
      label: getDrePeriodShortLabel(period.data),
      revenue: getDreRevenueValue(period.data),
      expenses: getDreExpenseValue(period.data),
      operationalResult: getDreOperationalResultValue(period.data) ?? getDreFinalBalanceValue(period.data) ?? 0
    }));

const getDreMarginTone = (value: number) => {
  if (!Number.isFinite(value)) {
    return "mid";
  }

  if (value >= 10) {
    return "good";
  }

  if (value >= 3) {
    return "mid";
  }

  return "bad";
};

function DreResultMap({ data, copy }: { data: DreImportData; copy: DrePanelCopy }) {
  const revenue = getDreRevenueValue(data);
  const expenses = getDreExpenseValue(data);
  const finalBalance = getDreFinalBalanceValue(data) ?? revenue - expenses;
  const maxValue = Math.max(Math.abs(revenue), Math.abs(expenses), Math.abs(finalBalance), 1);
  const cards = [
    { key: "revenue", label: copy.dreRevenue, value: revenue, tone: "good" },
    { key: "outflows", label: copy.dreOutflows, value: expenses, tone: "bad" },
    { key: "balance", label: copy.dreFinalBalance, value: finalBalance, tone: finalBalance >= 0 ? "good" : "bad" }
  ];

  return (
    <section className="dre-chart-card dre-result-map">
      <div className="section-head">
        <div>
          <h3>{copy.dreResultMap}</h3>
          <p>{copy.dreResultMapText}</p>
        </div>
      </div>
      <div className="dre-result-bars">
        {cards.map((card) => (
          <article key={card.key} className={`dre-result-bar-card ${card.tone}`}>
            <div>
              <span className="eyebrow">{card.label}</span>
              <strong>{formatCurrency(card.value)}</strong>
            </div>
            <div className="dre-result-track">
              <span style={{ width: `${Math.max(7, (Math.abs(card.value) / maxValue) * 100)}%` }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DreSectionChart({ data, copy }: { data: DreImportData; copy: DrePanelCopy }) {
  const sections = data.sections
    .map((section, index) => ({
      label: section.label,
      value: getDreSectionValue(section),
      color: drePalette[index % drePalette.length],
      tone: getDreTone(section.label, getDreSectionValue(section))
    }))
    .filter((section) => section.value > 0)
    .sort((left, right) => right.value - left.value);
  const maxValue = Math.max(...sections.map((section) => section.value), 1);

  if (sections.length === 0) {
    return null;
  }

  return (
    <section className="dre-chart-card">
      <div className="section-head">
        <div>
          <h3>{copy.dreSectionChart}</h3>
          <p>{copy.dreSectionChartText}</p>
        </div>
      </div>
      <div className="dre-section-bars">
        {sections.map((section) => (
          <article key={section.label} className="dre-section-bar-row">
            <div className="dre-section-bar-label">
              <span>{section.label}</span>
              <strong>{formatCurrency(section.value)}</strong>
            </div>
            <div className="dre-section-bar-track">
              <span
                className={`dre-section-bar-fill ${section.tone}`}
                style={
                  {
                    width: `${Math.max(5, (section.value / maxValue) * 100)}%`,
                    "--dre-color": section.color
                  } as CSSProperties
                }
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DreMiniDonut({
  title,
  items,
  total,
  index,
  copy
}: {
  title: string;
  items: Array<{ label: string; value: number; color: string }>;
  total: number;
  index: number;
  copy: DrePanelCopy;
}) {
  const [clickedSlice, setClickedSlice] = useState<string>();
  const isDense = items.length > 6;
  const isVeryDense = items.length > 10;
  const size = isVeryDense ? 300 : isDense ? 244 : 176;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = isVeryDense ? 142 : isDense ? 114 : 80;
  const innerRadius = isVeryDense ? 78 : isDense ? 66 : 46;
  let cursor = 0;

  return (
    <article className={`dre-donut-card ${isDense ? "dense" : ""} ${isVeryDense ? "very-dense" : ""}`}>
      <div className="dre-donut-shell">
        <svg viewBox={`0 0 ${size} ${size}`} className="dre-mini-donut" role="img" aria-label={title}>
          {items.map((item) => {
            const share = total > 0 ? item.value / total : 0;
            const start = cursor * 360;
            const end = (cursor + share) * 360;
            cursor += share;

            return (
              <path
                key={item.label}
                d={buildArcPath(cx, cy, outerRadius, innerRadius, start, end)}
                fill={item.color}
                className={clickedSlice === item.label ? "clicked" : ""}
                onClick={() => {
                  setClickedSlice(item.label);
                  window.setTimeout(() => {
                    setClickedSlice((current) => (current === item.label ? undefined : current));
                  }, 340);
                }}
              >
                <title>{`${item.label}: ${formatCurrency(item.value)}`}</title>
              </path>
            );
          })}
          <circle cx={cx} cy={cy} r={innerRadius - 5} fill="var(--donut-hole)" />
          <text x={cx} y={cy - 2} textAnchor="middle" className="dre-donut-center-value">
            {formatCompactCurrency(total)}
          </text>
          <text x={cx} y={cy + 18} textAnchor="middle" className="dre-donut-center-label">
            {copy.total}
          </text>
        </svg>
      </div>
      <div className="dre-donut-copy">
        <span className="eyebrow">#{index + 1}</span>
        <strong>{title}</strong>
        <p>{formatCurrency(total)}</p>
      </div>
      <div className="dre-donut-legend">
        {items.map((item) => (
          <div key={item.label} className="dre-donut-legend-row">
            <span className="dre-donut-swatch" style={{ backgroundColor: item.color }} />
            <span className="dre-donut-legend-name">{item.label}</span>
            <strong>{formatPercent(total > 0 ? (item.value / total) * 100 : 0)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function DreParticipationGrid({ data, copy }: { data: DreImportData; copy: DrePanelCopy }) {
  const sectionCharts = data.sections
    .map((section, sectionIndex) => {
      const items = section.groups
        .map((group, groupIndex) => ({
          label: group.label,
          value: getDreGroupValue(group),
          color: drePalette[(sectionIndex + groupIndex) % drePalette.length]
        }))
        .filter((item) => item.value > 0)
        .sort((left, right) => right.value - left.value);

      return {
        title: section.label,
        items,
        total: items.reduce((sum, item) => sum + item.value, 0)
      };
    })
    .filter((section) => section.items.length > 1 && section.total > 0);

  if (sectionCharts.length === 0) {
    return null;
  }

  return (
    <section className="dre-chart-card dre-participation-panel">
      <div className="section-head">
        <div>
          <h3>{copy.dreParticipationTitle}</h3>
          <p>{copy.dreParticipationText}</p>
        </div>
      </div>
      <div className={`dre-donut-grid ${sectionCharts.length % 2 === 1 ? "odd" : ""}`}>
        {sectionCharts.map((section, index) => (
          <DreMiniDonut
            key={section.title}
            title={section.title}
            items={section.items}
            total={section.total}
            index={index}
            copy={copy}
          />
        ))}
      </div>
    </section>
  );
}

function DreStrategicInsights({ data, copy }: { data: DreImportData; copy: DrePanelCopy }) {
  const revenue = getDreRevenueValue(data);
  const expenses = getDreExpenseValue(data);
  const finalBalance = getDreFinalBalanceValue(data) ?? revenue - expenses;
  const revenueLeader = findDreRevenueLeader(data);
  const revenueSectionLabels = new Set(getDreRevenueSections(data).map((section) => section.label));
  const expenseGroups = data.sections
    .filter((section) => !revenueSectionLabels.has(section.label))
    .flatMap((section) =>
      section.groups.map((group) => ({
        label: group.label,
        section: section.label,
        value: getDreGroupValue(group)
      }))
    )
    .filter((group) => group.value > 0)
    .sort((left, right) => right.value - left.value);
  const expenseLeader = expenseGroups[0];
  const insights = [
    {
      label: copy.dreRevenueConcentration,
      title: revenueLeader?.label ?? copy.dreNoData,
      value: revenueLeader ? formatPercent(revenue > 0 ? (revenueLeader.value / revenue) * 100 : 0) : "-",
      detail: revenueLeader ? formatCurrency(revenueLeader.value) : "Reimporte o DRE para atualizar a abertura de receitas.",
      tone: "good"
    },
    {
      label: copy.dreLargestExpense,
      title: expenseLeader?.label ?? "-",
      value: expenseLeader ? formatPercent(expenses > 0 ? (expenseLeader.value / expenses) * 100 : 0) : "-",
      detail: expenseLeader ? `${expenseLeader.section} · ${formatCurrency(expenseLeader.value)}` : "-",
      tone: "bad"
    },
    {
      label: copy.dreFinalMargin,
      title: formatCurrency(finalBalance),
      value: formatPercent(revenue > 0 ? (finalBalance / revenue) * 100 : 0),
      detail: copy.dreFinalBalance,
      tone: finalBalance >= 0 ? "good" : "bad"
    },
    {
      label: copy.dreExpenseRatio,
      title: formatCurrency(expenses),
      value: formatPercent(revenue > 0 ? (expenses / revenue) * 100 : 0),
      detail: `${copy.dreOutflows} / ${copy.dreRevenue}`,
      tone: "mid"
    }
  ];

  return (
    <section className="dre-chart-card dre-strategy-panel">
      <div className="section-head">
        <div>
          <h3>{copy.dreStrategicTitle}</h3>
          <p>{copy.dreStrategicText}</p>
        </div>
      </div>
      <div className="dre-strategy-grid">
        {insights.map((insight) => (
          <article key={insight.label} className={`dre-strategy-card ${insight.tone}`}>
            <span className="eyebrow">{insight.label}</span>
            <strong>{insight.title}</strong>
            <div>
              <b>{insight.value}</b>
              <small>{insight.detail}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DreValidationPanel({ data }: { data: DreImportData }) {
  const revenue = getDreRevenueValue(data);
  const expenses = getDreExpenseValue(data);
  const inputsValue = getDreInputsValue(data);
  const peopleValue = getDrePeopleValue(data);
  const operationalExpenseValue = getDreOperationalExpenseValue(data);
  const finalBalance = getDreFinalBalanceValue(data);
  const operationalResult = getDreOperationalResultValue(data);
  const inputsRatio = revenue > 0 ? (inputsValue / revenue) * 100 : 0;
  const peopleRatio = revenue > 0 ? (peopleValue / revenue) * 100 : 0;
  const expenseRatio = revenue > 0 ? (expenses / revenue) * 100 : 0;
  const checks = [
    {
      label: "Receita operacional",
      value: revenue > 0 ? formatCurrency(revenue) : "Não identificada",
      status: revenue > 0 ? "good" : "bad",
      detail: revenue > 0 ? "Base de cálculo encontrada." : "Sem receita-base confiável para percentuais."
    },
    {
      label: "Insumos / CMV",
      value: inputsValue > 0 ? formatCurrency(inputsValue) : "Não identificado",
      status: inputsValue <= 0 ? "bad" : inputsRatio > 45 ? "mid" : "good",
      detail: inputsValue > 0 ? `${formatPercent(inputsRatio)} sobre receita` : "Revise se o DRE usa outro nome para CMV/insumos."
    },
    {
      label: "Pessoal / CMO",
      value: peopleValue > 0 ? formatCurrency(peopleValue) : "Não identificado",
      status: peopleValue <= 0 ? "bad" : peopleRatio > 35 ? "mid" : "good",
      detail: peopleValue > 0 ? `${formatPercent(peopleRatio)} sobre receita` : "Revise se o DRE usa outra sigla para pessoal."
    },
    {
      label: "Despesas operacionais",
      value: operationalExpenseValue > 0 ? formatCurrency(operationalExpenseValue) : "Não identificada",
      status: operationalExpenseValue > 0 ? "good" : "mid",
      detail: operationalExpenseValue > 0 ? "Bloco operacional localizado." : "Estrutura operacional não localizada por nome."
    },
    {
      label: "Resultado operacional",
      value: operationalResult !== undefined ? formatCurrency(operationalResult) : "Não identificado",
      status: operationalResult !== undefined ? "good" : "mid",
      detail: "Usado para margem operacional e gráficos de evolução."
    },
    {
      label: "Saldo final",
      value: finalBalance !== undefined ? formatCurrency(finalBalance) : "Não identificado",
      status: finalBalance !== undefined ? "good" : "mid",
      detail: "Usado para margem final."
    }
  ];
  const alerts = [
    revenue <= 0 ? "Receita operacional/base não identificada; percentuais podem ficar inválidos." : undefined,
    inputsValue <= 0 ? "Insumos/CMV não identificados no DRE." : undefined,
    peopleValue <= 0 ? "Pessoal/CMO não identificado no DRE." : undefined,
    inputsRatio > 45 ? `Insumos altos: ${formatPercent(inputsRatio)} sobre receita.` : undefined,
    peopleRatio > 35 ? `Pessoal alto: ${formatPercent(peopleRatio)} sobre receita.` : undefined,
    expenseRatio > 100 ? `Saídas maiores que a receita: ${formatPercent(expenseRatio)}.` : undefined
  ].filter((item): item is string => Boolean(item));

  return (
    <section className="dre-chart-card dre-validation-panel">
      <div className="section-head">
        <div>
          <h3>Validação da DRE</h3>
          <p>Conferência dos principais blocos antes da leitura dos indicadores.</p>
        </div>
      </div>

      <div className="dre-validation-grid">
        {checks.map((check) => (
          <article key={check.label} className={`dre-validation-card ${check.status}`}>
            <span className="eyebrow">{check.label}</span>
            <strong>{check.value}</strong>
            <p>{check.detail}</p>
          </article>
        ))}
      </div>

      {alerts.length > 0 ? (
        <div className="dre-validation-alerts">
          <span className="eyebrow">Alertas de inconsistência</span>
          {alerts.map((alert) => (
            <p key={alert}>{alert}</p>
          ))}
        </div>
      ) : (
        <p className="message auth-status-message">DRE validada sem inconsistências críticas nos blocos principais.</p>
      )}
    </section>
  );
}

function DreRestaurantDiagnostics({ data, copy }: { data: DreImportData; copy: DrePanelCopy }) {
  const revenue = getDreRevenueValue(data);
  const finalBalance = getDreFinalBalanceValue(data) ?? revenue - getDreExpenseValue(data);
  const operationalResult = getDreOperationalResultValue(data) ?? finalBalance;
  const inputsValue = getDreInputsValue(data);
  const peopleValue = getDrePeopleValue(data);
  const operationalExpenseValue = getDreOperationalExpenseValue(data);
  const structureValue = operationalExpenseValue > 0 ? Math.max(0, operationalExpenseValue - peopleValue) : 0;
  const finalMargin = revenue > 0 ? (finalBalance / revenue) * 100 : 0;
  const operationalMargin = revenue > 0 ? (operationalResult / revenue) * 100 : 0;
  const inputsRatio = revenue > 0 ? (inputsValue / revenue) * 100 : 0;
  const peopleRatio = revenue > 0 ? (peopleValue / revenue) * 100 : 0;
  const structureRatio = revenue > 0 ? (structureValue / revenue) * 100 : 0;
  const revenueSectionLabels = new Set(getDreRevenueSections(data).map((section) => section.label));
  const expenseGroups = data.sections
    .filter((section) => !revenueSectionLabels.has(section.label))
    .flatMap((section) =>
      section.groups.map((group) => ({
        section: section.label,
        label: group.label,
        value: getDreGroupValue(group)
      }))
    )
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
  const diagnosisCards = [
    {
      label: copy.dreFinalMarginCard,
      value: formatPercent(finalMargin),
      detail: formatCurrency(finalBalance),
      tone: getDreMarginTone(finalMargin)
    },
    {
      label: copy.dreOperationalMarginCard,
      value: formatPercent(operationalMargin),
      detail: formatCurrency(operationalResult),
      tone: getDreMarginTone(operationalMargin)
    },
    {
      label: copy.dreInputsOnRevenue,
      value: formatPercent(inputsRatio),
      detail: inputsValue > 0 ? formatCurrency(inputsValue) : copy.dreNoData,
      tone: getDreRatioTone(inputsRatio, 28, 35)
    },
    {
      label: copy.drePeopleOnRevenue,
      value: formatPercent(peopleRatio),
      detail: peopleValue > 0 ? formatCurrency(peopleValue) : copy.dreNoData,
      tone: getDreRatioTone(peopleRatio, 22, 30)
    },
    {
      label: copy.dreStructureOnRevenue,
      value: formatPercent(structureRatio),
      detail: operationalExpenseValue > 0 ? formatCurrency(structureValue) : copy.dreNoData,
      tone: getDreRatioTone(structureRatio, 18, 25)
    }
  ];
  const toneLabel = (tone: string) => {
    if (tone === "good") {
      return copy.dreHealthy;
    }

    if (tone === "bad") {
      return copy.dreCritical;
    }

    return copy.dreAttention;
  };

  return (
    <section className="dre-chart-card dre-diagnostics-panel">
      <div className="section-head">
        <div>
          <h3>{copy.dreRestaurantDiagnostics}</h3>
          <p>{copy.dreRestaurantDiagnosticsText}</p>
        </div>
      </div>

      <div className="dre-diagnostics-layout">
        <div className="dre-diagnostics-grid">
          {diagnosisCards.map((card) => (
            <article key={card.label} className={`dre-diagnostic-card ${card.tone}`}>
              <span className="eyebrow">{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
              <small>{toneLabel(card.tone)}</small>
            </article>
          ))}
        </div>
        <article className="dre-diagnostic-card attention-list bad">
          <span className="eyebrow">{copy.dreAttentionPoints}</span>
          <div className="dre-attention-list">
            {expenseGroups.map((item) => (
              <div key={`${item.section}-${item.label}`} className="dre-attention-row">
                <span>{item.label}</span>
                <strong>{formatCurrency(item.value)}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function DreHorizontalBreakdown({
  title,
  text,
  lines,
  useImportedPercent = false
}: {
  title: string;
  text: string;
  lines: DreImportData["sections"][number]["groups"][number]["lines"];
  useImportedPercent?: boolean;
}) {
  const total = lines.reduce((sum, line) => sum + line.value, 0);
  const visibleLines = lines
    .filter((line) => line.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 10);
  const maxValue = Math.max(...visibleLines.map((line) => line.value), 1);

  if (visibleLines.length === 0) {
    return null;
  }

  return (
    <section className="dre-chart-card dre-breakdown-card">
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
        <strong>{formatCurrency(total)}</strong>
      </div>
      <div className="dre-breakdown-list">
        {visibleLines.map((line, index) => (
          <article key={`${line.label}-${line.rowNumber}`} className="dre-breakdown-row">
            <div className="dre-breakdown-label">
              <span>{line.label}</span>
              <strong>{formatCurrency(line.value)}</strong>
            </div>
            <div className="dre-section-bar-track">
              <span
                className="dre-section-bar-fill"
                style={
                  {
                    width: `${Math.max(4, (line.value / maxValue) * 100)}%`,
                    "--dre-color": drePalette[index % drePalette.length]
                  } as CSSProperties
                }
              />
            </div>
            <small>
              {formatPercent(
                useImportedPercent && line.percent !== undefined ? line.percent : total > 0 ? (line.value / total) * 100 : 0
              )}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

function DreOperationalBreakdowns({ data, copy }: { data: DreImportData; copy: DrePanelCopy }) {
  const menuGroup = findDreGroupByIncludes(data, ["CARDAPIO"]) ?? findDrePrimaryRevenueGroup(data);
  const cardFeesGroup = findDreCardFeesGroup(data);
  const isMenuRevenue = menuGroup ? normalizeDreLabel(menuGroup.group.label).includes("CARDAPIO") : false;
  const visibleCards = Number(Boolean(menuGroup)) + Number(Boolean(cardFeesGroup));

  if (!menuGroup && !cardFeesGroup) {
    return null;
  }

  return (
    <section className={`dre-operational-grid ${visibleCards === 1 ? "single" : ""}`}>
      {menuGroup ? (
        <DreHorizontalBreakdown
          title={isMenuRevenue ? copy.dreMenuMixTitle : copy.dreRevenueMixTitle}
          text={isMenuRevenue ? copy.dreMenuMixText : copy.dreRevenueMixText}
          lines={menuGroup.group.lines}
        />
      ) : null}
      {cardFeesGroup ? (
        <DreHorizontalBreakdown
          title={copy.dreCardFeesTitle}
          text={copy.dreCardFeesText}
          lines={cardFeesGroup.group.lines}
          useImportedPercent
        />
      ) : null}
    </section>
  );
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function DreRevenueExpenseTrend({ data, copy, trendPoints }: { data: DreImportData; copy: DrePanelCopy; trendPoints?: DreTrendPoint[] }) {
  const revenue = getDreRevenueValue(data);
  const expenses = getDreExpenseValue(data);
  const height = 220;
  const width = 680;
  const padding = 28;
  const activeTrend = trendPoints && trendPoints.length > 1 ? trendPoints : undefined;

  if (activeTrend) {
    const maxValue = Math.max(...activeTrend.flatMap((point) => [point.revenue, point.expenses]), 1);
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const getX = (index: number) => padding + (activeTrend.length === 1 ? plotWidth / 2 : (index / (activeTrend.length - 1)) * plotWidth);
    const getY = (value: number) => padding + (1 - value / maxValue) * plotHeight;
    const revenuePoints = activeTrend.map((point, index) => ({ x: getX(index), y: getY(point.revenue) }));
    const expensePoints = activeTrend.map((point, index) => ({ x: getX(index), y: getY(point.expenses) }));
    const labelStep = Math.max(1, Math.ceil(activeTrend.length / 6));

    return (
      <section className="dre-chart-card dre-line-chart-card">
        <div className="section-head">
          <div>
            <h3>{copy.dreRevenueVsExpenses}</h3>
            <p>{copy.dreRevenueVsExpensesText}</p>
          </div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="dre-line-chart" role="img" aria-label={copy.dreRevenueVsExpenses}>
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
          <path d={buildLinePath(revenuePoints)} className="dre-line revenue" />
          <path d={buildLinePath(expensePoints)} className="dre-line expense" />
          {activeTrend.map((point, index) => (
            <g key={`revenue-expense-${point.key}`}>
              <circle cx={getX(index)} cy={getY(point.revenue)} r="5" className="dre-point revenue" />
              <circle cx={getX(index)} cy={getY(point.expenses)} r="5" className="dre-point expense" />
              {index % labelStep === 0 || index === activeTrend.length - 1 ? (
                <text x={getX(index)} y={height - 6} textAnchor="middle">
                  {point.label}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
        <div className="dre-chart-legend-inline">
          <span className="revenue">
            {copy.dreRevenue}: {formatCurrency(revenue)}
          </span>
          <span className="expense">
            {copy.dreOutflows}: {formatCurrency(expenses)}
          </span>
        </div>
      </section>
    );
  }

  const maxValue = Math.max(revenue, expenses, 1);
  const x = width / 2;
  const revenueY = padding + (1 - revenue / maxValue) * (height - padding * 2);
  const expensesY = padding + (1 - expenses / maxValue) * (height - padding * 2);

  return (
    <section className="dre-chart-card dre-line-chart-card">
      <div className="section-head">
        <div>
          <h3>{copy.dreRevenueVsExpenses}</h3>
          <p>{copy.dreRevenueVsExpensesText}</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="dre-line-chart" role="img" aria-label={copy.dreRevenueVsExpenses}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
        <path
          d={`M ${padding} ${revenueY + 18} Q ${x} ${revenueY - 28} ${width - padding} ${revenueY + 8}`}
          className="dre-line revenue"
        />
        <path
          d={`M ${padding} ${expensesY + 18} Q ${x} ${expensesY - 20} ${width - padding} ${expensesY + 8}`}
          className="dre-line expense"
        />
        <circle cx={x} cy={revenueY} r="7" className="dre-point revenue" />
        <circle cx={x} cy={expensesY} r="7" className="dre-point expense" />
        <text x={x} y={height - 6} textAnchor="middle">
          {getDrePeriodShortLabel(data)}
        </text>
      </svg>
      <div className="dre-chart-legend-inline">
        <span className="revenue">
          {copy.dreRevenue}: {formatCurrency(revenue)}
        </span>
        <span className="expense">
          {copy.dreOutflows}: {formatCurrency(expenses)}
        </span>
      </div>
    </section>
  );
}

function DreOperationalResultBars({ data, copy, trendPoints }: { data: DreImportData; copy: DrePanelCopy; trendPoints?: DreTrendPoint[] }) {
  const operationalResult = getDreOperationalResultValue(data) ?? getDreFinalBalanceValue(data) ?? 0;
  const height = 220;
  const width = 680;
  const padding = 28;
  const activeTrend = trendPoints && trendPoints.length > 1 ? trendPoints : undefined;

  if (activeTrend) {
    const maxValue = Math.max(...activeTrend.map((point) => Math.abs(point.operationalResult)), 1);
    const hasNegative = activeTrend.some((point) => point.operationalResult < 0);
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const baseline = hasNegative ? padding + plotHeight / 2 : height - padding;
    const scale = hasNegative ? (plotHeight / 2) / maxValue : plotHeight / maxValue;
    const slotWidth = plotWidth / activeTrend.length;
    const barWidth = Math.max(16, Math.min(46, slotWidth * 0.58));
    const labelStep = Math.max(1, Math.ceil(activeTrend.length / 6));

    return (
      <section className="dre-chart-card dre-line-chart-card">
        <div className="section-head">
          <div>
            <h3>{copy.dreOperationalResultChart}</h3>
            <p>{copy.dreOperationalResultChartText}</p>
          </div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="dre-bar-chart" role="img" aria-label={copy.dreOperationalResultChart}>
          <line x1={padding} y1={baseline} x2={width - padding} y2={baseline} />
          {activeTrend.map((point, index) => {
            const x = padding + slotWidth * index + slotWidth / 2;
            const barHeight = Math.max(4, Math.abs(point.operationalResult) * scale);
            const barY = point.operationalResult >= 0 ? baseline - barHeight : baseline;
            const belowBarLabelY = barY + barHeight + 16;
            const negativeLabelFitsBelow = belowBarLabelY <= height - 34;
            const valueLabelY =
              point.operationalResult >= 0 || !negativeLabelFitsBelow
                ? Math.max(16, barY - 8)
                : belowBarLabelY;

            return (
              <g key={`operational-result-${point.key}`}>
                <rect
                  x={x - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  rx="7"
                  className={point.operationalResult >= 0 ? "positive" : "negative"}
                />
                <text
                  x={x}
                  y={valueLabelY}
                  textAnchor="middle"
                  className={`dre-bar-value-label ${point.operationalResult >= 0 ? "positive" : "negative"} ${
                    point.operationalResult < 0 && !negativeLabelFitsBelow ? "above-negative" : ""
                  }`}
                >
                  {formatCompactCurrency(point.operationalResult)}
                </text>
                {index % labelStep === 0 || index === activeTrend.length - 1 ? (
                  <text x={x} y={height - 6} textAnchor="middle">
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <div className="dre-chart-legend-inline">
          <span>{formatCurrency(operationalResult)}</span>
        </div>
      </section>
    );
  }

  const maxValue = Math.max(Math.abs(operationalResult), 1);
  const barHeight = Math.max(16, (Math.abs(operationalResult) / maxValue) * (height - padding * 2));
  const baseline = height - padding;
  const barY = operationalResult >= 0 ? baseline - barHeight : baseline;

  return (
    <section className="dre-chart-card dre-line-chart-card">
      <div className="section-head">
        <div>
          <h3>{copy.dreOperationalResultChart}</h3>
          <p>{copy.dreOperationalResultChartText}</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="dre-bar-chart" role="img" aria-label={copy.dreOperationalResultChart}>
        <line x1={padding} y1={baseline} x2={width - padding} y2={baseline} />
        <rect
          x={width / 2 - 34}
          y={barY}
          width="68"
          height={barHeight}
          rx="8"
          className={operationalResult >= 0 ? "positive" : "negative"}
        />
        <text x={width / 2} y={height - 6} textAnchor="middle">
          {getDrePeriodShortLabel(data)}
        </text>
      </svg>
      <div className="dre-chart-legend-inline">
        <span>{formatCurrency(operationalResult)}</span>
      </div>
    </section>
  );
}

function DreFinancialCharts({ data, copy, trendPoints }: { data: DreImportData; copy: DrePanelCopy; trendPoints?: DreTrendPoint[] }) {
  return (
    <section className="dre-financial-chart-grid">
      <DreRevenueExpenseTrend data={data} copy={copy} trendPoints={trendPoints} />
      <DreOperationalResultBars data={data} copy={copy} trendPoints={trendPoints} />
    </section>
  );
}

export function DreAnalysisPanel({
  data,
  periods,
  selectedPeriod,
  error,
  processing,
  canManageData,
  copy,
  onImport,
  onSelectPeriod,
  onRemovePeriod
}: DreAnalysisPanelProps) {
  const sortedPeriods = useMemo(() => [...periods].sort((left, right) => left.key.localeCompare(right.key)), [periods]);
  const selectedPeriodKeys = useMemo(
    () =>
      selectedPeriod
        .split(DRE_SELECTION_SEPARATOR)
        .map((item) => item.trim())
        .filter((key) => sortedPeriods.some((period) => period.key === key)),
    [selectedPeriod, sortedPeriods]
  );
  const fallbackPeriod = sortedPeriods[sortedPeriods.length - 1];
  const effectiveSelectedKeys = useMemo(
    () => (selectedPeriodKeys.length > 0 ? selectedPeriodKeys : fallbackPeriod ? [fallbackPeriod.key] : []),
    [fallbackPeriod, selectedPeriodKeys]
  );
  const selectedPeriods = useMemo(
    () => sortedPeriods.filter((period) => effectiveSelectedKeys.includes(period.key)),
    [effectiveSelectedKeys, sortedPeriods]
  );
  const periodYears = useMemo(
    () =>
      [...new Set(sortedPeriods.map((period) => getDrePeriodYear(period)).filter((year): year is number => Boolean(year)))]
        .sort((left, right) => right - left),
    [sortedPeriods]
  );
  const initialYear =
    getDrePeriodYear(selectedPeriods[0] ?? fallbackPeriod) ??
    periodYears[0];
  const [selectedYear, setSelectedYear] = useState<number | undefined>(initialYear);
  const activeYear = selectedYear ?? initialYear;
  const yearPeriods = sortedPeriods.filter((period) => getDrePeriodYear(period) === activeYear);
  const displayData = selectedPeriods.length > 1 ? buildConsolidatedDreData(selectedPeriods) : selectedPeriods[0]?.data ?? data;
  const trendPoints = useMemo(
    () => (selectedPeriods.length > 1 ? buildDreTrendPoints(selectedPeriods) : undefined),
    [selectedPeriods]
  );

  useEffect(() => {
    const nextYear = getDrePeriodYear(selectedPeriods[0] ?? fallbackPeriod) ?? periodYears[0];
    if (nextYear && nextYear !== selectedYear) {
      setSelectedYear(nextYear);
    }
  }, [fallbackPeriod, periodYears, selectedPeriods, selectedYear]);

  const selectYear = (year: number) => {
    setSelectedYear(year);
    const periodsInYear = sortedPeriods.filter((period) => getDrePeriodYear(period) === year);
    const lastPeriodInYear = periodsInYear[periodsInYear.length - 1];
    if (lastPeriodInYear) {
      onSelectPeriod(lastPeriodInYear.key);
    }
  };

  const togglePeriod = (periodKey: string) => {
    const currentYearKeys = yearPeriods.map((period) => period.key);
    const activeKeysInYear = effectiveSelectedKeys.filter((key) => currentYearKeys.includes(key));
    const nextKeys = activeKeysInYear.includes(periodKey)
      ? activeKeysInYear.filter((key) => key !== periodKey)
      : [...activeKeysInYear, periodKey].sort((left, right) => left.localeCompare(right));

    onSelectPeriod((nextKeys.length > 0 ? nextKeys : [periodKey]).join(DRE_SELECTION_SEPARATOR));
  };

  return (
    <section className="card dre-panel">
      <div className="section-head">
        <div>
          <h3>{displayData ? copy.dreParsedTitle : copy.dreEmptyTitle}</h3>
          {!displayData ? <p>{copy.dreEmptyText}</p> : null}
        </div>
      </div>

      {canManageData ? (
        <label className="upload-box dre-upload-box">
          <input
            className="upload-input-hidden"
            type="file"
            accept=".xlsx,.xls"
            disabled={processing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                onImport(file);
              }
            }}
          />
          <div>
            <span className="eyebrow">{copy.dreUploadTitle}</span>
            <strong>{processing ? copy.dreProcessing : copy.dreUploadAction}</strong>
            <small>{copy.dreUploadHint}</small>
          </div>
          <span className="upload-action">{copy.dreUploadAction}</span>
        </label>
      ) : null}

      {error ? <p className="message error">{error}</p> : null}

      {displayData ? (
        <>
          {periods.length > 0 ? (
            <section className="card compact-card period-filter-card">
              <div className="section-head">
                <div>
                  <h3>Período analisado</h3>
                  <p>Escolha o ano e marque um ou mais meses para analisar o DRE no recorte desejado.</p>
                </div>
              </div>

              {periodYears.length > 1 ? (
                <div className="filter-bar dre-year-filter" aria-label="Selecionar ano do DRE">
                  {periodYears.map((year) => (
                    <button
                      key={year}
                      type="button"
                      className={`filter-pill ${activeYear === year ? "active" : ""}`}
                      onClick={() => selectYear(year)}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="filter-bar dre-period-filter" aria-label={copy.dreSelectPeriod}>
                {yearPeriods.map((period) => (
                  <span
                    key={period.key}
                    className={`filter-pill filter-pill-group ${effectiveSelectedKeys.includes(period.key) ? "active" : ""}`}
                  >
                    <button type="button" className="filter-pill-main" onClick={() => togglePeriod(period.key)}>
                      {period.label}
                    </button>
                    {canManageData && onRemovePeriod ? (
                      <button
                        type="button"
                        className="filter-pill-remove"
                        onClick={() => onRemovePeriod(period.key)}
                        aria-label={`Remover ${period.label}`}
                        title={`Excluir ${period.label}`}
                      >
                        <IconTrash />
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <DreValidationPanel data={displayData} />

          <div className="dre-visual-grid">
            <DreResultMap data={displayData} copy={copy} />
            <DreSectionChart data={displayData} copy={copy} />
          </div>

          <DreStrategicInsights data={displayData} copy={copy} />
          <DreRestaurantDiagnostics data={displayData} copy={copy} />
          <DreOperationalBreakdowns data={displayData} copy={copy} />
          <DreFinancialCharts data={displayData} copy={copy} trendPoints={trendPoints} />
          <DreParticipationGrid data={displayData} copy={copy} />
        </>
      ) : null}
    </section>
  );
}
