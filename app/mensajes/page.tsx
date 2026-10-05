// =============================================================================
// /mensajes — todo lo que MaKo le puede decir al dueño, y cómo lo dice
// =============================================================================
// Los ~48 mensajes del catálogo (lib/avisos-catalogo.ts) + los que crea el
// dueño: se ven como llegan al WhatsApp, se editan, se prenden y se apagan.
//
// POR QUÉ TIENE RUTA PROPIA Y NO ES UNA TAB DE /agencia. Vivía adentro, en
// `?tab=plantillas`, y desde la barra no había forma de llegar: el `match` de un
// item del nav recibe SOLO el pathname, así que dos items apuntando a /agencia
// se prenden los dos a la vez y el segundo es inalcanzable como destino. Un
// destino que no se puede nombrar en la barra es un destino que nadie encuentra
// — el dueño lo pidió con esas palabras («debería estar en la sidebar»).
//
// /agencia queda con lo suyo: el canal de WhatsApp de MaKo y el chat de sus
// grupos. El `?tab=plantillas` viejo redirige acá, así que los links guardados
// siguen funcionando.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { listarPlantillas } from '@/lib/plantillas';
import { MensajesMaKo } from './MensajesMaKo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MensajesPage() {
  if (!(await getSesionAdmin())) redirect('/login');
  // ⚠️ LA LISTA VIAJA CON LA PÁGINA. Esta ruta ya es `force-dynamic` y ya espera a la
  // sesión, así que leer el catálogo acá no agrega una request: lo que ahorra es la que
  // hacía el navegador al montar — medida, 264-472 ms DESPUÉS de los 268-412 del primer
  // pintado, o sea casi un segundo de spinner sobre datos que estaban a mano.
  //
  // Si la lectura falla, la pantalla se dibuja igual y pide la lista como siempre: un
  // error del server acá no puede dejar /mensajes en blanco.
  const iniciales = await listarPlantillas({ vista: 'agencia' }).catch(() => undefined);
  return <MensajesMaKo iniciales={iniciales} />;
}
