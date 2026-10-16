// =============================================================================
// ws-prueba-foto — una FOTO de un workspace de prueba antes de recorrerlo, y volverlo exacto a ella
// =============================================================================
// Recorrer una pantalla en local ESCRIBE EN PRODUCCIÓN (el .env.local apunta a la base real). Para el
// Cliente de Prueba (ws 3) eso está bien, pero lo usan otros chats para SUS pruebas: el recorrido no
// puede dejarlo distinto. Y la copia de seguridad no se hace por la clave que uno está mirando sino por
// TODO lo que el recorrido puede tocar (scripts/onboarding-vg-respaldo.mts lo aprendió a la mala: un
// paso guardó el acento ARGENTINO de mi máquina en el workspace de un cliente).
//
// Por eso esto no lista claves: saca TODAS las filas del workspace en TODA tabla con `workspace_id`
// (medido en vivo contra information_schema, como lib/tablas-de-inquilino.ts), más su fila de
// `workspaces`. Después compara y devuelve exacto: borra lo que nació, repone lo que cambió o se borró.
//
// Uso (desde la raíz, con .env.local):
//   node scripts/ws-prueba-foto.mjs guardar   --ws=3 --archivo=<ruta.json>   ← la foto (FUERA del repo: son datos)
//   node scripts/ws-prueba-foto.mjs comparar  --ws=3 --archivo=<ruta.json>   ← qué cambió, por tabla
//   node scripts/ws-prueba-foto.mjs restaurar --ws=3 --archivo=<ruta.json> [--excluir=t1,t2] [--conservar=clave1,clave2] [--apply]
//      --excluir: tablas que no se tocan (p. ej. anthropic_usage: el gasto de IA del recorrido es gasto real).
//      --conservar: claves de app_settings que se dejan como están (las movió otro proceso, p. ej. un cron).
//      sin --apply sólo muestra lo que haría. Todo en UNA transacción: si algo falla, no queda a medias.
//
// ⚠️ Nunca el ws 1 (Mauricio, cliente real): el script se niega.
// =============================================================================

import postgres from 'postgres';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const accion = process.argv[2];
const ws = Number(arg('ws'));
const archivo = arg('archivo');
const aplicar = process.argv.includes('--apply');
const excluir = new Set((arg('excluir') ?? '').split(',').map((s) => s.trim()).filter(Boolean));
// Claves de app_settings que se dejan como están (las movió otro proceso durante el recorrido, p. ej. la marca
// de un cron: volverla atrás lo haría correr de nuevo).
const conservar = new Set((arg('conservar') ?? '').split(',').map((s) => s.trim()).filter(Boolean));

if (!['guardar', 'comparar', 'restaurar'].includes(accion) || !Number.isInteger(ws) || ws <= 0 || !archivo) {
  console.error('uso: node scripts/ws-prueba-foto.mjs guardar|comparar|restaurar --ws=N --archivo=<ruta.json> [--excluir=a,b] [--apply]');
  process.exit(2);
}
if (ws === 1) { console.error('El ws 1 es Mauricio, un cliente real: no se recorre ni se restaura.'); process.exit(2); }
if (!process.env.DATABASE_URL) { console.error('falta DATABASE_URL en .env.local'); process.exit(2); }

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
const q = (id) => `"${String(id).replace(/"/g, '""')}"`;

/** Las tablas del inquilino, medidas AHORA (una tabla nueva entra sola). `workspaces` va aparte. */
async function tablas() {
  const r = await sql`
    select c.table_name as t from information_schema.columns c
    join information_schema.tables t on t.table_name = c.table_name and t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'workspace_id' order by 1`;
  return r.map((x) => x.t);
}

/** Las filas tal como las serializa Postgres (to_jsonb): vuelven idénticas con jsonb_populate_recordset. */
async function filas(t) {
  if (t === 'workspaces') return (await sql.unsafe(`select to_jsonb(x) as r from public.workspaces x where id = $1`, [ws])).map((x) => x.r);
  return (await sql.unsafe(`select to_jsonb(x) as r from public.${q(t)} x where workspace_id = $1`, [ws])).map((x) => x.r);
}

async function clavePrimaria(t) {
  const r = await sql.unsafe(`
    select a.attname as c from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = ('public.' || $1)::regclass and i.indisprimary order by a.attnum`, [q(t)]);
  return r.map((x) => x.c);
}

/** Las columnas que se pueden escribir (las generadas no). */
async function columnas(t) {
  const r = await sql.unsafe(`
    select attname as c from pg_attribute
    where attrelid = ('public.' || $1)::regclass and attnum > 0 and not attisdropped and attgenerated = '' order by attnum`, [q(t)]);
  return r.map((x) => x.c);
}

const claveDe = (fila, pk) => JSON.stringify(pk.map((c) => fila[c]));
// `updated_at` no cuenta como cambio: lo reescriben los triggers al reponer, y un guardado del mismo valor
// no cambió nada. Sin esto, todo lo restaurado volvía a salir «distinto».
const contenido = (f) => JSON.stringify({ ...f, updated_at: undefined });

function diferencias(antes, ahora, pk) {
  const A = new Map(antes.map((f) => [claveDe(f, pk), f]));
  const B = new Map(ahora.map((f) => [claveDe(f, pk), f]));
  const nacieron = [...B.keys()].filter((k) => !A.has(k)).map((k) => B.get(k));
  const borradas = [...A.keys()].filter((k) => !B.has(k)).map((k) => A.get(k));
  const cambiadas = [...A.keys()].filter((k) => B.has(k) && contenido(A.get(k)) !== contenido(B.get(k))).map((k) => A.get(k));
  return { nacieron, borradas, cambiadas };
}

