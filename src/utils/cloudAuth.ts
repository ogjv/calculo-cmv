import type { User } from "@supabase/supabase-js";
import type { AccountInvitation, AccountMember, AuthSession, PersistedWorkspace, RestaurantMembership } from "../types";
import { supabase } from "./supabase";

type LegacyGlobalRole = "owner" | "admin" | "user";
type LegacyAccountRole = "owner" | "admin" | "user";
type LegacyRestaurantRole = "owner" | "admin" | "viewer";

type RegisterRestaurantInput = {
  fullName: string;
  email: string;
  password: string;
};

type MembershipRow = {
  id: string;
  role: LegacyRestaurantRole;
  restaurants:
    | {
        id: string;
        account_id?: string | null;
        name: string;
        photo_url: string | null;
      }
    | {
        id: string;
        account_id?: string | null;
        name: string;
        photo_url: string | null;
      }[]
    | null;
};

type UserProfileRow = {
  global_role?: LegacyGlobalRole | null;
  email?: string | null;
  full_name: string | null;
  photo_url: string | null;
};

type AccountMembershipRow = {
  id: string;
  account_id: string;
  user_id: string;
  role: LegacyAccountRole;
};

type RestaurantMembershipAccessRow = {
  user_id: string;
  role: LegacyRestaurantRole;
  restaurants:
    | {
        id: string;
        account_id?: string | null;
        name: string;
      }
    | {
        id: string;
        account_id?: string | null;
        name: string;
      }[]
    | null;
};

type AccountInvitationRow = {
  id: string;
  account_id: string;
  email: string;
  account_role: LegacyAccountRole;
  restaurant_role: LegacyRestaurantRole;
  status: "pending" | "accepted" | "revoked";
  created_at: string;
};

type AccountInvitationRestaurantRow = {
  invitation_id: string;
  restaurants:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type AuthSessionContext = {
  profile?: UserProfileRow | null;
  memberships?: RestaurantMembership[];
  accountMemberships?: AccountMembershipRow[];
};

const normalizeAccountRoleForProfile = (
  role: LegacyAccountRole | undefined,
  globalRole: LegacyGlobalRole | undefined
): "owner" | "user" | undefined => {
  if (!role) {
    return role;
  }

  if (globalRole === "owner" || role === "owner") {
    return "owner";
  }

  return "user";
};

const normalizeRestaurantRoleForProfile = (
  role: LegacyRestaurantRole,
  globalRole: LegacyGlobalRole | undefined
): "owner" | "viewer" => {
  if (globalRole === "owner" || role === "owner") {
    return "owner";
  }

  return "viewer";
};

const normalizeGlobalRole = (role: LegacyGlobalRole | null | undefined): "owner" | "user" =>
  role === "owner" ? "owner" : "user";

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildRestaurantId = (restaurantName: string, email: string) => {
  const fromName = slugify(restaurantName);
  if (fromName) {
    return fromName;
  }

  return slugify(email.split("@")[0] ?? "restaurante") || "restaurante";
};

const isNetworkFailureMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("load failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed")
  );
};

const asError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    if (isNetworkFailureMessage(error.message)) {
      return new Error(
        "Não foi possível conectar ao servidor agora. Verifique a internet do celular e tente novamente."
      );
    }

    return new Error(error.message);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message;
    if (isNetworkFailureMessage(message)) {
      return new Error(
        "Não foi possível conectar ao servidor agora. Verifique a internet do celular e tente novamente."
      );
    }

    return new Error(message);
  }

  return new Error(fallback);
};

const mapMembership = (row: MembershipRow): RestaurantMembership | null => {
  const restaurant = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;
  if (!restaurant) {
    return null;
  }

  return {
    membershipId: row.id,
    accountId: restaurant.account_id ?? undefined,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    role: normalizeRestaurantRoleForProfile(row.role, undefined),
    photoUrl: restaurant.photo_url ?? undefined
  };
};

const toBaseAuthSession = (user: User): AuthSession => ({
  userId: user.id,
  email: user.email ?? "",
  authMode: "supabase"
});

const loadUserProfile = async (userId: string) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("global_role, email, full_name, photo_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw asError(error, "Não foi possível carregar o perfil do usuário.");
  }

  return (data as UserProfileRow | null) ?? null;
};

