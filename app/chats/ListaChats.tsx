'use client';

// =============================================================================
// ListaChats — la lista de conversaciones, copiada de respond.io (298 px)
// =============================================================================
// Relevamiento respondio.md §1.2 y las capturas 15 a 22. De arriba abajo:
//   · el encabezado de 44: la pestaña «Chats» subrayada en azul y la lupa (en modo búsqueda, un campo
//     con su ×);
//   · la barra del filtro: «Abiertas, Más recientes ⌄» (Mostrar / Orden) y el interruptor «Sin responder»;
//   · las filas: una tarjeta de 3 líneas — avatar de 32 con la insignia del canal del último mensaje,
//     nombre 14/600 y la hora; la flecha (↙ naranja si escribió el contacto, ↗ azul si escribimos
//     nosotros) y el último mensaje; el chip de la etapa, cerrada/pospuesta y el asignado. Sin leer:
//     el texto en negrita y el punto azul. Al pasar el cursor, «⋯» con las acciones rápidas.
//
// Lo que NO se copia: la pestaña «Calls» (no hay canal de voz), el ícono de «nueva conversación» (una
// conversación nace del CRM o del contacto, no de un número suelto), las pestañas «Contacts | Messages |
// Comments» de la búsqueda (el servidor busca contactos; los mensajes no se indexan) y los órdenes
// «Longest/Shortest Open» (no se guarda desde cuándo está abierta). El número de no leídos: el contrato
// trae SI hay (`sinLeer`), no cuántos, así que va el punto azul sin número.

import { useMemo, type KeyboardEvent, type ReactElement } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Check, CircleCheck, LoaderCircle, PanelLeftOpen, RotateCcw, Search, Timer, TimerOff,
  UserRound, UserRoundX, X,
} from 'lucide-react';
import { Dropdown, type DropdownGroup, type DropdownOption } from '@/app/components/Dropdown';
import { MakoLogo } from '@/app/_components/MakoBrand';
import type { ChatResumen, EtapaChat, LineaChat } from '@/lib/chats-tipos';
import { MAKO_SETTER } from '@/lib/pipeline';
import type { FiltroChats, MostrarChats, OrdenChats } from '@/lib/chats-reglas';
import { horaDeFila, previewDe } from './lista-reglas';
import { fechaOpcion, opcionesPosponer } from './ventana-reglas';
import { AvatarRio } from './ventana-piezas';
import { portalRio } from './portal';

/** Lo que se puede hacer desde el «⋯» de una fila (por las rutas del plano §2.2). */
export type AccionFila =
  | { tipo: 'cerrar' }
  | { tipo: 'reabrir' }
  | { tipo: 'posponer'; hasta: string }
  | { tipo: 'reanudar' }
  | { tipo: 'asignar'; setter: string | null };

type Miembro = { nombre: string; foto_url: string | null };

const MOSTRAR: Array<{ v: MostrarChats; label: string }> = [
  { v: 'todas', label: 'Todas' },
  { v: 'abiertas', label: 'Abiertas' },
  { v: 'cerradas', label: 'Cerradas' },
  { v: 'pospuestas', label: 'Pospuestas' },
];
const ORDEN: Array<{ v: OrdenChats; label: string }> = [
  { v: 'recientes', label: 'Más recientes' },
  { v: 'antiguas', label: 'Más antiguas' },
];

/** Las fuentes que lib/chats.ts nombra en `fallas` (su `falla('…')`), en palabras. */
const FUENTE: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  estado: 'el estado',
  leidos: 'los no leídos',
  borradores: 'los borradores',
  etapas: 'las etapas',
  crm: 'el CRM',
  workspace: 'el negocio',
};

/** Lo que dice el aviso de `fallas` (`'whatsapp:<linea>'`, `'instagram'`, `'estado'`…). Una desconocida, tal cual. */
function nombreDeFalla(f: string, lineas: readonly LineaChat[]): string {
  if (f.startsWith('whatsapp:')) {
    const l = lineas.find((x) => x.linea === f.slice('whatsapp:'.length));
    return l ? `WhatsApp (${l.rotulo})` : 'WhatsApp';
  }
  return FUENTE[f] ?? f;
}

