// =============================================================================
// onboarding-pasos-api — cerrar un paso del arranque, o marcar el de una tab, desde AFUERA de su pantalla
// =============================================================================
// Las dos operaciones de la API de MaKo que escriben un onboarding (área `negocio`, 23/10/2026: Martín, «todo lo que
// se hace en pantalla tiene que estar en la API»):
//   · cerrar_paso_onboarding    → el ARRANQUE del negocio (lib/onboarding-state.ts, `cerrarPasosOnboarding`).
//   · marcar_paso_onboarding_tab → el onboarding de UNA tab (lib/tab-onboarding-state.ts, `marcarPasoTab`).
//
// ⚠️ SIN `server-only`, A PROPÓSITO: lo importan la def (que no puede importar valores de un módulo con server-only,
// porque el generador de la referencia corre sin `--conditions react-server`) y los tests. Lo que LEE la base para
// decidir vive aparte, en lib/onboarding-hechos.ts.
//
// ⚠️ UN PASO SE CIERRA CON EL DATO VIVO, NUNCA CON LA PALABRA DEL MODELO. El caso que trajo esto (P0-12 de la
// auditoría del 23/10): un chat de afuera dejó a un negocio con avatares, productos y fase cargados y el arranque
// seguía bloqueando la app. La salida obvia —«que el modelo diga que el paso está hecho»— es la que no se puede
// tomar: un modelo dice «hecho» sobre una conversación, no sobre la base. Por eso cada paso trae lo que se comprobó
// (`HechoDePaso`) y la decisión es una función pura con test.
//
// ⚠️ Y NO TOCA EL CHAT DE ARRANQUE. Decisión del Cerebro (23/10/2026, escrita en docs/hallazgos-onboarding.md): el
// «la API no toca el onboarding, a propósito» cuidaba la PRIMERA conversación de la persona; cerrar o postergar un paso
// cuyo dato ya existe no la toca. Acá no se escribe `onboarding.arranque` ni se arma nada por la persona.
// =============================================================================

import { POSTERGABLE_TXT, esPostergable, type PasoOnboarding } from './capas';
import { onboardingCompleto, type CambioDePaso, type OnboardingState } from './onboarding-contrato';
import { TAB_ONBOARDINGS } from './tab-onboarding-catalogo';
import { pasoBloqueadoPor } from './onboarding-orden';

/** Cómo se llama cada paso del arranque para quien lo lee (el resumen que confirma una persona). Completo: un paso
 *  nuevo en `PASOS_ONBOARDING` no compila sin su nombre. */
export const ROTULO_PASO_ONBOARDING: Record<PasoOnboarding, string> = {
  integraciones: 'Conectar tus cuentas',
  tabs: 'Verificar tu teléfono',
  negocio: 'Tu negocio',
  archivero: 'Tus documentos',
  productos: 'Lo que vendes',
  entregable: 'Tu lead magnet',
  avatares: 'Tus avatares',
  persona: 'La cara de tu marca',
  personalidad: 'Tu personalidad',
  angulos: 'Tu matriz de anuncios',
  fase: 'El diagnóstico de fase',
  gemini: 'Tu IA',
  retro: 'Tu retro',
  plan: 'Tu plan de arranque',
};

/**
 * Los pasos del arranque que se cierran desde afuera, EN POSITIVO: los que dejan un dato que se comprueba en la base
 * (lib/onboarding-hechos.ts), que son los del chat de arranque. Los otros de `PASOS_ONBOARDING` salieron del arranque
 * y se configuran en su tab: ofrecerlos en el enum publicaba en la referencia catorce valores, de los que ocho contestan
 * siempre «no se puede» (revisión del 23/10/2026). Incluye los dos postergables (tabs e integraciones).
 */
export const PASOS_ARRANQUE_POR_API = ['negocio', 'productos', 'fase', 'plan', 'tabs', 'integraciones'] as const satisfies readonly PasoOnboarding[];

/** Cómo se cierra un paso del arranque: hecho, o pendiente para después (sólo los de `PASOS_POSTERGABLES`). */
export const CIERRES_PASO = ['hecho', 'postergado'] as const;
export type CierrePaso = (typeof CIERRES_PASO)[number];

/**
 * Lo que dice la base HOY sobre un paso:
 *   · cumplido → lo que el paso pide existe (`que`: qué se comprobó, va al resumen).
 *   · no       → falta (`falta`: qué, en una frase con su acción).
 *   · sinDato  → el paso no deja un dato que se pueda comprobar: NO se cierra desde afuera (`sinDato`: por qué).
 * «No pude leer» NO es ninguno de los tres: el lector TIRA y la propuesta no se arma.
 */
export type HechoDePaso =
  | { cumplido: true; que: string }
  | { cumplido: false; falta: string }
  | { sinDato: string };

