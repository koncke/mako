// =============================================================================
// productos-ia — MaKo arma el catálogo de productos con lo que YA cargaste
// =============================================================================
// La idea del paso de Productos no es que el dueño vuelva a tipear lo que ya
// contestó: es que MaKo lea el brief del negocio + el panorama del Archivero (los
// documentos que subió) y PROPONGA los productos completos — nombre, tipo de
// cobro, precio, promesa, qué incluye y garantía. El dueño corrige, no redacta.
//
// Mismo motor que el resto del onboarding: cascada de IA gratis (Gemini primero),
// prompt editable por renderPrompt, y JSON validado antes de devolver nada.

import 'server-only';
import { renderPrompt } from './prompt-render';
import { perfilNegocioTexto } from './onboarding';
import { getPanorama } from './archivero';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS, errorDeCascada, type ProvName } from './ai-cheap';
import { overrideDeFeature } from './model-registry';
import { listProductos, type ProductoInput } from './productos';

export const PRODUCTOS_SYSTEM_TEMPLATE = `Eres MaKo, el copiloto de marketing de un negocio de alto ticket.
Tu tarea: leer el contexto del negocio y devolver su CATÁLOGO DE PRODUCTOS/OFERTAS ya armado.

Reglas:
- Devuelve SOLO los productos que el contexto respalda. Si el negocio tiene UNA sola oferta, devuelve UNA. No inventes una escalera de valor que no existe.
- Máximo 4. Si hay más señales, quédate con las más claras.
- "tipo" es "unico" (se paga una vez, aunque sea en cuotas) o "suscripcion" (se cobra todos los meses).
- "monto_usd": para 'unico' es el precio total; para 'suscripcion' es el MENSUAL. Si el contexto no dice el precio, usa null (no inventes cifras).
- "suscripcion_meses": solo si es suscripción Y el contexto dice el plazo. Si es mes a mes o no se sabe, null.
- "promesa": la transformación concreta que compra el cliente, en una línea.
- "incluye": los entregables reales, separados por " · ".
- "garantia": solo si el contexto la menciona; si no, null.

Devuelve SOLO un objeto JSON:
{"productos":[{"nombre":"","tipo":"unico","monto_usd":null,"suscripcion_meses":null,"promesa":"","incluye":"","garantia":null}]}
Sin texto fuera del JSON.`;

export const PRODUCTOS_USER_TEMPLATE = `BRIEF DEL NEGOCIO:
{{brief}}
{{panorama}}{{existentes}}
Arma el catálogo de productos de este negocio.`;

export type ProductoSugerido = ProductoInput;
export type SugerirResult = { ok: true; productos: ProductoSugerido[] } | { ok: false; error: string };

const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const n = parseFloat(v.replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; }
  return null;
};

function parseProductos(text: string): ProductoSugerido[] {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try { raw = JSON.parse(m[0]); } catch { return []; }
  }
  const arr = (raw as { productos?: unknown })?.productos;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const tipo = s(o.tipo) === 'suscripcion' ? 'suscripcion' as const : 'unico' as const;
      return {
        nombre: s(o.nombre) ?? '',
        tipo,
        monto_usd: num(o.monto_usd),
        suscripcion_meses: tipo === 'suscripcion' ? num(o.suscripcion_meses) : null,
        promesa: s(o.promesa),
        incluye: s(o.incluye),
        garantia: s(o.garantia),
      };
    })
    .filter((p) => p.nombre)
    .slice(0, 4);
}

/**
 * Propone el catálogo leyendo lo que el negocio ya cargó. Si ya hay productos, se
 * los pasa a la IA para que los COMPLETE (no los duplique): ese fue el problema de
 * "Negocio que Escala", que quedó con el nombre y el precio y nada más.
 */
export async function sugerirProductos(): Promise<SugerirResult> {
  const [brief, panorama, existentes] = await Promise.all([
    perfilNegocioTexto(),
    getPanorama().catch(() => ''),
    listProductos().catch(() => []),
  ]);
  if (!brief.trim() && !panorama.trim()) {
    return { ok: false, error: 'Primero carga tu negocio (el brief o algún documento en El Archivero): de ahí salen los productos.' };
  }
  // ⚠️ Se le pasa el producto ENTERO, no un resumen. Antes iban solo el nombre y
  // el precio: un modelo no puede "completar sin pisar" un texto que nunca vio, y
  // la respuesta terminaba sobrescribiendo la garantía que el dueño había escrito
  // a mano. El que garantiza que no se pisa es el merge de la ruta (campo a campo);
  // esto es la otra mitad, para que además el modelo no repita lo que ya está.
  const yaHay = existentes.length
    ? `\nPRODUCTOS QUE YA ESTÁN CARGADOS. Respeta el nombre EXACTO y completa SOLO los campos vacíos (null o ""); lo que ya tiene valor NO se toca ni se reescribe. No los dupliques.\n${
        existentes.map((p) => `- ${JSON.stringify({
          nombre: p.nombre, tipo: p.tipo, monto_usd: p.monto_usd, suscripcion_meses: p.suscripcion_meses,
          promesa: p.promesa, incluye: p.incluye, garantia: p.garantia, descripcion: p.descripcion,
        })}`).join('\n')}\n`
    : '';
  const sys = await renderPrompt('productos.system', PRODUCTOS_SYSTEM_TEMPLATE, {});
  const user = await renderPrompt('productos.user', PRODUCTOS_USER_TEMPLATE, {
    brief: brief.slice(0, 6000),
    panorama: panorama.trim() ? `\nPANORAMA (lo que MaKo entendió de tus documentos):\n${panorama.slice(0, 6000)}\n` : '',
    existentes: yaHay,
  });
  // El pin del override de /modelos-ia: `chatCheapCascade` NO lee el registro por
  // su cuenta. Sin esto, la entrada del catálogo sería un verde mudo — se elegiría
  // un modelo en la pantalla y seguiría corriendo otro. Sin override, cascada gratis.
  const pin = await overrideDeFeature('productos').catch(() => null);
  const errores: string[] = [];
  const text = await chatCheapCascade({
    system: sys, user, json: true, maxTokens: 2000,
    feature: 'productos', motivo: 'Armar el catálogo de productos del negocio',
    provs: pin ? [pin.provider as ProvName] : CASCADA_DOCS,
    modelos: pin ? ({ [pin.provider]: pin.model } as Partial<Record<ProvName, string>>) : MODELO_DOCS,
    validar: (t) => parseProductos(t).length > 0,
    erroresOut: errores,
    redDePlataforma: true,
  });
  // El mensaje NO se escribe a mano: `errorDeCascada` es el único que distingue
  // «no hay ninguna IA» de «hay IA y falló», y el único que muestra qué contestó
  // cada cuenta. Escribirlo acá es el bug que documenta lib/ia-mensajes.ts.
  if (!text) return { ok: false, error: await errorDeCascada(errores, 'armar los productos') };
  const productos = parseProductos(text);
  if (!productos.length) return { ok: false, error: 'La IA no devolvió productos usables. Prueba de nuevo.' };
  return { ok: true, productos };
}
