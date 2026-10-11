// =============================================================================
// novena-tanda-ws1 — las dos post-agenda del ws1 en UNA, y sus «Si responde» a AI STEP (novena tanda)
// =============================================================================
// Pedido de Martín (10/10/2026, novena tanda): las dos automatizaciones de «agendó» del ws1 (Mauricio, un
// CLIENTE) son el mismo flujo nodo por nodo y sólo cambian el audio; se unifican en la #213, y lo que cuelga
// de cada «Si responde» pasa a un AI Step («Todo lo que hiciste de una cantidad impresionante de flujos y
// tarjetas eso justamente debería estar en una nueva tarjeta que sea "AI Step"»). El relevo de la corrida de
// lectura (10/10 22:30) midió los dos flujos y el orden en que esto se puede hacer sin mandar dos audios.
//
// Qué hace, SÓLO sobre workspace_id = 1:
//   1. #213 «Agendó sin haber hablado contigo»: entre la espera `nvlvg08` (60 min) y el audio `o0` (audio 7)
//      inserta una condición «Ya le escribiste» (`campo: 'ya_contactado'`): «sí» → un audio NUEVO copiado
//      del `o0` de la #212 (audio 5, su texto, sale solo, no oficial) que sigue en `nh92v3h`; «si no» → `o0`.
//      Los dos nodos nuevos van al FINAL del array.
//   2. #213: su «Si responde» `nb7dt1y` pasa a AI Step (`respuestaAPasoIA`, lib/paso-ia-convertir.ts:
//      conserva el id del nodo y los de los casos, y saca sus tarjetas hijas). Si el conversor dice que no,
//      NO se escribe NADA de la #213 (ni la condición, ni los CRON, ni el nombre).
//   3. #198 «Bienvenida»: su «Si responde» `n1b5m7i` (sin casos, «otra cosa» → aviso) pasa a AI Step igual.
//   4. Archiva la #212 (`archivarSecuencias`, lib/secuencias-huecos.ts) y RECIÉN DESPUÉS le guarda a la #213
//      los dos CRON (`guardarDisparadores`, lib/disparadores-guardar.ts): d1 = agendado_primer_contacto en las
//      columnas, d2 = agendado_ya_contactado en la lista.
//   5. Renombra la #213 a «Agendó una reunión» (`renombrarSecuencia`, lib/setting-secuencias.ts).
//   6. Relee y comprueba: la inscripción 202 sigue en `o1` y ese nodo existe en el mismo índice; la #213 y la
//      #198 pasan `validarGrafo` y el freno de Publicar (`frenoDelFlujo`) en su forma guardada; el AI Step
//      expandido da los mismos casos con la misma guía que las tarjetas de antes; la #212 quedó archivada; la
//      #213 tiene 2 CRON con `disparadores_rev` subido.
//
//   npx tsx scripts/novena-tanda-ws1.mts              → SIMULACRO (default): sólo lee e imprime
//   npx tsx scripts/novena-tanda-ws1.mts --simular    → lo mismo, dicho explícito
//   npx tsx scripts/novena-tanda-ws1.mts --aplicar    → escribe (lo decide quien cierra la tanda)
//   opciones: --env=<ruta del .env.local> (default ./.env.local)
//
// ⚠️ NO SE CORRE CON --aplicar ANTES DE DESPLEGAR EL MOTOR QUE ENTIENDE EL AI STEP. El de producción de hoy no
// conoce `paso_ia`: lee un «Si responde» cuyos casos no tienen nada debajo y sin «Otra cosa», o sea que la
// respuesta de un lead no se contesta ni se avisa. Primero el código, después la base.
//
// ⚠️ EL ORDEN DEL PASO 4 ES PARTE DEL ARREGLO. Con el CRON d2 puesto y la #212 todavía viva, el evento
// inscribe al mismo lead en las dos (dos vistas de «ya le escribiste» de secuencias distintas: `unaPorSecuencia`
// no las junta y la exclusión de familia se pregunta antes de insertar, lib/nutricion.ts) y le llegan dos
// audios. Archivada la #212, mientras no está d2 el que ya habló con el negocio no entra por evento: lo levanta
// el barrido siguiente (la cohorte sigue siendo la J1 futura). Y el PRIMER CRON tiene que seguir siendo de la
// familia post-agenda: de la columna salen «la reunión ya pasó» (`preparaUnaReunion`) y la exclusión.
//
// ⚠️ LOS IDS QUE NO PUEDEN CAMBIAR: la inscripción 202 (lead 2636) está en `o1` y su próximo envío es el
// 11/10 14:00 UTC. El motor la ubica por `nodo_actual` (`indiceActual`, lib/nutricion-grafo-motor.ts): un id que
// ya no existe la CIERRA. Quedan `o0`, `o1`, `n4z5uil`, `ne9jyr0`, `nvlvg08`, `nh92v3h`, `nb7dt1y` y los ids de
// sus casos; y los nodos nuevos van al final para que `paso_actual` siga coincidiendo con su índice.
//
// ⚠️ ESCRIBE CON LA SERVICE ROLE, sin `server-only` (el patrón de scripts/quitar-ir-a.mts): `setSecuenciaPasos`,
// `guardarDisparadores` y `archivarSecuencias` cuelgan de `getTenantDb`, que un script no puede importar. Así
// que se valida con las funciones PURAS que usan ellas (`camposDelFlujo`, `validarGrafo`, `frenoDelFlujo`,
// `problemaDeDisparadores`, `disparadoresDe`, `columnasDeDisparador`, `conProximas`) y se escribe a mano:
// cada lectura y escritura filtra `workspace_id = 1`, y cada escritura es compare-and-set sobre `updated_at`
// (y sobre `disparadores_rev` la de los CRON). Si alguien guardó en el medio, no se pisa: se para y se dice.
//
// ⚠️ IDEMPOTENTE: un paso que ya está hecho se saltea (la condición ya puesta, el AI Step ya convertido, la
// #212 ya archivada, los CRON ya guardados, el nombre ya puesto). Si una corrida con --aplicar se corta a
// mitad, la siguiente sigue donde quedó.
//
// ⚠️ LOS IDS NUEVOS SON DETERMINÍSTICOS (`nuevoId` con un sorteo de semilla fija), así el simulacro muestra
// EXACTAMENTE los que escribiría --aplicar. No chocan con ninguno del flujo ni con ninguno que la historia de
// la secuencia haya visto (`nodo_actual` y `hilos` de sus inscripciones, `nodo_id` de sus envíos): un id
// reusado haría que una inscripción vieja siguiera por la tarjeta nueva.
//
// PROBADO ROMPIÉNDOLO (10/10/2026, en copias del scratchpad y en simulacro; el original no se tocó): 12 roturas,
// 12 frenadas por su motivo y 0 en verde; la copia sin romper, «frenos: ninguno · comprobaciones que fallan: 0».
// Las roturas: los CRON al revés (d2 primero), los nodos nuevos al PRINCIPIO del array (el `paso_actual` de la
// 202 deja de ser su índice), la 202 parada en una tarjeta que sale, un caso del AI Step sin «sale sola», un tono
// en blanco que el saneo borra, `o1` cambiado, el conversor que dice que no, la #212 con una inscripción viva,
// otra automatización viva de la familia, el `o0` de la #212 con otro audio, los CRON de la #213 cambiados por
// otro, y un borrador sin publicar en la #213. Lo que NO se pudo probar sin escribir: el compare-and-set.
//
// ⚠️ CON --aplicar, ANTES DE ESCRIBIR NADA GUARDA LAS TRES FILAS ENTERAS en `backups/` (revisión de la novena
// tanda). VOLVER ATRÁS DESPUÉS DE --aplicar ROMPE LA #213 Y LA #198: el motor de antes lee el AI Step como un
// «Si responde» con casos sin nada debajo y sin «Otra cosa» (no contesta, no manda solos «Confirma» ni «Quiere
// cambiar el día»: sólo llega el aviso genérico), y el primer guardado con el `camposDelFlujo` de antes BORRA
// `paso_ia` y las guías sin un error (su `validarGrafo` acepta un caso con nombre y «cuándo»). Lo único que
// devuelve la forma de siempre es lo que había: `pasos` (y `nombre`, `trigger_tipo`, `etapa`, `disparadores`,
// `disparadores_rev`, `archivada_at`) de cada fila del respaldo, escritos con compare-and-set. Si el respaldo no
// se puede escribir y releer, NO se escribe nada.
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { config } from 'dotenv';
import type { PasoGrafo } from '../lib/flujo-grafo';
import type { Disparador } from '../lib/disparadores';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
if (aplicar && process.argv.includes('--simular')) throw new Error('--aplicar y --simular a la vez: elige uno');
config({ path: arg('env') ?? '.env.local' });

