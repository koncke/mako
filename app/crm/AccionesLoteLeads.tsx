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
//   · PRODUCTO. `moverLeadsAFunnelAction` ya existia y era batch de nacimiento; lo
//     unico que le faltaba era desde donde llamarla sin abrir otra pantalla.
//
// Y una que se dejo AFUERA a proposito: meter los seleccionados en una secuencia
// de nutricion. Esa es la unica de la lista que MANDA MENSAJES, y la linea de
// WhatsApp del chatbot es la NO OFICIAL: lo que la protege es el ritmo, no una
// API (ver AGENTS.md). Un boton que dispara N conversaciones de una no es una
// accion en lote mas — necesita su propia pantalla, con el ritmo a la vista.
//
// ⚠️ TODA ACCION PREGUNTA ANTES, NOMBRANDO EL NUMERO. No es ceremonia: la barra
// escribe sobre filas que pueden no estar todas a la vista (en el Kanban se tilda
// en cuatro columnas y se scrollea), y ninguna de las cuatro tiene deshacer en
// lote. Es el molde que ya usa `BulkHigiene` en el propio CrmBoard («Asignar
// Setter "Mauricio" a 12 leads»).
// =============================================================================

import { useState, useTransition } from 'react';
import type { CSSProperties } from 'react';
import { Confirm, SANS, MONO } from '@/app/_ui';
import { Dropdown } from '@/app/components/Dropdown';
import type { Stage } from '@/lib/pipeline';
import type { MiembroEquipo } from './actions';
import {
  moverLeadsDeEtapaAction,
  eliminarLeadsAction,
  moverLeadsAFunnelAction,
  bulkFillLeadFieldAction,
} from './actions';

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
export type ResultadoLote = { texto: string; hubo: boolean };

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
function IconoProducto() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.6 7.8 12 3 3.4 7.8 12 12.6z" /><path d="M3.4 7.8v8.4L12 21v-8.4" /><path d="M20.6 7.8v8.4L12 21" />
    </svg>
  );
}
function IconoTacho() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

/** Lo que se esta por hacer, ya elegido y todavia sin confirmar. */
type Pendiente =
  | { tipo: 'etapa'; stage: Stage }
  | { tipo: 'persona'; campo: 'closer' | 'setter'; valor: string; pisa: number }
  | { tipo: 'producto'; funnelId: number | null; nombre: string }
  | { tipo: 'borrar' };

export function AccionesLoteLeads({ elegidos, stages, productos, equipo, funnelActivo, onLimpiar, onListo, estilo }: {
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

  // Los productos a los que se puede mover: todos menos el que se esta mirando.
  // `esDefault` viaja como `null`, que es como el embudo del negocio se escribe en
  // `leads.funnel_id` (ver lib/landing-funnel.ts: escribirlo con su id lo saca del
  // unico tablero que el cliente mira).
  const destinos = productos
    .map((p) => ({ fid: p.esDefault ? null : p.id, nombre: p.nombre }))
    .filter((p) => p.fid !== funnelActivo);

  const cerrar = () => setPide(null);

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
        } else if (pide.tipo === 'producto') {
          const r = await moverLeadsAFunnelAction(ids, pide.funnelId);
          const mal = r.fallaron ? ` · ${r.fallaron} no se pudieron` : '';
          onListo({ texto: `${r.movidos} a ${pide.nombre}${mal}`, hubo: r.movidos > 0 });
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
            onChange={(k) => { const s = stages.find((x) => x.key === k); if (s) setPide({ tipo: 'etapa', stage: s }); }} />

          {/* El equipo puede estar vacio: ahi el desplegable no se dibuja. Un control
              con cero opciones se lee como que la app esta rota. */}
          {equipo.length > 0 && (['closer', 'setter'] as const).map((campo) => (
            <Dropdown key={campo}
              value="" resetAfterSelect placeholder={campo === 'closer' ? 'Closer' : 'Setter'}
              ariaLabel={`Asignar ${campo === 'closer' ? 'Closer' : 'Setter'} a ${cuantos}`}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoPersona /></span>}
              buttonStyle={estiloDrop}
              options={equipo.map((m) => ({ value: m.nombre, label: m.nombre }))}
              onChange={(v) => { if (v) setPide({ tipo: 'persona', campo, valor: v, pisa: conValor(campo) }); }} />
          ))}

          {/* Mover de producto: solo si hay OTRO adonde ir. */}
          {destinos.length > 0 && (
            <Dropdown
              value="" resetAfterSelect placeholder="Producto" ariaLabel={`Mover ${cuantos} a otro producto`}
              icono={<span style={{ display: 'flex', color: 'var(--dim)' }}><IconoProducto /></span>}
              buttonStyle={estiloDrop}
              options={destinos.map((p) => ({ value: String(p.fid ?? 'default'), label: p.nombre }))}
              onChange={(v) => {
                const fid = v === 'default' ? null : Number(v);
                setPide({ tipo: 'producto', funnelId: fid, nombre: destinos.find((p) => p.fid === fid)?.nombre ?? 'otro producto' });
              }} />
          )}
        </div>

        {/* ── DERECHA: lo irreversible, solo. ──────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          <button type="button" className="mk-icon-btn" data-tone="bad"
            title={`Eliminar ${cuantos}`} aria-label={`Eliminar ${cuantos}`}
            onClick={() => setPide({ tipo: 'borrar' })} style={btnIcono}>
            <IconoTacho />
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
      {pide?.tipo === 'producto' && (
        <Confirm
          title={`¿Mover ${cuantos} a ${pide.nombre}?`}
          message="Salen de este tablero y aparecen en el de ese producto."
          confirmLabel="Mover" tone="primary" loading={corriendo}
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
