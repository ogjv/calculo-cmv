/* eslint-disable react-refresh/only-export-components */
import type { CSSProperties } from "react";
import type { DreImportData, DrePeriodData } from "../types";
import { formatCurrency, formatPercent } from "../utils/cmv";

const drePalette = ["#2f6f5e", "#c9823a", "#b84e3f", "#496f9f", "#8b6f47", "#6f7785", "#a55c7a", "#5f7f4f"];
const shortMonthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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

type DreAnalysisPanelProps = {
  data?: DreImportData;
  periods: DrePeriodData[];
  selectedPeriod: string;
  error?: string;
  processing?: boolean;
  canManageData: boolean;
  copy: DrePanelCopy;
  onImport: (file: File) => void;
  onSelectPeriod: (period: string) => void;
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

const normalizeDreLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

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

const isDreOperationalRevenueLabel = (label: string) => {
  const normalized = normalizeDreLabel(label);
  return normalized.includes("RECEITAS OPERACIONAIS") || normalized.includes("RECEITA OPERACIONAL");
};

const isDreRevenueLabel = (label: string) => {
  const normalized = normalizeDreLabel(label);
  return normalized.includes("RECEITA") && !normalized.includes("RECEITA LIQUIDA");
};

const isDreResultLabel = (label: string) => {
  const normalized = normalizeDreLabel(label);
  return normalized.includes("RESULTADO") || normalized.includes("SALDO") || normalized.includes("MARGEM");
};

const findDreSectionByIncludes = (data: DreImportData, terms: string[]) =>
  data.sections.find((section) => {
    const normalized = normalizeDreLabel(section.label);
    return terms.some((term) => normalized.includes(term));
  });

const findDreGroupByIncludes = (data: DreImportData, terms: string[]) => {
  for (const section of data.sections) {
    const group = section.groups.find((item) => {
      const normalized = normalizeDreLabel(item.label);
      return terms.some((term) => normalized.includes(term));
    });

    if (group) {
      return { section, group };
    }
  }

  return undefined;
};

const findDreSummaryValue = (data: DreImportData, label: string) =>
  data.summary.find((item) => normalizeDreLabel(item.label) === normalizeDreLabel(label))?.value;

const getDreRevenueSections = (data: DreImportData) => {
  const operationalRevenueSections = data.sections.filter((section) => isDreOperationalRevenueLabel(section.label));

  if (operationalRevenueSections.length > 0) {
    return operationalRevenueSections;
  }

  return data.sections.filter((section) => isDreRevenueLabel(section.label));
};

export const getDreRevenueValue = (data: DreImportData) =>
  findDreSummaryValue(data, "TOTAL RECEITAS") ??
  findDreSummaryValue(data, "TOTAL RECEITAS OPERACIONAIS") ??
  getDreRevenueSections(data).reduce((sum, section) => sum + getDreSectionValue(section), 0);

const getDreExpenseValue = (data: DreImportData) =>
  findDreSummaryValue(data, "TOTAL DESPESAS") ??
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
  const finalBalance = findDreSummaryValue(data, "SALDO FINAL") ?? revenue - expenses;
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
              <path key={item.label} d={buildArcPath(cx, cy, outerRadius, innerRadius, start, end)} fill={item.color}>
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
  const finalBalance = findDreSummaryValue(data, "SALDO FINAL") ?? revenue - expenses;
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

function DreRestaurantDiagnostics({ data, copy }: { data: DreImportData; copy: DrePanelCopy }) {
  const revenue = getDreRevenueValue(data);
  const finalBalance = findDreSummaryValue(data, "SALDO FINAL") ?? 0;
  const operationalResult = findDreSummaryValue(data, "RESULTADO OPERACIONAL") ?? finalBalance;
  const inputsSection = findDreSectionByIncludes(data, ["INSUMOS"]);
  const operationalSection = findDreSectionByIncludes(data, ["DESPESAS OPERACIONAIS"]);
  const peopleGroup = findDreGroupByIncludes(data, ["PESSOAL", "PERSONAL"]);
  const inputsValue = inputsSection ? getDreSectionValue(inputsSection) : 0;
  const peopleValue = peopleGroup ? getDreGroupValue(peopleGroup.group) : 0;
  const structureValue = operationalSection ? Math.max(0, getDreSectionValue(operationalSection) - peopleValue) : 0;
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
      detail: inputsSection ? formatCurrency(inputsValue) : copy.dreNoData,
      tone: getDreRatioTone(inputsRatio, 28, 35)
    },
    {
      label: copy.drePeopleOnRevenue,
      value: formatPercent(peopleRatio),
      detail: peopleGroup ? formatCurrency(peopleValue) : copy.dreNoData,
      tone: getDreRatioTone(peopleRatio, 22, 30)
    },
    {
      label: copy.dreStructureOnRevenue,
      value: formatPercent(structureRatio),
      detail: operationalSection ? formatCurrency(structureValue) : copy.dreNoData,
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

function DreRevenueExpenseTrend({ data, copy }: { data: DreImportData; copy: DrePanelCopy }) {
  const revenue = getDreRevenueValue(data);
  const expenses = getDreExpenseValue(data);
  const maxValue = Math.max(revenue, expenses, 1);
  const height = 220;
  const width = 680;
  const padding = 28;
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

function DreOperationalResultBars({ data, copy }: { data: DreImportData; copy: DrePanelCopy }) {
  const operationalResult = findDreSummaryValue(data, "RESULTADO OPERACIONAL") ?? findDreSummaryValue(data, "SALDO FINAL") ?? 0;
  const maxValue = Math.max(Math.abs(operationalResult), 1);
  const height = 220;
  const width = 680;
  const padding = 28;
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

function DreFinancialCharts({ data, copy }: { data: DreImportData; copy: DrePanelCopy }) {
  return (
    <section className="dre-financial-chart-grid">
      <DreRevenueExpenseTrend data={data} copy={copy} />
      <DreOperationalResultBars data={data} copy={copy} />
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
  onSelectPeriod
}: DreAnalysisPanelProps) {
  return (
    <section className="card dre-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">{copy.navDre}</span>
          <h3>{data ? copy.dreParsedTitle : copy.dreEmptyTitle}</h3>
          {!data ? <p>{copy.dreEmptyText}</p> : null}
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

      {data ? (
        <>
          <div className="dre-summary-grid">
            <article className="totals-box compact dre-period-summary-card">
              <span className="eyebrow">{copy.drePeriod}</span>
              <strong>{getDrePeriodLabel(data, data.sheetName)}</strong>
              {periods.length > 1 ? (
                <div className="filter-bar dre-period-filter" aria-label={copy.dreSelectPeriod}>
                  {periods.map((period) => (
                    <button
                      key={period.key}
                      type="button"
                      className={`filter-pill ${selectedPeriod === period.key ? "active" : ""}`}
                      onClick={() => onSelectPeriod(period.key)}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          </div>

          <div className="dre-visual-grid">
            <DreResultMap data={data} copy={copy} />
            <DreSectionChart data={data} copy={copy} />
          </div>

          <DreStrategicInsights data={data} copy={copy} />
          <DreRestaurantDiagnostics data={data} copy={copy} />
          <DreOperationalBreakdowns data={data} copy={copy} />
          <DreFinancialCharts data={data} copy={copy} />
          <DreParticipationGrid data={data} copy={copy} />
        </>
      ) : null}
    </section>
  );
}
