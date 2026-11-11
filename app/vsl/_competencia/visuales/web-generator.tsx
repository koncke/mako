// =============================================================================
// El visual de la portada de /vsl/web-generator: una frase de pedido y la landing que sale armada por secciones
// =============================================================================
// Copia la idea del hero de HighLevel AI Studio (la frase escrita y el sitio listo al lado), con la pantalla de MaKo:
// la caja «¿Qué vas a crear hoy?» con el pedido, la ventana de la landing con sus secciones (portada, video y
// formulario, las que arman las plantillas de lib/editor-landing/plantillas.ts) y el aviso del lead que entra al CRM.
// Los textos son un ejemplo genérico: ningún negocio real. Server component sin JavaScript: las secciones aparecen una
// por una con CSS (se ve construyéndose), y con «reducir movimiento» aparecen de una.
// =============================================================================

const CSS = `
.mk-v-web-generator { width: 100%; max-width: 470px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; position: relative; font-family: inherit; }
.mk-v-web-generator-pedido { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 12px; border-radius: 14px; background: #fff; border: 1px solid #DCE6F8; box-shadow: 0 10px 24px -18px rgba(47,111,237,.5); }
.mk-v-web-generator-estrella { flex: none; width: 26px; height: 26px; border-radius: 8px; background: #1A1712; display: flex; align-items: center; justify-content: center; }
.mk-v-web-generator-frase { flex: 1; min-width: 0; font-size: 13px; line-height: 1.4; color: #12151B; }
.mk-v-web-generator-enviar { flex: none; width: 28px; height: 28px; border-radius: 9px; background: #2F6FED; color: #fff; display: flex; align-items: center; justify-content: center; }
.mk-v-web-generator-ventana { border-radius: 14px; background: #fff; border: 1px solid #E3EAF6; overflow: hidden; box-shadow: 0 24px 50px -32px rgba(16,19,25,.45); }
.mk-v-web-generator-barra { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #F5F8FD; border-bottom: 1px solid #EAF0F8; }
.mk-v-web-generator-puntos { flex: none; display: flex; gap: 4px; }
.mk-v-web-generator-puntos i { width: 7px; height: 7px; border-radius: 50%; background: #D3DCEA; }
.mk-v-web-generator-url { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 8px; border-radius: 7px; background: #fff; border: 1px solid #E7ECF5; font-size: 11px; color: #5B6472; }
.mk-v-web-generator-listo { flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px; background: #EAF1FE; color: #2F6FED; font-size: 10.5px; font-weight: 600; white-space: nowrap; }
.mk-v-web-generator-listo::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #2F6FED; }
.mk-v-web-generator-pagina { display: flex; flex-direction: column; }
.mk-v-web-generator-sec { position: relative; padding: 24px 16px 14px; border-bottom: 1px dashed #E7ECF5; }
.mk-v-web-generator-s3 { padding-bottom: 34px; }
.mk-v-web-generator-sec:last-child { border-bottom: 0; }
.mk-v-web-generator-sec-r { position: absolute; top: 7px; right: 12px; font-size: 9.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #8A93A2; }
.mk-v-web-generator-etq { display: inline-block; padding: 3px 8px; border-radius: 999px; background: #FFF6DE; color: #8A6510; font-size: 10px; font-weight: 600; }
.mk-v-web-generator-h { margin: 8px 0 4px; font-size: 16px; line-height: 1.2; font-weight: 700; letter-spacing: -0.015em; color: #12151B; }
.mk-v-web-generator-x { margin: 0 0 10px; font-size: 11.5px; line-height: 1.45; color: #5B6472; }
.mk-v-web-generator-btn { display: inline-flex; padding: 6px 12px; border-radius: 8px; background: #2F6FED; color: #fff; font-size: 11px; font-weight: 600; }
.mk-v-web-generator-video { position: relative; aspect-ratio: 16 / 6; border-radius: 10px; background: linear-gradient(135deg, #12151B, #2E3646); display: flex; align-items: center; justify-content: center; }
.mk-v-web-generator-play { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.14); display: flex; align-items: center; justify-content: center; }
.mk-v-web-generator-campos { display: flex; gap: 6px; flex-wrap: wrap; }
.mk-v-web-generator-campo { flex: 1 1 90px; min-width: 0; padding: 7px 9px; border-radius: 8px; border: 1px solid #DCE3EF; background: #FBFCFE; font-size: 10.5px; color: #8A93A2; }
.mk-v-web-generator-campos .mk-v-web-generator-btn { flex: 1 1 100%; justify-content: center; }
.mk-v-web-generator-lead { position: absolute; right: -6px; bottom: -14px; display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px; background: #12151B; color: #fff; font-size: 11.5px; font-weight: 600; box-shadow: 0 16px 30px -16px rgba(16,19,25,.7); }
.mk-v-web-generator-lead-ic { width: 18px; height: 18px; border-radius: 6px; background: #F2B01E; color: #12151B; display: flex; align-items: center; justify-content: center; }

.mk-v-web-generator-sec, .mk-v-web-generator-lead { animation: mkVwgEntra .5s ease both; }
.mk-v-web-generator-s1 { animation-delay: .3s; }
.mk-v-web-generator-s2 { animation-delay: .9s; }
.mk-v-web-generator-s3 { animation-delay: 1.5s; }
.mk-v-web-generator-lead { animation-delay: 2.3s; }
@keyframes mkVwgEntra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .mk-v-web-generator-sec, .mk-v-web-generator-lead { animation: none; } }

@media (max-width: 480px) {
  .mk-v-web-generator-frase { font-size: 12px; }
  .mk-v-web-generator-sec { padding: 22px 12px 12px; }
  .mk-v-web-generator-s3 { padding-bottom: 34px; }
  .mk-v-web-generator-h { font-size: 14.5px; }
  .mk-v-web-generator-listo { display: none; }
  .mk-v-web-generator-lead { right: 0; font-size: 11px; }
}
`;

