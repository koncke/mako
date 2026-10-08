// =============================================================================
// Qué proveedor de IA puede recibir datos que salieron de la API de Google.
//
// DECISIÓN de Martín, 07/10/2026, al arrancar la verificación de la app de Google:
// si un pedido a un modelo lleva datos de Google Calendar (eventos, horarios,
// invitados), lo atiende SÓLO un proveedor que por contrato no entrena con lo que
// recibe. Nunca una key gratis de Gemini: Google usa lo que entra al plan gratis para
// mejorar sus productos, con revisión humana (el tutorial de la credencial ya lo
// decía, `lib/metodo-catalogo.ts`), y una key paga no se distingue de una gratis.
//
// Es el requisito de Uso Limitado de la Política de Datos de Usuario de las APIs de
// Google, y la promesa que hace /privacidad. Sin esto la promesa era falsa para todo
// cliente con sólo la key gratis de Gemini (el ws13, por ejemplo), y la verificación
// de la app no se podía pedir sin afirmar algo falso. Detalle en docs/hallazgos-ia.md.
//
// SIN `server-only`, a propósito: lo importan el loop de herramientas
// (`lib/ai-cheap.ts`, el doer de WhatsApp) y el test que lo fija.
// =============================================================================

import { REGISTRO } from '@/lib/api-mako/registro';

/**
 * Los proveedores que NO entrenan con lo que les mandamos por API, con la fuente:
 * - groq: el Services Agreement y el DPA le prohíben usar entradas o salidas para
 *   entrenar; sólo guarda registros hasta 30 días para abuso.
 * - openai: no entrena con datos de la API salvo que el cliente lo pida (desde 2023).
 * - anthropic: sus términos comerciales no entrenan con datos de la API.
 *
 * Afuera, y por qué: gemini (el plan gratis entrena y no sabemos si la key es paga),
 * mistral (el plan gratis puede usar los datos), cerebras y openrouter (no verificado;
 * openrouter además reparte entre terceros). Sumar uno es leer SUS términos antes:
 * «no dice nada» no es «no entrena».
 */
export const NO_ENTRENAN = ['groq', 'openai', 'anthropic'] as const;

export function puedeRecibirDatosDeGoogle(proveedor: string): boolean {
  return (NO_ENTRENAN as readonly string[]).includes(proveedor);
}

/** Los nombres de herramienta (id + alias del registro) que devuelven datos de Google.
 *  Se derivan del registro: la marca vive en la definición (`datosDeGoogle`), no acá. */
export const HERRAMIENTAS_CON_DATOS_DE_GOOGLE: ReadonlySet<string> = new Set(
  REGISTRO.filter((d) => d.datosDeGoogle).flatMap((d) => [d.id, ...(d.alias ?? [])]),
);

/** Cuáles de estas herramientas devuelven datos de Google. Por NOMBRE, así cubre
 *  también la versión vieja de una operación (MAKO_TOOLS) que se llama igual. */
export function herramientasConDatosDeGoogle(tools: readonly { name: string }[]): string[] {
  return tools.filter((t) => HERRAMIENTAS_CON_DATOS_DE_GOOGLE.has(t.name)).map((t) => t.name);
}

/**
 * Lo que tira el loop de herramientas si le piden correr un turno con datos de Google
 * en un proveedor que entrena. Es la red de abajo: quien elige el proveedor ya tendría
 * que haberlo filtrado, y si no lo hizo, el pedido no sale.
 */
export class ProveedorQueEntrenaError extends Error {
  constructor(readonly proveedor: string, readonly herramientas: string[]) {
    super(`${proveedor} no recibe datos de Google Calendar (entrena con lo que recibe): ${herramientas.join(', ')}`);
    this.name = 'ProveedorQueEntrenaError';
  }
}
