'use client';

// =============================================================================
// «Contenido» de una sección de diseño (28/10/2026, la réplica editable): TODO lo que dice y muestra, en una lista
// =============================================================================
// Martín (28/10, por el Cerebro): «Debe ser todo editable». En una copia idéntica, lo que el JavaScript de la página
// mostraba queda oculto (las respuestas de las preguntas frecuentes, el menú que se abre, las otras pestañas, los textos
// que rotaban, las opciones de un `<select>`), y lo que está debajo de otra capa no se toca con el mouse. Esta lista llega a
// todo: cada texto (se escribe ahí mismo), cada imagen y cada imagen de fondo (cambiar, quitar, su texto alternativo), cada
// enlace o botón (a dónde lleva, quitar) y cada campo (su texto de ayuda). Lo oculto lleva su marca. «Ver» elige el
// elemento en la sección (y la barrita ofrece lo suyo). Lo junta lib/editor-landing/diseno-contenido.ts.
// 4/11/2026: también los ÍCONOS y los VIDEOS (un reproductor o la agenda), con «Cambiar» (el mismo selector que al elegirlos
// con un clic) y «Quitar». Hasta ahí, uno oculto no se podía tocar.
// =============================================================================

import { useMemo, useState, type ReactNode } from 'react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { contenidoDeDiseno, ponerTextoDeNodo, type ItemContenido, type NodoContenido } from '@/lib/editor-landing/diseno-contenido';
import { imagenDeFondo } from '@/lib/editor-landing/diseno-elemento-acciones';

type Pestana = 'texto' | 'imagen' | 'enlace' | 'campo' | 'icono' | 'video';
const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: 'texto', nombre: 'Textos' }, { id: 'imagen', nombre: 'Imágenes' }, { id: 'enlace', nombre: 'Enlaces' }, { id: 'campo', nombre: 'Campos' },
  { id: 'icono', nombre: 'Íconos' }, { id: 'video', nombre: 'Videos' },
];

/** ¿Se ve? Él y los de afuera, hasta la sección: `display`, `visibility`, la opacidad y el tamaño cero. */
function ocultoEn(win: Window | null): (el: NodoContenido) => boolean {
  return (n) => {
    const el = n as unknown as Element;
    const cs = win?.getComputedStyle(el);
    if (!cs) return false;
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return true;
    const r = el.getBoundingClientRect();
    return r.width < 1 && r.height < 1 && cs.display !== 'contents';
  };
}

