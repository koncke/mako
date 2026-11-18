// =============================================================================
// LandingPartners — la página de MaKo Partners, la que VENDE el programa (24/10/2026; rehecha el 25/10/2026; el 30% de por
// vida, 18/11/2026)
// =============================================================================
// EL PROGRAMA NUEVO (18/11/2026, Martín por el Cerebro: «Me gusta la misma… solamente calculado a esto»): MISMA página, mismo
// diseño y mismo orden, recalculada. Se acabó el «100% del primer mes»: el partner se lleva un porcentaje de CADA pago de cada
// negocio que trae, todos los meses, para siempre. El 30% si la plata entra por Binance o transferencia (también si el partner
// cobra él y manda el resto por ahí) y el 27% si entra por una pasarela o un link de pago (Mercado Pago, tarjeta, Whop). Los
// porcentajes y la cuenta son del chat de Cobros (lib/partners-reglas.ts: `COMISION_PARTNER_DIRECTO`, `COMISION_PARTNER_PASARELA`,
// `comisionDelPago`); acá no se escribe ninguno. «¿Cuándo cobro?» dice «cada pago» y no promete fecha: la acreditación por pago
// la está haciendo Cobros, y el pago al partner sigue siendo una transferencia de MaKo (`PAGO_HOY`).
//
// LO DE ANTES (25/10/2026):
// La dibujan la página pública (app/mako-partners/page.tsx) y, adentro de la app, /partners mientras el negocio NO se hizo
// partner (y con «Ver la landing» después). Martín, 25/10: «Elimina lo de "gana meses de tu plan", que solo ganen direro y
// listo... No pongas al programa de 1500... Hazlo más marketinero la landing, literalmente se llevan el 100% de lo que
// venden. La calculadora ponlo en dode hoy está "Si se suscribe". Y solo la parte azul. Elimina la sección de "Cómo
// funciona" y "Por ahora MaKo da de alta a mano". Revisa las preguntas frecuentes... Ya no hay "meses" ni "devolución"...
// Si pueden hacer ads que digan "mako", no aclares eso... Elimina lo de "Si llegó con varios links, vale el primero."... Se
// mas claro y marketinero».
//
// EL ORDEN: el título con el porcentaje y la calculadora azul al lado (Calculadora.tsx), tres números grandes, las preguntas y
// el cierre. COPIADO DE (mirados el 24 y el 25/10): LLM Pulse (llmpulse.ai/affiliate) para el hero con la calculadora; Tolt
// (tolt.com/platform/affiliate-portal) para decir lo que gana el partner en números grandes; systeme.io para las preguntas
// cortas. Lo que NO se tomó: los testimonios (hoy no hay partners que hayan cobrado, y uno inventado no se publica).
//
// ⚠️ SÓLO LO QUE PASA (24/10, el Cerebro: «la página de Partners no promete nada que no vayamos a cumplir»): lo transfiere
// MaKo (`PAGO_HOY`). Los números salen de los planes y de las reglas, nunca escritos a mano.
//
// LOS DOS MODOS: `publica` (colores fijos de la página de venta, la barra de la app escondida) y `app` (los tokens de la
// app: cambia con el tema oscuro y el Nord; la barra queda). La acción es UNA y es un link: hacerse partner (el onboarding
// corto de /partners) o, para quien ya lo es, volver a su panel.
// =============================================================================

import type { ReactNode } from 'react';
import Link from 'next/link';
import { COMISION_PARTNER_DIRECTO, COMISION_PARTNER_PASARELA, DIAS_COOKIE_REF, PAGO_HOY, RUTA_ALTA_PARTNERS, comisionDelPago, type CanalDelPago } from '@/lib/partners-reglas';
import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako';
import { Calculadora } from './Calculadora';
import { gananciaPorMes, porcentaje, usd } from './numeros';
import { MARCA } from '@/lib/tutoriales/marcas';