const loadMemberships = async (userId: string) => {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("restaurant_memberships")
    .select("id, role, restaurants(id, account_id, name, photo_url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw asError(error, "Não foi possível carregar os restaurantes vinculados.");
  }

  return ((data ?? []) as unknown as MembershipRow[])
    .map(mapMembership)
    .filter((membership): membership is RestaurantMembership => Boolean(membership));
};

const loadAllRestaurantsForGlobalOwner = async () => {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_restaurants_for_global_owner");

  if (error) {
    throw asError(error, "NÃ£o foi possÃ­vel carregar os restaurantes do sistema.");
  }

  return ((data ?? []) as Array<{ id: string; account_id?: string | null; name: string; photo_url?: string | null }>).map(
    (restaurant) => ({
      membershipId: `global-owner-${restaurant.id}`,
      accountId: restaurant.account_id ?? undefined,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      role: "owner" as const,
      photoUrl: restaurant.photo_url ?? undefined
    })
  );
};

const loadAccountMemberships = async (userId: string) => {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("account_memberships")
    .select("id, account_id, user_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw asError(error, "NÃ£o foi possÃ­vel carregar as permissÃµes da conta.");
  }

  return (data ?? []) as AccountMembershipRow[];
};

const ensureUserProfile = async (user: User) => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const existingProfile = await loadUserProfile(user.id);
  if (existingProfile?.email === (user.email ?? null)) {
    return existingProfile;
  }

  const nextProfile: UserProfileRow = {
    global_role: normalizeGlobalRole(existingProfile?.global_role),
    email: user.email ?? null,
    full_name:
      existingProfile?.full_name ??
      (typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : null),
    photo_url:
      existingProfile?.photo_url ??
      (typeof user.user_metadata.photo_url === "string" ? user.user_metadata.photo_url : null)
  };

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      ...nextProfile
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw asError(error, "Não foi possível preparar o perfil do usuário.");
  }
  return nextProfile;
};

const createInitialRestaurantForUser = async (user: User, restaurantName?: string) => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const nextRestaurantName =
    restaurantName?.trim() ||
    (typeof user.user_metadata.restaurant_name === "string" ? user.user_metadata.restaurant_name.trim() : "") ||
    user.email?.split("@")[0] ||
    "Restaurante";

  const slug = buildRestaurantId(nextRestaurantName, user.email ?? user.id);
  const photoUrl =
    typeof user.user_metadata.photo_url === "string" && user.user_metadata.photo_url.trim()
      ? user.user_metadata.photo_url.trim()
      : null;

  const { data, error } = await supabase.rpc("bootstrap_restaurant_for_current_user", {
    restaurant_name: nextRestaurantName,
    restaurant_slug: slug,
    restaurant_photo_url: photoUrl
  });

  if (error) {
    throw asError(error, "Não foi possível criar o restaurante inicial.");
  }

  return data;
};

const ensurePrimaryRestaurantContext = async (user: User, restaurantNameOverride?: string) => {
  const profile = await ensureUserProfile(user);
  await acceptPendingAccountInvitations();
  void restaurantNameOverride;
  if (normalizeGlobalRole(profile?.global_role) === "owner") {
    return loadAllRestaurantsForGlobalOwner();
  }

  return loadMemberships(user.id);
};

const acceptPendingAccountInvitations = async () => {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.rpc("accept_pending_account_invitations_for_current_user");
  if (error) {
    throw asError(error, "NÃ£o foi possÃ­vel validar os convites pendentes da conta.");
  }
};

const loadAuthSessionContext = async (
  user: User,
  restaurantNameOverride?: string
): Promise<AuthSessionContext> => {
  const profile = await ensureUserProfile(user);
  await acceptPendingAccountInvitations();
  void restaurantNameOverride;

  const globalRole = normalizeGlobalRole(profile?.global_role);
  const [memberships, accountMemberships] = await Promise.all([
    globalRole === "owner" ? loadAllRestaurantsForGlobalOwner() : loadMemberships(user.id),
    loadAccountMemberships(user.id)
  ]);

  return { profile, memberships, accountMemberships };
};

