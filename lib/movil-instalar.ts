// =============================================================================
// MaKo Mobile — instalar la app (PWA): el aviso de Android y qué sistema es
// =============================================================================
// Módulo de NAVEGADOR (sin `server-only`, pero todo lo que toca `window` mira
// antes si existe: importarlo desde el server no rompe nada, y el layout lo hace
// para llevarse la constante del script de captura).
//
// ⚠️ EL EVENTO `beforeinstallprompt` SALE UNA SOLA VEZ, Y TEMPRANO. Chrome lo
// dispara cuando decide que la página es instalable, que puede ser antes de que
// React termine de hidratar. Si nadie lo está escuchando en ese momento, se
// pierde hasta la próxima carga — y el botón «Instalar MaKo» queda sin nada que
// llamar. Por eso son dos capturas que dejan el evento en el MISMO lugar:
//   1. `CAPTURA_TEMPRANA`: un <script> inline que el layout de /m pone en el HTML,
//      antes de cualquier chunk de JS;
//   2. este módulo, que al cargarse lee lo que ya capturó el script y sigue
//      escuchando los que lleguen después.
// Se llama a `preventDefault()`: eso apaga la mini-barra de Chrome, y la
// instalación pasa a ofrecerla la pantalla (Perfil) con un botón, cuando la
// persona lo decide — nunca un cartel que aparece solo.
//
// iOS NO TIENE ESTE EVENTO: allí se instala con Compartir → «Agregar a inicio».
// Para eso están `esIOS()` y `estaInstalada()`: la pantalla de Perfil decide si
// muestra el botón de Android, los pasos de iOS o nada.
// =============================================================================

export type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};

declare global {
  interface Window {
    /** Donde las dos capturas dejan el evento de instalación (o null si ya no sirve). */
    __mkInstalar?: EventoInstalar | null;
  }
  interface Navigator {
    /** Safari de iOS: true si la página corre desde el ícono de la pantalla de inicio. */
    standalone?: boolean;
  }
}

/**
 * El <script> que va en el HTML del layout de /m. Chico y sin dependencias: corre
 * mientras el navegador parsea, antes de que exista React.
 */
export const CAPTURA_TEMPRANA =
  "try{window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__mkInstalar=e;});" +
  "window.addEventListener('appinstalled',function(){window.__mkInstalar=null;});}catch(e){}";

let pendiente: EventoInstalar | null = null;
let iniciado = false;
const oyentes = new Set<() => void>();

function avisar() {
  for (const f of oyentes) {
    try { f(); } catch { /* un oyente roto no apaga a los demás */ }
  }
}

/** Empieza a escuchar. Idempotente: lo llama el shell y también corre al importar. */
export function iniciarCapturaInstalacion(): void {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;
  if (window.__mkInstalar) pendiente = window.__mkInstalar;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pendiente = e as EventoInstalar;
    window.__mkInstalar = pendiente;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    pendiente = null;
    window.__mkInstalar = null;
    avisar();
  });
}
iniciarCapturaInstalacion();

/** ¿Chrome dejó un aviso de instalación para ofrecer con un botón? (sólo Android/escritorio Chromium) */
export function puedeOfrecerInstalacion(): boolean {
  if (typeof window !== 'undefined' && !pendiente && window.__mkInstalar) pendiente = window.__mkInstalar;
  return pendiente != null;
}

/**
 * Abre el diálogo de instalación de Chrome. Va adentro de un click (Chrome exige
 * un gesto). El evento sirve UNA vez: después de usarlo se descarta.
 */
export async function pedirInstalacion(): Promise<'aceptada' | 'rechazada' | 'no-disponible'> {
  if (!puedeOfrecerInstalacion() || !pendiente) return 'no-disponible';
  const ev = pendiente;
  pendiente = null;
  if (typeof window !== 'undefined') window.__mkInstalar = null;
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    return outcome === 'accepted' ? 'aceptada' : 'rechazada';
  } catch {
    return 'no-disponible';
  } finally {
    avisar();
  }
}

/** ¿La app corre instalada (desde el ícono), y no en una pestaña del navegador? */
export function estaInstalada(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
  } catch { /* navegador viejo */ }
  return window.navigator.standalone === true;
}

/**
 * ¿Es un iPhone o un iPad? El iPad con iPadOS 13+ dice «MacIntel», así que se lo
 * reconoce por la pantalla táctil (una Mac no tiene).
 */
export function esIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
}

/** Para `useSyncExternalStore`: avisa cuando aparece o se consume el aviso de instalación. */
export function suscribirInstalacion(f: () => void): () => void {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}
