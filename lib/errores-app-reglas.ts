// =============================================================================
// Los errores de la app — las reglas puras: qué se guarda de un error, qué es ruido, y la HUELLA que los agrupa
// =============================================================================
// Martín (17/10/2026): «lo mismo que corrés en MaKo en WhatsApp detectando errores, córrelo en toda la app: MaKo en los
// chats de la app, errores al navegar o lo que sea. Y todo lo solucionas automáticamente». Los errores llegan de tres
// lados (lib/errores-app.ts): el NAVEGADOR (app/error.tsx, app/global-error.tsx y los errores sueltos de la ventana), el
// SERVIDOR (instrumentation.ts → onRequestError) y MAKO en un chat de la app (lib/mako-turno-app.ts).
//
// ⚠️ SIN DATOS DE CLIENTES. Un mensaje de error puede traer un email, un teléfono o el nombre de un lead. Lo que se guarda
// pasa por `sinDatos` (emails, números largos y lo que va entre comillas), y la pantalla va sin los valores de su query.
//
// ⚠️ LA HUELLA NO PUEDE CAMBIAR CON CADA DEPLOY. En producción el stack del navegador está minificado y los nombres de los
// archivos llevan un hash que cambia en cada build: una huella con el stack abriría un ticket nuevo por el mismo bug
// después de cada deploy. Por eso es el tipo, el mensaje normalizado y la pantalla sin ids.
//
// ⚠️ SIN `server-only`: lo usan el servidor, el reportador del navegador (app/_components/ReportarErrores.tsx) y los
// tests. El boundary (app/error.tsx) no importa nada a propósito: manda el error crudo y el servidor lo sanea.

import { tituloDe } from './titulo-tab';

export const ORIGENES = ['navegador', 'servidor', 'mako'] as const;
export type OrigenError = (typeof ORIGENES)[number];

export type ReporteError = {
  origen: OrigenError;
  /** El tipo (TypeError, ChunkLoadError) o, en un chat de MaKo, la herramienta que falló. */
  nombre: string;
  mensaje: string;
  stack?: string;
  digest?: string;
  /** La pantalla, con la query sin valores (lo que no es un número). */
  ruta?: string;
  navegador?: string;
  pantalla?: string;
  /** Cuando el HTML del servidor no coincidió: lo que puede haberlo tocado antes de hidratar (`pistasDeHidratacion`). */
  pistas?: string;
  /** El hilo del chat de MaKo donde falló (origen `mako`): ahí le llega el aviso de que está arreglado. */
  hilo?: string;
  /** Lo que intentó MaKo en palabras de la persona («Mover un lead de etapa»): sólo para el título. La huella usa `nombre`. */
  etiqueta?: string;
};

const corta = (v: unknown, n: number): string => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, n) : '');

/** Saca lo que puede ser de un cliente: emails, números largos (teléfonos, documentos, tarjetas) y lo que va entre comillas. */
export function sinDatos(texto: string): string {
  // Lo citado primero: si no, se comería los marcadores «email» y «número» que ponen las otras dos.
  return texto
    .replace(/(["“«'])[^"”»']{1,120}(["”»'])/g, '«…»')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '«email»')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '«número»');
}

/** La pantalla sin los valores de la query (salvo los números: son ids) ni el host. */
export function rutaSinDatos(ruta: string): string {
  const r = corta(ruta, 400);
  if (!r.startsWith('/') || r.startsWith('//')) return '';
  const [camino, query = ''] = r.split('?');
  const q = query.split('&').filter(Boolean).slice(0, 8).map((par) => {
    const [k, v = ''] = par.split('=');
    return /^\d{1,12}$/.test(v) ? `${k}=${v}` : `${k}=…`;
  });
  return `${camino.slice(0, 160)}${q.length ? `?${q.join('&')}` : ''}`;
}

