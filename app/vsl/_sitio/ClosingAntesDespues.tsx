// =============================================================================
// Closing: una llamada como en Google Meet, con lo que MaKo va marcando, y antes el «antes y después» (16/11/2026)
// =============================================================================
// Martín: «me gustaría que aparezca algo así similar a Google Meet y que sea tipo objeciones, dolores, etcétera, y que al principio
// se vea un antes y después». Con dos llamadas de venta REALES de Mauricio (./closing-mauricio.ts): primero sus notas (septiembre →
// octubre) y después la llamada de octubre, donde MaKo marca el dolor, la implicación, la propuesta, la objeción respondida y el
// próximo paso, cada uno en el minuto real en que pasó. Sin nombres ni frases de terceros: el prospecto va con la cámara apagada
// (como en Meet, con la inicial en un círculo) y Mauricio con su foto, que es el caso público del sitio.
// Y después: «copia como normalmente son las cartas de Google Meet. No son tan alargadas, son como más horizontales». Las
// tarjetas son de 16:9 y la foto de Mauricio es su retrato llevado a 16:9 (mauricio-meet.jpg: el retrato al medio y el fondo
// gris de la foto estirado a los costados, como el cuadro de una cámara).
// Server component, sin JavaScript: todo es CSS en un bucle de 12 s, en unidades del contenedor (cqw), así entra igual en la fila
// de la computadora y en la del teléfono. `data-tema-fijo`: el sol y la luna no lo toca (Meet es oscuro en los dos modos).
import { CLOSING_MAURICIO } from './closing-mauricio';

const coma = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
const minuto = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const FOTO_MAURICIO = '/vsl-assets/sitio/avatar/mauricio-meet.jpg';

