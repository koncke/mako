// =============================================================================
// LandingPartners — la página de MaKo Partners, la que VENDE el programa (24/10/2026, rehecha la misma noche)
// =============================================================================
// La dibujan la página pública (app/mako-partners/page.tsx) y, adentro de la app, la tab de MaKo Partners mientras el
// negocio NO se unió (app/partners/referidos/page.tsx, app/m/partners/page.tsx). Martín, 24/10: «La pagina de MaKo Partners
// DEBE ser siempre la landing al menos que el usuario ya se haya registrado como partner, solo cuando se registre ahi
// aparece el dashboard... hazla mas marketinera... No me da claridad en lo que ganan, esta todo muy amontonado, no se sabe
// si se ganan meses o dinero... Falta algo como "Calculadora"».
//
// COPIADA DE (abiertas y miradas el 24/10): LLM Pulse (llmpulse.ai/affiliate) para el orden y la calculadora; systeme.io
// (systeme.io/affiliate-program) para la ficha que contesta en una mirada QUÉ se gana, cuánto y cuándo; DigitalOcean
// (digitalocean.com/referral-program) para decirlo sin vueltas: «earn free credits»; Kit
// (kit.com/affiliate) para la cuenta con un ejemplo. Lo que NO se tomó: los testimonios — hoy no hay partners con
// crédito, y uno inventado no se publica.
//
// MESES Y DINERO, SEGÚN QUÉ SE REFIERE (25/10/2026, el Cerebro, con lo que Martín decidió el 10/10 en docs/referidos.md):
// el negocio que se SUSCRIBE suma su primer mes como crédito para el plan del partner; el que entra al ACELERADOR deja
// US$300 en efectivo (el 20% de cada cuota). Una línea para cada uno, nunca «no es dinero» a secas.
// ⚠️ Y SÓLO LO QUE PASA HOY (24/10, el Cerebro: «la página de Partners no promete nada que no vayamos a cumplir»): el
// crédito es un renglón del libro (lib/partners-programa.ts, `acreditarReferidos`) que nada descuenta solo todavía
// (`CREDITO_HOY`), y la comisión no la registra el libro: la anota y la transfiere el equipo (`COMISION_HOY`). Por eso no
// dice «meses gratis» ni «se descuenta». Sin cobro en línea, un referido no se registra solo: lo dice como el panel. Los
// números salen de los planes, del programa y de las reglas, no a mano.
//
// LOS DOS MODOS: `publica` (colores fijos de la página de venta, la barra de la app escondida) y `app` (los tokens de la
// app: cambia con el tema oscuro y el Nord; la barra queda). La acción es UNA: en la pública lleva a la tab, adentro es el
// botón «Unirme» (la acción del servidor que le crea el link, `unirme`).
// =============================================================================

import type { ReactNode } from 'react';
import Link from 'next/link';
import { COMISION_GRUPAL, COMISION_HOY, CREDITO_HOY, DIAS_COOKIE_REF, PAGOS_PARA_ACREDITAR, comisionDelAcelerador } from '@/lib/partners-reglas';
import { PLANES_MAKO_DEFAULT, PROGRAMA_ACELERADOR } from '@/lib/planes-mako';
import { Calculadora } from './Calculadora';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const usd = (n: number) => `US$ ${n.toLocaleString('es-AR')}`;
const ORDINAL: Record<number, string> = { 1: 'primer', 2: 'segundo', 3: 'tercer' };

