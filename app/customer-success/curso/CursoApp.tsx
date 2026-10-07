'use client';

// =============================================================================
// CursoApp — el curso de cada servicio, y cómo va cada cliente en él
// =============================================================================
// ⚠️ SE DIBUJA CON EL DISEÑO DE CONOCIMIENTOS (app/_cursos/CursoUgc.tsx), el MISMO que ve el
//    alumno en su portal, con los controles de quien lo arma encima. Pedido de Martín el
//    07/10/2026, mirando el portal al lado de /conocimientos: «No se ve para nada igual, COPIA lo
//    que ya hicimos en CONOCIMIENTOS» y, en el mismo hilo, «No solo la vista de alumnos, la vista
//    del editor también se tiene que ver tal cual». Las etapas de la entrega son los módulos de la
//    barra y sus clases las lecciones; la traducción, pura y con test, está en ./modelo-ugc.ts.
//
// Lo que tiene la tab adentro del curso:
//   · Una etapa abierta: sus clases como tarjetas, con «Editar», ↑ ↓ ✕ y «+ Clase» (sólo un admin:
//     ver actions.ts), y en su cabecera las NOTAS de la etapa (cualquiera que vea la tab, #692) y el
//     aviso de que no avanza sola.
//   · Una clase abierta: el video, la ficha (tipo, minutos, si cierra la etapa y la marca de GRABAR,
//     #693) y el papel con la tarea TAL COMO LA VE EL ALUMNO (en modo vista previa: no guarda
//     nada), la descripción y las notas de la clase.
//   · «Avance de los clientes», una entrada propia de la barra: clientes × etapas, lo que envió
//     cada uno, cuánto vio y cuándo entró.
//
// ⚠️ EL CURSO CUELGA DE LAS ETAPAS DE LA ENTREGA, no tiene etapas propias (mig 0202). Las
// columnas del kanban de Customer Success SON los módulos de acá: renombrar una allá la renombra
// acá, y una clase de una etapa borrada aparece en «Sin etapa» para moverla.
//
// ⚠️ LAS CLASES VIVEN EN UN ESTADO LOCAL QUE SE RESINCRONIZA CON LAS PROPS. Guardar y borrar
// revalidan la página (llega la lista nueva y pisa la local); mover NO revalida —la flecha
// mueve la tarjeta en el acto y la base confirma detrás—, así que la local es la que manda
// hasta la próxima carga.
//
// ⚠️ LA POSICIÓN (etapa abierta, clase abierta, Avance) VIVE EN EL HASH y su dueño es
// app/conocimientos/posicion.ts, como en Conocimientos. El producto va en `?producto=`; cambiar de
// producto vacía el hash, porque las etapas de dos productos pueden llamarse igual.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pagina, PageHeader, Status, EmptyState, ErrorState, Banner, Toast, Modal, useToast, useConfirm,
} from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { PortadaPicker } from '@/app/_components/PortadaPicker';
import type { Clase } from '@/lib/curso';
import { reproductorDeClase, tieneTarea } from '@/lib/curso';
import CursoUgc, { ChipUgc, ItemMenuUgc, TituloMenuUgc } from '@/app/_cursos/CursoUgc';
import type { LeccionUgc, ObjetivoUgc, TextoUgc } from '@/app/_cursos/tipos';
import {
  ACENTOS, ACENTO_DEFAULT, conAjuste, estiloVacio, tapaDe, valorDe, type Ajuste, type EstiloCurso,
} from '@/lib/curso-estilo';
import { navegar, sembrar, usePosicion } from '@/app/conocimientos/posicion';
import Reproductor from '@/app/compartido/curso/[token]/Reproductor';
import TareaAlumno from '@/app/compartido/curso/[token]/TareaAlumno';
import { VistaPreviaCtx } from '@/app/compartido/curso/[token]/vista-previa';
import { CSS_PORTAL } from '@/app/compartido/curso/[token]/estilos';
import { marcaDelProducto } from '@/app/compartido/curso/[token]/modelo-ugc';
import { porEtapas, porGrabar, reordenar, rotuloTipo, videoDeClase, type FilaAvance } from './reglas';
import {
  SIN_ETAPA, TEXTOS_EDITOR, chipsDelEditor, cierraLaEtapa, clasesDelEditor, modulosDelEditor, puedeMoverEnEditor,
} from './modelo-ugc';
import {
  borrarClaseAction, moverClaseAction, marcarGrabarAction, urlVerVideoAction, guardarEstiloCursoAction,
  renombrarClaseAction, renombrarEtapaCursoAction,
} from './actions';
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
/** Por la misma razón que `SIN_MARCAS`: una constante, no un `{}` en los parámetros. */
const SIN_ESTILOS: Record<number, EstiloCurso> = {};

