// =============================================================================
// /planes/<plan> — nombre, email, WhatsApp y a pagar (el checkout público de un plan de MaKo)
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
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ofertaDelPlan } from '@/lib/compra-plan';
import { getSesionAdmin } from '@/lib/auth';
import { origenLimpio, codigoRefLimpio, paisDelVisitante, TEXTO_SIN_PASARELA, PREGUNTAS_DE_LA_PUERTA } from '@/lib/compra-plan-reglas';
import { MESES_GRATIS_ANUAL, PROGRAMA_ACELERADOR, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA } from '@/lib/planes-mako';
import { entornoPromo, promoVigente } from '@/lib/promo-entrada';
import { COOKIE_PROMO, PROMO_ENTRADA } from '@/lib/promo-entrada-reglas';
import { creadoPorPrimerMes, montoDelPrimerPago } from '@/lib/primer-mes-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { NOMBRE_PASARELA, type Pasarela } from '@/lib/cobros-tipos';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { ladaDelPais } from '@/lib/paises';
import { CSS_PLANES } from '../estilo';
import { CompraPlan } from './CompraPlan';
import { QuieroPlan } from './QuieroPlan';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = { title: 'Empezar con MaKo', robots: { index: false, follow: false } };

/** ¿El reloj del 50% sigue vivo en este navegador? Sólo lo lee: lo arranca la landing. */
const relojVivo = (cookie: string | undefined) => promoVigente(cookie, Date.now(), entornoPromo());

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
      <Ficha resumen={{
        etiqueta: `Pedir ${pr.nombre}`, nombre: pr.nombre, precio: `US$ ${pr.precioUsd.toLocaleString('es-AR')}`,
        periodo: `en ${pr.cuotas} cuotas de US$ ${Math.round(pr.precioUsd / pr.cuotas).toLocaleString('es-AR')}`,
        detalle: 'Se cobra aparte, después de la llamada', incluye: pr.incluye, nota: pr.resumen,
      }}>
        <QuieroPlan plan={pr.id} nombrePlan={pr.nombre} origen={origen} refCodigo={ref} preguntas={PREGUNTAS_DE_LA_PUERTA} />
      </Ficha>
    );
  }
  // Una pasarela en modo prueba sólo la ve el super admin (la prueba de humo): lib/compra-plan.ts, `ofertaDelPlan`. Mercado
  // Pago sólo a quien está en su país (27/10/2026: a una clienta de México le rechazó el pago); afuera, Stripe.
  const pais = paisDelVisitante((await headers()).get('x-vercel-ip-country'));
  const oferta = await ofertaDelPlan(id, {
    conPrueba: (await getSesionAdmin().catch(() => null)) != null,
    pais,
  });
  if (!oferta) notFound();
  const { plan, pasarelas } = oferta;
  // EL ANUAL (25/10/2026) se pide siempre, aunque haya pasarela: el checkout cobra por mes, y nunca se cobra un mes en lugar
  // del año. Sin precio anual, la página del plan es la de siempre.
  if (uno('periodo') === 'anual' && plan.precioAnualUsd) {
    return (
      <Ficha resumen={{
        etiqueta: `Pedir ${plan.nombre}, anual`, nombre: `${plan.nombre}, anual`, precio: `US$ ${plan.precioAnualUsd.toLocaleString('es-AR')}`,
        periodo: 'por año', otros: [`${MESES_GRATIS_ANUAL} meses gratis frente al pago mensual`], detalle: 'Un pago por año', incluye: plan.incluye,
      }}>
        <p className="planes-sub">Déjanos tus datos y te escribimos por WhatsApp para darte de alta.{PRUEBA_GRATIS_PRENDIDA ? ` Empiezas con ${PRUEBA_DIAS} días gratis.` : ''}</p>
        <QuieroPlan plan={plan.id} nombrePlan={`${plan.nombre} anual`} origen={origen} refCodigo={ref} periodo="anual" />
      </Ficha>
    );
  }
  // EL 50% DEL PRIMER MES (30/10/2026): sólo con el reloj vivo; es lo que la persona venía viendo en la landing. Quien decide de
  // verdad es la ruta del POST: acá sólo se dice.
  const conPromo = !PRUEBA_GRATIS_PRENDIDA && PROMO_ENTRADA.planes.includes(plan.id) && relojVivo((await cookies()).get(COOKIE_PROMO)?.value);
  const conPrimerMes = (monto: number) => montoDelPrimerPago({ monto, creado_por: creadoPorPrimerMes(plan.id) });
  const precio = pasarelas.map((x) => (conPromo
    ? `${formatoMonto(conPrimerMes(x.monto), x.moneda)} el primer mes, después ${formatoMonto(x.monto, x.moneda)} por mes`
    : `${formatoMonto(x.monto, x.moneda)} por mes`)).filter((v, i, a) => a.indexOf(v) === i).join(' · ') || `US$ ${plan.precioUsd} por mes`;
  const conPrueba = !(uno('sinPrueba') === '1' || !PRUEBA_GRATIS_PRENDIDA);
  return (
    <Ficha pasarelas={pasarelas.map((x) => x.pasarela)} resumen={resumenDelPlan({ nombre: plan.nombre, incluye: plan.incluye, precioUsd: plan.precioUsd, pasarelas, conPromo, conPrueba, conPrimerMes, precio })}>
      {/* Sin pasarela que lo cobre: no hay formulario que lleve a un pago imposible. Desde el 24/10/2026 la salida NO es la
          agenda (Martín no usa Calendly): el pedido queda en el CRM con su origen y su partner, y se da de alta a mano. */}
      {pasarelas.length
        ? <CompraPlan plan={plan.id} pasarelas={pasarelas} origen={origen} refCodigo={ref} sinPrueba={uno('sinPrueba') === '1' || !PRUEBA_GRATIS_PRENDIDA} promo={conPromo} ladaInicial={ladaDelPais(pais)} />
        : (
          <>
            <p className="planes-sub">{TEXTO_SIN_PASARELA}</p>
            <QuieroPlan plan={plan.id} nombrePlan={plan.nombre} origen={origen} refCodigo={ref} />
          </>
        )}
    </Ficha>
  );
}

