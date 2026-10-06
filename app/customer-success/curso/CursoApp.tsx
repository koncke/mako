'use client';

// =============================================================================
// CursoApp — el curso de cada servicio, y cómo va cada cliente en él
// =============================================================================
// Dos vistas hermanas sobre el producto elegido:
//   · Clases — las etapas de su entrega como secciones, cada una con sus clases en orden. Se
//     crean, editan, borran y ordenan acá (sólo un admin: ver actions.ts).
//   · Avance — clientes × etapas: lo que envió cada uno, cuánto vio y cuándo entró.
//
// ⚠️ EL CURSO CUELGA DE LAS ETAPAS DE LA ENTREGA, no tiene etapas propias (mig 0202). Las
// columnas del kanban de Customer Success SON las secciones de acá: renombrar una allá la
// renombra acá, y una clase de una etapa borrada aparece en «Sin etapa» para moverla.
//
// ⚠️ LAS CLASES VIVEN EN UN ESTADO LOCAL QUE SE RESINCRONIZA CON LAS PROPS. Guardar y borrar
// revalidan la página (llega la lista nueva y pisa la local); mover NO revalida —la flecha
// mueve la fila en el acto y la base confirma detrás—, así que la local es la que manda
// hasta la próxima carga.

import { useEffect, useMemo, useState } from 'react';
import {
  Pagina, PageHeader, Section, Tabs, Select, Button, IconButton, Status, Tag, Tooltip,
  EmptyState, ErrorState, Banner, Toast, useToast, useConfirm,
} from '@/app/_ui';
import type { Clase } from '@/lib/curso';
import { tieneTarea } from '@/lib/curso';
import { porEtapas, reordenar, rotuloTipo, videoDeClase, type FilaAvance } from './reglas';
import { borrarClaseAction, moverClaseAction } from './actions';
import { EditorClase } from './EditorClase';
import { AvanceCurso, type EtapaVista } from './AvanceCurso';

export type ServicioCurso = { productoId: number; nombre: string; etapas: EtapaVista[] };
export type VistaCurso = 'clases' | 'avance';

