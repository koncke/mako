'use client';

// =============================================================================
// Propiedades — el panel de un componente elegido: sólo su CONTENIDO (puntos 8, 10 y 11)
// =============================================================================
// Martín, 11/10/2026: «no permitas editar el estilo de cada componente» (el estilo es de la hoja:
// ./PanelEstilo.tsx), «si no tengo seleccionado nada que desaparezca, y que si selecciono algo que
// aparezca» y, sin el panel «Datos», el riel de la derecha «pierde sentido».
//
// Lo que queda de un GRÁFICO es lo que cambia QUÉ dice, no cómo se ve: el conjunto de datos, la fecha
// que decide qué filas entran, la dimensión, el desglose, las métricas, el orden, cuántos grupos, el
// período, el título y el subtítulo, si se compara con el período anterior (KPI), el objetivo y el
// máximo (bala e indicador), la fila de total (tablas) y los controles PROPIOS del gráfico
// (`EditorControlesComp`, ./BarraControles.tsx). De un BLOQUE: título, subtítulo, período y sus
// controles. Duplicar y Eliminar van al pie.
//
// ⚠️ Los textos (título, subtítulo, objetivo) se guardan AL SALIR del campo, no en cada tecla: cada
//    cambio es un paso del deshacer y un autoguardado, y veinte por un título son veinte pasos.

import { useEffect, useState, type ReactNode } from 'react';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { BotonBorrar, BotonCerrar } from '@/app/_ui/BotonBorrar';
import {
  FUENTES, LIMITES, PRESETS, bloqueDe, desglosesPara, dimensionesPara, fuenteDe, metricaDe, metricasPara, nombrePreset, tipoDe, tituloDe,
  type Area, type Bloque, type Dimension, type Grafico, type Hoja, type Metrica, type Preset,
} from '@/lib/graficos-catalogo';
import { EditorControlesComp } from './BarraControles';
import { Flotante, IconoTipo, SvgCalendario, SvgFlecha, SvgLupa } from './Galeria';

