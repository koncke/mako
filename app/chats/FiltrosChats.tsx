'use client';

// =============================================================================
// FiltrosChats — la Bandeja de respond.io, hecha tres desplegables arriba de la lista (24/10/2026)
// =============================================================================
// docs/diseno-chats.md §8.1. Martín (por el Cerebro, 24/10): «simplifiques la interfaz de chats... Está increíblemente
// compleja, muchos botones». La Bandeja era una columna de 214 px con quince renglones (las vistas, MaKo, cada canal y
// las nueve etapas): «un filtro no es una navegación». Ahora son tres chips:
//   · «Todos»: la vista (Todos · Míos · Sin asignar · Atiende MaKo · Borradores · Bloqueados · Ocultos), Mostrar, Orden y
//     «Sólo sin responder» (lo que era la barra «Abiertas, Más recientes» + el interruptor);
//   · «Canales»: cada número de WhatsApp, Instagram, Messenger y Email; para el admin, «Conectar un canal» y
//     «Administrar <número>» (lo que era el «+» de Canales y el botón «Tu número» de la tab vieja);
//   · «Etapa»: las etapas con su punto.
// El chip dice lo elegido; uno con filtro puesto se ve azul (respond.io pinta igual la bandeja elegida).
//
// ⚠️ LOS NÚMEROS SALEN DE `contarBandejas` (lib/chats-reglas.ts), el mismo módulo que filtra: el «2 sin leer» de un
//    renglón y la lista que se ve al elegirlo no pueden diferir.
// ⚠️ «OCULTOS» NO ES UNA VISTA DEL FILTRO: lo oculto no viene en la lista (lib/chats.ts no lo lee). Es otra lista, la de
//    WhatsApp (`?ocultos=1`), con «Mostrar de nuevo»; la decide ChatsApp (`verOcultos`).

import type { CSSProperties } from 'react';
import { Mail } from 'lucide-react';
import { Dropdown, type DropdownGroup, type DropdownOption } from '@/app/components/Dropdown';
import type { CanalChat, ChatResumen, CuentaSocial, EtapaChat, LineaChat } from '@/lib/chats-tipos';
import {
  claveCuenta, rotuloWhatsapp, type Conteo, type ConteosBandeja, type FiltroChats, type MostrarChats, type OrdenChats, type VistaChats,
} from '@/lib/chats-reglas';
import { IconoCanal } from './iconos-canal';
import { portalRio } from './portal';

/** Lo que se conecta desde «Conectar un canal» (y el estado vacío). */
export type CanalConectable = CanalChat | 'email';

const VISTAS: Array<{ v: VistaChats; label: string; de: (c: ConteosBandeja) => Conteo }> = [
  { v: 'todos', label: 'Todos', de: (c) => c.todos },
  { v: 'mios', label: 'Míos', de: (c) => c.mios },
  { v: 'sin-asignar', label: 'Sin asignar', de: (c) => c.sinAsignar },
  { v: 'mako', label: 'Atiende MaKo', de: (c) => c.mako },
  { v: 'borradores', label: 'Borradores', de: (c) => c.borradores },
  { v: 'bloqueados', label: 'Bloqueados', de: (c) => ({ abiertas: c.bloqueados.abiertas, nuevos: 0 }) },
];
const MOSTRAR: Array<{ v: MostrarChats; label: string }> = [
  { v: 'abiertas', label: 'Abiertas' },
  { v: 'todas', label: 'Todas' },
  { v: 'cerradas', label: 'Cerradas' },
  { v: 'pospuestas', label: 'Pospuestas' },
];
const ORDEN: Array<{ v: OrdenChats; label: string }> = [
  { v: 'recientes', label: 'Más recientes' },
  { v: 'antiguas', label: 'Más antiguas' },
];
const OCULTOS = 'v:ocultos';
const SIN_RESPONDER = 's:1';

/** «2 sin leer» debajo del renglón: lo único que pide mirar (las abiertas ya se ven en la lista). */
const sinLeer = (c: Conteo | null | undefined): string | undefined => (c && c.nuevos > 0 ? `${c.nuevos > 99 ? '99+' : c.nuevos} sin leer` : undefined);

