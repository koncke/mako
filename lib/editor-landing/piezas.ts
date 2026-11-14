// =============================================================================
// editor-landing/piezas — lo que una landing del Web Generator le trae al CRM, por nombre (14/11/2026)
// =============================================================================
// La llamada de Martín con Julio Mazariegos (13/11, docs/relevo/llamada-julio-13-11.md, puntos 2-4): Julio viene de
// GoHighLevel y preguntó «creo tres landings: una regalo, otra video, otra para agendar; ¿cómo distingo qué formulario dispara
// el flujo?». Martín le dijo que en «Asignar campañas» del CRM aparecían los formularios activos, y no aparecía nada: lo único
// que distinguía de dónde venía un lead era la URL EXACTA de la página, cargada a mano en /integraciones. Martín, 14/11: «si se
// arma un formulario o piensa en otras cosas que se pueden armar en Web Generator, que se pueda asignar dentro del lead
// entrante. Eso es súper importante».
//
// Una PIEZA es lo que, dentro de una landing publicada, hace entrar a alguien al CRM:
//   · un formulario, una encuesta o un quiz → por su id ESTABLE (`data-mako-form`, que el Pixel v29 manda con el opt-in);
//   · una agenda embebida (Calendly, Cal.com) → por su página («<docId>:<paginaId>», `data-mako-pagina`);
//   · un botón de pago → por su página (lo resuelve el paso de pago, que sabe de qué landing y página viene).
// Cada una tiene una CLAVE (`form:<id>`, `agenda:<docId>:<paginaId>`, `pago:<docId>:<paginaId>`) y un nombre que se ve:
// el que le puso el negocio, o «<landing> · <página>».
//
// LA ASIGNACIÓN (qué pieza va a qué CRM) es un ajuste del negocio, `landing.piezas` (`AsignacionesPiezas`): no hace falta
// migración y no tiene el tope de 12 URLs de `landing.config`. El opt-in la mira ANTES que la URL (app/api/track/optin).
//
// ⚠️ PURO: sin server-only, sin base. Lo usan publicar.ts (la foto guarda las piezas), el CRM, la ruta del opt-in y la API.
// =============================================================================

import { NODO, type JsonNodo, type LandingContenido } from './doc';
import { attrsFormulario, nombreDeFormulario } from './especificacion';
import { attrsQuiz, quizListo } from './quiz';
import { claseDeProveedor } from '../embeds';
import { productoDeHref } from './pago-landing';

export const TIPOS_PIEZA = ['formulario', 'encuesta', 'quiz', 'agenda', 'pago'] as const;
export type TipoPieza = (typeof TIPOS_PIEZA)[number];

export type PiezaWeb = {
  clave: string;
  tipo: TipoPieza;
  /** El nombre que se ve: «Formulario Regalo», «Lanzamiento · Inicio». */
  nombre: string;
  /** Qué es, dicho como lo diría el negocio: «Registro al webinar», «Descarga del lead magnet», «Agenda», «Pago». */
  rotulo: string;
  paginaId: string;
  pagina: string;
  ruta: string;
  formularioId?: string;
  productoId?: number;
};

/** Lo que dice cada tipo cuando la plantilla no dice algo mejor. */
const ROTULO: Record<TipoPieza, string> = {
  formulario: 'Formulario', encuesta: 'Encuesta', quiz: 'Quiz', agenda: 'Agenda', pago: 'Pago',
};

/** El formulario de una plantilla de evento o de descarga se nombra por lo que es (relevo, punto 4). */
const ROTULO_DE_PLANTILLA: Record<string, string> = {
  webinar: 'Registro al webinar',
  'clase-grabada': 'Registro a la clase',
  'lead-magnet': 'Descarga del lead magnet',
  'lista-espera': 'Lista de espera',
};

export const claveDeFormulario = (id: string): string => `form:${id}`;
export const claveDePagina = (tipo: 'agenda' | 'pago', docId: number, paginaId: string): string => `${tipo}:${docId}:${paginaId}`;
/** «Cualquier formulario de la landing X» (el disparador de Automations). */
export const claveDeLanding = (docId: number): string => `landing:${docId}`;

