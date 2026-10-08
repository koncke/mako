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
// ⚠️ LAS LISTAS (opciones, columnas, filas) SE EDITAN UNA POR RENGLÓN y se guardan CRUDAS
// mientras se escribe: sin filtrar los renglones vacíos, porque filtrarlos en cada tecla se
// come el Enter y no hay forma de escribir la segunda opción. El saneo (`sanearCampos`) los
// limpia al guardar, en el server.
//
// ⚠️ EL ID DE UN CAMPO NO SE VE NI SE EDITA: las respuestas de los clientes se guardan por id
// (`curso_progreso.valores`), así que cambiar la pregunta no puede cambiar de quién son las
// respuestas. Ver `nuevoIdCampo`.
//
// ⚠️ LA CORRECTA DE UNA PREGUNTA SE MARCA POR SU TEXTO (`PreguntaQuiz.correctas`, lib/curso.ts): al
// cambiar las opciones se desmarca la que ya no está, a la vista. Las correctas no salen de esta
// pantalla del equipo: al alumno le llegan los campos SIN ellas (`camposParaAlumno`).

import type { Campo, PreguntaQuiz } from '@/lib/curso';
import { MAX_ARCHIVOS, NOTA_MIN_DEFAULT, MAX_SEG_DEFAULT } from '@/lib/curso';
import { Button, IconButton, Input, Textarea, Select, Checkbox } from '@/app/_ui';
import { TIPOS_CAMPO, moverEnLista, nuevoIdCampo } from './reglas';

const lineas = (v: string[] | undefined) => (v ?? []).join('\n');
const aLista = (s: string) => s.split('\n');
/** Las opciones que ya se escribieron (sin renglones vacíos ni repetidas): las que se pueden marcar. */
const llenas = (v: string[] | undefined) => [...new Set((v ?? []).map((s) => s.trim()).filter(Boolean))];

const preguntaNueva = (existentes: readonly PreguntaQuiz[]): PreguntaQuiz =>
  ({ id: nuevoIdCampo(existentes), texto: '', opciones: [], correctas: [] });

/**
 * El campo con OTRO tipo: lo común (la pregunta, la ayuda, si es obligatorio) se queda, y lo del tipo
 * nuevo arranca con sus defaults. Las opciones pasan entre los tres tipos que las usan (una opción,
 * varias, checklist): cambiar de uno al otro es lo más común y no debería borrar lo escrito.
 */
function conTipo(c: Campo, tipo: Campo['tipo']): Campo {
  const n: Campo = { id: c.id, label: c.label, tipo };
  if (c.ayuda) n.ayuda = c.ayuda;
  if (c.obligatorio || tipo === 'quiz') n.obligatorio = true;
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

export function EditorCampos({ campos, onCampos, deshabilitado }: {
  campos: Campo[];
  onCampos: (c: Campo[]) => void;
  deshabilitado?: boolean;
}) {
  const cambiar = (i: number, parche: Partial<Campo>) =>
    onCampos(campos.map((c, j) => (j === i ? { ...c, ...parche } : c)));

  return (
    <div className="ec">
      {campos.map((c, i) => (
        <div key={c.id} className="ec-campo">
          <div className="ec-fila">
            <span className="ec-n">{i + 1}</span>
            <Input value={c.label} placeholder={c.tipo === 'confirmacion' ? 'Qué tiene que hacer' : 'La pregunta'} aria-label={`Pregunta del campo ${i + 1}`}
              disabled={deshabilitado} onChange={(e) => cambiar(i, { label: e.target.value })} />
            <Select value={c.tipo} width={150} ariaLabel="Tipo de campo" disabled={deshabilitado}
              options={TIPOS_CAMPO.map((t) => ({ value: t.value, label: t.label }))}
              onChange={(v) => onCampos(campos.map((x, j) => (j === i ? conTipo(x, v as Campo['tipo']) : x)))} />
            <IconButton small title="Subir" disabled={deshabilitado || i === 0} onClick={() => onCampos(moverEnLista(campos, i, 'arriba'))}>↑</IconButton>
            <IconButton small title="Bajar" disabled={deshabilitado || i === campos.length - 1} onClick={() => onCampos(moverEnLista(campos, i, 'abajo'))}>↓</IconButton>
            <IconButton small danger title="Quitar campo" disabled={deshabilitado} onClick={() => onCampos(campos.filter((_, j) => j !== i))}>✕</IconButton>
          </div>

          <div className="ec-cuerpo">
            <Input value={c.ayuda ?? ''} placeholder="Ayuda (opcional)" aria-label="Ayuda del campo"
              disabled={deshabilitado} onChange={(e) => cambiar(i, { ayuda: e.target.value })} />

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
              <EditorQuiz campo={c} deshabilitado={deshabilitado} onCambio={(parche) => cambiar(i, parche)} />
            )}

            <Checkbox checked={c.obligatorio === true || c.tipo === 'quiz'} disabled={deshabilitado || c.tipo === 'quiz'} label="Obligatorio"
              onChange={(v) => cambiar(i, { obligatorio: v || undefined })} />
          </div>
        </div>
      ))}

      <div>
        <Button size="sm" variant="secondary" disabled={deshabilitado}
          onClick={() => onCampos([...campos, { id: nuevoIdCampo(campos), label: '', tipo: 'texto' }])}>
          + Campo
        </Button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/**
 * Las preguntas de un quiz, con su correcta marcada al lado de cada opción, y abajo la nota mínima y
 * los intentos. Una pregunta de UNA respuesta marca como un radio (marcar otra desmarca la anterior).
 */
function EditorQuiz({ campo, deshabilitado, onCambio }: {
  campo: Campo; deshabilitado?: boolean; onCambio: (parche: Partial<Campo>) => void;
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
                onClick={() => onCambio({ preguntas: ps.filter((_, k) => k !== j) })}>✕</IconButton>
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

const CSS = `
.ec{ display:flex; flex-direction:column; gap:10px; }
.ec-campo{ border:1px solid var(--border); border-radius:var(--r-md); padding:10px; background:var(--surface-2); display:flex; flex-direction:column; gap:8px; }
.ec-fila{ display:flex; align-items:center; gap:6px; }
.ec-fila > .mk-input, .ec-fila > .mk-inputwrap{ flex:1; min-width:0; }
.ec-n{ flex:none; width:20px; text-align:center; font-size:var(--fs-meta); color:var(--dim); font-variant-numeric:tabular-nums; }
.ec-cuerpo{ display:flex; flex-direction:column; gap:8px; padding-left:26px; }
.ec-tabla{ display:grid; grid-template-columns:1fr 1fr 110px; gap:8px; align-items:start; }
.ec-par{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ec-mini{ font-size:var(--fs-meta); color:var(--dim); }
.ec-escala{ display:grid; grid-template-columns:150px 1fr 1fr; gap:8px; align-items:center; }
.ec-quiz{ display:flex; flex-direction:column; gap:10px; }
.ec-preg{ display:flex; flex-direction:column; gap:6px; padding:8px; border:1px solid var(--border); border-radius:var(--r-md); background:var(--surface); }
.ec-correctas{ display:flex; flex-wrap:wrap; align-items:center; gap:4px 14px; }
.ec-quiz-pie{ display:flex; flex-wrap:wrap; gap:8px 18px; }
@media (max-width:640px){ .ec-tabla, .ec-escala{ grid-template-columns:1fr; } .ec-cuerpo{ padding-left:0; } }
`;
