// =============================================================================
// Los pedidos del Copywriter al server (POST /api/copywriter) — sin 'use client', a propósito
// =============================================================================
// El molde y las reglas son los del Web Generator (app/web-generator/cliente.ts, `postJson`): nunca tiran, manda el `ok`
// del cuerpo, todo pedido lleva un plazo del navegador y el `?ws=` lo pega solo el parche de fetch. Sin 'use client'
// para que el teléfono (app/m/copywriter) y la pantalla de escritorio lo usen igual (AGENTS.md, «'use client' es una
// frontera de DATOS»).
// =============================================================================

import { postJson, type FallaPedido } from '@/app/web-generator/cliente';
import type { EditadoPor, GuionAbierto, JsonNodo, PaginaCopy, PropsGuion, TipoGuion } from '@/lib/copywriter/tipos';
import type { OutlierCopy } from '@/lib/copywriter/outliers';
import { marcarRecienCreada } from './pedido-guardado';

export const RUTA_COPY = '/api/copywriter';
/** /api/copywriter no llama a ninguna IA: lo que tarda es la base. */
export const PLAZO_COPY_MS = 30_000;

export type FallaCopy = FallaPedido & { conflicto?: boolean };

export function pedirListar() {
  return postJson<{ ok: true; paginas: PaginaCopy[] }>(RUTA_COPY, { accion: 'listar' }, PLAZO_COPY_MS) as Promise<{ ok: true; paginas: PaginaCopy[] } | FallaCopy>;
}

export function pedirAbrir(id: string) {
  return postJson<{ ok: true } & GuionAbierto>(RUTA_COPY, { accion: 'abrir', id }, PLAZO_COPY_MS) as Promise<({ ok: true } & GuionAbierto) | FallaCopy>;
}

export async function pedirCrear(p: { tipo: TipoGuion; titulo?: string; padre?: string | null; posicion?: number; props?: Partial<PropsGuion>; contenido?: JsonNodo; emoji?: string | null }) {
  const r = await (postJson<{ ok: true; paginas: PaginaCopy[] } & GuionAbierto>(RUTA_COPY, { accion: 'crear', ...p }, PLAZO_COPY_MS) as Promise<({ ok: true; paginas: PaginaCopy[] } & GuionAbierto) | FallaCopy>);
  // Recién creada: su chat está vacío y el panel no lo espera (./pedido-guardado.ts → marcarRecienCreada).
  if (r.ok) marcarRecienCreada(r.pagina.id);
  return r;
}

/** Lo que contesta un guardado: la versión nueva y la marca de quién guardó (D9). */
export type RespGuardar = { ok: true; version: number; actualizado: string; editado?: EditadoPor | null } | FallaCopy;

/** Lo que manda el editor al guardar. Quién lo recibe lo decide quien monta el editor: la tab o un link compartido. */
export type CambioGuion = { version: number; contenido?: JsonNodo; props?: PropsGuion };
export type GuardarGuion = (c: CambioGuion, keepalive: boolean) => Promise<RespGuardar>;

export function pedirGuardar(p: { id: string } & CambioGuion, keepalive = false): Promise<RespGuardar> {
  return postJson(RUTA_COPY, { accion: 'guardar', ...p }, keepalive ? { keepalive: true } : PLAZO_COPY_MS) as Promise<RespGuardar>;
}

type Arbol = Promise<{ ok: true; paginas: PaginaCopy[] } | FallaCopy>;

export function pedirRenombrar(id: string, c: { titulo?: string; emoji?: string | null }): Arbol {
  return postJson(RUTA_COPY, { accion: 'renombrar', id, ...c }, PLAZO_COPY_MS) as Arbol;
}
export function pedirMover(id: string, padre: string | null, posicion: number): Arbol {
  return postJson(RUTA_COPY, { accion: 'mover', id, padre, posicion }, PLAZO_COPY_MS) as Arbol;
}
export function pedirPapelera(id: string): Arbol {
  return postJson(RUTA_COPY, { accion: 'papelera', id }, PLAZO_COPY_MS) as Arbol;
}
export function pedirRestaurar(id: string): Arbol {
  return postJson(RUTA_COPY, { accion: 'restaurar', id }, PLAZO_COPY_MS) as Arbol;
}

/** Los archivos de El Archivero que se pueden citar con «@» (id y nombre). */
export function pedirCitables() {
  return postJson<{ ok: true; archivos: { id: string; nombre: string }[] }>(RUTA_COPY, { accion: 'citables' }, PLAZO_COPY_MS) as Promise<{ ok: true; archivos: { id: string; nombre: string }[] } | FallaCopy>;
}

// ── Un guion abierto con un link para EDITAR (D9) ─────────────────────────────────────────────────────────────────
// El token del link es la credencial entera y viaja en el CUERPO, nunca en la URL (lib/rutas-publicas.ts,
// PUBLICOS_ESCRITURA). El id del guion NO viaja: lo saca el server del link. `nombre` es el que escribió quien entró
// con el link abierto (la marca de quién editó); con un link personal de invitado no se usa.
export const RUTA_COMPARTIDO = '/api/compartido/guion';

export function pedirGuardarCompartido(token: string, nombre: string, c: CambioGuion, keepalive = false): Promise<RespGuardar> {
  const cuerpo = { accion: 'guardar', token, nombre, version: c.version, ...(c.contenido ? { contenido: c.contenido } : {}) };
  return postJson(RUTA_COMPARTIDO, cuerpo, keepalive ? { keepalive: true } : PLAZO_COPY_MS) as Promise<RespGuardar>;
}

export function pedirTituloCompartido(token: string, nombre: string, titulo: string) {
  return postJson<{ ok: true }>(RUTA_COMPARTIDO, { accion: 'titulo', token, nombre, titulo }, PLAZO_COPY_MS) as Promise<{ ok: true } | FallaCopy>;
}

// ── Los outliers de copy (D18) ──────────────────────────────────────────────────────────────────────────────────

/** «Replicar»: la página nueva que replica el outlier (vacía; la escribe MaKo cuando la persona elige la oferta). */
export async function pedirReplicar(outlier: string) {
  const r = await (postJson<{ ok: true; paginas: PaginaCopy[] } & GuionAbierto>(RUTA_COPY, { accion: 'replicar', outlier }, PLAZO_COPY_MS) as Promise<({ ok: true; paginas: PaginaCopy[] } & GuionAbierto) | FallaCopy>);
  if (r.ok) marcarRecienCreada(r.pagina.id);
  return r;
}

/** El original entero de un outlier («Ver el original» de la página replicada). */
export function pedirOriginal(outlier: string) {
  return postJson<{ ok: true; outlier: OutlierCopy }>(RUTA_COPY, { accion: 'outlier', outlier }, PLAZO_COPY_MS) as Promise<{ ok: true; outlier: OutlierCopy } | FallaCopy>;
}

/** Las rutas de la tab (escritorio): un guion se abre en /copywriter/<id>. */
export const rutaGuion = (id: string) => `/copywriter/${id}`;