const CSS = `
.mp-root { --mp-ink: #12151B; --mp-dim: #4A5260; --mp-suave: #5B6472; --mp-borde: #E6EAF2; --mp-sup: #FFFFFF; --mp-gris: #F6F8FB;
  --mp-azul: #2F6FED; --mp-azul-osc: #1F4FC2; --mp-azul-bg: #EEF3FE; --mp-sobre-azul: #FFFFFF; --mp-bien: #1F9D55; --mp-aviso-bg: #FFF8E6;
  --mp-aviso-borde: #F1DDA4; --mp-aviso-ink: #5C4A12;
  color: var(--mp-ink); font: 400 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.mp-root.mp-app { --mp-ink: var(--ink); --mp-dim: var(--dim); --mp-suave: var(--dim); --mp-borde: var(--border); --mp-sup: var(--surface);
  --mp-gris: var(--surface-2); --mp-azul: var(--primary); --mp-azul-osc: color-mix(in srgb, var(--primary) 80%, #000); --mp-azul-bg: var(--primary-bg);
  --mp-sobre-azul: var(--on-primary, #fff); --mp-bien: var(--good); --mp-aviso-bg: color-mix(in srgb, #F1B000 12%, var(--surface));
  --mp-aviso-borde: color-mix(in srgb, #F1B000 40%, var(--border)); --mp-aviso-ink: var(--ink); font: inherit; }
body:has(.mp-publica) aside { display: none !important; }
body:has(.mp-publica) { background: #FFFFFF; }
.mp-wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; box-sizing: border-box; }
.mp-app .mp-wrap { padding: 0; }
.mp-barra { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; }
.mp-marca { font-weight: 800; font-size: 17px; color: var(--mp-azul); text-decoration: none; }
.mp-barra a.mp-entrar { color: var(--mp-ink); font-weight: 600; font-size: 14px; text-decoration: none; }
.mp-hero { background: radial-gradient(1100px 480px at 90% -10%, color-mix(in srgb, var(--mp-azul) 16%, transparent), transparent 60%),
  linear-gradient(180deg, var(--mp-azul-bg) 0%, var(--mp-sup) 100%); padding: 8px 0 64px; }
.mp-app .mp-hero { border: 1px solid var(--mp-borde); border-radius: 22px; padding: 8px 32px 36px; margin: 4px 0 8px; }
.mp-hero-grilla { display: grid; grid-template-columns: 1.2fr 1fr; gap: 44px; align-items: center; padding-top: 36px; }
.mp-ceja { display: inline-block; font-size: 12.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--mp-azul);
  background: color-mix(in srgb, var(--mp-azul) 11%, transparent); padding: 6px 12px; border-radius: 999px; }
.mp-hero h1 { margin: 16px 0 14px; font-size: 46px; line-height: 1.07; letter-spacing: -.03em; font-weight: 800; color: var(--mp-ink); }
.mp-app .mp-hero h1 { font-size: 38px; }
.mp-hero h1 em { font-style: normal; color: var(--mp-azul); }
.mp-bajada { margin: 0 0 26px; font-size: 18px; color: var(--mp-dim); max-width: 540px; }
.mp-acciones { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; }
.mp-acciones form, .mp-calc-resultado form, .mp-final form { margin: 0; }
.mp-btn { display: inline-block; border: 0; cursor: pointer; font: inherit; background: var(--mp-azul); color: var(--mp-sobre-azul) !important;
  text-decoration: none; font-weight: 700; font-size: 16px; padding: 15px 26px; border-radius: 12px;
  box-shadow: 0 8px 22px color-mix(in srgb, var(--mp-azul) 30%, transparent); transition: transform .15s ease, box-shadow .15s ease; }
.mp-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 26px color-mix(in srgb, var(--mp-azul) 34%, transparent); }
.mp-btn-texto { color: var(--mp-azul); font-weight: 600; text-decoration: none; font-size: 15px; }
.mp-chips { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 22px 0 0; padding: 0; list-style: none; color: var(--mp-suave); font-size: 14px; }
.mp-chips li::before { content: "✓"; color: var(--mp-bien); font-weight: 800; margin-right: 7px; }
.mp-error { margin: 0 0 16px; color: #B42318; font-weight: 600; }
.mp-ficha { background: var(--mp-sup); border: 1px solid var(--mp-borde); border-radius: 22px; padding: 26px 26px 20px;
  box-shadow: 0 24px 60px rgba(18,21,27,.10); }
.mp-ficha-etq { font-size: 12.5px; font-weight: 700; color: var(--mp-suave); text-transform: uppercase; letter-spacing: .07em; }
.mp-ficha-grande { font-size: 32px; line-height: 1.1; font-weight: 800; letter-spacing: -.02em; margin: 8px 0 6px; color: var(--mp-ink); }
.mp-ficha-sub { margin: 0; color: var(--mp-dim); font-size: 15px; }
.mp-ficha dl { margin: 18px 0 0; padding: 0; }
.mp-ficha-fila { display: flex; justify-content: space-between; gap: 14px; padding: 11px 0; border-top: 1px solid var(--mp-borde); font-size: 15px; }
.mp-ficha-fila dt { color: var(--mp-dim); flex: 1; min-width: 0; }
.mp-ficha-fila dd { margin: 0; font-weight: 700; color: var(--mp-ink); text-align: right; white-space: nowrap; }
/* El segundo renglón de lo que ganas: el Acelerador, en efectivo. Separado del crédito para que no se lean como uno. */
.mp-ficha-efectivo { margin: 16px -26px -20px; padding: 18px 26px 20px; border-top: 1px solid var(--mp-borde); background: var(--mp-gris);
  border-radius: 0 0 22px 22px; }
.mp-ficha-efectivo .mp-ficha-grande { font-size: 26px; margin-top: 4px; }
.mp-seccion { padding: 72px 0; }
.mp-app .mp-seccion { padding: 48px 0 8px; }
.mp-seccion.gris { background: var(--mp-gris); }
.mp-app .mp-seccion.gris { background: transparent; }
.mp-seccion h2 { margin: 10px 0 10px; font-size: 34px; line-height: 1.15; letter-spacing: -.02em; text-align: center; font-weight: 800; color: var(--mp-ink); }
.mp-app .mp-seccion h2 { font-size: 28px; }
.mp-centro { text-align: center; }
.mp-sub { margin: 0 auto 34px; max-width: 600px; text-align: center; color: var(--mp-suave); font-size: 17px; }
.mp-calc { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 900px; margin: 0 auto; }
.mp-calc-entrada { background: var(--mp-sup); border: 1px solid var(--mp-borde); border-radius: 20px; padding: 26px 26px 24px; }
.mp-calc-fila { display: flex; justify-content: space-between; align-items: baseline; }
.mp-calc-fila label { font-weight: 600; font-size: 15px; color: var(--mp-ink); }
.mp-calc-n { font-size: 30px; font-weight: 800; letter-spacing: -.02em; color: var(--mp-ink); }
.mp-calc-barra { --mp-lleno: 8%; width: 100%; margin: 14px 0 4px; height: 8px; border-radius: 999px; appearance: none; -webkit-appearance: none; cursor: pointer;
  background: linear-gradient(90deg, var(--mp-azul) var(--mp-lleno), var(--mp-borde) var(--mp-lleno)); }
.mp-calc-barra::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: var(--mp-sup);
  border: 3px solid var(--mp-azul); box-shadow: 0 2px 8px rgba(18,21,27,.2); }
.mp-calc-barra::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--mp-sup); border: 3px solid var(--mp-azul); }
.mp-calc-barra:focus-visible { outline: 2px solid var(--mp-azul); outline-offset: 6px; }
.mp-calc-escala { display: flex; justify-content: space-between; color: var(--mp-suave); font-size: 13px; }
.mp-calc-etq { margin: 22px 0 10px; font-weight: 600; font-size: 15px; color: var(--mp-ink); }
.mp-calc-planes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
/* El Acelerador, a todo el ancho: es el que deja efectivo, no un plan más. */
.mp-calc-plan.efectivo { grid-column: 1 / -1; }
.mp-calc-plan { text-align: left; font: inherit; cursor: pointer; background: var(--mp-sup); color: var(--mp-ink); border: 1px solid var(--mp-borde);
  border-radius: 14px; padding: 12px 14px; transition: border-color .15s ease, box-shadow .15s ease; }
.mp-calc-plan b { display: block; font-size: 15px; }
.mp-calc-plan span { font-size: 13.5px; color: var(--mp-suave); }
.mp-calc-plan.activo { border-color: var(--mp-azul); box-shadow: 0 0 0 1px var(--mp-azul); background: var(--mp-azul-bg); }
.mp-calc-resultado { display: flex; flex-direction: column; justify-content: center; border-radius: 20px; padding: 28px 28px 26px; color: var(--mp-sobre-azul);
  background: linear-gradient(135deg, var(--mp-azul) 0%, var(--mp-azul-osc) 100%); box-shadow: 0 18px 44px color-mix(in srgb, var(--mp-azul) 28%, transparent); }
.mp-calc-res-etq { font-size: 14px; font-weight: 600; opacity: .85; }
.mp-calc-res-monto { font-size: 64px; line-height: 1; font-weight: 800; letter-spacing: -.04em; margin: 10px 0 10px; }
.mp-calc-res-cuenta { font-size: 15px; opacity: .9; margin: 0 0 22px; }
.mp-calc-resultado .mp-btn { background: var(--mp-sobre-azul); color: var(--mp-azul-osc) !important; box-shadow: none; align-self: flex-start; }
.mp-calc-nota { grid-column: 1 / -1; text-align: center; color: var(--mp-suave); font-size: 14px; margin: 6px auto 0; max-width: 640px; }
.mp-pasos { list-style: none; padding: 0; margin: 0; display: grid; gap: 18px; grid-template-columns: repeat(3, 1fr); }
.mp-paso { background: var(--mp-sup); border: 1px solid var(--mp-borde); border-radius: 18px; padding: 24px 22px; }
.mp-paso-n { display: inline-flex; width: 36px; height: 36px; border-radius: 50%; align-items: center; justify-content: center; background: var(--mp-azul);
  color: var(--mp-sobre-azul); font-weight: 800; margin-bottom: 14px; }
.mp-paso h3 { margin: 0 0 6px; font-size: 19px; color: var(--mp-ink); }
.mp-paso p { margin: 0; color: var(--mp-suave); font-size: 15px; }
.mp-aviso { margin: 22px auto 0; max-width: 720px; background: var(--mp-aviso-bg); border: 1px solid var(--mp-aviso-borde); color: var(--mp-aviso-ink);
  border-radius: 14px; padding: 14px 18px; font-size: 15px; }
.mp-faq { max-width: 760px; margin: 0 auto; display: grid; gap: 10px; }
.mp-faq details { background: var(--mp-sup); border: 1px solid var(--mp-borde); border-radius: 14px; padding: 0 20px; }
.mp-faq summary { cursor: pointer; list-style: none; padding: 17px 0; font-weight: 700; font-size: 16px; color: var(--mp-ink); display: flex;
  justify-content: space-between; gap: 16px; }
.mp-faq summary::-webkit-details-marker { display: none; }
.mp-faq summary::after { content: "+"; color: var(--mp-azul); font-weight: 800; font-size: 20px; line-height: 1; }
.mp-faq details[open] summary::after { content: "−"; }
.mp-faq details p { margin: 0 0 18px; color: var(--mp-dim); font-size: 15.5px; }
.mp-final { background: linear-gradient(135deg, var(--mp-azul) 0%, var(--mp-azul-osc) 100%); color: var(--mp-sobre-azul); border-radius: 24px;
  padding: 48px 32px; text-align: center; }
.mp-final h2 { color: var(--mp-sobre-azul); margin: 0 0 10px; }
.mp-final p { margin: 0 0 24px; opacity: .88; font-size: 17px; }
.mp-final .mp-btn { background: var(--mp-sobre-azul); color: var(--mp-azul-osc) !important; box-shadow: none; }
.mp-final .mp-btn-texto { display: inline-block; margin-top: 18px; color: var(--mp-sobre-azul); opacity: .9; }
.mp-pie { text-align: center; color: #8A93A2; font-size: 13.5px; padding: 28px 0 40px; }
.mp-pie a { color: #5B6472; }
@media (max-width: 860px) {
  .mp-hero-grilla, .mp-calc, .mp-pasos { grid-template-columns: 1fr; }
  .mp-hero h1, .mp-app .mp-hero h1 { font-size: 32px; }
  .mp-app .mp-hero { padding: 4px 16px 20px; border-radius: 18px; }
  .mp-ficha { padding: 20px 18px 14px; border-radius: 18px; }
  .mp-ficha-grande { font-size: 26px; }
  .mp-ficha-fila { font-size: 14px; }
  .mp-ficha-efectivo { margin: 14px -18px -14px; padding: 16px 18px 16px; border-radius: 0 0 18px 18px; }
  .mp-ficha-efectivo .mp-ficha-grande { font-size: 22px; }
  .mp-hero-grilla { gap: 28px; padding-top: 24px; }
  .mp-calc-res-monto { font-size: 52px; }
  .mp-seccion { padding: 52px 0; }
  .mp-seccion h2, .mp-app .mp-seccion h2 { font-size: 26px; }
}
`;

