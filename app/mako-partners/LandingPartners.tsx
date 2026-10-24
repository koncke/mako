// =============================================================================
// LandingPartners — la página pública de MaKo Partners, como una landing de VENTAS (24/10/2026)
// =============================================================================
// La dibuja app/mako-partners/page.tsx (que sólo averigua si MaKo cobra en línea). Martín (24/10): «mejora completamente
// el diseño de "Partners", eso debe verse de ventas, como una landing, está horrible hoy... Mira siempre referencias de
// cómo lo hacen otras apps». Lo que se tomó de los programas de afiliados que venden (Notion, Framer, Webflow,
// ConvertKit, Beehiiv): el NÚMERO GRANDE arriba, cómo funciona en tres pasos, la CUENTA HECHA para el que mira, las
// reglas claras y UNA acción. Lo que NO se tomó: la prueba social con casos y cifras de otros partners — hoy no hay
// ninguno, y un testimonio inventado es justo lo que esta casa no hace.
//
// ⚠️ SÓLO LO QUE PASA HOY (24/10/2026, el Cerebro: «la página de Partners no promete nada que no vayamos a cumplir»):
// cada referido suma su primer mes, a precio de lista, como un renglón de crédito en el libro del partner
// (lib/partners-programa.ts, `acreditarReferidos`). NADA lo consume todavía: no se descuenta de la cuota, no se paga en
// plata, y la comisión del Acelerador no se registra en ningún lado. Por eso la página no dice «meses gratis», ni «un
// referido de Pro vale un mes de Pro», ni ofrece comisión a las agencias, y DICE que el crédito todavía no se descuenta
// solo. Sin cobro en línea, además, un referido no se registra solo: lo dice como el panel (`textoSinReferidos`). El día que
// se aplique el crédito (docs/relevo/suscripcion.md, punto 5), se cambia el texto junto con la regla. Los números salen de
// los planes y las reglas, no a mano.
// =============================================================================

import Link from 'next/link';
import { CREDITO_HOY, DIAS_COOKIE_REF, PAGOS_PARA_ACREDITAR } from '@/lib/partners-reglas';
import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako';

const usd = (n: number) => `US$ ${n.toLocaleString('es-AR')}`;
const ORDINAL: Record<number, string> = { 1: 'primer', 2: 'segundo', 3: 'tercer' };

