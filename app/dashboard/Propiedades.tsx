'use client';

// =============================================================================
// Propiedades — el panel de un gráfico elegido: sólo su CONTENIDO (puntos 8, 10 y 11; tanda v5, punto 9)
// =============================================================================
// Martín, 11/10/2026: «no permitas editar el estilo de cada componente» (el estilo es de la hoja:
// ./PanelEstilo.tsx), «si no tengo seleccionado nada que desaparezca, y que si selecciono algo que
// aparezca» y, sin el panel «Datos», el riel de la derecha «pierde sentido».
//
// TANDA v5 (12/10/2026, punto 9: el panel «sin textos de más y con un orden que tenga sentido»). El orden, de
// arriba abajo, es el de las preguntas que se hace quien arma un gráfico:
//   1. QUÉ DATOS: el conjunto, la fecha que cuenta, la dimensión, el desglose, las métricas, el orden, cuántas filas.
//   2. FILTROS: el período es el PRIMER renglón (la sección «Período» se fue: era la misma pregunta que un control
//      de período y, con los dos, el control ganaba y la sección mentía). Muestra los filtros de DEFINICIÓN
//      (`ControlVista.fijo`: lo que define la tarjeta, que quien mira no ve) y los que quien mira puede cambiar;
//      «A la vista» decide cuál es cuál.
//   3. LO DEL TIPO: comparar, la métrica chica y «ocultar si da cero» (un número); el objetivo (bala, indicador);
//      la tabla (total, columnas, vacíos, orden, acciones, búsqueda); la barra; los ejes, las referencias y el
//      color de una dispersión; el país y el nivel de un mapa.
//   4. EL ENCABEZADO: título y subtítulo.
//   5. LA INTERACCIÓN: qué abre un clic (el detalle, un pop-up o nada) y el botón de MaKo de la tarjeta.
//   6. Duplicar y Eliminar.
//
// Lo que SE FUE (textos de más, punto 9): la sección «Período» entera con «El de la hoja» / «Uno propio» y sus dos
// ayudas («Sigue al filtro de período de la hoja; sin filtro, los últimos 30 días.» y «Esta fecha es la foto de
// hoy: no usa período.»); «Este conjunto no tiene otra dimensión.» (si no hay desglose posible, la sección no se
// dibuja); el título «Filtros de este gráfico» (ahora «Filtros»); y el panel de un BLOQUE con su línea de
// descripción (los bloques se migran en el saneo, lib/graficos-migrar-v5.ts: no queda ninguno que elegir).
//
// ⚠️ Los textos (título, subtítulo, objetivo) se guardan AL SALIR del campo, no en cada tecla: cada
//    cambio es un paso del deshacer y un autoguardado, y veinte por un título son veinte pasos.
// ⚠️ Un campo opcional de v5 se apaga MANDANDO SU VALOR DE SIEMPRE (false, undefined): el saneo
//    (`sanearGrafico`) sólo guarda lo que no vale lo de siempre, así un gráfico de antes guarda lo mismo.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Switch } from '@/app/_ui';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { BotonBorrar, BotonCerrar } from '@/app/_ui/BotonBorrar';
import {
  ENTIDADES, FUENTES, LIMITES, MAX_CONTROLES, PRESET_AUTOMATICO, desglosesPara, dimensionesPara, fuenteDe, metricaDe, metricasPara, nombrePreset, tipoDe, tituloDe,
  type Area, type ControlVista, type Dimension, type Grafico, type Hoja, type Metrica,
} from '@/lib/graficos-catalogo';
import { campoDeDimension, nuevoControlPara, resumenControl, tituloControl } from '@/lib/graficos-controles-texto';
import { ORDEN_ROTULOS } from '@/lib/graficos-gordo';
import { EditorControlesComp } from './BarraControles';
import { Flotante, IconoTipo, SvgCalendario, SvgFlecha, SvgLupa } from './Galeria';
import { esTarjetaNumero } from './Grafico';
import { popupInicial } from './Popup';

