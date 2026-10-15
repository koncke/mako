'use client';

// =============================================================================
// VentanaChat — la ventana del chat de la tab Chats: cabecera + hilo + composer (copia de respond.io)
// =============================================================================
// docs/diseno-chats.md §3 (el contrato con ChatsApp son las props de abajo, al pie de la letra);
// relevamiento respondio.md §1.3 y §1.8 (capturas 07, 10, 11, 13, 41, 43, 45, a-header):
//   · CABECERA de 44: avatar de 28 + nombre 14/600 (+ «Pospuesta hasta hoy, 6:15 p. m.» si aplica); el
//     split de ETAPA («Elegir etapa» abre la lista, la flecha pasa a la siguiente); a la derecha el
//     ASIGNADO (avatar 20 + nombre 12/600 + chevron: buscador, «Quitar asignación», el equipo y MaKo),
//     POSPONER (el reloj: «Posponer hasta» con la fecha de cada opción), CERRAR (check + chevron que abre
//     «Cerrar con nota») / REABRIR / REANUDAR, «⋯» y el botón del panel del contacto.
//   · el HILO (Hilo.tsx) se relee cada 8 s con la pestaña visible, con corte a los 15 s.
//   · el COMPOSER (Composer.tsx), montado con `key` por conversación.
//
// Lo que NO se copia de respond.io, y por qué: buscar en la conversación (v2), llamar (no hay canal de
// voz), colaboradores (v2), la categoría de la nota de cierre (MaKo no tiene categorías de
// conversación) y «Elegir fecha y hora» al posponer (v2: las siete opciones cubren lo que se mide).
// La IA de respond.io es violeta; acá es MaKo, con su dorado (`--mako`).
//
// ⚠️ ASIGNADO = `leads.setter` (docs/diseno-chats.md §6.2): el mismo dato que ve el CRM. Un contacto
//    sin lead no se asigna ni se comenta: primero «Agregar al CRM», que cambia la clave de la
//    conversación a `lead:<id>` (`onClaveCambio`).
// ⚠️ LO QUE SE ACABA DE CAMBIAR SE VE YA (`parche`), y la lectura que lo pisa es la primera que
//    EMPEZÓ después del cambio: una lectura del sondeo que salió antes de cerrar trae «abierta», y
//    aplicarla haría parpadear el botón de vuelta a «Cerrar» durante 8 s.
// ⚠️ «NO PUDE LEER» ES UN TERCER ESTADO, NUNCA «NO HAY MENSAJES»: sin nada leído, el hilo dice que no
//    pudo y ofrece Reintentar; con algo ya leído, una franja dice que no se pudo actualizar.
// ⚠️ LEÍDO: al abrir y cada vez que entra un mensaje del contacto con el chat abierto y la pestaña a la
//    vista (POST /api/chats/estado `leido`, por persona en el servidor). Con la pestaña escondida no:
//    nadie lo vio.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BorradorChat, ChatResumen, EtapaChat, MensajeChat } from '@/lib/chats-tipos';
import type { ProductoParaAlta } from '@/lib/lead-funnel-reglas';
import { crearLeadDesdeWhatsappAction } from '@/app/crm/actions';
import { BotonAgregarAlCrm } from '@/app/whatsapp/_shared/BotonAgregarAlCrm';
import { useConfirm } from '@/app/_ui';
import { useNotifications } from '@/app/_components/NotificationsProvider';
import Composer from './Composer';
import { Hilo } from './Hilo';
import { AvatarRio, AvisoVentana, Ico, ItemMenu, postJson, useAfuera, useAvisoRio } from './ventana-piezas';
import { candidatosAsignar, fechaOpcion, opcionesPosponer, siguienteEtapa, textoFallas, textoHasta } from './ventana-reglas';
import './chats-ventana.css';

/** El tipo de los productos del alta al CRM: el mismo que pide `BotonAgregarAlCrm`. */
export type ProductoAlta = ProductoParaAlta;

export type VentanaChatProps = {
  ws: number | null;
  chat: ChatResumen;
  yo: { id: number; nombre: string };
  equipo: { nombre: string; foto_url: string | null }[];
  etapas: EtapaChat[];
  /**
   * El mismo tipo que pide BotonAgregarAlCrm. `null` = no se pudieron leer (decide el servidor: con 2+
   * pide elegir), que NO es «hay uno» (extensión compatible del contrato del plano: acepta también null).
   */
  productos: ProductoAlta[] | null;
  esAdmin: boolean;
  drawerAbierto: boolean;
  onToggleDrawer: () => void;
  /** Algo cambió (envío, cierre, asignación, etapa): la lista se vuelve a leer. */
  onCambio: () => void;
  onAbrirFicha: (leadId: number) => void;
  /** La conversación cambió de clave (se agregó al CRM: pasa a lead:<id>). */
  onClaveCambio: (nueva: string) => void;
};

