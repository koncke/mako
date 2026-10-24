// =============================================================================
// PresentacionPartners — lo que VENDE la idea de ser partner, arriba de la tab de MaKo Partners (24/10/2026)
// =============================================================================
// Martín, 24/10/2026: «la tab de MaKo Partners para clientes, primero la tab tipo landing que venda la idea de ser
// partner y luego el dashboard, tanto de SuperAdmin como clientes». Va arriba del tablero del cliente
// (referidos/Referidos.tsx) y arriba del panel del programa del super admin (PartnersApp.tsx, `PartnersPlataforma`).
//
// DE LA MISMA FAMILIA QUE LA LANDING (24/10/2026, Martín: «el panel del partner tiene que verse de la misma familia, no
// como otra app»): la misma ceja, el mismo título con el acento en azul, el NÚMERO GRANDE a la derecha con lo que vale
// cada referido por plan y los tres pasos con el círculo azul de app/mako-partners/page.tsx. Con los tokens de la app
// (--primary es el mismo azul de la landing, y cambia solo con el tema oscuro y el Nord); no con colores fijos.
//
// ⚠️ SÓLO LO QUE EXISTE (la regla de app/mako-partners/page.tsx): el crédito que suma cada referido al pagar su segundo
// mes (lib/partners-programa.ts, `acreditarReferidos`). NO dice que el crédito «se descuenta» de la cuota ni la comisión
// del programa grupal: ninguna de las dos se aplica todavía (docs/hallazgos-partners.md) y prometerlo es decisión de
// Martín. Sin hooks: la usan un componente de cliente y uno de servidor.
// =============================================================================

import Link from '@/app/_ui/Link';
import { PAGOS_PARA_ACREDITAR } from '@/lib/partners-reglas';
import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako';

const CSS = `
.pp-hero { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: 20px; padding: 28px 28px 24px; margin: 4px 0 28px;
  background: radial-gradient(900px 380px at 100% 0%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 60%),
    linear-gradient(180deg, var(--primary-bg) 0%, var(--surface) 100%); }
.pp-grilla { display: grid; grid-template-columns: 1.3fr 1fr; gap: 28px; align-items: center; }
.pp-ceja { display: inline-block; font-size: 11.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--primary);
  background: color-mix(in srgb, var(--primary) 12%, transparent); padding: 5px 11px; border-radius: 999px; }
.pp-hero h2 { margin: 14px 0 10px; font-size: 32px; line-height: 1.1; color: var(--ink); letter-spacing: -.025em; font-weight: 800; }
.pp-hero h2 em { font-style: normal; color: var(--primary); }
.pp-bajada { margin: 0 0 18px; color: var(--dim); max-width: 560px; line-height: 1.55; font-size: 15.5px; }
.pp-btn { display: inline-block; background: var(--primary); color: var(--on-primary, #fff) !important; text-decoration: none; font-weight: 700;
  font-size: 15px; padding: 12px 20px; border-radius: 12px; box-shadow: 0 8px 22px color-mix(in srgb, var(--primary) 28%, transparent); }
.pp-numero { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 22px 22px 18px;
  box-shadow: 0 18px 44px rgba(18,21,27,.10); }
.pp-numero-etq { font-size: 12px; font-weight: 700; color: var(--dim); text-transform: uppercase; letter-spacing: .06em; }
.pp-numero-grande { font-size: 56px; line-height: 1; font-weight: 800; letter-spacing: -.04em; margin: 8px 0 4px; color: var(--ink); }
.pp-numero-sub { color: var(--dim); font-size: 14px; }
.pp-numero hr { border: 0; border-top: 1px solid var(--border); margin: 14px 0 10px; }
.pp-fila { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; padding: 3px 0; color: var(--ink); }
.pp-pasos { list-style: none; padding: 0; margin: 24px 0 0; display: grid; gap: 12px; grid-template-columns: repeat(3, 1fr); }
.pp-paso { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; }
.pp-paso-n { display: inline-flex; width: 30px; height: 30px; border-radius: 50%; align-items: center; justify-content: center;
  background: var(--primary); color: var(--on-primary, #fff); font-weight: 800; font-size: 14px; margin-bottom: 10px; }
.pp-paso b { display: block; color: var(--ink); font-size: 15.5px; }
.pp-paso p { margin: 4px 0 0; color: var(--dim); font-size: var(--fs-sm); line-height: 1.5; }
.pp-pie { margin: 16px 0 0; font-size: var(--fs-sm); color: var(--dim); }
.pp-pie a { color: var(--primary); font-weight: 600; }
.pp-rotulo { display: block; margin-bottom: 12px; font-size: 12px; font-weight: 700; color: var(--dim); }
@media (max-width: 860px) {
  .pp-hero { padding: 22px 18px 18px; }
  .pp-grilla, .pp-pasos { grid-template-columns: 1fr; }
  .pp-hero h2 { font-size: 26px; }
  .pp-numero-grande { font-size: 46px; }
}
`;

