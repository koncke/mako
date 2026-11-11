// =============================================================================
// El visual de la portada de /vsl/offer: MaKo preguntando por una pieza y la oferta en PDF con su diagnóstico
// =============================================================================
// La pantalla de Offer en chico: el chat donde MaKo pregunta por una pieza (la pregunta, los nombres de las piezas y de
// las partes de la rúbrica salen de lib/offer-marco.ts, PREGUNTAS_GUIA, PIEZAS y DIMENSIONES), y al lado el PDF de la
// oferta con las barras de la rúbrica y un dato «a completar», que es lo que MaKo deja cuando no se lo dijeron. Las barras
// NO llevan números y la tarjeta dice «Ejemplo»: no es una nota medida. La respuesta y el nombre de la oferta son un
// ejemplo genérico, sin negocios reales. Server component sin JavaScript; la animación es CSS y se apaga con «reducir
// movimiento».
// =============================================================================

import { DIMENSIONES, PREGUNTAS_GUIA, piezaLabel, type PiezaKey } from '@/lib/offer-marco';

const PREGUNTA = PREGUNTAS_GUIA.find((p) => p.pieza === 'semana')?.pregunta ?? '';
/** Las piezas del riel: las tres primeras ya contestadas, la de la pregunta abierta y la que sigue. */
const RIEL: ReadonlyArray<{ k: PiezaKey; estado: 'ok' | 'ahora' | 'falta' }> = [
  { k: 'cliente', estado: 'ok' }, { k: 'problema', estado: 'ok' }, { k: 'resultado', estado: 'ok' },
  { k: 'semana', estado: 'ahora' }, { k: 'precio', estado: 'falta' },
];
/** Tres partes de la rúbrica, con el largo de su barra (de ejemplo: la tarjeta lo dice). */
const BARRAS: ReadonlyArray<{ label: string; ancho: number }> = [
  { label: DIMENSIONES[0].label, ancho: 78 },
  { label: DIMENSIONES[1].label, ancho: 58 },
  { label: DIMENSIONES[3].label, ancho: 34 },
];

