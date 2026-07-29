import { useEffect, useMemo, useState } from "react";
import type {
  DrePeriodData,
  ImportValidation,
  PeriodDashboard,
  PersistedWorkspace,
  ProductSummary,
  RecipeRow,
  UploadFeedbackItem
} from "../types";
import { buildDashboardData, buildDashboardSlice, mapRecipeRows, mapSalesRows } from "../utils/cmv";
import { getDrePeriodKey, getDrePeriodLabel, getDreRevenueGroups, getDreRevenueValue } from "../components/drePanels";
import { parseDreSpreadsheetFile, parseGoodsEntrySpreadsheetFile, parseSalesSpreadsheetFile, parseSpreadsheetFile } from "../utils/file";

export type UploadState = PersistedWorkspace["state"];

const TOTAL_VIEW = "__TOTAL__";
const TOTAL_PERIOD = "__ALL_PERIODS__";
const DEFAULT_DRE_PERIOD = "__LATEST_DRE__";

const getPeriodLabel = (dashboard: PeriodDashboard) => dashboard.label || dashboard.data.reportPeriod?.periodLabel || dashboard.data.reportPeriod?.displayLabel || "Período";

const dedupeFiles = (files: File[]) => {
  const map = new Map<string, File>();
  for (const file of files) {
    map.set(`${file.name}-${file.size}-${file.lastModified}`, file);
  }
  return [...map.values()];
};

const productsToSalesRows = (products: ProductSummary[]) =>
  mapSalesRows(
    products.map((product) => ({
      codigo: product.code,
      produto: product.itemName,
      qte: product.quantity,
      total: product.revenue,
      grupo: product.group,
      subgrupo: product.subgroup
    }))
  );

const buildConsolidatedDashboard = (periods: PeriodDashboard[]) => {
  if (periods.length === 0) {
    return undefined;
  }

  const consolidatedProducts = periods.flatMap((periodDashboard) => periodDashboard.data.products);
  const consolidatedTotals = periods.flatMap((periodDashboard) => periodDashboard.data.importedSalesTotals);
  const consolidatedPeriodLabel =
    periods.length === 1
      ? periods[0].data.reportPeriod
      : {
          rawLabel: periods.map((periodDashboard) => getPeriodLabel(periodDashboard)).join(" • "),
          displayLabel: "Base consolidada",
          periodKey: TOTAL_PERIOD,
          periodLabel: "TOTAL"
        };

  return buildDashboardSlice(periods[0].data, consolidatedProducts, consolidatedTotals, consolidatedPeriodLabel);
};

const mergePeriodDashboards = (
  currentPeriods: PeriodDashboard[],
  incomingPeriods: PeriodDashboard[],
  recipes: RecipeRow[],
  duplicateRecipeCodes: string[]
) =>
  [...incomingPeriods
    .reduce((map, periodDashboard) => {
      const current = map.get(periodDashboard.key);
      if (!current) {
        map.set(periodDashboard.key, periodDashboard);
        return map;
      }

      const mergedSales = productsToSalesRows([...current.data.products, ...periodDashboard.data.products]);

      map.set(periodDashboard.key, {
        key: periodDashboard.key,
        label: periodDashboard.label,
        data: buildDashboardData(
          mergedSales,
          recipes,
          [...current.data.importedSalesTotals, ...periodDashboard.data.importedSalesTotals],
          current.data.reportPeriod ?? periodDashboard.data.reportPeriod,
          duplicateRecipeCodes
        )
      });

      return map;
    }, new Map<string, PeriodDashboard>(currentPeriods.map((period) => [period.key, period])))
    .values()].sort((a, b) => {
    const yearA = a.data.reportPeriod?.year ?? 0;
    const yearB = b.data.reportPeriod?.year ?? 0;
    const monthA = a.data.reportPeriod?.month ?? 0;
    const monthB = b.data.reportPeriod?.month ?? 0;
    return yearA !== yearB ? yearA - yearB : monthA - monthB;
  });

const normalizeLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export const buildImportErrorMessage = (fileName: string, detail: string, hint = "Verifique o formato, as colunas e os dados e tente novamente.") => {
  const normalizedFileName = fileName?.trim() || "arquivo";
  return `O arquivo "${normalizedFileName}" não está no padrão esperado pelo sistema. ${detail} ${hint}`;
};

