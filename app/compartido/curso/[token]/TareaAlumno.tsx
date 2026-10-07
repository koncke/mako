'use client';

// =============================================================================
// TareaAlumno — la tarea de una clase, como la contesta el cliente en su portal
// =============================================================================
// Los seis tipos de campo del programa de Mauricio (texto, línea, número, elección, casillas y
// tabla con columnas y filas fijas o un mínimo de filas), o una respuesta libre si la clase no
// trae campos. «Guardar» deja el borrador; «Enviar» la marca enviada si alcanza
// (`respuestaCompleta`, en el server) y puede pasar al cliente a la etapa siguiente.
//
// Tres decisiones:
//   · MIENTRAS ESTÁ PENDIENTE, SE GUARDA SOLO (unos segundos después de dejar de escribir, y por
//     `sendBeacon` al cerrar la pestaña). Es un empresario contestando preguntas largas desde el
//     teléfono: un «Guardar» que no se toca pierde media hora de trabajo (lo aprendió el
//     cuaderno del programa viejo, 07d07139^:app/compartido/[token]/TareaCliente.tsx).
//   · YA ENVIADA, SE LEE Y NO SE TOCA hasta «Editar». Ahí no hay autoguardado: el borrador de
//     una tarea que Mauricio ya revisó cambiaría lo que él aprobó sin que nadie la reenvíe. Se
//     edita y se ENVÍA de nuevo (y vuelve a quedar para revisar).
//   · ANTES DE ENVIAR SE MIRA QUÉ FALTA (`queFalta`, misma regla que el server pero sin contar
//     la etiqueta de una fila fija como contestada) y se dice en una frase.
//
// Texto de pantalla: español neutro con TÚ (los clientes de Mauricio son mexicanos), corto.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Campo, EstadoTarea, Valores, ValorCampo } from '@/lib/curso';
import { Button, Input, Textarea, Radio, Checkbox } from '@/app/_ui';
import { filasDeTabla, filaVacia, queFalta, fraseQueFalta } from './tarea-valores';
import { useVistaPrevia } from './vista-previa';

const URL_TAREA = '/api/compartido/curso/tarea';
const RESPIRO_MS = 2500;

type Guardado = 'limpio' | 'sucio' | 'guardando' | 'guardado' | 'error';
type Respuesta = {
  ok?: boolean;
  progreso?: { estado: EstadoTarea; valores: Valores };
  faltaCompletar?: boolean;
  avance?: { movido: boolean; hacia: string | null } | null;
};

