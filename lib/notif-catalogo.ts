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
// Al cablear un aviso nuevo, sumá su id acá SÓLO SI SALE: que vaya por un evento de MaKo (`AVISOS_POR_EVENTO`) o que
// tenga `porDefecto` 'on' o 'siempre' en el catálogo. Sin `porDefecto` nace APAGADO (`estaPrendida`, lib/plantillas.ts),
// y el interruptor de esta pantalla no lo prende: el envío lee el store, no esto. Mostrarlo sería un interruptor que no hace
// nada. Lo fija tests/notificaciones-solo-lo-que-sale.test.ts.
//
// ⚠️ 26/10/2026 (Martín, por el Ops Center: «Sacarlos de Notificaciones»): salieron NUEVE que estaban acá y no le salían a
// ningún negocio (medido en producción: ninguno los tenía prendidos en su store, y «MaKo Messages», la única pantalla que
// podía prenderlos, se fue ese día). Son crm-lead-estancado, crm-lead-quieto, tareas-autocompletadas, retro-lista,
// plan-proyecto-vence, avisos-resumen, objetivo-en-riesgo, meta-alcanzada y quarter-planificar. Siguen en el catálogo y en
// su código: si un día se quiere que salgan, se les pone `porDefecto` (y vuelven acá). docs/hallazgos-comunicacion.md.

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
  { id: 'wa-mensaje-entrante', titulo: 'Mensaje de WhatsApp sin responder', sub: 'Un contacto escribe y todavía nadie le contestó.' },
  // Cableado el 06/10/2026 (lib/lineas-vigilante.ts, desde el cron de alertas).
  { id: 'wa-desconectado', titulo: 'Se cayó tu WhatsApp', sub: 'Tu línea por QR dejó de mandar y recibir. Avisa una vez y cada 24 h.' },
  // El «volvió» de la caída de arriba (09/10/2026, lib/lineas-vigilante.ts).
  { id: 'wa-reconectado', titulo: 'Volvió tu WhatsApp', sub: 'La línea que se había caído vuelve a mandar y recibir.' },
  { id: 'meta-anuncio-espera-aprobacion', titulo: 'Meta retuvo un anuncio', sub: 'Un anuncio publicado necesita aprobación manual para salir.' },
  { id: 'tracking-apagado', titulo: 'La landing dejó de mandar datos', sub: 'Se cortó el seguimiento y las métricas quedan ciegas.' },
];

// ── 4. Web Push (MaKo Mobile): lo que le llega al TELÉFONO de una persona ────
// La preferencia es de la PERSONA (`usuarios.perfil.notifPush`), igual que el pop-up y el
// sonido: el teléfono es suyo, no del negocio. Lo que el NEGOCIO decide (si un aviso sale,
// cada cuánto, si espera al resumen de la mañana) ya lo resolvió `emitirAviso` ANTES de
// llegar al push (lib/avisos.ts): esto sólo contesta «¿esta persona lo quiere en el
// teléfono?».
//
// ⚠️ SIN `server-only`, a propósito: lo leen la pantalla de Cuenta (/m/cuenta), el
// despachador (lib/push.ts) y un test.
//
// ⚠️ Un aviso que NO está en esta lista igual se pushea si la persona tiene el push
// prendido — la misma regla que AVISOS_WA_EN_VIVO arriba: lo que se pierde al olvidarse de
// sumarlo es poder APAGARLO de a uno, no el aviso.

/** Los que no son avisos del catálogo: las decisiones que MaKo deja esperando, y el grupo. */
export const PUSH_DE_MAKO: AvisoWaDef[] = [
  { id: 'mako-pendiente', titulo: 'MaKo te pide confirmar', sub: 'Una acción espera tu sí.' },
  { id: 'mako-propuesta', titulo: 'MaKo dejó algo para revisar', sub: 'Un borrador espera tu revisión.' },
  // NO va en PUSH_SOLO_ADMINS: un closer invitado o alguien de otro negocio lo reciben (lib/push.ts, `enviarPushAMiembros`).
  { id: 'mako-grupo', titulo: 'Mensajes del grupo', sub: 'Lo que cae en el grupo de MaKo.' },
];

/** Lo que la pantalla ofrece prender y apagar de a uno, en el orden en que se muestra. */
export const PUSH_TIPOS: AvisoWaDef[] = [...PUSH_DE_MAKO, ...AVISOS_WA_EN_VIVO];

/**
 * Lo que sólo les llega a los ADMIN del negocio, prendan lo que prendan. Confirmar una
 * acción de MaKo es de quien puede confirmarla (`gating.rolMinimo`, lib/api-mako): a un
 * closer le avisaría de algo que su pantalla no le deja tocar.
 */
// 'mako-propuesta' también: lo que MaKo deja para revisar lo confirma un admin (y un contacto
// propuesto trae datos de una persona). Los AVISOS los manda emitirAviso con soloAdmins: en
// escritorio son de admin (adeudos, cuotas con montos, reportes), y el teléfono no los abre más.
export const PUSH_SOLO_ADMINS: ReadonlySet<string> = new Set(['mako-pendiente', 'mako-propuesta']);

/** `activo` = el interruptor de toda la persona; `items[tipo] === false` apaga uno. `silencio` = «No molestar» (abajo). */
export type NotifPush = { activo: boolean; items: Record<string, boolean>; silencio?: Silencio | null };

