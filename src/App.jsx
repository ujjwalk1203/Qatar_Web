import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ManholeLayoutView from './components/ManholeLayoutView.jsx';
import AuditPage from './features/cra/AuditPage.jsx';
import ReservationPanel from './features/operator/ReservationPanel.jsx';
import MapWorkspace from './map/MapWorkspace.jsx';
import ApiServicePage from './pages/ApiServicePage.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="api-service" element={<ApiServicePage />} />
        <Route path="map-navigation" element={<MapWorkspace />} />
        <Route path="manhole-layout" element={<ManholeLayoutView />} />
        <Route path="reservation" element={<ReservationPanel />} />
        <Route path="audit-log" element={<AuditPage />} />
        <Route
          path="*"
          element={
            <section className="card panel stack">
              <h1>Page unavailable</h1>
              <p>Choose a workspace from the navigation.</p>
              <Link className="button secondary" to="/">
                Dashboard
              </Link>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}
