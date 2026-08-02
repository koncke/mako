'use client';

// =============================================================================
// OnboardingChatAgent — el recorrido que deja la tab Chat Agent lista
// =============================================================================
// Aplica la metodología de .claude/skills/tab-onboarding (Conectar → Contexto →
// Ensayo) con el MISMO chrome que el onboarding global (WizardShell fullscreen +
// PanelMarketing), para que se vea idéntico y no haya que aprender otra cosa.
//
// ① canales  — conectar Y PROBAR (que llegue el mensaje de verdad)
// ② contexto — cómo conversás: se lee de tus chats reales, no se te pregunta
// ③ voz      — tus audios, con MaKo dictándote el guion antes de grabar
// ④ ensayo   — MaKo hace de CLIENTE y vos respondés: de ahí salen las secuencias
// ⑤ aprobar  — mirás lo que quedó, lo probás y lo prendés

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { PanelMarketing } from '@/app/_components/PanelMarketing';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { SeccionCard, parsearSecciones } from '../components/SeccionCard';
import { Icon } from '@/app/_components/icons';
import { Avatar } from '../whatsapp/_shared/Avatar';

/**
 * Loader estándar: cualquier espera se muestra, nunca se deja la pantalla muda.
 * Ocupa el ancho y respira: un spinner diminuto arriba a la izquierda no se lee
 * como "la app está trabajando", se lee como un detalle perdido.
 */
function Cargando({ texto }: { texto: string }) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '34px 16px', color: 'var(--dim)', fontSize: 13.5, textAlign: 'center' }}>
      <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
      <span style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
      {texto}
    </div>
  );
}

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type PasoKey =
  | 'contexto' | 'voz' | 'ensayo' | 'aprobar'
  | 'wa_no_oficial' | 'wa_no_oficial_prueba'
  | 'wa_oficial' | 'wa_oficial_plantilla' | 'wa_oficial_prueba'
  | 'email_conectar' | 'email_prueba';
type Estado = { status: 'pendiente' | 'done'; steps: Record<string, { done: boolean }> };
type Def = { key: string; titulo: string; pasos: Array<{ key: string; label: string }> };
type Conversacion = {
  /** Últimos 10 dígitos del teléfono: agrupa entrantes y salientes. */
  clave: string;
  /** Todos los jids de la charla — el análisis filtra por el conjunto. */
  jids: string[];
  nombre: string | null; telefono: string | null;
  mensajes: number; propios: number; muestra: string | null;
  /** Tiene ida y vuelta suficiente para aprender el estilo. */
  apta: boolean;
  clase: 'cliente' | 'personal' | 'no_se';
  razon: string; esLead: boolean;
};

// Títulos CORTOS y descriptivos, como el resto del onboarding ("El Archivero",
// "Tu personalidad", "Tu diagnóstico"). El subtítulo dice EL OBJETIVO del paso
// en una línea — qué se busca, no cómo funciona. Todo lo demás va en la caja de
// contexto, ABAJO de la acción, para no interrumpir.
const PREGUNTA: Record<PasoKey, { q: string; sub?: string }> = {
  wa_no_oficial: { q: 'Tu WhatsApp: Método NO Oficial' },
  wa_no_oficial_prueba: { q: 'Verificación de seguridad' },
  contexto: { q: 'Tu forma de escribir', sub: 'Analizo tus conversaciones para aprender tu tono, tus preguntas y tu forma de cerrar.' },
  voz: { q: 'Tus audios' },
  ensayo: { q: 'Ensayo de conversación', sub: 'Simulo ser un lead y respondes como lo harías. De ahí salen tus mensajes.' },
  aprobar: { q: 'Tus jugadas' },
  wa_oficial: { q: 'Tu WhatsApp: Método Oficial' },
  wa_oficial_plantilla: { q: 'Tu primera plantilla' },
  wa_oficial_prueba: { q: 'Verificación del canal oficial' },
  email_conectar: { q: 'Tu email' },
  email_prueba: { q: 'Verificación del email' },
};

// Contexto: va ABAJO del todo, después de la acción. Nunca entre el título y el
// botón, porque nadie lee un párrafo antes de poder hacer algo.
//
// Molde: el mismo bloque gris de "¿Por qué debes colocar tu API de Gemini?"
// (app/onboarding/OnboardingWizard.tsx) — fondo surface-2, borde, eyebrow mono
// en mayúscula. Adentro va prosa cuando el contenido es una explicación, y lista
// solo cuando de verdad son elementos paralelos. No todo es una lista.
type AyudaSeccion = {
  titulo: string;
  /** Explicación en prosa. Se usa cuando el contenido NO es una enumeración. */
  texto?: string;
  /** Lista, solo cuando los elementos son realmente paralelos entre sí. */
  puntos?: string[];
};
type AyudaDef = {
  titulo: string;
  /** Respuesta corta, visible sin desplegar nada. */
  intro?: string;
  secciones?: AyudaSeccion[];
  /** Una recomendación, no una obligación: se sugiere y se explica el porqué. */
  recomendacion?: { titulo: string; texto: string };
};

