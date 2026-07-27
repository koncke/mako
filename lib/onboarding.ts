// =============================================================================
// onboarding — perfil del negocio del cliente (campos editables + respuestas)
// =============================================================================
// El ESQUEMA del formulario (grupos y campos) se edita sin migrar la base, y las
// respuestas se guardan flexibles. Todo en app_settings como JSON. El perfil
// alimenta el contexto de MaKo (aditivo: campo vacío → no se inyecta).

import 'server-only';
import { getSetting, setSetting } from './settings';
import { renderPrompt } from './prompt-render';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS, type ProvName } from './ai-cheap';

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
// `validar` de la cascada: aceptamos solo salida que PARSEA a un objeto no vacío.
// Un doc real hace fallar al modelo chico (JSON truncado/roto → parsea a {}), y así
// la cascada sigue al próximo proveedor (modelo capaz) en vez de cortar con basura.
const esJsonObjeto = (t: string): boolean => Object.keys(parseJsonLoose(t)).length > 0;

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
  const crudo = await chatCheapCascade({ system: sys, user: texto.slice(0, maxChars), json: true, maxTokens: 1800, feature: 'onboarding-extract', motivo: 'Extraer campos del brief de un documento', provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: esJsonObjeto });
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
export const ARCHIVERO_EXTRACT_TEMPLATE = `Sos un extractor de datos del negocio. Recibís el texto de UN documento del cliente y una lista de CAMPOS. Devolvé SOLO JSON con ESTA forma exacta, y el "razonamiento" SIEMPRE presente: {"razonamiento": "<2-3 frases>", "campos": {"<clave>": "<valor>"}}. El "razonamiento" (OBLIGATORIO, nunca vacío) son 2-3 frases que EMPIEZAN nombrando qué tipo de documento es (Avatar, Oferta, Nicho, Producto, o mixto) y DESCRIBEN con detalle qué entendiste del negocio a partir de él, para que el cliente vea que lo leíste bien. Escribí el razonamiento en español NEUTRO (de "tú", sin voseo argentino). (ej: "Documento de Avatar y Oferta. Define al cliente ideal —un profesional estancado— y su dolor de depender de sí mismo, y describe la oferta 'Negocio que Escala' con su promesa de escalar sin perder el control."). Luego, en "campos", para cada campo poné el valor que corresponda según el texto, conciso y en las palabras del cliente; si un campo no aparece o no se puede inferir con confianza, omitilo (NO lo inventes). Si el documento no aporta ningún campo útil, "campos" vacío pero el "razonamiento" igual explica qué es el documento. Claves válidas de "campos" (clave: qué pide):\n{{lista}}`;

export async function extraerDeArchivo(texto: string, fields: Array<{ key: string; label: string }>, maxChars = 24000): Promise<{ campos: Record<string, string>; razonamiento: string; sinIA: boolean }> {
  if (!texto.trim() || fields.length === 0) return { campos: {}, razonamiento: '', sinIA: false };
  const lista = fields.map((f) => `- ${f.key}: ${f.label}`).join('\n');
  const sys = await renderPrompt('archivero.extract.system', ARCHIVERO_EXTRACT_TEMPLATE, { lista });
  // modelos: el default barato (Groq gpt-oss-20b) genera JSON roto en docs reales →
  // usamos modelos capaces (70b/flash) y `validar` para que, si uno falla, rescate el
  // siguiente. Sin esto, un doc de +10k chars volvía "sin datos útiles" (bug reportado).
  const out = await chatCheapCascade({ system: sys, user: texto.slice(0, maxChars), json: true, maxTokens: 2000, feature: 'El Archivero', motivo: 'Extraer campos de un documento del negocio', provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: esJsonObjeto });
  // out vacío = ninguna IA respondió (sin key de Gemini/Groq/OpenAI en el workspace).
  if (!out) return { campos: {}, razonamiento: '', sinIA: true };
  const parsed = parseJsonLoose(out);
  const raw = (parsed.campos && typeof parsed.campos === 'object' ? parsed.campos : {}) as Record<string, unknown>;
  const campos: Record<string, string> = {};
  for (const f of fields) {
    const v = raw[f.key];
    if (v != null && String(v).trim()) campos[f.key] = String(v).trim();
  }
  const razonamiento = typeof parsed.razonamiento === 'string' ? parsed.razonamiento.trim().slice(0, 400) : '';
  return { campos, razonamiento, sinIA: false };
}

// ── Panorama libre: TODO lo que la IA entendió del negocio ────────────────────
// No encajado en los campos fijos (eso limitaba). Es un resumen en prosa de todo
// lo que dicen los documentos, para que el dueño vea el panorama y decida qué dejar.
export const ARCHIVERO_PANORAMA_TEMPLATE = `Sos MaKo. A partir de los DOCUMENTOS del negocio de un cliente, escribí un PANORAMA claro y completo de TODO lo que entendés de su negocio: a qué se dedica, su oferta y precios, su avatar (quién es, qué le duele, qué desea, sus objeciones), su nicho/mercado, su tono y voz de marca, y cualquier cosa relevante que un buen estratega anotaría — aunque no entre en un campo. Escribí en español NEUTRO (de "tú", SIN voseo argentino — nada de "tenés/subí/acá"), en secciones cortas con un SUBTÍTULO EN MAYÚSCULA cada una. NO inventes: si algo no aparece en los documentos, no lo pongas. Sé concreto y usá las palabras del cliente. IMPORTANTE: NO expliques lo que vas a hacer, NO incluyas notas, análisis ni comentarios sobre la consigna. Empezá DIRECTO con el primer SUBTÍTULO EN MAYÚSCULA y el texto del panorama, nada antes.`;