/** El chip: chico, redondo; con un filtro puesto, azul suave (lo elegido se ve sin abrirlo). */
const chip = (activo: boolean): CSSProperties => ({
  height: 30, padding: '0 10px', borderRadius: 999, gap: 4, fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
  border: `1px solid ${activo ? 'transparent' : 'var(--rio-border)'}`,
  background: activo ? 'var(--rio-bg-sel)' : 'var(--rio-bg)',
  color: activo ? 'var(--rio-primary)' : 'var(--rio-text)',
  maxWidth: 170,
});

export function FiltrosChats({
  filtro, onFiltro, verOcultos, onVerOcultos, conteos, lineas, cuentasSociales, etapas, chats, esAdmin, onConectar, onAdministrar,
}: {
  filtro: FiltroChats;
  onFiltro: (f: FiltroChats) => void;
  verOcultos: boolean;
  onVerOcultos: (v: boolean) => void;
  conteos: ConteosBandeja;
  lineas: LineaChat[];
  cuentasSociales: CuentaSocial[];
  etapas: EtapaChat[];
  /** Para saber qué canales tienen conversaciones aunque su cuenta no se haya podido leer. */
  chats: ChatResumen[];
  esAdmin: boolean;
  onConectar: () => void;
  onAdministrar: (l: LineaChat) => void;
}) {
  // ── «Todos»: la vista, Mostrar, Orden y «Sólo sin responder» ──
  const hayWhatsapp = lineas.length > 0;
  const grupos: DropdownGroup[] = [
    {
      title: 'Bandeja',
      options: [
        ...VISTAS.map((x) => ({ value: `v:${x.v}`, label: x.label, sub: sinLeer(x.de(conteos)) })),
        // Lo oculto es de WhatsApp (un chat personal que se sacó de la lista): sin números, no hay nada que mostrar.
        ...(hayWhatsapp ? [{ value: OCULTOS, label: 'Ocultos' }] : []),
      ],
    },
    { title: 'Mostrar', options: [...MOSTRAR.map((m) => ({ value: `m:${m.v}`, label: m.label })), { value: SIN_RESPONDER, label: 'Sólo sin responder', lineaArriba: true }] },
    { title: 'Orden', options: ORDEN.map((o) => ({ value: `o:${o.v}`, label: o.label })) },
  ];
  const marcados = [verOcultos ? OCULTOS : `v:${filtro.vista}`, `m:${filtro.mostrar}`, `o:${filtro.orden}`, ...(filtro.sinResponder ? [SIN_RESPONDER] : [])];
  const vistaLabel = verOcultos ? 'Ocultos' : VISTAS.find((x) => x.v === filtro.vista)?.label ?? 'Todos';
  const extras = [
    !verOcultos && filtro.mostrar !== 'abiertas' ? MOSTRAR.find((m) => m.v === filtro.mostrar)?.label : null,
    !verOcultos && filtro.sinResponder ? 'Sin responder' : null,
  ].filter(Boolean);
  const rotuloVista = [vistaLabel, ...extras].join(' · ');
  const vistaActiva = verOcultos || filtro.vista !== 'todos' || filtro.mostrar !== 'abiertas' || filtro.sinResponder || filtro.orden !== 'recientes';
  const elegirVista = (v: string) => {
    if (v === OCULTOS) { onVerOcultos(true); return; }
    if (v.startsWith('v:')) { onVerOcultos(false); onFiltro({ ...filtro, vista: v.slice(2) as VistaChats }); return; }
    if (v.startsWith('m:')) onFiltro({ ...filtro, mostrar: v.slice(2) as MostrarChats });
    else if (v.startsWith('o:')) onFiltro({ ...filtro, orden: v.slice(2) as OrdenChats });
    else if (v === SIN_RESPONDER) onFiltro({ ...filtro, sinResponder: !filtro.sinResponder });
  };

  // ── «Canales» ──
  const canales: Array<DropdownOption & { canal: CanalChat | null; cuenta: string | null }> = [
    { value: 'todos', label: 'Todos los canales', canal: null, cuenta: null },
  ];
  const conCanal = (canal: CanalChat, cuenta: string | null, label: string, sub?: string) => ({
    value: `${canal}:${cuenta ?? ''}`, label, canal, cuenta, icono: canal === 'email' ? <Mail size={18} strokeWidth={1.75} /> : <IconoCanal canal={canal} size={18} />,
    sub: sub ?? sinLeer(cuenta == null ? conteos.porCanal[canal] : conteos.porCuenta[claveCuenta(canal, cuenta)]),
  });
  for (const l of lineas) {
    canales.push(conCanal('whatsapp', l.linea, rotuloWhatsapp(l.rotulo, lineas.length > 1), l.estado === 'conectado' ? undefined : 'Desconectado'));
  }
  for (const canal of ['instagram', 'messenger'] as const) {
    const suyas = cuentasSociales.filter((c) => c.canal === canal);
    const nombre = canal === 'instagram' ? 'Instagram' : 'Messenger';
    if (suyas.length) for (const c of suyas) canales.push(conCanal(canal, c.cuenta, suyas.length > 1 ? c.rotulo : nombre));
    // Hay conversaciones de ese canal y su cuenta no se pudo leer: el canal entero, sin cuenta.
    else if (chats.some((c) => c.canales.some((i) => i.canal === canal))) canales.push(conCanal(canal, null, nombre));
  }
  // El email: un renglón, el canal entero (el negocio tiene un solo dominio), en cuanto haya una conversación.
  if (chats.some((c) => c.canales.some((i) => i.canal === 'email'))) canales.push(conCanal('email', null, 'Email'));
  const opcionesCanal: DropdownOption[] = [...canales];
  if (esAdmin) {
    opcionesCanal.push({ value: 'conectar', label: 'Conectar un canal', crear: true });
    for (const l of lineas) {
      opcionesCanal.push({ value: `adm:${l.linea}`, label: `Administrar ${rotuloWhatsapp(l.rotulo, lineas.length > 1)}`, sutil: true });
    }
  }
  const canalActual = canales.find((c) => c.canal === filtro.canal && c.cuenta === filtro.cuenta) ?? canales[0];
  const elegirCanal = (v: string) => {
    if (v === 'conectar') { onConectar(); return; }
    if (v.startsWith('adm:')) { const l = lineas.find((x) => x.linea === v.slice(4)); if (l) onAdministrar(l); return; }
    const c = canales.find((x) => x.value === v);
    if (c) onFiltro({ ...filtro, canal: c.canal, cuenta: c.cuenta });
  };

  // ── «Etapa» ──
  const opcionesEtapa: DropdownOption[] = [
    { value: '', label: 'Todas las etapas' },
    ...etapas.map((e) => ({ value: e.key, label: e.label, color: e.color, sub: sinLeer(conteos.porEtapa[e.key]) })),
  ];
  const etapaActual = etapas.find((e) => e.key === filtro.etapa) ?? null;

  return (
    <div className="rio-filtros" role="group" aria-label="Filtros">
      <Dropdown
        value=""
        varios={marcados}
        // Uno por grupo SIEMPRE (Bandeja, Mostrar, Orden): el marcado no se apaga, como un radio. «Sólo sin responder»
        // es el cuarto, y ése sí se apaga.
        minimo={3}
        columns={[grupos]}
        subEnColumnas
        alContenido
        search={false}
        portalTo={portalRio()}
        ariaLabel="Bandeja, mostrar y orden"
        botonLabel={<span className="rio-chip-txt">{rotuloVista}</span>}
        onChange={elegirVista}
        buttonStyle={chip(vistaActiva)}
      />
      {!verOcultos && (
        <>
          <Dropdown
            value={canalActual.value}
            options={opcionesCanal}
            search={false}
            alContenido
            portalTo={portalRio()}
            ariaLabel="Canal"
            menuMinAncho={230}
            botonLabel={<span className="rio-chip-txt">{canalActual.canal ? canalActual.label : 'Canales'}</span>}
            onChange={elegirCanal}
            buttonStyle={chip(!!canalActual.canal)}
          />
          <Dropdown
            value={filtro.etapa ?? ''}
            options={opcionesEtapa}
            search={etapas.length > 8}
            alContenido
            portalTo={portalRio()}
            ariaLabel="Etapa"
            menuMinAncho={200}
            botonLabel={<span className="rio-chip-txt">{etapaActual?.label ?? 'Etapa'}</span>}
            onChange={(v) => onFiltro({ ...filtro, etapa: v || null })}
            buttonStyle={chip(!!etapaActual)}
          />
        </>
      )}
    </div>
  );
}
