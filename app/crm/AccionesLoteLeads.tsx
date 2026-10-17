'use client';

// =============================================================================
// AccionesLoteLeads — la barra que aparece al tildar leads (tabla y Kanban)
// =============================================================================
// Pedido de Martin el 05/10/2026, textual: «Muy importante que implementes las
// acciones en LOTE, tanto para la vista de tablas como kanban... Copia todo del
// plan. Y piensa que acciones en lote valdria la pena».
//
// ⚠️ POR QUE NO SE IMPORTA `AccionesLote` DEL PLAN. Se midio antes de escribir:
// `BarraLote` (app/plan/board/AccionesLote.tsx) es generica sobre la ENTIDAD y ya
// sirve a dos (tareas y proyectos), asi que la tentacion es pasarle una tercera
// configuracion. No se puede: su firma pide un `Board` y adentro usa
// `board.showUndo`, `board.aplicarCascadaManual`, `board.soltarCandadoManual`,
// `board.labels`, `board.labelById` y `board.repo`. Un lead no tiene board, ni
// score, ni recurrencia, ni proyecto — o sea que de las seis acciones de aquella
// barra, CINCO se apagarian y la sexta (borrar) es la unica compartida.
//
// Lo que SI se comparte, que es lo que hace que las dos se vean y se usen igual:
//   · la clase `.mk-icon-btn` con su `data-tone`, que es donde vive el aspecto;
//   · el `Dropdown` de `app/components/Dropdown` —el mismo control, con el mismo
//     `resetAfterSelect` de un desplegable de ACCION—;
//   · el molde de TRES RANURAS (`flex: 1` en los dos costados y el grupo del medio
//     en `flex: none`), que es lo unico que deja el centro en el centro real;
//   · la casilla marcada de la izquierda que LIMPIA, y el numero al lado con
//     `role="status"`. «El boton de quitar seleccion no debe existir, solamente el
//     check en el mismo lugar, a la izquierda del todo, marcado» (25/09/2026).
// Copiar el COMPORTAMIENTO y compartir el ASPECTO es lo contrario de duplicar la
// pieza: lo que divergeria es el CSS, y el CSS es el que esta compartido.
//
// ─────────────────────────────────────────────────────────────────────────────
// QUE ACCIONES ENTRAN, Y POR QUE ESTAS CUATRO
//
// El criterio no fue «que se puede escribir» sino «que se hace HOY abriendo N
// fichas de a una». Las cuatro salen de eso:
//
//   · ETAPA. Lejos la mas util: mover doce a Nutricion, descartar veinte. Es el
//     gesto que el Kanban ya ofrece de a uno arrastrando.
//   · CLOSER y SETTER. Es el dato que mas se repite en un lote de leads y ya tenia
//     su camino en lote (`BulkHigiene`), pero SOLO para rellenar vacios.
//   · PRODUCTO. ⚠️ AGREGA, NO MUEVE (desde el 06/10/2026). Nacio llamando a
//     `moverLeadsAFunnelAction`, que le cambiaba la casa a cada lead y lo sacaba del
//     tablero donde estaba; Martin: «No se debe "Mover" se debe agregar al otro
//     producto». Ahora es `agregarLoteAProductoAction` (mig 0207): una fila por lead
//     en la etapa de entrada de ese producto, la casa intacta. Y como sumar no saca a
//     nadie de ningun lado, actua AL TOQUE y deja UN Deshacer para el lote entero
//     (el molde de Customer Success), que borra solo las filas que este lote creo.
//
//   · ETIQUETA (mig 0224, 08/10/2026). Pone una etiqueta del CRM a los tildados, AL TOQUE y
//     con UN Deshacer para el lote (como producto: suma y se revierte). ⚠️ EN LOTE NO DISPARA
//     LAS AUTOMATIZACIONES DE ESA ETIQUETA NI MUEVE DE ETAPA (lib/etiquetas-motor.ts, el molde
//     de ManyChat): con una secuencia colgada de «Seguimiento», ponerla a 200 leads seria el
//     envio masivo que el parrafo de abajo deja afuera, entrando por otra puerta.
//
// Y una que se dejo AFUERA a proposito: meter los seleccionados en una secuencia
// de nutricion. Esa es la unica de la lista que MANDA MENSAJES, y la linea de
// WhatsApp del chatbot es la NO OFICIAL: lo que la protege es el ritmo, no una
// API (ver AGENTS.md). Un boton que dispara N conversaciones de una no es una
// accion en lote mas — necesita su propia pantalla, con el ritmo a la vista.
//
// ⚠️ TODA ACCION QUE NO SE DESHACE PREGUNTA ANTES, NOMBRANDO EL NUMERO. No es
// ceremonia: la barra escribe sobre filas que pueden no estar todas a la vista (en el
// Kanban se tilda en cuatro columnas y se scrollea), y etapa, closer/setter y borrar
// no tienen deshacer en lote. Es el molde que ya usa `BulkHigiene` en el propio
// CrmBoard («Asignar Setter "Mauricio" a 12 leads»). PRODUCTO es la excepcion porque
// SI tiene deshacer (ver arriba): preguntar ahi seria friccion sobre algo reversible.
// =============================================================================

