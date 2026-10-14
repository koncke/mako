'use client';

// =============================================================================
// CalendarioApp — la tab Calendario: una copia fiel de Google Calendar, con lo de MaKo y lo de Google juntos
// =============================================================================
// Martín, 14/10/2026: «el calendario quiero que sea una copia fiel a Google Calendar, y que refleje todas las tareas y
// eventos que se tienen en google calendar». De arriba abajo, como en Google:
//   · LA BARRA: ☰ (la barra lateral), el logo con el día de hoy, «Hoy», ‹ ›, el título («octubre de 2026») y, a la
//     derecha, la vista (Día, Semana, Mes, Año, Agenda, 4 días).
//   · LA BARRA LATERAL: «Crear» (un evento, una publicación, un bloque, una llamada, o una semana con plantillas o con
//     MaKo), el mes chico, «Mis calendarios» de MaKo y los calendarios de la cuenta de Google, cada uno con su casilla.
//   · LA HOJA: la vista. Un clic (o un arrastre) en un hueco crea; un clic en algo abre su tarjeta; lo que se puede
//     mover se arrastra.
//
// Lo que no se ve en la firma:
//   · LA VISTA Y LA FECHA VIAJAN EN LA URL (`?vista=&fecha=`) y las LEE EL SERVER: el link que se copia es lo que se
//     ve. Se navega con el router de la casa (preserva el `?ws=`).
//   · QUÉ CALENDARIOS SE VEN ES UNA PREFERENCIA DEL NAVEGADOR (localStorage con el workspace en la clave, con try/catch):
//     sin la clave, los de MaKo prendidos y los de Google como estén tildados en Google.
//   · LO DE GOOGLE SE ESCRIBE EN GOOGLE (decisión del 14/10/2026): crear, cambiar, mover y borrar, en los calendarios
//     donde la cuenta puede editar. Lo de MaKo (publicaciones, bloques, llamadas propias) sigue en MaKo.
//   · MOVER CON INVITADOS PREGUNTA, como Google: «¿avisar el cambio?». Sin invitados, se mueve y listo.
//   · BORRAR DEJA «DESHACER» en el toast, que devuelve el MISMO evento (el de MaKo y el de Google).
//   · LO QUE SE MOVIÓ SE VE EN SU LUGAR NUEVO EN EL ACTO (`movidos`), hasta que llega la lectura nueva: sin eso, la
//     tarjeta vuelve a donde estaba durante el viaje al server y se lee como que no se movió.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link, { useRouter, useWs } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import {
  CAPAS_CALENDARIO, VISTAS_CALENDARIO, diaDe, horaDe, lunesDe, moverFecha, rangoDeVista, rotuloDeRango, sinDuplicarLlamadas,
  type CapaCalendario, type EntradaEvento, type ItemCalendario, type PlantillaCalendario, type VistaCalendario,
} from '@/lib/calendario-modelo';
import type { FallosCalendario, GoogleDelCalendario } from '@/lib/calendario';
import type { EntradaEventoGoogle } from '@/lib/calendario-google-modelo';
import {
  crearEventosAction, cambiarEventoAction, marcarEventoAction, borrarEventoAction, restaurarEventoAction,
  crearEventoGoogleAction, cambiarEventoGoogleAction, borrarEventoGoogleAction, restaurarEventoGoogleAction,
} from './actions';
import { EventoModal, type EventoEditable } from './EventoModal';
import { NuevoEnCalendario } from './NuevoEnCalendario';
import { CSS_GC } from './gc-css';
import { COLOR_CAPA, LLAVES_MAKO, NOMBRE_CAPA, llaveDe } from './comun';
import { MiniMes, Flecha } from './MiniMes';
import { VistaTiempo, type NuevoRango } from './VistaTiempo';
import { VistaAgenda, VistaAnio, VistaMes } from './VistasLista';
import { EventoGoogleModal, RapidoNuevo, TarjetaEvento, duracionEntre, type BorradorNuevo, type EdicionGoogle } from './Tarjetas';

