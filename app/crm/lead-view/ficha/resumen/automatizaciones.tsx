'use client';

// =============================================================================
// ficha/resumen/automatizaciones — el bloque «Automatizaciones» de la ficha del lead (23/10/2026)
// =============================================================================
// Martín (23/10/2026): «Tal vez sería bueno crear un bloque dentro del detail de cada lead que esté relacionado a las
// automatizaciones, no? Para tener más claridad de lo que pasa... Y que claro, sea editable como el resto de bloques».
// Es el `automatizaciones-en-curso` del catálogo, que hasta el 23/10 vivía en ./charla.tsx con el nombre y el paso.
//
// LA TARJETA, REDISEÑADA (24/10/2026, Martín: «Te pedí que rediseñes la tarjeta, no sólo que cambies el texto, se sigue
// viendo muy fea»). La caja gris con el nombre, un chip en la esquina, tres renglones iguales y dos links grises se fue.
// Cada automatización es ahora:
//   · un SELLO con forma y color adelante del nombre y, debajo, su estado en dos palabras con su cuándo
//     (`estadoDeTarjeta`): se lee antes de leer;
//   · un RIEL (`rielDeTarjeta`): lo que le salió (con la cita, como le llegó), lo que contestó (con lo que dijo), lo que
//     falló o no entró, y al final lo que viene, con la hora a la derecha. Lo viejo, plegado en «Ver N antes»;
//   · un PIE con las acciones: «Frenar» a la izquierda, en rojo y aparte, como el modal de WhatsApp del Ops Center, y
//     «Empezar de nuevo» como botón a la derecha. Las dos preguntan antes, con lo que pasa de verdad.
// Las vivas van abiertas y en el orden en que hay que mirarlas (`ordenarTarjetas`); las terminadas, como filas que se
// abren en el lugar. «Hora de Tijuana» ya no va suelta abajo: cada hora la dice al pasar, y lo próximo suma la ciudad
// sólo si quien mira está en otra zona. Las referencias y el porqué de cada color, en app/crm/automatizacion-lead.ts.
// Los datos y las acciones son de Automations (app/automations/automatizaciones-del-lead-actions.ts).
//
// Diseños (catálogo): «Lista» (de entrada), «Línea de tiempo» (la misma tarjeta con el riel entero) y «Una línea».
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { Confirm } from '@/app/_ui/Confirm';
import {
  fechaCorta, lineaDelBloque, ordenarTarjetas, preguntaDeEmpezarDeNuevo, preguntaDeFrenarEnFicha, vistaVacia,
  type AutomatizacionesVista, type InscripcionVista,
} from '@/app/crm/automatizacion-lead';
import { useTzWorkspace } from '../../useTzWorkspace';
import type { PropsBloque } from '../tipos';
import { Bloque } from './piezas';
import { useLectura } from './lectura';
import { empezarDeNuevoDelBloque, frenarDelBloque, leerAutomatizacionesDelBloque } from './automatizaciones-datos';
import { FilaAutomatizacion, TarjetaAutomatizacion, type EntornoTarjeta } from './tarjeta-automatizacion';

type Accion = { tipo: 'frenar' | 'empezar'; aut: InscripcionVista };
/** Cuántas terminadas se ven antes de «Ver N más». */
const TERMINADAS_A_LA_VISTA = 3;

