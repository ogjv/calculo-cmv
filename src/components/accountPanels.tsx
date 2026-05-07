import { useEffect, useMemo, useState } from "react";
import type { AccountInvitation, AccountMember, AuthSession } from "../types";
import type { AccountPanelCopy } from "../presentation/contracts";
import { ProfileAvatar, UserAvatar } from "./appChrome";

type ProfileFormState = {
  restaurantName: string;
  profilePhotoUrl?: string;
};

type UserProfileFormState = {
  fullName: string;
  userPhotoUrl?: string;
};

type AccountSettingsPanelProps = {
  session: AuthSession;
  userForm: UserProfileFormState;
  busy: boolean;
  message?: string;
  error?: string;
  onClose: () => void;
  onUserNameChange: (value: string) => void;
  onUserPhotoSelect: (file: File | null) => void;
  onSaveUser: () => void;
  onDeleteAccount: () => void;
  copy: AccountPanelCopy;
};

type RestaurantManagementPanelProps = {
  session: AuthSession;
  restaurantForm: ProfileFormState;
  newRestaurantName: string;
  busy: boolean;
  message?: string;
  error?: string;
  onRestaurantNameChange: (value: string) => void;
  onRestaurantPhotoSelect: (file: File | null) => void;
  onCreateRestaurantNameChange: (value: string) => void;
  onSaveRestaurant: () => void;
  onCreateRestaurant: () => void;
  onDeleteRestaurant: (restaurantId: string) => void;
  onActivateRestaurant: (restaurantId: string) => void;
  copy: AccountPanelCopy;
};

type UserManagementPanelProps = {
  session: AuthSession;
  members: AccountMember[];
  membersLoading: boolean;
  inviteForm: {
    email: string;
    restaurantIds: string[];
  };
  inviteBusy: boolean;
  inviteMessage?: string;
  inviteError?: string;
  invitations: AccountInvitation[];
  invitationsLoading: boolean;
  onInviteEmailChange: (value: string) => void;
  onInviteRestaurantToggle: (restaurantId: string) => void;
  onCreateInvitation: () => void;
  onRevokeInvitation: (invitationId: string) => void;
  onUpdateMember: (payload: {
    member: AccountMember;
    accountRole: "user";
    restaurantRole: "viewer";
    restaurantIds: string[];
  }) => Promise<void>;
  onRemoveMember: (member: AccountMember) => Promise<void>;
  copy: AccountPanelCopy;
};

const areRestaurantSelectionsEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
};