const FORMA_CLAVE = /^(form:[A-Za-z0-9_-]{1,40}|(agenda|pago):\d{1,12}:[A-Za-z0-9_-]{1,40}|landing:\d{1,12})$/;
export const claveValida = (v: unknown): v is string => typeof v === 'string' && FORMA_CLAVE.test(v);

/** Un id de formulario como llega del Pixel (`data-mako-form`), o null. */
export function idDeFormularioPixel(v: unknown): string | null {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v.trim()) ? v.trim() : null;
}

/** «<docId>:<paginaId>» del Pixel (`data-mako-pagina`), o null. */
export function paginaDePixel(v: unknown): { docId: number; paginaId: string } | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,12}):([A-Za-z0-9_-]{1,40})$/.exec(v.trim());
  return m ? { docId: Number(m[1]), paginaId: m[2] } : null;
}

function recorrer(n: unknown, f: (n: JsonNodo) => void, prof = 0): void {
  if (!n || typeof n !== 'object' || prof > 40) return;
  const x = n as JsonNodo;
  f(x);
  if (Array.isArray(x.content)) for (const h of x.content) recorrer(h, f, prof + 1);
}

/**
 * Las piezas de una landing, en el orden de sus páginas y de arriba hacia abajo. Dos formularios con el mismo nombre en una
 * landing se distinguen con « · 2», « · 3». `plantilla`: la de origen (`config.origen.plantilla`), para nombrar el formulario
 * de un webinar o de un lead magnet por lo que es.
 */
export function piezasDeContenido(docId: number, landing: string, contenido: Pick<LandingContenido, 'paginas'>, plantilla?: string | null): PiezaWeb[] {
  const out: PiezaWeb[] = [];
  const rotuloForm = (plantilla && ROTULO_DE_PLANTILLA[plantilla]) || ROTULO.formulario;
  for (const p of contenido.paginas ?? []) {
    let agenda = false;
    let pago: number | null = null;
    const base = { paginaId: p.id, pagina: p.titulo, ruta: p.ruta };
    recorrer(p.doc, (n) => {
      if (n.type === NODO.formulario) {
        const a = attrsFormulario(n.attrs);
        if (!a.id) return;
        const tipo: TipoPieza = a.clase === 'encuesta' ? 'encuesta' : 'formulario';
        out.push({ clave: claveDeFormulario(a.id), tipo, nombre: nombreDeFormulario(a.nombre, landing, p.titulo), rotulo: tipo === 'encuesta' ? ROTULO.encuesta : rotuloForm, ...base, formularioId: a.id });
      } else if (n.type === NODO.quiz) {
        const a = attrsQuiz(n.attrs);
        if (!a.id || !quizListo(n.attrs)) return;
        const nombre = a.nombre || (a.titulo ? `Quiz ${a.titulo}` : nombreDeFormulario('', landing, p.titulo));
        out.push({ clave: claveDeFormulario(a.id), tipo: 'quiz', nombre, rotulo: ROTULO.quiz, ...base, formularioId: a.id });
      } else if (n.type === NODO.insertado && claseDeProveedor((n.attrs as Record<string, unknown> | undefined)?.proveedor) === 'agenda'
        && typeof (n.attrs as Record<string, unknown> | undefined)?.src === 'string' && (n.attrs as Record<string, string>).src) {
        agenda = true;
      } else if (n.type === NODO.boton && pago == null) {
        pago = productoDeHref((n.attrs as Record<string, unknown> | undefined)?.href);
      }
    });
    // «Agenda de Clase en vivo», «Pago de Diagnóstico»: la página se suma sólo si dice algo más (una página «Agenda» no).
    const dePagina = (que: string) => `${que} de ${landing.trim() || 'la landing'}${p.titulo && !new RegExp(que, 'i').test(p.titulo) ? ` · ${p.titulo}` : ''}`;
    if (agenda) out.push({ clave: claveDePagina('agenda', docId, p.id), tipo: 'agenda', nombre: dePagina('Agenda'), rotulo: ROTULO.agenda, ...base });
    if (pago != null) out.push({ clave: claveDePagina('pago', docId, p.id), tipo: 'pago', nombre: dePagina('Pago'), rotulo: ROTULO.pago, ...base, productoId: pago });
  }
  // Nombres repetidos dentro de la landing (dos formularios sin nombre propio en la misma página): « · 2», « · 3».
  const vistos = new Map<string, number>();
  for (const x of out) {
    const k = x.nombre.toLowerCase();
    const n = (vistos.get(k) ?? 0) + 1;
    vistos.set(k, n);
    if (n > 1) x.nombre = `${x.nombre} · ${n}`;
  }
  return out;
}

