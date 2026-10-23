// =============================================================================
// Con qué IA corre UN chat del Ops Center del cliente (23/10/2026, feedback 8b)
// =============================================================================
// Martín: «En el Ops Center, el "+" de la caja deja elegir con qué corre ese chat: el modelo y la cuenta (Claude o GPT, y
// cuál). Por defecto decide el chat jefe, salvo que se elija otro». Hoy nada se podía forzar por pedido (docs/hallazgos-ia.md).
// El contrato, acordado con el chat IA del cliente:
//   · la caja manda `ia?: EleccionIA` en cada mensaje (null = Automático: decide el chat jefe, como siempre);
//   · la ruta lo pasa por `sanearIA` y lo valida contra las cuentas del negocio (`cuentasDeIA`, del lado del servidor, que
//     arma también las opciones de `GET ?suIA=1`); `turnoApp` lo respeta sin salir nunca de «sólo su IA».
// Puro: lo importan la caja (el selector), la ruta y los tests.
// =============================================================================

import { MODELOS_PC } from './ia-pc-reglas';

/**
 * Los modelos de SU Claude por clave: las claves de `MODELO_SU_CLAUDE` (lib/veto-claude.ts, IA5). Escritos acá y no importados:
 * el selector corre en el navegador y no tiene por qué cargar el veto entero. El test verifica que sean los mismos.
 */
export const MODELOS_SU_CLAUDE = ['haiku', 'sonnet'] as const;

/** De qué cuenta del negocio: su computadora con su Claude, su clave de Anthropic, su clave de OpenAI. */
export type CuentaIA = 'pc' | 'anthropic' | 'openai';
export const CUENTAS_IA: readonly CuentaIA[] = ['pc', 'anthropic', 'openai'];

/** Lo que eligió la persona para ESE chat. null = Automático (lo decide el chat jefe). */
export type EleccionIA = { cuenta: CuentaIA; modelo?: string } | null;

/** Los modelos que se pueden pedir por cuenta: los mismos que aceptan sus configuraciones. OpenAI, por ahora, sin elegir. */
export const MODELOS_DE_LA_CUENTA: Readonly<Record<CuentaIA, readonly string[]>> = {
  pc: MODELOS_PC,
  anthropic: MODELOS_SU_CLAUDE,
  openai: [],
};

const esCuenta = (x: unknown): x is CuentaIA => typeof x === 'string' && (CUENTAS_IA as readonly string[]).includes(x);
const aceptaModelo = (cuenta: CuentaIA, m: string): boolean =>
  MODELOS_DE_LA_CUENTA[cuenta].includes(m);

/**
 * La elección que llega del navegador, limpia: un objeto (o su JSON, en un multipart) con una cuenta conocida y, si trae
 * modelo, uno que esa cuenta acepta. Lo demás es Automático (null): nada de lo que no se conoce llega al turno.
 */
export function sanearIA(x: unknown): EleccionIA {
  let v: unknown = x;
  if (typeof v === 'string') {
    if (!v.trim() || v.length > 200) return null;
    try { v = JSON.parse(v); } catch { return null; }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const { cuenta, modelo } = v as { cuenta?: unknown; modelo?: unknown };
  if (!esCuenta(cuenta)) return null;
  if (modelo == null || modelo === '') return { cuenta };
  return typeof modelo === 'string' && aceptaModelo(cuenta, modelo) ? { cuenta, modelo } : { cuenta };
}

/** Una cuenta que se puede elegir, como la arma el servidor (`GET /api/mako/chat?suIA=1` → `cuentas`). */
export type CuentaDeIA = {
  cuenta: CuentaIA;
  /** Cómo se la nombra: «Tu computadora (Oficina)», «Tu Claude», «Tu ChatGPT». */
  nombre: string;
  /** Los modelos que se pueden pedir (vacío = el de siempre). */
  modelos: readonly string[];
  /** El que usa si no se elige. */
  modeloDefault: string | null;
  /** El crédito de Claude de la plataforma: sólo Haiku. */
  soloHaiku?: boolean;
};

/** Lo que se guarda por chat vale mientras esa cuenta (y ese modelo) se pueda elegir; si no, Automático. Sin la lista, Automático. */
export function eleccionVigente(e: EleccionIA, cuentas: readonly CuentaDeIA[] | null | undefined): EleccionIA {
  if (!e || !cuentas) return null;
  const c = cuentas.find((x) => x.cuenta === e.cuenta);
  if (!c) return null;
  if (e.modelo && !c.modelos.includes(e.modelo)) return { cuenta: e.cuenta };
  return e;
}

/** Los nombres de los modelos, como se leen. */
export const NOMBRE_MODELO_IA: Readonly<Record<string, string>> = { haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus' };

/** El renglón que dice con qué va el chat («Con tu Claude · Sonnet»); null en Automático (no hace falta decirlo). */
export function resumenDeIA(e: EleccionIA, cuentas: readonly CuentaDeIA[] | null | undefined): string | null {
  const v = eleccionVigente(e, cuentas);
  if (!v) return null;
  const c = cuentas!.find((x) => x.cuenta === v.cuenta)!;
  return `Con ${c.nombre.charAt(0).toLowerCase()}${c.nombre.slice(1)}${v.modelo ? ` · ${NOMBRE_MODELO_IA[v.modelo] ?? v.modelo}` : ''}`;
}
