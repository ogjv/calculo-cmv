import { useEffect, useState } from "react";
import type { AccountInvitation, AccountMember, AuthSession } from "../types";
import { formatNumber } from "../utils/cmv";

export type InviteFormState = {
  email: string;
  featureIds: string[];
  restaurantIds: string[];
};

export type TeamPanelCopy = {
  processing: string;
  navTeam: string;
  teamTitle: string;
  teamText: string;
  teamAccessModel: string;
  teamAccessModelText: string;
  teamMembersTotal: string;
  teamAccountRole: string;
  teamAdminsTotal: string;
  teamUsersTotal: string;
  teamRestaurantsTotal: string;
  authRestaurants: string;
  teamEmpty: string;
  teamRoleOwner: string;
  teamRoleUser: string;
  teamRoleViewer: string;
  teamRestaurantAccess: string;
  teamNoRestaurants: string;
  teamManageMember: string;
  teamManageMemberText: string;
  teamInviteFeatures: string;
  teamFeatureDashboard: string;
  teamInviteRestaurants: string;
  teamSaveMember: string;
  teamRemoveMember: string;
  teamMemberImmutable: string;
  teamMemberUpdated: string;
  teamMemberRemoved: string;
  teamYou: string;
  teamInviteTitle: string;
  teamInviteText: string;
  teamInviteEmail: string;
  teamInviteHint: string;
  teamInviteAction: string;
  teamInvitePending: string;
  teamInviteEmpty: string;
  teamInviteRevoke: string;
  ownerOnlyMessage: string;
  featureRequired: string;
  selectedLabel: string;
  noAccessLabel: string;
};

type TeamMemberUpdateInput = {
  member: AccountMember;
  accountRole: "user";
  restaurantRole: "viewer";
  restaurantIds: string[];
};

type TeamMemberCardProps = {
  session: AuthSession;
  member: AccountMember;
  canManageTeam: boolean;
  copy: TeamPanelCopy;
  onSave: (input: TeamMemberUpdateInput) => Promise<void>;
  onRemove: (member: AccountMember) => Promise<void>;
};

type TeamPermissionsPanelProps = {
  session: AuthSession;
  members: AccountMember[];
  invitations: AccountInvitation[];
  loading: boolean;
  invitationsLoading: boolean;
  canManageTeam: boolean;
  inviteForm: InviteFormState;
  inviteBusy: boolean;
  inviteMessage?: string;
  inviteError?: string;
  copy: TeamPanelCopy;
  onInviteEmailChange: (value: string) => void;
  onInviteFeatureToggle: (featureId: string) => void;
  onInviteRestaurantToggle: (restaurantId: string) => void;
  onCreateInvitation: () => void;
  onRevokeInvitation: (invitationId: string) => void;
  onUpdateMember: (input: TeamMemberUpdateInput) => Promise<void>;
  onRemoveMember: (member: AccountMember) => Promise<void>;
};

export const DEFAULT_INVITE_FEATURE = "cmv_dashboard";

