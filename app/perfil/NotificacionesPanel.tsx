'use client';

// =============================================================================
// NotificacionesPanel — qué avisa MaKo, y por dónde
// =============================================================================
// Vive en /configuraciones › Notificaciones. Dos bloques, en orden de cuán tuyo
// es lo que configuran:
//
//   1. Dentro de la app → pop-up y sonido. Es de la PERSONA: pasa en SU navegador,
//      no se manda a ningún lado, y no cambia nada para el resto del equipo.
//   2. Los canales      → del NEGOCIO. Cada tile abre SU canal: a quién le llega
//      y qué dicen los mensajes que salen por ahí.
//
// ── Por qué quedó así ────────────────────────────────────────────────────────
// Antes era una matriz evento × canal: ~35 filas de interruptores, con el texto
// del mensaje viviendo en otra pantalla. Para saber qué decía el «Reporte diario»
// había que ir a buscarlo, y para apagarlo había que encontrar su fila entre las
// 35. Ahora el QUÉ DICE y el SI LLEGA se deciden en el mismo lugar —el detalle de
// cada mensaje— y esta pantalla contesta sólo POR DÓNDE.
//
// Un canal a la vez, a propósito: abajo se ven los mensajes DE ESE canal, así que
// mostrar las dos listas de destinatarios obliga a leer cuál corresponde a lo que
// estás mirando. Pedido del dueño: «que no aparezcan ambos».
//
// La lista de qué existe NO se escribe acá: viene de lib/notif-catalogo.ts (lo de
// la app) y del store de plantillas (lo que sale por WhatsApp y por email).

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { NOTIF_IN_APP, inAppActivo, type NotifInApp, type NotifInAppDef } from '@/lib/notif-catalogo';
import { EVENTO_PREFS_IN_APP } from '../_components/NotificationsProvider';
import { CanalToggle } from '../_components/CanalToggle';
import { Icon } from '../_components/icons';
import { type Destinatarios } from './DestinatariosLista';
import { DestinatariosCanal } from './DestinatariosCanal';
import { PlantillasView } from '../agencia/PlantillasView';
import { BandejaEmail } from './BandejaEmail';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

/** El endpoint del CLIENTE: mismo protocolo que el de la agencia, otro guard. */
const ENDPOINT = '/api/perfil/plantillas';

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnLink: CSSProperties = { border: 0, background: 'transparent', padding: 0, color: 'var(--primary)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const grilla: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 };

// ── Piezas ────────────────────────────────────────────────────────────────────

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ ...labelStyle, marginBottom: 0 }}>{titulo}</span>
        {nota && <span style={{ fontSize: 12, color: 'var(--faint)' }}>{nota}</span>}
      </div>
      {children}
    </section>
  );
}

/** La caja de un tile. La comparten los canales y lo de la app: misma anatomía. */
function Tile({ icono, color, borde, children, titulo }: {
  icono: string; color: string; borde?: string; titulo?: string; children: ReactNode;
}) {
  return (
    <div title={titulo} style={{
      display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px',
      borderRadius: 12, background: 'var(--surface-2)',
      border: `1px solid ${borde ?? 'var(--border)'}`,
    }}>
      <span style={{ display: 'flex', color, flex: 'none', marginTop: 1 }}><Icon name={icono} size={19} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
    </div>
  );
}

/** Tile de un canal: qué es, a dónde llega, y el botón que lo abre. */
function TileCanal({ icono, color, nombre, detalle, accion, alerta, abierto }: {
  icono: string; color: string; nombre: string; detalle: string;
  accion: { label: string; onClick: () => void }; alerta?: boolean; abierto?: boolean;
}) {
  return (
    <Tile icono={icono} color={color} borde={abierto ? 'var(--primary)' : alerta ? 'var(--warn)' : undefined}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{nombre}</div>
      <div style={{ fontSize: 12, color: alerta ? 'var(--warn)' : 'var(--dim)', marginTop: 2, lineHeight: 1.45, wordBreak: 'break-word' }}>{detalle}</div>
      <button type="button" onClick={accion.onClick} style={{ ...btnLink, marginTop: 6 }}>
        {abierto ? 'Cerrar' : accion.label}
      </button>
    </Tile>
  );
}

