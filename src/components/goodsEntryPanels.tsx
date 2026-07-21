import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { GoodsEntryImportData, GoodsEntryRow } from "../types";
import { useLocale } from "../i18n";
import { formatCurrency, formatNumber } from "../utils/cmv";

export type GoodsEntryPanelsProps = {
  data?: GoodsEntryImportData;
  error?: string;
  processing?: boolean;
  canManageData: boolean;
  onImport: (file: File) => void;
  onClear: () => void;
};

type MetricCard = {
  label: string;
  value: string;
  detail: string;
  badge: string;
  badgeTone: "good" | "cool" | "warm";
  icon: JSX.Element;
};

type RankedDatum = {
  label: string;
  value: number;
  share?: number;
};

type TrendPoint = {
  key: string;
  label: string;
  totals: Record<string, number>;
};

type TrendGranularity = "day" | "two-day" | "week";
type CalendarField = "from" | "to";

type CalendarMonth = {
  year: number;
  month: number;
};

const linePalette = ["#1f7a5a", "#d49c54", "#4f7db0", "#b5647b", "#7c62a3"];

const clampPercent = (value: number) => Math.max(8, Math.min(100, value));

const sumBy = <T,>(rows: T[], selector: (row: T) => number) => rows.reduce((sum, row) => sum + selector(row), 0);

const getReferenceDate = (row: GoodsEntryRow) => row.invoiceDate ?? row.competencyDate;
const toDate = (value: string) => new Date(`${value}T12:00:00`);

const diffInDays = (left: string, right: string) =>
  Math.round((toDate(right).getTime() - toDate(left).getTime()) / 86400000);

const addDays = (value: string, days: number) => {
  const date = toDate(value);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatShortDateLabel = (value: string) => {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}`;
};

const toIsoDate = (value?: string) => {
  if (!value) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const match = value.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!match) {
    return undefined;
  }

  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2]}-${match[1]}`;
};

const formatDatePlaceholder = (value: string) => (value ? formatShortDateLabel(value) : "dd/mm/aaaa");

const getMonthKey = ({ year, month }: CalendarMonth) => `${year}-${String(month).padStart(2, "0")}`;

const parseMonthKey = (value: string): CalendarMonth => {
  const [year, month] = value.split("-");
  return {
    year: Number(year),
    month: Number(month)
  };
};

const buildAvailableMonths = (dates: string[]) =>
  [...new Set(dates.map((date) => date.slice(0, 7)))]
    .sort((left, right) => left.localeCompare(right))
    .map(parseMonthKey);

const buildContinuousRange = (startDate?: string, endDate?: string) => {
  const start = toIsoDate(startDate);
  const end = toIsoDate(endDate);

  if (!start || !end || start > end) {
    return [] as string[];
  }

  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
};

const formatMonthLabel = (month: CalendarMonth) =>
  new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(new Date(month.year, month.month - 1, 1));

