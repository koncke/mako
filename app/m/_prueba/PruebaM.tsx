// =============================================================================
// La versión de prueba en el TELÉFONO (25/10/2026): el aviso corto de arriba y el cartel adentro del menú
// =============================================================================
// El Cerebro (25/10, sobre las capturas de Madgicx): «En celular, lo mismo dentro del menú, más un aviso corto arriba». El
// teléfono DESTILA el escritorio (memoria mako-mobile): el cartel de la barra lateral va en «Más», con el mismo texto
// (`textoCartelPrueba`), y arriba de cada pantalla una línea con los días y el botón. Sin JavaScript: son del servidor.
// Los dos llevan a «Tu plan» del teléfono, donde está «Empezar mi plan ya».
// =============================================================================

import { RUTA_EMPEZAR_PLAN_M, textoCartelPrueba } from '@/lib/prueba-plan-reglas';

const CSS = `
.mp-aviso { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 8px 12px 0; padding: 8px 12px;
  border-radius: 12px; background: color-mix(in srgb, var(--primary) 10%, var(--surface)); color: var(--primary-strong, var(--primary));
  font-size: 13px; font-weight: 700; text-decoration: none; }
.mp-aviso b { flex: none; padding: 4px 10px; border-radius: 999px; background: var(--primary); color: var(--on-primary, #fff); font-size: 12px; }
.mp-cartel { margin: 12px 0; padding: 16px; border-radius: 18px; text-align: center; color: var(--on-primary, #fff);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong, var(--primary)) 100%); }
.mp-cartel-titulo { font-size: 16px; font-weight: 800; }
.mp-cartel-linea { margin: 6px 0 12px; font-size: 13.5px; opacity: .92; }
.mp-cartel a { display: block; padding: 12px; border-radius: 12px; background: var(--surface, #fff); color: var(--primary-strong, var(--primary));
  font-weight: 800; font-size: 15px; text-decoration: none; }
`;

type Datos = { dias: number | null; plan: string; despues: string | null };

/** Arriba de cada pantalla: «Prueba · quedan 7 días» y el botón. */
export function AvisoPruebaM(p: Datos) {
  const t = textoCartelPrueba(p);
  return (
    <>
      <style>{CSS}</style>
      <a className="mp-aviso" href={RUTA_EMPEZAR_PLAN_M} aria-label={`${t.titulo}. ${t.boton}`}>
        <span>{t.titulo}</span><b>{t.boton}</b>
      </a>
    </>
  );
}

/** En «Más»: el cartel de la barra lateral, entero. */
export function CartelPruebaM(p: Datos) {
  const t = textoCartelPrueba(p);
  return (
    <div className="mp-cartel" role="region" aria-label="Versión de prueba">
      <style>{CSS}</style>
      <div className="mp-cartel-titulo">{t.titulo}</div>
      <p className="mp-cartel-linea">{t.linea}</p>
      <a href={RUTA_EMPEZAR_PLAN_M}>{t.boton}</a>
    </div>
  );
}
