'use client';

// =============================================================================
// CalendarioApp — la tab Calendario: una copia fiel de Google Calendar, con lo de MaKo y lo de Google juntos
// =============================================================================
// Martín, 14/10/2026: «el calendario quiero que sea una copia fiel a Google Calendar, y que refleje todas las tareas y
// eventos que se tienen en google calendar». Y el 29/10/2026, A LA MEDIDA DEL NEGOCIO: «que se vea también la sidebar típica
// de MaKo, como siempre… hay muchos botones que son innecesarios… Esa pestaña es principalmente para gestionar publicaciones,
// para recordatorios de deadlines del propio Plan, para reuniones de llamadas de ventas, reuniones de entrega de servicio».
// De Google queda la grilla (y lo que se lee y se escribe en Google); la cáscara es de MaKo. De arriba abajo:
//   · LA BARRA: «Hoy», ‹ ›, el título («octubre de 2026») y, a la derecha, cómo se mira (Día · Semana · Mes · Agenda ·
//     Llamadas, ./Pestanas.tsx).
//   · LOS CUATRO USOS (`USOS_CALENDARIO`, ./comun.ts): Publicaciones, Plan, Ventas y Entregas, cada uno con su color. Tocar el
//     nombre lo muestra o lo esconde (la leyenda ES el filtro) y su «+» lo crea en un clic; el del Plan lleva al Plan, que es
//     donde vive un deadline. Después, Google (si está conectado) y «Otros» (bloques, cobros, objetivos) si hay en la vista.
//   · LA HOJA: la vista. Un clic (o un arrastre) en un hueco crea; un clic en algo abre su tarjeta; lo que se puede
//     mover se arrastra.
// ⚠️ LA BARRA LATERAL DE GOOGLE SE FUE (29/10/2026): el ☰, el logo, «Crear» y su menú, el mes chico y «Mis calendarios» con una
//    casilla por calendario. Era una SEGUNDA barra lateral pegada a la de MaKo (que siempre estuvo: la monta app/layout.tsx), y
//    con la de MaKo plegada era la única que se veía. Qué se fue y por qué: docs/hallazgos-calendario.md.
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
//   · SIN GOOGLE CALENDAR, AL ENTRAR SALTA EL MODAL DE CONECTARLO (14/10/2026, Martín: «si una persona entra allí y no
//     tiene el google calendar conectado, que salte el modal que tenemos en integraciones allí mismo»). Una vez por
//     sesión del navegador y por negocio (sessionStorage): cerrarlo no lo vuelve a abrir al cambiar de semana. Y el
//     «Conectar»/«Reconectar» del aviso abre ESE modal acá, nunca navega a /integraciones; el OAuth vuelve a esta tab
//     (`?gcal=`, `useVueltaDeGoogle`). Reemplaza a «¿Qué vas a crear hoy?», que se fue entero («eliminalo
//     completamente»): la galería ya no se abre sola y el armado de la semana con IA no existe más.
//   · LA ESTRELLA DE MAKO, como en las otras tabs (24/10/2026, llamada con Leandro, f08: «que ahí aparezca el tema del chat
//     de Maco... le tenés que poder decir che Maco, movéme la reunión, agendame tal o tal»). Lo que se escribe va al Cerebro
//     de la persona, que agenda y mueve con las herramientas del CRM y del Calendario de la API de MaKo; con una llamada o
//     una tarea abierta, MaKo sabe de cuál se habla (`entidadDelItem`). Abierta, el calendario le deja su lugar
//     (`--ancho-panel-mako`). La agenda de Google no pasa por la IA: lo de Google no lleva entidad.
//   · «CALENDARIO | LLAMADAS» arriba a la derecha (24/10/2026, f07: «se ve muy como calendario de Google»): «Llamadas» es la
//     lista de citas de venta del CRM y las tareas del Plan con fecha (./ListaLlamadas.tsx, la de HighLevel).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link, { useRouter, useWs } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { useConfirm } from '@/app/_ui/Confirm';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import {
  ROTULO_TIPO, VISTAS_CALENDARIO, diaDe, horaDe, moverFecha, rangoDeVista, rotuloDeRango,
  type EntradaEvento, type ItemCalendario, type TipoEvento, type VistaCalendario,
} from '@/lib/calendario-modelo';
import type { FallosCalendario, GoogleDelCalendario } from '@/lib/calendario';
import type { EntradaEventoGoogle } from '@/lib/calendario-google-modelo';
import {
  crearEventosAction, cambiarEventoAction, marcarEventoAction, borrarEventoAction, restaurarEventoAction,
  listasParaProgramarAction, programarAction, releerPublicacionesAction,
  crearEventoGoogleAction, cambiarEventoGoogleAction, borrarEventoGoogleAction, restaurarEventoGoogleAction,
} from './actions';
import { EventoModal, type EventoEditable } from './EventoModal';
import { AgendarLlamada } from './AgendarLlamada';
import { useConectarIntegracion, useVueltaDeGoogle } from '@/app/_components/ConectarIntegracion';
import { CSS_GC } from './gc-css';
import { USOS_CALENDARIO, entidadDelItem, entradaGoogle, entradaPropia, llaveDe, sinLlamadasRepetidas, usoDeCapa, visiblesPorDefecto, type UsoCalendario } from './comun';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import { AperturaMako, useApertura } from '@/app/_chat/AperturaMako';
import { ancla } from '@/app/_ui/guia/ancla';
import { useGuiaDeLaTab } from '@/app/_ui/guia/useGuiaDeLaTab';
import { useGuiaEnElChat } from '@/app/_ui/guia/store';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { SUPERFICIE_CALENDARIO } from '@/lib/aperturas/calendario';
import { PestanasCalendario, VISTAS_DE_LA_BARRA } from './Pestanas';
import { Flecha } from './Flecha';
import { VistaTiempo, type NuevoRango } from './VistaTiempo';
import { VistaAgenda, VistaMes } from './VistasLista';
import { EventoGoogleModal, RapidoNuevo, TarjetaEvento, type BorradorNuevo, type EdicionGoogle } from './Tarjetas';

