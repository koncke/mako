'use client';

// =============================================================================
// SuFunnelTipo — qué funnel usa, con lo que lo delata citado de sus piezas (4/11/2026)
// =============================================================================
// Martín, con Den Borg: «Quiero que se analice qué funnel utiliza... denborg es obvio que hace funnel de eventos presenciales». El
// Cerebro: «con evidencia de sus piezas, no por adivinanza». La clasificación es de lib/spy-funnel-tipo.ts, que sale del catálogo
// (docs/catalogo-funnels-y-formatos.md): acá sólo se dibuja.
//
// Va ARRIBA de la pestaña Funnel, al lado de su oferta. Cada cita se toca: la de una pieza abre la pieza; la de una página la elige
// en «Sus páginas» y baja hasta ella. Sin evidencia dice «no se ve», nunca adivina un tipo.
// =============================================================================

import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { partesDeCita, type Evidencia, type LecturaDeFunnel } from '@/lib/spy-funnel-tipo';
import { SuFunnel } from './SuFunnel';

const CSS = `
.spy-tipo{display:flex;flex-direction:column;gap:16px;min-width:0;padding:22px;border-radius:var(--r-lg);background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--border)}
.spy-tipo__cabeza{display:flex;align-items:flex-start;gap:14px}
.spy-tipo__icono{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:var(--primary-bg);color:var(--primary)}
.spy-tipo__cabeza small{display:block;color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-tipo__cabeza h3{margin:2px 0 0;font-size:22px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.spy-tipo__cabeza p{margin:4px 0 0;color:var(--dim);font-size:var(--fs-md);line-height:1.45;text-wrap:pretty}
.spy-tipo__citas{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.spy-tipo__cita{display:flex;flex-direction:column;gap:4px;width:100%;padding:11px 14px;border:0;border-radius:var(--r-md);
  background:var(--surface-2);color:var(--ink);text-align:left;font:inherit;font-size:var(--fs-md);line-height:1.45;cursor:pointer;
  transition:background .15s}
.spy-tipo__cita:hover{background:var(--velo-hover,var(--surface-3,var(--border)))}
.spy-tipo__cita:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.spy-tipo__cita[disabled]{cursor:default}
.spy-tipo__donde{display:flex;align-items:center;gap:6px;color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-tipo__cita q{quotes:'«' '»';overflow-wrap:anywhere}
.spy-tipo__cita mark{background:var(--warn-bg);color:inherit;border-radius:3px;box-shadow:0 0 0 2px var(--warn-bg);font-weight:600}
.spy-tipo__tambien{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0;color:var(--dim);font-size:var(--fs-sm);font-weight:600}
.spy-tipo__pie{display:flex;flex-wrap:wrap;gap:8px}
`;

/** Un dibujo por tipo de funnel: lo que se reconoce de un vistazo. Sin uno propio, el embudo. */
const ICONO_FUNNEL: Record<string, NombreIconoMenu> = {
  'evento-presencial': 'evento', 'mastermind-retiro': 'equipo', 'webinar-en-vivo': 'video', 'webinar-automatizado': 'video',
  'vsl-llamada': 'video', 'vsl-compra': 'video', 'aplicacion-llamada': 'telefono', 'agenda-directa': 'calendario',
  'dm-setter': 'enviar', 'dm-palabra-clave': 'enviar', 'whatsapp-conversacional': 'whatsapp', reto: 'calendario',
  lanzamiento: 'curso', 'clase-gratis': 'curso', 'lead-magnet': 'email', quiz: 'pregunta', comunidad: 'equipo',
  'low-ticket': 'dinero', 'summit-virtual': 'evento', libro: 'curso', tienda: 'dinero', newsletter: 'email',
};
const ICONO_DONDE: Record<Evidencia['donde'], NombreIconoMenu> = { web: 'web', bio: 'persona', publicacion: 'imagen', video: 'video', anuncio: 'anuncio' };

function Cita({ e, onVerPieza, onVerPagina }: { e: Evidencia; onVerPieza: (id: number) => void; onVerPagina: (url: string) => void }) {
  const p = partesDeCita(e.cita, e.frase);
  // Una página de su web se elige en «Sus páginas» (aunque sea una pieza guardada); lo demás abre la pieza.
  const url = e.donde === 'web' ? e.url : null;
  const id = e.piezaId;
  const accion = url ? () => onVerPagina(url) : id != null ? () => onVerPieza(id) : undefined;
  return (
    <li>
      <button type="button" className="spy-tipo__cita" onClick={accion} disabled={!accion}
        aria-label={accion ? `Ver ${e.etiqueta}` : undefined}>
        <span className="spy-tipo__donde"><IconoMenu nombre={ICONO_DONDE[e.donde]} size={14} />{e.etiqueta}</span>
        <q>{p.antes}{p.frase && <mark>{p.frase}</mark>}{p.despues}</q>
      </button>
    </li>
  );
}

export function SuFunnelTipo({ lectura, hayFuentes, filasDeSuWeb, enlaceAnuncios, onVerPieza, onVerPagina }: {
  /** `clasificarFunnel` sobre lo que se puede citar (sus páginas leídas, lo que publica y sus anuncios). La calcula SpyApp una vez:
   *  también decide si la pestaña existe. */
  lectura: LecturaDeFunnel;
  /** ¿Había algo que leer? Sin nada leído no se dice «no se ve»: no se miró. */
  hayFuentes: boolean;
  /** Lo que se leyó del código de su web (píxeles, checkout, video): `SuFunnel`. */
  filasDeSuWeb: readonly unknown[];
  enlaceAnuncios: string | null;
  onVerPieza: (id: number) => void;
  onVerPagina: (url: string) => void;
}) {
  const f = lectura.principal;
  if (!hayFuentes && !filasDeSuWeb.length) return null;
  return (
    <section className="spy-tipo" aria-label="Su funnel" data-recorrido="spy-funnel-tipo">
      <style>{CSS}</style>
      <header className="spy-tipo__cabeza">
        <span className="spy-tipo__icono" aria-hidden><IconoMenu nombre={f ? ICONO_FUNNEL[f.id] ?? 'filtro' : 'filtro'} size={22} /></span>
        <div style={{ minWidth: 0 }}>
          <small>Su funnel</small>
          <h3>{f ? f.label : 'No se ve todavía'}</h3>
          <p>{f ? f.que : 'Nada de lo que publica nombra cómo vende.'}</p>
        </div>
      </header>
      {f && !!f.evidencias.length && (
        <ul className="spy-tipo__citas" aria-label="Por qué">
          {f.evidencias.map((e) => <Cita key={`${e.etiqueta}|${e.frase}`} e={e} onVerPieza={onVerPieza} onVerPagina={onVerPagina} />)}
        </ul>
      )}
      {!!lectura.otros.length && (
        <p className="spy-tipo__tambien">
          También usa
          {lectura.otros.map((o) => <span key={o.id} className="spy-pildora-gris" title={o.que ?? undefined}>{o.label}</span>)}
        </p>
      )}
      <SuFunnel filas={filasDeSuWeb} />
      {enlaceAnuncios && (
        <div className="spy-tipo__pie">
          <a href={enlaceAnuncios} target="_blank" rel="noreferrer noopener" className="spy-boton">Ver sus anuncios en Meta</a>
        </div>
      )}
    </section>
  );
}