const ICONO_AREA: Record<Area, NombreIconoMenu> = {
  Negocio: 'dinero', Marketing: 'anuncio', 'CRM y ventas': 'persona', 'Comunicación': 'whatsapp', Automations: 'repetir',
  Plan: 'plan', 'Customer Success': 'cliente', 'Second Brain': 'archivo', Onboarding: 'check', 'IA y contenido': 'mako',
};
const iconoFuente = (id: string) => ICONO_AREA[fuenteDe(id)?.area ?? 'Negocio'];
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function PropsGrafico({ g, hoja, hoy, onCambiar, onCambiarTipo, onDuplicar, onBorrar, onCerrar }: {
  g: Grafico;
  hoja: Hoja;
  hoy: string;
  onCambiar: (p: Partial<Grafico>) => void;
  onCambiarTipo: (el: HTMLElement) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onCerrar: () => void;
}) {
  const fuente = fuenteDe(g.fuente)!;
  const info = tipoDe(g.tipo)!;
  const dims = dimensionesPara(fuente, g.tipo);
  const desgs = desglosesPara(fuente, g.tipo, g.dimension);
  const mets = metricasPara(fuente, g.tipo);
  const dim = dims.find((d) => d.id === g.dimension);
  const desg = desgs.find((d) => d.id === g.desglose);
  const porCategoria = dim?.clase === 'categoria';
  const usaLimite = porCategoria && info.grupo !== 'Histograma';
  const conObjetivo = info.grupo === 'Bala' || info.grupo === 'Indicador';
  const conTotal = info.grupo === 'Tabla' || info.grupo === 'Tabla dinámica';
  const esKpi = info.grupo === 'Cuadro de resultados';
  const sinRango = !!fuente.fechas.find((f) => f.id === g.fecha)?.sinRango;

  return (
    <>
      <div className="lk-props-cab">
        <IconoTipo tipo={g.tipo} size={22} />
        <button type="button" className="lk-tipo-btn" aria-haspopup="menu" onClick={(e) => onCambiarTipo(e.currentTarget)}>
          <span className="lk-props-nombre">{info.nombre}</span> <SvgFlecha />
        </button>
        <span style={{ flex: 1 }} />
        <BotonCerrar onClick={onCerrar} title="Cerrar el panel" talla="sm" />
      </div>
      <div className="lk-secciones">
        <Seccion titulo="Conjunto de datos">
          <Elegir
            boton={<span className="lk-fuente"><span className="lk-fuente-ico"><IconoMenu nombre={iconoFuente(g.fuente)} size={13} /></span><span className="lk-fuente-nom">{fuente.nombre}</span><SvgFlecha /></span>}
            opciones={FUENTES.map((f) => ({ id: f.id, nombre: f.nombre, grupo: f.area, ico: <span className="lk-fuente-ico lk-fuente-ico--chico"><IconoMenu nombre={iconoFuente(f.id)} size={11} /></span> }))}
            onElegir={(id) => onCambiar({ fuente: id })}
          />
        </Seccion>

        {fuente.fechas.length > 1 && (
          <Seccion titulo="Fecha que cuenta">
            <Elegir
              boton={<Ficha clase="dim" ico={<SvgCalendario />} texto={fuente.fechas.find((f) => f.id === g.fecha)?.nombre ?? ''} />}
              opciones={fuente.fechas.map((f) => ({ id: f.id, nombre: f.nombre, ico: <SvgCalendario /> }))}
              onElegir={(id) => onCambiar({ fecha: id })}
            />
          </Seccion>
        )}

        {dims.length > 0 && (
          <Seccion titulo={info.grupo === 'Tabla dinámica' ? 'Dimensión de fila' : 'Dimensión'}>
            <Elegir
              boton={<Ficha clase="dim" ico={dim ? <TipoCampo d={dim} /> : null} texto={dim?.nombre ?? 'Elegir'} />}
              opciones={dims.map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))}
              onElegir={(id) => onCambiar({ dimension: id })}
            />
          </Seccion>
        )}

        {info.desglose !== 'no' && (
          <Seccion titulo={info.grupo === 'Tabla dinámica' ? 'Dimensión de columna' : info.grupo === 'Sankey' ? 'Dimensión de destino' : 'Desglose'}>
            {desg ? (
              <div className="lk-ficha-fila">
                <Elegir boton={<Ficha clase="dim" ico={<TipoCampo d={desg} />} texto={desg.nombre} />} opciones={desgs.map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))} onElegir={(id) => onCambiar({ desglose: id })} />
                {info.desglose === 'opcional' && <button type="button" className="lk-quitar" title="Quitar" aria-label="Quitar el desglose" onClick={() => onCambiar({ desglose: null })}>✕</button>}
              </div>
            ) : desgs.length ? (
              <Elegir boton={<span className="lk-agregar">＋ Añadir desglose</span>} opciones={desgs.map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))} onElegir={(id) => onCambiar({ desglose: id })} />
            ) : <p className="lk-ayuda">Este conjunto no tiene otra dimensión.</p>}
          </Seccion>
        )}

        <Seccion titulo={info.maxMetricas > 1 ? (info.grupo === 'Embudo de conversión' ? 'Pasos del embudo' : 'Métricas') : 'Métrica'}>
          <div className="lk-fichas">
            {g.metricas.map((mid, i) => {
              const met = metricaDe(fuente, mid);
              return (
                <div key={`${mid}-${i}`} className="lk-ficha-fila">
                  <Elegir
                    boton={<Ficha clase="met" ico={<Agregacion m={met} />} texto={met?.nombre ?? mid} />}
                    opciones={mets.filter((x) => x.id === mid || !g.metricas.includes(x.id)).map((x) => ({ id: x.id, nombre: x.nombre, ico: <Agregacion m={x} /> }))}
                    onElegir={(id) => onCambiar({ metricas: g.metricas.map((x, j) => (j === i ? id : x)) })}
                  />
                  {g.metricas.length > info.minMetricas && (
                    <button type="button" className="lk-quitar" aria-label={`Quitar ${met?.nombre ?? mid}`} title="Quitar" onClick={() => onCambiar({ metricas: g.metricas.filter((_, j) => j !== i) })}>✕</button>
                  )}
                </div>
              );
            })}
            {g.metricas.length < info.maxMetricas && mets.some((x) => !g.metricas.includes(x.id)) && (
              <Elegir boton={<span className="lk-agregar">＋ Añadir métrica</span>}
                opciones={mets.filter((x) => !g.metricas.includes(x.id)).map((x) => ({ id: x.id, nombre: x.nombre, ico: <Agregacion m={x} /> }))}
                onElegir={(id) => onCambiar({ metricas: [...g.metricas, id] })} />
            )}
          </div>
        </Seccion>

        {porCategoria && (
          <Seccion titulo="Ordenar">
            <Elegir
              boton={<Ficha clase="met" ico={<Agregacion m={metricaDe(fuente, g.ordenMetrica ?? g.metricas[0])} />} texto={metricaDe(fuente, g.ordenMetrica ?? g.metricas[0])?.nombre ?? ''} />}
              opciones={g.metricas.map((id) => ({ id, nombre: metricaDe(fuente, id)?.nombre ?? id, ico: <Agregacion m={metricaDe(fuente, id)} /> }))}
              onElegir={(id) => onCambiar({ ordenMetrica: id })}
            />
            <div className="lk-radios">
              <label><input type="radio" checked={!g.ordenAsc} onChange={() => onCambiar({ ordenAsc: false })} /> De mayor a menor</label>
              <label><input type="radio" checked={g.ordenAsc} onChange={() => onCambiar({ ordenAsc: true })} /> De menor a mayor</label>
            </div>
          </Seccion>
        )}

        {usaLimite && (
          <Seccion titulo={info.grupo === 'Circular' ? 'Porciones' : info.grupo === 'Barras' ? 'Barras' : 'Filas'}>
            <Elegir boton={<span className="lk-select">{g.limite} <SvgFlecha /></span>} opciones={LIMITES.map((n) => ({ id: String(n), nombre: String(n) }))} onElegir={(id) => onCambiar({ limite: Number(id) })} />
          </Seccion>
        )}

        <Seccion titulo="Período">
          {sinRango ? <p className="lk-ayuda">Esta fecha es la foto de hoy: no usa período.</p> : (
            <SelectorPeriodoComp periodo={g.periodo} desde={g.desde} hasta={g.hasta} hoy={hoy} onCambiar={onCambiar} />
          )}
        </Seccion>

        <Seccion titulo="Encabezado">
          <CampoTexto valor={g.titulo} placeholder={tituloDe({ ...g, titulo: '' })} max={80} etiqueta="Título" onGuardar={(v) => onCambiar({ titulo: v })} />
          <CampoTexto valor={g.subtitulo} placeholder="Subtítulo" max={80} etiqueta="Subtítulo" onGuardar={(v) => onCambiar({ subtitulo: v })} />
        </Seccion>

        {esKpi && (
          <Seccion titulo="Comparar">
            <label className="lk-check"><input type="checkbox" checked={g.comparar} onChange={(e) => onCambiar({ comparar: e.target.checked })} /> Con el período anterior</label>
          </Seccion>
        )}

        {conObjetivo && (
          <Seccion titulo="Objetivo">
            <CampoNumero etiqueta="Objetivo" valor={g.objetivo} onGuardar={(v) => onCambiar({ objetivo: v })} />
            <CampoNumero etiqueta="Máximo" valor={g.maximo} placeholder="Automático" onGuardar={(v) => onCambiar({ maximo: v })} />
          </Seccion>
        )}

        {conTotal && (
          <Seccion titulo="Total">
            <label className="lk-check"><input type="checkbox" checked={g.total} onChange={(e) => onCambiar({ total: e.target.checked })} /> Fila de total</label>
          </Seccion>
        )}

        <Seccion titulo="Filtros de este gráfico">
          <EditorControlesComp comp={g} hoja={hoja} hoy={hoy} onCambiarComp={(p) => onCambiar(p)} />
        </Seccion>

        <div className="lk-botones">
          <button type="button" className="lk-pill" onClick={onDuplicar}><IconoMenu nombre="duplicar" size={16} /> Duplicar</button>
          <BotonBorrar onClick={onBorrar} texto="Eliminar" title="Eliminar el gráfico" talla="md" />
        </div>
      </div>
    </>
  );
}

