// =============================================================================
// El chat de MaKo en el teléfono: las reglas PURAS del turno
// =============================================================================
// Lo que decide el turno de la app (lib/mako-turno-app.ts) sin tocar la base: qué
// herramientas viajan, de quién es una sesión, cómo se arma la tarjeta de una acción
// que espera confirmación y qué links escribe el código. Vive aparte para que los
// tests lo importen: el turno tiene `server-only`.
//
// ⚠️ SIN `server-only`, PERO NO ES APTO PARA EL NAVEGADOR: importa el registro de la API
// (lib/api-mako/registro.ts, ~400 descripciones). La pantalla importa de acá SÓLO TIPOS
// (`import type`); los valores que necesita (topes, `accept`) están en lib/mako-adjuntos.ts.
// tests/api-mako-registro.test.ts frena un `'use client'` que importe un valor del registro.
// =============================================================================

import { herramientasDelTurno, type EntradaTurno, type Turno } from './doer-herramientas';
import { porId, visible, REGISTRO, type Vista } from './api-mako/registro';
import { canalKeyDe } from './api-mako/canal';
import { esAccion } from './api-mako/tipos';
import { rutaMovil } from './movil-rutas';
import { consecuenciaDeshacer, lineasDelPayload, type LineaDetalle } from './inbox-movil-reglas';
import type { Pendiente } from './mako-pendientes';
import type { FilaPendiente } from '../app/mako/pendientes/BandejaPendientes';

// ── De quién es una sesión ────────────────────────────────────────────────────

/** Las sesiones del chat del teléfono viven en `chart_sessions` (por workspace) con este
 *  prefijo en `chart_key`. El resto de la clave es la PERSONA: un closer no ve ni abre
 *  los chats del dueño, aunque compartan workspace. */
export const PREFIJO_CHART_MOVIL = 'mako-movil:';

/**
 * La `chart_key` de las sesiones de UNA persona. Con fila en `usuarios` (sub numérico) va
 * por su id, que no cambia si cambia el email; sin fila (la sesión de desarrollo, la
 * contraseña maestra) va por el email o por el sub. null = no hay a quién atarla.
 */
export function chartKeyDePersona(p: { sub?: string | null; email?: string | null }): string | null {
  const sub = String(p.sub ?? '').trim();
  if (/^\d+$/.test(sub)) return `${PREFIJO_CHART_MOVIL}u${sub}`;
  const email = String(p.email ?? '').trim().toLowerCase();
  if (email) return `${PREFIJO_CHART_MOVIL}${email}`;
  if (sub) return `${PREFIJO_CHART_MOVIL}${sub}`;
  return null;
}

/**
 * La clave de scope de las pendientes de UNA sesión: `app:<sesión>` (docs/api-mako-diseno.md
 * §3, lib/api-mako/tipos.ts `Ctx.canalKey`). ⚠️ NUNCA `app:ws<N>`: con la clave por
 * workspace todas las sesiones y todas las personas compartían la cola, y el «confirmar»
 * de un closer alcanzaba lo que propuso el dueño en otro chat.
 */
export function canalKeyDeSesion(sessionId: number): string {
  if (!Number.isInteger(sessionId) || sessionId <= 0) throw new Error(`sesión inválida: ${String(sessionId)}`);
  return canalKeyDe('app', sessionId);
}

// ── Qué herramientas viajan ───────────────────────────────────────────────────

/** Confirmar la da una PERSONA tocando la tarjeta del hilo, nunca el modelo: en este
 *  chat no hay un «sí» escrito que interpretar. */
const CONFIRMAR: ReadonlySet<string> = new Set(['confirmar_accion']);

/**
 * Las LECTURAS de la agenda de Google no viajan: la agenda no pasa por ninguna IA
 * (lib/agenda-sin-ia.ts). Las ACCIONES de agenda (proponer_agendar_agenda y las de mover,
 * cambiar y cancelar) sí: el modelo pasa lo que dijo la persona, el runner lee la agenda y
 * le devuelve sólo un estado armado por código, lo de la agenda va a la persona por
 * `paraLaPersona` (que el turno de la app NO guarda en el historial ni usa para el título)
 * y el `resumen` de la pendiente —lo que dice la tarjeta— lo arma `agenda-sin-ia`.
 */