import { useImperativeHandle, useState, useTransition } from 'react';
import type { CSSProperties, Ref } from 'react';
import { Confirm, SANS, MONO } from '@/app/_ui';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { IconoFunnel } from '@/app/_ui/iconos-menu';
import { Dropdown } from '@/app/components/Dropdown';
import type { Stage } from '@/lib/pipeline';
import type { MiembroEquipo } from './actions';
import {
  moverLeadsDeEtapaAction,
  eliminarLeadsAction,
  bulkFillLeadFieldAction,
} from './actions';
import { agregarLoteAProductoAction, quitarLoteDeProductoAction } from './lead-funnel-actions';
import { SelectorEtiqueta, type Etiqueta } from '@/app/_components/etiquetas-cliente';

/** Lo minimo que la barra necesita de un lead. No recibe el `CrmLead` entero a
 *  proposito: lo unico que mira es a quien va a escribirle y que tiene puesto. */
export type LeadDeLote = {
  id: number;
  name: string;
  stage: string;
  closer: string;
  setter: string;
};

export type ProductoDeLote = { id: number; nombre: string; esDefault: boolean };

/** Lo que una accion le deja al padre para que lo cante en un toast. */
export type ResultadoLote = {
  texto: string;
  hubo: boolean;
  /**
   * UN deshacer para el lote entero, cuando la accion lo tiene (hoy: agregar a un
   * producto). El padre lo cuelga del «Deshacer» de su aviso: la barra se desmonta al
   * limpiar la seleccion, asi que un aviso propio moriria con ella. Tira si no pudo.
   */
  deshacer?: () => Promise<void>;
};

const btnIcono: CSSProperties = { cursor: 'pointer' };
const estiloDrop: CSSProperties = { height: 34, padding: '0 10px', borderRadius: 9, gap: 5, fontSize: 12.5 };

