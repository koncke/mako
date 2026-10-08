'use client';

// =============================================================================
// Calendario — la pestaña Calendario de la comunidad: el mes, los próximos y cada evento
// =============================================================================
// Skool (relevo, B.6): un calendario con zona horaria, recurrencia, lugar, portada y acceso, que se ve
// en la hora de QUIEN MIRA. Dos vistas: el mes (la grilla, con la lista del día elegido debajo, que en
// el teléfono es lo que se lee) y los próximos (de hoy a unos meses). Un evento abre su modal: cuándo
// (en tu hora, y en la del evento si es otra), cada cuánto se repite, dónde, la descripción y «Agregar
// a mi calendario» (un .ics que arma el server). El equipo además crea, edita y borra
// (./EditorEvento.tsx), y con una serie elige «este / este y los siguientes / todos».
//
// ⚠️ LO CERRADO YA LLEGA CERRADO: a un alumno que no entra a un evento le llega el título, la hora y el
//    motivo, sin el link ni la descripción (lib/comunidad-calendario.ts). Acá sólo se dibuja eso.

import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Spinner } from '@/app/_ui';
import { fondoPortada } from '@/lib/portadas';
import { tokensDeTexto } from '@/lib/comunidad-reglas';
import { DIAS_CORTOS } from '@/lib/comunidad-eventos';
import type { CalendarioVista, EventoVista, OcurrenciaVista } from '@/lib/comunidad-tipos';
import type { AlcanceEvento } from './api';
import { AlcanceModal, EditorEvento } from './EditorEvento';
import { Ico, Menu, Texto, useComunidad, type ItemMenu } from './piezas';
import {
  diaCortoEn, diaLargoEn, duracionTexto, fechaEn, hoyEn, horaEn, mesTexto, nombreDeZona, sumarDiasTexto, zonaDelNavegador,
  diaDeSemanaTexto, mayuscula,
} from './tiempo';

const DIA = 86_400_000;
type Vista = 'mes' | 'proximos';
type Abierto = { evento: EventoVista; oc: OcurrenciaVista };

/** El color de base de una portada «automática» (no hay: un evento sin portada no dibuja la banda). */
const COLOR_PORTADA = '#7c8796';

