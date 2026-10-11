// =============================================================================
// disparadores — los CRON de una automatización: qué son, cómo se guardan, cuándo disparan
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026), CRON puntos 2, 3, 6, 7, 8, 9 y 10. Lo que pidió Martín:
//   · «agrega la opción de tener más de un CRON» (la tarjeta con «+ Nuevo CRON», como ManyChat);
//   · la primera pantalla del CRON: «Producto», «Recurrente», «Etiqueta», «Instagram», «Messenger» y
//     «Email», con botones gigantes;
//   · «Etiqueta» es un CRON aparte, con «Se agrega etiqueta a un lead» / «Se elimina etiqueta a un
//     lead» y la opción de «Ignorar» etiquetas;
//   · los eventos de Instagram y de Messenger que ofrece ManyChat, y «si recibo un email»;
//   · el Recurrente como el diálogo de repetición del Plan, con «A quién» de selección múltiple que
//     incluye «El grupo de MaKo».
//
// ⚠️ PURO Y SIN `server-only`, A PROPÓSITO: esto decide qué automatizaciones arrancan con cada evento
// —o sea a quién le llega un WhatsApp real—, y lo leen el motor (lib/nutricion.ts), la ruta que
// guarda (app/api/chat-agent/secuencias) y la pantalla (app/automations/EditorDisparadores.tsx). Con dos
// copias de la regla, una se queda vieja. El test es tests/disparadores.test.ts.
//
// ── EL MODELO: UNA LISTA, Y EL PRIMERO VIVE EN LAS COLUMNAS DE SIEMPRE ───────────────────────────
// `nutricion_secuencias.disparadores` (jsonb, mig 0241) guarda la LISTA entera. El PRIMERO es el
// disparador de siempre y su verdad son las COLUMNAS (`trigger_tipo`, `etapa`, `etapas`, `funnel_id`,
// `producto_id`, `etiqueta_id`, `cron`, `cron_proxima_at`): las leen quince lugares que no saben de
// listas (la API de MaKo, /email, el generador de copy, la clonación, Customer Success…) y siguen
// leyendo exactamente lo que leían. `disparadoresDe` arma la lista así:
//   · [0] = las columnas, SIEMPRE. De lo guardado en la lista toma sólo lo que las columnas no tienen
//     (`ignorar`, `subtipo`, `grupo`, el `id`), y sólo si es del MISMO `trigger_tipo`: si un escritor
//     viejo cambió el disparador por su cuenta (la API de email, /email), lo de la lista era de OTRO.
//   · [1..] = lo guardado en la lista, tal cual.
// Por eso un escritor viejo es inofensivo: cambia el primero y los demás siguen.
// =============================================================================

import { sanearCron, textoCron, proximaOcurrencia, type CronAviso } from './cron-aviso';
import { normalizarEtapas, etapasDe, TRIGGER_ETAPA, TRIGGER_ENTREGA, TRIGGER_ETIQUETA } from './nutricion-etapa';
import { valorDisparo, valoresDisparo, valoresTrasTocar, valorDeVarios, disparoDeValor, type DisparoActual } from './flujo-conversacion';
import { claseDe, idDe, puertosDe, raicesSalida, indicePorId, type PasoGrafo } from './flujo-grafo';
import { OP_AVISAR } from './flujo-legado';
import { partesExplicitas } from './mensaje-partes';
import { TRIGGER_RECORDATORIO } from './recordatorio-automatizacion';

// ── Los tipos de disparador nuevos ──────────────────────────────────────────────────────────────

/** «Se agrega etiqueta a un lead»: CUALQUIERA, salvo las de `ignorar`. (La de UNA etiqueta es `etiqueta_puesta`.) */
export const TRIGGER_ETIQUETA_AGREGADA = 'etiqueta_agregada';
/** «Se elimina etiqueta a un lead»: cualquiera, salvo las de `ignorar`. */
export const TRIGGER_ETIQUETA_QUITADA = 'etiqueta_quitada';
export const TRIGGER_INSTAGRAM = 'instagram';
export const TRIGGER_MESSENGER = 'messenger';
/** «Si recibo un email» (CRON punto 8). */
export const TRIGGER_EMAIL_RECIBIDO = 'email_recibido';
/**
 * «Pagos» (11/10/2026, la pasarela de Stripe y Mercado Pago): CUÁL evento lo dice `subtipo`
 * (`EVENTOS_PAGO`). Lo emite el webhook de la pasarela por `enrolarPorPago` (lib/pago-entrante.ts),
 * DESPUÉS de asentar el pago en el CRM (así `fecha_primer_pago` ya está y la condición «Pagó» da bien).
 */
export const TRIGGER_PAGO = 'pago';
/**
 * Un Recurrente cuyo «A quién» es SÓLO el grupo de MaKo: no hay cohorte de leads. Con cohorte y
 * grupo a la vez, el `trigger_tipo` es el de la cohorte y `grupo: true`.
 */
export const TRIGGER_SOLO_GRUPO = 'grupo_mako';

/**
 * «EVENTO DE MAKO» (11/10/2026): el CRON de una automatización que es un mensaje de «MaKo en WhatsApp».
 * Martín: «Todo ahora es lo mismo... debe ser IDENTICO» (docs/diseno-mako-en-whatsapp-unificado.md). CUÁL
 * evento lo dice `subtipo` (`EVENTOS_MAKO`, abajo), como el de Instagram. NO lo inscribe el motor de
 * nutrición: lo lee el emisor de siempre (`emitirDelCatalogo` → `emitirPorEvento`, lib/aviso-evento.ts),
 * igual que el recordatorio de la reunión.
 */
export const TRIGGER_AVISO_MAKO = 'aviso_mako';

/**
 * LOS QUE DISPARAN SÓLO POR SU EVENTO: no tienen cohorte (no hay «quien está parado en…»), así que
 * el barrido horario no los mira. Los llama el choke point de cada uno: las etiquetas
 * (lib/etiquetas-motor.ts), los webhooks de Instagram, Messenger y el email (parte «canales») y el
 * emisor de los avisos (`aviso_mako`). Con horario contestan «Un evento no se repite por horario».
 */
export const TRIGGERS_SOLO_EVENTO: ReadonlySet<string> = new Set([
  TRIGGER_ETIQUETA_AGREGADA, TRIGGER_ETIQUETA_QUITADA, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO, TRIGGER_AVISO_MAKO,
  TRIGGER_PAGO,
]);

/**
 * LOS CRON QUE MANDA SU PROPIO EMISOR, no el motor: el recordatorio de la reunión y el evento de MaKo.
 * Con uno de éstos la lista es de UNO (`problemaDeDisparadores`: «Este CRON va solo») y no se cambia
 * (`problemaDeCambio`). Sin esto, un segundo CRON de Producto sobre el recordatorio inscribía leads en
 * el motor ADEMÁS del emisor, y la «←» lo pasaba a otra clase sin que el emisor se enterara.
 */
export const TRIGGERS_DEL_EMISOR: ReadonlySet<string> = new Set([TRIGGER_RECORDATORIO, TRIGGER_AVISO_MAKO]);
export const esDelEmisor = (d: Pick<Disparador, 'trigger_tipo'> | null | undefined): boolean => !!d && TRIGGERS_DEL_EMISOR.has(d.trigger_tipo);
export const MOTIVO_CRON_SOLO = 'Este CRON va solo';
export const MOTIVO_CRON_FIJO = 'Este CRON no se cambia';

/** Todos los que este módulo agrega al catálogo de siempre (`TRIGGERS`, lib/email-marketing.ts). */
export const TRIGGERS_NUEVOS: readonly string[] = [...TRIGGERS_SOLO_EVENTO, TRIGGER_SOLO_GRUPO];

/**
 * LOS QUE SÓLO SE ELIGEN EN EL CRON DE LA AUTOMATIZACIÓN (segunda pasada de la sexta tanda,
 * 09/10/2026). Necesitan un dato que el selector de siempre —el de /email, la API de email— no
 * tiene: el EVENTO del canal (`subtipo`) o el HORARIO y «A quién». Desde `TRIGGERS` se pueden NOMBRAR,
 * pero guardados por esa puerta quedaban como una automatización que no arranca nunca, sin un error
 * (`disparaPorEvento` exige el subtipo; el grupo sin horario no barre). Los rechazan
 * `crearEmailSecuencia` / `actualizarMetaEmailSecuencia` (lib/email-marketing.ts) y la API de email.
 * Las dos de etiqueta («Se agrega / se elimina») no están: su «Ignorar» es opcional.
 *
 * Los dos del EMISOR (11/10/2026) tampoco se eligen ahí: nacen de la galería con su CRON fijo. Puesto
 * desde /email, el recordatorio convertía en «recordatorio» cualquier automatización (la lee su emisor)
 * y el evento de MaKo quedaba sin evento.
 */
