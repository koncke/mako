'use client';

// =============================================================================
// mako/chat/acciones — lo que hace el chat «MaKo IA»: pedir, aceptar y restaurar
// =============================================================================
// Corre afuera del componente (la respuesta de un pedido largo cae en el store aunque el panel se haya cerrado).
// Molde: `pedirEdicion` y `aceptar` de app/video-editor/_opencut/chat/PanelChat.tsx.
//
// Lo que gobierna, y no se ve en las firmas:
//   · PEDIR SÓLO ARMA LA PROPUESTA. La vista del diseño (lib/image-editor/chat/vista.ts) va a /api/image-editor/ia; lo
//     que vuelve se valida de nuevo (el editor no le cree a nadie) y se prueba sobre una COPIA del documento para
//     mostrar «Original | Modificado». El diseño no se toca hasta «Aceptar».
//   · ACEPTAR VUELVE A APLICAR SOBRE EL DOCUMENTO DE AHORA, por id: lo que la persona cambió en el medio se respeta, y lo
//     que borró se descarta con su motivo. Las fuentes nuevas se cargan ANTES (si no, el texto se mide con otra y queda
//     cortado) y el cambio entra en UN paso de deshacer (`applyDocument`).
//   · «RESTAURAR» ES EL DESHACER DE ESE PASO: sólo si nada cambió después (la versión del documento es la de justo
//     después de aplicar). Si no, la vuelta es Ctrl+Z.
// =============================================================================

import type { EditorEngine } from '../../_doory/editor/extensions';
import { TOPES_CHAT_IMAGEN, validarOperaciones } from '@/lib/image-editor/chat/catalogo';
import { aplicarOperaciones, type FotoDelChat, type RefsDeVista } from '@/lib/image-editor/chat/aplicar';
import { familiaDe, tipoDe, vistaDeDiseno } from '@/lib/image-editor/chat/vista';
import { memoriaDelHilo } from '@/lib/image-editor/chat/hilo';
import { FUENTES } from '../fuentes';
import { cambiarHilo, cambiarMensaje, conId, leerHilo, type MensajeMako, type MensajeNuevo, type Propuesta } from './hilo';
import type { RespSubidos, Subido } from '@/lib/image-editor/tipos';
import { cuerpoConArchivos, originalDe } from '@/app/_chat/useAdjuntosDelChat';
import { ACCEPT_ADJUNTOS_CHAT, ERROR_ADJUNTO, memoriaConArchivos } from '@/lib/mako-adjuntos';
import type { KitMarca } from '@/lib/marca/kits';
import type { IntencionChat } from '@/app/_chat/SelectorIntencion';

/** La ruta corta a 120 s; el pedido se corta un poco después. */
const PLAZO_MS = 125_000;
/** Con fotos o PDF (28/10/2026): la ruta los lee antes (una foto con la visión, ~52 s) y su `maxDuration` es 300. */
const PLAZO_CON_ARCHIVOS_MS = 245_000;
/** Las fuentes que se le sugieren a la IA: las primeras del catálogo (orden = popularidad). */
const SUGERIDAS = 30;
/** Las fotos de «Subidos» que se le ofrecen a la IA: las adjuntas y las últimas subidas. */
const FOTOS_OFRECIDAS = 40;
/** Leer «Subidos» no puede trabar un pedido: si tarda, se sigue con las adjuntas. */
const PLAZO_LISTA_MS = 15_000;
/** Lo que la ruta lee (lib/adjuntos-del-chat.ts). Un SVG o un AVIF se ponen, pero no se le mandan: los rechazaría por su firma. */
const LEIBLES = new Set(ACCEPT_ADJUNTOS_CHAT.split(','));

export type AlcanceChat = 'diseno' | 'seleccion';

const cortes = new Map<string, AbortController>();
export const detener = (disenoId: string) => cortes.get(disenoId)?.abort();

const nuevoIdObjeto = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * La familia como la tiene el editor (el catálogo, o una que el diseño ya usa: una propia de la persona), o null. Una
 * familia que el editor no tiene cae a la del sistema EN SILENCIO: por eso se descarta antes.
 */
export function fuenteDelEditor(doc: unknown): (nombre: string) => string | null {
  const conocidas = new Map<string, string>(FUENTES.map((f) => [f.family.toLowerCase(), f.family]));
  for (const p of ((doc as { pages?: Array<{ objects?: unknown[] }> })?.pages ?? [])) {
    for (const o of (p.objects ?? []) as Array<Record<string, unknown>>) {
      if (tipoDe(o) === 'texto' && typeof o.fontFamily === 'string') {
        const f = familiaDe(o.fontFamily);
        if (f && !conocidas.has(f.toLowerCase())) conocidas.set(f.toLowerCase(), f);
      }
    }
  }
  return (nombre) => conocidas.get(nombre.trim().toLowerCase()) ?? null;
}