export function ListaChats(props: {
  ws: number | null;
  /** Lo que se dibuja: la lista filtrada, o los resultados de la búsqueda. */
  chats: ChatResumen[];
  cargando: boolean;
  errorLista: string | null;
  fallas: string[];
  lineas: LineaChat[];
  onReintentar: () => void;
  filtro: FiltroChats;
  onFiltro: (f: FiltroChats) => void;
  modoBusca: boolean;
  onModoBusca: (on: boolean) => void;
  buscar: string;
  onBuscar: (q: string) => void;
  buscandoRemoto: boolean;
  errorBusqueda: string | null;
  seleccionada: string | null;
  onElegir: (c: ChatResumen) => void;
  etapas: EtapaChat[];
  equipo: Miembro[];
  bandejaAbierta: boolean;
  onAbrirBandeja: () => void;
  onAccion: (c: ChatResumen, a: AccionFila) => void;
}) {
  const {
    ws, chats, cargando, errorLista, fallas, lineas, onReintentar, filtro, onFiltro, modoBusca, onModoBusca, buscar,
    onBuscar, buscandoRemoto, errorBusqueda, seleccionada, onElegir, etapas, equipo, bandejaAbierta, onAbrirBandeja, onAccion,
  } = props;

  const colorEtapa = useMemo(() => new Map(etapas.map((e) => [e.key, e.color])), [etapas]);
  const fotoDe = useMemo(() => new Map(equipo.map((m) => [m.nombre, m.foto_url])), [equipo]);
  const ahora = new Date();

  // «Abiertas, Más recientes»: el rótulo del filtro dice las DOS cosas, como el «All, Newest» de respond.io.
  const rotuloFiltro = `${MOSTRAR.find((m) => m.v === filtro.mostrar)?.label ?? 'Abiertas'}, ${ORDEN.find((o) => o.v === filtro.orden)?.label ?? 'Más recientes'}`;
  const gruposFiltro: DropdownGroup[] = [
    { title: 'Mostrar', options: MOSTRAR.map((m) => ({ value: `m:${m.v}`, label: m.label })) },
    { title: 'Orden', options: ORDEN.map((o) => ({ value: `o:${o.v}`, label: o.label })) },
  ];

  const q = buscar.trim();
  const textoFallas = fallas.length ? `No pude leer: ${fallas.map((f) => nombreDeFalla(f, lineas)).join(', ')}.` : null;

  let cuerpo: ReactElement;
  if (cargando) {
    cuerpo = <div className="rio-vacio"><LoaderCircle size={20} className="rio-girando" aria-label="Cargando" /></div>;
  } else if (errorLista && !chats.length && !modoBusca) {
    cuerpo = (
      <div className="rio-vacio">
        <span>No pude leer los chats.</span>
        <button type="button" className="rio-btn" onClick={onReintentar}>Reintentar</button>
      </div>
    );
  } else if (modoBusca && q.length < 2) {
    cuerpo = <div className="rio-vacio">Escribe al menos 2 letras.</div>;
  } else if (!chats.length) {
    cuerpo = modoBusca
      ? (buscandoRemoto
        ? <div className="rio-vacio"><LoaderCircle size={20} className="rio-girando" aria-label="Buscando" /></div>
        : <div className="rio-vacio">{errorBusqueda ? 'No pude buscar.' : 'Sin resultados.'}</div>)
      : <div className="rio-vacio">No hay chats aquí.</div>;
  } else {
    cuerpo = (
      <div className="rio-filas" role="list">
        {chats.map((c) => (
          <Fila key={c.clave} ws={ws} c={c} sel={c.clave === seleccionada} ahora={ahora}
            colorEtapa={c.etapaKey ? colorEtapa.get(c.etapaKey) ?? null : null}
            fotoAsignado={c.asignado ? fotoDe.get(c.asignado) ?? null : null}
            equipo={equipo} onElegir={onElegir} onAccion={onAccion} />
        ))}
        {modoBusca && buscandoRemoto && <div className="rio-lista-pie"><LoaderCircle size={16} className="rio-girando" aria-label="Buscando" /></div>}
      </div>
    );
  }

  return (
    <section className="rio-lista" aria-label="Chats">
      <header className="rio-cab">
        {modoBusca ? (
          <div className="rio-busca" style={{ alignSelf: 'center' }}>
            <input className="rio-input" autoFocus value={buscar} onChange={(e) => onBuscar(e.target.value)}
              placeholder="Buscar contactos" aria-label="Buscar contactos"
              onKeyDown={(e) => { if (e.key === 'Escape') onModoBusca(false); }} />
            <button type="button" className="rio-icono-btn rio-busca-x" data-chico="true" onClick={() => onModoBusca(false)} title="Cerrar búsqueda" aria-label="Cerrar búsqueda"><X size={16} /></button>
          </div>
        ) : (
          <>
            {!bandejaAbierta && (
              <button type="button" className="rio-icono-btn" style={{ alignSelf: 'center' }} onClick={onAbrirBandeja} title="Mostrar bandeja" aria-label="Mostrar bandeja"><PanelLeftOpen size={20} strokeWidth={1.5} /></button>
            )}
            <div className="rio-pestanas" role="tablist">
              <button type="button" role="tab" aria-selected="true" className="rio-pestana">Chats</button>
            </div>
            <div className="rio-cab-acciones">
              <button type="button" className="rio-icono-btn" onClick={() => onModoBusca(true)} title="Buscar" aria-label="Buscar"><Search size={20} strokeWidth={1.5} /></button>
            </div>
          </>
        )}
      </header>

      {/* La barra del filtro: en la búsqueda no se dibuja, porque los resultados no pasan por él. */}
      {!modoBusca && (
        <div className="rio-filtros">
          <Dropdown
            value=""
            varios={[`m:${filtro.mostrar}`, `o:${filtro.orden}`]}
            // Dos marcados SIEMPRE (uno por grupo): el marcado no se apaga, como un radio. Tocar otro del
            // mismo grupo lo reemplaza (abajo), así que cada grupo elige uno.
            minimo={2}
            columns={[gruposFiltro]}
            alContenido
            search={false}
            portalTo={portalRio()}
            ariaLabel="Mostrar y ordenar"
            botonLabel={rotuloFiltro}
            onChange={(v) => {
              if (v.startsWith('m:')) onFiltro({ ...filtro, mostrar: v.slice(2) as MostrarChats });
              else if (v.startsWith('o:')) onFiltro({ ...filtro, orden: v.slice(2) as OrdenChats });
            }}
            buttonStyle={{ padding: 0, border: 'none', background: 'transparent', borderRadius: 0, fontFamily: 'inherit', fontSize: 14, fontWeight: 400, color: 'var(--rio-text)', gap: 6 }}
          />
          <button type="button" role="switch" aria-checked={filtro.sinResponder} className="rio-interruptor"
            onClick={() => onFiltro({ ...filtro, sinResponder: !filtro.sinResponder })}>
            <span className="rio-interruptor-pista" aria-hidden="true" />
            Sin responder
          </button>
        </div>
      )}

      {errorLista && !cargando && chats.length > 0 && !modoBusca && (
        <div className="rio-aviso-falla" data-tono="error" role="status">
          <span style={{ flex: 1 }}>No pude actualizar la lista.</span>
          <button type="button" className="rio-link" onClick={onReintentar}>Reintentar</button>
        </div>
      )}
      {/* En la búsqueda, `fallas` son las de la búsqueda (ChatsApp): «Sin resultados» sigue diciendo qué no se leyó. */}
      {textoFallas && <div className="rio-aviso-falla" role="status">{textoFallas}</div>}

      {cuerpo}
    </section>
  );
}

