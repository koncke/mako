// =============================================================================
// api-mako/areas/landing-editor.run — los cuerpos de las operaciones del editor de la tanda 7
// =============================================================================
// Un runner por id de landing-editor.def.ts; se suman a RUNNERS de landing.run.ts (misma área). Pedido de
// Martín (15/10/2026), textual: «Ambos, tienen que pasarle absolutamente todos los botones. Todas las
// funciones a la API de MaKo.»
//
// Corren por el MISMO server que la pantalla: lib/editor-landing/server.ts (abrir, guardar, guardarVersion,
// temas, vistaPrevia, comentarios, borrar, importarBorrador y, nuevas para la API, generarConIA/editarConIA),
// dominios.ts, diagnostico-server.ts y diagnostico-aplicar.ts. Ningún `.from(` acá: lo frena
// tests/api-mako-landing-contenido.test.ts. Lo que decide sin la base (qué se cambia y el resumen) vive en
// landing-contenido.helpers.ts, puro y con test.
//
// ⚠️ TODA EDICIÓN pasa por `edicion()`: preparar() abre la landing de AHORA y corre el plan (si el saneo le
// tiraría algo, falla ahí, sin consumir la pendiente); ejecutar() copia las imágenes de afuera a la biblioteca,
// vuelve a abrir y a planear (entre proponer y confirmar la persona pudo editar), guarda la versión «Antes de un
// cambio de MaKo» y recién ahí guarda con compare-and-set (si alguien guardó en el medio, relee una vez).
// ⚠️ Nada de esto corre en una automatización (un flujo corre una vez por lead): lo frena preparar().
// =============================================================================

import 'server-only';
import type { Runners, Ctx, Preparado, Ejecutado, SalidaLectura, AccionRun } from '../tipos';
import { linkPantalla } from '../link';
import { PREFIJO_FLUJO } from '../canal';
import * as docsEditor from '@/lib/editor-landing/server';
import type { LandingCompleta, TemaPropio } from '@/lib/editor-landing/api-tipos';
import { conectarDominio, estadoDominio, quitarDominio } from '@/lib/editor-landing/dominios';
import { normalizarDominio, motivoDominioInvalido } from '@/lib/editor-landing/dominios-reglas';
import { analizar as diagnosticar, listar as comentariosDelDiagnostico } from '@/lib/editor-landing/diagnostico-server';
import { aplicarComentarios, pasarACopia } from '@/lib/editor-landing/diagnostico-aplicar';
import { gruposParaAplicar, objetivoDe } from '@/lib/editor-landing/diagnostico';
import { srcImagen } from '@/lib/editor-landing/especificacion';
import { BUCKET_LANDING } from '@/lib/editor-landing/server-reglas';
import { tarjetasDe, tituloDeTarjeta } from '@/lib/editor-landing/doc';
import { buscarStock, copiarUrlABucket, type Orientacion } from '@/lib/imagenes-stock';
import { borradorPorId } from './landing.helpers';
// Puro: el `config` con que nace un documento de la IA, EL MISMO de «Crear con IA» de la pantalla.
import { configDeCreacion } from '@/app/web-generator/crear/tipo';
import { siFallaNuestra, urlDeLanding } from './landing-editor.helpers';
import {
  MOTIVO_ANTES_DE_MAKO, esFallaPlan, ubicarSeccion, ubicarPagina, seccionesDisponibles,
  estructuraParaApi, configuracionParaApi, temasParaApi, temaElegido, versionParaApi, dominioParaApi,
  registrosParaApi, registrosEnTexto, cobroParaApi, comentariosEquipoParaApi,
  planAgregarSeccion, planCambiarTexto, planAcomodarSeccion, planConfigurarSeccion, planAgregarBloque,
  planAcomodarBloque, planPonerEnlace, planConfigurarFormulario, planConfigurarBoton, planQuitarCobro,
  planAcomodarPagina, planTema, planConfigurarLanding, planConfigurarSitio, planNavegacion, planTemaPropio,
  pedidoGenerar, resumenGenerar, pedidoEnBlanco,
  type FallaPlan, type PlanContenido, type PlanConfig,
} from './landing-contenido.helpers';

// ── utilidades (las mismas formas que landing.run.ts) ───────────────────────