export function PropsBloque({ b, hoja, hoy, onCambiar, onDuplicar, onBorrar, onCerrar }: {
  b: Bloque;
  hoja: Hoja;
  hoy: string;
  onCambiar: (p: Partial<Bloque>) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onCerrar: () => void;
}) {
  const info = bloqueDe(b.bloque);
  return (
    <>
      <div className="lk-props-cab">
        <IconoMenu nombre="grafico" size={20} />
        <span className="lk-props-nombre">{info?.nombre ?? 'Bloque'}</span>
        <BotonCerrar onClick={onCerrar} title="Cerrar el panel" talla="sm" />
      </div>
      {info?.linea && <p className="lk-props-linea">{info.linea}</p>}
      <div className="lk-secciones">
        <Seccion titulo="Encabezado">
          <CampoTexto valor={b.titulo} placeholder={tituloDe({ ...b, titulo: '' })} max={80} etiqueta="Título" onGuardar={(v) => onCambiar({ titulo: v })} />
          <CampoTexto valor={b.subtitulo} placeholder="Subtítulo" max={80} etiqueta="Subtítulo" onGuardar={(v) => onCambiar({ subtitulo: v })} />
        </Seccion>
        <Seccion titulo="Período">
          <SelectorPeriodoComp periodo={b.periodo} desde={b.desde} hasta={b.hasta} hoy={hoy} onCambiar={onCambiar} />
        </Seccion>
        <Seccion titulo="Filtros de este bloque">
          <EditorControlesComp comp={b} hoja={hoja} hoy={hoy} onCambiarComp={(p) => onCambiar(p)} />
        </Seccion>
        <div className="lk-botones">
          <button type="button" className="lk-pill" onClick={onDuplicar}><IconoMenu nombre="duplicar" size={16} /> Duplicar</button>
          <BotonBorrar onClick={onBorrar} texto="Eliminar" title="Eliminar el bloque" talla="md" />
        </div>
      </div>
    </>
  );
}

