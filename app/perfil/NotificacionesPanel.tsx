'use client';

// =============================================================================
// NotificacionesPanel — qué avisa MaKo, y por dónde
// =============================================================================
// Vive en /configuraciones. Una matriz evento × canal: cada fila es algo que pasa
// en el negocio y a la derecha están los canales por los que puede salir, como
// cápsulas que se prenden y se apagan.
//
// ── Por qué así ──────────────────────────────────────────────────────────────
// La versión anterior tenía los reportes DOS veces (una en el bloque de WhatsApp
// y otra en el de email), porque agrupaba por canal en vez de por evento. Eso es
// justo lo que la matriz arregla: el "Resumen diario" es UNA cosa y se configura
// en UN lugar.
//
// Las cápsulas llevan el logo Y la palabra a propósito — ver CanalToggle, que
// explica por qué el logo pelado no alcanza.
//
// Tres bloques, en orden de cuán tuyo es lo que configuran:
//   1. Dentro de la app  → pop-up y sonido. Es de la PERSONA (pasa en su navegador).
//   2. Reportes          → del NEGOCIO: los manda el cron a los destinatarios.
//   3. Avisos            → del NEGOCIO, evento por evento.
//
// La lista de qué existe NO se escribe acá: viene de lib/notif-catalogo.ts.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  NOTIF_IN_APP, inAppActivo,
  type NotifInApp,
} from '@/lib/notif-catalogo';
import { EVENTO_PREFS_IN_APP } from '../_components/NotificationsProvider';
import { CanalToggle } from '../_components/CanalToggle';
import { Icon } from '../_components/icons';
import { DestinatariosModal, type Destinatarios } from './DestinatariosModal';
import { PlantillasView } from '../agencia/PlantillasView';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ⚠️ EL TIPO SE IMPORTA, NO SE COPIA. Acá había una copia a mano de `NotifPrefs`, que es
// justo la señal que AGENTS.md nombra: «un tipo copiado a mano para no importar del server
// es la señal de que falta esta frontera». Se quedó vieja al primer campo nuevo, y el
// compilador no podía decir nada. `import type` se borra en compilación, así que traerlo
// del módulo con `server-only` no baja una sola línea al navegador.
import type { NotifPrefs, CanalPrefs } from '@/lib/perfil';

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnLink: CSSProperties = { border: 0, background: 'transparent', padding: 0, color: 'var(--primary)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' };

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

/** Una fila de la matriz: el evento a la izquierda, sus canales a la derecha. */
function Fila({ titulo, sub, canales, primera, pie }: {
  titulo: string; sub?: string; canales: ReactNode; primera?: boolean; pie?: ReactNode;
}) {
  return (
    <div style={{
      paddingTop: primera ? 0 : 14, marginTop: primera ? 0 : 14,
      borderTop: primera ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220, flex: '1 1 300px' }}>
          <div style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 600 }}>{titulo}</div>
          {sub && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 'none' }}>{canales}</div>
      </div>
      {pie}
    </div>
  );
}

/** Tile de la franja de arriba: identifica un canal y dice a dónde llega. */
function TileCanal({ icono, color, nombre, detalle, accion, alerta }: {
  icono: string; color: string; nombre: string; detalle: string;
  accion?: { label: string; onClick: () => void }; alerta?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px',
      borderRadius: 12, background: 'var(--surface-2)',
      border: `1px solid ${alerta ? 'var(--warn)' : 'var(--border)'}`,
    }}>
      <span style={{ display: 'flex', color, flex: 'none', marginTop: 1 }}><Icon name={icono} size={19} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{nombre}</div>
        <div style={{ fontSize: 12, color: alerta ? 'var(--warn)' : 'var(--dim)', marginTop: 2, lineHeight: 1.45, wordBreak: 'break-word' }}>{detalle}</div>
        {accion && <button type="button" onClick={accion.onClick} style={{ ...btnLink, marginTop: 6 }}>{accion.label}</button>}
      </div>
    </div>
  );
}

