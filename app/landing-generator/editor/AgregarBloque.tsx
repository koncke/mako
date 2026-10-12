'use client';

// =============================================================================
// AgregarBloque — el popover «Agregar bloque» de Gamma 5
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Es el de gamma-ui.md §5.5:
// 560 px, radio xl, fondo titanium-50 y sombra xl; arriba el buscador «Buscar todos los
// bloques»; a la izquierda la navegación por categoría (el ítem activo en blue-100 /
// blue-800); a la derecha la categoría con su subtítulo y una grilla de 3 columnas de tiles
// (gap 6 px, alto máximo 360 px). Cada tile se CLICKEA (inserta en el cursor o al final de la
// sección activa) o se ARRASTRA al lienzo (inserta donde se suelta).
//
// La lista es UNA: BLOQUES de lib/editor-landing/catalogo-bloques.ts (la misma del menú «/» y
// de la IA). Quien inserta es `insertarBloque` de ./insertar (paquete G1): este popover sólo
// decide DÓNDE queda el cursor antes de llamarlo.
//
// Lo que no se copia de Gamma: las categorías «Formas» y «Diagramas inteligentes» (dependen del
// «Formato libre», que no está) y las fuentes de imágenes con cuenta propia (Unsplash, Giphy,
// Pexels: no hay key; la búsqueda de stock va por el selector de imágenes).
//
// ⚠️ ARRASTRAR (HTML5 drag-and-drop): el navegador saca la FOTO que sigue al cursor cuando
// termina el `dragstart` (AGENTS.md), así que el popover se esconde en el tick siguiente, no
// adentro del handler. Y se esconde con opacidad, sin desmontarse: sacar del DOM el nodo que
// origina un arrastre cancela el arrastre en Firefox. Se cierra en `dragend`.
// =============================================================================

