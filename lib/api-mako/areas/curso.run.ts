// =============================================================================
// api-mako / curso — los cuerpos (ver curso.def.ts para el porqué de cada operación)
// =============================================================================
// ⚠️ ACÁ SE LLAMA A lib/, NUNCA A LAS SERVER ACTIONS de app/customer-success/curso/: ésas abren con
// la sesión del navegador (`puedeEditar`: rol y capa) y por HTTP no hay sesión. La puerta de la API
// ya miró el token, la capa (`gating.tab`) y el permiso del área; lo que se repite acá es la tercera
// pregunta de esas actions, `productoPropio`: que el producto sea de ESTE workspace. Las clases se
// leen con `getTenantDb()` (la de otro inquilino «no existe»), así que su producto ya es propio.
//
// ⚠️ lib/curso.ts y lib/curso-admin.ts los está cambiando el chat de Customer Success (la tarea y el
// video por código embed, 08/10/2026): de acá se IMPORTAN, no se tocan.
//
// ⚠️ TODO SE VALIDA EN preparar(), ANTES de escribir (AGENTS.md: «todo lo que se pueda saber sin
// escribir falla en preparar()»). Y crear una clase son varias escrituras (crearla, llevarla al final,
// el título, el video, la descripción, los minutos): si una falla después de crearla, la clase se
// manda a la papelera, así un reintento no deja dos.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Preparado, Runners } from '../tipos';
import { getTenantDb } from '@/lib/workspace';
import { productosDeLaEntrega } from '@/app/customer-success/entrega';
import { productoPropio } from '@/app/customer-success/curso/puerta-curso';
import { modulosDelCurso, crearModulo, renombrarModulo, reordenarModulos } from '@/lib/curso-modulos-datos';
import { nombreDeModulo, type ModuloCurso } from '@/lib/curso-modulos';
import { clasesDelProducto, claseDeId } from '@/lib/curso-datos';
import {
  crearClase, moverClaseA, guardarCampoClase, guardarLeccion, borrarClase, restaurarClases, productoConModulos,
} from '@/lib/curso-admin';
import { videoDeLink, tieneTarea, tareasDeClase, erroresDeCampos, type Campo, type Clase, type TareaDeClase } from '@/lib/curso';
import { validarHtmlRico } from '@/lib/html-seguro';
import { porQueNoSeInserta } from '@/lib/embeds';
import { tareaParaGuardar } from '@/lib/curso-tarea-html';
import { borradorDe, videoParaGuardar } from '@/app/customer-success/curso/leccion-reglas';
import { TOPE_TITULO_CLASE } from './curso.def';
import { htmlDeTexto, modeloDeTareas, tareasParaApi, type TareaEntrada } from './curso.helpers';
import { randomBytes } from 'node:crypto';

type In = Record<string, unknown>;