export type ResultadoCierre =
  | { cambio: CambioDePaso; resumen: string; terminaElArranque: boolean }
  | { error: string; yaEstaba?: true; disponibles?: readonly string[] };

const rotulo = (p: PasoOnboarding) => `«${ROTULO_PASO_ONBOARDING[p]}»`;

/**
 * ¿Se puede cerrar (o postergar) este paso del arranque, y qué lee la persona antes de confirmarlo?
 *
 * Las reglas, en este orden y todas en positivo:
 *   1. el paso es del arranque de SU plan (la capa); otro, no existe para este negocio.
 *   2. postergar, sólo los de `PASOS_POSTERGABLES` (la misma lista que valida `aplicarCambiosDePaso` al escribir).
 *   3. ya cerrado (o ya pendiente, si se pide postergar) → «ya está así» (`yaEstaba`), nunca otra escritura.
 *   4. cerrar como hecho exige el dato vivo (`hecho.cumplido`); un paso `sinDato` no se cierra desde afuera.
 *   5. postergar algo que YA está resuelto se rechaza: lo cierto es cerrarlo como hecho.
 * Si con esto quedan todos cerrados, el resumen lo dice: es lo que manda a la persona directo a la app.
 */
export function revisarCierreDePaso(o: {
  estado: OnboardingState;
  pasosCapa: readonly PasoOnboarding[];
  paso: PasoOnboarding;
  cierre: CierrePaso;
  hecho: HechoDePaso;
}): ResultadoCierre {
  const { estado: s, pasosCapa, paso, cierre, hecho } = o;
  const rot = rotulo(paso);
  if (!pasosCapa.length) return { error: 'El plan de este negocio no tiene arranque: no hay pasos que cerrar.' };
  if (!pasosCapa.includes(paso)) return { error: `${rot} no es un paso del arranque de este plan.`, disponibles: pasosCapa };
  if (cierre === 'postergado' && !esPostergable(paso)) {
    return { error: `${rot} no se puede dejar para después: no depende de nada de afuera. Se cierra cuando está hecho.` };
  }
  const st = s.steps[paso];
  if (st?.done) return { error: `${rot} ya estaba cerrado.`, yaEstaba: true };
  if (cierre === 'postergado') {
    if (st?.postergado) return { error: `${rot} ya estaba pendiente para después.`, yaEstaba: true };
    if ('cumplido' in hecho && hecho.cumplido) return { error: `${rot} ya está hecho (${hecho.que}): ciérralo como hecho, no como pendiente.` };
  } else {
    if ('sinDato' in hecho) return { error: `${rot} no se puede cerrar desde aquí: ${hecho.sinDato}` };
    if (!hecho.cumplido) return { error: `${rot} todavía no está hecho: ${hecho.falta}` };
  }

  const cambio: CambioDePaso = cierre === 'hecho' ? { paso, done: true } : { paso, postergar: true };
  // ¿Con esto termina? La MISMA pregunta que hace el cierre al escribir (`onboardingCompleto`), sobre una copia.
  const despues: OnboardingState = {
    ...s,
    steps: { ...s.steps, [paso]: { ...(st ?? { done: false }), ...(cierre === 'hecho' ? { done: true } : { postergado: true }) } },
  };
  const termina = s.status !== 'done' && onboardingCompleto(despues, [...pasosCapa]);
  const faltan = pasosCapa.filter((p) => !despues.steps[p]?.done && !despues.steps[p]?.postergado).map(rotulo);

  const que = cierre === 'hecho'
    ? `Cerrar ${rot} del arranque del negocio (${(hecho as { que: string }).que}).`
    : `Dejar ${rot} para después: se resuelve en ${POSTERGABLE_TXT[paso as keyof typeof POSTERGABLE_TXT].donde} y queda el recordatorio.`;
  const cola = termina
    ? ' Con esto el arranque termina y la persona entra directo a la app.'
    : s.status !== 'done' && faltan.length ? ` Siguen faltando: ${faltan.join(', ')}.` : '';
  return { cambio, resumen: `${que}${cola}`, terminaElArranque: termina };
}

// ── El onboarding de una tab ─────────────────────────────────────────────────

/**
 * Los pasos de tab que la API puede marcar, EN POSITIVO y por tab: los de CONTEXTO (algo que la persona carga o
 * declara, y que se puede comprobar en la base). Lo que NO está, a propósito:
 *   · los ENSAYOS (`reels_ensayo`, `carousels_ensayo`, `stories_ensayo`, `vg_ensayo`): se cierran solos al generar la
 *     primera pieza, y un «listo» sin pieza diría que la tab quedó probada sin que nada la probara.
 *   · las CONEXIONES (`vg_puente`, `vg_voz`, `wa_no_oficial`, `email_*`, `cal_agenda`, `am_*`): las cierra la tab al
 *     comprobar que la conexión anda.
 *   · los que la PÁGINA deriva sola de los datos al abrirse (`reels_contexto`, Clientes, Curso, Comunidad, Ads Manager,
 *     Offer, Calendario, los del Web Generator): marcarlos desde afuera no agrega nada y la página los recalcula.
 *   · `vg_muletillas`: «ninguna marcada también es una respuesta», así que no deja un dato que comprobar. Marcarlo desde
 *     afuera sería contestar por la persona; se cierra cuando ella las guarda en la tab (revisión del 23/10/2026).
 * `cg_angulos` es el ensayo del Copy Generator y SÍ está: su pieza es la matriz, que se arma en su propia operación y
 * se comprueba en la base (hay celdas de un avatar que existe).
 */
