// =============================================================================
// prospectos — la lista aparte de la prospección en frío (Leads Scraper)
// =============================================================================
// docs/diseno-leads-scraper.md §4: una BÚSQUEDA corre en Apify con la key del negocio, sus
// resultados caen en `prospectos` con un puntaje y su razón, y la persona pasa al CRM los que elige.
// El trabajo del scraper termina cuando el lead entra: lo que se le escribe lo decide Automations
// (§6, Martín 15/10/2026).
//
// Lo que no se ve:
//   · NO HAY UNA SEGUNDA PUERTA DE LEADS. «Pasar al CRM» arma las filas del importador y llama a
//     `importarLeadsRevisadosAction` —la misma puerta del CSV, con su chequeo de duplicados y su
//     tope—. El origen queda `importacion` («entró en un archivo: la lista en frío», el catálogo de
//     app/crm/origen-lead.ts) y la búsqueda va al historial del lead.
//   · LOS RESULTADOS SE TRAEN DOS VECES SIN DUPLICAR: el aviso de Apify (app/api/webhooks/apify) y
//     la pantalla (`revisarPendientes`) pueden llegar juntos. Los prospectos se insertan con
//     `ignoreDuplicates` sobre (workspace, fuente, id externo) —un prospecto que ya estaba conserva
//     su estado— y la búsqueda pasa a `lista` con compare-and-set: el segundo no pisa el conteo.
//   · «NO PUDE LEER» NO ES «FALLÓ»: si Apify no contesta, la búsqueda sigue `corriendo` y se vuelve
//     a preguntar; sólo un estado terminal de Apify la marca `fallo`.
//
// Corre adentro de un workspace: la pantalla (sesión) o `runWithWorkspace` (el aviso).

import 'server-only';
import { randomBytes } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { credWs } from './credenciales';
import { APP_BASE_URL } from './app-url';
import { leerTodo } from './supabase-paginado';
import { getFunnelDe, leerFunnels } from './funnels';
import { logLeadEvent } from './leads';
import { lanzarActor, leerCorrida, itemsDelDataset } from './apify';
import { hashDeRuteo } from './ruteo-hash';
import { mensajeDeError } from './calendly-error';
import {
  FUENTES_PROSPECCION, contactable, inputDelActor, leerResultados, parametrosDeBusqueda, puntuar, rotuloDeBusqueda, techoUsd,
  type FuenteProspeccion, type ParametrosBusqueda, type ProspectoNuevo,
} from './prospectos-reglas';
import type { EntradaId } from './pipeline';

const LOG = '[prospectos]';

/** El código de una tabla que no existe (la 0288 sin aplicar). */
const tablaQueFalta = (code: unknown) => code === '42P01' || code === 'PGRST205';
const MOTIVO_SIN_TABLA = 'Falta aplicar la migración 0288 (prospectos).';

export type Busqueda = {
  id: number;
  fuente: FuenteProspeccion;
  parametros: ParametrosBusqueda;
  estado: 'corriendo' | 'lista' | 'fallo';
  apify_run_id: string | null;
  resultados: number;
  nuevos: number;
  motivo: string | null;
  created_at: string;
};

export type Prospecto = ProspectoNuevo & {
  id: number;
  busqueda_id: number | null;
  puntaje: number;
  razon: string | null;
  estado: 'nuevo' | 'descartado' | 'en_crm';
  lead_id: number | null;
  created_at: string;
};

const COLS_BUSQUEDA = 'id, fuente, parametros, estado, apify_run_id, resultados, nuevos, motivo, created_at';
const COLS_PROSPECTO = 'id, busqueda_id, fuente, id_externo, nombre, empresa, email, telefono, web, instagram, ciudad, rubro, datos, puntaje, razon, estado, lead_id, created_at';

// ── Buscar ────────────────────────────────────────────────────────────────────

/**
 * Manda a correr una búsqueda en Apify con la key del negocio. Cuesta plata: quien llama ya
 * comprobó que es un admin (app/crm/prospectos/actions.ts) y mostró el techo antes.
 */
