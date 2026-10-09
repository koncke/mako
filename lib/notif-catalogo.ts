// =============================================================================
// notif-catalogo — el mapa ÚNICO de lo que el usuario puede activar o desactivar
// en Configuraciones › Notificaciones
// =============================================================================
// Tres canales, en el orden en que se muestran:
//
//   1. DENTRO DE LA APP  → pop-up y sonido, por separado (esto corre en el
//      navegador, así que la preferencia es de la PERSONA, no del negocio).
//   2. WHATSAPP          → lo que MaKo manda al grupo del negocio.
//   3. EMAIL             → los reportes que salen por Resend.
//
// Es DATA PURA (sin `server-only`): la usan la UI de configuración, el provider
// de notificaciones del navegador y el despachador del server. Un solo lugar,
// porque si la lista se duplica el segundo se queda viejo (ver AGENTS.md).
//
// ── Cómo mantener AVISOS_WA_EN_VIVO ──────────────────────────────────────────
// El catálogo de voz (lib/avisos-catalogo.ts) tiene 53 entradas, pero la mayoría
// todavía no las dispara nadie: su campo `yaImplementado` quedó viejo y hoy
// miente en las dos direcciones. Lo único confiable es quién llama de verdad a
// emitirAviso/emitirDelCatalogo, y eso es lo que lista este array. Ofrecerle al
// usuario un interruptor para algo que nunca se enciende es peor que no
// ofrecerlo: apaga algo que ya estaba apagado y cree que hizo algo.
//
// Al cablear un aviso nuevo, sumá su id acá para que aparezca en la pantalla. Si
// te olvidás, el aviso igual sale (el default es "activo"): lo que se pierde es
// la posibilidad de apagarlo, no el aviso.

// ── 1. Dentro de la app (pop-up + sonido) ────────────────────────────────────
export type NotifInAppDef = {
  id: string;
  titulo: string;
  sub: string;
  /** false = esta notificación nunca suena, solo se muestra. */
  sonido: boolean;
};

export const NOTIF_IN_APP: NotifInAppDef[] = [
  {
    // UNA sola entrada para los DOS canales. Eran dos —el número oficial y el
    // vinculado por QR— y desde la pantalla es la misma cosa: entró un mensaje de
    // WhatsApp. Quien recibe el pop-up no está eligiendo por qué cañería llegó, y
    // partirlo obligaba a apagar dos cosas para dejar de ver una.
    //
    // El id 'wa-mensaje' se conserva: es la clave de las preferencias que ya están
    // guardadas. Cambiarlo daría de baja el ajuste de quien lo hubiera tocado.
    id: 'wa-mensaje',
    titulo: 'Nuevo mensaje de WhatsApp',
    sub: 'Cuando alguien te escribe, por el número oficial o por el vinculado con QR. Al hacer clic se abre el chat.',
    // Dejó de sonar el 27/09/2026: el beep salía con CADA mensaje entrante mientras
    // la persona miraba otra pantalla. El interruptor pasa a false por la regla de
    // arriba — ofrecer «silenciar» algo que ya no suena es un control que no hace nada.
    sonido: false,
  },
  {
    id: 'wa-plantilla',
    titulo: 'Plantilla de WhatsApp resuelta',
    sub: 'Cuando Meta aprueba o rechaza una plantilla enviada a revisión.',
    sonido: true,
  },
  // ⚠️ ACÁ ESTABA 'ia-uso' («MaKo usó inteligencia artificial»), y se fue con su
  // pop-up el 27/09/2026. Se saca del catálogo por la regla de arriba: un
  // interruptor para algo que ya no se enciende apaga algo que estaba apagado y
  // hace creer que hizo algo. El gasto se mira en /integraciones#saldo-ia.
];

/** Preferencia de una notificación in-app. Ausente = las dos activas. */
export type NotifInAppItem = { popup: boolean; sonido: boolean };
/** `popup`/`sonido` de acá son los interruptores maestros de toda la app. */
export type NotifInApp = { popup: boolean; sonido: boolean; items: Record<string, NotifInAppItem> };

