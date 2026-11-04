import 'server-only';

// =============================================================================
// spy-caricatura-servidor — encolar la caricatura de un competidor al leerlo (4/11/2026)
// =============================================================================
// El lado del servidor de la cola (lib/spy-caricatura-cola.ts): lo llama `leerCompetidorAhora` (lib/spy.ts) en cuanto
// su foto quedó en NUESTRO Storage. Sin IA, sin Flow y sin gastar nada: anota y listo. La genera el Runner con Canva.
// =============================================================================

import { cambiarSettingSi, getSettingEstricto } from './settings';
import { referenteDeCompetidor } from './spy-caricatura';
import { CLAVE_CARICATURAS, encolarCaricatura, type DepsEncolar } from './spy-caricatura-cola';
import { caricaturaGuardada } from './spy-miniaturas';

/** Con el negocio ya resuelto (el contexto del pedido): el registro es el de ESE negocio. */
const deps: DepsEncolar = {
  leer: async () => { const crudo = await getSettingEstricto(CLAVE_CARICATURAS); return { crudo, version: crudo }; },
  cambiarSi: (_ws, version, nuevo) => cambiarSettingSi(CLAVE_CARICATURAS, version, nuevo),
  hecha: (refs) => caricaturaGuardada(refs),
};

/** Nunca tira: una caricatura es una comodidad, y la tarjeta tiene su foto. */
export async function encolarAlLeer(ws: number, c: { id: number; nombre?: string | null; instagram: string | null; youtube_id: string | null; tiktok: string | null }, foto: string | null): Promise<void> {
  try {
    const r = await encolarCaricatura(deps, {
      ws, id: c.id, instagram: c.instagram, youtube_id: c.youtube_id, tiktok: c.tiktok, avatar: foto,
      referente: !!referenteDeCompetidor(c),
    });
    if (r === 'lista' || r === 'pendiente') console.log(`[spy-caricatura] ws=${ws} competidor=${c.id}: ${r}`);
  } catch (e) {
    console.error(`[spy-caricatura] ws=${ws} competidor=${c.id}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
