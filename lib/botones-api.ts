// =============================================================================
// botones-api — el texto y los botones de UN DM que se cambian por la API de MaKo (puro: lo usan el runner y el test, 25/10/2026)
// =============================================================================
// `cambiar_botones_mensaje` (lib/api-mako/areas/chatbot.def.ts): Leandro configura con su Claude por la API, y los botones
// sólo existían en el lienzo. Acá va TODO lo que se puede saber sin escribir: la tarjeta, cada botón, y que el flujo con los
// botones nuevos se pueda publicar (`validarGrafo`, que también mira los botones: `problemasDeBotones`). Sólo cuentan los
// errores NUEVOS: uno que el flujo ya tenía no frena cambiar un botón. Vive aparte de lib/botones-social.ts porque ése lo
// importa lib/flujo-grafo.ts (y acá se usa el grafo).
//
// EL TEXTO (25/10, el Cerebro: «editarlos (texto del mensaje, títulos y destino de cada botón), por la misma puerta que el
// lienzo»): `editar_pasos_secuencia_mensajes` es sólo WhatsApp y email, y sin ramas; un DM con botones vive en un flujo con
// ramas. Sólo el de un DM de Instagram o Messenger, y sólo de un mensaje de UNA parte: el de varias se edita en el lienzo.
//
// EL DE UN WHATSAPP O UN EMAIL EN UN FLUJO CON RAMAS (`textoParaGuardar`, `cambiar_texto_mensaje`, 25/10, el Cerebro: «ciérralo…
// Usa la misma puerta (`publicarPasos`) y la misma ruta por tarjeta»): lo mismo para una tarjeta de WhatsApp o email. No toca
// lo que por acá no se ve: una nota de voz o un archivo, uno de varias partes, el WhatsApp oficial (una plantilla que aprobó
// Meta) ni un email con diseño (su HTML se perdería): esos, en el lienzo.
//
// ⚠️ CAMBIAR EL TEXTO SUELTA LAS VARIANTES (`variantes: []`): son otras formas de decir el texto VIEJO, y el motor sortea
// entre el cuerpo y ellas (`textoDelPaso`, lib/nutricion-canal.ts; sólo el WhatsApp no oficial: un DM no sortea, pero las
// suelta igual porque son del texto viejo). Con cuatro, a cuatro de cada cinco leads les llegaba lo que ya no decía.
// `setSecuenciaPasos` respeta el `[]` explícito; la clave ausente conserva las de antes. La misma regla que la pantalla
// (`variantesTrasCambio`, lib/mensaje-partes.ts).
// =============================================================================

import { claseDe, idDe, validarGrafo, type PasoGrafo } from './flujo-grafo';
import { botonesDe, normalizarTitulo, urlValida, TOPE_BOTONES, TOPE_TITULO_BOTON, type BotonSocial } from './botones-social';
import { esCanalSocial, TOPE_TEXTO_SOCIAL } from './canal-social';
import { partesExplicitas } from './mensaje-partes';
import { proveedorDelPaso } from './nutricion-canal';

/** Lo que de un mensaje miran estas funciones y el grafo no tipa. */
type CamposDelMensaje = { variantes?: string[] | null; cuerpo_html?: string | null; asunto?: string | null; tipo?: string | null; audio_id?: unknown; proveedor?: string | null; template_wa?: string | null };
const camposDe = (p: PasoGrafo): CamposDelMensaje => p as unknown as CamposDelMensaje;
/** El paso con el texto nuevo, sin las variantes del viejo (y cuántas eran, para decirlo). */
function conCuerpo(p: PasoGrafo, cuerpo: string): { paso: PasoGrafo; sueltas: number } {
  // El mismo texto no suelta nada: las variantes siguen siendo de ESE texto.
  const sueltas = cuerpo === String(p.cuerpo ?? '').trim() ? 0 : (camposDe(p).variantes ?? []).length;
  return { paso: { ...p, cuerpo, ...(sueltas ? { variantes: [] } : {}) } as PasoGrafo, sueltas };
}
const yVariantes = (n: number): string => (n ? ` (se quitan sus ${n} variantes del texto anterior)` : '');