const AYUDA: Partial<Record<PasoKey, AyudaDef>> = {
  wa_no_oficial: {
    titulo: '¿Por qué el método no oficial?',
    intro: 'Es tu propio número de WhatsApp, vinculado mediante un código QR. MaKo escribe desde ahí igual que lo harías tú: sin plantillas que aprobar y sin costo por mensaje. A cambio, es un número común y WhatsApp puede restringirlo si detecta un patrón de spam; abajo está qué se hace para evitarlo.',
    secciones: [
      {
        titulo: 'Ventajas frente al método oficial',
        puntos: [
          'Escribes con libertad: ningún mensaje necesita la aprobación previa de Meta.',
          'Puedes enviar notas de voz, un formato que el método oficial no admite.',
          'El destinatario ve tu foto y tu nombre. Le escribe una persona, no una marca.',
          'Se conecta en dos minutos escaneando un código QR, sin verificación de empresa ni Business Manager.',
          'No se paga por conversación.',
        ],
      },
      {
        titulo: 'Para qué sirve entonces el oficial',
        texto: 'El método oficial usa un número verificado por Meta, pensado para volumen alto y campañas de tráfico frío. A cambio exige plantillas aprobadas para cada mensaje de apertura, no admite notas de voz y se cobra por conversación. Los dos conviven: el oficial para escalar, este para conversar.',
      },
      {
        titulo: 'El riesgo de bloqueo, y cómo se reduce',
        texto: 'Conviene decirlo claro: este método usa un número común, y WhatsApp puede restringirlo o bloquearlo si detecta un patrón que le parece spam. No hay forma de eliminar ese riesgo — solo de reducirlo, y eso es lo que hace el sistema:',
        puntos: [
          'Un tope de mensajes por día y un máximo por tanda, para evitar ráfagas.',
          'Una espera mínima entre dos mensajes al mismo contacto.',
          'Ventana horaria: solo entre las 9 y las 21 de tu zona horaria.',
          'Cada mensaje se redacta distinto, en lugar de repetir el mismo texto.',
          'Si el contacto responde, la secuencia se detiene automáticamente.',
          'Si a un mensaje le queda un dato sin completar, no se envía y recibes un aviso.',
        ],
      },
      {
        titulo: 'Qué pasa si aun así lo bloquean',
        texto: 'La mayoría de los bloqueos empiezan con una restricción temporal, no con la baja definitiva: durante unas horas el número no puede enviar y después se recupera. Se puede apelar desde la propia aplicación de WhatsApp. Lo que no se recupera es la antigüedad del número, así que conviene no forzar el volumen los primeros días y dejar que el historial de conversaciones crezca solo. El método oficial existe justamente para el caso en que necesites volumen alto sin exponer un número común.',
      },
    ],
    recomendacion: {
      titulo: 'Conviene usar el número de la empresa',
      texto: 'El número que vincules es el que tus contactos van a guardar de forma permanente, y el que va a quedar asociado a tu actividad comercial. Por eso recomendamos usar el de la empresa: mantiene separado lo laboral de lo personal y te deja cambiar de equipo o delegar la atención sin arrastrar tu línea privada. Si por ahora solo dispones del personal, puedes usarlo igual: es una recomendación, no un requisito.',
    },
  },

  wa_no_oficial_prueba: {
    titulo: 'Por qué se envía un código',
    intro: 'Un número puede figurar como vinculado y aun así no entregar mensajes. El código confirma que el canal quedó operativo de punta a punta: si llega a tu teléfono, también llegará a tus contactos.',
  },

  contexto: {
    titulo: 'Qué analizo de tus conversaciones',
    intro: 'Busco tu manera de escribir, no el contenido de cada charla: cómo saludas, con qué preguntas averiguas si alguien encaja como cliente, cómo respondes a las objeciones y de qué forma propones el siguiente paso.',
    secciones: [
      {
        titulo: 'Privacidad',
        texto: 'Solo se analizan las conversaciones que selecciones, una por una. El resultado es un resumen de tu estilo; el contenido de cada conversación no se guarda ni se reutiliza.',
      },
    ],
  },

  wa_oficial: {
    titulo: '¿Por qué el método oficial?',
    intro: 'Es un número verificado por Meta a través de la API de WhatsApp Business. Está pensado para volumen alto y para campañas donde el número propio quedaría expuesto.',
    secciones: [
      {
        titulo: 'Qué aporta',
        puntos: [
          'Un número verificado, con tilde de empresa y nombre comercial.',
          'Límites de envío que suben a medida que se mantiene una buena calificación de calidad.',
          'Aislamiento: si algo sale mal, no compromete tu número personal ni el de la empresa.',
        ],
      },
      {
        titulo: 'Qué exige a cambio',
        texto: 'Cada mensaje de apertura debe ser una plantilla aprobada por Meta, y la revisión puede tardar horas o días. No admite notas de voz, el número no puede estar activo en la aplicación de WhatsApp y se cobra por conversación según el país. Puedes omitir este paso por ahora: con tu número de empresa es suficiente para empezar.',
      },
    ],
  },

  email_conectar: {
    titulo: 'Por qué también email',
    intro: 'Es el canal para quien no responde por WhatsApp: permite insistir sin desgastar el número y llegar a bases antiguas donde escribir por WhatsApp sería arriesgado.',
    secciones: [
      {
        titulo: 'Qué hay que hacer',
        texto: 'MaKo da de alta tu dominio; tú solo copias tres registros en la configuración DNS. Mientras la verificación no esté completa, los envíos quedan en modo simulado: se ven aquí, pero no salen.',
      },
    ],
  },
};

