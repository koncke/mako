'use client';

// =============================================================================
// EditorCampos — los campos de UNA tarea de una clase
// =============================================================================
// Pedido de Martín (06/10/2026): «los formularios con las tareas para los clientes que Mauricio me
// había pedido». El molde de cada campo es el del programa viejo (`Campo` en lib/curso.ts, los 114 campos
// de sus Cuestionarios Maestros). #18 (07/10/2026): nueve tipos más (`CampoTipo`), cada uno con lo suyo
// acá abajo. Lo que le falta a un campo para guardarse lo dice `erroresDeCampos` (lib/curso.ts) y se
// pinta acá en rojo; no se repite.
//
// LOS AJUSTES DEL 08/10/2026 A LA MAÑANA (items 5, 6, 8 y 17 de los 20 ajustes): la pregunta como TÍTULO
// de la tarjeta y el texto de ejemplo en el cuadro del alumno; la tarjeta se arrastra; «+ Nuevo campo»
// grande ARRIBA; la comunidad (`publicar`, `comentar`).
//
// Y EL AUDIO DE LA TARDE (docs/feedback-curso-08oct.md, items 2, 5, 8, 9 y 10), textuales con su minuto:
//   ·  2 (16:40) «que me aparezca como un enmarcado rojo y que diga no sé, falta completar la pregunta» →
//      la tarjeta con algo que falta va con borde rojo y el motivo corto debajo de la pregunta
//      (`errores`, que calcula quien monta con `erroresDeCampos`).
//   ·  5 (21:00) «el campo lo pondría tal vez un poco más chico y lo pondría abajo del campo que ya puse»
//      → el campo nuevo nace ABAJO del último, con el foco en su pregunta y a la vista; la tarjeta es más
//      compacta (menos relleno, la pregunta más chica). ⚠️ NO se esconde nada al salir de la tarjeta: se
//      probó con la ayuda vacía (`:focus-within`) y el alto que cambia al tocar OTRA tarjeta movía el
//      scroll, y el desplegable del tipo se cerraba solo (cierra al scrollear; medido en el banco).
//      ⚠️ DECISIÓN A CONFIRMAR CON MARTÍN: el recuadro grande «+ Nuevo campo» se queda ARRIBA de la lista
//      (lo pidió él esa mañana) y el campo aparece ABAJO (lo pidió la prueba de la tarde). Al crearlo se
//      scrollea hasta él, así no queda fuera de la vista.
//   ·  8 (14:00) «cuando vos ponés un formato multiple choice, en lugar de salirte opciones multiple choice
//      te sale un cuadro de texto gigante» → las opciones se editan como en Google Forms: un renglón por
//      opción con su círculo o su casilla, «+ Agregar opción», quitar, y Enter que agrega la siguiente
//      (`ListaDeOpciones`). En el quiz se marca la correcta tocando el círculo. Lo que se edita ES la vista
//      previa: no hay otra abajo que entender.
//   ·  9 (14:50) «la escala lineal podría ser… una barra deslizable… o la típica de estrellas» → «Mostrar
//      como: Números / Deslizador / Estrellas» (`Escala.estilo`).
//   · 10 (17:30) «no entiendo el campo de lo hice» → el selector de tipo dice, de cada tipo, su ícono, su
//      nombre y qué hace el alumno (`opcionesDeTipo`, ./tarea-editor-reglas.ts).
//
// ⚠️ LAS LISTAS (opciones, columnas, filas) SE GUARDAN CRUDAS mientras se escribe: sin filtrar los
//    renglones vacíos (filtrarlos en cada tecla se come el renglón recién agregado). El saneo
//    (`sanearCampos`) los limpia al guardar, en el server.
// ⚠️ EL ID DE UN CAMPO NO SE VE NI SE EDITA: las respuestas de los clientes se guardan por id
//    (`curso_progreso.valores`). Moverlo tampoco: lo que cambia es el orden de la lista.
// ⚠️ LA CORRECTA DE UNA PREGUNTA SE MARCA POR SU TEXTO (`PreguntaQuiz.correctas`): renombrar una opción
//    marcada lleva la marca con ella (`correctasTrasRenombrar`). Las correctas no salen de esta pantalla del
//    equipo: al alumno le llegan los campos SIN ellas (`camposParaAlumno`).
// ⚠️ BORRAR, MOVER, CAMBIAR UN TIPO CON ALGO ESCRITO Y QUITAR UNA PREGUNTA AVISAN (`onCampos(lista, motivo)`):
//    quien lo monta ofrece «Deshacer». Acá no hay toast.
// ⚠️ MONTADO POR ./TareaEditor.tsx (una lista por tarea), el ARRASTRE es de la tarea entera (`arrastre`):
//    un campo pasa de una tarea a otra. Suelto (sin `arrastre`), arrastra en su propia lista.

