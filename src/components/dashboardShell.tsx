import { Suspense, lazy } from "react";
import { BrandMark, DashboardShellHeader, InternalNavigation, UserAvatar } from "./appChrome";
import { RestaurantNavigatorPanel } from "./dashboardPanels";
import type { AppSection } from "../hooks/useSessionWorkspace";
import type { AuthSession } from "../types";
import { AccountSettingsPanel, RestaurantManagementPanel } from "./accountPanels";
import { TeamPermissionsPanel } from "./teamPanels";
import { DreAnalysisPanel } from "./drePanels";
import { DashboardPanels } from "./cmvPanels";

const LazyAccountSettingsPanel = lazy(() =>
  import("./accountPanels").then((module) => ({ default: module.AccountSettingsPanel }))
);
const LazyRestaurantManagementPanel = lazy(() =>
  import("./accountPanels").then((module) => ({ default: module.RestaurantManagementPanel }))
);
const LazyDreAnalysisPanel = lazy(() =>
  import("./drePanels").then((module) => ({ default: module.DreAnalysisPanel }))
);
const LazyDashboardPanels = lazy(() =>
  import("./cmvPanels").then((module) => ({ default: module.DashboardPanels }))
);
const LazyTeamPermissionsPanel = lazy(() =>
  import("./teamPanels").then((module) => ({ default: module.TeamPermissionsPanel }))
);

type NavigationItem = {
  key: AppSection;
  label: string;
};

