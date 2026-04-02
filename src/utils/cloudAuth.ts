import type { User } from "@supabase/supabase-js";
import type { AuthSession, PersistedWorkspace } from "../types";
import { supabase } from "./supabase";

type RegisterRestaurantInput = {
  restaurantName: string;
  email: string;
  password: string;
};

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

const asError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return new Error(error.message);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return new Error((error as { message: string }).message);
  }

  return new Error(fallback);
};

const toAuthSession = async (user: User): Promise<AuthSession> => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const fallbackName =
    typeof user.user_metadata.restaurant_name === "string" && user.user_metadata.restaurant_name.trim()
      ? user.user_metadata.restaurant_name.trim()
      : user.email?.split("@")[0] ?? "Restaurante";

  const fallbackRestaurantId =
    typeof user.user_metadata.restaurant_id === "string" && user.user_metadata.restaurant_id.trim()
      ? user.user_metadata.restaurant_id.trim()
      : buildRestaurantId(fallbackName, user.email ?? user.id);

  const { data, error } = await supabase
    .from("restaurant_accounts")
    .select("restaurant_id, restaurant_name, photo_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw asError(error, "Não foi possível carregar o restaurante.");
  }

  return {
    userId: user.id,
    restaurantId: data?.restaurant_id ?? fallbackRestaurantId,
    restaurantName: data?.restaurant_name ?? fallbackName,
    email: user.email ?? "",
    authMode: "supabase"
    ,
    profilePhotoUrl: data?.photo_url ?? (typeof user.user_metadata.photo_url === "string" ? user.user_metadata.photo_url : undefined)
  };
};

const ensureRestaurantAccount = async (user: User, restaurantNameOverride?: string) => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const restaurantName =
    restaurantNameOverride?.trim() ||
    (typeof user.user_metadata.restaurant_name === "string" ? user.user_metadata.restaurant_name.trim() : "") ||
    user.email?.split("@")[0] ||
    "Restaurante";
  const restaurantId =
    (typeof user.user_metadata.restaurant_id === "string" ? user.user_metadata.restaurant_id.trim() : "") ||
    buildRestaurantId(restaurantName, user.email ?? user.id);
  const photoUrl =
    typeof user.user_metadata.photo_url === "string" && user.user_metadata.photo_url.trim()
      ? user.user_metadata.photo_url.trim()
      : null;

  const { error } = await supabase.from("restaurant_accounts").upsert(
    {
      user_id: user.id,
      restaurant_id: restaurantId,
      restaurant_name: restaurantName,
      email: user.email ?? "",
      photo_url: photoUrl
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw asError(error, "Não foi possível salvar o restaurante no Supabase.");
  }
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

  await ensureRestaurantAccount(user);
  return toAuthSession(user);
};

export const subscribeToSupabaseAuth = (callback: (session: AuthSession | null) => void) => {
  if (!supabase) {
    return () => undefined;
  }

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    if (!user) {
      callback(null);
      return;
    }

    void ensureRestaurantAccount(user)
      .then(() => toAuthSession(user))
      .then((nextSession) => callback(nextSession))
      .catch(() => callback(null));
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

  await ensureRestaurantAccount(user);
  return toAuthSession(user);
};

export const registerRestaurantWithSupabase = async ({
  restaurantName,
  email,
  password
}: RegisterRestaurantInput) => {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const restaurantId = buildRestaurantId(restaurantName, email);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        restaurant_name: restaurantName,
        restaurant_id: restaurantId
      }
    }
  });

  if (error) {
    throw asError(error, "Não foi possível criar o restaurante.");
  }

  const user = data.user;
  if (!user) {
    throw new Error("Não foi possível criar a conta.");
  }

  if (!data.session) {
    throw new Error("Conta criada com sucesso. Confirme o e-mail enviado pelo Supabase e depois faça login.");
  }

  await ensureRestaurantAccount(user, restaurantName);
  return toAuthSession(user);
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

export const loadCloudWorkspace = async (userId: string) => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("restaurant_workspaces")
    .select("locale, state, upload_feedback, selected_period, selected_view")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw asError(error, "Não foi possível carregar a base online.");
  }

  if (!data) {
    return null;
  }

  return {
    locale: data.locale,
    state: data.state,
    uploadFeedback: data.upload_feedback,
    selectedPeriod: data.selected_period,
    selectedView: data.selected_view
  } as PersistedWorkspace;
};

export const saveCloudWorkspace = async (userId: string, workspace: PersistedWorkspace) => {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("restaurant_workspaces").upsert(
    {
      user_id: userId,
      locale: workspace.locale,
      state: workspace.state,
      upload_feedback: workspace.uploadFeedback,
      selected_period: workspace.selectedPeriod,
      selected_view: workspace.selectedView
    },
    { onConflict: "user_id" }
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

  const restaurantName = updates.restaurantName.trim();
  const restaurantId = buildRestaurantId(restaurantName, session.email);
  const photoUrl = updates.profilePhotoUrl?.trim() ? updates.profilePhotoUrl.trim() : null;

  const { error: userError } = await supabase.auth.updateUser({
    data: {
      restaurant_name: restaurantName,
      restaurant_id: restaurantId,
      photo_url: photoUrl
    }
  });

  if (userError) {
    throw asError(userError, "Não foi possível atualizar o perfil.");
  }

  const { error: profileError } = await supabase
    .from("restaurant_accounts")
    .update({
      restaurant_name: restaurantName,
      restaurant_id: restaurantId,
      photo_url: photoUrl
    })
    .eq("user_id", session.userId);

  if (profileError) {
    throw asError(profileError, "Não foi possível atualizar os dados do restaurante.");
  }

  return {
    ...session,
    restaurantName,
    restaurantId,
    profilePhotoUrl: photoUrl ?? undefined
  } as AuthSession;
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
