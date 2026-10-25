// =============================================================================
// /planes/<plan> — nombre, email y a pagar (el checkout público de un plan de MaKo)
// =============================================================================
// El formulario es ./CompraPlan.tsx y postea a /api/planes/comprar (lib/compra-plan.ts), que devuelve el link
// /pagar/<token>. Al pagarse, el alta automática crea la cuenta y manda el mail de bienvenida (lib/cobros.ts).
//
// ⚠️ PÚBLICA: sólo GET, no lee cookies, sin <Suspense>. Lo que vino en la URL (el origen de la landing y el código de
// partner) viaja en el cuerpo del POST; el código de partner de la cookie de /r/<código> lo lee la ruta del POST.
// =============================================================================

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ofertaDelPlan } from '@/lib/compra-plan';
import { getSesionAdmin } from '@/lib/auth';
import { origenLimpio, codigoRefLimpio, TEXTO_SIN_PASARELA, PREGUNTAS_DE_LA_PUERTA } from '@/lib/compra-plan-reglas';
import { GARANTIA_DIAS, MESES_GRATIS_ANUAL, PROGRAMA_ACELERADOR } from '@/lib/planes-mako';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { CSS_PLANES } from '../estilo';
import { CompraPlan } from './CompraPlan';
import { QuieroPlan } from './QuieroPlan';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = { title: 'Empezar con MaKo', robots: { index: false, follow: false } };

export default async function PlanPage({ params, searchParams }: {
  params: Promise<{ plan: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plan: id } = await params;
  if (!/^[a-z0-9-]{1,32}$/.test(id)) notFound();
  const sp = await searchParams;
  const uno = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const origen = origenLimpio(Object.fromEntries(['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'].map((k) => [k, uno(k)])));
  const ref = codigoRefLimpio(uno('ref'));
  // El Acelerador NUNCA pasa por la pasarela (docs/estrategia-financiera-mako.md §1.7: con llamadas, un merchant of record
  // no lo toma): siempre se pide, y se cobra aparte. Con el diagnóstico de 2 minutos como puerta (25/10/2026, el molde de
  // Ropofy): tres preguntas, una por pantalla, y después los datos. La llamada arranca sabiendo dónde está su negocio.
  if (id === PROGRAMA_ACELERADOR.id) {
    const pr = PROGRAMA_ACELERADOR;
    return (
      <Ficha titulo={pr.nombre} precio={`US$ ${pr.precioUsd.toLocaleString('es-AR')} en ${pr.cuotas} cuotas de US$ ${Math.round(pr.precioUsd / pr.cuotas).toLocaleString('es-AR')}`}>
        <QuieroPlan plan={pr.id} nombrePlan={pr.nombre} origen={origen} refCodigo={ref} preguntas={PREGUNTAS_DE_LA_PUERTA} />
      </Ficha>
    );
  }
  // Una pasarela en modo prueba sólo la ve el super admin (la prueba de humo): lib/compra-plan.ts, `ofertaDelPlan`.
  const oferta = await ofertaDelPlan(id, { conPrueba: (await getSesionAdmin().catch(() => null)) != null });
  if (!oferta) notFound();
  const { plan, pasarelas } = oferta;
  // EL ANUAL (25/10/2026) se pide siempre, aunque haya pasarela: el checkout cobra por mes, y nunca se cobra un mes en lugar
  // del año. Sin precio anual, la página del plan es la de siempre.
  if (uno('periodo') === 'anual' && plan.precioAnualUsd) {
    return (
      <Ficha titulo={`${plan.nombre}, anual`} precio={`US$ ${plan.precioAnualUsd.toLocaleString('es-AR')} por año: ${MESES_GRATIS_ANUAL} meses gratis`}>
        <p className="planes-sub">Déjanos tus datos y te escribimos por WhatsApp para darte de alta. Tienes {GARANTIA_DIAS.anual} días de garantía.</p>
        <QuieroPlan plan={plan.id} nombrePlan={`${plan.nombre} anual`} origen={origen} refCodigo={ref} periodo="anual" />
      </Ficha>
    );
  }
  const precio = pasarelas.map((x) => `${formatoMonto(x.monto, x.moneda)} por mes`).filter((v, i, a) => a.indexOf(v) === i).join(' · ') || `US$ ${plan.precioUsd} por mes`;
  return (
    <Ficha titulo={plan.nombre} precio={precio}>
      {/* Sin pasarela que lo cobre: no hay formulario que lleve a un pago imposible. Desde el 24/10/2026 la salida NO es la
          agenda (Martín no usa Calendly): el pedido queda en el CRM con su origen y su partner, y se da de alta a mano. */}
      {pasarelas.length
        ? <CompraPlan plan={plan.id} pasarelas={pasarelas} origen={origen} refCodigo={ref} />
        : (
          <>
            <p className="planes-sub">{TEXTO_SIN_PASARELA}</p>
            <QuieroPlan plan={plan.id} nombrePlan={plan.nombre} origen={origen} refCodigo={ref} />
          </>
        )}
    </Ficha>
  );
}

/** El marco de la página de un plan (o del programa): la marca, el nombre y el precio arriba. */
function Ficha({ titulo, precio, children }: { titulo: string; precio: string; children: ReactNode }) {
  return (
    <main className="planes-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_PLANES }} />
      <div className="planes-wrap">
        <Link className="planes-volver" href="/planes">← Todos los planes</Link>
        <div className="planes-form">
          <div className="planes-marca">MaKo</div>
          <h1 style={{ fontSize: 24 }}>{titulo}</h1>
          <p className="planes-sub" style={{ marginBottom: 6 }}>{precio}</p>
          {children}
        </div>
      </div>
    </main>
  );
}

