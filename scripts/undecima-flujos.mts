// =============================================================================
// undecima-flujos — rehace los flujos de PRODUCCIÓN con las piezas de hoy (undécima tanda, ola 4)
// =============================================================================
// Pedido de Martín (11/10/2026), con enojo y varias veces: «Jamás se debe cambiar una tarjeta, no se más como
// decirlo... Elimina todas los flujos y vuelvelos a hacer con las herramientas que ya existen, porque estan muy
// mal...» y «"Recordatorio de reunión" NO debería ser un flujo aparte ... Debería estar todo en un mismo flujo de
// "Agendó reunión" ... Y que el único flujo pase a llamarse "Un Lead Agendó Llamada"». La especificación tarjeta por
// tarjeta es docs/diseno-undecima-tanda.md §3, y vive como funciones puras en lib/undecima-flujos-plan.ts.
//
// ⚠️ EL ORDEN DE DESPLIEGUE (no se adelanta nada):
//   1. Primero el DEPLOY de las olas 1-3 (el motor que entiende el CRON de etapa con reunión —M1, M2—, el carril del
//      recordatorio —M3, M4—, los datos «Próxima reunión», la tarjeta «MaKo en WhatsApp» con partes y el AI Step
//      con objetivo) y la migración 0257. Sin ese motor, «Un Lead Agendó Llamada» manda PEOR que #213 + #228 + #239.
//   2. Después ESTE script en SIMULACRO (el default): imprime cada flujo ANTES y DESPUÉS con las funciones que dibujan
//      la tarjeta, y qué le pasa a cada inscripción viva o afectada y cuándo sería su próximo envío.
//   3. `--aplicar` lo decide quien cierra la tanda, con el respaldo releído. Si algo cambió entre medio, el
//      compare-and-set no pisa: para y lo dice; la corrida siguiente sigue donde quedó (es idempotente).
//   4. Recién con --aplicar hecho y «0 filas vivas» que los usen: la limpieza (§8.7, commit aparte).
//
//   npx tsx scripts/undecima-flujos.mts                      → SIMULACRO (sólo lee)
//   npx tsx scripts/undecima-flujos.mts --aplicar            → escribe (lo decide quien cierra)
//   npx tsx scripts/undecima-flujos.mts --restaurar=<json>   → SIMULACRO de volver atrás desde un respaldo
//   npx tsx scripts/undecima-flujos.mts --restaurar=<json> --aplicar → vuelve atrás
//   opciones: --env=<ruta del .env.local> (default ./.env.local)
//
// Qué hace, por negocio y en este orden (§8.5):
//   ws1:  medir → pre-sembrar 'completada' a quien esté en «Agenda R1» sin fila en #213 (hoy 0) → #213 «Un Lead Agendó
//         Llamada» (CRON «Agenda R1», 3 caminos, UN AI Step) → re-armar SÓLO el camino 3 de las inscripciones 201 y 202
//         → archivar #228 y #239 (la MISMA corrida) → #198 «Un Lead Entró» → #238 (sólo su lista de CRON).
//   ws13: fila NUEVA «Un Lead Agendó Llamada» (nace pausada) → pre-sembrar 'completada' a cada lead en «Pre R1» (sin
//         eso, el barrido de la hora le manda al grupo del cliente un «Nuevo agendado» viejo por cada uno) → prenderla →
//         archivar #240, #223 y #224.
//   ws4:  #209 «Un Lead Entró» y #210 «Un Lead Agendó Llamada», pausadas.
//   y toda fila viva de un Evento de MaKo con {{mensaje_mako}} que no está acá, en el lugar con la plantilla nueva de su
//   evento. Al final, RELEE y comprueba.
//
// ⚠️ FRENA (no escribe NADA) ante: una fila viva que el plan no prevé (salvo un evento con {{mensaje_mako}}), un plan o
// una validación con error, un embudo sin la etapa, o un id nuevo que la historia ya vio. Y para a mitad (sin pisar)
// ante un compare-and-set que no coincide.
//
// ⚠️ ESCRIBE CON LA SERVICE ROLE, sin `server-only` (el molde de scripts/novena-tanda-ws1.mts): `setSecuenciaPasos` y
// `guardarDisparadores` cuelgan de `getTenantDb`. Por eso cada propuesta pasa ANTES por las funciones PURAS que usan
// ellas (`chequearPropuesta`: validarGrafo, frenoDelFlujo con problemasDeTokens, problemaDeDisparadores, ningún CRON
// «(de antes)», problemasDeForma, un AI Step por medio con objetivo, la ida y vuelta por camposDelFlujo y, en un
// evento, frenoDelEvento), toda lectura y escritura filtra `workspace_id`, y toda escritura es compare-and-set sobre
// `updated_at` (y `disparadores_rev` en los CRON, `hilos_rev` en las inscripciones). jsonb como OBJETO, nunca string.
//
// ⚠️ CON --aplicar, ANTES DE ESCRIBIR NADA guarda y RELEE el respaldo en backups/undecima-flujos-<ts>.json: las filas
// enteras, sus inscripciones y las de los leads con reunión por delante, y las marcas `mako.recordatorio-lead.*` de esos
// leads. Si no se puede releer igual, no se escribe nada. VOLVER ATRÁS: `--restaurar=<ese archivo>` (también en
// simulacro por defecto) devuelve cada fila a lo del respaldo (pasos, CRON, nombre, prendida, archivada), devuelve las
// inscripciones re-armadas y ARCHIVA la fila nueva del ws13. Las marcas no se tocan: son las que evitan el doble envío.
// Volver a un deploy anterior DESPUÉS de --aplicar es destructivo (§8.6).
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { config } from 'dotenv';
import type { PasoGrafo } from '../lib/flujo-grafo';
import type { Disparador } from '../lib/disparadores';
import type { FilaFlujo, Propuesta, Plan, EtapaCron } from '../lib/undecima-flujos-plan';
import type { PasoParaGrafo } from '../lib/flujo-conversacion';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
if (aplicar && process.argv.includes('--simular')) throw new Error('--aplicar y --simular a la vez: elige uno');
const restaurar = arg('restaurar');
config({ path: arg('env') ?? '.env.local', quiet: true });

const PLAN = await import('../lib/undecima-flujos-plan');
const { claseDe, idDe, nodoPorId, indicePorId, normalizar, esPasoIA, textoFila } = await import('../lib/flujo-grafo');
const { grafoDeSecuencia, resumenPasoIA, burbujasDeTarjeta, detalleDisparador } = await import('../lib/flujo-conversacion');
const { ROTULO_LIBERTAD } = await import('../lib/ai-step-libertad');
const { textoDeDisparador, disparadoresDe, TRIGGER_AVISO_MAKO } = await import('../lib/disparadores');
const { minutosAntesDeReunion, resolverControl, decidirToqueDelCarril, indiceActual } = await import('../lib/nutricion-grafo-motor');
const { proximaReunion, reunionFuturaMs, reunionQuePreparaMs } = await import('../lib/nutricion-reinscripcion');
const { claveToque, estadoDeLaMarca } = await import('../lib/recordatorio-lead');
const { filaAFunnel, COLS: COLS_FUNNEL } = await import('../lib/funnel-fila');
const { pipelineStageOf } = await import('../lib/pipeline');
const { ambitoDeSecuencia, leadEnAmbito } = await import('../lib/nutricion-ambito');
const { preparaReunion } = await import('../lib/nutricion-familias');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pasa --env=<ruta del .env.local>)');
const db = createClient(url, key, { auth: { persistSession: false } });

// ── Lo que este script toca, y nada más (§3) ───────────────────────────────────────────────────────

