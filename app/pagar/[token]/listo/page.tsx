// =============================================================================
// /pagar/<token>/listo — adonde vuelve el comprador desde Stripe o Mercado Pago
// =============================================================================
// Dice en qué quedó SU pago, leído de la fila del cobro y no de la URL: el redirect de la pasarela
// puede llegar ANTES que su aviso (el webhook), y un `?status=` en la barra no es una credencial.
// Mientras el cobro siga pendiente, la página se recarga sola cada 8 segundos.
//
// En una venta de MaKo (el alta automática, decisión de Martín del 11/10/2026) dice además a qué
// email le llegó el acceso y ofrece cambiarlo: el login es sólo Google, y se paga con el email que
// uno tenga a mano. El formulario es ./AccesoMako.tsx y escribe por POST /api/pagar/email.
//
// ⚠️ PÚBLICA (prefijo `/pagar`, lib/rutas-publicas.ts), y por eso:
//   · Sólo GET, y NO LEE NINGUNA COOKIE: lo de la base va con el cliente de servicio y el
//     workspace del COBRO (app/pagar/acceso.ts).
//   · SIN <Suspense> NI loading.tsx (AGENTS.md «Ningún <Suspense> grande en una página pública»):
//     el estado del pago tiene que leerse sin JavaScript.
//   · El email se muestra ENMASCARADO: el link se reenvía, y quien lo tenga no tiene por qué leerlo.
//   · `referrer: no-referrer`: el token es la credencial del cambio de email.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { EMAIL_MAKO } from '@/lib/app-url';
import { getCobroPorToken } from '@/lib/cobros';
import { emailEnmascarado } from '@/lib/cobros-reglas';
import { esTokenCobro, NOMBRE_PASARELA, type Cobro } from '@/lib/cobros-tipos';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { nombreDelNegocio, usuarioDelAlta } from '../../acceso';
import { cambiosRestantes } from '../../cambio-email';
import { AccesoMako } from './AccesoMako';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Tu pago',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

// Colores fijos, como las páginas legales: no hay sesión, así que no hay tema. Y la barra de la app
// se esconde igual que en ellas (app/_legal/LegalShell.tsx): viaja en el HTML aunque no haya sesión.
const CSS = `
body:has(.pagar-root) aside { display: none !important; }
body:has(.pagar-root) { background: #F4F6F9; }
.pagar-root { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; color: #12151B;
  font: 400 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.pagar-card { max-width: 460px; width: 100%; background: #fff; border: 1px solid #EAECF1; border-radius: 16px;
  padding: 32px 28px; text-align: center; box-shadow: 0 1px 2px rgba(18,21,27,.04), 0 8px 24px rgba(18,21,27,.06); }
.pagar-negocio { font-weight: 600; font-size: 14px; color: #5B6472; margin-bottom: 18px; }
.pagar-card h1 { margin: 0 0 8px; font-size: 22px; line-height: 1.25; }
.pagar-card p { margin: 8px 0 0; color: #5B6472; }
.pagar-detalle { font-weight: 600; color: #12151B !important; }
.pagar-chip { display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 600; color: #8A5A00;
  background: #FFF4D6; border-radius: 999px; padding: 2px 10px; }
.pagar-btn { display: inline-block; margin-top: 22px; background: #2F6FED; color: #fff !important; text-decoration: none;
  font-weight: 600; font-size: 15px; padding: 12px 24px; border-radius: 10px; border: 0; cursor: pointer; }
.pagar-btn[disabled] { opacity: .6; cursor: default; }
.pagar-link { background: none; border: 0; padding: 0; margin-top: 16px; color: #2F6FED; font: inherit; font-size: 14px;
  text-decoration: underline; cursor: pointer; }
.pagar-acceso { margin-top: 22px; padding-top: 20px; border-top: 1px solid #EAECF1; }
.pagar-form { margin-top: 16px; text-align: left; }
.pagar-form label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.pagar-form input { width: 100%; font: inherit; padding: 10px 12px; border: 1px solid #D5D9E0; border-radius: 10px; }
.pagar-form .pagar-btn { width: 100%; margin-top: 12px; }
.pagar-error { color: #B42318 !important; font-size: 14px; }
.pagar-ok { color: #067647 !important; font-size: 14px; }
`;

/** La tarjeta. `refrescar` = la página se recarga sola (mientras el pago se confirma). */
function Tarjeta({ negocio, titulo, children, refrescar }: { negocio?: string | null; titulo: string; children?: ReactNode; refrescar?: boolean }) {
  return (
    <div className="pagar-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* React 19 sube este <meta> al <head>. Sin JavaScript también recarga. */}
      {refrescar && <meta httpEquiv="refresh" content="8" />}
      <main className="pagar-card">
        {negocio && <div className="pagar-negocio">{negocio}</div>}
        <h1>{titulo}</h1>
        {children}
      </main>
    </div>
  );
}

