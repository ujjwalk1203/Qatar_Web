import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Download, FileText, Info } from 'lucide-react';
import { State, csv, exportFile } from '../../components/Shared.jsx';
import { api, usesMock, useResource } from '../../services/api.js';
import { operators } from '../../data/mockData.js';
import { assessReservation } from '../../domain/requests.js';
import MapWorkspace from '../../map/MapWorkspace.jsx';
import CapacitySection from './CapacitySection.jsx';
import RequestMonitor, { usePhoneViewport } from './RequestMonitor.jsx';
import { readSession, writeSession } from '../../services/session.js';
const demo = usesMock('/reservations');
const draftKey = 'cra-dms-reservation-draft-v2';
export default function ReservationPanel() {
  const phone = usePhoneViewport();
  const [params] = useSearchParams();
  return phone || params.get('view') === 'requests' ? (
    <RequestMonitor phone={phone} />
  ) : (
    <ReservationWorkspace key={params.get('manhole') || 'new'} />
  );
}
function ReservationWorkspace() {
  const network = useResource('/network');
  const [params] = useSearchParams();
  const incomingManhole = params.get('manhole');
  const [form, setForm] = useState(() => {
    const blank = {
      operator: 'O',
      requestKey: demo ? undefined : crypto.randomUUID(),
      spans: [],
      manholes: incomingManhole ? [incomingManhole] : [],
      cable: '',
      count: 1,
      spliceCount: 0,
      spliceType: '',
      spliceAt: '',
      comments: '',
    };
    const saved = demo ? readSession(draftKey) : null;
    const draft = !incomingManhole || saved?.originManhole === incomingManhole ? saved?.form : null;
    return draft && Array.isArray(draft.spans) && Array.isArray(draft.manholes)
      ? { ...blank, ...draft }
      : blank;
  });
  const [assessment, setAssessment] = useState(null);
  const [record, setRecord] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const selected = network.data?.spans.filter((s) => form.spans.includes(s.id)) || [];
  const routeNodes = new Set(selected.flatMap((s) => [s.a, s.b]));
  function update(next) {
    const updated = { ...form, ...next, requestKey: demo ? undefined : crypto.randomUUID() };
    updated.splicePlans = Object.fromEntries(
      Object.entries(updated.splicePlans || {}).filter(([id]) => updated.manholes.includes(id)),
    );
    updated.boreChoices = Object.fromEntries(
      Object.entries(updated.boreChoices || {}).filter(([id]) => updated.spans.includes(id)),
    );
    setForm(updated);
    setAssessment(null);
    setRecord(null);
    setError('');
    if (demo) writeSession(draftKey, { form: updated, originManhole: incomingManhole });
  }
  function toggle(key, value) {
    update({
      [key]: form[key].includes(value)
        ? form[key].filter((v) => v !== value)
        : [...form[key], value],
    });
  }
  function toggleSpan(id) {
    const next = form.spans.includes(id) ? form.spans.filter((v) => v !== id) : [...form.spans, id];
    const nodes = new Set(
      network.data.spans.filter((s) => next.includes(s.id)).flatMap((s) => [s.a, s.b]),
    );
    const manholes = form.manholes.filter((m) => nodes.has(m));
    update({
      spans: next,
      manholes,
      spliceAt: manholes.includes(form.spliceAt) ? form.spliceAt : '',
    });
  }
  async function send(submit) {
    setBusy(submit ? 'submit' : 'check');
    setError('');
    try {
      const { data } = await api.post(submit ? '/reservations' : '/reservations/check', {
        body: { ...form, operator: network.data?.actor?.operator || form.operator },
      });
      if (submit) {
        setRecord(data);
        if (demo) writeSession(draftKey, null);
      } else setAssessment(data);
    } catch (e) {
      setError(e.message);
      setAssessment(null);
    } finally {
      setBusy('');
    }
  }
  function report(asCsv) {
    const rows = [
      ['Field', 'Value'],
      ['Reservation ID', record.id],
      ['Status', record.status],
      ['Operator', operators[record.operator]],
      ['Duct spans', record.spans.join(', ')],
      ['Manholes', record.manholes.join(', ')],
      ['Cable type', record.cable],
      ['Cable count', record.count],
      [
        'Splices',
        record.splicePlans
          ? Object.values(record.splicePlans).reduce((sum, p) => sum + p.count, 0)
          : record.spliceCount,
      ],
      ...Object.entries(record.splicePlans || {})
        .filter(([, p]) => p.count)
        .map(([id, p]) => ['Splices · ' + id, p.count + ' ' + p.type]),
      ['Splice type', record.spliceType],
      ['Splice location', record.spliceAt],
      ['Comments', record.comments],
      ['Created', record.createdAt],
      ['Mode', demo ? 'Demo' : 'Connected'],
    ];
    exportFile(
      record.id + (asCsv ? '.csv' : '.txt'),
      asCsv
        ? csv(rows)
        : [
            'CRA Duct Space and Splice Reservation',
            ...rows.slice(1).map(([k, v]) => k + ': ' + v),
          ].join('\n'),
      asCsv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8',
    );
  }
  const preview = network.data ? assessReservation(form, network.data) : null;
  const totalLength = selected.reduce((sum, s) => sum + s.length, 0);
  const contiguous = preview?.contiguous;
  function chooseAsset(id) {
    if (busy || record) return;
    if (network.data.spans.some((s) => s.id === id)) toggleSpan(id);
    else if (routeNodes.has(id)) toggle('manholes', id);
    else setError('Select a duct span connected to ' + id + ' first.');
  }
  return (
    <>
      <State resource={network} />
      {network.data && (
        <div className="operator-workspace">
          <MapWorkspace
            embedded
            selection={[...form.spans, ...form.manholes]}
            onAsset={chooseAsset}
            onClear={() => {
              if (!busy && !record) update({ spans: [], manholes: [], spliceAt: '' });
            }}
          />
          <form
            id="reservation-form"
            className="card reservation-task"
            onSubmit={(event) => {
              event.preventDefault();
              send(false);
            }}
          >
            <div className="task-title">
              <h1>Duct space &amp; splice reservation</h1>
              <Link className="quiet-link" to="/reservation?view=requests">
                My requests
              </Link>
            </div>
            <div className="task-body">
              <fieldset disabled={!!busy || !!record}>
                <section className="task-section">
                  <h2>1 · Selection</h2>
                  <div className="selection-list">
                    {selected.map((s) => (
                      <span key={s.id} className="selection-chip">
                        <bdi>{s.id}</bdi> · {s.length} m
                      </span>
                    ))}
                    {selected.length > 0 && (
                      <span className="code">{routeNodes.size} manholes on route</span>
                    )}
                  </div>
                  {selected.length > 0 ? (
                    <ul className="checks">
                      <li className={contiguous ? 'pass' : 'fail'}>
                        {contiguous ? <CheckCircle2 size={16} /> : <Info size={16} />}{' '}
                        {contiguous
                          ? 'Contiguous route · ' + totalLength + ' m'
                          : 'Duct spans must form a contiguous route.'}
                      </li>
                      <li
                        className={selected.every((s) => s.status === 'In-Place') ? 'pass' : 'fail'}
                      >
                        <Info size={16} />{' '}
                        {selected.every((s) => s.status === 'In-Place')
                          ? 'All assets In-Place (IPL)'
                          : 'Only In-Place spans can be requested.'}
                      </li>
                      <li>
                        <Info size={16} /> {routeNodes.size} of 100 manholes allowed per request
                      </li>
                    </ul>
                  ) : (
                    <p className="muted">Select contiguous duct spans on the map.</p>
                  )}
                  <details className="asset-options">
                    <summary>Select spans by ID</summary>
                    <div className="options">
                      {network.data.spans.map((s) => (
                        <label className="check option" key={s.id}>
                          <input
                            type="checkbox"
                            checked={form.spans.includes(s.id)}
                            onChange={() => toggleSpan(s.id)}
                          />
                          <span>
                            <strong>
                              <bdi>{s.id}</bdi>
                            </strong>
                            <small>
                              {s.length} m · {s.status === 'Locked' ? 'Locked by CRA' : s.status}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </details>
                  {routeNodes.size > 0 && (
                    <div className="inline-checks" aria-label="Manholes on route">
                      {[...routeNodes].map((id) => (
                        <label className="check" key={id}>
                          <input
                            type="checkbox"
                            checked={form.manholes.includes(id)}
                            onChange={() => toggle('manholes', id)}
                          />
                          <bdi>{id}</bdi>
                        </label>
                      ))}
                    </div>
                  )}
                </section>
                <CapacitySection
                  spans={selected}
                  manholes={routeNodes}
                  capacity={(assessment || preview).capacity}
                  limit={network.data.catalog.limit}
                />
                <section className="task-section">
                  <h2>3 · Request details</h2>
                  <label>
                    Operator
                    <select
                      value={network.data?.actor?.operator || form.operator}
                      disabled={!!network.data?.actor?.operator}
                      onChange={(e) => update({ operator: e.target.value })}
                    >
                      {Object.entries(operators).map(([id, name]) => (
                        <option value={id} key={id}>
                          {name} ({id}-)
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field-row">
                    <label>
                      Cable type
                      <select
                        aria-label="Cable type"
                        required
                        value={form.cable}
                        onChange={(e) => update({ cable: e.target.value })}
                      >
                        <option value="">Select type</option>
                        {network.data.catalog.cables.map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Number of cables
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={form.count || ''}
                        onChange={(e) => update({ count: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  {selected.map((span) => (
                    <label key={span.id}>
                      Cable bore · {span.id}
                      <select
                        value={form.boreChoices?.[span.id] ?? 0}
                        onChange={(e) =>
                          update({
                            boreChoices: { ...form.boreChoices, [span.id]: Number(e.target.value) },
                          })
                        }
                      >
                        {span.bores.map((used, i) => (
                          <option key={i} value={i}>
                            B-{String(i + 1).padStart(2, '0')} · {used}% used
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {form.manholes.map((id) => {
                    const plan = form.splicePlans?.[id] || {
                      count: form.spliceAt === id ? form.spliceCount : 0,
                      type: form.spliceAt === id ? form.spliceType : '',
                    };
                    function changePlan(next) {
                      const plans = Object.fromEntries(
                        form.manholes.map((m) => [
                          m,
                          form.splicePlans?.[m] || {
                            count: form.spliceAt === m ? form.spliceCount : 0,
                            type: form.spliceAt === m ? form.spliceType : '',
                          },
                        ]),
                      );
                      plans[id] = { ...plan, ...next };
                      update({ splicePlans: plans, spliceAt: '', spliceType: '', spliceCount: 0 });
                    }
                    return (
                      <div className="field-row" key={id}>
                        <label>
                          Planned splices · {id}
                          <input
                            type="number"
                            min="0"
                            step="1"
                            required
                            value={plan.count}
                            onChange={(e) => changePlan({ count: Number(e.target.value) })}
                          />
                        </label>
                        {plan.count > 0 && (
                          <label>
                            Splice type · {id}
                            <select
                              required
                              value={plan.type}
                              onChange={(e) => changePlan({ type: e.target.value })}
                            >
                              <option value="">Select type</option>
                              {network.data.catalog.spliceTypes.map((type) => (
                                <option key={type}>{type}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    );
                  })}
                  <label>
                    Comments{' '}
                    <textarea
                      value={form.comments}
                      onChange={(e) => update({ comments: e.target.value })}
                    />
                  </label>
                  {demo && (
                    <small className="muted">
                      Sample cable catalogue, bore allocation and splice values require CRA
                      confirmation.
                    </small>
                  )}
                </section>
              </fieldset>
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              {assessment?.errors.some((e) => e !== 'Duct spans must form a contiguous route.') && (
                <ul className="notice error">
                  {assessment.errors
                    .filter((e) => e !== 'Duct spans must form a contiguous route.')
                    .map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                </ul>
              )}
              {assessment?.ok && !record && (
                <p className="notice" role="status">
                  Space available. Submit the request to hold capacity.
                </p>
              )}
              {record && (
                <div className="notice stack" role="status">
                  <strong>
                    <CheckCircle2 size={17} /> <bdi>{record.id}</bdi>{' '}
                    <span className="status-chip submitted">{record.status}</span>
                  </strong>
                  <span>{demo ? 'Saved in this demo tab.' : 'Reservation submitted.'}</span>
                  <button type="button" className="button secondary" onClick={() => report(false)}>
                    <FileText size={16} /> Download report
                  </button>
                  <button type="button" className="button secondary" onClick={() => report(true)}>
                    <Download size={16} /> Export CSV
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      update({
                        spans: [],
                        manholes: [],
                        spliceCount: 0,
                        spliceType: '',
                        spliceAt: '',
                        comments: '',
                      })
                    }
                  >
                    Start another reservation
                  </button>
                </div>
              )}
            </div>
            <div className="task-actions">
              <div>
                <button className="button secondary" disabled={!!busy || !!record}>
                  {busy === 'check' ? 'Checking…' : 'Check availability'}
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={!assessment?.ok || !!busy || !!record}
                  onClick={() => send(true)}
                >
                  {busy === 'submit' ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
              <small className="muted">
                Space is held from submission, first come, first served. Reservation ID starts with{' '}
                <bdi>{network.data?.actor?.operator || form.operator}-</bdi>.
              </small>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