/** La pantalla como patrón: los números y los uuid son `:id` (dos leads distintos son la misma pantalla). */
export function rutaPatron(ruta: string): string {
  return (ruta.split('?')[0] || '/')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

/** Limpia lo que llega (del navegador, del servidor o del turno). null = no es un reporte. */
export function sanearReporte(x: unknown): ReporteError | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!(ORIGENES as readonly unknown[]).includes(o.origen)) return null;
  const mensaje = sinDatos(corta(o.mensaje, 500));
  if (!mensaje) return null;
  const r: ReporteError = { origen: o.origen as OrigenError, nombre: corta(o.nombre, 60).replace(/[^\w.$:-]/g, '') || 'Error', mensaje };
  // Del stack, sólo las líneas de marco («at …»): el resto puede repetir el mensaje con datos.
  const stack = corta(o.stack, 4000).split('\n').map((l) => l.trim()).filter((l) => /^at\s/.test(l) || /@https?:/.test(l)).slice(0, 12).join('\n');
  if (stack) r.stack = sinDatos(stack).slice(0, 2000);
  const digest = corta(o.digest, 40);
  if (/^[\w-]+$/.test(digest)) r.digest = digest;
  const ruta = rutaSinDatos(corta(o.ruta, 400));
  if (ruta) r.ruta = ruta;
  const navegador = corta(o.navegador, 300);
  if (navegador) r.navegador = navegador;
  const pantalla = corta(o.pantalla, 20);
  if (/^\d{2,5}x\d{2,5}$/.test(pantalla)) r.pantalla = pantalla;
  const pistas = corta(o.pistas, 200);
  if (/^[\w =;,.-]+$/.test(pistas)) r.pistas = pistas;
  const etiqueta = sinDatos(corta(o.etiqueta, 80));
  if (r.origen === 'mako' && etiqueta) r.etiqueta = etiqueta;
  const hilo = corta(o.hilo, 12);
  if (r.origen === 'mako' && /^\d{1,12}$/.test(hilo)) r.hilo = hilo;
  return r;
}

/**
 * ¿Es ruido? Lo que no es un bug de MaKo: el navegador o una extensión, la red que se cortó, el deploy nuevo que deja a
 * una pestaña vieja sin sus archivos, y el control de flujo de Next (redirect, notFound). Abrir un ticket por esto sería
 * mandar al Cerebro a arreglar lo que no está roto.
 */
const RUIDO = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /(chrome|moz|safari(-web)?)-extension:\/\//i,
  /ChunkLoadError|Loading (CSS )?chunk \d+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i,
  /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|network error)$/i,
  /AbortError|The (user|operation) aborted|signal is aborted/i,
  /NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/,
  // El proveedor de IA que no contestó (MaKo no pudo responder): no es un bug de MaKo, y el Cerebro no lo arregla.
  /\b(429|503|529)\b|overloaded|high demand|quota|rate.?limit|resource.?exhausted|ETIMEDOUT|ECONNRESET|timed? ?out/i,
];
/**
 * El reporte de cuando se vio la pantalla de error PROPIA de Next («This page couldn't load»): la app entera caída,
 * arriba de nuestros boundaries (app/_components/CentinelaArranque.tsx). Nunca es ruido, aunque adentro diga
 * ChunkLoadError o «Failed to fetch»: lo que en una pestaña de fondo no se nota, acá le tapó la app a la persona.
 */
export const PANTALLA_DE_NEXT = 'PantallaDeNext';
/** El id que esa pantalla le pone a <html> (next/dist/client/components/builtin/global-error.js). La nuestra no lo usa. */
export const ID_PANTALLA_DE_NEXT = '__next_error__';

