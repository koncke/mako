'use client';

// =============================================================================
// FichaCurso — la pestaña «Curso» de la ficha de un cliente
// =============================================================================
// Pedido de Martín (06/10/2026): «Dentro del Detail de los clientes de Mauricio se tiene que
// ver este CURSO». Cuatro cosas, y es la pregunta que contesta cada una:
//   · ARRIBA, SU FILA DE AVANCE, de un vistazo: la MISMA fila que tiene en la tabla Avance de
//     la tab Curso (./curso/FilaAvance.tsx, mismas celdas y mismos números). Pedido del mismo
//     día: «el "Avence" del curso debería también verse en el detail de cada cliente».
//   · El AVANCE clase por clase: sus etapas en orden con la actual marcada, y por clase cuánto
//     vio, en qué quedó su tarea y —al abrirla— lo que contestó. Es el «quién miró tal clase,
//     quién completó la tarea» que Martín le prometió a Mauricio el 9/9.
//   · Su ACCESO: invitarlo por mail (./curso/InvitarAlCurso.tsx, «al igual que en la vista de
//     Agencia»), el link personal al portal (no es una cuenta: ver lib/curso-acceso.ts),
//     copiarlo, mandárselo, cortarlo y volver a habilitarlo.
//   · Las LLAMADAS de la entrega: de cada una salen el aviso del día antes y el de después
//     (lo manda el cron, lib/curso-mensajes.ts). Acá se anotan y se ve si salieron.
//   · Sus PERMISOS (07/10/2026, item 9): qué módulos de cada producto ve (lib/curso-alcance.ts).
//     La tarjeta del kanban abre la ficha acá con «Permisos del curso». Y desde el 08/10/2026 (D2),
//     en la misma caja, «abrir a mano» lo que sus candados le tienen cerrado (lib/curso-bloqueo.ts).
//
// ⚠️ ABRIR ESTA PESTAÑA NO LE DA ACCESO A NADIE: sólo lee (ver ./curso-ficha-actions.ts). El
// acceso nace al invitar, copiar el link o mandarlo por WhatsApp.
//
// ⚠️ PIDE SUS DATOS AL ABRIRSE, como Pagos e Historial: es la excepción a la regla de la ficha
// (todo con el HTML) y por la misma razón — bajar el avance clase por clase de toda la cartera
// en cada carga, para una tab que se abre de a una, es pagar la lectura entera siempre. Y la
// pestaña queda montada al cambiar de tab (`Panel` de FichaCliente), así que se lee UNA vez.
//
// ⚠️ SE VUELVE A LEER SI LO MUEVEN DE ETAPA DESDE LA CABECERA. La etapa actual es la del server
// (`etapaActualDe`), y la cabecera de la ficha (./FichaEntrega.tsx) mueve con el overlay de la
// sesión: sin esto, la cabecera diría una etapa y esta pestaña otra. Lo que se mira es la FIRMA
// de la asignación (un string), no el objeto `entrega`, que ClientesApp arma de nuevo en cada
// render. Y no hay carrera con el movimiento: las server actions se despachan de a una
// (AGENTS.md), así que esta lectura sale DETRÁS del `moverEntregaAction` que la disparó.
//
// ⚠️ TEXTO DE PANTALLA CORTO Y EN TÚ: la regla de la casa (un toast 3-4 palabras, un rótulo 1-3,
// un vacío una frase) y los clientes de Mauricio son mexicanos. El porqué va acá, no en la UI.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Checkbox, Confirm, Input, RadioGroup, Select, Spinner, useOkFlash } from '@/app/_ui';
import Link, { useRouter } from '@/app/_ui/Link';
import type { Sesion } from '@/lib/curso-datos';
import { ROTULO_TAREA, ROTULO_PROPUESTA, type EstadoTarea, type EstadoPropuesta, type Progreso } from '@/lib/curso';
import type { EntregaFicha } from './FichaEntrega';
import {
  cursoDeClienteAction, aprobarTareaCursoAction, mandarLinkCursoAction, cortarAccesoCursoAction,
  habilitarAccesoCursoAction, agendarLlamadaCursoAction, borrarLlamadaCursoAction, linkDelCursoAction,
  linkDeLiderAction, cambiarLiderAction, guardarAlcanceCursoAction, urlEntregaCursoAction, otroIntentoQuizAction,
  desbloquearAction,
} from './curso-ficha-actions';
import {
  avisosDeSesion, contestoAlgo, estadoDeInvitacion, estadoDeTarea, fechaHoraLocal, fraseIngresos, fraseInvitacion,
  fraseResumen, isoDeLocal, respuestaDe, resumenDeEtapa, rotuloVisto, propuestaDeClase, propuestasPendientes,
  modulosParaPermisos, modulosElegidos,
  type AccesoFicha, type AccesoLiderFicha, type AvisoInvitacionCurso, type BloqueRespuesta, type ClaseFicha, type CursoDeCliente,
  type ModuloFicha, type ProductoFicha, type BloqueoFicha,
} from './curso-ficha-lectura';
import { CabezaAvance, CeldasAvance, EstiloAvance } from './curso/FilaAvance';
import { BotonInvitar } from './curso/InvitarAlCurso';
import { accesoEnProducto, abreElProducto } from '@/lib/curso-invitar-reglas';
import RespuestaTarea from './curso/RespuestaTarea';

type Carga = 'cargando' | { ok: false; error: string } | { ok: true; curso: CursoDeCliente };

const msg = (e: unknown, def: string) => (e instanceof Error ? e.message : def);

