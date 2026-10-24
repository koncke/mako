// =============================================================================
// PreciosLanding — las columnas de precios EN la landing de venta (24/10/2026)
// =============================================================================
// Martín: «No voy a usar Calendly, te dije que pongas las columnas de pricing de las ofertas». docs/estrategia-financiera-
// mako.md, «Qué hacer el lunes», punto 1: «los tres precios visibles … con un botón por columna. Sin eso, todo lo demás no
// tiene dónde hacer clic». Va donde estaba la agenda (#cal-embed) o, si el diseño publicado no la tiene, antes del pie
// (app/vsl/Landing.tsx). Cada botón lleva a /planes/<id> con el origen de la campaña y el código de partner de la URL: ahí
// se paga, o, sin pasarela, se pide y queda en el CRM (lib/compra-plan.ts). El anual no se muestra: el checkout cobra por mes.
// =============================================================================

import { PROGRAMA_ACELERADOR, type PlanMako } from '@/lib/planes-mako';
import { bajadaDePlanes, botonDelPlan } from '@/lib/compra-plan-reglas';

/** Un plan como lo dibuja la landing, con si se cobra en línea (la misma cuenta que /planes: `ofertasDeLosPlanes`). */
export type PlanEnLanding = Pick<PlanMako, 'id' | 'nombre' | 'precioUsd' | 'resumen' | 'incluye' | 'destacado'> & { cobrable: boolean };

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

const CSS = `
.mk-precios { font-family: inherit; color: #12151B; }
.mk-precios-titulo { text-align: center; margin: 0 0 6px; font-size: 32px; line-height: 1.15; letter-spacing: -.02em; font-weight: 700; }
.mk-precios-sub { text-align: center; margin: 0 auto 28px; max-width: 560px; color: #5B6472; font-size: 16px; line-height: 1.5; }
.mk-precios-grilla { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); padding-top: 12px; text-align: left; }
.mk-precios-card { position: relative; background: #fff; border: 1px solid #EAECF1; border-radius: 16px; padding: 24px 22px; display: flex;
  flex-direction: column; box-shadow: 0 1px 2px rgba(18,21,27,.04), 0 8px 24px rgba(18,21,27,.06); }
.mk-precios-card.destacado { border-color: #2F6FED; box-shadow: 0 0 0 1px #2F6FED, 0 14px 34px rgba(47,111,237,.18); }
.mk-precios-insignia { position: absolute; top: -12px; left: 22px; background: #2F6FED; color: #fff; font-size: 12px; font-weight: 700;
  letter-spacing: .03em; padding: 4px 11px; border-radius: 999px; }
.mk-precios-card h3 { margin: 0; font-size: 19px; font-weight: 600; }
.mk-precios-precio { margin: 10px 0 2px; font-size: 34px; font-weight: 700; letter-spacing: -.02em; }
.mk-precios-precio small { font-size: 15px; font-weight: 500; color: #5B6472; }
.mk-precios-cuotas { margin: 0 0 10px; color: #5B6472; font-size: 14px; }
.mk-precios-card p.mk-precios-resumen { margin: 8px 0 14px; color: #5B6472; font-size: 14.5px; line-height: 1.5; }
.mk-precios-card ul { margin: 0 0 20px; padding-left: 18px; font-size: 14.5px; line-height: 1.5; }
.mk-precios-card li { margin: 4px 0; }
.mk-precios-btn { display: block; text-align: center; margin-top: auto; background: #2F6FED; color: #fff !important; text-decoration: none;
  font-weight: 600; font-size: 15px; padding: 13px 20px; border-radius: 10px; }
.mk-precios-btn.borde { background: #fff; color: #2F6FED !important; box-shadow: inset 0 0 0 1px #2F6FED; }
.mk-precios-pie { text-align: center; margin: 22px 0 0; color: #5B6472; font-size: 14px; }
.mk-precios-pie a { color: #2F6FED; font-weight: 600; text-decoration: none; }
`;

const precio = (n: number) => n.toLocaleString('es-AR');

export function PreciosLanding({ planes, sufijo }: { planes: readonly PlanEnLanding[]; sufijo: string }) {
  const pr = PROGRAMA_ACELERADOR;
  return (
    <div className="mk-precios" id="precios">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <h2 className="mk-precios-titulo">Elige tu plan</h2>
      <p className="mk-precios-sub">{bajadaDePlanes(planes.some((p) => p.cobrable))}</p>
      <div className="mk-precios-grilla">
        {planes.map((p) => {
          // El mismo botón que /planes: «Empezar» sólo con un cobro detrás; sin pasarela, «Quiero …» y se pide.
          const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable: p.cobrable, sufijo });
          return (
          <section key={p.id} className={`mk-precios-card${p.destacado ? ' destacado' : ''}`}>
            {p.destacado && <span className="mk-precios-insignia">Recomendado</span>}
            <h3>{p.nombre}</h3>
            <div className="mk-precios-precio">US$ {precio(p.precioUsd)} <small>/ mes</small></div>
            {p.resumen && <p className="mk-precios-resumen">{p.resumen}</p>}
            {p.incluye.length > 0 && <ul>{p.incluye.map((x) => <li key={x}>{x}</li>)}</ul>}
            <a className="mk-precios-btn" href={boton.href}>{boton.texto}</a>
          </section>
          );
        })}
        <section className="mk-precios-card">
          <h3>{pr.nombre}</h3>
          <div className="mk-precios-precio">US$ {precio(pr.precioUsd)}</div>
          <div className="mk-precios-cuotas">en {pr.cuotas} cuotas de US$ {precio(Math.round(pr.precioUsd / pr.cuotas))}</div>
          <p className="mk-precios-resumen">{pr.resumen}</p>
          <ul>{pr.incluye.map((x) => <li key={x}>{x}</li>)}</ul>
          <a className="mk-precios-btn borde" href={`/planes/${pr.id}${sufijo}`}>Quiero el Acelerador</a>
        </section>
      </div>
      <p className="mk-precios-pie"><a href={`/planes${sufijo}`}>Compara los planes en detalle</a></p>
    </div>
  );
}
