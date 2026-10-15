// =============================================================================
// editor-video/chat-catalogo — lo que el chat del Video Editor PUEDE pedir
// =============================================================================
// Pedido de Martín (15/10/2026, por «Estrategia 3 cuentas»): «es importante que video
// editor tenga, como landing, un chat al costado donde pueda ir editando todo con
// prompt». El modelo es el del Landing Generator (app/web-generator/editor/paneles/
// PanelAgente.tsx): la IA PROPONE, la persona mira «Original | Modificado» y acepta o
// descarta entero.
//
// Lo que cambia respecto del Landing es el transporte, no el comportamiento: una
// landing es texto y la IA la devuelve entera; la línea de tiempo son ticks, ids y
// parámetros, y devolverla entera la rompe. Así que la IA devuelve OPERACIONES de esta
// lista cerrada, y el editor las aplica con los comandos del propio motor
// (app/video-editor/_opencut/chat/aplicar.ts), en un solo paso de deshacer.
//
// Una lista, un lugar: de acá salen el texto que lee la IA (`catalogoParaPrompt`) y la
// validación de lo que vuelve (`validarOperaciones`), en el server y en el editor.
//
// SIN `server-only` y sin importar nada del motor (`_opencut/`): lo importan la ruta (un
// módulo del server no puede importar un valor del motor:
// tests/video-editor-integracion.test.ts) y el editor. Puro, con test
// (tests/video-editor-chat.test.ts).
//
// ⚠️ Nada de esta lista cuesta plata (Avatar de IA y Texto a voz no están). Una
// operación que cobre entra con su confirmación de pantalla aparte, nunca acá.
// =============================================================================

/** Lo que la IA puede devolver. Los tiempos van en SEGUNDOS de la línea de tiempo. */
export type OperacionChat =
  | { op: 'agregar_texto'; texto: string; inicio: number; duracion: number }
  | { op: 'cambiar_texto'; ref: string; texto: string }
  | { op: 'borrar'; refs: string[] }
  | { op: 'mover'; ref: string; inicio: number }
  | { op: 'duracion'; ref: string; duracion: number }
  | { op: 'dividir'; ref: string; en: number }
  | { op: 'volumen'; ref: string; db: number }
  | { op: 'silenciar'; ref: string; silenciado: boolean }
  | { op: 'ocultar'; ref: string; oculto: boolean }
  | { op: 'reemplazar_en_subtitulos'; buscar: string; reemplazo: string }
  | { op: 'generar_subtitulos' };

export type IdOperacion = OperacionChat['op'];

/** Topes de lo que vuelve. Fuera de rango se RECHAZA con su motivo, nunca se recorta. */
export const TOPES_CHAT = {
  operaciones: 40,
  texto: 200,
  /** Segundos. Un texto nuevo o una duración, entre esto y el máximo. */
  duracionMin: 0.2,
  duracionMax: 600,
  tiempoMax: 3600,
  /** Iguales a VOLUME_DB_MIN/MAX de app/video-editor/_opencut/timeline/audio-constants.ts (lo fija el test). */
  volumenMinDb: -60,
  volumenMaxDb: 20,
  /** Cuánto se le puede mandar a la IA de una vez (la vista de la línea de tiempo, en JSON). */
  vistaMax: 60_000,
  instruccion: 2_000,
} as const;

