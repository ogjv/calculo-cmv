import { useEffect, useState } from "react";
import { Suspense, lazy } from "react";
import { AuthScreen, BrandMark, DashboardShellHeader, InternalNavigation, UserAvatar } from "./components/appChrome";
import { RestaurantNavigatorPanel } from "./components/dashboardPanels";
import { isSupabaseConfigured } from "./utils/supabase";
import { LocaleContext, type Locale, translations, withLocaleFallback } from "./i18n";
import { type AppSection as InternalSection, useSessionWorkspace } from "./hooks/useSessionWorkspace";
import { useOperationalData } from "./hooks/useOperationalData";
import { useTeamManagement } from "./hooks/useTeamManagement";
import { useAccountManagement } from "./hooks/useAccountManagement";
import { useAppPresentation } from "./hooks/useAppPresentation";

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