const LECTURAS_DE_AGENDA: readonly string[] = REGISTRO
  .filter((d) => d.tipo === 'lectura' && d.datosDeGoogle)
  .flatMap((d) => [d.id, ...(d.alias ?? [])]);

/** ¿Esta herramienta NUNCA viaja en el chat del teléfono? */
export function fueraDelChat(nombre: string): boolean {
  if (CONFIRMAR.has(nombre)) return true;
  const d = porId(nombre);
  if (!d) return false;
  if (CONFIRMAR.has(d.id)) return true;
  return d.tipo === 'lectura' && !!d.datosDeGoogle;
}

/**
 * ¿Esta persona puede usarla por el chat? Sólo lo que tiene gemela en el registro y es
 * VISIBLE para su vista (canal `app`, su rol, la capa del workspace): así un closer no
 * recibe `metricas_negocio` ni una acción con `rolMinimo: 'admin'`, que el chat de
 * escritorio sí le pasa (MAKO_TOOLS sin filtrar, app/api/mako-doer/route.ts). Sin gemela no
 * hay gating que aplicar: no viaja (medido el 11/10/2026: las 25 de siempre la tienen).
 */
export function entraAlChat(nombre: string, vista: Vista): boolean {
  if (fueraDelChat(nombre)) return false;
  const d = porId(nombre);
  return !!d && visible(d, vista);
}

/**
 * Las herramientas de UN turno del chat del teléfono. La MISMA decisión que el doer de
 * WhatsApp (`herramientasDelTurno`, sobre el veredicto de `clasificarIntencion`) con dos
 * cortes encima: lo que esta persona no puede usar y lo que nunca viaja por acá.
 *
 * ⚠️ Los nombres que nunca viajan entran a `deSiempre` como CENTINELAS: `herramientasDelTurno`
 * saca del presupuesto del registro (12.000 caracteres) todo lo que ya trae `deSiempre`, y
 * sin esto las lecturas de agenda se comían presupuesto antes de que el filtro de abajo
 * las sacara. El que GARANTIZA es el filtro de la salida; los centinelas sólo ahorran.
 */
export function herramientasDelChat<T extends { name: string }>(p: EntradaTurno<T>): Turno<T> {
  const propias = p.deSiempre.filter((t) => entraAlChat(t.name, p.vista));
  const centinelas = [...CONFIRMAR, ...LECTURAS_DE_AGENDA].map((name) => ({ name, description: '', input_schema: {} }) as unknown as T);
  const turno = herramientasDelTurno({ ...p, deSiempre: [...propias, ...centinelas] });
  return {
    ...turno,
    tools: turno.tools.filter((t) => entraAlChat(t.name, p.vista)),
    delRegistro: turno.delRegistro.filter((t) => entraAlChat(t.name, p.vista)),
  };
}

// ── La tarjeta de una acción que espera confirmación ──────────────────────────

/** Lo que la pantalla dibuja como «Aprobación pendiente» debajo del mensaje de MaKo
 *  (app/m/_ui/TarjetaDecision.tsx + el sheet que muestra el detalle). Todo armado por
 *  CÓDIGO y con LAS MISMAS piezas que la fila del Inbox del teléfono (lib/inbox-movil.ts,
 *  `pendienteADecision`): la fila de la bandeja (`aFila`, lib/bandeja-filas.ts), la
 *  consecuencia (`consecuenciaDeshacer`) y el detalle (`lineasDelPayload`). La misma
 *  pendiente no puede decir una cosa en el chat y otra en Inbox. */
