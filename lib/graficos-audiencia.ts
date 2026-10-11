// =============================================================================
// graficos-audiencia — la vieja «Audiencia y alcance» de Marketing, como conjunto del Dashboard
// =============================================================================
// EN VIVO de la API de Meta (no está en la base). UNA lectura por desglose —región (`region`),
// plataforma (`publisher_platform`), o edad y género JUNTOS (`age,gender`)— y se devuelve SÓLO
// la del desglose pedido: son tres universos, y juntas un gráfico por región sumaría también las
// filas de edad y de plataforma (las impresiones, triplicadas). Sin Meta conectada tira
// `SinConexionError`, y su mensaje llega tal cual a la tarjeta.
//
// La lectura (credenciales, paginado, caché) vive en lib/meta-desgloses.ts. Acá vive cómo se LEE
// una fila de Meta, y lo comparte con /api/account-insights (el resumen del Ads Manager): la
// agenda es la misma acción en los dos lados, escrita una vez.
//
// ⚠️ SIN `server-only` A PROPÓSITO, y por eso lo de Meta se importa ADENTRO de `filasAudiencia`
// (`await import`): el armado de filas es puro y necesita test, y un módulo con `server-only` no
// lo importa ningún test. La frontera sigue en pie: si un `'use client'` importara este módulo,
// su bundle arrastraría lib/meta-desgloses.ts, que lleva `server-only`, y el build se cae.
//
// Medido el 11/10/2026 contra la cuenta del ws1 (Graph v25.0, del 14/07 al 11/10):
//   · Con `breakdowns=region` Meta NO manda ninguna conversión de afuera de Meta: ni
//     `offsite_conversion.fb_pixel_custom` (la agenda) ni `landing_page_view`, en 0 de 33 filas.
//     Con plataforma y con edad y género sí: 100 agendas en las dos, las mismas que sin desglose.
//     Así que una fila de región NO trae `agendas`: no es un cero, es algo que Meta no da.
//   · Las regiones llegan con el nombre de Meta, a veces en inglés: «State of Mexico», «Distrito
//     Federal», «Coahuila de Zaragoza», «San Luis Potosi» (sin tilde) y «Unknown». Van tal cual;
//     el mapa las ubica con su diccionario (app/dashboard/MapaMexico.tsx).
//   · Plataformas: facebook, instagram, audience_network, messenger, whatsapp y unknown.
//   · Edad «Unknown» y género «unknown» son «(sin dato)».
//   · Un período que arranca a más de 37 meses de hoy es un ERROR de Meta (#3018), no un recorte.

import { SinConexionError, type Fila } from './graficos-agregar';
import type { Rango } from './graficos-lectura';
import type { Desglose, FilaInsights } from './meta-desgloses';

/** La acción con la que se cuenta una agenda, la misma que contaba la ruta vieja: el evento custom del Pixel. */
export const ACCION_AGENDA = 'offsite_conversion.fb_pixel_custom';

/** Qué lectura de Meta contesta cada dimensión del conjunto `audiencia` (lib/graficos-catalogo.ts). */
const LECTURA: Record<string, Desglose> = { region: 'region', plataforma: 'publisher_platform', edad: 'age,gender', genero: 'age,gender' };

/**
 * La lectura de una dimensión (y su desglose). Lo que no es una dimensión del conjunto —un cuadro
 * de resultados no tiene— va por edad y género: es la que trae TODO (también las agendas, que con
 * región no vienen) y suma el total de la cuenta.
 */
export function lecturaDe(dimension: string | null, desglose: string | null = null): Desglose {
  return LECTURA[dimension ?? ''] ?? LECTURA[desglose ?? ''] ?? 'age,gender';
}

/**
 * Desde cuándo se puede pedir: Meta guarda 37 meses y un `since` más viejo es un error (#3018,
 * medido el 11/10/2026: «cannot be beyond 37 months from the current date»; desde 2023-09-12
 * contestó bien). Se pide desde ahí, con dos días de margen por la zona de la cuenta: más atrás
 * no hay nada que traer, así que el total es el de todo lo que Meta tiene.
 */
export function desdeQueGuardaMeta(desde: string, hoy: string): string {
  const [y, m, d] = hoy.split('-').map(Number);
  const tope = new Date(Date.UTC(y, m - 1 - 37, d + 2)).toISOString().slice(0, 10);
  return desde < tope ? tope : desde;
}

/** Lo que se le puede inyectar a `filasAudiencia` en un test. En producción no se pasa nada. */
export type DepsAudiencia = {
  leer?: (p: { desde: string; hasta: string; breakdown: Desglose }) => Promise<FilaInsights[]>;
  aUsd?: (monto: number) => number;
  hoy?: string;
};

const motivoDe = (e: unknown): string | null => {
  const m = e && typeof e === 'object' ? (e as { motivo?: unknown }).motivo : null;
  return typeof m === 'string' ? m : null;
};

/**
 * Una Fila por grupo del desglose pedido: `f` = el desde del período, `d` con la dimensión (y las
 * dos en edad y género), `v` con impresiones, alcance, clics, agendas y gasto en dólares.
 *
 * ⚠️ `filasDeDesglose` va DEBAJO de esta función, y no arriba: el guard de tests/graficos.test.ts
 * («el lector llena cada métrica…») lee el cuerpo del lector hasta la próxima `async function`.
 */
