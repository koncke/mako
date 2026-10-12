// =============================================================================
// flujo-copia — COPIAR Y PEGAR un flujo (o unas tarjetas) entre automatizaciones y entre negocios
// =============================================================================
// Pedido de Martín (10/10/2026), textual:
//   1. «agregues un botón con la funcionalidad de "copiar flujo". Que esté en los 3 puntos de cada flujo
//      en la sidebar... Esto sirve por si un usuario de MaKo le quiere compartir un flujo que creó a
//      otro... al entrar a la tab de automations, si detecta que tenes copiado un flujo nuevo, que te
//      proponga crearlo. Pero también que se pueda pegar con crtl v en el flujo actual, es decir que se
//      peguen todas las tarjetas copiadas. También al momento de crear un nuevo flujo que te aparezca la
//      opción de pegar.»
//   2. «Esto también debería funcionar copiando una tarjeta y llevandolo a otro flujo... Y no solamente
//      entre otros usuario, sino también entre mis propios flujos.»
// Y su decisión sobre lo que no existe en el negocio que pega: «Pegar y marcar en rojo» — se pega todo;
// lo que no existe queda vacío (y en rojo, por la misma vara que Publicar) hasta que se elija, y un audio
// queda como TEXTO si tenía guion.
//
// ── EL FORMATO: TEXTO, PORQUE VIAJA POR WHATSAPP ────────────────────────────────────────────────
// El portapapeles lleva un renglón para la persona (««Nombre» — automatización de MaKo…») y abajo el
// JSON con la marca `mako: 'mako-flujo'`. Así se puede mandar por WhatsApp o por mail y pegarlo del
// otro lado, y quien lo recibe sin MaKo lee qué es. `leerCopia` busca el JSON después del renglón y lo
// valida entero: un texto que no es una copia devuelve null, nunca una copia a medias.
//
// ── LAS REFERENCIAS DEL OTRO NEGOCIO ───────────────────────────────────────────────────────────
// Un audio, un archivo, una etiqueta, una etapa, otra automatización o una línea son FILAS del negocio
// que copió. `limpiarReferencias` saca lo que no existe en el que pega (lo mira el server: el que sabe
// qué hay es la base) y no inventa nada: el campo queda vacío y la tarjeta la frena Publicar.
//
// ⚠️ PURO Y SIN `server-only`: lo usan el lienzo (copiar, Ctrl+V), la lista (el «⋯» y el aviso al
// entrar), la ruta (crear desde lo copiado, limpiar lo pegado) y el test (tests/flujo-copia.test.ts).
// =============================================================================

import {
  claseDe, idDe, normalizar, nuevoId, ID_INICIO, type PasoGrafo,
} from './flujo-grafo';
import type { Posiciones } from './lienzo-posiciones';

export const MARCA_COPIA = 'mako-flujo' as const;
/** Cuántas tarjetas como mucho (el tope de una automatización, `validarGrafo`). */
export const TOPE_TARJETAS_COPIA = 60;
/** El tope del texto que se acepta del portapapeles: una copia de 60 tarjetas pesa ~60 KB. */
const TOPE_TEXTO = 400_000;

/** Un paso tal como viaja: el nodo del flujo y lo del mensaje, sin tipos de UI. */
export type PasoCopiado = PasoGrafo & Record<string, unknown>;

/** Un CRON tal como viaja (la forma de `Disparador`, lib/disparadores.ts, sin depender del módulo). */
export type CronCopiado = { id: string; trigger_tipo: string; etapa?: string | null; etapas?: string[] | null; funnel_id?: number | null; producto_id?: number | null; etiqueta_id?: number | null };

