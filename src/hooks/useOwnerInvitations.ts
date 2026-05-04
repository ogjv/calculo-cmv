import { useEffect, useState } from "react";
import type { AccountInvitation, AccountMember, AuthSession } from "../types";
import {
  createAccountInvitation,
  loadAccountInvitations,
  loadAccountMembers,
  removeAccountMemberAccess,
  revokeAccountInvitation,
  updateAccountMemberAccess
} from "../utils/cloudAuth";

export type OwnerInvitationFormState = {
  email: string;
  featureIds: string[];
  restaurantIds: string[];
};

const DEFAULT_INVITE_FEATURE = "cmv_dashboard";

export function useOwnerInvitations(effectiveSession: AuthSession | null, canManageOwnerInvites: boolean) {
  const [accountMembers, setAccountMembers] = useState<AccountMember[]>([]);
  const [accountMembersLoading, setAccountMembersLoading] = useState(false);
  const [accountInvitations, setAccountInvitations] = useState<AccountInvitation[]>([]);
  const [accountInvitationsLoading, setAccountInvitationsLoading] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string>();
  const [inviteError, setInviteError] = useState<string>();
  const [inviteForm, setInviteForm] = useState<OwnerInvitationFormState>({
    email: "",
    featureIds: [DEFAULT_INVITE_FEATURE],
    restaurantIds: []
  });

  useEffect(() => {
    if (!effectiveSession) {
      setInviteForm({
        email: "",
        featureIds: [DEFAULT_INVITE_FEATURE],
        restaurantIds: []
      });
      return;
    }

    setInviteForm((current) => ({
      ...current,
      featureIds: current.featureIds.length > 0 ? current.featureIds : [DEFAULT_INVITE_FEATURE],
      restaurantIds:
        current.restaurantIds.length > 0
          ? current.restaurantIds
          : (effectiveSession.memberships ?? []).map((membership) => membership.restaurantId)
    }));
  }, [effectiveSession]);

  useEffect(() => {
    if (
      !effectiveSession ||
      !canManageOwnerInvites ||
      effectiveSession.authMode !== "supabase" ||
      !effectiveSession.activeAccountId
    ) {
      setAccountMembers([]);
      setAccountMembersLoading(false);
      setAccountInvitations([]);
      setAccountInvitationsLoading(false);
      return;
    }

    let mounted = true;
    setAccountMembersLoading(true);
    setAccountInvitationsLoading(true);

    void loadAccountMembers(effectiveSession.activeAccountId)
      .then((members) => {
        if (mounted) {
          setAccountMembers(members);
        }
      })
      .catch(() => {
        if (mounted) {
          setAccountMembers([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setAccountMembersLoading(false);
        }
      });

    void loadAccountInvitations(effectiveSession.activeAccountId)
      .then((invitations) => {
        if (mounted) {
          setAccountInvitations(invitations);
        }
      })
      .catch(() => {
        if (mounted) {
          setAccountInvitations([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setAccountInvitationsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [canManageOwnerInvites, effectiveSession]);

  const refreshOwnerInvitationData = async (currentSession: AuthSession) => {
    if (currentSession.globalRole !== "owner" || currentSession.authMode !== "supabase" || !currentSession.activeAccountId) {
      setAccountMembers([]);
      setAccountInvitations([]);
      return;
    }

    setAccountMembersLoading(true);
    setAccountInvitationsLoading(true);

    try {
      const [members, invitations] = await Promise.all([
        loadAccountMembers(currentSession.activeAccountId),
        loadAccountInvitations(currentSession.activeAccountId)
      ]);
      setAccountMembers(members);
      setAccountInvitations(invitations);
    } finally {
      setAccountMembersLoading(false);
      setAccountInvitationsLoading(false);
    }
  };

  const handleInviteRestaurantToggle = (restaurantId: string) => {
    setInviteForm((current) => ({
      ...current,
      restaurantIds: current.restaurantIds.includes(restaurantId)
        ? current.restaurantIds.filter((id) => id !== restaurantId)
        : [...current.restaurantIds, restaurantId]
    }));
  };

  const handleInviteFeatureToggle = (featureId: string) => {
    setInviteForm((current) => ({
      ...current,
      featureIds: current.featureIds.includes(featureId)
        ? current.featureIds.filter((id) => id !== featureId)
        : [...current.featureIds, featureId]
    }));
  };

  const handleCreateInvitation = async () => {
    if (!effectiveSession || effectiveSession.authMode !== "supabase") {
      return;
    }

    if (!effectiveSession.activeAccountId) {
      setInviteError("NÃ£o foi possÃ­vel identificar a conta ativa deste usuÃ¡rio. Atualize o vÃ­nculo da conta no banco antes de enviar convites.");
      return;
    }

    if (inviteForm.featureIds.length === 0) {
      setInviteError("Selecione ao menos uma funcionalidade para este convite.");
      return;
    }

    try {
      setInviteBusy(true);
      setInviteError(undefined);
      setInviteMessage(undefined);
      await createAccountInvitation({
        email: inviteForm.email,
        accountRole: "user",
        restaurantRole: "viewer",
        restaurantIds: inviteForm.restaurantIds
      });
      await refreshOwnerInvitationData(effectiveSession);
      setInviteMessage("Convite criado com sucesso.");
      setInviteForm({
        email: "",
        featureIds: [DEFAULT_INVITE_FEATURE],
        restaurantIds: (effectiveSession.memberships ?? []).map((membership) => membership.restaurantId)
      });
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel criar o convite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!effectiveSession || effectiveSession.authMode !== "supabase") {
      return;
    }

    try {
      setInviteBusy(true);
      setInviteError(undefined);
      setInviteMessage(undefined);
      await revokeAccountInvitation(invitationId);
      await refreshOwnerInvitationData(effectiveSession);
      setInviteMessage("Convite revogado com sucesso.");
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel revogar o convite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleUpdateMember = async ({
    member,
    accountRole,
    restaurantRole,
    restaurantIds
  }: {
    member: AccountMember;
    accountRole: "user";
    restaurantRole: "viewer";
    restaurantIds: string[];
  }) => {
    if (
      !effectiveSession ||
      !canManageOwnerInvites ||
      effectiveSession.authMode !== "supabase" ||
      !effectiveSession.activeAccountId
    ) {
      throw new Error("NÃ£o foi possÃ­vel identificar a conta ativa.");
    }

    const targetAccountId = member.accountId || effectiveSession.activeAccountId;
    await updateAccountMemberAccess({
      accountId: targetAccountId,
      userId: member.userId,
      accountRole,
      restaurantRole,
      restaurantIds
    });
    await refreshOwnerInvitationData(effectiveSession);
  };

  const handleRemoveMember = async (member: AccountMember) => {
    if (
      !effectiveSession ||
      !canManageOwnerInvites ||
      effectiveSession.authMode !== "supabase" ||
      !effectiveSession.activeAccountId
    ) {
      throw new Error("NÃ£o foi possÃ­vel identificar a conta ativa.");
    }

    const targetAccountId = member.accountId || effectiveSession.activeAccountId;
    await removeAccountMemberAccess({
      accountId: targetAccountId,
      userId: member.userId
    });
    await refreshOwnerInvitationData(effectiveSession);
  };

  return {
    accountMembers,
    accountMembersLoading,
    accountInvitations,
    accountInvitationsLoading,
    inviteBusy,
    inviteMessage,
    inviteError,
    inviteForm,
    setInviteForm,
    handleInviteRestaurantToggle,
    handleInviteFeatureToggle,
    handleCreateInvitation,
    handleRevokeInvitation,
    handleUpdateMember,
    handleRemoveMember,
    refreshOwnerInvitationData
  };
}
