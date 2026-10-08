'use client';

// =============================================================================
// MenuCurso — lo de ADENTRO del menú «…» de un módulo y de una clase, en la tab Curso
// =============================================================================
// Pedido de Martín (08/10/2026, item 15), mirando los dos menús uno al lado del otro: «los tres puntos
// al editar un modulo o clase, el desplegable es diferente. Debería ser igual». Desde entonces es UN
// menú con la MISMA forma para los dos, y la forma vive en `seccionesDelMenu` (./estructura.ts, pura y
// con test), no repetida en dos componentes:
//
//   Renombrar · Portada · Mover antes · Mover después
//   ───
//   Acceso: Público | Privado (y si es privado, cuándo se abre)
//   ───
//   (sólo un módulo) Etapa del kanban — un interruptor
//   ───
//   Eliminar módulo / Eliminar clase (en rojo)
//
// «Por área» SALIÓ de acá («No entiendo eso de "Por área"»): es de la tarea, y vive con ella.
//
// El BOTÓN «…» y el desplegable son del dibujo (app/_cursos/CursoUgc.tsx, `edicion.menuModulo` y
// `menuClase`), que no sabe de etapas ni de candados: lo de adentro lo arma esta pantalla.
//
// ⚠️ TODO LO QUE ESCRIBE PASA POR LA PANTALLA (CursoApp), que tiene el producto, el estado local, el
//    aviso con su «Deshacer» y las preguntas: esto sólo dice QUÉ se pidió. El server vuelve a validar
//    cada cosa (./modulos-actions.ts).
// ⚠️ LA CONSECUENCIA VA PEGADA AL CONTROL Y ANTES DEL CLIC (AGENTS.md): apagar «Etapa del kanban» la
//    QUITA del kanban (desde el 08/10/2026: antes quedaba la columna), y prenderlo la crea.
// ⚠️ LO QUE ABRE UNA PREGUNTA CIERRA EL MENÚ ANTES (el interruptor, eliminar): la pregunta es un
//    diálogo de la app, afuera del curso, y un clic en él contaría como «afuera» del menú.
// ⚠️ TEXTOS CORTOS Y EN TÚ: lo lee el equipo del negocio.

import { Fragment, useRef, useState, type ReactNode } from 'react';
import { ItemMenuUgc } from '@/app/_cursos/CursoUgc';
import type { ControlMenuUgc } from '@/app/_cursos/tipos';
import type { Bloqueo, ObjetoBloqueo } from '@/lib/curso-bloqueo';
import { ERROR_ENTRADA, type ModuloCurso } from '@/lib/curso-modulos';
import { NIVEL_MAX } from '@/lib/comunidad-niveles';
import {
  accesoDe, bloqueoDeOpcion, bloqueoPublico, clasesParaTarea, datosDe, faltaDato, opcionDe, opcionesPrivado, privadoInicial,
  type Acceso, type DatosBloqueo, type OpcionBloqueo,
} from './bloqueo-editor';
import { seccionesDelMenu, type ItemMenuEstructura } from './estructura';
import { TOPE_TITULO } from './reglas';

/** Una clase, en lo que el menú necesita para elegirla (el candado `tarea`). */
export type ClaseParaMenu = { id: number; etapa: string; titulo: string };

/** Lo que devuelve guardar algo del menú: `null` = quedó; un texto = por qué no (se dibuja). */
type Guardado = Promise<string | null>;

/** «Mover antes / después»: lo mismo que arrastrarlo un lugar. `null` en una punta (no hay a dónde). */
type Mover = { antes: (() => void) | null; despues: (() => void) | null };

/**
 * Dibuja las secciones de `seccionesDelMenu` EN SU ORDEN, con una línea entre dos. Lo que una sección
 * no tiene (sin portada, porque no se pudo leer el estilo) no deja una línea de más.
 */