export const SOLO_DESDE_EL_CRON: ReadonlySet<string> = new Set([
  TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO, TRIGGER_PAGO, TRIGGER_SOLO_GRUPO, ...TRIGGERS_DEL_EMISOR,
]);
export const MOTIVO_SOLO_DESDE_EL_CRON = 'Ese disparador se elige en el CRON de la automatización.';

/** Cuántos CRON puede tener una automatización. ManyChat no topea; diez es más de lo que se usa. */
export const TOPE_DISPARADORES = 10;
/** Cuántas etiquetas se pueden «Ignorar». */
export const TOPE_IGNORAR = 50;

// ── Las siete clases de la primera pantalla ─────────────────────────────────────────────────────

/**
 * `mako` = «Evento de MaKo» (11/10/2026). NO es un botón de la primera pantalla: una fila de evento nace de
 * la galería con su CRON puesto, y no se cambia.
 *
 * `pagos` (11/10/2026): los eventos de la pasarela (Stripe / Mercado Pago). Martín eligió que sea un BOTÓN
 * PROPIO y no un evento adentro de «Producto», con la grilla en 4+3 — nunca 3+3+1, que se ve roto.
 */
export type ClaseDisparador = 'producto' | 'recurrente' | 'etiqueta' | 'instagram' | 'messenger' | 'email' | 'pagos' | 'mako';

/** Los botones gigantes de la primera pantalla del CRON (CRON puntos 1, 2, 6, 7 y 8, y Pagos), en ese orden. */
export const CLASES_DISPARADOR: ReadonlyArray<{ clase: ClaseDisparador; label: string }> = [
  { clase: 'producto', label: 'Producto' },
  { clase: 'recurrente', label: 'Recurrente' },
  { clase: 'etiqueta', label: 'Etiqueta' },
  { clase: 'instagram', label: 'Instagram' },
  { clase: 'messenger', label: 'Messenger' },
  { clase: 'email', label: 'Email' },
  { clase: 'pagos', label: 'Pagos' },
];

/** Un evento de un canal. `apagado` = el motivo por el que todavía no se ofrece (como en ManyChat). */
export type EventoCanal = { subtipo: string; label: string; apagado?: string };

/**
 * LOS DE INSTAGRAM, COMO LOS OFRECE MANYCHAT (CRON punto 6, con la captura). El clic en un anuncio
 * ManyChat lo muestra apagado (Meta lo habilita por cuenta y por campaña): acá también.
 */
export const EVENTOS_INSTAGRAM: readonly EventoCanal[] = [
  { subtipo: 'comentario', label: 'El usuario comenta tu publicación o Reel' },
  { subtipo: 'historia', label: 'El usuario responde a tu historia' },
  { subtipo: 'dm', label: 'El usuario envía un mensaje' },
  { subtipo: 'anuncio', label: 'El usuario hace clic en un anuncio de Instagram', apagado: 'Todavía no' },
  { subtipo: 'en_vivo', label: 'El usuario comenta en tu En vivo' },
  { subtipo: 'ref', label: 'El usuario hace clic en un enlace de referencia' },
];

/**
 * Los de Messenger (CRON punto 7), con el del anuncio apagado como en ManyChat.
 *
 * ⚠️ LA TIENDA VA APAGADA (segunda pasada, 09/10/2026): Zernio no avisa los mensajes que llegan desde
 * la tienda de Facebook (`DISPARADORES_SOCIALES`, lib/canal-social.ts, la marca `disponible: false`),
 * así que un CRON guardado con ese evento era una automatización que no arranca NUNCA, sin un error.
 * tests/disparadores-canal-social.test.ts cruza las dos tablas.
 */
export const EVENTOS_MESSENGER: readonly EventoCanal[] = [
  { subtipo: 'anuncio', label: 'El usuario hace clic en un anuncio de Facebook', apagado: 'Todavía no' },
  { subtipo: 'comentario', label: 'El usuario comenta tu publicación' },
  { subtipo: 'dm', label: 'El usuario envía un mensaje' },
  { subtipo: 'ref', label: 'El usuario hace clic en un enlace de referencia' },
  { subtipo: 'qr', label: 'El usuario escanea un código QR' },
  { subtipo: 'tienda', label: 'Mensajes de usuarios de tu tienda de Facebook', apagado: 'Todavía no' },
];

/** «Si recibo un email» (CRON punto 8). Uno solo: es el único hecho que el email trae hoy. */
export const EVENTOS_EMAIL: readonly EventoCanal[] = [
  { subtipo: 'recibido', label: 'Recibes un email' },
];

/**
 * «Pagos» (11/10/2026): lo que confirma la pasarela de un cobro creado en MaKo. El vocabulario del CRON;
 * el del proveedor (checkout.session.completed, invoice.paid, approved…) lo traduce el webhook a éste
 * (lib/cobros-eventos.ts), en UN lugar. Un pago aprobado dispara también en cada RENOVACIÓN de una
 * suscripción: la automatización corre una vez por lead, así que la bienvenida sale con el primero.
 */
export const EVENTOS_PAGO: readonly EventoCanal[] = [
  { subtipo: 'aprobado', label: 'Se aprueba un pago' },
  { subtipo: 'rechazado', label: 'Se rechaza un pago' },
  { subtipo: 'reembolsado', label: 'Se devuelve un pago' },
  { subtipo: 'suscripcion_cancelada', label: 'Se cancela una suscripción' },
];

/** Cuál de los «Eventos de MaKo» (`EVENTOS_MAKO`). */
export type SubtipoMako = 'reunion_pronto' | 'lead_contesta' | 'cuota_vencida' | 'lead_agendo' | 'pago_recibido';

/**
 * LOS EVENTOS DE MAKO (11/10/2026, docs/diseno-mako-en-whatsapp-unificado.md §1): cada uno es un aviso del
 * catálogo que hasta hoy salía solo y desde ahora sale por las automatizaciones que el negocio agrega de la
 * galería. `aviso` es el id que se EMITE (de él cuelgan el dedup, el rótulo y el feed: no se cambia). El id
 * crudo no va en `subtipo`: su regex (`/^[a-z_]{1,30}$/`) rechaza el guion de `cuota-vencida`.
 *
 * `trae`: lo que el código que lo emite tiene en la mano. `mensaje` = el texto que arma (lo que sale con
 * `{{mensaje_mako}}`); `cuota` = los datos de la cuota (`{{cuota_monto}}`…). El lead, los tres.
 */
export type EventoMako = EventoCanal & { subtipo: SubtipoMako; aviso: string; trae: ReadonlyArray<'lead' | 'mensaje' | 'cuota'> };
export const EVENTOS_MAKO: readonly EventoMako[] = [
  { subtipo: 'reunion_pronto', aviso: 'reunion-recordatorio', label: 'Falta media hora para una reunión', trae: ['lead', 'mensaje'] },
  { subtipo: 'lead_contesta', aviso: 'wa-mensaje-entrante', label: 'Un lead contesta y MaKo no le respondió', trae: ['lead', 'mensaje'] },
  { subtipo: 'cuota_vencida', aviso: 'cuota-vencida', label: 'Una cuota vence sin cobrarse', trae: ['lead', 'cuota'] },
  // GENERAL 7 de la décima tanda (11/10/2026), textual: «Vuelve a poner la automatización que avisa que se agendó un
  // nuevo lead en Mauricio y Código». El aviso nunca se dejó de mandar (sale de los webhooks de Calendly y Cal.com);
  // lo que no se veía era la AUTOMATIZACIÓN. Desde acá sale sólo por la fila de este evento (docs/diseno-automations-
  // galeria-v2.md §5), y la mudanza de ws1 y ws13 la crea antes del deploy (scripts/mudanza-nuevo-agendado.mts).
  { subtipo: 'lead_agendo', aviso: 'reunion-nuevo-agendado', label: 'Un lead agenda una reunión', trae: ['lead', 'mensaje'] },
  // La pasarela de pagos (11/10/2026): el aviso «Entró un pago» lo arma lib/cobros.ts cuando Stripe o Mercado Pago
  // confirman un cobro creado en MaKo. Al equipo (el grupo de MaKo), no al lead: al lead le escribe el CRON «Pagos».
  { subtipo: 'pago_recibido', aviso: 'pago-recibido', label: 'Entra un pago', trae: ['lead', 'mensaje'] },
];

/** Los eventos de una clase de canal (vacío para las demás). */
export function eventosDe(clase: ClaseDisparador | 'otro' | null): readonly EventoCanal[] {
  if (clase === 'instagram') return EVENTOS_INSTAGRAM;
  if (clase === 'messenger') return EVENTOS_MESSENGER;
  if (clase === 'email') return EVENTOS_EMAIL;
  if (clase === 'pagos') return EVENTOS_PAGO;
  if (clase === 'mako') return EVENTOS_MAKO;
  return [];
}