const rotuloSeleccion = (n: number) => (n === 1 ? '1 elemento elegido' : `${n} elementos elegidos`);
export { rotuloSeleccion };

type Respuesta = { ok: true; resumen: string; operaciones: unknown[]; descartes?: string[] } | { ok: false; error: string };

/** Lo que no se perdió aunque se descarte: ya estaba así, o sólo faltó la fuente y el texto entró con otra. */
const NO_SE_PERDIO = /\bya (dice|está)\b|^la fuente /;

async function pedirIA(cuerpo: Record<string, unknown>, senal: AbortSignal, archivos: readonly File[] = []): Promise<Respuesta | { ok: false; error: string; cortado: true }> {
  // Un `abort` que ya pasó no vuelve a disparar el evento: sin esto, el pedido salía igual después de «Detener».
  if (senal.aborted) return { ok: false, error: 'Detenido.', cortado: true };
  const plazo = new AbortController();
  const t = setTimeout(() => plazo.abort(), archivos.length ? PLAZO_CON_ARCHIVOS_MS : PLAZO_MS);
  const alCortar = () => plazo.abort();
  senal.addEventListener('abort', alCortar);
  try {
    const res = await fetch('/api/image-editor/ia', archivos.length
      ? { method: 'POST', body: cuerpoConArchivos(cuerpo, archivos), signal: plazo.signal }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: plazo.signal });
    const json = (await res.json().catch(() => null)) as Respuesta | null;
    // El 413 de Vercel (archivos de más) llega en texto: no es JSON.
    if (!json) return { ok: false, error: res.status === 413 ? ERROR_ADJUNTO.pesado : 'MaKo no respondió. Vuelve a intentar.' };
    return json;
  } catch {
    if (senal.aborted) return { ok: false, error: 'Detenido.', cortado: true };
    return { ok: false, error: 'MaKo tardó demasiado. Vuelve a intentar.' };
  } finally {
    clearTimeout(t);
    senal.removeEventListener('abort', alCortar);
  }
}

type FotoOfrecida = FotoDelChat & { adjunta?: boolean; logo?: boolean };

/**
 * Las fotos que la IA puede poner (30/10/2026, Leila: «no me pone las imágenes en el carrusel»). Las que vienen adjuntas en
 * el pedido se suben a «Subidos» ANTES de pedir, para que tengan dirección y vayan primero; después, las últimas de «Subidos».
 * Lo que no se pudo subir se dice, y el pedido sigue. Si la lista no se pudo leer, quedan las adjuntas.
 * ⚠️ SE SUBE EL ORIGINAL (`originalDe`), no la copia achicada que lee la IA. Y si esa misma foto ya está en «Subidos» (mismo nombre y
 * peso), se usa ésa: un reintento vuelve a adjuntarla, y cada vez sería una copia más entre las 40 que se ofrecen.
 */
async function fotosParaPedir(editor: EditorEngine, archivos: readonly File[], senal: AbortSignal, kit: KitMarca | null = null): Promise<{ fotos: FotoOfrecida[]; fallas: string[] }> {
  const delNegocio: Subido[] = [];
  const plazo = new AbortController();
  const t = setTimeout(() => plazo.abort(), PLAZO_LISTA_MS);
  const alCortar = () => plazo.abort();
  senal.addEventListener('abort', alCortar);
  try {
    const res = await fetch('/api/image-editor/subidos?clase=imagen', { signal: plazo.signal });
    const r = (await res.json()) as RespSubidos;
    if (r.ok && Array.isArray(r.subidos)) delNegocio.push(...r.subidos.filter((s) => s.tipo.startsWith('image/')));
  } catch { /* sin la lista quedan las adjuntas: el pedido no se cae por esto */ } finally {
    clearTimeout(t);
    senal.removeEventListener('abort', alCortar);
  }
  const fotos: FotoOfrecida[] = [];
  const fallas: string[] = [];
  for (const f of archivos) {
    if (!f.type.startsWith('image/') || senal.aborted) continue;
    const o = originalDe(f);
    const ya = delNegocio.find((s) => s.nombre === o.name && s.bytes === o.size);
    if (ya) { fotos.push({ id: ya.id, url: ya.url, nombre: ya.nombre, ancho: ya.ancho, alto: ya.alto, adjunta: true }); continue; }
    try {
      const r = await editor.assets.upload(o, o.name);
      editor.store.setState((s) => ({ uploads: [r, ...s.uploads.filter((u) => u.id !== r.id)] }));
      fotos.push({ id: r.id, url: r.url, nombre: r.name, ancho: r.width, alto: r.height, adjunta: true });
    } catch (e) {
      // El motivo importa: «se trabó» pide reintentar y «pasa del tope» no. La subida tiene plazo de atasco
      // (app/customer-success/curso/subir-video.ts, `trabadaMs`), así que esto ya no espera para siempre.
      const motivo = e instanceof Error && e.message ? ` (${e.message.replace(/\s+/g, ' ').slice(0, 120)})` : '';
      fallas.push(`la foto «${f.name}» no se pudo subir${motivo}`);
    }
  }
  // El logo del kit de marca (5/11/2026), justo después de las adjuntas: es lo que el kit le pide a la IA que ponga.
  const logo = kit?.logo;
  if (logo && !fotos.some((x) => x.id === logo.subidoId)) {
    fotos.push({ id: logo.subidoId, url: logo.url, nombre: logo.nombre, ancho: logo.ancho || 512, alto: logo.alto || 512, logo: true });
  }
  for (const s of delNegocio) {
    if (!fotos.some((x) => x.id === s.id)) fotos.push({ id: s.id, url: s.url, nombre: s.nombre, ancho: s.ancho, alto: s.alto });
  }
  return { fotos: fotos.slice(0, FOTOS_OFRECIDAS), fallas };
}

