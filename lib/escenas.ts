import 'server-only';

// =============================================================================
// escenas — MaKo escribe los escenarios de un anuncio, antes de animar nada
// =============================================================================
// El proceso de producción real, el que se usó a mano en los cuatro anuncios que
// funcionaron, es: **primero la imagen, después el video**. El generador se
// estaba saltando el primer paso, y el primer clip que salió de punta a punta lo
// pagó — ángulo equivocado y una cara que no era la del dueño.
//
// ── Cuántas imágenes: lo dice el CATÁLOGO, no el modelo ────────────────────
// `Puesta.escenarios`. Siete tomas adentro del mismo auto son UN escenario y una
// imagen; un recorrido por una oficina son varios lugares y varias imágenes. Eso
// es una propiedad del formato, no del guion, así que no se le pregunta a nadie:
// se lee. Preguntárselo al modelo sería convertir un dato en una opinión.
//
// Lo que sí es juicio —y por eso sí se pregunta— es DÓNDE cambia el escenario y
// qué se ve en cada uno.
//
// ── La regla que gobierna el prompt: no se describe la cara ────────────────
// La identidad la resuelve la foto real de la persona, que viaja en el mismo
// pedido (`referenceImages` con `isLikeness`). Un prompt que además describe una
// cara le está dando al modelo dos fuentes para lo mismo, y gana la que no
// queremos. Está escrito en el prompt Y validado en `mencionaCara()`, porque una
// regla que solo vive en la prosa de un prompt se cumple casi siempre — y acá
// «casi siempre» se descubre tres pasos después, con los créditos del video ya
// gastados.

import { chatCheapCascade, CASCADA_DOCS } from '@/lib/ai-cheap';
import { armarEscenas, mencionaCara, validarEscenas, type Escena } from '@/lib/escenas-core';
import type { PlanVideo } from '@/lib/video-planner';
import type { Puesta } from '@/lib/puestas-data';

export type { Escena };

export const FEATURE_ESCENAS = 'video-escenas';

const SYSTEM = `Eres MaKo, el director de fotografía de este anuncio.

Te dan el plan de tomas de un video publicitario vertical y el formato con el que
se va a filmar. Tu trabajo es decidir EN QUÉ ESCENARIOS se filma y escribir el
prompt de la imagen de cada uno. Esas imágenes se generan ANTES del video: cada
clip se anima a partir de la imagen de su escenario.

CUÁNTOS ESCENARIOS: te lo dan. No es negociable y no es una sugerencia — sale del
formato. Devuelve exactamente esa cantidad, ni una más ni una menos.

DÓNDE CORTA CADA UNO: eso sí lo decides tú, mirando qué pasa en cada toma. El
cambio de escenario llega temprano, para no repetir el mismo rincón dos veces.

EL PROMPT DE LA IMAGEN — lo más importante:
- Va en INGLÉS. El guion va en español; la escena, en inglés.
- Describe SOLO la composición: el lugar, la luz, la hora del día, el encuadre,
  el lente, la distancia de cámara, la ropa, los objetos que hay alrededor.
- NUNCA describas a la persona. Ni su cara, ni sus ojos, ni su pelo, ni su barba,
  ni su edad, ni su sonrisa, ni su piel. La persona la pone una foto real que
  viaja aparte. Si la describes, sale otra persona.
- Refiérete a ella como "the subject" y listo.
- Vertical 9:16, fotográfico y realista, nunca ilustración ni render 3D.
- La ropa y la hora del día tienen que ser LAS MISMAS en todos los escenarios: es
  el mismo anuncio, filmado seguido. Un cambio de camisa entre la toma 3 y la 4
  delata que el video es generado.
- Entre 40 y 70 palabras. Un prompt corto deja que el modelo rellene; uno largo
  se contradice a sí mismo.

Responde SOLO con JSON:
{"escenas":[{"desdeToma":<n>,"lugar":"<en español, una línea>","prompt":"<en inglés>"}]}`;

function planParaPrompt(plan: PlanVideo): string {
  return plan.clips
    .map((c) => `${c.n}. [${c.camara}] ${c.queSeVe || '(sin acción)'} — dice: "${c.voz}"`)
    .join('\n');
}

/**
 * Los escenarios de un anuncio. `null` si no se pudo.
 *
 * Nunca lanza, y «no se pudo» es un resultado que la pantalla sabe mostrar: el
 * plan ya existe y se puede seguir editando. Lo que NO se hace es generar
 * imágenes con un reparto a medias — una imagen equivocada no se ve como un
 * error, se ve como una imagen.
 */
export type SalidaEscenas =
  | { ok: true; escenas: Escena[] }
  /** `filtro` = la IA contestó y la red la descartó. NO es culpa del cliente. */
  | { ok: false; motivo: 'filtro' | 'ia'; detalle: string };

