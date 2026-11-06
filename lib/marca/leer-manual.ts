// =============================================================================
// marca/leer-manual — MaKo lee el manual de marca que subió el negocio (un PDF o la imagen de su brand board)
// =============================================================================
// Devuelve un BORRADOR (lib/marca/kits.ts → `BorradorMarca`): la persona lo mira, lo corrige y recién ahí se guarda. Nada se
// escribe acá.
//   · Un PDF con texto se lee sin IA (`archivoATexto`, la capa de texto) y la IA sólo saca la marca de ese texto: una llamada
//     chica. Un PDF escaneado o una imagen van por la visión, con el pedido de la marca (no con «transcribe todo»).
//   · Corre con la IA DEL NEGOCIO (la feature `marca-leer`, lib/model-catalogo.ts): su Claude, su GPT. Quien llama lo pone
//     adentro de «sólo su IA» (`conSuIADelNegocio`).
//   · Los colores escritos en el manual (#AABBCC) se suman aunque la IA no los devuelva: un código impreso es un dato.
//   · Si la IA no contesta pero el texto trae colores, vuelve el borrador con esos colores: algo para confirmar, no un error.
// =============================================================================

import 'server-only';
import { chatClaude } from '../anthropic';
import { errorDeCascada, leerDocumentoIA } from '../ai-cheap';
import { archivoATexto } from '../archivo-a-texto';
import { parseJsonObject } from '../json-del-modelo';
import { contenidoNoConfiable } from '../prompt-render-pure';
import type { AdjuntoListo } from '../mako-adjuntos';
import { PROMPT_LEER_MARCA, TOPES_MARCA, borradorDeLectura, borradorTieneAlgo, hexesDelTexto, type BorradorMarca } from './kits';

export const FEATURE_LEER_MARCA = 'marca-leer';
const PLAZO_MS = 90_000;

export type LecturaManual = { ok: true; borrador: BorradorMarca } | { ok: false; error: string };

const parsear = (t: string): Record<string, unknown> | null => { try { return parseJsonObject(t) as Record<string, unknown>; } catch { return null; } };

const SIN_NADA = 'No encontré colores, fuentes ni logo en ese archivo. Prueba con el PDF de tu manual de marca o una imagen de tu paleta.';

export async function leerManualDeMarca(a: AdjuntoListo): Promise<LecturaManual> {
  const t0 = Date.now();
  const base64 = Buffer.from(a.bytes).toString('base64');
  let leido = '';
  let raw: Record<string, unknown> | null = null;
  const errores: string[] = [];
  try {
    if (a.tipo === 'document') {
      const l = await archivoATexto(new File([a.bytes as BlobPart], 'manual.pdf', { type: 'application/pdf' }), {
        feature: FEATURE_LEER_MARCA, motivo: `Leer el manual de marca «${a.nombre}»`, timeoutMs: PLAZO_MS, topePaginas: 20, sinGemini: true,
      });
      leido = l.texto.slice(0, TOPES_MARCA.lectura);
      // Con texto (la capa del PDF, o lo que transcribió la visión de un escaneo), la IA saca la marca de ese texto.
      if (leido.trim()) {
        const salida = await chatClaude(PROMPT_LEER_MARCA, [{ role: 'user', content: `EL MANUAL (texto del PDF):\n${contenidoNoConfiable(leido, 'manual')}` }], {
          feature: FEATURE_LEER_MARCA, motivo: 'Sacar la marca del manual', maxTokens: 800, hastaMs: t0 + PLAZO_MS, erroresOut: errores,
        });
        raw = parsear(salida);
      }
    } else {
      // Una imagen: la visión, con el pedido de la marca (la caja del logo sólo la puede dar quien ve la imagen).
      // ⚠️ `sinGemini` (6/11/2026): `model-catalogo.ts` declara esta feature con `deSuIA: true` y la nota «nunca con
      //    Gemini», y el camino de TEXTO de acá arriba ya lo cumplía (`chatClaude` pasa `sinGemini` desde el catálogo).
      //    El de VISIÓN no lo miraba: leer la IMAGEN de un manual seguía usando el Gemini del negocio si era lo único
      //    que tenía, y era la última excepción de Image. Si no le queda ninguna IA que mire, se le dice (`SIN_NADA` o
      //    `errorDeCascada`), que es lo que `fallback: []` del catálogo ya decidió.
      const r = await leerDocumentoIA({
        dataUrl: `data:${a.mime};base64,${base64}`, isPdf: false, nombreArchivo: a.nombre, prompt: PROMPT_LEER_MARCA, json: true,
        feature: FEATURE_LEER_MARCA, motivo: `Leer el brand board «${a.nombre}»`, timeoutMs: PLAZO_MS, sinGemini: true,
      });
      leido = r.text;
      raw = parsear(r.text);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[marca] leer «${a.nombre}»: ${msg}`);
    errores.push(msg);
  }
  const borrador = borradorDeLectura(raw, leido);
  if (borradorTieneAlgo(borrador)) return { ok: true, borrador };
  // Sin nada: si la IA falló (y no hay un solo color escrito), se dice por qué; si contestó vacío, que el archivo no lo trae.
  if (!raw && !hexesDelTexto(leido).length && errores.length) return { ok: false, error: await errorDeCascada(errores, 'leer tu manual de marca') };
  return { ok: false, error: SIN_NADA };
}