export function esRuido(r: Pick<ReporteError, 'nombre' | 'mensaje' | 'stack'>): boolean {
  if (r.nombre === PANTALLA_DE_NEXT) return false;
  const todo = `${r.nombre}: ${r.mensaje}\n${r.stack ?? ''}`;
  if (RUIDO.some((x) => x.test(r.mensaje) || x.test(todo))) return true;
  // Un error del navegador cuyo stack no pasa por NINGÚN archivo nuestro es de una extensión o de un script de afuera.
  if (r.stack && !/\/_next\/|webpack|turbopack|\.tsx?|app\//.test(r.stack)) return true;
  return false;
}

/**
 * ¿Es CONFIGURACIÓN del negocio? MaKo no pudo porque al negocio le falta algo suyo, no porque algo esté roto
 * (tickets #5 y #6, 18/10/2026: «responder: falló la IA (sin proveedor gratis disponible)» en el ws1). Desde el 16/10
 * una key de la plataforma copiada en la fila de un negocio no cuenta como suya (lib/ia-keys.ts), y un negocio sin una
 * IA propia no tiene con qué contestar: la cascada no encontró NINGUNA cuenta que probar. El arreglo no es de código,
 * es que el negocio conecte la suya, y eso se le pide en el chat (lib/mako-turno-app.ts). Un ticket de bug por esto manda
 * al Cerebro a arreglar algo que no está roto.
 *
 * ⚠️ Son los textos que escribe la cascada cuando NO HABÍA con qué probar, y nada más: «falta RESEND_API_KEY» del
 *    servidor sí es un bug (es de la plataforma, no del negocio), y por eso no está.
 */
const CONFIGURACION = [
  /sin proveedor gratis disponible/i,     // lib/anthropic.ts, chatClaudeTools: la cascada con herramientas sin ninguna cuenta
  /sin proveedor de ia barata/i,          // lib/ai-cheap.ts, `proveedor()`: el negocio sin ninguna key barata
  /red gratis salteada:/i,                // lib/ai-cheap.ts: con datos de clientes la red de MaKo no corre (lib/fallo-ia-texto.ts)
  // SU clave de Claude sin crédito, revocada o sin permiso (lib/anthropic.ts, «tu clave de Claude: …»): es de su cuenta, y se
  // le dice con el botón de su Claude (revisión del Cerebro, 21/10/2026). Un 400 de NUESTRO pedido sí es un bug: no entra.
  /tu clave de Claude: .*(credit balance|invalid x-api-key|authentication|permission|billing|\b40[13]\b)/i,
  /MaKo lo tiene en pausa por un rato/i,  // lib/anthropic.ts → CLAUDE_EN_PAUSA: la plataforma pausó Claude a propósito
];
export const esDeConfiguracion = (r: Pick<ReporteError, 'mensaje'>): boolean => CONFIGURACION.some((x) => x.test(r.mensaje));

/** El mensaje sin lo que cambia entre dos veces del MISMO error: números, ids, lo citado. */
export function mensajeNormalizado(m: string): string {
  return sinDatos(m).toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, ':id')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ').trim().slice(0, 200);
}

/** Dos FNV-1a de 32 bits con semillas distintas → 16 hex. Puro y sin `node:crypto` ni BigInt (el proyecto compila a
 *  ES2017), para que el mismo cálculo sirva en cualquier lado. */
function fnv64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  const una = (semilla: number) => {
    let h = semilla >>> 0;
    for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  };
  return `${una(0x811c9dc5)}${una(0x5bd1e995)}`;
}

/** La huella de un error: el origen, el tipo, el mensaje normalizado y la pantalla como patrón. */
export function huellaDe(r: Pick<ReporteError, 'origen' | 'nombre' | 'mensaje' | 'ruta'>): string {
  return fnv64(`${r.origen}|${r.nombre}|${mensajeNormalizado(r.mensaje)}|${rutaPatron(r.ruta ?? '')}`);
}

/** El título del ticket, en palabras de quien lo lee (el cliente también lo ve en «Tus tickets»). */
export function tituloDeError(r: Pick<ReporteError, 'origen' | 'nombre' | 'mensaje' | 'ruta' | 'etiqueta'>): string {
  if (r.origen === 'mako') return `MaKo no pudo «${r.etiqueta || r.nombre}»`.slice(0, 140);
  // El nombre de la pantalla como lo ve el cliente en la barra («CRM», «General»), no la ruta («/crm/:id»): este título lo
  // lee en «Tus tickets» y en el aviso a su grupo. Sale de lib/titulo-tab.ts, el mismo de la pestaña del navegador.
  const pantalla = r.ruta ? tituloDe(r.ruta.split('?')[0]).replace(/^MaKo - /, '').trim() : '';
  const donde = pantalla && pantalla !== 'MaKo' ? `la pantalla «${pantalla}»` : 'una pantalla de MaKo';
  if (r.origen === 'servidor') return `Falló ${donde}`.slice(0, 140);
  return `${donde.charAt(0).toUpperCase()}${donde.slice(1)} ${esHidratacion(r.mensaje) ? 'se volvió a dibujar sola' : 'se rompió'}`.slice(0, 140);
}

/**
 * ¿El HTML del servidor no coincidió con el del navegador? (React #418, #423, #425.) NO ES UNA PANTALLA ROTA: React vuelve a dibujar en el
 * navegador y se sigue trabajando. Ticket #39, 1/11/2026: «La pantalla CRM se rompió», y la persona movió un lead un minuto después.
 */
