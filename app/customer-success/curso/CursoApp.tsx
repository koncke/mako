'use client';

// =============================================================================
// CursoApp — el curso de cada servicio, y cómo va cada cliente en él
// =============================================================================
// Dos vistas hermanas sobre el producto elegido:
//   · Clases — las etapas de su entrega como secciones, cada una con sus clases en orden. Se
//     crean, editan, borran y ordenan acá (sólo un admin: ver actions.ts).
//   · Avance — clientes × etapas: lo que envió cada uno, cuánto vio y cuándo entró.
//
// Y sobre las clases (mig 0208): la marca de GRABAR de cada una (#693, sólo un admin la cambia;
// la cabecera cuenta las que faltan grabar) y las NOTAS del equipo, de cada clase (en su editor)
// y de cada etapa (el botón «Notas» de la sección), que deja cualquiera que vea la tab (#692).
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
  Pagina, PageHeader, Section, Tabs, Select, Button, ButtonLink, IconButton, Status, Tag, Tooltip,
  EmptyState, ErrorState, Banner, Toast, Modal, useToast, useConfirm,
} from '@/app/_ui';
import type { Clase } from '@/lib/curso';
import { tieneTarea } from '@/lib/curso';
import { porEtapas, porGrabar, reordenar, rotuloTipo, videoDeClase, type FilaAvance } from './reglas';
import { borrarClaseAction, moverClaseAction, marcarGrabarAction } from './actions';
import { EditorClase } from './EditorClase';
import { NotasClase } from './NotasClase';
import { AvanceCurso, type EtapaVista } from './AvanceCurso';
import { ChecklistCurso, type OnboardingCurso } from './ChecklistCurso';
import { checklistCurso } from './onboarding-curso';

export type ServicioCurso = { productoId: number; nombre: string; etapas: EtapaVista[] };
export type VistaCurso = 'clases' | 'avance';
/** Cuántas notas tiene cada clase y cada etapa (`<producto>:<etapa>`). `null` = no se pudo leer. */
export type ConteoNotas = { porClase: Record<number, number>; porEtapa: Record<string, number> };

/** Las tres posiciones de la marca de grabar (mig 0208). */
type Grabar = boolean | null;
/**
 * ⚠️ UNA CONSTANTE Y NO `= {}` EN LOS PARÁMETROS: la marca se resincroniza comparando la prop por
 * identidad (como las clases), y un `{}` nuevo en cada render sería «llegó otra» en cada render —
 * un setState durante el render que no termina nunca.
 */
const SIN_MARCAS: Record<number, Grabar> = {};

/** La vista previa del alumno de un producto (./vista/page.tsx): sin lead, no crea accesos. */
const hrefVistaPrevia = (productoId: number) => `/customer-success/curso/vista?producto=${productoId}`;

