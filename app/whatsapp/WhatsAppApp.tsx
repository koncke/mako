'use client';

// =============================================================================
// WhatsApp — la bandeja del número de WhatsApp del negocio (Evolution). Client
// component; el server wrapper (page.tsx) aplica el guard de onboarding.
// =============================================================================
//  - La bandeja vive en EmpresaInbox (el espejo en nuestra DB) y la conexión del
//    número (el QR, sincronizar, desconectar) en EvolutionConnect.
//  - Acá queda lo de alrededor: el interruptor del chatbot, el desplegable de las
//    líneas (varios números por negocio) y el botón que titila cuando el número
//    que manda está caído.
//
// ⛔ La bandeja OFICIAL (Chatwoot, la Cloud API de Meta) se BORRÓ el 09/10/2026. Martín:
// «Elimina de todos lados la integración con Chatwoot, que no exista más. Guardalo en
// privado». El código entero quedó en la etiqueta de git `archivo/chatwoot-2026-10-09`;
// tests/sin-chatwoot.test.ts falla si vuelve. Por eso ya no hay `?canal=`: los links viejos
// con `?canal=oficial` o `?canal=no-oficial` abren esta misma bandeja.
// =============================================================================

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '../_components/icons';
import { EvolutionConnect } from './EvolutionConnect';
import { EmpresaInbox } from './EmpresaInbox';
import type { ProductoParaAlta } from '@/lib/lead-funnel-reglas';
import { useNotifications } from '../_components/NotificationsProvider';

/**
 * ⚠️ `productos` ES OBLIGATORIO, y no por prolijidad: son los productos del «+ Agregar al CRM»
 * (`null` = no se pudieron leer). La bandeja se monta desde DOS lugares —page.tsx y el cierre
 * del wizard, OnboardingCanalWhatsApp.tsx— y con la prop opcional el segundo la dejaba caer
 * sin que nada fallara: el botón volvía al clic único y el lead nacía en el principal.
 */
export function WhatsAppApp({ puedeChatbot = true, puedeAgregarLinea = false, productos }: { puedeChatbot?: boolean; puedeAgregarLinea?: boolean; productos: ProductoParaAlta[] | null }) {
  // useSearchParams (?linea=, ?stab=) exige un boundary de Suspense en la página.
  return (
    <Suspense fallback={null}>
      <WhatsAppInner puedeChatbot={puedeChatbot} puedeAgregarLinea={puedeAgregarLinea} productos={productos} />
    </Suspense>
  );
}

/** Una línea del no oficial, tal como la dibuja el desplegable. */
type LineaWa = { linea: string; rotulo: string; estado: string; esDefault: boolean };
const AGREGAR_LINEA = '__agregar_linea__';

