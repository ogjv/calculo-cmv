import * as XLSX from "xlsx";
import type {
  DreGroup,
  DreImportData,
  DreLine,
  DreSection,
  RawRow,
  SalesImportData,
  SalesImportRow,
  SalesReportPeriod,
  SalesTotalRow
} from "../types";

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

const normalizeText = (value: unknown) =>
  cellToText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const normalizeCode = (value: unknown) =>
  cellToText(value)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^(\d+)[.,]0+$/, "$1");

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

  return Number(text.replace(/[R$%\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
};

const hasNumericText = (value: unknown) => /-?\d/.test(cellToText(value));
const hasAlphabeticText = (value: unknown) => /[A-Za-zÀ-ÿ]/.test(cellToText(value));

const hasCellValue = (value: unknown) => cellToText(value) !== "";

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

const stripLabelPrefix = (value: string, prefix: string) => value.replace(new RegExp(`^${prefix}\\s*:?\\s*`, "i"), "").trim();

const parseDrePeriod = (value: unknown): DreImportData["period"] | undefined => {
  const rawLabel = stripLabelPrefix(cellToText(value), "Período|Periodo");
  if (!rawLabel) {
    return undefined;
  }

  const match = rawLabel.match(/(\d{2}\/\d{2}\/\d{2,4})\s*a\s*(\d{2}\/\d{2}\/\d{2,4})/i);
  const startDate = match?.[1];
  const endDate = match?.[2];
  const reference = endDate ? parseDateParts(endDate) : startDate ? parseDateParts(startDate) : undefined;

  return {
    rawLabel,
    startDate,
    endDate,
    month: reference?.month,
    year: reference?.year
  };
};

const isDreSectionTotalLabel = (value: string) => normalizeText(value).startsWith("TOTAL ");

const isDreInformationalRevenueTotalLabel = (value: string) => {
  const normalized = normalizeText(value);

  return (
    normalized.includes("TOTAL INFORMADO") ||
    normalized.includes("TOTAL COMPUTADO") ||
    normalized.includes("DIFERENCA DE CAIXA")
  );
};

const isDreSummaryLabel = (value: string) => {
  const normalized = normalizeText(value);

  return (
    normalized === "RECEITA LIQUIDA" ||
    normalized === "MARGEM DE CONTRIBUICAO" ||
    normalized === "RESULTADO OPERACIONAL" ||
    normalized === "RESULTADO OPERACIONAL EM PERCENTUAL (%)" ||
    normalized === "TOTAL RECEITAS" ||
    normalized === "TOTAL DESPESAS" ||
    normalized === "SALDO FINAL" ||
    normalized.startsWith("(RO)") ||
    normalized.startsWith("(RL)") ||
    normalized.startsWith("(MC)")
  );
};

const findLastDreGroup = (section?: DreSection) => section?.groups[section.groups.length - 1];

const createDreLine = (label: string, value: number, percent: number | undefined, rowNumber: number): DreLine => ({
  label,
  value,
  ...(percent !== undefined ? { percent } : {}),
  rowNumber
});

const readDreLineValue = (row: (string | number)[], indexes: number[]) => {
  for (const index of indexes) {
    if (hasCellValue(row[index]) && hasNumericText(row[index])) {
      return parseNumericCell(row[index]);
    }
  }

  return 0;
};

const readDreLinePercent = (row: (string | number)[], indexes: number[]) => {
  for (const index of indexes) {
    if (hasCellValue(row[index]) && hasNumericText(row[index])) {
      const value = parseNumericCell(row[index]);
      if (Math.abs(value) > 100) {
        continue;
      }
      return Math.abs(value) <= 1 ? value * 100 : value;
    }
  }

  return undefined;
};

const fillMergedCells = (matrix: (string | number)[][], merges: XLSX.Range[] | undefined) => {
  if (!merges?.length) {
    return matrix;
  }

  const filledMatrix = matrix.map((row) => [...row]);

  for (const merge of merges) {
    const sourceValue = filledMatrix[merge.s.r]?.[merge.s.c];

    if (!hasCellValue(sourceValue)) {
      continue;
    }

    for (let rowIndex = merge.s.r; rowIndex <= merge.e.r; rowIndex += 1) {
      const row = filledMatrix[rowIndex] ?? [];
      filledMatrix[rowIndex] = row;

      for (let columnIndex = merge.s.c; columnIndex <= merge.e.c; columnIndex += 1) {
        if (!hasCellValue(row[columnIndex])) {
          row[columnIndex] = sourceValue;
        }
      }
    }
  }

  return filledMatrix;
};

export const parseDreSpreadsheetFile = async (file: File): Promise<DreImportData> => {
  const buffer = await readAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    return {
      sheetName: "",
      sections: [],
      summary: []
    };
  }

  const sheet = workbook.Sheets[firstSheet];
  const rawMatrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false
  });
  const matrix = fillMergedCells(rawMatrix, sheet["!merges"]);

  const sections: DreSection[] = [];
  const summary: DreImportData["summary"] = [];

  const ensureSection = (label: string) => {
    let section = sections.find((item) => normalizeText(item.label) === normalizeText(label));
    if (!section) {
      section = { label, groups: [] };
      sections.push(section);
    }

    return section;
  };

  const ensureGroup = (section: DreSection, label: string) => {
    let group = section.groups.find((item) => normalizeText(item.label) === normalizeText(label));
    if (!group) {
      group = { label, lines: [] };
      section.groups.push(group);
    }

    return group;
  };

  const analysisType = stripLabelPrefix(cellToText(matrix[0]?.[0]), "Tipo de Análise|Tipo de Analise");
  const restaurantName = cellToText(matrix[0]?.[2]);
  const period = parseDrePeriod(matrix[1]?.[0]);
  const reportTitle = cellToText(matrix[1]?.[2]);
  const analysisTitle = matrix
    .slice(2, 8)
    .map((row) => cellToText(row?.[2]))
    .find(Boolean);

  let currentSection: DreSection | undefined;
  let currentGroup: DreGroup | undefined;

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    if (rowIndex < 3) {
      continue;
    }

    const row = matrix[rowIndex] ?? [];
    const sectionLabel = cellToText(row[0]);
    const groupLabel = cellToText(row[1]);
    const itemLabel = cellToText(row[2]);
    const detailLabel = cellToText(row[3]);
    const rowNumber = rowIndex + 1;

    if (!sectionLabel && !groupLabel && !itemLabel && !hasCellValue(row[3]) && !hasCellValue(row[4])) {
      continue;
    }

    if (sectionLabel && isDreSummaryLabel(sectionLabel)) {
      const normalizedSummaryLabel = normalizeText(sectionLabel);
      const isPercentOnlySummary =
        normalizedSummaryLabel.includes("PERCENTUAL") ||
        normalizedSummaryLabel.startsWith("(RO)") ||
        normalizedSummaryLabel.startsWith("(RL)") ||
        normalizedSummaryLabel.startsWith("(MC)");
      const value = readDreLineValue(row, [1, 2, 3, 4]);
      const percent = readDreLinePercent(row, isPercentOnlySummary ? [1, 2, 3, 4, 5] : [5, 4]);
      summary.push(createDreLine(sectionLabel, value, percent, rowNumber));
      currentGroup = undefined;
      continue;
    }

    if (sectionLabel && isDreSectionTotalLabel(sectionLabel)) {
      const value = readDreLineValue(row, [3, 4, 2, 1]);
      const percent = readDreLinePercent(row, [5, 4]);
      if (currentSection) {
        currentSection.total = createDreLine(sectionLabel, value, percent, rowNumber);
      }
      summary.push(createDreLine(sectionLabel, value, percent, rowNumber));
      currentGroup = undefined;
      continue;
    }

    if (sectionLabel) {
      const nextSection = ensureSection(sectionLabel);
      if (currentSection !== nextSection) {
        currentGroup = undefined;
      }
      currentSection = nextSection;
    }

    if (!currentSection) {
      continue;
    }

    if (groupLabel && normalizeText(groupLabel).startsWith("TOTAL ")) {
      if (isDreInformationalRevenueTotalLabel(groupLabel)) {
        currentGroup = undefined;
        continue;
      }

      const targetGroup = currentGroup ?? findLastDreGroup(currentSection);
      const value = readDreLineValue(row, [3, 4, 5, 2]);
      const percent = readDreLinePercent(row, [5, 4]);
      if (targetGroup) {
        targetGroup.total = createDreLine(groupLabel, value, percent, rowNumber);
      }
      currentGroup = undefined;
      continue;
    }

    if (!groupLabel && itemLabel && normalizeText(itemLabel).startsWith("TOTAL ") && findLastDreGroup(currentSection)) {
      const targetGroup = findLastDreGroup(currentSection);
      const value = readDreLineValue(row, [3, 4, 5, 2]);
      const percent = readDreLinePercent(row, [5, 4]);
      if (targetGroup) {
        targetGroup.total = createDreLine(itemLabel, value, percent, rowNumber);
      }
      currentGroup = undefined;
      continue;
    }

    if (groupLabel && itemLabel && !hasCellValue(row[3]) && hasCellValue(row[2])) {
      currentGroup = ensureGroup(currentSection, groupLabel);
      const value = readDreLineValue(row, [4, 5, 3, 2]);
      const percent = readDreLinePercent(row, [5, 4]);
      currentGroup.lines.push(createDreLine(itemLabel, value, percent, rowNumber));
      continue;
    }

    if (groupLabel) {
      currentGroup = ensureGroup(currentSection, groupLabel);
    }

    if (detailLabel && hasAlphabeticText(detailLabel) && hasNumericText(row[4]) && currentGroup) {
      const value = readDreLineValue(row, [4]);
      const percent = readDreLinePercent(row, [5]);

      if (normalizeText(detailLabel).startsWith("TOTAL ")) {
        currentGroup.total = createDreLine(detailLabel, value, percent, rowNumber);
        currentGroup = undefined;
        continue;
      }

      currentGroup.lines.push(createDreLine(detailLabel, value, percent, rowNumber));
      continue;
    }

    if (itemLabel && currentGroup) {
      const value = readDreLineValue(row, [3, 4]);
      const percent = readDreLinePercent(row, [5, 4]);
      currentGroup.lines.push(createDreLine(itemLabel, value, percent, rowNumber));
      continue;
    }

    if (groupLabel && currentGroup && hasCellValue(row[2])) {
      const value = readDreLineValue(row, [4, 5, 3, 2]);
      const percent = readDreLinePercent(row, [5, 4]);
      currentGroup.lines.push(createDreLine(groupLabel, value, percent, rowNumber));
    }
  }

  return {
    sheetName: firstSheet,
    analysisType: analysisType || undefined,
    restaurantName: restaurantName || undefined,
    reportTitle: reportTitle || undefined,
    analysisTitle: analysisTitle || undefined,
    period,
    sections: sections.filter((section) => section.groups.length > 0 || section.total),
    summary
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