const ICONO_AREA: Record<Area, NombreIconoMenu> = {
  Negocio: 'dinero', Marketing: 'anuncio', 'CRM y ventas': 'persona', 'Comunicación': 'whatsapp', Automations: 'repetir',
  Plan: 'plan', 'Customer Success': 'cliente', 'Second Brain': 'archivo', Onboarding: 'check', 'IA y contenido': 'mako',
};
const iconoFuente = (id: string) => ICONO_AREA[fuenteDe(id)?.area ?? 'Negocio'];
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** El período primero: es el primer renglón de «Filtros» (el resto, en su orden). */
export const periodoPrimero = (cs: readonly ControlVista[]): ControlVista[] => [...cs.filter((c) => c.tipo === 'periodo'), ...cs.filter((c) => c.tipo !== 'periodo')];

/** Los rótulos de cada cuadrante, en el orden de ORDEN_ROTULOS (lib/graficos-gordo.ts, el de la migración). */
const NOMBRE_CUADRANTE: Record<(typeof ORDEN_ROTULOS)[number], string> = {
  'arriba-izquierda': 'Arriba a la izquierda', 'arriba-derecha': 'Arriba a la derecha', 'abajo-izquierda': 'Abajo a la izquierda', 'abajo-derecha': 'Abajo a la derecha',
};

/**
 * Los países, por su nombre en español (Intl.DisplayNames: sin una lista escrita a mano que se quede vieja). Sin
 * los códigos que no son un país (la Unión Europea, «región desconocida» y los reservados de ISO).
 */
const NO_PAISES = new Set(['EU', 'EZ', 'UN', 'ZZ', 'QO', 'XA', 'XB', 'AC', 'CP', 'DG', 'EA', 'IC', 'TA', 'CQ']);
let PAISES: Array<{ id: string; nombre: string }> | null = null;
function paises(): Array<{ id: string; nombre: string }> {
  if (PAISES) return PAISES;
  const out: Array<{ id: string; nombre: string }> = [];
  try {
    const dn = new Intl.DisplayNames(['es'], { type: 'region', fallback: 'none' });
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
      const c = String.fromCharCode(a, b);
      const n = NO_PAISES.has(c) ? undefined : dn.of(c);
      if (n && n !== c) out.push({ id: c, nombre: n });
    }
  } catch { /* sin Intl.DisplayNames: sólo «El de la cuenta» */ }
  out.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
  PAISES = out;
  return out;
}