export async function crearBusqueda(crudo: unknown, autor: string | null): Promise<{ ok: true; id: number; rotulo: string; techoUsd: number } | { ok: false; error: string; conectar?: 'apify' }> {
  const p = parametrosDeBusqueda(crudo);
  if ('error' in p) return { ok: false, error: p.error };
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Elige un negocio antes de buscar.' };
  const token = await credWs('APIFY_TOKEN', ws);
  if (!token) return { ok: false, error: 'Conecta tu cuenta de Apify para buscar.', conectar: 'apify' };

  const db = await getTenantDb();
  const clave = randomBytes(24).toString('base64url');
  const { data, error } = await db.from('prospeccion_busquedas')
    .insert({ fuente: p.fuente, parametros: p, estado: 'corriendo', clave_hash: hashDeRuteo(clave), creado_por: autor })
    .select('id').single();
  if (error) return { ok: false, error: tablaQueFalta(error.code) ? MOTIVO_SIN_TABLA : `No pude guardar la búsqueda: ${error.message}` };
  const id = Number((data as { id: number }).id);

  // El aviso de vuelta lleva el id y la clave en el CUERPO (Apify no firma): el webhook busca la
  // búsqueda por id y compara el hash. `{{resource}}` es la corrida entera (su estado y su dataset).
  const aviso = { url: `${APP_BASE_URL}/api/webhooks/apify`, payloadTemplate: `{"busqueda":"${id}","clave":"${clave}","resource":{{resource}}}` };
  const techo = techoUsd(p);
  const r = await lanzarActor(token, FUENTES_PROSPECCION[p.fuente].actor, inputDelActor(p), { maxItems: p.cuantos, maxUsd: techo }, aviso);
  if (!r.ok) {
    await db.from('prospeccion_busquedas').update({ estado: 'fallo', motivo: r.error.slice(0, 300), updated_at: new Date().toISOString() }).eq('id', id);
    return { ok: false, error: r.error };
  }
  await db.from('prospeccion_busquedas').update({ apify_run_id: r.runId, updated_at: new Date().toISOString() }).eq('id', id);
  return { ok: true, id, rotulo: rotuloDeBusqueda(p), techoUsd: techo };
}

// ── Traer los resultados ─────────────────────────────────────────────────────

export type ResultadoProceso = { estado: 'corriendo' | 'lista' | 'fallo'; nuevos?: number; motivo?: string };

/**
 * Pregunta por la corrida y, si terminó, trae los resultados. Idempotente (ver el encabezado).
 * `token` es la key de Apify del workspace en curso.
 */
export async function procesarBusqueda(b: Pick<Busqueda, 'id' | 'fuente' | 'parametros' | 'estado' | 'apify_run_id'>, token: string): Promise<ResultadoProceso> {
  if (b.estado !== 'corriendo') return { estado: b.estado };
  if (!b.apify_run_id) return { estado: 'corriendo', motivo: 'todavía sin corrida' };
  const db = await getTenantDb();
  const ahora = () => new Date().toISOString();

  const c = await leerCorrida(token, b.apify_run_id);
  if ('error' in c) return { estado: 'corriendo', motivo: c.error };
  if (c.estado === 'corriendo') return { estado: 'corriendo' };
  if (c.estado === 'fallo' || !c.datasetId) {
    const motivo = `Apify terminó la búsqueda sin resultados (${c.status || 'sin estado'}).`;
    await db.from('prospeccion_busquedas').update({ estado: 'fallo', motivo, updated_at: ahora() }).eq('id', b.id).eq('estado', 'corriendo');
    return { estado: 'fallo', motivo };
  }

  const r = await itemsDelDataset(token, c.datasetId, b.parametros.cuantos);
  if ('error' in r) return { estado: 'corriendo', motivo: r.error };
  const { prospectos, descartados } = leerResultados(b.fuente, r.items);

  let nuevos = 0;
  for (let i = 0; i < prospectos.length; i += 200) {
    const filas = prospectos.slice(i, i + 200).map((p) => ({ ...p, busqueda_id: b.id, ...puntuar(p) }));
    const { data, error } = await db.from('prospectos')
      .upsert(filas, { onConflict: 'workspace_id,fuente,id_externo', ignoreDuplicates: true })
      .select('id');
    if (error) throw Object.assign(new Error(`prospectos: ${error.message}`), { code: error.code, details: error.details, hint: error.hint });
    nuevos += (data ?? []).length;
  }
  const motivo = descartados ? `${descartados} resultado${descartados === 1 ? '' : 's'} sin nombre, cerrado${descartados === 1 ? '' : 's'} o repetido${descartados === 1 ? '' : 's'}.` : null;
  await db.from('prospeccion_busquedas')
    .update({ estado: 'lista', resultados: prospectos.length, nuevos, motivo, updated_at: ahora() })
    .eq('id', b.id).eq('estado', 'corriendo');
  return { estado: 'lista', nuevos };
}

