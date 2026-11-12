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
import { activarPruebaSiAutorizo, getCobroPorToken, inicioDeLaPrueba } from '@/lib/cobros';
import { diaDelCobro, esPruebaDePlan, esPruebaRechazada, TEXTO_PRUEBA_USADA_EMAIL, TEXTO_PRUEBA_USADA_TARJETA } from '@/lib/prueba-plan-reglas';
import { CAPACIDADES_PASARELA } from '@/lib/cobros-tipos';
import { emailEnmascarado, mailDeAccesoNoSalio } from '@/lib/cobros-reglas';
import { esTokenCobro, NOMBRE_PASARELA, type Cobro } from '@/lib/cobros-tipos';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { montoDelPrimerPago } from '@/lib/primer-mes-reglas';
import { nombreDelNegocio, usuarioDelAlta } from '../../acceso';
import { cambiosRestantes, dentroDeLaVentana } from '../../cambio-email';
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
// EL DISEÑO (12/11/2026, Martín: «todo el diseño de la pasarela»): la página de después del pago de Stripe Checkout —un ícono que
// dice en qué quedó, el título, el detalle y lo que sigue— con la letra y los colores de MaKo. Sin el logo de MaKo: esta página
// la ven también los clientes de los negocios que cobran con MaKo (arriba va el nombre de ESE negocio).
const CSS = `
body:has(.pagar-root) aside { display: none !important; }
body:has(.pagar-root) { background: #efefed; }
.pagar-root { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; color: #121212;
  font: 400 16px/1.55 'Geist', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.pagar-card { max-width: 460px; width: 100%; background: #fcfcfb; border: 1px solid rgba(17,17,17,.09); border-radius: 18px;
  padding: 36px 28px 30px; text-align: center; box-shadow: 0 1px 2px rgba(17,17,17,.04), 0 12px 32px rgba(17,17,17,.08); }
.pagar-negocio { font-weight: 700; font-size: 14px; color: #4f4f4c; margin-bottom: 20px; letter-spacing: -.005em; }
.pagar-icono { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 999px; display: grid; place-items: center; font-size: 26px; font-weight: 800; }
.pagar-icono.ok { background: #d5eee4; color: #22735c; }
.pagar-icono.espera { background: #FDF4DE; color: #8F6709; }
.pagar-icono.mal { background: #f8e1da; color: #b1412a; }
.pagar-icono.espera span { display: block; width: 22px; height: 22px; border-radius: 999px; border: 3px solid currentColor; border-right-color: transparent;
  animation: pagar-gira 1s linear infinite; }
@keyframes pagar-gira { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .pagar-icono.espera span { animation: none; } }
.pagar-card h1 { margin: 0 0 8px; font-size: 24px; line-height: 1.2; font-weight: 800; letter-spacing: -.015em; }
.pagar-card p { margin: 8px 0 0; color: #4f4f4c; }
.pagar-card a { color: #121212; }
.pagar-detalle { font-weight: 700; color: #121212 !important; margin-top: 14px !important; padding: 12px 14px; border-radius: 12px; background: #f0f0ef; }
.pagar-chip { display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 700; color: #8F6709;
  background: #FDF4DE; border-radius: 999px; padding: 2px 10px; }
.pagar-btn { display: inline-block; margin-top: 22px; background: #121212; color: #fff !important; text-decoration: none;
  font-weight: 700; font-size: 15px; padding: 13px 24px; border-radius: 10px; border: 0; cursor: pointer; font-family: inherit; }
.pagar-btn:hover { background: #202020; }
.pagar-btn:focus-visible { outline: 2px solid #F2B01E; outline-offset: 2px; }
.pagar-btn[disabled] { opacity: .6; cursor: default; }
.pagar-link { background: none; border: 0; padding: 0; margin-top: 16px; color: #121212; font: inherit; font-size: 14px;
  text-decoration: underline; cursor: pointer; }
.pagar-acceso { margin-top: 22px; padding-top: 20px; border-top: 1px solid rgba(17,17,17,.09); }
.pagar-form { margin-top: 16px; text-align: left; }
.pagar-form label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.pagar-form input { width: 100%; box-sizing: border-box; font: inherit; padding: 11px 12px; border: 1px solid rgba(17,17,17,.17); border-radius: 10px; background: #fff; }
.pagar-form input:focus { outline: none; border-color: #121212; box-shadow: 0 0 0 3px rgba(242,176,30,.35); }
.pagar-form .pagar-btn { width: 100%; margin-top: 12px; }
.pagar-error { color: #b1412a !important; font-size: 14px; }
.pagar-ok { color: #22735c !important; font-size: 14px; }
`;

