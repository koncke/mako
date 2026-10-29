// =============================================================================
// zernio-uso — cuántos mensajes mandó un negocio por Zernio en su ciclo (29/10/2026)
// =============================================================================
// El audio de Leandro (28/10, 19:24): «lo que menos me gustaría… que se pare la automatización… y que Maco no me avise nada».
// Zernio da 10.000 mensajes ENVIADOS gratis por ciclo; sin tarjeta, al llegar ahí frena los envíos hasta el siguiente. El aviso
// antes del tope lo arma Automations (`avisarTopesSociales`, lib/nutricion.ts, el evento `social_tope`); acá vive el conteo y el
// ciclo, que es lo que el canal sabe de Zernio. Reparto acordado el 29/10 entre los dos chats, para que no salgan dos avisos.
//
// ⚠️ ZERNIO NO DA EL CONTEO (medido el 29/10): `GET /v1/usage?range=cycle` trae lo FACTURADO (`lineItems`), y con la clave del ws10
//    no trajo ninguna línea `messages` (las cuentas sí, con el crédito gratis que las anula). Pero MaKo no había mandado ni un
//    mensaje por redes desde el 01/09 en ningún negocio, así que eso no prueba que los gratis no aparezcan. Por eso se cuenta en
//    MaKo lo que MaKo mandó, y el texto del aviso dice «desde MaKo»: lo que el negocio mande desde el inbox de Zernio u otra
//    herramienta con la misma cuenta no se ve.
// ⚠️ EL «MES» ES EL CICLO de Zernio (`GET /v1/billing`, `cicloDeZernio`): arranca el día del alta, no el 1.º.
// ⚠️ ES UNA APROXIMACIÓN, y se dice en qué: una fila del motor (`nutricion_envios`) es UN mensaje aunque el paso haya salido en
//    varias partes (texto, archivo y pie son tres para Zernio), y la respuesta PÚBLICA a un comentario (gratis para Zernio)
//    cuenta igual, porque la fila no la distingue de un DM. Lo de Chats (`ig_mensajes` saliente) es una fila por mensaje.
// ⚠️ «NO PUDE LEER» ES null, NUNCA 0: sin Zernio, sin el ciclo o con la base caída no se avisa (un 0 diría «vas bien»).
//
// Lo prueba tests/zernio-uso.test.ts (con la base y Zernio de mentira, tests/_zernio-uso-hijo.ts).
// =============================================================================

import 'server-only';
import { cfg, zFetch } from './zernio';
import { getTenantDb, runWithWorkspace } from './workspace';
import { CANALES_SOCIALES } from './canal-social';
import { cicloDeZernio, MENSAJES_GRATIS_ZERNIO } from './zernio-redes';

export type UsoZernioDelCiclo = {
  /** Lo que MaKo mandó por Zernio en el ciclo: el motor (una fila por paso) más lo de Chats. */
  enviados: number;
  /** Lo que Zernio da gratis por ciclo (`MENSAJES_GRATIS_ZERNIO`). */
  gratis: number;
  /** El ciclo de Zernio, en ISO con Z: `desde` incluido, `hasta` excluido. */
  desde: string;
  hasta: string;
  /** La clave es la de la cuenta de MaKo (el ws1, `byok` false): el tope es de MaKo, no del negocio. */
  deLaCasa: boolean;
};

/** Cuántos mensajes mandó el negocio por Zernio en su ciclo, y cuántos son gratis. null = no se sabe (no se avisa). */
export async function usoZernioDelCiclo(ws: number): Promise<UsoZernioDelCiclo | null> {
  let c: Awaited<ReturnType<typeof cfg>>;
  try {
    c = await cfg(ws);
  } catch {
    return null;
  }
  let ciclo: ReturnType<typeof cicloDeZernio>;
  try {
    ciclo = cicloDeZernio(await zFetch<unknown>(c.apiKey, '/billing'));
  } catch {
    return null;
  }
  if (!ciclo) return null;
  const { desde, hasta } = ciclo;
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const [motor, chats] = await Promise.all([
      db.from('nutricion_envios').select('id', { count: 'exact', head: true })
        .in('canal', [...CANALES_SOCIALES]).eq('estado', 'enviado').gte('created_at', desde).lt('created_at', hasta),
      db.from('ig_mensajes').select('id', { count: 'exact', head: true })
        .eq('direccion', 'saliente').eq('estado', 'enviado').gte('created_at', desde).lt('created_at', hasta),
    ]);
    if (motor.error || chats.error || motor.count == null || chats.count == null) return null;
    return { enviados: motor.count + chats.count, gratis: MENSAJES_GRATIS_ZERNIO, desde, hasta, deLaCasa: !c.byok };
  });
}
