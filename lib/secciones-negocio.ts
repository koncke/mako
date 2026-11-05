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
  | 'personalidad' | 'avatares' | 'razones' | 'matriz' | 'angulos' | 'marca';

export type DondeSeEdita = {
  /** La pantalla, con el nombre que ve la persona. La ruta es la de siempre; para los negocios la tab se llama «Ops Center»
   *  desde el 18/10/2026 (Martín, por el Cerebro: la tab /second-brain lleva ese nombre y la criatura estrella). */
  ruta: '/second-brain';
  tab: 'Ops Center';
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
  voz: ['personalidad', 'persona', 'marca'],
};

const SB = { ruta: '/second-brain', tab: 'Ops Center' } as const;

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
  // Ángulos = la biblioteca de formatos con cuántos anuncios de la matriz usa cada uno, sin IA. La recomendación
  // a nivel negocio (que pagaba IA y no la leía ningún generador) se sacó el 23/10/2026: 0 negocios la tenían.
  angulos: { ...SB, area: 'razones', vista: 'angulos', nombre: 'Ángulos' },
  // La marca del negocio (5/11/2026, lib/marca/kits.ts): sus colores, fuentes y logo, en uno o varios kits. La usan los
  // chats de Image, Video y Web Generator y los carruseles de MaKo.
  marca: { ...SB, area: 'voz', vista: 'marca', nombre: 'Marca' },
};

/** El link a la sección, donde se edite hoy. */
export function rutaSeccion(s: SeccionNegocio): string {
  const d = DONDE_SE_EDITA[s];
  return `${d.ruta}?area=${d.area}${d.vista ? `&vista=${d.vista}` : ''}`;
}

/** Cómo se nombra el lugar en un texto: «Ops Center → Persona» (el nombre que el negocio ve). Cambia solo cuando la sección se muda. */
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

// ── Dónde se corrige cada DATO del negocio, con el nombre que la persona LEE (tickets #46 y #48 de Leila, 3/11/2026) ──
// «¿Dónde actualizo mis datos? El 7 a 9 ahora es 7:30 a 9:30» y MaKo contestó que la ruta «no la tenía confirmada»: ningún
// lugar le decía a un chat dónde se edita el precio, qué incluye o el horario. Y donde sí lo decía, mandaba a «Documentos»,
// cuando el campo se lee y se corrige en «La oferta → El brief» (CamposNegocio: «Toca cualquier dato para corregirlo»).
// Los nombres son los de la pantalla: «Second Brain» en la barra del Ops Center, el área del mapa (AREAS) y su sub-pestaña
// (AreasHub.tsx). tests/mako-no-puedo-falsos.test.ts (el 17) mira que cada nombre esté de verdad en esas pantallas.
export type DatoDelNegocio = 'brief' | 'ofertas' | 'productos' | 'cliente';

export const DATOS_DEL_NEGOCIO: Readonly<Record<DatoDelNegocio, { area: AreaId; vista?: string; nombres: readonly string[]; que: string }>> = {
  brief: { area: 'oferta', vista: 'brief', nombres: ['La oferta', 'El brief'], que: 'lo que MaKo usa para escribir de tu oferta principal: a qué te dedicas, el precio, qué incluye (días, horario, sesiones), la promesa y la garantía' },
  ofertas: { area: 'oferta', vista: 'entidad', nombres: ['La oferta', 'La oferta'], que: 'tus ofertas: el precio en USD y cómo se presenta, los bonos, la urgencia y en qué funnels se vende cada una' },
  productos: { area: 'productos', nombres: ['Productos'], que: 'el catálogo que usa el CRM para cargar cada venta, con su precio' },
  cliente: { area: 'cliente', nombres: ['Cliente ideal'], que: 'a quién le vendes: qué le duele, qué quiere y qué objeta' },
};

/** El link al dato (`?area=` y `?vista=`, los mismos que valida VistaCerebro). */
export function rutaDato(d: DatoDelNegocio): string {
  const x = DATOS_DEL_NEGOCIO[d];
  return `${SB.ruta}?area=${x.area}${x.vista ? `&vista=${x.vista}` : ''}`;
}

/** «Ops Center → Second Brain → La oferta → El brief»: el camino con los nombres de la pantalla. */
export function lugarDato(d: DatoDelNegocio): string {
  return [SB.tab, 'Second Brain', ...DATOS_DEL_NEGOCIO[d].nombres].join(' → ');
}

/** Dónde se corrige un campo del perfil, por su clave: lo de la oferta en «El brief», lo del cliente en «Cliente ideal». */
export function datoDeCampo(key: string): DatoDelNegocio | null {
  if (key === 'negocio_que_hace' || key.startsWith('oferta_')) return 'brief';
  if (key.startsWith('avatar_')) return 'cliente';
  return null;
}
