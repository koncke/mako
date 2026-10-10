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
//      y qué dicen los mensajes que salen por ahí, todo en el mismo recuadro.
//
// ── Por qué quedó así ────────────────────────────────────────────────────────
// Antes era una matriz evento × canal: ~35 filas de interruptores, con el texto
// del mensaje viviendo en otra pantalla. Para saber qué decía el «Reporte diario»
// había que ir a buscarlo, y para apagarlo había que encontrar su fila entre las
// 35. Ahora el QUÉ DICE y el POR DÓNDE LLEGA se deciden en el mismo lugar —el
// detalle de cada mensaje— y esta pantalla contesta sólo A QUIÉN.
//
// ⚠️ LO DE LA APP NO SE VE COMO UN CANAL, A PROPÓSITO. Usaba el MISMO tile que
// WhatsApp y Email, y el dueño lo cortó: «no me gusta que los botones de arriba
// sean igual, hazlos diferentes, más sutiles». Y tiene razón más allá del gusto —
// un tile de canal ABRE algo y dice a dónde llega; esto son dos interruptores que
// no mandan nada a ningún lado. Dos cosas que hacen cosas distintas no pueden
// verse igual, que es la misma regla que obliga a lo contrario cuando SÍ son lo
// mismo (ver el chip de `PrefsDeMensaje`).
//
// La lista de qué existe NO se escribe acá: viene de lib/notif-catalogo.ts (lo de
// la app) y del store de plantillas (lo que sale por WhatsApp y por email).

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { NOTIF_IN_APP, inAppActivo, type NotifInApp, type NotifInAppDef } from '@/lib/notif-catalogo';
import { EVENTO_PREFS_IN_APP } from '../_components/NotificationsProvider';
import { Icon } from '../_components/icons';
import { CanalToggle } from '../_components/CanalToggle';
import { type Destinatarios } from './DestinatariosLista';
import { DestinatariosCanal } from './DestinatariosCanal';
import { PlantillasView } from '../agencia/PlantillasView';
import { enlaceAMensajeMako } from '@/lib/chatbot-mensajes-mako';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

/** El endpoint del CLIENTE: mismo protocolo que el de la agencia, otro guard. */
const ENDPOINT = '/api/perfil/plantillas';

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
// Sin `alignItems`, o sea ESTIRADOS: los tres miden lo mismo siempre, que es lo que
// pidió el dueño. Lo que lo hace posible es que ya no haya nada que se abra y cierre
// adentro —la configuración de destinatarios se ve siempre—, así que el alto de la
// fila no salta al tocar un botón. El pie de cada tile se alinea con `marginTop:auto`.
const grilla: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 };

// ── Piezas ────────────────────────────────────────────────────────────────────

/**
 * La caja de un tile, COMPARTIDA por los tres.
 *
 * Los tres viven en la misma fila y tienen la misma anatomía —ícono, nombre, una
 * línea de detalle y lo que se pueda hacer—, así que son la misma pieza: dos cajas
 * con los mismos números escritos a mano divergen en el primer ajuste.
 */
function Tile({ icono, color, borde, sombra, titulo, detalle, children }: {
  icono: string; color: string; borde?: string; sombra?: string;
  /** A dónde llega. OPCIONAL: lo de la app no va a ningún lado, así que no lo lleva. */
  titulo: string; detalle?: string; children?: ReactNode;
}) {
  return (
    // `height: 100%` para llenar la celda que la grilla ya estiró, y flex en columna
    // para que el pie pueda irse abajo. Sin el 100%, el tile mide su contenido y el
    // borde queda flotando a media celda.
    <div style={{
      // ⚠️ SIN alignItems: con flex-start el hijo NO estira, se encoge al contenido,
      // y entonces el marginTop:auto del pie no tiene sobrante que empujar — el botón
      // del tile más corto quedaba flotando a media celda. El ícono se abstiene solo,
      // con su alignSelf.
      display: 'flex', gap: 11, padding: '13px 15px', height: '100%',
      boxSizing: 'border-box',
      borderRadius: 12, background: sombra ? 'var(--surface)' : 'var(--surface-2)',
      border: `1px solid ${borde ?? 'var(--border)'}`,
      boxShadow: sombra ?? 'none',
    }}>
      <span style={{ display: 'flex', color, flex: 'none', alignSelf: 'flex-start', marginTop: 1 }}><Icon name={icono} size={19} /></span>
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{titulo}</div>
        {detalle && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45, wordBreak: 'break-word' }}>{detalle}</div>}
        {children}
      </div>
    </div>
  );
}

