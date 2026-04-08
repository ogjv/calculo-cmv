import type {
  DashboardData,
  DashboardIssue,
  GroupSummary,
  ProductSummary,
  RawRow,
  RecipeRow,
  SalesImportRow,
  SalesReportPeriod,
  SalesRow,
  SalesTotalRow,
  TotalComparison
} from "../types";

const normalizeKey = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeHeader = (value: string) => normalizeKey(value).replace(/[^a-z0-9]+/g, "");
const normalizeCode = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^(\d+)[.,]0+$/, "$1");
const normalizeItemName = (value: unknown) => normalizeKey(value).replace(/[^a-z0-9]+/g, "");
const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const parseLocaleNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const sanitized = trimmed.replace(/[R$\s%]/g, "");
  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const normalized = sanitized.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
    return Number(normalized) || 0;
  }

  if (lastComma >= 0) {
    return Number(sanitized.replace(/\./g, "").replace(",", ".")) || 0;
  }

  return Number(sanitized) || 0;
};

const moneyFromUnknown = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? roundToTwo(value) : 0;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return 0;
  }

  const parsed = parseLocaleNumber(text);
  return Number.isFinite(parsed) ? roundToTwo(parsed) : 0;
};

const percentFromUnknown = (value: unknown) => {
  const parsed = moneyFromUnknown(value);
  if (!parsed) {
    return 0;
  }

  return roundToTwo(parsed <= 1 ? parsed * 100 : parsed);
};

const stringFromUnknown = (value: unknown) => String(value ?? "").trim();

const getField = (row: RawRow, aliases: string[]) => {
  const entries = Object.entries(row);
  for (const [key, value] of entries) {
    const normalized = normalizeHeader(key);
    if (aliases.includes(normalized)) {
      return value;
    }
  }
  return "";
};

export const mapSalesRows = (rows: Array<RawRow | SalesImportRow>): SalesRow[] =>
  [...rows
    .map((row) => ({
      code: normalizeCode(getField(row, ["codigo", "cod"])),
      itemName: stringFromUnknown(
        getField(row, ["produto", "item", "produtonome", "descricao", "itemnome", "nomedoproduto", "nome", "nomeitem"])
      ),
      group: stringFromUnknown(getField(row, ["grupo", "categoria", "departamento"])) || "Sem grupo",
      subgroup: stringFromUnknown(getField(row, ["subgrupo", "subcategoria", "familia"])) || "Sem subgrupo",
      quantity: moneyFromUnknown(getField(row, ["qte", "quantidade", "qtd", "qtde", "itens", "volume"])),
      revenue: moneyFromUnknown(
        getField(row, ["valor", "valortotal", "faturamento", "receita", "vendatotal", "total"])
      )
    }))
    .filter((row) => row.code && row.itemName && (row.quantity > 0 || row.revenue > 0))
    .reduce((map, row) => {
      const key = row.code;
      const current = map.get(key) ?? { ...row };
      if (map.has(key)) {
        current.quantity += row.quantity;
        current.revenue += row.revenue;
      }
      map.set(key, current);
      return map;
    }, new Map<string, SalesRow>()).values()];

export const mapRecipeRows = (rows: RawRow[]): RecipeRow[] =>
  rows
    .map((row) => {
      const salePrice =
        moneyFromUnknown(getField(row, ["precovenda", "preco", "valorvenda", "ticketmedio"])) || undefined;
      const cmvPercent =
        percentFromUnknown(getField(row, ["cmvpercentual", "percentualcmv", "cmvperc", "perc_cmv", "cmv"])) || undefined;
      const directCost = moneyFromUnknown(
        getField(row, ["custo", "custoteorico", "custounitario", "customedio"])
      );
      const derivedCost = salePrice && cmvPercent ? roundToTwo(salePrice * (cmvPercent / 100)) : 0;

      return {
        code: normalizeCode(getField(row, ["codigo", "cod"])),
        itemName: stringFromUnknown(
          getField(row, ["produtodocardapio", "produto", "item", "produtonome", "descricao", "itemnome", "nomedoproduto", "nome", "nomeitem"])
        ),
        place: stringFromUnknown(getField(row, ["praca", "praça"])) || undefined,
        cost: directCost || derivedCost,
        salePrice,
        cmvPercent,
        isPromotional: Boolean(salePrice !== undefined && salePrice >= 0 && salePrice <= 1),
        group: stringFromUnknown(getField(row, ["grupo", "categoria", "departamento"])) || "Sem grupo",
        subgroup: stringFromUnknown(getField(row, ["subgrupo", "subcategoria", "familia"])) || "Sem subgrupo"
      };
    })
    .filter((row) => row.code && row.itemName && row.cost > 0);