function ManagedMemberCard({
  member,
  session,
  busy,
  onUpdateMember,
  onRemoveMember,
  copy
}: {
  member: AccountMember;
  session: AuthSession;
  busy: boolean;
  onUpdateMember: UserManagementPanelProps["onUpdateMember"];
  onRemoveMember: UserManagementPanelProps["onRemoveMember"];
  copy: AccountPanelCopy;
}) {
  const initialRestaurantIds = useMemo(
    () => member.restaurants.map((restaurant) => restaurant.restaurantId).sort(),
    [member.restaurants]
  );
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>(initialRestaurantIds);
  const [localBusy, setLocalBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState<string>();
  const [localError, setLocalError] = useState<string>();

  useEffect(() => {
    setSelectedRestaurantIds(initialRestaurantIds);
  }, [initialRestaurantIds]);

  const isCurrentUser = member.userId === session.userId;
  const isImmutable = member.role === "owner" || isCurrentUser;
  const hasChanges = !areRestaurantSelectionsEqual(selectedRestaurantIds, initialRestaurantIds);
  const canSave = !isImmutable && selectedRestaurantIds.length > 0 && hasChanges && !busy && !localBusy;
  const canRemove = !isImmutable && !busy && !localBusy;

  const toggleRestaurant = (restaurantId: string) => {
    if (isImmutable) {
      return;
    }

    setSelectedRestaurantIds((current) =>
      current.includes(restaurantId) ? current.filter((id) => id !== restaurantId) : [...current, restaurantId]
    );
  };

  const handleSave = async () => {
    try {
      setLocalBusy(true);
      setLocalError(undefined);
      setLocalMessage(undefined);
      await onUpdateMember({
        member,
        accountRole: "user",
        restaurantRole: "viewer",
        restaurantIds: selectedRestaurantIds
      });
      setLocalMessage(copy.teamMemberUpdated);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : copy.teamMemberImmutable);
    } finally {
      setLocalBusy(false);
    }
  };

  const handleRemove = async () => {
    try {
      setLocalBusy(true);
      setLocalError(undefined);
      setLocalMessage(undefined);
      await onRemoveMember(member);
      setLocalMessage(copy.teamMemberRemoved);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : copy.teamMemberImmutable);
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <article className="team-member-card managed-member-card">
      <div className="team-member-head">
        <div className="team-member-identity">
          <UserAvatar
            session={{
              ...session,
              userFullName: member.fullName,
              userPhotoUrl: member.photoUrl,
              email: member.email ?? session.email
            }}
            size="md"
          />
          <div>
            <strong>{member.fullName ?? member.email ?? member.userId}</strong>
            <p>
              {member.email ?? copy.teamRoleUser}
              {isCurrentUser ? ` · ${copy.teamYou}` : ""}
            </p>
          </div>
        </div>
        <div className="team-member-meta">
          <span className="status ok">{member.role === "owner" ? copy.teamRoleOwner : copy.teamRoleUser}</span>
          <span className="status">{copy.teamRoleViewer}</span>
        </div>
      </div>

      <div className="team-management-grid">
        <article className="mini-stat-card">
          <span>{copy.teamAccountRole}</span>
          <strong>{member.role === "owner" ? copy.teamRoleOwner : copy.teamRoleUser}</strong>
        </article>
        <article className="mini-stat-card">
          <span>{copy.teamRestaurantAccess}</span>
          <strong>{String(selectedRestaurantIds.length)}</strong>
        </article>
      </div>

      <div className="team-restaurant-selector">
        <span>{copy.teamManageMemberText}</span>
        <div className="team-restaurant-chips">
          {(session.memberships ?? []).map((membership) => {
            const isSelected = selectedRestaurantIds.includes(membership.restaurantId);

            return (
              <button
                key={`${member.userId}-${membership.restaurantId}`}
                type="button"
                className={`team-restaurant-chip selectable ${isSelected ? "selected" : ""}`}
                onClick={() => toggleRestaurant(membership.restaurantId)}
                aria-pressed={isSelected}
                disabled={isImmutable || localBusy || busy}
              >
                <strong>{membership.restaurantName}</strong>
                <small>{copy.ownerInviteAccessLabel}</small>
              </button>
            );
          })}
        </div>
      </div>

      {selectedRestaurantIds.length === 0 ? <p className="message">{copy.teamNoRestaurants}</p> : null}
      {isImmutable ? <p className="message">{copy.teamMemberImmutable}</p> : null}
      {localError ? <p className="message error">{localError}</p> : null}
      {localMessage ? <p className="message success">{localMessage}</p> : null}

      <div className="team-member-actions managed-member-actions">
        <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={!canSave}>
          {copy.teamSaveMember}
        </button>
        <button type="button" className="ghost-button danger-button" onClick={() => void handleRemove()} disabled={!canRemove}>
          {copy.teamRemoveMember}
        </button>
      </div>
    </article>
  );
}

