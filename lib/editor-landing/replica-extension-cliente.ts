// =============================================================================
// El lado de la pantalla de «Replicar con la extensión» (9/11/2026)
// =============================================================================
// Martín (9/11/2026): «habíamos quedado en actualizar la extensión de Mako para que se pueda replicar por allí. Y de esa
// manera siempre vamos a poder replicar cualquier landing». Cuando el servidor de MaKo no puede bajar una página (un
// antibots, un 403 o un 429, una app que no corre aislada), la extensión la abre en una pestaña a la vista, la persona pasa
// la barrera si la hay y toca el ícono de MaKo, y la extensión saca ahí la foto de la copia idéntica
// (lib/editor-landing/replica-extension-script.ts → extension/replica-leer.js). Esto es lo que habla con ella desde
// Replicar, por eventos del DOM como el resto del puente (extension/mako-puente.js):
//   · `pedirReplica`: abre la página (`MAKO_REPLICA_PIDO` → `MAKO_REPLICA`, con su `id`);
//   · `alEstadoDeReplica`: cómo va (leyendo, fallo, cerrada) y la foto lista (`MAKO_REPLICA_LISTA`, que se acusa con
//     `MAKO_REPLICA_RECIBIDA`: sin ese acuse, la extensión abre Replicar en otra pestaña);
//   · `tomarEntrega`, `soltarEntrega`, `volverAEntrega`, `cancelarReplica`: tomar la foto, quedarse con ella (la pestaña se
//     cierra), volver a la pestaña (era la verificación) o cancelar;
//   · `juzgarEntrega`: si lo que se copió es la página o la verificación de un antibots (lo decide MaKo, no la extensión:
//     así un cambio en una barrera se arregla con un deploy y no con otra versión en la tienda).
//
// Sin `server-only` y sin React: lo prueban los tests con una ventana de mentira.
// =============================================================================

import { esMasVieja } from '../version-comparar';
import { esDesafioDeBot } from '../landing-extraer';
import { esPaginaDeError } from '../pagina-real';
import { VERSION_REPLICA, type MotivoReplica } from './replica-extension-script';

export { VERSION_REPLICA };

/** Lo mínimo para hablar con el puente (`window`, o una ventana de mentira en los tests). */
export type VentanaReplica = {
  addEventListener: (tipo: string, fn: (e: Event) => void) => void;
  removeEventListener: (tipo: string, fn: (e: Event) => void) => void;
  dispatchEvent: (e: Event) => boolean;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (t: never) => void;
};

/** ¿Hay extensión, y sabe replicar? La versión es la que el puente deja en <html data-mako-puente>. */
export function extensionReplica(version: string | null | undefined): 'si' | 'vieja' | 'no' {
  if (!version) return 'no';
  return esMasVieja(version, VERSION_REPLICA) ? 'vieja' : 'si';
}

/**
 * El link que abre Replicar del Web Generator con `url`, arrancando solo (`?replicar=`, panel-reglas.ts → `derechaDeQuery`).
 * Lo usan «Copiar su sitio» de Competitors Spy y, con `entrega`, la extensión (la foto ya está en ella).
 */
export function hrefReplicar(url: string, entrega?: string): string {
  const q = new URLSearchParams({ replicar: url });
  if (entrega && entregaValida(entrega)) q.set('extension', entrega);
  return `/web-generator?${q.toString()}`;
}

/** Abrir una pestaña es inmediato: sin respuesta en este rato, no hay puente. */
export const ESPERA_PUENTE_MS = 6_000;
/** Tomar la foto de la extensión (megas por el DOM): con aire. */
export const ESPERA_TOMAR_MS = 15_000;
/** Sin noticias de la lectura en este rato, se cortó (la página se recargó o se fue). */
export const SILENCIO_LECTURA_MS = 100_000;

/** Un id de pedido que el worker acepta (`/^[A-Za-z0-9_.-]{4,80}$/`). */
export const nuevoPedido = (): string => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** Una entrega con la forma que acuña el worker (24 hex). */
export const entregaValida = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{24}$/.test(v);

/** Un pedido con respuesta: dispara `pide` con un `id` y espera `contesta` con el MISMO `id` (otro en vuelo no lo cierra). */
function conRespuesta<T>(v: VentanaReplica, pide: string, contesta: string, detalle: Record<string, unknown>, espera: number, leer: (d: Record<string, unknown>) => T, sinRespuesta: T): Promise<T> {
  return new Promise((resolve) => {
    const id = nuevoPedido();
    let listo = false;
    const fin = (r: T) => {
      if (listo) return;
      listo = true;
      v.removeEventListener(contesta, al);
      v.clearTimeout(t as never);
      resolve(r);
    };
    const al = (e: Event) => {
      const d = (e as CustomEvent).detail as Record<string, unknown> | null;
      if (!d || d.id !== id) return;
      fin(leer(d));
    };
    v.addEventListener(contesta, al);
    const t = v.setTimeout(() => fin(sinRespuesta), espera);
    v.dispatchEvent(new CustomEvent(pide, { detail: { id, ...detalle } }));
  });
}