const accumulateGroups = (
  products: ProductSummary[],
  selector: (product: ProductSummary) => string
): GroupSummary[] => {
  const map = new Map<string, GroupSummary>();

  for (const product of products) {
    const key = selector(product) || "Sem classificacao";
    const current = map.get(key) ?? {
      name: key,
      quantity: 0,
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      cmvPercent: 0,
      promotionalCount: 0
    };

    current.quantity += product.quantity;
    current.revenue += product.revenue;
    current.cost += product.cost;
    current.grossProfit += product.grossProfit;
    if (product.isPromotional) {
      current.promotionalCount += 1;
    }
    map.set(key, current);
  }

  const summaries = [...map.values()];

  for (const summary of summaries) {
    const eligibleProducts = products.filter(
      (item) => selector(item) === summary.name && item.matchedRecipe && !item.isPromotional && item.revenue > 0
    );
    const eligibleRevenue = eligibleProducts.reduce((sum, item) => sum + item.revenue, 0);
    const eligibleCost = eligibleProducts.reduce((sum, item) => sum + item.cost, 0);
    summary.cmvPercent = eligibleRevenue > 0 ? roundToTwo((eligibleCost / eligibleRevenue) * 100) : 0;
  }

  return summaries.sort((a, b) => b.revenue - a.revenue);
};

const summarizeProducts = (
  products: ProductSummary[],
  importedSalesTotals: SalesTotalRow[] = [],
  reportPeriod?: SalesReportPeriod,
  duplicateRecipeCodes: string[] = []
): Omit<DashboardData, "reportPeriod"> & { reportPeriod?: SalesReportPeriod } => {
  const totalRevenue = products.reduce((sum, item) => sum + item.revenue, 0);
  const totalCost = products.reduce((sum, item) => sum + item.cost, 0);
  const totalQuantity = products.reduce((sum, item) => sum + item.quantity, 0);
  const unmatchedItems = products.filter((item) => !item.matchedRecipe).map((item) => item.itemName);
  const matchedCount = products.length - unmatchedItems.length;
  const promotionalProducts = products.filter((item) => item.isPromotional);
  const productsWithoutGroup = products.filter((item) => !item.group || item.group === "Sem grupo");
  const productsWithoutSubgroup = products.filter((item) => !item.subgroup || item.subgroup === "Sem subgrupo");
  const eligibleForCMV = products.filter((item) => item.matchedRecipe && !item.isPromotional && item.revenue > 0);
  const eligibleRevenue = eligibleForCMV.reduce((sum, item) => sum + item.revenue, 0);
  const eligibleCost = eligibleForCMV.reduce((sum, item) => sum + item.cost, 0);
  const officialGeneralTotals = importedSalesTotals.filter((item) => item.level === "general");
  const officialRevenue = officialGeneralTotals.reduce((sum, item) => sum + item.revenue, 0);
  const officialQuantity = officialGeneralTotals.reduce((sum, item) => sum + item.quantity, 0);
  const totalComparison: TotalComparison | undefined = officialGeneralTotals.length
    ? {
        officialRevenue,
        parsedRevenue: totalRevenue,
        revenueDifference: roundToTwo(totalRevenue - officialRevenue),
        officialQuantity,
        parsedQuantity: roundToTwo(totalQuantity),
        quantityDifference: roundToTwo(totalQuantity - officialQuantity)
      }
    : undefined;
  const issues: DashboardIssue[] = [];

  if (duplicateRecipeCodes.length > 0) {
    issues.push({
      id: "duplicate-recipe-codes",
      tone: "danger",
      title: "Códigos vinculados a itens diferentes",
      description: "Há códigos de ficha técnica sendo usados por mais de um item de cardápio, o que pode distorcer o cruzamento.",
      count: duplicateRecipeCodes.length,
      details: duplicateRecipeCodes.slice(0, 10)
    });
  }

  if (productsWithoutGroup.length > 0) {
    issues.push({
      id: "missing-group",
      tone: "info",
      title: "Produtos sem grupo",
      description: "Alguns itens foram consolidados sem grupo identificado.",
      count: productsWithoutGroup.length
    });
  }

  if (productsWithoutSubgroup.length > 0) {
    issues.push({
      id: "missing-subgroup",
      tone: "info",
      title: "Produtos sem subgrupo",
      description: "Alguns itens ficaram sem subgrupo durante a leitura do relatório.",
      count: productsWithoutSubgroup.length
    });
  }

  return {
    totalRevenue,
    totalCost,
    grossProfit: totalRevenue - totalCost,
    totalQuantity,
    averageCMV: eligibleRevenue > 0 ? roundToTwo((eligibleCost / eligibleRevenue) * 100) : 0,
    coveragePercent: products.length > 0 ? (matchedCount / products.length) * 100 : 0,
    unmatchedItems,
    products,
    groups: accumulateGroups(products, (product) => product.group),
    subgroups: accumulateGroups(products, (product) => product.subgroup),
    importedSalesTotals,
    promotionalProducts,
    reportPeriod,
    totalComparison,
    issues,
    productsWithoutGroup,
    productsWithoutSubgroup,
    duplicateRecipeCodes
  };
};

