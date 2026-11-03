'use client';

// =============================================================================
// DocumentoVivo — «Tu oferta» ARMÁNDOSE al costado del chat (29/10/2026)
// =============================================================================
// Martín, 29/10/2026: «que al ir respondiendo las preguntas que te va haciendo MaKo que tu "offer" se arme al costado».
// Es el centro de la tab Offer dentro de la pantalla de Create (app/_crear/PantallaCrear.tsx): el chat a la izquierda y,
// acá, la oferta como DOCUMENTO, sección por sección, con lo que MaKo ya sabe (./documento-vivo.ts). Lo que falta no se
// dibuja (sin «falta»): aparece cuando se contesta, y la pieza recién llegada se resalta un momento.
// Arriba, lo que antes estaba al pie del riel: «Armar mi oferta» cuando están las mínimas y «Ver mi oferta» con la versión
// armada (la ventana de siempre, Conclusion.tsx).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/app/_ui';
import { MakoStar } from '@/app/_components/MakoBrand';
import type { OfferSesionVista } from '@/lib/offer-marco';
import type { AccionesPiezas } from './PiezasRail';
import { caminoDeSesion } from './arbol';
import { documentoDeOferta, piezaMasNueva } from './documento-vivo';

// ⚠️ `of-vivo`, NO `of-doc` (29/10/2026): `.of-doc` es la tarjeta del PDF (app/offer/estilos.ts, `max-width: 340px` y
// `display: flex`), y con ese nombre la oferta quedaba en una columna de 340 px con media pantalla vacía.
// tests/offer-en-create.test.ts cuida que ninguna clase de aquí esté definida también en estilos.ts.
const CSS = `
.of-vivo { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; padding: 16px 20px 32px; }
.of-vivo__hoja { box-sizing: border-box; max-width: 760px; margin: 0 auto; padding: 36px 44px 44px; background: var(--surface);
  border-radius: 14px; box-shadow: 0 1px 2px rgba(18,21,27,.05), 0 0 0 1px var(--border); }
.of-vivo__cab { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 8px; }
.of-vivo__titulos { flex: 1; min-width: 0; }
.of-vivo__camino { margin: 0 0 4px; font-size: var(--fs-meta); font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: .04em; }
.of-vivo__titulo { margin: 0; font-size: 26px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); overflow-wrap: anywhere; }
.of-vivo__acciones { flex: none; display: flex; gap: 8px; }
.of-vivo__vacio { margin: 18px 0 0; font-size: var(--fs-md); color: var(--dim); }
.of-vivo__seccion { margin-top: 28px; }
.of-vivo__seccion h2 { margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 700;
  color: var(--primary-strong); text-transform: uppercase; letter-spacing: .05em; }
.of-vivo__pieza { margin: 0 -10px; padding: 8px 10px; border-radius: 10px; }
.of-vivo__pieza + .of-vivo__pieza { margin-top: 4px; }
.of-vivo__pieza h3 { margin: 0 0 2px; font-size: var(--fs-sm); font-weight: 600; color: var(--dim); }
.of-vivo__pieza p { margin: 0; font-size: var(--fs-md); line-height: 1.55; color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.of-vivo__pieza[data-nueva="si"] { animation: of-vivo-llega 2.4s ease-out; }
@keyframes of-vivo-llega { 0% { background: var(--mako-bg); } 100% { background: transparent; } }
@media (max-width: 760px) {
  .of-vivo { padding: 8px 12px 24px; }
  .of-vivo__hoja { padding: 22px 18px 28px; }
  .of-vivo__cab { flex-direction: column; }
  .of-vivo__titulo { font-size: 22px; }
}
@media (prefers-reduced-motion: reduce) { .of-vivo__pieza[data-nueva="si"] { animation: none; } }
`;

export function DocumentoVivo({ sesion, acciones }: { sesion: OfferSesionVista; acciones: AccionesPiezas }) {
  const secciones = useMemo(() => documentoDeOferta(sesion.piezas), [sesion.piezas]);
  const camino = caminoDeSesion(sesion);
  // La pieza que llegó con la última respuesta se resalta UNA vez: al abrir la conversación no hay «recién llegada».
  const masNueva = piezaMasNueva(sesion.piezas);
  const vista = useRef<{ sesion: number; pieza: string | null } | null>(null);
  const [resaltada, setResaltada] = useState<string | null>(null);
  useEffect(() => {
    const antes = vista.current;
    vista.current = { sesion: sesion.id, pieza: masNueva };
    if (antes && antes.sesion === sesion.id && masNueva && masNueva !== antes.pieza) setResaltada(masNueva);
  }, [sesion.id, masNueva]);
  return (
    <div className="of-vivo" role="region" aria-label="Tu oferta">
      <style href="of-vivo" precedence="medium">{CSS}</style>
      <article className="of-vivo__hoja">
        <header className="of-vivo__cab">
          <div className="of-vivo__titulos">
            <p className="of-vivo__camino">{camino.funnel}</p>
            <h1 className="of-vivo__titulo">{camino.oferta}</h1>
          </div>
          {(acciones.puedeConcluir || acciones.hayConclusion) && (
            <div className="of-vivo__acciones">
              {acciones.hayConclusion && <Button variant="secondary" onClick={acciones.onVer}>Ver mi oferta</Button>}
              {acciones.puedeConcluir && (
                <Button variant="mako" disabled={acciones.ocupado} onClick={acciones.onArmar} icon={<MakoStar size={16} color="currentColor" />}>
                  {acciones.etiquetaArmar}
                </Button>
              )}
            </div>
          )}
        </header>
        {secciones.length === 0 && <p className="of-vivo__vacio">Tu oferta se arma aquí mientras le contestas a MaKo.</p>}
        {secciones.map((s) => (
          <section key={s.titulo} className="of-vivo__seccion">
            <h2>{s.titulo}</h2>
            {s.piezas.map((p) => (
              <div key={p.key} className="of-vivo__pieza" data-de={p.estado} data-nueva={p.key === resaltada ? 'si' : undefined}>
                <h3>{p.titulo}</h3>
                <p>{p.valor}</p>
              </div>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
