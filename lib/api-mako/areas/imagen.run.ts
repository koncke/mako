// =============================================================================
// api-mako/areas/imagen.run — los cuerpos del área `imagen` (el Image Editor)
// =============================================================================
// Cruzados por id con imagen.def.ts. Leen y escriben por lib/image-editor/server.ts, el MISMO camino que la pantalla
// (/api/image-editor/*): el documento se valida igual (forma de diseño, sin `idb://` ni `blob:`, tope de bytes) y el
// guardado es compare-and-set por versión. Corren dentro de runWithWorkspace(ctx.ws) (lib/api-mako/ejecutar.ts).
// Nada de esto importa el motor de Doory (es sólo de cliente): el documento se arma y se lee con lib/image-editor/reglas.ts.

import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Ctx, Propuesto, Runners, Preparado, Ejecutado } from '../tipos';
import { OPERACIONES_API_IMAGEN, operacionDesdeInputImagen, type OperacionApiImagen } from '@/lib/image-editor/chat/api';
import { proponerOperacionImagen } from '@/lib/image-editor/chat/propuestas-server';
import { bloqueDePropuestaImagen, rutaDePropuestaImagen } from '@/lib/image-editor/chat/propuestas';
import { TOPES_CHAT_IMAGEN } from '@/lib/image-editor/chat/catalogo';
import { vistaDeDiseno } from '@/lib/image-editor/chat/vista';
import type { BloqueCreado } from '@/lib/chat-bloques';
import { linkApp } from '@/lib/app-url';
import { borrarDiseno, crearDiseno, duplicarDiseno, guardarDiseno, leerDiseno, listarDisenos } from '@/lib/image-editor/server';
import { cambiarTextos, documentoEnBlanco, textosDe, uuidValido } from '@/lib/image-editor/reglas';
import { TAMANOS_API } from '@/lib/image-editor/tamanos';
import { catalogoPlantillas, documentoDePlantilla } from '@/app/image-editor/mako/plantillas';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';

const str = (input: Record<string, unknown>, k: string): string | null => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const QUIEN = 'MaKo (API)';
const link = (id: string, ws: number) => linkApp(`/image-editor/${id}`, ws);

/** El G5 de un diseño (lib/chat-bloques.ts): lo que el chat dibuja al confirmar, con la ruta de la app (sin `?ws=`: la pone
 *  el `Link` de quien mira). Sin miniatura, el chat dibuja un marco con la forma del diseño. */
function bloqueDiseno(id: string, d: { titulo: string; ancho?: number; alto?: number; miniatura?: string | null; estado: string; nota?: string }): BloqueCreado {
  return {
    t: 'creado', titulo: d.titulo, estado: d.estado, abrir: { titulo: 'Abrir en Image Editor', href: `/image-editor/${id}` },
    ...(d.miniatura ? { miniatura: d.miniatura } : {}), ...(d.ancho && d.alto ? { ancho: d.ancho, alto: d.alto } : {}),
    ...(d.nota ? { nota: d.nota } : {}),
  };
}

/** El diseño nuevo que pide la entrada: de una plantilla, de un tamaño con nombre o a medida. `miniatura` es la de la
 *  plantilla (la de Doory, en `public/cv/plantillas/`): el diseño recién creado todavía no tiene la suya. */
async function docNuevo(input: Record<string, unknown>): Promise<{ doc: unknown; que: string; ancho: number; alto: number; nota: string; miniatura?: string } | { error: string; faltan?: string[] }> {
  const plantilla = str(input, 'plantilla');
  if (plantilla) {
    const doc = await documentoDePlantilla(plantilla);
    if (!doc) return { error: `No existe la plantilla «${plantilla}». Usa listar_plantillas_imagen.`, faltan: ['plantilla'] };
    const t = catalogoPlantillas().find((p) => p.slug === plantilla);
    return {
      doc, que: `a partir de la plantilla «${t?.titulo ?? plantilla}»`, ancho: t?.ancho ?? 0, alto: t?.alto ?? 0,
      nota: `De la plantilla «${t?.titulo ?? plantilla}»`, miniatura: `/cv/plantillas/${plantilla}.webp`,
    };
  }
  const ancho = input.ancho;
  const alto = input.alto;
  if (typeof ancho === 'number' || typeof alto === 'number') {
    if (typeof ancho !== 'number' || typeof alto !== 'number') return { error: 'Para un tamaño a medida van ancho y alto.', faltan: ['ancho', 'alto'] };
    return { doc: documentoEnBlanco(ancho, alto, randomUUID()), que: `en blanco, ${ancho} × ${alto} px`, ancho, alto, nota: `En blanco, ${ancho} × ${alto} px` };
  }
  const t = TAMANOS_API[str(input, 'tamano') ?? 'publicacion_instagram'];
  if (!t) return { error: 'Ese tamaño no existe.', faltan: ['tamano'] };
  return {
    doc: documentoEnBlanco(t.ancho, t.alto, randomUUID()), que: `en blanco, ${t.nombre} (${t.ancho} × ${t.alto} px)`,
    ancho: t.ancho, alto: t.alto, nota: `${t.nombre}, ${t.ancho} × ${t.alto} px`,
  };
}

