'use client';

// =============================================================================
// Armador — UNA tab de la ficha del lead, dibujada como una grilla de bloques
// =============================================================================
// La grilla es la del Dashboard (12 columnas, `COLS_FICHA`), sin alto fijo: el alto lo da el contenido
// (§5 del diseño). Qué se dibuja y con qué ancho lo decide ./armar.ts, puro y con test: lo vacío para este
// lead no deja hueco, y una fila que no se llena se estira.
//
// EDITANDO (sólo el admin, desde «Personalizar»), como una tarjeta del Dashboard en edición: cada bloque con
// su marco y su rótulo; un clic lo elige y le pone su barra (arrastrar, ancho, diseño, ícono, quitar); se
// arrastra para reordenar; y lo de adentro no se toca (`inert`): personalizar no es editar el lead.
//
// LA TAB ÉPICA (16/10/2026): con `epico`, la grilla reparte menos por fila (./armar.ts) y cada bloque recibe
// `epico: true` para dibujarse en grande (./tipos.ts). El aire y el titular los pone ./FichaPorBloques.tsx.
//
// ⚠️ EL ARRASTRE (AGENTS.md, «En HTML5 drag-and-drop, el navegador saca la FOTO al terminar tu handler»):
//    la marca del que se arrastra va en un `setTimeout(0)`, no adentro del `dragstart`, y a su caja no se le
//    toca el tamaño. El `dragover` sólo cambia el estado cuando cambia el destino (no 60 veces por segundo), y
//    el auto-scroll va AHÍ: durante un arrastre nativo el navegador congela los timers y el rAF.
// =============================================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { bloqueDef, casaDelBloque, esTabFicha, FUENTES_RESPUESTA, REDES, type BloqueId, type FuenteRespuesta, type LugarFicha, type Red } from '@/lib/ficha/catalogo';
import { datosDelPuesto, TOPE_TITULO_BLOQUE, type BloquePuesto, type CambioFicha } from '@/lib/ficha/config';
import { tituloDeBloque } from '@/lib/ficha/registro';
// La MISMA lista que ofrece la API de MaKo (cambiar_ficha_funnel, cambio icono): una sola fuente.
import { ICONOS_BLOQUE } from '@/lib/ficha/api';
import { DATOS_AVISABLES, NO_IGNORABLES } from '@/lib/datos-aviso';
import type { StepId } from '@/lib/stage-requirements';
import { anchosDeLaBarra, bloquesDeLaGrilla, datosSinUno, compartiendoFila, cubreDe, disenoADibujar, disenosOfrecidos, lugarAlSoltar, ocurrencia, type BloqueEnGrilla, type DispositivoFicha } from './armar';
import { entradaDe } from './registro';
import { Flotante } from './Flotante';
import type { CtxFicha } from './tipos';
import { NOMBRE_FUENTE, preguntasDelLead } from './resumen/logica';

type Soltar = { indice: number; lado: 'antes' | 'despues' };

/**
 * La ✕ de cada fila del bloque elegido (24/10/2026). El cuerpo del bloque es `inert` personalizando, así que la ✕ no puede
 * vivir adentro de la fila: se mide dónde quedó cada fila marcada (`[data-dato]`) y se dibuja encima, en la caja del bloque.
 * Se vuelve a medir si la caja cambia de tamaño. Con una sola fila no hay ✕: el bloque necesita al menos un dato (para no
 * tenerlo, se quita el bloque).
 */