export function CursoApp({ servicios, clases: clasesProp, avance, avanceError, conAvance, puedeEditar, inicial, errorClases, errorEntrega }: {
  servicios: ServicioCurso[];
  /** No se pudieron leer los servicios. ⚠️ No es «no tienes servicios»: son dos pantallas. */
  errorEntrega?: string | null;
  clases: Clase[];
  /** productoId → filas de la tabla de Avance, ya ordenadas. */
  avance: Record<number, FilaAvance[]>;
  avanceError: string | null;
  /** claseId → cuántos clientes ya tienen avance ahí (para el aviso de borrar). */
  conAvance: Record<number, number>;
  puedeEditar: boolean;
  inicial: { productoId: number | null; vista: VistaCurso };
  /** productoId → por qué no se pudieron leer sus clases. */
  errorClases: Record<number, string>;
}) {
  const [productoId, setProductoId] = useState<number | null>(
    servicios.some((s) => s.productoId === inicial.productoId) ? inicial.productoId : servicios[0]?.productoId ?? null,
  );
  const [vista, setVista] = useState<VistaCurso>(inicial.vista);
  // Ver la cabecera: la lista local se pisa cuando llega otra desde el server.
  const [base, setBase] = useState(clasesProp);
  const [clases, setClases] = useState(clasesProp);
  if (base !== clasesProp) { setBase(clasesProp); setClases(clasesProp); }

  const [editando, setEditando] = useState<{ clase: Clase | null; etapa: string } | null>(null);
  const [moviendo, setMoviendo] = useState<number | null>(null);
  const { toast, show, clear } = useToast();
  const { confirm, confirmNode } = useConfirm();

  const servicio = servicios.find((s) => s.productoId === productoId) ?? null;

  // El producto y la vista quedan en la URL, para que recargar (o un link desde la ficha del
  // cliente) vuelva al mismo lugar. `replaceState` y no el router: el router volvería a pedir
  // la página entera al server por un cambio que ya está en memoria.
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (productoId) u.searchParams.set('producto', String(productoId)); else u.searchParams.delete('producto');
      if (vista === 'avance') u.searchParams.set('vista', 'avance'); else u.searchParams.delete('vista');
      if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href);
    } catch { /* sin URL no se pierde nada: es una comodidad */ }
  }, [productoId, vista]);

  const delProducto = useMemo(() => clases.filter((c) => c.productoId === productoId), [clases, productoId]);
  const { porEtapa, huerfanas } = useMemo(
    () => porEtapas(delProducto, servicio?.etapas.map((e) => e.key) ?? []),
    [delProducto, servicio],
  );
  const filas = productoId ? avance[productoId] ?? [] : [];

  const mover = async (c: Clase, dir: 'arriba' | 'abajo') => {
    const ids = (porEtapa[c.etapa] ?? []).map((x) => x.id);
    const nuevos = reordenar(ids, c.id, dir);
    if (!nuevos) return;
    const antes = clases;
    const ordenar = (lista: number[]) => setClases((cs) => cs.map((x) => {
      const i = x.etapa === c.etapa && x.productoId === c.productoId ? lista.indexOf(x.id) : -1;
      return i >= 0 ? { ...x, orden: i } : x;
    }));
    ordenar(nuevos);
    setMoviendo(c.id);
    const r = await moverClaseAction(c.id, dir);
    setMoviendo(null);
    if (!r.ok) { setClases(antes); show(r.error, undefined, 'bad'); return; }
    // La base manda: si otra pestaña movió en el medio, su orden es el que queda.
    ordenar(r.ids);
  };

  const borrar = async (c: Clase) => {
    const r = await borrarClaseAction(c.id);
    if (!r.ok) { show(r.error, undefined, 'bad'); return; }
    setClases((cs) => cs.filter((x) => x.id !== c.id));
    setEditando(null);
    show('Clase borrada');
  };

  const borrarDesdeLista = async (c: Clase) => {
    const n = conAvance[c.id] ?? 0;
    const ok = await confirm(
      n > 0 ? `Se pierde el avance de ${n} ${n === 1 ? 'cliente' : 'clientes'}.` : 'Nadie la empezó todavía.',
      { title: `¿Borrar «${c.titulo}»?`, confirmLabel: 'Borrar' },
    );
    if (ok) await borrar(c);
  };

  if (errorEntrega) {
    return (
      <Pagina>
        <PageHeader titulo="Curso" />
        <ErrorState titulo="No pude leer tus servicios" detalle={errorEntrega} detalleTecnico={errorEntrega} />
      </Pagina>
    );
  }

  if (!servicios.length) {
    return (
      <Pagina>
        <PageHeader titulo="Curso" />
        <EmptyState titulo="Todavía no hay servicios"
          detalle="El curso cuelga de las etapas de un producto. Créalo en Clientes."
          accion={{ label: 'Ir a Clientes', href: '/customer-success' }} />
      </Pagina>
    );
  }

  const nClases = delProducto.length;
  const selector = (
    <Select value={String(productoId ?? '')} width={240} ariaLabel="Producto"
      options={servicios.map((s) => ({ value: String(s.productoId), label: s.nombre }))}
      onChange={(v) => setProductoId(Number(v))} />
  );

  return (
    <Pagina>
      <PageHeader
        titulo="Curso"
        estado={<Status>{nClases} {nClases === 1 ? 'clase' : 'clases'}</Status>}
        filtros={selector}
        tabs={<Tabs activa={vista} onCambio={(v) => setVista(v as VistaCurso)}
          tabs={[{ id: 'clases', label: 'Clases', badge: nClases }, { id: 'avance', label: 'Avance', badge: filas.length }]} />}
      />

      {productoId && errorClases[productoId] && <Banner tono="bad">No pude leer las clases. {errorClases[productoId]}</Banner>}

      {!servicio ? (
        <ErrorState titulo="No encontré ese producto" />
      ) : vista === 'avance' ? (
        <AvanceCurso etapas={servicio.etapas} filas={filas} error={avanceError} />
      ) : (
        <>
          {servicio.etapas.map((e) => {
            const lista = porEtapa[e.key] ?? [];
            // ⚠️ UNA ETAPA SIN NINGUNA CLASE QUE LA CIERRE NO AVANZA SOLA (`etapaCompleta` pide
            // al menos una obligatoria con tarea, a propósito: «nada que hacer» no es «terminó»).
            // Se dice acá, que es donde se arregla, y no en el kanban, donde sólo se ve que el
            // cliente «no se mueve».
            const cierra = lista.some((c) => c.obligatoria && tieneTarea(c));
            return (
              <Section key={e.key} titulo={e.label}
                nota={lista.length > 0 && !cierra
                  ? <Tooltip text="Ninguna clase cierra esta etapa: el cliente no avanza solo."><span className="cu-aviso">No avanza sola</span></Tooltip>
                  : undefined}
                accion={puedeEditar ? <Button size="sm" variant="secondary" onClick={() => setEditando({ clase: null, etapa: e.key })}>+ Clase</Button> : undefined}>
                {lista.length === 0
                  ? <p className="cu-vacio">Sin clases.</p>
                  : <ListaClases lista={lista} puedeEditar={puedeEditar} moviendo={moviendo}
                      onAbrir={(c) => setEditando({ clase: c, etapa: c.etapa })}
                      onMover={(c, d) => void mover(c, d)} onBorrar={(c) => void borrarDesdeLista(c)} />}
              </Section>
            );
          })}

          {huerfanas.length > 0 && (
            // Su etapa se borró en el editor de etapas. Siguen en la base, con su avance: se
            // muestran para que alguien las mueva a una etapa que exista (o las borre).
            <Section titulo="Sin etapa" nota="Su etapa ya no existe.">
              <ListaClases lista={huerfanas} puedeEditar={puedeEditar} moviendo={moviendo} sinOrden
                onAbrir={(c) => setEditando({ clase: c, etapa: servicio.etapas[0]?.key ?? c.etapa })}
                onMover={() => {}} onBorrar={(c) => void borrarDesdeLista(c)} />
            </Section>
          )}
        </>
      )}

      {editando && servicio && (
        <EditorClase
          key={editando.clase?.id ?? `nueva-${editando.etapa}`}
          productoId={servicio.productoId}
          etapas={servicio.etapas.map((e) => ({ key: e.key, label: e.label }))}
          clase={editando.clase && servicio.etapas.some((e) => e.key === editando.clase!.etapa)
            ? editando.clase
            // Una huérfana se abre ya parada en una etapa que existe: guardarla tal cual
            // rebotaría con «esa etapa no existe».
            : editando.clase ? { ...editando.clase, etapa: editando.etapa } : null}
          etapaInicial={editando.etapa}
          puedeEditar={puedeEditar}
          avanceEnClase={editando.clase ? conAvance[editando.clase.id] ?? 0 : 0}
          onCerrar={() => setEditando(null)}
          onGuardada={(c) => {
            setClases((cs) => (cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? c : x)) : [...cs, c]));
            setEditando(null);
            show('Clase guardada');
          }}
          onBorrar={(c) => void borrar(c)}
        />
      )}

      {confirmNode}
      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Pagina>
  );
}

