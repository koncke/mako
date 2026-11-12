// El visual de la portada de /vsl/agenda: una reserva de tu agenda (Calendly o Cal.com) que entra al CRM y cae en la etapa
// de reunión vinculada a su evento (lib/agenda-evento-etapa.ts), con lo que contestó al agendar. Datos ficticios, sin fotos:
// las personas son sus iniciales. Server component sin JavaScript; la animación es CSS y se apaga con «reducir movimiento».

const COLUMNA = [
  { ini: 'CD', nombre: 'Carlos Díaz', cuando: 'R1 · mié 13, 17:30' },
  { ini: 'LG', nombre: 'Lucía Gómez', cuando: 'R1 · mar 12, 10:00' },
];

export default function VisualAgenda() {
  return (
    <div className="mk-v-agenda" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mk-v-agenda-reserva">
        <span className="mk-v-agenda-tag">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
          Tu agenda
        </span>
        <p className="mk-v-agenda-evento">Llamada de estrategia</p>
        <p className="mk-v-agenda-cuando">jue 14 · 11:00 · 45 min</p>
        <div className="mk-v-agenda-quien"><span className="mk-v-agenda-ini">AT</span>Ana Torres</div>
        <div className="mk-v-agenda-resp">
          <span className="mk-v-agenda-resp-p">¿Cuánto facturas al mes?</span>
          <span className="mk-v-agenda-resp-r">$10k a $50k</span>
        </div>
        <span className="mk-v-agenda-ok">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5l10 -10" /></svg>
          Reservada
        </span>
      </div>

      <span className="mk-v-agenda-flecha">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6l-6 6" /></svg>
      </span>

      <div className="mk-v-agenda-crm">
        <div className="mk-v-agenda-crm-t">
          <span className="mk-v-agenda-crm-n">CRM</span>
          <span className="mk-v-agenda-funnel">Funnel Mentoría</span>
        </div>
        <div className="mk-v-agenda-col">
          <div className="mk-v-agenda-col-t"><span className="mk-v-agenda-punto" />Llamada agendada<span className="mk-v-agenda-cuenta">3</span></div>
          <div className="mk-v-agenda-card mk-v-agenda-nueva">
            <span className="mk-v-agenda-ini mk-v-agenda-ini-s">AT</span>
            <span className="mk-v-agenda-card-x">
              <span className="mk-v-agenda-card-n">Ana Torres</span>
              <span className="mk-v-agenda-card-c">R1 · jue 14, 11:00</span>
              <span className="mk-v-agenda-chip">Lo que contestó</span>
            </span>
          </div>
          {COLUMNA.map((c) => (
            <div key={c.nombre} className="mk-v-agenda-card">
              <span className="mk-v-agenda-ini mk-v-agenda-ini-s mk-v-agenda-ini-g">{c.ini}</span>
              <span className="mk-v-agenda-card-x">
                <span className="mk-v-agenda-card-n">{c.nombre}</span>
                <span className="mk-v-agenda-card-c">{c.cuando}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.mk-v-agenda { display: flex; align-items: center; justify-content: center; gap: 12px; }
.mk-v-agenda-reserva { flex: 1 1 0; min-width: 0; max-width: 210px; display: flex; flex-direction: column; gap: 7px; padding: 16px 14px; border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; box-shadow: 0 22px 44px -30px rgba(16,19,25,.45); }
.mk-v-agenda-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: #2F6FED; }
.mk-v-agenda-evento { margin: 2px 0 0; font-size: 14.5px; line-height: 1.3; font-weight: 700; color: #12151B; }
.mk-v-agenda-cuando { margin: 0; font-size: 12px; color: #5B6472; font-variant-numeric: tabular-nums; }
.mk-v-agenda-quien { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 13px; font-weight: 600; color: #12151B; }
.mk-v-agenda-ini { flex: none; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #EAF1FE; color: #2F6FED; font-size: 11px; font-weight: 700; }
.mk-v-agenda-resp { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 10px; background: #F5F8FD; border: 1px solid #EDF1F7; }
.mk-v-agenda-resp-p { font-size: 11px; color: #5B6472; }
.mk-v-agenda-resp-r { font-size: 12.5px; font-weight: 700; color: #12151B; }
.mk-v-agenda-ok { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; margin-top: 2px; padding: 4px 9px; border-radius: 999px; background: #E7F6EE; color: #15803D; font-size: 11px; font-weight: 700; animation: mkVAgendaOk 6s infinite both; }
.mk-v-agenda-flecha { flex: none; width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #2F6FED; color: #fff; box-shadow: 0 10px 22px -12px rgba(47,111,237,.8); }
.mk-v-agenda-crm { flex: 1 1 0; min-width: 0; max-width: 230px; display: flex; flex-direction: column; gap: 9px; }
.mk-v-agenda-crm-t { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mk-v-agenda-crm-n { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #5B6472; }
.mk-v-agenda-funnel { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 8px; border-radius: 999px; background: #12151B; color: #fff; font-size: 10.5px; font-weight: 600; }
.mk-v-agenda-col { display: flex; flex-direction: column; gap: 7px; padding: 10px; border-radius: 14px; background: #F5F8FD; border: 1px solid #E3EAF6; }
.mk-v-agenda-col-t { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: #12151B; }
.mk-v-agenda-punto { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #F2B01E; }
.mk-v-agenda-cuenta { margin-left: auto; min-width: 20px; padding: 1px 6px; border-radius: 999px; background: #fff; border: 1px solid #E3EAF6; color: #5B6472; font-size: 10.5px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums; }
.mk-v-agenda-card { display: flex; align-items: flex-start; gap: 8px; padding: 9px 10px; border-radius: 11px; background: #fff; border: 1px solid #E7ECF5; }
.mk-v-agenda-ini-s { width: 24px; height: 24px; font-size: 10px; }
.mk-v-agenda-ini-g { background: #EEF0F3; color: #5B6472; }
.mk-v-agenda-card-x { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.mk-v-agenda-card-n { font-size: 12.5px; font-weight: 600; color: #12151B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mk-v-agenda-card-c { font-size: 11px; color: #5B6472; font-variant-numeric: tabular-nums; }
.mk-v-agenda-chip { align-self: flex-start; margin-top: 3px; padding: 2px 7px; border-radius: 6px; background: #EAF1FE; color: #2F6FED; font-size: 10px; font-weight: 600; }
.mk-v-agenda-nueva { border-color: #CFDDFB; box-shadow: 0 0 0 3px rgba(47,111,237,.12); animation: mkVAgendaEntra 6s infinite both; }
@keyframes mkVAgendaEntra { 0%, 18% { opacity: 0; transform: translateY(-10px); } 30%, 88% { opacity: 1; transform: none; } 100% { opacity: 1; transform: none; } }
@keyframes mkVAgendaOk { 0% { opacity: .35; } 10%, 92% { opacity: 1; } 100% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .mk-v-agenda-nueva, .mk-v-agenda-ok { animation: none; } }
@media (max-width: 480px) {
  .mk-v-agenda { flex-direction: column; gap: 10px; }
  .mk-v-agenda-reserva, .mk-v-agenda-crm { width: 100%; max-width: 280px; }
  .mk-v-agenda-flecha { transform: rotate(90deg); width: 30px; height: 30px; }
  .mk-v-agenda-reserva { gap: 6px; padding: 14px 12px; }
  .mk-v-agenda-col > .mk-v-agenda-card:last-child { display: none; }
}
`;
