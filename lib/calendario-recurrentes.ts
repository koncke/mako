// =============================================================================
// calendario-recurrentes — una Publicación que se repite: la regla, lo que se dibuja y el generador del cron (29/10/2026)
// =============================================================================
// Las decisiones viven en lib/calendario-recurrentes-reglas.ts (puras, con test). Acá lo que habla con la base y con Zernio:
//   · `guardarRepeticion` / `repeticionDelEvento` — la regla de un molde (sólo una Publicación; mig 0349).
//   · `seriesParaDibujar` — las próximas veces que todavía no nacieron, para la capa «Se repite» del Calendario.
//   · `generarRecurrentes` — el cron: crea cada vez una Publicación igual al molde (la misma hora, cuenta, archivo y texto) y la
//     programa por el MISMO camino que «Programar» (`programarPublicaciones`): ninguna otra puerta a la red.
//
// ⚠️ SIN LA MIG 0349 NADA SE ROMPE: la regla se lee y se escribe APARTE de la lectura del Calendario (`COLS` no la nombra), y un
//    «la columna no existe» se dice en palabras (FALTA_MIGRACION_RECURRENTES) o se calla en lo que sólo dibuja.
// ⚠️ EL ARCHIVO SE COPIA, NO SE COMPARTE: la ruta de un archivo es la del evento (`rutaValida`: `<ws>/calendario/<evento>/…`), y
//    borrar una vez no puede llevarse el archivo del molde. Cada vez nace con su copia (Storage `copy`, dentro del bucket).

import 'server-only';
import { randomBytes } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { hoyEnWorkspace } from './timezone';
import { diaDe, filaDeEntrada, horaDe, sumarDias, type FormatoPublicacion, type ItemCalendario } from './calendario-modelo';
import { esSinMigracion, programarPublicaciones } from './calendario-publicar';
import { BUCKET_PUBLICAR, MARGEN_PROGRAMAR_MS, rutaDelArchivo } from './calendario-publicar-reglas';
import {
  faltaParaRepetir, idDeVezDibujada, reglaDePublicacion, textoCortoDeRegla, vecesACrear, vecesADibujar,
} from './calendario-recurrentes-reglas';

export const FALTA_MIGRACION_RECURRENTES = 'Repetir una publicación todavía no está activo en tu cuenta.';

type Molde = {
  id: string; titulo: string; formato: FormatoPublicacion | null; inicio: string; dia_completo: boolean; repetir: string;
  red: string | null; cuenta_red: string | null; archivo: string | null; archivo_tipo: 'image' | 'video' | null; texto: string | null;
};
const COLS_MOLDE = 'id, titulo, formato, inicio, dia_completo, repetir, red, cuenta_red, archivo, archivo_tipo, texto';

/** La regla de un evento (null = no se repite). `disponible: false` = la base todavía no la tiene (mig 0349). */
export async function repeticionDelEvento(id: string): Promise<{ regla: string | null; disponible: boolean }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').select('repetir').eq('id', id).maybeSingle();
  if (error) {
    if (esSinMigracion(error.message) || /repetir/.test(error.message)) return { regla: null, disponible: false };
    throw new Error(`No pude leer la repetición: ${error.message}`);
  }
  return { regla: (data as { repetir?: string | null } | null)?.repetir ?? null, disponible: true };
}

/** Pone (o saca, con null) la regla de una Publicación. Lo que ya nació y está programado, queda. */
export async function guardarRepeticion(id: string, regla: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const valor = regla == null || regla === '' ? null : reglaDePublicacion(regla);
  if (regla && !valor) return { ok: false, error: 'Esa repetición no es válida.' };
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').update({ repetir: valor, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tipo', 'publicacion').select('id');
  if (error) {
    if (esSinMigracion(error.message) || /repetir/.test(error.message)) return { ok: false, error: FALTA_MIGRACION_RECURRENTES };
    throw new Error(`No pude guardar la repetición: ${error.message}`);
  }
  return data?.length ? { ok: true } : { ok: false, error: 'Sólo una Publicación se repite.' };
}

