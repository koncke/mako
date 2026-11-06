'use client';

// =============================================================================
// PanelContacto — el panel del contacto (350 px), cerrado hasta que se toca el nombre
// =============================================================================
// Relevamiento respondio.md §1.6-1.7 y las capturas 06, 07 y 40. SIN EL RAIL desde el 24/10/2026 (docs/diseno-chats.md
// §8.1, «simplifiques la interfaz de chats»): la columna de 44 px con dos botones estaba siempre, con el panel cerrado. Se
// abre tocando el nombre en la cabecera del chat, y sus dos pestañas van en su propia cabecera:
//   · «Contacto»: avatar de 40, nombre 16/600 y «ID: <leadId>»; la fila «Canales» con las insignias
//     apiladas; «Datos» con «Abrir ficha ↗» y los campos (label 12/600, valor 14 o el placeholder gris);
//     «Etiquetas» fija abajo. Sin lead: lo que se sabe del canal y «Agregar al CRM»;
//   · «Actividad»: los comentarios del equipo (durazno) y las tarjetas de evento (ícono + título,
//     divisor, texto y fecha), lo más nuevo arriba, con el composer de comentarios fijo abajo.
//
// Lo que NO se copia: la edición en el lugar de cada campo (en MaKo los datos se editan en la ficha del
// lead, «una cosa, un lugar»: el botón «Abrir ficha» lleva ahí), las sugerencias de «merge» (en MaKo el
// contacto ES el lead y se une por `lead_id`), «All Time» (sin filtro de fechas en v1) y las pestañas
// Calls, Attachments, HubSpot y Salesforce.
//
// ⚠️ «AGREGAR AL CRM» VIVE EN UN SOLO LUGAR: la cabecera del chat (VentanaChat.tsx, docs/diseno-chats.md §8.2). Acá
//    estaba también, con su propio flujo copiado, y la pantalla lo mostraba dos veces a la vez (24/10/2026). Sin lead,
//    el panel dice que todavía no está en el CRM y nada más.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CircleCheck, ExternalLink, Flag, Info, PanelRightClose, Plus, RotateCcw, SendHorizontal, Timer,
  TimerOff, UserRound, UserRoundCheck, UserRoundX, LoaderCircle,
} from 'lucide-react';
import type { ChatResumen, EtapaChat, MensajeChat } from '@/lib/chats-tipos';
import { claseDeEvento, type ClaseEvento } from './lista-reglas';
import { claveDia, etiquetaDia, fechaDe, horaCorta, rotuloIdentidad } from './ventana-reglas';
import { AvatarRio, postJson } from './ventana-piezas';
import { InsigniaCanal, IconoCanal } from './iconos-canal';

export type PestanaDrawer = 'contacto' | 'actividad';

/** GET /api/chats/contacto (plano §2.2). */
type LeadContacto = {
  id: number;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  empresa: string | null;
  instagram: string | null;
  etapaKey: string | null;
  etapaLabel: string | null;
  setter: string | null;
  closer: string | null;
  origen: string | null;
  createdAt: string | null;
  etiquetas: { nombre: string; color: string | null }[];
};
type RespContacto = { ok: true; lead: LeadContacto } | { ok: false; error?: string };
type RespHilo = { ok: true; mensajes: MensajeChat[] } | { ok: false; error?: string };

/**
 * Los contactos ya leídos: reabrir el drawer es instantáneo y la lectura corre igual por detrás.
 * ⚠️ La clave lleva el WORKSPACE (AGENTS.md: «una caché en memoria lleva el ws»): el lead 12 de un
 * cliente no es el lead 12 de otro, y el super admin los abre en pestañas de la misma app.
 */
const cacheContacto = new Map<string, LeadContacto>();

type Leida<T> = { estado: 'cargando' } | { estado: 'ok'; dato: T } | { estado: 'error'; error: string };

