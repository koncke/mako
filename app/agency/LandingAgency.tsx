'use client';

// =============================================================================
// LandingAgency — la página que VENDE Agency adentro de la app, hasta que el negocio se suma (25/10/2026)
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md punto 9): «Que sea la misma metodología que este [MaKo Partners], que tengas la
// "landing" y que te puedas sumar como "Agency", solo para los que tengan su plan de 97 activo. Ser Agencia es muy
// diferente a Partner. Las agencias no ganan dinero con MaKo, porque sus clientes son suyos». La misma forma que
// app/mako-partners/LandingPartners.tsx (la ficha de la derecha que contesta en una mirada qué es y cuánto cuesta, el
// botón que se suma, las preguntas) con lo de la agencia; copiada de las páginas de agencia de GoHighLevel y Vendasta
// (el «white label»: tus clientes ven tu servicio, no un vendedor) y del panel de sub-cuentas de HighLevel, que es lo
// que la ficha de la derecha dibuja.
//
// EL BOTÓN DEPENDE DEL PLAN (lib/agency-reglas.ts, `puedeSumarseComoAgency`): con MaKo Pro activo, «Sumarme como Agency»
// (abre las tres preguntas: SumarseAgency.tsx); sin Pro, «Pásate a MaKo Pro»; pausado, por qué. Ya Agency (el «Ver la
// landing» del dashboard), «Volver a mi dashboard». El super admin la ve como la ven sus clientes, sin botón.
// ⚠️ SÓLO LO QUE PASA HOY: el precio sale de la plataforma (`usd`, /admin/cobros), nada de comisiones ni premios.
// =============================================================================

import { useState } from 'react';
import Link from '@/app/_ui/Link';
import { Pagina, PageHeader } from '@/app/_ui';
import type { EstadoAgency } from '@/lib/agency';
import { TEXTO_NO_AGENCY } from '@/lib/agency-reglas';
import { RUTA_CAMBIAR_PLAN } from '@/lib/topes-plan';
import { SumarseAgency } from './SumarseAgency';

const usdTxt = (n: number) => `US$ ${n.toLocaleString('es-AR')}`;