/** Los cambios de textos que pasó el modelo, saneados (sin vacíos ni repetidos). */
function cambiosDe(input: Record<string, unknown>): { actual: string; nuevo: string }[] {
  const crudo = Array.isArray(input.cambios) ? input.cambios : [];
  const out: { actual: string; nuevo: string }[] = [];
  for (const c of crudo) {
    const actual = typeof (c as { actual?: unknown })?.actual === 'string' ? String((c as { actual: string }).actual) : '';
    const nuevo = typeof (c as { nuevo?: unknown })?.nuevo === 'string' ? String((c as { nuevo: string }).nuevo) : '';
    if (actual.trim() && nuevo.trim() && !out.some((o) => o.actual === actual)) out.push({ actual, nuevo });
  }
  return out;
}

/** Lo que acompaña a cada propuesta del editor: no está aplicada, y dónde se acepta. */
const NOTA_PROPUESTA =
  'Quedó PROPUESTO, no aplicado: se acepta en el editor, en su chat «MaKo IA» (el link lo abre ahí). Lo que se pida por este mismo canal en este rato se suma a la misma propuesta.';
const NOTA_DINERO = ' La imagen con IA se crea recién al aceptar, con la IA del negocio, y se cobra en su cuenta.';

/**
 * Una operación del chat «MaKo IA», propuesta por la API (27/10/2026): la forma la valida la MISMA función que al chat
 * (`operacionDesdeInputImagen`), se prueba contra el diseño guardado, y queda en la propuesta abierta del canal.
 */
async function proponerEnElDiseno(o: OperacionApiImagen, input: Record<string, unknown>, ctx: Ctx): Promise<Propuesto> {
  const disenoId = str(input, 'disenoId') ?? '';
  if (!uuidValido(disenoId)) return { error: 'Falta el id del diseño (de listar_disenos_imagen).' };
  const v = operacionDesdeInputImagen(o, input);
  if (!v.ok) return { error: `No se puede proponer: ${v.motivo}.` };
  const r = await proponerOperacionImagen({ ws: ctx.ws, canal: ctx.canal, canalKey: ctx.canalKey, actor: ctx.actor ?? null, disenoId, titulo: o.titulo, op: v.op });
  if (!r.ok) {
    if ('motivo' in r) return { error: `No se puede proponer: ${r.motivo}.` };
    return { error: r.sinTabla ? 'Las propuestas del Image Editor todavía no se guardan en MaKo.' : 'No se pudo dejar la propuesta.' };
  }
  // La tarjeta «Original | Modificado» (bloque G4, lib/chat-bloques.ts) con «Aceptar en el editor» en ESA propuesta. La arma
  // el código con el diseño guardado, nunca el modelo. En WhatsApp no se dibuja: ahí sólo serían tokens de más.
  const bloque = ctx.canal === 'whatsapp' ? null : bloqueDePropuestaImagen({ disenoId, titulo: r.titulo, id: r.id, filas: r.filas, total: r.total });
  return {
    id: r.id,
    url: linkApp(rutaDePropuestaImagen(disenoId, r.id), ctx.ws),
    nueva: r.nueva,
    extra: { cambios: r.lineas, nota: `${NOTA_PROPUESTA}${o.dinero ? NOTA_DINERO : ''}`, ...(bloque ? { bloque } : {}) },
  };
}

/** El runner de una operación del editor: propone; `ejecutar` existe porque el tipo lo pide, y se niega. */
function enElEditor(id: string) {
  const o = OPERACIONES_API_IMAGEN.find((x) => x.id === id);
  if (!o) throw new Error(`api-mako: «${id}» no es una operación del Image Editor (lib/image-editor/chat/api.ts)`);
  return {
    proponer: (input: Record<string, unknown>, ctx: Ctx) => proponerEnElDiseno(o, input, ctx),
    ejecutar: async (): Promise<Ejecutado> => ({ ok: false, resumen: 'Este cambio se acepta en el editor, con el link de la propuesta: no por aquí.' }),
  };
}

