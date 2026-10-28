// =============================================================================
// image-editor/chat/propuestas — lo que la API PROPONE en un diseño del Image Editor (`image_editor_propuestas`, 0340)
// =============================================================================
// El espejo de lib/editor-video/propuestas.ts para el Image Editor (27/10/2026). Cada acción del chat en la API
// (./api.ts) deja su operación en una PROPUESTA del diseño; el editor la muestra en su chat «MaKo IA» y una persona la
// acepta con el mismo «Aceptar» (app/image-editor/mako/chat/acciones.ts → aceptarPropuesta, que la vuelve a probar
// contra el diseño de ESE momento, por id). La base: ./propuestas-server.ts; el editor: app/image-editor/mako/chat/propuestas.ts.
//
// Lo que gobierna, y no se ve en las firmas:
//   · SE PRUEBA CONTRA EL DISEÑO GUARDADO AL PROPONER (`revisarContraDiseno`): el diseño SÍ está en la base (a diferencia
//     del video, que vive en el navegador), así que la propuesta entera (lo que ya tenía + esto) se aplica sobre una
//     COPIA con el MISMO motor puro del chat (./aplicar.ts). Lo que no cambia nada se rechaza en el momento con su motivo,
//     para que el modelo se corrija; las filas «Original | Modificado» salen de esa misma prueba.
//   · LAS REFS NO DEPENDEN DE LA POSICIÓN: salen del id de cada objeto (./vista.ts, `refsDeIds`), así que las que vio el
//     modelo en ver_diseno_imagen siguen siendo las mismas al proponer y al aceptar. Se guardan las que USA la propuesta.
//   · LAS IMÁGENES CON IA NO SE PRUEBAN APLICÁNDOLAS (todavía no existen): se revisa su destino (`destinoDeImagen`), y se
//     crean y se cobran recién al aceptar.
//   · LO DEL MISMO CANAL SE JUNTA, hasta el tope del chat y por un rato (el de video: `VENTANA_JUNTAR_MS`).
//
// Puro y sin `server-only`: lo leen el server, el editor y los tests.
// =============================================================================

import { TOPES_CHAT_IMAGEN, esOperacionDeImagenIA, type OperacionImagen } from './catalogo';
import { aplicarOperaciones, destinoDeImagen, type CambioImagen, type RefsDeVista } from './aplicar';
import { vistaDeDiseno } from './vista';

export { VENTANA_JUNTAR_MS, claveDeOperacion, restarOperaciones, CANAL_TEXTO } from '../../editor-video/propuestas';

/** Las operaciones de una propuesta: el tope del chat (lo que se acepta de una vez). */
export const TOPE_OPERACIONES_IMAGEN = TOPES_CHAT_IMAGEN.operaciones;

/** Las refs que una operación USA (elementos y páginas) y las que DEFINE («n1»). */
export function refsDeOperacionImagen(op: OperacionImagen): { usa: string[]; paginas: string[]; define: string[] } {
  const o = op as Record<string, unknown>;
  const usa: string[] = [];
  const paginas: string[] = [];
  const define: string[] = [];
  if (op.op === 'agregar_texto' || op.op === 'agregar_forma' || op.op === 'crear_imagen' || op.op === 'agregar_imagen') {
    if (typeof o.ref === 'string') define.push(o.ref);
  } else if (typeof o.ref === 'string') usa.push(o.ref);
  if (op.op === 'duplicar' && op.nueva) define.push(op.nueva);
  if (op.op === 'borrar' || op.op === 'alinear') usa.push(...op.refs);
  if (typeof o.pagina === 'string') paginas.push(o.pagina);
  if (op.op === 'agregar_pagina' && op.despues_de) paginas.push(op.despues_de);
  return { usa, paginas, define };
}

/** Lo de la vista del diseño guardado que hace falta: ref → id (con su título) y la página por defecto (la primera). */
export type VistaGuardada = { refs: RefsDeVista; paginaId: string | null };

