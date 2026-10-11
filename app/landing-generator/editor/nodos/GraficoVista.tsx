'use client';

// =============================================================================
// GraficoVista — los «Gráficos inteligentes» de Gamma en el editor
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» En Gamma un gráfico se edita con «Editar gráfico» (una
// planilla en un panel) y «Seleccionar tipo de gráfico» (gamma-ui §5.10). Acá: el
// dibujo es el SVG de grafico-svg.ts (paquete A) —el MISMO que sale publicado— y el
// panel edita los datos: título, tipo, una tabla de categorías × series, mostrar
// valores, leyenda, prefijo y sufijo.
//
// Los textos se guardan como se escriben (el saneo del server los recorta: ver
// FormularioVista, la misma razón) y el dibujo los normaliza solo (svg y spec pasan por
// `normalizarGrafico`). Los números se escriben en un borrador local por celda: «-» o
// «1,» no son números todavía, y si el campo mostrara el número guardado no se podrían
// tipear. Topes: TOPES.categoriasGrafico filas y TOPES.seriesGrafico series.
// Lo que no se copió: la cascada y los «gráficos clásicos» de Gamma (doc.ts tiene siete
// tipos) y la sincronización con Google Sheets.
// PEDIDO al paquete G1: `grafico` → `ReactNodeViewRenderer(GraficoVista)`.
// =============================================================================

import { useMemo, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, FilaMenu, Flotante, Icono, Interruptor, MenuFilas, eliminarBloqueConDeshacer, noRobaFoco } from '../BarraFormato';
import { specGrafico } from '@/lib/editor-landing/especificacion';
import { htmlDeArbol } from '@/lib/editor-landing/grafico-svg';
import { TIPOS_GRAFICO, TOPES, type SerieGrafico, type TipoGrafico } from '@/lib/editor-landing/doc';
import type { Tema } from '@/lib/editor-landing/temas';
import { varsDeTema } from '@/lib/editor-landing/temas';

export const TIPO_GRAFICO: Record<TipoGrafico, { nombre: string; icono: string }> = {
  barras: { nombre: 'Gráfico de barras', icono: 'grafico-barras' },
  columnas: { nombre: 'Gráfico de columnas', icono: 'grafico-columnas' },
  columnasApiladas: { nombre: 'Columnas apiladas', icono: 'grafico-columnas' },
  lineas: { nombre: 'Gráfico de líneas', icono: 'grafico-lineas' },
  area: { nombre: 'Gráfico de área', icono: 'grafico-lineas' },
  circular: { nombre: 'Gráfico circular', icono: 'grafico-circular' },
  dona: { nombre: 'Gráfico de dona', icono: 'grafico-dona' },
};

const LARGO_ETIQUETA = 40;

const CSS_GRAF: string = [
  '.gmx-graf{display:flex;flex-direction:column;gap:6px;padding:4px}',
  '.gmx-graf-tipos{display:flex;flex-wrap:wrap;gap:4px}',
  '.gmx-graf-tabla{overflow:auto;max-height:300px;border:1px solid var(--gmx-borde);border-radius:8px}',
  '.gmx-graf-tabla table{border-collapse:collapse;width:max-content;min-width:100%}',
  '.gmx-graf-tabla th,.gmx-graf-tabla td{padding:3px;border-bottom:1px solid var(--gmx-borde);vertical-align:middle;text-align:left;font-weight:500}',
  '.gmx-graf-tabla th{background:var(--gmx-fondo-2);font-size:12px;color:var(--gmx-texto-2)}',
  '.gmx-graf-tabla .gmx-campo{height:28px;min-width:72px}',
  '.gmx-graf-tabla .gmx-graf-cat{min-width:130px}',
  '.gmx-graf-dos{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
].join('\n');

type Crudo = { tipo: TipoGrafico; titulo: string; categorias: string[]; series: SerieGrafico[]; mostrarValores: boolean; leyenda: boolean; prefijo: string; sufijo: string };

/** Los atributos tal como están guardados, con la forma justa para editarlos (cada serie con un valor por categoría). */
function crudoDe(a: Record<string, unknown>): Crudo {
  const categorias = (Array.isArray(a.categorias) ? a.categorias : []).map((c) => String(c ?? ''));
  const series = (Array.isArray(a.series) ? a.series : []).map((s, i): SerieGrafico => {
    const o = (s && typeof s === 'object' ? s : {}) as { nombre?: unknown; valores?: unknown };
    const vals = Array.isArray(o.valores) ? o.valores : [];
    return { nombre: typeof o.nombre === 'string' ? o.nombre : 'Serie ' + (i + 1), valores: categorias.map((_, j) => (Number.isFinite(Number(vals[j])) ? Number(vals[j]) : 0)) };
  });
  return {
    tipo: (TIPOS_GRAFICO as readonly string[]).includes(String(a.tipo)) ? (a.tipo as TipoGrafico) : 'barras',
    titulo: typeof a.titulo === 'string' ? a.titulo : '',
    categorias,
    series,
    mostrarValores: typeof a.mostrarValores === 'boolean' ? a.mostrarValores : true,
    leyenda: typeof a.leyenda === 'boolean' ? a.leyenda : true,
    prefijo: typeof a.prefijo === 'string' ? a.prefijo : '',
    sufijo: typeof a.sufijo === 'string' ? a.sufijo : '',
  };
}

export function GraficoVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, selected, updateAttributes } = props;
  const ctx = useEditorLanding();
  const [panel, setPanel] = useState<{ tipo: 'editar' | 'tipo'; ancla: HTMLElement } | null>(null);
  // Borrador de las celdas numéricas que se están escribiendo («fila:serie» → lo tipeado).
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const html = useMemo(() => htmlDeArbol(specGrafico(node.attrs)), [node.attrs]);
  const g = crudoDe(node.attrs);
  const activo = (selected || !!panel) && editor.isEditable;

  const poner = (cambio: Partial<Crudo>) => updateAttributes({ ...g, ...cambio });
  const ponerValor = (fila: number, serie: number, texto: string) => {
    setBorrador((b) => ({ ...b, [fila + ':' + serie]: texto }));
    const n = Number(texto.replace(/\s/g, '').replace(',', '.'));
    const valor = Number.isFinite(n) ? n : 0;
    poner({ series: g.series.map((s, k) => (k === serie ? { ...s, valores: s.valores.map((v, j) => (j === fila ? valor : v)) } : s)) });
  };
  const agregarFila = () => {
    if (g.categorias.length >= TOPES.categoriasGrafico) return;
    poner({ categorias: [...g.categorias, 'Categoría ' + (g.categorias.length + 1)], series: g.series.map((s) => ({ ...s, valores: [...s.valores, 0] })) });
  };
  const quitarFila = (fila: number) => {
    if (g.categorias.length <= 1) return;
    setBorrador({});
    poner({ categorias: g.categorias.filter((_, j) => j !== fila), series: g.series.map((s) => ({ ...s, valores: s.valores.filter((_, j) => j !== fila) })) });
  };
  const agregarSerie = () => {
    if (g.series.length >= TOPES.seriesGrafico) return;
    poner({ series: [...g.series, { nombre: 'Serie ' + (g.series.length + 1), valores: g.categorias.map(() => 0) }] });
  };
  const quitarSerie = (serie: number) => {
    if (g.series.length <= 1) return;
    setBorrador({});
    poner({ series: g.series.filter((_, k) => k !== serie) });
  };
  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar, 'Gráfico eliminado');
  };

  return (
    <NodeViewWrapper className="gmx-nv" data-activo={activo ? 'si' : undefined}>
      <EstilosG2 />
      <style href="gmx-graf" precedence="medium">{CSS_GRAF}</style>
      {activo && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          <button type="button" className="gmx-btn" title="Editar gráfico" aria-expanded={panel?.tipo === 'editar'} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { const el = e.currentTarget; setBorrador({}); setPanel((p) => (p?.tipo === 'editar' ? null : { tipo: 'editar', ancla: el })); }}>
            <Icono nombre="lapiz" /><span>Editar gráfico</span>
          </button>
          <button type="button" className="gmx-btn" title="Seleccionar tipo de gráfico" aria-expanded={panel?.tipo === 'tipo'} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { const el = e.currentTarget; setPanel((p) => (p?.tipo === 'tipo' ? null : { tipo: 'tipo', ancla: el })); }}>
            <Icono nombre={TIPO_GRAFICO[g.tipo].icono} /><Icono nombre="chevron-abajo" tam={12} />
          </button>
          <span className="gmx-nv-sep" />
          <button type="button" className="gmx-btn" title="Eliminar" aria-label="Eliminar gráfico" onMouseDown={(e) => e.preventDefault()} onClick={eliminar}>
            <IconoBorrar size={16} />
          </button>
        </div>
      )}
      <div className="gmx-nv-marco" dangerouslySetInnerHTML={{ __html: html }} />

      {panel?.tipo === 'tipo' && (
        <Flotante ancla={panel.ancla} onCerrar={() => setPanel(null)} etiqueta="Tipo de gráfico" ancho={240}>
          <MenuFilas etiqueta="Tipo de gráfico">
            {TIPOS_GRAFICO.map((t) => (
              <FilaMenu key={t} nombre={TIPO_GRAFICO[t].nombre} icono={<Icono nombre={TIPO_GRAFICO[t].icono} />} activo={g.tipo === t ? true : undefined}
                onClick={() => { poner({ tipo: t }); setPanel(null); }} />
            ))}
          </MenuFilas>
        </Flotante>
      )}
      {panel?.tipo === 'editar' && (
        <Flotante ancla={panel.ancla} onCerrar={() => setPanel(null)} etiqueta="Editar gráfico" ancho={500}>
          <PanelDatos g={g} borrador={borrador} tema={ctx.tema} onPoner={poner} onValor={ponerValor}
            onSoltarCelda={(k) => setBorrador((b) => { const n = { ...b }; delete n[k]; return n; })}
            onAgregarFila={agregarFila} onQuitarFila={quitarFila} onAgregarSerie={agregarSerie} onQuitarSerie={quitarSerie} />
        </Flotante>
      )}
    </NodeViewWrapper>
  );
}

