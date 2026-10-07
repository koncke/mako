// =============================================================================
// Webhook Gateway — el registro de construcción del área
// =============================================================================
// Alcance: las puertas por las que entran eventos sin sesión (Calendly, Cal.com, Chatwoot,
// Fathom, Meta, Evolution, Resend) y la decisión que cada una toma primero: DE QUIÉN es el
// evento (`webhook_routing`). Lo largo, en docs/hallazgos-infra.md → «Webhooks».
//
// NO es un changelog: va el motivo, la trampa y el pedido textual.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'De quién es el evento: un índice', detalle: '`webhook_routing` (mig 0090) · primer reclamante gana · fail-closed: sin mapeo no se toca un dato', estado: 'hecha' },
  { titulo: 'La firma con la key DEL workspace', detalle: 'Parsear → rutear → verificar con el secreto de ese negocio · sin ruteo se verifica igual, para no delatar la cartera', estado: 'hecha' },
  { titulo: 'Ruteo estricto en los cinco webhooks', detalle: '«No pude leer» no es «no es de nadie» · el fallo pasa por el clasificador y queda anotado en `webhooks.fallos_ruteo`', estado: 'hecha' },
  { titulo: 'Las rutas de /api/track y los tokens', detalle: 'optin, vsl, replay, el token del agente y el de la landing siguen con la lectura tolerante', estado: 'cola' },
  { titulo: 'Ver los fallos anotados en una pantalla', detalle: '`webhooks.fallos_ruteo` y `calendly.fallos_proceso` hoy sólo se leen con una consulta', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '7 oct', hora: '—', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Ruteo estricto en los otros cuatro webhooks',
    pedido: 'Haz esta tarea aquí: “Ruteo estricto en los otros cuatro webhooks”',
    puntos: [
      'Era lo que quedó SIN HACER al arreglar Calendly el 06/10: Cal.com, Chatwoot, Fathom y Meta seguían leyendo de quién es el evento con la lectura que traga el error.',
    ],
  },
  {
    fecha: '7 oct', hora: '18:38', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los cuatro webhooks leen el ruteo estricto, y qué contestar se midió por proveedor',
    puntos: [
      '**Primero se midió qué hace cada proveedor con un 5xx**, que el hallazgo de Calendly dejó abierto: Fathom (Svix) reintenta y deshabilita a los 5 días, Meta reintenta ~36 h, y **Cal.com y Chatwoot no reintentan nunca** (leído en su código). Para esos dos, el código de respuesta no recupera nada: lo que cambia es que el evento perdido queda ANOTADO en vez de leerse «no es de nadie».',
      '⚠️ **El peor de los cuatro era Cal.com, y no por perder: por inventar.** Con la base caída, J1 y J2 daban null, una R2 se clasificaba como R1 y CREABA un lead — lo que «una R2 nunca crea un lead» prohíbe.',
      '**Las keys que deciden la firma** (Cal.com, Fathom) también estrictas: con la base caída daban 401 «firma rechazada» sobre un secreto que estaba bien.',
      '**Meta, con varios leads por pedido:** si el ruteo de alguno falló de forma transitoria, el lote va 503. Es seguro porque reprocesar no duplica; lo que falla después del ruteo sigue 200 a propósito, porque ahí ya corrieron efectos.',
    ],
    commits: [
      { sha: '3d11b05c', msg: 'Webhooks: Cal.com, Chatwoot, Fathom y Meta leen DE QUIÉN es el evento con la lectura estricta', lineas: 385, archivos: 8 },
    ],
    archivos: [
      'lib/webhook-fallo-ruteo.ts — 503 sólo si reintentar lo arregla, y la anotación en el super admin',
      'lib/webhook-ruteo-huella.ts — la huella, pura y testeada',
      'tests/webhooks-ruteo-estricto.test.ts — 9 tests y un barrido de toda la carpeta de webhooks',
    ],
  },
];
