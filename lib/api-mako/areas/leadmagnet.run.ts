// =============================================================================
// api-mako/areas/leadmagnet.run — el área `leadmagnet` (5/11/2026): lo mismo que la tab, por la API
// =============================================================================
// Cada runner llama a lib/lead-magnets/server.ts, la MISMA puerta que /api/lead-magnet-generator. `preparar` valida lo que se
// puede saber sin escribir (la plantilla existe, el lead magnet está en la lista) y arma el resumen que lee la persona;
// `ejecutar` escribe y nunca lanza. Nada de esto corre en un flujo (NO_EN_FLUJOS): `enFlujo` lo vuelve a frenar.
// =============================================================================

import 'server-only';
import { revalidatePath } from 'next/cache';
import type { Runners, Preparado, Ejecutado, Ctx } from '../tipos';
import { linkPantalla } from '../link';
import { PREFIJO_FLUJO } from '../canal';
import { PLANTILLAS_LEAD_MAGNET, plantillaLeadMagnet, nombreInicial, NOMBRE_HERRAMIENTA } from '@/lib/lead-magnets/plantillas';
import { rutaDePagina } from '@/lib/lead-magnets/pieza';
import { armarLeadMagnet, crearPaginaDeCaptura, linkPublico, listarLeadMagnets, ponerPrimero } from '@/lib/lead-magnets/server';

const json = (o: unknown): string => JSON.stringify(o);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const enFlujo = (ctx: Ctx): boolean => ctx.canalKey.startsWith(PREFIJO_FLUJO);
const NO_EN_FLUJO = 'Esto no corre en una automatización: un paso corre una vez por cada lead y armaría una pieza por cada uno. Pídeselo a MaKo en el chat.';
const listo = () => { try { revalidatePath('/lead-magnet-generator'); } catch { /* fuera de un pedido (un test): no hay qué revalidar */ } };

