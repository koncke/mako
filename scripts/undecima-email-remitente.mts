// =============================================================================
// undecima-email-remitente — ningún negocio manda a SUS leads con el remitente de MaKo (undécima tanda)
// =============================================================================
// Decisión 3 de la décima, literal de Martín: «Quitale a Mauricio que pueda mandar email con MaKo. Nadie
// debería poder.» Lo que MaKo le manda al equipo de un negocio sigue saliendo de MaKo (`from: REMITENTE_MAKO`
// en el código, lib/app-url.ts); lo que el NEGOCIO le manda a sus leads sale SÓLO con un remitente que pasa
// `remitenteDelNegocio` (lib/email-remitente.ts, puro y con test: tests/email-remitente.test.ts). Diseño:
// docs/diseno-undecima-tanda.md §2 (decisión 3), §8.5.2 y §9 (22-24).
//
// El código desplegado ya NO usa un remitente de MaKo en un cliente (`getEmailFrom` lo lee como el sandbox):
// esto limpia el DATO, para que ninguna pantalla ni lectura cruda lo vuelva a mostrar como «el suyo».
//
// Qué hace:
//   (a) lee `resend_from` y `resend_domain` de TODOS los workspaces, y sus credenciales `RESEND_FROM` y
//       `RESEND_API_KEY` (descifradas en local; de la key sólo se imprime una HUELLA, nunca el valor);
//   (b) calcula el veredicto de cada workspace ANTES y DESPUÉS con la MISMA `remitenteDelNegocio` que el envío;
//   (c) objetivo: cada `resend_from` de un dominio de MaKo en un workspace que no es la plataforma (medido el
//       11/10/2026: sólo el ws1, «MaKo <equipo@hola-mako.com>», updated_at 2026-07-29T16:51:25.580336Z);
//   (d) con --aplicar, ANTES de escribir guarda un respaldo en backups/undecima-email-remitente-<ts>.json, lo
//       RELEE y lo compara con lo leído; si no sirve, no escribe nada;
//   (e) escribe `value: ''` (lo mismo que «Desconectar» de /api/email/dominio) con compare-and-set sobre
//       workspace_id, key, updated_at y value leídos, y exige EXACTAMENTE una fila;
//   (f) una credencial `RESEND_FROM` de un dominio de MaKo (hoy 0) se informa, y se borra sólo con su
//       `valor_enc` en el respaldo y compare-and-set sobre `updated_at`;
//   (g) NUNCA toca `RESEND_API_KEY` (ni la del ws1, que es la de la plataforma, ni la copia del ws4);
//   (h) es idempotente: un '' ya puesto se saltea;
//   (i) relee e imprime el veredicto de cada workspace (esperado: ws1 'sin-remitente'; ws10 y ws11
//       'cuenta-propia'; el resto 'sin-remitente').
//
//   npx tsx scripts/undecima-email-remitente.mts              → SIMULACRO (default): sólo lee e imprime
//   npx tsx scripts/undecima-email-remitente.mts --simular    → lo mismo, dicho explícito
//   npx tsx scripts/undecima-email-remitente.mts --aplicar    → escribe (lo decide quien cierra la tanda)
//   opciones: --env=<ruta del .env.local> (default ./.env.local)
//
// ⚠️ VOLVER ATRÁS: el respaldo tiene cada fila tal cual (`value` y `updated_at`). Restaurar es escribir ese
//    `value` con compare-and-set sobre el `updated_at` que dejó este script. Con el código de la undécima
//    desplegado no cambia nada (el de MaKo en un cliente sale igual como el sandbox); con el de antes, el ws1
//    volvería a ofrecer el email de MaKo como suyo.
//
// ⚠️ «LA KEY ES DE LA PLATAFORMA» se mide contra las DOS copias, como `esDeLaPlataforma` (lib/credenciales.ts):
//    el `RESEND_API_KEY` del entorno y la fila del ws1. Medido el 11/10/2026: son DISTINTAS, y la del ws4 es
//    una copia de la del ws1; mirando sólo el entorno, el ws4 parecería tener cuenta propia.
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
if (aplicar && process.argv.includes('--simular')) throw new Error('--aplicar y --simular a la vez: elige uno');
config({ path: arg('env') ?? '.env.local', quiet: true });

const { remitenteDelNegocio, sanearRemitente, dominioDe, esDominioDeMako, esRemitenteDeMako } = await import('../lib/email-remitente');
type Veredicto = ReturnType<typeof remitenteDelNegocio>;
const { descifrar } = await import('../lib/cripto-credenciales');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pasa --env=<ruta del .env.local>)');
if (!process.env.CREDENCIALES_SECRET) throw new Error('falta CREDENCIALES_SECRET: sin él no se leen las credenciales (pasa --env=<ruta del .env.local>)');
const db = createClient(url, key, { auth: { persistSession: false } });

