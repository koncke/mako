'use client';

// =============================================================================
// ChatsApp — la carcasa de la bandeja unificada, copiada de respond.io
// =============================================================================
// docs/diseno-chats.md §3. Cinco columnas, como respond.io (relevamiento respondio.md §1.0):
//
//   ┌ Bandeja 214 ┐┌ Lista 298 ┐┌ Ventana del chat (flex) ┐┌ Drawer 349 ┐┌ rail 44 ┐
//
// (la barra de MaKo reemplaza al rail global de respond.io). Esta pieza es dueña del ESTADO: la lista
// (con su sondeo), la selección (en la URL), los filtros, el drawer y la ficha del lead. La ventana
// del chat es VentanaChat.tsx, de otro equipo, y se monta con las props EXACTAS del plano.
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
import Link, { useRouter } from '@/app/_ui/Link';
import type { ChatResumen, CuentaSocial, EtapaChat, LineaChat } from '@/lib/chats-tipos';
import { FILTRO_INICIAL, coincideBusqueda, contarBandejas, filtrarChats, parsearClave, type FiltroChats } from '@/lib/chats-reglas';
import { RUTA_CHATS, rutaChatsDeClave } from '@/lib/chats-links';
import type { ProductoParaAlta } from '@/lib/lead-funnel-reglas';
import {
  almacenLocal, claveDelLink, filtroRecordado, guardarLocal, leerLinkProfundo, leerLocal, pasoDelLink,
  type LinkProfundo,
} from './lista-reglas';
import { inter } from './fuente';
import { ID_PORTAL_RIO } from './portal';
import { PanelBandejas, type CanalConectable } from './PanelBandejas';
import { ListaChats, type AccionFila } from './ListaChats';
import { PanelContacto, type PestanaDrawer } from './PanelContacto';
import VentanaChat from './VentanaChat';
import { AvisoVentana, postJson, useAvisoRio } from './ventana-piezas';
import { IconoCanal } from './iconos-canal';
import './chats.css';