const {
  claseDe, idDe, nodoPorId, normalizar, nuevoId, validarGrafo, validarParaGuardar, expandirPasoIA, esPasoIA,
  escenariosDeRespuesta, idOtraCosa, textoFila, puertosDe, indicePorId,
} = await import('../lib/flujo-grafo');
const { respuestaAPasoIA } = await import('../lib/paso-ia-convertir');
const { camposDelFlujo, RELLENO_CONTROL, indiceActual, irAEstaMisma } = await import('../lib/nutricion-grafo-motor');
const { frenoDelFlujo } = await import('../lib/flujo-conversacion');
const { puedePisarFlujo } = await import('../lib/flujo-legado');
const {
  sanearDisparadores, problemaDeDisparadores, disparadoresDe, columnasDeDisparador, conProximas, nuevosOCambiados,
  firmaLista, TOPE_DISPARADORES,
} = await import('../lib/disparadores');
const { FAMILIA_POST_AGENDA, TRIGGER_AGENDA_NUEVO, TRIGGER_AGENDA_CONOCIDO } = await import('../lib/nutricion-familias');
const { TOPE_NOMBRE_SECUENCIA } = await import('../lib/setting-estrategia');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pasa --env=<ruta del .env.local>)');
const db = createClient(url, key, { auth: { persistSession: false } });

// ── Lo que este script toca, y nada más ─────────────────────────────────────────────────────────

const WS = 1;
const SEC_NUEVO = 213;      // «Agendó sin haber hablado contigo»: la que queda
const SEC_CONOCIDO = 212;   // «Agendó después de tu bienvenida»: se archiva
const SEC_BIENVENIDA = 198; // «Bienvenida»: sólo su «Si responde»
const INSC_202 = 202;
const ESPERA_ENTRADA = 'nvlvg08';
const AUDIO_DE_SIEMPRE = 'o0';
const UNION = 'nh92v3h';
const RESP_NUEVO = 'nb7dt1y';
const RESP_BIENVENIDA = 'n1b5m7i';
const AUDIO_CONOCIDO = 5;
const INTOCABLES = ['o0', 'o1', 'n4z5uil', 'ne9jyr0', 'nvlvg08', 'nh92v3h', 'nb7dt1y'];
const NOMBRE_NUEVO = 'Agendó una reunión';
const CRON_OBJETIVO = [
  { id: 'd1', trigger_tipo: TRIGGER_AGENDA_NUEVO, etapa: 'postagenda' },
  { id: 'd2', trigger_tipo: TRIGGER_AGENDA_CONOCIDO },
];
// Sin horario en ninguno de los dos CRON, la zona no decide nada (`conProximas` sólo la usa con `cron`). Es
// `TZ_DEFAULT` (lib/timezone.ts), escrito acá porque ese módulo tiene `server-only`.
const TZ_SIN_HORARIO = 'America/Tijuana';
/** Una inscripción que todavía puede mandar o contestar algo. */
const VIVAS = new Set(['activa', 'pendiente', 'respondio', 'pausada', 'handoff']);

const COLS = 'id, workspace_id, nombre, clave, trigger_tipo, etapa, etapas, funnel_id, producto_id, etiqueta_id, cron, cron_proxima_at, '
  + 'activa, archivada_at, updated_at, pasos, pasos_borrador, posiciones, disparadores, disparadores_rev';

type Fila = {
  id: number; workspace_id: number; nombre: string; clave: string | null; trigger_tipo: string; etapa: string | null; etapas: unknown;
  funnel_id: number | null; producto_id: number | null; etiqueta_id: number | null; cron: unknown; cron_proxima_at: string | null;
  activa: boolean; archivada_at: string | null; updated_at: string | null; pasos: unknown; pasos_borrador: unknown; posiciones: unknown;
  disparadores: unknown; disparadores_rev: number | null;
};
type Insc = {
  id: number; lead_id: number; secuencia_id: number; estado: string; paso_actual: number; nodo_actual: string | null;
  hilos: unknown; proximo_envio_at: string | null;
};

// ── Utilidades ──────────────────────────────────────────────────────────────────────────────────

/** JSON con las claves ordenadas: dos nodos iguales dan el mismo texto aunque las claves vengan en otro orden. */
function estable(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
    : x));
}
const corto = (t: unknown, n = 60): string => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
};
const pasosDe = (f: Fila): PasoGrafo[] => (Array.isArray(f.pasos) ? (f.pasos as PasoGrafo[]) : []);
const nodosDeInsc = (i: Insc): string[] => [
  ...(i.nodo_actual ? [i.nodo_actual] : []),
  ...(Array.isArray(i.hilos) ? (i.hilos as Array<{ nodo?: unknown }>).flatMap((h) => (typeof h?.nodo === 'string' ? [h.nodo] : [])) : []),
];

/** Un sorteo con semilla (mulberry32): el simulacro y --aplicar sacan los MISMOS ids. */
function sorteoDe(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** `n` ids nuevos que no chocan con el flujo ni con la historia de la secuencia. */
function idsNuevos(pasos: readonly PasoGrafo[], historia: ReadonlySet<string>, n: number, semilla: number): string[] {
  const rnd = sorteoDe(semilla);
  const usados: PasoGrafo[] = [...pasos, ...[...historia].map((id) => ({ id }))];
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const id = nuevoId(usados, rnd);
    out.push(id);
    usados.push({ id });
  }
  return out;
}

/** Una tarjeta en una línea, para el antes / después. */
function lineaNodo(pasos: readonly PasoGrafo[], i: number): string {
  const p = pasos[i];
  const id = idDe(p, i);
  const sig = (s: string | null | undefined) => (s ? `→ ${s}` : '→ fin');
  const c = claseDe(p);
  if (c === 'esperar') return `${id}  espera ${p.espera?.minutos ?? '?'} min ${sig(p.siguiente)}`;
  if (c === 'condicion') {
    const ramas = (p.ramas ?? []).map((r) => `[${(r.filas ?? []).map((f) => textoFila(f)).join(' y ')}] ${sig(r.siguiente)}`).join(' · ');
    return `${id}  condición ${ramas} · si no ${sig(p.si_no)}`;
  }
  if (c === 'respuesta') {
    if (esPasoIA(p)) return `${id}  AI STEP · ${(p.casos ?? []).length} casos (${(p.casos ?? []).map((x) => x.id).join(', ') || 'ninguno'})${p.otra_aviso ? ` · «Otra cosa» avisa «${corto(p.otra_aviso, 40)}»` : ''}`;
    return `${id}  «Si responde» · ${(p.casos ?? []).map((x) => `«${corto(x.titulo, 28)}» ${sig(x.siguiente)}`).join(' · ') || 'sin casos'} · otra cosa ${sig(p.si_no)}`;
  }
  if (c === 'accion') {
    const a = p.accion as { operacion?: string; params?: { titulo?: string; mensaje?: string } } | null;
    return `${id}  acción ${a?.operacion ?? '?'} «${corto(a?.params?.titulo || a?.params?.mensaje, 40)}» ${sig(p.siguiente)}`;
  }
  if (c === 'mensaje') {
    const que = p.tipo === 'audio' ? `audio ${p.audio_id}` : p.tipo === 'ia' ? 'MaKo escribe' : 'texto';
    return `${id}  ${que} (${p.revisar === false ? 'sale solo' : p.revisar === true ? 'para revisar' : 'lo que diga la estrategia'}) «${corto(p.cuerpo, 44)}» ${sig(p.siguiente)}`;
  }
  return `${id}  ${c}`;
}
function imprimirFlujo(titulo: string, pasos: readonly PasoGrafo[]): void {
  console.log(`  ${titulo} (${pasos.length} tarjetas)`);
  pasos.forEach((_, i) => console.log(`    ${String(i).padStart(2)}  ${lineaNodo(pasos, i)}`));
}

