import { useEffect, useState } from "react";
import { Suspense, lazy } from "react";
import type { AccountInvitation, AccountMember, AuthSession } from "./types";
import { AuthScreen, BrandMark, DashboardShellHeader, InternalNavigation, UserAvatar } from "./components/appChrome";
import { RestaurantNavigatorPanel } from "./components/dashboardPanels";
import type { DrePanelCopy } from "./components/drePanels";
import { DEFAULT_INVITE_FEATURE, type InviteFormState } from "./components/teamPanels";
import { createLocalRestaurantForAccount, deleteLocalRestaurantAccount, deleteLocalRestaurantFromAccount, updateLocalRestaurantProfile, updateLocalUserProfile } from "./utils/auth";
import { createAccountInvitation, createSupabaseRestaurantForCurrentUser, deleteSupabaseRestaurantAccount, deleteSupabaseRestaurantFromAccount, loadAccountInvitations, loadAccountMembers, removeAccountMemberAccess, revokeAccountInvitation, signOutFromSupabase, updateAccountMemberAccess, updateSupabaseRestaurantProfile, updateSupabaseUserProfile } from "./utils/cloudAuth";
import { isSupabaseConfigured } from "./utils/supabase";
import { LocaleContext, type Locale, translations, withLocaleFallback } from "./i18n";
import { type AppSection as InternalSection, savePreferredRestaurant, useSessionWorkspace } from "./hooks/useSessionWorkspace";
import { useOperationalData } from "./hooks/useOperationalData";

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

type ProfileFormState = {
  restaurantName: string;
  profilePhotoUrl?: string;
};

type UserProfileFormState = {
  fullName: string;
  userPhotoUrl?: string;
};

const TOTAL_VIEW = "__TOTAL__";
const THEME_STORAGE_KEY = "grest.theme";

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
  const t = <K extends keyof typeof translations.pt>(key: K) => withLocaleFallback<typeof translations.pt>(locale, key);
  const {
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
    dreProcessing,
    selectedPeriod,
    setSelectedPeriod,
    selectedView,
    setSelectedView,
    periodDashboards,
    dashboard,
    dreData,
    hasDashboardData,
    hasSalesFile,
    handleUpload,
    handleDreImport,
    handleRemovePeriod,
    handleClearAll,
    handleResetFlow
  } = useOperationalData();
  const {
    session,
    setSession,
    effectiveSession,
    authError,
    authLoading,
    authHydrating,
    authSubmitting,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    selectRestaurant: handleSelectRestaurant
  } = useSessionWorkspace({
    locale,
    setLocale,
    state,
    setState,
    uploadFeedback,
    setUploadFeedback,
    drePeriods,
    setDrePeriods,
    selectedDrePeriod,
    setSelectedDrePeriod,
    selectedPeriod,
    setSelectedPeriod,
    selectedView,
    setSelectedView,
    currentSection,
    setCurrentSection,
    setSalesFiles,
    setRecipeFile
  });
  const activateRestaurant = (restaurantId: string) => {
    handleSelectRestaurant(restaurantId);
    setAccountError(undefined);
    setAccountMessage(undefined);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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
                onActivateRestaurant={activateRestaurant}
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
                  selectedPeriod={selectedDrePeriod}
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
                  onActivateRestaurant={activateRestaurant}
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
                  onActivateRestaurant={activateRestaurant}
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