const J = (o: unknown): string => JSON.stringify(o);
const fallo = (error: string) => ({ content: J({ ok: false, error }), isError: true });
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e));
const num = (input: In, k: string): number | null => {
  const n = Number(input[k]);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const str = (input: In, k: string): string | undefined => (typeof input[k] === 'string' ? (input[k] as string) : undefined);

/** preparar() no lanza: «no pude leer» se dice como lo que es. */
const revisando = (fn: (input: In, ctx: Ctx) => Promise<Preparado>) =>
  async (input: In, ctx: Ctx): Promise<Preparado> => {
    try { return await fn(input, ctx); } catch (e) { return { error: `No pude revisar el curso (${msg(e)}). Reintenta en un momento.` }; }
  };

/** ejecutar() no lanza (tipos.ts): si algo falla, ok:false con el motivo. */
const sinLanzar = (que: string, fn: (payload: In, ctx: Ctx) => Promise<Ejecutado>) =>
  async (payload: In, ctx: Ctx): Promise<Ejecutado> => {
    try { return await fn(payload, ctx); } catch (e) {
      console.error(`[api-mako curso] ${que}:`, msg(e));
      return { ok: false, resumen: `No se pudo ${que} (${msg(e)}).` };
    }
  };

/** El producto es de este workspace, y sus módulos (lectura ESTRICTA: decide). */
async function cursoDe(productoId: number | null): Promise<{ modulos: ModuloCurso[] } | { error: string }> {
  if (productoId == null) return { error: 'Falta el productoId.' };
  const no = await productoPropio(productoId);
  if (no) return { error: no === 'Ese producto no es tuyo.' ? `El producto #${productoId} no es de este negocio. Pide la lista con listar_cursos.` : no };
  const cur = await modulosDelCurso(productoId, { estricta: true });
  if (!cur) throw new Error('no pude leer los módulos');
  return { modulos: cur.modulos };
}

/** Una clase de este workspace, CON las de la papelera (para borrar y restaurar). */
async function claseEnPapelera(claseId: number): Promise<{ id: number; productoId: number; titulo: string } | null> {
  const db = await getTenantDb();
  // Busca justamente lo borrado: la regla de tests/curso-papelera.test.ts lo permite con `.not`.
  const { data, error } = await db.from('curso_clases').select('id, producto_id, titulo')
    .eq('id', claseId).not('borrada_at', 'is', null).maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as { id: number; producto_id: number; titulo: string } | null;
  return f ? { id: Number(f.id), productoId: Number(f.producto_id), titulo: f.titulo } : null;
}

const videoPublico = (c: Clase) => (c.videoTipo === 'ninguno' ? null : c.videoTipo === 'archivo' ? { tipo: 'archivo' } : { tipo: c.videoTipo, url: c.videoUrl });

const filaClase = (c: Clase) => ({
  id: c.id, titulo: c.titulo, orden: c.orden, video: videoPublico(c), minutos: c.minutos,
  tiene_descripcion: Boolean(c.descripcionHtml || c.descripcion), tiene_tarea: tieneTarea(c),
});

/**
 * Lo que se escribe de una clase, ya validado. `video: null` = sacar el video; ausente = no tocarlo.
 * `tareaHtml` + `camposTarea` van JUNTOS (son las tareas): ausentes, no se tocan.
 */
type CamposClase = { titulo?: string; video?: string | null; html?: string; minutos?: number | null; tareaHtml?: string; camposTarea?: Campo[] };

/** Un id nuevo para un campo o una tarea (`limpiarId` acepta letras, números, `_` y `-`). */
const nuevoId = (): string => `api_${randomBytes(5).toString('hex')}`;

/**
 * Valida lo que se va a escribir de una clase (crear o editar). Devuelve los campos limpios o el error.
 * `existentes`: las tareas que la clase YA tiene (al editar), para conservar los ids de sus campos.
 */
async function camposDe(input: In, exigirTitulo: boolean, existentes: readonly TareaDeClase[] = []): Promise<{ campos: CamposClase } | { error: string; faltan?: string[] }> {
  const campos: CamposClase = {};
  const titulo = str(input, 'titulo');
  if (titulo !== undefined || exigirTitulo) {
    const t = (titulo ?? '').replace(/\s+/g, ' ').trim();
    if (!t) return { error: 'Falta el título.' };
    if (t.length > TOPE_TITULO_CLASE) return { error: `El título pasa de ${TOPE_TITULO_CLASE} letras.` };
    campos.titulo = t;
  }
  const video = str(input, 'videoUrl');
  if (video !== undefined) {
    const v = video.trim();
    if (!v) campos.video = null;
    else {
      // Un link o el `<iframe>` que da la plataforma: `videoDeLink` saca la dirección de los dos y la
      // pasa por la lista blanca de lib/embeds.ts. Lo que se guarda es la dirección limpia.
      const rec = videoDeLink(v);
      if (!rec) return { error: `El video no va: ${porQueNoSeInserta(v)}` };
      campos.video = rec.url;
    }
  }
  const html = str(input, 'descripcionHtml');
  const texto = str(input, 'descripcion');
  if (html !== undefined && texto !== undefined) return { error: 'Pasa la descripción en `descripcionHtml` O en `descripcion`, no en las dos.' };
  if (html !== undefined || texto !== undefined) {
    const v = validarHtmlRico(html !== undefined ? html : htmlDeTexto(texto!));
    if (!v.ok) return { error: v.error };
    campos.html = v.html;
  }
  if (input.minutos !== undefined && input.minutos !== null) campos.minutos = Number(input.minutos);

  if (Array.isArray(input.tareas)) {
    const m = modeloDeTareas(input.tareas as TareaEntrada[], existentes, nuevoId);
    if ('error' in m) return { error: m.error };
    // La lista ENTERA, con sus `seccion` a propósito: se escribe (guardarLeccion), no se leen respuestas.
    const { tareaHtml, consignasHtml, campos: lista } = m;
    const t = tareaParaGuardar(tareaHtml);
    if (!t.ok) return { error: t.error };
    for (const consigna of consignasHtml) {
      const c = validarHtmlRico(consigna);
      if (!c.ok) return { error: c.error.replace('La descripción', 'La consigna de una tarea') };
    }
    // Lo incompleto se RECHAZA con su motivo (el mismo que pinta el editor), nunca se descarta.
    const malos = erroresDeCampos(lista);
    const ids = Object.keys(malos);
    if (ids.length) {
      const donde = (id: string) => {
        const i = lista.findIndex((x) => x.id === id);
        return i < 0 ? 'la tarea' : `«${lista[i].label || `campo ${i + 1}`}»`;
      };
      return { error: `Hay campos incompletos: ${ids.slice(0, 8).map((id) => `${donde(id)}: ${malos[id]}`).join('; ')}.` };
    }
    campos.tareaHtml = t.tareaHtml ?? '';
    campos.camposTarea = lista;
  }
  return { campos };
}

/**
 * Escribe la clase por `guardarLeccion` (lib/curso-admin.ts), el mismo camino del botón «Guardar» del
 * editor: de una vez, en UN `update`, con compare-and-set. La base (`antes`) se deriva con la misma
 * función que usa la pantalla (`borradorDe`); si otra persona cambió la clase en el medio, contesta
 * `conflicto` y se reintenta UNA vez sobre la clase releída. Los minutos solos (sin video nuevo) van por
 * `guardarCampoClase`: `guardarLeccion` los acepta sólo junto con un video.
 */
/** Lo que viajó en la pendiente, de vuelta a la forma de `escribirLeccion`. */
const delPayload = (p: In): CamposClase => ({
  ...(p.titulo !== undefined ? { titulo: p.titulo as string } : {}),
  ...(p.video !== undefined ? { video: p.video as string | null } : {}),
  ...(p.html !== undefined ? { html: p.html as string } : {}),
  ...(p.minutos !== undefined ? { minutos: p.minutos as number | null } : {}),
  ...(p.camposTarea !== undefined ? { tareaHtml: (p.tareaHtml as string) ?? '', camposTarea: p.camposTarea as Campo[] } : {}),
});

async function escribirLeccion(claseId: number, c: CamposClase): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let intento = 0; intento < 2; intento++) {
    const cl = await claseDeId(claseId);
    if (!cl) return { ok: false, error: 'La clase ya no existe.' };
    const base = borradorDe(cl, 'costado');
    const { campos: camposBase } = base;
    const cambios: Record<string, unknown> = {};
    const antes: Record<string, unknown> = {};
    if (c.titulo !== undefined) { cambios.titulo = c.titulo; antes.titulo = base.titulo; }
    if (c.video !== undefined) {
      cambios.video = c.video === null ? null : { tipo: 'url', url: c.video };
      antes.video = videoParaGuardar(base.video);
      if (c.minutos !== undefined) cambios.minutos = c.minutos;
    }
    if (c.html !== undefined) { cambios.descripcionHtml = c.html; antes.descripcionHtml = base.descripcionHtml; }
    if (c.camposTarea !== undefined) {
      // Las tareas van juntas: la consigna principal y la lista entera (con sus secciones).
      Object.assign(cambios, { tareaHtml: c.tareaHtml ?? '', campos: c.camposTarea });
      Object.assign(antes, { tareaHtml: base.tareaHtml, campos: camposBase });
    }
    if (Object.keys(cambios).length) {
      const r = await guardarLeccion(claseId, cambios, antes);
      if (!r.ok) {
        if (r.conflicto && intento === 0) continue;
        const detalle = r.errores ? ` ${Object.entries(r.errores).slice(0, 8).map(([k, v]) => `${k}: ${v}`).join('; ')}.` : '';
        return { ok: false, error: `${r.error}${detalle}` };
      }
    }
    if (c.minutos !== undefined && c.video === undefined) {
      const m = await guardarCampoClase(claseId, { minutos: c.minutos });
      if (!m.ok) return { ok: false, error: `los minutos: ${m.error}` };
    }
    return { ok: true };
  }
  return { ok: false, error: 'La clase cambió mientras se guardaba. Vuelve a leerla y reintenta.' };
}

