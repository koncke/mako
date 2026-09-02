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

import { randomUUID } from 'node:crypto';
import { getSetting, setSetting } from '@/lib/settings';
import { getSupabaseServer } from '@/lib/supabase';
import { getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import { ACENTOS_ES, MULETILLAS, type AcentoId } from '@/lib/acento-workspace';

const KEY = 'video.voz';

/** Un audio del cliente, guardado para poder rehacer el clon sin volver a pedirlo. */
export type MuestraGuardada = { id: string; nombre: string; mime: string; path: string };

/** El clon de su voz en ElevenLabs. Ausente = no clonó todavía. */
export type ClonDeVoz = {
  voiceId: string;
  nombre: string;
  creadoAt: string;
  /**
   * De qué audios salió. Es la PROCEDENCIA, y sirve para lo que más importa
   * de un clon: si sonó mal, saber con qué material se hizo.
   */
  muestras: string[];
  /**
   * ⚠️ CUÁNDO AUTORIZÓ, Y SIN ESTO NO SE CLONA. No es un formalismo: clonar la
   * voz de una persona sin su permiso explícito no se hace, y acá pesa doble
   * porque el clon vive en la cuenta de ElevenLabs de la PLATAFORMA — o sea que
   * el consentimiento hacia el proveedor lo sostiene el titular de esa cuenta y
   * no quien aprieta el botón.
   *
   * Falla CERRADO: sin fecha, `clonarVozAction` no llama a nadie.
   */
  autorizadoAt: string;
};

export type VozCliente = {
  /** El acento que ELIGIÓ. Vacío = todavía no eligió y se sigue infiriendo. */
  acento: AcentoId | '';
  /** Las muletillas que marcó como suyas, de las de su variedad. */
  muletillas: string[];
  /** Los audios que subió, para poder rehacer el clon sin volver a pedirlos. */
  muestras: MuestraGuardada[];
  /** El clon en ElevenLabs, si ya lo hizo. */
  clon?: ClonDeVoz;
};

const VACIO: VozCliente = { acento: '', muletillas: [], muestras: [] };

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
    const muestras = Array.isArray(v.muestras)
      ? (v.muestras as MuestraGuardada[]).filter((m) => m && typeof m.path === 'string')
      : [];
    // El clon sólo cuenta con `voiceId` Y autorización: los dos campos juntos son
    // lo que lo hace usable, y una mitad sin la otra es un estado que no debería
    // existir — si existe, se lee como «no hay clon», que es lo conservador.
    const c = v.clon;
    const clon = c && typeof c.voiceId === 'string' && c.voiceId && typeof c.autorizadoAt === 'string' && c.autorizadoAt
      ? {
        voiceId: c.voiceId,
        nombre: String(c.nombre ?? ''),
        creadoAt: String(c.creadoAt ?? ''),
        muestras: Array.isArray(c.muestras) ? c.muestras.filter((x): x is string => typeof x === 'string') : [],
        autorizadoAt: c.autorizadoAt,
      }
      : undefined;
    return { acento, muletillas, muestras, ...(clon ? { clon } : {}) };
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
    ...antes,
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
  // ⚠️ `...antes` PRIMERO: sin él, guardar las muletillas borraba el clon y las
  // muestras. El objeto se escribe ENTERO en una sola key, así que cada setter
  // que arma el suyo desde cero está tirando lo que no nombra — el mismo modo de
  // falla que un `upsert` de fila completa armado en el cliente.
  const nuevo: VozCliente = {
    ...antes,
    acento: antes.acento,
    muletillas: muletillas.filter((m) => validas.includes(m)),
  };
  await setSetting(KEY, JSON.stringify(nuevo));
  return nuevo;
}

// ── Los audios del cliente ─────────────────────────────────────────────────
//
// Van al bucket `archivero`, bajo `${ws}/voz/${id}` — el mismo molde que las
// FOTOS de `lib/persona.ts`, y por las mismas razones: es privado, ya lleva el
// workspace en la ruta, y lo vacía el reset del workspace.
//
// ⚠️ NO va a `video-clips`, que es el bucket de los clips terminados: ese es
// PÚBLICO y su ruta no lleva el workspace. La cara y la voz de una persona no
// se guardan en un bucket que contesta 200 sin sesión.

const BUCKET = 'archivero';

async function wsActual(): Promise<number> {
  return (await getWorkspaceActual()) ?? OWNER_WS;
}

/** Sube un audio del cliente y lo registra. Devuelve la muestra guardada. */
export async function subirMuestra(buf: Buffer, nombre: string, mime: string): Promise<MuestraGuardada> {
  const ws = await wsActual();
  const id = randomUUID();
  const path = `${ws}/voz/${id}`;
  const { error } = await getSupabaseServer().storage.from(BUCKET)
    .upload(path, buf, { contentType: mime || 'audio/mpeg', upsert: true });
  if (error) throw new Error(error.message);
  const m: MuestraGuardada = { id, nombre: (nombre || 'audio').slice(0, 120), mime: mime || 'audio/mpeg', path };
  const v = await getVozCliente();
  await setSetting(KEY, JSON.stringify({ ...v, muestras: [...v.muestras, m] }));
  return m;
}

/** Baja una muestra del storage para poder mandársela a ElevenLabs. */
export async function leerMuestra(path: string): Promise<Buffer | null> {
  const { data, error } = await getSupabaseServer().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Borra una muestra. El clon YA hecho no se toca: existe en ElevenLabs sin ella. */
export async function borrarMuestra(id: string): Promise<VozCliente> {
  const v = await getVozCliente();
  const m = v.muestras.find((x) => x.id === id);
  if (m) await getSupabaseServer().storage.from(BUCKET).remove([m.path]).catch(() => { /* la fila igual se va */ });
  const nuevo: VozCliente = { ...v, muestras: v.muestras.filter((x) => x.id !== id) };
  await setSetting(KEY, JSON.stringify(nuevo));
  return nuevo;
}

/** Anota el clon recién creado. */
export async function guardarClon(clon: ClonDeVoz): Promise<VozCliente> {
  const v = await getVozCliente();
  const nuevo: VozCliente = { ...v, clon };
  await setSetting(KEY, JSON.stringify(nuevo));
  return nuevo;
}

/** Olvida el clon. No borra nada en ElevenLabs: eso lo hace quien llama. */
export async function olvidarClon(): Promise<VozCliente> {
  const v = await getVozCliente();
  const nuevo: VozCliente = { ...v, clon: undefined };
  await setSetting(KEY, JSON.stringify(nuevo));
  return nuevo;
}
