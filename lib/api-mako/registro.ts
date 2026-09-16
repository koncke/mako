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
import { esquemaJson } from './validar';

import { DEFS as general } from './areas/general.def';
import { DEFS as plan } from './areas/plan.def';
import { DEFS as crm } from './areas/crm.def';
import { DEFS as ads } from './areas/ads.def';
import { DEFS as whatsapp } from './areas/whatsapp.def';
import { DEFS as email } from './areas/email.def';
import { DEFS as chatbot } from './areas/chatbot.def';
import { DEFS as instagram } from './areas/instagram.def';
import { DEFS as metricas } from './areas/metricas.def';
import { DEFS as experimentos } from './areas/experimentos.def';
import { DEFS as landing } from './areas/landing.def';
import { DEFS as closing } from './areas/closing.def';
import { DEFS as negocio } from './areas/negocio.def';
import { DEFS as contenido } from './areas/contenido.def';
import { DEFS as video } from './areas/video.def';
import { DEFS as integraciones } from './areas/integraciones.def';
import { DEFS as equipo } from './areas/equipo.def';
import { DEFS as cs } from './areas/cs.def';
import { DEFS as mako } from './areas/mako.def';

/** Por área, en el orden de la barra. El orden es el del catálogo y la referencia. */
const POR_AREA: Record<Area, readonly OperacionDef[]> = {
  general, plan, crm, ads, whatsapp, email, chatbot, instagram, metricas, experimentos,
  landing, closing, negocio, contenido, video, integraciones, equipo, cs, mako,
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
};

/** El workspace principal (Fase 1 de Meta). Vive acá y no importado de
 *  lib/workspace.ts para que este módulo siga sin server-only. */
export const WS_PRINCIPAL = 1;

/** ¿Esta operación existe para esta vista? Canal, alcance, gating: todo en positivo. */
export function visible(def: OperacionDef, v: Vista): boolean {
  if (!def.canales.includes(v.canal)) return false;
  if (!permite(v.alcance, def)) return false;
  const g = def.gating;
  if (g?.soloWs1 && !(v.ws === WS_PRINCIPAL && v.rol === 'admin')) return false;
  if (g?.rolMinimo === 'admin' && v.rol !== 'admin') return false;
  if (g?.tab && v.tabs && !v.tabs.includes(g.tab)) return false;
  return true;
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
  /** presupuesto de caracteres del esquema para el turno; se corta al llegar y se
   *  avisa por consola qué quedó afuera. Groq corta en 7 k tokens de entrada. */
  maxChars?: number;
};

/** Los ToolDefs para un turno del doer, según el filtro. */
export function toolsDelRegistro(f: FiltroTools): ToolDef[] {
  const ids = f.ids ? new Set(f.ids) : null;
  const defs = REGISTRO
    .filter((d) => !f.areas || f.areas.includes(d.area))
    .filter((d) => f.incluirAcciones !== false || esLectura(d))
    .filter((d) => visible(d, f.vista))
    .filter((d) => !ids || ids.has(d.id) || (d.alias ?? []).some((a) => ids.has(a)));
  const tools = defs.map(aToolDef);
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
