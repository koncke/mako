'use client';

// =============================================================================
// TraerDeOtroProducto — elegir de qué producto, y cuáles
// =============================================================================
// Pedido de Martín (30/09/2026), textual: «al seleccionar traer de otro producto, se
// seleccione de que otro producto y aparezcan todas las columnas, los filtros, la barra
// de busqueda. Y que se pueda hacer selección múltiple».
//
// ⚠️ REEMPLAZA AL FORMULARIO, NO SE ABRE DEBAJO. Nació como un renglón al pie del alta
// («Traer uno de otro producto») y con eso el modal pedía dos cosas a la vez: cargar a
// alguien nuevo y buscar a alguien que ya está. Son dos tareas distintas y ninguna es un
// paso de la otra — por eso acá hay un «Atrás» y no un «Cancelar»: se vuelve al alta, no
// se cierra el modal.
//
// ⚠️ AGREGA, NO MUEVE, y el botón lo dice con esa palabra. Hasta el 06/10/2026 esto movía
// (`moverLeadsAFunnelAction`, borrada ese día): le cambiaba la casa al lead y lo sacaba del
// tablero donde lo trabajaban, con la etapa reseteada. Martín: «Le acabo de dar a un lead a
// "Mover a prueba" y se desapareció del producto principal de Mauricio. Eso JAMÁS debe
// pasar... No se debe "Mover" se debe agregar al otro producto». Ahora es
// `agregarLoteAProductoAction` (mig 0207): una fila por lead en la etapa de ENTRADA de este
// producto, y su casa —con su etapa, su venta y su nutrición— no se toca.
//
// ⚠️ LA LISTA DE ORIGEN TRAE A SUS AGREGADOS, y los que YA están acá (por casa o por fila)
// NO se listan desde el 22/10/2026 (salían en gris y sin casilla): Martín, en la llamada con
// Mauricio, «ya no deberían saltar ahí, ni siquiera en gris... porque luego ya no me deja los
// siguientes 300». Se dicen en una línea con su número. Lo puro: ./traer-seleccion.ts.
//
// ⚠️ «TILDAR TODOS» TOMA A TODOS LOS QUE CUMPLEN EL FILTRO, no a los 300 que se dibujan (22/10:
// «que se puedan traer los 1.050»). El filtro dice qué quiere la persona; el tope es de la
// pantalla. Y el botón de agregar no scrollea: va pegado abajo («que el botón no se tenga que
// desplazar»).
//
// ⚠️ EL DESHACER VIAJA AL PADRE: este componente se desmonta al terminar (el modal se
// cierra), así que un aviso propio moriría con él. `onTraidos` recibe la función que borra
// SÓLO las filas que este lote creó, y el padre la cuelga del «Deshacer» de su aviso.
//
// ⚠️ LO QUE PIDIÓ MARTÍN EL 23/10/2026 (captura del ws1): «al abrir el pop-up, un loader mientras carga la lista, porque
// sin él parece roto. Al cambiar de funnel o de etapa, también»; fuera la línea «Se ven 300 de 869; la casilla de arriba
// tilda a los 869. 300 ya están en este funnel y no se muestran» («si hace falta algo, que sea el número en la casilla»);
// y el pie con «← Atrás» y «Agregar aquí» pegado al fondo, con fondo sólido: «se ven leads por detrás y debajo, y parece
// roto». El pie era `sticky` dentro del cuerpo del modal, que tiene 20 px de padding abajo: las filas pasaban por ahí.
// Ahora la vista mide el alto del cuerpo (`height: 100%`), la que scrollea es la tabla y el pie es el último renglón.

