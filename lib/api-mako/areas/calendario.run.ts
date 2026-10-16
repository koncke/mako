// =============================================================================
// api-mako/areas/calendario.run — los cuerpos del área `calendario`
// =============================================================================
// Cruzados por id con calendario.def.ts. Lo que escribe pasa por lib/calendario.ts (`crearEventos`), el mismo camino
// que la pantalla: la validación (`filaDeEntrada`) y la zona del negocio son las mismas. Y no lee la agenda de Google:
// ni para listar ni para validar un horario (la agenda no pasa por ningún modelo). Desde el 14/10/2026 ESCRIBE en ella
// (`crear_evento_google`, lib/calendario-google.ts): crea y contesta un estado, nunca lo que hay en la agenda.
// Y desde el mismo día lee el link de agenda del negocio (lib/agenda-link.ts) y las próximas veces de lo que se repite
// (`recurrentesDelRango`, lib/calendario.ts): las MISMAS funciones que la pantalla.

import 'server-only';
import { revalidatePath } from 'next/cache';
import type { Runners, Preparado, Ejecutado } from '../tipos';
import { hoyEnWorkspace } from '@/lib/timezone';
import { crearEventos, listarPropios, recurrentesDelRango, zonaDelCalendario } from '@/lib/calendario';
import { linkDeAgenda } from '@/lib/agenda-link';
import { anticipacionDeLaAgenda } from '@/lib/agenda-anticipacion';
import { getWorkspace } from '@/lib/workspace';
import { tableroDeCapa } from '@/lib/tablero-de-capa';
import { crearEventoGoogle } from '@/lib/calendario-google';
import { cuerpoEventoGoogle, type EntradaEventoGoogle } from '@/lib/calendario-google-modelo';
import {
  filaDeEntrada, sumarDias, horaDe, diaDe, esTipoEvento, esFormato, ROTULO_TIPO, ROTULO_FORMATO,
  type EntradaEvento,
} from '@/lib/calendario-modelo';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const str = (input: Record<string, unknown>, k: string): string | null => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const MAX_DIAS = 62;

/** El rango de una lectura: «desde» (hoy si no vino) y «hasta» inclusive (7 días si no vino), hasta MAX_DIAS. */
function rangoDe(input: Record<string, unknown>, hoy: string): { desde: string; hasta: string } | { error: string } {
  const desde = str(input, 'desde') ?? hoy;
  if (!FECHA.test(desde)) return { error: '«desde» tiene que ser YYYY-MM-DD.' };
  const hasta = str(input, 'hasta') ?? sumarDias(desde, 6);
  if (!FECHA.test(hasta) || hasta < desde) return { error: '«hasta» tiene que ser YYYY-MM-DD y no antes de «desde».' };
  const dias = Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
  if (dias > MAX_DIAS) return { error: `Hasta ${MAX_DIAS} días por consulta.` };
  return { desde, hasta };
}

/** La entrada de un evento desde lo que pasó el modelo (sin adivinar: lo que no vino, no está). */
function entradaDe(input: Record<string, unknown>): EntradaEvento {
  const tipo = str(input, 'tipo');
  const formato = str(input, 'formato');
  const dur = input.duracionMin;
  return {
    titulo: str(input, 'titulo') ?? '',
    tipo: esTipoEvento(tipo) ? tipo : 'bloque',
    formato: esFormato(formato) ? formato : null,
    fecha: str(input, 'fecha') ?? '',
    hora: str(input, 'hora'),
    duracionMin: typeof dur === 'number' && Number.isFinite(dur) ? dur : null,
    notas: str(input, 'notas') ?? '',
  };
}

/** El evento de Google desde lo que pasó el modelo. */
function entradaGoogleDe(input: Record<string, unknown>): EntradaEventoGoogle {
  const dur = input.duracionMin;
  return {
    titulo: str(input, 'titulo') ?? '', fecha: str(input, 'fecha') ?? '', hora: str(input, 'hora'),
    duracionMin: typeof dur === 'number' && Number.isFinite(dur) ? dur : 60,
    ubicacion: str(input, 'ubicacion') ?? '', descripcion: str(input, 'descripcion') ?? '',
  };
}

