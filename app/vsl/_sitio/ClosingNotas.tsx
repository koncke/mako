// =============================================================================
// Closing en /vsl/closing y en /vsl/equipo: la nota de una llamada real de Mauricio y su antes y después (16/11/2026)
// =============================================================================
// Martín: que el antes y después de Closing vaya también en /vsl/closing y en la fila del coaching de /vsl/equipo, con las llamadas
// grabadas de Mauricio («eso lo puede utilizar sin problema») y POCO texto. Dos escenas, con el mismo lenguaje que la de la portada
// (./ClosingAntesDespues.tsx: la hoja de MaKo, blanca, con su estrella):
//   · ClosingPuntaje — «Cada llamada, puntuada sola»: la de septiembre (6,2) y sus siete notas, de a una (SPIN y la ejecución).
//   · ClosingCoaching — «Lo que hiciste bien y lo que hay que corregir»: el coaching que MaKo le dejó a esa llamada (tres temas) y, en la
//     de octubre (8,0), cómo quedó cada dimensión que tocaba ese consejo.
// Todo sale de ./closing-mauricio.ts (`notas`): notas reales, sin nombres ni frases de terceros. Sólo CSS, en unidades del contenedor
// (cqw): entra igual en la computadora y en el teléfono (en una caja chica, el antes y el después van uno después del otro).
// `data-tema-fijo`: el sol y la luna no lo toca (es una pantalla de la app, clara en los dos modos).
import type { CSSProperties } from 'react';
import { CLOSING_MAURICIO } from './closing-mauricio';

const { antes, despues, coaching } = CLOSING_MAURICIO.notas;
type Llamada = typeof antes | typeof despues;

const coma = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','));
const nota = (n: number) => n.toFixed(1).replace('.', ',');
/** El color de una nota, con los cortes de la lista de llamadas de la hoja (./ClosingAntesDespues.tsx): 7 o más, 6 o más, menos. */
const tono = (n: number) => (n >= 7 ? { f: '#E6F4EA', t: '#137333', c: '#1E8E3E' } : n >= 6 ? { f: '#FEF7E0', t: '#B06000', c: '#F9AB00' } : { f: '#FCE8E6', t: '#C5221F', c: '#EA4335' });
/** Los rótulos cortos de una caja chica (el teléfono). */
const CORTO: Readonly<Record<string, string>> = {
  'Necesidad / beneficio': 'Necesidad', 'Presentación de la propuesta': 'Propuesta', 'Manejo de objeciones': 'Objeciones', 'CTA / siguientes pasos': 'Siguientes pasos',
};
const SPIN = new Set(['Situación', 'Problema', 'Implicación', 'Necesidad / beneficio']);
const notaDe = (l: Llamada, d: string) => l.dims.find((x) => x.d === d)?.n ?? 0;

/** Que un elemento entre en el `a` % del ciclo y se vaya con todos al final (cada uno con SU keyframe: con un `animation-delay`, los
 *  últimos se cruzaban de una vuelta a la otra). */
const entra = (nombre: string, a: number, hasta = 93) =>
  `@keyframes ${nombre}{0%,${a}%{opacity:0;transform:translateY(1.2cqw)}${a + 3}%,${hasta}%{opacity:1;transform:none}${hasta + 4}%,100%{opacity:0;transform:none}}`;
/** El anillo se llena en el `a` % del ciclo (el trazo de la nota, sobre 100). */
const llena = (nombre: string, p: number, a: number, b: number, hasta = 93) =>
  `@keyframes ${nombre}{0%,${a}%{stroke-dashoffset:${p}}${b}%,${hasta}%{stroke-dashoffset:0}${hasta + 4}%,100%{stroke-dashoffset:${p}}}`;

