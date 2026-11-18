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
// la está haciendo Cobros. Se paga del 1 al 5 del mes siguiente, en dólares por Binance o en pesos por transferencia.
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
// MaKo. Los números salen de los planes y de las reglas, nunca escritos a mano.
//
// LOS DOS MODOS: `publica` (colores fijos de la página de venta, la barra de la app escondida) y `app` (los tokens de la
// app: cambia con el tema oscuro y el Nord; la barra queda). La acción es UNA y es un link: hacerse partner (el onboarding
// corto de /partners) o, para quien ya lo es, volver a su panel.
// =============================================================================

import type { ReactNode } from 'react';
import Link from 'next/link';
import { COMISION_PARTNER_DIRECTO, COMISION_PARTNER_PASARELA, RUTA_ALTA_PARTNERS, comisionDelPago, type CanalDelPago } from '@/lib/partners-reglas';
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
/* Los dos botones que alternan (18/11/2026): uno al lado del otro, cada uno con la opción de ahora en UNA línea y un mini interruptor
   (pista y bolita) que se desliza al otro lado al tocar, y late cada ~2 s hasta que tocan ese botón. Borde, fondo y sombra de botón;
   se levanta al pasar el mouse y se hunde al tocarlo. */
.mp-calc-alts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mp-calc-alt { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 56px; padding: 8px 10px 8px 12px;
  border-radius: 14px; cursor: pointer; font: inherit; text-align: left; color: var(--mp-sobre-azul); background: rgba(255,255,255,.14);
  border: 1px solid rgba(255,255,255,.4); box-shadow: 0 6px 16px rgba(0,0,0,.14), inset 0 1px 0 rgba(255,255,255,.2);
  transition: transform .12s ease, background .15s ease, box-shadow .15s ease; -webkit-tap-highlight-color: transparent; container-type: inline-size; }
.mp-calc-alt:hover { background: rgba(255,255,255,.22); transform: translateY(-1px); box-shadow: 0 10px 22px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.25); }
.mp-calc-alt:active { transform: translateY(1px) scale(.98); box-shadow: 0 2px 6px rgba(0,0,0,.18); }
.mp-calc-alt:focus-visible { outline: 2px solid var(--mp-sobre-azul); outline-offset: 3px; }
.mp-calc-alt-tx { display: flex; min-width: 0; }
.mp-calc-alt-tx.entra { animation: mp-cambia .22s ease; }
/* Una línea, grande y en semibold (Martín: «deben ser más grandes porque no se ven»): 17–18 px en la computadora, siguiendo el ancho
   del botón para que «Pasarela de pago» entre al lado del mini interruptor. */
.mp-calc-alt-largo, .mp-calc-alt-corto { font-size: clamp(15px, calc((100cqi - 36px) / 8.2), 18px); font-weight: 600; line-height: 1.2; white-space: nowrap; }
.mp-calc-alt-corto { display: none; }
/* El mini interruptor: una pista de 28 × 16 con su bolita; a la derecha cuando está la segunda opción. */
.mp-calc-mini { position: relative; flex: none; width: 28px; height: 16px; border-radius: 999px; background: rgba(255,255,255,.3); box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); }
.mp-calc-mini-bola { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--mp-sobre-azul);
  box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .2s ease; }
