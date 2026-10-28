// =============================================================================
// Los pedidos del Copywriter al server (POST /api/copywriter) — sin 'use client', a propósito
// =============================================================================
// El molde y las reglas son los del Web Generator (app/web-generator/cliente.ts, `postJson`): nunca tiran, manda el `ok`
// del cuerpo, todo pedido lleva un plazo del navegador y el `?ws=` lo pega solo el parche de fetch. Sin 'use client'
// para que el teléfono (app/m/copywriter) y la pantalla de escritorio lo usen igual (AGENTS.md, «'use client' es una
// frontera de DATOS»).
// =============================================================================

import { postJson, type FallaPedido } from '@/app/web-generator/cliente';
import type { GuionAbierto, JsonNodo, PaginaCopy, PropsGuion, TipoGuion } from '@/lib/copywriter/tipos';

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

export function pedirCrear(p: { tipo: TipoGuion; titulo?: string; padre?: string | null; posicion?: number; props?: Partial<PropsGuion>; contenido?: JsonNodo; emoji?: string | null }) {
  return postJson<{ ok: true; paginas: PaginaCopy[] } & GuionAbierto>(RUTA_COPY, { accion: 'crear', ...p }, PLAZO_COPY_MS) as Promise<({ ok: true; paginas: PaginaCopy[] } & GuionAbierto) | FallaCopy>;
}

export function pedirGuardar(p: { id: string; version: number; contenido?: JsonNodo; props?: PropsGuion }, keepalive = false) {
  return postJson<{ ok: true; version: number; actualizado: string }>(RUTA_COPY, { accion: 'guardar', ...p }, keepalive ? { keepalive: true } : PLAZO_COPY_MS) as Promise<{ ok: true; version: number; actualizado: string } | FallaCopy>;
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

/** Las rutas de la tab (escritorio): un guion se abre en /copywriter/<id>. */
export const rutaGuion = (id: string) => `/copywriter/${id}`;