const WS1 = 1;
const WS4 = 4;
const WS13 = 13;
const WORKSPACES = [WS1, WS4, WS13] as const;
/** Las filas vivas que el plan prevé, con el `updated_at` que midió el diseño (§3; se usa el que se LEE ahora). */
const PREVISTAS: Readonly<Record<number, { ws: number; upd: string }>> = {
  198: { ws: WS1, upd: '2026-10-11T15:20:50.165Z' }, 213: { ws: WS1, upd: '2026-10-11T15:20:50.413Z' },
  228: { ws: WS1, upd: '2026-10-10T17:26:28.167Z' }, 238: { ws: WS1, upd: '2026-10-11T06:32:14.213Z' },
  239: { ws: WS1, upd: '2026-10-11T15:17:01.910Z' }, 209: { ws: WS4, upd: '2026-10-08T15:20:02.947Z' },
  210: { ws: WS4, upd: '2026-10-08T15:20:03.656Z' }, 223: { ws: WS13, upd: '2026-10-10T14:29:32.513Z' },
  224: { ws: WS13, upd: '2026-10-10T16:09:00.574Z' }, 240: { ws: WS13, upd: '2026-10-11T15:17:04.451Z' },
};
/** Las etapas de cada CRON (la `value` que ofrece el desplegable del CRON para ese embudo). */
const CRON = {
  entroWs1: { funnelId: 1, etapa: 'lead' }, agendoWs1: { funnelId: 1, etapa: 'agenda' },
  entroWs4: { funnelId: 5, etapa: 'lead' }, agendoWs4: { funnelId: 5, etapa: 'agenda' },
  agendoWs13: { funnelId: 6, etapa: 'agenda' },
} as const satisfies Record<string, EtapaCron>;
const INSC_REARMAR = [201, 202];
/** Una inscripción que todavía puede mandar o contestar algo. */
const VIVAS = new Set(['activa', 'pendiente', 'respondio', 'pausada', 'handoff']);

const COLS = 'id, workspace_id, nombre, clave, trigger_tipo, etapa, etapas, funnel_id, producto_id, etiqueta_id, cron, cron_proxima_at, '
  + 'activa, archivada_at, updated_at, pasos, pasos_borrador, posiciones, disparadores, disparadores_rev, emoji';
const COLS_INSC = 'id, workspace_id, lead_id, secuencia_id, estado, paso_actual, nodo_actual, hilos, hilos_rev, proximo_envio_at, reunion_at, desenlace, desenlace_at, inscripto_at, updated_at';
const COLS_LEAD = 'id, workspace_id, nombre, funnel_id, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at, '
  + 'junta_1_url, junta_2_url, asistio_j1, asistio_j2, nutricion_realizada, created_at';

type Insc = {
  id: number; workspace_id: number; lead_id: number; secuencia_id: number; estado: string; paso_actual: number; nodo_actual: string | null;
  hilos: unknown; hilos_rev: number | null; proximo_envio_at: string | null; reunion_at: string | null; desenlace: string | null;
  desenlace_at: string | null; inscripto_at: string | null; updated_at: string | null;
};
type Lead = Record<string, unknown> & { id: number; workspace_id: number; nombre: string | null; funnel_id: number | null; estado_lead: string | null; created_at: string };
type Marca = { workspace_id: number; key: string; value: unknown };

// ── Utilidades ──────────────────────────────────────────────────────────────────────────────────

const iso = (x: string | number | Date | null | undefined): string => (x == null ? '—' : new Date(x).toISOString());
const corto = (t: unknown, n = 70): string => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const avisos: string[] = [];
const frenos: string[] = [];
const ok = (b: boolean) => (b ? '✓' : '✖');