function QuitarDeLaFila({ onQuitar }: { onQuitar: (dato: string) => void }) {
  const ancla = useRef<HTMLSpanElement>(null);
  const [filas, setFilas] = useState<Array<{ id: string; nombre: string; top: number; left: number }>>([]);
  useLayoutEffect(() => {
    const caja = ancla.current?.parentElement;
    if (!caja) return;
    const medir = () => {
      const r = caja.getBoundingClientRect();
      setFilas([...caja.querySelectorAll<HTMLElement>('[data-dato]')].map((el) => {
        const e = el.getBoundingClientRect();
        return { id: el.dataset.dato ?? '', nombre: el.dataset.datoNombre ?? el.dataset.dato ?? '', top: e.top - r.top + e.height / 2, left: e.right - r.left };
      }).filter((f) => f.id));
    };
    medir();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(medir);
    ro.observe(caja);
    return () => ro.disconnect();
  }, []);
  return (
    <span ref={ancla} aria-hidden={filas.length < 2 || undefined}>
      {filas.length > 1 && filas.map((f) => (
        <button key={f.id} type="button" className="fb-quitar-dato" style={{ top: f.top, left: f.left }}
          title={`Sacar ${f.nombre} del bloque`} aria-label={`Sacar ${f.nombre} del bloque`}
          onClick={(e) => { e.stopPropagation(); onQuitar(f.id); }}>
          <IconoMenu nombre="cerrar" size={12} />
        </button>
      ))}
    </span>
  );
}