// ── Una fila ─────────────────────────────────────────────────────────────────────────────────

function Fila({ ws, c, sel, ahora, colorEtapa, fotoAsignado, equipo, onElegir, onAccion }: {
  ws: number | null;
  c: ChatResumen;
  sel: boolean;
  ahora: Date;
  colorEtapa: string | null;
  fotoAsignado: string | null;
  equipo: Miembro[];
  onElegir: (c: ChatResumen) => void;
  onAccion: (c: ChatResumen, a: AccionFila) => void;
}) {
  const preview = previewDe(c);
  const hora = horaDeFila(c.ultimaFecha, ahora);
  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onElegir(c); }
  };
  return (
    <div role="listitem" className="rio-fila" data-sel={sel ? 'true' : undefined}>
      {/* La fila entera es el botón; el «⋯» va como hermano absoluto, para no anidar un botón en otro. */}
      <div role="button" tabIndex={0} className="rio-fila-boton" aria-current={sel ? 'true' : undefined} aria-label={c.nombre}
        onClick={() => onElegir(c)} onKeyDown={alTeclear}>
        <AvatarRio ws={ws} nombre={c.nombre} size={32} tel={c.avatarTel} canal={c.canalUltimo} />
        <div className="rio-fila-cuerpo">
          <div className="rio-l1">
            <span className="rio-nombre">{c.nombre}</span>
            {hora && <span className="rio-hora">{hora}</span>}
          </div>
          <div className="rio-l2">
            {c.ultimaFecha && (
              <span className="rio-flecha" data-dir={c.ultimoEntrante ? 'entra' : 'sale'} aria-label={c.ultimoEntrante ? 'Recibido' : 'Enviado'}>
                {c.ultimoEntrante ? <ArrowDownLeft size={14} strokeWidth={2} /> : <ArrowUpRight size={14} strokeWidth={2} />}
              </span>
            )}
            <span className="rio-preview" data-sinleer={c.sinLeer ? 'true' : undefined}>{preview}</span>
            {c.sinLeer && <span className="rio-punto" aria-label="Sin leer" />}
          </div>
          <div className="rio-l3">
            {c.etapaLabel && (
              <span className="rio-chip-etapa" title={c.etapaLabel}>
                {colorEtapa && <span className="rio-chip-punto" style={{ background: colorEtapa }} />}
                <span className="rio-chip-etapa-texto">{c.etapaLabel}</span>
              </span>
            )}
            <span className="rio-l3-der">
              {c.estado === 'cerrada' && <span className="rio-estado-ico" data-estado="cerrada" title="Cerrada"><Check size={11} strokeWidth={3} /></span>}
              {c.estado === 'pospuesta' && <span className="rio-estado-ico" data-estado="pospuesta" title="Pospuesta"><Timer size={11} strokeWidth={2.5} /></span>}
              <Asignado nombre={c.asignado} foto={fotoAsignado} ws={ws} />
            </span>
          </div>
        </div>
      </div>
      <MasAcciones c={c} equipo={equipo} onAccion={onAccion} />
    </div>
  );
}

