// =============================================================================
// TarjetasPlanes — los tres bloques de precios, LOS MISMOS en /planes y en la landing de venta (24/10/2026, noche)
// =============================================================================
// Martín, 24/10: «La sección de planes no se entiende para nada... Lo hiciste con lenguaje interno... Tienes que VENDER,
// Revisa como lo hacen otras paginas... Y sobre todo el acompañamiento debe tener mas beneficios y verse diferencial, porque
// sino no tiene sentido. El personalizado tiene que tener un factor de PROMESA de resultados, ya no solo software».
//
// COPIADO DE (mirados el 24/10): ClickFunnels (clickfunnels.com/pricing) — el escalón de arriba en un bloque OSCURO, distinto
// de los de software, y el botón arriba de la lista, debajo del precio; Kajabi (kajabi.com/pricing) — una frase por plan que
// dice para qué ETAPA del negocio es, y lo que incluye dicho como lo que la persona consigue. Además, arriba de cada nombre,
// cómo se trabaja: «Lo haces tú, con MaKo» o «Lo armamos contigo»: lo que separa al software del acompañamiento.
//
// Los datos: los planes (lib/planes-mako.ts, con si se cobran en línea: `ofertasDeLosPlanes` / `planesParaLanding`) y el
// programa (`PROGRAMA_ACELERADOR`). El botón de cada plan, la regla de siempre (`botonDelPlan`: «Empezar» sólo con un cobro
// detrás). El programa SIEMPRE se pide (nunca pasa por la pasarela). La promesa del programa la escribe Martín: sin ella, no
// se dibuja ninguna. Sin hooks ni datos: la usan una página del servidor (/planes) y un portal del cliente (la landing).
// Las clases llevan `mkpl-`: adentro de una landing del Web Generator conviven con el CSS de ese diseño, y un nombre
// genérico («card», «btn») se pisa con el suyo.
// =============================================================================

import { PROGRAMA_ACELERADOR, type PlanMako } from '@/lib/planes-mako';
import { botonDelPlan } from '@/lib/compra-plan-reglas';

/** Un plan como lo dibujan las tarjetas, con si se cobra en línea. */
export type PlanEnTarjeta = Pick<PlanMako, 'id' | 'nombre' | 'precioUsd' | 'resumen' | 'incluye' | 'destacado'> & { cobrable: boolean };

export const CEJA_SOFTWARE = 'Lo haces tú, con MaKo';
export const CEJA_PROGRAMA = 'Lo armamos contigo';