export function AutomatizacionesDelLead({ ctx, titulo, diseno, epico }: PropsBloque) {
  const tz = useTzWorkspace();
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const leer = useCallback((id: number) => leerAutomatizacionesDelBloque(id), [version]);
  const { dato: r } = useLectura<AutomatizacionesVista>(ctx.lead.id, leer);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [haciendo, setHaciendo] = useState(false);
  // Un error queda en el pie de SU tarjeta; lo que salió bien, en un toast.
  const [error, setError] = useState<{ secuenciaId: number; texto: string } | null>(null);
  const { toast, show, clear } = useToast();
  // Las terminadas abiertas a mano y las plegadas a mano (la primera sale abierta sola cuando no hay ninguna viva).
  const [abiertas, setAbiertas] = useState<ReadonlySet<number>>(new Set());
  const [plegadas, setPlegadas] = useState<ReadonlySet<number>>(new Set());
  const [conAntes, setConAntes] = useState<ReadonlySet<number>>(new Set());
  const [todasTerminadas, setTodasTerminadas] = useState(false);
  // La zona de quien mira, después de montar (en el server no hay): sólo para decir la ciudad si es otra.
  const [tzLocal, setTzLocal] = useState<string | null>(null);
  useEffect(() => { try { setTzLocal(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* sin Intl: no se dice */ } }, []);
  const cancelar = useCallback(() => setAccion(null), []);

  const ahora = Date.now();
  const fecha = (iso: string) => fechaCorta(iso, tz, ahora);
  const alternar = (set: (f: (s: ReadonlySet<number>) => ReadonlySet<number>) => void, id: number) =>
    set((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const sin = (id: number) => (s: ReadonlySet<number>) => { const n = new Set(s); n.delete(id); return n; };
  const abrir = (id: number) => { setAbiertas((s) => new Set(s).add(id)); setPlegadas(sin(id)); };
  const plegar = (id: number) => { setPlegadas((s) => new Set(s).add(id)); setAbiertas(sin(id)); };

  const confirmar = async () => {
    if (!accion || haciendo) return;
    const { tipo, aut } = accion;
    setHaciendo(true);
    setError(null);
    try {
      const q = tipo === 'frenar'
        ? await frenarDelBloque(ctx.lead.id, aut.secuenciaId)
        : await empezarDeNuevoDelBloque(ctx.lead.id, aut.secuenciaId);
      if (q.ok) {
        show(tipo === 'frenar' ? 'Frenada' : 'Empezó de nuevo', undefined, 'good');
        // La recién frenada pasa a las terminadas: abierta, para que se vea qué le pasó.
        if (tipo === 'frenar') abrir(aut.secuenciaId);
      } else setError({ secuenciaId: aut.secuenciaId, texto: q.error });
    } catch {
      setError({ secuenciaId: aut.secuenciaId, texto: tipo === 'frenar' ? 'No se pudo frenar.' : 'No se pudo empezar de nuevo.' });
    }
    setHaciendo(false);
    setAccion(null);
    setVersion((v) => v + 1);
  };

  const pregunta = accion
    ? (accion.tipo === 'frenar'
      ? preguntaDeFrenarEnFicha({ nombre: ctx.lead.nombre, aut: accion.aut })
      : preguntaDeEmpezarDeNuevo({ nombre: ctx.lead.nombre, aut: accion.aut }))
    : null;
  const confirmacion = pregunta && (
    <Confirm title={pregunta.titulo} message={pregunta.mensaje} confirmLabel={accion?.tipo === 'frenar' ? 'Frenar' : 'Empezar de nuevo'}
      tone={accion?.tipo === 'frenar' ? 'danger' : 'primary'} loading={haciendo} onConfirm={() => void confirmar()} onCancel={cancelar} />
  );
  const aviso = <Toast state={toast} onClose={clear} />;

  if (r === 'cargando') return null;
  if (r === null) {
    return <Bloque titulo={titulo} epico={epico}><span className="fr-sub">No pude leer sus automatizaciones. Vuelve a abrir la ficha en un rato.</span></Bloque>;
  }
  // Frenó la última y no queda nada: el toast lo dice.
  if (vistaVacia(r)) return aviso;

  const derecha = <Link href="/automations" className="fr-link">Ver todas</Link>;
  const conTarjeta = new Set([...r.vivas, ...r.terminadas].map((a) => a.secuenciaId));
  // Lo que no entró de una automatización SIN tarjeta: arriba, en ámbar (con tarjeta, va adentro de su riel).
  const sueltos = r.noEntro.filter((n) => !conTarjeta.has(n.secuenciaId));
  const noEntro = sueltos.length > 0 && (
    <div className="fr-aut-noentro" role="note">
      {sueltos.map((n, i) => (
        <div key={`${n.secuenciaId}-${i}`} className="fr-aut-noentro-fila">
          <span>{n.texto}{n.at ? <span className="fr-sub"> · {fecha(n.at)}</span> : null}</span>
        </div>
      ))}
    </div>
  );

  // ── Las tarjetas y las filas (piezas puras, arriba): lo que cada una sabe de la pantalla y lo que puede pedir ────────
  const en: EntornoTarjeta = { tz, ahora, tzLocal, noEntro: r.noEntro };
  // «Ver N antes» sólo en «Lista»: en épico y en «Línea de tiempo» el riel va entero.
  const plegaAntes = !epico && diseno !== 'tiempo';
  const tarjeta = (a: InscripcionVista, plegable = false) => (
    <TarjetaAutomatizacion key={a.secuenciaId} a={a} en={en} todo={!plegaAntes || conAntes.has(a.secuenciaId)}
      verMenos={plegaAntes && conAntes.has(a.secuenciaId)} error={error?.secuenciaId === a.secuenciaId ? error.texto : null}
      onAntes={() => alternar(setConAntes, a.secuenciaId)}
      onFrenar={() => { setError(null); setAccion({ tipo: 'frenar', aut: a }); }}
      onEmpezar={() => { setError(null); setAccion({ tipo: 'empezar', aut: a }); }}
      onPlegar={plegable ? () => plegar(a.secuenciaId) : undefined} />
  );
  const fila = (a: InscripcionVista) => <FilaAutomatizacion key={a.secuenciaId} a={a} en={en} onAbrir={() => abrir(a.secuenciaId)} />;

  // «Una línea»: los nombres con su estado, y lo que no entró.
  if (diseno === 'linea' && !epico) {
    return (
      <>
        <Bloque titulo={titulo} epico={false} derecha={derecha}>
          {noEntro}
          <span className="fr-linea">{lineaDelBloque(r)}</span>
        </Bloque>
        {confirmacion}
        {aviso}
      </>
    );
  }

  // «Lista» y «Línea de tiempo»: las vivas abiertas, en el orden en que hay que mirarlas; las terminadas, como filas (sin
  // ninguna viva, la primera abierta).
  const vivas = ordenarTarjetas(r.vivas);
  const abierta = (a: InscripcionVista, k: number) => !plegadas.has(a.secuenciaId) && (abiertas.has(a.secuenciaId) || (!vivas.length && k === 0));
  const terminadas = todasTerminadas ? r.terminadas : r.terminadas.slice(0, TERMINADAS_A_LA_VISTA);
  const masTerminadas = r.terminadas.length - terminadas.length;
  return (
    <>
      <Bloque titulo={titulo} epico={epico} derecha={derecha}>
        {noEntro}
        {vivas.length > 0 && <div className="fr-aut-lista">{vivas.map((a) => tarjeta(a))}</div>}
        {r.terminadas.length > 0 && (
          <div className="fr-aut-filas">
            {terminadas.map((a, k) => (abierta(a, k) ? tarjeta(a, true) : fila(a)))}
            {masTerminadas > 0 && (
              <button type="button" className="fr-aut-mas" onClick={() => setTodasTerminadas(true)}>Ver {masTerminadas} más</button>
            )}
          </div>
        )}
      </Bloque>
      {confirmacion}
      {aviso}
    </>
  );
}