.mp-calc-alt.der .mp-calc-mini-bola { transform: translateX(12px); }
@keyframes mp-cambia { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
@keyframes mp-late { 0%, 60%, 100% { transform: scale(1); box-shadow: inset 0 0 0 1px rgba(255,255,255,.45), 0 0 0 0 rgba(255,255,255,.5); }
  25% { transform: scale(1.15); box-shadow: inset 0 0 0 1px rgba(255,255,255,.6), 0 0 0 6px rgba(255,255,255,0); } }
.mp-calc-alt:not(.tocado) .mp-calc-mini { animation: mp-late 2s ease-in-out .6s infinite; }
@media (prefers-reduced-motion: reduce) { .mp-calc-alt, .mp-calc-alt-tx.entra, .mp-calc-mini, .mp-calc-mini-bola { transition: none; animation: none !important; } }
/* En el teléfono, 15–16 px. «Transferencia» a 15 px no entra al lado del mini interruptor en medio recuadro de 375: el mini
   interruptor va arriba a la derecha y el texto abajo, a todo el ancho del botón. */
@media (max-width: 479px) {
  .mp-calc-alts { gap: 8px; }
  .mp-calc-alt { display: grid; grid-template-columns: 1fr; gap: 6px; padding: 8px 10px; }
  .mp-calc-mini { order: -1; justify-self: end; }
  .mp-calc-alt-largo { display: none; }
  .mp-calc-alt-corto { display: inline; font-size: clamp(15px, calc(100cqi / 8), 16px); }
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
.mp-numero .mp-numero-t { margin-bottom: 4px; font-size: 19px; line-height: 1.25; font-weight: 800; color: var(--mp-ink); }
/* «Cuánto te llevas según cómo pagan»: dos tarjetas; la de transferencia, destacada sin gritar. */
.mp-cobros { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; max-width: 860px; margin: 0 auto; }
.mp-cobro { display: flex; flex-direction: column; gap: 6px; padding: 26px 24px 24px; border-radius: 22px; background: var(--mp-sup); border: 1px solid var(--mp-borde); }
.mp-cobro-mejor { border: 2px solid var(--mp-azul); box-shadow: 0 18px 40px color-mix(in srgb, var(--mp-azul) 14%, transparent); }
.mp-cobro-etq { align-self: flex-start; padding: 4px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  color: var(--mp-azul); background: var(--mp-azul-bg); }
.mp-cobro-pct { font-size: 56px; line-height: 1; font-weight: 800; letter-spacing: -.04em; color: var(--mp-azul); }
.mp-cobro h3 { margin: 4px 0 0; font-size: 20px; font-weight: 700; color: var(--mp-ink); }
.mp-cobro h3 span { font-size: 16px; font-weight: 500; color: var(--mp-suave); }
.mp-cobro p { margin: 0; color: var(--mp-dim); }
.mp-cobro-montos { list-style: none; margin: 4px 0 6px; padding: 0; display: grid; gap: 2px; color: var(--mp-ink); font-variant-numeric: tabular-nums; }
.mp-cobro-montos b { font-weight: 800; }
/* Aire entre el título de una sección y sus tarjetas (sin bajada en medio). */
.mp-seccion h2 + .mp-numeros, .mp-seccion h2 + .mp-cobros { margin-top: 28px; }
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
  .mp-hero-grilla, .mp-numeros, .mp-cobros { grid-template-columns: 1fr; }
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

/** El ejemplo del subtítulo, con el plan más caro (18/11/2026, decidido: «Trae 10 y son US$ 291 extra por mes»). */
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
  /** «MaKo Pro: US$ 29,10 por mes», un renglón por plan, según por dónde entra la plata. */
  const montos = (canal: CanalDelPago) => (
    <ul className="mp-cobro-montos">
      {planes.map((p) => <li key={p.id}>{p.nombre}: <b>{usd(comisionDelPago(p.precioUsd, canal))}</b> por mes</li>)}
    </ul>
  );
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
                Cada negocio que traes te deja <b>el {directo}</b> de lo que paga, todos los meses.
                {tope && <> Trae {NEGOCIOS_DEL_EJEMPLO} y son <b className="mp-junto">{usd(gananciaPorMes(NEGOCIOS_DEL_EJEMPLO, tope.precioUsd, 'directo'))} extra por mes</b>.</>}
              </p>
              <div className="mp-acciones"><Boton boton={boton} marca={!publica && boton?.href === RUTA_ALTA_PARTNERS ? MARCA.partnersHacerme : undefined} /></div>
            </div>
            <Calculadora planes={planes.map((p) => ({ id: p.id, nombre: p.nombre, precioUsd: p.precioUsd }))}><Boton boton={boton} /></Calculadora>
          </div>
        </div>
      </div>

      {/* PASADA DE COPY (18/11/2026, Martín: «no pongas "no es un pago único"… se entiende. Mejora bien los copies… que sea
          marketinero, para que se entienda, no sea redundante»; aprobada por el Cerebro). Cada idea, UNA vez en la página: el héroe
          dice cuánto ganas; los números, por qué conviene; «Así de simple», los 3 pasos; «según cómo pagan», el 30% y el 25% con sus
          montos (Martín: «en otra sección deberíamos aclarar lo de la transferencia o pasarela de pago»); las preguntas, sólo dudas
          que no estén arriba; el cierre, una frase y el botón. Los números, de las constantes. */}
      {/* Martín, 18/11/2026: «Elimina "por qué conviene"… y simplemente pon "así de simple", pero con el diseño de las tarjetas de
          "por qué te conviene"… "tú eliges cómo cobrar…" debería estar arriba, en "así de simple", en el paso 3». Los pasos son una
          secuencia: el número grande arriba de cada tarjeta. */}
      <section className="mp-seccion">
        <div className="mp-wrap">
          <h2>Así de simple</h2>
          <ol className="mp-numeros">
            <li className="mp-numero"><b>1</b><span className="mp-numero-t">Compartes tu link</span>
              <span>En tus redes, tus grupos de WhatsApp o tus anuncios. Si no entran por el link, ponen tu código al pagar.</span></li>
            <li className="mp-numero"><b>2</b><span className="mp-numero-t">El negocio se suma a MaKo</span>
              <span>Paga su plan con tu link o tu código, y desde su primer pago cada mes te deja tu parte.</span></li>
            <li className="mp-numero"><b>3</b><span className="mp-numero-t">Cobras del 1 al 5 de cada mes</span>
              <span>Tú eliges cómo: dólares por Binance o pesos por transferencia.</span></li>
          </ol>
        </div>
      </section>

      <section className="mp-seccion">
        <div className="mp-wrap">
          <h2>Cuánto te llevas según cómo pagan</h2>
          <div className="mp-cobros">
            <div className="mp-cobro mp-cobro-mejor">
              <span className="mp-cobro-etq">La que más te deja</span>
              <b className="mp-cobro-pct">{directo}</b>
              <h3>Transferencia o Binance</h3>
              {montos('directo')}
              <p>Cuando el negocio paga por transferencia o Binance.</p>
            </div>
            <div className="mp-cobro">
              <b className="mp-cobro-pct">{pasarela}</b>
              <h3>Pasarela de pago <span>(tarjeta, Mercado Pago)</span></h3>
              {montos('pasarela')}
              <p>La pasarela cobra su comisión y la compartimos.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mp-seccion">
        <div className="mp-wrap">
          <h2>Preguntas frecuentes</h2>
          <p className="mp-sub">Todo lo que necesitas saber para empezar hoy.</p>
          <div className="mp-faq">
            <details open>
              <summary>¿Cuándo cobro?</summary>
              <p>Del 1 al 5 de cada mes, por todo lo que ganaste el mes anterior.</p>
            </details>
            <details>
              <summary>¿Por qué a veces es el {pasarela}?</summary>
              <p>Porque la pasarela cobra su comisión. Lo ves arriba, en «Cuánto te llevas según cómo pagan».</p>
            </details>
            <details>
              <summary>¿Quién cuenta como mi referido?</summary>
              <p>Cualquier negocio que todavía no usa MaKo y entra con tu link o pone tu código al pagar. Tu propio negocio no cuenta.</p>
            </details>
            <details>
              <summary>¿Dónde veo lo que gané?</summary>
              <p>En tu panel de MaKo Partners: cada negocio que trajiste, lo que te deja y lo que tienes a cobrar.</p>
            </details>
            <details>
              <summary>¿Qué necesito para ser partner?</summary>
              <p>
                Tener tu plan {tope?.nombre} activo{tope && <> ({usd(tope.precioUsd)} al mes)</>}. Si tu plan se corta, lo que ganaste no se pierde:
                te lo pagamos cuando lo reactivas.
              </p>
            </details>
          </div>
        </div>
      </section>

      {boton && (
        <section className="mp-seccion">
          <div className="mp-wrap">
            <div className="mp-final">
              <h2>Empieza a ganar con tu link</h2>
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