/** Lo que dice el resumen de la izquierda (Stripe Checkout): sólo datos del plan, nada inventado. */
type Resumen = {
  /** «Suscribirte a MaKo Esencial»: lo de arriba del precio. */
  etiqueta: string;
  nombre: string;
  /** El precio grande y, al lado, el período. */
  precio: string;
  periodo?: string;
  /** Otras formas de pagarlo (otra moneda). */
  otros?: string[];
  /** Debajo del nombre, en el renglón del plan. */
  detalle?: string;
  /** El precio del renglón del plan (sin él, no hay renglón de precio). */
  precioRenglon?: string;
  incluye: readonly string[];
  /** Subtotal, descuento y total de hoy. */
  totales?: Array<{ concepto: string; monto: string; tipo?: 'descuento' | 'total' }>;
  nota?: string;
};

/**
 * El resumen del plan que se paga: el precio de la primera pasarela que se ofrece (la de su país) y, si hay otra, cuánto es con
 * ella. Con el 50% del primer mes, el total de hoy es el del primer mes; con la prueba gratis, hoy no se cobra nada.
 */
function resumenDelPlan(p: {
  nombre: string; incluye: readonly string[]; precioUsd: number;
  pasarelas: ReadonlyArray<{ pasarela: Pasarela; moneda: string; monto: number }>;
  conPromo: boolean; conPrueba: boolean; conPrimerMes: (monto: number) => number; precio: string;
}): Resumen {
  const [una, ...resto] = p.pasarelas;
  if (!una) return { etiqueta: `Suscribirte a ${p.nombre}`, nombre: p.nombre, precio: p.precio, incluye: p.incluye };
  const mes = formatoMonto(una.monto, una.moneda);
  const primero = p.conPromo ? p.conPrimerMes(una.monto) : una.monto;
  const otros = resto.map((x) => `o ${formatoMonto(p.conPromo ? p.conPrimerMes(x.monto) : x.monto, x.moneda)}${p.conPromo ? ' el primer mes' : ' por mes'} con ${x.pasarela === 'mercadopago' ? 'Mercado Pago' : 'tarjeta'}`);
  const totales: NonNullable<Resumen['totales']> = [{ concepto: 'Subtotal', monto: mes }];
  if (p.conPromo && primero < una.monto) totales.push({ concepto: 'Descuento del primer mes', monto: `−${formatoMonto(Math.round((una.monto - primero) * 100) / 100, una.moneda)}`, tipo: 'descuento' });
  totales.push({ concepto: 'Total de hoy', monto: formatoMonto(p.conPrueba ? 0 : primero, una.moneda), tipo: 'total' });
  return {
    etiqueta: p.conPrueba ? `Empezar ${p.nombre} con ${PRUEBA_DIAS} días gratis` : `Suscribirte a ${p.nombre}`,
    nombre: p.nombre,
    precio: p.conPrueba ? formatoMonto(0, una.moneda) : formatoMonto(primero, una.moneda),
    periodo: p.conPrueba ? `hoy; después ${mes} por mes` : p.conPromo ? `el primer mes; después ${mes} por mes` : 'por mes',
    otros,
    detalle: 'Se cobra cada mes',
    precioRenglon: mes,
    incluye: p.incluye,
    totales,
    nota: p.conPrueba ? `El primer cobro es el día ${PRUEBA_DIAS + 1}.` : 'Se cobra cada mes hasta que te des de baja.',
  };
}