const CSS = `
body:has(.mp-root) aside { display: none !important; }
body:has(.mp-root) { background: #FFFFFF; }
.mp-root { color: #12151B; font: 400 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.mp-wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; box-sizing: border-box; }
.mp-barra { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; }
.mp-marca { font-weight: 700; font-size: 17px; color: #2F6FED; text-decoration: none; letter-spacing: .01em; }
.mp-barra a.mp-entrar { color: #12151B; font-weight: 600; font-size: 14px; text-decoration: none; }
.mp-hero { background: radial-gradient(1200px 500px at 85% -10%, rgba(47,111,237,.16), transparent 60%), linear-gradient(180deg, #F4F7FF 0%, #FFFFFF 100%);
  padding: 8px 0 72px; }
.mp-hero-grilla { display: grid; grid-template-columns: 1.25fr 1fr; gap: 40px; align-items: center; padding-top: 40px; }
.mp-ceja { display: inline-block; font-size: 12.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #2F6FED;
  background: rgba(47,111,237,.10); padding: 6px 12px; border-radius: 999px; }
.mp-hero h1 { margin: 16px 0 14px; font-size: 48px; line-height: 1.06; letter-spacing: -.03em; font-weight: 800; }
.mp-hero h1 em { font-style: normal; color: #2F6FED; }
.mp-hero p.mp-bajada { margin: 0 0 26px; font-size: 18px; color: #4A5260; max-width: 560px; }
.mp-acciones { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.mp-btn { display: inline-block; background: #2F6FED; color: #fff !important; text-decoration: none; font-weight: 700; font-size: 16px;
  padding: 15px 24px; border-radius: 12px; box-shadow: 0 8px 22px rgba(47,111,237,.28); }
.mp-btn-texto { color: #2F6FED; font-weight: 600; text-decoration: none; font-size: 15px; }
.mp-numero { background: #fff; border: 1px solid #E3E8F2; border-radius: 22px; padding: 30px 28px; box-shadow: 0 24px 60px rgba(18,21,27,.10); }
.mp-numero-etq { font-size: 13px; font-weight: 700; color: #5B6472; text-transform: uppercase; letter-spacing: .06em; }
.mp-numero-grande { font-size: 76px; line-height: 1; font-weight: 800; letter-spacing: -.04em; margin: 10px 0 6px; color: #12151B; }
.mp-numero-sub { color: #4A5260; font-size: 15px; }
.mp-numero hr { border: 0; border-top: 1px solid #EEF1F6; margin: 20px 0; }
.mp-numero-fila { display: flex; justify-content: space-between; font-size: 15px; padding: 4px 0; }
.mp-numero-fila b { font-weight: 700; }
.mp-seccion { padding: 72px 0; }
.mp-seccion.gris { background: #F6F8FB; }
.mp-seccion h2 { margin: 0 0 10px; font-size: 34px; line-height: 1.15; letter-spacing: -.02em; text-align: center; font-weight: 800; }
.mp-seccion p.mp-sub { margin: 0 auto 36px; max-width: 620px; text-align: center; color: #5B6472; font-size: 17px; }
.mp-pasos { list-style: none; padding: 0; margin: 0; display: grid; gap: 18px; grid-template-columns: repeat(3, 1fr); }
.mp-paso { background: #fff; border: 1px solid #E8ECF3; border-radius: 18px; padding: 24px 22px; }
.mp-paso-n { display: inline-flex; width: 36px; height: 36px; border-radius: 50%; align-items: center; justify-content: center; background: #2F6FED;
  color: #fff; font-weight: 800; margin-bottom: 14px; }
.mp-paso h3 { margin: 0 0 6px; font-size: 19px; }
.mp-paso p { margin: 0; color: #5B6472; font-size: 15px; }
.mp-cuentas { display: grid; gap: 18px; grid-template-columns: repeat(3, 1fr); }
.mp-cuenta { background: #fff; border: 1px solid #E8ECF3; border-radius: 18px; padding: 26px 24px; text-align: center; }
.mp-cuenta.destacada { border-color: #2F6FED; box-shadow: 0 0 0 1px #2F6FED, 0 16px 40px rgba(47,111,237,.16); }
.mp-cuenta-si { color: #5B6472; font-size: 15px; }
.mp-cuenta-monto { font-size: 44px; font-weight: 800; letter-spacing: -.03em; margin: 6px 0 2px; }
.mp-cuenta-eq { color: #1F7A4D; font-weight: 600; font-size: 15px; }
.mp-nota { text-align: center; color: #5B6472; font-size: 14px; margin: 18px auto 0; max-width: 620px; }
.mp-aviso { margin: 22px auto 0; max-width: 720px; background: #FFF8E6; border: 1px solid #F1DDA4; color: #5C4A12; border-radius: 14px; padding: 14px 18px; font-size: 15px; }
.mp-sola { max-width: 720px; margin: 0 auto; }
.mp-tarjeta { background: #fff; border: 1px solid #E8ECF3; border-radius: 18px; padding: 28px 26px; }
.mp-tarjeta h3 { margin: 0 0 8px; font-size: 21px; }
.mp-tarjeta p { margin: 0 0 6px; color: #4A5260; }
.mp-reglas { list-style: none; padding: 0; margin: 0 auto; max-width: 720px; display: grid; gap: 10px; }
.mp-reglas li { background: #fff; border: 1px solid #E8ECF3; border-radius: 14px; padding: 14px 18px; display: flex; gap: 12px; align-items: flex-start; }
.mp-reglas li::before { content: "✓"; color: #1F9D55; font-weight: 800; }
.mp-final { background: linear-gradient(135deg, #2F6FED 0%, #1F4FC2 100%); color: #fff; border-radius: 24px; padding: 48px 32px; text-align: center; }
.mp-final h2 { color: #fff; margin: 0 0 10px; }
.mp-final p { margin: 0 0 24px; color: rgba(255,255,255,.86); font-size: 17px; }
.mp-final .mp-btn { background: #fff; color: #1F4FC2 !important; box-shadow: none; }
.mp-pie { text-align: center; color: #8A93A2; font-size: 13.5px; padding: 28px 0 40px; }
.mp-pie a { color: #5B6472; }
@media (max-width: 860px) {
  .mp-hero-grilla { grid-template-columns: 1fr; }
  .mp-pasos, .mp-cuentas { grid-template-columns: 1fr; }
  .mp-hero h1 { font-size: 36px; }
  .mp-numero-grande { font-size: 60px; }
  .mp-seccion { padding: 52px 0; }
  .mp-seccion h2 { font-size: 27px; }
}
`;