export function Armador({ tab, lista, ctx, editando, sel, onSel, onCambio, onAgregar, epico = false, dispositivo = 'escritorio', avisaDe }: {
  /** ¿Ese dato entra en «datos sin marcar» en este funnel? Lo usa «Obligatorio» de la barra del bloque. */
  avisaDe?: (paso: StepId) => boolean;
  /** Una de las cuatro tabs o una hoja propia (17/10/2026). */
  tab: LugarFicha;
  /** La lista ENTERA de la tab (la ficha efectiva del funnel), con lo que no se dibuja. */
  lista: readonly BloquePuesto[];
  ctx: CtxFicha;
  editando: boolean;
  /** El bloque elegido (su índice en `lista`), o null. */
  sel: number | null;
  onSel: (indice: number | null) => void;
  onCambio: (c: CambioFicha) => void;
  /** Abre «Agregar bloque» anclado al botón que lo pidió. */
  onAgregar?: (ancla: HTMLElement) => void;
  /** La tab va épica: menos bloques por fila y cada bloque en grande. */
  epico?: boolean;
  /** La vista por dispositivo de «Personalizar»: sólo decide hacia dónde va la raya de soltar. */
  dispositivo?: DispositivoFicha;
}) {
  const bloques = bloquesDeLaGrilla(lista, {
    reglasDe: (id) => entradaDe(id),
    vacio: (p, r, h) => !!r.estaVacio?.(ctx, p, h),
    editando,
    verPrivado: ctx.verPrivado,
    epico,
  });
  // Los bloques puestos en esta hoja: el que envuelve a otros no repite lo que ya está aparte (PropsBloque.hermanos).
  const hermanos = useMemo(() => lista.map((p) => p.id), [lista]);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const desdeRef = useRef<number | null>(null);
  const [soltar, setSoltar] = useState<Soltar | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);

  // El auto-scroll del arrastre, en el `dragover` del documento y en captura (AGENTS.md): el del bloque no
  // cubre los huecos de la grilla ni lo que está fuera de la tab.
  useEffect(() => {
    if (arrastrando == null) return;
    const sobre = (e: globalThis.DragEvent) => {
      const s = scrollRef.current;
      const caja = s && s !== document.scrollingElement ? s.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const borde = 70;
      if (e.clientY < caja.top + borde) (s ?? window).scrollBy(0, -18);
      else if (e.clientY > caja.bottom - borde) (s ?? window).scrollBy(0, 18);
    };
    document.addEventListener('dragover', sobre, true);
    return () => document.removeEventListener('dragover', sobre, true);
  }, [arrastrando]);

  if (!bloques.length && !editando) return <p className="fb-nada">Sin datos para mostrar.</p>;

  const terminar = () => { desdeRef.current = null; setArrastrando(null); setSoltar(null); };
  const mover = (desde: number, antesDe: number) => {
    const lugar = lugarAlSoltar(desde, antesDe);
    const b = lista[desde];
    if (lugar == null || !b) return;
    onCambio({ op: 'mover', tab, bloque: b.id, n: ocurrencia(lista, desde), lugar });
  };

  const celda = (b: BloqueEnGrilla, i: number) => {
    const entrada = entradaDe(b.def.id)!;
    const { Componente } = entrada;
    // El título que le puso la persona (23/10/2026, «Título» en la barra), o el de siempre.
    const titulo = b.puesto.opciones?.titulo || tituloDeBloque(b.def, ctx.stages);
    const icono: NombreIconoMenu = b.puesto.icono ?? b.def.icono;
    const elegido = editando && sel === b.indice;
    const enFila = compartiendoFila(b, dispositivo);
    const clases = ['fb-bloque',
      editando && 'fb-bloque--editando', elegido && 'fb-bloque--sel', arrastrando === b.indice && 'fb-bloque--arrastrado',
      soltar?.indice === b.indice && `fb-bloque--${soltar.lado}`, soltar?.indice === b.indice && (enFila ? 'fb-bloque--fila' : 'fb-bloque--columna'),
    ].filter(Boolean).join(' ');
    const incluidos = (b.reglas.incluye ?? []).map((id) => bloqueDef(id)?.titulo).filter((t): t is string => !!t);

    const alArrastrar = (e: DragEvent<HTMLDivElement>) => {
      if (!editando) return;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `${b.def.id}:${b.n}`);
      const r = e.currentTarget.getBoundingClientRect();
      e.dataTransfer.setDragImage(e.currentTarget, Math.min(e.clientX - r.left, r.width), Math.min(e.clientY - r.top, 40));
      desdeRef.current = b.indice;
      scrollRef.current = padreQueScrollea(e.currentTarget);
      // La foto ya está tomada cuando corre esto: recién ahí se marca el bloque que se mueve.
      window.setTimeout(() => setArrastrando(b.indice), 0);
    };
    const alPasar = (e: DragEvent<HTMLDivElement>) => {
      if (desdeRef.current == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = e.currentTarget.getBoundingClientRect();
      const lado: Soltar['lado'] = enFila ? (e.clientX < r.left + r.width / 2 ? 'antes' : 'despues') : (e.clientY < r.top + r.height / 2 ? 'antes' : 'despues');
      setSoltar((s) => (s && s.indice === b.indice && s.lado === lado ? s : { indice: b.indice, lado }));
    };
    const alSoltar = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const desde = desdeRef.current;
      const s = soltar;
      terminar();
      if (desde == null || !s) return;
      mover(desde, s.lado === 'antes' ? s.indice : s.indice + 1);
    };
    // El teclado en el tirador: una flecha lo pasa por encima del bloque dibujado de al lado.
    const conTeclado = (dir: -1 | 1) => {
      const vecino = bloques[i + dir];
      if (!vecino) return;
      mover(b.indice, dir < 0 ? vecino.indice : vecino.indice + 1);
    };

    return (
      // ⚠️ EL ANCHO VA EN VARIABLES, NO EN `gridColumn`: un estilo en línea le gana a todo @media, y la tablet
      // y el celular cortan las columnas por CSS (./ficha-css.ts, con los anchos de `spansPorDispositivo`).
      <div key={`${b.def.id}:${b.n}`} className={clases} style={{ '--fb-span': b.span, '--fb-span-t': b.spanTableta } as CSSProperties}
        data-recorrido={editando && i === 0 ? 'fb-bloque' : undefined}
        draggable={editando || undefined}
        onDragStart={editando ? alArrastrar : undefined}
        onDragOver={editando ? alPasar : undefined}
        onDrop={editando ? alSoltar : undefined}
        onDragEnd={editando ? terminar : undefined}
        onClick={editando ? (e) => { e.stopPropagation(); onSel(b.indice); } : undefined}>
        {editando && <div className="fb-marco" aria-hidden />}
        {/* ⚠️ EL ELEGIDO LLEVA SU NOMBRE ADENTRO DE SU BARRA, en el lugar del rótulo: la barra tapaba el rótulo
            en todo bloque que no fuera de ancho completo (medido en el banco el 16/10/2026: a ½ y ⅓ en el pop-up,
            y en la tablet, no se veía qué bloque estaba elegido). */}
        {editando && !elegido && (
          <span className="fb-rotulo" title={incluidos.length ? `Incluye: ${incluidos.join(', ')}` : undefined}>
            <IconoMenu nombre={icono} size={13} /> {titulo}
          </span>
        )}
        {/* ⚠️ «QUE SE PUEDA EDITAR CADA COSA» (24/10/2026). Martín: «en el bloque de "Contacto" no puedo sacar EMPRESA, y en
            general debes revisas que todo sea editable». «Datos ▾» ya lo hacía desde la barra y no se encontraba: el cuerpo
            del bloque es `inert` acá, y la persona busca sacar la fila desde la fila. Con el bloque elegido, cada fila
            marcada (`data-dato`) lleva su ✕ al lado, la MISMA operación que «Datos ▾» (o «Opciones ▾» en las redes). */}
        {elegido && (b.def.datos || b.def.opciones?.includes('redes')) && (
          <QuitarDeLaFila onQuitar={(dato) => {
            const redes = !b.def.datos;
            const quedan = datosSinUno(redes ? (b.puesto.opciones?.redes ?? REDES) : datosDelPuesto(b.def, b.puesto.opciones), dato);
            if (!quedan) return;
            onCambio({ op: 'opciones', tab, bloque: b.def.id, n: b.n, opciones: redes ? { redes: quedan as Red[] } : { datos: quedan } });
          }} />
        )}
        {elegido && (
          <BarraBloque tab={tab} b={b} icono={icono} titulo={titulo} tituloDeSiempre={tituloDeBloque(b.def, ctx.stages)} incluidos={incluidos} onCambio={onCambio} avisaDe={avisaDe} hermanos={hermanos}
            onQuitar={() => onSel(null)} onMoverTeclado={conTeclado}
            preguntas={b.def.opciones?.includes('pregunta') ? preguntasDelLead(ctx.data) : []} />
        )}
        {/* ⚠️ `inert` EDITANDO: personalizar la ficha no es editar el lead. Sin esto, un clic para elegir el
            bloque abría el campo de adentro (la tarjeta entera abre su edición, `CajaCampo`). */}
        <div className="fb-cuerpo" inert={editando || undefined}>
          {b.vacio
            ? <div className="fb-vacio">Sin datos en este lead</div>
            // En una hoja propia, cada bloque se dibuja como en su tab de siempre (`casaDelBloque`): PropsBloque.tab es eso.
            : <Componente ctx={ctx} puesto={b.puesto} def={b.def} tab={esTabFicha(tab) ? tab : casaDelBloque(b.def) ?? 'resumen'} titulo={titulo} diseno={disenoADibujar(b.puesto, b.def, b.reglas)} ancho={b.puesto.ancho} icono={icono} hermanos={hermanos} editando={editando} epico={epico} />}
        </div>
      </div>
    );
  };

  return (
    <div className="fb-grilla" onClick={editando ? () => onSel(null) : undefined}
      onDragOver={editando ? (e) => { if (desdeRef.current != null) e.preventDefault(); } : undefined}>
      {bloques.map(celda)}
      {editando && onAgregar && (
        <button type="button" className="fb-agregar-celda" onClick={(e) => { e.stopPropagation(); onAgregar(e.currentTarget); }}>
          <IconoMenu nombre="agregar" size={16} /> Agregar bloque
        </button>
      )}
    </div>
  );
}

