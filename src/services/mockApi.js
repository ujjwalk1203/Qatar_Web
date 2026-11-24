import { assessMaintenance, initializeMaintenance } from '../domain/access.js';
import { processAction } from '../domain/review.js';
import { manholes, spans, catalog, auditSeed } from '../data/mockData.js';
import { assessReservation } from '../domain/requests.js';
import { readSession, writeSession } from './session.js';
const storageKey = 'cra-dms-demo-v1';
const saved = readSession(storageKey);
const network = { manholes, spans: structuredClone(spans), catalog };
const reservations = Array.isArray(saved?.reservations) ? saved.reservations : [];
const recordedEvents = Array.isArray(saved?.events) ? saved.events : [];
const audit = [...recordedEvents, ...auditSeed];
let sequence = Number.isSafeInteger(saved?.sequence) ? saved.sequence : 1000;
let eventSequence = Number.isSafeInteger(saved?.eventSequence) ? saved.eventSequence : 4000;
function rebuildCapacity() {
  for (const span of network.spans)
    span.bores = [...spans.find((original) => original.id === span.id).bores];
  for (const reservation of reservations) {
    if (['Rejected', 'Expired'].includes(reservation.status)) continue;
    for (const line of reservation.assessment?.capacity || []) {
      const span = network.spans.find((item) => item.id === line.id);
      if (span)
        span.bores = span.bores.map(
          (used, index) => used + (line.projected[index] - line.existing[index]),
        );
    }
  }
}
rebuildCapacity();
function recordDecision(record, action, detail, target = record.id) {
  appendEvent({
    id: 'EV-' + ++eventSequence,
    at: new Date().toISOString(),
    user: ['book', 'block', 'complete'].includes(action) ? 'operator.demo' : 'cra.reviewer',
    action,
    status: 'Success',
    target,
    detail,
  });
}
function expireReservations() {
  for (const record of reservations) {
    if (
      record.status !== 'Reserved' ||
      !record.expiresAt ||
      Date.parse(record.expiresAt) > Date.now()
    )
      continue;
    const used = record.visits?.some((v) => ['In service', 'Closed'].includes(v.status));
    record.status = used ? 'In service' : 'Expired';
    if (!used)
      for (const v of record.visits || [])
        if (['Open', 'Approved', 'Blocked'].includes(v.status)) v.status = 'Cancelled';
    rebuildCapacity();
    recordDecision(
      record,
      record.status,
      used ? 'Installation recorded' : 'Unused capacity released',
    );
  }
}
function appendEvent(event) {
  audit.unshift(event);
  recordedEvents.unshift(event);
  writeSession(storageKey, { sequence, eventSequence, reservations, events: recordedEvents });
}
const result = (status, data) => ({ status, data });
export async function mockRequest(path, method, body, signal) {
  await new Promise((resolve) => setTimeout(resolve, 180));
  signal?.throwIfAborted();
  const url = new URL(path, 'https://demo.invalid');
  expireReservations();
  const match = url.pathname.match(/^\/reservations\/([^/]+)\/actions$/);
  if (method === 'POST' && match) {
    const record = reservations.find((r) => r.id === match[1]);
    if (!record) return result(404, { message: 'Reservation not found.' });
    const change = processAction(
      record,
      body,
      reservations.flatMap((r) => r.visits || []),
      recordDecision,
    );
    if (change.status < 300) rebuildCapacity();
    return change;
  }
  if (method === 'GET' && url.pathname === '/health')
    return result(200, { service: 'Qatar DMS', status: 'Available', mode: 'Demo' });
  if (method === 'GET' && url.pathname === '/network') return result(200, structuredClone(network));
  if (method === 'GET' && url.pathname === '/audit') return result(200, structuredClone(audit));
  if (method === 'POST' && url.pathname === '/demo/audit-events') {
    const action = body?.action;
    if (!['Sign-in', 'Decision', 'Override'].includes(action))
      return result(400, { message: 'Choose a demo event type.' });
    const target = action === 'Sign-in' ? 'Portal access' : String(body.target ?? '').trim();
    if (!target) return result(400, { message: 'Enter the related request or asset identifier.' });
    const event = {
      id: 'EV-' + ++eventSequence,
      at: new Date().toISOString(),
      action,
      target,
      user:
        action === 'Sign-in'
          ? 'operator.demo'
          : action === 'Override'
            ? 'cra.supervisor'
            : 'cra.reviewer',
      status: action === 'Sign-in' && body.failed ? 'Failed' : 'Success',
      detail: String(body.detail ?? '').trim() || 'Simulated ' + action.toLowerCase(),
    };
    appendEvent(event);
    return result(201, structuredClone(event));
  }
  if (method === 'GET' && url.pathname === '/reservations')
    return result(200, structuredClone(reservations));
  if (method === 'POST' && ['/reservations/check', '/reservations'].includes(url.pathname)) {
    if (!body || !Array.isArray(body.spans) || !Array.isArray(body.manholes))
      return result(400, { message: 'Provide spans and manholes arrays.' });
    const maintenance = body.kind === 'Maintenance';
    const assessment = maintenance
      ? assessMaintenance(
          body,
          network,
          reservations.flatMap((r) => r.visits || []),
        )
      : assessReservation(body, network);
    if (url.pathname.endsWith('/check')) return result(200, assessment);
    if (!assessment.ok) return result(409, { message: assessment.errors.join(' ') });
    const record = {
      ...body,
      visits: [],
      expiresAt: null,
      reason: null,
      id: body.operator + (maintenance ? '-MA-' : '-') + ++sequence,
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      assessment,
    };
    for (const capacity of assessment.capacity)
      network.spans.find((s) => s.id === capacity.id).bores = capacity.projected;
    if (maintenance) initializeMaintenance(record);
    reservations.unshift(record);
    appendEvent({
      id: 'DEMO-' + sequence,
      at: record.createdAt,
      user: 'operator.demo',
      action: maintenance ? 'Maintenance access requested' : 'Reservation submitted',
      status: 'Success',
      target: record.id,
      detail: maintenance ? 'Maintenance booking' : 'Demo capacity held',
    });
    return result(201, record);
  }
  if (/^\/sandbox(?:\/[^/]+)?$/.test(url.pathname))
    return result(method === 'POST' ? 201 : 200, {
      method,
      path: url.pathname,
      body: body ?? null,
      mode: 'Demo',
    });
  return result(404, {
    message: 'Demo endpoint unavailable. Try /health, /network, /audit, /reservations or /sandbox.',
  });
}