const toAuthSession = async (
  user: User,
  options?: {
    activeRestaurantId?: string;
    memberships?: RestaurantMembership[];
    profile?: UserProfileRow | null;
    accountMemberships?: AccountMembershipRow[];
  }
): Promise<AuthSession> => {
  const profile = options?.profile ?? (await loadUserProfile(user.id));
  const globalRole = normalizeGlobalRole(profile?.global_role);
  const [memberships, accountMemberships] = await Promise.all([
    options?.memberships ??
      (globalRole === "owner" ? loadAllRestaurantsForGlobalOwner() : loadMemberships(user.id)),
    options?.accountMemberships ?? loadAccountMemberships(user.id)
  ]);
  const normalizedMemberships =
    globalRole === "owner"
      ? memberships
      : memberships.map((membership) => ({
          ...membership,
          role: normalizeRestaurantRoleForProfile(membership.role, globalRole)
        }));
  const activeMembership =
    normalizedMemberships.find((membership) => membership.restaurantId === options?.activeRestaurantId) ??
    normalizedMemberships[0];
  const resolvedActiveAccountId = activeMembership?.accountId ?? accountMemberships[0]?.account_id;
  const activeAccountMembership = accountMemberships.find(
    (membership) => membership.account_id === resolvedActiveAccountId
  );

  return {
    userId: user.id,
    email: user.email ?? "",
    authMode: "supabase",
    globalRole,
    activeAccountId: resolvedActiveAccountId,
    userFullName:
      profile?.full_name ??
      (typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : undefined) ??
      activeMembership?.restaurantName,
    userPhotoUrl:
      profile?.photo_url ??
      (typeof user.user_metadata.photo_url === "string" ? user.user_metadata.photo_url : undefined),
    memberships: normalizedMemberships,
    activeAccountRole:
      globalRole === "owner"
        ? "owner"
        : normalizeAccountRoleForProfile(activeAccountMembership?.role, globalRole),
    activeRole: activeMembership?.role,
    activeRestaurantId: activeMembership?.restaurantId,
    activeRestaurantName: activeMembership?.restaurantName,
    activeRestaurantPhotoUrl: activeMembership?.photoUrl,
    restaurantId: activeMembership?.restaurantId,
    restaurantName: activeMembership?.restaurantName,
    profilePhotoUrl: activeMembership?.photoUrl
  };
};

export const loadAccountMembers = async (accountId: string): Promise<AccountMember[]> => {
  if (!supabase || !accountId) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("user_id, global_role, email, full_name, photo_url")
    .order("created_at", { ascending: true });

  const filteredProfilesError = profilesError;
  if (profilesError) {
    throw asError(filteredProfilesError, "NÃ£o foi possÃ­vel carregar os perfis da equipe.");
  }

  const visibleProfiles = (profiles ?? []) as Array<{
    user_id: string;
    global_role?: LegacyGlobalRole | null;
    email?: string | null;
    full_name: string | null;
    photo_url: string | null;
  }>;

  const { data, error } = await supabase
    .from("account_memberships")
    .select("id, account_id, user_id, role")
    .order("created_at", { ascending: true });

  if (error) {
    throw asError(error, "Não foi possível carregar os membros da conta.");
  }

  const memberships = (data ?? []) as AccountMembershipRow[];
  if (memberships.length === 0 && visibleProfiles.length === 0) {
    return [];
  }

  const userIds = [...new Set([...memberships.map((item) => item.user_id), ...visibleProfiles.map((item) => item.user_id)])];
  const profileMap = new Map(visibleProfiles.map((item) => [item.user_id, item]));

  const { data: restaurantMemberships, error: restaurantMembershipsError } = await supabase
    .from("restaurant_memberships")
    .select("user_id, role, restaurants(id, account_id, name)")
    .in("user_id", userIds);

  if (restaurantMembershipsError) {
    throw asError(restaurantMembershipsError, "NÃ£o foi possÃ­vel carregar os acessos aos restaurantes.");
  }

  const restaurantsByUser = new Map<
    string,
    Array<{
      restaurantId: string;
      restaurantName: string;
      role: "owner" | "viewer";
    }>
  >();

  ((restaurantMemberships ?? []) as RestaurantMembershipAccessRow[]).forEach((membership) => {
    const restaurant = Array.isArray(membership.restaurants) ? membership.restaurants[0] : membership.restaurants;
    if (!restaurant) {
      return;
    }

    const current = restaurantsByUser.get(membership.user_id) ?? [];
    const profile = profileMap.get(membership.user_id);
    current.push({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      role: normalizeRestaurantRoleForProfile(membership.role, normalizeGlobalRole(profile?.global_role))
    });
    restaurantsByUser.set(membership.user_id, current);
  });

  const membershipByUser = new Map<string, AccountMembershipRow>();
  memberships.forEach((membership) => {
    const current = membershipByUser.get(membership.user_id);
    if (!current || membership.account_id === accountId) {
      membershipByUser.set(membership.user_id, membership);
    }
  });

  return userIds.map((userId) => {
    const profile = profileMap.get(userId);
    const membership = membershipByUser.get(userId);
    const globalRole = normalizeGlobalRole(profile?.global_role);
    return {
      membershipId: membership?.id ?? `profile-${userId}`,
      accountId: membership?.account_id ?? accountId,
      userId,
      role: globalRole === "owner" ? "owner" : "user",
      fullName: profile?.full_name ?? undefined,
      email: profile?.email ?? undefined,
      photoUrl: profile?.photo_url ?? undefined,
      restaurants:
        restaurantsByUser.get(userId)?.sort((left, right) => left.restaurantName.localeCompare(right.restaurantName)) ??
        []
    };
  });
};

