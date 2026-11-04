'use client';

// =============================================================================
// Notificaciones — Settings › Notificaciones, copiada de las de LINEAR (25/10/2026)
// =============================================================================
// Martín, 25/10/2026: «Mira "Notificaciones" aún se ve como antes, solo le agregaste más texto, eso no es lo que te pedí. Te
// pedí un rediseño completo… Tanto en diseño como en funcionalidad». Linear (Settings › Notifications, capturas en
// docs/settings/referencias/linear-notif-*.png):
//   · la página es la lista de CANALES, una fila por canal con su estado y su punto verde o gris, y la flecha;
//   · cada canal abre su detalle (`?canal=`): el interruptor del canal, «Enviar prueba» y un interruptor por aviso.
// Los canales de MaKo: En la app (pop-up y sonido mientras MaKo está abierta) · Celular (los push de MaKo Mobile) ·
// WhatsApp y Email (a quién le llegan los avisos del NEGOCIO; sólo quien lo administra). Y «No molestar», el «Notification
// schedule» de Slack: un horario sin avisos al celular, en la zona de tu perfil (lib/notif-catalogo.ts → enSilencio).
//
// Lo que cambió de FUNCIÓN: el celular se configura desde la computadora (antes, sólo desde el teléfono), cada canal se puede
// probar, y existe «No molestar». Lo que se fue: los textos de cada sección y la sección suelta «En tu celular → Instalar».
//
// Todo guarda al tocarlo, optimista: si el server dice que no, el interruptor vuelve y un aviso dice por qué.
// El resumen de cada canal es puro y tiene test: ./notificaciones-reglas.ts.

import { useCallback, useEffect, useState } from 'react';
import {
  NOTIF_IN_APP, PUSH_SOLO_ADMINS, PUSH_TIPOS, SILENCIO_SUGERIDO, inAppActivo, normalizarSilencio,
  type NotifInApp, type NotifPush, type Silencio,
} from '@/lib/notif-catalogo';
import { horaTexto, MEDIAS_HORAS_DESDE } from '@/lib/horario-envio';
import { EVENTO_PREFS_IN_APP, EVENTO_PRUEBA_IN_APP } from '../_components/NotificationsProvider';
import { Dropdown } from '../components/Dropdown';
import { type Destinatarios } from './DestinatariosLista';
import { DestinatariosCanal } from './DestinatariosCanal';
import { FilaAjustes, GrupoAjustes, PuntoEstado, SELECT_AJUSTES, TituloAjustes } from '../_ui/Ajustes';
import { Switch } from '../_ui/Toggle';
import { Toast, useToast } from '../_ui/Toast';
import { ReportarASoporte } from '../_ui/ReportarASoporte';
import { tiposParaRol } from '../m/cuenta/cuenta-ui';
import { NOMBRE_CANAL, ciudadDeZona, resumenApp, resumenCelular, resumenDestinatarios, type CanalNotif, type Resumen } from './notificaciones-reglas';

const BASE = '/perfil/notificaciones';
const VOLVER = { href: BASE, label: 'Notificaciones' };
const HORAS = MEDIAS_HORAS_DESDE.map((h) => ({ value: String(h), label: horaTexto(h) }));

/** Lo que va a la derecha de un canal: su estado y el punto. */
function Estado({ r }: { r: Resumen | null }) {
  if (!r) return null;
  return <>{r.texto}<PuntoEstado tono={r.tono} /></>;
}

type Leido<T> = { dato: T | null; error: string | null };
const VACIO = { dato: null, error: null };

async function pedir<T>(url: string, campo: string): Promise<T> {
  const r = await fetch(url);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || `${url} respondió ${r.status}`);
  return j[campo] as T;
}

async function guardarJson(url: string, body: unknown): Promise<{ ok: boolean; guardado?: boolean; error?: string; [k: string]: unknown }> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `respondió ${r.status}` }))) as { ok: boolean; error?: string };
}

