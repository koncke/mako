'use client';

// =============================================================================
// Popup — el POP-UP de un gráfico: una mini-hoja que se abre al hacer clic (tanda v5, punto 7, interfaz I4)
// =============================================================================
// Decisión de la tanda (contrato docs/relevo/dashboard-v5.md): lo que abre un clic deja de estar escrito en el
// código por entidad. Un gráfico con `alClic: 'popup'` guarda adentro una mini-hoja (`Grafico.popup`: los
// mismos componentes que una hoja, sin pop-ups anidados) que se abre con el CONTEXTO de lo clickeado:
// `{ fuente, dimension, valor, ref, metrica }` (+ la entidad que nombra la fila). Adentro:
//   · los gráficos llevan el filtro {campo del clic = valor} INYECTADO como un control fijo de la mini-hoja
//     (con la misma regla de campos compartidos de siempre: un conjunto que no tiene ese campo dice «No filtra
//     por X»), y el período del gráfico de donde se abrió;
//   · las piezas de una ficha (app/dashboard/entidades, otro paquete) y las cajas de IA que leen «lo que se
//     abrió» reciben el `ref` (el id de la fila, `FilaResultado.ref`: el recording_id de una llamada, el ad_id
//     de un anuncio).
//
// Lo que no se ve en la firma:
//   · LOS DATOS SE PIDEN CON `popupDe` (POST /api/graficos, interfaz I5): el server lee cada componente con la
//     definición GUARDADA adentro del gráfico dueño. Al closer le contesta sólo lo de Closing. EDITANDO un pop-up
//     (EditorInforme) se pide SIN `popupDe`: la definición que vale es la de la pantalla, que todavía no se guardó
//     (el autoguardado espera 700 ms y el pedido 250: con `popupDe` el server leería la de antes).
//   · NO SE OFRECE EN UN LINK COMPARTIDO (primera versión): las piezas traen nombres y lo que dijo un lead.
//   · EL `ref` SALE DE LA FILA CLICKEADA, no del clic: `SelDetalle` trae la CLAVE del grupo y el `ref` se busca
//     en el resultado que ya se dibujó (una fila con varias cosas distintas no trae `ref`: no se adivina).

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui';
import {
  ENTIDADES, efectivoDe, esElemento, esGrafico, nuevoId, sanearElemento, tituloDe,
  type ControlVista, type EntidadDetalle, type Grafico, type Hoja,
} from '@/lib/graficos-catalogo';
import { campoDeDimension } from '@/lib/graficos-controles-texto';
import { paletaDe, varsDeTema } from '@/lib/graficos-temas';
import type { Resultado } from '@/lib/graficos-agregar';
import type { DatosGrafico } from '@/lib/graficos-datos';
import { contextoDeClic, entidadDeGrafico, piezaInicial, type ContextoEntidad, type SelDetalle } from '@/lib/graficos-acciones';
import { CuerpoGrafico, esTarjetaNumero, type EstadoDatos } from './Grafico';
import { CuerpoElemento } from './Elemento';
import { enOrden, pedidosDeHoja } from './exportar';
import { pedidoDeLectura } from './lectura-compartida';

/** Lo que se clickeó, con lo que hace falta para abrir su mini-hoja. */
export type ContextoPopup = {
  /** El conjunto del gráfico de donde se abrió. */
  fuente: string;
  /** La dimensión del clic (null = el número entero de una KPI). */
  dimension: string | null;
  /** La CLAVE del grupo clickeado (para el tiempo, la fecha en que empieza). */
  valor: string | null;
  /** Lo que se lee en pantalla del grupo clickeado. */
  etiqueta: string | null;
  /** El id de lo que nombra la fila (una llamada, un anuncio, un lead), si es uno solo. */
  ref: string | null;
  metrica: string | null;
  /** Qué COSA nombra la fila (ENTIDADES de lib/graficos-catalogo.ts): 'llamada', 'anuncio', 'lead'… */
  entidad: EntidadDetalle | null;
  /** Un clic en el TIEMPO: el período de ese día, semana o mes. */
  desde?: string;
  hasta?: string;
};

/** El contexto de un clic: lo que trae `SelDetalle` y, de la fila ya dibujada, su etiqueta, su `ref` y su período. */
export function contextoPopupDe(g: Pick<Grafico, 'fuente'>, sel: SelDetalle, r: Resultado | undefined): ContextoPopup {
  const fila = sel.valor != null ? r?.filas.find((f) => f.clave === sel.valor) : undefined;
  return {
    fuente: g.fuente,
    dimension: sel.dimension,
    valor: sel.valor,
    etiqueta: fila?.etiqueta ?? sel.valor,
    ref: fila?.ref ?? null,
    metrica: sel.metrica ?? null,
    entidad: ENTIDADES[g.fuente]?.entidad ?? null,
    ...(r?.clase === 'tiempo' && fila?.desde && fila?.hasta ? { desde: fila.desde, hasta: fila.hasta } : {}),
  };
}