/** Las operaciones, para el texto que lee la IA. El orden es el de la lista que se le muestra. */
export const OPERACIONES_CHAT: Array<{ op: IdOperacion; forma: string; para: string }> = [
  { op: 'agregar_texto', forma: '{"op":"agregar_texto","texto":"…","inicio":0,"duracion":3}', para: 'Agrega un texto en pantalla (va en una pista de texto libre).' },
  { op: 'cambiar_texto', forma: '{"op":"cambiar_texto","ref":"t1","texto":"…"}', para: 'Cambia lo que dice un texto que ya existe.' },
  { op: 'borrar', forma: '{"op":"borrar","refs":["v2","t1"]}', para: 'Borra uno o varios elementos.' },
  { op: 'mover', forma: '{"op":"mover","ref":"t1","inicio":4}', para: 'Mueve un elemento en el tiempo, dentro de su pista.' },
  { op: 'duracion', forma: '{"op":"duracion","ref":"t1","duracion":5}', para: 'Cambia cuánto dura un texto, una imagen, un sticker o una forma (no un video ni un audio).' },
  { op: 'dividir', forma: '{"op":"dividir","ref":"v1","en":2.5}', para: 'Corta un elemento en ese segundo de la línea de tiempo; queda en dos partes.' },
  { op: 'volumen', forma: '{"op":"volumen","ref":"a1","db":-6}', para: 'Volumen de un video o un audio, en dB (0 = original, −6 ≈ la mitad, de −60 a 20).' },
  { op: 'silenciar', forma: '{"op":"silenciar","ref":"v1","silenciado":true}', para: 'Silencia o devuelve el sonido de un video o un audio.' },
  { op: 'ocultar', forma: '{"op":"ocultar","ref":"t2","oculto":true}', para: 'Oculta o vuelve a mostrar un elemento visual sin borrarlo.' },
  { op: 'reemplazar_en_subtitulos', forma: '{"op":"reemplazar_en_subtitulos","buscar":"…","reemplazo":"…"}', para: 'Busca un texto en TODOS los subtítulos y lo cambia por otro, sin distinguir mayúsculas («Buscar y reemplazar»).' },
  { op: 'generar_subtitulos', forma: '{"op":"generar_subtitulos"}', para: 'Subtítulos automáticos de todo el video: transcribe la voz en el navegador (gratis) con el idioma y la plantilla elegidos en Subtítulos.' },
];

const IDS = new Set<string>(OPERACIONES_CHAT.map((o) => o.op));

/** El catálogo como lo lee la IA (va en el slot {{catalogo}} del prompt). */
export function catalogoParaPrompt(): string {
  return OPERACIONES_CHAT.map((o) => `- ${o.forma} → ${o.para}`).join('\n');
}

/** Forma del JSON de respuesta (va en el slot {{formato}}). */
export const FORMATO_CHAT = `Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin markdown ni texto fuera del JSON, con esta forma:
{"resumen": "una frase para la persona: qué vas a cambiar, o por qué no se puede", "operaciones": [ …operaciones del catálogo, en el orden en que se aplican… ]}
Si el pedido no se puede hacer con el catálogo, "operaciones" va vacío y el resumen dice qué no se puede.`;

// ─────────────────────────────────────────────────────────────────────────────
// Validar lo que devolvió la IA (la FORMA; las referencias las mira el editor)
// ─────────────────────────────────────────────────────────────────────────────

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const esRef = (x: unknown): x is string => typeof x === 'string' && /^[a-z]\d{1,4}$/.test(x);
const numero = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const textoValido = (x: unknown): string | null => {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t && t.length <= TOPES_CHAT.texto ? t : null;
};
const enRango = (n: number | null, min: number, max: number): n is number => n !== null && n >= min && n <= max;
/** Los tiempos se guardan a la centésima: lo que la IA mande con más decimales no cambia nada. */
const centesima = (n: number) => Math.round(n * 100) / 100;

/**
 * Una operación de la IA, validada; o el motivo por el que no. El motivo es corto: lo ve la
 * persona en la revisión («No se aplica: …»).
 */