export const esHidratacion = (mensaje: string): boolean => /Minified React error #(418|423|425)\b|Hydration failed/i.test(mensaje);

/**
 * Lo que puede haber tocado la página antes de hidratar. Un caso suelto no se reproduce, y sin esto nunca se sabe: `<font>` es el traductor
 * del navegador, una etiqueta con guion que no es nuestra es una extensión. Sólo cantidades y nombres de etiqueta: ningún texto de la página.
 * `next-route-announcer` la pone Next en toda página: contarla decía «ajenas» de un caso sin ninguna (ticket #52, 4/11/2026).
 */
export function pistasDeHidratacion(doc: Pick<Document, 'documentElement' | 'getElementsByTagName'>, idioma: string): string {
  const html = doc.documentElement;
  const etiquetas = new Set([...doc.getElementsByTagName('*')].map((n) => n.tagName.toLowerCase()).filter((n) => n.includes('-') && n !== 'next-route-announcer'));
  return [
    `font=${doc.getElementsByTagName('font').length}`,
    `traducida=${/translated-/.test(html.className) ? 'si' : 'no'}`,
    `lang=${html.lang}`,
    `navegador=${idioma}`,
    `ajenas=${[...etiquetas].slice(0, 5).join(',')}`,
  ].join('; ').replace(/[^\w =;,.-]/g, '').slice(0, 200);
}

/** Lo que va al ticket: el título, una descripción para el cliente y el contexto técnico (para Martín y el Cerebro). */
export function ticketDeError(r: ReporteError, veces = 1): { titulo: string; descripcion: string; contexto: Record<string, unknown> } {
  return {
    titulo: tituloDeError(r),
    descripcion: r.origen === 'mako'
      ? 'MaKo lo detectó solo: intentó hacerlo y falló. El equipo ya lo está viendo.'
      : esHidratacion(r.mensaje)
        ? 'MaKo lo detectó solo: la pantalla se volvió a dibujar al abrir. Puedes seguir trabajando; el equipo ya lo está viendo.'
        : 'MaKo lo detectó solo: se rompió una pantalla de la app. El equipo ya lo está viendo.',
    contexto: {
      error: `${r.nombre}: ${r.mensaje}${r.digest ? ` (digest ${r.digest})` : ''}${veces > 1 ? ` · ${veces} veces` : ''}`,
      ...(r.origen === 'mako' ? { herramienta: r.nombre } : {}),
      ...(r.ruta ? { ruta: r.ruta } : {}),
      ...(r.navegador ? { navegador: r.navegador } : {}),
      ...(r.pistas ? { pistas: r.pistas } : {}),
      ...(r.pantalla ? { pantalla: r.pantalla } : {}),
      chat: { donde: `error-${r.origen}`, ...(r.hilo ? { hilo: r.hilo } : {}) },
    },
  };
}

/** Cuántos errores NUEVOS (huellas que no existían) puede abrir una persona por día: más es un bucle o un abuso. */
export const TOPE_ERRORES_NUEVOS_POR_DIA = 10;
/** Cuántos afectados se guardan por huella (para avisarles cuando esté). */
export const TOPE_AFECTADOS = 20;
/** Si vuelve a pasar más de esto DESPUÉS de resuelto, es una regresión: un ticket nuevo. */
export const MARGEN_REGRESION_MS = 15 * 60 * 1000;

export type Afectado = { ws: number; email: string };
/** La lista de afectados tal como está guardada; lo que no cierra se descarta. */
export function leerAfectados(lista: unknown): Afectado[] {
  return Array.isArray(lista) ? lista.filter((x): x is Afectado =>
    !!x && typeof x === 'object' && Number.isInteger((x as { ws?: unknown }).ws) && typeof (x as { email?: unknown }).email === 'string') : [];
}
/** Suma un afectado a la lista, sin repetir y con tope. */
export function conAfectado(lista: unknown, a: Afectado): Afectado[] {
  const xs = leerAfectados(lista);
  if (xs.some((x) => x.ws === a.ws && x.email === a.email) || xs.length >= TOPE_AFECTADOS) return xs;
  return [...xs, a];
}
