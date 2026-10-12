// =============================================================================
// NumerosLanding — la línea «1.240 visitas · 96 leads en 30 días» de una fila (server, async)
// =============================================================================
// Va adentro de un <Suspense> en la `segunda` línea de la fila: la lista se pinta con lo que
// trae `listar` y cada número llega cuando su medición termina (streaming). Es un componente del
// SERVER aunque viaje como prop de FilaM (cliente): React lo resuelve aquí y manda sólo el texto,
// así que `medir` nunca cruza al navegador.
//
// Una medición que falla no dibuja nada: «0 visitas» sería un dato inventado.
// =============================================================================

import type { MedidaLanding } from './datos';
import { lineaNumeros } from './modelo';

export async function NumerosLanding({ medir }: { medir: () => Promise<MedidaLanding | null> }) {
  const n = await medir();
  return n ? <>{lineaNumeros(n.visitas, n.leads)}</> : null;
}
