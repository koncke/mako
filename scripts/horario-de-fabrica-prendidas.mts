// =============================================================================
// horario-de-fabrica-prendidas — el 9 a 21 de fábrica para las automatizaciones que ya estaban prendidas (EN SECO)
// =============================================================================
// Black November de Leila (5/11/2026). Las nuevas nacen con el horario de fábrica al prenderlas; las de antes del 31/10/2026 no
// tienen ninguno y le escriben a los leads a cualquier hora. Qué hace con cada una lo decide `planDeHorarioDeFabrica`
// (lib/horario-de-fabrica.ts, puro y con test: tests/horario-de-fabrica.test.ts); acá sólo se lee, se imprime y, con
// --aplicar, se escribe.
//
//   npx tsx scripts/horario-de-fabrica-prendidas.mts                         → EN SECO: lee e imprime, no escribe nada
//   npx tsx scripts/horario-de-fabrica-prendidas.mts --aplicar               → escribe lo que imprimió
//   opciones: --env=<ruta del .env.local> (default ./.env.local) · --ws=<id> (un solo negocio) · --pausadas (también las apagadas)
//             --horario-del-negocio=10-20 (con --ws: el horario del NEGOCIO, todos los días; Leila lo pidió así)
//             --respaldo=<ruta> (default ./respaldo-horario-de-fabrica-<fecha>.json, sólo con --aplicar)
//
// ⚠️ LO CORRE EL CEREBRO DESDE LA PC (escribe en producción). Sin --aplicar, todo pasa adentro de una transacción `read only`:
// la base rechaza cualquier escritura que alguien le agregue.
// ⚠️ ESCRIBE CON COMPARE-AND-SET sobre el valor leído: si una automatización cambió su configuración mientras corría, no se pisa
// (se dice). Y deja un respaldo con el antes de cada clave que toca.
// ⚠️ DE NOCHE NO PONE NADA en ese negocio (`esperar`): puesto fuera de 9 a 21, lo que vence ahora se quedaba quieto hasta las 9.
// Se vuelve a correr de día; lo que ya quedó puesto no se repite (`ya tiene el de fábrica`).
// =============================================================================

import { config } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { urlDeLaBase } from './url-de-la-base.mjs';
import postgres from 'postgres';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const APLICAR = process.argv.includes('--aplicar');
const PAUSADAS = process.argv.includes('--pausadas');
const SOLO_WS = arg('ws') != null ? Number(arg('ws')) : null;
const HORARIO_NEGOCIO = arg('horario-del-negocio');
if (HORARIO_NEGOCIO && SOLO_WS == null) {
  console.error('--horario-del-negocio va con --ws=<id>: es el horario de UN negocio.');
  process.exit(1);
}
config({ path: arg('env') ?? '.env.local' });

const { planDeHorarioDeFabrica, cambioDelPaso } = await import('../lib/horario-de-fabrica');
const { configParaGuardar, sanearConfigAutomatizacion, claveConfigAutomatizacion, CLAVE_PREFIJO, secuenciaDeClave } = await import('../lib/config-automatizacion');
const { KEY_HORARIO_ENVIO, horarioVigente, horarioParaGuardar } = await import('../lib/horario-envio');
const { CLAVE_ZONA, zonaDeLoGuardado } = await import('../lib/zona-negocio-reglas');
const { disparadoresDe } = await import('../lib/disparadores');

const DB = urlDeLaBase() ?? '';
if (!DB) throw new Error('falta DATABASE_URL (pasa --env=<ruta del .env.local>)');
const sql = postgres(DB, { max: 1, prepare: false });

type Fila = Record<string, unknown>;
const respaldo: Array<{ ws: number; key: string; antes: string | null; despues: string }> = [];
const AHORA = Date.now();

/** El horario del negocio pedido («10-20»), o el motivo por el que no se entiende. */
function horarioPedido(texto: string): string {
  const m = /^(\d{1,2}(?:[.,]5)?)-(\d{1,2}(?:[.,]5)?)$/.exec(texto.trim());
  if (!m) throw new Error('--horario-del-negocio: va como «10-20» (de 10 a 20, todos los días).');
  const r = horarioParaGuardar({ activo: true, desde: Number(m[1].replace(',', '.')), hasta: Number(m[2].replace(',', '.')), dias: [0, 1, 2, 3, 4, 5, 6] });
  if (!r.ok) throw new Error(`--horario-del-negocio: ${r.error}`);
  return r.valor;
}

/** Escribe una clave de app_settings con compare-and-set sobre lo leído. Devuelve si escribió. */
async function escribir(tx: postgres.TransactionSql, ws: number, key: string, antes: string | null, despues: string): Promise<boolean> {
  const filas = antes == null
    ? await tx`insert into app_settings (workspace_id, key, value, updated_at) values (${ws}, ${key}, ${despues}, now())
        on conflict (workspace_id, key) do nothing returning key`
    : await tx`update app_settings set value = ${despues}, updated_at = now()
        where workspace_id = ${ws} and key = ${key} and value = ${antes} returning key`;
  if (filas.length !== 1) return false;
  respaldo.push({ ws, key, antes, despues });
  return true;
}

