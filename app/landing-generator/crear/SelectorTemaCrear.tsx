'use client';

// =============================================================================
// SelectorTemaCrear — «Temas» de «Personaliza tu landing» (el generador de Gamma)
// =============================================================================
// Gamma, en la pantalla del esquema, abre «Personaliza tu gamma» con «Temas»: «Utiliza
// uno de nuestros temas populares a continuación», una grilla 3×2 de muestras «Título /
// Cuerpo y enlace» y «Ver más» para la galería entera con sus chips (Claro · Oscuro ·
// Profesional · Colorido). La elegida lleva borde azul y «✓ Nombre». Acá es igual, con
// dos cosas propias de MaKo:
//   · el SUGERIDO sale del objetivo de la página (agendar, vender, dejar datos,
//     descargar), mirando qué tema eligió para ese caso la plantilla de la misma
//     categoría (lib/editor-landing/plantillas.ts). Va primero y con el chip
//     «Sugerencia» — el texto de Gamma para lo que propone;
//   · los temas PROPIOS del negocio (Panel → Temas, `landing.temas`) aparecen en «Ver
//     más», como el «Personalizado» de Gamma.
//
// Lo que NO se copia: la grilla de Gamma muestra 10 temas populares de su catálogo
// (Pearl, Soft Coal…); acá son los primeros del catálogo de MaKo (los 18 medidos de
// Gamma van primero en temas.ts, en su orden).
// =============================================================================

import { useMemo, useState } from 'react';
import { TEMAS, TEMA_DEFAULT_ID, temaPorId, type Tema } from '@/lib/editor-landing/temas';
import { PLANTILLAS, type CategoriaPlantilla } from '@/lib/editor-landing/plantillas';
import type { TemaPropio } from '@/lib/editor-landing/api-tipos';
import type { ObjetivoLanding } from '@/lib/landing-spec';
import { Filtros, TileTema } from '../MiniaturaLanding';

/** Qué categoría de plantilla resuelve cada objetivo de la página. */
const CATEGORIA_DE_OBJETIVO: Record<ObjetivoLanding, CategoriaPlantilla> = {
  agendar: 'Agendar',
  vender: 'Vender',
  registrar: 'Captar contactos',
  descargar: 'Captar contactos',
};

/** Cuántos se ven antes de «Ver más» (la grilla 3×2 de Gamma). */
export const TEMAS_POPULARES = 6;

/**
 * El tema que MaKo sugiere para un objetivo: el de la primera plantilla de esa categoría.
 * Si esa plantilla nombra un tema que el catálogo ya no tiene, el default — nunca un id que
 * `temaPorId` resolvería a otra cosa sin avisar.
 */
export function temaSugerido(objetivo: ObjetivoLanding): string {
  const categoria = CATEGORIA_DE_OBJETIVO[objetivo];
  const id = PLANTILLAS.find((p) => p.categoria === categoria)?.tema;
  return id && TEMAS.some((t) => t.id === id) ? id : TEMA_DEFAULT_ID;
}

/** Los que se ven sin «Ver más»: el sugerido primero, después el catálogo en su orden. */
export function temasDestacados(sugerido: string, todos: readonly Tema[] = TEMAS, n = TEMAS_POPULARES): Tema[] {
  const s = todos.find((t) => t.id === sugerido);
  return [...(s ? [s] : []), ...todos.filter((t) => t.id !== sugerido)].slice(0, n);
}

type Filtro = 'todo' | 'personalizado' | 'claro' | 'oscuro' | 'profesional' | 'colorido';

function pasaFiltro(t: Tema, f: Filtro): boolean {
  if (f === 'todo') return true;
  if (f === 'personalizado') return t.id.startsWith('ws:');
  if (f === 'claro' || f === 'oscuro') return t.grupo === f;
  return t.etiquetas.includes(f);
}

export function SelectorTemaCrear({ valor, onCambio, sugerido, propios }: {
  valor: string;
  onCambio: (id: string) => void;
  sugerido: string;
  propios: readonly TemaPropio[];
}) {
  const [verMas, setVerMas] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todo');

  // Los propios resueltos con su base + cambios. Uno que ya no se puede leer resuelve al
  // default (temaPorId nunca devuelve un tema vacío): ése no se lista, o aparecería un
  // segundo «Pewter» con el nombre de otro.
  const temasPropios = useMemo(
    () => propios.map((p) => temaPorId('ws:' + p.id, propios)).filter((t) => t.id.startsWith('ws:')),
    [propios],
  );
  const todos = useMemo(() => [...temasPropios, ...TEMAS], [temasPropios]);

  const visibles = useMemo(() => {
    if (verMas) return todos.filter((t) => pasaFiltro(t, filtro));
    const base = temasDestacados(sugerido);
    // El elegido siempre se ve: si vino de «Ver más», entra adelante y se va el último.
    if (base.some((t) => t.id === valor)) return base;
    const elegido = todos.find((t) => t.id === valor);
    return elegido ? [elegido, ...base.slice(0, TEMAS_POPULARES - 1)] : base;
  }, [verMas, todos, filtro, sugerido, valor]);

  const opcionesFiltro = useMemo(() => [
    { valor: 'todo' as const, texto: 'Todo' },
    ...(temasPropios.length ? [{ valor: 'personalizado' as const, texto: 'Personalizado' }] : []),
    { valor: 'claro' as const, texto: 'Claro' },
    { valor: 'oscuro' as const, texto: 'Oscuro' },
    { valor: 'profesional' as const, texto: 'Profesional' },
    { valor: 'colorido' as const, texto: 'Colorido' },
  ], [temasPropios.length]);

  return (
    <section className="gp-bloque" aria-labelledby="gp-temas-titulo">
      <div className="gp-bloque-cabeza">
        <div>
          <h3 id="gp-temas-titulo" className="gp-bloque-titulo">Temas</h3>
          <p className="gp-bloque-sub">Utiliza uno de nuestros temas populares a continuación</p>
        </div>
        <button type="button" className="gp-btn gp-btn-contorno" onClick={() => setVerMas((v) => !v)} aria-expanded={verMas}>
          {verMas ? 'Ver menos' : 'Ver más'}
        </button>
      </div>
      {verMas && <Filtros valor={filtro} opciones={opcionesFiltro} onCambio={setFiltro} etiqueta="Filtrar temas" />}
      <div className="gp-tema-grilla">
        {visibles.map((t) => (
          <TileTema
            key={t.id}
            tema={t}
            activo={t.id === valor}
            sugerido={t.id === sugerido}
            etiqueta="Elegir tema"
            onClick={() => onCambio(t.id)}
          />
        ))}
      </div>
      {verMas && !visibles.length && <p className="gp-vacio">No se encontraron resultados</p>}
    </section>
  );
}
