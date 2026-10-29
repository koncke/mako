// =============================================================================
// probar-0340-pglite — la papelera de leads (mig 0340) contra un Postgres DE VERDAD, sin tocar la base de nadie
// =============================================================================
// Las funciones de la 0340 son SQL dinámico (recorren `pg_constraint`): un test que lee el .sql con regex no prueba que
// anden. Esto levanta un Postgres en memoria (PGlite), le pone un esquema chico con las formas del real (cascadas de uno y
// dos niveles, autorreferencia, SET NULL, sin FK, identity ALWAYS, columna generada, RESTRICT, unique) y le aplica la 0340.
//
// PGlite NO es dependencia del repo (no se instala en el node_modules compartido). Una vez, en una carpeta vacía:
//   npm i @electric-sql/pglite@0.2.17
// y después, desde la raíz del repo:
//   PGLITE=<esa carpeta> node scripts/probar-0340-pglite.mjs supabase/migrations/0340_leads_papelera.sql
// Sale con 1 si algún caso falla. Medido el 28/10/2026: 9 casos en verde, y 11 roturas de la 0340 (sin punto fijo, sin
// volver a apuntar, sin orden padres-hijos, sin punto de guardado por lead, sin el chequeo de FK multi, sin el negocio,
// con las columnas generadas, con todas las columnas, purga sin fecha, recuperar sin sacar de la papelera, repuntar que
// pisa) dan rojo, cada una. docs/hallazgos-crm.md → «La papelera de leads».
// =============================================================================