type Abierto =
  | { t: 'tarjeta'; item: ItemCalendario; ancla: DOMRect }
  | { t: 'rapido'; ancla: DOMRect; borrador: BorradorNuevo }
  | { t: 'propio'; inicial: EventoEditable }
  | { t: 'google'; inicial: EdicionGoogle }
  | { t: 'plantillas' }
  | { t: 'avisar'; item: ItemCalendario; entrada: EntradaEventoGoogle; mov: Movido }
  | null;

/** Dónde quedó algo que se acaba de mover, mientras viaja al server. */
type Movido = { inicio: string; fin: string | null };

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const llavePreferencia = (ws: number | null) => `calendario.visibles.${ws ?? 'propio'}`;

export function CalendarioApp({ vista, fecha, hoy, tz, dias, items, fallos, google, pendienteOnboarding }: {
  vista: VistaCalendario;
  fecha: string;
  hoy: string;
  tz: string;
  dias: string[];
  items: ItemCalendario[];
  fallos: FallosCalendario;
  google: GoogleDelCalendario | null;
  /** El onboarding de la tab no está hecho: se abren las plantillas la primera vez (es la primera semana). */
  pendienteOnboarding: boolean;
}) {
  const router = useRouter();
  const ws = useWs();
  const calendarios = useMemo(() => google?.calendarios ?? [], [google]);
  const googleEscribe = !!google?.puedeEscribir;
  const editables = useMemo(() => (googleEscribe ? calendarios.filter((c) => c.editable) : []), [calendarios, googleEscribe]);
  const porDefecto = useMemo(() => new Set([...LLAVES_MAKO, ...calendarios.filter((c) => c.seleccionado).map((c) => `g:${c.id}`)]), [calendarios]);
  const [elegidas, setElegidas] = useState<Record<string, boolean>>({});
  const visibles = useMemo(() => {
    const s = new Set(porDefecto);
    for (const [k, v] of Object.entries(elegidas)) { if (v) s.add(k); else s.delete(k); }
    return s;
  }, [porDefecto, elegidas]);
  const [lado, setLado] = useState(true);
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [menuVista, setMenuVista] = useState<DOMRect | null>(null);
  const [menuCrear, setMenuCrear] = useState<DOMRect | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movidos, setMovidos] = useState<Record<string, Movido>>({});
  const [plegados, setPlegados] = useState<Record<string, boolean>>({});
  const { toast, show, clear } = useToast(6000);

  // La lectura nueva manda: lo movido ya está donde quedó.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMovidos({}); }, [items]);

  // La preferencia de qué se ve: se lee al montar (no pisa nada que se haya decidido en esta pantalla).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(llavePreferencia(ws));
      const v = raw ? JSON.parse(raw) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v && typeof v === 'object') setElegidas(Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'boolean')) as Record<string, boolean>);
    } catch { /* sin almacenamiento: lo de por defecto */ }
  }, [ws]);
  const alternar = (llave: string) => {
    setElegidas((e) => {
      const n = { ...e, [llave]: !visibles.has(llave) };
      try { window.localStorage.setItem(llavePreferencia(ws), JSON.stringify(n)); } catch { /* preferencia: no pasa nada */ }
      return n;
    });
  };

  // La primera vez (onboarding pendiente) se abren las plantillas: armar la primera semana ES el onboarding.
  useEffect(() => {
    if (!pendienteOnboarding) return;
    try { if (window.sessionStorage.getItem('calendario.bienvenida')) return; window.sessionStorage.setItem('calendario.bienvenida', '1'); } catch { /* igual se abre */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbierto({ t: 'plantillas' });
  }, [pendienteOnboarding]);

  const ir = useCallback((v: VistaCalendario, f: string) => { setAbierto(null); router.push(`/calendario?vista=${v}&fecha=${f}`); }, [router]);

  // Los atajos de Google: t (hoy), j/n (siguiente), k/p (anterior), c (crear), y la tecla de cada vista.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || abierto) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const k = e.key.toLowerCase();
      const v = VISTAS_CALENDARIO.find((x) => x.tecla === k);
      if (v) { ir(v.id, fecha); return; }
      if (k === 't') ir(vista, hoy);
      else if (k === 'j' || k === 'n') ir(vista, moverFecha(vista, fecha, 1));
      else if (k === 'k' || k === 'p') ir(vista, moverFecha(vista, fecha, -1));
      else if (k === 'c') nuevoDesdeBoton();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  // Lo que se dibuja: lo prendido, en su lugar nuevo si se acaba de mover, y sin la llamada repetida (la del CRM y su
  // evento de Google son la misma: si las dos están a la vista, queda la del CRM, que lleva a la ficha).
  const aDibujar = useMemo(() => {
    const prendidos = items
      .filter((it) => visibles.has(llaveDe(it)))
      .map((it) => (movidos[it.id] ? { ...it, ...movidos[it.id] } : it));
    const crm = prendidos.filter((i) => i.fuente === 'crm');
    const google = prendidos.filter((i) => i.fuente === 'google');
    const sinRepetir = new Set(sinDuplicarLlamadas(crm, google).map((i) => i.id));
    return prendidos.filter((i) => i.fuente !== 'google' || sinRepetir.has(i.id));
  }, [items, visibles, movidos]);
  const enVista = useMemo(() => new Set(rangoDeVista(vista, fecha).dias), [vista, fecha]);

  // ── Crear ──
  const borradorEn = (f: string, ini: number | null, fin: number | null): BorradorNuevo => ({
    tipo: 'evento', titulo: '', fecha: f, hora: ini == null ? null : hhmm(ini), horaFin: fin == null ? null : hhmm(Math.min(fin, 24 * 60 - 1)),
    formato: 'reel', calendarioId: editables.find((c) => c.primario)?.id ?? editables[0]?.id ?? null,
  });
  const nuevoDesdeBoton = () => {
    const f = enVista.has(hoy) ? hoy : fecha;
    setError(null);
    setAbierto({ t: 'rapido', ancla: new DOMRect(window.innerWidth / 2 - 230, 120, 0, 0), borrador: borradorEn(f, 10 * 60, 11 * 60) });
  };
  const nuevoEnRango = (r: NuevoRango, ancla: DOMRect) => { setError(null); setAbierto({ t: 'rapido', ancla, borrador: borradorEn(r.fecha, r.ini, r.fin) }); };

  const entradaPropia = (b: BorradorNuevo): EntradaEvento => ({
    titulo: b.titulo.trim() || (b.tipo === 'publicacion' ? 'Publicación' : b.tipo === 'llamada' ? 'Llamada' : 'Bloque de trabajo'),
    tipo: b.tipo === 'evento' ? 'bloque' : b.tipo, formato: b.tipo === 'publicacion' ? b.formato : null,
    fecha: b.fecha, hora: b.hora, duracionMin: b.hora ? duracionEntre(b.hora, b.horaFin) : null,
  });
  const entradaGoogle = (b: BorradorNuevo): EntradaEventoGoogle => ({
    titulo: b.titulo, fecha: b.fecha, hora: b.hora, duracionMin: b.hora ? duracionEntre(b.hora, b.horaFin) ?? 60 : null, fechaFin: null,
  });

  const correr = async (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, deshacer?: () => Promise<unknown>): Promise<boolean> => {
    setGuardando(true); setError(null);
    try {
      const r = await fn();
      if (!r.ok) { setError(r.error ?? 'No se pudo guardar.'); return false; }
      setAbierto(null);
      show(ok, deshacer ? () => { void deshacer().then(() => router.refresh()).catch(() => show('No se pudo deshacer', undefined, 'bad')); } : undefined);
      router.refresh();
      return true;
    } catch {
      setError('Sin conexión. Prueba de nuevo.');
      return false;
    } finally { setGuardando(false); }
  };

  const guardarRapido = (b: BorradorNuevo) => {
    if (b.calendarioId) {
      void correr(() => crearEventoGoogleAction(b.calendarioId!, entradaGoogle(b)), 'Evento guardado');
      return;
    }
    void correr(() => crearEventosAction([entradaPropia(b)], 'user'), 'Agendado');
  };
  const masOpciones = (b: BorradorNuevo) => {
    setError(null);
    if (b.calendarioId) setAbierto({ t: 'google', inicial: { eventoId: null, calendarioId: b.calendarioId, entrada: entradaGoogle(b), invitados: 0 } });
    else setAbierto({ t: 'propio', inicial: { ...entradaPropia(b), titulo: b.titulo.trim() } });
  };

  // ── Lo que ya existe ──
  const editar = (it: ItemCalendario) => {
    setError(null);
    if (it.google) {
      const g = it.google;
      setAbierto({
        t: 'google',
        inicial: {
          eventoId: g.id, calendarioId: g.calendarioId, invitados: g.invitados,
          entrada: {
            titulo: g.titulo === '(Sin título)' ? '' : g.titulo, fecha: g.fecha ?? diaDe(g.inicio, tz), hora: g.diaCompleto ? null : horaDe(g.inicio, tz),
            fechaFin: g.fechaFin, duracionMin: g.fin ? Math.round((Date.parse(g.fin) - Date.parse(g.inicio)) / 60_000) : 60,
            ubicacion: g.ubicacion, descripcion: g.descripcion, colorId: g.colorId,
          },
        },
      });
      return;
    }
    if (it.fuente !== 'propio' || !it.tipo) return;
    setAbierto({
      t: 'propio',
      inicial: {
        id: it.id.replace(/^propio:/, ''), titulo: it.titulo, tipo: it.tipo, formato: it.formato ?? null,
        fecha: diaDe(it.inicio, tz), hora: it.diaCompleto ? null : horaDe(it.inicio, tz),
        duracionMin: it.fin ? Math.round((Date.parse(it.fin) - Date.parse(it.inicio)) / 60_000) : null,
        notas: it.notas ?? '', hecho: it.hecho,
      },
    });
  };

  const borrar = (it: ItemCalendario, avisar = true) => {
    if (it.google) {
      const g = it.google;
      void correr(() => borrarEventoGoogleAction(g.calendarioId, g.id, avisar && g.invitados > 0), 'Evento borrado', () => restaurarEventoGoogleAction(g.calendarioId, g.id));
      return;
    }
    const id = it.id.replace(/^propio:/, '');
    setGuardando(true);
    void borrarEventoAction(id).then((b) => {
      setAbierto(null);
      show('Evento borrado', b ? () => { void restaurarEventoAction(b).then(() => router.refresh()).catch(() => show('No se pudo deshacer', undefined, 'bad')); } : undefined);
      router.refresh();
    }).catch(() => show('No se pudo borrar', undefined, 'bad')).finally(() => setGuardando(false));
  };

  const marcar = (it: ItemCalendario, hecho: boolean) => {
    void marcarEventoAction(it.id.replace(/^propio:/, ''), hecho)
      .then(() => { setAbierto(null); show(hecho ? 'Hecho' : 'Pendiente'); router.refresh(); })
      .catch(() => show('No se pudo guardar', undefined, 'bad'));
  };

  /** Arrastrado o estirado en la grilla: el día y los minutos nuevos. */
  const mover = (it: ItemCalendario, f: string, ini: number, fin: number) => {
    const mov: Movido = { inicio: aInstante(f, ini, tz), fin: aInstante(f, fin, tz) };
    if (it.google) {
      const g = it.google;
      const entrada: EntradaEventoGoogle = { titulo: g.titulo === '(Sin título)' ? '' : g.titulo, fecha: f, hora: hhmm(ini), duracionMin: fin - ini };
      if (g.invitados > 0) { setAbierto({ t: 'avisar', item: it, entrada, mov }); return; }
      moverGoogle(it, entrada, mov, false);
      return;
    }
    if (it.fuente !== 'propio' || !it.tipo) return;
    setMovidos((m) => ({ ...m, [it.id]: mov }));
    const entrada: EntradaEvento = {
      titulo: it.titulo, tipo: it.tipo, formato: it.formato ?? null, fecha: f, hora: hhmm(ini), duracionMin: it.fin ? fin - ini : null, notas: it.notas ?? '',
    };
    void cambiarEventoAction(it.id.replace(/^propio:/, ''), entrada).then((r) => {
      if (!r.ok) { show(r.error, undefined, 'bad'); setMovidos((m) => { const n = { ...m }; delete n[it.id]; return n; }); return; }
      router.refresh();
    }).catch(() => show('No se pudo mover', undefined, 'bad'));
  };
  const moverGoogle = (it: ItemCalendario, entrada: EntradaEventoGoogle, mov: Movido, avisar: boolean) => {
    const g = it.google!;
    setAbierto(null);
    setMovidos((m) => ({ ...m, [it.id]: mov }));
    void cambiarEventoGoogleAction(g.calendarioId, g.id, entrada, avisar).then((r) => {
      if (!r.ok) { show(r.error, undefined, 'bad'); setMovidos((m) => { const n = { ...m }; delete n[it.id]; return n; }); return; }
      router.refresh();
    }).catch(() => show('No se pudo mover', undefined, 'bad'));
  };

  const avisos = lineasDeAviso(fallos, google);
  const titulo = rotuloDeRango(vista, fecha);
  const nombreVista = VISTAS_CALENDARIO.find((v) => v.id === vista)?.nombre ?? 'Semana';

  return (
    <div className="gc" data-calendario="">
      <style>{CSS_GC}</style>
      {toast && <Toast state={toast} onClose={clear} />}

      {/* La barra de arriba */}
      <header className="gc-barra">
        <button type="button" className="gc-ico" aria-label={lado ? 'Ocultar el menú principal' : 'Mostrar el menú principal'} aria-expanded={lado} onClick={() => setLado((x) => !x)}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <span className="gc-logo">
          <span className="gc-logo-dia" aria-hidden>{Number(hoy.slice(8))}</span>
          <span className="gc-logo-txt">Calendario</span>
        </span>
        <button type="button" className="gc-hoy" onClick={() => ir(vista, hoy)}>Hoy</button>
        <button type="button" className="gc-ico" aria-label="Anterior" title="Anterior" onClick={() => ir(vista, moverFecha(vista, fecha, -1))}><Flecha dir="izq" /></button>
        <button type="button" className="gc-ico" aria-label="Siguiente" title="Siguiente" onClick={() => ir(vista, moverFecha(vista, fecha, 1))}><Flecha dir="der" /></button>
        <h1 className="gc-titulo" data-rango="">{titulo}</h1>
        <div className="gc-derecha">
          <button type="button" className="gc-vista-boton" aria-haspopup="menu" aria-expanded={!!menuVista}
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuVista(menuVista ? null : r); }}>
            {nombreVista}<Flecha dir="abajo" tam={18} />
          </button>
        </div>
      </header>
      {menuVista && (
        <MenuFlotante ancla={menuVista} alinear="derecha" onCerrar={() => setMenuVista(null)}>
          {VISTAS_CALENDARIO.map((v) => (
            <button key={v.id} type="button" role="menuitemradio" aria-checked={vista === v.id} onClick={() => { setMenuVista(null); ir(v.id, fecha); }}>
              <span>{v.nombre}</span><kbd>{v.tecla.toUpperCase()}</kbd>
            </button>
          ))}
        </MenuFlotante>
      )}

      <div className="gc-cuerpo">
        <aside className="gc-lado" hidden={!lado} aria-label="Calendarios">
          <button type="button" className="gc-crear" aria-haspopup="menu" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuCrear(menuCrear ? null : r); }}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            Crear
            <Flecha dir="abajo" tam={18} />
          </button>
          <MiniMes key={fecha.slice(0, 7)} mes={fecha} hoy={hoy} elegidos={enVista} onDia={(d) => ir(vista === 'anio' || vista === 'agenda' ? 'dia' : vista, d)} />

          <Grupo titulo="Mis calendarios" plegado={!!plegados.mako} onPlegar={() => setPlegados((p) => ({ ...p, mako: !p.mako }))}>
            {CAPAS_CALENDARIO.map((c) => (
              <CasillaCalendario key={c.id} nombre={NOMBRE_CAPA[c.id as CapaCalendario]} color={COLOR_CAPA[c.id as CapaCalendario]}
                prendido={visibles.has(`mk:${c.id}`)} onCambiar={() => alternar(`mk:${c.id}`)} />
            ))}
          </Grupo>
          {calendarios.length > 0 && (
            <Grupo titulo={google?.cuenta ?? 'Google Calendar'} plegado={!!plegados.google} onPlegar={() => setPlegados((p) => ({ ...p, google: !p.google }))}>
              {calendarios.map((c) => (
                <CasillaCalendario key={c.id} nombre={c.nombre} color={c.color} prendido={visibles.has(`g:${c.id}`)} onCambiar={() => alternar(`g:${c.id}`)} />
              ))}
            </Grupo>
          )}
          {avisos.map((a) => (
            <p key={a.texto} className={`gc-aviso${a.mal ? ' gc-aviso--mal' : ''}`}>
              {a.texto}{a.href && <> <Link href={a.href}>{a.link}</Link></>}
            </p>
          ))}
        </aside>
        {menuCrear && (
          <MenuFlotante ancla={menuCrear} alinear="izquierda" onCerrar={() => setMenuCrear(null)}>
            <button type="button" role="menuitem" onClick={() => { setMenuCrear(null); nuevoDesdeBoton(); }}><span>Evento</span></button>
            <button type="button" role="menuitem" onClick={() => { setMenuCrear(null); setError(null); setAbierto({ t: 'propio', inicial: { titulo: '', tipo: 'publicacion', formato: 'reel', fecha: enVista.has(hoy) ? hoy : fecha, hora: '10:00', duracionMin: null } }); }}><span>Publicación</span></button>
            <button type="button" role="menuitem" onClick={() => { setMenuCrear(null); setError(null); setAbierto({ t: 'propio', inicial: { titulo: '', tipo: 'bloque', fecha: enVista.has(hoy) ? hoy : fecha, hora: '10:00', duracionMin: 120 } }); }}><span>Bloque de trabajo</span></button>
            <button type="button" role="menuitem" onClick={() => { setMenuCrear(null); setError(null); setAbierto({ t: 'propio', inicial: { titulo: '', tipo: 'llamada', fecha: enVista.has(hoy) ? hoy : fecha, hora: '10:00', duracionMin: 30 } }); }}><span>Llamada</span></button>
            <div className="gc-menu-sep" />
            <button type="button" role="menuitem" onClick={() => { setMenuCrear(null); setAbierto({ t: 'plantillas' }); }}><span>Planear la semana con MaKo</span></button>
          </MenuFlotante>
        )}

        <main className="gc-hoja" data-lado={lado ? 'si' : 'no'} aria-label={titulo}>
          {(vista === 'semana' || vista === 'dia' || vista === '4dias') && (
            <VistaTiempo dias={dias} items={aDibujar} hoy={hoy} tz={tz} googleEscribe={googleEscribe}
              onAbrir={(item, ancla) => setAbierto({ t: 'tarjeta', item, ancla })}
              onNuevo={nuevoEnRango} onMover={mover} onIrDia={(d) => ir('dia', d)} />
          )}
          {vista === 'mes' && (
            <VistaMes dias={dias} mes={fecha.slice(0, 7)} items={aDibujar} hoy={hoy} tz={tz}
              onAbrir={(item, ancla) => setAbierto({ t: 'tarjeta', item, ancla })}
              onNuevo={(d, ancla) => nuevoEnRango({ fecha: d, ini: null, fin: null }, ancla)} onIrDia={(d) => ir('dia', d)} />
          )}
          {vista === 'anio' && <VistaAnio anio={Number(fecha.slice(0, 4))} hoy={hoy} onIrDia={(d) => ir('dia', d)} onIrMes={(f) => ir('mes', f)} />}
          {vista === 'agenda' && (
            <VistaAgenda dias={dias} items={aDibujar} hoy={hoy} tz={tz} onAbrir={(item, ancla) => setAbierto({ t: 'tarjeta', item, ancla })} onIrDia={(d) => ir('dia', d)} />
          )}
        </main>
      </div>

      {abierto?.t === 'tarjeta' && (
        <TarjetaEvento item={abierto.item} ancla={abierto.ancla} tz={tz} calendarios={calendarios} googleEscribe={googleEscribe}
          onCerrar={() => setAbierto(null)}
          onEditar={() => editar(abierto.item)}
          onBorrar={() => borrar(abierto.item)}
          onHecho={(h) => marcar(abierto.item, h)} />
      )}
      {abierto?.t === 'rapido' && (
        <RapidoNuevo ancla={abierto.ancla} inicial={abierto.borrador} editables={editables} guardando={guardando} error={error}
          onCerrar={() => setAbierto(null)} onGuardar={guardarRapido} onMas={masOpciones} />
      )}
      {abierto?.t === 'propio' && (
        <EventoModal inicial={abierto.inicial} guardando={guardando} error={error}
          onCerrar={() => setAbierto(null)}
          onGuardar={(e) => {
            const id = abierto.inicial.id;
            void correr(() => (id ? cambiarEventoAction(id, e) : crearEventosAction([e], 'user')), id ? 'Guardado' : 'Agendado');
          }}
          onBorrar={abierto.inicial.id ? () => borrar({ id: `propio:${abierto.inicial.id}`, fuente: 'propio', capa: 'bloques', titulo: '', inicio: '', fin: null, diaCompleto: false, href: null }) : undefined}
          onHecho={abierto.inicial.id ? (h) => marcar({ id: `propio:${abierto.inicial.id}`, fuente: 'propio', capa: 'bloques', titulo: '', inicio: '', fin: null, diaCompleto: false, href: null }, h) : undefined} />
      )}
      {abierto?.t === 'google' && (
        <EventoGoogleModal inicial={abierto.inicial} editables={editables} guardando={guardando} error={error}
          onCerrar={() => setAbierto(null)}
          onGuardar={(e, avisar) => {
            void correr(() => (e.eventoId
              ? cambiarEventoGoogleAction(e.calendarioId, e.eventoId, e.entrada, avisar)
              : crearEventoGoogleAction(e.calendarioId, e.entrada)), e.eventoId ? 'Evento guardado' : 'Evento creado');
          }}
          onBorrar={abierto.inicial.eventoId ? () => {
            const i = abierto.inicial;
            void correr(() => borrarEventoGoogleAction(i.calendarioId, i.eventoId!, i.invitados > 0), 'Evento borrado', () => restaurarEventoGoogleAction(i.calendarioId, i.eventoId!));
          } : undefined} />
      )}
      {abierto?.t === 'avisar' && (
        <Modal titulo="¿Avisar a los invitados?" ancho={440} onCerrar={() => setAbierto(null)}
          pie={<>
            <Button variant="secondary" onClick={() => moverGoogle(abierto.item, abierto.entrada, abierto.mov, false)}>No avisar</Button>
            <Button variant="primary" onClick={() => moverGoogle(abierto.item, abierto.entrada, abierto.mov, true)}>Avisar</Button>
          </>}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>Google les manda el cambio de «{abierto.item.titulo}» por correo.</p>
        </Modal>
      )}
      {abierto?.t === 'plantillas' && (
        <NuevoEnCalendario lunes={lunesDe(enVista.has(hoy) ? hoy : fecha)} guardando={guardando} onCerrar={() => setAbierto(null)}
          onBlanco={() => { setAbierto(null); nuevoDesdeBoton(); }}
          onPlantilla={(p: PlantillaCalendario, entradas) => { void correr(() => crearEventosAction(entradas, 'plantilla'), `${p.nombre}: ${entradas.length} agendados`); }}
          onConfirmarIA={(entradas, aviso) => { void correr(() => crearEventosAction(entradas, 'ia'), aviso ?? (entradas.length === 1 ? '1 agendado' : `${entradas.length} agendados`)); }} />
      )}
    </div>
  );
}