export function PanelContenidoDiseno({ raiz, onCambio, onCambiarImagen, onQuitar, onFondo, onDestino, onVer, onIcono, onVideo }: {
  raiz: Element;
  /** Un texto, un alt o un texto de ayuda cambió: guardar (con respiro) y medir. */
  onCambio: () => void;
  onCambiarImagen: (img: HTMLImageElement) => void;
  onQuitar: (el: Element) => void;
  onFondo: (el: Element, que: 'cambiar' | 'quitar') => void;
  onDestino: (el: Element, ancla: HTMLElement) => void;
  onVer: (el: Element) => void;
  /** Cambiar un ícono o un video de la lista: el mismo selector que al elegirlo con un clic, al lado del botón. */
  onIcono: (el: Element, ancla: HTMLElement) => void;
  onVideo: (el: Element, ancla: HTMLElement) => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('texto');
  const [buscar, setBuscar] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const win = raiz.ownerDocument.defaultView;
  const contenido = useMemo(() => contenidoDeDiseno(raiz as unknown as NodoContenido, {
    oculto: ocultoEn(win),
    fondo: (n) => imagenDeFondo(win?.getComputedStyle(n as unknown as Element).backgroundImage),
  }), [raiz, win, vuelta]); // eslint-disable-line react-hooks/exhaustive-deps
  const de = (p: Pestana) => contenido.items.filter((it) => (p === 'imagen' ? it.tipo === 'imagen' || it.tipo === 'fondo' : it.tipo === p));
  const q = buscar.trim().toLowerCase();
  const coincide = (it: ItemContenido) => !q || [
    it.tipo === 'texto' ? it.valor : '', it.tipo === 'imagen' ? it.alt + ' ' + it.src : '', it.tipo === 'fondo' ? it.url : '',
    it.tipo === 'enlace' ? it.texto + ' ' + (it.href ?? '') : '', it.tipo === 'campo' ? it.ayuda : '', it.tipo === 'video' ? it.src : '',
  ].join(' ').toLowerCase().includes(q);
  const lista = de(pestana).filter(coincide);
  const otraVuelta = () => setVuelta((v) => v + 1);
  const chico = (rotulo: string, alClic: (b: HTMLElement) => void, ico?: ReactNode) => (
    <button type="button" className="gmx-chip" style={{ height: 26, padding: '0 8px', fontSize: 12 }} aria-label={rotulo}
      onMouseDown={(e) => e.preventDefault()} onClick={(e) => alClic(e.currentTarget)}>
      {ico ?? rotulo}
    </button>
  );
  const marcaOculto = <span className="gmx-nota" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Oculto</span>;
  const elDe = (it: ItemContenido) => (it.tipo === 'texto' ? it.dueno : it.el) as unknown as Element;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} role="tablist" aria-label="Contenido">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" className="gmx-chip" aria-pressed={pestana === p.id} aria-selected={pestana === p.id}
            style={{ height: 28, padding: '0 10px' }} onMouseDown={(e) => e.preventDefault()} onClick={() => setPestana(p.id)}>
            {p.nombre} {de(p.id).length}
          </button>
        ))}
      </div>
      <input className="gmx-campo" placeholder="Buscar" aria-label="Buscar en el contenido" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      {contenido.recortado && <span className="gmx-nota">La sección es muy grande: se listan los primeros {contenido.items.length}.</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>
        {!lista.length && <span className="gmx-nota">{q ? 'Nada coincide.' : 'Esta sección no tiene.'}</span>}
        {lista.map((it, i) => {
          const el = elDe(it);
          const pie = (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              {it.oculto ? marcaOculto : chico('Ver', () => onVer(el))}
              {it.tipo === 'imagen' && chico('Cambiar', () => onCambiarImagen(el as HTMLImageElement))}
              {it.tipo === 'fondo' && chico('Cambiar', () => onFondo(el, 'cambiar'))}
              {it.tipo === 'fondo' && chico('Quitar fondo', () => { onFondo(el, 'quitar'); otraVuelta(); })}
              {it.tipo === 'enlace' && chico('A dónde lleva', (b) => onDestino(el, b))}
              {it.tipo === 'icono' && chico('Cambiar', (b) => onIcono(el, b))}
              {it.tipo === 'video' && chico('Cambiar', (b) => onVideo(el, b))}
              {(it.tipo === 'imagen' || it.tipo === 'enlace' || it.tipo === 'campo' || it.tipo === 'icono' || it.tipo === 'video') && chico('Quitar', () => { onQuitar(el); otraVuelta(); }, <IconoBorrar size={14} />)}
            </div>
          );
          if (it.tipo === 'texto') {
            return (
              <div key={'t' + i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <FilaTexto valor={it.valor} rotulo="Texto" onCambio={(v) => { if (ponerTextoDeNodo(it.nodo, v)) onCambio(); }} />
                {pie}
              </div>
            );
          }
          if (it.tipo === 'campo') {
            return (
              <div key={'c' + i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="gmx-rotulo" style={{ margin: '2px' }}>Texto de ayuda</span>
                <FilaTexto valor={it.ayuda} rotulo="Texto de ayuda" vacio
                  onCambio={(v) => { const x = v.replace(/\s+/g, ' ').trim().slice(0, 120); if (x) el.setAttribute('placeholder', x); else el.removeAttribute('placeholder'); onCambio(); }} />
                {pie}
              </div>
            );
          }
          if (it.tipo === 'enlace') {
            return (
              <div key={'e' + i} style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: i ? '1px solid var(--gmx-borde)' : undefined, paddingTop: i ? 6 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{it.texto || 'Sin texto'}</span>
                <span className="gmx-nota" style={{ wordBreak: 'break-all' }}>{it.href || 'No lleva a ningún lado'}</span>
                {pie}
              </div>
            );
          }
          if (it.tipo === 'icono' || it.tipo === 'video') {
            const nombre = it.tipo === 'icono' ? 'Ícono' : el.tagName.toLowerCase() === 'video' ? 'Video' : el.hasAttribute('data-calendly') ? 'Agenda' : 'Reproductor';
            return (
              <div key={(it.tipo === 'icono' ? 'o' : 'v') + i} style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: i ? '1px solid var(--gmx-borde)' : undefined, paddingTop: i ? 6 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{nombre} {i + 1}</span>
                {it.tipo === 'video' && <span className="gmx-nota" style={{ wordBreak: 'break-all' }}>{it.src || 'Sin dirección'}</span>}
                {pie}
              </div>
            );
          }
          const src = it.tipo === 'imagen' ? it.src : it.url;
          return (
            <div key={'i' + i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', borderTop: i ? '1px solid var(--gmx-borde)' : undefined, paddingTop: i ? 6 : 0 }}>
              <span aria-hidden="true" style={{ width: 44, height: 44, flex: '0 0 44px', borderRadius: 6, border: '1px solid var(--gmx-borde)', background: `center / contain no-repeat url("${src.replace(/["\\]/g, '')}")` }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                {it.tipo === 'imagen'
                  ? <FilaTexto valor={it.alt} rotulo="Texto alternativo" vacio placeholder="Qué muestra"
                      onCambio={(v) => { el.setAttribute('alt', v.replace(/\s+/g, ' ').trim().slice(0, 200)); onCambio(); }} />
                  : <span className="gmx-nota">Imagen de fondo</span>}
                {pie}
              </div>
            </div>
          );
        })}
      </div>
      {pestana === 'texto' && <span className="gmx-nota">Los textos ocultos son los que la página mostraba con un clic (una respuesta, un menú, otra pestaña).</span>}
    </div>
  );
}

/** Una fila que se escribe: el cambio va al elemento en cada tecla (quien llama guarda con respiro). */
function FilaTexto({ valor, rotulo, onCambio, vacio, placeholder }: { valor: string; rotulo: string; onCambio: (v: string) => void; vacio?: boolean; placeholder?: string }) {
  const [v, setV] = useState(valor);
  const largo = v.length > 60;
  const comun = {
    className: 'gmx-campo', value: v, 'aria-label': rotulo, placeholder, maxLength: 2000,
    onChange: (e: { target: { value: string } }) => { setV(e.target.value); if (vacio || e.target.value.trim()) onCambio(e.target.value); },
  };
  return largo
    ? <textarea {...comun} rows={3} style={{ minHeight: 56 }} />
    : <input {...comun} />;
}