export function LandingPartners({ cobraEnLinea, emailMako }: { cobraEnLinea: boolean; emailMako: string }) {
  const planes = PLANES_MAKO_DEFAULT.filter((p) => p.activo);
  const pro = planes.find((p) => p.id === 'pro') ?? planes[planes.length - 1];
  const mes = ORDINAL[PAGOS_PARA_ACREDITAR] ?? `${PAGOS_PARA_ACREDITAR}º`;
  // La cuenta hecha (como las páginas de afiliados): con referidos de Pro, a precio de lista. En crédito, no en meses: el
  // crédito todavía no se convierte en meses de nada.
  const cuentas = [1, 5, 10].map((n) => ({ n, monto: n * pro.precioUsd }));
  return (
    <main className="mp-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mp-hero">
        <div className="mp-wrap">
          <nav className="mp-barra">
            <Link className="mp-marca" href="/">MaKo Partners</Link>
            <Link className="mp-entrar" href="/partners/referidos">Ya tengo MaKo: mi link</Link>
          </nav>
          <div className="mp-hero-grilla">
            <div>
              <span className="mp-ceja">Programa de partners</span>
              <h1>Suma el primer mes de <em>cada negocio</em> que traigas a MaKo</h1>
              <p className="mp-bajada">
                Compartes tu link. Cuando ese negocio paga su {mes} mes, su primer mes queda como crédito a tu favor, en tu panel.
                Sin tope: el que trae muchos, junta muchos.
              </p>
              <div className="mp-acciones">
                <Link className="mp-btn" href="/partners/referidos">Quiero mi link</Link>
                <Link className="mp-btn-texto" href="/planes">¿Todavía no tienes MaKo? Ver los planes →</Link>
              </div>
            </div>
            <div className="mp-numero" aria-label="Lo que suma cada referido">
              <div className="mp-numero-etq">Por cada negocio que traes</div>
              <div className="mp-numero-grande">{usd(pro.precioUsd)}</div>
              <div className="mp-numero-sub">de crédito, si entra a {pro.nombre}</div>
              <hr />
              {planes.map((p) => (
                <div key={p.id} className="mp-numero-fila"><span>Referido de {p.nombre}</span><b>{usd(p.precioUsd)}</b></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="mp-seccion">
        <div className="mp-wrap">
          <h2>Cómo funciona</h2>
          <p className="mp-sub">Tres pasos. Tu link ya existe: está en MaKo, en MaKo Partners.</p>
          <ol className="mp-pasos">
            <li className="mp-paso"><span className="mp-paso-n">1</span><h3>Comparte tu link</h3><p>Con tus clientes, tu comunidad o quien quieras recomendarle MaKo.</p></li>
            <li className="mp-paso"><span className="mp-paso-n">2</span><h3>Tu referido entra a MaKo</h3><p>Con su propio plan. Cuenta un negocio nuevo, y el primero que lo trajo.</p></li>
            <li className="mp-paso"><span className="mp-paso-n">3</span><h3>Se te suma su primer mes</h3><p>Cuando paga su {mes} mes, su primer mes queda como crédito a tu favor, y lo ves en tu panel.</p></li>
          </ol>
          {!cobraEnLinea && (
            <p className="mp-aviso">
              Por ahora MaKo da de alta a mano, así que un referido no aparece solo en tu panel: si alguien entró con tu link,
              escríbenos a {emailMako} y lo sumamos.
            </p>
          )}
        </div>
      </section>

      <section className="mp-seccion gris">
        <div className="mp-wrap">
          <h2>Hagamos la cuenta</h2>
          <p className="mp-sub">Con negocios que entran a {pro.nombre}, a precio de lista.</p>
          <div className="mp-cuentas">
            {cuentas.map((c, i) => (
              <div key={c.n} className={`mp-cuenta${i === 1 ? ' destacada' : ''}`}>
                <div className="mp-cuenta-si">Si traes {c.n} {c.n === 1 ? 'negocio' : 'negocios'}</div>
                <div className="mp-cuenta-monto">{usd(c.monto)}</div>
                <div className="mp-cuenta-eq">de crédito a tu favor</div>
              </div>
            ))}
          </div>
          <p className="mp-nota">Se suma cuando cada referido paga su {mes} mes. {CREDITO_HOY}</p>
        </div>
      </section>

      <section className="mp-seccion">
        <div className="mp-wrap">
          <h2>Si eres agencia</h2>
          <p className="mp-sub">Tus clientes en MaKo, desde tu cuenta.</p>
          <div className="mp-tarjeta mp-sola">
            <h3>Las cuentas de tus clientes</h3>
            <p>Con {pro.nombre}, abres la cuenta de MaKo de cada cliente desde tu panel de partner y entras a cada una con «Inspeccionar».</p>
            <p><Link className="mp-btn-texto" href="/partners">Ir a mi panel de partner →</Link></p>
          </div>
        </div>
      </section>

      <section className="mp-seccion gris">
        <div className="mp-wrap">
          <h2>Reglas claras</h2>
          <p className="mp-sub">Lo que cuenta y lo que no, sin letra chica.</p>
          <ul className="mp-reglas">
            <li>Cuenta un negocio nuevo en MaKo: quien ya tenía cuenta no suma.</li>
            <li>Vale el primer link con el que llegó: el link dura {DIAS_COOKIE_REF} días en su navegador.</li>
            <li>Nunca uno mismo: tu propio negocio no se refiere.</li>
            <li>El crédito es el precio de lista del plan de tu referido.</li>
            <li>{CREDITO_HOY}</li>
            <li>No se puede pautar anuncios con la palabra «MaKo».</li>
          </ul>
        </div>
      </section>

      <section className="mp-seccion">
        <div className="mp-wrap">
          <div className="mp-final">
            <h2>Tu link ya existe</h2>
            <p>Entra a MaKo, cópialo y empieza a sumar.</p>
            <Link className="mp-btn" href="/partners/referidos">Quiero mi link</Link>
          </div>
          <p className="mp-pie"><Link href="/planes">Planes de MaKo</Link> · <Link href="/terminos">Términos</Link></p>
        </div>
      </section>
    </main>
  );
}
