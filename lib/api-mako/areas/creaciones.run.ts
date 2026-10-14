// =============================================================================
// api-mako/areas/creaciones.run — los cuerpos del área `creaciones` (la galería y sus estrellas)
// =============================================================================
// Un runner por id de creaciones.def.ts. Todo corre adentro de runWithWorkspace(ctx.ws) y lo hace lib/creaciones.ts
// (el ÚNICO que escribe `creaciones`, `creacion_estrellas` y `creacion_usos`), con el ws EXPLÍCITO.
//
// ⚠️ preparar() valida todo lo que se puede saber sin escribir (existe, no es tuya, ya tenía tu estrella, el tipo se
// puede publicar, la automatización existe): confirmar RECLAMA antes de ejecutar, y un error en ejecutar() consume la
// pendiente. Y ejecutar() no lanza nunca: `seguro()`.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Runners, SalidaLectura } from '../tipos';
import {
  CreacionError, FaltaTablaCreacionesError, darEstrella, listarCreaciones, misCreaciones, opcionesParaPublicar,
  porQueNoSePublica, publicarCreacion, quitarEstrella, retirarCreacion, usarCreacion, verCreacion, type Creacion,
} from '@/lib/creaciones';
import {
  INFO_TIPO, esOrdenCreaciones, esTipoCreacion, porQueNoEstrella, sanearPublicacion,
} from '@/lib/creaciones-reglas';
import { linkApp } from '@/lib/app-url';

