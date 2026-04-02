import type { AuthSession } from "../types";

type StoredAccount = AuthSession & {
  password: string;
  createdAt: string;
};

type RegisterRestaurantInput = {
  restaurantName: string;
  email: string;
  password: string;
};

const ACCOUNTS_KEY = "grest.auth.accounts";
const SESSION_KEY = "grest.auth.session";
const WORKSPACE_PREFIX = "grest.workspace.";

const seedAccounts: StoredAccount[] = [
  {
    userId: "nosso-ipanema",
    restaurantId: "nosso-ipanema",
    restaurantName: "Nosso Ipanema",
    email: "ipanema@grest.com",
    authMode: "local",
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

const toSession = (account: StoredAccount): AuthSession => ({
  userId: account.userId,
  restaurantId: account.restaurantId,
  restaurantName: account.restaurantName,
  email: account.email,
  authMode: "local",
  profilePhotoUrl: account.profilePhotoUrl
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
  restaurantName,
  email,
  password
}: RegisterRestaurantInput) => {
  const nextRestaurantName = restaurantName.trim();
  const nextEmail = normalizeEmail(email);
  const nextPassword = password.trim();

  if (!nextRestaurantName || !nextEmail || !nextPassword) {
    throw new Error("Preencha nome do restaurante, e-mail e senha.");
  }

  const accounts = ensureAccounts();

  if (accounts.some((account) => account.email === nextEmail)) {
    throw new Error("Já existe um acesso cadastrado com este e-mail.");
  }

  const baseId = slugify(nextRestaurantName) || "restaurante";
  let restaurantId = baseId;
  let suffix = 2;

  while (accounts.some((account) => account.restaurantId === restaurantId)) {
    restaurantId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const account: StoredAccount = {
    userId: restaurantId,
    restaurantId,
    restaurantName: nextRestaurantName,
    email: nextEmail,
    authMode: "local",
    profilePhotoUrl: undefined,
    password: nextPassword,
    createdAt: new Date().toISOString()
  };

  const nextAccounts = [...accounts, account];
  writeJson(ACCOUNTS_KEY, nextAccounts);

  const session = toSession(account);
  writeJson(SESSION_KEY, session);
  return session;
};

export const saveRestaurantWorkspace = <T>(restaurantId: string, workspace: T) => {
  writeJson(`${WORKSPACE_PREFIX}${restaurantId}`, workspace);
};

export const loadRestaurantWorkspace = <T>(restaurantId: string) =>
  readJson<T | null>(`${WORKSPACE_PREFIX}${restaurantId}`, null);

export const updateLocalRestaurantProfile = (session: AuthSession, updates: { restaurantName: string; profilePhotoUrl?: string }) => {
  const accounts = ensureAccounts();
  const nextAccounts = accounts.map((account) =>
    account.userId === session.userId
      ? {
          ...account,
          restaurantName: updates.restaurantName.trim(),
          profilePhotoUrl: updates.profilePhotoUrl
        }
      : account
  );

  writeJson(ACCOUNTS_KEY, nextAccounts);

  const nextSession: AuthSession = {
    ...session,
    restaurantName: updates.restaurantName.trim(),
    profilePhotoUrl: updates.profilePhotoUrl
  };
  writeJson(SESSION_KEY, nextSession);
  return nextSession;
};

export const deleteLocalRestaurantAccount = (session: AuthSession) => {
  const accounts = ensureAccounts().filter((account) => account.userId !== session.userId);
  writeJson(ACCOUNTS_KEY, accounts);

  if (isBrowser()) {
    window.localStorage.removeItem(`${WORKSPACE_PREFIX}${session.restaurantId}`);
    window.localStorage.removeItem(SESSION_KEY);
  }
};
