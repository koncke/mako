// =============================================================================
// leads-por-campana-server — la respuesta a «los leads de la campaña X» (ticket #56, 4/11/2026)
// =============================================================================
// La lee `buscar_leads` (cuando ningún lead se llama como el texto) y `listar_leads` (con `campana`). Qué campaña nombra el texto
// y cómo se escribe la lista: lib/leads-por-campana.ts. Acá se lee: los leads del negocio y lo que el tablero del CRM usa para
// saber de qué campaña vino cada uno (`origenAds`, con el nombre de Meta de las métricas), todo con `getTenantDb`.
//
// ⚠️ En WhatsApp la lista la ESCRIBE EL CÓDIGO (`aPersona`) y el modelo recibe sólo cuántos son: un teléfono copiado por un
// modelo puede cambiar un dígito, y una lista larga no entra en su respuesta. Sin ese canal (la app, HTTP), las filas van en
// lo que lee el modelo, con `omitidos` si son más de las que se piden.
// =============================================================================

import 'server-only';
import { listLeads, type Lead } from './leads';
import { getCampaignNameMap, getAnunciosMap, getAdNameMap } from './queries';
import { origenAds } from './campana-atribucion';
import {
  campanasConocidas, campanasDelTexto, hablaDeCampana, listaParaLaPersona,
  LIMITE_POR_CAMPANA, LIMITE_MAXIMO_POR_CAMPANA, type CampanaConLeads, type FilaDeCampana,
} from './leads-por-campana';

type FilaConClave = FilaDeCampana & { key: string | null };

/** Los leads con su campaña resuelta, y las campañas que se conocen. `aviso`: no se pudieron leer los nombres de Meta. */
async function leerCampanas(): Promise<{ filas: FilaConClave[]; campanas: CampanaConLeads[]; aviso: string | null }> {
  const avisos: string[] = [];
  const conAviso = <T>(p: Promise<T>, vacio: T, que: string) => p.catch((e: unknown) => {
    avisos.push(`${que}: ${e instanceof Error ? e.message : String(e)}`);
    return vacio;
  });
  const [leads, campMap, anunciosObj, adMap] = await Promise.all([
    listLeads() as Promise<Lead[]>,
    conAviso(getCampaignNameMap(), {} as Record<string, string>, 'los nombres de las campañas'),
    conAviso(getAnunciosMap(), {} as Record<string, { campaignId: string | null; adsetId: string | null }>, 'los anuncios'),
    conAviso(getAdNameMap(), {} as Record<string, string>, 'los nombres de los anuncios'),
  ]);
  const anuncios = new Map(Object.entries(anunciosObj));
  const filas = leads.map((l): FilaConClave => {
    const o = origenAds(l, anuncios, campMap, adMap);
    return {
      id: l.id, nombre: l.nombre ?? null, telefono: l.telefono ?? null, email: l.email ?? null,
      entro: typeof l.created_at === 'string' ? l.created_at.slice(0, 10) : null,
      campana: o.campanaNombre ?? '', key: o.campanaKey,
    };
  });
  return {
    filas,
    campanas: campanasConocidas(filas.map((f) => ({ key: f.key, nombre: f.campana || null })), campMap),
    aviso: avisos.length ? `No pude leer ${avisos.join('; ')}. Una campaña de un lead de landing puede no reconocerse por su nombre.` : null,
  };
}

export type OpcionesCampana = {
  /** Cuántas filas van en lo que lee el modelo cuando no hay `aPersona` (default 200, máximo 500). */
  limite?: number;
  /** El canal por el que el CÓDIGO le habla a la persona (el doer de WhatsApp). Con él, la lista va ahí y no al modelo. */
  aPersona?: (texto: string) => void;
  /** Sólo los leads que además cumplen esto (los otros filtros de `listar_leads`). */
  tambien?: (id: number) => boolean;
  /** `buscar_leads`: si el texto no nombra una campaña ni habla de una, null (el «no encontré» de siempre). */
  soloSiNombraUna?: boolean;
};

