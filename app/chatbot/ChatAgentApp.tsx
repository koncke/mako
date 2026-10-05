'use client';

// =============================================================================
// ChatAgentApp — la tab /setting: simulador de secuencias de mensajes + dashboard
// =============================================================================
// Tres sub-tabs: WhatsApp (secuencias como CONTACTOS + chat simulado con
// MaKo-setter, réplica del diseño de Plantillas en SuperAdmin), Email (bandeja
// simulada del lead) y Dashboard (KPIs + gráficos).
//
// NO hay sub-tab de audios, y es a propósito: grabar una nota de voz es parte de
// armar el mensaje, no un trámite aparte. Se decide y se graba DENTRO de cada
// mensaje de la secuencia (PasoAudioControl). Antes había que salir del wizard,
// ir a la biblioteca, grabar, volver y recién ahí colgarlo del paso — tres
// pantallas para una decisión, y la mitad de la gente no volvía. La biblioteca
// sigue existiendo por debajo: un audio grabado en una secuencia queda
// disponible para las demás.

import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/app/_components/icons';
// next/link NO: perdería el ?ws= y mandaría al super admin a SU propio WhatsApp
// en vez del que está mirando.
import Link from '@/app/_ui/Link';
import { SecuenciaWizard } from './SecuenciaWizard';
import { SimuladorWhatsApp } from './SimuladorWhatsApp';
import { HandoffsPanel, type Handoff } from './HandoffsPanel';
import { OnboardingChatAgent } from './OnboardingChatAgent';
// Vive en app/whatsapp porque nacio ahi; lo que se mudo es DONDE se muestra.
import type { Estrategia } from '@/lib/setting-estrategia';
import type { MetricasSecuencia, PuntoSerie } from '@/lib/setting-metricas';

export type PasoSecuenciaDto = {
  orden: number; canal: 'email' | 'whatsapp'; delay_horas: number;
  asunto: string | null; preheader?: string | null; cuerpo: string;
  proveedor?: 'oficial' | 'no_oficial'; template_wa: string | null; ancla?: 'reunion';
  tipo?: 'texto' | 'audio'; audio_id?: number | null;
  /**
   * Condición para que el paso salga. La UI la NECESITA: los dos audios de
   * apertura de la post-agenda son mutuamente excluyentes y sin mostrarlo la
   * pantalla se lee como que salen los dos.
   *
   * Faltaba solo en el TIPO, no en los datos: el JSON de la API la trae y
   * JavaScript no borra lo que TypeScript no declara, así que el round-trip
   * del editor nunca la perdió. Igual conviene nombrarla.
   */
  requiere?: 'respondio' | 'sin_respuesta' | 'ya_contactado' | 'primer_contacto';
  /** Formas alternativas de decir lo mismo: el motor sortea una en cada envío. */
  variantes?: string[];
};
export type AudioSetting = { id: number; titulo: string; media_mime: string; duracion_s: number | null; transcript: string | null; url: string | null };
export type SecuenciaDto = {
  id: number; clave: string; nombre: string; etapa: string; trigger_tipo: string;
  activa: boolean; pasos: PasoSecuenciaDto[]; inscriptos: number; enviados: number;
  estrategia: Estrategia | null; metricas: MetricasSecuencia;
  /** El PRODUCTO al que se acota (el embudo). null = todos los productos. */
  funnel_id?: number | null;
};

/** Un producto del CRM con las etapas que el dueño le configuró. */
export type ProductoOpcion = {
  funnelId: number; nombre: string; esDefault: boolean;
  etapas: Array<{ value: string; label: string }>;
};
export type Opcion = { value: string; label: string };

// Etiquetas de etapa: legacy del seed + stage keys derivadas; para etapas custom
// el GET trae las labels reales del funnel del workspace (prevalecen).
const ETAPA_LABEL: Record<string, string> = {
  nutri: 'No Agenda', postagenda: 'Post-agenda', noshow: 'No Show', nopaga: 'No Paga', manual: 'Manual',
  noshow_r1: 'No Show R1', noshow_r2: 'No Show R2', noshow_r3: 'No Show R3',
  nocompro: 'No Compró', nutridiaria: 'Nutrición diaria', reactivacion: 'Reactivación',
  reunion_excepcional: 'Reunión excepcional',
};

