'use client';

// =============================================================================
// OnboardingChatAgent — el recorrido que deja la tab Chat Agent lista
// =============================================================================
// Aplica la metodología de .claude/skills/tab-onboarding (Conectar → Contexto →
// Ensayo) con el MISMO chrome que el onboarding global (WizardShell fullscreen +
// PanelMarketing), para que se vea idéntico y no haya que aprender otra cosa.
//
// ① canales  — conectar Y PROBAR (que llegue el mensaje de verdad)
// ② contexto — cómo vendés: se lee de tus chats reales, filtrando el soporte
// ③ voz      — los 3 audios, grabados acá mismo con el guion en tu voz
// ④ ensayo   — MaKo hace de CLIENTE y vos respondés: de ahí salen las secuencias de mensajes
// ⑤ aprobar  — se revisa lo que quedó, se prueba y se activa

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { PanelMarketing } from '@/app/_components/PanelMarketing';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { SeccionCard, parsearSecciones } from '../components/SeccionCard';
import { Icon } from '@/app/_components/icons';
import { Avatar } from '../whatsapp/_shared/Avatar';
import { GrabadorAudioPaso, type AudioGrabado } from './GrabadorAudioPaso';
import { AUDIOS_PASO } from '@/lib/audios-paso';
import { escenariosDe, type Escenario } from '@/lib/chat-agent-escenarios';

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
  /** Hay foto guardada: sin esto el avatar la pide igual y falla en silencio. */
  foto: boolean;
};