/** La tarjeta. `refrescar` = la página se recarga sola (mientras el pago se confirma). */
function Tarjeta({ negocio, titulo, children, refrescar, tono }: { negocio?: string | null; titulo: string; children?: ReactNode; refrescar?: boolean; tono?: 'ok' | 'espera' | 'mal' }) {
  return (
    <div className="pagar-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* React 19 sube este <meta> al <head>. Sin JavaScript también recarga. */}
      {refrescar && <meta httpEquiv="refresh" content="8" />}
      <main className="pagar-card">
        {negocio && <div className="pagar-negocio">{negocio}</div>}
        {tono && <div className={`pagar-icono ${tono}`} aria-hidden="true">{tono === 'ok' ? '✓' : tono === 'mal' ? '!' : <span />}</div>}
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
      <Tarjeta titulo="No pudimos cargar tu pago" refrescar tono="espera">
        <p>Es un problema nuestro, no de tu pago. Esta página se vuelve a cargar sola.</p>
      </Tarjeta>
    );
  }
  if (!leido) notFound();
  // LA PRUEBA GRATIS (25/10/2026): la persona vuelve de autorizarla en Mercado Pago. Se activa acá (y el alta con ella), sin
  // esperar al cron: lo que sigue se dibuja con el cobro ya activado (o rechazado, si esa tarjeta ya usó su prueba).
  let c = leido;
  if (esPruebaDePlan(c) && c.estado === 'pendiente' && !c.suscripcion_estado && !cancelado) {
    if (await activarPruebaSiAutorizo(c)) c = (await getCobroPorToken(token).catch(() => null)) ?? c;
  }

  const negocio = await nombreDelNegocio(c.workspace_id);
  const pasarela = NOMBRE_PASARELA[c.proveedor];
  const pagarDeNuevo = `/pagar/${c.token}`;
  const detalle = (
    <>
      <p className="pagar-detalle">{c.concepto} · {formatoMonto(montoDelPrimerPago(c), c.moneda)}</p>
      {c.modo === 'prueba' && <span className="pagar-chip">Pago de prueba</span>}
    </>
  );

  if (c.estado === 'pagado') {
    return (
      <Tarjeta negocio={negocio} titulo="Pago recibido" tono="ok" refrescar={!!c.alta_capa && (c.alta_estado == null || c.alta_estado === 'pendiente')}>
        {detalle}
        <p>{pasarela} confirmó tu pago.{c.tipo === 'suscripcion' ? ' Se renueva cada mes hasta que lo canceles.' : ''}</p>
        {c.alta_capa && <AltaDeMako c={c} />}
      </Tarjeta>
    );
  }

  // La prueba autorizada: empezó, con su alta. El cobro sigue pendiente hasta el día 8 (no es un pago todavía).
  if (esPruebaDePlan(c) && c.estado === 'pendiente' && c.suscripcion_estado === 'activa') {
    const inicio = await inicioDeLaPrueba(c).catch(() => null);
    return (
      <Tarjeta negocio={negocio} titulo="Tu prueba gratis empezó" tono="ok" refrescar={!!c.alta_capa && (c.alta_estado == null || c.alta_estado === 'pendiente')}>
        {detalle}
        <p>
          No se te cobró nada.{inicio ? ` El ${diaDelCobro(inicio)} ${pasarela} cobra ${formatoMonto(c.monto, c.moneda)} con tu tarjeta, y te avisamos dos días antes.` : ''}{' '}
          Si te das de baja antes desde «Tu plan», no se te cobra nada.
        </p>
        {c.alta_capa && <AltaDeMako c={c} />}
      </Tarjeta>
    );
  }
  // La prueba que esa tarjeta (o esa cuenta de MP) ya había usado: se canceló en el acto, sin cobrar.
  if (esPruebaDePlan(c) && c.estado === 'anulado' && esPruebaRechazada(c.motivo)) {
    const plan = /^planes:([a-z0-9-]{1,32}):prueba$/.exec(c.creado_por ?? '')?.[1];
    return (
      <Tarjeta negocio={negocio} titulo="Ya usaste tu prueba gratis">
        <p>{CAPACIDADES_PASARELA[c.proveedor].huellaDeTarjeta ? TEXTO_PRUEBA_USADA_TARJETA : TEXTO_PRUEBA_USADA_EMAIL}</p>
        {plan && <a className="pagar-btn" href={`/planes/${plan}?sinPrueba=1`}>Empezar sin prueba</a>}
      </Tarjeta>
    );
  }

  if (c.estado === 'pendiente') {
    // `?cancelado=1` lo pone la pasarela cuando la persona sale del checkout sin pagar
    // (cancelUrl de Stripe, lib/cobros.ts). Si igual el cobro ya está pagado, manda el cobro.
    if (cancelado) {
      return (
        <Tarjeta negocio={negocio} titulo="No se completó el pago" tono="mal">
          {detalle}
          <p>Puedes volver a intentarlo cuando quieras.</p>
          <a className="pagar-btn" href={pagarDeNuevo}>Volver a intentar</a>
        </Tarjeta>
      );
    }
    return (
      <Tarjeta negocio={negocio} titulo="Estamos confirmando tu pago" refrescar tono="espera">
        {detalle}
        <p>Esperamos la confirmación de {pasarela}. Esta página se actualiza sola.</p>
        <p>¿Todavía no pagaste? <a href={pagarDeNuevo}>Ir a pagar</a></p>
      </Tarjeta>
    );
  }

  if (c.estado === 'fallido') {
    return (
      <Tarjeta negocio={negocio} titulo="No se pudo cobrar" tono="mal">
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

/** La venta de un plan de MaKo: en qué quedó la cuenta. Con el cobro PAGADO, o con la prueba gratis autorizada. */
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
        puedeCambiar={!u.ultimo_login && cambiosRestantes(c) > 0 && dentroDeLaVentana(c)}
        contacto={EMAIL_MAKO}
        // Con el mail caído no se le dice «te mandamos el acceso» (revisión del 23/10/2026): esperaría un mail que no llega.
        mailSalio={!mailDeAccesoNoSalio(c.alta_motivo)}
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
        <p>{c.estado === 'pagado' ? 'Tu pago entró, pero todavía' : 'Todavía'} no pudimos crear tu cuenta de MaKo. Lo volvemos a intentar solos; si en un rato no te llega el acceso, escríbenos a <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>.</p>
      </div>
    );
  }
  return (
    <div className="pagar-acceso">
      <p>Estamos creando tu cuenta de MaKo. Esta página se actualiza sola.</p>
    </div>
  );
}
