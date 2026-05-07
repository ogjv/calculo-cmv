import { useState } from "react";
import type { AuthSession } from "../types";
import type { AuthScreenCopy, ThemeLabels, NavigationItem } from "../presentation/contracts";

type Locale = "pt" | "es" | "en";
type ThemeMode = "light" | "dark";
type AppSection = "account" | "dashboard" | "dre" | "restaurants";

type AuthScreenProps = {
  locale: Locale;
  onChangeLocale: (locale: Locale) => void;
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  onLogin: (email: string, password: string) => void | Promise<void>;
  onRegister: (fullName: string, email: string, password: string) => void | Promise<void>;
  error?: string;
  isCloudEnabled: boolean;
  busy?: boolean;
  copy: AuthScreenCopy;
};

type DashboardShellHeaderProps = {
  session: AuthSession;
  eyebrow: string;
  title: string;
  text: string;
  locale: Locale;
  onChangeLocale: (locale: Locale) => void;
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  languageLabel: string;
  themeLabels: ThemeLabels;
};

type InternalNavigationProps = {
  section: AppSection;
  onChange: (section: AppSection) => void;
  items: NavigationItem[];
};

export function BrandMark({ tagline }: { tagline: string }) {
  return (
    <div className="brand-mark" aria-label="G/REST">
      <div className="brand-logo-frame brand-logo-cutout">
        <img src="/grest.png" alt="G/REST" className="brand-logo-image" />
      </div>
      <div className="brand-wordmark">
        <span className="brand-name">G/REST</span>
        <span className="brand-tagline">{tagline}</span>
      </div>
    </div>
  );
}