export type TarjetaPendiente = {
  pendienteId: number;
  /** el nombre humano de la operación («Agregar una nota a un lead») */
  titulo: string;
  /** qué se va a hacer, con los nombres reales: lo dejó `preparar()` (o el constructor de
   *  lib/agenda-sin-ia.ts, que lo arma sin nada de la agenda) */
  resumen: string;
  /** «No se puede deshacer» / «Se puede deshacer», en prosa; null = no se sabe. La de lo
   *  irreversible va pegada al botón ANTES del toque. */
  consecuencia: string | null;
  /** ⚠️ TÉCNICO (nombra tablas y endpoints): para el detalle, nunca para la tarjeta */
  escribe: string | null;
  /** true se deshace, false NO se deshace, null no se sabe */
  deshacer: boolean | null;
  /** ISO: a las dos horas vence sola */
  venceAt: string;
  /** «16 sep, 18:40 (en 42 min)», en la zona del negocio */
  vence: string;
  /** lo que se va a ejecutar, legible: el sheet lo muestra antes del botón */
  detalle: LineaDetalle[];
};

/** La tarjeta de una pendiente a partir de SU FILA de la bandeja (`aFila`, server-only:
 *  la llama lib/mako-turno-app.ts). Acá no se resuelve nada que la fila ya resolvió. */
export function tarjetaDePendiente(
  p: Pick<Pendiente, 'id' | 'tipo' | 'venceAt'>,
  f: Pick<FilaPendiente, 'resumen' | 'operacion' | 'escribe' | 'reversible' | 'vence' | 'payload'>,
): TarjetaPendiente {
  const def = porId(p.tipo);
  return {
    pendienteId: p.id,
    titulo: f.operacion,
    resumen: f.resumen,
    consecuencia: consecuenciaDeshacer(f.reversible) ?? null,
    escribe: f.escribe,
    deshacer: f.reversible,
    venceAt: p.venceAt,
    vence: f.vence,
    detalle: lineasDelPayload(f.payload, def && esAccion(def) ? def.parametros : null),
  };
}

// ── Los links que escribe el código ───────────────────────────────────────────

/** Una propuesta de PANTALLA que dejó una acción en este turno (un borrador del plan, la
 *  ficha de un lead, el formulario genérico). En el teléfono se revisa en Inbox. */
export type LinkCapturado = { clase: 'borrador' | 'lead' | 'accion'; url: string; operacion: string; nombre?: string; tareas?: number };

const jsonDe = (out: unknown): Record<string, unknown> | null => {
  if (typeof out !== 'string') return null;
  try { const j = JSON.parse(out); return j && typeof j === 'object' ? j as Record<string, unknown> : null; } catch { return null; }
};

/**
 * Los links que devolvió una ACCIÓN, sacados de su salida y nunca del texto del modelo: el
 * id son 17 caracteres al azar y un modelo los copia mal (AGENTS.md, «Un link que lee un
 * modelo lo escribe el código»). La misma captura que el doer de WhatsApp
 * (lib/mako-doer-in.ts, `runTool`): una LECTURA que devuelva un link así no cuenta.
 */
export function linksDeUnaAccion(nombre: string, input: Record<string, unknown>, out: unknown): LinkCapturado[] {
  if (porId(nombre)?.tipo === 'lectura') return [];
  if (typeof out !== 'string' || !out.includes('/revisar/')) return [];
  const j = jsonDe(out);
  if (!j) return [];
  const res: LinkCapturado[] = [];
  const url = typeof j.url === 'string' ? j.url : null;
  const link = typeof j.link === 'string' ? j.link : null;
  if (url && url.includes('/mako/revisar/')) res.push({ clase: 'accion', url, operacion: nombre });
  if (link && link.includes('/plan/revisar/')) {
    const dadas = (input as { tareas?: unknown }).tareas;
    res.push({ clase: 'borrador', url: link, operacion: nombre, ...(Array.isArray(dadas) ? { tareas: dadas.length } : {}) });
  }
  if (url && url.includes('/crm/revisar/')) {
    res.push({ clase: 'lead', url, operacion: nombre, nombre: String((input as { nombre?: unknown }).nombre ?? '').trim() });
  }
  return res;
}

/** La ruta de escritorio de un link, sin dominio ni query: el `?ws=` lo pone quien navega
 *  (`linkApp`, `conWs`), y con la query pegada el id no existe. */
