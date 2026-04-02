import * as XLSX from "xlsx";
import type { RawRow, SalesImportData, SalesImportRow, SalesReportPeriod, SalesTotalRow } from "../types";

const readAsArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error(`Falha ao ler o arquivo ${file.name}.`));
    reader.readAsArrayBuffer(file);
  });

export const parseSpreadsheetFile = async (file: File): Promise<RawRow[]> => {
  const buffer = await readAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheet];

  return XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: "",
    raw: false
  });
};

const cellToText = (value: unknown) => String(value ?? "").trim();

const normalizeCode = (value: unknown) => cellToText(value).replace(/\D/g, "").slice(0, 4);

const isTotalLabel = (value: string) => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  return normalized.startsWith("TOTAL SUBGRUPO") || normalized.startsWith("TOTAL GRUPO") || normalized.startsWith("TOTAL GERAL");
};

const getRowMergeSpan = (merges: XLSX.Range[] | undefined, rowIndex: number) => {
  const merge = merges?.find((item) => item.s.r === rowIndex && item.e.r === rowIndex);
  if (!merge) {
    return 1;
  }

  return merge.e.c - merge.s.c + 1;
};

const parseNumericCell = (value: unknown) => {
  const text = cellToText(value);
  if (!text) {
    return 0;
  }

  return Number(text.replace(/[R$\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
};

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const normalizeYear = (year: number) => (year < 100 ? 2000 + year : year);

const parseDateParts = (value: string) => {
  const match = cellToText(value).match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!match) {
    return undefined;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = normalizeYear(Number(match[3]));

  if (!day || !month || !year) {
    return undefined;
  }

  return { day, month, year };
};

const buildPeriodMetadata = (startDate?: string, endDate?: string) => {
  const startParts = startDate ? parseDateParts(startDate) : undefined;
  const endParts = endDate ? parseDateParts(endDate) : undefined;
  const reference = endParts ?? startParts;

  if (!reference) {
    return {
      periodKey: "sem-periodo",
      periodLabel: "Sem periodo"
    };
  }

  const sameMonth =
    startParts &&
    endParts &&
    startParts.month === endParts.month &&
    startParts.year === endParts.year;

  if (sameMonth) {
    return {
      periodKey: `${reference.year}-${String(reference.month).padStart(2, "0")}`,
      periodLabel: `${monthLabels[reference.month - 1]}/${reference.year}`,
      month: reference.month,
      year: reference.year
    };
  }

  return {
    periodKey: `${reference.year}-${String(reference.month).padStart(2, "0")}-${startDate ?? "inicio"}-${endDate ?? "fim"}`,
    periodLabel: `${startDate ?? "Inicio"} a ${endDate ?? "Fim"}`,
    month: reference.month,
    year: reference.year
  };
};

const parseReportPeriod = (value: string): SalesReportPeriod | undefined => {
  const text = cellToText(value);
  if (!text) {
    return undefined;
  }

  const match = text.match(/ABERT\.\s*:?\s*(\d{2}\/\d{2}\/\d{2,4}).*FECH\.\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i);
  if (!match) {
    const periodMeta = buildPeriodMetadata();
    return {
      rawLabel: text,
      displayLabel: text,
      periodKey: periodMeta.periodKey,
      periodLabel: text
    };
  }

  const periodMeta = buildPeriodMetadata(match[1], match[2]);

  return {
    rawLabel: text,
    startDate: match[1],
    endDate: match[2],
    displayLabel: `${match[1]} a ${match[2]}`,
    periodKey: periodMeta.periodKey,
    periodLabel: periodMeta.periodLabel,
    month: periodMeta.month,
    year: periodMeta.year
  };
};

export const parseSalesSpreadsheetFile = async (file: File): Promise<SalesImportData> => {
  const buffer = await readAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    return {
      items: [],
      totals: [],
      headerValues: []
    };
  }

  const sheet = workbook.Sheets[firstSheet];
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false
  });
  const merges = sheet["!merges"];
  const reportPeriod = parseReportPeriod(cellToText(matrix[0]?.[0]));
  const headerRowIndex = matrix[3]?.some((cell) => cellToText(cell)) ? 3 : 0;
  const headerValues = (matrix[headerRowIndex] ?? []).map((cell) => cellToText(cell)).filter(Boolean);

  let currentGroup = "";
  let currentSubgroup = "";
  let lastSpecial: "group" | "subgroup" | "total-subgroup" | "total-group" | "total-general" | "none" = "none";
  const rows: SalesImportRow[] = [];
  const totals: SalesTotalRow[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const firstCell = cellToText(row[0]);
    const secondCell = cellToText(row[1]);
    const thirdCell = row[2];
    const fourthCell = row[3];
    const mergeSpan = getRowMergeSpan(merges, rowIndex);

    if (!firstCell && !secondCell && !cellToText(thirdCell) && !cellToText(fourthCell)) {
      continue;
    }

    const firstCode = normalizeCode(firstCell);
    if (firstCode && secondCell) {
      rows.push({
        codigo: firstCode,
        produto: secondCell,
        qte: thirdCell,
        total: fourthCell,
        grupo: currentGroup,
        subgrupo: currentSubgroup
      });
      lastSpecial = "none";
      continue;
    }

    if (isTotalLabel(firstCell)) {
      totals.push({
        level: firstCell.toUpperCase().includes("SUBGRUPO")
          ? "subgroup"
          : firstCell.toUpperCase().includes("GRUPO")
            ? "group"
            : "general",
        label: firstCell,
        group: currentGroup,
        subgroup: currentSubgroup,
        quantity: parseNumericCell(thirdCell),
        revenue: parseNumericCell(fourthCell)
      });

      if (firstCell.toUpperCase().includes("SUBGRUPO")) {
        lastSpecial = "total-subgroup";
      } else if (firstCell.toUpperCase().includes("GRUPO")) {
        currentSubgroup = "";
        lastSpecial = "total-group";
      } else {
        lastSpecial = "total-general";
      }
      continue;
    }

    if (mergeSpan >= 4 && firstCell) {
      const shouldStartNewGroup =
        !currentGroup || lastSpecial === "total-group" || lastSpecial === "total-general";

      if (shouldStartNewGroup) {
        currentGroup = firstCell;
        currentSubgroup = "";
        lastSpecial = "group";
      } else {
        currentSubgroup = firstCell;
        lastSpecial = "subgroup";
      }
    }
  }

  return {
    items: rows,
    totals,
    reportPeriod,
    headerValues
  };
};