function WhatsAppInner({ puedeChatbot, puedeAgregarLinea, productos }: { puedeChatbot: boolean; puedeAgregarLinea: boolean; productos: ProductoParaAlta[] | null }) {
  // La tab es SOLO conversaciones: las secuencias viven en /automations, que lee las mismas
  // filas de `nutricion_secuencias`. Tener el mismo tablero en dos pantallas era la
  // forma mas facil de que una quedara vieja.
  const router = useRouter();
  // Modal de gestión del número (sincronizar, desconectar, borrar el historial): lo abre el
  // botón de la tab con el número conectado.
  const [modalNoOficial, setModalNoOficial] = useState(false);
  const { noOficialUnread } = useNotifications();
  const searchParamsWA = useSearchParams();

  // Interruptor de envío real de WhatsApp del workspace (tarea #5). El estado
  // del flag lo ve cualquiera (viene en el GET de secuencias); el toggle solo
  // lo tiene el admin (/api/whatsapp/envio responde 403 al resto).
  const [envioWaOn, setEnvioWaOn] = useState<boolean | null>(null);
  // Estado del número, que lo sabe el panel de conexión. `null` = no se sabe todavía, y con
  // `null` acá NO se acusa nada: es la misma regla de tres estados que ese panel aplica
  // adentro. Ver el ⚠️ del rótulo del chip del chatbot.
  const [canalNoOficial, setCanalNoOficial] = useState<'desconectado' | 'conectando' | 'conectado' | 'error' | null>(null);

  // ── Las líneas del no oficial (06/10/2026: varios números por negocio) ──────────────
  // Pedido de Martín: «es la misma dinámica que "Productos" en el CRM… un desplegable que
  // cambiaría el chat». La línea vive en la URL (`?linea=`), como el producto en el CRM: así
  // el link que se copia abre el chat de ESE número. Sin `?linea=`, la de por default.
  const [lineas, setLineas] = useState<LineaWa[]>([]);
  const [agregando, setAgregando] = useState(false);
  const [avisoLineas, setAvisoLineas] = useState<string | null>(null);
  // ⚠️ LA BANDEJA ESPERA A LA LISTA. Sin línea, la bandeja lee el espejo ENTERO: con dos números
  // mostraría los dos mezclados y una respuesta saldría por la de por default. Así que siempre
  // recibe una línea explícita — y montarla antes de saber cuál la cargaría dos veces.
  const [lineasCargadas, setLineasCargadas] = useState(false);
  // ⚠️ «No pude leer la lista» no es «no hay líneas». Con dos números y la lista caída, la bandeja
  // se montaba SIN línea: leía el espejo entero (los dos números fundidos) y contestaba por la de
  // por default. Sin lista no hay bandeja: se dice y se ofrece reintentar.
  const [lineasError, setLineasError] = useState(false);
  const recargarLineas = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/evolution/mensajes?lineas=1', { cache: 'no-store' });
      const j = (await r.json()) as { ok: boolean; lineas?: LineaWa[] };
      if (j.ok) { setLineas(j.lineas ?? []); setLineasError(false); } else setLineasError(true);
    } catch { setLineasError(true); }
    finally { setLineasCargadas(true); }
  }, []);
  useEffect(() => { void recargarLineas(); }, [recargarLineas]);
  const [caidaNoOficial, setCaidaNoOficial] = useState<{ desvinculado: boolean; fecha: string | null } | null>(null);
  const onEstadoNoOficial = useCallback((e: 'desconectado' | 'conectando' | 'conectado' | 'error' | null, c?: { desvinculado: boolean; fecha: string | null }) => {
    setCanalNoOficial(e);
    setCaidaNoOficial(c ?? null);
  }, []);
  /**
   * UN SOLO predicado para «este número no manda nada», y lo usan el botón que titila y el
   * chip del interruptor. Estaban separados y se contradecían en pantalla: el botón en rojo
   * al lado del chip verde diciendo «Chatbot: ON».
   *
   * ⚠️ 'error' (no se pudo comprobar) NO acusa: es el `null` de la regla de tres estados. Un
   * 500 de nuestra propia API pintaba de rojo un canal sano. Y 'conectando' SÍ acusa cuando
   * WhatsApp desvinculó el dispositivo: esa sesión se queda en `conectando` para siempre.
   */
  const canalCaido = canalNoOficial === 'desconectado' || (canalNoOficial === 'conectando' && caidaNoOficial?.desvinculado === true);
  const [envioAdmin, setEnvioAdmin] = useState(false);
  const [envioBusy, setEnvioBusy] = useState(false);
  const [envioErr, setEnvioErr] = useState<string | null>(null);

  const toggleEnvioWa = async () => {
    if (envioWaOn == null || envioBusy) return;
    setEnvioBusy(true); setEnvioErr(null);
    try {
      const r = await fetch('/api/whatsapp/envio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: !envioWaOn }) });
      const j = await r.json();
      if (j.ok) setEnvioWaOn(Boolean(j.envioHabilitado));
      else setEnvioErr(j.error || 'No se pudo cambiar el envío real');
    } catch {
      setEnvioErr('Sin conexión — prueba de nuevo');
    } finally {
      setEnvioBusy(false);
    }
  };

  // ── Carga inicial: el interruptor del chatbot. Las SECUENCIAS ya no se cargan acá: se
  // administran en /automations, que lee las mismas filas.
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/envio');
        const j = await r.json();
        if (j.ok) { setEnvioAdmin(true); setEnvioWaOn(Boolean(j.envioHabilitado)); }
        // 403 = setter/closer: ven el estado pero sin toggle (config admin-only).
      } catch { /* sin toggle */ }
    })();
  }, []);

  // ── Deep-link viejo: ?stab=plantillas ──
  // Las plantillas de Meta se mudaron a /automations con las secuencias. Los avisos viejos siguen
  // mandando a /whatsapp?stab=plantillas: se redirige en vez de dejar al usuario en una
  // pantalla que ya no tiene eso.
  useEffect(() => {
    if (searchParamsWA.get('stab') !== 'plantillas') return;
    const tpl = searchParamsWA.get('tpl');
    router.replace(`/automations?stab=plantillas${tpl ? `&tpl=${encodeURIComponent(tpl)}` : ''}`);
  }, [searchParamsWA, router]);

  const lineaPedida = searchParamsWA.get('linea');
  // ⚠️ Una `?linea=` que no está en la lista (otra cuenta, una línea que se fue) NO se usa: se
  // cae a la de por default. La lista sale de una lectura con el scope del workspace, y el
  // servidor vuelve a validar la línea en cada envío.
  const lineaActiva: LineaWa | null = lineas.find((l) => l.linea === lineaPedida)
    ?? lineas.find((l) => l.esDefault) ?? lineas[0] ?? null;
  const irALinea = useCallback((linea: string) => {
    const p = new URLSearchParams(searchParamsWA.toString());
    p.set('linea', linea);
    // Lo que se abre pertenece a la línea de la que se sale.
    p.delete('chat'); p.delete('lead'); p.delete('n');
    router.replace(`/whatsapp?${p.toString()}`, { scroll: false });
  }, [router, searchParamsWA]);
  // ⚠️ DOS PREGUNTAS DISTINTAS. El estado de la línea que se MIRA decide QR o bandeja; el de la
  // línea por la que MANDA el chatbot (la de por default) decide la alarma del botón y el chip
  // «Chatbot: ON». Juntas, mirar la línea 2 viva con la 1 caída dejaba el chip en verde sin que
  // saliera nada, y mirar una línea extra caída hacía titilar todo en rojo con el chatbot andando.
  // Mirando la de por default (o con un solo número) manda la sonda, que es lo medido; mirando
  // otra, la fila de la de por default.
  const lineaDefault = lineas.find((l) => l.esDefault) ?? lineas[0] ?? null;
  const viendoLaDefault = !lineaActiva || !lineaDefault || lineaActiva.linea === lineaDefault.linea;
  const caidoQueManda = viendoLaDefault ? canalCaido : (lineaDefault.estado !== 'conectado' && lineaDefault.estado !== 'conectando');
  const noOficialOk = !caidoQueManda;
  const onLineaCreada = useCallback((linea: string) => {
    setAgregando(false);
    void recargarLineas().then(() => irALinea(linea));
  }, [recargarLineas, irALinea]);
  const onLineasCambiaron = useCallback((movidas?: number) => {
    void recargarLineas();
    setAvisoLineas(movidas ? `${movidas} secuencia${movidas === 1 ? '' : 's'} pasan a la línea por default` : null);
  }, [recargarLineas]);

  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-ink)' };
  // El boton ES el indicador. `mk-tab-alarma` late en el borde y la sombra, y con movimiento
  // reducido se queda quieta en rojo fijo — que sigue diciendo lo mismo.
  const avisoRojo: CSSProperties = { border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' };
  const badgeCanal: CSSProperties = { minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px', background: 'var(--bad)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100dvh', maxHeight: '100dvh', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '30px 36px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '7px' }}>
            <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="whatsapp" size={34} /></span>
            <h1 style={{ fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>WhatsApp</h1>
            {envioAdmin && envioWaOn != null && (
              <button onClick={() => void toggleEnvioWa()} disabled={envioBusy} aria-pressed={envioWaOn}
                title={
                  !envioWaOn ? 'El chatbot no envía: los pasos de las secuencias quedan esperando — clic para activar'
                    : caidoQueManda ? 'El interruptor está encendido, pero tu número de WhatsApp está desconectado: no sale nada. Toca «Tu número» para volver a vincularlo.'
                      : 'El chatbot manda WhatsApps reales — clic para pausar'
                }
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '999px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, border: '1px solid ' + (envioWaOn ? (caidoQueManda ? 'var(--warn)' : 'var(--good)') : 'var(--border-strong)'), background: envioWaOn ? (caidoQueManda ? 'var(--warn-bg)' : 'var(--good-bg)') : 'var(--surface)', color: envioWaOn ? (caidoQueManda ? 'var(--warn)' : 'var(--good)') : 'var(--dim)' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: envioWaOn ? (caidoQueManda ? 'var(--warn)' : 'var(--good)') : 'var(--faint)' }} />
                {/* ⚠️ «Envío real: ON» AFIRMABA LA MITAD BUENA DE UN PROCESO DE DOS
                    PASOS, que es la regla que este repo ya tiene escrita («llegó el
                    formulario ✓» sin decir si ENTRÓ). Para que salga un mensaje hacen
                    falta DOS cosas: el interruptor encendido Y el número conectado. El
                    chip mostraba sólo la primera, en verde, mientras la segunda estaba
                    caída hacía cinco días — y el dueño leyó la barra y dijo «acá me
                    dice que está todo conectado».
                    Ahora, con el canal caído, el mismo chip dice qué falta. No se
                    apaga: el interruptor SÍ está en ON, y mentir en la otra dirección
                    haría que lo prendiera de nuevo sin efecto. */}
                Chatbot: {envioWaOn ? (caidoQueManda ? 'ON, pero el número está caído' : 'ON') : 'OFF'}
              </button>
            )}
            {envioErr && <span style={{ fontSize: '12px', color: 'var(--bad)' }}>{envioErr}</span>}
          </div>
        </div>
        {/* El botón del número ES el indicador: titila en rojo cuando el número que manda está
            caído, y con el número conectado abre su pantalla de gestión (sincronizar,
            desconectar, borrar el historial). Hasta el 09/10/2026 era una de dos pestañas;
            la otra era la bandeja oficial (Chatwoot), que se borró. */}
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          <button onClick={() => { if (canalNoOficial === 'conectado') setModalNoOficial(true); }}
            title={noOficialOk ? 'El número que usa el chatbot. Tócalo para sincronizar, desconectar o borrar el historial.' : 'Tu número de WhatsApp está desconectado: el chatbot no manda nada. Vuelve a vincularlo abajo.'}
            className={noOficialOk ? undefined : 'mk-tab-alarma'}
            style={{ ...tabActive, ...(noOficialOk ? null : avisoRojo), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            Tu número{noOficialUnread > 0 && <span style={badgeCanal}>{noOficialUnread}</span>}
          </button>
        </div>
        {/* El número de la bandeja. Se dibuja con DOS líneas o más, o con una si quien mira
            puede agregar otra: ahí es la puerta a «Agregar otro número». Con una sola línea y
            sin permiso, un desplegable de una opción no elige nada. */}
        {lineaActiva && (lineas.length > 1 || puedeAgregarLinea) && (
          <Dropdown
            value={agregando ? AGREGAR_LINEA : lineaActiva.linea}
            width={200}
            ariaLabel="Número de WhatsApp de la bandeja"
            options={[
              // La que se está mirando primero, como el producto en el CRM.
              ...[lineaActiva, ...lineas.filter((l) => l.linea !== lineaActiva.linea)].map((l) => ({
                value: l.linea, label: l.rotulo,
                // El punto dice si esa línea puede mandar: el color nunca va solo, el rótulo
                // del desplegable de cerrado lo repite en el `title` del botón del número.
                color: l.estado === 'conectado' ? 'var(--good)' : 'var(--warn)',
              })),
              ...(puedeAgregarLinea ? [{ value: AGREGAR_LINEA, label: 'Agregar otro número', crear: true }] : []),
            ]}
            onChange={(v) => {
              setAvisoLineas(null);
              // El modal de gestión es de la línea que se deja: abierto, se volvería a abrir solo
              // sobre la siguiente apenas cargue «conectado».
              setModalNoOficial(false);
              if (v === AGREGAR_LINEA) { setAgregando(true); return; }
              setAgregando(false);
              irALinea(v);
            }}
          />
        )}
        {avisoLineas && <span style={{ fontSize: '12px', color: 'var(--dim)' }}>{avisoLineas}</span>}
      </header>

      {/* La bandeja, o la pantalla de conexión EN SU LUGAR. Nunca un pop-up encima de los
          chats: el que entra rápido lo cierra y se queda sin saber que el número no manda
          nada. El componente queda montado siempre porque de él sale el estado que hace
          titilar el botón. */}
      {/* `key` por línea: cambiar de número es otro panel, sin el estado ni el QR del anterior. */}
      {lineasCargadas && <EvolutionConnect key={`conexion-${lineaActiva?.linea ?? 'default'}`} linea={lineaActiva?.linea ?? null}
        inline panelVisible={!agregando} abierto={modalNoOficial} onAbierto={setModalNoOficial} onEstado={onEstadoNoOficial}
        onLineasCambiaron={onLineasCambiaron} />}
      {/* «Agregar otro número»: el QR de una línea NUEVA en el lugar de los chats. Sin
          `onEstado`: su «todavía no conectada» no es el estado del número que manda, y si lo
          fuera el botón titilaría en rojo mientras la persona escanea. */}
      {agregando && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <EvolutionConnect key="nueva-linea" nueva inline panelVisible onLineaCreada={onLineaCreada} />
          <button onClick={() => setAgregando(false)}
            style={{ alignSelf: 'center', background: 'none', border: 'none', color: 'var(--dim)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>Cancelar</button>
        </div>
      )}
      {/* La bandeja y el panel de conexión son excluyentes, y el corte es CONECTADO, no
          «no está caído»: con el número a medio vincular manda la pantalla del QR.
          Mientras no se sabe (null) se muestra la bandeja: el panel todavía no existe. */}
      {lineasError && !lineas.length && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--ink)', fontWeight: 600 }}>No pude cargar tus números</div>
          <button onClick={() => void recargarLineas()}
            style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Reintentar</button>
        </div>
      )}
      {lineasCargadas && !(lineasError && !lineas.length) && !agregando && (canalNoOficial == null || canalNoOficial === 'conectado') && (
        <EmpresaInbox key={`bandeja-${lineaActiva?.linea ?? 'default'}`} puedeChatbot={puedeChatbot} linea={lineaActiva?.linea ?? null} productos={productos} />
      )}

      {/* Las SECUENCIAS y las PLANTILLAS de Meta se mudaron a /automations: son las mismas
          filas de `nutricion_secuencias` y tenerlas en dos pantallas garantizaba que una
          quedara vieja. Esta tab quedo con una sola cosa: las conversaciones. */}
    </main>
  );
}
