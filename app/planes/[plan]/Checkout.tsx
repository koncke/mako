// =============================================================================
// El marco del checkout de un plan: la estructura de Stripe Checkout, con los colores y la letra de MaKo (12/11/2026)
// =============================================================================
// Martín: «Puedes hacer absolutamente todo el diseño de la pasarela de pago». La referencia (la eligió el Cerebro) es Stripe
// Checkout, copiada en estructura: a la izquierda el resumen, a la derecha el formulario, y en el teléfono el resumen arriba y
// plegable. Vive aparte de page.tsx para poder dibujarlo solo (scripts de revisión visual). Los estilos: ../estilo.ts.
// =============================================================================

import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { NOMBRE_PASARELA, type Pasarela } from '@/lib/cobros-tipos';
import { PRUEBA_DIAS } from '@/lib/planes-mako';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { CSS_PLANES } from '../estilo';
import { BarraGlobal } from '@/app/vsl/_sitio/Barra';

/** Lo que dice el resumen de la izquierda (Stripe Checkout): sólo datos del plan, nada inventado. */
export type Resumen = {
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
export function resumenDelPlan(p: {
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
  // CUÁNDO EMPIEZA EL COBRO, CON SU FECHA (12/11/2026, Martín: «eso tiene que estar con que se indique que, como toda
  // suscripción, recién va a empezar el cobro a los 7 días»): como el «Total after trial» de Stripe Checkout.
  const fecha = new Date(Date.now() + PRUEBA_DIAS * 86_400_000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
  if (p.conPrueba) totales.push({ concepto: `Desde el ${fecha}`, monto: `${mes} por mes` });
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
    nota: p.conPrueba
      ? `Como toda suscripción, el cobro empieza a los ${PRUEBA_DIAS} días: el primero es el ${fecha}. Si te das de baja antes, no pagas nada.`
      : 'Se cobra hoy y cada mes, hasta que te des de baja.',
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
export function Ficha({ resumen: r, pasarelas = [], children }: { resumen: Resumen; pasarelas?: readonly Pasarela[]; children: ReactNode }) {
  const procesa = [...new Set(pasarelas)].map((x) => NOMBRE_PASARELA[x]);
  // La barra del sitio también aquí (12/11/2026, Martín: «la top bar jamás debe desaparecer en ningún momento»).
  return (
    <>
    <BarraGlobal claro />
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
    </>
  );
}