/** El avatar del asignado (20): MaKo con su logo, una persona con su foto o iniciales, o la silueta. */
function Asignado({ nombre, foto, ws }: { nombre: string | null; foto: string | null; ws: number | null }) {
  if (!nombre) return <span className="rio-sin-asignar" title="Sin asignar"><UserRound size={12} strokeWidth={2} /></span>;
  if (nombre.trim() === MAKO_SETTER) return <span title="Atiende MaKo" style={{ display: 'inline-flex' }}><MakoLogo size={20} animate={false} /></span>;
  return <AvatarRio ws={ws} nombre={nombre} size={20} foto={foto} />;
}

/**
 * El «⋯» de la fila (respond.io: Close · Close with notes · Snooze › · Assign › · Lifecycle ›). Va por el
 * Dropdown de la casa con el portal ADENTRO de `.rio`: la lista scrollea, y un menú `absolute` colgado
 * de la fila se cortaría en el borde del scroll. Abre hacia afuera (`align="afuera"`), sin tapar la fila.
 *
 * Lo que NO trae: «Cerrar con nota» (la nota va en el botón de la cabecera del chat), «Shortcuts» y
 * «Collaborators» (no existen en MaKo) y «Lifecycle» (la etapa se cambia en la cabecera, por el mismo
 * camino que el CRM y con la ficha cuando la etapa pide datos).
 */