/** Las piezas como las guarda la foto publicada (`FotoPublicada.piezas`): leídas de un JSON que puede venir de cualquier lado. */
export function piezasGuardadas(v: unknown): PiezaWeb[] {
  if (!Array.isArray(v)) return [];
  const out: PiezaWeb[] = [];
  for (const x of v.slice(0, 200)) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (!claveValida(o.clave) || !(TIPOS_PIEZA as readonly unknown[]).includes(o.tipo)) continue;
    const s = (k: string, tope = 160) => (typeof o[k] === 'string' ? (o[k] as string).slice(0, tope) : '');
    out.push({
      clave: o.clave, tipo: o.tipo as TipoPieza, nombre: s('nombre') || 'Formulario', rotulo: s('rotulo') || ROTULO[o.tipo as TipoPieza],
      paginaId: s('paginaId', 40), pagina: s('pagina'), ruta: s('ruta'),
      ...(typeof o.formularioId === 'string' ? { formularioId: o.formularioId.slice(0, 40) } : {}),
      ...(typeof o.productoId === 'number' && Number.isInteger(o.productoId) ? { productoId: o.productoId } : {}),
    });
  }
  return out;
}

// ── La asignación: qué pieza va a qué CRM ─────────────────────────────────────

/** El ajuste del negocio con la asignación (`settings`, por workspace). */
export const CLAVE_AJUSTE_PIEZAS = 'landing.piezas';
/** Cuántas piezas asignadas guarda un negocio, y a cuántos CRM cada una. */
export const TOPE_PIEZAS = 300;
export const TOPE_CRM_POR_PIEZA = 10;

/** Clave → los ids de los CRM (funnels) a los que entra el lead, en orden: el primero es su casa. */
export type AsignacionesPiezas = Record<string, number[]>;

/** El ajuste leído (de un string de la base o de lo que sea): sólo claves válidas, ids enteros positivos, sin repetir. */
export function asignacionesDe(crudo: unknown): AsignacionesPiezas {
  let v: unknown = crudo;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return {}; } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const fuente = (v as Record<string, unknown>).asignadas ?? v;
  if (!fuente || typeof fuente !== 'object' || Array.isArray(fuente)) return {};
  const out: AsignacionesPiezas = {};
  let n = 0;
  for (const [k, ids] of Object.entries(fuente as Record<string, unknown>)) {
    if (n >= TOPE_PIEZAS) break;
    if (!claveValida(k) || !Array.isArray(ids)) continue;
    const limpios = [...new Set(ids.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0))].slice(0, TOPE_CRM_POR_PIEZA);
    if (!limpios.length) continue;
    out[k] = limpios;
    n++;
  }
  return out;
}

/** Cómo se guarda (con versión, para poder cambiar la forma sin perder lo de nadie). */
export const ajusteDePiezas = (a: AsignacionesPiezas): string => JSON.stringify({ v: 1, asignadas: a });

