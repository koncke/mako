// =============================================================================
// Closing: una llamada como en Google Meet, con lo que MaKo va marcando, y antes el «antes y después» (16/11/2026)
// =============================================================================
// Martín: «me gustaría que aparezca algo así similar a Google Meet y que sea tipo objeciones, dolores, etcétera, y que al principio
// se vea un antes y después». Con dos llamadas de venta REALES de Mauricio (./closing-mauricio.ts): primero sus notas (septiembre →
// octubre) y después la llamada de octubre, donde MaKo marca el dolor, la implicación, la propuesta, la objeción respondida y el
// próximo paso, cada uno en el minuto real en que pasó. Sin nombres ni frases de terceros: el prospecto va con la cámara apagada
// (como en Meet, sin cara) y Mauricio con su foto, que es el caso público del sitio.
// Server component, sin JavaScript: todo es CSS en un bucle de 12 s, en unidades del contenedor (cqw), así entra igual en la fila
// de la computadora y en la del teléfono. `data-tema-fijo`: el sol y la luna no lo toca (Meet es oscuro en los dos modos).
import { CLOSING_MAURICIO } from './closing-mauricio';

const coma = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
const minuto = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const FOTO_MAURICIO = '/vsl-assets/sitio/avatar/mauricio-foto.jpg';

const CSS = `
.s-cad{container-type:inline-size;position:absolute;inset:0;background:#202124;color:#E8EAED;font-family:inherit;overflow:hidden}
.s-cad-in{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 30cqw;gap:2cqw;padding:2.4cqw 2.4cqw 9cqw}
.s-cad-tiles{display:grid;grid-template-columns:1fr 1fr;gap:1.6cqw;min-height:0}
.s-cad-tile{position:relative;border-radius:1.6cqw;overflow:hidden;background:#3C4043}
.s-cad-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.s-cad-apagada{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.s-cad-avatar{width:12cqw;height:12cqw;border-radius:50%;background:#8E6BFF;display:flex;align-items:center;justify-content:center}
.s-cad-avatar svg{width:7cqw;height:7cqw;fill:#fff}
.s-cad-nombre{position:absolute;left:1.2cqw;bottom:1.1cqw;font-size:1.9cqw;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.s-cad-habla{box-shadow:inset 0 0 0 .35cqw #8AB4F8}
.s-cad-panel{background:#fff;color:#12151B;border-radius:1.6cqw;padding:2cqw 1.8cqw;display:flex;flex-direction:column;gap:1.3cqw;min-height:0}
.s-cad-panel-t{display:flex;align-items:center;gap:1cqw;font-size:1.9cqw;font-weight:800}
.s-cad-panel-t svg{width:2.4cqw;height:2.4cqw}
.s-cad-vivo{margin-left:auto;font-size:1.5cqw;font-weight:700;color:#D93025}
.s-cad-chip{display:flex;align-items:center;gap:1cqw;padding:1.1cqw 1.3cqw;border-radius:1.2cqw;background:#F4F6FA;font-size:1.75cqw;font-weight:700;opacity:0;transform:translateY(1cqw);animation:12s infinite}
.s-cad-chip i{flex:none;width:1.3cqw;height:1.3cqw;border-radius:50%;background:var(--c)}
.s-cad-chip b{margin-left:auto;font-weight:600;color:#6B7280}
.s-cad-barra{position:absolute;left:0;right:0;bottom:0;height:7.5cqw;display:flex;align-items:center;justify-content:center;gap:1.6cqw}
.s-cad-boton{width:5cqw;height:5cqw;border-radius:50%;background:#3C4043;display:flex;align-items:center;justify-content:center}
.s-cad-boton svg{width:2.4cqw;height:2.4cqw;fill:#E8EAED}
.s-cad-colgar{width:7cqw;border-radius:99px;background:#EA4335}
.s-cad-hora{position:absolute;left:2.4cqw;bottom:2.6cqw;font-size:1.8cqw;font-weight:600;color:#BDC1C6}
.s-cad-intro{position:absolute;inset:0;z-index:2;background:rgba(32,33,36,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4cqw;animation:s-cad-intro 12s infinite}
.s-cad-intro-t{font-size:2.2cqw;font-weight:700;color:#BDC1C6;letter-spacing:.08em;text-transform:uppercase}
.s-cad-notas{display:flex;align-items:center;gap:3cqw}
.s-cad-nota{display:flex;flex-direction:column;align-items:center;gap:.6cqw}
.s-cad-mes{font-size:2cqw;font-weight:600;color:#9AA0A6}
.s-cad-n{font-size:10cqw;line-height:1;font-weight:800;letter-spacing:-.03em}
.s-cad-n-antes{color:#9AA0A6}
.s-cad-n-despues{color:#8AB4F8}
.s-cad-flecha svg{display:block;width:5cqw;height:5cqw;color:#5F6368}
/* El ciclo de 12 s: el antes y el después a la vista hasta los 2,7 s; después, uno por uno, lo que MaKo marca en la llamada. */
@keyframes s-cad-intro{0%,22%{opacity:1;visibility:visible}27%,96%{opacity:0;visibility:hidden}100%{opacity:1;visibility:visible}}
/* En una caja chica (el teléfono): sin la cámara apagada del prospecto, el panel más ancho y la letra más grande. */
@container (max-width:480px){.s-cad-in{grid-template-columns:minmax(0,1fr) 46cqw}.s-cad-tiles{grid-template-columns:1fr}.s-cad-tile+.s-cad-tile{display:none}
.s-cad-panel{overflow:hidden;gap:1.2cqw}.s-cad-chip{font-size:2.6cqw;padding:1.1cqw 1.6cqw;white-space:nowrap}.s-cad-chip:nth-child(4){display:none}.s-cad-chip i{width:2cqw;height:2cqw}.s-cad-panel-t{font-size:3cqw}.s-cad-vivo{font-size:2.4cqw}.s-cad-nombre,.s-cad-hora{font-size:2.8cqw}.s-cad-intro-t{font-size:3.4cqw}.s-cad-mes{font-size:3.2cqw}}
@media (prefers-reduced-motion:reduce){.s-cad-intro{display:none}.s-cad-chip{animation:none;opacity:1;transform:none}}
`;

