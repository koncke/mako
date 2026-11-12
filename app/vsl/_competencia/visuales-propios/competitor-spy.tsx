// El visual de la portada de /vsl/competitor-spy: la ficha de un competidor (ficticio) con sus canales, el funnel que usa
// con lo que lo delata, y sus anuncios guardados con desde cuándo están a la vista. Las piezas son las de la ficha de
// Competitor Spy (lib/funciones-mako.ts → 'market-an'). Sin fotos ni marcas reales.
const ANUNCIOS = [
  { gancho: '«Deja de perseguir clientes»', dias: 41, tono: 'a' },
  { gancho: '«3 errores al vender caro»', dias: 18, tono: 'b' },
  { gancho: '«Clase gratis el jueves»', dias: 6, tono: 'c' },
];

export default function VisualCompetitorSpy() {
  return (
    <div className="mk-v-spy" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mk-v-spy-ficha">
        <div className="mk-v-spy-cab">
          <span className="mk-v-spy-av">TC</span>
          <div className="mk-v-spy-nom">
            <strong>Tu competidor</strong>
            <span>3 canales · leídos por MaKo</span>
          </div>
        </div>
        <div className="mk-v-spy-canales">
          <span>Web</span><span>Instagram</span><span>YouTube</span>
        </div>
        <div className="mk-v-spy-funnel">
          <span className="mk-v-spy-funnel-r">Funnel</span>
          <strong>Webinar</strong>
          <span className="mk-v-spy-funnel-x">Lo delata: «Regístrate a la clase gratis» en su bio y en 2 anuncios</span>
        </div>
      </div>
      <div className="mk-v-spy-anuncios">
        <span className="mk-v-spy-anuncios-t">Anuncios guardados</span>
        <div className="mk-v-spy-grilla">
          {ANUNCIOS.map((a, i) => (
            <div key={a.gancho} className={`mk-v-spy-ad mk-v-spy-ad-${a.tono}`} style={{ animationDelay: `${(i * 0.5).toFixed(1)}s` }}>
              <span className="mk-v-spy-ad-img">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11 -7z" /></svg>
              </span>
              <span className="mk-v-spy-ad-g">{a.gancho}</span>
              <span className="mk-v-spy-ad-d">A la vista hace {a.dias} días</span>
            </div>
          ))}
        </div>
        <span className="mk-v-spy-boton">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4z" /></svg>
          Guardar en Spy
        </span>
      </div>
    </div>
  );
}

const CSS = `
.mk-v-spy { display: flex; flex-direction: column; gap: 12px; }
.mk-v-spy-ficha { padding: 16px; border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; display: flex; flex-direction: column; gap: 12px; }
.mk-v-spy-cab { display: flex; align-items: center; gap: 11px; }
.mk-v-spy-av { flex: none; width: 40px; height: 40px; border-radius: 12px; background: #12151B; color: #F2B01E; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; letter-spacing: .02em; }
.mk-v-spy-nom { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mk-v-spy-nom strong { font-size: 15px; color: #12151B; }
.mk-v-spy-nom span { font-size: 12px; color: #6B7280; }
.mk-v-spy-canales { display: flex; flex-wrap: wrap; gap: 6px; }
.mk-v-spy-canales span { padding: 4px 10px; border-radius: 999px; background: #EAF1FE; color: #2F6FED; font-size: 11.5px; font-weight: 600; }
.mk-v-spy-funnel { display: grid; grid-template-columns: auto 1fr; align-items: baseline; gap: 2px 10px; padding: 10px 12px; border-radius: 12px; background: #F5F8FD; border: 1px solid #EDF1F7; }
.mk-v-spy-funnel-r { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #8A93A2; }
.mk-v-spy-funnel strong { font-size: 14px; color: #12151B; }
.mk-v-spy-funnel-x { grid-column: 1 / -1; font-size: 12px; line-height: 1.45; color: #5B6472; }
.mk-v-spy-anuncios { padding: 14px; border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; display: flex; flex-direction: column; gap: 10px; }
.mk-v-spy-anuncios-t { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #8A93A2; }
.mk-v-spy-grilla { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.mk-v-spy-ad { min-width: 0; display: flex; flex-direction: column; gap: 6px; animation: mkVSpyEntra .6s ease both; }
.mk-v-spy-ad-img { aspect-ratio: 4 / 5; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,.9); }
.mk-v-spy-ad-a .mk-v-spy-ad-img { background: linear-gradient(160deg, #3B4A66, #1C2434); }
.mk-v-spy-ad-b .mk-v-spy-ad-img { background: linear-gradient(160deg, #5E86D6, #2F4F9A); }
.mk-v-spy-ad-c .mk-v-spy-ad-img { background: linear-gradient(160deg, #E3B35A, #A8722A); }
.mk-v-spy-ad-g { font-size: 11.5px; line-height: 1.35; font-weight: 600; color: #12151B; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.mk-v-spy-ad-d { font-size: 10.5px; color: #2F6FED; font-weight: 600; }
.mk-v-spy-boton { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 9px; background: #12151B; color: #fff; font-size: 12px; font-weight: 600; }
@keyframes mkVSpyEntra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .mk-v-spy-ad { animation: none; } }
@media (max-width: 480px) {
  .mk-v-spy-ficha, .mk-v-spy-anuncios { padding: 12px; }
  .mk-v-spy-grilla { gap: 6px; }
  .mk-v-spy-ad-g { font-size: 10.5px; }
}
`;
