// =============================================================================
// tope-texto-agencia — lo que el SERVER le contesta de un tope o un candado de Pro al cliente de una agencia (F148, 18/11/2026)
// =============================================================================
// El cliente de una agencia no compra su plan: lo paga y lo cambia su agencia (#494). En pantalla, el cartel ya lo resuelve
// (`TextoDelTope`, app/_components/CtaPasarAPro.tsx); esto es lo que llega por el server, donde no hay cartel: la API de MaKo
// (el chat, WhatsApp, un token). Las reglas del texto son puras y viven en lib/topes-plan.ts (`sinPasarAPro`) y
// lib/plan-esencial-reglas.ts (`TEXTO_PEDIR_PRO_A_LA_AGENCIA`); acá sólo se pregunta de quién es el negocio.
//
// ⚠️ Con «no sé» (no se pudo leer la cartera) va como al cliente de una agencia: es un upsell, y ofrecérselo de más le rompe
// el trato a la agencia (AGENTS.md, «el `null` se resuelve en cada uso»). Aparte de lib/topes-plan-server.ts a propósito: ése
// importa los cobros, y la puerta de la API no tiene por qué cargarlos.
// =============================================================================

import 'server-only';
import { esClienteDeAgencia } from './agencia';
import { TEXTO_PEDIR_PRO_A_LA_AGENCIA, textoTopeParaClienteDeAgencia } from './plan-esencial-reglas';
import { sinPasarAPro, textoTope } from './topes-plan';

/** El texto del tope de un alta (la API de MaKo: `crear_crm`). Al cliente de una agencia, sin los planes y a quién pedírselo. */
export async function textoTopeDelNegocio(ws: number, tope: number): Promise<string> {
  const deAgencia = await esClienteDeAgencia(ws).catch(() => null);
  return deAgencia !== false ? textoTopeParaClienteDeAgencia(tope) : `${textoTope(tope)} Planes: /planes.`;
}

/**
 * La puerta de TODA la API de MaKo (lib/api-mako/ejecutar.ts): un error que diría «Pasa a … Pro», al cliente de una agencia,
 * va sin esa frase y con a quién pedírselo. Un texto sin la frase vuelve tal cual, sin leer nada.
 */
export async function errorDelPlanParaElNegocio(ws: number, texto: string): Promise<string> {
  const sin = sinPasarAPro(texto);
  if (sin === texto) return texto;
  const esDeAgencia = await esClienteDeAgencia(ws).catch(() => null);
  return esDeAgencia !== false ? `${sin} ${TEXTO_PEDIR_PRO_A_LA_AGENCIA}` : texto;
}