/** La acción: en la pública, un link a la tab; adentro de la app, el botón que une al negocio (una acción del servidor). */
function Accion({ unirme, volver, texto }: { unirme?: (datos: FormData) => Promise<void>; volver?: string; texto: string }) {
  if (!unirme) return <Link className="mp-btn" href="/partners/referidos">{texto}</Link>;
  return (
    <form action={unirme}>
      {volver && <input type="hidden" name="volver" value={volver} />}
      <button className="mp-btn" type="submit">{texto}</button>
    </form>
  );
}

export function LandingPartners({ cobraEnLinea, emailMako, modo = 'publica', unirme, volver, error = false, rotulo }: {
  cobraEnLinea: boolean;
  emailMako: string;
  /** `publica`: la página de venta; `app`: adentro de la tab, con los colores de la app. */
  modo?: 'publica' | 'app';
  /** Adentro de la app: la acción del servidor que une al negocio. Sin ella (el super admin), no hay botón. */
  unirme?: (datos: FormData) => Promise<void>;
  /** A dónde vuelve después de unirse (lo valida la acción). */
  volver?: string;
  /** La última vez no se pudo unir. */
  error?: boolean;
  /** Una línea arriba de todo (el super admin: «así lo ven tus clientes»). */
  rotulo?: ReactNode;
}) {
  const planes = PLANES_MAKO_DEFAULT.filter((p) => p.activo).slice().sort((a, b) => b.precioUsd - a.precioUsd);
  const tope = planes[0];
  const pro = planes.find((p) => p.id === 'pro') ?? tope;
  const mes = ORDINAL[PAGOS_PARA_ACREDITAR] ?? `${PAGOS_PARA_ACREDITAR}º`;
  const acelerador = PROGRAMA_ACELERADOR;
  const comision = comisionDelAcelerador(acelerador.precioUsd);
  const pct = `${Math.round(COMISION_GRUPAL * 100)}%`;
  const publica = modo === 'publica';
  // Sin acción (el super admin mirando cómo lo ven): ni el botón de unirse ni el bloque final, que sólo existe para él.
  const conAccion = publica || !!unirme;
  const textoUnirme = publica ? 'Unirme gratis' : 'Unirme a MaKo Partners';
  // Adentro de la app ya hay un <main> (el del shell): la landing es un bloque más.
  const Raiz = publica ? 'main' : 'div';
  return (
    <Raiz className={`mp-root ${publica ? 'mp-publica' : 'mp-app'}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {rotulo}
      <div className="mp-hero">
        <div className="mp-wrap">
          {publica && (
            <nav className="mp-barra">
              <Link className="mp-marca" href="/">MaKo Partners</Link>
              <Link className="mp-entrar" href="/partners/referidos">Entrar</Link>
            </nav>
          )}
          <div className="mp-hero-grilla">
            <div>
              <span className="mp-ceja">Programa de referidos</span>
              <h1>Gana <em>meses de tu plan</em> y <em>dinero en efectivo</em> por cada negocio que traigas a MaKo</h1>
              <p className="mp-bajada">
                Compartes tu link. Si el negocio se suscribe, su primer mes queda como crédito para tu plan. Si entra al
                {' '}{acelerador.nombre}, te llevas {usd(comision)} en efectivo. Sin tope.
              </p>
              {error && <p className="mp-error" role="alert">No pudimos unirte. Prueba otra vez en un minuto. <ReportarASoporte /></p>}
              <div className="mp-acciones">
                {conAccion && <Accion unirme={unirme} volver={volver} texto={textoUnirme} />}
                <a className="mp-btn-texto" href="#calculadora">Calcular cuánto sumaría ↓</a>
              </div>
              <ul className="mp-chips">
                <li>Es gratis</li>
                <li>Sin tope de referidos</li>
                <li>Tu link dura {DIAS_COOKIE_REF} días</li>
              </ul>
            </div>
            <div className="mp-ficha" aria-label="Lo que ganas">
              <div className="mp-ficha-etq">Si se suscribe</div>
              <div className="mp-ficha-grande">Meses de tu plan</div>
              <p className="mp-ficha-sub">Su primer mes, como crédito para pagar tu MaKo.</p>
              <dl>
                {planes.map((p) => (
                  <div key={p.id} className="mp-ficha-fila"><dt>Por un negocio en {p.nombre}</dt><dd>{usd(p.precioUsd)}</dd></div>
                ))}
                <div className="mp-ficha-fila"><dt>Se suma</dt><dd>al pagar su {mes} mes</dd></div>
                <div className="mp-ficha-fila"><dt>Tope</dt><dd>Sin tope</dd></div>
              </dl>
              <div className="mp-ficha-efectivo">
                <div className="mp-ficha-etq">Si entra al {acelerador.nombre}</div>
                <div className="mp-ficha-grande">{usd(comision)} en efectivo</div>
                <p className="mp-ficha-sub">El {pct} de cada cuota que paga, por transferencia.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mp-seccion" id="calculadora" style={{ scrollMarginTop: 24 }}>
        <div className="mp-wrap">
          <div className="mp-centro"><span className="mp-ceja">Calculadora</span></div>
          <h2>¿Cuánto sumarías?</h2>
          <p className="mp-sub">Mueve la barra y elige qué toman los negocios que traes.</p>
          <Calculadora
            planes={[
              ...planes.map((p) => ({ id: p.id, nombre: p.nombre, precioUsd: p.precioUsd, rotulo: `${usd(p.precioUsd)} por mes` })),
              { id: acelerador.id, nombre: acelerador.nombre, precioUsd: acelerador.precioUsd, rotulo: `${usd(acelerador.precioUsd)} en ${acelerador.cuotas} cuotas`, efectivo: true },
            ]}
            nota={`A precio de lista. Cada negocio suma cuando paga su ${mes} mes. ${CREDITO_HOY}`}
            notaEfectivo={`El ${pct} de cada cuota que se cobra. ${COMISION_HOY}`}>
            {conAccion && <Accion unirme={unirme} volver={volver} texto={textoUnirme} />}
          </Calculadora>
        </div>
      </section>

      <section className="mp-seccion gris">
        <div className="mp-wrap">
          <h2>Cómo funciona</h2>
          <p className="mp-sub">Tres pasos, y el primero es un clic.</p>
          <ol className="mp-pasos">
            <li className="mp-paso"><span className="mp-paso-n">1</span><h3>Únete gratis</h3><p>Con tu cuenta de MaKo. Al unirte aparecen tu link y tu panel.</p></li>
            <li className="mp-paso"><span className="mp-paso-n">2</span><h3>Comparte tu link</h3><p>Con tus clientes, tu comunidad o quien quieras recomendarle MaKo.</p></li>
            <li className="mp-paso"><span className="mp-paso-n">3</span><h3>Gana por cada uno</h3><p>Si se suscribe, al pagar su {mes} mes su primer mes queda como crédito para tu plan. Si entra al {acelerador.nombre}, te llevas el {pct} de cada cuota.</p></li>
          </ol>
          {!cobraEnLinea && (
            <p className="mp-aviso">
              Por ahora MaKo da de alta a mano, así que un referido no aparece solo en tu panel: si alguien entró con tu link,
              escríbenos a {emailMako} y lo sumamos.
            </p>
          )}
        </div>
      </section>

      <section className="mp-seccion">
        <div className="mp-wrap">
          <h2>Preguntas frecuentes</h2>
          <p className="mp-sub">Lo que cuenta y lo que no, sin letra chica.</p>
          <div className="mp-faq">
            <details open>
              <summary>¿Gano dinero o meses?</summary>
              <p>
                Las dos cosas, según lo que tome el negocio. Si se suscribe, crédito para pagar tus meses de MaKo: el valor de su
                primer mes,{' '}
                {planes.map((p, i) => <span key={p.id}>{i > 0 ? (i === planes.length - 1 ? ' o ' : ', ') : ''}{usd(p.precioUsd)} si entra a {p.nombre}</span>)}.
                {' '}{CREDITO_HOY}
              </p>
              <p>
                Si entra al {acelerador.nombre}, {usd(comision)} en efectivo: el {pct} de cada cuota que paga, por transferencia.
                {' '}{COMISION_HOY}
              </p>
            </details>
            <details>
              <summary>¿Cuándo se suma el crédito?</summary>
              <p>Cuando el negocio que trajiste paga su {mes} mes. Si se va antes, no suma.</p>
            </details>
            <details>
              <summary>¿Y si el negocio pide que le devuelvan el dinero?</summary>
              <p>Si un negocio del {acelerador.nombre} usa la garantía de entrega, esa venta no deja comisión.</p>
            </details>
            <details>
              <summary>¿Quién cuenta como referido?</summary>
              <p>Un negocio nuevo en MaKo que entró con tu link. Quien ya tenía cuenta no suma, y tu propio negocio tampoco.</p>
            </details>
            <details>
              <summary>¿Cuánto dura mi link?</summary>
              <p>{DIAS_COOKIE_REF} días en el navegador de quien lo abre. Si llegó con varios links, vale el primero.</p>
            </details>
            <details>
              <summary>¿Hay un tope?</summary>
              <p>No. Cada negocio nuevo que traes suma el suyo.</p>
            </details>
            <details>
              <summary>¿Puedo hacer anuncios con mi link?</summary>
              <p>Sí, siempre que el anuncio no use la palabra «MaKo».</p>
            </details>
            <details>
              <summary>¿Y si soy agencia?</summary>
              <p>Con {pro.nombre}, además abres la cuenta de MaKo de cada uno de tus clientes desde tu panel de partner y entras a cada una.</p>
            </details>
          </div>
        </div>
      </section>

      {conAccion && (
        <section className="mp-seccion">
          <div className="mp-wrap">
            <div className="mp-final">
              <h2>Empieza a sumar hoy</h2>
              <p>Únete gratis: tu link aparece en el acto.</p>
              <Accion unirme={unirme} volver={volver} texto={textoUnirme} />
              {publica && <div><Link className="mp-btn-texto" href="/planes">¿Todavía no tienes MaKo? Ver los planes →</Link></div>}
            </div>
            {publica && <p className="mp-pie"><Link href="/planes">Planes de MaKo</Link> · <Link href="/terminos">Términos</Link></p>}
          </div>
        </section>
      )}
    </Raiz>
  );
}