const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', fontWeight: 600, cursor: 'pointer' };

// =============================================================================
// DEEP LINK: /chatbot?stab=<whatsapp|email|dashboard>&sec=<id>
// =============================================================================
// Existe porque MaKo manda acá desde otra pantalla: cuando termina de escribir
// una secuencia, su tarjeta dice «Ver los 5 mensajes» y NO los dibuja —los
// mensajes se editan acá, así que dibujarlos allá garantiza que un día digan
// algo distinto de lo que se ve en esta tab—.
//
// ⚠️ Antes de esto, la carpeta entera no tenía UN SOLO `useSearchParams`: el
// link existía y dejaba al usuario en la puerta, mirando la lista completa y
// buscando cuál de todas era. «Linkear en vez de dibujar» sin ancla por entidad
// no es linkear, es dejar a alguien en la recepción.
//
// El vocabulario (`?stab=`, y el id como parámetro) es el mismo de /whatsapp
// —`?canal`, `?chat`, `?lead`, `?stab`— a propósito: un usuario que aprendió a
// leer una URL de MaKo no tiene que volver a aprenderla en cada tab.
export function ChatAgentApp() {
  // `useSearchParams` exige un boundary de Suspense, igual que en /whatsapp.
  return (
    <Suspense fallback={null}>
      <ChatAgentInner />
    </Suspense>
  );
}