const fotoRef = (i: number) => `o${i + 1}`;

/** Las refs con que se pidió, para aplicar (al pedir es la vista; después de recargar, lo guardado). */
const refsDe = (p: Propuesta): RefsDeVista => ({
  elementos: new Map(p.refs.map(([ref, id]) => [ref, { id }] as const)),
  paginas: new Map(p.paginas),
});

/**
 * Manda una instrucción y deja en el hilo la respuesta: una PROPUESTA para revisar, o lo que no se pudo. Con `intencion`
 * «discutir», MaKo contesta sin proponer nada. `kit`: la marca elegida (su logo va entre las fotos, sus fuentes primero).
 */
export async function pedirEdicion(editor: EditorEngine, instruccion: string, alcance: AlcanceChat, archivos: readonly File[] = [], op: { intencion?: IntencionChat; kit?: KitMarca | null; /** Escribir la plantilla con lo del negocio (lib/image-editor/chat/ia.ts → `negocioParaEscribir`). */ conNegocio?: boolean } = {}): Promise<void> {
  const kit = op.kit ?? null;
  const discutir = op.intencion === 'discutir';
  const disenoId = editor.designId;
  const texto = instruccion.trim();
  if (!disenoId || (!texto && !archivos.length) || leerHilo(disenoId).corriendo) return;

  const elegidosIds = editor.state.selection.ids.slice();
  const alcanceReal: AlcanceChat = alcance === 'seleccion' && elegidosIds.length ? 'seleccion' : 'diseno';
  // Antes de sumar el mensaje de ahora, que ya va como instrucción.
  const memoria = memoriaDelHilo(leerHilo(disenoId).mensajes);
  cambiarHilo(disenoId, (h) => ({
    corriendo: true,
    // ⚠️ UN PEDIDO NUEVO CIERRA LA PROPUESTA ANTERIOR. Sin esto quedaban DOS «Aceptar» vivos sobre el mismo diseño, y
    //    aceptar los dos aplicaba las dos tandas de operaciones: «agregá una página» pedido dos veces dejaba las páginas
    //    repetidas, y la persona las tenía que borrar a mano sin entender qué pasó (encargo del 6/11/2026). Pedir de
    //    nuevo ES descartar lo anterior: el pedido nuevo se escribió MIRANDO lo que la propuesta vieja no resolvió, y su
    //    `refs` apunta a una vista del documento que ya no es la de ahora.
    //    Sólo las `pendiente`: una `aplicando` está a mitad de camino y la cierra su propio `aceptarPropuesta`.
    //    Queda igual que el botón «Descartar» (estado + `aviso` limpio, PanelMakoIA.tsx): la tarjeta se apaga a
    //    «Descartado» justo arriba del pedido nuevo, y no se usa `aviso` — ése dibuja un «reportar a soporte», y esto no
    //    es una falla.
    mensajes: [
      ...h.mensajes.map((m) => (m.de === 'mako' && m.estado === 'pendiente'
        ? { ...m, estado: 'descartada' as const, aviso: undefined, t: Date.now() }
        : m)),
      conId({ de: 'yo', texto: memoriaConArchivos(texto, archivos.map((f) => f.name)), alcance: alcanceReal === 'seleccion' ? rotuloSeleccion(elegidosIds.length) : null }),
    ],
  }));
  const corte = new AbortController();
  cortes.set(disenoId, corte);
  const terminar = (m: MensajeNuevo) => {
    cortes.delete(disenoId);
    cambiarHilo(disenoId, (h) => ({ corriendo: false, mensajes: [...h.mensajes, conId(m)] }));
  };

  // El documento de ESTE momento: el mismo para la vista que va a la IA y para probar la propuesta.
  const doc = editor.getDocument();
  const docVersion = editor.state.docVersion;
  const activePageId = editor.state.activePageId;
  // Las fuentes de la marca primero (si el editor las tiene), y después las del catálogo.
  const deLaMarca = [kit?.fuentes.titulos, kit?.fuentes.texto].map((f) => (f ? fuenteDelEditor(doc)(f) : null)).filter((f): f is string => !!f);
  const sugeridas = [...new Set([...deLaMarca, ...FUENTES.slice(0, SUGERIDAS).map((f) => f.family)])].slice(0, SUGERIDAS);
  const vistaCon = (ofrecidas: readonly FotoOfrecida[]) => vistaDeDiseno(doc, {
    activePageId, elegidos: elegidosIds, fuentes: sugeridas,
    fotos: ofrecidas.map((f, i) => ({ ref: fotoRef(i), nombre: f.nombre, ancho: f.ancho, alto: f.alto, ...(f.adjunta ? { adjunta: true } : {}), ...(f.logo ? { logo: true } : {}) })),
  });
  // Antes de subir nada: si el diseño solo no entra, no hay pedido.
  if (vistaCon([]).json.length > TOPES_CHAT_IMAGEN.vistaMax) {
    terminar({ de: 'mako', texto: 'El diseño es muy grande para el chat. Elige unos elementos y pídelo sobre la selección.', error: true });
    return;
  }
  const { fotos: todas, fallas } = await fotosParaPedir(editor, archivos, corte.signal, kit);
  if (corte.signal.aborted) {
    terminar({ de: 'mako', texto: 'Detenido.' });
    return;
  }
  // La lista no puede tirar un pedido que no tiene nada que ver con fotos: se va achicando desde las más viejas (las adjuntas van primero).
  let fotos = todas;
  let vista = vistaCon(fotos);
  while (vista.json.length > TOPES_CHAT_IMAGEN.vistaMax && fotos.length) {
    fotos = fotos.slice(0, -1);
    vista = vistaCon(fotos);
  }
  const fotoDeRef = new Map<string, FotoDelChat>(fotos.map((f, i) => [fotoRef(i), { id: f.id, url: f.url, nombre: f.nombre, ancho: f.ancho, alto: f.alto }]));
  const paraLeer = archivos.filter((f) => LEIBLES.has(f.type));
  // Sólo un SVG o un AVIF y nada escrito: a la ruta no le llega ningún archivo, y sin texto contestaría que falta.
  const instruccionIA = texto || (archivos.length && !paraLeer.length ? 'Pon en el diseño lo que adjunté.' : '');
  const r = await pedirIA({
    instruccion: instruccionIA, diseno: vista.json, alcance: alcanceReal, memoria,
    ...(kit ? { kit: kit.id } : {}), ...(discutir ? { intencion: 'discutir' } : {}), ...(op.conNegocio ? { conNegocio: true } : {}),
  }, corte.signal, paraLeer);
  if (!r.ok) {
    terminar({ de: 'mako', texto: r.error, error: !('cortado' in r) });
    return;
  }
  // Discutir: la respuesta y nada más (el server ya tiró cualquier operación).
  if (discutir) {
    terminar({ de: 'mako', texto: r.resumen || 'No tengo nada que sugerir sobre eso.' });
    return;
  }
  const { operaciones, descartes: deForma } = validarOperaciones(r.operaciones);
  const elegidos = [...new Set(elegidosIds.map((id) => [...vista.elementos.values()].find((e) => e.id === id)?.ref).filter((x): x is string => !!x))];
  const usadas = [...fotoDeRef].filter(([r]) => operaciones.some((o) => (o.op === 'agregar_foto' || o.op === 'fondo_foto') && o.foto === r));
  const propuesta: Propuesta = {
    paginaId: activePageId,
    refs: [...vista.elementos.values()].map((e) => [e.ref, e.id]),
    paginas: [...vista.paginas.entries()],
    elegidos,
    alcance: alcanceReal,
    operaciones,
    ...(usadas.length ? { fotos: usadas } : {}),
    docVersion,
  };
  // La prueba: sobre una COPIA del documento con que se pidió. Nada se aplica todavía.
  const prueba = aplicarOperaciones({
    doc, operaciones, vista: refsDe(propuesta), nuevoId: nuevoIdObjeto, activePageId,
    soloRefs: alcanceReal === 'seleccion' ? new Set(elegidos) : null, fuente: fuenteDelEditor(doc), fotos: fotoDeRef,
  });
  // `deForma` es casi siempre vacío: la ruta ya filtró, y lo que tiró viene en `r.descartes`.
  const descartes = [...fallas, ...(r.descartes ?? []), ...deForma, ...prueba.descartes];
  const perdidas = descartes.filter((d) => !NO_SE_PERDIO.test(d)).length;
  if (!prueba.aplicadas) {
    terminar({ de: 'mako', texto: `${perdidas ? 'No pude hacerlo. ' : ''}${r.resumen || 'Sin cambios.'}`, ...(descartes.length ? { descartes } : {}) });
    return;
  }
  // Si se perdió más de lo que queda, el resumen de la IA promete de más («Voy a crear el carrusel») y sólo cambia el fondo.
  const parcial = perdidas > prueba.aplicadas ? 'Pude hacer sólo una parte. ' : '';
  terminar({
    de: 'mako', texto: `${parcial}${r.resumen || 'Listo.'}`, estado: 'pendiente', cambios: prueba.cambios,
    ...(descartes.length ? { descartes } : {}), propuesta,
  });
}