const CSS = `
.mk-v-offer { width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 12px; align-items: stretch; font-family: inherit; }
.mk-v-offer-chat { flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: 9px; padding: 12px; border-radius: 14px; background: #fff; border: 1px solid #E3EAF6; }
.mk-v-offer-msg { display: flex; gap: 8px; align-items: flex-start; }
.mk-v-offer-av { flex: none; width: 24px; height: 24px; border-radius: 8px; background: #1A1712; display: flex; align-items: center; justify-content: center; }
.mk-v-offer-burbuja { margin: 0; padding: 8px 10px; border-radius: 4px 12px 12px 12px; background: #F2F6FD; font-size: 12px; line-height: 1.42; color: #12151B; }
.mk-v-offer-tu { justify-content: flex-end; }
.mk-v-offer-tu .mk-v-offer-burbuja { border-radius: 12px 4px 12px 12px; background: #2F6FED; color: #fff; max-width: 85%; }
.mk-v-offer-riel { margin-top: auto; padding-top: 8px; border-top: 1px solid #EEF2F8; display: flex; flex-wrap: wrap; gap: 5px; }
.mk-v-offer-pieza { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 999px; font-size: 10px; font-weight: 600; background: #F1F4F9; color: #8A93A2; }
.mk-v-offer-pieza-ok { background: #EAF1FE; color: #2F6FED; }
.mk-v-offer-pieza-ahora { background: #12151B; color: #fff; }
.mk-v-offer-pdf { flex: 1 1 190px; min-width: 0; display: flex; flex-direction: column; gap: 8px; padding: 12px 13px; border-radius: 14px; background: #fff; border: 1px solid #E3EAF6; box-shadow: 0 22px 46px -30px rgba(16,19,25,.5); }
.mk-v-offer-pdf-cab { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.mk-v-offer-pdf-t { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #5B6472; }
.mk-v-offer-pdf-ic { width: 18px; height: 18px; border-radius: 5px; background: #FCEBEC; color: #DC2626; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; letter-spacing: 0; }
.mk-v-offer-ejemplo { padding: 2px 7px; border-radius: 999px; background: #F1F4F9; color: #8A93A2; font-size: 9.5px; font-weight: 600; }
.mk-v-offer-nombre { margin: 2px 0 0; font-size: 14px; line-height: 1.25; font-weight: 700; letter-spacing: -0.01em; color: #12151B; }
.mk-v-offer-frase { margin: 0; font-size: 11px; line-height: 1.42; color: #5B6472; }
.mk-v-offer-barras { display: flex; flex-direction: column; gap: 6px; margin-top: 2px; }
.mk-v-offer-barra { display: flex; flex-direction: column; gap: 3px; }
.mk-v-offer-barra-l { font-size: 10px; font-weight: 600; color: #2E3646; }
.mk-v-offer-carril { height: 6px; border-radius: 999px; background: #EEF2F8; overflow: hidden; }
.mk-v-offer-lleno { display: block; height: 100%; border-radius: 999px; background: #2F6FED; transform-origin: left center; }
.mk-v-offer-falta { margin-top: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 10.5px; color: #5B6472; }
.mk-v-offer-completar { padding: 2px 7px; border-radius: 6px; background: #FFF1D6; color: #8A5A00; font-size: 10px; font-weight: 600; }

.mk-v-offer-tu, .mk-v-offer-pdf { animation: mkVofEntra .5s ease both; }
.mk-v-offer-tu { animation-delay: .6s; }
.mk-v-offer-pdf { animation-delay: 1.1s; }
.mk-v-offer-lleno { animation: mkVofBarra .9s ease both; animation-delay: 1.5s; }
@keyframes mkVofEntra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes mkVofBarra { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) { .mk-v-offer-tu, .mk-v-offer-pdf, .mk-v-offer-lleno { animation: none; } }

@media (max-width: 480px) {
  .mk-v-offer-burbuja { font-size: 11.5px; }
}
`;

const Estrella = () => (
  <svg width="12" height="12" viewBox="-12 -12 24 24"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
);

export default function VisualOffer() {
  return (
    <div className="mk-v-offer" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mk-v-offer-chat">
        <div className="mk-v-offer-msg">
          <span className="mk-v-offer-av"><Estrella /></span>
          <p className="mk-v-offer-burbuja">{PREGUNTA}</p>
        </div>
        <div className="mk-v-offer-msg mk-v-offer-tu">
          <p className="mk-v-offer-burbuja">Hace su primera llamada de venta con el guion nuevo.</p>
        </div>
        <div className="mk-v-offer-riel">
          {RIEL.map((r) => (
            <span key={r.k} className={`mk-v-offer-pieza mk-v-offer-pieza-${r.estado}`}>{r.estado === 'ok' ? '✓ ' : ''}{piezaLabel(r.k)}</span>
          ))}
        </div>
      </div>

      <div className="mk-v-offer-pdf">
        <div className="mk-v-offer-pdf-cab">
          <span className="mk-v-offer-pdf-t"><span className="mk-v-offer-pdf-ic">PDF</span>Tu oferta</span>
          <span className="mk-v-offer-ejemplo">Ejemplo</span>
        </div>
        <p className="mk-v-offer-nombre">Programa de cierre de ventas</p>
        <p className="mk-v-offer-frase">Para coaches que venden por llamada y quieren cerrar más.</p>
        <div className="mk-v-offer-barras">
          {BARRAS.map((b) => (
            <div key={b.label} className="mk-v-offer-barra">
              <span className="mk-v-offer-barra-l">{b.label}</span>
              <span className="mk-v-offer-carril"><span className="mk-v-offer-lleno" style={{ width: `${b.ancho}%` }} /></span>
            </div>
          ))}
        </div>
        <div className="mk-v-offer-falta">Casos de clientes <span className="mk-v-offer-completar">a completar</span></div>
      </div>
    </div>
  );
}