const json = (o: unknown): string => JSON.stringify(o);
const fallo = (msg: string) => ({ content: msg, isError: true });
const autorDe = (ctx: Ctx): string => ctx.actor?.trim() || 'MaKo';
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** El error de lib/creaciones que se le puede decir a quien pidió; el resto, genérico. */
function motivo(e: unknown): string {
  if (e instanceof CreacionError || e instanceof FaltaTablaCreacionesError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

async function seguro(que: string, fn: () => Promise<Ejecutado>): Promise<Ejecutado> {
  try {
    return await fn();
  } catch (e) {
    const msg = motivo(e);
    console.error(`[api-mako creaciones] ${que}:`, msg);
    return { ok: false, resumen: `No se pudo ${que} (${msg}).` };
  }
}

/** Lo que una lectura muestra de una creación: lo de la pantalla, nada del negocio que la publicó. */
const vistaDe = (c: Creacion) => ({
  creacionId: c.id, tipo: c.tipo, tipo_texto: c.tipoTitulo, titulo: c.titulo, descripcion: c.descripcion, autor: c.autor,
  de_mako: c.deMako, estado: c.estado, estrellas: c.estrellas, usos: c.usos, tu_estrella: c.conEstrella, es_tuya: c.mia,
  se_puede_usar: c.sePuedeUsar, publicada: c.publicada, actualizada: c.actualizada,
});

/** La creación por id, o el error que lo dice (para un preparar). */
async function creacionDe(ws: number, id: unknown): Promise<Awaited<ReturnType<typeof verCreacion>> | { error: string }> {
  const x = n(id);
  if (!x) return { error: 'Falta el id de la creación (de listar_creaciones).' };
  try {
    return await verCreacion(ws, x);
  } catch (e) {
    return { error: motivo(e) };
  }
}

export const RUNNERS: Runners = {
  listar_creaciones: {
    leer: async (input, ctx): Promise<SalidaLectura> => {
      try {
        const r = await listarCreaciones(ctx.ws, {
          tipo: esTipoCreacion(input.tipo) ? input.tipo : null,
          orden: esOrdenCreaciones(input.orden) ? input.orden : null,
          q: typeof input.q === 'string' ? input.q : null,
          pagina: n(input.pagina),
        });
        return json({
          creaciones: r.creaciones.map(vistaDe),
          hay_mas: r.hayMas,
          nota: r.creaciones.length
            ? 'creacionId es el id que piden ver_creacion, dar_estrella, quitar_estrella y usar_creacion.'
            : 'No hay creaciones publicadas con ese filtro.',
        });
      } catch (e) {
        return fallo(motivo(e));
      }
    },
  },
  ver_creacion: {
    leer: async (input, ctx): Promise<SalidaLectura> => {
      const c = await creacionDe(ctx.ws, input.creacionId);
      if ('error' in c) return fallo(c.error);
      return json({ ...vistaDe(c), trae: c.resumen });
    },
  },
  mis_creaciones: {
    leer: async (_input, ctx): Promise<SalidaLectura> => {
      try {
        const cs = await misCreaciones(ctx.ws);
        return json({ creaciones: cs.map(vistaDe), nota: cs.length ? undefined : 'Este negocio todavía no publicó nada.' });
      } catch (e) {
        return fallo(motivo(e));
      }
    },
  },

  dar_estrella: {
    preparar: async (input, ctx) => {
      const c = await creacionDe(ctx.ws, input.creacionId);
      if ('error' in c) return { error: c.error };
      const no = porQueNoEstrella({ workspaceOrigen: c.mia ? ctx.ws : -1, estado: c.estado }, ctx.ws);
      if (no) return { error: no };
      if (c.conEstrella) return { error: `«${c.titulo}» ya tiene tu estrella.`, yaEstaba: true };
      return { payload: { creacionId: c.id }, resumen: `Darle tu estrella a «${c.titulo}» (${c.tipoTitulo} de ${c.autor}).` };
    },
    ejecutar: (payload, ctx) => seguro('dar la estrella', async () => {
      const r = await darEstrella(ctx.ws, Number(payload.creacionId), autorDe(ctx));
      return { ok: true, resumen: r.yaEstaba ? `«${r.titulo}» ya tenía tu estrella.` : `Listo: le diste tu estrella a «${r.titulo}» (${r.estrellas}).`, datos: { creacionId: Number(payload.creacionId), estrellas: r.estrellas } };
    }),
  },
  quitar_estrella: {
    preparar: async (input, ctx) => {
      const c = await creacionDe(ctx.ws, input.creacionId);
      if ('error' in c) return { error: c.error };
      if (!c.conEstrella) return { error: `«${c.titulo}» no tiene tu estrella.`, yaEstaba: true };
      return { payload: { creacionId: c.id }, resumen: `Quitarle tu estrella a «${c.titulo}».` };
    },
    ejecutar: (payload, ctx) => seguro('quitar la estrella', async () => {
      const r = await quitarEstrella(ctx.ws, Number(payload.creacionId));
      return { ok: true, resumen: r.yaEstaba ? `«${r.titulo}» no tenía tu estrella.` : `Listo: le quitaste tu estrella a «${r.titulo}».`, datos: { creacionId: Number(payload.creacionId), estrellas: r.estrellas } };
    }),
  },

  publicar_creacion: {
    preparar: async (input) => {
      if (!esTipoCreacion(input.tipo)) return { error: 'Falta qué se publica (tipo).' };
      const tipo = input.tipo;
      const no = porQueNoSePublica(tipo);
      if (no) return { error: no };
      const origenId = n(input.origenId);
      if (!origenId) return { error: `Falta el id de la ${INFO_TIPO[tipo].singular} que se publica.` };
      let opciones: Array<{ id: number; nombre: string }>;
      try {
        opciones = await opcionesParaPublicar(tipo);
      } catch (e) {
        return { error: `No pude leer tus ${INFO_TIPO[tipo].titulo.toLowerCase()} (${motivo(e)}).` };
      }
      const cosa = opciones.find((o) => o.id === origenId);
      if (!cosa) return { error: `No existe la ${INFO_TIPO[tipo].singular} #${origenId} en este negocio.`, disponibles: opciones.slice(0, 30) };
      const datos = sanearPublicacion({ titulo: input.titulo || cosa.nombre, descripcion: input.descripcion, autorNombre: input.autorNombre });
      if ('error' in datos) return { error: datos.error };
      return {
        payload: { tipo, origenId, titulo: datos.titulo, descripcion: datos.descripcion, autorNombre: datos.autorNombre },
        resumen: `Publicar para todos los negocios de MaKo la ${INFO_TIPO[tipo].singular} «${cosa.nombre}» como «${datos.titulo}». Sus textos se publican tal cual.`,
      };
    },
    ejecutar: (payload, ctx) => seguro('publicar', async () => {
      if (!esTipoCreacion(payload.tipo)) return { ok: false, resumen: 'No se pudo publicar (tipo desconocido).' };
      const r = await publicarCreacion(ctx.ws, {
        tipo: payload.tipo, origenId: Number(payload.origenId), titulo: payload.titulo, descripcion: payload.descripcion, autorNombre: payload.autorNombre,
      }, autorDe(ctx));
      return {
        ok: true,
        resumen: r.actualizada ? `Listo: actualicé «${r.titulo}» en la galería (conserva sus estrellas).` : `Listo: «${r.titulo}» quedó publicada en la galería.`,
        datos: { creacionId: r.id, actualizada: r.actualizada },
      };
    }),
  },
  retirar_creacion: {
    preparar: async (input, ctx) => {
      const c = await creacionDe(ctx.ws, input.creacionId);
      if ('error' in c) return { error: c.error };
      if (!c.mia) return { error: 'Sólo la retira quien la publicó.' };
      if (c.estado === 'retirada') return { error: `«${c.titulo}» ya estaba retirada.`, yaEstaba: true };
      return { payload: { creacionId: c.id }, resumen: `Retirar «${c.titulo}» de la galería (quien ya la usó conserva su copia).` };
    },
    ejecutar: (payload, ctx) => seguro('retirar la creación', async () => {
      const r = await retirarCreacion(ctx.ws, Number(payload.creacionId));
      return { ok: true, resumen: r.yaEstaba ? `«${r.titulo}» ya estaba retirada.` : `Listo: retiré «${r.titulo}» de la galería.`, datos: { creacionId: Number(payload.creacionId) } };
    }),
  },
  usar_creacion: {
    preparar: async (input, ctx) => {
      const c = await creacionDe(ctx.ws, input.creacionId);
      if ('error' in c) return { error: c.error };
      if (c.estado !== 'publicada') return { error: `«${c.titulo}» ya no está publicada.` };
      if (!c.sePuedeUsar) return { error: `Todavía no se pueden usar ${INFO_TIPO[c.tipo as keyof typeof INFO_TIPO]?.titulo.toLowerCase() ?? 'creaciones de ese tipo'} en MaKo.` };
      return { payload: { creacionId: c.id }, resumen: `Crear en tu negocio una copia de «${c.titulo}» (${c.tipoTitulo}), apagada.` };
    },
    ejecutar: (payload, ctx) => seguro('usar la creación', async () => {
      const r = await usarCreacion(ctx.ws, Number(payload.creacionId));
      const link = linkApp(r.ruta, ctx.ws);
      return {
        ok: true,
        resumen: `Listo: «${r.nombre}» quedó creada en tu negocio, apagada.${r.aviso ? ` ${r.aviso}` : ''}`,
        datos: { creacionId: Number(payload.creacionId), id: r.id, nombre: r.nombre, aviso: r.aviso, url: link },
        paraLaPersona: `Ábrela acá: ${link}`,
      };
    }),
  },
};
