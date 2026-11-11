// El visual de la portada de /vsl/ads (Marketing CoPilot): lo que le escribes a MaKo y lo que te propone, una decisión del
// día con su porqué, los números que la dispararon y los dos botones (aprobar o descartar). Es la forma de una decisión del
// Media Buyer (lib/media-buyer/): qué cambia, por qué y la tabla de números. El anuncio y los números son de ejemplo.
export default function VisualCopiloto() {
  return (
    <div className="mk-v-ads" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mk-v-ads-yo">MaKo, quiero que mis anuncios traigan más agendas</div>
      <div className="mk-v-ads-mako">
        <span className="mk-v-ads-est">
          <svg width="14" height="14" viewBox="-12 -12 24 24"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
        </span>
        <div className="mk-v-ads-resp">
          <p className="mk-v-ads-txt">Hoy te propongo esto. Lo apruebas tú.</p>
          <div className="mk-v-ads-dec">
            <div className="mk-v-ads-dec-cab">
              <span className="mk-v-ads-chip">Subir presupuesto</span>
              <span className="mk-v-ads-ad">«VSL · Dolor»</span>
            </div>
            <p className="mk-v-ads-por">Agenda más barato que tu objetivo hace 3 días, y dos de sus leads ya cerraron.</p>
            <div className="mk-v-ads-tabla">
              <span>Por agenda</span><strong>$38</strong>
              <span>Tu objetivo</span><strong>$60</strong>
              <span>Cerraron</span><strong>2</strong>
            </div>
            <div className="mk-v-ads-botones">
              <span className="mk-v-ads-si">Aprobar</span>
              <span className="mk-v-ads-no">Descartar</span>
            </div>
          </div>
          <span className="mk-v-ads-nota">Con su deshacer · dentro de tus topes</span>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.mk-v-ads { display: flex; flex-direction: column; gap: 14px; }
.mk-v-ads-yo { align-self: flex-end; max-width: 82%; padding: 11px 14px; border-radius: 16px 16px 4px 16px; background: #2F6FED; color: #fff; font-size: 14px; line-height: 1.45; font-weight: 500; animation: mkVAdsEntra .5s ease both; }
.mk-v-ads-mako { display: flex; align-items: flex-start; gap: 10px; animation: mkVAdsEntra .5s .5s ease both; }
.mk-v-ads-est { flex: none; width: 30px; height: 30px; border-radius: 9px; background: #1A1712; display: flex; align-items: center; justify-content: center; }
.mk-v-ads-resp { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.mk-v-ads-txt { margin: 4px 0 0; font-size: 14px; line-height: 1.45; color: #12151B; font-weight: 500; }
.mk-v-ads-dec { padding: 14px; border-radius: 14px; background: #fff; border: 1px solid #CFDDFB; box-shadow: 0 18px 40px -28px rgba(47,111,237,.5); display: flex; flex-direction: column; gap: 10px; }
.mk-v-ads-dec-cab { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.mk-v-ads-chip { padding: 4px 9px; border-radius: 999px; background: #E7F6EC; color: #15803D; font-size: 11.5px; font-weight: 700; }
.mk-v-ads-ad { font-size: 13px; font-weight: 600; color: #12151B; }
.mk-v-ads-por { margin: 0; font-size: 12.5px; line-height: 1.5; color: #4A515E; }
.mk-v-ads-tabla { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 8px; padding: 9px 10px; border-radius: 10px; background: #F5F8FD; }
.mk-v-ads-tabla span { grid-row: 1; font-size: 10.5px; color: #8A93A2; font-weight: 600; }
.mk-v-ads-tabla strong { grid-row: 2; font-size: 15px; color: #12151B; font-variant-numeric: tabular-nums; }
.mk-v-ads-botones { display: flex; gap: 8px; }
.mk-v-ads-si, .mk-v-ads-no { padding: 7px 14px; border-radius: 9px; font-size: 12.5px; font-weight: 600; }
.mk-v-ads-si { background: #2F6FED; color: #fff; }
.mk-v-ads-no { background: #fff; color: #5B6472; border: 1px solid #E3EAF6; }
.mk-v-ads-nota { font-size: 11.5px; color: #8A93A2; }
@keyframes mkVAdsEntra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .mk-v-ads-yo, .mk-v-ads-mako { animation: none; } }
@media (max-width: 480px) {
  .mk-v-ads-yo, .mk-v-ads-txt { font-size: 13px; }
  .mk-v-ads-dec { padding: 11px; }
}
`;