/**
 * La respuesta, como JSON para el modelo, a «los leads de la campaña <texto>».
 *
 * - Nombra una o más campañas → sus leads (los más nuevos primero). En WhatsApp la lista va por `aPersona` y el modelo recibe
 *   cuántos son; si no, las filas, con `omitidos` si son más que `limite`.
 * - No nombra ninguna → las parecidas (o, si el texto habla de una campaña, las que más leads trajeron) y la instrucción de
 *   preguntar cuál: NO de pedir la fecha, que no hace falta para filtrar por campaña.
 */
export async function respuestaDeCampana(texto: string, op: OpcionesCampana = {}): Promise<string | null> {
  const { filas, campanas, aviso } = await leerCampanas();
  const { coinciden, parecidas } = campanasDelTexto(texto, campanas);
  const avisoSiHay = aviso ? { aviso } : {};
  if (!coinciden.length) {
    if (op.soloSiNombraUna && !parecidas.length && !hablaDeCampana(texto)) return null;
    const sinCampana = filas.filter((f) => !f.key).length;
    return JSON.stringify({
      encontrados: 0, leads: [],
      campanas_parecidas: parecidas.map((c) => ({ nombre: c.nombre, leads: c.leads })),
      leads_sin_campana: sinCampana, total_leads: filas.length,
      instruccion: parecidas.length
        ? 'Ningún lead ni ninguna campaña se llama así. Ofrécele estas campañas con cuántos leads tiene cada una y pregúntale cuál es. No le pidas la fecha: con el nombre de la campaña alcanza.'
        : 'Este negocio no tiene ninguna campaña de Meta con leads registrada. Dile cuántos leads tiene y cuántos no tienen campaña, y que la lista por campaña sale cuando los leads llegan desde un anuncio. No le pidas la fecha.',
      ...avisoSiHay,
    });
  }
  const claves = new Set(coinciden.map((c) => c.key));
  const nombres = new Map(coinciden.map((c) => [c.key, c.nombre]));
  const deLaCampana = filas
    .filter((f) => f.key != null && claves.has(f.key) && (!op.tambien || op.tambien(f.id)))
    .map(({ key, ...f }): FilaDeCampana => ({ ...f, campana: nombres.get(key!) ?? f.campana }))
    .sort((a, b) => (b.entro ?? '').localeCompare(a.entro ?? '') || b.id - a.id);
  const resumen = coinciden.map((c) => ({ nombre: c.nombre, ...(/^\d+$/.test(c.key) ? { id: c.key } : {}), leads: c.leads }));
  if (!deLaCampana.length) {
    return JSON.stringify({
      encontrados: 0, leads: [], campanas: resumen,
      instruccion: op.tambien
        ? 'La campaña tiene leads, pero ninguno cumple los otros filtros que pediste. Dilo así.'
        : 'La campaña existe en Meta y no tiene ningún lead en el CRM. Dilo así; no le pidas la fecha.',
      ...avisoSiHay,
    });
  }
  const base = { encontrados: deLaCampana.length, por_campana: true, campanas: resumen, nota_nombre: '«nombre» trae nombre y apellido juntos, como se cargó el lead.', ...avisoSiHay };
  if (op.aPersona) {
    op.aPersona(listaParaLaPersona(coinciden, deLaCampana));
    return JSON.stringify({
      ...base, lista: 'ya_va_aparte',
      instruccion: 'La lista completa (nombre y teléfono de cada uno) se la manda el sistema debajo de tu respuesta: no la repitas ni la resumas. Dile en una línea de qué campaña son y cuántos.',
    });
  }
  const limite = Math.min(Math.max(1, Math.trunc(op.limite ?? LIMITE_POR_CAMPANA)), LIMITE_MAXIMO_POR_CAMPANA);
  const van = deLaCampana.slice(0, limite);
  return JSON.stringify({
    ...base, devueltos: van.length, omitidos: deLaCampana.length - van.length, leads: van,
    instruccion: deLaCampana.length > van.length
      ? `Pásale los ${van.length} con nombre y teléfono, y dile que faltan ${deLaCampana.length - van.length}.`
      : 'Pásale todos, con nombre y teléfono, sin cortar la lista.',
  });
}