export function vistaGuardada(doc: unknown): VistaGuardada {
  const v = vistaDeDiseno(doc);
  return {
    refs: { elementos: new Map([...v.elementos.values()].map((e) => [e.ref, { id: e.id, titulo: e.titulo }] as const)), paginas: v.paginas },
    paginaId: v.paginaActual ? v.paginas.get(v.paginaActual) ?? null : null,
  };
}

/** Las refs (de elementos y de páginas) que usan unas operaciones, con su id: lo que se guarda en la propuesta. */
export function refsUsadas(ops: readonly OperacionImagen[], v: VistaGuardada): { refs: Array<[string, string]>; paginas: Array<[string, string]> } {
  const refs = new Map<string, string>();
  const paginas = new Map<string, string>();
  for (const op of ops) {
    const r = refsDeOperacionImagen(op);
    for (const ref of r.usa) { const id = v.refs.elementos.get(ref)?.id; if (id) refs.set(ref, id); }
    for (const ref of r.paginas) { const id = v.refs.paginas.get(ref); if (id) paginas.set(ref, id); }
  }
  return { refs: [...refs], paginas: [...paginas] };
}

/** Una fila de «Original | Modificado», para la persona (la tarjeta del chat y el editor). */
export type FilaImagen = { campo: string; antes: string; despues: string };

const filaDe = (c: CambioImagen): FilaImagen => ({ campo: c.titulo.slice(0, 60), antes: c.antes || '—', despues: c.despues || (c.tipo === 'quita' ? 'Se quita' : '—') });

/** La fila de una imagen con IA que todavía no se creó (se crea al aceptar). */
export function filaDeImagenIA(op: Extract<OperacionImagen, { op: 'crear_imagen' | 'editar_imagen' }>, titulo?: string): FilaImagen {
  const que = op.prompt.length > 120 ? `${op.prompt.slice(0, 119)}…` : op.prompt;
  return op.op === 'crear_imagen'
    ? { campo: 'Imagen nueva con IA', antes: '—', despues: `${que} (se crea al aceptar y se cobra en la cuenta del negocio)` }
    : { campo: `Imagen ${titulo ?? op.ref}`, antes: 'la imagen de ahora', despues: `${que} (se edita al aceptar y se cobra en la cuenta del negocio)` };
}

/**
 * La propuesta entera probada sobre una COPIA del diseño guardado: sus filas, lo que no se pudo y cuántas cambiaron algo.
 * Las imágenes con IA no se aplican (no existen todavía): se revisa su destino y llevan su fila.
 */
export function probarPropuesta(doc: unknown, ops: readonly OperacionImagen[], v: VistaGuardada): { filas: FilaImagen[]; descartes: string[]; aplicadas: number } {
  let n = 0;
  const comunes = ops.filter((o) => !esOperacionDeImagenIA(o));
  const r = aplicarOperaciones({ doc, operaciones: comunes, vista: v.refs, nuevoId: () => `prueba-${++n}`, activePageId: v.paginaId });
  const filas = r.cambios.map(filaDe);
  const descartes = [...r.descartes];
  let aplicadas = r.aplicadas;
  for (const op of ops) {
    if (!esOperacionDeImagenIA(op)) continue;
    const d = destinoDeImagen({ doc, op, vista: v.refs, activePageId: v.paginaId });
    if (!d.ok) { descartes.push(d.motivo); continue; }
    filas.push(filaDeImagenIA(op, d.op === 'editar_imagen' ? d.titulo : undefined));
    aplicadas++;
  }
  return { filas, descartes, aplicadas };
}

/**
 * ¿Se puede sumar esta operación a la propuesta, contra el diseño GUARDADO? `previas` son las que ya tiene la propuesta
 * abierta (sus «n1» valen). Lo que no cambia nada se rechaza con el motivo de la prueba.
 */
