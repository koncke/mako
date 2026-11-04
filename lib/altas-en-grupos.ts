// =============================================================================
// altas-en-grupos — qué puede hacer MaKo con los grupos después del ban (3/11/2026)
// =============================================================================
// WhatsApp baneó la línea de MaKo el 3/11/2026 a las 16:39 ART: «Esta cuenta ya no puede usar WhatsApp Business» (spam). No creció el
// volumen de mensajes. Lo último fueron altas en grupos, 9 s antes del corte: un grupo nuevo, un alta que WhatsApp no dejó, una
// invitación por DM a alguien que nunca le había escrito a la línea, y otra alta en el grupo de otro cliente. WhatsApp no dice por qué
// banea: es lo más cercano en el tiempo, no una causa probada. Detalle en docs/hallazgos-comunicacion.md.
//
// LO QUE PIDE UNA PERSONA SIGUE ANDANDO (grupo nuevo, Notificaciones, el dueño). Martín lo pidió textual: «que mi otro WhatsApp pueda
// crear los grupos». Lo de abajo es lo que quedó distinto:
//
//   · FRENO DE EMERGENCIA, `mako.grupos.altas`: sólo `no` frena. Sin la fila, o sin poder leerla, ANDA: una lectura que falla no le corta a
//     Martín crear el grupo de su clienta en una reunión.
//   · LO AUTOMÁTICO, `mako.grupos.automatico`: sólo `si` lo prende, y sin poder leerlo queda apagado. Es lo que sale solo, sin que nadie
//     lo haya pedido para esa persona: el alta del equipo de la agencia en un grupo que nace, y la invitación por DM a un número que nunca
//     le escribió a la línea. En ese caso la pantalla da el link, y lo manda la persona.
//   · EL TOPE POR LÍNEA, en lib/mako-linea-tope.ts: el de cada negocio no veía 3 números en 3 minutos repartidos en 2 negocios.
//
// Los dos settings van en el workspace de la plataforma: un cliente no puede tocarlos para la línea de todos.
//
// Sin `server-only`: el test la ejecuta.

export const KEY_ALTAS_EN_GRUPOS = 'mako.grupos.altas';
export const KEY_GRUPOS_AUTOMATICO = 'mako.grupos.automatico';

/** Lo que ve quien lo intentó con el freno puesto. */
export const ALTAS_FRENADAS = 'Por ahora MaKo no crea grupos de WhatsApp ni suma gente a ellos.';
/** El comando para los grupos que ya existen, con lo automático apagado. */
export const AUTOMATICO_APAGADO = 'El alta automática del equipo de la agencia está apagada.';
/** Lo que queda en la pantalla: el alta no se pudo y MaKo no le escribe a alguien que nunca le escribió. */
export const SIN_INVITACION = 'Pásale tú el link del grupo: MaKo no le escribe a un número que nunca le escribió.';

export const altasFrenadas = (valor: string | null | undefined): boolean => valor === 'no';
export const automaticoPrendido = (valor: string | null | undefined): boolean => valor === 'si';