/** Cada chip con SU tiempo en el ciclo de 12 s (entra a los 3,2 s + 1,15 s por chip y se van todos juntos al final): con un
 *  `animation-delay` por chip, los últimos se cruzaban de una vuelta a la otra. Los chips son los hijos 2.º en adelante del panel. */
const CSS_CHIPS = CLOSING_MAURICIO.llamada.momentos.map((_, i) => {
  const entra = Math.round(((3.2 + i * 1.15) / 12) * 1000) / 10;
  return `.s-cad-chip:nth-child(${i + 2}){animation-name:s-cad-chip-${i}}@keyframes s-cad-chip-${i}{0%,${entra}%{opacity:0;transform:translateY(1cqw)}${Math.round((entra + 3) * 10) / 10}%,92%{opacity:1;transform:none}96%,100%{opacity:0;transform:none}}`;
}).join('\n');

const COLOR: Record<string, string> = { dolor: '#EA4335', implicacion: '#F9AB00', propuesta: '#1A73E8', ok: '#34A853' };

export function ClosingAntesDespues() {
  const { antes, despues, llamada } = CLOSING_MAURICIO;
  return (
    <div className="s-cad" data-tema-fijo="" role="img"
      aria-label={`Una llamada de venta de Mauricio analizada por MaKo: de ${coma(antes.nota)} en ${antes.mes.toLowerCase()} a ${coma(despues.nota)} en ${despues.mes.toLowerCase()}, con el dolor, la objeción y el próximo paso marcados`}>
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_CHIPS }} />
      <div className="s-cad-in">
        <div className="s-cad-tiles">
          <div className="s-cad-tile s-cad-habla">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FOTO_MAURICIO} alt="" />
            <span className="s-cad-nombre">Mauricio</span>
          </div>
          <div className="s-cad-tile">
            <div className="s-cad-apagada"><span className="s-cad-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" /></svg></span></div>
            <span className="s-cad-nombre">Prospecto</span>
          </div>
        </div>
        <div className="s-cad-panel">
          <div className="s-cad-panel-t">
            <svg viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
            MaKo<span className="s-cad-vivo">● en vivo</span>
          </div>
          {llamada.momentos.map((m) => (
            <div key={m.parte} className="s-cad-chip" style={{ ['--c' as string]: COLOR[m.tono] }}>
              <i />{m.parte}<b>{minuto(m.segundo)}</b>
            </div>
          ))}
        </div>
      </div>
      <span className="s-cad-hora">{llamada.duracionMin}:00</span>
      <div className="s-cad-barra" aria-hidden="true">
        <span className="s-cad-boton"><svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" /></svg></span>
        <span className="s-cad-boton"><svg viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" /></svg></span>
        <span className="s-cad-boton s-cad-colgar"><svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.1.3-4.5.7v3.1c0 .4-.2.7-.6.9-1 .5-1.9 1.1-2.6 1.8-.2.2-.4.3-.7.3s-.5-.1-.7-.3L.3 13c-.2-.2-.3-.4-.3-.7s.1-.5.3-.7C3.3 8.8 7.4 7 12 7s8.7 1.8 11.7 4.6c.2.2.3.4.3.7s-.1.5-.3.7l-2.5 2.5c-.2.2-.4.3-.7.3s-.5-.1-.7-.3c-.8-.7-1.7-1.3-2.6-1.8-.3-.2-.6-.5-.6-.9V9.7C15.1 9.3 13.6 9 12 9Z" /></svg></span>
      </div>
      <div className="s-cad-intro" aria-hidden="true">
        <span className="s-cad-intro-t">Mauricio, con MaKo</span>
        <div className="s-cad-notas">
          <div className="s-cad-nota"><span className="s-cad-n s-cad-n-antes">{coma(antes.nota)}</span><span className="s-cad-mes">{antes.mes}</span></div>
          <span className="s-cad-flecha"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div className="s-cad-nota"><span className="s-cad-n s-cad-n-despues">{coma(despues.nota)}</span><span className="s-cad-mes">{despues.mes}</span></div>
        </div>
      </div>
    </div>
  );
}
