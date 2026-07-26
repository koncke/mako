// =============================================================================
// onboarding — perfil del negocio del cliente (campos editables + respuestas)
// =============================================================================
// El ESQUEMA del formulario (grupos y campos) se edita sin migrar la base, y las
// respuestas se guardan flexibles. Todo en app_settings como JSON. El perfil
// alimenta el contexto de MaKo (aditivo: campo vacío → no se inyecta).

import 'server-only';
import { getSetting, setSetting } from './settings';
import { renderPrompt } from './prompt-render';

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

// Extrae respuestas de un texto (template completado o doc del cliente) y las
// mapea a los campos pedidos, con la API de OpenAI ya usada en el repo.
const OAI = 'https://api.openai.com/v1';

// {{lista}} = los campos pedidos (clave: qué pide). El esquema JSON de salida es
// fijo: si lo cambiás, ajustá también el parseo de abajo.
export const ONBOARDING_EXTRACT_TEMPLATE = `Sos un extractor de datos. Recibís un TEXTO (un template completado o un documento del negocio del cliente) y una lista de CAMPOS. Devolvé SOLO JSON: {"campos": {"<clave>": "<valor>"}}. Para cada campo poné el valor que corresponda según el texto, conciso y en las palabras del cliente. Si un campo no aparece o no se puede inferir con confianza, omitilo (NO lo inventes). Claves válidas (clave: qué pide):\n{{lista}}`;

// maxChars: cuánto texto se le manda al modelo. El brief de una fase entra en
// 12k, pero El Archivero concatena VARIOS documentos del cliente en una sola
// pasada — ahí conviene subir el techo (gpt-4o-mini tiene 128k de contexto y es
// barato). No es la longitud del doc: es lo que llega al prompt.
export async function extractAnswersFromText(texto: string, fields: Array<{ key: string; label: string }>, maxChars = 12000): Promise<Record<string, string>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY no definida');
  if (!texto.trim() || fields.length === 0) return {};
  const lista = fields.map((f) => `- ${f.key}: ${f.label}`).join('\n');
  const sys = await renderPrompt('onboarding.extract.system', ONBOARDING_EXTRACT_TEMPLATE, { lista });
  const r = await fetch(`${OAI}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: texto.slice(0, maxChars) }] }),
    cache: 'no-store',
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`extract: ${j?.error?.message ?? r.status}`);
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(j.choices?.[0]?.message?.content ?? '{}'); } catch { parsed = {}; }
  const campos = (parsed.campos && typeof parsed.campos === 'object' ? parsed.campos : parsed) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = campos[f.key];
    if (v != null && String(v).trim()) out[f.key] = String(v).trim();
  }
  return out;
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