export type RespuestaPedido = { ok: true; pedido: string } | { ok: false; motivo: string };

/** Le pide a la extensión que abra `url` a la vista. El `pedido` es lo que después nombra sus avisos. */
export function pedirReplica(v: VentanaReplica, url: string, esperaMs = ESPERA_PUENTE_MS): Promise<RespuestaPedido> {
  return new Promise((resolve) => {
    const pedido = nuevoPedido();
    let listo = false;
    const fin = (r: RespuestaPedido) => {
      if (listo) return;
      listo = true;
      v.removeEventListener('MAKO_REPLICA', al);
      v.clearTimeout(t as never);
      resolve(r);
    };
    const al = (e: Event) => {
      const d = (e as CustomEvent).detail as { id?: unknown; ok?: unknown; motivo?: unknown } | null;
      if (!d || d.id !== pedido) return;
      fin(d.ok === true ? { ok: true, pedido } : { ok: false, motivo: typeof d.motivo === 'string' ? d.motivo : 'extension' });
    };
    v.addEventListener('MAKO_REPLICA', al);
    const t = v.setTimeout(() => fin({ ok: false, motivo: 'sin_respuesta' }), esperaMs);
    v.dispatchEvent(new CustomEvent('MAKO_REPLICA_PIDO', { detail: { id: pedido, url } }));
  });
}

/** Cómo va la réplica de un pedido: lo que manda la extensión. */
export type AvisoReplica =
  | { fase: 'leyendo'; hecho: number }
  | { fase: 'fallo'; motivo: MotivoReplica | 'otro' }
  | { fase: 'cerrada' }
  | { fase: 'lista'; entrega: string };

/**
 * Escucha lo que pasa con `pedido`. La foto lista se ACUSA en el acto (`MAKO_REPLICA_RECIBIDA`): sin el acuse, la extensión
 * entiende que nadie la esperaba y abre Replicar en otra pestaña. Devuelve cómo dejar de escuchar.
 */
export function alEstadoDeReplica(v: Pick<VentanaReplica, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>, pedido: string, fn: (a: AvisoReplica) => void): () => void {
  const alEstado = (e: Event) => {
    const d = (e as CustomEvent).detail as { pedido?: unknown; fase?: unknown; hecho?: unknown; motivo?: unknown } | null;
    if (!d || d.pedido !== pedido) return;
    if (d.fase === 'leyendo') fn({ fase: 'leyendo', hecho: typeof d.hecho === 'number' && Number.isFinite(d.hecho) ? Math.max(0, Math.min(100, Math.round(d.hecho))) : 0 });
    else if (d.fase === 'fallo') fn({ fase: 'fallo', motivo: (['vacia', 'pesada', 'excepcion', 'ocupada'] as const).find((m) => m === d.motivo) ?? 'otro' });
    else if (d.fase === 'cerrada') fn({ fase: 'cerrada' });
  };
  const alLista = (e: Event) => {
    const d = (e as CustomEvent).detail as { pedido?: unknown; entrega?: unknown } | null;
    if (!d || d.pedido !== pedido || !entregaValida(d.entrega)) return;
    v.dispatchEvent(new CustomEvent('MAKO_REPLICA_RECIBIDA', { detail: { pedido } }));
    fn({ fase: 'lista', entrega: d.entrega });
  };
  v.addEventListener('MAKO_REPLICA_ESTADO', alEstado);
  v.addEventListener('MAKO_REPLICA_LISTA', alLista);
  return () => { v.removeEventListener('MAKO_REPLICA_ESTADO', alEstado); v.removeEventListener('MAKO_REPLICA_LISTA', alLista); };
}

/** Lo que entrega la extensión: la foto (la sanea el server, `sanearInstantanea`), el texto que se veía y de dónde salió. */
export type EntregaReplica = {
  entrega: string;
  /** La dirección que se pidió (o la de la pestaña, si la persona la abrió por su cuenta: sin su consulta). */
  url: string;
  /** La dirección en la que estaba la pestaña al copiarla (una redirección la cambia), sin su consulta. */
  leida: string;
  titulo: string;
  foto: Record<string, unknown>;
  texto: string;
  /** La lectura llegó a su tope antes de terminar de bajar. */
  parcial: boolean;
};

