// =============================================================================
// onboarding — perfil del negocio del cliente (campos editables + respuestas)
// =============================================================================
// El ESQUEMA del formulario (grupos y campos) se edita sin migrar la base, y las
// respuestas se guardan flexibles. Todo en app_settings como JSON. El perfil
// alimenta el contexto de MaKo (aditivo: campo vacío → no se inyecta).

import 'server-only';
import { getSetting, setSetting } from './settings';
import { renderPrompt } from './prompt-render';
import { chatCheapCascade, CASCADA_DOCS } from './ai-cheap';

export type FieldType = 'text' | 'number' | 'textarea';
export type Field = { key: string; label: string; type: FieldType; placeholder?: string };
export type Group = { key: string; label: string; fields: Field[] };

export const DEFAULT_SCHEMA: Group[] = [
  // Grupo base: las 3 preguntas que sirven para CUALQUIER negocio, venda como
  // venda. Es el único brief que se le pide a las capas chicas (ej. Project
  // Manager, que no tiene oferta VSL ni avatar) y le alcanza al Perro Guardián
  // para priorizar con criterio del negocio en vez de genérico. Qué grupos ve
  // cada capa lo decide lib/capas.ts → briefGrupos.
  { key: 'negocio', label: 'Tu negocio', fields: [
    { key: 'negocio_que_hace', label: '¿A qué se dedica tu negocio?', type: 'text', placeholder: 'Consultoría de operaciones para PyMEs' },
    { key: 'negocio_objetivo', label: '¿Cuál es tu objetivo para los próximos 90 días?', type: 'textarea', placeholder: 'Cerrar 10 clientes nuevos sin sumar gente al equipo' },
    { key: 'negocio_freno', label: '¿Qué es lo que más te está frenando hoy?', type: 'textarea', placeholder: 'Todo pasa por mí y no llego a nada' },
  ] },
  { key: 'oferta', label: 'Oferta', fields: [
    { key: 'oferta_nombre', label: '¿Cómo se llama tu oferta?', type: 'text', placeholder: 'Negocio que Escala™' },
    { key: 'oferta_ticket', label: 'Precio / ticket (USD)', type: 'number', placeholder: '5000' },
    { key: 'oferta_promesa', label: '¿Cuál es la promesa principal? (la transformación)', type: 'textarea', placeholder: 'De cuello de botella a dueño que escala' },
    { key: 'oferta_incluye', label: '¿Qué incluye? (entregables)', type: 'textarea', placeholder: 'Mentorías, comunidad, plantillas…' },
    { key: 'oferta_garantia', label: '¿Tenés garantía? ¿Cuál?', type: 'text', placeholder: '30 días o devolución' },
  ] },
  { key: 'avatar', label: 'Avatar', fields: [
    { key: 'avatar_quien', label: '¿Quién es tu cliente ideal?', type: 'text', placeholder: 'Emprendedor que factura pero está estancado' },
    { key: 'avatar_dolor', label: '¿Cuál es su dolor principal?', type: 'textarea', placeholder: 'Factura pero sigue siendo el cuello de botella de todo' },
    { key: 'avatar_deseo', label: '¿Qué resultado quiere lograr?', type: 'textarea', placeholder: 'Un negocio que funcione sin él' },
    { key: 'avatar_objecion', label: '¿Cuál es su objeción más común?', type: 'text', placeholder: 'No tengo tiempo / ya probé otras cosas' },
    { key: 'avatar_nicho', label: '¿En qué nicho o industria está?', type: 'text', placeholder: 'Consultoría / coaching B2B' },
  ] },
  { key: 'marca', label: 'Personaje de Marca', fields: [
    { key: 'marca_nombre', label: '¿Cómo se llama tu personaje de marca?', type: 'text', placeholder: 'MaKo' },
    { key: 'marca_tono', label: '¿Cómo es su tono / voz?', type: 'textarea', placeholder: 'Directo, honesto, rioplatense, sin vueltas' },
    { key: 'marca_valores', label: '¿En qué cree? (valores)', type: 'textarea', placeholder: 'El orden importa más que las tácticas…' },
    { key: 'marca_no', label: '¿Qué NUNCA hace?', type: 'textarea', placeholder: 'Vender humo, urgencia falsa, prometer cifras mágicas' },
    { key: 'marca_frase', label: 'Una frase o muletilla típica', type: 'text', placeholder: 'Te voy a ser directo…' },
  ] },
];

const SCHEMA_KEY = 'mako.onboarding.schema';
const ANSWERS_KEY = 'mako.onboarding.answers';

