'use client';

// =============================================================================
// NotificacionesPanel — qué avisa MaKo, y por dónde
// =============================================================================
// Vive en /configuraciones › Notificaciones. Dos bloques, en orden de cuán tuyo
// es lo que configuran:
//
//   1. Dentro de la app → pop-up y sonido. Es de la PERSONA: pasa en SU navegador,
//      no se manda a ningún lado, y no cambia nada para el resto del equipo.
//   2. Los canales      → del NEGOCIO. Cada tile abre SU canal: a quién le llega.
//      (Qué DICE cada mensaje de MaKo se arma en Automations › «MaKo en WhatsApp».)
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
// la app). Lo que DICE cada mensaje de MaKo ya no se edita acá (11/10/2026): son
// automatizaciones de la tab Automations, sección «MaKo en WhatsApp».

import { useCallback, useEffect, useState } from 'react';
import { NOTIF_IN_APP, inAppActivo, type NotifInApp, type NotifInAppDef } from '@/lib/notif-catalogo';
import { EVENTO_PREFS_IN_APP } from '../_components/NotificationsProvider';
import { Icon } from '../_components/icons';
import { CanalToggle } from '../_components/CanalToggle';
import { type Destinatarios } from './DestinatariosLista';
import { DestinatariosCanal } from './DestinatariosCanal';
import { CuerpoGrupo, GrupoAjustes } from '../_ui/Ajustes';
import { ReportarASoporte } from '../_ui/ReportarASoporte';

// ── Piezas ────────────────────────────────────────────────────────────────────
// EN EL MOLDE DE SETTINGS (25/10/2026, Martín: «En settings no me gusta el diseño de "Perfil, Notificaciones..."... Fijate pagina
// por pagina como lo hacen otras apps»). Eran tres «tiles» en una grilla adentro de una tarjeta, con el editor de cada canal
// apretado en un tercio del ancho. Ahora cada cosa es una SECCIÓN de Settings (su título a la izquierda, la tarjeta a la
// derecha), como las notificaciones de GitHub y de shadcn/ui: «En la app» con una fila por aviso y sus dos interruptores, y
// «Por WhatsApp» y «Por email» con su editor a todo el ancho. Lo que se decidió antes sigue: lo de la app no se dibuja como un
// canal (son interruptores, no mandan nada), el editor de destinatarios va siempre abierto, y la explicación larga del catálogo
// queda en el `title`.

/** Íconos por id. El fallback es `bell`, que EXISTE: uno inventado dibuja un punto. */
const ICONO_IN_APP: Record<string, string> = { 'wa-mensaje': 'chats', 'wa-plantilla': 'check' };

/**
 * Una notificación de la app: su ícono, su nombre y sus dos interruptores. Son CUATRO CELDAS de una grilla compartida
 * (`.aj-notif-app`), no una fila propia: el rótulo del interruptor cambia de PESO al prenderse, y en un flex por fila la fila
 * se corría sola al tocarla; con la grilla, las columnas quedan quietas y alineadas entre filas.
 */
function AvisoEnLaApp({ def, prefs, onChange }: {
  def: NotifInAppDef; prefs: NotifInApp; onChange: (canal: 'popup' | 'sonido', v: boolean) => void;
}) {
  return (
    // La fila es `display: contents` en la computadora (sus celdas van a la grilla compartida) y una fila que baja los
    // interruptores debajo del nombre en el teléfono (ajustes.css): en 390 px los dos no entran al lado del nombre.
    <div className="aj-notif-app__fila">
      <span className="aj-notif-app__icono" title={def.sub}><Icon name={ICONO_IN_APP[def.id] ?? 'bell'} size={17} /></span>
      <span className="aj-notif-app__nombre" title={def.sub}>{def.titulo}</span>
      {/* ⚠️ EL MISMO CHIP QUE EL RESTO DE LA TAB, no uno propio: lo que distingue a éstos de los de un mensaje es el COLOR. */}
      <span className="aj-notif-app__control">
        <CanalToggle icono="bell" label="Pop-up" fila={def.titulo} estado={inAppActivo(prefs, def.id, 'popup') ? 'on' : 'off'}
          onChange={(v) => onChange('popup', v)} />
      </span>
      <span className="aj-notif-app__control">
        <CanalToggle icono="sonido" label="Sonido" fila={def.titulo}
          estado={def.sonido ? (inAppActivo(prefs, def.id, 'sonido') ? 'on' : 'off') : 'na'} onChange={(v) => onChange('sonido', v)} />
      </span>
    </div>
  );
}