export const loadAccountInvitations = async (accountId: string): Promise<AccountInvitation[]> => {
  if (!supabase || !accountId) {
    return [];
  }

  const { data, error } = await supabase
    .from("account_invitations")
    .select("id, account_id, email, account_role, restaurant_role, status, created_at")
    .eq("account_id", accountId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw asError(error, "NÃ£o foi possÃ­vel carregar os convites da conta.");
  }

  const invitations = (data ?? []) as AccountInvitationRow[];
  if (invitations.length === 0) {
    return [];
  }

  const invitationIds = invitations.map((invitation) => invitation.id);
  const { data: invitationRestaurants, error: invitationRestaurantsError } = await supabase
    .from("account_invitation_restaurants")
    .select("invitation_id, restaurants(id, name)")
    .in("invitation_id", invitationIds);

  if (invitationRestaurantsError) {
    throw asError(invitationRestaurantsError, "NÃ£o foi possÃ­vel carregar os restaurantes dos convites.");
  }

  const restaurantsByInvitation = new Map<string, Array<{ restaurantId: string; restaurantName: string }>>();
  ((invitationRestaurants ?? []) as AccountInvitationRestaurantRow[]).forEach((row) => {
    const restaurant = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;
    if (!restaurant) {
      return;
    }

    const current = restaurantsByInvitation.get(row.invitation_id) ?? [];
    current.push({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name
    });
    restaurantsByInvitation.set(row.invitation_id, current);
  });

  return invitations.map((invitation) => ({
    invitationId: invitation.id,
    accountId: invitation.account_id,
    email: invitation.email,
    accountRole: normalizeAccountRoleForProfile(invitation.account_role, undefined) ?? "user",
    restaurantRole: normalizeRestaurantRoleForProfile(invitation.restaurant_role, undefined),
    status: invitation.status,
    createdAt: invitation.created_at,
    restaurants:
      restaurantsByInvitation.get(invitation.id)?.sort((left, right) => left.restaurantName.localeCompare(right.restaurantName)) ?? []
  }));
};

export const createAccountInvitation = async ({
  email,
  accountRole,
  restaurantRole,
  restaurantIds
}: {
  email: string;
  accountRole: "user";
  restaurantRole: "viewer";
  restaurantIds: string[];
}) => {
  if (!supabase) {
    throw new Error("Supabase nÃ£o configurado.");
  }

  const nextEmail = email.trim().toLowerCase();
  if (!nextEmail) {
    throw new Error("Informe o e-mail do usuÃ¡rio.");
  }

  if (restaurantIds.length === 0) {
    throw new Error("Selecione ao menos um restaurante para este acesso.");
  }

  const { data, error } = await supabase.rpc("create_account_invitation_for_current_user", {
    target_email: nextEmail,
    target_account_role: accountRole,
    target_restaurant_role: restaurantRole,
    target_restaurant_ids: restaurantIds
  });

  if (error) {
    throw asError(error, "NÃ£o foi possÃ­vel criar o convite.");
  }

  return typeof data === "string" ? data : undefined;
};

export const revokeAccountInvitation = async (invitationId: string) => {
  if (!supabase) {
    throw new Error("Supabase nÃ£o configurado.");
  }

  const { error } = await supabase.rpc("revoke_account_invitation_for_current_user", {
    target_invitation_id: invitationId
  });

  if (error) {
    throw asError(error, "NÃ£o foi possÃ­vel revogar o convite.");
  }
};