/** `datetime-local` de AHORA en la hora de quien mira: el `min` del input. */
function ahoraLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function FichaCurso({ leadId, entrega }: {
  leadId: number;
  /** La cabecera de la ficha: de acá sale la FIRMA que hace releer (ver arriba) y el producto
   *  con el que abre si tiene curso en más de uno. Sin entrega, se lee una vez y listo. */
  entrega?: EntregaFicha;
}) {
  const [carga, setCarga] = useState<Carga>('cargando');
  const pedido = useRef(0);
  /** El producto que se mira, si tiene curso en más de uno. Vive ACÁ y no en el avance porque
   *  la llamada que se agenda es de ese producto: su aviso le habla de esas tareas. */
  const [elegido, setElegido] = useState<number | null>(null);

  const firma = entrega
    ? entrega.servicios.map((s) => `${s.productoId}:${entrega.asignacionDe(s.productoId)[leadId]?.etapa ?? ''}`).join('|')
    : '';

  useEffect(() => {
    // ⚠️ AL RELEER NO SE VUELVE A «CARGANDO»: se sigue viendo lo que había hasta que llega lo
    // nuevo. Un parpadeo a spinner cada vez que alguien mueve la etapa arriba se lee como que
    // la pestaña se rompió. Y gana la ÚLTIMA lectura pedida, no la última en llegar.
    const n = ++pedido.current;
    void cursoDeClienteAction(leadId)
      .then((r) => { if (n === pedido.current) setCarga(r.ok ? { ok: true, curso: r.curso } : { ok: false, error: r.error }); })
      .catch((e) => { if (n === pedido.current) setCarga({ ok: false, error: msg(e, 'No pude leer su curso.') }); });
  }, [leadId, firma]);

  /** Cambia el curso cargado en el lugar. Lo usan las acciones: devuelven lo que quedó y se pinta eso. */
  const editar = (f: (c: CursoDeCliente) => CursoDeCliente) =>
    setCarga((c) => (c !== 'cargando' && c.ok ? { ok: true, curso: f(c.curso) } : c));

  if (carga === 'cargando') {
    return <><p className="fcu-nada fcu-cargando"><Spinner size={14} /> Leyendo su curso</p><style dangerouslySetInnerHTML={{ __html: CSS }} /></>;
  }
  if (!carga.ok) {
    return <><p className="fcu-nada">No pude leer su curso. {carga.error}</p><style dangerouslySetInnerHTML={{ __html: CSS }} /></>;
  }
  const curso = carga.curso;
  const productos = curso.productos ?? [];
  // El producto del tablero de atrás si tiene curso; si no, el primero. Elegir uno lo fija.
  const prod: ProductoFicha | null = productos.find((p) => p.productoId === elegido)
    ?? productos.find((p) => p.productoId === entrega?.inicial) ?? productos[0] ?? null;

  return (
    <div className="fcu-raiz">
      {/* El producto arriba de TODO: la fila de avance y las etapas de abajo son de ése. */}
      {prod && (
        <div className="fcu-cab">
          {productos.length > 1 ? (
            <Select value={String(prod.productoId)} ariaLabel="Producto" width={260}
              options={productos.map((p) => ({ value: String(p.productoId), label: p.nombre }))}
              onChange={(v) => setElegido(Number(v))} />
          ) : <h4 className="fcu-prod">{prod.nombre}</h4>}
        </div>
      )}
      {prod && <ResumenAvance prod={prod} acceso={curso.acceso} />}
      <div className="fcu">
        <div className="fcu-main">
          <Avance leadId={leadId} curso={curso} prod={prod} editar={editar} />
        </div>
        <aside className="fcu-lado">
          {(curso.acceso || curso.errorAcceso) && <Acceso leadId={leadId} curso={curso} editar={editar} productoId={prod?.productoId ?? null} />}
          {/* Los permisos (item 9, 07/10/2026): qué módulos ve. Sólo con el acceso LEÍDO: con la
              lectura caída no se sabe qué tiene, y unas casillas sobre «no sé» guardarían encima. */}
          {curso.acceso && (curso.productos?.length ?? 0) > 0 && <Permisos leadId={leadId} curso={curso} editar={editar} />}
          {/* Los líderes de área (#665): sólo si su curso tiene clases por área Y declaró áreas. */}
          {curso.acceso && (curso.areas?.length ?? 0) > 0 && <Lideres leadId={leadId} curso={curso} editar={editar} />}
          <Llamadas leadId={leadId} curso={curso} productoId={prod?.productoId ?? null} editar={editar} />
        </aside>
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

// ── Su fila de avance, de un vistazo ──────────────────────────────────────────

/**
 * La fila que este cliente tiene en la tabla Avance de la tab Curso, con las MISMAS celdas
 * (./curso/FilaAvance.tsx) y los MISMOS números (`avanceDeCliente`, armado en el server): su
 * etapa con su color, las tareas enviadas sobre las que hay en cada etapa (verde = la etapa está
 * completa, la regla que lo mueve), cuánto vio de su etapa y su último ingreso.
 */
function ResumenAvance({ prod, acceso }: { prod: ProductoFicha; acceso: AccesoFicha | null }) {
  const { etapas, fila } = prod.avance;
  if (!etapas.length) return null;
  return (
    <div className="mk-scroll-x fcu-avance">
      <table className="av">
        <thead><tr><CabezaAvance etapas={etapas} /></tr></thead>
        <tbody><tr><CeldasAvance etapas={etapas} fila={{ ...fila, acceso }} /></tr></tbody>
      </table>
      <EstiloAvance />
    </div>
  );
}

// ── El avance ─────────────────────────────────────────────────────────────────

type Editar = (f: (c: CursoDeCliente) => CursoDeCliente) => void;

/** Le cambia el estado de la tarea a UNA clase y recalcula el resumen de su etapa. */
function conEstado(c: CursoDeCliente, claseId: number, estado: EstadoTarea): CursoDeCliente {
  if (!c.productos) return c;
  return {
    ...c,
    productos: c.productos.map((p) => ({
      ...p,
      modulos: p.modulos.map((e) => {
        if (!e.clases.some((x) => x.id === claseId)) return e;
        const clases = e.clases.map((x) => (x.id === claseId && x.progreso ? { ...x, progreso: { ...x.progreso, estado } } : x));
        // El resumen se RECALCULA con la misma función que lo armó: con una cuenta a mano
        // acá, «Completa» podría decir otra cosa que lo que dice al volver a abrir.
        return { ...e, clases, resumen: resumenDeEtapa(clases) };
      }),
    })),
  };
}

function Avance({ leadId, curso, prod, editar }: {
  leadId: number; curso: CursoDeCliente; prod: ProductoFicha | null; editar: Editar;
}) {
  /** `${producto}:${etapa}` → abierta. Sin entrada, abre sólo la ACTUAL (y si tiene clases). */
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [claseAbierta, setClaseAbierta] = useState<number | null>(null);
  const [revisando, setRevisando] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (!curso.productos) return <p className="fcu-nada">No pude leer sus clases. {curso.errorProductos}</p>;
  // El vacío dice dónde se arregla: las clases se cargan en la tab Curso. Por el `Link` de la
  // casa, que preserva el `?ws=` — sin eso el super admin aterrizaría en SU curso.
  if (!curso.productos.length || !prod) {
    return <p className="fcu-nada">Sus productos todavía no tienen clases. <Link className="fcu-ir" href="/customer-success/curso">Se cargan en Curso →</Link></p>;
  }

  async function revisar(c: ClaseFicha, aprobada: boolean) {
    setRevisando(c.id);
    setError('');
    try {
      const r = await aprobarTareaCursoAction(leadId, c.id, aprobada);
      if (!r.ok) { setError(r.error); return; }
      editar((cur) => conEstado(cur, c.id, r.estado));
    } catch (e) {
      setError(msg(e, 'No se guardó.'));
    } finally {
      setRevisando(null);
    }
  }

  const abierta = (e: ModuloFicha) => abiertas[`${prod.productoId}:${e.key}`] ?? (e.actual && e.clases.length > 0);

  return (
    <>
      {error && <p className="fcu-mal">No se guardó. {error}</p>}

      <ol className="fcu-etapas">
        {prod.modulos.map((e) => {
          const vacia = e.clases.length === 0;
          const open = !vacia && abierta(e);
          // Las propuestas de la IA que esperan el ok del cliente (paso 5 de #665). Casi siempre en
          // la etapa ANTERIOR, que arranca plegada: por eso se cuentan en la cabecera.
          const porAprobar = propuestasPendientes(e.clases);
          return (
            <li key={e.key} className={`fcu-etapa${vacia ? ' vacia' : ''}${e.actual ? ' actual' : ''}`}>
              <button type="button" className="fcu-eh" disabled={vacia} aria-expanded={vacia ? undefined : open}
                onClick={() => setAbiertas((m) => ({ ...m, [`${prod.productoId}:${e.key}`]: !open }))}>
                <span className="fcu-chev" aria-hidden>{vacia ? '' : '›'}</span>
                <span className="fcu-en">{e.label}</span>
                {e.actual && <span className="fcu-pill fcu-pill-actual">Actual</span>}
                <span className="fcu-res">{vacia ? 'Sin clases' : fraseResumen(e.resumen)}</span>
                {porAprobar > 0 && <span className="fcu-pill fcu-pill-ia" title="Versiones de la IA que el cliente no aprobó todavía">{ROTULO_PROPUESTA.pendiente}: {porAprobar}</span>}
                {e.resumen.completa && <span className="fcu-pill fcu-pill-good">Completa</span>}
              </button>
              {open && (
                <ul className="fcu-clases">
                  {e.clases.map((c) => (
                    <FilaClase key={c.id} c={c} leadId={leadId} abierta={claseAbierta === c.id}
                      onAbrir={() => setClaseAbierta((x) => (x === c.id ? null : c.id))}
                      revisando={revisando === c.id} onRevisar={(ok) => void revisar(c, ok)} />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

const TONO_TAREA: Record<EstadoTarea, string> = { pendiente: '', enviada: 'fcu-pill-warn', aprobada: 'fcu-pill-good' };
const TONO_PROPUESTA: Record<EstadoPropuesta, string> = { pendiente: 'fcu-pill-ia', aprobada: 'fcu-pill-good', corregida: '' };

function FilaClase({ c, leadId, abierta, onAbrir, revisando, onRevisar }: {
  c: ClaseFicha; leadId: number; abierta: boolean; onAbrir: () => void; revisando: boolean; onRevisar: (aprobada: boolean) => void;
}) {
  const visto = rotuloVisto(c.medicion, c.progreso);
  const estado = estadoDeTarea(c, c.progreso);
  // La propuesta de la IA (paso 5 de #665): pendiente, aprobada o corregida por el cliente.
  const ia = estado ? propuestaDeClase(c) : null;
  return (
    <li className="fcu-clase">
      <div className="fcu-ch">
        <button type="button" className="fcu-ct" aria-expanded={abierta} onClick={onAbrir} title={c.titulo}>
          {c.titulo}
        </button>
        <span className={`fcu-visto t-${visto.tono}`}>{visto.texto}</span>
        <span className="fcu-est">
          {estado ? <span className={`fcu-pill ${TONO_TAREA[estado]}`}>{ROTULO_TAREA[estado]}</span> : <span className="fcu-sin">Sin tarea</span>}
          {ia && <span className={`fcu-pill ${TONO_PROPUESTA[ia]}`}>{ROTULO_PROPUESTA[ia]}</span>}
        </span>
        <span className="fcu-acc">
          {/* Sólo sobre lo que ya MANDÓ: revisar una pendiente no tiene qué revisar, y la
              action igual no la tocaría (`aprobarTarea` filtra por estado). */}
          {estado === 'enviada' && (
            <Button size="sm" variant="secondary" loading={revisando} onClick={() => onRevisar(true)}>Marcar revisada</Button>
          )}
          {estado === 'aprobada' && (
            <Button size="sm" variant="tertiary" loading={revisando} onClick={() => onRevisar(false)}>Quitar revisión</Button>
          )}
        </span>
      </div>
      {abierta && <DetalleClase c={c} leadId={leadId} />}
    </li>
  );
}

/**
 * Lo que contestó, con el render de CADA tipo de campo (`RespuestaTarea`, #18): un archivo se abre
 * con una URL firmada que pide la ficha (la puerta de siempre), y un quiz sin intentos se destraba
 * desde acá. Sin esto los campos de archivo se veían como «[object Object]».
 */
function Respuesta({ c, leadId, area, progreso }: { c: ClaseFicha; leadId: number; area: string; progreso: Progreso | null }) {
  return (
    <RespuestaTarea
      campos={c.campos}
      tarea={c.tarea}
      valores={progreso?.valores}
      calificacion={progreso?.calificacion}
      abrirArchivo={async (a) => { const r = await urlEntregaCursoAction(leadId, a.path, a.nombre); return r.ok ? r.url : null; }}
      onOtroIntento={async (id) => { await otroIntentoQuizAction(leadId, c.id, area, id); }}
    />
  );
}

function DetalleClase({ c, leadId }: { c: ClaseFicha; leadId: number }) {
  const bloques = respuestaDe(c.campos, c.progreso?.valores);
  const enviada = fechaHoraLocal(c.progreso?.enviadaAt);
  // Una clase POR ÁREA (#665): lo contestado vive en cada área, y se muestra área por área.
  if (c.porArea) {
    return (
      <div className="fcu-det">
        {c.tarea.trim() && <p className="fcu-instr">{c.tarea.trim()}</p>}
        {c.porArea.map((a) => <RespuestaDeArea key={a.area} c={c} leadId={leadId} area={a.area} vigente={a.vigente} progreso={a.progreso} />)}
      </div>
    );
  }
  return (
    <div className="fcu-det">
      {c.tarea.trim() && <p className="fcu-instr">{c.tarea.trim()}</p>}
      {enviada && <p className="fcu-meta">Enviada el {enviada}</p>}
      {!c.tarea.trim() && !c.campos.length
        ? <p className="fcu-nada">Esta clase no pide tarea.</p>
        : !contestoAlgo(bloques)
          ? <p className="fcu-nada">Sin contestar.</p>
          : <Respuesta c={c} leadId={leadId} area="" progreso={c.progreso} />}
      <VersionIA c={c} progreso={c.progreso} />
    </div>
  );
}

/**
 * La versión de la IA de una respuesta (paso 5 de #665), como la ve el EQUIPO. Pendiente: se
 * muestra entera (es lo que el cliente está por aprobar). Resuelta: una línea, cuándo — lo que quedó
 * ya es su respuesta (aprobada) o la descartó (corregida).
 */
function VersionIA({ c, progreso }: { c: ClaseFicha; progreso: Progreso | null }) {
  const ia = progreso?.ia;
  if (!ia) return null;
  if (ia.estado !== 'pendiente') {
    const cuando = fechaHoraLocal(ia.resueltaAt);
    return <p className="fcu-meta">{ia.estado === 'aprobada' ? 'Aprobó la versión de la IA' : 'Corrigió la versión de la IA'}{cuando ? ` · ${cuando}` : ''}</p>;
  }
  const bloques = respuestaDe(c.campos, ia.valores);
  return (
    <div className="fcu-ia">
      <p className="fcu-area-nom">Versión de la IA · sin aprobar</p>
      <dl className="fcu-resp">{bloques.map((b) => <Bloque key={b.id} b={b} />)}</dl>
    </div>
  );
}

/**
 * Lo que contestó UNA área. `vigente: false` = el área ya no está en su tabla de áreas (la renombró
 * o la sacó): se muestra igual —lo contestado no se esconde— y se dice, porque ya no cuenta para
 * cerrar la etapa (lib/curso.ts, `progresoEfectivo`).
 */
function RespuestaDeArea({ c, leadId, area, vigente, progreso }: { c: ClaseFicha; leadId: number; area: string; vigente: boolean; progreso: ClaseFicha['progreso'] }) {
  const bloques = respuestaDe(c.campos, progreso?.valores);
  const enviada = fechaHoraLocal(progreso?.enviadaAt);
  return (
    <div className="fcu-area">
      <p className="fcu-area-nom">{area}{!vigente && <span className="fcu-sin"> · ya no está en su lista</span>}</p>
      {enviada && <p className="fcu-meta">Enviada el {enviada}</p>}
      {!contestoAlgo(bloques)
        ? <p className="fcu-nada">Sin contestar.</p>
        : <Respuesta c={c} leadId={leadId} area={area} progreso={progreso} />}
      <VersionIA c={c} progreso={progreso} />
    </div>
  );
}

/** Un campo contestado. Las tablas, COMO TABLA: aplanadas en una línea no se leen. */
function Bloque({ b }: { b: BloqueRespuesta }) {
  let cuerpo: ReactNode;
  if (b.tipo === 'vacio') cuerpo = <span className="fcu-sin">—</span>;
  else if (b.tipo === 'texto') cuerpo = b.texto;
  else if (b.tipo === 'lista') cuerpo = <span className="fcu-chips">{b.items.map((x, i) => <span key={i} className="fcu-pill">{x}</span>)}</span>;
  else {
    const conTitulos = b.columnas.some((x) => x.trim());
    cuerpo = (
      <div className="mk-scroll-x">
        <table className="fcu-tabla">
          {conTitulos && <thead><tr>{b.columnas.map((col, j) => <th key={j} scope="col">{col}</th>)}</tr></thead>}
          <tbody>
            {b.filas.map((f, i) => (
              <tr key={i}>{f.map((x, j) => <td key={j}>{x || <span className="fcu-sin">—</span>}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <div className="fcu-b"><dt>{b.label}</dt><dd>{cuerpo}</dd></div>;
}

// ── El acceso ─────────────────────────────────────────────────────────────────

/**
 * Su acceso al curso: en qué quedó su invitación, si entró, y lo que se puede hacer.
 *
 * ⚠️ LOS ESTADOS, UNA FRASE CADA UNO (la regla de la casa): «Sin invitar», «Invitado a X · 6 oct»
 * o «Acceso cortado», y abajo «Todavía no entró» / «Entró N veces · última…». Salen de
 * `estadoDeInvitacion` y `fraseInvitacion` (./curso-ficha-lectura.ts), las MISMAS que la
 * columna «Acceso» de la tabla Avance: con dos redacciones, la ficha y la tabla dirían cosas
 * distintas del mismo cliente.
 *
 * ⚠️ LA INVITACIÓN SE MIRA DESDE EL CURSO ELEGIDO ARRIBA (`productoId`, 09/10/2026, puntos 6 y 7 del
 * audio del 08/10 a la noche), igual que la tabla Avance de ese curso: invitado a OTRO curso es «Sin
 * invitar» acá, e «Invitar» invita a ÉSTE (el mail nombra sólo éste y el acceso pasa a abrirlo). El
 * link, los ingresos, copiar, mandar y cortar siguen siendo del acceso entero: es uno por cliente.
 */
function Acceso({ leadId, curso, editar, productoId }: { leadId: number; curso: CursoDeCliente; editar: Editar; productoId: number | null }) {
  const copiado = useOkFlash();
  const enviado = useOkFlash();
  const [ocupado, setOcupado] = useState<'copiar' | 'mandar' | 'cortar' | 'habilitar' | null>(null);
  const [preguntaCortar, setPreguntaCortar] = useState(false);
  const [error, setError] = useState('');
  /** Lo que dejó la invitación cuando el mail salió pero algo quedó por decir (no se anotó). */
  const [aviso, setAviso] = useState<AvisoInvitacionCurso | null>(null);
  const a = curso.acceso;
  const router = useRouter();

  /**
   * Pinta el acceso como quedó y RELEE la página de atrás. ⚠️ La relectura no es para esta caja (ya
   * pinta lo que devolvió el server): es para la CARTERA, que tiene el acceso de cada cliente en el
   * menú de su tarjeta y en la vista Avance (07/10/2026). Sin ella, invitar acá y cerrar la ficha
   * dejaba la tarjeta ofreciendo «Invitar al curso» a alguien que acaba de recibir el mail — un
   * segundo mail a un clic. `refresh` (el Link de la casa preserva el `?ws=`) no desmonta la ficha.
   */
  const poner = (acceso: AccesoFicha) => {
    editar((c) => ({ ...c, acceso, errorAcceso: undefined }));
    router.refresh();
  };

  /**
   * Copia su link. Si todavía no tiene acceso (nunca se lo invitó ni se le mandó nada), lo CREA
   * primero: copiar un link es dárselo.
   *
   * ⚠️ SI EL PORTAPAPELES NO DEJA, EL LINK QUEDA A LA VISTA. Después de esperar al server, Safari
   * puede negarse a escribir en el portapapeles (el permiso dura lo que dura el click); el link
   * ya está pintado arriba, así que se dice dónde está en vez de un «no pude» sin salida.
   */
  async function copiar() {
    setError('');
    let link = a?.link ?? null;
    if (!link) {
      setOcupado('copiar');
      try {
        const r = await linkDelCursoAction(leadId);
        if (!r.ok) { setError(r.error); return; }
        poner(r.acceso);
        link = r.acceso.link;
      } catch (e) {
        setError(msg(e, 'No pude armar su link.'));
        return;
      } finally {
        setOcupado(null);
      }
    }
    if (!link) return;
    try { await navigator.clipboard.writeText(link); copiado.flash(); } catch { setError('No pude copiar. Cópialo de arriba.'); }
  }
  async function mandar() {
    setOcupado('mandar');
    setError('');
    try {
      const r = await mandarLinkCursoAction(leadId);
      if (!r.ok) setError(`No se mandó. ${r.error}`);
      else {
        enviado.flash();
        // Mandar puede haber creado su acceso: se pinta como quedó.
        if (r.acceso) poner(r.acceso);
      }
    } catch (e) {
      setError(msg(e, 'No se mandó.'));
    } finally {
      setOcupado(null);
    }
  }
  /** Cortar y volver a habilitar devuelven el acceso COMO QUEDÓ, y se pinta eso. */
  async function cambiar(cual: 'cortar' | 'habilitar') {
    setOcupado(cual);
    setError('');
    try {
      if (cual === 'cortar') {
        const r = await cortarAccesoCursoAction(leadId);
        if (!r.ok) { setError(r.error); return; }
        poner(r.acceso);
        // Cortar al cliente corta también a sus líderes (lib/curso-datos.ts, `revocarAcceso`).
        const lideres = r.lideres;
        if (lideres) editar((c) => ({ ...c, lideres }));
      } else {
        const r = await habilitarAccesoCursoAction(leadId);
        if (!r.ok) setError(r.error);
        else poner(r.acceso);
      }
    } catch (e) {
      setError(msg(e, 'No se pudo.'));
    } finally {
      setOcupado(null);
    }
  }

  /** El acceso visto desde el curso elegido (ver la cabecera). Sin curso elegido, el de siempre. */
  const desde = a && productoId != null ? accesoEnProducto(a, productoId) : a;
  const invitacion = desde ? estadoDeInvitacion(desde) : null;

  return (
    <section className="fcu-sec">
      <h4 className="fcu-tit">Acceso al curso</h4>
      {!a || !invitacion ? (
        <p className="fcu-nada">No pude leer su acceso. {curso.errorAcceso}</p>
      ) : (
        <>
          <p className={`fcu-estado${a.revocado ? ' is-mal' : ''}`} title={fraseInvitacion(invitacion)}>{fraseInvitacion(invitacion)}</p>
          {/* Sin acceso todavía no hay ingresos que contar: «Sin invitar» alcanza. */}
          {a.existe && <p className="fcu-meta">{fraseIngresos(a)}</p>}
          {a.revocado ? (
            <div className="fcu-bots">
              {/* El link que sale de acá es NUEVO: los viejos siguen sin abrir (la versión subió al cortar). */}
              <Button size="sm" variant="secondary" loading={ocupado === 'habilitar'} onClick={() => void cambiar('habilitar')}>
                Volver a habilitar
              </Button>
            </div>
          ) : (
            <>
              {a.link ? <code className="fcu-link" title={a.link}>{a.link}</code>
                // Con acceso y sin link es que no hay secreto para firmar (AUTH_SECRET): se dice
                // eso, no «cortado».
                : a.existe ? <p className="fcu-nada">No pude armar su link.</p> : null}
              <div className="fcu-bots">
                {/* «Reenviar invitación» manda el link de la versión VIGENTE: después de cortar y
                    habilitar, el que le llegó antes ya no abre. */}
                <BotonInvitar leadId={leadId} nombre={curso.nombre} emailCrm={curso.emailCrm} acceso={desde}
                  productoId={productoId ?? undefined}
                  variant={invitacion.tipo === 'invitado' ? 'secondary' : 'primary'}
                  areas={curso.areas} lideres={curso.lideres}
                  onLideres={(l) => editar((c) => ({ ...c, lideres: l }))}
                  onListo={(acc, av) => { if (acc) poner(acc); setAviso(av); }} />
                <Button size="sm" variant="secondary" ok={copiado.ok} okLabel="Copiado" loading={ocupado === 'copiar'}
                  onClick={() => void copiar()}>
                  Copiar link
                </Button>
                <Button size="sm" variant="secondary" ok={enviado.ok} okLabel="Enviado" loading={ocupado === 'mandar'}
                  onClick={() => void mandar()}>
                  Mandar por WhatsApp
                </Button>
                {a.existe && (
                  <Button size="sm" variant="tertiary" loading={ocupado === 'cortar'} onClick={() => setPreguntaCortar(true)}>Cortar acceso</Button>
                )}
              </div>
            </>
          )}
        </>
      )}
      {aviso && <p className={aviso.tono === 'ok' ? 'fcu-meta' : 'fcu-mal'}>{aviso.texto}</p>}
      {/* El motivo VUELVE TAL CUAL del envío (lib/curso-mensajes.ts): «no se mandó» sin el
          porqué no deja hacer nada al respecto. */}
      {error && <p className="fcu-mal">{error}</p>}

      {preguntaCortar && (
        <Confirm title="¿Cortar su acceso?" message={(curso.lideres?.length ?? 0) > 0 ? 'Sus links y los de sus líderes dejan de abrir.' : 'Los links que ya tiene dejan de abrir.'}
          confirmLabel="Cortar acceso" cancelLabel="No cortar" tone="danger"
          onCancel={() => setPreguntaCortar(false)}
          onConfirm={() => { setPreguntaCortar(false); void cambiar('cortar'); }} />
      )}
    </section>
  );
}

// ── Los permisos del alumno (item 9, 07/10/2026) ───────────────────────────────

/**
 * Qué módulos ve, producto por producto: «Todos los módulos» o «Elegir módulos» con una casilla
 * por módulo (los módulos son las etapas de su entrega, D1 de docs/diseno-curso-skool.md).
 *
 * ⚠️ CADA CAMBIO SE GUARDA EN EL ACTO Y SE PINTA LO QUE VOLVIÓ (`r.acceso`), no lo que se tildó: el
 * server descarta las claves que no existen y el producto que no es suyo, y la pantalla tiene que
 * mostrar eso. Y se manda UN producto por vez (`guardarAlcanceCursoAction`): tocar uno no reescribe
 * los otros.
 *
 * ⚠️ «ELEGIR» ARRANCA CON TODOS TILDADOS: lo que ve no cambia al elegir el modo, cambia al destildar.
 * Lo que sí cambia (y es la diferencia con «Todos») es que un módulo NUEVO arranca cerrado para él.
 *
 * ⚠️ LA APLICACIÓN NO ES DE ACÁ: la hace el portal en la misma puerta que los bloqueos
 * (lib/curso-portal.ts), y lo no permitido no viaja al navegador. Esta caja guarda el dato.
 */
function Permisos({ leadId, curso, editar }: { leadId: number; curso: CursoDeCliente; editar: Editar }) {
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [error, setError] = useState('');
  const productos = curso.productos ?? [];
  const alcance = curso.acceso?.alcance ?? null;

  /**
   * «Abrir a mano» (D2): le abre a ESTE alumno un módulo o una clase que su candado tiene cerrado, o se
   * lo vuelve a cerrar. Se pinta lo que vuelve (su producto releído), no lo que se tocó.
   */
  async function abrir(productoId: number, b: BloqueoFicha) {
    setOcupado(productoId);
    setError('');
    try {
      const r = await desbloquearAction(leadId, productoId, b.objeto, b.clave, !b.manual);
      if (!r.ok) { setError(r.error); return; }
      editar((c) => ({ ...c, productos: c.productos?.map((x) => (x.productoId === productoId ? r.producto : x)) ?? null }));
    } catch (e) {
      setError(msg(e, 'No se guardó.'));
    } finally {
      setOcupado(null);
    }
  }

  async function guardar(productoId: number, claves: string[] | null) {
    setOcupado(productoId);
    setError('');
    try {
      const r = await guardarAlcanceCursoAction(leadId, productoId, claves);
      if (!r.ok) { setError(r.error); return; }
      editar((c) => ({ ...c, acceso: r.acceso, errorAcceso: undefined }));
    } catch (e) {
      setError(msg(e, 'No se guardó.'));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="fcu-sec" id={`fcu-permisos-${leadId}`}>
      <h4 className="fcu-tit">Permisos del curso</h4>
      {productos.map((p) => {
        // ⚠️ QUÉ CURSOS ABRE EL ACCESO (mig 0232) MANDA SOBRE LOS MÓDULOS (13/10/2026). Antes, un curso que
        // su acceso no abre se dibujaba con «Todos los módulos» tildado, que se lee como que lo ve entero.
        // Ausente (`undefined`) = no se leyó: no se afirma nada y se dibuja como siempre.
        const lista = curso.acceso?.productos;
        if (lista !== undefined && !abreElProducto(lista, p.productoId)) {
          return (
            <div key={p.productoId} className="fcu-perm">
              {productos.length > 1 && <p className="fcu-estado" title={p.nombre}>{p.nombre}</p>}
              <p className="fcu-meta">No se le abrió este curso.</p>
            </div>
          );
        }
        const modulos = modulosParaPermisos(p);
        const elegidos = modulosElegidos(alcance, p.productoId, modulos);
        return (
          <div key={p.productoId} className="fcu-perm">
            {productos.length > 1 && <p className="fcu-estado" title={p.nombre}>{p.nombre}</p>}
            <RadioGroup value={elegidos ? 'elegir' : 'todos'} disabled={ocupado != null}
              options={[{ value: 'todos', label: 'Todos los módulos' }, { value: 'elegir', label: 'Elegir módulos' }]}
              onChange={(v) => void guardar(p.productoId, v === 'todos' ? null : modulos.map((m) => m.key))} />
            {elegidos && (
              <div className="fcu-mods">
                {modulos.map((m) => (
                  <Checkbox key={m.key} checked={elegidos.includes(m.key)} disabled={ocupado != null}
                    label={m.label} hint={m.clases ? undefined : 'Sin clases'}
                    onChange={(on) => void guardar(p.productoId, on ? [...elegidos, m.key] : elegidos.filter((k) => k !== m.key))} />
                ))}
                {/* Cero tildados es una decisión (esconderle el producto), no un error: se dice. */}
                {!elegidos.length && <p className="fcu-meta">No ve este producto.</p>}
              </div>
            )}
            {/* Lo cerrado por un candado (y lo que ya se le abrió a mano): un renglón cada uno, con el
                motivo en el title — el mismo que lee el alumno. Ausente = no se pudo evaluar: no se
                ofrece abrir nada a ciegas. */}
            {(p.bloqueos?.length ?? 0) > 0 && (
              <ul className="fcu-abrir">
                {p.bloqueos!.map((b) => (
                  <li key={`${b.objeto}:${b.clave}`}>
                    <span className="fcu-abrir-nom" title={b.motivo ?? 'Abierto a mano'}>{b.nombre}</span>
                    <Button size="sm" variant="tertiary" disabled={ocupado != null} onClick={() => void abrir(p.productoId, b)}>
                      {b.manual ? 'Cerrar' : 'Abrir'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {error && <p className="fcu-mal">{error}</p>}
    </section>
  );
}

// ── Los líderes de área (#665) ────────────────────────────────────────────────

/**
 * Un renglón por área que declaró (y por cada líder que ya tenga acceso aunque su área ya no esté):
 * en qué quedó su invitación, copiar su link y cortarlo o volver a habilitarlo. A un líder se lo
 * INVITA desde «Invitar» de arriba, eligiendo su área (./curso/InvitarAlCurso.tsx).
 *
 * ⚠️ «COPIAR LINK» CREA SU ACCESO si no lo tenía, igual que el del cliente: copiar un link es
 * dárselo. Y el link es el de SU área: abre sólo las clases por área de esa área.
 */
function Lideres({ leadId, curso, editar }: { leadId: number; curso: CursoDeCliente; editar: Editar }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [preguntaCortar, setPreguntaCortar] = useState<string | null>(null);
  const [error, setError] = useState('');
  const lideres = curso.lideres ?? [];
  const declaradas = curso.areas ?? [];
  const filas = [...declaradas, ...lideres.map((l) => l.area).filter((a) => !declaradas.includes(a))];
  const poner = (l: AccesoLiderFicha[]) => editar((c) => ({ ...c, lideres: l }));
  // ⚠️ CON EL CLIENTE CORTADO NO SE OFRECE DAR NI DEVOLVER UN ACCESO DE LÍDER: «Copiar link» crearía
  // uno nuevo y «Volver a habilitar» reabriría uno cortado, para un cliente que ya no entra. El
  // server los rechaza igual (`clienteCortado` en curso-ficha-actions.ts) y el portal no los abre;
  // esto es para no dibujar dos botones cuya única respuesta es un error. Cortar sí queda.
  const clienteCortado = curso.acceso?.revocado === true;

  async function copiar(area: string) {
    setError('');
    let link = lideres.find((l) => l.area === area)?.link ?? null;
    if (!link) {
      setOcupado(`copiar:${area}`);
      try {
        const r = await linkDeLiderAction(leadId, area);
        if (!r.ok) { setError(r.error); return; }
        poner(r.lideres);
        link = r.link;
      } catch (e) {
        setError(msg(e, 'No pude armar su link.'));
        return;
      } finally {
        setOcupado(null);
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(area);
      window.setTimeout(() => setCopiado((a) => (a === area ? null : a)), 1600);
    } catch {
      setError('No pude copiar el link.');
    }
  }
  async function cambiar(area: string, cual: 'cortar' | 'habilitar') {
    setOcupado(`${cual}:${area}`);
    setError('');
    try {
      const r = await cambiarLiderAction(leadId, area, cual);
      if (!r.ok) setError(r.error);
      else poner(r.lideres);
    } catch (e) {
      setError(msg(e, 'No se pudo.'));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="fcu-sec">
      <h4 className="fcu-tit">Líderes de área</h4>
      {clienteCortado && <p className="fcu-meta">Primero habilita al cliente.</p>}
      <ul className="fcu-lid">
        {filas.map((area) => {
          const l = lideres.find((x) => x.area === area);
          const frase = l ? fraseInvitacion(estadoDeInvitacion(l)) : 'Sin invitar';
          return (
            <li key={area}>
              <p className="fcu-estado" title={area}>{area}</p>
              <p className={`fcu-meta${l?.revocado ? ' fcu-mal' : ''}`} suppressHydrationWarning>{frase}</p>
              <div className="fcu-bots">
                {l?.revocado ? (
                  !clienteCortado && (
                    <Button size="sm" variant="secondary" loading={ocupado === `habilitar:${area}`} onClick={() => void cambiar(area, 'habilitar')}>
                      Volver a habilitar
                    </Button>
                  )
                ) : (
                  <>
                    {!clienteCortado && (
                      <Button size="sm" variant="secondary" ok={copiado === area} okLabel="Copiado" loading={ocupado === `copiar:${area}`}
                        onClick={() => void copiar(area)}>
                        Copiar link
                      </Button>
                    )}
                    {l && (
                      <Button size="sm" variant="tertiary" loading={ocupado === `cortar:${area}`} onClick={() => setPreguntaCortar(area)}>
                        Cortar
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="fcu-mal">{error}</p>}
      {preguntaCortar && (
        <Confirm title={`¿Cortar a ${preguntaCortar}?`} message="Su link deja de abrir."
          confirmLabel="Cortar acceso" cancelLabel="No cortar" tone="danger"
          onCancel={() => setPreguntaCortar(null)}
          onConfirm={() => { const a = preguntaCortar; setPreguntaCortar(null); void cambiar(a, 'cortar'); }} />
      )}
    </section>
  );
}

// ── Las llamadas de la entrega ────────────────────────────────────────────────

const AVISO: Record<'previo' | 'posterior', string> = { previo: 'Aviso previo', posterior: 'Aviso posterior' };
const ESTADO_AVISO = { enviado: 'enviado', pendiente: 'pendiente', 'no-salio': 'no salió' } as const;

function Llamadas({ leadId, curso, productoId, editar }: {
  leadId: number; curso: CursoDeCliente;
  /** El producto del curso que se está mirando: el aviso de la llamada le habla de ESAS tareas.
   *  `null` = no tiene curso; la llamada se anota igual, sin producto. */
  productoId: number | null;
  editar: Editar;
}) {
  const [cuando, setCuando] = useState('');
  /** El `min` del input, UNA vez: calcularlo en cada render lo haría cambiar solo. */
  const [minimo] = useState(ahoraLocal);
  const [nota, setNota] = useState('');
  const [agendando, setAgendando] = useState(false);
  const [borrando, setBorrando] = useState<number | null>(null);
  const [aBorrar, setABorrar] = useState<Sesion | null>(null);
  const [error, setError] = useState('');
  const agendada = useOkFlash();
  const sesiones = curso.sesiones;
  const iso = isoDeLocal(cuando);

  async function agendar() {
    if (!iso || agendando) return;
    setAgendando(true);
    setError('');
    try {
      const r = await agendarLlamadaCursoAction(leadId, iso, nota.trim() || null, productoId);
      if (!r.ok) { setError(r.error); return; }
      // Mismo orden que `sesionesDe`: de la más lejana a la más vieja.
      editar((c) => ({ ...c, sesiones: [...(c.sesiones ?? []), r.sesion].sort((x, y) => Date.parse(y.fecha) - Date.parse(x.fecha)) }));
      setCuando(''); setNota('');
      agendada.flash();
    } catch (e) {
      setError(msg(e, 'No se pudo agendar.'));
    } finally {
      setAgendando(false);
    }
  }

  async function borrar(s: Sesion) {
    setBorrando(s.id);
    setError('');
    try {
      const r = await borrarLlamadaCursoAction(leadId, s.id);
      if (!r.ok) { setError(r.error); return; }
      editar((c) => ({ ...c, sesiones: (c.sesiones ?? []).filter((x) => x.id !== s.id) }));
    } catch (e) {
      setError(msg(e, 'No se pudo borrar.'));
    } finally {
      setBorrando(null);
    }
  }

  return (
    <section className="fcu-sec">
      <h4 className="fcu-tit">Llamadas agendadas</h4>
      {/* ⚠️ LA FECHA ES LA HORA LOCAL DEL NAVEGADOR y se pasa a ISO ACÁ (`isoDeLocal`): el
          server no sabe en qué zona la escribió quien la escribió. */}
      <div className="fcu-form">
        <label className="fcu-label" htmlFor={`fcu-cuando-${leadId}`}>Próxima llamada</label>
        <Input id={`fcu-cuando-${leadId}`} type="datetime-local" value={cuando} min={minimo}
          onChange={(e) => setCuando(e.target.value)} />
        <Input value={nota} placeholder="Nota (opcional)" maxLength={500}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void agendar(); }} />
        <Button size="sm" variant="secondary" disabled={!iso} loading={agendando} ok={agendada.ok} okLabel="Agendada"
          onClick={() => void agendar()}>
          Agendar
        </Button>
      </div>
      {error && <p className="fcu-mal">{error}</p>}

      {/* «No pude leer» no se pinta como «no hay»: con un «sin llamadas» sobre una lectura
          caída, alguien agendaría otra encima y le saldrían dos avisos. */}
      {!sesiones ? (
        <p className="fcu-nada">No pude leer sus llamadas. {curso.errorSesiones}</p>
      ) : !sesiones.length ? (
        <p className="fcu-nada">Sin llamadas agendadas.</p>
      ) : (
        <ul className="fcu-ses">
          {sesiones.map((s) => (
            <li key={s.id}>
              <div className="fcu-sh">
                <b>{fechaHoraLocal(s.fecha) ?? 'Sin fecha'}</b>
                <Button size="sm" variant="tertiary" loading={borrando === s.id} onClick={() => setABorrar(s)}>Borrar</Button>
              </div>
              {s.nota && <p className="fcu-meta">{s.nota}</p>}
              <span className="fcu-chips">
                {avisosDeSesion(s).map((a) => (
                  <span key={a.cual} className={`fcu-pill${a.estado === 'enviado' ? ' fcu-pill-good' : ''}`}>
                    {AVISO[a.cual]}: {ESTADO_AVISO[a.estado]}
                  </span>
                ))}
              </span>
              {/* Lo que anotó el cron cuando NO mandó (el envío apagado, sin teléfono…). */}
              {s.avisoMotivo && <p className="fcu-meta">{s.avisoMotivo}</p>}
            </li>
          ))}
        </ul>
      )}

      {aBorrar && (
        <Confirm title="¿Borrar esta llamada?" message="Sus avisos ya no salen."
          confirmLabel="Borrar llamada" cancelLabel="No borrar" tone="danger"
          onCancel={() => setABorrar(null)}
          onConfirm={() => { const s = aBorrar; setABorrar(null); void borrar(s); }} />
      )}
    </section>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad y la
// pestaña contesta 200 sin estilos (AGENTS.md).
const CSS = `
/* Arriba, a todo el ancho: el producto y su fila de avance (nueve etapas no entran en la
   columna angosta). Abajo, dos columnas en la ficha ancha: las etapas y, al costado, el acceso
   y las llamadas. En una ventana angosta el costado baja. */
.fcu-raiz{ display:flex; flex-direction:column; gap:14px; min-width:0; }
.fcu-avance{ border:1px solid var(--border); border-radius:12px; background:var(--surface); }
.fcu-avance .av tr:last-child td{ border-bottom:0; }
.fcu{ display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:28px; align-items:start; }
@media (max-width: 980px){ .fcu{ grid-template-columns:minmax(0,1fr); } }
.fcu-main{ min-width:0; }
.fcu-lado{ display:flex; flex-direction:column; gap:18px; min-width:0; }

.fcu-nada{ margin:16px 2px; font-size:13.5px; color:var(--faint); }
.fcu-cargando{ display:flex; align-items:center; gap:8px; }
.fcu-mal{ margin:8px 2px; font-size:13px; color:var(--bad); }
.fcu-meta{ margin:6px 0 0; font-size:12.5px; color:var(--dim); overflow-wrap:anywhere; }
.fcu-sin{ font-size:12.5px; color:var(--faint); }
.fcu-ir{ margin-left:6px; font-weight:600; color:var(--primary); text-decoration:none; white-space:nowrap; }
.fcu-ir:hover{ text-decoration:underline; }

.fcu-cab{ display:flex; align-items:center; gap:10px; margin:4px 0 0; }
.fcu-prod{ margin:0; font-size:14px; font-weight:650; color:var(--ink); }

/* Las etapas: una lista con filete, no una pila de cajas. */
.fcu-etapas{ list-style:none; margin:0; padding:0; }
.fcu-etapa{ border-bottom:1px solid var(--border); }
.fcu-eh{ display:flex; align-items:center; gap:10px; width:100%; padding:11px 4px; background:none;
  border:0; font:inherit; text-align:left; cursor:pointer; color:var(--ink); }
.fcu-eh:disabled{ cursor:default; }
.fcu-chev{ flex:none; width:12px; font-size:15px; line-height:1; color:var(--faint); transition:transform .12s; }
.fcu-eh[aria-expanded="true"] .fcu-chev{ transform:rotate(90deg); }
.fcu-en{ font-size:14px; font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fcu-etapa.vacia .fcu-en{ color:var(--faint); font-weight:500; }
.fcu-etapa.actual > .fcu-eh .fcu-en{ color:var(--primary); }
.fcu-res{ margin-left:auto; flex:none; font-size:12.5px; color:var(--dim); font-variant-numeric:tabular-nums; }
.fcu-etapa.vacia .fcu-res{ color:var(--faint); }

.fcu-pill{ flex:none; display:inline-flex; align-items:center; font-size:11px; font-weight:600;
  padding:2px 8px; border-radius:999px; background:var(--surface-2); color:var(--dim); white-space:nowrap; }
.fcu-pill-actual{ background:var(--primary-bg); color:var(--primary); }
.fcu-pill-good{ background:var(--good-bg); color:var(--good); }
.fcu-pill-warn{ background:var(--warn-bg); color:var(--warn); }
.fcu-pill-ia{ background:var(--primary-bg); color:var(--primary); }
.fcu-chips{ display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }

/* Las clases de una etapa, sangradas bajo su chevron. */
.fcu-clases{ list-style:none; margin:0 0 8px; padding:0 0 0 22px; }
.fcu-clase{ border-top:1px solid var(--border); }
.fcu-ch{ display:flex; align-items:center; gap:12px; min-height:40px; padding:4px 4px; }
.fcu-ct{ flex:1; min-width:0; background:none; border:0; padding:6px 0; font:inherit; font-size:13.5px;
  text-align:left; cursor:pointer; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fcu-ct:hover{ color:var(--primary); }
.fcu-ct[aria-expanded="true"]{ font-weight:600; }
.fcu-visto{ flex:0 0 132px; font-size:12.5px; font-variant-numeric:tabular-nums; }
.fcu-visto.t-good{ color:var(--good); font-weight:600; }
.fcu-visto.t-dim{ color:var(--dim); }
.fcu-visto.t-faint{ color:var(--faint); }
/* El estado de la tarea y, debajo, el de la version de la IA si la hay (paso 5). */
.fcu-est{ flex:0 0 104px; display:flex; flex-direction:column; align-items:flex-start; gap:3px; }
.fcu-acc{ flex:0 0 150px; display:flex; justify-content:flex-end; }

/* Lo que contestó. */
.fcu-det{ padding:2px 4px 14px; }
.fcu-instr{ margin:0 0 10px; font-size:12.5px; color:var(--dim); white-space:pre-wrap; overflow-wrap:anywhere; }
.fcu-resp{ margin:8px 0 0; display:flex; flex-direction:column; gap:12px; }
.fcu-b dt{ margin:0 0 4px; font-size:12.5px; font-weight:600; color:var(--ink); }
.fcu-b dd{ margin:0; font-size:13.5px; color:var(--ink); white-space:pre-wrap; overflow-wrap:anywhere; }
.fcu-tabla{ border-collapse:collapse; font-size:13px; min-width:100%; white-space:normal; }
.fcu-tabla th, .fcu-tabla td{ border:1px solid var(--border); padding:6px 9px; text-align:left; vertical-align:top; }
.fcu-tabla th{ background:var(--surface-2); font-size:11.5px; font-weight:600; color:var(--dim); }

/* El costado: dos cajas, porque son dos cosas que se hacen (dar acceso, agendar). */
.fcu-sec{ border:1px solid var(--border); border-radius:12px; padding:14px 16px; background:var(--surface); }
.fcu-tit{ margin:0 0 10px; font-size:11px; font-weight:650; letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
.fcu-link{ display:block; margin-top:10px; padding:8px 10px; border-radius:8px; background:var(--surface-2); font-size:12px;
  color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
/* El estado de la invitación: una frase, la primera cosa de la caja. */
.fcu-estado{ margin:0; font-size:13.5px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fcu-estado.is-mal{ color:var(--bad); }
.fcu-bots{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
.fcu-form{ display:flex; flex-direction:column; gap:8px; }
.fcu-form > button{ align-self:flex-start; }
.fcu-label{ font-size:12.5px; font-weight:600; color:var(--ink); }
.fcu-ses{ list-style:none; margin:12px 0 0; padding:0; }
.fcu-ses li{ padding:10px 0; border-top:1px solid var(--border); }
.fcu-sh{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
.fcu-sh b{ font-size:13.5px; font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }

/* Por área: lo contestado de cada una, y los líderes con su link. */
.fcu-area{ padding:10px 0 4px; border-top:1px solid var(--border); }
.fcu-area:first-of-type{ border-top:0; }
.fcu-area-nom{ margin:0; font-size:13px; font-weight:600; color:var(--ink); overflow-wrap:anywhere; }
/* La version de la IA sin aprobar: debajo de la respuesta, en una caja tenue. */
.fcu-ia{ margin-top:12px; padding:10px 12px; border-radius:10px; background:var(--primary-bg); }
.fcu-lid{ list-style:none; margin:0; padding:0; }
.fcu-lid li{ padding:10px 0; border-top:1px solid var(--border); }
.fcu-lid li:first-child{ border-top:0; padding-top:0; }
.fcu-lid .fcu-bots{ margin-top:6px; }

/* Los permisos: un bloque por producto, con filete entre ellos; las casillas sangradas bajo el modo. */
.fcu-perm{ padding:8px 0; border-top:1px solid var(--border); }
.fcu-perm:first-of-type{ border-top:0; padding-top:0; }
.fcu-mods{ display:flex; flex-direction:column; gap:2px; margin:6px 0 0 22px; }
/* Abrir a mano: un renglón por lo cerrado, el nombre cede y el botón no. */
.fcu-abrir{ list-style:none; margin:8px 0 0; padding:0; display:flex; flex-direction:column; gap:2px; }
.fcu-abrir li{ display:flex; align-items:center; gap:8px; flex-wrap:nowrap; }
.fcu-abrir-nom{ flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; color:var(--dim); }
.fcu-abrir li > :last-child{ flex:none; margin-left:auto; }

@media(prefers-reduced-motion:reduce){ .fcu-chev{ transition:none; } }
`;