const CSS = `
.mp-root { --mp-ink: #12151B; --mp-dim: #4A5260; --mp-suave: #5B6472; --mp-borde: #E6EAF2; --mp-sup: #FFFFFF; --mp-gris: #F6F8FB;
  --mp-azul: #2F6FED; --mp-azul-osc: #1F4FC2; --mp-azul-bg: #EEF3FE; --mp-sobre-azul: #FFFFFF; --mp-bien: #1F9D55;
  color: var(--mp-ink); font: 400 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.mp-root.mp-app { --mp-ink: var(--ink); --mp-dim: var(--dim); --mp-suave: var(--dim); --mp-borde: var(--border); --mp-sup: var(--surface);
  --mp-gris: var(--surface-2); --mp-azul: var(--primary); --mp-azul-osc: color-mix(in srgb, var(--primary) 78%, #000); --mp-azul-bg: var(--primary-bg);
  --mp-sobre-azul: var(--on-primary, #fff); --mp-bien: var(--good); font: inherit; }
body:has(.mp-publica) aside { display: none !important; }
body:has(.mp-publica) { background: #FFFFFF; }
.mp-wrap { max-width: 1100px; margin: 0 auto; padding: 0 20px; box-sizing: border-box; }
.mp-app .mp-wrap { padding: 0; }
.mp-barra { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; }
.mp-marca { font-weight: 800; font-size: 17px; color: var(--mp-azul); text-decoration: none; }
.mp-barra a.mp-entrar { color: var(--mp-ink); font-weight: 600; font-size: 14px; text-decoration: none; }
.mp-hero { background: radial-gradient(1100px 480px at 90% -10%, color-mix(in srgb, var(--mp-azul) 18%, transparent), transparent 60%),
  linear-gradient(180deg, var(--mp-azul-bg) 0%, var(--mp-sup) 100%); padding: 8px 0 64px; }
.mp-app .mp-hero { border: 1px solid var(--mp-borde); border-radius: 24px; padding: 8px 32px 36px; margin: 4px 0 8px; }
.mp-hero-grilla { display: grid; grid-template-columns: 1.15fr 1fr; gap: 44px; align-items: center; padding-top: 36px; }
.mp-ceja { display: inline-block; font-size: 12.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--mp-azul);
  background: color-mix(in srgb, var(--mp-azul) 11%, transparent); padding: 6px 12px; border-radius: 999px; }
.mp-hero h1 { margin: 16px 0 14px; font-size: 52px; line-height: 1.04; letter-spacing: -.035em; font-weight: 800; color: var(--mp-ink); }
.mp-app .mp-hero h1 { font-size: 44px; }
.mp-hero h1 em { font-style: normal; color: var(--mp-azul); }
.mp-bajada { margin: 0 0 26px; font-size: 18.5px; color: var(--mp-dim); max-width: 540px; }
.mp-bajada b { color: var(--mp-ink); }
.mp-junto { white-space: nowrap; }
.mp-acciones { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; }
.mp-btn { display: inline-block; border: 0; cursor: pointer; font: inherit; background: var(--mp-azul); color: var(--mp-sobre-azul) !important;
  text-decoration: none; font-weight: 700; font-size: 17px; padding: 16px 28px; border-radius: 12px; text-transform: uppercase; letter-spacing: .04em;
  box-shadow: 0 10px 26px color-mix(in srgb, var(--mp-azul) 32%, transparent); transition: transform .15s ease, box-shadow .15s ease; }
.mp-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 30px color-mix(in srgb, var(--mp-azul) 36%, transparent); }
.mp-chips { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 22px 0 0; padding: 0; list-style: none; color: var(--mp-suave); font-size: 14.5px; }
.mp-chips li::before { content: "✓"; color: var(--mp-bien); font-weight: 800; margin-right: 7px; }
.mp-calc { border-radius: 24px; padding: 26px 26px 24px; color: var(--mp-sobre-azul);
  background: radial-gradient(420px 220px at 100% 0%, rgba(255,255,255,.16), transparent 70%), linear-gradient(140deg, var(--mp-azul) 0%, var(--mp-azul-osc) 100%);
  box-shadow: 0 26px 60px color-mix(in srgb, var(--mp-azul) 34%, transparent); }
/* La calculadora (18/11/2026, Martín: «que sea mucho más claro… siento que hay como muchos botones»): UN control (cuántos negocios),
   el resultado como lo que más se ve, una línea chica para la pasarela y el botón. Nada más. */
.mp-calc-fila { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 22px; }
.mp-calc-fila label { font-weight: 700; font-size: 18px; }
.mp-calc-n { font-size: 40px; line-height: 1; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.mp-calc-barra { --mp-lleno: 8%; width: 100%; margin: 16px 0 0; height: 8px; border-radius: 999px; appearance: none; -webkit-appearance: none; cursor: pointer;
  background: linear-gradient(90deg, var(--mp-sobre-azul) var(--mp-lleno), rgba(255,255,255,.28) var(--mp-lleno)); }
.mp-calc-barra::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: var(--mp-sobre-azul);
  border: 3px solid var(--mp-azul-osc); box-shadow: 0 2px 10px rgba(0,0,0,.25); }
.mp-calc-barra::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--mp-sobre-azul); border: 3px solid var(--mp-azul-osc); }
.mp-calc-barra:focus-visible { outline: 2px solid var(--mp-sobre-azul); outline-offset: 6px; }
/* Los dos interruptores (el plan y cómo te pagan), arriba e iguales: UNA píldora con el fondo blanco que se desliza a la opción
   activa (18/11/2026, versión 57). La letra se achica con el ancho de la píldora (cqi) antes que partirse en dos renglones. */
.mp-calc-sw { position: relative; display: grid; grid-template-columns: 1fr 1fr; width: 100%; padding: 4px; border-radius: 999px; cursor: pointer;
  font: inherit; color: var(--mp-sobre-azul); background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25); container-type: inline-size; }
.mp-calc-sw + .mp-calc-sw { margin-top: 10px; }
.mp-calc-sw:hover { background: rgba(255,255,255,.17); }
.mp-calc-sw:focus-visible { outline: 2px solid var(--mp-sobre-azul); outline-offset: 3px; }
.mp-calc-sw-fondo { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); border-radius: 999px; background: var(--mp-sobre-azul);
  box-shadow: 0 2px 10px rgba(0,0,0,.18); transition: transform .2s ease; }
.mp-calc-sw.der .mp-calc-sw-fondo { transform: translateX(100%); }
.mp-calc-sw-op { position: relative; padding: 12px 4px; font-size: min(14px, calc((50cqi - 12px) / 11.5)); font-weight: 700; line-height: 1.2;
  white-space: nowrap; text-align: center; opacity: .85; transition: color .2s ease, opacity .2s ease; }
.mp-calc-sw-op.activo { color: var(--mp-azul-osc); opacity: 1; }
@media (prefers-reduced-motion: reduce) { .mp-calc-sw-fondo, .mp-calc-sw-op { transition: none; } }
.mp-calc-sw-corto { display: none; }
/* En el teléfono, el texto corto y la letra fija en 13 px (con el completo, la letra bajaba a 11,5 px para entrar). */
@media (max-width: 479px) {
  .mp-calc-sw-largo { display: none; }
  .mp-calc-sw-corto { display: inline; }
  .mp-calc-sw-op { font-size: 13px; padding-inline: 2px; }
}
.mp-calc-res { margin: 18px 0 22px; container-type: inline-size; }
/* El precio en UNA línea con «al mes» al final, más chico; la letra sigue el ancho del recuadro (cqi) para que el monto más largo
   («US$ 1.367,70 al mes») entre sin partirse. */
.mp-calc-monto { font-size: min(64px, calc(100cqi / 7.6)); line-height: 1; font-weight: 800; letter-spacing: -.045em; font-variant-numeric: tabular-nums;
  white-space: nowrap; }
.mp-calc-monto span { font-size: .34em; font-weight: 700; letter-spacing: 0; opacity: .9; }
.mp-calc-anio { margin-top: 10px; font-size: 17px; font-weight: 600; opacity: .9; font-variant-numeric: tabular-nums; }
.mp-calc .mp-btn { background: var(--mp-sobre-azul); color: var(--mp-azul-osc) !important; box-shadow: none; width: 100%; text-align: center; box-sizing: border-box; }
.mp-seccion { padding: 72px 0; }
.mp-app .mp-seccion { padding: 44px 0 8px; }
.mp-seccion h2 { margin: 10px 0 10px; font-size: 36px; line-height: 1.12; letter-spacing: -.025em; text-align: center; font-weight: 800; color: var(--mp-ink); }
.mp-app .mp-seccion h2 { font-size: 30px; }
.mp-sub { margin: 0 auto 30px; max-width: 600px; text-align: center; color: var(--mp-suave); font-size: 17px; }
.mp-numeros { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; grid-template-columns: repeat(3, 1fr); }
.mp-numero { background: var(--mp-sup); border: 1px solid var(--mp-borde); border-radius: 22px; padding: 28px 24px 24px; }
.mp-numero b { display: block; font-size: 54px; line-height: 1; font-weight: 800; letter-spacing: -.04em; color: var(--mp-azul); margin-bottom: 12px; }
.mp-numero span { display: block; font-size: 16px; color: var(--mp-dim); }
.mp-numero strong { color: var(--mp-ink); }
.mp-faq { max-width: 780px; margin: 0 auto; display: grid; gap: 10px; }
.mp-faq details { background: var(--mp-sup); border: 1px solid var(--mp-borde); border-radius: 16px; padding: 0 22px; }
.mp-faq summary { cursor: pointer; list-style: none; padding: 18px 0; font-weight: 700; font-size: 17px; color: var(--mp-ink); display: flex;
  justify-content: space-between; gap: 16px; }
.mp-faq summary::-webkit-details-marker { display: none; }
.mp-faq summary::after { content: "+"; color: var(--mp-azul); font-weight: 800; font-size: 22px; line-height: 1; }
.mp-faq details[open] summary::after { content: "−"; }
.mp-faq details p { margin: 0 0 18px; color: var(--mp-dim); font-size: 16px; }
.mp-faq details p b { color: var(--mp-ink); }
.mp-final { background: radial-gradient(600px 260px at 100% 0%, rgba(255,255,255,.14), transparent 70%), linear-gradient(135deg, var(--mp-azul) 0%, var(--mp-azul-osc) 100%);
  color: var(--mp-sobre-azul); border-radius: 26px; padding: 52px 32px; text-align: center; }
.mp-final h2 { color: var(--mp-sobre-azul); margin: 0 0 10px; }
.mp-final p { margin: 0 0 26px; opacity: .9; font-size: 18px; }
.mp-final .mp-btn { background: var(--mp-sobre-azul); color: var(--mp-azul-osc) !important; box-shadow: none; }
.mp-final .mp-texto { display: inline-block; margin-top: 18px; color: var(--mp-sobre-azul); opacity: .9; font-weight: 600; text-decoration: none; }
.mp-pie { text-align: center; color: #8A93A2; font-size: 13.5px; padding: 28px 0 40px; }
.mp-pie a { color: #5B6472; }
@media (max-width: 860px) {
  .mp-hero-grilla, .mp-numeros { grid-template-columns: 1fr; }
  .mp-hero h1, .mp-app .mp-hero h1 { font-size: 36px; }
  .mp-app .mp-hero { padding: 4px 16px 20px; border-radius: 18px; }
  .mp-hero-grilla { gap: 28px; padding-top: 24px; }
  .mp-calc { padding: 22px 18px 20px; border-radius: 20px; }
  .mp-numero b { font-size: 44px; }
  .mp-seccion { padding: 52px 0; }
  .mp-seccion h2, .mp-app .mp-seccion h2 { font-size: 27px; }
  .mp-btn { width: 100%; text-align: center; box-sizing: border-box; }
}
`;