/** Lo que pide quien llama: el título y UNA cosa, «sigue» (una tarjeta) o «link» (una dirección). */
export type BotonPedido = { titulo?: unknown; sigue?: unknown; link?: unknown };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Los pasos con los botones nuevos de la tarjeta `tarjeta`, o el error en palabras. `nombre` es el de la automatización (para
 * los errores). Un botón que ya estaba conserva su id si viene con el mismo título; uno nuevo toma un id libre (lo que
 * cuelga de «btn:<id>» de uno que se quedó sigue colgado). `lista` null deja los botones como están; `texto`, si viene,
 * es el texto nuevo del mensaje.
 */
export function botonesParaGuardar(pasos: readonly PasoGrafo[], tarjeta: string, lista: readonly BotonPedido[] | null, nombre: string, texto?: string, enComentario?: boolean, variantes?: readonly unknown[]):
  { ok: true; pasos: PasoGrafo[]; botones: BotonSocial[]; resumen: string } | { ok: false; error: string } {
  const i = pasos.findIndex((p, k) => idDe(p, k) === tarjeta);
  if (i < 0) return { ok: false, error: `«${nombre}» no tiene una tarjeta «${tarjeta}». Pide los ids con ficha_secuencia_mensajes.` };
  const p = pasos[i];
  if (claseDe(p) !== 'mensaje' || !esCanalSocial(p.canal)) return { ok: false, error: 'Por aquí se cambia un mensaje de Instagram o Messenger: esa tarjeta no lo es.' };
  const cuerpo = texto?.trim();
  if (lista == null && texto === undefined && enComentario === undefined && variantes === undefined) return { ok: false, error: 'Pasa los botones, el texto, «en_comentario» o «variantes».' };
  if (texto !== undefined && !cuerpo) return { ok: false, error: 'El texto del mensaje no puede quedar vacío.' };
  if (cuerpo && partesExplicitas(p)) return { ok: false, error: `El mensaje ${tarjeta} son varios mensajes seguidos: su texto se edita en el lienzo de Automations.` };
  const vs = variantes === undefined ? undefined : variantesPedidas(variantes, cuerpo || String(p.cuerpo ?? '').trim());
  if (typeof vs === 'string') return { ok: false, error: vs };
  if (vs?.length && partesExplicitas(p)) return { ok: false, error: `El mensaje ${tarjeta} son varios mensajes seguidos: las otras formas de decirlo son de UN texto.` };
  if (lista == null) {
    const botones = botonesDe(p);
    const c = cuerpo ? conCuerpo(p, cuerpo) : { paso: p, sueltas: 0 };
    const que = cuerpo ? `Texto del mensaje ${tarjeta} de «${nombre}»: «${corto(cuerpo)}»${yVariantes(c.sueltas)}` : `Mensaje ${tarjeta} de «${nombre}»`;
    return conTexto(pasos, i, conVariantes(conComentario(c.paso, enComentario), vs), botones, `${que}${yComentario(enComentario)}${yRota(vs)}`);
  }
  if (lista.length > TOPE_BOTONES) return { ok: false, error: `Instagram muestra hasta ${TOPE_BOTONES} botones.` };
  const ids = new Set(pasos.map((q, k) => idDe(q, k)));
  const antes = botonesDe(p);
  const crudos: Array<{ id?: string; titulo: string; url?: string; siguiente?: string }> = [];
  for (const b of lista) {
    const titulo = str(b.titulo);
    const sigue = str(b.sigue);
    const link = str(b.link);
    if (!titulo) return { ok: false, error: 'Cada botón necesita su título.' };
    if (titulo.length > TOPE_TITULO_BOTON) return { ok: false, error: `«${titulo}» pasa de ${TOPE_TITULO_BOTON} letras: Instagram lo corta.` };
    if (!!sigue === !!link) return { ok: false, error: `El botón «${titulo}» hace UNA cosa: «sigue» (una tarjeta) o «link» (una dirección).` };
    if (link && !urlValida(link)) return { ok: false, error: `«${link}» no es una dirección web (https://…).` };
    if (sigue && (!ids.has(sigue) || sigue === tarjeta)) return { ok: false, error: `El botón «${titulo}» va a «${sigue}», que no es otra tarjeta de «${nombre}».` };
    const previo = antes.find((a) => normalizarTitulo(a.titulo) === normalizarTitulo(titulo));
    crudos.push({ ...(previo ? { id: previo.id } : {}), titulo, ...(link ? { url: link } : { siguiente: sigue }) });
  }
  const usados = new Set(crudos.map((c) => c.id).filter((x): x is string => !!x));
  let n = 1;
  for (const c of crudos) {
    if (c.id) continue;
    while (usados.has(`b${n}`)) n++;
    c.id = `b${n}`;
    usados.add(c.id);
  }
  const botones = botonesDe({ botones: crudos }, ids);
  const { botones: _sinBotones, ...resto } = p;
  void _sinBotones;
  const paso = (botones.length ? { ...resto, botones } : resto) as PasoGrafo;
  const que = botones.length
    ? botones.map((b) => (b.url ? `«${b.titulo}» abre ${b.url}` : `«${b.titulo}» sigue en ${b.siguiente}`)).join(' · ')
    : 'sin botones';
  const c = cuerpo ? conCuerpo(paso, cuerpo) : { paso, sueltas: 0 };
  return conTexto(pasos, i, conVariantes(conComentario(c.paso, enComentario), vs), botones,
    `${cuerpo ? `Texto («${corto(cuerpo)}») y botones` : 'Botones'} del mensaje ${tarjeta} de «${nombre}»: ${que}${yVariantes(c.sueltas)}${yComentario(enComentario)}${yRota(vs)}`);
}

