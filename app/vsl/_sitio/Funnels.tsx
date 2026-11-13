// La sección «Tu funnel, armado en MaKo» de la portada y el cuerpo de cada mini landing (./funnels.ts, 13/11/2026).
import { Boton, Flecha, Icono } from './Piezas';
import { FUNNELS_SITIO, rutaFunnel, type FunnelSitio } from './funnels-datos';

/** En la portada: los cuatro funnels, cada uno con su recorrido y el link a su mini landing. */
export function FunnelsSitio() {
  return (
    <section className="s-sec s-fun" id="funnels">
      <div className="s-cont">
        <div className="s-centro">
          <p className="s-rotulo">Funnels</p>
          <h2 className="s-h2">Tu funnel, armado en MaKo.</h2>
          <p className="s-lede">Cómo se hace en MaKo cada funnel, paso por paso: qué parte de MaKo hace cada cosa.</p>
        </div>
        <div className="s-fun-g">
          {FUNNELS_SITIO.map((f, i) => (
            <a key={f.id} className="s-fun-c" href={rutaFunnel(f.id)} style={{ ['--i' as string]: i }}>
              <span className="s-fun-ico"><Icono d={f.icono} size={22} /></span>
              <h3>{f.nombre}</h3>
              <p>{f.bajada}</p>
              <ol className="s-fun-r" aria-label="El recorrido">{f.recorrido.map((r) => <li key={r}>{r}</li>)}</ol>
              <span className="s-fun-a">Cómo se arma <Flecha /></span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/** El cuerpo de la mini landing de un funnel: qué es, cuándo sirve, el recorrido y cada paso con lo que lo hace en MaKo. */
export function PaginaFunnel({ f }: { f: FunnelSitio }) {
  const otros = FUNNELS_SITIO.filter((x) => x.id !== f.id);
  return (
    <>
      <section className="s-sec s-fun-hero">
        <div className="s-cont s-centro">
          <p className="s-rotulo">Funnels · {f.nombre}</p>
          <h1 className="s-h2 s-fun-h1">{f.titulo}</h1>
          <p className="s-lede">{f.bajada}</p>
          <ol className="s-fun-r s-fun-r-grande" aria-label="El recorrido">{f.recorrido.map((r) => <li key={r}>{r}</li>)}</ol>
          <div className="s-fun-btns"><Boton clase="s-btn-alto" /></div>
        </div>
      </section>
      <section className="s-sec s-fun-que">
        <div className="s-cont s-fun-dos">
          <div><h2>Qué es</h2><p>{f.queEs}</p></div>
          <div><h2>Cuándo sirve</h2><p>{f.cuando}</p></div>
        </div>
      </section>
      <section className="s-sec s-fun-pasos">
        <div className="s-cont">
          <div className="s-centro"><h2 className="s-h2">Paso por paso, en MaKo.</h2></div>
          <ol className="s-fun-lista">
            {f.pasos.map((p, i) => (
              <li key={p.paso} className="s-fun-paso" style={{ ['--i' as string]: i }}>
                <span className="s-fun-n">{i + 1}</span>
                <div>
                  <h3>{p.paso}</h3>
                  <p>{p.texto}</p>
                  <p className="s-fun-en">En MaKo: {p.enMako.map((m, k) => <span key={m.href}>{k ? ' · ' : ''}<a href={m.href}>{m.nombre}</a></span>)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="s-sec s-fun-otros">
        <div className="s-cont">
          <div className="s-centro"><h2 className="s-h2">Otros funnels.</h2></div>
          <div className="s-fun-g s-fun-g3">
            {otros.map((o, i) => (
              <a key={o.id} className="s-fun-c" href={rutaFunnel(o.id)} style={{ ['--i' as string]: i }}>
                <span className="s-fun-ico"><Icono d={o.icono} size={22} /></span>
                <h3>{o.nombre}</h3>
                <p>{o.bajada}</p>
                <span className="s-fun-a">Cómo se arma <Flecha /></span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export const CSS_FUNNELS = `
.s-fun-g{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:clamp(28px,4vw,48px)}
.s-fun-g3{grid-template-columns:repeat(3,1fr)}
.s-fun-c{display:flex;flex-direction:column;gap:10px;padding:24px;border-radius:16px;background:#0D0B28;border:1px solid rgba(255,255,255,.08);color:#fff;text-decoration:none;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;animation:s-fun-entra .5s ease both;animation-delay:calc(var(--i,0)*80ms)}
.s-fun-c:hover{transform:translateY(-4px);border-color:rgba(47,111,237,.55);box-shadow:0 18px 40px rgba(47,111,237,.18)}
.s-fun-c h3{margin:4px 0 0;font-size:22px;line-height:28px;font-weight:700}
.s-fun-c p{margin:0;font-size:16px;line-height:24px;color:#C9C6E0}
.s-fun-ico{width:44px;height:44px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:rgba(242,176,30,.12);color:#F2B01E}
.s-fun-a{margin-top:auto;padding-top:6px;display:inline-flex;align-items:center;gap:6px;color:#6EA8FF;font-weight:600}
.s-fun-r{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.s-fun-r li{font-size:13px;line-height:18px;padding:4px 10px;border-radius:999px;background:#1C1940;color:#E6E3FF}
.s-fun-r li+li::before{content:"→";margin-right:6px;color:#6EA8FF}
.s-fun-r-grande{justify-content:center;margin-top:22px}.s-fun-r-grande li{font-size:15px;padding:6px 14px}
.s-fun-h1{font-size:clamp(36px,6vw,64px);line-height:1}
.s-fun-btns{margin-top:28px;display:flex;justify-content:center}
.s-fun-dos{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.s-fun-dos>div{padding:28px;border-radius:16px;background:#0D0B28;border:1px solid rgba(255,255,255,.08)}
.s-fun-dos h2{margin:0 0 10px;font-size:22px;color:#F2B01E}.s-fun-dos p{margin:0;font-size:18px;line-height:28px;color:#F7F5FF}
.s-fun-lista{list-style:none;margin:clamp(28px,4vw,44px) auto 0;padding:0;max-width:880px;display:flex;flex-direction:column;gap:14px}
.s-fun-paso{display:grid;grid-template-columns:48px 1fr;gap:18px;padding:24px;border-radius:16px;background:#0D0B28;border:1px solid rgba(255,255,255,.08);animation:s-fun-entra .5s ease both;animation-delay:calc(var(--i,0)*90ms)}
.s-fun-n{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#2F6FED;color:#fff;font-weight:800;font-size:20px}
.s-fun-paso h3{margin:2px 0 6px;font-size:21px;color:#fff}.s-fun-paso p{margin:0;font-size:17px;line-height:26px;color:#C9C6E0}
.s-fun-en{margin-top:10px!important;font-size:15px!important;color:#F2B01E!important}.s-fun-en a{color:#6EA8FF;text-decoration:none;font-weight:600}.s-fun-en a:hover{text-decoration:underline}
@keyframes s-fun-entra{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (max-width:1100px){.s-fun-g{grid-template-columns:repeat(2,1fr)}}
@media (max-width:700px){.s-fun-g,.s-fun-g3,.s-fun-dos{grid-template-columns:1fr}.s-fun-paso{grid-template-columns:40px 1fr;padding:18px}.s-fun-n{width:40px;height:40px;font-size:17px}}
@media (prefers-reduced-motion:reduce){.s-fun-c,.s-fun-paso{animation:none}}
`;