export default GraficoVista;

function PanelDatos({ g, borrador, tema, onPoner, onValor, onSoltarCelda, onAgregarFila, onQuitarFila, onAgregarSerie, onQuitarSerie }: {
  g: Crudo;
  borrador: Record<string, string>;
  tema: Tema;
  onPoner: (c: Partial<Crudo>) => void;
  onValor: (fila: number, serie: number, texto: string) => void;
  onSoltarCelda: (clave: string) => void;
  onAgregarFila: () => void;
  onQuitarFila: (fila: number) => void;
  onAgregarSerie: () => void;
  onQuitarSerie: (serie: number) => void;
}) {
  const vars = varsDeTema(tema) as Record<string, string>;
  return (
    <div className="gmx-graf">
      <span className="gmx-rotulo">Título</span>
      <input className="gmx-campo" value={g.titulo} maxLength={120} placeholder="Sin título" aria-label="Título" onChange={(e) => onPoner({ titulo: e.target.value })} />
      <span className="gmx-rotulo">Tipo de gráfico</span>
      <div className="gmx-graf-tipos">
        {TIPOS_GRAFICO.map((t) => (
          <button key={t} type="button" className="gmx-chip" aria-pressed={g.tipo === t} title={TIPO_GRAFICO[t].nombre} onMouseDown={(e) => e.preventDefault()} onClick={() => onPoner({ tipo: t })}>
            <Icono nombre={TIPO_GRAFICO[t].icono} tam={14} />
          </button>
        ))}
      </div>
      <span className="gmx-rotulo">Datos</span>
      <div className="gmx-graf-tabla">
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              {g.series.map((s, k) => (
                <th key={k}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, flex: 'none', background: vars['--gm-paleta-' + ((k % 12) + 1)] ?? '#888888' }} />
                    <input className="gmx-campo" value={s.nombre} maxLength={LARGO_ETIQUETA} aria-label={'Serie ' + (k + 1)}
                      onChange={(e) => onPoner({ series: g.series.map((x, m) => (m === k ? { ...x, nombre: e.target.value } : x)) })} />
                    <button type="button" className="gmx-btn" title="Eliminar serie" aria-label="Eliminar serie" disabled={g.series.length <= 1}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => onQuitarSerie(k)}>
                      <IconoBorrar size={14} />
                    </button>
                  </div>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {g.categorias.map((c, j) => (
              <tr key={j}>
                <td>
                  <input className="gmx-campo gmx-graf-cat" value={c} maxLength={LARGO_ETIQUETA} aria-label={'Categoría ' + (j + 1)}
                    onChange={(e) => onPoner({ categorias: g.categorias.map((x, m) => (m === j ? e.target.value : x)) })} />
                </td>
                {g.series.map((s, k) => {
                  const clave = j + ':' + k;
                  return (
                    <td key={k}>
                      <input className="gmx-campo" inputMode="decimal" value={borrador[clave] ?? String(s.valores[j] ?? 0)} aria-label={s.nombre + ', ' + c}
                        onChange={(e) => onValor(j, k, e.target.value)} onBlur={() => onSoltarCelda(clave)} />
                    </td>
                  );
                })}
                <td>
                  <button type="button" className="gmx-btn" title="Eliminar fila" aria-label="Eliminar fila" disabled={g.categorias.length <= 1}
                    onMouseDown={(e) => e.preventDefault()} onClick={() => onQuitarFila(j)}>
                    <IconoBorrar size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="gmx-chip" disabled={g.categorias.length >= TOPES.categoriasGrafico} onMouseDown={(e) => e.preventDefault()} onClick={onAgregarFila}>
          <Icono nombre="mas" tam={14} /><span>Añadir fila</span>
        </button>
        <button type="button" className="gmx-chip" disabled={g.series.length >= TOPES.seriesGrafico} onMouseDown={(e) => e.preventDefault()} onClick={onAgregarSerie}>
          <Icono nombre="mas" tam={14} /><span>Agregar serie</span>
        </button>
      </div>
      <Interruptor nombre="Mostrar valores" valor={g.mostrarValores} onCambio={(v) => onPoner({ mostrarValores: v })} />
      <Interruptor nombre="Leyenda" valor={g.leyenda} onCambio={(v) => onPoner({ leyenda: v })} />
      <div className="gmx-graf-dos">
        <label>
          <span className="gmx-rotulo">Prefijo</span>
          <input className="gmx-campo" value={g.prefijo} maxLength={8} placeholder="$" onChange={(e) => onPoner({ prefijo: e.target.value })} />
        </label>
        <label>
          <span className="gmx-rotulo">Sufijo</span>
          <input className="gmx-campo" value={g.sufijo} maxLength={8} placeholder="%" onChange={(e) => onPoner({ sufijo: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
