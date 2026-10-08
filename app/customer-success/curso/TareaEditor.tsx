'use client';

// =============================================================================
// TareaEditor — la TAREA de una clase (una o varias), con sus campos adentro
// =============================================================================
// El audio del 08/10/2026 (docs/feedback-curso-08oct.md), textual con su minuto:
//   ·  5 (21:00) «yo no sabía de que eso cuando agregaba una tarea tipo los campos asociados… para eso
//      tengo que ponerlo todo dentro de un contenedor, porque ahora están en tres contenedores separados y
//      no se entiende» → cada tarea es UNA tarjeta: su título (en las que no son la primera), su
//      descripción con formato y sus campos ADENTRO.
//   ·  6 (12:30) «automáticamente cuando se crea la nueva tarea… abajo también ya se tienen que crear de
//      manera automática el nuevo campo, es decir, el primer campo» → «Agregar tarea» la crea con su primer
//      campo (una Respuesta de texto) y el cursor en su pregunta.
//   · 11 (18:00) «sería bueno que sea formateable la descripción de la tarea, como lo veas arriba, la
//      descripción de el curso, o sea, que tenga negrita» → la descripción de cada tarea es el EditorRico,
//      el mismo de la descripción de la clase (con sus adjuntos), cargado A DEMANDA como todo editor rico
//      de la tab (./editor-rico-perezoso.tsx: un import estático lo mete en el chunk de la página).
//   · 12 (21:30) «sería bueno que se pueda agregar más de una tarea» → «+ Agregar otra tarea» suma una
//      sección (un `Campo` de tipo 'seccion', contrato 2) con su tarjeta; cada tarjeta tiene «Quitar tarea»,
//      y los campos se arrastran adentro de su tarea y de una tarea a otra (./arrastre-campos.ts).
//   ·  2 (16:40) «un enmarcado rojo y que diga falta completar la pregunta» → `errores` (por id de campo o
//      de sección, y 'tarea' para la descripción de la primera) se pinta en rojo, con el motivo corto.
//
// EL CONTRATO (3, del 08/10/2026): es un componente CONTROLADO. `valor` es el BORRADOR de quien lo monta
// (LeccionEditable, la pista EDITOR), que lo guarda de una vez con su botón «Guardar» y lleva el Ctrl+Z.
//   ⚠️ ACÁ NO SE GUARDA NADA EN EL SERVER: ni una server action de la clase. Lo único que sale de acá son
//      los ADJUNTOS de las descripciones (se suben al bucket al soltarlos, como en la descripción de la
//      clase) y la lista de la comunidad para «Publicar» y «Comentar».
//   ⚠️ LOS «DESHACER» REVIERTEN POR `onChange` (borrar o mover un campo, quitar una tarea, cambiar un tipo
//      que pierde lo escrito, quitar una pregunta): devuelven los MISMOS objetos (las respuestas de los
//      alumnos cuelgan de su id) sobre el borrador de AHORA, no sobre el de cuando se ofreció — lo que se
//      escribió en esos cinco segundos no se pierde. La excepción, escrita: quitar la PRIMERA tarea con
//      otras detrás (la segunda pasa a primera) vuelve a la foto de antes.
//   ⚠️ EL AVISO DE «DESHACER» VIVE ACÁ ADENTRO (el Toast de la casa, como el del EditorRico): el contrato no
//      trae uno de la tab. Su estilo va en línea, así el reset del curso no le saca el fondo a sus botones.
//      Nada de Modal ni Confirm: adentro del curso no se portalean (la hoja les saca el fondo).
//   ⚠️ UN `useState` SEMBRADO DE PROPS NO SE RESIEMBRA: acá no hay ninguno con el borrador. Lo único local
//      es a quién darle el foco y qué campo recién creado todavía no muestra su rojo.

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { Campo } from '@/lib/curso';
import { TOPE_TITULO_TAREA } from '@/lib/curso';
import { Switch, Toast, useToast } from '@/app/_ui';
import { ACEPTA_ADJUNTO, ACEPTA_IMAGEN_ADJUNTO, crearSubidorDeAdjuntos } from '@/lib/curso-adjuntos-reglas';
import { opcionesComunidadAction } from './actions';
import { urlSubidaAdjuntoAction, registrarAdjuntoAction } from './adjuntos-actions';
import { useUrlsDeAdjuntos } from './urls-adjuntos';
import { subirConProgreso } from './subir-video';
import { EditorRicoPerezoso } from './editor-rico-perezoso';
import { nuevoIdCampo } from './reglas';
import { AVISO_DESHACER, AYUDA_POR_AREA, ROTULO_POR_AREA, type OpcionesComunidad } from './leccion-reglas';
import { CSS_TAREA, EditorCampos, type MotivoCampos } from './EditorCampos';
import { useArrastreCampos } from './arrastre-campos';
import {
  campoDelGesto, conBloqueDevuelto, conCampoDevuelto, conCampoMovido, conCamposDeTarea, conOtraTarea, conPrimeraTarea,
  conSeccion, entraOtraTarea, gruposDeCampos, hayTarea, idsNuevos, lugarDe, motivoVisible, sinTarea, type BorradorTarea,
} from './tarea-editor-reglas';