import { useDeferredValue, useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { TANDA_AGREGAR, TOPE_PANTALLA, enTandas, filasParaTraer, miles } from './traer-seleccion';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { Spinner } from '@/app/_ui';
import { VistaConPie } from '@/app/_ui/VistaConPie';
import { leadsDeProductoAction, type LeadParaTraer } from './actions';
import { agregarLoteAProductoAction, quitarLoteDeProductoAction } from './lead-funnel-actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const th: CSSProperties = {
  textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em',
  textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600,
  padding: '0 10px 7px', whiteSpace: 'nowrap',
};
const td: CSSProperties = {
  padding: '9px 10px', fontFamily: SANS, fontSize: 13.5, color: 'var(--ink)',
  borderTop: '1px solid var(--border)', maxWidth: 220,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

export type ProductoOrigen = { id: number; nombre: string; esDefault: boolean };

export function TraerDeOtroProducto({ productos, destino, onAtras, onTraidos }: {
  /** Todos los productos del workspace, incluido el de destino (que se excluye acá). */
  productos: ProductoOrigen[];
  /** A dónde van. `null` = el producto del negocio. */
  destino: number | null;
  /** Volver al formulario de alta. No cierra el modal. */
  onAtras: () => void;
  /**
   * Terminó. `agregados` son los que ENTRARON (no los tildados), `fallaron` los que no
   * pudieron, y `deshacer` borra sólo las filas que este lote creó — va colgado del
   * «Deshacer» del aviso del padre. Ausente cuando no se agregó nadie.
   */
  onTraidos: (agregados: number, fallaron: number, deshacer?: () => Promise<void>) => void;
}) {
  // ⚠️ El de destino se saca de la lista: «traer de este producto a este producto» no es
  // una opción, es un control que no hace nada. Y `null` resuelve al del negocio, que es
  // donde el tablero dibuja a los leads sin funnel.
  const delNegocio = productos.find((p) => p.esDefault) ?? null;
  const destinoId = destino ?? delNegocio?.id ?? null;
  const origenes = useMemo(
    () => productos.filter((p) => p.id !== destinoId),
    [productos, destinoId],
  );

  const [origen, setOrigen] = useState<number | null>(origenes[0]?.id ?? null);
  const [filas, setFilas] = useState<LeadParaTraer[] | null>(null);
  const [q, setQ] = useState('');
  const [etapa, setEtapa] = useState('');
  const [sel, setSel] = useState<number[]>([]);
  const [agregando, startAgregar] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Al cambiar de producto se recarga TODO y se limpia la selección: arrastrar ids de un
  // producto a la lista de otro es agregar gente que la persona ya no está mirando.
  useEffect(() => {
    if (origen == null) { setFilas([]); return; }
    let vivo = true;
    setFilas(null);
    setSel([]);
    setEtapa('');
    const pedido = origen === (delNegocio?.id ?? -1) ? null : origen;
    // El destino viaja para que el server marque a los que YA están acá (`yaEsta`).
    void leadsDeProductoAction(pedido, destino)
      .then((r) => { if (vivo) setFilas(r.filas); })
      .catch(() => { if (vivo) setFilas([]); });
    return () => { vivo = false; };
  }, [origen, delNegocio?.id, destino]);

  /** Las etapas que de verdad hay entre los que se pueden traer: un filtro con opciones vacías no filtra nada. */
  const etapas = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of filas ?? []) if (!f.yaEsta && !m.has(f.etapaKey)) m.set(f.etapaKey, f.etapa);
    return [...m].map(([key, label]) => ({ key, label }));
  }, [filas]);

  // Los que cumplen el filtro y NO están en este funnel. Con el filtro DIFERIDO: la lista de 869 se vuelve a armar en
  // segundo plano y, mientras, se ve que está filtrando (`filtrando`) en vez de una pantalla que no contesta.
  const qDiferida = useDeferredValue(q);
  const etapaDiferida = useDeferredValue(etapa);
  const filtrando = q !== qDiferida || etapa !== etapaDiferida;
  const { candidatos, yaEstan } = useMemo(() => filasParaTraer(filas ?? [], { q: qDiferida, etapa: etapaDiferida }), [filas, qDiferida, etapaDiferida]);
  const enPantalla = candidatos.slice(0, TOPE_PANTALLA);
  const ocultos = candidatos.length - enPantalla.length;
  const tildados = useMemo(() => new Set(sel), [sel]);
  /** «Todos» son TODOS los que cumplen el filtro, se vean o no (22/10/2026). */
  const todosTildados = candidatos.length > 0 && candidatos.every((f) => tildados.has(f.id));

  const alternar = (id: number) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const alternarTodos = () => {
    // ⚠️ Tilda a todos los que CUMPLEN EL FILTRO, también los que no entran en la pantalla: el filtro es lo que la
    // persona eligió («Nutrición/Reactivación»); el tope de 300 es sólo lo que se dibuja. Lo que el filtro deja
    // afuera NO se tilda: eso sí sería agregar gente que la persona no eligió.
    const ids = new Set(candidatos.map((f) => f.id));
    setSel((p) => (todosTildados ? p.filter((x) => !ids.has(x)) : [...new Set([...p, ...ids])]));
  };

  const opciones: DropdownOption[] = origenes.map((p) => ({ value: String(p.id), label: p.nombre }));
  const opcionesEtapa: DropdownOption[] = [
    { value: '', label: 'Todas las etapas' },
    ...etapas.map((e) => ({ value: e.key, label: e.label })),
  ];

  if (!origenes.length) {
    return (
      <div>
        <p style={{ fontFamily: SANS, fontSize: 14, color: 'var(--dim)', margin: 0 }}>
          Solo tienes este funnel. Crea otro para poder agregar leads de ahí.
        </p>
        <button type="button" onClick={onAtras} style={btnAtras}>← Atrás</button>
      </div>
    );
  }

  // ⚠️ EL PIE (22/10 «que el botón no se tenga que desplazar»; 23/10 «se ven leads por detrás y debajo»): el último renglón
  // de `VistaConPie`, con fondo sólido. Sin textos: lo que no se ve lo dice la casilla de arriba.
  const pie = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={onAtras} disabled={agregando} style={btnAtras}>← Atrás</button>
        <span style={{ flex: 1 }} />
        {err && <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--bad)' }}>{err}</span>}
        <button type="button" disabled={agregando || !sel.length}
          onClick={() => startAgregar(async () => {
            setErr(null);
            // Sin «¿estás seguro?»: agregar no saca a nadie de ningún lado, y el padre ofrece
            // Deshacer (el molde de Customer Success).
            // ⚠️ DE A TANDAS: el server corta en 2.000 sin decirlo (`slice(0, 2000)`), y 1.050 de una vez son seis
            // tandas de base adentro de UNA action. Se suman lo que entró y lo que falló de cada tanda.
            const agregados: number[] = [];
            let fallaron = 0;
            for (const tanda of enTandas(sel, TANDA_AGREGAR)) {
              const r = await agregarLoteAProductoAction(tanda, destino);
              if (!r.ok) { fallaron += tanda.length; if (!agregados.length) { setErr(r.error); return; } continue; }
              agregados.push(...r.agregados);
              fallaron += r.fallaron;
            }
            if (!agregados.length && fallaron) { setErr('No se pudo agregar ninguno.'); return; }
            // El deshacer TIRA si no pudo: el padre tiene que poder decir «No se pudo
            // deshacer» en vez de dar por vuelto algo que sigue escrito.
            onTraidos(agregados.length, fallaron, agregados.length
              ? async () => {
                for (const tanda of enTandas(agregados, TANDA_AGREGAR)) {
                  const q = await quitarLoteDeProductoAction(tanda, destino);
                  if (!q.ok) throw new Error(q.error);
                }
              }
              : undefined);
          })}
          style={{
            padding: '11px 22px', borderRadius: 10, border: 'none',
            background: 'var(--primary)', color: '#fff', fontFamily: SANS,
            fontSize: 14, fontWeight: 700,
            cursor: agregando || !sel.length ? 'default' : 'pointer',
            opacity: agregando || !sel.length ? 0.45 : 1,
          }}>
          {agregando ? 'Agregando…' : sel.length ? `Agregar ${miles(sel.length)} aquí` : 'Agregar aquí'}
        </button>
      </div>
  );

  // ⚠️ LA TABLA SCROLLEA, EL PIE NO: `VistaConPie` (app/_ui/VistaConPie.tsx), la MISMA pieza que «Traer de un grupo de
  // WhatsApp» (24/10/2026). El arreglo del 23/10 («se ven leads por detrás y debajo») vivía sólo acá, y la vista del grupo,
  // copiada antes, se quedó con el error.
  return (
    <VistaConPie
      lista={{ border: '1px solid var(--border)', borderRadius: 12, opacity: filtrando ? 0.55 : 1, transition: 'opacity .12s' }}
      cabecera={(
      /* La barra: de dónde, qué busco, qué etapa. */
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--faint)', flex: 'none' }}>Traer de</span>
        <Dropdown
          value={String(origen ?? '')}
          options={opciones}
          onChange={(v) => setOrigen(Number(v))}
          ariaLabel="De qué funnel traer"
          width={220}
        />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono"
          style={{
            flex: '1 1 220px', minWidth: 160, padding: '9px 12px', borderRadius: 10,
            border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
            color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none',
          }}
        />
        {/* El filtro de etapa sólo aparece cuando hay más de una: con una sola es un
            desplegable que no puede cambiar nada. */}
        {etapas.length > 1 && (
          <Dropdown
            value={etapa}
            options={opcionesEtapa}
            onChange={setEtapa}
            ariaLabel="Filtrar por etapa"
            width={190}
          />
        )}
        {filtrando && <Spinner size={16} />}
      </div>
      )}
      pie={pie}
    >
      {/* La tabla. */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
            <tr>
              {/* La casilla de «todos» y, si hay más de los que se dibujan, CUÁNTOS toma: «Tildar los 869» (Martín, 23/10/2026:
                  «si hace falta algo, que sea el número en la casilla»). Ocupa el lugar del rótulo «Nombre». */}
              <th colSpan={2} style={{ ...th, padding: '10px 10px 7px 12px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 12, cursor: candidatos.length ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={todosTildados} onChange={alternarTodos}
                    disabled={!candidatos.length}
                    aria-label={`Tildar los ${miles(candidatos.length)}`}
                    style={{ width: 16, height: 16, margin: 0, cursor: candidatos.length ? 'pointer' : 'default', accentColor: 'var(--primary)' }} />
                  {ocultos > 0
                    ? <span style={TILDAR_TODOS}>Tildar los {miles(candidatos.length)}</span>
                    : 'Nombre'}
                </label>
              </th>
              <th style={th}>Empresa</th>
              <th style={th}>Email</th>
              <th style={th}>Teléfono</th>
              <th style={th}>Etapa</th>
            </tr>
          </thead>
          <tbody>
            {enPantalla.map((f) => {
              const on = tildados.has(f.id);
              return (
                <tr key={f.id} onClick={() => alternar(f.id)}
                  style={{ cursor: 'pointer', background: on ? 'var(--primary-weak)' : 'transparent' }}>
                  <td style={{ ...td, padding: '9px 0 9px 12px' }}>
                    <input type="checkbox" checked={on} readOnly tabIndex={-1}
                      aria-label={`Agregar a ${f.nombre}`}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)', pointerEvents: 'none' }} />
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{f.nombre}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{f.empresa || '—'}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{f.email || '—'}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{f.telefono || '—'}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{f.etapa}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Los tres estados, y son DISTINTOS: todavía no llegó · llegó vacío · el filtro
            no deja nada. Un solo texto para los tres haría pensar que el producto está
            vacío cuando lo que pasa es que el filtro no deja pasar a nadie. */}
        {/* El loader (23/10/2026): al abrir y al cambiar de funnel la lista viene del server, y sin él parecía roto. */}
        {filas === null && (
          <div role="status" aria-label="Cargando los leads" style={{ display: 'grid', placeItems: 'center', gap: 10, padding: '56px 14px' }}>
            <Spinner size={22} />
          </div>
        )}
        {filas?.length === 0 && (
          <p style={{ fontFamily: SANS, fontSize: 13.5, color: 'var(--dim)', padding: '22px 14px', margin: 0 }}>Ese funnel no tiene leads.</p>
        )}
        {!!filas?.length && candidatos.length === 0 && (
          <p style={{ fontFamily: SANS, fontSize: 13.5, color: 'var(--dim)', padding: '22px 14px', margin: 0 }}>
            {yaEstan > 0 ? 'Todos los de esos filtros ya están en este funnel.' : 'Nadie con esos filtros.'}
          </p>
        )}
    </VistaConPie>
  );
}

/** «Tildar los 869», en la casilla de arriba: con letra de texto, no de rótulo de columna. */
const TILDAR_TODOS: CSSProperties = {
  fontFamily: SANS, fontSize: 13, letterSpacing: 0, textTransform: 'none', color: 'var(--ink)', fontWeight: 600,
};

const btnAtras: CSSProperties = {
  flex: 'none', padding: '10px 16px', borderRadius: 10,
  border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
