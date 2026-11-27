import { useLanguage } from '../services/language.js';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { modules } from '../components/Sidebar.jsx';
import { State } from '../components/Shared.jsx';
import { RequestList } from '../features/operator/RequestMonitor.jsx';
import Qnd95GisRenderer from '../map/Qnd95GisRenderer.jsx';
import { demo, useResource } from '../services/api.js';

const openStatuses = new Set(['Submitted', 'Under review', 'Revision required']);

export default function Dashboard() {
  const { arabic, t } = useLanguage();
  const network = useResource('/network');
  const requests = useResource('/reservations');
  const navigate = useNavigate();
  const openRequests = requests.data?.filter(({ status }) => openStatuses.has(status)).length;

  return (
    <div className="dashboard">
      <header className="section-head">
        <h1>{t('Dashboard')}</h1>
        <Link to="/reservation" className="button">
          <ClipboardList size={16} />
          <span className="desktop-label">{t('New reservation')}</span>
          <span className="phone-label">{t('My requests')}</span>
        </Link>
      </header>

      <section className="card overview-map" aria-labelledby="network-overview">
        <div className="section-head overview-map-head">
          <h2 id="network-overview">{t('Network overview')}</h2>
          <Link className="button secondary" to="/map-navigation">
            {t('Open network map')}
          </Link>
        </div>
        <dl className="overview-metrics">
          <div>
            <dt>{t('Duct spans')}</dt>
            <dd>{network.data?.spans.length ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('Manholes')}</dt>
            <dd>{network.data?.manholes.length ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('Open requests')}</dt>
            <dd>{openRequests ?? '—'}</dd>
          </div>
        </dl>
        <State resource={network} />
        {network.data && (
          <div className="overview-graphic">
            <Qnd95GisRenderer
              network={network.data}
              compact
              onSelectAsset={(id) => navigate('/map-navigation?asset=' + encodeURIComponent(id))}
            />
          </div>
        )}
        <div className="overview-map-foot">
          <span>
            <i className="line-available" />
            {t('Available')}
          </span>
          <span>
            <i className="line-near" />
            {t('Near limit')}
          </span>
          <span>
            <i className="line-full" />
            {t('Full')}
          </span>
          <span>
            <i className="line-locked" />
            {t('Locked')}
          </span>
          <span className="map-source">{t(demo ? 'QND95 · CGIS GIS Map' : 'ArcGIS QND95 Web Map')}</span>
        </div>
      </section>

      <div className="dashboard-details">
        <section className="card panel" aria-labelledby="workspaces-heading">
          <h2 id="workspaces-heading">{t('Workspaces')}</h2>
          <ul className="workspace-links">
            {modules.map(({ path, code, title, arabicTitle, description, icon: Icon }) => (
              <li key={path}>
                <Link className="workspace-link" to={path}>
                  <Icon size={18} />
                  <span>
                    <strong>{arabic ? arabicTitle : title}</strong>
                    <small>{t(description)}</small>
                  </span>
                  <span className="workspace-code" dir="ltr">{code}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="card panel overview-requests" aria-labelledby="recent-requests">
          <div className="section-head">
            <h2 id="recent-requests">{t('Recent requests')}</h2>
            {requests.data?.length > 0 && (
              <Link to="/reservation?view=requests" className="quiet-link">
                {t('View all requests')}
              </Link>
            )}
          </div>
          <State resource={requests} />
          {requests.data && (
            <RequestList
              records={requests.data.slice(0, 3)}
              empty="Submitted requests will appear here."
            />
          )}
        </section>
      </div>
    </div>
  );
}
