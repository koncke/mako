// =============================================================================
// La Ticketera de Martín, otra vez un MAZO (22/10/2026): la lógica pura, con test
// =============================================================================
// Martín (22/10, 13:18, desde el teléfono): «La ticketera se ve horrible, mejora el diseño... Y te pedí que vuelva la
// vista de tarjetas y el desplazamiento tipo tinder... Luego si quiero elegir la vista tabla también... ver quién levantó
// el ticket con su foto de perfil, por donde lo levantó, etc...». Lo que se copió de quién: docs/hallazgos-ticketera.md.
//
// Acá vive lo que DECIDE (sin React ni base, lo importan los tests): por dónde entró un ticket y su link, lo que DICE la
// tarjeta (`leerTicket`: qué pasó, quién, qué hay que hacer, el tipo chequeado), qué hace cada gesto con cada ticket,
// cuándo cuenta un gesto, cómo se arma y se refresca el mazo, y el orden de la tabla.
//
// ⚠️ LOS GESTOS SON LAS ACCIONES QUE YA EXISTÍAN (lib/tickets-reglas.ts → DECISIONES), ninguna nueva:
//   derecha = Aprobar (un bug se ARREGLA, un pedido se HACE; una pregunta no se aprueba: se RESPONDE) ·
//   izquierda = Rechazar · arriba = Preguntar (pedirle más al cliente).
// Rechazar, Preguntar y Responder le escriben al CLIENTE, y el servidor no los acepta sin texto
// (`motivoDecisionInvalida`): el gesto sin texto abre la caja, no manda nada.

import { PRIORIDADES, TIPOS, decisionDeAprobar, type DecisionTicket, type EstadoTicket, type TipoTicket } from '@/lib/tickets-reglas';
import { tituloDe } from '@/lib/titulo-tab';
import type { FilaTicket, NotaTicket } from '@/lib/tickets-db';
import { origenDeClave } from '@/lib/chat-mako-reglas';

export type VistaBandeja = 'mazo' | 'tabla';
export const esVistaBandeja = (v: unknown): v is VistaBandeja => v === 'mazo' || v === 'tabla';

// ── Los grupos (los chips de siempre: ahora son el filtro de la tabla) ───────────────────────────────────────────────
export const GRUPOS: ReadonlyArray<{ clave: string; titulo: string; estados: readonly EstadoTicket[] }> = [
  { clave: 'decidir', titulo: 'Por decidir', estados: ['nuevo', 'esperando_decision'] },
  { clave: 'cliente', titulo: 'Esperan al cliente', estados: ['esperando_cliente'] },
  { clave: 'curso', titulo: 'En curso', estados: ['en_curso', 'arreglado'] },
  { clave: 'cerrados', titulo: 'Cerrados', estados: ['resuelto', 'rechazado', 'duplicado'] },
];
export const grupoDe = (e: EstadoTicket): string => GRUPOS.find((g) => g.estados.includes(e))?.clave ?? 'decidir';
export const enGrupo = (t: Pick<FilaTicket, 'estado'>, clave: string): boolean => grupoDe(t.estado) === clave;
/** ¿Lo decide Martín ahora? Lo que entra al mazo. */
export const porDecidir = (t: Pick<FilaTicket, 'estado'>): boolean => enGrupo(t, 'decidir');

/** En la tabla, el estado que ya dice el filtro elegido no se repite en cada fila (Martín: texto corto, sin rótulos que
 *  repiten lo obvio). Se ve lo que DIFIERE: «Nuevo» entre los por decidir, «Sin desplegar» entre los en curso. */
export function estadoObvio(e: EstadoTicket, grupo: string): boolean {
  return (grupo === 'decidir' && e === 'esperando_decision') || (grupo === 'cliente' && e === 'esperando_cliente') || (grupo === 'curso' && e === 'en_curso');
}

export const ROTULO_ESTADO: Record<EstadoTicket, string> = {
  nuevo: 'Nuevo', esperando_decision: 'Por decidir', esperando_cliente: 'Espera al cliente', en_curso: 'En curso',
  arreglado: 'Sin desplegar', resuelto: 'Resuelto', rechazado: 'Rechazado', duplicado: 'Duplicado',
};
export const tipoCorto = (t: TipoTicket): string => TIPOS.find((x) => x.clave === t)?.corto ?? t;

// ── Por dónde entró ───────────────────────────────────────────────────────────────────────────────────────────────
// El canal lo guarda el servidor (`tickets.canal`), y el detalle sale del contexto que juntó el código (`chat.donde`):
// `error-mako` / `error-navegador` / `error-servidor` (lib/errores-app-reglas.ts), `reportar-problema[-movil]`
// (app/tickets/navegador.ts) o el primer tramo de la ruta del chat de MaKo (lib/api-mako/areas/tickets.run.ts).
export type IconoOrigen = 'mako' | 'soporte' | 'whatsapp' | 'rayo' | 'api';
export type Origen = { clave: 'chat' | 'reportar' | 'whatsapp' | 'automatico' | 'api'; rotulo: string; detalle: string; icono: IconoOrigen };

export function origenDe(t: Pick<FilaTicket, 'canal' | 'contexto'>): Origen {
  const donde = t.contexto.chat?.donde ?? '';
  if (t.canal === 'sistema') {
    const detalle = donde === 'error-mako' ? 'MaKo falló en un chat' : donde === 'error-servidor' ? 'Falló el servidor' : 'Se rompió una pantalla';
    return { clave: 'automatico', rotulo: 'Automático', detalle, icono: 'rayo' };
  }
  if (t.canal === 'whatsapp') return { clave: 'whatsapp', rotulo: 'WhatsApp', detalle: 'MaKo en WhatsApp', icono: 'whatsapp' };
  if (t.canal === 'formulario') {
    return { clave: 'reportar', rotulo: 'Reportar problema', detalle: donde.endsWith('-movil') ? 'Desde el teléfono' : 'Desde la computadora', icono: 'soporte' };
  }
  if (t.canal === 'api') return { clave: 'api', rotulo: 'API', detalle: 'La API de MaKo', icono: 'api' };
  return { clave: 'chat', rotulo: 'Chat de MaKo', detalle: t.canal === 'chat_movil' ? 'Desde el teléfono' : 'Desde la computadora', icono: 'mako' };
}

