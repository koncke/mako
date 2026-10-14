'use client';

// =============================================================================
// Tarjetas — lo que se abre encima del Calendario, como en Google Calendar
// =============================================================================
//   · TarjetaEvento: la tarjeta de un evento (clic en él): arriba los íconos (editar, borrar, abrir en Google, cerrar);
//     el cuadrito del color, el título grande, la fecha, la videollamada, el lugar, la descripción y el calendario.
//   · RapidoNuevo: «crear» en el lugar (clic o arrastre en un hueco): el título, el tipo (Evento, Publicación, Bloque
//     de trabajo, Llamada), la fecha y la hora, el calendario, «Más opciones» y «Guardar».
//   · EventoGoogleModal: el «Más opciones» de un evento de Google (crearlo o cambiarlo entero).
//
// ⚠️ LAS DOS FLOTANTES SON CAPAS: se registran en la pila de modales (`useCapaModal`, anidadas) y el Escape las cierra
//    con `stopImmediatePropagation`, para no cerrar también lo de abajo (AGENTS.md, «un popover anclado también es una
//    capa»). Van por portal al body y se ubican por cuenta: a la derecha del ancla si entra, si no a la izquierda.
// ⚠️ La descripción de un evento de Google se muestra como TEXTO (pre-wrap), nunca como HTML: viene de afuera.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from '@/app/_ui/Link';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { BotonBorrar, IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useCapaModal } from '@/app/_components/pila-modales';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import {
  FORMATOS_PUBLICACION, ROTULO_FORMATO, ROTULO_TIPO, diaDe, fechaLarga, horaDe, sumarDias,
  type FormatoPublicacion, type ItemCalendario, type TipoEvento,
} from '@/lib/calendario-modelo';
import { COLORES_EVENTO_GOOGLE, TOPE_TITULO_GOOGLE, type CalendarioGoogle, type EntradaEventoGoogle } from '@/lib/calendario-google-modelo';
import { COLOR_CAPA, NOMBRE_CAPA, colorDe } from './comun';
import { rangoGoogle } from './VistaTiempo';

// ── Íconos de la tarjeta (los de Google: lápiz, abrir, cerrar, reloj, lugar, texto, calendario, personas, video) ──
function Svg({ d, tam = 20 }: { d: string; tam?: number }) {
  return <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}
const D = {
  lapiz: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  abrir: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  cerrar: 'M6 6l12 12M18 6L6 18',
  reloj: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  lugar: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  texto: 'M4 6h16M4 12h16M4 18h10',
  calendario: 'M4 7h16v13H4zM4 11h16M8 3v4M16 3v4',
  personas: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6',
  video: 'M3 7h12v10H3zM15 10l6-3v10l-6-3',
  check: 'M5 12l5 5L20 7',
  repetir: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
};

/** Ubica una flotante junto a su ancla, sin salirse de la ventana. */
function usePosicion(ancla: DOMRect, ancho: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({ left: -9999, top: 0, opacity: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const alto = el.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = ancla.right + 8;
    if (left + ancho > vw - 12) left = ancla.left - ancho - 8;
    if (left < 12) left = Math.max(12, Math.min(vw - ancho - 12, ancla.left));
    let top = ancla.top;
    if (top + alto > vh - 12) top = Math.max(12, vh - alto - 12);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos({ left, top, opacity: 1 });
  }, [ancla, ancho]);
  return { ref, pos };
}