export function rutaDeEscritorio(url: string): string {
  try {
    if (/^https?:\/\//i.test(url)) return new URL(url).pathname;
  } catch { /* cae al corte de abajo */ }
  return url.split(/[?#]/)[0];
}

export type PropuestaPantalla = {
  clase: LinkCapturado['clase'];
  titulo: string;
  /** dónde se revisa en el teléfono (hoy, siempre /m/inbox) */
  href: string;
  /** la pantalla de escritorio, para «Abrir en la computadora» (sin el `?ws=`) */
  escritorio: string;
};

export function propuestaDePantalla(l: LinkCapturado): PropuestaPantalla {
  const escritorio = rutaDeEscritorio(l.url);
  const titulo = l.clase === 'borrador' ? 'Borrador del plan'
    : l.clase === 'lead' ? (l.nombre ? `Ficha de ${l.nombre}` : 'Ficha nueva del CRM')
    : (porId(l.operacion)?.titulo ?? 'Propuesta para revisar');
  return { clase: l.clase, titulo, href: rutaMovil(escritorio) ?? '/m/inbox', escritorio };
}

/** Un link a una pantalla de revisión o a la bandeja, con o sin dominio y query. */
const LINK_DE_REVISION = /(?:https?:\/\/[^\s<>()]*)?\/(?:(?:plan|crm|mako)\/revisar\/[A-Za-z0-9_-]+|mako\/pendientes)(?:\?[^\s<>()]*)?/g;
/** La misma sin `g`: un `.test()` con `g` avanza `lastIndex` y la línea siguiente arranca corrida. */
const HAY_LINK_DE_REVISION = new RegExp(LINK_DE_REVISION.source);

/**
 * El texto del modelo sin links a pantallas de revisión: en el teléfono la propuesta es
 * una fila que arma el código, y un link escrito por el modelo es un id al azar copiado
 * (o inventado) que abre la pantalla de escritorio. Lo que queda colgando al final de la
 * línea («aquí:», «→») se va con el link.
 */
export function sinLinksDeRevision(texto: string): string {
  return (texto ?? '')
    .split('\n')
    .map((l) => {
      if (!HAY_LINK_DE_REVISION.test(l)) return l;
      return l.replace(LINK_DE_REVISION, '').replace(/\s*(?:aqu[ií]|ac[aá])?\s*[:→👇\-–]*\s*$/u, '').replace(/[ \t]{2,}/g, ' ').trimEnd();
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Lo que el modelo tiene que decir después de dejar una pendiente, en ESTE chat. */
export const INSTRUCCION_TARJETA = 'Di en una línea qué vas a hacer y que lo confirme tocando la tarjeta de abajo. No pidas un «sí»: aquí no confirma escribiendo.';

/**
 * La salida de una acción que dejó una pendiente trae la `instruccion` de WhatsApp («pide
 * que confirmen con un «sí»», lib/api-mako/ejecutar.ts) y le gana al system: medido el
 * 11/10/2026, con el CANAL_APP diciendo «tocando la tarjeta», el modelo contestó «Confirma
 * con un «sí» para que quede registrada». Acá se reemplaza por la de la tarjeta. Lo que no
 * es una pendiente pasa intacto (el mismo objeto).
 */
export function conInstruccionDeTarjeta<T>(out: T): T {
  if (typeof out !== 'string' || !out.includes('"pendiente_id"')) return out;
  const j = jsonDe(out);
  if (!j || j.pendiente_id == null || !('instruccion' in j)) return out;
  return JSON.stringify({ ...j, instruccion: INSTRUCCION_TARJETA }) as T;
}

/** Lo que dice MaKo cuando una acción dejó un borrador del plan: el estado de un dato no
 *  depende de cómo le salió la frase al modelo (lib/respuesta-doer.ts, `mensajeBorrador`).
 *  Sin link: en el teléfono la fila de abajo lleva a Inbox. */
export const MENSAJE_BORRADOR_APP = 'Listo, te armé el borrador. Todavía no está cargado: revísalo y confírmalo en Inbox.';

/** Lo mismo para la ficha de un lead: NO está en el CRM hasta que alguien la confirma. */
export function mensajeLeadApp(nombre: string | null | undefined): string {
  const quien = (nombre ?? '').trim();
  return `Preparé la ficha${quien ? ` de ${quien}` : ''} para el CRM. Todavía no está cargada: revísala y confírmala en Inbox.`;
}

/** Lo que queda en el hilo cuando la acción quedó lista y el modelo no escribió nada. */
export const TEXTO_SOLO_TARJETA = 'Te lo dejé listo para que lo confirmes.';

// ── El historial que vuelve al modelo ─────────────────────────────────────────

export type MensajeChat = { role: 'user' | 'assistant'; content: string; created_at?: string };

/** Los últimos `max` mensajes, arrancando en `user` y sin dos seguidos del mismo rol (un
 *  turno que falló deja el mensaje de la persona sin respuesta, y eso no se borra). */
export function historialParaModelo(msgs: readonly MensajeChat[], max = 12): Array<{ role: 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of msgs.slice(-max)) {
    if (!out.length && m.role !== 'user') continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) prev.content = `${prev.content}\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  return out;
}

/** «sábado, 11 de octubre de 2026, 20:45», en la zona que se pase. */
export function hoyLegible(tz: string, ahora = new Date()): string {
  try {
    return ahora.toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
  } catch {
    return ahora.toISOString();
  }
}

// ── Lo que contesta el backend (la pantalla importa estos TIPOS) ─────────────

export type SesionChat = { id: number; titulo: string | null; pinned: boolean; updatedAt: string };

export type RespuestaTurno = {
  /** false = MaKo no pudo contestar; el mensaje de la persona igual quedó guardado */
  ok: boolean;
  sesion: SesionChat;
  /** lo que este turno GUARDÓ en el hilo: el mensaje de la persona y, si hubo, el de MaKo */
  mensajes: MensajeChat[];
  /** cartel de la PLATAFORMA (no pude, no pude leer el archivo): se muestra y NO se guarda */
  aviso: string | null;
  /** lo que escribió el CÓDIGO para la persona (la agenda de Google): se muestra y NO se guarda */
  paraLaPersona: string[];
  /** las acciones que MaKo dejó esperando en ESTE turno: una tarjeta por cada una */
  propuestas: TarjetaPendiente[];
  /** lo que se revisa en una pantalla (borrador, ficha, formulario): una fila a Inbox */
  pantallas: PropuestaPantalla[];
};

/**
 * Los rechazos de `confirmarPendiente` / `cancelarPendiente` (lib/api-mako/acciones.ts)
 * están escritos para el MODELO de WhatsApp («NO la confirmes tú», «confírmala en el link»).
 * En la tarjeta los lee una persona y van a un toast: 3-4 palabras (AGENTS.md, «La pantalla
 * dice QUÉ pasó»). Sólo los que salen ANTES de ejecutar: el resultado de algo que se ejecutó
 * y falló pasa tal cual, porque es lo que pasó. Lo que no se reconoce también pasa tal cual.
 * ⚠️ Se reconocen por su TEXTO: tests/mako-turno-app.test.ts frena si cambia en el origen.
 */
export const ERRORES_DE_TARJETA: ReadonlyArray<readonly [RegExp, string]> = [
  [/^No hay ninguna acción pendiente vigente|^No encuentro la acción #\d+ vigente/, 'Ya no está vigente'],
  [/^Esa acción ya (?:estaba resuelta|se estaba ejecutando o ya venció)/, 'Ya se resolvió'],
  [/^Esta acción no está disponible para tu usuario/, 'Solo la confirma un admin'],
  [/^Esta acción se confirma en su pantalla de revisión/, 'Se revisa en Inbox'],
  [/^La acción «[^»]*» ya no existe en MaKo/, 'Esa acción ya no existe'],
];

export function errorCortoDeTarjeta(error: string | null | undefined): string {
  const e = (error ?? '').trim();
  if (!e) return 'No se pudo';
  for (const [re, corto] of ERRORES_DE_TARJETA) if (re.test(e)) return corto;
  return e;
}

/** Lo que devuelven confirmarEnChatAction / cancelarEnChatAction (app/m/mako/acciones.ts). */
export type ResultadoTarjeta =
  | { ok: true; resumen: string; paraLaPersona: string[] }
  /** `ejecutada: true` = se ejecutó y falló: la pendiente quedó cerrada, no se reintenta */
  | { ok: false; error: string; ejecutada?: true; paraLaPersona?: string[] };
