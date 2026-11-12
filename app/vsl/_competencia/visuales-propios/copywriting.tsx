// El visual de la portada de /vsl/copywriting: una página como las de Notion (el ícono, el título, las propiedades y las
// secciones del guion) con MaKo escribiendo el gancho palabra por palabra, marcado como propuesta, un [DATO: …] por
// completar, y abajo la tarjeta del chat con «Aceptar · Descartar · Reintentar» (app/copywriter/PanelMaKo.tsx).
// La página es la plantilla «Anuncio a cámara (PAS)» (lib/copywriter/plantillas.ts): el nombre, las secciones y el gancho
// salen de su ejemplo, que es de un negocio FICTICIO del elenco. Sin fotos ni caras. Sin JavaScript: la animación es CSS.
import { catalogosLite, conVsl } from '@/lib/copywriter/catalogos';
import { chipsDe, extractoDe, plantillaPorId, plantillasDe } from '@/lib/copywriter/plantillas';
import { INFO_TIPO } from '@/lib/copywriter/tipos';
import { ANGULOS_GUION_DEFAULT } from '@/lib/guion-angulos';
import { ESTRUCTURAS_GUION_DEFAULT } from '@/lib/guion-estructuras';

/** La biblioteca de fábrica: con ella la plantilla trae su estructura elegida (la que se ve en las propiedades). */
const CATALOGO = catalogosLite(ANGULOS_GUION_DEFAULT, conVsl(ESTRUCTURAS_GUION_DEFAULT));
const PLANTILLA = plantillaPorId(CATALOGO, 'guion-anuncio') ?? plantillasDe(CATALOGO)[0];
/** «PAS (Problema → Agitación → Solución)» → «PAS»: lo corto, como entra en la fila de propiedades. */
const ESTRUCTURA = CATALOGO.estructuras.find((e) => e.id === PLANTILLA.estructura)?.nombre.split(' (')[0] ?? null;
/** El texto de la línea vacía del editor (PLACEHOLDER_LINEA en app/copywriter/editor/CuerpoNotion.tsx, que es de cliente). */
const LINEA_VACIA = 'Escribe «/» para ver los comandos…';
const SECCIONES = chipsDe(PLANTILLA).slice(0, 3);
const GANCHO = extractoDe(PLANTILLA);
const TIPO = INFO_TIPO[PLANTILLA.tipo];
const DURACION = PLANTILLA.duracion ?? TIPO.duracion;

