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
import { deIAEdicion, erroresEdicion, textosDeMensajes, pidioAviso, ultimoMensajeDelCamino, haySeguimiento, RE_SEGUIMIENTO, type CtxIA, type ResultadoEdicion } from './flujo-ia';
import {
  errorDeRespuestaEnEditar, charlaConTextos, traeTextosPegados, faltantesDelPedido, errorDeFaltantes, sobrantesDelPedido, pideQueQuedeSolo,
  errorDeSobrantes, NO_HECHO_SOLO_ESO, noHechoSobrante, sinCitas, type IntencionChat,
} from './flujo-ia-intencion';
import { esConsulta } from './flujo-ia-consulta';
import { claseDe, idDe, raizRespuesta, descendientes, type PasoGrafo } from './flujo-grafo';

type Charla = readonly { de: string; texto?: string | null }[];

/** Sin tildes, en minúsculas y con un espacio entre palabras: para comparar nombres y textos. */
const plano = (t: unknown): string => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Un texto para reconocerlo en un mensaje: sólo letras y números (así «{Nombre}» y «{{nombre}}» dan lo mismo). */
const huella = (t: unknown): string => plano(t).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** El error para el reintento cuando el pedido era SUMAR y el modelo cambió lo que ya estaba. */
export const ERROR_AGREGAR_PISA = 'El dueño pidió AGREGAR: los mensajes que ya están quedan como están (no los cambies). Los textos nuevos van en "agregar", como tarjetas nuevas después del último mensaje, en el orden en que los pegó.';