const validateColumns = (
  kind: "sales" | "recipes",
  fileName: string,
  availableColumns: string[],
  expectedColumns: string[]
): ImportValidation => {
  const normalizedAvailable = availableColumns.map((header) => normalizeLabel(header));
  return {
    kind,
    fileName,
    availableColumns,
    missingColumns: expectedColumns.filter((column) => !normalizedAvailable.includes(normalizeLabel(column)))
  };
};

const getDuplicateCodes = (recipes: RecipeRow[]) => {
  const signaturesByCode = new Map<string, Set<string>>();
  const normalizeComparableCode = (value: string) =>
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/^(\d+)[.,]0+$/, "$1");

  for (const recipe of recipes) {
    const normalizedCode = normalizeComparableCode(recipe.code ?? "");
    if (!normalizedCode || !recipe.itemName.trim()) {
      continue;
    }

    const signature = JSON.stringify({
      place: (recipe.place ?? "").trim().toUpperCase(),
      cost: Number(recipe.cost.toFixed(4)),
      salePrice: recipe.salePrice ? Number(recipe.salePrice.toFixed(4)) : 0,
      cmvPercent: recipe.cmvPercent ? Number(recipe.cmvPercent.toFixed(4)) : 0,
      isPromotional: recipe.isPromotional,
      group: recipe.group.trim().toUpperCase(),
      subgroup: recipe.subgroup.trim().toUpperCase()
    });

    const current = signaturesByCode.get(normalizedCode) ?? new Set<string>();
    current.add(signature);
    signaturesByCode.set(normalizedCode, current);
  }

  return [...signaturesByCode.entries()]
    .filter(([, signatures]) => signatures.size > 1)
    .map(([code]) => code);
};