export function CursoApp({
  servicios, clases: clasesProp, avance, avanceError, conAvance, puedeEditar, inicial, errorClases, errorEntrega,
  grabar: grabarProp = SIN_MARCAS, grabarError = null, notas: notasProp = null, onboarding = null,
}: {
  servicios: ServicioCurso[];
  /** No se pudieron leer los servicios. ⚠️ No es «no tienes servicios»: son dos pantallas. */
  errorEntrega?: string | null;
  /**
   * claseId → la marca de grabar. ⚠️ Aparte de `Clase` a propósito (ver `grabarDeProductos`,
   * lib/curso-admin.ts): el portal del alumno no la lee ni depende de la migración que la trae.
   */
  grabar?: Record<number, Grabar>;
  /** No se pudo leer la marca. ⚠️ No es «nada marcado»: sin leerla no se dibuja ni el control. */
  grabarError?: string | null;
  notas?: ConteoNotas | null;
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
  /** El onboarding de la tab (sólo para quien arma el curso). `null` = no se dibuja. */
  onboarding?: OnboardingCurso | null;
}) {
  const [productoId, setProductoId] = useState<number | null>(
    servicios.some((s) => s.productoId === inicial.productoId) ? inicial.productoId : servicios[0]?.productoId ?? null,
  );
  const [vista, setVista] = useState<VistaCurso>(inicial.vista);
  // Ver la cabecera: la lista local se pisa cuando llega otra desde el server.
  const [base, setBase] = useState(clasesProp);
  const [clases, setClases] = useState(clasesProp);
  if (base !== clasesProp) { setBase(clasesProp); setClases(clasesProp); }
  // La marca de grabar y el conteo de notas: el mismo patrón, por la misma razón. Marcar no
  // revalida (la pantalla cambia en el acto) y una nota nueva suma acá sin recargar.
  const [baseGrabar, setBaseGrabar] = useState(grabarProp);
  const [grabar, setGrabar] = useState(grabarProp);
  if (baseGrabar !== grabarProp) { setBaseGrabar(grabarProp); setGrabar(grabarProp); }
  const [baseNotas, setBaseNotas] = useState(notasProp);
  const [notas, setNotas] = useState<ConteoNotas | null>(notasProp);
  if (baseNotas !== notasProp) { setBaseNotas(notasProp); setNotas(notasProp); }
  const [marcando, setMarcando] = useState<number | null>(null);
  const [notasEtapa, setNotasEtapa] = useState<string | null>(null);

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

  /**
   * Marca (o des-marca) una clase para grabar. Optimista, como `mover`: la marca cambia en el
   * acto y la base confirma detrás; si no, vuelve a la de antes y lo dice.
   */
  const marcar = async (c: Clase, valor: Grabar) => {
    const antes = grabar[c.id] ?? null;
    const poner = (v: Grabar) => setGrabar((g) => ({ ...g, [c.id]: v }));
    poner(valor);
    setMarcando(c.id);
    try {
      const r = await marcarGrabarAction(c.id, valor);
      if (!r.ok) { poner(antes); show(r.error, undefined, 'bad'); return; }
      poner(r.grabar);
    } catch {
      // Una action sin red RECHAZA: sin este catch, la marca quedaba puesta sobre algo que no se
      // guardó (hallazgos-customer-success, «Una acción que no llega tumba la pantalla entera»).
      poner(antes);
      show('No se pudo marcar.', undefined, 'bad');
    } finally {
      setMarcando(null);
    }
  };

  const contarNotasClase = (id: number, n: number) =>
    setNotas((x) => (x && x.porClase[id] !== n ? { ...x, porClase: { ...x.porClase, [id]: n } } : x));
  const contarNotasEtapa = (k: string, n: number) =>
    setNotas((x) => (x && x.porEtapa[k] !== n ? { ...x, porEtapa: { ...x.porEtapa, [k]: n } } : x));

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
  // Sin poder leer la marca, el número sería un 0 inventado: no se dibuja (el banner lo dice).
  const nPorGrabar = grabarError ? 0 : porGrabar(delProducto, grabar);
  const marcas = grabarError ? null : grabar;

  // ── El onboarding de la tab ──
  // Si se dibuja lo decide el WORKSPACE (lo mismo que lee MaKo) y lo que cuenta es el PRODUCTO
  // elegido, como la cabecera: las dos reglas y el porqué, en `checklistCurso`. Se calcula de
  // la lista local, así agregar o borrar una clase lo mueve en el acto.
  const checklist = checklistCurso({
    clases, productoId, anotado: onboarding,
    errorDelProducto: productoId != null && !!errorClases[productoId],
  });
  const primeraEtapa = servicio?.etapas[0]?.key ?? null;

  const selector = (
    <Select value={String(productoId ?? '')} width={240} ariaLabel="Producto"
      options={servicios.map((s) => ({ value: String(s.productoId), label: s.nombre }))}
      onChange={(v) => setProductoId(Number(v))} />
  );

  return (
    <Pagina>
      <PageHeader
        titulo="Curso"
        estado={<>
          <Status>{nClases} {nClases === 1 ? 'clase' : 'clases'}</Status>
          {nPorGrabar > 0 && <Status tono="warn">{nPorGrabar} por grabar</Status>}
        </>}
        filtros={selector}
        /* Lo que ve el cliente en su portal, sin ser cliente: una vista previa SIN lead
           (./vista/page.tsx), que no crea accesos ni guarda avance. */
        acciones={productoId ? <ButtonLink size="sm" variant="secondary" href={hrefVistaPrevia(productoId)}>Vista del alumno</ButtonLink> : undefined}
        tabs={<Tabs activa={vista} onCambio={(v) => setVista(v as VistaCurso)}
          tabs={[{ id: 'clases', label: 'Clases', badge: nClases }, { id: 'avance', label: 'Avance', badge: filas.length }]} />}
      />

      {productoId && errorClases[productoId] && <Banner tono="bad">No pude leer las clases. {errorClases[productoId]}</Banner>}
      {grabarError && vista === 'clases' && <Banner tono="bad">No pude leer qué grabar. {grabarError}</Banner>}

      {checklist && onboarding && (
        <ChecklistCurso
          clases={checklist.clases}
          conVideo={checklist.conVideo}
          vista={onboarding.vista}
          invitar={{ hecho: onboarding.invitar || onboarding.invitados > 0, n: onboarding.invitados }}
          /* El ensayo mira un curso: sobre un producto sin clases no hay nada que ver, y lo que
             sigue es «Agregar clase» (el mismo orden que el catálogo). */
          hrefVista={productoId && checklist.clases > 0 ? hrefVistaPrevia(productoId) : null}
          onAgregarClase={puedeEditar && primeraEtapa
            ? () => { setVista('clases'); setEditando({ clase: null, etapa: primeraEtapa }); }
            : undefined}
          onIrAAvance={() => setVista('avance')}
        />
      )}

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
            // Las notas de la ETAPA (no de una clase): las ve y las escribe cualquiera que vea la
            // tab, así que el botón no depende de `puedeEditar` (#692).
            const nNotas = notas?.porEtapa[`${servicio.productoId}:${e.key}`] ?? 0;
            return (
              <Section key={e.key} titulo={e.label}
                nota={lista.length > 0 && !cierra
                  ? <Tooltip text="Ninguna clase cierra esta etapa: el cliente no avanza solo."><span className="cu-aviso">No avanza sola</span></Tooltip>
                  : undefined}
                accion={
                  <span className="cu-sec-acciones">
                    <Button size="sm" variant="tertiary" onClick={() => setNotasEtapa(e.key)}>{nNotas > 0 ? `Notas · ${nNotas}` : 'Notas'}</Button>
                    {puedeEditar && <Button size="sm" variant="secondary" onClick={() => setEditando({ clase: null, etapa: e.key })}>+ Clase</Button>}
                  </span>
                }>
                {lista.length === 0
                  ? <p className="cu-vacio">Sin clases.</p>
                  : <ListaClases lista={lista} puedeEditar={puedeEditar} moviendo={moviendo}
                      marcas={marcas} marcando={marcando} notas={notas?.porClase ?? null}
                      onAbrir={(c) => setEditando({ clase: c, etapa: c.etapa })}
                      onMover={(c, d) => void mover(c, d)} onBorrar={(c) => void borrarDesdeLista(c)}
                      onMarcar={(c, v) => void marcar(c, v)} />}
              </Section>
            );
          })}

          {huerfanas.length > 0 && (
            // Su etapa se borró en el editor de etapas. Siguen en la base, con su avance: se
            // muestran para que alguien las mueva a una etapa que exista (o las borre).
            <Section titulo="Sin etapa" nota="Su etapa ya no existe.">
              <ListaClases lista={huerfanas} puedeEditar={puedeEditar} moviendo={moviendo} sinOrden
                marcas={marcas} marcando={marcando} notas={notas?.porClase ?? null}
                onAbrir={(c) => setEditando({ clase: c, etapa: servicio.etapas[0]?.key ?? c.etapa })}
                onMover={() => {}} onBorrar={(c) => void borrarDesdeLista(c)}
                onMarcar={(c, v) => void marcar(c, v)} />
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
          onNotas={editando.clase ? (n) => contarNotasClase(editando.clase!.id, n) : undefined}
        />
      )}

      {notasEtapa && servicio && (
        // ALTO FIJO: la caja crece con cada nota, y un detalle que cambia de tamaño según lo que
        // tiene adentro es lo que la regla de la casa prohíbe (AGENTS.md, «una caja cuyo alto es
        // un TOPE»).
        <Modal titulo={`Notas · ${servicio.etapas.find((x) => x.key === notasEtapa)?.label ?? notasEtapa}`}
          ancho={600} alto="min(80vh, 640px)" onCerrar={() => setNotasEtapa(null)}>
          <NotasClase key={`${servicio.productoId}:${notasEtapa}`} productoId={servicio.productoId}
            destino={{ etapa: notasEtapa }} puedeBorrarTodo={puedeEditar}
            onTotal={(n) => contarNotasEtapa(`${servicio.productoId}:${notasEtapa}`, n)} />
        </Modal>
      )}

      {confirmNode}
      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Pagina>
  );
}

