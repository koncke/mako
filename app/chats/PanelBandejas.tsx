'use client';

// =============================================================================
// PanelBandejas — el «Inbox side panel» de respond.io (214 px)
// =============================================================================
// Relevamiento respondio.md §1.1 y las capturas 02, 03 y 06. De arriba abajo:
//   · el encabezado de 44: «Bandeja» 16/600, la lupa (busca entre las bandejas) y el botón que pliega
//     el panel;
//   · las vistas fijas: Todos · Míos · Sin asignar;
//   · las secciones plegables (título 12/600 gris con su chevron): «MaKo» (Atiende MaKo · Borradores,
//     lo que en respond.io es «AI Agents»), «Canales» (cada línea de WhatsApp, Instagram y Messenger,
//     con «+» para conectar uno — sólo el admin), «Etapa» (el «Lifecycle»: punto de color y contador);
//   · el pie: «Bloqueados».
//
// EL NÚMERO, como respond.io (03-new-message-indicator): gris = conversaciones ABIERTAS; si alguna
// tiene algo sin leer, en su lugar va la PÍLDORA AZUL con cuántas (conversaciones, no mensajes). Los
// cuenta `contarBandejas` (lib/chats-reglas.ts), el mismo módulo que filtra: el número y la lista no
// pueden diferir.
//
// Lo que NO se copia: «Collaborations» e «Incoming Calls» (no hay colaboradores ni canal de voz),
// «Team Inbox» y «Custom Inbox» (vistas guardadas con filtros avanzados: v2, plano §0).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Ban, ChevronDown, ChevronUp, FilePen, Inbox, PanelLeftClose, Plus, Search, SquareUser, UserRoundMinus, X } from 'lucide-react';
import { Dropdown } from '@/app/components/Dropdown';
import { MakoLogo } from '@/app/_components/MakoBrand';
import type { CanalChat, ChatResumen, CuentaSocial, EtapaChat, LineaChat } from '@/lib/chats-tipos';
import { claveCuenta, rotuloWhatsapp, type Conteo, type ConteosBandeja, type FiltroChats, type VistaChats } from '@/lib/chats-reglas';
import { almacenLocal, guardarLocal, leerLocal } from './lista-reglas';
import { IconoCanal } from './iconos-canal';
import { portalRio } from './portal';

/** Los canales que se pueden conectar desde el «+» de «Canales». */
export type CanalConectable = CanalChat;

type Seccion = 'mako' | 'canales' | 'etapa';