export function LandingAgency({ estado, usd, volver, sinMarco = false }: {
  /** `null` = el super admin mirando cómo la ven sus clientes: sin botón. */
  estado: EstadoAgency | null;
  /** Lo que vale el mes de cada cuenta de cliente (el precio de la plataforma). */
  usd: number;
  volver: string;
  /** En el teléfono (/m/agency): sin la página ni el título, que los pone su cabecera. */
  sinMarco?: boolean;
}) {
  const [sumando, setSumando] = useState(false);
  const cta = <Accion estado={estado} onSumarme={() => setSumando(true)} volver={volver} />;

  const contenido = (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {!sinMarco && <PageHeader titulo="Agency Dashboard" />}
      <div className="ag-root">
        {estado == null && (
          <p className="ag-rotulo">Así ven Agency tus clientes con el plan Pro. <Link href="/agency">Ver las agencias →</Link></p>
        )}
        <section className="ag-hero">
          <div className="ag-hero-grilla">
            <div>
              <span className="ag-ceja">MaKo Pro · Agency</span>
              <h1>Tus clientes en MaKo, <em>bajo tu mando</em></h1>
              <p className="ag-bajada">
                Ábrele a cada cliente su propia cuenta de MaKo, entra a la que quieras con un clic y decide quién la paga.
                Son tus clientes: MaKo nunca les vende nada.
              </p>
              <div className="ag-acciones">{cta}</div>
              <ul className="ag-chips">
                <li>Tus clientes son tuyos</li>
                <li>MaKo no les hace promociones</li>
                <li>Tú decides quién paga</li>
              </ul>
            </div>
            <aside className="ag-ficha" aria-label="Lo que cuesta">
              <span className="ag-ficha-etq">Cada cuenta de cliente</span>
              <div className="ag-ficha-grande">{usdTxt(usd)} <small>al mes</small></div>
              <p className="ag-ficha-sub">La pagas tú con tu tarjeta, o la paga tu cliente. Su mes empieza cuando termina su configuración.</p>
              <ol className="ag-mini" aria-hidden>
                <li><span className="ag-pt ag-pt--bien" />Cuenta activa<b>Pagas tú</b></li>
                <li><span className="ag-pt ag-pt--bien" />Cuenta activa<b>Paga tu cliente</b></li>
                <li><span className="ag-pt ag-pt--aviso" />Esperando su pago<b>Paga tu cliente</b></li>
              </ol>
              <p className="ag-ficha-pie">Así se ven en tu Agency Dashboard</p>
            </aside>
          </div>
        </section>

        <section className="ag-seccion">
          <h2>Así de simple</h2>
          <div className="ag-pasos">
            <div className="ag-paso"><span>1</span><b>Abres su cuenta</b><p>Su nombre y su email, o desde un lead de tu CRM. Le llega su acceso.</p></div>
            <div className="ag-paso"><span>2</span><b>Eliges quién paga</b><p>Tú, ahí mismo con tu tarjeta. O tu cliente: al terminar su configuración, le aparece el pago.</p></div>
            <div className="ag-paso"><span>3</span><b>La administras</b><p>Entras a su cuenta con un clic, sumas a su equipo y ves en qué está cada una.</p></div>
          </div>
        </section>

        <section className="ag-seccion">
          <h2>¿Partner o Agency?</h2>
          <div className="ag-vs">
            <div className="ag-vs-col">
              <span className="ag-vs-etq">MaKo Partners</span>
              <b>Recomiendas MaKo y ganas dinero</b>
              <ul>
                <li>El negocio que traes es cliente de MaKo</li>
                <li>Tú no administras su cuenta</li>
                <li>Cualquier plan puede ser Partner</li>
              </ul>
            </div>
            <div className="ag-vs-col ag-vs-col--on">
              <span className="ag-vs-etq">Agency</span>
              <b>Usas MaKo para atender a tus clientes</b>
              <ul>
                <li>Tus clientes son tuyos: MaKo no les vende nada</li>
                <li>Entras a sus cuentas, con controles de admin</li>
                <li>Es parte del plan MaKo Pro</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="ag-seccion">
          <h2>Preguntas frecuentes</h2>
          <div className="ag-faq">
            <details><summary>¿Cuánto cuesta?</summary><p>Cada cuenta de cliente vale {usdTxt(usd)} al mes. Tu plan MaKo Pro sigue igual.</p></details>
            <details><summary>¿Quién paga la cuenta de mi cliente?</summary><p>Lo eliges al abrirla. Si la pagas tú, lo haces ahí mismo con tu tarjeta. Si la paga tu cliente, le aparece el pago al terminar su configuración, y hasta que paga no puedes entrar a su cuenta.</p></details>
            <details><summary>¿Cuándo empieza a correr su mes?</summary><p>Cuando tu cliente termina su configuración. Después se renueva solo, cada mes.</p></details>
            <details><summary>¿Puedo entrar a la cuenta de mi cliente?</summary><p>Sí. Desde tu Agency Dashboard entras con un clic, ves lo mismo que él y pides sumar a su equipo a quien la va a usar.</p></details>
            <details><summary>¿MaKo le va a escribir a mis clientes?</summary><p>No. Son tus clientes: MaKo no les manda promociones ni les ofrece otros planes.</p></details>
            <details><summary>¿Gano dinero como Agency?</summary><p>No con MaKo: lo que cobras a tus clientes es tuyo. Si quieres ganar por recomendar MaKo, eso es MaKo Partners.</p></details>
            <details><summary>¿Qué pasa si dejo el plan Pro?</summary><p>Las cuentas de tus clientes siguen funcionando. Para volver a abrir cuentas y entrar a ellas, vuelve a MaKo Pro.</p></details>
          </div>
        </section>

        <section className="ag-final">
          <h2>Lleva a tus clientes a MaKo</h2>
          <div className="ag-acciones">{cta}</div>
        </section>
      </div>
      {sumando && <SumarseAgency onCerrar={() => setSumando(false)} />}
    </>
  );
  return sinMarco ? contenido : <Pagina>{contenido}</Pagina>;
}