export type { BorradorTarea } from './tarea-editor-reglas';

/** Lo último de un valor que cambia en cada render, para lo que corre después (un «Deshacer», un arrastre). */
function useUltimo<T>(v: T) {
  const r = useRef(v);
  useEffect(() => { r.current = v; });
  return r;
}

// Las URLs de los adjuntos de las descripciones: la MISMA caché que la descripción de la clase
// (./urls-adjuntos.ts). Hasta la revisión final del 08/10/2026 había una copia acá, y lo que el cursor
// adelantaba sobre una tarjeta no le servía a la tarea: se volvía a pedir al abrir la clase.

/** Lo que hay en la comunidad del producto, para «Publicar» / «Comentar». UNA función por producto. */
const cargadores = new Map<number, () => Promise<OpcionesComunidad | null>>();
function cargarComunidadDe(productoId: number): () => Promise<OpcionesComunidad | null> {
  let f = cargadores.get(productoId);
  if (!f) {
    f = async () => {
      const r = await opcionesComunidadAction(productoId);
      return r.ok ? { categorias: r.categorias, posts: r.posts } : null;
    };
    cargadores.set(productoId, f);
  }
  return f;
}

const SIN_ERRORES: Readonly<Record<string, string>> = {};

export function TareaEditor(p: {
  valor: BorradorTarea;
  onChange: (v: BorradorTarea) => void;
  /** Lo que falta, por id de campo o de sección, y 'tarea' para la descripción de la primera (`erroresDeCampos`). */
  errores: Record<string, string>;
  claseId: number;
  productoId: number;
  /** ¿Se ofrece «Una respuesta por área»? (`ofrecePorArea`, ./leccion-reglas.ts) */
  ofrecerPorArea: boolean;
}): JSX.Element {
  const { valor, onChange, claseId, productoId, ofrecerPorArea } = p;
  const errores = p.errores ?? SIN_ERRORES;
  const ultimo = useUltimo(valor);
  const cambiar = useUltimo(onChange);
  const { toast, show, clear } = useToast();
  const [enfocar, setEnfocar] = useState<string | null>(null);
  // Los recién creados a los que todavía nadie les salió de la pregunta (o del título): su rojo espera.
  const [silenciados, setSilenciados] = useState<ReadonlySet<string>>(() => new Set());
  const silenciar = (...ids: string[]) => setSilenciados((s) => new Set([...s, ...ids]));
  const oir = useCallback((id: string) => setSilenciados((s) => {
    if (!s.has(id)) return s;
    const n = new Set(s);
    n.delete(id);
    return n;
  }), []);

  const grupos = useMemo(() => gruposDeCampos(valor.campos), [valor.campos]);
  const varias = grupos.length > 1;
  const nuevoId = () => nuevoIdCampo(valor.campos);

  // Las descripciones: el editor rico, con los adjuntos al bucket de la clase (como la descripción).
  const todoElHtml = [valor.tareaHtml, ...grupos.map((g) => g.seccion?.descripcionHtml ?? '')].join('');
  const urlDeAdjunto = useUrlsDeAdjuntos(todoElHtml);
  const subirAdjunto = useMemo(() => crearSubidorDeAdjuntos(
    { firmar: urlSubidaAdjuntoAction, registrar: registrarAdjuntoAction, subir: subirConProgreso },
    { productoId, claseId },
  ), [productoId, claseId]);
  const cargarComunidad = cargarComunidadDe(productoId);

  /** «Deshacer» de 5 segundos: revierte sobre el borrador de AHORA (ver la cabecera). */
  const ofrecerDeshacer = (texto: string, revertir: (v: BorradorTarea) => BorradorTarea) =>
    show(texto, () => cambiar.current(revertir(ultimo.current)));

  // El arrastre de la tarea ENTERA: un campo va de una tarea a otra (item 12).
  const arr = useArrastreCampos({
    grupos: grupos.map((g) => g.campos.map((c) => c.id)),
    onSoltar: (id, g, i) => {
      const lista = conCampoMovido(valor.campos, id, g, i);
      if (!lista) return;
      const campo = valor.campos.find((c) => c.id === id)!;
      const lugar = lugarDe(valor.campos, id);
      onChange({ ...valor, campos: lista });
      ofrecerDeshacer(AVISO_DESHACER.movido, (v) => ({ ...v, campos: conBloqueDevuelto(v.campos, [campo], lugar) }));
    },
  });

  /** Lo que devuelve el editor de los campos de la tarea `g`, con su «Deshacer» cuando lo hay. */
  const cambiarCampos = (g: number, lista: Campo[], motivo?: MotivoCampos) => {
    const antes = grupos[g]?.campos ?? [];
    onChange({ ...valor, campos: conCamposDeTarea(valor.campos, g, lista) });
    if (!motivo) return;
    if (motivo === 'nuevo') {
      const nuevo = lista.find((c) => !antes.some((a) => a.id === c.id));
      if (nuevo) silenciar(nuevo.id);
      return;
    }
    const campo = campoDelGesto(antes, lista, motivo);
    if (!campo) return;
    if (motivo === 'borrado' || motivo === 'movido') {
      const lugar = lugarDe(valor.campos, campo.id);
      ofrecerDeshacer(AVISO_DESHACER[motivo], (v) => ({ ...v, campos: conBloqueDevuelto(v.campos, [campo], lugar) }));
    } else {
      ofrecerDeshacer(AVISO_DESHACER[motivo], (v) => ({ ...v, campos: conCampoDevuelto(v.campos, campo) }));
    }
  };

  /** «Agregar tarea» (item 6): la primera, con su primer campo y el cursor en su pregunta. */
  const agregarPrimera = () => {
    const [id] = idsNuevos(valor.campos, 1, nuevoIdCampo);
    onChange(conPrimeraTarea(valor, id));
    silenciar(id);
    setEnfocar(id);
  };

  /** «+ Agregar otra tarea» (item 12): una sección con su primer campo; el cursor, en su título. */
  const agregarOtra = () => {
    const [s, c] = idsNuevos(valor.campos, 2, nuevoIdCampo);
    onChange({ ...valor, campos: conOtraTarea(valor.campos, s, c) });
    // Se silencia SÓLO lo que toma el foco (el título): el primer campo no lo toma, y silenciado no saldría
    // nunca de su silencio — su rojo no se vería ni al tocar «Guardar» (medido en el banco: 2 rojos de 3).
    silenciar(s);
    setEnfocar(s);
  };

  /** «Quitar tarea»: se va con sus campos, y se ofrece «Deshacer» (ver `sinTarea`). */
  const quitar = (g: number) => {
    const antes = valor;
    onChange(sinTarea(valor, g));
    const gr = grupos[g];
    if (g > 0 && gr?.seccion) {
      const bloque = [gr.seccion, ...gr.campos];
      // Sin `seccion` en el lugar: una tarea entera vuelve antes de la que le seguía, o al final.
      const lugar = { ancla: lugarDe(antes.campos, bloque[bloque.length - 1].id).ancla };
      ofrecerDeshacer(AVISO_DESHACER.tarea, (v) => ({ ...v, campos: conBloqueDevuelto(v.campos, bloque, lugar) }));
    } else {
      ofrecerDeshacer(AVISO_DESHACER.tarea, (v) => ({ ...v, tareaHtml: antes.tareaHtml, campos: antes.campos }));
    }
  };

  const hojas = (
    <>
      <style href="ec-tarea" precedence="medium">{CSS_TAREA}</style>
      <style href="te-tarea" precedence="medium">{CSS_TAREA_ENTERA}</style>
    </>
  );

  // Sin tarea: el placeholder (item 16 de la tanda del 07/10), que la crea con su primer campo (item 6).
  if (!hayTarea(valor)) {
    return (
      <div className="ec te te--vacia">
        {hojas}
        <button type="button" className="te-agregar" data-recorrido="leccion-tarea" onClick={agregarPrimera}>+ Agregar tarea</button>
        <Toast state={toast} onClose={clear} />
      </div>
    );
  }

  const motivoTarea = errores.tarea || null;
  return (
    <section className={`ec te${arr.mano ? ' is-arrastrando' : ''}`} aria-label="Tarea" {...arr.zona}>
      {hojas}
      {grupos.map((gr, g) => {
        const s = gr.seccion;
        const motivoTitulo = s ? motivoVisible(errores, s.id, silenciados) : null;
        return (
          <div key={s?.id ?? 'principal'} className="te-tarea" {...arr.grupo(g)}
            data-recorrido={g === 0 ? 'leccion-tarea' : undefined}>
            <div className="te-cab">
              <span className="te-eyebrow">{varias ? `Tarea ${g + 1}` : 'Tarea'}</span>
              <button type="button" className="te-quitar" onClick={() => quitar(g)}>Quitar tarea</button>
            </div>
            {s && (
              <TituloDeTarea valor={s.label} n={g + 1} error={!!motivoTitulo} enfocar={enfocar === s.id}
                onEnfocado={() => setEnfocar(null)} onSalir={() => oir(s.id)}
                onCambio={(label) => onChange({ ...valor, campos: conSeccion(valor.campos, g, { label }) })} />
            )}
            {motivoTitulo && <p className="ec-motivo" role="alert">{motivoTitulo}</p>}
            {/* La descripción de la tarea, con formato (item 11): el editor rico, como la de la clase. */}
            <div className={`te-desc${g === 0 && motivoTarea ? ' is-error' : ''}`} data-error={g === 0 && motivoTarea ? '' : undefined}>
              <EditorRicoPerezoso valor={s ? s.descripcionHtml ?? '' : valor.tareaHtml}
                onCambio={(h) => onChange(s
                  ? { ...valor, campos: conSeccion(valor.campos, g, { descripcionHtml: h || undefined }) }
                  : { ...valor, tareaHtml: h })}
                subirAdjunto={subirAdjunto} urlDeAdjunto={urlDeAdjunto} aceptaArchivos={ACEPTA_ADJUNTO} aceptaImagenes={ACEPTA_IMAGEN_ADJUNTO}
                minAlto={s ? 48 : 64} placeholder={s ? 'Qué tiene que hacer en esta tarea (opcional)…' : 'Qué tiene que hacer…'}
                etiqueta={varias ? `Descripción de la tarea ${g + 1}` : 'Descripción de la tarea'} />
            </div>
            {g === 0 && motivoTarea && <p className="ec-motivo" role="alert">{motivoTarea}</p>}
            {/* Sus campos, ADENTRO de su tarjeta (item 5). */}
            <EditorCampos campos={gr.campos} onCampos={(l, m) => cambiarCampos(g, l, m)} arrastre={arr} grupo={g}
              errores={errores} silenciados={silenciados} onSalirDePregunta={oir}
              enfocar={enfocar} onEnfocar={setEnfocar} nuevoId={nuevoId} cargarComunidad={cargarComunidad} />
          </div>
        );
      })}
      {entraOtraTarea(valor.campos) && <button type="button" className="te-otra" onClick={agregarOtra}>+ Agregar otra tarea</button>}
      {/* «Por área» va con la tarea: cambia cómo se contesta (lo dice su línea, `AYUDA_POR_AREA`). */}
      {ofrecerPorArea && (
        <div className="te-marca">
          <Switch checked={valor.porArea} onChange={(v) => onChange({ ...valor, porArea: v })} label={ROTULO_POR_AREA} hint={AYUDA_POR_AREA} />
        </div>
      )}
      <Toast state={toast} onClose={clear} />
    </section>
  );
}

