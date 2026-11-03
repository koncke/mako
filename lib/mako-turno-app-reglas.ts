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
import { esDestructiva, lecturasDeLasAcciones, INSTRUCCION_QUITAR_SIN_OBJETO } from './relevancia-app';
import { pideQuitar } from './mako-intencion-app';
import { canalKeyDe } from './api-mako/canal';
import { AREA_INFO, esAccion, type Parametro } from './api-mako/tipos';
import { rutaMovil, TITULO_INBOX } from './movil-rutas';
import { consecuenciaDeshacer, lineasDelPayload, type LineaDetalle } from './inbox-movil-reglas';
import type { Pendiente } from './mako-pendientes';
import type { FilaPendiente } from '../app/mako/pendientes/BandejaPendientes';
import type { AdjuntoVisible } from './chat-mako-bloques';
import { rutaInterna, type Abrir, type Bloque } from './chat-bloques';
import { APP_BASE_URL } from './app-url';
import { motivoCorto } from './su-clave-reglas';

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

/** Confirmar y cancelar las da una PERSONA tocando la tarjeta del hilo, nunca el modelo: en este
 *  chat no hay un «sí» escrito que interpretar. ⚠️ `cancelar_accion` es la ÚNICA operación del
 *  registro que cambia algo sin dejar una tarjeta (un control, no una acción): viajaba por acá y un
 *  «eso está mal» o un falso «no» le tiraba a la persona una propuesta que sí quería. La red del chat
 *  es la tarjeta —toda escritura la deja y el toque es de la persona—, así que lo que no la deja no viaja
 *  (revisión del 21/10/2026; tests/ops-center-clasificador-app.test.ts, «la red es la tarjeta»). */
const CONFIRMAR: ReadonlySet<string> = new Set(['confirmar_accion', 'cancelar_accion']);

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
  const tools = turno.tools.filter((t) => entraAlChat(t.name, p.vista));
  const delRegistro = turno.delRegistro.filter((t) => entraAlChat(t.name, p.vista));
  // Las lecturas que dan el id de lo que viaja («(de listar_landings_creadas)»): en TODO turno de la app, no sólo con `buscaEnTodo`.
  // Una acción que llega sin ellas no «llega»: MaKo inventa el id o vuelve a preguntar (medido el 21/10/2026).
  const conLectura = delRegistro.length ? lecturasDeLasAcciones(delRegistro.map((t) => t.name), p.vista, (n) => entraAlChat(n, p.vista), new Set(tools.map((t) => t.name))) : [];
  // Le piden quitar algo y no llegó ninguna operación que lo quite con lo que nombró: que pregunte cuál, no que elija una parecida.
  const sinCosa = p.veredicto.intencion === 'actuar' && pideQuitar(p.texto) && !tools.some((t) => { const d = porId(t.name); return !!d && esDestructiva(d); });
  return {
    ...turno,
    tools: [...tools, ...conLectura],
    delRegistro: [...delRegistro, ...conLectura],
    instruccion: [turno.instruccion, sinCosa ? INSTRUCCION_QUITAR_SIN_OBJETO : null].filter(Boolean).join(' ') || null,
    ofrecibles: (turno.ofrecibles ?? []).filter((n) => entraAlChat(n, p.vista)),
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
 *  ficha de un lead, el formulario genérico). En el teléfono se revisa en Avisos (/m/inbox). */
/** `editor` (la propuesta del Video Editor) y `whatsapp` (el borrador en la cola) se aceptan en SU pantalla (1.8). */
/** `nueva`: la creó ESTE turno (no es una igual que ya estaba pendiente; sin el dato, no se sabe y no se retira). `borrador`: el id del borrador de WhatsApp, que
 *  su link no lleva. Los dos, para retirarla si MaKo pregunta (`aRetirar`). */