async function correr(tx: postgres.TransactionSql): Promise<void> {
  const negocios = SOLO_WS != null ? [SOLO_WS] : (await tx<Fila[]>`
    select distinct workspace_id from nutricion_secuencias where archivada_at is null ${PAUSADAS ? tx`and true` : tx`and activa = true`}
    order by workspace_id`).map((f) => Number(f.workspace_id));
  const totales = { poner: 0, marcar: 0, esperar: 0, nada: 0, noEscrito: 0 };
  for (const ws of negocios) {
    const ajustes = await tx<Fila[]>`select key, value from app_settings where workspace_id = ${ws}
      and (key = ${KEY_HORARIO_ENVIO} or key = ${CLAVE_ZONA} or key like ${`${CLAVE_PREFIJO}%`})`;
    const valor = (k: string) => (ajustes.find((a) => a.key === k)?.value as string | undefined) ?? null;
    let horarioNegocio = valor(KEY_HORARIO_ENVIO);
    if (HORARIO_NEGOCIO) {
      const nuevo = horarioPedido(HORARIO_NEGOCIO);
      if (nuevo === horarioNegocio) console.log(`ws ${ws}: el horario del negocio ya es ${HORARIO_NEGOCIO}.`);
      else if (!APLICAR) console.log(`ws ${ws}: pondría el horario del negocio en ${HORARIO_NEGOCIO}, todos los días.`);
      else if (await escribir(tx, ws, KEY_HORARIO_ENVIO, horarioNegocio, nuevo)) console.log(`ws ${ws}: horario del negocio → ${HORARIO_NEGOCIO}.`);
      else { console.log(`ws ${ws}: el horario del negocio cambió mientras corría: no lo pisé.`); totales.noEscrito += 1; }
      horarioNegocio = nuevo;
    }
    const zona = zonaDeLoGuardado(valor(CLAVE_ZONA));
    const configs = new Map<number, string>();
    for (const a of ajustes) {
      const id = typeof a.key === 'string' ? secuenciaDeClave(a.key) : null;
      if (id != null) configs.set(id, String(a.value));
    }
    const secs = await tx<Fila[]>`
      select id, nombre, clave, activa, disparadores, trigger_tipo, etapa, etapas, funnel_id, producto_id, etiqueta_id, cron, cron_proxima_at,
        to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as creada
      from nutricion_secuencias where workspace_id = ${ws} and archivada_at is null ${PAUSADAS ? tx`and true` : tx`and activa = true`} order by id`;
    const autos = secs.map((s) => ({
      id: Number(s.id), nombre: String(s.nombre ?? `#${s.id}`), clave: String(s.clave ?? ''), activa: s.activa === true,
      creadaAt: (s.creada as string | null) ?? null,
      triggers: disparadoresDe(s as never).map((d) => d.trigger_tipo),
      config: sanearConfigAutomatizacion(configs.get(Number(s.id)) ?? null),
    }));
    const plan = planDeHorarioDeFabrica({ delNegocio: horarioVigente(horarioNegocio), zona, ahoraMs: AHORA, autos, pausadas: PAUSADAS });
    console.log(`\nws ${ws} (${zona}): ${autos.length} automatizaciones`);
    for (const p of plan) {
      totales[p.hace] += 1;
      console.log(`  ${p.hace.padEnd(7)} #${p.id} «${p.nombre}» — ${p.motivo}`);
      if (!APLICAR) continue;
      const auto = autos.find((a) => a.id === p.id)!;
      const cambio = cambioDelPaso(p, auto.config);
      if (!cambio) continue;
      const r = configParaGuardar(auto.config, cambio);
      if (!r.ok) { console.log(`    ⚠️ no se puede guardar: ${r.error}`); totales.noEscrito += 1; continue; }
      const key = claveConfigAutomatizacion(p.id);
      if (!(await escribir(tx, ws, key, configs.get(p.id) ?? null, r.valor))) {
        console.log('    ⚠️ cambió mientras corría: no la pisé (vuelve a correrlo)');
        totales.noEscrito += 1;
      }
    }
  }
  console.log(`\n${APLICAR ? 'Escrito' : 'EN SECO (nada escrito)'}: poner ${totales.poner} · marcar ${totales.marcar} · esperar ${totales.esperar} · nada ${totales.nada}${totales.noEscrito ? ` · sin escribir ${totales.noEscrito}` : ''}`);
  if (totales.esperar) console.log('Las de «esperar» son de un negocio donde ahora es de noche: vuelve a correrlo de día.');
}

try {
  if (APLICAR) {
    await sql.begin(correr);
    const ruta = arg('respaldo') ?? `respaldo-horario-de-fabrica-${new Date(AHORA).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    writeFileSync(ruta, `${JSON.stringify(respaldo, null, 2)}\n`);
    console.log(`Respaldo (el antes de cada clave): ${ruta}`);
  } else {
    await sql.begin('read only', correr);
  }
} finally {
  await sql.end();
}