export const DEFAULT_IN_APP: NotifInApp = { popup: true, sonido: true, items: {} };

/**
 * ¿Se muestra (o suena) esta notificación? Manda el interruptor maestro; abajo,
 * cada notificación puede apagarse por su cuenta. `null` (todavía cargando) se
 * resuelve como activo: es preferible un pop-up de más que perderse un mensaje.
 */
export function inAppActivo(prefs: NotifInApp | null | undefined, id: string, canal: 'popup' | 'sonido'): boolean {
  if (!prefs) return true;
  if (!prefs[canal]) return false;
  return prefs.items?.[id]?.[canal] !== false;
}

/** Normaliza lo que venga de la base (jsonb libre) a la forma esperada. */
export function normalizarInApp(raw: unknown): NotifInApp {
  const o = (raw ?? {}) as Partial<NotifInApp>;
  const items: Record<string, NotifInAppItem> = {};
  const src = (o.items ?? {}) as Record<string, Partial<NotifInAppItem>>;
  for (const def of NOTIF_IN_APP) {
    const it = src[def.id];
    items[def.id] = {
      popup: typeof it?.popup === 'boolean' ? it.popup : true,
      sonido: def.sonido ? (typeof it?.sonido === 'boolean' ? it.sonido : true) : false,
    };
  }
  return {
    popup: typeof o.popup === 'boolean' ? o.popup : true,
    sonido: typeof o.sonido === 'boolean' ? o.sonido : true,
    items,
  };
}

// ── Destinatarios: a QUIÉNES les llega (del negocio, no de la persona) ───────
// El tipo y la normalización viven acá —y no en lib/notif-destinatarios, que es
// `server-only`— para que el formulario del navegador valide con la MISMA regla
// con la que el server guarda. Si se duplicara, la pantalla aceptaría cosas que
// el server después descarta en silencio.
export type Destinatarios = { telefonos: string[]; emails: string[] };

export const soloDigitos = (s: string) => (s || '').replace(/\D/g, '');
export const telefonoValido = (s: string) => soloDigitos(s).length >= 8;
export const emailValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || '').trim());

/** Normaliza y deduplica conservando el orden: el primero es el principal. */
export function normalizarDestinatarios(d: Partial<Destinatarios>): Destinatarios {
  const telefonos: string[] = [];
  for (const t of d.telefonos ?? []) {
    const n = soloDigitos(t);
    if (n.length >= 8 && !telefonos.includes(n)) telefonos.push(n);
  }
  const emails: string[] = [];
  for (const e of d.emails ?? []) {
    const n = (e || '').trim().toLowerCase();
    if (emailValido(n) && !emails.includes(n)) emails.push(n);
  }
  return { telefonos, emails };
}

// ── 2 y 3. Reportes (van por WhatsApp y/o por email) ─────────────────────────
export type ReporteKey = 'horario' | 'diario' | 'semanal';

export const REPORTES: Array<{ key: ReporteKey; titulo: string; sub: string }> = [
  {
    key: 'horario',
    titulo: 'Lo urgente (cada hora)',
    sub: 'Semáforo en rojo, cuotas vencidas y fatiga de anuncios. Solo llega cuando hay algo, de 8 a 21 h.',
  },
  {
    key: 'diario',
    titulo: 'Resumen diario',
    sub: 'A primera hora: semáforo, anuncios de ayer, cierres y pendientes.',
  },
  {
    key: 'semanal',
    titulo: 'Reporte semanal',
    sub: 'Los lunes: anuncios, cierres y cobranza de la semana anterior.',
  },
];