export function NotificacionesPanel({ canal, admin, zona, deOtro = false }: {
  /** El canal abierto (`?canal=`), o null: la lista de canales. */
  canal: CanalNotif | null;
  /** Administra el negocio: ve WhatsApp y Email (a quién le avisa MaKo lo del negocio) y los avisos sólo de admin. */
  admin: boolean;
  /** La zona horaria de SU perfil: en ella se mide «No molestar». */
  zona: string;
  /** La agencia o el super admin parados en un cliente: de la lista sólo WhatsApp y Email, que son de ESE negocio. La app, el celular y
   *  «No molestar» son de quien mira (`seccionesCuenta`). */
  deOtro?: boolean;
}) {
  const [inApp, setInApp] = useState<Leido<NotifInApp>>(VACIO);
  const [push, setPush] = useState<Leido<NotifPush>>(VACIO);
  const [telefonos, setTelefonos] = useState<number | null>(null);
  const [dest, setDest] = useState<Leido<Destinatarios>>(VACIO);
  const [wsLeido, setWsLeido] = useState<number | null>(null);
  const [tieneGrupo, setTieneGrupo] = useState(false);
  const [probando, setProbando] = useState(false);
  const { toast, show, clear } = useToast();

  // Cada lectura por su lado: si una falla, su canal lo dice y los otros andan. Con un `.catch(() => {})` por fetch, un 500
  // pasajero dejaba la pantalla en «Cargando…» para siempre, sin error y sin forma de reintentar.
  const cargar = useCallback(() => {
    pedir<NotifInApp>('/api/perfil/notif-inapp', 'inApp').then((d) => setInApp({ dato: d, error: null }), (e: Error) => setInApp({ dato: null, error: e.message }));
    pedir<NotifPush>('/api/perfil/notif-push', 'push').then((d) => setPush({ dato: d, error: null }), (e: Error) => setPush({ dato: null, error: e.message }));
    pedir<Array<unknown>>('/api/push/suscripcion', 'dispositivos').then((d) => setTelefonos(d.length), () => setTelefonos(null));
    if (admin) {
      fetch('/api/perfil/destinatarios').then((r) => r.json()).then((j) => {
        if (!j?.ok) throw new Error(j?.error || 'No se pudieron leer');
        setDest({ dato: j.destinatarios as Destinatarios, error: null }); setTieneGrupo(Boolean(j.tieneGrupo)); setWsLeido(typeof j.ws === 'number' ? j.ws : null);
      }).catch((e: Error) => setDest({ dato: null, error: e.message }));
    }
  }, [admin]);
  useEffect(() => { cargar(); }, [cargar]);

  const tipos = tiposParaRol(PUSH_TIPOS, PUSH_SOLO_ADMINS, admin);
  const ids = tipos.map((t) => t.id);

  /** Lo de la app, optimista. El provider del layout relee al guardar: el sonido que apagaste deja de sonar ya. */
  const guardarApp = async (siguiente: NotifInApp) => {
    const previo = inApp.dato;
    setInApp({ dato: siguiente, error: null });
    try {
      const j = await guardarJson('/api/perfil/notif-inapp', { inApp: siguiente });
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      // Sesión sin cuenta propia: no hay dónde colgar la preferencia. Se revierte: dejarlo afirma un guardado que no pasó.
      if (j.guardado === false) { setInApp({ dato: previo, error: null }); show('Esta sesión no tiene cuenta propia', undefined, 'warn'); return; }
      window.dispatchEvent(new Event(EVENTO_PREFS_IN_APP));
    } catch (e) {
      setInApp({ dato: previo, error: null });
      show(e instanceof Error ? e.message : 'No se pudo guardar', undefined, 'bad');
    }
  };

  /** Lo del celular, optimista. */
  const guardarPush = async (siguiente: NotifPush) => {
    const previo = push.dato;
    setPush({ dato: siguiente, error: null });
    try {
      const j = await guardarJson('/api/perfil/notif-push', { push: siguiente });
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      if (j.guardado === false) { setPush({ dato: previo, error: null }); show('Esta sesión no tiene cuenta propia', undefined, 'warn'); return; }
      setPush({ dato: j.push as NotifPush, error: null });
    } catch (e) {
      setPush({ dato: previo, error: null });
      show(e instanceof Error ? e.message : 'No se pudo guardar', undefined, 'bad');
    }
  };

  const probarCelular = async () => {
    setProbando(true);
    try {
      const r = await fetch('/api/push/prueba', { method: 'POST' });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; enviados?: number; sinSuscripciones?: number; error?: string };
      if (j.ok && (j.enviados ?? 0) > 0) show(j.enviados === 1 ? 'Enviado a tu teléfono' : `Enviado a ${j.enviados} teléfonos`, undefined, 'good');
      else if ((j.sinSuscripciones ?? 0) > 0 || j.error === 'sin-cuenta') show('Ningún teléfono con avisos', undefined, 'warn');
      else show('No se pudo enviar la prueba', undefined, 'bad');
    } catch { show('No se pudo enviar la prueba', undefined, 'bad'); }
    finally { setProbando(false); }
  };

  /** Un error de lectura, con su salida: reintentar o reportarlo. */
  const errorDe = (e: string | null) => e && (
    <div className="aj-error" role="alert">
      No se pudieron cargar tus avisos: {e}
      <button type="button" className="aj-boton" data-variante="texto" onClick={cargar}>Reintentar</button>
      <ReportarASoporte />
    </div>
  );

  // ── La lista de canales ─────────────────────────────────────────────────────
  if (!canal) {
    const silencio = push.dato ? normalizarSilencio(push.dato.silencio) : null;
    const cambiarSilencio = (s: Silencio | null) => { if (push.dato) void guardarPush({ ...push.dato, silencio: s }); };
    return (
      <>
        <TituloAjustes titulo="Notificaciones" bajada={deOtro ? 'A quién le avisa MaKo en esta cuenta.' : undefined} />
        {errorDe(deOtro ? dest.error : inApp.error ?? push.error ?? dest.error)}
        <GrupoAjustes titulo="Canales">
          {!deOtro && <FilaAjustes icono="avisar" titulo={NOMBRE_CANAL.app} href={`${BASE}?canal=app`} valor={<Estado r={inApp.dato && resumenApp(inApp.dato)} />} />}
          {!deOtro && <FilaAjustes icono="celular" titulo={NOMBRE_CANAL.celular} href={`${BASE}?canal=celular`} valor={<Estado r={push.dato && resumenCelular(push.dato, telefonos, ids)} />} />}
          {admin && <FilaAjustes icono="whatsapp" titulo={NOMBRE_CANAL.whatsapp} href={`${BASE}?canal=whatsapp`} valor={<Estado r={dest.dato && resumenDestinatarios(dest.dato.telefonos.length, 'whatsapp')} />} />}
          {admin && <FilaAjustes icono="email" titulo={NOMBRE_CANAL.email} href={`${BASE}?canal=email`} valor={<Estado r={dest.dato && resumenDestinatarios(dest.dato.emails.length, 'email')} />} />}
        </GrupoAjustes>

        {!deOtro && <GrupoAjustes titulo="No molestar">
          <FilaAjustes titulo="Pausar los avisos al celular" detalle={silencio ? `Hora de ${ciudadDeZona(zona)}` : undefined}
            fin={<Switch checked={!!silencio} disabled={!push.dato} label={undefined} onChange={(v) => cambiarSilencio(v ? SILENCIO_SUGERIDO : null)} />} />
          {silencio && (
            <FilaAjustes titulo="Horario" fin={(
              <span className="aj-horario">
                <Dropdown value={String(silencio.desde)} options={HORAS} width={96} ariaLabel="Desde" buttonStyle={SELECT_AJUSTES}
                  onChange={(v) => { const d = Number(v); if (d !== silencio.hasta) cambiarSilencio({ ...silencio, desde: d }); }} />
                a
                <Dropdown value={String(silencio.hasta)} options={HORAS} width={96} ariaLabel="Hasta" buttonStyle={SELECT_AJUSTES}
                  onChange={(v) => { const h = Number(v); if (h !== silencio.desde) cambiarSilencio({ ...silencio, hasta: h }); }} />
              </span>
            )} />
          )}
        </GrupoAjustes>}
        <Toast state={toast} onClose={clear} />
      </>
    );
  }

  // ── En la app ───────────────────────────────────────────────────────────────
  if (canal === 'app') {
    const p = inApp.dato;
    return (
      <>
        <TituloAjustes titulo={NOMBRE_CANAL.app} volver={VOLVER} />
        {errorDe(inApp.error)}
        {p && (
          <>
            <GrupoAjustes>
              <FilaAjustes titulo="Pop-up" fin={<Switch checked={p.popup} onChange={(v) => void guardarApp({ ...p, popup: v })} />} />
              {/* El sonido de toda la app, y el de cada aviso con él: un aviso apagado aparte quedaría mudo sin decirlo. No depende
                  del pop-up (NotificationsProvider: `dejaSonar` y `dejaVer` son independientes). */}
              <FilaAjustes titulo="Sonido" fin={<Switch checked={p.sonido}
                onChange={(v) => void guardarApp({ ...p, sonido: v, items: Object.fromEntries(Object.entries(p.items).map(([k, it]) => [k, { ...it, sonido: v }])) })} />} />
              <FilaAjustes titulo="Probar" fin={(
                <button type="button" className="aj-boton" data-variante="borde" onClick={() => window.dispatchEvent(new Event(EVENTO_PRUEBA_IN_APP))}>Enviar prueba</button>
              )} />
            </GrupoAjustes>
            <GrupoAjustes titulo="Avisos">
              {NOTIF_IN_APP.map((n) => (
                <FilaAjustes key={n.id} titulo={n.titulo} fin={(
                  <Switch checked={inAppActivo(p, n.id, 'popup')} disabled={!p.popup}
                    onChange={(v) => void guardarApp({ ...p, items: { ...p.items, [n.id]: { ...(p.items[n.id] ?? { popup: true, sonido: n.sonido }), popup: v } } })} />
                )} />
              ))}
            </GrupoAjustes>
          </>
        )}
        <Toast state={toast} onClose={clear} />
      </>
    );
  }

  // ── Celular ─────────────────────────────────────────────────────────────────
  if (canal === 'celular') {
    const p = push.dato;
    const todos = p ? ids.every((id) => p.items[id] !== false) : false;
    return (
      <>
        <TituloAjustes titulo={NOMBRE_CANAL.celular} volver={VOLVER} />
        {errorDe(push.error)}
        {p && (
          <>
            <GrupoAjustes>
              <FilaAjustes titulo="Avisos al celular" fin={<Switch checked={p.activo} onChange={(v) => void guardarPush({ ...p, activo: v })} />} />
              {/* Los avisos llegan a la app INSTALADA en el teléfono: sin ninguno, la fila lleva a instalarla. */}
              {telefonos === 0
                ? <FilaAjustes titulo="Tus teléfonos" valor={<>Instalar la app<PuntoEstado tono="warn" /></>} href="/perfil/instalar" />
                : <FilaAjustes titulo="Tus teléfonos" valor={telefonos == null ? '' : telefonos === 1 ? '1 teléfono' : `${telefonos} teléfonos`} />}
              <FilaAjustes titulo="Probar" fin={(
                <button type="button" className="aj-boton" data-variante="borde" disabled={probando} onClick={() => void probarCelular()}>
                  {probando ? 'Enviando…' : 'Enviar prueba'}
                </button>
              )} />
            </GrupoAjustes>
            <GrupoAjustes titulo="Avisos" accion={(
              <button type="button" className="aj-boton" data-variante="texto" disabled={!p.activo}
                onClick={() => void guardarPush({ ...p, items: { ...p.items, ...Object.fromEntries(ids.map((id) => [id, !todos])) } })}>
                {todos ? 'Apagar todos' : 'Prender todos'}
              </button>
            )}>
              {tipos.map((t) => (
                <FilaAjustes key={t.id} titulo={t.titulo} fin={(
                  <Switch checked={p.items[t.id] !== false} disabled={!p.activo}
                    onChange={(v) => void guardarPush({ ...p, items: { ...p.items, [t.id]: v } })} />
                )} />
              ))}
            </GrupoAjustes>
          </>
        )}
        <Toast state={toast} onClose={clear} />
      </>
    );
  }

  // ── WhatsApp y Email (del negocio) ──────────────────────────────────────────
  // El `key` de cada editor es su canal: cambiar de canal lo REMONTA (siembra su estado de props con useState; sin eso
  // sobreviven el borrador y el aviso de quién no entró al grupo).
  const guardarDest = (d: Destinatarios) => { setDest({ dato: d, error: null }); if (d.telefonos.length > 0) setTieneGrupo(true); };
  return (
    <>
      <TituloAjustes titulo={NOMBRE_CANAL[canal]} volver={VOLVER} />
      {!admin ? (
        <GrupoAjustes><FilaAjustes titulo="Lo administra quien maneja el negocio" /></GrupoAjustes>
      ) : (
        <>
          {errorDe(dest.error)}
          {dest.dato && (
            <GrupoAjustes titulo={canal === 'whatsapp' ? 'Números' : 'Direcciones'}
              descripcion={canal === 'whatsapp' && tieneGrupo && dest.dato.telefonos.length > 0 ? 'Llegan al grupo de MaKo' : undefined}>
              <DestinatariosCanal key={canal} canal={canal === 'whatsapp' ? 'whatsapp' : 'email'} inicial={dest.dato} ws={wsLeido} onGuardado={guardarDest} />
            </GrupoAjustes>
          )}
        </>
      )}
      <Toast state={toast} onClose={clear} />
    </>
  );
}