const CSS_BASE = `
.s-cno{container-type:inline-size;position:absolute;inset:0;background:#F4F6FA;color:#12151B;font-family:inherit;line-height:1.3;letter-spacing:normal;overflow:hidden;text-align:left}
.s-cno *{box-sizing:border-box}
.s-cno-in{position:absolute;inset:0;padding:3cqw 3.4cqw;display:flex;flex-direction:column;gap:2cqw}
.s-cno-cab{display:flex;align-items:center;gap:1cqw;font-size:2cqw;font-weight:800;white-space:nowrap}
.s-cno-cab svg{flex:none;width:2.6cqw;height:2.6cqw}
.s-cno-cab small{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:1.6cqw;font-weight:600;color:#6B7280}
.s-cno-cab em{margin-left:auto;font-style:normal;font-size:1.45cqw;font-weight:700;color:#2F6FED;background:#E8F0FE;padding:.55cqw 1.2cqw;border-radius:99px}
.s-cno-card{background:#fff;border:1px solid #E5E8EF;border-radius:1.6cqw;min-width:0;min-height:0}
/* El anillo de la nota: el trazo se dibuja hasta la nota (sobre 10) y el número aparece cuando termina. */
.s-cno-anillo{position:relative;flex:none;aspect-ratio:1}
.s-cno-anillo svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.s-cno-anillo circle{fill:none;stroke-width:3.4}
.s-cno-anillo .s-cno-fondo{stroke:#EEF0F4}
.s-cno-anillo .s-cno-trazo{stroke:var(--c);stroke-linecap:round}
.s-cno-anillo b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;letter-spacing:-.02em}
.s-cno-pastilla{flex:none;min-width:4.6cqw;text-align:center;padding:.35cqw .7cqw;border-radius:.7cqw;font-weight:800;background:var(--f);color:var(--t)}
/* Lo común en una caja chica va AQUÍ y no en cada escena: las dos escenas repiten esta hoja en la misma página (/vsl/closing), y la
   segunda pisaba lo de la primera. */
@container (max-width:480px){
.s-cno-in{padding:4cqw 4.4cqw;gap:3cqw}.s-cno-cab{font-size:3.6cqw;gap:1.6cqw}.s-cno-cab svg{width:4.4cqw;height:4.4cqw}.s-cno-cab small{display:none}.s-cno-cab em{font-size:2.9cqw;padding:.9cqw 2cqw}}
`;

const Estrella = () => (
  <svg viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
);

/** El anillo con la nota de una llamada (su animación va por la escena que lo lleva). */
function Anillo({ l }: { l: Llamada }) {
  const p = Math.round(l.nota * 10);
  return (
    <span className="s-cno-anillo" style={{ '--c': tono(l.nota).c } as CSSProperties}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="s-cno-fondo" cx="18" cy="18" r="15.9" />
        <circle className="s-cno-trazo" cx="18" cy="18" r="15.9" pathLength={100} strokeDasharray={`${p} 100`} strokeDashoffset={0} />
      </svg>
      <b>{nota(l.nota)}</b>
    </span>
  );
}