const ORDINAL: Record<number, string> = { 1: 'primer', 2: 'segundo', 3: 'tercer' };
const usd = (n: number) => `US$ ${n.toLocaleString('es-AR')}`;

/** `plataforma`: el super admin la ve como la ven sus clientes, con el rótulo que lo dice. */
export function PresentacionPartners({ vista }: { vista: 'cliente' | 'plataforma' }) {
  const mes = ORDINAL[PAGOS_PARA_ACREDITAR] ?? `${PAGOS_PARA_ACREDITAR}º`;
  const planes = PLANES_MAKO_DEFAULT.filter((p) => p.activo);
  // El número grande: el plan más caro (un referido de ese plan es lo más que suma uno solo), como en la landing.
  const tope = planes.reduce((a, b) => (b.precioUsd > a.precioUsd ? b : a), planes[0]);
  return (
    <section className="pp-hero" aria-labelledby="pp-titulo">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {vista === 'plataforma' && <span className="pp-rotulo">Así lo ven tus clientes</span>}
      <div className="pp-grilla">
        <div>
          <span className="pp-ceja">Programa de partners</span>
          <h2 id="pp-titulo">Suma el primer mes de <em>cada negocio</em> que traigas a MaKo</h2>
          <p className="pp-bajada">
            Compartes tu link. Cuando ese negocio paga su {mes} mes, su primer mes queda como crédito a tu favor. Sin tope: el que
            trae muchos, junta muchos.
          </p>
          {vista === 'cliente' && <a className="pp-btn" href="#pr-link">Copiar mi link</a>}
        </div>
        {tope && (
          <div className="pp-numero" aria-label="Lo que suma cada referido">
            <div className="pp-numero-etq">Por cada negocio que traes</div>
            <div className="pp-numero-grande">{usd(tope.precioUsd)}</div>
            <div className="pp-numero-sub">de crédito, si entra a {tope.nombre}</div>
            <hr />
            {planes.map((p) => <div key={p.id} className="pp-fila"><span>Referido de {p.nombre}</span><b>{usd(p.precioUsd)}</b></div>)}
          </div>
        )}
      </div>
      <ol className="pp-pasos">
        <li className="pp-paso">
          <span className="pp-paso-n">1</span>
          <b>Comparte tu link</b>
          <p>{vista === 'plataforma' ? 'Cada negocio tiene el suyo en MaKo Partners.' : 'Es tuyo y está aquí abajo, listo para copiar.'}</p>
        </li>
        <li className="pp-paso">
          <span className="pp-paso-n">2</span>
          <b>Tu referido entra a MaKo</b>
          <p>Con su propio plan. Cuenta un negocio nuevo, y el primero que lo trajo.</p>
        </li>
        <li className="pp-paso">
          <span className="pp-paso-n">3</span>
          <b>Se te suma su primer mes</b>
          <p>Cuando paga su {mes} mes, se te suma su primer mes como crédito a tu favor.{vista === 'cliente' ? ' Lo ves aquí abajo.' : ''}</p>
        </li>
      </ol>
      <p className="pp-pie">Las reglas completas, en <Link href="/mako-partners">la página de MaKo Partners</Link>.</p>
    </section>
  );
}
