import 'server-only';

// =============================================================================
// creem-moderacion — pasar un prompt por el Moderation API de Creem antes de generar imagen o video (5/11/2026)
// =============================================================================
// Lo que decide está en lib/creem-moderacion-reglas.ts (puro, con test). Esto pone las tres cosas que no se pueden
// probar sin la red: la CLAVE, el RECUERDO del proceso y la MEDICIÓN.
//
// LA CLAVE ES LA DE LA PLATAFORMA, no la del negocio: quien vende MaKo en Creem es MaKo (el negocio de la plataforma,
// `wsSuperAdmin()`), y Creem le pide a ÉL que modere todo lo que sus usuarios generan. Se lee con `credDelCliente` del
// workspace de la plataforma: nunca `process.env` ni el ws1. ⚠️ La clave no sale de este archivo: ni a un log, ni a un
// mensaje de error, ni al navegador (el módulo es server-only y nadie la devuelve).
//
// CADA LLAMADA QUEDA MEDIDA en `anthropic_usage` (proveedor `creem`, feature `creem-moderacion`), a nombre de la
// plataforma: es un gasto de MaKo, no del negocio que generó. El motivo dice el negocio, de dónde vino, la decisión, las
// unidades que contó Creem y cuánto tardó. El costo queda en US$0 porque Creem no publicó (en lo que se pudo leer el
// 5/11/2026) cuánto cobra la unidad: las unidades sí quedan, y con el precio se calcula.
// Lo que NO llama a Creem (un prompt vacío, una decisión recordada) no deja fila: no es una llamada.
// =============================================================================

import { createHash, randomUUID } from 'node:crypto';
import { credDelCliente } from './credenciales';
import { recordUsage } from './anthropic-usage';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';
import { moderarConDeps, motivoDeMedicion, type Veredicto } from './creem-moderacion-reglas';

const g = globalThis as unknown as { __makoModeracionCreem?: Map<string, { hasta: number; v: Veredicto }> };
// El ws va adentro de la clave del recuerdo (`moderarConDeps`): una caché del server es de todos los inquilinos.
const recuerdo = (g.__makoModeracionCreem ??= new Map());

/**
 * Modera el prompt que está por ir a un modelo de imagen o video. NUNCA TIRA.
 * `origen`: de dónde sale el pedido (`generar_clip`, `generar_imagen`…), para la medición.
 */
export async function moderarPrompt(prompt: string, origen: string): Promise<Veredicto> {
  let ws: number | null = null;
  try { ws = await getWorkspaceActual(); } catch { ws = null; }
  const ctx = { ws, origen, azar: randomUUID() };
  let plataforma: number | null = null;

  const v = await moderarConDeps(prompt, ctx, {
    clave: async () => {
      plataforma = await wsSuperAdmin();
      return credDelCliente('CREEM_API_KEY', plataforma);
    },
    fetch,
    ahora: Date.now,
    recuerdo,
    huella: (s) => createHash('sha256').update(s).digest('hex'),
  });

  // ── La medición ──
  const motivo = motivoDeMedicion(v, ctx);
  if (v.por === 'vacio' || (v.por === 'creem' && v.recordado)) return v;
  if (v.por === 'creem' || v.por === 'creem_no_contesto' || v.por === 'clave_rechazada') {
    // Hubo una llamada (contestara o no): se anota.
    await recordUsage('creem-moderacion', 'creem-moderation', {}, motivo, 'creem', 1, plataforma ?? undefined).catch(() => null);
  }
  if (v.por === 'creem') {
    if (v.decision !== 'allow') console.warn(`[creem-moderacion] ${motivo}`);
    return v;
  }
  console.error(`[creem-moderacion] ${motivo}`);
  // Lo que es NUESTRO (no hay clave, o Creem la rechaza) se arregla de nuestro lado: va a los errores de la app, que
  // abren su ticket una vez por huella. Que Creem no conteste es un bache del proveedor, no un bug: sólo queda anotado.
  if (v.por === 'sin_clave' || v.por === 'clave_rechazada') {
    try {
      const { registrarError } = await import('./errores-app');
      await registrarError({
        origen: 'servidor',
        nombre: 'ModeracionCreem',
        mensaje: v.por === 'sin_clave'
          ? 'La moderación de Creem no corre: la plataforma no tiene CREEM_API_KEY (o no se pudo leer). Las imágenes y los videos se generan sin moderar.'
          : 'La moderación de Creem no corre: Creem rechaza la clave de la plataforma. Las imágenes y los videos se generan sin moderar.',
      }, null);
    } catch { /* registrar nunca rompe la generación */ }
  }
  return v;
}