async function seguro(que: string, fn: () => Promise<Ejecutado>): Promise<Ejecutado> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[api-mako leadmagnet] ${que}:`, e instanceof Error ? e.message : e);
    return { ok: false, resumen: `No se pudo ${que}: vuelve a intentarlo.` };
  }
}

/** El lead magnet de la lista por su id, para el resumen (o el error de `preparar`). */
async function delaLista(id: string): Promise<{ nombre: string; tienePieza: boolean; esWeb: boolean; pagina?: number } | Preparado> {
  if (!id) return { error: 'Falta el id del lead magnet.', faltan: ['id'] };
  const l = await listarLeadMagnets();
  if (!l.ok) return { error: l.error, falla: true };
  const lm = l.lista.find((e) => e.id === id);
  if (!lm) return { error: 'Ese lead magnet no está en la lista. Pide la lista con listar_lead_magnets.', disponibles: l.lista.map((e) => ({ id: e.id, nombre: e.nombre })) };
  return { nombre: lm.nombre, tienePieza: !!lm.pieza, esWeb: lm.pieza?.herramienta === 'web', pagina: lm.pagina };
}
const esPreparado = (v: unknown): v is Preparado => !!v && typeof v === 'object' && ('error' in v || 'payload' in v);

export const RUNNERS: Runners = {
  ver_plantillas_magnet: {
    leer: async () => json({
      plantillas: PLANTILLAS_LEAD_MAGNET.map((p) => ({
        id: p.id, nombre: p.nombre, cuando: p.ayuda, herramienta: NOMBRE_HERRAMIENTA[p.herramienta], tipo: p.tipo,
        secciones: p.secciones.map((s) => ({ seccion: s.etiqueta, guia: s.guia })),
        ejemplo: { negocio_ficticio: p.ejemplo.negocio, titulo: p.ejemplo.titulo, partes: p.ejemplo.partes },
        pide: p.pide,
      })),
      nota: 'El ejemplo es de un negocio FICTICIO: es una muestra de cómo queda, no un dato del negocio. La pieza nace con las secciones y su guía, nunca con el ejemplo.',
    }),
  },

  armar_magnet: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const pl = plantillaLeadMagnet(str(input.plantilla));
      if (!pl) return { error: 'Esa plantilla no existe.', disponibles: PLANTILLAS_LEAD_MAGNET.map((p) => ({ id: p.id, nombre: p.nombre })) };
      const nombre = nombreInicial(pl, str(input.nombre));
      return {
        payload: { plantilla: pl.id, nombre },
        resumen: `Armar el lead magnet «${nombre}» con la plantilla «${pl.nombre}», en ${NOMBRE_HERRAMIENTA[pl.herramienta]}: con sus secciones y su guía, sin el ejemplo.`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => seguro('armar el lead magnet', async () => {
      const r = await armarLeadMagnet(payload.plantilla, typeof payload.nombre === 'string' ? payload.nombre : null);
      if (!r.ok) return { ok: false, resumen: r.error };
      listo();
      const link = linkPantalla(r.ruta, ctx.ws);
      return {
        ok: true,
        resumen: r.aviso ?? `Lead magnet «${r.nombre}» armado en ${NOMBRE_HERRAMIENTA[r.pieza.herramienta]}. Se escribe ahí: ${link}`,
        datos: { leadMagnetId: r.id, herramienta: r.pieza.herramienta, piezaId: r.pieza.id, link },
      };
    }),
  },

  pagina_captura_magnet: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = str(input.id);
      const lm = await delaLista(id);
      if (esPreparado(lm)) return lm;
      if (lm.esWeb) return { error: 'Ese lead magnet ya es una página con su formulario: se edita en el Web Generator.' };
      if (lm.pagina) return { error: `Ya tiene su página: ${linkPantalla(rutaDePagina(lm.pagina), ctx.ws)}`, yaEstaba: true };
      return { payload: { id }, resumen: `Crear la página que pide «${lm.nombre}»: una landing con formulario (nombre y correo, entra al CRM), como borrador sin publicar.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => seguro('crear la página', async () => {
      const r = await crearPaginaDeCaptura(String(payload.id ?? ''));
      if (!r.ok) return { ok: false, resumen: r.error };
      listo();
      const link = linkPantalla(rutaDePagina(r.pagina), ctx.ws);
      return { ok: true, resumen: `${r.nueva ? 'Página creada' : 'Ya tenía su página'} (borrador sin publicar): ${link}`, datos: { landingId: r.pagina, link } };
    }),
  },

  link_publico_magnet: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (enFlujo(ctx)) return { error: NO_EN_FLUJO };
      const id = str(input.id);
      const lm = await delaLista(id);
      if (esPreparado(lm)) return lm;
      if (!lm.tienePieza) return { error: 'Ese lead magnet no tiene una página en MaKo: su link se cambia con editar_lead_magnet.' };
      if (lm.esWeb) return { error: 'Una landing se publica desde el Web Generator (publicar_landing).' };
      return { payload: { id }, resumen: `Crear un link público de solo lectura para «${lm.nombre}» y dejarlo como el link que reciben los leads.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => seguro('crear el link', async () => {
      const r = await linkPublico(String(payload.id ?? ''), ctx.actor ?? null);
      if (!r.ok) return { ok: false, resumen: r.error };
      listo();
      return { ok: true, resumen: `${r.nuevo ? 'Link creado' : 'Ya tenía su link'}: ${r.url}`, datos: { url: r.url } };
    }),
  },

  primero_magnet: {
    preparar: async (input): Promise<Preparado> => {
      const id = str(input.id);
      const l = await listarLeadMagnets();
      if (!l.ok) return { error: l.error, falla: true };
      const i = l.lista.findIndex((e) => e.id === id);
      if (i < 0) return { error: 'Ese lead magnet no está en la lista. Pide la lista con listar_lead_magnets.', disponibles: l.lista.map((e) => ({ id: e.id, nombre: e.nombre })) };
      if (i === 0) return { error: `«${l.lista[0].nombre}» ya es el primero.`, yaEstaba: true };
      return { payload: { id }, resumen: `Poner primero «${l.lista[i].nombre}»: las automatizaciones van a mandar su link (antes, el de «${l.lista[0].nombre}»).` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => seguro('cambiar el orden', async () => {
      const r = await ponerPrimero(String(payload.id ?? ''));
      if (!r.ok) return { ok: false, resumen: r.error };
      listo();
      return { ok: true, resumen: 'Listo: es el primero de la lista.' };
    }),
  },
};