/** Lee paginado por id (PostgREST corta en 1000 sin decirlo). */
async function leerTodo<T>(tabla: string, cols: string, filtrar: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await filtrar(db.from(tabla).select(cols)).order('id', { ascending: true }).range(desde, desde + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

/** Los rótulos de los disparadores de antes (el catálogo `TRIGGERS` vive en un módulo con `server-only`: se lee su texto). */
const ROTULOS_DE_ANTES: Record<string, string> = (() => {
  try {
    const src = readFileSync(new URL('../lib/email-marketing.ts', import.meta.url), 'utf8');
    const bloque = src.slice(src.indexOf('export const TRIGGERS'), src.indexOf('];', src.indexOf('export const TRIGGERS')));
    return Object.fromEntries([...bloque.matchAll(/value:\s*'([a-z0-9_]+)',\s*label:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  } catch { return {}; }
})();

// ── Los embudos: lo que el CRON de etapa ofrece (la MISMA función que la pantalla) ──────────────────

type Embudo = { id: number; ws: number; esDefault: boolean; etapas: Array<{ value: string; label: string }> };
const embudos = new Map<number, Embudo>();
async function leerEmbudos(): Promise<void> {
  const ids = [...new Set(Object.values(CRON).map((c) => c.funnelId))];
  const { data, error } = await db.from('funnels').select(`${COLS_FUNNEL}, workspace_id`).in('workspace_id', [...WORKSPACES]).in('id', ids);
  if (error) throw new Error(`funnels: ${error.message}`);
  for (const f of (data ?? []) as Array<Parameters<typeof filaAFunnel>[0] & { workspace_id: number }>) {
    const cfg = filaAFunnel(f);
    // `productosConEtapas` (lib/setting-secuencias.ts): las etapas del embudo, sin la banda de salidas.
    const etapas = cfg.stages.filter((st) => (st.band ?? 'pipeline') !== 'salidas').map((st) => ({ value: st.key, label: st.label }));
    embudos.set(Number(f.id), { id: Number(f.id), ws: Number(f.workspace_id), esDefault: f.es_default === true, etapas });
  }
}
function exigirEtapa(ws: number, c: EtapaCron): string | null {
  const e = embudos.get(c.funnelId);
  if (!e) return `el embudo ${c.funnelId} no existe`;
  if (e.ws !== ws) return `el embudo ${c.funnelId} no es del ws${ws}`;
  if (!e.etapas.some((x) => x.value === c.etapa)) return `«${c.etapa}» no es una etapa del embudo ${c.funnelId}`;
  return null;
}
const nombreEtapa = (funnelId: number | null | undefined, key: string): string =>
  embudos.get(Number(funnelId))?.etapas.find((x) => x.value === key)?.label ?? key;

// ── Cómo se DIBUJA cada flujo (las funciones del lienzo) ───────────────────────────────────────────

/** El rótulo de un CRON con la misma función que la tarjeta (`textoDeDisparador` + `detalleDisparador`). */
function rotuloCron(d: Disparador): string {
  const deSiempre = (x: Disparador): string => {
    const keys = x.etapas?.length ? x.etapas : x.etapa ? [x.etapa] : [];
    return detalleDisparador({
      trigger_tipo: x.trigger_tipo, etapa: x.etapa ?? null, cron: null,
      etiquetaTrigger: ROTULOS_DE_ANTES[x.trigger_tipo] ?? null,
      nombreEtapa: x.etapa ? nombreEtapa(x.funnel_id, x.etapa) : null,
      nombresEtapas: keys.map((k) => nombreEtapa(x.funnel_id, k)),
    });
  };
  return textoDeDisparador(d, { deSiempre, tz: null });
}

/** Una tarjeta, como la dibuja el lienzo: su título, su detalle (o su texto) y sus flechas. */
function dibujar(titulo: string, pasos: readonly PasoGrafo[], crones: readonly Disparador[]): void {
  const textos = crones.map(rotuloCron);
  console.log(`  ${titulo}: CRON ${textos.map((t) => `«${t}»`).join(' + ') || '—'}`);
  if (!pasos.length) { console.log('    (sin tarjetas)'); return; }
  const g = grafoDeSecuencia(pasos as unknown as readonly PasoParaGrafo[], { disparador: textos[0] ?? '', disparadores: crones.map((d, i) => ({ id: d.id, texto: textos[i] })) });
  const flechas = (id: string) => g.aristas.filter((a) => a.desde === id).map((a) => {
    const esperas = (a.esperas ?? []).map((e) => `⏳ ${e.texto} → `).join('');
    return `${a.etiqueta ? `[${corto(a.etiqueta, 50)}] ` : ''}→ ${esperas}${a.hasta}`;
  });
  for (const n of g.nodos) {
    if (n.enFlecha) continue;
    const p = nodoPorId(pasos, n.id);
    let que = n.detalle ?? '';
    if (n.tipo === 'paso-ia' && p) {
      const r = resumenPasoIA(p);
      que = `objetivo «${r.objetivo ?? 'FALTA'}» · ${r.escenarios.map((e) => `${e.titulo} (${ROTULO_LIBERTAD[e.libertad]})`).join(' · ') || 'sin escenarios'} · Lo demás: ${ROTULO_LIBERTAD[r.loDemas]}`;
    } else if (n.tipo === 'mensaje' && p) {
      const partes = burbujasDeTarjeta(p as unknown as PasoParaGrafo);
      const audio = p.tipo === 'audio' ? `🎤 audio #${p.audio_id} ` : '';
      que = `${audio}${partes ? partes.map((x) => (x.tipo === 'texto' ? `«${corto(x.cuerpo, 40)}»` : `[${x.tipo}]`)).join(' + ') : `«${corto(p.cuerpo, 80)}»`} · ${p.revisar === false ? 'sale solo' : p.revisar === true ? 'para aprobar' : 'lo que diga la estrategia'}`;
    } else if (n.tipo === 'condicion' && p && claseDe(p) === 'condicion') {
      que = (p.ramas ?? []).map((r) => r.filas.map((f) => textoFila(f)).join(r.modo === 'cualquiera' ? ' o ' : ' y ')).join(' | ');
    }
    console.log(`    ${n.icono} ${n.titulo}${n.id === 'entrada' ? '' : ` ${n.id}`}${que ? ` · ${corto(que, 160)}` : ''}${n.advertencia ? ` ⚠ ${n.advertencia}` : ''}`);
    for (const f of flechas(n.id)) console.log(`        ${f}`);
  }
}

// ── Lecturas ────────────────────────────────────────────────────────────────────────────────────

/**
 * EL CENSO: las filas vivas de TODOS los negocios (§3: «Una fila viva que no esté en esta tabla FRENA el script, salvo una de
 * un Evento de MaKo con {{mensaje_mako}}»). Es la única lectura que no filtra un workspace, a propósito: un aviso con
 * {{mensaje_mako}} de otro negocio (una «Aviso de pago recibido» creada después del relevo) también se rehace. Cada
 * escritura filtra el suyo.
 */
async function leerVivas(): Promise<FilaFlujo[]> {
  return leerTodo<FilaFlujo>('nutricion_secuencias', COLS, (q) => q.not('workspace_id', 'is', null).is('archivada_at', null));
}
async function leerFilas(ws: number, ids: readonly number[]): Promise<Map<number, FilaFlujo>> {
  if (!ids.length) return new Map();
  const { data, error } = await db.from('nutricion_secuencias').select(COLS).eq('workspace_id', ws).in('id', [...ids]);
  if (error) throw new Error(`nutricion_secuencias ws${ws}: ${error.message}`);
  return new Map(((data ?? []) as unknown as FilaFlujo[]).map((f) => [Number(f.id), f]));
}
async function leerPorClave(ws: number, clave: string): Promise<FilaFlujo | null> {
  const { data, error } = await db.from('nutricion_secuencias').select(COLS).eq('workspace_id', ws).eq('clave', clave).maybeSingle();
  if (error) throw new Error(`nutricion_secuencias (clave ${clave}): ${error.message}`);
  return (data as unknown as FilaFlujo | null) ?? null;
}
async function leerInscs(ws: number, secIds: readonly number[]): Promise<Insc[]> {
  if (!secIds.length) return [];
  return leerTodo<Insc>('nutricion_inscripciones', COLS_INSC, (q) => q.eq('workspace_id', ws).in('secuencia_id', [...secIds]));
}
async function leerLeadsAbiertos(ws: number): Promise<Lead[]> {
  return leerTodo<Lead>('leads', COLS_LEAD, (q) => q.eq('workspace_id', ws).eq('estado_lead', 'abierto'));
}
async function leerMarcas(ws: number, leadIds: readonly number[]): Promise<Marca[]> {
  const out: Marca[] = [];
  for (const id of new Set(leadIds)) {
    const { data, error } = await db.from('app_settings').select('workspace_id, key, value').eq('workspace_id', ws).like('key', `mako.recordatorio-lead.${id}.%`);
    if (error) throw new Error(`app_settings (marcas de ${id}): ${error.message}`);
    out.push(...((data ?? []) as Marca[]));
  }
  return out;
}
/** Los ids de tarjeta que la historia de una secuencia ya vio (un id nuevo no puede reusar uno). */
async function nodosDeLaHistoria(ws: number, secId: number, inscs: readonly Insc[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (const i of inscs.filter((x) => x.secuencia_id === secId)) {
    if (i.nodo_actual) out.add(i.nodo_actual);
    for (const h of Array.isArray(i.hilos) ? (i.hilos as Array<{ nodo?: unknown }>) : []) if (typeof h?.nodo === 'string') out.add(h.nodo);
  }
  const envios = await leerTodo<{ nodo_id: string }>('nutricion_envios', 'id, nodo_id', (q) => q.eq('workspace_id', ws).eq('secuencia_id', secId).not('nodo_id', 'is', null));
  for (const e of envios) out.add(e.nodo_id);
  return out;
}

/**
 * LOS LEADS QUE ESTÁN EN UNA ETAPA, con la regla del motor para `etapa_actual` (`leadsDeCohorte`, lib/nutricion.ts):
 * abiertos, en el ámbito del embudo (`ambitoDeSecuencia` + `leadEnAmbito`), con un hito en los últimos 90 días y la
 * etapa EFECTIVA (`pipelineStageOf`) igual a la del CRON.
 */
function enLaEtapa(leads: readonly Lead[], c: EtapaCron, ahoraMs: number): Lead[] {
  const e = embudos.get(c.funnelId)!;
  const ambito = ambitoDeSecuencia(c.funnelId, e.esDefault);
  const corte = ahoraMs - 90 * 86400 * 1000;
  const hito = (l: Lead) => Math.max(...[l.created_at, l.fecha_agenda, l.fecha_junta_1, l.fecha_junta_2]
    .filter((x): x is string => typeof x === 'string' && !!x).map((x) => Date.parse(x)).filter((ms) => Number.isFinite(ms)), 0);
  return leads.filter((l) => leadEnAmbito(ambito, l.funnel_id) && hito(l) >= corte
    && pipelineStageOf({ ...(l as Record<string, unknown>), nutricion_realizada: (l.nutricion_realizada as boolean | null) ?? undefined } as never) === c.etapa);
}

// ── El carril de una inscripción re-armada: cuándo sale cada toque (las funciones del motor) ───────

function lineaDelCarril(pasos: readonly PasoGrafo[], lead: Lead, marcas: readonly Marca[], ahoraMs: number): string[] {
  const out: string[] = [];
  const r = proximaReunion(lead as never, ahoraMs, { estricta: true });
  if (!r) {
    const laxa = proximaReunion(lead as never, ahoraMs, { estricta: false });
    return [`sin reunión con hora por delante (${laxa ? 'la reunión no tiene hora' : 'ninguna'}): el motor cierra ese hilo y la inscripción termina`];
  }
  const e = resolverControl(pasos, indicePorId(pasos, PLAN.IDS_AGENDO.e1440), {
    hechos: null, ahoraMs, reunionMs: reunionFuturaMs(lead as never, ahoraMs), reunionConHoraMs: r.inicioMs,
  });
  out.push(`${r.cual} ${iso(r.inicioMs)} · al procesarla el motor la deja en ${'idx' in e ? idDe(pasos[e.idx], e.idx) : e.tipo}${e.tipo === 'esperar' ? ` para el ${iso(e.proximoMs)}` : ''}`);
  for (const t of PLAN.TOQUES_AGENDO) {
    const idx = indicePorId(pasos, t.toque);
    const clave = claveToque(Number(lead.id), r.cual, new Date(r.inicioMs).toISOString(), t.min);
    const marca = marcas.find((m) => m.key === clave);
    const d = decidirToqueDelCarril({
      leadId: Number(lead.id), pasos, idx, juntas: lead as never, ahoraMs,
      estadoMarca: estadoDeLaMarca(marca == null ? null : String(marca.value)), estadoLead: String(lead.estado_lead ?? ''),
    });
    const que = !d ? 'no es del carril (?)' : d.tipo === 'esperar' ? `sale el ${iso(d.proximoMs)}` : d.tipo === 'enviar' ? 'sale YA' : d.tipo === 'omitido' ? `no sale: ${d.motivo}` : `cierra el hilo: ${d.motivo}`;
    out.push(`«${t.min} min antes» (${t.toque}): ${que}${marca ? ` · marca de #228: ${corto(marca.value, 40)}` : ''}`);
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Escrituras (compare-and-set)
// ═════════════════════════════════════════════════════════════════════════════════════════════════

/** UPDATE de una automatización con compare-and-set. Devuelve el `updated_at` que quedó, o false si cambió en el medio. */
async function escribirFila(ws: number, id: number, cambios: Record<string, unknown>, leido: { upd: string | null; rev?: number | null; vigente?: boolean; tocaUpd?: boolean }): Promise<string | null | false> {
  const ahora = new Date().toISOString();
  let q = db.from('nutricion_secuencias').update(leido.tocaUpd === false ? cambios : { ...cambios, updated_at: ahora }).eq('id', id).eq('workspace_id', ws);
  q = leido.upd ? q.eq('updated_at', leido.upd) : q.is('updated_at', null);
  if (leido.rev !== undefined) q = leido.rev == null ? q.is('disparadores_rev', null) : q.eq('disparadores_rev', leido.rev);
  if (leido.vigente) q = q.is('archivada_at', null);
  const { data, error } = await q.select('id, updated_at');
  if (error) throw new Error(`escribir #${id}: ${error.message}`);
  const f = ((data ?? []) as Array<{ updated_at: string | null }>)[0];
  return f ? f.updated_at : false;
}

/** Re-arma SÓLO el camino 3 de una inscripción (el molde de `reactivarInscripcion`): compare-and-set sobre lo leído. */
async function rearmar(i: Insc, pasos: readonly PasoGrafo[], ahoraIso: string): Promise<boolean> {
  const idx = indicePorId(pasos, PLAN.IDS_AGENDO.e1440);
  const hilos = [{ h: PLAN.IDS_AGENDO.e1440, nodo: PLAN.IDS_AGENDO.e1440, proximo: ahoraIso }];
  let q = db.from('nutricion_inscripciones').update({
    estado: 'activa', hilos, hilos_rev: Number(i.hilos_rev ?? 0) + 1, nodo_actual: PLAN.IDS_AGENDO.e1440, paso_actual: idx,
    proximo_envio_at: ahoraIso, updated_at: ahoraIso,
  }).eq('id', i.id).eq('workspace_id', i.workspace_id).eq('estado', i.estado);
  q = i.updated_at ? q.eq('updated_at', i.updated_at) : q.is('updated_at', null);
  q = i.hilos_rev == null ? q.is('hilos_rev', null) : q.eq('hilos_rev', i.hilos_rev);
  const { data, error } = await q.select('id');
  if (error) throw new Error(`re-armar la inscripción ${i.id}: ${error.message}`);
  return ((data ?? []) as unknown[]).length > 0;
}

/** Pre-siembra 'completada' con la reunión de hoy: el motor no le vuelve a mandar el aviso ni la preparación. */
async function presembrar(ws: number, secId: number, leads: readonly Lead[], ahoraIso: string): Promise<number> {
  if (!leads.length) return 0;
  const filas = leads.map((l) => {
    const ms = reunionQuePreparaMs(l as never, Date.parse(ahoraIso));
    return {
      workspace_id: ws, lead_id: Number(l.id), secuencia_id: secId, estado: 'completada', paso_actual: 0, proximo_envio_at: null,
      reunion_at: ms == null ? null : new Date(ms).toISOString(), inscripto_at: ahoraIso, updated_at: ahoraIso,
    };
  });
  // UNIQUE (lead_id, secuencia_id): la que ya está (el motor la inscribió entre medio) se deja como está.
  const { data, error } = await db.from('nutricion_inscripciones').upsert(filas, { onConflict: 'lead_id,secuencia_id', ignoreDuplicates: true }).select('id');
  if (error) throw new Error(`pre-sembrar en #${secId}: ${error.message}`);
  return ((data ?? []) as unknown[]).length;
}

/** Lo que hace `archivarSecuencias` después de archivar: cancela las inscripciones vivas que quedaran. */
async function cancelarVivas(ws: number, secId: number): Promise<number> {
  const { data, error } = await db.from('nutricion_inscripciones').update({ estado: 'cancelada', updated_at: new Date().toISOString() })
    .eq('workspace_id', ws).eq('secuencia_id', secId).in('estado', ['activa', 'pendiente']).select('id');
  if (error) throw new Error(`cancelar inscripciones de #${secId}: ${error.message}`);
  return ((data ?? []) as unknown[]).length;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// --restaurar=<respaldo>
// ═════════════════════════════════════════════════════════════════════════════════════════════════

type Respaldo = {
  leido: string; secuencias: FilaFlujo[]; inscripciones: Insc[]; rearmar: number[]; claves_nuevas: Array<{ ws: number; clave: string }>; marcas: Marca[];
};

const COLS_RESTAURAR = ['nombre', 'activa', 'archivada_at', 'pasos', 'pasos_borrador', 'posiciones', 'trigger_tipo', 'etapa', 'etapas', 'funnel_id', 'producto_id', 'etiqueta_id', 'cron', 'cron_proxima_at', 'disparadores'] as const;

async function correrRestaurar(ruta: string): Promise<void> {
  console.log(`\n══ VOLVER ATRÁS desde ${ruta} — ${aplicar ? 'APLICANDO' : 'SIMULACRO (sólo lee)'} · ${new Date().toISOString()} ══`);
  const r = JSON.parse(readFileSync(ruta, 'utf8')) as Respaldo;
  if (!Array.isArray(r.secuencias) || r.secuencias.some((s) => !Array.isArray(s.pasos))) throw new Error('el respaldo no tiene las filas con sus pasos como lista: no se restaura nada');
  let paro = false;
  // Primero las inscripciones re-armadas: con los pasos viejos ya puestos, un hilo en u11e1440 el motor lo cerraría.
  for (const id of r.rearmar ?? []) {
    const antes = r.inscripciones.find((i) => i.id === id);
    if (!antes) continue;
    const { data } = await db.from('nutricion_inscripciones').select(COLS_INSC).eq('workspace_id', antes.workspace_id).eq('id', id).maybeSingle();
    const ahora = data as Insc | null;
    if (!ahora) { console.log(`  ✖ inscripción ${id} ya no está`); continue; }
    if (ahora.estado === antes.estado && ahora.nodo_actual === antes.nodo_actual && PLAN.estable(ahora.hilos ?? null) === PLAN.estable(antes.hilos ?? null)) { console.log(`  · inscripción ${id} ya está como en el respaldo`); continue; }
    console.log(`  → inscripción ${id}: ${ahora.estado} (${ahora.nodo_actual ?? '—'}) → ${antes.estado} (${antes.nodo_actual ?? '—'})`);
    if (aplicar && !paro) {
      const { data: d2, error } = await db.from('nutricion_inscripciones').update({
        estado: antes.estado, hilos: antes.hilos ?? null, hilos_rev: Number(ahora.hilos_rev ?? 0) + 1, nodo_actual: antes.nodo_actual, paso_actual: antes.paso_actual,
        proximo_envio_at: antes.proximo_envio_at, updated_at: new Date().toISOString(),
      }).eq('id', id).eq('workspace_id', antes.workspace_id).eq('updated_at', ahora.updated_at ?? '').select('id');
      if (error) throw new Error(`restaurar la inscripción ${id}: ${error.message}`);
      console.log(`  ${(d2 ?? []).length ? '✓' : '✖ cambió mientras tanto, no se pisó:'} inscripción ${id}`);
    }
  }
  for (const s of r.secuencias) {
    const ws = Number(s.workspace_id);
    const ahora = (await leerFilas(ws, [Number(s.id)])).get(Number(s.id));
    if (!ahora) { console.log(`  ✖ #${s.id} ya no existe en el ws${ws}`); paro = true; continue; }
    const cambios: Record<string, unknown> = {};
    for (const k of COLS_RESTAURAR) if (PLAN.estable((s as Record<string, unknown>)[k]) !== PLAN.estable((ahora as Record<string, unknown>)[k])) cambios[k] = (s as Record<string, unknown>)[k] ?? null;
    if (!Object.keys(cambios).length) { console.log(`  · #${s.id} «${s.nombre}» ya está como en el respaldo`); continue; }
    // La revisión del CRON SUBE (nunca vuelve al número de antes): el editor del CRON hace compare-and-set sobre ella.
    if ('disparadores' in cambios || 'trigger_tipo' in cambios) cambios.disparadores_rev = Number(ahora.disparadores_rev ?? 0) + 1;
    console.log(`  → #${s.id} «${ahora.nombre}» → «${s.nombre}»: ${Object.keys(cambios).join(', ')}`);
    if (aplicar && !paro) {
      const u = await escribirFila(ws, Number(s.id), cambios, { upd: ahora.updated_at, rev: ahora.disparadores_rev ?? null });
      if (u === false) { console.log(`  ✖ #${s.id} cambió mientras tanto: no se pisó`); paro = true; } else console.log(`  ✓ #${s.id} restaurada`);
    }
  }
  for (const n of r.claves_nuevas ?? []) {
    const f = await leerPorClave(n.ws, n.clave);
    if (!f || f.archivada_at) { console.log(`  · ws${n.ws} «${n.clave}»: ${f ? 'ya archivada' : 'no se creó'}`); continue; }
    console.log(`  → #${f.id} «${f.nombre}» (ws${n.ws}, la nueva): se ARCHIVA (cerrar no es borrar)`);
    if (aplicar && !paro) {
      const u = await escribirFila(n.ws, Number(f.id), { activa: false, archivada_at: new Date().toISOString() }, { upd: f.updated_at, vigente: true, tocaUpd: false });
      console.log(`  ${u === false ? '✖ cambió mientras tanto' : '✓ archivada'} · inscripciones canceladas: ${u === false ? 0 : await cancelarVivas(n.ws, Number(f.id))}`);
    }
  }
  console.log('  · las marcas mako.recordatorio-lead.* NO se tocan: son las que evitan el doble envío');
  console.log('  · las inscripciones pre-sembradas (\'completada\') quedan: no mandan nada');
  console.log(`\n${aplicar ? (paro ? '✖ PARÓ A MEDIAS' : '✓ RESTAURADO') : 'SIMULACRO de volver atrás'}`);
  if (aplicar && paro) process.exitCode = 1;
}

if (restaurar) {
  await correrRestaurar(restaurar);
  process.exit();
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 1. Medir
// ═════════════════════════════════════════════════════════════════════════════════════════════════

const AHORA = new Date();
const ahoraMs = AHORA.getTime();
console.log(`\n══ UNDÉCIMA TANDA · los flujos de prod — ${aplicar ? 'APLICANDO' : 'SIMULACRO (sólo lee, no escribe nada)'} · ${AHORA.toISOString()} ══`);

await leerEmbudos();
for (const [n, c] of Object.entries(CRON)) {
  const ws = n.endsWith('Ws1') ? WS1 : n.endsWith('Ws4') ? WS4 : WS13;
  const e = exigirEtapa(ws, c);
  if (e) frenos.push(`CRON ${n}: ${e}`);
  else console.log(`  ✓ ws${ws}: el CRON ofrece «${nombreEtapa(c.funnelId, c.etapa)}» (${c.etapa}, embudo ${c.funnelId})`);
}

const vivas = await leerVivas();
const fila = (id: number) => vivas.find((v) => Number(v.id) === id) ?? null;
const nueva13 = await leerPorClave(WS13, PLAN.claveAgendo(WS13));
console.log(`\n── Filas vivas (todos los negocios): ${vivas.length}`);
const eventosImprevistos: FilaFlujo[] = [];
for (const v of vivas) {
  const id = Number(v.id);
  const prev = PREVISTAS[id];
  const subs = disparadoresDe(v).map((d) => `${d.trigger_tipo}${d.subtipo ? `:${d.subtipo}` : ''}`).join(',');
  const mm = PLAN.usaMensajeMako(PLAN.pasosDeFila(v));
  console.log(`  ws${v.workspace_id} #${id} ${v.activa ? 'ON ' : 'off'} [${subs}] ${mm ? '{{mensaje_mako}} ' : ''}upd ${iso(v.updated_at)}${prev && iso(v.updated_at) !== prev.upd ? ` ≠ §3 (${prev.upd})` : ''} «${v.nombre}»`);
  if (prev) {
    if (Number(v.workspace_id) !== prev.ws) frenos.push(`#${id} es del ws${v.workspace_id}, no del ws${prev.ws}`);
    if (iso(v.updated_at) !== prev.upd) avisos.push(`#${id} cambió después del diseño (${iso(v.updated_at)}): se rehace sobre lo leído`);
    continue;
  }
  if (nueva13 && id === Number(nueva13.id)) continue;
  if (v.trigger_tipo === TRIGGER_AVISO_MAKO && mm) { eventosImprevistos.push(v); continue; }
  // Además del freno, se dice si está con las piezas de hoy (para que decida quien cierra).
  const forma = PLAN.chequearPropuesta({ tipo: 'reescribir', id, ws: Number(v.workspace_id), nombre: v.nombre, activa: v.activa, pasos: normalizar(PLAN.pasosDeFila(v)), disparadores: disparadoresDe(v), columnas: {}, cambiaCron: false, notas: [] });
  frenos.push(`fila viva NO PREVISTA: ws${v.workspace_id} #${id} «${v.nombre}» [${subs}] (${forma.length ? `fuera de lo de hoy: ${forma[0]}` : 'con las piezas de hoy'}): decide quien cierra`);
}
for (const [id, p] of Object.entries(PREVISTAS)) if (!fila(Number(id))) avisos.push(`#${id} (ws${p.ws}) ya no está viva (¿una corrida anterior la archivó?)`);

// Las inscripciones de todo lo que se toca, y los leads.
const SECS_WS1 = [198, 213, 228, 238, 239];
const SECS_WS13 = [223, 224, 240, ...(nueva13 ? [Number(nueva13.id)] : [])];
const SECS_WS4 = [209, 210];
const inscs1 = await leerInscs(WS1, SECS_WS1);
const inscs13 = await leerInscs(WS13, SECS_WS13);
const inscs4 = await leerInscs(WS4, SECS_WS4);
const leads1 = await leerLeadsAbiertos(WS1);
const leads13 = await leerLeadsAbiertos(WS13);
const conReunion = (ls: readonly Lead[]) => ls.filter((l) => reunionFuturaMs(l as never, ahoraMs) != null);
const leadsReunion1 = conReunion(leads1);
const leadsReunion13 = conReunion(leads13);
const inscsDeLeads = async (ws: number, ids: readonly number[]) => (ids.length
  ? leerTodo<Insc>('nutricion_inscripciones', COLS_INSC, (q) => q.eq('workspace_id', ws).in('lead_id', [...ids])) : Promise.resolve([] as Insc[]));
const inscsReunion = [...await inscsDeLeads(WS1, leadsReunion1.map((l) => Number(l.id))), ...await inscsDeLeads(WS13, leadsReunion13.map((l) => Number(l.id)))];
const leadDe = (ws: number, id: number): Lead | null => (ws === WS13 ? leads13 : leads1).find((l) => Number(l.id) === id) ?? null;
// Los de las re-armadas pueden no estar abiertos: se leen aparte.
async function leerLead(ws: number, id: number): Promise<Lead | null> {
  const { data, error } = await db.from('leads').select(COLS_LEAD).eq('workspace_id', ws).eq('id', id).maybeSingle();
  if (error) throw new Error(`leads ${id}: ${error.message}`);
  return (data as Lead | null) ?? null;
}
const marcas = [
  ...await leerMarcas(WS1, [...leadsReunion1.map((l) => Number(l.id)), ...inscs1.filter((i) => INSC_REARMAR.includes(i.id)).map((i) => i.lead_id)]),
  ...await leerMarcas(WS13, leadsReunion13.map((l) => Number(l.id))),
];
console.log(`  · inscripciones: ws1 ${inscs1.length} (vivas ${inscs1.filter((i) => VIVAS.has(i.estado)).length}), ws13 ${inscs13.length}, ws4 ${inscs4.length} · leads con reunión por delante: ws1 ${leadsReunion1.length}, ws13 ${leadsReunion13.length} · marcas del recordatorio: ${marcas.length}`);

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 2. Las propuestas (con sus validaciones) y el ANTES / DESPUÉS
// ═════════════════════════════════════════════════════════════════════════════════════════════════

type Paso = { etiqueta: string; fila: FilaFlujo | null; plan: Plan };
const planes = new Map<string, Paso>();
function mostrar(etiqueta: string, f: FilaFlujo | null, plan: Plan): void {
  planes.set(etiqueta, { etiqueta, fila: f, plan });
  console.log(`\n── ${etiqueta}${f ? ` · #${f.id} «${f.nombre}» (${f.archivada_at ? 'ARCHIVADA' : f.activa ? 'prendida' : 'pausada'})` : ''}`);
  if (!plan.ok) { console.log(`  ✖ ${plan.error}`); frenos.push(`${etiqueta}: ${plan.error}`); return; }
  const p = plan.propuesta;
  if (f) dibujar('ANTES', normalizar(PLAN.pasosDeFila(f)), disparadoresDe(f));
  if (p.tipo === 'archivar') {
    console.log(`  DESPUÉS: ${Object.keys(p.columnas).length ? 'ARCHIVADA (pausada; cerrar no es borrar)' : 'ya estaba archivada'}`);
    return;
  }
  if (Object.keys(p.columnas).length) dibujar(`DESPUÉS «${p.nombre}» (${p.activa ? 'prendida' : 'pausada'})`, p.pasos, p.disparadores);
  const problemas = PLAN.chequearPropuesta(p);
  console.log(`  ${ok(!problemas.length)} validarGrafo, frenoDelFlujo + datos, CRON, forma, un AI Step con objetivo, camposDelFlujo de ida y vuelta${problemas.length ? `:\n    - ${problemas.join('\n    - ')}` : ''}`);
  for (const x of problemas) frenos.push(`${etiqueta}: ${x}`);
  for (const x of p.notas) console.log(`  · ${x}`);
  const cols = Object.keys(p.columnas);
  console.log(`  → ${cols.length ? `${aplicar ? 'se escribe' : 'se escribiría'}: ${cols.join(', ')}${p.cambiaCron ? ` (CRON con disparadores_rev ${f?.disparadores_rev ?? 0} → ${p.columnas.disparadores_rev})` : ''}` : 'ya está como tiene que quedar: nada que escribir'}`);
}

const f213 = fila(213);
const f228 = fila(228);
mostrar('ws1 · Un Lead Agendó Llamada', f213, f213 ? PLAN.planAgendoWs1(f213, f228, CRON.agendoWs1) : { ok: false, error: '#213 no está viva' });
for (const id of [228, 239]) { const f = fila(id); if (f) mostrar(`ws1 · archivar #${id}`, f, PLAN.planArchivar(f, AHORA.toISOString())); }
const f198 = fila(198);
mostrar('ws1 · Un Lead Entró', f198, f198 ? PLAN.planBienvenidaWs1(f198, CRON.entroWs1) : { ok: false, error: '#198 no está viva' });
const f238 = fila(238);
if (f238) mostrar('ws1 · Felicitación (sólo su CRON)', f238, PLAN.planFelicitacion(f238));
mostrar('ws13 · Un Lead Agendó Llamada (NUEVA)', nueva13, PLAN.planAgendoNueva(WS13, CRON.agendoWs13, nueva13));
for (const id of [240, 223, 224]) { const f = fila(id); if (f) mostrar(`ws13 · archivar #${id}`, f, PLAN.planArchivar(f, AHORA.toISOString())); }
const f209 = fila(209);
if (f209) mostrar('ws4 · Un Lead Entró', f209, PLAN.planBienvenidaWs4(f209, CRON.entroWs4));
const f210 = fila(210);
if (f210) mostrar('ws4 · Un Lead Agendó Llamada', f210, PLAN.planAgendoWs4(f210, CRON.agendoWs4));
for (const f of eventosImprevistos) mostrar(`ws${f.workspace_id} · evento con {{mensaje_mako}} #${f.id}`, f, PLAN.reescribirEventoMako(f));

// Los ids nuevos de #213 no pueden ser de la historia (una inscripción vieja seguiría por la tarjeta nueva).
const p213 = planes.get('ws1 · Un Lead Agendó Llamada')?.plan;
if (f213 && p213?.ok) {
  const historia = await nodosDeLaHistoria(WS1, 213, inscs1);
  const viejos = new Set(PLAN.pasosDeFila(f213).map((p, i) => idDe(p, i)));
  const choca = PLAN.ORDEN_NUEVOS_AGENDO.filter((id) => !viejos.has(id) && historia.has(id));
  if (choca.length) frenos.push(`#213: los ids nuevos ${choca.join(', ')} ya los vio su historia`);
  console.log(`\n  ${ok(!choca.length)} los ids nuevos de #213 no están en su historia (${historia.size} ids vistos)`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 3. Las inscripciones: qué le pasa a cada una y cuándo sería su próximo envío
// ═════════════════════════════════════════════════════════════════════════════════════════════════

console.log('\n── Inscripciones');
const pasos213 = p213?.ok ? p213.propuesta.pasos : [];
const cambiaCron213 = !!(p213?.ok && p213.propuesta.cambiaCron);
// ws1: quien está en «Agenda R1» sin fila en #213 (con el CRON nuevo el barrido lo inscribiría y le saldrían el aviso y la preparación).
const enAgenda1 = enLaEtapa(leads1, CRON.agendoWs1, ahoraMs);
const sinFila213 = enAgenda1.filter((l) => !inscs1.some((i) => i.secuencia_id === 213 && i.lead_id === Number(l.id)));
const presiembra1 = cambiaCron213 ? sinFila213 : [];
console.log(`  · ws1 «${nombreEtapa(1, 'agenda')}»: ${enAgenda1.length} lead(s); sin fila en #213: ${sinFila213.length}${sinFila213.length ? ` (${sinFila213.map((l) => l.id).join(', ')})` : ''}`
  + `${presiembra1.length ? ' → se pre-siembran \'completada\' con su reunión' : cambiaCron213 ? '' : ' (el CRON ya es la etapa: el motor ya los ve; no se pre-siembra)'}`);
for (const l of presiembra1) console.log(`    lead ${l.id}: 'completada', reunion_at ${iso(reunionQuePreparaMs(l as never, ahoraMs))} → no le sale ni el aviso ni la preparación de esta reunión; con otra reunión, el reuso la vuelve a armar`);

const rearmables: Array<{ i: Insc; lead: Lead }> = [];
for (const i of inscs1.filter((x) => x.secuencia_id === 198 || x.secuencia_id === 213)) {
  const vive = VIVAS.has(i.estado);
  const re = INSC_REARMAR.includes(i.id);
  if (!vive && !re) continue;
  console.log(`  · ${i.id} (lead ${i.lead_id}, #${i.secuencia_id}, ${i.estado}${i.desenlace ? `, desenlace ${i.desenlace}` : ''}, nodo ${i.nodo_actual ?? '—'}, paso ${i.paso_actual}, reunión ${iso(i.reunion_at)}):`);
  if (i.secuencia_id === 198) {
    const p198 = planes.get('ws1 · Un Lead Entró')?.plan;
    const despues = p198?.ok ? p198.propuesta.pasos : [];
    const k = indiceActual(despues, i);
    console.log(`    no se toca: ${i.estado === 'respondio' && !i.proximo_envio_at ? 'inerte (el motor no levanta una \'respondio\' sin carril)' : 'sigue como está'} · su paso ${i.paso_actual} pasa a ser ${k >= 0 ? idDe(despues[k], k) : '—'}`);
    continue;
  }
  const lead = await leerLead(WS1, i.lead_id);
  if (!lead) { console.log('    ✖ el lead no está'); frenos.push(`inscripción ${i.id}: el lead ${i.lead_id} no está`); continue; }
  if (!pasos213.length) { console.log('    (sin el plan de #213 no se puede decir)'); continue; }
  const r = proximaReunion(lead as never, ahoraMs, { estricta: true });
  const yaEsta = Array.isArray(i.hilos) && (i.hilos as Array<{ h?: unknown }>).some((h) => h?.h === PLAN.IDS_AGENDO.e1440);
  if (yaEsta) { console.log('    ya está re-armada (hilo del camino 3): nada que escribir'); continue; }
  if (!r) { console.log('    sin reunión con hora por delante: NO se re-arma (no tiene recordatorios que mandar)'); continue; }
  console.log(`    → re-arma SÓLO el camino 3: 'activa', hilos [${PLAN.IDS_AGENDO.e1440}], el desenlace ${i.desenlace ?? '—'} no se toca`);
  for (const x of lineaDelCarril(pasos213, lead, marcas.filter((m) => Number(m.workspace_id) === WS1), ahoraMs)) console.log(`      ${x}`);
  rearmables.push({ i, lead });
}
for (const id of INSC_REARMAR) if (!inscs1.some((i) => i.id === id)) avisos.push(`la inscripción ${id} no está en #213`);

// ws13: cada lead en «Pre R1» (la fila es nueva: sin esto, un «Nuevo agendado» viejo por cada uno).
const p13 = planes.get('ws13 · Un Lead Agendó Llamada (NUEVA)')?.plan;
const creaNueva = !!(p13?.ok && p13.propuesta.tipo === 'crear');
const enAgenda13 = enLaEtapa(leads13, CRON.agendoWs13, ahoraMs);
const presiembra13 = creaNueva || (nueva13 && !nueva13.activa && !nueva13.archivada_at)
  ? enAgenda13.filter((l) => !inscs13.some((i) => nueva13 && i.secuencia_id === Number(nueva13.id) && i.lead_id === Number(l.id)))
  : [];
console.log(`  · ws13 «${nombreEtapa(6, 'agenda')}»: ${enAgenda13.length} lead(s) (${enAgenda13.map((l) => l.id).join(', ') || '—'})${presiembra13.length ? ' → se pre-siembran \'completada\' con su reunión ANTES de prender la fila nueva' : ''}`);
for (const l of presiembra13) console.log(`    lead ${l.id}: 'completada', reunion_at ${iso(reunionQuePreparaMs(l as never, ahoraMs))} → no le sale el «Nuevo agendado» viejo`);
for (const i of inscs13.filter((x) => VIVAS.has(x.estado))) console.log(`  · ${i.id} (lead ${i.lead_id}, #${i.secuencia_id}, ${i.estado}): ${[223, 224, 240].includes(i.secuencia_id) ? 'se CANCELA al archivar su fila' : 'sigue'}`);
for (const i of inscs4.filter((x) => VIVAS.has(x.estado))) console.log(`  · ${i.id} (lead ${i.lead_id}, #${i.secuencia_id}, ${i.estado}): ws4, pausada; ⚠ su nodo puede cambiar`);
// M2: la nueva y #213 preparan una reunión (por el tipo de la etapa del CRON): el reuso al reagendar sigue.
if (p213?.ok) console.log(`  · #213 ${preparaReunion({ trigger_tipo: p213.propuesta.disparadores[0].trigger_tipo, etapa: p213.propuesta.disparadores[0].etapa, disparadores: p213.propuesta.disparadores, pasos: p213.propuesta.pasos }) ? 'prepara una reunión (M2): reunion_at al inscribir y reuso al reagendar' : '✖ NO prepara una reunión: revisar M2'}`);

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 4. El respaldo (con --aplicar se escribe y se relee ANTES de escribir nada)
// ═════════════════════════════════════════════════════════════════════════════════════════════════

const RESPALDO = `backups/undecima-flujos-${AHORA.toISOString().replace(/[:.]/g, '-')}.json`;
const filasRespaldo = vivas.filter((v) => PREVISTAS[Number(v.id)] || eventosImprevistos.includes(v));
const inscsRespaldo = [...new Map([...inscs1, ...inscs13, ...inscs4, ...inscsReunion].map((i) => [i.id, i])).values()];
const respaldo: Respaldo & { ws: number[] } = {
  ws: [...WORKSPACES], leido: AHORA.toISOString(), secuencias: filasRespaldo, inscripciones: inscsRespaldo,
  rearmar: rearmables.map((x) => x.i.id), claves_nuevas: creaNueva ? [{ ws: WS13, clave: PLAN.claveAgendo(WS13) }] : [], marcas,
};
const respaldoTexto = JSON.stringify(respaldo, null, 1);
function guardarRespaldo(): void {
  mkdirSync('backups', { recursive: true });
  writeFileSync(RESPALDO, respaldoTexto, 'utf8');
  const vuelta = JSON.parse(readFileSync(RESPALDO, 'utf8')) as Respaldo;
  const malas = filasRespaldo.flatMap((s) => {
    const r = (vuelta.secuencias ?? []).find((x) => Number(x?.id) === Number(s.id));
    if (!r) return [`#${s.id} no está`];
    if (!Array.isArray(r.pasos) || r.pasos.length !== PLAN.pasosDeFila(s).length) return [`#${s.id}: sus pasos no son la lista leída`];
    if (r.updated_at !== s.updated_at) return [`#${s.id}: otro updated_at`];
    return [];
  });
  if ((vuelta.inscripciones ?? []).length !== inscsRespaldo.length) malas.push('las inscripciones no son las leídas');
  if ((vuelta.marcas ?? []).length !== marcas.length) malas.push('las marcas no son las leídas');
  if (malas.length) throw new Error(`el respaldo ${RESPALDO} no sirve (${malas.join(' · ')}): no se escribió nada`);
  console.log(`  ✓ respaldo releído: ${RESPALDO} (${filasRespaldo.length} filas, ${inscsRespaldo.length} inscripciones, ${marcas.length} marcas)`);
}
console.log(`\n── Respaldo: ${filasRespaldo.length} filas enteras, ${inscsRespaldo.length} inscripciones, ${marcas.length} marcas (${respaldoTexto.length} caracteres) → ${RESPALDO}${aplicar ? '' : ' (sólo con --aplicar)'}`);

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 5. Escribir (sólo con --aplicar y sin ningún freno). Cada paso depende del anterior.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

let paro: string | null = null;
const PARO = 'cambió mientras tanto: no se pisó. Vuelve a correr el simulacro y después --aplicar (sigue donde quedó)';
const escritos: number[] = [];
let creada: number | null = nueva13 ? Number(nueva13.id) : null;

async function escribirPropuesta(etiqueta: string): Promise<void> {
  if (paro) return;
  const x = planes.get(etiqueta);
  if (!x?.plan.ok || !x.fila) return;
  const p = x.plan.propuesta;
  if (!Object.keys(p.columnas).length) return;
  const vigente = p.tipo === 'archivar';
  const u = await escribirFila(Number(x.fila.workspace_id), Number(x.fila.id), p.columnas, {
    upd: x.fila.updated_at, ...(p.cambiaCron ? { rev: x.fila.disparadores_rev ?? null } : {}), vigente, tocaUpd: !vigente,
  });
  if (u === false) { paro = `${etiqueta} ${PARO}`; return; }
  escritos.push(Number(x.fila.id));
  console.log(`  ✓ ${etiqueta}: ${Object.keys(p.columnas).join(', ')}`);
  if (vigente) console.log(`    inscripciones canceladas: ${await cancelarVivas(Number(x.fila.workspace_id), Number(x.fila.id))}`);
}

if (aplicar && frenos.length) console.log(`\n══ NO SE ESCRIBE NADA: hay ${frenos.length} freno(s) ══`);
if (aplicar && !frenos.length) {
  console.log('\n══ ESCRIBIENDO ══');
  guardarRespaldo();
  const ahoraIso = () => new Date().toISOString();
  // ws1: pre-siembra ANTES del CRON nuevo (si no, el barrido de la hora los inscribe y les manda el aviso).
  if (presiembra1.length) console.log(`  ✓ ws1: ${await presembrar(WS1, 213, presiembra1, ahoraIso())} inscripción(es) pre-sembradas en #213`);
  await escribirPropuesta('ws1 · Un Lead Agendó Llamada');
  // Las 201 y 202, recién con los pasos nuevos escritos (su nodo tiene que existir).
  if (!paro && escritos.includes(213) || (!paro && p213?.ok && !Object.keys(p213.propuesta.columnas).length)) {
    for (const { i } of rearmables) {
      if (paro) break;
      if (await rearmar(i, pasos213, ahoraIso())) console.log(`  ✓ inscripción ${i.id}: re-armada en el camino 3`);
      else paro = `inscripción ${i.id} ${PARO}`;
    }
  }
  // #228 y #239 en la MISMA corrida que #213: el camino 2 y el 3 ya los reemplazan.
  await escribirPropuesta('ws1 · archivar #228');
  await escribirPropuesta('ws1 · archivar #239');
  await escribirPropuesta('ws1 · Un Lead Entró');
  await escribirPropuesta('ws1 · Felicitación (sólo su CRON)');
  // ws13: la fila nueva NACE PAUSADA; se pre-siembra y RECIÉN AHÍ se prende (sin carrera con el barrido).
  if (!paro && creaNueva && p13?.ok) {
    const { data, error } = await db.from('nutricion_secuencias').insert({ ...p13.propuesta.columnas, activa: false, updated_at: ahoraIso() }).select('id, updated_at').single();
    if (error || !data) throw new Error(`crear la fila del ws13: ${error?.message ?? 'no se creó'}`);
    creada = Number((data as { id: number }).id);
    console.log(`  ✓ ws13: #${creada} «${p13.propuesta.nombre}» creada (pausada)`);
  }
  if (!paro && creada != null && presiembra13.length) console.log(`  ✓ ws13: ${await presembrar(WS13, creada, presiembra13, ahoraIso())} inscripción(es) pre-sembradas`);
  if (!paro && creada != null) {
    const f = (await leerFilas(WS13, [creada])).get(creada);
    if (f && !f.activa && !f.archivada_at) {
      const u = await escribirFila(WS13, creada, { activa: true }, { upd: f.updated_at });
      if (u === false) paro = `ws13 #${creada} (prender) ${PARO}`; else console.log(`  ✓ ws13: #${creada} prendida`);
    }
  }
  for (const id of [240, 223, 224]) await escribirPropuesta(`ws13 · archivar #${id}`);
  await escribirPropuesta('ws4 · Un Lead Entró');
  await escribirPropuesta('ws4 · Un Lead Agendó Llamada');
  for (const f of eventosImprevistos) await escribirPropuesta(`ws${f.workspace_id} · evento con {{mensaje_mako}} #${f.id}`);
  if (paro) console.log(`  ✖ PARÓ: ${paro}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 6. Releer y comprobar (con --aplicar, la base; en el simulacro, lo que se escribiría)
// ═════════════════════════════════════════════════════════════════════════════════════════════════

console.log(`\n══ COMPROBACIÓN FINAL — ${aplicar && !frenos.length ? 'releída de la base' : 'sobre lo que se ESCRIBIRÍA (la base no cambió)'} ══`);
const finales: string[] = [];
const marca = (b: boolean, texto: string) => { console.log(`  ${ok(b)} ${texto}`); if (!b) finales.push(texto); };
const releidas = aplicar && !frenos.length
  ? new Map<number, FilaFlujo>([...(await leerFilas(WS1, SECS_WS1)), ...(await leerFilas(WS13, [...SECS_WS13, ...(creada != null ? [creada] : [])])), ...(await leerFilas(WS4, SECS_WS4)),
    ...(await Promise.all([...new Set(eventosImprevistos.map((f) => Number(f.workspace_id)))].map((ws) => leerFilas(ws, eventosImprevistos.filter((f) => Number(f.workspace_id) === ws).map((f) => Number(f.id)))))).flatMap((m) => [...m])])
  : null;
const despues = (etiqueta: string, id: number | null): FilaFlujo | null => {
  if (id == null) return null;
  if (releidas) return releidas.get(id) ?? null;
  const x = planes.get(etiqueta);
  if (!x?.plan.ok) return x?.fila ?? null;
  return x.fila ? PLAN.filaDespues(x.fila, x.plan.propuesta) : ({ ...(x.plan.propuesta.columnas as object), id: -1, updated_at: null, archivada_at: null } as unknown as FilaFlujo);
};
const reescritas: Array<[string, number | null]> = [
  ['ws1 · Un Lead Agendó Llamada', 213], ['ws1 · Un Lead Entró', 198], ['ws1 · Felicitación (sólo su CRON)', 238],
  ['ws13 · Un Lead Agendó Llamada (NUEVA)', creada ?? (creaNueva ? -1 : null)], ['ws4 · Un Lead Entró', 209], ['ws4 · Un Lead Agendó Llamada', 210],
  ...eventosImprevistos.map((f) => [`ws${f.workspace_id} · evento con {{mensaje_mako}} #${f.id}`, Number(f.id)] as [string, number]),
];
for (const [etiqueta, id] of reescritas) {
  const f = despues(etiqueta, id);
  const x = planes.get(etiqueta);
  if (!f || !x?.plan.ok) { if (x) marca(false, `${etiqueta}: no se puede comprobar`); continue; }
  marca(Array.isArray(f.pasos) && (f.disparadores == null || Array.isArray(f.disparadores)), `${etiqueta}: pasos y CRON se leen como lista (no como texto)`);
  const pr: Propuesta = { ...x.plan.propuesta, pasos: PLAN.pasosDeFila(f), disparadores: disparadoresDe(f) };
  const problemas = PLAN.chequearPropuesta(pr);
  marca(!problemas.length, `${etiqueta}: pasa las validaciones${problemas.length ? ` (${problemas[0]})` : ''}`);
  const re = etiqueta === 'ws1 · Un Lead Agendó Llamada' ? PLAN.planAgendoWs1(f, null, CRON.agendoWs1)
    : etiqueta === 'ws1 · Un Lead Entró' ? PLAN.planBienvenidaWs1(f, CRON.entroWs1)
      : etiqueta.startsWith('ws4 · Un Lead Entró') ? PLAN.planBienvenidaWs4(f, CRON.entroWs4)
        : etiqueta.startsWith('ws4 · Un Lead Agendó') ? PLAN.planAgendoWs4(f, CRON.agendoWs4)
          : etiqueta.startsWith('ws1 · Felicitación') ? PLAN.planFelicitacion(f)
            : etiqueta.includes('evento') ? PLAN.reescribirEventoMako(f)
              : etiqueta.startsWith('ws13 · Un Lead Agendó') ? PLAN.planAgendoNueva(WS13, CRON.agendoWs13, f) : null;
  if (re) marca(re.ok && !Object.keys(re.propuesta.columnas).length, `${etiqueta}: idempotente (otra corrida no cambia nada)${re.ok ? '' : `: ${re.error}`}`);
}
for (const id of [228, 239, 240, 223, 224]) {
  const etq = [228, 239].includes(id) ? `ws1 · archivar #${id}` : `ws13 · archivar #${id}`;
  if (!planes.has(etq)) continue;
  const f = despues(etq, id);
  marca(!!f?.archivada_at && f.activa === false, `#${id} archivada y pausada`);
}
if (pasos213.length) {
  for (const { i } of rearmables) {
    if (releidas) {
      const { data } = await db.from('nutricion_inscripciones').select(COLS_INSC).eq('workspace_id', WS1).eq('id', i.id).maybeSingle();
      const r = data as Insc | null;
      marca(!!r && r.estado === 'activa' && r.nodo_actual === PLAN.IDS_AGENDO.e1440 && r.desenlace === i.desenlace, `inscripción ${i.id}: activa en el camino 3, desenlace intacto`);
    } else marca(indicePorId(pasos213, PLAN.IDS_AGENDO.e1440) >= 0, `inscripción ${i.id}: ${PLAN.IDS_AGENDO.e1440} existe en #213 (índice ${indicePorId(pasos213, PLAN.IDS_AGENDO.e1440)})`);
  }
  // El camino 3, como lo lee el motor: 1440 / 60 / 15 por `minutosAntesDeReunion`; la preparación y el aviso, no.
  const mins = PLAN.TOQUES_AGENDO.map((t) => minutosAntesDeReunion(pasos213, indicePorId(pasos213, t.toque)));
  marca(mins.join('/') === '1440/60/15', `#213: el carril da ${mins.join('/')} min antes de la reunión`);
  const fuera = [PLAN.IDS_213.mensaje, PLAN.IDS_213.noConfirmo, PLAN.IDS_AGENDO.aviso].map((id) => minutosAntesDeReunion(pasos213, indicePorId(pasos213, id)));
  marca(fuera.every((m) => m == null), `#213: o1, ne9jyr0 y el aviso no son del carril (${fuera.map(String).join('/')})`);
  marca(pasos213.filter((p) => esPasoIA(p)).length === 1, '#213: un solo AI Step');
}

// ── Resumen ─────────────────────────────────────────────────────────────────────────────────────

if (avisos.length) console.log(`\n⚠ A saber:\n  - ${avisos.join('\n  - ')}`);
if (frenos.length) console.log(`\n✖ FRENOS (con alguno, --aplicar no escribe NADA):\n  - ${frenos.join('\n  - ')}`);
if (!aplicar) {
  console.log('\nLo que este simulacro NO puede comprobar sin escribir:');
  console.log('  - que nadie guarde en el medio: lo decide el compare-and-set al escribir (si cambió, --aplicar para y lo dice);');
  console.log('  - que el motor desplegado sea el de las olas 1-3 (sin él, NO correr --aplicar);');
  console.log('  - lo obligatorio de cada «⚡ Acción» del registro (`faltanEnPaso`): las de estos flujos son «MaKo en WhatsApp» y la etiqueta de siempre;');
  console.log('  - cómo se ve en el lienzo: eso lo mira Martín.');
}
console.log(`\n${aplicar ? (frenos.length ? '✖ NO SE ESCRIBIÓ NADA' : paro ? '✖ PARÓ A MEDIAS' : finales.length ? '✖ ESCRITO, PERO LA COMPROBACIÓN FINAL FALLA' : '✓ LISTO') : 'SIMULACRO'}`
  + ` · frenos: ${frenos.length} · comprobaciones que fallan: ${finales.length}`);
if (aplicar && (frenos.length || paro || finales.length)) process.exitCode = 1;