export function PropsGrafico({ g, hoja, hoy, enPopup = false, onCambiar, onCambiarTipo, onDuplicar, onBorrar, onCerrar, onEditarPopup }: {
  g: Grafico;
  hoja: Hoja;
  hoy: string;
  /** Vive adentro de un pop-up: no hay otro pop-up adentro (sin anidar). */
  enPopup?: boolean;
  onCambiar: (p: Partial<Grafico>) => void;
  onCambiarTipo: (el: HTMLElement) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onCerrar: () => void;
  /** «Editar el pop-up»: el editor pasa a la mini-hoja de este gráfico. */
  onEditarPopup?: () => void;
}) {
  const fuente = fuenteDe(g.fuente)!;
  const info = tipoDe(g.tipo)!;
  const dims = dimensionesPara(fuente, g.tipo);
  const desgs = desglosesPara(fuente, g.tipo, g.dimension);
  const mets = metricasPara(fuente, g.tipo);
  const dim = dims.find((d) => d.id === g.dimension);
  const desg = desgs.find((d) => d.id === g.desglose);
  const porCategoria = dim?.clase === 'categoria';
  const porTiempo = dim?.clase === 'tiempo';
  const usaLimite = porCategoria && info.grupo !== 'Histograma';
  const conObjetivo = info.grupo === 'Bala' || info.grupo === 'Indicador';
  const conTotal = info.grupo === 'Tabla' || info.grupo === 'Tabla dinámica';
  const esTabla = info.grupo === 'Tabla';
  const esKpi = info.grupo === 'Cuadro de resultados';
  const esNumero = esTarjetaNumero(g.tipo);
  const conBarra = g.tipo === 'tabla_barras' || g.tipo === 'tarjetas';
  const esDispersion = info.grupo === 'Dispersión';
  const conAcciones = !!ENTIDADES[g.fuente];
  const conBuscar = esTabla && g.tipo !== 'tarjetas' && !!campoDeDimension(g.fuente, g.dimension);
  const tabla = g.tabla ?? {};
  const cambiarTabla = (p: Partial<NonNullable<Grafico['tabla']>>) => onCambiar({ tabla: { ...tabla, ...p } });
  const columnasPosibles = fuente.dimensiones.filter((d) => d.id !== g.dimension);
  const categorias = fuente.dimensiones.filter((d) => d.clase === 'categoria' && d.id !== g.dimension);

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
        {/* ── 1. Qué datos ── */}
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

        {info.desglose !== 'no' && (desg || desgs.length > 0) && (
          <Seccion titulo={info.grupo === 'Tabla dinámica' ? 'Dimensión de columna' : info.grupo === 'Sankey' ? 'Dimensión de destino' : 'Desglose'}>
            {desg ? (
              <div className="lk-ficha-fila">
                <Elegir boton={<Ficha clase="dim" ico={<TipoCampo d={desg} />} texto={desg.nombre} />} opciones={desgs.map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))} onElegir={(id) => onCambiar({ desglose: id })} />
                {info.desglose === 'opcional' && <button type="button" className="lk-quitar" title="Quitar" aria-label="Quitar el desglose" onClick={() => onCambiar({ desglose: null })}>✕</button>}
              </div>
            ) : (
              <Elegir boton={<span className="lk-agregar">＋ Añadir desglose</span>} opciones={desgs.map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))} onElegir={(id) => onCambiar({ desglose: id })} />
            )}
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

        {/* ── 2. Filtros: el período primero ── */}
        <FiltrosDelGrafico g={g} hoja={hoja} hoy={hoy} onCambiar={onCambiar} />

        {/* ── 3. Lo del tipo ── */}
        {esKpi && (
          <Seccion titulo="Comparar">
            <label className="lk-check"><input type="checkbox" checked={g.comparar} onChange={(e) => onCambiar({ comparar: e.target.checked })} /> Con el período anterior</label>
          </Seccion>
        )}
        {esNumero && (
          <Seccion titulo="Métrica chica">
            <div className="lk-ficha-fila">
              <Elegir
                boton={g.secundaria ? <Ficha clase="met" ico={<Agregacion m={metricaDe(fuente, g.secundaria)} />} texto={metricaDe(fuente, g.secundaria)?.nombre ?? g.secundaria} /> : <span className="lk-agregar">＋ Agregar</span>}
                opciones={fuente.metricas.filter((x) => x.id !== g.metricas[0]).map((x) => ({ id: x.id, nombre: x.nombre, ico: <Agregacion m={x} /> }))}
                onElegir={(id) => onCambiar({ secundaria: id })}
              />
              {g.secundaria && <button type="button" className="lk-quitar" title="Quitar" aria-label="Quitar la métrica chica" onClick={() => onCambiar({ secundaria: undefined })}>✕</button>}
            </div>
            <Switch checked={!!g.ocultarSiCero} onChange={(v) => onCambiar({ ocultarSiCero: v ? true : undefined })} label="Ocultar si da cero" />
          </Seccion>
        )}

        {conObjetivo && (
          <Seccion titulo="Objetivo">
            <CampoNumero etiqueta="Objetivo" valor={g.objetivo} onGuardar={(v) => onCambiar({ objetivo: v })} />
            <CampoNumero etiqueta="Máximo" valor={g.maximo} placeholder="Automático" onGuardar={(v) => onCambiar({ maximo: v })} />
          </Seccion>
        )}

        {conBarra && g.metricas.length > 1 && (
          <Seccion titulo="Barra en">
            <Elegir
              boton={<Ficha clase="met" ico={<Agregacion m={metricaDe(fuente, g.barra ?? g.ordenMetrica ?? g.metricas[0])} />} texto={metricaDe(fuente, g.barra ?? g.ordenMetrica ?? g.metricas[0])?.nombre ?? ''} />}
              opciones={g.metricas.map((id) => ({ id, nombre: metricaDe(fuente, id)?.nombre ?? id, ico: <Agregacion m={metricaDe(fuente, id)} /> }))}
              onElegir={(id) => onCambiar({ barra: id })}
            />
          </Seccion>
        )}

        {conTotal && (
          <Seccion titulo="Tabla">
            <label className="lk-check"><input type="checkbox" checked={g.total} onChange={(e) => onCambiar({ total: e.target.checked })} /> Fila de total</label>
            {esTabla && porTiempo && (
              <>
                <label className="lk-check"><input type="checkbox" checked={!!tabla.sinVacios} onChange={(e) => cambiarTabla({ sinVacios: e.target.checked })} /> Sin filas vacías</label>
                <label className="lk-check"><input type="checkbox" checked={!!tabla.descendente} onChange={(e) => cambiarTabla({ descendente: e.target.checked })} /> De lo más nuevo a lo más viejo</label>
              </>
            )}
            {esTabla && conAcciones && (
              <label className="lk-check"><input type="checkbox" checked={!!tabla.acciones} onChange={(e) => cambiarTabla({ acciones: e.target.checked })} /> Acciones en cada fila</label>
            )}
            {conBuscar && (
              <label className="lk-check"><input type="checkbox" checked={!!tabla.buscar} onChange={(e) => cambiarTabla({ buscar: e.target.checked })} /> Barra de búsqueda</label>
            )}
          </Seccion>
        )}

        {esTabla && columnasPosibles.length > 0 && (
          <Seccion titulo="Columnas">
            <div className="lk-fichas">
              {(tabla.columnas ?? []).map((cid) => {
                const d = fuente.dimensiones.find((x) => x.id === cid);
                return (
                  <div key={cid} className="lk-ficha-fila">
                    <Ficha clase="dim" ico={d ? <TipoCampo d={d} /> : null} texto={d?.nombre ?? cid} />
                    <button type="button" className="lk-quitar" title="Quitar" aria-label={`Quitar ${d?.nombre ?? cid}`} onClick={() => cambiarTabla({ columnas: (tabla.columnas ?? []).filter((x) => x !== cid) })}>✕</button>
                  </div>
                );
              })}
              {(tabla.columnas ?? []).length < 4 && columnasPosibles.some((d) => !(tabla.columnas ?? []).includes(d.id)) && (
                <Elegir boton={<span className="lk-agregar">＋ Añadir columna</span>}
                  opciones={columnasPosibles.filter((d) => !(tabla.columnas ?? []).includes(d.id)).map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))}
                  onElegir={(id) => cambiarTabla({ columnas: [...(tabla.columnas ?? []), id] })} />
              )}
            </div>
          </Seccion>
        )}

        {esDispersion && <OpcionesDispersion g={g} categorias={categorias} onCambiar={onCambiar} />}
        {g.tipo === 'mapa' && <OpcionesMapa g={g} onCambiar={onCambiar} />}

        {/* ── 4. El encabezado ── */}
        <Seccion titulo="Encabezado">
          <CampoTexto valor={g.titulo} placeholder={tituloDe({ ...g, titulo: '' })} max={80} etiqueta="Título" onGuardar={(v) => onCambiar({ titulo: v })} />
          <CampoTexto valor={g.subtitulo} placeholder="Subtítulo" max={80} etiqueta="Subtítulo" onGuardar={(v) => onCambiar({ subtitulo: v })} />
        </Seccion>

        {/* ── 5. La interacción ── */}
        <Seccion titulo="Al hacer clic">
          <Segmentado etiqueta="Al hacer clic" valor={g.alClic ?? 'detalle'}
            opciones={[
              { id: 'detalle', nombre: 'Ver el detalle' },
              ...(enPopup ? [] : [{ id: 'popup' as const, nombre: 'Abrir un pop-up' }]),
              { id: 'nada', nombre: 'Nada' },
            ]}
            onElegir={(v) => onCambiar(v === 'popup' ? { alClic: 'popup', popup: g.popup ?? popupInicial(g) } : { alClic: v === 'nada' ? 'nada' : undefined })} />
          {g.alClic === 'popup' && !enPopup && (
            <>
              <CampoTexto valor={g.popup?.titulo ?? ''} placeholder={tituloDe(g)} max={80} etiqueta="Título del pop-up"
                onGuardar={(v) => onCambiar({ popup: { titulo: v, componentes: g.popup?.componentes ?? [] } })} />
              {onEditarPopup && (
                <button type="button" className="lk-pill" onClick={onEditarPopup}><IconoMenu nombre="editar" size={16} /> Editar el pop-up</button>
              )}
            </>
          )}
        </Seccion>
        {!enPopup && (
          <Seccion>
            <Switch checked={g.mako !== false} onChange={(v) => onCambiar({ mako: v ? undefined : false })} label="Botón de MaKo" />
          </Seccion>
        )}

        <div className="lk-botones">
          <button type="button" className="lk-pill" onClick={onDuplicar}><IconoMenu nombre="duplicar" size={16} /> Duplicar</button>
          <BotonBorrar onClick={onBorrar} texto="Eliminar" title="Eliminar el gráfico" talla="md" />
        </div>
      </div>
    </>
  );
}

