import type { AuthSession, RestaurantMembership } from "../types";

type StoredAccount = AuthSession & {
  password: string;
  createdAt: string;
};

type RegisterRestaurantInput = {
  fullName: string;
  email: string;
  password: string;
};

const ACCOUNTS_KEY = "grest.auth.accounts";
const SESSION_KEY = "grest.auth.session";
const WORKSPACE_PREFIX = "grest.workspace.";

const buildLocalMembership = (restaurantId: string, restaurantName: string, photoUrl?: string): RestaurantMembership => ({
  membershipId: `${restaurantId}-owner`,
  restaurantId,
  restaurantName,
  role: "owner",
  photoUrl
});

const seedAccounts: StoredAccount[] = [
  {
    userId: "nosso-ipanema",
    email: "ipanema@grest.com",
    authMode: "local",
    userFullName: "Nosso Ipanema",
    userPhotoUrl: undefined,
    memberships: [buildLocalMembership("nosso-ipanema", "Nosso Ipanema")],
    activeRole: "owner",
    activeRestaurantId: "nosso-ipanema",
    activeRestaurantName: "Nosso Ipanema",
    activeRestaurantPhotoUrl: undefined,
    restaurantId: "nosso-ipanema",
    restaurantName: "Nosso Ipanema",
    profilePhotoUrl: undefined,
    password: "123456",
    createdAt: new Date().toISOString()
  }
];

const isBrowser = () => typeof window !== "undefined";

const readJson = <T>(key: string, fallback: T): T => {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const withActiveRestaurantAliases = (session: AuthSession): AuthSession => ({
  ...session,
  restaurantId: session.activeRestaurantId,
  restaurantName: session.activeRestaurantName,
  profilePhotoUrl: session.activeRestaurantPhotoUrl
});

const toSession = (account: StoredAccount): AuthSession =>
  withActiveRestaurantAliases({
    userId: account.userId,
    email: account.email,
    authMode: "local",
    userFullName: account.userFullName,
    userPhotoUrl: account.userPhotoUrl,
    memberships: account.memberships,
    activeRole: account.activeRole,
    activeRestaurantId: account.activeRestaurantId,
    activeRestaurantName: account.activeRestaurantName,
    activeRestaurantPhotoUrl: account.activeRestaurantPhotoUrl
  });

const ensureAccounts = () => {
  const stored = readJson<StoredAccount[]>(ACCOUNTS_KEY, []);
  if (stored.length > 0) {
    return stored;
  }

  writeJson(ACCOUNTS_KEY, seedAccounts);
  return seedAccounts;
};

export const restoreSession = () => readJson<AuthSession | null>(SESSION_KEY, null);

export const signOut = () => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
};

export const signIn = (email: string, password: string) => {
  const account = ensureAccounts().find(
    (item) => item.email === normalizeEmail(email) && item.password === password
  );

  if (!account) {
    throw new Error("E-mail ou senha inválidos.");
  }

  const session = toSession(account);
  writeJson(SESSION_KEY, session);
  return session;
};

export const registerRestaurant = ({
  fullName,
  email,
  password
}: RegisterRestaurantInput) => {
  const nextFullName = fullName.trim();
  const nextEmail = normalizeEmail(email);
  const nextPassword = password.trim();

  if (!nextFullName || !nextEmail || !nextPassword) {
    throw new Error("Preencha nome do usuário, e-mail e senha.");
  }

  const accounts = ensureAccounts();

  if (accounts.some((account) => account.email === nextEmail)) {
    throw new Error("Já existe um acesso cadastrado com este e-mail.");
  }

  const restaurantId = slugify(nextFullName) || "restaurante";
  const membership = buildLocalMembership(restaurantId, nextFullName);
  const account: StoredAccount = {
    userId: restaurantId,
    email: nextEmail,
    authMode: "local",
    userFullName: nextFullName,
    userPhotoUrl: undefined,
    memberships: [membership],
    activeRole: "owner",
    activeRestaurantId: membership.restaurantId,
    activeRestaurantName: membership.restaurantName,
    activeRestaurantPhotoUrl: membership.photoUrl,
    restaurantId: membership.restaurantId,
    restaurantName: membership.restaurantName,
    profilePhotoUrl: membership.photoUrl,
    password: nextPassword,
    createdAt: new Date().toISOString()
  };

  const nextAccounts = [...accounts, account];
  writeJson(ACCOUNTS_KEY, nextAccounts);

  const session = toSession(account);
  writeJson(SESSION_KEY, session);
  return session;
};

export const updateLocalUserProfile = (
  session: AuthSession,
  updates: { fullName: string; userPhotoUrl?: string }
) => {
  const accounts = ensureAccounts();
  const nextAccounts = accounts.map((account) =>
    account.userId === session.userId
      ? {
          ...account,
          userFullName: updates.fullName.trim(),
          userPhotoUrl: updates.userPhotoUrl
        }
      : account
  );

  writeJson(ACCOUNTS_KEY, nextAccounts);

  const nextSession = {
    ...session,
    userFullName: updates.fullName.trim(),
    userPhotoUrl: updates.userPhotoUrl
  };

  writeJson(SESSION_KEY, nextSession);
  return nextSession;
};

