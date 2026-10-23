// =============================================================================
// zapier-lead — qué dice un lead de Meta que llega por Zapier o Make, sin tocar la base
// =============================================================================
// El puente de leads (23/10/2026, el Cerebro, pedido de Martín: «armame el puente de leads por Zapier»).
// La app de MaKo todavía no tiene `leads_retrieval` aprobado, así que un negocio que no conectó Meta con una
// app propia no recibe los leads de sus formularios instantáneos. Mientras tanto, el negocio arma un Zap (o un
// escenario de Make) con el disparador «Facebook Lead Ads → New Lead» y el paso «Webhooks by Zapier → POST» a
// /api/webhooks/zapier, con el header `X-MaKo-Clave`. Lo paga el negocio.
//
// ⚠️ ESTO NO ES UNA SEGUNDA PUERTA DE LEADS. Lo que sale de acá entra por `upsertLeadFromMeta` (lib/leads.ts),
// la MISMA función del webhook y del poll de Meta: mismo origen (`instant_form`), misma dedup (`meta_lead_id` y
// después teléfono o email), mismo producto según la campaña, mismas respuestas en `meta_field_data`. Lo único
// que hace este módulo es traducir lo que manda Zapier a lo que esa función ya sabe leer.
//
// ⚠️ LA FORMA DEL CUERPO LA DECIDE EL ZAP, NO META: NO MEDIDA con un Zap real. Zapier manda los campos del
// trigger con los nombres que él les pone (su ayuda del paso POST dice que con «Data» vacío manda todos), y
// Make los manda como los mapee quien lo arma. Por eso este lector es TOLERANTE y busca por el SIGNIFICADO de
// la clave, no por un nombre fijo (la misma decisión que lib/skool-evento.ts):
//   · el id del formulario de Meta: `lead_id`, `leadgen_id` o `id`, sólo si tiene forma de leadgen_id;
//   · la fecha: `created_time` (ISO, o segundos);
//   · el anuncio, el conjunto y la campaña: `ad_id`, `ad_name`, `adset_id`, `adset_name`, `campaign_id`,
//     `campaign_name` (con o sin guion bajo, con o sin espacio);
//   · el contacto: lo reconoce `parseLeadFields`, el MISMO parser de Meta (email, nombre, teléfono, empresa);
//     más `first_name` + `last_name` juntos, y `whatsapp`/`mobile` como teléfono;
//   · lo demás —las preguntas propias del formulario— queda en `meta_field_data`, como las de Meta.
// Lo técnico que no es una respuesta (la plataforma, el id de la página o del formulario) se descarta: llenaría
// la ficha de ruido. Y se DECLARA (`sinUsar`): lo que se tira queda a la vista del que arma el Zap.
//
// SIN `server-only`: lo prueban los tests (tests/zapier-leads.test.ts).

import { createHash } from 'node:crypto';
import { parseLeadFields, fechaDeMeta, type MetaFieldData } from './meta-leads-campos';
import { leadIdDeMeta } from './meta-capi-payload';
import { emailValido } from './hotmart-evento';

export type LeadDeZapier = {
  /** El `leadgen_id` real de Meta, SÓLO si el Zap lo mandó y tiene forma de id (15 a 17 dígitos). */
  leadgenId: string | null;
  /** ISO. null = el Zap no mandó fecha: se trata como «llegó ahora». */
  creadoEn: string | null;
  email: string | null;
  nombre: string;
  telefono: string | null;
  empresa: string | null;
  /** Las respuestas crudas, en la forma de Meta: lo que se guarda en `leads.meta_field_data`. */
  fieldData: MetaFieldData;
  /** Los `name` que el parser de Meta no reconoció (las preguntas propias): van al historial del lead. */
  noReconocidos: string[];
  anuncioId: string | null;
  anuncioNombre: string | null;
  conjuntoId: string | null;
  conjuntoNombre: string | null;
  campanaId: string | null;
  campanaNombre: string | null;
  /** Las claves que se leyeron y NO se usaron (técnicas o vacías): se devuelven en la respuesta. */
  sinUsar: string[];
};

/** `porque`: el cuerpo no es un objeto (el Zap está mal armado), o no hay con qué reconocer a la persona. */
export type Ignorado = { ignorado: string; porque: 'cuerpo' | 'contacto' };

/** El tope de preguntas y de largo: un cuerpo de 64 KB no puede ser una ficha de 64 KB. */
const MAX_CAMPOS = 60;
const MAX_NOMBRE = 200;
const MAX_VALOR = 1000;

/** La clave sin mayúsculas, acentos ni separadores: «Ad Set Name» → «adsetname». */
const llave = (k: string): string => k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * El valor como texto, o null si no es un dato escalar usable. Un número que no es un entero seguro NO se lee como
 * número: un id de 17 dígitos que viaja como número JSON ya se redondeó al parsear, y un id redondeado no es el id.
 */