// -----------------------------------------------------------------------------
// «Cada llamada, puntuada sola»: la llamada de septiembre y sus siete notas.
// -----------------------------------------------------------------------------
const CICLO_P = 11;
const ENTRA_DIM = (i: number) => 26 + i * 6;
const CSS_P = `
.s-cno-p .s-cno-cuerpo{flex:1;min-height:0;display:grid;grid-template-columns:34cqw minmax(0,1fr);gap:2.4cqw}
.s-cno-p .s-cno-izq{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4cqw}
.s-cno-p .s-cno-anillo{width:23cqw}
.s-cno-p .s-cno-anillo b{font-size:6.4cqw}
.s-cno-p .s-cno-izq p{margin:0;font-size:1.6cqw;font-weight:700;color:#6B7280;text-align:center}
.s-cno-p .s-cno-der{padding:1.8cqw 2.2cqw;display:flex;flex-direction:column;justify-content:center}
.s-cno-p h4{margin:0 0 .4cqw;font-size:1.3cqw;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9AA0A6}
.s-cno-p h4+.s-cno-dim{border-top:0}
.s-cno-p .s-cno-dim+h4{margin-top:1.4cqw}
.s-cno-dim{display:flex;align-items:center;gap:1cqw;padding:.62cqw 0;border-top:1px solid #EEF0F4;font-size:1.75cqw;font-weight:600;white-space:nowrap;opacity:0;animation:${CICLO_P}s infinite}
.s-cno-dim span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.s-cno-dim .s-cno-pastilla{margin-left:auto;font-size:1.7cqw}
.s-cno-dim .s-cno-cor{display:none}
.s-cno-p .s-cno-trazo{animation:s-cno-p-llena ${CICLO_P}s cubic-bezier(.4,0,.2,1) infinite}
.s-cno-p .s-cno-anillo b,.s-cno-p .s-cno-izq p{opacity:0;animation:s-cno-p-num ${CICLO_P}s infinite}
${llena('s-cno-p-llena', Math.round(antes.nota * 10), 4, 22)}
${entra('s-cno-p-num', 19)}
${antes.dims.map((_, i) => `.s-cno-dim[data-i="${i}"]{animation-name:s-cno-p-${i}}${entra(`s-cno-p-${i}`, ENTRA_DIM(i))}`).join('\n')}
@container (max-width:480px){
.s-cno-p .s-cno-cuerpo{grid-template-columns:33cqw minmax(0,1fr);gap:3cqw}.s-cno-p .s-cno-anillo{width:28cqw}.s-cno-p .s-cno-anillo b{font-size:8.6cqw}.s-cno-p .s-cno-izq{border-radius:2.4cqw}.s-cno-p .s-cno-izq p{font-size:2.9cqw}
.s-cno-p .s-cno-der{padding:1.6cqw 3.4cqw;border-radius:2.4cqw}.s-cno-p h4{display:none}.s-cno-dim{font-size:3.7cqw;padding:.95cqw 0}.s-cno-dim .s-cno-l{display:none}.s-cno-dim .s-cno-cor{display:inline}
.s-cno-dim .s-cno-pastilla{font-size:3.5cqw;min-width:8.4cqw;border-radius:1.2cqw;padding:.3cqw 1cqw}}
@media (prefers-reduced-motion:reduce){.s-cno-p .s-cno-trazo,.s-cno-p .s-cno-anillo b,.s-cno-p .s-cno-izq p,.s-cno-dim{animation:none;opacity:1}}
`;