export const RUNNERS: Runners = {
  listar_eventos_calendario: {
    leer: async (input) => {
      const [hoy, tz] = await Promise.all([hoyEnWorkspace(), zonaDelCalendario()]);
      const desde = str(input, 'desde') ?? hoy;
      if (!FECHA.test(desde)) return JSON.stringify({ error: '«desde» tiene que ser YYYY-MM-DD.' });
      const hasta = str(input, 'hasta') ?? sumarDias(desde, 6);
      if (!FECHA.test(hasta) || hasta < desde) return JSON.stringify({ error: '«hasta» tiene que ser YYYY-MM-DD y no antes de «desde».' });
      const dias = Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
      if (dias > MAX_DIAS) return JSON.stringify({ error: `Hasta ${MAX_DIAS} días por consulta.` });
      const filas = await listarPropios(desde, sumarDias(hasta, 1), tz);
      return JSON.stringify({
        desde, hasta, zona: tz, total: filas.length,
        nota: 'Sólo lo agendado en el Calendario. No incluye la agenda de Google, las reuniones del CRM ni los deadlines del Plan.',
        eventos: filas
          .sort((a, b) => a.inicio.localeCompare(b.inicio))
          .map((f) => ({
            id: f.id, titulo: f.titulo, tipo: ROTULO_TIPO[f.tipo], formato: f.formato ? ROTULO_FORMATO[f.formato] : null,
            fecha: diaDe(f.inicio, tz), hora: f.dia_completo ? null : horaDe(f.inicio, tz),
            duracion_min: f.fin ? Math.round((Date.parse(f.fin) - Date.parse(f.inicio)) / 60_000) : null,
            hecho: f.estado === 'hecho',
          })),
      });
    },
  },

  crear_evento_calendario: {
    preparar: async (input): Promise<Preparado> => {
      const e = entradaDe(input);
      if (!e.titulo) return { error: 'Falta el título del evento.', faltan: ['titulo'] };
      if (!e.fecha) return { error: 'Falta la fecha (YYYY-MM-DD).', faltan: ['fecha'] };
      // Lo que se puede saber sin escribir falla ACÁ (AGENTS.md: confirmar reclama antes de ejecutar).
      const tz = await zonaDelCalendario();
      const r = filaDeEntrada(e, tz);
      if (!r.ok) return { error: r.error };
      const que = e.tipo === 'publicacion' && e.formato ? ROTULO_FORMATO[e.formato] : ROTULO_TIPO[e.tipo];
      const cuando = `${e.fecha}${e.hora ? ` a las ${e.hora}` : ' (todo el día)'}${e.duracionMin ? `, ${e.duracionMin} min` : ''}`;
      return { payload: { ...e }, resumen: `Agendar en el Calendario: ${que} «${r.fila.titulo}», ${cuando}.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      try {
        const tz = await zonaDelCalendario();
        const r = await crearEventos([entradaDe(payload)], tz, { origen: 'api', autor: 'MaKo' });
        if (!r.ok) return { ok: false, resumen: r.error };
        try { revalidatePath('/calendario'); } catch { /* fuera de un request: vence sola */ }
        return { ok: true, resumen: 'Agendado en el Calendario.', datos: { eventoId: r.ids[0] } };
      } catch (e) {
        return { ok: false, resumen: `No se pudo agendar (${e instanceof Error ? e.message : 'error'}).` };
      }
    },
  },

  link_agenda_llamada: {
    leer: async (input) => {
      const cual = str(input, 'cual') === 'R2' ? 'R2' as const : 'R1' as const;
      const r = await linkDeAgenda(cual);
      return JSON.stringify(r.ok
        ? { cual, proveedor: r.proveedor, reunion: r.reunion, url: r.url, motivo: null, instruccion: 'Pasa el link TAL CUAL: no lo reescribas.' }
        : { cual, url: null, motivo: r.motivo, se_puede_conectar: r.faltan });
    },
  },

  anticipacion_agenda: {
    leer: async (_input, ctx) => JSON.stringify(await anticipacionDeLaAgenda(ctx.ws)),
  },

  ver_proximas_recurrentes: {
    leer: async (input, ctx) => {
      const rango = rangoDe(input, await hoyEnWorkspace());
      if ('error' in rango) return JSON.stringify({ error: rango.error });
      // La mitad del tablero, por CAPA (por WhatsApp no hay cookie: ver `recurrentesDelRango`).
      const que = tableroDeCapa((await getWorkspace(ctx.ws).catch(() => null))?.capa);
      const veces = await recurrentesDelRango(rango.desde, sumarDias(rango.hasta, 1), que);
      return JSON.stringify({
        ...rango, total: veces.length,
        nota: 'Proyecciones: la tarea de cada fecha la crea MaKo sola el día que toca. Sólo de hoy en adelante.',
        veces: veces.map((v) => ({ fecha: v.fecha, tarea: v.titulo, tarea_id: v.tareaId, ritmo: v.ritmo })),
      });
    },
  },

  // 14/10/2026: escribe en Google sin leer la agenda (el resumen sale de lo que dijo la persona, no de Google).
  crear_evento_google: {
    preparar: async (input): Promise<Preparado> => {
      const e = entradaGoogleDe(input);
      if (!e.titulo.trim()) return { error: 'Falta el título del evento.', faltan: ['titulo'] };
      if (!e.fecha) return { error: 'Falta la fecha (YYYY-MM-DD).', faltan: ['fecha'] };
      const c = cuerpoEventoGoogle(e, await zonaDelCalendario());
      if (!c.ok) return { error: c.error };
      const cuando = `${e.fecha}${e.hora ? ` a las ${e.hora}` : ' (todo el día)'}${e.hora && e.duracionMin ? `, ${e.duracionMin} min` : ''}`;
      return { payload: { ...e }, resumen: `Crear en tu Google Calendar: «${e.titulo.trim()}», ${cuando}.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const r = await crearEventoGoogle('primary', entradaGoogleDe(payload), await zonaDelCalendario());
      if (!r.ok) return { ok: false, resumen: r.error };
      try { revalidatePath('/calendario'); } catch { /* fuera de un request: vence sola */ }
      return { ok: true, resumen: 'Creado en tu Google Calendar.', datos: { eventoId: r.id } };
    },
  },
};