/**
 * Tile de un canal: qué es y a quién le llega, con su editor SIEMPRE a la vista.
 *
 * ⚠️ NO ABRE NI CIERRA NADA. El editor de destinatarios ya era «siempre abierto» por
 * pedido del dueño («la configuración de número e email, siempre abierta»), y el
 * 04/10/2026 se cayó también el botón que abría los MENSAJES del canal debajo de la
 * fila: «no quiero que se abra más con el "Gestionar notificaciones", elimina eso,
 * que esté abierto siempre». Los mensajes se dibujan solos más abajo.
 *
 * Y con el botón se fue el par `abierto`/`onToggle`: sin un canal elegido, el borde
 * azul y el halo no tenían qué marcar. Queda el borde de `alerta`, que sigue
 * contestando otra cosa — que ese canal no tiene a nadie.
 */
function TileCanal({ icono, color, nombre, detalle, alerta, editor }: {
  icono: string; color: string; nombre: string; detalle?: string;
  alerta?: boolean; editor: ReactNode;
}) {
  return (
    <Tile
      icono={icono} color={color} titulo={nombre}
      detalle={detalle}
      borde={alerta ? 'var(--warn)' : undefined}
    >
      {editor}
    </Tile>
  );
}

/** Íconos por id. El fallback es `bell`, que EXISTE: uno inventado dibuja un punto. */
const ICONO_IN_APP: Record<string, string> = { 'wa-mensaje': 'chats', 'wa-plantilla': 'check' };

/**
 * Una notificación de la app, adentro del tile: su ícono, su nombre y sus dos
 * interruptores en la misma fila.
 *
 * El ícono volvió por pedido del dueño («me gustaban los emojis»), y no es sólo
 * gusto: son dos filas seguidas de texto del mismo peso, y el ícono es lo que
 * permite distinguirlas sin leerlas.
 */