// Qué significa "completar con los datos de Mau" en cada paso: conectar trae
// sus credenciales, el resto trae sus jugadas y su voz.
const AMBITO_DEL_PASO: Record<PasoKey, string> = {
  wa_no_oficial: 'integraciones', wa_no_oficial_prueba: 'integraciones',
  wa_oficial: 'integraciones', wa_oficial_plantilla: 'integraciones', wa_oficial_prueba: 'integraciones',
  email_conectar: 'integraciones', email_prueba: 'integraciones',
  contexto: 'setting', voz: 'setting', ensayo: 'setting', aprobar: 'setting',
};

const btn: CSSProperties = { padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnDark: CSSProperties = { ...btn, border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 14, outline: 'none' };
const okBox: CSSProperties = { padding: '10px 13px', borderRadius: 10, border: '1px solid var(--good)', background: 'var(--good-bg)', color: 'var(--good)', fontSize: 13 };

export function OnboardingChatAgent({ onListo, tab = 'setting' }: { onListo: () => void; tab?: 'setting' | 'whatsapp' | 'email' }) {
  const [def, setDef] = useState<Def | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [idx, setIdx] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Paso canales ──
  const [canales, setCanales] = useState<{ oficialConectado: boolean; evolutionConectado: boolean; envioHabilitado: boolean } | null>(null);
  // WhatsApp de empresa: el QR se genera y se escanea ACÁ, sin mandar a otra tab.
  const [evo, setEvo] = useState<{ estado: string; numero: string | null } | null>(null);
  // Estado propio: `busy` es el del wizard (marcar el paso y avanzar), y
  // compartirlo hacía que al apretar "Siguiente" el botón de desconectar
  // pasara a decir "Desconectando…". Cada acción muestra SU propio progreso.
  const [busyEvo, setBusyEvo] = useState<null | 'conectar' | 'desconectar'>(null);
  const [qrEvo, setQrEvo] = useState<{ base64: string | null } | null>(null);
  const [codigo, setCodigo] = useState('');
  // A dónde se manda el código. Se resuelve solo en el server (el número
  // recién vinculado por QR); solo se pide si no hay ninguno.
  const [destino, setDestino] = useState<string | null>(null);
  const [pideNumero, setPideNumero] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [verificado, setVerificado] = useState(false);

  // ── Paso contexto: elegir QUÉ chats puede leer, y el resultado ──
  const [convs, setConvs] = useState<Conversacion[] | null>(null);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [busq, setBusq] = useState('');
  // Vincular el número NO trae el historial: el espejo de mensajes se llena
  // con lo que va llegando por webhook. Las conversaciones que ya existen en
  // el teléfono hay que pedirlas, y este paso las necesita para leer el estilo.
  const [importando, setImportando] = useState(false);
  // Los personales quedan plegados, nunca escondidos: si la IA se equivoca, el
  // dueño tiene que poder encontrar igual su mejor conversación de ventas.
  const [verPersonales, setVerPersonales] = useState(false);
  // El número dejó de estar vinculado: no hay conversaciones que mostrar y el
  // paso no se puede completar hasta que se vuelva a escanear.
  const [desvinculado, setDesvinculado] = useState(false);
  const [yaImporto, setYaImporto] = useState(false);
  const [contexto, setContexto] = useState<{ leido: boolean; resumen: string } | null>(null);

  // ── Paso ensayo ──
  const [msgs, setMsgs] = useState<HiloMsg[]>([]);
  const [typing, setTyping] = useState<{ lado: 'left' | 'right' } | null>(null);
  const seq = useRef(0);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch(`/api/chat-agent/onboarding?tab=${tab}`, { cache: 'no-store' })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo cargar el onboarding.'); return; }
      setDef(j.def); setEstado(j.estado);
      // Retomar donde quedó: primer paso sin hacer.
      const i = (j.def?.pasos ?? []).findIndex((p: { key: string }) => !j.estado?.steps?.[p.key]?.done);
      setIdx(i < 0 ? 0 : i);
    } catch { setErr('Sin conexión — recargá la página.'); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  // Estado de los canales al entrar al paso 1.
  useEffect(() => {
    if (def?.pasos[idx]?.key !== 'canales' || canales) return;
    void (async () => {
      try {
        const j = await (await fetch('/api/chat-agent/envio', { cache: 'no-store' })).json();
        if (j.ok) setCanales({ oficialConectado: j.oficialConectado, evolutionConectado: j.evolutionConectado, envioHabilitado: j.envioHabilitado });
      } catch { /* sin datos */ }
    })();
  }, [def, idx, canales]);

  const pasoKey = (def?.pasos[idx]?.key ?? 'wa_no_oficial') as PasoKey;
  const enUltimo = !!def && idx === def.pasos.length - 1;
  const pasoKeyRef = useRef<PasoKey>(pasoKey);
  pasoKeyRef.current = pasoKey;
  const convsFiltradas = (convs ?? []).filter((c) => {
    if (!verPersonales && c.clase === 'personal') return false;
    const q = busq.trim().toLowerCase();
    return !q || (c.nombre ?? '').toLowerCase().includes(q) || (c.telefono ?? '').includes(q);
  });

  async function marcarPaso() {
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/chat-agent/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'paso', paso: pasoKey, tab }),
      })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo guardar el avance.'); return; }
      setEstado(j.estado);
      if (j.estado.status === 'done') { onListo(); return; }
      setIdx((i) => Math.min((def?.pasos.length ?? 1) - 1, i + 1));
    } finally { setBusy(false); }
  }

  // ── WhatsApp de empresa: estado, QR y detección automática del escaneo ──
  const evoApi = useCallback(async (action: string) => {
    const r = await fetch('/api/whatsapp/evolution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    return r.json() as Promise<{ ok: boolean; error?: string; estado?: string; numero?: string | null; qr?: { base64: string | null } }>;
  }, []);

  const pidiendoEvo = useRef(false);
  useEffect(() => {
    if (pasoKeyRef.current !== 'wa_no_oficial' || evo !== null || pidiendoEvo.current) return;
    pidiendoEvo.current = true;
    void (async () => {
      try { const j = await evoApi('estado'); setEvo({ estado: j.estado ?? 'desconectado', numero: j.numero ?? null }); }
      catch { setEvo({ estado: 'desconectado', numero: null }); }
      finally { pidiendoEvo.current = false; }
    })();
  });

  // Mientras hay un QR en pantalla, preguntamos solos si ya lo escaneó: el
  // usuario no tiene que avisarnos con un botón.
  useEffect(() => {
    if (pasoKey !== 'wa_no_oficial' || !qrEvo || evo?.estado === 'conectado') return;
    const t = setInterval(() => {
      void (async () => {
        try {
          const j = await evoApi('estado');
          if (j.ok && j.estado) {
            setEvo({ estado: j.estado, numero: j.numero ?? null });
            if (j.estado === 'conectado') setQrEvo(null);
          }
        } catch { /* reintenta */ }
      })();
    }, 3000);
    return () => clearInterval(t);
  }, [pasoKey, qrEvo, evo?.estado, evoApi]);

  async function conectarEvo() {
    setBusyEvo('conectar'); setErr(null);
    try {
      const j = await evoApi('conectar');
      if (!j.ok) { setErr(j.error || 'No se pudo generar el código.'); return; }
      if (j.estado) setEvo({ estado: j.estado, numero: j.numero ?? null });
      if (j.qr) setQrEvo(j.qr);
    } finally { setBusyEvo(null); }
  }

  async function desconectarEvo() {
    setBusyEvo('desconectar'); setErr(null);
    try {
      const j = await evoApi('desconectar');
      if (!j.ok) { setErr(j.error || 'No se pudo desconectar.'); return; }
      setEvo({ estado: 'desconectado', numero: null }); setQrEvo(null);
    } finally { setBusyEvo(null); }
  }

  // ── Paso 1: prueba de vida ──
  async function enviarCodigo() {
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/chat-agent/onboarding/prueba', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enviar', telefono: telefono || undefined }),
      })).json();
      if (!j.ok) {
        // El único caso que necesita al usuario: no hay número por ningún lado.
        // Se pide acá mismo, no en otra pantalla.
        if (j.necesitaNumero) { setPideNumero(true); setErr(null); return; }
        setErr(j.error || 'No se pudo enviar el código.');
        return;
      }
      if (j.destino) setDestino(String(j.destino));
      setPideNumero(false);
      setCodigoEnviado(true);
    } finally { setBusy(false); }
  }
  async function verificarCodigo() {
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/chat-agent/onboarding/prueba', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verificar', codigo }),
      })).json();
      if (!j.ok) { setErr(j.error || 'El código no coincide.'); return; }
      setVerificado(true);
    } finally { setBusy(false); }
  }

  // ── Paso contexto: primero la lista de chats, después el análisis ──
  const cargarConvs = useCallback(async () => {
    try {
      const j = await (await fetch('/api/chat-agent/onboarding/conversaciones?clasificar=1', { cache: 'no-store' })).json();
      setDesvinculado(Boolean(j.desvinculado));
      setConvs(j.ok ? (j.conversaciones ?? []) : []);
    } catch { setConvs([]); }
  }, []);
  useEffect(() => { if (pasoKeyRef.current === 'contexto' && convs === null) void cargarConvs(); });

  async function importarConversaciones() {
    setImportando(true); setErr(null);
    try {
      const j = await (await fetch('/api/whatsapp/evolution', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sincronizar' }),
      })).json();
      if (!j.ok) { setErr(j.error || 'No se pudieron traer las conversaciones.'); return; }
      setYaImporto(true);
      setConvs(null);
      await cargarConvs();
    } catch {
      setErr('No se pudieron traer las conversaciones.');
    } finally { setImportando(false); }
  }

  async function ocultarConv(c: Conversacion) {
    if (!c.telefono) return;
    setConvs((prev) => (prev ?? []).filter((x) => x.clave !== c.clave));
    setElegidos((prev) => { const n = new Set(prev); n.delete(c.clave); return n; });
    try {
      // El mismo endpoint que usa la tab WhatsApp: el contacto queda oculto
      // ahí también, que es lo que el dueño espera al decir "esta no".
      await fetch('/api/whatsapp/evolution/block', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hide', telefono: c.telefono }),
      });
    } catch { /* si falla, vuelve a aparecer en la próxima carga */ }
  }

  async function leerConversaciones() {
    if (!elegidos.size) { setErr('Elegí al menos una conversación.'); return; }
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/chat-agent/onboarding/contexto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Se mandan todos los jids de cada charla elegida: una misma
        // conversación puede estar guardada bajo dos o tres jids distintos.
        body: JSON.stringify({ chats: (convs ?? []).filter((c) => elegidos.has(c.clave)).flatMap((c) => c.jids) }),
      })).json();
      if (!j.ok) { setErr(j.error || 'No pude leer tus conversaciones.'); return; }
      setContexto({ leido: true, resumen: j.resumen ?? '' });
    } finally { setBusy(false); }
  }

  // ── Paso 4: MaKo hace de cliente ──
  const arrancarEnsayo = useCallback(async () => {
    setTyping({ lado: 'left' });
    try {
      const j = await (await fetch('/api/chat-agent/onboarding/ensayo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ historial: [] }),
      })).json();
      if (j.ok && j.mensaje) setMsgs([{ id: `c-${++seq.current}`, fromMe: false, autor: 'Lead', texto: j.mensaje, fecha: new Date().toISOString() }]);
    } catch { /* el usuario puede escribir igual */ } finally { setTyping(null); }
  }, []);
  useEffect(() => { if (pasoKey === 'ensayo' && msgs.length === 0) void arrancarEnsayo(); }, [pasoKey, msgs.length, arrancarEnsayo]);

  async function responderComoNegocio(texto: string): Promise<boolean> {
    const conmigo: HiloMsg[] = [...msgs, { id: `y-${++seq.current}`, fromMe: true, texto, fecha: new Date().toISOString() }];
    setMsgs(conmigo);
    setTyping({ lado: 'left' });
    try {
      const historial = conmigo.map((m) => ({ de: m.fromMe ? 'negocio' : 'lead', texto: m.texto ?? '' }));
      const j = await (await fetch('/api/chat-agent/onboarding/ensayo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ historial }),
      })).json();
      if (j.ok && j.mensaje) setMsgs([...conmigo, { id: `c-${++seq.current}`, fromMe: false, autor: 'Lead', texto: j.mensaje, fecha: new Date().toISOString() }]);
      return true;
    } catch { return true; } finally { setTyping(null); }
  }

  const hecho = (k: PasoKey) => !!estado?.steps?.[k]?.done;
  const puedeAvanzar = (() => {
    if (busy) return false;
    // Solo se traba lo que de verdad no tiene sentido saltear: leer el contexto,
    // ensayar un poco, y que el canal principal esté probado. El resto (oficial,
    // email, plantillas) se puede completar después — trabar ahí pierde gente.
    if (pasoKey === 'contexto') return !!contexto?.leido || hecho('contexto');
    if (pasoKey === 'ensayo') return msgs.filter((m) => m.fromMe).length >= 2 || hecho('ensayo');
    // El estado EN VIVO es la única prueba de que el número está vinculado. La
    // memoria de una vinculación pasada no lo es: con `hecho(...)` en el OR, el
    // paso seguía dejando avanzar después de desvincular, mostrando el botón de
    // generar QR y un "Siguiente" habilitado al mismo tiempo.
    if (pasoKey === 'wa_no_oficial') return evo?.estado === 'conectado';
    if (pasoKey === 'wa_no_oficial_prueba') return verificado || hecho('wa_no_oficial_prueba');
    return true;
  })();

  const slides = [
    { t: 'Tu voz, no una plantilla', d: 'El primer mensaje que recibe un lead es un audio tuyo. Eso es lo que consigue que respondan.' },
    { t: 'Nada sale sin tu aprobación', d: 'Se arma todo aquí, lo pruebas en tu teléfono y se activa solo cuando lo indiques.' },
  ];

  return (
    <WizardShell
      fullscreen
      embebido
      titulo={def?.titulo ?? 'Chat Agent'}
      total={def?.pasos.length ?? 5}
      idx={idx}
      pregunta={PREGUNTA[pasoKey]?.q ?? ''}
      sub={PREGUNTA[pasoKey]?.sub}
      error={err}
      puedeAvanzar={puedeAvanzar}
      enUltimo={enUltimo}
      confirmLabel="Listo, entrar al Chat Agent"
      pending={busy}
      atrasLabel="Atrás"
      hideAtras={idx === 0}
      onAtras={() => setIdx((i) => Math.max(0, i - 1))}
      onSiguiente={() => void marcarPaso()}
      onConfirmar={() => void marcarPaso()}
      onClose={onListo}
      // Siempre, incluso en el primer paso: si no, alguien que vuelve a un
      // onboarding reabierto queda sin ninguna salida.
      extraFooter={<button onClick={onListo} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13, cursor: 'pointer' }}>Lo configuro después</button>}
      escenario={<PanelMarketing servicioKey="whatsapp" nombre="Chat Agent" slides={slides} eyebrow="✦ Dejemos tu Chat Agent listo" />}
    >
      {/* WHATSAPP NO OFICIAL — el QR se genera y se escanea en este mismo paso */}
      {pasoKey === 'wa_no_oficial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
          {evo === null ? (
            <Cargando texto="Comprobando la conexión…" />
          ) : evo.estado === 'conectado' ? (
            // Confirmación + la acción destructiva como ícono al final de la
            // misma fila: un botón de texto en rojo pesa más que el estado que
            // acompaña, y acá lo importante es que quedó conectado.
            <div style={{ ...okBox, width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}><Icon name="check" size={17} /></span>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                Número conectado{evo.numero ? <> · <strong>{evo.numero}</strong></> : null}
              </span>
              <button
                type="button" onClick={() => void desconectarEvo()} disabled={busyEvo !== null}
                title="Desconectar este número" aria-label="Desconectar este número"
                style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid transparent', background: 'transparent', color: 'var(--bad)', cursor: busyEvo ? 'default' : 'pointer', opacity: busyEvo === 'desconectar' ? 0.5 : 1 }}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ) : qrEvo?.base64 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrEvo.base64} alt="Código QR para vincular WhatsApp" style={{ width: 230, height: 230, borderRadius: 12, border: '1px solid var(--border)', background: '#fff' }} />
              <Cargando texto="Esperando el escaneo…" />
              <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>WhatsApp → Dispositivos vinculados → Vincular dispositivo</div>
            </>
          ) : (
            <button onClick={() => void conectarEvo()} disabled={busyEvo !== null} style={btnDark}>
              {busyEvo === 'conectar' ? 'Generando el código…' : 'Generar código QR'}
            </button>
          )}
        </div>
      )}

      {/* VERIFICACIÓN — que el mensaje llegue de verdad */}
      {pasoKey === 'wa_no_oficial_prueba' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
          {verificado ? (
            <div style={{ ...okBox, width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
              <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}><Icon name="check" size={17} /></span>
              Canal verificado. El mensaje llegó correctamente.
            </div>
          ) : !codigoEnviado ? (
            <>
              {pideNumero && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 7, textAlign: 'left' }}>
                  <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>
                    ¿A qué número lo enviamos?
                  </label>
                  <input
                    value={telefono} autoFocus inputMode="tel" placeholder="52 55 1234 5678"
                    onChange={(e) => setTelefono(e.target.value.replace(/[^\d+ ]/g, ''))}
                    style={{ ...inp, textAlign: 'center', letterSpacing: '.04em' }}
                  />
                </div>
              )}
              <button onClick={() => void enviarCodigo()} disabled={busy || (pideNumero && telefono.replace(/\D/g, '').length < 8)}
                style={{ ...btnDark, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: pideNumero && telefono.replace(/\D/g, '').length < 8 ? 0.5 : 1 }}>
                <span aria-hidden style={{ display: 'inline-flex' }}><Icon name="plug" size={16} /></span>
                {busy ? 'Enviando…' : 'Enviar código de verificación'}
              </button>
              {!pideNumero && (
                <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Llega al número que acabas de vincular.</div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              {destino && (
                <div style={{ flexBasis: '100%', fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>
                  Enviado a <strong style={{ color: 'var(--dim)' }}>+{destino}</strong>
                </div>
              )}
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" autoFocus
                style={{ ...inp, width: 130, textAlign: 'center', letterSpacing: '.3em', fontFamily: MONO }} />
              <button onClick={() => void verificarCodigo()} disabled={busy || codigo.length < 4} style={{ ...btnDark, opacity: codigo.length < 4 ? 0.5 : 1 }}>Verificar</button>
              <button onClick={() => void enviarCodigo()} disabled={busy} style={btn}>Reenviar</button>
            </div>
          )}
        </div>
      )}

      {/* ⑦ WHATSAPP OFICIAL — conectar */}
      {pasoKey === 'wa_oficial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {canales?.oficialConectado ? (
            <div style={okBox}>✓ El oficial ya está conectado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
                Se conecta pegando un solo token de Meta en Configuraciones → Método; MaKo descubre el resto de los datos solo.
              </div>
              <a href="/integraciones" target="_blank" rel="noreferrer" style={{ ...btnDark, alignSelf: 'center', textDecoration: 'none', display: 'inline-block' }}>Abrir integraciones ↗</a>
            </div>
          )}
        </div>
      )}

      {/* ⑧ WHATSAPP OFICIAL — plantilla */}
      {pasoKey === 'wa_oficial_plantilla' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Meta revisa cada mensaje de apertura antes de dejarte usarlo (tarda de minutos a unas horas). Como ya escribiste tus jugadas, mando una de esas a aprobar en vez de inventar una nueva.
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            Se manda desde la sub-tab <strong style={{ color: 'var(--ink)' }}>Plantillas</strong> de WhatsApp, o desde el paso de MaKo de cada jugada. Mientras Meta no apruebe, el motor no manda ese paso — nunca sale un mensaje que Meta rechazaría.
          </div>
        </div>
      )}

      {/* ⑨ WHATSAPP OFICIAL — prueba */}
      {pasoKey === 'wa_oficial_prueba' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Con la plantilla aprobada, prueba una jugada desde su perfil («Probar de verdad»): te llega exactamente igual que al lead.
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Si aún está en revisión puedes continuar: el resto de la sección funciona igual.</div>
        </div>
      )}

      {/* ⑩ EMAIL — conectar */}
      {pasoKey === 'email_conectar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <a href="/email" target="_blank" rel="noreferrer" style={{ ...btnDark, alignSelf: 'center', textDecoration: 'none', display: 'inline-block' }}>Configurar mi dominio ↗</a>
        </div>
      )}

      {/* ⑪ EMAIL — prueba */}
      {pasoKey === 'email_prueba' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Cuando el dominio esté verificado, probá una jugada con pasos de email desde su perfil: te llega el correo a tu casilla, con tu remitente.
          </div>
        </div>
      )}

      {/* CONTEXTO — elegir chats → analizar → resultado en secciones */}
      {pasoKey === 'contexto' && !contexto?.leido && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {convs === null ? (
            <Cargando texto="Buscando tus conversaciones…" />
          ) : importando ? (
            <Cargando texto="Trayendo tus conversaciones del teléfono…" />
          ) : desvinculado ? (
            <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, textAlign: 'center' }}>
              Tu número no está vinculado. Vuelve al paso de conexión y escanea el código QR para poder leer tus conversaciones.
            </div>
          ) : convs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, textAlign: 'center' }}>
                {yaImporto
                  ? 'No se encontraron conversaciones con suficiente ida y vuelta. Puedes continuar: se escribirá con el perfil de tu negocio y se ajustará cuando empieces a conversar.'
                  : 'Vincular el número no trae el historial. Se importan las conversaciones del teléfono para poder leer tu estilo.'}
              </div>
              {!yaImporto && (
                <button onClick={() => void importarConversaciones()} disabled={importando}
                  style={{ ...btnDark, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden style={{ display: 'inline-flex' }}><Icon name="whatsapp" size={16} /></span>
                  Traer mis conversaciones
                </button>
              )}
            </div>
          ) : (
            <>
              <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar contacto…" style={inp} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--faint)', flexWrap: 'wrap' }}>
                <span>{elegidos.size} de {convsFiltradas.length}</span>
                <button onClick={() => setElegidos(new Set(convsFiltradas.filter((c) => c.apta).map((c) => c.clave)))} style={{ ...btn, padding: '4px 10px', fontSize: 12 }}>Elegir todas</button>
                {elegidos.size > 0 && <button onClick={() => setElegidos(new Set())} style={{ ...btn, padding: '4px 10px', fontSize: 12 }}>Ninguna</button>}
                <span style={{ flex: 1 }} />
                <button onClick={() => setVerPersonales((v) => !v)} style={{ ...btn, padding: '4px 10px', fontSize: 12 }}>
                  {verPersonales ? 'Ocultar personales' : `Ver personales (${(convs ?? []).filter((c) => c.clase === 'personal').length})`}
                </button>
              </div>

              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface-2)' }}>
                {convsFiltradas.map((c) => {
                  const on = elegidos.has(c.clave);
                  const nombre = c.nombre || c.telefono || 'Sin nombre';
                  return (
                    <div key={c.clave}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px 9px 12px', borderBottom: '1px solid var(--border)', background: on ? 'var(--good-bg)' : 'transparent' }}>
                      <button type="button" aria-label={on ? `Quitar ${nombre}` : `Elegir ${nombre}`}
                        onClick={() => setElegidos((prev) => { const n = new Set(prev); if (n.has(c.clave)) n.delete(c.clave); else n.add(c.clave); return n; })}
                        style={{ flex: 'none', width: 17, height: 17, borderRadius: 5, border: '1px solid ' + (on ? 'var(--good)' : 'var(--border-strong)'), background: on ? 'var(--good)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                        {on ? '✓' : ''}
                      </button>

                      <Avatar telefono={c.telefono} name={nombre} size={34} />

                      <button type="button"
                        onClick={() => setElegidos((prev) => { const n = new Set(prev); if (n.has(c.clave)) n.delete(c.clave); else n.add(c.clave); return n; })}
                        style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
                          {c.esLead && <span style={{ flex: 'none', fontFamily: MONO, fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--good)', border: '1px solid var(--good)', borderRadius: 5, padding: '1px 5px' }}>CRM</span>}
                        </span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.mensajes} mensajes{c.apta ? '' : ' · poca conversación'} · {c.muestra ?? ''}
                        </span>
                      </button>

                      <a href={`/whatsapp?canal=empresa&chat=${encodeURIComponent(c.jids[0] ?? '')}`} target="_blank" rel="noreferrer"
                        title="Abrir el chat" aria-label={`Abrir el chat con ${nombre}`}
                        style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)' }}>
                        <Icon name="whatsapp" size={14} />
                      </a>
                      <button type="button" onClick={() => void ocultarConv(c)}
                        title="Ocultar este contacto" aria-label={`Ocultar ${nombre}`}
                        style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer' }}>
                        <Icon name="eye-off" size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => void leerConversaciones()} disabled={busy || elegidos.size === 0} style={{ ...btnDark, alignSelf: 'center', opacity: busy || !elegidos.size ? 0.55 : 1 }}>
                {busy ? 'Leyendo…' : `🔎 Leer ${elegidos.size || ''} ${elegidos.size === 1 ? 'conversación' : 'conversaciones'}`}
              </button>
              {busy && <Cargando texto="Leyendo tus chats y sacando tu patrón… puede tardar unos segundos" />}
            </>
          )}
        </div>
      )}
      {pasoKey === 'contexto' && contexto?.leido && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>Esto entendí</div>
          {parsearSecciones(contexto.resumen).map((s, i) => (
            <SeccionCard key={s.titulo} s={s} abiertoDefault={i === 0} icono="💬" size="sm" />
          ))}
          <button onClick={() => { setContexto(null); setElegidos(new Set()); }} style={{ ...btn, alignSelf: 'center', marginTop: 4 }}>↻ Elegir otras conversaciones</button>
        </div>
      )}

      {/* ③ VOZ */}
      {pasoKey === 'voz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Grabá tus audios desde la sub-tab <strong style={{ color: 'var(--ink)' }}>🎙 Audios</strong> del Chat Agent. Con uno alcanza para arrancar: el de bienvenida.
          </div>
          <div style={{ padding: '13px 15px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Guion del audio de bienvenida:</div>
            ① Saludá y decí tu nombre.<br />
            ② Reconocé de dónde salió el dato («me llegaron tus datos del anuncio»).<br />
            ③ Dejale tu número por si necesita algo.<br />
            ④ Una sola pregunta abierta: a qué se dedica su negocio.
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Podés seguir sin grabarlo: los mensajes salen en texto hasta que lo hagas.</div>
        </div>
      )}

      {/* ④ ENSAYO — MaKo es el CLIENTE */}
      {pasoKey === 'ensayo' && (
        <div style={{ height: 380, display: 'flex', flexDirection: 'column' }}>
          <ChatHilo
            accent="var(--wa)"
            accentBubble="var(--wa-bubble)"
            mensajes={msgs}
            typing={typing}
            placeholder="Responde como lo harías normalmente…"
            onEnviarTexto={responderComoNegocio}
            vacio={<div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 13 }}>Preparando el escenario…</div>}
          />
        </div>
      )}

      {/* ⑤ APROBAR */}
      {pasoKey === 'aprobar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Con lo que ensayamos armé tus jugadas. Están <strong style={{ color: 'var(--ink)' }}>pausadas</strong>: entrá al Chat Agent, escuchá cómo quedaron, probalas en tu teléfono y prendelas cuando estés listo.
          </div>
          <div style={okBox}>No se envía nada a ningún lead hasta que actives «Envío real».</div>
        </div>
      )}
      {/* El contexto va SIEMPRE al final: explica sin interrumpir la acción. */}

      <Ayuda paso={pasoKey} />
    </WizardShell>
  );
}