/**
 * EL EVENTO DEL WEBHOOK, EN LAS PALABRAS DEL CRON (segunda pasada de la sexta tanda, 09/10/2026).
 *
 * ⚠️ HAY DOS VOCABULARIOS Y NINGUNO DA ERROR. El lector del webhook de Zernio (`eventoSocialDe`,
 * lib/canal-social.ts) dice `mensaje`, `comentario_vivo` y `referencia`; el CRON guarda `dm`, `en_vivo`
 * y `ref` (`EVENTOS_INSTAGRAM` / `EVENTOS_MESSENGER`, arriba). Cada parte los eligió por su lado y los
 * dos tienen su test. Sacar el cast de `dispararEventoSocial` sin esta traducción compilaba perfecto y
 * dejaba un «El usuario envía un mensaje» sin arrancar NUNCA: `disparaPorEvento` compara el subtipo
 * exacto y `'mensaje' !== 'dm'`. Medido con la tabla del webhook (tests/disparadores-canal-social.test.ts):
 * 3 de los 11 eventos que llegan no coincidían.
 *
 * null = el evento no lo escucha ningún CRON de ese canal (una mención en una historia, por ejemplo).
 */
const SUBTIPO_DEL_WEBHOOK: Readonly<Record<string, string>> = {
  mensaje: 'dm', historia: 'historia', comentario: 'comentario', comentario_vivo: 'en_vivo',
  anuncio: 'anuncio', referencia: 'ref', qr: 'qr', tienda: 'tienda',
};
export function subtipoDelEvento(canal: 'instagram' | 'messenger', subtipoDelWebhook: string | null | undefined): string | null {
  const s = subtipoDelWebhook ? SUBTIPO_DEL_WEBHOOK[subtipoDelWebhook] : undefined;
  return s && eventosDe(canal).some((e) => e.subtipo === s) ? s : null;
}

/** El `trigger_tipo` de cada clase de canal. */
/** Las clases cuyo CRON es «elegí el evento» (`subtipo`): los canales y los pagos. */
export type ClaseDeEventos = 'instagram' | 'messenger' | 'email' | 'pagos';
export const esClaseDeEventos = (c: ClaseDisparador | 'otro' | null): c is ClaseDeEventos =>
  c === 'instagram' || c === 'messenger' || c === 'email' || c === 'pagos';
const TRIGGER_DE_CANAL: Record<ClaseDeEventos, string> = {
  instagram: TRIGGER_INSTAGRAM, messenger: TRIGGER_MESSENGER, email: TRIGGER_EMAIL_RECIBIDO, pagos: TRIGGER_PAGO,
};
export const triggerDeCanal = (c: ClaseDeEventos): string => TRIGGER_DE_CANAL[c];

/**
 * ¿Está conectado el canal? Lo contesta el servidor (lib/disparadores-canales.ts). `conectado: null`
 * = no se pudo saber, que NO es «no»: la pantalla lo dice así y no ofrece los eventos (un evento que
 * no puede llegar es una automatización que no arranca nunca, sin error).
 */
export type EstadoCanal = { conectado: boolean | null; motivo?: string; cuenta?: string | null };
export type EstadoCanales = Record<ClaseDeEventos, EstadoCanal>;

// ── El dato ─────────────────────────────────────────────────────────────────────────────────────

export type Disparador = {
  /** Estable dentro de la automatización: `d1`, `d2`… Lo usa la tarjeta para abrir cada uno. */
  id: string;
  trigger_tipo: string;
  /** Producto: la etapa (la primera) y, con varias, la lista (mig 0230). */
  etapa?: string | null;
  etapas?: string[] | null;
  /** Producto (adquisición): el embudo. Ausente = «el de la automatización». */
  funnel_id?: number | null;
  /** Producto (entrega): el producto. */
  producto_id?: number | null;
  /** «Se le puso «X»»: la etiqueta. */
  etiqueta_id?: number | null;
  /** «Se agrega / se elimina etiqueta a un lead»: las que NO disparan (CRON punto 3: «Ignorar»). */
  ignorar?: number[];
  /** Instagram / Messenger / Email: CUÁL de sus eventos (`EVENTOS_*`). */
  subtipo?: string | null;
  /** Recurrente: cuándo (lib/cron-aviso.ts). Con horario, el disparador NO responde a eventos. */
  cron?: CronAviso | null;
  /** Recurrente: la próxima ocurrencia agendada (el ancla; ver lib/nutricion-agenda.ts). */
  cron_proxima_at?: string | null;
  /** Recurrente: además de (o en vez de) la cohorte, el grupo de WhatsApp de MaKo del negocio. */
  grupo?: boolean;
};

/** La fila de `nutricion_secuencias` que hace falta para armar la lista. */
export type FilaDisparadores = {
  trigger_tipo: string;
  etapa?: string | null;
  etapas?: unknown;
  funnel_id?: number | string | null;
  producto_id?: number | string | null;
  etiqueta_id?: number | string | null;
  cron?: unknown;
  cron_proxima_at?: string | null;
  /** Ausente con la 0241 sin aplicar: entonces es la lista de UNO (las columnas). */
  disparadores?: unknown;
};

const idPositivo = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const esTrigger = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_]{1,60}$/.test(v);
const esIdDisparador = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(v);
const fechaIso = (v: unknown): string | null => (typeof v === 'string' && v && !Number.isNaN(Date.parse(v)) ? v : null);

/** Las clases que llevan etapa. */
const DE_ETAPA: ReadonlySet<string> = new Set([TRIGGER_ETAPA, TRIGGER_ENTREGA]);
/** Las que llevan `ignorar`. */
const CON_IGNORAR: ReadonlySet<string> = new Set([TRIGGER_ETIQUETA_AGREGADA, TRIGGER_ETIQUETA_QUITADA]);
/** Las que llevan `subtipo` (el evento de MaKo también: cuál de `EVENTOS_MAKO`). */
const CON_SUBTIPO: ReadonlySet<string> = new Set([TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO, TRIGGER_AVISO_MAKO, TRIGGER_PAGO]);

/**
 * CADA DISPARADOR LLEVA SÓLO LOS CAMPOS DE SU TIPO. Un campo de otro tipo que sobrevive a un cambio
 * es un ámbito que nadie ve (la etiqueta vieja de un disparador que ahora es de etapa) — la misma
 * regla que `escribirDisparador` (lib/setting-secuencias.ts) aplica a las columnas.
 */
function higiene(d: Disparador): Disparador {
  const t = d.trigger_tipo;
  const out: Disparador = { id: d.id, trigger_tipo: t };
  if (DE_ETAPA.has(t)) {
    const etapas = normalizarEtapas(d.etapas?.length ? d.etapas : [d.etapa ?? '']);
    out.etapa = etapas[0] ?? null;
    out.etapas = etapas.length > 1 ? etapas : null;
    if (t === TRIGGER_ETAPA && d.funnel_id !== undefined) out.funnel_id = d.funnel_id ?? null;
    if (t === TRIGGER_ENTREGA) out.producto_id = d.producto_id ?? null;
  } else if (d.etapa != null && !CON_SUBTIPO.has(t) && !CON_IGNORAR.has(t)) {
    // La etapa de un disparador de antes (un evento del catálogo) se conserva tal cual: la columna es
    // NOT NULL y hay lectores que la miran. No dispara nada.
    out.etapa = d.etapa;
  }
  if (t === TRIGGER_ETIQUETA) out.etiqueta_id = d.etiqueta_id ?? null;
  if (CON_IGNORAR.has(t)) out.ignorar = [...new Set((d.ignorar ?? []).filter((n) => idPositivo(n) != null))].slice(0, TOPE_IGNORAR);
  if (CON_SUBTIPO.has(t)) out.subtipo = d.subtipo ?? null;
  if (d.cron) {
    out.cron = d.cron;
    out.cron_proxima_at = d.cron_proxima_at ?? null;
    if (d.grupo === true || t === TRIGGER_SOLO_GRUPO) out.grupo = true;
  }
  return out;
}

/** Un disparador de lo que sea que haya llegado (la base, la pantalla, la API). null = no se entiende. */
export function sanearDisparador(raw: unknown): Disparador | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!esTrigger(o.trigger_tipo)) return null;
  const etapas = normalizarEtapas(Array.isArray(o.etapas) ? o.etapas : []);
  const etapa = typeof o.etapa === 'string' && o.etapa.trim() ? o.etapa.trim().slice(0, 60) : null;
  return higiene({
    id: esIdDisparador(o.id) ? o.id : '',
    trigger_tipo: o.trigger_tipo,
    etapa, etapas,
    ...('funnel_id' in o ? { funnel_id: idPositivo(o.funnel_id) } : {}),
    producto_id: idPositivo(o.producto_id),
    etiqueta_id: idPositivo(o.etiqueta_id),
    ignorar: Array.isArray(o.ignorar) ? o.ignorar.map(idPositivo).filter((n): n is number => n != null) : [],
    subtipo: typeof o.subtipo === 'string' && /^[a-z_]{1,30}$/.test(o.subtipo) ? o.subtipo : null,
    cron: o.cron == null ? null : sanearCron(o.cron),
    cron_proxima_at: fechaIso(o.cron_proxima_at),
    grupo: o.grupo === true,
  });
}