export type LinkCapturado = { clase: 'borrador' | 'lead' | 'accion' | 'editor' | 'whatsapp'; url: string; operacion: string; nombre?: string; tareas?: number; nueva?: boolean; borrador?: number };

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
  const def = porId(nombre);
  if (def?.tipo === 'lectura') return [];
  if (typeof out !== 'string') return [];
  const j = jsonDe(out);
  if (!j) return [];
  const res: LinkCapturado[] = [];
  const url = typeof j.url === 'string' ? j.url : null;
  const link = typeof j.link === 'string' ? j.link : null;
  // Sin `nueva` (la salida vieja del borrador del plan), es nueva: esa herramienta crea siempre uno.
  const nueva = j.nueva !== false;
  // 20/10/2026 (1.8): lo que se acepta en SU pantalla tampoco quedaba con qué abrirlo. La propuesta de video
  // (`/video-editor/<p>?propuesta=<id>`) y el borrador de WhatsApp (`/whatsapp?…&chat=…`) no pasan por /revisar/.
  if (def && esAccion(def) && def.confirmacion === 'pantalla' && url) {
    if (def.pantalla === '/video-editor' && rutaDeEscritorio(url).startsWith('/video-editor/')) res.push({ clase: 'editor', url, operacion: nombre, nueva });
    if (def.pantalla === '/whatsapp' && rutaDeEscritorio(url) === '/whatsapp') {
      const borrador = typeof j.borradorId === 'number' && Number.isInteger(j.borradorId) && j.borradorId > 0 ? j.borradorId : null;
      res.push({ clase: 'whatsapp', url, operacion: nombre, nueva, ...(typeof j.para === 'string' && j.para.trim() ? { nombre: j.para.trim() } : {}), ...(borrador ? { borrador } : {}) });
    }
  }
  if (url && url.includes('/mako/revisar/')) res.push({ clase: 'accion', url, operacion: nombre, nueva });
  if (link && link.includes('/plan/revisar/')) {
    const dadas = (input as { tareas?: unknown }).tareas;
    res.push({ clase: 'borrador', url: link, operacion: nombre, nueva, ...(Array.isArray(dadas) ? { tareas: dadas.length } : {}) });
  }
  if (url && url.includes('/crm/revisar/')) {
    res.push({ clase: 'lead', url, operacion: nombre, nueva, nombre: String((input as { nombre?: unknown }).nombre ?? '').trim() });
  }
  return res;
}

/**
 * Lo que hay que retirar EN LA BASE de una propuesta de pantalla cuando MaKo pregunta en el mismo turno (1.9; revisión
 * del 21/10/2026): antes sólo se descartaba la genérica (/mako/revisar), y el borrador del plan, la ficha de lead, la
 * propuesta de video y el borrador de WhatsApp quedaban vivos en su pantalla; al contestar, MaKo armaba otro y quedaban
 * dos. null = no se toca: una que ya estaba pendiente de antes (`nueva: false`) no es de este turno.
 */
export function aRetirar(l: LinkCapturado): { clase: LinkCapturado['clase']; id: string } | null {
  if (l.nueva !== true) return null;
  const ruta = rutaDeEscritorio(l.url);
  const id = l.clase === 'accion' ? idDePropuesta(ruta)
    : l.clase === 'borrador' ? /^\/plan\/revisar\/([A-Za-z0-9_-]{1,80})$/.exec(ruta)?.[1] ?? null
    : l.clase === 'lead' ? /^\/crm\/revisar\/([A-Za-z0-9_-]{1,80})$/.exec(ruta)?.[1] ?? null
    : l.clase === 'editor' ? (() => { try { return new URL(l.url, 'https://x.invalid').searchParams.get('propuesta'); } catch { return null; } })()
    : l.borrador != null ? String(l.borrador) : null;
  return id && /^[A-Za-z0-9_-]{1,80}$/.test(id) ? { clase: l.clase, id } : null;
}

/** La ruta de escritorio de un link, sin dominio ni query: el `?ws=` lo pone quien navega
 *  (`linkApp`, `conWs`), y con la query pegada el id no existe. */