/** El workspace dueño de la fila de credenciales de la plataforma (`OWNER_WS`, lib/auth-session.ts: es Mauricio, un CLIENTE). */
const OWNER_WS = 1;
const CLAVES_SETTING = ['resend_from', 'resend_domain'] as const;

/** Una huella corta: para decir si dos keys son la misma sin imprimir ninguna. */
const huella = (v: string): string => createHash('sha256').update(v).digest('hex').slice(0, 10);

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Leer
// ═════════════════════════════════════════════════════════════════════════════════════════════════

type Ws = { id: number; nombre: string | null; capa: string | null };
type FilaSetting = { workspace_id: number; key: string; value: string | null; updated_at: string | null };
type FilaCred = { workspace_id: number; clave: string; valor_enc: string; updated_at: string | null; updated_by: string | null };

async function leerWorkspaces(): Promise<Ws[]> {
  const { data, error } = await db.from('workspaces').select('id, nombre, capa').order('id');
  if (error) throw new Error(`workspaces: ${error.message}`);
  return (data ?? []) as Ws[];
}

async function leerSettings(): Promise<FilaSetting[]> {
  const { data, error } = await db.from('app_settings').select('workspace_id, key, value, updated_at').in('key', [...CLAVES_SETTING]).order('workspace_id');
  if (error) throw new Error(`app_settings: ${error.message}`);
  return (data ?? []) as FilaSetting[];
}

async function leerCredenciales(): Promise<FilaCred[]> {
  const { data, error } = await db.from('credenciales').select('workspace_id, clave, valor_enc, updated_at, updated_by').in('clave', ['RESEND_FROM', 'RESEND_API_KEY']).order('workspace_id');
  if (error) throw new Error(`credenciales: ${error.message}`);
  return (data ?? []) as FilaCred[];
}

/** El de `wsSuperAdmin()` (lib/workspace.ts): la capa 'superadmin' de id más bajo; sin fila, el 9. */
function plataformaDe(wss: readonly Ws[]): number {
  return wss.filter((w) => w.capa === 'superadmin').map((w) => w.id).sort((a, b) => a - b)[0] ?? 9;
}

type Hechos = Parameters<typeof remitenteDelNegocio>[0];
type Estado = {
  ws: number;
  nombre: string;
  settings: Map<string, FilaSetting>;
  credFrom: { fila: FilaCred; valor: string | null } | null;
  keyHuella: string | null;
  keyEsDeLaPlataforma: boolean;
  hechos: Hechos;
};

function armarEstados(wss: readonly Ws[], settings: readonly FilaSetting[], creds: readonly FilaCred[]): Estado[] {
  const plataforma = plataformaDe(wss);
  const valorDe = (f: FilaCred): string | null => descifrar(f.valor_enc, f.workspace_id, f.clave);
  // La key de la PLATAFORMA, en sus dos copias: el entorno y la fila del dueño (`esDeLaPlataforma`).
  const keyEnv = (process.env.RESEND_API_KEY ?? '').trim();
  const filaOwner = creds.find((c) => c.workspace_id === OWNER_WS && c.clave === 'RESEND_API_KEY');
  const keyOwner = (filaOwner ? valorDe(filaOwner) ?? '' : '').trim();
  const esDeLaPlataforma = (v: string): boolean => !!v && (v === keyEnv || v === keyOwner);
  const ids = new Set<number>([...wss.map((w) => w.id), ...settings.map((s) => s.workspace_id), ...creds.map((c) => c.workspace_id)]);
  return [...ids].sort((a, b) => a - b).map((ws) => {
    const sets = new Map(settings.filter((s) => s.workspace_id === ws).map((s) => [s.key, s] as const));
    const fFrom = creds.find((c) => c.workspace_id === ws && c.clave === 'RESEND_FROM') ?? null;
    const fKey = creds.find((c) => c.workspace_id === ws && c.clave === 'RESEND_API_KEY') ?? null;
    const credFrom = fFrom ? { fila: fFrom, valor: valorDe(fFrom) } : null;
    const keyValor = fKey ? (valorDe(fKey) ?? '').trim() : '';
    const keyEsDeLaPlataforma = esDeLaPlataforma(keyValor);
    // Como `remitenteDelNegocioActual` (lib/resend.ts): la key sólo cuenta si hay un `RESEND_FROM` del cliente.
    const keyPropia = !!credFrom?.valor && !!keyValor && !keyEsDeLaPlataforma;
    return {
      ws,
      nombre: wss.find((w) => w.id === ws)?.nombre ?? '(sin fila en workspaces)',
      settings: sets,
      credFrom,
      keyHuella: fKey ? (keyValor ? huella(keyValor) : 'ILEGIBLE') : null,
      keyEsDeLaPlataforma,
      hechos: {
        resendFrom: sets.get('resend_from')?.value ?? null,
        resendDominio: sets.get('resend_domain')?.value ?? null,
        credFrom: credFrom?.valor ?? null,
        keyPropia,
        plataforma: ws === plataforma,
      },
    };
  });
}