import { Fragment, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { Campo, Escala, PreguntaQuiz } from '@/lib/curso';
import { MAX_ARCHIVOS, NOTA_MIN_DEFAULT, MAX_SEG_DEFAULT, TOPE_TEXTO_EJEMPLO, MAX_OPCIONES_QUIZ, TOPE_PREGUNTA, conTextoDeEjemplo } from '@/lib/curso';
import { Button, IconButton, Input, Select, Checkbox } from '@/app/_ui';
import { moverEnLista, nuevoIdCampo } from './reglas';
import { useArrastreCampos, type ArrastreCampos } from './arrastre-campos';
import {
  opcionesDeCategoria, opcionesDePost, pierdeAlCambiarTipo, tieneContenido, type OpcionesComunidad,
} from './leccion-reglas';
import {
  OPCIONES_ESTILO_ESCALA, campoNuevo, conCampoMovido, conEstilo, conFila, conFilaNueva, conPegado, correctasAlMarcar,
  correctasTrasQuitar, correctasTrasRenombrar, estiloDe, filasDe, motivoVisible, opcionesDeTipo, rangosDeEscala, sinFila,
} from './tarea-editor-reglas';

const preguntaNueva = (existentes: readonly PreguntaQuiz[]): PreguntaQuiz =>
  ({ id: nuevoIdCampo(existentes), texto: '', opciones: [], correctas: [] });

/** Cuántas opciones guarda un campo de elección o una checklist (el corte de `sanearCampos`). */
const TOPE_OPCIONES = 30;
const TOPE_COLUMNAS = 12;
const TOPE_FILAS = 40;

/**
 * Por qué cambió la lista, cuando hay algo que deshacer (ver la cabecera). `tipo` y `pregunta` (revisión
 * final del 08/10/2026): cambiar el tipo de un campo o quitar una pregunta de un quiz CON algo escrito
 * (./leccion-reglas.ts, `pierdeAlCambiarTipo` y `tieneContenido`).
 */
export type MotivoCampos = 'borrado' | 'movido' | 'nuevo' | 'tipo' | 'pregunta';

/**
 * El campo con OTRO tipo: lo común (la pregunta, la ayuda, si es obligatorio) se queda, y lo del tipo
 * nuevo arranca con sus defaults. Las opciones pasan entre los tres tipos que las usan (una opción,
 * varias, checklist): cambiar de uno al otro es lo más común y no debería borrar lo escrito. El texto
 * de ejemplo pasa entre los que tienen un cuadro.
 */
function conTipo(c: Campo, tipo: Campo['tipo']): Campo {
  const n: Campo = { id: c.id, label: c.label, tipo };
  if (c.ayuda) n.ayuda = c.ayuda;
  if (c.obligatorio || tipo === 'quiz') n.obligatorio = true;
  if (c.placeholder && conTextoDeEjemplo(tipo)) n.placeholder = c.placeholder;
  if ((tipo === 'eleccion' || tipo === 'checks' || tipo === 'checklist') && c.opciones) n.opciones = c.opciones;
  if (tipo === 'tabla') {
    if (c.columnas) n.columnas = c.columnas;
    if (c.filasFijas) n.filasFijas = c.filasFijas;
    if (c.filasMin) n.filasMin = c.filasMin;
  }
  if (tipo === 'archivo') n.maxArchivos = c.maxArchivos ?? 1;
  if (tipo === 'audio' || tipo === 'video') n.maxSeg = c.maxSeg ?? MAX_SEG_DEFAULT;
  if (tipo === 'escala') n.escala = c.escala ?? { min: 1, max: 10, bajo: '', alto: '' };
  if (tipo === 'quiz') {
    n.preguntas = c.preguntas?.length ? c.preguntas : [preguntaNueva([])];
    n.notaMin = c.notaMin ?? NOTA_MIN_DEFAULT;
    n.intentos = c.intentos ?? 0;
  }
  if (tipo === 'agenda') n.url = c.url ?? '';
  if (tipo === 'publicar' && c.categoriaId) n.categoriaId = c.categoriaId;
  if (tipo === 'comentar' && c.postId) { n.postId = c.postId; if (c.postTitulo) n.postTitulo = c.postTitulo; }
  return n;
}

const OPCIONES_TIPO = opcionesDeTipo();
const OPCIONES_ARCHIVOS = Array.from({ length: MAX_ARCHIVOS }, (_, i) => i + 1)
  .map((n) => ({ value: String(n), label: n === 1 ? '1 archivo' : `Hasta ${n}` }));
const OPCIONES_SEG = [30, 60, 120, 180, 300, 600]
  .map((s) => ({ value: String(s), label: s < 60 ? `${s} s` : `${s / 60} min` }));
const OPCIONES_NOTA = [50, 60, 70, 80, 90, 100].map((n) => ({ value: String(n), label: `${n} %` }));
const OPCIONES_INTENTOS = [0, 1, 2, 3, 5, 10].map((n) => ({ value: String(n), label: n === 0 ? 'Sin límite' : String(n) }));
const SIN_SILENCIO: ReadonlySet<string> = new Set();
const SIN_ERRORES: Readonly<Record<string, string>> = {};

/**
 * Lo que hay en la comunidad del producto (categorías y posts), para armar un campo de comunidad. Se pide
 * UNA vez y sólo si hay un campo que lo necesita. Sin red, los dos desplegables quedan con su default
 * («La primera» / «El último fijado»), que el server resuelve igual al publicar.
 */
function useOpcionesComunidad(hace: boolean, cargar?: () => Promise<OpcionesComunidad | null>) {
  const [opc, setOpc] = useState<OpcionesComunidad | null>(null);
  const pedido = useRef(false);
  useEffect(() => {
    if (!hace || !cargar || pedido.current) return;
    pedido.current = true;
    let vivo = true;
    cargar().then((o) => { if (vivo && o) setOpc(o); }).catch(() => { /* quedan los defaults */ });
    return () => { vivo = false; };
  }, [hace, cargar]);
  return opc;
}

export function EditorCampos({
  campos, onCampos, deshabilitado, cargarComunidad, arrastre, grupo, errores = SIN_ERRORES, silenciados = SIN_SILENCIO,
  onSalirDePregunta, enfocar: enfocarAfuera, onEnfocar, nuevoId,
}: {
  /** Los campos de ESTA tarea (sin secciones). */
  campos: Campo[];
  /** La lista nueva. `motivo` cuando hay algo que deshacer (borrar, mover…) o que enfocar (nuevo). */
  onCampos: (c: Campo[], motivo?: MotivoCampos) => void;
  deshabilitado?: boolean;
  /** Las categorías y los posts de la comunidad del producto (para «Publicar» y «Comentar»). */
  cargarComunidad?: () => Promise<OpcionesComunidad | null>;
  /** El arrastre de la tarea ENTERA (./TareaEditor.tsx): un campo pasa a otra tarea. Sin él, arrastra acá. */
  arrastre?: ArrastreCampos;
  /** El índice de esta tarea en el arrastre de la tarea entera. */
  grupo?: number;
  /** Lo que le falta a cada campo (por id), en una frase corta: borde rojo y el motivo (item 2). */
  errores?: Readonly<Record<string, string>>;
  /** Los recién creados a los que todavía nadie les salió de la pregunta: su rojo espera (`motivoVisible`). */
  silenciados?: ReadonlySet<string>;
  onSalirDePregunta?: (id: string) => void;
  /** El campo cuya pregunta toma el foco (uno recién creado). Sin esto, lo lleva la lista sola. */
  enfocar?: string | null;
  onEnfocar?: (id: string | null) => void;
  /** Un id nuevo que no choque con NINGÚN campo de la clase (las otras tareas incluidas). */
  nuevoId?: () => string;
}) {
  // Con varias tareas, el foco lo lleva la tarea entera (la sección nueva enfoca su título); sola, acá.
  const [enfocarLocal, setEnfocarLocal] = useState<string | null>(null);
  const enfocar = onEnfocar ? enfocarAfuera ?? null : enfocarLocal;
  const pedirFoco = onEnfocar ?? setEnfocarLocal;
  const cambiar = (i: number, parche: Partial<Campo>, motivo?: MotivoCampos) =>
    onCampos(campos.map((c, j) => (j === i ? { ...c, ...parche } : c)), motivo);
  // Sola, la lista es su propia zona de arrastre (una tarea). Dentro de TareaEditor manda el de la tarea
  // entera; el de acá se llama igual (los hooks no se saltean) y no se usa.
  const propio = useArrastreCampos({
    grupos: [campos.map((c) => c.id)],
    onSoltar: (id, _g, i) => { const l = conCampoMovido(campos, id, 0, i); if (l) onCampos(l, 'movido'); },
    deshabilitado,
  });
  const arr = arrastre ?? propio;
  /** Qué tarea es ésta en el arrastre (sola, la única). */
  const g = arrastre ? grupo ?? 0 : 0;
  const comunidad = useOpcionesComunidad(campos.some((c) => c.tipo === 'publicar' || c.tipo === 'comentar'), cargarComunidad);

  // «+ Nuevo campo» (item 5): el campo nace ABAJO del último, con el foco en su pregunta (que lo trae a la
  // vista: `Pregunta`).
  const nuevo = () => {
    const id = nuevoId ? nuevoId() : nuevoIdCampo(campos);
    onCampos([...campos, campoNuevo(id)], 'nuevo');
    pedirFoco(id);
  };

  return (
    <div className={`ec-lista${arrastre ? '' : ' ec'}`} {...(arrastre ? {} : { ...arr.zona, ...arr.grupo(0) })}>
      {/* «+ Nuevo campo» PRIMERO y grande (item 8 de la mañana), como «+ Nueva clase». El campo, abajo. */}
      <button type="button" className="ec-nuevo" data-recorrido="leccion-nuevo-campo" disabled={deshabilitado} onClick={nuevo}>
        + Nuevo campo
      </button>

      {campos.map((c, i) => {
        const motivo = motivoVisible(errores, c.id, silenciados);
        return (
          <Fragment key={c.id}>
            {arr.huecoEn(g, i) && <div className="ec-hueco" style={{ height: arr.alto }} aria-hidden />}
            <div className={`ec-campo${arr.mano === c.id ? ' is-agarrado' : ''}${motivo ? ' ec-campo--error' : ''}`} data-arr-campo={c.id}
              data-recorrido={i === 0 ? 'leccion-campo' : undefined} data-error={motivo ? '' : undefined}
              draggable={!deshabilitado || undefined}
              onPointerDownCapture={arr.marcarOrigen}
              onDragStart={(e) => arr.agarrar(e, c.id)}
              onDragEnd={arr.terminar}>
              <div className="ec-cab">
                <span className="ec-asa" aria-hidden title="Arrastra para moverlo">{'⠇⠇'}</span>
                {/* El tipo con su ícono y qué hace el alumno (item 10). Se ve desde que nace el campo. */}
                <span className="ec-tipo">
                  <Select value={c.tipo} width={236} ariaLabel="Tipo de campo" disabled={deshabilitado} options={OPCIONES_TIPO}
                    onChange={(v) => {
                      // Otro tipo arranca con SUS defaults: lo propio del anterior se pierde. Con algo escrito,
                      // avisa para el «Deshacer» (item 18).
                      const n = conTipo(c, v as Campo['tipo']);
                      onCampos(campos.map((x, j) => (j === i ? n : x)), pierdeAlCambiarTipo(c, n) ? 'tipo' : undefined);
                    }} />
                </span>
                <span className="ec-cab-acc">
                  <IconButton small title="Subir" disabled={deshabilitado || i === 0} onClick={() => onCampos(moverEnLista(campos, i, 'arriba'), 'movido')}>↑</IconButton>
                  <IconButton small title="Bajar" disabled={deshabilitado || i === campos.length - 1} onClick={() => onCampos(moverEnLista(campos, i, 'abajo'), 'movido')}>↓</IconButton>
                  <IconButton small danger title="Borrar campo" disabled={deshabilitado} onClick={() => onCampos(campos.filter((_, j) => j !== i), 'borrado')}>✕</IconButton>
                </span>
              </div>

              {/* LA PREGUNTA ES EL TÍTULO (item 5 de la mañana): un campo sin caja, arriba del cuadro del alumno. */}
              <Pregunta valor={c.label} n={i + 1} tipo={c.tipo} deshabilitado={deshabilitado} enfocar={enfocar === c.id} error={!!motivo}
                onEnfocado={() => pedirFoco(null)} onSalir={() => onSalirDePregunta?.(c.id)} onCambio={(label) => cambiar(i, { label })} />
              {/* Lo que falta, en rojo y debajo de la pregunta (item 2): «falta completar la pregunta». */}
              {motivo && <p className="ec-motivo" role="alert">{motivo}</p>}
              <input className="ec-ayuda" value={c.ayuda ?? ''} placeholder="Ayuda (opcional)" aria-label={`Ayuda del campo ${i + 1}`}
                disabled={deshabilitado} onChange={(e) => cambiar(i, { ayuda: e.target.value })} />

              <div className="ec-cuerpo">
                {/* El CUADRO del alumno, con su texto de ejemplo (opcional). */}
                {conTextoDeEjemplo(c.tipo) && (
                  <label className={`ec-caja${c.tipo === 'texto' ? ' ec-caja--larga' : ''}`}>
                    <span className="ec-caja-rot">Texto de ejemplo</span>
                    <input className="ec-caja-in" value={c.placeholder ?? ''} maxLength={TOPE_TEXTO_EJEMPLO}
                      placeholder={c.tipo === 'link' ? 'https://' : 'Opcional'} aria-label={`Texto de ejemplo del campo ${i + 1}`}
                      disabled={deshabilitado} onChange={(e) => cambiar(i, { placeholder: e.target.value })} />
                  </label>
                )}

                {/* Las opciones COMO OPCIONES (item 8): un renglón cada una, con su círculo o su casilla. */}
                {(c.tipo === 'eleccion' || c.tipo === 'checks' || c.tipo === 'checklist') && (
                  <ListaDeOpciones filas={c.opciones} marca={c.tipo === 'eleccion' ? 'circulo' : 'casilla'} tope={TOPE_OPCIONES}
                    etiqueta={c.tipo === 'checklist' ? 'Acción' : 'Opción'} deshabilitado={deshabilitado}
                    onCambio={(opciones) => cambiar(i, { opciones })} />
                )}

                {c.tipo === 'tabla' && (
                  <div className="ec-tabla">
                    <div>
                      <span className="ec-mini">Columnas</span>
                      <ListaDeOpciones filas={c.columnas} marca="ninguna" tope={TOPE_COLUMNAS} etiqueta="Columna" deshabilitado={deshabilitado}
                        onCambio={(columnas) => cambiar(i, { columnas })} />
                    </div>
                    <div>
                      <span className="ec-mini">Filas fijas (opcional)</span>
                      <ListaDeOpciones filas={c.filasFijas} marca="ninguna" tope={TOPE_FILAS} etiqueta="Fila" deshabilitado={deshabilitado}
                        onCambio={(filasFijas) => cambiar(i, { filasFijas })} />
                    </div>
                    <div className="ec-par">
                      <span className="ec-mini">Mínimo de filas</span>
                      <Input type="number" min={0} max={40} value={c.filasMin ?? ''} placeholder="—" aria-label="Mínimo de filas"
                        disabled={deshabilitado} style={{ width: 90 }}
                        onChange={(e) => cambiar(i, { filasMin: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    </div>
                  </div>
                )}

                {c.tipo === 'archivo' && (
                  <div className="ec-par">
                    <span className="ec-previa-boton" aria-hidden>⇪ Subir archivo</span>
                    <Select value={String(c.maxArchivos ?? 1)} width={150} ariaLabel="Cuántos archivos" disabled={deshabilitado}
                      options={OPCIONES_ARCHIVOS} onChange={(v) => cambiar(i, { maxArchivos: Number(v) })} />
                  </div>
                )}

                {(c.tipo === 'audio' || c.tipo === 'video') && (
                  <div className="ec-par">
                    <span className="ec-previa-boton" aria-hidden>● Grabar {c.tipo === 'audio' ? 'audio' : 'video'}</span>
                    <span className="ec-mini">Duración máx.</span>
                    <Select value={String(c.maxSeg ?? MAX_SEG_DEFAULT)} width={130} ariaLabel="Duración máxima" disabled={deshabilitado}
                      options={OPCIONES_SEG} onChange={(v) => cambiar(i, { maxSeg: Number(v) })} />
                  </div>
                )}

                {c.tipo === 'escala' && (
                  <EditorEscala escala={c.escala ?? { min: 1, max: 10, bajo: '', alto: '' }} deshabilitado={deshabilitado}
                    onCambio={(escala) => cambiar(i, { escala })} />
                )}

                {c.tipo === 'agenda' && (
                  <div className="ec-agenda">
                    {/* `text` y no `url` (item 15, 24:30): también vale pegar el CÓDIGO de la agenda (`urlDeAgenda`, lib/curso.ts). */}
                    <Input type="text" inputMode="url" value={c.url ?? ''} placeholder="Link o código de tu agenda" aria-label="Link para agendar"
                      disabled={deshabilitado} onChange={(e) => cambiar(i, { url: e.target.value })} />
                    <span className="ec-previa-marca" aria-hidden><span className="ec-op-marca ec-op-marca--casilla" /> Ya agendé</span>
                  </div>
                )}

                {/* «Lo hice» no se entendía (item 10): el alumno ve un BOTÓN, «Marcar como hecho» (TareaAlumno), y eso
                    es lo que se dibuja acá. Hasta la revisión final del 08/10/2026 esto dibujaba una casilla «Lo hice». */}
                {c.tipo === 'confirmacion' && (
                  <span className="ec-previa-boton" aria-hidden>✓ Marcar como hecho</span>
                )}

                {c.tipo === 'quiz' && (
                  <EditorQuiz campo={c} deshabilitado={deshabilitado} onCambio={(parche, motivo) => cambiar(i, parche, motivo)} />
                )}

                {/* La comunidad (item 17): dónde cae el post, o qué post se comenta. */}
                {c.tipo === 'publicar' && (
                  <div className="ec-par">
                    <span className="ec-mini">Categoría</span>
                    <Select value={c.categoriaId ? String(c.categoriaId) : ''} width={240} ariaLabel="Categoría del post" disabled={deshabilitado}
                      options={opcionesDeCategoria(comunidad, c.categoriaId)}
                      onChange={(v) => cambiar(i, { categoriaId: v ? Number(v) : undefined })} />
                  </div>
                )}
                {c.tipo === 'comentar' && (
                  <div className="ec-par">
                    <span className="ec-mini">Post</span>
                    <Select value={c.postId ? String(c.postId) : ''} width={280} ariaLabel="Post a comentar" disabled={deshabilitado}
                      options={opcionesDePost(comunidad, c.postId, c.postTitulo)}
                      onChange={(v) => {
                        const post = comunidad?.posts.find((p) => String(p.id) === v);
                        cambiar(i, { postId: post?.id, postTitulo: post?.titulo });
                      }} />
                  </div>
                )}
              </div>

              <div className="ec-pie">
                <Checkbox checked={c.obligatorio === true || c.tipo === 'quiz'} disabled={deshabilitado || c.tipo === 'quiz'} label="Obligatorio"
                  onChange={(v) => cambiar(i, { obligatorio: v || undefined })} />
              </div>
            </div>
          </Fragment>
        );
      })}
      {arr.huecoEn(g, campos.length) && <div className="ec-hueco" style={{ height: arr.alto }} aria-hidden />}

      {!arrastre && <style href="ec-tarea" precedence="medium">{CSS_TAREA}</style>}
    </div>
  );
}

/**
 * La PREGUNTA de un campo, como título. Un `<textarea>` de una línea que crece: una pregunta larga se lee
 * entera y Enter no la parte en dos. Sin caja: es un título, no un cuadro para contestar.
 *
 * Al nacer el campo (`enfocar`), toma el foco y se trae a la vista: el campo nuevo nace ABAJO del último
 * (item 5), y con veinte campos quedaba fuera de la pantalla.
 */
function Pregunta({ valor, n, tipo, deshabilitado, enfocar, error, onEnfocado, onSalir, onCambio }: {
  valor: string; n: number; tipo: Campo['tipo']; deshabilitado?: boolean; enfocar: boolean; error: boolean;
  onEnfocado: () => void; onSalir: () => void; onCambio: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // El alto sigue al texto (sin scroll adentro de un título).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [valor]);
  useEffect(() => {
    if (!enfocar) return;
    const el = ref.current;
    el?.focus({ preventScroll: true });
    el?.closest('.ec-campo')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    onEnfocado();
  }, [enfocar, onEnfocado]);
  return (
    <textarea ref={ref} className="ec-pregunta" rows={1} value={valor} disabled={deshabilitado} maxLength={TOPE_PREGUNTA} aria-invalid={error || undefined}
      placeholder={tipo === 'confirmacion' ? 'Qué tiene que hacer' : tipo === 'publicar' ? 'Qué tiene que publicar' : tipo === 'comentar' ? 'Qué tiene que comentar' : 'Escribe la pregunta'}
      aria-label={`Pregunta del campo ${n}`}
      onBlur={onSalir}
      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
      onChange={(e) => onCambio(e.target.value.replace(/\n/g, ' '))} />
  );
}

/** El nombre del grupo de renglones, para un lector de pantalla. */
const PLURAL: Record<string, string> = { 'Opción': 'Opciones', 'Acción': 'Acciones', 'Columna': 'Columnas', 'Fila': 'Filas fijas' };

/** Qué cambió en una lista de opciones, para quien lleva algo atado a sus textos (las correctas de un quiz). */
export type GestoOpciones = { tipo: 'renombrar' | 'nueva' | 'quitar' | 'pegar'; i: number; antes: string[] };

/**
 * Las opciones COMO OPCIONES (item 8), como Google Forms: un renglón por opción, con su círculo (una
 * opción) o su casilla (varias, checklist); «+ Agregar opción»; la ✕ que la quita; Enter agrega la
 * siguiente y la enfoca; borrar un renglón vacío vuelve al de arriba; pegar varias líneas, una por opción.
 *
 * En el quiz, el círculo es un BOTÓN: tocarlo marca la correcta (`correctas` + `onMarcar`).
 */
function ListaDeOpciones({ filas: lista, marca, etiqueta, tope, deshabilitado, onCambio, correctas, multiple, onMarcar, nombre }: {
  filas: string[] | undefined;
  marca: 'circulo' | 'casilla' | 'ninguna';
  etiqueta: string;
  tope: number;
  deshabilitado?: boolean;
  onCambio: (lista: string[], gesto: GestoOpciones) => void;
  /** Quiz: las correctas (por texto) y el círculo que las marca. */
  correctas?: readonly string[];
  multiple?: boolean;
  onMarcar?: (texto: string) => void;
  /** El nombre accesible del grupo (la pregunta del quiz, o la etiqueta). */
  nombre?: string;
}) {
  const filas = filasDe(lista);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const foco = useRef<{ i: number; alFinal?: boolean } | null>(null);
  // El foco va DESPUÉS del render que dibujó el renglón nuevo.
  useEffect(() => {
    const f = foco.current;
    if (!f) return;
    foco.current = null;
    const el = refs.current[f.i];
    if (!el) return;
    el.focus();
    if (f.alFinal) el.setSelectionRange(el.value.length, el.value.length);
  });
  const antes = lista ?? [];
  const mandar = (nueva: string[], g: Omit<GestoOpciones, 'antes'>) => onCambio(nueva, { ...g, antes });
  const minus = etiqueta.toLowerCase();
  const plural = PLURAL[etiqueta] ?? etiqueta;

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>, k: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const n = conFilaNueva(lista, k, tope);
      if (!n) return;
      foco.current = { i: k + 1 };
      mandar(n, { tipo: 'nueva', i: k + 1 });
    } else if (e.key === 'Backspace' && filas[k] === '' && filas.length > 1) {
      e.preventDefault();
      foco.current = { i: Math.max(0, k - 1), alFinal: true };
      mandar(sinFila(lista, k), { tipo: 'quitar', i: k });
    } else if (e.key === 'ArrowDown' && k < filas.length - 1) {
      e.preventDefault();
      refs.current[k + 1]?.focus();
    } else if (e.key === 'ArrowUp' && k > 0) {
      e.preventDefault();
      refs.current[k - 1]?.focus();
    }
  };
  const alPegar = (e: ClipboardEvent<HTMLInputElement>, k: number) => {
    const texto = e.clipboardData.getData('text/plain');
    const el = e.currentTarget;
    const r = conPegado(lista, k, el.value.slice(0, el.selectionStart ?? el.value.length), el.value.slice(el.selectionEnd ?? el.value.length), texto, tope);
    if (!r) return;
    e.preventDefault();
    foco.current = { i: r.foco, alFinal: true };
    mandar(r.lista, { tipo: 'pegar', i: k });
  };

  return (
    <div className="ec-ops" role="group" aria-label={nombre ?? plural}>
      {filas.map((f, k) => {
        const correcta = !!correctas && !!f.trim() && correctas.includes(f.trim());
        return (
          <div key={k} className={`ec-op${correcta ? ' is-correcta' : ''}`}>
            {onMarcar ? (
              <button type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={correcta}
                className={`ec-op-marca ec-op-marca--${multiple ? 'casilla' : 'circulo'}${correcta ? ' is-on' : ''}`}
                title={correcta ? 'Es la correcta' : 'Marcar como correcta'} aria-label={`Correcta: ${f.trim() || `${etiqueta} ${k + 1}`}`}
                disabled={deshabilitado || !f.trim()} onClick={() => onMarcar(f)}>
                {correcta ? '✓' : ''}
              </button>
            ) : marca !== 'ninguna' ? (
              <span className={`ec-op-marca ec-op-marca--${marca}`} aria-hidden />
            ) : (
              <span className="ec-op-n" aria-hidden>{k + 1}</span>
            )}
            <input ref={(el) => { refs.current[k] = el; }} className="ec-op-in" value={f} placeholder={`${etiqueta} ${k + 1}`}
              aria-label={`${etiqueta} ${k + 1}`} disabled={deshabilitado}
              onChange={(e) => mandar(conFila(lista, k, e.target.value), { tipo: 'renombrar', i: k })}
              onKeyDown={(e) => alTeclear(e, k)} onPaste={(e) => alPegar(e, k)} />
            <button type="button" className="ec-op-x" title={`Quitar ${minus} ${k + 1}`} aria-label={`Quitar ${minus} ${k + 1}`}
              disabled={deshabilitado || (filas.length === 1 && !f)}
              onClick={() => { foco.current = { i: Math.max(0, Math.min(k, filas.length - 2)) }; mandar(sinFila(lista, k), { tipo: 'quitar', i: k }); }}>✕</button>
          </div>
        );
      })}
      {filas.length < tope && (
        <button type="button" className="ec-op-mas" disabled={deshabilitado}
          onClick={() => {
            const n = conFilaNueva(lista, filas.length - 1, tope);
            if (!n) return;
            foco.current = { i: filas.length };
            mandar(n, { tipo: 'nueva', i: filas.length });
          }}>
          + Agregar {minus}
        </button>
      )}
    </div>
  );
}

/**
 * La escala (item 9): se edita sobre su VISTA PREVIA, con el estilo elegido. «Mostrar como» Números,
 * Deslizador o Estrellas (`Escala.estilo`); el rango; y qué quiere decir cada punta, debajo de cada punta
 * (los dos extremos son obligatorios: «una escala sin extremos explicados es una pregunta muerta»).
 */
function EditorEscala({ escala: e, deshabilitado, onCambio }: { escala: Escala; deshabilitado?: boolean; onCambio: (e: Escala) => void }) {
  const estilo = estiloDe(e);
  const nums = Array.from({ length: e.max - e.min + 1 }, (_, k) => e.min + k);
  return (
    <div className="ec-esc">
      <div className="ec-esc-fila">
        <span className="ec-mini">Mostrar como</span>
        <span className="ec-segm" role="radiogroup" aria-label="Mostrar como">
          {OPCIONES_ESTILO_ESCALA.map((s) => (
            <button key={s.value} type="button" role="radio" aria-checked={estilo === s.value} disabled={deshabilitado}
              className={`ec-segm-op${estilo === s.value ? ' is-on' : ''}`} onClick={() => onCambio(conEstilo(e, s.value))}>
              {s.label}
            </button>
          ))}
        </span>
        <Select value={`${e.min}-${e.max}`} width={150} ariaLabel="Rango" disabled={deshabilitado} options={rangosDeEscala(estilo)}
          onChange={(v) => {
            const [min, max] = v.split('-').map(Number);
            onCambio({ ...e, min: min === 0 ? 0 : 1, max: max === 5 ? 5 : 10 });
          }} />
      </div>
      <div className={`ec-esc-previa ec-esc-previa--${estilo}`} aria-hidden>
        {estilo === 'numeros' && nums.map((n) => <span key={n} className="ec-esc-num">{n}</span>)}
        {estilo === 'deslizador' && (
          <span className="ec-esc-barra"><span className="ec-esc-perilla" /></span>
        )}
        {estilo === 'estrellas' && Array.from({ length: e.max }, (_, k) => <span key={k} className="ec-esc-estrella">★</span>)}
      </div>
      <div className="ec-esc-ext">
        <input className="ec-esc-in" value={e.bajo} placeholder={`Qué es el ${e.min}`} aria-label="Extremo bajo" disabled={deshabilitado}
          onChange={(ev) => onCambio({ ...e, bajo: ev.target.value })} />
        <input className="ec-esc-in ec-esc-in--alto" value={e.alto} placeholder={`Qué es el ${e.max}`} aria-label="Extremo alto" disabled={deshabilitado}
          onChange={(ev) => onCambio({ ...e, alto: ev.target.value })} />
      </div>
    </div>
  );
}

/**
 * Las preguntas de un quiz: cada una con sus opciones COMO OPCIONES (item 8) y la correcta marcada tocando
 * su círculo; abajo la nota mínima y los intentos. Una pregunta de UNA respuesta marca como un radio.
 */
function EditorQuiz({ campo, deshabilitado, onCambio }: {
  campo: Campo; deshabilitado?: boolean; onCambio: (parche: Partial<Campo>, motivo?: MotivoCampos) => void;
}) {
  const ps = campo.preguntas ?? [];
  const setP = (j: number, parche: Partial<PreguntaQuiz>) =>
    onCambio({ preguntas: ps.map((p, k) => (k === j ? { ...p, ...parche } : p)) });

  return (
    <div className="ec-quiz">
      {ps.map((p, j) => {
        const multiple = p.multiple === true;
        return (
          <div key={p.id} className="ec-preg">
            <div className="ec-fila">
              <span className="ec-n">{j + 1}</span>
              <input className="ec-preg-in" value={p.texto} placeholder="La pregunta del quiz" aria-label={`Pregunta ${j + 1} del quiz`} disabled={deshabilitado}
                onChange={(e) => setP(j, { texto: e.target.value })} />
              <IconButton small danger title="Quitar pregunta" disabled={deshabilitado || ps.length === 1}
                onClick={() => onCambio({ preguntas: ps.filter((_, k) => k !== j) }, tieneContenido(p) ? 'pregunta' : undefined)}>✕</IconButton>
            </div>
            <ListaDeOpciones filas={p.opciones} marca={multiple ? 'casilla' : 'circulo'} etiqueta="Opción" tope={MAX_OPCIONES_QUIZ}
              deshabilitado={deshabilitado} nombre={`Opciones de la pregunta ${j + 1}`}
              correctas={p.correctas ?? []} multiple={multiple}
              onMarcar={(texto) => setP(j, { correctas: correctasAlMarcar(p.correctas, texto, multiple) })}
              onCambio={(opciones, g) => setP(j, {
                opciones,
                correctas: g.tipo === 'renombrar' ? correctasTrasRenombrar(p.correctas, g.antes, g.i, opciones[g.i] ?? '')
                  : g.tipo === 'quitar' ? correctasTrasQuitar(p.correctas, g.antes, g.i)
                  : [...(p.correctas ?? [])],
              })} />
            <Checkbox checked={multiple} disabled={deshabilitado} label="Varias correctas"
              onChange={(v) => setP(j, { multiple: v || undefined, correctas: v ? p.correctas ?? [] : (p.correctas ?? []).slice(0, 1) })} />
          </div>
        );
      })}
      <div>
        <Button size="sm" variant="tertiary" disabled={deshabilitado}
          onClick={() => onCambio({ preguntas: [...ps, preguntaNueva(ps)] })}>
          + Pregunta
        </Button>
      </div>
      <div className="ec-quiz-pie">
        <div className="ec-par">
          <span className="ec-mini">Nota mínima</span>
          <Select value={String(campo.notaMin ?? NOTA_MIN_DEFAULT)} width={110} ariaLabel="Nota mínima" disabled={deshabilitado}
            options={OPCIONES_NOTA} onChange={(v) => onCambio({ notaMin: Number(v) })} />
        </div>
        <div className="ec-par">
          <span className="ec-mini">Intentos</span>
          <Select value={String(campo.intentos ?? 0)} width={130} ariaLabel="Intentos" disabled={deshabilitado}
            options={OPCIONES_INTENTOS} onChange={(v) => onCambio({ intentos: Number(v) })} />
        </div>
      </div>
    </div>
  );
}

// Los colores son los del CURSO (`--u-*`, la hoja del dibujo de Conocimientos), con el de la app de
// respaldo: la tarea vive adentro de la lección (`.ahdoc`), cuya hoja deja sin fondo ni borde a todo
// `button` y en cero el relleno de todo. Por eso los selectores llevan dos clases (`.ec .ec-x`): con una
// sola, el reset del curso les gana. La lista sola lleva `.ec` ella misma; dentro de la tarea entera
// (./TareaEditor.tsx), `.ec` es la tarea y las reglas valen igual — y la copia del arrastre, que cuelga
// de la zona (`.ec`), sale vestida.
// La letra de los controles es la del curso (`--ugc-fuente`, app/_cursos/estilos.ts): «la vista previa un
// poco más esthetic» (item 8) son tarjetas limpias, la pregunta como título y los controles con la letra
// de lo que ve el alumno.
// ⚠️ Es un template literal: adentro no va ningún acento grave ni la secuencia de interpolación, ni en un
//    comentario (AGENTS.md). Exportada: la monta también la tarea entera, con el mismo `href` (React 19 la
//    sube al head UNA vez).
export const CSS_TAREA = `
.ec .ec-lista, .ec.ec-lista { display:flex; flex-direction:column; gap:10px; min-width:0; }
.ec button.ec-nuevo{ display:flex; align-items:center; justify-content:center; width:100%; min-height:60px; cursor:pointer;
  border:2px dashed var(--u-ink-40, var(--border-strong)); border-radius:14px; background:transparent; color:var(--u-ink, var(--ink));
  font:700 13px/1 var(--font-jetbrains), monospace; }
.ec button.ec-nuevo:hover:not(:disabled){ border-color:var(--u-ink, var(--ink)); background:var(--u-card, var(--surface)); }
.ec button.ec-nuevo:disabled{ opacity:.5; cursor:default; }
.ec .ec-campo{ display:flex; flex-direction:column; gap:6px; padding:10px 14px 10px; min-width:0; cursor:grab;
  border:1.5px solid var(--u-line, var(--border)); border-radius:12px; background:var(--u-card, var(--surface));
  box-shadow:0 1px 2px rgba(22,21,15,.06); transition:border-color .12s, box-shadow .12s; }
.ec .ec-campo:hover{ border-color:var(--u-ink-40, var(--border-strong)); }
.ec .ec-campo:focus-within{ border-color:var(--u-ink, var(--ink)); box-shadow:0 4px 14px rgba(18,21,27,.08); }
.ec .ec-campo.is-agarrado{ border-color:var(--u-ink, var(--ink)); border-style:dashed; }
.ec .ec-campo.ec-campo--error{ border-color:#b3261e; box-shadow:0 0 0 1px #b3261e; }
.ec .ec-hueco{ border:2px dashed var(--u-ink-40, var(--border-strong)); border-radius:12px; background:var(--u-lime-a12, var(--primary-bg)); }
.ec .ec-cab{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; min-height:30px; }
.ec .ec-asa{ flex:none; color:var(--u-ink-60, var(--dim)); font-size:13px; letter-spacing:-3px; line-height:1; user-select:none; }
.ec .ec-tipo{ display:inline-flex; min-width:0; }
.ec .ec-cab-acc{ display:inline-flex; gap:2px; margin-left:auto; }
.ec .ec-pregunta{ display:block; width:100%; box-sizing:border-box; resize:none; overflow:hidden; cursor:text;
  margin:0; padding:2px 2px 3px; border:0; border-bottom:2px solid transparent; border-radius:0; background:transparent;
  color:var(--u-ink, var(--ink)); font-family:var(--ugc-fuente, inherit); font-size:15.5px; font-weight:700; line-height:1.35; }
.ec .ec-pregunta:hover:not(:disabled){ border-bottom-color:var(--u-ink-40, var(--border)); }
.ec .ec-pregunta:focus{ outline:none; border-bottom-color:var(--u-ink, var(--ink)); }
.ec .ec-pregunta::placeholder{ color:var(--u-ink-60, var(--faint)); font-weight:600; }
.ec .ec-motivo{ margin:0; font-size:12.5px; font-weight:700; color:#b3261e; }
.ec .ec-ayuda{ display:block; width:100%; box-sizing:border-box; cursor:text; margin:0; padding:1px 2px; border:0; background:transparent;
  color:var(--u-ink-60, var(--dim)); font-family:var(--ugc-fuente, inherit); font-size:13px; }
.ec .ec-ayuda:focus{ outline:none; color:var(--u-ink, var(--ink)); }
.ec .ec-cuerpo{ display:flex; flex-direction:column; gap:8px; cursor:default; }
.ec .ec-pie{ display:flex; justify-content:flex-end; cursor:default; }
.ec .ec-caja{ display:flex; flex-direction:column; gap:4px; padding:9px 12px; cursor:text;
  border:1.5px dashed var(--u-ink-40, var(--border-strong)); border-radius:10px; background:var(--u-paper, var(--surface)); }
.ec .ec-caja--larga{ min-height:64px; }
.ec .ec-caja-rot{ font:600 10px/1.2 var(--font-jetbrains), monospace; letter-spacing:.06em; text-transform:uppercase; color:var(--u-ink-60, var(--faint)); }
.ec .ec-caja-in{ width:100%; box-sizing:border-box; margin:0; padding:0; border:0; background:transparent; color:var(--u-ink-60, var(--dim)); font-family:var(--ugc-fuente, inherit); font-size:14px; }
.ec .ec-caja-in:focus{ outline:none; color:var(--u-ink, var(--ink)); }
/* El foco de los campos de texto: una linea o el borde de su cuadro, en vez del aro de 3 px que el curso le
   pone a todo input (.ahdoc .ugc input:focus-visible), que adentro de una tarjeta se leia como una caja
   dentro de otra. Tres clases para ganarle. */
.ec .ec-campo .ec-pregunta:focus-visible, .ec .ec-campo .ec-ayuda:focus-visible, .ec .ec-campo .ec-caja-in:focus-visible,
.ec .ec-campo .ec-op-in:focus-visible, .ec .ec-campo .ec-preg-in:focus-visible, .ec .ec-campo .ec-esc-in:focus-visible{ outline:none; }
.ec .ec-campo .ec-ayuda:focus{ box-shadow:inset 0 -1.5px 0 var(--u-ink, var(--ink)); }
.ec .ec-campo .ec-caja:focus-within{ border-style:solid; border-color:var(--u-ink, var(--ink)); }

/* Las opciones COMO OPCIONES (item 8): un renglon por opcion, con su circulo o su casilla. */
.ec .ec-ops{ display:flex; flex-direction:column; gap:0; min-width:0; }
.ec .ec-op{ display:flex; align-items:center; gap:10px; min-height:34px; }
.ec .ec-op-marca{ flex:none; display:inline-grid; place-items:center; width:18px; height:18px; box-sizing:border-box;
  border:2px solid var(--u-ink-40, var(--border-strong)); background:var(--u-card, var(--surface)); color:#fff; font:800 11px/1 system-ui, sans-serif; }
.ec .ec-op-marca--circulo{ border-radius:50%; }
.ec .ec-op-marca--casilla{ border-radius:4px; }
.ec button.ec-op-marca{ cursor:pointer; padding:0; border:2px solid var(--u-ink-40, var(--border-strong)); background:var(--u-card, var(--surface)); }
.ec button.ec-op-marca:hover:not(:disabled){ border-color:#1e8e3e; }
.ec button.ec-op-marca.is-on{ border-color:#1e8e3e; background:#1e8e3e; color:#fff; }
.ec button.ec-op-marca:disabled{ cursor:default; opacity:.55; }
.ec .ec-op-n{ flex:none; width:18px; text-align:center; font-size:12px; color:var(--u-ink-60, var(--dim)); font-variant-numeric:tabular-nums; }
.ec .ec-op-in{ flex:1 1 auto; min-width:0; box-sizing:border-box; margin:0; padding:6px 2px; border:0; border-bottom:1.5px solid transparent;
  border-radius:0; background:transparent; color:var(--u-ink, var(--ink)); font-family:var(--ugc-fuente, inherit); font-size:14.5px; }
.ec .ec-op-in:hover:not(:disabled){ border-bottom-color:var(--u-ink-40, var(--border)); }
.ec .ec-op-in:focus{ outline:none; border-bottom-color:var(--u-ink, var(--ink)); }
.ec .ec-op.is-correcta .ec-op-in{ font-weight:700; }
.ec button.ec-op-x{ flex:none; width:28px; height:28px; border-radius:7px; cursor:pointer; background:transparent; color:var(--u-ink-60, var(--dim)); font-size:13px; }
.ec button.ec-op-x:hover:not(:disabled){ background:#f6c9c1; color:var(--u-ink, var(--ink)); }
.ec button.ec-op-x:disabled{ visibility:hidden; }
@media (hover:hover){ .ec .ec-op:not(:hover):not(:focus-within) button.ec-op-x{ opacity:0; } }
.ec button.ec-op-mas{ align-self:flex-start; padding:6px 4px 6px 28px; cursor:pointer; background:transparent; color:var(--u-ink-60, var(--dim));
  font-family:var(--ugc-fuente, inherit); font-size:14px; font-weight:600; }
.ec button.ec-op-mas:hover:not(:disabled){ color:var(--u-ink, var(--ink)); }

/* Lo que ve el alumno y no se edita: un boton o una casilla de muestra. */
.ec .ec-previa-boton{ display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border-radius:9px;
  border:1.5px dashed var(--u-ink-40, var(--border-strong)); color:var(--u-ink-60, var(--dim)); font-size:13px; font-weight:600; }
.ec .ec-previa-marca{ display:inline-flex; align-items:center; gap:8px; color:var(--u-ink, var(--ink)); font-size:14px; }
.ec .ec-agenda{ display:flex; flex-direction:column; gap:8px; }

.ec .ec-fila{ display:flex; align-items:center; gap:6px; }
.ec .ec-n{ flex:none; width:20px; text-align:center; font-size:var(--fs-meta); color:var(--u-ink-60, var(--dim)); font-variant-numeric:tabular-nums; }
.ec .ec-tabla{ display:grid; grid-template-columns:1fr 1fr; gap:6px 18px; align-items:start; }
.ec .ec-tabla > .ec-par{ grid-column:1 / -1; }
.ec .ec-par{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ec .ec-mini{ font-size:var(--fs-meta, 12px); color:var(--u-ink-60, var(--dim)); }

/* La escala (item 9): Mostrar como, la vista previa en ese estilo y un extremo debajo de cada punta. */
.ec .ec-esc{ display:flex; flex-direction:column; gap:8px; }
.ec .ec-esc-fila{ display:flex; align-items:center; gap:8px 12px; flex-wrap:wrap; }
.ec .ec-segm{ display:inline-flex; padding:2px; border-radius:9px; background:var(--u-paper, var(--surface-2)); border:1px solid var(--u-ink-40, var(--border)); }
.ec button.ec-segm-op{ padding:5px 10px; border-radius:7px; cursor:pointer; background:transparent; color:var(--u-ink-60, var(--dim));
  font-family:var(--ugc-fuente, inherit); font-size:13px; font-weight:600; }
.ec button.ec-segm-op.is-on{ background:var(--u-card, var(--surface)); color:var(--u-ink, var(--ink)); box-shadow:0 1px 3px rgba(18,21,27,.14); }
.ec .ec-esc-previa{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; min-height:34px; }
.ec .ec-esc-num{ display:inline-grid; place-items:center; min-width:30px; height:30px; padding:0 6px; border-radius:8px;
  border:1.5px solid var(--u-ink-40, var(--border-strong)); font-size:13px; font-weight:700; color:var(--u-ink, var(--ink)); }
.ec .ec-esc-barra{ position:relative; flex:1 1 auto; height:6px; border-radius:6px; background:var(--u-ink-40, var(--border-strong)); }
.ec .ec-esc-perilla{ position:absolute; left:50%; top:50%; width:18px; height:18px; margin:-9px 0 0 -9px; border-radius:50%;
  background:var(--u-card, var(--surface)); border:2px solid var(--u-ink, var(--ink)); }
.ec .ec-esc-estrella{ font-size:22px; line-height:1; color:var(--u-ink-40, var(--border-strong)); }
.ec .ec-esc-ext{ display:flex; justify-content:space-between; gap:12px; }
.ec .ec-esc-in{ flex:0 1 46%; min-width:0; box-sizing:border-box; margin:0; padding:4px 2px; border:0; border-bottom:1.5px dashed var(--u-ink-40, var(--border));
  background:transparent; color:var(--u-ink, var(--ink)); font-family:var(--ugc-fuente, inherit); font-size:13px; }
.ec .ec-esc-in--alto{ text-align:right; }
.ec .ec-esc-in:focus{ outline:none; border-bottom-style:solid; border-bottom-color:var(--u-ink, var(--ink)); }

.ec .ec-quiz{ display:flex; flex-direction:column; gap:10px; }
.ec .ec-preg{ display:flex; flex-direction:column; gap:4px; padding:8px 10px; border:1px solid var(--u-ink-40, var(--border)); border-radius:10px; background:var(--u-paper, var(--surface)); }
.ec .ec-preg-in{ flex:1 1 auto; min-width:0; margin:0; padding:4px 2px; border:0; border-bottom:1.5px solid transparent; background:transparent;
  color:var(--u-ink, var(--ink)); font-family:var(--ugc-fuente, inherit); font-size:14.5px; font-weight:700; }
.ec .ec-preg-in:focus{ outline:none; border-bottom-color:var(--u-ink, var(--ink)); }
.ec .ec-quiz-pie{ display:flex; flex-wrap:wrap; gap:8px 18px; }
@media (max-width:640px){ .ec .ec-tabla{ grid-template-columns:1fr; } }
`;
