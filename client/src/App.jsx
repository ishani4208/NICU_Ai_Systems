import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import History from "./pages/History.jsx";
import ReportDetail from "./pages/ReportDetail.jsx";
import { BrandIcon } from "./components/Icons.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <header className="main-header">
        <div className="header-brand">
          <div className="brand-mark">
            <BrandIcon size={16} />
          </div>
          <span>NeoListen AI</span>
        </div>

        <div className="header-actions">
          <nav className="tabs" aria-label="Main navigation">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
              Upload
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => (isActive ? "active" : "")}>
              History
            </NavLink>
          </nav>
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