/** El detalle del resumen: el renglón del plan, qué incluye y los totales (abierto en la computadora, plegable en el teléfono). */
function Detalle({ r }: { r: Resumen }) {
  return (
    <div className="ck-detalle">
      <div className="ck-item">
        <span className="ck-item-icono" aria-hidden="true"><MakoLogo size={44} animate={false} /></span>
        <div><b>{r.nombre}</b>{r.detalle && <small>{r.detalle}</small>}</div>
        {r.precioRenglon && <span className="ck-item-precio">{r.precioRenglon}</span>}
      </div>
      {r.incluye.length > 0 && <ul className="ck-incluye" aria-label="Qué incluye">{r.incluye.map((x) => <li key={x}>{x}</li>)}</ul>}
      {r.totales && (
        <dl className="ck-totales">
          {r.totales.map((t) => <div key={t.concepto} className={t.tipo ? `ck-${t.tipo}` : undefined}><dt>{t.concepto}</dt><dd>{t.monto}</dd></div>)}
        </dl>
      )}
      {r.nota && <p className="ck-nota-res">{r.nota}</p>}
    </div>
  );
}

/**
 * EL MARCO DEL CHECKOUT (12/11/2026): la estructura de Stripe Checkout, con los colores y la letra de MaKo (app/planes/estilo.ts).
 * A la izquierda el resumen, a la derecha el formulario; en el teléfono el resumen va arriba y plegado («Ver detalle»), sin
 * JavaScript (`<details>`). El pie dice quién procesa el pago y lleva a las condiciones.
 */
function Ficha({ resumen: r, pasarelas = [], children }: { resumen: Resumen; pasarelas?: readonly Pasarela[]; children: ReactNode }) {
  const procesa = [...new Set(pasarelas)].map((x) => NOMBRE_PASARELA[x]);
  return (
    <main className="planes-root ck-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_PLANES }} />
      <div className="ck">
        <section className="ck-resumen" aria-label="Resumen de tu compra">
          <div className="ck-col">
            <header className="ck-marca">
              <Link className="ck-volver" href="/planes" aria-label="Volver a los planes">←</Link>
              <MakoLogo size={28} animate={false} />
              <span>MaKo</span>
            </header>
            <div className="ck-abierto">
              <p className="ck-etiqueta">{r.etiqueta}</p>
              <div className="ck-precio">{r.precio}{r.periodo && <small>{r.periodo}</small>}</div>
              {r.otros?.map((x) => <p key={x} className="ck-otros">{x}</p>)}
              <Detalle r={r} />
            </div>
            <details className="ck-plegable">
              <summary>
                <span className="ck-etiqueta">{r.etiqueta}</span>
                <span className="ck-precio">{r.precio}{r.periodo && <small>{r.periodo}</small>}</span>
                {r.otros?.map((x) => <span key={x} className="ck-otros">{x}</span>)}
                <span className="ck-ver"><span className="ck-ver-abrir">Ver detalle</span><span className="ck-ver-cerrar">Ocultar</span></span>
              </summary>
              <Detalle r={r} />
            </details>
          </div>
        </section>
        <section className="ck-form" aria-label="Tus datos y el pago">
          <div className="ck-col ck-formulario">{children}</div>
        </section>
        <footer className="ck-pie">
          <div className="ck-col">
            {procesa.length > 0 && <span className="ck-procesa">Pagos procesados por <b>{procesa.join(' y ')}</b></span>}
            <Link href="/terminos">Términos</Link>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/reembolsos">Reembolsos</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
