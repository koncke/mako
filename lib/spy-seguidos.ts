// =============================================================================
// spy-seguidos: los competidores SEGUIDOS del negocio, en el servidor (13/11/2026)
// =============================================================================
// Las reglas (qué es un seguido, el número por red, las alertas): lib/spy-seguidos-reglas.ts. Acá sólo se lee y se escribe.
// Lo leen la pantalla de Spy (`?ver=seguidos`), la API de MaKo (área `spy`) y Marketing CoPilot: el contrato está en
// docs/hallazgos-competitors-spy.md («Seguidos»).
//
// ⚠️ SE GUARDA EN app_settings (`spy.seguidos`), NO EN UNA COLUMNA: así no hace falta una migración, que la nube escribe y
// no puede aplicar. Se escribe con compare-and-set: dos personas del equipo que siguen a dos cuentas a la vez no se pisan.
// ⚠️ UN COMPETIDOR BORRADO SE DEJA DE SEGUIR SOLO: al leer, se cruza con los que existen.
// =============================================================================

import 'server-only';

import { ENMIENDA_III_L, podarVencido } from './spy-reglas';
import { miniaturaDePieza } from './spy-vista';
import { cambiarSettingSi, getSetting, getSettingEstricto } from './settings';
import { leerPorPaginas, type OpcionesPaginado } from './supabase-paginado';
import { getTenantDb } from './workspace';
import {
  CLAVE_SEGUIDOS, DIAS_NOVEDADES, DIAS_OUTLIER, alertaCompacta, alertasDe, cambiarSeguido, idsSeguidos, leerRegistroSeguidos,
  numeroDeSeguidos, type Alerta, type AlertaDeSeguido, type NumeroDeSeguidos, type PiezaSeguida,
} from './spy-seguidos-reglas';

const DIA = 86_400_000;
/** Como mucho, cuántas piezas se leen de los seguidos (las de Instagram y anuncios enteras: el múltiplo compara con su cuenta). */
const PIEZAS_A_LEER = 12_000;

export type CompetidorSeguido = { id: number; nombre: string; avatar: string | null };

/** Los ids de los competidores que existen en este negocio (para cruzar). */
async function existentes(): Promise<CompetidorSeguido[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('spy_competidores').select('id, nombre, avatar').limit(500);
  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(`No pude leer los competidores: ${error.message}`);
  }
  return (data ?? []) as CompetidorSeguido[];
}

/** A quién sigue el negocio, y desde cuándo. */
export async function leerSeguidos(): Promise<{ ids: number[]; desde: Record<number, string> }> {
  const [crudo, hay] = await Promise.all([getSetting(CLAVE_SEGUIDOS), existentes()]);
  const r = leerRegistroSeguidos(crudo);
  const ids = idsSeguidos(r, hay.map((c) => c.id));
  return { ids, desde: Object.fromEntries(ids.map((id) => [id, r[String(id)].desde])) };
}

/** El conjunto de seguidos, para marcar las tarjetas de la lista. Sin poder leerlo, nadie aparece seguido (no es un error). */
export async function idsDeSeguidos(): Promise<Set<number>> {
  const r = leerRegistroSeguidos(await getSetting(CLAVE_SEGUIDOS).catch(() => null));
  return new Set(idsSeguidos(r));
}

/** Seguir o dejar de seguir. `false` si el competidor no es de este negocio. */
export async function seguirCompetidor(id: number, seguir: boolean): Promise<{ ok: true; ids: number[] } | { ok: false; error: string }> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Ese competidor no existe.' };
  const hay = await existentes();
  if (!hay.some((c) => c.id === id)) return { ok: false, error: 'Ese competidor no existe en tu negocio.' };
  for (let intento = 0; intento < 4; intento += 1) {
    const crudo = await getSettingEstricto(CLAVE_SEGUIDOS);
    const antes = leerRegistroSeguidos(crudo);
    const despues = cambiarSeguido(antes, id, seguir, new Date().toISOString());
    if (despues === antes) return { ok: true, ids: idsSeguidos(antes, hay.map((c) => c.id)) };
    if (await cambiarSettingSi(CLAVE_SEGUIDOS, crudo, JSON.stringify(despues))) return { ok: true, ids: idsSeguidos(despues, hay.map((c) => c.id)) };
  }
  return { ok: false, error: 'Otra persona de tu equipo estaba cambiando los seguidos. Vuelve a intentarlo.' };
}

/**
 * Las piezas de los seguidos. Instagram y anuncios, enteras (el múltiplo compara cada una con su cuenta); YouTube, sólo lo de
 * las últimas semanas mientras no haya enmienda (sin ella no hay número que calcular, y Dave Ramsey solo tiene 2000 videos).
 */
async function piezasDe(ids: readonly number[], dias: number): Promise<Array<PiezaSeguida & Record<string, unknown>>> {
  if (!ids.length) return [];
  const db = await getTenantDb();
  const filas: Array<Record<string, unknown>> = [];
  const desdeYoutube = new Date(Date.now() - Math.max(dias, DIAS_OUTLIER) * DIA).toISOString();
  const leer = (filtros: NonNullable<OpcionesPaginado['filtros']>) =>
    leerPorPaginas<Record<string, unknown>>(db, 'spy_piezas', '*', (pagina) => {
      filas.push(...pagina);
      return filas.length < PIEZAS_A_LEER;
    }, { orden: 'id', filtros });
  await leer((q) => q.in('competidor_id', [...ids]).in('canal', ['instagram', 'anuncios']));
  await leer((q) => (ENMIENDA_III_L
    ? q.in('competidor_id', [...ids]).eq('canal', 'youtube')
    : q.in('competidor_id', [...ids]).eq('canal', 'youtube').gte('publicada_en', desdeYoutube)));
  return filas.map((f) => podarVencido(f) as unknown as PiezaSeguida & Record<string, unknown>);
}

/** Todo lo de los seguidos de una vez: quiénes son, el número por red y las alertas (la pantalla lo pide junto). */
export async function lecturaDeSeguidos(o: { dias?: number } = {}): Promise<{
  competidores: CompetidorSeguido[];
  numero: NumeroDeSeguidos;
  alertas: Array<AlertaDeSeguido<PiezaSeguida & Record<string, unknown>>>;
}> {
  const dias = o.dias ?? DIAS_NOVEDADES;
  const [crudo, hay] = await Promise.all([getSetting(CLAVE_SEGUIDOS), existentes()]);
  const ids = idsSeguidos(leerRegistroSeguidos(crudo), hay.map((c) => c.id));
  const competidores = ids.map((id) => hay.find((c) => c.id === id) as CompetidorSeguido);
  const piezas = await piezasDe(ids, dias);
  const ahora = Date.now();
  return { competidores, numero: numeroDeSeguidos(piezas, competidores, ahora), alertas: alertasDe(piezas, ahora, { dias }) };
}

/** «Con qué número se publica»: el número de los seguidos, por red (el contrato de CoPilot). */
export async function promedioDeSeguidos(): Promise<NumeroDeSeguidos> {
  return (await lecturaDeSeguidos()).numero;
}

/** Las alertas de los seguidos como las lee CoPilot y la API: outliers primero, después lo nuevo. */
export async function alertasDeSeguidos(o: { dias?: number } = {}): Promise<Alerta[]> {
  const { competidores, alertas } = await lecturaDeSeguidos(o);
  const ahora = Date.now();
  return alertas.map((a) => alertaCompacta(a, competidores.find((c) => c.id === a.pieza.competidor_id), miniaturaDePieza(a.pieza, ahora)));
}
