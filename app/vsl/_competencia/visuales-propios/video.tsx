// El visual de la portada de /vsl/video: el clip vertical con sus subtítulos, la lista de la «Edición automática» que se va
// tildando, y la línea de tiempo con las pausas cortadas. Los pasos son los de la Edición automática
// (app/video-editor/_opencut/enjambre/), con los nombres de la pantalla. Sin fotos: la persona es una silueta.
const PASOS = ['Quitar las pausas', 'Subtítulos', 'B-roll de MaKo', 'El volumen'];
const FRASE = 'Si tu video no engancha en tres segundos lo pasan';

export default function VisualVideo() {
  const palabras = FRASE.split(' ');
  return (
    <div className="mk-v-video" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mk-v-video-arriba">
        <div className="mk-v-video-tel">
          <div className="mk-v-video-escena">
            <span className="mk-v-video-pill">Reel · 9:16</span>
            <svg className="mk-v-video-sil" viewBox="0 0 120 150" preserveAspectRatio="xMidYMax meet">
              <circle cx="60" cy="52" r="24" fill="#22304A" />
              <path d="M14 150c0-34 20-58 46-58s46 24 46 58z" fill="#22304A" />
            </svg>
            <p className="mk-v-video-sub">
              {palabras.map((p, i) => (
                <span key={i} style={{ animationDelay: `${(i * 0.3).toFixed(2)}s`, animationDuration: `${(palabras.length * 0.3 + 1.5).toFixed(2)}s` }}>{p} </span>
              ))}
            </p>
          </div>
        </div>
        <div className="mk-v-video-panel">
          <span className="mk-v-video-panel-t">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 21l15 -15l-3 -3l-15 15l3 3" /><path d="M15 6l3 3" /></svg>
            Edición automática
          </span>
          <ul className="mk-v-video-pasos">
            {PASOS.map((p, i) => (
              <li key={p} style={{ animationDelay: `${(0.6 + i * 0.9).toFixed(1)}s` }}>
                <span className="mk-v-video-tilde"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5l10 -10" /></svg></span>
                {p}
              </li>
            ))}
          </ul>
          <span className="mk-v-video-nota">Lo ves pasar en el editor</span>
        </div>
      </div>
      <div className="mk-v-video-linea">
        <span className="mk-v-video-linea-t">Línea de tiempo</span>
        <div className="mk-v-video-pista">
          <span className="mk-v-video-clip" style={{ flex: 3 }} />
          <span className="mk-v-video-pausa" style={{ flex: 1 }}>pausa</span>
          <span className="mk-v-video-clip" style={{ flex: 4 }} />
          <span className="mk-v-video-pausa" style={{ flex: 1.2 }}>pausa</span>
          <span className="mk-v-video-clip" style={{ flex: 2.6 }} />
        </div>
        <div className="mk-v-video-pista mk-v-video-pista-sub">
          <span style={{ flex: 2 }}>Si tu video</span>
          <span style={{ flex: 2.4 }}>no engancha</span>
          <span style={{ flex: 2.6 }}>en tres segundos</span>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.mk-v-video { display: flex; flex-direction: column; gap: 14px; }
.mk-v-video-arriba { display: flex; align-items: center; justify-content: center; gap: 16px; }
.mk-v-video-tel { flex: none; width: 168px; aspect-ratio: 9 / 16; padding: 6px; border-radius: 26px; background: #12151B; box-shadow: 0 24px 50px -28px rgba(16,19,25,.6); }
.mk-v-video-escena { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 21px; background: linear-gradient(165deg, #CFE0FB 0%, #9DBCF2 45%, #5E86D6 100%); }
.mk-v-video-pill { position: absolute; top: 10px; left: 10px; z-index: 2; padding: 4px 8px; border-radius: 999px; background: rgba(16,19,25,.55); color: #fff; font-size: 10px; font-weight: 600; }
.mk-v-video-sil { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 70%; }
.mk-v-video-sub { position: absolute; left: 10px; right: 10px; bottom: 14px; z-index: 2; margin: 0; text-align: center; font-size: 12.5px; line-height: 1.35; font-weight: 800; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.55); }
.mk-v-video-sub span { animation-name: mkVVideoPalabra; animation-iteration-count: infinite; animation-timing-function: steps(1, end); }
@keyframes mkVVideoPalabra { 0% { color: #fff; } 6% { color: #F2B01E; } 18%, 100% { color: #fff; } }
.mk-v-video-panel { flex: 1; min-width: 0; max-width: 230px; display: flex; flex-direction: column; gap: 10px; padding: 16px 14px; border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; }
.mk-v-video-panel-t { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: #2F6FED; }
.mk-v-video-pasos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.mk-v-video-pasos li { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: #12151B; animation: mkVVideoPaso 6s infinite both; }
.mk-v-video-tilde { flex: none; width: 18px; height: 18px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: #EAF1FE; color: #2F6FED; }
@keyframes mkVVideoPaso { 0% { opacity: .35; } 8%, 92% { opacity: 1; } 100% { opacity: .35; } }
.mk-v-video-nota { font-size: 11.5px; color: #8A93A2; }
.mk-v-video-linea { padding: 12px 12px 14px; border-radius: 14px; background: #fff; border: 1px solid #E3EAF6; display: flex; flex-direction: column; gap: 7px; }
.mk-v-video-linea-t { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #8A93A2; }
.mk-v-video-pista { display: flex; gap: 3px; height: 26px; }
.mk-v-video-clip { border-radius: 6px; background: linear-gradient(90deg, #2F6FED, #5B8CF0); }
.mk-v-video-pausa { border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #DC2626; background: repeating-linear-gradient(135deg, #FCEBEC 0 6px, #F9D8DA 6px 12px); text-decoration: line-through; }
.mk-v-video-pista-sub { height: 22px; }
.mk-v-video-pista-sub span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding: 0 7px; border-radius: 6px; background: #FFF4D6; color: #7A5A00; font-size: 10.5px; font-weight: 600; line-height: 22px; }
@media (prefers-reduced-motion: reduce) { .mk-v-video-sub span, .mk-v-video-pasos li { animation: none; } }
@media (max-width: 480px) {
  .mk-v-video-arriba { gap: 10px; }
  .mk-v-video-tel { width: 128px; }
  .mk-v-video-sub { font-size: 10.5px; }
  .mk-v-video-panel { padding: 12px 10px; }
  .mk-v-video-pasos li { font-size: 12px; }
}
`;
