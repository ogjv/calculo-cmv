import { useEffect, useState } from "react";
import { AuthScreen } from "./components/appChrome";
import { DashboardShell } from "./components/dashboardShell";
import { isSupabaseConfigured } from "./utils/supabase";
import { LocaleContext, type Locale, translations, withLocaleFallback } from "./i18n";
import { type AppSection as InternalSection, useSessionWorkspace } from "./hooks/useSessionWorkspace";
import { useOperationalData } from "./hooks/useOperationalData";
import { useTeamManagement } from "./hooks/useTeamManagement";
import { useAccountManagement } from "./hooks/useAccountManagement";
import { useAppPresentation } from "./hooks/useAppPresentation";

type ThemeMode = "light" | "dark";

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

export default function App() {
  const [locale, setLocale] = useState<Locale>("pt");
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [currentSection, setCurrentSection] = useState<InternalSection>("dashboard");
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

  const {
    authScreenCopy,
    accountPanelCopy,
    drePanelCopy,
    teamPanelCopy,
    dashboardHeaderCopy,
    themeLabels,
    navigationItems,
    canManageRestaurants,
    canManageOperationalData,
    canManageTeam
  } = useAppPresentation({ currentSection, effectiveSession, t });
  const {
    accountMembers,
    accountMembersLoading,
    accountInvitations,
    accountInvitationsLoading,
    inviteBusy,
    inviteMessage,
    inviteError,
    inviteForm,
    setInviteForm,
    handleInviteRestaurantToggle,
    handleInviteFeatureToggle,
    handleCreateInvitation,
    handleRevokeInvitation,
    handleUpdateMember,
    handleRemoveMember,
    refreshTeamData
  } = useTeamManagement(effectiveSession, canManageTeam);
  const {
    accountBusy,
    accountMessage,
    accountError,
    setAccountError,
    setAccountMessage,
    userProfileForm,
    setUserProfileForm,
    restaurantProfileForm,
    newRestaurantName,
    setNewRestaurantName,
    handleUserPhotoSelect,
    handleRestaurantPhotoSelect,
    handleRestaurantNameChange,
    handleSaveUserAccount,
    handleSaveRestaurantAccount,
    handleCreateRestaurant,
    handleDeleteRestaurant,
    handleDeleteAccount,
    resetAccountPanelState
  } = useAccountManagement({
    effectiveSession,
    session,
    setSession,
    refreshTeamData,
    profileUpdatedMessage: String(t("authProfileUpdated")),
    deleteConfirmMessage: String(t("authDeleteConfirm"))
  });

  useEffect(() => {
    if ((currentSection === "restaurants" && !canManageRestaurants) || (currentSection === "team" && !canManageTeam)) {
      setCurrentSection("dashboard");
    }
  }, [canManageRestaurants, canManageTeam, currentSection]);

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
          isCloudEnabled={isSupabaseConfigured}
          onLogin={(email, password) => void handleLogin(email, password)}
          onRegister={(fullName, email, password) => void handleRegister(fullName, email, password)}
          busy={authSubmitting}
          error={authError}
          copy={authScreenCopy}
        />
      </LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={locale}>
      <DashboardShell
        locale={locale}
        theme={theme}
        currentSection={currentSection}
        effectiveSession={effectiveSession}
        authError={authError}
        navigationItems={navigationItems}
        dashboardHeaderCopy={dashboardHeaderCopy}
        languageLabel={String(t("language"))}
        themeLabels={themeLabels}
        accountPanelCopy={accountPanelCopy}
        drePanelCopy={drePanelCopy}
        teamPanelCopy={teamPanelCopy}
        restaurantNavigatorCopy={{
          eyebrow: String(t("authRestaurantNavigator")),
          title: String(t("authRestaurantNavigator")),
          description: String(t("authRestaurantNavigatorText"))
        }}
        dreAnalysisProps={{
          data: dreData,
          periods: drePeriods,
          selectedPeriod: selectedDrePeriod,
          error: dreError,
          processing: dreProcessing,
          onImport: (file) => void handleDreImport(file),
          onSelectPeriod: setSelectedDrePeriod
        }}
        dashboardPanelProps={{
          state,
          dashboard,
          periodDashboards,
          selectedPeriod,
          selectedView,
          totalView: TOTAL_VIEW,
          hasDashboardData,
          hasSalesFile,
          canManageOperationalData,
          onUpload: handleUpload,
          onClearAll: handleClearAll,
          onResetFlow: handleResetFlow,
          onSelectPeriod: setSelectedPeriod,
          onRemovePeriod: canManageOperationalData ? handleRemovePeriod : undefined,
          onSelectView: setSelectedView
        }}
        restaurantManagementProps={{
          restaurantForm: restaurantProfileForm,
          newRestaurantName,
          busy: accountBusy,
          message: accountMessage,
          error: accountError,
          onRestaurantNameChange: handleRestaurantNameChange,
          onRestaurantPhotoSelect: handleRestaurantPhotoSelect,
          onCreateRestaurantNameChange: setNewRestaurantName,
          onSaveRestaurant: handleSaveRestaurantAccount,
          onCreateRestaurant: handleCreateRestaurant,
          onDeleteRestaurant: handleDeleteRestaurant
        }}
        teamManagementProps={{
          members: accountMembers,
          invitations: accountInvitations,
          loading: accountMembersLoading,
          invitationsLoading: accountInvitationsLoading,
          inviteForm,
          inviteBusy,
          inviteMessage,
          inviteError,
          onInviteEmailChange: (value) => setInviteForm((current) => ({ ...current, email: value })),
          onInviteFeatureToggle: handleInviteFeatureToggle,
          onInviteRestaurantToggle: handleInviteRestaurantToggle,
          onCreateInvitation: () => void handleCreateInvitation(),
          onRevokeInvitation: (invitationId) => void handleRevokeInvitation(invitationId),
          onUpdateMember: handleUpdateMember,
          onRemoveMember: handleRemoveMember
        }}
        accountSettingsProps={{
          userForm: userProfileForm,
          restaurantForm: restaurantProfileForm,
          newRestaurantName,
          busy: accountBusy,
          message: accountMessage,
          error: accountError,
          onUserNameChange: (value) => setUserProfileForm((current) => ({ ...current, fullName: value })),
          onRestaurantNameChange: handleRestaurantNameChange,
          onUserPhotoSelect: handleUserPhotoSelect,
          onRestaurantPhotoSelect: handleRestaurantPhotoSelect,
          onCreateRestaurantNameChange: setNewRestaurantName,
          onSaveUser: handleSaveUserAccount,
          onSaveRestaurant: handleSaveRestaurantAccount,
          onCreateRestaurant: handleCreateRestaurant,
          onDeleteRestaurant: handleDeleteRestaurant,
          onDeleteAccount: handleDeleteAccount
        }}
        canManageRestaurants={canManageRestaurants}
        canManageOperationalData={canManageOperationalData}
        canManageTeam={canManageTeam}
        onChangeLocale={setLocale}
        onChangeTheme={setTheme}
        onChangeSection={setCurrentSection}
        onLogout={handleLogout}
        onOpenAccount={() => {
          resetAccountPanelState();
          setCurrentSection("account");
        }}
        onCloseAccount={() => {
          resetAccountPanelState();
          setCurrentSection("dashboard");
        }}
        onActivateRestaurant={activateRestaurant}
        logoutLabel={String(t("authLogout"))}
        myAccountLabel={String(t("navMyAccount"))}
        brandTagline={String(t("brandTagline"))}
        processingLabel={String(t("processing"))}
      />
    </LocaleContext.Provider>
  );
}