export async function getSchema(): Promise<Group[]> {
  const raw = await getSetting(SCHEMA_KEY);
  if (!raw) return DEFAULT_SCHEMA;
  try { const p = JSON.parse(raw); return Array.isArray(p) ? (p as Group[]) : DEFAULT_SCHEMA; } catch { return DEFAULT_SCHEMA; }
}
export async function saveSchema(schema: Group[]): Promise<void> {
  await setSetting(SCHEMA_KEY, JSON.stringify(schema));
}
export async function getAnswers(): Promise<Record<string, string>> {
  const raw = await getSetting(ANSWERS_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}
export async function saveAnswers(answers: Record<string, string>): Promise<void> {
  await setSetting(ANSWERS_KEY, JSON.stringify(answers));
}

// Gemini Flash (y varios modelos gratis) a veces devuelven el JSON envuelto en
// ```json…``` o con texto alrededor, AUNQUE les pidamos response_format json_object.
// Un JSON.parse pelado tira y deja los campos vacíos → el archivo queda "sin datos
// útiles" aunque la IA sí corrió (bug real en prod con Gemini). Igual que hace
// chatCheapJson en lib/ai-cheap: si el parse directo falla, extraemos el primer
// objeto {...} del texto a mano.
function parseJsonLoose(raw: string | null | undefined): Record<string, unknown> {
  const s = (raw || '').trim();
  if (!s) return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { /* probamos extraer */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { /* nos rendimos */ } }
  return {};
}

// Extrae respuestas de un texto (template completado o doc del cliente) y las
// mapea a los campos pedidos. Va por la IA barata del workspace (chatCheapCascade:
// Groq/OpenAI/… con credWs) — NO por process.env, así usa las keys que el cliente
// tiene cargadas en Integraciones en vez de romper con "OPENAI_API_KEY no definida".

// {{lista}} = los campos pedidos (clave: qué pide). El esquema JSON de salida es
// fijo: si lo cambiás, ajustá también el parseo de abajo.
export const ONBOARDING_EXTRACT_TEMPLATE = `Sos un extractor de datos. Recibís un TEXTO (un template completado o un documento del negocio del cliente) y una lista de CAMPOS. Devolvé SOLO JSON: {"campos": {"<clave>": "<valor>"}}. Para cada campo poné el valor que corresponda según el texto, conciso y en las palabras del cliente. Si un campo no aparece o no se puede inferir con confianza, omitilo (NO lo inventes). Claves válidas (clave: qué pide):\n{{lista}}`;

// maxChars: cuánto texto se le manda al modelo. El brief de una fase entra en
// 12k, pero El Archivero concatena VARIOS documentos del cliente en una sola
// pasada — ahí conviene subir el techo (gpt-4o-mini tiene 128k de contexto y es
// barato). No es la longitud del doc: es lo que llega al prompt.
export async function extractAnswersFromText(texto: string, fields: Array<{ key: string; label: string }>, maxChars = 12000): Promise<Record<string, string>> {
  if (!texto.trim() || fields.length === 0) return {};
  const lista = fields.map((f) => `- ${f.key}: ${f.label}`).join('\n');
  const sys = await renderPrompt('onboarding.extract.system', ONBOARDING_EXTRACT_TEMPLATE, { lista });
  const crudo = await chatCheapCascade({ system: sys, user: texto.slice(0, maxChars), json: true, maxTokens: 1500, feature: 'onboarding-extract', motivo: 'Extraer campos del brief de un documento', provs: CASCADA_DOCS });
  const parsed = parseJsonLoose(crudo);
  const campos = (parsed.campos && typeof parsed.campos === 'object' ? parsed.campos : parsed) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = campos[f.key];
    if (v != null && String(v).trim()) out[f.key] = String(v).trim();
  }
  return out;
}

// El Archivero procesa UN archivo por vez (no todo concatenado) para poder atribuir
// qué campo salió de qué documento y dar un razonamiento por archivo. Devuelve los
// campos que encontró + una frase corta de qué aportó ese documento.
export const ARCHIVERO_EXTRACT_TEMPLATE = `Sos un extractor de datos del negocio. Recibís el texto de UN documento del cliente y una lista de CAMPOS. Devolvé SOLO JSON: {"campos": {"<clave>": "<valor>"}, "razonamiento": "<una frase corta>"}. Para cada campo poné el valor que corresponda según el texto, conciso y en las palabras del cliente. Si un campo no aparece o no se puede inferir con confianza, omitilo (NO lo inventes). El "razonamiento" es UNA sola frase que EMPIEZA nombrando qué tipo de documento es (Avatar, Oferta, Nicho, o mixto) y qué aportó (ej: "Documento de Avatar: define quién es el cliente y su dolor principal", "Documento de Oferta: nombre, precio y garantía"). Si el documento no aporta nada útil, campos vacío y el razonamiento lo explica. Claves válidas (clave: qué pide):\n{{lista}}`;

export async function extraerDeArchivo(texto: string, fields: Array<{ key: string; label: string }>, maxChars = 24000): Promise<{ campos: Record<string, string>; razonamiento: string; sinIA: boolean }> {
  if (!texto.trim() || fields.length === 0) return { campos: {}, razonamiento: '', sinIA: false };
  const lista = fields.map((f) => `- ${f.key}: ${f.label}`).join('\n');
  const sys = await renderPrompt('archivero.extract.system', ARCHIVERO_EXTRACT_TEMPLATE, { lista });
  const out = await chatCheapCascade({ system: sys, user: texto.slice(0, maxChars), json: true, maxTokens: 1500, feature: 'El Archivero', motivo: 'Extraer campos de un documento del negocio', provs: CASCADA_DOCS });
  // out vacío = ninguna IA respondió (sin key de Gemini/Groq/OpenAI en el workspace).
  if (!out) return { campos: {}, razonamiento: '', sinIA: true };
  const parsed = parseJsonLoose(out);
  const raw = (parsed.campos && typeof parsed.campos === 'object' ? parsed.campos : {}) as Record<string, unknown>;
  const campos: Record<string, string> = {};
  for (const f of fields) {
    const v = raw[f.key];
    if (v != null && String(v).trim()) campos[f.key] = String(v).trim();
  }
  const razonamiento = typeof parsed.razonamiento === 'string' ? parsed.razonamiento.trim().slice(0, 240) : '';
  return { campos, razonamiento, sinIA: false };
}

/** Texto del perfil del negocio para inyectar en el contexto de MaKo. */
export async function perfilNegocioTexto(): Promise<string> {
  const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
  const lines: string[] = [];
  for (const g of schema) {
    const fs = g.fields
      .map((f) => { const v = (answers[f.key] ?? '').trim(); return v ? `${f.label}: ${v}` : ''; })
      .filter(Boolean);
    if (fs.length) lines.push(`${g.label} — ${fs.join(' · ')}`);
  }
  return lines.join('\n');
}