export function useOperationalData() {
  const [salesFiles, setSalesFiles] = useState<File[]>([]);
  const [, setRecipeFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({});
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedbackItem[]>([]);
  const [drePeriods, setDrePeriods] = useState<DrePeriodData[]>([]);
  const [selectedDrePeriod, setSelectedDrePeriod] = useState<string>(DEFAULT_DRE_PERIOD);
  const [dreError, setDreError] = useState<string>();
  const [dreProcessing, setDreProcessing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(TOTAL_PERIOD);
  const [selectedView, setSelectedView] = useState<string>(TOTAL_VIEW);

  const periodDashboards = useMemo(() => state.periodDashboards ?? [], [state.periodDashboards]);
  const consolidatedPeriodDashboard = useMemo(
    () => (!state.data && periodDashboards.length > 0 ? buildConsolidatedDashboard(periodDashboards) : undefined),
    [periodDashboards, state.data]
  );
  const dashboard =
    selectedPeriod === TOTAL_PERIOD
      ? state.data ?? consolidatedPeriodDashboard
      : periodDashboards.find((periodDashboard) => periodDashboard.key === selectedPeriod)?.data;
  const activeDrePeriod =
    drePeriods.find((period) => period.key === selectedDrePeriod) ??
    drePeriods[drePeriods.length - 1];
  const dreData = activeDrePeriod?.data;
  const goodsEntryData = state.goodsEntryData;
  const goodsEntryError = state.goodsEntryError;
  const goodsEntryProcessing = state.goodsEntryProcessing ?? false;
  const hasDashboardData = Boolean(dashboard);
  const hasSalesFile = salesFiles.length > 0 || (state.periodDashboards?.length ?? 0) > 0;
  const hasGoodsEntryData = Boolean(goodsEntryData?.entries.length);

  useEffect(() => {
    if (!state.recipeBase?.length) {
      return;
    }

    const nextDuplicateCodes = getDuplicateCodes(state.recipeBase);
    const currentDuplicateCodes = state.duplicateRecipeCodes ?? [];
    if (JSON.stringify(nextDuplicateCodes) === JSON.stringify(currentDuplicateCodes)) {
      return;
    }

    setState((current) => ({
      ...current,
      duplicateRecipeCodes: nextDuplicateCodes,
      data: current.data
        ? {
            ...current.data,
            duplicateRecipeCodes: nextDuplicateCodes,
            issues: current.data.issues.filter((issue) => issue.id !== "duplicate-recipe-codes")
          }
        : current.data,
      periodDashboards: current.periodDashboards?.map((period) => ({
        ...period,
        data: {
          ...period.data,
          duplicateRecipeCodes: nextDuplicateCodes,
          issues: period.data.issues.filter((issue) => issue.id !== "duplicate-recipe-codes")
        }
      }))
    }));
  }, [state.recipeBase, state.duplicateRecipeCodes]);

  useEffect(() => {
    if (selectedView !== TOTAL_VIEW && !dashboard?.groups.some((group) => group.name === selectedView)) {
      setSelectedView(TOTAL_VIEW);
    }
  }, [dashboard, selectedView]);

  useEffect(() => {
    if (selectedPeriod !== TOTAL_PERIOD && !periodDashboards.some((periodDashboard) => periodDashboard.key === selectedPeriod)) {
      setSelectedPeriod(TOTAL_PERIOD);
    }
  }, [periodDashboards, selectedPeriod]);

  const createPeriodDashboardsFromImports = (
    fileNames: string[],
    recipes: RecipeRow[],
    duplicateRecipeCodes: string[],
    salesImports: Awaited<ReturnType<typeof parseSalesSpreadsheetFile>>[]
  ) =>
    salesImports
      .map((salesImport, index) => {
        const sales = mapSalesRows(salesImport.items);
        if (sales.length === 0) {
          return null;
        }

        const fallbackKey = `arquivo-${index + 1}`;
        return {
          key: salesImport.reportPeriod?.periodKey ?? fallbackKey,
          label: salesImport.reportPeriod?.periodLabel ?? salesImport.reportPeriod?.displayLabel ?? fileNames[index] ?? fallbackKey,
          data: buildDashboardData(sales, recipes, salesImport.totals, salesImport.reportPeriod, duplicateRecipeCodes)
        };
      })
      .filter((dashboardItem): dashboardItem is PeriodDashboard => Boolean(dashboardItem));

  const applyPeriodDashboards = (
    nextPeriods: PeriodDashboard[],
    options?: {
      recipeBase?: RecipeRow[];
      duplicateRecipeCodes?: string[];
      recipeFileName?: string;
      validations?: ImportValidation[];
      error?: string;
    }
  ) => {
    const nextData = buildConsolidatedDashboard(nextPeriods);

    setState((current) => ({
      ...current,
      data: nextData,
      periodDashboards: nextPeriods,
      salesFileNames: undefined,
      recipeFileName: undefined,
      recipeBase: options?.recipeBase ?? current.recipeBase,
      duplicateRecipeCodes: options?.duplicateRecipeCodes ?? current.duplicateRecipeCodes,
      validations: options?.validations ?? current.validations,
      error: options?.error,
      processing: false
    }));
    setSelectedPeriod(TOTAL_PERIOD);
    setSelectedView(TOTAL_VIEW);
  };

  const handleSalesUpload = async (files: File[]) => {
    const nextSalesFiles = dedupeFiles([...salesFiles, ...files]);
    setSalesFiles(nextSalesFiles);
    setState((current) => ({
      ...current,
      salesFileNames: nextSalesFiles.map((file) => file.name),
      error: undefined
    }));

    if (!state.recipeBase?.length) {
      return;
    }

    const recipes = state.recipeBase;
    const duplicateRecipeCodes = state.duplicateRecipeCodes ?? getDuplicateCodes(recipes);
    let validations = state.validations?.filter((item) => item.kind === "recipes") ?? [];

    try {
      setUploadFeedback(nextSalesFiles.map((file) => ({ id: `sales-${file.name}`, kind: "sales", fileName: file.name, status: "pending" })));
      setState((current) => ({ ...current, processing: true, error: undefined }));

      const salesImports = await Promise.all(nextSalesFiles.map((file) => parseSalesSpreadsheetFile(file)));
      validations = [
        ...validations,
        ...salesImports.map((salesImport, index) =>
          validateColumns("sales", nextSalesFiles[index]?.name ?? `vendas-${index + 1}`, salesImport.headerValues, ["CÓDIGO", "PRODUTO", "QTE", "TOTAL"])
        )
      ];

      const invalidValidation = validations.find((validation) => validation.missingColumns.length > 0);
      if (invalidValidation) {
        throw new Error(
          buildImportErrorMessage(
            invalidValidation.fileName,
            `Faltam colunas obrigatórias: ${invalidValidation.missingColumns.join(", ")}.`
          )
        );
      }

      const incomingPeriods = createPeriodDashboardsFromImports(nextSalesFiles.map((file) => file.name), recipes, duplicateRecipeCodes, salesImports);
      if (incomingPeriods.length === 0) {
        throw new Error(
          buildImportErrorMessage(
            nextSalesFiles[0]?.name ?? "vendas",
            "Não foram encontradas linhas válidas para processar este arquivo de vendas."
          )
        );
      }

      const mergedPeriods = mergePeriodDashboards(periodDashboards, incomingPeriods, recipes, duplicateRecipeCodes);
      setUploadFeedback(nextSalesFiles.map((file) => ({ id: `sales-${file.name}`, kind: "sales", fileName: file.name, status: "success" })));
      applyPeriodDashboards(mergedPeriods, {
        recipeBase: recipes,
        duplicateRecipeCodes,
        validations
      });
      setSalesFiles([]);
    } catch (error) {
      setUploadFeedback(
        nextSalesFiles.map((file) => ({
          id: `sales-${file.name}`,
          kind: "sales",
          fileName: file.name,
          status: "error",
          detail: error instanceof Error ? error.message : "Falha ao processar arquivo."
        }))
      );
      setState((current) => ({
        ...current,
        validations,
        error: error instanceof Error ? error.message : "Falha ao processar os arquivos.",
        processing: false
      }));
    }
  };

  const handleRecipeUpload = async (file: File) => {
    if (salesFiles.length === 0 && periodDashboards.length === 0) {
      setState((current) => ({
        ...current,
        error: "Envie primeiro o arquivo de vendas."
      }));
      return;
    }

    setRecipeFile(file);
    let validations: ImportValidation[] = [];

    try {
      setUploadFeedback([
        ...(salesFiles.length > 0 ? salesFiles.map((salesFile) => ({ id: `sales-${salesFile.name}`, kind: "sales" as const, fileName: salesFile.name, status: "pending" as const })) : []),
        { id: `recipes-${file.name}`, kind: "recipes", fileName: file.name, status: "pending" }
      ]);
      setState((current) => ({
        ...current,
        recipeFileName: file.name,
        processing: true,
        error: undefined
      }));

      const recipesRaw = await parseSpreadsheetFile(file);
      const recipes = mapRecipeRows(recipesRaw);
      const recipeHeaders = recipesRaw[0] ? Object.keys(recipesRaw[0]) : [];
      validations = [
        validateColumns("recipes", file.name, recipeHeaders, ["CÓDIGO", "PRODUTO DO CARDÁPIO", "PREÇO", "CUSTO", "CMV"])
      ];

      const invalidRecipeValidation = validations.find((validation) => validation.missingColumns.length > 0);
      if (invalidRecipeValidation) {
        throw new Error(
          buildImportErrorMessage(
            invalidRecipeValidation.fileName,
            `Faltam colunas obrigatórias: ${invalidRecipeValidation.missingColumns.join(", ")}.`
          )
        );
      }

      if (recipes.length === 0) {
        throw new Error(
          buildImportErrorMessage(file.name, "Não foram encontradas linhas válidas para processar este arquivo de fichas técnicas.")
        );
      }

      const duplicateRecipeCodes = getDuplicateCodes(recipes);
      const rebuiltPeriods = periodDashboards.map((period) => ({
        key: period.key,
        label: period.label,
        data: buildDashboardData(
          productsToSalesRows(period.data.products),
          recipes,
          period.data.importedSalesTotals,
          period.data.reportPeriod,
          duplicateRecipeCodes
        )
      }));

      let incomingPeriods: PeriodDashboard[] = [];
      if (salesFiles.length > 0) {
        const salesImports = await Promise.all(salesFiles.map((salesFile) => parseSalesSpreadsheetFile(salesFile)));
        const salesValidations = salesImports.map((salesImport, index) =>
          validateColumns("sales", salesFiles[index]?.name ?? `vendas-${index + 1}`, salesImport.headerValues, ["CÓDIGO", "PRODUTO", "QTE", "TOTAL"])
        );
        validations = [...salesValidations, ...validations];

        const invalidSalesValidation = validations.find((validation) => validation.missingColumns.length > 0);
        if (invalidSalesValidation) {
          throw new Error(
            buildImportErrorMessage(
              invalidSalesValidation.fileName,
              `Faltam colunas obrigatórias: ${invalidSalesValidation.missingColumns.join(", ")}.`
            )
          );
        }

        incomingPeriods = createPeriodDashboardsFromImports(salesFiles.map((salesFile) => salesFile.name), recipes, duplicateRecipeCodes, salesImports);
      }

      const mergedPeriods = mergePeriodDashboards(rebuiltPeriods, incomingPeriods, recipes, duplicateRecipeCodes);
      if (mergedPeriods.length === 0) {
        throw new Error(
          buildImportErrorMessage(file.name, "Não foi possível montar o dashboard com os dados carregados. Verifique se o arquivo de vendas está compatível com as fichas técnicas.")
        );
      }

      setUploadFeedback([
        ...(salesFiles.length > 0 ? salesFiles.map((salesFile) => ({ id: `sales-${salesFile.name}`, kind: "sales" as const, fileName: salesFile.name, status: "success" as const })) : []),
        { id: `recipes-${file.name}`, kind: "recipes", fileName: file.name, status: "success" }
      ]);

      applyPeriodDashboards(mergedPeriods, {
        recipeBase: recipes,
        duplicateRecipeCodes,
        recipeFileName: file.name,
        validations
      });
      setSalesFiles([]);
      setRecipeFile(null);
    } catch (error) {
      setUploadFeedback([
        ...(salesFiles.length > 0
          ? salesFiles.map((salesFile) => ({
              id: `sales-${salesFile.name}`,
              kind: "sales" as const,
              fileName: salesFile.name,
              status: "error" as const,
              detail: error instanceof Error ? error.message : "Falha ao processar arquivo."
            }))
          : []),
        {
          id: `recipes-${file.name}`,
          kind: "recipes",
          fileName: file.name,
          status: "error",
          detail: error instanceof Error ? error.message : "Falha ao processar arquivo."
        }
      ]);
      setState((current) => ({
        ...current,
        recipeFileName: file.name,
        validations,
        error: error instanceof Error ? error.message : "Falha ao processar os arquivos.",
        processing: false
      }));
    }
  };

  const handleUpload = (kind: "sales" | "recipes", files: File[]) => {
    if (files.length === 0) {
      return;
    }

    if (kind === "sales") {
      void handleSalesUpload(files);
      return;
    }

    void handleRecipeUpload(files[0]);
  };

  const handleDreImport = async (file: File) => {
    try {
      setDreProcessing(true);
      setDreError(undefined);
      const nextDreData = await parseDreSpreadsheetFile(file);

      if (nextDreData.sections.length === 0 && nextDreData.summary.length === 0) {
        throw new Error(
          buildImportErrorMessage(file.name, "Não foi possível identificar seções de DRE neste arquivo.")
        );
      }

      if (getDreRevenueValue(nextDreData) > 0 && getDreRevenueGroups(nextDreData).length === 0) {
        throw new Error(
          buildImportErrorMessage(
            file.name,
            "A seção de Receitas Operacionais foi encontrada, mas nenhuma subdivisão de receita foi identificada. Verifique se os subgrupos estão na coluna B do arquivo."
          )
        );
      }

      const fallbackKey = `${file.name}-${Date.now()}`;
      const periodKey = getDrePeriodKey(nextDreData, fallbackKey);
      const periodLabel = getDrePeriodLabel(nextDreData, file.name);
      setDrePeriods((current) => {
        const nextPeriod = {
          key: periodKey,
          label: periodLabel,
          fileName: file.name,
          data: nextDreData
        };
        const withoutCurrentPeriod = current.filter((period) => period.key !== periodKey);
        return [...withoutCurrentPeriod, nextPeriod].sort((left, right) => left.key.localeCompare(right.key));
      });
      setSelectedDrePeriod(periodKey);
    } catch (error) {
      setDreError(error instanceof Error ? error.message : "Falha ao processar o arquivo de DRE.");
    } finally {
      setDreProcessing(false);
    }
  };

  const handleGoodsEntryImport = async (file: File) => {
    try {
      setState((current) => ({
        ...current,
        goodsEntryFileName: file.name,
        goodsEntryProcessing: true,
        goodsEntryError: undefined
      }));

      const nextGoodsEntryData = await parseGoodsEntrySpreadsheetFile(file);

      if (nextGoodsEntryData.entries.length === 0) {
        throw new Error(
          buildImportErrorMessage(file.name, "Não foram encontradas linhas válidas de entrada de mercadorias neste arquivo.")
        );
      }

      setState((current) => ({
        ...current,
        goodsEntryData: nextGoodsEntryData,
        goodsEntryFileName: file.name,
        goodsEntryError: undefined,
        goodsEntryProcessing: false
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        goodsEntryError: error instanceof Error ? error.message : "Falha ao processar o arquivo de entrada de mercadorias.",
        goodsEntryProcessing: false
      }));
    }
  };

  const handleClearGoodsEntry = () => {
    setState((current) => {
      const nextState = { ...current };
      delete nextState.goodsEntryData;
      delete nextState.goodsEntryFileName;
      delete nextState.goodsEntryError;
      delete nextState.goodsEntryProcessing;
      return nextState;
    });
  };

  const rebuildFromPeriods = (nextPeriods: PeriodDashboard[]) => {
    if (nextPeriods.length === 0) {
      applyPeriodDashboards([], { error: undefined });
      return;
    }

    applyPeriodDashboards(nextPeriods, { error: undefined });
  };

  const handleRemovePeriod = (periodKey: string) => {
    const targetPeriod = periodDashboards.find((period) => period.key === periodKey);
    const targetLabel = targetPeriod ? getPeriodLabel(targetPeriod) : periodKey;
    if (typeof window !== "undefined") {
      const shouldRemove = window.confirm(
        `Deseja excluir apenas o período ${targetLabel}?\n\nEssa ação remove somente os dados desse mês da análise atual e não pode ser desfeita.`
      );
      if (!shouldRemove) {
        return;
      }
    }

    rebuildFromPeriods(periodDashboards.filter((period) => period.key !== periodKey));
  };

  const handleClearAll = () => {
    setSalesFiles([]);
    setRecipeFile(null);
    setUploadFeedback([]);
    setState((current) => ({
      goodsEntryData: current.goodsEntryData,
      goodsEntryFileName: current.goodsEntryFileName,
      goodsEntryError: current.goodsEntryError,
      goodsEntryProcessing: current.goodsEntryProcessing
    }));
    setSelectedPeriod(TOTAL_PERIOD);
    setSelectedView(TOTAL_VIEW);
  };

  const handleResetFlow = () => {
    setRecipeFile(null);
    setUploadFeedback([]);
    setSalesFiles([]);
    setState((current) => ({
      ...current,
      error: undefined,
      processing: false
    }));
  };

  return {
    salesFiles,
    setSalesFiles,
    setRecipeFile,
    state,
    setState,
    uploadFeedback,
    setUploadFeedback,
    drePeriods,
    setDrePeriods,
    selectedDrePeriod,
    setSelectedDrePeriod,
    dreError,
    setDreError,
    dreProcessing,
    setDreProcessing,
    selectedPeriod,
    setSelectedPeriod,
    selectedView,
    setSelectedView,
    periodDashboards,
    dashboard,
    dreData,
    goodsEntryData,
    goodsEntryError,
    goodsEntryProcessing,
    hasDashboardData,
    hasSalesFile,
    hasGoodsEntryData,
    handleUpload,
    handleDreImport,
    handleGoodsEntryImport,
    handleClearGoodsEntry,
    handleRemovePeriod,
    handleClearAll,
    handleResetFlow
  };
}