/** Prender o apagar un CRM para una pieza. Apagado el último, la pieza deja de estar asignada (vuelve a la URL o al negocio). */
export function conAsignacion(a: AsignacionesPiezas, clave: string, funnelId: number, prendido: boolean): AsignacionesPiezas {
  if (!claveValida(clave) || !Number.isInteger(funnelId) || funnelId <= 0) return a;
  const actuales = a[clave] ?? [];
  const nuevos = prendido ? (actuales.includes(funnelId) ? actuales : [...actuales, funnelId].slice(0, TOPE_CRM_POR_PIEZA)) : actuales.filter((x) => x !== funnelId);
  const out = { ...a };
  if (nuevos.length) out[clave] = nuevos; else delete out[clave];
  return out;
}

/**
 * A qué CRM entra un opt-in según lo asignado, o [] si nada lo dice (y sigue la URL de `landing.config`, como siempre):
 *   1. el formulario, por su id (`form:<id>`);
 *   2. la agenda de la página (`agenda:<docId>:<paginaId>`), si vino de una agenda.
 * La de «cualquier formulario de la landing» (`landing:<docId>`) es del disparador, no del ruteo: no se mira acá.
 */
export function crmsDePieza(a: AsignacionesPiezas, e: { formularioId?: string | null; pagina?: { docId: number; paginaId: string } | null; origen?: string | null }): { clave: string; funnels: number[] } | null {
  if (e.formularioId) {
    const k = claveDeFormulario(e.formularioId);
    if (a[k]?.length) return { clave: k, funnels: a[k] };
  }
  if (e.pagina && e.origen === 'agenda') {
    const k = claveDePagina('agenda', e.pagina.docId, e.pagina.paginaId);
    if (a[k]?.length) return { clave: k, funnels: a[k] };
  }
  return null;
}

const normal = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[«»"'·]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * LA PIEZA QUE NOMBRA UNA PERSONA (la API de MaKo: «conectá el formulario Regalo al funnel Ventas»): por su clave exacta, o por
 * su nombre (sin mayúsculas ni acentos), o «cualquier formulario» de una landing por el título de la landing (`conLanding`).
 * Con dos que calzan, contesta las opciones: un formulario equivocado manda leads a otro CRM.
 */
export function piezaPorTexto(
  landings: ReadonlyArray<{ docId: number; titulo: string; piezas: readonly PiezaWeb[] }>,
  texto: string,
  o: { conLanding?: boolean; tipos?: readonly TipoPieza[] } = {},
): { ok: true; clave: string; nombre: string } | { ok: false; motivo: string; opciones: string[] } {
  const t = texto.trim();
  const todas = landings.flatMap((l) => l.piezas.filter((p) => !o.tipos || o.tipos.includes(p.tipo)).map((p) => ({ l, p })));
  const porClave = todas.find((x) => x.p.clave === t);
  if (porClave) return { ok: true, clave: porClave.p.clave, nombre: porClave.p.nombre };
  if (o.conLanding) {
    const m = /^landing:(\d{1,12})$/.exec(t);
    const l = m ? landings.find((x) => x.docId === Number(m[1])) : null;
    if (l) return { ok: true, clave: claveDeLanding(l.docId), nombre: l.titulo };
  }
  const n = normal(t);
  if (!n) return { ok: false, motivo: 'Falta el formulario.', opciones: [] };
  const exactas = todas.filter((x) => normal(x.p.nombre) === n);
  const parecidas = exactas.length ? exactas : todas.filter((x) => normal(x.p.nombre).includes(n));
  if (parecidas.length === 1) return { ok: true, clave: parecidas[0].p.clave, nombre: parecidas[0].p.nombre };
  if (o.conLanding) {
    const ls = landings.filter((l) => normal(l.titulo) === n);
    if (ls.length === 1 && !parecidas.length) return { ok: true, clave: claveDeLanding(ls[0].docId), nombre: ls[0].titulo };
  }
  const opciones = (parecidas.length ? parecidas : todas).slice(0, 12).map((x) => `«${x.p.nombre}» (${x.p.clave})`);
  if (!todas.length) return { ok: false, motivo: 'No hay formularios en las landings publicadas del Web Generator.', opciones: [] };
  return { ok: false, motivo: parecidas.length ? `Hay ${parecidas.length} que se llaman así.` : `No encontré «${t}».`, opciones };
}
