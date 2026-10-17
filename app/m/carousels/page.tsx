// =============================================================================
// /m/carousels — «Carousels» (Image › Carousels) en el teléfono: MaKo escribe el carrusel, slide a slide
// =============================================================================
// La tab de escritorio (app/carousels) destilada: el MISMO pedido (qué carrusel necesitas + de qué tipo, los tres
// de app/carousels/pieza.ts), el MISMO motor (`generarCarruselAction`, lib/ig-writer.ts), las slides con su rol
// (portada · desarrollo · cierre), editar el texto y la nota de diseño de cada una y el caption antes de copiar, y
// «Copiar el carrusel» con el mismo texto (`carruselATexto`). Como en escritorio, las piezas de la sesión viven en la
// pantalla (no hay historial guardado).
//
// Referencia de app real: el post de carrusel de Instagram en el teléfono. Las slides se deslizan de costado, una
// por pantalla en 4:5, con el «1/7» arriba a la derecha y los puntos abajo; el caption debajo, cortado en el «… más»
// de los 125 caracteres. Tocar una slide abre su edición en una hoja, como el editor de texto de Canva del teléfono.
//
// Quién: la MISMA puerta que escritorio, `requireRolWs([], { nav: 'carousels' })`. Arriba, la barra de secciones
// de Image con las que esa persona ve.
// ⚠️ Sin el wizard de onboarding de escritorio: la primera pieza lo cierra (`generarCarruselAction` marca los dos
//    pasos), y el aviso del perfil vacío queda en una fila, como el de escritorio debajo del botón.
// =============================================================================

import './carousels.css';
import { requireMovil } from '@/lib/movil-guard';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { vistaDe } from '../_creacion/secciones';
import { CarouselsM } from './CarouselsM';

export const dynamic = 'force-dynamic';

export default async function CarouselsPagina() {
  const ctx = await requireMovil({ navKey: 'carousels' });
  // ¿El brief del negocio tiene algo cargado? Lo mismo que pregunta la page de escritorio.
  let perfilCargado = true;
  try { perfilCargado = (await perfilNegocioTexto()).trim().length > 0; } catch { /* sin perfil legible: no se afirma que está vacío */ }
  return (
    <PantallaM>
      <SeccionesTabM tab="image" activa="carousels" vista={vistaDe(ctx)} />
      <CarouselsM perfilCargado={perfilCargado} />
    </PantallaM>
  );
}