export function LanguageSwitcher({
  locale,
  onChange,
  label
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
  label: string;
}) {
  const options: Array<{ value: Locale; label: string }> = [
    { value: "pt", label: "PT" },
    { value: "es", label: "ES" },
    { value: "en", label: "EN" }
  ];

  return (
    <div className="language-switcher pill-selector language-pill-selector" aria-label={label}>
      <span className="eyebrow">{label}</span>
      <div className="language-toggle-track" data-active-locale={locale}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`language-toggle-button ${locale === option.value ? "active" : ""}`}
            onClick={() => onChange(option.value)}
            aria-pressed={locale === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ThemeSwitcher({
  theme,
  onChange,
  labels
}: {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
  labels: ThemeLabels;
}) {
  const options: Array<{ value: ThemeMode; label: string }> = [
    { value: "light", label: labels.light },
    { value: "dark", label: labels.dark }
  ];

  return (
    <div className="theme-switcher icon-theme-switcher" aria-label={labels.label}>
      <span className="eyebrow">{labels.label}</span>
      <div className="theme-toggle-track" data-active-theme={theme}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`theme-toggle-button ${theme === option.value ? "active" : ""}`}
            onClick={() => onChange(option.value)}
            title={option.label}
            aria-label={option.label}
            aria-pressed={theme === option.value}
          >
            {option.value === "light" ? <IconSun /> : <IconMoon />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AuthScreen({
  locale,
  onChangeLocale,
  theme,
  onChangeTheme,
  onLogin,
  onRegister,
  error,
  isCloudEnabled,
  busy,
  copy
}: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    if (mode === "login") {
      await onLogin(email, password);
      return;
    }

    await onRegister(fullName, email, password);
  };

  return (
    <div className="app-shell refined auth-shell auth-shell-minimal">
      <section className="auth-card-premium">
        <div className="auth-brand-panel">
          <BrandMark tagline={copy.brandTagline} />
          <div className="auth-brand-copy">
            <h1>{copy.title}</h1>
          </div>
        </div>

        <div className="auth-access-panel">
          <div className="panel-preferences auth-preferences">
            <LanguageSwitcher locale={locale} onChange={onChangeLocale} label={copy.language} />
            <ThemeSwitcher theme={theme} onChange={onChangeTheme} labels={copy} />
          </div>

          <div className="auth-tabs auth-mode-switch" aria-label="Tipo de acesso">
            <button
              type="button"
              className={`auth-tab-button ${mode === "login" ? "active" : ""}`}
              onClick={() => setMode("login")}
            >
              {copy.loginTab}
            </button>
            <button
              type="button"
              className={`auth-tab-button ${mode === "register" ? "active" : ""}`}
              onClick={() => setMode("register")}
            >
              {copy.registerTab}
            </button>
          </div>

          <div key={mode} className={`auth-form auth-form-transition ${mode}`}>
            {mode === "register" ? (
              <label className="auth-field auth-field-premium">
                <span>{copy.fullName}</span>
                <div className="auth-input-shell">
                  <IconUser />
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Ex: João Silva"
                    autoComplete="name"
                    disabled={busy}
                  />
                </div>
                <small>{copy.fullNameHint}</small>
              </label>
            ) : null}

            <label className="auth-field auth-field-premium">
              <span>{copy.email}</span>
              <div className="auth-input-shell">
                <IconMail />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="contato@restaurante.com"
                  autoComplete="email"
                  inputMode="email"
                  disabled={busy}
                />
              </div>
            </label>

            <label className="auth-field auth-field-premium">
              <span>{copy.password}</span>
              <div className="auth-input-shell">
                <IconLock />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  disabled={busy}
                />
              </div>
            </label>

            {error ? <p className="message error">{error}</p> : null}

            <button type="button" className="primary-button auth-submit-button" onClick={() => void handleSubmit()} disabled={busy}>
              <span>{busy ? copy.processing : mode === "login" ? copy.submitLogin : copy.submitRegister}</span>
              <IconArrowRight />
            </button>

            {!isCloudEnabled ? <p className="message auth-status-message">{copy.demoHint}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function DashboardShellHeader({
  session,
  eyebrow,
  title,
  text,
  locale,
  onChangeLocale,
  theme,
  onChangeTheme,
  languageLabel,
  themeLabels
}: DashboardShellHeaderProps) {
  return (
    <section className="card workspace-topbar dashboard-shell-topbar">
      <div className="dashboard-shell-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h1>Olá, {session.userFullName ?? session.email}!</h1>
        <strong className="dashboard-shell-subtitle">{title}</strong>
        <p>{text}</p>
      </div>

      <div className="dashboard-shell-topbar-actions">
        <LanguageSwitcher locale={locale} onChange={onChangeLocale} label={languageLabel} />
        <ThemeSwitcher theme={theme} onChange={onChangeTheme} labels={themeLabels} />
      </div>
    </section>
  );
}

export function InternalNavigation({ section, onChange, items }: InternalNavigationProps) {
  return (
    <nav className="internal-sidebar-nav" aria-label="Navegação principal">
      <div className="internal-sidebar-nav-list">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-nav-item ${section === item.key ? "active" : ""}`}
            onClick={() => onChange(item.key)}
            title={item.label}
            aria-label={item.label}
          >
            <span className="sidebar-nav-icon">{getNavigationIcon(item.key)}</span>
            <span className="sidebar-nav-text">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function ProfileAvatar({
  session,
  size = "md"
}: {
  session: AuthSession;
  size?: "sm" | "md" | "lg";
}) {
  const classes = `profile-avatar ${size} ${session.profilePhotoUrl ? "has-photo" : ""}`;
  const restaurantLabel = session.restaurantName ?? session.activeRestaurantName ?? "Restaurante";

  return (
    <div className={classes} aria-hidden="true">
      {session.profilePhotoUrl ? (
        <img src={session.profilePhotoUrl} alt={restaurantLabel} />
      ) : (
        <img src="/grest.png" alt="G/REST" className="brand-logo-image cutout" />
      )}
    </div>
  );
}

export function UserAvatar({
  session,
  size = "md"
}: {
  session: AuthSession;
  size?: "sm" | "md" | "lg";
}) {
  const classes = `profile-avatar ${size} ${session.userPhotoUrl ? "has-photo" : ""}`;
  const userLabel = session.userFullName?.trim() || session.email || "Usuario";

  return (
    <div className={classes}>
      {session.userPhotoUrl ? (
        <img src={session.userPhotoUrl} alt={userLabel} />
      ) : (
        <span>{userLabel.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function getNavigationIcon(section: AppSection) {
  switch (section) {
    case "dashboard":
      return <IconDashboardNav />;
    case "dre":
      return <IconDreNav />;
    case "restaurants":
      return <IconBuildingNav />;
    default:
      return <IconDashboardNav />;
  }
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2" />
      <path d="M12 19.2v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m17.7 17.7 1.4 1.4" />
      <path d="M2.8 12h2" />
      <path d="M19.2 12h2" />
      <path d="m4.9 19.1 1.4-1.4" />
      <path d="m17.7 6.3 1.4-1.4" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M20.2 15.3A7.9 7.9 0 0 1 8.7 3.8 8.6 8.6 0 1 0 20.2 15.3Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 17 19H7a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
      <path d="m5.5 7 6.5 5 6.5-5" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M7 10V8a5 5 0 0 1 10 0v2" />
      <path d="M6.5 10h11A1.5 1.5 0 0 1 19 11.5v6A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5v-6A1.5 1.5 0 0 1 6.5 10Z" />
      <path d="M12 14v2" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M5 20c.8-3.4 3.3-5.2 7-5.2s6.2 1.8 7 5.2" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function IconDashboardNav() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="4" rx="2" />
      <rect x="13" y="10" width="7" height="10" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
    </svg>
  );
}

function IconDreNav() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon ui-icon-solid" aria-hidden="true">
      <path d="M6.375 6C6.375 5.65482 6.65482 5.375 7 5.375H13C13.3452 5.375 13.625 5.65482 13.625 6C13.625 6.34518 13.3452 6.625 13 6.625H7C6.65482 6.625 6.375 6.34518 6.375 6Z" />
      <path d="M6.375 10C6.375 9.65482 6.65482 9.375 7 9.375H11C11.3452 9.375 11.625 9.65482 11.625 10C11.625 10.3452 11.3452 10.625 11 10.625H7C6.65482 10.625 6.375 10.3452 6.375 10Z" />
      <path d="M15 9.375C14.6548 9.375 14.375 9.65482 14.375 10C14.375 10.3452 14.6548 10.625 15 10.625H17C17.3452 10.625 17.625 10.3452 17.625 10C17.625 9.65482 17.3452 9.375 17 9.375H15Z" />
      <path d="M6.375 13C6.375 12.6548 6.65482 12.375 7 12.375H12C12.3452 12.375 12.625 12.6548 12.625 13C12.625 13.3452 12.3452 13.625 12 13.625H7C6.65482 13.625 6.375 13.3452 6.375 13Z" />
      <path d="M15 12.375C14.6548 12.375 14.375 12.6548 14.375 13C14.375 13.3452 14.6548 13.625 15 13.625H17C17.3452 13.625 17.625 13.3452 17.625 13C17.625 12.6548 17.3452 12.375 17 12.375H15Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M4.625 3C4.625 2.79289 4.79289 2.625 5 2.625H15.375V6C15.375 6.89746 16.1025 7.625 17 7.625H19.375V13.375C19.375 13.5131 19.4869 13.625 19.625 13.625H20.375C20.5131 13.625 20.625 13.5131 20.625 13.375V6.78076L16.3004 1.375H5C4.10254 1.375 3.375 2.10254 3.375 3V19C3.375 19.8975 4.10254 20.625 5 20.625H15.75C15.8881 20.625 16 20.5131 16 20.375V19.625C16 19.4869 15.8881 19.375 15.75 19.375H5C4.79289 19.375 4.625 19.2071 4.625 19V3ZM18.6996 6.375L16.625 3.78174V6C16.625 6.20711 16.7929 6.375 17 6.375H18.6996Z" />
      <path d="M18.9403 20.9511C18.6027 20.9511 18.2794 20.891 17.9703 20.7709C17.6613 20.6507 17.401 20.4905 17.1892 20.2902C16.9832 20.0899 16.8602 19.8725 16.8201 19.6378L18.0223 19.3047C18.148 19.2699 18.2763 19.3414 18.3563 19.4445C18.3909 19.4891 18.431 19.5307 18.4768 19.5692C18.5912 19.6607 18.74 19.7122 18.9231 19.7237C19.0662 19.7294 19.1921 19.6922 19.3008 19.6121C19.4153 19.5263 19.4725 19.4147 19.4725 19.2773C19.4725 19.1915 19.4381 19.1085 19.3695 19.0284C19.3065 18.9483 19.2064 18.8911 19.069 18.8567L18.2536 18.6507C17.9732 18.5763 17.7329 18.4648 17.5326 18.316C17.338 18.1672 17.1892 17.9841 17.0862 17.7666C16.9832 17.5492 16.9317 17.306 16.9317 17.037C16.9317 16.5105 17.1063 16.0985 17.4553 15.801C17.8101 15.5034 18.3051 15.3546 18.9403 15.3546C19.2779 15.3546 19.5755 15.3975 19.833 15.4834C20.0962 15.5692 20.3223 15.7066 20.5111 15.8954C20.65 16.0302 20.77 16.1957 20.8709 16.3918C20.9384 16.5227 20.8608 16.677 20.7192 16.7174L19.8188 16.9739C19.6816 17.0129 19.534 16.9269 19.4406 16.8191C19.4194 16.7946 19.3957 16.77 19.3695 16.7452C19.2665 16.6364 19.1234 16.5821 18.9403 16.5821C18.7686 16.5821 18.6341 16.6221 18.5369 16.7022C18.4453 16.7766 18.3995 16.8882 18.3995 17.037C18.3995 17.1286 18.4367 17.2087 18.5111 17.2774C18.5912 17.346 18.7028 17.4004 18.8459 17.4404L19.6613 17.655C20.0733 17.7638 20.3938 17.9669 20.6227 18.2645C20.8573 18.5563 20.9746 18.8968 20.9746 19.2859C20.9746 19.6407 20.8916 19.944 20.7257 20.1958C20.5655 20.4418 20.3337 20.6307 20.0304 20.7623C19.7271 20.8882 19.3637 20.9511 18.9403 20.9511ZM18.598 22.0413C18.46 22.0413 18.348 21.9293 18.348 21.7913V20.3503H19.5841V21.7913C19.5841 21.9293 19.4721 22.0413 19.3341 22.0413H18.598ZM18.348 16.1529V14.7119C18.348 14.5739 18.46 14.4619 18.598 14.4619H19.3341C19.4721 14.4619 19.5841 14.5739 19.5841 14.7119V16.1529H18.348Z" />
    </svg>
  );
}

function IconBuildingNav() {
  return (
    <svg viewBox="0 0 24 24" className="ui-icon" aria-hidden="true">
      <path d="M5 20V6.5c0-.8.4-1.4 1.1-1.7l5.3-2.1c.8-.3 1.6.3 1.6 1.1V20" />
      <path d="M13 20V10.4c0-.7.6-1.3 1.3-1.3H18c.6 0 1 .4 1 1V20" />
      <path d="M8 8h2" />
      <path d="M8 11.5h2" />
      <path d="M8 15h2" />
      <path d="M15.5 12.5h1.5" />
      <path d="M15.5 15.5h1.5" />
    </svg>
  );
}