/** La fila de MUESTRA para editar un pop-up: la primera que el gráfico dueño tiene dibujada. */
export function muestraDe(g: Grafico, r: Resultado | undefined): ContextoPopup | null {
  const fila = r?.filas.find((f) => f.clave && f.clave !== 'Otros');
  if (!fila) return null;
  return contextoPopupDe(g, { dimension: g.dimension, valor: fila.clave, metrica: g.metricas[0] }, r);
}

/**
 * La ENTIDAD que se abrió (una llamada, un anuncio, un lead, con su id), en la forma que leen las piezas de una
 * ficha y las cajas de IA (`ContextoEntidad`, lib/graficos-acciones.ts, del paquete de IA y entidades): la regla
 * es la de allá (`contextoDeClic`), que el server de las cajas también usa para no creerle al navegador.
 */
export const entidadAbierta = (ctx: ContextoPopup | null): ContextoEntidad | null =>
  ctx ? contextoDeClic({ fuente: ctx.fuente, dimension: ctx.dimension, ref: ctx.ref }) : null;

/** Los ids de los controles que la mini-hoja inyecta (fijos: no se dibujan ni los mueve la vista). */
export const ID_PERIODO_POPUP = 'popup-fecha';
export const ID_CLIC_POPUP = 'popup-clic';

/**
 * La HOJA del pop-up: sus componentes, el tema de la hoja, y como controles de la hoja el período del gráfico de
 * donde se abrió (o el del grupo, si se clickeó el tiempo) y el filtro {campo del clic = valor}. Todo FIJO: es la
 * definición de lo que se abrió, no algo para mirar.
 */
export function hojaDelPopup(hoja: Hoja, g: Grafico, ctx: ContextoPopup | null, periodo: { desde: string; hasta: string }): Hoja {
  const controles: ControlVista[] = [];
  const desde = ctx?.desde ?? periodo.desde;
  const hasta = ctx?.hasta ?? periodo.hasta;
  controles.push({ id: ID_PERIODO_POPUP, tipo: 'periodo', campo: null, preset: 'personalizado', desde, hasta, valores: null, texto: '', agrupar: 'auto', fijo: true });
  const campo = ctx ? campoDeDimension(ctx.fuente, ctx.dimension) : null;
  if (campo && ctx?.valor != null) {
    controles.push({ id: ID_CLIC_POPUP, tipo: 'lista', campo, preset: 'ult30', desde: null, hasta: null, valores: [ctx.valor], texto: '', agrupar: 'auto', fijo: true });
  }
  return { ...hoja, componentes: g.popup?.componentes ?? [], controles, conectores: undefined };
}

/**
 * Lo que trae un pop-up recién creado: si cada fila del gráfico nombra una llamada, un anuncio o un lead
 * (`entidadDeGrafico`), su ficha entera (la pieza «completo» de app/dashboard/entidades); si no, vacío. Las
 * plantillas de pop-up partidas en piezas son de otro paquete (lib/graficos-plantillas*.ts).
 */
export function popupInicial(g: Grafico): NonNullable<Grafico['popup']> {
  const tipo = entidadDeGrafico(g);
  if (!tipo) return { titulo: '', componentes: [] };
  const ficha = sanearElemento({ id: nuevoId(), tipo: 'entidad', texto: '', entidad: piezaInicial(tipo), x: 0, y: 0, w: 12, h: 16 }, { enPopup: true });
  return { titulo: '', componentes: ficha ? [ficha] : [] };
}

const aEstado = (d: DatosGrafico | undefined): EstadoDatos => (!d ? { cargando: true } : d.ok ? { cargando: false, resultado: d.resultado } : { cargando: false, error: d.error });

/**
 * El pop-up abierto, MIRANDO. Una caja con la mini-hoja en una grilla CSS (los mismos números que la del lienzo:
 * 12 columnas, filas de 30 y 16 de aire). Sólo lectura: adentro no hay otro pop-up ni el detalle de un número.
 * `onCerrar` con identidad FIJA (AGENTS.md: si no, el foco salta en cada render del Modal).
 */