const CSS = `
.s-cad{container-type:inline-size;position:absolute;inset:0;background:#202124;color:#E8EAED;font-family:inherit;overflow:hidden}
.s-cad-in{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 34cqw;gap:2cqw;padding:2.4cqw 2.4cqw 9cqw}
/* Las tarjetas como las de Meet: 16:9 y del tamaño más grande que entra, que en este alto es una arriba de la otra y centradas
   (así las acomoda Meet). La caja es de 16:10 (62,5cqw de alto): entre el margen de arriba y la barra quedan 51,1cqw, y dos de
   44cqw de ancho (24,75 de alto) con su espacio entran. */
.s-cad-tiles{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4cqw;min-height:0}
.s-cad-tile{position:relative;flex:none;width:44cqw;aspect-ratio:16/9;border-radius:1.2cqw;overflow:hidden;background:#3C4043}
.s-cad-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.s-cad-tile::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 .3cqw #8AB4F8;opacity:0}
.s-cad-apagada{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.s-cad-avatar{width:9.5cqw;height:9.5cqw;border-radius:50%;background:#7B61FF;color:#fff;font-size:4.6cqw;font-weight:500;display:flex;align-items:center;justify-content:center}
.s-cad-nombre{position:absolute;left:1.2cqw;bottom:1cqw;font-size:1.7cqw;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}
/* Quién habla, como en Meet: el borde celeste y el círculo azul con tres barritas arriba a la derecha. El prospecto mientras
   cuenta el dolor y la implicación (del 27 % al 44 % del ciclo); el resto del tiempo, Mauricio. */
.s-cad-ola{position:absolute;top:1cqw;right:1cqw;width:3cqw;height:3cqw;border-radius:50%;background:#1A73E8;display:flex;align-items:center;justify-content:center;gap:.32cqw;opacity:0}
.s-cad-ola i{width:.42cqw;height:.42cqw;border-radius:.3cqw;background:#fff;animation:s-cad-ola .5s ease-in-out infinite alternate}
.s-cad-ola i:nth-child(2){animation-delay:-.25s}
.s-cad-ola i:nth-child(3){animation-delay:-.4s}
@keyframes s-cad-ola{to{height:1.5cqw}}
.s-cad-tile-a::after,.s-cad-tile-a .s-cad-ola{animation:s-cad-a 12s infinite}
.s-cad-tile-b::after,.s-cad-tile-b .s-cad-ola{animation:s-cad-b 12s infinite}
@keyframes s-cad-a{0%,26%{opacity:1}28%,43%{opacity:0}45%,100%{opacity:1}}
@keyframes s-cad-b{0%,26%{opacity:0}28%,43%{opacity:1}45%,100%{opacity:0}}
.s-cad-panel{background:#fff;color:#12151B;border-radius:1.2cqw;padding:2cqw 1.8cqw;display:flex;flex-direction:column;gap:1.3cqw;min-height:0}
.s-cad-panel-t{display:flex;align-items:center;gap:1cqw;font-size:1.9cqw;font-weight:800}
.s-cad-panel-t svg{width:2.4cqw;height:2.4cqw}
.s-cad-vivo{margin-left:auto;font-size:1.5cqw;font-weight:700;color:#D93025}
.s-cad-chip{display:flex;align-items:center;gap:1cqw;padding:1.1cqw 1.3cqw;border-radius:1.2cqw;background:#F4F6FA;font-size:1.8cqw;font-weight:700;opacity:0;transform:translateY(1cqw);animation:12s infinite}
.s-cad-chip i{flex:none;width:1.3cqw;height:1.3cqw;border-radius:50%;background:var(--c)}
.s-cad-chip b{margin-left:auto;font-weight:600;color:#6B7280}
/* La barra de Meet: la hora a la izquierda; al medio el micrófono, la cámara, los subtítulos, levantar la mano, presentar, más y
   colgar (la píldora roja); a la derecha los detalles, las personas, el chat, las actividades y MaKo (abierto: resaltado). */
.s-cad-barra{position:absolute;left:2.4cqw;right:2.4cqw;bottom:0;height:7.5cqw;display:grid;grid-template-columns:1fr auto 1fr;align-items:center}
.s-cad-hora{font-size:1.7cqw;font-weight:600;color:#E8EAED}
.s-cad-botones{display:flex;align-items:center;gap:1cqw}
.s-cad-boton{width:4.4cqw;height:4.4cqw;border-radius:50%;background:#3C4043;display:flex;align-items:center;justify-content:center}
.s-cad-boton svg,.s-cad-icono svg{width:2.2cqw;height:2.2cqw;fill:#E8EAED}
.s-cad-colgar{width:6.4cqw;border-radius:99px;background:#EA4335}
.s-cad-der{justify-self:end;display:flex;align-items:center;gap:.6cqw}
.s-cad-icono{width:4cqw;height:4cqw;border-radius:50%;display:flex;align-items:center;justify-content:center}
.s-cad-icono-on{background:rgba(138,180,248,.24)}
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
/* En una caja chica (el teléfono): las dos tarjetas igual (entran: 44cqw al lado de un panel de 46cqw), el panel más ancho, la
   letra más grande y en la barra sólo el micrófono, la cámara, más, colgar y MaKo. */
@container (max-width:480px){.s-cad-in{grid-template-columns:minmax(0,1fr) 46cqw}
.s-cad-panel{overflow:hidden;gap:1.2cqw}.s-cad-chip{font-size:2.6cqw;padding:1.1cqw 1.6cqw;white-space:nowrap}.s-cad-chip:nth-child(4){display:none}.s-cad-chip i{width:2cqw;height:2cqw}.s-cad-panel-t{font-size:3cqw}.s-cad-vivo{font-size:2.4cqw}.s-cad-nombre,.s-cad-hora{font-size:2.8cqw}.s-cad-ola{width:4cqw;height:4cqw}.s-cad-intro-t{font-size:3.4cqw}.s-cad-mes{font-size:3.2cqw}
.s-cad-cc,.s-cad-mano,.s-cad-pres,.s-cad-der .s-cad-icono:not(.s-cad-icono-on){display:none}.s-cad-boton,.s-cad-icono{width:6cqw;height:6cqw}.s-cad-boton svg,.s-cad-icono svg{width:3cqw;height:3cqw}.s-cad-colgar{width:8.6cqw}}
@media (prefers-reduced-motion:reduce){.s-cad-intro{display:none}.s-cad-chip{animation:none;opacity:1;transform:none}.s-cad-tile-a::after,.s-cad-tile-a .s-cad-ola{animation:none;opacity:1}.s-cad-tile-b::after,.s-cad-tile-b .s-cad-ola{animation:none}.s-cad-ola i{animation:none;height:1cqw}}
`;

