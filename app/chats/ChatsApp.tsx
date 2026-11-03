'use client';

// =============================================================================
// ChatsApp — la carcasa de la bandeja unificada
// =============================================================================
// docs/diseno-chats.md §3 y §8. Era respond.io al pie de la letra: cinco columnas (Bandeja, Lista, chat, drawer y rail).
// Desde el 24/10/2026 son DOS (Martín: «simplifiques la interfaz de chats... Está increíblemente compleja»):
//
//   ┌ Lista 340 (con los filtros arriba) ┐┌ Ventana del chat (flex) ┐  + el contacto, cerrado, al tocar el nombre
//
// Esta pieza es dueña del ESTADO: la lista (con su sondeo), la selección (en la URL), los filtros, el panel del
// contacto, la ficha del lead y conectar y administrar un canal. La ventana del chat es VentanaChat.tsx.
//
// ⚠️ LA SELECCIÓN VIVE EN LA URL (`?c=<clave>`), no en un estado suelto: un link del aviso de mensaje
//    nuevo, de la ficha del lead o de MaKo abre la conversación, y «atrás» del navegador vuelve a la
//    anterior. Los otros links profundos (`?lead=`, `?linea=&chat=`, lib/chats-links.ts) se resuelven
//    contra la lista y se reescriben a `?c=`.
// ⚠️ UN LINK QUE NO MATCHEA NO ABRE OTRA CONVERSACIÓN (plano §4): espera UNA lectura más y suelta. La
//    bandeja vieja de /whatsapp abría `convs[0]` con un `?lead=` que no encontraba: la conversación
//    de OTRA persona, con el composer listo para escribirle.
// ⚠️ EL SONDEO es de 15 s y SÓLO con la pestaña visible: la lista es cara (lee el espejo de WhatsApp
//    de cada línea, Instagram y Messenger), y una pestaña olvidada atrás no tiene a quién mostrársela.
// ⚠️ «NO PUDE LEER» ES UN TERCER ESTADO, nunca «no hay chats»: con la lista caída se sigue mostrando
//    la última que se leyó, con el aviso arriba; y `fallas` dice qué fuente no se pudo leer.

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import type { ChatResumen, CuentaSocial, EtapaChat, FunnelChat, LineaChat } from '@/lib/chats-tipos';
import { FILTRO_INICIAL, LINEA_CANAL_MAKO, claveLead, coincideBusqueda, conNombreElegido, contarBandejas, filtrarChats, type VerNombreChats, parsearClave, rotuloWhatsapp, type FiltroChats } from '@/lib/chats-reglas';
import { RUTA_CHATS, PARAM_CHATS, rutaChatsDeClave, vistaDeLink } from '@/lib/chats-links';
import type { ProductoParaAlta } from '@/lib/lead-funnel-reglas';
import {
  almacenLocal, cambiarClaveEnLista, claveDelLink, filtroRecordado, fusionarRecientes, guardarLocal, leerLinkProfundo, leerLocal, pasoDelLink,
  type LinkProfundo,
} from './lista-reglas';
import { agregarChatAlCrm } from './agregar-al-crm';
import { FuenteChats } from './fuente';
import { ID_PORTAL_RIO } from './portal';
import { FiltrosChats, type CanalConectable } from './FiltrosChats';
import { ListaChats, type AccionFila } from './ListaChats';
import { ListaOcultos } from './ListaOcultos';
import { BotonesCanales, useConectarCanal } from './ConectarCanal';
import { AdministrarWhatsApp } from './AdministrarWhatsApp';
import { Modal } from '@/app/_ui';
import { PanelContacto, type PestanaDrawer } from './PanelContacto';
import VentanaChat from './VentanaChat';
import { AvisoVentana, postJson, useAvisoRio } from './ventana-piezas';
import './chats.css';

