// =============================================================================
// publico-cambios — superponer SOLO lo que cambió sobre el público crudo de Meta (17/10/2026)
// =============================================================================
// El POST /{adset} con `targeting` REEMPLAZA el objeto entero, y hasta este día la superposición vivía sólo en el
// navegador (app/ads-manager/EditarPublicoModal.tsx). Por eso la API de MaKo no podía «editar el público de un
// conjunto»: todo llamador de server que mandara un targeting parcial borraba la segmentación, con la ruta en verde
// (docs/hallazgos-ads.md, «la superposición NO vive en la lib ni en la ruta»). Esta función es la superposición, pura:
// la usan el editor del navegador y `editarPublicoConjunto` (lib/meta-ads-create.ts), que lee el crudo en el server.
//
// La regla: un campo que no viene (`undefined`) NO se toca; `null` lo saca. Lo que el editor no maneja (intereses,
// idiomas, comportamientos, exclusiones) se re-envía intacto porque nunca se nombra.
// =============================================================================

import { GENEROS } from './campaign-types';
import { RADIO_DIRECCION_DEFAULT_KM, agregarLugar, aplicarLugares, lugarPin, lugaresDesdeMeta, type LecturaGeo, type LugarMeta } from './meta-geo';

export const EDAD_META = { min: 18, max: 65 } as const;
export const UBICACIONES_META = ['facebook', 'instagram', 'audience_network', 'messenger'] as const;

export type CambiosDePublico = {
  /** 'all' | 'h' | 'm' (GENEROS). */
  genero?: string;
  edadMin?: number | null;
  edadMax?: number | null;
  /** Ids de públicos personalizados: la lista ENTERA nueva. [] o null los saca. */
  publicos?: string[] | null;
  /** publisher_platforms: la lista entera. null = automáticas (todas). */
  ubicaciones?: string[] | null;
  /** Advantage+ audience (0 o 1). */
  advantage?: 0 | 1;
  /** Los lugares (incluidos y excluidos), con la lectura del crudo para saber si cambiaron. */
  lugares?: { lectura: LecturaGeo; lista: LugarMeta[] };
};

/** Un error de lo que se pidió (no de Meta): se dice antes de escribir. */
export function validarCambiosDePublico(c: CambiosDePublico): string | null {
  if (c.genero !== undefined && !GENEROS.some((g) => g.value === c.genero)) return 'El género va como all, h (hombres) o m (mujeres).';
  for (const [k, v] of [['edadMin', c.edadMin], ['edadMax', c.edadMax]] as const) {
    if (v != null && (!Number.isInteger(v) || v < EDAD_META.min || v > EDAD_META.max)) return `${k === 'edadMin' ? 'La edad mínima' : 'La edad máxima'} va de ${EDAD_META.min} a ${EDAD_META.max}.`;
  }
  if (c.edadMin != null && c.edadMax != null && c.edadMin > c.edadMax) return 'La edad mínima no puede ser mayor que la máxima.';
  if (c.ubicaciones && c.ubicaciones.some((u) => !(UBICACIONES_META as readonly string[]).includes(u))) return `Las ubicaciones van entre: ${UBICACIONES_META.join(', ')}.`;
  if (c.ubicaciones && !c.ubicaciones.length) return 'Elige al menos una ubicación (o déjalas automáticas).';
  if (c.publicos && c.publicos.some((p) => !/^\d+$/.test(p))) return 'Los públicos van por su id numérico de Meta.';
  return null;
}

/**
 * El targeting nuevo: el crudo con SOLO lo que vino en `c` superpuesto. Tira si los lugares no se pueden re-escribir
 * (`aplicarLugares`: un geo que no se entiende queda en sólo lectura).
 */
export function aplicarCambiosDePublico(base: Record<string, unknown>, c: CambiosDePublico): Record<string, unknown> {
  // Los lugares PRIMERO y por su función: sin cambios devuelve el geo crudo idéntico.
  const t: Record<string, unknown> = c.lugares ? { ...aplicarLugares(base, c.lugares.lectura, c.lugares.lista) } : { ...base };
  if (c.genero !== undefined) {
    const genders = GENEROS.find((x) => x.value === c.genero)?.genders ?? [];
    if (genders.length) t.genders = genders; else delete t.genders;
  }
  if (c.edadMin !== undefined) { if (c.edadMin != null) t.age_min = c.edadMin; else delete t.age_min; }
  if (c.edadMax !== undefined) { if (c.edadMax != null) t.age_max = c.edadMax; else delete t.age_max; }
  if (c.publicos !== undefined) {
    if (c.publicos && c.publicos.length) t.custom_audiences = c.publicos.map((id) => ({ id })); else delete t.custom_audiences;
  }
  if (c.ubicaciones !== undefined) {
    // Coherencia con positions: Meta rechaza positions sin su plataforma.
    if (c.ubicaciones && c.ubicaciones.length) {
      t.publisher_platforms = c.ubicaciones;
      if (!c.ubicaciones.includes('facebook')) delete t.facebook_positions;
      if (!c.ubicaciones.includes('instagram')) delete t.instagram_positions;
    } else { delete t.publisher_platforms; delete t.facebook_positions; delete t.instagram_positions; }
  }
  // Advantage+: si queda en 0 sin ninguna señal fina, Meta lo rechaza: va en 1. Se re-mira SIEMPRE que algo de lo fino
  // cambió, porque sacar la última señal con Advantage+ en 0 deja un público que Meta no acepta.
  const tocaFino = c.advantage !== undefined || c.genero !== undefined || c.edadMin !== undefined || c.edadMax !== undefined || c.publicos !== undefined;
  if (tocaFino) {
    const ta = (base.targeting_automation ?? {}) as Record<string, unknown>;
    const pedido = c.advantage ?? (Number(ta.advantage_audience) === 1 ? 1 : 0);
    const hayFino = !!(t.age_min || t.age_max || (Array.isArray(t.genders) && t.genders.length) || (Array.isArray(t.custom_audiences) && t.custom_audiences.length) || (Array.isArray(t.flexible_spec) && (t.flexible_spec as unknown[]).length));
    t.targeting_automation = { ...ta, advantage_audience: pedido === 0 && !hayFino ? 1 : pedido };
  }
  return t;
}