export async function escribirEscenas(
  plan: PlanVideo,
  puesta: Puesta,
  ajuste?: string,
): Promise<SalidaEscenas> {
  const tomas = plan.clips.length;
  if (!tomas) return { ok: false, motivo: 'ia', detalle: 'el plan no tiene tomas' };
  const motivos: string[] = [];
  // Nunca más escenarios que tomas: dos imágenes para una sola toma es un
  // escenario que el guion no tiene.
  const escenarios = Math.max(1, Math.min(puesta.escenarios || 1, tomas));

  const user = [
    `FORMATO: ${puesta.nombre} (${puesta.tecnico}) · cámara ${puesta.camara}`,
    `ESCENARIOS A DEVOLVER: ${escenarios}`,
    '',
    'REGLAS DE ESTE FORMATO:',
    puesta.reglas.map((r) => `- ${r}`).join('\n'),
    '',
    `ANUNCIO: ${plan.titulo}`,
    'TOMAS:',
    planParaPrompt(plan),
    ajuste ? `\nEL CLIENTE PIDIÓ ESTE CAMBIO:\n${ajuste}` : '',
  ].join('\n');

  let crudo = '';
  try {
    crudo = await chatCheapCascade({
      system: SYSTEM,
      user,
      json: true,
      // La cascada CON Gemini adelante, igual que el ordenado de guiones: este
      // pedido es de FORMATO ESTRICTO —se valida entero o se descarta— y ahí un
      // modelo que no respeta el esquema no degrada, falla.
      provs: CASCADA_DOCS,
      maxTokens: 1800,
      temperature: 0.4,
      feature: FEATURE_ESCENAS,
      motivo: 'escribir los escenarios de un anuncio',
      validar: (t) => !!validarEscenas(t, escenarios, tomas, motivos),
    });
  } catch (e) {
    return { ok: false, motivo: 'ia', detalle: String((e as Error)?.message ?? e) };
  }

  const val = validarEscenas(crudo, escenarios, tomas, motivos);
  if (!val) {
    // Si la red guardó un motivo, la IA contestó y el problema es NUESTRO. Sin
    // motivo, no se sabe, y no se sabe se dice — no se convierte en una acusación.
    return motivos.length
      ? { ok: false, motivo: 'filtro', detalle: [...new Set(motivos)].join(' · ') }
      : { ok: false, motivo: 'ia', detalle: 'la respuesta no tuvo la forma esperada' };
  }
  return { ok: true, escenas: armarEscenas(tomas, escenarios, val) };
}

const SYSTEM_UNA = `Eres MaKo, el director de fotografía de este anuncio.

Te dan el prompt de UN escenario y lo que el cliente quiere cambiar. Devuelves el
prompt corregido. Las mismas reglas de siempre:

- En INGLÉS, solo composición: lugar, luz, hora, encuadre, lente, distancia,
  ropa, objetos.
- NUNCA describas a la persona: ni cara, ni ojos, ni pelo, ni barba, ni edad, ni
  sonrisa, ni piel. Se dice "the subject" y nada más. Si la describes, sale otra
  persona.
- Vertical 9:16, fotográfico y realista.
- Entre 40 y 70 palabras.
- Cambias lo que pidió el cliente y CONSERVAS todo lo demás. No es un prompt
  nuevo: es el mismo con la corrección aplicada.

Responde SOLO con JSON: {"prompt":"<en inglés>","lugar":"<en español, una línea>"}`;

/**
 * Reescribe UN escenario con lo que pidió el cliente. `null` si no se pudo.
 *
 * Uno y no todos, a propósito: la corrección es sobre la imagen que la persona
 * está mirando. Rehacer las cuatro porque la segunda no gustó cambia las tres
 * que ya estaban aprobadas — que es exactamente la queja que hizo que el guion
 * se editara por bloques y no entero.
 */
export async function reescribirEscena(escena: Escena, ajuste: string): Promise<Escena | null> {
  const pedido = (ajuste || '').trim();
  if (!pedido) return null;

  let crudo = '';
  try {
    crudo = await chatCheapCascade({
      system: SYSTEM_UNA,
      user: [`LUGAR: ${escena.lugar}`, `PROMPT ACTUAL:\n${escena.prompt}`, `\nCAMBIO PEDIDO:\n${pedido}`].join('\n'),
      json: true,
      provs: CASCADA_DOCS,
      maxTokens: 700,
      temperature: 0.4,
      feature: FEATURE_ESCENAS,
      motivo: 'corregir el escenario de un anuncio',
      validar: (t) => !!leerUna(t),
    });
  } catch { return null; }

  const ok = leerUna(crudo);
  return ok ? { ...escena, lugar: ok.lugar, prompt: ok.prompt } : null;
}

function leerUna(crudo: string): { prompt: string; lugar: string } | null {
  let o: Record<string, unknown>;
  try { o = JSON.parse(crudo) as Record<string, unknown>; } catch { return null; }
  const prompt = String(o?.prompt ?? '').trim();
  const lugar = String(o?.lugar ?? '').trim();
  if (prompt.length < 30 || !lugar) return null;
  // La misma red que en el reparto: un prompt que describe una cara no se
  // corrige, se descarta. Corregirlo a mano deja frases rotas que el modelo de
  // imagen interpreta peor que la original.
  if (mencionaCara(prompt).length > 0) return null;
  return { prompt, lugar };
}