export function PopupGrafico({ g, hoja, contexto, periodo, hoy, onCerrar, onCambio, puedeGenerar = false }: {
  g: Grafico;
  hoja: Hoja;
  contexto: ContextoPopup;
  periodo: { desde: string; hasta: string };
  hoy: string;
  onCerrar: () => void;
  /** Después de una acción que cambia los datos (una pieza que re-analiza, una acción). */
  onCambio?: () => void;
  /** El admin: una caja de MaKo de adentro se puede volver a generar (el closer la lee y no genera). */
  puedeGenerar?: boolean;
}) {
  const mini = useMemo(() => hojaDelPopup(hoja, g, contexto, periodo), [hoja, g, contexto, periodo]);
  const [version, setVersion] = useState(0);
  const [datos, setDatos] = useState<Record<string, EstadoDatos>>({});
  const colores = useMemo(() => paletaDe(hoja.tema), [hoja.tema]);
  const vars = useMemo(() => varsDeTema(hoja.tema) as CSSProperties, [hoja.tema]);

  useEffect(() => {
    const { graficos } = pedidosDeHoja(mini, {}, hoy, version);
    if (!graficos.length) return;
    let vivo = true;
    (async () => {
      let respuesta: Record<string, DatosGrafico> = {};
      let fallo = false;
      try {
        // El cuerpo de siempre (el contrato de lectura) y `popupDe`: el server lee lo GUARDADO del dueño.
        const { ruta, cuerpo } = pedidoDeLectura({ accion: 'datos', hojaId: hoja.id, pedidos: graficos.map((x) => ({ id: x.g.id, pedido: x.pedido })) }, null);
        const r = await fetch(ruta, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...cuerpo, popupDe: g.id }),
          signal: AbortSignal.timeout(65_000),
        });
        if (!r.ok) fallo = true; else respuesta = (await r.json()).datos ?? {};
      } catch { fallo = true; }
      if (!vivo) return;
      const n: Record<string, EstadoDatos> = {};
      for (const x of graficos) n[x.g.id] = fallo ? { cargando: false, error: 'No pude leer los datos' } : aEstado(respuesta[x.g.id] ?? { ok: false, error: 'Sin respuesta' });
      setDatos(n);
    })();
    return () => { vivo = false; };
  }, [mini, hoy, version, hoja.id, g.id]);

  const refrescar = () => { setVersion((v) => v + 1); onCambio?.(); };
  const ctxElemento = { hoja, popupDe: g.id, abierto: entidadAbierta(contexto), periodo, puedeGenerar, onCambio: refrescar };
  const comps = enOrden(mini.componentes);

  return (
    <Modal titulo={contexto.etiqueta || tituloDe(g)} encabezado={g.popup?.titulo || tituloDe(g)} onCerrar={onCerrar} ancho={980} alto="min(86vh, 820px)" contenedor>
      <div className="lk lk-popup" style={vars}>
        {!comps.length ? <p className="lk-popup-vacio">Este pop-up está vacío.</p> : (
          <div className="lk-popup-grilla">
            {comps.map((c) => {
              const lugar = { '--lk-col': `${c.x + 1} / span ${c.w}`, '--lk-fila': `${c.y + 1} / span ${c.h}` } as CSSProperties;
              if (esElemento(c)) {
                return (
                  <div key={c.id} data-comp={c.id} className="lk-comp lk-comp--elemento" style={lugar}>
                    <CuerpoElemento e={c} colores={colores} editando={false} onCambiar={() => {}} ctx={ctxElemento} />
                  </div>
                );
              }
              if (!esGrafico(c)) return null;
              const est = datos[c.id] ?? { cargando: true };
              const kpi = esTarjetaNumero(c.tipo);
              // El efectivo, para que una tarjeta que no puede filtrar por lo clickeado lo diga.
              const ef = efectivoDe(c, mini, {}, hoy);
              return (
                <div key={c.id} data-comp={c.id} className={`lk-comp${kpi ? ' lk-comp--kpi' : ''}`} style={lugar}>
                  <div className="lk-comp-cab">
                    <div className="lk-comp-tit"><span title={tituloDe(c)}>{tituloDe(c)}</span></div>
                    {ef.noAplica.length > 0 && <span className="lk-sec-cuenta" title={`Sus datos no tienen ${ef.noAplica.join(', ')}`}>No filtra por {ef.noAplica.join(', ')}</span>}
                  </div>
                  {!kpi && c.subtitulo && <div className="lk-comp-sub" title={c.subtitulo}>{c.subtitulo}</div>}
                  <CuerpoGrafico g={c} estado={est} tema={hoja.tema} efectivo={ef} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
