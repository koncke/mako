'use client';

// =============================================================================
// mako/chat/propuestas — lo que la API de MaKo propuso en el diseño abierto, como un cambio más del chat «MaKo IA»
// =============================================================================
// El espejo de app/video-editor/_opencut/chat/propuestas.ts (27/10/2026). Las operaciones del chat pasan a la API
// (lib/image-editor/chat/api.ts) y cada una deja su cambio en una PROPUESTA del diseño (mig 0344, por
// /api/image-editor/propuestas). El editor la trae y la pone en el hilo como una respuesta de MaKo con su revisión
// «Original | Modificado»; se acepta con el MISMO «Aceptar» (./acciones.ts → aceptarPropuesta, que la prueba contra el
// diseño de ahora con las refs de la propuesta) y, aceptada o descartada, se cierra en la base.
//
//   · Se buscan al abrir el editor, al volver a la pestaña y cada tanto mientras se ve.
//   · El mensaje tiene el id de la propuesta (`api-<id>`): no se repite al volver a buscar, y si la propuesta creció
//     (otra acción se sumó) el mensaje se actualiza mientras siga pendiente. Las reglas de qué mostrar y a dónde va el
//     link son LAS MISMAS del video (app/video-editor/_opencut/chat/foco.ts, puras): una cosa, un lugar.
//   · Un cierre que no llegó a la base (la red; o un «Descartar» de la pantalla, que sólo marca el mensaje) se vuelve a
//     mandar en la próxima búsqueda: por eso la pantalla no necesita saber de la base.
//   · El link `?propuesta=<id>` la ENFOCA: el hilo guarda `foco` (el id del mensaje) para que el panel baje hasta ella.
//   · ⚠️ Una propuesta con una imagen con IA (crear_imagen_ia, editar_imagen_ia) no se paga al traerla: la imagen se crea
//     recién en «Aceptar» (./acciones.ts), con la persona mirando.
// =============================================================================

import type { EditorEngine } from '../../_doory/editor/extensions';
import { esOperacionDeImagenIA, validarOperacionesDePropuesta, type OperacionImagen } from '@/lib/image-editor/chat/catalogo';
import { aplicarOperaciones, type CambioImagen } from '@/lib/image-editor/chat/aplicar';
import { CANAL_TEXTO, filaDeImagenIA } from '@/lib/image-editor/chat/propuestas';
import { focoDePropuesta, idDeMensaje, queMostrar } from '@/app/video-editor/_opencut/chat/foco';
import { cambiarHilo, cambiarMensaje, cargarHilo, leerHilo, type Mensaje, type MensajeMako } from './hilo';

const RUTA = '/api/image-editor/propuestas';
/** Cada cuánto se vuelve a mirar mientras el editor está a la vista. */
const CADA_MS = 60_000;
/** Cuántas propuestas pide el editor por id, como mucho (lib/image-editor/chat/propuestas-server.ts → TOPE_INCLUIR_IMAGEN). */
const TOPE_INCLUIR = 40;

type PropuestaServer = {
  id: string; canal: string; paginaId: string | null; refs: Array<[string, string]>; paginas: Array<[string, string]>;
  operaciones: unknown; lineas: string[]; creada: string; version: number;
};

/** Una guardada, como la ve el editor (con sus imágenes con IA sin generar). */
const validas = (x: unknown): OperacionImagen[] => validarOperacionesDePropuesta(x, { iaPendiente: true }).operaciones;
const comoLaVe = (op: unknown): unknown => validas([op])[0] ?? op;

/** El texto del mensaje: de dónde llegó y qué pide, una línea por cambio. */
export function textoDePropuestaImagen(p: { canal: string; lineas: readonly string[] }): string {
  const desde = CANAL_TEXTO[p.canal] ?? p.canal;
  return [`Propuesta por ${desde}:`, ...p.lineas.slice(0, 12).map((l) => `• ${l}`), ...(p.lineas.length > 12 ? [`y ${p.lineas.length - 12} más`] : [])].join('\n');
}

const nuevoIdPrueba = (() => { let n = 0; return () => `prueba-${++n}`; })();

/**
 * Las filas «Original | Modificado» de una propuesta contra el diseño de AHORA (lo mismo que mira «Aceptar»): las comunes
 * probadas sobre una copia, y las imágenes con IA con su fila de «se crea al aceptar».
 */
export function revisionDePropuesta(doc: unknown, p: { refs: Array<[string, string]>; paginas: Array<[string, string]>; paginaId: string | null }, ops: readonly OperacionImagen[]): { cambios: CambioImagen[]; descartes: string[] } {
  const vista = { elementos: new Map(p.refs.map(([ref, id]) => [ref, { id }] as const)), paginas: new Map(p.paginas) };
  const r = aplicarOperaciones({ doc, operaciones: ops.filter((o) => !esOperacionDeImagenIA(o)), vista, nuevoId: nuevoIdPrueba, activePageId: p.paginaId });
  const deIA: CambioImagen[] = ops.filter(esOperacionDeImagenIA).map((o): CambioImagen => {
    const f = filaDeImagenIA(o);
    return { tipo: o.op === 'crear_imagen' ? 'agrega' : 'cambia', titulo: f.campo, antes: f.antes === '—' ? '' : f.antes, despues: f.despues };
  });
  return { cambios: [...r.cambios, ...deIA], descartes: r.descartes };
}