export const RUNNERS: Runners = {
  listar_disenos_imagen: {
    leer: async (input, ctx) => {
      const r = await listarDisenos(ctx.ws);
      if (!r.ok) return JSON.stringify({ error: r.error });
      const aguja = (str(input, 'buscar') ?? '').toLocaleLowerCase('es');
      const disenos = r.disenos.filter((d) => !aguja || d.titulo.toLocaleLowerCase('es').includes(aguja));
      return JSON.stringify({
        total: disenos.length,
        disenos: disenos.slice(0, 100).map((d) => ({
          id: d.id, titulo: d.titulo, ancho: d.ancho, alto: d.alto, paginas: d.paginas, actualizado: d.actualizado, link: link(d.id, ctx.ws),
        })),
      });
    },
  },

  ver_diseno_imagen: {
    leer: async (input, ctx) => {
      const id = str(input, 'disenoId') ?? '';
      if (!uuidValido(id)) return JSON.stringify({ error: 'Falta el id del diseño (de listar_disenos_imagen).' });
      const r = await leerDiseno(ctx.ws, id);
      if (!r.ok) return JSON.stringify({ error: r.error });
      const d = r.diseno;
      // La vista del chat (27/10/2026): las refs con que se proponen los cambios. Muy grande, se dice (los textos van igual).
      const vista = vistaDeDiseno(d.doc);
      const conVista = vista.json.length <= TOPES_CHAT_IMAGEN.vistaMax
        ? { vista: JSON.parse(vista.json) as unknown }
        : { vista: null, aviso: 'El diseño es muy grande para leerlo entero aquí: sus cambios se piden en el chat del editor.' };
      return JSON.stringify({ id: d.id, titulo: d.titulo, ancho: d.ancho, alto: d.alto, actualizado: d.actualizado, paginas: textosDe(d.doc), link: link(d.id, ctx.ws), ...conVista });
    },
  },

  // Con las sugeridas para ESTE negocio primero, como en el panel del editor (lib/plantillas-sugeridas.ts).
  listar_plantillas_imagen: {
    leer: async () => JSON.stringify({ plantillas: catalogoPlantillas(await senalesDelNegocio().catch(() => null)) }),
  },

  crear_diseno_imagen: {
    preparar: async (input): Promise<Preparado> => {
      const n = await docNuevo(input);
      if ('error' in n) return { error: n.error, faltan: n.faltan };
      const titulo = str(input, 'titulo') ?? 'Diseño sin título';
      return { payload: { ...input }, resumen: `Crear el diseño «${titulo}» en el Image Editor, ${n.que}.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const n = await docNuevo(payload);
      if ('error' in n) return { ok: false, resumen: n.error };
      const titulo = str(payload, 'titulo') ?? 'Diseño sin título';
      const r = await crearDiseno(ctx.ws, QUIEN, { titulo, doc: n.doc });
      if (!r.ok) return { ok: false, resumen: `No se pudo crear (${r.error}).` };
      const url = link(r.id, ctx.ws);
      const bloque = bloqueDiseno(r.id, { titulo, ancho: n.ancho, alto: n.alto, miniatura: n.miniatura, estado: 'Nuevo', nota: n.nota });
      return { ok: true, resumen: `Creado. Ábrelo aquí: ${url}`, datos: { disenoId: r.id, link: url, bloque } };
    },
  },

  cambiar_textos_diseno_imagen: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = str(input, 'disenoId') ?? '';
      if (!uuidValido(id)) return { error: 'Falta el id del diseño.', faltan: ['disenoId'] };
      const cambios = cambiosDe(input);
      if (!cambios.length) return { error: 'Faltan los cambios (texto actual y nuevo).', faltan: ['cambios'] };
      // Lo que se puede saber sin escribir falla ACÁ: que el diseño exista y que los textos estén.
      const r = await leerDiseno(ctx.ws, id);
      if (!r.ok) return { error: r.error };
      const c = cambiarTextos(r.diseno.doc, cambios);
      if (!c.cambiados) return { error: `Ninguno de esos textos está en «${r.diseno.titulo}». Mira los textos con ver_diseno_imagen.` };
      const faltan = c.noEncontrados.length ? ` No están: ${c.noEncontrados.map((t) => `«${t.slice(0, 40)}»`).join(', ')}.` : '';
      return { payload: { disenoId: id, cambios }, resumen: `Cambiar ${c.cambiados} texto(s) en «${r.diseno.titulo}».${faltan}` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = str(payload, 'disenoId') ?? '';
      const r = await leerDiseno(ctx.ws, id);
      if (!r.ok) return { ok: false, resumen: r.error };
      const c = cambiarTextos(r.diseno.doc, cambiosDe(payload));
      if (!c.cambiados) return { ok: false, resumen: 'Esos textos ya no están en el diseño.' };
      const g = await guardarDiseno(ctx.ws, id, { version: r.diseno.version, doc: c.doc });
      if (!g.ok) return { ok: false, resumen: g.conflicto ? 'Alguien lo está editando en este momento: vuelve a intentar en un rato.' : `No se pudo guardar (${g.error}).` };
      // El G4: cada texto, como estaba y como quedó (sólo los que se cambiaron).
      const filas = cambiosDe(payload).filter((x) => !c.noEncontrados.includes(x.actual)).map((x) => ({ antes: x.actual, despues: x.nuevo }));
      const bloque = { t: 'antes_despues' as const, titulo: r.diseno.titulo, filas, abrir: { titulo: 'Abrir en Image Editor', href: `/image-editor/${id}` } };
      return { ok: true, resumen: `Listo: ${c.cambiados} texto(s) cambiados.`, datos: { disenoId: id, link: link(id, ctx.ws), bloque } };
    },
  },

  duplicar_diseno_imagen: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = str(input, 'disenoId') ?? '';
      if (!uuidValido(id)) return { error: 'Falta el id del diseño.', faltan: ['disenoId'] };
      const r = await leerDiseno(ctx.ws, id);
      if (!r.ok) return { error: r.error };
      return { payload: { disenoId: id }, resumen: `Hacer una copia de «${r.diseno.titulo}».` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const original = str(payload, 'disenoId') ?? '';
      const r = await duplicarDiseno(ctx.ws, QUIEN, original);
      if (!r.ok) return { ok: false, resumen: `No se pudo copiar (${r.error}).` };
      const url = link(r.id, ctx.ws);
      // La copia no tiene miniatura hasta que se abre: se ve la del original, que es igual.
      const o = await leerDiseno(ctx.ws, original).catch(() => null);
      const bloque = o?.ok
        ? bloqueDiseno(r.id, { titulo: `${o.diseno.titulo} (copia)`, ancho: o.diseno.ancho, alto: o.diseno.alto, miniatura: o.diseno.miniatura, estado: 'Copia' })
        : null;
      return { ok: true, resumen: `Copia hecha: ${url}`, datos: { disenoId: r.id, link: url, ...(bloque ? { bloque } : {}) } };
    },
  },

  borrar_diseno_imagen: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = str(input, 'disenoId') ?? '';
      if (!uuidValido(id)) return { error: 'Falta el id del diseño.', faltan: ['disenoId'] };
      const r = await leerDiseno(ctx.ws, id);
      if (!r.ok) return { error: r.error };
      return { payload: { disenoId: id }, resumen: `Eliminar el diseño «${r.diseno.titulo}» del Image Editor.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const r = await borrarDiseno(ctx.ws, str(payload, 'disenoId') ?? '');
      if (!r.ok) return { ok: false, resumen: `No se pudo eliminar (${r.error}).` };
      return { ok: true, resumen: 'Eliminado.', datos: { disenoId: str(payload, 'disenoId') } };
    },
  },

  // Las operaciones del chat «MaKo IA» (27/10/2026): proponen en el diseño y se aceptan en el editor.
  estilo_texto_imagen: { ...enElEditor('estilo_texto_imagen') },
  agregar_texto_imagen: { ...enElEditor('agregar_texto_imagen') },
  mover_elemento_imagen: { ...enElEditor('mover_elemento_imagen') },
  tamano_elemento_imagen: { ...enElEditor('tamano_elemento_imagen') },
  rotar_elemento_imagen: { ...enElEditor('rotar_elemento_imagen') },
  opacidad_elemento_imagen: { ...enElEditor('opacidad_elemento_imagen') },
  color_elemento_imagen: { ...enElEditor('color_elemento_imagen') },
  borde_elemento_imagen: { ...enElEditor('borde_elemento_imagen') },
  borrar_elementos_imagen: { ...enElEditor('borrar_elementos_imagen') },
  duplicar_elemento_imagen: { ...enElEditor('duplicar_elemento_imagen') },
  capa_elemento_imagen: { ...enElEditor('capa_elemento_imagen') },
  alinear_elementos_imagen: { ...enElEditor('alinear_elementos_imagen') },
  bloquear_elemento_imagen: { ...enElEditor('bloquear_elemento_imagen') },
  fondo_pagina_imagen: { ...enElEditor('fondo_pagina_imagen') },
  agregar_pagina_imagen: { ...enElEditor('agregar_pagina_imagen') },
  borrar_pagina_imagen: { ...enElEditor('borrar_pagina_imagen') },
  agregar_forma_imagen: { ...enElEditor('agregar_forma_imagen') },
  crear_imagen_ia: { ...enElEditor('crear_imagen_ia') },
  editar_imagen_ia: { ...enElEditor('editar_imagen_ia') },
  voltear_elemento_imagen: { ...enElEditor('voltear_elemento_imagen') },
  ocultar_elemento_imagen: { ...enElEditor('ocultar_elemento_imagen') },
};
