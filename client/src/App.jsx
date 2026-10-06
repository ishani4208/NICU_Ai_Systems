import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import History from "./pages/History.jsx";
import ReportDetail from "./pages/ReportDetail.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <header className="main-header">
        <div>
          <h1 className="title-text">NeoListen AI</h1>
          <div className="subtitle-text">
            NICU Respiratory Sound Classifier &amp; Clinical Decision Support Dashboard
          </div>
        </div>
        <nav className="tabs">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Upload
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => (isActive ? "active" : "")}>
            History
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/reports/:id" element={<ReportDetail />} />
      </Routes>

      <div className="footer-note">
        NeoListen AI is a clinical decision-support tool, not an autonomous diagnostic
        system. All results require clinician review.
      </div>
    </div>
  );
}