export const RUNNERS: Runners = {
  // ── Lecturas ────────────────────────────────────────────────────────────────
  listar_cursos: {
    leer: async () => {
      const productos = await productosDeLaEntrega();
      const cursos = await Promise.all(productos.map(async (p) => {
        try {
          const [cur, clases] = await Promise.all([modulosDelCurso(p.id, { estricta: true }), clasesDelProducto(p.id)]);
          if (!cur) return { productoId: p.id, nombre: p.nombre, error: 'No pude leer sus módulos.' };
          return { productoId: p.id, nombre: p.nombre, modulos: cur.modulos.length, clases: clases.length };
        } catch (e) {
          return { productoId: p.id, nombre: p.nombre, error: `No pude leer su curso (${msg(e)}).` };
        }
      }));
      return J({ cursos, nota: 'Un curso con error NO está vacío: no se pudo leer. Para sus módulos y clases, ver_curso.' });
    },
  },

  ver_curso: {
    leer: async (input) => {
      const productoId = num(input, 'productoId');
      const c = await cursoDe(productoId);
      if ('error' in c) return fallo(c.error);
      const clases = await clasesDelProducto(productoId!);
      const claves = new Set(c.modulos.map((m) => m.clave));
      const porModulo = new Map<string, Clase[]>();
      for (const cl of clases) porModulo.set(cl.etapa, [...(porModulo.get(cl.etapa) ?? []), cl]);
      const enOrden = (xs: Clase[]) => [...xs].sort((a, b) => a.orden - b.orden || a.id - b.id).map(filaClase);
      return J({
        productoId,
        modulos: c.modulos.map((m) => ({
          clave: m.clave, nombre: m.nombre, n: m.n, vinculado: m.vinculado,
          etapa_kanban: m.etapa ? m.etapa.label : null,
          clases: enOrden(porModulo.get(m.clave) ?? []),
        })),
        sin_modulo: enOrden(clases.filter((cl) => !claves.has(cl.etapa))),
        nota: 'vinculado: true = el módulo es también una etapa del kanban de clientes. video.tipo "url" con una página que no es YouTube, Vimeo, Loom ni Drive no se reproduce todavía.',
      });
    },
  },

  ver_clase_curso: {
    leer: async (input) => {
      const id = num(input, 'claseId');
      if (id == null) return fallo('Falta el claseId.');
      const cl = await claseDeId(id);
      if (!cl) return fallo(`La clase #${id} no existe en este negocio (o está en la papelera).`);
      const cur = await modulosDelCurso(cl.productoId, { estricta: true });
      const modulo = cur?.modulos.find((m) => m.clave === cl.etapa) ?? null;
      return J({
        id: cl.id, productoId: cl.productoId,
        modulo: modulo ? { clave: modulo.clave, nombre: modulo.nombre } : { clave: cl.etapa, nombre: null, nota: cur ? 'sin módulo: el suyo ya no existe' : 'no pude leer los módulos' },
        titulo: cl.titulo, orden: cl.orden, video: videoPublico(cl), minutos: cl.minutos,
        descripcion_html: cl.descripcionHtml ?? '', descripcion: cl.descripcion,
        tareas: tareasParaApi(tareasDeClase(cl)), cierra_la_etapa: cl.obligatoria,
      });
    },
  },

  // ── Módulos ─────────────────────────────────────────────────────────────────
  crear_modulo_curso: {
    preparar: revisando(async (input) => {
      const productoId = num(input, 'productoId');
      const c = await cursoDe(productoId);
      if ('error' in c) return c;
      const n = nombreDeModulo(input.nombre);
      if (!n.ok) return { error: n.error };
      const claves = c.modulos.map((m) => m.clave);
      const pedido = str(input, 'despuesDe');
      if (pedido !== undefined && !claves.includes(pedido)) {
        return { error: `El módulo «${pedido}» no existe en este curso.`, disponibles: c.modulos.map((m) => ({ clave: m.clave, nombre: m.nombre })) };
      }
      // Sin `despuesDe`, AL FINAL (la lib entiende `null` como «al principio»).
      const despuesDe = pedido ?? claves[claves.length - 1] ?? null;
      const vinculado = input.vinculado === true;
      const donde = despuesDe ? `después de «${c.modulos.find((m) => m.clave === despuesDe)?.nombre ?? despuesDe}»` : 'como primer módulo';
      return {
        payload: { productoId, nombre: n.nombre, despuesDe, vinculado },
        resumen: `Crear el módulo «${n.nombre}» ${donde}${vinculado ? ', también como etapa del kanban de clientes' : ''}.`,
      };
    }),
    ejecutar: sinLanzar('crear el módulo', async (p) => {
      const r = await crearModulo(Number(p.productoId), { nombre: p.nombre, vinculado: p.vinculado === true, despuesDe: p.despuesDe ?? null });
      if (!r.ok) return { ok: false, resumen: `No se pudo crear el módulo: ${r.error}` };
      return { ok: true, resumen: `Listo: módulo «${String(p.nombre)}» creado (clave ${r.clave}).`, datos: { clave: r.clave, modulos: r.modulos.map((m) => ({ clave: m.clave, nombre: m.nombre, vinculado: m.vinculado })) } };
    }),
  },

  renombrar_modulo_curso: {
    preparar: revisando(async (input) => {
      const productoId = num(input, 'productoId');
      const c = await cursoDe(productoId);
      if ('error' in c) return c;
      const clave = str(input, 'clave') ?? '';
      const m = c.modulos.find((x) => x.clave === clave);
      if (!m) return { error: `El módulo «${clave}» no existe en este curso.`, disponibles: c.modulos.map((x) => ({ clave: x.clave, nombre: x.nombre })) };
      const n = nombreDeModulo(input.nombre);
      if (!n.ok) return { error: n.error };
      if (n.nombre === m.nombre) return { error: `El módulo ya se llama «${m.nombre}».`, yaEstaba: true };
      return {
        payload: { productoId, clave, nombre: n.nombre },
        resumen: `Renombrar el módulo «${m.nombre}» a «${n.nombre}»${m.vinculado ? ' (también su etapa del kanban)' : ''}.`,
      };
    }),
    ejecutar: sinLanzar('renombrar el módulo', async (p) => {
      const r = await renombrarModulo(Number(p.productoId), String(p.clave), p.nombre);
      if (!r.ok) return { ok: false, resumen: `No se pudo renombrar: ${r.error}` };
      return { ok: true, resumen: `Listo: el módulo se llama «${r.nombre}».`, datos: { clave: p.clave, nombre: r.nombre } };
    }),
  },

  ordenar_modulos_curso: {
    preparar: revisando(async (input) => {
      const productoId = num(input, 'productoId');
      const c = await cursoDe(productoId);
      if ('error' in c) return c;
      const claves = Array.isArray(input.claves) ? (input.claves as unknown[]).map(String) : [];
      const actuales = c.modulos.map((m) => m.clave);
      const faltan = actuales.filter((k) => !claves.includes(k));
      const sobran = claves.filter((k) => !actuales.includes(k));
      if (faltan.length || sobran.length || new Set(claves).size !== claves.length) {
        return {
          error: `Pasa TODAS las claves de los módulos, una vez cada una.${faltan.length ? ` Faltan: ${faltan.join(', ')}.` : ''}${sobran.length ? ` No existen: ${sobran.join(', ')}.` : ''}`,
          disponibles: c.modulos.map((m) => ({ clave: m.clave, nombre: m.nombre })),
        };
      }
      if (claves.every((k, i) => k === actuales[i])) return { error: 'Los módulos ya están en ese orden.', yaEstaba: true };
      const nombre = new Map(c.modulos.map((m) => [m.clave, m.nombre]));
      return { payload: { productoId, claves }, resumen: `Ordenar los módulos: ${claves.map((k) => `«${nombre.get(k)}»`).join(', ')}.` };
    }),
    ejecutar: sinLanzar('ordenar los módulos', async (p) => {
      const r = await reordenarModulos(Number(p.productoId), p.claves);
      if (!r.ok) return { ok: false, resumen: `No se pudo ordenar: ${r.error}` };
      return { ok: true, resumen: 'Listo: módulos ordenados.', datos: { orden: r.modulos.map((m) => ({ clave: m.clave, nombre: m.nombre })) } };
    }),
  },

  // ── Clases ──────────────────────────────────────────────────────────────────
  crear_clase_curso: {
    preparar: revisando(async (input) => {
      const productoId = num(input, 'productoId');
      if (productoId == null) return { error: 'Falta el productoId.' };
      const prod = await productoConModulos(productoId);
      if (!prod) return { error: `El producto #${productoId} no es de este negocio. Pide la lista con listar_cursos.` };
      const moduloClave = str(input, 'moduloClave') ?? '';
      if (!prod.claves.includes(moduloClave)) {
        return { error: `El módulo «${moduloClave}» no existe en este curso.`, disponibles: prod.modulos.map((m) => ({ clave: m.clave, nombre: m.nombre })) };
      }
      const v = await camposDe(input, true);
      if ('error' in v) return v;
      const modulo = prod.modulos.find((m) => m.clave === moduloClave)!;
      return {
        payload: { productoId, moduloClave, ...v.campos },
        resumen: `Crear la clase «${v.campos.titulo}» al final del módulo «${modulo.nombre}»${v.campos.video ? ', con video' : ''}${v.campos.html ? ', con descripción' : ''}${v.campos.camposTarea !== undefined ? ', con su tarea' : ''}.`,
      };
    }),
    ejecutar: sinLanzar('crear la clase', async (p) => {
      const productoId = Number(p.productoId);
      const moduloClave = String(p.moduloClave);
      const r = await crearClase(productoId, moduloClave);
      if (!r.ok) return { ok: false, resumen: `No se pudo crear la clase: ${r.error}` };
      const id = r.clase.id;
      // La tab la crea AL PRINCIPIO (la abre para editarla); por la API van en orden: al final.
      const fin = await moverClaseA(id, moduloClave, null);
      const campos = fin.ok
        ? await escribirLeccion(id, delPayload(p))
        : { ok: false as const, error: `llevarla al final: ${fin.error}` };
      if (!campos.ok) {
        // A medias no sirve: a la papelera, así el reintento no deja dos «Nueva clase».
        const b = await borrarClase(id);
        return { ok: false, resumen: `No se pudo crear la clase (${campos.error}).${b.ok ? ' No quedó nada creado.' : ` Quedó una «Nueva clase» (#${id}) que hay que borrar a mano.`}` };
      }
      return {
        ok: true, resumen: `Listo: clase «${String(p.titulo)}» creada (#${id}).`,
        datos: { claseId: id, moduloClave, orden: fin.ok ? fin.ids : undefined },
      };
    }),
  },

  editar_clase_curso: {
    preparar: revisando(async (input) => {
      const id = num(input, 'claseId');
      if (id == null) return { error: 'Falta el claseId.' };
      const cl = await claseDeId(id);
      if (!cl) return { error: `La clase #${id} no existe en este negocio (o está en la papelera).` };
      const v = await camposDe(input, false, tareasDeClase(cl));
      if ('error' in v) return v;
      const que = [
        v.campos.titulo !== undefined && 'el título', v.campos.video !== undefined && (v.campos.video === null ? 'sacar el video' : 'el video'),
        v.campos.html !== undefined && 'la descripción', v.campos.minutos !== undefined && 'los minutos',
        v.campos.camposTarea !== undefined && 'las tareas',
      ].filter(Boolean) as string[];
      if (!que.length) return { error: 'No pasaste nada para cambiar: titulo, videoUrl, descripcionHtml, descripcion, minutos o tareas.', faltan: ['titulo'] };
      return { payload: { claseId: id, ...v.campos }, resumen: `Cambiar ${que.join(', ')} de la clase «${cl.titulo}».` };
    }),
    ejecutar: sinLanzar('editar la clase', async (p) => {
      const id = Number(p.claseId);
      const r = await escribirLeccion(id, delPayload(p));
      if (!r.ok) return { ok: false, resumen: `No se pudo guardar (${r.error}).` };
      return { ok: true, resumen: `Listo: clase #${id} actualizada.`, datos: { claseId: id } };
    }),
  },

  mover_clase_curso: {
    preparar: revisando(async (input) => {
      const id = num(input, 'claseId');
      if (id == null) return { error: 'Falta el claseId.' };
      const cl = await claseDeId(id);
      if (!cl) return { error: `La clase #${id} no existe en este negocio (o está en la papelera).` };
      const prod = await productoConModulos(cl.productoId);
      if (!prod) return { error: 'No encontré el curso de esa clase.' };
      const moduloClave = str(input, 'moduloClave') ?? '';
      const modulo = prod.modulos.find((m) => m.clave === moduloClave);
      if (!modulo) return { error: `El módulo «${moduloClave}» no existe en este curso.`, disponibles: prod.modulos.map((m) => ({ clave: m.clave, nombre: m.nombre })) };
      const antesDe = num(input, 'antesDe');
      if (antesDe === id) return { error: 'La clase no puede ir antes de sí misma.' };
      return {
        payload: { claseId: id, moduloClave, antesDe },
        resumen: `Mover la clase «${cl.titulo}» al módulo «${modulo.nombre}»${antesDe ? `, antes de la clase #${antesDe}` : ', al final'}.`,
      };
    }),
    ejecutar: sinLanzar('mover la clase', async (p) => {
      const r = await moverClaseA(Number(p.claseId), String(p.moduloClave), p.antesDe == null ? null : Number(p.antesDe));
      if (!r.ok) return { ok: false, resumen: `No se pudo mover: ${r.error}` };
      return { ok: true, resumen: 'Listo: clase movida.', datos: { claseId: r.clase.id, moduloClave: r.clase.etapa, orden: r.ids } };
    }),
  },

  borrar_clase_curso: {
    preparar: revisando(async (input) => {
      const id = num(input, 'claseId');
      if (id == null) return { error: 'Falta el claseId.' };
      const cl = await claseDeId(id);
      if (!cl) {
        if (await claseEnPapelera(id)) return { error: `La clase #${id} ya está en la papelera.`, yaEstaba: true };
        return { error: `La clase #${id} no existe en este negocio.` };
      }
      return { payload: { claseId: id }, resumen: `Mandar a la papelera la clase «${cl.titulo}» (se recupera durante 7 días).` };
    }),
    ejecutar: sinLanzar('borrar la clase', async (p) => {
      const r = await borrarClase(Number(p.claseId));
      if (!r.ok) return { ok: false, resumen: `No se pudo borrar: ${r.error}` };
      return { ok: true, resumen: `Listo: clase #${r.id} en la papelera. restaurar_clase_curso la devuelve.`, datos: { claseId: r.id } };
    }),
  },

  restaurar_clase_curso: {
    preparar: revisando(async (input) => {
      const id = num(input, 'claseId');
      if (id == null) return { error: 'Falta el claseId.' };
      const borrada = await claseEnPapelera(id);
      if (!borrada) {
        if (await claseDeId(id)) return { error: `La clase #${id} no está en la papelera.`, yaEstaba: true };
        return { error: `La clase #${id} no existe en este negocio (o ya se purgó).` };
      }
      return { payload: { claseId: id, productoId: borrada.productoId }, resumen: `Devolver la clase «${borrada.titulo}» de la papelera.` };
    }),
    ejecutar: sinLanzar('restaurar la clase', async (p) => {
      const r = await restaurarClases(Number(p.productoId), [Number(p.claseId)]);
      if (!r.ok) return { ok: false, resumen: `No se pudo restaurar: ${r.error}` };
      if (!r.clases.length) return { ok: false, resumen: 'La clase ya no estaba en la papelera.' };
      return { ok: true, resumen: `Listo: clase «${r.clases[0].titulo}» devuelta.`, datos: { claseId: r.clases[0].id, moduloClave: r.clases[0].etapa } };
    }),
  },
};
