// =============================================================================
// migracion-leads — pasar los contactos de OTRO CRM a MaKo, la regla sola y testeable
// =============================================================================
// La llamada con Thiago (29/10/2026, docs/promesas/2910-llamada-thiago.md): una agencia con 27 clientes en España quiere
// traer los contactos de su CRM anterior por la API, con su Claude. Martín le prometió tres cosas, y las tres viven acá:
//
//   1. **Se guarda de dónde vino:** el id del CRM viejo (`id_externo`), el CRM (`migrado_de`), la fecha en que se creó
//      allá (`fecha_original`) y las UTM. Mig 0405.
//   2. **Migrar dos veces no repite a nadie:** el id del CRM viejo es la llave. Volver a mandar un lote (porque se cortó,
//      o porque Claude lo reintentó) saltea a los que ya entraron. Lo decide `createLead` (lib/leads.ts) con la base.
//   3. **Entran QUIETOS:** un migrado no recibe ningún mensaje ni entra a ninguna automatización por haber llegado. Lo
//      escribe el `origen_lead: 'migracion'` y lo cumplen `quedaDondeLoPusieron` (app/crm/origen-lead.ts: el CRM
//      automático, los barridos sin disparador, las fotos de WhatsApp, el primer contacto) y `sinMigrados` en la cohorte
//      de las automatizaciones (lib/nutricion.ts: el barrido de la hora NUNCA toma un migrado). Lo que alguien hace A
//      PROPÓSITO después —moverlo a mano, que reserve, que conteste— sí corre, por el evento de siempre.
//
// ⚠️ NACE EN SU ETAPA, NUNCA SE MUEVE DESPUÉS (la regla de «Traer leads de a muchos», AGENTS.md). Mover a 5.000 contactos
// en bloque dispara el evento de etapa de cada uno, y ése SÍ inscribe en lo que cuelga de esa etapa. Por eso la etapa viaja
// en el alta (`pipeline_stage`) y no se ofrece mover en bloque después.
//
// ⚠️ Y SÓLO A UNA ETAPA ABIERTA. «Ganado» lo vuelve venta (con la fecha de HOY: los paneles contarían una venta que no
// pasó hoy) y cliente de Customer Success; «Perdido» y compañía le cambian el desenlace. Un contacto que el CRM viejo
// tenía ganado o perdido vuelve en `descartados` con su motivo: lo decide Martín (docs/relevo/nube-thiago-migrar.md).
//
// Sin `server-only`: lo prueba tests/migrar-leads.test.ts.
// =============================================================================

import { tieneContacto } from './contacto-minimo';
import { usuarioInstagram } from '@/app/crm/campo-inline';

/** El `origen_lead` de un migrado (app/crm/origen-lead.ts lo tiene en su catálogo). */
export const ORIGEN_MIGRACION = 'migracion';

/** Cuántos contactos por pedido: el mismo tope que el alta en lote (`proponer_leads`). */
export const TOPE_LOTE_MIGRACION = 200;

/**
 * «Ya entró con ese id del CRM viejo»: lo tira `createLead` (lib/leads.ts) y quien migra lo cuenta como «ya estaba».
 * NO es un `LeadDuplicadoError`: aquél es una SOSPECHA (el mismo email, el mismo nombre) que una persona decide; éste es
 * un hecho (la misma llave), y volver a mandar el lote tiene que ser seguro.
 */
export class LeadYaMigradoError extends Error {
  readonly leadId: number;
  constructor(leadId: number, idExterno: string) {
    super(`El contacto ${idExterno} ya entró (lead #${leadId}).`);
    this.name = 'LeadYaMigradoError';
    this.leadId = leadId;
  }
}
export const esLeadYaMigrado = (e: unknown): e is LeadYaMigradoError => e instanceof LeadYaMigradoError;

/** El nombre del índice único de la 0405: un 23505 con este nombre es «otra alta con el mismo id llegó antes». */
export const INDICE_ID_EXTERNO = 'leads_ws_id_externo_uq';

/** Lo que entra de un contacto, ya validado. */
export type ContactoMigrado = {
  /** La posición en el lote (para decir cuál falló). */
  i: number;
  idExterno: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  instagram: string | null;
  empresa: string | null;
  /** La key de la etapa en el CRM de destino; null = la de entrada. */
  etapa: string | null;
  /** ISO; null = no vino o no se pudo leer. */
  fechaOriginal: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

const txt = (v: unknown, max: number): string | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).slice(0, max);
  return typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null;
};

/**
 * La fecha en que se creó en el CRM viejo, como ISO. Acepta `2025-03-14`, una fecha con hora, o un timestamp en
 * milisegundos o segundos (HubSpot y GoHighLevel exportan las dos). Una fecha en el FUTURO o antes de 1990 no es una
 * fecha de creación: null (el contacto entra igual, sin fecha original).
 */
export function fechaOriginalDe(v: unknown, ahora: number = Date.now()): string | null {
  let ms: number | null = null;
  if (typeof v === 'number' && Number.isFinite(v)) ms = v < 1e11 ? v * 1000 : v;
  else if (typeof v === 'string' && v.trim()) {
    const t = v.trim();
    if (/^\d{9,13}$/.test(t)) { const num = Number(t); ms = num < 1e11 ? num * 1000 : num; }
    else { const p = Date.parse(t); ms = Number.isFinite(p) ? p : null; }
  }
  if (ms == null) return null;
  if (ms > ahora + 86_400_000 || ms < Date.UTC(1990, 0, 1)) return null;
  return new Date(ms).toISOString();
}

/** El nombre del CRM viejo, limpio (lo que se guarda en `migrado_de`). */
export const migradoDeLimpio = (v: unknown): string | null => txt(v, 80);

