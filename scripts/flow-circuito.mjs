// Prueba del CIRCUITO, sin navegador: simula lo que hace la extensión.
// Encola un trabajo, lo pide como si fuera el puente, lo devuelve resuelto, y
// confirma que la cola lo cerró. Si esto pasa, lo único sin probar queda del
// lado de Google. Temporal: se borra después.
import postgres from 'postgres';
import { createHash, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const WS = 3; // Cliente de Prueba
const BASE = process.argv[2] || 'http://localhost:3001';

const token = `flow_${randomBytes(24).toString('base64url')}`;
const hash = createHash('sha256').update(token).digest('hex');

try {
  await sql`delete from flow_trabajos where workspace_id = ${WS}`;
  await sql`insert into flow_puentes (workspace_id, token_hash, etiqueta, estado)
            values (${WS}, ${hash}, 'prueba', 'sin_conectar')
            on conflict (workspace_id) do update set token_hash = ${hash}, estado = 'sin_conectar'`;
  const [t] = await sql`insert into flow_trabajos (workspace_id, tipo, pedido)
                        values (${WS}, 'creditos', ${sql.json({ path: '/v1/credits', body: {} })})
                        returning id`;
  console.log('Trabajo encolado:', t.id);

  // ── Acto 1: el puente pide trabajo ──
  let r = await fetch(`${BASE}/api/flow/puente`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, projectId: 'proj-prueba', estado: 'listo', cuantos: 1 }),
  });
  let out = await r.json();
  console.log('Pide trabajo →', r.status, JSON.stringify(out).slice(0, 200));
  if (!out.trabajos?.length) throw new Error('la cola no entregó el trabajo');
  const trabajo = out.trabajos[0];

  // ── Acto 2: lo devuelve resuelto ──
  r = await fetch(`${BASE}/api/flow/puente`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token, projectId: 'proj-prueba', estado: 'listo',
      resultados: [{ id: trabajo.id, ok: true, data: { credits: 987, paygateTier: 'PAYGATE_TIER_TWO' } }],
    }),
  });
  console.log('Devuelve resultado →', r.status);

  const [fin] = await sql`select estado, resultado from flow_trabajos where id = ${trabajo.id}`;
  console.log('Estado final:', fin.estado, JSON.stringify(fin.resultado));

  // ── Acto 3: un token inventado NO puede leer nada ──
  r = await fetch(`${BASE}/api/flow/puente`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'flow_inventado', estado: 'listo', cuantos: 1 }),
  });
  console.log('Token falso →', r.status, r.status === 404 ? 'OK (404, no confirma nada)' : '⚠️ MAL');

  // ── Acto 4: sesión marcada = no se entrega trabajo ──
  await sql`update flow_puentes set estado = 'marcada' where workspace_id = ${WS}`;
  await sql`insert into flow_trabajos (workspace_id, tipo, pedido) values (${WS}, 'creditos', ${sql.json({ path: '/v1/credits', body: {} })})`;
  r = await fetch(`${BASE}/api/flow/puente`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, estado: 'marcada', cuantos: 1 }),
  });
  out = await r.json();
  console.log('Sesión marcada → trabajos entregados:', out.trabajos?.length ?? 0, out.pausado ? '(pausado OK)' : '⚠️ no pausó');

  await sql`delete from flow_trabajos where workspace_id = ${WS}`;
  await sql`delete from flow_puentes where workspace_id = ${WS}`;
  console.log('Limpio.');
} finally {
  await sql.end();
}
