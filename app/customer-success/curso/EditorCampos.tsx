'use client';

// =============================================================================
// EditorCampos — el formulario de la tarea de una clase
// =============================================================================
// Pedido de Martín (06/10/2026): «los formularios con las tareas para los clientes que
// Mauricio me había pedido». El molde de cada campo es el del programa viejo (`Campo` en
// lib/curso.ts, los 114 campos de sus Cuestionarios Maestros): texto, línea, número, una
// opción, varias, o una tabla con columnas y filas fijas.
//
// #18 (07/10/2026), «piensa en qué otras tareas se podría pedir aparte de formularios»: nueve tipos
// más (`CampoTipo`), cada uno con lo suyo acá abajo — cuántos archivos, el tope de una grabación, los
// extremos de una escala, las preguntas de un quiz con su correcta, la nota mínima y los intentos, las
// acciones de una checklist y el link para agendar. Lo que hace falta para que un tipo se pueda
// guardar lo dice `faltaEnCampo` (./reglas.ts) al guardar; acá no se repite.
//
// LOS AJUSTES DEL 08/10/2026 (items 5, 6, 8 y 17), textuales:
//   · «No podés poner la pregunta dentro del cuadro de texto donde va a completar el alumno como si
//     fuera un placeholder, eso confunde... Tenés que poner arriba del cuadro del texto como título...
//     Y también agregar la opción de placeholder.» → cada campo es una TARJETA que se lee como lo ve el
//     alumno: la pregunta es el TÍTULO de la tarjeta (un campo grande sin caja), y debajo el CUADRO del
//     alumno, donde se escribe su texto de ejemplo (`placeholder`), opcional.
//   · «Una pregunta debería tener un contenedor y ese contenedor se debe poder arrastrar de la misma
//     manera que se arrastran las clases o los cursos» → la tarjeta se arrastra (./arrastre-campos.ts,
//     con las piezas del curso y del Plan) y las flechas quedan.
//   · «En lugar de un pequeño botón de "nuevo campo" como siempre, arriba del todo, un placeholder
//     grande que diga "Nuevo campo"» → el recuadro punteado PRIMERO, como «+ Nueva clase», y el campo
//     nace ARRIBA (donde se tocó) con el cursor en su pregunta.
//   · «Faltan opciones en las tareas para interactuar en la comunidad» → `publicar` (en qué categoría) y
//     `comentar` (qué post, o el último fijado), con lo que hay en la comunidad del producto.
//
// ⚠️ LAS LISTAS (opciones, columnas, filas) SE EDITAN UNA POR RENGLÓN y se guardan CRUDAS
// mientras se escribe: sin filtrar los renglones vacíos, porque filtrarlos en cada tecla se
// come el Enter y no hay forma de escribir la segunda opción. El saneo (`sanearCampos`) los
// limpia al guardar, en el server.
//
// ⚠️ EL ID DE UN CAMPO NO SE VE NI SE EDITA: las respuestas de los clientes se guardan por id
// (`curso_progreso.valores`), así que cambiar la pregunta no puede cambiar de quién son las
// respuestas. Ver `nuevoIdCampo`. Moverlo tampoco: lo que cambia es el orden de la lista.
//
// ⚠️ LA CORRECTA DE UNA PREGUNTA SE MARCA POR SU TEXTO (`PreguntaQuiz.correctas`, lib/curso.ts): al
// cambiar las opciones se desmarca la que ya no está, a la vista. Las correctas no salen de esta
// pantalla del equipo: al alumno le llegan los campos SIN ellas (`camposParaAlumno`).
//
// ⚠️ BORRAR Y MOVER AVISAN (`onCampos(lista, motivo)`): quien lo monta ofrece «Deshacer» (item 18). Acá
//    no hay toast: el aviso es de la pantalla, afuera del curso.

