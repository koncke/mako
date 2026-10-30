// =============================================================================
// zernio-lead — qué dice un `lead.received` de Zernio, sin tocar la base
// =============================================================================
// 23/10/2026, el Cerebro (pedido de Martín: el puente de Make/Zapier se retiró porque «ya resolvimos todo con Zernio»):
// un formulario instantáneo de Meta le llega a MaKo por el webhook de la cuenta de Zernio del negocio, sin que el negocio
// tenga que publicar una app propia. Esto traduce el cuerpo a lo que `upsertLeadFromMeta` (lib/leads.ts), la MISMA puerta
// del webhook y del poll de Meta, ya sabe leer. No es una segunda puerta de leads.
//
// LA FORMA DEL CUERPO, medida en docs.zernio.com/webhooks/ads (23/10/2026) — LA DOC NO TRAE UN JSON DE EJEMPLO, sólo la
// tabla de campos, y ninguna persona recibió todavía un `lead.received` real. Por eso este lector es TOLERANTE con lo que
// la tabla deja abierto y ESTRICTO con lo que decide una identidad:
//   · `lead.leadgenId`  — «Meta's lead ID»: es el `meta_lead_id`. Es la llave de la deduplicación con el webhook de Meta y
//                         con el poll, así que NO se inventa ni se acepta cualquier cosa: sólo dígitos (8 a 32).
//   · `lead.fields`     — «question-key to answer map»; las opciones de una pregunta de selección son CLAVES (`k1`), no su
//                         rótulo. Se convierte a la forma de Meta (`[{ name, values }]`) para que lo lea el MISMO parser.
//                         ⚠️ El REST de Zernio (`GET /v1/ads/leads`) trae además `fieldData` crudo y el WEBHOOK NO LO LISTA: no se
//                         lee (AGENTS.md: la forma de un webhook se mide en el webhook, nunca en el REST del mismo proveedor).
//   · `lead.createdAt`  — cuándo creó Meta el lead (`date-time`: un string ISO; un número NO se lee, porque no se sabe si son segundos o milisegundos
//                         y uno en milisegundos da un año 58756 que rompe el insert). Ilegible o ausente vuelve null: «llegó ahora».
//   · `lead.adId`, `adsetId`, `campaignId` — los IDS (los que deciden el producto, lib/campana-funnel.ts). Los NOMBRES de
//                         anuncio, conjunto y campaña NO viajan en este evento: quedan vacíos (sin respaldo inventado).
//   · `test: true`      — sólo en las muestras de `POST /v1/webhooks/test`. Una muestra NO es un lead: jamás se carga.
//
// SIN `server-only`: lo prueba tests/zernio-leads.test.ts.

import { parseLeadFields, fechaDeMeta, type MetaFieldData } from './meta-leads-campos';
import { VENTANA_CAPI_DIAS } from './meta-capi-payload';
import { esNuevoParaElNegocio } from './meta-leads-poll-reglas';

export type LeadDeZernio = {
  /** El `leadgen_id` de Meta: el `meta_lead_id` del lead. */
  leadgenId: string;
  /** ISO, o null si Zernio no mandó una fecha legible (se trata como «llegó ahora»). */
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
  conjuntoId: string | null;
  campanaId: string | null;
  formularioId: string | null;
  formularioNombre: string | null;
  esOrganico: boolean;
  /**
   * La cuenta conectada de Zernio de la que vino (`accountId` del REST, `AdLead`). Sólo la trae el BARRIDO: con ella descarta en
   * memoria lo que no es del negocio (el webhook rutea por su propia puerta). Null si no vino o no tiene forma de id.
   */
  cuentaId?: string | null;
};

/**
 * `prueba`: una muestra de `POST /v1/webhooks/test`. `cuerpo`: no trae el objeto `lead`. `sin_id`: el `leadgenId` falta o no
 * tiene forma de id de Meta — sin él no hay cómo deduplicar, y un lead que se carga dos veces avisa dos veces.
 */
export type IgnoradoZernio = { ignorado: string; porque: 'prueba' | 'cuerpo' | 'sin_id' };

// Un cuerpo de 64 KB no puede ser una ficha de 64 KB.
const MAX_CAMPOS = 60;
const MAX_VALORES = 10;
const MAX_NOMBRE = 200;
const MAX_VALOR = 1000;
const MAX_ID = 64;

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/**
 * El valor como texto, o null si no es un dato escalar usable. Un número que no es un entero seguro NO se lee como número: un id de
 * 17 dígitos que viaja como número JSON ya se redondeó al parsear, y un id redondeado no es el id.
 */
function txt(v: unknown, tope = MAX_VALOR): string | null {
  if (typeof v === 'number') return Number.isFinite(v) && (!Number.isInteger(v) || Number.isSafeInteger(v)) ? String(v) : null;
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, tope) : null;
}

/** Un id: sin espacios y acotado. Lo que no parece un id (vacío, un objeto) es null. */
function idDe(v: unknown): string | null {
  const t = typeof v === 'string' || typeof v === 'number' ? txt(v, MAX_ID) : null;
  return t && !/\s/.test(t) ? t : null;
}