type Params = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PagoListo({ params, searchParams }: Params) {
  const { token } = await params;
  // El token se valida ANTES de ir a la base. Uno que no existe es un 404 igual que uno mal escrito.
  if (!esTokenCobro(token)) notFound();
  const cancelado = (await searchParams).cancelado === '1';

  let leido: Cobro | null;
  try {
    leido = await getCobroPorToken(token);
  } catch (e) {
    console.error('[pagar/listo] no pude leer el cobro:', e instanceof Error ? e.message : e);
    return (
      <Tarjeta titulo="No pudimos cargar tu pago" refrescar>
        <p>Es un problema nuestro, no de tu pago. Esta página se vuelve a cargar sola.</p>
      </Tarjeta>
    );
  }
  if (!leido) notFound();
  const c = leido;

  const negocio = await nombreDelNegocio(c.workspace_id);
  const pasarela = NOMBRE_PASARELA[c.proveedor];
  const pagarDeNuevo = `/pagar/${c.token}`;
  const detalle = (
    <>
      <p className="pagar-detalle">{c.concepto} · {formatoMonto(c.monto, c.moneda)}</p>
      {c.modo === 'prueba' && <span className="pagar-chip">Pago de prueba</span>}
    </>
  );

  if (c.estado === 'pagado') {
    return (
      <Tarjeta negocio={negocio} titulo="Pago recibido" refrescar={!!c.alta_capa && (c.alta_estado == null || c.alta_estado === 'pendiente')}>
        {detalle}
        <p>{pasarela} confirmó tu pago.{c.tipo === 'suscripcion' ? ' Se renueva cada mes hasta que lo canceles.' : ''}</p>
        {c.alta_capa && <AltaDeMako c={c} />}
      </Tarjeta>
    );
  }

  if (c.estado === 'pendiente') {
    // `?cancelado=1` lo pone la pasarela cuando la persona sale del checkout sin pagar
    // (cancelUrl de Stripe, lib/cobros.ts). Si igual el cobro ya está pagado, manda el cobro.
    if (cancelado) {
      return (
        <Tarjeta negocio={negocio} titulo="No se completó el pago">
          {detalle}
          <p>Puedes volver a intentarlo cuando quieras.</p>
          <a className="pagar-btn" href={pagarDeNuevo}>Volver a intentar</a>
        </Tarjeta>
      );
    }
    return (
      <Tarjeta negocio={negocio} titulo="Estamos confirmando tu pago" refrescar>
        {detalle}
        <p>Esperamos la confirmación de {pasarela}. Esta página se actualiza sola.</p>
        <p>¿Todavía no pagaste? <a href={pagarDeNuevo}>Ir a pagar</a></p>
      </Tarjeta>
    );
  }

  if (c.estado === 'fallido') {
    return (
      <Tarjeta negocio={negocio} titulo="No se pudo cobrar">
        {detalle}
        <p>{pasarela} no aprobó el pago. Puedes intentarlo de nuevo, con el mismo medio o con otro.</p>
        <a className="pagar-btn" href={pagarDeNuevo}>Volver a intentar</a>
      </Tarjeta>
    );
  }

  if (c.estado === 'reembolsado') {
    return (
      <Tarjeta negocio={negocio} titulo="Este pago se reembolsó">
        {detalle}
        <p>La devolución la hace {pasarela}. Cuándo se ve en tu cuenta depende de tu banco o de {pasarela}.</p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta negocio={negocio} titulo="Este link ya no está disponible">
      <p>Si todavía quieres pagar, pídele un link nuevo a quien te lo mandó.</p>
    </Tarjeta>
  );
}

/** La venta de un plan de MaKo: en qué quedó la cuenta. Sólo con el cobro PAGADO. */
async function AltaDeMako({ c }: { c: Cobro }) {
  if (c.alta_estado === 'hecha') {
    const u = await usuarioDelAlta(c).catch((e: unknown) => {
      console.error('[pagar/listo] no pude leer la cuenta del alta:', e instanceof Error ? e.message : e);
      return null;
    });
    if (!u) {
      return (
        <div className="pagar-acceso">
          <p>Tu cuenta de MaKo ya está creada. Si no te llegó el acceso, escríbenos a <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>.</p>
        </div>
      );
    }
    return (
      <AccesoMako
        token={c.token}
        emailInicial={emailEnmascarado(u.email) ?? ''}
        yaEntro={!!u.ultimo_login}
        puedeCambiar={!u.ultimo_login && cambiosRestantes(c) > 0}
        contacto={EMAIL_MAKO}
      />
    );
  }
  if (c.alta_estado === 'ya_tenia_cuenta') {
    return (
      <div className="pagar-acceso">
        <p>Ese email ya tiene una cuenta de MaKo, así que no creamos otra. Escríbenos a <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a> y activamos tu plan en esa cuenta.</p>
      </div>
    );
  }
  if (c.alta_estado === 'error') {
    return (
      <div className="pagar-acceso">
        <p>Tu pago entró, pero todavía no pudimos crear tu cuenta de MaKo. Lo volvemos a intentar solos; si en un rato no te llega el acceso, escríbenos a <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>.</p>
      </div>
    );
  }
  return (
    <div className="pagar-acceso">
      <p>Estamos creando tu cuenta de MaKo. Esta página se actualiza sola.</p>
    </div>
  );
}
