// =============================================================================
// PresentacionPartners — lo que VENDE la idea de ser partner, arriba de la tab de MaKo Partners (24/10/2026)
// =============================================================================
// Martín, 24/10/2026: «la tab de MaKo Partners para clientes, primero la tab tipo landing que venda la idea de ser
// partner y luego el dashboard, tanto de SuperAdmin como clientes». Va arriba del tablero del cliente
// (referidos/Referidos.tsx) y arriba del panel del programa del super admin (PartnersApp.tsx, `PartnersPlataforma`).
//
// ⚠️ SÓLO LO QUE EXISTE (la regla de app/mako-partners/page.tsx): el crédito que suma cada referido al pagar su segundo
// mes (lib/partners-programa.ts, `acreditarReferidos`). NO dice que el crédito «se descuenta» de la cuota ni la comisión
// del programa grupal: ninguna de las dos se aplica todavía (docs/hallazgos-partners.md) y prometerlo es decisión de
// Martín. Sin hooks: la usan un componente de cliente y uno de servidor.
// =============================================================================

import Link from '@/app/_ui/Link';
import { PAGOS_PARA_ACREDITAR } from '@/lib/partners-reglas';

const CSS = `
.pp-hero { background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--surface)) 0%, var(--surface) 70%); border: 1px solid var(--border);
  border-radius: 18px; padding: 26px 24px; margin: 4px 0 26px; }
.pp-hero h2 { margin: 0; font-size: 26px; line-height: 1.2; color: var(--ink); letter-spacing: -.01em; }
.pp-hero > p { margin: 8px 0 0; color: var(--dim); max-width: 620px; line-height: 1.55; }
.pp-pasos { list-style: none; padding: 0; margin: 20px 0 0; display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.pp-paso { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
.pp-paso b { display: flex; align-items: center; gap: 10px; color: var(--ink); font-size: 15px; }
.pp-paso b span { display: inline-flex; width: 26px; height: 26px; border-radius: 50%; align-items: center; justify-content: center;
  background: var(--accent); color: #fff; font-size: 13px; flex: none; }
.pp-paso p { margin: 6px 0 0; color: var(--dim); font-size: var(--fs-sm); line-height: 1.5; }
.pp-pie { margin: 16px 0 0; font-size: var(--fs-sm); color: var(--dim); }
.pp-pie a { color: var(--accent); font-weight: 600; }
.pp-rotulo { display: inline-block; margin-bottom: 10px; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: var(--accent); }
`;

const ORDINAL: Record<number, string> = { 1: 'primer', 2: 'segundo', 3: 'tercer' };

/** `plataforma`: el super admin la ve como la ven sus clientes, con el rótulo que lo dice. */
export function PresentacionPartners({ vista }: { vista: 'cliente' | 'plataforma' }) {
  const mes = ORDINAL[PAGOS_PARA_ACREDITAR] ?? `${PAGOS_PARA_ACREDITAR}º`;
  return (
    <section className="pp-hero" aria-labelledby="pp-titulo">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {vista === 'plataforma' && <span className="pp-rotulo">Así lo ven tus clientes</span>}
      <h2 id="pp-titulo">Recomienda MaKo y gana meses gratis</h2>
      <p>
        Cada negocio que entra a MaKo con tu link y paga su {mes} mes te suma su primer mes como crédito. Sin tope: el que trae
        muchos, junta muchos.
      </p>
      <ol className="pp-pasos">
        <li className="pp-paso">
          <b><span>1</span>Comparte tu link</b>
          <p>{vista === 'plataforma' ? 'Cada negocio tiene el suyo en MaKo Partners.' : 'Es tuyo y está aquí abajo, listo para copiar.'}</p>
        </li>
        <li className="pp-paso">
          <b><span>2</span>Tu referido entra a MaKo</b>
          <p>Con su propio plan. Cuenta un negocio nuevo, y el primero que lo trajo.</p>
        </li>
        <li className="pp-paso">
          <b><span>3</span>Se te suma su primer mes</b>
          <p>Cuando paga su {mes} mes, su primer mes queda como crédito a tu favor.</p>
        </li>
      </ol>
      <p className="pp-pie">Las reglas completas, en <Link href="/mako-partners">la página de MaKo Partners</Link>.</p>
    </section>
  );
}