/** Toma la foto de `entrega` (no la borra: si era la verificación, se vuelve a la pestaña). null si ya no está. */
export function tomarEntrega(v: VentanaReplica, entrega: string, esperaMs = ESPERA_TOMAR_MS): Promise<EntregaReplica | null> {
  return conRespuesta<EntregaReplica | null>(v, 'MAKO_REPLICA_TOMAR', 'MAKO_REPLICA_FOTO', { entrega }, esperaMs, (d) => {
    if (d.ok !== true || !d.foto || typeof d.foto !== 'object' || typeof d.url !== 'string') return null;
    return {
      entrega, url: d.url, leida: typeof d.leida === 'string' ? d.leida : '', titulo: typeof d.titulo === 'string' ? d.titulo : '',
      foto: d.foto as Record<string, unknown>, texto: typeof d.texto === 'string' ? d.texto : '', parcial: d.parcial === true,
    };
  }, null);
}

/** MaKo se queda con la foto: la extensión la borra y cierra la pestaña que abrió. */
export function soltarEntrega(v: Pick<VentanaReplica, 'dispatchEvent'>, entrega: string): void {
  v.dispatchEvent(new CustomEvent('MAKO_REPLICA_SOLTAR', { detail: { entrega } }));
}

/**
 * Lo copiado era la verificación: la foto se tira y la pestaña vuelve al frente para pasarla y tocar el ícono otra vez. Con
 * `pedido`, la extensión avisa a ESTA pestaña con ese nombre (una entrega que llegó por la dirección no tenía ninguno).
 */
export function volverAEntrega(v: VentanaReplica, entrega: string, esperaMs = ESPERA_PUENTE_MS, pedido?: string): Promise<boolean> {
  return conRespuesta(v, 'MAKO_REPLICA_VOLVER', 'MAKO_REPLICA_VUELTA', { entrega, ...(pedido ? { pedido } : {}) }, esperaMs, (d) => d.ok === true, false);
}

/** La persona cancela: la pestaña que abrió la extensión para este pedido se cierra. */
export function cancelarReplica(v: Pick<VentanaReplica, 'dispatchEvent'>, pedido: string): void {
  v.dispatchEvent(new CustomEvent('MAKO_REPLICA_CANCELAR', { detail: { pedido } }));
}

/**
 * ¿Lo copiado es la página? `desafio`: la verificación de un antibots («Just a moment...»): la persona la pasa en la pestaña y
 * vuelve a tocar el ícono. `error`: la página de error del sitio. `vacia`: no hay nada que copiar.
 */
export function juzgarEntrega(e: Pick<EntregaReplica, 'titulo' | 'foto' | 'texto'>): 'ok' | 'desafio' | 'error' | 'vacia' {
  const cuerpo = typeof e.foto.cuerpo === 'string' ? e.foto.cuerpo : '';
  const titulo = (e.titulo || (typeof e.foto.titulo === 'string' ? e.foto.titulo : '')).slice(0, 300);
  const inicio = `<title>${titulo}</title>${cuerpo.slice(0, 30_000)}`;
  if (esDesafioDeBot(inicio) || /verif(?:y|ying) you are (?:a )?human|checking (?:if the site connection is secure|your browser)|security checkpoint|verificando que eres (?:un )?humano/i.test(`${titulo} ${e.texto.slice(0, 2_000)}`)) return 'desafio';
  if (esPaginaDeError(e.texto.slice(0, 240), titulo)) return 'error';
  if (!/\S/.test(cuerpo)) return 'vacia';
  return 'ok';
}

/** Lo que dice la pantalla de cada cosa que puede salir mal (corto: una línea, que arranca con lo que se hace). */
export const MENSAJE_REPLICA = {
  sinExtension: 'Instala la extensión de MaKo para copiar esta página desde tu navegador.',
  vieja: 'Actualiza la extensión de MaKo para copiar esta página desde tu navegador.',
  noAbrio: 'No pude abrir la página con la extensión. Recarga MaKo y vuelve a intentar.',
  abierta: 'Se abrió en otra pestaña. Cuando la veas entera, toca el ícono de MaKo.',
  cerrada: 'Cerraste la pestaña antes de copiarla. Vuelve a intentar.',
  cortada: 'La copia se cortó (la página se recargó o se fue). Toca el ícono de MaKo otra vez en esa pestaña.',
  vencida: 'La copia ya no está en la extensión. Vuelve a intentar.',
  desafio: 'Todavía se veía la verificación de la página. Pásala en esa pestaña y toca el ícono de MaKo otra vez.',
  error: 'Lo que se veía era la página de error del sitio. Recárgala y toca el ícono de MaKo otra vez.',
  vacia: 'No había nada que copiar: espera a que termine de cargar y toca el ícono de MaKo otra vez.',
  pesada: 'La página pesa demasiado para copiarla tal cual. Prueba el formato «Landing».',
  excepcion: 'No pude copiarla. Recarga esa pestaña y toca el ícono de MaKo otra vez.',
  ocupada: 'Ya la estoy copiando: espera unos segundos.',
} as const;

/** El mensaje del fallo de la lectura en la pestaña. */
export function mensajeDeFallo(motivo: MotivoReplica | 'otro'): string {
  return motivo === 'otro' ? MENSAJE_REPLICA.excepcion : MENSAJE_REPLICA[motivo];
}
