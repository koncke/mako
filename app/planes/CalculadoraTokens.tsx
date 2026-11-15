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
//
// EL COSTO REAL POR ACCIÓN (14/11/2026, lo que faltaba del feedback de Martín sobre los MaKo Tokens: la calculadora «con los
// tokens de cada plan y el costo real por acción», docs/relevo/landings-vsl.md:425-426). Debajo del control, lo que sale CADA
// cosa, para que el número de arriba signifique algo.
// ⚠️ SÓLO LO QUE ESTÁ MEDIDO EN EL REPO, y de UN solo camino por cosa:
//   · el video, por CLIP de 10 s (`MT_POR_CLIP`, redondeado desde los US$0,412 medidos el 7/11/2026 con su imagen de
//     referencia) y su minuto, que son seis clips. Es el mismo camino que mueve el control: si acá se dijera el video por
//     segundo (`USD_POR_SEGUNDO`, otro modelo, otra medición), los dos números de la misma pantalla se contradirían;
//   · la imagen, de `USD_POR_IMAGEN` (FLUX.2 dev y GPT Image 2 medium, medidos).
// Lo que NO está acá porque NO tiene número medido en el repo, y no se inventa: escribir (el copy, los guiones, el chat de
// MaKo), replicar una landing y editar video con IA. Esos corren con la IA del negocio —su clave, sus créditos— y no pasan por
// este medidor. El día que se midan, salen de su constante y se suman a `COSTOS_POR_ACCION`, nunca a mano.
// =============================================================================

import { MT_POR_CLIP, paqueteDeMinutos, CLIPS_POR_MINUTO } from '@/lib/mako-tokens-paquetes';
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

/** Lo que cuesta cada acción, en MaKo Tokens. Cada número sale de su constante medida (ver la cabecera). */
export type CostoPorAccion = { que: string; mt: number };

export function costosPorAccion(): CostoPorAccion[] {
  return [
    { que: 'Un clip de video de 10 segundos', mt: MT_POR_CLIP },
    { que: `Un minuto de video (${CLIPS_POR_MINUTO} clips)`, mt: paqueteDeMinutos(1).mt },
    { que: 'Una imagen', mt: mtDeImagenes(1) },
    { que: 'Una imagen en alta calidad', mt: mtDeImagenes(1, 'premium') },
  ];
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
/* El costo real por acción (14/11/2026): una fila por cosa, el número a la derecha, para que los MaKo Tokens signifiquen algo. */
.tk-acc{margin-top:22px;padding-top:18px;border-top:1px solid #EAECF0}
.tk-acc-t{margin:0 0 10px;font-size:14px;font-weight:700;color:#101828}
.tk-acc ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.tk-acc li{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:15px;line-height:22px;color:#475467}
.tk-acc li b{flex:none;font-weight:700;color:#101828;font-variant-numeric:tabular-nums}
@media (max-width:640px){
  .tk h2{font-size:26px;line-height:32px}
  .tk-caja{padding:22px 20px}
  .tk-num b,.tk-usd{font-size:32px;line-height:36px}
  .tk-res{flex-direction:column;align-items:flex-start}
  .tk-acc li{font-size:14px;line-height:20px}
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
        {/* Lo que sale cada cosa, de los costos medidos (ver la cabecera). No se mueve con el control: es el precio de la acción. */}
        <div className="tk-acc">
          <p className="tk-acc-t">Lo que cuesta cada cosa</p>
          <ul>
            {costosPorAccion().map((c) => (
              <li key={c.que}><span>{c.que}</span><b>{mil(c.mt)} MT</b></li>
            ))}
          </ul>
        </div>
      </div>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: script }} />
    </section>
  );
}
