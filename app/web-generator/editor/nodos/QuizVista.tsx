'use client';

// =============================================================================
// QuizVista — el quiz con diagnóstico en el editor (6/11/2026, Lead Magnet Generator)
// =============================================================================
// El molde es BloqueVentaVista: la forma de quiz.ts dibujada INERTE (un resumen: la portada, las preguntas y los resultados),
// una barra con «Editar», lo que le falta y el tacho, y un panel flotante que edita los atributos. El panel sigue el orden del
// flujo que copia de SurveyJS: la portada, las preguntas (cada opción con sus puntos), el contacto y los resultados por rango.
// Lo que no se normaliza mientras se escribe (como en el formulario): el saneo recorta al guardar; acá se guarda lo escrito.
// =============================================================================

import { useMemo, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, Flotante, Icono, eliminarBloqueConDeshacer, noRobaFoco } from '../BarraFormato';
import { htmlDeArbol } from '@/lib/editor-landing/grafico-svg';
import {
  TEXTOS_QUIZ, TOPES_QUIZ, attrsQuiz, avisoDelBoton, faltaDelQuiz, puntajeMaximo, specQuiz,
  type OpcionQuiz, type PreguntaQuiz, type ResultadoQuiz,
} from '@/lib/editor-landing/quiz';

const CSS_QUIZ: string = [
  '.gmx-quiz{display:flex;flex-direction:column;gap:6px;padding:4px;max-height:min(70vh,560px);overflow-y:auto}',
  '.gmx-quiz-fila{display:flex;align-items:center;gap:6px}',
  '.gmx-quiz-fila .gmx-campo{flex:1 1 auto;min-width:0}',
  '.gmx-quiz-caja{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--gmx-borde);border-radius:8px;background:var(--gmx-fondo-2)}',
  '.gmx-quiz-pts{flex:0 0 4.2em !important}',
  '.gmx-quiz-sec{margin-top:6px}',
].join('\n');

type Poner = (a: Record<string, unknown>) => void;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown, def = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : def);

/** Lo escrito, tal cual (sin recortar): el panel no normaliza mientras se tipea. */
function crudo(attrs: Record<string, unknown>): { preguntas: PreguntaQuiz[]; resultados: ResultadoQuiz[] } {
  const ps = Array.isArray(attrs.preguntas) ? attrs.preguntas : [];
  const rs = Array.isArray(attrs.resultados) ? attrs.resultados : [];
  return {
    preguntas: ps.map((p) => {
      const q = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      const ops = Array.isArray(q.opciones) ? q.opciones : [];
      return { texto: str(q.texto), opciones: ops.map((x) => { const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>; return { texto: str(o.texto), puntos: num(o.puntos) }; }) };
    }),
    resultados: rs.map((r) => {
      const x = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      return { desde: num(x.desde), titulo: str(x.titulo), texto: str(x.texto), boton: str(x.boton), href: str(x.href) };
    }),
  };
}

export function QuizVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, selected, updateAttributes } = props;
  const ctx = useEditorLanding();
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const html = useMemo(() => htmlDeArbol(specQuiz(node.attrs, { modo: 'editor' })), [node.attrs]);
  const activo = (selected || !!ancla) && editor.isEditable;
  const falta = faltaDelQuiz(node.attrs);
  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar, 'Quiz: eliminado');
  };

  return (
    <NodeViewWrapper className="gmx-nv" data-activo={activo ? 'si' : undefined}>
      <EstilosG2 />
      <style href="gmx-quiz" precedence="medium">{CSS_QUIZ}</style>
      {activo && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          <button type="button" className="gmx-btn" title="Editar el quiz" aria-expanded={!!ancla} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => setAncla(ancla ? null : e.currentTarget)}>
            <Icono nombre="pregunta" /><span>Quiz</span>
          </button>
          <span className="gmx-nv-etq">{falta ? `${falta}: no se muestra` : 'Listo'}</span>
          <span className="gmx-nv-sep" />
          <button type="button" className="gmx-btn" title="Eliminar" aria-label="Eliminar el quiz" onMouseDown={(e) => e.preventDefault()} onClick={eliminar}>
            <IconoBorrar size={16} />
          </button>
        </div>
      )}
      <div className="gmx-nv-marco" inert dangerouslySetInnerHTML={{ __html: html }} />
      {ancla && (
        <Flotante ancla={ancla} onCerrar={() => setAncla(null)} etiqueta="Quiz" ancho={440}>
          <PanelQuiz attrs={node.attrs} poner={updateAttributes} />
        </Flotante>
      )}
    </NodeViewWrapper>
  );
}

