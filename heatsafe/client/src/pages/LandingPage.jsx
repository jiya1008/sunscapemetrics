import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-vh-100 d-flex flex-column">
      <header className="py-4 px-3 border-bottom bg-white">
        <div className="container d-flex align-items-center justify-content-between">
          <span className="fw-bold fs-4 text-primary-brand">
            <i className="bi bi-sun-fill me-2" aria-hidden />
            HeatSafe
          </span>
          <Link to="/dashboard" className="btn btn-primary">
            Open Dashboard
          </Link>
        </div>
      </header>
      <main className="flex-grow-1">
        <section className="py-5 bg-white">
          <div className="container col-lg-8">
            <p className="text-uppercase small fw-semibold text-success mb-2">SunScape Metrics</p>
            <h1 className="display-5 fw-bold text-primary-brand">
              Heat-risk assessment and mitigation planning for outdoor spaces
            </h1>
            <p className="lead text-muted mt-3">
              Institutions often struggle to decide which courtyards, walkways, and parking areas to improve first
              when budgets are limited. HeatSafe turns site observations into a transparent, prioritized action list.
            </p>
            <div className="d-flex flex-wrap gap-2 mt-4">
              <Link to="/dashboard" className="btn btn-primary btn-lg">
                Get Started
              </Link>
              <Link to="/about" className="btn btn-outline-success btn-lg">
                About the tool
              </Link>
            </div>
          </div>
        </section>
        <section className="py-5">
          <div className="container">
            <div className="row g-4">
              {[
                {
                  icon: 'bi-buildings',
                  title: 'Site registry',
                  text: 'Register campuses, schools, housing societies, and offices with location metadata.',
                },
                {
                  icon: 'bi-clipboard-data',
                  title: 'Outdoor assessments',
                  text: 'Capture shade, surfaces, vegetation, exposure, and usage for each outdoor area.',
                },
                {
                  icon: 'bi-bar-chart',
                  title: 'Explainable scoring',
                  text: 'Weighted priority score (0–100) with factor breakdown — planning support, not certification.',
                },
                {
                  icon: 'bi-cash-coin',
                  title: 'Budget planner',
                  text: 'Build INR action plans, compare interventions, and track implementation progress.',
                },
              ].map((f) => (
                <div className="col-md-6 col-lg-3" key={f.title}>
                  <div className="card card-soft h-100 p-3">
                    <i className={`bi ${f.icon} fs-2 text-primary-brand`} aria-hidden />
                    <h5 className="mt-2">{f.title}</h5>
                    <p className="text-muted small mb-0">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="py-3 text-center text-muted small border-top bg-white">
        HeatSafe is a decision-support planning tool, not a certified safety assessment.
      </footer>
    </div>
  );
}