import { Fragment, useEffect, useRef, useState } from 'react';
import type { Campo, PreguntaQuiz } from '@/lib/curso';
import { MAX_ARCHIVOS, NOTA_MIN_DEFAULT, MAX_SEG_DEFAULT, TOPE_TEXTO_EJEMPLO, conTextoDeEjemplo } from '@/lib/curso';
import { Button, IconButton, Input, Textarea, Select, Checkbox } from '@/app/_ui';
import { TIPOS_CAMPO, moverEnLista, nuevoIdCampo } from './reglas';
import { useArrastreCampos } from './arrastre-campos';
import {
  camposEnOrden, campoNuevoArriba, opcionesDeCategoria, opcionesDePost, pierdeAlCambiarTipo, tieneContenido, type OpcionesComunidad,
} from './leccion-reglas';

const lineas = (v: string[] | undefined) => (v ?? []).join('\n');
const aLista = (s: string) => s.split('\n');
/** Las opciones que ya se escribieron (sin renglones vacíos ni repetidas): las que se pueden marcar. */
const llenas = (v: string[] | undefined) => [...new Set((v ?? []).map((s) => s.trim()).filter(Boolean))];

const preguntaNueva = (existentes: readonly PreguntaQuiz[]): PreguntaQuiz =>
  ({ id: nuevoIdCampo(existentes), texto: '', opciones: [], correctas: [] });

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

const OPCIONES_ARCHIVOS = Array.from({ length: MAX_ARCHIVOS }, (_, i) => i + 1)
  .map((n) => ({ value: String(n), label: n === 1 ? '1 archivo' : `Hasta ${n}` }));
const OPCIONES_SEG = [30, 60, 120, 180, 300, 600]
  .map((s) => ({ value: String(s), label: s < 60 ? `${s} s` : `${s / 60} min` }));
const OPCIONES_RANGO = [
  { value: '1-10', label: '1 a 10' },
  { value: '0-10', label: '0 a 10 (NPS)' },
  { value: '1-5', label: '1 a 5' },
];
const OPCIONES_NOTA = [50, 60, 70, 80, 90, 100].map((n) => ({ value: String(n), label: `${n} %` }));
const OPCIONES_INTENTOS = [0, 1, 2, 3, 5, 10].map((n) => ({ value: String(n), label: n === 0 ? 'Sin límite' : String(n) }));

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