/** El botón de la landing, según lo que el negocio puede hacer hoy. */
function Accion({ estado, onSumarme, volver }: { estado: EstadoAgency | null; onSumarme: () => void; volver: string }) {
  if (estado == null) return <span className="ag-aviso">Tus clientes con MaKo Pro ven aquí «Sumarme como Agency».</span>;
  if (estado.esAgency) return <Link className="ag-btn" href={volver}>Volver a mi dashboard</Link>;
  if (estado.puede.ok) return <button type="button" className="ag-btn" onClick={onSumarme}>Sumarme como Agency</button>;
  if (estado.puede.motivo === 'plan') {
    return (
      <>
        <Link className="ag-btn" href={RUTA_CAMBIAR_PLAN}>Pásate a MaKo Pro</Link>
        <span className="ag-aviso">
          {estado.sumada ? 'Tu Agency espera tu plan Pro: tus clientes siguen donde estaban.' : TEXTO_NO_AGENCY.plan}
        </span>
      </>
    );
  }
  return <span className="ag-aviso">{TEXTO_NO_AGENCY[estado.puede.motivo]}</span>;
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.ag-root{ color:var(--ink); }
.ag-rotulo{ margin:0 0 12px; font-size:var(--fs-sm); color:var(--dim); }
.ag-rotulo a{ color:var(--primary); font-weight:600; }
.ag-hero{ border:1px solid var(--border); border-radius:22px; padding:8px 32px 36px; margin:4px 0 8px;
  background:radial-gradient(1100px 480px at 90% -10%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%),
  linear-gradient(180deg, var(--primary-bg) 0%, var(--surface) 100%); }
.ag-hero-grilla{ display:grid; grid-template-columns:1.2fr 1fr; gap:44px; align-items:center; padding-top:30px; }
.ag-ceja{ display:inline-block; font-size:12.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--primary);
  background:color-mix(in srgb, var(--primary) 11%, transparent); padding:6px 12px; border-radius:999px; }
