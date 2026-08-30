// =============================================================================
// video-datos — historial de planes y estado del contexto de la tab
// =============================================================================
// Mismo molde que app/reels/reels-datos.ts: el historial vive como JSON en
// app_settings (getSetting/setSetting ya scopean por workspace) en vez de una
// migración nueva, que colisiona con la numeración de otras corridas.
//
// Tope de 10 a propósito: app_settings guarda texto y el historial es para
// «recuperar el de ayer», no un archivo eterno. Si hace falta más, eso es una
// tabla con migración, no subir este número.
//
// ⚠️ Escritura read-modify-write sin lock: dos generaciones EXACTAMENTE
// simultáneas pueden perder una entrada del historial (no el plan en pantalla).
// Aceptado: es un historial de conveniencia, no la fuente de verdad de nada.

import 'server-only';
import { getSetting, setSetting } from '@/lib/settings';
import { getPersona, personaEstado } from '@/lib/persona';
import { resolverAcento } from '@/lib/acento-workspace';
import { tzDeWorkspace } from '@/lib/timezone';
import { getWorkspaceActual } from '@/lib/workspace';
import { getSchema, getAnswers } from '@/lib/onboarding';
import type { PlanVideo } from '@/lib/video-planner';

export const KEY_HISTORIAL_VIDEO = 'video-generator.historial';
const MAX_HISTORIAL = 10;

export type PlanGuardado = {
  id: string;
  /** El tema que pidió el usuario (para el rótulo del historial). */
  pedido: string;
  /**
   * El guion de MaKo del que salió, cuando salió de uno.
   *
   * Es lo que permite contestar «¿este guion ya lo grabé?» sin comparar textos:
   * un id es una clave, un texto parecido es un parecido. Opcional porque las
   * entradas viejas del historial no lo tienen — y un campo ausente se lee como
   * «no sé», que es la verdad.
   */
  guionId?: string;
  plan: PlanVideo;
  at: string;
  /**
   * Lo generado por toma, indexado por su número: el trabajo encolado, la
   * operación de Flow, y la URL del video cuando llega.
   *
   * Vive en el PLAN y no en una tabla porque es el mismo dato de conveniencia
   * que el resto del historial. ⚠️ Y hereda su tope de 10: un anuncio que se
   * recorta se lleva los enlaces a sus clips. Por eso el video hay que BAJARLO a
   * storage propio antes de que venza el TTL de Google (~1 h) — mientras eso no
   * exista, esto es un puntero con fecha de vencimiento, no un archivo.
   */
  video?: Record<string, {
    trabajoId?: number;
    operacion?: string;
    url?: string;
    mediaId?: string;
    error?: string;
    /** El saldo justo ANTES de generar esta toma. La otra mitad de medir el costo. */
    saldoAntes?: number | null;
  }>;
};

const esEntrada = (e: unknown): e is PlanGuardado => {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.at === 'string' && !!o.plan && typeof o.plan === 'object';
};

/** Historial del workspace (tolerante: basura o shape viejo → vacío). */
export async function leerHistorial(): Promise<PlanGuardado[]> {
  try {
    const raw = await getSetting(KEY_HISTORIAL_VIDEO);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter(esEntrada).slice(0, MAX_HISTORIAL) : [];
  } catch {
    return [];
  }
}

/** Agrega (o reemplaza por id) y recorta al tope. Devuelve el historial nuevo. */
export async function guardarEnHistorial(item: PlanGuardado): Promise<PlanGuardado[]> {
  const actual = await leerHistorial();
  const nuevo = [item, ...actual.filter((e) => e.id !== item.id)].slice(0, MAX_HISTORIAL);
  await setSetting(KEY_HISTORIAL_VIDEO, JSON.stringify(nuevo));
  return nuevo;
}

// ── Estado del contexto de la tab ────────────────────────────────────────────
// Dos requisitos, y son distintos: sin PERFIL el anuncio se escribe sobre nada;
// sin FOTO cada clip inventa una cara. El segundo es bloqueante de verdad y el
// motor lo corta con error propio — acá se lee para poder avisarlo ANTES, en la
// pantalla, en vez de dejar que el usuario escriba un tema y recién ahí falle.
//
// Estado VIVO, no recordado: se lee el estado de AHORA en cada carga. Si el
// cliente borra sus fotos, el aviso vuelve solo.

export type EstadoContextoVideo = {
  tieneFotos: boolean;
  cantidadFotos: number;
  /**
   * La primera foto de la cara de marca, firmada.
   *
   * Se trae la IMAGEN y no solo el conteo porque el paso de revisión tiene que
   * poder contestar «¿es esta persona?», y un número no lo contesta: «3 fotos»
   * se lee igual con las fotos correctas que con las de otro. Un parecido se
   * juzga mirando.
   */
  fotoUrl: string | null;
  /**
   * El acento que el server va a usar, ya resuelto.
   *
   * Baja resuelto y no como zona horaria a propósito: si el cliente lo dedujera
   * por su cuenta, la regla viviría en dos lugares y la previa podría mostrar un
   * acento distinto del que se termina usando. Una previa que difiere del
   * resultado es peor que no tener previa.
   */
  acento: { etiqueta: string; seguro: boolean };
  perfilListo: boolean;
  faltanDelPerfil: string[];
};

export async function estadoContextoVideo(): Promise<EstadoContextoVideo> {
  const [persona, perfil] = await Promise.all([
    getPersona().catch(() => null),
    (async () => {
      try {
        const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
        const faltan = schema
          .filter((g) => !g.fields.some((f) => (answers[f.key] ?? '').trim()))
          .map((g) => g.label);
        return { listo: faltan.length < schema.length, faltan };
      } catch {
        // Consulta caída ≠ perfil vacío, pero acá el estado solo pinta un aviso
        // suave (nunca bloquea): degradar a "no listo" es lo conservador.
        return { listo: false, faltan: [] as string[] };
      }
    })(),
  ]);

  const fotos = persona?.fotos.length ?? 0;
  // La URL firmada se pide solo si hay foto, y su fallo no tumba la pantalla: sin
  // imagen el paso muestra el aviso, que es peor que verla pero mucho mejor que
  // un error.
  let fotoUrl: string | null = null;
  if (fotos > 0) {
    try { fotoUrl = (await personaEstado()).fotos[0]?.url ?? null; } catch { fotoUrl = null; }
  }

  const ws = await getWorkspaceActual();
  const acento = resolverAcento(null, ws != null ? await tzDeWorkspace(ws).catch(() => null) : null);

  return {
    tieneFotos: fotos > 0,
    cantidadFotos: fotos,
    fotoUrl,
    acento: { etiqueta: acento.etiqueta, seguro: acento.seguro },
    perfilListo: perfil.listo,
    faltanDelPerfil: perfil.faltan,
  };
}