/** Arma el mensaje de una propuesta contra el diseño de AHORA. */
function mensajeDe(editor: EditorEngine, p: PropuestaServer, ops: OperacionImagen[], id: string = idDeMensaje(p.id)): MensajeMako {
  const { cambios, descartes } = revisionDePropuesta(editor.getDocument(), p, ops);
  const creada = Date.parse(p.creada) || Date.now();
  return {
    id, c: creada, t: Date.now(), de: 'mako',
    texto: textoDePropuestaImagen(p),
    estado: 'pendiente',
    cambios,
    ...(descartes.length ? { descartes } : {}),
    propuesta: { paginaId: p.paginaId, refs: p.refs, paginas: p.paginas, elegidos: [], alcance: 'diseno', operaciones: ops },
    // Al aceptar o descartar se cierran en la base EXACTAMENTE las operaciones de este mensaje (por contenido).
    propuestaApi: { id: p.id, canal: p.canal, version: Number(p.version) || 0 },
  };
}

let buscando = false;

/**
 * Cierra en la base lo que tenía un mensaje que se aceptó o se descartó: EXACTAMENTE esas operaciones (`ops`, como se
 * MOSTRARON: con la crear_imagen, no con la imagen ya generada), por contenido. Nunca falla: `cerrada` = la base lo
 * confirmó (o ya no estaba abierta).
 */
export async function resolverEnServidorImagen(propuestaId: string, estado: 'aplicada' | 'descartada', descartes: readonly string[] = [], ops: readonly unknown[] = []): Promise<{ cerrada: boolean; quedan: number }> {
  try {
    const res = await fetch(RUTA, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: propuestaId, estado, descartes, ops }),
    });
    const r = (await res.json().catch(() => null)) as { ok?: unknown; yaResuelta?: unknown; quedan?: unknown } | null;
    const quedan = typeof r?.quedan === 'number' && r.quedan > 0 ? r.quedan : 0;
    return { cerrada: r?.ok === true || r?.yaResuelta === true, quedan };
  } catch {
    return { cerrada: false, quedan: 0 };
  }
}

/** Anota en el mensaje que la base confirmó su cierre: no se vuelve a mandar. */
export function marcarCerradaImagen(disenoId: string, mensajeId: string): void {
  const m = leerHilo(disenoId).mensajes.find((x): x is MensajeMako => x.id === mensajeId && x.de === 'mako');
  if (m?.propuestaApi && !m.propuestaApi.cerrada) cambiarMensaje(disenoId, mensajeId, { propuestaApi: { ...m.propuestaApi, cerrada: true } });
}

/**
 * Trae las propuestas abiertas del diseño abierto y las pone en su hilo. Devuelve cuántas llegaron nuevas y cuáles están
 * abiertas, o `null` si no pudo mirar. Pide POR ID las que le importan (la del link, las pendientes y las de cierre sin
 * confirmar) y reintenta los cierres que no llegaron a la base.
 */
