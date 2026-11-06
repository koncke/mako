'use client';

// =============================================================================
// El modal «Filtros» de los carruseles (6/11/2026): copiado de «Filters & views» de Top Carousels
// (docs/carruseles/referencia-top-carousels/filtros.jpg). A la izquierda los filtros (deslizadores de dos puntas para el múltiplo,
// las interacciones y las láminas; publicado, tipo, de dónde; y «Ocultar tipos» con chips). A la derecha cómo se ve (orden, tamaño
// de tarjeta y la leyenda de colores del múltiplo). Se arma sobre una COPIA: nada cambia hasta «Aplicar».
//
// Sólo filtra por lo que MaKo tiene: el «tema» de la referencia no existe en nuestros datos (sólo el TIPO: lista, tutorial…), así
// que no se inventa; «Ocultar tipos» hace lo que allá hace «Hide topics».
// =============================================================================

import { useMemo, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import {
  FILTROS_INICIALES, NIVELES_MULTIPLO, ORDENES_CARRUSEL, ORIGENES_CARRUSEL, PASOS_MULTIPLO, PERIODOS_CARRUSEL, contadorCorto, filtrarCarruseles,
  type Carrusel, type FiltrosCarrusel, type OrdenCarrusel, type OrigenFiltro, type PeriodoCarrusel,
} from '@/lib/carruseles/explorar';
import type { Formato } from '@/lib/spy-detalle';
import { Deslizador } from './Deslizador';
import s from './explorar.module.css';

const PASOS_INTERACCION = [0, 100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000] as const;
const PASOS_LAMINAS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20] as const;

/** La posición de `v` en `pasos` (el paso más cercano por debajo; 0 = sin mínimo). */
const posDe = (pasos: readonly number[], v: number): number => {
  let p = 0;
  pasos.forEach((x, i) => { if (v >= x) p = i; });
  return p;
};

