// =============================================================================
// agente-consentimiento-texto — el TRATO, en un módulo puro
// =============================================================================
// ⚠️ VIVE SEPARADO DE `lib/agente-consentimiento.ts` POR UNA RAZÓN QUE EL TYPECHECK NO
// VE: ese módulo lleva `server-only` porque habla con la base, y la pantalla que le
// muestra el trato al cliente es un componente de CLIENTE. Con el texto adentro del
// módulo con la marca, la pantalla no lo podía importar — y el resultado fue peor que un
// error: la puerta se construyó (el endpoint devuelve 409 pidiendo consentimiento) y la
// pantalla que la abre NUNCA se escribió, así que el botón «Generar token» quedó roto
// para todo workspace que no hubiera aceptado, que eran todos.
//
// Es el mismo agujero que ya se pagó con `lib/vault.ts` y el README del ZIP, y la misma
// salida: lo que tienen que leer las dos orillas vive en un módulo sin la marca.
// =============================================================================

/** Subirla obliga a todos a volver a aceptar. Cambiala cuando cambie QUÉ se reporta,
 *  no cuando se corrija una coma. */
export const VERSION_CONSENTIMIENTO = '2026-08-1';

/** Lo que el cliente lee antes de aceptar. En español neutro y sin eufemismos: si hay
 *  que explicarlo con vueltas, es que no debería hacerse. */
export const TEXTO_CONSENTIMIENTO = {
  titulo: 'Qué le reporta tu agente a MaKo',
  que: [
    'Al terminar cada sesión de Claude Code, el plugin le manda a MaKo un resumen de en qué trabajaste: los temas, cuántos mensajes hubo y qué partes del producto tocaste.',
    'También le manda los mensajes que ESCRIBISTE tú, para poder darte recomendaciones concretas de cómo aprovechar mejor el agente. Esos mensajes se borran a los 90 días; el resumen se conserva.',
  ],
  no: [
    'No se manda lo que el agente leyó de tu disco, ni las salidas de las herramientas, ni el código de tus archivos.',
    'Antes de salir de tu computadora se tapan automáticamente las claves de API, los correos, los teléfonos y las rutas de tu disco.',
  ],
  paraQue: 'Sirve para dos cosas: saber qué funcionalidades hacen falta de verdad, y detectar cuándo se le está sacando poco jugo al agente para poder ayudarte.',
  tuParte: 'Lo que ninguna regla automática puede tapar es lo que escribas en prosa. No pegues contraseñas ni datos personales de tus clientes en el chat.',
  verlo: 'Puedes ver en cualquier momento, desde tu perfil, todo lo que tu agente reportó.',
  trato: 'La integración con Claude Code funciona con este reporte activo. Si no quieres que se reporte, no la actives.',
} as const;

