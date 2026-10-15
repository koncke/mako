// =============================================================================
// rehacer-hojas-dashboard — archivar las hojas viejas del Dashboard y rehacer las de Mauricio con las portadas (15/10/2026)
// =============================================================================
// Martín (14/10, por el orquestador): «Dile a General y Dashboard que eliminen las tabs viejas de los workspaces. Sólo en
// el caso de Mauricio, que vuelva a poner las tabs que estaban pero con su nuevo rediseño». El orden era: las portadas
// en producción (0ddeab54d, 15/10) → recién ahí esto.
//
// «ELIMINAR» ES LO QUE HACE EL PRODUCTO: ARCHIVAR (lib/graficos-catalogo.ts, `archivadas`): la hoja se va de la vista y
// queda en «Archivados», de donde la persona la restaura o la borra para siempre. Con todas archivadas, el informe queda
// `enBlanco` y la pantalla vuelve a «¿Qué vas a crear hoy?» con las plantillas nuevas. Nada se borra de verdad.
//
// QUÉ HOJA SE TOCA lo decidió una comparación PIEZA POR PIEZA (tipo, conjunto, métricas, dimensión, título, lugar) de cada
// hoja guardada contra las OCHO versiones que tuvo su plantilla desde el 11/10 (git: 623ff3cd9 … 68566adeb): una hoja
// igual a alguna versión no la tocó nadie. Las que no coinciden con NINGUNA no se tocan (una hoja editada a mano es una
// decisión de su dueño). Por eso el plan está ESCRITO acá, hoja por hoja, con el `updated_at` que tenía la fila cuando se
// comparó: si la fila cambió después, el script NO la toca y lo dice (alguien la editó en el medio).
//
// Resultado de la comparación (15/10/2026 ~07:10):
//   · iguales a una versión de su plantilla: Marketing de ws11, ws13 y ws15 (ba5e384f5); Ads Analyst de ws10 (623ff3cd9);
//     las 6 de Mauricio (ws1): Marketing, Ads, Landing y Productividad (623ff3cd9), Closing (6e85d8d7b) y Comercial (la
//     v5 con «Tendencia» de 10 filas, el alto de las versiones viejas: todo lo de abajo corrido 2 filas y nada más).
//   · ⚠️ NO COINCIDE con ninguna: la Cobranza de ws11 (una tabla sin título que no trajo ninguna plantilla, y «Cobrado y
//     pendiente por semana» leyendo otro conjunto). NO SE TOCA.
//   · El informe de GENERAL no es de este script: los dos guardados (ws1 y ws10) ya están `enBlanco`, con sus hojas
//     archivadas por alguien.
//
// Uso (desde la raíz del repo; `--env` si el .env.local no está en la carpeta actual):
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/rehacer-hojas-dashboard.ts            → el plan, sin escribir
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/rehacer-hojas-dashboard.ts --aplicar --respaldo <archivo.json>
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/rehacer-hojas-dashboard.ts --restaurar <archivo.json>
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/rehacer-hojas-dashboard.ts --repaso [--aplicar --respaldo <archivo.json>]
// EL REPASO (15/10 ~07:50): mirado en producción con la sesión de Mauricio, dos portadas no servían con sus datos — la de
// Ads leía el conjunto de Meta, que no traía la miniatura (sólo el de guiones la leía), y la de Productividad era la
// matriz, que sólo dibuja proyectos EVALUADOS (no tenía ninguno: «Sin datos»). Se corrigieron en lib/graficos-portadas.ts
// y el repaso cambia SÓLO esas dos hojas de Mauricio por la plantilla corregida, si nadie tocó el informe desde 10:24:43.
// El respaldo se escribe ANTES de tocar nada (la fila entera, tal cual). Restaurar devuelve cada fila sólo si nadie la
// cambió después de este script (mismo `updated_at` que dejó): si la persona ya editó, gana lo suyo y se avisa.
// =============================================================================

import { config } from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (k: string): string | null => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] ?? null : null; };
config({ path: arg('--env') ?? resolve(process.cwd(), '.env.local') });

import { getSupabaseServer } from '../lib/supabase';
import { sanearHoja, sanearTablero, type Hoja, type Tablero } from '../lib/graficos-catalogo';
import { plantillaHojaDe, tableroInicial } from '../lib/graficos-plantillas';