export function FiltrosCarruselModal({ filtros, carruseles, formatos, dosOrigenes, onAplicar, onCerrar }: {
  filtros: FiltrosCarrusel;
  /** Lo que se está mirando (carruseles o anuncios), para contar cuántos quedan con los filtros elegidos. */
  carruseles: readonly Carrusel[];
  formatos: Array<{ value: Formato; label: string; n: number }>;
  dosOrigenes: boolean;
  onAplicar: (f: Partial<FiltrosCarrusel>) => void;
  onCerrar: () => void;
}) {
  const [f, setF] = useState<FiltrosCarrusel>(filtros);
  const anuncios = f.que === 'anuncios';
  const cuantos = useMemo(() => filtrarCarruseles(carruseles, f, new Set(), Date.now()).length, [carruseles, f]);
  const poner = (c: Partial<FiltrosCarrusel>) => setF((p) => ({ ...p, ...c }));

  const mult: [number, number] = [posDe(PASOS_MULTIPLO, f.outlierMin), f.outlierMax ? posDe(PASOS_MULTIPLO, f.outlierMax) : PASOS_MULTIPLO.length - 1];
  const inter: [number, number] = [posDe(PASOS_INTERACCION, f.interMin ?? 0), f.interMax ? posDe(PASOS_INTERACCION, f.interMax) : PASOS_INTERACCION.length - 1];
  const lams: [number, number] = [posDe(PASOS_LAMINAS, f.lamMin ?? 0), f.lamMax ? posDe(PASOS_LAMINAS, f.lamMax) : PASOS_LAMINAS.length - 1];
  const ordenes = ORDENES_CARRUSEL.filter((o) => (anuncios ? o.value !== 'outlier' && o.value !== 'interaccion' : o.value !== 'aire'));
  const orden = anuncios && (f.orden === 'outlier' || f.orden === 'interaccion') ? 'aire' : f.orden;
  const ocultos = new Set(f.ocultar ?? []);
  const alternarOculto = (v: Formato) => { const n = new Set(ocultos); if (n.has(v)) n.delete(v); else n.add(v); poner({ ocultar: [...n] }); };

  const reiniciar = () => setF({ ...FILTROS_INICIALES, que: f.que, orden: f.que === 'anuncios' ? 'aire' : 'outlier', cta: f.cta, creadores: f.creadores, q: f.q, vista: f.vista });

  return (
    <Modal titulo="Filtros" onCerrar={onCerrar} ancho={900} alto="min(88vh, 720px)" completaEnCelular
      pie={(
        <>
          <button type="button" className={s.textoIzq} onClick={reiniciar}>Quitar filtros</button>
          <button type="button" className={s.secundario} onClick={onCerrar}>Cancelar</button>
          <button type="button" className={s.primario} onClick={() => onAplicar(f)}>Ver {contadorCorto(cuantos)} {anuncios ? (cuantos === 1 ? 'anuncio' : 'anuncios') : (cuantos === 1 ? 'carrusel' : 'carruseles')}</button>
        </>
      )}>
      <div className={s.filtrosModal}>
        <section className={s.bloque} aria-label="Qué mostrar">
          <h3>Qué mostrar</h3>
          <div className={s.dosCol}>
            {!anuncios && (
              <div className={s.campo}>
                <span className={s.etiqueta}>Múltiplo</span>
                <Deslizador nombre="El múltiplo" pasos={PASOS_MULTIPLO} desde={mult[0]} hasta={mult[1]}
                  rotulo={(v, ultimo) => `${v}×${ultimo ? '+' : ''}`}
                  onCambio={(a, b) => poner({ outlierMin: PASOS_MULTIPLO[a], outlierMax: b === PASOS_MULTIPLO.length - 1 ? 0 : PASOS_MULTIPLO[b] })} />
              </div>
            )}
            {!anuncios && (
              <div className={s.campo}>
                <span className={s.etiqueta}>Interacciones</span>
                <Deslizador nombre="Las interacciones" pasos={PASOS_INTERACCION} desde={inter[0]} hasta={inter[1]}
                  rotulo={(v, ultimo) => `${v === 0 ? '0' : contadorCorto(v)}${ultimo ? '+' : ''}`}
                  onCambio={(a, b) => poner({ interMin: PASOS_INTERACCION[a], interMax: b === PASOS_INTERACCION.length - 1 ? 0 : PASOS_INTERACCION[b] })} />
              </div>
            )}
            {!anuncios && (
              <div className={s.campo}>
                <span className={s.etiqueta}>Láminas</span>
                <Deslizador nombre="Las láminas" pasos={PASOS_LAMINAS} desde={lams[0]} hasta={lams[1]}
                  rotulo={(v, ultimo) => `${v}${ultimo ? '+' : ''}`}
                  onCambio={(a, b) => poner({ lamMin: a === 0 ? 0 : PASOS_LAMINAS[a], lamMax: b === PASOS_LAMINAS.length - 1 ? 0 : PASOS_LAMINAS[b], largo: 'todos' })} />
              </div>
            )}
            <label className={s.campo}>
              <span className={s.etiqueta}>Publicado</span>
              <select className={s.select} value={f.periodo} onChange={(e) => poner({ periodo: e.target.value as PeriodoCarrusel })}>
                {PERIODOS_CARRUSEL.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            {formatos.length > 0 && (
              <label className={s.campo}>
                <span className={s.etiqueta}>Tipo</span>
                <select className={s.select} value={f.formato} onChange={(e) => poner({ formato: e.target.value as Formato | '' })}>
                  <option value="">Cualquier tipo</option>
                  {formatos.map((x) => <option key={x.value} value={x.value}>{x.label} ({x.n})</option>)}
                </select>
              </label>
            )}
            {dosOrigenes && (
              <label className={s.campo}>
                <span className={s.etiqueta}>De dónde</span>
                <select className={s.select} value={f.origen} onChange={(e) => poner({ origen: e.target.value as OrigenFiltro })}>
                  {ORIGENES_CARRUSEL.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            )}
            {!anuncios && (
              <label className={s.casilla}>
                <input type="checkbox" checked={f.conImagenes} onChange={(e) => poner({ conImagenes: e.target.checked })} />
                <span>Incluir imágenes sueltas</span>
              </label>
            )}
          </div>
          {formatos.length > 0 && (
            <div className={s.campo}>
              <span className={s.etiqueta}>Ocultar tipos</span>
              <div className={s.chips}>
                {formatos.map((x) => (
                  <button key={x.value} type="button" className={s.chipTipo} aria-pressed={ocultos.has(x.value)} onClick={() => alternarOculto(x.value)}>{x.label}</button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className={s.bloque} aria-label="Cómo verlo">
          <h3>Cómo verlo</h3>
          <label className={s.campo}>
            <span className={s.etiqueta}>Ordenar por</span>
            <select className={s.select} value={orden} onChange={(e) => poner({ orden: e.target.value as OrdenCarrusel })}>
              {ordenes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <div className={s.campo}>
            <span className={s.etiqueta}>Tamaño de la tarjeta</span>
            <div className={s.segmentoDoble} role="radiogroup" aria-label="Tamaño de la tarjeta">
              <button type="button" role="radio" aria-checked={(f.tamano ?? 'grande') === 'grande'} onClick={() => poner({ tamano: 'grande' })}>Grande</button>
              <button type="button" role="radio" aria-checked={f.tamano === 'chico'} onClick={() => poner({ tamano: 'chico' })}>Compacta</button>
            </div>
          </div>
          {!anuncios && (
            <div className={s.campo}>
              <span className={s.etiqueta}>Colores del múltiplo</span>
              <ul className={s.leyenda}>
                {NIVELES_MULTIPLO.map((n) => (
                  <li key={n.id}><span className={s.mult} data-nivel={n.id}>{n.rango}</span> {n.rotulo}</li>
                ))}
              </ul>
              <p className={s.nota}>El múltiplo dice cuántas veces rindió lo que suele rendir la cuenta que lo publicó.</p>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
