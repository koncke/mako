// =============================================================================
// api-mako/registro — TODAS las operaciones de MaKo, en un solo lugar
// =============================================================================
// Acá se juntan las definiciones de cada área (areas/<area>.def.ts) y de acá salen
// el catálogo HTTP, los ToolDefs del doer, la referencia y la skill. Nada se copia.
//
// SIN `server-only`, a propósito: lo importan los tests, el generador de docs y el
// catálogo. Lo que toca la base vive en los `.run.ts`, que sí son server-only.
//
// ⚠️ Sin server-only NO significa apto para el navegador: un `'use client'` NO puede
// importar un valor de acá (~400 descripciones al bundle de cada cliente).
// tests/api-mako-registro.test.ts lo cuida como catalogo-fuera-del-bundle cuida el
// catálogo de credenciales.
//
// ⚠️ Los ids son CONTRATO: los usa el doer de WhatsApp (mako-intencion.ts nombra
// tools), la skill instalada en la máquina de cada cliente y las pendientes que
// quedaron en la base con su `tipo`. Renombrar una es romper las tres; se agrega
// un alias y se deja el nombre.
//
// ⚠️ Un id repetido o un área ajena se detectan al cargar y en el test. Acá NO se
// lanza: una guarda que se comporta distinto en local y en producción es la clase
// de bug que ya costó meses (gateConfigurado). Se registra y la operación coja
// contesta su error cuando la piden; el test es lo que frena el push.
// =============================================================================

import type { ToolDef } from '@/lib/anthropic';
import {
  AREAS, AREA_INFO, esAccion, esControl, esLectura, alcanceMinimo,
  type Alcance, type Area, type Canal, type OperacionDef,
} from './tipos';
import { permite } from './alcance';
import { permitePorArea, type Permisos } from './permisos';
import { tabEnCapa } from '@/lib/capas';
import { esquemaJson } from './validar';

import { DEFS as general } from './areas/general.def';
import { DEFS as plan } from './areas/plan.def';
import { DEFS as crm } from './areas/crm.def';
import { DEFS as ads } from './areas/ads.def';
import { DEFS as chats } from './areas/chats.def';
import { DEFS as whatsapp } from './areas/whatsapp.def';
import { DEFS as email } from './areas/email.def';
import { DEFS as chatbot } from './areas/chatbot.def';
import { DEFS as metricas } from './areas/metricas.def';
// El EDITOR del Dashboard (11/10/2026): es del área `metricas` («Dashboard y análisis») pero vive en su
// propio archivo. tests/api-mako-registro.test.ts sabe que el área tiene dos archivos de runners.
import { DEFS as dashboard } from './areas/dashboard.def';
import { DEFS as experimentos } from './areas/experimentos.def';
import { DEFS as landing } from './areas/landing.def';
import { DEFS as closing } from './areas/closing.def';
import { DEFS as negocio } from './areas/negocio.def';
import { DEFS as contenido } from './areas/contenido.def';
import { DEFS as video } from './areas/video.def';
import { DEFS as imagen } from './areas/imagen.def';
import { DEFS as integraciones } from './areas/integraciones.def';
import { DEFS as equipo } from './areas/equipo.def';
import { DEFS as cs } from './areas/cs.def';
import { DEFS as curso } from './areas/curso.def';
import { DEFS as creaciones } from './areas/creaciones.def';
import { DEFS as cobros } from './areas/cobros.def';
import { DEFS as calendario } from './areas/calendario.def';
import { DEFS as mako } from './areas/mako.def';

/** Por área, en el orden de la barra. El orden es el del catálogo y la referencia. */
const POR_AREA: Record<Area, readonly OperacionDef[]> = {
  general, plan, crm, ads, chats, whatsapp, email, chatbot, metricas: [...metricas, ...dashboard], experimentos,
  landing, closing, negocio, contenido, video, imagen, integraciones, equipo, cs, curso, creaciones, cobros, calendario, mako,
};

export const REGISTRO: readonly OperacionDef[] = AREAS.flatMap((a) => POR_AREA[a]);

/** Problemas de sanidad detectados al cargar (ids repetidos, alias que pisan). El
 *  test los exige vacíos; en runtime se registran una vez. */