export function ClosingPuntaje() {
  // Cada dimensión con su lugar en la lista (su `data-i`: el momento en que entra), separadas en SPIN y la ejecución.
  const dims = antes.dims.map((x, i) => ({ d: x.d as string, n: x.n as number, i }));
  const fila = (x: { d: string; n: number; i: number }) => {
    const { i } = x;
    const c = tono(x.n);
    return (
      <div key={x.d} className="s-cno-dim" data-i={i}>
        <span className="s-cno-l">{x.d}</span><span className="s-cno-cor">{CORTO[x.d] ?? x.d}</span>
        <b className="s-cno-pastilla" style={{ '--f': c.f, '--t': c.t } as CSSProperties}>{coma(x.n)}</b>
      </div>
    );
  };
  return (
    <div className="s-cno s-cno-p" data-tema-fijo="" role="img"
      aria-label={`Una llamada de venta de Mauricio analizada por MaKo: ${nota(antes.nota)} de 10, con la nota de cada dimensión del método SPIN y de la ejecución`}>
      <style dangerouslySetInnerHTML={{ __html: CSS_BASE + CSS_P }} />
      <div className="s-cno-in">
        <div className="s-cno-cab"><Estrella />MaKo<small>Análisis de la llamada</small><em>{antes.mes} · {antes.min} min</em></div>
        <div className="s-cno-cuerpo">
          <div className="s-cno-card s-cno-izq">
            <Anillo l={antes} />
            <p>Score de la llamada</p>
          </div>
          <div className="s-cno-card s-cno-der">
            <h4>Método SPIN</h4>
            {dims.filter((x) => SPIN.has(x.d)).map(fila)}
            <h4>Ejecución</h4>
            {dims.filter((x) => !SPIN.has(x.d)).map(fila)}
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// «Lo que hiciste bien y lo que hay que corregir»: el coaching de septiembre y cómo quedó en octubre.
// -----------------------------------------------------------------------------
const CICLO_C = 15;
const ENTRA_TIP = (i: number) => 13 + i * 7;
const ENTRA_SUBE = (i: number) => 57 + i * 7;
const CSS_C = `
.s-cno-c .s-cno-par{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 4.4cqw minmax(0,1fr);gap:1.4cqw;align-items:center}
.s-cno-c .s-cno-card{padding:2.6cqw 2.8cqw;display:flex;flex-direction:column;gap:1.6cqw}
.s-cno-c .s-cno-cab2{display:flex;align-items:center;gap:1.8cqw}
.s-cno-c .s-cno-anillo{width:11.5cqw}
.s-cno-c .s-cno-anillo b{font-size:3.4cqw}
.s-cno-c .s-cno-cab2 p{margin:0;font-size:2.8cqw;font-weight:800;line-height:1.15}
.s-cno-c .s-cno-cab2 small{display:block;margin-top:.3cqw;font-size:1.6cqw;font-weight:600;color:#6B7280}
.s-cno-c h4{margin:.6cqw 0 0;display:flex;align-items:center;gap:.7cqw;font-size:1.5cqw;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6B7280}
.s-cno-c h4 svg{width:2cqw;height:2cqw}
.s-cno-c ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1.2cqw}
.s-cno-c li{display:flex;align-items:center;gap:1.1cqw;min-height:6.2cqw;padding:0 1.5cqw;border-radius:1.2cqw;font-size:2.05cqw;font-weight:700;white-space:nowrap;opacity:0;animation:${CICLO_C}s infinite}
.s-cno-c li span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.s-cno-tip{background:#EEF3FE;color:#1F3A7A}
.s-cno-tip i{flex:none;width:1.2cqw;height:1.2cqw;border-radius:50%;background:#2F6FED}
.s-cno-sube{background:#F6F8FB}
.s-cno-sube s{margin-left:auto;font-size:1.9cqw;font-weight:700;color:#9AA0A6;text-decoration-thickness:.15cqw}
.s-cno-sube .s-cno-pastilla{font-size:2cqw;min-width:5cqw}
.s-cno-sube em{flex:none;min-width:4.4cqw;text-align:right;font-style:normal;font-size:1.8cqw;font-weight:800;color:#137333}
.s-cno-flecha{align-self:center;justify-self:center;color:#2F6FED;opacity:0;animation:s-cno-c-flecha ${CICLO_C}s infinite}
.s-cno-flecha svg{display:block;width:4cqw;height:4cqw}
.s-cno-c .s-cno-antes{opacity:0;animation:s-cno-c-antes ${CICLO_C}s infinite}
.s-cno-c .s-cno-despues{opacity:0;animation:s-cno-c-despues ${CICLO_C}s infinite}
.s-cno-antes .s-cno-trazo{animation:s-cno-c-llena-a ${CICLO_C}s cubic-bezier(.4,0,.2,1) infinite}
.s-cno-despues .s-cno-trazo{animation:s-cno-c-llena-d ${CICLO_C}s cubic-bezier(.4,0,.2,1) infinite}
${entra('s-cno-c-antes', 0)}
${entra('s-cno-c-flecha', 36)}
${entra('s-cno-c-despues', 40)}
${llena('s-cno-c-llena-a', Math.round(antes.nota * 10), 2, 11)}
${llena('s-cno-c-llena-d', Math.round(despues.nota * 10), 44, 54)}
${coaching.map((_, i) => `.s-cno-tip[data-i="${i}"]{animation-name:s-cno-c-t${i}}.s-cno-sube[data-i="${i}"]{animation-name:s-cno-c-s${i}}${entra(`s-cno-c-t${i}`, ENTRA_TIP(i))}${entra(`s-cno-c-s${i}`, ENTRA_SUBE(i))}`).join('\n')}
/* En una caja chica (el teléfono) no entran lado a lado: el antes ocupa la caja, se va, y entra el después en su lugar. */
@container (max-width:480px){
.s-cno-c .s-cno-par{grid-template-columns:minmax(0,1fr);align-items:center}.s-cno-c .s-cno-card{grid-area:1/1;padding:3.6cqw 4cqw;gap:2.4cqw;border-radius:2.6cqw}.s-cno-flecha{display:none}
.s-cno-c .s-cno-antes{animation-name:s-cno-c-antes-tel}
@keyframes s-cno-c-antes-tel{0%{opacity:0;transform:translateY(1.2cqw)}3%,37%{opacity:1;transform:none}41%,100%{opacity:0;transform:translateX(-3cqw)}}
.s-cno-c .s-cno-anillo{width:15cqw}.s-cno-c .s-cno-anillo b{font-size:4.6cqw}.s-cno-c .s-cno-cab2{gap:3cqw}.s-cno-c .s-cno-cab2 p{font-size:4.6cqw}.s-cno-c .s-cno-cab2 small{font-size:3cqw}
.s-cno-c h4{font-size:2.9cqw}.s-cno-c h4 svg{width:3.6cqw;height:3.6cqw}.s-cno-c ul{gap:2cqw}
.s-cno-c li{font-size:3.7cqw;min-height:9.4cqw;padding:0 2.6cqw;border-radius:2cqw;gap:2cqw}.s-cno-tip i{width:2.2cqw;height:2.2cqw}
.s-cno-sube s{font-size:3.4cqw}.s-cno-sube .s-cno-pastilla{font-size:3.5cqw;min-width:8cqw;border-radius:1.2cqw}.s-cno-sube em{font-size:3.2cqw;min-width:7cqw}}
@media (prefers-reduced-motion:reduce){.s-cno-c .s-cno-card,.s-cno-c li,.s-cno-flecha,.s-cno-c .s-cno-trazo{animation:none;opacity:1}}
@media (prefers-reduced-motion:reduce){@container (max-width:480px){.s-cno-c .s-cno-antes{display:none}}}
`;

const Flecha = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function ClosingCoaching() {
  return (
    <div className="s-cno s-cno-c" data-tema-fijo="" role="img"
      aria-label={`Dos llamadas de venta de Mauricio analizadas por MaKo: en ${antes.mes.toLowerCase()}, ${nota(antes.nota)} y el coaching de MaKo; en ${despues.mes.toLowerCase()}, ${nota(despues.nota)}, con la nota más alta en lo que tocaba cada consejo`}>
      <style dangerouslySetInnerHTML={{ __html: CSS_BASE + CSS_C }} />
      <div className="s-cno-in">
        <div className="s-cno-par">
          <div className="s-cno-card s-cno-antes">
            <div className="s-cno-cab2"><Anillo l={antes} /><p>{antes.mes}<small>Llamada de {antes.min} min</small></p></div>
            <h4><Estrella />Coaching de MaKo</h4>
            <ul>
              {coaching.map((c, i) => <li key={c.tema} className="s-cno-tip" data-i={i}><i /><span>{c.tema}</span></li>)}
            </ul>
          </div>
          <span className="s-cno-flecha" aria-hidden="true"><Flecha /></span>
          <div className="s-cno-card s-cno-despues">
            <div className="s-cno-cab2"><Anillo l={despues} /><p>{despues.mes}<small>Llamada de {despues.min} min</small></p></div>
            <h4>Lo que mejoró</h4>
            <ul>
              {coaching.map((c, i) => {
                const a = notaDe(antes, c.d), b = notaDe(despues, c.d), t = tono(b);
                return (
                  <li key={c.d} className="s-cno-sube" data-i={i}>
                    <span>{CORTO[c.d] ?? c.d}</span>
                    <s>{coma(a)}</s><b className="s-cno-pastilla" style={{ '--f': t.f, '--t': t.t } as CSSProperties}>{coma(b)}</b>
                    <em>+{coma(b - a)}</em>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