const buildMonthCells = (month: CalendarMonth) => {
  const firstDay = new Date(month.year, month.month - 1, 1);
  const daysInMonth = new Date(month.year, month.month, 0).getDate();
  const leadingDays = firstDay.getDay();
  const cells: Array<{ date?: string; day?: number }> = [];

  for (let index = 0; index < leadingDays; index += 1) {
    cells.push({});
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      date: `${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({});
  }

  return cells;
};

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="goods-entry-date-icon">
      <path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M8 13h3v3H8z" />
    </svg>
  );
}

function IconRevenueKpi() {
  return (
    <svg viewBox="0 0 32 32" className="kpi-art" aria-hidden="true">
      <path d="M16 3C13.4288 3 10.9154 3.76244 8.77759 5.1909C6.63975 6.61935 4.97351 8.64968 3.98957 11.0251C3.00563 13.4006 2.74819 16.0144 3.2498 18.5362C3.75141 21.0579 4.98953 23.3743 6.80762 25.1924C8.6257 27.0105 10.9421 28.2486 13.4638 28.7502C15.9856 29.2518 18.5995 28.9944 20.9749 28.0104C23.3503 27.0265 25.3807 25.3603 26.8091 23.2224C28.2376 21.0846 29 18.5712 29 16C28.9964 12.5533 27.6256 9.24882 25.1884 6.81163C22.7512 4.37445 19.4467 3.00364 16 3ZM16 27C13.8244 27 11.6977 26.3549 9.88873 25.1462C8.07979 23.9375 6.66989 22.2195 5.83733 20.2095C5.00477 18.1995 4.78693 15.9878 5.21137 13.854C5.63581 11.7202 6.68345 9.7602 8.22183 8.22183C9.76021 6.68345 11.7202 5.6358 13.854 5.21136C15.9878 4.78692 18.1995 5.00476 20.2095 5.83733C22.2195 6.66989 23.9375 8.07979 25.1462 9.88873C26.3549 11.6977 27 13.8244 27 16C26.9967 18.9164 25.8367 21.7123 23.7745 23.7745C21.7123 25.8367 18.9164 26.9967 16 27ZM21 18.5C21 19.4283 20.6313 20.3185 19.9749 20.9749C19.3185 21.6313 18.4283 22 17.5 22H17V23C17 23.2652 16.8946 23.5196 16.7071 23.7071C16.5196 23.8946 16.2652 24 16 24C15.7348 24 15.4804 23.8946 15.2929 23.7071C15.1054 23.5196 15 23.2652 15 23V22H13C12.7348 22 12.4804 21.8946 12.2929 21.7071C12.1054 21.5196 12 21.2652 12 21C12 20.7348 12.1054 20.4804 12.2929 20.2929C12.4804 20.1054 12.7348 20 13 20H17.5C17.8978 20 18.2794 19.842 18.5607 19.5607C18.842 19.2794 19 18.8978 19 18.5C19 18.1022 18.842 17.7206 18.5607 17.4393C18.2794 17.158 17.8978 17 17.5 17H14.5C13.5717 17 12.6815 16.6313 12.0251 15.9749C11.3688 15.3185 11 14.4283 11 13.5C11 12.5717 11.3688 11.6815 12.0251 11.0251C12.6815 10.3687 13.5717 10 14.5 10H15V9C15 8.73478 15.1054 8.48043 15.2929 8.29289C15.4804 8.10536 15.7348 8 16 8C16.2652 8 16.5196 8.10536 16.7071 8.29289C16.8946 8.48043 17 8.73478 17 9V10H19C19.2652 10 19.5196 10.1054 19.7071 10.2929C19.8946 10.4804 20 10.7348 20 11C20 11.2652 19.8946 11.5196 19.7071 11.7071C19.5196 11.8946 19.2652 12 19 12H14.5C14.1022 12 13.7206 12.158 13.4393 12.4393C13.158 12.7206 13 13.1022 13 13.5C13 13.8978 13.158 14.2794 13.4393 14.5607C13.7206 14.842 14.1022 15 14.5 15H17.5C18.4283 15 19.3185 15.3687 19.9749 16.0251C20.6313 16.6815 21 17.5717 21 18.5Z" fill="#292929" />
    </svg>
  );
}

function IconSuppliersKpi() {
  return (
    <svg viewBox="0 0 24 24" className="kpi-art" aria-hidden="true">
      <path d="M5.18404 20.564L5.63803 19.673H5.63803L5.18404 20.564ZM3.43597 18.816L2.54497 19.27L3.43597 18.816ZM20.564 18.816L19.673 18.362V18.362L20.564 18.816ZM18.816 20.564L19.27 21.455V21.455L18.816 20.564ZM7 21C7 21.5523 7.44772 22 8 22C8.55228 22 9 21.5523 9 21H7ZM15 21C15 21.5523 15.4477 22 16 22C16.5523 22 17 21.5523 17 21H15ZM9 8L8.01942 7.80388L8 7.90098V8H9ZM3.02439 8.38434L2.03247 8.51119V8.51119L3.02439 8.38434ZM15 8H16V7.90098L15.9806 7.80388L15 8ZM20.9633 8.47033L19.9755 8.31479V8.31479L20.9633 8.47033ZM3.14305 7.64238L4.07152 8.01377H4.07152L3.14305 7.64238ZM4.49711 4.25722L5.42559 4.62861V4.62861L4.49711 4.25722ZM19.0528 4.10557L18.1584 4.55279V4.55279L19.0528 4.10557ZM20.7889 7.57771L21.6833 7.1305L21.6833 7.13049L20.7889 7.57771ZM20 8.0001V14.6H22V8.0001H20ZM14.6 20H9.4V22H14.6V20ZM4 14.6V8.0001H2V14.6H4ZM9.4 20C8.26339 20 7.47108 19.9992 6.85424 19.9488C6.24907 19.8994 5.90138 19.8072 5.63803 19.673L4.73005 21.455C5.32234 21.7568 5.96253 21.8826 6.69138 21.9422C7.40855 22.0008 8.2964 22 9.4 22V20ZM2 14.6C2 15.7036 1.99922 16.5914 2.05782 17.3086C2.11737 18.0375 2.24318 18.6777 2.54497 19.27L4.32698 18.362C4.19279 18.0986 4.10062 17.7509 4.05118 17.1458C4.00078 16.5289 4 15.7366 4 14.6H2ZM5.63803 19.673C5.07354 19.3854 4.6146 18.9265 4.32698 18.362L2.54497 19.27C3.02433 20.2108 3.78924 20.9757 4.73005 21.455L5.63803 19.673ZM20 14.6C20 15.7366 19.9992 16.5289 19.9488 17.1458C19.8994 17.7509 19.8072 18.0986 19.673 18.362L21.455 19.27C21.7568 18.6777 21.8826 18.0375 21.9422 17.3086C22.0008 16.5915 22 15.7036 22 14.6H20ZM14.6 22C15.7036 22 16.5914 22.0008 17.3086 21.9422C18.0375 21.8826 18.6777 21.7568 19.27 21.455L18.362 19.673C18.0986 19.8072 17.7509 19.8994 17.1458 19.9488C16.5289 19.9992 15.7366 20 14.6 20V22ZM19.673 18.362C19.3854 18.9265 18.9265 19.3854 18.362 19.673L19.27 21.455C20.2108 20.9757 20.9757 20.2108 21.455 19.27L19.673 18.362ZM9 21V17H7V21H9ZM10 16H14V14H10V16ZM15 17V21H17V17H15ZM14 16C14.5523 16 15 16.4477 15 17H17C17 15.3431 15.6569 14 14 14V16ZM9 17C9 16.4477 9.44772 16 10 16V14C8.34315 14 7 15.3431 7 17H9ZM8 8C8 9.10457 7.10457 10 6 10V12C8.20914 12 10 10.2091 10 8H8ZM6 10C4.98302 10 4.14196 9.24004 4.01631 8.25749L2.03247 8.51119C2.28416 10.4793 3.96371 12 6 12V10ZM14 8C14 9.10457 13.1046 10 12 10V12C14.2091 12 16 10.2091 16 8H14ZM12 10C10.8954 10 10 9.10457 10 8H8C8 10.2091 9.79086 12 12 12V10ZM19.9755 8.31479C19.8252 9.26957 18.997 10 18 10V12C19.9967 12 21.6501 10.5379 21.9512 8.62587L19.9755 8.31479ZM18 10C16.8954 10 16 9.10457 16 8H14C14 10.2091 15.7909 12 18 12V10ZM4.07152 8.01377L5.42559 4.62861L3.56864 3.88583L2.21457 7.27099L4.07152 8.01377ZM18.1584 4.55279L19.8944 8.02492L21.6833 7.13049L19.9472 3.65836L18.1584 4.55279ZM6.35407 4H10V2H6.35407V4ZM9.98058 8.19612L10.9806 3.19612L9.01942 2.80388L8.01942 7.80388L9.98058 8.19612ZM10 4H14V2H10V4ZM14 4H17.2639V2H14V4ZM15.9806 7.80388L14.9806 2.80388L13.0194 3.19612L14.0194 8.19612L15.9806 7.80388ZM19.9472 3.65836C19.439 2.64201 18.4002 2 17.2639 2V4C17.6427 4 17.989 4.214 18.1584 4.55279L19.9472 3.65836ZM21.9512 8.62587C22.0434 8.04025 21.8755 7.51499 21.6833 7.1305L19.8944 8.02492C19.9799 8.19585 19.9799 8.28699 19.9755 8.31479L21.9512 8.62587ZM5.42559 4.62861C5.57745 4.24895 5.94516 4 6.35407 4V2C5.12735 2 4.02423 2.74685 3.56864 3.88583L5.42559 4.62861ZM4.01631 8.25749C4.01315 8.2328 4.01371 8.1583 4.07152 8.01377L2.21457 7.27099C2.08339 7.59895 1.97107 8.03112 2.03247 8.51119L4.01631 8.25749Z" fill="#292929" />
    </svg>
  );
}

function GoodsEntryDateField({
  label,
  value,
  onChange,
  open,
  onToggle,
  availableMonths,
  availableDateSet
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
  availableMonths: CalendarMonth[];
  availableDateSet: Set<string>;
}) {
  const [visibleMonthKey, setVisibleMonthKey] = useState(() =>
    getMonthKey(value ? parseMonthKey(value.slice(0, 7)) : availableMonths[0] ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
  );

  useEffect(() => {
    if (value) {
      setVisibleMonthKey(value.slice(0, 7));
      return;
    }

    if (availableMonths.length > 0 && !availableMonths.some((month) => getMonthKey(month) === visibleMonthKey)) {
      setVisibleMonthKey(getMonthKey(availableMonths[0]));
    }
  }, [availableMonths, value, visibleMonthKey]);

  const activeIndex = availableMonths.findIndex((month) => getMonthKey(month) === visibleMonthKey);
  const activeMonth = activeIndex >= 0 ? availableMonths[activeIndex] : availableMonths[0];
  const monthCells = activeMonth ? buildMonthCells(activeMonth) : [];
  const canGoBack = activeIndex > 0;
  const canGoForward = activeIndex >= 0 && activeIndex < availableMonths.length - 1;

  return (
    <label className={`auth-field goods-entry-filter-field goods-entry-date-field ${open ? "open" : ""}`}>
      <span>{label}</span>
      <button type="button" className={`goods-entry-date-trigger ${open ? "open" : ""}`} onClick={onToggle}>
        <span className={`goods-entry-date-value ${value ? "filled" : ""}`}>{formatDatePlaceholder(value)}</span>
        <CalendarIcon />
      </button>
      {open && activeMonth ? (
        <div className="goods-entry-calendar-popover">
          <div className="goods-entry-calendar-head">
            <button type="button" className="goods-entry-calendar-nav" onClick={() => canGoBack && setVisibleMonthKey(getMonthKey(availableMonths[activeIndex - 1]))} disabled={!canGoBack}>
              {"<"}
            </button>
            <strong>{formatMonthLabel(activeMonth)}</strong>
            <button
              type="button"
              className="goods-entry-calendar-nav"
              onClick={() => canGoForward && setVisibleMonthKey(getMonthKey(availableMonths[activeIndex + 1]))}
              disabled={!canGoForward}
            >
              {">"}
            </button>
          </div>
          <div className="goods-entry-calendar-weekdays">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="goods-entry-calendar-grid">
            {monthCells.map((cell, index) => {
              if (!cell.date || !cell.day) {
                return <span key={`blank-${index}`} className="goods-entry-calendar-day empty" aria-hidden="true" />;
              }

              const safeDate = cell.date;
              const selectable = availableDateSet.has(safeDate);
              return (
                <button
                  key={safeDate}
                  type="button"
                  className={`goods-entry-calendar-day ${selectable ? "active" : "ghost"} ${value === safeDate ? "selected" : ""}`}
                  onClick={() => {
                    if (!selectable) {
                      return;
                    }
                    onChange(safeDate);
                  }}
                  disabled={!selectable}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </label>
  );
}

const buildRankedData = (rows: GoodsEntryRow[], selector: (row: GoodsEntryRow) => string, top = 6): RankedDatum[] =>
  [...rows
    .reduce((map, row) => {
      const label = selector(row) || "Nao informado";
      map.set(label, (map.get(label) ?? 0) + row.totalValue);
      return map;
    }, new Map<string, number>())
    .entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, top);

const buildTrendSeries = (rows: GoodsEntryRow[], labels: string[], fallbackDate?: string) => {
  const availableDates = [...new Set(rows.map((row) => getReferenceDate(row)).filter(Boolean) as string[])].sort((left, right) => left.localeCompare(right));
  if (availableDates.length === 0) {
    if (rows.length > 0 && fallbackDate) {
      return {
        granularity: "day" as TrendGranularity,
        series: [
          {
            key: fallbackDate,
            label: formatShortDateLabel(fallbackDate),
            totals: rows.reduce((totals, row) => {
              const group = row.group || "Sem grupo";
              if (labels.includes(group)) {
                totals[group] = (totals[group] ?? 0) + row.totalValue;
              }
              return totals;
            }, {} as Record<string, number>)
          }
        ]
      };
    }
    return { granularity: "day" as TrendGranularity, series: [] as TrendPoint[] };
  }

  const firstDate = availableDates[0];
  const lastDate = availableDates[availableDates.length - 1];
  const spanDays = diffInDays(firstDate, lastDate) + 1;
  const granularity: TrendGranularity = spanDays <= 10 ? "day" : spanDays < 30 ? "two-day" : "week";
  const bucketSize = granularity === "day" ? 1 : granularity === "two-day" ? 2 : 7;

  const series = [...rows
    .reduce((map, row) => {
      const referenceDate = getReferenceDate(row);
      const safeDate = referenceDate ?? firstDate;
      const offset = Math.floor(diffInDays(firstDate, safeDate) / bucketSize) * bucketSize;
      const bucketStart = addDays(firstDate, offset);
      const key = bucketStart;
      const group = row.group || "Sem grupo";
      const current = map.get(key) ?? {
        key,
        label: formatShortDateLabel(bucketStart),
        totals: {} as Record<string, number>
      };

      if (labels.includes(group)) {
        current.totals[group] = (current.totals[group] ?? 0) + row.totalValue;
      }

      map.set(key, current);
      return map;
    }, new Map<string, TrendPoint>())
    .values()].sort((left, right) => left.key.localeCompare(right.key));

  return { granularity, series };
};

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(radians),
    y: cy + r * Math.sin(radians)
  };
};

const buildArcPath = (cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number) => {
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

const formatCompactCurrency = (value: number) => {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1)} mi`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(0)} mil`;
  }
  return formatCurrency(value);
};


function GoodsEntryUploadPanel({
  canManageData,
  processing,
  error,
  onImport,
  onClear
}: Pick<GoodsEntryPanelsProps, "canManageData" | "processing" | "error" | "onImport" | "onClear">) {
  const { locale } = useLocale();
  const copy =
    locale === "en"
      ? {
          title: "Import goods intake report",
          text: "Upload the purchasing spreadsheet to unlock group, supplier and timing analysis.",
          action: "Select spreadsheet",
          clear: "Clear file",
          hint: "Accepted: .xls .xlsx",
          processing: "Reading goods intake and organizing the purchase base...",
          locked: "Only owners can import operational files."
        }
      : locale === "es"
        ? {
            title: "Importar entrada de mercaderias",
            text: "Sube la planilla de compras para liberar analisis por grupo, proveedor y ritmo de abastecimiento.",
            action: "Seleccionar planilla",
            clear: "Limpiar archivo",
            hint: "Aceptado: .xls .xlsx",
            processing: "Leyendo entradas de mercaderias y organizando la base de compras...",
            locked: "Solo owners pueden importar archivos operativos."
          }
        : {
            title: "Importar entrada de mercadorias",
            text: "Suba a planilha de compras para liberar analise por grupo, fornecedor e ritmo de abastecimento.",
            action: "Selecionar planilha",
            clear: "Limpar arquivo",
            hint: "Aceito: .xls .xlsx",
            processing: "Lendo entradas de mercadorias e organizando a base de compras...",
            locked: "Apenas owner pode importar arquivos operacionais."
          };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImport(file);
    }
    event.target.value = "";
  };

  return (
    <section className="card goods-entry-upload-panel">
      <div className="section-head">
        <div>
          <h3>{copy.title}</h3>
          <p>{copy.text}</p>
        </div>
        <div className="panel-actions">
          <button type="button" className="ghost-button danger-button" onClick={onClear} disabled={!canManageData}>
            {copy.clear}
          </button>
        </div>
      </div>

      <label className={`upload-box featured simple ${canManageData ? "" : "locked"}`}>
        <span className="eyebrow">Excel</span>
        <strong className="upload-title">{copy.action}</strong>
        <small>{canManageData ? copy.hint : copy.locked}</small>
        <div className="upload-box-footer">
          <span className="upload-action">{copy.action}</span>
          <span className="upload-meta">.xls .xlsx</span>
        </div>
        <input className="upload-input-hidden" type="file" accept=".xls,.xlsx" onChange={handleChange} disabled={!canManageData} />
      </label>

      {processing ? <p className="message">{copy.processing}</p> : null}
      {error ? <p className="message error">{error}</p> : null}
    </section>
  );
}

function GoodsEntryMetricGrid({ metrics }: { metrics: MetricCard[] }) {
  return (
    <section className="kpi-grid goods-entry-kpi-grid">
      {metrics.map((metric) => (
        <article key={metric.label} className="card kpi-card clean goods-entry-kpi-card">
          <div className="kpi-card-head">
            <div className="icon-chip metric">{metric.icon}</div>
            <div className="kpi-card-heading">
              <span className="eyebrow">{metric.label}</span>
            </div>
          </div>
          <strong>{metric.value}</strong>
          <div className="kpi-card-foot">
            <span className={`kpi-card-badge ${metric.badgeTone}`}>{metric.badge}</span>
            <p>{metric.detail}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function GoodsEntryBars({
  title,
  text,
  rows,
  activeLabel,
  onSelect
}: {
  title: string;
  text: string;
  rows: RankedDatum[];
  activeLabel?: string;
  onSelect?: (label: string) => void;
}) {
  const maxValue = rows[0]?.value ?? 0;

  return (
    <section className="card chart-card goods-entry-chart-card">
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
      </div>

      <div className="goods-entry-ranking-list">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            className={`ranking-row goods-entry-ranking-row goods-entry-select-row ${activeLabel === row.label ? "active" : ""}`}
            onClick={() => onSelect?.(row.label)}
          >
            <div className="ranking-labels">
              <span>{row.label}</span>
              <strong>{formatCurrency(row.value)}</strong>
            </div>
            <div className="bar-track goods-entry-bar-track">
              <div
                className="bar-fill goods-entry-bar-fill"
                style={{ width: `${clampPercent(maxValue > 0 ? (row.value / maxValue) * 100 : 0)}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function GoodsEntryDonut({
  title,
  text,
  rows,
  activeLabel,
  onSelect
}: {
  title: string;
  text: string;
  rows: RankedDatum[];
  activeLabel?: string;
  onSelect?: (label: string) => void;
}) {
  const [clickedSlice, setClickedSlice] = useState<string>();
  const total = sumBy(rows, (row) => row.value);
  const segments = rows
    .map((row, index) => ({
      ...row,
      share: total > 0 ? row.value / total : 0,
      color: linePalette[index % linePalette.length]
    }))
    .filter((row) => row.share > 0);

  let startAngle = 0;
  const arcs = segments.map((segment) => {
    const angle = segment.share * 360;
    const arc = {
      ...segment,
      startAngle,
      endAngle: startAngle + angle
    };
    startAngle += angle;
    return arc;
  });

  return (
    <section className="card chart-card goods-entry-chart-card goods-entry-donut-card">
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
      </div>

      <div className="goods-entry-donut-layout">
        <svg viewBox="0 0 240 240" className="goods-entry-donut-svg" role="img" aria-label={title}>
          {arcs.map((arc) => {
            const isActive = activeLabel === arc.label;
            const path = buildArcPath(120, 120, isActive ? 104 : 98, 58, arc.startAngle, arc.endAngle);
            return (
              <path
                key={arc.label}
                d={path}
                fill={arc.color}
                className={`goods-entry-donut-segment ${isActive ? "active" : ""} ${clickedSlice === arc.label ? "clicked" : ""}`}
                onClick={() => {
                  setClickedSlice(arc.label);
                  window.setTimeout(() => {
                    setClickedSlice((current) => (current === arc.label ? undefined : current));
                  }, 340);
                  onSelect?.(arc.label);
                }}
              >
                <title>{`${arc.label}: ${formatCurrency(arc.value)} (${Math.round(arc.share * 100)}%)`}</title>
              </path>
            );
          })}
          <circle cx="120" cy="120" r="52" className="goods-entry-donut-hole" />
          <text x="120" y="112" textAnchor="middle" className="goods-entry-donut-center-value">
            {formatCompactCurrency(total)}
          </text>
          <text x="120" y="132" textAnchor="middle" className="goods-entry-donut-center-label">
            Total filtrado
          </text>
        </svg>

        <div className="goods-entry-donut-legend">
          {arcs.map((arc) => (
            <button
              key={arc.label}
              type="button"
              className={`goods-entry-donut-legend-row goods-entry-select-row ${activeLabel === arc.label ? "active" : ""}`}
              onClick={() => onSelect?.(arc.label)}
            >
              <span className="goods-entry-donut-swatch" style={{ background: arc.color }} />
              <div className="goods-entry-donut-copy">
                <strong>{arc.label}</strong>
                <span>{formatCurrency(arc.value)}</span>
                <small>{Math.round(arc.share * 100)}% do total</small>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function GoodsEntryLineChart({
  title,
  text,
  series,
  labels,
  granularity
}: {
  title: string;
  text: string;
  series: TrendPoint[];
  labels: string[];
  granularity: TrendGranularity;
}) {
  if (labels.length === 0 || series.length === 0) {
    return (
      <section className="card chart-card goods-entry-chart-card goods-entry-line-chart-card">
        <div className="section-head">
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </div>
        <p className="message">Importe mais dados para comparar a evolucao entre grupos.</p>
      </section>
    );
  }

  const chartWidth = 940;
  const chartHeight = 320;
  const paddingLeft = 72;
  const paddingRight = 30;
  const paddingTop = 24;
  const paddingBottom = 52;
  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const maxValue = Math.max(1, ...series.flatMap((point) => labels.map((label) => point.totals[label] ?? 0)));
  const roundedMax = Math.ceil(maxValue / 1000) * 1000;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const buildX = (index: number) => paddingLeft + (series.length === 1 ? innerWidth / 2 : (index / (series.length - 1)) * innerWidth);
  const buildY = (value: number) => paddingTop + innerHeight - (value / roundedMax) * innerHeight;
  const buildPath = (label: string) =>
    series
      .map((point, index) => `${index === 0 ? "M" : "L"} ${buildX(index)} ${buildY(point.totals[label] ?? 0)}`)
      .join(" ");

  return (
    <section className="card chart-card goods-entry-chart-card goods-entry-line-chart-card">
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
        <div className="goods-entry-filter-summary">
          <span className="cmv-pill pending">
            {granularity === "day" ? "Leitura diaria" : granularity === "two-day" ? "Leitura a cada 2 dias" : "Leitura semanal"}
          </span>
        </div>
      </div>

      <div className="goods-entry-line-card">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="goods-entry-line-chart" role="img" aria-label={title}>
          {yTicks.map((tick) => {
            const y = paddingTop + innerHeight - tick * innerHeight;
            const value = tick * roundedMax;
            return (
              <g key={tick}>
                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} className="goods-entry-line-grid" />
                <text x={paddingLeft - 12} y={y + 4} textAnchor="end" className="goods-entry-axis-label">
                  {formatCompactCurrency(value)}
                </text>
              </g>
            );
          })}

          {series.map((point, index) => (
            <text
              key={point.key}
              x={buildX(index)}
              y={chartHeight - 16}
              textAnchor="middle"
              className="goods-entry-axis-label goods-entry-axis-x"
            >
              {point.label}
            </text>
          ))}

          {labels.map((label, index) => (
            <path
              key={label}
              d={buildPath(label)}
              fill="none"
              stroke={linePalette[index % linePalette.length]}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {labels.map((label, index) =>
            series.map((point, pointIndex) => {
              const value = point.totals[label] ?? 0;
              return (
                <circle
                  key={`${label}-${point.key}`}
                  cx={buildX(pointIndex)}
                  cy={buildY(value)}
                  r="5"
                  fill={linePalette[index % linePalette.length]}
                >
                  <title>{`${label} · ${point.label}: ${formatCurrency(value)}`}</title>
                </circle>
              );
            })
          )}
        </svg>

        <div className="goods-entry-line-legend goods-entry-line-legend-grid">
          {labels.map((label, index) => {
            const peakValue = Math.max(...series.map((point) => point.totals[label] ?? 0));
            return (
              <div key={label} className="goods-entry-line-legend-row">
                <span className="goods-entry-donut-swatch" style={{ background: linePalette[index % linePalette.length] }} />
                <div className="goods-entry-donut-copy">
                  <strong>{label}</strong>
                  <small>Pico no recorte: {formatCurrency(peakValue)}</small>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GoodsEntrySubgroupDrilldown({
  rows,
  activeGroup,
  onClose
}: {
  rows: GoodsEntryRow[];
  activeGroup?: string;
  onClose: () => void;
}) {
  if (!activeGroup) {
    return (
      <section className="card goods-entry-table-card">
        <div className="section-head">
          <div>
            <h3>Subgrupos por grupo</h3>
            <p>Clique em um grupo nos graficos acima para abrir o detalhamento de compras daquele bloco.</p>
          </div>
        </div>
      </section>
    );
  }

  const subgroupRows = buildRankedData(rows.filter((row) => (row.group || "Sem grupo") === activeGroup), (row) => row.subgroup || "Sem subgrupo", 12);

  return (
    <section className="card goods-entry-table-card">
      <div className="section-head">
        <div>
          <h3>Subgrupos dentro de {activeGroup}</h3>
          <p>Leitura direcionada para entender quais frentes desse grupo estao puxando mais compra.</p>
        </div>
        <div className="panel-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Fechar detalhamento
          </button>
        </div>
      </div>

      <div className="goods-entry-ranking-list">
        {subgroupRows.map((row) => (
          <div key={row.label} className="ranking-row goods-entry-ranking-row">
            <div className="ranking-labels">
              <span>{row.label}</span>
              <strong>{formatCurrency(row.value)}</strong>
            </div>
            <div className="bar-track goods-entry-bar-track">
              <div
                className="bar-fill goods-entry-bar-fill"
                style={{ width: `${clampPercent(subgroupRows[0]?.value ? (row.value / subgroupRows[0].value) * 100 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GoodsEntryPanels({ data, error, processing, canManageData, onImport, onClear }: GoodsEntryPanelsProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("__ALL__");
  const [selectedSupplier, setSelectedSupplier] = useState("__ALL__");
  const [focusedGroup, setFocusedGroup] = useState<string>();
  const [openCalendar, setOpenCalendar] = useState<CalendarField | null>(null);

  const sourceEntries = useMemo(() => data?.entries ?? [], [data]);
  const actualEntryDates = useMemo(
    () => [...new Set(sourceEntries.map((row) => getReferenceDate(row)).filter(Boolean) as string[])].sort((left, right) => left.localeCompare(right)),
    [sourceEntries]
  );
  const importedRangeDates = useMemo(() => buildContinuousRange(data?.reportPeriod?.startDate, data?.reportPeriod?.endDate), [data?.reportPeriod?.endDate, data?.reportPeriod?.startDate]);
  const dataVersion = `${data?.sheetName ?? ""}|${data?.entries.length ?? 0}|${data?.reportPeriod?.startDate ?? ""}|${data?.reportPeriod?.endDate ?? ""}`;
  const availableDates = importedRangeDates.length > 0 ? importedRangeDates : actualEntryDates;
  const hasEntryLevelDates = actualEntryDates.length > 0;
  const availableMonths = useMemo(() => buildAvailableMonths(availableDates), [availableDates]);
  const groups = useMemo(
    () => [...new Set(sourceEntries.map((row) => row.group).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [sourceEntries]
  );
  const suppliers = useMemo(
    () => [...new Set(sourceEntries.map((row) => row.supplier).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [sourceEntries]
  );

  useEffect(() => {
    setDateFrom("");
    setDateTo("");
    setSelectedGroup("__ALL__");
    setSelectedSupplier("__ALL__");
    setFocusedGroup(undefined);
    setOpenCalendar(null);
  }, [dataVersion]);

  const filteredEntries = useMemo(
    () =>
      sourceEntries.filter((row) => {
        const referenceDate = getReferenceDate(row);
        if (hasEntryLevelDates) {
          if (dateFrom && (!referenceDate || referenceDate < dateFrom)) {
            return false;
          }
          if (dateTo && (!referenceDate || referenceDate > dateTo)) {
            return false;
          }
        }
        if (selectedGroup !== "__ALL__" && row.group !== selectedGroup) {
          return false;
        }
        if (selectedSupplier !== "__ALL__" && row.supplier !== selectedSupplier) {
          return false;
        }
        return true;
      }),
    [dateFrom, dateTo, hasEntryLevelDates, selectedGroup, selectedSupplier, sourceEntries]
  );

  const availableStartDates = useMemo(
    () => availableDates.filter((date) => !dateTo || date <= dateTo),
    [availableDates, dateTo]
  );
  const availableEndDates = useMemo(
    () => availableDates.filter((date) => !dateFrom || date >= dateFrom),
    [availableDates, dateFrom]
  );

  useEffect(() => {
    if (dateFrom && !availableStartDates.includes(dateFrom)) {
      setDateFrom("");
    }
  }, [availableStartDates, dateFrom]);

  useEffect(() => {
    if (dateTo && !availableEndDates.includes(dateTo)) {
      setDateTo("");
    }
  }, [availableEndDates, dateTo]);

  const availableStartDateSet = useMemo(() => new Set(availableStartDates), [availableStartDates]);
  const availableEndDateSet = useMemo(() => new Set(availableEndDates), [availableEndDates]);

  const activeDrilldownGroup = selectedGroup !== "__ALL__" ? selectedGroup : focusedGroup;
  const distinctSuppliers = new Set(filteredEntries.map((row) => row.supplier).filter(Boolean)).size;
  const distinctNotes = new Set(filteredEntries.map((row) => row.receiptNumber).filter(Boolean)).size;
  const totalSpend = sumBy(filteredEntries, (row) => row.totalValue);
  const topGroups = buildRankedData(filteredEntries, (row) => row.group || "Sem grupo");
  const topSuppliers = buildRankedData(filteredEntries, (row) => row.supplier || "Sem fornecedor");
  const lineLabels = topGroups.slice(0, 4).map((row) => row.label);
  const trend = buildTrendSeries(filteredEntries, lineLabels, data?.reportPeriod?.startDate);

  const metrics: MetricCard[] = [
    {
      label: "Total comprado",
      value: formatCurrency(totalSpend),
      detail: `${formatNumber(filteredEntries.length)} linhas no recorte atual`,
      badge: "Compras",
      badgeTone: "good",
      icon: <IconRevenueKpi />
    },
    {
      label: "Fornecedores ativos",
      value: formatNumber(distinctSuppliers),
      detail: `${formatNumber(distinctNotes)} notas ou recebimentos distintos`,
      badge: "Fornecedores",
      badgeTone: "cool",
      icon: <IconSuppliersKpi />
    }
  ];

  const periodLabel = data?.reportPeriod?.displayLabel ?? data?.reportPeriod?.periodLabel ?? data?.restaurantName ?? "Periodo nao identificado";

  return (
    <>
      {canManageData ? (
        <GoodsEntryUploadPanel canManageData={canManageData} processing={processing} error={error} onImport={onImport} onClear={onClear} />
      ) : null}

      {!data ? (
        <section className="card">
          <div className="section-head">
            <div>
              <h3>Analise pronta para comecar</h3>
              <p>Importe o relatorio de entradas para comparar grupos, subgrupos, fornecedores e ritmo de compras.</p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="card goods-entry-filter-card">
            <div className="section-head">
              <div>
                <h3>Filtro avancado</h3>
                <p>Refine a leitura por periodo, grupo e fornecedor com um recorte visual mais limpo e interativo.</p>
              </div>
              <div className="goods-entry-filter-summary">
                <span className="cmv-pill good">{periodLabel}</span>
                <span className="cmv-pill pending">{formatNumber(filteredEntries.length)} linhas no recorte</span>
              </div>
            </div>

            <div className="goods-entry-filter-grid">
              <GoodsEntryDateField
                label="Data inicial"
                value={dateFrom}
                onChange={(value) => {
                  setDateFrom(value);
                  setOpenCalendar(null);
                }}
                open={openCalendar === "from"}
                onToggle={() => setOpenCalendar((current) => (current === "from" ? null : "from"))}
                availableMonths={availableMonths}
                availableDateSet={availableStartDateSet}
              />
              <GoodsEntryDateField
                label="Data final"
                value={dateTo}
                onChange={(value) => {
                  setDateTo(value);
                  setOpenCalendar(null);
                }}
                open={openCalendar === "to"}
                onToggle={() => setOpenCalendar((current) => (current === "to" ? null : "to"))}
                availableMonths={availableMonths}
                availableDateSet={availableEndDateSet}
              />
              <label className="auth-field goods-entry-filter-field">
                <span>Grupo</span>
                <select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>
                  <option value="__ALL__">Todos os grupos</option>
                  {groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
              <label className="auth-field goods-entry-filter-field">
                <span>Fornecedor</span>
                <select value={selectedSupplier} onChange={(event) => setSelectedSupplier(event.target.value)}>
                  <option value="__ALL__">Todos os fornecedores</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier} value={supplier}>
                      {supplier}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="goods-entry-filter-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSelectedGroup("__ALL__");
                  setSelectedSupplier("__ALL__");
                  setFocusedGroup(undefined);
                  setOpenCalendar(null);
                }}
              >
                Limpar filtros
              </button>
              <div className="goods-entry-filter-chips">
                {selectedGroup !== "__ALL__" ? <span className="cmv-pill mid">{selectedGroup}</span> : null}
                {selectedSupplier !== "__ALL__" ? <span className="cmv-pill promo">{selectedSupplier}</span> : null}
              </div>
            </div>
          </section>

          {filteredEntries.length === 0 ? (
            <section className="card">
              <p className="message">Nenhum lancamento foi encontrado com os filtros selecionados.</p>
            </section>
          ) : (
            <>
              <GoodsEntryMetricGrid metrics={metrics} />

              <section className="analytics-grid wide goods-entry-analytics-grid">
                <GoodsEntryDonut
                  title="Participacao de compra por grupo"
                  text="Clique em um grupo para abrir o detalhamento dos subgrupos desse bloco."
                  rows={topGroups}
                  activeLabel={activeDrilldownGroup}
                  onSelect={(label) => setFocusedGroup((current) => (current === label ? undefined : label))}
                />
                <GoodsEntryBars
                  title="Grupos com maior peso de compra"
                  text="Uma leitura direta para enxergar onde a operacao concentra mais capital."
                  rows={topGroups}
                  activeLabel={activeDrilldownGroup}
                  onSelect={(label) => setFocusedGroup((current) => (current === label ? undefined : label))}
                />
              </section>

              <GoodsEntryLineChart
                title="Linha comparativa entre grupos"
                text="A escala responde ao periodo filtrado: ate 10 dias por dia, acima disso a leitura abre espacos progressivos para manter o grafico limpo."
                labels={lineLabels}
                series={trend.series}
                granularity={trend.granularity}
              />

              <section className="analytics-grid wide goods-entry-analytics-grid">
                <GoodsEntrySubgroupDrilldown
                  rows={filteredEntries}
                  activeGroup={activeDrilldownGroup}
                  onClose={() => setFocusedGroup(undefined)}
                />
                <GoodsEntryBars
                  title="Fornecedores com maior participacao"
                  text="Leia dependencia, concentracao e volume por parceiro de compra."
                  rows={topSuppliers}
                />
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}

export default GoodsEntryPanels;