/** Las respuestas de `lead.fields` (objeto pregunta→respuesta) en la forma de Meta. Una respuesta vacía no es una respuesta. */
function fieldDataDe(fields: Record<string, unknown>): MetaFieldData {
  const out: MetaFieldData = [];
  for (const [k, v] of Object.entries(fields)) {
    if (out.length >= MAX_CAMPOS) break;
    const name = txt(k, MAX_NOMBRE);
    if (!name) continue;
    const valores = (Array.isArray(v) ? v : [v]).map((x) => txt(x)).filter((x): x is string => !!x).slice(0, MAX_VALORES);
    if (valores.length) out.push({ name, values: valores });
  }
  return out;
}

/** La clave sin mayúsculas, acentos ni separadores: «Full Name» → «fullname». */
const llave = (k: string): string => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ES_NOMBRE_COMPLETO = new Set(['fullname', 'nombrecompleto', 'nombreyapellido']);
const ES_PRIMER_NOMBRE = new Set(['firstname', 'primernombre', 'nombre']);
const ES_APELLIDO = new Set(['lastname', 'apellido', 'apellidos', 'surname']);

/**
 * Lo que se le da a `parseLeadFields`, en el orden que necesita; lo GUARDADO (`fieldData`) conserva el orden crudo.
 *
 * ⚠️ `parseLeadFields` se queda con el PRIMER campo cuyo `name` contiene «name» o «nombre», y Meta manda las respuestas en el orden del formulario. Acá
 * `fields` es un objeto cuyo orden lo decide Zernio (no medido): con `company_name` antes de `full_name`, o una pregunta propia como «¿cuál es el nombre de
 * tu marca?», el nombre de la PERSONA salía de otro campo y el WhatsApp saludaba «Hola Pérez SA». Y con `first_name` + `last_name` (un formulario que no
 * pregunta el nombre completo) salía sólo el primero. Por eso: el nombre completo, si viene, va primero; y si no, el primero y el apellido se juntan. Es la
 * misma lección que ya había resuelto el lector del puente retirado. Devuelve además la clave del apellido que se usó, para no acusarla de «sin columna».
 */
export function paraElParser(fieldData: MetaFieldData): { campos: MetaFieldData; apellido: string | null } {
  const tiene = (f: MetaFieldData[number]) => !!(f.name && f.values?.[0]?.trim());
  const completo = fieldData.findIndex((f) => tiene(f) && ES_NOMBRE_COMPLETO.has(llave(f.name!)));
  if (completo > 0) return { campos: [fieldData[completo], ...fieldData.filter((_, i) => i !== completo)], apellido: null };
  if (completo === 0) return { campos: fieldData, apellido: null };
  const primero = fieldData.find((f) => tiene(f) && ES_PRIMER_NOMBRE.has(llave(f.name!)));
  const ultimo = fieldData.find((f) => tiene(f) && ES_APELLIDO.has(llave(f.name!)));
  if (!primero || !ultimo) return { campos: fieldData, apellido: null };
  const junto = `${primero.values![0].trim()} ${ultimo.values![0].trim()}`.slice(0, MAX_VALOR);
  return { campos: [{ name: 'full_name', values: [junto] }, ...fieldData], apellido: ultimo.name!.trim() };
}

/**
 * Qué se hace con un lead que acaba de entrar, según si lo CREÓ esta entrega y cuánto hace que Meta lo creó.
 *   · `nuevo` — lo inmediato (el aviso, los flujos, las automatizaciones): sólo uno creado ahora y de menos de 24 h (`esNuevoParaElNegocio`). Una reentrega
 *     de Zernio, o un lead que ya entró por Meta, no es «un lead nuevo» y no puede mandar otro primer mensaje.
 *   · `conversion` — la conversión `Lead` a Meta: como el webhook de Meta, la manda TAMBIÉN un lead que ya existía (una persona que ya era un lead y llena OTRO
 *     formulario es otra conversión), con el `event_id` del leadgen_id para que Meta no la cuente dos veces. Sólo dentro de la ventana de CAPI (7 días): una
 *     más vieja no tiene una hora buena que mandar. Sin fecha legible, como recién llegado.
 */
export function queHacerConElLead(creado: boolean, creadoEn: string | null, ahoraMs: number): { nuevo: boolean; conversion: boolean } {
  const t = creadoEn ? Date.parse(creadoEn) : NaN;
  const conversion = !Number.isFinite(t) || ahoraMs - t <= VENTANA_CAPI_DIAS * 86_400_000;
  return { nuevo: creado && esNuevoParaElNegocio(creadoEn ?? new Date(ahoraMs).toISOString(), ahoraMs), conversion };
}

/** El `fieldData` crudo de Meta que trae el REST (`[{ name, values }]`), acotado como `fieldDataDe`. Lo que no tiene forma, afuera. */
function fieldDataCrudo(v: unknown): MetaFieldData {
  if (!Array.isArray(v)) return [];
  const out: MetaFieldData = [];
  for (const f of v) {
    if (out.length >= MAX_CAMPOS) break;
    const o = objeto(f);
    const name = o ? txt(o.name, MAX_NOMBRE) : null;
    if (!o || !name) continue;
    const valores = (Array.isArray(o.values) ? o.values : [o.values]).map((x) => txt(x)).filter((x): x is string => !!x).slice(0, MAX_VALORES);
    if (valores.length) out.push({ name, values: valores });
  }
  return out;
}