export default function VisualCopywriting() {
  const palabras = GANCHO.split(/\s+/).filter(Boolean);
  const ciclo = (palabras.length * 0.14 + 4).toFixed(2);
  return (
    <div className="mk-v-copywriting" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mk-v-copywriting-pag">
        <div className="mk-v-copywriting-ruta">
          <span>Copywriting</span><span className="mk-v-copywriting-sep">/</span><span className="mk-v-copywriting-ruta-t">{PLANTILLA.nombre}</span>
          <span className="mk-v-copywriting-guardado">Guardado</span>
        </div>
        <span className="mk-v-copywriting-emoji">{TIPO.emoji}</span>
        <p className="mk-v-copywriting-titulo">{PLANTILLA.nombre}</p>
        <div className="mk-v-copywriting-props">
          <span><b>Tipo</b>{TIPO.label}</span>
          {ESTRUCTURA ? <span><b>Estructura</b>{ESTRUCTURA}</span> : null}
          {DURACION ? <span><b>Duración</b>{DURACION} s</span> : null}
        </div>
        <div className="mk-v-copywriting-sec">
          <p className="mk-v-copywriting-h">{SECCIONES[0]}</p>
          <p className="mk-v-copywriting-prop">
            {palabras.map((p, i) => (
              <span key={i} style={{ animationDelay: `${(i * 0.14).toFixed(2)}s`, animationDuration: `${ciclo}s` }}>{p} </span>
            ))}
          </p>
        </div>
        {SECCIONES[1] ? (
          <div className="mk-v-copywriting-sec">
            <p className="mk-v-copywriting-h">{SECCIONES[1]}</p>
            <span className="mk-v-copywriting-linea" /><span className="mk-v-copywriting-linea" style={{ width: '74%' }} />
          </div>
        ) : null}
        {SECCIONES[2] ? (
          <div className="mk-v-copywriting-sec">
            <p className="mk-v-copywriting-h">{SECCIONES[2]}</p>
            <p className="mk-v-copywriting-txt"><span className="mk-v-copywriting-dato">[DATO: un caso con permiso]</span></p>
          </div>
        ) : null}
        <p className="mk-v-copywriting-barra">{LINEA_VACIA}</p>
      </div>
      <div className="mk-v-copywriting-chat">
        <span className="mk-v-copywriting-estrella">
          <svg width="14" height="14" viewBox="-12 -12 24 24"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
        </span>
        <div className="mk-v-copywriting-resp">
          <p>Listo: el gancho y el problema quedaron en la página. Falta 1 dato por completar.</p>
          <div className="mk-v-copywriting-botones">
            <span className="mk-v-copywriting-ok">Aceptar</span>
            <span>Descartar</span>
            <span>Reintentar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.mk-v-copywriting { display: flex; flex-direction: column; gap: 12px; }
.mk-v-copywriting-pag { display: flex; flex-direction: column; padding: 12px 18px 14px; border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; box-shadow: 0 20px 44px -30px rgba(16,19,25,.4); }
.mk-v-copywriting-ruta { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 11px; color: #8A93A2; }
.mk-v-copywriting-ruta-t { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #5B6472; }
.mk-v-copywriting-sep { color: #C5CCD8; }
.mk-v-copywriting-guardado { margin-left: auto; flex: none; font-size: 10.5px; color: #8A93A2; }
.mk-v-copywriting-emoji { margin-top: 12px; font-size: 30px; line-height: 1; }
.mk-v-copywriting-titulo { margin: 8px 0 0; font-size: 21px; line-height: 1.2; font-weight: 800; letter-spacing: -0.02em; color: #12151B; }
.mk-v-copywriting-props { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; padding-bottom: 10px; border-bottom: 1px solid #EEF2F8; font-size: 11.5px; color: #12151B; }
.mk-v-copywriting-props b { margin-right: 6px; font-weight: 500; color: #8A93A2; }
.mk-v-copywriting-sec { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }
.mk-v-copywriting-h { margin: 0; font-size: 14px; font-weight: 700; color: #12151B; }
.mk-v-copywriting-prop { margin: 0; padding: 6px 8px; border-radius: 6px; background: #EAF1FE; box-shadow: inset 3px 0 0 #2F6FED; font-size: 12.5px; line-height: 1.45; color: #12151B; }
.mk-v-copywriting-prop span { animation-name: mkVCopyPalabra; animation-iteration-count: infinite; animation-fill-mode: both; }
@keyframes mkVCopyPalabra { 0% { opacity: 0; } 3%, 94% { opacity: 1; } 100% { opacity: 0; } }
.mk-v-copywriting-linea { display: block; height: 6px; border-radius: 4px; background: #E8EDF5; }
.mk-v-copywriting-txt { margin: 0; font-size: 12.5px; line-height: 1.45; color: #4A515E; }
.mk-v-copywriting-dato { display: inline-block; padding: 1px 6px; border-radius: 5px; background: #FFF4D6; color: #7A5A00; font-size: 11.5px; font-weight: 600; }
.mk-v-copywriting-barra { margin: 12px 0 0; font-size: 11.5px; color: #A3ABB8; }
.mk-v-copywriting-chat { display: flex; gap: 8px; align-items: flex-start; padding: 12px; border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; }
.mk-v-copywriting-estrella { flex: none; width: 24px; height: 24px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: #1A1712; }
.mk-v-copywriting-resp { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.mk-v-copywriting-resp p { margin: 0; font-size: 12px; line-height: 1.45; color: #12151B; }
.mk-v-copywriting-botones { display: flex; flex-wrap: wrap; gap: 6px; }
.mk-v-copywriting-botones span { display: inline-flex; padding: 4px 10px; border-radius: 8px; border: 1px solid #E3EAF6; font-size: 11px; font-weight: 600; color: #5B6472; }
.mk-v-copywriting-botones .mk-v-copywriting-ok { border-color: #12151B; background: #12151B; color: #fff; }
@media (prefers-reduced-motion: reduce) { .mk-v-copywriting-prop span { animation: none; } }
@media (max-width: 480px) {
  .mk-v-copywriting-pag { padding: 10px 12px 12px; }
  .mk-v-copywriting-emoji { font-size: 24px; margin-top: 10px; }
  .mk-v-copywriting-titulo { font-size: 17px; }
  .mk-v-copywriting-props { font-size: 10.5px; gap: 3px 10px; }
  .mk-v-copywriting-h { font-size: 13px; }
  .mk-v-copywriting-prop, .mk-v-copywriting-txt { font-size: 11.5px; }
  .mk-v-copywriting-barra { display: none; }
  .mk-v-copywriting-chat { padding: 10px; }
  .mk-v-copywriting-resp p { font-size: 11.5px; }
}
`;