export const PROBLEMAS_DE_CARGA: string[] = [];

const POR_ID = new Map<string, OperacionDef>();
(() => {
  const dueno = new Map<string, string>();
  for (const d of REGISTRO) {
    if (!/^[a-z][a-z0-9_]*$/.test(d.id)) PROBLEMAS_DE_CARGA.push(`el id «${d.id}» no es snake_case`);
    if (dueno.has(d.id)) PROBLEMAS_DE_CARGA.push(`el id «${d.id}» está en «${dueno.get(d.id)}» y en «${d.area}»`);
    else { dueno.set(d.id, d.area); POR_ID.set(d.id, d); }
  }
  for (const d of REGISTRO) {
    for (const alias of d.alias ?? []) {
      if (dueno.has(alias)) { PROBLEMAS_DE_CARGA.push(`el alias «${alias}» de «${d.id}» choca con «${dueno.get(alias)}»`); continue; }
      dueno.set(alias, `alias de ${d.id}`);
      POR_ID.set(alias, d);
    }
    // El `tipo` con que se persiste una pendiente también resuelve: es lo que lee la
    // confirmación, y las heredadas usan el slug de ejecutarAccion ('lead_etapa').
    const tp = esAccion(d) ? d.tipoPendiente : undefined;
    if (tp && tp !== d.id) {
      const quien = dueno.get(tp);
      if (quien === `alias de ${d.id}`) continue;
      if (quien) { PROBLEMAS_DE_CARGA.push(`el tipoPendiente «${tp}» de «${d.id}» choca con «${quien}»`); continue; }
      dueno.set(tp, `tipoPendiente de ${d.id}`);
      POR_ID.set(tp, d);
    }
  }
  if (PROBLEMAS_DE_CARGA.length) console.error(`[api-mako] registro con problemas:\n  ${PROBLEMAS_DE_CARGA.join('\n  ')}`);
})();

/** La operación por id (o por alias viejo). `undefined` si no existe. */
export const porId = (id: string): OperacionDef | undefined => POR_ID.get((id ?? '').trim());

export const porArea = (area: Area): readonly OperacionDef[] => POR_AREA[area] ?? [];

export const esArea = (s: string): s is Area => (AREAS as readonly string[]).includes(s);

/** Con qué mira el catálogo quien pide. Es lo que decide qué VE, no solo qué puede
 *  llamar: a quien no le corresponde, la operación no existe (404, no 403). */
export type Vista = {
  canal: Canal;
  alcance: Alcance;
  ws: number;
  rol: 'admin' | 'miembro';
  /** las keys de nav.ts que la capa del workspace incluye; `null` = todas */
  tabs: readonly string[] | null;
  /** ¿El workspace es el de la plataforma (capa `superadmin`)? Lo pone `vistaDe`; ausente = no. */
  plataforma?: boolean;
  /** los permisos POR ÁREA de un token detallado (lib/api-mako/permisos.ts). Ausente =
   *  sin restricción por área: los demás canales y el token clásico. */
  permisos?: Permisos;
};

/** El workspace principal (Fase 1 de Meta). Vive acá y no importado de
 *  lib/workspace.ts para que este módulo siga sin server-only. */
export const WS_PRINCIPAL = 1;

/**
 * ¿El gating de esta operación deja pasar a esta vista? Workspace principal, rol y
 * capa — sin mirar canal ni alcance. Es la pregunta que se vuelve a hacer AL
 * CONFIRMAR: ahí el canal es el de quien confirma (la bandeja, un grupo) y no el de
 * quien propuso, y el alcance ya lo decidió `puedeConfirmar`.
 */
