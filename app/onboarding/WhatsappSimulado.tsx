'use client';
// =============================================================================
// EL LADO DE WHATSAPP, SIMULADO (21/11/2026; sólo en la revisión)
// =============================================================================
// Martín, probando en el ws 3: «Yo quiero ver exactamente igual lo que recibe el usuario». En la revisión el paso del WhatsApp corre el
// camino de un número NUEVO, y «Abrir WhatsApp» abre esto en vez de wa.me: el pedido que manda la persona y lo que MaKo le contesta,
// en su orden (lib/mako-grupo.ts → `mandarCodigoV2`: el código, su tarjeta y «Guárdame…»), con los textos de verdad
// (lib/onboarding-v2/whatsapp-simulado.ts). «Pegar el código» lo deja en la caja, como si lo hubiera copiado de WhatsApp.
// Nunca a un cliente: la vista sólo trae `simulado` con la puerta de la revisión.
// =============================================================================
import { createPortal } from 'react-dom';
import { Button } from '@/app/_ui';

type Simulado = { pedido: string; respuesta: string; agendar: string; codigo: string };

export function WhatsappSimulado({ simulado, onPegar, onCerrar }: { simulado: Simulado; onPegar: (codigo: string) => void; onCerrar: () => void }) {
  return createPortal(
    <div className="wsim" role="dialog" aria-modal="true" aria-label="WhatsApp, simulado" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <style>{CSS}</style>
      <div className="wsim__panel">
        <header className="wsim__cab">
          <span className="wsim__foto" aria-hidden="true">M</span>
          <span className="wsim__quien"><b>MaKo</b><small>WhatsApp · simulado</small></span>
          <button type="button" className="wsim__x" aria-label="Cerrar" onClick={onCerrar}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
          </button>
        </header>
        <div className="wsim__hilo">
          <p className="wsim__msj wsim__msj--yo">{simulado.pedido}</p>
          <p className="wsim__msj">{simulado.respuesta}</p>
          <div className="wsim__msj wsim__tarjeta"><span className="wsim__foto" aria-hidden="true">M</span><span><b>MaKo</b><small>Guardar contacto</small></span></div>
          <p className="wsim__msj">{simulado.agendar}</p>
        </div>
        <p className="wsim__nota">Revisión: así lo ve la persona en su WhatsApp. No se mandó nada.</p>
        <div className="wsim__pie"><Button variant="primary" size="sm" onClick={() => onPegar(simulado.codigo)}>Pegar el código</Button></div>
      </div>
    </div>,
    document.body,
  );
}

const CSS = `
.wsim { position: fixed; inset: 0; z-index: 3500; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,.55); }
.wsim__panel { width: min(420px, 100%); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; border-radius: 16px; overflow: hidden; background: #0b141a; color: #e9edef; box-shadow: 0 24px 60px rgba(0,0,0,.45); }
.wsim__cab { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #202c33; }
.wsim__foto { flex: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #F2B01E; color: #171511; font-weight: 800; }
.wsim__quien { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.wsim__quien small, .wsim__tarjeta small { color: #8696a0; font-size: 12px; }
.wsim__x { flex: none; width: 32px; height: 32px; border: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: transparent; color: #f15c6d; cursor: pointer; }
.wsim__x:hover { background: rgba(241,92,109,.12); }
.wsim__hilo { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 14px 12px; }
.wsim__msj { margin: 0; max-width: 85%; align-self: flex-start; padding: 8px 10px; border-radius: 10px; background: #202c33; white-space: pre-line; font-size: 14.5px; line-height: 1.4; }
.wsim__msj--yo { align-self: flex-end; background: #005c4b; }
.wsim__tarjeta { display: flex; align-items: center; gap: 10px; }
.wsim__tarjeta > span:last-child { display: flex; flex-direction: column; }
.wsim__nota { margin: 0; padding: 8px 14px 0; color: #8696a0; font-size: 12.5px; }
.wsim__pie { display: flex; justify-content: flex-end; padding: 10px 14px 14px; }
`;