/** ¿El pedido es SUMAR («agregá», «sumá», «añadí», «incluí»), sin pedir cambiar lo que hay? («Editalos y agregalos» suma.) */
export function pideAgregar(pedido: string): boolean {
  // Sin las citas (`sinCitas`): «te agrego al grupo» adentro de un mensaje no es «agregá».
  const t = plano(sinCitas(pedido));
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
 * LAS PIEZAS PEDIDAS QUE NO QUEDARON (23/10/2026, #289 medido en seco con Haiku, 3 corridas: «sólo apertura, un
 * seguimiento si no responden, y si responde se corta y le avisa a Ana por el grupo»). Una corrida se llevó el aviso al
 * grupo junto con los mensajes que sobraban; otra metió el seguimiento ADENTRO de «Si responde» (donde no hay esperas: el
 * código las saca y el seguimiento quedaba sin espera). Lo que se mira, sólo si el pedido lo nombra:
 *   · un SEGUIMIENTO («seguimiento», «si no responde»): una espera de tiempo seguida de un mensaje (con o sin la condición
 *     en el medio) en el camino del lead;
 *   · el AVISO al equipo (`pidioAviso`, salvo que pida sacarlo): una «MaKo en WhatsApp».
 */
// (`RE_SEGUIMIENTO`, lib/flujo-ia.ts: la misma que decide cuándo poner «No contestó».)
const RE_AVISO_AL_RESPONDER = /(?<!no )(?:cuando|una vez que|apenas|en cuanto|si)\s+(?:alguien |el lead |la persona |me |te |le |nos )?(?:responde|contesta)n?(?!\p{L})[^.]{0,160}?(?:avis|notific)/iu;
const esAviso = (p: PasoGrafo): boolean => (p as { accion?: { operacion?: string } }).accion?.operacion === 'avisar_al_equipo';
const RE_SACAR_AVISO = /(?<!\p{L})(?:sac|quit|elimin|borr(?!ador))\p{L}*\s+(?:\p{L}+\s+){0,2}avis/iu;
function formaPedida(pedidoEntero: string, pasos: readonly PasoGrafo[], base: readonly PasoGrafo[]): Array<{ error: string; rojo: string }> {
  const out: Array<{ error: string; rojo: string }> = [];
  // La ORDEN, sin los textos citados (`sinCitas`, 23/10/2026): el «Me avisas» de un seguimiento no es un aviso al grupo, y
  // el control le pedía al modelo un aviso que nadie pidió (el arnés del AU2, `seguimiento-no-contesto`).
  const pedido = sinCitas(pedidoEntero);
  if (RE_SEGUIMIENTO.test(pedido)) {
    if (!haySeguimiento(pasos)) out.push({
      error: 'El dueño pidió un SEGUIMIENTO si no responde: va en el camino del lead, después del último mensaje: un "esperar" y el mensaje, detrás de "contesto" con "no": true. Nunca adentro de "si_responde".',
      rojo: 'El seguimiento «si no responde» no quedó: falta la espera y su mensaje después del último mensaje',
    });
  }
  // «Sólo X» que se llevó X (medido en seco: «sólo apertura» terminó sin un solo mensaje): el camino del lead no puede quedar
  // sin mensajes si los tenía.
  if (pideQueQuedeSolo(pedidoEntero) && base.some((p) => claseDe(p) === 'mensaje') && ultimoMensajeDelCamino(pasos) == null) {
    out.push({
      error: 'Con «sólo X» se queda X: quitaste también los mensajes del camino del lead. Devuelve los que son X (por ejemplo, los de apertura) y quita sólo lo que sobra.',
      rojo: 'Quedó sin ningún mensaje al lead: no saqué lo que pediste conservar',
    });
  }
  // «Cuando responde, le avisa al grupo»: el aviso va DEBAJO de «Si responde» (medido en seco: quedaba colgado del
  // seguimiento, o sin «Si responde», y nadie se enteraba de la respuesta).
  const resp = raizRespuesta(pasos);
  const bajoResp = new Set(resp ? [resp, ...descendientes(pasos, resp)] : []);
  if (RE_AVISO_AL_RESPONDER.test(pedido) && !pasos.some((p, i) => bajoResp.has(idDe(p, i)) && esAviso(p))) {
    out.push({
      error: 'El dueño pidió que cuando el lead responda le avisen al grupo: la "accion" "avisar_al_equipo" va en el "otra_cosa" de "si_responde" (una sola "si_responde", sin padre).',
      rojo: 'No quedó el aviso al grupo cuando el lead responde',
    });
  }
  if (pidioAviso(pedido) && !RE_SACAR_AVISO.test(pedido) && !pasos.some(esAviso)) {
    out.push({
      error: 'El dueño pidió que le avisen al grupo y no quedó ningún aviso: falta la "accion" "avisar_al_equipo" donde lo pidió (si es cuando el lead responde, en el "otra_cosa" de "si_responde").',
      rojo: 'No quedó el aviso al grupo que pediste',
    });
  }
  return out;
}

/**
 * LO QUE SE HACE CON UN INTENTO DEL MODELO AL EDITAR: el borrador (`deIAEdicion`) y los errores que hacen reintentar.
 *   0. lo pedido en la charla YA está hecho (`yaEstaEnElFlujo`) y el modelo contestó o agregó copias → eso es la respuesta;
 *   1. una "respuesta" en Editar que no vale (`errorDeRespuestaEnEditar`) → error;
 *   2. agregó un WhatsApp idéntico a uno que ya está (`mensajesCopiados`) → error;
 *   3. pidió SUMAR y cambió lo que había (`pideAgregar` + `cambioTextoDeMensajes`) → `ERROR_AGREGAR_PISA`;
 *   4. no cambió nada y lo pedido en la charla ya está hecho → eso es la respuesta;
 *   5. lo de siempre (`erroresEdicion`);
 *   6. EL CONTROL DE LO PEDIDO (22/10/2026, Martín: «creó a la mitad las cosas que le pedí»): lo que el dueño pegó entre
 *      comillas y no quedó en ningún mensaje (`faltantesDelPedido`). Y desde el 23/10 (#289: «sólo quiero que sea de
 *      Apertura» y quedaron los mensajes de después) también lo que había que SACAR: lo que pidió sacar entre comillas y
 *      sigue (`sobrantesDelPedido`), y «que quede sólo eso» sin quitar ninguno de los mensajes que había
 *      (`pideQueQuedeSolo`). La PRIMERA vez del turno es UN error con todo para el reintento (`control`, que la ruta crea
 *      una vez por turno); después se aplica lo que hay y se dice en ROJO (`noHecho`).
 */
export function revisarEdicion(o: {
  obj: unknown; base: readonly PasoGrafo[]; ctx: CtxIA; pedido: string; historial: Charla; intencion: IntencionChat | null;
  /** Uno por turno (la ruta): si el control de lo pedido ya volvió al modelo. Sin él, cada intento es el primero. */
  control?: { yaPidioLoQueFalta: boolean };
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
  if (errores.length) return { r, errores };
  const textos = textosDeMensajes(r.pasos);
  const faltan = faltantesDelPedido(o.pedido, textos);
  const sobran = sobrantesDelPedido(o.pedido, textos);
  const mensajesDeAntes = o.base.map((p, i) => ({ p, id: idDe(p, i) })).filter((x) => claseDe(x.p) === 'mensaje');
  const soloSinQuitar = pideQueQuedeSolo(o.pedido) && mensajesDeAntes.length > 0 && !mensajesDeAntes.some((x) => r.quitadas.includes(x.id));
  const forma = formaPedida(o.pedido, r.pasos, o.base);
  const control = o.control ?? { yaPidioLoQueFalta: false };
  if ((faltan.length || sobran.length || soloSinQuitar || forma.length) && !control.yaPidioLoQueFalta) {
    control.yaPidioLoQueFalta = true;
    return { r, errores: [[faltan.length ? errorDeFaltantes(faltan) : '', errorDeSobrantes(sobran, soloSinQuitar), ...forma.map((f) => f.error)].filter(Boolean).join(' ')] };
  }
  const rojo = [
    ...faltan.map((t) => `No quedó en el lienzo: «${t}»`),
    ...sobran.map(noHechoSobrante),
    ...(soloSinQuitar ? [NO_HECHO_SOLO_ESO] : []),
    ...forma.map((f) => f.rojo),
  ];
  if (rojo.length) r.noHecho = [...(r.noHecho ?? []), ...rojo];
  return { r, errores: [] };
}