export function EditorCampos({ campos, onCampos, deshabilitado, cargarComunidad }: {
  campos: Campo[];
  /** La lista nueva. `motivo` cuando hay algo que deshacer (borrar, mover) o que enfocar (nuevo). */
  onCampos: (c: Campo[], motivo?: MotivoCampos) => void;
  deshabilitado?: boolean;
  /** Las categorías y los posts de la comunidad del producto (para «Publicar» y «Comentar»). */
  cargarComunidad?: () => Promise<OpcionesComunidad | null>;
}) {
  /** El campo recién creado: su pregunta toma el foco una vez. */
  const [enfocar, setEnfocar] = useState<string | null>(null);
  const cambiar = (i: number, parche: Partial<Campo>, motivo?: MotivoCampos) =>
    onCampos(campos.map((c, j) => (j === i ? { ...c, ...parche } : c)), motivo);
  const arr = useArrastreCampos({
    ids: campos.map((c) => c.id),
    onOrden: (ids) => onCampos(camposEnOrden(campos, ids), 'movido'),
    deshabilitado,
  });
  const comunidad = useOpcionesComunidad(campos.some((c) => c.tipo === 'publicar' || c.tipo === 'comentar'), cargarComunidad);

  const nuevo = () => {
    const lista = campoNuevoArriba(campos, nuevoIdCampo(campos));
    onCampos(lista, 'nuevo');
    setEnfocar(lista[0].id);
  };

  return (
    <div className="ec" {...arr.zona}>
      {/* «+ Nuevo campo» PRIMERO y grande (item 8), como «+ Nueva clase»: el campo nace arriba. */}
      <button type="button" className="ec-nuevo" data-recorrido="leccion-nuevo-campo" disabled={deshabilitado} onClick={nuevo}>
        + Nuevo campo
      </button>

      {campos.map((c, i) => (
        <Fragment key={c.id}>
          {arr.huecoEn(i) && <div className="ec-hueco" style={{ height: arr.alto }} aria-hidden />}
          <div className={`ec-campo${arr.mano === c.id ? ' is-agarrado' : ''}`} data-arr-campo={c.id}
            data-recorrido={i === 0 ? 'leccion-campo' : undefined}
            draggable={!deshabilitado || undefined}
            onPointerDownCapture={arr.marcarOrigen}
            onDragStart={(e) => arr.agarrar(e, c.id)}
            onDragEnd={arr.terminar}>
            <div className="ec-cab">
              <span className="ec-asa" aria-hidden title="Arrastra para moverlo">{'⠇⠇'}</span>
              <span className="ec-n">{i + 1}</span>
              <Select value={c.tipo} width={230} ariaLabel="Tipo de campo" disabled={deshabilitado}
                options={TIPOS_CAMPO.map((t) => ({ value: t.value, label: t.label }))}
                onChange={(v) => {
                  // Otro tipo arranca con SUS defaults: lo propio del anterior se pierde. Con algo escrito,
                  // avisa para el «Deshacer» (item 18).
                  const n = conTipo(c, v as Campo['tipo']);
                  onCampos(campos.map((x, j) => (j === i ? n : x)), pierdeAlCambiarTipo(c, n) ? 'tipo' : undefined);
                }} />
              <span className="ec-cab-acc">
                <IconButton small title="Subir" disabled={deshabilitado || i === 0} onClick={() => onCampos(moverEnLista(campos, i, 'arriba'), 'movido')}>↑</IconButton>
                <IconButton small title="Bajar" disabled={deshabilitado || i === campos.length - 1} onClick={() => onCampos(moverEnLista(campos, i, 'abajo'), 'movido')}>↓</IconButton>
                <IconButton small danger title="Borrar campo" disabled={deshabilitado} onClick={() => onCampos(campos.filter((_, j) => j !== i), 'borrado')}>✕</IconButton>
              </span>
            </div>

            {/* LA PREGUNTA ES EL TÍTULO (item 5): un campo sin caja, grande, arriba del cuadro del alumno. */}
            <Pregunta valor={c.label} n={i + 1} tipo={c.tipo} deshabilitado={deshabilitado} enfocar={enfocar === c.id}
              onEnfocado={() => setEnfocar(null)} onCambio={(label) => cambiar(i, { label })} />
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

              {(c.tipo === 'eleccion' || c.tipo === 'checks') && (
                <Textarea rows={3} value={lineas(c.opciones)} placeholder="Una opción por renglón" aria-label="Opciones"
                  disabled={deshabilitado} onChange={(e) => cambiar(i, { opciones: aLista(e.target.value) })} />
              )}

              {c.tipo === 'checklist' && (
                <Textarea rows={3} value={lineas(c.opciones)} placeholder="Una acción por renglón" aria-label="Acciones"
                  disabled={deshabilitado} onChange={(e) => cambiar(i, { opciones: aLista(e.target.value) })} />
              )}

              {c.tipo === 'tabla' && (
                <div className="ec-tabla">
                  <Textarea rows={3} value={lineas(c.columnas)} placeholder="Columnas, una por renglón" aria-label="Columnas"
                    disabled={deshabilitado} onChange={(e) => cambiar(i, { columnas: aLista(e.target.value) })} />
                  <Textarea rows={3} value={lineas(c.filasFijas)} placeholder="Filas fijas (opcional)" aria-label="Filas fijas"
                    disabled={deshabilitado} onChange={(e) => cambiar(i, { filasFijas: aLista(e.target.value) })} />
                  <Input type="number" min={0} max={40} value={c.filasMin ?? ''} placeholder="Mín. filas" aria-label="Mínimo de filas"
                    disabled={deshabilitado}
                    onChange={(e) => cambiar(i, { filasMin: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
              )}

              {c.tipo === 'archivo' && (
                <div className="ec-par">
                  <span className="ec-mini">Archivos</span>
                  <Select value={String(c.maxArchivos ?? 1)} width={150} ariaLabel="Cuántos archivos" disabled={deshabilitado}
                    options={OPCIONES_ARCHIVOS} onChange={(v) => cambiar(i, { maxArchivos: Number(v) })} />
                </div>
              )}

              {(c.tipo === 'audio' || c.tipo === 'video') && (
                <div className="ec-par">
                  <span className="ec-mini">Duración máx.</span>
                  <Select value={String(c.maxSeg ?? MAX_SEG_DEFAULT)} width={150} ariaLabel="Duración máxima" disabled={deshabilitado}
                    options={OPCIONES_SEG} onChange={(v) => cambiar(i, { maxSeg: Number(v) })} />
                </div>
              )}

              {c.tipo === 'escala' && (() => {
                const e = c.escala ?? { min: 1, max: 10, bajo: '', alto: '' };
                return (
                  <div className="ec-escala">
                    <Select value={`${e.min}-${e.max}`} width={150} ariaLabel="Rango" disabled={deshabilitado} options={OPCIONES_RANGO}
                      onChange={(v) => {
                        const [min, max] = v.split('-').map(Number);
                        cambiar(i, { escala: { ...e, min: min === 0 ? 0 : 1, max: max === 5 ? 5 : 10 } });
                      }} />
                    <Input value={e.bajo} placeholder={`Qué es el ${e.min}`} aria-label="Extremo bajo" disabled={deshabilitado}
                      onChange={(ev) => cambiar(i, { escala: { ...e, bajo: ev.target.value } })} />
                    <Input value={e.alto} placeholder={`Qué es el ${e.max}`} aria-label="Extremo alto" disabled={deshabilitado}
                      onChange={(ev) => cambiar(i, { escala: { ...e, alto: ev.target.value } })} />
                  </div>
                );
              })()}

              {c.tipo === 'agenda' && (
                <Input type="url" value={c.url ?? ''} placeholder="Link para agendar (Calendly, Cal…)" aria-label="Link para agendar"
                  disabled={deshabilitado} onChange={(e) => cambiar(i, { url: e.target.value })} />
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

              <Checkbox checked={c.obligatorio === true || c.tipo === 'quiz'} disabled={deshabilitado || c.tipo === 'quiz'} label="Obligatorio"
                onChange={(v) => cambiar(i, { obligatorio: v || undefined })} />
            </div>
          </div>
        </Fragment>
      ))}
      {arr.huecoEn(campos.length) && <div className="ec-hueco" style={{ height: arr.alto }} aria-hidden />}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/**
 * La PREGUNTA de un campo, como título. Un `<textarea>` de una línea que crece: una pregunta larga se lee
 * entera (un input la cortaba) y Enter no la parte en dos. Sin caja: es un título, no un cuadro para
 * contestar — el cuadro del alumno es el de abajo.
 */
function Pregunta({ valor, n, tipo, deshabilitado, enfocar, onEnfocado, onCambio }: {
  valor: string; n: number; tipo: Campo['tipo']; deshabilitado?: boolean; enfocar: boolean;
  onEnfocado: () => void; onCambio: (v: string) => void;
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
    ref.current?.focus();
    onEnfocado();
  }, [enfocar, onEnfocado]);
  return (
    <textarea ref={ref} className="ec-pregunta" rows={1} value={valor} disabled={deshabilitado}
      placeholder={tipo === 'confirmacion' ? 'Qué tiene que hacer' : tipo === 'publicar' ? 'Qué tiene que publicar' : tipo === 'comentar' ? 'Qué tiene que comentar' : 'Escribe la pregunta'}
      aria-label={`Pregunta del campo ${n}`}
      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
      onChange={(e) => onCambio(e.target.value.replace(/\n/g, ' '))} />
  );
}

/**
 * Las preguntas de un quiz, con su correcta marcada al lado de cada opción, y abajo la nota mínima y
 * los intentos. Una pregunta de UNA respuesta marca como un radio (marcar otra desmarca la anterior).
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
        const ops = llenas(p.opciones);
        const correctas = (p.correctas ?? []).filter((x) => ops.includes(x));
        const marcar = (o: string, v: boolean) => setP(j, {
          correctas: p.multiple ? (v ? [...correctas, o] : correctas.filter((x) => x !== o)) : (v ? [o] : []),
        });
        return (
          <div key={p.id} className="ec-preg">
            <div className="ec-fila">
              <span className="ec-n">{j + 1}</span>
              <Input value={p.texto} placeholder="La pregunta del quiz" aria-label={`Pregunta ${j + 1} del quiz`} disabled={deshabilitado}
                onChange={(e) => setP(j, { texto: e.target.value })} />
              <IconButton small danger title="Quitar pregunta" disabled={deshabilitado || ps.length === 1}
                onClick={() => onCambio({ preguntas: ps.filter((_, k) => k !== j) }, tieneContenido(p) ? 'pregunta' : undefined)}>✕</IconButton>
            </div>
            <Textarea rows={3} value={lineas(p.opciones)} placeholder="Opciones, una por renglón" aria-label={`Opciones de la pregunta ${j + 1}`}
              disabled={deshabilitado}
              onChange={(e) => {
                const opciones = aLista(e.target.value);
                const quedan = llenas(opciones);
                setP(j, { opciones, correctas: (p.correctas ?? []).filter((x) => quedan.includes(x)) });
              }} />
            {ops.length > 0 && (
              <div className="ec-correctas" role="group" aria-label={`Correcta de la pregunta ${j + 1}`}>
                <span className="ec-mini">{p.multiple ? 'Correctas' : 'Correcta'}</span>
                {ops.map((o) => (
                  <Checkbox key={o} checked={correctas.includes(o)} disabled={deshabilitado} label={o} onChange={(v) => marcar(o, v)} />
                ))}
              </div>
            )}
            <Checkbox checked={p.multiple === true} disabled={deshabilitado} label="Varias correctas"
              onChange={(v) => setP(j, { multiple: v || undefined, correctas: v ? correctas : correctas.slice(0, 1) })} />
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
// respaldo: este formulario vive adentro de la lección (`.ahdoc`), cuya hoja deja sin fondo ni borde a
// todo `button` y en cero el relleno de todo. Por eso los selectores llevan dos clases (`.ec .ec-x`):
// con una sola, el reset del curso les gana.
// ⚠️ Es un template literal: adentro no va ningún acento grave ni la secuencia de interpolación.
const CSS = `
.ec{ display:flex; flex-direction:column; gap:12px; }
.ec button.ec-nuevo{ display:flex; align-items:center; justify-content:center; width:100%; min-height:72px; cursor:pointer;
  border:2px dashed var(--u-ink-40, var(--border-strong)); border-radius:14px; background:transparent; color:var(--u-ink, var(--ink));
  font:700 13px/1 var(--font-jetbrains), monospace; }
.ec button.ec-nuevo:hover:not(:disabled){ border-color:var(--u-ink, var(--ink)); background:var(--u-card, var(--surface)); }
.ec button.ec-nuevo:disabled{ opacity:.5; cursor:default; }
.ec .ec-campo{ display:flex; flex-direction:column; gap:8px; padding:12px 14px 14px; min-width:0; cursor:grab;
  border:2px solid var(--u-ink-40, var(--border)); border-radius:14px; background:var(--u-card, var(--surface-2)); }
.ec .ec-campo.is-agarrado{ border-color:var(--u-ink, var(--ink)); border-style:dashed; }
.ec .ec-hueco{ border:2px dashed var(--u-ink-40, var(--border-strong)); border-radius:14px; background:var(--u-lime-a12, var(--primary-bg)); }
.ec .ec-cab{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.ec .ec-asa{ flex:none; color:var(--u-ink-60, var(--dim)); font-size:14px; letter-spacing:-3px; line-height:1; user-select:none; }
.ec .ec-cab-acc{ display:inline-flex; gap:2px; margin-left:auto; }
.ec .ec-pregunta{ display:block; width:100%; box-sizing:border-box; resize:none; overflow:hidden; cursor:text;
  margin:2px 0 0; padding:4px 2px; border:0; border-bottom:2px solid transparent; border-radius:0; background:transparent;
  color:var(--u-ink, var(--ink)); font-family:inherit; font-size:16px; font-weight:700; line-height:1.35; }
.ec .ec-pregunta:hover:not(:disabled){ border-bottom-color:var(--u-ink-40, var(--border)); }
.ec .ec-pregunta:focus{ outline:none; border-bottom-color:var(--u-ink, var(--ink)); }
.ec .ec-pregunta::placeholder{ color:var(--u-ink-60, var(--faint)); font-weight:600; }
.ec .ec-ayuda{ display:block; width:100%; box-sizing:border-box; cursor:text; margin:0; padding:2px 2px; border:0; background:transparent;
  color:var(--u-ink-60, var(--dim)); font-size:13px; }
.ec .ec-ayuda:focus{ outline:none; color:var(--u-ink, var(--ink)); }
.ec .ec-cuerpo{ display:flex; flex-direction:column; gap:8px; cursor:default; }
.ec .ec-caja{ display:flex; flex-direction:column; gap:4px; padding:10px 12px; cursor:text;
  border:1.5px dashed var(--u-ink-40, var(--border-strong)); border-radius:10px; background:var(--u-paper, var(--surface)); }
.ec .ec-caja--larga{ min-height:72px; }
.ec .ec-caja-rot{ font:600 10px/1.2 var(--font-jetbrains), monospace; letter-spacing:.06em; text-transform:uppercase; color:var(--u-ink-60, var(--faint)); }
.ec .ec-caja-in{ width:100%; box-sizing:border-box; margin:0; padding:0; border:0; background:transparent; color:var(--u-ink-60, var(--dim)); font-size:14px; }
.ec .ec-caja-in:focus{ outline:none; color:var(--u-ink, var(--ink)); }
/* El foco de la pregunta, la ayuda y el texto de ejemplo: una línea o el borde de su cuadro, en vez del
   aro de 3 px que el curso le pone a todo input (.ahdoc .ugc input:focus-visible), que adentro de una
   tarjeta con borde se leía como una caja dentro de otra (medido en el banco). Tres clases para ganarle. */
.ec .ec-campo .ec-pregunta:focus-visible, .ec .ec-campo .ec-ayuda:focus-visible, .ec .ec-campo .ec-caja-in:focus-visible{ outline:none; }
.ec .ec-campo .ec-ayuda:focus{ box-shadow:inset 0 -1.5px 0 var(--u-ink, var(--ink)); }
.ec .ec-campo .ec-caja:focus-within{ border-style:solid; border-color:var(--u-ink, var(--ink)); }
.ec .ec-fila{ display:flex; align-items:center; gap:6px; }
.ec .ec-fila > .mk-input, .ec .ec-fila > .mk-inputwrap{ flex:1; min-width:0; }
.ec .ec-n{ flex:none; width:20px; text-align:center; font-size:var(--fs-meta); color:var(--u-ink-60, var(--dim)); font-variant-numeric:tabular-nums; }
.ec .ec-tabla{ display:grid; grid-template-columns:1fr 1fr 110px; gap:8px; align-items:start; }
.ec .ec-par{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ec .ec-mini{ font-size:var(--fs-meta); color:var(--u-ink-60, var(--dim)); }
.ec .ec-escala{ display:grid; grid-template-columns:150px 1fr 1fr; gap:8px; align-items:center; }
.ec .ec-quiz{ display:flex; flex-direction:column; gap:10px; }
.ec .ec-preg{ display:flex; flex-direction:column; gap:6px; padding:8px; border:1px solid var(--u-ink-40, var(--border)); border-radius:10px; background:var(--u-paper, var(--surface)); }
.ec .ec-correctas{ display:flex; flex-wrap:wrap; align-items:center; gap:4px 14px; }
.ec .ec-quiz-pie{ display:flex; flex-wrap:wrap; gap:8px 18px; }
@media (max-width:640px){ .ec .ec-tabla, .ec .ec-escala{ grid-template-columns:1fr; } }
`;