/** Un bloque de la voz que SÍ se pudo deducir, con las citas que lo respaldan. */
type BloqueVoz = { key: string; titulo: string; estado: string; texto: string; citas: string[] };
type PreguntaVoz = { key: string; pregunta: string; opciones: string[] };
type VozResultado = {
  deducido: BloqueVoz[];
  /** Los bloques sin evidencia. Se preguntan; no se inventan. */
  huecos: Array<{ key: string; label: string }>;
  preguntas: PreguntaVoz[];
  resumen: string;
  evidencia: { convsElegidas: number; convsConVenta: number; descartadas: string[]; mensajesVenta: number } | null;
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
  ensayo: { q: 'Ensayo de conversación' },
  aprobar: { q: 'Tus secuencias de mensajes' },
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
// sus credenciales, el resto trae sus secuencias y su voz.
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
  // Ocultar saca el contacto de la lista Y de la tab de WhatsApp: pide confirmar
  // en la propia fila, y deja deshacer, porque desaparecer sin aviso se lee como
  // que la app perdió el contacto.
  const [porOcultar, setPorOcultar] = useState<string | null>(null);
  const [oculto, setOculto] = useState<{ conv: Conversacion; idx: number } | null>(null);
  const [yaImporto, setYaImporto] = useState(false);
  // El resultado del análisis. `huecos` son los bloques que NO se pudieron
  // deducir: no se rellenan, se preguntan (mismo patrón que el Archivero).
  const [voz, setVoz] = useState<VozResultado | null>(null);
  // Por cuál de las preguntas de los huecos vamos. Al llegar al final se ve el
  // resumen y recién ahí se puede avanzar.
  const [pregIdx, setPregIdx] = useState(0);
  const [otra, setOtra] = useState('');
  const [escribiendoOtra, setEscribiendoOtra] = useState(false);

  // ── Paso voz: los 3 audios ──
  const [audios, setAudios] = useState<AudioGrabado[] | null>(null);
  const [porClave, setPorClave] = useState<Record<string, number>>({});
  const [audioAbierto, setAudioAbierto] = useState<string | null>(null);
  const [linkVideo, setLinkVideo] = useState('');

  // ── Paso ensayo ──
  const [msgs, setMsgs] = useState<HiloMsg[]>([]);
  const [typing, setTyping] = useState<{ lado: 'left' | 'right' } | null>(null);
  // Por cuál escenario va. Cada uno es una slide dentro del paso, no un paso
  // propio: los nueve son la misma pregunta contada nueve veces, y como pasos
  // reales multiplicarían los puntos del progreso por una sola decisión.
  const [escIdx, setEscIdx] = useState(0);
  // El lead no contestó a lo último que se le escribió. No es un error: es la
  // respuesta más común, y verla es el punto del escenario de silencio.
  const [sinRespuesta, setSinRespuesta] = useState(false);
  const seq = useRef(0);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch(`/api/chat-agent/onboarding?tab=${tab}`, { cache: 'no-store' })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo cargar el onboarding.'); return; }
      setDef(j.def); setEstado(j.estado);
      // Retomar donde quedó: primer paso sin hacer.
      const i = (j.def?.pasos ?? []).findIndex((p: { key: string }) => !j.estado?.steps?.[p.key]?.done);
      setIdx(i < 0 ? 0 : i);
    } catch { setErr('Sin conexión — recarga la página.'); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  // Estado de los canales al entrar al paso del WhatsApp oficial — es el único
  // que lo usa (para saber si ya está conectado).
  //
  // Antes comparaba contra 'canales', una clave que NO existe en PasoKey: quedó
  // de una versión previa del wizard. El fetch no corría nunca, `canales` se
  // quedaba en null y el paso wa_oficial mostraba SIEMPRE "no está conectado",
  // aunque lo estuviera.
  useEffect(() => {
    if (def?.pasos[idx]?.key !== 'wa_oficial' || canales) return;
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

  // ── Paso voz: biblioteca + qué audio cubre cada situación ──
  const cargarAudios = useCallback(async () => {
    try {
      const j = await (await fetch('/api/chat-agent/audios', { cache: 'no-store' })).json();
      if (!j.ok) { setAudios([]); return; }
      setAudios(j.audios ?? []);
      setPorClave(j.porClave ?? {});
      setLinkVideo(j.linkVideo ?? '');
      // Se abre el primero que falte, para no tener que buscar por dónde seguir.
      const falta = AUDIOS_PASO.find((d) => !(j.porClave ?? {})[d.clave]);
      setAudioAbierto(falta ? falta.clave : null);
    } catch { setAudios([]); }
  }, []);
  useEffect(() => { if (pasoKeyRef.current === 'voz' && audios === null) void cargarAudios(); });

  const audioDe = (clave: string): AudioGrabado | null => {
    const id = porClave[clave];
    return id ? ((audios ?? []).find((a) => a.id === id) ?? null) : null;
  };
  const nGrabados = AUDIOS_PASO.filter((d) => !!porClave[d.clave]).length;

  async function guardarLinkVideo() {
    try {
      await fetch('/api/chat-agent/audios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkVideo }),
      });
    } catch { /* se reintenta al volver a salir del campo */ }
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
    setPorOcultar(null);
    const idx = (convs ?? []).findIndex((x) => x.clave === c.clave);
    setOculto({ conv: c, idx: Math.max(0, idx) });
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

  async function deshacerOcultar() {
    if (!oculto) return;
    const { conv, idx } = oculto;
    setOculto(null);
    setConvs((prev) => { const n = [...(prev ?? [])]; n.splice(Math.min(idx, n.length), 0, conv); return n; });
    try {
      await fetch('/api/whatsapp/evolution/block', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unhide', telefono: conv.telefono }),
      });
    } catch { /* la próxima carga manda */ }
  }

  async function leerConversaciones() {
    if (!elegidos.size) { setErr('Elige al menos una conversación.'); return; }
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/chat-agent/onboarding/contexto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Se manda cada charla con TODOS sus jids agrupados, no una lista plana:
        // el análisis corta la etapa de venta por conversación, así que necesita
        // saber qué jids son la misma charla.
        body: JSON.stringify({
          conversaciones: (convs ?? []).filter((c) => elegidos.has(c.clave))
            .map((c) => ({ clave: c.clave, nombre: c.nombre || c.telefono || 'Sin nombre', jids: c.jids })),
        }),
      })).json();
      if (!j.ok) { setErr(j.error || 'No pude leer tus conversaciones.'); return; }
      setVoz(j as VozResultado);
      setPregIdx(0); setOtra(''); setEscribiendoOtra(false);
    } finally { setBusy(false); }
  }

  /** Guarda la respuesta de un hueco y pasa a la siguiente pregunta. */
  async function responderHueco(key: string, valor: string) {
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/chat-agent/onboarding/contexto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'responder', respuestas: { [key]: valor } }),
      })).json();
      // Se refrescan lo deducido y el resumen, pero NO la lista de preguntas:
      // recalcularlas a mitad de camino reordenaría lo que se está contestando.
      if (j.ok) setVoz((prev) => (prev ? { ...prev, deducido: j.deducido ?? prev.deducido, resumen: j.resumen ?? prev.resumen } : prev));
      else setErr(j.error || 'No se pudo guardar la respuesta.');
    } catch {
      setErr('Sin conexión — vuelve a intentarlo.');
    } finally {
      setBusy(false);
      setOtra(''); setEscribiendoOtra(false);
      setPregIdx((i) => i + 1);
    }
  }

  // ── Paso ensayo: un ESCENARIO por slide ──
  // Los escenarios que hablan del video de preparación solo entran si el
  // workspace configuró el link: ensayar cómo conseguir que vea un video que no
  // existe no enseña nada.
  const escenarios = escenariosDe(!!linkVideo.trim());
  const esc = escenarios[escIdx] ?? escenarios[0] ?? null;

  /** Abre el escenario: primero el audio del dueño, después la semilla del lead. */
  const abrirEscenario = useCallback((e: Escenario, audioUrl: string | null) => {
    // El audio del dueño va como PRIMER mensaje: es lo que de verdad recibe el
    // lead antes de contestar, y ensayar sin él sería ensayar otra cosa. Se
    // reproduce de verdad, con el archivo que se grabó en el paso anterior.
    const abre: HiloMsg[] = [{
      id: `a-${++seq.current}`, fromMe: true, autor: 'Tú',
      tipo: 'audio',
      mediaUrl: audioUrl,
      mediaMime: 'audio/mpeg',
      // Sin audio grabado la burbuja cae al "(no disponible)" que ChatHilo ya
      // sabe pintar, con este texto — no se rompe el ensayo por eso.
      texto: audioUrl ? null : 'Tu nota de voz',
      fecha: new Date().toISOString(),
    }];
    // La semilla es LITERAL, no generada: el modelo narraba la situación en vez
    // de encarnarla y salía siempre la misma frase explicativa.
    const semilla = e.primerMensaje.length
      ? e.primerMensaje[Math.floor(Math.random() * e.primerMensaje.length)]
      : null;
    if (semilla) {
      abre.push({ id: `c-${++seq.current}`, fromMe: false, autor: 'Lead', texto: semilla, fecha: new Date().toISOString() });
    }
    setMsgs(abre);
  }, []);

  useEffect(() => {
    if (pasoKey !== 'ensayo' || !esc || msgs.length > 0) return;
    const a = audioDe(esc.audio);
    abrirEscenario(esc, a?.url ?? null);
  }, [pasoKey, esc, msgs.length, abrirEscenario, audioDe]);

  async function responderComoNegocio(texto: string): Promise<boolean> {
    if (!esc) return true;
    const conmigo: HiloMsg[] = [...msgs, { id: `y-${++seq.current}`, fromMe: true, texto, fecha: new Date().toISOString() }];
    setMsgs(conmigo);
    setTyping({ lado: 'left' });
    try {
      const historial = conmigo
        .map((m) => ({ de: m.fromMe ? 'negocio' : 'lead', texto: (m.texto ?? '').trim() }))
        .filter((m) => m.texto);
      const j = await (await fetch('/api/chat-agent/onboarding/ensayo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escenario: esc.id, historial }),
      })).json();
      if (j.ok && j.mensaje) {
        setMsgs([...conmigo, { id: `c-${++seq.current}`, fromMe: false, autor: 'Lead', texto: j.mensaje, fecha: new Date().toISOString() }]);
        setSinRespuesta(false);
      } else if (j.ok && j.sinRespuesta) {
        // No hay burbuja: el lead no contestó. Es la respuesta más común de
        // todas y practicarla es justo el punto del escenario de silencio.
        setSinRespuesta(true);
      } else if (!j.ok && j.error) {
        setErr(j.error);
      }
      return true;
    } catch { return true; } finally { setTyping(null); }
  }

  /** Cuántas veces escribió el dueño en este escenario (el audio no cuenta). */
  const misRespuestas = msgs.filter((m) => m.fromMe && (m.texto ?? '').trim()).length;

  function siguienteEscenario() {
    setErr(null);
    setMsgs([]);
    setSinRespuesta(false);
    setEscIdx((i) => i + 1);
  }

  // Dentro del paso 'contexto' hay tres vistas: elegir las conversaciones,
  // contestar los huecos de a una, y el resumen. Se resuelve en UN solo lugar
  // para que la cabecera y el footer del shell no se contradigan entre sí.
  const preguntaActual = voz && pregIdx < voz.preguntas.length ? voz.preguntas[pregIdx] : null;
  const vistaContexto: 'elegir' | 'preguntas' | 'resumen' =
    !voz ? 'elegir' : preguntaActual ? 'preguntas' : 'resumen';

  const hecho = (k: PasoKey) => !!estado?.steps?.[k]?.done;
  const puedeAvanzar = (() => {
    if (busy) return false;
    // Solo se traba lo que de verdad no tiene sentido saltear: leer el contexto,
    // ensayar un poco, y que el canal principal esté probado. El resto (oficial,
    // email, plantillas) se puede completar después — trabar ahí pierde gente.
    // En 'preguntas' el avance lo manejan los botones de la propia tarjeta.
    if (pasoKey === 'contexto') return vistaContexto === 'resumen' || hecho('contexto');
    // Los 3 audios son obligatorios y se comprueban EN VIVO, no con `hecho`: si
    // el dueño borra uno después, el paso tiene que volver a pedirlo. La salida
    // sigue estando en "Lo configuro después" del pie — trabar el avance es lo
    // pedido; dejar el paso sin ninguna salida lo convertiría en una trampa.
    if (pasoKey === 'voz') return nGrabados === AUDIOS_PASO.length;
    // El ensayo avanza por escenarios con su propio botón; el footer se habilita
    // recién cuando se recorrieron todos.
    if (pasoKey === 'ensayo') return escIdx >= escenarios.length || hecho('ensayo');
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
      // En la vista de preguntas el título es la PREGUNTA: es lo que hay que
      // contestar, y repetir "Tu forma de escribir" ahí no dice nada.
      // En el ensayo el título es el ESCENARIO: es lo que define la slide, y
      // repetir "Ensayo de conversación" nueve veces no dice nada.
      pregunta={
        vistaContexto === 'preguntas' && preguntaActual ? preguntaActual.pregunta
          : pasoKey === 'ensayo' && esc ? esc.titulo
            : (PREGUNTA[pasoKey]?.q ?? '')
      }
      sub={
        vistaContexto === 'preguntas' ? `Pregunta ${pregIdx + 1} de ${voz?.preguntas.length ?? 0}`
          : pasoKey === 'ensayo' && esc ? esc.objetivo
            : PREGUNTA[pasoKey]?.sub
      }
      // La tarjeta de preguntas trae sus propios botones: sin esto quedarían dos
      // "Siguiente" a la vez, uno adentro y otro en el footer.
      hideSiguiente={vistaContexto === 'preguntas'}
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
            Meta revisa cada mensaje de apertura antes de dejarte usarlo (tarda de minutos a unas horas). Como ya escribiste tus secuencias de mensajes, mando una de esas a aprobar en vez de inventar una nueva.
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            Se manda desde la sub-tab <strong style={{ color: 'var(--ink)' }}>Plantillas</strong> de WhatsApp, o desde el paso de MaKo de cada secuencia de mensajes. Mientras Meta no apruebe, el motor no manda ese paso — nunca sale un mensaje que Meta rechazaría.
          </div>
        </div>
      )}

      {/* ⑨ WHATSAPP OFICIAL — prueba */}
      {pasoKey === 'wa_oficial_prueba' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Con la plantilla aprobada, prueba una secuencia de mensajes desde su perfil («Probar de verdad»): te llega exactamente igual que al lead.
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
            Cuando el dominio esté verificado, prueba una secuencia de mensajes con pasos de email desde su perfil: te llega el correo a tu casilla, con tu remitente.
          </div>
        </div>
      )}

      {/* CONTEXTO — elegir chats → analizar → contestar los huecos → resumen */}
      {pasoKey === 'contexto' && vistaContexto === 'elegir' && (
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

              {oculto && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--dim)' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>Se ocultó <strong style={{ color: 'var(--ink)' }}>{oculto.conv.nombre || oculto.conv.telefono}</strong>.</span>
                  <button type="button" onClick={() => void deshacerOcultar()}
                    style={{ ...btn, padding: '4px 10px', fontSize: 12 }}>Deshacer</button>
                </div>
              )}

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

                      <Avatar telefono={c.foto ? c.telefono : null} name={nombre} size={34} />

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
                      {porOcultar === c.clave ? (
                        <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dim)', whiteSpace: 'nowrap' }}>
                          ¿Ocultar?
                          <button type="button" onClick={() => void ocultarConv(c)}
                            style={{ border: '1px solid var(--bad)', background: 'transparent', color: 'var(--bad)', borderRadius: 7, padding: '3px 8px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>Sí</button>
                          <button type="button" onClick={() => setPorOcultar(null)}
                            style={{ border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--dim)', borderRadius: 7, padding: '3px 8px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>No</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setPorOcultar(c.clave)}
                          title="Ocultar este contacto" aria-label={`Ocultar ${nombre}`}
                          style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer' }}>
                          <Icon name="eye-off" size={14} />
                        </button>
                      )}
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
      {/* CONTEXTO · preguntas — lo que NO se pudo deducir se pregunta, de a una.
          Las opciones no describen el estilo, SON la frase que el dueño diría:
          nadie sabe describir su propia forma de escribir, pero cualquiera
          reconoce su frase al leerla. */}
      {pasoKey === 'contexto' && vistaContexto === 'preguntas' && preguntaActual && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {preguntaActual.opciones.map((o) => (
            <button
              key={o} disabled={busy}
              onClick={() => void responderHueco(preguntaActual.key, o)}
              style={{ ...btn, textAlign: 'left', lineHeight: 1.5, padding: '12px 14px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              {o}
            </button>
          ))}

          {escribiendoOtra || !preguntaActual.opciones.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={otra} autoFocus rows={3}
                onChange={(e) => setOtra(e.target.value)}
                placeholder="Escríbelo con tus palabras…"
                style={{ ...inp, resize: 'vertical', textAlign: 'left', fontFamily: SANS }}
              />
              <button
                disabled={busy || !otra.trim()}
                onClick={() => void responderHueco(preguntaActual.key, otra)}
                style={{ ...btnDark, alignSelf: 'center', opacity: busy || !otra.trim() ? 0.55 : 1 }}
              >
                Guardar y seguir
              </button>
            </div>
          ) : (
            <button onClick={() => setEscribiendoOtra(true)} style={{ ...btn, alignSelf: 'center', fontSize: 13 }}>✎ Ninguna: lo escribo yo</button>
          )}

          {/* La salida existe a propósito: un hueco sin responder no se inventa,
              simplemente no se escribe en la guía. */}
          <button
            onClick={() => { setOtra(''); setEscribiendoOtra(false); setPregIdx((i) => i + 1); }}
            style={{ background: 'none', border: 'none', color: 'var(--faint)', fontSize: 12.5, cursor: 'pointer', marginTop: 2 }}
          >
            Responder después
          </button>
        </div>
      )}

      {/* CONTEXTO · resumen — solo lo que se dedujo o se respondió. */}
      {pasoKey === 'contexto' && vistaContexto === 'resumen' && voz && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {voz.evidencia && (
            <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.55, textAlign: 'left' }}>
              Leí la etapa de venta de <strong style={{ color: 'var(--dim)' }}>{voz.evidencia.convsConVenta}</strong> de {voz.evidencia.convsElegidas} conversaciones.
              {voz.evidencia.descartadas.length > 0 && ' En el resto no encontré una etapa de venta: eran soporte, entrega del servicio o coordinación, y de ahí no se puede aprender a vender.'}
            </div>
          )}

          {voz.resumen.trim() ? (
            <>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginTop: 4 }}>Esto entendí</div>
              {parsearSecciones(voz.resumen).map((s, i) => (
                <SeccionCard key={s.titulo} s={s} abiertoDefault={i === 0} icono="💬" size="sm" />
              ))}
            </>
          ) : (
            <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, textAlign: 'center', padding: '10px 0' }}>
              No saqué conclusiones de estas conversaciones. Prefiero no inventarlas: escribiré con el perfil de tu negocio y lo iré ajustando cuando empieces a conversar.
            </div>
          )}

          <button
            onClick={() => { setVoz(null); setPregIdx(0); setElegidos(new Set()); }}
            style={{ ...btn, alignSelf: 'center', marginTop: 4 }}
          >
            ↻ Elegir otras conversaciones
          </button>
        </div>
      )}

      {/* ③ VOZ — los 3 audios, grabados acá mismo */}
      {pasoKey === 'voz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {audios === null ? (
            <Cargando texto="Buscando tus audios…" />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>
                <span>{nGrabados} de {AUDIOS_PASO.length} grabados</span>
                <span style={{ flex: 1, height: 3, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(nGrabados / AUDIOS_PASO.length) * 100}%`, background: 'var(--good)', transition: 'width .25s' }} />
                </span>
              </div>

              {AUDIOS_PASO.map((d) => (
                <GrabadorAudioPaso
                  key={d.clave}
                  def={d}
                  grabado={audioDe(d.clave)}
                  abierto={audioAbierto === d.clave}
                  onToggle={() => setAudioAbierto((a) => (a === d.clave ? null : d.clave))}
                  onGrabado={(a, mapa) => {
                    setAudios((prev) => [a, ...(prev ?? []).filter((x) => x.id !== a.id)]);
                    setPorClave(mapa);
                    // Al terminar uno, se abre el siguiente que falte: el paso se
                    // recorre solo en vez de obligar a buscar cuál sigue.
                    const falta = AUDIOS_PASO.find((x) => x.clave !== d.clave && !mapa[x.clave]);
                    setAudioAbierto(falta ? falta.clave : null);
                  }}
                  onBorrado={(id) => {
                    setAudios((prev) => (prev ?? []).filter((x) => x.id !== id));
                    setPorClave((prev) => Object.fromEntries(Object.entries(prev).filter(([, v]) => v !== id)));
                  }}
                  onError={setErr}
                />
              ))}

              {/* El link del video se PIDE, no se adivina: no hay ningún dato en
                  la app que diga que el funnel es de video. Si está, el guion de
                  la bienvenida suma la frase que lo ofrece; si no, ni se menciona
                  — un audio que promete un link que no llega es peor que nada. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, textAlign: 'left' }}>
                <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>
                  Link de tu video de ventas <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--faint)' }}>· opcional</span>
                </label>
                <input
                  value={linkVideo}
                  onChange={(e) => setLinkVideo(e.target.value)}
                  onBlur={() => void guardarLinkVideo()}
                  placeholder="https://…"
                  style={{ ...inp, textAlign: 'left' }}
                />
                <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>
                  Si tu anuncio invita a ver un video, el audio de bienvenida se lo ofrece y el link le llega por escrito enseguida.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ④ ENSAYO — MaKo es el CLIENTE, un escenario por slide */}
      {pasoKey === 'ensayo' && esc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Progreso de los escenarios, con el mismo tamaño de punto que el
              shell: el paso son varias slides y tiene que leerse como tal. */}
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
            {escenarios.map((e, i) => (
              <span key={e.id} style={{ width: i === escIdx ? 20 : 7, height: 7, borderRadius: 999, background: i === escIdx ? 'var(--primary)' : i < escIdx ? 'var(--primary-weak, #B9CDF8)' : 'var(--border)', transition: 'width .2s' }} />
            ))}
          </div>

          {/* El de silencio es el único donde el lead no escribe: se avisa, si
              no el dueño se queda esperando una respuesta que no va a llegar. */}
          {esc.silencio && (
            <div style={{ padding: '9px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, textAlign: 'left' }}>
              {esc.silencio.chips[Math.min(Math.max(misRespuestas - 1, 0), esc.silencio.chips.length - 1)]} Escribe lo que le mandarías.
            </div>
          )}

          <div style={{ height: 340, display: 'flex', flexDirection: 'column' }}>
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

          {sinRespuesta && (
            <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center', fontStyle: 'italic' }}>
              No contestó. {esc.silencio ? 'Escribe el siguiente mensaje que le mandarías.' : 'Prueba con otra cosa.'}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={siguienteEscenario}
              disabled={misRespuestas < esc.minRespuestas}
              style={{ ...btnDark, opacity: misRespuestas < esc.minRespuestas ? 0.5 : 1, cursor: misRespuestas < esc.minRespuestas ? 'default' : 'pointer' }}
            >
              {escIdx >= escenarios.length - 1 ? 'Terminar el ensayo' : 'Siguiente escenario →'}
            </button>
            {misRespuestas < esc.minRespuestas && (
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>
                {esc.minRespuestas - misRespuestas === 1 ? 'Falta una respuesta tuya' : `Faltan ${esc.minRespuestas - misRespuestas} respuestas tuyas`}
              </span>
            )}
            {/* Los opcionales se pueden saltar: son variantes del mismo aprendizaje. */}
            {!esc.obligatorio && misRespuestas < esc.minRespuestas && (
              <button onClick={siguienteEscenario} style={{ background: 'none', border: 'none', color: 'var(--faint)', fontSize: 12.5, cursor: 'pointer' }}>
                Saltar este caso
              </button>
            )}
          </div>
        </div>
      )}

      {/* ⑤ APROBAR */}
      {pasoKey === 'aprobar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>
            Con lo que ensayamos armé tus secuencias de mensajes. Están <strong style={{ color: 'var(--ink)' }}>pausadas</strong>: entra al Chat Agent, escucha cómo quedaron, pruébalas en tu teléfono y actívalas cuando estés listo.
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