/** El título de una tarea que no es la primera (la sección): obligatorio, y el foco al crearla. */
function TituloDeTarea({ valor, n, error, enfocar, onEnfocado, onSalir, onCambio }: {
  valor: string; n: number; error: boolean; enfocar: boolean; onEnfocado: () => void; onSalir: () => void; onCambio: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!enfocar) return;
    const el = ref.current;
    el?.focus({ preventScroll: true });
    el?.closest('.te-tarea')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    onEnfocado();
  }, [enfocar, onEnfocado]);
  return (
    <input ref={ref} className={`te-titulo${error ? ' is-error' : ''}`} value={valor} maxLength={TOPE_TITULO_TAREA} placeholder="Título de la tarea"
      aria-invalid={error || undefined} data-error={error ? '' : undefined}
      aria-label={`Título de la tarea ${n}`} onBlur={onSalir} onChange={(e) => onCambio(e.target.value)} />
  );
}

// La tarjeta de cada tarea, el «+ Agregar otra tarea» y el placeholder sin tarea. Mismas reglas que la hoja
// de los campos (./EditorCampos.tsx, `CSS_TAREA`): dos clases para ganarle al reset del curso, los colores
// del curso con el de la app de respaldo, y nada que corte el template literal.
// Mientras se arrastra un campo, el editor rico no recibe el puntero (`is-arrastrando`): si no, ProseMirror
// dibuja su cursor de soltar adentro de la descripción (ver ./arrastre-campos.ts).
export const CSS_TAREA_ENTERA = `
.ec.te{ display:flex; flex-direction:column; gap:14px; min-width:0; }
.ec .te-tarea{ display:flex; flex-direction:column; gap:10px; min-width:0; padding:14px 14px 16px;
  border:1.5px solid var(--u-line, var(--border-strong)); border-radius:16px; background:var(--u-paper, var(--surface-2)); }
.ec .te-cab{ display:flex; align-items:center; gap:10px; }
.ec .te-eyebrow{ font:700 10.5px/1.2 var(--font-jetbrains), monospace; letter-spacing:.08em; text-transform:uppercase; color:var(--u-ink-60, var(--dim)); }
.ec button.te-quitar{ margin-left:auto; padding:5px 9px; border-radius:7px; cursor:pointer; background:transparent;
  font:600 11px/1 var(--font-jetbrains), monospace; color:var(--u-ink-60, var(--dim)); }
.ec button.te-quitar:hover{ background:#f6c9c1; color:var(--u-ink, var(--ink)); }
.ec .te-tarea .te-titulo{ display:block; width:100%; box-sizing:border-box; margin:0; padding:2px 2px 4px; border:0; border-bottom:2px solid transparent;
  border-radius:0; background:transparent; color:var(--u-ink, var(--ink)); font-family:var(--ugc-fuente, inherit); font-size:19px; font-weight:800; letter-spacing:-.01em; }
.ec .te-tarea .te-titulo:hover{ border-bottom-color:var(--u-ink-40, var(--border)); }
.ec .te-tarea .te-titulo:focus, .ec .te-tarea .te-titulo:focus-visible{ outline:none; border-bottom-color:var(--u-ink, var(--ink)); }
.ec .te-tarea .te-titulo.is-error{ border-bottom-color:#b3261e; }
.ec .te-tarea .te-titulo::placeholder{ color:var(--u-ink-60, var(--faint)); font-weight:700; }
.ec .te-desc{ min-width:0; border-radius:12px; }
.ec .te-desc.is-error{ box-shadow:0 0 0 1.5px #b3261e; }
.ec.is-arrastrando .te-desc{ pointer-events:none; }
.ec button.te-otra, .ec button.te-agregar{ display:flex; align-items:center; justify-content:center; width:100%; cursor:pointer;
  border:2px dashed var(--u-ink-40, var(--border-strong)); border-radius:14px; background:transparent; color:var(--u-ink, var(--ink));
  font:700 13px/1 var(--font-jetbrains), monospace; }
.ec button.te-otra{ min-height:48px; }
.ec button.te-agregar{ min-height:64px; }
.ec button.te-otra:hover, .ec button.te-agregar:hover{ border-color:var(--u-ink, var(--ink)); background:var(--u-card, var(--surface)); }
.ec .te-marca{ padding:2px 0; }
`;
