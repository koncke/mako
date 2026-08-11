// =============================================================================
// cs-reescritura — MaKo mejora la tarea del cliente con lo hablado en la junta
// =============================================================================
// Es el tercer paso del bucle de entrega y el que cierra el círculo:
//
//   el cliente contesta → SE DEBATE EN LA JUNTA → MaKo reescribe → el cliente aprueba
//
// Lo que hace es simple de decir y fácil de hacer mal: tomar lo que el cliente
// escribió ANTES de la sesión y ampliarlo con lo que se afinó DURANTE la sesión.
//
// ⚠️ TRES REGLAS QUE ESTÁN EN EL PROMPT Y ADEMÁS EN EL CÓDIGO, porque una regla
// que solo vive en la prosa de un prompt se cumple «casi siempre», que es otra
// cosa (AGENTS.md → «Una regla en un prompt no es una regla»):
//
//   1. NO SE PISA lo que escribió el cliente. La propuesta va a `respuesta_ia`,
//      una columna aparte, y el cliente ve las dos y elige. Eso no depende del
//      modelo: lo garantiza `proponerReescritura()`.
//   2. Si la junta no habló del tema, NO se reescribe. Un modelo al que se le
//      pide «mejorá esto» siempre devuelve algo, y ese algo sería inventado. El
//      saneo descarta la respuesta cuando el modelo dice que no hay material.
//   3. Nunca inventa datos. Si el cliente no dio la cifra, la reescritura no la
//      completa: se marca como pendiente, que es la respuesta honesta y además
//      la útil (el dato faltante es el atoro número uno del programa).
//
// EL MODELO VA GRATIS. `plan-fathom` costó US$37 en 30 días por caer en su
// default sin que nadie lo notara; esto corre por cada bloque de cada junta de
// cada cliente, así que es exactamente el mismo perfil de gasto silencioso.

import 'server-only';
import { renderPrompt, contenidoNoConfiable } from './prompt-render';
import { chatCheapCascade } from './ai-cheap';
import { claseDe } from './programa-catalogo';
import { getBloque, proponerReescritura, type Bloque } from './cs-respuestas';

/** El default. Vive acá y se exporta para que `lib/prompt-registry.ts` lo liste:
 *  si el texto se copiara al registro, el día que se edite uno el otro queda
 *  viejo y nadie se entera. */
export const CS_REESCRITURA_TEMPLATE = `Sos MaKo. Acabás de escuchar una sesión de consultoría entre Mauricio Bustos y su cliente, y tenés que mejorar UNA respuesta que el cliente había escrito ANTES de esa sesión.

LA PREGUNTA DEL BLOQUE
{{pregunta}}

LO QUE EL CLIENTE HABÍA ESCRITO
{{respuesta}}

LO QUE SE HABLÓ EN LA SESIÓN
{{conversacion}}

QUÉ TENÉS QUE HACER
Reescribí la respuesta del cliente incorporando lo que se afinó, se corrigió o se decidió en la sesión. El resultado tiene que sonar a él, no a vos: es SU respuesta, mejor dicha y más completa.

REGLAS
- No inventes NADA. Si en la sesión no se dio un dato, no lo completes: escribí explícitamente qué falta y quién quedó de conseguirlo.
- No borres lo que el cliente escribió si sigue siendo cierto. Ampliás, no reemplazás.
- Si la sesión NO habló de este tema, no fuerces una mejora. Devolvé exactamente SIN_MATERIAL y nada más.
- Sin preámbulos, sin «acá está tu respuesta mejorada», sin cierres. Solo el texto de la respuesta.
- Voseo, directo, sin lenguaje motivacional y sin signos de exclamación.

Devolvé SOLO el texto de la respuesta reescrita, o SIN_MATERIAL.`;

export const CLAVE_PROMPT = 'cs.bloque.reescritura';

/** Lo que devuelve el modelo cuando la junta no tocó el tema. Es una palabra y
 *  no una frase a propósito: una frase se puede parecer a una respuesta válida y
 *  terminaría guardada como propuesta. */
const SIN_MATERIAL = 'SIN_MATERIAL';

/** ¿Estos dos textos dicen lo mismo? Se ignoran los espacios, los saltos de
 *  línea y las mayúsculas: son las tres cosas que un modelo cambia sin querer y
 *  que no significan nada.
 *
 *  A propósito NO es una comparación difusa: si el modelo agregó una frase, eso
 *  ES una mejora y tiene que llegarle al cliente. Lo que se descarta es lo
 *  idéntico, no lo parecido. */
function igualEnLoQueImporta(a: string, b: string | null): boolean {
  if (!b) return false;
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  return norm(a) === norm(b);
}

export type ResultadoReescritura =
  | { ok: true; claseId: string; propuesta: string }
  | { ok: false; motivo: 'sin-bloque' | 'sin-respuesta' | 'sin-material' | 'sin-modelo' };

/**
 * Reescribe UN bloque. Devuelve el motivo cuando no hace nada, en vez de un
 * booleano: «la junta no habló de esto» y «el modelo falló» se arreglan distinto.
 *
 * Corre dentro de `runWithWorkspace` (lo llama el cron, que no tiene sesión).
 */
