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
import { aplicarOperaciones, type RefsDeVista } from '@/lib/image-editor/chat/aplicar';
import { familiaDe, tipoDe, vistaDeDiseno } from '@/lib/image-editor/chat/vista';
import { FUENTES } from '../fuentes';
import { cambiarHilo, cambiarMensaje, conId, leerHilo, type MensajeMako, type MensajeNuevo, type Propuesta } from './hilo';

/** La ruta corta a 120 s; el pedido se corta un poco después. */
const PLAZO_MS = 125_000;
/** Las fuentes que se le sugieren a la IA: las primeras del catálogo (orden = popularidad). */
const SUGERIDAS = 30;

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

type Respuesta = { ok: true; resumen: string; operaciones: unknown[] } | { ok: false; error: string };

async function pedirIA(cuerpo: object, senal: AbortSignal): Promise<Respuesta | { ok: false; error: string; cortado: true }> {
  const plazo = new AbortController();
  const t = setTimeout(() => plazo.abort(), PLAZO_MS);
  const alCortar = () => plazo.abort();
  senal.addEventListener('abort', alCortar);
  try {
    const res = await fetch('/api/image-editor/ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: plazo.signal,
    });
    const json = (await res.json().catch(() => null)) as Respuesta | null;
    if (!json) return { ok: false, error: 'MaKo no respondió. Vuelve a intentar.' };
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

/** Manda una instrucción y deja en el hilo la respuesta: una PROPUESTA para revisar, o lo que no se pudo. */
export async function pedirEdicion(editor: EditorEngine, instruccion: string, alcance: AlcanceChat): Promise<void> {
  const disenoId = editor.designId;
  const texto = instruccion.trim();
  if (!disenoId || !texto || leerHilo(disenoId).corriendo) return;

  const elegidosIds = editor.state.selection.ids.slice();
  const alcanceReal: AlcanceChat = alcance === 'seleccion' && elegidosIds.length ? 'seleccion' : 'diseno';
  cambiarHilo(disenoId, (h) => ({
    corriendo: true,
    mensajes: [...h.mensajes, conId({ de: 'yo', texto, alcance: alcanceReal === 'seleccion' ? rotuloSeleccion(elegidosIds.length) : null })],
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
  const r = await pedirIA({ instruccion: texto, diseno: vista.json, alcance: alcanceReal }, corte.signal);
  if (!r.ok) {
    terminar({ de: 'mako', texto: r.error, error: !('cortado' in r) });
    return;
  }
  const { operaciones, descartes: deForma } = validarOperaciones(r.operaciones);
  const elegidos = [...new Set(elegidosIds.map((id) => [...vista.elementos.values()].find((e) => e.id === id)?.ref).filter((x): x is string => !!x))];
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
    soloRefs: alcanceReal === 'seleccion' ? new Set(elegidos) : null, fuente: fuenteDelEditor(doc),
  });
  const descartes = [...deForma, ...prueba.descartes];
  if (!prueba.aplicadas) {
    terminar({ de: 'mako', texto: r.resumen || 'Sin cambios.', ...(descartes.length ? { descartes } : {}) });
    return;
  }
  terminar({
    de: 'mako', texto: r.resumen || 'Listo.', estado: 'pendiente', cambios: prueba.cambios,
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
        soloRefs: p.alcance === 'seleccion' ? new Set(p.elegidos) : null, fuente: fuenteDelEditor(doc),
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