/** El primer id `d<n>` que no está usado. */
export function nuevoIdDisparador(usados: Iterable<string>): string {
  const ya = new Set(usados);
  for (let n = 1; n < 1000; n++) if (!ya.has(`d${n}`)) return `d${n}`;
  return `d${Date.now().toString(36)}`;
}

/** Una lista saneada: sin lo que no se entiende, con ids únicos y con su tope. */
export function sanearDisparadores(raw: unknown): Disparador[] {
  if (!Array.isArray(raw)) return [];
  const out: Disparador[] = [];
  for (const x of raw) {
    const d = sanearDisparador(x);
    if (!d) continue;
    if (!d.id || out.some((y) => y.id === d.id)) d.id = nuevoIdDisparador(out.map((y) => y.id));
    out.push(d);
    if (out.length >= TOPE_DISPARADORES) break;
  }
  return out;
}

/** El disparador de las COLUMNAS (el de siempre). */
export function disparadorDeColumnas(row: FilaDisparadores, id = 'd1'): Disparador {
  return higiene({
    id,
    trigger_tipo: esTrigger(row.trigger_tipo) ? row.trigger_tipo : 'manual',
    etapa: typeof row.etapa === 'string' ? row.etapa : null,
    etapas: normalizarEtapas(Array.isArray(row.etapas) ? row.etapas : []),
    // Las columnas guardan los TRES ámbitos; `higiene` deja el del tipo.
    funnel_id: idPositivo(row.funnel_id),
    producto_id: idPositivo(row.producto_id),
    etiqueta_id: idPositivo(row.etiqueta_id),
    cron: row.cron == null ? null : sanearCron(row.cron),
    cron_proxima_at: fechaIso(row.cron_proxima_at),
  });
}

/**
 * LA LISTA DE CRON DE UNA AUTOMATIZACIÓN. El primero, de las columnas (ver la cabecera); los demás, de
 * lo guardado. Siempre al menos uno.
 *
 * ⚠️ LAS ETAPAS DEL PRIMERO SALEN DE `etapasDe` (la regla de la 0230): una lista vieja de `etapas` que
 * ya no empieza con `etapa` no cuenta, igual que en el motor.
 */
export function disparadoresDe(row: FilaDisparadores): Disparador[] {
  const guardados = sanearDisparadores(row.disparadores);
  const cols = disparadorDeColumnas({ ...row, etapas: etapasDe({ etapa: row.etapa ?? null, etapas: Array.isArray(row.etapas) ? row.etapas : null }) });
  const g0 = guardados[0];
  const mismo = g0 && g0.trigger_tipo === cols.trigger_tipo;
  const primero = higiene({
    ...cols,
    id: mismo ? g0.id : (g0 && !guardados.slice(1).some((d) => d.id === 'd1') ? 'd1' : nuevoIdDisparador(guardados.map((d) => d.id))),
    ...(mismo ? { ignorar: g0.ignorar, subtipo: g0.subtipo, grupo: g0.grupo } : {}),
  });
  const resto = guardados.slice(1).filter((d) => d.id !== primero.id);
  return [primero, ...resto].slice(0, TOPE_DISPARADORES);
}

/**
 * LO QUE EL PRIMERO ESCRIBE EN LAS COLUMNAS. `funnel_id` va SÓLO con un disparador de adquisición:
 * ausente = no se toca (motor-11, docs/hallazgos-chatbot.md: «Elegir un disparador no toca el
 * producto: ausente no es null»). `etapa` no se toca sin etapa (la columna es NOT NULL).
 * `cron_proxima_at` lo decide quien guarda (lo conserva si el horario no cambió).
 */
export function columnasDeDisparador(d: Disparador): Record<string, unknown> {
  const t = d.trigger_tipo;
  const etapas = DE_ETAPA.has(t) ? normalizarEtapas(d.etapas?.length ? d.etapas : [d.etapa ?? '']) : [];
  return {
    trigger_tipo: t,
    ...(etapas.length ? { etapa: etapas[0] } : {}),
    etapas: etapas.length > 1 ? etapas : null,
    ...(t === TRIGGER_ETAPA ? { funnel_id: d.funnel_id ?? null } : {}),
    producto_id: t === TRIGGER_ENTREGA ? (d.producto_id ?? null) : null,
    etiqueta_id: t === TRIGGER_ETIQUETA ? (d.etiqueta_id ?? null) : null,
    cron: d.cron ?? null,
  };
}

/** Lo que identifica a un disparador (sin su id ni su próxima ocurrencia). */
export function firmaDisparador(d: Disparador): string {
  const h = higiene(d);
  return JSON.stringify([
    h.trigger_tipo, DE_ETAPA.has(h.trigger_tipo) ? normalizarEtapas(h.etapas?.length ? h.etapas : [h.etapa ?? '']) : null,
    h.funnel_id ?? null, h.producto_id ?? null, h.etiqueta_id ?? null,
    [...(h.ignorar ?? [])].sort((a, b) => a - b), h.subtipo ?? null, firmaCron(h.cron), h.grupo === true,
  ]);
}

/** El horario, comparable: dos que salen igual tienen la misma firma. */
export const firmaCron = (c: unknown): string => {
  const s = c == null ? null : sanearCron(c);
  return s ? JSON.stringify(s) : '';
};

/** La firma de la LISTA entera (para saber si la pantalla tiene que volver a sembrarse). */
export const firmaLista = (lista: readonly Disparador[]): string => JSON.stringify(lista.map((d) => [d.id, firmaDisparador(d)]));

/**
 * LA PRÓXIMA OCURRENCIA DE CADA HORARIO AL GUARDAR (lib/disparadores-guardar.ts). La de antes si el
 * horario de ESE CRON no cambió; si es nuevo o distinto, una nueva desde ahora (sembrar no dispara:
 * es estrictamente posterior). Sin horario, ninguna.
 *
 * ⚠️ RECALCULARLA EN CADA GUARDADO CORRÍA EL ANCLA A «AHORA». Tocar «A quién», o el evento de OTRO
 * CRON, guarda la lista entera: un «todos los lunes a las 9» guardado un lunes a las 10 saltaba al
 * lunes siguiente y perdía la ocurrencia de hoy (o la reclamada, si el motor ya la había avanzado).
 */
export function conProximas(lista: readonly Disparador[], previos: readonly Disparador[], ahora: Date, tz: string): Disparador[] {
  return lista.map((d) => {
    if (!d.cron) return { ...d, cron_proxima_at: null };
    const previo = previos.find((p) => p.id === d.id);
    if (previo?.cron && previo.cron_proxima_at && firmaCron(previo.cron) === firmaCron(d.cron)) return { ...d, cron_proxima_at: previo.cron_proxima_at };
    return { ...d, cron_proxima_at: proximaOcurrencia(d.cron, ahora, tz, ahora).toISOString() };
  });
}

/** Los CRON que hay que validar contra el negocio al guardar: los nuevos o distintos (ver lib/disparadores-guardar.ts). */
export function nuevosOCambiados(lista: readonly Disparador[], previos: readonly Disparador[]): Disparador[] {
  const firmas = new Set(previos.map(firmaDisparador));
  return lista.filter((d) => !firmas.has(firmaDisparador(d)));
}

// ── Qué es cada uno ─────────────────────────────────────────────────────────────────────────────

/** La clase de las seis (o `mako`) que tiene un `trigger_tipo`, sin mirar el horario. null = ninguna. */
function claseDelTipo(t: string): ClaseDisparador | null {
  if (DE_ETAPA.has(t)) return 'producto';
  if (t === TRIGGER_ETIQUETA || CON_IGNORAR.has(t)) return 'etiqueta';
  if (t === TRIGGER_INSTAGRAM) return 'instagram';
  if (t === TRIGGER_MESSENGER) return 'messenger';
  if (t === TRIGGER_EMAIL_RECIBIDO) return 'email';
  if (t === TRIGGER_PAGO) return 'pagos';
  if (t === TRIGGER_AVISO_MAKO) return 'mako';
  if (t === TRIGGER_SOLO_GRUPO) return 'recurrente';
  return null;
}

