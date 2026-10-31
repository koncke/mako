// =============================================================================
// PreciosLanding — las columnas de precios EN la landing de venta (24/10/2026)
// =============================================================================
// Martín: «No voy a usar Calendly, te dije que pongas las columnas de pricing de las ofertas». docs/estrategia-financiera-
// mako.md, «Qué hacer el lunes», punto 1: «los tres precios visibles … con un botón por columna. Sin eso, todo lo demás no
// tiene dónde hacer clic». Va donde estaba la agenda (#cal-embed) o, si el diseño publicado no la tiene, antes del pie
// (app/vsl/Landing.tsx). Cada botón lleva a /planes/<id> con el origen de la campaña y el código de partner de la URL: ahí
// se paga, o, sin pasarela, se pide y queda en el CRM (lib/compra-plan.ts). El anual no se muestra: el checkout cobra por mes.
// =============================================================================

import { useEffect, useState } from 'react';
import { bajadaDePlanes } from '@/lib/compra-plan-reglas';
import type { EstadoOferta } from '@/lib/oferta-entrada-reglas';
import { CSS_TARJETAS, TarjetasPlanes, type PlanEnTarjeta } from '@/app/planes/Tarjetas';
import { CSS_PLANES } from '@/app/planes/estilo';
import { CSS_VITRINA, CompararPlanes } from '@/app/planes/Vitrina';

/** Un plan como lo dibuja la landing, con si se cobra en línea (la misma cuenta que /planes: `ofertasDeLosPlanes`). */
export type PlanEnLanding = PlanEnTarjeta;

/** Lo que se pasa de la URL de la landing a la página del plan. Sólo estas claves (las mismas que /planes). */
export const CLAVES_A_PLANES = ['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'ref'] as const;

/** El sufijo para los botones: las claves de la URL actual que pasan, recortadas. Puro (lo prueba el test). */
export function sufijoDesdeUrl(search: string, landing: string | null): string {
  const de = new URLSearchParams(search);
  const qs = new URLSearchParams();
  for (const k of CLAVES_A_PLANES) {
    const v = de.get(k)?.trim();
    if (v) qs.set(k, v.slice(0, 250));
  }
  if (landing && !qs.has('landing')) qs.set('landing', landing);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// Los bloques son LOS MISMOS de /planes (app/planes/Tarjetas.tsx, 24/10/2026, noche: «Tienes que VENDER»): una sola pieza,
// así la landing y la página de precios no dicen dos cosas distintas del mismo plan.
const CSS = `
.mk-precios { font-family: inherit; color: #12151B; }
.mk-precios-titulo { text-align: center; margin: 0 0 8px; font-size: 34px; line-height: 1.15; letter-spacing: -.02em; font-weight: 800; }
.mk-precios-sub { text-align: center; margin: 0 auto 30px; max-width: 580px; color: #5B6472; font-size: 16px; line-height: 1.5; }
.mk-precios-pie { text-align: center; margin: 26px 0 0; color: #5B6472; font-size: 14px; }
.mk-precios-pie a { color: #2F6FED; font-weight: 600; text-decoration: none; }
`;

/**
 * ¿El reloj del 50% sigue vivo? La landing se sirve con caché, así que se pregunta acá, a la misma ruta que el cartel (`CartelOferta`), y se apaga
 * solo al llegar a cero. Sin respuesta, el precio de siempre: nunca se dice un descuento que no se sabe si vale.
 */
function useOfertaVigente(): boolean {
  const [viva, setViva] = useState(false);
  useEffect(() => {
    let vivo = true;
    let fin: ReturnType<typeof setTimeout> | undefined;
    fetch('/api/oferta-entrada', { method: 'POST' }).then((r) => r.json()).then((e: EstadoOferta) => {
      if (!vivo || !e.activa) return;
      setViva(true);
      fin = setTimeout(() => setViva(false), e.restanteMs);
    }).catch(() => {});
    return () => { vivo = false; if (fin) clearTimeout(fin); };
  }, []);
  return viva;
}

export function PreciosLanding({ planes, sufijo }: { planes: readonly PlanEnLanding[]; sufijo: string }) {
  const ofertaVigente = useOfertaVigente();
  return (
    <div className="mk-precios" id="precios">
      {/* La comparación de /planes, tal cual (29/10/2026, Martín: «en la landing no está la comparativa, la tabla»): sus
          clases son `planes-*`, así que su hoja no toca el diseño de la landing. */}
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_TARJETAS + CSS_PLANES + CSS_VITRINA }} />
      <h2 className="mk-precios-titulo">Elige cómo quieres crecer con MaKo</h2>
      <p className="mk-precios-sub">Por tu cuenta, con MaKo, o con nosotros a tu lado. {bajadaDePlanes(planes.some((p) => p.cobrable))}</p>
      <TarjetasPlanes ofertaVigente={ofertaVigente} planes={planes} sufijo={sufijo} />
      <CompararPlanes planes={planes} />
      <p className="mk-precios-pie"><a href={`/planes${sufijo}`}>Ver los planes y las preguntas frecuentes</a></p>
    </div>
  );
}