function Secciones({ tipo, items }: { tipo: 'modulo' | 'clase'; items: Partial<Record<ItemMenuEstructura, ReactNode>> }) {
  const secciones = seccionesDelMenu(tipo)
    .map((s) => s.filter((k) => items[k] != null))
    .filter((s) => s.length > 0);
  return (
    <div className="cu-menu" data-menu={tipo}>
      {secciones.map((s, i) => (
        <Fragment key={s.join('-')}>
          {i > 0 && <div className="ugc-menu-sep" />}
          {s.map((k) => <Fragment key={k}>{items[k]}</Fragment>)}
        </Fragment>
      ))}
    </div>
  );
}

/** Lo de arriba, igual para los dos: portada y mover. Renombrar lo pone cada uno (cambia el cómo). */
function itemsDeArriba(ctl: ControlMenuUgc, ocupado: boolean, onPortada: ((ancla: HTMLElement) => void) | undefined, onMover: Mover) {
  return {
    portada: onPortada ? <ItemMenuUgc onClick={() => { const a = ctl.ancla; ctl.cerrar(); if (a) onPortada(a); }}>Portada</ItemMenuUgc> : null,
    'mover-antes': <ItemMenuUgc disabled={ocupado || !onMover.antes} onClick={() => { ctl.cerrar(); onMover.antes?.(); }}>Mover antes</ItemMenuUgc>,
    'mover-despues': <ItemMenuUgc disabled={ocupado || !onMover.despues} onClick={() => { ctl.cerrar(); onMover.despues?.(); }}>Mover después</ItemMenuUgc>,
  };
}

export function MenuModulo({ modulo, entrada, clases, ctl, ocupado, onPortada, onMover, onBloqueo, onKanban, onEliminar }: {
  modulo: ModuloCurso;
  /** ¿Es la PRIMERA etapa del kanban? La entrada no se quita ni se elimina (`ERROR_ENTRADA`). */
  entrada: boolean;
  /** Las clases del producto, para la condición «Con la tarea de otra clase». */
  clases: readonly ClaseParaMenu[];
  ctl: ControlMenuUgc;
  ocupado: boolean;
  onPortada?: (ancla: HTMLElement) => void;
  onMover: Mover;
  onBloqueo: (b: Bloqueo | null) => Guardado;
  /** El interruptor: lo que pase (la pregunta, el aviso con «Deshacer») lo resuelve la pantalla. */
  onKanban: (activo: boolean) => void;
  onEliminar: () => void;
}) {
  const objeto: ObjetoBloqueo = modulo.vinculado ? 'vinculado' : 'suelto';
  return (
    <Secciones tipo="modulo" items={{
      renombrar: ctl.renombrar ? <ItemMenuUgc disabled={ocupado} onClick={ctl.renombrar}>Renombrar</ItemMenuUgc> : null,
      ...itemsDeArriba(ctl, ocupado, onPortada, onMover),
      acceso: <AccesoMenu objeto={objeto} valor={modulo.bloqueo} ocupado={ocupado} onGuardar={onBloqueo}
        clases={clasesParaTarea(clases, { modulo: modulo.clave })} />,
      kanban: <InterruptorKanban activo={modulo.vinculado} entrada={entrada} ocupado={ocupado}
        onCambiar={(v) => { ctl.cerrar(); onKanban(v); }} />,
      eliminar: (
        <ItemMenuUgc peligro disabled={ocupado || entrada} title={entrada ? ERROR_ENTRADA : undefined}
          onClick={() => { ctl.cerrar(); onEliminar(); }}>Eliminar módulo</ItemMenuUgc>
      ),
    }} />
  );
}