export const createLocalRestaurantForAccount = (session: AuthSession, restaurantName: string) => {
  const nextRestaurantName = restaurantName.trim();
  if (!nextRestaurantName) {
    throw new Error("Informe o nome do restaurante.");
  }

  const accounts = ensureAccounts();
  const nextAccounts = accounts.map((account) => {
    if (account.userId !== session.userId) {
      return account;
    }

    const restaurantId = `${slugify(nextRestaurantName) || "restaurante"}-${Math.random().toString(36).slice(2, 8)}`;
    const membership = buildLocalMembership(restaurantId, nextRestaurantName);

    return {
      ...account,
      memberships: [...(account.memberships ?? []), membership],
      activeRole: "owner" as const,
      activeRestaurantId: membership.restaurantId,
      activeRestaurantName: membership.restaurantName,
      activeRestaurantPhotoUrl: membership.photoUrl,
      restaurantId: membership.restaurantId,
      restaurantName: membership.restaurantName,
      profilePhotoUrl: membership.photoUrl
    };
  });

  writeJson(ACCOUNTS_KEY, nextAccounts);
  const account = nextAccounts.find((item) => item.userId === session.userId);
  if (!account) {
    throw new Error("Conta não encontrada.");
  }

  const nextSession = toSession(account);
  writeJson(SESSION_KEY, nextSession);
  return nextSession;
};

export const deleteLocalRestaurantFromAccount = (session: AuthSession, restaurantId: string) => {
  const accounts = ensureAccounts();
  const account = accounts.find((item) => item.userId === session.userId);
  if (!account) {
    throw new Error("Conta não encontrada.");
  }

  const memberships = account.memberships ?? [];
  if (memberships.length <= 1) {
    throw new Error("A conta precisa manter ao menos um restaurante.");
  }

  const nextMemberships = memberships.filter((membership) => membership.restaurantId !== restaurantId);
  const nextActiveMembership =
    nextMemberships.find((membership) => membership.restaurantId === session.activeRestaurantId) ?? nextMemberships[0];

  const nextAccounts = accounts.map((item) =>
    item.userId === session.userId
      ? {
          ...item,
          memberships: nextMemberships,
          activeRole: nextActiveMembership?.role,
          activeRestaurantId: nextActiveMembership?.restaurantId,
          activeRestaurantName: nextActiveMembership?.restaurantName,
          activeRestaurantPhotoUrl: nextActiveMembership?.photoUrl,
          restaurantId: nextActiveMembership?.restaurantId,
          restaurantName: nextActiveMembership?.restaurantName,
          profilePhotoUrl: nextActiveMembership?.photoUrl
        }
      : item
  );

  writeJson(ACCOUNTS_KEY, nextAccounts);

  const nextAccount = nextAccounts.find((item) => item.userId === session.userId);
  if (!nextAccount) {
    throw new Error("Conta não encontrada.");
  }

  if (isBrowser()) {
    window.localStorage.removeItem(`${WORKSPACE_PREFIX}${restaurantId}`);
  }

  const nextSession = toSession(nextAccount);
  writeJson(SESSION_KEY, nextSession);
  return nextSession;
};

export const saveRestaurantWorkspace = <T>(restaurantId: string, workspace: T) => {
  writeJson(`${WORKSPACE_PREFIX}${restaurantId}`, workspace);
};

export const loadRestaurantWorkspace = <T>(restaurantId: string) =>
  readJson<T | null>(`${WORKSPACE_PREFIX}${restaurantId}`, null);

export const updateLocalRestaurantProfile = (
  session: AuthSession,
  updates: { restaurantName: string; profilePhotoUrl?: string }
) => {
  const accounts = ensureAccounts();
  const nextAccounts = accounts.map((account) => {
    if (account.userId !== session.userId) {
      return account;
    }

    const nextMemberships = (account.memberships ?? []).map((membership) =>
      membership.restaurantId === session.activeRestaurantId
        ? {
            ...membership,
            restaurantName: updates.restaurantName.trim(),
            photoUrl: updates.profilePhotoUrl
          }
        : membership
    );

    return {
      ...account,
      memberships: nextMemberships,
      activeRestaurantName: updates.restaurantName.trim(),
      activeRestaurantPhotoUrl: updates.profilePhotoUrl,
      restaurantName: updates.restaurantName.trim(),
      profilePhotoUrl: updates.profilePhotoUrl
    };
  });

  writeJson(ACCOUNTS_KEY, nextAccounts);

  const nextSession = withActiveRestaurantAliases({
    ...session,
    memberships: (session.memberships ?? []).map((membership) =>
      membership.restaurantId === session.activeRestaurantId
        ? {
            ...membership,
            restaurantName: updates.restaurantName.trim(),
            photoUrl: updates.profilePhotoUrl
          }
        : membership
    ),
    activeRestaurantName: updates.restaurantName.trim(),
    activeRestaurantPhotoUrl: updates.profilePhotoUrl
  });

  writeJson(SESSION_KEY, nextSession);
  return nextSession;
};

export const deleteLocalRestaurantAccount = (session: AuthSession) => {
  const accounts = ensureAccounts().filter((account) => account.userId !== session.userId);
  writeJson(ACCOUNTS_KEY, accounts);

  if (isBrowser()) {
    if (session.activeRestaurantId) {
      window.localStorage.removeItem(`${WORKSPACE_PREFIX}${session.activeRestaurantId}`);
    }
    window.localStorage.removeItem(SESSION_KEY);
  }
};
