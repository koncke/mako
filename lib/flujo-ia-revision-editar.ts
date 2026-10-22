// =============================================================================
// flujo-ia-revision-editar — lo que se hace con lo que devolvió el modelo al EDITAR (puro: los tests le pasan la respuesta grabada)
// =============================================================================
// La ruta (app/api/chat-agent/secuencias/ia/route.ts) llama a `revisarEdicion` en cada intento del modelo, y a
// `etapaQueNoExiste` ANTES del modelo. Lo que vive acá salió de la llamada con Mauricio (22/10/2026) y del arnés del Cerebro
// contra producción (87365c830): dos fallas que la regla del prompt sola no cerraba.
//
//   · «EDITALOS Y AGREGALOS» PISABA: con dos WhatsApp en el lienzo y «Los textos que te pasé no están en el flujo. Editalos y
//     agregalos:» + dos textos, el modelo CAMBIÓ los dos mensajes que había por los nuevos. Si el pedido es SUMAR
//     (`pideAgregar`) y el modelo cambió el texto de un mensaje que ya estaba, vuelve al modelo con el error que lo dice.
//   · «HAZLO COMO TE LO INDIQUÉ» CON TODO HECHO decía «No cambió nada»: si el modelo no cambió nada y los textos que el dueño
//     pegó en la charla ya están en el flujo, se le dice eso (`yaEstaEnElFlujo`).
//   · UNA ETAPA QUE NO EXISTE («que arranque cuando entra a la etapa «Clientes VIP Platino»»): el modelo no devolvía nada y
//     salía «No cambió nada». Se contesta ANTES del modelo, con las etapas que tiene ese CRM, y el CRON no se toca.
// =============================================================================
import { deIAEdicion, erroresEdicion, type CtxIA, type ResultadoEdicion } from './flujo-ia';
import { errorDeRespuestaEnEditar, charlaConTextos, traeTextosPegados, type IntencionChat } from './flujo-ia-intencion';
import { esConsulta } from './flujo-ia-consulta';
import { claseDe, idDe, type PasoGrafo } from './flujo-grafo';

type Charla = readonly { de: string; texto?: string | null }[];

/** Sin tildes, en minúsculas y con un espacio entre palabras: para comparar nombres y textos. */
const plano = (t: unknown): string => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Un texto para reconocerlo en un mensaje: sólo letras y números (así «{Nombre}» y «{{nombre}}» dan lo mismo). */
const huella = (t: unknown): string => plano(t).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** El error para el reintento cuando el pedido era SUMAR y el modelo cambió lo que ya estaba. */
export const ERROR_AGREGAR_PISA = 'El dueño pidió AGREGAR: los mensajes que ya están quedan como están (no los cambies). Los textos nuevos van en "agregar", como tarjetas nuevas después del último mensaje, en el orden en que los pegó.';

/** ¿El pedido es SUMAR («agregá», «sumá», «añadí», «incluí»), sin pedir cambiar lo que hay? («Editalos y agregalos» suma.) */
export function pideAgregar(pedido: string): boolean {
  const t = plano(pedido);
  return /\b(agreg|suma|sume|anad|inclu)/.test(t) && !/\b(cambi|reemplaz|sustitu|reescrib|modific|corrig|en (lugar|vez) de)/.test(t);
}

/** ¿El modelo cambió el TEXTO de un mensaje que ya estaba? */
export function cambioTextoDeMensajes(base: readonly PasoGrafo[], r: Pick<ResultadoEdicion, 'cambiadas' | 'pasos'>): boolean {
  const antes = new Map(base.map((p, i) => [idDe(p, i), p]));
  return r.cambiadas.some((id) => {
    const a = antes.get(id);
    const b = r.pasos.find((q) => q.id === id);
    return !!a && !!b && claseDe(a) === 'mensaje' && huella(a.cuerpo) !== huella(b.cuerpo);
  });
}

/** Los mensajes AGREGADOS cuyo texto ya está en otro mensaje del flujo (una copia): sus textos. */
export function mensajesCopiados(base: readonly PasoGrafo[], r: Pick<ResultadoEdicion, 'agregadas' | 'pasos'>): string[] {
  const ya = new Set(base.filter((p) => claseDe(p) === 'mensaje').map((p) => huella(p.cuerpo)).filter(Boolean));
  return r.agregadas
    .map((id) => r.pasos.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p && claseDe(p) === 'mensaje' && ya.has(huella(p.cuerpo)))
    .map((p) => String(p.cuerpo ?? ''));
}

/** El error para el reintento cuando agregó una copia de un mensaje que ya está. */
export function errorDeCopia(textos: readonly string[]): string {
  const corto = (t: string) => (t.length > 50 ? `${t.slice(0, 50).trim()}…` : t);
  return `«${corto(textos[0])}» ya está en el flujo: no lo agregues otra vez. Si lo que pide el dueño ya está hecho, contesta en "respuesta" que ya está.`;
}

/** Los textos que el dueño pegó en un mensaje: los renglones con texto de verdad, sin el renglón que da la orden («…:»). */
export function textosPegados(texto: string): string[] {
  return String(texto ?? '').split('\n').map((l) => l.trim().replace(/^\d+[.)]\s*/, '')).filter((l) => l.length >= 20 && !/:\s*$/.test(l));
}