export function rutaDeEscritorio(url: string): string {
  try {
    if (/^https?:\/\//i.test(url)) return new URL(url).pathname;
  } catch { /* cae al corte de abajo */ }
  return url.split(/[?#]/)[0];
}

const HOST_APP = (() => { try { return new URL(APP_BASE_URL).host; } catch { return ''; } })();

/** La ruta CON su query (sin el `ws`, que pone quien navega): la propuesta de video es `?propuesta=<id>` y el borrador
 *  de WhatsApp es `?chat=<jid>`; sin la query abren otra cosa. Sólo de la app: un link de afuera da null. */
export function rutaConQuery(url: string): string | null {
  let u: URL;
  try { u = new URL(url, 'http://app.local'); } catch { return null; }
  if (/^https?:\/\//i.test(url) && u.host !== HOST_APP) return null;
  u.searchParams.delete('ws');
  const q = u.searchParams.toString();
  return rutaInterna(`${u.pathname}${q ? `?${q}` : ''}`);
}

export type PropuestaPantalla = {
  clase: LinkCapturado['clase'];
  titulo: string;
  /** dónde se revisa en el teléfono (/m/inbox, o la pantalla misma si el teléfono no tiene una) */
  href: string;
  /** la pantalla de escritorio, para «Abrir en la computadora» (sin el `?ws=`; con su query si la necesita) */
  escritorio: string;
  /** el botón («Abrir en el editor», «Abrir en Chats», «Abrir para revisar») y la línea de debajo del título */
  boton: string;
  nota: string;
  /** El MISMO formulario de /mako/revisar, para confirmar ADENTRO del chat (1.10). Sólo una propuesta genérica pendiente
   *  que no mueve plata (eso espera a la D2); sin esto, el botón lleva a la pantalla. */
  form?: FormularioPropuesta;
};

/** Lo que el chat necesita para desplegar el formulario de una propuesta (los datos PLANOS de RevisarAccion.tsx). */
export type FormularioPropuesta = {
  propuestaId: string;
  operacion: { id: string; titulo: string; descripcion: string; escribe: string; reversible: boolean; parametros: Parametro[] };
  /** el input validado que quedó guardado al proponer */
  payload: Record<string, unknown>;
  /** sólo el admin del negocio confirma (ctxDeBandeja) */
  puedeDecidir: boolean;
};

/** El id de una propuesta genérica en su ruta (`/mako/revisar/<id>`), o null. */
export function idDePropuesta(escritorio: string): string | null {
  const m = /^\/mako\/revisar\/([A-Za-z0-9_-]{1,80})$/.exec(escritorio.split(/[?#]/)[0]);
  return m ? m[1] : null;
}

export function propuestaDePantalla(l: LinkCapturado): PropuestaPantalla {
  // La propuesta de video y el borrador de WhatsApp se abren EN su pantalla: con la query (la propuesta, la conversación).
  if (l.clase === 'editor' || l.clase === 'whatsapp') {
    const escritorio = rutaConQuery(l.url) ?? rutaDeEscritorio(l.url);
    const editor = l.clase === 'editor';
    return {
      clase: l.clase, escritorio, href: rutaMovil(rutaDeEscritorio(escritorio)) ?? escritorio,
      titulo: editor ? (porId(l.operacion)?.titulo ?? 'Propuesta de edición') : l.nombre ? `Borrador para ${l.nombre}` : 'Borrador de WhatsApp',
      boton: editor ? 'Abrir en el editor' : 'Abrir en Chats',
      nota: editor ? 'Se acepta en el editor.' : 'No se mandó nada: lo mandas desde Chats.',
    };
  }
  const escritorio = rutaDeEscritorio(l.url);
  const titulo = l.clase === 'borrador' ? 'Borrador del plan'
    : l.clase === 'lead' ? (l.nombre ? `Ficha de ${l.nombre}` : 'Ficha nueva del CRM')
    : (porId(l.operacion)?.titulo ?? 'Propuesta para revisar');
  return { clase: l.clase, titulo, href: rutaMovil(escritorio) ?? '/m/inbox', escritorio, boton: 'Abrir para revisar', nota: 'Se revisa y se confirma en su pantalla.' };
}

/**
 * El «Abrir en <tab>» de una tarjeta confirmada (1.8): del link que devolvió la acción (`datos.link` o `datos.url`, que
 * arma el runner con `linkApp`), nunca del texto del modelo. null = no devolvió un link de la app.
 */
export function abrirDeResultado(operacion: string | undefined, datos: Record<string, unknown> | undefined): Abrir | null {
  const crudo = typeof datos?.link === 'string' ? datos.link : typeof datos?.url === 'string' ? datos.url : null;
  const href = crudo ? rutaConQuery(crudo) : null;
  if (!href) return null;
  const def = operacion ? porId(operacion) : undefined;
  return { titulo: def ? `Abrir en ${AREA_INFO[def.area].tab}` : 'Abrir', href };
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
 *  Sin link: lo que se revisa va ABAJO del mensaje, en el teléfono como una fila que lleva a
 *  Inbox y en la ficha de escritorio (MaKo Analyst) como «Abrir para revisar».
 *  ⚠️ «confírmalo en Inbox» salía también en la ficha de escritorio, donde Inbox no existe
 *  (13/10/2026): «abajo» es verdad en las dos. */
export const MENSAJE_BORRADOR_APP = 'Listo, te armé el borrador. Todavía no está cargado: revísalo y confírmalo abajo.';

/** Lo mismo para la ficha de un lead: NO está en el CRM hasta que alguien la confirma. */
export function mensajeLeadApp(nombre: string | null | undefined): string {
  const quien = (nombre ?? '').trim();
  return `Preparé la ficha${quien ? ` de ${quien}` : ''} para el CRM. Todavía no está cargada: revísala y confírmala abajo.`;
}

/** Lo que queda en el hilo cuando la acción quedó lista y el modelo no escribió nada. */
export const TEXTO_SOLO_TARJETA = 'Te lo dejé listo para que lo confirmes.';
/** Lo que queda cuando una herramienta dibujó algo (un gráfico, un antes y después) y el modelo no escribió nada. */
export const TEXTO_SOLO_BLOQUE = 'Aquí lo tienes.';

// ── El historial que vuelve al modelo ─────────────────────────────────────────

export type MensajeChat = {
  role: 'user' | 'assistant'; content: string; created_at?: string;
  /** Los archivos guardados del mensaje (mig 0305, lib/chat-mako-bloques.ts): sin el path; no van al modelo. */
  adjuntos?: AdjuntoVisible[];
  /** Lo que el chat dibuja con el mensaje (lo creado, el antes y el después: lib/chat-bloques.ts); no va al modelo. */
  bloques?: Bloque[];
  /** La nota de voz con la que la persona contestó (21/10/2026, Florencia, ws21: el Ops Center mostraba sólo la
   *  transcripción). `url` es relativa y SIN el `?ws=`: un `<audio src>` no pasa por WsFetch, la pantalla le pone
   *  `conWs(url, useWs())`. `content` sigue siendo la transcripción (el texto secundario). No va al modelo. */
  audio?: { url: string; secs: number };
};

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

/**
 * El hilo tiene una tarjeta CONFIRMADA (el «Hecho: …» que deja `anotarEnHilo` o un trabajo largo, lib/chat-trabajos.ts)
 * DESPUÉS del último mensaje de la persona: «¿quedó agendada?» se contesta desde eso, sin correr nada (1.5). Sólo eso
 * respalda: un «Hecho:» de antes de su último pedido es de OTRA cosa (la segunda revisión: con cualquier «Hecho:» de los
 * últimos 12, «ya le mandé el WhatsApp a Juan» pasaba porque antes se había confirmado la reunión con Ana).
 */
/**
 * Lo que va con el mensaje de MaKo (sus bloques, hasta `tope`): lo que dibujaron las lecturas y, al final, la pregunta. ⚠️ LA
 * PREGUNTA NUNCA SE RECORTA (lo encontró Dashboard, 21/10/2026): con 4 dibujos, `[...dibujos, pregunta].slice(0, 4)` la
 * dejaba afuera y MaKo esperaba una respuesta que la persona no veía. Se recortan los dibujos.
 */
export function bloquesDelMensaje<B>(dibujos: readonly B[], pregunta: B | null, tope: number): B[] {
  return [...dibujos.slice(0, Math.max(0, tope - (pregunta ? 1 : 0))), ...(pregunta ? [pregunta] : [])];
}

/**
 * ¿Entra un dibujo más en el mensaje? Lo decide `dibujar` (lib/mako-turno-app.ts) ANTES de que la lectura le diga al modelo
 * «la persona ya lo ve»: recortar al final (`bloquesDelMensaje`) llega tarde. Una LECTURA deja un lugar libre para la
 * pregunta que el turno puede hacer después (`preguntar_al_usuario` va en todo turno con herramientas): con 4 gráficos y
 * una pregunta, el cuarto se recortaba después de haber leído «ya lo ve» (la tercera revisión de Dashboard, 21/10/2026).
 * Lo de una ACCIÓN llega hasta el tope: con una pregunta se retira entero.
 */
export function entraOtroDibujo(enElTurno: readonly { accion: boolean }[], accion: boolean, tope: number): boolean {
  if (enElTurno.length >= tope) return false;
  return accion || enElTurno.filter((x) => !x.accion).length < tope - 1;
}

/** Un mensaje que PIDE hacer algo (la intención de lib/mako-intencion.ts): después de él, nada lo respalda todavía. */
export const esPedido = (intencion: string): boolean => intencion === 'actuar' || intencion === 'confirmar';

export function confirmadoTrasElUltimoPedido(historial: readonly { role: string; content: string }[], esPedido: (texto: string) => boolean = () => true): boolean {
  // El último PEDIDO, no el último mensaje: un «gracias» en el medio no corta (la tercera revisión: «¿quedó agendada?»
  // después de «gracias» llevaba la nota sobre algo que sí estaba en el chat).
  const ultimo = historial.reduce((i, m, j) => (m.role === 'user' && esPedido(m.content) ? j : i), -1);
  return historial.slice(ultimo + 1).some((m) => m.role === 'assistant' && /^Hecho: /m.test(m.content));
}

/**
 * Lo que devolvió una herramienta, ¿salió bien? Un control devuelve su error como TEXTO JSON (`cancelar_accion`:
 * `{ ok: false, error }`, lib/api-mako/areas/mako.run.ts) o con «❌», y eso no es un error para el runner: no respalda nada.
 */
export function salioBien(out: unknown): boolean {
  if (out && typeof out === 'object' && (out as { isError?: unknown }).isError === true) return false;
  const t = typeof out === 'string' ? out : out && typeof out === 'object' ? String((out as { content?: unknown }).content ?? '') : '';
  if (/^\s*❌/.test(t)) return false;
  try {
    const j = JSON.parse(t) as { ok?: unknown; error?: unknown };
    if (j && typeof j === 'object' && (j.ok === false || typeof j.error === 'string')) return false;
  } catch { /* un texto: salió */ }
  return true;
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
  /**
   * La integración que le falta al NEGOCIO para que MaKo conteste (`faltaIADelNegocio`). Con esto, `aviso` lo dice MaKo
   * y va con un botón que abre ESE modal ahí mismo: para una integración jamás se sale de la tab (Martín, 14/10/2026).
   */
  conectar?: string | null;
};

// ── El negocio sin IA propia (tickets #5 y #6, 18/10/2026) ───────────────────
// Mauricio (ws1) escribió en el chat y MaKo no contestó: «responder: falló la IA (sin proveedor gratis disponible)», y la
// Ticketera lo abrió como un bug. No lo era. Desde el 16/10 una key de la plataforma copiada en la fila de un negocio no
// cuenta como suya (lib/ia-keys.ts → `sinCopiasDeLaPlataforma`), y la decisión A de Martín es que cada negocio conecte
// SU IA. Sin una propia, el turno con herramientas no tiene ninguna cuenta que probar: es configuración del negocio, se
// le dice a la persona qué hacer y no abre ticket (lib/errores-app-reglas.ts → `esDeConfiguracion`).

/** Lo que dice MaKo, corto y en palabras de la persona. Su mensaje quedó guardado, pero el turno no corrió: hay que mandarlo de
 *  nuevo. Nombra las tres IA que puede conectar (el Cerebro, 22/10/2026: «Para contestarte necesito tu IA: conectá tu Claude, GPT
 *  o Gemini»): su Gemini por clave de AI Studio también le contesta. */
// 25/10/2026: sin Gemini (Martín: «todo eso se hace con la app de escritorio de MaKo y conectado a su claude o GPT»).
export const AVISO_SIN_IA = 'Para contestarte necesito tu IA: conecta tu Claude o tu GPT y mándamelo de nuevo.';
/** El modal que abre el botón (app/m/mako/chat-ui.ts → `botonConectar`): el de las keys de IA, el mismo que manda WhatsApp
 *  (`linkKeysIA`, lib/fallo-ia-texto.ts). */
// IA9 (22/10/2026): su Claude (antes, Gemini gratis). Desde el modal se llega también a su GPT.
export const SERVICIO_IA = 'anthropic';

/** Lo que escribe la cascada cuando no tuvo NINGUNA cuenta que probar (lib/anthropic.ts, `chatClaudeTools`). */
const SIN_NINGUNA_CUENTA = /sin proveedor gratis disponible/i;

/**
 * ¿MaKo no contestó porque el negocio no tiene una IA propia? `iaPropia` = cuántas cuentas propias puede usar el turno
 * con herramientas (las de `provsDe`, sin las copias de la plataforma); `null` = no se pudo saber. Sin saberlo, sólo
 * manda el texto de la cascada: un bache de la base leído como «no tienes IA» manda a conectar algo que ya está.
 */
export function faltaIADelNegocio(fallo: string | null, iaPropia: number | null): boolean {
  if (!fallo) return false;
  return SIN_NINGUNA_CUENTA.test(fallo) || iaPropia === 0;
}

/**
 * ⚠️ AL WORKSPACE DEL ENTORNO NO SE LE PIDE QUE CONECTE SU IA (el Cerebro, 18/10/2026). Su fila es la que se copia a
 * `process.env` (lib/credenciales.ts → `esNegocioDelEntorno`; hasta el 18/10, el ws1 de Mauricio): la key que pegara pasaría a ser la
 * de la plataforma —pagaría la red de todos los negocios, o pisaría la nuestra— y su workspace seguiría sin IA propia.
 * Ahí no va el botón: va que lo resuelve el equipo, que es la verdad mientras Martín decide cómo separarlo.
 */
export const AVISO_SIN_IA_EQUIPO = 'Para contestarte necesito una IA conectada. Ya lo está resolviendo el equipo de MaKo.';

/**
 * EL PORQUÉ DE UN TURNO SIN RESPUESTA, CUANDO SE SABE, QUEDA EN EL HILO (el Cerebro, 22/10/2026, el cliente roto del ws1).
 * Mauricio escribió dos veces en su Cerebro el 18/10 y no tenía IA propia: el turno dijo «conecta tu IA» en un aviso de la
 * pantalla, que NO se guardaba. Al volver a entrar, sus dos mensajes estaban sin nada debajo y, pasados 7 min, el chat decía
 * «No te pude contestar esto» (`conSinRespuesta`), cuando sí se sabía por qué. Regla: con un porqué conocido —su computadora,
 * su clave, la PC que no se pudo leer, la falta de su IA— el turno lo GUARDA como mensaje de MaKo. Sin porqué (`null`), el
 * cartel de siempre y, al volver, «No te pude contestar esto» con «Reintentar».
 */
export function porQueSinRespuesta(p: { delaPc: string | null; deSuClave: string | null | undefined; sinIA: string | null | undefined; pcIlegible: string | null }): string | null {
  return p.delaPc ?? p.deSuClave ?? p.sinIA ?? p.pcIlegible ?? null;
}

/** Lo que dice MaKo sin IA, y si lleva el botón para conectarla. `delEntorno` = `esNegocioDelEntorno(ws)`. */
export function avisoSinIA(delEntorno: boolean, servicio: string = SERVICIO_IA): { aviso: string; conectar: string | null } {
  return delEntorno ? { aviso: AVISO_SIN_IA_EQUIPO, conectar: null } : { aviso: AVISO_SIN_IA, conectar: servicio };
}

/**
 * QUÉ IA LE ABRE «Conectar tu IA»: LA QUE EL NEGOCIO YA ELIGIÓ (20/10/2026, docs/investigacion-ops-center-19-10.md: «un
 * negocio que conectó sólo su Claude igual recibe el modal de Gemini»). Si tiene alguna guardada en su fila, se le abre
 * ésa —para arreglarla, no para pedirle otra—, en este orden: su Claude y su OpenAI primero (la decisión A de Martín:
 * cada negocio conecta la suya), después las gratis. Sin ninguna, su Claude (IA9; el mismo link que manda WhatsApp).
 */
// IA16: sin Groq: sólo escucha las notas de voz, no es una IA para el chat.
export const IA_PARA_CONECTAR = ['anthropic', 'openai', 'gemini'] as const;
/** La credencial base de cada una (lib/integraciones-catalogo.ts): la que se mira en la fila del negocio. */
export const ENV_DE_IA: Record<(typeof IA_PARA_CONECTAR)[number], string> = {
  anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY',
};
export function iaParaConectar(conFila: readonly string[], soloSuya = false): string {
  // D6b (lib/solo-su-ia.ts): con su IA, la suya: su Claude, o su OpenAI, o su Gemini (IA16, 22/10/2026: su Gemini ES su IA;
  // antes no se le ofrecía aunque la tuviera en su fila). Sin ninguna en la fila, su Claude.
  if (soloSuya) return IA_PARA_CONECTAR.find((s) => conFila.includes(s)) ?? 'anthropic';
  return IA_PARA_CONECTAR.find((s) => conFila.includes(s)) ?? SERVICIO_IA;
}

/**
 * Lo que falló en SU clave de Claude (sin crédito, revocada, sin permiso): es de su cuenta, no un bug de MaKo, y se le
 * dice con el botón de su Claude. Antes abría un ticket para el Cerebro y la persona leía «No pude contestar» (revisión del
 * 21/10/2026). El mismo criterio que lib/errores-app-reglas.ts → CONFIGURACION. Un 400 de NUESTRO pedido sí es un bug.
 */
export const falloDeSuClave = (fallo: string | null): boolean =>
  !!fallo && /tu clave de Claude: .*(credit balance|invalid x-api-key|authentication|permission|billing|\b40[13]\b)/i.test(fallo);
export const AVISO_SU_CLAVE = 'Tu clave de Claude no funcionó (sin crédito o desconectada): revísala y mándamelo de nuevo.';

/**
 * Lo mismo para SU OpenAI, con «Tu ChatGPT» elegido (revisión del 23/10/2026, al darle modelo a elegir). Hasta ahí un
 * fallo de su clave de OpenAI se leía «No pude contestar ahora», y una clave rota abría un ticket de bug para el Cerebro.
 *   · 'cuenta': sin crédito, clave inválida o sin permiso: es de su cuenta. Se le dice con el botón de su OpenAI, sin ticket.
 *   · 'sin-acceso': OpenAI dijo que su cuenta no tiene ese modelo (403): elige otro. Sin ticket.
 *   · 'no-existe': OpenAI no encontró el modelo (404). No distingue «no existe» de «no lo tenés», y los tres modelos no se
 *     midieron, así que puede ser un id nuestro mal puesto: se le dice qué hacer Y sigue el ticket.
 * Sólo lee lo que vino de SU OpenAI (`chatCheapTools(openai`): el error de otra IA no se le atribuye.
 */
export function falloDeSuOpenAI(fallo: string | null): 'cuenta' | 'sin-acceso' | 'no-existe' | null {
  if (!fallo || !/chatCheapTools\(openai/.test(fallo)) return null;
  if (/HTTP 403\b.*\bmodel\b/i.test(fallo)) return 'sin-acceso';
  if (/HTTP 404\b|model_not_found|does not exist/i.test(fallo)) return 'no-existe';
  const m = motivoCorto(fallo);
  return m === 'sin crédito' || m === 'clave inválida' || m === 'sin permiso' ? 'cuenta' : null;
}
export const AVISO_SU_OPENAI = 'Tu clave de OpenAI no funcionó (sin crédito o desconectada): revísala y mándamelo de nuevo.';
/** El modelo elegido (o el de por defecto) no está para su cuenta. Un miembro no elige modelo: elige otra IA. */
export const avisoSinElModelo = (nombre: string, admin: boolean): string => admin
  ? `Elige otro modelo en el «+» y mándamelo de nuevo: OpenAI no dejó usar ${nombre} con tu cuenta.`
  : `Elige otra IA en el «+» y mándamelo de nuevo: OpenAI no dejó usar ${nombre} con la cuenta del negocio.`;
/** A quien no conectó su computadora, en un negocio que corre con su propio Claude (D6b): dónde conectar la suya. */
export const AVISO_CONECTA_TU_PC = 'Tu negocio contesta con su propio Claude. Para que te conteste a ti, conecta tu computadora en Tu cuenta → Tus cuentas de IA.';
/** Con su propio Claude, una foto o un PDF escaneado se leen con SU OpenAI o SU Gemini (D6b): nunca con el de la plataforma. */
export const AVISO_NO_LEI_SU_IA = (nombre: string) => `No pude leer «${nombre}»: con tu propio Claude, las fotos y los PDF escaneados los leo con tu clave de Claude o de OpenAI. Escríbeme lo que dice.`;
/** Con su propio Claude y sin una clave que lea (su Claude, su OpenAI o su Gemini por clave), El Archivero no corre: se dice. */
// Desde el 3/11/2026 (ticket #44) hay otro camino que la clave: pedírselo a MaKo, y lo lee el Claude de su computadora.
export const AVISO_SIN_ARCHIVERO = 'Lo dejé en el chat, pero no se guardó solo en El Archivero (con tu propio Claude no lo leo por mi cuenta). Pídeme «súmalo al Second Brain» y lo guardo cuando digas que sí.';
/** Tiene su clave de Claude, pero la plataforma la pausó por un rato: no se le pide «tu clave», que ya la tiene. */
export const AVISO_ARCHIVERO_EN_PAUSA = 'Lo dejé en el chat, pero no en El Archivero: tu Claude está en pausa por un rato en MaKo. Mándamelo de nuevo más tarde.';

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
  [/^Esta acción se confirma en su pantalla de revisión/, `Se revisa en ${TITULO_INBOX}`],
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
  /** `bloques`: lo que el chat dibuja con el resultado, ya saneado (lib/chat-bloques.ts), para sumarlo SIN recargar */
  /** `enCurso`: lo confirmado es un trabajo largo que sigue por detrás (1.11); su avance es el G6 de `bloques` */
  | { ok: true; resumen: string; paraLaPersona: string[]; bloques?: Bloque[]; abrir?: Abrir; enCurso?: true }
  /** `ejecutada: true` = se ejecutó y falló: la pendiente quedó cerrada, no se reintenta */
  | { ok: false; error: string; ejecutada?: true; paraLaPersona?: string[] };