/**
 * El link a donde nació el ticket, ENTRANDO al negocio del cliente (`?ws=`, el mismo «Inspeccionar» de la ficha: el proxy
 * sólo se lo acepta a un admin). La conversación con MaKo si se sabe cuál (`?chat=` del Second Brain), si no la pantalla.
 * WhatsApp no tiene link: la conversación vive en el teléfono de la persona.
 *
 * ⚠️ LA RUTA LA MANDA EL NAVEGADOR DEL CLIENTE (`contexto.ruta`), y `sanearContexto` sólo mira que empiece con UNA barra.
 *    `/.//otro.com` o `/a/..//otro.com` pasan, y el parser de URL, al resolver el `.` o el `..`, deja el camino en
 *    `//otro.com`: un link «relativo al protocolo» que abre OTRO SITIO desde la Ticketera de Martín. Se mira el camino YA
 *    resuelto. Y `/api/` no es una pantalla: un GET ahí, con la sesión de Martín y el `?ws=` del cliente, hace cosas.
 */
export function linkDeOrigen(t: Pick<FilaTicket, 'canal' | 'contexto' | 'workspace_id'>): { href: string; rotulo: string } | null {
  const ws = Number(t.workspace_id);
  if (!Number.isInteger(ws) || ws <= 0) return null;
  const hilo = t.contexto.chat?.hilo ?? '';
  const delChat = t.canal === 'chat_app' || t.canal === 'chat_movil' || (t.canal === 'sistema' && t.contexto.chat?.donde === 'error-mako');
  if (delChat && /^\d{1,12}$/.test(hilo)) return { href: `/second-brain?chat=${hilo}&ws=${ws}`, rotulo: 'Abrir el chat' };
  const ruta = t.contexto.ruta;
  if (ruta && ruta.startsWith('/') && !ruta.startsWith('//')) {
    const base = 'https://x.invalid';
    const u = new URL(ruta, base);
    if (u.origin !== base || u.pathname.startsWith('//') || /^\/(api|_next)(\/|$)/i.test(u.pathname)) return null;
    u.searchParams.set('ws', String(ws));
    return { href: `${u.pathname}${u.search}`, rotulo: 'Ver la pantalla' };
  }
  return null;
}

/** El nombre de quien lo levantó. Por WhatsApp sin usuario, su teléfono o el nombre de su WhatsApp. */
export function nombreDe(t: Pick<FilaTicket, 'usuario_nombre' | 'usuario_email'>): string {
  const n = (t.usuario_nombre || '').trim();
  if (n) return n;
  const e = (t.usuario_email || '').trim();
  const wa = /^whatsapp:(.+)$/.exec(e);
  if (!wa) return e || 'Sin nombre';
  return /^\+?\d{8,15}$/.test(wa[1]) ? `+${wa[1].replace(/^\+/, '')}` : wa[1].replace(/-/g, ' ');
}