/** Lo que cambió, en palabras, para el «sí» de quien confirma (la API de MaKo propone, una persona confirma). */
export function resumenDeCambios(c: CambiosDePublico): string[] {
  const out: string[] = [];
  if (c.genero !== undefined) out.push(`género: ${GENEROS.find((g) => g.value === c.genero)?.label ?? c.genero}`);
  if (c.edadMin !== undefined || c.edadMax !== undefined) out.push(`edad: ${c.edadMin ?? EDAD_META.min} a ${c.edadMax ?? `${EDAD_META.max}+`}`);
  if (c.publicos !== undefined) out.push(c.publicos?.length ? `${c.publicos.length} público(s) personalizado(s)` : 'sin públicos personalizados');
  if (c.ubicaciones !== undefined) out.push(c.ubicaciones?.length ? `ubicaciones: ${c.ubicaciones.join(', ')}` : 'ubicaciones automáticas');
  if (c.advantage !== undefined) out.push(`Advantage+: ${c.advantage ? 'sí' : 'no'}`);
  if (c.lugares) out.push(`lugares: ${c.lugares.lista.filter((l) => !l.excluir).map((l) => l.nombre).join(', ')}`);
  return out;
}

// ── Lo que llega por la API de MaKo (JSON plano) → los cambios ─────────────────────────────────────────────────────

/** Lo que se guarda en la propuesta (se confirma después): sólo datos planos, sin la lectura del crudo. */
export type EntradaPublico = {
  genero?: string;
  edadMin?: number | null;
  edadMax?: number | null;
  publicos?: string[] | null;
  ubicaciones?: string[] | null;
  advantage?: 0 | 1;
  pin?: { lat: number; lng: number; radioKm: number };
};

const numeroDe = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** La entrada de la API, validada. Sin ningún cambio, error: no hay nada que proponer. */
export function entradaDesdeApi(input: Record<string, unknown>): EntradaPublico | { error: string } {
  const e: EntradaPublico = {};
  if (typeof input.genero === 'string') e.genero = input.genero;
  const min = numeroDe(input.edadMin); if (min !== undefined) e.edadMin = min;
  const max = numeroDe(input.edadMax); if (max !== undefined) e.edadMax = max;
  if (Array.isArray(input.publicos)) e.publicos = input.publicos.map(String);
  if (input.ubicacionesAutomaticas === true) e.ubicaciones = null;
  else if (Array.isArray(input.ubicaciones)) e.ubicaciones = input.ubicaciones.map(String);
  if (typeof input.advantage === 'boolean') e.advantage = input.advantage ? 1 : 0;
  const lat = numeroDe(input.pinLat);
  const lng = numeroDe(input.pinLng);
  if ((lat === undefined) !== (lng === undefined)) return { error: 'Un punto del mapa necesita pinLat y pinLng juntos.' };
  if (lat !== undefined && lng !== undefined) {
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: 'Esas coordenadas no existen.' };
    e.pin = { lat, lng, radioKm: numeroDe(input.pinRadioKm) ?? RADIO_DIRECCION_DEFAULT_KM };
  }
  if (!Object.keys(e).length) return { error: 'No hay nada que cambiar: manda al menos un dato del público.' };
  const err = validarCambiosDePublico(e);
  return err ? { error: err } : e;
}

/** Los cambios a aplicar sobre ESTE crudo: el pin se suma a los lugares que ya tenía (no los reemplaza). */
export function cambiosDesdeEntrada(base: Record<string, unknown>, e: EntradaPublico): CambiosDePublico {
  const { pin, ...resto } = e;
  if (!pin) return resto;
  const lectura = lugaresDesdeMeta(base.geo_locations, base.excluded_geo_locations);
  const { lista } = agregarLugar(lectura.lugares, lugarPin(pin.lat, pin.lng, pin.radioKm));
  return { ...resto, lugares: { lectura, lista } };
}
