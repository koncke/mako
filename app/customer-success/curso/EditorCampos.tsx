'use client';

// =============================================================================
// EditorCampos — el formulario de la tarea de una clase
// =============================================================================
// Pedido de Martín (06/10/2026): «los formularios con las tareas para los clientes que
// Mauricio me había pedido». El molde de cada campo es el del programa viejo (`Campo` en
// lib/curso.ts, los 114 campos de sus Cuestionarios Maestros): texto, línea, número, una
// opción, varias, o una tabla con columnas y filas fijas.
//
// ⚠️ LAS LISTAS (opciones, columnas, filas) SE EDITAN UNA POR RENGLÓN y se guardan CRUDAS
// mientras se escribe: sin filtrar los renglones vacíos, porque filtrarlos en cada tecla se
// come el Enter y no hay forma de escribir la segunda opción. El saneo (`sanearCampos`) los
// limpia al guardar, en el server.
//
// ⚠️ EL ID DE UN CAMPO NO SE VE NI SE EDITA: las respuestas de los clientes se guardan por id
// (`curso_progreso.valores`), así que cambiar la pregunta no puede cambiar de quién son las
// respuestas. Ver `nuevoIdCampo`.

import type { Campo } from '@/lib/curso';
import { Button, IconButton, Input, Textarea, Select, Checkbox } from '@/app/_ui';
import { TIPOS_CAMPO, moverEnLista, nuevoIdCampo } from './reglas';

const lineas = (v: string[] | undefined) => (v ?? []).join('\n');
const aLista = (s: string) => s.split('\n');

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
            <Input value={c.label} placeholder="La pregunta" aria-label={`Pregunta del campo ${i + 1}`}
              disabled={deshabilitado} onChange={(e) => cambiar(i, { label: e.target.value })} />
            <Select value={c.tipo} width={150} ariaLabel="Tipo de campo" disabled={deshabilitado}
              options={TIPOS_CAMPO.map((t) => ({ value: t.value, label: t.label }))}
              onChange={(v) => cambiar(i, { tipo: v as Campo['tipo'] })} />
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

            <Checkbox checked={c.obligatorio === true} disabled={deshabilitado} label="Obligatorio"
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

const CSS = `
.ec{ display:flex; flex-direction:column; gap:10px; }
.ec-campo{ border:1px solid var(--border); border-radius:var(--r-md); padding:10px; background:var(--surface-2); display:flex; flex-direction:column; gap:8px; }
.ec-fila{ display:flex; align-items:center; gap:6px; }
.ec-fila > .mk-input, .ec-fila > .mk-inputwrap{ flex:1; min-width:0; }
.ec-n{ flex:none; width:20px; text-align:center; font-size:var(--fs-meta); color:var(--dim); font-variant-numeric:tabular-nums; }
.ec-cuerpo{ display:flex; flex-direction:column; gap:8px; padding-left:26px; }
.ec-tabla{ display:grid; grid-template-columns:1fr 1fr 110px; gap:8px; align-items:start; }
@media (max-width:640px){ .ec-tabla{ grid-template-columns:1fr; } .ec-cuerpo{ padding-left:0; } }
`;
