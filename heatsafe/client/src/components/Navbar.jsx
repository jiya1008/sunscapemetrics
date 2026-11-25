import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
  { to: '/sites', icon: 'bi-buildings', label: 'Sites' },
  { to: '/assessment', icon: 'bi-clipboard-check', label: 'New Assessment' },
  { to: '/recommendations', icon: 'bi-lightbulb', label: 'Recommendations' },
  { to: '/budget', icon: 'bi-cash-stack', label: 'Budget Planner' },
  { to: '/progress', icon: 'bi-graph-up-arrow', label: 'Progress Tracker' },
  { to: '/about', icon: 'bi-info-circle', label: 'About HeatSafe' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <nav className="navbar navbar-expand bg-white border-bottom px-3 py-2 shadow-sm">
      <Link to="/" className="navbar-brand mb-0 h1 fs-5 text-primary-brand fw-bold text-decoration-none">
        <i className="bi bi-sun-fill me-2" aria-hidden />
        HeatSafe
      </Link>
      <span className="ms-2 small text-muted d-none d-md-inline">SunScape Metrics</span>

      <div className="ms-auto d-flex align-items-center gap-3">
        {user && (
          <span className="small text-muted d-none d-lg-inline">
            <i className="bi bi-person-circle me-1" aria-hidden />
            {user.name}
          </span>
        )}
        <div className="dropdown" ref={menuRef}>
          <button
            type="button"
            className="btn btn-outline-success"
            id="main-nav-toggle"
            aria-expanded={open}
            aria-haspopup="true"
            aria-controls="main-nav-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <i className="bi bi-list me-1" aria-hidden />
            Menu
          </button>
          <ul
            id="main-nav-menu"
            className={`dropdown-menu dropdown-menu-end shadow ${open ? 'show' : ''}`}
            aria-labelledby="main-nav-toggle"
            style={{ display: open ? 'block' : undefined }}
          >
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => `dropdown-item d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <i className={`bi ${link.icon}`} aria-hidden />
                  {link.label}
                </NavLink>
              </li>
            ))}
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button
                type="button"
                className="dropdown-item d-flex align-items-center gap-2 text-danger"
                onClick={handleLogout}
              >
                <i className="bi bi-box-arrow-right" aria-hidden />
                Log out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}