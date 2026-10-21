'use client';

// =============================================================================
// Confirmar ADENTRO del chat: el formulario de /mako/revisar en la tarjeta (20/10/2026, ola 1, pieza 1.10)
// =============================================================================
// docs/ops-center-principal.md §2.5: «La tarjeta despliega el MISMO formulario de /mako/revisar (RevisarAccion.tsx,
// armado desde `parametros`) con "Confirmar". "Abrir en la app" queda como salida secundaria». Los campos, su valor
// inicial y lo que se manda son los de la pantalla (app/mako/revisar/formulario.tsx); los botones dicen lo mismo que
// ella (`BOTONES_ESCRITORIO`); y confirma por la MISMA acción (`confirmarAccionAction`, por la ruta /api/mako/propuesta:
// app/_chat/acciones-formulario.ts dice por qué), que vuelve a validar, a mirar el permiso y a preparar contra la base. Al
// terminar, lo que dibuja el resultado (su G5, su «Abrir») queda acá mismo, sin recargar; el «Hecho: …» del hilo lo
// anota el server (1.8). Un trabajo largo deja su G6; cuando termina, el «En curso: …» se va y queda lo que dice el G6.
//
// ⚠️ LAS ACCIONES LLEGAN POR PROPS: así la pieza se dibuja en un test de node (el módulo de las acciones lleva
//    `server-only`). Sin acciones, el formulario se ve y no se toca.

import { useState } from 'react';
import Link from '@/app/_ui/Link';
import { Button } from '@/app/_ui';
import { Campo, armarPayload, valorInicial, type Valor } from '@/app/mako/revisar/formulario';
import { BOTONES_ESCRITORIO } from '@/app/m/inbox/inbox-ui';
import type { FormularioPropuesta } from '@/lib/mako-turno-app-reglas';
import type { Abrir, Bloque } from '@/lib/chat-bloques';
import { BloqueHilo } from './BloqueHilo';

/** `enCurso`: un trabajo largo que sigue por detrás (1.11); su avance es el G6 de `bloques`. */
export type ResultadoFormulario = { ok: true; resumen: string; bloques?: Bloque[]; abrir?: Abrir; enCurso?: true } | { ok: false; error: string };
export type AccionesFormulario = {
  confirmar: (id: string, payload: Record<string, unknown>) => Promise<ResultadoFormulario>;
  descartar: (id: string) => Promise<ResultadoFormulario>;
};

type Fase =
  | { fase: 'editando' | 'confirmando' | 'descartando' }
  | { fase: 'hecha'; resumen: string | null; bloques: Bloque[]; abrir?: Abrir; enCurso?: true }
  | { fase: 'descartada'; resumen: string };

