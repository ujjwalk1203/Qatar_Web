import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import RouteError from './RouteError.jsx';
import { readSession, writeSession } from '../services/session.js';
export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => readSession('cra-dms-sidebar') === true);
  const [arabic, setArabic] = useState(() => readSession('cra-dms-arabic') === true);
  const { pathname } = useLocation();
  const workspace = useRef(null);
  const previous = useRef(pathname);
  useEffect(() => {
    writeSession('cra-dms-sidebar', collapsed);
  }, [collapsed]);
  useEffect(() => {
    writeSession('cra-dms-arabic', arabic);
    document.documentElement.lang = arabic ? 'ar' : 'en';
  }, [arabic]);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    window.scrollTo({ top: 0, behavior: 'instant' });
    workspace.current?.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <div
      className={'shell ' + (collapsed ? 'collapsed' : '')}
      dir={arabic ? 'rtl' : 'ltr'}
      lang={arabic ? 'ar' : 'en'}
    >
      <a href="#workspace" className="skip-link">
        {arabic ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      <Header
        arabic={arabic}
        setArabic={setArabic}
        collapsed={collapsed}
        toggle={() => setCollapsed(!collapsed)}
      />
      <Sidebar arabic={arabic} />
      <main id="workspace" className="workspace" tabIndex={-1} ref={workspace}>
        <RouteError key={pathname}>
          <Outlet context={{ arabic }} />
        </RouteError>
      </main>
    </div>
  );
}
