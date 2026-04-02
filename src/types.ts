export type RawRow = Record<string, string | number | boolean | null | undefined>;

export type SalesImportRow = {
  codigo: string;
  produto: string;
  qte: number | string;
  total: number | string;
  grupo: string;
  subgrupo: string;
};

export type SalesReportPeriod = {
  rawLabel: string;
  startDate?: string;
  endDate?: string;
  displayLabel: string;
  periodKey: string;
  periodLabel: string;
  month?: number;
  year?: number;
};

export type SalesTotalRow = {
  level: "group" | "subgroup" | "general";
  label: string;
  group: string;
  subgroup: string;
  quantity: number;
  revenue: number;
};

export type SalesImportData = {
  items: SalesImportRow[];
  totals: SalesTotalRow[];
  reportPeriod?: SalesReportPeriod;
  headerValues: string[];
};

export type ImportValidation = {
  kind: "sales" | "recipes";
  fileName: string;
  missingColumns: string[];
  availableColumns: string[];
};

export type TotalComparison = {
  officialRevenue: number;
  parsedRevenue: number;
  revenueDifference: number;
  officialQuantity: number;
  parsedQuantity: number;
  quantityDifference: number;
};

export type DashboardIssue = {
  id: string;
  tone: "info" | "warning" | "danger";
  title: string;
  description: string;
  count?: number;
};

export type SalesRow = {
  code: string;
  itemName: string;
  group: string;
  subgroup: string;
  quantity: number;
  revenue: number;
};

export type RecipeRow = {
  code: string;
  itemName: string;
  place?: string;
  cost: number;
  salePrice?: number;
  cmvPercent?: number;
  isPromotional: boolean;
  group: string;
  subgroup: string;
};

export type ProductSummary = {
  code: string;
  itemName: string;
  group: string;
  subgroup: string;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  cmvPercent: number;
  matchedRecipe: boolean;
  isPromotional: boolean;
};

export type GroupSummary = {
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  cmvPercent: number;
  promotionalCount: number;
};

export type DashboardData = {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  totalQuantity: number;
  averageCMV: number;
  coveragePercent: number;
  unmatchedItems: string[];
  products: ProductSummary[];
  groups: GroupSummary[];
  subgroups: GroupSummary[];
  importedSalesTotals: SalesTotalRow[];
  promotionalProducts: ProductSummary[];
  reportPeriod?: SalesReportPeriod;
  totalComparison?: TotalComparison;
  issues: DashboardIssue[];
  productsWithoutGroup: ProductSummary[];
  productsWithoutSubgroup: ProductSummary[];
  duplicateRecipeCodes: string[];
};

export type PeriodDashboard = {
  key: string;
  label: string;
  data: DashboardData;
};

export type AuthSession = {
  userId: string;
  restaurantId: string;
  restaurantName: string;
  email: string;
  authMode: "local" | "supabase";
  profilePhotoUrl?: string;
};

export type UploadFeedbackItem = {
  id: string;
  kind: "sales" | "recipes";
  fileName: string;
  status: "pending" | "success" | "error";
  detail?: string;
};

export type PersistedWorkspace = {
  locale: "pt" | "es" | "en";
  state: {
    salesFileNames?: string[];
    recipeFileName?: string;
    data?: DashboardData;
    periodDashboards?: PeriodDashboard[];
    validations?: ImportValidation[];
    recipeBase?: RecipeRow[];
    duplicateRecipeCodes?: string[];
    error?: string;
    processing?: boolean;
  };
  uploadFeedback: UploadFeedbackItem[];
  selectedPeriod: string;
  selectedView: string;
};