export function AccountSettingsPanel({
  session,
  userForm,
  busy,
  message,
  error,
  onClose,
  onUserNameChange,
  onUserPhotoSelect,
  onSaveUser,
  onDeleteAccount,
  copy
}: AccountSettingsPanelProps) {
  return (
    <section className="card account-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">{copy.settings}</span>
          <h3>{copy.settings}</h3>
          <p>{copy.settingsText}</p>
        </div>
        <button type="button" className="ghost-button" onClick={onClose}>
          {copy.close}
        </button>
      </div>

      <div className="account-panel-stack">
        <section className="account-user-section">
          <div className="section-head compact">
            <div>
              <span className="eyebrow">{copy.userProfile}</span>
              <h3>{copy.userProfile}</h3>
              <p>{copy.userProfileText}</p>
            </div>
          </div>

          <div className="account-user-grid">
            <section className="account-identity-card">
              <div className="account-avatar-panel">
                <UserAvatar
                  session={{
                    ...session,
                    userFullName: userForm.fullName,
                    userPhotoUrl: userForm.userPhotoUrl
                  }}
                  size="lg"
                />
                <div>
                  <strong>{copy.userProfile}</strong>
                  <p>{copy.userProfileText}</p>
                </div>
              </div>

              <label className="upload-box compact-upload">
                <div className="upload-box-top">
                  <span className="upload-order">{copy.profilePhoto}</span>
                  <span className="upload-status ready">{busy ? copy.processing : copy.uploadPhoto}</span>
                </div>
                <strong className="upload-title">{userForm.userPhotoUrl ? (userForm.fullName || session.email) : copy.uploadPhoto}</strong>
                <small>{copy.userProfileText}</small>
                <div className="upload-box-footer">
                  <span className="upload-action">{copy.uploadPhoto}</span>
                  <span className="upload-meta">.png .jpg .jpeg</span>
                </div>
                <input
                  className="upload-input-hidden"
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  onChange={(event) => onUserPhotoSelect(event.target.files?.[0] ?? null)}
                />
              </label>
            </section>

            <section className="account-form-card">
              <label className="auth-field">
                <span>{copy.fullName}</span>
                <input value={userForm.fullName} onChange={(event) => onUserNameChange(event.target.value)} />
              </label>

              <label className="auth-field">
                <span>{copy.email}</span>
                <input value={session.email} disabled />
              </label>

              <div className="user-status-grid">
                <article className="mini-stat-card">
                  <span>{copy.accountStatus}</span>
                  <strong>{session.activeRole === "owner" ? copy.roleOwner : copy.roleViewer}</strong>
                </article>
                <article className="mini-stat-card">
                  <span>{copy.restaurantsCount}</span>
                  <strong>{String(session.memberships?.length ?? 0)}</strong>
                </article>
              </div>

              {message ? <p className="message success">{message}</p> : null}
              {error ? <p className="message error">{error}</p> : null}

              <div className="panel-actions">
                <button type="button" className="primary-button" onClick={onSaveUser} disabled={busy}>
                  {copy.saveProfile}
                </button>
              </div>
            </section>
          </div>
        </section>

        <section className="danger-panel">
          <div className="danger-panel-copy">
            <span className="eyebrow">{copy.dangerZone}</span>
            <strong>{copy.deleteAccount}</strong>
            <p>{copy.deleteHint}</p>
          </div>
          <button type="button" className="ghost-button danger-button" onClick={onDeleteAccount} disabled={busy}>
            {copy.deleteAccount}
          </button>
        </section>
      </div>
    </section>
  );
}

