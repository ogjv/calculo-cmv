import { useEffect, useMemo, useState } from "react";
import { Suspense, lazy } from "react";
import { useRef } from "react";
import type { AccountInvitation, AccountMember, AuthSession, DashboardData, DrePeriodData, ImportValidation, PeriodDashboard, PersistedWorkspace, ProductSummary, RecipeRow, UploadFeedbackItem } from "./types";
import { buildDashboardData, buildDashboardSlice, mapRecipeRows, mapSalesRows } from "./utils/cmv";
import { AuthScreen, BrandMark, DashboardShellHeader, InternalNavigation, UserAvatar } from "./components/appChrome";
import { RestaurantNavigatorPanel } from "./components/dashboardPanels";
import { type DrePanelCopy, getDrePeriodKey, getDrePeriodLabel, getDreRevenueGroups, getDreRevenueValue } from "./components/drePanels";
import { DEFAULT_INVITE_FEATURE, type InviteFormState } from "./components/teamPanels";
import { parseDreSpreadsheetFile, parseSalesSpreadsheetFile, parseSpreadsheetFile } from "./utils/file";
import { createLocalRestaurantForAccount, deleteLocalRestaurantAccount, deleteLocalRestaurantFromAccount, loadRestaurantWorkspace, registerRestaurant, restoreSession, saveRestaurantWorkspace, signIn, signOut, updateLocalRestaurantProfile, updateLocalUserProfile } from "./utils/auth";
import { createAccountInvitation, createSupabaseRestaurantForCurrentUser, deleteSupabaseRestaurantAccount, deleteSupabaseRestaurantFromAccount, getSupabaseSession, hydrateSupabaseSession, loadAccountInvitations, loadAccountMembers, loadCloudWorkspace, registerRestaurantWithSupabase, removeAccountMemberAccess, revokeAccountInvitation, saveCloudWorkspace, signInWithSupabase, signOutFromSupabase, subscribeToSupabaseAuth, updateAccountMemberAccess, updateSupabaseRestaurantProfile, updateSupabaseUserProfile } from "./utils/cloudAuth";
import { isSupabaseConfigured } from "./utils/supabase";
import { LocaleContext, type Locale, translations, withLocaleFallback } from "./i18n";

type ThemeMode = "light" | "dark";

const LazyAccountSettingsPanel = lazy(() =>
  import("./components/accountPanels").then((module) => ({ default: module.AccountSettingsPanel }))
);
const LazyRestaurantManagementPanel = lazy(() =>
  import("./components/accountPanels").then((module) => ({ default: module.RestaurantManagementPanel }))
);
const LazyDreAnalysisPanel = lazy(() =>
  import("./components/drePanels").then((module) => ({ default: module.DreAnalysisPanel }))
);
const LazyDashboardPanels = lazy(() =>
  import("./components/cmvPanels").then((module) => ({ default: module.DashboardPanels }))
);
const LazyTeamPermissionsPanel = lazy(() =>
  import("./components/teamPanels").then((module) => ({ default: module.TeamPermissionsPanel }))
);

type UploadState = {
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

type ProfileFormState = {
  restaurantName: string;
  profilePhotoUrl?: string;
};

type UserProfileFormState = {
  fullName: string;
  userPhotoUrl?: string;
};

type InternalSection = "account" | "dashboard" | "dre" | "restaurants" | "team";

const TOTAL_VIEW = "__TOTAL__";
const TOTAL_PERIOD = "__ALL_PERIODS__";
const DEFAULT_DRE_PERIOD = "__LATEST_DRE__";
const ACTIVE_RESTAURANT_STORAGE_PREFIX = "grest.activeRestaurant.";
const THEME_STORAGE_KEY = "grest.theme";
const AUTH_BOOT_TIMEOUT_MS = 30000;
const AUTH_HYDRATE_TIMEOUT_MS = 15000;
const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string) =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });

const getInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return "light";
};

const getPeriodLabel = (dashboard: PeriodDashboard) => dashboard.label || dashboard.data.reportPeriod?.periodLabel || dashboard.data.reportPeriod?.displayLabel || "Per\u00edodo";


const dedupeFiles = (files: File[]) => {
  const map = new Map<string, File>();
  for (const file of files) {
    map.set(`${file.name}-${file.size}-${file.lastModified}`, file);
  }
  return [...map.values()];
};

const getPreferredRestaurant = (userId: string) => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage.getItem(`${ACTIVE_RESTAURANT_STORAGE_PREFIX}${userId}`) ?? undefined;
};

const savePreferredRestaurant = (userId: string, restaurantId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(`${ACTIVE_RESTAURANT_STORAGE_PREFIX}${userId}`, restaurantId);
};

const applyActiveRestaurant = (session: AuthSession, restaurantId?: string): AuthSession => {
  const memberships = session.memberships ?? [];
  const activeMembership =
    memberships.find((membership) => membership.restaurantId === restaurantId) ??
    memberships.find((membership) => membership.restaurantId === session.activeRestaurantId) ??
    memberships[0];

  if (!activeMembership) {
    return session;
  }

  const scopedMemberships =
    session.globalRole === "owner" || !activeMembership.accountId
      ? memberships
      : memberships.filter((membership) => membership.accountId === activeMembership.accountId);

  return {
    ...session,
    memberships: scopedMemberships,
    activeRole: activeMembership.role,
    activeRestaurantId: activeMembership.restaurantId,
    activeRestaurantName: activeMembership.restaurantName,
    activeRestaurantPhotoUrl: activeMembership.photoUrl,
    restaurantId: activeMembership.restaurantId,
    restaurantName: activeMembership.restaurantName,
    profilePhotoUrl: activeMembership.photoUrl
  };
};

const getWorkspaceSessionKey = (session?: AuthSession | null) => {
  if (!session) {
    return undefined;
  }

  const restaurantId = session.activeRestaurantId ?? session.restaurantId;
  if (!restaurantId) {
    return `${session.userId}:${session.authMode}:pending`;
  }

  return `${session.userId}:${session.authMode}:${restaurantId}`;
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

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M9 7H6.8A1.8 1.8 0 0 0 5 8.8v6.4A1.8 1.8 0 0 0 6.8 17H9" />
      <path d="M13 8.5 17 12l-4 3.5" />
      <path d="M17 12H9" />
    </svg>
  );
}