type Plan = {
  ws: number; key: string; dueno: string;
  /** El `updated_at` de la fila cuando se comparó: si cambió, no se toca. */
  comparado: string;
  /** Las hojas (por id) iguales a una versión de su plantilla: se archivan. */
  archivar: string[];
  /** Las que no coinciden con ninguna versión: quedan como están. */
  conservar?: string[];
  /** Mauricio: las hojas nuevas, en este orden, armadas con las plantillas de hoy (y el tema que eligió en cada una). */
  rehacer?: Array<{ plantilla: string; temaDe?: string }>;
};

const PLAN: Plan[] = [
  { ws: 13, key: 'graficos.tablero.10', dueno: 'Código Inmobiliario', comparado: '2026-10-13T14:03:12.714Z', archivar: ['gmv6r3x5v1k6f'] },
  { ws: 15, key: 'graficos.tablero.10', dueno: 'Brigitte Eberlin', comparado: '2026-10-13T19:33:06.912Z', archivar: ['gmv72w62819fh'] },
  { ws: 10, key: 'graficos.tablero.8', dueno: 'Leandro Tejado', comparado: '2026-10-14T16:21:44.778Z', archivar: ['gmv4noyxnkuih'] },
  { ws: 11, key: 'graficos.tablero.9', dueno: 'Leila', comparado: '2026-10-12T20:09:35.968Z', archivar: ['gmv5oqjdad39i'], conservar: ['gmv5ollxc9jfd'] },
  {
    ws: 1, key: 'graficos.tablero.2', dueno: 'Mauricio Bustos', comparado: '2026-10-13T03:25:28.888Z',
    archivar: ['marketing', 'comercial', 'ads-analyst', 'landing', 'closing', 'productividad'],
    // Los ids FIJOS de siempre (`armar((l) => l)`): el closer lee su hoja en memoria con esos ids y la caja de IA de la
    // cuenta se busca por (hoja, elemento). Marketing conserva el tema que Mauricio eligió («Contraste»).
    rehacer: [
      { plantilla: 'marketing', temaDe: 'marketing' }, { plantilla: 'comercial', temaDe: 'comercial' }, { plantilla: 'ads-analyst', temaDe: 'ads-analyst' },
      { plantilla: 'landing', temaDe: 'landing' }, { plantilla: 'closing', temaDe: 'closing' }, { plantilla: 'productividad', temaDe: 'productividad' },
    ],
  },
];

/** El repaso: hojas que este mismo script escribió, a cambiar por la plantilla corregida (mismo lugar, mismo tema). */
const REPASO: Array<{ ws: number; key: string; dueno: string; comparado: string; reemplazar: string[] }> = [
  { ws: 1, key: 'graficos.tablero.2', dueno: 'Mauricio Bustos', comparado: '2026-10-15T10:24:43.575Z', reemplazar: ['ads-analyst', 'productividad'] },
];

type Fila = { workspace_id: number; key: string; value: string | null; updated_at: string | null };

const mismoInstante = (a: string | null, b: string | null) => a != null && b != null && Date.parse(a) === Date.parse(b);

/** La hoja de una plantilla de hoy con sus ids FIJOS (como el informe inicial). */
function hojaFija(id: string): Hoja {
  const inicial = tableroInicial().hojas.find((h) => h.plantilla === id);
  if (inicial) return inicial;
  const p = plantillaHojaDe(id);
  if (!p) throw new Error(`no existe la plantilla «${id}»`);
  return sanearHoja({ ...p.armar((l) => l), plantilla: p.id }, 0)!;
}