// ── 2. Avisos de WhatsApp que hoy se disparan de verdad ──────────────────────
// El `id` es el mismo `tipo` con el que se emite el aviso: es lo que mira
// emitirAviso() para saber si lo dejaron prendido.
//
// El título NO se toma del catálogo de voz aunque exista ahí, porque ese catálogo
// está escrito para quien opera la agencia y se lee raro del otro lado
// ("Mensaje de WhatsApp entrante (al dueño)", "Reunión cancelada → reacomodar").
// Lo mismo con su campo `disparador`, que habla de funciones del código. Acá va
// el nombre del evento y cuándo llega, en el idioma de quien lo va a recibir.
export type AvisoWaDef = { id: string; titulo: string; sub: string };

export const AVISOS_WA_EN_VIVO: AvisoWaDef[] = [
  { id: 'lead-formulario-meta', titulo: 'Lead nuevo por formulario de Meta', sub: 'Alguien completa un formulario y entra al CRM.' },
  { id: 'reunion-nuevo-agendado', titulo: 'Reunión agendada', sub: 'Un lead reserva un horario en el calendario.' },
  { id: 'reunion-cancelada', titulo: 'Reunión cancelada o reagendada', sub: 'Se libera o se mueve un horario ya reservado.' },
  { id: 'reunion-ocurrio-fathom', titulo: 'Grabación de reunión lista', sub: 'Termina una reunión y queda la transcripción.' },
  { id: 'reunion-tareas-al-plan', titulo: 'Tareas esperando confirmación', sub: 'De una reunión salieron tareas para revisar en el plan.' },
  { id: 'tareas-autocompletadas', titulo: 'Tareas cerradas automáticamente', sub: 'MaKo dio por hechas tareas que ya estaban resueltas.' },
  { id: 'plan-proyecto-vence', titulo: 'Proyectos atrasados o por vencer', sub: 'UN mensaje por día con todos juntos, y solo si algo cambió.' },
  { id: 'avisos-resumen', titulo: 'El resumen de la mañana', sub: 'El mensaje que junta los avisos que no eran urgentes. Apagarlo NO los devuelve al momento: los deja sin salir.' },
  { id: 'retro-lista', titulo: 'Retro semanal lista', sub: 'Queda armada la retro de la semana, con su PDF.' },
  { id: 'wa-mensaje-entrante', titulo: 'Mensaje de WhatsApp sin responder', sub: 'Un contacto escribe y todavía nadie le contestó.' },
  // Cableado el 06/10/2026 (lib/lineas-vigilante.ts, desde el cron de alertas).
  { id: 'wa-desconectado', titulo: 'Se cayó tu WhatsApp', sub: 'Tu línea por QR dejó de mandar y recibir. Avisa una vez y cada 24 h.' },
  // El «volvió» de la caída de arriba (09/10/2026, lib/lineas-vigilante.ts).
  { id: 'wa-reconectado', titulo: 'Volvió tu WhatsApp', sub: 'La línea que se había caído vuelve a mandar y recibir.' },
  { id: 'meta-anuncio-espera-aprobacion', titulo: 'Meta retuvo un anuncio', sub: 'Un anuncio publicado necesita aprobación manual para salir.' },
  { id: 'tracking-apagado', titulo: 'La landing dejó de mandar datos', sub: 'Se cortó el seguimiento y las métricas quedan ciegas.' },
  { id: 'objetivo-en-riesgo', titulo: 'Tu objetivo del trimestre va atrasado', sub: 'Lo acumulado quedó por debajo del ritmo que hace falta para llegar.' },
  { id: 'meta-alcanzada', titulo: 'Cumpliste un objetivo', sub: 'Un objetivo del trimestre llegó a su meta.' },
  { id: 'quarter-planificar', titulo: 'Falta planificar el trimestre que viene', sub: 'Se está terminando el Quarter y el siguiente todavía está vacío.' },
  { id: 'crm-lead-estancado', titulo: 'Leads quietos en una etapa', sub: 'MaKo movió los que pasaron el plazo de su columna. UN mensaje por día con todos juntos.' },
];
