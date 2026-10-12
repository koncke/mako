// =============================================================================
// /m/automations — lo que comparten el server y la pantalla: los tipos y el aviso corto
// =============================================================================
// SIN imports de valor a propósito: lo importa el componente de cliente, y un import de
// lib/flujo-conversacion (2.000 líneas) desde acá se llevaría el lienzo entero al teléfono.
// Lo que lee el grafo vive en ./modelo.ts y corre en el server (./datos.ts).
// =============================================================================

/** Una tarjeta del flujo, en LECTURA: el nombre del lienzo y lo que dice. */
export type PasoM = {
  id: string;
  /** El título de la tarjeta, el MISMO del lienzo de escritorio (`tituloDeTarjeta`: «WHATSAPP», «DELAY»…). */
  titulo: string;
  /** Lo que dice (un trozo del mensaje, cuánto espera, la primera rama). null = nada que decir. */
  linea: string | null;
  /** Nombre de `app/_components/icons.tsx` (verificado: todos existen). */
  icono: string;
};

/** Los números de `/chat-analyst` (`getSettingData` → `metricas`), por automatización. */
export type NumerosM = {
  /** Envíos reales de los últimos 30 días (WhatsApp + email). */
  enviados: number;
  /** Inscripciones que quedaron en «respondió» (la pausa). No están acotadas a 30 días: igual que en escritorio. */
  respuestas: number;
  /** Inscripciones activas hoy. */
  enCurso: number;
};

/** Lo que quedó SIN PUBLICAR en el lienzo de escritorio (mig 0240, lib/secuencia-borrador.ts). */
export type BorradorM = {
  /**
   * El flujo a publicar, tal como lo abre el lienzo (SecuenciaPerfil: `separarPasosIA` + `normalizar` +
   * `renumerar`). Viaja TAL CUAL al PATCH de escritorio (/api/whatsapp/secuencias), que lo vuelve a validar
   * con `validarGrafo` y los frenos del medio, la voz, el recordatorio y el evento.
   */
  pasos: unknown[];
  /** Lo que frena Publicar, con la MISMA función del lienzo (`frenoDelFlujo`). null = se puede. */
  freno: string | null;
  /**
   * Publicar desde el teléfono no alcanza: lo publicado es una lista de ANTES y escritorio, al publicar,
   * además limpia la estrategia (`limpiarEstrategia` de `abrirFlujo`). Eso no se repite acá.
   */
  enComputadora: boolean;
  /** Lo publicado en lectura: a lo que vuelve la pantalla al descartar. */
  publicados: PasoM[];
  /**
   * LO QUE ESTA PANTALLA VIO (`getSettingData`): la huella de lo publicado y CUÁL borrador (su `guardado_at`).
   * Publicar y Descartar lo mandan como `visto`, y el server no escribe si la computadora guardó o publicó
   * otra cosa después (`comprobarVisto`, lib/secuencia-borrador.ts: 409 `desactualizado`). Sin esto, una
   * pantalla abierta desde la mañana publicaba su foto vieja encima de lo nuevo.
   */
  base: string;
  guardado_at: string;
};

export type AutomatizacionM = {
  id: number;
  nombre: string;
  activa: boolean;
  /** Qué la dispara, en una línea (`textoDeDisparador` sobre `vistasPorDisparador`). «· +N» si tiene más CRON. */
  disparador: string;
  /** Lo que abre el lienzo de escritorio: el borrador si hay, si no lo publicado. */
  pasos: PasoM[];
  /** null = no hay nada sin publicar (o no se pudo leer: no se afirma nada). */
  borrador: BorradorM | null;
  /** null = quien mira no ve /chat-analyst, o es una de «MaKo en WhatsApp» (le escriben al grupo, no a leads). */
  numeros: NumerosM | null;
};

/** Las dos divisiones de la lista de escritorio: «Chatbot» y «MaKo en WhatsApp». */
export type SeccionAutoM = {
  id: 'chatbot' | 'mako';
  /** null = sin título (sólo hay automatizaciones del Chatbot: la lista va sola, como en el prototipo). */
  titulo: string | null;
  filas: AutomatizacionM[];
};

/**
 * El toast de un error del server: el MOTIVO si es corto («Conecta tu WhatsApp», el freno del medio al
 * activar), si no el genérico. Un toast son 3-4 palabras; el motivo largo no se corta a la mitad.
 */
export function avisoCorto(error: unknown, porDefecto: string): string {
  if (typeof error !== 'string') return porDefecto;
  const motivo = error.replace(/^No se (activó|guardó):\s*/i, '').replace(/[.\s]+$/, '').trim();
  if (!motivo) return porDefecto;
  return motivo.split(/\s+/).length <= 4 ? motivo : porDefecto;
}