export type LoteLeido = { contactos: ContactoMigrado[]; descartados: string[] };

/**
 * Lee el lote crudo que manda Claude. Cada contacto necesita su id del CRM viejo, un nombre y por dónde contactarlo
 * (email, teléfono o Instagram: la misma regla que toda alta, `tieneContacto`). Un id repetido ADENTRO del lote entra una
 * vez: el segundo vuelve en `descartados`, para que nadie crea que eran dos personas.
 */
export function leerLoteMigracion(crudos: unknown, ahora: number = Date.now()): LoteLeido {
  const lista = Array.isArray(crudos) ? crudos : [];
  const contactos: ContactoMigrado[] = [];
  const descartados: string[] = [];
  const vistos = new Set<string>();
  lista.slice(0, TOPE_LOTE_MIGRACION).forEach((c0, i) => {
    const c = (c0 && typeof c0 === 'object' ? c0 : {}) as Record<string, unknown>;
    const idExterno = txt(c.idExterno ?? c.id_externo, 200);
    const nombre = txt(c.nombre, 200);
    const email = txt(c.email, 200)?.toLowerCase() ?? null;
    const telefono = txt(c.telefono, 40);
    const instagram = usuarioInstagram(txt(c.instagram, 200));
    const quien = nombre ? `«${nombre}»` : `el contacto #${i + 1}`;
    if (!idExterno) { descartados.push(`${quien} no trae su id del CRM anterior (idExterno)`); return; }
    if (!nombre) { descartados.push(`el contacto ${idExterno} no tiene nombre`); return; }
    if (!tieneContacto({ email, telefono, instagram })) { descartados.push(`${quien} no tiene email, teléfono ni Instagram`); return; }
    if (vistos.has(idExterno)) { descartados.push(`${quien}: el id ${idExterno} viene dos veces en el lote; entró una`); return; }
    vistos.add(idExterno);
    contactos.push({
      i, idExterno, nombre, email, telefono, instagram,
      empresa: txt(c.empresa, 200),
      etapa: txt(c.etapa, 80),
      fechaOriginal: fechaOriginalDe(c.fechaOriginal ?? c.fecha_original, ahora),
      utm_source: txt(c.utm_source, 200), utm_medium: txt(c.utm_medium, 200),
      utm_campaign: txt(c.utm_campaign, 200), utm_content: txt(c.utm_content, 200),
    });
  });
  if (lista.length > TOPE_LOTE_MIGRACION) descartados.push(`el lote trae ${lista.length}: entran de a ${TOPE_LOTE_MIGRACION}, manda el resto en otro pedido`);
  return { contactos, descartados };
}

/** Una etapa del CRM de destino, como la devuelve `etapasDeProducto`. */
export type EtapaDestino = { key: string; label: string; band?: string | null; kind?: string | null };

/** Las keys de las etapas que terminan un trato. Las mismas de `terminalEstadoFor` (lib/pipeline.ts). */
const KEYS_FINALES = new Set(['ganado', 'perdido', 'descal', 'noresp']);

/** ¿En esta etapa puede NACER un migrado? Sólo una abierta (ver la cabecera). */
export function etapaAbierta(e: EtapaDestino): boolean {
  return !KEYS_FINALES.has(e.key) && e.band !== 'salidas';
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * La etapa donde nace cada contacto: la que pidió (por su key o por su nombre, sin mayúsculas ni tildes) o la de entrada.
 * Una que no existe en ese CRM, o que es final, lo deja AFUERA con su motivo: caer a la entrada sería dejarlo en una
 * columna que nadie eligió.
 */
export function ubicarEnEtapas(
  contactos: readonly ContactoMigrado[], etapas: readonly EtapaDestino[], entrada: string | null,
): { ubicados: Array<ContactoMigrado & { etapaKey: string; etapaLabel: string }>; afuera: string[] } {
  const ubicados: Array<ContactoMigrado & { etapaKey: string; etapaLabel: string }> = [];
  const afuera: string[] = [];
  const porKey = new Map(etapas.map((e) => [e.key, e]));
  const porNombre = new Map(etapas.map((e) => [normal(e.label), e]));
  for (const c of contactos) {
    const pedida = c.etapa ? (porKey.get(c.etapa) ?? porNombre.get(normal(c.etapa)) ?? null) : (entrada ? porKey.get(entrada) ?? null : null);
    if (!pedida) {
      afuera.push(c.etapa ? `«${c.nombre}»: la etapa «${c.etapa}» no existe en ese CRM` : `«${c.nombre}»: ese CRM no tiene etapa de entrada`);
      continue;
    }
    if (!etapaAbierta(pedida)) {
      afuera.push(`«${c.nombre}»: «${pedida.label}» cierra el trato y un contacto migrado entra sólo a una etapa abierta`);
      continue;
    }
    ubicados.push({ ...c, etapaKey: pedida.key, etapaLabel: pedida.label });
  }
  return { ubicados, afuera };
}

/**
 * La cohorte de una automatización SIN los migrados (lib/nutricion.ts, `sinMigrados`, lee cuáles son). Pura para que el
 * test la ejecute: es la regla que evita escribirle de golpe a miles de contactos.
 */
export function quitarMigrados(ids: readonly number[], migrados: ReadonlySet<number>): number[] {
  return ids.filter((id) => !migrados.has(id));
}

/** Cuántos van a cada etapa, para el resumen que se confirma («Lead entrante: 120 · Agendado: 30»). */
export function porEtapa(ubicados: ReadonlyArray<{ etapaLabel: string }>): string {
  const n = new Map<string, number>();
  for (const u of ubicados) n.set(u.etapaLabel, (n.get(u.etapaLabel) ?? 0) + 1);
  return [...n].map(([k, v]) => `${k}: ${v}`).join(' · ');
}
