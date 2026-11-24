import React, { useRef, useState } from 'react';
import { api, demo, useResource } from '../../services/api.js';
import { State } from '../../components/Shared.jsx';
import { operators } from '../../data/mockData.js';
import { useLanguage } from '../../services/language.js';

export default function MaintenanceAccess({ onCreated }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const network = useResource(open ? '/network' : null);
  const { arabic } = useLanguage(),
    t = (en, ar) => (arabic ? ar : en);
  const key = useRef(null);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const body = {
      ...fields,
      operator: network.data?.actor?.operator || fields.operator,
      kind: 'Maintenance',
      spans: [],
      manholes: [fields.manhole],
    };
    if (!demo) body.requestKey = key.current ??= crypto.randomUUID();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/reservations', { body });
      onCreated(data);
      key.current = null;
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card panel stack">
      <button
        className="button secondary"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t('Maintenance access', 'دخول للصيانة')}
      </button>
      {open && (
        <>
          <State resource={network} />
          {network.data &&
            (network.data.actor?.role === 'reviewer' ? (
              <p>
                {t(
                  'Operator access is required to submit a booking.',
                  'يتطلب تقديم الطلب صلاحية المشغل.',
                )}
              </p>
            ) : (
              <form
                className="stack"
                onSubmit={submit}
                onChange={() => {
                  key.current = null;
                  setError('');
                }}
              >
                <fieldset disabled={busy}>
                  <label>
                    {t('Operator', 'المشغل')}
                    <select
                      name="operator"
                      defaultValue={network.data.actor?.operator || 'O'}
                      disabled={!!network.data.actor?.operator}
                    >
                      {Object.entries(operators).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('Maintenance manhole', 'غرفة التفتيش للصيانة')}
                    <select required name="manhole">
                      <option value="">{t('Select manhole', 'اختر غرفة التفتيش')}</option>
                      {network.data.manholes
                        .filter((m) => m.status === 'In-Place')
                        .map((m) => (
                          <option key={m.id}>{m.id}</option>
                        ))}
                    </select>
                  </label>
                  <div className="field-row">
                    <label>
                      {t('From', 'من')}
                      <input required type="date" name="from" />
                    </label>
                    <label>
                      {t('To', 'إلى')}
                      <input required type="date" name="to" />
                    </label>
                  </div>
                  <button className="button">
                    {t('Submit maintenance request', 'إرسال طلب الصيانة')}
                  </button>
                </fieldset>
              </form>
            ))}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