// La ficha del lead del CRM, la misma de siempre: se baja sólo al abrirla.
const LeadEditModal = dynamic(() => import('../crm/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });

/** Lo que devuelve GET /api/chats (plano §2.2). */
type DatosLista = {
  chats: ChatResumen[];
  lineas: LineaChat[];
  cuentasSociales: CuentaSocial[];
  etapas: EtapaChat[];
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
/** La espera del buscador: no pedir una búsqueda por letra. */
const ESPERA_BUSCAR_MS = 350;
/** Por debajo de este ancho de ventana el drawer arranca cerrado: no entra con la lista y el chat. */
const ANCHO_DRAWER = 1400;
/** Un link que no está en la lista se reintenta enseguida (no a los 15 s del sondeo). */
const REINTENTO_LINK_MS = 2_000;

const SIN_YO = { id: 0, nombre: '' };

/** Lo que dice el toast de cada acción de la fila (3-4 palabras, AGENTS.md). */
const TEXTO_ACCION: Record<AccionFila['tipo'], { ok: string; error: string }> = {
  // Las mismas palabras que la cabecera de la ventana (VentanaChat.tsx): la misma acción no se dice de
  // dos formas según dónde se tocó.
  cerrar: { ok: 'Conversación cerrada', error: 'No se pudo cerrar' },
  reabrir: { ok: 'Conversación reabierta', error: 'No se pudo reabrir' },
  posponer: { ok: 'Conversación pospuesta', error: 'No se pudo posponer' },
  reanudar: { ok: 'Conversación reanudada', error: 'No se pudo reanudar' },
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

  const cargarLista = useCallback(async () => {
    const id = ++pedidoLista.current;
    try {
      const r = await fetch('/api/chats', { cache: 'no-store', signal: AbortSignal.timeout(45_000) });
      const j = (await r.json().catch(() => null)) as RespLista | null;
      // Una lectura vieja que llega después de una nueva no la pisa.
      if (id !== pedidoLista.current) return;
      if (!r.ok || !j || !j.ok) {
        setErrorLista((j && !j.ok && j.error) || `Error ${r.status}`);
        return;
      }
      setDatos({
        chats: j.chats ?? [], lineas: j.lineas ?? [], cuentasSociales: j.cuentasSociales ?? [], etapas: j.etapas ?? [],
        yo: j.yo ?? SIN_YO, equipo: j.equipo ?? [], fallas: j.fallas ?? [],
      });
      setErrorLista(null);
      setLecturas((n) => n + 1);
    } catch (e) {
      if (id === pedidoLista.current) setErrorLista(e instanceof Error ? e.message : 'Sin conexión');
    }
  }, []);

  useEffect(() => {
    void cargarLista();
    const visible = () => document.visibilityState === 'visible';
    const t = setInterval(() => { if (visible()) void cargarLista(); }, SONDEO_MS);
    // Al volver a la pestaña se lee en el acto: lo que pasó mientras no se miraba es lo primero que importa.
    const alVolver = () => { if (visible()) void cargarLista(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [cargarLista]);

  // ── Las comodidades del navegador (con el ws en la clave) ─────────────────────────────────
  const [filtro, setFiltro] = useState<FiltroChats>(FILTRO_INICIAL);
  const [bandejaAbierta, setBandejaAbierta] = useState(true);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [pestana, setPestana] = useState<PestanaDrawer>('contacto');
  useEffect(() => {
    const st = almacenLocal();
    setFiltro((f) => ({ ...f, ...filtroRecordado(leerLocal(st, ws, 'filtro')) }));
    setBandejaAbierta(leerLocal(st, ws, 'bandeja') !== '0');
    // El drawer arranca cerrado en una pantalla angosta aunque la última vez quedó abierto: con la
    // bandeja, la lista y el drawer, al chat le quedaban 250 px.
    setDrawerAbierto(window.innerWidth >= ANCHO_DRAWER && leerLocal(st, ws, 'drawer') !== '0');
  }, [ws]);

  const cambiarFiltro = useCallback((f: FiltroChats) => {
    setFiltro(f);
    guardarLocal(almacenLocal(), ws, 'filtro', JSON.stringify({ mostrar: f.mostrar, orden: f.orden, sinResponder: f.sinResponder }));
  }, [ws]);
  const ponerBandeja = useCallback((abierta: boolean) => {
    setBandejaAbierta(abierta);
    guardarLocal(almacenLocal(), ws, 'bandeja', abierta ? '1' : '0');
  }, [ws]);
  const ponerDrawer = useCallback((abierto: boolean) => {
    setDrawerAbierto(abierto);
    guardarLocal(almacenLocal(), ws, 'drawer', abierto ? '1' : '0');
  }, [ws]);
  const toggleDrawer = useCallback(() => ponerDrawer(!drawerAbierto), [drawerAbierto, ponerDrawer]);
  const elegirPestana = useCallback((p: PestanaDrawer) => {
    // El rail de respond.io: tocar la pestaña abierta cierra el drawer; otra, la cambia (y lo abre).
    if (drawerAbierto && pestana === p) { ponerDrawer(false); return; }
    setPestana(p);
    if (!drawerAbierto) ponerDrawer(true);
  }, [drawerAbierto, pestana, ponerDrawer]);

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
  const visibles = useMemo(() => (datos ? filtrarChats(datos.chats, filtro, yo) : []), [datos, filtro, yo]);
  const conteos = useMemo(() => contarBandejas(datos?.chats ?? [], yo), [datos, yo]);

  // ── La selección (en la URL) y los links profundos ───────────────────────────────────────
  const [seleccion, setSeleccion] = useState<ChatResumen | null>(null);
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
      const t = setTimeout(() => { void cargarLista(); }, REINTENTO_LINK_MS);
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
  const alCambiar = useCallback(() => { setVersion((v) => v + 1); void cargarLista(); }, [cargarLista]);

  const alCambiarClave = useCallback((nueva: string) => {
    // Se agregó al CRM: la conversación pasa a `lead:<id>`. La ventana se vuelve a montar (su `key` es
    // la clave), y la lista trae el contacto nuevo en la próxima lectura.
    const p = parsearClave(nueva);
    setSeleccion((s) => (s ? { ...s, clave: nueva, leadId: p?.tipo === 'lead' ? p.leadId : s.leadId } : s));
    router.replace(rutaChatsDeClave(nueva), { scroll: false });
    alCambiar();
  }, [router, alCambiar]);

  const [fichaId, setFichaId] = useState<number | null>(null);
  const abrirFicha = useCallback((leadId: number) => setFichaId(leadId), []);
  const cerrarFicha = useCallback(() => { setFichaId(null); alCambiar(); }, [alCambiar]);

  const accionFila = useCallback(async (c: ChatResumen, a: AccionFila) => {
    const r = a.tipo === 'asignar'
      ? (c.leadId != null ? await postJson<{ ok: boolean; error?: string }>('/api/chats/asignar', { leadId: c.leadId, setter: a.setter }) : { ok: false, error: 'Sin lead' })
      : await postJson<{ ok: boolean; error?: string }>('/api/chats/estado', { clave: c.clave, accion: a.tipo, ...(a.tipo === 'posponer' ? { hasta: a.hasta } : {}) });
    const txt = TEXTO_ACCION[a.tipo];
    if (r.ok) aviso.ok(a.tipo === 'asignar' && a.setter == null ? 'Asignación quitada' : txt.ok);
    else aviso.error(txt.error, r.error ?? null);
    alCambiar();
  }, [aviso, alCambiar]);

  // ── Conectar un canal (el «+» de Canales y el estado vacío) ─────────────────────────────────
  const conectar = useCallback(async (canal: CanalConectable) => {
    if (canal === 'whatsapp') { router.push('/whatsapp'); return; }
    // Messenger es la plataforma `facebook` de Zernio (app/api/zernio/route.ts).
    const r = await postJson<{ ok: boolean; url?: string; configurado?: boolean; error?: string }>('/api/zernio', {
      action: 'conectar', plataforma: canal === 'messenger' ? 'facebook' : 'instagram',
    });
    if (r.ok && r.url) { window.location.href = r.url; return; }
    if (r.ok && r.configurado === false) { aviso.error('Zernio sin configurar', 'La key de Zernio se carga en Automations.'); return; }
    aviso.error('No se pudo conectar', r.error ?? null);
  }, [router, aviso]);

  // ── Sin ningún canal conectado: una frase y la salida a cada conexión ──────────────────────
  const sinCanales = !!datos && !errorLista && datos.chats.length === 0 && datos.fallas.length === 0
    && !datos.lineas.some((l) => l.estado === 'conectado') && datos.cuentasSociales.length === 0;
  if (sinCanales) {
    return (
      <main className={`rio ${inter.variable}`}>
        <div className="rio-vacio">
          {/* Conectar es del admin (/api/zernio y las líneas de /whatsapp lo exigen): al resto no se le
              pide algo que no puede hacer. */}
          <span className="rio-vacio-titulo">{esAdmin ? 'Conecta un canal para ver tus chats aquí.' : 'Todavía no hay canales conectados.'}</span>
          {esAdmin && (
            <div className="rio-vacio-botones">
              <Link href="/whatsapp" className="rio-btn"><IconoCanal canal="whatsapp" size={18} />WhatsApp</Link>
              <button type="button" className="rio-btn" onClick={() => void conectar('instagram')}><IconoCanal canal="instagram" size={18} />Instagram</button>
              <button type="button" className="rio-btn" onClick={() => void conectar('messenger')}><IconoCanal canal="messenger" size={18} />Messenger</button>
            </div>
          )}
        </div>
        <div id={ID_PORTAL_RIO} className="rio-portal" />
        <AvisoVentana aviso={aviso.aviso} onCerrar={aviso.cerrar} />
      </main>
    );
  }

  return (
    <main className={`rio ${inter.variable}`}>
      {bandejaAbierta && (
        <PanelBandejas
          ws={ws}
          conteos={conteos}
          filtro={filtro}
          onFiltro={cambiarFiltro}
          lineas={datos?.lineas ?? []}
          cuentasSociales={datos?.cuentasSociales ?? []}
          etapas={datos?.etapas ?? []}
          chats={datos?.chats ?? []}
          esAdmin={esAdmin}
          onConectar={conectar}
          onColapsar={() => ponerBandeja(false)}
        />
      )}
      <ListaChats
        ws={ws}
        chats={resultados ?? visibles}
        cargando={!datos && !errorLista}
        errorLista={errorLista}
        fallas={modoBusca ? fallasBusca : datos?.fallas ?? []}
        lineas={datos?.lineas ?? []}
        onReintentar={() => void cargarLista()}
        filtro={filtro}
        onFiltro={cambiarFiltro}
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
        bandejaAbierta={bandejaAbierta}
        onAbrirBandeja={() => ponerBandeja(true)}
        onAccion={(c, a) => void accionFila(c, a)}
      />
      <section className="rio-ventana" aria-label="Conversación">
        {seleccion ? (
          <VentanaChat
            key={seleccion.clave}
            ws={ws}
            chat={seleccion}
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
        chat={seleccion}
        abierto={drawerAbierto}
        pestana={pestana}
        onPestana={elegirPestana}
        onCerrar={() => ponerDrawer(false)}
        etapas={datos?.etapas ?? []}
        equipo={datos?.equipo ?? []}
        productos={productos}
        version={version}
        onAbrirFicha={abrirFicha}
        onClaveCambio={alCambiarClave}
        onCambio={alCambiar}
      />
      {/* Adentro de la raíz: los menús del Dropdown de la casa heredan el scope `.rio` (./portal.ts). */}
      <div id={ID_PORTAL_RIO} className="rio-portal" />
      <AvisoVentana aviso={aviso.aviso} onCerrar={aviso.cerrar} />
      {fichaId != null && <LeadEditModal leadId={fichaId} onClose={cerrarFicha} />}
    </main>
  );
}