export function MenuClase({ clase, clases, ctl, ocupado, onPortada, onRenombrar, onMover, onBloqueo, onEliminar }: {
  clase: ClaseParaMenu & { bloqueo?: Bloqueo | null };
  clases: readonly ClaseParaMenu[];
  ctl: ControlMenuUgc;
  ocupado: boolean;
  onPortada?: (ancla: HTMLElement) => void;
  /** El título nuevo. La tarjeta de una clase no tiene un texto que se edite con un clic: va acá adentro. */
  onRenombrar: (titulo: string) => Guardado;
  onMover: Mover;
  onBloqueo: (b: Bloqueo | null) => Guardado;
  onEliminar: () => void;
}) {
  return (
    <Secciones tipo="clase" items={{
      renombrar: <RenombrarEnMenu valor={clase.titulo} ocupado={ocupado} onGuardar={onRenombrar} />,
      ...itemsDeArriba(ctl, ocupado, onPortada, onMover),
      acceso: <AccesoMenu objeto="clase" valor={clase.bloqueo ?? null} propia={clase.id} ocupado={ocupado} onGuardar={onBloqueo}
        clases={clasesParaTarea(clases, { clase: clase.id })} />,
      eliminar: <ItemMenuUgc peligro disabled={ocupado} onClick={() => { ctl.cerrar(); onEliminar(); }}>Eliminar clase</ItemMenuUgc>,
    }} />
  );
}

/**
 * «Renombrar» de una clase: el renglón se vuelve un campo, acá mismo. Enter (o salir del campo) guarda;
 * un nombre vacío o igual no manda nada.
 *
 * ⚠️ UNA SOLA VEZ POR CAMBIO: apagar el campo mientras guarda le saca el foco, y el `blur` que eso
 *    dispara mandaría el mismo nombre otra vez (el `enCurso` lo frena).
 */
function RenombrarEnMenu({ valor, ocupado, onGuardar }: { valor: string; ocupado: boolean; onGuardar: (t: string) => Guardado }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enCurso = useRef(false);
  if (!abierto) {
    return <ItemMenuUgc disabled={ocupado} onClick={() => { setTexto(valor); setError(null); setAbierto(true); }}>Renombrar</ItemMenuUgc>;
  }
  const guardar = async () => {
    if (enCurso.current) return;
    const t = texto.replace(/\s+/g, ' ').trim();
    if (!t || t === valor.trim()) { setAbierto(false); return; }
    enCurso.current = true;
    setGuardando(true);
    const e = await onGuardar(t);
    setGuardando(false);
    enCurso.current = false;
    if (e) setError(e); else setAbierto(false);
  };
  return (
    <div className="ugc-menu-bloque">
      <label className="ugc-menu-campo">
        Nombre
        <input type="text" autoFocus value={texto} maxLength={TOPE_TITULO} disabled={guardando}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardar(); } }}
          onBlur={() => void guardar()} />
      </label>
      {error && <p className="ugc-menu-error" role="alert">{error}</p>}
    </div>
  );
}

/**
 * «Etapa del kanban»: un interruptor. Prendido = este módulo ES una columna del kanban.
 *
 * ⚠️ LA ENTRADA DEL KANBAN SE DIBUJA APAGADA (deshabilitada) Y DICE POR QUÉ: un control que desaparece
 *    no explica nada, y uno que se puede tocar y rebota se lee como roto.
 */
function InterruptorKanban({ activo, entrada, ocupado, onCambiar }: {
  activo: boolean; entrada: boolean; ocupado: boolean; onCambiar: (v: boolean) => void;
}) {
  return (
    <div className="ugc-menu-bloque">
      <button type="button" role="switch" aria-checked={activo} className="cu-menu-switch" disabled={ocupado || entrada}
        title={entrada ? ERROR_ENTRADA : undefined} onClick={() => onCambiar(!activo)}>
        <span className="cu-menu-switch-t">Etapa del kanban</span>
        <span className="cu-menu-switch-pista" aria-hidden><span className="cu-menu-switch-bola" /></span>
      </button>
      {/* La consecuencia, ANTES del clic. */}
      <p className="ugc-menu-nota">
        {entrada ? ERROR_ENTRADA : activo ? 'Apagarlo la quita del kanban.' : 'Prenderlo la crea en el kanban.'}
      </p>
    </div>
  );
}