export default function VisualWebGenerator() {
  return (
    <div className="mk-v-web-generator" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mk-v-web-generator-pedido">
        <span className="mk-v-web-generator-estrella">
          <svg width="14" height="14" viewBox="-12 -12 24 24"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
        </span>
        <span className="mk-v-web-generator-frase">Una landing para que agenden una llamada sobre mi mentoría de ventas</span>
        <span className="mk-v-web-generator-enviar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M6 11l6 -6l6 6" /></svg>
        </span>
      </div>

      <div className="mk-v-web-generator-ventana">
        <div className="mk-v-web-generator-barra">
          <span className="mk-v-web-generator-puntos"><i /><i /><i /></span>
          <span className="mk-v-web-generator-url">hola-mako.site/tu-mentoria</span>
          <span className="mk-v-web-generator-listo">Lista para publicar</span>
        </div>
        <div className="mk-v-web-generator-pagina">
          <div className="mk-v-web-generator-sec mk-v-web-generator-s1">
            <span className="mk-v-web-generator-sec-r">Portada</span>
            <span className="mk-v-web-generator-etq">Mentoría de ventas</span>
            <p className="mk-v-web-generator-h">Cierra tus llamadas de venta con un método</p>
            <p className="mk-v-web-generator-x">Una llamada de diagnóstico para ver cómo vendes hoy.</p>
            <span className="mk-v-web-generator-btn">Agenda tu llamada</span>
          </div>
          <div className="mk-v-web-generator-sec mk-v-web-generator-s2">
            <span className="mk-v-web-generator-sec-r">Video</span>
            <div className="mk-v-web-generator-video">
              <span className="mk-v-web-generator-play"><svg width="14" height="14" viewBox="0 0 24 24"><path d="M8 5v14l11 -7z" fill="#fff" /></svg></span>
            </div>
          </div>
          <div className="mk-v-web-generator-sec mk-v-web-generator-s3">
            <span className="mk-v-web-generator-sec-r">Formulario</span>
            <div className="mk-v-web-generator-campos">
              <span className="mk-v-web-generator-campo">Nombre</span>
              <span className="mk-v-web-generator-campo">WhatsApp</span>
              <span className="mk-v-web-generator-btn">Quiero mi llamada</span>
            </div>
          </div>
        </div>
      </div>

      <span className="mk-v-web-generator-lead">
        <span className="mk-v-web-generator-lead-ic">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5l10 -10" /></svg>
        </span>
        Nuevo lead en tu CRM
      </span>
    </div>
  );
}