// ── Normalización de los reportes ────────────────────────────────────────────
// `activo` es lo que miran los crons y `wa`/`email` los canales. Acá se muestra
// una cápsula por canal, así que `activo` pasa a ser derivado: el reporte está
// prendido si sale por algún lado. Se normaliza al cargar para que un estado viejo
// (activo=false con wa=true) no muestre prendido algo que no sale.
function normalizarCanal(c: CanalPrefs): CanalPrefs {
  const wa = c.activo && c.wa;
  const email = c.activo && c.email;
  return { activo: wa || email, wa, email };
}
function normalizarPrefs(p: NotifPrefs): NotifPrefs {
  return {
    ...p,
    horario: normalizarCanal(p.horario),
    diario: normalizarCanal(p.diario),
    semanal: normalizarCanal(p.semanal),
    avisos: p.avisos ?? {},
  };
}


// ── Panel ─────────────────────────────────────────────────────────────────────
export function NotificacionesPanel() {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [draft, setDraft] = useState<NotifPrefs | null>(null);
  const [inApp, setInApp] = useState<NotifInApp | null>(null);
  const [inAppDraft, setInAppDraft] = useState<NotifInApp | null>(null);
  const [dest, setDest] = useState<Destinatarios | null>(null);
  const [tieneGrupo, setTieneGrupo] = useState(false);
  const [modalDest, setModalDest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Las tres lecturas que la pantalla NECESITA. Si cualquiera falla hay que
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
      const [jp, ji, jd] = await Promise.all([
        pedir('/api/perfil'), pedir('/api/perfil/notif-inapp'), pedir('/api/perfil/destinatarios'),
      ]);
      const p = normalizarPrefs(jp.prefs as NotifPrefs);
      setPrefs(p); setDraft(p);
      setInApp(ji.inApp as NotifInApp); setInAppDraft(ji.inApp as NotifInApp);
      setDest(jd.destinatarios as Destinatarios); setTieneGrupo(Boolean(jd.tieneGrupo));
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'No se pudieron cargar tus preferencias');
    }
  }, []);

  useEffect(() => {
    void cargar();
    // El estado de la plantilla es informativo y consulta a Meta: que tarde o
    // falle no puede impedir configurar el resto.
  }, [cargar]);

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

  if (!prefs || !draft || !inApp || !inAppDraft || !dest) {
    return <div style={{ ...card, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>;
  }

  const hayWa = dest.telefonos.length > 0;
  const hayMail = dest.emails.length > 0;

  const prefsDirty = JSON.stringify(draft) !== JSON.stringify(prefs);
  const inAppDirty = JSON.stringify(inAppDraft) !== JSON.stringify(inApp);
  const dirty = prefsDirty || inAppDirty;

  const setItem = (id: string, canal: 'popup' | 'sonido', v: boolean) =>
    setInAppDraft((p) => (p ? { ...p, items: { ...p.items, [id]: { ...(p.items[id] ?? { popup: true, sonido: true }), [canal]: v } } } : p));

  /** El canal de WhatsApp solo puede entregar si hay número. */

  const guardar = async () => {
    setBusy(true);
    try {
      if (prefsDirty) {
        const j = await (await fetch('/api/perfil', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'prefs', prefs: draft }),
        })).json();
        if (!j.ok) throw new Error(j.error || 'no se pudo guardar');
        setPrefs(draft);
      }
      if (inAppDirty) {
        const j = await (await fetch('/api/perfil/notif-inapp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inApp: inAppDraft }),
        })).json();
        if (!j.ok) throw new Error(j.error || 'no se pudo guardar');
        if (j.guardado === false) {
          setFlash('Lo del negocio quedó guardado. Pop-up y sonido no: esta sesión no tiene cuenta propia.');
          return;
        }
        setInApp(inAppDraft);
        // El provider vive en el layout y ya cargó las preferencias: sin este
        // aviso, el sonido que acabás de apagar sigue sonando hasta recargar.
        window.dispatchEvent(new Event(EVENTO_PREFS_IN_APP));
      }
      setFlash('Guardado ✓');
      setTimeout(() => setFlash(null), 1800);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* ── Franja de canales: qué es cada logo y a dónde llega ────────────── */}
      <div style={{ ...card, padding: 16 }}>
        {/* 200px y no 240: con 240 el tercer tile se caía a una segunda fila y
            dejaba un hueco al lado, justo en el ancho más común de esta pantalla. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <TileCanal
            icono="bell" color="var(--accent)" nombre="En la app"
            detalle="Pop-up y sonido en este navegador. Solo para ti."
          />
          <TileCanal
            icono="whatsapp" color={hayWa ? 'var(--wa)' : 'var(--warn)'} nombre="WhatsApp"
            alerta={!hayWa}
            detalle={hayWa
              ? `${tieneGrupo ? 'Al grupo de MaKo · ' : ''}${dest.telefonos.length === 1 ? '1 número' : `${dest.telefonos.length} números`}`
              : 'Sin conectar — MaKo no puede avisar por aquí'}
            accion={{ label: hayWa ? 'Gestionar' : 'Conectar', onClick: () => setModalDest(true) }}
          />
          <TileCanal
            icono="email" color={hayMail ? 'var(--primary)' : 'var(--warn)'} nombre="Email"
            alerta={!hayMail}
            detalle={hayMail
              ? (dest.emails.length === 1 ? dest.emails[0] : `${dest.emails.length} direcciones`)
              : 'Sin conectar — falta una dirección'}
            accion={{ label: hayMail ? 'Gestionar' : 'Agregar', onClick: () => setModalDest(true) }}
          />
        </div>
      </div>

      {/* ── 1. Dentro de la app (personal) ─────────────────────────────────── */}
      <Seccion titulo="Dentro de la app" nota="Solo para ti — no cambia lo que ve el resto del equipo">
        <div style={card}>
          {NOTIF_IN_APP.map((n, i) => (
            <Fila
              key={n.id} primera={i === 0} titulo={n.titulo} sub={n.sub}
              canales={<>
                <CanalToggle
                  icono="bell" label="Pop-up" fila={n.titulo}
                  estado={inAppActivo(inAppDraft, n.id, 'popup') ? 'on' : 'off'}
                  onChange={(v) => setItem(n.id, 'popup', v)}
                />
                <CanalToggle
                  icono="sonido" label="Sonido" fila={n.titulo}
                  estado={n.sonido ? (inAppActivo(inAppDraft, n.id, 'sonido') ? 'on' : 'off') : 'na'}
                  onChange={(v) => setItem(n.id, 'sonido', v)}
                />
              </>}
            />
          ))}
        </div>
      </Seccion>

      {/* Reportes y «cuándo llegan» YA NO ESTÁN ACÁ. Eran secciones que hablaban
          de un mensaje que vivía en otra lista: para saber qué decía el reporte
          diario había que ir a buscarlo. Su configuración —por qué canal sale, qué
          trae adentro, si los no urgentes esperan al resumen— se movió al detalle
          de cada mensaje, abajo (app/perfil/PrefsDeMensaje.tsx). Acá queda sólo lo
          de «Dentro de la app», que es lo único que NO es un mensaje de WhatsApp. */}
      {/* ── 4. Los mensajes, como llegan ───────────────────────────────────── */}
      {/* Es la MISMA pantalla de /mensajes (PlantillasView), no una copia: la
          lista a la izquierda, el chat de WhatsApp a la derecha, y el detalle
          para editar el texto, prenderlo o apagarlo y tocar su flujo. Se le pasa
          el endpoint del CLIENTE — mismo protocolo, otro guard.

          Lo de arriba decide POR DÓNDE llega cada cosa; esto, QUÉ DICE. Eran dos
          preguntas distintas metidas en una lista de toggles, y la segunda no se
          podía contestar sin ver el mensaje. */}
      <Seccion titulo="Los mensajes, como llegan" nota="Se ven igual que en el WhatsApp — toca uno para leerlo y editarlo">
        <PlantillasView endpoint="/api/perfil/plantillas" />
      </Seccion>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end',
        position: 'sticky', bottom: 0, padding: '12px 0',
        background: 'linear-gradient(to top, var(--bg) 55%, transparent)',
      }}>
        {flash && <span style={{ fontSize: 13, color: flash.includes('✓') ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>{flash}</span>}
        <button style={{ ...btnDark, opacity: busy || !dirty ? 0.5 : 1 }} disabled={busy || !dirty} onClick={guardar}>
          {busy ? 'Guardando…' : 'Guardar preferencias'}
        </button>
      </div>

      {modalDest && (
        <DestinatariosModal
          inicial={dest}
          onCerrar={() => setModalDest(false)}
          onGuardado={(d) => { setDest(d); if (d.telefonos.length > 0) setTieneGrupo(true); }}
        />
      )}
    </div>
  );
}
