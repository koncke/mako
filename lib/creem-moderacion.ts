import 'server-only';

// =============================================================================
// creem-moderacion — pasar un prompt por un moderador antes de generar imagen o video (5/11/2026)
// =============================================================================
// ⚠️ HOY NO MODERA NADIE (5/11/2026 a la noche): Creem rechazó la tienda de MaKo y `PROVEEDOR_DE_MODERACION` vale null
// (lib/creem-moderacion-reglas.ts, con el porqué y cómo se enchufa otro). `moderarPrompt` contesta `sin_proveedor` y se
// genera: sin leer el workspace ni una clave, sin red, sin fila de uso y sin ticket. El nombre del archivo es de cuando
// moderaba Creem; se queda porque lo nombran AGENTS.md y la bitácora.
//
// Lo que decide está en lib/creem-moderacion-reglas.ts (puro, con test). Esto pone las tres cosas que no se pueden probar
// sin la red, para el día que haya un proveedor: la CLAVE, el RECUERDO del proceso y la MEDICIÓN.
//
// LA CLAVE ES LA DE LA PLATAFORMA, no la del negocio: quien vende MaKo es MaKo (el negocio de la plataforma,
// `wsSuperAdmin()`), y es a él a quien se le pide moderar lo que generan sus usuarios. Se lee con `credDelCliente` del
// workspace de la plataforma: nunca `process.env` ni el ws1. ⚠️ La clave no sale de este archivo: ni a un log, ni a un
// mensaje de error, ni al navegador (el módulo es server-only y nadie la devuelve).
//
// CADA LLAMADA QUEDA MEDIDA en `anthropic_usage` (proveedor = el nombre del moderador, feature `moderacion-prompts`), a
// nombre de la plataforma: es un gasto de MaKo, no del negocio que generó. El motivo dice el negocio, de dónde vino, la
// decisión, las unidades que contó el proveedor y cuánto tardó. Hasta el 5/11/2026 la feature se llamaba `creem-moderacion`.
// Lo que NO llama a nadie (sin proveedor, un prompt vacío, una decisión recordada, sin clave) no deja fila: no es una llamada.
// =============================================================================

import { createHash, randomUUID } from 'node:crypto';
import { credDelCliente } from './credenciales';
import { recordUsage } from './anthropic-usage';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';
import { moderarConDeps, motivoDeMedicion, PROVEEDOR_DE_MODERACION, type ProveedorModeracion, type Veredicto } from './creem-moderacion-reglas';

const g = globalThis as unknown as { __makoModeracionCreem?: Map<string, { hasta: number; v: Veredicto }> };
// El ws va adentro de la clave del recuerdo (`moderarConDeps`): una caché del server es de todos los inquilinos.
const recuerdo = (g.__makoModeracionCreem ??= new Map());

/**
 * Modera el prompt que está por ir a un modelo de imagen o video. NUNCA TIRA.
 * `origen`: de dónde sale el pedido (`generar_clip`, `generar_imagen`…), para la medición.
 * `opts.proveedor`: SÓLO para el test que ejecuta este archivo con un moderador de mentira (tests/_creem-moderacion-hijo.ts).
 * La generación llama sin opciones, con el de `PROVEEDOR_DE_MODERACION`.
 */
export async function moderarPrompt(prompt: string, origen: string, opts: { proveedor?: ProveedorModeracion | null } = {}): Promise<Veredicto> {
  const proveedor = opts.proveedor === undefined ? PROVEEDOR_DE_MODERACION : opts.proveedor;
  // Sin moderador no se lee nada: ni el negocio ni una clave. `moderarConDeps` contesta lo mismo, pero sin pasar por acá.
  if (!proveedor) return { paso: true, por: 'sin_proveedor' };

  let ws: number | null = null;
  try { ws = await getWorkspaceActual(); } catch { ws = null; }
  const ctx = { ws, origen, azar: randomUUID() };
  let plataforma: number | null = null;

  const v = await moderarConDeps(prompt, ctx, {
    proveedor,
    clave: async (credencial) => {
      plataforma = await wsSuperAdmin();
      return credDelCliente(credencial, plataforma);
    },
    fetch,
    ahora: Date.now,
    recuerdo,
    huella: (s) => createHash('sha256').update(s).digest('hex'),
  });

  // ── La medición ──
  const motivo = motivoDeMedicion(v, ctx);
  if (v.por === 'vacio' || v.por === 'sin_proveedor' || (v.por === 'proveedor' && v.recordado)) return v;
  // Sin clave, en silencio: no es culpa de quien genera, y una clave que falta no frena ni abre un ticket (5/11/2026).
  if (v.por === 'sin_clave') return v;
  // Hubo una llamada (contestara o no): se anota.
  await recordUsage('moderacion-prompts', `${proveedor.nombre}-moderation`, {}, motivo, proveedor.nombre, 1, plataforma ?? undefined).catch(() => null);
  if (v.por === 'proveedor') {
    if (v.decision !== 'allow') console.warn(`[moderacion] ${motivo}`);
    return v;
  }
  console.error(`[moderacion] ${motivo}`);
  // Una clave RECHAZADA sí es nuestra (hay un moderador elegido y su clave no anda): va a los errores de la app, que abren
  // su ticket una vez por huella. Que el proveedor no conteste es un bache suyo, no un bug: sólo queda anotado.
  if (v.por === 'clave_rechazada') {
    try {
      const { registrarError } = await import('./errores-app');
      await registrarError({
        origen: 'servidor',
        nombre: 'ModeracionDePrompts',
        mensaje: `La moderación de ${proveedor.nombre} no corre: rechaza la clave de la plataforma (${proveedor.credencial}). Las imágenes y los videos se generan sin moderar.`,
      }, null);
    } catch { /* registrar nunca rompe la generación */ }
  }
  return v;
}
