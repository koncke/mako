// =============================================================================
// restablecer-aviso — EL EMISOR del pedido de restablecer la contraseña (15/10/2026)
// =============================================================================
// Lo llama la ruta de recuperación de Seguridad («Olvidé mi contraseña»), adentro de un `after()`: el mail lo manda la
// automatización de SuperAdmin «Restablecer Contraseña» (todo por Automations), y acá vive el CONTRATO para emitirlo
// en un solo lugar, no repetido en cada llamador:
//   · en el ws de la PLATAFORMA (`wsSuperAdmin`): ahí vive la automatización, y el negocio es un dato;
//   · SIN `texto`: sin una automatización prendida, el texto va al feed, y el link es secreto;
//   · SIN dedup: cada pedido es un link distinto (el freno de pedidos por cuenta es de Seguridad);
//   · los datos, de `valoresDeRestablecer` (lib/variables-del-lead.ts).
// Contesta lo que se SABE: si corrió, si no hay ninguna prendida, o si no se pudo leer. Si el mail salió no lo sabe
// (corre adentro del runner): eso lo dicen el log y el grupo de la plataforma (lib/email-persona.ts).
import 'server-only';
import { emitirDelCatalogo } from './avisos';
import { wsSuperAdmin } from './workspace';
import { valoresDeRestablecer } from './variables-del-lead';

export type PedidoDeRestablecer = 'corrio' | 'apagado' | 'ilegible';

export async function avisarPedidoDeRestablecer(usuarioId: number, link: string): Promise<PedidoDeRestablecer> {
  const r = await emitirDelCatalogo('seguridad-contrasena-restablecer', {
    ws: await wsSuperAdmin(),
    datos: valoresDeRestablecer({ usuarioId, link }),
  });
  if (!r.ok) return 'ilegible';
  return (r as { apagado?: boolean }).apagado ? 'apagado' : 'corrio';
}
