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
//   · LAS IMÁGENES CON IA SE GENERAN AL PEDIR, ANTES DE MOSTRAR LA PROPUESTA (26/10/2026): crear_imagen y editar_imagen
//     van a /api/image-editor/imagen (la IA del negocio, que se cobra en SU cuenta, una vez y sin reintentos) y se cambian
//     por agregar_imagen / reemplazar_imagen con la URL de «Subidos». Así «Original | Modificado» enseña la imagen de
//     verdad y «Aceptar» no vuelve a pagar. Antes de pedirla se revisa que se pueda aplicar (`destinoDeImagen`): lo que
//     se iba a descartar no se paga. Una que falla se descarta con el motivo del proveedor (de quién fue y qué hacer).
//   · «DISCUTIR» (`intencion: 'discutir'`) contesta y sugiere: nunca arma una propuesta, aunque el server mandara algo.
//   · UNA PROPUESTA DE LA API (27/10/2026, ./propuestas.ts) se acepta con ESTE «Aceptar» y se cierra en la base con las
//     operaciones como se MOSTRARON. Si trae una imagen con IA, la imagen se crea AQUÍ (la persona tocó «Aceptar»: se
//     cobra en la cuenta del negocio) y queda en memoria por mensaje: un segundo «Aceptar» tras un fallo no vuelve a pagar.
// =============================================================================

import type { EditorEngine } from '../../_doory/editor/extensions';
import {
  TOPES_CHAT_IMAGEN, esOperacionDeImagenIA, esSrcGenerada, validarOperaciones,
  type OperacionDeImagenIA, type OperacionImagen, type OperacionInterna,
} from '@/lib/image-editor/chat/catalogo';
import { aplicarOperaciones, destinoDeImagen, type RefsDeVista } from '@/lib/image-editor/chat/aplicar';
import { claveDeOperacion } from '@/lib/image-editor/chat/propuestas';
import { marcarCerradaImagen, resolverEnServidorImagen } from './propuestas';
import { familiaDe, tipoDe, vistaDeDiseno } from '@/lib/image-editor/chat/vista';
import { FUENTES } from '../fuentes';
import { cambiarHilo, cambiarMensaje, conId, leerHilo, type MensajeMako, type MensajeNuevo, type Propuesta } from './hilo';
import { cuerpoConArchivos } from '@/app/_chat/useAdjuntosDelChat';
import { ERROR_ADJUNTO, memoriaConArchivos } from '@/lib/mako-adjuntos';

/** La ruta corta a 120 s; el pedido se corta un poco después. */
const PLAZO_MS = 125_000;
/** La de las imágenes corta a 180 s (el proveedor tiene 150). */
const PLAZO_IMAGEN_MS = 185_000;
/** El lado más largo de la imagen que se manda para editar (el modelo devuelve de 1024 a 1536). */
const LADO_REFERENCIA = 1024;
/** Con fotos o PDF (28/10/2026): la ruta los lee antes (una foto con la visión, ~52 s) y su `maxDuration` es 300. */
const PLAZO_CON_ARCHIVOS_MS = 245_000;
/** Las fuentes que se le sugieren a la IA: las primeras del catálogo (orden = popularidad). */
const SUGERIDAS = 30;

export type AlcanceChat = 'diseno' | 'seleccion';
/** «Editar» hace lo pedido; «Discutir» contesta y sugiere sin tocar nada (app/_chat/SelectorIntencion.tsx). */
export type IntencionChatImagen = 'editar' | 'discutir';

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

type Respuesta = { ok: true; resumen: string; operaciones: unknown[] } | { ok: false; error: string };