export function FormularioEnChat({ f, acciones, abrirEnApp }: {
  f: FormularioPropuesta;
  acciones?: AccionesFormulario;
  /** La salida secundaria: la pantalla de revisión. */
  abrirEnApp: Abrir;
}) {
  const params = f.operacion.parametros;
  const [valores, setValores] = useState<Record<string, Valor>>(() =>
    Object.fromEntries(params.map((p) => [p.nombre, valorInicial(p, f.payload[p.nombre])])));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>({ fase: 'editando' });
  const enCurso = fase.fase === 'confirmando' || fase.fase === 'descartando';
  const quieto = !acciones || !f.puedeDecidir;

  const confirmar = async () => {
    if (!acciones || enCurso) return;
    setError(null);
    const armado = armarPayload(params, valores, f.payload);
    if ('errores' in armado) { setErrores(armado.errores); setError('Hay datos para corregir antes de confirmar.'); return; }
    setErrores({});
    setFase({ fase: 'confirmando' });
    try {
      const r = await acciones.confirmar(f.propuestaId, armado.payload);
      if (r.ok) { setFase({ fase: 'hecha', resumen: r.resumen, bloques: r.bloques ?? [], abrir: r.abrir, enCurso: r.enCurso }); return; }
      setError(r.error);
    } catch {
      // La acción pudo haber corrido igual: no se dice «no pasó», se dice que no se sabe.
      setError('No llegó la respuesta. Abre la propuesta para ver si se ejecutó.');
    }
    setFase({ fase: 'editando' });
  };

  const descartar = async () => {
    if (!acciones || enCurso) return;
    setError(null);
    setFase({ fase: 'descartando' });
    try {
      const r = await acciones.descartar(f.propuestaId);
      if (r.ok) { setFase({ fase: 'descartada', resumen: r.resumen }); return; }
      setError(r.error);
    } catch {
      setError('No llegó la respuesta. Abre la propuesta para ver en qué quedó.');
    }
    setFase({ fase: 'editando' });
  };

  if (fase.fase === 'hecha') {
    // El trabajo largo terminó: lo que pasó lo dice su G6 («Hecho: …», «No se pudo: …»), no un «En curso» que ya no es.
    const termina = fase.enCurso ? () => setFase((x) => (x.fase === 'hecha' ? { ...x, enCurso: undefined, resumen: null } : x)) : undefined;
    return (
      <div className="ch-form" data-fase="hecha">
        {fase.resumen != null && <p className="ch-tarjeta__nota" role="status">{fase.enCurso ? fase.resumen : `Hecho: ${fase.resumen}`}</p>}
        {fase.bloques.map((b, i) => <BloqueHilo key={i} b={b} onTermina={b.t === 'trabajo' ? termina : undefined} />)}
        {fase.abrir && <div className="ch-tarjeta__botones"><Link className="ch-abrir" href={fase.abrir.href}>{fase.abrir.titulo}</Link></div>}
      </div>
    );
  }
  if (fase.fase === 'descartada') return <p className="ch-tarjeta__nota" role="status">{fase.resumen}</p>;

  return (
    <div className="ch-form" data-fase="editando">
      {params.length === 0 && <p className="ch-tarjeta__nota">No lleva datos: se hace tal como dice arriba.</p>}
      {params.map((p) => (
        <Campo key={p.nombre} p={p} valor={valores[p.nombre]} error={errores[p.nombre]} disabled={enCurso || quieto || !!p.fijoAlRevisar}
          onChange={(nv) => setValores((prev) => ({ ...prev, [p.nombre]: nv }))} />
      ))}
      {error && <p className="ch-tarjeta__nota ch-form__error" role="alert">{error}</p>}
      {/* G3: la consecuencia pegada al botón; lo que no se deshace, en rojo. */}
      <p className={`ch-tarjeta__consecuencia${f.operacion.reversible ? '' : ' ch-tarjeta__consecuencia--irreversible'}`}>
        {f.operacion.reversible ? `Al confirmar: ${f.operacion.escribe}. Se puede deshacer desde su tab.` : `No se puede deshacer. Al confirmar: ${f.operacion.escribe}.`}
      </p>
      {f.puedeDecidir ? (
        <div className="ch-tarjeta__botones">
          <Button variant="primary" size="sm" loading={fase.fase === 'confirmando'} disabled={enCurso || quieto} onClick={() => { void confirmar(); }}>
            {BOTONES_ESCRITORIO.accion.primario}
          </Button>
          <Button variant="tertiary" size="sm" loading={fase.fase === 'descartando'} disabled={enCurso || quieto} onClick={() => { void descartar(); }}>
            {BOTONES_ESCRITORIO.accion.salida}
          </Button>
          <Link className="ch-enlace ch-form__afuera" href={abrirEnApp.href}>{abrirEnApp.titulo}</Link>
        </div>
      ) : (
        <>
          <p className="ch-tarjeta__nota">Sólo el administrador del negocio la confirma.</p>
          <div className="ch-tarjeta__botones"><Link className="ch-abrir" href={abrirEnApp.href}>{abrirEnApp.titulo}</Link></div>
        </>
      )}
    </div>
  );
}