function ListaClases({ lista, puedeEditar, moviendo, sinOrden, marcas, marcando, notas, onAbrir, onMover, onBorrar, onMarcar }: {
  lista: Clase[];
  puedeEditar: boolean;
  moviendo: number | null;
  sinOrden?: boolean;
  /** claseId → la marca de grabar. `null` = no se pudo leer: ni control ni rótulo. */
  marcas: Record<number, Grabar> | null;
  /** La clase cuya marca se está guardando. */
  marcando: number | null;
  /** claseId → cuántas notas tiene. `null` = no se pudo leer: no se dice nada. */
  notas: Record<number, number> | null;
  onAbrir: (c: Clase) => void;
  onMover: (c: Clase, dir: 'arriba' | 'abajo') => void;
  onBorrar: (c: Clase) => void;
  onMarcar: (c: Clase, v: Grabar) => void;
}) {
  return (
    <ol className="cu-lista">
      {lista.map((c, i) => {
        const v = videoDeClase(c);
        const conTarea = tieneTarea(c);
        const marca = marcas ? (marcas[c.id] ?? null) : undefined;
        const nNotas = notas?.[c.id] ?? 0;
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
                {/* Quien no edita VE la marca (y nada mientras nadie decidió); quien edita, el control. */}
                {!puedeEditar && marca === true && <Status tono="warn">Grabar</Status>}
                {!puedeEditar && marca === false && <span className="cu-tenue">No grabar</span>}
                {nNotas > 0 && <span>{nNotas} {nNotas === 1 ? 'nota' : 'notas'}</span>}
              </span>
            </button>
            {puedeEditar && marca !== undefined && (
              <ControlGrabar valor={marca} ocupado={marcando === c.id} onCambio={(x) => onMarcar(c, x)} />
            )}
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

/**
 * Grabar / No grabar (#693): dos posiciones, y la tercera —«sin decidir»— es ninguna elegida.
 * Tocar la que ya está elegida la des-marca: equivocarse de botón no deja una decisión que nadie
 * tomó. Mientras se guarda queda apagado, sin desmontarse (un control que desaparece bajo el dedo
 * se lee como un clic que no registró).
 */
function ControlGrabar({ valor, ocupado, onCambio }: { valor: Grabar; ocupado: boolean; onCambio: (v: Grabar) => void }) {
  const opcion = (v: boolean, rotulo: string, titulo: string) => (
    <button type="button" aria-pressed={valor === v} data-on={valor === v} disabled={ocupado}
      title={valor === v ? 'Quitar la marca' : titulo} onClick={() => onCambio(valor === v ? null : v)}>
      {rotulo}
    </button>
  );
  return (
    <span className="cu-grabar" role="group" aria-label="Grabar la clase">
      {opcion(true, 'Grabar', 'Hay que grabarla')}
      {opcion(false, 'No grabar', 'No se graba')}
    </span>
  );
}

const CSS = `
.cu-sec-acciones{ display:inline-flex; align-items:center; gap:6px; }
.cu-grabar{ flex:none; display:inline-flex; border:1px solid var(--border-strong); border-radius:var(--r-sm); overflow:hidden; }
.cu-grabar button{ padding:4px 9px; border:0; background:var(--surface); color:var(--dim); font:inherit; font-size:var(--fs-meta); white-space:nowrap; cursor:pointer; min-height:28px; }
.cu-grabar button + button{ border-left:1px solid var(--border-strong); }
.cu-grabar button[data-on="true"]{ background:var(--primary-bg); color:var(--primary); font-weight:600; }
.cu-grabar button:disabled{ cursor:default; opacity:.6; }
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
