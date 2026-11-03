// =============================================================================
// La versión de prueba en el TELÉFONO (25/10/2026): el aviso corto de arriba y el cartel adentro del menú
// =============================================================================
// El Cerebro (25/10, sobre las capturas de Madgicx): «En celular, lo mismo dentro del menú, más un aviso corto arriba». El
// teléfono DESTILA el escritorio (memoria mako-mobile): el cartel de la barra lateral va en «Más», con el mismo texto
// (`textoCartelPrueba`), y arriba de cada pantalla una línea con los días. Sin JavaScript: son del servidor.
//
// ⚠️ EL TELÉFONO NO VENDE (T5, docs/tiendas-play-appstore.md, 3/11/2026): sin el botón «Pasar al plan ya» y sin el precio de
//    después. Dicen cuánto queda, y nada más. tests/tiendas-telefono-no-vende.test.ts lo fija.
// =============================================================================

import { textoCartelPrueba } from '@/lib/prueba-plan-reglas';

const CSS = `
.mp-aviso { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 8px 12px 0; padding: 8px 12px;
  border-radius: 12px; background: color-mix(in srgb, var(--primary) 10%, var(--surface)); color: var(--primary-strong, var(--primary));
  font-size: 13px; font-weight: 700; text-decoration: none; }
.mp-cartel { margin: 12px 0; padding: 16px; border-radius: 18px; text-align: center; color: var(--on-primary, #fff);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong, var(--primary)) 100%); }
.mp-cartel-titulo { font-size: 16px; font-weight: 800; }
`;

type Datos = { dias: number | null; plan: string; despues: string | null };

/** Arriba de cada pantalla: «Prueba · quedan 7 días». */
export function AvisoPruebaM(p: Datos) {
  const t = textoCartelPrueba(p);
  return (
    <>
      <style>{CSS}</style>
      <div className="mp-aviso" role="status"><span>{t.titulo}</span></div>
    </>
  );
}

/** En «Más»: el cartel de la barra lateral, con lo que queda. */
export function CartelPruebaM(p: Datos) {
  const t = textoCartelPrueba(p);
  return (
    <div className="mp-cartel" role="region" aria-label="Versión de prueba">
      <style>{CSS}</style>
      <div className="mp-cartel-titulo">{t.titulo}</div>
    </div>
  );
}
