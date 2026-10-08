'use client';

// =============================================================================
// MenuCurso — lo de ADENTRO del menú «…» de un módulo y de una clase, en la tab Curso
// =============================================================================
// Pedido de Martín (07/10/2026, item 12): «Es importante un editor para los módulos, para poder
// "desvincularlo" del kanban... si quiero crear un módulo que NO sea una etapa dentro del kanban. Por
// defecto si lo son, pero se debería poder desvincular». Y el item 8, los candados.
//
// El BOTÓN «…» y el desplegable son del dibujo (app/_cursos/CursoUgc.tsx, `edicion.menuModulo` y
// `menuClase`), que no sabe de etapas ni de candados: lo de adentro lo arma esta pantalla.
//
//   · Un MÓDULO: renombrar (pone a editar su nombre en la tarjeta), la portada, «Es una etapa del
//     kanban» con su consecuencia en una frase, cuándo se abre, y borrar (sólo uno suelto y vacío).
//   · Una CLASE: cuándo se abre, «Por área», moverla a otro módulo y borrarla.
//
// ⚠️ TODO LO QUE ESCRIBE PASA POR LA PANTALLA (CursoApp), que tiene el producto, el estado local y el
//    aviso: esto sólo dice QUÉ se pidió. Y el server vuelve a validar cada cosa
//    (./modulos-actions.ts).
// ⚠️ LA CONSECUENCIA VA PEGADA AL CONTROL Y ANTES DEL CLIC (AGENTS.md): desvincular deja la columna
//    del kanban (los clientes no se mueven), y vincular crea una columna NUEVA.
// ⚠️ TEXTOS CORTOS Y EN TÚ: lo lee el equipo del negocio.

import { useState } from 'react';
import { ItemMenuUgc, TituloMenuUgc } from '@/app/_cursos/CursoUgc';
import type { ControlMenuUgc } from '@/app/_cursos/tipos';
import type { Bloqueo, ObjetoBloqueo } from '@/lib/curso-bloqueo';
import type { ModuloCurso } from '@/lib/curso-modulos';
import { NIVEL_MAX } from '@/lib/comunidad-niveles';
import {
  bloqueoDeOpcion, clasesParaTarea, datosDe, faltaDato, opcionDe, opcionesDeBloqueo,
  type DatosBloqueo, type OpcionBloqueo,
} from './bloqueo-editor';

/** Una clase, en lo que el menú necesita para elegirla (el candado `tarea`). */
export type ClaseParaMenu = { id: number; etapa: string; titulo: string };

/** Lo que devuelve guardar algo del menú: `null` = quedó; un texto = por qué no (se dibuja). */
type Guardado = Promise<string | null>;

export function MenuModulo({ modulo, conClases, clases, ctl, ocupado, onPortada, onVincular, onBloqueo, onBorrar, onMover }: {
  modulo: ModuloCurso;
  /** Cuántas clases tiene: borrar es sólo de un suelto VACÍO. */
  conClases: number;
  /** Las clases del producto, para el candado «Al terminar otra clase». */
  clases: readonly ClaseParaMenu[];
  ctl: ControlMenuUgc;
  ocupado: boolean;
  onPortada?: (ancla: HTMLElement) => void;
  onVincular: (vincular: boolean) => Guardado;
  onBloqueo: (b: Bloqueo | null) => Guardado;
  onBorrar: () => void;
  /**
   * «Mover antes / después»: lo mismo que arrastrarlo un lugar, para quien no puede arrastrar (el
   * teclado, una pantalla táctil, donde el arrastre nativo no existe). `null` en una punta.
   */
  onMover: { antes: (() => void) | null; despues: (() => void) | null };
}) {
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const vincular = async (v: boolean) => {
    setCambiando(true);
    setError(await onVincular(v));
    setCambiando(false);
  };
  return (
    <>
      {ctl.renombrar && <ItemMenuUgc onClick={ctl.renombrar}>Renombrar</ItemMenuUgc>}
      {onPortada && (
        <ItemMenuUgc onClick={() => { const a = ctl.ancla; ctl.cerrar(); if (a) onPortada(a); }}>Portada</ItemMenuUgc>
      )}
      <ItemMenuUgc disabled={ocupado || !onMover.antes} onClick={() => { ctl.cerrar(); onMover.antes?.(); }}>Mover antes</ItemMenuUgc>
      <ItemMenuUgc disabled={ocupado || !onMover.despues} onClick={() => { ctl.cerrar(); onMover.despues?.(); }}>Mover después</ItemMenuUgc>
      <div className="ugc-menu-sep" />
      <div className="ugc-menu-bloque">
        <label className="ugc-menu-check">
          <input type="checkbox" checked={modulo.vinculado} disabled={ocupado || cambiando}
            onChange={(e) => void vincular(e.target.checked)} />
          Es una etapa del kanban
        </label>
        {/* La consecuencia del cambio, ANTES de hacerlo. */}
        <p className="ugc-menu-nota">
          {modulo.vinculado ? 'Al desmarcarlo, su columna sigue en el kanban.' : 'Al marcarlo, se crea su columna en el kanban.'}
        </p>
      </div>
      {error && <p className="ugc-menu-error" role="alert">{error}</p>}
      <div className="ugc-menu-sep" />
      <TituloMenuUgc>Se abre</TituloMenuUgc>
      <SelectorBloqueo objeto={modulo.vinculado ? 'vinculado' : 'suelto'} valor={modulo.bloqueo}
        clases={clasesParaTarea(clases, { modulo: modulo.clave })} ocupado={ocupado} onGuardar={onBloqueo} />
      {/* Borrar: sólo un SUELTO VACÍO. Una etapa se borra en el kanban (tiene clientes adentro), y uno
          con clases se llevaría el avance de cada alumno (lib/curso-modulos-datos.ts, `borrarModulo`). */}
      {!modulo.vinculado && conClases === 0 && (
        <>
          <div className="ugc-menu-sep" />
          <ItemMenuUgc peligro disabled={ocupado} onClick={() => { ctl.cerrar(); onBorrar(); }}>Borrar módulo</ItemMenuUgc>
        </>
      )}
    </>
  );
}