export const CSS_TARJETAS = `
.mkpl-grilla { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); padding-top: 14px; align-items: stretch; text-align: left; }
.mkpl-card { position: relative; display: flex; flex-direction: column; background: #FFFFFF; color: #12151B; border: 1px solid #E6EAF2;
  border-radius: 20px; padding: 28px 24px 24px; box-shadow: 0 1px 2px rgba(18,21,27,.04), 0 10px 28px rgba(18,21,27,.06); }
.mkpl-card.destacado { border-color: #2F6FED; box-shadow: 0 0 0 1px #2F6FED, 0 16px 40px rgba(47,111,237,.18); }
.mkpl-insignia { position: absolute; top: -13px; left: 24px; background: #2F6FED; color: #fff; font-size: 12px; font-weight: 700;
  letter-spacing: .03em; padding: 5px 12px; border-radius: 999px; }
.mkpl-ceja { font-size: 12px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: #5B6472; }
.mkpl-card h3 { margin: 6px 0 6px; font-size: 22px; line-height: 1.2; font-weight: 800; letter-spacing: -.01em; color: inherit; }
.mkpl-resumen { margin: 0 0 16px; color: #4A5260; font-size: 15px; line-height: 1.5; min-height: 68px; }
.mkpl-precio { font-size: 40px; line-height: 1; font-weight: 800; letter-spacing: -.03em; }
.mkpl-precio small { font-size: 15px; font-weight: 500; letter-spacing: 0; color: #5B6472; }
.mkpl-cuotas { margin: 6px 0 0; color: #5B6472; font-size: 14px; }
.mkpl-btn { display: block; text-align: center; margin: 20px 0 22px; background: #2F6FED; color: #fff !important; text-decoration: none;
  font-weight: 700; font-size: 15px; padding: 14px 20px; border-radius: 12px; box-shadow: 0 6px 18px rgba(47,111,237,.24); }
.mkpl-btn.borde { background: #fff; color: #2F6FED !important; box-shadow: inset 0 0 0 1.5px #2F6FED; }
.mkpl-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 14.5px; line-height: 1.45; }
.mkpl-lista li { display: flex; gap: 10px; align-items: flex-start; }
.mkpl-lista li::before { content: "✓"; flex: none; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center;
  justify-content: center; font-size: 12px; font-weight: 800; color: #1F7A4D; background: #E3F5EB; margin-top: 1px; }
.mkpl-programa { background: radial-gradient(700px 320px at 100% 0%, rgba(122,162,255,.28), transparent 60%), linear-gradient(160deg, #142B66 0%, #0B1735 100%);
  color: #F3F6FF; border-color: #1E3A80; box-shadow: 0 22px 54px rgba(11,23,53,.34); }
.mkpl-programa .mkpl-insignia { background: #F5C451; color: #2A1E00; }
.mkpl-programa .mkpl-ceja { color: #F5C451; }
.mkpl-programa .mkpl-resumen, .mkpl-programa .mkpl-cuotas, .mkpl-programa .mkpl-precio small { color: #C9D3EE; }
.mkpl-programa .mkpl-btn { background: #F5C451; color: #2A1E00 !important; box-shadow: 0 8px 22px rgba(245,196,81,.28); }
.mkpl-programa .mkpl-lista li::before { color: #2A1E00; background: #F5C451; }
.mkpl-promesa { margin: 18px 0 0; padding: 14px 16px; border-radius: 14px; background: rgba(245,196,81,.12); border: 1px solid rgba(245,196,81,.45);
  font-size: 14.5px; line-height: 1.45; }
.mkpl-promesa b { color: #F5C451; }
.mkpl-despues { margin: 18px 0 0; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.14); font-size: 13.5px; color: #C9D3EE; }
@media (max-width: 900px) {
  .mkpl-grilla { grid-template-columns: 1fr; gap: 26px; }
  .mkpl-resumen { min-height: 0; }
}
`;

const precio = (n: number) => n.toLocaleString('es-AR');

export function TarjetasPlanes({ planes, sufijo }: { planes: readonly PlanEnTarjeta[]; sufijo: string }) {
  const pr = PROGRAMA_ACELERADOR;
  return (
    <div className="mkpl-grilla">
      {planes.map((p) => {
        // El mismo botón en /planes y en la landing: «Empezar» sólo con un cobro detrás; sin pasarela, «Quiero …» y se pide.
        const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable: p.cobrable, sufijo });
        return (
          <section key={p.id} className={`mkpl-card${p.destacado ? ' destacado' : ''}`}>
            {p.destacado && <span className="mkpl-insignia">Recomendado</span>}
            <div className="mkpl-ceja">{CEJA_SOFTWARE}</div>
            <h3>{p.nombre}</h3>
            {p.resumen && <p className="mkpl-resumen">{p.resumen}</p>}
            <div className="mkpl-precio">US$ {precio(p.precioUsd)} <small>/ mes</small></div>
            <a className={`mkpl-btn${p.destacado ? '' : ' borde'}`} href={boton.href}>{boton.texto}</a>
            {p.incluye.length > 0 && <ul className="mkpl-lista">{p.incluye.map((x) => <li key={x}>{x}</li>)}</ul>}
          </section>
        );
      })}
      <section className="mkpl-card mkpl-programa">
        <span className="mkpl-insignia">Con acompañamiento</span>
        <div className="mkpl-ceja">{CEJA_PROGRAMA}</div>
        <h3>{pr.nombre}</h3>
        <p className="mkpl-resumen">{pr.resumen}</p>
        <div className="mkpl-precio">US$ {precio(pr.precioUsd)}</div>
        <div className="mkpl-cuotas">en {pr.cuotas} cuotas de US$ {precio(Math.round(pr.precioUsd / pr.cuotas))}</div>
        {pr.promesa && <p className="mkpl-promesa"><b>Nuestra promesa:</b> {pr.promesa}</p>}
        <a className="mkpl-btn" href={`/planes/${pr.id}${sufijo}`}>Quiero el Acelerador</a>
        <ul className="mkpl-lista">{pr.incluye.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mkpl-despues">Al terminar, si quieres seguir: {pr.despues.nombre}, US$ {precio(pr.despues.precioUsd)} por mes, con MaKo Pro y la asesoría de cada semana.</p>
      </section>
    </div>
  );
}