/** `fallas`: las fuentes del hilo que no se pudieron leer (extensión del §2.2 que escribió DATOS). */
type HiloLeido = { chat: ChatResumen | null; mensajes: MensajeChat[]; borradores: BorradorChat[]; fallas: string[] };
/** Un mensaje optimista. `confirmadoEn`: el número de la última lectura que había empezado cuando salió. */
type Pendiente = { m: MensajeChat; confirmadoEn: number | null };
type Menu = 'etapa' | 'asignar' | 'posponer' | 'cerrar' | 'mas' | null;

/** Cada cuánto se relee el hilo (con la pestaña a la vista), y cuándo se corta una lectura colgada. */
const SONDEO_MS = 8_000;
const CORTE_MS = 15_000;

const ERROR_ESTADO = { cerrar: 'No se pudo cerrar', reabrir: 'No se pudo reabrir', posponer: 'No se pudo posponer', reanudar: 'No se pudo reanudar' } as const;
const OK_ESTADO = { cerrar: 'Conversación cerrada', reabrir: 'Conversación reabierta', posponer: 'Conversación pospuesta', reanudar: 'Conversación reanudada' } as const;

export function VentanaChat({
  ws, chat: chatLista, yo, equipo, etapas, productos, drawerAbierto, onToggleDrawer, onCambio, onAbrirFicha, onClaveCambio,
}: VentanaChatProps) {
  const clave = chatLista.clave;
  const aviso = useAvisoRio();
  const { confirm, confirmNode } = useConfirm();

  // ── La lectura del hilo ──
  const [hilo, setHilo] = useState<HiloLeido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [parche, setParche] = useState<{ datos: Partial<ChatResumen>; desde: number } | null>(null);
  const [bajar, setBajar] = useState(0);
  const pedidos = useRef(0);
  const aplicado = useRef(0);
  const enVuelo = useRef(false);
  const otraVez = useRef(false);
  const vivo = useRef(true);
  const cargarRef = useRef<() => Promise<void>>(async () => {});
  // La lectura avisa un cambio de clave UNA vez (el aviso remonta la ventana con la clave nueva), y por
  // ref: con el callback en las dependencias de `cargar`, cada render de ChatsApp reiniciaría el sondeo.
  const claveCambioRef = useRef(onClaveCambio);
  useEffect(() => { claveCambioRef.current = onClaveCambio; }, [onClaveCambio]);
  const claveAvisada = useRef(false);

  const cargar = useCallback(async () => {
    // Una lectura a la vez. La que se pide mientras otra viaja (después de enviar) se hace al terminar:
    // tiene que EMPEZAR después del envío para traerlo.
    if (enVuelo.current) { otraVez.current = true; return; }
    enVuelo.current = true;
    const n = ++pedidos.current;
    try {
      const r = await fetch(`/api/chats/hilo?clave=${encodeURIComponent(clave)}`, { cache: 'no-store', signal: AbortSignal.timeout(CORTE_MS) });
      const j = (await r.json().catch(() => null)) as ({ ok?: boolean; error?: string } & Partial<HiloLeido>) | null;
      if (!vivo.current || n < aplicado.current) return;
      if (!r.ok || !j?.ok) { setErrorLectura('No pude leer la conversación.'); return; }
      aplicado.current = n;
      const leido: HiloLeido = {
        chat: j.chat ?? null,
        mensajes: Array.isArray(j.mensajes) ? j.mensajes : [],
        borradores: Array.isArray(j.borradores) ? j.borradores : [],
        fallas: Array.isArray(j.fallas) ? j.fallas.filter((f): f is string => typeof f === 'string') : [],
      };
      // ⚠️ LA CLAVE PUEDE VOLVER DISTINTA (route.ts del hilo): una persona de Instagram o un teléfono que ya
      //    tienen lead vuelven como `lead:<id>`. Se le avisa a ChatsApp, que remonta la ventana con esa
      //    clave; acá se sigue dibujando con la de la lista (ver `chat` más abajo) hasta el remontaje.
      if (leido.chat?.clave && leido.chat.clave !== clave && !claveAvisada.current) {
        claveAvisada.current = true;
        claveCambioRef.current(leido.chat.clave);
      }
      setHilo(leido);
      setErrorLectura(null);
      const ids = new Set(leido.mensajes.map((m) => m.id));
      // Un optimista se va cuando llega su mensaje real, o cuando una lectura que empezó DESPUÉS de que
      // salió ya no lo trae con su id provisorio (el real viene con el suyo).
      setPendientes((ps) => ps.filter((p) => !ids.has(p.m.id) && (p.confirmadoEn == null || n <= p.confirmadoEn)));
      setParche((p) => (p && n > p.desde ? null : p));
    } catch {
      if (vivo.current) setErrorLectura('No pude leer la conversación.');
    } finally {
      enVuelo.current = false;
      if (vivo.current) setCargando(false);
      if (otraVez.current && vivo.current) { otraVez.current = false; void cargarRef.current(); }
    }
  }, [clave]);
  useEffect(() => { cargarRef.current = cargar; }, [cargar]);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void cargar(); }, SONDEO_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') void cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { vivo.current = false; clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [cargar]);

  // ── Leído ──
  const marcarLeido = useCallback(() => { void postJson('/api/chats/estado', { clave, accion: 'leido' }); }, [clave]);
  useEffect(() => { marcarLeido(); }, [marcarLeido]);
  // El contador del menú (Chats y WhatsApp) y el aviso de mensaje nuevo NO leen `chat_leidos`: los
  // lleva el NotificationsProvider con su marca del navegador, y sólo baja si alguien le dice qué
  // chat está abierto — hasta acá lo hacía únicamente la bandeja de /whatsapp, así que leer en Chats
  // dejaba el número arriba y el aviso saltaba por el chat que tenías delante. Se le pasa la
  // identidad de WhatsApp más reciente del contacto (`canales` viene ordenado por actividad), que
  // es el mismo jid representante que usa su sondeo. Al desmontar (cambiar de chat) se libera.
  const { setOpenChatNoOficial } = useNotifications();
  const abiertoRef = useRef(setOpenChatNoOficial);
  abiertoRef.current = setOpenChatNoOficial;
  const jidWhatsapp = chatLista.canales.find((i) => i.canal === 'whatsapp')?.ref ?? null;
  useEffect(() => { abiertoRef.current(jidWhatsapp); }, [jidWhatsapp]);
  useEffect(() => () => abiertoRef.current(null), []);
  const ultimoEntrante = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!hilo) return;
    let id: string | null = null;
    for (let i = hilo.mensajes.length - 1; i >= 0; i--) {
      const m = hilo.mensajes[i];
      if (m.tipo === 'mensaje' && !m.saliente) { id = m.id; break; }
    }
    if (ultimoEntrante.current === undefined) { ultimoEntrante.current = id; return; } // ya se marcó al abrir
    if (id && id !== ultimoEntrante.current && document.visibilityState === 'visible') {
      ultimoEntrante.current = id;
      marcarLeido();
    }
  }, [hilo, marcarLeido]);

  // ── Lo que se dibuja: lo leído + lo que se acaba de cambiar + lo que está saliendo ──
  const base = hilo?.chat ?? chatLista;
  // La clave es SIEMPRE la de la lista: es la del montaje (`key`) y la del borrador del texto. Si la
  // lectura la devolviera distinta, el composer se remontaría y el borrador quedaría partido en dos.
  const chat: ChatResumen = { ...base, ...(parche?.datos ?? {}), clave };
  const mensajes = useMemo(() => {
    const reales = hilo?.mensajes ?? [];
    if (!pendientes.length) return reales;
    const ids = new Set(reales.map((m) => m.id));
    return [...reales, ...pendientes.map((p) => p.m).filter((m) => !ids.has(m.id))];
  }, [hilo, pendientes]);
  const parchar = (datos: Partial<ChatResumen>) => setParche((p) => ({ datos: { ...(p?.datos ?? {}), ...datos }, desde: pedidos.current }));

  const onPendiente = (m: MensajeChat) => { setPendientes((ps) => [...ps, { m, confirmadoEn: null }]); setBajar((b) => b + 1); };
  const onConfirmado = (tmp: string, real: MensajeChat | null) =>
    setPendientes((ps) => ps.map((p) => (p.m.id === tmp ? { m: real ?? { ...p.m, status: 'sent' }, confirmadoEn: pedidos.current } : p)));
  const onFallido = (tmp: string) => setPendientes((ps) => ps.filter((p) => p.m.id !== tmp));
  const onEnviado = () => { void cargar(); onCambio(); };

  // ── Menús ──
  const [menu, setMenu] = useState<Menu>(null);
  const cerrarMenu = () => setMenu(null);
  const alternar = (m: Exclude<Menu, null>) => setMenu((a) => (a === m ? null : m));
  const cajaEtapa = useAfuera<HTMLDivElement>(menu === 'etapa', cerrarMenu);
  const cajaAsignar = useAfuera<HTMLDivElement>(menu === 'asignar', cerrarMenu);
  const cajaPosponer = useAfuera<HTMLDivElement>(menu === 'posponer', cerrarMenu);
  const cajaCerrar = useAfuera<HTMLDivElement>(menu === 'cerrar', cerrarMenu);
  const cajaMas = useAfuera<HTMLDivElement>(menu === 'mas', cerrarMenu);
  const [ocupado, setOcupado] = useState(false);

  // ── Estado de la conversación ──
  async function cambiarEstado(accion: 'cerrar' | 'reabrir' | 'posponer' | 'reanudar', extra: { hasta?: string; nota?: string } = {}): Promise<boolean> {
    if (ocupado) return false;
    setOcupado(true);
    const j = await postJson<{ ok: boolean; error?: string }>('/api/chats/estado', { clave, accion, ...extra });
    setOcupado(false);
    if (!j.ok) { aviso.error(ERROR_ESTADO[accion], j.error); return false; }
    parchar(accion === 'cerrar' ? { estado: 'cerrada', pospuestaHasta: null }
      : accion === 'posponer' ? { estado: 'pospuesta', pospuestaHasta: extra.hasta ?? null }
        : { estado: 'abierta', pospuestaHasta: null });
    setMenu(null);
    aviso.ok(OK_ESTADO[accion]);
    void cargar();
    onCambio();
    return true;
  }
  const [notaCierre, setNotaCierre] = useState('');
  async function cerrarConNota() {
    if (await cambiarEstado('cerrar', notaCierre.trim() ? { nota: notaCierre.trim() } : {})) setNotaCierre('');
  }

  // ── Asignar (leads.setter, el mismo camino que el CRM) ──
  const [busca, setBusca] = useState('');
  const fotoDe = (nombre: string | null) => (nombre ? equipo.find((e) => e.nombre === nombre)?.foto_url ?? null : null);
  async function asignar(setter: string | null) {
    if (!chat.leadId || ocupado) return;
    setMenu(null);
    setOcupado(true);
    const j = await postJson<{ ok: boolean; error?: string }>('/api/chats/asignar', { leadId: chat.leadId, setter });
    setOcupado(false);
    if (!j.ok) { aviso.error('No se pudo asignar', j.error); return; }
    parchar({ asignado: setter });
    aviso.ok(setter ? `Asignada a ${setter}` : 'Asignación quitada');
    void cargar();
    onCambio();
  }

  // ── Etapa (el mismo choke point que el CRM) ──
  const etapaActual = etapas.find((e) => e.key === chat.etapaKey) ?? null;
  const siguiente = siguienteEtapa(etapas, chat.etapaKey);
  async function cambiarEtapa(e: EtapaChat) {
    if (!chat.leadId || ocupado || e.key === chat.etapaKey) { setMenu(null); return; }
    setMenu(null);
    setOcupado(true);
    const j = await postJson<{ ok: boolean; error?: string; necesitaFicha?: boolean; pendientes?: string[] }>('/api/chats/etapa', { leadId: chat.leadId, etapa: e.key });
    setOcupado(false);
    // La etapa pide datos (la hora de la reunión): se completa en la ficha, que es donde se piden.
    if (j.necesitaFicha) { onAbrirFicha(chat.leadId); aviso.ok('Completa la ficha'); return; }
    if (!j.ok) { aviso.error('No se pudo cambiar', j.error); return; }
    parchar({ etapaKey: e.key, etapaLabel: e.label });
    // Guardar nunca se bloquea (el CRM mueve SIEMPRE): lo que la etapa pide y falta vuelve en
    // `pendientes`, y se dice sin frenar. El detalle va en el `title` del aviso (textos cortos).
    const faltan = Array.isArray(j.pendientes) ? j.pendientes.filter(Boolean) : [];
    if (faltan.length) aviso.ok('Etapa cambiada, faltan datos', `Falta: ${faltan.join(', ')}`);
    else aviso.ok('Etapa cambiada');
    void cargar();
    onCambio();
  }

  // ── Agregar al CRM ──
  // WhatsApp: el alta de la casa (`crearLeadDesdeWhatsappAction`, con el producto elegido); Instagram y
  // Messenger: POST /api/chats/lead (une por `lead_id`, nunca por teléfono). Con 2+ productos y ninguno
  // elegido el servidor no crea: devuelve la lista y el botón pasa a preguntar.
  const [productosAlta, setProductosAlta] = useState(productos);
  const [creandoLead, setCreandoLead] = useState(false);
  const waIdent = chat.canales.find((c) => c.canal === 'whatsapp' && !!c.telefono) ?? null;
  const socialIdent = chat.canales.find((c) => c.canal !== 'whatsapp') ?? null;
  async function agregarAlCrm(funnelId: number | null) {
    if (creandoLead || chat.leadId) return;
    setCreandoLead(true);
    try {
      let id: number | null = null;
      if (waIdent?.telefono) {
        const r = await crearLeadDesdeWhatsappAction(chat.nombre || waIdent.telefono, waIdent.telefono, funnelId);
        // Con `else` y no con un ternario: así la respuesta queda estrechada al choque y se le lee el motivo.
        if ('id' in r) id = r.id;
        else if (r.elegir) { setProductosAlta(r.elegir); aviso.ok('Elige el funnel'); return; }
        else if (r.coincidencias.length === 1) {
          // Ya estaba: con UN candidato ése ES el lead de este teléfono. Con varios no se elige el primero.
          id = r.coincidencias[0].id;
          if (r.errorAlAgregar) aviso.error('No se pudo agregar', r.errorAlAgregar);
        } else { aviso.error('No se pudo agregar', r.error); return; }
      } else if (socialIdent) {
        const j = await postJson<{ ok: boolean; leadId?: number; error?: string; elegir?: ProductoParaAlta[] }>('/api/chats/lead', { convId: Number(socialIdent.ref), funnelId });
        if (j.ok && j.leadId) id = j.leadId;
        else if (j.elegir?.length) { setProductosAlta(j.elegir); aviso.ok('Elige el funnel'); return; }
        else { aviso.error('No se pudo agregar', j.error); return; }
      } else return;
      if (!id) return;
      aviso.ok('Agregado al CRM');
      onAbrirFicha(id);
      onCambio();
      onClaveCambio(`lead:${id}`);
    } catch (e) {
      aviso.error('No se pudo agregar', e instanceof Error ? e.message : null);
    } finally { setCreandoLead(false); }
  }
  const botonAlta = <BotonAgregarAlCrm productos={productosAlta} creando={creandoLead} onAgregar={(funnelId) => void agregarAlCrm(funnelId)} />;

  // ── WhatsApp: bloquear, ocultar, sincronizar (por teléfono, para todo el negocio) ──
  async function bloquear(bloq: boolean) {
    setMenu(null);
    if (!waIdent?.telefono) return;
    if (bloq && !(await confirm(`${chat.nombre} no podrá escribirte por WhatsApp y no le llegará nada.`, { title: 'Bloquear contacto', confirmLabel: 'Bloquear' }))) return;
    const j = await postJson<{ ok: boolean; error?: string }>('/api/whatsapp/evolution/block', { telefono: waIdent.telefono, action: bloq ? 'block' : 'unblock', leadId: chat.leadId });
    if (!j.ok) { aviso.error(bloq ? 'No se pudo bloquear' : 'No se pudo desbloquear', j.error); return; }
    parchar({ bloqueado: bloq });
    aviso.ok(bloq ? 'Contacto bloqueado' : 'Contacto desbloqueado');
    void cargar();
    onCambio();
  }
  async function ocultar() {
    setMenu(null);
    if (!waIdent?.telefono) return;
    if (!(await confirm('Sale de la lista y MaKo deja de verlo. No corta los envíos.', { title: 'Ocultar chat', confirmLabel: 'Ocultar', danger: false }))) return;
    const j = await postJson<{ ok: boolean; error?: string }>('/api/whatsapp/evolution/block', { telefono: waIdent.telefono, action: 'hide', leadId: chat.leadId });
    if (!j.ok) { aviso.error('No se pudo ocultar', j.error); return; }
    aviso.ok('Chat oculto');
    onCambio();
  }
  async function sincronizar() {
    setMenu(null);
    const was = chat.canales.filter((c) => c.canal === 'whatsapp');
    if (!was.length || ocupado) return;
    setOcupado(true);
    // Cada línea por la que habló: el historial vive por línea (`linea` sólo la respeta sync-chat).
    let fallo: string | null = null;
    for (const c of was) {
      const j = await postJson<{ ok: boolean; error?: string }>('/api/whatsapp/evolution/block', { telefono: c.telefono ?? '', chat: c.ref, action: 'sync-chat', linea: c.cuenta });
      if (!j.ok) fallo = j.error ?? 'Error';
    }
    setOcupado(false);
    if (fallo) aviso.error('No se pudo sincronizar', fallo);
    else aviso.ok('Chat sincronizado');
    void cargar();
    onCambio();
  }

  // ── La cabecera ──
  const subtitulo = chat.estado === 'pospuesta' && chat.pospuestaHasta ? `Pospuesta hasta ${textoHasta(chat.pospuestaHasta, new Date()) ?? ''}` : null;
  const textoFallasHilo = textoFallas(hilo?.fallas ?? [], chat.canales);
  // Sin MaKo: /api/chats/asignar lo rechaza («MaKo se asigna solo», al pasar a una nutrición
  // automática). Si ya la tiene, MaKo se ve arriba como la asignada actual y se le puede quitar.
  const candidatos = candidatosAsignar(equipo, chat.asignado, busca);

  return (
    <div className="rio-v">
      <header className="rio-cab rio-cab-v">
        <div className="rio-cab-izq">
          <button type="button" className="rio-cab-contacto" title={chat.nombre} onClick={() => { if (!drawerAbierto) onToggleDrawer(); }}>
            <AvatarRio ws={ws} nombre={chat.nombre} tel={chat.avatarTel} size={28} />
            <span className="rio-cab-nombres">
              <span className="rio-cab-nombre">{chat.nombre}</span>
              {subtitulo && <span className="rio-cab-sub">{subtitulo}</span>}
            </span>
          </button>

          {chat.leadId ? (
            <div className="rio-ancla" ref={cajaEtapa}>
              <div className="rio-split rio-split-etapa">
                <button type="button" className="rio-split-a" onClick={() => alternar('etapa')} aria-haspopup="menu" aria-expanded={menu === 'etapa'}
                  title={chat.etapaLabel ?? 'Elegir etapa'} disabled={ocupado}>
                  {etapaActual || chat.etapaLabel
                    ? <span className="rio-etapa-punto" style={{ background: etapaActual?.color ?? 'var(--rio-text-3)' }} />
                    : <Ico n="circuloPunteado" s={16} />}
                  <span className="rio-etapa-txt">{chat.etapaLabel ?? 'Elegir etapa'}</span>
                </button>
                <button type="button" className="rio-split-b" disabled={!siguiente || ocupado} onClick={() => { if (siguiente) void cambiarEtapa(siguiente); }}
                  title={siguiente ? `Pasar a ${siguiente.label}` : 'Es la última etapa'} aria-label="Siguiente etapa"><Ico n="chevDer" s={16} /></button>
              </div>
              {menu === 'etapa' && (
                <div className="rio-menu rio-menu-izq rio-menu-etapas" role="menu">
                  {etapas.map((e) => (
                    <ItemMenu key={e.key} elegido={e.key === chat.etapaKey} icono={<span className="rio-etapa-punto" style={{ background: e.color }} />}
                      onClick={() => void cambiarEtapa(e)}>{e.label}</ItemMenu>
                  ))}
                  {!etapas.length && <div className="rio-menu-vacio">Sin etapas</div>}
                </div>
              )}
            </div>
          ) : (
            // Sin lead no hay etapa: en su lugar, el alta al CRM (lo que la habilita).
            <div className="rio-alta-crm">{botonAlta}</div>
          )}
        </div>

        <div className="rio-cab-der">
          <div className="rio-ancla" ref={cajaAsignar}>
            <button type="button" className="rio-asignado" onClick={() => { setBusca(''); alternar('asignar'); }} aria-haspopup="menu" aria-expanded={menu === 'asignar'}
              title={chat.asignado ? `Asignada a ${chat.asignado}` : 'Sin asignar'}>
              {chat.asignado
                ? <AvatarRio ws={ws} nombre={chat.asignado} foto={fotoDe(chat.asignado)} size={20} mako={chat.asignado === 'MaKo'} />
                : <span className="rio-sin-asignar"><Ico n="persona" s={14} /></span>}
              <span className="rio-asignado-nombre">{chat.asignado ?? 'Sin asignar'}</span>
              <Ico n={menu === 'asignar' ? 'chevArriba' : 'chevAbajo'} s={16} />
            </button>
            {menu === 'asignar' && (
              <div className="rio-menu rio-menu-der rio-menu-asignar" role="menu">
                {chat.leadId ? (
                  <>
                    <label className="rio-menu-buscar">
                      <Ico n="buscar" s={16} />
                      <input className="rio-menu-buscar-campo" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar persona" />
                    </label>
                    {chat.asignado && (
                      <ItemMenu elegido icono={<AvatarRio ws={ws} nombre={chat.asignado} foto={fotoDe(chat.asignado)} size={24} mako={chat.asignado === 'MaKo'} />}>{chat.asignado}</ItemMenu>
                    )}
                    {chat.asignado && (
                      <ItemMenu icono={<span className="rio-sin-asignar rio-sin-asignar-24"><Ico n="persona" s={16} /></span>} onClick={() => void asignar(null)}>Quitar asignación</ItemMenu>
                    )}
                    {candidatos.map((n) => (
                      <ItemMenu key={n} icono={<AvatarRio ws={ws} nombre={n} foto={fotoDe(n)} size={24} />} onClick={() => void asignar(n)}>{n}</ItemMenu>
                    ))}
                    {!candidatos.length && <div className="rio-menu-vacio">Sin resultados</div>}
                  </>
                ) : (
                  <div className="rio-menu-nota">
                    <span>Agrega el contacto al CRM para asignarlo.</span>
                    <button type="button" className="rio-btn" disabled={creandoLead} onClick={() => { setMenu(null); void agregarAlCrm(null); }}>Agregar al CRM</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {chat.estado === 'abierta' && (
            <div className="rio-ancla" ref={cajaPosponer}>
              <button type="button" className="rio-ico-btn" onClick={() => alternar('posponer')} title="Posponer" aria-label="Posponer" aria-haspopup="menu"
                aria-expanded={menu === 'posponer'} disabled={ocupado}><Ico n="reloj" s={20} /></button>
              {menu === 'posponer' && (
                <div className="rio-menu rio-menu-der rio-menu-posponer" role="menu">
                  <div className="rio-menu-tit">Posponer hasta</div>
                  {opcionesPosponer(new Date()).map((o) => (
                    <ItemMenu key={o.key} detalle={fechaOpcion(o.hasta)} onClick={() => void cambiarEstado('posponer', { hasta: o.hasta.toISOString() })}>{o.label}</ItemMenu>
                  ))}
                </div>
              )}
            </div>
          )}

          {chat.estado === 'abierta' ? (
            <div className="rio-ancla" ref={cajaCerrar}>
              <div className="rio-split">
                <button type="button" className="rio-split-a" disabled={ocupado} onClick={() => void cambiarEstado('cerrar')}>
                  <Ico n="checkCirculo" s={16} />Cerrar
                </button>
                <button type="button" className="rio-split-b" disabled={ocupado} onClick={() => alternar('cerrar')} title="Cerrar con nota" aria-label="Cerrar con nota"
                  aria-expanded={menu === 'cerrar'}><Ico n={menu === 'cerrar' ? 'chevArriba' : 'chevAbajo'} s={16} /></button>
              </div>
              {menu === 'cerrar' && (
                <div className="rio-pop rio-pop-cierre" role="dialog" aria-label="Nota de cierre">
                  <div className="rio-pop-tit"><span className="rio-check-lleno"><Ico n="check" s={12} /></span>Nota de cierre</div>
                  <div className="rio-pop-cuerpo">
                    <label className="rio-pop-label" htmlFor={`rio-nota-cierre-${clave}`}>Nota</label>
                    <textarea id={`rio-nota-cierre-${clave}`} className="rio-pop-campo" rows={4} autoFocus value={notaCierre}
                      onChange={(e) => setNotaCierre(e.target.value)} placeholder="Qué pasó en esta conversación" />
                  </div>
                  <div className="rio-pop-acc">
                    <button type="button" className="rio-btn-texto" onClick={cerrarMenu}>Cancelar</button>
                    <button type="button" className="rio-btn-verde" disabled={ocupado} onClick={() => void cerrarConNota()}>Cerrar conversación</button>
                  </div>
                </div>
              )}
            </div>
          ) : chat.estado === 'pospuesta' ? (
            <button type="button" className="rio-btn" disabled={ocupado} onClick={() => void cambiarEstado('reanudar')}
              title={chat.pospuestaHasta ? `Vuelve ${textoHasta(chat.pospuestaHasta, new Date()) ?? ''}` : undefined}>
              <Ico n="reloj" s={16} />Reanudar
            </button>
          ) : (
            <button type="button" className="rio-btn" disabled={ocupado} onClick={() => void cambiarEstado('reabrir')}>
              <Ico n="circulo" s={16} />Reabrir
            </button>
          )}

          <div className="rio-ancla" ref={cajaMas}>
            <button type="button" className="rio-ico-btn" onClick={() => alternar('mas')} title="Más acciones" aria-label="Más acciones" aria-haspopup="menu"
              aria-expanded={menu === 'mas'}><Ico n="mas" s={20} /></button>
            {menu === 'mas' && (
              <div className="rio-menu rio-menu-der" role="menu">
                {chat.leadId ? (
                  <ItemMenu icono={<Ico n="ficha" s={16} />} onClick={() => { setMenu(null); if (chat.leadId) onAbrirFicha(chat.leadId); }}>Abrir ficha</ItemMenu>
                ) : (
                  <ItemMenu icono={<Ico n="personaMas" s={16} />} deshabilitado={creandoLead || (!waIdent && !socialIdent)}
                    onClick={() => { setMenu(null); void agregarAlCrm(null); }}>Agregar al CRM</ItemMenu>
                )}
                {waIdent && (
                  <>
                    <ItemMenu icono={<Ico n="sincronizar" s={16} />} deshabilitado={ocupado} onClick={() => void sincronizar()}>Sincronizar chat</ItemMenu>
                    <ItemMenu icono={<Ico n="ojoTachado" s={16} />} onClick={() => void ocultar()}>Ocultar</ItemMenu>
                    <ItemMenu icono={<Ico n="prohibido" s={16} />} peligro={!chat.bloqueado} onClick={() => void bloquear(!chat.bloqueado)}>
                      {chat.bloqueado ? 'Desbloquear' : 'Bloquear'}
                    </ItemMenu>
                  </>
                )}
              </div>
            )}
          </div>

          <button type="button" className={`rio-ico-btn${drawerAbierto ? ' rio-ico-on' : ''}`} onClick={onToggleDrawer}
            title={drawerAbierto ? 'Cerrar panel' : 'Abrir panel'} aria-label={drawerAbierto ? 'Cerrar panel del contacto' : 'Abrir panel del contacto'}
            aria-pressed={drawerAbierto}><Ico n="panel" s={20} /></button>
        </div>
      </header>

      {errorLectura && hilo ? (
        <div className="rio-lectura-falla" role="status">
          <span>No pude actualizar la conversación.</span>
          <button type="button" className="rio-link" onClick={() => void cargar()}>Reintentar</button>
        </div>
      ) : textoFallasHilo ? (
        // Una fuente del hilo no se pudo leer (una línea caída, Instagram): lo que se ve está INCOMPLETO,
        // y se dice. Un hilo al que le falta un canal parece una conversación que nunca pasó por ahí.
        <div className="rio-lectura-falla" role="status">
          <span>{textoFallasHilo}</span>
          <button type="button" className="rio-link" onClick={() => void cargar()}>Reintentar</button>
        </div>
      ) : null}

      <div className="rio-cuerpo">
        {/* El aviso va abajo a la izquierda del HILO, arriba de la caja de escribir (respond.io lo pone abajo a
            la izquierda; abajo de todo taparía «Agregar comentario»). */}
        <div className="rio-hilo-caja">
          <Hilo ws={ws} chat={chat} mensajes={mensajes} equipo={equipo} cargando={cargando} error={hilo ? null : errorLectura}
            onReintentar={() => void cargar()} bajar={bajar} onCopiado={() => aviso.ok('Copiado')} />
          <AvisoVentana aviso={aviso.aviso} onCerrar={aviso.cerrar} />
        </div>
        <Composer key={chat.clave} ws={ws} chat={chat} yo={yo} equipo={equipo} mensajes={mensajes} borradores={hilo?.borradores ?? []}
          onPendiente={onPendiente} onConfirmado={onConfirmado} onFallido={onFallido} onEnviado={onEnviado}
          agregarAlCrm={botonAlta} onAviso={(t, err, d) => (err ? aviso.error(t, d) : aviso.ok(t))} />
      </div>
      {confirmNode}
    </div>
  );
}

// Las dos formas: ChatsApp la importa con nombre; el plano la pide como default.
export default VentanaChat;