/**
 * La sección «Filtros» del panel (punto 9). El período es el primer renglón: sin un control propio, el de la hoja en
 * tenue (tocarlo FIJA uno, que arranca mostrando lo mismo: `nuevoControlPara`); con uno, el editor de siempre. Los
 * controles los edita `EditorControlesComp` (./BarraControles.tsx) y «A la vista» decide cuáles ve quien mira: lo
 * apagado es un filtro de DEFINICIÓN (`fijo`), que se aplica igual pero no se dibuja en la tarjeta.
 */
function FiltrosDelGrafico({ g, hoja, hoy, onCambiar }: { g: Grafico; hoja: Hoja; hoy: string; onCambiar: (p: Partial<Grafico>) => void }) {
  const fuente = fuenteDe(g.fuente);
  const sinRango = !!fuente?.fechas.find((f) => f.id === g.fecha)?.sinRango;
  const periodo = g.controles.find((c) => c.tipo === 'periodo');
  const pHoja = hoja.controles.find((c) => c.tipo === 'periodo');
  const ordenados = periodoPrimero(g.controles);
  const fijarPeriodo = () => {
    if (g.controles.length >= MAX_CONTROLES) return;
    const nuevo = nuevoControlPara('periodo', null, { nivel: 'componente', comp: g, hoja });
    if (nuevo) onCambiar({ controles: [{ ...nuevo, fijo: true }, ...g.controles] });
  };
  const alternarVista = (k: ControlVista) => onCambiar({
    controles: g.controles.map((x) => {
      if (x.id !== k.id) return x;
      if (!x.fijo) return { ...x, fijo: true as const };
      const { fijo: _fijo, ...resto } = x;
      return resto;
    }),
  });
  return (
    <Seccion titulo="Filtros">
      {!sinRango && !periodo && (
        <button type="button" className="lk-fil-hoja" onClick={fijarPeriodo} title="Fijar un período para este gráfico">
          <SvgCalendario /> <span>{pHoja ? resumenControl(pHoja, hoy) : nombrePreset(PRESET_AUTOMATICO)}</span> <span className="lk-fil-tenue">De la hoja</span>
        </button>
      )}
      <EditorControlesComp comp={{ ...g, controles: ordenados }} hoja={hoja} hoy={hoy} onCambiarComp={(p) => onCambiar({ controles: periodoPrimero(p.controles) })} />
      {ordenados.length > 0 && (
        <div className="lk-fil-vista" role="group" aria-label="A la vista">
          <span className="lk-fil-rot">A la vista</span>
          {ordenados.map((k) => (
            <button key={k.id} type="button" className="lk-chip" aria-pressed={!k.fijo} title={k.fijo ? 'Quien mira no lo ve' : 'Quien mira lo puede cambiar'} onClick={() => alternarVista(k)}>
              <IconoMenu nombre={k.fijo ? 'ocultar' : 'ver'} size={13} /> {tituloControl(k)}
            </button>
          ))}
        </div>
      )}
    </Seccion>
  );
}