async function pedirIA(cuerpo: Record<string, unknown>, senal: AbortSignal, archivos: readonly File[] = []): Promise<Respuesta | { ok: false; error: string; cortado: true }> {
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

/** Las refs con que se pidió, para aplicar (al pedir es la vista; después de recargar, lo guardado). */
const refsDe = (p: Propuesta): RefsDeVista => ({
  elementos: new Map(p.refs.map(([ref, id]) => [ref, { id }] as const)),
  paginas: new Map(p.paginas),
});

// ─────────────────────────────────────────────────────────────────────────────
// Las imágenes con IA (antes de proponer)
// ─────────────────────────────────────────────────────────────────────────────

type RespImagen =
  | { ok: true; url: string; ancho: number; alto: number; proveedor: string; subidoId?: string; nombre?: string }
  | { ok: false; error: string; link?: { texto: string; href: string } };

/** Pide UNA imagen a /api/image-editor/imagen. Nunca se reintenta: cada pedido se cobra en la cuenta del negocio. */
async function pedirImagen(cuerpo: { prompt: string; ancho: number; alto: number; referencia?: string }, senal: AbortSignal): Promise<RespImagen> {
  const plazo = new AbortController();
  const t = setTimeout(() => plazo.abort(), PLAZO_IMAGEN_MS);
  const alCortar = () => plazo.abort();
  senal.addEventListener('abort', alCortar);
  try {
    const res = await fetch('/api/image-editor/imagen', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: plazo.signal,
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json) return { ok: false, error: `MaKo no respondió al crear la imagen (error ${res.status}). Repórtalo a Soporte si se repite.` };
    if (json.ok !== true) {
      const l = json.link as { texto?: unknown; href?: unknown } | undefined;
      const link = l && typeof l.texto === 'string' && typeof l.href === 'string' && l.href.startsWith('/') ? { texto: l.texto, href: l.href } : undefined;
      return { ok: false, error: typeof json.error === 'string' && json.error ? json.error : 'No se pudo crear la imagen.', ...(link ? { link } : {}) };
    }
    // La imagen tiene que estar: una URL de «Subidos» y sus píxeles (un 200 sin eso no es un éxito).
    const entero = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x > 0 ? x : null);
    const ancho = entero(json.ancho);
    const alto = entero(json.alto);
    if (!esSrcGenerada(json.url) || !ancho || !alto) return { ok: false, error: 'MaKo creó la imagen pero no la devolvió bien. Repórtalo a Soporte.' };
    return {
      ok: true, url: json.url, ancho, alto, proveedor: String(json.proveedor ?? ''),
      ...(typeof json.subidoId === 'string' ? { subidoId: json.subidoId } : {}), ...(typeof json.nombre === 'string' ? { nombre: json.nombre } : {}),
    };
  } catch {
    if (senal.aborted) return { ok: false, error: 'Detenido. Si la imagen ya se estaba creando, se termina igual (puede haberse cobrado) y aparece en «Subidos».' };
    return { ok: false, error: 'La imagen tardó demasiado. Puede que se haya creado igual: mírala en «Subidos» antes de volver a pedirla.' };
  } finally {
    clearTimeout(t);
    senal.removeEventListener('abort', alCortar);
  }
}

/**
 * La imagen a editar, como data URL: la parte que se VE (el recorte) dibujada en un canvas, con su lado más largo en
 * `LADO_REFERENCIA`. Con una imagen de otro sitio que no deja leerse (CORS), el canvas queda «sucio» y no se puede leer:
 * se dice, no se manda otra cosa.
 */