// Un modelo "de razonamiento" (gemini-thinking, gpt-oss) a veces vuelca su
// razonamiento (en inglés, comentando la consigna) en vez del panorama. Lo
// detectamos para RECHAZARLO (la cascada prueba el próximo proveedor limpio).
function pareceRazonamiento(t: string): boolean {
  const head = t.slice(0, 500).toLowerCase();
  return /\b(the instruction|the user|we need to|let me|i should|i need to|start immediately|here'?s the|section \d|as an ai|reasoning:|analysis:|okay,? (so|the|let))\b/.test(head) || /devolv[eé] solo el/i.test(head);
}
// Limpia residuos: markdown y cualquier preámbulo antes del primer SUBTÍTULO.
function limpiarPanorama(t: string): string {
  const s = (t || '').replace(/```[a-z]*|```/gi, '').trim();
  const lines = s.split('\n');
  let start = 0;
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const l = lines[i].replace(/[*#>]/g, '').trim();
    if (l.length >= 4 && l.length <= 60 && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(l)) { start = i; break; }
  }
  return (start > 0 ? lines.slice(start).join('\n') : s).trim();
}

// Para el panorama preferimos modelos NO-thinking (Groq 70b primero): un modelo de
// razonamiento (gemini-thinking) gasta el presupuesto de tokens "pensando" y devuelve
// el panorama TRUNCADO a mitad de frase (bug reportado). Gemini queda al final.
const CASCADA_PANORAMA: ProvName[] = ['groq', 'cerebras', 'openai', 'openrouter', 'mistral', 'gemini'];
export async function generarPanorama(textos: string[], contexto: string): Promise<string> {
  const material = textos.map((t, i) => `— DOCUMENTO ${i + 1} —\n${t.slice(0, 8000)}`).join('\n\n');
  const user = `${contexto ? `Lo que ya tenías del negocio:\n${contexto}\n\n` : ''}DOCUMENTOS:\n${material}`.slice(0, 60000);
  const out = await chatCheapCascade({ system: ARCHIVERO_PANORAMA_TEMPLATE, user, maxTokens: 3000, feature: 'El Archivero', motivo: 'Panorama del negocio desde los documentos', provs: CASCADA_PANORAMA, modelos: MODELO_DOCS, validar: (t) => !pareceRazonamiento(t) });
  return limpiarPanorama(out);
}

// ── Preguntas CERRADAS 1x1 para los huecos (estilo Perro, personalizadas) ─────
// Lo que ningún documento resolvió NO se pregunta con un campo abierto: la IA
// arma una pregunta cerrada, corta y a medida del negocio, con opciones probables
// + la opción de escribirlo. Más fácil de contestar.
export const ARCHIVERO_PREGUNTAS_TEMPLATE = `Sos MaKo armando el perfil de un negocio para su fábrica de creativos. Ya sabés esto del negocio:\n{{conocido}}\n\nTe faltan estos datos (clave: qué pide):\n{{faltantes}}\n\nPara CADA dato faltante generá UNA pregunta CERRADA, corta y PERSONALIZADA usando lo que ya sabés (nada genérico), en español NEUTRO (de "tú", sin voseo argentino), con 3 a 5 opciones probables y CONCRETAS para ESTE negocio (no opciones de manual). Devolvé SOLO JSON: {"preguntas":[{"key":"<clave exacta del faltante>","pregunta":"<texto>","opciones":["...","..."]}]}. Usá EXACTAMENTE las claves de los faltantes.`;

export async function generarPreguntasCerradas(
  faltantes: Array<{ key: string; label: string }>,
  conocido: string,
): Promise<Array<{ key: string; pregunta: string; opciones: string[] }>> {
  if (faltantes.length === 0) return [];
  const lista = faltantes.map((f) => `- ${f.key}: ${f.label}`).join('\n');
  const sys = await renderPrompt('archivero.preguntas.system', ARCHIVERO_PREGUNTAS_TEMPLATE, { conocido: conocido || '(todavía no sé nada)', faltantes: lista });
  const out = await chatCheapCascade({ system: sys, user: 'Generá las preguntas cerradas.', json: true, maxTokens: 1600, feature: 'El Archivero', motivo: 'Preguntas cerradas para los huecos del perfil', provs: CASCADA_DOCS, modelos: MODELO_DOCS, validar: (t) => Array.isArray(parseJsonLoose(t).preguntas) });
  const parsed = parseJsonLoose(out);
  const arr = Array.isArray(parsed.preguntas) ? parsed.preguntas : [];
  const validas = new Set(faltantes.map((f) => f.key));
  const res: Array<{ key: string; pregunta: string; opciones: string[] }> = [];
  for (const p of arr as Array<Record<string, unknown>>) {
    const key = String(p.key ?? '');
    if (!validas.has(key)) continue;
    const pregunta = String(p.pregunta ?? '').trim();
    const opciones = Array.isArray(p.opciones) ? p.opciones.map((o) => String(o).trim()).filter(Boolean).slice(0, 5) : [];
    if (pregunta && opciones.length) res.push({ key, pregunta, opciones });
  }
  return res;
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