type Abierto =
  | { t: 'tarjeta'; item: ItemCalendario; ancla: DOMRect }
  | { t: 'rapido'; ancla: DOMRect; borrador: BorradorNuevo }
  | { t: 'propio'; inicial: EventoEditable }
  | { t: 'google'; inicial: EdicionGoogle }
  | { t: 'agendar' }
  | { t: 'avisar'; item: ItemCalendario; entrada: EntradaEventoGoogle; mov: Movido }
  | null;

/** Dónde quedó algo que se acaba de mover, mientras viaja al server. */
type Movido = { inicio: string; fin: string | null };

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const llavePreferencia = (ws: number | null) => `calendario.visibles.${ws ?? 'propio'}`;

export function CalendarioApp({ vista, fecha, hoy, tz, dias, items, fallos, google, eventoInicial = null, inicio = null }: {
  vista: VistaCalendario;
  fecha: string;
  hoy: string;
  tz: string;
  dias: string[];
  items: ItemCalendario[];
  fallos: FallosCalendario;
  google: GoogleDelCalendario | null;
  /** `?evento=<id>`: lo que se acaba de mandar desde un editor de Create (lib/calendario-desde-crear.ts). Se abre una vez. */
  eventoInicial?: string | null;
  /** El onboarding de la tab (5/11/2026, lo que MaKo pregunta primero y la guía): si la primera semana sigue sin estrenar y si
   *  el onboarding está pendiente. null = no se pudo leer: MaKo calla y la guía espera. */
  inicio?: { semanaPendiente: boolean; onboardingPendiente: boolean } | null;
}) {
  const router = useRouter();
  const ws = useWs();
  const calendarios = useMemo(() => google?.calendarios ?? [], [google]);
  const googleEscribe = !!google?.puedeEscribir;
  const editables = useMemo(() => (googleEscribe ? calendarios.filter((c) => c.editable) : []), [calendarios, googleEscribe]);
  const porDefecto = useMemo(() => visiblesPorDefecto(calendarios), [calendarios]);
  const [elegidas, setElegidas] = useState<Record<string, boolean>>({});
  const visibles = useMemo(() => {
    const s = new Set(porDefecto);
    for (const [k, v] of Object.entries(elegidas)) { if (v) s.add(k); else s.delete(k); }
    return s;
  }, [porDefecto, elegidas]);
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movidos, setMovidos] = useState<Record<string, Movido>>({});
  const { toast, show, clear } = useToast(6000);
  const { confirm, confirmNode } = useConfirm();

  // Lo programado en la red cuya hora ya pasó: se relee en Zernio al abrir (sin cron). Si algo cambió, se vuelve a leer.
  useEffect(() => { void releerPublicacionesAction().then((n) => { if (n > 0) router.refresh(); }).catch(() => { /* se relee la próxima vez */ }); }, [router]);

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
  /**
   * Prender o apagar VARIAS llaves juntas: un uso son una o dos capas (el Plan: sus deadlines y lo que se repite) y Google son
   * todos sus calendarios. Si alguna se ve, se apagan todas; si no, se prenden todas. Se guarda en la misma preferencia de
   * siempre (una llave por capa o por calendario): lo que alguien eligió antes del 29/10 se sigue respetando.
   */
  const alternar = (llaves: readonly string[]) => {
    if (!llaves.length) return;
    const prender = !llaves.some((k) => visibles.has(k));
    setElegidas((e) => {
      const n = { ...e };
      for (const k of llaves) n[k] = prender;
      try { window.localStorage.setItem(llavePreferencia(ws), JSON.stringify(n)); } catch { /* preferencia: no pasa nada */ }
      return n;
    });
  };

  // Conectar una integración SIN salir de la tab (AGENTS.md): el modal de /integraciones, montado acá. Al conectarse,
  // se vuelve a leer la pantalla (los calendarios de Google, el link de agenda).
  const integracion = useConectarIntegracion({ onConectado: () => router.refresh() });
  const abrirIntegracion = integracion.abrir;
  const googleOk = useCallback(() => { show('Google Calendar conectado'); router.refresh(); }, [show, router]);
  const vueltaGoogle = useVueltaDeGoogle(abrirIntegracion, googleOk);

  // Sin Google Calendar, al ENTRAR salta el modal de conectarlo: una vez por sesión del navegador y por negocio, y se
  // cierra. Si el OAuth acaba de volver (`?gcal=`), lo abre `useVueltaDeGoogle` con lo que pasó.
  const sinGoogle = fallos.google === 'sin-conexion';
  useEffect(() => {
    if (!sinGoogle || vueltaGoogle) return;
    const llave = `calendario.conectarGoogle.${ws ?? 'propio'}`;
    try { if (window.sessionStorage.getItem(llave)) return; window.sessionStorage.setItem(llave, '1'); } catch { /* sin almacenamiento: igual se ofrece */ }
    abrirIntegracion('google');
  }, [sinGoogle, vueltaGoogle, ws, abrirIntegracion]);

  const ir = useCallback((v: VistaCalendario, f: string) => { setAbierto(null); router.push(`/calendario?vista=${v}&fecha=${f}`); }, [router]);

  // Los atajos de Google: t (hoy), j/n (siguiente), k/p (anterior) y la tecla de cada vista que se ofrece (Año y 4 días se
  // fueron el 29/10/2026, y la «c» con el «Crear» de Google: ahora se crea desde cada uso).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || abierto || integracion.abierto) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const k = e.key.toLowerCase();
      const v = VISTAS_CALENDARIO.find((x) => x.tecla === k && VISTAS_DE_LA_BARRA.some((b) => b.id === x.id));
      if (v) { ir(v.id, fecha); return; }
      if (k === 't') ir(vista, hoy);
      else if (k === 'j' || k === 'n') ir(vista, moverFecha(vista, fecha, 1));
      else if (k === 'k' || k === 'p') ir(vista, moverFecha(vista, fecha, -1));
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
    return sinLlamadasRepetidas(prendidos);
  }, [items, visibles, movidos]);
  const enVista = useMemo(() => new Set(rangoDeVista(vista, fecha).dias), [vista, fecha]);
  /** El día en que nace lo que se crea desde un uso: hoy si se está mirando, si no el primero de la vista. */
  const diaParaCrear = enVista.has(hoy) ? hoy : fecha;

  // ── Los cuatro usos (29/10/2026) ──
  /** Las llaves de cada uso: las de sus capas de MaKo. «Otros» sólo se ofrece si en la vista hay algo suyo. */
  const llavesDe = (u: UsoCalendario): string[] => USOS_CALENDARIO.find((x) => x.id === u)!.capas.map((c) => `mk:${c}`);
  const hayOtros = useMemo(() => items.some((it) => !it.google && usoDeCapa(it.capa) === 'otros'), [items]);
  const llavesGoogle = useMemo(() => calendarios.map((c) => `g:${c.id}`), [calendarios]);
  /** Crear uno de un uso, en un clic: la Publicación y la Entrega abren su modal; una llamada de venta, la agenda del negocio. */
  const crear = (t: TipoEvento) => {
    setError(null);
    if (t === 'llamada') { setAbierto({ t: 'agendar' }); return; }
    setAbierto({ t: 'propio', inicial: t === 'publicacion'
      ? { titulo: '', tipo: 'publicacion', formato: 'reel', fecha: diaParaCrear, hora: '10:00', duracionMin: null }
      : { titulo: '', tipo: t, fecha: diaParaCrear, hora: '10:00', duracionMin: t === 'entrega' ? 60 : 30 } });
  };
  /** Hay publicaciones por salir en la vista: se ofrece programarlas de una vez (Zernio). */
  const hayPublicaciones = aDibujar.some((it) => it.fuente === 'propio' && it.tipo === 'publicacion' && !it.hecho);

  // ── Programar en serie (28/10/2026): las publicaciones de la vista que ya tienen cuenta y archivo, de una vez ──
  const programarListas = async () => {
    const ds = [...enVista].sort();
    const r0 = await listasParaProgramarAction(ds[0] ?? hoy, ds[ds.length - 1] ?? hoy).catch(() => ({ error: 'No pude leer las publicaciones.' }));
    if (!Array.isArray(r0)) { show(r0.error, undefined, 'bad'); return; }
    if (!r0.length) { show('No hay publicaciones listas en esta vista: a cada una le falta la cuenta o el archivo.', undefined, 'bad'); return; }
    const cuantas = r0.length === 1 ? 'una publicación' : `${r0.length} publicaciones`;
    if (!(await confirm(`Se programa${r0.length === 1 ? '' : 'n'} ${cuantas} de esta vista: sale${r0.length === 1 ? '' : 'n'} sola${r0.length === 1 ? '' : 's'} a su hora y la${r0.length === 1 ? '' : 's'} ven los seguidores de cada cuenta.`, { title: 'Programar en serie', confirmLabel: 'Programar', danger: false }))) return;
    setGuardando(true);
    const r = await programarAction(r0).catch(() => ({ error: 'No se pudo programar.' }));
    setGuardando(false);
    if ('error' in r) { show(r.error, undefined, 'bad'); return; }
    show(r.fallidas.length ? `Programadas: ${r.programadas.length}. No salieron ${r.fallidas.length}: «${r.fallidas[0].titulo}» (${r.fallidas[0].motivo})` : `Programadas: ${r.programadas.length}`, undefined, r.fallidas.length ? 'bad' : undefined);
    router.refresh();
  };

  // ── Crear ──
  // Un hueco de la grilla crea un evento de Google si hay dónde escribirlo; si no, una Publicación (el «Evento» no se ofrece).
  const borradorEn = (f: string, ini: number | null, fin: number | null): BorradorNuevo => ({
    tipo: editables.length ? 'evento' : 'publicacion', titulo: '', fecha: f, hora: ini == null ? null : hhmm(ini), horaFin: fin == null ? null : hhmm(Math.min(fin, 24 * 60 - 1)),
    formato: 'reel', calendarioId: editables.find((c) => c.primario)?.id ?? editables[0]?.id ?? null,
  });
  const nuevoEnRango = (r: NuevoRango, ancla: DOMRect) => { setError(null); setAbierto({ t: 'rapido', ancla, borrador: borradorEn(r.fecha, r.ini, r.fin) }); };

  // `entradaPropia` y `entradaGoogle` (el borrador como evento de MaKo o de Google) viven en ./comun: el teléfono
  // crea con las mismas.

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

  // «Publicar» desde Create (29/10/2026): llega con `?evento=` y se abre su modal (la red, el día y la hora se eligen ahí). Una
  // sola vez: el parámetro se saca de la URL, para que un F5 o «atrás» no lo vuelvan a abrir.
  const abiertoDesdeLaUrl = useRef(false);
  useEffect(() => {
    if (!eventoInicial || abiertoDesdeLaUrl.current) return;
    const it = items.find((x) => x.id === `propio:${eventoInicial}`);
    if (!it) return;
    abiertoDesdeLaUrl.current = true;
    editar(it);
    router.replace(`/calendario?vista=${vista}&fecha=${fecha}`, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `editar` se arma en cada render; lo que decide es el evento y la lista
  }, [eventoInicial, items]);

  const borrar = (it: ItemCalendario, avisar = true) => {
    if (it.google) {
      const g = it.google;
      void correr(() => borrarEventoGoogleAction(g.calendarioId, g.id, avisar && g.invitados > 0), 'Evento borrado', () => restaurarEventoGoogleAction(g.calendarioId, g.id));
      return;
    }
    const id = it.id.replace(/^propio:/, '');
    setGuardando(true);
    void borrarEventoAction(id).then((b) => {
      // Uno programado en la red no se borra: el motivo llega a la persona (antes, «No se pudo borrar» y nada más).
      if (b && 'error' in b) { show(b.error, undefined, 'bad'); return; }
      setAbierto(null);
      show('Evento borrado', b ? () => { void restaurarEventoAction(b).then(() => router.refresh()).catch(() => show('No se pudo deshacer', undefined, 'bad')); } : undefined);
      router.refresh();
    }).catch(() => show('No se pudo borrar', undefined, 'bad')).finally(() => setGuardando(false));
  };

  const marcar = (it: ItemCalendario, hecho: boolean) => {
    void marcarEventoAction(it.id.replace(/^propio:/, ''), hecho)
      .then((r) => {
        if (r && typeof r === 'object') { show(r.error, undefined, 'bad'); return; }
        setAbierto(null); show(hecho ? 'Hecho' : 'Pendiente'); router.refresh();
      })
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

  // MAKO TOMA LA INICIATIVA (5/11/2026, docs/mako-iniciativa/plan.md T9): con Google conectado y la semana sin estrenar,
  // «¿Tienes alguna llamada esta semana?» (lib/aperturas/calendario.ts); «Sí, tengo una» abre el alta de una llamada. Y LA GUÍA de
  // la pestaña (./guia-calendario.ts), que espera al onboarding de la tab (el modal de Google). Las dos callan con algo abierto.
  useGuiaDeLaTab('calendario', { listo: true, onboardingPendiente: inicio == null || inicio.onboardingPendiente });
  const guiaChat = useGuiaEnElChat();
  const estadoApertura = useApertura({
    superficie: SUPERFICIE_CALENDARIO,
    hechos: inicio ? { google: google != null, semanaPendiente: inicio.semanaPendiente } : null,
    libre: abierto == null && !integracion.abierto && !guiaChat.pregunta && !guiaChat.senalando && !guiaChat.esperando,
  });
  const aperturaTab = estadoApertura.apertura
    ? <AperturaMako estado={estadoApertura} quien={{ nombre: 'MaKo', aspecto: ASPECTO_MAKO }} acciones={{ agendar: () => crear('llamada') }} />
    : null;

  const avisos = lineasDeAviso(fallos, google);
  const titulo = rotuloDeRango(vista, fecha);
  const prendidoGoogle = llavesGoogle.some((k) => visibles.has(k));
  const colorGoogle = calendarios.find((c) => c.primario)?.color ?? calendarios[0]?.color ?? 'var(--faint)';

  return (
    <div className="gc" data-calendario="" style={{ paddingLeft: 'var(--ancho-panel-mako, 0px)' }}>
      <style>{CSS_GC}</style>
      <MakoEnLaTab tab="Calendario" apertura={aperturaTab} entidad={entidadDelItem(abierto?.t === 'tarjeta' ? abierto.item : null)} />
      {toast && <Toast state={toast} onClose={clear} />}
      {confirmNode}

      {/* La barra de arriba */}
      <header className="gc-barra">
        <button type="button" className="gc-hoy" {...ancla('calendario-hoy')} onClick={() => ir(vista, hoy)}>Hoy</button>
        <button type="button" className="gc-ico" aria-label="Anterior" title="Anterior" onClick={() => ir(vista, moverFecha(vista, fecha, -1))}><Flecha dir="izq" /></button>
        <button type="button" className="gc-ico" aria-label="Siguiente" title="Siguiente" onClick={() => ir(vista, moverFecha(vista, fecha, 1))}><Flecha dir="der" /></button>
        <h1 className="gc-titulo" data-rango="">{titulo}</h1>
        <div className="gc-derecha" {...ancla('calendario-vistas')}>
          <PestanasCalendario activa={vista} fecha={fecha} />
        </div>
      </header>

      {/* LOS CUATRO USOS: la leyenda es el filtro (el nombre) y el alta (el «+»). Google y «Otros», al final y sin «+». */}
      <div className="gc-usos" role="group" aria-label="Qué ver" {...ancla('calendario-usos')}>
        {USOS_CALENDARIO.filter((u) => u.id !== 'otros' || hayOtros).map((u) => {
          const llaves = llavesDe(u.id);
          const prendido = llaves.some((k) => visibles.has(k));
          return (
            <span key={u.id} className="gc-uso" data-uso={u.id}>
              <button type="button" className="gc-uso-ver" aria-pressed={prendido} onClick={() => alternar(llaves)} title={prendido ? `Esconder ${u.nombre}` : `Mostrar ${u.nombre}`}>
                <span className="gc-uso-punto" aria-hidden style={{ borderColor: u.color, background: prendido ? u.color : 'transparent' }} />{u.nombre}
              </button>
              {u.crea && (
                <button type="button" className="gc-uso-mas" aria-label={`Nueva ${ROTULO_TIPO[u.crea].toLowerCase()}`} title={`Nueva ${ROTULO_TIPO[u.crea].toLowerCase()}`} onClick={() => crear(u.crea!)}
                  {...(u.crea === 'llamada' ? ancla('calendario-llamada') : {})}>+</button>
              )}
              {u.id === 'plan' && (
                <Link href="/plan" className="gc-uso-mas" aria-label="Crear un deadline en el Plan" title="Un deadline es una tarea del Plan: se crea ahí">+</Link>
              )}
            </span>
          );
        })}
        {calendarios.length > 0 && (
          <span className="gc-uso" data-uso="google">
            <button type="button" className="gc-uso-ver" aria-pressed={prendidoGoogle} onClick={() => alternar(llavesGoogle)} title={google?.cuenta ?? 'Google Calendar'}>
              <span className="gc-uso-punto" aria-hidden style={{ borderColor: colorGoogle, background: prendidoGoogle ? colorGoogle : 'transparent' }} />Google
            </button>
          </span>
        )}
        {hayPublicaciones && (
          <button type="button" className="gc-boton-texto gc-usos-accion" disabled={guardando} onClick={() => { void programarListas(); }}>Programar publicaciones</button>
        )}
      </div>
      {avisos.length > 0 && (
        <div className="gc-avisos">
          {avisos.map((a) => (
            <p key={a.texto} className={`gc-aviso${a.mal ? ' gc-aviso--mal' : ''}`}>
              {a.texto}{a.servicio && <> <button type="button" className="gc-aviso-boton" onClick={() => abrirIntegracion(a.servicio!)}>{a.link}</button></>}
            </p>
          ))}
        </div>
      )}

      <div className="gc-cuerpo">
        <main className="gc-hoja" aria-label={titulo}>
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
          onHecho={abierto.inicial.id ? (h) => marcar({ id: `propio:${abierto.inicial.id}`, fuente: 'propio', capa: 'bloques', titulo: '', inicio: '', fin: null, diaCompleto: false, href: null }, h) : undefined}
          onCambioPublicacion={() => router.refresh()} />
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
      {abierto?.t === 'agendar' && (
        <AgendarLlamada onCerrar={() => setAbierto(null)} onCopiado={() => show('Link copiado')}
          onConectar={(s) => { setAbierto(null); abrirIntegracion(s); }}
          // Sin pasar por Calendly ni Cal.com: la llamada de venta, anotada en el Calendario.
          onAnotar={() => setAbierto({ t: 'propio', inicial: { titulo: '', tipo: 'llamada', fecha: diaParaCrear, hora: '10:00', duracionMin: 30 } })}
          // La reserva entra al CRM por el webhook, que tarda unos segundos: se vuelve a leer después.
          onAgendada={() => { show('Llamada agendada'); window.setTimeout(() => router.refresh(), 5000); }} />
      )}
      {integracion.modal}
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

/**
 * Lo que se dice debajo de los usos (hasta el 29/10/2026, en la barra lateral de Google): lo que no se pudo leer y la cuenta de
 * Google sin conectar.
 * ⚠️ «Conectar» y «Reconectar» abren el modal de Google AHÍ (`servicio`), nunca un link a /integraciones (AGENTS.md:
 * para una integración no se sale de la tab).
 */
function lineasDeAviso(f: FallosCalendario, g: GoogleDelCalendario | null): Array<{ texto: string; mal: boolean; servicio?: string; link?: string }> {
  const out: Array<{ texto: string; mal: boolean; servicio?: string; link?: string }> = [];
  if (f.propios) out.push({ texto: 'No pude leer tus eventos.', mal: true });
  if (f.crm) out.push({ texto: 'No pude leer las reuniones del CRM.', mal: true });
  if (f.plan) out.push({ texto: 'No pude leer los deadlines del Plan.', mal: true });
  if (f.recurrentes) out.push({ texto: 'No pude leer lo que se repite.', mal: true });
  if (f.cobros) out.push({ texto: 'No pude leer los cobros.', mal: true });
  if (f.newsletters) out.push({ texto: 'No pude leer las ediciones del newsletter.', mal: true });
  if (f.objetivos) out.push({ texto: 'No pude leer los Objetivos.', mal: true });
  if (f.google === 'error') out.push({ texto: 'No pude leer tu Google Calendar.', mal: true });
  if (f.google === 'sin-conexion') out.push({ texto: 'Conecta tu Google Calendar para ver sus eventos aquí.', mal: false, servicio: 'google', link: 'Conectar' });
  if (g?.fallaron.length) out.push({ texto: `No pude leer: ${g.fallaron.join(', ')}.`, mal: true });
  if (g?.recortado) out.push({ texto: 'Hay más eventos de los que entran en esta vista.', mal: false });
  if (g && !g.puedeEscribir) out.push({ texto: 'Tu Google Calendar está conectado sólo para leer.', mal: false, servicio: 'google', link: 'Reconectar' });
  return out;
}