/** Cada chip con SU tiempo en el ciclo de 12 s (entra a los 3,2 s + 1,15 s por chip y se van todos juntos al final): con un
 *  `animation-delay` por chip, los últimos se cruzaban de una vuelta a la otra. Los chips son los hijos 2.º en adelante del panel. */
const CSS_CHIPS = CLOSING_MAURICIO.llamada.momentos.map((_, i) => {
  const entra = Math.round(((3.2 + i * 1.15) / 12) * 1000) / 10;
  return `.s-cad-chip:nth-child(${i + 2}){animation-name:s-cad-chip-${i}}@keyframes s-cad-chip-${i}{0%,${entra}%{opacity:0;transform:translateY(1cqw)}${Math.round((entra + 3) * 10) / 10}%,92%{opacity:1;transform:none}96%,100%{opacity:0;transform:none}}`;
}).join('\n');

const COLOR: Record<string, string> = { dolor: '#EA4335', implicacion: '#F9AB00', propuesta: '#1A73E8', ok: '#34A853' };

/** Los íconos de la barra de Meet (los de Material, en 24×24). */
const ICONO = {
  mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z',
  cam: 'M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z',
  cc: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
  mano: 'M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z',
  presentar: 'M21 3H3c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h18c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 16.02H3V4.98h18v14.04zM10 12H8l4-4 4 4h-2v4h-4v-4z',
  mas: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  colgar: 'M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z',
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  personas: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  chat: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z',
  actividades: 'M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z',
} as const;
const ESTRELLA = 'M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z';

const Boton = ({ d, clase = '' }: { d: string; clase?: string }) => (
  <span className={`s-cad-boton${clase ? ` ${clase}` : ''}`}><svg viewBox="0 0 24 24"><path d={d} /></svg></span>
);

export function ClosingAntesDespues() {
  const { antes, despues, llamada } = CLOSING_MAURICIO;
  return (
    <div className="s-cad" data-tema-fijo="" role="img"
      aria-label={`Una llamada de venta de Mauricio analizada por MaKo: de ${coma(antes.nota)} en ${antes.mes.toLowerCase()} a ${coma(despues.nota)} en ${despues.mes.toLowerCase()}, con el dolor, la objeción y el próximo paso marcados`}>
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_CHIPS }} />
      <div className="s-cad-in">
        <div className="s-cad-tiles">
          <div className="s-cad-tile s-cad-tile-a">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FOTO_MAURICIO} alt="" />
            <span className="s-cad-ola"><i /><i /><i /></span>
            <span className="s-cad-nombre">Mauricio</span>
          </div>
          <div className="s-cad-tile s-cad-tile-b">
            <div className="s-cad-apagada"><span className="s-cad-avatar">P</span></div>
            <span className="s-cad-ola"><i /><i /><i /></span>
            <span className="s-cad-nombre">Prospecto</span>
          </div>
        </div>
        <div className="s-cad-panel">
          <div className="s-cad-panel-t">
            <svg viewBox="-12 -12 24 24" aria-hidden="true"><path d={ESTRELLA} fill="#F2B01E" /></svg>
            MaKo<span className="s-cad-vivo">● en vivo</span>
          </div>
          {llamada.momentos.map((m) => (
            <div key={m.parte} className="s-cad-chip" style={{ ['--c' as string]: COLOR[m.tono] }}>
              <i />{m.parte}<b>{minuto(m.segundo)}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="s-cad-barra" aria-hidden="true">
        <span className="s-cad-hora">{llamada.duracionMin}:00</span>
        <div className="s-cad-botones">
          <Boton d={ICONO.mic} />
          <Boton d={ICONO.cam} />
          <Boton d={ICONO.cc} clase="s-cad-cc" />
          <Boton d={ICONO.mano} clase="s-cad-mano" />
          <Boton d={ICONO.presentar} clase="s-cad-pres" />
          <Boton d={ICONO.mas} />
          <Boton d={ICONO.colgar} clase="s-cad-colgar" />
        </div>
        <div className="s-cad-der">
          {[ICONO.info, ICONO.personas, ICONO.chat, ICONO.actividades].map((d) => (
            <span key={d} className="s-cad-icono"><svg viewBox="0 0 24 24"><path d={d} /></svg></span>
          ))}
          <span className="s-cad-icono s-cad-icono-on"><svg viewBox="-12 -12 24 24"><path d={ESTRELLA} fill="#F2B01E" /></svg></span>
        </div>
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