/**
 * ¿ES UN EVENTO DE ANTES? Un CRON que arranca por un evento del catálogo (`TRIGGERS`: «dejó el formulario
 * sin agendar», «agendó», «no asistió»…) que el panel ya no ofrece: los eventos pasaron a las condiciones
 * en la tercera tanda («Elimina lo de "Eventos" todo eso debería ir dentro del editable del CONDICIONAL»).
 * Medido el 11/10/2026: 6 de las 8 automatizaciones vivas arrancan así (docs/diseno-automations-configuraciones.md
 * §4). Con horario no cuenta: ése es un Recurrente y su «A quién» ya lo dice. Y los del EMISOR (el
 * recordatorio de la reunión) tampoco: no son de antes, son de otro motor (`TRIGGERS_DEL_EMISOR`).
 */
export function esEventoDeAntes(d: Pick<Disparador, 'trigger_tipo' | 'cron'>): boolean {
  const t = d.trigger_tipo;
  return !d.cron && !!t && t !== 'manual' && !TRIGGERS_DEL_EMISOR.has(t) && claseDelTipo(t) == null;
}

/**
 * La clase de un disparador. `null` = todavía no se eligió nada (`manual`).
 *
 * ⚠️ UN EVENTO DE ANTES ES «PRODUCTO» (décima tanda, CRON 2, 11/10/2026: «al editar el segundo paso no me
 * aparece ningún desplegable... O que no se selecciona los pasos que elegí... Nunca nada debe quedar en una
 * versión vieja»). Era `otro`: la primera pantalla no marcaba ninguna de las seis y el editor lo dibujaba como
 * un texto con «←», sin desplegable. Ahora abre el de Producto con lo puesto en el botón, «(de antes)»
 * (`textoDeDisparador`), y elegir una etapa lo reemplaza. Lo que es de antes lo dice `esEventoDeAntes`.
 * `otro` queda para el recordatorio de la reunión (su emisor lo dice como es, sin editor) y para el ícono de
 * lo que todavía no se eligió (`iconoDeDisparador`).
 */
export function claseDeDisparador(d: Pick<Disparador, 'trigger_tipo' | 'cron'>): ClaseDisparador | 'otro' | null {
  if (d.cron) return 'recurrente';
  const t = d.trigger_tipo;
  if (t === 'manual' || !t) return null;
  return claseDelTipo(t) ?? (esEventoDeAntes(d) ? 'producto' : 'otro');
}

/** ¿Tiene una cohorte de leads? (el grupo solo y «a mano» no). */
export const tieneCohorte = (d: Pick<Disparador, 'trigger_tipo'>): boolean =>
  d.trigger_tipo !== TRIGGER_SOLO_GRUPO && d.trigger_tipo !== 'manual' && !TRIGGERS_SOLO_EVENTO.has(d.trigger_tipo);

/**
 * ¿LO MIRA EL BARRIDO HORARIO? Los que disparan sólo por su evento no tienen a quién barrer, y el grupo
 * solo no es una cohorte de leads. La regla de la etiqueta sin horario (`barridoInscribe`,
 * lib/nutricion-grafo-motor.ts) se suma a ésta en el motor: son dos puertas.
 */
export const barreElDisparador = (d: Pick<Disparador, 'trigger_tipo'>): boolean => tieneCohorte(d);

/** El disparador, en la forma que usa el desplegable de producto (lib/flujo-conversacion.ts). */
export function disparoActualDe(d: Disparador): DisparoActual {
  return {
    trigger_tipo: d.trigger_tipo, etapa: d.etapa ?? null, etapas: d.etapas ?? null,
    funnel_id: d.funnel_id ?? null, producto_id: d.producto_id ?? null, etiqueta_id: d.etiqueta_id ?? null,
  };
}

/** Lo elegido en un desplegable de los de siempre (`disparoDeValor`), puesto en ESTE disparador. */
export function conDisparo(d: Disparador, a: DisparoActual): Disparador {
  return higiene({
    ...d, trigger_tipo: a.trigger_tipo, etapa: a.etapa ?? null, etapas: a.etapas ? [...a.etapas] : null,
    funnel_id: a.funnel_id ?? null, producto_id: a.producto_id ?? null, etiqueta_id: a.etiqueta_id ?? null,
    // Cambiar QUÉ lo dispara no le saca el horario ni el grupo: son de la clase, no del tipo.
  });
}

/** Un disparador nuevo, sin elegir todavía, de una clase (lo que dibuja el editor hasta que se elige). */
export function borradorDeClase(clase: ClaseDisparador, id: string, cronPorDefecto: CronAviso): Disparador {
  if (clase === 'recurrente') return { id, trigger_tipo: 'manual', cron: cronPorDefecto, cron_proxima_at: null };
  if (esClaseDeEventos(clase)) return { id, trigger_tipo: TRIGGER_DE_CANAL[clase], subtipo: null };
  if (clase === 'etiqueta') return { id, trigger_tipo: 'manual' };
  return { id, trigger_tipo: 'manual' };
}

// ── Qué le falta ────────────────────────────────────────────────────────────────────────────────

/**
 * Lo que le falta a UN disparador para guardarse, en palabras cortas (la pantalla lo dice y la ruta lo
 * contesta 400). null = está completo. «A mano» (`manual`) sólo vale si es el ÚNICO: una
 * automatización recién creada todavía no eligió nada, y eso no es un error; un segundo CRON sin
 * elegir, sí.
 */
export function problemaDeDisparador(d: Disparador, o: { unico: boolean }): string | null {
  const t = d.trigger_tipo;
  if (d.cron) {
    if (TRIGGERS_SOLO_EVENTO.has(t)) return 'Un evento no se repite por horario';
    if ((t === 'manual' || t === TRIGGER_SOLO_GRUPO) && d.grupo !== true) return 'Elige a quién le llega';
  } else if (t === TRIGGER_SOLO_GRUPO) return 'El grupo de MaKo es para un Recurrente';
  if (t === 'manual') return d.cron || o.unico ? null : 'Elige qué lo dispara';
  if (t === TRIGGER_ETAPA && !etapasDe({ etapa: d.etapa ?? null, etapas: d.etapas ?? null }).length) return 'Elige la etapa';
  if (t === TRIGGER_ENTREGA) {
    if (!d.producto_id) return 'Elige el producto';
    if (!etapasDe({ etapa: d.etapa ?? null, etapas: d.etapas ?? null }).length) return 'Elige la etapa';
  }
  if (t === TRIGGER_ETIQUETA && !d.etiqueta_id) return 'Elige la etiqueta';
  if (CON_SUBTIPO.has(t)) {
    const ev = eventosDe(claseDeDisparador({ trigger_tipo: t, cron: null })).find((e) => e.subtipo === d.subtipo);
    if (!ev) return 'Elige el evento';
    if (ev.apagado) return 'Ese evento todavía no se puede usar';
  }
  return null;
}

/** Lo que le falta a la LISTA (vacía, de más, dos iguales, o lo de cada uno). */
export function problemaDeDisparadores(lista: readonly Disparador[]): string | null {
  if (!lista.length) return 'Falta el CRON';
  if (lista.length > TOPE_DISPARADORES) return `Hasta ${TOPE_DISPARADORES} CRON`;
  // El recordatorio y el evento de MaKo los manda SU emisor: un segundo CRON al lado lo inscribiría el motor
  // además (los mismos mensajes dos veces), o sería un CRON dibujado que nadie corre.
  if (lista.length > 1 && lista.some(esDelEmisor)) return MOTIVO_CRON_SOLO;
  const firmas = new Set<string>();
  for (const d of lista) {
    const f = firmaDisparador(d);
    if (firmas.has(f)) return 'Ese CRON ya está';
    firmas.add(f);
    const p = problemaDeDisparador(d, { unico: lista.length === 1 });
    if (p) return p;
  }
  return null;
}

/**
 * ¿SE PUEDE PASAR DE `previos` A `lista`? (11/10/2026). Un CRON del EMISOR (`TRIGGERS_DEL_EMISOR`) es la
 * identidad de la fila —qué lee el emisor y qué le pide a sus tarjetas—, así que:
 *   · de uno del emisor a otro (u otro evento de MaKo), o a cualquier otra clase → «Este CRON no se cambia»;
 *   · de otra clase a uno del emisor → tampoco: la fila no nació para eso y sus tarjetas no lo saben;
 *   · de «a elegir» (`manual`, sin horario) a uno del emisor, SÍ: es pegar un flujo copiado
 *     (lib/flujo-copia-negocio.ts, que crea la fila «manual» y después guarda su CRON);
 *   · el mismo de antes (guardar sin cambiar nada), sí.
 * null = se puede. Lo llaman `guardarDisparadores` y `prepararDisparadores` (lib/disparadores-guardar.ts).
 */