try {
  if (accion === 'guardar') {
    const foto = { ws, tomada: new Date().toISOString(), tablas: {} };
    for (const t of [...(await tablas()), 'workspaces']) foto.tablas[t] = await filas(t);
    writeFileSync(archivo, JSON.stringify(foto), 'utf8');
    const conFilas = Object.entries(foto.tablas).filter(([, v]) => v.length);
    console.log(`foto del ws ${ws}: ${Object.keys(foto.tablas).length} tablas, ${conFilas.reduce((s, [, v]) => s + v.length, 0)} filas en ${conFilas.length} → ${archivo}`);
  } else {
    const foto = JSON.parse(readFileSync(archivo, 'utf8'));
    if (foto.ws !== ws) throw new Error(`la foto es del ws ${foto.ws}, no del ${ws}`);
    const cambios = [];
    for (const t of [...(await tablas()), 'workspaces']) {
      const pk = await clavePrimaria(t);
      const antes = foto.tablas[t] ?? [];
      const ahora = await filas(t);
      if (!pk.length) {
        if (JSON.stringify(antes) !== JSON.stringify(ahora)) console.log(`  ⚠️ ${t}: cambió y no tiene clave primaria (${antes.length} → ${ahora.length}); no se restaura sola`);
        continue;
      }
      const d = diferencias(antes, ahora, pk);
      if (t === 'app_settings' && conservar.size) {
        for (const k of ['nacieron', 'borradas', 'cambiadas']) d[k] = d[k].filter((f) => !conservar.has(f.key));
      }
      if (d.nacieron.length || d.borradas.length || d.cambiadas.length) cambios.push({ t, pk, ...d });
    }
    for (const c of cambios) {
      const ej = c.t === 'app_settings' ? `  [${[...c.nacieron, ...c.cambiadas, ...c.borradas].map((f) => f.key).join(', ')}]` : '';
      console.log(`  ${excluir.has(c.t) ? '(excluida) ' : ''}${c.t}: ${c.nacieron.length} nacieron, ${c.cambiadas.length} cambiaron, ${c.borradas.length} se borraron${ej}`);
    }
    if (!cambios.length) console.log(`el ws ${ws} está igual que en la foto (${foto.tomada})`);

    if (accion === 'restaurar' && cambios.length) {
      if (!aplicar) { console.log('\n(sin --apply no se escribe nada)'); }
      else {
        const pendientes = cambios.filter((c) => !excluir.has(c.t));
        // Las columnas se leen ANTES de abrir la transacción: con una sola conexión (`max: 1`), leerlas adentro
        // con `sql` espera una conexión que la transacción no suelta, y se cuelga para siempre (medido el 16/10).
        const colsDe = new Map();
        for (const c of pendientes) colsDe.set(c.t, await columnas(c.t));
        await sql.begin(async (tx) => {
          // Por las FK, el orden importa y no se conoce: se reintenta por pasadas con un savepoint por paso,
          // hasta que no quede nada o una pasada entera no avance (eso tira y la transacción se deshace).
          let pasos = [];
          for (const c of pendientes) {
            if (c.nacieron.length) pasos.push({ tipo: 'borrar', c });
            if (c.cambiadas.length || c.borradas.length) pasos.push({ tipo: 'reponer', c });
          }
          while (pasos.length) {
            const fallaron = [];
            let ultimo = null;
            for (const p of pasos) {
              try {
                await tx.savepoint(async (sp) => {
                  const { t, pk } = p.c;
                  if (p.tipo === 'borrar') {
                    const expr = `jsonb_build_object(${pk.map((k) => `'${k}', x.${q(k)}`).join(', ')})`;
                    const claves = p.c.nacieron.map((f) => Object.fromEntries(pk.map((k) => [k, f[k]])));
                    await sp.unsafe(`delete from public.${q(t)} x where ${expr} in (select value from jsonb_array_elements($1::text::jsonb))`, [JSON.stringify(claves)]);
                  } else {
                    const cols = colsDe.get(t);
                    const lista = cols.map(q).join(', ');
                    const set = cols.filter((k) => !pk.includes(k)).map((k) => `${q(k)} = excluded.${q(k)}`).join(', ');
                    await sp.unsafe(
                      `insert into public.${q(t)} (${lista}) overriding system value
                       select ${lista} from jsonb_populate_recordset(null::public.${q(t)}, $1::text::jsonb)
                       on conflict (${pk.map(q).join(', ')}) do ${set ? `update set ${set}` : 'nothing'}`,
                      [JSON.stringify([...p.c.cambiadas, ...p.c.borradas])],
                    );
                  }
                });
              } catch (e) { fallaron.push(p); ultimo = e; }
            }
            if (fallaron.length === pasos.length) throw new Error(`no avanzo: ${fallaron.map((p) => `${p.tipo} ${p.c.t}`).join(', ')} — ${ultimo?.message}`);
            pasos = fallaron;
          }
        });
        console.log(`\nrestaurado. Comparo de nuevo:`);
        for (const t of pendientes.map((c) => c.t)) {
          const pk = await clavePrimaria(t);
          const d = diferencias(foto.tablas[t] ?? [], await filas(t), pk);
          console.log(`  ${t}: ${d.nacieron.length + d.cambiadas.length + d.borradas.length ? `⚠️ todavía distinta (${d.nacieron.length}/${d.cambiadas.length}/${d.borradas.length})` : 'igual'}`);
        }
      }
    }
  }
} finally {
  await sql.end();
}
