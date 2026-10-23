// =============================================================================
// /mako-partners — la página pública del programa de referidos de MaKo (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «el sistema de referidos con la página de MaKo Partners». Explica el programa DECIDIDO
// el 10/10/2026 (docs/referidos.md, lib/partners-reglas.ts) y lleva a donde está el link de cada uno (MaKo › MaKo
// Partners) o a los planes. Sólo dice lo que existe: el crédito por cada referido y la comisión del grupal.
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts): sólo GET, no lee cookies, sin <Suspense>.
// =============================================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { CSS_PLANES } from '../planes/estilo';
import { PAGOS_PARA_ACREDITAR } from '@/lib/partners-reglas';

export const metadata: Metadata = { title: 'MaKo Partners', robots: { index: true, follow: true } };

export default function MakoPartnersPage() {
  return (
    <main className="planes-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_PLANES }} />
      <div className="planes-wrap" style={{ maxWidth: 720 }}>
        <div className="planes-marca">MaKo Partners</div>
        <h1>Recomienda MaKo y gana meses gratis</h1>
        <p className="planes-sub">Cada negocio que entra con tu link te suma su primer mes. Sin tope: el que trae muchos, no paga.</p>
        <div className="planes-grilla">
          <section className="planes-card">
            <h2>Si tienes MaKo</h2>
            <ul>
              <li>Tu link está en MaKo › MaKo Partners.</li>
              <li>Cuando tu referido paga su {PAGOS_PARA_ACREDITAR === 2 ? 'segundo' : `${PAGOS_PARA_ACREDITAR}º`} mes, se te suma su primer mes como crédito.</li>
              <li>El crédito se acumula y se descuenta de tus próximos meses: un referido de Pro te paga un mes de Pro.</li>
            </ul>
            <Link className="planes-btn" href="/partners/referidos">Ver mi link</Link>
          </section>
          <section className="planes-card">
            <h2>Si eres agencia o revendedor</h2>
            <ul>
              <li>Primero se descuenta tu suscripción.</li>
              <li>Lo que sobra se te paga en plata, por transferencia.</li>
              <li>Por cada programa grupal que traigas, el 20% de cada cuota cobrada.</li>
            </ul>
            <Link className="planes-btn" href="/planes">Ver los planes</Link>
          </section>
        </div>
        <p className="planes-nota" style={{ textAlign: 'left', marginTop: 24 }}>
          Cuenta sólo un negocio nuevo, el primero que lo trajo, y nunca uno mismo. Se paga el precio de lista. No se puede
          pautar con la palabra «MaKo».
        </p>
      </div>
    </main>
  );
}