function PanelQuiz({ attrs, poner }: { attrs: Record<string, unknown>; poner: Poner }) {
  const { preguntas, resultados } = crudo(attrs);
  const maximo = puntajeMaximo(attrsQuiz(attrs));
  const ponerPreguntas = (ps: PreguntaQuiz[]) => poner({ preguntas: ps });
  const ponerResultados = (rs: ResultadoQuiz[]) => poner({ resultados: rs });
  const cambiarPregunta = (i: number, c: Partial<PreguntaQuiz>) => ponerPreguntas(preguntas.map((p, k) => (k === i ? { ...p, ...c } : p)));
  const cambiarOpcion = (i: number, j: number, c: Partial<OpcionQuiz>) =>
    cambiarPregunta(i, { opciones: preguntas[i].opciones.map((o, k) => (k === j ? { ...o, ...c } : o)) });
  const cambiarResultado = (i: number, c: Partial<ResultadoQuiz>) => ponerResultados(resultados.map((r, k) => (k === i ? { ...r, ...c } : r)));
  const puntos = (v: string) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(TOPES_QUIZ.puntos, Math.max(0, n)) : 0; };
  const sinFoco = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="gmx-quiz">
      <span className="gmx-rotulo">Título</span>
      <input className="gmx-campo" value={str(attrs.titulo)} maxLength={TOPES_QUIZ.titulo} placeholder="¿Tu agenda está lista para crecer?" aria-label="Título del quiz"
        onChange={(e) => poner({ titulo: e.target.value })} />
      <span className="gmx-rotulo">Qué van a saber</span>
      <input className="gmx-campo" value={str(attrs.intro)} maxLength={TOPES_QUIZ.intro} placeholder="5 preguntas y te digo qué frena tu agenda." aria-label="Qué van a saber"
        onChange={(e) => poner({ intro: e.target.value })} />
      <span className="gmx-rotulo">Botón para empezar</span>
      <input className="gmx-campo" value={str(attrs.empezar)} maxLength={TOPES_QUIZ.boton} placeholder={TEXTOS_QUIZ.empezar} aria-label="Texto del botón para empezar"
        onChange={(e) => poner({ empezar: e.target.value })} />

      <span className="gmx-rotulo gmx-quiz-sec">Preguntas</span>
      {preguntas.map((p, i) => (
        <div key={i} className="gmx-quiz-caja">
          <div className="gmx-quiz-fila">
            <input className="gmx-campo" value={p.texto} maxLength={TOPES_QUIZ.pregunta} placeholder={`Pregunta ${i + 1}`} aria-label={`Pregunta ${i + 1}`}
              onChange={(e) => cambiarPregunta(i, { texto: e.target.value })} />
            <button type="button" className="gmx-btn" title="Quitar la pregunta" aria-label={`Quitar la pregunta ${i + 1}`} onMouseDown={sinFoco}
              onClick={() => ponerPreguntas(preguntas.filter((_, k) => k !== i))}>
              <IconoBorrar size={15} />
            </button>
          </div>
          {p.opciones.map((o, j) => (
            <div key={j} className="gmx-quiz-fila">
              <input className="gmx-campo" value={o.texto} maxLength={TOPES_QUIZ.opcion} placeholder={`Opción ${j + 1}`} aria-label={`Pregunta ${i + 1}, opción ${j + 1}`}
                onChange={(e) => cambiarOpcion(i, j, { texto: e.target.value })} />
              <input className="gmx-campo gmx-quiz-pts" type="number" min={0} max={TOPES_QUIZ.puntos} value={String(o.puntos)} title="Puntos" aria-label={`Puntos de la opción ${j + 1}`}
                onChange={(e) => cambiarOpcion(i, j, { puntos: puntos(e.target.value) })} />
              <button type="button" className="gmx-btn" title="Quitar la opción" aria-label={`Quitar la opción ${j + 1}`} onMouseDown={sinFoco}
                onClick={() => cambiarPregunta(i, { opciones: p.opciones.filter((_, k) => k !== j) })}>
                <IconoBorrar size={15} />
              </button>
            </div>
          ))}
          <button type="button" className="gmx-chip" style={{ alignSelf: 'flex-start' }} disabled={p.opciones.length >= TOPES_QUIZ.opciones} onMouseDown={sinFoco}
            onClick={() => cambiarPregunta(i, { opciones: [...p.opciones, { texto: '', puntos: 0 }] })}>
            <Icono nombre="mas" tam={14} /><span>Opción</span>
          </button>
        </div>
      ))}
      <button type="button" className="gmx-chip" style={{ alignSelf: 'flex-start' }} disabled={preguntas.length >= TOPES_QUIZ.preguntas} onMouseDown={sinFoco}
        onClick={() => ponerPreguntas([...preguntas, { texto: '', opciones: [0, 1, 2].map((pts) => ({ texto: '', puntos: pts })) }])}>
        <Icono nombre="mas" tam={14} /><span>Pregunta</span>
      </button>

      <span className="gmx-rotulo gmx-quiz-sec">Contacto</span>
      <span className="gmx-nota">Antes del resultado piden nombre y correo: entran a tu CRM con su resultado.</span>
      <label className="gmx-quiz-fila gmx-nota" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={attrs.pideTelefono === true} onChange={(e) => poner({ pideTelefono: e.target.checked })} />
        Pedir también su WhatsApp (opcional para quien contesta)
      </label>
      <input className="gmx-campo" value={str(attrs.enviar)} maxLength={TOPES_QUIZ.boton} placeholder={TEXTOS_QUIZ.enviar} aria-label="Texto del botón de enviar"
        onChange={(e) => poner({ enviar: e.target.value })} />

      <span className="gmx-rotulo gmx-quiz-sec">Resultados</span>
      <span className="gmx-nota">{`El puntaje va de 0 a ${maximo}. Gana el resultado con el «desde» más alto que alcanza.`}</span>
      {resultados.map((r, i) => (
        <div key={i} className="gmx-quiz-caja">
          <div className="gmx-quiz-fila">
            <label className="gmx-rotulo" style={{ margin: 0 }}>Desde
              <input className="gmx-campo gmx-quiz-pts" type="number" min={0} max={TOPES_QUIZ.desde} value={String(r.desde)} aria-label={`Resultado ${i + 1}: desde cuántos puntos`}
                onChange={(e) => cambiarResultado(i, { desde: Math.max(0, Math.min(TOPES_QUIZ.desde, Math.round(Number(e.target.value)) || 0)) })} />
            </label>
            <input className="gmx-campo" value={r.titulo} maxLength={TOPES_QUIZ.resultadoTitulo} placeholder={`Resultado ${i + 1}`} aria-label={`Título del resultado ${i + 1}`}
              onChange={(e) => cambiarResultado(i, { titulo: e.target.value })} />
            <button type="button" className="gmx-btn" title="Quitar el resultado" aria-label={`Quitar el resultado ${i + 1}`} onMouseDown={sinFoco}
              onClick={() => ponerResultados(resultados.filter((_, k) => k !== i))}>
              <IconoBorrar size={15} />
            </button>
          </div>
          <textarea className="gmx-campo" rows={3} value={r.texto} maxLength={TOPES_QUIZ.resultadoTexto} placeholder="Qué significa y qué hacer ahora" aria-label={`Texto del resultado ${i + 1}`}
            onChange={(e) => cambiarResultado(i, { texto: e.target.value })} />
          <div className="gmx-quiz-fila">
            <input className="gmx-campo" value={r.boton} maxLength={TOPES_QUIZ.boton} placeholder="Agendar una llamada" aria-label={`Botón del resultado ${i + 1}`}
              onChange={(e) => cambiarResultado(i, { boton: e.target.value })} />
            <input className="gmx-campo" value={r.href} maxLength={TOPES_QUIZ.href} placeholder="https://" aria-label={`Link del botón del resultado ${i + 1}`}
              onChange={(e) => cambiarResultado(i, { href: e.target.value })} />
          </div>
          {avisoDelBoton(r) && <span className="gmx-nota" role="status">{avisoDelBoton(r)}</span>}
        </div>
      ))}
      <button type="button" className="gmx-chip" style={{ alignSelf: 'flex-start' }} disabled={resultados.length >= TOPES_QUIZ.resultados} onMouseDown={sinFoco}
        onClick={() => ponerResultados([...resultados, { desde: maximo, titulo: '', texto: '', boton: '', href: '' }])}>
        <Icono nombre="mas" tam={14} /><span>Resultado</span>
      </button>
    </div>
  );
}

export default QuizVista;