/** El error que registró el sistema, en corto: sin el digest de Next ni espacios de más, y cortado en una palabra. */
export function errorCorto(e: string | undefined | null, tope = 160): string | null {
  const t = (e ?? '').replace(/\s*\(digest [^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.length <= tope) return t;
  const corte = t.slice(0, tope);
  const sp = corte.lastIndexOf(' ');
  return `${(sp > tope * 0.6 ? corte.slice(0, sp) : corte).replace(/[\s.,;:—-]+$/, '')}…`;
}

/** Lo que escribió la persona. En un ticket AUTOMÁTICO no escribió nada: el texto es el aviso fijo del sistema. */
export function textoDeLaPersona(t: Pick<FilaTicket, 'canal' | 'descripcion' | 'titulo' | 'contexto'>): string | null {
  if (t.canal === 'sistema') return t.contexto.pedido?.trim() || null;
  const d = (t.descripcion || '').trim();
  return d && d !== t.titulo.trim() ? d : null;
}

const RTF = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat('es', { numeric: 'auto' }) : null;
/** «hace 5 minutos», «ayer», «hace 4 días». */
export function haceCuanto(iso: string | null | undefined, ahora: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return '';
  const s = Math.round((t - ahora) / 1000);
  const a = Math.abs(s);
  if (a < 60) return 'recién';
  if (!RTF) return new Date(t).toLocaleDateString('es');
  if (a < 3600) return RTF.format(Math.round(s / 60), 'minute');
  if (a < 86_400) return RTF.format(Math.round(s / 3600), 'hour');
  if (a < 30 * 86_400) return RTF.format(Math.round(s / 86_400), 'day');
  return new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

/** Quién lo dijo, en la nota: el Cerebro que lo devolvió o el cliente que contestó. */
export function quienDiceLaNota(n: { actor: string; tipo: string }): string {
  if (n.actor === 'cliente' || n.tipo === 'comentario') return 'Respondió';
  if (n.actor === 'cerebro' || n.tipo === 'reclasificado') return 'Cerebro';
  return n.actor.charAt(0).toUpperCase() + n.actor.slice(1);
}

// ── Lo que dice la tarjeta (y la fila de la tabla), en palabras de producto (22/10/2026, tarde) ────────────────────
// Martín (22/10, 17:25, con la captura del #5): «la información de la tarjeta se tiene que entender fácil y mucho más
// rápido... no se entiende ni de qué es el bug, ni qué hay que hacer, ni cómo se originó, o si lo levantó Mauricio o si
// lo detectó MaKo». El título de un ticket automático está escrito para el CLIENTE, que lo lee en «Tus tickets»
// («MaKo no pudo «contestarte»», lib/errores-app-reglas.ts → `tituloDeError`). Martín lee otra cosa: qué le pasó a
// QUIÉN, por qué, quién lo levantó y qué hay que hacer.
// ⚠️ SIN IA (la regla del triage): todo sale del ticket —el canal, el contexto, el código de error, la nota— y de las
//    tablas de acá. Una frase que no calza con ninguna regla cae en un genérico que se lee bien, nunca en un modelo.

type ParaLeer = Pick<FilaTicket, 'tipo' | 'canal' | 'contexto' | 'titulo' | 'usuario_nombre' | 'usuario_email' | 'chatDelTicket'>;

/**
 * DÓNDE falló MaKo (23/10/2026, Martín: la tarjeta «no se entiende»): el chat, por su clave y su título (`chatDelTicket`, lo
 * suma la bandeja). Con origen («CRM», «Dashboard»), el de esa tab; sin origen, uno del Ops Center. null = no se sabe.
 */
export function dondeDelChat(c: FilaTicket['chatDelTicket']): string | null {
  if (!c) return null;
  const origen = origenDeClave(c.clave);
  const titulo = (c.titulo ?? '').replace(/\s+/g, ' ').trim();
  if (origen) return titulo && normal(titulo) !== normal(origen) ? `En el chat de ${origen} «${cortar(titulo, 40)}»` : `En el chat de ${origen}`;
  return titulo ? `En su chat «${cortar(titulo, 40)}» del Ops Center` : 'En su chat del Ops Center';
}

// ⚠️ EL TIPO ES EL DE LA FILA, que es el ÚLTIMO juicio (el triage, después el Cerebro al devolverlo, después Martín a mano):
//    no se «corrige» contra el error (revisión del 22/10/2026, noche). El triage da `bug` a todo automático con error
//    (`clasificar`: +4 por el error, +2 por declararlo el sistema; nada lo pasa a pedido). Si la fila dice otra cosa, lo
//    re-juzgó el Cerebro con `reclasificar <n> pedido`, y el texto del Runner se lo pide justo para eso: «si no es un bug
//    de verdad (es algo nuevo, o no se entiende), devuélvelo» (lib/tickets-aviso.ts → `mensajeTicket`). Una regla
//    «automático con error = Bug» sólo pisaba ESE veredicto: la tarjeta del #6 decía «Bug» junto a «no es de código», y
//    el ✓ le firmaba al Cerebro «ARREGLARLO (es un bug)» sobre lo que él acababa de decir que no lo era.

/**
 * Quien firma un error SIN PERSONA (lib/errores-app.ts → `identidadDelSistema`): uno del servidor sin sesión (un cron, un
 * webhook, una página pública) o de MaKo en WhatsApp sin saber quién escribió. No hay a quién «le pasó»: su nombre
 * («MaKo (lo detectó solo)») no es el de un afectado, y su negocio es el de la plataforma, no el de un cliente.
 */
export const EMAIL_DEL_SISTEMA = 'sistema@hola-mako.com';
const sinPersona = (t: Pick<FilaTicket, 'usuario_email'>) => (t.usuario_email || '').trim().toLowerCase() === EMAIL_DEL_SISTEMA;
/** El prefijo que le pone `abrirTicket` (lib/errores-app.ts) a una REGRESIÓN: estaba resuelto y volvió a pasar. */
const VOLVIO = /^Volvió a pasar:\s*/;

/** La primera letra en minúscula, salvo en una sigla («CRM»). */
const minuscula = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cortar = (s: string, tope: number) => {
  if (s.length <= tope) return s;
  const c = s.slice(0, tope);
  const sp = c.lastIndexOf(' ');
  return `${(sp > tope * 0.6 ? c.slice(0, sp) : c).replace(/[\s.,;:—-]+$/, '')}…`;
};

/** El nombre de pila: «Mauricio Bustos Eguia» → «Mauricio». Un teléfono queda entero; un email, su parte antes de la @. */
export function primerNombre(nombre: string): string {
  const n = nombre.trim();
  if (!n || /^\+\d/.test(n)) return n || 'Sin nombre';
  const base = n.includes('@') ? n.split('@')[0] : n;
  return mayuscula(base.split(/[\s._-]+/)[0] || base);
}

/** El nombre de la pantalla como la ve el cliente en la barra («CRM»), no la ruta. null = no se sabe. */
export function pantallaDe(ruta: string | undefined): string | null {
  if (!ruta || !ruta.startsWith('/')) return null;
  const p = tituloDe(ruta.split('?')[0]).replace(/^MaKo - /, '').trim();
  return p && p !== 'MaKo' ? p : null;
}

/** Lo que intentó MaKo: del título del ticket automático («MaKo no pudo «Mover un lead de etapa»») o la herramienta. */
function loQueIntento(t: Pick<FilaTicket, 'titulo' | 'contexto'>): string {
  const m = /^MaKo no pudo «(.+)»$/.exec(t.titulo.trim().replace(VOLVIO, ''));
  return (m?.[1] ?? t.contexto.herramienta ?? '').replace(/_/g, ' ').trim();
}

/**
 * QUÉ PASÓ, en una frase. Un ticket automático se cuenta desde lo que el código vio (el chat, la pantalla, el servidor);
 * el de una persona es su título: lo escribió ella (o MaKo con ella) y ya dice qué pasó.
 *   MaKo falló en un chat          → «MaKo no le pudo contestar a Mauricio en su chat»
 *   una pantalla se rompió         → «A Ana se le rompió la pantalla «CRM»»
 *   falló el servidor              → «A Ana le falló el servidor en «CRM»»
 *   sin persona (un cron)          → «Falló el servidor en «CRM»», nunca «A MaKo le falló…»
 *   una regresión                  → «Volvió a pasar: a Ana se le rompió…» (el título lo dice; la frase no lo pierde)
 */
export function quePaso(t: ParaLeer): string {
  if (t.canal !== 'sistema') return t.titulo.trim() || 'Sin título';
  const frase = quePasoAutomatico(t);
  if (!VOLVIO.test(t.titulo.trim())) return frase;
  return `Volvió a pasar: ${frase.startsWith('MaKo') ? frase : frase.charAt(0).toLowerCase() + frase.slice(1)}`;
}

function quePasoAutomatico(t: ParaLeer): string {
  const n = sinPersona(t) ? null : primerNombre(nombreDe(t));
  const donde = t.contexto.chat?.donde ?? '';
  if (donde === 'error-mako') {
    const intento = loQueIntento(t);
    // Sabiendo en qué chat, el dónde va en su renglón (`dondeDelChat`): la frase no repite «en su chat».
    const enSuChat = t.chatDelTicket ? '' : ' en su chat';
    if (t.contexto.herramienta === 'responder' || /^contestarte$/i.test(intento)) return n ? `MaKo no le pudo contestar a ${n}${enSuChat}` : 'MaKo no pudo contestar en un chat';
    // El título le habla al cliente («avisarte»): para Martín, «avisar a Mauricio».
    const te = /^(\p{L}+(?:ar|er|ir))te$/iu.exec(intento);
    if (te) return n ? `MaKo no le pudo ${te[1].toLowerCase()} a ${n} en su chat` : `MaKo no pudo ${te[1].toLowerCase()} en un chat`;
    const enDonde = n ? `en el chat de ${n}` : 'en un chat';
    return intento ? `MaKo no pudo ${minuscula(intento)} ${enDonde}` : `MaKo falló ${enDonde}`;
  }
  const pantalla = pantallaDe(t.contexto.ruta);
  if (donde === 'error-servidor') {
    if (!n) return pantalla ? `Falló el servidor en «${pantalla}»` : 'Falló el servidor';
    return pantalla ? `A ${n} le falló el servidor en «${pantalla}»` : `A ${n} le falló el servidor`;
  }
  if (!n) return pantalla ? `Se rompió la pantalla «${pantalla}»` : 'Se rompió una pantalla';
  return pantalla ? `A ${n} se le rompió la pantalla «${pantalla}»` : `A ${n} se le rompió una pantalla`;
}

/**
 * Los errores que más llegan, en palabras de producto: POR QUÉ falló y QUÉ HAY QUE HACER. Gana el primero que calza.
 * `{lo}` = «contestarle» si lo que falló fue contestar, si no «hacerlo». Los textos de la cascada de IA son los de
 * `esDeConfiguracion` (lib/errores-app-reglas.ts): al negocio le falta algo SUYO, no hay código roto.
 */
export const ERRORES_FRECUENTES: ReadonlyArray<{ re: RegExp; porque: string; hacer: string }> = [
  // Desde el 22/10/2026 la plataforma no presta IA: cada negocio usa la suya (Claude o GPT). Sin ella, nadie contesta.
  { re: /claude vetado|sin proveedor (gratis|de ia)|red gratis salteada/i, porque: 'No tiene su IA conectada (Claude o GPT), y MaKo no presta la suya', hacer: 'Conectar su IA' },
  { re: /tu clave de claude: .*(credit balance|billing)/i, porque: 'Su Claude se quedó sin crédito', hacer: 'Cargar crédito en su Claude' },
  { re: /tu clave de claude: .*(invalid x-api-key|authentication|permission|\b40[13]\b)/i, porque: 'Su clave de Claude no anda', hacer: 'Volver a conectar su Claude' },
  { re: /en pausa por un rato/i, porque: 'Claude estaba en pausa', hacer: 'Esperar a que vuelva Claude' },
  { re: /\b(429|503|529)\b|overloaded|high demand|rate.?limit|quota|resource.?exhausted/i, porque: 'La IA estaba saturada', hacer: 'Probar de nuevo' },
  { re: /timed? ?out|ETIMEDOUT|tard[oó] demasiado/i, porque: 'Tardó demasiado y se cortó', hacer: 'Arreglar el código' },
  { re: /access token|oauth|session has expired|token .*(expir|venc|inv[aá]lid)/i, porque: 'Se venció una conexión de su cuenta', hacer: 'Volver a conectar la cuenta' },
  // «Permission denied» a secas es del NAVEGADOR (el micrófono o la cámara que la persona no dejó usar: NotAllowedError);
  // el de la base dice sobre qué («permission denied for table leads»).
  { re: /NotAllowedError/i, porque: 'El navegador no le dio permiso', hacer: 'Arreglar el código' },
  { re: /permission denied for (table|relation|schema|sequence|function|view|database)\b|row-level security|\b42501\b/i, porque: 'La base no le dio permiso', hacer: 'Arreglar el código' },
  { re: /duplicate key|violates .* constraint|\b2350[35]\b|PGRST\d{3}/i, porque: 'La base rechazó lo que se guardaba', hacer: 'Arreglar el código' },
  { re: /cannot read propert|is not a function|is not defined|is not iterable|TypeError|ReferenceError|SyntaxError/i, porque: 'Un error de programación', hacer: 'Arreglar el código' },
];
/** Lo que se dice de un error que no está en la tabla. */
export const ERROR_GENERICO = { porque: 'Algo falló en el código', hacer: 'Arreglar el código' } as const;

/**
 * Por qué falló y qué hay que hacer, según el error que registró el código.
 * ⚠️ SE LEE EL ERROR, NO LO QUE `ticketDeError` LE PEGA AL FINAL: el digest de Next y «· 503 veces» (lib/errores-app-reglas.ts).
 *    Con el contador adentro, un TypeError que pasó 429 veces calzaba con `\b429\b` y la tarjeta decía «La IA estaba
 *    saturada · Probar de nuevo».
 */
export function errorFrecuente(crudo: string, herramienta?: string): { porque: string; hacer: string } {
  const error = crudo.replace(/\s*\(digest [^)]*\)/g, '').replace(/\s*·\s*\d+ veces\s*$/, '');
  const f = ERRORES_FRECUENTES.find((x) => x.re.test(error)) ?? ERROR_GENERICO;
  return { porque: f.porque.replace('{lo}', herramienta === 'responder' ? 'contestarle' : 'hacerlo'), hacer: f.hacer };
}

/**
 * QUÉ HAY QUE DECIDIR, como una pregunta que se contesta con el ✓ (23/10/2026, Martín: «escrita para que decida en 5
 * segundos»). Sale de lo que hay que hacer; lo que no está en la tabla, como pregunta.
 */
const DECIDE_POR_HACER: Readonly<Record<string, (a: string) => string>> = {
  'Conectar su IA': (a) => `¿Le pedimos${a} que conecte su IA?`,
  'Cargar crédito en su Claude': (a) => `¿Le avisamos${a} que cargue crédito en su Claude?`,
  'Volver a conectar su Claude': (a) => `¿Le pedimos${a} que vuelva a conectar su Claude?`,
  'Volver a conectar la cuenta': (a) => `¿Le pedimos${a} que vuelva a conectar la cuenta?`,
  'Esperar a que vuelva Claude': () => '¿Lo dejamos pasar? Claude vuelve solo',
  'Probar de nuevo': () => '¿Lo probamos de nuevo?',
  'Arreglar el código': () => '¿Lo arreglamos?',
  'Revisar y arreglar': () => '¿Lo arreglamos?',
  'Decidir si se hace': () => '¿Lo hacemos?',
  'Responderle': (a) => `¿Qué le respondemos${a}?`,
};
export function queDecide(hacer: string, nombre: string | null): string {
  const a = nombre ? ` a ${nombre}` : '';
  return DECIDE_POR_HACER[hacer]?.(a) ?? `¿${hacer}?`;
}

/** Qué hay que hacer cuando no hay un error que lo diga: lo que pide el tipo. */
const HACER_POR_TIPO: Record<TipoTicket, string> = { bug: 'Revisar y arreglar', pedido: 'Decidir si se hace', pregunta: 'Responderle' };

/** Lo que dice una nota del Cerebro, en piezas cortas. El orden es el de la tabla. */
const PIEZAS_DE_LA_NOTA: ReadonlyArray<[RegExp, (m: RegExpExecArray) => string]> = [
  [/mismo caso que el #(\d+)/i, (m) => `igual que el #${m[1]}`],
  [/arreglo de c[oó]digo ya sali[oó]|ya (qued[oó]|est[aá]) arreglad/i, () => 'el código ya está arreglado'],
  [/no se arregla con c[oó]digo|no es (un bug|de c[oó]digo)/i, () => 'no es de código'],
  [/(lo |que )?decid[ae] mart[ií]n/i, () => 'lo decides tú'],
];

/**
 * La nota que dejó el Cerebro (o lo que contestó el cliente), en UNA línea: lo que va después de «Estado:». La nota
 * entera va plegada en «Detalle». Sin una pieza conocida, el comienzo de la nota hasta el primer corte, recortado.
 */
export function estadoDeLaNota(n: NotaTicket | null | undefined): string | null {
  const texto = (n?.texto ?? '').replace(/\s+/g, ' ').trim();
  if (!n || !texto) return null;
  if (quienDiceLaNota(n) === 'Respondió') return `respondió «${cortar(texto, 60)}»`;
  const piezas = PIEZAS_DE_LA_NOTA.map(([re, dice]) => { const m = re.exec(texto); return m ? dice(m) : null; }).filter((x): x is string => !!x);
  if (piezas.length) return piezas.join(' · ');
  return cortar(minuscula(texto.split(/(?<=\D)[.:;—](?:\s|$)/)[0].trim()), 80);
}

export type LecturaTicket = {
  /** Qué pasó, en una frase. */
  quePaso: string;
  /** Por qué, en corto (del error o de lo que vio MaKo). null = no se sabe más que la frase. */
  porque: string | null;
  /** Quién lo levantó: MaKo solo (la estrella) o la persona (su foto), con por dónde. */
  quien: { mako: boolean; texto: string };
  /** La pantalla donde estaba la persona, si no la dice ya la frase. */
  donde: string | null;
  /** El negocio, si suma: no cuando es el mismo nombre de la persona («Mauricio Bustos» de Mauricio Bustos Eguia). */
  negocio: string | null;
  /** Qué hay que hacer, en un renglón. */
  hacer: string;
  /** Qué hay que decidir: la pregunta que se contesta con el ✓ (`queDecide`). */
  decide: string;
  /** Lo que dejó el Cerebro o contestó el cliente, en una línea (va después de «Estado:»). */
  estado: string | null;
  /** El tipo de la fila: el último juicio (el triage, el Cerebro al devolverlo, Martín a mano). */
  tipo: TipoTicket;
};

/** Lo que dicen las filas de código de `ERRORES_FRECUENTES`: sólo vale mientras el ticket siga siendo un bug. */
const ARREGLAR_EL_CODIGO = 'Arreglar el código';

/** Todo lo que dice la tarjeta, de arriba hacia abajo. Puro: lo usan la tarjeta, la tabla y la hoja del ticket. */
export function leerTicket(t: ParaLeer & Pick<FilaTicket, 'workspace_id'> & { negocio?: string | null; nota?: NotaTicket | null }): LecturaTicket {
  const sistema = t.canal === 'sistema';
  const error = (t.contexto.error ?? '').trim();
  const fallo = error ? errorFrecuente(error, t.contexto.herramienta) : null;
  const tipo = t.tipo;
  // «Arreglar el código» sobre un ticket que el Cerebro devolvió como «no es un bug» contradice al Cerebro y al ✓ (Hacer,
  // Responder): ahí manda el tipo. Lo que le falta al NEGOCIO («Conectar su IA») sigue valiendo.
  const hacerDelError = fallo && !(tipo !== 'bug' && fallo.hacer === ARREGLAR_EL_CODIGO) ? fallo.hacer : null;
  const nombre = nombreDe(t);
  const desde = t.canal === 'whatsapp' ? 'por WhatsApp' : t.canal === 'api' ? 'por la API'
    : t.canal === 'formulario' ? 'desde «Reportar problema»' : 'desde el chat de MaKo';
  const pantalla = sistema ? null : pantallaDe(t.contexto.ruta);
  const neg = (t.negocio ?? '').trim();
  const mismo = !!neg && (normal(nombre).startsWith(normal(neg)) || normal(neg).startsWith(normal(nombre)));
  return {
    quePaso: quePaso(t),
    porque: fallo ? fallo.porque : t.contexto.noExiste ? 'La app todavía no lo tiene' : null,
    quien: sistema ? { mako: true, texto: 'Lo detectó MaKo solo' } : { mako: false, texto: `Lo levantó ${primerNombre(nombre)} ${desde}` },
    // La pantalla de la persona; en uno que detectó MaKo, el chat donde falló.
    donde: pantalla ? `En «${pantalla}»` : dondeDelChat(t.chatDelTicket),
    // Sin persona, el negocio de la fila es el de la PLATAFORMA (`identidadDelSistema`): no es de nadie a quien decirle.
    negocio: mismo || sinPersona(t) ? null : neg || `Negocio ${t.workspace_id}`,
    hacer: hacerDelError ?? HACER_POR_TIPO[t.contexto.noExiste ? 'pedido' : tipo],
    decide: queDecide(hacerDelError ?? HACER_POR_TIPO[t.contexto.noExiste ? 'pedido' : tipo], sinPersona(t) ? null : primerNombre(nombre)),
    estado: estadoDeLaNota(t.nota),
    tipo,
  };
}

// ── Qué hace cada gesto ───────────────────────────────────────────────────────────────────────────────────────────
export type Salida = 'derecha' | 'izquierda' | 'arriba';
export type AccionMazo = { decision: DecisionTicket; rotulo: string; pideTexto: boolean; salida: Salida };

/** Desde cuántos px de arrastre se MARCA el botón del gesto (los sellos de la tarjeta arrancan en el mismo punto). */
export const MARCA_PX = 24;
/** Qué botón se marca mientras se arrastra: el del eje más largo, pasado `MARCA_PX`. Hacia abajo, ninguno. */
export function gestoMarcado(dx: number, dy: number): Salida | null {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= MARCA_PX ? 'derecha' : dx <= -MARCA_PX ? 'izquierda' : null;
  return dy <= -MARCA_PX ? 'arriba' : null;
}

/** Lo que hace cada gesto. «Aprobar» sale del tipo de la fila, el mismo que dice la tarjeta: un bug se arregla, un pedido
 *  se hace. */
export function accionesDe(t: Pick<FilaTicket, 'tipo' | 'estado'>): Record<Salida, AccionMazo | null> {
  const aprobar = t.estado === 'en_curso' ? null : decisionDeAprobar(t.tipo);
  const derecha: AccionMazo = aprobar
    ? { decision: aprobar, rotulo: aprobar === 'arreglar' ? 'Arreglar' : 'Hacer', pideTexto: false, salida: 'derecha' }
    : { decision: 'responder', rotulo: 'Responder', pideTexto: true, salida: 'derecha' };
  return {
    derecha,
    izquierda: { decision: 'rechazar', rotulo: 'Rechazar', pideTexto: true, salida: 'izquierda' },
    arriba: { decision: 'preguntar', rotulo: 'Preguntar', pideTexto: true, salida: 'arriba' },
  };
}

/** Lo que lee el cliente según la acción, para no escribirlo cada vez (las «respuestas guardadas» de Front y Help Scout).
 *  Se tocan para llenar la caja, y se pueden editar antes de mandar: ninguna sale sola. */
export const RESPUESTAS_GUARDADAS: Readonly<Partial<Record<DecisionTicket, readonly string[]>>> = {
  rechazar: [
    'No es un error de MaKo: así funciona hoy.',
    'Por ahora no lo vamos a hacer. Gracias por proponerlo.',
  ],
  preguntar: [
    '¿Me cuentas qué estabas haciendo cuando pasó?',
    '¿Te sigue pasando?',
  ],
  responder: [
    'Ya está arreglado: prueba de nuevo.',
  ],
};

/**
 * ¿El arrastre cuenta, y para dónde? La receta de siempre del mazo (Tinder, Bumble): cuenta si se llevó LEJOS (un
 * cuarto largo de la tarjeta, nunca menos de 100 px) o si fue un TIRÓN (≥ 500 px/s) que ya salió del lugar (≥ 40 px).
 * Arriba con la misma regla, sobre el alto. Llevarla lejos y tirar para atrás al soltar (> 300 px/s) la devuelve.
 * Hacia ABAJO no hay nada: vuelve.
 */
export function veredictoGesto(p: { dx: number; dy: number; vx: number; vy: number; ancho: number; alto: number }): Salida | null {
  const vertical = Math.abs(p.dy) > Math.abs(p.dx);
  if (vertical) {
    if (p.dy >= 0) return null;
    const umbral = Math.max(100, p.alto * 0.22);
    const vuelve = p.vy > 300;
    if (-p.dy >= umbral && !vuelve) return 'arriba';
    if (-p.dy >= 40 && p.vy <= -500) return 'arriba';
    return null;
  }
  const umbral = Math.max(100, p.ancho * 0.28);
  const lado: Salida = p.dx > 0 ? 'derecha' : 'izquierda';
  const vuelve = Math.sign(p.vx) === -Math.sign(p.dx) && Math.abs(p.vx) > 300;
  if (Math.abs(p.dx) >= umbral && !vuelve) return lado;
  if (Math.abs(p.dx) >= 40 && Math.abs(p.vx) >= 500 && Math.sign(p.vx) === Math.sign(p.dx)) return lado;
  return null;
}

// ── El mazo ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Cuánto espera una decisión antes de salir, para que «Volver» la deshaga ENTERA (el «Deshacer envío» de Gmail: 5 a
 *  30 s). Después de salir no hay vuelta: le avisó al cliente o se la firmó al Cerebro. */
export const VENTANA_DESHACER_MS = 8000;

/**
 * El orden del mazo: lo más urgente primero y, dentro de cada prioridad, el que espera hace más. Lo que SUBIÓ por ser de una
 * agencia (`triage.agencia`, `subirPorAgencia`) va detrás de los de su prioridad que llegaron ahí solos: así no le quita el lugar
 * a un cliente con algo roto (5/11/2026).
 */
export function ordenDelMazo(ts: readonly FilaTicket[]): number[] {
  const subio = (t: FilaTicket) => (t.triage?.agencia ? 1 : 0);
  return ts.filter(porDecidir)
    .sort((a, b) => PRIORIDADES.indexOf(a.prioridad) - PRIORIDADES.indexOf(b.prioridad) || subio(a) - subio(b) || Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((t) => t.id);
}

/** Lo que este mazo ya vio de cada ticket: el `updated_at` de la última lectura (la VERSIÓN, no sólo el número). */
export type VistosMazo = ReadonlyMap<number, string>;
export const versionesDe = (ts: readonly Pick<FilaTicket, 'id' | 'updated_at'>[]): Map<number, string> => new Map(ts.map((t) => [t.id, t.updated_at]));

/**
 * Lo que llega al refrescar, sobre el mazo que ya se está mirando: el orden NO se rearma (la tarjeta de adelante no
 * cambia sola), se sacan los que ya no esperan una decisión (los decidió otro, o el Cerebro), y lo NUEVO va al final.
 * `vistos` = la versión de cada ticket en la lectura ANTERIOR; `apartados` = lo decidido acá que todavía no salió (sigue
 * «por decidir» en la base hasta que vence su ventana).
 *
 * ⚠️ «NUEVO» ES UN TICKET QUE NO ESTABA, O QUE CAMBIÓ: un ticket que ya pasó por este mazo VUELVE si volvió a esperar a
 *    Martín (el cliente contestó lo que le preguntó, o el Cerebro lo devolvió: `comentarComoCliente` y `reclasificar`
 *    tocan `updated_at`). Con sólo «ya lo vi» (un Set de números) no volvía nunca con la pantalla abierta: el mazo decía
 *    «Nada por decidir» y la tabla, «Por decidir 1». Lo que NO vuelve es la lectura vieja de algo que se acaba de decidir
 *    acá (la pidió el refresco antes de que la decisión llegara a la base): trae la MISMA versión que ya se vio.
 */
export function refrescarMazo(orden: readonly number[], ts: readonly FilaTicket[], vistos: VistosMazo, apartados: ReadonlySet<number>): number[] {
  const abiertos = new Set(ts.filter(porDecidir).map((t) => t.id));
  const quedan = orden.filter((id) => abiertos.has(id) && !apartados.has(id));
  const version = versionesDe(ts);
  const nuevos = ordenDelMazo(ts).filter((id) => vistos.get(id) !== version.get(id) && !apartados.has(id) && !quedan.includes(id));
  return [...quedan, ...nuevos];
}

// ── Las teclas (en la compu) ──────────────────────────────────────────────────────────────────────────────────────
export type TeclaMazo = Salida | 'volver' | 'siguiente' | 'anterior' | 'cerrar' | 'comer';

/**
 * Qué hace una tecla en el mazo: → aprobar · ← rechazar · ↑ preguntar · ⌫ o Ctrl+Z volver · J/K la siguiente o la
 * anterior · Escape cierra la caja. `comer` = la tecla es del mazo pero no hace nada (se le saca el scroll de la página).
 * `donde.enCampo`: el foco está en un campo de texto (las teclas son del texto; sólo Escape cierra la caja).
 * `donde.enFlechas`: el foco está en un control que se recorre con las flechas (las pestañas Mazo / Tabla).
 *
 * ⚠️ UNA TECLA SOSTENIDA NO DECIDE OTRA VEZ (`repeat`): dejar apretada → aprobaba un ticket detrás de otro, uno por cada
 *    vuelo de tarjeta (~0,3 s), cada uno con su pedido firmado al Cerebro a los 8 s.
 * ⚠️ En las pestañas Mazo / Tabla, ← → cambian de pestaña (el patrón de ARIA), no aprueban el ticket de adelante.
 * ⚠️ Con la caja abierta (lo que lee el cliente) las flechas no deciden OTRA cosa: la caja tiene su botón.
 */
export function teclaDelMazo(
  e: { key: string; repeat?: boolean; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
  donde: { enCampo: boolean; enFlechas: boolean; cajaAbierta: boolean },
): TeclaMazo | null {
  if (donde.enCampo) return e.key === 'Escape' ? 'cerrar' : null;
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'z') return 'volver';
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key === 'Escape') return 'cerrar';
  if (e.key === 'Backspace') return 'volver';
  if (e.key === 'j') return 'siguiente';
  if (e.key === 'k') return 'anterior';
  const salida: Salida | null = e.key === 'ArrowRight' ? 'derecha' : e.key === 'ArrowLeft' ? 'izquierda' : e.key === 'ArrowUp' ? 'arriba' : null;
  if (!salida || donde.enFlechas) return null;
  return e.repeat || donde.cajaAbierta ? 'comer' : salida;
}

/**
 * La lectura de la bandeja, sin pisarse: se refresca sola (cada 30 s, al volver a la pestaña) y después de cada decisión.
 * ⚠️ UN PEDIDO QUE LLEGA CON OTRA LECTURA EN VUELO NO SE PIERDE: se lee otra vez al terminar. Antes se descartaba, y la
 *    lectura en vuelo había salido ANTES de la decisión: la tabla mostraba lo recién decidido como estaba, hasta 30 s.
 * ⚠️ LA VISTA (mazo o tabla) SE PIDE HASTA QUE UNA LECTURA LA TRAE: si la primera fallaba y la siguiente andaba, la
 *    bandeja quedaba en «Cargando…» para siempre (los refrescos no la piden) y sin el botón de reintentar.
 */
/** Lo que espera una lectura de la Ticketera antes de darla por fallida (22/10/2026: en un deploy, una quedó colgada y la
 *  bandeja se quedó en «Cargando…» más de 12 s, hasta recargar: `leyendo` no se soltaba y ninguna otra salía). */
export const TOPE_LECTURA_BANDEJA_MS = 15_000;
/** Cuántas lecturas seguidas tienen que fallar, con tickets a la vista, para decirlo: una suelta (un 503 del deploy) no es
 *  algo que Martín tenga que ver, y decirla cada vez era el parpadeo. Sin tickets todavía, se dice a la primera. */
export const FALLOS_PARA_DECIRLO = 3;
export const decirFalloDeLectura = (fallosSeguidos: number, hayTickets: boolean): boolean => !hayTickets || fallosSeguidos >= FALLOS_PARA_DECIRLO;

export function lectorDeBandeja<R extends { ok: boolean }>(
  leer: (conVista: boolean) => Promise<R>,
  aplicar: (r: R | null, conVista: boolean) => void,
  topeMs = TOPE_LECTURA_BANDEJA_MS,
): () => Promise<void> {
  let leyendo = false, otraVez = false, vistaSabida = false;
  return async () => {
    if (leyendo) { otraVez = true; return; }
    leyendo = true;
    try {
      do {
        otraVez = false;
        const conVista = !vistaSabida;
        let reloj: ReturnType<typeof setTimeout> | undefined;
        const tope = new Promise<null>((ok) => { reloj = setTimeout(() => ok(null), topeMs); });
        const r = await Promise.race([leer(conVista).catch(() => null), tope]).finally(() => clearTimeout(reloj));
        if (r?.ok && conVista) vistaSabida = true;
        aplicar(r, conVista);
      } while (otraVez);
    } finally {
      leyendo = false;
    }
  };
}

// ── La tabla ──────────────────────────────────────────────────────────────────────────────────────────────────────
export type ColumnaTabla = 'id' | 'titulo' | 'quien' | 'negocio' | 'canal' | 'estado' | 'cuando';
export const COLUMNAS: ReadonlyArray<{ clave: ColumnaTabla; titulo: string }> = [
  { clave: 'id', titulo: '#' }, { clave: 'titulo', titulo: 'Qué pasó' }, { clave: 'quien', titulo: 'Quién' },
  { clave: 'negocio', titulo: 'Negocio' }, { clave: 'canal', titulo: 'Canal' }, { clave: 'estado', titulo: 'Estado' },
  { clave: 'cuando', titulo: 'Cuándo' },
];
export type Orden = { col: ColumnaTabla; dir: 'asc' | 'desc' };
export const ORDEN_INICIAL: Orden = { col: 'cuando', dir: 'desc' };

const quienDe = (t: FilaTicket) => (t.usuario_nombre || t.usuario_email || '').toLowerCase();
const clave = (t: FilaTicket, c: ColumnaTabla): string | number => {
  switch (c) {
    case 'id': return t.id;
    // La columna «Qué pasó» dice la frase de la tarjeta (`quePaso`), no el título del cliente: ordena por lo que se ve.
    case 'titulo': return quePaso(t).toLowerCase();
    case 'quien': return quienDe(t);
    case 'negocio': return (t.negocio ?? '').toLowerCase();
    case 'canal': return origenDe(t).rotulo.toLowerCase();
    case 'estado': return GRUPOS.findIndex((g) => g.estados.includes(t.estado)) * 10 + PRIORIDADES.indexOf(t.prioridad);
    case 'cuando': return Date.parse(t.created_at) || 0;
  }
};

/** Ordena la tabla por una columna. Los empates, por número (el más nuevo arriba): el orden nunca salta. */
export function ordenarTabla(ts: readonly FilaTicket[], o: Orden): FilaTicket[] {
  const s = o.dir === 'asc' ? 1 : -1;
  return [...ts].sort((a, b) => {
    const x = clave(a, o.col), y = clave(b, o.col);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
    return c !== 0 ? c * s : b.id - a.id;
  });
}

/** Tocar el título de una columna: la misma la da vuelta; otra empieza por lo que más sirve (lo nuevo, lo alto). */
export function siguienteOrden(o: Orden, col: ColumnaTabla): Orden {
  if (o.col === col) return { col, dir: o.dir === 'asc' ? 'desc' : 'asc' };
  return { col, dir: col === 'cuando' || col === 'id' ? 'desc' : 'asc' };
}
