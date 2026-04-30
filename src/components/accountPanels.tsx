import type { AuthSession } from "../types";
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
  restaurantForm: ProfileFormState;
  newRestaurantName: string;
  busy: boolean;
  message?: string;
  error?: string;
  onClose: () => void;
  onUserNameChange: (value: string) => void;
  onRestaurantNameChange: (value: string) => void;
  onUserPhotoSelect: (file: File | null) => void;
  onRestaurantPhotoSelect: (file: File | null) => void;
  onCreateRestaurantNameChange: (value: string) => void;
  onSaveUser: () => void;
  onSaveRestaurant: () => void;
  onCreateRestaurant: () => void;
  onDeleteRestaurant: (restaurantId: string) => void;
  onDeleteAccount: () => void;
  onActivateRestaurant: (restaurantId: string) => void;
  canManageRestaurants: boolean;
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

export function AccountSettingsPanel({
  session,
  userForm,
  restaurantForm,
  newRestaurantName,
  busy,
  message,
  error,
  onClose,
  onUserNameChange,
  onRestaurantNameChange,
  onUserPhotoSelect,
  onRestaurantPhotoSelect,
  onCreateRestaurantNameChange,
  onSaveUser,
  onSaveRestaurant,
  onCreateRestaurant,
  onDeleteRestaurant,
  onDeleteAccount,
  onActivateRestaurant,
  canManageRestaurants,
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

        {canManageRestaurants ? (
          <section className="account-restaurant-section">
            <div className="section-head compact">
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
                      <article key={membership.membershipId} className={`restaurant-member-card ${isActive ? "active" : ""}`}>
                        <div>
                          <strong>{membership.restaurantName}</strong>
                          <p>{membership.role === "owner" ? copy.roleOwner : copy.roleViewer}</p>
                        </div>
                        <div className="restaurant-member-actions">
                          {!isActive ? (
                            <button type="button" className="ghost-button" onClick={() => onActivateRestaurant(membership.restaurantId)}>
                              {copy.activate}
                            </button>
                          ) : null}
                          {canDeleteThisRestaurant ? (
                            <button
                              type="button"
                              className="ghost-button danger-button"
                              onClick={() => onDeleteRestaurant(membership.restaurantId)}
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
        ) : null}

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