function MasAcciones({ c, equipo, onAccion }: {
  c: ChatResumen;
  equipo: Miembro[];
  onAccion: (c: ChatResumen, a: AccionFila) => void;
}) {
  const posponer = c.estado === 'abierta' ? opcionesPosponer(new Date()) : [];
  const conversacion: DropdownOption[] = [];
  if (c.estado === 'cerrada') conversacion.push({ value: 'reabrir', label: 'Reabrir', icono: <RotateCcw size={16} /> });
  else conversacion.push({ value: 'cerrar', label: 'Cerrar', icono: <CircleCheck size={16} /> });
  if (c.estado === 'pospuesta') conversacion.push({ value: 'reanudar', label: 'Reanudar', icono: <TimerOff size={16} /> });
  const grupos: DropdownGroup[] = [{ title: '', options: conversacion }];
  if (posponer.length) {
    grupos.push({
      title: 'Posponer hasta',
      options: posponer.map((p) => ({ value: `pos:${p.key}`, label: p.label, sub: fechaOpcion(p.hasta), icono: <Timer size={16} /> })),
    });
  }
  // Asignar = el setter del lead (plano §6.2): sin lead no hay a quién asignar todavía.
  if (c.leadId != null) {
    const opciones: DropdownOption[] = [];
    if (c.asignado) opciones.push({ value: 'asig:', label: 'Quitar asignación', icono: <UserRoundX size={16} /> });
    opciones.push({ value: `asig:${MAKO_SETTER}`, label: MAKO_SETTER, icono: <MakoLogo size={18} animate={false} /> });
    for (const m of equipo) {
      if (m.nombre && m.nombre !== MAKO_SETTER) opciones.push({ value: `asig:${m.nombre}`, label: m.nombre, avatar: m.foto_url });
    }
    grupos.push({ title: 'Asignar', options: opciones });
  }
  const elegir = (v: string) => {
    if (v === 'cerrar' || v === 'reabrir' || v === 'reanudar') { onAccion(c, { tipo: v }); return; }
    if (v.startsWith('pos:')) {
      const p = posponer.find((x) => x.key === v.slice(4));
      if (p) onAccion(c, { tipo: 'posponer', hasta: p.hasta.toISOString() });
      return;
    }
    if (v.startsWith('asig:')) {
      const nombre = v.slice(5);
      if ((nombre || null) !== (c.asignado ?? null)) onAccion(c, { tipo: 'asignar', setter: nombre || null });
    }
  };
  return (
    // El clic del menú (que vive en un portal) BURBUJEA por el árbol de React hasta la fila: sin este
    // corte, elegir «Cerrar» además abría la conversación.
    <span className="rio-fila-mas" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Dropdown
        value=""
        resetAfterSelect
        sinFlecha
        align="afuera"
        columns={[grupos]}
        alContenido
        subEnColumnas
        search={false}
        portalTo={portalRio()}
        ariaLabel="Más acciones"
        botonLabel={<span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1, letterSpacing: 1 }}>⋯</span>}
        onChange={elegir}
        menuMinAncho={220}
        buttonStyle={{ width: 24, height: 24, padding: 0, border: 'none', borderRadius: 6, background: 'var(--rio-bg)', color: 'var(--rio-text)', justifyContent: 'center', boxShadow: '0 0 0 1px var(--rio-border)' }}
      />
    </span>
  );
}
