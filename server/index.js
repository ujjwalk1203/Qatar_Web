import http from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import sql from 'mssql';
import { serveApi, requireCondition } from './store.js';

function setting(name) {
  const value = process.env[name];
  if (!value) throw new Error('Missing server setting ' + name);
  return value;
}
const gatewaySecret = setting('DMS_GATEWAY_SECRET');
const publicOrigin = new URL(setting('DMS_PUBLIC_ORIGIN')).origin;
const digest = (value) => createHash('sha256').update(value).digest();
function identity(headers) {
  requireCondition(
    timingSafeEqual(digest(String(headers['x-dms-gateway'] || '')), digest(gatewaySecret)),
    401,
    'Sign in through the CRA gateway.',
  );
  const name = headers['x-dms-subject'],
    role = headers['x-dms-role'],
    operator = headers['x-dms-operator'];
  requireCondition(
    typeof name === 'string' &&
      name.length > 0 &&
      name.length <= 200 &&
      ['reviewer', 'operator'].includes(role),
    403,
    'A recognised DMS role is required.',
  );
  if (role === 'operator')
    requireCondition(['O', 'V', 'Q'].includes(operator), 403, 'Operator organisation is required.');
  return { name, role, operator };
}
async function jsonBody(req) {
  requireCondition(
    String(req.headers['content-type']).split(';')[0] === 'application/json',
    415,
    'Send a JSON request.',
  );
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    requireCondition(length <= 65536, 413, 'Request exceeds the size limit.');
    chunks.push(chunk);
  }
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    requireCondition(false, 400, 'Invalid JSON.');
  }
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    400,
    'Provide a JSON object.',
  );
  return value;
}
const pool = await new sql.ConnectionPool({
  server: setting('DMS_SQL_HOST'),
  database: setting('DMS_SQL_DATABASE'),
  user: setting('DMS_SQL_USER'),
  password: setting('DMS_SQL_PASSWORD'),
  options: { encrypt: true, trustServerCertificate: false },
  requestTimeout: 15000,
}).connect();
const server = http.createServer({ requestTimeout: 20000 }, async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    requireCondition(path.startsWith('/api/'), 404, 'Unknown endpoint.');
    const user = identity(req.headers);
    if (req.method !== 'GET')
      requireCondition(req.headers.origin === publicOrigin, 403, 'Invalid request origin.');
    const body = req.method === 'POST' ? await jsonBody(req) : {};
    const result = await serveApi(pool, user, path.slice(4), req.method, body);
    res.writeHead(result.status);
    res.end(JSON.stringify(result.data));
  } catch (error) {
    res.statusCode = error.status || 503;
    if (!error.status) console.error('DMS database operation failed', error.code || error.name);
    res.end(
      JSON.stringify({
        message: error.status ? error.message : 'The DMS service is temporarily unavailable.',
      }),
    );
  }
});
server.listen(Number(process.env.DMS_PORT || 4174), '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => pool.close()));