/**
 * ACCESO: público o privado (08/10/2026, item 15). «Si es público cualquiera puede entrar, si es
 * privado ahí viene el condicional». Elegir guarda en el acto: Público es `bloqueoPublico` y Privado
 * arranca con `privadoInicial` (la condición que no pide datos), y después se elige cuál.
 *
 * ⚠️ LO QUE SE VE ES LO QUE SE PIDIÓ mientras el server contesta, y después lo que contestó (`valor`):
 *    si rebota, vuelve y dice por qué.
 */
function AccesoMenu({ objeto, valor, clases, propia, ocupado, onGuardar }: {
  objeto: ObjetoBloqueo;
  valor: Bloqueo | null;
  clases: readonly ClaseParaMenu[];
  propia?: number;
  ocupado: boolean;
  onGuardar: (b: Bloqueo | null) => Guardado;
}) {
  const [pedido, setPedido] = useState<Acceso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acceso = pedido ?? accesoDe(objeto, valor);
  const elegir = async (a: Acceso) => {
    if (a === acceso || pedido) return;
    setPedido(a);
    setError(await onGuardar(a === 'publico' ? bloqueoPublico(objeto) : privadoInicial(objeto)));
    setPedido(null);
  };
  const apagado = ocupado || pedido != null;
  return (
    <div className="ugc-menu-bloque">
      <div className="cu-menu-seg" role="group" aria-label="Acceso">
        <button type="button" aria-pressed={acceso === 'publico'} disabled={apagado} onClick={() => void elegir('publico')}>Público</button>
        <button type="button" aria-pressed={acceso === 'privado'} disabled={apagado} onClick={() => void elegir('privado')}>Privado</button>
      </div>
      {acceso === 'publico'
        ? <p className="ugc-menu-nota">Entra cualquiera con el curso.</p>
        : <SelectorCondicion objeto={objeto} valor={valor} clases={clases} propia={propia} ocupado={apagado} onGuardar={onGuardar} />}
      {error && <p className="ugc-menu-error" role="alert">{error}</p>}
    </div>
  );
}

/**
 * Cuándo se abre lo PRIVADO (D2): las condiciones del contrato (`opcionesPrivado`) y, si la opción lo
 * pide, su dato (los días, la fecha, la clase, el nivel). Se guarda en el acto; una opción que pide un
 * dato que todavía no hay (una fecha, una clase) espera a que lo elijan.
 *
 * ⚠️ LO QUE MUESTRA SE RESINCRONIZA CON LO QUE CONTESTÓ EL SERVER (`valor`): si rebota, vuelve a lo
 *    guardado y dice por qué.
 */
function SelectorCondicion({ objeto, valor, clases, propia, ocupado, onGuardar }: {
  objeto: ObjetoBloqueo;
  valor: Bloqueo | null;
  clases: readonly ClaseParaMenu[];
  /** El id de la clase, si es el candado de una clase. */
  propia?: number;
  ocupado: boolean;
  onGuardar: (b: Bloqueo | null) => Guardado;
}) {
  const opciones = opcionesPrivado(objeto);
  const opcionValida = (o: OpcionBloqueo): OpcionBloqueo => (opciones.some((x) => x.valor === o) ? o : opciones[0].valor);
  const firma = JSON.stringify(valor);
  const [base, setBase] = useState(firma);
  const [opcion, setOpcion] = useState<OpcionBloqueo>(() => opcionValida(opcionDe(objeto, valor)));
  const [datos, setDatos] = useState<DatosBloqueo>(() => datosDe(valor));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  if (base !== firma) { setBase(firma); setOpcion(opcionValida(opcionDe(objeto, valor))); setDatos(datosDe(valor)); }

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
    if (e) { setOpcion(opcionValida(opcionDe(objeto, valor))); setDatos(datosDe(valor)); }
  };
  const cambiar = (d: Partial<DatosBloqueo>, guardarYa = true) => {
    const nuevos = { ...datos, ...d };
    setDatos(nuevos);
    if (guardarYa) void guardar(opcion, nuevos);
  };
  const apagado = ocupado || guardando;

  return (
    <>
      <label className="ugc-menu-campo">
        Se abre
        <select value={opcion} disabled={apagado}
          onChange={(e) => { const op = e.target.value as OpcionBloqueo; setOpcion(op); void guardar(op, datos); }}>
          {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
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
            Cuando la aprueben
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
    </>
  );
}