/** El informe nuevo de una fila según su plan. */
function nuevoInforme(actual: Tablero, plan: Plan): { tablero: Tablero; log: string[] } {
  const log: string[] = [];
  const porId = new Map(actual.hojas.map((h) => [h.id, h]));
  const faltan = [...plan.archivar, ...(plan.conservar ?? [])].filter((id) => !porId.has(id));
  if (faltan.length) throw new Error(`ws${plan.ws}: no encuentro las hojas ${faltan.join(', ')}`);
  const sobran = actual.hojas.filter((h) => !plan.archivar.includes(h.id) && !(plan.conservar ?? []).includes(h.id));
  if (sobran.length) throw new Error(`ws${plan.ws}: hay hojas que el plan no nombra (${sobran.map((h) => h.nombre).join(', ')}): no toco nada`);
  const archivadas = plan.archivar.map((id) => porId.get(id)!);
  const quedan = actual.hojas.filter((h) => (plan.conservar ?? []).includes(h.id));
  const nuevas = (plan.rehacer ?? []).map((r) => {
    const h = hojaFija(r.plantilla);
    const tema = r.temaDe ? porId.get(r.temaDe)?.tema : undefined;
    return tema ? { ...h, tema } : h;
  });
  for (const h of archivadas) log.push(`archiva «${h.nombre}»`);
  for (const h of quedan) log.push(`CONSERVA «${h.nombre}» (no coincide con ninguna versión de su plantilla)`);
  for (const h of nuevas) log.push(`rehace «${h.nombre}» con la plantilla de hoy${h.tema?.plantilla && h.tema.plantilla !== 'mako' ? ` (tema ${h.tema.plantilla})` : ''}`);
  const hojas = [...nuevas, ...quedan];
  const crudo = {
    v: 3, nombre: actual.nombre, hojas,
    // Las archivadas de antes primero; las de hoy después (la más vieja se va cuando no entran: MAX_ARCHIVADAS).
    archivadas: [...(actual.archivadas ?? []), ...archivadas],
    ...(hojas.length ? {} : { enBlanco: true }),
  };
  const t = sanearTablero(crudo);
  if (!t) throw new Error(`ws${plan.ws}: el informe nuevo no pasa el saneo`);
  if (!hojas.length) log.push('queda EN BLANCO: la pantalla ofrece «¿Qué vas a crear hoy?» con las plantillas nuevas');
  return { tablero: t, log };
}

async function leerFila(ws: number, key: string): Promise<Fila | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, key, value, updated_at').eq('workspace_id', ws).eq('key', key).maybeSingle();
  if (error) throw new Error(`no pude leer ws${ws} ${key}: ${error.message}`);
  return (data as Fila | null) ?? null;
}

/** Escribe SÓLO si la fila sigue con `antes` (compare-and-set, como `guardarTableroSi`). Devuelve el `updated_at` nuevo. */
async function escribirSi(ws: number, key: string, valor: string, antes: string | null): Promise<string | null> {
  const ahora = new Date().toISOString();
  let q = getSupabaseServer().from('app_settings').update({ value: valor, updated_at: ahora }).eq('workspace_id', ws).eq('key', key);
  q = antes == null ? q.is('updated_at', null) : q.eq('updated_at', antes);
  const { data, error } = await q.select('key');
  if (error) throw new Error(`no pude escribir ws${ws} ${key}: ${error.message}`);
  return data?.length ? ahora : null;
}

async function restaurar(archivo: string) {
  const respaldo = JSON.parse(readFileSync(archivo, 'utf8')) as { filas: Array<Fila & { escrito?: string | null }> };
  for (const f of respaldo.filas) {
    if (!f.escrito) { console.log(`ws${f.workspace_id} ${f.key}: este script no la escribió, nada que devolver`); continue; }
    const actual = await leerFila(f.workspace_id, f.key);
    if (!actual || !mismoInstante(actual.updated_at, f.escrito)) { console.log(`⚠️ ws${f.workspace_id} ${f.key}: cambió después del script (${actual?.updated_at}); NO la piso`); continue; }
    const ok = await escribirSi(f.workspace_id, f.key, f.value ?? '', actual.updated_at);
    console.log(`ws${f.workspace_id} ${f.key}: ${ok ? 'devuelta como estaba' : '⚠️ cambió en el medio; no la toqué'}`);
  }
}

async function repaso(aplicar: boolean, archivoRespaldo: string | null) {
  const filas: Array<Fila & { escrito?: string | null }> = [];
  const trabajos: Array<{ r: (typeof REPASO)[number]; fila: Fila; tablero: Tablero }> = [];
  for (const r of REPASO) {
    const fila = await leerFila(r.ws, r.key);
    if (!fila?.value || !mismoInstante(fila.updated_at, r.comparado)) { console.log(`⚠️ ws${r.ws} ${r.dueno}: cambió después del script (${fila?.updated_at}); NO se toca`); continue; }
    const actual = sanearTablero(JSON.parse(fila.value))!;
    const hojas = actual.hojas.map((h) => {
      if (!r.reemplazar.includes(h.id)) return h;
      const nueva = hojaFija(h.plantilla ?? h.id);
      console.log(`ws${r.ws} ${r.dueno}: «${h.nombre}» con la plantilla corregida`);
      return { ...nueva, tema: h.tema };
    });
    const t = sanearTablero({ ...actual, hojas })!;
    filas.push({ ...fila });
    trabajos.push({ r, fila, tablero: t });
  }
  if (!aplicar) return;
  if (!archivoRespaldo || existsSync(archivoRespaldo)) throw new Error('--aplicar pide --respaldo <archivo.json> nuevo');
  writeFileSync(archivoRespaldo, JSON.stringify({ hecho: new Date().toISOString(), filas }, null, 1));
  for (const w of trabajos) {
    const escrito = await escribirSi(w.r.ws, w.r.key, JSON.stringify(w.tablero), w.fila.updated_at);
    filas.find((x) => x.workspace_id === w.r.ws && x.key === w.r.key)!.escrito = escrito;
    console.log(`ws${w.r.ws}: ${escrito ? 'escrita' : '⚠️ cambió en el medio; NO se escribió'}`);
  }
  writeFileSync(archivoRespaldo, JSON.stringify({ hecho: new Date().toISOString(), filas }, null, 1));
}

