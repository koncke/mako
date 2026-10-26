'use client';

// =============================================================================
// CartelPrueba — «Versión de prueba · quedan N días», al pie de la barra lateral (25/10/2026)
// =============================================================================
// Martín (25/10): «Me gusta el cartel de "limited version" de 7 días de madgicx para implementar en la prueba gratuita de
// MaKo». Copiado de Madgicx (docs/media-buyer/referencias/madgicx/prueba-limitada/LEEME.md): la tarjeta va fija al PIE de
// la barra lateral, en todas las pantallas, con el título y los días que quedan, una línea con lo que se cobra después y el
// botón para pasar al plan ya. Madgicx la hace con un degradé violeta y el botón blanco; acá, con el azul de MaKo
// (`--primary` → `--primary-strong`), que cambia solo con el tema oscuro. Con la barra plegada, una pastilla con los días.
// Sin prueba (o sin poder leerla), no se dibuja nada. Los textos, de lib/prueba-plan-reglas.ts (`textoCartelPrueba`).
// =============================================================================

import { RUTA_EMPEZAR_PLAN } from '@/lib/topes-plan';
import { textoCartelPrueba } from '@/lib/prueba-plan-reglas';
import { usePrueba } from '@/app/_ui/usePrueba';

const CSS = `
.cp-cartel { margin: 0 6px 10px; padding: 14px 14px 12px; border-radius: 16px; text-align: center; color: var(--on-primary, #fff);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong, var(--primary)) 100%);
  box-shadow: 0 8px 22px color-mix(in srgb, var(--primary) 28%, transparent); }
.cp-titulo { font-size: 13.5px; font-weight: 700; line-height: 1.3; }
.cp-linea { margin: 6px 0 10px; font-size: 12px; line-height: 1.4; opacity: .92; }
.cp-boton { display: block; padding: 8px 10px; border-radius: 10px; background: var(--surface, #fff); color: var(--primary-strong, var(--primary)) !important;
  font-size: 13px; font-weight: 700; text-decoration: none; }
.cp-boton:hover { filter: brightness(.97); }
.cp-pastilla { display: flex; align-items: center; justify-content: center; margin: 0 4px 10px; height: 30px; border-radius: 10px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong, var(--primary)) 100%); color: var(--on-primary, #fff) !important;
  font-size: 11.5px; font-weight: 800; text-decoration: none; }
`;

export function CartelPrueba({ open }: { open: boolean }) {
  const prueba = usePrueba();
  if (!prueba) return null;
  const t = textoCartelPrueba({ dias: prueba.dias, plan: prueba.plan, despues: prueba.despues });
  return (
    <>
      <style>{CSS}</style>
      {open ? (
        <div className="cp-cartel" role="region" aria-label="Versión de prueba">
          <div className="cp-titulo">{t.titulo}</div>
          <p className="cp-linea">{t.linea}</p>
          <a className="cp-boton" href={RUTA_EMPEZAR_PLAN}>{t.boton}</a>
        </div>
      ) : (
        <a className="cp-pastilla" href={RUTA_EMPEZAR_PLAN} title={`${t.titulo}. ${t.boton}`} aria-label={`${t.titulo}. ${t.boton}`}>
          {prueba.dias == null ? 'Prueba' : `${prueba.dias} d`}
        </a>
      )}
    </>
  );
}