.ag-hero h1{ margin:16px 0 14px; font-size:38px; line-height:1.07; letter-spacing:-.03em; font-weight:800; }
.ag-hero h1 em{ font-style:normal; color:var(--primary); }
.ag-bajada{ margin:0 0 24px; font-size:17px; color:var(--dim); max-width:540px; line-height:1.55; }
.ag-acciones{ display:flex; gap:14px 18px; flex-wrap:wrap; align-items:center; }
.ag-btn{ display:inline-block; border:0; cursor:pointer; font:inherit; background:var(--primary); color:var(--on-primary, #fff) !important;
  text-decoration:none; font-weight:700; font-size:16px; padding:14px 24px; border-radius:12px;
  box-shadow:0 8px 22px color-mix(in srgb, var(--primary) 30%, transparent); transition:transform .15s ease, box-shadow .15s ease; }
.ag-btn:hover{ transform:translateY(-1px); box-shadow:0 12px 26px color-mix(in srgb, var(--primary) 34%, transparent); }
.ag-aviso{ font-size:14px; color:var(--dim); max-width:420px; }
.ag-chips{ display:flex; flex-wrap:wrap; gap:8px 20px; margin:22px 0 0; padding:0; list-style:none; color:var(--dim); font-size:14px; }
.ag-chips li::before{ content:"✓"; color:var(--good); font-weight:800; margin-right:7px; }
.ag-ficha{ background:var(--surface); border:1px solid var(--border); border-radius:22px; padding:24px 24px 18px; box-shadow:0 24px 60px rgba(18,21,27,.10); }
.ag-ficha-etq{ font-size:12.5px; font-weight:700; color:var(--dim); text-transform:uppercase; letter-spacing:.07em; }
.ag-ficha-grande{ font-size:34px; line-height:1.1; font-weight:800; letter-spacing:-.02em; margin:8px 0 6px; }
.ag-ficha-grande small{ font-size:15px; font-weight:600; color:var(--dim); letter-spacing:0; }
.ag-ficha-sub{ margin:0 0 16px; color:var(--dim); font-size:14.5px; line-height:1.5; }
.ag-mini{ list-style:none; margin:0; padding:0; border:1px solid var(--border); border-radius:14px; overflow:hidden; }
.ag-mini li{ display:flex; align-items:center; gap:10px; padding:11px 14px; font-size:13.5px; border-bottom:1px solid var(--border); background:var(--surface); }
.ag-mini li:last-child{ border-bottom:0; }
.ag-mini b{ margin-left:auto; font-size:12px; font-weight:600; color:var(--dim); background:var(--surface-2); padding:3px 9px; border-radius:999px; }
.ag-pt{ width:8px; height:8px; border-radius:50%; flex:none; }
.ag-pt--bien{ background:var(--good); }
.ag-pt--aviso{ background:var(--warn); }
.ag-ficha-pie{ margin:10px 0 0; font-size:12px; color:var(--faint); text-align:center; }
.ag-seccion{ margin:40px 0 0; }
.ag-seccion h2, .ag-final h2{ margin:0 0 16px; font-size:24px; font-weight:800; letter-spacing:-.02em; }
.ag-pasos{ display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:14px; }
.ag-paso{ background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:20px; display:flex; flex-direction:column; gap:6px; }
.ag-paso span{ width:30px; height:30px; border-radius:10px; background:var(--primary-bg); color:var(--primary); font-weight:800;
  display:inline-flex; align-items:center; justify-content:center; margin-bottom:6px; }
.ag-paso b{ font-size:16px; }
.ag-paso p{ margin:0; font-size:14px; color:var(--dim); line-height:1.5; }
.ag-vs{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.ag-vs-col{ border:1px solid var(--border); border-radius:18px; padding:20px 22px; background:var(--surface); display:flex; flex-direction:column; gap:8px; }
.ag-vs-col--on{ border-color:color-mix(in srgb, var(--primary) 45%, var(--border)); box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent); }
.ag-vs-etq{ font-size:12px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--dim); }
.ag-vs-col--on .ag-vs-etq{ color:var(--primary); }
.ag-vs-col b{ font-size:17px; }
.ag-vs-col ul{ margin:4px 0 0; padding:0 0 0 18px; display:flex; flex-direction:column; gap:6px; font-size:14px; color:var(--dim); }
.ag-faq{ display:flex; flex-direction:column; border-top:1px solid var(--border); max-width:820px; }
.ag-faq details{ border-bottom:1px solid var(--border); padding:14px 4px; }
.ag-faq summary{ cursor:pointer; font-weight:650; font-size:15.5px; list-style:none; display:flex; justify-content:space-between; gap:12px; }
.ag-faq summary::after{ content:"+"; color:var(--dim); font-weight:700; }
.ag-faq details[open] summary::after{ content:"–"; }
.ag-faq p{ margin:10px 0 2px; color:var(--dim); font-size:14.5px; line-height:1.55; }
.ag-final{ margin:44px 0 12px; padding:30px; border-radius:22px; text-align:center; background:var(--surface-2); border:1px solid var(--border);
  display:flex; flex-direction:column; align-items:center; }
@media (max-width: 860px){
  .ag-hero{ padding:6px 18px 26px; }
  .ag-hero-grilla{ grid-template-columns:1fr; gap:26px; padding-top:22px; }
  .ag-hero h1{ font-size:30px; }
  .ag-pasos, .ag-vs{ grid-template-columns:1fr; }
}
`;