function AvisoEnLaApp({ def, prefs, onChange }: {
  def: NotifInAppDef; prefs: NotifInApp; onChange: (canal: 'popup' | 'sonido', v: boolean) => void;
}) {
  // Cuatro CELDAS sueltas, no una fila propia: las columnas las alinea la grilla del
  // padre (ver `TileEnLaApp`). La explicación larga del catálogo va en el `title` y no
  // dibujada — son tres renglones de 12px que nadie lee y que empujan los controles
  // fuera de la vista.
  return (
    <>
      <span title={def.sub} style={{ display: 'flex', alignItems: 'center', color: 'var(--dim)' }}>
        <Icon name={ICONO_IN_APP[def.id] ?? 'bell'} size={15} />
      </span>
      <span title={def.sub} style={{ fontSize: 12.5, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', alignSelf: 'center' }}>
        {def.titulo}
      </span>
      {/* ⚠️ EL MISMO CHIP QUE EL RESTO DE LA TAB, no uno propio. Vivieron un rato como
          texto con un punto, por el pedido de que no se vieran igual que los tiles de
          WhatsApp y Email — y lo que los distingue no es la forma sino el COLOR del
          canal: éstos son dorados y los de un mensaje, verdes y azules. Con la forma
          compartida, el que mira aprende UNA vez qué es un interruptor acá adentro. */}
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
    </>
  );
}

/**
 * El tile de lo que pasa en ESTE navegador. Va PRIMERO y adentro del mismo
 * recuadro que los canales, por pedido del dueño: «ponelo como un chip más al
 * principio, antes de WhatsApp, que estén ambas notificaciones dentro».
 *
 * No tiene «Gestionar» y es correcto que no lo tenga: los otros dos ABREN algo —a
 * quién le llega y qué dice— y esto no manda nada a ningún lado, así que sus dos
 * interruptores son todo lo que hay. Un botón que no abre nada sería un control
 * que no hace nada, sólo para que los tres se vean iguales.
 */
function TileEnLaApp({ prefs, onChange, flash }: {
  prefs: NotifInApp; onChange: (id: string, canal: 'popup' | 'sonido', v: boolean) => void; flash: string | null;
}) {
  return (
    <Tile icono="bell" color="var(--primary)" titulo="Dentro de la app">
      {/* ⚠️ UNA SOLA GRILLA PARA LAS DOS FILAS, no un flex por fila. Con flex, cada
          renglón reparte su sobrante por su cuenta y las columnas salen desparejas —
          y peor: el rótulo cambia de PESO al prenderse, así que la fila se corría
          sola al tocarla. Las columnas de una tabla se alinean con una grilla
          compartida, que además no necesita ningún ancho escrito a mano: la última
          se estira sola hasta el contenido más largo de las dos. */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto auto',
        columnGap: 10, rowGap: 4, alignItems: 'center', marginTop: 8,
      }}>
        {NOTIF_IN_APP.map((n) => (
          <AvisoEnLaApp key={n.id} def={n} prefs={prefs} onChange={(c, v) => onChange(n.id, c, v)} />
        ))}
      </div>
      {flash && (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: flash.includes('✓') ? 'var(--good)' : 'var(--bad)' }}>{flash}</div>
      )}
    </Tile>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function NotificacionesPanel({ editarEnChatbot = false }: {
  /**
   * El negocio tiene /automations (su capa lo incluye: lo decide el server con la MISMA función que
   * el guard de la ruta, `tabEnCapa`). Desde la quinta tanda (punto 5) el lienzo de cada mensaje
   * se edita allá y acá queda un link; sin /automations, el link rebotaría y el mensaje se quedaría
   * sin ningún lugar donde editarse, así que se sigue editando acá.
   */
  editarEnChatbot?: boolean;
} = {}) {
  const [inApp, setInApp] = useState<NotifInApp | null>(null);
  const [dest, setDest] = useState<Destinatarios | null>(null);
  const [tieneGrupo, setTieneGrupo] = useState(false);
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
   * arriba de todo: entre el interruptor y el botón quedaba el editor de mensajes
   * entero (560 px), así que había que scrollear la pantalla para confirmar algo que
   * se toca en el primer renglón. Los destinatarios y los mensajes ya guardan cada
   * uno lo suyo; una barra para dos interruptores era el único estado sin guardar de
   * la pantalla, y lo que se pierde al navegar sin apretarla no avisa.
   */
  const setItem = async (id: string, c: 'popup' | 'sonido', v: boolean) => {
    if (!inApp) return;
    const previo = inApp;
    const siguiente: NotifInApp = {
      ...inApp,
      items: { ...inApp.items, [id]: { ...(inApp.items[id] ?? { popup: true, sonido: true }), [c]: v } },
    };
    setInApp(siguiente); // optimista: el control responde al toque
    try {
      const j = await (await fetch('/api/perfil/notif-inapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inApp: siguiente }),
      })).json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      if (j.guardado === false) {
        // Sesión sin cuenta propia: la preferencia es de la PERSONA y no hay dónde
        // colgarla. Se revierte, porque dejarlo puesto afirma un guardado que no pasó.
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

  // El `key` de cada editor es su canal: cambiar de canal lo REMONTA. Siembra su
  // estado de props con useState, y sin eso sobreviven el borrador, el aviso de quién
  // no entró al grupo y el link — se tipea un teléfono, se pasa a Email y Guardar
  // contesta «eso no parece un email» sobre un campo que no muestra nada.
  const guardarDest = (d: Destinatarios) => { setDest(d); if (d.telefonos.length > 0) setTieneGrupo(true); };

  const hayWa = dest.telefonos.length > 0;
  const hayMail = dest.emails.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* ── Los tres, en UN recuadro ───────────────────────────────────────── */}
      {/* El editor de destinatarios vive ADENTRO de esta caja, debajo del tile que
          lo abrió: era una sección aparte con su propio rótulo y su propio marco, y
          el dueño lo cortó — «que no sea una sección diferente». Y es lo correcto:
          el tile dice a quién le llega y el editor cambia eso mismo; separarlos
          obligaba a leer cuál de los dos canales estabas editando. */}
      <div style={{ ...card, padding: 16 }}>
        <div style={grilla}>
          {/* Primero lo de la app: es lo único que pasa acá mismo y no se manda a
              nadie, así que leerlo antes que los canales ordena la pantalla. */}
          <TileEnLaApp prefs={inApp} onChange={(id, c, v) => void setItem(id, c, v)} flash={flash} />
          {/* El detalle ya NO repite la lista: con los destinatarios a la vista, decir
              «1 número» o la dirección debajo del título era el mismo dato dos veces.
              Queda lo que la lista no cuenta — que WhatsApp va al grupo— y el aviso
              cuando no hay nadie, que es cuando la lista está vacía y no dice nada. */}
          <TileCanal
            icono="whatsapp" color={hayWa ? 'var(--wa)' : 'var(--warn)'} nombre="WhatsApp"
            alerta={!hayWa}
            detalle={hayWa ? (tieneGrupo ? 'Al grupo de MaKo' : undefined) : 'Sin conectar — MaKo no puede avisar por aquí'}
            editor={<DestinatariosCanal key="whatsapp" canal="whatsapp" inicial={dest} onGuardado={guardarDest} />}
          />
          <TileCanal
            icono="email" color={hayMail ? 'var(--primary)' : 'var(--warn)'} nombre="Email"
            alerta={!hayMail}
            detalle={hayMail ? undefined : 'Sin conectar — falta una dirección'}
            editor={<DestinatariosCanal key="email" canal="email" inicial={dest} onGuardado={guardarDest} />}
          />
        </div>
      </div>

      {/* Los mensajes, SIEMPRE a la vista y UNO para los dos canales. Van FUERA del
          recuadro de arriba porque contestan otra pregunta —qué dicen, no a quién
          llegan— y porque miden 560px: adentro, el recuadro dejaría de leerse como
          una caja.

          ⚠️ ANTES ERAN DOS TABLEROS Y SE ELEGÍA CON EL TILE. Lo cortó el dueño el
          04/10/2026: «las secuencias de email o WhatsApp es lo mismo, no se gestiona
          aparte». Por dónde sale un mensaje es un CAMPO del mensaje (`canales`), no
          una pantalla — que es la misma regla por la que el canal no es un nodo del
          lienzo. El canal se prende ahora en el tablero, con la tarjeta de cada uno.

          `BandejaEmail` sigue existiendo y ya no se monta acá: lo que hacía de más
          —ver los correos que salieron— no es configurar un mensaje. Si vuelve, vuelve
          por su propia puerta y no como la mitad email de esta pantalla. */}
      {/* ⚠️ QUINTA TANDA, PUNTO 5: «quiero que elimines el lienzo en la tab de "Notificaciones",
          pero que dejes un enlace para editarlo aquí» (Martín, 09/10/2026, desde /automations). Con
          `enlaceEditar`, la lista, el chat de cada mensaje y el alta se quedan; el lienzo se va y su
          lugar lo toma un link a /automations que abre ESE mensaje (`?aviso=<id>`, lib/chatbot-mensajes-mako.ts). */}
      <PlantillasView endpoint={ENDPOINT} enlaceEditar={editarEnChatbot ? (p) => enlaceAMensajeMako(p.id) : undefined} />
    </div>
  );
}