/** «Hazlo como te dije» con lo pedido YA hecho: si los textos que pegó en la charla están todos en el flujo, se le dice. */
export function yaEstaEnElFlujo(historial: Charla, base: readonly PasoGrafo[]): string | null {
  const pegado = [...historial].reverse().find((m) => m.de === 'yo' && traeTextosPegados(String(m.texto ?? '')));
  const textos = pegado ? textosPegados(String(pegado.texto)) : [];
  if (!textos.length) return null;
  const cuerpos = base.filter((p) => claseDe(p) === 'mensaje').map((p) => huella(p.cuerpo));
  if (!textos.every((t) => cuerpos.some((c) => c.includes(huella(t).slice(0, 60))))) return null;
  const corto = (t: string) => (t.length > 40 ? `${t.slice(0, 40).trim()}…` : t);
  return `Ya están en el flujo: ${textos.map((t) => `«${corto(t)}»`).join(' y ')}. Si quieres otra cosa, dime qué cambio.`;
}

export type EtapaQueNoExiste = { etapa: string; crm: string | null; opciones: string[] };

/**
 * La etapa que el pedido nombra ENTRE COMILLAS («la etapa «X»», y «del CRM «Y»» si lo dice) y que ese CRM no tiene (o ninguno,
 * si no dice cuál). Sólo entre comillas: un nombre suelto no se sabe dónde termina, y adivinar es lo que no se quiere.
 */
export function etapaQueNoExiste(pedido: string, ctx: Pick<CtxIA, 'productos'>): EtapaQueNoExiste | null {
  const m = /\betapa\s+[«"“]([^»"”]+)[»"”]/i.exec(String(pedido ?? ''));
  if (!m) return null;
  const etapa = m[1].trim();
  const c = /\bCRM\s+[«"“]([^»"”]+)[»"”]/i.exec(String(pedido ?? ''));
  const conEmbudo = ctx.productos.filter((p) => p.funnelId != null);
  const delCrm = c ? conEmbudo.filter((p) => plano(p.nombre) === plano(c[1])) : [];
  const donde = delCrm.length ? delCrm : conEmbudo;
  const tiene = donde.some((p) => [...p.etapas, ...(p.etapasEntrega ?? [])].some((e) => plano(e.label) === plano(etapa) || plano(e.value) === plano(etapa)));
  if (tiene) return null;
  return { etapa, crm: delCrm[0]?.nombre ?? (c ? c[1].trim() : null), opciones: delCrm[0]?.etapas.map((e) => e.label) ?? [] };
}

/** Lo que contesta MaKo con una etapa que no existe: no la inventa, no pone otra, y dice las que hay. */
export function textoEtapaQueNoExiste(x: EtapaQueNoExiste): string {
  const en = x.crm ? ` en «${x.crm}»` : '';
  const hay = x.opciones.length ? ` Las que tiene: ${x.opciones.slice(0, 10).map((o) => `«${o}»`).join(', ')}.` : '';
  return `La etapa «${x.etapa}» no existe${en}, así que no cambié qué la dispara.${hay} Créala en el CRM o dime cuál de ésas.`;
}

/**
 * LO QUE SE HACE CON UN INTENTO DEL MODELO AL EDITAR: el borrador (`deIAEdicion`) y los errores que hacen reintentar.
 *   0. lo pedido en la charla YA está hecho (`yaEstaEnElFlujo`) y el modelo contestó o agregó copias → eso es la respuesta;
 *   1. una "respuesta" en Editar que no vale (`errorDeRespuestaEnEditar`) → error;
 *   2. agregó un WhatsApp idéntico a uno que ya está (`mensajesCopiados`) → error;
 *   3. pidió SUMAR y cambió lo que había (`pideAgregar` + `cambioTextoDeMensajes`) → `ERROR_AGREGAR_PISA`;
 *   4. no cambió nada y lo pedido en la charla ya está hecho → eso es la respuesta;
 *   5. lo de siempre (`erroresEdicion`).
 */
export function revisarEdicion(o: {
  obj: unknown; base: readonly PasoGrafo[]; ctx: CtxIA; pedido: string; historial: Charla; intencion: IntencionChat | null;
}): { r: ResultadoEdicion; errores: string[] } {
  const r = deIAEdicion(o.obj, o.base, o.ctx);
  // Lo pedido en la charla YA está hecho: eso es lo que se contesta, diga lo que diga el modelo (22/10/2026, el arnés del
  // Cerebro: «Ya están en el flujo» lo rechazaba `errorDeRespuestaEnEditar`, y el reintento los agregaba OTRA vez).
  const hecho = (): { r: ResultadoEdicion; errores: string[] } | null => {
    const ya = yaEstaEnElFlujo(o.historial, o.base);
    return ya ? { r: { ...r, respuesta: ya, resumen: ya }, errores: [] } : null;
  };
  if (r.respuesta) {
    const ya = hecho();
    if (ya) return ya;
    const e = o.intencion === 'editar' ? errorDeRespuestaEnEditar(o.pedido, r.respuesta, { esPregunta: esConsulta(o.pedido), charlaConTextos: charlaConTextos(o.historial) }) : null;
    return { r, errores: e ? [e] : [] };
  }
  // Un WhatsApp idéntico a uno que ya está no se agrega (el filtro de copias sólo corría en un cambio de canal).
  const copias = mensajesCopiados(o.base, r);
  if (copias.length) return hecho() ?? { r, errores: [errorDeCopia(copias)] };
  if (pideAgregar(o.pedido) && cambioTextoDeMensajes(o.base, r)) return { r, errores: [ERROR_AGREGAR_PISA] };
  const errores = erroresEdicion(o.base, r, o.ctx);
  if (errores.length === 1 && errores[0] === 'no cambió nada') {
    const ya = yaEstaEnElFlujo(o.historial, o.base);
    if (ya) return { r: { ...r, respuesta: ya, resumen: ya }, errores: [] };
  }
  return { r, errores };
}