export function validarOperacion(raw: unknown): { ok: true; op: OperacionChat } | { ok: false; motivo: string } {
  if (!esObjeto(raw) || typeof raw.op !== 'string') return { ok: false, motivo: 'una operación sin forma' };
  const op = raw.op;
  if (!IDS.has(op)) return { ok: false, motivo: `«${op.slice(0, 30)}» no es algo que pueda hacer` };
  const ref = raw.ref;
  switch (op as IdOperacion) {
    case 'agregar_texto': {
      const texto = textoValido(raw.texto);
      const inicio = numero(raw.inicio);
      const duracion = numero(raw.duracion);
      if (!texto) return { ok: false, motivo: `un texto vacío o de más de ${TOPES_CHAT.texto} caracteres` };
      if (!enRango(inicio, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un texto sin inicio válido' };
      if (!enRango(duracion, TOPES_CHAT.duracionMin, TOPES_CHAT.duracionMax)) return { ok: false, motivo: 'un texto sin duración válida' };
      return { ok: true, op: { op: 'agregar_texto', texto, inicio: centesima(inicio), duracion: centesima(duracion) } };
    }
    case 'cambiar_texto': {
      const texto = textoValido(raw.texto);
      if (!esRef(ref) || !texto) return { ok: false, motivo: 'un cambio de texto incompleto' };
      return { ok: true, op: { op: 'cambiar_texto', ref, texto } };
    }
    case 'borrar': {
      const refs = Array.isArray(raw.refs) ? [...new Set(raw.refs.filter(esRef))] : [];
      if (!refs.length) return { ok: false, motivo: 'un borrado sin elementos' };
      return { ok: true, op: { op: 'borrar', refs } };
    }
    case 'mover': {
      const inicio = numero(raw.inicio);
      if (!esRef(ref) || !enRango(inicio, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un movimiento incompleto' };
      return { ok: true, op: { op: 'mover', ref, inicio: centesima(inicio) } };
    }
    case 'duracion': {
      const duracion = numero(raw.duracion);
      if (!esRef(ref) || !enRango(duracion, TOPES_CHAT.duracionMin, TOPES_CHAT.duracionMax)) return { ok: false, motivo: 'una duración inválida' };
      return { ok: true, op: { op: 'duracion', ref, duracion: centesima(duracion) } };
    }
    case 'dividir': {
      const en = numero(raw.en);
      if (!esRef(ref) || !enRango(en, 0, TOPES_CHAT.tiempoMax)) return { ok: false, motivo: 'un corte incompleto' };
      return { ok: true, op: { op: 'dividir', ref, en: centesima(en) } };
    }
    case 'volumen': {
      const db = numero(raw.db);
      if (!esRef(ref) || !enRango(db, TOPES_CHAT.volumenMinDb, TOPES_CHAT.volumenMaxDb)) return { ok: false, motivo: `un volumen fuera de ${TOPES_CHAT.volumenMinDb} a ${TOPES_CHAT.volumenMaxDb} dB` };
      return { ok: true, op: { op: 'volumen', ref, db: Math.round(db * 10) / 10 } };
    }
    case 'silenciar': {
      if (!esRef(ref) || typeof raw.silenciado !== 'boolean') return { ok: false, motivo: 'un silencio incompleto' };
      return { ok: true, op: { op: 'silenciar', ref, silenciado: raw.silenciado } };
    }
    case 'ocultar': {
      if (!esRef(ref) || typeof raw.oculto !== 'boolean') return { ok: false, motivo: 'un ocultar incompleto' };
      return { ok: true, op: { op: 'ocultar', ref, oculto: raw.oculto } };
    }
    case 'reemplazar_en_subtitulos': {
      const buscar = textoValido(raw.buscar);
      const reemplazo = typeof raw.reemplazo === 'string' ? raw.reemplazo.trim() : null;
      if (!buscar || reemplazo === null || reemplazo.length > TOPES_CHAT.texto) return { ok: false, motivo: 'un reemplazo incompleto' };
      if (buscar === reemplazo) return { ok: false, motivo: 'un reemplazo que no cambia nada' };
      return { ok: true, op: { op: 'reemplazar_en_subtitulos', buscar, reemplazo } };
    }
    case 'generar_subtitulos':
      return { ok: true, op: { op: 'generar_subtitulos' } };
  }
}

/** Todas las de la respuesta: las válidas, en orden, y por qué se descartó cada otra. */
export function validarOperaciones(raw: unknown): { operaciones: OperacionChat[]; descartes: string[] } {
  const lista = Array.isArray(raw) ? raw : [];
  const operaciones: OperacionChat[] = [];
  const descartes: string[] = [];
  for (const r of lista) {
    if (operaciones.length >= TOPES_CHAT.operaciones) {
      descartes.push(`más de ${TOPES_CHAT.operaciones} cambios de una vez`);
      break;
    }
    const v = validarOperacion(r);
    if (v.ok) operaciones.push(v.op);
    else descartes.push(v.motivo);
  }
  return { operaciones, descartes };
}