/** La entrada propia de la barra (`#x=avance`). */
const AVANCE = 'avance';

/** La vista previa del alumno de un producto (./vista/page.tsx): sin lead, no crea accesos. */
const hrefVistaPrevia = (productoId: number) => `/customer-success/curso/vista?producto=${productoId}`;

export function CursoApp({
  servicios, clases: clasesProp, avance, avanceError, conAvance, puedeEditar, inicial, errorClases, errorEntrega,
  grabar: grabarProp = SIN_MARCAS, grabarError = null, notas: notasProp = null, onboarding = null,
  estilos: estilosProp = SIN_ESTILOS, estiloError = null,
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
  /** productoId → cómo se ve su curso (mig 0214). Sin fila = el de siempre. */
  estilos?: Record<number, EstiloCurso>;
  /**
   * No se pudo leer cómo se ven los cursos. ⚠️ No es «nadie eligió nada»: se dibuja el de siempre,
   * se AVISA, y no se ofrece cambiar el estilo — se editaría encima de algo que no se ve.
   */
  estiloError?: string | null;
}) {
  const [productoId, setProductoId] = useState<number | null>(
    servicios.some((s) => s.productoId === inicial.productoId) ? inicial.productoId : servicios[0]?.productoId ?? null,
  );
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
  // El estilo de cada curso: el mismo patrón que las clases (se pisa cuando llega otro del server).
  const [baseEstilos, setBaseEstilos] = useState(estilosProp);
  const [estilos, setEstilos] = useState(estilosProp);
  if (baseEstilos !== estilosProp) { setBaseEstilos(estilosProp); setEstilos(estilosProp); }
  /**
   * Lo último que el SERVER confirmó, por producto. Si un guardado falla, la pantalla vuelve ACÁ y
   * no a lo que había en pantalla: con el color «otro» lo de pantalla es un tono a mitad de camino
   * que nunca se guardó (revisión del 07/10/2026).
   */
  const confirmados = useRef<Record<number, EstiloCurso>>(estilosProp);
  if (baseEstilos !== estilosProp) confirmados.current = estilosProp;
  /** El selector de portadas abierto: qué portada cambia y de qué botón cuelga. */
  const [picker, setPicker] = useState<{ ajuste: Ajuste; ancla: HTMLElement } | null>(null);
  /** Los nombres de etapa cambiados acá (`<producto>:<key>` → nombre), hasta que la página los traiga. */
  const [nombresEtapa, setNombresEtapa] = useState<Record<string, string>>({});
  const timerAcento = useRef<number | undefined>(undefined);
  // Dónde está parado: la lista del onboarding y los avisos de grabar van sólo en el índice.
  const { pos } = usePosicion();
  const { toast, show, clear } = useToast();
  const { confirm, confirmNode } = useConfirm();

  const servicio = servicios.find((s) => s.productoId === productoId) ?? null;

  // El producto queda en la URL, para que recargar (o un link desde la ficha del cliente) vuelva
  // al mismo lugar. `replaceState` y no el router: el router volvería a pedir la página entera al
  // server por un cambio que ya está en memoria. La posición adentro del curso va en el hash, que
  // esto conserva (`u.href` lo trae).
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (productoId) u.searchParams.set('producto', String(productoId)); else u.searchParams.delete('producto');
      // `?vista=avance` era la pestaña de antes: hoy es una entrada de la barra (el efecto de abajo).
      u.searchParams.delete('vista');
      if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href);
    } catch { /* sin URL no se pierde nada: es una comodidad */ }
  }, [productoId]);

  // Aterrizar adentro (un F5 en una clase, un link pegado) siembra el índice del curso debajo: sin
  // esto la posición del hash no se lee hasta el primer Atrás (ver PortalAlumno, que hace lo mismo).
  useEffect(() => { sembrar({}); }, []);

  // Un link viejo (o de la ficha del cliente) con `?vista=avance` abre el Avance, una sola vez.
  const abrioAvance = useRef(false);
  useEffect(() => {
    if (abrioAvance.current || inicial.vista !== 'avance') return;
    abrioAvance.current = true;
    navegar({ extra: AVANCE }, 'reemplazar');
  }, [inicial.vista]);

  const delProducto = useMemo(() => clases.filter((c) => c.productoId === productoId), [clases, productoId]);
  const { porEtapa, huerfanas } = useMemo(
    () => porEtapas(delProducto, servicio?.etapas.map((e) => e.key) ?? []),
    [delProducto, servicio],
  );
  const filas = productoId ? avance[productoId] ?? [] : [];
  const etapasMin = useMemo(
    () => servicio?.etapas.map((e) => ({ key: e.key, label: nombresEtapa[`${servicio.productoId}:${e.key}`] ?? e.label })) ?? [],
    [servicio, nombresEtapa],
  );
  const estiloActual = productoId != null ? estilos[productoId] : undefined;
  const clasesUgcBase = useMemo(
    () => clasesDelEditor(etapasMin, porEtapa, huerfanas, estiloActual),
    [etapasMin, porEtapa, huerfanas, estiloActual],
  );
  const porId = useMemo(() => new Map(delProducto.map((c) => [c.id, c])), [delProducto]);

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
  /** La etapa en la que se abre una clase: la suya, o la primera si la suya ya no existe. */
  const etapaParaEditar = (c: Clase) => (servicio?.etapas.some((e) => e.key === c.etapa) ? c.etapa : primeraEtapa ?? c.etapa);

  const cambiarProducto = (id: number) => {
    // Las etapas de dos productos pueden llamarse igual: la posición es de otro curso.
    navegar({}, 'reemplazar');
    setProductoId(id);
  };

  // ── Cómo se ve el curso (mig 0214): color, títulos y portadas ──
  // Optimista, como `mover` y `marcar`: el cambio se ve en el acto y el server confirma detrás. Lo
  // que el server contesta MANDA (un color muy oscuro vuelve aclarado, `acentoLegible`).
  const estilo = (productoId != null ? estilos[productoId] : undefined) ?? estiloVacio();
  const guardarAjuste = async (a: Ajuste, v: string | null): Promise<boolean> => {
    if (productoId == null) return false;
    const pid = productoId;
    // ⚠️ Un color elegido de la paleta CANCELA el «otro» que esperaba guardarse: si no, a los 450 ms
    //    el pendiente pisaba en la base la elección explícita (revisión del 07/10/2026).
    if (a.tipo === 'acento') window.clearTimeout(timerAcento.current);
    const poner = (x: string | null) => setEstilos((m) => ({ ...m, [pid]: conAjuste(m[pid] ?? estiloVacio(), a, x) }));
    const antes = valorDe(confirmados.current[pid] ?? estiloVacio(), a);
    poner(v);
    try {
      const r = await guardarEstiloCursoAction(pid, a, v);
      if (!r.ok) { poner(antes); show(r.error, undefined, 'bad'); return false; }
      confirmados.current = { ...confirmados.current, [pid]: conAjuste(confirmados.current[pid] ?? estiloVacio(), a, r.valor) };
      poner(r.valor);
      return true;
    } catch {
      poner(antes);
      show('No se pudo guardar.', undefined, 'bad');
      return false;
    }
  };

  /** El color «otro»: el selector nativo dispara un cambio por cada movimiento; se guarda al quedarse quieto. */
  const probarAcento = (hex: string) => {
    if (productoId == null) return;
    const pid = productoId;
    setEstilos((m) => ({ ...m, [pid]: conAjuste(m[pid] ?? estiloVacio(), { tipo: 'acento' }, hex) }));
    window.clearTimeout(timerAcento.current);
    timerAcento.current = window.setTimeout(() => { void guardarAjuste({ tipo: 'acento' }, hex); }, 450);
  };

  /** El clic en un texto (ver `TextoEditable` en app/_cursos/CursoUgc.tsx). */
  const guardarTexto = async (que: TextoUgc, valor: string): Promise<boolean> => {
    if (productoId == null) return false;
    const pid = productoId;
    if ((que.tipo === 'curso-titulo' || que.tipo === 'curso-resumen') && estiloError) {
      show('No pude leer cómo se ve el curso.', undefined, 'bad');
      return false;
    }
    // Vacío = volver al default: el nombre del producto, o la descripción automática.
    if (que.tipo === 'curso-titulo') return guardarAjuste({ tipo: 'titulo' }, valor || null);
    if (que.tipo === 'curso-resumen') return guardarAjuste({ tipo: 'resumen' }, valor || null);
    if (!valor) { show('El nombre no puede quedar vacío.', undefined, 'bad'); return false; }
    try {
      if (que.tipo === 'modulo') {
        const r = await renombrarEtapaCursoAction(pid, que.key, valor);
        if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
        setNombresEtapa((m) => ({ ...m, [`${pid}:${que.key}`]: r.nombre }));
        return true;
      }
      const r = await renombrarClaseAction(que.id, valor);
      if (!r.ok) { show(r.error, undefined, 'bad'); return false; }
      setClases((cs) => cs.map((x) => (x.id === que.id ? { ...x, titulo: r.titulo } : x)));
      return true;
    } catch {
      show('No se pudo guardar.', undefined, 'bad');
      return false;
    }
  };

  /** «Portada»: abre el selector de siempre (degradados, fotos, subir) colgado del botón tocado. */
  const abrirPortada = (que: ObjetivoUgc, ancla: HTMLElement) => {
    const ajuste: Ajuste = que.tipo === 'curso' ? { tipo: 'portada' }
      : que.tipo === 'modulo' ? { tipo: 'portada-etapa', etapa: que.key }
        : { tipo: 'portada-clase', clase: que.id };
    setPicker({ ajuste, ancla });
  };

  /** El nombre de un curso: el que se le eligió, o el del producto. */
  const tituloDe = (s: ServicioCurso) => estilos[s.productoId]?.titulo ?? s.nombre;

  // ── El curso, con el dibujo de Conocimientos ──
  const modulos = servicio ? modulosDelEditor(etapasMin, porEtapa, huerfanas, estilo).map((m) => {
    if (m.key === SIN_ETAPA) {
      return { ...m, acciones: <span className="cu-aviso">Su etapa ya no existe</span> };
    }
    const lista = porEtapa[m.key] ?? [];
    // Las notas de la ETAPA (no de una clase): las ve y las escribe cualquiera que vea la tab, así
    // que el botón no depende de `puedeEditar` (#692).
    const nNotas = notas?.porEtapa[`${servicio.productoId}:${m.key}`] ?? 0;
    return {
      ...m,
      acciones: (
        <span className="cu-sec-acciones">
          {lista.length > 0 && !cierraLaEtapa(lista) && (
            <span className="cu-aviso" title="Ninguna clase cierra esta etapa: el cliente no avanza solo.">No avanza sola</span>
          )}
          <button type="button" className="ugc-btn" onClick={() => setNotasEtapa(m.key)}>{nNotas > 0 ? `Notas · ${nNotas}` : 'Notas'}</button>
        </span>
      ),
    };
  }) : [];

  const clasesUgc = clasesUgcBase.map((u) => {
    const c = porId.get(u.id)!;
    return {
      ...u,
      chips: chipsDelEditor(c, { marca: marcas ? (marcas[c.id] ?? null) : undefined, notas: notas?.porClase[c.id] ?? 0 })
        .map((ch) => <ChipUgc key={ch.texto} tono={ch.tono}>{ch.texto}</ChipUgc>),
    };
  });

  const leccion = (id: number): LeccionUgc => {
    const c = porId.get(id);
    if (!c || !servicio) return {};
    const { video } = reproductorDeClase(c);
    const v = videoDeClase(c);
    const conTarea = tieneTarea(c);
    const marca = marcas ? (marcas[c.id] ?? null) : undefined;
    const desc = c.descripcion.trim();
    const pestanas = [
      ...(conTarea ? [{
        nombre: 'Tarea',
        // La tarea TAL COMO LA VE EL ALUMNO, en vista previa: se puede llenar y no guarda nada.
        cuerpo: (
          <div className="ugc-paper">
            <VistaPreviaCtx.Provider value>
              <TareaAlumno token="" claseId={c.id} tarea={c.tarea} campos={c.campos}
                valoresIniciales={{}} estadoInicial="pendiente" onEstado={() => {}} onAvance={() => {}} />
            </VistaPreviaCtx.Provider>
          </div>
        ),
      }] : []),
      ...(desc ? [{ nombre: 'Descripción', cuerpo: <div className="ugc-paper">{parrafos(desc)}</div> }] : []),
      {
        nombre: (notas?.porClase[c.id] ?? 0) > 0 ? `Notas · ${notas!.porClase[c.id]}` : 'Notas',
        cuerpo: (
          <div className="ugc-paper">
            <NotasClase key={c.id} productoId={servicio.productoId} destino={{ claseId: c.id }}
              puedeBorrarTodo={puedeEditar} onTotal={(n) => contarNotasClase(c.id, n)} />
          </div>
        ),
      },
    ];
    return {
      video: video && video.tipo !== 'afuera' ? { cuerpo: <VideoDeClase clase={c} /> } : undefined,
      debajoDelVideo: (
        <div className="cu-ficha">
          <span className="cu-ficha-meta">
            <span>{rotuloTipo(c.tipo)}</span>
            {c.minutos != null && <span>{c.minutos} min</span>}
            {v.hay
              ? <span className={v.medible ? '' : 'cu-tenue'}>{v.rotulo}{v.medible ? '' : ' · sin medir'}</span>
              : <span className="cu-tenue">Sin video</span>}
            {c.obligatoria && conTarea && <Status tono="good">Cierra la etapa</Status>}
            {/* Quien no edita VE la marca (y nada mientras nadie decidió); quien edita, el control. */}
            {!puedeEditar && marca === true && <Status tono="warn">Grabar</Status>}
            {!puedeEditar && marca === false && <span className="cu-tenue">No grabar</span>}
          </span>
          {puedeEditar && marca !== undefined && (
            <ControlGrabar valor={marca} ocupado={marcando === c.id} onCambio={(x) => void marcar(c, x)} />
          )}
          {video?.tipo === 'afuera' && <VideoDeClase clase={c} />}
        </div>
      ),
      pestanas,
    };
  };

  // Lo que en la pantalla vieja era la cabecera de la tab: los avisos de lectura y la lista del
  // onboarding. Van ADENTRO del curso, debajo del buscador (`arriba`): Martín pidió sacar la barra
  // de arriba entera, «que no aparezca absolutamente nada... ni el título» (07/10/2026).
  //
  // ⚠️ `arriba` queda FIJO en todas las vistas, así que lo largo va SÓLO en el índice: la lista del
  //    onboarding en una lección se comía la pantalla, y en un teléfono el curso entero.
  const enIndice = !pos.clase && !pos.extra && !pos.mod && !pos.q;
  const conLista = enIndice && !!checklist && !!onboarding;
  const avisos = (
    (productoId && errorClases[productoId]) || grabarError || estiloError || conLista || (enIndice && nPorGrabar > 0)
  ) ? (
    <div className="cu-arriba">
      {productoId && errorClases[productoId] && <Banner tono="bad">No pude leer las clases. {errorClases[productoId]}</Banner>}
      {grabarError && <Banner tono="bad">No pude leer qué grabar. {grabarError}</Banner>}
      {estiloError && <Banner tono="bad">No pude leer cómo se ve el curso. {estiloError}</Banner>}
      {/* Era un chip de la cabecera que se sacó; arriba a la derecha se esconde en pantallas chicas. */}
      {enIndice && nPorGrabar > 0 && <Status tono="warn">{nPorGrabar} por grabar</Status>}
      {conLista && checklist && onboarding && (
        <ChecklistCurso
          clases={checklist.clases}
          conVideo={checklist.conVideo}
          vista={onboarding.vista}
          invitar={{ hecho: onboarding.invitar || onboarding.invitados > 0, n: onboarding.invitados }}
          /* El ensayo mira un curso: sobre un producto sin clases no hay nada que ver, y lo que
             sigue es «Agregar clase» (el mismo orden que el catálogo). */
          hrefVista={productoId && checklist.clases > 0 ? hrefVistaPrevia(productoId) : null}
          onAgregarClase={puedeEditar && primeraEtapa
            ? () => setEditando({ clase: null, etapa: primeraEtapa })
            : undefined}
          onIrAAvance={() => navegar({ extra: AVANCE })}
        />
      )}
    </div>
  ) : undefined;

  /**
   * EL MENÚ DE LA MARCA. Lo que estaba en la barra de arriba que se sacó: el producto que se mira
   * (era un desplegable aparte), la vista del alumno, y lo nuevo, el color. Es el lugar donde
   * Martín lo pidió: «el desplegable debería ser "Negocio que Escala" de la sidebar».
   */
  const acentoActual = estilo.acento ?? ACENTO_DEFAULT;
  const menuMarca = (cerrar: () => void) => (
    <>
      <TituloMenuUgc>Cursos</TituloMenuUgc>
      {servicios.map((s) => (
        <ItemMenuUgc key={s.productoId} activo={s.productoId === productoId}
          onClick={() => { cerrar(); if (s.productoId !== productoId) cambiarProducto(s.productoId); }}>
          {tituloDe(s)}
        </ItemMenuUgc>
      ))}
      {puedeEditar && !estiloError && (
        <>
          <div className="ugc-menu-sep" />
          <TituloMenuUgc>Color</TituloMenuUgc>
          <div className="ugc-swatches">
            {ACENTOS.map((a) => (
              <button key={a.hex} type="button" className="ugc-swatch" style={{ background: a.hex }}
                aria-pressed={acentoActual === a.hex} title={a.nombre} aria-label={a.nombre}
                onClick={() => void guardarAjuste({ tipo: 'acento' }, a.hex === ACENTO_DEFAULT ? null : a.hex)} />
            ))}
            {/* Cualquier otro color. Uno muy oscuro vuelve aclarado: el acento es FONDO de texto
                oscuro (lib/curso-estilo.ts, `acentoLegible`). */}
            <label className={`ugc-swatch ugc-swatch--otro${ACENTOS.some((a) => a.hex === acentoActual) ? '' : ' on'}`} title="Otro color">
              <input type="color" value={acentoActual} aria-label="Otro color" onChange={(e) => probarAcento(e.target.value)} />
            </label>
          </div>
        </>
      )}
      {productoId != null && (
        <>
          <div className="ugc-menu-sep" />
          <Link className="ugc-menu-item" href={hrefVistaPrevia(productoId)} onClick={cerrar}>Vista del alumno</Link>
        </>
      )}
    </>
  );

  if (!servicio) {
    return (
      <Pagina>
        <ErrorState titulo="No encontré ese producto" />
      </Pagina>
    );
  }

  return (
    // ⚠️ SIN CABECERA: el curso ES la pantalla, como en Conocimientos. Lo que había arriba se mudó
    //    al menú de la marca (el producto, la vista del alumno) y al pie del buscador (las clases y
    //    cuántas faltan grabar).
    <Pagina ancho="completo" style={{ padding: 0 }}>
      <CursoUgc
        key={servicio.productoId}
        modo="pagina"
        // Arriba a la derecha va el NOMBRE del curso, como en Conocimientos: «Curso» era el título
        // de la barra que Martín pidió sacar («ni el título»).
        titulo={tituloDe(servicio)}
        subtitulo={`${nClases} ${nClases === 1 ? 'clase' : 'clases'}${nPorGrabar > 0 ? ` · ${nPorGrabar} por grabar` : ''}`}
        marca={{ ...marcaDelProducto(tituloDe(servicio)), menu: menuMarca, ariaLabel: `${tituloDe(servicio)}: cambiar de curso` }}
        acento={estilo.acento}
        modulos={modulos}
        clases={clasesUgc}
        portada={{
          eyebrow: 'Curso',
          titulo: tituloDe(servicio),
          // Editando, la descripción vacía muestra su invitación; el alumno ve su avance en su lugar.
          resumen: puedeEditar ? (estilo.resumen ?? '') : (estilo.resumen ?? `${servicio.etapas.length} etapas · ${nClases} clases`),
          ...tapaDe(estilo.portada),
        }}
        leccion={(clase) => leccion(clase.id)}
        arriba={avisos}
        entradasExtra={[{
          key: AVANCE,
          nombre: 'Avance de los clientes',
          cuenta: filas.length,
          cuerpo: <div className="cu-avance"><AvanceCurso etapas={servicio.etapas} filas={filas} error={avanceError} /></div>,
        }]}
        edicion={puedeEditar ? {
          onNueva: (k) => setEditando({ clase: null, etapa: k === SIN_ETAPA ? primeraEtapa ?? k : k }),
          onEditar: (id) => { const c = porId.get(id); if (c) setEditando({ clase: c, etapa: etapaParaEditar(c) }); },
          onMover: (id, dir) => { const c = porId.get(id); if (c) void mover(c, dir); },
          onBorrar: (id) => { const c = porId.get(id); if (c) void borrarDesdeLista(c); },
          puedeMover: (id, dir) => puedeMoverEnEditor(clasesUgc, id, dir),
          ocupado: moviendo !== null,
          onTexto: guardarTexto,
          onPortada: estiloError ? undefined : abrirPortada,
        } : undefined}
        textos={TEXTOS_EDITOR}
      />

      {picker && (
        // El MISMO selector de las portadas del tablero y de la ficha del cliente: degradados,
        // fotos y subir. Elegir no lo cierra (se prueba mirando), y lo que se elige se guarda.
        <PortadaPicker
          valor={valorDe(estilo, picker.ajuste)}
          colorBase={acentoActual}
          ancla={picker.ancla}
          titulo="Portada"
          sinAutomatico
          onElegir={(v) => { void guardarAjuste(picker.ajuste, v); }}
          onCerrar={() => setPicker(null)}
        />
      )}

      {editando && (
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

      {notasEtapa && (
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
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_PORTAL }} />
    </Pagina>
  );
}

/** El texto de una descripción, en párrafos: una línea en blanco los separa. */
function parrafos(texto: string) {
  return texto.split(/\n{2,}/).map((p, i) => <p key={i} className="ugc-doc-p">{p}</p>);
}

/**
 * El video de la clase, con el MISMO reproductor del portal en modo vista previa (no manda avance:
 * no hay alumno). Un video SUBIDO no tiene link público: se pide uno firmado de vida corta, como
 * «Ver» en el editor de la clase (`urlVerVideoAction`, que alcanza con poder mirar la tab).
 */
function VideoDeClase({ clase }: { clase: Clase }) {
  const { video } = reproductorDeClase(clase);
  const [firmada, setFirmada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = video?.tipo === 'archivo' ? clase.videoPath : null;
  useEffect(() => {
    if (!path) return;
    let vivo = true;
    urlVerVideoAction(path)
      .then((r) => { if (vivo) { if (r.ok) setFirmada(r.url); else setError(r.error); } })
      .catch(() => { if (vivo) setError('No pude abrir el video.'); });
    return () => { vivo = false; };
  }, [path]);
  if (!video) return null;
  if (video.tipo === 'archivo') {
    if (error) return <p className="cp-nota" style={{ padding: 16, color: '#fff' }}>{error}</p>;
    if (!firmada) return null;
    return (
      <VistaPreviaCtx.Provider value>
        <Reproductor token="" claseId={clase.id} video={{ tipo: 'directo', url: firmada }} titulo={clase.titulo} onPct={() => {}} />
      </VistaPreviaCtx.Provider>
    );
  }
  return (
    <VistaPreviaCtx.Provider value>
      <Reproductor token="" claseId={clase.id} video={video} titulo={clase.titulo} onPct={() => {}} />
    </VistaPreviaCtx.Provider>
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
.cu-curso{ flex: 1 1 0; min-height: 480px; display: flex; flex-direction: column; margin-top: 4px;
  border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; }
.cu-sec-acciones{ display:inline-flex; flex-wrap:wrap; align-items:center; gap:8px; }
.cu-aviso{ font-family: var(--font-jetbrains), monospace; font-size: 11px; font-weight: 700;
  padding: 5px 10px; border-radius: 999px; background: #ffe2a3; border: 1.5px solid var(--u-ink, #16150f); }
.cu-ficha{ display:flex; flex-wrap:wrap; align-items:center; gap:10px; justify-content: space-between; }
.cu-ficha-meta{ display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; font-size: 12.5px; color: var(--u-ink-60, var(--dim)); }
.cu-tenue{ opacity: .7; }
.cu-grabar{ flex:none; display:inline-flex; border:2px solid var(--u-ink, #16150f); border-radius: 9px; overflow:hidden; }
.cu-grabar button{ padding:6px 11px; border:0; background:var(--u-card-2, #f8f6ee); color: var(--u-ink, #16150f);
  font: 600 11.5px/1 var(--font-jetbrains), monospace; white-space:nowrap; cursor:pointer; min-height:30px; }
.cu-grabar button + button{ border-left:2px solid var(--u-ink, #16150f); }
.cu-grabar button[data-on="true"]{ background: var(--u-lime, #cdf13b); font-weight: 800; }
.cu-grabar button:disabled{ cursor:default; opacity:.6; }
.cu-avance{ background: var(--surface); color: var(--ink); border-radius: 16px; padding: 16px; border: 1.5px solid var(--u-line, var(--border)); }
`;
