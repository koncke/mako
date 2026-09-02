import 'server-only';

// =============================================================================
// voz-cliente — cómo habla el avatar de ESTE cliente, DECLARADO por él
// =============================================================================
//
// ── Por qué existe ──────────────────────────────────────────────────────────
//
// `lib/acento-workspace.ts` ya sabía resolver el acento y ya tenía escrito qué
// le faltaba: «el día que el onboarding de la tab pregunte el acento, ese valor
// gana y `seguro` pasa a true». Hasta hoy los dos únicos llamadores pasaban
// `resolverAcento(null, tz)` — o sea que el parámetro `declarado` NUNCA se usó y
// el acento de todos los clientes salía de adivinar su zona horaria.
//
// ⚠️ Y ADIVINARLO NO SE NOTA AL LEER. El guion sale en un español plausible; que
// la variedad no sea la suya se descubre recién cuando alguien lo dice en voz
// alta — con el clip ya pagado. Es el mismo modo de falla que el slot
// «{{acento}}» sin llenar, y por eso el dato declarado tiene que existir.
//
// ── Un ajuste del CLIENTE, no del anuncio ───────────────────────────────────
//
// Vive en `app_settings` del workspace y no en el plan, por lo mismo que ya está
// escrito en `acento-workspace`: nadie graba un video en norteño y el siguiente
// en rioplatense. Sin tabla ni migración, que es el molde de todo el estado de
// onboarding por tab.

import { getSetting, setSetting } from '@/lib/settings';
import { ACENTOS_ES, MULETILLAS, type AcentoId } from '@/lib/acento-workspace';

const KEY = 'video.voz';

export type VozCliente = {
  /** El acento que ELIGIÓ. Vacío = todavía no eligió y se sigue infiriendo. */
  acento: AcentoId | '';
  /** Las muletillas que marcó como suyas, de las de su variedad. */
  muletillas: string[];
};

const VACIO: VozCliente = { acento: '', muletillas: [] };

/**
 * Lo que el cliente declaró sobre su forma de hablar.
 *
 * Nunca lanza: un `app_settings` ilegible tiene que degradar a «no declaró»,
 * que es un estado válido y del que la app ya sabe salir infiriendo. Tumbar la
 * tab por un JSON roto sería cambiar un dato impreciso por ninguna pantalla.
 */
export async function getVozCliente(): Promise<VozCliente> {
  const raw = await getSetting(KEY).catch(() => null);
  if (!raw) return VACIO;
  try {
    const v = JSON.parse(raw) as Partial<VozCliente>;
    const acento = typeof v.acento === 'string' && v.acento in ACENTOS_ES ? (v.acento as AcentoId) : '';
    const muletillas = Array.isArray(v.muletillas)
      ? v.muletillas.filter((m): m is string => typeof m === 'string')
      : [];
    return { acento, muletillas };
  } catch {
    return VACIO;
  }
}

/**
 * Guarda el acento elegido.
 *
 * ⚠️ CAMBIAR DE ACENTO LIMPIA LAS MULETILLAS QUE YA NO APLICAN, acá y no sólo al
 * leer. `resolverAcento` filtra las de otra variedad —así que nada malo llegaría
 * al modelo— pero dejarlas guardadas hace que la pantalla siguiente muestre
 * marcadas unas que no están en la lista, o peor, que volver al acento anterior
 * resucite una selección que la persona ya no recuerda haber hecho. El dato
 * guardado tiene que poder leerse solo.
 */
export async function setAcentoCliente(acento: AcentoId): Promise<VozCliente> {
  const antes = await getVozCliente();
  const nuevo: VozCliente = {
    acento,
    muletillas: antes.muletillas.filter((m) => MULETILLAS[acento].includes(m)),
  };
  await setSetting(KEY, JSON.stringify(nuevo));
  return nuevo;
}

/**
 * Guarda las muletillas marcadas.
 *
 * Se filtran contra las del acento vigente: lo que llega de la pantalla es lo
 * que se tocó, y una lista que incluya algo de otra variedad significa que el
 * acento cambió en otra pestaña. Gana lo guardado.
 */
export async function setMuletillasCliente(muletillas: string[]): Promise<VozCliente> {
  const antes = await getVozCliente();
  const validas = antes.acento ? MULETILLAS[antes.acento] : [];
  const nuevo: VozCliente = {
    acento: antes.acento,
    muletillas: muletillas.filter((m) => validas.includes(m)),
  };
  await setSetting(KEY, JSON.stringify(nuevo));
  return nuevo;
}