import { useMemo, useRef, useState, type DragEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { BLOQUES, CATEGORIAS_BLOQUE, buscarBloques, type CategoriaBloque, type DefBloque, type IdBloque } from '@/lib/editor-landing/catalogo-bloques';
import { useEditorLanding } from './contexto';
import { insertarBloque, seccionPorId, seccionesDe, type OpInsertar } from './insertar';
import { Flotante, Ico, type Ancla } from './MenuDocumento';

/** El tipo con que viaja un bloque arrastrado desde el popover (lo lee el lienzo al soltar). */
export const TIPO_ARRASTRE_BLOQUE = 'application/x-gma-bloque';

/** Lo que dice la navegación y la cabeza de cada categoría (los textos de Gamma en español). */
const CATEGORIA: Record<CategoriaBloque, { corto: string; sub: string; icono: string }> = {
  'Bloques básicos': { corto: 'Bloques', sub: 'Añade elementos comunes como texto.', icono: 'texto-aa' },
  'Herramientas de MaKo': { corto: 'MaKo', sub: 'Agenda, VSL y botón de pago.', icono: 'destellos' },
  'Diseños optimizados': { corto: 'Diseños', sub: 'Visualiza tu texto con diseños.', icono: 'opt-cajas' },
  'Formularios y botones': { corto: 'Formularios', sub: 'Añade elementos de entrada interactivos.', icono: 'formulario' },
  'Imágenes': { corto: 'Imágenes', sub: 'Carga o busca imágenes.', icono: 'imagen' },
  'Videos y multimedia': { corto: 'Videos', sub: 'Carga o importa medios desde plataformas populares.', icono: 'video' },
  'Incrustaciones': { corto: 'Incrustaciones', sub: 'Visualiza páginas web y aplicaciones externas.', icono: 'insertar' },
  'Gráficos y diagramas': { corto: 'Gráficos', sub: 'Visualiza datos e información.', icono: 'grafico-barras' },
  'Tablas': { corto: 'Tablas', sub: 'Ordena datos en filas y columnas.', icono: 'tabla' },
};

/**
 * Inserta un bloque del catálogo con `insertarBloque` (./insertar), SIEMPRE con una posición:
 * así un bloque de texto se INSERTA como bloque nuevo (después del bloque del cursor, o en su
 * lugar si la línea está vacía) en vez de convertir la línea donde estaba el cursor, que es lo
 * que hace el menú «/» y no lo que hace «Agregar bloque» en Gamma.
 *
 * La posición: la soltada en el lienzo; si no, la del cursor si el editor tiene el foco; si no,
 * el final de la sección activa (la que la persona está mirando: Gamma inserta «en el módulo
 * más visible»). `TextSelection.near`: una posición puede caer ENTRE dos secciones (nivel del
 * doc), donde no hay texto, y `near` busca el texto más cercano.
 *
 * Los bloques de imagen y video abren el selector (`elegirImagen`) y esperan la URL: por eso la
 * inserción es una promesa y esto devuelve si ARRANCÓ, no si terminó.
 */
export function insertarBloqueEn(
  editor: Editor | null,
  id: IdBloque,
  op: { pos?: number | null; tarjetaActiva?: string | null; elegirImagen?: OpInsertar['elegirImagen'] } = {},
): boolean {
  if (!editor || editor.isDestroyed) return false;
  try {
    const { doc } = editor.state;
    let pos: number;
    if (typeof op.pos === 'number' && op.pos >= 0 && op.pos <= doc.content.size) {
      pos = op.pos;
    } else if (editor.isFocused) {
      pos = editor.state.selection.from;
    } else {
      const s = seccionPorId(doc, op.tarjetaActiva ?? null) ?? seccionesDe(doc)[0] ?? null;
      pos = s ? TextSelection.near(doc.resolve(s.pos + s.nodo.nodeSize - 1), -1).from : editor.state.selection.from;
    }
    void insertarBloque(editor, id, { pos, elegirImagen: op.elegirImagen }).catch((e) => {
      console.warn('[editor-landing] no pude insertar el bloque', id, e);
    });
    return true;
  } catch (e) {
    console.warn('[editor-landing] no pude insertar el bloque', id, e);
    return false;
  }
}

export default function AgregarBloque({ ancla, onCerrar }: { ancla: Ancla | null; onCerrar: () => void }) {
  const { editor, tarjetaActiva, avisar, elegirImagen } = useEditorLanding();
  const [categoria, setCategoria] = useState<CategoriaBloque>(CATEGORIAS_BLOQUE[0]);
  const [busqueda, setBusqueda] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // El cursor de CUANDO SE ABRIÓ. El botón de la barra no le saca el foco al editor (preventDefault),
  // pero el buscador de este popover se lo lleva al montar: al elegir una tarjeta `editor.isFocused`
  // ya es false y `insertarBloqueEn` caía siempre al final de la sección (medido el 11/10/2026: el
  // cursor después del primer párrafo y el bloque al fondo). El primer render corre antes del foco.
  const [posAlAbrir] = useState<number | null>(() => (editor && !editor.isDestroyed && editor.isFocused ? editor.state.selection.from : null));

  const q = busqueda.trim();
  const items: readonly DefBloque[] = useMemo(
    () => (q ? buscarBloques(q) : BLOQUES.filter((b) => b.categoria === categoria)),
    [q, categoria],
  );

  const elegir = (b: DefBloque) => {
    onCerrar();
    if (!insertarBloqueEn(editor, b.id, { pos: posAlAbrir, tarjetaActiva, elegirImagen })) avisar('No se pudo insertar');
  };

  const empezarArrastre = (e: DragEvent<HTMLButtonElement>, b: DefBloque) => {
    e.dataTransfer.setData(TIPO_ARRASTRE_BLOQUE, b.id);
    e.dataTransfer.setData('text/plain', b.nombre);
    e.dataTransfer.effectAllowed = 'copy';
    // La foto del arrastre se toma al terminar este handler: el popover se esconde DESPUÉS.
    window.setTimeout(() => setArrastrando(true), 0);
  };

  const cab = q ? null : CATEGORIA[categoria];

  return (
    <Flotante
      ancla={ancla}
      onCerrar={onCerrar}
      className="gma-pop"
      etiqueta="Agregar bloque"
      rol="dialog"
      sinCerrarAfuera={arrastrando}
      enfocar
      dataAttrs={{ arrastrando: arrastrando ? 'si' : 'no' }}
    >
      <label className="gma-pop-buscar">
        <Ico n="buscar" t={16} />
        <input
          ref={inputRef}
          className="gma-pop-input"
          type="text"
          value={busqueda}
          placeholder="Buscar todos los bloques"
          aria-label="Buscar todos los bloques"
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && items[0]) { e.preventDefault(); elegir(items[0]); } }}
        />
        {busqueda ? (
          <button type="button" className="gma-herr-boton" aria-label="Borrar búsqueda"
            onClick={() => { setBusqueda(''); inputRef.current?.focus(); }}>
            <Ico n="cerrar" t={14} />
          </button>
        ) : null}
      </label>
      <div className="gma-pop-cuerpo">
        <nav className="gma-pop-nav" aria-label="Categorías">
          {CATEGORIAS_BLOQUE.map((c) => (
            <button
              key={c}
              type="button"
              className="gma-pop-nav-item"
              data-activo={!q && c === categoria ? 'si' : undefined}
              onClick={() => { setCategoria(c); setBusqueda(''); }}
            >
              <Ico n={CATEGORIA[c].icono} t={16} />
              {CATEGORIA[c].corto}
            </button>
          ))}
        </nav>
        <section className="gma-pop-panel">
          <div className="gma-pop-cabeza">
            {cab ? <span className="gma-tile-icono"><Ico n={cab.icono} t={20} /></span> : null}
            <div>
              <h2 className="gma-pop-titulo">{cab ? categoria : 'Resultados'}</h2>
              {cab ? <p className="gma-pop-sub">{cab.sub}</p> : null}
            </div>
          </div>
          {items.length ? (
            <div className="gma-pop-grilla">
              {items.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="gma-tile"
                  draggable
                  aria-label={`${b.nombre}: ${b.ayuda}`}
                  title={`Arrastra para insertar · ${b.ayuda}`}
                  onClick={() => elegir(b)}
                  onDragStart={(e) => empezarArrastre(e, b)}
                  onDragEnd={() => { setArrastrando(false); onCerrar(); }}
                >
                  <span className="gma-tile-asa"><Ico n="arrastrar" t={14} /></span>
                  <span className="gma-tile-icono"><Ico n={b.icono} t={20} /></span>
                  <span className="gma-tile-nombre">{b.nombre}</span>
                  <span className="gma-tile-ayuda">{b.ayuda}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="gma-pop-vacio">No se han encontrado bloques</div>
          )}
        </section>
      </div>
    </Flotante>
  );
}