/**
 * La red de la pantalla: las búsquedas que siguen corriendo se vuelven a preguntar al abrir la
 * lista. Sirve cuando el aviso de Apify no llegó (en local nunca llega: Apify no ve localhost).
 * Topea en 3 por apertura: cada una son dos o tres pedidos a Apify.
 */
export async function revisarPendientes(): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) return 0;
  const token = await credWs('APIFY_TOKEN', ws);
  if (!token) return 0;
  const db = await getTenantDb();
  const { data, error } = await db.from('prospeccion_busquedas').select(COLS_BUSQUEDA)
    .eq('estado', 'corriendo').order('created_at', { ascending: true }).limit(3);
  if (error) return 0;
  let listas = 0;
  for (const b of (data ?? []) as Busqueda[]) {
    try {
      if ((await procesarBusqueda(b, token)).estado === 'lista') listas++;
    } catch (e) {
      console.error(`${LOG} revisarPendientes ${b.id}: ${mensajeDeError(e)}`);
    }
  }
  return listas;
}

// ── Leer ─────────────────────────────────────────────────────────────────────

export type ListaProspectos = { prospectos: Prospecto[]; busquedas: Busqueda[] } | { error: string };

/** Los prospectos del negocio (todos los estados) y las últimas búsquedas. Ordenados por puntaje. */
export async function listarProspectos(): Promise<ListaProspectos> {
  try {
    const db = await getTenantDb();
    const { data: bs, error: eb } = await db.from('prospeccion_busquedas').select(COLS_BUSQUEDA)
      .order('created_at', { ascending: false }).limit(20);
    if (eb) return { error: tablaQueFalta(eb.code) ? MOTIVO_SIN_TABLA : eb.message };
    // Se pagina por `id` (único) y se ordena por puntaje en memoria (AGENTS.md, «El techo de 1000 filas»).
    const ps = await leerTodo<Prospecto>(db, 'prospectos', COLS_PROSPECTO, { orden: 'id' });
    ps.sort((a, b) => b.puntaje - a.puntaje || b.id - a.id);
    return { prospectos: ps, busquedas: (bs ?? []) as Busqueda[] };
  } catch (e) {
    return { error: mensajeDeError(e) };
  }
}

// ── Descartar y recuperar ────────────────────────────────────────────────────

/** Descarta o vuelve a la lista. Lo que ya está en el CRM no se toca. */
export async function cambiarEstado(ids: number[], estado: 'nuevo' | 'descartado'): Promise<number> {
  const limpios = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 3000);
  if (!limpios.length) return 0;
  const db = await getTenantDb();
  const { data, error } = await db.from('prospectos').update({ estado, updated_at: new Date().toISOString() })
    .in('id', limpios).neq('estado', 'en_crm').select('id');
  if (error) throw new Error(`prospectos: ${error.message}`);
  return (data ?? []).length;
}

// ── El funnel (decisión 9) ───────────────────────────────────────────────────

/**
 * El funnel que DECLARA una entrada (`ENTRADAS`, lib/pipeline.ts). Uno solo → ése. Ninguno o
 * varios → null (el del negocio): con varios, elegir el primero sería decidir a ciegas.
 */
export async function funnelDeEntrada(entrada: EntradaId): Promise<number | null> {
  const fs = await leerFunnels();
  if (!fs?.length) return null;
  const con: number[] = [];
  for (const f of fs) {
    try {
      if ((await getFunnelDe(f.id)).entradas.includes(entrada)) con.push(f.id);
    } catch { /* un funnel que no se pudo leer no cuenta */ }
  }
  return con.length === 1 ? con[0] : null;
}

