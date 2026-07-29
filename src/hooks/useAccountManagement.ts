import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AuthSession } from "../types";
import { createLocalRestaurantForAccount, deleteLocalRestaurantAccount, deleteLocalRestaurantFromAccount, updateLocalRestaurantProfile, updateLocalUserProfile } from "../utils/auth";
import { createSupabaseRestaurantForCurrentUser, deleteSupabaseRestaurantAccount, deleteSupabaseRestaurantFromAccount, signOutFromSupabase, updateSupabaseRestaurantProfile, updateSupabaseUserProfile } from "../utils/cloudAuth";
import { savePreferredRestaurant } from "./useSessionWorkspace";

export type ProfileFormState = {
  restaurantName: string;
  profilePhotoUrl?: string;
};

export type UserProfileFormState = {
  fullName: string;
  userPhotoUrl?: string;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });

type UseAccountManagementOptions = {
  effectiveSession: AuthSession | null;
  session: AuthSession | null;
  setSession: Dispatch<SetStateAction<AuthSession | null>>;
  refreshOwnerInvitationData?: (session: AuthSession) => Promise<void>;
  profileUpdatedMessage: string;
  deleteConfirmMessage: string;
};

export function useAccountManagement({
  effectiveSession,
  session,
  setSession,
  refreshOwnerInvitationData,
  profileUpdatedMessage,
  deleteConfirmMessage
}: UseAccountManagementOptions) {
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string>();
  const [accountError, setAccountError] = useState<string>();
  const [userProfileForm, setUserProfileForm] = useState<UserProfileFormState>({ fullName: "" });
  const [restaurantProfileForm, setRestaurantProfileForm] = useState<ProfileFormState>({ restaurantName: "" });
  const [restaurantProfileDirty, setRestaurantProfileDirty] = useState(false);
  const [restaurantProfileRestaurantId, setRestaurantProfileRestaurantId] = useState<string>();
  const [newRestaurantName, setNewRestaurantName] = useState("");

  useEffect(() => {
    if (!effectiveSession) {
      setUserProfileForm({ fullName: "" });
      setRestaurantProfileForm({ restaurantName: "" });
      setRestaurantProfileDirty(false);
      setRestaurantProfileRestaurantId(undefined);
      return;
    }

    setUserProfileForm({
      fullName: effectiveSession.userFullName ?? effectiveSession.restaurantName ?? "",
      userPhotoUrl: effectiveSession.userPhotoUrl
    });

    const currentRestaurantId = effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId;
    if (!restaurantProfileDirty || restaurantProfileRestaurantId !== currentRestaurantId) {
      setRestaurantProfileForm({
        restaurantName: effectiveSession.restaurantName ?? effectiveSession.activeRestaurantName ?? "",
        profilePhotoUrl: effectiveSession.profilePhotoUrl
      });
      setRestaurantProfileRestaurantId(currentRestaurantId);
      setRestaurantProfileDirty(false);
    }
  }, [effectiveSession, restaurantProfileDirty, restaurantProfileRestaurantId]);

  const handleUserPhotoSelect = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const imageData = await readFileAsDataUrl(file);
      setUserProfileForm((current) => ({
        ...current,
        userPhotoUrl: imageData
      }));
      setAccountError(undefined);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
    }
  };

  const handleRestaurantPhotoSelect = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const imageData = await readFileAsDataUrl(file);
      setRestaurantProfileDirty(true);
      setRestaurantProfileRestaurantId(effectiveSession?.activeRestaurantId ?? effectiveSession?.restaurantId);
      setRestaurantProfileForm((current) => ({
        ...current,
        profilePhotoUrl: imageData
      }));
      setAccountError(undefined);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
    }
  };

  const handleRestaurantNameChange = (value: string) => {
    setRestaurantProfileDirty(true);
    setRestaurantProfileRestaurantId(effectiveSession?.activeRestaurantId ?? effectiveSession?.restaurantId);
    setRestaurantProfileForm((current) => ({ ...current, restaurantName: value }));
  };

  const handleSaveUserAccount = async () => {
    if (!session) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await updateSupabaseUserProfile(session, userProfileForm)
          : updateLocalUserProfile(session, userProfileForm);

      setSession(nextSession);
      if (nextSession.authMode === "supabase" && refreshOwnerInvitationData) {
        await refreshOwnerInvitationData(nextSession);
      }
      setAccountMessage(profileUpdatedMessage);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleSaveRestaurantAccount = async () => {
    if (!session) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await updateSupabaseRestaurantProfile(session, restaurantProfileForm)
          : updateLocalRestaurantProfile(session, restaurantProfileForm);

      setSession(nextSession);
      setRestaurantProfileDirty(false);
      setRestaurantProfileRestaurantId(nextSession.activeRestaurantId ?? nextSession.restaurantId);
      setAccountMessage(profileUpdatedMessage);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleCreateRestaurant = async () => {
    if (!session) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await createSupabaseRestaurantForCurrentUser(session, newRestaurantName)
          : createLocalRestaurantForAccount(session, newRestaurantName);

      const nextRestaurantId = nextSession.activeRestaurantId ?? nextSession.restaurantId;
      if (nextRestaurantId) {
        savePreferredRestaurant(nextSession.userId, nextRestaurantId);
      }
      setSession(nextSession);
      setNewRestaurantName("");
      setAccountMessage("Restaurante cadastrado com sucesso.");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível cadastrar o restaurante.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteRestaurant = async (restaurantId: string) => {
    if (!session) {
      return;
    }

    if (!window.confirm("Tem certeza que deseja excluir este restaurante? Esta ação remove a base dessa unidade.")) {
      return;
    }

    try {
      setAccountBusy(true);
      setAccountError(undefined);
      setAccountMessage(undefined);

      const nextSession =
        session.authMode === "supabase"
          ? await deleteSupabaseRestaurantFromAccount(session, restaurantId)
          : deleteLocalRestaurantFromAccount(session, restaurantId);

      const nextRestaurantId = nextSession.activeRestaurantId ?? nextSession.restaurantId;
      if (nextRestaurantId) {
        savePreferredRestaurant(nextSession.userId, nextRestaurantId);
      }
      setSession(nextSession);
      setAccountMessage("Restaurante excluído com sucesso.");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível excluir o restaurante.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!session) {
      return;
    }

    if (!window.confirm(deleteConfirmMessage)) {
      return;
    }

    try {
      setAccountBusy(true);
      if (session.authMode === "supabase") {
        await deleteSupabaseRestaurantAccount();
        await signOutFromSupabase();
      } else {
        deleteLocalRestaurantAccount(session);
      }
      setSession(null);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível excluir a conta.");
    } finally {
      setAccountBusy(false);
    }
  };

  const resetAccountPanelState = () => {
    if (!effectiveSession) {
      return;
    }

    setAccountMessage(undefined);
    setAccountError(undefined);
    setUserProfileForm({
      fullName: effectiveSession.userFullName ?? effectiveSession.restaurantName ?? "",
      userPhotoUrl: effectiveSession.userPhotoUrl
    });
    setRestaurantProfileForm({
      restaurantName: effectiveSession.restaurantName ?? effectiveSession.activeRestaurantName ?? "",
      profilePhotoUrl: effectiveSession.profilePhotoUrl
    });
    setRestaurantProfileDirty(false);
    setRestaurantProfileRestaurantId(effectiveSession.activeRestaurantId ?? effectiveSession.restaurantId);
    setNewRestaurantName("");
  };

  return {
    accountBusy,
    accountMessage,
    accountError,
    setAccountError,
    setAccountMessage,
    userProfileForm,
    setUserProfileForm,
    restaurantProfileForm,
    newRestaurantName,
    setNewRestaurantName,
    handleUserPhotoSelect,
    handleRestaurantPhotoSelect,
    handleRestaurantNameChange,
    handleSaveUserAccount,
    handleSaveRestaurantAccount,
    handleCreateRestaurant,
    handleDeleteRestaurant,
    handleDeleteAccount,
    resetAccountPanelState
  };
}