/**
 * Lo propio de este menú adentro de la hoja del curso: el selector Público | Privado, el interruptor y
 * «Eliminar» en rojo de entrada (no sólo al pasar el cursor). Lo monta ./CursoApp.tsx junto con su
 * hoja. Todo acotado a `.cu-menu` (el contenedor de `Secciones`): la piel de un control va acotada a
 * su zona, o una regla de la hoja compartida pisa otra en silencio (hallazgos-customer-success, «Dos
 * reglas para el mismo selector»). Y con la especificidad de `.ahdoc.ahdoc--ugc .ugc`, que es la del
 * reset del origen (botones sin fondo ni borde).
 */
export const CSS_MENU_CURSO = `
.ahdoc.ahdoc--ugc .ugc .cu-menu .ugc-menu-item--peligro { color: #ffb4a6; }
.ahdoc.ahdoc--ugc .ugc .cu-menu .ugc-menu-item--peligro:disabled { color: var(--u-night-ink); }
.ahdoc.ahdoc--ugc .ugc .cu-menu .cu-menu-seg { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: rgba(255, 255, 255, .06); border: 1.5px solid var(--u-night-line); }
.ahdoc.ahdoc--ugc .ugc .cu-menu .cu-menu-seg button {
  flex: 1 1 0; min-height: 32px; padding: 5px 8px; border-radius: 7px; cursor: pointer; background: transparent; border: 0;
  font: 700 13px/1.2 var(--font-archivo), system-ui, sans-serif; color: var(--u-night-ink);
}
.ahdoc.ahdoc--ugc .ugc .cu-menu .cu-menu-seg button[aria-pressed="true"] { background: var(--u-lime); color: var(--u-ink); }
.ahdoc.ahdoc--ugc .ugc .cu-menu .cu-menu-seg button:disabled { cursor: default; opacity: .7; }
.ahdoc.ahdoc--ugc .ugc .cu-menu .cu-menu-switch {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 34px; padding: 4px 0;
  background: transparent; border: 0; cursor: pointer; text-align: left;
  font: 600 13px/1.3 var(--font-archivo), system-ui, sans-serif; color: var(--u-night-ink);
}
.ahdoc.ahdoc--ugc .ugc .cu-menu .cu-menu-switch:disabled { cursor: default; opacity: .55; }
.ahdoc.ahdoc--ugc .ugc .cu-menu .cu-menu-switch-pista {
  position: relative; flex: none; width: 38px; height: 22px; border-radius: 999px;
  background: rgba(255, 255, 255, .16); border: 1.5px solid var(--u-night-line); transition: background .15s;
}
.ahdoc.ahdoc--ugc .ugc .cu-menu .cu-menu-switch-bola {
  position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: var(--u-night-ink); transition: transform .15s;
}
.ahdoc.ahdoc--ugc .ugc .cu-menu .cu-menu-switch[aria-checked="true"] .cu-menu-switch-pista { background: var(--u-lime); border-color: var(--u-lime); }
.ahdoc.ahdoc--ugc .ugc .cu-menu .cu-menu-switch[aria-checked="true"] .cu-menu-switch-bola { transform: translateX(16px); background: var(--u-ink); }
`;
