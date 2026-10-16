'use client';

// =============================================================================
// CalendarioM — el Calendario del teléfono: la copia de la app de Google Calendar sobre la lectura de escritorio
// =============================================================================
// De arriba abajo (referencia: la app de Google Calendar para Android/iOS, y el prototipo v3 `calendario`):
//   · arriba a la derecha, HOY (el cuadrito con el número del día, el ícono de Google);
//   · el segmentado de las vistas, con el nombre y el orden de escritorio: Día · Agenda;
//   · el MES («Octubre ▾», se toca y abre el mes chico, como en Google) con ‹ › al lado, que hacen lo de las flechas
//     de escritorio: un día en el Día, una semana en la Agenda (y un mes con el mes chico abierto);
//   · la TIRA de la semana con un punto en los días con algo;
//   · la vista; y el «+» flotante abajo a la derecha, que abre «Nuevo evento».
//
// Lo que no se ve en la firma:
//   · SE LEE UNA VEZ, ANCHO (`rangoDeLectura`): del lunes de la semana a los 30 días de la Agenda. Cambiar de vista o
//     de día dentro de eso es instantáneo y no toca la URL; salir de ahí navega (`?vista=&fecha=`, las claves de
//     escritorio) y el server vuelve a leer.
//   · QUÉ SE VE es lo de por defecto de escritorio (`visiblesPorDefecto`: lo de MaKo y lo tildado en Google), sin la
//     llamada repetida (`sinLlamadasRepetidas`). Elegir calendarios es de la computadora.
//   · LO OPTIMISTA (lo borrado se va, lo tildado se tacha) dura hasta la lectura nueva: las actions de escritorio
//     revalidan y la página vuelve fresca sola; acá no se pide otro `router.refresh()` (serían dos renders).
//   · REFRESCAR (tirar hacia abajo) trae lo nuevo: los eventos son props, no un estado copiado; lo que se guarda en
//     estado es sólo lo que la persona eligió (la vista, el día).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { CabeceraM, ErrorM, SegmentadoM, VacioM, useToastM } from '@/app/m/_ui';
import { haptico } from '@/lib/haptico';
import { sumarDias, type ItemCalendario } from '@/lib/calendario-modelo';
import type { FallosCalendario, GoogleDelCalendario } from '@/lib/calendario';
import {
  entradaGoogle, entradaPropia, llaveDe, sinLlamadasRepetidas, vaAGoogle, visiblesPorDefecto, type BorradorNuevo,
} from '@/app/calendario/comun';
import {
  borrarEventoAction, borrarEventoGoogleAction, crearEventoGoogleAction, crearEventosAction, marcarEventoAction,
  restaurarEventoAction, restaurarEventoGoogleAction,
} from '@/app/calendario/actions';
import {
  VISTAS_M, borradorNuevo, diasConAlgo, enRango, fechaParaCrear, fraseDeFallos, gruposDeAgenda, rotuloDelMes, semanaDe,
  sumarMeses, type RangoM, type VistaM,
} from './modelo';
import { AgendaM, DiaM, MiniMesM, SemanaM } from './VistasM';
import { HojaEvento, HojaNueva } from './HojasM';

type Hoja = 'evento' | 'nuevo' | null;