/** Un instante a partir de un día y unos minutos en la zona del negocio (sólo para dibujar lo movido en el acto). */
function aInstante(fecha: string, min: number, tz: string): string {
  // Primera pasada: la hora de pared como si fuera UTC; segunda: corregida por el desvío de la zona ese día.
  const base = Date.parse(`${fecha}T${hhmm(Math.min(min, 24 * 60 - 1))}:00Z`);
  const desvio = (t: number) => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t));
    const v = (k: string) => Number(p.find((x) => x.type === k)?.value);
    return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute')) - t;
  };
  const t1 = base - desvio(base);
  return new Date(base - desvio(t1)).toISOString();
}

function Grupo({ titulo, plegado, onPlegar, children }: { titulo: string; plegado: boolean; onPlegar: () => void; children: React.ReactNode }) {
  return (
    <div className="gc-grupo">
      <button type="button" className="gc-grupo-cab" aria-expanded={!plegado} onClick={onPlegar}>
        <span>{titulo}</span><Flecha dir={plegado ? 'abajo' : 'arriba'} tam={18} />
      </button>
      {!plegado && <div>{children}</div>}
    </div>
  );
}

function CasillaCalendario({ nombre, color, prendido, onCambiar }: { nombre: string; color: string; prendido: boolean; onCambiar: () => void }) {
  return (
    <button type="button" className="gc-cal" role="checkbox" aria-checked={prendido} onClick={onCambiar} title={nombre}>
      <span className="gc-casilla" style={{ borderColor: color, background: prendido ? color : 'transparent' }} aria-hidden>
        {prendido && <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span className="gc-cal-nombre">{nombre}</span>
    </button>
  );
}

function MenuFlotante({ ancla, alinear, onCerrar, children }: { ancla: DOMRect; alinear: 'izquierda' | 'derecha'; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const cerrar = (e: Event) => { if (!(e.target as HTMLElement)?.closest?.('.gc-menu')) onCerrar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onCerrar(); } };
    const t = window.setTimeout(() => document.addEventListener('pointerdown', cerrar, true), 0);
    document.addEventListener('keydown', tecla, true);
    return () => { window.clearTimeout(t); document.removeEventListener('pointerdown', cerrar, true); document.removeEventListener('keydown', tecla, true); };
  }, [onCerrar]);
  const estilo = alinear === 'derecha'
    ? { top: ancla.bottom + 4, right: Math.max(8, window.innerWidth - ancla.right) }
    : { top: ancla.bottom + 4, left: ancla.left };
  return <div className="gc-menu" role="menu" style={estilo}>{children}</div>;
}

