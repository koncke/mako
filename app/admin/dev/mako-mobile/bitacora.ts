// =============================================================================
// MaKo Mobile — el registro de construcción de la app del teléfono (/m/*)
// =============================================================================
// ESTO NO ES UN CHANGELOG. El changelog está en `git log`. Acá va lo que git no guarda: qué
// pidió Martín con sus palabras y por qué se resolvió así. Las decisiones y la spec viven en
// docs/diseno-mako-mobile.md; lo aprendido, en docs/hallazgos-mobile.md.
//
// Las horas de los prompts son las del chat (hora de Argentina); las de la implementación, las
// del commit. Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'MaKo Mobile';

/** Las fases del área y en qué anda cada una. */
export const PARTES: Parte[] = [
  { titulo: 'El shell y la PWA', detalle: 'Árbol /m con su header y su barra por rol, manifest que abre la app y no la landing, service worker sin caché', estado: 'sigue' },
  { titulo: 'Today, Inbox, MaKo, CRM y Plan', detalle: 'Las cinco pantallas re-adaptadas: el Pulso, aprobar, el chat con voz y fotos, la ficha con agendar, las tareas de hoy', estado: 'sigue' },
  { titulo: 'Web Push', detalle: 'Los avisos que ya salen por WhatsApp también al teléfono, por persona; y «MaKo te pide confirmar»', estado: 'sigue' },
  { titulo: 'Medir en un iPhone y un Android de verdad', detalle: 'Voz, push, instalar, teclado y gestos no se pueden probar en un navegador sin pantalla', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '11 oct', hora: '04:29', chat: CH, cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Implementar MaKo Mobile completo',
    pedido: 'Implementa completamente MaKo Mobile... Apalancate de diseños de otras apps e incluso de skills de skill.sh',
    puntos: [
      'Lo define la tarjeta «MaKo App Mobile» del seed del plan: no todas las pestañas van al teléfono, y las que van se re-adaptan 100%. Terminado cuando el dueño o el closer abre el celular, ve su Hoy, le responde a MaKo por voz y aprueba una acción.',
      'Se sumó el caso de la #521: agendar DURANTE una llamada desde el teléfono, que es lo que un cliente intentó en vivo y no pudo.',
    ],
  },
  {
    fecha: '11 oct', hora: '04:45', chat: CH, cuenta: 'claude3', actor: 'claude', tipo: 'investigacion',
    titulo: 'El relevo: qué existe, qué falta y de dónde se toma el diseño',
    puntos: [
      'La decisión abierta de la tarjeta, PWA o nativa, se cerró por PWA: cubre push (iOS 16.4+ instalada), cámara y voz, y es la única que se puede entregar completa desde una sola base.',
      'El manifest abría la LANDING de venta (start_url «/») a la persona logueada que agregó MaKo a su pantalla de inicio.',
      'La campanita no existía: la tabla de avisos nunca se aplicó en producción y el código se tragaba el error.',
      'El chat de MaKo de la app sólo lee, por una decisión escrita: hasta que exista el «turno compartido». Responder por voz y aprobar desde el chat exige construirlo.',
      'De skills.sh se instalaron mobile-native (el piso de plataforma: safe areas, 100dvh, inputs de 16 px), web-haptics (en iOS navigator.vibrate no existe) y thumb-first (push en iOS e instalar). De impeccable se leyeron crudos los vetos de craft-floor y adapt («adaptar es repensar, no escalar»).',
      'Apps de referencia: Linear (el móvil como complemento, el Inbox al centro), Superhuman y Avec (una acción por lado del swipe, con deshacer), Close (barra de cinco destinos), ChatGPT y WhatsApp (el micrófono: mantener para grabar, deslizar para cancelar), Things (Today como una sola lista) y Calendly (agendar: día, horarios libres, botón que nombra el horario).',
    ],
    archivos: ['docs/diseno-mako-mobile.md', 'lib/movil-rutas.ts'],
  },
];