export function problemaDeCambio(previos: readonly Disparador[], lista: readonly Disparador[]): string | null {
  const antes = previos.filter(esDelEmisor);
  const ahora = lista.filter(esDelEmisor);
  if (!antes.length && !ahora.length) return null;
  if (antes.length) {
    const igual = previos.length === lista.length && previos.every((d, i) => firmaDisparador(d) === firmaDisparador(lista[i]));
    return igual ? null : MOTIVO_CRON_FIJO;
  }
  const deNada = previos.every((d) => d.trigger_tipo === 'manual' && !d.cron);
  return deNada ? null : MOTIVO_CRON_FIJO;
}

// ── Cuándo dispara un evento ────────────────────────────────────────────────────────────────────

/** Los eventos de los disparadores nuevos (los de siempre los decide lib/nutricion-etapa.ts). */
export type EventoDisparador = 'etiqueta' | 'etiqueta_quitada' | 'instagram' | 'messenger' | 'email_recibido' | 'pago';

/**
 * ¿ESTE disparador arranca con ESTE evento? Es la pregunta fina del evento (la gruesa, qué
 * `trigger_tipo` mirar, la hace `TRIGGERS_POR_EVENTO` en lib/nutricion.ts).
 *
 *   · Con HORARIO, nunca: un Recurrente sale por su agenda (lib/nutricion-agenda.ts). Sin esto,
 *     «todos los lunes a las 9, a los que tienen la etiqueta X» le escribía también, en el acto, a
 *     cada uno al que le ponían X.
 *   · «Se le puso «X»»: sólo X.
 *   · «Se agrega / se elimina etiqueta a un lead»: CUALQUIERA, salvo las de `ignorar` (CRON punto 3).
 *   · Instagram / Messenger: el MISMO evento (`subtipo`). Sin subtipo en el evento, nada: un webhook
 *     que no dice qué pasó no puede caer en «entonces todos».
 *   · Email: el email recibido.
 */
export function disparaPorEvento(
  d: Pick<Disparador, 'trigger_tipo'> & Partial<Disparador>,
  evento: EventoDisparador | string,
  ctx?: { etiquetaId?: number | string | null; subtipo?: string | null } | null,
): boolean {
  if (d.cron) return false;
  const t = d.trigger_tipo;
  if (evento === 'etiqueta' || evento === 'etiqueta_quitada') {
    const id = idPositivo(ctx?.etiquetaId);
    if (id == null) return false;
    if (evento === 'etiqueta' && t === TRIGGER_ETIQUETA) return d.etiqueta_id != null && Number(d.etiqueta_id) === id;
    const tipo = evento === 'etiqueta' ? TRIGGER_ETIQUETA_AGREGADA : TRIGGER_ETIQUETA_QUITADA;
    return t === tipo && !(d.ignorar ?? []).map(Number).includes(id);
  }
  if (evento === 'instagram' || evento === 'messenger') {
    const sub = typeof ctx?.subtipo === 'string' ? ctx.subtipo : '';
    return t === (evento === 'instagram' ? TRIGGER_INSTAGRAM : TRIGGER_MESSENGER) && !!sub && d.subtipo === sub;
  }
  if (evento === 'email_recibido') return t === TRIGGER_EMAIL_RECIBIDO;
  // Pagos: el MISMO evento (`subtipo`), como Instagram. Sin subtipo, nada: un aviso de la pasarela que no
  // dice qué pasó no puede caer en «entonces todos».
  if (evento === 'pago') {
    const sub = typeof ctx?.subtipo === 'string' ? ctx.subtipo : '';
    return t === TRIGGER_PAGO && !!sub && d.subtipo === sub;
  }
  return false;
}

// ── El motor: una «vista» de la automatización por cada CRON ────────────────────────────────────

/** Lo que el motor lee de una automatización para decidir a quién inscribe (`Secuencia`, lib/nutricion.ts). */
export type SecuenciaConDisparo = {
  id: number;
  trigger_tipo: string;
  etapa: string;
  etapas: string[];
  funnel_id: number | null;
  producto_id: number | null;
  etiqueta_id: number | null;
  cron: CronAviso | null;
  cron_proxima_at: string | null;
  /** La lista ya armada (`disparadoresDe`). Ausente = la de UNO, de las columnas. */
  disparadores?: Disparador[];
};

/** Una vista: la automatización con los campos de disparo de UNO de sus CRON, y cuál es. */
export type VistaDisparo<S> = S & { disparador: Disparador & { indice: number } };

/**
 * LA AUTOMATIZACIÓN UNA VEZ POR CADA CRON, con los campos de disparo de ese CRON puestos encima
 * (`trigger_tipo`, la etapa, el ámbito, el horario). Es lo que deja al motor preguntarle a CADA CRON
 * con las funciones de siempre —`secuenciasDeEtapa`, `secuenciasDeEtiqueta`, `leadsDeCohorte`,
 * `decidirAgenda`— sin que ninguna sepa que hay una lista. La vista del primero es la secuencia tal
 * cual (sus columnas).
 *
 * ⚠️ EL EMBUDO DE UN CRON QUE NO ES DE ADQUISICIÓN ES EL DE LA AUTOMATIZACIÓN. «Se le puso «X»» con
 * horario barre a los que la tienen DENTRO del embudo de la automatización, igual que el primero:
 * con el `funnel_id` del CRON (ausente → null = TODOS los embudos), un segundo CRON de etiqueta le
 * escribía a leads de productos ajenos.
 */
export function vistasPorDisparador<S extends SecuenciaConDisparo>(sec: S): Array<VistaDisparo<S>> {
  const lista = sec.disparadores?.length ? sec.disparadores : disparadoresDe(sec);
  return lista.map((d, indice) => ({
    ...sec,
    trigger_tipo: d.trigger_tipo,
    etapa: d.etapa ?? sec.etapa,
    etapas: d.etapas ? [...d.etapas] : [],
    funnel_id: d.trigger_tipo === TRIGGER_ETAPA ? (d.funnel_id ?? null) : sec.funnel_id,
    producto_id: d.trigger_tipo === TRIGGER_ENTREGA ? (d.producto_id ?? null) : null,
    etiqueta_id: d.trigger_tipo === TRIGGER_ETIQUETA ? (d.etiqueta_id ?? null) : null,
    cron: d.cron ?? null,
    cron_proxima_at: d.cron_proxima_at ?? null,
    disparador: { ...d, indice },
  }));
}

/**
 * UNA VEZ POR AUTOMATIZACIÓN, AUNQUE DISPAREN DOS DE SUS CRON (la primera vista gana). «Una misma
 * persona no se inscribe dos veces por dos disparadores del mismo evento»: la inscripción es única
 * por (lead, secuencia) en la base, pero el evento inscribe de a una y el segundo insert chocaba con
 * el unique y dejaba un error en el log por cada evento.
 */
export function unaPorSecuencia<T extends { id: number }>(vistas: readonly T[]): T[] {
  const vistos = new Set<number>();
  return vistas.filter((v) => (vistos.has(v.id) ? false : (vistos.add(v.id), true)));
}

/**
 * ¿ALGUNA DE ESTAS AUTOMATIZACIONES ARRANCA CON ESTE EVENTO? La MISMA pregunta que se hace al
 * inscribir (`disparaPorEvento` sobre cada CRON, `vistasPorDisparador`), así que «hay quien escuche»
 * y «a quién se inscribe» no pueden contestar distinto.
 *
 * La usa el webhook de Instagram y Messenger (lib/zernio-entrante.ts) antes de CREAR un lead: sin
 * ninguna automatización que escuche ESE evento, cada persona que comenta una publicación sería un
 * lead del CRM. ⚠️ Preguntaba por `trigger_tipo.includes(canal)` —el PRIMER CRON y cualquier evento
 * del canal—: un CRON «comenta tu publicación» creaba un lead por cada DM, y un segundo CRON de
 * Instagram no contaba.
 */
export function escuchaElEvento(
  secs: readonly SecuenciaConDisparo[],
  evento: EventoDisparador | string,
  ctx?: { etiquetaId?: number | string | null; subtipo?: string | null } | null,
): boolean {
  return secs.some((s) => vistasPorDisparador(s).some((v) => disparaPorEvento(v.disparador, evento, ctx)));
}

/**
 * ¿Tiene un Recurrente que le habla al grupo de MaKo? Lo pregunta el cron de nutrición
 * (app/api/cron/nutricion) cuando el negocio tiene los dos canales apagados: el grupo se escribe por
 * la línea de MaKo, no por la del negocio, así que ese Recurrente sale igual.
 */
export function tieneRecurrenteAlGrupo(sec: SecuenciaConDisparo): boolean {
  return vistasPorDisparador(sec).some((v) => v.cron != null && v.disparador.grupo === true);
}

// ── El Recurrente: «A quién» ─────────────────────────────────────────────────────────────────────

/** El valor de «El grupo de MaKo» en el desplegable de «A quién». */
export const VALOR_GRUPO = 'grupo:mako';