export function gatingOk(def: OperacionDef, v: Pick<Vista, 'ws' | 'rol' | 'tabs' | 'plataforma'> & { permisos?: Permisos }): boolean {
  const g = def.gating;
  if (g?.soloWs1 && !(v.ws === WS_PRINCIPAL && v.rol === 'admin')) return false;
  // En positivo: sólo si la vista DICE que es la plataforma. Una vista armada sin el dato no pasa.
  if (g?.soloPlataforma && v.plataforma !== true) return false;
  if (g?.rolMinimo === 'admin' && v.rol !== 'admin') return false;
  if (g?.tab && v.tabs && !v.tabs.includes(g.tab)) return false;
  // Un token detallado: el nivel de SU área (08/10/2026, copiando GitHub). Va acá y no en
  // `visible()` porque esta misma pregunta se repite al CONFIRMAR (acciones.ts): sin eso,
  // un token con escritura sólo en «mako» confirmaba pendientes de cualquier área.
  if (v.permisos && !permitePorArea(v.permisos, def)) return false;
  return true;
}

/** ¿Esta operación existe para esta vista? Canal, alcance y gating: todo en positivo. */
export function visible(def: OperacionDef, v: Vista): boolean {
  if (!def.canales.includes(v.canal)) return false;
  if (!permite(v.alcance, def)) return false;
  return gatingOk(def, v);
}

/** El ToolDef que ve Claude, derivado. La `description` es la `descripcion` textual,
 *  con el sufijo que dice cómo se confirma cuando es una acción. */
export function aToolDef(def: OperacionDef): ToolDef {
  const cola = esAccion(def)
    ? (def.confirmacion === 'chat'
        ? ' PROPONE la acción y devuelve un resumen: NO la ejecuta hasta que la persona confirma con un «sí» aparte.'
        : ' Deja una PROPUESTA y devuelve un LINK a la pantalla donde la persona la revisa y confirma: pásalo tal cual y no pidas confirmación por el chat.')
    : '';
  return { name: def.id, description: `${def.descripcion}${cola}`, input_schema: esquemaJson(def.parametros) };
}

export type FiltroTools = {
  vista: Vista;
  /** solo estas áreas (default: todas) */
  areas?: readonly Area[];
  /** `false` = solo lecturas (sin acciones ni controles) */
  incluirAcciones?: boolean;
  /** solo estos ids (para los turnos acotados por intención) */
  ids?: readonly string[];
  /** fuera estos nombres (id o alias): las que el consumidor ya trae por otro camino.
   *  El doer de WhatsApp conserva sus 26 herramientas de siempre y suma las demás. */
  excluir?: ReadonlySet<string>;
  /** presupuesto de caracteres del esquema para el turno; se corta al llegar y se
   *  avisa por consola qué quedó afuera. Groq corta en 7 k tokens de entrada. */
  maxChars?: number;
  /** el mensaje del turno: con esto, antes de aplicar el presupuesto, las operaciones
   *  se ordenan por cuántas palabras del mensaje nombran. Sin esto el tope corta por
   *  orden de declaración, y en un área de 50 operaciones «pausá la campaña X» se
   *  quedaba con las primeras 15 lecturas y sin la acción que pidió. */
  relevanteA?: string;
};

/** Los ToolDefs para un turno del doer, según el filtro. */
export function toolsDelRegistro(f: FiltroTools): ToolDef[] {
  const ids = f.ids ? new Set(f.ids) : null;
  const defs = REGISTRO
    .filter((d) => !f.areas || f.areas.includes(d.area))
    .filter((d) => f.incluirAcciones !== false || esLectura(d))
    .filter((d) => visible(d, f.vista))
    .filter((d) => !ids || ids.has(d.id) || (d.alias ?? []).some((a) => ids.has(a)))
    .filter((d) => !f.excluir || !(f.excluir.has(d.id) || (d.alias ?? []).some((a) => f.excluir!.has(a))));
  const tools = (f.relevanteA ? ordenarPorRelevancia(defs, f.relevanteA) : defs).map(aToolDef);
  if (!f.maxChars) return tools;
  const out: ToolDef[] = [];
  let usados = 0;
  const afuera: string[] = [];
  for (const t of tools) {
    const largo = JSON.stringify(t).length;
    if (usados + largo > f.maxChars) { afuera.push(t.name); continue; }
    usados += largo; out.push(t);
  }
  if (afuera.length) console.warn(`[api-mako] presupuesto de ${f.maxChars} chars: quedaron afuera ${afuera.join(', ')}`);
  return out;
}