/** Dispersión y burbujas: los ejes fijos, las líneas de referencia con sus cuatro rótulos y el color por categoría. */
function OpcionesDispersion({ g, categorias, onCambiar }: { g: Grafico; categorias: Dimension[]; onCambiar: (p: Partial<Grafico>) => void }) {
  const ejes = g.ejes ?? {};
  const ref = g.referencias ?? {};
  const rotulos = ref.rotulos ?? ['', '', '', ''];
  const cambiarEje = (k: keyof NonNullable<Grafico['ejes']>, v: number | null) => onCambiar({ ejes: { ...ejes, [k]: v ?? undefined } });
  const cambiarRef = (p: Partial<NonNullable<Grafico['referencias']>>) => onCambiar({ referencias: { ...ref, ...p } });
  const colorPor = categorias.find((d) => d.id === g.colorPor);
  return (
    <>
      <Seccion titulo="Ejes">
        <div className="lk-dos">
          <CampoNumero etiqueta="X desde" valor={ejes.xMin ?? null} placeholder="Automático" onGuardar={(v) => cambiarEje('xMin', v)} />
          <CampoNumero etiqueta="X hasta" valor={ejes.xMax ?? null} placeholder="Automático" onGuardar={(v) => cambiarEje('xMax', v)} />
          <CampoNumero etiqueta="Y desde" valor={ejes.yMin ?? null} placeholder="Automático" onGuardar={(v) => cambiarEje('yMin', v)} />
          <CampoNumero etiqueta="Y hasta" valor={ejes.yMax ?? null} placeholder="Automático" onGuardar={(v) => cambiarEje('yMax', v)} />
        </div>
      </Seccion>
      <Seccion titulo="Referencias">
        <div className="lk-dos">
          <CampoNumero etiqueta="Línea en X" valor={ref.x ?? null} onGuardar={(v) => cambiarRef({ x: v ?? undefined })} />
          <CampoNumero etiqueta="Línea en Y" valor={ref.y ?? null} onGuardar={(v) => cambiarRef({ y: v ?? undefined })} />
        </div>
        {ORDEN_ROTULOS.map((k, i) => (
          <CampoTexto key={k} valor={rotulos[i] ?? ''} placeholder={NOMBRE_CUADRANTE[k]} max={40} etiqueta={NOMBRE_CUADRANTE[k]}
            onGuardar={(v) => {
              const r4 = [...rotulos] as [string, string, string, string];
              r4[i] = v;
              cambiarRef({ rotulos: r4 });
            }} />
        ))}
      </Seccion>
      {categorias.length > 0 && (
        <Seccion titulo="Color por">
          <div className="lk-ficha-fila">
            <Elegir boton={colorPor ? <Ficha clase="dim" ico={<TipoCampo d={colorPor} />} texto={colorPor.nombre} /> : <span className="lk-agregar">＋ Elegir</span>}
              opciones={categorias.map((d) => ({ id: d.id, nombre: d.nombre, ico: <TipoCampo d={d} /> }))} onElegir={(id) => onCambiar({ colorPor: id })} />
            {colorPor && <button type="button" className="lk-quitar" title="Quitar" aria-label="Quitar el color por" onClick={() => onCambiar({ colorPor: undefined })}>✕</button>}
          </div>
        </Seccion>
      )}
    </>
  );
}