async function referenciaDeImagen(editor: EditorEngine, src: string, recorte: { x: number; y: number; ancho: number; alto: number }): Promise<{ ok: true; dataUrl: string } | { ok: false; motivo: string }> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return { ok: false, motivo: 'este navegador no deja leer la imagen' };
  try {
    const assets = (editor as unknown as { assets?: { resolve?: (s: string) => Promise<string> } }).assets;
    const url = assets?.resolve ? await assets.resolve(src) : src;
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      const t = setTimeout(() => mal(new Error('tardó demasiado en cargar')), 20_000);
      i.onload = () => { clearTimeout(t); ok(i); };
      i.onerror = () => { clearTimeout(t); mal(new Error('no se pudo cargar')); };
      i.src = url;
    });
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    if (!nw || !nh) return { ok: false, motivo: 'la imagen está vacía' };
    const sx = Math.min(Math.max(0, recorte.x), nw - 1);
    const sy = Math.min(Math.max(0, recorte.y), nh - 1);
    const sw = recorte.ancho > 0 ? Math.min(recorte.ancho, nw - sx) : nw - sx;
    const sh = recorte.alto > 0 ? Math.min(recorte.alto, nh - sy) : nh - sy;
    const k = Math.min(1, LADO_REFERENCIA / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * k));
    canvas.height = Math.max(1, Math.round(sh * k));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, motivo: 'este navegador no deja dibujar la imagen' };
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > TOPES_CHAT_IMAGEN.referencia) dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) return { ok: false, motivo: 'el navegador no la pudo copiar' };
    if (dataUrl.length > TOPES_CHAT_IMAGEN.referencia) return { ok: false, motivo: 'pesa demasiado para mandarla' };
    return { ok: true, dataUrl };
  } catch (e) {
    const n = e instanceof Error ? e.name : '';
    if (n === 'SecurityError') return { ok: false, motivo: 'el navegador no deja leerla porque está guardada en otro sitio. Súbela a «Subidos», ponla en el diseño y vuelve a pedirlo' };
    return { ok: false, motivo: e instanceof Error && e.message ? e.message : 'no se pudo cargar' };
  }
}

/** La imagen nueva, también en el panel «Subidos» del editor (la ruta ya la guardó ahí). */
function sumarASubidos(editor: EditorEngine, r: Extract<RespImagen, { ok: true }>): void {
  if (!r.subidoId) return;
  const ref = { id: r.subidoId, url: r.url, thumbUrl: r.url, width: r.ancho, height: r.alto, name: r.nombre ?? 'Imagen con IA', kind: 'image' as const };
  try {
    const store = (editor as unknown as { store?: { setState?: (f: (s: { uploads?: Array<{ id: string }> }) => object) => void } }).store;
    store?.setState?.((st) => ({ uploads: [ref, ...(st.uploads ?? []).filter((u) => u.id !== ref.id)] }));
  } catch { /* el panel la ve al volver a abrirlo */ }
}

type ImagenLista = { ok: true; op: OperacionInterna } | { ok: false; motivo: string; link?: { texto: string; href: string } };

/** Una crear_imagen o editar_imagen → la imagen generada, lista para aplicar; o por qué no (sin pagar si se sabe antes). */
async function imagenConIA(editor: EditorEngine, doc: unknown, op: OperacionDeImagenIA, ctx: { vista: RefsDeVista; activePageId: string | null; soloRefs: ReadonlySet<string> | null }, senal: AbortSignal): Promise<ImagenLista> {
  const d = destinoDeImagen({ doc, op, vista: ctx.vista, activePageId: ctx.activePageId, soloRefs: ctx.soloRefs });
  if (!d.ok) return { ok: false, motivo: d.motivo };
  let referencia: string | undefined;
  if (d.op === 'editar_imagen') {
    const r = await referenciaDeImagen(editor, d.src, d.recorte);
    if (!r.ok) return { ok: false, motivo: `No pude leer ${d.titulo} para editarla: ${r.motivo}.` };
    referencia = r.dataUrl;
  }
  const r = await pedirImagen({ prompt: op.prompt, ancho: d.caja.ancho, alto: d.caja.alto, ...(referencia ? { referencia } : {}) }, senal);
  if (!r.ok) return { ok: false, motivo: r.error, ...(r.link ? { link: r.link } : {}) };
  sumarASubidos(editor, r);
  const comun = { src: r.url, natural: { ancho: r.ancho, alto: r.alto }, ...(r.subidoId ? { asset: r.subidoId } : {}), descripcion: op.prompt };
  if (op.op === 'editar_imagen') return { ok: true, op: { op: 'reemplazar_imagen', ref: op.ref, ...comun } };
  return { ok: true, op: { op: 'agregar_imagen', ...d.caja, ...(op.pagina ? { pagina: op.pagina } : {}), ...(op.ref ? { ref: op.ref } : {}), ...comun } };
}