const sinMovimiento = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function CalendarioM({ vistaInicial, fecha, hoy, tz, rango, items, fallos, google }: {
  vistaInicial: VistaM;
  /** La fecha de la URL: desde dónde arranca la Agenda y el día que abre el Día. */
  fecha: string;
  hoy: string;
  tz: string;
  /** Lo leído (`rangoDeLectura`). */
  rango: RangoM;
  items: ItemCalendario[];
  fallos: FallosCalendario;
  google: GoogleDelCalendario | null;
}) {
  const router = useRouter();
  const toast = useToastM();
  const calendarios = useMemo(() => google?.calendarios ?? [], [google]);
  const googleEscribe = !!google?.puedeEscribir;
  const editables = useMemo(() => (googleEscribe ? calendarios.filter((c) => c.editable) : []), [calendarios, googleEscribe]);
  const visibles = useMemo(() => visiblesPorDefecto(calendarios), [calendarios]);

  const [vista, setVista] = useState<VistaM>(vistaInicial);
  const [dia, setDia] = useState(fecha);
  const [mesAbierto, setMesAbierto] = useState(false);
  const [mesVisto, setMesVisto] = useState(fecha);
  const [hoja, setHoja] = useState<Hoja>(null);
  const [evento, setEvento] = useState<ItemCalendario | null>(null);
  const [borrador, setBorrador] = useState<BorradorNuevo | null>(null);
  const [vez, setVez] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocultos, setOcultos] = useState<ReadonlySet<string>>(() => new Set());
  const [hechos, setHechos] = useState<Readonly<Record<string, boolean>>>({});

  // La lectura nueva manda: lo borrado o tildado ya viene en ella.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOcultos(new Set()); setHechos({}); }, [items]);

  const aDibujar = useMemo(() => sinLlamadasRepetidas(
    items
      .filter((it) => visibles.has(llaveDe(it)) && !ocultos.has(it.id))
      .map((it) => (it.id in hechos ? { ...it, hecho: hechos[it.id] } : it)),
  ), [items, visibles, ocultos, hechos]);
  const conAlgo = useMemo(() => diasConAlgo(aDibujar, rango, tz), [aDibujar, rango, tz]);

  // ── Moverse ──
  const navegar = useCallback((v: VistaM, f: string) => {
    setHoja(null);
    router.push(`/m/calendario?vista=${v}&fecha=${f}`);
  }, [router]);
  /** Un día: si está en lo leído, en el acto; si no, se va a leerlo. */
  const irAlDia = useCallback((d: string) => {
    setMesAbierto(false);
    if (enRango(d, rango)) { setVista('dia'); setDia(d); return; }
    navegar('dia', d);
  }, [rango, navegar]);
  const alHoy = useCallback(() => {
    haptico('light');
    if (vista === 'dia') { irAlDia(hoy); return; }
    if (fecha === hoy) { setMesAbierto(false); window.scrollTo({ top: 0, behavior: sinMovimiento() ? 'auto' : 'smooth' }); return; }
    navegar('agenda', hoy);
  }, [vista, fecha, hoy, irAlDia, navegar]);
  const paso = (delta: -1 | 1) => {
    if (mesAbierto) { setMesVisto((m) => sumarMeses(m, delta)); return; }
    if (vista === 'dia') irAlDia(sumarDias(dia, delta));
    else navegar('agenda', sumarDias(fecha, 7 * delta));
  };
  const abrirMes = () => {
    setMesVisto(vista === 'dia' ? dia : fecha);
    setMesAbierto((x) => !x);
  };

  // ── Crear, tildar y borrar (las actions de escritorio, con su guard) ──
  const abrirNuevo = (f: string, iniMin: number | null) => {
    haptico('light');
    setError(null);
    setBorrador(borradorNuevo(f, iniMin, editables));
    setVez((n) => n + 1);
    setHoja('nuevo');
  };
  const abrirEvento = (it: ItemCalendario) => { setEvento(it); setHoja('evento'); };

  const guardar = async (b: BorradorNuevo) => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const aGoogle = vaAGoogle(b, editables) && !!b.calendarioId;
      const r = aGoogle
        ? await crearEventoGoogleAction(b.calendarioId!, entradaGoogle(b))
        : await crearEventosAction([entradaPropia(b)], 'user');
      if (!r.ok) { setError(r.error); return; }
      setHoja(null);
      toast(aGoogle ? 'Evento guardado' : 'Agendado');
      // Que se vea lo que se acaba de crear: el día, si está en lo leído; si no, se va a leerlo.
      if (!enRango(b.fecha, rango)) navegar('dia', b.fecha);
      else if (vista === 'dia') setDia(b.fecha);
    } catch {
      setError('Sin conexión. Prueba de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const marcar = async (it: ItemCalendario, hecho: boolean) => {
    setHoja(null);
    setHechos((x) => ({ ...x, [it.id]: hecho }));
    const volver = () => setHechos((x) => { const n = { ...x }; delete n[it.id]; return n; });
    try {
      if (!(await marcarEventoAction(it.id.replace(/^propio:/, ''), hecho))) { volver(); toast('Ese evento ya no existe'); return; }
      toast(hecho ? 'Hecho' : 'Pendiente');
    } catch {
      volver();
      toast('No se pudo guardar');
    }
  };

  const borrar = async (it: ItemCalendario) => {
    setHoja(null);
    setOcultos((s) => new Set(s).add(it.id));
    const volver = () => setOcultos((s) => { const n = new Set(s); n.delete(it.id); return n; });
    const noSePudo = () => toast('No se pudo deshacer');
    try {
      if (it.google) {
        const g = it.google;
        // Como en escritorio: con invitados, Google les avisa (el botón ya lo dijo).
        const r = await borrarEventoGoogleAction(g.calendarioId, g.id, g.invitados > 0);
        if (!r.ok) { volver(); toast('No se pudo borrar'); return; }
        toast('Evento borrado', {
          deshacer: () => { void restaurarEventoGoogleAction(g.calendarioId, g.id).then((x) => { if (!x.ok) noSePudo(); }).catch(noSePudo); },
        });
        return;
      }
      const b = await borrarEventoAction(it.id.replace(/^propio:/, ''));
      // null = ya no estaba (lo borró otro, u otro toque): no hay nada que deshacer, y un toast sin Deshacer
      // reemplazaría al del borrado que sí pasó (el toast nuevo pisa al anterior). Ya no se ve: no se dice nada.
      if (b) toast('Evento borrado', { deshacer: () => { void restaurarEventoAction(b).catch(noSePudo); } });
    } catch {
      volver();
      toast('No se pudo borrar');
    }
  };

  // ── Hoy, arriba a la derecha (el ícono de Google: el cuadrito con el número del día) ──
  const accion = useMemo(() => (
    <button type="button" className="m-cabecera__accion m-calendario-hoy" aria-label="Hoy" onClick={alHoy}>
      <span className="m-calendario-hoy__caja" aria-hidden>{Number(hoy.slice(8))}</span>
    </button>
  ), [alHoy, hoy]);

  // ── El «+» flotante: va en #m-pie (fuera de la columna, que se corre al tirar para refrescar) ──
  const [capaPie, setCapaPie] = useState<HTMLElement | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCapaPie(document.getElementById('m-pie')); }, []);

  const fallo = fraseDeFallos(fallos, google);
  const delMes = mesAbierto ? mesVisto : vista === 'dia' ? dia : fecha;
  const unidad = mesAbierto ? 'Mes' : vista === 'dia' ? 'Día' : 'Semana';
  const grupos = vista === 'agenda' ? gruposDeAgenda(aDibujar, fecha, hoy, tz) : [];

  return (
    <div className="m-calendario">
      <CabeceraM accion={accion} />

      <div className="m-calendario-seg">
        <SegmentadoM etiqueta="Vista" valor={vista} onCambio={(v) => { setVista(v); setMesAbierto(false); }}
          opciones={VISTAS_M.map((v) => ({ id: v.id, label: v.label }))} />
      </div>

      <div className="m-calendario-mes">
        <button type="button" className="m-calendario-mes__boton" aria-expanded={mesAbierto} onClick={abrirMes}>
          <span>{rotuloDelMes(delMes, hoy)}</span>
          <Icon name="chevron" size={20} />
        </button>
        <button type="button" className="m-calendario-flecha m-calendario-flecha--antes" aria-label={`${unidad} anterior`} onClick={() => paso(-1)}>
          <Icon name="chevron" size={22} />
        </button>
        <button type="button" className="m-calendario-flecha m-calendario-flecha--despues" aria-label={`${unidad} siguiente`} onClick={() => paso(1)}>
          <Icon name="chevron" size={22} />
        </button>
      </div>

      {mesAbierto ? (
        <MiniMesM mes={mesVisto} hoy={hoy} elegido={vista === 'dia' ? dia : null} conAlgo={conAlgo}
          onDia={(d) => { if (vista === 'dia') irAlDia(d); else { setMesAbierto(false); navegar('agenda', d); } }} />
      ) : (
        <SemanaM dias={semanaDe(vista === 'dia' ? dia : fecha)} hoy={hoy} elegido={vista === 'dia' ? dia : hoy}
          conAlgo={conAlgo} rango={rango} onDia={irAlDia} />
      )}

      {/* «No pude leer» no es «no hay»: con una lectura caída, lo de abajo no se afirma entero. */}
      {fallo && <ErrorM frase={fallo} />}
      {google?.recortado && <p className="m-calendario-nota-chica">Hay más eventos de los que entran.</p>}

      {vista === 'dia' ? (
        <DiaM key={dia} dia={dia} items={aDibujar} hoy={hoy} tz={tz} onAbrir={abrirEvento} onCrearEn={(min) => abrirNuevo(dia, min)} />
      ) : grupos.length ? (
        <AgendaM grupos={grupos} hoy={hoy} tz={tz} onAbrir={abrirEvento} onDia={irAlDia} />
      ) : !fallo ? (
        <VacioM frase="No hay eventos en los próximos 30 días." />
      ) : null}

      {capaPie && createPortal(
        <button type="button" className="m-calendario-fab" aria-label="Crear evento"
          onClick={() => abrirNuevo(fechaParaCrear(vista, dia, fecha, hoy), 10 * 60)}>
          <Icon name="plus" size={26} />
        </button>,
        capaPie,
      )}

      <HojaEvento abierta={hoja === 'evento'} item={evento} tz={tz} calendarios={calendarios} googleEscribe={googleEscribe}
        onCerrar={() => setHoja(null)} onHecho={(it, h) => { void marcar(it, h); }} onBorrar={(it) => { void borrar(it); }} />
      {borrador && (
        <HojaNueva key={vez} abierta={hoja === 'nuevo'} inicial={borrador} editables={editables} guardando={guardando} error={error}
          onCerrar={() => setHoja(null)} onGuardar={(b) => { void guardar(b); }} />
      )}
    </div>
  );
}