export function Calendario({ pedido = null, onPedidoAbierto }: {
  /** Un evento que pidió abrir la campana: su id y el inicio de la ocurrencia. */
  pedido?: { id: number; ocurrencia: string | null } | null;
  onPedidoAbierto?: () => void;
}) {
  const { api, comunidad, aviso } = useComunidad();
  // La zona de quien mira. El calendario sólo existe después de montar (se abre con un clic), así
  // que leerla en el primer render no choca con el HTML del server.
  const [zona] = useState(() => zonaDelNavegador());
  const [vista, setVista] = useState<Vista>(() => (pedido ? 'proximos' : 'mes'));
  const [mes, setMes] = useState(() => { const [y, m] = hoyEn(zona).split('-').map(Number); return { y, m }; });
  const [elegido, setElegido] = useState(() => hoyEn(zona));
  const [version, setVersion] = useState(0);
  const [res, setRes] = useState<{ clave: string; datos: CalendarioVista | null; error: string | null } | null>(null);
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const [editor, setEditor] = useState<{ evento: EventoVista | null; oc: OcurrenciaVista | null } | null>(null);

  // El rango que se pide: el mes con sus bordes (la grilla arranca y termina en semanas enteras, y las
  // zonas van de −12 a +14 h), o de hace un rato (lo que está en curso) a cuatro meses.
  const rango = useMemo(() => (vista === 'mes'
    ? { desde: Date.UTC(mes.y, mes.m - 1, 1) - 8 * DIA, hasta: Date.UTC(mes.y, mes.m, 1) + 8 * DIA }
    : { desde: Date.now() - 3 * 3_600_000, hasta: Date.now() + 120 * DIA }), [vista, mes]);
  const clave = `${vista}:${rango.desde}:${rango.hasta}:${version}`;

  useEffect(() => {
    let vivo = true;
    void api.calendario(rango).then((r) => {
      if (!vivo) return;
      setRes({ clave, datos: r.ok ? r.calendario : null, error: r.ok ? null : r.error });
    });
    return () => { vivo = false; };
  }, [api, rango, clave]);

  const cargando = res?.clave !== clave;
  const datos = res?.datos ?? null;
  const porId = useMemo(() => new Map((datos?.eventos ?? []).map((e) => [e.id, e])), [datos]);

  // La campana pidió un evento: se abre cuando llega la lista de próximos.
  useEffect(() => {
    if (!pedido || cargando || !datos) return;
    const quiere = pedido.ocurrencia ? Date.parse(pedido.ocurrencia) : NaN;
    const oc = datos.ocurrencias.find((o) => o.eventoId === pedido.id && Date.parse(o.inicio) === quiere)
      ?? datos.ocurrencias.find((o) => o.eventoId === pedido.id);
    const ev = porId.get(pedido.id);
    // Con el calendario ya abierto en otro mes, el evento puede no estar en la grilla: se busca en
    // «próximos» (un aviso de la campana es de algo que empieza pronto) antes de decir que no está.
    if (!(ev && oc) && vista !== 'proximos') { setVista('proximos'); return; }
    if (ev && oc) setAbierto({ evento: ev, oc });
    else aviso('Ese evento ya no está');
    onPedidoAbierto?.();
    // `onPedidoAbierto` cambia de identidad en cada render de la raíz; lo que dispara es el pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, cargando, datos, porId, vista]);

  const recargar = () => setVersion((v) => v + 1);
  const moverMes = (n: number) => setMes((x) => { const t = new Date(Date.UTC(x.y, x.m - 1 + n, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 }; });
  const irAHoy = () => { const h = hoyEn(zona); const [y, m] = h.split('-').map(Number); setMes({ y, m }); setElegido(h); };

  /** Las ocurrencias de cada día, en la zona de quien mira. */
  const porDia = useMemo(() => {
    const out = new Map<string, OcurrenciaVista[]>();
    for (const o of datos?.ocurrencias ?? []) {
      const d = fechaEn(o.inicio, zona);
      out.set(d, [...(out.get(d) ?? []), o]);
    }
    return out;
  }, [datos, zona]);

  const abrir = (o: OcurrenciaVista) => { const ev = porId.get(o.eventoId); if (ev) setAbierto({ evento: ev, oc: o }); };

  return (
    <div className="cmu-card cmu-cal">
      <div className="cmu-cal-cab">
        {vista === 'mes' ? (
          <div className="cmu-cal-nav">
            <button type="button" className="cmu-menu-btn" aria-label="Mes anterior" onClick={() => moverMes(-1)}><Ico n="izq" /></button>
            <b className="cmu-cal-mes">{mayuscula(mesTexto(mes.y, mes.m))}</b>
            <button type="button" className="cmu-menu-btn" aria-label="Mes siguiente" onClick={() => moverMes(1)}><Ico n="der" /></button>
            <Button variant="tertiary" size="sm" onClick={irAHoy}>Hoy</Button>
          </div>
        ) : <b className="cmu-cal-mes">Próximos</b>}
        <div className="cmu-chips" role="tablist" aria-label="Vista" style={{ flex: 'none' }}>
          <button type="button" role="tab" className="cmu-chip" data-on={vista === 'mes'} aria-selected={vista === 'mes'} onClick={() => setVista('mes')}>Mes</button>
          <button type="button" role="tab" className="cmu-chip" data-on={vista === 'proximos'} aria-selected={vista === 'proximos'} onClick={() => setVista('proximos')}>Próximos</button>
        </div>
        {comunidad.puedoGestionarEventos && api.guardarEvento && (
          <Button size="sm" icon={<Ico n="calendario" size={15} />} onClick={() => setEditor({ evento: null, oc: null })}>Nuevo evento</Button>
        )}
      </div>
      <span className="cmu-meta">Horas en {nombreDeZona(zona)}</span>

      {res?.error && res.clave === clave && <p className="cmu-error" role="alert">{res.error}</p>}

      {vista === 'mes' ? (
        <>
          <Mes y={mes.y} m={mes.m} zona={zona} porDia={porDia} porId={porId} elegido={elegido} cargando={cargando}
            onElegir={setElegido} onAbrir={abrir} />
          <DelDia fecha={elegido} zona={zona} ocs={porDia.get(elegido) ?? []} porId={porId} onAbrir={abrir} cargando={cargando} />
        </>
      ) : (
        <Proximos zona={zona} ocs={datos?.ocurrencias ?? []} porId={porId} onAbrir={abrir} cargando={cargando} />
      )}

      {abierto && (
        <EventoModal evento={abierto.evento} oc={abierto.oc} zona={zona} onCerrar={() => setAbierto(null)}
          onEditar={() => { setEditor({ evento: abierto.evento, oc: abierto.oc }); setAbierto(null); }}
          onBorrado={() => { setAbierto(null); recargar(); }} />
      )}
      {editor && (
        <EditorEvento evento={editor.evento} oc={editor.oc} zonaVista={zona} onCerrar={() => setEditor(null)}
          onListo={() => { setEditor(null); recargar(); aviso('Evento guardado'); }} />
      )}
    </div>
  );
}

// ── El mes ──────────────────────────────────────────────────────────────────────

/** La semana arranca el LUNES (como se lee un calendario en español). */
const ENCABEZADO = [1, 2, 3, 4, 5, 6, 0].map((d) => DIAS_CORTOS[d]);

function Mes({ y, m, zona, porDia, porId, elegido, cargando, onElegir, onAbrir }: {
  y: number; m: number; zona: string;
  porDia: Map<string, OcurrenciaVista[]>; porId: Map<number, EventoVista>;
  elegido: string; cargando: boolean;
  onElegir: (f: string) => void; onAbrir: (o: OcurrenciaVista) => void;
}) {
  const primero = `${y}-${String(m).padStart(2, '0')}-01`;
  const inicio = sumarDiasTexto(primero, -((diaDeSemanaTexto(primero) + 6) % 7));
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const semanas = Math.ceil(((diaDeSemanaTexto(primero) + 6) % 7 + diasMes) / 7);
  const hoy = hoyEn(zona);
  const celdas = Array.from({ length: semanas * 7 }, (_, i) => sumarDiasTexto(inicio, i));
  return (
    <div className="cmu-mes" data-cargando={cargando || undefined} aria-busy={cargando || undefined}>
      {ENCABEZADO.map((d) => <span key={d} className="cmu-mes-dow">{d}</span>)}
      {celdas.map((f) => {
        const ocs = porDia.get(f) ?? [];
        const fuera = Number(f.slice(5, 7)) !== m;
        return (
          <div key={f} className="cmu-dia" data-fuera={fuera || undefined} data-hoy={f === hoy || undefined} data-elegido={f === elegido || undefined}
            role="button" tabIndex={0} aria-label={`${f}${ocs.length ? `, ${ocs.length} ${ocs.length === 1 ? 'evento' : 'eventos'}` : ''}`}
            onClick={() => onElegir(f)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onElegir(f); }}>
            <span className="cmu-dia-num">{Number(f.slice(8))}</span>
            <div className="cmu-dia-evs">
              {ocs.slice(0, 3).map((o) => {
                const ev = porId.get(o.eventoId);
                return (
                  <button key={`${o.eventoId}-${o.inicio}`} type="button" className="cmu-dia-ev" data-cerrado={ev?.bloqueado ? true : undefined}
                    onClick={(e) => { e.stopPropagation(); onElegir(f); onAbrir(o); }} title={ev?.titulo}>
                    <span className="cmu-mono">{horaEn(o.inicio, zona)}</span> <span className="cmu-dia-ev-tit">{ev?.titulo}</span>
                  </button>
                );
              })}
              {ocs.length > 3 && <span className="cmu-meta">+{ocs.length - 3}</span>}
            </div>
            {ocs.length > 0 && <span className="cmu-dia-punto" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}

/** La lista del día elegido, debajo de la grilla (en el teléfono, la grilla sólo marca los días). */
function DelDia({ fecha, zona, ocs, porId, onAbrir, cargando }: {
  fecha: string; zona: string; ocs: OcurrenciaVista[]; porId: Map<number, EventoVista>; onAbrir: (o: OcurrenciaVista) => void; cargando: boolean;
}) {
  const mediodia = Date.parse(`${fecha}T12:00:00Z`);
  return (
    <div className="cmu-dia-lista">
      <b className="cmu-chico">{mayuscula(diaLargoEn(mediodia, 'UTC'))}</b>
      {cargando ? null : ocs.length === 0 ? <span className="cmu-meta">Sin eventos este día.</span>
        : ocs.map((o) => <FilaEvento key={`${o.eventoId}-${o.inicio}`} o={o} ev={porId.get(o.eventoId)} zona={zona} onAbrir={onAbrir} />)}
    </div>
  );
}

function Proximos({ zona, ocs, porId, onAbrir, cargando }: {
  zona: string; ocs: OcurrenciaVista[]; porId: Map<number, EventoVista>; onAbrir: (o: OcurrenciaVista) => void; cargando: boolean;
}) {
  // El reloj de la comunidad (se mueve cada minuto): lo que ya terminó sale de «próximos».
  const { ahora } = useComunidad();
  if (cargando && !ocs.length) return <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div>;
  const lista = ocs.filter((o) => ahora == null || Date.parse(o.fin) > ahora).slice(0, 40);
  if (!lista.length) return <div className="cmu-vacio"><b>No hay eventos próximos.</b></div>;
  const hoy = hoyEn(zona);
  const manana = sumarDiasTexto(hoy, 1);
  const grupos: Array<{ fecha: string; ocs: OcurrenciaVista[] }> = [];
  for (const o of lista) {
    const f = fechaEn(o.inicio, zona);
    const g = grupos[grupos.length - 1];
    if (g && g.fecha === f) g.ocs.push(o); else grupos.push({ fecha: f, ocs: [o] });
  }
  return (
    <div className="cmu-proximos">
      {grupos.map((g) => (
        <div key={g.fecha} className="cmu-dia-lista">
          <b className="cmu-chico">
            {g.fecha === hoy ? 'Hoy' : g.fecha === manana ? 'Mañana' : mayuscula(diaCortoEn(g.ocs[0].inicio, zona))}
          </b>
          {g.ocs.map((o) => <FilaEvento key={`${o.eventoId}-${o.inicio}`} o={o} ev={porId.get(o.eventoId)} zona={zona} onAbrir={onAbrir} />)}
        </div>
      ))}
    </div>
  );
}

function FilaEvento({ o, ev, zona, onAbrir }: { o: OcurrenciaVista; ev: EventoVista | undefined; zona: string; onAbrir: (o: OcurrenciaVista) => void }) {
  if (!ev) return null;
  return (
    <button type="button" className="cmu-ev-fila" onClick={() => onAbrir(o)}>
      {ev.portada
        ? <span className="cmu-ev-mini" style={{ background: fondoPortada(ev.portada, COLOR_PORTADA) }} aria-hidden />
        : <span className="cmu-ev-mini cmu-ev-mini--vacia" aria-hidden><Ico n="calendario" size={16} /></span>}
      <span className="cmu-ev-fila-txt">
        <span className="cmu-nombre">{ev.titulo}</span>
        <span className="cmu-meta">{horaEn(o.inicio, zona)} – {horaEn(o.fin, zona)}{ev.recurrente ? ' · se repite' : ''}</span>
      </span>
      {ev.bloqueado && <span className="cmu-tag"><Ico n="candado" size={12} /> {ev.bloqueado}</span>}
    </button>
  );
}

// ── El evento abierto ───────────────────────────────────────────────────────────

/** Baja un .ics que armó el server (un Blob: el token del alumno no va en ninguna URL). */
function bajarArchivo(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const hostDe = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

function EventoModal({ evento, oc, zona, onCerrar, onEditar, onBorrado }: {
  evento: EventoVista; oc: OcurrenciaVista; zona: string;
  onCerrar: () => void; onEditar: () => void; onBorrado: () => void;
}) {
  const { api, aviso, confirmar } = useComunidad();
  const [bajando, setBajando] = useState(false);
  const [preguntando, setPreguntando] = useState(false);
  const otraZona = evento.zona !== zona && horaEn(oc.inicio, evento.zona) !== horaEn(oc.inicio, zona);

  const agregar = async (serie: boolean) => {
    setBajando(true);
    const r = await api.ics({ id: evento.id, fecha: oc.fecha, serie });
    setBajando(false);
    if (!r.ok) { aviso(r.error); return; }
    bajarArchivo(r.nombre, r.ics);
  };

  const borrar = async (alcance: AlcanceEvento) => {
    if (!api.borrarEvento) return;
    const r = await api.borrarEvento({ id: evento.id, alcance, ocurrencia: oc.fecha });
    if (!r.ok) { aviso(r.error); return; }
    aviso('Evento borrado');
    onBorrado();
  };
  const pedirBorrar = async () => {
    if (evento.recurrente && !evento.esReemplazo) { setPreguntando(true); return; }
    const si = await confirmar('No se puede deshacer.', { title: '¿Borrar este evento?', confirmLabel: 'Borrar evento', cancelLabel: 'No borrar' });
    if (si) await borrar('todos');
  };

  const itemsAgregar: ItemMenu[] = [
    { label: 'Este evento', onClick: () => void agregar(false) },
    { label: 'Toda la serie', onClick: () => void agregar(true) },
  ];

  const pie = (
    <>
      {evento.puedoEditar && api.borrarEvento && <Button variant="tertiary" onClick={() => void pedirBorrar()}>Borrar</Button>}
      {evento.puedoEditar && api.guardarEvento && <Button variant="secondary" icon={<Ico n="lapiz" size={14} />} onClick={onEditar}>Editar</Button>}
      {!evento.bloqueado && (evento.recurrente
        ? <Menu items={itemsAgregar} boton={<><Ico n="calendario" size={15} /> Agregar a mi calendario</>} arriba />
        : <Button variant="secondary" icon={<Ico n="calendario" size={15} />} loading={bajando} onClick={() => void agregar(false)}>Agregar a mi calendario</Button>)}
    </>
  );

  return (
    <>
      <Modal titulo={evento.titulo} ancho={560} onCerrar={onCerrar} sinFiletes pie={pie}>
        <div className="cmu-ev">
          {evento.portada && <div className="cmu-ev-portada" style={{ background: fondoPortada(evento.portada, COLOR_PORTADA) }} aria-hidden />}
          <div className="cmu-ev-dato">
            <Ico n="calendario" />
            <span>{mayuscula(diaLargoEn(oc.inicio, zona))}</span>
          </div>
          <div className="cmu-ev-dato">
            <Ico n="reloj" />
            <span>
              {horaEn(oc.inicio, zona)} – {horaEn(oc.fin, zona)} <span className="cmu-meta">({duracionTexto(evento.duracionMin)})</span>
              {otraZona && <span className="cmu-meta"> · {horaEn(oc.inicio, evento.zona)} en {nombreDeZona(evento.zona)}</span>}
            </span>
          </div>
          {evento.textoRecurrencia && <div className="cmu-ev-dato"><Ico n="repetir" /><span>{evento.textoRecurrencia}</span></div>}
          {evento.bloqueado ? (
            <div className="cmu-ev-dato cmu-ev-cerrado"><Ico n="candado" /><span>{evento.bloqueado}</span></div>
          ) : evento.lugar ? (
            <div className="cmu-ev-dato">
              <Ico n={evento.lugarTipo === 'link' ? 'link' : 'lugar'} />
              {evento.lugarTipo === 'link' ? (
                <a className="cmu-link" href={evento.lugar} target="_blank" rel="noopener noreferrer nofollow">Entrar · {hostDe(evento.lugar)}</a>
              ) : (
                <span>
                  {evento.lugar}{' '}
                  <a className="cmu-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evento.lugar)}`}
                    target="_blank" rel="noopener noreferrer nofollow">Ver en el mapa</a>
                </span>
              )}
            </div>
          ) : null}
          {!evento.bloqueado && evento.descripcion && <Texto tokens={tokensDeTexto(evento.descripcion)} />}
        </div>
      </Modal>
      {preguntando && (
        <AlcanceModal accion="borrar" onCerrar={() => setPreguntando(false)}
          onElegir={(a) => { setPreguntando(false); void borrar(a); }} />
      )}
    </>
  );
}