/** El período propio de un componente: «De la hoja» (sigue a la barra de arriba) o uno elegido. */
function SelectorPeriodoComp({ periodo, desde, hasta, hoy, onCambiar }: {
  periodo: Preset | 'auto'; desde: string | null; hasta: string | null; hoy: string;
  onCambiar: (p: { periodo?: Preset | 'auto'; desde?: string | null; hasta?: string | null }) => void;
}) {
  return (
    <>
      <div className="lk-radios">
        <label><input type="radio" checked={periodo === 'auto'} onChange={() => onCambiar({ periodo: 'auto' })} /> El de la hoja</label>
        <label><input type="radio" checked={periodo !== 'auto'} onChange={() => onCambiar({ periodo: 'ult30' })} /> Uno propio</label>
      </div>
      {periodo !== 'auto' ? (
        <Elegir boton={<span className="lk-select">{nombrePreset(periodo)} <SvgFlecha /></span>} opciones={PRESETS.map((p) => ({ id: p.id, nombre: p.nombre, ico: <SvgCalendario /> }))}
          onElegir={(id) => onCambiar(id === 'personalizado' ? { periodo: 'personalizado', desde: desde ?? hoy, hasta: hasta ?? hoy } : { periodo: id as Preset })} />
      ) : <p className="lk-ayuda">Sigue al filtro de período de la hoja; sin filtro, los últimos 30 días.</p>}
      {periodo === 'personalizado' && (
        <div className="lk-fechas">
          <label>Desde <input type="date" className="lk-input" value={desde ?? ''} max={hasta ?? hoy} onChange={(e) => onCambiar({ desde: e.target.value })} /></label>
          <label>Hasta <input type="date" className="lk-input" value={hasta ?? ''} min={desde ?? undefined} max={hoy} onChange={(e) => onCambiar({ hasta: e.target.value })} /></label>
        </div>
      )}
    </>
  );
}