/**
 * Un lead del barrido (`GET /v1/ads/leads`, OpenAPI de Zernio v1.416, `AdLead`), en el MISMO `LeadDeZernio` que el webhook: lo carga la
 * misma puerta (`cargarLeadDeZernio`). Las diferencias del REST, medidas en la OpenAPI (29/10/2026): trae `fieldData` CRUDO de Meta
 * (la forma del webhook de Meta; se prefiere, y si no viene se usa `fields`) y la fecha es `createdTime`. Un lead de LinkedIn trae un
 * `leadgenId` que no son dígitos: no se carga (el barrido es de Meta).
 */
export function leerLeadDelRest(item: unknown): LeadDeZernio | IgnoradoZernio {
  const lead = objeto(item);
  if (!lead) return { ignorado: 'el lead no es un objeto', porque: 'cuerpo' };
  const leadgenId = idDe(lead.leadgenId);
  if (!leadgenId || !/^[0-9]{8,32}$/.test(leadgenId)) {
    return { ignorado: 'el lead no trae un leadgenId con forma de id de Meta', porque: 'sin_id' };
  }
  const crudo = fieldDataCrudo(lead.fieldData);
  const fields = objeto(lead.fields);
  const fieldData = crudo.length ? crudo : fields ? fieldDataDe(fields) : [];
  const { campos, apellido } = paraElParser(fieldData);
  const { email, nombre, telefono, empresa, noReconocidos: sinColumna } = parseLeadFields(campos);
  const noReconocidos = apellido ? sinColumna.filter((n) => n !== apellido) : sinColumna;
  return {
    leadgenId,
    creadoEn: fechaDeMeta(typeof lead.createdTime === 'string' ? lead.createdTime : null),
    email: email ? email.toLowerCase() : null,
    nombre,
    telefono,
    empresa,
    fieldData,
    noReconocidos,
    anuncioId: idDe(lead.adId),
    conjuntoId: idDe(lead.adsetId),
    campanaId: idDe(lead.campaignId),
    formularioId: idDe(lead.formId),
    formularioNombre: txt(lead.formName, MAX_NOMBRE),
    esOrganico: lead.isOrganic === true,
    cuentaId: idDe(lead.accountId),
  };
}

/**
 * ¿Le toca al barrido de Zernio en este tic del cron de leads (cada 10 minutos)? Cada 30 minutos y en la pasada diaria: Zernio relee
 * las páginas cada 15 minutos (`meta.lastCheckedAt`, OpenAPI v1.416) y pedir más seguido no trae nada nuevo.
 */
export function tocaBarrerZernio(ahora: Date, diaria: boolean): boolean {
  return diaria || Math.floor(ahora.getUTCMinutes() / 10) % 3 === 0;
}

/** Lee el cuerpo (ya parseado) de un `lead.received`. Devuelve el lead, o por qué NO se carga. */
export function leerLeadDeZernio(cuerpo: unknown): LeadDeZernio | IgnoradoZernio {
  const raiz = objeto(cuerpo);
  if (!raiz) return { ignorado: 'el cuerpo no es un objeto', porque: 'cuerpo' };
  // Una muestra de `POST /v1/webhooks/test`: sin esto, probar el webhook desde el panel de Zernio crearía un lead falso.
  if (raiz.test === true) return { ignorado: 'muestra de prueba de Zernio', porque: 'prueba' };
  const lead = objeto(raiz.lead);
  if (!lead) return { ignorado: 'el evento no trae el objeto lead', porque: 'cuerpo' };

  const leadgenId = idDe(lead.leadgenId);
  if (!leadgenId || !/^[0-9]{8,32}$/.test(leadgenId)) {
    return { ignorado: 'el lead no trae un leadgenId con forma de id de Meta', porque: 'sin_id' };
  }

  const fields = objeto(lead.fields);
  const fieldData = fields ? fieldDataDe(fields) : [];
  const { campos, apellido } = paraElParser(fieldData);
  const { email, nombre, telefono, empresa, noReconocidos: sinColumna } = parseLeadFields(campos);
  const noReconocidos = apellido ? sinColumna.filter((n) => n !== apellido) : sinColumna;

  return {
    leadgenId,
    creadoEn: fechaDeMeta(typeof lead.createdAt === 'string' ? lead.createdAt : null),
    email: email ? email.toLowerCase() : null,
    nombre,
    telefono,
    empresa,
    fieldData,
    noReconocidos,
    anuncioId: idDe(lead.adId),
    conjuntoId: idDe(lead.adsetId),
    campanaId: idDe(lead.campaignId),
    formularioId: idDe(lead.formId),
    formularioNombre: txt(lead.formName, MAX_NOMBRE),
    esOrganico: lead.isOrganic === true,
  };
}
