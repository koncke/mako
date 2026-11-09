import 'server-only';

// =============================================================================
// El aviso de un envío trabado, mandado — la mitad que toca la base (9/11/2026)
// =============================================================================
// El CRITERIO (a quién se le avisa y de qué) es puro y vive en `lib/envio-trabado.ts`, con sus tests.
// Acá queda sólo el acto de mandarlo, que necesita el catálogo y el workspace.
//
// ⚠️ ESTÁ EN SU PROPIO ARCHIVO POR UNA GUARDA, NO POR GUSTO: `tests/canal-social.test.ts` le pone un
// tope de 3.000 caracteres a la rama social del motor (`lib/nutricion.ts`), y el bloque inline lo
// pasaba a 3.245. El tope existe para que esa rama se siga leyendo de una sentada: cada cosa nueva
// que el motor tiene que hacer sale a una función con nombre, no se apila ahí adentro.
// =============================================================================

import { avisoDeEnvioTrabado, type CausaDelNegocio } from './envio-trabado';

/**
 * Le avisa al negocio, en SU grupo, que sus mensajes no salen por un ajuste suyo.
 *
 * ⚠️ NUNCA TIRA. Un aviso que falla no puede tumbar la corrida del motor ni perder el paso que se
 * estaba mandando: el envío ya se reintenta por su cuenta, y el aviso es un extra.
 */
export async function avisarEnvioTrabado(causa: CausaDelNegocio, canal: string, ws: number | null): Promise<void> {
  const av = avisoDeEnvioTrabado(causa, canal);
  if (!av) return;
  try {
    const { emitirDelCatalogo } = await import('./avisos');
    await emitirDelCatalogo(av.id, {
      ws: ws ?? undefined, contexto: av.contexto, dedupKey: av.dedupKey, dedupTtlMin: av.dedupTtlMin,
    });
  } catch (e) {
    console.error(`[envio-trabado] no pude avisar (${causa}, ${canal}): ${e instanceof Error ? e.message : String(e)}`);
  }
}
