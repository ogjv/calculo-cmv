import { AuthScreen } from "./appChrome";
import type { Locale } from "../i18n";
import { isSupabaseConfigured } from "../utils/supabase";
import type { ThemeMode } from "../hooks/useThemePreference";
import type { AuthScreenCopy } from "../presentation/contracts";

type AppAccessGateProps = {
  locale: Locale;
  theme: ThemeMode;
  authLoading: boolean;
  authHydrating: boolean;
  authSubmitting: boolean;
  passwordRecoveryActive: boolean;
  authError?: string;
  authScreenCopy: AuthScreenCopy;
  onChangeLocale: (locale: Locale) => void;
  onChangeTheme: (theme: ThemeMode) => void;
  onLogin: (email: string, password: string) => void | Promise<void>;
  onRegister: (fullName: string, email: string, password: string) => void | Promise<void>;
  onForgotPassword: (email: string) => void | Promise<void>;
  onUpdatePassword: (password: string) => void | Promise<void>;
};

export function AppAccessGate({
  locale,
  theme,
  authLoading,
  authHydrating,
  authSubmitting,
  passwordRecoveryActive,
  authError,
  authScreenCopy,
  onChangeLocale,
  onChangeTheme,
  onLogin,
  onRegister,
  onForgotPassword,
  onUpdatePassword
}: AppAccessGateProps) {
  if (!passwordRecoveryActive && (authLoading || authHydrating)) {
    return (
      <div className="app-shell refined auth-shell">
        <section className="card">
          <p className="message">
            {authLoading
              ? "Inicializando acesso e verificando a sua conta..."
              : "Carregando restaurantes e permissões da sua conta..."}
          </p>
        </section>
      </div>
    );
  }

  return (
    <AuthScreen
      locale={locale}
      onChangeLocale={onChangeLocale}
      theme={theme}
      onChangeTheme={onChangeTheme}
      isCloudEnabled={isSupabaseConfigured}
      passwordRecoveryActive={passwordRecoveryActive}
      onLogin={onLogin}
      onRegister={onRegister}
      onForgotPassword={onForgotPassword}
      onUpdatePassword={onUpdatePassword}
      busy={authSubmitting || (passwordRecoveryActive && authLoading)}
      error={authError}
      copy={authScreenCopy}
    />
  );
}
