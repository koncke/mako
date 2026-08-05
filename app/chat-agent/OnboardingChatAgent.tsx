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
import { audiosDe } from '@/lib/audios-paso';
import { escenariosDe, type Escenario, type Desenlace } from '@/lib/chat-agent-escenarios';

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
type Def = { key: string; titulo: string; pasos: Array<{ key: string; label: string; opcional?: boolean }> };
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
type PasoResumen = { orden: number; cuando: string; que: string; transcript: string | null; condicion: string | null; pie: string | null };
type ResumenFinal = {
  secuencias: Array<{ id: number; nombre: string; activa: boolean; pasos: PasoResumen[] }>;
  huecos: Array<{ etapa: string; label: string }>;
};
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

/**
 * El veredicto del caso, con las MISMAS palabras del catálogo que leyó el
 * modelo. 'abierto' es el caso raro: se acabaron los turnos y el modelo no
 * dejó veredicto — decirle al dueño que salió mal sin saberlo sería inventar.
 */
/** Cómo se lee el resultado de un caso ya cerrado, para el title del punto. */
const RESULTADO: Record<string, string> = {
  positivo: 'terminó bien',
  negativo: 'terminó mal',
  abierto: 'terminó sin definirse',
  sin: 'guardado',
};

function textoDesenlace(e: Escenario, d: Desenlace): string {
  if (d === 'positivo') return `Terminó bien: el lead ${e.desenlace.positivo}.`;
  if (d === 'negativo') return `Terminó mal: el lead ${e.desenlace.negativo}.`;
  return 'La conversación se agotó sin definirse. Este caso termina aquí.';
}

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
  const [hayReunion, setHayReunion] = useState(true);

  // ── Paso final: qué secuencias quedaron armadas con los audios ──
  const [resumen, setResumen] = useState<ResumenFinal | null>(null);

  // ── Paso ensayo ──
  const [msgs, setMsgs] = useState<HiloMsg[]>([]);
  const [typing, setTyping] = useState<{ lado: 'left' | 'right' } | null>(null);
  // Por cuál escenario va. Cada uno es una slide dentro del paso, no un paso
  // propio: los nueve son la misma pregunta contada nueve veces, y como pasos
  // reales multiplicarían los puntos del progreso por una sola decisión.
  const [escIdx, setEscIdx] = useState(0);
  // Los casos ya cerrados, traídos del server. Sin esto, salirse del onboarding
  // borraba el ensayo entero y había que rehacerlo desde el primero.
  const [guardado, setGuardado] = useState<Record<string, { respuestas: string[]; at: string; desenlace?: Desenlace | null }>>({});
  const [ensayoCargado, setEnsayoCargado] = useState(false);
  /**
   * Cómo terminó el caso que está en pantalla. Mientras es null la conversación
   * sigue viva; en cuanto tiene valor, el lead ya no vuelve a escribir. Antes no
   * existía y por eso el ensayo era un intercambio de objeciones sin final.
   */
  const [desenlace, setDesenlace] = useState<Desenlace | null>(null);
  /** El caso recién cerrado, para confirmarlo arriba de la slide siguiente. */
  const [cerrado, setCerrado] = useState<{ titulo: string; n: number } | null>(null);
  const [cerrando, setCerrando] = useState(false);
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
  const esOpcional = !!def?.pasos[idx]?.opcional;
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
      // El recorrido avanza por ÍNDICE, no por `estado.status`. `status` pasa a
      // 'done' cuando terminan los pasos NO OPCIONALES, así que mirarlo acá
      // soltaba al dueño en medio del wizard —con varios pasos todavía a la
      // vista— y lo dejaba caer en la tab de WhatsApp sin haber terminado. Solo
      // se sale desde el último paso.
      if (idx >= (def?.pasos.length ?? 1) - 1) { onListo(); return; }
      setIdx((i) => i + 1);
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
      setHayReunion(j.hayReunion !== false);
      // Se abre el primero que falte, para no tener que buscar por dónde seguir.
      const falta = audiosDe(j.hayReunion !== false).find((d) => !(j.porClave ?? {})[d.clave]);
      setAudioAbierto(falta ? falta.clave : null);
    } catch { setAudios([]); }
  }, []);
  // Se cargan AL MONTAR, no solo estando en el paso de los audios.
  //
  // Antes la condición era `pasoKeyRef.current === 'voz'`, y eso rompía el
  // ensayo: al reabrir el onboarding, `cargar()` aterriza en el primer paso sin
  // hacer — con los audios ya grabados, ese paso ES el ensayo. Nunca se pasaba
  // por 'voz', así que `audios` quedaba en null, el escenario abría sin URL y la
  // burbuja se pintaba como "no disponible" aunque el archivo estuviera perfecto.
  useEffect(() => { void cargarAudios(); }, [cargarAudios]);

  // Y se vuelven a pedir AL ENTRAR AL ENSAYO, porque las URLs de reproducción
  // son firmadas y vencen. Al montar el wizard todavía faltan el escaneo del QR,
  // la importación de conversaciones y el análisis con IA: minutos, a veces
  // muchos. Refrescarlas acá cuesta una llamada y evita el caso más molesto de
  // todos — el reproductor a la vista que no suena porque el link caducó.
  const audiosRefrescados = useRef(false);
  useEffect(() => {
    if (pasoKey !== 'ensayo' || audiosRefrescados.current) return;
    audiosRefrescados.current = true;
    void cargarAudios();
  }, [pasoKey, cargarAudios]);

  const audioDe = (clave: string): AudioGrabado | null => {
    const id = porClave[clave];
    return id ? ((audios ?? []).find((a) => a.id === id) ?? null) : null;
  };
  // Los audios que ESTE negocio tiene que grabar. `hayReunion` arranca en true
  // (lo más común) para no esconder tarjetas mientras carga y hacerlas aparecer
  // medio segundo después.
  const misAudios = audiosDe(hayReunion);
  const nGrabados = misAudios.filter((d) => !!porClave[d.clave]).length;

  async function guardarLinkVideo() {
    try {
      await fetch('/api/chat-agent/audios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkVideo }),
      });
    } catch { /* se reintenta al volver a salir del campo */ }
  }

  // El paso final ARMA las secuencias con los audios grabados y devuelve lo que
  // quedó. Antes era texto fijo prometiendo unas secuencias que nadie creaba.
  useEffect(() => {
    if (pasoKeyRef.current !== 'aprobar' || resumen !== null) return;
    void (async () => {
      try {
        const j = await (await fetch('/api/chat-agent/onboarding/resumen', { cache: 'no-store' })).json();
        setResumen(j.ok ? { secuencias: j.secuencias ?? [], huecos: j.huecos ?? [] } : { secuencias: [], huecos: [] });
      } catch { setResumen({ secuencias: [], huecos: [] }); }
    })();
  });

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

  /**
   * Analiza las conversaciones elegidas. Es la llamada MÁS LARGA del onboarding
   * —lee hasta 8.000 mensajes, los segmenta con el modelo barato y recién ahí
   * llama a Claude—, y era la única sin red de contención: sin `catch` y sin
   * timeout.
   *
   * Los dos finales que dejaba, y que el dueño veía como "se colgó":
   *  · la ruta se pasa de sus 120s → llega un 504 que NO es JSON, `.json()`
   *    revienta, y como nadie atrapa el error la pantalla queda igual que antes,
   *    sin spinner y sin explicación: parece que el botón no hizo nada.
   *  · la conexión se queda esperando y el `fetch` nunca resuelve → el spinner
   *    gira para siempre.
   */
  async function leerConversaciones() {
    if (!elegidos.size) { setErr('Elige al menos una conversación.'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/chat-agent/onboarding/contexto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Se manda cada charla con TODOS sus jids agrupados, no una lista plana:
        // el análisis corta la etapa de venta por conversación, así que necesita
        // saber qué jids son la misma charla.
        body: JSON.stringify({
          conversaciones: (convs ?? []).filter((c) => elegidos.has(c.clave))
            .map((c) => ({ clave: c.clave, nombre: c.nombre || c.telefono || 'Sin nombre', jids: c.jids })),
        }),
        // Un poco por encima del maxDuration de la ruta (120s): así el corte lo
        // da el navegador con un mensaje, y no un spinner eterno.
        signal: AbortSignal.timeout(135_000),
      });
      // El cuerpo puede no ser JSON (504/502 devuelven HTML). Se lee como texto y
      // se parsea a mano para poder contar QUÉ pasó en vez de romperse.
      const crudo = await r.text();
      let j: (VozResultado & { ok?: boolean; error?: string }) | null = null;
      try { j = JSON.parse(crudo); } catch { /* no era JSON */ }
      if (!j) {
        setErr(r.status === 504 || r.status === 502
          ? 'El análisis tardó demasiado. Elige menos conversaciones (con 8 a 10 alcanza) y vuelve a intentarlo.'
          : `El servidor respondió ${r.status}. Vuelve a intentarlo en un momento.`);
        return;
      }
      if (!j.ok) { setErr(j.error || 'No pude leer tus conversaciones.'); return; }
      setVoz(j as VozResultado);
      setPregIdx(0); setOtra(''); setEscribiendoOtra(false);
    } catch (e) {
      setErr(e instanceof DOMException && e.name === 'TimeoutError'
        ? 'El análisis tardó más de dos minutos y se cortó. Elige menos conversaciones y vuelve a intentarlo.'
        : 'Se cortó la conexión mientras analizaba. Vuelve a intentarlo.');
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
  const escenarios = escenariosDe(!!linkVideo.trim(), hayReunion);
  // Terminado el último, `escIdx` queda FUERA de rango a propósito: es la señal
  // de que se recorrieron todos. Sin este null explícito, un `?? escenarios[0]`
  // hacía caer en el escenario 1 y el efecto lo reabría con otra semilla — el
  // dueño terminaba el ensayo y volvía a ver el primer caso, con los puntos de
  // progreso apagados y sin nada que dijera que había terminado.
  // Se retoma en el primer caso SIN cerrar. Solo una vez: después manda lo que
  // el dueño esté haciendo, no lo que había al abrir.
  // `audios !== null` no es un detalle: de ahí sale también `linkVideo`, que es
  // lo que decide si el caso del video entra en la lista. Retomar antes deja el
  // índice apuntando a otro caso en cuanto la lista crece de 8 a 9.
  const retomado = useRef(false);
  useEffect(() => {
    if (!ensayoCargado || audios === null || retomado.current || !escenarios.length) return;
    retomado.current = true;
    const i = escenarios.findIndex((e) => !guardado[e.id]);
    setEscIdx(i < 0 ? escenarios.length : i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensayoCargado, audios === null, escenarios.length]);

  const ensayoTerminado = escIdx >= escenarios.length;
  const esc = ensayoTerminado ? null : (escenarios[escIdx] ?? null);

  // Lo que ya se respondió, para retomar donde quedó en vez de empezar de cero.
  useEffect(() => {
    void (async () => {
      try {
        const j = await (await fetch('/api/chat-agent/onboarding/ensayo', { cache: 'no-store' })).json();
        if (j.ok) setGuardado(j.hechos ?? {});
      } catch { /* sin lo guardado, arranca del primero */ }
      finally { setEnsayoCargado(true); }
    })();
  }, []);

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
    setDesenlace(null);
    setMsgs(abre);
  }, []);

  useEffect(() => {
    if (pasoKey !== 'ensayo' || !esc || msgs.length > 0) return;
    // Se espera a que la biblioteca esté cargada ANTES de abrir el escenario.
    // El escenario se abre una sola vez (lo protege `msgs.length > 0`), así que
    // abrirlo mientras `audios` todavía es null dejaba la burbuja sin URL de
    // forma permanente: los audios llegaban medio segundo después y ya nadie
    // volvía a mirarlos.
    if (audios === null) return;
    const a = audioDe(esc.audio);
    abrirEscenario(esc, a?.url ?? null);
  }, [pasoKey, esc, msgs.length, abrirEscenario, audioDe, audios]);

  /**
   * Si la conversación concluyó, deja el veredicto DENTRO del hilo y apaga el
   * turno del lead. Se queda en pantalla: es lo último que el dueño lee del
   * caso, y no el flash de 750 ms de la línea del cierre manual.
   */
  function conFin(hilo: HiloMsg[], d: unknown): HiloMsg[] {
    if (!esc || (d !== 'positivo' && d !== 'negativo' && d !== 'abierto')) return hilo;
    setDesenlace(d);
    return [...hilo, {
      id: `fin-${++seq.current}`, fromMe: false, tipo: 'sistema',
      tono: d === 'positivo' ? 'ok' : d === 'negativo' ? 'bad' : null,
      texto: textoDesenlace(esc, d),
      fecha: new Date().toISOString(),
    }];
  }

  async function responderComoNegocio(texto: string): Promise<boolean> {
    if (!esc) return true;
    const conmigo: HiloMsg[] = [...msgs, { id: `y-${++seq.current}`, fromMe: true, texto, fecha: new Date().toISOString() }];
    setMsgs(conmigo);
    setTyping({ lado: 'left' });
    try {
      // `slice(1)` saca la burbuja de apertura (el audio del dueño). El server
      // cuenta el TURNO por los mensajes del negocio, y sin esto la burbuja del
      // audio contaba como uno más cada vez que no había archivo grabado y caía
      // al texto de respaldo: el guion del lead arrancaba adelantado.
      const historial = conmigo.slice(1)
        .map((m) => ({ de: m.fromMe ? 'negocio' : 'lead', texto: (m.texto ?? '').trim() }))
        .filter((m) => m.texto);
      const j = await (await fetch('/api/chat-agent/onboarding/ensayo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escenario: esc.id, historial }),
      })).json();
      if (j.ok) {
        // Sin burbuja = el lead no contestó. Es la respuesta más común de todas
        // y practicarla es justo el punto del escenario de silencio.
        const hilo = j.mensaje
          ? [...conmigo, { id: `c-${++seq.current}`, fromMe: false, autor: 'Lead', texto: j.mensaje, fecha: new Date().toISOString() }]
          : conmigo;
        setMsgs(conFin(hilo, j.desenlace));
        // Con veredicto, el aviso de «no contestó» sobra: ya lo dice el cierre.
        setSinRespuesta(!!j.sinRespuesta && !j.desenlace);
      } else if (j.error) {
        setErr(j.error);
      }
      return true;
    } catch { return true; } finally { setTyping(null); }
  }

  /**
   * Responder con una NOTA DE VOZ, que es como el dueño de verdad le contesta a
   * un lead. El modelo no oye: el server la transcribe y usa ese texto. La
   * burbuja muestra el audio reproducible con su transcripción debajo.
   */
  async function responderConAudio(blob: Blob): Promise<boolean> {
    if (!esc) return false;
    const url = URL.createObjectURL(blob);
    const propio: HiloMsg = {
      id: `y-${++seq.current}`, fromMe: true, tipo: 'audio',
      mediaUrl: url, mediaMime: 'audio/mpeg', fecha: new Date().toISOString(),
    };
    const conmigo = [...msgs, propio];
    setMsgs(conmigo);
    setTyping({ lado: 'left' });
    try {
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      // `slice(1)` saca la burbuja de apertura (el audio del dueño). El server
      // cuenta el TURNO por los mensajes del negocio, y sin esto la burbuja del
      // audio contaba como uno más cada vez que no había archivo grabado y caía
      // al texto de respaldo: el guion del lead arrancaba adelantado.
      const historial = conmigo.slice(1)
        .map((m) => ({ de: m.fromMe ? 'negocio' : 'lead', texto: (m.texto ?? '').trim() }))
        .filter((m) => m.texto);
      const j = await (await fetch('/api/chat-agent/onboarding/ensayo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escenario: esc.id, historial, audioBase64: btoa(bin), audioMime: 'audio/mpeg' }),
      })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo enviar el audio.'); return false; }
      // La transcripción queda pegada a la burbuja: sin eso, al releer el ensayo
      // no se sabe qué se dijo, y es lo que el modelo efectivamente leyó.
      const conTexto = conmigo.map((m) => (m.id === propio.id ? { ...m, texto: j.transcripta ?? null } : m));
      const hilo = j.mensaje
        ? [...conTexto, { id: `c-${++seq.current}`, fromMe: false, autor: 'Lead', texto: j.mensaje, fecha: new Date().toISOString() }]
        : conTexto;
      setMsgs(conFin(hilo, j.desenlace));
      setSinRespuesta(!!j.sinRespuesta && !j.desenlace);
      return true;
    } catch {
      setErr('Sin conexión — vuelve a intentarlo.');
      return false;
    } finally { setTyping(null); }
  }

  /** Cuántas veces respondió el dueño en este escenario (el audio de apertura no cuenta). */
  const misRespuestas = msgs.filter((m, i) => m.fromMe && i > 0).length;

  // La confirmación del caso anterior se va sola apenas el dueño empieza a
  // responder este: ya dijo lo suyo y competir con el hilo la vuelve ruido.
  useEffect(() => { if (misRespuestas > 0) setCerrado(null); }, [misRespuestas]);

  /**
   * Cierra el caso: GUARDA lo que el dueño escribió y pasa al siguiente.
   *
   * Guardar acá no es un extra. El ensayo es el trabajo más caro del onboarding
   * —nueve conversaciones escritas a mano— y antes vivía solo en memoria: cerrar
   * la pestaña lo borraba entero y había que rehacerlo desde el caso 1.
   */
  async function siguienteEscenario() {
    if (!esc || cerrando) return;
    setErr(null);
    setCerrando(true);
    const respuestas = msgs.filter((m, i) => m.fromMe && i > 0 && (m.texto ?? '').trim()).map((m) => (m.texto ?? '').trim());
    // El caso se cierra DENTRO del hilo, que es donde el dueño está mirando: una
    // línea de sistema, como la que WhatsApp usa para lo que pasó en el chat.
    // Un cartel fuera del hilo se lee como parte de la app; esto se lee como
    // "esta conversación terminó y quedó registrada".
    // Si la conversación ya cerró sola, su veredicto ya está en el hilo: acá
    // solo se deja constancia de lo guardado, y sin evaluar al dueño («caso
    // superado» sonaba a examen y encima contradecía un desenlace negativo).
    if (!desenlace) {
      setMsgs((prev) => [...prev, {
        id: `fin-${++seq.current}`, fromMe: false, tipo: 'sistema',
        texto: respuestas.length
          ? `Guardé ${respuestas.length === 1 ? 'tu respuesta' : `tus ${respuestas.length} respuestas`}.`
          : 'Caso saltado.',
        fecha: new Date().toISOString(),
      }]);
    }
    setGuardado((prev) => ({ ...prev, [esc.id]: { respuestas, at: new Date().toISOString(), desenlace } }));
    try {
      await fetch('/api/chat-agent/onboarding/ensayo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardar', escenario: esc.id, respuestas, desenlace }),
      });
    } catch { /* queda en pantalla como guardado; se reintenta al volver a cerrarlo */ }
    // Un respiro para que la línea de cierre se alcance a leer antes de que el
    // hilo se vacíe para el caso siguiente.
    await new Promise((r) => setTimeout(r, desenlace ? 250 : 750));
    setCerrado({ titulo: esc.titulo, n: respuestas.length });
    setMsgs([]);
    setSinRespuesta(false);
    setDesenlace(null);
    setEscIdx((i) => i + 1);
    setCerrando(false);
  }

  // Dentro del paso 'contexto' hay tres vistas: elegir las conversaciones,
  // contestar los huecos de a una, y el resumen. Se resuelve en UN solo lugar
  // para que la cabecera y el footer del shell no se contradigan entre sí.
  const preguntaActual = voz && pregIdx < voz.preguntas.length ? voz.preguntas[pregIdx] : null;
  const vistaContexto: 'elegir' | 'preguntas' | 'resumen' =
    !voz ? 'elegir' : preguntaActual ? 'preguntas' : 'resumen';

  // La sub-vista solo manda cuando REALMENTE estamos en su paso. `voz` no se
  // limpia al cambiar de paso, así que sin este ancla la cabecera y el pie
  // seguían creyéndose en las preguntas del contexto desde cualquier otro lado.
  const enPreguntas = pasoKey === 'contexto' && vistaContexto === 'preguntas';

  const hecho = (k: PasoKey) => !!estado?.steps?.[k]?.done;
  const puedeAvanzar = (() => {
    if (busy || cerrando) return false;
    // Solo se traba lo que de verdad no tiene sentido saltear: leer el contexto,
    // ensayar un poco, y que el canal principal esté probado. El resto (oficial,
    // email, plantillas) se puede completar después — trabar ahí pierde gente.
    // En 'preguntas' el avance lo manejan los botones de la propia tarjeta.
    if (pasoKey === 'contexto') return vistaContexto === 'resumen' || hecho('contexto');
    // Los 3 audios son obligatorios y se comprueban EN VIVO, no con `hecho`: si
    // el dueño borra uno después, el paso tiene que volver a pedirlo. La salida
    // sigue estando en "Lo configuro después" del pie — trabar el avance es lo
    // pedido; dejar el paso sin ninguna salida lo convertiría en una trampa.
    if (pasoKey === 'voz') return nGrabados === misAudios.length;
    // El ensayo avanza CASO a caso con el MISMO botón del pie: mientras quede
    // caso, el pie lo cierra y lo guarda; cuando no queda ninguno, pasa de paso.
    // Se habilita con las respuestas que el caso pide — salvo los opcionales,
    // que se pueden saltar sin escribir nada (son variantes del mismo aprendizaje).
    if (pasoKey === 'ensayo') {
      if (ensayoTerminado) return true;
      if (!esc) return false;
      // La conversación cerró: exigirle tres respuestas a un caso que ya
      // terminó sería pedirle que le hable a alguien que se fue.
      if (desenlace) return true;
      return !esc.obligatorio || misRespuestas >= esc.minRespuestas;
    }
    // El estado EN VIVO es la única prueba de que el número está vinculado. La
    // memoria de una vinculación pasada no lo es: con `hecho(...)` en el OR, el
    // paso seguía dejando avanzar después de desvincular, mostrando el botón de
    // generar QR y un "Siguiente" habilitado al mismo tiempo.
    if (pasoKey === 'wa_no_oficial') return evo?.estado === 'conectado';
    if (pasoKey === 'wa_no_oficial_prueba') return verificado || hecho('wa_no_oficial_prueba');
    return true;
  })();

  // La etiqueta del pie en el ensayo. Vive acá y no dentro del JSX porque el
  // texto de ayuda de abajo la NOMBRA: escrita dos veces se desincronizaban, y
  // en el último caso la ayuda mandaba a apretar un botón que no existía.
  const labelEnsayo = escIdx >= escenarios.length - 1
    ? 'Guardar y terminar el ensayo'
    : desenlace ? 'Siguiente caso' : 'Guardar caso y seguir';

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
        enPreguntas && preguntaActual ? preguntaActual.pregunta
          : pasoKey === 'ensayo' && ensayoTerminado ? 'Ensayo terminado'
            : pasoKey === 'ensayo' && esc ? esc.titulo
            : (PREGUNTA[pasoKey]?.q ?? '')
      }
      sub={
        enPreguntas ? `Pregunta ${pregIdx + 1} de ${voz?.preguntas.length ?? 0}`
          : pasoKey === 'ensayo' && ensayoTerminado ? undefined
            : pasoKey === 'ensayo' && esc ? esc.objetivo
            : PREGUNTA[pasoKey]?.sub
      }
      // La tarjeta de preguntas trae sus propios botones: sin esto quedarían dos
      // "Siguiente" a la vez, uno adentro y otro en el footer.
      hideSiguiente={enPreguntas}
      error={err}
      puedeAvanzar={puedeAvanzar}
      enUltimo={enUltimo}
      confirmLabel="Listo, entrar al Chat Agent"
      // En el ensayo el pie no "pasa": CIERRA el caso y lo guarda. Decirlo es lo
      // que evita que se lea como saltearlo.
      siguienteLabel={pasoKey === 'ensayo' && !ensayoTerminado ? labelEnsayo : undefined}
      pending={busy || cerrando}
      atrasLabel="Atrás"
      hideAtras={idx === 0}
      onAtras={() => {
        // El pie AVANZA sub-pasos (los casos del ensayo, las preguntas del
        // contexto), así que el Atrás tiene que DESANDARLOS. Cuando no los
        // desandaba, volver desde «Tus secuencias de mensajes» te dejaba en
        // «Tus audios» — salía del paso entero en vez de retroceder uno.
        if (pasoKey === 'ensayo' && escIdx > 0) {
          // El hilo se vacía a propósito: el efecto que reabre el caso está
          // protegido por `msgs.length > 0` y sin esto el caso anterior
          // quedaría en blanco. Lo escrito no se pierde (ChatHilo guarda el
          // borrador por caso) y lo ya cerrado sigue en `guardado`.
          setEscIdx((i) => i - 1); setMsgs([]); setSinRespuesta(false); setCerrado(null); setDesenlace(null);
          return;
        }
        if (enPreguntas && pregIdx > 0) {
          setPregIdx((i) => i - 1);
          return;
        }
        setIdx((i) => Math.max(0, i - 1));
      }}
      onSiguiente={() => {
        // El pie es el ÚNICO botón de avance. Mientras queden casos avanza el
        // CASO; cuando no quedan, avanza el paso del wizard. Tener además un
        // "Siguiente escenario" adentro era pedirle al dueño que eligiera entre
        // dos botones que dicen lo mismo.
        if (pasoKey === 'ensayo' && !ensayoTerminado) { void siguienteEscenario(); return; }
        void marcarPaso();
      }}
      onConfirmar={() => void marcarPaso()}
      onClose={onListo}
      // Siempre, incluso en el primer paso: si no, alguien que vuelve a un
      // onboarding reabierto queda sin ninguna salida.
      extraFooter={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onListo} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13, cursor: 'pointer' }}>Lo configuro después</button>
          {/* Los pasos opcionales (oficial, email) se pueden saltear de a uno
              sin abandonar el recorrido: antes la única salida era irse del
              wizard entero, así que nadie llegaba al final. */}
          {esOpcional && !enUltimo && (
            <button
              onClick={() => setIdx((i) => i + 1)}
              style={{ background: 'none', border: 'none', color: 'var(--faint)', fontSize: 13, cursor: 'pointer' }}
            >Omitir por ahora</button>
          )}
        </div>
      )}
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
              {/* «unos segundos» era mentira y por eso la espera se sentía como un
                  cuelgue: son hasta dos minutos, y decirlo cambia esperar por
                  pensar que se rompió. */}
              {busy && <Cargando texto="Leyendo tus chats y sacando tu patrón… puede tardar hasta dos minutos" />}
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
                <span>{nGrabados} de {misAudios.length} grabados</span>
                <span style={{ flex: 1, height: 3, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(nGrabados / Math.max(1, misAudios.length)) * 100}%`, background: 'var(--good)', transition: 'width .25s' }} />
                </span>
              </div>

              {misAudios.map((d) => (
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
                    const falta = misAudios.find((x) => x.clave !== d.clave && !mapa[x.clave]);
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
      {/* Ensayo TERMINADO: hay que decirlo. Antes el paso volvía a pintar el
          primer caso, así que la única señal de haber llegado al final era que
          el «Siguiente» del pie se habilitaba en silencio. */}
      {pasoKey === 'ensayo' && ensayoTerminado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <div style={{ ...okBox, width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
            <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}><Icon name="check" size={17} /></span>
            Recorriste los {escenarios.length} casos. Con esto ya sé cómo respondes.
          </div>
          <button onClick={() => { setEscIdx(0); setMsgs([]); setSinRespuesta(false); setCerrado(null); setDesenlace(null); }} style={btn}>
            ↻ Volver a empezar el ensayo
          </button>
        </div>
      )}

      {pasoKey === 'ensayo' && esc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Progreso de los escenarios, con el mismo tamaño de punto que el
              shell: el paso son varias slides y tiene que leerse como tal. */}
          {/* El punto se pinta por lo GUARDADO, no por la posición: así, al
              volver al onboarding, se ve de un vistazo qué casos ya quedaron
              hechos aunque el recorrido arranque en otro lado. */}
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
            {escenarios.map((e, i) => (
              <span
                key={e.id}
                // El color dice «lo hiciste», no «te fue bien»: cerrar bien con
                // alguien que no califica es un resultado legítimo del ensayo, y
                // pintarlo en rojo se leería como un error del dueño. El
                // resultado se cuenta en el title.
                title={guardado[e.id] ? `${e.titulo} · ${RESULTADO[guardado[e.id].desenlace ?? 'sin'] }` : e.titulo}
                style={{ width: i === escIdx ? 20 : 7, height: 7, borderRadius: 999, background: i === escIdx ? 'var(--primary)' : guardado[e.id] ? 'var(--good)' : 'var(--border)', transition: 'width .2s' }}
              />
            ))}
          </div>

          {/* Lo que se acaba de guardar, ya en la slide del caso siguiente: es la
              prueba de que el caso anterior no se perdió. Se va sola en cuanto
              el dueño empieza a responder este. */}
          {cerrado && (
            <div style={{ ...okBox, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
              <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}><Icon name="check" size={15} /></span>
              <span>Guardado: «{cerrado.titulo}»{cerrado.n ? '' : ' (saltado)'}</span>
            </div>
          )}

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
              // Cerrado el caso no hay a quién escribirle: el composer se apaga y
              // en su lugar queda la barra muerta con este texto. Dejarlo vivo
              // haría que el veredicto no significara nada.
              readOnly={!!desenlace}
              placeholder={desenlace ? 'Este caso terminó' : 'Responde como lo harías normalmente…'}
              onEnviarTexto={responderComoNegocio}
              // Poder contestar con una nota de voz: es como el dueno le responde de
              // verdad a un lead, y ensayar solo escribiendo entrena otra cosa.
              onEnviarArchivo={(blob, tipo) => (tipo === 'audio' ? responderConAudio(blob) : Promise.resolve(false))}
              draftKey={`ensayo-${esc.id}`}
              vacio={<div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 13 }}>Preparando el escenario…</div>}
            />
          </div>

          {sinRespuesta && (
            <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center', fontStyle: 'italic' }}>
              No contestó. {esc.silencio ? 'Escribe el siguiente mensaje que le mandarías.' : 'Prueba con otra cosa.'}
            </div>
          )}

          {/* Sin botón de avance acá: el «Siguiente» del pie cierra el caso y,
              cuando no queda ninguno, pasa de paso. Dos botones que hacen lo
              mismo obligaban a elegir entre ellos sin saber en qué se diferencian.
              Lo único que queda es decir CUÁNTO falta para poder cerrarlo. */}
          {!desenlace && misRespuestas < esc.minRespuestas && (
            <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center' }}>
              {esc.obligatorio
                ? (esc.minRespuestas - misRespuestas === 1 ? 'Falta una respuesta tuya para cerrar el caso' : `Faltan ${esc.minRespuestas - misRespuestas} respuestas tuyas para cerrar el caso`)
                : `Puedes responder o saltarlo con «${labelEnsayo}»`}
            </div>
          )}
        </div>
      )}

      {/* ⑤ APROBAR — el resumen de lo que quedó armado, no una promesa */}
      {pasoKey === 'aprobar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {resumen === null ? (
            <Cargando texto="Armando tus secuencias de mensajes…" />
          ) : resumen.secuencias.length === 0 ? (
            <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, textAlign: 'center' }}>
              Todavía no hay audios grabados, así que no armé ninguna secuencia. Vuelve al paso de los audios cuando quieras.
            </div>
          ) : (
            <>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', textAlign: 'left' }}>
                Esto quedó armado
              </div>
              {resumen.secuencias.map((s, i) => (
                <SeccionCard
                  key={s.id}
                  s={{
                    titulo: s.nombre,
                    texto: s.pasos.map((p) => {
                      const cond = p.condicion ? ` — ${p.condicion}` : '';
                      const pie = p.pie ? `\n   Y le llega por escrito: «${p.pie}»` : '';
                      const dice = p.transcript ? `\n   Dice: «${p.transcript.slice(0, 160)}${p.transcript.length > 160 ? '…' : ''}»` : '';
                      return `${p.orden}. ${p.cuando}: ${p.que}${cond}${pie}${dice}`;
                    }).join('\n\n'),
                  }}
                  abiertoDefault={i === 0}
                  icono="💬"
                  size="sm"
                />
              ))}

              <div style={okBox}>
                Quedaron <strong>pausadas</strong>. No sale nada a ningún lead hasta que las actives desde el Chat Agent.
              </div>

              {resumen.huecos.length > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.55, textAlign: 'left' }}>
                  Te faltan secuencias para {resumen.huecos.length === 1 ? 'la etapa' : 'las etapas'} {resumen.huecos.map((h) => h.label).join(', ')}. Las puedes armar desde el Chat Agent cuando quieras.
                </div>
              )}
            </>
          )}
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