export const updateAccountMemberAccess = async ({
  accountId,
  userId,
  accountRole,
  restaurantRole,
  restaurantIds
}: {
  accountId: string;
  userId: string;
  accountRole: "user";
  restaurantRole: "viewer";
  restaurantIds: string[];
}) => {
  if (!supabase) {
    throw new Error("Supabase nÃƒÂ£o configurado.");
  }

  if (!accountId) {
    throw new Error("NÃ£o foi possÃ­vel identificar a conta deste membro.");
  }

  if (!userId) {
    throw new Error("NÃ£o foi possÃ­vel identificar o membro selecionado.");
  }

  const { data, error } = await supabase.rpc("update_account_member_for_current_user", {
    target_account_id: accountId,
    target_user_id: userId,
    target_account_role: accountRole,
    target_restaurant_role: restaurantRole,
    target_restaurant_ids: restaurantIds
  });

  if (error) {
    throw asError(error, "NÃ£o foi possÃ­vel atualizar o acesso do membro.");
  }

  return typeof data === "string" ? data : undefined;
};

export const removeAccountMemberAccess = async ({
  accountId,
  userId
}: {
  accountId: string;
  userId: string;
}) => {
  if (!supabase) {
    throw new Error("Supabase nÃ£o configurado.");
  }

  if (!accountId) {
    throw new Error("NÃ£o foi possÃ­vel identificar a conta deste membro.");
  }

  if (!userId) {
    throw new Error("NÃ£o foi possÃ­vel identificar o membro selecionado.");
  }

  const { data, error } = await supabase.rpc("remove_account_member_for_current_user", {
    target_account_id: accountId,
    target_user_id: userId
  });

  if (error) {
    throw asError(error, "NÃ£o foi possÃ­vel remover o acesso do membro.");
  }

  return typeof data === "string" ? data : undefined;
};

export const getSupabaseSession = async () => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw asError(error, "Não foi possível restaurar a sessão.");
  }

  const user = data.session?.user;
  if (!user) {
    return null;
  }

  const context = await loadAuthSessionContext(user);
  return toAuthSession(user, context);
};

export const hydrateSupabaseSession = async (
  session: AuthSession,
  restaurantNameOverride?: string
) => {
  if (!supabase) {
    return session;
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw asError(error, "Não foi possível carregar os restaurantes da conta.");
  }

  if (!user) {
    return null;
  }

  const context = await loadAuthSessionContext(user, restaurantNameOverride);
  return toAuthSession(user, {
    ...context,
    activeRestaurantId: session.activeRestaurantId ?? session.restaurantId
  });
};

export const subscribeToSupabaseAuth = (callback: (session: AuthSession | null) => void) => {
  if (!supabase) {
    return () => undefined;
  }

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user;
    if (!user) {
      callback(null);
      return;
    }

    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      return;
    }

    void loadAuthSessionContext(user)
      .then((context) => toAuthSession(user, context))
      .then((nextSession) => callback(nextSession))
      .catch(() => callback(toBaseAuthSession(user)));
  });

  return () => subscription.unsubscribe();
};

export const signInWithSupabase = async (email: string, password: string) => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw asError(error, "Não foi possível iniciar a sessão.");
  }

  const user = data.user;
  if (!user) {
    throw new Error("Não foi possível iniciar a sessão.");
  }

  const context = await loadAuthSessionContext(user);
  return toAuthSession(user, context);
};

export const registerRestaurantWithSupabase = async ({
  fullName,
  email,
  password
}: RegisterRestaurantInput) => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        restaurant_name: fullName
      }
    }
  });

  if (error) {
    throw asError(error, "Não foi possível criar a conta.");
  }

  const user = data.user;
  if (!user) {
    throw new Error("Não foi possível criar a conta.");
  }

  if (!data.session) {
    throw new Error("Conta criada com sucesso. Confirme o e-mail enviado pelo Supabase e depois faça login.");
  }

  const context = await loadAuthSessionContext(user, fullName);
  return toAuthSession(user, context);
};

export const signOutFromSupabase = async () => {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw asError(error, "Não foi possível encerrar a sessão.");
  }
};

export const loadCloudWorkspace = async (restaurantId: string) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("restaurant_workspaces")
    .select("locale, state, upload_feedback, selected_period, selected_view")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    throw asError(error, "Não foi possível carregar a base online.");
  }

  if (!data) {
    return null;
  }

  const state = data.state as PersistedWorkspace["state"] & {
    drePeriods?: PersistedWorkspace["drePeriods"];
    selectedDrePeriod?: PersistedWorkspace["selectedDrePeriod"];
  };

  return {
    locale: data.locale,
    state,
    uploadFeedback: data.upload_feedback,
    selectedPeriod: data.selected_period,
    selectedView: data.selected_view,
    drePeriods: state?.drePeriods ?? [],
    selectedDrePeriod: state?.selectedDrePeriod
  } as PersistedWorkspace;
};

