'use client';

// =============================================================================
// LeccionEditable — la lección de la tab Curso, que se edita EN SU LUGAR y se GUARDA A MANO
// =============================================================================
// Pedido de Martín (07/10/2026), items 13 a 17, textual:
//   «13. Elimina la sección de "Notas" en todos lados.
//    14. Dentro de una clase, no deberían haber tabs de "Tarea" y "Descripción", por defecto ambas
//        juntas siempre, y primero siempre la descripción.
//    15. Elimina el botón de "grabar/no grabar".
//    16. Elimina el botón de "Editar", para eso ya se edita en cada parte... Si quiero editar el
//        título, le doy click, como la descripción... Si quiero agregar un vídeo, al igual que al
//        agregar una nueva clase, debe siempre estar un placeholder donde iría el vídeo para la opción
//        de "Agregar vídeo"... Lo mismo con el botón de "Agregar tarea" ahí mismo abajo de la
//        descripción, como placeholder.
//    17. Se debería poder adjuntar cosas a la descripción... Imágenes, PDF, archivos, etc.»
// Decisiones: docs/diseno-curso-skool.md, D4. Los ajustes del 08/10/2026 (items 9, 11, 12, 13, 18): el
// video sólo por link, los minutos solos, la disposición adentro del papel, el «Deshacer».
//
// Y el AUDIO del 08/10/2026 (docs/feedback-curso-08oct.md), los items de esta pieza:
//   · 1 (14:30): «prefiero que haya un botón que me obligue a guardar de forma manual frente a que
//     simplemente cambie y que se guarde solo, porque siento que esto puede llegar a traer bugs».
//     Martín: «lo más fácil es un botón de guardar y que diga guardando».
//   · 2 (15:30): «volví para atrás y se me borraron todos los campos de edición… un enmarcado rojo y que
//     diga falta completar la pregunta».
//   · 3 (15:40): «que no te permita entrar a la vista del alumno hasta que se actualice todo».
//   · 4 (20:50): «estaría bueno que cuando aprieto control Z me deje deshacer».
//   · 7 (13:00): «Obligatoria para avanzar» sale de la tarea (va al menú «…» de la clase, ./MenuCurso.tsx).
//   · 18 (10:40): «está tardando mucho en cargar una clase» (el editor rico baja a demanda:
//     ./editor-rico-perezoso.tsx).
//
// ⚠️ LA LECCIÓN NO SE GUARDA SOLA. Lo que se edita adentro de una clase (título, video, descripción,
//    disposición, consigna, campos, «Una respuesta por área») vive en un BORRADOR (`useLeccionAbierta`,
//    que monta la tab) hasta «Guardar», que lo escribe de una vez (`guardarLeccionAction`). Lo único que
//    se sigue escribiendo solo son los minutos que dice el reproductor del video YA guardado: es un dato
//    del video, no una edición. Y lo que sube el editor rico (un adjunto) sube en el acto, como antes: lo
//    que no quede nombrado en lo guardado lo barre la purga.
// ⚠️ SALIR CON CAMBIOS PREGUNTA (Guardar / Descartar / Seguir editando): volver al índice, cambiar de
//    clase, cambiar de curso, la vista del alumno y cualquier link de la app. Cerrar la pestaña lo pregunta
//    el navegador (`beforeunload`). La pregunta la dibuja la tab, afuera del curso (`dialogo`): adentro,
//    la hoja del curso le saca el fondo y el borde a los botones de un diálogo.
// ⚠️ EL CTRL+Z ES DEL BORRADOR (`usePilaDeshacer`, app/_ui), UNA ENTRADA POR GESTO (`gestoDe`): escribir
//    un párrafo es un paso, no cuarenta. Con el foco en un texto gana el Ctrl+Z del texto (el del editor
//    rico deshace su propia escritura). Ctrl+Shift+Z y Ctrl+Y rehacen.
// ⚠️ NADA DE MODALES PROPIOS ACÁ ADENTRO: la hoja del curso deja sin fondo ni borde a todo `button` de
//    `.ahdoc`, y un `Modal` de la app no se portalea. Las confirmaciones y el aviso de «Deshacer» los
//    dibuja la tab, afuera del curso (`ctx.confirmar`, `ctx.deshacer`, `LeccionAbierta.dialogo`).
// ⚠️ TEXTO DE PANTALLA CORTO y en voz neutra (lo arma el equipo, pero el guard de voseo mira todo).

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode,
} from 'react';
import type { Clase } from '@/lib/curso';
import { htmlsDeTareas, reproductorDeClase, tieneTarea } from '@/lib/curso';
import type { LeccionUgc } from '@/app/_cursos/tipos';
import { Button, Modal } from '@/app/_ui';
import { usePilaDeshacer, type PilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import { useRouter } from '@/app/_ui/Link';
import { HtmlSeguro } from '@/app/_ui/HtmlSeguro';
import { ACEPTA_ADJUNTO, ACEPTA_IMAGEN_ADJUNTO, crearSubidorDeAdjuntos } from '@/lib/curso-adjuntos-reglas';
import { navegar, usePosicion, type Posicion } from '@/app/conocimientos/posicion';
import Reproductor from '@/app/compartido/curso/[token]/Reproductor';
import TareaAlumno from '@/app/compartido/curso/[token]/TareaAlumno';
import { VistaPreviaCtx } from '@/app/compartido/curso/[token]/vista-previa';
import { urlVerVideoAction } from './actions';
import { urlSubidaAdjuntoAction, registrarAdjuntoAction } from './adjuntos-actions';
import { precargarUrlsDeAdjuntos, useUrlsDeAdjuntos } from './urls-adjuntos';
import { guardarCampoClaseAction, guardarLeccionAction } from './modulos-actions';
import { subirConProgreso } from './subir-video';
import { TareaEditor } from './TareaEditor';
import { EditorRicoPerezoso } from './editor-rico-perezoso';
import { videoDeClase } from './reglas';
import { useCerrarEstable } from './dialogo-foco';
import {
  claseDelBorrador, claveDeVideo, borradorDe, cambiosParaGuardar, erroresDelBorrador, esGestoNuevo, gestoDe, linkDeVideo,
  lugarDelVideo, minutosDeDuracion, oembedDeLoom, ofrecePorArea, partesCambiadas, rebasar, textoDeBarra,
  type BorradorLeccion, type DisposicionBorrador, type EstadoBarra, type LugarDelVideo, type VideoDelBorrador,
} from './leccion-reglas';

/**
 * Lo que la lección necesita de la tab. Se arma en cada render: las piezas lo leen por un ref
 * (`useUltimo`), así una respuesta que llega tarde usa el de ahora y no el de cuando se pidió.
 */
export type CtxLeccion = {
  productoId: number;
  /** Un admin del workspace (lib/workspace.ts): edita. El resto del equipo mira. */
  puedeEditar: boolean;
  /** ¿El módulo de la clase es una etapa del kanban? El chip «Obligatoria» sólo ahí. */
  vinculado: boolean;
  /** Cuántos clientes ya tienen avance en la clase. */
  conAvance: number;
  /**
   * ¿El curso les pide a sus clientes sus ÁREAS (alguna clase del producto tiene el campo de áreas)? Sin
   * eso, «Una respuesta por área» no se ofrece (`ofrecePorArea`): no cambiaría nada.
   */
  cursoPideAreas?: boolean;
  /** La clase como quedó en el server, para que la tab la tenga (las tarjetas, la vista del alumno). */
  onClase: (c: Clase) => void;
  /** Un aviso corto de algo que no salió (el toast de la tab). */
  avisar: (texto: string) => void;
  /** Una pregunta antes de algo que no se deshace. La dibuja la tab, afuera del curso (ver la cabecera). */
  confirmar: (mensaje: string, o: { titulo: string; boton: string }) => Promise<boolean>;
  /**
   * El aviso de 5 segundos con «Deshacer» (item 18): el Toast de la tab, afuera del curso. Sin esto no se
   * ofrece (un «Deshacer» que no deshace nada es peor que no ofrecerlo).
   */
  deshacer?: (texto: string, onDeshacer: () => void) => void;
  /**
   * La lección ABIERTA con su borrador (`useLeccionAbierta`). Sin esto —o si es de otra clase— la lección
   * se dibuja como está guardada y no se edita.
   */
  leccion?: LeccionAbierta | null;
};

/**
 * La lección de una clase para la tab Curso. Se llama en cada render (CursoUgc, `leccion`): no usa
 * hooks, arma las piezas que sí los usan. Lo que dibuja es el BORRADOR (`claseDelBorrador`), así que lo
 * que se edita se ve en el acto aunque no se haya guardado.
 */
export function leccionDelEditor(c: Clase, ctx: CtxLeccion): LeccionUgc {
  const l = ctx.puedeEditar && ctx.leccion?.claseId === c.id && ctx.leccion.borrador ? ctx.leccion : null;
  const vista = l ? claseDelBorrador(c, l.borrador!) : c;
  const lugar = lugarDelVideo(vista);
  return {
    video: lugar === 'marco'
      ? { cuerpo: <VideoDeClase clase={vista} guardada={c} ctx={ctx} l={l} />, barra: l ? <ControlesDelVideo key={claveDeVideo(vista)} c={vista} l={l} ctx={ctx} /> : undefined }
      : undefined,
    sinVideo: lugar === 'vacio' && l ? <AgregarVideo l={l} /> : undefined,
    debajoDelVideo: hayFicha(vista, c, ctx, lugar, l) ? <FichaDeLaClase c={vista} guardada={c} ctx={ctx} l={l} lugar={lugar} /> : undefined,
    // Como función: el dibujo le pasa el interruptor de la disposición, que va ADENTRO del papel (item 13).
    papel: (arriba) => <PapelDelEditor c={c} vista={vista} ctx={ctx} l={l} arriba={arriba} />,
    // La barra de «Guardar», pegada abajo de la lección (item 1). Sólo de quien edita.
    despues: l ? <BarraDeLeccion l={l} /> : undefined,
  };
}

/** Lo último de un valor que cambia en cada render, para lo que corre después (una respuesta, un timer). */
function useUltimo<T>(v: T) {
  const r = useRef(v);
  useEffect(() => { r.current = v; });
  return r;
}

// =============================================================================
// La lección ABIERTA: el borrador, el guardado, la salida y el Ctrl+Z
// =============================================================================

/** Lo que la tab y las piezas de la lección leen del borrador. */
export type LeccionAbierta = {
  /** La clase del borrador, o `null` si no hay ninguna abierta. */
  claseId: number | null;
  borrador: BorradorLeccion | null;
  /** ¿Hay algo sin guardar? Lo que hace preguntar al salir. */
  sucio: boolean;
  estado: EstadoBarra;
  /** Lo que se pinta en rojo: vacío hasta el primer «Guardar» que no pudo (item 2). */
  errores: Record<string, string>;
  /** Un cambio del borrador. Pasa por acá TODO cambio de la lección: es el choke point de la pila. */
  cambiar: (parche: Partial<BorradorLeccion>) => void;
  guardar: () => Promise<boolean>;
  descartar: () => void;
  /** Si hay cambios, pregunta antes de `seguir` (Guardar / Descartar / Seguir editando); si no, sigue. */
  pedirSalida: (seguir: () => void, o?: { guardar?: string }) => void;
  /** La clase dejó de existir (se borró): el borrador se suelta sin preguntar. */
  soltar: (claseId: number) => void;
  /** La pregunta de salir. La monta la tab AFUERA del curso. */
  dialogo: ReactNode;
  /** Los minutos que midió el reproductor, por video (`claveDeVideo`): los de un video nuevo van al guardar. */
  medidos: MutableRefObject<Map<string, number>>;
  /** La pila de deshacer de la barra (la monta `BarraDeLeccion`, que vive y muere con la lección). */
  pila: MutableRefObject<PilaDeshacer<BorradorLeccion> | null>;
  /** El estado al que vuelve un Ctrl+Z: lo pone y devuelve el que estaba (el contrato de `usePilaDeshacer`). */
  aplicarDeshacer: (b: BorradorLeccion) => BorradorLeccion;
};

type Estado = {
  claseId: number;
  /** La clase de la que sale la base: si la tab trae otra (otro objeto), se rebasa. */
  claseBase: Clase;
  base: BorradorLeccion;
  borrador: BorradorLeccion;
  estado: EstadoBarra;
  /** ¿Ya se intentó guardar con algo incompleto? Recién ahí se pinta en rojo (no mientras se escribe). */
  intento: boolean;
  /** Lo que rechazó el server, por parte: se ve hasta el próximo cambio. */
  erroresServer: Record<string, string>;
};

const esSucio = (l: Estado | null): boolean => !!l && partesCambiadas(l.base, l.borrador).length > 0;

/**
 * Lleva la vista al primer error marcado (item 2): un campo en rojo (lo marca ./TareaEditor.tsx con
 * `.ec-campo--error`, o cualquier `--error`, `data-error`, `aria-invalid`) o, si no hay, el título.
 */
function scrollAlPrimerError() {
  requestAnimationFrame(() => {
    const el = document.querySelector('.cu-papel .ec-campo--error, .cu-papel [class*="--error"], .cu-papel [data-error], .cu-papel [aria-invalid="true"]')
      ?? document.querySelector('[data-recorrido="leccion-titulo"]');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

/**
 * El BORRADOR de la clase abierta, para la tab (./CursoApp.tsx: «el estado de la lección abierta»). Vive
 * en la tab y no en la lección porque las piezas de la lección (el video, el papel, la barra) se dibujan
 * en lugares distintos del curso, y porque al salir la lección se desmonta antes de que se pueda preguntar.
 *
 * ⚠️ LA SALIDA SE ATAJA DESPUÉS DE QUE PASÓ: la URL del curso (el hash) la escribe el dibujo
 *    (app/_cursos/CursoUgc.tsx, `usePosicion`), y también el Atrás del navegador. Si la clase cambió con el
 *    borrador sucio, un `useLayoutEffect` VUELVE a la clase antes de que se pinte nada y pregunta; con la
 *    respuesta, sigue a donde iba. Volver y seguir van con `reemplazar`: así el historial queda como si se
 *    hubiera ido derecho (con el Atrás, también).
 * ⚠️ UN LINK QUE SACA DE LA PÁGINA (la vista del alumno, el menú de la app) se ataja ANTES, en captura en
 *    `document`: un link de Next navega del lado del cliente y no pasa por `beforeunload`.
 */
export function useLeccionAbierta(o: {
  /** Las clases del curso, como las tiene la tab (lo que contesta cada action pisa lo de acá). */
  clases: readonly Clase[];
  /** La clase abierta (la de la URL, si es de este curso), o `null`. */
  abierta: number | null;
  /** Dónde va el texto, como está GUARDADO en el curso. */
  disposicion: DisposicionBorrador;
  puedeEditar: boolean;
  /** Guarda la disposición (un ajuste del curso): devuelve si quedó. */
  guardarDisposicion: (d: DisposicionBorrador) => Promise<boolean>;
  onClase: (c: Clase) => void;
  avisar: (t: string) => void;
}): LeccionAbierta {
  const [lec, setLec] = useState<Estado | null>(null);
  const lecRef = useRef<Estado | null>(lec);
  const poner = useCallback((x: Estado | null) => { lecRef.current = x; setLec(x); }, []);
  const oRef = useUltimo(o);
  const medidos = useRef(new Map<string, number>());
  const pila = useRef<PilaDeshacer<BorradorLeccion> | null>(null);
  const ultimoGesto = useRef<{ clave: string; en: number } | null>(null);
  const enVuelo = useRef(false);
  // ⚠️ SIN UNA BANDERA DE «SALIDA PERMITIDA»: la guarda de abajo pregunta SÓLO con el borrador sucio, y
  //    cada respuesta lo deja limpio antes de seguir (Descartar lo vuelve a la base, Guardar lo guarda).
  //    Una bandera que se prende y no se apaga (un `seguir` que no mueve el hash) dejaba pasar sin
  //    preguntar la PRÓXIMA salida, minutos después, con cambios nuevos.
  /** Dónde estaba la lección (el módulo y la búsqueda de la que se entró), para volver exacto. */
  const posDelBorrador = useRef<Posicion | null>(null);
  /** Cuántas entradas tenía el historial ahí: si al salir creció, la salida EMPUJÓ una (no fue el Atrás). */
  const largoHistorial = useRef(0);
  const [pregunta, setPregunta] = useState<{ seguir: () => void; guardar: string; guardando: boolean; empujo?: boolean } | null>(null);
  const { pos } = usePosicion();
  const router = useRouter();

  // ── El borrador sigue a la clase abierta (en el render: sin un cuadro con la lección sin borrador) ──
  const clase = o.abierta != null ? o.clases.find((c) => c.id === o.abierta) ?? null : null;
  let actual = lec;
  if (!o.puedeEditar) {
    if (actual) actual = null;
  } else if (actual && !o.clases.some((c) => c.id === actual!.claseId)) {
    // La clase ya no está (se borró): no hay a qué volver ni dónde guardar.
    actual = null;
  } else if (actual && actual.claseId !== o.abierta) {
    // Se fue de la clase. Limpio, el borrador se va; sucio, se queda hasta que la pregunta se conteste.
    if (!esSucio(actual)) actual = clase ? nuevoEstado(clase, o.disposicion) : null;
  } else if (!actual && clase) {
    actual = nuevoEstado(clase, o.disposicion);
  } else if (actual && clase && (clase !== actual.claseBase || actual.base.disposicion !== o.disposicion)) {
    // Llegó otra versión de la clase (un gesto del menú, los minutos, otra pestaña) o el curso cambió la
    // disposición: lo que la persona NO tocó toma lo nuevo, lo que tocó se queda (`rebasar`).
    const base = borradorDe(clase, o.disposicion);
    actual = { ...actual, claseBase: clase, base, borrador: rebasar(actual.base, actual.borrador, base) };
  }
  if (actual !== lec) { lecRef.current = actual; setLec(actual); }

  const sucio = esSucio(actual);

  const aplicarDeshacer = useCallback((b: BorradorLeccion): BorradorLeccion => {
    const l = lecRef.current;
    if (!l) return b;
    ultimoGesto.current = null;
    poner({ ...l, borrador: b, estado: estadoTrasCambio(l.base, b), erroresServer: {} });
    return l.borrador;
  }, [poner]);

  const cambiar = useCallback((parche: Partial<BorradorLeccion>) => {
    const l = lecRef.current;
    if (!l) return;
    const nuevo = { ...l.borrador, ...parche };
    const g = gestoDe(l.borrador, nuevo);
    if (!g) return;
    const ahora = Date.now();
    if (esGestoNuevo(ultimoGesto.current, g, ahora)) pila.current?.apilar(l.borrador);
    ultimoGesto.current = { clave: g.clave, en: ahora };
    poner({ ...l, borrador: nuevo, estado: estadoTrasCambio(l.base, nuevo), erroresServer: {} });
  }, [poner]);

  const descartar = useCallback(() => {
    const l = lecRef.current;
    if (!l || !esSucio(l)) return;
    // Descartar se deshace con Ctrl+Z mientras la lección siga abierta: es un gesto más.
    pila.current?.apilar(l.borrador);
    ultimoGesto.current = null;
    poner({ ...l, borrador: l.base, estado: 'limpio', intento: false, erroresServer: {} });
  }, [poner]);

  const guardar = useCallback(async (): Promise<boolean> => {
    const l = lecRef.current;
    if (!l || enVuelo.current) return false;
    if (!esSucio(l)) return true;
    // ⚠️ LO INCOMPLETO NO SE MANDA, Y TAMPOCO SE PIERDE (item 2): se marca en rojo y se queda en el
    //    borrador. El server lo rechazaría igual (`guardarLeccion`): es la segunda capa, nunca un descarte.
    const errores = erroresDelBorrador(l.borrador);
    if (Object.keys(errores).length) {
      poner({ ...l, intento: true, estado: 'falta' });
      scrollAlPrimerError();
      return false;
    }
    const enviado = l.borrador;
    const { cambios, antes, disposicion } = cambiosParaGuardar(l.base, enviado, (k) => medidos.current.get(k));
    enVuelo.current = true;
    poner({ ...l, estado: 'guardando' });
    try {
      // ⚠️ LA DISPOSICIÓN PRIMERO (revisión final del 08/10/2026): `guardarLeccionAction` revalida el curso
      //    (el Atrás, ver ahí) y la página vuelve con los ajustes del SERVER — CursoApp resiembra `estilos` de
      //    sus props. Guardada DESPUÉS, la disposición nueva quedaba pisada en pantalla por la vieja que traía
      //    esa vuelta, con la nueva ya en la base.
      if (disposicion && !(await oRef.current.guardarDisposicion(disposicion))) {
        const ahora = lecRef.current ?? l;
        poner({ ...ahora, estado: 'error' });
        return false;
      }
      let claseNueva: Clase | null = null;
      if (cambios) {
        const r = await guardarLeccionAction(l.claseId, cambios, antes);
        if (!r.ok) {
          const ahora = lecRef.current ?? l;
          const errs = r.errores ?? {};
          poner({ ...ahora, estado: r.conflicto ? 'conflicto' : Object.keys(errs).length ? 'falta' : 'error', intento: true, erroresServer: errs });
          // Con un choque, el server manda la clase como está: la tab la pone y el borrador se rebasa encima
          // (lo tocado se queda), así el próximo «Guardar» escribe lo de esta pestaña.
          if (r.clase) oRef.current.onClase(r.clase);
          // ⚠️ El título y la descripción NO tienen dónde pintarse en rojo (los campos y las tareas sí): sin
          //    esto, «Completa lo marcado» sobre una descripción demasiado larga no marcaba nada (revisión
          //    final del 08/10/2026). Su motivo va al aviso de la tab.
          const sinLugar = Object.entries(errs).filter(([k]) => k === 'titulo' || k === 'descripcion').map(([, m]) => m);
          if (sinLugar.length) oRef.current.avisar(sinLugar.join(' · '));
          if (Object.keys(errs).length) scrollAlPrimerError();
          else oRef.current.avisar(r.error);
          return false;
        }
        claseNueva = r.clase;
      }
      // Lo guardado es la base nueva. Lo que se mandó toma lo que contestó el server (ya saneado); lo que
      // se siguió escribiendo mientras viajaba se queda (`rebasar` contra lo ENVIADO, no contra la base).
      const ahora = lecRef.current ?? l;
      const claseBase = claseNueva ?? ahora.claseBase;
      const base = borradorDe(claseBase, disposicion ?? ahora.base.disposicion);
      const borrador = rebasar(enviado, ahora.borrador, base);
      poner({ ...ahora, claseBase, base, borrador, estado: partesCambiadas(base, borrador).length ? 'sucio' : 'guardado', intento: false, erroresServer: {} });
      if (claseNueva) oRef.current.onClase(claseNueva);
      return true;
    } catch {
      const ahora = lecRef.current ?? l;
      poner({ ...ahora, estado: 'error' });
      oRef.current.avisar('No se pudo guardar.');
      return false;
    } finally {
      enVuelo.current = false;
    }
  }, [poner, oRef]);

  const pedirSalida = useCallback((seguir: () => void, op?: { guardar?: string }) => {
    if (!esSucio(lecRef.current)) { seguir(); return; }
    setPregunta({ seguir, guardar: op?.guardar ?? 'Guardar', guardando: false });
  }, []);

  const soltar = useCallback((claseId: number) => {
    if (lecRef.current?.claseId === claseId) poner(null);
  }, [poner]);

  // ── La salida que ya pasó (el dibujo movió el hash, o el Atrás): se vuelve y se pregunta ──
  useLayoutEffect(() => {
    const l = lecRef.current;
    if (!l) return;
    if (pos.clase === l.claseId) { posDelBorrador.current = pos; largoHistorial.current = history.length; return; }
    if (!esSucio(l)) return;
    const destino = pos;
    // ⚠️ Si la salida EMPUJÓ una entrada (un clic en el curso), volver con `reemplazar` deja la clase DOS veces
    //    en el historial: medido en el banco, el Atrás siguiente no hacía nada. «Seguir editando» la saca
    //    (`history.back()` a la entrada de antes, que dice lo mismo: el hash no cambia y no se redibuja nada).
    const empujo = history.length > largoHistorial.current;
    navegar(posDelBorrador.current ?? { clase: l.claseId }, 'reemplazar');
    setPregunta({ seguir: () => navegar(destino, 'reemplazar'), guardar: 'Guardar', guardando: false, empujo });
  }, [pos]);

  // ── Cerrar la pestaña o recargar: lo pregunta el navegador (su texto, no el nuestro) ──
  useEffect(() => {
    if (!sucio) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [sucio]);

  // ── Un link que saca de la página (la vista del alumno, el menú de la app): se ataja antes ──
  useEffect(() => {
    if (!sucio) return;
    const f = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      // Un link ADENTRO de un texto que se está editando (el editor rico) no navega: se está escribiendo.
      if (a.closest('[contenteditable="true"]')) return;
      let url: URL;
      try { url = new URL(a.href, location.href); } catch { return; }
      // Afuera del sitio lo pregunta `beforeunload`; un cambio de hash es el curso (lo ataja el efecto de arriba).
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      const destino = url.pathname + url.search + url.hash;
      pedirSalida(() => router.push(destino), { guardar: a.closest('[data-guardar-y-ver]') ? 'Guardar y ver' : 'Guardar' });
    };
    document.addEventListener('click', f, true);
    return () => document.removeEventListener('click', f, true);
  }, [sucio, pedirSalida, router]);

  const errores = actual?.intento ? { ...erroresDelBorrador(actual.borrador), ...actual.erroresServer } : {};

  const dialogo = pregunta ? (
    <PreguntaSalir rotulo={pregunta.guardar} guardando={pregunta.guardando}
      onSeguirEditando={() => { if (pregunta.empujo) history.back(); setPregunta(null); }}
      onDescartar={() => {
        const p = pregunta;
        setPregunta(null);
        const l = lecRef.current;
        if (l) poner({ ...l, borrador: l.base, estado: 'limpio', intento: false, erroresServer: {} });
        p.seguir();
      }}
      onGuardar={async () => {
        const p = pregunta;
        setPregunta({ ...p, guardando: true });
        const ok = await guardar();
        setPregunta(null);
        // Si no se pudo (algo marcado en rojo, un choque), se queda en la clase: lo que falta está a la vista.
        if (ok) p.seguir();
      }} />
  ) : null;

  return {
    claseId: actual?.claseId ?? null,
    borrador: actual?.borrador ?? null,
    sucio,
    estado: actual?.estado ?? 'limpio',
    errores,
    cambiar, guardar, descartar, pedirSalida, soltar, dialogo, medidos, pila, aplicarDeshacer,
  };
}

function nuevoEstado(c: Clase, disposicion: DisposicionBorrador): Estado {
  const base = borradorDe(c, disposicion);
  return { claseId: c.id, claseBase: c, base, borrador: base, estado: 'limpio', intento: false, erroresServer: {} };
}

/** Después de un cambio: «Sin guardar», o limpio si volvió a lo guardado (deshacer a mano lo escrito). */
const estadoTrasCambio = (base: BorradorLeccion, b: BorradorLeccion): EstadoBarra => (partesCambiadas(base, b).length ? 'sucio' : 'limpio');

/**
 * La pregunta de salir con cambios (item 1): tres salidas con su nombre (AGENTS.md: ningún botón es
 * «Aceptar» ni «Cancelar» a secas). «Guardar y ver» desde la vista del alumno (item 3).
 */
function PreguntaSalir({ rotulo, guardando, onGuardar, onDescartar, onSeguirEditando }: {
  rotulo: string; guardando: boolean; onGuardar: () => void; onDescartar: () => void; onSeguirEditando: () => void;
}) {
  // `onCerrar` de identidad fija: con una flecha nueva, cada render le movía el foco a la caja (./dialogo-foco.ts).
  const cerrar = useCerrarEstable(onSeguirEditando, guardando);
  return (
    <Modal titulo="Hay cambios sin guardar" ancho={440} onCerrar={cerrar}
      pie={(
        <>
          <Button variant="secondary" size="sm" disabled={guardando} onClick={onSeguirEditando}>Seguir editando</Button>
          <Button variant="secondary" size="sm" disabled={guardando} onClick={onDescartar}>Descartar</Button>
          <Button variant="primary" size="sm" loading={guardando} onClick={onGuardar}>{rotulo}</Button>
        </>
      )}>
      <p style={{ margin: 0 }}>Si sales sin guardar, se pierden.</p>
    </Modal>
  );
}

/**
 * La barra de «Guardar» (item 1), pegada abajo de la lección: «Sin guardar · Descartar · Guardar», que
 * pasa a «Guardando…» y después a «Guardado». Y los botones de deshacer y rehacer, que hacen lo mismo
 * que Ctrl+Z y Ctrl+Y (un atajo que nadie ve no existe para quien no lo conoce).
 *
 * ⚠️ LA PILA VIVE ACÁ: la barra se monta con la lección (el dibujo la remonta por clase), así que cada
 *    clase arranca con su pila vacía y un Ctrl+Z nunca deshace algo de la clase de antes.
 * ⚠️ `data-esquina-ocupada`: el «Guardar» queda en el rincón de abajo a la derecha, y sin la marca la
 *    esquina de avisos lo tapa (AGENTS.md).
 */
function BarraDeLeccion({ l }: { l: LeccionAbierta }) {
  const pila = usePilaDeshacer<BorradorLeccion>(l.aplicarDeshacer);
  useEffect(() => {
    l.pila.current = pila;
  });
  useEffect(() => () => { l.pila.current = null; }, [l.pila]);
  const guardando = l.estado === 'guardando';
  const texto = textoDeBarra(l.estado);
  return (
    <div className="cu-barra" role="region" aria-label="Guardar la clase" data-esquina-ocupada>
      <span className={`cu-barra-estado cu-barra-estado--${l.estado}`} role="status">{texto}</span>
      <span className="cu-barra-acciones">
        <button type="button" className="ugc-btn cu-barra-ico" title="Deshacer (Ctrl+Z)" aria-label="Deshacer"
          disabled={guardando || !pila.puedeDeshacer} onClick={pila.deshacer}>{'↶'}</button>
        <button type="button" className="ugc-btn cu-barra-ico" title="Rehacer (Ctrl+Y)" aria-label="Rehacer"
          disabled={guardando || !pila.puedeRehacer} onClick={pila.rehacer}>{'↷'}</button>
        {l.sucio && <button type="button" className="ugc-btn" disabled={guardando} onClick={l.descartar}>Descartar</button>}
        <button type="button" className="ugc-btn primary" data-recorrido="leccion-guardar" disabled={guardando || !l.sucio}
          onClick={() => void l.guardar()}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </span>
    </div>
  );
}

// ── El video ─────────────────────────────────────────────────────────────────

/**
 * Los minutos de la clase, SOLOS (item 12): cuando el reproductor sabe cuánto dura el video (YouTube,
 * Vimeo, un archivo) o lo dice el oEmbed de Loom.
 *
 * ⚠️ SÓLO EL VIDEO YA GUARDADO ESCRIBE EN EL ACTO (audio del 08/10: la lección no se guarda sola, pero
 *    los minutos son un dato del video, no una edición): una vez por video, y sólo si no coinciden. Los de
 *    un video del BORRADOR se anotan (`medidos`) y viajan con «Guardar», junto con el video nuevo.
 */
function useMinutosDelVideo(vista: Clase, guardada: Clase, ctx: CtxLeccion, l: LeccionAbierta | null) {
  const ctxRef = useUltimo(ctx);
  const hecho = useRef<string | null>(null);
  const clave = claveDeVideo(vista);
  const claveGuardada = claveDeVideo(guardada);
  const { id, minutos } = guardada;
  const medidos = l?.medidos;
  return useCallback((seg: number) => {
    const min = minutosDeDuracion(seg);
    if (!ctxRef.current.puedeEditar || min == null) return;
    medidos?.current.set(clave, min);
    if (clave !== claveGuardada || hecho.current === clave) return;
    hecho.current = clave;
    if (min === minutos) return;
    void guardarCampoClaseAction(id, { minutos: min })
      .then((r) => { if (r.ok) ctxRef.current.onClase(r.clase); })
      .catch(() => { /* sin minutos no se cae nada: la próxima vez que se abra se vuelve a intentar */ });
  }, [id, minutos, clave, claveGuardada, ctxRef, medidos]);
}

/**
 * El video de la clase, con el MISMO reproductor del portal en modo vista previa (no manda avance:
 * no hay alumno). Un video SUBIDO (de antes del 08/10/2026) no tiene link público: se pide uno firmado
 * de vida corta (`urlVerVideoAction`, que alcanza con poder mirar la tab).
 */
function VideoDeClase({ clase, guardada, ctx, l }: { clase: Clase; guardada: Clase; ctx: CtxLeccion; l: LeccionAbierta | null }) {
  const { video } = reproductorDeClase(clase);
  const [firmada, setFirmada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alDurar = useMinutosDelVideo(clase, guardada, ctx, l);
  const path = video?.tipo === 'archivo' ? clase.videoPath : null;
  useEffect(() => {
    if (!path) return;
    let vivo = true;
    urlVerVideoAction(path)
      .then((r) => { if (vivo) { if (r.ok) setFirmada(r.url); else setError(r.error); } })
      .catch(() => { if (vivo) setError('No pude abrir el video.'); });
    return () => { vivo = false; };
  }, [path]);
  // Loom va en un iframe que no dice cuánto dura: lo dice su oEmbed (con CORS abierto, medido).
  const loom = video?.tipo === 'iframe' ? oembedDeLoom(clase.videoUrl) : null;
  useEffect(() => {
    if (!loom || !ctx.puedeEditar) return;
    let vivo = true;
    fetch(loom, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { duration?: unknown } | null) => { if (vivo && typeof j?.duration === 'number') alDurar(j.duration); })
      .catch(() => { /* sin duración, sin minutos */ });
    return () => { vivo = false; };
  }, [loom, ctx.puedeEditar, alDurar]);
  if (!video) return null;
  if (video.tipo === 'archivo') {
    if (error) return <p className="cp-nota" style={{ padding: 16, color: '#fff' }}>{error}</p>;
    if (!firmada) return null;
    return (
      <VistaPreviaCtx.Provider value>
        <Reproductor token="" claseId={clase.id} video={{ tipo: 'directo', url: firmada }} titulo={clase.titulo} onPct={() => {}} onDuracion={alDurar} />
      </VistaPreviaCtx.Provider>
    );
  }
  return (
    <VistaPreviaCtx.Provider value>
      <Reproductor token="" claseId={clase.id} video={video} titulo={clase.titulo} onPct={() => {}} onDuracion={alDurar} />
    </VistaPreviaCtx.Provider>
  );
}

/** El video del borrador para un link (o sin video). Lo que se guarda lo vuelve a validar el server. */
const videoDeUnLink = (url: string, tipo: VideoDelBorrador['videoTipo']): VideoDelBorrador => ({ videoTipo: tipo, videoUrl: url, videoPath: null });
const SIN_VIDEO: VideoDelBorrador = { videoTipo: 'ninguno', videoUrl: null, videoPath: null };

/**
 * Poner, cambiar o quitar el video: SÓLO POR LINK (item 11), y en el BORRADOR (audio del 08/10/2026):
 * se ve en el acto y se escribe con «Guardar». Quitar se deshace con Ctrl+Z o con «Descartar».
 */
function useCambioDeVideo(l: LeccionAbierta) {
  const [error, setError] = useState<string | null>(null);
  const usarLink = (raw: string): boolean => {
    const r = linkDeVideo(raw);
    if (!r.ok) { setError(r.error); return false; }
    setError(null);
    l.cambiar({ video: videoDeUnLink(r.url, r.tipo) });
    return true;
  };
  const quitar = () => { setError(null); l.cambiar({ video: SIN_VIDEO }); };
  return { error, usarLink, quitar, limpiar: () => setError(null) };
}

type CambioDeVideo = ReturnType<typeof useCambioDeVideo>;

/**
 * El campo para pegar el link, con «Usar» y «Cancelar». El foco va al campo: es lo único que hay para hacer.
 *
 * ⚠️ `type="text"` Y NO `url` (audio del 08/10/2026, 22:40: «tengo que hacer que funcione con URL y con
 *    HTML embed»): con `url`, el navegador frena el envío de un código `<iframe …>` con su propio cartel
 *    antes de que la pantalla lo vea. Qué es un video lo decide `linkDeVideo` (y el server, al guardar).
 */
function FormLink({ v, onListo, onCancelar }: { v: CambioDeVideo; onListo: () => void; onCancelar: () => void }) {
  const [link, setLink] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { campo.current?.focus(); }, []);
  return (
    <form className="cu-vid-fila" onSubmit={(e) => {
      e.preventDefault();
      if (v.usarLink(link)) { setLink(''); onListo(); }
    }}>
      <input ref={campo} className="cu-vid-input" type="text" inputMode="url" autoComplete="off" spellCheck={false} value={link}
        placeholder="Link o código para insertar" aria-label="Link del video" onChange={(e) => { setLink(e.target.value); v.limpiar(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancelar(); } }} />
      <button type="submit" className="ugc-btn primary">Usar</button>
      <button type="button" className="ugc-btn" onClick={() => { v.limpiar(); onCancelar(); }}>Cancelar</button>
    </form>
  );
}

/**
 * El recuadro de «Agregar video» (`LeccionUgc.sinVideo`). EL RECUADRO ENTERO ES EL BOTÓN (item 11): un
 * clic en cualquier parte abre el campo para pegar el link, ahí mismo.
 */
function AgregarVideo({ l }: { l: LeccionAbierta }) {
  const v = useCambioDeVideo(l);
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" className="cu-vacio-boton" onClick={() => { v.limpiar(); setAbierto(true); }}>
        <span className="cu-vacio-mas" aria-hidden>+</span>
        <span className="cu-vacio-t">Agregar video</span>
        <span className="cu-vid-nota">YouTube, Vimeo, Panda, Loom o Drive</span>
      </button>
    );
  }
  return (
    <div className="cu-vacio">
      {/* «El link o el código» (item 14, 22:40: «tengo que hacer que funcione con URL y con HTML embed»):
          el título decía sólo «link», y el código de Panda es justo lo que hay que pegar. */}
      <span className="cu-vacio-t">Pega el link o el código</span>
      <FormLink v={v} onListo={() => setAbierto(false)} onCancelar={() => setAbierto(false)} />
      <span className="cu-vid-nota">YouTube, Vimeo, Panda, Loom o Drive</span>
      {v.error && <p className="cu-vid-error" role="alert">{v.error}</p>}
    </div>
  );
}

/** Lo que dice el video puesto y sus dos acciones: «Cambiar link» y «Quitar». */
function ControlesDelVideo({ c, l, ctx }: { c: Clase; l: LeccionAbierta; ctx: CtxLeccion }) {
  const v = useCambioDeVideo(l);
  const [cambiando, setCambiando] = useState(false);
  const info = videoDeClase(c);
  if (cambiando) {
    return (
      <div className="cu-vid-barra">
        <FormLink v={v} onListo={() => setCambiando(false)} onCancelar={() => setCambiando(false)} />
        {v.error && <p className="cu-vid-error" role="alert">{v.error}</p>}
      </div>
    );
  }
  const quitar = async () => {
    // Un archivo SUBIDO (de antes del 08/10/2026) se borra del bucket al guardar (`guardarLeccion`), y ya
    // no se puede volver a subir (item 11): se dice antes. Un link se quita en el borrador y se deshace.
    if (c.videoTipo === 'archivo' && !(await ctx.confirmar('El archivo se borra al guardar.', { titulo: '¿Quitar el video?', boton: 'Quitar' }))) return;
    v.quitar();
  };
  return (
    <div className="cu-vid-barra">
      <span className={`cu-vid-nota${info.medible ? '' : ' cu-tenue'}`}>{info.rotulo}{info.medible ? '' : ' · sin medir'}</span>
      <span className="cu-vid-acciones">
        <button type="button" className="ugc-btn" onClick={() => { v.limpiar(); setCambiando(true); }}>Cambiar link</button>
        <button type="button" className="ugc-btn" onClick={() => void quitar()}>Quitar</button>
      </span>
      {v.error && <p className="cu-vid-error" role="alert">{v.error}</p>}
    </div>
  );
}

// ── Debajo del video: los minutos y un link de afuera ────────────────────────

/** Los minutos que se muestran: los guardados si el video es el guardado; si no, los que midió el reproductor. */
function minutosDe(c: Clase, guardada: Clase, l: LeccionAbierta | null): number | null {
  if (claveDeVideo(c) === claveDeVideo(guardada)) return guardada.minutos;
  return l?.medidos.current.get(claveDeVideo(c)) ?? null;
}

/** ¿Hay algo que decir debajo del video? Sin nada, no se dibuja el hueco (un margen vacío). */
function hayFicha(c: Clase, guardada: Clase, ctx: CtxLeccion, lugar: LugarDelVideo, l: LeccionAbierta | null): boolean {
  return lugar === 'afuera' || minutosDe(c, guardada, l) != null || (lugar === 'marco' && !l)
    || (guardada.obligatoria && tieneTarea(guardada) && ctx.vinculado);
}

/**
 * Debajo del video. ⚠️ SIN «Concepto» Y SIN MINUTOS A MANO desde el 08/10/2026 (item 12): el tipo de la
 * clase sigue en la base con su valor y salió de la pantalla; los minutos salen solos del video
 * (`useMinutosDelVideo`) y acá sólo se leen. Un link que no se reproduce adentro (`afuera`) va acá.
 * El chip «Obligatoria» es de lo GUARDADO: la marca vive en el menú de la clase y no en el borrador.
 */
function FichaDeLaClase({ c, guardada, ctx, l, lugar }: { c: Clase; guardada: Clase; ctx: CtxLeccion; l: LeccionAbierta | null; lugar: LugarDelVideo }) {
  const v = videoDeClase(c);
  const min = minutosDe(c, guardada, l);
  return (
    <div className="cu-ficha">
      <span className="cu-ficha-meta">
        {min != null && <span>{min} min</span>}
        {/* Con el video en el marco, quien edita lo lee en la franja de abajo del video. */}
        {(lugar === 'afuera' || (lugar === 'marco' && !l)) && (
          <span className={v.medible ? '' : 'cu-tenue'}>{v.rotulo}{v.medible ? '' : ' · sin medir'}</span>
        )}
        {guardada.obligatoria && tieneTarea(guardada) && ctx.vinculado && <span className="cu-chip">Obligatoria</span>}
      </span>
      {lugar === 'afuera' && <VideoDeClase clase={c} guardada={guardada} ctx={ctx} l={l} />}
      {lugar === 'afuera' && l && <ControlesDelVideo key={claveDeVideo(c)} c={c} l={l} ctx={ctx} />}
    </div>
  );
}

// ── El papel: la disposición, la descripción y debajo la tarea ───────────────

/**
 * El papel de la lección: arriba de todo el interruptor de la disposición (lo trae el dibujo, item 13),
 * después la descripción y DEBAJO la tarea, siempre juntas (item 14): el mismo orden que en el portal.
 */
function PapelDelEditor({ c, vista, ctx, l, arriba }: { c: Clase; vista: Clase; ctx: CtxLeccion; l: LeccionAbierta | null; arriba: ReactNode }) {
  const b = l?.borrador ?? null;
  return (
    <div className="ugc-paper cu-papel">
      {/* React 19 sube esta hoja al <head> UNA vez (la deduplica por `href`). */}
      <style href="cu-leccion" precedence="medium">{CSS_LECCION}</style>
      {arriba != null && <div className="cu-papel-dispo" data-recorrido="leccion-disposicion">{arriba}</div>}
      {l && b ? <DescripcionEditable c={c} l={l} ctx={ctx} /> : <DescripcionLectura c={vista} />}
      {l && b ? (
        // La consigna con formato, los campos, las tareas y «Una respuesta por área» (pista TAREA). Es
        // CONTROLADO: lo que cambia vuelve al borrador, y su «Deshacer» de un campo revierte por acá.
        <TareaEditor valor={{ tareaHtml: b.tareaHtml, campos: b.campos, porArea: b.porArea }}
          onChange={(v) => l.cambiar({ tareaHtml: v.tareaHtml, campos: v.campos, porArea: v.porArea })}
          errores={l.errores} claseId={c.id} productoId={ctx.productoId}
          ofrecerPorArea={ofrecePorArea(ctx.cursoPideAreas === true, c.porArea === true || b.porArea)} />
      ) : tieneTarea(vista) ? <TareaComoLaVeElAlumno c={vista} /> : null}
    </div>
  );
}

// ── Las URLs de los adjuntos: una action por tanda, y ADELANTADAS ─────────────
// La caché vive en ./urls-adjuntos.ts y es UNA para la descripción y la tarea (./TareaEditor.tsx).

/**
 * Adelanta lo que la lección de `c` va a pedir al abrirse: las URLs de sus adjuntos, los de la descripción
 * y los de las consignas de sus tareas (la principal y cada `seccion`).
 */
export function precargarLeccion(c: Pick<Clase, 'descripcionHtml' | 'campos'> & { tareaHtml?: string | null }): void {
  precargarUrlsDeAdjuntos([c.descripcionHtml ?? '', ...htmlsDeTareas(c)]);
}

/** La descripción para quien MIRA la tab sin editarla: la rica, o el texto plano en párrafos. */
function DescripcionLectura({ c }: { c: Clase }) {
  const html = c.descripcionHtml?.trim() ? c.descripcionHtml : '';
  const urlDeAdjunto = useUrlsDeAdjuntos(html);
  if (html) return <HtmlSeguro html={html} urlDeAdjunto={urlDeAdjunto} />;
  const texto = c.descripcion.trim();
  return texto ? <>{texto.split(/\n{2,}/).map((p, i) => <p key={i} className="ugc-doc-p">{p}</p>)}</> : null;
}

/**
 * La descripción, editable como un documento (item 17): el editor rico con imágenes, PDF y archivos.
 * Escribe en el BORRADOR; lo que se guarda lo SANEA el server (lista blanca), y los adjuntos van por
 * referencia (`mako-adjunto:<id>`), que cada uno ve con su URL. Un adjunto SUBE en el acto (no hay otra
 * forma de tenerlo en el documento): si el borrador se descarta, queda huérfano y lo barre la purga.
 */
function DescripcionEditable({ c, l, ctx }: { c: Clase; l: LeccionAbierta; ctx: CtxLeccion }) {
  const html = l.borrador?.descripcionHtml ?? '';
  const claseId = c.id;
  const urlDeAdjunto = useUrlsDeAdjuntos(html);
  const subirAdjunto = useMemo(() => crearSubidorDeAdjuntos(
    { firmar: urlSubidaAdjuntoAction, registrar: registrarAdjuntoAction, subir: subirConProgreso },
    { productoId: ctx.productoId, claseId },
  ), [ctx.productoId, claseId]);
  return (
    <div className="cu-desc" data-recorrido="leccion-descripcion">
      <EditorRicoPerezoso valor={html} onCambio={(h) => l.cambiar({ descripcionHtml: h })} subirAdjunto={subirAdjunto} urlDeAdjunto={urlDeAdjunto}
        aceptaArchivos={ACEPTA_ADJUNTO} aceptaImagenes={ACEPTA_IMAGEN_ADJUNTO} minAlto={120}
        placeholder={'Escribe la descripción…'} etiqueta="Descripción de la clase" />
    </div>
  );
}

/**
 * La tarea como la ve el alumno, para quien mira la tab sin editar: en vista previa, no guarda nada.
 *
 * ⚠️ CON SU CONSIGNA CON FORMATO Y SUS ADJUNTOS (revisión final del 08/10/2026): sin `tareaHtml`, quien mira
 *    leía el texto plano derivado (sin negritas, sin la agenda insertada) y sin `urlDeAdjunto` una imagen
 *    pegada en una tarea no se dibujaba. Es lo mismo que le pasan el portal y la vista del alumno.
 */
function TareaComoLaVeElAlumno({ c }: { c: Clase }) {
  const urlDeAdjunto = useUrlsDeAdjuntos(htmlsDeTareas(c).join(' '));
  return (
    <VistaPreviaCtx.Provider value>
      <TareaAlumno token="" claseId={c.id} tarea={c.tarea} tareaHtml={c.tareaHtml ?? null} urlDeAdjunto={urlDeAdjunto} campos={c.campos}
        valoresIniciales={{}} estadoInicial="pendiente" onEstado={() => {}} onAvance={() => {}} />
    </VistaPreviaCtx.Provider>
  );
}

// ⚠️ LA TAREA EDITABLE SE MUDÓ a ./TareaEditor.tsx (pista TAREA, audio del 08/10/2026): la consigna con
//    formato, los campos de cada tarea en UN contenedor, más de una tarea y «Una respuesta por área».
//    «Obligatoria para avanzar» SALIÓ de la tarea (item 7, 13:00: «ese botón tal vez no se debería
//    configurar ahí, sino… en el desplegable de cada clase»): es un interruptor del menú «…» de la clase
//    (./MenuCurso.tsx), inmediato y con «Deshacer».

// ── Estilos ──────────────────────────────────────────────────────────────────
// Todo bajo `.ahdoc.ahdoc--ugc .ugc`: la lección vive adentro del dibujo del curso, cuya hoja pone en
// cero el margen y el relleno de todo y deja sin fondo ni borde a todo button (`.ahdoc button`), y con
// esta especificidad se le gana sin `!important`.
// ⚠️ Es un template literal: adentro no va ningún acento grave ni la secuencia de interpolación, ni en
//    un comentario (AGENTS.md). Los cortan en silencio y la lección sale sin estilo.
export const CSS_LECCION = `
.ahdoc.ahdoc--ugc .ugc .cu-papel > * + * { margin-top: 18px; }
.ahdoc.ahdoc--ugc .ugc .cu-papel-dispo { display: flex; justify-content: flex-end; }
/* En el telefono la leccion va siempre apilada y el interruptor se esconde (app/_cursos/estilos.ts, max-width
   760px). Su caja tambien: vacia dejaba un hueco arriba de la descripcion, y el recorrido de la clase la
   contaba como presente y senalaba una caja de alto cero (revision final del 08/10/2026). */
@media (max-width: 760px) { .ahdoc.ahdoc--ugc .ugc .cu-papel-dispo { display: none; } }
.ahdoc.ahdoc--ugc .ugc .cu-desc { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ahdoc.ahdoc--ugc .ugc .cu-rico-cargando {
  display: flex; align-items: center; justify-content: center; border: 1.5px dashed var(--u-ink-40); border-radius: 10px;
  font: 600 12px/1 var(--font-jetbrains), monospace; color: var(--u-ink-60);
}
.ahdoc.ahdoc--ugc .ugc .cu-agregar {
  display: flex; align-items: center; justify-content: center; width: 100%; min-height: 64px; cursor: pointer;
  border: 2px dashed var(--u-ink-40); border-radius: 12px; background: transparent; color: var(--u-ink);
  font: 700 13px/1 var(--font-jetbrains), monospace;
}
.ahdoc.ahdoc--ugc .ugc .cu-agregar:hover { border-color: var(--u-ink); background: var(--u-card); }

/* La barra de Guardar (audio del 08/10/2026, item 1): pegada al pie del carril que scrollea (.ugc-content),
   con fondo propio, o el texto de la leccion pasa por debajo y se lee encima. */
.ahdoc.ahdoc--ugc .ugc .cu-barra {
  position: sticky; bottom: 0; z-index: 4; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  flex-wrap: wrap; margin: 4px 0 0; padding: 10px 14px; border: 2px solid var(--u-ink); border-radius: 14px;
  background: var(--u-card); box-shadow: 0 -6px 18px rgba(22, 21, 15, .08);
}
.ahdoc.ahdoc--ugc .ugc .cu-barra-estado { font: 700 12px/1.3 var(--font-jetbrains), monospace; color: var(--u-ink-60); }
.ahdoc.ahdoc--ugc .ugc .cu-barra-estado--sucio { color: var(--u-ink); }
.ahdoc.ahdoc--ugc .ugc .cu-barra-estado--falta,
.ahdoc.ahdoc--ugc .ugc .cu-barra-estado--error,
.ahdoc.ahdoc--ugc .ugc .cu-barra-estado--conflicto { color: #b3261e; }
.ahdoc.ahdoc--ugc .ugc .cu-barra-acciones { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; }
.ahdoc.ahdoc--ugc .ugc .cu-barra-ico { min-width: 36px; padding-left: 8px; padding-right: 8px; font-size: 16px; }
.ahdoc.ahdoc--ugc .ugc .cu-barra .ugc-btn:disabled { opacity: .45; cursor: default; }

.ahdoc.ahdoc--ugc .ugc .cu-vacio {
  align-self: stretch; flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; border-radius: 14px;
}
.ahdoc.ahdoc--ugc .ugc .cu-vacio-boton {
  position: absolute; inset: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 18px; border-radius: 16px; cursor: pointer; background: transparent; color: var(--u-ink);
  font: inherit; text-align: center; transition: background .12s;
}
.ahdoc.ahdoc--ugc .ugc .cu-vacio-boton:hover { background: var(--u-lime-a22); }
.ahdoc.ahdoc--ugc .ugc .cu-vacio-boton:focus-visible { outline: 3px solid var(--u-lime); outline-offset: -3px; }
.ahdoc.ahdoc--ugc .ugc .cu-vacio-mas {
  display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%;
  border: 2px solid var(--u-ink); background: var(--u-card); font: 800 24px/1 var(--font-jetbrains), monospace;
}
.ahdoc.ahdoc--ugc .ugc .cu-vacio-t { font-weight: 800; font-size: 20px; letter-spacing: -.01em; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-fila { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; width: 100%; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-barra .cu-vid-fila { justify-content: flex-start; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-input {
  flex: 1 1 220px; min-width: 0; max-width: 420px; min-height: 36px; padding: 0 12px;
  border: 2px solid var(--u-ink); border-radius: 9px; background: var(--u-card); color: var(--u-ink);
  font: 500 13px/1 var(--font-jetbrains), monospace;
}
.ahdoc.ahdoc--ugc .ugc .cu-vid-nota { font: 600 10.5px/1.4 var(--font-jetbrains), monospace; color: var(--u-ink-60); }
.ahdoc.ahdoc--ugc .ugc .cu-vid-error { margin: 0; font-size: 12.5px; font-weight: 600; color: #b3261e; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; width: 100%; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-acciones { display: inline-flex; gap: 8px; margin-left: auto; }
.ahdoc.ahdoc--ugc .ugc .cu-vid-barra .ugc-btn:disabled, .ahdoc.ahdoc--ugc .ugc .cu-vid-fila .ugc-btn:disabled { opacity: .5; cursor: default; }

.ahdoc.ahdoc--ugc .ugc .cu-ficha { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; justify-content: space-between; }
.ahdoc.ahdoc--ugc .ugc .cu-ficha-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 12.5px; color: var(--u-ink-60); }
.ahdoc.ahdoc--ugc .ugc .cu-tenue { opacity: .7; }
.ahdoc.ahdoc--ugc .ugc .cu-chip { padding: 4px 9px; border-radius: 999px; background: var(--u-lime); color: var(--u-ink); font: 700 10.5px/1.2 var(--font-jetbrains), monospace; }
`;
