import { useLanguage } from '../services/language.js';
import React from 'react';
export function Title({ code, title, children }) {
  return (
    <div className="page-title">
      {code && <span className="code">{code}</span>}
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
export function State({ resource }) {
  const { t } = useLanguage();
  return resource.loading ? (
    <div className="resource-loading" role="status">
      <span />
      {t('Loading workspace…')}
    </div>
  ) : resource.error ? (
    <div className="notice error resource-error" role="alert">
      <p>{resource.error}</p>
      {resource.retry && (
        <button type="button" className="button secondary" onClick={resource.retry}>
          {t('Try again')}
        </button>
      )}
    </div>
  ) : null;
}
export function exportFile(name, body, type = 'text/plain') {
  const href = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export function csv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '');
          return (
            '"' + (/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"'
          );
        })
        .join(',')
    )
    .join('\r\n');
}