export async function traerPropuestasImagen(editor: EditorEngine, opciones: { incluir?: string | null } = {}): Promise<{ nuevas: number; abiertas: string[] } | null> {
  const disenoId = editor.designId;
  if (!disenoId || buscando) return null;
  buscando = true;
  try {
    await cargarHilo(disenoId);
    const deApi = () => leerHilo(disenoId).mensajes.filter((m): m is MensajeMako => m.de === 'mako' && !!m.propuestaApi);
    const sinCerrar = (m: MensajeMako) => m.estado === 'pendiente' || !m.propuestaApi?.cerrada;
    const pedir = [...new Set([opciones.incluir ?? '', ...deApi().filter(sinCerrar).map((m) => m.propuestaApi!.id)].filter(Boolean))].slice(0, TOPE_INCLUIR);
    const qs = pedir.map((id) => `&propuesta=${encodeURIComponent(id)}`).join('');
    const res = await fetch(`${RUTA}?diseno=${encodeURIComponent(disenoId)}${qs}`, { cache: 'no-store' });
    const r = (await res.json().catch(() => null)) as { ok?: boolean; propuestas?: PropuestaServer[] } | null;
    if (!r?.ok || !Array.isArray(r.propuestas)) return null;
    const abiertas = new Map(r.propuestas.map((p) => [p.id, p] as const));
    const pedidas = new Set(pedir);

    for (const m of deApi()) {
      const id = m.propuestaApi!.id;
      if (!abiertas.has(id)) {
        if (!pedidas.has(id)) continue;
        if (m.estado === 'pendiente') cambiarMensaje(disenoId, m.id, { estado: 'descartada', aviso: 'Se resolvió en otra pestaña.', propuestaApi: { ...m.propuestaApi!, cerrada: true } });
        else if (!m.propuestaApi!.cerrada) cambiarMensaje(disenoId, m.id, { propuestaApi: { ...m.propuestaApi!, cerrada: true } });
        continue;
      }
      // Un cierre que no llegó a la base (aceptada, descartada o deshecha): se vuelve a mandar. Es idempotente.
      const manejada = m.estado === 'aplicada' || m.estado === 'descartada' || m.estado === 'restaurada';
      if (manejada && !m.propuestaApi!.cerrada && m.propuesta) {
        void resolverEnServidorImagen(id, m.estado === 'descartada' ? 'descartada' : 'aplicada', [], m.propuesta.operaciones).then((c) => {
          if (c.cerrada) marcarCerradaImagen(disenoId, m.id);
        });
      }
    }

    let nuevas = 0;
    for (const p of abiertas.values()) {
      const crudas = Array.isArray(p.operaciones) ? p.operaciones : [];
      const suyos = deApi().filter((m) => m.propuestaApi!.id === p.id);
      const d = queMostrar(p.id, crudas.map(comoLaVe), suyos.map((m) => ({ id: m.id, estado: m.estado, cerrada: !!m.propuestaApi?.cerrada, ops: m.propuesta?.operaciones ?? [] })));
      if (d.accion === 'nada') continue;
      const lineas = Array.isArray(p.lineas) && p.lineas.length === crudas.length ? d.quedan.map((i) => p.lineas[i]) : p.lineas;
      const ops = validas(d.quedan.map((i) => crudas[i]));
      if (!ops.length) continue;
      const m = mensajeDe(editor, { ...p, lineas }, ops, d.id);
      if (d.accion === 'reemplazar') cambiarHilo(disenoId, (h) => ({ ...h, mensajes: h.mensajes.map((x): Mensaje => (x.id === d.id ? m : x)) }));
      else {
        cambiarHilo(disenoId, (h) => ({ ...h, mensajes: [...h.mensajes, m].sort((a, b) => a.c - b.c) }));
        nuevas++;
      }
    }
    if (nuevas) editor.toast(nuevas === 1 ? 'MaKo te propone un cambio' : `MaKo te propone ${nuevas} cambios`);
    return { nuevas, abiertas: [...abiertas.keys()] };
  } catch {
    return null;
  } finally {
    buscando = false;
  }
}

/** Enfoca la propuesta del link: el hilo guarda el mensaje (`foco`) y, si ya no está abierta, se dice por qué. */
function enfocarPropuesta(editor: EditorEngine, disenoId: string, propuestaId: string, abiertas: readonly string[]): void {
  const f = focoDePropuesta(propuestaId, new Set(abiertas), leerHilo(disenoId).mensajes);
  if (f.mensajeId) cambiarHilo(disenoId, (h) => ({ ...h, foco: f.mensajeId! }), { guardar: false });
  if (f.aviso) editor.toast(f.aviso);
}

/** Cuántas veces se reintenta la primera búsqueda con `?propuesta=` mientras el diseño carga (cada 1,5 s). */
const INTENTOS_FOCO = 20;

/**
 * Busca al abrir, al volver a la pestaña y cada tanto mientras se ve. Lo monta la pantalla del editor (una vez por
 * diseño): `useEffect(() => iniciarPropuestasImagen(editor, { foco: propuesta }), [editor, propuesta])`, con `propuesta` el
 * `?propuesta=` del link. Devuelve la limpieza.
 */
export function iniciarPropuestasImagen(editor: EditorEngine, opciones: { foco?: string | null } = {}): () => void {
  let pendienteDeFoco = opciones.foco ?? null;
  let intentos = 0;
  let reintento: ReturnType<typeof setTimeout> | null = null;
  let cancelado = false;
  const buscar = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    void traerPropuestasImagen(editor, { incluir: pendienteDeFoco }).then((r) => {
      if (cancelado || !pendienteDeFoco) return;
      const disenoId = editor.designId;
      if (r && disenoId) {
        const foco = pendienteDeFoco;
        pendienteDeFoco = null;
        enfocarPropuesta(editor, disenoId, foco, r.abiertas);
        return;
      }
      if (++intentos < INTENTOS_FOCO) reintento = setTimeout(buscar, 1500);
    });
  };
  const alPrincipio = setTimeout(buscar, 1500);
  const cada = setInterval(buscar, CADA_MS);
  const alVolver = () => buscar();
  window.addEventListener('focus', alVolver);
  document.addEventListener('visibilitychange', alVolver);
  return () => {
    cancelado = true;
    clearTimeout(alPrincipio);
    if (reintento) clearTimeout(reintento);
    clearInterval(cada);
    window.removeEventListener('focus', alVolver);
    document.removeEventListener('visibilitychange', alVolver);
  };
}