/** Lo que la barra lateral dice debajo de los calendarios: lo que no se pudo leer y la cuenta de Google sin conectar. */
function lineasDeAviso(f: FallosCalendario, g: GoogleDelCalendario | null): Array<{ texto: string; mal: boolean; href?: string; link?: string }> {
  const out: Array<{ texto: string; mal: boolean; href?: string; link?: string }> = [];
  if (f.propios) out.push({ texto: 'No pude leer tus eventos.', mal: true });
  if (f.crm) out.push({ texto: 'No pude leer las reuniones del CRM.', mal: true });
  if (f.plan) out.push({ texto: 'No pude leer los deadlines del Plan.', mal: true });
  if (f.objetivos) out.push({ texto: 'No pude leer los Objetivos.', mal: true });
  if (f.google === 'error') out.push({ texto: 'No pude leer tu Google Calendar.', mal: true });
  if (f.google === 'sin-conexion') out.push({ texto: 'Conecta tu Google Calendar para ver sus eventos aquí.', mal: false, href: '/integraciones', link: 'Conectar' });
  if (g?.fallaron.length) out.push({ texto: `No pude leer: ${g.fallaron.join(', ')}.`, mal: true });
  if (g?.recortado) out.push({ texto: 'Hay más eventos de los que entran en esta vista.', mal: false });
  if (g && !g.puedeEscribir) out.push({ texto: 'Tu Google Calendar está conectado sólo para leer.', mal: false, href: '/integraciones', link: 'Reconectar' });
  return out;
}

