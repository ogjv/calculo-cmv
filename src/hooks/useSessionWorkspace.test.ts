import { describe, expect, it } from "vitest";
import type { AuthSession } from "../types";
import { applyActiveRestaurant } from "./useSessionWorkspace";

describe("applyActiveRestaurant", () => {
  it("keeps all available restaurants visible when switching the active restaurant", () => {
    const session: AuthSession = {
      userId: "user-1",
      email: "user@example.com",
      authMode: "supabase",
      globalRole: "user",
      activeAccountId: "account-a",
      activeAccountRole: "user",
      activeRole: "viewer",
      activeRestaurantId: "restaurant-a",
      activeRestaurantName: "Restaurante A",
      restaurantId: "restaurant-a",
      restaurantName: "Restaurante A",
      memberships: [
        {
          membershipId: "m-1",
          accountId: "account-a",
          restaurantId: "restaurant-a",
          restaurantName: "Restaurante A",
          role: "viewer"
        },
        {
          membershipId: "m-2",
          accountId: undefined,
          restaurantId: "restaurant-b",
          restaurantName: "Restaurante B",
          role: "viewer"
        }
      ]
    };

    const nextSession = applyActiveRestaurant(session, "restaurant-b");

    expect(nextSession.memberships).toHaveLength(2);
    expect(nextSession.activeRestaurantId).toBe("restaurant-b");
    expect(nextSession.activeRestaurantName).toBe("Restaurante B");
  });
});