/**
 * LA RESPUESTA PÚBLICA AL COMENTARIO (ticket #17 de Leandro, 28/10/2026): true la prende, false la apaga, undefined la deja
 * como está. Que no lleve botones y tenga texto lo frena `validarGrafo` (`problemasDeRespuestaPublica`), como en Publicar.
 */
function conComentario(p: PasoGrafo, enComentario: boolean | undefined): PasoGrafo {
  if (enComentario === undefined) return p;
  const { en_comentario: _antes, ...resto } = p;
  void _antes;
  return (enComentario ? { ...resto, en_comentario: true } : resto) as PasoGrafo;
}
/**
 * LAS OTRAS FORMAS DE DECIRLO de un DM o de la respuesta pública (9/11/2026, el ticket #67 de Leandro: «la ficha muestra la cantidad
 * de variantes de cada tarjeta (todas en 0), pero no hay ninguna operación para cargarlas»). La lista REEMPLAZA a las de antes; []
 * las saca. El motor sortea una por persona entre el texto y ellas (`partesParaEnviar`, lib/mensaje-partes.ts). Hasta 8, como el
 * lienzo y `setSecuenciaPasos`. El error en palabras, o la lista limpia (sin vacías ni repetidas).
 */
export const TOPE_VARIANTES = 8;
function variantesPedidas(x: readonly unknown[], texto: string): string[] | string {
  const limpias: string[] = [];
  for (const v of x) {
    const t = typeof v === 'string' ? v.trim() : '';
    if (!t) return 'Cada forma de decirlo necesita su texto.';
    if (t.length > TOPE_TEXTO_SOCIAL) return `Una forma de decirlo pasa de ${TOPE_TEXTO_SOCIAL} caracteres.`;
    if (t !== texto && !limpias.includes(t)) limpias.push(t);
  }
  if (limpias.length > TOPE_VARIANTES) return `Hasta ${TOPE_VARIANTES} formas de decirlo.`;
  return limpias;
}
/** [] (las saca) se guarda EXPLÍCITO: `setSecuenciaPasos` lee la clave ausente como «se quedan las de antes». */
function conVariantes(p: PasoGrafo, vs: string[] | undefined): PasoGrafo {
  if (vs === undefined) return p;
  return { ...p, variantes: vs } as PasoGrafo;
}
const yRota = (vs: string[] | undefined): string =>
  (vs === undefined ? '' : vs.length ? ` · rota entre ${vs.length + 1} formas de decirlo` : ' · sin otras formas de decirlo');
const yComentario = (v: boolean | undefined): string =>
  (v === true ? ' · responde en público, debajo del comentario' : v === false ? ' · va por mensaje privado' : '');