export type CopiaFlujo = {
  mako: typeof MARCA_COPIA;
  v: 1;
  /** 'flujo' = la automatización entera (el «⋯» de la lista); 'tarjetas' = lo seleccionado del lienzo. */
  que: 'flujo' | 'tarjetas';
  nombre: string | null;
  emoji: string | null;
  pasos: PasoCopiado[];
  /** Dónde estaba cada tarjeta movida (relativo al CRON, lib/lienzo-posiciones.ts). */
  posiciones?: Posiciones;
  /** Sólo 'tarjetas': dónde estaba cada una, relativo a la esquina de arriba a la izquierda de lo copiado. */
  lugares?: Posiciones;
  /** Sólo 'flujo': sus CRON. En otro negocio, la etapa puede no existir: ahí nace «Elige qué la dispara». */
  disparadores?: CronCopiado[];
  /** El guion de cada audio que usa (id → texto): del otro lado el audio no existe, y queda como texto. */
  guiones?: Record<string, string>;
};

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** El texto que va al portapapeles. */
export function textoDeCopia(c: CopiaFlujo): string {
  const cuantas = c.pasos.filter((p) => claseDe(p) !== 'inicio').length;
  const cabeza = c.que === 'flujo'
    ? `«${c.nombre ?? 'Automatización'}» — automatización de MaKo. Pégala en Automations.`
    : `${cuantas === 1 ? 'Una tarjeta' : `${cuantas} tarjetas`} de MaKo. Pégalas en un flujo de Automations.`;
  return `${cabeza}\n${JSON.stringify(c)}`;
}

/** Lo que trae el portapapeles, si es una copia de MaKo entera y bien formada. Si no, null. */
export function leerCopia(texto: unknown): CopiaFlujo | null {
  if (typeof texto !== 'string' || texto.length > TOPE_TEXTO) return null;
  const i = texto.indexOf('{');
  if (i < 0) return null;
  let j: unknown;
  try { j = JSON.parse(texto.slice(i)); } catch { return null; }
  if (!esObjeto(j) || j.mako !== MARCA_COPIA || j.v !== 1) return null;
  if (j.que !== 'flujo' && j.que !== 'tarjetas') return null;
  if (!Array.isArray(j.pasos) || !j.pasos.length || j.pasos.length > TOPE_TARJETAS_COPIA + 1) return null;
  if (!j.pasos.every(esObjeto)) return null;
  const texto140 = (x: unknown, n: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, n) : null);
  const guiones: Record<string, string> = {};
  if (esObjeto(j.guiones)) for (const [k, v] of Object.entries(j.guiones)) if (/^\d{1,12}$/.test(k) && typeof v === 'string') guiones[k] = v.slice(0, 4000);
  return {
    mako: MARCA_COPIA, v: 1, que: j.que,
    nombre: texto140(j.nombre, 120), emoji: texto140(j.emoji, 16),
    pasos: j.pasos as PasoCopiado[],
    ...(esObjeto(j.posiciones) ? { posiciones: j.posiciones as Posiciones } : {}),
    ...(esObjeto(j.lugares) ? { lugares: j.lugares as Posiciones } : {}),
    ...(Array.isArray(j.disparadores) ? { disparadores: (j.disparadores as unknown[]).filter(esObjeto).slice(0, 12) as CronCopiado[] } : {}),
    ...(Object.keys(guiones).length ? { guiones } : {}),
  };
}

