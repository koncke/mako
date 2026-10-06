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
import { Button, Confirm, Input, Select, Spinner, useOkFlash } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import type { Sesion } from '@/lib/curso-datos';
import { ROTULO_TAREA, type EstadoTarea } from '@/lib/curso';
import type { EntregaFicha } from './FichaEntrega';
import {
  cursoDeClienteAction, aprobarTareaCursoAction, mandarLinkCursoAction, cortarAccesoCursoAction,
  habilitarAccesoCursoAction, agendarLlamadaCursoAction, borrarLlamadaCursoAction, linkDelCursoAction,
} from './curso-ficha-actions';
import {
  avisosDeSesion, contestoAlgo, estadoDeInvitacion, estadoDeTarea, fechaHoraLocal, fraseIngresos, fraseInvitacion,
  fraseResumen, isoDeLocal, respuestaDe, resumenDeEtapa, rotuloVisto,
  type AccesoFicha, type AvisoInvitacionCurso, type BloqueRespuesta, type ClaseFicha, type CursoDeCliente,
  type EtapaFicha, type ProductoFicha,
} from './curso-ficha-lectura';
import { CabezaAvance, CeldasAvance, EstiloAvance } from './curso/FilaAvance';
import { BotonInvitar } from './curso/InvitarAlCurso';

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
          {(curso.acceso || curso.errorAcceso) && <Acceso leadId={leadId} curso={curso} editar={editar} />}
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
      etapas: p.etapas.map((e) => {
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

  const abierta = (e: EtapaFicha) => abiertas[`${prod.productoId}:${e.key}`] ?? (e.actual && e.clases.length > 0);

  return (
    <>
      {error && <p className="fcu-mal">No se guardó. {error}</p>}

      <ol className="fcu-etapas">
        {prod.etapas.map((e) => {
          const vacia = e.clases.length === 0;
          const open = !vacia && abierta(e);
          return (
            <li key={e.key} className={`fcu-etapa${vacia ? ' vacia' : ''}${e.actual ? ' actual' : ''}`}>
              <button type="button" className="fcu-eh" disabled={vacia} aria-expanded={vacia ? undefined : open}
                onClick={() => setAbiertas((m) => ({ ...m, [`${prod.productoId}:${e.key}`]: !open }))}>
                <span className="fcu-chev" aria-hidden>{vacia ? '' : '›'}</span>
                <span className="fcu-en">{e.label}</span>
                {e.actual && <span className="fcu-pill fcu-pill-actual">Actual</span>}
                <span className="fcu-res">{vacia ? 'Sin clases' : fraseResumen(e.resumen)}</span>
                {e.resumen.completa && <span className="fcu-pill fcu-pill-good">Completa</span>}
              </button>
              {open && (
                <ul className="fcu-clases">
                  {e.clases.map((c) => (
                    <FilaClase key={c.id} c={c} abierta={claseAbierta === c.id}
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

function FilaClase({ c, abierta, onAbrir, revisando, onRevisar }: {
  c: ClaseFicha; abierta: boolean; onAbrir: () => void; revisando: boolean; onRevisar: (aprobada: boolean) => void;
}) {
  const visto = rotuloVisto(c.medicion, c.progreso);
  const estado = estadoDeTarea(c, c.progreso);
  return (
    <li className="fcu-clase">
      <div className="fcu-ch">
        <button type="button" className="fcu-ct" aria-expanded={abierta} onClick={onAbrir} title={c.titulo}>
          {c.titulo}
        </button>
        <span className={`fcu-visto t-${visto.tono}`}>{visto.texto}</span>
        <span className="fcu-est">
          {estado ? <span className={`fcu-pill ${TONO_TAREA[estado]}`}>{ROTULO_TAREA[estado]}</span> : <span className="fcu-sin">Sin tarea</span>}
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
      {abierta && <DetalleClase c={c} />}
    </li>
  );
}

function DetalleClase({ c }: { c: ClaseFicha }) {
  const bloques = respuestaDe(c.campos, c.progreso?.valores);
  const enviada = fechaHoraLocal(c.progreso?.enviadaAt);
  return (
    <div className="fcu-det">
      {c.tarea.trim() && <p className="fcu-instr">{c.tarea.trim()}</p>}
      {enviada && <p className="fcu-meta">Enviada el {enviada}</p>}
      {!c.tarea.trim() && !c.campos.length
        ? <p className="fcu-nada">Esta clase no pide tarea.</p>
        : !contestoAlgo(bloques)
          ? <p className="fcu-nada">Sin contestar.</p>
          : <dl className="fcu-resp">{bloques.map((b) => <Bloque key={b.id} b={b} />)}</dl>}
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
 */
function Acceso({ leadId, curso, editar }: { leadId: number; curso: CursoDeCliente; editar: Editar }) {
  const copiado = useOkFlash();
  const enviado = useOkFlash();
  const [ocupado, setOcupado] = useState<'copiar' | 'mandar' | 'cortar' | 'habilitar' | null>(null);
  const [preguntaCortar, setPreguntaCortar] = useState(false);
  const [error, setError] = useState('');
  /** Lo que dejó la invitación cuando el mail salió pero algo quedó por decir (no se anotó). */
  const [aviso, setAviso] = useState<AvisoInvitacionCurso | null>(null);
  const a = curso.acceso;

  const poner = (acceso: AccesoFicha) => editar((c) => ({ ...c, acceso, errorAcceso: undefined }));

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
      const r = cual === 'cortar' ? await cortarAccesoCursoAction(leadId) : await habilitarAccesoCursoAction(leadId);
      if (!r.ok) setError(r.error);
      else poner(r.acceso);
    } catch (e) {
      setError(msg(e, 'No se pudo.'));
    } finally {
      setOcupado(null);
    }
  }

  const invitacion = a ? estadoDeInvitacion(a) : null;

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
                <BotonInvitar leadId={leadId} nombre={curso.nombre} emailCrm={curso.emailCrm} acceso={a}
                  variant={invitacion.tipo === 'invitado' ? 'secondary' : 'primary'}
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
        <Confirm title="¿Cortar su acceso?" message="Los links que ya tiene dejan de abrir."
          confirmLabel="Cortar acceso" cancelLabel="No cortar" tone="danger"
          onCancel={() => setPreguntaCortar(false)}
          onConfirm={() => { setPreguntaCortar(false); void cambiar('cortar'); }} />
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
.fcu-est{ flex:0 0 92px; }
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

@media(prefers-reduced-motion:reduce){ .fcu-chev{ transition:none; } }
`;