/** Los moldes del negocio (las Publicaciones con regla) y, de cada uno, los días que ya nacieron desde `desdeIso`. */
async function moldesConNacidas(desdeIso: string, tz: string): Promise<Array<{ m: Molde; nacidas: Set<string> }> | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').select(COLS_MOLDE).not('repetir', 'is', null).limit(200);
  if (error) {
    if (esSinMigracion(error.message) || /repetir|archivo|cuenta_red/.test(error.message)) return null;
    throw new Error(`calendario_eventos (moldes): ${error.message}`);
  }
  const moldes = (data ?? []) as Molde[];
  if (!moldes.length) return [];
  const { data: hijas, error: e2 } = await db.from('calendario_eventos').select('serie_de, inicio')
    .in('serie_de', moldes.map((m) => m.id)).gte('inicio', desdeIso);
  if (e2) throw new Error(`calendario_eventos (veces): ${e2.message}`);
  return moldes.map((m) => ({
    m,
    nacidas: new Set(((hijas ?? []) as Array<{ serie_de: string; inicio: string }>).filter((h) => h.serie_de === m.id).map((h) => diaDe(h.inicio, tz))),
  }));
}

/**
 * Las próximas veces de las Publicaciones que se repiten, en una vista (`desde`/`hasta`, días del negocio): ítems de SÓLO LECTURA de
 * la capa «Se repite» (como las tareas del Plan), que llevan al molde (`?evento=`). Sin la mig 0349, nada (no es un error).
 */
export async function seriesParaDibujar(desde: string, hasta: string, desdeIso: string, tz: string, ahora: Date = new Date()): Promise<ItemCalendario[]> {
  const series = await moldesConNacidas(desdeIso, tz);
  if (!series) return [];
  const hoy = await hoyEnWorkspace(ahora);
  const out: ItemCalendario[] = [];
  for (const { m, nacidas } of series) {
    if (m.dia_completo) continue;
    const ancla = diaDe(m.inicio, tz);
    const hora = horaDe(m.inicio, tz);
    for (const f of vecesADibujar({ regla: m.repetir, ancla, desde, hasta: sumarDias(hasta, -1), hoy, nacidas })) {
      const fila = filaDeEntrada({ titulo: m.titulo || 'Publicación', tipo: 'publicacion', formato: m.formato, fecha: f, hora }, tz);
      // La de hoy cuya hora ya pasó tampoco va a salir.
      if (!fila.ok || Date.parse(fila.fila.inicio) <= ahora.getTime()) continue;
      out.push({
        // ⚠️ `plan` y no `propio`: no es una fila que se edite desde acá (como las recurrentes del Plan). Lleva al molde.
        id: idDeVezDibujada(m.id, f), fuente: 'plan', capa: 'recurrentes', titulo: fila.fila.titulo, inicio: fila.fila.inicio, fin: null,
        diaCompleto: false, href: `/calendario?vista=semana&fecha=${ancla}&evento=${encodeURIComponent(m.id)}`,
        detalle: `Se repite · ${textoCortoDeRegla(m.repetir) ?? 'Publicación'}`,
      });
    }
  }
  return out;
}