/** Una firma corta de lo copiado: para no volver a ofrecer la misma copia al entrar (el «No» se recuerda). */
export function firmaDeCopia(texto: string): string {
  let h = 2166136261;
  for (let k = 0; k < texto.length; k++) { h ^= texto.charCodeAt(k); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// ── Las flechas de un paso (las mismas claves que lee `puertosDe`, lib/flujo-grafo.ts) ───────────

/** Reescribe cada destino de un paso con `f` (null = la flecha se va). */
function conDestinos(p: PasoCopiado, f: (id: string) => string | null): PasoCopiado {
  const uno = (x: unknown) => (typeof x === 'string' && x ? f(x) : (x ?? null));
  const lista = (xs: unknown) => (Array.isArray(xs) ? xs.map((x) => (typeof x === 'string' ? f(x) : null)).filter((x): x is string => !!x) : xs);
  const out: PasoCopiado = { ...p };
  if ('siguiente' in p) out.siguiente = uno(p.siguiente) as string | null;
  if ('si_no' in p) out.si_no = uno(p.si_no) as string | null;
  if (Array.isArray(p.paralelos)) out.paralelos = lista(p.paralelos) as string[];
  if (Array.isArray(p.paralelos_si_no)) out.paralelos_si_no = lista(p.paralelos_si_no) as string[];
  if (Array.isArray(p.ramas)) out.ramas = p.ramas.map((r) => ({ ...r, siguiente: uno(r.siguiente) as string | null, ...(Array.isArray(r.paralelos) ? { paralelos: lista(r.paralelos) as string[] } : {}) }));
  if (Array.isArray(p.casos)) out.casos = p.casos.map((c) => ({ ...c, siguiente: uno(c.siguiente) as string | null }));
  if (p.destino && typeof p.destino === 'object' && 'nodo' in p.destino) {
    const d = f(String((p.destino as { nodo: unknown }).nodo));
    out.destino = d ? { nodo: d } : null;
  }
  return out;
}

/**
 * LO SELECCIONADO, COMO COPIA: las tarjetas de `ids` con las flechas ENTRE ellas; una flecha a algo que
 * no se copió se va (del otro lado esa tarjeta no existe). El CRON no se copia como tarjeta: lo que
 * colgaba de él queda suelto.
 */
export function copiaDeTarjetas(pasos: readonly PasoCopiado[], ids: readonly string[], o: { guiones?: Record<string, string>; lugares?: Posiciones } = {}): CopiaFlujo | null {
  const norm = normalizar(pasos as PasoGrafo[]) as PasoCopiado[];
  const quiero = new Set(ids);
  const elegidos = norm.filter((p, i) => quiero.has(idDe(p, i)) && claseDe(p) !== 'inicio');
  if (!elegidos.length) return null;
  const adentro = new Set(elegidos.map((p) => String(p.id)));
  const sueltos = elegidos.map((p) => conDestinos(p, (d) => (adentro.has(d) ? d : null)));
  return { mako: MARCA_COPIA, v: 1, que: 'tarjetas', nombre: null, emoji: null, pasos: sueltos, ...(o.lugares ? { lugares: o.lugares } : {}), ...guionesQueUsan(sueltos, o.guiones) };
}

/** La automatización ENTERA, como copia (el «⋯» de la lista). */
export function copiaDeFlujo(f: {
  nombre: string; emoji?: string | null; pasos: readonly PasoCopiado[]; posiciones?: Posiciones | null;
  disparadores?: readonly CronCopiado[] | null; guiones?: Record<string, string>;
}): CopiaFlujo {
  const pasos = normalizar(f.pasos as PasoGrafo[]) as PasoCopiado[];
  return {
    mako: MARCA_COPIA, v: 1, que: 'flujo', nombre: f.nombre, emoji: f.emoji ?? null, pasos,
    ...(f.posiciones && Object.keys(f.posiciones).length ? { posiciones: f.posiciones } : {}),
    ...(f.disparadores?.length ? { disparadores: f.disparadores.map((d) => ({ ...d })) } : {}),
    ...guionesQueUsan(pasos, f.guiones),
  };
}

/** Los audios que usa una lista de pasos (el paso y sus partes). */
export function audiosDe(pasos: readonly PasoCopiado[]): number[] {
  const out = new Set<number>();
  for (const p of pasos) {
    if (Number(p.audio_id) > 0) out.add(Number(p.audio_id));
    if (Array.isArray(p.partes)) for (const x of p.partes as Array<Record<string, unknown>>) if (Number(x?.audio_id) > 0) out.add(Number(x.audio_id));
  }
  return [...out];
}

function guionesQueUsan(pasos: readonly PasoCopiado[], guiones?: Record<string, string>): { guiones?: Record<string, string> } {
  if (!guiones) return {};
  const out: Record<string, string> = {};
  for (const id of audiosDe(pasos)) if (guiones[String(id)]?.trim()) out[String(id)] = guiones[String(id)];
  return Object.keys(out).length ? { guiones: out } : {};
}

/**
 * PEGAR UNAS TARJETAS EN UN FLUJO (Ctrl+V): cada una con un id NUEVO (los del otro flujo pueden chocar
 * con los de éste) y sus flechas entre ellas reescritas; nada le llega, así que nacen SUELTAS (un
 * borrador permitido, que se conecta después). El CRON de una copia entera no entra: es el de este
 * flujo. Y una «Si responde» pegada nace suelta (`suelta`): una automatización tiene una sola que
 * escucha, y la que ya está no se toca.
 */
export function pegarTarjetas<P extends PasoGrafo>(pasos: readonly P[], copia: CopiaFlujo, rnd: () => number = Math.random): { pasos: P[]; ids: string[]; mapa: Map<string, string> } {
  const fijos = normalizar(pasos);
  const entrantes = (normalizar(copia.pasos as PasoGrafo[]) as PasoCopiado[]).filter((p) => claseDe(p) !== 'inicio');
  const mapa = new Map<string, string>();
  let acumulado: PasoGrafo[] = [...fijos];
  for (const p of entrantes) {
    const nuevo = nuevoId(acumulado, rnd);
    mapa.set(String(p.id), nuevo);
    acumulado = [...acumulado, { id: nuevo } as PasoGrafo];
  }
  const nuevos = entrantes.map((p) => {
    const q = conDestinos(p, (d) => mapa.get(d) ?? null);
    const out = { ...q, id: mapa.get(String(p.id))! } as PasoCopiado;
    if (claseDe(out) === 'respuesta') out.suelta = true;
    return out as unknown as P;
  });
  return { pasos: normalizar([...fijos, ...nuevos]), ids: [...mapa.values()], mapa };
}

// ── Lo que no existe en el negocio que pega ─────────────────────────────────────────────────────

export type Existentes = {
  audios: ReadonlySet<number>;
  adjuntos: ReadonlySet<number>;
  etiquetas: ReadonlySet<number>;
  secuencias: ReadonlySet<number>;
  /** Las líneas de WhatsApp del negocio (`instance_name`). */
  lineas: ReadonlySet<string>;
  /** Las etapas de venta, como `<funnel_id>:<key>` (y `:<key>` para «cualquier embudo»). */
  etapas: ReadonlySet<string>;
};

/**
 * Saca de cada paso lo que apunta a algo que este negocio no tiene (decisión de Martín: «Pegar y
 * marcar en rojo»). Nada se inventa: el campo queda vacío y `validarGrafo` / el freno de Publicar lo
 * marcan. Un audio que no existe pasa a TEXTO con su guion, si lo traía; si no, queda sin audio.
 */
export function limpiarReferencias(pasos: readonly PasoCopiado[], ex: Existentes, guiones: Record<string, string> = {}): PasoCopiado[] {
  return pasos.map((p0) => {
    let p: PasoCopiado = { ...p0 };
    // El audio.
    if (p.tipo === 'audio' && Number(p.audio_id) > 0 && !ex.audios.has(Number(p.audio_id))) {
      const guion = guiones[String(p.audio_id)]?.trim();
      p = guion ? { ...p, tipo: 'texto', audio_id: null, cuerpo: guion } : { ...p, audio_id: null };
    }
    // El archivo.
    if (p.tipo === 'media' && Number(p.media_id) > 0 && !ex.adjuntos.has(Number(p.media_id))) p = { ...p, media_id: null };
    // Las partes de un mensaje de varias.
    if (Array.isArray(p.partes)) {
      p = {
        ...p, partes: (p.partes as Array<Record<string, unknown>>).flatMap((x) => {
          if (x?.tipo === 'audio' && !ex.audios.has(Number(x.audio_id))) {
            const guion = guiones[String(x.audio_id)]?.trim();
            return guion ? [{ tipo: 'texto', cuerpo: guion, ...(x.pausa_s != null ? { pausa_s: x.pausa_s } : {}) }] : [];
          }
          if (x?.tipo === 'media' && !ex.adjuntos.has(Number(x.media_id))) return [];
          return [x];
        }) as unknown as PasoCopiado['partes'],
      };
    }
    // La línea de WhatsApp: sin ella, sale por la de la automatización.
    if (typeof p.linea === 'string' && p.linea && !ex.lineas.has(p.linea)) { const { linea: _l, ...resto } = p; void _l; p = resto as PasoCopiado; }
    // Las etiquetas de una tarjeta TAG.
    const acc = p.accion as { operacion?: unknown; params?: Record<string, unknown> } | null | undefined;
    if (acc && esObjeto(acc.params)) {
      const params = { ...acc.params };
      if (params.etiquetaId != null && !ex.etiquetas.has(Number(params.etiquetaId))) delete params.etiquetaId;
      if (Array.isArray(params.etiquetaIds)) {
        const vivas = (params.etiquetaIds as unknown[]).filter((x) => ex.etiquetas.has(Number(x)));
        if (vivas.length) params.etiquetaIds = vivas; else delete params.etiquetaIds;
        if (params.etiquetaId == null && vivas.length) params.etiquetaId = vivas[0];
      }
      p = { ...p, accion: { ...acc, params } };
    }
    // Las filas de una condición.
    if (Array.isArray(p.ramas)) {
      p = {
        ...p, ramas: p.ramas.map((r) => ({
          ...r, filas: (r.filas ?? []).map((f) => {
            if (f.campo === 'etiqueta' && f.valor != null && !ex.etiquetas.has(Number(f.valor))) return { ...f, valor: null };
            if (f.campo === 'etapa' && f.valor != null && f.valor !== '') {
              const k = `${f.funnel_id ?? ''}:${String(f.valor)}`;
              if (!ex.etapas.has(k)) return { ...f, valor: null, funnel_id: null };
            }
            return f;
          }),
        })),
      };
    }
    // Un «Ir a» a otra automatización de aquel negocio.
    if (p.destino && typeof p.destino === 'object' && 'secuencia_id' in p.destino) {
      const sid = Number((p.destino as { secuencia_id: unknown }).secuencia_id);
      if (!ex.secuencias.has(sid)) p = { ...p, destino: null };
    }
    return p;
  });
}

/** ¿Tiene algo que limpiar contra este negocio? (para no pedirle nada al server si no hace falta). */
export function referenciasDe(pasos: readonly PasoCopiado[]): boolean {
  return pasos.some((p) => Number(p.audio_id) > 0 || Number(p.media_id) > 0 || (typeof p.linea === 'string' && !!p.linea)
    || Array.isArray(p.partes) || !!(p.accion as { params?: unknown } | null | undefined)?.params
    || (Array.isArray(p.ramas) && p.ramas.some((r) => (r.filas ?? []).some((f) => f.campo === 'etiqueta' || f.campo === 'etapa')))
    || (!!p.destino && typeof p.destino === 'object' && 'secuencia_id' in p.destino));
}

/** El id del CRON de una copia entera (para quien la crea: el nodo de inicio viaja con sus flechas). */
export const ID_CRON_COPIA = ID_INICIO;

// ── EL TOKEN (decimoquinta tanda, 12/10/2026, punto 8) ──────────────────────────────────────────
// Martín, textual: «Me gustaría que al momento de copiar un flujo se cree como un ID o Token para que los usuarios se
// pasen ese token, y al momento de pegar eso por ejemplo en el input de texto, en lugar de ver el token debería decir
// "Flujo copiado: NOMBRE DEL FLUJO"...». «Copiar flujo» (el «⋯» de la lista y el click derecho del CRON) ya no pone el
// JSON entero en el portapapeles: el server guarda la copia (tabla `flujo_copias`, mig 0265, lib/flujo-copia-negocio.ts)
// y devuelve un TOKEN corto, que es lo que se copia y se pasa por WhatsApp. Pegarlo —en la caja de «Nueva automatización»,
// con «Pegar un flujo» del «+», en el aviso al entrar o con Ctrl+V en un lienzo— lo resuelve el server.
//   · Copiar TARJETAS sueltas (Ctrl+C en el lienzo) sigue siendo el texto entero: es de una pestaña a otra, al momento.
//   · El texto entero de antes SE SIGUE LEYENDO en todos lados (`leerCopia`): hay copias circulando, y es lo que copia
//     el botón si falta la tabla.

/** El comienzo de todo token (dice qué es, también en un WhatsApp). */
export const PREFIJO_TOKEN = 'MAKO-FLUJO-';
/** Crockford base 32: sin I, L, O ni U (no se confunden al dictarlo ni al copiarlo a mano). 32 letras = 5 bits cada una. */
const ALFABETO_TOKEN = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Las letras al azar del token: 10 × 5 = 50 bits. */
export const LARGO_TOKEN = 10;
const RE_TOKEN = new RegExp(`${PREFIJO_TOKEN}([0-9A-HJKMNP-TV-Z]{${LARGO_TOKEN}})(?![0-9A-Z])`, 'i');

/**
 * Un token desde bytes al azar (el server le pasa `randomBytes(LARGO_TOKEN)`). `& 31` sobre un byte parejo es parejo
 * (256 es múltiplo de 32). Pura para el test; con menos bytes de los que hacen falta, tira.
 */
export function tokenDeBytes(bytes: ArrayLike<number>): string {
  if (bytes.length < LARGO_TOKEN) throw new Error(`tokenDeBytes: hacen falta ${LARGO_TOKEN} bytes`);
  let s = PREFIJO_TOKEN;
  for (let i = 0; i < LARGO_TOKEN; i++) s += ALFABETO_TOKEN[bytes[i] & 31];
  return s;
}

/** El token que hay en un texto (pegado solo o en una frase: «te paso el flujo: MAKO-FLUJO-…»), normalizado. Si no, null. */
export function tokenDeTexto(texto: unknown): string | null {
  if (typeof texto !== 'string' || texto.length > TOPE_TEXTO) return null;
  const m = RE_TOKEN.exec(texto);
  return m ? `${PREFIJO_TOKEN}${m[1].toUpperCase()}` : null;
}

/**
 * LO PEGADO EN LA CAJA (`onValor`): ¿trae un flujo de MaKo? Un token (sale del texto: lo demás queda escrito) o una copia
 * entera de las de antes (el texto entero es la copia). `copia` es lo que se manda al server (`crear_desde_copia`).
 */
export function copiaPegada(texto: string): { copia: string; resto: string } | null {
  const token = tokenDeTexto(texto);
  if (token) {
    const resto = texto.replace(new RegExp(RE_TOKEN.source, 'ig'), ' ').replace(/[ \t]{2,}/g, ' ').trim();
    return { copia: token, resto };
  }
  return leerCopia(texto) ? { copia: texto, resto: '' } : null;
}

/** Lo que se dice de una copia sin abrirla: su nombre (o cuántas tarjetas), si es un flujo entero, y cuántas tarjetas. */
export type ResumenCopia = { nombre: string; que: CopiaFlujo['que']; tarjetas: number };

export function resumenDeCopia(c: CopiaFlujo): ResumenCopia {
  const tarjetas = c.pasos.filter((p) => claseDe(p) !== 'inicio').length;
  return { nombre: c.nombre ?? (tarjetas === 1 ? 'una tarjeta' : `${tarjetas} tarjetas`), que: c.que, tarjetas };
}

/** Lo que dice la caja en lugar del token (punto 8: «Flujo copiado: NOMBRE DEL FLUJO»). */
export const rotuloFlujoPegado = (nombre: string): string => `Flujo copiado: ${nombre}`;
