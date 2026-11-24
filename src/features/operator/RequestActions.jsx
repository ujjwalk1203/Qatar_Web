import React, { useState } from 'react';
import { api, demo } from '../../services/api.js';
import { useLanguage } from '../../services/language.js';

export default function RequestActions({ record, onChange }) {
  const { arabic } = useLanguage();
  const t = (en, ar) => (arabic ? ar : en);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const visits = record.visits || [];
  const can = (action) => demo || record.allowedActions?.includes(action);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const action = event.nativeEvent.submitter?.value;
    if (!action) return;
    setBusy(true);
    setError('');
    try {
      const { data: updated } = await api.post(
        '/reservations/' + encodeURIComponent(record.id) + '/actions',
        { body: { ...data, action } },
      );
      onChange(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const button = (action, en, ar) =>
    can(action) && (
      <button className="button secondary" disabled={busy} value={action}>
        {t(en, ar)}
      </button>
    );
  const reason = (
    <label>
      {t('Review remarks', 'ملاحظات المراجعة')}
      <input name="reason" maxLength={500} />
    </label>
  );
  return (
    <div className="stack">
      {record.expiresAt && (
        <small>
          {t('Reservation expiry', 'انتهاء الحجز')} ·{' '}
          {new Date(record.expiresAt).toLocaleDateString(arabic ? 'ar-QA' : 'en-GB')}
        </small>
      )}
      {demo && (
        <small className="muted">
          {t(
            'Demo workspace includes operator and CRA reviewer actions.',
            'تتضمن مساحة العرض إجراءات المشغل ومراجع الهيئة.',
          )}
        </small>
      )}
      {record.status === 'Submitted' && can('approve') && (
        <form className="stack" onSubmit={submit}>
          <h3>{t('CRA reservation review', 'مراجعة الحجز')}</h3>
          {reason}
          <div className="field-row">
            {button('approve', 'Approve reservation', 'الموافقة على الحجز')}
            {button('reject', 'Reject with reason', 'رفض مع بيان السبب')}
          </div>
        </form>
      )}
      {record.reason && <p>{record.reason}</p>}
      {record.status === 'Reserved' && can('book') && (
        <form className="stack" onSubmit={submit}>
          <h3>{t('Request installation access', 'طلب دخول للتركيب')}</h3>
          <label>
            {t('Manhole', 'غرفة التفتيش')}
            <select name="manhole">
              {record.manholes.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <label>
              {t('From', 'من')}
              <input required name="from" type="date" />
            </label>
            <label>
              {t('To', 'إلى')}
              <input required name="to" type="date" />
            </label>
          </div>
          {button('book', 'Request access', 'طلب الدخول')}
        </form>
      )}
      {visits.map((v) => (
        <section key={v.id} className="card panel stack">
          <strong>
            <bdi>{v.id}</bdi> · {v.status}
          </strong>
          <small>
            {v.manhole} · {v.from} – {v.to}
          </small>
          {v.reason && <p>{v.reason}</p>}
          {v.evidence && (
            <p>
              {t('As-built record', 'سجل التنفيذ')} · {v.evidence}
            </p>
          )}
          <form onSubmit={submit} className="stack">
            <input type="hidden" name="visitId" value={v.id} />
            {v.status === 'Open' && can('permit') && (
              <>
                {reason}
                <div className="field-row">
                  {button('permit', 'Approve access', 'الموافقة على الدخول')}
                  {button('deny', 'Reject access', 'رفض الدخول')}
                </div>
              </>
            )}
            {v.status === 'Approved' && can('complete') && (
              <>
                <label>
                  {t('As-built document reference', 'مرجع مستند التنفيذ')}
                  <input name="evidence" maxLength={300} />
                </label>
                {button('complete', 'Send in-service notice', 'إرسال إشعار التشغيل')}
                {button('block', 'Report blockage', 'الإبلاغ عن انسداد')}
              </>
            )}
            {v.status === 'Blocked' &&
              button('clear', 'Record contractor clearance', 'تسجيل إزالة الانسداد')}
            {v.status === 'In service' &&
              button('close', 'Confirm as-built and close', 'تأكيد مستند التنفيذ والإغلاق')}
          </form>
        </section>
      ))}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </div>
  );
}