/** El contexto del canal, DENTRO del paso: qué es, para qué sirve y qué cuidar. */
/** Una sección del contexto: cerrada por default, se abre la que interese. */
/** Una fila plegable dentro del bloque de contexto. Sin card propia: el bloque
 *  gris ya es el contenedor, anidar cards adentro ensucia la jerarquía. */
function AyudaFila({ s, ultima }: { s: AyudaSeccion; ultima: boolean }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button
        type="button" onClick={() => setAbierta((a) => !a)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SANS }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.titulo}</span>
        <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 11, transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </button>
      {abierta && (
        <div style={{ paddingBottom: ultima ? 2 : 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {s.texto && <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)', lineHeight: 1.65 }}>{s.texto}</p>}
          {s.puntos && (
            <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none' }}>
              {s.puntos.map((x, i) => (
                <li key={i} style={{ position: 'relative', paddingLeft: 14, fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
                  <span aria-hidden style={{ position: 'absolute', left: 0, top: 8, width: 4, height: 4, borderRadius: 999, background: 'var(--border-strong)' }} />
                  {x}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * El contexto del paso, en UN bloque gris. Mismo molde que la caja de la API de
 * Gemini del onboarding global: fondo surface-2, borde, eyebrow mono. La
 * respuesta corta se lee sin abrir nada; el detalle se despliega.
 */
function Ayuda({ paso }: { paso: PasoKey }) {
  const a = AYUDA[paso];
  if (!a) return null;
  const secciones = a.secciones ?? [];
  return (
    <div style={{ textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 7 }}>{a.titulo}</div>

      {a.intro && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>{a.intro}</p>
      )}

      {secciones.length > 0 && (
        <div style={{ marginTop: a.intro ? 10 : 0 }}>
          {secciones.map((sec, i) => <AyudaFila key={sec.titulo} s={sec} ultima={i === secciones.length - 1 && !a.recomendacion} />)}
        </div>
      )}

      {a.recomendacion && <Recomendacion r={a.recomendacion} />}
    </div>
  );
}

/** Una sugerencia con su porqué. Ámbar, no rojo: no es un error ni un bloqueo. */
function Recomendacion({ r }: { r: { titulo: string; texto: string } }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button
        type="button" onClick={() => setAbierta((a) => !a)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '10px 0 ' + (abierta ? '6px' : '2px'), background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SANS }}
      >
        <span aria-hidden style={{ flex: 'none', width: 18, height: 18, borderRadius: 999, background: 'var(--warn-bg)', border: '1px solid var(--warn)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--warn)', fontWeight: 700 }}>!</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.titulo}</span>
        <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 11, transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </button>
      {abierta && <p style={{ margin: '0 0 2px', paddingLeft: 27, fontSize: 13, color: 'var(--dim)', lineHeight: 1.65 }}>{r.texto}</p>}
    </div>
  );
}