// ── Pasar al CRM ─────────────────────────────────────────────────────────────

/** `omitidos`: los que el importador no creó porque ya estaban en el CRM (se quedan «por revisar»). */
export type ResultadoPasar = { creados: number; enriquecidos: number; omitidos: number; sinContacto: number; errores: string[] };

/**
 * Pasa los prospectos elegidos al CRM por la puerta del importador. Los que no tienen email ni
 * teléfono no van (la regla del importador: «sin-contacto»), y se cuentan.
 *
 * ⚠️ UN PROSPECTO QUE YA ESTÁ EN EL CRM NO SE DUPLICA NI SE COMPLETA: el importador vuelve a buscar
 * duplicados en el server, y una fila cuyo «ya existe» la pantalla no mostró entra DESTILDADA
 * (`vioDuplicado`, app/crm/actions.ts). Vuelve como `omitidos` y el prospecto se queda «por revisar».
 *
 * `importar` es `importarLeadsRevisadosAction` (app/crm/actions.ts), inyectada por quien llama:
 * así este módulo no importa un archivo `'use server'` de app/ y el test la puede reemplazar.
 */
export async function pasarAlCrm(
  ids: number[],
  funnelId: number | null,
  importar: (filas: Array<{ id: string; nombre: string; email: string; telefono: string; empresa: string; incluir: boolean; yaExiste: boolean }>, funnelId?: number | null) => Promise<{ creados: number; enriquecidos: number; omitidos: number; errores: string[]; ids?: Array<{ filaId: string; leadId: number; destino: 'crear' | 'enriquecer' }> }>,
): Promise<ResultadoPasar> {
  const limpios = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 3000);
  if (!limpios.length) return { creados: 0, enriquecidos: 0, omitidos: 0, sinContacto: 0, errores: ['No elegiste ningún prospecto.'] };
  const db = await getTenantDb();
  const { data, error } = await db.from('prospectos').select(COLS_PROSPECTO).in('id', limpios).eq('estado', 'nuevo');
  if (error) return { creados: 0, enriquecidos: 0, omitidos: 0, sinContacto: 0, errores: [tablaQueFalta(error.code) ? MOTIVO_SIN_TABLA : error.message] };
  const elegidos = (data ?? []) as Prospecto[];
  const van = elegidos.filter(contactable);
  const sinContacto = elegidos.length - van.length;
  if (!van.length) return { creados: 0, enriquecidos: 0, omitidos: 0, sinContacto, errores: [] };

  const filas = van.map((p) => ({
    id: `p${p.id}`, nombre: p.nombre, email: p.email ?? '', telefono: p.telefono ?? '', empresa: p.empresa ?? '',
    incluir: true, yaExiste: false,
  }));
  const r = await importar(filas, funnelId);

  // Lo que entró: el prospecto queda atado a su lead, y la búsqueda va al historial.
  const busquedas = new Map<number, string>();
  const { data: bs } = await db.from('prospeccion_busquedas').select('id, parametros')
    .in('id', [...new Set(van.map((p) => p.busqueda_id).filter((x): x is number => x != null))]);
  for (const b of (bs ?? []) as Array<{ id: number; parametros: ParametrosBusqueda }>) busquedas.set(b.id, rotuloDeBusqueda(b.parametros));
  const porFila = new Map(van.map((p) => [`p${p.id}`, p]));
  for (const x of r.ids ?? []) {
    const p = porFila.get(x.filaId);
    if (!p) continue;
    await db.from('prospectos').update({ estado: 'en_crm', lead_id: x.leadId, updated_at: new Date().toISOString() }).eq('id', p.id);
    const de = p.busqueda_id != null ? busquedas.get(p.busqueda_id) : null;
    await logLeadEvent(x.leadId, 'Prospección', `Vino de una búsqueda de prospectos${de ? `: ${de}` : ''} (puntaje ${p.puntaje}).`, 'MaKo');
  }
  return { creados: r.creados, enriquecidos: r.enriquecidos, omitidos: r.omitidos, sinContacto, errores: r.errores };
}
