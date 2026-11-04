// =============================================================================
// EmpezarPlanYa — el botón de un tope de la PRUEBA GRATIS (25/10/2026)
// =============================================================================
// El Cerebro (25/10): «cada pantalla le dice al que llega al tope "Disponible al terminar tu prueba" con un botón para
// empezar ya el plan». El texto lo arma lib/topes-plan.ts (`textoTopePrueba`); este botón va al lado del error de cada
// pantalla y lleva a «Tu plan» con «Empezar mi plan ya» a la vista (`RUTA_EMPEZAR_PLAN`). Con `texto`, se dibuja SÓLO si
// ese texto es un tope de la prueba: así cada pantalla lo pone junto a su error sin preguntar nada más.
//
// ⚠️ EN UN TELÉFONO NO SE DIBUJA (T5, docs/tiendas-play-appstore.md, 3/11/2026): las pantallas de escritorio que lo traen
//    también se abren desde el teléfono, y el teléfono no vende. Sólo aparece después de un error, nunca en el primer dibujo
//    del servidor, así que mirar el navegador no descuadra la hidratación.
// =============================================================================

import { esTopeDePrueba, RUTA_EMPEZAR_PLAN } from '@/lib/topes-plan';
import { esTelefono } from '@/lib/telefono';

export function EmpezarPlanYa({ texto }: { texto?: string | null }) {
  if (texto !== undefined && !esTopeDePrueba(texto)) return null;
  if (typeof navigator !== 'undefined' && esTelefono(navigator.userAgent)) return null;
  return (
    <a href={RUTA_EMPEZAR_PLAN} className="mk-btn mk-btn--primary mk-btn--sm" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
      Empezar mi plan ya
    </a>
  );
}