// La ficha del lead del CRM, la misma de siempre: se baja sólo al abrirla.
const LeadEditModal = dynamic(() => import('../crm/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });
// El número de MaKo (sólo el super admin): el panel de /agencia (QR, «Cambiar número», tu número), en un modal sobre Chats.
const CanalMaKoPanel = dynamic(() => import('../agencia/CanalMaKoPanel').then((m) => m.CanalMaKoPanel), { ssr: false });

/** Lo que devuelve GET /api/chats (plano §2.2). */
type DatosLista = {
  chats: ChatResumen[];
  lineas: LineaChat[];
  cuentasSociales: CuentaSocial[];
  etapas: EtapaChat[];
  /** Los funnels con sus etapas (el filtro «Funnel», 27/10/2026). Vacío = sólo el principal. */
  funnels: FunnelChat[];
  funnelPrincipal: number | null;
  yo: { id: number; nombre: string };
  equipo: { nombre: string; foto_url: string | null }[];
  fallas: string[];
};
type RespLista = ({ ok: true } & DatosLista) | { ok: false; error?: string };
/** `fallas`: lo que el servidor no pudo leer al buscar (extensión compatible del §2.2, la trae la ruta). */
type RespBusqueda = { ok: true; chats: ChatResumen[]; fallas?: string[] } | { ok: false; error?: string };
type RespHilo = { ok: true; chat: ChatResumen | null } | { ok: false; error?: string };

/** Cada cuánto se relee la lista con la pestaña a la vista (respond.io empuja; acá se sondea). */
const SONDEO_MS = 15_000;
/**
 * CHATS SIN ESPERAR A TODO (20/10/2026, Martín en la llamada con Leila: «abrir Chats tarda mucho»). Leer la lista entera
 * eran 19 páginas del espejo de WhatsApp: 17 s en el ws1, y se repetía cada 15 s. Ahora la PRIMERA vista y el sondeo
 * leen sólo las `PAGINAS_RAPIDA` páginas más nuevas (como el teléfono) y se fusionan con lo que ya está
 * (`fusionarRecientes`); la lista ENTERA se lee una vez al abrir, después de la rápida, y cada `COMPLETA_CADA` sondeos.
 * Números en docs/hallazgos-comunicacion.md.
 */
const PAGINAS_RAPIDA = 3;
const COMPLETA_CADA = 20;
/** La espera del buscador: no pedir una búsqueda por letra. */
const ESPERA_BUSCAR_MS = 350;
/** Los canales que se conectan desde un link (`?conectar=`): el que lleva a /whatsapp sin número, y los avisos. */
const CONECTABLES: readonly CanalConectable[] = ['whatsapp', 'instagram', 'messenger', 'email'];
/** Un link que no está en la lista se reintenta enseguida (no a los 15 s del sondeo). */
const REINTENTO_LINK_MS = 2_000;

const SIN_YO = { id: 0, nombre: '' };

/** Lo que dice el toast de cada acción de la fila (3-4 palabras, AGENTS.md). */
const TEXTO_ACCION: Record<AccionFila['tipo'], { ok: string; error: string }> = {
  // Las mismas palabras que la cabecera de la ventana (VentanaChat.tsx): la misma acción no se dice de
  // dos formas según dónde se tocó.
  agregar: { ok: 'Agregado al CRM', error: 'No se pudo agregar' },
  ficha: { ok: '', error: '' },
  asignar: { ok: 'Asignación guardada', error: 'No se pudo asignar' },
};

export function ChatsApp({ ws, esAdmin, productos }: {
  /** El workspace, del server (`getWorkspaceActual`): va en las claves del navegador. */
  ws: number | null;
  esAdmin: boolean;
  /** Los productos del «+ Agregar al CRM». `null` = no se pudieron leer (decide el server). */
  productos: ProductoParaAlta[] | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const aviso = useAvisoRio();

  // ── La lista ──────────────────────────────────────────────────────────────────────────
  const [datos, setDatos] = useState<DatosLista | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  /** Cuántas lecturas buenas van: los links pendientes cuentan lecturas, no segundos. */
  const [lecturas, setLecturas] = useState(0);
  const pedidoLista = useRef(0);
  const pedidoCompleta = useRef(0);

  /** `rapida`: las páginas más nuevas, fusionadas con lo que hay. `completa`: todo, y reemplaza. */
  const cargarLista = useCallback(async (modo: 'rapida' | 'completa') => {
    // Cada modo descarta sólo SUS lecturas viejas: una completa lenta no se tira porque entró un sondeo en el medio.
    const pedido = modo === 'rapida' ? pedidoLista : pedidoCompleta;
    const id = ++pedido.current;
    try {
      const r = await fetch(modo === 'rapida' ? `/api/chats?paginas=${PAGINAS_RAPIDA}` : '/api/chats', { cache: 'no-store', signal: AbortSignal.timeout(45_000) });
      const j = (await r.json().catch(() => null)) as RespLista | null;
      // Una lectura vieja que llega después de una nueva no la pisa.
      if (id !== pedido.current) return;
      if (!r.ok || !j || !j.ok) {
        setErrorLista((j && !j.ok && j.error) || `Error ${r.status}`);
        return;
      }
      const nuevos: DatosLista = {
        chats: j.chats ?? [], lineas: j.lineas ?? [], cuentasSociales: j.cuentasSociales ?? [], etapas: j.etapas ?? [],
        funnels: j.funnels ?? [], funnelPrincipal: j.funnelPrincipal ?? null,
        yo: j.yo ?? SIN_YO, equipo: j.equipo ?? [], fallas: j.fallas ?? [],
      };
      setDatos((d) => (modo === 'rapida' && d ? { ...nuevos, chats: fusionarRecientes(d.chats, nuevos.chats) } : nuevos));
      setErrorLista(null);
      setLecturas((n) => n + 1);
    } catch (e) {
      if (id === pedido.current) setErrorLista(e instanceof Error ? e.message : 'Sin conexión');
    }
  }, []);

  /** Al abrir (y al reintentar): primero lo reciente, para dibujar ya; después todo, una vez. */
  const cargarTodo = useCallback(() => cargarLista('rapida').then(() => cargarLista('completa')), [cargarLista]);

  useEffect(() => {
    void cargarTodo();
    const visible = () => document.visibilityState === 'visible';
    let sondeos = 0;
    const t = setInterval(() => {
      if (!visible()) return;
      sondeos += 1;
      void cargarLista(sondeos % COMPLETA_CADA === 0 ? 'completa' : 'rapida');
    }, SONDEO_MS);
    // Al volver a la pestaña se lee en el acto: lo que pasó mientras no se miraba es lo primero que importa.
    const alVolver = () => { if (visible()) void cargarLista('rapida'); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [cargarLista, cargarTodo]);

  // ── Las comodidades del navegador (con el ws en la clave) ─────────────────────────────────
  const [filtro, setFiltro] = useState<FiltroChats>(FILTRO_INICIAL);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  // Cómo se ven los nombres (31/10/2026): es de quien mira, y de este navegador.
  const [verNombre, setVerNombreEstado] = useState<VerNombreChats>('agenda');
  const [pestana, setPestana] = useState<PestanaDrawer>('contacto');
  useEffect(() => {
    const st = almacenLocal();
    setFiltro((f) => ({ ...f, ...filtroRecordado(leerLocal(st, ws, 'filtro')) }));
    // EL CONTACTO ARRANCA CERRADO (24/10/2026, docs/diseno-chats.md §8.1): se abre tocando el nombre, y se recuerda si
    // alguien lo deja abierto. La clave es nueva a propósito: la de antes ('drawer') lo abría solo en toda pantalla ancha.
    setDrawerAbierto(leerLocal(st, ws, 'contacto') === '1');
    setVerNombreEstado(leerLocal(st, ws, 'nombre') === 'propio' ? 'propio' : 'agenda');
  }, [ws]);

  const cambiarFiltro = useCallback((f: FiltroChats) => {
    setFiltro(f);
    guardarLocal(almacenLocal(), ws, 'filtro', JSON.stringify({ mostrar: f.mostrar, orden: f.orden, sinResponder: f.sinResponder }));
  }, [ws]);
  // LA BANDEJA DE UN LINK (`?vista=borradores`, lib/chats-links.ts): la de «N mensajes esperando que los apruebes» de una
  // automatización (20/10/2026). Va DESPUÉS de lo recordado (los efectos corren en orden) y la URL vuelve a /chats.
  const vistaLink = vistaDeLink(sp.get(PARAM_CHATS.vista));
  useEffect(() => {
    if (!vistaLink) return;
    setFiltro((f) => ({ ...f, vista: vistaLink, canal: null, cuenta: null, etapa: null, mostrar: 'todas' }));
    router.replace(RUTA_CHATS, { scroll: false });
  }, [vistaLink, router]);
  const ponerDrawer = useCallback((abierto: boolean) => {
    setDrawerAbierto(abierto);
    guardarLocal(almacenLocal(), ws, 'contacto', abierto ? '1' : '0');
  }, [ws]);
  /** Los ocultos de WhatsApp: otra lista (ListaOcultos), no una vista del filtro. */
  const [verOcultos, setVerOcultos] = useState(false);
  const setVerNombre = useCallback((v: VerNombreChats) => {
    setVerNombreEstado(v);
    guardarLocal(almacenLocal(), ws, 'nombre', v);
  }, [ws]);
  const toggleDrawer = useCallback(() => ponerDrawer(!drawerAbierto), [drawerAbierto, ponerDrawer]);
  // Las dos pestañas van en la cabecera del panel (ya no hay rail): elegir una sólo la cambia.
  const elegirPestana = useCallback((p: PestanaDrawer) => setPestana(p), []);

  // ── La búsqueda (contra el servidor, con espera) ──────────────────────────────────────────
  const [modoBusca, setModoBusca] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [remotos, setRemotos] = useState<ChatResumen[] | null>(null);
  const [buscandoRemoto, setBuscandoRemoto] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  /** Lo que el servidor no pudo leer al buscar: «Sin resultados» con Instagram caído no es «no hay nadie». */
  const [fallasBusca, setFallasBusca] = useState<string[]>([]);
  const pedidoBusca = useRef(0);
  useEffect(() => {
    const q = buscar.trim();
    const id = ++pedidoBusca.current;
    if (q.length < 2) { setRemotos(null); setFallasBusca([]); setErrorBusqueda(null); setBuscandoRemoto(false); return; }
    setBuscandoRemoto(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/chats?buscar=${encodeURIComponent(q)}`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
        const j = (await r.json().catch(() => null)) as RespBusqueda | null;
        if (id !== pedidoBusca.current) return;
        if (!r.ok || !j || !j.ok) { setErrorBusqueda((j && !j.ok && j.error) || `Error ${r.status}`); setRemotos(null); }
        else { setRemotos(j.chats ?? []); setFallasBusca(j.fallas ?? []); setErrorBusqueda(null); }
      } catch (e) {
        if (id === pedidoBusca.current) { setErrorBusqueda(e instanceof Error ? e.message : 'Sin conexión'); setRemotos(null); }
      } finally {
        if (id === pedidoBusca.current) setBuscandoRemoto(false);
      }
    }, ESPERA_BUSCAR_MS);
    return () => clearTimeout(t);
  }, [buscar]);

  /** Los resultados: primero lo que ya bajó con la lista (al instante), después lo que trajo el servidor. */
  const resultados = useMemo<ChatResumen[] | null>(() => {
    const q = buscar.trim();
    if (!modoBusca || q.length < 2) return null;
    const locales = (datos?.chats ?? []).filter((c) => coincideBusqueda(c, q));
    const ya = new Set(locales.map((c) => c.clave));
    return [...locales, ...(remotos ?? []).filter((c) => !ya.has(c.clave))];
  }, [modoBusca, buscar, datos, remotos]);

  const salirDeBusqueda = useCallback(() => { setModoBusca(false); setBuscar(''); }, []);

  // ── Lo que se ve ──────────────────────────────────────────────────────────────────────────
  const yo = datos?.yo ?? SIN_YO;
  const visibles = useMemo(() => (datos ? filtrarChats(datos.chats, filtro, yo, datos.funnelPrincipal) : []), [datos, filtro, yo]);
  const conteos = useMemo(() => contarBandejas(datos?.chats ?? [], yo), [datos, yo]);

  // ── La selección (en la URL) y los links profundos ───────────────────────────────────────
  const [seleccion, setSeleccion] = useState<ChatResumen | null>(null);
  // Con useMemo: un objeto nuevo en cada dibujo volvería a correr lo que la ventana hace al cambiar de chat.
  const seleccionVista = useMemo(() => seleccion && conNombreElegido(seleccion, verNombre), [seleccion, verNombre]);
  const listaVista = useMemo(() => (resultados ?? visibles).map((c) => conNombreElegido(c, verNombre)), [resultados, visibles, verNombre]);
  const firma = sp.toString();
  const link = useMemo<LinkProfundo | null>(() => leerLinkProfundo((k) => new URLSearchParams(firma).get(k)), [firma]);
  /** El link que todavía no apareció en la lista: con cuántas lecturas lleva sin verlo. */
  const pendiente = useRef<{ firma: string; sinVerlo: number; lectura: number } | null>(null);
  const pidiendoClave = useRef<string | null>(null);

  const elegir = useCallback((c: ChatResumen) => {
    setSeleccion(c);
    router.replace(rutaChatsDeClave(c.clave), { scroll: false });
  }, [router]);

  /** Suelta un link que no apareció: la URL vuelve a /chats y NO se elige nada. */
  const soltarLink = useCallback(() => {
    pendiente.current = null;
    setSeleccion(null);
    router.replace(RUTA_CHATS, { scroll: false });
  }, [router]);

  useEffect(() => {
    if (!link) { pendiente.current = null; setSeleccion(null); return; }
    const todos = [...(datos?.chats ?? []), ...(remotos ?? [])];
    // Ya está elegida esa misma clave (un clic en la fila): sólo se refresca con lo último leído.
    if (link.tipo === 'clave') {
      const fresco = todos.find((c) => c.clave === link.clave);
      if (fresco) { pendiente.current = null; setSeleccion(fresco); return; }
      if (seleccion?.clave === link.clave) { pendiente.current = null; return; }
    }
    if (!datos) return;
    // Una lectura nueva por link: el contador de lecturas sin verlo es POR link (el `n` de un aviso
    // cambia la firma aunque el chat sea el mismo).
    if (!pendiente.current || pendiente.current.firma !== firma) pendiente.current = { firma, sinVerlo: 0, lectura: lecturas };
    else if (pendiente.current.lectura === lecturas) return; // esta lectura ya se miró
    const p = pendiente.current;
    p.lectura = lecturas;
    const paso = pasoDelLink(todos, link, p.sinVerlo);
    if (paso.paso === 'elegir') {
      pendiente.current = null;
      setSeleccion(paso.chat);
      if (link.tipo !== 'clave') router.replace(rutaChatsDeClave(paso.chat.clave), { scroll: false });
      return;
    }
    if (paso.paso === 'esperar') {
      p.sinVerlo += 1;
      // El link busca una conversación que la lectura rápida pudo no traer: se reintenta con TODO.
      const t = setTimeout(() => { void cargarLista('completa'); }, REINTENTO_LINK_MS);
      return () => clearTimeout(t);
    }
    // No apareció en dos lecturas. Si el link nombra una clave EXACTA (un lead sin mensajes todavía, un
    // chat que la lista no trae), se pide sola: es ESA conversación, no otra. Si no existe, nada.
    const exacta = claveDelLink(link);
    if (!exacta) { soltarLink(); return; }
    if (pidiendoClave.current === exacta) return;
    pidiendoClave.current = exacta;
    void (async () => {
      try {
        const r = await fetch(`/api/chats/hilo?clave=${encodeURIComponent(exacta)}`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
        const j = (await r.json().catch(() => null)) as RespHilo | null;
        if (j && j.ok && j.chat) {
          pendiente.current = null;
          setSeleccion(j.chat);
          router.replace(rutaChatsDeClave(j.chat.clave), { scroll: false });
        } else soltarLink();
      } catch {
        soltarLink();
      } finally {
        pidiendoClave.current = null;
      }
    })();
    // `seleccion` NO es dependencia: este efecto la ESCRIBE, y con ella adentro se volvería a correr
    // en cada elección. Lo que lo dispara es la URL (`firma`) y cada lectura nueva de la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, lecturas, link, remotos]);

  // ── Leído: al abrir, y cuando entra algo nuevo con el chat abierto y la pestaña a la vista ────
  const leidoEnviado = useRef<string | null>(null);
  useEffect(() => {
    if (!seleccion?.sinLeer || document.visibilityState !== 'visible') return;
    const marca = `${seleccion.clave}|${seleccion.ultimaFecha ?? ''}`;
    if (leidoEnviado.current === marca) return;
    leidoEnviado.current = marca;
    const clave = seleccion.clave;
    // Optimista: el punto azul se va en el acto; la próxima lectura trae la verdad del servidor.
    setDatos((d) => (d ? { ...d, chats: d.chats.map((c) => (c.clave === clave ? { ...c, sinLeer: false } : c)) } : d));
    setSeleccion((s) => (s && s.clave === clave ? { ...s, sinLeer: false } : s));
    void postJson('/api/chats/estado', { clave, accion: 'leido' });
  }, [seleccion]);

  // ── Cambios desde la ventana, el drawer o la fila ──────────────────────────────────────────
  /** Cuántas veces cambió algo: el drawer relee el contacto y la actividad cuando sube. */
  const [version, setVersion] = useState(0);
  const alCambiar = useCallback(() => { setVersion((v) => v + 1); void cargarLista('rapida'); }, [cargarLista]);

  /**
   * Se agregó al CRM: la conversación pasa a `lead:<id>`. La ventana se vuelve a montar (su `key` es la clave).
   * ⚠️ LA FILA DE LA LISTA CAMBIA DE CLAVE EN EL ACTO (27/10/2026, Martín: «se duplica en CHATS hasta que doy refresh»). La
   * lectura rápida trae el contacto como `lead:<id>` y deja la fila `wa:…` de pantalla (no la trajo, y lo rápido no borra):
   * dos filas de la misma persona hasta la lectura completa. `cambiarClaveEnLista` la renombra y la rápida la reemplaza.
   */
  const alCambiarClave = useCallback((nueva: string, vieja?: string) => {
    const p = parsearClave(nueva);
    const leadId = p?.tipo === 'lead' ? p.leadId : null;
    setDatos((d) => (d && vieja ? { ...d, chats: cambiarClaveEnLista(d.chats, vieja, nueva, leadId) } : d));
    setSeleccion((s) => {
      if (!s || (vieja && s.clave !== vieja)) return s;
      return { ...s, clave: nueva, leadId: leadId ?? s.leadId };
    });
    if (!vieja || seleccion?.clave === vieja) router.replace(rutaChatsDeClave(nueva), { scroll: false });
    alCambiar();
  }, [router, alCambiar, seleccion]);

  const [fichaId, setFichaId] = useState<number | null>(null);
  const abrirFicha = useCallback((leadId: number) => setFichaId(leadId), []);
  const cerrarFicha = useCallback(() => { setFichaId(null); alCambiar(); }, [alCambiar]);

  const accionFila = useCallback(async (c: ChatResumen, a: AccionFila) => {
    if (a.tipo === 'ficha') { if (c.leadId != null) abrirFicha(c.leadId); return; }
    if (a.tipo === 'agregar') {
      // El mismo alta que la cabecera del chat (./agregar-al-crm.ts): el nombre de la agenda, nunca el teléfono.
      try {
        const r = await agregarChatAlCrm(c, a.funnelId);
        if (!r.ok) { aviso.error(TEXTO_ACCION.agregar.error, 'elegir' in r ? 'Elige el funnel.' : r.error); return; }
        if (r.aviso) aviso.error(r.aviso.titulo, r.aviso.detalle);
        aviso.ok(TEXTO_ACCION.agregar.ok);
        alCambiarClave(claveLead(r.leadId), c.clave);
        abrirFicha(r.leadId);
      } catch (e) {
        aviso.error(TEXTO_ACCION.agregar.error, e instanceof Error ? e.message : null);
      }
      return;
    }
    const r = c.leadId != null
      ? await postJson<{ ok: boolean; error?: string }>('/api/chats/asignar', { leadId: c.leadId, setter: a.setter })
      : { ok: false, error: 'Sin lead' };
    const txt = TEXTO_ACCION[a.tipo];
    if (r.ok) aviso.ok(a.tipo === 'asignar' && a.setter == null ? 'Asignación quitada' : txt.ok);
    else aviso.error(txt.error, r.error ?? null);
    alCambiar();
  }, [aviso, alCambiar, alCambiarClave, abrirFicha]);

  // ── Conectar y administrar un canal, sin salir de Chats (24/10/2026, docs/diseno-chats.md §8.4) ─────────────────
  // Antes WhatsApp iba a /whatsapp y el email a /email: la pantalla entera de otra tab («salta el diseño de la tab vieja de
  // WhatsApp... solo debería saltar el QR»). Ahora el modal de cada medio (ConectarCanal.tsx) y, recién conectado un
  // WhatsApp, la única pregunta de sincronizar (AdministrarWhatsApp `recien`).
  const [administrar, setAdministrar] = useState<{ linea: string; rotulo: string; recien: boolean } | null>(null);
  const [canalMaKo, setCanalMaKo] = useState(false);
  const lineas = useMemo(() => datos?.lineas ?? [], [datos]);
  // Las del NEGOCIO: el número de MaKo (el super admin, docs/diseno-chats.md §8.5) se administra en su panel, no tiene
  // ocultos ni alarma acá, y no cuenta para saber si el negocio ya tiene un número conectado.
  const lineasNegocio = useMemo(() => lineas.filter((l) => l.linea !== LINEA_CANAL_MAKO), [lineas]);
  const abrirAdministrar = useCallback((l: LineaChat, recien = false) => {
    if (l.linea === LINEA_CANAL_MAKO) { setCanalMaKo(true); return; }
    setAdministrar({ linea: l.linea, rotulo: l.rotulo, recien });
  }, []);
  const conectarCanal = useConectarCanal({
    lineas: lineasNegocio,
    onConectado: alCambiar,
    // La línea que se acaba de vincular todavía no está en la lista: se abre por su nombre, y el rótulo llega al releer.
    onWhatsappConectado: (linea) => {
      const l = lineas.find((x) => x.linea === linea) ?? lineas.find((x) => x.esDefault) ?? null;
      const nombre = linea ?? l?.linea ?? null;
      if (nombre) setAdministrar({ linea: nombre, rotulo: l?.linea === nombre ? l.rotulo : '', recien: true });
    },
    alError: (texto) => aviso.error(texto, null),
    alNota: (texto) => aviso.ok(texto, null),
  });
  const { conectar: conectarUno } = conectarCanal;
  // `?conectar=whatsapp` (lo que hace /whatsapp sin número conectado, y los avisos que piden conectar algo): el modal de
  // ese canal, y la URL vuelve a /chats. Conectar es del admin: al resto el link no le abre nada.
  const conectarLink = sp.get('conectar');
  useEffect(() => {
    if (!conectarLink) return;
    const c = CONECTABLES.find((x) => x === conectarLink);
    if (c && esAdmin) conectarUno(c);
    router.replace(RUTA_CHATS, { scroll: false });
  }, [conectarLink, esAdmin, conectarUno, router]);
  // La alarma del número caído (la tenía la tab vieja): un número que no está conectado no manda nada.
  const caida = lineasNegocio.find((l) => l.estado === 'desconectado') ?? null;

  // ── Sin ningún canal conectado: una frase y la salida a cada conexión ──────────────────────
  const sinCanales = !!datos && !errorLista && datos.chats.length === 0 && datos.fallas.length === 0
    && !datos.lineas.some((l) => l.estado === 'conectado') && datos.cuentasSociales.length === 0;
  if (sinCanales) {
    return (
      <main className="rio">
      <FuenteChats />
        <div className="rio-vacio">
          {/* Conectar es del admin (/api/zernio y las líneas de /whatsapp lo exigen): al resto no se le
              pide algo que no puede hacer. */}
          <span className="rio-vacio-titulo">{esAdmin ? 'Conecta un canal para ver tus chats aquí.' : 'Todavía no hay canales conectados.'}</span>
          {esAdmin && <BotonesCanales onElegir={conectarUno} />}
        </div>
        <div id={ID_PORTAL_RIO} className="rio-portal" />
        <AvisoVentana aviso={aviso.aviso} onCerrar={aviso.cerrar} />
        {conectarCanal.modal}
        {administrar && <AdministrarWhatsApp key={administrar.linea} linea={administrar.linea} rotulo={administrar.rotulo} recien={administrar.recien}
          onCerrar={() => setAdministrar(null)} onCambio={alCambiar} />}
      </main>
    );
  }

  return (
    <main className="rio">
      <FuenteChats />
      <ListaChats
        ws={ws}
        chats={listaVista}
        cargando={!datos && !errorLista}
        errorLista={errorLista}
        fallas={modoBusca ? fallasBusca : datos?.fallas ?? []}
        lineas={datos?.lineas ?? []}
        onReintentar={() => void cargarTodo()}
        filtros={(
          <FiltrosChats filtro={filtro} onFiltro={cambiarFiltro} verOcultos={verOcultos} onVerOcultos={setVerOcultos} verNombre={verNombre} onVerNombre={setVerNombre} conteos={conteos}
            lineas={lineas} cuentasSociales={datos?.cuentasSociales ?? []} etapas={datos?.etapas ?? []} chats={datos?.chats ?? []}
            funnels={datos?.funnels ?? []} funnelPrincipal={datos?.funnelPrincipal ?? null}
            esAdmin={esAdmin} onConectar={conectarCanal.elegir} onAdministrar={(l) => abrirAdministrar(l)} />
        )}
        arriba={caida && !verOcultos ? (
          <div className="rio-aviso-falla" data-tono="error" role="status">
            <span style={{ flex: 1 }}>{`${rotuloWhatsapp(caida.rotulo, lineas.length > 1)} está desconectado.`}</span>
            {esAdmin && <button type="button" className="rio-link" onClick={() => abrirAdministrar(caida)}>Volver a conectar</button>}
          </div>
        ) : null}
        cuerpoAlterno={verOcultos ? (
          <ListaOcultos ws={ws} lineas={lineasNegocio} onMostrado={alCambiar} onAviso={(t, err) => (err ? aviso.error(t, null) : aviso.ok(t, null))} />
        ) : undefined}
        modoBusca={modoBusca}
        onModoBusca={(on) => (on ? setModoBusca(true) : salirDeBusqueda())}
        buscar={buscar}
        onBuscar={setBuscar}
        buscandoRemoto={buscandoRemoto}
        errorBusqueda={errorBusqueda}
        seleccionada={seleccion?.clave ?? null}
        onElegir={elegir}
        etapas={datos?.etapas ?? []}
        equipo={datos?.equipo ?? []}
        productos={productos}
        onAccion={(c, a) => void accionFila(c, a)}
      />
      <section className="rio-ventana" aria-label="Conversación">
        {seleccion ? (
          <VentanaChat
            key={seleccion.clave}
            ws={ws}
            chat={seleccionVista ?? seleccion}
            yo={yo}
            equipo={datos?.equipo ?? []}
            etapas={datos?.etapas ?? []}
            productos={productos}
            esAdmin={esAdmin}
            drawerAbierto={drawerAbierto}
            onToggleDrawer={toggleDrawer}
            onCambio={alCambiar}
            onAbrirFicha={abrirFicha}
            onClaveCambio={alCambiarClave}
          />
        ) : (
          <div className="rio-vacio">{datos ? 'Elige un chat de la lista.' : ''}</div>
        )}
      </section>
      <PanelContacto
        ws={ws}
        chat={seleccionVista}
        abierto={drawerAbierto}
        pestana={pestana}
        onPestana={elegirPestana}
        onCerrar={() => ponerDrawer(false)}
        etapas={datos?.etapas ?? []}
        equipo={datos?.equipo ?? []}
        version={version}
        onAbrirFicha={abrirFicha}
        onCambio={alCambiar}
      />
      {/* Adentro de la raíz: los menús del Dropdown de la casa heredan el scope `.rio` (./portal.ts). */}
      <div id={ID_PORTAL_RIO} className="rio-portal" />
      <AvisoVentana aviso={aviso.aviso} onCerrar={aviso.cerrar} />
      {conectarCanal.modal}
      {administrar && <AdministrarWhatsApp key={administrar.linea} linea={administrar.linea} rotulo={administrar.rotulo} recien={administrar.recien}
        onCerrar={() => setAdministrar(null)} onCambio={alCambiar} />}
      {canalMaKo && (
        <Modal titulo="WhatsApp de MaKo" onCerrar={() => setCanalMaKo(false)} ancho={480}>
          <CanalMaKoPanel onCambio={alCambiar} />
        </Modal>
      )}
      {fichaId != null && <LeadEditModal leadId={fichaId} onClose={cerrarFicha} />}
    </main>
  );
}