/** El mapa: el país (el de la cuenta, o uno elegido con buscador) y a qué nivel se dibuja. */
function OpcionesMapa({ g, onCambiar }: { g: Grafico; onCambiar: (p: Partial<Grafico>) => void }) {
  const mapa = g.mapa ?? { pais: 'auto', nivel: 'region' };
  const lista = useMemo(() => paises(), []);
  const nombre = mapa.pais === 'auto' ? 'El de la cuenta' : lista.find((p) => p.id === mapa.pais)?.nombre ?? mapa.pais;
  return (
    <Seccion titulo="Mapa">
      <Elegir boton={<span className="lk-select">{nombre} <SvgFlecha /></span>}
        opciones={[{ id: 'auto', nombre: 'El de la cuenta' }, ...lista]}
        onElegir={(id) => onCambiar({ mapa: { ...mapa, pais: id } })} />
      <Segmentado etiqueta="Nivel" valor={mapa.nivel}
        opciones={[{ id: 'pais', nombre: 'País' }, { id: 'region', nombre: 'Región' }, { id: 'ciudad', nombre: 'Ciudad' }]}
        onElegir={(v) => onCambiar({ mapa: { ...mapa, nivel: v } })} />
    </Seccion>
  );
}

/** Botones de una sola elección, todos a la vista. */
function Segmentado<T extends string>({ etiqueta, valor, opciones, onElegir }: { etiqueta: string; valor: T; opciones: ReadonlyArray<{ id: T; nombre: string }>; onElegir: (v: T) => void }) {
  return (
    <div className="lk-seg" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === valor} title={o.nombre} onClick={() => { if (o.id !== valor) onElegir(o.id); }}>{o.nombre}</button>
      ))}
    </div>
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

function Seccion({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return <div className="lk-seccion">{titulo && <div className="lk-seccion-tit">{titulo}</div>}{children}</div>;
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
  return <span className="lk-agg">{m?.razon || m?.percentil ? 'AUT' : m?.distinto ? 'CTD' : 'SUM'}</span>;
}