/** Mientras lee, o si no pudo: en la MISMA sección, para que la pantalla no salte al llegar los datos. */
function SeccionLeyendo({ titulo, descripcion, error, onReintentar }: { titulo: string; descripcion: string; error: string | null; onReintentar: () => void }) {
  return (
    <GrupoAjustes titulo={titulo} descripcion={descripcion}>
      <CuerpoGrupo>
        {error ? (
          <div className="aj-error" role="alert" style={{ margin: 0 }}>
            No se pudieron cargar tus preferencias: {error}
            <button type="button" className="aj-boton" data-variante="texto" onClick={onReintentar}>Reintentar</button>
            <ReportarASoporte />
          </div>
        ) : <p className="aj-texto" style={{ margin: 0 }}>Cargando…</p>}
      </CuerpoGrupo>
    </GrupoAjustes>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
// ⛔ ACÁ VIVÍA LA PROP `editarEnChatbot` (quinta tanda, punto 5: con /automations, el lienzo de cada
// mensaje se editaba allá y acá quedaba un link). Se fue el 11/10/2026 con la lista de mensajes de abajo.
//
// ⚠️ PARTIDO EN DOS (15/10/2026, «Tu cuenta» y «Configuración del negocio», lib/ajustes-secciones.ts):
// `persona` es lo de la app —el pop-up y el sonido, de TU navegador— y vive en «Tu cuenta»;
// `negocio` son los canales —a quién le llega lo del negocio— y vive en «Configuración del negocio».
// Eran el mismo recuadro porque vivían en la misma pantalla; Google, Notion y Linear los separan igual.
export function NotificacionesPanel({ parte }: { parte: 'persona' | 'negocio' }) {
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
      // Cada mitad lee lo suyo: la de la persona no tiene por qué pedir los destinatarios del negocio.
      if (parte === 'persona') {
        const ji = await pedir('/api/perfil/notif-inapp');
        setInApp(ji.inApp as NotifInApp);
      } else {
        const jd = await pedir('/api/perfil/destinatarios');
        setDest(jd.destinatarios as Destinatarios); setTieneGrupo(Boolean(jd.tieneGrupo));
      }
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'No se pudieron cargar tus preferencias');
    }
  }, [parte]);

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

  if (parte === 'persona') {
    const titulo = 'En la app';
    const descripcion = 'El aviso que salta y su sonido, en este navegador. Es sólo tuyo: no cambia nada para tu equipo.';
    if (!inApp) return <SeccionLeyendo titulo={titulo} descripcion={descripcion} error={errorCarga} onReintentar={() => void cargar()} />;
    return (
      <GrupoAjustes titulo={titulo} descripcion={descripcion}>
        <div className="aj-notif-app">
          {NOTIF_IN_APP.map((n) => (
            <AvisoEnLaApp key={n.id} def={n} prefs={inApp} onChange={(c, v) => void setItem(n.id, c, v)} />
          ))}
        </div>
        {flash && <p className="aj-notif-app__flash" role="status" data-ok={flash.includes('✓') || undefined}>{flash}</p>}
      </GrupoAjustes>
    );
  }
  if (!dest) {
    return <SeccionLeyendo titulo="Por WhatsApp" descripcion="A quién le avisa MaKo lo del negocio." error={errorCarga} onReintentar={() => void cargar()} />;
  }

  // El `key` de cada editor es su canal: cambiar de canal lo REMONTA. Siembra su
  // estado de props con useState, y sin eso sobreviven el borrador, el aviso de quién
  // no entró al grupo y el link — se tipea un teléfono, se pasa a Email y Guardar
  // contesta «eso no parece un email» sobre un campo que no muestra nada.
  const guardarDest = (d: Destinatarios) => { setDest(d); if (d.telefonos.length > 0) setTieneGrupo(true); };

  const hayWa = dest.telefonos.length > 0;
  const hayMail = dest.emails.length > 0;

  // Cada canal, su sección: a quién le llega (o que no le llega a nadie, en ámbar) y su editor SIEMPRE a la vista.
  return (
    <>
      <GrupoAjustes titulo="Por WhatsApp" descripcion={hayWa
        ? (tieneGrupo ? 'Los avisos del negocio llegan al grupo de MaKo, con estos números adentro.' : 'Los avisos del negocio llegan a estos números.')
        : <span style={{ color: 'var(--warn)' }}>Sin un número, MaKo no puede avisar por aquí.</span>}>
        <CuerpoGrupo>
          <DestinatariosCanal key="whatsapp" canal="whatsapp" inicial={dest} onGuardado={guardarDest} />
        </CuerpoGrupo>
      </GrupoAjustes>
      <GrupoAjustes titulo="Por email" descripcion={hayMail
        ? 'Los reportes y los avisos del negocio llegan a estas direcciones.'
        : <span style={{ color: 'var(--warn)' }}>Sin una dirección, MaKo no puede avisar por aquí.</span>}>
        <CuerpoGrupo>
          <DestinatariosCanal key="email" canal="email" inicial={dest} onGuardado={guardarDest} />
        </CuerpoGrupo>
      </GrupoAjustes>

      {/* ⛔ ACÁ IBA LA LISTA DE «LOS MENSAJES» (`PlantillasView` con el endpoint del cliente: qué dice cada
          mensaje de MaKo y por dónde sale). Se fue el 11/10/2026: Martín, «Esto pasa porque "MaKo en WhatsApp"
          lo comenzamos a hacer hace tiempo en la tab de notificaciones y quedaron cosas muy viejas que quiero que
          las depreques. Todo ahora es lo mismo». Los mensajes del cliente son AUTOMATIZACIONES de la tab
          Automations (sección «MaKo en WhatsApp», docs/diseno-mako-en-whatsapp-unificado.md): de esta lista no
          quedaban más que los mensajes PROPIOS del negocio (`AVISOS_DEL_CLIENTE = []`), que siguen en /mensajes.
          Esta pantalla contesta sólo A QUIÉN le llega. */}
    </>
  );
}