export default function App() {
  const [locale, setLocale] = useState<Locale>("pt");
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [authHydrating, setAuthHydrating] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string>();
  const [accountError, setAccountError] = useState<string>();
  const [currentSection, setCurrentSection] = useState<InternalSection>("dashboard");
  const [accountMembers, setAccountMembers] = useState<AccountMember[]>([]);
  const [accountMembersLoading, setAccountMembersLoading] = useState(false);
  const [accountInvitations, setAccountInvitations] = useState<AccountInvitation[]>([]);
  const [accountInvitationsLoading, setAccountInvitationsLoading] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string>();
  const [inviteError, setInviteError] = useState<string>();
  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    email: "",
    featureIds: [DEFAULT_INVITE_FEATURE],
    restaurantIds: []
  });
  const [userProfileForm, setUserProfileForm] = useState<UserProfileFormState>({ fullName: "" });
  const [restaurantProfileForm, setRestaurantProfileForm] = useState<ProfileFormState>({ restaurantName: "" });
  const [restaurantProfileDirty, setRestaurantProfileDirty] = useState(false);
  const [restaurantProfileRestaurantId, setRestaurantProfileRestaurantId] = useState<string>();
  const [newRestaurantName, setNewRestaurantName] = useState("");
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceRestaurantId, setWorkspaceRestaurantId] = useState<string>();
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
  const latestWorkspaceRestaurantIdRef = useRef<string>();
  const latestStateRef = useRef<UploadState>({});
  const latestUploadFeedbackRef = useRef<UploadFeedbackItem[]>([]);
  const latestDrePeriodsRef = useRef<DrePeriodData[]>([]);
  const latestWorkspaceMetaRef = useRef({
    locale: "pt" as Locale,
    selectedPeriod: TOTAL_PERIOD,
    selectedView: TOTAL_VIEW,
    selectedDrePeriod: DEFAULT_DRE_PERIOD,
    currentSection: "dashboard" as InternalSection
  });
  const t = <K extends keyof typeof translations.pt>(key: K) => withLocaleFallback<typeof translations.pt>(locale, key);
  const effectiveSession = useMemo(
    () => (session ? applyActiveRestaurant(session, getPreferredRestaurant(session.userId)) : null),
    [session]
  );
  const activeWorkspaceSession = useMemo(
    () =>
      effectiveSession
        ? {
            authMode: effectiveSession.authMode,
            restaurantId: effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId ?? ""
          }
        : null,
    [effectiveSession]
  );
  const activeWorkspaceKey = getWorkspaceSessionKey(effectiveSession);
  latestWorkspaceRestaurantIdRef.current = workspaceRestaurantId;
  latestStateRef.current = state;
  latestUploadFeedbackRef.current = uploadFeedback;
  latestDrePeriodsRef.current = drePeriods;
  latestWorkspaceMetaRef.current = {
    locale,
    selectedPeriod,
    selectedView,
    selectedDrePeriod,
    currentSection
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const hasSalesFile = salesFiles.length > 0 || (state.periodDashboards?.length ?? 0) > 0;
  const hasPersistedWorkspaceContent = (workspace?: PersistedWorkspace | null) =>
    Boolean(
      workspace &&
        (
          ((workspace.state?.periodDashboards?.length ?? 0) > 0) ||
          ((workspace.state?.recipeBase?.length ?? 0) > 0) ||
          ((workspace.state?.salesFileNames?.length ?? 0) > 0) ||
          ((workspace.drePeriods?.length ?? 0) > 0) ||
          ((workspace.uploadFeedback?.length ?? 0) > 0) ||
          workspace.state?.processing
        )
    );
  const activeRole = effectiveSession?.activeRole ?? "viewer";
  const canManageRestaurants =
    effectiveSession?.globalRole === "owner" ||
    effectiveSession?.activeAccountRole === "owner" ||
    activeRole === "owner";
  const canManageOperationalData =
    effectiveSession?.globalRole === "owner" ||
    effectiveSession?.activeAccountRole === "owner" ||
    activeRole === "owner";
  const canManageTeam = effectiveSession?.globalRole === "owner";
  const themeLabels = {
    label: String(t("theme")),
    light: String(t("themeLight")),
    dark: String(t("themeDark"))
  };
  const navigationItems = [
    { key: "dashboard" as InternalSection, label: String(t("navDashboard")) },
    { key: "dre" as InternalSection, label: String(t("navDre")) },
    ...(canManageRestaurants ? [{ key: "restaurants" as InternalSection, label: String(t("navRestaurants")) }] : []),
    ...(canManageTeam ? [{ key: "team" as InternalSection, label: String(t("navTeam")) }] : [])
  ];
  const accountPanelCopy = {
    settings: String(t("authSettings")),
    settingsText: String(t("authSettingsText")),
    close: String(t("authClose")),
    userProfile: String(t("authUserProfile")),
    userProfileText: String(t("authUserProfileText")),
    profilePhoto: String(t("authProfilePhoto")),
    uploadPhoto: String(t("authUploadPhoto")),
    fullName: String(t("authFullName")),
    email: String(t("authEmail")),
    accountStatus: String(t("authAccountStatus")),
    roleOwner: String(t("authRoleOwner")),
    roleViewer: String(t("authRoleViewer")),
    restaurantsCount: String(t("authRestaurantsCount")),
    saveProfile: String(t("authSaveProfile")),
    manageRestaurants: String(t("authManageRestaurants")),
    manageRestaurantsText: String(t("authManageRestaurantsText")),
    restaurantProfile: String(t("authRestaurantProfile")),
    restaurantProfileText: String(t("authRestaurantProfileText")),
    restaurantName: String(t("authRestaurantName")),
    activate: String(t("authActivate")),
    active: String(t("authActive")),
    deleteRestaurant: String(t("authDeleteRestaurant")),
    createRestaurant: String(t("authCreateRestaurant")),
    createRestaurantText: String(t("authCreateRestaurantText")),
    createRestaurantAction: String(t("authCreateRestaurantAction")),
    dangerZone: String(t("authDangerZone")),
    deleteAccount: String(t("authDeleteAccount")),
    deleteHint: String(t("authDeleteHint")),
    processing: String(t("processing"))
  };
  const drePanelCopy: DrePanelCopy = {
    navDre: String(t("navDre")),
    dreParsedTitle: String(t("dreParsedTitle")),
    dreEmptyTitle: String(t("dreEmptyTitle")),
    dreEmptyText: String(t("dreEmptyText")),
    dreUploadTitle: String(t("dreUploadTitle")),
    dreUploadAction: String(t("dreUploadAction")),
    dreUploadHint: String(t("dreUploadHint")),
    dreProcessing: String(t("dreProcessing")),
    drePeriod: String(t("drePeriod")),
    dreSelectPeriod: String(t("dreSelectPeriod")),
    dreRevenue: String(t("dreRevenue")),
    dreOutflows: String(t("dreOutflows")),
    dreFinalBalance: String(t("dreFinalBalance")),
    dreResultMap: String(t("dreResultMap")),
    dreResultMapText: String(t("dreResultMapText")),
    dreSectionChart: String(t("dreSectionChart")),
    dreSectionChartText: String(t("dreSectionChartText")),
    dreParticipationTitle: String(t("dreParticipationTitle")),
    dreParticipationText: String(t("dreParticipationText")),
    dreStrategicTitle: String(t("dreStrategicTitle")),
    dreStrategicText: String(t("dreStrategicText")),
    dreRevenueConcentration: String(t("dreRevenueConcentration")),
    dreNoData: String(t("dreNoData")),
    dreLargestExpense: String(t("dreLargestExpense")),
    dreFinalMargin: String(t("dreFinalMargin")),
    dreExpenseRatio: String(t("dreExpenseRatio")),
    dreRestaurantDiagnostics: String(t("dreRestaurantDiagnostics")),
    dreRestaurantDiagnosticsText: String(t("dreRestaurantDiagnosticsText")),
    dreFinalMarginCard: String(t("dreFinalMarginCard")),
    dreOperationalMarginCard: String(t("dreOperationalMarginCard")),
    dreInputsOnRevenue: String(t("dreInputsOnRevenue")),
    drePeopleOnRevenue: String(t("drePeopleOnRevenue")),
    dreStructureOnRevenue: String(t("dreStructureOnRevenue")),
    dreHealthy: String(t("dreHealthy")),
    dreCritical: String(t("dreCritical")),
    dreAttention: String(t("dreAttention")),
    dreAttentionPoints: String(t("dreAttentionPoints")),
    dreRevenueMixTitle: String(t("dreRevenueMixTitle")),
    dreRevenueMixText: String(t("dreRevenueMixText")),
    dreMenuMixTitle: String(t("dreMenuMixTitle")),
    dreMenuMixText: String(t("dreMenuMixText")),
    dreCardFeesTitle: String(t("dreCardFeesTitle")),
    dreCardFeesText: String(t("dreCardFeesText")),
    dreRevenueVsExpenses: String(t("dreRevenueVsExpenses")),
    dreRevenueVsExpensesText: String(t("dreRevenueVsExpensesText")),
    dreOperationalResultChart: String(t("dreOperationalResultChart")),
    dreOperationalResultChartText: String(t("dreOperationalResultChartText")),
    total: String(t("total"))
  };
  const teamPanelCopy = {
    processing: String(t("processing")),
    navTeam: String(t("navTeam")),
    teamTitle: String(t("teamTitle")),
    teamText: String(t("teamText")),
    teamAccessModel: String(t("teamAccessModel")),
    teamAccessModelText: String(t("teamAccessModelText")),
    teamMembersTotal: String(t("teamMembersTotal")),
    teamAccountRole: String(t("teamAccountRole")),
    teamAdminsTotal: String(t("teamAdminsTotal")),
    teamUsersTotal: String(t("teamUsersTotal")),
    teamRestaurantsTotal: String(t("teamRestaurantsTotal")),
    authRestaurants: String(t("authRestaurants")),
    teamEmpty: String(t("teamEmpty")),
    teamRoleOwner: String(t("teamRoleOwner")),
    teamRoleUser: String(t("teamRoleUser")),
    teamRoleViewer: String(t("teamRoleViewer")),
    teamRestaurantAccess: String(t("teamRestaurantAccess")),
    teamNoRestaurants: String(t("teamNoRestaurants")),
    teamManageMember: String(t("teamManageMember")),
    teamManageMemberText: String(t("teamManageMemberText")),
    teamInviteFeatures: String(t("teamInviteFeatures")),
    teamFeatureDashboard: String(t("teamFeatureDashboard")),
    teamInviteRestaurants: String(t("teamInviteRestaurants")),
    teamSaveMember: String(t("teamSaveMember")),
    teamRemoveMember: String(t("teamRemoveMember")),
    teamMemberImmutable: String(t("teamMemberImmutable")),
    teamMemberUpdated: String(t("teamMemberUpdated")),
    teamMemberRemoved: String(t("teamMemberRemoved")),
    teamYou: String(t("teamYou")),
    teamInviteTitle: String(t("teamInviteTitle")),
    teamInviteText: String(t("teamInviteText")),
    teamInviteEmail: String(t("teamInviteEmail")),
    teamInviteHint: String(t("teamInviteHint")),
    teamInviteAction: String(t("teamInviteAction")),
    teamInvitePending: String(t("teamInvitePending")),
    teamInviteEmpty: String(t("teamInviteEmpty")),
    teamInviteRevoke: String(t("teamInviteRevoke")),
    ownerOnlyMessage: "A gestão de equipe fica disponível apenas para o owner.",
    featureRequired: "Selecione ao menos uma funcionalidade.",
    selectedLabel: "Selecionado",
    noAccessLabel: "Sem acesso"
  };
  const copyBySection: Record<Exclude<InternalSection, "account">, { eyebrow: string; title: string; text: string }> = {
    dashboard: {
      eyebrow: String(t("navDashboard")),
      title: effectiveSession?.activeRestaurantName ?? effectiveSession?.restaurantName ?? String(t("navDashboard")),
      text:
        effectiveSession?.activeRole === "owner"
          ? "Visão executiva completa para leitura, upload e tomada de decisão."
          : "Acompanhe os indicadores e o desempenho da unidade selecionada."
    },
    dre: {
      eyebrow: String(t("navDre")),
      title: String(t("dreTitle")),
      text: String(t("dreText"))
    },
    restaurants: {
      eyebrow: String(t("navRestaurants")),
      title: String(t("authManageRestaurants")),
      text: String(t("authManageRestaurantsText"))
    },
    team: {
      eyebrow: String(t("navTeam")),
      title: String(t("teamTitle")),
      text: String(t("teamText"))
    }
  };
  const activeHeaderSection = currentSection === "account" ? "dashboard" : currentSection;
  const dashboardHeaderCopy = copyBySection[activeHeaderSection];
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
  const hasDashboardData = Boolean(dashboard);

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
    if (!effectiveSession || !canManageTeam || effectiveSession.authMode !== "supabase" || !effectiveSession.activeAccountId) {
      setAccountMembers([]);
      setAccountMembersLoading(false);
      setAccountInvitations([]);
      setAccountInvitationsLoading(false);
      return;
    }

    let mounted = true;
    setAccountMembersLoading(true);
    setAccountInvitationsLoading(true);

    void loadAccountMembers(effectiveSession.activeAccountId)
      .then((members) => {
        if (mounted) {
          setAccountMembers(members);
        }
      })
      .catch(() => {
        if (mounted) {
          setAccountMembers([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setAccountMembersLoading(false);
        }
      });

    void loadAccountInvitations(effectiveSession.activeAccountId)
      .then((invitations) => {
        if (mounted) {
          setAccountInvitations(invitations);
        }
      })
      .catch(() => {
        if (mounted) {
          setAccountInvitations([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setAccountInvitationsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [canManageTeam, effectiveSession]);

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

  useEffect(() => {
    if (!effectiveSession) {
      setUserProfileForm({ fullName: "" });
      setRestaurantProfileForm({ restaurantName: "" });
      setRestaurantProfileDirty(false);
      setRestaurantProfileRestaurantId(undefined);
      setInviteForm({
        email: "",
        featureIds: [DEFAULT_INVITE_FEATURE],
        restaurantIds: []
      });
      return;
    }

    setUserProfileForm({
      fullName: effectiveSession.userFullName ?? effectiveSession.restaurantName ?? "",
      userPhotoUrl: effectiveSession.userPhotoUrl
    });
    const currentRestaurantId = effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId;
    if (!restaurantProfileDirty || restaurantProfileRestaurantId !== currentRestaurantId) {
      setRestaurantProfileForm({
        restaurantName: effectiveSession.restaurantName ?? effectiveSession.activeRestaurantName ?? "",
        profilePhotoUrl: effectiveSession.profilePhotoUrl
      });
      setRestaurantProfileRestaurantId(currentRestaurantId);
      setRestaurantProfileDirty(false);
    }
    setInviteForm((current) => ({
      ...current,
      featureIds: current.featureIds.length > 0 ? current.featureIds : [DEFAULT_INVITE_FEATURE],
      restaurantIds:
        current.restaurantIds.length > 0
          ? current.restaurantIds
          : (effectiveSession.memberships ?? []).map((membership) => membership.restaurantId)
    }));
  }, [effectiveSession, restaurantProfileDirty, restaurantProfileRestaurantId]);

  useEffect(() => {
    if ((currentSection === "restaurants" && !canManageRestaurants) || (currentSection === "team" && !canManageTeam)) {
      setCurrentSection("dashboard");
    }
  }, [canManageRestaurants, canManageTeam, currentSection]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(restoreSession());
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    void withTimeout(getSupabaseSession(), AUTH_BOOT_TIMEOUT_MS, "Tempo limite ao inicializar autenticação.")
      .then((nextSession) => {
        if (!mounted) {
          return;
        }

        setSession(nextSession);
      })
      .catch((error) => {
        if (mounted) {
          setSession(null);
          setAuthError(error instanceof Error ? error.message : "Não foi possível inicializar a autenticação.");
        }
      })
      .finally(() => {
        if (mounted) {
          setAuthLoading(false);
        }
      });

    const unsubscribe = subscribeToSupabaseAuth((nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || session.authMode !== "supabase") {
      setAuthHydrating(false);
      return;
    }

    if ((session.memberships?.length ?? 0) > 0 && (session.activeRestaurantId ?? session.restaurantId)) {
      setAuthHydrating(false);
      return;
    }

    let mounted = true;
    setAuthHydrating(true);

    void withTimeout(
      hydrateSupabaseSession(session),
      AUTH_HYDRATE_TIMEOUT_MS,
      "Tempo limite ao carregar restaurantes e permissões da conta."
    )
      .then((nextSession) => {
        if (!mounted || !nextSession) {
          return;
        }

        if (!(nextSession.activeRestaurantId ?? nextSession.restaurantId)) {
          throw new Error("Login efetuado, mas nenhum restaurante ativo foi encontrado para esta conta.");
        }

        setSession((current) => {
          if (!current || current.userId !== nextSession.userId) {
            return current;
          }

          const preferredRestaurantId = getPreferredRestaurant(nextSession.userId);
          return applyActiveRestaurant(nextSession, preferredRestaurantId);
        });
        setAuthError(undefined);
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        setAuthError(error instanceof Error ? error.message : "Não foi possível carregar os restaurantes da conta.");
        setSession((current) =>
          current && !(current.activeRestaurantId ?? current.restaurantId) ? null : current
        );
      })
      .finally(() => {
        if (mounted) {
          setAuthHydrating(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session || session.authMode !== "supabase") {
      return;
    }

    const refreshSessionAccess = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void withTimeout(
        hydrateSupabaseSession(session),
        AUTH_HYDRATE_TIMEOUT_MS,
        "Tempo limite ao atualizar restaurantes e permissões da conta."
      )
        .then((nextSession) => {
          if (!nextSession) {
            return;
          }

          setSession((current) => {
            if (!current || current.userId !== nextSession.userId) {
              return current;
            }

            const preferredRestaurantId = getPreferredRestaurant(nextSession.userId);
            return applyActiveRestaurant(nextSession, preferredRestaurantId);
          });
        })
        .catch(() => undefined);
    };

    window.addEventListener("focus", refreshSessionAccess);
    document.addEventListener("visibilitychange", refreshSessionAccess);

    return () => {
      window.removeEventListener("focus", refreshSessionAccess);
      document.removeEventListener("visibilitychange", refreshSessionAccess);
    };
  }, [session]);

  useEffect(() => {
    if (!activeWorkspaceSession) {
      setWorkspaceReady(false);
      setWorkspaceRestaurantId(undefined);
      setSalesFiles([]);
      setRecipeFile(null);
      setState({});
      setUploadFeedback([]);
      setDrePeriods([]);
      setSelectedDrePeriod(DEFAULT_DRE_PERIOD);
      setSelectedPeriod(TOTAL_PERIOD);
      setSelectedView(TOTAL_VIEW);
      setCurrentSection("dashboard");
      setAuthLoading(false);
      return;
    }

    if (activeWorkspaceSession.authMode === "supabase" && !activeWorkspaceSession.restaurantId) {
      setWorkspaceReady(false);
      setWorkspaceRestaurantId(undefined);
      return;
    }

    let mounted = true;
    const targetRestaurantId = activeWorkspaceSession.restaurantId;
    const localWorkspace = loadRestaurantWorkspace<PersistedWorkspace>(targetRestaurantId);
    setWorkspaceReady(false);
    setWorkspaceRestaurantId(undefined);

    if (localWorkspace) {
      setLocale(localWorkspace.locale ?? "pt");
      setState((localWorkspace.state as UploadState | undefined) ?? {});
      setUploadFeedback(localWorkspace.uploadFeedback ?? []);
      setDrePeriods(localWorkspace.drePeriods ?? []);
      setSelectedDrePeriod(
        localWorkspace.selectedDrePeriod ??
          localWorkspace.drePeriods?.[localWorkspace.drePeriods.length - 1]?.key ??
          DEFAULT_DRE_PERIOD
      );
      setSelectedPeriod(localWorkspace.selectedPeriod ?? TOTAL_PERIOD);
      setSelectedView(localWorkspace.selectedView ?? TOTAL_VIEW);
      setWorkspaceRestaurantId(targetRestaurantId);
      setWorkspaceReady(true);
    }

    const loadWorkspace = async () => {
      try {
        const cloudWorkspace =
          activeWorkspaceSession.authMode === "supabase"
            ? await loadCloudWorkspace(targetRestaurantId)
            : localWorkspace;
        const workspace = cloudWorkspace ?? localWorkspace;

        if (!mounted) {
          return;
        }

        const currentWorkspaceHasContent =
          latestWorkspaceRestaurantIdRef.current === targetRestaurantId &&
          hasPersistedWorkspaceContent({
            locale: latestWorkspaceMetaRef.current.locale,
            state: latestStateRef.current as PersistedWorkspace["state"],
            uploadFeedback: latestUploadFeedbackRef.current,
            drePeriods: latestDrePeriodsRef.current,
            selectedPeriod: latestWorkspaceMetaRef.current.selectedPeriod,
            selectedView: latestWorkspaceMetaRef.current.selectedView,
            selectedDrePeriod: latestWorkspaceMetaRef.current.selectedDrePeriod,
            currentSection: latestWorkspaceMetaRef.current.currentSection
          });

        if (currentWorkspaceHasContent) {
          setWorkspaceRestaurantId(targetRestaurantId);
          setWorkspaceReady(true);
          return;
        }

        setSalesFiles([]);
        setRecipeFile(null);
        setAuthError(undefined);
        setLocale(workspace?.locale ?? "pt");
        setState((workspace?.state as UploadState | undefined) ?? {});
        setUploadFeedback(workspace?.uploadFeedback ?? []);
        setDrePeriods(workspace?.drePeriods ?? []);
        setSelectedDrePeriod(
          workspace?.selectedDrePeriod ??
            workspace?.drePeriods?.[(workspace.drePeriods?.length ?? 0) - 1]?.key ??
            DEFAULT_DRE_PERIOD
        );
        setSelectedPeriod(workspace?.selectedPeriod ?? TOTAL_PERIOD);
        setSelectedView(workspace?.selectedView ?? TOTAL_VIEW);
        setWorkspaceRestaurantId(targetRestaurantId);
        setWorkspaceReady(true);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setAuthError(error instanceof Error ? error.message : "Não foi possível carregar a base do restaurante.");
        setWorkspaceRestaurantId(targetRestaurantId);
        setWorkspaceReady(true);
      }
    };

    void loadWorkspace();

    return () => {
      mounted = false;
    };
  }, [activeWorkspaceKey, activeWorkspaceSession]);

  useEffect(() => {
    if (!effectiveSession || !workspaceReady) {
      return;
    }

    const restaurantId = effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId;
    if (!restaurantId || workspaceRestaurantId !== restaurantId) {
      return;
    }

    const workspace: PersistedWorkspace = {
      locale,
      state: state as PersistedWorkspace["state"],
      uploadFeedback,
      selectedPeriod,
      selectedView,
      drePeriods,
      selectedDrePeriod,
      currentSection
    };

    saveRestaurantWorkspace<PersistedWorkspace>(restaurantId, workspace);

    if (effectiveSession.authMode === "supabase") {
      void saveCloudWorkspace(restaurantId, workspace).catch(() => undefined);
      return;
    }

  }, [currentSection, drePeriods, effectiveSession, locale, selectedDrePeriod, selectedPeriod, selectedView, state, uploadFeedback, workspaceReady, workspaceRestaurantId]);

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
        throw new Error(`Faltam colunas obrigatórias no arquivo ${invalidValidation.fileName}: ${invalidValidation.missingColumns.join(", ")}.`);
      }

      const incomingPeriods = createPeriodDashboardsFromImports(nextSalesFiles.map((file) => file.name), recipes, duplicateRecipeCodes, salesImports);
      if (incomingPeriods.length === 0) {
        throw new Error("Nenhuma linha válida foi encontrada nos arquivos de vendas.");
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
        throw new Error(`Faltam colunas obrigatórias no arquivo ${invalidRecipeValidation.fileName}: ${invalidRecipeValidation.missingColumns.join(", ")}.`);
      }

      if (recipes.length === 0) {
        throw new Error("Nenhuma linha válida foi encontrada no arquivo de fichas técnicas.");
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
          throw new Error(`Faltam colunas obrigatórias no arquivo ${invalidSalesValidation.fileName}: ${invalidSalesValidation.missingColumns.join(", ")}.`);
        }

        incomingPeriods = createPeriodDashboardsFromImports(salesFiles.map((salesFile) => salesFile.name), recipes, duplicateRecipeCodes, salesImports);
      }

      const mergedPeriods = mergePeriodDashboards(rebuiltPeriods, incomingPeriods, recipes, duplicateRecipeCodes);
      if (mergedPeriods.length === 0) {
        throw new Error("Nenhuma linha válida foi encontrada para montar o dashboard.");
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
    if (!canManageOperationalData) {
      return;
    }

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
    if (!canManageOperationalData) {
      return;
    }

    try {
      setDreProcessing(true);
      setDreError(undefined);
      const nextDreData = await parseDreSpreadsheetFile(file);

      if (nextDreData.sections.length === 0 && nextDreData.summary.length === 0) {
        throw new Error("Nenhuma seção de DRE foi identificada neste arquivo.");
      }

      if (getDreRevenueValue(nextDreData) > 0 && getDreRevenueGroups(nextDreData).length === 0) {
        throw new Error("A seção de Receitas Operacionais foi encontrada, mas nenhuma subdivisão de receita foi identificada. Verifique se os subgrupos estão na coluna B do arquivo.");
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
    setState({});
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

  const handleLogin = async (email: string, password: string) => {
    try {
      setAuthSubmitting(true);
      setAuthError(undefined);
      const nextSession = isSupabaseConfigured
        ? await signInWithSupabase(email, password)
        : signIn(email, password);
      if (!isSupabaseConfigured && !(nextSession.activeRestaurantId ?? nextSession.restaurantId)) {
        throw new Error("Login efetuado, mas nenhum restaurante ativo foi encontrado para esta conta.");
      }
      setSession(nextSession);
      setAuthError(undefined);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRegister = async (fullName: string, email: string, password: string) => {
    try {
      setAuthSubmitting(true);
      setAuthError(undefined);
      const nextSession = isSupabaseConfigured
        ? await registerRestaurantWithSupabase({ fullName, email, password })
        : registerRestaurant({ fullName, email, password });
      setSession(nextSession);
      setAuthError(undefined);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível criar o acesso.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (session?.authMode === "supabase") {
        await signOutFromSupabase();
      } else {
        signOut();
      }
    } finally {
      setSession(null);
    }
  };

  const handleSelectRestaurant = (restaurantId: string) => {
    if (!session) {
      return;
    }

    savePreferredRestaurant(session.userId, restaurantId);
    setWorkspaceReady(false);
    setWorkspaceRestaurantId(undefined);
    setSalesFiles([]);
    setRecipeFile(null);
    setState({});
    setUploadFeedback([]);
    setSelectedPeriod(TOTAL_PERIOD);
    setSelectedView(TOTAL_VIEW);
    setSession((current) => (current ? applyActiveRestaurant(current, restaurantId) : current));
    setAccountError(undefined);
    setAccountMessage(undefined);
  };

  const refreshTeamData = async (currentSession: AuthSession) => {
    if (currentSession.globalRole !== "owner" || currentSession.authMode !== "supabase" || !currentSession.activeAccountId) {
      setAccountMembers([]);
      setAccountInvitations([]);
      return;
    }

    setAccountMembersLoading(true);
    setAccountInvitationsLoading(true);

    try {
      const [members, invitations] = await Promise.all([
        loadAccountMembers(currentSession.activeAccountId),
        loadAccountInvitations(currentSession.activeAccountId)
      ]);
      setAccountMembers(members);
      setAccountInvitations(invitations);
    } finally {
      setAccountMembersLoading(false);
      setAccountInvitationsLoading(false);
    }
  };

  const handleInviteRestaurantToggle = (restaurantId: string) => {
    setInviteForm((current) => ({
      ...current,
      restaurantIds: current.restaurantIds.includes(restaurantId)
        ? current.restaurantIds.filter((id) => id !== restaurantId)
        : [...current.restaurantIds, restaurantId]
    }));
  };

  const handleInviteFeatureToggle = (featureId: string) => {
    setInviteForm((current) => ({
      ...current,
      featureIds: current.featureIds.includes(featureId)
        ? current.featureIds.filter((id) => id !== featureId)
        : [...current.featureIds, featureId]
    }));
  };

  const handleCreateInvitation = async () => {
    if (!effectiveSession || effectiveSession.authMode !== "supabase") {
      return;
    }

    if (!effectiveSession.activeAccountId) {
      setInviteError("Não foi possível identificar a conta ativa deste usuário. Atualize o vínculo da conta no banco antes de enviar convites.");
      return;
    }

    if (inviteForm.featureIds.length === 0) {
      setInviteError("Selecione ao menos uma funcionalidade para este convite.");
      return;
    }

    try {
      setInviteBusy(true);
      setInviteError(undefined);
      setInviteMessage(undefined);
      await createAccountInvitation({
        email: inviteForm.email,
        accountRole: "user",
        restaurantRole: "viewer",
        restaurantIds: inviteForm.restaurantIds
      });
      await refreshTeamData(effectiveSession);
      setInviteMessage("Convite criado com sucesso.");
      setInviteForm({
        email: "",
        featureIds: [DEFAULT_INVITE_FEATURE],
        restaurantIds: (effectiveSession.memberships ?? []).map((membership) => membership.restaurantId)
      });
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Não foi possível criar o convite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!effectiveSession || effectiveSession.authMode !== "supabase") {
      return;
    }

    try {
      setInviteBusy(true);
      setInviteError(undefined);
      setInviteMessage(undefined);
      await revokeAccountInvitation(invitationId);
      await refreshTeamData(effectiveSession);
      setInviteMessage("Convite revogado com sucesso.");
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Não foi possível revogar o convite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleUpdateMember = async ({
    member,
    accountRole,
    restaurantRole,
    restaurantIds
  }: {
    member: AccountMember;
    accountRole: "user";
    restaurantRole: "viewer";
    restaurantIds: string[];
  }) => {
    if (!effectiveSession || !canManageTeam || effectiveSession.authMode !== "supabase" || !effectiveSession.activeAccountId) {
      throw new Error("NÃ£o foi possÃ­vel identificar a conta ativa.");
    }

    const targetAccountId = member.accountId || effectiveSession.activeAccountId;
    await updateAccountMemberAccess({
      accountId: targetAccountId,
      userId: member.userId,
      accountRole,
      restaurantRole,
      restaurantIds
    });
    await refreshTeamData(effectiveSession);
  };

  const handleRemoveMember = async (member: AccountMember) => {
    if (!effectiveSession || !canManageTeam || effectiveSession.authMode !== "supabase" || !effectiveSession.activeAccountId) {
      throw new Error("NÃ£o foi possÃ­vel identificar a conta ativa.");
    }

    const targetAccountId = member.accountId || effectiveSession.activeAccountId;
    await removeAccountMemberAccess({
      accountId: targetAccountId,
      userId: member.userId
    });
    await refreshTeamData(effectiveSession);
  };

  const handleUserPhotoSelect = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const imageData = await readFileAsDataUrl(file);
      setUserProfileForm((current) => ({
        ...current,
        userPhotoUrl: imageData
      }));
      setAccountError(undefined);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
    }
  };

  const handleRestaurantPhotoSelect = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const imageData = await readFileAsDataUrl(file);
      setRestaurantProfileDirty(true);
      setRestaurantProfileRestaurantId(effectiveSession?.activeRestaurantId ?? effectiveSession?.restaurantId);
      setRestaurantProfileForm((current) => ({
        ...current,
        profilePhotoUrl: imageData
      }));
      setAccountError(undefined);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
    }
  };

  const handleRestaurantNameChange = (value: string) => {
    setRestaurantProfileDirty(true);
    setRestaurantProfileRestaurantId(effectiveSession?.activeRestaurantId ?? effectiveSession?.restaurantId);
    setRestaurantProfileForm((current) => ({ ...current, restaurantName: value }));
  };

  const handleSaveUserAccount = async () => {
    if (!session) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await updateSupabaseUserProfile(session, userProfileForm)
          : updateLocalUserProfile(session, userProfileForm);

      setSession(nextSession);
      if (nextSession.authMode === "supabase") {
        await refreshTeamData(nextSession);
      }
      setAccountMessage(String(t("authProfileUpdated")));
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleSaveRestaurantAccount = async () => {
    if (!session) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await updateSupabaseRestaurantProfile(session, restaurantProfileForm)
          : updateLocalRestaurantProfile(session, restaurantProfileForm);

      setSession(nextSession);
      setRestaurantProfileDirty(false);
      setRestaurantProfileRestaurantId(nextSession.activeRestaurantId ?? nextSession.restaurantId);
      setAccountMessage(String(t("authProfileUpdated")));
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleCreateRestaurant = async () => {
    if (!session) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await createSupabaseRestaurantForCurrentUser(session, newRestaurantName)
          : createLocalRestaurantForAccount(session, newRestaurantName);

      const nextRestaurantId = nextSession.activeRestaurantId ?? nextSession.restaurantId;
      if (nextRestaurantId) {
        savePreferredRestaurant(nextSession.userId, nextRestaurantId);
      }
      setSession(nextSession);
      setNewRestaurantName("");
      setAccountMessage("Restaurante cadastrado com sucesso.");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível cadastrar o restaurante.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteRestaurant = async (restaurantId: string) => {
    if (!session) {
      return;
    }

    if (!window.confirm("Tem certeza que deseja excluir este restaurante? Esta ação remove a base dessa unidade.")) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await deleteSupabaseRestaurantFromAccount(session, restaurantId)
          : deleteLocalRestaurantFromAccount(session, restaurantId);

      const nextRestaurantId = nextSession.activeRestaurantId ?? nextSession.restaurantId;
      if (nextRestaurantId) {
        savePreferredRestaurant(nextSession.userId, nextRestaurantId);
      }
      setSession(nextSession);
      setAccountMessage("Restaurante excluído com sucesso.");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível excluir o restaurante.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!session) {
      return;
    }

    if (!window.confirm(String(t("authDeleteConfirm")))) {
      return;
    }

    try {
      setAccountBusy(true);
      if (session.authMode === "supabase") {
        await deleteSupabaseRestaurantAccount();
        await signOutFromSupabase();
      } else {
        deleteLocalRestaurantAccount(session);
      }
      setSession(null);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível excluir a conta.");
    } finally {
      setAccountBusy(false);
    }
  };

  const resetAccountPanelState = () => {
    if (!effectiveSession) {
      return;
    }

    setAccountMessage(undefined);
    setAccountError(undefined);
    setUserProfileForm({
      fullName: effectiveSession.userFullName ?? effectiveSession.restaurantName ?? "",
      userPhotoUrl: effectiveSession.userPhotoUrl
    });
    setRestaurantProfileForm({
      restaurantName: effectiveSession.restaurantName ?? effectiveSession.activeRestaurantName ?? "",
      profilePhotoUrl: effectiveSession.profilePhotoUrl
    });
    setRestaurantProfileDirty(false);
    setRestaurantProfileRestaurantId(effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId);
    setNewRestaurantName("");
  };

  if (authLoading || authHydrating) {
    return (
      <LocaleContext.Provider value={locale}>
        <div className="app-shell refined auth-shell">
          <section className="card">
            <p className="message">
              {authLoading
                ? "Inicializando acesso e verificando a sua conta..."
                : "Carregando restaurantes e permissões da sua conta..."}
            </p>
          </section>
        </div>
      </LocaleContext.Provider>
    );
  }

  if (!effectiveSession) {
    return (
      <LocaleContext.Provider value={locale}>
        <AuthScreen
          locale={locale}
          onChangeLocale={setLocale}
          theme={theme}
          onChangeTheme={setTheme}
          onLogin={handleLogin}
          onRegister={handleRegister}
          error={authError}
          isCloudEnabled={isSupabaseConfigured}
          busy={authSubmitting}
          copy={{
            brandTagline: String(t("brandTagline")),
            title: String(t("authTitle")),
            loginTab: String(t("authLoginTab")),
            registerTab: String(t("authRegisterTab")),
            fullName: String(t("authFullName")),
            fullNameHint: String(t("authFullNameHint")),
            email: String(t("authEmail")),
            password: String(t("authPassword")),
            processing: String(t("processing")),
            submitLogin: String(t("authSubmitLogin")),
            submitRegister: String(t("authSubmitRegister")),
            demoHint: String(t("authDemoHint")),
            language: String(t("language")),
            ...themeLabels
          }}
        />
      </LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={locale}>
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="dashboard-sidebar-brand">
            <BrandMark tagline={String(t("brandTagline"))} />
          </div>
          <InternalNavigation
            section={currentSection}
            onChange={setCurrentSection}
            items={navigationItems}
          />
          <div className="dashboard-sidebar-footer">
            <button
              type="button"
              className="sidebar-footer-action icon-only"
              onClick={handleLogout}
              title={String(t("authLogout"))}
              aria-label={String(t("authLogout"))}
            >
              <IconLogout />
            </button>
            <button
              type="button"
              className="sidebar-avatar-button"
              onClick={() => {
                resetAccountPanelState();
                setCurrentSection("account");
              }}
              title={String(t("navMyAccount"))}
              aria-label={String(t("navMyAccount"))}
            >
              <UserAvatar session={effectiveSession} size="lg" />
            </button>
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="content dashboard-content">
            <DashboardShellHeader
              session={effectiveSession}
              eyebrow={dashboardHeaderCopy.eyebrow}
              title={dashboardHeaderCopy.title}
              text={dashboardHeaderCopy.text}
              locale={locale}
              onChangeLocale={setLocale}
              theme={theme}
              onChangeTheme={setTheme}
              languageLabel={String(t("language"))}
              themeLabels={themeLabels}
            />

            {currentSection === "dashboard" || currentSection === "dre" ? (
              <RestaurantNavigatorPanel
                eyebrow={String(t("authRestaurantNavigator"))}
                title={String(t("authRestaurantNavigator"))}
                description={String(t("authRestaurantNavigatorText"))}
                memberships={effectiveSession.memberships ?? []}
                activeRestaurantId={effectiveSession.activeRestaurantId}
                onActivateRestaurant={handleSelectRestaurant}
              />
            ) : null}
            {currentSection === "dre" ? (
              <Suspense
                fallback={
                  <section className="card">
                    <p className="message">{String(t("processing"))}</p>
                  </section>
                }
              >
                <LazyDreAnalysisPanel
                  data={dreData}
                  periods={drePeriods}
                  selectedPeriod={activeDrePeriod?.key ?? selectedDrePeriod}
                  error={dreError}
                  processing={dreProcessing}
                  canManageData={canManageOperationalData}
                  copy={drePanelCopy}
                  onImport={(file) => void handleDreImport(file)}
                  onSelectPeriod={setSelectedDrePeriod}
                />
              </Suspense>
            ) : null}
            {currentSection === "restaurants" && canManageRestaurants ? (
              <Suspense
                fallback={
                  <section className="card">
                    <p className="message">{String(t("processing"))}</p>
                  </section>
                }
              >
                <LazyRestaurantManagementPanel
                  session={effectiveSession}
                  restaurantForm={restaurantProfileForm}
                  newRestaurantName={newRestaurantName}
                  busy={accountBusy}
                  message={accountMessage}
                  error={accountError}
                  onRestaurantNameChange={handleRestaurantNameChange}
                  onRestaurantPhotoSelect={handleRestaurantPhotoSelect}
                  onCreateRestaurantNameChange={setNewRestaurantName}
                  onSaveRestaurant={handleSaveRestaurantAccount}
                  onCreateRestaurant={handleCreateRestaurant}
                  onDeleteRestaurant={handleDeleteRestaurant}
                  onActivateRestaurant={handleSelectRestaurant}
                  copy={accountPanelCopy}
                />
              </Suspense>
            ) : null}
            {currentSection === "team" && canManageTeam ? (
              <Suspense
                fallback={
                  <section className="card">
                    <p className="message">{String(t("processing"))}</p>
                  </section>
                }
              >
                <LazyTeamPermissionsPanel
                  session={effectiveSession}
                  members={accountMembers}
                  invitations={accountInvitations}
                  loading={accountMembersLoading}
                  invitationsLoading={accountInvitationsLoading}
                  canManageTeam={Boolean(canManageTeam)}
                  inviteForm={inviteForm}
                  inviteBusy={inviteBusy}
                  inviteMessage={inviteMessage}
                  inviteError={inviteError}
                  copy={teamPanelCopy}
                  onInviteEmailChange={(value) => setInviteForm((current) => ({ ...current, email: value }))}
                  onInviteFeatureToggle={handleInviteFeatureToggle}
                  onInviteRestaurantToggle={handleInviteRestaurantToggle}
                  onCreateInvitation={() => void handleCreateInvitation()}
                  onRevokeInvitation={(invitationId) => void handleRevokeInvitation(invitationId)}
                  onUpdateMember={handleUpdateMember}
                  onRemoveMember={handleRemoveMember}
                />
              </Suspense>
            ) : null}
            {currentSection === "account" ? (
              <Suspense
                fallback={
                  <section className="card">
                    <p className="message">{String(t("processing"))}</p>
                  </section>
                }
              >
                <LazyAccountSettingsPanel
                  session={effectiveSession}
                  userForm={userProfileForm}
                  restaurantForm={restaurantProfileForm}
                  newRestaurantName={newRestaurantName}
                  busy={accountBusy}
                  message={accountMessage}
                  error={accountError}
                  onClose={() => {
                    resetAccountPanelState();
                    setCurrentSection("dashboard");
                  }}
                  onUserNameChange={(value) => setUserProfileForm((current) => ({ ...current, fullName: value }))}
                  onRestaurantNameChange={handleRestaurantNameChange}
                  onUserPhotoSelect={handleUserPhotoSelect}
                  onRestaurantPhotoSelect={handleRestaurantPhotoSelect}
                  onCreateRestaurantNameChange={setNewRestaurantName}
                  onSaveUser={handleSaveUserAccount}
                  onSaveRestaurant={handleSaveRestaurantAccount}
                  onCreateRestaurant={handleCreateRestaurant}
                  onDeleteRestaurant={handleDeleteRestaurant}
                  onDeleteAccount={handleDeleteAccount}
                  onActivateRestaurant={handleSelectRestaurant}
                  canManageRestaurants={false}
                  copy={accountPanelCopy}
                />
              </Suspense>
            ) : null}
            {authError ? (
              <section className="card">
                <p className="message error">{authError}</p>
              </section>
            ) : null}
            {currentSection === "dashboard" ? (
              <Suspense fallback={<section className="card"><p className="message">{String(t("processing"))}</p></section>}>
                <LazyDashboardPanels
                  state={state}
                  dashboard={dashboard}
                  periodDashboards={periodDashboards}
                  selectedPeriod={selectedPeriod}
                  selectedView={selectedView}
                  totalView={TOTAL_VIEW}
                  hasDashboardData={hasDashboardData}
                  hasSalesFile={hasSalesFile}
                  canManageOperationalData={canManageOperationalData}
                  onUpload={handleUpload}
                  onClearAll={handleClearAll}
                  onResetFlow={handleResetFlow}
                  onSelectPeriod={setSelectedPeriod}
                  onRemovePeriod={canManageOperationalData ? handleRemovePeriod : undefined}
                  onSelectView={setSelectedView}
                />
              </Suspense>
            ) : null}
          </div>
        </main>
      </div>
    </LocaleContext.Provider>
  );
}




