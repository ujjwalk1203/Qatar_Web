import React from 'react';
import { NavLink } from 'react-router-dom';
import { Blocks, ClipboardList, History, LayoutDashboard, Map, Network } from 'lucide-react';

export const modules = [
  {
    path: '/map-navigation',
    code: 'M-03',
    title: 'Network map',
    arabicTitle: 'خريطة الشبكة',
    description: 'Find ducts and manholes on the map.',
    icon: Map,
  },
  {
    path: '/manhole-layout',
    code: 'M-13',
    title: 'Manhole layout',
    arabicTitle: 'مخطط غرفة التفتيش',
    description: 'Inspect ducts, cable connections and splices.',
    icon: Network,
  },
  {
    path: '/reservation',
    code: 'O-02',
    title: 'Map & requests',
    arabicTitle: 'الخريطة والطلبات',
    description: 'Check capacity and submit a reservation.',
    icon: ClipboardList,
  },
  {
    path: '/audit-log',
    code: 'C-08',
    title: 'Audit log',
    arabicTitle: 'سجل التدقيق',
    description: 'Review sign-ins, decisions and overrides.',
    icon: History,
  },
  {
    path: '/api-service',
    code: 'F-04',
    title: 'API service layer',
    arabicTitle: 'طبقة خدمات الواجهة',
    description: 'Send test requests and inspect responses.',
    icon: Blocks,
  },
];

export default function Sidebar({ arabic }) {
  const dashboardLabel = arabic ? 'لوحة المعلومات' : 'Dashboard';

  return (
    <aside className="sidebar">
      <nav aria-label={arabic ? 'التنقل الرئيسي' : 'Main navigation'}>
        <NavLink end to="/" title={dashboardLabel}>
          <LayoutDashboard size={18} />
          <span>{dashboardLabel}</span>
        </NavLink>
        {modules.map(({ path, title, arabicTitle, icon: Icon }) => {
          const label = arabic ? arabicTitle : title;
          return (
            <NavLink key={path} to={path} title={label}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