export async function reescribirBloque(input: {
  leadId: number;
  claseId: string;
  /** El resumen y los puntos de la reunión. NO las tareas extraídas: de una lista
   *  de títulos sale una reescritura plausible y vacía. */
  conversacion: string;
  area?: string | null;
  fuenteReunion?: string | null;
}): Promise<ResultadoReescritura> {
  const clase = claseDe(input.claseId);
  if (!clase) return { ok: false, motivo: 'sin-bloque' };

  const bloque: Bloque | null = await getBloque(input.leadId, input.claseId, input.area);
  // Sin respuesta previa no hay nada que MEJORAR. Escribirla de cero sería
  // ponerle en la boca al cliente algo que nunca dijo, y encima llegaría a la
  // pantalla de aprobación como si él lo hubiera escrito antes.
  if (!bloque?.respuesta?.trim()) return { ok: false, motivo: 'sin-respuesta' };
  if (!input.conversacion.trim()) return { ok: false, motivo: 'sin-material' };

  const system = await renderPrompt(CLAVE_PROMPT, CS_REESCRITURA_TEMPLATE, {
    pregunta: clase.clase.pregunta,
    // El texto del cliente y el transcript son contenido NO CONFIABLE: van
    // envueltos para que un `{{...}}` adentro no se interpole como slot.
    respuesta: contenidoNoConfiable(bloque.respuesta, 'respuesta del cliente'),
    conversacion: contenidoNoConfiable(input.conversacion.slice(0, 24_000), 'transcripción de la sesión'),
  });

  // `chatCheapCascade` y no `chatCheap`: si el proveedor de turno devuelve 429
  // —lo normal cuando esto corre en tanda, un bloque tras otro— se recorre toda
  // la cascada GRATIS antes de pagar. Un fallback que cobra al primer 429 ya
  // costó plata una vez (AGENTS.md → «Claude es el ÚLTIMO recurso»).
  const salida = await chatCheapCascade({
    feature: 'cs-reescritura',
    system,
    user: 'Reescribí la respuesta.',
    maxTokens: 1600,
  }).catch(() => null);

  const texto = (salida ?? '').trim();
  if (!texto) return { ok: false, motivo: 'sin-modelo' };

  // La segunda capa de la regla 2. El modelo puede contestar `SIN_MATERIAL`
  // solo, o envuelto en comillas, o con un punto: cualquiera de esas es un no.
  if (/^["'`]*SIN_MATERIAL[."'`]*$/i.test(texto)) return { ok: false, motivo: 'sin-material' };
  // Y si lo dijo adentro de un texto largo, gana el texto: dijo algo además.
  if (texto.length < SIN_MATERIAL.length + 8 && texto.toUpperCase().includes(SIN_MATERIAL)) {
    return { ok: false, motivo: 'sin-material' };
  }

  // ⚠️ EL TERCER CASO, que no estaba y salió en el primer ensayo de verdad.
  // Pedido de reescribir un bloque del que la junta no habló, el modelo hizo lo
  // correcto —no agregar nada— pero lo dijo de la forma que no esperábamos:
  // devolvió el texto IDÉNTICO en vez de `SIN_MATERIAL`.
  //
  // Sin este corte el bloque pasaba igual a «esperando tu ok» y el cliente
  // recibía un aviso para aprobar algo que no cambió. Eso no es solo ruido: es
  // lo que entrena a aprobar sin leer, y la próxima vez que la propuesta SÍ
  // diga algo distinto, tampoco la va a leer.
  //
  // Es la parte determinista de la regla, y por eso va acá y no en el prompt:
  // «devolvé SIN_MATERIAL» es una instrucción que el modelo puede obedecer de
  // muchas maneras; «el texto es el mismo» es una comparación que no falla.
  if (igualEnLoQueImporta(texto, bloque.respuesta)) return { ok: false, motivo: 'sin-material' };

  await proponerReescritura(input.leadId, input.claseId, texto, {
    area: input.area,
    fuenteReunion: input.fuenteReunion ?? null,
  });
  return { ok: true, claseId: input.claseId, propuesta: texto };
}

/**
 * Reescribe TODOS los bloques que este cliente ya contestó y todavía no aprobó.
 *
 * Se hace así —y no eligiendo «el bloque de esta junta»— porque una sesión no
 * corresponde a un bloque: se debaten los que estén abiertos, y cuál se tocó lo
 * sabe el modelo leyendo la conversación, no nosotros mirando un calendario. Los
 * que la junta no tocó se descartan solos con `SIN_MATERIAL`.
 */
export async function reescribirBloquesDeLaJunta(input: {
  leadId: number;
  conversacion: string;
  fuenteReunion?: string | null;
  /** Tope de bloques por junta. Cada uno es una llamada al modelo. */
  tope?: number;
}): Promise<{ reescritos: string[]; sinMaterial: number; errores: number }> {
  const { bloquesDeCliente } = await import('./cs-respuestas');
  const filas = await bloquesDeCliente(input.leadId).catch(() => []);
  const abiertos = filas.filter(f => f.estado === 'contestada' || f.estado === 'revisada_ia');

  const reescritos: string[] = [];
  let sinMaterial = 0, errores = 0;

  for (const f of abiertos.slice(0, input.tope ?? 8)) {
    const r = await reescribirBloque({
      leadId: input.leadId, claseId: f.clase_id, area: f.area,
      conversacion: input.conversacion, fuenteReunion: input.fuenteReunion,
    }).catch(() => ({ ok: false, motivo: 'sin-modelo' } as const));
    if (r.ok) reescritos.push(r.claseId);
    else if (r.motivo === 'sin-material') sinMaterial++;
    else errores++;
  }
  return { reescritos, sinMaterial, errores };
}
