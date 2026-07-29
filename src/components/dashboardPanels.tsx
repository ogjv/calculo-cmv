type RestaurantTileMembership = {
  membershipId: string;
  restaurantId: string;
  restaurantName: string;
  photoUrl?: string;
};

type RestaurantNavigatorPanelProps = {
  eyebrow: string;
  title: string;
  description?: string;
  memberships: RestaurantTileMembership[];
  activeRestaurantId?: string;
  onActivateRestaurant: (restaurantId: string) => void;
};

type DashboardGuideSignal = {
  title: string;
  text: string;
  tone: "good" | "mid" | "bad";
};

type DashboardGuideBar = {
  label: string;
  value: number;
  color: string;
};

type DashboardReadOnlyGuideProps = {
  eyebrow: string;
  title: string;
  text: string;
  revenueLabel: string;
  revenueValue: string;
  revenueTrend: string;
  salesChartTitle: string;
  salesChartHint: string;
  cmvTitle: string;
  cmvText: string;
  alertLabel: string;
  alertTitle: string;
  alertText: string;
  signals: DashboardGuideSignal[];
  bars: DashboardGuideBar[];
};

export function RestaurantNavigatorPanel({
  eyebrow,
  title,
  description,
  memberships,
  activeRestaurantId,
  onActivateRestaurant
}: RestaurantNavigatorPanelProps) {
  const hasMultipleRestaurants = memberships.length > 1;
  const shouldShowEyebrow = eyebrow.trim().toLowerCase() !== title.trim().toLowerCase();

  return (
    <section className="card restaurant-overview-panel">
      <div className="section-head compact">
        <div>
          {shouldShowEyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h3>{title}</h3>
          {hasMultipleRestaurants && description ? <p>{description}</p> : null}
        </div>
      </div>

      <div className="restaurant-navigator-grid">
        {memberships.map((membership) => {
          const isActive = membership.restaurantId === activeRestaurantId;

          return (
            <button
              key={membership.membershipId}
              type="button"
              className={`restaurant-tile ${isActive ? "active" : ""}`}
              onClick={() => onActivateRestaurant(membership.restaurantId)}
            >
              <div className={`restaurant-tile-avatar ${membership.photoUrl ? "has-photo" : ""}`}>
                {membership.photoUrl ? (
                  <img src={membership.photoUrl} alt={membership.restaurantName} />
                ) : (
                  <span>{membership.restaurantName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="restaurant-tile-copy">
                <strong>{membership.restaurantName}</strong>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardReadOnlyGuide({
  eyebrow,
  title,
  text,
  revenueLabel,
  revenueValue,
  revenueTrend,
  salesChartTitle,
  salesChartHint,
  cmvTitle,
  cmvText,
  alertLabel,
  alertTitle,
  alertText,
  signals,
  bars
}: DashboardReadOnlyGuideProps) {
  return (
    <section className="card dashboard-guide-card">
      <div className="dashboard-guide-copy">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>

        <div className="dashboard-guide-signal-grid">
          {signals.map((item) => (
            <article key={item.title} className={`dashboard-guide-signal ${item.tone}`}>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="dashboard-guide-visual">
        <article className="dashboard-guide-kpi">
          <span>{revenueLabel}</span>
          <strong>{revenueValue}</strong>
          <small>{revenueTrend}</small>
        </article>

        <article className="dashboard-guide-chart bars" aria-label="Exemplo de vendas por grupo">
          <div className="dashboard-guide-chart-head">
            <strong>{salesChartTitle}</strong>
            <span>{salesChartHint}</span>
          </div>
          <div className="dashboard-guide-bars">
            {bars.map((bar) => (
              <div key={bar.label} className="dashboard-guide-bar-row">
                <span>{bar.label}</span>
                <div>
                  <i
                    style={{
                      width: `${bar.value}%`,
                      backgroundColor: bar.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-guide-chart donut" aria-label="Exemplo de composição de CMV">
          <div className="dashboard-guide-donut" />
          <div>
            <strong>{cmvTitle}</strong>
            <span>{cmvText}</span>
          </div>
        </article>

        <article className="dashboard-guide-alert">
          <span>{alertLabel}</span>
          <strong>{alertTitle}</strong>
          <p>{alertText}</p>
        </article>
      </div>
    </section>
  );
}