function ChatAgentInner() {
  const [secuencias, setSecuencias] = useState<SecuenciaDto[] | null>(null);
  const [rolAdmin, setRolAdmin] = useState(false);
  const [objetivos, setObjetivos] = useState<Opcion[]>([]);
  const [etapas, setEtapas] = useState<Opcion[]>([]);
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [disparadores, setDisparadores] = useState<Opcion[]>([]);
  const [leadMagnets, setLeadMagnets] = useState<Array<{ id: string; nombre: string }>>([]);
  // Etapas de nutrición sin ninguna secuencia que las cubra. Reemplaza al viejo
  // seed: en vez de inventar secuencias con copy de relleno, se avisa qué falta.
  const [huecos, setHuecos] = useState<Array<{ etapa: string; label: string }>>([]);
  // Leads que escribieron algo fuera del guion: MaKo no contestó y espera que le
  // enseñen el caso.
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [negocio, setNegocio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audios, setAudios] = useState<AudioSetting[]>([]);
  // Wizard: null = cerrado; 'nueva' = secuencia nueva; number = definir sobre esa secuencia.
  const [wizard, setWizard] = useState<null | 'nueva' | number>(null);
  // Onboarding de la tab (regla: toda tab tiene onboarding). null = todavía no
  // sabemos; true = arranca en el recorrido; false = la tab normal.
  const [enOnboarding, setEnOnboarding] = useState<boolean | null>(null);
  // Qué recorrido eligió arrancar. Si nunca configuró NADA, primero se le
  // pregunta en vez de meterlo de prepo en los 11 pasos: el que solo quiere
  // WhatsApp no tiene por qué pasar por el email.
  const [plan, setPlan] = useState<'setting' | 'whatsapp' | 'email' | null>(null);
  const [preguntarPlan, setPreguntarPlan] = useState(false);
  // Estado del WhatsApp del negocio. Arranca en 'desconocido' a propósito: hasta
  // que la API conteste, la pantalla no afirma que esta conectado NI que no.
  const [canal, setCanal] = useState<{ estado: string; desde: string | null; desvinculado?: boolean }>({ estado: 'desconocido', desde: null });
  // Solo estos dos son un hecho negativo comprobado. 'desconocido', 'conectando'
  // y un estado que no conozcamos NO acusan nada: es la misma regla que el paso
  // del WhatsApp en el onboarding, donde afirmar «desconectado» sobre un corte
  // momentaneo mandaba a re-escanear un QR que no hacia falta.
  const canalCaido = canal.estado === 'desconectado' || canal.estado === 'sin_vincular';

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/chat-agent/secuencias', { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) { setError(j.error || 'No se pudieron cargar las secuencias de mensajes.'); setSecuencias([]); return; }
      const lista = j.secuencias as SecuenciaDto[];
      setSecuencias(lista); setRolAdmin(Boolean(j.rolAdmin));
      setObjetivos(j.objetivos ?? []); setEtapas(j.etapas ?? []); setLeadMagnets(j.leadMagnets ?? []);
      setProductos(j.productos ?? []); setDisparadores(j.disparadores ?? []);
      setHuecos(j.huecos ?? []); setHandoffs(j.handoffs ?? []);
      setNegocio(j.negocio ?? '');
      setCanal(j.canal ?? { estado: 'desconocido', desde: null });
      setError(null);
    } catch {
      setError('Sin conexión — recarga la página.'); setSecuencias([]);
    }
    // Biblioteca de audios (admin-only: el 403 del setter deja la lista vacía).
    try {
      const ra = await fetch('/api/chat-agent/audios', { cache: 'no-store' });
      const ja = await ra.json();
      if (ja.ok) setAudios(ja.audios ?? []);
    } catch { /* sin audios */ }
    // ¿La tab arranca en su onboarding? (403 del setter → la ve normal)
    try {
      const ro = await fetch('/api/chat-agent/onboarding?tab=setting', { cache: 'no-store' });
      const jo = await ro.json();
      // ⚠️ Un 403 (el setter, que no es admin) SÍ ve la tab normal — es su caso
      // legítimo y por eso el fallback es `false`. Cualquier OTRA falla, no: si
      // no se pudo saber si el onboarding está completo, mostrar el dashboard es
      // afirmar que sí lo está. Es la misma regla que el paso del WhatsApp
      // oficial: «no pudimos preguntarlo» no es «está listo».
      const falta = jo.ok ? jo.estado?.status !== 'done' : ro.status !== 403;
      setEnOnboarding(falta);
      // Arrancar de cero = ni un paso hecho en todo el recorrido. Ahí se
      // pregunta. Si ya venía a mitad de camino, se sigue donde quedó.
      const pasos = (jo?.estado?.steps ?? {}) as Record<string, { done?: boolean }>;
      const ningunoHecho = Object.values(pasos).every((x) => !x?.done);
      setPreguntarPlan(falta && ningunoHecho);
    } catch (e) {
      // Sin red tampoco se afirma que está listo: se muestra el onboarding, que
      // es reversible (se sigue de largo), en vez del dashboard, que no lo es.
      console.error('[chatbot] no se pudo leer el estado del onboarding:', e);
      setEnOnboarding(true);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // ── El ancla del deep link ────────────────────────────────────────────────
  // Se aplica UNA sola vez. Sin el ref, cada render volvería a forzar la sub-tab
  // y el usuario no podría moverse de donde lo dejó el link: el parámetro sigue
  // en la URL, así que el efecto lo re-aplicaría para siempre. Es el mismo
  // cuidado que `lastSearchRef` en /whatsapp.
  const params = useSearchParams();
  const anclaAplicada = useRef(false);
  // ⚠️ El ancla se aplicaba UNA sola vez por montaje, y el App Router NO remonta el client
  // component al cambiar el query: estando ya en /chatbot, el segundo aviso de plantilla
  // rechazada no hacía nada. Se compara la query entera, como en /whatsapp.
  const ultimaQuery = useRef('');
  useEffect(() => {
    const q = params.toString();
    const cambio = q !== ultimaQuery.current;
    ultimaQuery.current = q;
    if (anclaAplicada.current && !cambio) return;
    // ⚠️ `?stab=` YA NO ELIGE NADA: las cuatro sub-tabs se fueron el 05/10 y la tab es
    // UNA sola pantalla. Los links viejos (`?stab=plantillas`, `?stab=dashboard`) caen
    // acá y abren el Chatbot, que es lo correcto: un parámetro que ya no existe no
    // puede dejar la pantalla en blanco. Las plantillas de Meta viven en /whatsapp y
    // los números en /chat-analyst.
    const sec = params.get('sec');
    if (!sec) { anclaAplicada.current = true; return; }
    // Hay que esperar a que carguen: sin la lista no se puede resolver ni la
    // clave ni comprobar que el id exista. Y comprobar que exista importa —
    // abrir el wizard con un id de otro workspace mostraría una secuencia vacía
    // en vez de decir que no está.
    if (secuencias === null) return;
    // Se acepta el id numérico Y la clave («noshow»): MaKo arma el link desde el
    // catálogo de capacidades, donde tiene el nombre de la secuencia y no
    // siempre su id.
    const n = Number(sec);
    const hallada = Number.isInteger(n) && n > 0
      ? secuencias.find((s) => s.id === n)
      : secuencias.find((s) => s.clave === sec);
    if (hallada) setWizard(hallada.id);
    anclaAplicada.current = true;
  }, [params, secuencias]);

  const etiquetaEtapa = useCallback(
    (key: string) => etapas.find((e) => e.value === key)?.label ?? ETAPA_LABEL[key] ?? key,
    [etapas],
  );

  // Mientras no sabemos si va el onboarding o la tab, NO se pinta ninguna de
  // las dos: mostrar la tab y reemplazarla medio segundo después por el wizard
  // es un flash que hace sentir la app rota.
  // OJO con `height: '100vh'` en este main: es hijo de una columna flex, y
  // `flex: 1` implica `flex-basis: 0%`, que ANULA el height. El main colapsa a
  // la altura del spinner y el `alignItems: center` no tiene nada que centrar →
  // loader diminuto pegado al techo. Va `minHeight`, que sí manda.
  if (enOnboarding === null) {
    return (
      <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
        <span style={{ width: 34, height: 34, border: '3px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
        <span style={{ fontSize: 14, color: 'var(--dim)' }}>Abriendo tu Chatbot…</span>
      </main>
    );
  }

  // El onboarding cubre la tab (mismo chrome que el global, pero embebido: el
  // sidebar sigue visible). Al terminarlo —o al elegir "lo configuro después"—
  // se entra a la vista normal.
  if (enOnboarding && preguntarPlan && plan === null) {
    return <ElegirRecorrido onElegir={(k) => { setPlan(k); setPreguntarPlan(false); }} onSaltar={() => setEnOnboarding(false)} />;
  }

  if (enOnboarding) {
    return (
      <OnboardingChatAgent
        tab={plan ?? 'setting'}
        onListo={() => { setEnOnboarding(false); setPlan(null); void load(); }}
      />
    );
  }

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', padding: '30px 36px 40px' }}>
      {/* ⚠️ EL ENCABEZADO SE DESARMÓ EL 05/10/2026, y lo que se fue no fue por estética
          (Martín, textual): «Elimina las pestañas, ya no hay "Email" si todo se crea en
          un mismo lugar… Ya no hay plantillas si todo es lo mismo… Y la pestaña de
          dashboard ponlo en una nueva ruta dentro de "Analysts"», «Elimina el botón
          grande de "Nueva secuencia", si ya tenemos otro para eso… elimina lo de
          "Archivar todo…", elimina "Tus secuencias: pruébalas como el lead…"».

          Las cuatro sub-tabs partían UNA cosa en cuatro pantallas: el email y el
          WhatsApp son dos canales de la MISMA secuencia y se arman en el mismo lienzo,
          las plantillas de Meta son del canal oficial —que ya no gobierna este editor—
          y los números son otra pregunta, así que viven en /chat-analyst.

          Y los dos botones de la derecha: el de crear ya está en la grilla (la tarjeta
          punteada), y «Archivar todas» era una salida de emergencia para las secuencias
          que el sistema sembraba solo, que hace rato no se siembran. */}
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>
          <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="tag" size={34} /></span>
          Chatbot
        </h1>
      </header>

      {/* Qué etapas de nutrición quedaron sin secuencia. MaKo conoce el funnel
          entero, así que puede decir exactamente qué falta — y eso es más útil
          que lo que hacía antes, que era rellenarlas con secuencias de mentira. */}
      {/* EL NÚMERO CAÍDO CON LAS SECUENCIAS EN VERDE.
          Una secuencia dice «Activa» y eso se lee como que está enviando. Si el
          WhatsApp del negocio está desconectado, no envía nada: cada paso falla
          y se reintenta al día siguiente, para siempre y sin síntoma. Pasó en la
          cuenta del dueño — la sesión se cayó el 3/09, la tab siguió en verde, y
          el primer lead real de la secuencia recién prendida no recibió nada.
          El estado del número solo se veía en el onboarding, o sea justo hasta
          que el dueño lo terminaba.
          Solo se avisa si hay alguna secuencia ACTIVA: con todo pausado, el
          número desconectado no rompe nada y el aviso sería ruido. */}
      {canalCaido && (secuencias ?? []).some((s) => s.activa) && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--bad)', display: 'inline-flex' }}><Icon name="alert" size={17} /></span>
          <div style={{ fontSize: '13.5px', color: 'var(--ink)', flex: 1, minWidth: 220 }}>
            {canal.estado === 'sin_vincular' ? (
              <>Tienes secuencias activas y <strong>todavía no vinculaste tu WhatsApp</strong>. No se está enviando nada.</>
            ) : (
              canal.desvinculado ? (
                // ⚠️ EL DUEÑO LEYO «tu WhatsApp esta desconectado», ABRIO WHATSAPP
                // Y LO ENCONTRO PERFECTO. Y era cierto: su TELEFONO anda. Lo que
                // se cayo es el dispositivo vinculado que usa MaKo, y eso no se
                // nota desde el telefono salvo mirando «Dispositivos vinculados».
                // Nombrar el hecho —y decir que su telefono esta bien— es la
                // diferencia entre un aviso que se cree y uno que se descarta.
                <>Tienes secuencias activas y <strong>WhatsApp cerró la sesión del dispositivo vinculado</strong>
                  {canal.desde ? <> el {new Date(canal.desde).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</> : null}.
                  {' '}Tu teléfono está bien: lo que hay que volver a vincular es el dispositivo que usa MaKo.
                  {' '}Mientras tanto no se envía nada.</>
              ) : (
                <>Tienes secuencias activas y <strong>tu WhatsApp está desconectado</strong>
                  {canal.desde ? <> desde el {new Date(canal.desde).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</> : null}.
                  {' '}No se está enviando nada: cada mensaje falla y se reintenta al día siguiente.</>
              )
            )}
          </div>
          <Link href="/whatsapp" style={{ ...btnDark, textDecoration: 'none', whiteSpace: 'nowrap' }}>Volver a conectarlo</Link>
        </div>
      )}

      {rolAdmin && <HandoffsPanel handoffs={handoffs} onCambio={() => void load()} />}

      {/* ⚠️ ERA UNA BANDA ÁMBAR CON LAS SEIS ETAPAS ENUMERADAS Y UN BOTÓN NEGRO, y
          ocupaba más que el trabajo. Martín: «Haz que "Hay 6 etapas sin secuencia de
          mensajes:" sea mucho más sutil».

          Lo que el aviso tiene que decir sigue estando —cuántas etapas no reciben nada,
          y cuáles— pero en un renglón: el número y el detalle en el `title`, que es
          donde el largo no ocupa lugar. Un hueco no es un error: es trabajo que falta. */}
      {rolAdmin && huecos.length > 0 && (
        <div
          title={huecos.map((h) => h.label).join(', ')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12.5, color: 'var(--faint)' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)', flex: 'none' }} />
          <span>
            {huecos.length === 1
              ? <>{huecos[0].label} no tiene secuencia</>
              : <>{huecos.length} etapas sin secuencia</>}
          </span>
          <button onClick={() => setWizard('nueva')}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--primary)', cursor: 'pointer' }}>
            Armar una
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, color: 'var(--bad)', fontSize: '13.5px' }}>{error}</div>
      )}

      {secuencias === null && !error && <div style={{ color: 'var(--dim)', fontSize: '14px' }}>Cargando secuencias…</div>}

      {secuencias !== null && secuencias.length === 0 && !error && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 14, padding: '28px 24px', color: 'var(--dim)', fontSize: '14px' }}>
          Todavía no hay secuencias en este workspace.{rolAdmin ? ' Empieza con «+ Nueva secuencia de mensajes».' : ''}
          {rolAdmin && <div style={{ marginTop: 14 }}><button onClick={() => setWizard('nueva')} style={btnDark}>+ Nueva secuencia de mensajes</button></div>}
        </div>
      )}


      {secuencias !== null && secuencias.length > 0 && (
        <SimuladorWhatsApp
          secuencias={secuencias} objetivos={objetivos} etiquetaEtapa={etiquetaEtapa} productos={productos} disparadores={disparadores}
          negocio={negocio} rolAdmin={rolAdmin} audios={audios} canalCaido={canalCaido} onAudioNuevo={(a) => setAudios((prev) => [a, ...prev.filter((x) => x.id !== a.id)])}
          onWizard={(id) => setWizard(id)} onReload={() => void load()}
        />
      )}

      {wizard !== null && (
        <SecuenciaWizard
          secuenciaId={wizard === 'nueva' ? null : wizard}
          secuencias={secuencias ?? []}
          objetivos={objetivos}
          etapas={etapas}
          leadMagnets={leadMagnets}
          audios={audios}
          onAudioNuevo={(a) => setAudios((prev) => [a, ...prev.filter((x) => x.id !== a.id)])}
          onClose={() => setWizard(null)}
          onDone={() => { setWizard(null); void load(); }}
        />
      )}
    </main>
  );
}

