// =============================================================================
// secciones-negocio — DÓNDE se edita hoy cada sección del negocio: la única tabla que lo dice
// =============================================================================
// Las diez secciones que eran el hub de /onboarding (matriz, diagnóstico, archivero, oferta, lead
// magnet, persona, personalidad, avatares, razones y ángulos). El hub se retiró el 15/10/2026 porque
// /second-brain ya montaba las mismas diez vistas (docs/hallazgos-onboarding.md → «¿Se puede sacar el
// hub de /onboarding?»). Pedido de Martín, textual: «Si, ponlo en second brain, y deja registrado la
// tarea de perfeccionar la tab de second braind y varias cosas de allí irán a sus propias tabs, como la
// de Writer y la de Avatar con IA».
//
// ⚠️ SECOND BRAIN NO ES EL DESTINO FINAL: ES EL DE HOY. Por eso ningún link escribe
// `/second-brain?area=…` a mano: pide la SECCIÓN (`rutaSeccion('persona')`) y el nombre del lugar
// (`lugarSeccion('persona')`), y esta tabla dice dónde vive. El día que una sección se mude a su tab
// —`candidata` anota a cuál parece que va, sin estar decidido—, se cambia SU fila acá y todos los links la siguen.
// `tests/onboarding-hub-retirado.test.ts` frena un link nuevo a mano.
//
// SIN `server-only` y con un solo import de datos puros: la usan pantallas cliente, lib/ y tests.
// =============================================================================

import { AREAS, type AreaId } from './cerebro-modelo';

export type SeccionNegocio =
  | 'diagnostico' | 'archivero' | 'oferta' | 'entregable' | 'persona'
  | 'personalidad' | 'avatares' | 'razones' | 'matriz' | 'angulos';

export type DondeSeEdita = {
  /** La pantalla, con el nombre que ve la persona. */
  ruta: '/second-brain';
  tab: 'Second Brain';
  /** El área de Second Brain (`?area=`, validado contra AREAS en app/second-brain/VistaCerebro.tsx). */
  area: AreaId;
  /** La sub-pestaña del área, si tiene más de una (`?vista=`, los ids de SUBVISTAS). */
  vista?: string;
  /** El nombre de la sección como se ve en la pantalla. */
  nombre: string;
  /**
   * La tab propia a la que PARECE que va a mudarse (Martín nombró «Writer» y «Avatar con IA» sin decir qué
   * va a cada una): es una SUPOSICIÓN nuestra, no una decisión, y nada la usa en runtime. Es la nota de dónde
   * se va a partir. Cuando se decida, se cambian `ruta`/`tab` de esa fila y se borra esto.
   */
  candidata?: string;
};

/**
 * Las sub-pestañas de las áreas de Second Brain que tienen más de una vista. Los ids son los que viajan
 * en `?vista=`; app/second-brain/AreasHub.tsx dibuja una pestaña por cada uno, con el mismo id.
 */
export const SUBVISTAS: Partial<Record<AreaId, readonly string[]>> = {
  oferta: ['entidad', 'brief'],
  razones: ['matriz', 'razones', 'angulos'],
  voz: ['personalidad', 'persona'],
};

const SB = { ruta: '/second-brain', tab: 'Second Brain' } as const;

export const DONDE_SE_EDITA: Readonly<Record<SeccionNegocio, DondeSeEdita>> = {
  diagnostico: { ...SB, area: 'norte', nombre: 'Diagnóstico' },
  archivero: { ...SB, area: 'documentos', nombre: 'Documentos' },
  oferta: { ...SB, area: 'oferta', vista: 'brief', nombre: 'Oferta' },
  entregable: { ...SB, area: 'entregables', nombre: 'Lead Magnet' },
  persona: { ...SB, area: 'voz', vista: 'persona', nombre: 'Persona', candidata: 'Avatar con IA' },
  personalidad: { ...SB, area: 'voz', vista: 'personalidad', nombre: 'Personalidad', candidata: 'Writer' },
  avatares: { ...SB, area: 'avatares', nombre: 'Avatares', candidata: 'Writer' },
  razones: { ...SB, area: 'razones', vista: 'razones', nombre: 'Razones', candidata: 'Writer' },
  matriz: { ...SB, area: 'razones', vista: 'matriz', nombre: 'Matriz', candidata: 'Writer' },
  // ⚠️ DECISIÓN PENDIENTE DE MARTÍN: la recomendación de formatos no la lee ningún generador (`elegirAngulo`
  // elige de la biblioteca entera) y cada «regenerar» paga IA. Se queda donde está hasta que él decida.
  angulos: { ...SB, area: 'razones', vista: 'angulos', nombre: 'Ángulos' },
};

/** El link a la sección, donde se edite hoy. */
export function rutaSeccion(s: SeccionNegocio): string {
  const d = DONDE_SE_EDITA[s];
  return `${d.ruta}?area=${d.area}${d.vista ? `&vista=${d.vista}` : ''}`;
}

/** Cómo se nombra el lugar en un texto: «Second Brain → Persona». Cambia solo cuando la sección se muda. */
export function lugarSeccion(s: SeccionNegocio): string {
  const d = DONDE_SE_EDITA[s];
  return `${d.tab} → ${d.nombre}`;
}

/** ¿Este par área/vista existe? Lo usa la pantalla para no abrir una vista inventada desde la URL. */
export function vistaValida(area: AreaId, vista: string | null | undefined): string | null {
  if (!vista) return null;
  return SUBVISTAS[area]?.includes(vista) ? vista : null;
}

/** Las áreas que la tabla nombra, todas de AREAS (lo fija el test). */
export const AREAS_NOMBRADAS: readonly AreaId[] = [...new Set(Object.values(DONDE_SE_EDITA).map((d) => d.area))]
  .filter((a) => AREAS.some((x) => x.id === a));