export function PanelContacto({
  ws, chat, abierto, pestana, onPestana, onCerrar, etapas, equipo, version, onAbrirFicha, onCambio,
}: {
  ws: number | null;
  chat: ChatResumen | null;
  abierto: boolean;
  pestana: PestanaDrawer;
  onPestana: (p: PestanaDrawer) => void;
  onCerrar: () => void;
  etapas: EtapaChat[];
  equipo: { nombre: string; foto_url: string | null }[];
  /** Sube cada vez que algo cambió (un cierre, un envío, la ficha): el drawer vuelve a leer. */
  version: number;
  onAbrirFicha: (leadId: number) => void;
  onCambio: () => void;
}) {
  // Sin chat elegido, el panel no se dibuja (recorrido visual del 30/10/2026, CH2): el centro ya dice «Elige un chat de la
  // lista.», y dos paneles vacíos diciendo lo mismo se leían como una pantalla rota. Se vuelve a abrir con el chat.
  if (!abierto || !chat) return null;
  return (
    <aside className="rio-drawer" aria-label={pestana === 'contacto' ? 'Contacto' : 'Actividad'}>
      <header className="rio-cab">
        <div className="rio-pestanas" role="tablist">
          <button type="button" role="tab" className="rio-pestana" aria-selected={pestana === 'contacto'} onClick={() => onPestana('contacto')}>Contacto</button>
          <button type="button" role="tab" className="rio-pestana" aria-selected={pestana === 'actividad'} onClick={() => onPestana('actividad')}>Actividad</button>
        </div>
        <button type="button" className="rio-icono-btn" onClick={onCerrar} title="Cerrar panel" aria-label="Cerrar panel"><PanelRightClose size={20} strokeWidth={1.5} /></button>
      </header>
      {pestana === 'contacto' ? (
        <Contacto key={chat.clave} ws={ws} chat={chat} etapas={etapas} version={version} onAbrirFicha={onAbrirFicha} />
      ) : (
        <Actividad key={chat.clave} ws={ws} chat={chat} equipo={equipo} version={version} onCambio={onCambio} />
      )}
    </aside>
  );
}

// ── Contacto ─────────────────────────────────────────────────────────────────────────────────

