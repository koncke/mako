// =============================================================================
// Variantes de cada mensaje — el mismo contenido dicho de formas distintas
// =============================================================================
// Dos problemas con una sola causa: mandar el MISMO texto palabra por palabra a
// cientos de personas es el patrón que WhatsApp busca para restringir un número,
// y además se lee como un bot al instante.
//
// La solución obvia sería que la IA redacte cada mensaje al momento de enviarlo.
// Es también la más cara: una llamada por lead por paso, en un bucle que crece
// con el tráfico de todos los clientes. Y es la que menos control da — nadie
// aprobó ese texto.
//
// Acá se generan UNA VEZ, al terminar de armar la secuencia, y el motor sortea
// entre ellas en cada envío. Cuesta una llamada por paso en total, el dueño las
// puede leer y corregir antes de prender nada, y el mensaje que sale siempre es
// uno que alguien aprobó.

import 'server-only';

import { chatCheapCascade, CASCADA_GRATIS } from './ai-cheap';
import { renderPrompt } from './prompt-render';
import { getVozGuia } from './nutricion-generator';
import { getSecuenciasConStats, setSecuenciaPasos, type PasoSecuencia } from './nutricion';
import { piezasCriticas } from './texto-critico';
import { partesExplicitas } from './mensaje-partes';

/** Cuántas formas alternativas por mensaje. */
const POR_PASO = 4;

export const VARIANTES_SYSTEM_TEMPLATE = `Eres MaKo y escribes VARIANTES de un mensaje de WhatsApp: el mismo contenido, dicho de otra forma.

Para qué sirven: este mensaje se le manda a muchas personas distintas. Si a todas les llega el texto idéntico, WhatsApp lo detecta como envío masivo y puede restringir el número — y quien lo recibe se da cuenta de que le escribió un sistema.

CÓMO HABLA ESTE NEGOCIO:
{{voz}}

REGLAS, en orden de importancia:
1. MISMO CONTENIDO. Cada variante tiene que decir exactamente lo mismo: la misma oferta, la misma pregunta, el mismo pedido, la misma información. No agregues nada que el original no diga ni quites nada que sí diga.
2. CONSERVA LOS PLACEHOLDERS TAL CUAL. Todo lo que venga entre llaves dobles ({{"{{"}}nombre{{"}}"}}, {{"{{"}}empresa{{"}}"}}) y todo enlace tienen que aparecer igual en cada variante, sin traducir ni reescribir.
3. MISMO REGISTRO. Si el original tutea, todas tutean. Si usa emojis, todas los usan. Si es de dos líneas, ninguna es de seis.
4. QUE SE NOTEN DISTINTAS AL LEERLAS SEGUIDAS. Cambiar una palabra no alcanza: cambia el orden de las frases, la forma de abrir, cómo se hace la pregunta.
5. Nada de numerarlas, ni de agregar comillas, títulos o comentarios.

Devuelve EXCLUSIVAMENTE este objeto JSON, sin markdown:
{"variantes":["…","…","…"]}`;

function parseJsonLoose(raw: string): Record<string, unknown> {
  const s = (raw || '').trim();
  if (!s) return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { /* extraer */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { /* nos rendimos */ } }
  return {};
}

// `piezasCriticas` vive en lib/texto-critico.ts: el paso en modo IA hace la misma pregunta
// sobre lo que escribe el modelo, y una regla copiada en dos archivos es la que se queda vieja.

/**
 * Variantes de UN texto. Descarta las que pierden un placeholder o un enlace:
 * una variante sin el {{nombre}} sale sin personalizar, y una sin el link
 * promete algo que no manda. Mejor menos variantes que una rota.
 */
async function variantesDe(texto: string, voz: string): Promise<string[]> {
  const base = texto.trim();
  if (base.length < 15) return []; // un "ok" no necesita variantes
  const criticas = piezasCriticas(base);

  const system = await renderPrompt('chatagent.variantes', VARIANTES_SYSTEM_TEMPLATE, {
    voz: voz || '(sin guía de voz: mantén un registro neutro, cercano y directo)',
  });

  let raw = '';
  try {
    raw = await chatCheapCascade({
      system,
      user: `MENSAJE ORIGINAL:\n${base}\n\nEscribe ${POR_PASO} variantes.`,
      json: true, maxTokens: 1200, feature: 'chat-agent-variantes',
      motivo: 'Variantes anti-repetición de un paso',
      provs: CASCADA_GRATIS,
      validar: (t) => Array.isArray(parseJsonLoose(t).variantes),
    });
  } catch { return []; }

  const arr = parseJsonLoose(raw).variantes;
  if (!Array.isArray(arr)) return [];

  const out: string[] = [];
  for (const v of arr) {
    const t = String(v ?? '').trim();
    if (!t || t === base) continue;
    // Si perdió una pieza crítica, se descarta: es peor que no tener variante.
    if (criticas.some((c) => !t.includes(c))) continue;
    // Un texto desproporcionado respecto del original no es "la misma cosa".
    if (t.length > base.length * 2.2 || t.length < base.length * 0.4) continue;
    out.push(t);
  }
  return out.slice(0, POR_PASO);
}

export type ResultadoVariantes = { pasos: number; generadas: number };

/**
 * Genera las variantes de todos los pasos de texto de una secuencia. Los pasos
 * de audio no llevan: el binario es uno solo.
 *
 * Se trocea de a uno y en serie a propósito: son N llamadas contra el
 * maxDuration del route, y en paralelo un pico de rate-limit deja la mitad de
 * los pasos sin variantes sin que nadie lo note.
 */
export async function generarVariantes(secuenciaId: number): Promise<ResultadoVariantes> {
  const secs = await getSecuenciasConStats();
  const sec = secs.find((s) => s.id === secuenciaId);
  if (!sec) throw new Error('Esa secuencia no existe en este workspace.');

  const voz = (await getVozGuia().catch(() => null)) ?? '';
  const pasos = sec.pasos as PasoSecuencia[];
  let generadas = 0;
  const nuevos: PasoSecuencia[] = [];

  for (const p of pasos) {
    // Un mensaje de VARIAS partes no sortea variantes (cuarta tanda, punto 15): son otras formas de
    // decir UN texto, y `setSecuenciaPasos` se las saca al guardar (`partesAlGuardar`). Generarlas era
    // pagar un pedido al modelo por cada uno y contar como «generadas» unas que no se guardaban.
    if (p.tipo === 'audio' || !p.cuerpo?.trim() || partesExplicitas(p)) { nuevos.push(p); continue; }
    const vs = await variantesDe(p.cuerpo, voz);
    generadas += vs.length;
    nuevos.push(vs.length ? { ...p, variantes: vs } : p);
  }

  await setSecuenciaPasos(secuenciaId, nuevos);
  return { pasos: nuevos.filter((p) => p.variantes?.length).length, generadas };
}
