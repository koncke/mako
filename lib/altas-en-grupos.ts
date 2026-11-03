// =============================================================================
// altas-en-grupos — MaKo no crea grupos ni suma gente hasta que Martín decida (3/11/2026)
// =============================================================================
// WhatsApp baneó la línea de MaKo el 3/11/2026 a las 16:39 ART: «Esta cuenta ya no puede usar WhatsApp Business» (spam). No creció el
// volumen de mensajes. Lo último fueron altas en grupos, 9 s antes del corte: un grupo nuevo, un alta que WhatsApp no dejó, una
// invitación por DM a alguien que nunca le había escrito a la línea, y otra alta en el grupo de otro cliente. WhatsApp no dice por qué
// banea: es lo más cercano en el tiempo, no una causa probada. Detalle en docs/hallazgos-comunicacion.md.
//
// ⚠️ APAGADO POR DEFECTO, Y POR ESO LA PUERTA ESTÁ ABAJO, EN lib/mako-grupo.ts Y lib/mako-chat.ts. Lo de ese día NO salió del automático de
// la agencia (`sumarEquipoDeAgenciaAlGrupo`): salió de una persona guardando Notificaciones (`setDestinatarios`). Para WhatsApp son lo mismo:
// una API agregando gente. Apagar sólo el automático no habría cambiado nada.
//
// Se prende escribiendo `si` en este setting, en el workspace de la plataforma. Sin fila, con otro valor o sin poder leerlo: apagado.
//
// Sin `server-only`: el test la ejecuta.

export const KEY_ALTAS_EN_GRUPOS = 'mako.grupos.altas';

/** Lo que ve quien lo intentó. */
export const ALTAS_APAGADAS = 'Por ahora MaKo no crea grupos de WhatsApp ni suma gente a ellos.';

export const altasPrendidas = (valor: string | null | undefined): boolean => valor === 'si';
