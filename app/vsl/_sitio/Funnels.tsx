// =============================================================================
// La landing de cada funnel (/vsl/funnels/<id>): VSL con llamada, anuncios a WhatsApp, Instagram con lead magnet y YouTube
// =============================================================================
// La llamada con Leila (13/11/2026) pidió «mini landings por funnel». Martín (14/11/2026): sacarlas de la portada y llevarlas al menú
// Industrias, «y que sea evidentemente una landing cada uno». Por eso cada una es una landing con el molde de la portada: el hero con
// su botón y el recorrido del funnel que se va prendiendo paso por paso, las piezas de MaKo que lo arman, y cada paso en una fila
// con la GRABACIÓN de la app que lo hace (las mismas de la portada, public/vsl-assets/sitio/), el «¿es para ti?» y el cierre.
// El contenido vive en ./funnels-datos.ts.
// =============================================================================

import { Boton, Flecha, Icono } from './Piezas';
import { FUNNELS_SITIO, rutaFunnel, type FunnelSitio } from './funnels-datos';

/** La grabación de la app de cada pieza de MaKo (el link de su landing → su video de la portada). Sin grabación, no entra. */
const GRABACION: Readonly<Record<string, string>> = {
  '/vsl/competitor-spy': 'spy',
  '/vsl/web-generator': 'replicar',
  '/vsl/image': 'carruseles',
  '/vsl/copywriting': 'copywriting',
  '/vsl/video': 'video',
  '/vsl/ads': 'copilot',
  '/vsl/crm': 'crm-ficha',
  '/vsl/seguimiento': 'automations',
  '/vsl/whatsapp': 'chats',
  '/vsl/cobranza': 'cobranza',
};

function videoDelPaso(enMako: FunnelSitio['pasos'][number]['enMako']): string | null {
  for (const m of enMako) if (GRABACION[m.href]) return GRABACION[m.href];
  return null;
}

/** El recorrido del funnel, de arriba abajo: cada paso se prende cuando le llega el turno (sólo CSS). */
function Recorrido({ f }: { f: FunnelSitio }) {
  const n = f.recorrido.length;
  return (
    <ol className="s-fh-mapa" aria-label={`El recorrido: ${f.recorrido.join(', ')}`} style={{ ['--n' as string]: n }}>
      {f.recorrido.map((r, i) => (
        <li key={r} className="s-fh-nodo" style={{ ['--i' as string]: i }}>
          <span className="s-fh-num">{i + 1}</span>
          <span className="s-fh-nom">{r}</span>
        </li>
      ))}
    </ol>
  );
}