/** Escape y clic afuera cierran; el Escape no le llega a lo de abajo. */
function useFlotante(onCerrar: () => void, ref: React.RefObject<HTMLDivElement | null>) {
  const capa = useCapaModal(true, { anidada: true });
  const cerrarRef = useRef(onCerrar);
  useLayoutEffect(() => { cerrarRef.current = onCerrar; });
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !capa.esElDeArriba()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cerrarRef.current();
    };
    const afuera = (e: PointerEvent) => {
      if (!capa.esElDeArriba()) return;
      if (ref.current && !ref.current.contains(e.target as Node)) cerrarRef.current();
    };
    document.addEventListener('keydown', tecla, true);
    // Al pointerdown del próximo tick: el clic que la abrió no la cierra.
    const t = window.setTimeout(() => document.addEventListener('pointerdown', afuera, true), 0);
    return () => { document.removeEventListener('keydown', tecla, true); window.clearTimeout(t); document.removeEventListener('pointerdown', afuera, true); };
  }, [capa, ref]);
  return capa;
}

function Fila({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return <div className="gc-tarjeta-fila"><span>{icono}</span><div>{children}</div></div>;
}

/** La línea de la fecha de un renglón: «miércoles, 14 de octubre · 10 – 11 a.m.». */
export function lineaDeFecha(it: ItemCalendario, tz: string): string {
  if (it.google?.diaCompleto && it.google.fecha) {
    const ini = fechaLarga(it.google.fecha);
    return it.google.fechaFin && it.google.fechaFin !== it.google.fecha ? `${ini} – ${fechaLarga(it.google.fechaFin)}` : ini;
  }
  const dia = fechaLarga(diaDe(it.inicio, tz));
  if (it.diaCompleto) return dia;
  const fin = it.fin ? horaDe(it.fin, tz) : null;
  const finDia = it.fin ? diaDe(it.fin, tz) : null;
  if (finDia && finDia !== diaDe(it.inicio, tz)) return `${dia}, ${rangoGoogle(horaDe(it.inicio, tz), null)} – ${fechaLarga(finDia)}, ${rangoGoogle(fin!, null)}`;
  return `${dia} · ${rangoGoogle(horaDe(it.inicio, tz), fin)}`;
}

export function TarjetaEvento({ item, ancla, tz, calendarios, googleEscribe, onCerrar, onEditar, onBorrar, onHecho }: {
  item: ItemCalendario;
  ancla: DOMRect;
  tz: string;
  calendarios: readonly CalendarioGoogle[];
  googleEscribe: boolean;
  onCerrar: () => void;
  /** Abre «Más opciones» (lo propio o lo de Google que se puede editar). */
  onEditar?: () => void;
  onBorrar?: () => void;
  onHecho?: (hecho: boolean) => void;
}) {
  const { ref, pos } = usePosicion(ancla, 448);
  useFlotante(onCerrar, ref);
  const g = item.google;
  const cal = g ? calendarios.find((c) => c.id === g.calendarioId) : null;
  const editable = item.fuente === 'propio' || (!!g?.editable && googleEscribe);
  const lugar = g?.ubicacion || null;
  const nombreCalendario = cal?.nombre ?? NOMBRE_CAPA[item.capa];
  const ir = item.href && !g ? item.href : null;
  const rotuloIr = item.fuente === 'crm' ? 'Abrir la ficha' : item.fuente === 'plan' ? 'Abrir en el Plan' : item.fuente === 'objetivo' ? 'Ver en General' : 'Abrir';

  return createPortal(
    <div ref={ref} className="gc gc-tarjeta" style={{ ...pos, height: 'auto' }} role="dialog" aria-label={item.titulo}>
      <div className="gc-tarjeta-iconos">
        {editable && onEditar && <button type="button" className="gc-ico" aria-label="Editar evento" title="Editar evento" onClick={onEditar}><Svg d={D.lapiz} /></button>}
        {editable && onBorrar && (
          <button type="button" className="gc-ico" aria-label="Borrar evento" title="Borrar evento" onClick={onBorrar} style={{ color: 'var(--bad)' }}><IconoBorrar size={18} /></button>
        )}
        {item.fuente === 'propio' && onHecho && (
          <button type="button" className="gc-ico" aria-label={item.hecho ? 'Marcar como pendiente' : 'Marcar como hecho'} title={item.hecho ? 'Marcar como pendiente' : 'Marcar como hecho'}
            aria-pressed={!!item.hecho} onClick={() => onHecho(!item.hecho)} style={item.hecho ? { color: 'var(--good)' } : undefined}><Svg d={D.check} /></button>
        )}
        {g?.enlace && <a className="gc-ico" href={g.enlace} target="_blank" rel="noopener noreferrer" aria-label="Abrir en Google Calendar" title="Abrir en Google Calendar"><Svg d={D.abrir} /></a>}
        <button type="button" className="gc-ico" aria-label="Cerrar" title="Cerrar" onClick={onCerrar}><Svg d={D.cerrar} /></button>
      </div>
      <Fila icono={<span className="gc-cuadro" style={{ background: colorDe(item) }} />}>
        <h2 className="gc-tarjeta-titulo" style={item.hecho || g?.rechazado ? { textDecoration: 'line-through' } : undefined}>{item.titulo}</h2>
        <div className="gc-tarjeta-sub">{lineaDeFecha(item, tz)}</div>
        {g?.recurrente && <div className="gc-tarjeta-sub" style={{ color: 'var(--gc-gris)' }}>Se repite</div>}
      </Fila>
      {g?.videollamada && (
        <Fila icono={<Svg d={D.video} />}>
          <a className="gc-boton-azul" href={g.videollamada} target="_blank" rel="noopener noreferrer">
            {/meet\.google\.com/.test(g.videollamada) ? 'Unirse con Google Meet' : 'Unirse a la videollamada'}
          </a>
        </Fila>
      )}
      {lugar && <Fila icono={<Svg d={D.lugar} />}>{lugar}</Fila>}
      {item.fuente === 'propio' && item.tipo && (
        <Fila icono={<Svg d={D.reloj} />}>{ROTULO_TIPO[item.tipo]}{item.tipo === 'publicacion' && item.formato ? ` · ${ROTULO_FORMATO[item.formato]}` : ''}</Fila>
      )}
      {item.detalle && !g && item.fuente !== 'propio' && <Fila icono={<Svg d={D.texto} />}>{item.detalle}</Fila>}
      {g && g.invitados > 0 && <Fila icono={<Svg d={D.personas} />}>{g.invitados === 1 ? '1 invitado' : `${g.invitados} invitados`}{g.organizador ? ` · organiza ${g.organizador}` : ''}</Fila>}
      {(g?.descripcion || item.notas) && <Fila icono={<Svg d={D.texto} />}><div className="gc-desc">{g?.descripcion || item.notas}</div></Fila>}
      <Fila icono={<Svg d={D.calendario} />}>{nombreCalendario}</Fila>
      {ir && (
        <div className="gc-pie" style={{ justifyContent: 'flex-start', paddingLeft: 64 }}>
          <Link href={ir} className="gc-boton-texto">{rotuloIr}</Link>
        </div>
      )}
    </div>,
    document.body,
  );
}

// ── Crear en el lugar ──────────────────────────────────────────────────────────────────────────────────────────────

/** Qué se crea: un evento (de Google si hay dónde, si no de MaKo) o uno de MaKo de un tipo. */
export type TipoRapido = 'evento' | TipoEvento;
export const TIPOS_RAPIDO: ReadonlyArray<{ id: TipoRapido; nombre: string }> = [
  { id: 'evento', nombre: 'Evento' },
  { id: 'publicacion', nombre: 'Publicación' },
  { id: 'bloque', nombre: 'Bloque de trabajo' },
  { id: 'llamada', nombre: 'Llamada' },
];

/** Lo que se armó en «crear»: con eso se guarda o se abre «Más opciones». */
export type BorradorNuevo = {
  tipo: TipoRapido;
  titulo: string;
  fecha: string;
  /** 'HH:MM' o null = todo el día. */
  hora: string | null;
  horaFin: string | null;
  formato: FormatoPublicacion;
  /** El calendario de Google, si el evento va a Google; null = MaKo. */
  calendarioId: string | null;
};

const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
/** Cuánto dura entre dos horas del mismo día (o hasta la medianoche si el fin es anterior). */
export const duracionEntre = (ini: string, fin: string | null): number | null => {
  if (!fin) return null;
  const d = minutos(fin) - minutos(ini);
  return d > 0 ? d : 24 * 60 - minutos(ini);
};

export function RapidoNuevo({ ancla, inicial, editables, guardando, error, onCerrar, onGuardar, onMas }: {
  ancla: DOMRect;
  inicial: BorradorNuevo;
  /** Los calendarios de Google donde se puede crear (vacío = no hay Google para escribir). */
  editables: readonly CalendarioGoogle[];
  guardando: boolean;
  error: string | null;
  onCerrar: () => void;
  onGuardar: (b: BorradorNuevo) => void;
  onMas: (b: BorradorNuevo) => void;
}) {
  const [b, setB] = useState<BorradorNuevo>(inicial);
  const { ref, pos } = usePosicion(ancla, 460);
  useFlotante(() => { if (!guardando) onCerrar(); }, ref);
  const tituloRef = useRef<HTMLInputElement>(null);
  useEffect(() => { tituloRef.current?.focus(); }, []);
  const poner = (p: Partial<BorradorNuevo>) => setB((x) => ({ ...x, ...p }));
  const aGoogle = b.tipo === 'evento' && editables.length > 0;
  const color = aGoogle ? (editables.find((c) => c.id === b.calendarioId)?.color ?? editables[0].color)
    : COLOR_CAPA[b.tipo === 'publicacion' ? 'publicaciones' : b.tipo === 'llamada' ? 'llamadas' : 'bloques'];
  const enviar = () => { if (!guardando) onGuardar({ ...b, calendarioId: aGoogle ? (b.calendarioId ?? editables[0].id) : null }); };

  return createPortal(
    <div ref={ref} className="gc gc-rapido" style={{ ...pos, height: 'auto' }} role="dialog" aria-label="Crear">
      <div className="gc-tarjeta-iconos">
        <button type="button" className="gc-ico" aria-label="Cerrar" onClick={onCerrar}><Svg d={D.cerrar} /></button>
      </div>
      <div style={{ padding: '0 16px 0 64px' }}>
        <input ref={tituloRef} className="gc-rapido-titulo" placeholder="Agregar título" value={b.titulo} maxLength={TOPE_TITULO_GOOGLE}
          onChange={(e) => poner({ titulo: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') enviar(); }} />
        <div className="gc-pestanas" role="group" aria-label="Qué es">
          {TIPOS_RAPIDO.map((t) => (
            <button key={t.id} type="button" className="gc-pestana" aria-pressed={b.tipo === t.id} onClick={() => poner({ tipo: t.id })}>{t.nombre}</button>
          ))}
        </div>
      </div>
      <Fila icono={<Svg d={D.reloj} />}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <input type="date" className="gc-campo" value={b.fecha} onChange={(e) => e.target.value && poner({ fecha: e.target.value })} aria-label="Fecha" />
          {b.hora != null && (
            <>
              <input type="time" className="gc-campo" value={b.hora} step={900} onChange={(e) => e.target.value && poner({ hora: e.target.value })} aria-label="Empieza" />
              {b.tipo !== 'publicacion' && <>–<input type="time" className="gc-campo" value={b.horaFin ?? ''} step={900} onChange={(e) => poner({ horaFin: e.target.value || null })} aria-label="Termina" /></>}
            </>
          )}
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={b.hora == null} onChange={(e) => poner(e.target.checked ? { hora: null, horaFin: null } : { hora: '10:00', horaFin: '11:00' })} />
          Todo el día
        </label>
      </Fila>
      {b.tipo === 'publicacion' && (
        <Fila icono={<Svg d={D.texto} />}>
          <select className="gc-campo" value={b.formato} onChange={(e) => poner({ formato: e.target.value as FormatoPublicacion })} aria-label="Formato">
            {FORMATOS_PUBLICACION.map((f) => <option key={f} value={f}>{ROTULO_FORMATO[f]}</option>)}
          </select>
        </Fila>
      )}
      <Fila icono={<span className="gc-cuadro" style={{ background: color }} />}>
        {aGoogle ? (
          editables.length > 1 ? (
            <select className="gc-campo" value={b.calendarioId ?? editables[0].id} onChange={(e) => poner({ calendarioId: e.target.value })} aria-label="Calendario">
              {editables.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : <span>{editables[0].nombre}</span>
        ) : (
          <span>{b.tipo === 'evento' ? 'MaKo · Bloques de trabajo' : `MaKo · ${NOMBRE_CAPA[b.tipo === 'publicacion' ? 'publicaciones' : b.tipo === 'llamada' ? 'llamadas' : 'bloques']}`}</span>
        )}
      </Fila>
      {error && <div role="alert" style={{ padding: '4px 16px 0 64px', fontSize: 13, color: 'var(--bad)' }}>{error}</div>}
      <div className="gc-pie">
        <button type="button" className="gc-boton-texto" onClick={() => onMas({ ...b, calendarioId: aGoogle ? (b.calendarioId ?? editables[0].id) : null })}>Más opciones</button>
        <button type="button" className="gc-boton-azul" disabled={guardando} onClick={enviar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>,
    document.body,
  );
}

// ── «Más opciones» de un evento de Google ───────────────────────────────────────────────────────────────────────────

export type EdicionGoogle = {
  /** null = uno nuevo. */
  eventoId: string | null;
  calendarioId: string;
  entrada: EntradaEventoGoogle;
  invitados: number;
};

export function EventoGoogleModal({ inicial, editables, guardando, error, onCerrar, onGuardar, onBorrar }: {
  inicial: EdicionGoogle;
  editables: readonly CalendarioGoogle[];
  guardando: boolean;
  error: string | null;
  onCerrar: () => void;
  onGuardar: (e: EdicionGoogle, avisar: boolean) => void;
  onBorrar?: () => void;
}) {
  const [titulo, setTitulo] = useState(inicial.entrada.titulo);
  const [fecha, setFecha] = useState(inicial.entrada.fecha);
  const [todoElDia, setTodoElDia] = useState(inicial.entrada.hora == null);
  const [hora, setHora] = useState(inicial.entrada.hora ?? '10:00');
  const [horaFin, setHoraFin] = useState(() => {
    const h = inicial.entrada.hora ?? '10:00';
    const fin = minutos(h) + (inicial.entrada.duracionMin ?? 60);
    return `${String(Math.floor(fin / 60) % 24).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`;
  });
  const [fechaFin, setFechaFin] = useState(inicial.entrada.fechaFin ?? inicial.entrada.fecha);
  const [ubicacion, setUbicacion] = useState(inicial.entrada.ubicacion ?? '');
  const [descripcion, setDescripcion] = useState(inicial.entrada.descripcion ?? '');
  const [colorId, setColorId] = useState<string | null>(inicial.entrada.colorId ?? null);
  const [calendarioId, setCalendarioId] = useState(inicial.calendarioId);
  const [avisar, setAvisar] = useState(true);
  const cerrar = useCerrarEstable(onCerrar, guardando);
  const nuevo = !inicial.eventoId;
  const cal = editables.find((c) => c.id === calendarioId);

  const guardar = () => onGuardar({
    eventoId: inicial.eventoId, calendarioId, invitados: inicial.invitados,
    entrada: {
      titulo, fecha, hora: todoElDia ? null : hora, fechaFin: todoElDia ? (fechaFin < fecha ? fecha : fechaFin) : null,
      duracionMin: todoElDia ? null : duracionEntre(hora, horaFin), ubicacion, descripcion, colorId,
    },
  }, avisar);

  return (
    <Modal titulo={nuevo ? 'Nuevo evento' : 'Editar evento'} onCerrar={cerrar} ancho={620}
      pie={<>
        {!nuevo && onBorrar && <BotonBorrar onClick={onBorrar} title="Borrar este evento de Google" disabled={guardando} />}
        <span style={{ flex: 1 }} />
        <Button variant="secondary" onClick={cerrar} disabled={guardando}>Cancelar</Button>
        <Button variant="primary" onClick={guardar} loading={guardando}>Guardar</Button>
      </>}>
      <div className="gc" style={{ background: 'transparent', height: 'auto', gap: 14 }}>
        <input className="gc-rapido-titulo" placeholder="Agregar título" value={titulo} maxLength={TOPE_TITULO_GOOGLE} onChange={(e) => setTitulo(e.target.value)} data-autofocus="" />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <input type="date" className="gc-campo" value={fecha} onChange={(e) => { if (!e.target.value) return; setFecha(e.target.value); if (fechaFin < e.target.value) setFechaFin(e.target.value); }} aria-label="Fecha" />
          {todoElDia ? (
            <>–<input type="date" className="gc-campo" value={fechaFin} min={fecha} onChange={(e) => e.target.value && setFechaFin(e.target.value)} aria-label="Hasta" /></>
          ) : (
            <>
              <input type="time" className="gc-campo" value={hora} step={900} onChange={(e) => e.target.value && setHora(e.target.value)} aria-label="Empieza" />
              –
              <input type="time" className="gc-campo" value={horaFin} step={900} onChange={(e) => e.target.value && setHoraFin(e.target.value)} aria-label="Termina" />
            </>
          )}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', marginLeft: 6 }}>
            <input type="checkbox" checked={todoElDia} onChange={(e) => setTodoElDia(e.target.checked)} /> Todo el día
          </label>
        </div>
        <input className="gc-campo" placeholder="Agregar ubicación" value={ubicacion} maxLength={300} onChange={(e) => setUbicacion(e.target.value)} aria-label="Ubicación" />
        <textarea className="gc-campo" placeholder="Agregar descripción" value={descripcion} maxLength={8000} rows={4} onChange={(e) => setDescripcion(e.target.value)}
          style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }} aria-label="Descripción" />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {nuevo && editables.length > 1 ? (
            <select className="gc-campo" value={calendarioId} onChange={(e) => setCalendarioId(e.target.value)} aria-label="Calendario">
              {editables.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : <span style={{ fontSize: 14 }}>{cal?.nombre ?? 'Google Calendar'}</span>}
          <span role="radiogroup" aria-label="Color" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
            <button type="button" role="radio" aria-checked={colorId == null} title="Color del calendario" onClick={() => setColorId(null)}
              style={{ width: 22, height: 22, borderRadius: '50%', border: colorId == null ? '2px solid var(--ink)' : '2px solid transparent', background: cal?.color ?? '#039be5', cursor: 'pointer' }} />
            {Object.entries(COLORES_EVENTO_GOOGLE).map(([id, c]) => (
              <button key={id} type="button" role="radio" aria-checked={colorId === id} title={c.nombre} aria-label={c.nombre} onClick={() => setColorId(id)}
                style={{ width: 22, height: 22, borderRadius: '50%', border: colorId === id ? '2px solid var(--ink)' : '2px solid transparent', background: c.hex, cursor: 'pointer' }} />
            ))}
          </span>
        </div>
        {inicial.invitados > 0 && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
            Avisar el cambio a {inicial.invitados === 1 ? 'la persona invitada' : `las ${inicial.invitados} personas invitadas`}
          </label>
        )}
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{error}</div>}
      </div>
    </Modal>
  );
}

/** El día siguiente de una fecha (para el fin de un día completo nuevo). */
export const diaSiguiente = (f: string) => sumarDias(f, 1);
