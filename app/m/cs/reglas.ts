// =============================================================================
// /m/cs — las reglas PURAS de Customer Success en el teléfono (sin server-only, sin React)
// =============================================================================
// El kanban de la ENTREGA de escritorio (app/customer-success/KanbanEntrega.tsx) como lista
// agrupada: una sección por etapa, cada cliente en la suya. Lo lee el componente cliente; vive
// aparte para poder ejecutarlo solo.
//
// ⚠️ NINGUNA REGLA SE ESCRIBE DE NUEVO ACÁ: se COMPONEN las de escritorio.
//   · en qué columna cae cada uno → `repartirEnEtapas` (lib/servicio-etapas.ts): sin fila, la
//     PRIMERA; con una etapa que el catálogo ya no tiene, huérfano.
//   · hace cuánto y desde cuándo es «sin moverse» → `tiempoEnEtapa` (app/customer-success/en-etapa.ts),
//     con el MISMO umbral que el kanban y la tabla (`DIAS_TRABADO`).
//   · el orden de una columna → `ordenarManual` (app/customer-success/orden-manual.ts): el orden que
//     se arrastró en escritorio, y los que la lista no nombra después, por nombre.
// Quiénes son de cada servicio (`esDelProducto`) lo decide el server antes de mandar la lista.
//
// ⚠️ LA CUENTA ES SOBRE LA CARTERA ENTERA DEL SERVICIO, NUNCA SOBRE LAS FILAS de
// `cliente_entrega`: un cliente que nunca se movió no tiene fila y está en la primera etapa
// (la regla del reparto). Contar filas dejaría la primera etapa en cero con catorce clientes
// adentro.
//
// Imports RELATIVOS a propósito (como app/customer-success/pertenencia.ts): así `node --import tsx`
// lo ejecuta sin resolver el alias `@/`.
// =============================================================================

import { repartirEnEtapas, type EtapaEntrega } from '../../../lib/servicio-etapas';
import { tiempoEnEtapa } from '../../customer-success/en-etapa';
import { ordenarManual } from '../../customer-success/orden-manual';

/**
 * Una columna de la entrega, TAL CUAL la lee escritorio (el teléfono dibuja `key` y `label`).
 * Viaja entera y no recortada: `repartirEnEtapas` pide la forma del catálogo, y un recorte
 * obligaría a castear la entrada de la regla compartida.
 */
export type EtapaCs = EtapaEntrega;

/** Dónde está un cliente en ESE servicio: la fila de `cliente_entrega` (o lo movido en la sesión). */
export type FilaCs = { etapa: string; desde: string | null };

/** El curso de un cliente en ESE servicio: a qué email sale y si ya se le mandó una vez. */
export type CursoCs = { email: string; reenviar: boolean };

/** Un servicio que se entrega, ya filtrado para este workspace por el server. */
export type ServicioCs = {
  id: number;
  nombre: string;
  etapas: EtapaCs[];
  /** Los clientes de ESTE servicio (su casa o una fila acá): `esDelProducto`, calculado en el server. */
  miembros: number[];
  /** lead → su fila. Ausente = no tiene fila (está en la primera etapa). */
  filas: Record<number, FilaCs>;
  /** El orden manual de cada columna (mig 0196): etapa → leads en el orden arrastrado. */
  orden: Record<string, number[]>;
  /** lead → su invitación al curso. `null` = este servicio no tiene curso (o no se pudo leer). */
  curso: Record<number, CursoCs> | null;
};

/** Lo de cada cliente que el teléfono dibuja. */
export type ClienteCs = {
  id: number;
  nombre: string;
  empresa: string | null;
  /** A dónde lleva «Escribirle por WhatsApp»: el chat de /m/crm o wa.me. `null` = sin número. */
  wa: string | null;
};

