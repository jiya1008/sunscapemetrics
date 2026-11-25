export default function AboutPage() {
  return (
    <div className="col-xl-9">
      <h2 className="page-title mb-3">About HeatSafe</h2>
      <div className="card card-soft p-4">
        <p>
          HeatSafe (SunScape Metrics) helps facility managers and sustainability teams prioritize heat-mitigation
          investments for outdoor spaces using transparent, rule-based scoring and illustrative cost planning.
        </p>
        <h5>Important limitations</h5>
        <ul>
          <li>Scores reflect relative planning priority from observed site factors — not measured microclimate temperature.</li>
          <li>Weather data is area-level context from OpenWeather, not courtyard-specific readings.</li>
          <li>Cost estimates are illustrative INR ranges requiring local verification.</li>
          <li>This demo runs as a single workspace without user authentication.</li>
        </ul>
        <h5>Scoring weights (v1.0)</h5>
        <p className="mb-0 small text-muted">
          Shade deficiency 30%, surface concern 25%, exposure 20%, usage 15%, vegetation deficiency 10%.
        </p>
      </div>
    </div>
  );
}