export const PASOS_TAB_POR_API: Readonly<Record<string, readonly string[]>> = {
  'ads-writer': ['cg_entregable', 'cg_avatares', 'cg_persona', 'cg_personalidad', 'cg_angulos'],
  'video-generator': ['vg_cara', 'vg_acento'],
  setting: ['contexto'],
  carousels: ['carousels_contexto'],
  stories: ['stories_contexto'],
};
export const TABS_POR_API: readonly string[] = Object.keys(PASOS_TAB_POR_API);
export const PASOS_DE_TAB_POR_API: readonly string[] = [...new Set(Object.values(PASOS_TAB_POR_API).flat())];

export type ResultadoMarcaTab = { resumen: string } | { error: string; yaEstaba?: true; disponibles?: readonly string[] };

/**
 * ¿Se puede marcar (o desmarcar) este paso de la tab, y qué lee la persona antes de confirmarlo?
 *   1. la tab y el paso están en `PASOS_TAB_POR_API`; uno de la tab que no está dice por qué no.
 *   2. la tab es del plan del negocio.
 *   3. ya está así → `yaEstaba`.
 *   4. marcar exige el dato vivo y respeta el orden (`pasoBloqueadoPor`, la misma guarda que `marcarPasoTab`).
 *      Desmarcar nunca se frena (igual que `marcarPasoTab`).
 * `steps` es el estado CALCULADO (`getEstadoTab`), que ya cruza el registro compartido de pasos.
 */
export function revisarMarcaDePasoTab(o: {
  tab: string;
  paso: string;
  hecho: boolean;
  steps: Record<string, { done?: boolean } | undefined>;
  tabEnCapa: boolean;
  dato: HechoDePaso;
}): ResultadoMarcaTab {
  const { tab, paso, hecho, steps, tabEnCapa, dato } = o;
  const def = TAB_ONBOARDINGS[tab];
  const permitidos = PASOS_TAB_POR_API[tab];
  if (!def || !permitidos) return { error: `«${tab}» no es una tab cuyo onboarding se marque desde aquí.`, disponibles: TABS_POR_API };
  const nombre = def.nombre ?? def.titulo;
  if (!tabEnCapa) return { error: `El plan de este negocio no tiene ${nombre}.` };
  const p = def.pasos.find((x) => x.key === paso);
  if (!p) return { error: `«${paso}» no es un paso del onboarding de ${nombre}.`, disponibles: permitidos };
  if (!permitidos.includes(paso)) {
    const porque = /_ensayo$/.test(paso) ? 'se cierra solo al generar la primera pieza en la tab' : 'lo cierra la propia tab cuando lo comprueba';
    return { error: `«${p.label}» no se marca desde aquí: ${porque}.`, disponibles: permitidos };
  }
  const yaHecho = !!steps[paso]?.done;
  if (hecho && yaHecho) return { error: `«${p.label}» ya estaba hecho en ${nombre}.`, yaEstaba: true };
  if (!hecho && !yaHecho) return { error: `«${p.label}» ya estaba sin hacer en ${nombre}.`, yaEstaba: true };

  const obligatorios = def.pasos.filter((x) => !x.opcional);
  if (!hecho) {
    const estabaLista = obligatorios.every((x) => steps[x.key]?.done);
    const reabre = estabaLista && !p.opcional ? ` ${nombre} vuelve a abrir en su recorrido.` : '';
    return { resumen: `Desmarcar «${p.label}» del onboarding de ${nombre}.${reabre}` };
  }
  if ('sinDato' in dato) return { error: `«${p.label}» no se puede marcar desde aquí: ${dato.sinDato}` };
  if (!dato.cumplido) return { error: `«${p.label}» todavía no está hecho: ${dato.falta}` };
  const falta = pasoBloqueadoPor(def.pasos, steps, paso);
  if (falta) return { error: `Antes de «${p.label}» falta «${def.pasos.find((x) => x.key === falta)?.label ?? falta}» en ${nombre}.` };
  const queda = obligatorios.every((x) => x.key === paso || steps[x.key]?.done) ? ` Con esto ${nombre} queda configurada.` : '';
  return { resumen: `Marcar «${p.label}» de ${nombre} como hecho (${dato.que}).${queda}` };
}
