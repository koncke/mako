'use client';

// =============================================================================
// SelectorIcono — «Buscar íconos» de Gamma, sobre el catálogo de la landing
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» En Gamma cada ítem de un diseño optimizado puede llevar
// un ícono que se elige de un buscador («Buscar íconos», «No encontramos íconos»,
// «Eliminar ícono»: los textos son los del catálogo de Gamma en español).
//
// El catálogo es el subset de Phosphor de lib/editor-landing/iconos.ts (paquete B) y
// la búsqueda es su `buscarIconos` (por nombre y etiquetas, sin acentos). Se esconden
// los íconos que son de la INTERFAZ del editor (negrita, alinear, flechas de un menú,
// los dibujos de los tipos de bloque): ofrecidos como contenido, se leen como un
// botón que alguien dejó en la página. Gamma tiene miles; acá son los ~250 del subset,
// y lo que no está se pide sumándolo al generador (scripts/gen-iconos-landing.mjs).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { buscarIconos, ICONO_NEUTRO } from '@/lib/editor-landing/iconos';
import { FilaMenu, Flotante, Icono, MenuFilas, type AnclaPanel } from './BarraFormato';

/** Los íconos que dibujan la interfaz del editor y no tienen sentido como contenido. */
const SOLO_INTERFAZ: ReadonlySet<string> = new Set([
  ICONO_NEUTRO, 'negrita', 'cursiva', 'subrayado', 'tachado', 'resaltar', 'color-texto', 'deshacer', 'rehacer',
  'arrastrar', 'puntos', 'puntos-vertical', 'zoom-mas', 'zoom-menos', 'desenlazar', 'pegar', 'copiar', 'duplicar',
  'papelera', 'cerrar', 'mover', 'teclado', 'grilla-mas', 'capas', 'pantalla-completa', 'separador', 'espacio',
]);
const PREFIJOS_INTERFAZ = ['texto-', 'opt-', 'columnas-', 'grafico-', 'alinear-', 'chevron-', 'lista'];

/** ¿Se ofrece como ícono de contenido? */
export function esIconoDeContenido(nombre: string): boolean {
  return !SOLO_INTERFAZ.has(nombre) && !PREFIJOS_INTERFAZ.some((p) => nombre.startsWith(p));
}

const CSS_ICONOS: string = [
  '.gmx-iconos{display:grid;grid-template-columns:repeat(8,34px);gap:4px;padding:6px 2px;max-height:260px;overflow:auto}',
  '.gmx-icono-op{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--gmx-texto);cursor:pointer}',
  '.gmx-icono-op:hover{background:var(--gmx-hover)}',
  '.gmx-icono-op[aria-pressed="true"]{background:var(--gmx-azul-fondo);border-color:var(--gmx-azul-borde);color:var(--gmx-azul-texto)}',
].join('\n');

export function SelectorIcono({ ancla, valor, onElegir, onQuitar, onCerrar }: {
  ancla: AnclaPanel;
  valor: string | null;
  onElegir: (nombre: string) => void;
  onQuitar?: () => void;
  onCerrar: () => void;
}) {
  const [q, setQ] = useState('');
  const campo = useRef<HTMLInputElement | null>(null);
  const lista = useMemo(() => buscarIconos(q).filter(esIconoDeContenido).slice(0, 160), [q]);
  useEffect(() => {
    const id = requestAnimationFrame(() => campo.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <Flotante ancla={ancla} onCerrar={onCerrar} etiqueta="Ícono" ancho={328}>
      <style href="gmx-iconos" precedence="medium">{CSS_ICONOS}</style>
      <input
        ref={campo}
        className="gmx-campo"
        value={q}
        placeholder="Buscar íconos"
        aria-label="Buscar íconos"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && lista[0]) { e.preventDefault(); onElegir(lista[0]); } }}
      />
      {lista.length ? (
        <div className="gmx-iconos" role="listbox" aria-label="Íconos">
          {lista.map((n) => (
            <button
              key={n}
              type="button"
              role="option"
              aria-selected={n === valor}
              aria-pressed={n === valor}
              className="gmx-icono-op"
              title={n.replace(/-/g, ' ')}
              aria-label={n.replace(/-/g, ' ')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onElegir(n)}
            >
              <Icono nombre={n} tam={20} />
            </button>
          ))}
        </div>
      ) : (
        <div className="gmx-vacio">No encontramos íconos</div>
      )}
      {onQuitar && valor && (
        <MenuFilas etiqueta="Ícono">
          <div className="gmx-sep" />
          <FilaMenu nombre="Eliminar ícono" icono={<Icono nombre="cerrar" />} onClick={onQuitar} />
        </MenuFilas>
      )}
    </Flotante>
  );
}

export default SelectorIcono;