import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.env.PGLITE) { console.error('Falta PGLITE=<carpeta donde instalaste @electric-sql/pglite> (ver la cabecera).'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(createRequire(join(process.env.PGLITE, 'x.js')).resolve('@electric-sql/pglite')).href);

const sql = fs.readFileSync(process.argv[2], 'utf8');

const ESQUEMA = `
create role anon; create role authenticated; create role service_role;
create table workspaces (id bigserial primary key, nombre text);
create table funnels (id bigserial primary key, workspace_id bigint references workspaces(id), nombre text);
create table leads (
  id bigserial primary key, workspace_id bigint not null references workspaces(id) on delete cascade,
  nombre text, telefono text, email text, funnel_id bigint references funnels(id) on delete set null,
  pipeline_stage text, meta_lead_id text, nombre_bajo text generated always as (lower(nombre)) stored,
  created_at timestamptz default now()
);
create unique index leads_meta_uidx on leads (meta_lead_id);
create table pagos (id bigserial primary key, workspace_id bigint not null, lead_id bigint not null references leads(id) on delete cascade,
  funnel_id bigint references funnels(id), monto numeric, numero int);
create table pago_cuotas (id bigint generated always as identity primary key, pago_id bigint not null references pagos(id) on delete cascade, vence date);
create table lead_funnel (id bigserial primary key, workspace_id bigint not null, lead_id bigint not null references leads(id) on delete cascade,
  funnel_id bigint not null references funnels(id), etapa text, unique (workspace_id, lead_id, funnel_id));
create table comunidad_posts (id bigserial primary key, workspace_id bigint, lead_id bigint not null references leads(id) on delete cascade, texto text);
create table comunidad_comentarios (id bigserial primary key, post_id bigint not null references comunidad_posts(id) on delete cascade,
  autor_lead_id bigint not null references leads(id) on delete cascade, padre_id bigint references comunidad_comentarios(id) on delete cascade, texto text);
create table comunidad_likes (id bigserial primary key, lead_id bigint not null references leads(id) on delete cascade,
  comentario_id bigint references comunidad_comentarios(id) on delete cascade);
create table wa_mensajes (id bigserial primary key, workspace_id bigint, lead_id bigint references leads(id) on delete set null, texto text);
create table lead_audit (id bigserial primary key, workspace_id bigint, lead_id bigint, campo text);
`;

async function nueva() {
  const db = new PGlite();
  await db.exec(ESQUEMA);
  await db.exec(sql);
  await db.exec(`
    insert into workspaces (id, nombre) values (1, 'uno'), (2, 'dos');
    insert into funnels (id, workspace_id, nombre) values (10, 1, 'LiderMente'), (11, 1, 'General'), (20, 2, 'Otro');
    insert into leads (id, workspace_id, nombre, telefono, email, funnel_id, pipeline_stage, meta_lead_id) values
      (100, 1, 'Ana', '549111', 'ana@x', 10, 'contacto_nuevo', 'm-100'),
      (101, 1, 'Beto', '549222', null, 10, 'contacto_nuevo', 'm-101'),
      (102, 1, 'Caro', null, null, null, 'r1', null),
      (200, 2, 'De otro', null, null, 20, 'x', null);
    insert into pagos (id, workspace_id, lead_id, funnel_id, monto, numero) values (500, 1, 100, 10, 97, 1), (501, 1, 100, 10, 97, 2);
    insert into pago_cuotas (pago_id, vence) values (500, '2026-11-01'), (501, '2026-12-01');
    insert into lead_funnel (workspace_id, lead_id, funnel_id, etapa) values (1, 100, 11, 'entrada'), (1, 101, 11, 'entrada');
    insert into comunidad_posts (id, workspace_id, lead_id, texto) values (700, 1, 100, 'post de Ana'), (710, 1, 102, 'post de Caro');
    insert into comunidad_comentarios (id, post_id, autor_lead_id, padre_id, texto) values
      (800, 700, 102, null, 'Caro comenta a Ana'), (801, 700, 100, 800, 'Ana responde'), (802, 700, 102, 801, 'Caro re-responde'),
      (810, 710, 100, null, 'Ana comenta a Caro'), (811, 710, 102, 810, 'Caro le responde'), (812, 710, 102, 811, 'Caro sigue');
    insert into comunidad_likes (id, lead_id, comentario_id) values (900, 102, 801), (901, 100, null);
    insert into wa_mensajes (id, workspace_id, lead_id, texto) values (1000, 1, 100, 'hola'), (1001, 1, 100, 'chau'), (1002, 1, 101, 'beto');
    insert into lead_audit (workspace_id, lead_id, campo) values (1, 100, 'Etapa');
  `);
  return db;
}

const TABLAS = ['leads', 'pagos', 'pago_cuotas', 'lead_funnel', 'comunidad_posts', 'comunidad_comentarios', 'comunidad_likes', 'wa_mensajes', 'lead_audit'];
async function foto(db) {
  const out = {};
  for (const t of TABLAS) out[t] = (await db.query(`select * from ${t} order by id`)).rows;
  return JSON.stringify(out);
}
const json = async (db, q, p) => (await db.query(q, p)).rows[0];

let fallas = 0;
async function caso(nombre, f) {
  try { await f(); console.log('ok  ', nombre); }
  catch (e) { fallas += 1; console.log('MAL ', nombre, '\n     ', e.message.split('\n')[0]); }
}

await caso('mandar y recuperar deja TODO igual (mismos ids, cascadas de dos niveles, autorreferencia, SET NULL)', async () => {
  const db = await nueva();
  const antes = await foto(db);
  const r = (await json(db, `select mandar_leads_a_papelera(1, array[100]::bigint[], 'Leila') as r`)).r;
  assert.equal(r[0].ok, true, JSON.stringify(r));
  assert.equal((await json(db, 'select count(*)::int n from leads where id = 100')).n, 0, 'el lead sigue');
  assert.equal((await json(db, 'select count(*)::int n from pago_cuotas')).n, 0, 'las cuotas siguen');
  assert.equal((await json(db, 'select count(*)::int n from comunidad_comentarios')).n, 0, 'los comentarios de otros en su post siguen');
  assert.equal((await json(db, 'select count(*)::int n from wa_mensajes where lead_id is null')).n, 2, 'los mensajes no quedaron en null');
  const pap = await json(db, `select nombre, telefono, funnel_id, etapa, por, purgar_at > now() + interval '29 days' as dias from leads_papelera where lead_id = 100`);
  assert.deepEqual(pap, { nombre: 'Ana', telefono: '549111', funnel_id: 10, etapa: 'contacto_nuevo', por: 'Leila', dias: true });
  const v = (await json(db, `select recuperar_leads_de_papelera(1, array[100]::bigint[]) as r`)).r;
  assert.equal(v[0].ok, true, JSON.stringify(v));
  assert.equal(await foto(db), antes, 'lo recuperado no es igual a lo de antes');
  assert.equal((await json(db, 'select count(*)::int n from leads_papelera')).n, 0, 'quedó en la papelera');
});

await caso('el lead de OTRO negocio no se toca', async () => {
  const db = await nueva();
  const r = (await json(db, `select mandar_leads_a_papelera(1, array[200]::bigint[], 'x') as r`)).r;
  assert.equal(r[0].ok, false);
  assert.equal((await json(db, 'select count(*)::int n from leads where id = 200')).n, 1);
});

await caso('uno que no se puede borrar (RESTRICT) no frena a los otros y queda entero', async () => {
  const db = await nueva();
  await db.exec(`create table contratos (id bigserial primary key, lead_id bigint references leads(id) on delete restrict);
                 insert into contratos (lead_id) values (101);`);
  const r = (await json(db, `select mandar_leads_a_papelera(1, array[101, 102]::bigint[], 'x') as r`)).r;
  assert.equal(r.find((x) => x.lead_id === 101).ok, false, 'el de RESTRICT se borró');
  assert.equal(r.find((x) => x.lead_id === 102).ok, true);
  assert.equal((await json(db, 'select count(*)::int n from leads where id = 101')).n, 1);
  assert.equal((await json(db, 'select count(*)::int n from lead_funnel where lead_id = 101')).n, 1, 'se llevó sus filas');
  assert.equal((await json(db, 'select count(*)::int n from leads_papelera where lead_id = 101')).n, 0, 'quedó una foto sin borrar');
});

await caso('si al recuperar choca (llegó otro con su id de Meta), queda en la papelera con el motivo y los otros vuelven', async () => {
  const db = await nueva();
  await json(db, `select mandar_leads_a_papelera(1, array[100, 101]::bigint[], 'x') as r`);
  await db.exec(`insert into leads (id, workspace_id, nombre, meta_lead_id) values (150, 1, 'Ana de nuevo', 'm-100')`);
  const v = (await json(db, `select recuperar_leads_de_papelera(1, array[100, 101]::bigint[]) as r`)).r;
  assert.equal(v.find((x) => x.lead_id === 100).ok, false);
  assert.equal(v.find((x) => x.lead_id === 101).ok, true);
  assert.equal((await json(db, 'select count(*)::int n from leads_papelera where lead_id = 100')).n, 1);
  assert.equal((await json(db, 'select count(*)::int n from pagos')).n, 0, 'volvieron pagos de un lead que no volvió');
  assert.equal((await json(db, 'select lead_id from wa_mensajes where id = 1002')).lead_id, 101, 'el mensaje de Beto no se volvió a apuntar');
});

await caso('una cascada de varias columnas: no se borra NADA', async () => {
  const db = await nueva();
  await db.exec(`alter table leads add constraint leads_ws_id_uq unique (workspace_id, id);
                 create table raro (id bigserial primary key, ws bigint, lid bigint, foreign key (ws, lid) references leads(workspace_id, id) on delete cascade);`);
  await assert.rejects(db.query(`select mandar_leads_a_papelera(1, array[100]::bigint[], 'x')`));
  assert.equal((await json(db, 'select count(*)::int n from leads where id = 100')).n, 1);
});

await caso('al recuperar, un mensaje que en el medio se apuntó a OTRO lead queda con ese', async () => {
  const db = await nueva();
  await json(db, `select mandar_leads_a_papelera(1, array[100]::bigint[], 'x') as r`);
  await db.exec(`insert into leads (id, workspace_id, nombre) values (150, 1, 'Ana nueva'); update wa_mensajes set lead_id = 150 where id = 1001`);
  const v = (await json(db, `select recuperar_leads_de_papelera(1, array[100]::bigint[]) as r`)).r;
  assert.equal(v[0].ok, true, JSON.stringify(v));
  assert.equal((await json(db, 'select lead_id from wa_mensajes where id = 1001')).lead_id, 150, 'le pisó el lead nuevo');
  assert.equal((await json(db, 'select lead_id from wa_mensajes where id = 1000')).lead_id, 100);
});

await caso('la purga borra sólo lo vencido', async () => {
  const db = await nueva();
  await json(db, `select mandar_leads_a_papelera(1, array[100, 101]::bigint[], 'x') as r`);
  await db.exec(`update leads_papelera set purgar_at = now() - interval '1 day' where lead_id = 100`);
  assert.equal((await json(db, 'select purgar_papelera_leads(1) as n')).n, 1);
  assert.equal((await json(db, 'select count(*)::int n from leads_papelera')).n, 1);
  assert.equal((await json(db, 'select purgar_papelera_leads(2) as n')).n, 0);
});

await caso('mandar dos veces el mismo, o uno que no existe: no rompe', async () => {
  const db = await nueva();
  const r = (await json(db, `select mandar_leads_a_papelera(1, array[102, 102, 999]::bigint[], 'x') as r`)).r;
  assert.deepEqual(r.map((x) => x.ok), [true, false, false]);
  const v = (await json(db, `select recuperar_leads_de_papelera(1, array[102, 102]::bigint[]) as r`)).r;
  assert.deepEqual(v.map((x) => x.ok), [true, false]);
  assert.equal((await json(db, 'select count(*)::int n from leads where id = 102')).n, 1);
});

await caso('un lead con una columna NUEVA (con default) después de mandarlo: vuelve con el default', async () => {
  const db = await nueva();
  await json(db, `select mandar_leads_a_papelera(1, array[101]::bigint[], 'x') as r`);
  await db.exec(`alter table leads add column prioridad int not null default 3`);
  const v = (await json(db, `select recuperar_leads_de_papelera(1, array[101]::bigint[]) as r`)).r;
  assert.equal(v[0].ok, true, JSON.stringify(v));
  assert.equal((await json(db, 'select prioridad from leads where id = 101')).prioridad, 3);
});

console.log(fallas ? `\n${fallas} MAL` : '\nTODO OK');
process.exit(fallas ? 1 : 0);
