// =============================================================================
// /planes — los planes de MaKo, para comprar sin hablar con nadie (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «si alguien paga se ingresa automáticamente a la app con el email de bienvenida». Los
// planes y sus precios salen de lib/planes-mako.ts (el setting `planes.mako` de la plataforma, o los de hoy).
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts): sólo GET, no lee cookies, sin <Suspense> (AGENTS.md: el contenido de una página
// pública se lee sin JavaScript). Lo que la landing manda en la URL (de dónde viene la persona y el código de MaKo
// Partners) pasa tal cual al plan elegido: la página no lo guarda, lo guarda el cobro al pagar.
// =============================================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { ofertasDeLosPlanes } from '@/lib/compra-plan';
import { bajadaDePlanes, botonDelPlan, codigoRefLimpio, origenLimpio } from '@/lib/compra-plan-reglas';
import { CSS_PLANES } from './estilo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = { title: 'Planes de MaKo', robots: { index: true, follow: true } };

/** Lo que se pasa de la URL al plan elegido (el origen y el código de partner). Sólo estas claves, sin tocarlas. */
const CLAVES_QUE_PASAN = ['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'ref'];

export default async function PlanesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of CLAVES_QUE_PASAN) {
    const v = sp[k];
    if (typeof v === 'string' && v.trim()) qs.set(k, v.trim().slice(0, 250));
  }
  const sufijo = qs.toString() ? `?${qs.toString()}` : '';
  // SIN PASARELA (23/10/2026): un plan que no se puede pagar en línea no dice «Empezar»: lleva a la agenda, con las UTM
  // de la campaña (lib/compra-plan-reglas.ts). Se decide por plan, con la misma cuenta que el checkout.
  const ofertas = await ofertasDeLosPlanes();
  const origen = origenLimpio(Object.fromEntries(qs.entries()));
  const ref = codigoRefLimpio(qs.get('ref'));
  return (
    <main className="planes-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_PLANES }} />
      <div className="planes-wrap">
        <div className="planes-marca">MaKo</div>
        <h1>Elige tu plan</h1>
        <p className="planes-sub">{bajadaDePlanes(ofertas.some((o) => o.cobrable))}</p>
        <div className="planes-grilla">
          {ofertas.map(({ plan: p, cobrable }) => {
            const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable, sufijo, origen, ref });
            return (
              <section key={p.id} className={`planes-card${p.destacado ? ' destacado' : ''}`}>
                <h2>{p.nombre}</h2>
                <div className="planes-precio">US$ {p.precioUsd} <small>/ mes</small></div>
                {p.resumen && <p>{p.resumen}</p>}
                {p.incluye.length > 0 && <ul>{p.incluye.map((x) => <li key={x}>{x}</li>)}</ul>}
                {boton.afuera
                  ? <a className="planes-btn" href={boton.href}>{boton.texto}</a>
                  : <Link className="planes-btn" href={boton.href}>{boton.texto}</Link>}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
