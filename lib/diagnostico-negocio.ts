// =============================================================================
// diagnostico-negocio — de qué negocio habla Martín cuando pide DEBUGUEAR algo desde el grupo de SuperAdmin (sin base: puro)
// =============================================================================
// Martín, 29/10/2026: le reenvió a MaKo la consulta de un cliente («Che Tincho… pegué el token del pixel… conectar Facebook no me
// hace nada») y MaKo le contestó a ÉL un consejo genérico. Tenía que mirar con datos qué tiene conectado ESE negocio. Hasta acá
// ninguna herramienta podía leer otro negocio: todas usan el del grupo (`ctx.ws`). `diagnosticar_negocio` (área operaciones, sólo
// la plataforma) lo lee; esto decide CUÁL es, por su número o su nombre, sin adivinar entre dos.
// =============================================================================

import { taparClaves } from './claves-en-el-chat';

export type NegocioConocido = { ws: number; nombre: string };

const norm = (s: string): string => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** Las palabras que no dicen de quién es: «el negocio de Leila», «la cuenta de Joan». */
const RELLENO = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'negocio', 'cuenta', 'workspace', 'ws', 'cliente', 'grupo', 'mi', 'su', 'y']);

/**
 * Los 2 o 3 HECHOS del diagnóstico que MaKo dice en el grupo (29/10/2026, el DEBUG se delega al Cerebro con la evidencia entera en el
 * ticket): la conexión de Meta, la IA, lo que falta conectar y los errores de 7 días. Sólo lo que dice la lectura: sin dato, no va.
 */
export function hechosDelDiagnostico(d: unknown): string[] {
  if (!d || typeof d !== 'object') return [];
  const o = d as Record<string, unknown>;
  const hechos: string[] = [];
  const meta = o.meta as { via?: unknown; cuenta_elegida?: unknown; error?: unknown } | undefined;
  if (meta && typeof meta === 'object') {
    if (meta.via === 'sin_conexion') hechos.push('Meta sin conectar');
    else if (meta.via === 'conexion_anterior') hechos.push('Meta con la conexión anterior (el token), no por Facebook/Zernio');
    else if (meta.via === 'conexion_de_facebook') hechos.push(`Meta conectada por Facebook (Zernio)${meta.cuenta_elegida ? '' : ', sin cuenta publicitaria elegida'}`);
    // El texto del proveedor, sin claves (la revisión de privacidad, B3): puede traer un token o una URL firmada.
    if (typeof meta.error === 'string' && meta.error) hechos.push(`Meta da error: ${taparClaves(meta.error).texto.slice(0, 120)}`);
  }
  const ints = (o.integraciones as { integraciones?: unknown } | unknown[] | undefined);
  const lista = Array.isArray(ints) ? ints : Array.isArray((ints as { integraciones?: unknown })?.integraciones) ? (ints as { integraciones: unknown[] }).integraciones : [];
  const faltan = lista.filter((i) => (i as { estado?: unknown })?.estado === 'falta').map((i) => String((i as { nombre?: unknown }).nombre ?? '')).filter(Boolean);
  if (faltan.length) hechos.push(`le falta conectar: ${faltan.slice(0, 4).join(', ')}${faltan.length > 4 ? '…' : ''}`);
  const errores = o.errores_7_dias;
  if (Array.isArray(errores) && errores.length) hechos.push(`${errores.length} error${errores.length === 1 ? '' : 'es'} de la app en 7 días (el último: «${String((errores[0] as { titulo?: unknown }).titulo ?? '').slice(0, 80)}»)`);
  return hechos.slice(0, 3);
}

/**
 * Los negocios que puede ser `pedido`: por número («11», «ws11»), por el nombre entero, o porque TODAS las palabras del pedido
 * (de 3 letras o más) están en su nombre («Leila» → «Leila Fittipaldi | Metacoach»). Más de uno: el que llama pregunta cuál.
 */
export function buscarNegocio(pedido: string, negocios: readonly NegocioConocido[]): NegocioConocido[] {
  const num = /^\s*(?:ws\s*)?(\d{1,6})\s*$/i.exec(pedido || '');
  if (num) return negocios.filter((n) => n.ws === Number(num[1]));
  const p = norm(pedido);
  if (!p) return [];
  const exacto = negocios.filter((n) => norm(n.nombre) === p);
  if (exacto.length) return exacto;
  const palabras = p.split(' ').filter((w) => w.length >= 3 && !RELLENO.has(w));
  if (!palabras.length) return [];
  return negocios.filter((n) => {
    const nombre = ` ${norm(n.nombre)} `;
    return palabras.every((w) => nombre.includes(` ${w}`));
  });
}