const textoVeredicto = (v: Veredicto): string => (v.puede ? `PUEDE vía ${v.via}: ${v.from}` : `no puede (${v.motivo})`);

/** Lo que quedaría (o quedó) después de limpiar: `resend_from` = '' y sin la credencial de MaKo. */
function despues(e: Estado, limpiaSetting: boolean, borraCred: boolean): Hechos {
  return { ...e.hechos, resendFrom: limpiaSetting ? '' : e.hechos.resendFrom, credFrom: borraCred ? null : e.hechos.credFrom };
}

/** ¿El `resend_from` de este workspace es de MaKo y el workspace NO es la plataforma? (objetivo (c)) */
function settingObjetivo(e: Estado): FilaSetting | null {
  const f = e.settings.get('resend_from');
  if (!f || e.hechos.plataforma) return null;
  const v = typeof f.value === 'string' ? f.value : '';
  if (!v.trim()) return null; // (h) ya limpio
  const legible = sanearRemitente(v);
  const deMako = legible ? esDominioDeMako(dominioDe(legible)) : /@[a-z0-9.-]*(hola-mako\.com|makodigital\.app)\b/i.test(v);
  return deMako ? f : null;
}

/** ¿La credencial `RESEND_FROM` de este workspace es de MaKo? (objetivo (f), para TODO workspace) */
function credObjetivo(e: Estado): FilaCred | null {
  if (!e.credFrom) return null;
  return e.credFrom.valor && esRemitenteDeMako(e.credFrom.valor) ? e.credFrom.fila : null;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// El simulacro
// ═════════════════════════════════════════════════════════════════════════════════════════════════

console.log(`undecima-email-remitente · ${aplicar ? 'APLICAR' : 'SIMULACRO'} · ${new Date().toISOString()}`);
const [wss, settings, creds] = await Promise.all([leerWorkspaces(), leerSettings(), leerCredenciales()]);
const estados = armarEstados(wss, settings, creds);
const plataforma = plataformaDe(wss);
console.log(`plataforma (wsSuperAdmin): ws${plataforma} · fila de la key de la plataforma: ws${OWNER_WS} · RESEND_API_KEY del entorno: ${process.env.RESEND_API_KEY ? huella(process.env.RESEND_API_KEY.trim()) : '(no hay)'}`);

const objetivosSetting: Array<{ e: Estado; f: FilaSetting }> = [];
const objetivosCred: Array<{ e: Estado; f: FilaCred }> = [];
const avisos: string[] = [];

console.log('\n── Cada workspace, ANTES → DESPUÉS (la MISMA `remitenteDelNegocio` que usa el envío)');
for (const e of estados) {
  const fs = settingObjetivo(e);
  const fc = credObjetivo(e);
  if (fs) objetivosSetting.push({ e, f: fs });
  if (fc) objetivosCred.push({ e, f: fc });
  const rf = e.settings.get('resend_from');
  const rd = e.settings.get('resend_domain');
  const nada = !rf && !rd && !e.credFrom && !e.keyHuella;
  const antes = remitenteDelNegocio(e.hechos);
  const luego = remitenteDelNegocio(despues(e, !!fs, !!fc));
  const cambia = textoVeredicto(antes) !== textoVeredicto(luego);
  console.log(`  ws${e.ws} «${e.nombre}»${e.hechos.plataforma ? ' [PLATAFORMA]' : ''}${nada ? ' · sin nada de email' : ''}`);
  if (!nada) {
    if (rf) console.log(`      resend_from   = ${JSON.stringify(rf.value)} (updated_at ${rf.updated_at})${fs ? '  ← OBJETIVO: dominio de MaKo' : ''}`);
    if (rd) console.log(`      resend_domain = ${JSON.stringify(rd.value)} (updated_at ${rd.updated_at})`);
    if (e.credFrom) console.log(`      cred RESEND_FROM    = ${e.credFrom.valor == null ? 'ILEGIBLE (otro CREDENCIALES_SECRET)' : JSON.stringify(e.credFrom.valor)} (updated_at ${e.credFrom.fila.updated_at})${fc ? '  ← OBJETIVO: dominio de MaKo' : ''}`);
    if (e.keyHuella) console.log(`      cred RESEND_API_KEY = huella ${e.keyHuella}${e.keyEsDeLaPlataforma ? ' = LA DE LA PLATAFORMA (no es cuenta propia)' : ''} · nunca se toca`);
  }
  console.log(`      antes:   ${textoVeredicto(antes)}`);
  console.log(`      después: ${textoVeredicto(luego)}${cambia ? '' : ' (igual)'}`);
  if (e.credFrom && e.credFrom.valor == null) avisos.push(`ws${e.ws}: su RESEND_FROM no se pudo descifrar con este CREDENCIALES_SECRET; su veredicto acá puede no ser el de producción`);
}

console.log(`\n── Objetivos: ${objetivosSetting.length} resend_from de MaKo en un negocio · ${objetivosCred.length} credencial(es) RESEND_FROM de MaKo`);
for (const { e, f } of objetivosSetting) console.log(`  · ws${e.ws}: resend_from ${JSON.stringify(f.value)} → '' (compare-and-set sobre updated_at ${f.updated_at} y el value leído)`);
for (const { e, f } of objetivosCred) console.log(`  · ws${e.ws}: se borra la credencial RESEND_FROM (compare-and-set sobre updated_at ${f.updated_at}; su valor_enc va al respaldo)`);
if (!objetivosSetting.length && !objetivosCred.length) console.log('  (ninguno: ya está limpio)');

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Escribir (sólo con --aplicar)
// ═════════════════════════════════════════════════════════════════════════════════════════════════

const RESPALDO = `backups/undecima-email-remitente-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
const respaldo = {
  script: 'undecima-email-remitente',
  creado: new Date().toISOString(),
  settings: objetivosSetting.map(({ f }) => ({ workspace_id: f.workspace_id, key: f.key, value: f.value, updated_at: f.updated_at })),
  credenciales: objetivosCred.map(({ f }) => ({ workspace_id: f.workspace_id, clave: f.clave, valor_enc: f.valor_enc, updated_at: f.updated_at, updated_by: f.updated_by })),
};
const respaldoTexto = JSON.stringify(respaldo, null, 2);

/** Escribe el respaldo y lo RELEE: cada fila con el mismo valor y el mismo `updated_at` que se leyó. Si no, tira. */
function guardarRespaldo(): void {
  mkdirSync('backups', { recursive: true });
  writeFileSync(RESPALDO, respaldoTexto, 'utf8');
  const vuelta = JSON.parse(readFileSync(RESPALDO, 'utf8')) as typeof respaldo;
  const malas: string[] = [];
  for (const { f } of objetivosSetting) {
    const r = (vuelta.settings ?? []).find((x) => x?.workspace_id === f.workspace_id && x?.key === f.key);
    if (!r) malas.push(`ws${f.workspace_id} ${f.key} no está`);
    else if (r.value !== f.value || r.updated_at !== f.updated_at) malas.push(`ws${f.workspace_id} ${f.key}: otro valor u otro updated_at`);
  }
  for (const { f } of objetivosCred) {
    const r = (vuelta.credenciales ?? []).find((x) => x?.workspace_id === f.workspace_id && x?.clave === f.clave);
    if (!r) malas.push(`ws${f.workspace_id} ${f.clave} no está`);
    else if (r.valor_enc !== f.valor_enc || r.updated_at !== f.updated_at) malas.push(`ws${f.workspace_id} ${f.clave}: otro valor_enc u otro updated_at`);
  }
  if (malas.length) throw new Error(`el respaldo ${RESPALDO} no sirve (${malas.join(' · ')}): no se escribió nada`);
  console.log(`  ✓ respaldo releído: ${RESPALDO} (${objetivosSetting.length} setting, ${objetivosCred.length} credencial)`);
}

const paros: string[] = [];
if (!aplicar && (objetivosSetting.length || objetivosCred.length)) {
  console.log(`\n── Respaldo: con --aplicar, ANTES de escribir, se guarda y se relee ${RESPALDO} (${respaldoTexto.length} caracteres)`);
}
if (aplicar && (objetivosSetting.length || objetivosCred.length)) {
  console.log('\n══ ESCRIBIENDO ══');
  guardarRespaldo();
  for (const { f } of objetivosSetting) {
    // (e) compare-and-set sobre workspace_id, key, updated_at y el value leído; exactamente UNA fila.
    let q = db.from('app_settings').update({ value: '', updated_at: new Date().toISOString() })
      .eq('workspace_id', f.workspace_id).eq('key', f.key).eq('value', f.value ?? '');
    q = f.updated_at ? q.eq('updated_at', f.updated_at) : q.is('updated_at', null);
    const { data, error } = await q.select('workspace_id, key, value, updated_at');
    if (error) throw new Error(`ws${f.workspace_id} ${f.key}: ${error.message}`);
    const n = (data ?? []).length;
    if (n !== 1) paros.push(`ws${f.workspace_id} ${f.key}: se esperaba 1 fila y cambiaron ${n} (cambió mientras tanto: no se pisó)`);
    else console.log(`  ✓ ws${f.workspace_id} ${f.key} → '' (updated_at ${(data as FilaSetting[])[0].updated_at})`);
  }
  for (const { f } of objetivosCred) {
    // (f) borrar sólo con el respaldo hecho y compare-and-set sobre updated_at.
    let q = db.from('credenciales').delete().eq('workspace_id', f.workspace_id).eq('clave', 'RESEND_FROM').eq('valor_enc', f.valor_enc);
    q = f.updated_at ? q.eq('updated_at', f.updated_at) : q.is('updated_at', null);
    const { data, error } = await q.select('workspace_id, clave');
    if (error) throw new Error(`ws${f.workspace_id} credencial RESEND_FROM: ${error.message}`);
    const n = (data ?? []).length;
    if (n !== 1) paros.push(`ws${f.workspace_id} credencial RESEND_FROM: se esperaba 1 fila y se borraron ${n} (cambió mientras tanto)`);
    else console.log(`  ✓ ws${f.workspace_id}: credencial RESEND_FROM borrada`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// (i) Releer y comprobar
// ═════════════════════════════════════════════════════════════════════════════════════════════════

console.log(`\n── ${aplicar ? 'Releído de la base' : 'Lo que quedaría (simulado sobre lo leído)'}: el veredicto de cada workspace`);
let finales: Estado[];
if (aplicar) {
  const [w2, s2, c2] = await Promise.all([leerWorkspaces(), leerSettings(), leerCredenciales()]);
  finales = armarEstados(w2, s2, c2);
} else {
  const objS = new Set(objetivosSetting.map(({ e }) => e.ws));
  const objC = new Set(objetivosCred.map(({ e }) => e.ws));
  finales = estados.map((e) => ({ ...e, hechos: despues(e, objS.has(e.ws), objC.has(e.ws)) }));
}
const fallan: string[] = [];
for (const e of finales) {
  const v = remitenteDelNegocio(e.hechos);
  console.log(`  ws${e.ws}: ${textoVeredicto(v)}`);
  // Ningún negocio que no sea la plataforma puede salir con un remitente de MaKo.
  if (v.puede && esRemitenteDeMako(v.from) && !e.hechos.plataforma) fallan.push(`ws${e.ws} sigue saliendo con un remitente de MaKo`);
  const rf = e.hechos.resendFrom;
  if (!e.hechos.plataforma && typeof rf === 'string' && rf.trim() && esRemitenteDeMako(rf)) fallan.push(`ws${e.ws} sigue con resend_from de MaKo`);
}
// Lo que tiene que seguir igual: la RESEND_API_KEY de cada workspace (nunca se toca).
const keysAntes = estados.map((e) => `${e.ws}:${e.keyHuella ?? '-'}`).join(',');
const keysDespues = finales.map((e) => `${e.ws}:${e.keyHuella ?? '-'}`).join(',');
if (keysAntes !== keysDespues) fallan.push('cambió alguna RESEND_API_KEY (este script no las toca)');

if (avisos.length) console.log(`\n⚠ A saber:\n  - ${avisos.join('\n  - ')}`);
if (!aplicar) {
  console.log('\nLo que este simulacro NO puede comprobar sin escribir:');
  console.log('  - que nadie guarde en el medio: lo decide el compare-and-set al escribir (si cambió, --aplicar para y lo dice);');
  console.log('  - que el envío real tome el remitente nuevo: lo hace el código desplegado (`getEmailFrom`, lib/resend.ts), no este dato.');
}
console.log(`\n${aplicar ? (paros.length ? '✖ PARÓ' : fallan.length ? '✖ ESCRITO, PERO LA COMPROBACIÓN FALLA' : '✓ LISTO') : 'SIMULACRO'}`
  + ` · objetivos: ${objetivosSetting.length + objetivosCred.length} · paros: ${paros.length ? paros.join(' · ') : 'ninguno'} · comprobaciones que fallan: ${fallan.length ? fallan.join(' · ') : 0}`);
if (aplicar && (paros.length || fallan.length)) process.exitCode = 1;