export function PaginaFunnel({ f }: { f: FunnelSitio }) {
  const otros = FUNNELS_SITIO.filter((x) => x.id !== f.id);
  const piezas = [...new Map(f.pasos.flatMap((p) => p.enMako).map((m) => [m.href, m])).values()];
  return (
    <>
      <section className="s-sec s-fh">
        <div className="s-cont s-fh-in">
          <div className="s-fh-tx">
            <p className="s-rotulo s-fh-r"><Icono d={f.icono} size={18} /> Funnel · {f.nombre}</p>
            <h1 className="s-fh-h1">{f.titulo}</h1>
            <p className="s-fh-p">{f.bajada}</p>
            <div className="s-fh-btns">
              <Boton clase="s-btn-alto" />
              <a className="s-zz-a" href="#pasos">Ver el paso por paso <Flecha /></a>
            </div>
          </div>
          <Recorrido f={f} />
        </div>
      </section>

      <section className="s-fp" aria-label="Las partes de MaKo que lo arman">
        <div className="s-cont">
          <p className="s-fp-t">Lo arman, en una sola app:</p>
          <ul className="s-fp-l">
            {piezas.map((m) => <li key={m.href}><a href={m.href}>{m.nombre}</a></li>)}
          </ul>
        </div>
      </section>

      <section className="s-sec" id="pasos">
        <div className="s-cont">
          <div className="s-centro">
            <p className="s-rotulo">Paso por paso</p>
            <h2 className="s-h2">Cómo se arma en MaKo.</h2>
          </div>
          <div className="s-zz">
            {f.pasos.map((p, i) => {
              const v = videoDelPaso(p.enMako);
              return (
                <div key={p.paso} className={`s-zz-fila${i % 2 ? ' s-zz-inv' : ''}`}>
                  <div className="s-zz-tx">
                    <p className="s-zz-r s-fpaso-r"><span className="s-fpaso-n">{i + 1}</span>{p.paso}</p>
                    <h3 className="s-zz-t s-fpaso-t">{p.texto}</h3>
                    <p className="s-fpaso-en">Lo hace: {p.enMako.map((m, k) => <span key={m.href}>{k ? ' · ' : ''}<a href={m.href}>{m.nombre}</a></span>)}</p>
                  </div>
                  {v ? (
                    <div className="s-zz-vis s-zz-video" aria-hidden="true">
                      <video src={`/vsl-assets/sitio/${v}.webm`} poster={`/vsl-assets/sitio/${v}.jpg`} autoPlay muted loop playsInline preload="metadata" />
                    </div>
                  ) : <div aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="s-sec s-fq">
        <div className="s-cont">
          <div className="s-centro"><p className="s-rotulo">¿Es para ti?</p><h2 className="s-h2">Antes de armarlo.</h2></div>
          <div className="s-fq-dos">
            <div><h3>Qué es</h3><p>{f.queEs}</p></div>
            <div><h3>Cuándo conviene</h3><p>{f.cuando}</p></div>
          </div>
        </div>
      </section>

      <section className="s-cierre">
        <div className="s-cont">
          <div className="s-cierre-caja">
            <h2 className="s-h2">{f.cierre}</h2>
            <Boton />
          </div>
        </div>
      </section>

      <section className="s-sec s-fun-otros">
        <div className="s-cont">
          <div className="s-centro"><h2 className="s-h2">Otros funnels.</h2></div>
          <div className="s-fun-g">
            {otros.map((o) => (
              <a key={o.id} className="s-fun-c" href={rutaFunnel(o.id)}>
                <span className="s-fun-ico"><Icono d={o.icono} size={22} /></span>
                <h3>{o.nombre}</h3>
                <p>{o.corta}</p>
                <span className="s-fun-a">Ver el funnel <Flecha /></span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export const CSS_FUNNELS = `
.s-fh{padding-top:clamp(40px,6vw,88px)}
.s-fh-in{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:clamp(32px,6vw,88px);align-items:center}
.s-fh-r{display:inline-flex;align-items:center;gap:8px}
.s-fh-h1{margin:14px 0 0;font-size:clamp(40px,5.4vw,68px);line-height:1.02;font-weight:800;letter-spacing:-.025em;color:#fff}
.s-fh-p{margin:22px 0 0;max-width:560px;font-size:20px;line-height:30px;color:#C9C6E0}
.s-fh-btns{margin-top:32px;display:flex;flex-wrap:wrap;align-items:center;gap:20px 28px}
.s-fh-btns .s-zz-a{margin-top:0}
.s-fh-mapa{list-style:none;margin:0;padding:28px;border-radius:24px;background:#0D0B28;border:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;gap:18px;position:relative;box-shadow:0 30px 80px -30px rgba(0,0,0,.7)}
.s-fh-nodo{position:relative;display:flex;align-items:center;gap:16px;padding:16px 18px;border-radius:16px;background:#151236;border:1px solid rgba(255,255,255,.08);animation:s-fh-prende calc(var(--n)*1.1s) infinite;animation-delay:calc(var(--i)*1.1s)}
.s-fh-nodo+.s-fh-nodo::before{content:"";position:absolute;left:37px;top:-19px;width:2px;height:18px;background:linear-gradient(#2F6FED,rgba(47,111,237,.2))}
.s-fh-num{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:17px;background:#1C1940;color:#C9C6E0;animation:s-fh-num calc(var(--n)*1.1s) infinite;animation-delay:calc(var(--i)*1.1s)}
.s-fh-nom{font-size:20px;font-weight:700;color:#fff}
@keyframes s-fh-prende{0%,100%{border-color:rgba(255,255,255,.08);box-shadow:none;transform:none}6%,22%{border-color:rgba(47,111,237,.9);box-shadow:0 0 0 4px rgba(47,111,237,.18),0 12px 30px -10px rgba(47,111,237,.6);transform:translateX(6px)}34%{border-color:rgba(255,255,255,.08);box-shadow:none;transform:none}}
@keyframes s-fh-num{0%,100%{background:#1C1940;color:#C9C6E0}6%,22%{background:#2F6FED;color:#fff}34%{background:#1C1940;color:#C9C6E0}}
.s-fp{padding:8px 0 0}
.s-fp .s-cont{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 16px}
.s-fp-t{margin:0;font-size:16px;font-weight:600;color:#C9C6E0}
.s-fp-l{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.s-fp-l a{display:inline-block;padding:8px 14px;border-radius:999px;background:#151236;border:1px solid rgba(255,255,255,.1);color:#fff;font-size:15px;font-weight:600;text-decoration:none;transition:border-color .15s,background .15s}
.s-fp-l a:hover{border-color:#2F6FED;background:#1A1F4A}
.s-fpaso-r{display:inline-flex;align-items:center;gap:10px}
.s-fpaso-n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#2F6FED;color:#fff;font-weight:800;font-size:14px}
.s-fpaso-t{font-size:28px;line-height:36px}
.s-fpaso-en{margin-top:18px;font-size:16px;line-height:24px;color:#C9C6E0}
.s-fpaso-en a{color:#6EA8FF;font-weight:600;text-decoration:none}.s-fpaso-en a:hover{text-decoration:underline}
.s-fq-dos{margin:clamp(28px,4vw,44px) auto 0;max-width:980px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
.s-fq-dos>div{padding:28px;border-radius:18px;background:#0D0B28;border:1px solid rgba(255,255,255,.08)}
.s-fq-dos h3{margin:0 0 10px;font-size:20px;color:#F2B01E}.s-fq-dos p{margin:0;font-size:18px;line-height:28px;color:#F7F5FF}
.s-fun-g{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:clamp(28px,4vw,48px)}
.s-fun-c{display:flex;flex-direction:column;gap:10px;padding:24px;border-radius:16px;background:#0D0B28;border:1px solid rgba(255,255,255,.08);color:#fff;text-decoration:none;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
.s-fun-c:hover{transform:translateY(-4px);border-color:rgba(47,111,237,.55);box-shadow:0 18px 40px rgba(47,111,237,.18)}
.s-fun-c h3{margin:4px 0 0;font-size:22px;line-height:28px;font-weight:700}
.s-fun-c p{margin:0;font-size:16px;line-height:24px;color:#C9C6E0}
.s-fun-ico{width:44px;height:44px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:rgba(242,176,30,.12);color:#F2B01E}
.s-fun-a{margin-top:auto;padding-top:6px;display:inline-flex;align-items:center;gap:6px;color:#6EA8FF;font-weight:600}
@media (max-width:900px){.s-fh-in{grid-template-columns:1fr}.s-fh-mapa{padding:20px}}
@media (max-width:700px){.s-fun-g,.s-fq-dos{grid-template-columns:1fr}.s-fh-p{font-size:18px;line-height:27px}.s-fh-nom{font-size:18px}.s-fpaso-t{font-size:23px;line-height:30px}}
@media (prefers-reduced-motion:reduce){.s-fh-nodo,.s-fh-num{animation:none}}
`;