/**
 * Tile de una notificación de la app. Era una lista de filas anchas con el evento
 * a la izquierda y los canales a la derecha; con dos entradas, eso ocupaba media
 * pantalla para decir dos cosas. Mismo tile que los canales.
 *
 * La explicación larga del catálogo va en el `title` y no dibujada: en un tile de
 * este tamaño son tres renglones de 12px que nadie lee y que empujan los chips
 * fuera de la vista. (Regla del repo: el `title` SÍ puede llevar una frase.)
 */
function TileInApp({ def, prefs, onChange }: {
  def: NotifInAppDef; prefs: NotifInApp; onChange: (canal: 'popup' | 'sonido', v: boolean) => void;
}) {
  return (
    <Tile icono={ICONO_IN_APP[def.id] ?? 'bell'} color="var(--primary)" titulo={def.sub}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{def.titulo}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <CanalToggle
          icono="bell" label="Pop-up" fila={def.titulo}
          estado={inAppActivo(prefs, def.id, 'popup') ? 'on' : 'off'}
          onChange={(v) => onChange('popup', v)}
        />
        <CanalToggle
          icono="sonido" label="Sonido" fila={def.titulo}
          estado={def.sonido ? (inAppActivo(prefs, def.id, 'sonido') ? 'on' : 'off') : 'na'}
          onChange={(v) => onChange('sonido', v)}
        />
      </div>
    </Tile>
  );
}

/** Íconos por id. El fallback es `bell`, que EXISTE: uno inventado dibuja un punto. */
const ICONO_IN_APP: Record<string, string> = { 'wa-mensaje': 'chats', 'wa-plantilla': 'check' };

