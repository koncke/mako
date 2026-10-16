// =============================================================================
// bandeja-filas — cómo se arma una fila de las bandejas de MaKo, en el SERVER
// =============================================================================
// Lo leen DOS pantallas que muestran lo mismo: la bandeja de escritorio
// (/mako/pendientes y /mako/revisar/[id]) y el Inbox del teléfono (lib/inbox-movil.ts).
// Vivía adentro de las dos páginas, sin exportar; se mudó acá para que el teléfono no
// fuera la segunda copia (11/10/2026, MaKo Mobile). Comportamiento idéntico: es el
// mismo código, movido.
//
// ⚠️ `server-only` A PROPÓSITO: lee el registro de la API de MaKo (`porId`), que no
// puede viajar al navegador (tests/api-mako-registro.test.ts lo prohíbe en un
// 'use client'). El cliente recibe la fila PLANA que sale de acá.
// =============================================================================

import 'server-only';
import { etiquetaDeCanal } from '@/lib/api-mako/canal';
import { porId } from '@/lib/api-mako/registro';
import { esAccion, type Parametro } from '@/lib/api-mako/tipos';
import type { Pendiente } from '@/lib/mako-pendientes';
import type { FilaPendiente } from '@/app/mako/pendientes/BandejaPendientes';

/** Hora local del workspace, corta. La ISO cruda no le dice a nadie «vence en 40 min». */
export function fmtHora(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz });
  } catch {
    return iso;
  }
}

export function enCuanto(iso: string): string {
  const min = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (!Number.isFinite(min) || min <= 0) return 'vence ahora';
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `en ${h} h ${resto} min` : `en ${h} h`;
}

/** Una pendiente `chat` como fila plana: la operación, qué escribe y si se deshace,
 *  todo resuelto acá con el registro. */
export function aFila(p: Pendiente, tz: string): FilaPendiente {
  const def = porId(p.tipo);
  const accion = def && esAccion(def) ? def : null;
  return {
    id: p.id,
    resumen: p.resumen,
    origen: etiquetaDeCanal(p.grupoJid),
    operacion: def?.titulo ?? p.tipo,
    escribe: accion?.escribe ?? null,
    reversible: accion ? accion.reversible : null,
    vence: `${fmtHora(p.venceAt, tz)} (${enCuanto(p.venceAt)})`,
    creada: fmtHora(p.createdAt, tz),
    payload: p.payload,
  };
}

/** Un parámetro sin nada que no viaje bien al cliente (el `ejemplo` es `unknown`). */
export function plano(p: Parametro): Parametro {
  return {
    nombre: p.nombre, tipo: p.tipo, descripcion: p.descripcion,
    ...(p.obligatorio ? { obligatorio: true } : {}),
    ...(p.enum ? { enum: [...p.enum] } : {}),
    ...(p.max != null ? { max: p.max } : {}),
    ...(p.entero ? { entero: true as const } : {}),
    ...(p.fijoAlRevisar ? { fijoAlRevisar: true as const } : {}),
    ...(p.minimo != null ? { minimo: p.minimo } : {}),
    ...(p.maximo != null ? { maximo: p.maximo } : {}),
    ...(p.campos ? { campos: p.campos.map(plano) } : {}),
  };
}