async function main() {
  const devolver = arg('--restaurar');
  if (devolver) return restaurar(devolver);
  if (process.argv.includes('--repaso')) return repaso(process.argv.includes('--aplicar'), arg('--respaldo'));
  const aplicar = process.argv.includes('--aplicar');
  const archivoRespaldo = arg('--respaldo');
  if (aplicar && !archivoRespaldo) throw new Error('--aplicar pide --respaldo <archivo.json>: sin respaldo no se toca nada');
  if (aplicar && existsSync(archivoRespaldo!)) throw new Error(`el respaldo ${archivoRespaldo} ya existe: no lo piso`);
  console.log(aplicar ? '=== APLICANDO ===' : '=== EL PLAN (no escribe nada: --aplicar --respaldo <archivo>) ===');

  const filas: Array<Fila & { escrito?: string | null }> = [];
  const trabajos: Array<{ plan: Plan; fila: Fila; tablero: Tablero; log: string[] }> = [];
  for (const plan of PLAN) {
    const fila = await leerFila(plan.ws, plan.key);
    if (!fila?.value) { console.log(`ws${plan.ws} ${plan.key}: no está; nada que hacer`); continue; }
    if (!mismoInstante(fila.updated_at, plan.comparado)) { console.log(`⚠️ ws${plan.ws} ${plan.dueno}: cambió después de la comparación (${fila.updated_at}); NO se toca`); continue; }
    const actual = sanearTablero(JSON.parse(fila.value));
    if (!actual) { console.log(`⚠️ ws${plan.ws} ${plan.key}: no se entiende; NO se toca`); continue; }
    const { tablero, log } = nuevoInforme(actual, plan);
    console.log(`\nws${plan.ws} ${plan.dueno} (${plan.key})`);
    for (const l of log) console.log(`   · ${l}`);
    console.log(`   = se ven: ${tablero.enBlanco ? '(ninguna)' : tablero.hojas.map((h) => h.nombre).join(', ')} · archivadas: ${(tablero.archivadas ?? []).length}`);
    filas.push({ ...fila });
    trabajos.push({ plan, fila, tablero, log });
  }
  if (!aplicar) return;
  // EL RESPALDO, ANTES DE TOCAR NADA: las filas enteras, tal cual estaban.
  writeFileSync(archivoRespaldo!, JSON.stringify({ hecho: new Date().toISOString(), filas }, null, 1));
  console.log(`\nrespaldo: ${archivoRespaldo} (${filas.length} filas)`);
  for (const t of trabajos) {
    const escrito = await escribirSi(t.plan.ws, t.plan.key, JSON.stringify(t.tablero), t.fila.updated_at);
    const f = filas.find((x) => x.workspace_id === t.plan.ws && x.key === t.plan.key)!;
    f.escrito = escrito;
    console.log(`ws${t.plan.ws} ${t.plan.dueno}: ${escrito ? 'escrita' : '⚠️ cambió en el medio; NO se escribió'}`);
  }
  // El respaldo vuelve a escribirse con lo que quedó escrito (restaurar lo necesita para no pisar ediciones posteriores).
  writeFileSync(archivoRespaldo!, JSON.stringify({ hecho: new Date().toISOString(), filas }, null, 1));
  // La verificación con lo que lee el producto: cada fila vuelve a leerse y a sanearse.
  for (const t of trabajos) {
    const f = await leerFila(t.plan.ws, t.plan.key);
    const leido = f?.value ? sanearTablero(JSON.parse(f.value)) : null;
    const vistas = leido ? (leido.enBlanco ? [] : leido.hojas.map((h) => h.nombre)) : null;
    console.log(`  leído ws${t.plan.ws}: ${vistas ? (vistas.length ? vistas.join(', ') : 'en blanco') : '⚠️ no se pudo leer'} · archivadas ${(leido?.archivadas ?? []).length}`);
  }
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