function txt(v: unknown, tope = MAX_VALOR): string | null {
  if (typeof v === 'number') return Number.isFinite(v) && (!Number.isInteger(v) || Number.isSafeInteger(v)) ? String(v) : null;
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, tope) : null;
}

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

// Las claves que NO son una respuesta del formulario (por su `llave`). Cada una se usa, o se descarta a propósito.
const ES_ID_LEAD = new Set(['leadid', 'leadgenid', 'leadgen', 'metaleadid', 'id']);
const ES_CREADO = new Set(['createdtime', 'createdat', 'created', 'datecreated', 'creado', 'fechacreacion']);
const ES_ANUNCIO_ID = new Set(['adid']);
const ES_ANUNCIO = new Set(['adname', 'anuncio', 'nombreanuncio']);
const ES_CONJUNTO_ID = new Set(['adsetid', 'adgroupid']);
const ES_CONJUNTO = new Set(['adsetname', 'adgroupname', 'conjunto']);
const ES_CAMPANA_ID = new Set(['campaignid']);
const ES_CAMPANA = new Set(['campaignname', 'campana', 'campaign']);
// Técnicas: dicen de dónde salió el lead y no lo que contestó. ⚠️ NO MEDIDO: el conjunto exacto que manda el
// trigger de Zapier; una clave técnica que no esté acá termina como «pregunta propia» (ruido, no pérdida).
const ES_RUIDO = new Set([
  'formid', 'formname', 'formulario', 'form', 'pageid', 'pagename', 'platform', 'plataforma', 'isorganic', 'organic',
  'partnername', 'islocalleadgen', 'retaileritemid', 'customdisclaimerresponses',
]);

const ES_NOMBRE_COMPLETO = new Set(['fullname', 'name', 'nombrecompleto', 'nombreyapellido']);
const ES_PRIMER = new Set(['firstname', 'nombre', 'primernombre']);
const ES_APELLIDO = new Set(['lastname', 'apellido', 'apellidos', 'surname']);
const ES_TELEFONO_ALIAS = new Set(['whatsapp', 'wa', 'mobile', 'movil', 'tel', 'cel', 'cell']);
const ES_EMAIL_ALIAS = new Set(['mail', 'email']);

/** Las entradas escalares del cuerpo, con una sola capa de anidado (`data`, `lead`, `fields`) aplanada: lo de arriba gana. */
function entradasDe(cuerpo: unknown): Array<[string, unknown]> | null {
  const crudo = Array.isArray(cuerpo) ? cuerpo.find((x) => objeto(x)) : cuerpo;
  const raiz = objeto(crudo);
  if (!raiz) return null;
  const plano: Record<string, unknown> = {};
  for (const clave of ['data', 'lead', 'fields', 'datos']) {
    const anidado = objeto(raiz[clave]);
    if (anidado) Object.assign(plano, anidado);
  }
  Object.assign(plano, raiz);
  const out: Array<[string, unknown]> = [];
  for (const [k, v] of Object.entries(plano)) {
    // Zapier aplana lo anidado con «__»: `lead__email` es `email`.
    const nombre = k.includes('__') ? (k.split('__').pop() ?? k) : k;
    if (['data', 'lead', 'fields', 'datos'].includes(k) && objeto(v)) continue;
    // El formato de Meta, tal cual: [{ name, values: [...] }].
    if (llave(k) === 'fielddata' && Array.isArray(v)) {
      for (const f of v) {
        const o = objeto(f);
        const n = o ? txt(o.name, MAX_NOMBRE) : null;
        const val = o && Array.isArray(o.values) ? o.values.map((x) => txt(x)).find((x) => x) ?? null : null;
        if (n && val) out.push([n, val]);
      }
      continue;
    }
    out.push([nombre, v]);
  }
  return out;
}

/**
 * Lee el cuerpo (ya parseado: JSON, o un formulario convertido a objeto). Devuelve el lead, o `{ ignorado }` si no
 * hay cómo reconocer a la persona: sin email ni teléfono válidos, el CRM no la puede unir con lo que ya tiene.
 */