export function UserManagementPanel({
  session,
  members,
  membersLoading,
  inviteForm,
  inviteBusy,
  inviteMessage,
  inviteError,
  invitations,
  invitationsLoading,
  onInviteEmailChange,
  onInviteRestaurantToggle,
  onCreateInvitation,
  onRevokeInvitation,
  onUpdateMember,
  onRemoveMember,
  copy
}: UserManagementPanelProps) {
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const userCount = members.filter((member) => member.role !== "owner").length;
  const restaurantCoverage = new Set(
    members.flatMap((member) => member.restaurants.map((restaurant) => restaurant.restaurantId))
  ).size;

  return (
    <section className="card account-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">{copy.teamTitle}</span>
          <h3>{copy.teamTitle}</h3>
          <p>{copy.teamText}</p>
        </div>
      </div>

      <div className="account-panel-stack">
        <section className="account-restaurant-section user-management-overview-section">
          <div className="team-management-grid user-management-summary-grid">
            <article className="mini-stat-card">
              <span>{copy.teamMembersTotal}</span>
              <strong>{String(members.length)}</strong>
            </article>
            <article className="mini-stat-card">
              <span>{copy.teamAdminsTotal}</span>
              <strong>{String(ownerCount)}</strong>
            </article>
            <article className="mini-stat-card">
              <span>{copy.teamUsersTotal}</span>
              <strong>{String(userCount)}</strong>
            </article>
            <article className="mini-stat-card">
              <span>{copy.teamRestaurantsTotal}</span>
              <strong>{String(restaurantCoverage)}</strong>
            </article>
          </div>

          <section className="account-form-card user-management-model-card">
            <div className="section-head compact">
              <div>
                <span className="eyebrow">{copy.teamAccessModel}</span>
                <h3>{copy.teamAccessModel}</h3>
                <p>{copy.teamAccessModelText}</p>
              </div>
            </div>
          </section>
        </section>

        <section className="account-restaurant-section owner-invite-section">
          <div className="section-head compact">
            <div>
              <span className="eyebrow">{copy.ownerInviteTitle}</span>
              <h3>{copy.ownerInviteTitle}</h3>
              <p>{copy.ownerInviteText}</p>
            </div>
          </div>

          <div className="account-panel-grid owner-invite-grid">
            <section className="account-form-card owner-invite-card">
              <label className="auth-field">
                <span>{copy.ownerInviteEmail}</span>
                <input
                  value={inviteForm.email}
                  onChange={(event) => onInviteEmailChange(event.target.value)}
                  placeholder="nome@empresa.com"
                />
              </label>

              <div className="team-restaurant-selector">
                <span>{copy.ownerInviteRestaurants}</span>
                <div className="team-restaurant-chips">
                  {(session.memberships ?? []).map((membership) => {
                    const isSelected = inviteForm.restaurantIds.includes(membership.restaurantId);

                    return (
                      <button
                        key={`account-invite-${membership.restaurantId}`}
                        type="button"
                        className={`team-restaurant-chip selectable ${isSelected ? "selected" : ""}`}
                        onClick={() => onInviteRestaurantToggle(membership.restaurantId)}
                        aria-pressed={isSelected}
                      >
                        <strong>{membership.restaurantName}</strong>
                        <small>{copy.ownerInviteAccessLabel}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="message">{copy.ownerInviteHint}</p>
              {inviteError ? <p className="message error">{inviteError}</p> : null}
              {inviteMessage ? <p className="message success">{inviteMessage}</p> : null}

              <div className="panel-actions">
                <button type="button" className="primary-button" onClick={onCreateInvitation} disabled={inviteBusy}>
                  {inviteBusy ? copy.processing : copy.ownerInviteAction}
                </button>
              </div>
            </section>

            <section className="account-form-card owner-invite-card owner-invite-list-card">
              <div className="section-head compact">
                <div>
                  <span className="eyebrow">{copy.ownerInvitePending}</span>
                  <h3>{copy.ownerInvitePending}</h3>
                  <p>{copy.ownerInvitePendingText}</p>
                </div>
              </div>

              {invitationsLoading ? <p className="message">{copy.processing}</p> : null}
              {!invitationsLoading && invitations.length === 0 ? <p className="message">{copy.ownerInviteEmpty}</p> : null}

              {!invitationsLoading && invitations.length > 0 ? (
                <div className="restaurant-member-list">
                  {invitations.map((invitation) => (
                    <article key={invitation.invitationId} className="restaurant-member-card">
                      <div>
                        <strong>{invitation.email}</strong>
                        <p>{copy.ownerInviteAccessLabel}</p>
                      </div>
                      <div className="restaurant-member-actions">
                        <button
                          type="button"
                          className="ghost-button danger-button"
                          onClick={() => onRevokeInvitation(invitation.invitationId)}
                          disabled={inviteBusy}
                        >
                          {copy.ownerInviteRevoke}
                        </button>
                      </div>
                      <div className="team-restaurant-chips">
                        {invitation.restaurants.map((restaurant) => (
                          <span key={`${invitation.invitationId}-${restaurant.restaurantId}`} className="team-restaurant-chip">
                            <strong>{restaurant.restaurantName}</strong>
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </section>

        <section className="account-restaurant-section user-management-members-section">
          <div className="section-head compact">
            <div>
              <span className="eyebrow">{copy.teamManageMember}</span>
              <h3>{copy.teamManageMember}</h3>
              <p>{copy.teamManageMemberText}</p>
            </div>
          </div>

          {membersLoading ? <section className="account-form-card"><p className="message">{copy.processing}</p></section> : null}
          {!membersLoading && members.length === 0 ? <section className="account-form-card"><p className="message">{copy.teamEmpty}</p></section> : null}

          {!membersLoading && members.length > 0 ? (
            <div className="team-members-grid compact user-management-members-grid">
              {members.map((member) => (
                <ManagedMemberCard
                  key={member.membershipId}
                  member={member}
                  session={session}
                  busy={inviteBusy}
                  onUpdateMember={onUpdateMember}
                  onRemoveMember={onRemoveMember}
                  copy={copy}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export function RestaurantManagementPanel({
  session,
  restaurantForm,
  newRestaurantName,
  busy,
  message,
  error,
  onRestaurantNameChange,
  onRestaurantPhotoSelect,
  onCreateRestaurantNameChange,
  onSaveRestaurant,
  onCreateRestaurant,
  onDeleteRestaurant,
  onActivateRestaurant,
  copy
}: RestaurantManagementPanelProps) {
  return (
    <section className="card account-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">{copy.manageRestaurants}</span>
          <h3>{copy.manageRestaurants}</h3>
          <p>{copy.manageRestaurantsText}</p>
        </div>
      </div>

      <div className="account-panel-grid">
        <section className="account-form-card">
          <div className="account-avatar-panel">
            <ProfileAvatar
              session={{
                ...session,
                restaurantName: restaurantForm.restaurantName,
                profilePhotoUrl: restaurantForm.profilePhotoUrl
              }}
              size="lg"
            />
            <div>
              <strong>{copy.restaurantProfile}</strong>
              <p>{copy.restaurantProfileText}</p>
            </div>
          </div>

          <label className="upload-box compact-upload">
            <div className="upload-box-top">
              <span className="upload-order">{copy.profilePhoto}</span>
              <span className="upload-status ready">{busy ? copy.processing : copy.uploadPhoto}</span>
            </div>
            <strong className="upload-title">{restaurantForm.profilePhotoUrl ? restaurantForm.restaurantName : copy.uploadPhoto}</strong>
            <small>{copy.restaurantProfileText}</small>
            <div className="upload-box-footer">
              <span className="upload-action">{copy.uploadPhoto}</span>
              <span className="upload-meta">.png .jpg .jpeg</span>
            </div>
            <input
              className="upload-input-hidden"
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(event) => onRestaurantPhotoSelect(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="auth-field">
            <span>{copy.restaurantName}</span>
            <input value={restaurantForm.restaurantName} onChange={(event) => onRestaurantNameChange(event.target.value)} />
          </label>

          {message ? <p className="message success">{message}</p> : null}
          {error ? <p className="message error">{error}</p> : null}

          <div className="panel-actions">
            <button type="button" className="primary-button" onClick={onSaveRestaurant} disabled={busy}>
              {copy.saveProfile}
            </button>
          </div>
        </section>

        <section className="account-form-card restaurant-management-card">
          <div className="restaurant-member-list">
            {(session.memberships ?? []).map((membership) => {
              const isActive = membership.restaurantId === session.activeRestaurantId;
              const canDeleteThisRestaurant = membership.role === "owner" && (session.memberships?.length ?? 0) > 1;

              return (
                <article
                  key={membership.membershipId}
                  className={`restaurant-member-card ${isActive ? "active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onActivateRestaurant(membership.restaurantId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onActivateRestaurant(membership.restaurantId);
                    }
                  }}
                >
                  <div>
                    <strong>{membership.restaurantName}</strong>
                    <p>{membership.role === "owner" ? copy.roleOwner : copy.roleViewer}</p>
                  </div>
                  <div className="restaurant-member-actions">
                    <span className={`status ${isActive ? "ok" : ""}`}>
                      {isActive ? copy.active : copy.activate}
                    </span>
                    {canDeleteThisRestaurant ? (
                      <button
                        type="button"
                        className="ghost-button danger-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteRestaurant(membership.restaurantId);
                        }}
                        disabled={busy}
                      >
                        {copy.deleteRestaurant}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="restaurant-create-box">
            <div>
              <strong>{copy.createRestaurant}</strong>
              <p>{copy.createRestaurantText}</p>
            </div>
            <label className="auth-field">
              <span>{copy.restaurantName}</span>
              <input value={newRestaurantName} onChange={(event) => onCreateRestaurantNameChange(event.target.value)} />
            </label>
            <div className="panel-actions">
              <button type="button" className="primary-button" onClick={onCreateRestaurant} disabled={busy}>
                {copy.createRestaurantAction}
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
