// =============================================================================
// La calculadora de MaKo Tokens de /planes (14/11/2026)
// =============================================================================
// Martín (14/11/2026): «estaría bueno como lo tienen otros en pricing, hacer como la calculadora en donde tú puedes arrastrar para
// calcular la cantidad de tokens. Y que vaya cambiando como el pricing según la cantidad de token que quieras».
//
// Los números NO se escriben acá: el paquete de cada cantidad sale de lib/mako-tokens-paquetes.ts (`paqueteDeMinutos`: el clip de
// 10 s a US$2 y 500 MaKo Tokens, decidido por Martín el 7/11) y lo que alcanza en imágenes, del costo medido de una imagen
// (lib/mako-tokens-reglas.ts, `mtDeImagenes`). Se arrastra por MINUTOS de video, que es como la persona lo entiende.
// Un script chico (`data-visor`) mueve los números: anda sin React y también en el visor de las landings.
// =============================================================================

import { paqueteDeMinutos } from '@/lib/mako-tokens-paquetes';
import { mtDeImagenes } from '@/lib/mako-tokens-reglas';

const MINUTOS = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20] as const;
const INICIAL = 1; // el índice de arranque: 2 minutos

const mil = (n: number) => n.toLocaleString('es-AR');

export type PasoTokens = { mt: string; min: string; img: string; usd: string };

/** Cada paso del control: los tokens, lo que alcanzan y lo que salen. */
export function pasosDeTokens(): PasoTokens[] {
  const mtImagen = mtDeImagenes(1);
  return MINUTOS.map((m) => {
    const p = paqueteDeMinutos(m);
    return {
      mt: mil(p.mt),
      min: `${m} ${m === 1 ? 'minuto' : 'minutos'} de video`,
      img: `o ${mil(Math.floor(p.mt / mtImagen))} imágenes`,
      usd: `US$ ${mil(p.usd)}`,
    };
  });
}

export const CSS_TOKENS = `
.tk{margin:72px auto 0;max-width:880px;text-align:center}
.tk h2{margin:0;font-size:32px;line-height:38px;font-weight:800;letter-spacing:-.01em}
.tk-p{margin:12px auto 0;max-width:640px;font-size:17px;line-height:26px;color:var(--pl-texto-2,#475467)}
.tk-caja{margin-top:28px;border-radius:20px;background:#fff;box-shadow:0 0 0 1px rgba(16,24,40,.08),0 18px 40px -24px rgba(16,24,40,.3);padding:32px 36px;text-align:left;color:#101828}
.tk-num{font-size:18px;line-height:26px;font-weight:600}
.tk-num b{font-size:40px;line-height:44px;font-weight:800;letter-spacing:-.02em;margin-right:8px}
.tk-rango{width:100%;margin:22px 0 6px;accent-color:#2F6FED;height:28px;cursor:grab}
.tk-escala{display:flex;justify-content:space-between;font-size:14px;color:#667085}
.tk-res{margin-top:22px;padding-top:22px;border-top:1px solid #EAECF0;display:flex;align-items:center;justify-content:space-between;gap:20px}
.tk-alc{font-size:20px;line-height:28px;font-weight:700}
.tk-alc span{display:block;font-size:17px;line-height:24px;font-weight:500;color:#475467}
.tk-alc span:first-child{font-size:22px;line-height:30px;font-weight:700;color:#101828}
.tk-usd{font-size:40px;line-height:44px;font-weight:800;letter-spacing:-.02em;color:#2F6FED;white-space:nowrap}
@media (max-width:640px){
  .tk h2{font-size:26px;line-height:32px}
  .tk-caja{padding:22px 20px}
  .tk-num b,.tk-usd{font-size:32px;line-height:36px}
  .tk-res{flex-direction:column;align-items:flex-start}
}
`;

export function CalculadoraTokens() {
  const pasos = pasosDeTokens();
  const a = pasos[INICIAL];
  const script = `(function(){var P=${JSON.stringify(pasos)};document.querySelectorAll('[data-tk]').forEach(function(c){var r=c.querySelector('input[type=range]');function pon(){var p=P[Number(r.value)]||P[0];c.querySelectorAll('[data-tk-v]').forEach(function(n){n.textContent=p[n.getAttribute('data-tk-v')];});r.setAttribute('aria-valuetext',p.mt+' MaKo Tokens, '+p.usd);}r.addEventListener('input',pon);pon();});})();`;
  return (
    <section className="tk" aria-labelledby="tk-titulo" data-tk="">
      <h2 id="tk-titulo">¿Necesitas más? Suma MaKo Tokens.</h2>
      <p className="tk-p">Tu plan trae MaKo Tokens cada mes para generar video e imágenes con IA. Si te faltan, los compras dentro de MaKo.</p>
      <div className="tk-caja">
        <div className="tk-num"><b data-tk-v="mt">{a.mt}</b>MaKo Tokens</div>
        <input className="tk-rango" type="range" min={0} max={pasos.length - 1} step={1} defaultValue={INICIAL} aria-label="Cuántos MaKo Tokens" />
        <div className="tk-escala" aria-hidden="true"><span>{pasos[0].mt}</span><span>{pasos[pasos.length - 1].mt}</span></div>
        <div className="tk-res">
          <div className="tk-alc"><span data-tk-v="min">{a.min}</span><span data-tk-v="img">{a.img}</span></div>
          <div className="tk-usd" data-tk-v="usd">{a.usd}</div>
        </div>
      </div>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: script }} />
    </section>
  );
}
