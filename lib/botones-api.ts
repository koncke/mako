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
// =============================================================================

import { claseDe, idDe, validarGrafo, type PasoGrafo } from './flujo-grafo';
import { botonesDe, normalizarTitulo, urlValida, TOPE_BOTONES, TOPE_TITULO_BOTON, type BotonSocial } from './botones-social';
import { esCanalSocial } from './canal-social';
import { partesExplicitas } from './mensaje-partes';

/** Lo que pide quien llama: el título y UNA cosa, «sigue» (una tarjeta) o «link» (una dirección). */
export type BotonPedido = { titulo?: unknown; sigue?: unknown; link?: unknown };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Los pasos con los botones nuevos de la tarjeta `tarjeta`, o el error en palabras. `nombre` es el de la automatización (para
 * los errores). Un botón que ya estaba conserva su id si viene con el mismo título; uno nuevo toma un id libre (lo que
 * cuelga de «btn:<id>» de uno que se quedó sigue colgado). `lista` null deja los botones como están; `texto`, si viene,
 * es el texto nuevo del mensaje.
 */
export function botonesParaGuardar(pasos: readonly PasoGrafo[], tarjeta: string, lista: readonly BotonPedido[] | null, nombre: string, texto?: string):
  { ok: true; pasos: PasoGrafo[]; botones: BotonSocial[]; resumen: string } | { ok: false; error: string } {
  const i = pasos.findIndex((p, k) => idDe(p, k) === tarjeta);
  if (i < 0) return { ok: false, error: `«${nombre}» no tiene una tarjeta «${tarjeta}». Pide los ids con ficha_secuencia_mensajes.` };
  const p = pasos[i];
  if (claseDe(p) !== 'mensaje' || !esCanalSocial(p.canal)) return { ok: false, error: 'Por aquí se cambia un mensaje de Instagram o Messenger: esa tarjeta no lo es.' };
  const cuerpo = texto?.trim();
  if (lista == null && texto === undefined) return { ok: false, error: 'Pasa los botones, el texto o los dos.' };
  if (texto !== undefined && !cuerpo) return { ok: false, error: 'El texto del mensaje no puede quedar vacío.' };
  if (cuerpo && partesExplicitas(p)) return { ok: false, error: `El mensaje ${tarjeta} son varios mensajes seguidos: su texto se edita en el lienzo de Automations.` };
  if (lista == null) {
    const botones = botonesDe(p);
    return conTexto(pasos, i, { ...p, cuerpo: cuerpo! }, botones, `Texto del mensaje ${tarjeta} de «${nombre}»: «${corto(cuerpo!)}»`);
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
  return conTexto(pasos, i, cuerpo ? { ...paso, cuerpo } : paso, botones,
    `${cuerpo ? `Texto («${corto(cuerpo)}») y botones` : 'Botones'} del mensaje ${tarjeta} de «${nombre}»: ${que}`);
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
