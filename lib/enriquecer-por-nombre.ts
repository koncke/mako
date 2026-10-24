// =============================================================================
// Completar leads por su nombre: la web y el Instagram, con la clave de Apify del NEGOCIO
// =============================================================================
// El escalón 2 de la base de venta (24/10/2026): para los leads que no tienen perfil de empresa en WhatsApp. Lo llama el
// CRM con una lista de leads; las reglas (qué se busca, cuándo un lugar ES el lead) viven en lib/enriquecer-reglas.ts.
//
// Dos pasos y sin tabla propia, como un trabajo que el CRM sigue:
//   1. `empezarEnriquecimiento(pedidos)` lanza UNA corrida de Apify para toda la tanda y devuelve su `runId`.
//   2. `resultadoEnriquecimiento(runId, pedidos)` contesta «corriendo» hasta que termina, y ahí empareja.
// Quien llama guarda los pedidos entre un paso y el otro (los ids son SUYOS: vuelven tal cual).
//
// ⚠️ CUESTA PLATA, y la paga el negocio: la clave es SU `APIFY_TOKEN` (como la prospección), nunca una nuestra. Quien
// llama verifica que la persona sea admin ANTES de llamar (la regla de la casa: lo que cuesta plata es del admin). La
// corrida va con techo (`techoEnriquecer`): Apify corta ahí aunque los precios cambien.
//
// ⚠️ NADA SE ESCRIBE ACÁ. Devuelve lo encontrado con su confianza y el nombre del lugar; escribirlo en la ficha es del
// CRM, por su camino (completar sin pisar lo cargado).

import 'server-only';
import { getWorkspaceActual } from './workspace';
import { credWs } from './credenciales';
import { lanzarActor, leerCorrida, itemsDelDataset } from './apify';
import {
  ACTOR_ENRIQUECER, POR_CONSULTA, emparejar, inputEnriquecer, pedidosValidos, techoEnriquecer,
  type Hallazgo, type PedidoEnriquecer,
} from './enriquecer-reglas';

export const SIN_APIFY = 'Conecta tu cuenta de Apify en Integraciones para buscar la web y el Instagram de tus leads.';

async function tokenDelNegocio(): Promise<string | null> {
  const ws = await getWorkspaceActual();
  if (ws == null) return null;
  return (await credWs('APIFY_TOKEN', ws))?.trim() || null;
}

export async function empezarEnriquecimiento(pedidos: readonly PedidoEnriquecer[]): Promise<
  { ok: true; runId: string; cantidad: number; techoUsd: number } | { ok: false; error: string }
> {
  const validos = pedidosValidos(pedidos);
  if (!validos.length) return { ok: false, error: 'Ningún lead tiene un nombre ni un teléfono para buscar.' };
  const token = await tokenDelNegocio();
  if (!token) return { ok: false, error: SIN_APIFY };
  const techoUsd = techoEnriquecer(validos.length);
  const r = await lanzarActor(token, ACTOR_ENRIQUECER, inputEnriquecer(validos), { maxItems: validos.length * POR_CONSULTA, maxUsd: techoUsd }, null);
  return r.ok ? { ok: true, runId: r.runId, cantidad: validos.length, techoUsd } : { ok: false, error: r.error };
}

export async function resultadoEnriquecimiento(runId: string, pedidos: readonly PedidoEnriquecer[]): Promise<
  { estado: 'corriendo' } | { estado: 'lista'; hallazgos: Hallazgo[] } | { estado: 'fallo'; error: string }
> {
  const token = await tokenDelNegocio();
  if (!token) return { estado: 'fallo', error: SIN_APIFY };
  const c = await leerCorrida(token, runId);
  // «No pude leer» no es «falló»: se sigue preguntando.
  if ('error' in c) return { estado: 'corriendo' };
  if (c.estado === 'corriendo') return { estado: 'corriendo' };
  if (c.estado === 'fallo' || !c.datasetId) return { estado: 'fallo', error: `La búsqueda terminó sin resultados (${c.status || 'sin estado'}).` };
  const validos = pedidosValidos(pedidos);
  const d = await itemsDelDataset(token, c.datasetId, validos.length * POR_CONSULTA);
  if ('error' in d) return { estado: 'fallo', error: d.error };
  return { estado: 'lista', hallazgos: emparejar(validos, d.items) };
}