export default function TareaAlumno({ token, claseId, tarea, campos, valoresIniciales, estadoInicial, onEstado, onAvance }: {
  token: string;
  claseId: number;
  /** La instrucción de llenado que escribió Mauricio. */
  tarea: string;
  campos: Campo[];
  valoresIniciales: Valores;
  estadoInicial: EstadoTarea;
  onEstado: (e: EstadoTarea) => void;
  /** El envío completó la etapa y el cliente pasó a la siguiente. */
  onAvance: () => void;
}) {
  const previa = useVistaPrevia();
  const [valores, setValores] = useState<Valores>(valoresIniciales);
  const [estado, setEstado] = useState<EstadoTarea>(estadoInicial);
  const [editando, setEditando] = useState(estadoInicial === 'pendiente');
  const [guardado, setGuardado] = useState<Guardado>('limpio');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'falta' | 'ok' | 'error'; texto: string } | null>(null);

  const timer = useRef<number | undefined>(undefined);
  const ultimo = useRef<Valores>(valoresIniciales);
  // Lo último que quedó ENVIADO: «Descartar cambios» vuelve acá, no a lo que trajo la página.
  const base = useRef<Valores>(valoresIniciales);
  const sucio = useRef(false);
  // El autoguardado sólo corre en una tarea PENDIENTE (ver la cabecera).
  const autoguarda = estado === 'pendiente';

  const mandar = useCallback(async (v: Valores, enviar: boolean): Promise<Respuesta | null> => {
    // ⚠️ VISTA PREVIA DEL EQUIPO: no hay alumno, así que no sale nada (./vista-previa.ts). Se
    // contesta en local lo mismo que contestaría el server, para que el formulario se pueda
    // probar entero; el pie del portal dice que no se guarda.
    if (previa) return { ok: true, progreso: { estado: enviar ? 'enviada' : 'pendiente', valores: v }, faltaCompletar: false, avance: null };
    try {
      const r = await fetch(URL_TAREA, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: token, c: claseId, valores: v, enviar }),
      });
      if (!r.ok) return null;
      return (await r.json()) as Respuesta;
    } catch {
      return null;
    }
  }, [previa, token, claseId]);

  const guardarBorrador = useCallback(async (v: Valores) => {
    window.clearTimeout(timer.current);
    setGuardado('guardando');
    const j = await mandar(v, false);
    if (!j?.ok) { setGuardado('error'); return; }
    if (ultimo.current === v) sucio.current = false;
    setGuardado((g) => (g === 'guardando' ? 'guardado' : g));
  }, [mandar]);

  const cambiar = (id: string, valor: ValorCampo) => {
    const v = { ...valores, [id]: valor };
    setValores(v);
    ultimo.current = v;
    sucio.current = true;
    setAviso(null);
    setGuardado('sucio');
    if (!autoguarda) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void guardarBorrador(v); }, RESPIRO_MS);
  };

  // Al cerrar u ocultar la pestaña con algo sin guardar: `sendBeacon` sobrevive a la navegación,
  // un `fetch` normal no. Sólo el borrador de una tarea pendiente (nunca un envío).
  useEffect(() => {
    const salir = () => {
      if (previa || !autoguarda || !sucio.current || typeof navigator.sendBeacon !== 'function') return;
      const ok = navigator.sendBeacon(URL_TAREA, new Blob(
        [JSON.stringify({ t: token, c: claseId, valores: ultimo.current, enviar: false })],
        { type: 'text/plain' },
      ));
      if (ok) sucio.current = false;
    };
    const alOcultar = () => { if (document.visibilityState === 'hidden') salir(); };
    window.addEventListener('pagehide', salir);
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      window.removeEventListener('pagehide', salir);
      document.removeEventListener('visibilitychange', alOcultar);
      window.clearTimeout(timer.current);
      salir();
    };
  }, [previa, autoguarda, token, claseId]);

  async function enviar() {
    window.clearTimeout(timer.current);
    const falta = queFalta(campos, valores);
    if (falta) {
      // No se manda un envío que va a rebotar: se guarda el borrador y se dice qué falta.
      setAviso({ tono: 'falta', texto: fraseQueFalta(falta) });
      if (autoguarda && sucio.current) void guardarBorrador(valores);
      return;
    }
    setEnviando(true);
    setAviso(null);
    const j = await mandar(valores, true);
    setEnviando(false);
    if (!j?.ok || !j.progreso) { setAviso({ tono: 'error', texto: 'No se pudo enviar. Intenta de nuevo.' }); return; }
    if (j.faltaCompletar) { setAviso({ tono: 'falta', texto: 'Faltan respuestas obligatorias.' }); return; }
    sucio.current = false;
    base.current = j.progreso.valores;
    ultimo.current = j.progreso.valores;
    setValores(j.progreso.valores);
    setGuardado('limpio');
    setEstado(j.progreso.estado);
    onEstado(j.progreso.estado);
    setEditando(false);
    if (j.avance?.movido) {
      setAviso({ tono: 'ok', texto: '¡Etapa completada!' });
      onAvance();
    } else {
      setAviso({ tono: 'ok', texto: 'Tarea enviada.' });
    }
  }

  function descartar() {
    window.clearTimeout(timer.current);
    setValores(base.current);
    ultimo.current = base.current;
    sucio.current = false;
    setGuardado('limpio');
    setAviso(null);
    setEditando(false);
  }

  const soloLectura = !editando;

  return (
    <section className="cp-tarea" aria-label="Tarea">
      <div className="cp-tarea-cab">
        <span className="cp-eyebrow">Tarea</span>
      </div>
      {tarea.trim() && <p className="cp-tarea-instr">{tarea}</p>}

      {campos.length ? (
        <ol className="cp-campos">
          {campos.map((c) => (
            <li key={c.id} className="cp-campo">
              <CampoAlumno campo={c} valor={valores[c.id]} soloLectura={soloLectura} onCambio={(v) => cambiar(c.id, v)} />
            </li>
          ))}
        </ol>
      ) : (
        <Textarea
          aria-label="Tu respuesta"
          placeholder="Escribe tu respuesta"
          value={typeof valores.respuesta === 'string' ? valores.respuesta : ''}
          onChange={(e) => cambiar('respuesta', e.target.value)}
          readOnly={soloLectura}
          rows={5}
        />
      )}

      {aviso && <p className={`cp-aviso cp-aviso--${aviso.tono}`} role="status">{aviso.texto}</p>}

      <div className="cp-tarea-pie">
        {editando ? (
          <>
            <Button onClick={() => void enviar()} loading={enviando}>
              {estado === 'pendiente' ? 'Enviar' : 'Enviar de nuevo'}
            </Button>
            {estado === 'pendiente' ? (
              <Button variant="secondary" onClick={() => void guardarBorrador(valores)} disabled={enviando || guardado === 'guardando'}>
                Guardar
              </Button>
            ) : (
              <Button variant="tertiary" onClick={descartar} disabled={enviando}>Descartar cambios</Button>
            )}
            {estado === 'pendiente' && <span className={`cp-guardado cp-guardado--${guardado}`}>{TEXTO_GUARDADO[guardado]}</span>}
          </>
        ) : (
          <Button variant="secondary" onClick={() => { setEditando(true); setAviso(null); }}>Editar</Button>
        )}
      </div>
    </section>
  );
}

