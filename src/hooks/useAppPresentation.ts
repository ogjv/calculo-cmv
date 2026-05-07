import type { AuthSession } from "../types";
import type { DrePanelCopy } from "../components/drePanels";
import type { TranslationKey } from "../i18n";
import type { AppPresentationModel, HeaderCopy } from "../presentation/contracts";
import type { AppSection } from "./useSessionWorkspace";

type Translate = (key: TranslationKey) => unknown;

type UseAppPresentationOptions = {
  currentSection: AppSection;
  effectiveSession: AuthSession | null;
  t: Translate;
};

export function useAppPresentation({ currentSection, effectiveSession, t }: UseAppPresentationOptions): AppPresentationModel {
  const activeRole = effectiveSession?.activeRole ?? "viewer";
  const canManageRestaurants =
    effectiveSession?.globalRole === "owner" ||
    effectiveSession?.activeAccountRole === "owner" ||
    activeRole === "owner";
  const canManageOperationalData =
    effectiveSession?.globalRole === "owner" ||
    effectiveSession?.activeAccountRole === "owner" ||
    activeRole === "owner";

  const themeLabels = {
    label: String(t("theme")),
    light: String(t("themeLight")),
    dark: String(t("themeDark"))
  };

  const navigationItems = [
    { key: "dashboard" as AppSection, label: String(t("navDashboard")) },
    { key: "dre" as AppSection, label: String(t("navDre")) },
    ...(canManageRestaurants ? [{ key: "restaurants" as AppSection, label: String(t("navRestaurants")) }] : [])
  ];

  const authScreenCopy = {
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
  };

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
    ownerInviteTitle: String(t("ownerInviteTitle")),
    ownerInviteText: String(t("ownerInviteText")),
    ownerInviteEmail: String(t("ownerInviteEmail")),
    ownerInviteHint: String(t("ownerInviteHint")),
    ownerInviteAction: String(t("ownerInviteAction")),
    ownerInvitePending: String(t("ownerInvitePending")),
    ownerInviteEmpty: String(t("ownerInviteEmpty")),
    ownerInviteRevoke: String(t("ownerInviteRevoke")),
    ownerInviteRestaurants: String(t("ownerInviteRestaurants")),
    ownerInviteAccessLabel: String(t("ownerInviteAccessLabel")),
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

  const copyBySection: Record<Exclude<AppSection, "account">, HeaderCopy> = {
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
    }
  };

  const activeHeaderSection = currentSection === "account" ? "dashboard" : currentSection;
  const dashboardHeaderCopy = copyBySection[activeHeaderSection];

  return {
    authScreenCopy,
    accountPanelCopy,
    drePanelCopy,
    dashboardHeaderCopy,
    themeLabels,
    navigationItems,
    canManageRestaurants,
    canManageOperationalData
  };
}