/**
 * Primera pantalla del Chatbot cuando no hay NADA configurado: en vez de
 * empujar los 11 pasos, se pregunta por dónde arrancar. Cada opción es un
 * recorrido real (lib/tab-onboarding-state.ts) y comparten los pasos, así que
 * elegir "solo WhatsApp" hoy y "todo" mañana no repite lo ya hecho.
 */
function ElegirRecorrido({ onElegir, onSaltar }: {
  onElegir: (k: 'setting' | 'whatsapp' | 'email') => void;
  onSaltar: () => void;
}) {
  const OPCIONES: Array<{ k: 'setting' | 'whatsapp' | 'email'; icono: string; titulo: string; sub: string; detalle: string }> = [
    { k: 'setting', icono: '✦', titulo: 'Todo', sub: 'Recorrido completo', detalle: 'Los dos métodos de WhatsApp, el email, tu forma de escribir, tus audios y las secuencias de mensajes.' },
    { k: 'whatsapp', icono: '💬', titulo: 'Solo WhatsApp', sub: 'Conectar y verificar el canal', detalle: 'Tu número de empresa, la verificación de entrega y el canal oficial si lo necesitas.' },
    { k: 'email', icono: '✉️', titulo: 'Solo Email', sub: 'Conectar y verificar la bandeja', detalle: 'Tu dominio verificado y un correo de prueba a tu bandeja.' },
  ];
  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>✦ Chatbot</div>
        <h1 style={{ fontWeight: 700, fontSize: 30, letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 8px' }}>¿Por dónde arrancamos?</h1>
        <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 26px', lineHeight: 1.55 }}>Puedes configurarlo todo de una vez o avanzar canal por canal. Lo que completes ahora no se vuelve a pedir.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPCIONES.map((o) => (
            <button key={o.k} type="button" onClick={() => onElegir(o.k)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '15px 17px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>
              <span aria-hidden style={{ flex: 'none', width: 40, height: 40, borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{o.icono}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{o.titulo}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>{o.sub}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.5 }}>{o.detalle}</span>
              </span>
              <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 15 }}>→</span>
            </button>
          ))}
        </div>

        <button type="button" onClick={onSaltar}
          style={{ marginTop: 20, background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13, cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>
          Configurar más tarde
        </button>
      </div>
    </main>
  );
}
