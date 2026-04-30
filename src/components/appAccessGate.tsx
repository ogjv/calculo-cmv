import { AuthScreen } from "./appChrome";
import type { Locale } from "../i18n";
import { isSupabaseConfigured } from "../utils/supabase";
import type { ThemeMode } from "../hooks/useThemePreference";

type AppAccessGateProps = {
  locale: Locale;
  theme: ThemeMode;
  authLoading: boolean;
  authHydrating: boolean;
  authSubmitting: boolean;
  authError?: string;
  authScreenCopy: Parameters<typeof AuthScreen>[0]["copy"];
  onChangeLocale: (locale: Locale) => void;
  onChangeTheme: (theme: ThemeMode) => void;
  onLogin: (email: string, password: string) => void | Promise<void>;
  onRegister: (fullName: string, email: string, password: string) => void | Promise<void>;
};

export function AppAccessGate({
  locale,
  theme,
  authLoading,
  authHydrating,
  authSubmitting,
  authError,
  authScreenCopy,
  onChangeLocale,
  onChangeTheme,
  onLogin,
  onRegister
}: AppAccessGateProps) {
  if (authLoading || authHydrating) {
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
      onLogin={onLogin}
      onRegister={onRegister}
      busy={authSubmitting}
      error={authError}
      copy={authScreenCopy}
    />
  );
}
