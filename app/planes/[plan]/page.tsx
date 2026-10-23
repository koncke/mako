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
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ofertaDelPlan } from '@/lib/compra-plan';
import { origenLimpio, codigoRefLimpio, agendaConOrigen, TEXTO_SIN_PASARELA } from '@/lib/compra-plan-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { CSS_PLANES } from '../estilo';
import { CompraPlan } from './CompraPlan';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = { title: 'Empezar con MaKo', robots: { index: false, follow: false } };

export default async function PlanPage({ params, searchParams }: {
  params: Promise<{ plan: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plan: id } = await params;
  if (!/^[a-z0-9-]{1,32}$/.test(id)) notFound();
  const oferta = await ofertaDelPlan(id);
  if (!oferta) notFound();
  const sp = await searchParams;
  const uno = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const origen = origenLimpio(Object.fromEntries(['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'].map((k) => [k, uno(k)])));
  const ref = codigoRefLimpio(uno('ref'));
  const { plan, pasarelas } = oferta;
  return (
    <main className="planes-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_PLANES }} />
      <div className="planes-wrap">
        <Link className="planes-volver" href="/planes">← Todos los planes</Link>
        <div className="planes-form">
          <div className="planes-marca">MaKo</div>
          <h1 style={{ fontSize: 24 }}>{plan.nombre}</h1>
          <p className="planes-sub" style={{ marginBottom: 6 }}>
            {pasarelas.map((x) => `${formatoMonto(x.monto, x.moneda)} por mes`).filter((v, i, a) => a.indexOf(v) === i).join(' · ') || `US$ ${plan.precioUsd} por mes`}
          </p>
          {/* Sin pasarela que lo cobre (23/10/2026): no hay formulario que lleve a un pago imposible, y «Escríbenos» sin
              a dónde era un callejón. La salida es la agenda, con las UTM de la campaña. */}
          {pasarelas.length
            ? <CompraPlan plan={plan.id} pasarelas={pasarelas} origen={origen} refCodigo={ref} />
            : (
              <>
                <p className="planes-sub">{TEXTO_SIN_PASARELA}</p>
                <a className="planes-btn" href={agendaConOrigen(origen, ref)}>Agendar una llamada</a>
              </>
            )}
        </div>
      </div>
    </main>
  );
}