const TEXTO_GUARDADO: Record<Guardado, string> = {
  limpio: '',
  sucio: 'Sin guardar',
  guardando: 'Guardando…',
  guardado: 'Guardado',
  error: 'No se guardó',
};

// ── Los seis tipos de campo ───────────────────────────────────────────────────

function CampoAlumno({ campo, valor, soloLectura, onCambio }: {
  campo: Campo; valor: ValorCampo | undefined; soloLectura: boolean; onCambio: (v: ValorCampo) => void;
}) {
  const id = `cp-c-${campo.id}`;
  const rotulo = (
    <>
      {campo.label}
      {campo.obligatorio && <span className="cp-req" aria-label="obligatoria"> *</span>}
    </>
  );
  const ayuda = campo.ayuda ? <p className="cp-ayuda">{campo.ayuda}</p> : null;
  // Un control solo lleva <label>; un grupo (opciones, tabla) lleva <legend>, que no admite
  // párrafos adentro: la ayuda va debajo.
  const cabeza = (
    <>
      <label className="cp-preg" htmlFor={id}>{rotulo}</label>
      {ayuda}
    </>
  );

  if (campo.tipo === 'eleccion') {
    const actual = typeof valor === 'string' ? valor : '';
    return (
      <fieldset className="cp-fieldset">
        <legend className="cp-preg">{rotulo}</legend>
        {ayuda}
        {(campo.opciones ?? []).map((o) => (
          <Radio key={o} name={id} checked={actual === o} disabled={soloLectura} onChange={(on) => { if (on) onCambio(o); }} label={o} />
        ))}
      </fieldset>
    );
  }

  if (campo.tipo === 'checks') {
    const marcadas = Array.isArray(valor) && !Array.isArray(valor[0]) ? (valor as string[]) : [];
    return (
      <fieldset className="cp-fieldset">
        <legend className="cp-preg">{rotulo}</legend>
        {ayuda}
        {(campo.opciones ?? []).map((o) => (
          <Checkbox key={o} checked={marcadas.includes(o)} disabled={soloLectura}
            onChange={(on) => onCambio(on ? [...marcadas, o] : marcadas.filter((x) => x !== o))} label={o} />
        ))}
      </fieldset>
    );
  }

  if (campo.tipo === 'tabla') {
    return (
      <fieldset className="cp-fieldset">
        <legend className="cp-preg">{rotulo}</legend>
        {ayuda}
        <Tabla campo={campo} valor={valor} soloLectura={soloLectura} onCambio={onCambio} />
      </fieldset>
    );
  }

  if (campo.tipo === 'linea' || campo.tipo === 'numero') {
    return (
      <div>
        {cabeza}
        <Input
          id={id}
          type="text"
          inputMode={campo.tipo === 'numero' ? 'decimal' : undefined}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onCambio(e.target.value)}
          readOnly={soloLectura}
        />
      </div>
    );
  }

  return (
    <div>
      {cabeza}
      <Textarea id={id} rows={4} value={typeof valor === 'string' ? valor : ''} onChange={(e) => onCambio(e.target.value)} readOnly={soloLectura} />
    </div>
  );
}

/**
 * La tabla, como tabla. En el teléfono cada fila pasa a ser un bloque con sus columnas
 * rotuladas (el CSS de `.cp-tabla`): cinco columnas en 375 px no se leen, y un scroll lateral
 * adentro de un formulario largo se pierde.
 */
function Tabla({ campo, valor, soloLectura, onCambio }: {
  campo: Campo; valor: ValorCampo | undefined; soloLectura: boolean; onCambio: (v: ValorCampo) => void;
}) {
  const cols = campo.columnas?.length ? campo.columnas : [''];
  const filas = filasDeTabla(campo, valor);
  const fijas = campo.filasFijas?.length ?? 0;
  const set = (i: number, j: number, v: string) => {
    const n = filas.map((f) => [...f]);
    n[i][j] = v;
    onCambio(n);
  };
  return (
    <div className="cp-tabla-caja">
      <table className="cp-tabla">
        <thead>
          <tr>{cols.map((c, j) => <th key={j} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {cols.map((col, j) => (
                <td key={j} data-col={col}>
                  {j === 0 && i < fijas ? (
                    <span className="cp-fija">{fila[0]}</span>
                  ) : (
                    <input
                      className="cp-celda"
                      value={fila[j] ?? ''}
                      onChange={(e) => set(i, j, e.target.value)}
                      readOnly={soloLectura}
                      aria-label={`${col || 'Valor'}, fila ${i + 1}`}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!fijas && !soloLectura && (
        <Button variant="tertiary" size="sm" onClick={() => onCambio([...filas, filaVacia(campo)])}>Agregar fila</Button>
      )}
    </div>
  );
}