const EXT_A_MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime' };
const nuevoId = () => `ev${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type ResultadoRecurrentes = { moldes: number; creadas: number; programadas: number; incompletos: number; fallidas: string[]; sinMigracion?: true };

/**
 * EL CRON: por cada molde completo, crea las veces que tocan (`vecesACrear`: hoy y hasta `HORIZONTE_DIAS`, nada hacia atrás) con su
 * archivo copiado, y las programa por `programarPublicaciones` (el mismo camino que «Programar»; ahí se aplican los límites de cada
 * red). Una que choca con el índice único (otra pasada la creó a la vez) se salta y se borra su copia.
 */
export async function generarRecurrentes(
  ahora: Date = new Date(),
  // La copia del archivo y «Programar»: las de siempre; la prueba las cambia (Storage y Zernio de verdad no están en un test).
  deps: {
    copiar?: (de: string, a: string) => Promise<{ error: { message: string } | null }>;
    borrar?: (ruta: string) => Promise<unknown>;
    programar?: typeof programarPublicaciones;
  } = {},
): Promise<ResultadoRecurrentes> {
  const res: ResultadoRecurrentes = { moldes: 0, creadas: 0, programadas: 0, incompletos: 0, fallidas: [] };
  const ws = await getWorkspaceActual();
  if (ws == null) return res;
  const { zonaDelCalendario } = await import('./calendario');
  const [tz, hoy] = await Promise.all([zonaDelCalendario(), hoyEnWorkspace(ahora)]);
  const series = await moldesConNacidas(new Date(ahora.getTime() - 86_400_000).toISOString(), tz);
  if (series == null) return { ...res, sinMigracion: true };
  const db = await getTenantDb();
  const bucket = () => getSupabaseServer().storage.from(BUCKET_PUBLICAR);
  const copiar = deps.copiar ?? ((de: string, a: string) => bucket().copy(de, a));
  const borrar = deps.borrar ?? ((ruta: string) => bucket().remove([ruta]));
  const programar = deps.programar ?? programarPublicaciones;
  for (const { m, nacidas } of series) {
    res.moldes++;
    if (faltaParaRepetir(m)) { res.incompletos++; continue; }
    const ancla = diaDe(m.inicio, tz);
    const hora = horaDe(m.inicio, tz);
    const ids: string[] = [];
    for (const fecha of vecesACrear({ regla: m.repetir, ancla, hoy, nacidas })) {
      const entrada = filaDeEntrada({ titulo: m.titulo || 'Publicación', tipo: 'publicacion', formato: m.formato, fecha, hora }, tz);
      if (!entrada.ok) { res.fallidas.push(`${m.id}@${fecha}: ${entrada.error}`); continue; }
      // La hora de hoy que ya pasó (o falta muy poco): Zernio no programa en el pasado. Se deja pasar, como una vez perdida.
      if (Date.parse(entrada.fila.inicio) - ahora.getTime() < MARGEN_PROGRAMAR_MS) continue;
      const id = nuevoId();
      const ext = (m.archivo as string).split('.').pop()?.toLowerCase() ?? '';
      const ruta = rutaDelArchivo(ws, id, EXT_A_MIME[ext] ?? '', randomBytes(12).toString('hex'));
      if (!ruta) { res.fallidas.push(`${m.id}@${fecha}: el archivo del molde no se puede copiar`); continue; }
      const copia = await copiar(m.archivo as string, ruta);
      if (copia.error) { res.fallidas.push(`${m.id}@${fecha}: no pude copiar el archivo (${copia.error.message})`); continue; }
      const { error } = await db.from('calendario_eventos').insert({
        id, ...entrada.fila, estado: 'planeado', origen: 'plantilla', creado_por: 'MaKo (se repite)', serie_de: m.id,
        red: m.red, cuenta_red: m.cuenta_red, archivo: ruta, archivo_tipo: m.archivo_tipo, texto: m.texto ?? '',
      });
      if (error) {
        await Promise.resolve(borrar(ruta)).catch(() => null);
        // Otra pasada la creó a la vez (el índice único): no es un error.
        if (/calendario_eventos_serie_vez_uidx|duplicate key/i.test(error.message)) continue;
        res.fallidas.push(`${m.id}@${fecha}: ${error.message.slice(0, 160)}`);
        continue;
      }
      res.creadas++;
      ids.push(id);
    }
    if (!ids.length) continue;
    const r = await programar(ids, ahora.getTime());
    if ('error' in r) { res.fallidas.push(`${m.id}: ${r.error}`); continue; }
    res.programadas += r.programadas.length;
    for (const f of r.fallidas) res.fallidas.push(`${f.id}: ${f.motivo}`);
  }
  return res;
}