/** Lo marcado en «A quién»: el grupo y/o las etapas o la etiqueta de la cohorte. */
export function valoresQuien(d: Disparador): string[] {
  return [...(d.grupo ? [VALOR_GRUPO] : []), ...(tieneCohorte(d) ? valoresDisparo(disparoActualDe(d)) : [])];
}

/**
 * «A QUIÉN», DESPUÉS DE TOCAR UNA OPCIÓN (CRON punto 9: «eso debería poder una selección multiple...
 * Puedo seleccionar enviarlo a clientes y al grupo de MaKo al mismo tiempo»).
 *   · El grupo se prende y se apaga solo.
 *   · Una etapa o una etiqueta sigue la regla del CRON de producto (`valoresTrasTocar`: dentro de un
 *     kanban se suman, otro kanban o una etiqueta reemplazan).
 *   · Con el grupo marcado, la ÚLTIMA etapa SÍ se puede sacar (queda sólo el grupo); sin el grupo,
 *     no: un Recurrente sin nadie a quién mandarle no hace nada. Por lo mismo el grupo no se apaga si
 *     es lo único marcado.
 */
export function quienTrasTocar(d: Disparador, tocado: string): Disparador {
  const cohorte = tieneCohorte(d) ? valoresDisparo(disparoActualDe(d)) : [];
  if (tocado === VALOR_GRUPO) {
    if (d.grupo && !cohorte.length) return d;
    const grupo = !d.grupo;
    return higiene({ ...d, grupo, trigger_tipo: cohorte.length ? d.trigger_tipo : TRIGGER_SOLO_GRUPO });
  }
  if (d.grupo && cohorte.length === 1 && cohorte[0] === tocado) {
    return higiene({ id: d.id, trigger_tipo: TRIGGER_SOLO_GRUPO, cron: d.cron, cron_proxima_at: d.cron_proxima_at, grupo: true });
  }
  const valor = valorDeVarios(cohorte.length ? valoresTrasTocar(cohorte, tocado) : [tocado]);
  const nuevo = disparoDeValor(valor, disparoActualDe(d));
  if (nuevo.trigger_tipo === d.trigger_tipo && valorDisparo(nuevo) === valorDisparo(disparoActualDe(d)) && !cohorte.length) return d;
  return conDisparo({ ...d, grupo: d.grupo === true }, nuevo);
}

// ── La Etiqueta: el desplegable ─────────────────────────────────────────────────────────────────

export const VALOR_ETIQUETA_AGREGADA = 'etiqueta:agregada';
export const VALOR_ETIQUETA_QUITADA = 'etiqueta:quitada';

/** Lo puesto en el desplegable del CRON de Etiqueta. '' = nada. */
export function valorEtiqueta(d: Disparador): string {
  if (d.trigger_tipo === TRIGGER_ETIQUETA_AGREGADA) return VALOR_ETIQUETA_AGREGADA;
  if (d.trigger_tipo === TRIGGER_ETIQUETA_QUITADA) return VALOR_ETIQUETA_QUITADA;
  if (d.trigger_tipo === TRIGGER_ETIQUETA && d.etiqueta_id) return `etiqueta:${d.etiqueta_id}`;
  return '';
}

/** El disparador después de elegir en el desplegable de Etiqueta. `ignorar` sobrevive al pasar entre las dos genéricas. */
export function conValorEtiqueta(d: Disparador, valor: string): Disparador {
  const ignorar = d.ignorar ?? [];
  if (valor === VALOR_ETIQUETA_AGREGADA) return higiene({ id: d.id, trigger_tipo: TRIGGER_ETIQUETA_AGREGADA, ignorar });
  if (valor === VALOR_ETIQUETA_QUITADA) return higiene({ id: d.id, trigger_tipo: TRIGGER_ETIQUETA_QUITADA, ignorar });
  const id = idPositivo(valor.startsWith('etiqueta:') ? valor.slice('etiqueta:'.length) : null);
  if (id == null) return d;
  return higiene({ id: d.id, trigger_tipo: TRIGGER_ETIQUETA, etiqueta_id: id });
}

/** Una etiqueta más (o menos) en «Ignorar». */
export function alternarIgnorar(d: Disparador, etiquetaId: number): Disparador {
  const ya = d.ignorar ?? [];
  return higiene({ ...d, ignorar: ya.includes(etiquetaId) ? ya.filter((x) => x !== etiquetaId) : [...ya, etiquetaId] });
}

// ── Cómo se dice ────────────────────────────────────────────────────────────────────────────────

/** Los rótulos de lo que se dice de cada clase nueva (el resto lo dice `detalleDisparador`). */
export const TEXTO_ETIQUETA_AGREGADA = 'Se agrega etiqueta a un lead';
export const TEXTO_ETIQUETA_QUITADA = 'Se elimina etiqueta a un lead';
export const TEXTO_GRUPO = 'El grupo de MaKo';
export const TEXTO_SIN_ELEGIR = 'Elige qué la dispara';

export type NombresDeDisparo = {
  /** Cómo se dice un disparador de los de siempre (etapa, etiqueta, un evento de antes): `detalleDisparador`. */
  deSiempre: (d: Disparador) => string;
  /** La zona del negocio, para el horario. */
  tz?: string | null;
};

/**
 * La cohorte de un Recurrente dicha como A QUIÉN: no es «llega a» (un evento) sino los que ESTÁN:
 * «En «Agendado»», «Tienen «Cualificado»». Sale de la frase de siempre (`detalleDisparador`).
 */
export const textoCohorte = (deSiempre: string): string => deSiempre.replace(/^Llega a /, 'En ').replace(/^Se le puso /, 'Tienen ');

/** «El grupo de MaKo y En «Agendado»»: a quién le llega un Recurrente. */
export function textoQuien(d: Disparador, n: NombresDeDisparo): string {
  const partes: string[] = [];
  if (d.grupo) partes.push(TEXTO_GRUPO);
  if (tieneCohorte(d)) partes.push(textoCohorte(n.deSiempre({ ...d, cron: null })));
  return partes.join(' y ');
}

/** LO QUE DICE CADA FILA DE LA TARJETA CRON (una por disparador, la dibuja el lienzo). */
export function textoDeDisparador(d: Disparador, n: NombresDeDisparo): string {
  if (d.cron) {
    const quien = textoQuien(d, n);
    return quien ? `${textoCron(d.cron, n.tz ?? null)} · ${quien}` : textoCron(d.cron, n.tz ?? null);
  }
  const t = d.trigger_tipo;
  if (t === 'manual') return TEXTO_SIN_ELEGIR;
  if (t === TRIGGER_ETIQUETA_AGREGADA) return TEXTO_ETIQUETA_AGREGADA;
  if (t === TRIGGER_ETIQUETA_QUITADA) return TEXTO_ETIQUETA_QUITADA;
  if (CON_SUBTIPO.has(t)) {
    const ev = eventosDe(claseDeDisparador({ trigger_tipo: t, cron: null })).find((e) => e.subtipo === d.subtipo);
    return ev?.label ?? 'Elige el evento';
  }
  // Un evento de antes se dice como es y se MARCA (décima tanda, CRON 2): en la tarjeta y en el botón del
  // desplegable de Producto, que es donde se cambia. Hasta que se migre (scripts/migrar-cron-de-antes.mts).
  if (esEventoDeAntes(d)) return `${n.deSiempre(d)} ${MARCA_DE_ANTES}`;
  return n.deSiempre(d);
}

/** Lo que se le pega a un evento de antes donde se dice (la tarjeta, el botón del desplegable). */
export const MARCA_DE_ANTES = '(de antes)';

/** La clave del ícono de cada fila (la dibuja `IconoDisparador`, app/automations/IconosDisparador.tsx). */
export function iconoDeDisparador(d: Pick<Disparador, 'trigger_tipo' | 'cron'>): ClaseDisparador | 'otro' {
  return claseDeDisparador(d) ?? 'otro';
}

// ── El Recurrente al grupo de MaKo: qué sale ────────────────────────────────────────────────────

/**
 * LO QUE LE LLEGA AL GRUPO DE MAKO EN CADA OCURRENCIA DE UN RECURRENTE (CRON punto 9: «falta poder
 * enviarlo al grupo de MaKo»). Una automatización corre sobre un LEAD; el grupo no es un lead, así que
 * al grupo le llega, en UN mensaje y por la línea de MaKo (como los Mensajes de MaKo), el TEXTO de lo
 * que la automatización dice, recorriendo la salida desde el CRON:
 *   · una tarjeta WHATSAPP de texto (o «MaKo lo adapta», con su texto base) → su texto, y de un
 *     mensaje de varias partes, las partes de texto (y el pie de un archivo);
 *   · una tarjeta MAKO (`avisar_al_equipo`) → su mensaje;
 *   · un DELAY no se espera (sale todo junto): el grupo no tiene una corrida que esperar;
 *   · una CONDITION, «Si responde» o un «Ir a» CORTAN ese camino: no hay un lead sobre el cual
 *     decidir, y elegir una rama por él sería inventar;
 *   · un EMAIL, una ACTION, un audio o un archivo sin pie no salen: no tienen sentido sin el lead (o no
 *     viajan en un aviso de texto).
 * Las variables del lead quedan CRUDAS (`{{lead_nombre}}`): crudo se nota, borrado deja la frase coja
 * (AGENTS.md, el catálogo de variables).
 */