/**
 * «NO MOLESTAR» (25/10/2026, Settings › Notificaciones; el «Notification schedule» de Slack, docs/settings/referencia.md):
 * un horario en el que a la persona NO le llegan avisos al celular. Horas en medias horas (0 a 23.5), en la zona horaria
 * de SU perfil. `desde > hasta` cruza la medianoche (22 → 8). Lo que cae adentro no se manda (no se acumula para después:
 * es lo que hace Slack, y un «se juntaron 14 avisos» a las 8 de la mañana es otro problema).
 */
export type Silencio = { desde: number; hasta: number };

/** Lo que se ofrece por defecto al prender «No molestar». */
export const SILENCIO_SUGERIDO: Silencio = { desde: 22, hasta: 8 };

const esMediaHora = (h: unknown): h is number => typeof h === 'number' && Number.isFinite(h) && h >= 0 && h < 24 && Math.round(h * 2) === h * 2;

/** El silencio guardado, o null si no hay uno válido (una ventana de cero horas no es un silencio). */
export function normalizarSilencio(raw: unknown): Silencio | null {
  if (!raw || typeof raw !== 'object') return null;
  const { desde, hasta } = raw as Partial<Silencio>;
  if (!esMediaHora(desde) || !esMediaHora(hasta) || desde === hasta) return null;
  return { desde, hasta };
}

/** La hora del reloj (con minutos, en fracción) en `tz`. Una zona inválida cae en la de MaKo por defecto (Tijuana). */
function horaEn(tz: string, ahora: Date): number {
  const leer = (zona: string) => {
    const partes = new Intl.DateTimeFormat('en-US', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ahora);
    const n = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
    return n('hour') + n('minute') / 60;
  };
  try { return leer(tz); } catch { return leer('America/Tijuana'); }
}

/** ¿`ahora` cae en el «No molestar» de esta persona? Sin silencio guardado, nunca. */
export function enSilencio(prefs: Pick<NotifPush, 'silencio'>, tz: string, ahora: Date = new Date()): boolean {
  const s = normalizarSilencio(prefs.silencio);
  if (!s) return false;
  const h = horaEn(tz || 'America/Tijuana', ahora);
  return s.desde < s.hasta ? h >= s.desde && h < s.hasta : h >= s.desde || h < s.hasta;
}

/** El rol con el que se decide el default. Ausente = no se sabe: se trata como admin (abajo). */
export type RolPush = 'admin' | 'closer' | 'setter';

/**
 * El rol EFECTIVO de una fila de `usuarios`, con la MISMA regla que `getRolWsEfectivo`
 * (lib/workspace.ts): admin global → admin; si no, `rol_ws`, y sin `rol_ws` → admin (las
 * filas de antes del rol por workspace eran todas del dueño de su cuenta).
 */
export function rolPushDeFila(f: { rol?: string | null; rol_ws?: string | null }): RolPush {
  if (f.rol === 'admin') return 'admin';
  return f.rol_ws === 'closer' || f.rol_ws === 'setter' ? f.rol_ws : 'admin';
}

/**
 * Normaliza lo que venga de la base (jsonb libre). Sin nada guardado, el DEFAULT es por rol
 * (decisión de diseño de MaKo Mobile): el admin lo tiene prendido —es a quien le llegan hoy
 * los avisos al grupo—; closer y setter lo prenden ellos, porque la mayoría de los avisos del
 * negocio no son de su trabajo.
 */
export function normalizarPush(raw: unknown, rol: RolPush): NotifPush {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<NotifPush>;
  const items: Record<string, boolean> = {};
  const src = (o.items && typeof o.items === 'object' ? o.items : {}) as Record<string, unknown>;
  // Se conservan TODOS los que vinieron como booleano (no sólo los ofrecidos): un aviso que
  // hoy no está en PUSH_TIPOS y la persona apagó cuando sí estaba no vuelve a sonar solo.
  for (const [k, v] of Object.entries(src)) if (typeof v === 'boolean') items[k] = v;
  const silencio = normalizarSilencio(o.silencio);
  return {
    activo: typeof o.activo === 'boolean' ? o.activo : rol === 'admin',
    items,
    ...(silencio ? { silencio } : {}),
  };
}

/**
 * ¿Esta persona quiere el push del GRUPO? (3/11/2026, lib/push.ts, `enviarPushAMiembros`). Sin nada guardado, SÍ: `normalizarPush` da apagado por defecto a un
 * closer, y como el rol sale de SU negocio, un invitado nunca oiría nada sin que nadie se lo diga. Lo que la persona apagó, apagado; y su «No molestar» manda.
 */
export function quierePushDelGrupo(raw: unknown, tz: string, ahora: Date = new Date()): boolean {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<NotifPush>;
  if (o.activo === false) return false;
  if ((o.items as Record<string, unknown> | undefined)?.['mako-grupo'] === false) return false;
  return !enSilencio({ silencio: o.silencio ?? null }, tz, ahora);
}

/** ¿Esta persona quiere este push? El maestro manda; abajo, cada uno puede apagarse. */
export function quierePush(prefs: NotifPush, tipo: string): boolean {
  return prefs.activo && prefs.items[tipo] !== false;
}