/** El ancestro que scrollea (el cuerpo del pop-up), o el documento (la ruta). */
function padreQueScrollea(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

type TipoMenu = 'diseno' | 'icono' | 'opciones' | 'datos' | 'obligatorio' | 'titulo';
type Menu = { tipo: TipoMenu; ancla: HTMLElement } | null;

/** El nombre de un «dato sin marcar» en el menú «Obligatorio» (el de la lista de avisos). */
const nombreDelDato = (p: StepId): string => DATOS_AVISABLES.find((x) => x.id === p)?.label ?? p;

/** Cómo se llama cada red en el menú de opciones. */
const NOMBRE_RED: Readonly<Record<Red, string>> = { web: 'Web', instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn' };

/**
 * La barra del bloque elegido: su nombre (en el lugar del rótulo), arrastrar, ancho, diseño, opciones, ícono y quitar.
 * OPCIONES (16/10/2026): lo que el bloque declara configurar adentro (`def.opciones`): qué redes van en «Redes y web»,
 * qué fuentes en «Lo que contestó» y qué pregunta en «Respuesta destacada» (de las que contestó ESTE lead).
 */
function BarraBloque({ tab, b, icono, titulo, tituloDeSiempre, incluidos, onCambio, onQuitar, onMoverTeclado, preguntas, avisaDe, hermanos }: {
  /** El título sin el que le puso la persona: el del catálogo, o el nombre de la etapa en la R1 y la R2. */
  tituloDeSiempre: string;
  avisaDe?: (paso: StepId) => boolean;
  /** Los bloques de la misma hoja: lo que la hoja puso aparte no cuenta como de este bloque (`cubreDe`). */
  hermanos?: readonly string[];
  tab: LugarFicha;
  b: BloqueEnGrilla;
  icono: NombreIconoMenu;
  titulo: string;
  incluidos: string[];
  onCambio: (c: CambioFicha) => void;
  onQuitar: () => void;
  onMoverTeclado: (dir: -1 | 1) => void;
  /** Las preguntas que contestó este lead (para «Respuesta destacada»). */
  preguntas: readonly string[];
}) {
  const [menu, setMenu] = useState<Menu>(null);
  const op = b.def.opciones ?? [];
  // «Opciones ▾» es para las redes, las fuentes y la pregunta. Los DATOS tienen su menú («Datos ▾»): un bloque que sólo
  // elige datos (el contacto, el setter y el closer) no lleva «Opciones», que abría vacío (visto en producción, 24/10/2026).
  const conOpciones = op.some((x) => x === 'redes' || x === 'fuentes' || x === 'pregunta');
  const redes: readonly Red[] = b.puesto.opciones?.redes ?? REDES;
  const fuentes: readonly FuenteRespuesta[] = b.puesto.opciones?.fuentes ?? FUENTES_RESPUESTA;
  const pregunta = b.puesto.opciones?.pregunta ?? null;
  const opciones = (o: { redes?: Red[]; fuentes?: FuenteRespuesta[]; pregunta?: string; datos?: string[]; titulo?: string }) => onCambio({ op: 'opciones', tab, bloque: id, n: b.n, opciones: o });
  /** Prende o apaga el aviso de UN dato en este funnel. */
  const pedir = (p: StepId, avisa: boolean) => onCambio({ op: 'aviso', paso: p, avisa });
  /** Prender o apagar uno de una lista, sin perder el orden de siempre. */
  const alternar = <T extends string>(todos: readonly T[], hoy: readonly T[], x: T): T[] => todos.filter((t) => (t === x ? !hoy.includes(x) : hoy.includes(t)));
  const disenos = disenosOfrecidos(b.def, b.reglas);
  const diseno = disenoADibujar(b.puesto, b.def, b.reglas);
  const id: BloqueId = b.def.id;
  const quitable = b.def.quitable || b.def.tab !== tab;
  // «OBLIGATORIO» (16/10/2026, Martín: «si hoy en día clickeo en cada bloque ahí debería haber una opción de
  // "Obligatorio" y que eso sea lo que hace ese dato que ingrese a "datos sin marcar"»). Es el mismo aviso por funnel que
  // los interruptores de la barra lateral (`op: 'aviso'`).
  // ⚠️ DATO POR DATO desde el 23/10/2026. Hasta ahí un toque prendía o apagaba TODOS los datos del bloque juntos, y la
  //    empresa era obligatoria por venir con el teléfono. Martín: «me obligas a hacer obligatorio un dato que no quería
  //    que lo fuera». Un bloque con un solo dato sigue con su botón; con varios, «Obligatorio ▾» los lista uno por uno; y
  //    uno que elige sus datos (el contacto, el setter y el closer) los junta en «Datos ▾»: qué va adentro y qué se pide.
  //    La asistencia de una reunión pasada avisa siempre: se ve, apagada, para que se entienda por qué no se toca.
  const cubreTodo = avisaDe ? cubreDe(b.def, b.reglas, { puesto: b.puesto, hermanos }) : [];
  const cubre = cubreTodo.filter((p) => !NO_IGNORABLES.has(p));
  const siempre = cubreTodo.filter((p) => NO_IGNORABLES.has(p));
  const datos = b.def.datos;
  const adentro = datos ? datosDelPuesto(b.def, b.puesto.opciones) : [];
  const unSolo = !datos && cubre.length === 1 ? cubre[0] : null;
  const abrir = (tipo: TipoMenu) => (e: { currentTarget: HTMLElement }) => {
    const ancla = e.currentTarget;
    setMenu((m) => (m?.tipo === tipo ? null : { tipo, ancla }));
  };
  const sep: ReactNode = <span className="fb-sep" aria-hidden />;
  return (
    <div className="fb-barra-bloque" role="toolbar" aria-label={`Bloque ${b.def.titulo}`} onClick={(e) => e.stopPropagation()}>
      <span className="fb-barra-nombre" title={incluidos.length ? `${titulo}. Incluye: ${incluidos.join(', ')}` : titulo}>
        <IconoMenu nombre={icono} size={13} /> <span className="fb-barra-nombre-txt">{titulo}</span>
      </span>
      {sep}
      <button type="button" className="fb-herr fb-herr--mover" title="Arrastra para mover" aria-label="Mover (flechas)"
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); onMoverTeclado(-1); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); onMoverTeclado(1); }
        }}>
        <IconoMenu nombre="mover" size={15} />
      </button>
      {sep}
      {anchosDeLaBarra(b.def).map((a) => (
        <button key={a.id} type="button" className="fb-herr" aria-pressed={b.puesto.ancho === a.id} disabled={!a.puede}
          title={a.puede ? `Ancho ${a.nombre.toLowerCase()}` : 'Este bloque no va de ese ancho'}
          onClick={() => { if (b.puesto.ancho !== a.id) onCambio({ op: 'ancho', tab, bloque: id, n: b.n, ancho: a.id }); }}>
          {a.id === 12 ? 'Todo' : a.nombre}
        </button>
      ))}
      {disenos.length > 0 && (
        <>
          {sep}
          <button type="button" className="fb-herr" aria-haspopup="menu" aria-expanded={menu?.tipo === 'diseno'} onClick={abrir('diseno')}>
            Diseño <span aria-hidden>▾</span>
          </button>
        </>
      )}
      {conOpciones && (
        <>
          {sep}
          <button type="button" className="fb-herr" aria-haspopup="menu" aria-expanded={menu?.tipo === 'opciones'} onClick={abrir('opciones')}>
            Opciones <span aria-hidden>▾</span>
          </button>
        </>
      )}
      {datos && (
        <>
          {sep}
          <button type="button" className="fb-herr" aria-haspopup="menu" aria-expanded={menu?.tipo === 'datos'} onClick={abrir('datos')}>
            Datos <span aria-hidden>▾</span>
          </button>
        </>
      )}
      {unSolo && (
        <>
          {sep}
          <button type="button" className="fb-herr" aria-pressed={avisaDe!(unSolo)}
            title={avisaDe!(unSolo) ? 'Si falta, entra en «datos sin marcar». Toca para que no avise.' : 'Toca para que, si falta, entre en «datos sin marcar».'}
            onClick={() => pedir(unSolo, !avisaDe!(unSolo))}>
            {avisaDe!(unSolo) ? '✓ ' : ''}Obligatorio
          </button>
        </>
      )}
      {!datos && cubre.length > 1 && (
        <>
          {sep}
          <button type="button" className="fb-herr" aria-haspopup="menu" aria-expanded={menu?.tipo === 'obligatorio'} onClick={abrir('obligatorio')}>
            Obligatorio <span aria-hidden>▾</span>
          </button>
        </>
      )}
      {sep}
      <button type="button" className="fb-herr" aria-haspopup="dialog" aria-expanded={menu?.tipo === 'titulo'} onClick={abrir('titulo')}>
        Título
      </button>
      {sep}
      <button type="button" className="fb-herr" title="Ícono" aria-label="Ícono" aria-haspopup="menu" aria-expanded={menu?.tipo === 'icono'} onClick={abrir('icono')}>
        <IconoMenu nombre={icono} size={15} />
      </button>
      {sep}
      <BotonBorrar talla="sm" title={quitable ? `Quitar ${b.def.titulo}` : `${b.def.titulo} no se puede quitar`} disabled={!quitable}
        onClick={() => { onQuitar(); onCambio({ op: 'quitar', tab, bloque: id, n: b.n }); }} />

      {menu?.tipo === 'diseno' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={240} etiqueta="Diseño del bloque">
          <div role="menu">
            {disenos.map((d) => (
              <button key={d.id} type="button" role="menuitemradio" aria-checked={d.id === diseno} className="fb-opcion"
                onClick={() => { setMenu(null); if (d.id !== diseno) onCambio({ op: 'diseno', tab, bloque: id, n: b.n, diseno: d.id }); }}>
                {d.nombre}
              </button>
            ))}
          </div>
        </Flotante>
      )}
      {menu?.tipo === 'opciones' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={260} etiqueta="Opciones del bloque">
          <div role="menu">
            {op.includes('redes') && REDES.map((r) => (
              <button key={r} type="button" role="menuitemcheckbox" aria-checked={redes.includes(r)} className="fb-opcion"
                onClick={() => opciones({ redes: alternar(REDES, redes, r) })}>
                <span aria-hidden>{redes.includes(r) ? '✓' : ''}</span> {NOMBRE_RED[r]}
              </button>
            ))}
            {op.includes('fuentes') && FUENTES_RESPUESTA.map((f) => (
              <button key={f} type="button" role="menuitemcheckbox" aria-checked={fuentes.includes(f)} className="fb-opcion"
                onClick={() => opciones({ fuentes: alternar(FUENTES_RESPUESTA, fuentes, f) })}>
                <span aria-hidden>{fuentes.includes(f) ? '✓' : ''}</span> {NOMBRE_FUENTE[f]}
              </button>
            ))}
            {op.includes('pregunta') && (preguntas.length || pregunta ? (
              [...(pregunta && !preguntas.includes(pregunta) ? [pregunta] : []), ...preguntas].map((q) => (
                <button key={q} type="button" role="menuitemradio" aria-checked={q === pregunta} className="fb-opcion"
                  onClick={() => { setMenu(null); if (q !== pregunta) opciones({ pregunta: q }); }}>
                  {q}
                </button>
              ))
            ) : <div className="fb-vacio-menu">Este lead no contestó nada. Elige la pregunta en uno que sí.</div>)}
          </div>
        </Flotante>
      )}
      {menu?.tipo === 'datos' && datos && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={300} etiqueta="Datos del bloque">
          <div role="menu">
            {datos.todos.map((t) => {
              const va = adentro.includes(t.id);
              const ultimo = va && adentro.length === 1;
              const ob = t.aviso && avisaDe && !NO_IGNORABLES.has(t.aviso) ? avisaDe(t.aviso) : null;
              return (
                <div key={t.id} className="fb-dato">
                  <button type="button" role="menuitemcheckbox" aria-checked={va} className="fb-opcion" disabled={ultimo}
                    title={ultimo ? 'El bloque necesita al menos un dato. Si no lo quieres, quita el bloque.' : undefined}
                    onClick={() => opciones({ datos: alternar(datos.todos.map((x) => x.id), adentro, t.id) })}>
                    <span aria-hidden>{va ? '✓' : ''}</span> {t.nombre}
                  </button>
                  {ob !== null && (
                    <button type="button" className="fb-herr fb-dato-ob" aria-pressed={ob} disabled={!va}
                      title={!va ? 'Ponlo en el bloque para poder pedirlo.' : ob ? 'Si falta, entra en «datos sin marcar». Toca para que no avise.' : 'Toca para que, si falta, entre en «datos sin marcar».'}
                      onClick={() => pedir(t.aviso!, !ob)}>
                      {ob ? '✓ ' : ''}Obligatorio
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Flotante>
      )}
      {menu?.tipo === 'obligatorio' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={300} etiqueta="Qué es obligatorio en este bloque">
          <div role="menu">
            {cubre.map((p) => (
              <button key={p} type="button" role="menuitemcheckbox" aria-checked={avisaDe!(p)} className="fb-opcion"
                onClick={() => pedir(p, !avisaDe!(p))}>
                <span aria-hidden>{avisaDe!(p) ? '✓' : ''}</span> {nombreDelDato(p)}
              </button>
            ))}
            {siempre.map((p) => (
              <button key={p} type="button" role="menuitemcheckbox" aria-checked className="fb-opcion" disabled
                title="La asistencia a una reunión que ya pasó siempre se pide.">
                <span aria-hidden>✓</span> {nombreDelDato(p)} <span className="fb-opcion-linea">Siempre</span>
              </button>
            ))}
          </div>
        </Flotante>
      )}
      {menu?.tipo === 'titulo' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={300} etiqueta="Título del bloque">
          <TituloDelBloque actual={b.puesto.opciones?.titulo ?? ''} deSiempre={tituloDeSiempre}
            onGuardar={(t) => { setMenu(null); if (t !== (b.puesto.opciones?.titulo ?? '')) opciones({ titulo: t }); }} />
        </Flotante>
      )}
      {menu?.tipo === 'icono' && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} ancho={300} etiqueta="Ícono del bloque">
          <button type="button" className="fb-opcion" aria-checked={!b.puesto.icono} role="menuitemradio"
            onClick={() => { setMenu(null); if (b.puesto.icono) onCambio({ op: 'icono', tab, bloque: id, n: b.n, icono: null }); }}>
            <IconoMenu nombre={b.def.icono} size={16} /> El de siempre
          </button>
          <div className="fb-iconos" role="menu">
            {ICONOS_BLOQUE.map((n) => (
              <button key={n} type="button" role="menuitemradio" aria-checked={n === icono} className="fb-herr" title={n} aria-label={n}
                onClick={() => { setMenu(null); if (n !== icono) onCambio({ op: 'icono', tab, bloque: id, n: b.n, icono: n === b.def.icono ? null : n }); }}>
                <IconoMenu nombre={n} size={16} />
              </button>
            ))}
          </div>
        </Flotante>
      )}
    </div>
  );
}

/** El título del bloque: se escribe y Enter lo guarda; «El de siempre» lo devuelve (23/10/2026). */
function TituloDelBloque({ actual, deSiempre, onGuardar }: { actual: string; deSiempre: string; onGuardar: (t: string) => void }) {
  const [v, setV] = useState(actual || deSiempre);
  const guardar = () => onGuardar(v.trim() === deSiempre ? '' : v.trim());
  return (
    <form className="fb-titulo" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
      <input className="fb-titulo-input" value={v} maxLength={TOPE_TITULO_BLOQUE} autoFocus aria-label="Título del bloque"
        onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onGuardar(actual); }} />
      <div className="fb-titulo-acciones">
        {actual && <button type="button" className="fb-herr" onClick={() => onGuardar('')}>El de siempre</button>}
        <button type="submit" className="fb-herr" aria-pressed="true">Guardar</button>
      </div>
    </form>
  );
}