export function textosParaElGrupo(pasos: readonly PasoGrafo[]): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  const recorrer = (id: string | null, profundidad: number) => {
    if (!id || vistos.has(id) || profundidad > 80) return;
    vistos.add(id);
    const i = indicePorId(pasos, id);
    if (i < 0) return;
    const p = pasos[i];
    const clase = claseDe(p);
    if (clase === 'condicion' || clase === 'respuesta' || clase === 'ir_a') return;
    if (clase === 'mensaje' && p.canal !== 'email') {
      const partes = partesExplicitas(p as Parameters<typeof partesExplicitas>[0]);
      if (partes) {
        for (const pt of partes) {
          if (pt.tipo === 'texto' && pt.cuerpo.trim()) out.push(pt.cuerpo.trim());
          if (pt.tipo === 'media' && pt.cuerpo?.trim()) out.push(pt.cuerpo.trim());
        }
      } else if (p.tipo !== 'audio' && typeof p.cuerpo === 'string' && p.cuerpo.trim()) out.push(p.cuerpo.trim());
    }
    if (clase === 'accion') {
      const a = p.accion as { operacion?: unknown; params?: Record<string, unknown> } | null | undefined;
      const m = a?.operacion === OP_AVISAR && typeof a.params?.mensaje === 'string' ? a.params.mensaje.trim() : '';
      if (m) out.push(m);
    }
    for (const pu of puertosDe(pasos, i)) recorrer(pu.destino, profundidad + 1);
  };
  for (const r of raicesSalida(pasos)) recorrer(r, 0);
  return out;
}

/** El id de la tarjeta para un rastro (lo usa el motor al loguear qué salió al grupo). */
export const idsDeLaSalida = (pasos: readonly PasoGrafo[]): string[] => pasos.map((p, i) => idDe(p, i));

// ── El huso: la lista de países con sus zonas ───────────────────────────────────────────────────

/**
 * LAS ZONAS DE CADA PAÍS DE LA LISTA DEL TELÉFONO (`PAISES`, lib/paises.ts) — CRON punto 9: «que se
 * pueda poner el huso de cualquier país, con la lista de paises y banderas que ya tenemos al poner un
 * número de telefono». Un país con varias zonas las lista todas: un cliente de Tijuana y uno de
 * Cancún tienen el mismo +52 y tres horas de diferencia (la misma razón por la que `tzDeTelefono` no
 * adivina). Nombres IANA canónicos: el test los pasa por `Intl`.
 */
export const ZONAS_POR_PAIS: Readonly<Record<string, ReadonlyArray<{ tz: string; label: string }>>> = {
  MX: [
    { tz: 'America/Mexico_City', label: 'Centro (Ciudad de México)' },
    { tz: 'America/Tijuana', label: 'Pacífico (Tijuana)' },
    { tz: 'America/Hermosillo', label: 'Sonora (Hermosillo)' },
    { tz: 'America/Mazatlan', label: 'Pacífico (Mazatlán)' },
    { tz: 'America/Cancun', label: 'Sureste (Cancún)' },
  ],
  ES: [{ tz: 'Europe/Madrid', label: 'Península' }, { tz: 'Atlantic/Canary', label: 'Canarias' }],
  AR: [{ tz: 'America/Argentina/Buenos_Aires', label: 'Argentina' }],
  CO: [{ tz: 'America/Bogota', label: 'Colombia' }],
  CL: [{ tz: 'America/Santiago', label: 'Chile continental' }, { tz: 'America/Punta_Arenas', label: 'Magallanes' }, { tz: 'Pacific/Easter', label: 'Isla de Pascua' }],
  PE: [{ tz: 'America/Lima', label: 'Perú' }],
  EC: [{ tz: 'America/Guayaquil', label: 'Ecuador continental' }, { tz: 'Pacific/Galapagos', label: 'Galápagos' }],
  UY: [{ tz: 'America/Montevideo', label: 'Uruguay' }],
  PY: [{ tz: 'America/Asuncion', label: 'Paraguay' }],
  BO: [{ tz: 'America/La_Paz', label: 'Bolivia' }],
  VE: [{ tz: 'America/Caracas', label: 'Venezuela' }],
  CR: [{ tz: 'America/Costa_Rica', label: 'Costa Rica' }],
  PA: [{ tz: 'America/Panama', label: 'Panamá' }],
  GT: [{ tz: 'America/Guatemala', label: 'Guatemala' }],
  HN: [{ tz: 'America/Tegucigalpa', label: 'Honduras' }],
  SV: [{ tz: 'America/El_Salvador', label: 'El Salvador' }],
  NI: [{ tz: 'America/Managua', label: 'Nicaragua' }],
  DO: [{ tz: 'America/Santo_Domingo', label: 'República Dominicana' }],
  PR: [{ tz: 'America/Puerto_Rico', label: 'Puerto Rico' }],
  CU: [{ tz: 'America/Havana', label: 'Cuba' }],
  BR: [
    { tz: 'America/Sao_Paulo', label: 'Brasilia (São Paulo)' }, { tz: 'America/Manaus', label: 'Amazonas (Manaos)' },
    { tz: 'America/Cuiaba', label: 'Mato Grosso (Cuiabá)' }, { tz: 'America/Rio_Branco', label: 'Acre' }, { tz: 'America/Noronha', label: 'Fernando de Noronha' },
  ],
  US: [
    { tz: 'America/New_York', label: 'Este (Nueva York)' }, { tz: 'America/Chicago', label: 'Centro (Chicago)' },
    { tz: 'America/Denver', label: 'Montaña (Denver)' }, { tz: 'America/Phoenix', label: 'Arizona' },
    { tz: 'America/Los_Angeles', label: 'Pacífico (Los Ángeles)' }, { tz: 'America/Anchorage', label: 'Alaska' }, { tz: 'Pacific/Honolulu', label: 'Hawái' },
  ],
  CA: [
    { tz: 'America/Toronto', label: 'Este (Toronto)' }, { tz: 'America/Winnipeg', label: 'Centro (Winnipeg)' },
    { tz: 'America/Edmonton', label: 'Montaña (Edmonton)' }, { tz: 'America/Vancouver', label: 'Pacífico (Vancouver)' },
    { tz: 'America/Halifax', label: 'Atlántico (Halifax)' }, { tz: 'America/St_Johns', label: 'Terranova' },
  ],
  GB: [{ tz: 'Europe/London', label: 'Reino Unido' }],
  FR: [{ tz: 'Europe/Paris', label: 'Francia' }],
  DE: [{ tz: 'Europe/Berlin', label: 'Alemania' }],
  IT: [{ tz: 'Europe/Rome', label: 'Italia' }],
  PT: [{ tz: 'Europe/Lisbon', label: 'Portugal continental' }, { tz: 'Atlantic/Azores', label: 'Azores' }],
  NL: [{ tz: 'Europe/Amsterdam', label: 'Países Bajos' }],
  CH: [{ tz: 'Europe/Zurich', label: 'Suiza' }],
  IE: [{ tz: 'Europe/Dublin', label: 'Irlanda' }],
  IN: [{ tz: 'Asia/Kolkata', label: 'India' }],
  AU: [
    { tz: 'Australia/Sydney', label: 'Este (Sídney)' }, { tz: 'Australia/Brisbane', label: 'Queensland' },
    { tz: 'Australia/Adelaide', label: 'Centro (Adelaida)' }, { tz: 'Australia/Darwin', label: 'Norte (Darwin)' }, { tz: 'Australia/Perth', label: 'Oeste (Perth)' },
  ],
  AE: [{ tz: 'Asia/Dubai', label: 'Emiratos' }],
};

/** El país de una zona, o null si no está en la lista (se muestra la zona tal cual). */
export function paisDeZona(tz: string | null | undefined): string | null {
  if (!tz) return null;
  for (const [pais, zonas] of Object.entries(ZONAS_POR_PAIS)) if (zonas.some((z) => z.tz === tz)) return pais;
  // Alias que `Intl` devuelve en algunos motores.
  if (tz === 'America/Buenos_Aires') return 'AR';
  return null;
}

/** Las zonas de un país (vacío si no está). */
export const zonasDelPais = (iso2: string): ReadonlyArray<{ tz: string; label: string }> => ZONAS_POR_PAIS[iso2] ?? [];