/** Un renglón del panel: lo que dibuja y el filtro que pone. */
type Item = {
  id: string;
  label: string;
  icono: ReactNode;
  conteo: Conteo | null;
  actual: boolean;
  filtro: FiltroChats;
  /** Por qué se ve apagado (una línea desconectada). */
  apagado?: string;
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function PanelBandejas({ ws, conteos, filtro, onFiltro, lineas, cuentasSociales, etapas, chats, esAdmin, onConectar, onColapsar }: {
  ws: number | null;
  conteos: ConteosBandeja;
  filtro: FiltroChats;
  onFiltro: (f: FiltroChats) => void;
  lineas: LineaChat[];
  cuentasSociales: CuentaSocial[];
  etapas: EtapaChat[];
  /** Para saber qué canales tienen conversaciones aunque su cuenta no se haya podido leer. */
  chats: ChatResumen[];
  esAdmin: boolean;
  onConectar: (canal: CanalConectable) => void;
  onColapsar: () => void;
}) {
  // ── Secciones plegadas (comodidad por persona, con el ws en la clave) ──────────────────────
  const [plegadas, setPlegadas] = useState<Record<Seccion, boolean>>({ mako: false, canales: false, etapa: false });
  useEffect(() => {
    try {
      const j = JSON.parse(leerLocal(almacenLocal(), ws, 'secciones') ?? 'null') as Partial<Record<Seccion, unknown>> | null;
      if (j && typeof j === 'object') setPlegadas({ mako: j.mako === true, canales: j.canales === true, etapa: j.etapa === true });
    } catch { /* guardado roto: todas abiertas */ }
  }, [ws]);
  const plegar = (s: Seccion) => {
    const nuevas = { ...plegadas, [s]: !plegadas[s] };
    setPlegadas(nuevas);
    guardarLocal(almacenLocal(), ws, 'secciones', JSON.stringify(nuevas));
  };

  // ── Buscar entre las bandejas (respond.io: «Search inboxes») ───────────────────────────────
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState('');
  const pasa = (label: string) => !q.trim() || norm(label).includes(norm(q.trim()));

  // ── Los renglones ──────────────────────────────────────────────────────────────────────────
  const limpio = (f: Partial<FiltroChats>): FiltroChats => ({ ...filtro, vista: 'todos', canal: null, cuenta: null, etapa: null, ...f });
  const sinOtros = !filtro.canal && !filtro.etapa;
  const vista = (id: VistaChats, label: string, icono: ReactNode, conteo: Conteo): Item => ({
    id, label, icono, conteo, actual: filtro.vista === id && sinOtros, filtro: limpio({ vista: id }),
  });

  const fijas: Item[] = [
    vista('todos', 'Todos', <Inbox size={18} strokeWidth={1.75} />, conteos.todos),
    vista('mios', 'Míos', <SquareUser size={18} strokeWidth={1.75} />, conteos.mios),
    vista('sin-asignar', 'Sin asignar', <UserRoundMinus size={18} strokeWidth={1.75} />, conteos.sinAsignar),
  ];
  const mako: Item[] = [
    vista('mako', 'Atiende MaKo', <MakoLogo size={16} animate={false} />, conteos.mako),
    vista('borradores', 'Borradores', <FilePen size={18} strokeWidth={1.75} />, conteos.borradores),
  ];

  const canales = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const conCanal = (canal: CanalChat, cuenta: string | null, label: string, apagado?: string): Item => ({
      id: `canal:${canal}:${cuenta ?? ''}`,
      label,
      icono: <IconoCanal canal={canal} size={16} />,
      conteo: cuenta == null ? conteos.porCanal[canal] : conteos.porCuenta[claveCuenta(canal, cuenta)] ?? { abiertas: 0, nuevos: 0 },
      actual: filtro.vista === 'todos' && !filtro.etapa && filtro.canal === canal && filtro.cuenta === cuenta,
      filtro: { ...filtro, vista: 'todos', canal, cuenta, etapa: null },
      apagado,
    });
    for (const l of lineas) {
      out.push(conCanal('whatsapp', l.linea, rotuloWhatsapp(l.rotulo, lineas.length > 1), l.estado === 'conectado' ? undefined : 'Desconectada'));
    }
    for (const canal of ['instagram', 'messenger'] as const) {
      const suyas = cuentasSociales.filter((c) => c.canal === canal);
      if (suyas.length) {
        for (const c of suyas) out.push(conCanal(canal, c.cuenta, suyas.length > 1 ? c.rotulo : (canal === 'instagram' ? 'Instagram' : 'Messenger')));
      } else if (chats.some((c) => c.canales.some((i) => i.canal === canal))) {
        // Hay conversaciones de ese canal y su cuenta no se pudo leer: el canal entero, sin cuenta.
        out.push(conCanal(canal, null, canal === 'instagram' ? 'Instagram' : 'Messenger'));
      }
    }
    return out;
  }, [lineas, cuentasSociales, chats, conteos, filtro]);

  const porEtapa: Item[] = etapas.map((e) => ({
    id: `etapa:${e.key}`,
    label: e.label,
    icono: <span className="rio-punto-etapa" style={{ background: e.color }} />,
    conteo: conteos.porEtapa[e.key] ?? null,
    actual: filtro.vista === 'todos' && !filtro.canal && filtro.etapa === e.key,
    filtro: limpio({ etapa: e.key }),
  }));

  const bloqueados: Item = {
    id: 'bloqueados', label: 'Bloqueados', icono: <Ban size={18} strokeWidth={1.75} />,
    // En «Bloqueados» el número es el total (no tienen estado que importe), y nunca va en azul.
    conteo: { abiertas: conteos.bloqueados.abiertas, nuevos: 0 },
    actual: filtro.vista === 'bloqueados' && sinOtros, filtro: limpio({ vista: 'bloqueados' }),
  };

  const renglon = (it: Item) => (
    <button key={it.id} type="button" className="rio-item" aria-current={it.actual ? 'true' : undefined}
      data-apagado={it.apagado ? 'true' : undefined} title={it.apagado ? `${it.label} · ${it.apagado}` : undefined}
      onClick={() => onFiltro(it.filtro)}>
      <span className="rio-item-icono">{it.icono}</span>
      <span className="rio-item-label">{it.label}</span>
      <Contador conteo={it.conteo} />
    </button>
  );

  const seccion = (s: Seccion, titulo: string, items: Item[], extra?: ReactNode) => {
    const visibles = items.filter((it) => pasa(it.label));
    // Buscando, una sección sin coincidencias no se dibuja; sin buscar, se dibuja aunque esté vacía
    // (el «+» de Canales tiene que estar a mano justo cuando no hay ninguno).
    if (q.trim() && !visibles.length) return null;
    const abierta = !plegadas[s] || !!q.trim();
    return (
      <div className="rio-seccion">
        <div className="rio-seccion-cab">
          <button type="button" className="rio-seccion-titulo" onClick={() => plegar(s)} aria-expanded={abierta}>{titulo}</button>
          {extra}
          <button type="button" className="rio-icono-btn" data-chico="true" onClick={() => plegar(s)}
            title={abierta ? 'Plegar' : 'Desplegar'} aria-label={abierta ? `Plegar ${titulo}` : `Desplegar ${titulo}`}>
            {abierta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {abierta && visibles.map(renglon)}
      </div>
    );
  };

  const masCanal = esAdmin ? (
    <Dropdown
      value=""
      resetAfterSelect
      sinFlecha
      search={false}
      portalTo={portalRio()}
      ariaLabel="Conectar un canal"
      botonLabel={<Plus size={16} />}
      menuMinAncho={180}
      options={[
        { value: 'whatsapp', label: 'WhatsApp', icono: <IconoCanal canal="whatsapp" size={18} /> },
        { value: 'instagram', label: 'Instagram', icono: <IconoCanal canal="instagram" size={18} /> },
        { value: 'messenger', label: 'Messenger', icono: <IconoCanal canal="messenger" size={18} /> },
      ]}
      onChange={(v) => { if (v === 'whatsapp' || v === 'instagram' || v === 'messenger') onConectar(v); }}
      buttonStyle={{ width: 24, height: 24, padding: 0, border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--rio-text-2)', justifyContent: 'center' }}
    />
  ) : null;

  const fijasVisibles = fijas.filter((it) => pasa(it.label));
  const nada = q.trim() && !fijasVisibles.length && ![...mako, ...canales, ...porEtapa, bloqueados].some((it) => pasa(it.label));

  return (
    <aside className="rio-bandejas" aria-label="Bandeja">
      <header className="rio-cab" data-buscando={buscando ? 'true' : undefined}>
        {buscando ? (
          <div className="rio-busca">
            <input className="rio-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar bandejas" aria-label="Buscar bandejas"
              onKeyDown={(e) => { if (e.key === 'Escape') { setBuscando(false); setQ(''); } }} />
            <button type="button" className="rio-icono-btn rio-busca-x" data-chico="true" onClick={() => { setBuscando(false); setQ(''); }} title="Cerrar búsqueda" aria-label="Cerrar búsqueda"><X size={16} /></button>
          </div>
        ) : (
          <>
            <h2 className="rio-titulo">Bandeja</h2>
            <button type="button" className="rio-icono-btn" onClick={() => setBuscando(true)} title="Buscar bandejas" aria-label="Buscar bandejas"><Search size={20} strokeWidth={1.5} /></button>
            <button type="button" className="rio-icono-btn" onClick={onColapsar} title="Ocultar bandeja" aria-label="Ocultar bandeja"><PanelLeftClose size={20} strokeWidth={1.5} /></button>
          </>
        )}
      </header>
      <nav className="rio-bandejas-cuerpo">
        {fijasVisibles.map(renglon)}
        {seccion('mako', 'MaKo', mako)}
        {seccion('canales', 'Canales', canales, masCanal)}
        {seccion('etapa', 'Etapa', porEtapa)}
        {nada && <div className="rio-lista-pie">Sin bandejas.</div>}
      </nav>
      {pasa(bloqueados.label) && <div className="rio-bandejas-pie">{renglon(bloqueados)}</div>}
    </aside>
  );
}

/** El número del renglón: la píldora azul con las que tienen algo nuevo, o el gris de las abiertas. */
function Contador({ conteo }: { conteo: Conteo | null }) {
  if (!conteo) return null;
  if (conteo.nuevos > 0) {
    return <span className="rio-pildora" title={`${conteo.nuevos} con mensajes nuevos`}>{conteo.nuevos > 99 ? '99+' : conteo.nuevos}</span>;
  }
  if (conteo.abiertas > 0) return <span className="rio-item-cuenta">{conteo.abiertas}</span>;
  return null;
}