function ListaClases({ lista, puedeEditar, moviendo, sinOrden, onAbrir, onMover, onBorrar }: {
  lista: Clase[];
  puedeEditar: boolean;
  moviendo: number | null;
  sinOrden?: boolean;
  onAbrir: (c: Clase) => void;
  onMover: (c: Clase, dir: 'arriba' | 'abajo') => void;
  onBorrar: (c: Clase) => void;
}) {
  return (
    <ol className="cu-lista">
      {lista.map((c, i) => {
        const v = videoDeClase(c);
        const conTarea = tieneTarea(c);
        return (
          <li key={c.id} className="cu-fila">
            <span className="cu-n">{i + 1}</span>
            <button type="button" className="cu-cuerpo" onClick={() => onAbrir(c)}>
              <span className="cu-titulo">{c.titulo}</span>
              <span className="cu-meta">
                <Tag>{rotuloTipo(c.tipo)}</Tag>
                {c.minutos != null && <span>{c.minutos} min</span>}
                {v.hay
                  ? <span className={v.medible ? '' : 'cu-tenue'}>{v.rotulo}{v.medible ? '' : ' · sin medir'}</span>
                  : <span className="cu-tenue">Sin video</span>}
                {conTarea && <span>{c.campos.length ? `Formulario · ${c.campos.length}` : 'Tarea'}</span>}
                {c.obligatoria && conTarea && <Status tono="good">Cierra la etapa</Status>}
              </span>
            </button>
            {puedeEditar && (
              <span className="cu-acciones">
                {!sinOrden && (
                  <>
                    <IconButton small title="Subir" disabled={i === 0 || moviendo !== null} onClick={() => onMover(c, 'arriba')}>↑</IconButton>
                    <IconButton small title="Bajar" disabled={i === lista.length - 1 || moviendo !== null} onClick={() => onMover(c, 'abajo')}>↓</IconButton>
                  </>
                )}
                <IconButton small danger title="Borrar clase" onClick={() => onBorrar(c)}>✕</IconButton>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const CSS = `
.cu-lista{ list-style:none; margin:0; padding:0; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); overflow:hidden; }
.cu-fila{ display:flex; align-items:center; gap:10px; padding:4px 10px 4px 12px; border-top:1px solid var(--border); }
.cu-fila:first-child{ border-top:0; }
.cu-fila:hover{ background:var(--surface-2); }
.cu-n{ flex:none; width:22px; text-align:center; font-size:var(--fs-meta); color:var(--dim); font-variant-numeric:tabular-nums; }
.cu-cuerpo{ flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; align-items:flex-start; text-align:left; padding:8px 0; border:0; background:transparent; cursor:pointer; font:inherit; color:inherit; }
.cu-titulo{ font-size:var(--fs-md); font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
.cu-meta{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:var(--fs-meta); color:var(--dim); }
.cu-tenue{ color:var(--faint); }
.cu-acciones{ flex:none; display:flex; gap:2px; }
.cu-vacio{ margin:0; font-size:var(--fs-sm); color:var(--dim); }
.cu-aviso{ color:var(--warn); font-weight:600; }
`;