/**
 * Los pasos con el texto (y/o el asunto, en un email) nuevo de UN mensaje de WhatsApp o email, o el error en palabras. Para
 * un flujo con ramas, que `editar_pasos_secuencia_mensajes` no toca. `nombre` es el de la automatización (para los errores).
 */
export function textoParaGuardar(pasos: readonly PasoGrafo[], tarjeta: string, nombre: string, nuevo: { texto?: string; asunto?: string }):
  { ok: true; pasos: PasoGrafo[]; resumen: string } | { ok: false; error: string } {
  const i = pasos.findIndex((p, k) => idDe(p, k) === tarjeta);
  if (i < 0) return { ok: false, error: `«${nombre}» no tiene una tarjeta «${tarjeta}». Pide los ids con ficha_secuencia_mensajes.` };
  const p = pasos[i];
  const m = camposDe(p);
  if (claseDe(p) !== 'mensaje') return { ok: false, error: `La tarjeta ${tarjeta} no es un mensaje.` };
  if (esCanalSocial(p.canal)) return { ok: false, error: 'Un DM de Instagram o Messenger se cambia con cambiar_botones_mensaje.' };
  const email = p.canal === 'email';
  const cuerpo = nuevo.texto?.trim();
  const asunto = nuevo.asunto?.trim();
  if (nuevo.texto === undefined && nuevo.asunto === undefined) return { ok: false, error: 'Pasa el texto, el asunto (en un email) o los dos.' };
  if (nuevo.asunto !== undefined && !email) return { ok: false, error: 'El asunto es de un email: esa tarjeta es un WhatsApp.' };
  if (nuevo.texto !== undefined && !cuerpo) return { ok: false, error: 'El texto del mensaje no puede quedar vacío.' };
  if (nuevo.asunto !== undefined && !asunto) return { ok: false, error: 'El asunto no puede quedar vacío.' };
  if (cuerpo) {
    if (m.tipo === 'audio' || m.tipo === 'media') return { ok: false, error: `El mensaje ${tarjeta} es una nota de voz o un archivo: se cambia en el lienzo de Automations.` };
    if (partesExplicitas(p)) return { ok: false, error: `El mensaje ${tarjeta} son varios mensajes seguidos: su texto se edita en el lienzo de Automations.` };
    if (!email && proveedorDelPaso(m) === 'oficial') return { ok: false, error: `El mensaje ${tarjeta} sale por el WhatsApp oficial, con una plantilla que aprobó Meta: se cambia en el lienzo de Automations.` };
    if (email && m.cuerpo_html) return { ok: false, error: `El email ${tarjeta} tiene diseño: su texto se cambia en el editor del email, en Automations (por aquí se perdería el diseño).` };
  }
  const c = cuerpo ? conCuerpo(p, cuerpo) : { paso: p, sueltas: 0 };
  const paso = (asunto ? { ...c.paso, asunto } : c.paso) as PasoGrafo;
  const que = [cuerpo ? `texto «${corto(cuerpo)}»` : '', asunto ? `asunto «${corto(asunto)}»` : ''].filter(Boolean).join(' y ');
  const r = conTexto(pasos, i, paso, [], `${email ? 'Email' : 'WhatsApp'} ${tarjeta} de «${nombre}»: ${que}${yVariantes(c.sueltas)}`);
  return r.ok ? { ok: true, pasos: r.pasos, resumen: r.resumen } : r;
}

const corto = (t: string): string => (t.length > 60 ? `${t.slice(0, 59)}…` : t);

/** El paso nuevo en su lugar, si no deja nada que no se pueda publicar: sólo cuentan los errores NUEVOS de `validarGrafo`. */
function conTexto(pasos: readonly PasoGrafo[], i: number, paso: PasoGrafo, botones: BotonSocial[], resumen: string):
  { ok: true; pasos: PasoGrafo[]; botones: BotonSocial[]; resumen: string } | { ok: false; error: string } {
  const despues = pasos.map((q, k) => (k === i ? paso : q));
  const yaTenia = new Set(validarGrafo(pasos));
  const nuevos = validarGrafo(despues).filter((e) => !yaTenia.has(e));
  if (nuevos.length) return { ok: false, error: `Así no se puede publicar: ${nuevos.slice(0, 3).join('; ')}.` };
  return { ok: true, pasos: despues, botones, resumen };
}
