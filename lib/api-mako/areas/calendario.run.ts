// =============================================================================
// api-mako/areas/calendario.run — los cuerpos del área `calendario`
// =============================================================================
// Cruzados por id con calendario.def.ts. Lo que escribe pasa por lib/calendario.ts (`crearEventos`), el mismo camino
// que la pantalla: la validación (`filaDeEntrada`) y la zona del negocio son las mismas. Y no lee la agenda de Google:
// ni para listar ni para validar un horario (la agenda no pasa por ningún modelo).

import 'server-only';
import { revalidatePath } from 'next/cache';
import type { Runners, Preparado, Ejecutado } from '../tipos';
import { hoyEnWorkspace } from '@/lib/timezone';
import { crearEventos, listarPropios, zonaDelCalendario } from '@/lib/calendario';
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
};