export function leerLeadDeZapier(cuerpo: unknown): LeadDeZapier | Ignorado {
  const entradas = entradasDe(cuerpo);
  if (!entradas) return { ignorado: 'el cuerpo no es un objeto', porque: 'cuerpo' };

  let idCrudo: string | null = null;
  let creadoCrudo: string | null = null;
  const meta: Record<'anuncioId' | 'anuncioNombre' | 'conjuntoId' | 'conjuntoNombre' | 'campanaId' | 'campanaNombre', string | null> = {
    anuncioId: null, anuncioNombre: null, conjuntoId: null, conjuntoNombre: null, campanaId: null, campanaNombre: null,
  };
  const sinUsar: string[] = [];
  const respuestas: Array<{ name: string; valor: string; l: string }> = [];

  for (const [k, v] of entradas) {
    const l = llave(k);
    const t = txt(v);
    if (!l || t == null) { if (l) sinUsar.push(k); continue; }
    if (ES_ID_LEAD.has(l)) {
      // El `id` suelto es de cualquiera: sólo cuenta si tiene forma de leadgen_id.
      const d = leadIdDeMeta(t);
      if (d && !idCrudo) idCrudo = d; else if (!d) sinUsar.push(k);
    } else if (ES_CREADO.has(l)) { if (!creadoCrudo) creadoCrudo = t; }
    else if (ES_ANUNCIO_ID.has(l)) meta.anuncioId ??= t;
    else if (ES_ANUNCIO.has(l)) meta.anuncioNombre ??= t;
    else if (ES_CONJUNTO_ID.has(l)) meta.conjuntoId ??= t;
    else if (ES_CONJUNTO.has(l)) meta.conjuntoNombre ??= t;
    else if (ES_CAMPANA_ID.has(l)) meta.campanaId ??= t;
    else if (ES_CAMPANA.has(l)) meta.campanaNombre ??= t;
    else if (ES_RUIDO.has(l)) sinUsar.push(k);
    else respuestas.push({ name: k.slice(0, MAX_NOMBRE), valor: t, l });
  }

  // Los alias que el parser de Meta no mira por palabra clave: se renombran a lo que sí reconoce.
  const campos: MetaFieldData = respuestas.slice(0, MAX_CAMPOS).map((r) => ({
    name: ES_TELEFONO_ALIAS.has(r.l) ? 'phone_number' : ES_EMAIL_ALIAS.has(r.l) ? 'email' : r.name,
    values: [r.valor],
  }));
  if (respuestas.length > MAX_CAMPOS) sinUsar.push(...respuestas.slice(MAX_CAMPOS).map((r) => r.name));

  // El nombre: el parser de Meta se queda con el PRIMER campo que diga «name», y en un Zap el nombre de pila (`first_name`)
  // suele venir antes que el completo. Si hay un nombre completo va adelante; si hay nombre y apellido por separado, se juntan.
  const iCompleto = respuestas.slice(0, MAX_CAMPOS).findIndex((r) => ES_NOMBRE_COMPLETO.has(r.l));
  if (iCompleto > 0) {
    campos.unshift(...campos.splice(iCompleto, 1));
  } else if (iCompleto < 0) {
    const primero = respuestas.find((r) => ES_PRIMER.has(r.l))?.valor;
    const ultimo = respuestas.find((r) => ES_APELLIDO.has(r.l))?.valor;
    if (primero && ultimo) campos.unshift({ name: 'full_name', values: [`${primero} ${ultimo}`] });
  }

  const c = parseLeadFields(campos);
  const email = emailValido(c.email);
  const telefono = c.telefono && c.telefono.replace(/\D/g, '').length >= 6 ? c.telefono : null;
  if (!email && !telefono) return { ignorado: 'sin email ni teléfono: no hay cómo reconocer a la persona', porque: 'contacto' };

  // La fecha del formulario: ISO, o el entero en segundos de Meta.
  const creadoEn = creadoCrudo ? fechaDeMeta(/^\d{9,11}$/.test(creadoCrudo) ? Number(creadoCrudo) : creadoCrudo) : null;

  return {
    leadgenId: idCrudo,
    creadoEn,
    email,
    nombre: c.nombre,
    telefono,
    empresa: c.empresa,
    fieldData: campos,
    noReconocidos: c.noReconocidos,
    ...meta,
    sinUsar,
  };
}

/**
 * El `meta_lead_id` con el que entra el lead: el REAL de Meta si el Zap lo mandó, y si no uno propio.
 *
 * ⚠️ El real es lo que hace que NO se duplique si el mismo lead entra después por Meta (`upsertLeadFromMeta`
 * es idempotente por ese id). El propio, `zap:<ws>:<huella>`, es determinista —un reintento de Zapier cae en
 * la misma fila— y lleva el workspace adentro: `idx_leads_meta_lead_id` es único GLOBAL, sin workspace, y dos
 * negocios con la misma persona no pueden chocar. Sin fecha del formulario, la huella usa el día (UTC): un
 * reintento del mismo día es el mismo lead; mañana, otro envío de la misma persona.
 */
export function idDeLeadParaElUpsert(ws: number, l: Pick<LeadDeZapier, 'leadgenId' | 'creadoEn' | 'email' | 'telefono'>, ahora: Date): string {
  if (l.leadgenId) return l.leadgenId;
  const cuando = l.creadoEn ?? ahora.toISOString().slice(0, 10);
  const huella = createHash('sha256').update(`${l.email ?? ''}|${(l.telefono ?? '').replace(/\D/g, '')}|${cuando}`).digest('hex').slice(0, 20);
  return `zap:${ws}:${huella}`;
}