/** Un texto que se guarda al salir (o con Enter), no en cada tecla. Escape descarta. */
function CampoTexto({ valor, onGuardar, placeholder, max, etiqueta }: { valor: string; onGuardar: (v: string) => void; placeholder?: string; max: number; etiqueta: string }) {
  const [v, setV] = useState(valor);
  useEffect(() => { setV(valor); }, [valor]);
  const guardar = () => { const t = v.trim().slice(0, max); if (t !== valor) onGuardar(t); };
  return (
    <input className="lk-input" value={v} placeholder={placeholder} maxLength={max} aria-label={etiqueta}
      onChange={(e) => setV(e.target.value)} onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { e.stopPropagation(); setV(valor); }
      }} />
  );
}

function CampoNumero({ valor, onGuardar, etiqueta, placeholder }: { valor: number | null; onGuardar: (v: number | null) => void; etiqueta: string; placeholder?: string }) {
  const [v, setV] = useState(valor == null ? '' : String(valor));
  useEffect(() => { setV(valor == null ? '' : String(valor)); }, [valor]);
  const guardar = () => {
    const n = v.trim() === '' ? null : Number(v.replace(',', '.'));
    if (n !== null && !Number.isFinite(n)) { setV(valor == null ? '' : String(valor)); return; }
    if (n !== valor) onGuardar(n);
  };
  return (
    <label className="lk-campo-num">{etiqueta}
      <input type="text" inputMode="decimal" className="lk-input" value={v} placeholder={placeholder} aria-label={etiqueta}
        onChange={(e) => setV(e.target.value)} onBlur={guardar} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
    </label>
  );
}

type OpcionElegir = { id: string; nombre: string; grupo?: string; ico?: ReactNode };

/** Una ficha o un botón que abre la lista, como los selectores del panel de Looker. Con buscador a partir de 8. */
export function Elegir({ boton, opciones, onElegir }: { boton: ReactNode; opciones: OpcionElegir[]; onElegir: (id: string) => void }) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const [q, setQ] = useState('');
  const lista = opciones.filter((o) => !q.trim() || norm(`${o.nombre} ${o.grupo ?? ''}`).includes(norm(q.trim())));
  let grupoAnterior: string | undefined;
  return (
    <>
      <button type="button" className="lk-elegir" aria-haspopup="listbox" aria-expanded={!!ancla} onClick={(e) => { const t = e.currentTarget; setQ(''); setAncla((a) => (a ? null : t)); }}>
        {boton}
      </button>
      {ancla && (
        <Flotante ancla={ancla} onCerrar={() => setAncla(null)} ancho={260}>
          <div className="lk-lista" role="listbox">
            {opciones.length > 7 && <div className="lk-buscar lk-buscar--lista"><SvgLupa /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar" /></div>}
            {lista.map((o) => {
              const cab = o.grupo && o.grupo !== grupoAnterior ? <div className="lk-lista-grupo">{o.grupo}</div> : null;
              grupoAnterior = o.grupo;
              return (
                <div key={o.id}>
                  {cab}
                  <button type="button" role="option" aria-selected={false} className="lk-opcion" onClick={() => { setAncla(null); onElegir(o.id); }}>
                    {o.ico} <span>{o.nombre}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </Flotante>
      )}
    </>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div className="lk-seccion"><div className="lk-seccion-tit">{titulo}</div>{children}</div>;
}
/** La ficha de un campo: verde la dimensión, azul la métrica, como en Looker. */
function Ficha({ clase, ico, texto }: { clase: 'dim' | 'met'; ico: ReactNode; texto: string }) {
  return <span className={`lk-ficha lk-ficha--${clase}`}>{ico && <span className="lk-ficha-ico">{ico}</span>}<span className="lk-ficha-txt">{texto}</span></span>;
}
/** El ícono del tipo de una dimensión: el calendario para el tiempo, «ABC» para el texto. */
function TipoCampo({ d }: { d: Dimension }) {
  return d.clase === 'tiempo' ? <SvgCalendario /> : <span className="lk-tipo-campo">ABC</span>;
}
/** La insignia de la agregación: SUM si se suma, CTD si cuenta distintos, AUT si la calcula MaKo. */
function Agregacion({ m }: { m?: Metrica }) {
  return <span className="lk-agg">{m?.razon ? 'AUT' : m?.distinto ? 'CTD' : 'SUM'}</span>;
}