// ── Panel ─────────────────────────────────────────────────────────────────────
export function NotificacionesPanel() {
  const [inApp, setInApp] = useState<NotifInApp | null>(null);
  const [dest, setDest] = useState<Destinatarios | null>(null);
  const [tieneGrupo, setTieneGrupo] = useState(false);
  const [canal, setCanal] = useState<'whatsapp' | 'email' | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Las dos lecturas que la pantalla NECESITA. Si cualquiera falla hay que
  // decirlo: con un `.catch(() => {})` por fetch, un 500 pasajero o una recarga a
  // destiempo dejaban el panel en "Cargando…" para siempre, sin error y sin forma
  // de reintentar. Pasó en desarrollo y desde afuera parece la app colgada.
  const cargar = useCallback(async () => {
    setErrorCarga(null);
    try {
      const pedir = async (u: string) => {
        const r = await fetch(u);
        const j = await r.json();
        if (!r.ok || !j?.ok) throw new Error(j?.error || `${u} respondió ${r.status}`);
        return j;
      };
      const [ji, jd] = await Promise.all([
        pedir('/api/perfil/notif-inapp'), pedir('/api/perfil/destinatarios'),
      ]);
      setInApp(ji.inApp as NotifInApp);
      setDest(jd.destinatarios as Destinatarios); setTieneGrupo(Boolean(jd.tieneGrupo));
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'No se pudieron cargar tus preferencias');
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  /**
   * Los interruptores de la app guardan SOLOS, sin botón.
   *
   * Tenían una barra pegajosa de «Guardar preferencias» al pie, y este bloque pasó
   * arriba de todo: entre el chip y el botón quedaba el editor de mensajes entero
   * (620 px de chat), así que había que scrollear la pantalla para confirmar algo
   * que se toca en el primer renglón. Los destinatarios y los mensajes ya guardan
   * cada uno lo suyo; una barra para dos chips era el único estado sin guardar de
   * la pantalla, y lo que se pierde al navegar sin apretarla no avisa.
   */
  const setItem = async (id: string, c: 'popup' | 'sonido', v: boolean) => {
    if (!inApp) return;
    const previo = inApp;
    const siguiente: NotifInApp = {
      ...inApp,
      items: { ...inApp.items, [id]: { ...(inApp.items[id] ?? { popup: true, sonido: true }), [c]: v } },
    };
    setInApp(siguiente); // optimista: el chip responde al toque
    try {
      const j = await (await fetch('/api/perfil/notif-inapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inApp: siguiente }),
      })).json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      if (j.guardado === false) {
        // Sesión sin cuenta propia: la preferencia es de la PERSONA y no hay dónde
        // colgarla. Se revierte el chip, porque dejarlo puesto afirma un guardado
        // que no pasó.
        setInApp(previo);
        setFlash('Esta sesión no tiene cuenta propia');
        return;
      }
      // El provider vive en el layout y ya cargó las preferencias: sin este aviso,
      // el sonido que acabás de apagar sigue sonando hasta recargar.
      window.dispatchEvent(new Event(EVENTO_PREFS_IN_APP));
      setFlash('Guardado ✓');
    } catch (e) {
      setInApp(previo);
      setFlash(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setTimeout(() => setFlash(null), 1800);
    }
  };

  if (errorCarga) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>No se pudieron cargar tus preferencias</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3 }}>{errorCarga}</div>
        </div>
        <button type="button" onClick={() => void cargar()} style={btnDark}>Reintentar</button>
      </div>
    );
  }

  if (!inApp || !dest) {
    return <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>;
  }

  const hayWa = dest.telefonos.length > 0;
  const hayMail = dest.emails.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* ── 1. Dentro de la app (personal) ─────────────────────────────────── */}
      <Seccion titulo="Dentro de la app">
        <div style={{ ...card, padding: 16 }}>
          <div style={grilla}>
            {NOTIF_IN_APP.map((n) => (
              <TileInApp key={n.id} def={n} prefs={inApp} onChange={(c, v) => void setItem(n.id, c, v)} />
            ))}
          </div>
          {flash && (
            <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: flash.includes('✓') ? 'var(--good)' : 'var(--bad)' }}>{flash}</div>
          )}
        </div>
      </Seccion>

      {/* ── 2. Los canales ─────────────────────────────────────────────────── */}
      {/* El tile abre SU canal: arriba a quién le llega, abajo los mensajes que
          salen por ahí. Los de WhatsApp se ven como un chat (es la MISMA pantalla
          de /mensajes, no una copia) y los de email como una bandeja de correo —
          un mail no se lee como un chat, y juzgar «¿esto se entiende cuando
          llega?» pide verlo con la forma en la que llega. */}
      <div style={{ ...card, padding: 16 }}>
        <div style={grilla}>
          <TileCanal
            icono="whatsapp" color={hayWa ? 'var(--wa)' : 'var(--warn)'} nombre="WhatsApp"
            alerta={!hayWa} abierto={canal === 'whatsapp'}
            detalle={hayWa
              ? `${tieneGrupo ? 'Al grupo de MaKo · ' : ''}${dest.telefonos.length === 1 ? '1 número' : `${dest.telefonos.length} números`}`
              : 'Sin conectar — MaKo no puede avisar por aquí'}
            accion={{ label: hayWa ? 'Gestionar' : 'Conectar', onClick: () => setCanal((c) => (c === 'whatsapp' ? null : 'whatsapp')) }}
          />
          <TileCanal
            icono="email" color={hayMail ? 'var(--primary)' : 'var(--warn)'} nombre="Email"
            alerta={!hayMail} abierto={canal === 'email'}
            detalle={hayMail
              ? (dest.emails.length === 1 ? dest.emails[0] : `${dest.emails.length} direcciones`)
              : 'Sin conectar — falta una dirección'}
            accion={{ label: hayMail ? 'Gestionar' : 'Agregar', onClick: () => setCanal((c) => (c === 'email' ? null : 'email')) }}
          />
        </div>
      </div>

      {canal && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DestinatariosCanal
            canal={canal} inicial={dest}
            onGuardado={(d) => { setDest(d); if (d.telefonos.length > 0) setTieneGrupo(true); }}
          />
          {canal === 'whatsapp'
            ? <PlantillasView endpoint={ENDPOINT} />
            : <BandejaEmail emails={dest.emails} endpoint={ENDPOINT} />}
        </div>
      )}
    </div>
  );
}