function TeamMemberCard({
  session,
  member,
  canManageTeam,
  copy,
  onSave,
  onRemove
}: TeamMemberCardProps) {
  const [featureIds, setFeatureIds] = useState<string[]>([DEFAULT_INVITE_FEATURE]);
  const [restaurantIds, setRestaurantIds] = useState<string[]>(
    member.restaurants.map((restaurant) => restaurant.restaurantId)
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setFeatureIds([DEFAULT_INVITE_FEATURE]);
    setRestaurantIds(member.restaurants.map((restaurant) => restaurant.restaurantId));
    setMessage(undefined);
    setError(undefined);
  }, [member]);

  const formatAccountRole = (role: AccountMember["role"]) =>
    role === "owner" ? copy.teamRoleOwner : copy.teamRoleUser;

  const formatRestaurantRole = (role: "owner" | "viewer") =>
    role === "owner" ? copy.teamRoleOwner : copy.teamRoleViewer;

  const canEditMember =
    canManageTeam &&
    member.userId !== session.userId &&
    member.role === "user" &&
    !member.restaurants.some((restaurant) => restaurant.role === "owner");
  const assignableRestaurants = [
    ...(session.memberships ?? []).map((membership) => ({
      restaurantId: membership.restaurantId,
      restaurantName: membership.restaurantName,
      role: membership.role
    })),
    ...member.restaurants
  ]
    .filter(
      (restaurant, index, restaurants) =>
        restaurants.findIndex((item) => item.restaurantId === restaurant.restaurantId) === index
    )
    .sort((left, right) => left.restaurantName.localeCompare(right.restaurantName));
  const memberRestaurantAccessById = new Map(
    member.restaurants.map((restaurant) => [restaurant.restaurantId, restaurant])
  );

  const hasChanges =
    JSON.stringify([...featureIds].sort()) !== JSON.stringify([DEFAULT_INVITE_FEATURE]) ||
    JSON.stringify([...restaurantIds].sort()) !==
      JSON.stringify(member.restaurants.map((restaurant) => restaurant.restaurantId).sort());

  const handleRestaurantToggle = (restaurantId: string) => {
    setRestaurantIds((current) =>
      current.includes(restaurantId) ? current.filter((id) => id !== restaurantId) : [...current, restaurantId]
    );
  };

  const handleFeatureToggle = (featureId: string) => {
    setFeatureIds((current) =>
      current.includes(featureId) ? current.filter((id) => id !== featureId) : [...current, featureId]
    );
  };

  const handleSave = async () => {
    try {
      setBusy(true);
      setError(undefined);
      setMessage(undefined);
      if (featureIds.length === 0) {
        throw new Error(copy.featureRequired);
      }
      await onSave({
        member,
        accountRole: "user",
        restaurantRole: "viewer",
        restaurantIds
      });
      setMessage(copy.teamMemberUpdated);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : copy.teamMemberImmutable);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    try {
      setBusy(true);
      setError(undefined);
      setMessage(undefined);
      await onRemove(member);
      setMessage(copy.teamMemberRemoved);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : copy.teamMemberImmutable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="team-member-card">
      <div className="team-member-head">
        <div className="team-member-identity">
          <div className={`profile-avatar sm ${member.photoUrl ? "has-photo" : ""}`}>
            {member.photoUrl ? (
              <img src={member.photoUrl} alt={member.fullName ?? member.email ?? member.userId} />
            ) : (
              <span>{(member.fullName ?? member.email ?? member.userId).slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div>
            <strong>{member.fullName ?? member.email ?? member.userId}</strong>
            <p>{member.userId === session.userId ? copy.teamYou : member.email ?? member.userId}</p>
          </div>
        </div>
        <span className={`status-chip ${member.role === "owner" ? "danger" : "good"}`}>{formatAccountRole(member.role)}</span>
      </div>

      <div className="team-member-meta">
        <span className="eyebrow">{copy.teamRestaurantAccess}</span>
        <div className="team-restaurant-chips">
          {member.restaurants.length > 0 ? (
            member.restaurants.map((restaurant) => (
              <span key={`${member.membershipId}-${restaurant.restaurantId}`} className="team-restaurant-chip">
                <strong>{restaurant.restaurantName}</strong>
                <small>{formatRestaurantRole(restaurant.role)}</small>
              </span>
            ))
          ) : (
            <span className="team-restaurant-chip muted">{copy.teamNoRestaurants}</span>
          )}
        </div>
      </div>

      {canManageTeam ? (
        <div className="team-member-actions">
          <div>
            <span className="eyebrow">{copy.teamManageMember}</span>
            <p className="team-member-actions-text">{copy.teamManageMemberText}</p>
          </div>

          {canEditMember ? (
            <>
              <div className="team-restaurant-selector">
                <span>{copy.teamInviteFeatures}</span>
                <div className="team-restaurant-chips">
                  <button
                    type="button"
                    className={`team-restaurant-chip selectable ${featureIds.includes(DEFAULT_INVITE_FEATURE) ? "selected" : ""}`}
                    onClick={() => handleFeatureToggle(DEFAULT_INVITE_FEATURE)}
                    disabled={busy}
                  >
                    <strong>{copy.teamFeatureDashboard}</strong>
                    <small>{copy.teamRoleUser}</small>
                  </button>
                </div>
              </div>

              <div className="team-restaurant-selector">
                <span>{copy.teamInviteRestaurants}</span>
                <div className="team-restaurant-chips">
                  {assignableRestaurants.map((restaurant) => {
                    const isSelected = restaurantIds.includes(restaurant.restaurantId);
                    const memberRestaurantAccess = memberRestaurantAccessById.get(restaurant.restaurantId);

                    return (
                      <button
                        key={`member-${member.membershipId}-${restaurant.restaurantId}`}
                        type="button"
                        className={`team-restaurant-chip selectable ${isSelected ? "selected" : ""}`}
                        onClick={() => handleRestaurantToggle(restaurant.restaurantId)}
                        disabled={busy}
                        aria-pressed={isSelected}
                      >
                        <strong>{restaurant.restaurantName}</strong>
                        <small>
                          {isSelected
                            ? `${copy.selectedLabel} · ${formatRestaurantRole(memberRestaurantAccess?.role ?? "viewer")}`
                            : copy.noAccessLabel}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error ? <p className="message error">{error}</p> : null}
              {message ? <p className="message success">{message}</p> : null}

              <div className="panel-actions">
                <button type="button" className="primary-button" onClick={handleSave} disabled={busy || !hasChanges}>
                  {busy ? copy.processing : copy.teamSaveMember}
                </button>
                <button type="button" className="ghost-button danger-button" onClick={handleRemove} disabled={busy}>
                  {copy.teamRemoveMember}
                </button>
              </div>
            </>
          ) : (
            <p className="message">{copy.teamMemberImmutable}</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function TeamPermissionsPanel({
  session,
  members,
  invitations,
  loading,
  invitationsLoading,
  canManageTeam,
  inviteForm,
  inviteBusy,
  inviteMessage,
  inviteError,
  copy,
  onInviteEmailChange,
  onInviteFeatureToggle,
  onInviteRestaurantToggle,
  onCreateInvitation,
  onRevokeInvitation,
  onUpdateMember,
  onRemoveMember
}: TeamPermissionsPanelProps) {
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const commonUsersCount = members.filter((member) => member.role === "user").length;
  const coveredRestaurants = new Set(
    members.flatMap((member) => member.restaurants.map((restaurant) => restaurant.restaurantId))
  ).size;

  const formatAccountRole = (role: AccountMember["role"]) =>
    role === "owner" ? copy.teamRoleOwner : copy.teamRoleUser;

  const formatRestaurantRole = (role: "owner" | "viewer") =>
    role === "owner" ? copy.teamRoleOwner : copy.teamRoleViewer;

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <span className="eyebrow">{copy.navTeam}</span>
          <h3>{copy.teamTitle}</h3>
          <p>{copy.teamText}</p>
        </div>
      </div>

      <div className="totals-grid">
        <div className="totals-box compact">
          <span className="eyebrow">{copy.teamAccessModel}</span>
          <strong>{session.globalRole === "owner" ? "OWNER" : "USER"}</strong>
          <p>{copy.teamAccessModelText}</p>
        </div>
        <div className="totals-box compact">
          <span className="eyebrow">{copy.teamMembersTotal}</span>
          <strong>{formatNumber(members.length)}</strong>
          <p>{copy.teamAccountRole}</p>
        </div>
        <div className="totals-box compact">
          <span className="eyebrow">{copy.teamAdminsTotal}</span>
          <strong>{formatNumber(ownerCount)}</strong>
          <p>{copy.teamRoleOwner}</p>
        </div>
        <div className="totals-box compact">
          <span className="eyebrow">{copy.teamUsersTotal}</span>
          <strong>{formatNumber(commonUsersCount)}</strong>
          <p>{copy.teamRestaurantAccess}</p>
        </div>
        <div className="totals-box compact">
          <span className="eyebrow">{copy.teamRestaurantsTotal}</span>
          <strong>{formatNumber(coveredRestaurants)}</strong>
          <p>{copy.authRestaurants}</p>
        </div>
      </div>

      {loading ? <p className="message">{copy.processing}</p> : null}
      {!loading && members.length === 0 ? <p className="message">{copy.teamEmpty}</p> : null}

      {!loading && members.length > 0 ? (
        <div className="team-members-grid">
          {members.map((member) => (
            <TeamMemberCard
              key={member.membershipId}
              session={session}
              member={member}
              canManageTeam={canManageTeam}
              copy={copy}
              onSave={onUpdateMember}
              onRemove={onRemoveMember}
            />
          ))}
        </div>
      ) : null}

      {canManageTeam ? (
        <section className="team-management-grid">
          <article className="team-member-card">
            <div className="section-head compact">
              <div>
                <span className="eyebrow">{copy.teamInviteTitle}</span>
                <h3>{copy.teamInviteTitle}</h3>
                <p>{copy.teamInviteText}</p>
              </div>
            </div>

            <div className="team-invite-form">
              <label className="auth-field">
                <span>{copy.teamInviteEmail}</span>
                <input
                  value={inviteForm.email}
                  onChange={(event) => onInviteEmailChange(event.target.value)}
                  placeholder="nome@empresa.com"
                />
              </label>

              <div className="team-restaurant-selector">
                <span>{copy.teamInviteFeatures}</span>
                <div className="team-restaurant-chips">
                  <button
                    type="button"
                    className={`team-restaurant-chip selectable ${inviteForm.featureIds.includes(DEFAULT_INVITE_FEATURE) ? "selected" : ""}`}
                    onClick={() => onInviteFeatureToggle(DEFAULT_INVITE_FEATURE)}
                  >
                    <strong>{copy.teamFeatureDashboard}</strong>
                    <small>{copy.teamRoleUser}</small>
                  </button>
                </div>
              </div>

              <div className="team-restaurant-selector">
                <span>{copy.teamInviteRestaurants}</span>
                <div className="team-restaurant-chips">
                  {(session.memberships ?? []).map((membership) => (
                    <button
                      key={`invite-${membership.restaurantId}`}
                      type="button"
                      className={`team-restaurant-chip selectable ${inviteForm.restaurantIds.includes(membership.restaurantId) ? "selected" : ""}`}
                      onClick={() => onInviteRestaurantToggle(membership.restaurantId)}
                    >
                      <strong>{membership.restaurantName}</strong>
                      <small>{formatRestaurantRole(membership.role)}</small>
                    </button>
                  ))}
                </div>
              </div>

              <p className="message">{copy.teamInviteHint}</p>
              {inviteError ? <p className="message error">{inviteError}</p> : null}
              {inviteMessage ? <p className="message success">{inviteMessage}</p> : null}

              <div className="panel-actions">
                <button type="button" className="primary-button" onClick={onCreateInvitation} disabled={inviteBusy}>
                  {inviteBusy ? copy.processing : copy.teamInviteAction}
                </button>
              </div>
            </div>
          </article>

          <article className="team-member-card">
            <div className="section-head compact">
              <div>
                <span className="eyebrow">{copy.teamInvitePending}</span>
                <h3>{copy.teamInvitePending}</h3>
                <p>{copy.teamInviteHint}</p>
              </div>
            </div>

            {invitationsLoading ? <p className="message">{copy.processing}</p> : null}
            {!invitationsLoading && invitations.length === 0 ? <p className="message">{copy.teamInviteEmpty}</p> : null}

            {!invitationsLoading && invitations.length > 0 ? (
              <div className="team-members-grid compact">
                {invitations.map((invitation) => (
                  <article key={invitation.invitationId} className="team-member-card nested">
                    <div className="team-member-head">
                      <div>
                        <strong>{invitation.email}</strong>
                        <p>{formatAccountRole(invitation.accountRole)} · {copy.teamFeatureDashboard}</p>
                      </div>
                      <button
                        type="button"
                        className="ghost-button danger-button"
                        onClick={() => onRevokeInvitation(invitation.invitationId)}
                        disabled={inviteBusy}
                      >
                        {copy.teamInviteRevoke}
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
          </article>
        </section>
      ) : (
        <p className="message">{copy.ownerOnlyMessage}</p>
      )}
    </section>
  );
}