/**
 * Manda una instrucción y deja en el hilo la respuesta: una PROPUESTA para revisar, o lo que no se pudo. Con
 * `intencion: 'discutir'`, sólo la respuesta de MaKo (nunca una propuesta). `archivos`: las fotos o los PDF del pedido
 * (28/10/2026), que la ruta lee aparte de la instrucción.
 */
export async function pedirEdicion(editor: EditorEngine, instruccion: string, alcance: AlcanceChat, intencion: IntencionChatImagen = 'editar', archivos: readonly File[] = []): Promise<void> {
  const disenoId = editor.designId;
  const texto = instruccion.trim();
  if (!disenoId || (!texto && !archivos.length) || leerHilo(disenoId).corriendo) return;

  const elegidosIds = editor.state.selection.ids.slice();
  const alcanceReal: AlcanceChat = alcance === 'seleccion' && elegidosIds.length ? 'seleccion' : 'diseno';
  cambiarHilo(disenoId, (h) => ({
    corriendo: true,
    mensajes: [...h.mensajes, conId({ de: 'yo', texto: memoriaConArchivos(texto, archivos.map((f) => f.name)), alcance: alcanceReal === 'seleccion' ? rotuloSeleccion(elegidosIds.length) : null })],
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
  const vista = vistaDeDiseno(doc, { activePageId, elegidos: elegidosIds, fuentes: FUENTES.slice(0, SUGERIDAS).map((f) => f.family) });
  if (vista.json.length > TOPES_CHAT_IMAGEN.vistaMax) {
    terminar({ de: 'mako', texto: 'El diseño es muy grande para el chat. Elige unos elementos y pídelo sobre la selección.', error: true });
    return;
  }
  const discutir = intencion === 'discutir';
  const r = await pedirIA({ instruccion: texto, diseno: vista.json, alcance: alcanceReal, intencion: discutir ? 'discutir' : 'editar' }, corte.signal, archivos);
  if (!r.ok) {
    terminar({ de: 'mako', texto: r.error, error: !('cortado' in r) });
    return;
  }
  // «Discutir» no cambia nada: lo que diga MaKo, y ninguna operación aunque el server mandara alguna.
  if (discutir) {
    terminar({ de: 'mako', texto: r.resumen || 'No tengo nada para sugerir sobre eso.' });
    return;
  }
  const { operaciones: pedidas, descartes: deForma } = validarOperaciones(r.operaciones);
  const elegidos = [...new Set(elegidosIds.map((id) => [...vista.elementos.values()].find((e) => e.id === id)?.ref).filter((x): x is string => !!x))];
  const soloRefs = alcanceReal === 'seleccion' ? new Set(elegidos) : null;

  // Las imágenes con IA: se generan AHORA, una por vez, y se cambian por las que se aplican.
  const deImagenes: string[] = [];
  const links: Array<{ texto: string; href: string }> = [];
  let operaciones: OperacionImagen[] = pedidas;
  if (pedidas.some(esOperacionDeImagenIA)) {
    operaciones = [];
    const refsVista: RefsDeVista = {
      elementos: new Map([...vista.elementos.values()].map((e) => [e.ref, { id: e.id, titulo: e.titulo }] as const)),
      paginas: vista.paginas,
    };
    for (const op of pedidas) {
      if (!esOperacionDeImagenIA(op)) { operaciones.push(op); continue; }
      if (corte.signal.aborted) { deImagenes.push('Detenido antes de crear la imagen.'); continue; }
      cambiarHilo(disenoId, (h) => ({ ...h, progreso: op.op === 'crear_imagen' ? 'Creando la imagen…' : 'Editando la imagen…' }));
      const lista = await imagenConIA(editor, doc, op, { vista: refsVista, activePageId, soloRefs }, corte.signal);
      if (lista.ok) operaciones.push(lista.op);
      else {
        deImagenes.push(lista.motivo);
        if (lista.link && !links.some((l) => l.href === lista.link!.href)) links.push(lista.link);
      }
    }
    cambiarHilo(disenoId, (h) => ({ ...h, progreso: undefined }));
  }
  const propuesta: Propuesta = {
    paginaId: activePageId,
    refs: [...vista.elementos.values()].map((e) => [e.ref, e.id]),
    paginas: [...vista.paginas.entries()],
    elegidos,
    alcance: alcanceReal,
    operaciones,
    docVersion,
  };
  // La prueba: sobre una COPIA del documento con que se pidió. Nada se aplica todavía.
  const prueba = aplicarOperaciones({
    doc, operaciones, vista: refsDe(propuesta), nuevoId: nuevoIdObjeto, activePageId,
    soloRefs, fuente: fuenteDelEditor(doc),
  });
  const descartes = [...deImagenes, ...deForma, ...prueba.descartes];
  const conLinks = links.length ? { links } : {};
  if (!prueba.aplicadas) {
    // Si lo que no salió fue la imagen, el motivo del proveedor ES la respuesta (el resumen del modelo diría «te la creo»).
    if (deImagenes.length) {
      terminar({ de: 'mako', texto: deImagenes[0], error: true, ...(descartes.length > 1 ? { descartes: descartes.slice(1) } : {}), ...conLinks });
      return;
    }
    terminar({ de: 'mako', texto: r.resumen || 'Sin cambios.', ...(descartes.length ? { descartes } : {}) });
    return;
  }
  terminar({
    de: 'mako', texto: r.resumen || 'Listo.', estado: 'pendiente', cambios: prueba.cambios,
    ...(descartes.length ? { descartes } : {}), propuesta, ...conLinks,
  });
}

/** Las imágenes con IA ya creadas de una propuesta de la API, por mensaje y operación: un reintento no vuelve a pagar. */
const generadas = new Map<string, OperacionInterna>();

/**
 * Las imágenes con IA de una propuesta de la API (crear_imagen, editar_imagen sin generar): se crean AHORA, una por vez,
 * y se cambian por las que se aplican. Lo que falla se dice con el motivo del proveedor.
 */
async function imagenesDeLaPropuesta(editor: EditorEngine, disenoId: string, m: MensajeMako, p: Propuesta): Promise<{ operaciones: OperacionImagen[]; descartes: string[]; links: Array<{ texto: string; href: string }> }> {
  const operaciones: OperacionImagen[] = [];
  const descartes: string[] = [];
  const links: Array<{ texto: string; href: string }> = [];
  const corte = new AbortController();
  cortes.set(disenoId, corte);
  const doc = editor.getDocument();
  const ctx = { vista: refsDe(p), activePageId: p.paginaId ?? editor.state.activePageId, soloRefs: null };
  try {
    for (const [i, op] of p.operaciones.entries()) {
      if (!esOperacionDeImagenIA(op)) { operaciones.push(op); continue; }
      const clave = `${m.id}:${i}:${claveDeOperacion(op)}`;
      const ya = generadas.get(clave);
      if (ya) { operaciones.push(ya); continue; }
      if (corte.signal.aborted) { descartes.push('Detenido antes de crear la imagen.'); continue; }
      cambiarHilo(disenoId, (h) => ({ ...h, progreso: op.op === 'crear_imagen' ? 'Creando la imagen…' : 'Editando la imagen…' }), { guardar: false });
      const lista = await imagenConIA(editor, doc, op, ctx, corte.signal);
      if (lista.ok) { generadas.set(clave, lista.op); operaciones.push(lista.op); continue; }
      descartes.push(lista.motivo);
      if (lista.link && !links.some((l) => l.href === lista.link!.href)) links.push(lista.link);
    }
  } finally {
    cortes.delete(disenoId);
    cambiarHilo(disenoId, (h) => ({ ...h, progreso: undefined }), { guardar: false });
  }
  return { operaciones, descartes, links };
}

/**
 * «Aceptar»: aplica la propuesta sobre el documento de AHORA, en un paso de deshacer. Devuelve lo que no se pudo (un
 * elemento que ya no está, uno que se bloqueó en el medio). Una de la API se cierra en la base al aplicarla.
 */
export async function aceptarPropuesta(editor: EditorEngine, m: MensajeMako): Promise<void> {
  const disenoId = editor.designId;
  const p = m.propuesta;
  if (!p || !disenoId || m.estado !== 'pendiente') return;
  cambiarMensaje(disenoId, m.id, { estado: 'aplicando', aviso: undefined });
  // Las imágenes con IA (sólo en una propuesta de la API): se crean ahora, con la persona mirando.
  let operaciones = p.operaciones;
  const deImagenes: string[] = [];
  if (operaciones.some(esOperacionDeImagenIA)) {
    const g = await imagenesDeLaPropuesta(editor, disenoId, m, p);
    operaciones = g.operaciones;
    deImagenes.push(...g.descartes);
    if (g.links.length) cambiarMensaje(disenoId, m.id, { links: g.links });
  }
  const probar = () => {
    const doc = editor.getDocument();
    return {
      doc,
      r: aplicarOperaciones({
        doc, operaciones, vista: refsDe(p), nuevoId: nuevoIdObjeto, activePageId: p.paginaId ?? editor.state.activePageId,
        soloRefs: p.alcance === 'seleccion' ? new Set(p.elegidos) : null, fuente: fuenteDelEditor(doc),
      }),
    };
  };
  let { doc, r } = probar();
  if (!r.aplicadas) {
    const por = [...deImagenes, ...r.descartes.filter((d) => !/imagen con IA que no se llegó a crear/.test(d))];
    cambiarMensaje(disenoId, m.id, { estado: 'pendiente', aviso: `Ya no se puede aplicar: ${por.slice(0, 2).join(' · ') || 'el diseño cambió'}` });
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
  const descartes = [...deImagenes, ...r.descartes];
  cambiarMensaje(disenoId, m.id, {
    estado: 'aplicada',
    aplicada: { version: editor.state.docVersion },
    descartes: descartes.length ? descartes : m.descartes,
  });
  editor.toast('Cambio aplicado', 'success');
  // Una de la API: se cierran en la base EXACTAMENTE las operaciones que mostró el mensaje (con la crear_imagen, no la
  // imagen ya creada). Si no llega, ./propuestas.ts lo vuelve a mandar en la próxima búsqueda.
  if (m.propuestaApi) {
    void resolverEnServidorImagen(m.propuestaApi.id, 'aplicada', descartes, p.operaciones).then((c) => {
      if (c.cerrada) marcarCerradaImagen(disenoId, m.id);
    });
  }
}

/**
 * «Descartar»: la propuesta queda descartada en el hilo y, si llegó por la API, se cierra en la base (si no llega, la
 * próxima búsqueda lo vuelve a mandar). Una pantalla que sólo marca el mensaje como descartado también se cierra así.
 */
export function descartarPropuesta(editor: EditorEngine, m: MensajeMako): void {
  const disenoId = editor.designId;
  if (!disenoId || m.estado !== 'pendiente') return;
  cambiarMensaje(disenoId, m.id, { estado: 'descartada', aviso: undefined });
  if (m.propuestaApi) {
    void resolverEnServidorImagen(m.propuestaApi.id, 'descartada', [], m.propuesta?.operaciones ?? []).then((c) => {
      if (c.cerrada) marcarCerradaImagen(disenoId, m.id);
    });
  }
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