type Entrada = Record<string, unknown>;
const str = (input: Entrada, k: string): string | null => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const num = (input: Entrada, k: string): number | null => {
  const v = input[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const json = (o: unknown): string => JSON.stringify(o);
const errorLectura = (msg: string): SalidaLectura => ({ content: msg, isError: true });
const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const linkEditor = (id: number, ws: number): string => linkPantalla(`/web-generator/${id}`, ws);
const noExisteCreada = (id: number): string => `No existe la landing ${id} en este negocio (búscala con listar_landings_creadas).`;
const enFlujo = (ctx: Ctx): boolean => ctx.canalKey.startsWith(PREFIJO_FLUJO);
/** «Aplicar todos»: no se empieza una vuelta nueva después de esto (las de una sección tardan hasta ~200 s; quien confirma corta a 300 s). */
const PLAZO_EMPEZAR_VUELTA_MS = 90_000;
const NO_EN_FLUJO = 'Esto no corre en una automatización: un flujo corre una vez por cada lead. Pídeselo a MaKo en el chat o hazlo en el Web Generator.';
const EN_PAPELERA = (titulo: string): string => `«${titulo}» está en la papelera: se saca con mandar_landing_a_papelera (papelera:false) antes de cambiarla.`;
/** Lo que un error de la base dice afuera, al confirmar (el detalle va a la consola). */
const resumenDeError = (que: string, e: unknown): string => {
  const m = mensaje(e);
  return m.startsWith('api-mako:') ? `No se pudo ${que}: falló algo de nuestro lado. Vuelve a intentarlo.` : `No se pudo ${que} (${m}).`;
};
const aPreparado = (f: FallaPlan): Preparado => ({
  error: f.error,
  ...(f.faltan ? { faltan: f.faltan } : {}),
  ...(f.disponibles !== undefined ? { disponibles: f.disponibles } : {}),
  ...(f.yaEstaba ? { yaEstaba: true } : {}),
});

/** La landing de AHORA, o el motivo para no tocarla (no existe, está en la papelera). Un 5xx de la base tira (`siFallaNuestra`). */
async function abrirParaEditar(id: number, ctx: Ctx): Promise<{ doc: LandingCompleta } | { error: string }> {
  const a = await docsEditor.abrir(id);
  if (!a.ok) { siFallaNuestra(a); return { error: a.status === 404 ? noExisteCreada(id) : `No pude abrir la landing ${id} (${a.error}).` }; }
  const f = await docsEditor.leerFilaDoc(ctx.ws, id, 'id, titulo, papelera_at');
  if (!f) return { error: noExisteCreada(id) };
  if (f.papelera_at) return { error: EN_PAPELERA(f.titulo) };
  return { doc: a.doc };
}

/** Los temas propios del negocio (estrictos: si la lectura falla, tira; «no hay temas» no es «no pude leer»). */
async function temasPropios(): Promise<TemaPropio[]> {
  const r = await docsEditor.temas();
  if (!r.ok) { siFallaNuestra(r); return []; }
  return r.temas;
}

// ── Las imágenes de afuera (se copian a la biblioteca de la landing AL CONFIRMAR) ─────────

/** Los parámetros con un enlace de imagen que NO está en la biblioteca (hay que copiarlo). */
function imagenesDeAfuera(input: Entrada, nombres: readonly string[]): string[] {
  return nombres.filter((k) => typeof input[k] === 'string' && input[k] !== '' && !srcImagen(input[k]));
}
const enlaceDeImagenValido = (v: unknown): boolean => typeof v === 'string' && /^https?:\/\/[^\s]+$/i.test(v.trim()) && v.length <= 2000;

/** Copia cada imagen de afuera al bucket (la MISMA copia que «Desde un enlace» del editor, con su baranda SSRF). */
async function copiarImagenes(input: Entrada, nombres: readonly string[], ws: number): Promise<Entrada | { error: string }> {
  const out: Entrada = { ...input };
  for (const k of imagenesDeAfuera(input, nombres)) {
    const r = await copiarUrlABucket(String(input[k]).trim(), BUCKET_LANDING, ws);
    if (!r.ok) return { error: `No pude copiar la imagen de ${String(input[k]).slice(0, 80)} (${r.error}).` };
    out[k] = r.url;
  }
  return out;
}

// ── La fábrica de las ediciones ──────────────────────────────────────────────

type Extra = { pendientes: readonly string[]; propios: readonly TemaPropio[] };
type Edicion = {
  /** «cambiar la landing», para los mensajes. */
  que: string;
  planear: (input: Entrada, doc: LandingCompleta, extra: Extra) => PlanContenido | PlanConfig | FallaPlan;
  /** Los parámetros que traen el enlace de una imagen (se copia a la biblioteca al confirmar). */
  imagenes?: readonly string[];
  /** Necesita los temas propios del negocio (cambiar el tema). */
  conTemas?: boolean;
};

/**
 * Una edición de UNA landing: el plan en preparar() (sin escribir nada) y, al confirmar, la versión de antes y
 * el guardado con la versión que se abrió. Lo que vuelve en `datos`: el id, la versión nueva, `version_antes`
 * (lo que restaura restaurar_version_landing) y lo propio de cada plan (el id de la sección nueva…).
 */
function edicion(op: Edicion): AccionRun {
  const nombres = op.imagenes ?? [];
  return {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la landing.', faltan: ['id'] };
      for (const k of imagenesDeAfuera(input, nombres)) {
        if (!enlaceDeImagenValido(input[k])) return { error: `«${k}» tiene que ser el enlace (https) de una imagen, o "" para quitarla.` };
      }
      const a = await abrirParaEditar(id, ctx);
      if ('error' in a) return { error: a.error };
      const plan = op.planear(input, a.doc, { pendientes: imagenesDeAfuera(input, nombres), propios: op.conTemas ? await temasPropios() : [] });
      if (esFallaPlan(plan)) return aPreparado(plan);
      return { payload: input, resumen: `«${a.doc.titulo}»: ${plan.resumen}` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = Number(payload.id);
      try {
        const entrada = await copiarImagenes(payload, nombres, ctx.ws);
        if ('error' in entrada) return { ok: false, resumen: String(entrada.error) };
        const propios = op.conTemas ? await temasPropios() : [];
        for (let intento = 0; intento < 2; intento++) {
          const a = await abrirParaEditar(id, ctx);
          if ('error' in a) return { ok: false, resumen: a.error };
          const plan = op.planear(entrada, a.doc, { pendientes: [], propios });
          if (esFallaPlan(plan)) return { ok: false, resumen: plan.error };
          // La versión de antes ANTES de tocar nada: sin ella no hay vuelta atrás, y no se cambia.
          const v = await docsEditor.guardarVersion(id, MOTIVO_ANTES_DE_MAKO);
          if (!v.ok) return { ok: false, resumen: 'No pude guardar la versión de antes: no se cambió nada. Vuelve a intentarlo.' };
          const g = await docsEditor.guardar({
            accion: 'guardar', id, version: a.doc.version,
            ...('contenido' in plan && plan.contenido ? { contenido: plan.contenido } : {}),
            ...('config' in plan ? { config: plan.config } : {}),
          });
          if (g.ok) {
            const link = linkEditor(id, ctx.ws);
            return {
              ok: true,
              resumen: `Listo: quedó guardado en «${a.doc.titulo}», sin publicar. La versión de antes es la ${v.version.id} (restaurar_version_landing la vuelve). Se revisa en el editor: ${link}`,
              datos: { id, version: g.version, version_antes: v.version.id, ...(plan.datos ?? {}), link },
            };
          }
          if (!g.conflicto) return { ok: false, resumen: `No se pudo ${op.que} (${g.error}).` };
        }
        return { ok: false, resumen: `No se pudo ${op.que}: se están guardando cambios en la landing en este momento. Vuelve a intentarlo.` };
      } catch (e) {
        return { ok: false, resumen: resumenDeError(op.que, e) };
      }
    },
  };
}

// ── Los runners ───────────────────────────────────────────────────────────────

export const RUNNERS_EDITOR: Runners = {
  // ── Lecturas ──
  ver_secciones_landing: {
    leer: async (input) => {
      const id = num(input, 'id') ?? 0;
      const r = await docsEditor.abrir(id);
      if (!r.ok) { siFallaNuestra(r); return errorLectura(r.status === 404 ? noExisteCreada(id) : `No pude leer la landing ${id} (${r.error}).`); }
      const pagina = str(input, 'pagina');
      if (pagina && ubicarPagina(r.doc.contenido, pagina) == null) return errorLectura(`No hay una página «${pagina}» en esa landing.`);
      return json(estructuraParaApi(id, r.doc.contenido, pagina));
    },
  },

  ver_configuracion_landing: {
    leer: async (input) => {
      const id = num(input, 'id') ?? 0;
      const r = await docsEditor.abrir(id);
      if (!r.ok) { siFallaNuestra(r); return errorLectura(r.status === 404 ? noExisteCreada(id) : `No pude leer la landing ${id} (${r.error}).`); }
      return json(configuracionParaApi(id, r.doc.config, await temasPropios()));
    },
  },

  listar_temas_landing: {
    leer: async () => json(temasParaApi(await temasPropios())),
  },

  ver_version_landing: {
    leer: async (input) => {
      const id = num(input, 'id') ?? 0;
      const version = num(input, 'version') ?? 0;
      const r = await docsEditor.verVersion(id, version);
      if (!r.ok) { siFallaNuestra(r); return errorLectura(r.status === 404 ? `La landing ${id} no tiene la versión ${version} (búscala con listar_versiones_landing).` : `No pude leer la versión (${r.error}).`); }
      return json(versionParaApi(id, r.version));
    },
  },

  revisar_direccion_landing: {
    leer: async (input) => {
      const id = num(input, 'id') ?? 0;
      const r = await docsEditor.slugDisponible(id, str(input, 'slug') ?? '');
      if (!r.ok) { siFallaNuestra(r); return errorLectura(r.status === 404 ? noExisteCreada(id) : `No pude revisar la dirección (${r.error}).`); }
      return json({
        id, slug: r.slug, disponible: r.disponible, motivo: r.motivo, sugerencia: r.sugerencia,
        ...(r.disponible ? { direccion: urlDeLanding(r.slug) } : {}),
        nota: 'La dirección se usa en `slug` de publicar_landing. Libre ahora no la reserva: la toma quien publique primero.',
      });
    },
  },

  ver_dominio_landing: {
    leer: async (input, ctx) => {
      const id = num(input, 'id') ?? 0;
      // Sólo la FILA: estadoDominio sale a Vercel y al DNS y puede ESCRIBIR (verifica un pendiente).
      let f;
      try {
        f = await docsEditor.leerFilaDoc(ctx.ws, id, 'id, dominio, dominio_estado, dominio_verificado_at, dominio_reclamado_at');
      } catch (e) {
        return errorLectura(`No pude leer el dominio de la landing ${id} (${mensaje(e)}).`);
      }
      if (!f) return errorLectura(noExisteCreada(id));
      return json(dominioParaApi(id, f as unknown as Parameters<typeof dominioParaApi>[1], Date.now()));
    },
  },

  ver_cobro_landing: {
    leer: async (input) => {
      const id = num(input, 'id') ?? 0;
      const r = await docsEditor.abrir(id);
      if (!r.ok) { siFallaNuestra(r); return errorLectura(r.status === 404 ? noExisteCreada(id) : `No pude leer la landing ${id} (${r.error}).`); }
      const c = await docsEditor.cobro();
      if (!c.ok) { siFallaNuestra(c); return errorLectura(`No pude leer las pasarelas y el catálogo (${c.error}).`); }
      return json(cobroParaApi(id, r.doc.contenido, c.cobro));
    },
  },

  listar_comentarios_equipo_landing: {
    leer: async (input) => {
      const id = num(input, 'id') ?? 0;
      const r = await docsEditor.abrir(id);
      if (!r.ok) { siFallaNuestra(r); return errorLectura(r.status === 404 ? noExisteCreada(id) : `No pude leer la landing ${id} (${r.error}).`); }
      const cs = await docsEditor.comentarios(id);
      if (!cs.ok) { siFallaNuestra(cs); return errorLectura(`No pude leer los comentarios (${cs.error}).`); }
      return json(comentariosEquipoParaApi(id, cs.comentarios, r.doc.contenido));
    },
  },

  buscar_fotos_landing: {
    leer: async (input) => {
      const q = (str(input, 'busqueda') ?? '').slice(0, 120);
      const orientacion = (['horizontal', 'vertical', 'cuadrada'].includes(String(input.orientacion)) ? input.orientacion : 'horizontal') as Orientacion;
      const r = await buscarStock(q, num(input, 'pagina') ?? 1, orientacion);
      if (!r.ok) return errorLectura(`El buscador de fotos no contestó (${r.error}).`);
      return json({
        busqueda: q,
        pagina: r.pagina,
        hay_mas: r.hayMas,
        fotos: r.fotos.slice(0, 20).map((f) => ({ imagen: f.grande, miniatura: f.mini, autor: f.autor, licencia: f.licencia })),
        nota: 'Pasa `imagen` en agregar_bloque_landing o configurar_seccion_landing: MaKo la copia a la biblioteca de la landing al confirmar. Nunca como foto del equipo, de un cliente o de un testimonio.',
      });
    },
  },

  // ── Crear en blanco: EL MISMO pedido que «Usar este tema» del Panel (`pedidoEnBlanco`) ──
  crear_landing_en_blanco: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: 'Crear una landing no corre en una automatización: un flujo corre una vez por cada lead y crearía una por cada uno.' };
      const p = pedidoEnBlanco(input, await temasPropios());
      if (esFallaPlan(p)) return aPreparado(p);
      const que = p.pedido.config.formato === 'presentacion' ? 'una presentación' : 'una landing';
      return { payload: input, resumen: `Crear ${que} en blanco${p.pedido.titulo ? ` («${p.pedido.titulo}»)` : ''} con el tema «${p.nombreTema}», como borrador sin publicar.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      try {
        const p = pedidoEnBlanco(payload, await temasPropios());
        if (esFallaPlan(p)) return { ok: false, resumen: p.error };
        const r = await docsEditor.crear(p.pedido);
        if (!r.ok) return { ok: false, resumen: `No se pudo crear (${r.error}).` };
        const link = linkEditor(r.doc.id, ctx.ws);
        return { ok: true, resumen: `Listo: «${r.doc.titulo}» (id ${r.doc.id}) quedó en blanco, sin publicar. Se arma en el editor: ${link}`, datos: { id: r.doc.id, titulo: r.doc.titulo, link } };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('crear la landing', e) };
      }
    },
  },

  // ── Crear y editar con IA ──
  generar_landing_con_ia: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: 'Crear una landing con IA no corre en una automatización: un flujo corre una vez por cada lead y crearía una por cada uno. Pídesela a MaKo en el chat o créala en el Web Generator.' };
      const propios = await temasPropios();
      const p = pedidoGenerar(input, (t) => temaElegido(t, propios));
      if (esFallaPlan(p)) return aPreparado(p);
      const t = temaElegido(p.tema, propios);
      return { payload: input, resumen: resumenGenerar(p, 'error' in t ? null : t.nombre) };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      try {
        const propios = await temasPropios();
        const p = pedidoGenerar(payload, (t) => temaElegido(t, propios));
        if (esFallaPlan(p)) return { ok: false, resumen: p.error };
        const config = configDeCreacion(p.tipo, p.tema, {
          modo: 'ia',
          pedido: (p.idea ?? p.texto ?? '').slice(0, 2_000),
          objetivo: p.params.objetivo,
          basadoEnUrl: null,
        });
        const r = await docsEditor.generarConIA({ modo: p.modo, idea: p.idea, texto: p.texto, params: p.params, config, titulo: p.titulo });
        if (!r.ok) return { ok: false, resumen: `No se pudo crear la ${p.tipo === 'presentacion' ? 'presentación' : 'landing'} (${r.error}).` };
        const link = linkEditor(r.doc.id, ctx.ws);
        const que = p.tipo === 'presentacion' ? 'diapositivas' : 'secciones';
        return {
          ok: true,
          resumen: `Listo: «${r.doc.titulo}» quedó creada (id ${r.doc.id}, ${r.secciones} ${que}), sin publicar.${r.sinDiseno ? ` ${r.sinDiseno} ${que} quedaron con el texto del esquema, sin diseño: se rehacen con editar_landing_con_ia o en el editor.` : ''} Se revisa en el editor: ${link}`,
          datos: { id: r.doc.id, titulo: r.doc.titulo, secciones: r.secciones, sin_diseno: r.sinDiseno, link },
        };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('crear la landing', e) };
      }
    },
  },

  editar_landing_con_ia: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: 'Editar una landing con IA no corre en una automatización: la persona tiene que ver el cambio. Pídeselo a MaKo en el chat o hazlo en el editor.' };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la landing.', faltan: ['id'] };
      const instruccion = str(input, 'instruccion');
      if (!instruccion) return { error: 'Falta qué cambiar.', faltan: ['instruccion'] };
      const a = await abrirParaEditar(id, ctx);
      if ('error' in a) return { error: a.error };
      const seccion = str(input, 'seccion');
      const pagina = str(input, 'pagina');
      let donde: string;
      if (seccion) {
        const u = ubicarSeccion(a.doc.contenido, seccion);
        if (!u) return { error: `No hay una sección «${seccion}» en esta landing (búscala con ver_secciones_landing).`, disponibles: seccionesDisponibles(a.doc.contenido) };
        if ((u.tarjeta.attrs as { bloqueadaIA?: unknown } | undefined)?.bloqueadaIA === true) return { error: 'Esa sección está bloqueada para la IA (se desbloquea en el editor).' };
        donde = `la sección «${tituloDeTarjeta(u.tarjeta) || seccion}»`;
      } else {
        const k = ubicarPagina(a.doc.contenido, pagina);
        if (k == null) return { error: `No hay una página «${pagina}» en esta landing.` };
        donde = `la página «${a.doc.contenido.paginas[k].titulo}»`;
      }
      return {
        payload: { id, instruccion, ...(seccion ? { seccion } : {}), ...(pagina && !seccion ? { pagina } : {}) },
        resumen: `Editar con IA ${donde} de «${a.doc.titulo}»: «${instruccion.length > 200 ? `${instruccion.slice(0, 200).trimEnd()}…` : instruccion}». Antes guarda una versión «Antes de un cambio de IA» y no publica. Usa IA y tarda hasta unos minutos.`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = Number(payload.id);
      try {
        const a = await abrirParaEditar(id, ctx);
        if ('error' in a) return { ok: false, resumen: a.error };
        const r = await docsEditor.editarConIA({
          docId: id, instruccion: String(payload.instruccion ?? ''),
          seccionId: typeof payload.seccion === 'string' ? payload.seccion : null,
          paginaId: typeof payload.pagina === 'string' ? payload.pagina : null,
        });
        if (!r.ok) return { ok: false, resumen: 'sinCambios' in r && r.sinCambios ? `No cambió nada: ${r.error}` : `No se pudo editar con IA (${r.error}).` };
        const link = linkEditor(id, ctx.ws);
        return {
          ok: true,
          resumen: `Listo: ${r.resumen ? `${r.resumen} ` : ''}(${r.cambiadas} cambiada(s), ${r.nuevas} nueva(s)), sin publicar. La versión de antes es la ${r.versionAntes} (restaurar_version_landing la vuelve). Se revisa en el editor: ${link}`,
          datos: { id, version: r.doc.version, version_antes: r.versionAntes, cambiadas: r.cambiadas, nuevas: r.nuevas, link },
        };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('editar con IA', e) };
      }
    },
  },

  // ── Editar el contenido ──
  agregar_seccion_landing: { ...edicion({ que: 'agregar la sección', planear: (i, d) => planAgregarSeccion(d.contenido, i) }) },
  cambiar_texto_landing: { ...edicion({ que: 'cambiar el texto', planear: (i, d) => planCambiarTexto(d.contenido, i) }) },
  acomodar_seccion_landing: { ...edicion({ que: 'acomodar la sección', planear: (i, d) => planAcomodarSeccion(d.contenido, i) }) },
  configurar_seccion_landing: { ...edicion({
    que: 'cambiar el estilo de la sección', imagenes: ['imagen'],
    planear: (i, d, x) => planConfigurarSeccion(d.contenido, i, { imagenPendiente: x.pendientes.includes('imagen') }),
  }) },
  agregar_bloque_landing: { ...edicion({
    que: 'agregar el bloque', imagenes: ['imagen'],
    planear: (i, d, x) => planAgregarBloque(d.contenido, i, { imagenPendiente: x.pendientes.includes('imagen') }),
  }) },
  acomodar_bloque_landing: { ...edicion({ que: 'acomodar el bloque', planear: (i, d) => planAcomodarBloque(d.contenido, i) }) },
  poner_enlace_landing: { ...edicion({ que: 'poner el enlace', planear: (i, d) => planPonerEnlace(d.contenido, i) }) },
  configurar_formulario_landing: { ...edicion({ que: 'cambiar el formulario', planear: (i, d) => planConfigurarFormulario(d.contenido, i) }) },
  configurar_boton_landing: { ...edicion({ que: 'cambiar el botón', planear: (i, d) => planConfigurarBoton(d.contenido, i) }) },
  quitar_cobro_landing: { ...edicion({ que: 'quitar el cobro', planear: (i, d) => planQuitarCobro(d.contenido, i) }) },
  acomodar_pagina_landing: { ...edicion({ que: 'acomodar la página', planear: (i, d) => planAcomodarPagina(d.contenido, i) }) },

  // ── El tema y la configuración ──
  cambiar_tema_landing: { ...edicion({ que: 'cambiar el tema', conTemas: true, planear: (i, d, x) => planTema(d.config, String(i.tema ?? ''), x.propios) }) },
  configurar_landing: { ...edicion({
    que: 'cambiar la configuración', imagenes: ['fondoImagen'],
    planear: (i, d, x) => planConfigurarLanding(d, i, { imagenPendiente: x.pendientes.includes('fondoImagen') }),
  }) },
  configurar_sitio_landing: { ...edicion({
    que: 'cambiar los ajustes del sitio', imagenes: ['favicon', 'imagenCompartir'],
    planear: (i, d, x) => planConfigurarSitio(d.config, i, { pendientes: x.pendientes.filter((k): k is 'favicon' | 'imagenCompartir' => k === 'favicon' || k === 'imagenCompartir') }),
  }) },
  configurar_navegacion_landing: { ...edicion({
    que: 'cambiar la navegación', imagenes: ['logo'],
    planear: (i, d, x) => planNavegacion(d.config, i, { logoPendiente: x.pendientes.includes('logo') }),
  }) },

  guardar_tema_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const plan = planTemaPropio(await temasPropios(), input);
      if (esFallaPlan(plan)) return aPreparado(plan);
      return { payload: input, resumen: plan.resumen };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      try {
        const plan = planTemaPropio(await temasPropios(), payload);
        if (esFallaPlan(plan)) return { ok: false, resumen: plan.error };
        const r = await docsEditor.guardarTema(plan.tema);
        if (!r.ok) return { ok: false, resumen: `No se pudo guardar el tema (${r.error}).` };
        const id = `ws:${r.tema.id}`;
        return { ok: true, resumen: `Listo: el tema «${r.tema.nombre}» (${id}) quedó guardado.${plan.nuevo ? ' Se le pone a una landing con cambiar_tema_landing.' : ''}`, datos: { tema: id, nombre: r.tema.nombre } };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('guardar el tema', e) };
      }
    },
  },

  borrar_tema_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const pedido = (str(input, 'tema') ?? '').replace(/^ws:/, '');
      if (!pedido) return { error: 'Falta el tema.', faltan: ['tema'] };
      const propios = await temasPropios();
      const t = propios.find((p) => p.id === pedido);
      if (!t) return { error: `No hay un tema propio «ws:${pedido}» (búscalo con listar_temas_landing).`, disponibles: propios.map((p) => `ws:${p.id}`) };
      const l = await docsEditor.listar();
      if (!l.ok) { siFallaNuestra(l); return { error: `No pude revisar qué landings lo usan (${l.error}).` }; }
      const usan = l.docs.filter((d) => d.tema === `ws:${t.id}`).length;
      return {
        payload: { tema: `ws:${t.id}` },
        resumen: `Borrar el tema propio «${t.nombre}».${usan ? ` ${usan === 1 ? 'Una landing lo usa y pasa' : `${usan} landings lo usan y pasan`} a verse con el tema de fábrica (las publicadas, al volver a publicarlas).` : ' Ninguna landing lo usa.'} No se puede deshacer.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      try {
        const r = await docsEditor.borrarTema(String(payload.tema ?? ''));
        return r.ok ? { ok: true, resumen: 'Listo: el tema propio se borró.', datos: { tema: String(payload.tema ?? '') } } : { ok: false, resumen: `No se pudo borrar el tema (${r.error}).` };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('borrar el tema', e) };
      }
    },
  },

  // ── El dominio propio ──
  conectar_dominio_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la landing.', faltan: ['id'] };
      const d = normalizarDominio(str(input, 'dominio') ?? '');
      const motivo = motivoDominioInvalido(d);
      if (motivo || !d) return { error: motivo ?? 'Ese no es un dominio válido.', faltan: ['dominio'] };
      const f = await docsEditor.leerFilaDoc(ctx.ws, id, 'id, titulo, papelera_at, publicado_at, slug');
      if (!f) return { error: noExisteCreada(id) };
      if (f.papelera_at) return { error: EN_PAPELERA(f.titulo) };
      let actual: string | null = null;
      try { actual = ((await docsEditor.leerFilaDoc(ctx.ws, id, 'id, dominio')) as unknown as { dominio?: string | null } | null)?.dominio ?? null; } catch { actual = null; }
      if (actual && actual !== d) return { error: `«${f.titulo}» ya tiene el dominio ${actual}: se quita primero (quitar_dominio_landing).` };
      const publicada = !!(f.publicado_at && f.slug);
      return {
        payload: { id, dominio: d },
        resumen: `${actual === d ? 'Volver a conectar' : 'Conectar'} el dominio ${d} a «${f.titulo}»: queda pendiente hasta que cargues los registros DNS que te devuelve MaKo; si es la raíz, también www.${d} lleva a ella.${publicada ? '' : ' La landing no está publicada: se ve en el dominio cuando se publique.'}`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = Number(payload.id);
      try {
        const r = await conectarDominio(id, payload.dominio);
        if (!r.ok) return { ok: false, resumen: `No se pudo conectar el dominio (${r.error}).` };
        if (!r.dominio) return { ok: false, resumen: 'No se pudo conectar el dominio.' };
        const reg = registrosEnTexto(r.dominio);
        return {
          ok: true,
          resumen: `Listo: ${r.dominio.dominio} quedó ${r.dominio.estado === 'verificado' ? 'verificado' : 'pendiente'}.${reg ? ` ${reg}` : ''}${r.dominio.falta ? ` ${r.dominio.falta}` : ''} Después, verificar_dominio_landing. Se ve en el editor: ${linkEditor(id, ctx.ws)}`,
          datos: { id, ...registrosParaApi(r.dominio) },
        };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('conectar el dominio', e) };
      }
    },
  },

  verificar_dominio_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la landing.', faltan: ['id'] };
      const f = await docsEditor.leerFilaDoc(ctx.ws, id, 'id, titulo');
      if (!f) return { error: noExisteCreada(id) };
      let dominio: string | null = null;
      try { dominio = ((await docsEditor.leerFilaDoc(ctx.ws, id, 'id, dominio')) as unknown as { dominio?: string | null } | null)?.dominio ?? null; } catch { dominio = null; }
      if (!dominio) return { error: `«${f.titulo}» no tiene dominio propio: se conecta con conectar_dominio_landing.` };
      return { payload: { id }, resumen: `Mirar el DNS de ${dominio} ahora: si los registros ya están, queda verificado y «${f.titulo}» se empieza a ver ahí.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      try {
        const r = await estadoDominio(id, { verificar: true });
        if (!r.ok) return { ok: false, resumen: `No se pudo verificar el dominio (${r.error}).` };
        if (!r.dominio) return { ok: false, resumen: 'La landing ya no tiene dominio propio.' };
        const reg = registrosEnTexto(r.dominio);
        return {
          ok: true,
          resumen: r.dominio.estado === 'verificado'
            ? `${r.dominio.dominio} está verificado: la landing publicada se ve ahí.${r.dominio.falta ? ` ${r.dominio.falta}` : ''}`
            : `${r.dominio.dominio} sigue pendiente.${reg ? ` ${reg}` : ''}${r.dominio.falta ? ` ${r.dominio.falta}` : ''} Los cambios de DNS pueden tardar unas horas.`,
          datos: { id, ...registrosParaApi(r.dominio) },
        };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('verificar el dominio', e) };
      }
    },
  },

  quitar_dominio_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la landing.', faltan: ['id'] };
      const f = await docsEditor.leerFilaDoc(ctx.ws, id, 'id, titulo');
      if (!f) return { error: noExisteCreada(id) };
      let dominio: string | null = null;
      try { dominio = ((await docsEditor.leerFilaDoc(ctx.ws, id, 'id, dominio')) as unknown as { dominio?: string | null } | null)?.dominio ?? null; } catch (e) {
        return { error: `No pude leer el dominio (${mensaje(e)}).` };
      }
      if (!dominio) return { error: `«${f.titulo}» no tiene dominio propio.`, yaEstaba: true };
      return { payload: { id }, resumen: `Quitar el dominio ${dominio} de «${f.titulo}»: deja de verse ahí (los links que apunten a ${dominio} quedan rotos) y se suelta de Vercel, con su www si lo sumó MaKo. Sigue en su dirección de MaKo.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      try {
        const r = await quitarDominio(id);
        return r.ok ? { ok: true, resumen: 'Listo: la landing ya no tiene dominio propio. Se vuelve a conectar con conectar_dominio_landing.', datos: { id } } : { ok: false, resumen: `No se pudo quitar el dominio (${r.error}).` };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('quitar el dominio', e) };
      }
    },
  },

  // ── Compartir, comentarios del equipo e historial ──
  compartir_borrador_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la landing.', faltan: ['id'] };
      const f = await docsEditor.leerFilaDoc(ctx.ws, id, 'id, titulo, vista_token');
      if (!f) return { error: noExisteCreada(id) };
      const regenerar = input.regenerar === true;
      return {
        payload: { id, ...(regenerar ? { regenerar: true } : {}) },
        resumen: regenerar && f.vista_token
          ? `Cambiar el link privado al borrador de «${f.titulo}»: el que se mandó antes deja de andar.`
          : `${f.vista_token ? 'Dar' : 'Crear'} el link privado al borrador de «${f.titulo}»: quien lo tenga ve lo guardado, sin publicar.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      try {
        const r = await docsEditor.vistaPrevia(id, payload.regenerar === true);
        return r.ok
          ? { ok: true, resumen: `El link privado al borrador: ${r.url}`, datos: { id, url: r.url } }
          : { ok: false, resumen: r.status === 404 ? noExisteCreada(id) : `No se pudo armar el link (${r.error}).` };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('armar el link', e) };
      }
    },
  },

  resolver_comentario_equipo_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = num(input, 'id');
      const cid = num(input, 'comentario');
      if (!id || !cid) return { error: 'Falta el id de la landing o el del comentario.', faltan: [!id ? 'id' : '', !cid ? 'comentario' : ''].filter(Boolean) };
      const resuelto = input.resuelto !== false;
      const cs = await docsEditor.comentarios(id);
      if (!cs.ok) { siFallaNuestra(cs); return { error: cs.status === 404 ? noExisteCreada(id) : `No pude leer los comentarios (${cs.error}).` }; }
      const c = cs.comentarios.find((x) => x.id === cid);
      if (!c) return { error: `No hay un comentario ${cid} en esa landing (búscalo con listar_comentarios_equipo_landing).` };
      if (c.resuelto === resuelto) return { error: `Ese comentario ya está ${resuelto ? 'resuelto' : 'abierto'}.`, yaEstaba: true };
      const texto = c.texto.length > 120 ? `${c.texto.slice(0, 120).trimEnd()}…` : c.texto;
      return { payload: { id, comentario: cid, resuelto }, resumen: `${resuelto ? 'Cerrar' : 'Reabrir'} el comentario de ${c.autor || 'alguien del equipo'}: «${texto}».` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      try {
        const r = await docsEditor.resolverComentario(payload.id, payload.comentario, payload.resuelto !== false);
        return r.ok ? { ok: true, resumen: r.resuelto ? 'Listo: el comentario quedó resuelto.' : 'Listo: el comentario quedó abierto.', datos: { comentario: Number(payload.comentario), resuelto: r.resuelto } } : { ok: false, resumen: `No se pudo cambiar el comentario (${r.error}).` };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('cambiar el comentario', e) };
      }
    },
  },

  guardar_version_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la landing.', faltan: ['id'] };
      const f = await docsEditor.leerFilaDoc(ctx.ws, id, 'id, titulo');
      if (!f) return { error: noExisteCreada(id) };
      const motivo = str(input, 'motivo');
      return { payload: { id, ...(motivo ? { motivo } : {}) }, resumen: `Guardar en el historial de «${f.titulo}» una versión de cómo está ahora${motivo ? ` («${motivo.slice(0, 120)}»)` : ''}. No cambia la landing.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      try {
        const r = await docsEditor.guardarVersion(id, payload.motivo);
        return r.ok ? { ok: true, resumen: `Listo: versión ${r.version.id} guardada («${r.version.motivo}»).`, datos: { id, version: r.version.id } } : { ok: false, resumen: r.status === 404 ? noExisteCreada(id) : `No se pudo guardar la versión (${r.error}).` };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('guardar la versión', e) };
      }
    },
  },

  // ── Papelera y el generador anterior ──
  borrar_landing_creada: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la landing.', faltan: ['id'] };
      const f = await docsEditor.leerFilaDoc(ctx.ws, id, 'id, titulo, papelera_at');
      if (!f) return { error: noExisteCreada(id) };
      if (!f.papelera_at) return { error: `«${f.titulo}» no está en la papelera: primero va ahí (mandar_landing_a_papelera).` };
      return { payload: { id }, resumen: `Borrar PARA SIEMPRE «${f.titulo}», con su historial y sus comentarios. Si tenía dominio propio, se suelta. No se puede deshacer.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      try {
        const r = await docsEditor.borrar(id);
        return r.ok ? { ok: true, resumen: `Listo: la landing ${id} se borró para siempre.`, datos: { id } } : { ok: false, resumen: r.status === 404 ? noExisteCreada(id) : `No se pudo borrar (${r.error}).` };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('borrar la landing', e) };
      }
    },
  },

  importar_borrador_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: 'Importar no corre en una automatización: un flujo corre una vez por cada lead y crearía una landing por cada uno.' };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la versión guardada.', faltan: ['id'] };
      const d = await borradorPorId(id);
      if (!d) return { error: `No existe la versión guardada ${id} (búscala con listar_borradores_landing).` };
      const nombre = (d.titulo ?? '').trim() || 'Sin título';
      return { payload: { id }, resumen: `Pasar la versión guardada «${nombre}» del generador anterior al editor del Web Generator, como una landing nueva sin publicar. La versión vieja queda como estaba.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      try {
        const r = await docsEditor.importarBorrador(Number(payload.id));
        if (!r.ok) return { ok: false, resumen: `No se pudo importar (${r.error}).` };
        const link = linkEditor(r.doc.id, ctx.ws);
        return { ok: true, resumen: `Listo: «${r.doc.titulo}» (id ${r.doc.id}) quedó en el editor, sin publicar. Se adapta ahí: ${link}`, datos: { id: r.doc.id, titulo: r.doc.titulo, link } };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('importar', e) };
      }
    },
  },

  // ── El Diagnóstico de una landing nuestra ──
  diagnosticar_landing_creada: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: 'Diagnosticar no corre en una automatización: gasta IA y un flujo corre una vez por cada lead.' };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la landing.', faltan: ['id'] };
      const a = await abrirParaEditar(id, ctx);
      if ('error' in a) return { error: a.error };
      return { payload: { id }, resumen: `Diagnosticar con IA «${a.doc.titulo}»: MaKo lee todas sus páginas${a.doc.publicadoAt ? ' y lo que midió el Pixel' : ''} y deja un puntaje y comentarios por sección (los que ya están no se repiten). Usa IA y tarda hasta unos minutos.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = Number(payload.id);
      try {
        const r = await diagnosticar({ docId: id });
        if (!r.ok) return { ok: false, resumen: `No se pudo diagnosticar (${r.error}).` };
        const pendientes = r.sugerencias.filter((s) => s.estado === 'pendiente').length;
        return {
          ok: true,
          resumen: `Listo: ${r.resumen?.score != null ? `puntaje ${r.resumen.score} de 10, ` : ''}${r.nuevas ?? 0} comentario(s) nuevo(s), ${pendientes} pendiente(s) en total. Se leen con listar_comentarios_landing. Se ve en el editor: ${linkEditor(id, ctx.ws)}`,
          datos: { id, puntaje: r.resumen?.score ?? null, veredicto: r.resumen?.veredicto ?? null, nuevos: r.nuevas ?? 0, pendientes },
        };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('diagnosticar', e) };
      }
    },
  },

  aplicar_todos_comentarios_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: 'Aplicar el diagnóstico no corre en una automatización: reescribe una landing con IA y la persona tiene que verlo.' };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la landing.', faltan: ['id'] };
      const a = await abrirParaEditar(id, ctx);
      if ('error' in a) return { error: a.error };
      const l = await comentariosDelDiagnostico({ docId: id });
      if (!l.ok) { siFallaNuestra(l); return { error: `No pude leer los comentarios (${l.error}).` }; }
      const orden = a.doc.contenido.paginas.flatMap((p) => tarjetasDe(p).map((t) => String(t.attrs?.id ?? '')));
      const { grupos, sinUbicar } = gruposParaAplicar(l.sugerencias, orden);
      if (!grupos.length) return { error: 'No hay comentarios pendientes que se puedan aplicar solos.', yaEstaba: true };
      const n = grupos.reduce((s, g) => s + g.ids.length, 0);
      return {
        payload: { id },
        resumen: `Aplicar con IA ${n} comentario(s) del diagnóstico a «${a.doc.titulo}», en ${grupos.length} vuelta(s) de una sección, con UNA versión «Antes de aplicar el diagnóstico» para deshacerlos juntos.${sinUbicar.length ? ` ${sinUbicar.length} no se ubicaron en una sección y quedan pendientes.` : ''} No publica. Usa IA y tarda hasta unos minutos: si no entran todos, quedan pendientes y se vuelve a proponer.`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = Number(payload.id);
      const t0 = Date.now();
      try {
        const a = await abrirParaEditar(id, ctx);
        if ('error' in a) return { ok: false, resumen: a.error };
        const l = await comentariosDelDiagnostico({ docId: id });
        if (!l.ok) return { ok: false, resumen: `No pude leer los comentarios (${l.error}).` };
        const orden = a.doc.contenido.paginas.flatMap((p) => tarjetasDe(p).map((t) => String(t.attrs?.id ?? '')));
        const { grupos } = gruposParaAplicar(l.sugerencias, orden);
        let aplicados = 0;
        let versionAntes: number | null = null;
        let version: number | null = null;
        let fallo: string | null = null;
        let vueltas = 0;
        for (const g of grupos) {
          // Una vuelta nueva sólo si queda tiempo para ella (la IA de una sección puede tardar hasta ~200 s).
          if (vueltas && Date.now() - t0 > PLAZO_EMPEZAR_VUELTA_MS) break;
          const r = await aplicarComentarios({ docId: id, ids: g.ids, versionAntes: versionAntes == null, ...(version != null ? { version } : {}) });
          vueltas++;
          if (!r.ok) { fallo = r.error; break; }
          if (versionAntes == null) versionAntes = r.versionAntes?.id ?? null;
          version = r.doc.version;
          aplicados += r.aplicadas.filter((s) => s.estado === 'resuelta').length;
        }
        const quedan = grupos.reduce((s, g) => s + g.ids.length, 0) - aplicados;
        if (!aplicados) return { ok: false, resumen: `No se pudo aplicar ningún comentario${fallo ? ` (${fallo})` : ''}.` };
        const link = linkEditor(id, ctx.ws);
        return {
          ok: true,
          resumen: `Listo: ${aplicados} comentario(s) aplicado(s) y resuelto(s), sin publicar.${quedan ? ` Quedan ${quedan} pendiente(s): se vuelve a proponer.` : ''}${fallo ? ` Se cortó: ${fallo}` : ''} La versión de antes es la ${versionAntes ?? '?'} (restaurar_version_landing la vuelve). Se revisa en el editor: ${link}`,
          datos: { id, aplicados, quedan, version, version_antes: versionAntes, link },
        };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('aplicar los comentarios', e) };
      }
    },
  },

  pasar_comentarios_a_copia_landing: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = num(input, 'id');
      if (!id) return { error: 'Falta el id de la copia.', faltan: ['id'] };
      const crudo = str(input, 'url');
      if (!crudo) return { error: 'Falta la página de afuera.', faltan: ['url'] };
      const obj = objetivoDe({ url: crudo });
      if (!obj || !('url' in obj)) return { error: 'Esa no es una dirección válida.' };
      const url = obj.url;
      const a = await abrirParaEditar(id, ctx);
      if ('error' in a) return { error: a.error };
      const l = await comentariosDelDiagnostico({ url });
      if (!l.ok) { siFallaNuestra(l); return { error: `No pude leer los comentarios de esa página (${l.error}).` }; }
      if (!l.sugerencias.length) return { error: `${url} no tiene comentarios de diagnóstico (se diagnostica con analizar_landing).` };
      const pendientes = l.sugerencias.filter((s) => s.estado === 'pendiente').length;
      const resolver = input.resolver === true;
      return {
        payload: { id, url: crudo, ...(resolver ? { resolver: true } : {}) },
        resumen: `Pasar los ${l.sugerencias.length} comentario(s) del diagnóstico de ${url} a «${a.doc.titulo}», ubicados en sus secciones (los que ya están no se repiten).${resolver && pendientes ? ` Los ${pendientes} pendientes de afuera quedan resueltos: el trabajo sigue en la copia.` : ''}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = Number(payload.id);
      try {
        const r = await pasarACopia({ url: payload.url, docId: id, ...(payload.resolver === true ? { resolver: 'todos' } : {}) });
        if (!r.ok) return { ok: false, resumen: `No se pudieron pasar los comentarios (${r.error}).` };
        return {
          ok: true,
          resumen: `Listo: ${r.pasadas} comentario(s) nuevo(s) en la copia${r.resueltas.length ? `, ${r.resueltas.length} resuelto(s) afuera` : ''}. Se aplican con aplicar_comentario_landing (listar_comentarios_landing con el id de la copia).`,
          datos: { id, pasados: r.pasadas, resueltos_afuera: r.resueltas.length },
        };
      } catch (e) {
        return { ok: false, resumen: resumenDeError('pasar los comentarios', e) };
      }
    },
  },
};

