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
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ofertaDelPlan } from '@/lib/compra-plan';
import { getSesionAdmin } from '@/lib/auth';
import { origenLimpio, codigoRefLimpio, paisDelVisitante, TEXTO_SIN_PASARELA, PREGUNTAS_DE_LA_PUERTA } from '@/lib/compra-plan-reglas';
import { PROGRAMA_ACELERADOR, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA, planConPrueba, planDeLaRuta } from '@/lib/planes-mako';
import { entornoPromo, promoVigente } from '@/lib/promo-entrada';
import { COOKIE_PROMO, PROMO_ENTRADA } from '@/lib/promo-entrada-reglas';
import { creadoPorPrimerMes, montoDelPrimerPago } from '@/lib/primer-mes-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { ladaDelPais } from '@/lib/paises';
import { CompraPlan } from './CompraPlan';
import { Ficha, incluyeDeLaColumna, resumenDelAnual, resumenDelPlan, totalDeHoyPorPasarela } from './Checkout';
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
  const { plan: ruta } = await params;
  if (!/^[a-z0-9-]{1,32}$/.test(ruta)) notFound();
  // La ruta en inglés (/planes/essential) o el id de siempre (/planes/esencial): las dos llegan al mismo plan.
  const id = planDeLaRuta(ruta);
  const sp = await searchParams;
  const uno = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const origen = origenLimpio(Object.fromEntries(['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'].map((k) => [k, uno(k)])));
  const ref = codigoRefLimpio(uno('ref'));
  // El Accelerator NUNCA pasa por la pasarela (docs/estrategia-financiera-mako.md §1.7: con llamadas, un merchant of record
  // no lo toma): siempre se pide, y se cobra aparte. Con el diagnóstico de 2 minutos como puerta (25/10/2026, el molde de
  // Ropofy): tres preguntas, una por pantalla, y después los datos. La llamada arranca sabiendo dónde está su negocio.
  if (id === PROGRAMA_ACELERADOR.id) {
    const pr = PROGRAMA_ACELERADOR;
    return (
      <Ficha resumen={{
        etiqueta: `Pedir ${pr.nombre}`, nombre: pr.nombre, precio: `US$ ${pr.precioUsd.toLocaleString('es-AR')}`,
        // Sin las cuotas (16/11/2026, Martín: «en todos lados eliminemos lo de las 3 cuotas de 500»): cuánto dura.
        periodo: pr.periodo,
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
  // LA MISMA LISTA QUE LA COLUMNA, TAMBIÉN ACÁ (14/11/2026): este pedazo leía `plan.incluye`, que sigue diciendo «Todo lo de
  // Essential, sin tope de leads, landings ni automatizaciones» — la fórmula que Martín mandó sacar («no es la idea de que diga
  // todo lo de Essential más tal»), y una tercera versión de lo que incluye el MISMO plan: el visitante leía la columna, tocaba
  // «Anual / 2 meses gratis» y le cambiaba la lista. Ahora las dos puertas dicen lo de `listaCorta` (ver `incluyeDeLaColumna`).
  if (uno('periodo') === 'anual' && plan.precioAnualUsd) {
    return (
      <Ficha resumen={resumenDelAnual({ nombre: plan.nombre, capa: plan.capa, precioAnualUsd: plan.precioAnualUsd })}>
        <p className="planes-sub">Déjanos tus datos y te escribimos por WhatsApp para darte de alta.{planConPrueba(plan.id) ? ` Empiezas con ${PRUEBA_DIAS} días gratis.` : ''}</p>
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
  // La prueba, en los planes que la traen (`planConPrueba`: Essential y Pro desde el 14/11/2026).
  const conPrueba = planConPrueba(plan.id) && uno('sinPrueba') !== '1';
  // `capa`: la lista del resumen con las ✓ y las ✗ de su columna (`listaDelCheckout`). El resumen trae el precio de CADA pasarela,
  // en su moneda, y el botón dice lo que cobra hoy la elegida (`totalDeHoyPorPasarela`): los dos salen de lo mismo.
  const armado = { nombre: plan.nombre, incluye: incluyeDeLaColumna(plan.capa), capa: plan.capa, precioUsd: plan.precioUsd, pasarelas, conPromo, conPrimerMes, precio };
  const resumen = resumenDelPlan({ ...armado, conPrueba });
  // SIN LA PRUEBA, AUNQUE LA PÁGINA LA TENGA (16/11/2026): si el email o el WhatsApp ya la usaron, la ruta lo dice y la compra sigue
  // sin ella (./CompraPlan.tsx). El resumen tiene preparada su versión sin prueba (`sinPrueba` de `Ficha`) y el botón dice lo que se
  // cobra hoy SIN la prueba: con el resumen de la prueba, ese total es 0 y decía «Suscribirme por US$ 0 al mes» (revisión, hallazgo 4).
  const resumenSin = conPrueba ? resumenDelPlan({ ...armado, conPrueba: false }) : resumen;
  return (
    <Ficha pasarelas={pasarelas.map((x) => x.pasarela)} resumen={resumen} sinPrueba={conPrueba ? resumenSin : undefined}>
      {/* Sin pasarela que lo cobre: no hay formulario que lleve a un pago imposible. Desde el 24/10/2026 la salida NO es la
          agenda (Martín no usa Calendly): el pedido queda en el CRM con su origen y su partner, y se da de alta a mano. */}
      {pasarelas.length
        ? <CompraPlan plan={plan.id} pasarelas={pasarelas} origen={origen} refCodigo={ref} sinPrueba={!conPrueba} promo={conPromo} ladaInicial={ladaDelPais(pais)} hoy={totalDeHoyPorPasarela(resumenSin)} />
        : (
          <>
            <p className="planes-sub">{TEXTO_SIN_PASARELA}</p>
            <QuieroPlan plan={plan.id} nombrePlan={plan.nombre} origen={origen} refCodigo={ref} />
          </>
        )}
    </Ficha>
  );
}
