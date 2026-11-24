import { expiresAfterSixMonths, validateVisit } from './access.js';
const result = (status, data) => ({ status, data });
export function processAction(record, body, bookings, recordDecision) {
  const action = body?.action;
  const reason = String(body?.reason || '').trim();
  const now = new Date();
  if (['approve', 'reject'].includes(action)) {
    if (record.status !== 'Submitted')
      return result(409, { message: 'This reservation has already been reviewed.' });
    if (action === 'reject' && !reason)
      return result(422, { message: 'Enter a rejection reason.' });
    record.status = action === 'approve' ? 'Reserved' : 'Rejected';
    record.reason = reason;
    if (action === 'approve') record.expiresAt = expiresAfterSixMonths(now);
  } else if (action === 'book') {
    if (record.status !== 'Reserved')
      return result(409, { message: 'Installation requires a current approved reservation.' });
    const today = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Qatar' });
    const message = validateVisit(body, bookings, record.manholes, today);
    if (message) return result(409, { message });
    if (
      body.to > new Date(record.expiresAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Qatar' })
    )
      return result(422, { message: 'Select dates within the reservation period.' });
    const visit = {
      id: record.id + '-MA-' + ((record.visits?.length || 0) + 1),
      status: 'Open',
      manhole: body.manhole,
      from: body.from,
      to: body.to,
    };
    (record.visits ??= []).push(visit);
    recordDecision(record, action, 'Installation access requested', visit.id);
    return result(201, structuredClone(record));
  } else {
    const v = record.visits?.find((item) => item.id === body?.visitId);
    const transitions = {
      permit: ['Open', 'Approved'],
      deny: ['Open', 'Rejected'],
      block: ['Approved', 'Blocked'],
      clear: ['Blocked', 'Approved'],
      complete: ['Approved', 'In service'],
      close: ['In service', 'Closed'],
    };
    const transition = Object.hasOwn(transitions, action) ? transitions[action] : null;
    if (!v || !transition || transition[0] !== v.status)
      return result(409, { message: 'The access request is no longer in the required state.' });
    if (action === 'deny' && !reason) return result(422, { message: 'Enter a rejection reason.' });
    if (action === 'complete' && !String(body.evidence || '').trim())
      return result(422, {
        message: 'Provide the as-built document reference before sending the notice.',
      });
    if (action === 'complete') v.evidence = String(body.evidence).trim();
    if (reason) v.reason = reason;
    v.status = transition[1];
    if (record.kind === 'Maintenance') record.status = v.status;
    recordDecision(record, action, v.status, v.id);
    return result(200, structuredClone(record));
  }
  recordDecision(record, action, record.status + (reason ? ' · ' + reason : ''));
  return result(200, structuredClone(record));
}