/**
 * Lo movido en esta sesión, encima de lo que trajo el server: `${producto}:${lead}` → la fila.
 * `null` = se le borró la fila (el deshacer de su primer movimiento): vuelve a la primera etapa.
 * Ausente = no se tocó.
 */
export type MovidosCs = Record<string, FilaCs | null>;

export const claveMov = (productoId: number, leadId: number): string => `${productoId}:${leadId}`;

/** La asignación del servicio con lo movido encima (el overlay de ClientesApp, `asignacionDe`). */
export function asignacionCon(s: ServicioCs, movs: MovidosCs): Record<number, FilaCs> {
  const out: Record<number, FilaCs> = { ...s.filas };
  const pre = `${s.id}:`;
  for (const [k, v] of Object.entries(movs)) {
    if (!k.startsWith(pre)) continue;
    const lead = Number(k.slice(pre.length));
    if (v === null) delete out[lead];
    else out[lead] = v;
  }
  return out;
}

/** Una sección de la pantalla: una etapa (o «Etapa borrada») con sus clientes en orden. */
export type GrupoCs = { key: string; label: string; ids: number[]; borrada: boolean };

/** La clave del grupo de los huérfanos. No choca con una etapa: las claves son [a-z0-9_]. */
export const GRUPO_BORRADA = '~borrada';

/**
 * Las secciones, en el orden de las etapas. Una etapa sin nadie EXISTE (con 0): «nadie acá» no
 * es lo mismo que «no está». Los huérfanos (una etapa que el catálogo ya no tiene) van al final
 * en «Etapa borrada», que es como los agrupa la tabla de escritorio: el kanban los nombra en un
 * aviso, y en el teléfono una fila es lo que deja abrirlos y moverlos.
 */
export function gruposDe(s: ServicioCs, asig: Record<number, FilaCs>, nombreDe: (id: number) => string): GrupoCs[] {
  const porNombre = [...s.miembros].sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es') || a - b);
  const { porEtapa, huerfanos } = repartirEnEtapas(s.etapas, porNombre, (id) => asig[id]?.etapa);
  const grupos: GrupoCs[] = s.etapas.map((e) => ({
    key: e.key,
    label: e.label,
    ids: ordenarManual(porEtapa[e.key] ?? [], (id) => id, () => e.key, (k) => s.orden[k]),
    borrada: false,
  }));
  if (huerfanos.length) grupos.push({ key: GRUPO_BORRADA, label: 'Etapa borrada', ids: huerfanos, borrada: true });
  return grupos;
}

/**
 * En qué etapa está, con la regla del reparto: sin fila, la primera. `null` = está en una etapa
 * que ya no existe (huérfano) o el servicio no tiene etapas.
 */
export function etapaDe(s: ServicioCs, asig: Record<number, FilaCs>, leadId: number): string | null {
  const k = (asig[leadId]?.etapa ?? '').trim() || (s.etapas[0]?.key ?? '');
  return s.etapas.some((e) => e.key === k) ? k : null;
}

/** La etapa que sigue a `actual`. `null` = es la última, o no está en ninguna. */
export function siguienteEtapa(etapas: readonly EtapaCs[], actual: string | null): EtapaCs | null {
  if (actual == null) return null;
  const i = etapas.findIndex((e) => e.key === actual);
  return i >= 0 ? etapas[i + 1] ?? null : null;
}

/**
 * El riel de la fila: «hace 3 días», o «21 días sin moverse» con el punto rojo. `null` = no hay
 * dato (nunca se movió, o una fecha ilegible): inventar un «recién» sería afirmar algo que nadie
 * midió (la regla de `tiempoEnEtapa`).
 */
export function tiempoDe(fila: FilaCs | undefined, ahora: number = Date.now()): { texto: string; trabado: boolean } | null {
  const t = tiempoEnEtapa(fila?.desde ?? null, ahora);
  if (!t) return null;
  return t.trabado ? { texto: `${t.corto} sin moverse`, trabado: true } : { texto: t.frase, trabado: false };
}