export function MenuClase({ clase, modulos, clases, ctl, ocupado, onPortada, onBloqueo, onPorArea, onMover, onBorrar }: {
  clase: ClaseParaMenu & { bloqueo?: Bloqueo | null; porArea?: boolean };
  /** Los módulos del curso: a dónde se la puede mover. */
  modulos: readonly Pick<ModuloCurso, 'clave' | 'nombre'>[];
  clases: readonly ClaseParaMenu[];
  ctl: ControlMenuUgc;
  ocupado: boolean;
  onPortada?: (ancla: HTMLElement) => void;
  onBloqueo: (b: Bloqueo | null) => Guardado;
  onPorArea: (v: boolean) => Guardado;
  /** Al FINAL de ese módulo (lo mismo que soltarla sobre él en la barra). */
  onMover: (clave: string) => void;
  onBorrar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const otros = modulos.filter((m) => m.clave !== clase.etapa);
  return (
    <>
      {onPortada && (
        <ItemMenuUgc onClick={() => { const a = ctl.ancla; ctl.cerrar(); if (a) onPortada(a); }}>Portada</ItemMenuUgc>
      )}
      <TituloMenuUgc>Se abre</TituloMenuUgc>
      <SelectorBloqueo objeto="clase" valor={clase.bloqueo ?? null} propia={clase.id}
        clases={clasesParaTarea(clases, { clase: clase.id })} ocupado={ocupado} onGuardar={onBloqueo} />
      <div className="ugc-menu-sep" />
      <div className="ugc-menu-bloque">
        <label className="ugc-menu-check">
          <input type="checkbox" checked={!!clase.porArea} disabled={ocupado}
            onChange={async (e) => setError(await onPorArea(e.target.checked))} />
          Por área
        </label>
        <p className="ugc-menu-nota">Cada área del cliente contesta su tarea.</p>
        {otros.length > 0 && (
          <label className="ugc-menu-campo">
            Mover a
            <select value="" disabled={ocupado} onChange={(e) => { const k = e.target.value; if (!k) return; ctl.cerrar(); onMover(k); }}>
              <option value="">Elige un módulo</option>
              {otros.map((m) => <option key={m.clave} value={m.clave}>{m.nombre}</option>)}
            </select>
          </label>
        )}
      </div>
      {error && <p className="ugc-menu-error" role="alert">{error}</p>}
      <div className="ugc-menu-sep" />
      <ItemMenuUgc peligro disabled={ocupado} onClick={() => { ctl.cerrar(); onBorrar(); }}>Borrar clase</ItemMenuUgc>
    </>
  );
}

/**
 * Cuándo se abre un módulo o una clase (D2): una lista corta con las opciones del contrato y, si la
 * opción lo pide, su dato (los días, la fecha, la clase, el nivel). Se guarda en el acto; una opción
 * que pide un dato que todavía no hay (una fecha, una clase) espera a que lo elijan.
 *
 * ⚠️ LO QUE MUESTRA SE RESINCRONIZA CON LO QUE CONTESTÓ EL SERVER (`valor`): si rebota, vuelve a lo
 *    guardado y dice por qué.
 */
function SelectorBloqueo({ objeto, valor, clases, propia, ocupado, onGuardar }: {
  objeto: ObjetoBloqueo;
  valor: Bloqueo | null;
  clases: readonly ClaseParaMenu[];
  /** El id de la clase, si es el candado de una clase. */
  propia?: number;
  ocupado: boolean;
  onGuardar: (b: Bloqueo | null) => Guardado;
}) {
  const firma = JSON.stringify(valor);
  const [base, setBase] = useState(firma);
  const [opcion, setOpcion] = useState<OpcionBloqueo>(() => opcionDe(objeto, valor));
  const [datos, setDatos] = useState<DatosBloqueo>(() => datosDe(valor));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  if (base !== firma) { setBase(firma); setOpcion(opcionDe(objeto, valor)); setDatos(datosDe(valor)); }

  const guardar = async (op: OpcionBloqueo, d: DatosBloqueo) => {
    if (faltaDato(op, d)) { setError(null); return; }
    const r = bloqueoDeOpcion(objeto, op, d, propia != null ? { claseId: propia } : undefined);
    if (!r.ok) { setError(r.error); return; }
    if (JSON.stringify(r.bloqueo) === firma) { setError(null); return; }
    setGuardando(true);
    const e = await onGuardar(r.bloqueo);
    setGuardando(false);
    setError(e);
    // Si rebotó, lo de pantalla vuelve a lo guardado (que no cambió, así que la resincronización de
    // arriba no lo haría sola).
    if (e) { setOpcion(opcionDe(objeto, valor)); setDatos(datosDe(valor)); }
  };
  const cambiar = (d: Partial<DatosBloqueo>, guardarYa = true) => {
    const nuevos = { ...datos, ...d };
    setDatos(nuevos);
    if (guardarYa) void guardar(opcion, nuevos);
  };
  const apagado = ocupado || guardando;

  return (
    <div className="ugc-menu-bloque">
      <label className="ugc-menu-campo">
        Cuándo
        <select value={opcion} disabled={apagado}
          onChange={(e) => { const op = e.target.value as OpcionBloqueo; setOpcion(op); void guardar(op, datos); }}>
          {opcionesDeBloqueo(objeto).map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
        </select>
      </label>
      {opcion === 'dias' && (
        <label className="ugc-menu-campo">
          Días
          {/* Se guarda al salir del campo (o con Enter): uno por tecla serían cuatro guardados por un «120». */}
          <input type="number" min={0} max={3650} step={1} value={Number.isFinite(datos.dias) ? datos.dias : ''} disabled={apagado}
            onChange={(e) => cambiar({ dias: e.target.value === '' ? NaN : Number(e.target.value) }, false)}
            onBlur={() => void guardar(opcion, datos)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardar(opcion, datos); } }} />
        </label>
      )}
      {opcion === 'fecha' && (
        <label className="ugc-menu-campo">
          Fecha
          <input type="date" value={datos.fecha} disabled={apagado} onChange={(e) => cambiar({ fecha: e.target.value })} />
        </label>
      )}
      {opcion === 'tarea' && (
        <>
          <label className="ugc-menu-campo">
            Clase
            <select value={datos.claseId ?? ''} disabled={apagado}
              onChange={(e) => cambiar({ claseId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Elige una clase</option>
              {clases.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </label>
          <label className="ugc-menu-check">
            <input type="checkbox" checked={datos.aprobada} disabled={apagado || datos.claseId == null}
              onChange={(e) => cambiar({ aprobada: e.target.checked })} />
            Cuando la revisen
          </label>
        </>
      )}
      {opcion === 'nivel' && (
        <label className="ugc-menu-campo">
          Nivel
          <select value={datos.nivel} disabled={apagado} onChange={(e) => cambiar({ nivel: Number(e.target.value) })}>
            {Array.from({ length: NIVEL_MAX }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Nivel {n}</option>)}
          </select>
        </label>
      )}
      {error && <p className="ugc-menu-error" role="alert">{error}</p>}
    </div>
  );
}
