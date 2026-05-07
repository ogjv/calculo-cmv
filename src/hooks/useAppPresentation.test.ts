import { describe, expect, it } from "vitest";
import { translations } from "../i18n";
import type { AuthSession } from "../types";
import { useAppPresentation } from "./useAppPresentation";

const t = (key: keyof typeof translations.pt) => translations.pt[key];

const ownerSession: AuthSession = {
  userId: "owner-1",
  email: "owner@grest.com",
  authMode: "supabase",
  globalRole: "owner",
  activeAccountRole: "owner",
  activeRole: "owner",
  activeRestaurantId: "r-1",
  activeRestaurantName: "Vista Mar",
  memberships: [
    {
      membershipId: "m-1",
      accountId: "a-1",
      restaurantId: "r-1",
      restaurantName: "Vista Mar",
      role: "owner"
    }
  ]
};

const viewerSession: AuthSession = {
  userId: "viewer-1",
  email: "viewer@grest.com",
  authMode: "supabase",
  globalRole: "user",
  activeAccountRole: "user",
  activeRole: "viewer",
  activeRestaurantId: "r-2",
  activeRestaurantName: "Bistro Centro",
  memberships: [
    {
      membershipId: "m-2",
      accountId: "a-2",
      restaurantId: "r-2",
      restaurantName: "Bistro Centro",
      role: "viewer"
    }
  ]
};

describe("useAppPresentation", () => {
  it("exposes owner navigation and management capabilities", () => {
    const presentation = useAppPresentation({
      currentSection: "dashboard",
      effectiveSession: ownerSession,
      t
    });

    expect(presentation.canManageRestaurants).toBe(true);
    expect(presentation.canManageOperationalData).toBe(true);
    expect(presentation.canManageUserManagement).toBe(true);
    expect(presentation.navigationItems.map((item) => item.key)).toEqual(["dashboard", "dre", "restaurants", "user-management"]);
    expect(presentation.authScreenCopy.fullNameHint).toBe(translations.pt.authFullNameHint);
    expect(presentation.dashboardHeaderCopy.title).toBe("Vista Mar");
  });

  it("limits viewer navigation and falls back to dashboard header on account section", () => {
    const presentation = useAppPresentation({
      currentSection: "account",
      effectiveSession: viewerSession,
      t
    });

    expect(presentation.canManageRestaurants).toBe(false);
    expect(presentation.canManageOperationalData).toBe(false);
    expect(presentation.canManageUserManagement).toBe(false);
    expect(presentation.navigationItems.map((item) => item.key)).toEqual(["dashboard", "dre"]);
    expect(presentation.dashboardHeaderCopy.eyebrow).toBe(translations.pt.navDashboard);
    expect(presentation.dashboardHeaderCopy.text).toContain("Acompanhe os indicadores");
  });
});