/** Cuánto pesa el esquema de un conjunto de tools (para medir, no para adivinar). */
export const charsDeTools = (tools: readonly ToolDef[]): number => tools.reduce((n, t) => n + JSON.stringify(t).length, 0);

/** El catálogo que sirve GET /api/v1: lo que ESTA vista puede pedir. */
export function catalogo(v: Vista) {
  return AREAS.map((area) => ({
    area,
    ...AREA_INFO[area],
    operaciones: porArea(area).filter((d) => visible(d, v)).map(resumenDeOperacion),
  })).filter((a) => a.operaciones.length);
}

/** Los ids que una vista puede pedir en un área (para los 404 con `disponibles`). */
export const disponiblesEn = (area: Area, v: Vista): string[] => porArea(area).filter((d) => visible(d, v)).map((d) => d.id);

export function resumenDeOperacion(d: OperacionDef) {
  const metodo = esLectura(d) ? 'GET' : 'POST';
  return {
    id: d.id,
    tipo: d.tipo,
    titulo: d.titulo,
    descripcion: d.descripcion,
    metodo,
    ruta: `/api/v1/${d.area}/${d.id}`,
    alcance: alcanceMinimo(d),
    parametros: d.parametros,
    ...(esAccion(d) ? { confirmacion: d.confirmacion, reversible: d.reversible, escribe: d.escribe, ...(d.pantalla ? { pantalla: d.pantalla } : {}) } : {}),
    ...(esLectura(d) ? { salida: d.salida, ...(d.formatos ? { formatos: d.formatos } : {}) } : {}),
    ...(esControl(d) ? { control: true } : {}),
    costo: d.costo,
    ...(d.lenta ? { lenta: true } : {}),
    ...(d.gating ? { gating: d.gating } : {}),
  };
}

// ── Relevancia de una operación para un mensaje ────────────────────────────────

const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, ' ');

/** Las raíces de las palabras con contenido de un texto: 4 letras o más, cortadas a 5
 *  para que «campaña» encuentre «campañas» y «pausá» encuentre «pausar». Burdo a
 *  propósito: es un orden, no un filtro — lo que no matchea igual entra si hay lugar. */
export function raices(texto: string): string[] {
  const vistas = new Set<string>();
  for (const p of normalizar(texto).split(/[^a-z0-9]+/)) {
    if (p.length < 4) continue;
    vistas.add(p.slice(0, 5));
  }
  return [...vistas];
}

/**
 * Ordena (estable) las operaciones por cuántas raíces del mensaje aparecen en su id,
 * título y descripción. El id y el título pesan el doble: son lo que la operación ES;
 * la descripción también nombra lo que necesita antes. Empates: el orden declarado,
 * que pone las lecturas primero.
 */
export function ordenarPorRelevancia<T extends OperacionDef>(defs: readonly T[], mensaje: string): T[] {
  const rs = raices(mensaje);
  if (!rs.length) return [...defs];
  const puntaje = (d: T): number => {
    const fuerte = normalizar(`${d.id} ${d.titulo}`);
    const debil = normalizar(d.descripcion);
    return rs.reduce((n, r) => n + (fuerte.includes(r) ? 2 : debil.includes(r) ? 1 : 0), 0);
  };
  return defs
    .map((d, i) => ({ d, i, p: puntaje(d) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((x) => x.d);
}

// ── Qué tabs ve una capa, para el gating ──────────────────────────────────────

/**
 * Las `gating.tab` del registro que la capa del workspace ve, o null si las ve todas.
 *
 * Pregunta con `tabEnCapa`, la MISMA función que usa el gate de las páginas
 * (requireCapa): une la barra principal y el menú de la foto. La primera versión
 * miraba solo `navKeys`, y como `integraciones` vive en el menú de la foto, el
 * super-admin (que ve /integraciones) no veía ninguna operación de esa área: 404.
 */
export function tabsDeCapa(capa: string | null | undefined): readonly string[] | null {
  const todas = [...new Set(REGISTRO.map((d) => d.gating?.tab).filter((t): t is string => !!t))];
  const vistas = todas.filter((t) => tabEnCapa(t, capa));
  return vistas.length === todas.length ? null : vistas;
}