type DashboardShellProps = {
  locale: "pt" | "es" | "en";
  theme: "light" | "dark";
  currentSection: AppSection;
  effectiveSession: AuthSession;
  authError?: string;
  navigationItems: NavigationItem[];
  dashboardHeaderCopy: {
    eyebrow: string;
    title: string;
    text: string;
  };
  languageLabel: string;
  themeLabels: Parameters<typeof DashboardShellHeader>[0]["themeLabels"];
  accountPanelCopy: Parameters<typeof AccountSettingsPanel>[0]["copy"];
  drePanelCopy: Parameters<typeof DreAnalysisPanel>[0]["copy"];
  teamPanelCopy: Parameters<typeof TeamPermissionsPanel>[0]["copy"];
  restaurantNavigatorCopy: {
    eyebrow: string;
    title: string;
    description: string;
  };
  dreAnalysisProps: Omit<Parameters<typeof DreAnalysisPanel>[0], "canManageData" | "copy">;
  dashboardPanelProps: Parameters<typeof DashboardPanels>[0];
  restaurantManagementProps: Omit<Parameters<typeof RestaurantManagementPanel>[0], "session" | "copy" | "onActivateRestaurant">;
  teamManagementProps: Omit<Parameters<typeof TeamPermissionsPanel>[0], "session" | "copy" | "canManageTeam">;
  accountSettingsProps: Omit<
    Parameters<typeof AccountSettingsPanel>[0],
    "session" | "copy" | "onClose" | "onActivateRestaurant" | "canManageRestaurants"
  >;
  canManageRestaurants: boolean;
  canManageOperationalData: boolean;
  canManageTeam: boolean;
  onChangeLocale: (locale: "pt" | "es" | "en") => void;
  onChangeTheme: (theme: "light" | "dark") => void;
  onChangeSection: (section: AppSection) => void;
  onLogout: () => void;
  onOpenAccount: () => void;
  onCloseAccount: () => void;
  onActivateRestaurant: (restaurantId: string) => void;
  logoutLabel: string;
  myAccountLabel: string;
  brandTagline: string;
  processingLabel: string;
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

const fallbackCard = (processingLabel: string) => (
  <section className="card">
    <p className="message">{processingLabel}</p>
  </section>
);

export function DashboardShell({
  locale,
  theme,
  currentSection,
  effectiveSession,
  authError,
  navigationItems,
  dashboardHeaderCopy,
  languageLabel,
  themeLabels,
  accountPanelCopy,
  drePanelCopy,
  teamPanelCopy,
  restaurantNavigatorCopy,
  dreAnalysisProps,
  dashboardPanelProps,
  restaurantManagementProps,
  teamManagementProps,
  accountSettingsProps,
  canManageRestaurants,
  canManageOperationalData,
  canManageTeam,
  onChangeLocale,
  onChangeTheme,
  onChangeSection,
  onLogout,
  onOpenAccount,
  onCloseAccount,
  onActivateRestaurant,
  logoutLabel,
  myAccountLabel,
  brandTagline,
  processingLabel
}: DashboardShellProps) {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-brand">
          <BrandMark tagline={brandTagline} />
        </div>
        <InternalNavigation section={currentSection} onChange={onChangeSection} items={navigationItems} />
        <div className="dashboard-sidebar-footer">
          <button
            type="button"
            className="sidebar-footer-action icon-only"
            onClick={onLogout}
            title={logoutLabel}
            aria-label={logoutLabel}
          >
            <IconLogout />
          </button>
          <button
            type="button"
            className="sidebar-avatar-button"
            onClick={onOpenAccount}
            title={myAccountLabel}
            aria-label={myAccountLabel}
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
            onChangeLocale={onChangeLocale}
            theme={theme}
            onChangeTheme={onChangeTheme}
            languageLabel={languageLabel}
            themeLabels={themeLabels}
          />

          {currentSection === "dashboard" || currentSection === "dre" ? (
            <RestaurantNavigatorPanel
              eyebrow={restaurantNavigatorCopy.eyebrow}
              title={restaurantNavigatorCopy.title}
              description={restaurantNavigatorCopy.description}
              memberships={effectiveSession.memberships ?? []}
              activeRestaurantId={effectiveSession.activeRestaurantId}
              onActivateRestaurant={onActivateRestaurant}
            />
          ) : null}

          {currentSection === "dre" ? (
            <Suspense fallback={fallbackCard(processingLabel)}>
              <LazyDreAnalysisPanel
                data={dreAnalysisProps.data}
                periods={dreAnalysisProps.periods}
                selectedPeriod={dreAnalysisProps.selectedPeriod}
                error={dreAnalysisProps.error}
                processing={dreAnalysisProps.processing}
                canManageData={canManageOperationalData}
                copy={drePanelCopy}
                onImport={dreAnalysisProps.onImport}
                onSelectPeriod={dreAnalysisProps.onSelectPeriod}
              />
            </Suspense>
          ) : null}

          {currentSection === "restaurants" && canManageRestaurants ? (
            <Suspense fallback={fallbackCard(processingLabel)}>
              <LazyRestaurantManagementPanel
                session={effectiveSession}
                copy={accountPanelCopy}
                onActivateRestaurant={onActivateRestaurant}
                {...restaurantManagementProps}
              />
            </Suspense>
          ) : null}

          {currentSection === "team" && canManageTeam ? (
            <Suspense fallback={fallbackCard(processingLabel)}>
              <LazyTeamPermissionsPanel
                session={effectiveSession}
                canManageTeam={Boolean(canManageTeam)}
                copy={teamPanelCopy}
                {...teamManagementProps}
              />
            </Suspense>
          ) : null}

          {currentSection === "account" ? (
            <Suspense fallback={fallbackCard(processingLabel)}>
              <LazyAccountSettingsPanel
                session={effectiveSession}
                canManageRestaurants={false}
                copy={accountPanelCopy}
                onClose={onCloseAccount}
                onActivateRestaurant={onActivateRestaurant}
                {...accountSettingsProps}
              />
            </Suspense>
          ) : null}

          {authError ? (
            <section className="card">
              <p className="message error">{authError}</p>
            </section>
          ) : null}

          {currentSection === "dashboard" ? (
            <Suspense fallback={fallbackCard(processingLabel)}>
              <LazyDashboardPanels {...dashboardPanelProps} />
            </Suspense>
          ) : null}
        </div>
      </main>
    </div>
  );
}
