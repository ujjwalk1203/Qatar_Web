import sql from 'mssql';
import { assessMaintenance, initializeMaintenance } from '../src/domain/access.js';
import { createHash } from 'node:crypto';
import { assessReservation } from '../src/domain/requests.js';
import { processAction } from '../src/domain/review.js';

export function requireCondition(condition, status, message) {
  if (!condition) throw Object.assign(new Error(message), { status });
}
const reviewerActions = new Set(['approve', 'reject', 'permit', 'deny', 'clear', 'close']);
const operatorActions = new Set(['book', 'block', 'complete']);
const canSee = (user, record) => user.role === 'reviewer' || user.operator === record.operator;
function visibleRecord(user, record) {
  return {
    ...record,
    allowedActions: [...(user.role === 'reviewer' ? reviewerActions : operatorActions)],
  };
}
async function appendAudit(tx, user, action, target, detail) {
  await tx
    .request()
    .input('actor', sql.NVarChar(200), user.name)
    .input('action', sql.NVarChar(80), action)
    .input('target', sql.NVarChar(100), target)
    .input('detail', sql.NVarChar(1000), detail)
    .query(
      'INSERT INTO dbo.DmsAudit (Actor,Action,Target,Detail) VALUES (@actor,@action,@target,@detail)',
    );
}
async function save(tx, record) {
  await tx
    .request()
    .input('id', sql.VarChar(64), record.id)
    .input('json', sql.NVarChar(sql.MAX), JSON.stringify(record))
    .query('UPDATE dbo.DmsReservation SET RecordJson=@json WHERE Id=@id');
}
async function snapshot(tx) {
  const response = await tx
    .request()
    .query(
      'SELECT NetworkJson FROM dbo.DmsInventory WHERE Id=1; SELECT RecordJson FROM dbo.DmsReservation;',
    );
  requireCondition(
    response.recordsets[0].length,
    503,
    'The approved network inventory has not been loaded.',
  );
  const network = JSON.parse(response.recordsets[0][0].NetworkJson);
  const records = response.recordsets[1]
    .map((row) => JSON.parse(row.RecordJson))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const byId = new Map(network.spans.map((span) => [span.id, span]));
  for (const record of records) {
    if (record.status === 'Reserved' && Date.parse(record.expiresAt) <= Date.now()) {
      const used = record.visits.some((v) => ['In service', 'Closed'].includes(v.status));
      record.status = used ? 'In service' : 'Expired';
      if (!used)
        for (const visit of record.visits)
          if (['Open', 'Approved', 'Blocked'].includes(visit.status)) visit.status = 'Cancelled';
      await save(tx, record);
      await appendAudit(
        tx,
        { name: 'DMS' },
        record.status,
        record.id,
        used ? 'Installation recorded' : 'Unused hold released',
      );
    }
    if (['Rejected', 'Expired'].includes(record.status)) continue;
    for (const line of record.assessment.capacity) {
      const span = byId.get(line.id);
      requireCondition(
        span && span.bores.length === line.projected.length,
        409,
        'Inventory has changed. Reconcile existing holds before accepting requests.',
      );
      span.bores = span.bores.map(
        (base, index) => base + line.projected[index] - line.existing[index],
      );
    }
  }
  return { network, records };
}
export async function serveApi(pool, user, path, method, body) {
  if (path === '/health' && method === 'GET') {
    await pool.request().query('SELECT 1');
    return { status: 200, data: { status: 'Available' } };
  }
  if (path === '/audit' && method === 'GET') {
    requireCondition(user.role === 'reviewer', 403, 'CRA reviewer access is required.');
    const rows = await pool
      .request()
      .query(
        "SELECT Id AS id,AtUtc AS at,Actor AS [user],Action AS action,'Success' AS status,Target AS target,Detail AS detail FROM dbo.DmsAudit ORDER BY Id DESC",
      );
    return { status: 200, data: rows.recordset };
  }
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  try {
    // Serialize inventory snapshots and workflow writes, including expiry and capacity release.
    await tx
      .request()
      .query(
        "DECLARE @rc int; EXEC @rc=sp_getapplock @Resource='CRA.DMS.Capacity',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=8000; IF @rc<0 THROW 51002,'Workflow busy',1;",
      );
    const { network, records } = await snapshot(tx);
    network.actor = { role: user.role, operator: user.operator };
    let data,
      status = 200;
    if (path === '/network' && method === 'GET') data = network;
    else if (path === '/reservations' && method === 'GET')
      data = records.filter((record) => canSee(user, record)).map((r) => visibleRecord(user, r));
    else if (method === 'POST' && ['/reservations', '/reservations/check'].includes(path)) {
      requireCondition(
        user.role === 'operator' && user.operator === body.operator,
        403,
        'The operator must match the signed-in account.',
      );
      requireCondition(
        Array.isArray(body.spans) && Array.isArray(body.manholes),
        422,
        'Select spans and manholes.',
      );
      const {
        operator,
        spans,
        manholes,
        cable,
        count,
        spliceCount,
        spliceType,
        spliceAt,
        splicePlans,
        boreChoices,
        comments,
      } = body;
      const maintenance = body.kind === 'Maintenance';
      const form = {
        ...(maintenance ? { kind: body.kind, from: body.from, to: body.to } : {}),
        operator,
        spans,
        manholes,
        cable,
        count,
        spliceCount,
        spliceType,
        spliceAt,
        splicePlans,
        boreChoices,
        comments,
      };
      const assessment = maintenance
        ? assessMaintenance(
            form,
            network,
            records.flatMap((r) => r.visits),
          )
        : assessReservation(form, network);
      if (path.endsWith('/check')) data = assessment;
      else {
        requireCondition(
          typeof body.requestKey === 'string' &&
            /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(body.requestKey),
          422,
          'A request key is required.',
        );
        const hash = createHash('sha256').update(JSON.stringify(form)).digest('hex');
        const previous = await tx
          .request()
          .input('key', sql.UniqueIdentifier, body.requestKey)
          .input('op', sql.Char(1), operator)
          .query(
            'SELECT PayloadHash,RecordJson FROM dbo.DmsReservation WHERE RequestKey=@key AND Operator=@op',
          );
        if (previous.recordset.length) {
          requireCondition(
            previous.recordset[0].PayloadHash === hash,
            409,
            'This key belongs to a different request.',
          );
          data = visibleRecord(user, JSON.parse(previous.recordset[0].RecordJson));
        } else {
          requireCondition(assessment.ok, 409, assessment.errors.join(' '));
          const number = await tx
            .request()
            .query('SELECT NEXT VALUE FOR dbo.DmsRequestNumber AS n');
          const id = operator + (maintenance ? '-MA-' : '-') + number.recordset[0].n;
          const record = {
            ...form,
            id,
            status: 'Submitted',
            createdAt: new Date().toISOString(),
            assessment,
            visits: [],
          };
          if (maintenance) initializeMaintenance(record);
          await tx
            .request()
            .input('id', sql.VarChar(64), id)
            .input('op', sql.Char(1), operator)
            .input('key', sql.UniqueIdentifier, body.requestKey)
            .input('hash', sql.Char(64), hash)
            .input('json', sql.NVarChar(sql.MAX), JSON.stringify(record))
            .query(
              'INSERT INTO dbo.DmsReservation (Id,Operator,RequestKey,PayloadHash,RecordJson) VALUES (@id,@op,@key,@hash,@json)',
            );
          await appendAudit(
            tx,
            user,
            maintenance ? 'Maintenance access requested' : 'Reservation submitted',
            id,
            maintenance ? 'Maintenance booking' : 'Capacity held',
          );
          data = visibleRecord(user, record);
          status = 201;
        }
      }
    } else {
      const match = path.match(/^\/reservations\/([OVQ]-(?:MA-)?\d+)\/actions$/);
      requireCondition(match && method === 'POST', 404, 'Endpoint unavailable.');
      const record = records.find((r) => r.id === match[1] && canSee(user, r));
      requireCondition(record, 404, 'Request unavailable.');
      requireCondition(
        (user.role === 'reviewer' ? reviewerActions : operatorActions).has(body.action),
        403,
        'This action is unavailable for the signed-in role.',
      );
      let event;
      const result = processAction(
        record,
        body,
        records.flatMap((r) => r.visits || []),
        (_r, action, detail, target = record.id) => {
          event = { action, detail, target };
        },
      );
      requireCondition(result.status < 300, result.status, result.data.message);
      await save(tx, record);
      await appendAudit(tx, user, event.action, event.target, event.detail);
      data = visibleRecord(user, record);
      status = result.status;
    }
    await tx.commit();
    return { status, data };
  } catch (error) {
    try {
      await tx.rollback();
    } catch {}
    throw error;
  }
}