function IconoEtapa() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="6" rx="1" />
    </svg>
  );
}
function IconoPersona() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconoEtiqueta() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}
type LoteEtiqueta = { ok?: boolean; error?: string; cambiados?: number[]; yaEstaban?: number; sinSincronizar?: number };
async function loteEtiqueta(action: 'poner_lote' | 'sacar_lote', leadIds: number[], etiquetaId: number): Promise<LoteEtiqueta> {
  const r = await fetch('/api/crm/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, leadIds, etiquetaId }) });
  return r.json() as Promise<LoteEtiqueta>;
}


/** Lo que se esta por hacer, ya elegido y todavia sin confirmar. */
type Pendiente =
  | { tipo: 'etapa'; stage: Stage }
  | { tipo: 'persona'; campo: 'closer' | 'setter'; valor: string; pisa: number }
  | { tipo: 'borrar' };

/**
 * Los funnels a los que se puede AGREGAR la seleccion: todos menos el que se esta mirando (ahi ya estan
 * todos los tildados). `esDefault` viaja como `fid: null`, que es como las actions de lead-funnel nombran
 * al producto del negocio. Exportado para el clic derecho del tablero (app/crm/menu-contextual-crm.ts):
 * el menu ofrece los MISMOS destinos que este desplegable, no una lista propia.
 */
export function destinosDeLote(productos: ProductoDeLote[], funnelActivo: number | null): Array<{ fid: number | null; nombre: string }> {
  return productos
    .map((p) => ({ fid: p.esDefault ? null : p.id, nombre: p.nombre }))
    .filter((p) => p.fid !== funnelActivo);
}

/**
 * LAS MISMAS ACCIONES DE LA BARRA, PEDIDAS DESDE AFUERA: el clic derecho sobre un seleccionado
 * (app/crm/CrmBoard.tsx, `elegirContextual`). No es un segundo camino: cada una abre la MISMA pregunta
 * que su desplegable (con el numero, y el «ya tenian otro» de closer/setter) o corre la misma accion al
 * toque con su Deshacer (etiqueta, funnel). Llamarlas sin barra montada no hace nada: el ref es null.
 */
export type ManijaLote = {
  moverDeEtapa: (stageKey: string) => void;
  asignar: (campo: 'closer' | 'setter', valor: string) => void;
  etiquetar: (e: Etiqueta) => void;
  agregarAFunnel: (funnelId: number | null) => void;
  eliminar: () => void;
};

export function AccionesLoteLeads({ elegidos, stages, productos, equipo, funnelActivo, onLimpiar, onListo, estilo, ref }: {
  elegidos: LeadDeLote[];
  stages: Stage[];
  productos: ProductoDeLote[];
  equipo: MiembroEquipo[];
  /** El embudo que se esta mirando: no se ofrece mover al mismo. */
  funnelActivo: number | null;
  onLimpiar: () => void;
  /** Termino: el padre refresca y canta el resultado. */
  onListo: (r: ResultadoLote) => void;
  estilo?: CSSProperties;
  /** Para el clic derecho del tablero (ver `ManijaLote`). */
  ref?: Ref<ManijaLote>;
}) {
  const [pide, setPide] = useState<Pendiente | null>(null);
  const [corriendo, start] = useTransition();
  const n = elegidos.length;
  const ids = elegidos.map((l) => l.id);

  const rotCuenta = `${n} ${n === 1 ? 'lead seleccionado' : 'leads seleccionados'}`;
  const cuantos = `${n} ${n === 1 ? 'lead' : 'leads'}`;

  // ⚠️ CUANTOS TIENEN YA UN VALOR PUESTO. Es lo unico que convierte «asignar» en una
  // decision: sin este numero, pisar el Closer de ocho leads que ya lo tenian se ve
  // igual que rellenarle el hueco a ocho que no.
  const conValor = (campo: 'closer' | 'setter') => elegidos.filter((l) => (l[campo] ?? '').trim()).length;

  // Los productos a los que se puede agregar (ver `destinosDeLote`).
  const destinos = destinosDeLote(productos, funnelActivo);

  const cerrar = () => setPide(null);

  /** Lo que piden el desplegable «Etapa» y el clic derecho: la MISMA pregunta. */
  const pedirEtapa = (k: string) => { const s = stages.find((x) => x.key === k); if (s) setPide({ tipo: 'etapa', stage: s }); };
  /** Lo que piden «Closer»/«Setter» y el clic derecho, con cuántos ya lo tenían. */
  const pedirPersona = (campo: 'closer' | 'setter', v: string) => { if (v) setPide({ tipo: 'persona', campo, valor: v, pisa: conValor(campo) }); };

  /**
   * Agregar una etiqueta a los tildados, AL TOQUE (se deshace desde el aviso). Los que ya la tenían
   * se cuentan aparte, como en producto. Sin disparar nada: ver la cabecera.
   */
  const etiquetar = (e: Etiqueta) => {
    start(async () => {
      try {
        const r = await loteEtiqueta('poner_lote', ids, e.id);
        if (!r.ok) {
          onListo({ texto: r.error || 'No se pudo', hubo: false });
        } else {
          const puestos = r.cambiados ?? [];
          const ya = r.yaEstaban ? ` · ${r.yaEstaban} ya ${r.yaEstaban === 1 ? 'la tenía' : 'la tenían'}` : '';
          const fuera = r.sinSincronizar ? ` · ${r.sinSincronizar} sin sincronizar` : '';
          onListo({
            texto: puestos.length ? `«${e.nombre}» a ${puestos.length}${ya}${fuera}` : `Ya la tenían${fuera}`,
            hubo: puestos.length > 0,
            deshacer: puestos.length
              ? async () => {
                const q = await loteEtiqueta('sacar_lote', puestos, e.id);
                if (!q.ok) throw new Error(q.error || 'No se pudo deshacer');
              }
              : undefined,
          });
        }
      } catch (err) {
        onListo({ texto: err instanceof Error ? err.message : 'No se pudo', hubo: false });
      }
      onLimpiar();
    });
  };

  /**
   * Agregar los tildados a un producto, AL TOQUE. Los que ya estaban ahi (por casa o por
   * fila) los saltea el server y se cuentan aparte: «12 agregados» sobre 15 tildados sin
   * decir por que se leeria como tres fallos.
   */
  const agregarA = (funnelId: number | null, nombre: string) => {
    start(async () => {
      try {
        const r = await agregarLoteAProductoAction(ids, funnelId);
        if (!r.ok) {
          onListo({ texto: r.error, hubo: false });
        } else {
          const n = r.agregados.length;
          const yaEstaban = Math.max(0, ids.length - n - r.fallaron);
          const ya = yaEstaban ? ` · ${yaEstaban} ya ${yaEstaban === 1 ? 'estaba' : 'estaban'}` : '';
          const mal = r.fallaron ? ` · ${r.fallaron} no se pudieron` : '';
          const agregados = r.agregados;
          onListo({
            texto: n ? `${n} a ${nombre}${ya}${mal}` : `Ya estaban en ${nombre}${mal}`,
            hubo: n > 0,
            deshacer: n
              ? async () => {
                const q = await quitarLoteDeProductoAction(agregados, funnelId);
                if (!q.ok) throw new Error(q.error);
              }
              : undefined,
          });
        }
      } catch (e) {
        onListo({ texto: e instanceof Error ? e.message : 'No se pudo', hubo: false });
      }
      onLimpiar();
    });
  };

  const ejecutar = () => {
    if (!pide) return;
    start(async () => {
      try {
        if (pide.tipo === 'etapa') {
          const r = await moverLeadsDeEtapaAction(ids, pide.stage.key);
          // TRES numeros, no uno: ver la cabecera de la action. El de pendientes solo
          // se nombra si lo hay — un «0 con datos pendientes» es ruido.
          const falta = r.conPendientes ? ` · a ${r.conPendientes} les falta un dato` : '';
          const mal = r.fallaron ? ` · ${r.fallaron} no se pudieron` : '';
          onListo({ texto: `${r.movidos} a ${pide.stage.label}${falta}${mal}`, hubo: r.movidos > 0 });
        } else if (pide.tipo === 'persona') {
          const r = await bulkFillLeadFieldAction(pide.campo, pide.valor, ids, true);
          const campo = pide.campo === 'closer' ? 'Closer' : 'Setter';
          onListo({ texto: `${campo} «${pide.valor}» en ${r.updated}`, hubo: r.updated > 0 });
        } else {
          const r = await eliminarLeadsAction(ids);
          const mal = r.fallaron ? ` · ${r.fallaron} no se pudieron` : '';
          onListo({ texto: `${r.borrados} ${r.borrados === 1 ? 'eliminado' : 'eliminados'}${mal}`, hubo: r.borrados > 0 });
        }
      } catch (e) {
        onListo({ texto: e instanceof Error ? e.message : 'No se pudo', hubo: false });
      }
      cerrar();
      onLimpiar();
    });
  };

  /** Agregar a un funnel por su id (`null` = el del negocio), con el nombre que lo canta el aviso. */
  const agregarAFunnel = (fid: number | null) => {
    if (corriendo) return;
    agregarA(fid, destinos.find((p) => p.fid === fid)?.nombre ?? 'otro funnel');
  };

  // Antes del `return null` de abajo: un hook despues de un return temprano cambia de orden entre renders.
  useImperativeHandle(ref, () => ({
    moverDeEtapa: pedirEtapa,
    asignar: pedirPersona,
    etiquetar: (e: Etiqueta) => { if (!corriendo) etiquetar(e); },
    agregarAFunnel,
    eliminar: () => setPide({ tipo: 'borrar' }),
  }));

  if (n === 0) return null;

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 12, ...estilo,
      }}>
        {/* ── IZQUIERDA: la casilla marcada (limpia) y el numero. ──────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <input type="checkbox" checked readOnly onClick={onLimpiar}
            title="Quitar la selección" aria-label={`${rotCuenta}. Quitar la selección`}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)', flex: 'none' }} />
          <span role="status" title={rotCuenta} aria-label={rotCuenta}
            style={{ flex: 'none', minWidth: 24, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
            {n}
          </span>
        </div>

        {/* ── MEDIO: lo que CAMBIA el lead. Con palabra, porque un icono suelto no
             dice QUE etapa ni QUE persona (misma razon que la barra del plan). ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none', justifyContent: 'center' }}>
          <Dropdown
            value="" resetAfterSelect placeholder="Etapa" ariaLabel={`Mover ${cuantos} de etapa`}
            icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoEtapa /></span>}
            buttonStyle={estiloDrop}
            options={stages.map((s) => ({ value: s.key, label: s.label, color: s.dot }))}
            onChange={pedirEtapa} />

          {/* El equipo puede estar vacio: ahi el desplegable no se dibuja. Un control
              con cero opciones se lee como que la app esta rota. */}
          {equipo.length > 0 && (['closer', 'setter'] as const).map((campo) => (
            <Dropdown key={campo}
              value="" resetAfterSelect placeholder={campo === 'closer' ? 'Closer' : 'Setter'}
              ariaLabel={`Asignar ${campo === 'closer' ? 'Closer' : 'Setter'} a ${cuantos}`}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoPersona /></span>}
              buttonStyle={estiloDrop}
              // Una persona va con su avatar (la foto o sus iniciales), no con un ícono (general 10).
              options={equipo.map((m) => ({ value: m.nombre, label: m.nombre, avatar: m.foto_url ?? null }))}
              onChange={(v) => pedirPersona(campo, v)} />
          ))}

          {/* Agregar a otro producto: solo si hay OTRO adonde ir. Sin pregunta: suma y
              se deshace desde el aviso. */}
          {destinos.length > 0 && (
            <Dropdown
              value="" resetAfterSelect placeholder="Funnel" ariaLabel={`Agregar ${cuantos} a otro funnel`}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoFunnel /></span>}
              buttonStyle={estiloDrop}
              options={destinos.map((p) => ({ value: String(p.fid ?? 'default'), label: p.nombre }))}
              onChange={(v) => agregarAFunnel(v === 'default' ? null : Number(v))} />
          )}

          {/* Agregar una etiqueta: al toque, con Deshacer. «＋ Nueva» la crea de paso. «Agregar» y no
              «Poner» (sexta tanda, TAG 1: «En lugar de "Poner" y "Sacar", se formal escribiendo
              siempre... "Agregar" y "Eliminar". Revisa que no esté ese error en otro lado»). */}
          <SelectorEtiqueta value={null} accion placeholder="Etiqueta" ariaLabel={`Agregar una etiqueta a ${cuantos}`}
            icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoEtiqueta /></span>}
            buttonStyle={estiloDrop} disabled={corriendo}
            onElegir={(e) => { if (!corriendo) etiquetar(e); }} />
        </div>

        {/* ── DERECHA: lo irreversible, solo. ──────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          <button type="button" className="mk-icon-btn" data-tone="bad"
            title={`Eliminar ${cuantos}`} aria-label={`Eliminar ${cuantos}`}
            onClick={() => setPide({ tipo: 'borrar' })} style={btnIcono}>
            {/* El tacho de la casa (app/_ui/BotonBorrar.tsx, general 9): el mismo dibujo y rojo siempre. */}
            <IconoBorrar size={16} />
          </button>
        </div>
      </div>

      {/* ── La pregunta. Cada una NOMBRA el numero y lo que va a pasar. ────────── */}
      {pide?.tipo === 'etapa' && (
        <Confirm
          title={`¿Mover ${cuantos} a ${pide.stage.label}?`}
          /* Mover NO se bloquea (decision del 17/09): lo que la etapa pida y falte queda
             pendiente. Decirlo aca es lo que evita que el resultado se lea como un fallo. */
          message="Lo que la etapa pida y falte queda pendiente en cada ficha."
          confirmLabel="Mover" tone="primary" loading={corriendo}
          onConfirm={ejecutar} onCancel={cerrar} />
      )}
      {pide?.tipo === 'persona' && (
        <Confirm
          title={`¿${pide.campo === 'closer' ? 'Closer' : 'Setter'} «${pide.valor}» en ${cuantos}?`}
          /* El numero que convierte esto en una decision. Sin pisar a nadie no se advierte
             nada: una advertencia que no advierte enseña a ignorar las que sí importan. */
          message={pide.pisa > 0
            ? `${pide.pisa} ${pide.pisa === 1 ? 'ya tenía otro y se reemplaza' : 'ya tenían otro y se reemplazan'}.`
            : 'Ninguno lo tiene puesto todavía.'}
          confirmLabel="Asignar" tone="primary" loading={corriendo}
          onConfirm={ejecutar} onCancel={cerrar} />
      )}
      {pide?.tipo === 'borrar' && (
        <Confirm
          title={`¿Eliminar ${cuantos}?`}
          message="Se van con su historial y sus pagos. No se puede deshacer."
          confirmLabel="Eliminar" tone="danger" loading={corriendo}
          onConfirm={ejecutar} onCancel={cerrar} />
      )}
    </>
  );
}