export const saveCloudWorkspace = async (restaurantId: string, workspace: PersistedWorkspace) => {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("restaurant_workspaces").upsert(
    {
      restaurant_id: restaurantId,
      locale: workspace.locale,
      state: {
        ...workspace.state,
        drePeriods: workspace.drePeriods ?? [],
        selectedDrePeriod: workspace.selectedDrePeriod
      },
      upload_feedback: workspace.uploadFeedback,
      selected_period: workspace.selectedPeriod,
      selected_view: workspace.selectedView
    },
    { onConflict: "restaurant_id" }
  );

  if (error) {
    throw asError(error, "Não foi possível salvar a base online.");
  }
};

export const updateSupabaseRestaurantProfile = async (
  session: AuthSession,
  updates: { restaurantName: string; profilePhotoUrl?: string }
) => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  if (!session.activeRestaurantId) {
    throw new Error("Nenhum restaurante ativo foi encontrado.");
  }

  const restaurantName = updates.restaurantName.trim();
  const nextSlug = buildRestaurantId(restaurantName, session.email);
  const photoUrl = updates.profilePhotoUrl?.trim() ? updates.profilePhotoUrl.trim() : null;

  const { error } = await supabase
    .from("restaurants")
    .update({
      name: restaurantName,
      slug: nextSlug,
      photo_url: photoUrl
    })
    .eq("id", session.activeRestaurantId);

  if (error) {
    throw asError(error, "Não foi possível atualizar os dados do restaurante.");
  }

  const memberships = (session.memberships ?? []).map((membership) =>
    membership.restaurantId === session.activeRestaurantId
      ? {
          ...membership,
          restaurantName,
          photoUrl: photoUrl ?? undefined
        }
      : membership
  );

  return {
    ...session,
    memberships,
    activeRestaurantName: restaurantName,
    activeRestaurantPhotoUrl: photoUrl ?? undefined,
    restaurantId: session.activeRestaurantId,
    restaurantName,
    profilePhotoUrl: photoUrl ?? undefined
  };
};

export const updateSupabaseUserProfile = async (
  session: AuthSession,
  updates: { fullName: string; userPhotoUrl?: string }
) => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const fullName = updates.fullName.trim();
  const photoUrl = updates.userPhotoUrl?.trim() ? updates.userPhotoUrl.trim() : null;

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: session.userId,
      email: session.email,
      full_name: fullName || null,
      photo_url: photoUrl
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw asError(error, "Não foi possível atualizar o perfil do usuário.");
  }

  return {
    ...session,
    userFullName: fullName || undefined,
    userPhotoUrl: photoUrl ?? undefined
  };
};

export const createSupabaseRestaurantForCurrentUser = async (
  session: AuthSession,
  restaurantName: string
) => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const nextRestaurantName = restaurantName.trim();
  if (!nextRestaurantName) {
    throw new Error("Informe o nome do restaurante.");
  }

  const slug = buildRestaurantId(nextRestaurantName, session.email || session.userId);
  const { data, error } = await supabase.rpc("create_restaurant_for_current_user", {
    restaurant_name: nextRestaurantName,
    restaurant_slug: slug,
    restaurant_photo_url: null
  });

  if (error) {
    throw asError(error, "Não foi possível cadastrar o restaurante.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sessão inválida ao cadastrar restaurante.");
  }

  const memberships = await loadMemberships(session.userId);
  return toAuthSession(user, {
    memberships,
    activeRestaurantId: typeof data === "string" ? data : undefined
  });
};

export const deleteSupabaseRestaurantFromAccount = async (
  session: AuthSession,
  restaurantId: string
) => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const { error } = await supabase.rpc("delete_restaurant_for_current_user", {
    target_restaurant_id: restaurantId
  });

  if (error) {
    throw asError(error, "Não foi possível excluir o restaurante.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sessão inválida ao excluir restaurante.");
  }

  const memberships = await loadMemberships(session.userId);
  const fallbackRestaurantId =
    memberships.find((membership) => membership.restaurantId !== restaurantId)?.restaurantId ?? memberships[0]?.restaurantId;

  return toAuthSession(user, {
    memberships,
    activeRestaurantId: fallbackRestaurantId
  });
};

export const deleteSupabaseRestaurantAccount = async () => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    throw asError(error, "Não foi possível excluir a conta.");
  }
};
