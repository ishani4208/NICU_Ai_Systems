import { Routes, Route, NavLink, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import History from "./pages/History.jsx";
import ReportDetail from "./pages/ReportDetail.jsx";
import { BrandIcon } from "./components/Icons.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";

export default function App() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="app-shell">
      <header className={`main-header ${scrolled ? "scrolled" : ""}`}>
        <Link to="/" className="header-brand" aria-label="NICU AI home">
          <div className="brand-mark">
            <BrandIcon size={16} />
          </div>
          <span>NICU AI</span>
        </Link>

        <div className="header-actions">
          <nav className="tabs" aria-label="Main navigation">
            <NavLink to="/history" className={({ isActive }) => (isActive ? "active" : "")}>
              History
            </NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <div className="page-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
        </Routes>
      </div>
    </div>
  );
}