/** Los campos del flujo que un paso trae, para compararlos con lo que deja el saneo. */
const CLAVES_FLUJO = ['id', 'siguiente', 'paralelos', 'nodo', 'espera', 'ramas', 'casos', 'suelta', 'si_no', 'paralelos_si_no', 'destino', 'revisar', 'paso_ia', 'instrucciones', 'otra_aviso'] as const;
/**
 * Lo que `setSecuenciaPasos` le BORRARÍA a cada tarjeta en el próximo guardado desde la pantalla: reconstruye
 * cada paso campo por campo con `camposDelFlujo` (la quinta puerta de AGENTS.md). Vacío = lo que se escribe
 * es su forma guardada, y Publicar después no le saca nada.
 */
function pierdeAlGuardar(pasos: readonly PasoGrafo[]): string[] {
  const out: string[] = [];
  pasos.forEach((p, i) => {
    const o = p as Record<string, unknown>;
    const propio = Object.fromEntries(CLAVES_FLUJO.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
    const saneado = camposDelFlujo(p);
    if (estable(propio) !== estable(saneado)) out.push(`${idDe(p, i)}: ${corto(estable(propio), 90)} → ${corto(estable(saneado), 90)}`);
  });
  return out;
}

/** El texto del aviso de «Otra cosa» que de verdad corre (en el flujo EXPANDIDO, como lo lee el motor). */
function avisoOtraCosa(pasos: readonly PasoGrafo[], resp: string): string | null {
  const exp = expandirPasoIA(pasos);
  const r = nodoPorId(exp, resp);
  if (!r) return null;
  const a = nodoPorId(exp, r.si_no ?? null);
  const m = (a?.accion as { params?: { mensaje?: unknown } } | null | undefined)?.params?.mensaje;
  return a ? (typeof m === 'string' ? m : '') : null;
}

// ── Las comprobaciones de un flujo (antes de escribir y después de releer) ─────────────────────────

type Chequeo = { frenos: string[] };

/**
 * TODO lo que tiene que valer sobre un flujo para escribirlo. Imprime cada chequeo y devuelve los frenos.
 *   · lo que impide guardar (`validarParaGuardar`) y publicar (`validarGrafo` + `frenoDelFlujo`);
 *   · que la forma escrita sea la guardada (`pierdeAlGuardar`: nada nuevo que el saneo borre);
 *   · lo que `setSecuenciaPasos` mira además y es puro (un «Ir a» a sí misma, una lista sin ids sobre un flujo);
 *   · que cada inscripción viva quede en la MISMA tarjeta (`indiceActual`) y sus hilos en tarjetas que existen;
 *   · que el AI Step, expandido, conteste lo mismo que las tarjetas de antes (`escenariosDeRespuesta`) y avise
 *     lo mismo en «Otra cosa».
 */
function chequearFlujo(secId: number, antes: readonly PasoGrafo[], despues: readonly PasoGrafo[], resp: string, inscs: readonly Insc[]): Chequeo {
  const frenos: string[] = [];
  const ok = (b: boolean) => (b ? '✓' : '✖');

  const g = validarParaGuardar(despues);
  console.log(`  ${ok(!g.length)} se puede guardar${g.length ? `: ${g.join(' · ')}` : ''}`);
  if (g.length) frenos.push(`#${secId} no se puede guardar: ${g[0]}`);
  const v = validarGrafo(despues);
  console.log(`  ${ok(!v.length)} validarGrafo${v.length ? `: ${v.join(' · ')}` : ': sin errores'}`);
  if (v.length) frenos.push(`#${secId} no pasa validarGrafo: ${v[0]}`);
  // Sin el catálogo de acciones (`faltanEnAccion` lo arma la pantalla con el registro): las acciones de estos
  // flujos son los «avisar al equipo» de siempre, sin tocar.
  const fr = frenoDelFlujo(despues);
  console.log(`  ${ok(!fr)} freno de Publicar (frenoDelFlujo)${fr ? `: ${fr.error} (tarjeta ${fr.tarjeta ?? '—'})` : ': nada'}`);
  if (fr) frenos.push(`#${secId}: Publicar frenaría con «${fr.error}»`);

  const perdidasAntes = new Set(pierdeAlGuardar(antes));
  const perdidas = pierdeAlGuardar(despues).filter((x) => !perdidasAntes.has(x));
  console.log(`  ${ok(!perdidas.length)} forma guardada: ${perdidas.length ? `el saneo le borraría ${perdidas.join(' · ')}` : 'el saneo de setSecuenciaPasos no le saca nada'}`);
  if (perdidas.length) frenos.push(`#${secId}: el próximo guardado desde la pantalla le borraría algo (${perdidas[0]})`);
  if (perdidasAntes.size) console.log(`    (lo de antes ya perdía: ${[...perdidasAntes].join(' · ')})`);
  const aSiMisma = irAEstaMisma(despues.map((p) => camposDelFlujo(p)), secId);
  if (aSiMisma.length) frenos.push(`#${secId}: un «Ir a» apunta a esta misma automatización`);
  if (!puedePisarFlujo(antes, despues)) frenos.push(`#${secId}: una lista sin ids no puede pisar un flujo de tarjetas`);

  // Las inscripciones vivas: la misma tarjeta antes y después.
  const vivas = inscs.filter((i) => VIVAS.has(i.estado));
  const ids = new Set(despues.map((p, i) => idDe(p, i)));
  for (const i of vivas) {
    const a = indiceActual(antes, i);
    const d = indiceActual(despues, i);
    const na = a >= 0 ? idDe(antes[a], a) : null;
    const nd = d >= 0 ? idDe(despues[d], d) : null;
    const hilosRotos = nodosDeInsc(i).filter((n) => !ids.has(n));
    const mismo = na === nd && nd != null && !hilosRotos.length;
    console.log(`  ${ok(mismo)} inscripción ${i.id} (lead ${i.lead_id}, ${i.estado}): antes en ${na ?? '—'} (índice ${a}), después en ${nd ?? '—'} (índice ${d})`
      + `${i.nodo_actual ? '' : ` · sin nodo_actual (paso_actual ${i.paso_actual})`}${hilosRotos.length ? ` · hilos en tarjetas que no quedan: ${hilosRotos.join(', ')}` : ''}`);
    if (!mismo) frenos.push(`#${secId}: la inscripción ${i.id} quedaría en otra tarjeta (${na ?? '—'} → ${nd ?? '—'})`);
    // Y si su `paso_actual` era el índice de su nodo, lo sigue siendo: por eso lo nuevo va al FINAL del array
    // (lo leen los que todavía cuentan por índice, como el `paso` de los envíos).
    const coincidia = !!i.nodo_actual && idDe(antes[i.paso_actual] ?? {}, i.paso_actual) === i.nodo_actual;
    if (coincidia && idDe(despues[i.paso_actual] ?? {}, i.paso_actual) !== i.nodo_actual) {
      console.log(`  ✖ inscripción ${i.id}: su paso_actual ${i.paso_actual} dejaría de ser el índice de ${i.nodo_actual}`);
      frenos.push(`#${secId}: el paso_actual de la inscripción ${i.id} dejaría de coincidir con su nodo (lo nuevo tiene que ir al final)`);
    }
  }
  if (!vivas.length) console.log('  · ninguna inscripción viva');

  // Lo que contesta: los casos, con su guía y si sale sola, iguales antes y después.
  const ea = escenariosDeRespuesta(antes);
  const ed = escenariosDeRespuesta(despues);
  const firma = (e: (typeof ea)[number]) => estable({ id: e.casoId, t: e.titulo, c: e.cuando, r: e.comoResponder, s: e.contestaSolo === true });
  const igual = ea.length === ed.length && ea.every((e, k) => firma(e) === firma(ed[k]));
  console.log(`  ${ok(igual)} contesta lo mismo: ${ea.length} caso(s) antes, ${ed.length} después${igual ? '' : ' — DISTINTOS'}`);
  if (!igual) frenos.push(`#${secId}: el AI Step no contestaría lo mismo que las tarjetas de antes`);
  const oa = avisoOtraCosa(antes, resp);
  const od = avisoOtraCosa(despues, resp);
  console.log(`  ${ok(oa === od)} «Otra cosa» avisa lo mismo: «${oa ?? '—'}» → «${od ?? '—'}»`);
  if (oa !== od) frenos.push(`#${secId}: «Otra cosa» avisaría distinto`);
  return { frenos };
}

/** El AI Step expandido: cada caso con su guía (lo que lee el redactor) y si sale solo. */
function imprimirExpansion(pasos: readonly PasoGrafo[], resp: string): void {
  const r = nodoPorId(pasos, resp);
  if (!r || !esPasoIA(r)) { console.log(`    ✖ ${resp} no es un AI Step`); return; }
  const exp = expandirPasoIA(pasos);
  const re = nodoPorId(exp, resp);
  for (const c of re?.casos ?? []) {
    const m = nodoPorId(exp, c.siguiente ?? null);
    const contesta = m && claseDe(m) === 'mensaje' ? m : null;
    const avisa = (contesta ? nodoPorId(exp, contesta.siguiente ?? null) : m) ?? null;
    console.log(`    · «${c.titulo}» → ${contesta ? `${contesta.id} (${contesta.revisar === false ? 'sale sola' : 'para revisar'}) guía «${corto(contesta.cuerpo, 70)}»` : 'no contesta'}`
      + `${avisa && claseDe(avisa) === 'accion' ? ` + aviso ${avisa.id}` : ''}`);
  }
  if (!(re?.casos ?? []).length) console.log('    · sin casos: toda respuesta va a «Otra cosa»');
  console.log(`    · «Otra cosa» → ${idOtraCosa(resp)} avisa «${avisoOtraCosa(pasos, resp) ?? '—'}»`);
}

// ── Lecturas ────────────────────────────────────────────────────────────────────────────────────

async function leerSecuencias(): Promise<Map<number, Fila>> {
  const { data, error } = await db.from('nutricion_secuencias').select(COLS)
    .eq('workspace_id', WS).in('id', [SEC_BIENVENIDA, SEC_CONOCIDO, SEC_NUEVO]);
  if (error) throw new Error(`nutricion_secuencias: ${error.message}`);
  return new Map(((data ?? []) as unknown as Fila[]).map((f) => [f.id, f]));
}
async function leerInscripciones(): Promise<Insc[]> {
  const { data, error } = await db.from('nutricion_inscripciones')
    .select('id, lead_id, secuencia_id, estado, paso_actual, nodo_actual, hilos, proximo_envio_at')
    .eq('workspace_id', WS).in('secuencia_id', [SEC_BIENVENIDA, SEC_CONOCIDO, SEC_NUEVO]).order('id', { ascending: true });
  if (error) throw new Error(`nutricion_inscripciones: ${error.message}`);
  return (data ?? []) as Insc[];
}
/** Los ids de tarjeta que la historia de una secuencia ya vio (para que un id nuevo no reuse uno). */
async function nodosDeLaHistoria(secId: number, inscs: readonly Insc[]): Promise<Set<string>> {
  const out = new Set<string>(inscs.filter((i) => i.secuencia_id === secId).flatMap(nodosDeInsc));
  // Paginado por id: la Bienvenida lleva meses mandando y PostgREST corta en 1000 sin decirlo.
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from('nutricion_envios').select('id, nodo_id')
      .eq('workspace_id', WS).eq('secuencia_id', secId).not('nodo_id', 'is', null)
      .order('id', { ascending: true }).range(desde, desde + 999);
    if (error) throw new Error(`nutricion_envios #${secId}: ${error.message}`);
    for (const r of (data ?? []) as Array<{ nodo_id: string }>) out.add(r.nodo_id);
    if ((data ?? []).length < 1000) break;
  }
  return out;
}
/** Las demás automatizaciones del ws1: quién más es de la familia post-agenda, y quién salta a la #212. */
async function leerLasDemas(): Promise<Fila[]> {
  const { data, error } = await db.from('nutricion_secuencias').select(COLS)
    .eq('workspace_id', WS).not('id', 'in', `(${SEC_BIENVENIDA},${SEC_CONOCIDO},${SEC_NUEVO})`).order('id', { ascending: true }).range(0, 999);
  if (error) throw new Error(`nutricion_secuencias (las demás): ${error.message}`);
  const filas = (data ?? []) as unknown as Fila[];
  if (filas.length >= 1000) throw new Error('el ws1 tiene 1000 automatizaciones o más: esta lectura no las ve a todas');
  return filas;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════

console.log(`\n══ NOVENA TANDA · ws${WS} — ${aplicar ? 'APLICANDO' : 'SIMULACRO (sólo lee, no escribe nada)'} · ${new Date().toISOString()} ══`);

const filas = await leerSecuencias();
const s213 = filas.get(SEC_NUEVO);
const s212 = filas.get(SEC_CONOCIDO);
const s198 = filas.get(SEC_BIENVENIDA);
if (!s213 || !s212 || !s198) throw new Error(`faltan secuencias en el ws${WS}: ${[SEC_NUEVO, SEC_CONOCIDO, SEC_BIENVENIDA].filter((id) => !filas.has(id)).map((id) => `#${id}`).join(', ')}`);
const inscs = await leerInscripciones();
// LA FOTO DEL RESPALDO SE SACA ACÁ, recién leída: nada de lo que sigue puede haberla tocado. Se escribe sólo con
// --aplicar y antes de la primera escritura (`guardarRespaldo`, más abajo).
const RESPALDO = `backups/novena-tanda-ws${WS}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
const filasRespaldo: Fila[] = [s213, s212, s198];
const respaldoTexto = JSON.stringify({
  ws: WS, leido: new Date().toISOString(),
  secuencias: filasRespaldo,
  inscripciones: inscs,
}, null, 1);
const inscsDe = (secId: number) => inscs.filter((i) => i.secuencia_id === secId);
const demas = await leerLasDemas();
const avisos: string[] = [];

// ── 1 y 2. La #213: la condición y el AI Step ───────────────────────────────────────────────────

console.log(`\n── #${SEC_NUEVO} «${s213.nombre}» (${s213.archivada_at ? 'ARCHIVADA' : s213.activa ? 'activa' : 'pausada'} · CRON ${s213.trigger_tipo} · actualizada ${s213.updated_at})`);
const frenos213: string[] = [];
const antes213 = normalizar(pasosDe(s213));
let despues213: PasoGrafo[] = antes213;
let hecho1 = false;
let hecho2 = false;
let nuevos213: string[] = [];

if (s213.archivada_at) frenos213.push(`#${SEC_NUEVO} está archivada`);
if (s213.pasos_borrador != null) frenos213.push(`#${SEC_NUEVO} tiene cambios SIN PUBLICAR en el lienzo (pasos_borrador): publicarlos después pisaría esto. Que lo decida quien los hizo`);
if (estable(antes213) !== estable(pasosDe(s213))) avisos.push(`#${SEC_NUEVO}: lo guardado no estaba normalizado (normalizar le cambia algo); se escribe normalizado`);

const esp = nodoPorId(antes213, ESPERA_ENTRADA);
const trasEspera = esp ? nodoPorId(antes213, esp.siguiente ?? null) : null;
const fila0 = trasEspera && claseDe(trasEspera) === 'condicion' && trasEspera.ramas?.length === 1 ? trasEspera.ramas[0].filas : null;
hecho1 = !!(fila0 && fila0.length === 1 && fila0[0].campo === 'ya_contactado' && !fila0[0].no && trasEspera?.si_no === AUDIO_DE_SIEMPRE);
const r213 = nodoPorId(antes213, RESP_NUEVO);
hecho2 = esPasoIA(r213);

if (!esp || claseDe(esp) !== 'esperar') frenos213.push(`no está la espera ${ESPERA_ENTRADA}`);
for (const id of INTOCABLES) if (!nodoPorId(antes213, id)) frenos213.push(`falta la tarjeta ${id} (es de las que no pueden cambiar)`);
if (!r213 || claseDe(r213) !== 'respuesta') frenos213.push(`${RESP_NUEVO} no es un «Si responde»`);

let pasos1: PasoGrafo[] = antes213;
if (hecho1) console.log(`  · paso 1 YA HECHO: ${ESPERA_ENTRADA} sigue en la condición ${trasEspera?.id} («Ya le escribiste»)`);
else if (!frenos213.length) {
  if (esp?.siguiente !== AUDIO_DE_SIEMPRE) frenos213.push(`la espera ${ESPERA_ENTRADA} ya no sigue en ${AUDIO_DE_SIEMPRE} (sigue en ${esp?.siguiente ?? 'nada'}): alguien la cambió`);
  const o0 = nodoPorId(antes213, AUDIO_DE_SIEMPRE);
  if (o0?.siguiente !== UNION) frenos213.push(`${AUDIO_DE_SIEMPRE} ya no sigue en ${UNION}`);
  const u = nodoPorId(antes213, UNION);
  if (!u || claseDe(u) !== 'esperar') frenos213.push(`${UNION} no es una espera`);
  // El audio de la #212, tal cual: el que recibe hoy quien ya habló con el negocio.
  const o0de212 = nodoPorId(normalizar(pasosDe(s212)), AUDIO_DE_SIEMPRE);
  const audioOk = !!o0de212 && claseDe(o0de212) === 'mensaje' && o0de212.tipo === 'audio' && Number(o0de212.audio_id) === AUDIO_CONOCIDO
    && o0de212.revisar === false && o0de212.proveedor === 'no_oficial' && (o0de212.canal ?? 'whatsapp') === 'whatsapp';
  if (!audioOk) frenos213.push(`el ${AUDIO_DE_SIEMPRE} de la #${SEC_CONOCIDO} ya no es el audio ${AUDIO_CONOCIDO} que sale solo por el no oficial`);
  const { data: au, error: ea } = await db.from('setting_audios').select('id, titulo, media_path').eq('workspace_id', WS).eq('id', AUDIO_CONOCIDO).maybeSingle();
  if (ea) throw new Error(`setting_audios: ${ea.message}`);
  if (!au) frenos213.push(`el audio ${AUDIO_CONOCIDO} no existe en la biblioteca del ws${WS}: el mensaje fallaría en cada lead`);
  else console.log(`  · audio ${AUDIO_CONOCIDO} en la biblioteca: «${(au as { titulo?: string }).titulo ?? ''}»`);

  if (!frenos213.length && o0de212) {
    const historia = await nodosDeLaHistoria(SEC_NUEVO, inscs);
    const [condId, ramaId, audioId] = idsNuevos(antes213, historia, 3, 20261010 + SEC_NUEVO);
    nuevos213 = [condId, audioId];
    const audio = { ...structuredClone(o0de212), id: audioId, siguiente: UNION } as PasoGrafo;
    delete audio.orden; // el `orden` de la lista de antes: con el flujo no ordena nada, y dos `orden: 1` confunden.
    const cond0: PasoGrafo = {
      id: condId, nodo: 'condicion',
      ramas: [{ id: ramaId, modo: 'todas', filas: [{ campo: 'ya_contactado' }], siguiente: audioId }],
      si_no: AUDIO_DE_SIEMPRE,
    };
    // La forma en que la guarda `setSecuenciaPasos` (un nodo de control: el relleno y sus campos saneados).
    const cond = { ...RELLENO_CONTROL, ...camposDelFlujo(cond0) } as PasoGrafo;
    pasos1 = [...antes213.map((p) => (p.id === ESPERA_ENTRADA ? { ...p, siguiente: condId } : p)), cond, audio];
    console.log(`  · paso 1: condición ${condId} «${textoFila({ campo: 'ya_contactado' })}» (rama ${ramaId}): sí → ${audioId} (audio ${AUDIO_CONOCIDO}) → ${UNION} · si no → ${AUDIO_DE_SIEMPRE}`);
  }
}

if (hecho2) console.log(`  · paso 2 YA HECHO: ${RESP_NUEVO} ya es un AI Step`);
else if (!frenos213.length) {
  const conv = respuestaAPasoIA(pasos1, RESP_NUEVO);
  if ('error' in conv) frenos213.push(`el conversor dice que no se puede: «${conv.error}». No se escribe NADA de la #${SEC_NUEVO}`);
  else { pasos1 = conv.pasos; console.log(`  · paso 2: ${RESP_NUEVO} → AI Step (respuestaAPasoIA)`); }
}
if (!frenos213.length) despues213 = normalizar(pasos1);
const escribir213 = !frenos213.length && estable(despues213) !== estable(antes213);

if (!frenos213.length) {
  // Lo que no puede cambiar no cambió: los intocables idénticos (salvo el `siguiente` de la espera y el AI
  // Step, que conserva su id y los de sus casos); lo que sale del array, sólo lo que colgaba de «Si responde».
  const idsA = new Set(antes213.map((p) => p.id!));
  const idsD = new Set(despues213.map((p) => p.id!));
  for (const id of INTOCABLES) {
    const a = nodoPorId(antes213, id);
    const d = nodoPorId(despues213, id);
    if (!a || !d) { frenos213.push(`${id} no queda`); continue; }
    if (id === RESP_NUEVO) {
      const casosA = (a.casos ?? []).map((x) => x.id).join(',');
      const casosD = (d.casos ?? []).map((x) => x.id).join(',');
      if (casosA !== casosD) frenos213.push(`los casos de ${id} cambiarían de id (${casosA} → ${casosD})`);
    } else if (id === ESPERA_ENTRADA) {
      if (estable({ ...a, siguiente: null }) !== estable({ ...d, siguiente: null })) frenos213.push(`${id} cambiaría en algo más que su flecha`);
    } else if (estable(a) !== estable(d)) frenos213.push(`${id} cambiaría y es de las que no pueden cambiar`);
  }
  const salen = [...idsA].filter((id) => !idsD.has(id));
  const entran = [...idsD].filter((id) => !idsA.has(id));
  const otrasCambian = [...idsA].filter((id) => idsD.has(id) && !INTOCABLES.includes(id)
    && estable(nodoPorId(antes213, id)) !== estable(nodoPorId(despues213, id)));
  if (otrasCambian.length) frenos213.push(`cambiarían tarjetas que no tocaba: ${otrasCambian.join(', ')}`);
  if (entran.some((id) => !nuevos213.includes(id))) frenos213.push(`entrarían tarjetas que no esperaba: ${entran.join(', ')}`);
  for (const i of inscsDe(SEC_NUEVO)) for (const n of nodosDeInsc(i)) if (salen.includes(n) && VIVAS.has(i.estado)) frenos213.push(`la inscripción ${i.id} está en ${n}, que sale`);
  const p0 = nodoPorId(despues213, ESPERA_ENTRADA);
  const cond = nodoPorId(despues213, p0?.siguiente ?? null);
  const camino = cond && claseDe(cond) === 'condicion'
    ? `${ESPERA_ENTRADA} → ${cond.id} → [sí ${puertosDe(despues213, indicePorId(despues213, cond.id!)).map((x) => x.destino).join(' / si no ')}]`
    : '—';
  console.log(`  · camino de salida: ${camino} → ${UNION} → o1 → n4z5uil → ne9jyr0`);
  if (salen.length) console.log(`  · salen del array (colgaban de «Si responde»): ${salen.join(', ')}`);
  if (entran.length) console.log(`  · entran al final: ${entran.join(', ')}`);
}

imprimirFlujo('ANTES', antes213);
if (escribir213) imprimirFlujo('DESPUÉS', despues213);
let chequeo213: Chequeo = { frenos: [] };
if (!frenos213.length) {
  console.log('  comprobaciones del después:');
  chequeo213 = chequearFlujo(SEC_NUEVO, antes213, despues213, RESP_NUEVO, inscsDe(SEC_NUEVO));
  frenos213.push(...chequeo213.frenos);
  console.log('  el AI Step expandido (lo que corre el motor):');
  imprimirExpansion(despues213, RESP_NUEVO);
}
if (frenos213.length) console.log(`  ✖ NO SE ESCRIBE NADA DE LA #${SEC_NUEVO}:\n    - ${frenos213.join('\n    - ')}`);
else if (!escribir213) console.log(`  · los pasos de la #${SEC_NUEVO} ya están como tienen que quedar: nada que escribir`);
else console.log(`  → ${aplicar ? 'se escribe' : 'se escribiría'} pasos de la #${SEC_NUEVO} (${antes213.length} → ${despues213.length} tarjetas), compare-and-set sobre updated_at = ${s213.updated_at}`);
const ok213 = !frenos213.length;

// ── 3. La #198: su «Si responde» a AI Step ───────────────────────────────────────────────────────

console.log(`\n── #${SEC_BIENVENIDA} «${s198.nombre}» (${s198.archivada_at ? 'ARCHIVADA' : s198.activa ? 'activa' : 'pausada'} · CRON ${s198.trigger_tipo} · actualizada ${s198.updated_at})`);
const frenos198: string[] = [];
const antes198 = normalizar(pasosDe(s198));
let despues198: PasoGrafo[] = antes198;
if (s198.archivada_at) frenos198.push(`#${SEC_BIENVENIDA} está archivada`);
if (s198.pasos_borrador != null) frenos198.push(`#${SEC_BIENVENIDA} tiene cambios SIN PUBLICAR en el lienzo (pasos_borrador): publicarlos después pisaría esto`);
const r198 = nodoPorId(antes198, RESP_BIENVENIDA);
if (!r198 || claseDe(r198) !== 'respuesta') frenos198.push(`${RESP_BIENVENIDA} no es un «Si responde»`);
const hecho3 = esPasoIA(r198);
if (hecho3) console.log(`  · paso 3 YA HECHO: ${RESP_BIENVENIDA} ya es un AI Step`);
else if (!frenos198.length) {
  const conv = respuestaAPasoIA(antes198, RESP_BIENVENIDA);
  if ('error' in conv) frenos198.push(`el conversor dice que no se puede: «${conv.error}»`);
  else { despues198 = normalizar(conv.pasos); console.log(`  · paso 3: ${RESP_BIENVENIDA} → AI Step (respuestaAPasoIA)`); }
}
const escribir198 = !frenos198.length && estable(despues198) !== estable(antes198);
if (!frenos198.length) {
  const idsD = new Set(despues198.map((p) => p.id!));
  const salen = antes198.map((p) => p.id!).filter((id) => !idsD.has(id));
  const otrasCambian = antes198.map((p) => p.id!).filter((id) => idsD.has(id) && id !== RESP_BIENVENIDA
    && estable(nodoPorId(antes198, id)) !== estable(nodoPorId(despues198, id)));
  if (otrasCambian.length) frenos198.push(`cambiarían tarjetas que no tocaba: ${otrasCambian.join(', ')}`);
  if (despues198.some((p) => !antes198.some((q) => q.id === p.id))) frenos198.push('entrarían tarjetas nuevas');
  if (salen.length) console.log(`  · salen del array (colgaban de «Si responde»): ${salen.join(', ')}`);
}
imprimirFlujo('ANTES', antes198);
if (escribir198) imprimirFlujo('DESPUÉS', despues198);
if (!frenos198.length) {
  console.log('  comprobaciones del después:');
  frenos198.push(...chequearFlujo(SEC_BIENVENIDA, antes198, despues198, RESP_BIENVENIDA, inscsDe(SEC_BIENVENIDA)).frenos);
  console.log('  el AI Step expandido (lo que corre el motor):');
  imprimirExpansion(despues198, RESP_BIENVENIDA);
}
if (frenos198.length) console.log(`  ✖ NO SE ESCRIBE LA #${SEC_BIENVENIDA}:\n    - ${frenos198.join('\n    - ')}`);
else if (!escribir198) console.log(`  · los pasos de la #${SEC_BIENVENIDA} ya están como tienen que quedar: nada que escribir`);
else console.log(`  → ${aplicar ? 'se escribe' : 'se escribiría'} pasos de la #${SEC_BIENVENIDA} (${antes198.length} → ${despues198.length} tarjetas), compare-and-set sobre updated_at = ${s198.updated_at}`);

// ── 4a. Archivar la #212 ────────────────────────────────────────────────────────────────────────

console.log(`\n── #${SEC_CONOCIDO} «${s212.nombre}» (${s212.archivada_at ? `ARCHIVADA ${s212.archivada_at}` : s212.activa ? 'activa' : 'pausada'} · CRON ${s212.trigger_tipo} · actualizada ${s212.updated_at})`);
const frenos212: string[] = [];
const hecho4a = !!s212.archivada_at;
const insc212 = inscsDe(SEC_CONOCIDO);
const vivas212 = insc212.filter((i) => VIVAS.has(i.estado));
console.log(`  · inscripciones: ${insc212.length} en total, ${vivas212.length} vivas${insc212.length ? ` (${insc212.map((i) => `${i.id}:${i.estado}`).join(', ')})` : ''}`);
if (vivas212.length) frenos212.push(`la #${SEC_CONOCIDO} tiene inscripciones vivas (${vivas212.map((i) => i.id).join(', ')}): archivarla las cancelaría. El plan contaba con cero`);
// Nadie salta a la #212: un «Ir a» a una archivada no lleva a ningún lado.
const saltan = demas.filter((s) => !s.archivada_at).filter((s) => [s.pasos, s.pasos_borrador].some((ps) => Array.isArray(ps)
  && (ps as PasoGrafo[]).some((p) => claseDe(p) === 'ir_a' && !!p.destino && 'secuencia_id' in p.destino && Number(p.destino.secuencia_id) === SEC_CONOCIDO)));
if (saltan.length) frenos212.push(`le saltan con un «Ir a»: ${saltan.map((s) => `#${s.id} «${s.nombre}»`).join(', ')}`);
if (hecho4a) console.log('  · paso 4a YA HECHO: archivada');
if (frenos212.length) console.log(`  ✖ NO SE ARCHIVA:\n    - ${frenos212.join('\n    - ')}`);

// ── 4b. Los CRON de la #213 ─────────────────────────────────────────────────────────────────────

console.log(`\n── Los CRON de la #${SEC_NUEVO}`);
const frenosCron: string[] = [];
const previos = disparadoresDe(s213);
const lista = sanearDisparadores(CRON_OBJETIVO);
if (lista.length !== CRON_OBJETIVO.length || lista.length > TOPE_DISPARADORES) frenosCron.push('la lista de CRON no se entiende');
const problema = problemaDeDisparadores(lista);
if (problema) frenosCron.push(`problemaDeDisparadores: ${problema}`);
if (!FAMILIA_POST_AGENDA.includes(lista[0]?.trigger_tipo ?? '')) frenosCron.push('el PRIMER CRON tiene que ser de la familia post-agenda');
const rev0 = s213.disparadores_rev;
if (rev0 == null) frenosCron.push('falta la migración 0241 (disparadores_rev): no se pueden varios CRON');
const hecho4b = firmaLista(previos) === firmaLista(lista);
const comoAntes = firmaLista(previos) === firmaLista(lista.slice(0, 1));
// Lo que `validarContraElNegocio` mira para un disparador de antes: que esté en el catálogo (`TRIGGERS`, en
// un módulo con `server-only`). Los de la familia post-agenda están; otro, desde acá, no se puede validar.
const nuevosCron = nuevosOCambiados(lista, previos);
for (const d of nuevosCron) if (!FAMILIA_POST_AGENDA.includes(d.trigger_tipo)) frenosCron.push(`«${d.trigger_tipo}» no se puede validar desde el script`);
if (!hecho4b && !comoAntes) frenosCron.push(`los CRON de la #${SEC_NUEVO} (${previos.map((d) => `${d.id}:${d.trigger_tipo}`).join(', ')}) no son ni los de antes ni los que se quieren poner: alguien los cambió, o la lista nueva no empieza por el de antes`);
// Nadie más de la familia vivo (si no, el mismo lead entra por dos puertas).
const familiaViva = demas.filter((s) => !s.archivada_at && disparadoresDe(s).some((d) => FAMILIA_POST_AGENDA.includes(d.trigger_tipo)));
if (familiaViva.length) frenosCron.push(`hay otras automatizaciones vivas de la familia post-agenda: ${familiaViva.map((s) => `#${s.id} «${s.nombre}»`).join(', ')}`);
// Los CRON van DESPUÉS de los pasos (la condición tiene que estar antes de que entre quien ya habló) y DESPUÉS
// de archivar la #212.
if (!ok213) frenosCron.push(`la #${SEC_NUEVO} no se escribe: sin la condición, quien ya habló con el negocio recibiría el audio de primer contacto`);
if (!hecho4a && frenos212.length) frenosCron.push(`la #${SEC_CONOCIDO} no se archiva: con las dos vivas el mismo lead entraría a las dos`);
const ahoraCron = new Date();
const conProxima: Disparador[] = conProximas(lista, previos, ahoraCron, TZ_SIN_HORARIO);
const primero = conProxima[0];
const colsCron = primero ? { ...columnasDeDisparador(primero), cron_proxima_at: primero.cron ? primero.cron_proxima_at : null } : {};
console.log(`  · antes: ${previos.map((d) => `${d.id} ${d.trigger_tipo}${d.etapa ? ` (etapa ${d.etapa})` : ''}`).join(' · ')} · disparadores_rev ${rev0 ?? '—'} · columnas trigger_tipo=${s213.trigger_tipo} etapa=${s213.etapa}`);
console.log(`  · después: ${conProxima.map((d) => `${d.id} ${d.trigger_tipo}${d.etapa ? ` (etapa ${d.etapa})` : ''}`).join(' · ')} · disparadores_rev ${rev0 == null ? '—' : rev0 + 1}`);
console.log(`  · columnas que escribe el primero: ${estable(colsCron)} (la etapa «${s213.etapa}» no se toca: no es de etapa)`);
console.log(`  · lo nuevo a validar contra el negocio: ${nuevosCron.map((d) => d.trigger_tipo).join(', ') || 'nada'}`);
// Una cosa a saber, no un freno: la pantalla no ofrece los eventos de antes para un CRON nuevo
// (lib/flujo-conversacion.ts), así que si alguien borra d2 desde el lienzo sólo vuelve por la API de MaKo
// (`cambiar_crons_secuencia`) o por este script.
if (hecho4b) console.log('  · paso 4b YA HECHO: la #213 ya tiene los dos CRON');
if (frenosCron.length && !hecho4b) console.log(`  ✖ NO SE GUARDAN LOS CRON:\n    - ${frenosCron.join('\n    - ')}`);
const okCron = hecho4b || !frenosCron.length;

// ── 5. El nombre ────────────────────────────────────────────────────────────────────────────────

const nombre = NOMBRE_NUEVO.trim().replace(/\s+/g, ' ').slice(0, TOPE_NOMBRE_SECUENCIA).trim(); // `nombreDeSecuencia`
const hecho5 = s213.nombre === nombre;
console.log(`\n── El nombre de la #${SEC_NUEVO}: «${s213.nombre}» → «${nombre}»${hecho5 ? ' (paso 5 YA HECHO)' : ''}`);
const tocayas = demas.filter((s) => !s.archivada_at && s.nombre.trim().toLowerCase() === nombre.toLowerCase());
if (tocayas.length) avisos.push(`ya hay otra automatización viva que se llama «${nombre}»: ${tocayas.map((s) => `#${s.id}`).join(', ')}`);

// ── La 202, antes ───────────────────────────────────────────────────────────────────────────────

const i202 = inscs.find((i) => i.id === INSC_202) ?? null;
console.log(`\n── Inscripción ${INSC_202}: ${i202 ? `lead ${i202.lead_id} · #${i202.secuencia_id} · ${i202.estado} · nodo_actual ${i202.nodo_actual ?? '—'} · paso_actual ${i202.paso_actual} · próximo envío ${i202.proximo_envio_at ?? '—'}` : 'NO ESTÁ'}`);
if (i202 && i202.nodo_actual !== 'o1') avisos.push(`la inscripción ${INSC_202} ya no está en o1 (está en ${i202.nodo_actual ?? '—'}, ${i202.estado}): el motor ya la movió; lo que importa es que su nodo siga existiendo`);

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Escribir (sólo con --aplicar). Cada paso depende del anterior; si uno no se escribe, los que dependen de él
// tampoco.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * UPDATE con compare-and-set sobre `updated_at` (y `disparadores_rev`, y «todavía sin archivar», si se pide).
 * Devuelve el `updated_at` que quedó, o `false` si la fila cambió en el medio y no se escribió.
 */
async function escribir(secId: number, cambios: Record<string, unknown>, leido: string | null, o: { rev?: number; vigente?: boolean } = {}): Promise<string | null | false> {
  let q = db.from('nutricion_secuencias').update(cambios).eq('id', secId).eq('workspace_id', WS);
  q = leido ? q.eq('updated_at', leido) : q.is('updated_at', null);
  if (o.rev !== undefined) q = q.eq('disparadores_rev', o.rev);
  if (o.vigente) q = q.is('archivada_at', null);
  const { data, error } = await q.select('id, updated_at');
  if (error) throw new Error(`escribir #${secId}: ${error.message}`);
  const f = ((data ?? []) as Array<{ updated_at: string | null }>)[0];
  return f ? f.updated_at : false;
}

let u213 = s213.updated_at;
let escrito213 = hecho1 && hecho2;
let archivada = hecho4a;
let cronOk = hecho4b;
let nombreOk = hecho5;
let paro: string | null = null;
const PARO = 'cambió mientras tanto: no se pisó. Vuelve a correr el simulacro y después --aplicar (sigue donde quedó)';

/**
 * Escribe el respaldo y lo RELEE antes de dejar escribir (AGENTS.md: que un archivo exista no dice que sirva).
 * Se mide contra lo LEÍDO de la base y no contra el texto escrito: las tres filas, cada `pasos` una LISTA (no un
 * texto con el JSON adentro) con las mismas tarjetas, y el mismo `updated_at` contra el que se hace el
 * compare-and-set. Un respaldo que no pasa esto tira: mejor no escribir que escribir sin vuelta atrás.
 */
function guardarRespaldo(): void {
  mkdirSync('backups', { recursive: true });
  writeFileSync(RESPALDO, respaldoTexto, 'utf8');
  const vuelta = JSON.parse(readFileSync(RESPALDO, 'utf8')) as { ws?: unknown; secuencias?: Fila[] };
  const malas = filasRespaldo.flatMap((s) => {
    const r = (vuelta.secuencias ?? []).find((x) => x?.id === s.id);
    if (!r) return [`#${s.id} no está`];
    if (!Array.isArray(r.pasos) || r.pasos.length !== pasosDe(s).length) return [`#${s.id}: sus pasos no son la lista leída`];
    if (r.updated_at !== s.updated_at) return [`#${s.id}: otro updated_at`];
    return [];
  });
  if (vuelta.ws !== WS || malas.length) throw new Error(`el respaldo ${RESPALDO} no sirve (${malas.join(' · ') || 'otro workspace'}): no se escribió nada`);
  console.log(`  ✓ respaldo de las 3 filas enteras: ${RESPALDO} (${respaldoTexto.length} caracteres)`);
}

if (!aplicar) console.log(`\n── Respaldo: con --aplicar se guardan ANTES de escribir las 3 filas enteras (${respaldoTexto.length} caracteres) en ${RESPALDO}`);
if (aplicar) {
  console.log('\n══ ESCRIBIENDO ══');
  guardarRespaldo();
  if (ok213 && escribir213) {
    const u = await escribir(SEC_NUEVO, { pasos: despues213, updated_at: new Date().toISOString() }, u213);
    if (u === false) paro = `#${SEC_NUEVO} (pasos) ${PARO}`;
    else { u213 = u; escrito213 = true; console.log(`  ✓ #${SEC_NUEVO}: pasos escritos (updated_at ${u})`); }
  } else if (ok213) escrito213 = true;
  if (!frenos198.length && escribir198) {
    const u = await escribir(SEC_BIENVENIDA, { pasos: despues198, updated_at: new Date().toISOString() }, s198.updated_at);
    if (u === false) console.log(`  ✖ #${SEC_BIENVENIDA} (pasos) ${PARO}`);
    else console.log(`  ✓ #${SEC_BIENVENIDA}: pasos escritos (updated_at ${u})`);
  }
  // Archivar SÓLO si los CRON se van a guardar enseguida (o ya están): la #212 sola archivada deja sin
  // post-agenda a quien ya habló con el negocio hasta que esté d2.
  if (!paro && escrito213 && !archivada && !frenos212.length && okCron) {
    // `archivarSecuencias` no toca `updated_at`: acá tampoco (sólo lo usa de guarda).
    const u = await escribir(SEC_CONOCIDO, { archivada_at: new Date().toISOString() }, s212.updated_at, { vigente: true });
    if (u === false) paro = `#${SEC_CONOCIDO} (archivar) ${PARO}`;
    else {
      archivada = true;
      // Lo que hace `archivarSecuencias` después de archivar: cancela las vivas. Se contaron cero, pero entre la
      // lectura y el archivado el motor pudo inscribir a alguien por evento.
      const { data: canc, error: ec } = await db.from('nutricion_inscripciones').update({ estado: 'cancelada', updated_at: new Date().toISOString() })
        .eq('workspace_id', WS).eq('secuencia_id', SEC_CONOCIDO).in('estado', ['activa', 'pendiente']).select('id');
      if (ec) throw new Error(`cancelar inscripciones de la #${SEC_CONOCIDO}: ${ec.message}`);
      console.log(`  ✓ #${SEC_CONOCIDO}: archivada · inscripciones canceladas: ${(canc ?? []).length}`);
    }
  }
  if (!paro && escrito213 && archivada && !cronOk && okCron && rev0 != null) {
    const u = await escribir(SEC_NUEVO, { ...colsCron, disparadores: conProxima, disparadores_rev: rev0 + 1, updated_at: new Date().toISOString() }, u213, { rev: rev0 });
    if (u === false) paro = `#${SEC_NUEVO} (CRON) ${PARO}. ⚠️ La #${SEC_CONOCIDO} YA ESTÁ ARCHIVADA: hasta guardar d2, quien ya habló con el negocio no entra por evento`;
    else { u213 = u; cronOk = true; console.log(`  ✓ #${SEC_NUEVO}: CRON guardados (disparadores_rev ${rev0 + 1})`); }
  }
  if (!paro && escrito213 && !nombreOk) {
    const u = await escribir(SEC_NUEVO, { nombre, updated_at: new Date().toISOString() }, u213);
    if (u === false) paro = `#${SEC_NUEVO} (nombre) ${PARO}`;
    else { u213 = u; nombreOk = true; console.log(`  ✓ #${SEC_NUEVO}: se llama «${nombre}»`); }
  }
  if (paro) console.log(`  ✖ PARÓ: ${paro}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 6. Releer y comprobar. Con --aplicar, la base; en el simulacro, lo que se escribiría (no hay otra cosa
//    que releer sin escribir).
// ═════════════════════════════════════════════════════════════════════════════════════════════════

console.log(`\n══ 6. COMPROBACIÓN FINAL — ${aplicar ? 'releída de la base' : 'sobre lo que se ESCRIBIRÍA (simulado: la base no cambió)'} ══`);
let f213: Fila = s213;
let f212: Fila = s212;
let f198: Fila = s198;
let fi202: Insc | null = i202;
if (aplicar) {
  const re = await leerSecuencias();
  f213 = re.get(SEC_NUEVO)!;
  f212 = re.get(SEC_CONOCIDO)!;
  f198 = re.get(SEC_BIENVENIDA)!;
  fi202 = (await leerInscripciones()).find((i) => i.id === INSC_202) ?? null;
} else {
  if (ok213) f213 = { ...s213, pasos: despues213 };
  if (!frenos198.length) f198 = { ...s198, pasos: despues198 };
  if (ok213 && !frenos212.length && okCron) f212 = { ...s212, archivada_at: s212.archivada_at ?? '(se archivaría ahora)' };
  if (ok213 && okCron && f212.archivada_at && !hecho4b && rev0 != null) f213 = { ...f213, ...colsCron, disparadores: conProxima, disparadores_rev: rev0 + 1 };
  if (ok213) f213 = { ...f213, nombre };
}
const finales: string[] = [];
const marca = (b: boolean, texto: string) => { console.log(`  ${b ? '✓' : '✖'} ${texto}`); if (!b) finales.push(texto); };

// Que lo escrito sea un objeto y no un texto con el JSON adentro (AGENTS.md: el respaldo que corrompió el store).
marca(Array.isArray(f213.pasos) && Array.isArray(f198.pasos), 'los pasos se leen como lista (no como un texto con el JSON adentro)');
const p213 = normalizar(pasosDe(f213));
const p198 = normalizar(pasosDe(f198));
if (fi202) {
  const k = indiceActual(p213, fi202);
  const nodo = k >= 0 ? idDe(p213[k], k) : null;
  marca(fi202.nodo_actual != null && nodo === fi202.nodo_actual, `inscripción ${INSC_202}: ${fi202.estado} · nodo_actual ${fi202.nodo_actual ?? '—'} existe en la #${SEC_NUEVO} (índice ${k})`);
  marca(fi202.nodo_actual === 'o1', `inscripción ${INSC_202} sigue en o1`);
  marca(k === fi202.paso_actual, `y su paso_actual (${fi202.paso_actual}) es el índice de ese nodo`);
} else marca(false, `la inscripción ${INSC_202} no está`);
const v213 = validarGrafo(p213);
marca(!v213.length, `#${SEC_NUEVO} pasa validarGrafo${v213.length ? `: ${v213[0]}` : ''}`);
const fr213 = frenoDelFlujo(p213);
marca(!fr213, `#${SEC_NUEVO} pasa el freno de Publicar${fr213 ? `: ${fr213.error}` : ''}`);
marca(!pierdeAlGuardar(p213).length, `#${SEC_NUEVO} está en su forma guardada (el saneo no le saca nada)`);
marca(esPasoIA(nodoPorId(p213, RESP_NUEVO)), `#${SEC_NUEVO}: ${RESP_NUEVO} es un AI Step`);
const cond213 = nodoPorId(p213, nodoPorId(p213, ESPERA_ENTRADA)?.siguiente ?? null);
marca(!!cond213 && claseDe(cond213) === 'condicion' && cond213.si_no === AUDIO_DE_SIEMPRE, `#${SEC_NUEVO}: después de ${ESPERA_ENTRADA} está la condición «Ya le escribiste» (si no → ${AUDIO_DE_SIEMPRE})`);
console.log(`    el AI Step de la #${SEC_NUEVO}, expandido:`);
imprimirExpansion(p213, RESP_NUEVO);
const v198 = validarGrafo(p198);
marca(!v198.length, `#${SEC_BIENVENIDA} pasa validarGrafo${v198.length ? `: ${v198[0]}` : ''}`);
const fr198 = frenoDelFlujo(p198);
marca(!fr198, `#${SEC_BIENVENIDA} pasa el freno de Publicar${fr198 ? `: ${fr198.error}` : ''}`);
marca(!pierdeAlGuardar(p198).length, `#${SEC_BIENVENIDA} está en su forma guardada`);
marca(esPasoIA(nodoPorId(p198, RESP_BIENVENIDA)), `#${SEC_BIENVENIDA}: ${RESP_BIENVENIDA} es un AI Step`);
console.log(`    el AI Step de la #${SEC_BIENVENIDA}, expandido:`);
imprimirExpansion(p198, RESP_BIENVENIDA);
marca(!!f212.archivada_at, `#${SEC_CONOCIDO} archivada (${f212.archivada_at ?? 'no'})`);
const dFinal = disparadoresDe(f213);
marca(dFinal.length === 2 && firmaLista(dFinal) === firmaLista(lista), `#${SEC_NUEVO} con 2 CRON: ${dFinal.map((d) => `${d.id} ${d.trigger_tipo}`).join(' · ')}`);
marca(rev0 != null && f213.disparadores_rev === (hecho4b ? rev0 : rev0 + 1), `disparadores_rev ${rev0 ?? '—'} → ${f213.disparadores_rev ?? '—'}`);
marca(f213.trigger_tipo === TRIGGER_AGENDA_NUEVO && f213.etapa === 'postagenda', `columnas del primer CRON: ${f213.trigger_tipo} · etapa ${f213.etapa}`);
marca(f213.nombre === nombre, `#${SEC_NUEVO} se llama «${f213.nombre}»`);

// ── Resumen ─────────────────────────────────────────────────────────────────────────────────────

if (avisos.length) console.log(`\n⚠ A saber:\n  - ${avisos.join('\n  - ')}`);
if (!aplicar) {
  console.log('\nLo que este simulacro NO puede comprobar sin escribir:');
  console.log('  - que nadie guarde en el medio: eso lo decide el compare-and-set al escribir (si cambió, --aplicar para y lo dice);');
  console.log(`  - que el motor de producción entienda el AI Step: depende del deploy (sin él, NO correr --aplicar);`);
  console.log('  - lo obligatorio de cada «⚡ Acción» (`faltanEnPaso`, del registro de la API): no se corre acá; las acciones de estos flujos son los avisos de siempre, sin tocar;');
  console.log('  - cómo se dibuja en el lienzo (los altos de la tarjeta AI STEP y del panel): eso es en un navegador.');
}
const pendientes = [
  !ok213 ? `#${SEC_NUEVO} (pasos)` : null, frenos198.length ? `#${SEC_BIENVENIDA}` : null,
  !archivada && frenos212.length ? `#${SEC_CONOCIDO} (archivar)` : null, !okCron ? `#${SEC_NUEVO} (CRON)` : null,
].filter(Boolean);
console.log(`\n${aplicar ? (paro ? '✖ PARÓ A MEDIAS' : finales.length ? '✖ ESCRITO, PERO LA COMPROBACIÓN FINAL FALLA' : '✓ LISTO') : 'SIMULACRO'}`
  + ` · frenos: ${pendientes.length ? pendientes.join(', ') : 'ninguno'} · comprobaciones que fallan: ${finales.length}`);
if (aplicar && (paro || finales.length)) process.exitCode = 1;