export function revisarContraDiseno(p: { op: OperacionImagen; doc: unknown; previas: readonly OperacionImagen[] }): { ok: true; filas: FilaImagen[] } | { ok: false; motivo: string } {
  const { op, doc, previas } = p;
  if (previas.length >= TOPE_OPERACIONES_IMAGEN) {
    return { ok: false, motivo: `la propuesta abierta ya tiene ${TOPE_OPERACIONES_IMAGEN} cambios: hay que aceptarla o descartarla en el editor antes de proponer más` };
  }
  if (esOperacionDeImagenIA(op) && previas.filter(esOperacionDeImagenIA).length >= TOPES_CHAT_IMAGEN.imagenes) {
    return { ok: false, motivo: `la propuesta abierta ya pide ${TOPES_CHAT_IMAGEN.imagenes} imágenes con IA (cada una se cobra en la cuenta del negocio): que se acepte o se descarte antes de pedir otra` };
  }
  const nuevas = new Set(previas.flatMap((x) => refsDeOperacionImagen(x).define));
  for (const r of refsDeOperacionImagen(op).define) {
    if (nuevas.has(r)) return { ok: false, motivo: `«${r}» ya se usa en esta propuesta: una ref nueva va con otro número («n2», «n3»…)` };
  }
  const v = vistaGuardada(doc);
  const antes = probarPropuesta(doc, previas, v);
  const despues = probarPropuesta(doc, [...previas, op], v);
  if (despues.aplicadas <= antes.aplicadas) {
    const motivo = despues.descartes.find((d) => !antes.descartes.includes(d)) ?? despues.descartes[despues.descartes.length - 1] ?? 'no cambia nada en el diseño';
    return { ok: false, motivo };
  }
  return { ok: true, filas: despues.filas };
}

/** La operación en palabras, para la persona y para el modelo: «Mover un elemento del diseño: «Oferta»». */
export function lineaDeOperacionImagen(titulo: string, op: OperacionImagen, v: VistaGuardada | null): string {
  const { usa } = refsDeOperacionImagen(op);
  const nombres = usa.map((r) => v?.refs.elementos.get(r)?.titulo ?? r);
  const o = op as Record<string, unknown>;
  const detalle = typeof o.texto === 'string' ? ` → «${o.texto.slice(0, 60)}»` : typeof o.prompt === 'string' ? ` → ${o.prompt.slice(0, 60)}` : typeof o.color === 'string' ? ` → ${o.color}` : '';
  return `${titulo}${nombres.length ? `: ${nombres.join(', ')}` : ''}${detalle}`.slice(0, 200);
}

/** La ruta del editor en ESA propuesta. Una ruta de la app: el `?ws=` lo pone quien navega. */
export const rutaDePropuestaImagen = (disenoId: string, id: string): string =>
  `/image-editor/${encodeURIComponent(disenoId)}?propuesta=${encodeURIComponent(id)}`;

/** Cuántas filas lleva la tarjeta (el tope del bloque G4, lib/chat-bloques.ts). */
export const MAX_FILAS_TARJETA_IMAGEN = 12;

/** El bloque G4 de una propuesta («Original | Modificado» con «Aceptar en el editor»), o null sin filas. */
export function bloqueDePropuestaImagen(p: { disenoId: string; titulo?: string | null; id: string; filas: readonly FilaImagen[]; total?: number }) {
  if (!p.filas.length) return null;
  const filas = p.filas.slice(0, MAX_FILAS_TARJETA_IMAGEN);
  const mas = p.total && p.total > filas.length ? ` (y ${p.total - filas.length} más en el editor)` : '';
  const nombre = (p.titulo ?? '').trim();
  return {
    t: 'antes_despues' as const,
    titulo: `${nombre ? `Cambios propuestos en «${nombre.slice(0, 60)}»` : 'Cambios propuestos en el diseño'}${mas}`.slice(0, 120),
    filas,
    abrir: { titulo: 'Aceptar en el editor', href: rutaDePropuestaImagen(p.disenoId, p.id) },
  };
}
