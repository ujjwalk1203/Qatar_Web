import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, Search } from 'lucide-react';
import { demo } from '../services/api.js';
export default function Header({ arabic, setArabic, collapsed, toggle }) {
  const { pathname } = useLocation(),
    navigate = useNavigate();
  const [query, setQuery] = useState(''),
    [alerts, setAlerts] = useState(false);
  const operator = ['/reservation', '/manhole-layout'].includes(pathname);
  const t = (en, ar) => (arabic ? ar : en);
  function search(event) {
    event.preventDefault();
    const id = query.trim();
    if (!id) return;
    if (/^[OVQ]-/i.test(id)) navigate('/reservation?view=requests&q=' + encodeURIComponent(id));
    else navigate('/map-navigation?asset=' + encodeURIComponent(id));
    setAlerts(false);
  }
  return (
    <header className="top">
      <button
        type="button"
        className="shell-icon"
        aria-label={t('Toggle navigation', 'تبديل قائمة التنقل')}
        aria-expanded={!collapsed}
        onClick={toggle}
      >
        <Menu size={20} />
      </button>
      <div className="identity">
        <span className="dms-mark" dir="ltr">
          DMS
        </span>
        <div>
          <strong>{t('Duct Management System', 'نظام إدارة القنوات')}</strong>
          <small>
            {operator
              ? t('Operator portal', 'بوابة المشغل')
              : t('Regulator portal · CRA', 'بوابة الهيئة')}
          </small>
        </div>
      </div>
      <form className="global-search" onSubmit={search}>
        <Search size={17} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('Search asset or request ID', 'البحث عن معرّف الأصل أو الطلب')}
          placeholder={t('Search asset or request ID', 'ابحث عن معرّف الأصل أو الطلب')}
        />
      </form>
      <div className="header-actions">
        <span className="code">
          {demo ? t('Demo mode', 'الوضع التجريبي') : t('Connected', 'متصل')}
        </span>
        <button
          className="shell-icon lang-switch"
          onClick={() => setArabic(!arabic)}
          lang={arabic ? 'en' : 'ar'}
        >
          {arabic ? 'English' : 'العربية'}
        </button>
        <div className="alerts-control">
          <button
            className="shell-icon"
            aria-label={t('Notifications', 'الإشعارات')}
            aria-expanded={alerts}
            onClick={() => setAlerts(!alerts)}
          >
            <Bell size={19} />
          </button>
          {alerts && (
            <div className="alert-popover card panel">
              <strong>{t('Notifications', 'الإشعارات')}</strong>
              <p>{t('No new notifications.', 'لا توجد إشعارات جديدة.')}</p>
            </div>
          )}
        </div>
        <div className="identity profile">
          <span className="avatar" dir="ltr">
            {operator ? 'RM' : 'CR'}
          </span>
          <div>
            <strong>
              {operator
                ? t('Operator user', 'مستخدم المشغل')
                : t('CRA workspace', 'مساحة عمل الهيئة')}
            </strong>
            <small>{operator ? 'Ooredoo' : 'CRA'}</small>
          </div>
        </div>
      </div>
    </header>
  );
}