export async function filasAudiencia(dimension: string, desglose: string | null, rg: Rango, deps: DepsAudiencia = {}): Promise<Fila[]> {
  const lectura = lecturaDe(dimension, desglose);
  const desde = desdeQueGuardaMeta(rg.desde, deps.hoy ?? new Date().toISOString().slice(0, 10));
  if (rg.hasta < desde) return [];
  const leer = deps.leer ?? (await import('./meta-desgloses')).desglosesCuenta;
  let crudas: FilaInsights[];
  try {
    crudas = await leer({ desde, hasta: rg.hasta, breakdown: lectura });
  } catch (e) {
    const motivo = motivoDe(e);
    // Quien no está en ningún negocio no tiene audiencia, como no tiene leads (lib/graficos-lectura.ts).
    if (motivo === 'sin_workspace') return [];
    if (motivo === 'sin_conexion') throw new SinConexionError('Conecta Meta para ver tu audiencia');
    if (motivo === 'token_vencido') throw new SinConexionError('Vuelve a conectar Meta para ver tu audiencia');
    throw e;
  }
  // El `spend` está en la moneda de la CUENTA (AGENTS.md): a dólares con el conversor del negocio.
  const aUsd = deps.aUsd ?? (await (await import('./moneda-meta')).conversorGastoMeta()).aUsdNum;
  return filasDeDesglose(crudas, lectura, desde, aUsd);
}

/**
 * El armado: de las filas de UNA lectura de Meta a las del Dashboard. Puro. Una fila sin ningún
 * número (la edad «Unknown» con todo en cero) no entra.
 */
export function filasDeDesglose(crudas: FilaInsights[], lectura: Desglose, desde: string, aUsd: (monto: number) => number): Fila[] {
  const conConversiones = conversionesEnLectura(crudas);
  const out: Fila[] = [];
  for (const cruda of crudas) {
    const x = leerFilaMeta(cruda, conConversiones);
    const v: Record<string, number> = {
      impresiones: x.impresiones,
      // El alcance va como viene: no se suma entre filas (la métrica es `sinTotal` en el catálogo).
      alcance: x.alcance,
      clics: x.clics,
      gasto: aUsd(x.gastoCuenta),
      // Sin la clave, no en cero: con región Meta no da la agenda (ver la cabecera).
      ...(x.agendas != null ? { agendas: x.agendas } : {}),
    };
    if (!Object.values(v).some((n) => n !== 0)) continue;
    const d: Fila['d'] = lectura === 'region'
      ? { region: etiquetaMeta(x.region) }
      : lectura === 'publisher_platform'
        ? { plataforma: etiquetaPlataforma(x.publisher_platform) }
        : { edad: etiquetaMeta(x.age), genero: etiquetaGenero(x.gender) };
    out.push({ f: desde, d, v });
  }
  return out;
}

/** Una fila de Meta con sus números: las dimensiones tal cual las manda, y `agendas` null si esa lectura no las trae. */
export type FilaMeta = {
  region: string | null;
  publisher_platform: string | null;
  age: string | null;
  gender: string | null;
  impresiones: number;
  alcance: number;
  clics: number;
  /** En la moneda de la CUENTA: se pasa a dólares con `conversorGastoMeta` (lib/moneda-meta.ts). */
  gastoCuenta: number;
  agendas: number | null;
};

const numero = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
type Accion = { action_type?: unknown; value?: unknown };
const acciones = (r: FilaInsights): Accion[] => (Array.isArray(r.actions) ? (r.actions as Accion[]) : []);

/**
 * ¿La lectura trae conversiones de afuera de Meta? Con región no trae ninguna (medido): ahí la agenda
 * no es cero, es «no la da». Se pregunta por la LECTURA entera, no por fila: una plataforma con 8
 * impresiones y sin agendas, en una lectura que sí las trae, tiene cero agendas de verdad.
 */
export function conversionesEnLectura(filas: FilaInsights[]): boolean {
  return filas.some((r) => acciones(r).some((a) => typeof a.action_type === 'string' && a.action_type.startsWith('offsite_conversion.')));
}

/** Los números de una fila de Meta (vienen como texto). La agenda sale de `ACCION_AGENDA`. */
export function leerFilaMeta(r: FilaInsights, conConversiones: boolean): FilaMeta {
  const agenda = acciones(r).find((a) => a.action_type === ACCION_AGENDA);
  return {
    region: texto(r.region),
    publisher_platform: texto(r.publisher_platform),
    age: texto(r.age),
    gender: texto(r.gender),
    impresiones: numero(r.impressions),
    alcance: numero(r.reach),
    clics: numero(r.inline_link_clicks),
    gastoCuenta: numero(r.spend),
    agendas: conConversiones ? numero(agenda?.value) : null,
  };
}

const DESCONOCIDO = /^unknown$/i;
const PLATAFORMAS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', audience_network: 'Audience Network', messenger: 'Messenger', whatsapp: 'WhatsApp',
};

/** Lo que Meta no sabe («Unknown») es «(sin dato)»; el resto, como lo manda. Para la región y la edad. */
export function etiquetaMeta(v: string | null): string | null {
  return !v || DESCONOCIDO.test(v) ? null : v;
}
/** La plataforma con su nombre: `audience_network` → «Audience Network». Una que no conocemos, legible igual. */
export function etiquetaPlataforma(v: string | null): string | null {
  if (!v || DESCONOCIDO.test(v)) return null;
  return PLATAFORMAS[v.toLowerCase()] ?? v.replace(/_+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
/** `male` → Hombres, `female` → Mujeres; lo demás (`unknown`) es «(sin dato)». */
export function etiquetaGenero(v: string | null): string | null {
  return v === 'male' ? 'Hombres' : v === 'female' ? 'Mujeres' : null;
}
