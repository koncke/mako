// El visual de la portada de /vsl/image: el editor con un carrusel de MaKo (la portada y dos láminas que aparecen de a una,
// como se arma) y, abajo, el chat de MaKo con su propuesta «Original | Modificado» y «Aceptar» (app/image-editor/mako/chat/).
// Las láminas son las del ejemplo del primer tipo de carrusel (lib/carruseles/tipos.ts), que es de un negocio FICTICIO del
// elenco: nunca un cliente. Sin fotos ni caras. Server component sin JavaScript: la animación es CSS.
import { TIPOS_CARRUSEL } from '@/lib/carruseles/tipos';

const TIPO = TIPOS_CARRUSEL[0];
const PORTADA = TIPO.ejemplo.laminas.find((l) => l.rol === 'portada') ?? TIPO.ejemplo.laminas[0];
const ADENTRO = TIPO.ejemplo.laminas.filter((l) => l.rol !== 'portada' && l.rol !== 'cierre').slice(1, 3);
const N_LAMINAS = TIPO.ejemplo.laminas.length;

export default function VisualImage() {
  const laminas = [PORTADA, ...ADENTRO];
  return (
    <div className="mk-v-image" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mk-v-image-editor">
        <div className="mk-v-image-barra">
          <span className="mk-v-image-puntos"><i /><i /><i /></span>
          <span className="mk-v-image-nombre">Carrusel · {TIPO.nombre}</span>
          <span className="mk-v-image-bajar">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
            PNG
          </span>
        </div>
        <div className="mk-v-image-laminas">
          {laminas.map((l, i) => (
            <div key={l.rotulo + i} className={`mk-v-image-lam${i === 0 ? ' mk-v-image-lam-portada' : ''}`} style={{ animationDelay: `${(i * 0.55).toFixed(2)}s` }}>
              <span className="mk-v-image-lam-n">{i + 1}/{N_LAMINAS}</span>
              <span className="mk-v-image-lam-t">{l.titulo}</span>
              {i === 0 ? <span className="mk-v-image-lam-raya" /> : (
                <span className="mk-v-image-lam-cuerpo"><i /><i /><i style={{ width: '62%' }} /></span>
              )}
              <span className="mk-v-image-lam-marca">@{TIPO.ejemplo.usuario}</span>
            </div>
          ))}
        </div>
        <div className="mk-v-image-pie">
          <span className="mk-v-image-marca">
            Tu marca
            <i style={{ background: '#2F6FED' }} /><i style={{ background: '#F2B01E' }} /><i style={{ background: '#12151B' }} />
            <b>Aa</b>
          </span>
          <span className="mk-v-image-pags">
            {Array.from({ length: N_LAMINAS }, (_, i) => <i key={i} className={i === 0 ? 'mk-v-image-pag-on' : ''} />)}
          </span>
        </div>
      </div>
      <div className="mk-v-image-chat">
        <p className="mk-v-image-yo">Pásalo a los colores de mi marca y acorta los títulos</p>
        <div className="mk-v-image-mako">
          <span className="mk-v-image-estrella">
            <svg width="14" height="14" viewBox="-12 -12 24 24"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
          </span>
          <div className="mk-v-image-resp">
            <p>Cambié los colores a los de tu marca y acorté dos títulos.</p>
            <div className="mk-v-image-acciones">
              <span className="mk-v-image-seg"><span>Original</span><span className="mk-v-image-seg-on">Modificado</span></span>
              <span className="mk-v-image-aceptar">Aceptar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.mk-v-image { display: flex; flex-direction: column; gap: 12px; }
.mk-v-image-editor { border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; padding: 10px 12px 12px; box-shadow: 0 20px 44px -30px rgba(16,19,25,.4); }
.mk-v-image-barra { display: flex; align-items: center; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid #EEF2F8; }
.mk-v-image-puntos { display: inline-flex; gap: 4px; }
.mk-v-image-puntos i { width: 7px; height: 7px; border-radius: 50%; background: #E1E6EE; }
.mk-v-image-nombre { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 12px; font-weight: 600; color: #12151B; }
.mk-v-image-bajar { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 7px; background: #2F6FED; color: #fff; font-size: 10.5px; font-weight: 700; }
.mk-v-image-laminas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px 0 10px; }
.mk-v-image-lam { container-type: inline-size; position: relative; aspect-ratio: 4 / 5; min-width: 0; overflow: hidden; display: flex; flex-direction: column; gap: 6px; padding: 9% 9% 0; border-radius: 9px; background: #F5F8FD; border: 1px solid #E3EAF6; animation: mkVImageLam 7s infinite both; }
.mk-v-image-lam-portada { background: #12151B; border-color: #12151B; }
.mk-v-image-lam-n { font-size: 9px; font-size: 7.5cqw; font-weight: 600; color: #8A93A2; font-variant-numeric: tabular-nums; }
.mk-v-image-lam-t { font-size: 11px; font-size: 10.5cqw; line-height: 1.18; font-weight: 800; letter-spacing: -0.01em; color: #12151B; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.mk-v-image-lam-portada .mk-v-image-lam-t { color: #fff; font-size: 12.5px; font-size: 12cqw; -webkit-line-clamp: 5; }
.mk-v-image-lam-raya { width: 34%; height: 4px; border-radius: 3px; background: #F2B01E; }
.mk-v-image-lam-cuerpo { display: flex; flex-direction: column; gap: 4px; }
.mk-v-image-lam-cuerpo i { display: block; height: 4px; border-radius: 3px; background: #CFDDFB; }
.mk-v-image-lam-marca { position: absolute; left: 9%; bottom: 7%; font-size: 8px; font-size: 7cqw; font-weight: 600; color: #2F6FED; }
.mk-v-image-lam-portada .mk-v-image-lam-marca { color: #F2B01E; }
@keyframes mkVImageLam { 0% { opacity: 0; transform: translateY(6px); } 7%, 92% { opacity: 1; transform: none; } 100% { opacity: 0; transform: none; } }
.mk-v-image-pie { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mk-v-image-marca { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: #5B6472; }
.mk-v-image-marca i { width: 12px; height: 12px; border-radius: 50%; }
.mk-v-image-marca b { margin-left: 2px; font-size: 12px; font-weight: 800; color: #12151B; }
.mk-v-image-pags { display: inline-flex; gap: 4px; }
.mk-v-image-pags i { width: 6px; height: 6px; border-radius: 50%; background: #D7DEEA; }
.mk-v-image-pags .mk-v-image-pag-on { width: 16px; border-radius: 4px; background: #2F6FED; }
.mk-v-image-chat { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; }
.mk-v-image-yo { align-self: flex-end; max-width: 82%; margin: 0; padding: 8px 11px; border-radius: 12px 12px 4px 12px; background: #2F6FED; color: #fff; font-size: 12px; line-height: 1.4; }
.mk-v-image-mako { display: flex; gap: 8px; align-items: flex-start; }
.mk-v-image-estrella { flex: none; width: 24px; height: 24px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: #1A1712; }
.mk-v-image-resp { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.mk-v-image-resp p { margin: 0; font-size: 12px; line-height: 1.45; color: #12151B; }
.mk-v-image-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.mk-v-image-seg { display: inline-flex; padding: 2px; border-radius: 8px; background: #EEF2F8; font-size: 10.5px; font-weight: 600; color: #5B6472; }
.mk-v-image-seg span { padding: 3px 8px; border-radius: 6px; }
.mk-v-image-seg .mk-v-image-seg-on { background: #fff; color: #12151B; box-shadow: 0 1px 2px rgba(16,19,25,.12); }
.mk-v-image-aceptar { display: inline-flex; padding: 5px 11px; border-radius: 8px; background: #12151B; color: #fff; font-size: 11px; font-weight: 700; }
@media (prefers-reduced-motion: reduce) { .mk-v-image-lam { animation: none; } }
@media (max-width: 480px) {
  .mk-v-image-editor { padding: 9px 9px 10px; }
  .mk-v-image-laminas { gap: 6px; }
  .mk-v-image-lam { gap: 4px; border-radius: 7px; }
  .mk-v-image-lam-raya { height: 3px; }
  .mk-v-image-lam-cuerpo i { height: 3px; }
  .mk-v-image-marca { font-size: 10px; }
  .mk-v-image-chat { padding: 10px; }
  .mk-v-image-yo, .mk-v-image-resp p { font-size: 11.5px; }
}
`;