/**
 * «Aceptar»: aplica la propuesta sobre el documento de AHORA, en un paso de deshacer. Devuelve lo que no se pudo (un
 * elemento que ya no está, uno que se bloqueó en el medio).
 */
export async function aceptarPropuesta(editor: EditorEngine, m: MensajeMako): Promise<void> {
  const disenoId = editor.designId;
  const p = m.propuesta;
  if (!p || !disenoId || m.estado !== 'pendiente') return;
  cambiarMensaje(disenoId, m.id, { estado: 'aplicando', aviso: undefined });
  const probar = () => {
    const doc = editor.getDocument();
    return {
      doc,
      r: aplicarOperaciones({
        doc, operaciones: p.operaciones, vista: refsDe(p), nuevoId: nuevoIdObjeto, activePageId: p.paginaId ?? editor.state.activePageId,
        soloRefs: p.alcance === 'seleccion' ? new Set(p.elegidos) : null, fuente: fuenteDelEditor(doc), fotos: new Map(p.fotos ?? []),
      }),
    };
  };
  let { doc, r } = probar();
  if (!r.aplicadas) {
    cambiarMensaje(disenoId, m.id, { estado: 'pendiente', aviso: `Ya no se puede aplicar: ${r.descartes.slice(0, 2).join(' · ') || 'el diseño cambió'}` });
    return;
  }
  // Las fuentes, antes: el motor mide el texto con la que esté cargada.
  await Promise.all(r.fuentes.flatMap((f) => [editor.fonts.load(f, 400), editor.fonts.load(f, 700)]));
  // Mientras cargaban, la persona pudo seguir editando: se vuelve a armar sobre lo de ahora.
  if (editor.getDocument() !== doc) ({ doc, r } = probar());
  if (!r.aplicadas) {
    cambiarMensaje(disenoId, m.id, { estado: 'pendiente', aviso: 'Ya no se puede aplicar: el diseño cambió' });
    return;
  }
  editor.stopEditingText();
  editor.applyDocument(r.doc as unknown as Parameters<EditorEngine['applyDocument']>[0], { label: 'MaKo IA', ...(r.pagina ? { activePageId: r.pagina } : {}) });
  cambiarMensaje(disenoId, m.id, {
    estado: 'aplicada',
    aplicada: { version: editor.state.docVersion },
    descartes: r.descartes.length ? r.descartes : m.descartes,
  });
  editor.toast('Cambio aplicado', 'success');
}

/** «Restaurar»: el deshacer de ESE paso, si nada cambió después. Si no, se avisa que es Ctrl+Z. */
export function restaurarPropuesta(editor: EditorEngine, m: MensajeMako): void {
  const disenoId = editor.designId;
  if (!m.aplicada || !disenoId) return;
  if (editor.state.docVersion !== m.aplicada.version) {
    editor.toast('Deshazlo con Ctrl+Z');
    return;
  }
  void editor.undo();
  cambiarMensaje(disenoId, m.id, { estado: 'restaurada', aplicada: undefined });
  editor.toast('Cambio deshecho', 'success');
}
