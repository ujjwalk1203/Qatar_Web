export function expiresAfterSixMonths(approvedAt) {
  const date = new Date(approvedAt);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString();
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateVisit(visit, bookings, allowedManholes, today) {
  if (!allowedManholes.includes(visit.manhole)) return 'Select a manhole covered by this request.';
  if (!validDate(visit.from) || !validDate(visit.to) || visit.from < today || visit.to < visit.from)
    return 'Choose a valid date range starting today or later.';
  if (
    bookings.some(
      (other) =>
        other.manhole === visit.manhole &&
        !['Rejected', 'Closed', 'Cancelled'].includes(other.status) &&
        other.from <= visit.to &&
        visit.from <= other.to,
    )
  )
    return 'This manhole is already booked during those dates. Choose another interval.';
  return '';
}

export function assessMaintenance(form, network, bookings) {
  const allowed = network.manholes.filter((m) => m.status === 'In-Place').map((m) => m.id);
  const only = form.manholes.length === 1 && ['O', 'V', 'Q'].includes(form.operator);
  const message = only
    ? validateVisit(
        { ...form, manhole: form.manholes[0] },
        bookings,
        allowed,
        new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Qatar' }),
      )
    : 'Select one maintenance manhole and an operator.';
  return { ok: !message, errors: message ? [message] : [], capacity: [] };
}
export function initializeMaintenance(record) {
  record.status = 'Open';
  record.visits = [
    {
      id: record.id,
      manhole: record.manholes[0],
      from: record.from,
      to: record.to,
      status: 'Open',
    },
  ];
}