export const buildDashboardData = (
  sales: SalesRow[],
  recipes: RecipeRow[],
  importedSalesTotals: SalesTotalRow[] = [],
  reportPeriod?: SalesReportPeriod,
  duplicateRecipeCodes: string[] = []
): DashboardData => {
  const recipeMap = new Map(recipes.map((recipe) => [recipe.code, recipe]));
  const recipeNameMap = new Map<string, RecipeRow>();

  for (const recipe of recipes) {
    const normalizedItemName = normalizeItemName(recipe.itemName);
    if (!normalizedItemName || recipeNameMap.has(normalizedItemName)) {
      continue;
    }

    recipeNameMap.set(normalizedItemName, recipe);
  }

  const products = sales
    .map<ProductSummary>((sale) => {
      const recipe = recipeMap.get(sale.code) ?? recipeNameMap.get(normalizeItemName(sale.itemName));
      const unitCost = recipe?.cost ?? 0;
      const totalCost = roundToTwo(unitCost * sale.quantity);
      const grossProfit = roundToTwo(sale.revenue - totalCost);
      const realizedCmvPercent = sale.revenue > 0 ? roundToTwo((totalCost / sale.revenue) * 100) : 0;
      const theoreticalCmvPercent =
        recipe?.cmvPercent ??
        (recipe?.salePrice && recipe.salePrice > 0 ? roundToTwo((unitCost / recipe.salePrice) * 100) : 0);

      return {
        code: sale.code,
        itemName: sale.itemName,
        group: sale.group || recipe?.group || "Sem grupo",
        subgroup: sale.subgroup || recipe?.subgroup || "Sem subgrupo",
        quantity: sale.quantity,
        revenue: sale.revenue,
        cost: totalCost,
        grossProfit,
        cmvPercent: theoreticalCmvPercent || realizedCmvPercent,
        matchedRecipe: Boolean(recipe),
        isPromotional: Boolean(recipe?.isPromotional)
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return summarizeProducts(products, importedSalesTotals, reportPeriod, duplicateRecipeCodes);
};

export const buildDashboardSlice = (
  source: DashboardData,
  products: ProductSummary[],
  importedSalesTotals: SalesTotalRow[] = source.importedSalesTotals,
  reportPeriod: SalesReportPeriod | undefined = source.reportPeriod
): DashboardData => summarizeProducts(products, importedSalesTotals, reportPeriod, source.duplicateRecipeCodes);

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);

export const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export const formatPercent = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value) + "%";