function Contacto({ ws, chat, etapas, version, onAbrirFicha }: {
  ws: number | null;
  chat: ChatResumen;
  etapas: EtapaChat[];
  version: number;
  onAbrirFicha: (leadId: number) => void;
}) {
  const leadId = chat.leadId;
  const claveCache = `${ws ?? 0}:${leadId ?? 0}`;
  const [lectura, setLectura] = useState<Leida<LeadContacto>>(() => {
    const c = leadId != null ? cacheContacto.get(claveCache) : undefined;
    return c ? { estado: 'ok', dato: c } : { estado: 'cargando' };
  });
  const [verCanales, setVerCanales] = useState(false);
  const pedido = useRef(0);

  useEffect(() => {
    if (leadId == null) return;
    const id = ++pedido.current;
    void (async () => {
      try {
        const r = await fetch(`/api/chats/contacto?leadId=${leadId}`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
        const j = (await r.json().catch(() => null)) as RespContacto | null;
        if (id !== pedido.current) return;
        if (r.ok && j && j.ok) {
          cacheContacto.set(claveCache, j.lead);
          setLectura({ estado: 'ok', dato: j.lead });
        } else {
          // «No pude leer» NO borra lo que ya se veía: con la caché, el dato viejo se queda.
          const error = (j && !j.ok && j.error) || `Error ${r.status}`;
          setLectura((l) => (l.estado === 'ok' ? l : { estado: 'error', error }));
        }
      } catch (e) {
        if (id === pedido.current) setLectura((l) => (l.estado === 'ok' ? l : { estado: 'error', error: e instanceof Error ? e.message : 'Sin conexión' }));
      }
    })();
  }, [leadId, claveCache, version]);

  const lead = lectura.estado === 'ok' ? lectura.dato : null;
  const colorEtapa = (k: string | null) => (k ? etapas.find((e) => e.key === k)?.color ?? null : null);
  const destino = chat.canales.find((i) => i.destino)?.destino ?? null;

  return (
    <>
      <div className="rio-drawer-cuerpo">
        <div className="rio-contacto-cab">
          <AvatarRio ws={ws} nombre={chat.nombre} size={40} tel={chat.avatarTel} />
          <div style={{ minWidth: 0 }}>
            <div className="rio-contacto-nombre">{chat.nombre}</div>
            <div className="rio-contacto-id">{leadId != null ? `ID: ${leadId}` : destino ?? ''}</div>
          </div>
        </div>

        {/* «Canales»: las insignias apiladas; al tocar, por dónde se le puede escribir y si se puede. */}
        <button type="button" className="rio-canales-fila" aria-expanded={verCanales} onClick={() => setVerCanales((v) => !v)}>
          <span className="rio-canales-pila">
            {chat.canales.slice(0, 4).map((i) => <InsigniaCanal key={`${i.canal}|${i.cuenta ?? ''}|${i.ref}`} canal={i.canal} size={20} />)}
          </span>
          <span className="rio-canales-label">Canales</span>
        </button>
        {verCanales && (
          <div className="rio-canales-lista">
            {chat.canales.map((i) => (
              <div key={`${i.canal}|${i.cuenta ?? ''}|${i.ref}`} className="rio-canal-item">
                <IconoCanal canal={i.canal} size={16} />
                <span className="rio-canal-item-texto" title={rotuloIdentidad(i)}>{rotuloIdentidad(i)}</span>
                <span className="rio-canal-item-estado" data-ok={i.puedeEscribir && !i.bloqueado ? 'true' : undefined}>
                  {i.bloqueado ? 'Bloqueado' : i.puedeEscribir ? 'Activo' : (i.motivoNoEscribir ?? 'Inactivo')}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="rio-separador" />

        {leadId == null ? (
          <SinLead chat={chat} />
        ) : (
          <>
            <div className="rio-bloque-cab">
              <span className="rio-bloque-titulo">Datos</span>
              <button type="button" className="rio-link" onClick={() => onAbrirFicha(leadId)}>Abrir ficha <ExternalLink size={14} /></button>
            </div>
            {lectura.estado === 'cargando' && <div className="rio-vacio" style={{ flex: 'none' }}><LoaderCircle size={18} className="rio-girando" aria-label="Cargando" /></div>}
            {lectura.estado === 'error' && <div className="rio-aviso-falla" data-tono="error" style={{ margin: 0 }}>No pude leer el contacto.</div>}
            {lead && (
              <div className="rio-campos">
                <Campo label="Teléfono" valor={lead.telefono} vacio="Sin teléfono" />
                <Campo label="Email" valor={lead.email} vacio="Sin email" />
                <Campo label="Empresa" valor={lead.empresa} vacio="Sin empresa" />
                <Campo label="Instagram" valor={lead.instagram} vacio="Sin Instagram" />
                <Campo label="Etapa" vacio="Sin etapa" valor={lead.etapaLabel}
                  antes={colorEtapa(lead.etapaKey) ? <span className="rio-chip-punto" style={{ background: colorEtapa(lead.etapaKey) ?? undefined, marginRight: 6, display: 'inline-block' }} /> : null} />
                <Campo label="Asignado" valor={lead.setter} vacio="Sin asignar" />
                <Campo label="Closer" valor={lead.closer} vacio="Sin closer" />
                <Campo label="Origen" valor={lead.origen} vacio="Sin origen" />
                <Campo label="Creado" valor={fechaLegible(lead.createdAt)} vacio="Sin fecha" />
              </div>
            )}
          </>
        )}
      </div>
      {leadId != null && (
        <div className="rio-drawer-pie">
          <div className="rio-bloque-cab">
            <span className="rio-bloque-titulo">Etiquetas</span>
            {/* Las etiquetas se ponen en la ficha (el mismo lugar que en el CRM): el «+» lleva ahí. */}
            <button type="button" className="rio-btn-borde" onClick={() => onAbrirFicha(leadId)} title="Agregar etiqueta" aria-label="Agregar etiqueta"><Plus size={14} /></button>
          </div>
          {lead && lead.etiquetas.length > 0 && (
            <div className="rio-etiquetas">
              {lead.etiquetas.map((t) => (
                <span key={t.nombre} className="rio-etiqueta">
                  {t.color && <span className="rio-chip-punto" style={{ background: t.color }} />}
                  {t.nombre}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Campo({ label, valor, vacio, antes }: { label: string; valor: string | null | undefined; vacio: string; antes?: ReactNode }) {
  const v = (valor ?? '').trim();
  return (
    <div className="rio-campo">
      <span className="rio-campo-label">{label}</span>
      <span className="rio-campo-valor" data-vacio={v ? undefined : 'true'}>{v ? <>{antes}{v}</> : vacio}</span>
    </div>
  );
}

/** «12 dic 2025, 3:06 p. m.» (o «Hoy, …»): la fecha de un dato, con la de la ventana. */
function fechaLegible(iso: string | null | undefined): string | null {
  const d = fechaDe(iso);
  return d ? `${etiquetaDia(d, new Date())}, ${horaCorta(d)}` : null;
}

/** Un contacto que todavía no es lead: lo que se sabe del canal. Agregarlo es de la cabecera del chat. */
function SinLead({ chat }: { chat: ChatResumen }) {
  return (
    <div className="rio-campos">
      <div className="rio-bloque-cab"><span className="rio-bloque-titulo">Datos</span></div>
      {chat.canales.map((i) => (
        <div key={`${i.canal}|${i.cuenta ?? ''}|${i.ref}`} className="rio-campo">
          <span className="rio-campo-label">{i.rotulo}</span>
          <span className="rio-campo-valor" data-vacio={i.destino ? undefined : 'true'}>{i.destino ?? 'Sin dato'}</span>
        </div>
      ))}
      <span className="rio-campo-valor" data-vacio="true">Todavía no está en el CRM.</span>
    </div>
  );
}

// ── Actividad ────────────────────────────────────────────────────────────────────────────────

const ICONO_EVENTO: Record<ClaseEvento, ReactNode> = {
  cerrada: <CircleCheck size={20} strokeWidth={1.5} />,
  reabierta: <RotateCcw size={20} strokeWidth={1.5} />,
  pospuesta: <Timer size={20} strokeWidth={1.5} />,
  reanudada: <TimerOff size={20} strokeWidth={1.5} />,
  etapa: <Flag size={20} strokeWidth={1.5} />,
  asignada: <UserRoundCheck size={20} strokeWidth={1.5} />,
  'sin-asignar': <UserRoundX size={20} strokeWidth={1.5} />,
  closer: <UserRound size={20} strokeWidth={1.5} />,
  otro: <Info size={20} strokeWidth={1.5} />,
};

function Actividad({ ws, chat, equipo, version, onCambio }: {
  ws: number | null;
  chat: ChatResumen;
  equipo: { nombre: string; foto_url: string | null }[];
  version: number;
  onCambio: () => void;
}) {
  const [lectura, setLectura] = useState<Leida<MensajeChat[]>>({ estado: 'cargando' });
  const [recarga, setRecarga] = useState(0);
  const pedido = useRef(0);

  useEffect(() => {
    const id = ++pedido.current;
    void (async () => {
      try {
        const r = await fetch(`/api/chats/hilo?clave=${encodeURIComponent(chat.clave)}`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
        const j = (await r.json().catch(() => null)) as RespHilo | null;
        if (id !== pedido.current) return;
        if (r.ok && j && j.ok) setLectura({ estado: 'ok', dato: (j.mensajes ?? []).filter((m) => m.tipo !== 'mensaje') });
        else {
          const error = (j && !j.ok && j.error) || `Error ${r.status}`;
          setLectura((l) => (l.estado === 'ok' ? l : { estado: 'error', error }));
        }
      } catch (e) {
        if (id === pedido.current) setLectura((l) => (l.estado === 'ok' ? l : { estado: 'error', error: e instanceof Error ? e.message : 'Sin conexión' }));
      }
    })();
  }, [chat.clave, version, recarga]);

  // Lo más nuevo ARRIBA (respond.io, 07-activities-tab), agrupado por día con su chip.
  const dias = useMemo(() => {
    if (lectura.estado !== 'ok') return [];
    const ahora = new Date();
    const orden = [...lectura.dato].sort((a, b) => (fechaDe(b.fecha)?.getTime() ?? 0) - (fechaDe(a.fecha)?.getTime() ?? 0));
    const out: Array<{ dia: string; etiqueta: string; items: MensajeChat[] }> = [];
    for (const m of orden) {
      const d = fechaDe(m.fecha) ?? ahora;
      const k = claveDia(d);
      const ult = out[out.length - 1];
      if (ult && ult.dia === k) ult.items.push(m);
      else out.push({ dia: k, etiqueta: etiquetaDia(d, ahora), items: [m] });
    }
    return out;
  }, [lectura]);
  const fotoDe = useMemo(() => new Map(equipo.map((m) => [m.nombre, m.foto_url])), [equipo]);

  return (
    <>
      <div className="rio-drawer-cuerpo">
        {lectura.estado === 'cargando' && <div className="rio-vacio"><LoaderCircle size={18} className="rio-girando" aria-label="Cargando" /></div>}
        {lectura.estado === 'error' && (
          <div className="rio-vacio">
            <span>No pude leer la actividad.</span>
            <button type="button" className="rio-btn" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button>
          </div>
        )}
        {lectura.estado === 'ok' && !dias.length && <div className="rio-vacio">Sin actividad todavía.</div>}
        {dias.map((d) => (
          <div key={d.dia} className="rio-actividad">
            <span className="rio-chip-fecha">{d.etiqueta}</span>
            {d.items.map((m) => (m.tipo === 'comentario' ? (
              <div key={m.id} className="rio-comentario">
                <div className="rio-comentario-burbuja" title={m.autor ?? undefined}>{m.texto}</div>
                <AvatarRio ws={ws} nombre={m.autor ?? ''} size={24} foto={m.autor ? fotoDe.get(m.autor) ?? null : null} comentario />
              </div>
            ) : (
              <TarjetaEvento key={m.id} m={m} />
            )))}
          </div>
        ))}
      </div>
      {chat.leadId != null ? (
        <div className="rio-drawer-pie">
          <NotaRapida leadId={chat.leadId} onEnviada={() => { setRecarga((n) => n + 1); onCambio(); }} />
        </div>
      ) : (
        <div className="rio-drawer-pie"><span className="rio-contacto-id">Agrégalo al CRM para comentar.</span></div>
      )}
    </>
  );
}

function TarjetaEvento({ m }: { m: MensajeChat }) {
  const texto = m.partes?.length ? m.partes.map((p) => p.t).join('') : (m.texto ?? '');
  const { clase, titulo } = claseDeEvento(texto);
  const d = fechaDe(m.fecha);
  return (
    <div className="rio-evento">
      <div className="rio-evento-cab">{ICONO_EVENTO[clase]}<span>{titulo}</span></div>
      <div className="rio-separador" />
      <div className="rio-evento-cuerpo">
        {m.partes?.length
          ? m.partes.map((p, i) => (p.b ? <span key={i} className="rio-evento-cuerpo-b">{p.t}</span> : <span key={i}>{p.t}</span>))
          : texto}
      </div>
      {d && <span className="rio-evento-fecha">{`${etiquetaDia(d, new Date())}, ${horaCorta(d)}`}</span>}
    </div>
  );
}

/** El composer de comentarios del drawer: una nota del lead (la misma del CRM), «Solo lo ve tu equipo». */
function NotaRapida({ leadId, onEnviada }: { leadId: number; onEnviada: () => void }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true); setError(null);
    const r = await postJson<{ ok: boolean; error?: string }>('/api/chats/comentario', { leadId, texto: t });
    setEnviando(false);
    if (!r.ok) { setError(r.error ?? 'No se pudo comentar'); return; }
    setTexto('');
    onEnviada();
  };
  return (
    // `data-esquina-ocupada`: el «Comentar» queda en el rincón de abajo a la derecha (al lado del rail),
    // donde pinta la esquina de los avisos (AGENTS.md); con la marca, la esquina sube y no lo tapa.
    <div className="rio-nota" data-esquina-ocupada="">
      <textarea className="rio-nota-texto" rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Solo lo ve tu equipo"
        aria-label="Agregar comentario"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }} />
      <div className="rio-nota-barra">
        {error && <span role="status" style={{ flex: 1, fontSize: 12, color: 'var(--rio-danger)' }} title={error}>No se pudo comentar</span>}
        <button type="button" className="rio-nota-enviar" disabled={!texto.trim() || enviando} onClick={() => void enviar()} title="Comentar" aria-label="Comentar">
          <SendHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