/** El ejemplo del subtítulo: cuántos negocios (Martín, 18/11/2026: «Con 10 negocios en MaKo Pro, son US$ 291 al mes para ti»). */
const NEGOCIOS_DEL_EJEMPLO = 10;

/** La acción de la landing: hacerse partner, o volver al panel. Siempre un link (sin JavaScript también lleva). */
export type AccionLanding = { href: string; texto: string };

/** `marca`: la del tutorial de /partners (sólo el botón de arriba, adentro de la app, para quien todavía no es partner). */
function Boton({ boton, marca }: { boton: AccionLanding | null; marca?: string }) {
  return boton ? <Link className="mp-btn" href={boton.href} data-recorrido={marca}>{boton.texto}</Link> : null;
}

export function LandingPartners({ modo = 'publica', accion, rotulo }: {
  /** `publica`: la página de venta; `app`: adentro de la tab, con los colores de la app. */
  modo?: 'publica' | 'app';
  /** El botón (en el hero, en la calculadora y en el cierre). null = sin botón (el super admin mirando cómo se ve). */
  accion?: AccionLanding | null;
  /** Una línea arriba de todo (el super admin: «así la ven tus clientes»; el partner: «volver a tu panel»). */
  rotulo?: ReactNode;
}) {
  const planes = PLANES_MAKO_DEFAULT.filter((p) => p.activo).slice().sort((a, b) => b.precioUsd - a.precioUsd);
  const tope = planes[0];
  const publica = modo === 'publica';
  // «Hacerme partner», sin «gratis» (Martín, 18/11/2026: «de hecho no es gratis, deben estar pagando su suscripción»). En mayúscula
  // por la clase (`.mp-btn`), como todos los botones de llamada a la acción del sitio.
  const boton = accion === undefined ? { href: RUTA_ALTA_PARTNERS, texto: 'Hacerme partner' } : accion;
  // Adentro de la app ya hay un <main> (el del shell): la landing es un bloque más.
  const Raiz = publica ? 'main' : 'div';
  const directo = porcentaje(COMISION_PARTNER_DIRECTO), pasarela = porcentaje(COMISION_PARTNER_PASARELA);
  /** «US$ 29,10 al mes por cada MaKo Pro y US$ 14,10 por cada MaKo Essential», según por dónde entra la plata. */
  const precios = (canal: CanalDelPago) =>
    planes.map((p, i) => `${usd(comisionDelPago(p.precioUsd, canal))}${i === 0 ? ' al mes' : ''} por cada ${p.nombre}`).join(' y ');
  return (
    <Raiz className={`mp-root ${publica ? 'mp-publica' : 'mp-app'}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {rotulo}
      <div className="mp-hero">
        <div className="mp-wrap">
          {publica && (
            <nav className="mp-barra">
              <Link className="mp-marca" href="/">MaKo Partners</Link>
              <Link className="mp-entrar" href="/partners">Entrar</Link>
            </nav>
          )}
          <div className="mp-hero-grilla">
            <div>
              <span className="mp-ceja">MaKo Partners</span>
              {/* Martín, 18/11/2026: «Elimina esto del título: de por vida. Y mejora el copy del subtítulo, que sea más claro y
                  marketinero». El ejemplo de 10 negocios en el plan más caro sale de la regla (`gananciaPorMes`), no escrito. */}
              <h1>Recomienda MaKo y llévate el <em>{directo}</em></h1>
              <p className="mp-bajada">
                Por cada negocio que entra con tu link, te llevas <b>el {directo} de lo que paga, todos los meses</b>.
                {tope && <> Con {NEGOCIOS_DEL_EJEMPLO} negocios en {tope.nombre}, son <b className="mp-junto">{usd(gananciaPorMes(NEGOCIOS_DEL_EJEMPLO, tope.precioUsd, 'directo'))} al mes</b> para ti.</>}
              </p>
              <div className="mp-acciones"><Boton boton={boton} marca={!publica && boton?.href === RUTA_ALTA_PARTNERS ? MARCA.partnersHacerme : undefined} /></div>
              <ul className="mp-chips">
                <li>Negocios ilimitados</li>
                <li>Todos los meses</li>
                <li>Cobras en dinero</li>
              </ul>
            </div>
            <Calculadora planes={planes.map((p) => ({ id: p.id, nombre: p.nombre, precioUsd: p.precioUsd }))}><Boton boton={boton} /></Calculadora>
          </div>
        </div>
      </div>

      <section className="mp-seccion">
        <div className="mp-wrap">
          <h2>El {directo} es tuyo todos los meses</h2>
          <p className="mp-sub">No es un pago único: te llevas el {directo} de cada pago, todos los meses, mientras el negocio siga en MaKo.</p>
          <ul className="mp-numeros">
            <li className="mp-numero"><b>{directo}</b><span>de <strong>cada pago</strong> de cada negocio que traes, todos los meses.</span></li>
            {tope && <li className="mp-numero"><b>{usd(comisionDelPago(tope.precioUsd, 'directo'))}</b><span><strong>al mes</strong> por cada negocio que elige <strong>{tope.nombre}</strong>.</span></li>}
            <li className="mp-numero"><b>Ilimitado</b><span>Traes 10 negocios, cobras 10 veces cada mes. Traes 100, <strong>cobras 100</strong>.</span></li>
          </ul>
        </div>
      </section>

      <section className="mp-seccion">
        <div className="mp-wrap">
          <h2>Preguntas frecuentes</h2>
          <p className="mp-sub">Todo lo que necesitas saber para empezar hoy.</p>
          <div className="mp-faq">
            <details open>
              <summary>¿Cuánto gano?</summary>
              <p>
                El <b>{directo} de cada pago</b> de cada negocio que entra con tu link, todos los meses, mientras el negocio siga en MaKo: {precios('directo')}.
                Es dinero, no crédito ni descuentos.
              </p>
            </details>
            <details>
              <summary>¿Siempre es el {directo}?</summary>
              <p>
                Depende de por dónde entra la plata. Si el negocio paga por <b>Binance o transferencia bancaria</b>, o si le cobras tú y
                nos mandas el {porcentaje(1 - COMISION_PARTNER_DIRECTO)} por Binance o transferencia, te llevas el <b>{directo}</b>. Si paga
                por una <b>pasarela o un link de pago</b> (Mercado Pago, tarjeta, Whop), el <b>{pasarela}</b>: {precios('pasarela')}.
              </p>
            </details>
            <details>
              <summary>¿Cuándo cobro?</summary>
              <p>Cada vez que el negocio paga, tu parte de ese pago pasa a <b>«A cobrar»</b> en tu panel. {PAGO_HOY}</p>
            </details>
            <details>
              <summary>¿Hay un límite?</summary>
              <p>Ninguno. Traes 10 negocios, cobras 10 veces cada mes. Traes 100, cobras 100.</p>
            </details>
            <details>
              <summary>¿Quién cuenta como mi referido?</summary>
              <p>Cualquier negocio que todavía no usa MaKo y entra con tu link, o pone tu código al pagar. Tu propio negocio no cuenta.</p>
            </details>
            <details>
              <summary>¿Y si no entra con mi link?</summary>
              <p>Que ponga <b>tu código</b> al pagar: está en tu panel, al lado de tu link.</p>
            </details>
            <details>
              <summary>¿Cuánto dura mi link?</summary>
              <p>{DIAS_COOKIE_REF} días. Si alguien lo abre hoy y se suscribe dentro de dos meses, igual es tuyo.</p>
            </details>
            <details>
              <summary>¿Puedo hacer anuncios con mi link?</summary>
              <p>Sí. Compártelo donde quieras: tus redes, tus grupos de WhatsApp, tu newsletter o tus anuncios.</p>
            </details>
            <details>
              <summary>¿Qué necesito para ser partner?</summary>
              <p>Tener tu plan de MaKo activo. Con tu cuenta te haces partner en un minuto y tu link aparece en el acto.</p>
            </details>
          </div>
        </div>
      </section>

      {boton && (
        <section className="mp-seccion">
          <div className="mp-wrap">
            <div className="mp-final">
              <h2>Tu {directo} te está esperando</h2>
              <p>Hazte partner en un minuto: tu link aparece en el acto.</p>
              <Boton boton={boton} />
              {publica && <div><Link className="mp-texto" href="/planes">¿Todavía no tienes MaKo? Ver los planes →</Link></div>}
            </div>
            {publica && <p className="mp-pie"><Link href="/planes">Planes de MaKo</Link> · <Link href="/terminos">Términos</Link></p>}
          </div>
        </section>
      )}
    </Raiz>
  );
}
