import 'server-only';

// =============================================================================
// guion-estructurar — MaKo le pone los rótulos a un guion que vino suelto
// =============================================================================
// Un guion que escribe MaKo trae sus bloques marcados: GANCHO en una línea sola,
// después el texto, después HISTORIA, y así. Eso NO es decoración:
//
//   · el parser de la UI corta el guion en tarjetas por esas líneas
//     (lib/guion-estructuras.ts: «las etiquetas son CONTRATO con el parser»),
//   · `soloHablado()` las saca para medir cuánto dura el guion, y
//   · el planificador de tomas las lee para saber qué parte es el gancho y cuál
//     el cierre.
//
// Un guion que el cliente pega no las trae. Entra igual, pero entra ciego: se ve
// como un bloque de texto y las tomas se reparten sin saber dónde estaba el
// gancho.
//
// ── El contrato con el modelo: NUNCA devuelve el texto ──────────────────────
// El modelo devuelve NÚMEROS DE LÍNEA, no el guion reescrito. Es la diferencia
// entre «dime dónde cortar» y «devuélveme esto ordenado»: lo segundo lo deja
// cambiar una palabra, arreglar una coma o «mejorar» una frase, y nadie se
// entera porque el resultado se sigue leyendo bien. Las palabras del cliente son
// del cliente.
//
// Y abajo del contrato hay una red: después de insertar los rótulos se compara
// la huella contra la del original. Si cambió una sola palabra, se descarta todo.

import { chatCheapCascade, CASCADA_DOCS } from '@/lib/ai-cheap';
import { getEstructurasGuion } from '@/lib/guion-estructuras-store';
import type { EstructuraGuion } from '@/lib/guion-estructuras';
import { huellaGuion } from '@/lib/guiones-normalizar';
import { numerarLineas, validarCortes, insertarRotulos } from '@/lib/guion-estructurar-core';

export type GuionEstructurado = {
  /** El guion con los rótulos insertados. Las palabras son las mismas. */
  texto: string;
  estructuraId: string;
  estructuraNombre: string;
};

const SYSTEM = `Eres MaKo, el asistente de marketing de este negocio.

Te dan un guion de video publicitario que el cliente escribió por su cuenta, con
las líneas numeradas. Tu trabajo es decir DÓNDE EMPIEZA cada bloque narrativo,
eligiendo del catálogo la estructura que mejor describa cómo está escrito ese
guion.

NO reescribes el guion. NO corriges nada. NO devuelves texto del guion. Solo
devuelves números de línea.

Reglas:
- Elige UNA estructura del catálogo: la que mejor calce con lo que el guion ya
  hace, no la que te gustaría que hiciera.
- Devuelve un corte por CADA etiqueta de esa estructura, todas, en el orden del
  catálogo.
- El primer corte va siempre en la línea 1.
- Los números tienen que ser estrictamente crecientes y existir en el guion.
- Un bloque puede ser de una sola línea (el CTA suele serlo).

Responde SOLO con JSON:
{"estructuraId":"<id>","cortes":[{"etiqueta":"<ETIQUETA>","linea":<n>}]}`;

function catalogoParaPrompt(estructuras: EstructuraGuion[]): string {
  return estructuras
    .filter((e) => e.activo)
    .map((e) => `- id: ${e.id}\n  etiquetas: ${e.etiquetas.join(' → ')}\n  cuándo: ${e.cuando}`)
    .join('\n');
}

/**
 * Le pone los rótulos a un guion. `null` si no se pudo — y no se pudo es un
 * resultado válido, no un error: el guion se guarda igual, sin rótulos.
 *
 * Nunca lanza. Cargar los guiones no puede depender de que un modelo conteste.
 */
export async function estructurarGuion(texto: string): Promise<GuionEstructurado | null> {
  const limpio = (texto || '').trim();
  if (!limpio) return null;

  const numeradas = numerarLineas(limpio);
  // Menos de tres líneas no tiene bloques que separar: ponerle tres rótulos sería
  // inventarle una estructura a un párrafo.
  if (numeradas.length < 3) return null;

  let estructuras: EstructuraGuion[];
  try { estructuras = await getEstructurasGuion(); } catch { return null; }
  if (!estructuras.some((e) => e.activo)) return null;

  const user = [
    'CATÁLOGO DE ESTRUCTURAS:',
    catalogoParaPrompt(estructuras),
    '',
    'GUION (una línea por número):',
    numeradas.map((x) => `${x.n}. ${x.l}`).join('\n'),
  ].join('\n');

  let crudo = '';
  try {
    crudo = await chatCheapCascade({
      system: SYSTEM,
      user,
      json: true,
      // La cascada CON Gemini adelante, y no la gratis por defecto.
      //
      // Medido el 28/08 sobre los cuatro guiones del dueño: la cascada gratis
      // ordenó 2 de 4. Groq falla su propio modo JSON en este prompt («Failed to
      // validate JSON»), Cerebras devuelve 402 y el modelo de OpenRouter dejó de
      // ser gratuito. Este pedido es corto pero de FORMATO estricto —una lista de
      // cortes que se valida entera o se descarta—, y ahí un modelo que no
      // respeta el esquema no degrada: falla.
      provs: CASCADA_DOCS,
      maxTokens: 600,
      temperature: 0,
      feature: 'guion-estructurar',
      motivo: 'ordenar un guion cargado por el cliente',
      validar: (t) => !!validarCortes(t, estructuras, numeradas.length),
    });
  } catch { return null; }

  const ok = validarCortes(crudo, estructuras, numeradas.length);
  if (!ok) return null;

  const conRotulos = insertarRotulos(limpio, ok.cortes);

  // ⚠️ LA RED. Si el resultado no dice EXACTAMENTE lo mismo que entró, se tira
  // todo: un rótulo de más no vale una palabra cambiada.
  if (huellaGuion(conRotulos) !== huellaGuion(limpio)) return null;

  return {
    texto: conRotulos,
    estructuraId: ok.estructura.id,
    estructuraNombre: ok.estructura.nombre,
  };
}
