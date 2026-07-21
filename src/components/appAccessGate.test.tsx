import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppAccessGate } from "./appAccessGate";
import { translations } from "../i18n";

const authScreenCopy = {
  brandTagline: translations.pt.brandTagline,
  title: translations.pt.authTitle,
  loginTab: translations.pt.authLoginTab,
  registerTab: translations.pt.authRegisterTab,
  fullName: translations.pt.authFullName,
  fullNameHint: translations.pt.authFullNameHint,
  email: translations.pt.authEmail,
  password: translations.pt.authPassword,
  forgotPassword: translations.pt.authForgotPassword,
  forgotPasswordHint: translations.pt.authForgotPasswordHint,
  forgotPasswordSent: translations.pt.authForgotPasswordSent,
  resetPasswordTitle: translations.pt.authResetPasswordTitle,
  resetPasswordText: translations.pt.authResetPasswordText,
  newPassword: translations.pt.authNewPassword,
  confirmPassword: translations.pt.authConfirmPassword,
  updatePassword: translations.pt.authUpdatePassword,
  passwordMismatch: translations.pt.authPasswordMismatch,
  passwordUpdated: translations.pt.authPasswordUpdated,
  processing: translations.pt.processing,
  submitLogin: translations.pt.authSubmitLogin,
  submitRegister: translations.pt.authSubmitRegister,
  demoHint: translations.pt.authDemoHint,
  language: translations.pt.language,
  label: translations.pt.theme,
  light: translations.pt.themeLight,
  dark: translations.pt.themeDark
};

describe("AppAccessGate", () => {
  it("renders bootstrap feedback while authentication is loading", () => {
    const html = renderToStaticMarkup(
      <AppAccessGate
        locale="pt"
        theme="light"
        authLoading
        authHydrating={false}
        authSubmitting={false}
        passwordRecoveryActive={false}
        authScreenCopy={authScreenCopy}
        onChangeLocale={() => undefined}
        onChangeTheme={() => undefined}
        onLogin={() => undefined}
        onRegister={() => undefined}
        onForgotPassword={() => undefined}
        onUpdatePassword={() => undefined}
      />
    );

    expect(html).toContain("Inicializando acesso e verificando a sua conta");
    expect(html).not.toContain(translations.pt.authEmail);
  });

  it("renders the auth screen when the app is ready for login", () => {
    const html = renderToStaticMarkup(
      <AppAccessGate
        locale="pt"
        theme="light"
        authLoading={false}
        authHydrating={false}
        authSubmitting={false}
        passwordRecoveryActive={false}
        authError="Falha de teste"
        authScreenCopy={authScreenCopy}
        onChangeLocale={() => undefined}
        onChangeTheme={() => undefined}
        onLogin={() => undefined}
        onRegister={() => undefined}
        onForgotPassword={() => undefined}
        onUpdatePassword={() => undefined}
      />
    );

    expect(html).toContain(translations.pt.authTitle);
    expect(html).toContain(translations.pt.authLoginTab);
    expect(html).toContain(translations.pt.authEmail);
    expect(html).toContain(translations.pt.authForgotPassword);
    expect(html).toContain("Falha de teste");
  });

  it("renders the password recovery form when recovery is active", () => {
    const html = renderToStaticMarkup(
      <AppAccessGate
        locale="pt"
        theme="light"
        authLoading={false}
        authHydrating={false}
        authSubmitting={false}
        passwordRecoveryActive
        authScreenCopy={authScreenCopy}
        onChangeLocale={() => undefined}
        onChangeTheme={() => undefined}
        onLogin={() => undefined}
        onRegister={() => undefined}
        onForgotPassword={() => undefined}
        onUpdatePassword={() => undefined}
      />
    );

    expect(html).toContain(translations.pt.authResetPasswordTitle);
    expect(html).toContain(translations.pt.authUpdatePassword);
    expect(html).not.toContain(translations.pt.authLoginTab);
  });
});
