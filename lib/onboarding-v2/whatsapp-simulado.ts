// =============================================================================
// EL WHATSAPP SIMULADO DE LA REVISIÓN: el paso del WhatsApp como para un cliente NUEVO (21/11/2026; puro)
// =============================================================================
// Martín, probando en el ws 3: «Yo quiero ver exactamente igual lo que recibe el usuario». El número del negocio de prueba ya está
// verificado, y el paso decía «ya está confirmado». En la revisión (la puerta: alguien de MaKo en el 3 o el 9) corre el camino de un
// número nuevo; en vez de mandar algo a WhatsApp, un modal muestra ese lado con los textos de VERDAD (lib/verificacion-entrante.ts): el
// pedido que manda la persona y lo que MaKo le contesta (`mandarCodigoV2`: el código, su tarjeta y «Guárdame…»). La verificación de
// verdad del negocio no se toca: el código vive en el estado del onboarding (`simulacion`). Lo usan la ruta del arranque y su vista.
// =============================================================================
import { randomInt } from 'node:crypto';
import { AGENDAR_V2, E_CODIGO_LARGO_V2, E_CODIGO_V2, E_ESCRIBE_CODIGO_V2, TEXTO_CONFIRMAR_V2, mensajeDelCodigoV2, type VistaEntrante } from '@/lib/verificacion-entrante';

const LARGO = 6;

/** Un código de 6 números, como los de verdad. */
export const codigoSimulado = (): string => String(randomInt(0, 10 ** LARGO)).padStart(LARGO, '0');

/** El código pegado contra el simulado, con los MISMOS avisos que el de verdad (`decidirCodigoV2`). */
export function decidirCodigoSimulado(escrito: string, s: { codigo: string }): { ok: true } | { ok: false; error: string } {
  const d = escrito.replace(/\D/g, '');
  if (!d.length) return { ok: false, error: E_ESCRIBE_CODIGO_V2 };
  if (d.length < LARGO) return { ok: false, error: E_CODIGO_LARGO_V2 };
  return d === s.codigo ? { ok: true } : { ok: false, error: E_CODIGO_V2 };
}

/** La tarjeta del código con el modal: «Abrir WhatsApp» lo abre (no va a wa.me) y el modal dice lo que diría WhatsApp. */
export function vistaDelWhatsappSimulado(e: { nombre?: string; telefonoNumero?: string; simulacion?: { codigo: string } }): VistaEntrante {
  const nombre = (e.nombre ?? '').trim().split(/\s+/)[0] ?? '';
  const codigo = e.simulacion?.codigo ?? '';
  return {
    estado: 'esperando', link: '#whatsapp-simulado', numeroLinea: null, telefono: (e.telefonoNumero ?? '').replace(/\D/g, ''), otroNumero: null, aviso: null,
    simulado: { pedido: TEXTO_CONFIRMAR_V2, respuesta: mensajeDelCodigoV2(nombre, codigo), agendar: AGENDAR_V2, codigo },
  };
}
