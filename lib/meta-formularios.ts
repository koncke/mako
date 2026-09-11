// =============================================================================
// meta-formularios — crear un formulario instantáneo de Meta desde MaKo
// =============================================================================
// Puro (sin server-only): valida y arma el pedido a `POST /{página}/leadgen_forms`.
// Lo usan el creador del wizard (para decir qué falta ANTES de mandar) y
// lib/meta-ads-create.ts (que vuelve a validar en el server: la UI no protege nada).
//
// La forma sale de lo que Meta DEVUELVE para los formularios que ya existen en la
// página del dueño, leídos el 2026-09-11: `questions` con `type` (EMAIL, FULL_NAME,
// PHONE, CUSTOM con `key` y `label`), `is_optimized_for_quality` (el tipo «mayor
// intención»), `thank_you_page` con `button_type: VIEW_WEBSITE` + `website_url`, y
// `follow_up_action_url`. Los tipos de pregunta válidos los enumeró Meta al rechazar
// un pedido con uno inventado a propósito (rechazo que llega ANTES de crear nada).
//
// ⚠️ Crear escribe en la PÁGINA DE FACEBOOK del cliente y no hay forma de borrar un
// formulario por API: sólo archivarlo. Por eso el creador no reintenta solo, y si
// Meta no devuelve el id se pide mirar la Biblioteca antes de volver a intentar.
// =============================================================================

export const PREGUNTAS_ESTANDAR = ['FULL_NAME', 'EMAIL', 'PHONE'] as const;
export type PreguntaEstandar = (typeof PREGUNTAS_ESTANDAR)[number];

export const ETIQUETA_ESTANDAR: Record<PreguntaEstandar, string> = {
  FULL_NAME: 'Nombre completo',
  EMAIL: 'Email',
  PHONE: 'Teléfono',
};

export const MAX_PREGUNTAS_PROPIAS = 5;

export type FormularioNuevo = {
  nombre: string;
  /** Las que Meta completa sola con los datos del perfil. */
  estandar: PreguntaEstandar[];
  /** Preguntas abiertas escritas por el negocio («¿Qué tipo de propiedad buscas vender?»). */
  propias: string[];
  /** true = «Mayor intención»: Meta agrega una pantalla para revisar los datos antes de enviar. */
  mayorIntencion: boolean;
  /** Meta no publica un formulario sin política de privacidad. */
  privacidadUrl: string;
  /** A dónde lleva el botón de la pantalla final. */
  sitioUrl: string;
};

/** http(s) con un host que tenga punto. «tupagina» o «www» sueltos no son una dirección. */
export function urlValida(u: string | null | undefined): boolean {
  const t = (u ?? '').trim();
  if (!t) return false;
  try {
    const x = new URL(t);
    return (x.protocol === 'https:' || x.protocol === 'http:') && x.hostname.includes('.');
  } catch {
    return false;
  }
}

const propiasLimpias = (f: FormularioNuevo) => f.propias.map((p) => p.trim()).filter(Boolean);

/** Lo que falta, en el orden en que la persona lo va a leer. Vacío = se puede crear. */
export function erroresFormulario(f: FormularioNuevo): string[] {
  const e: string[] = [];
  if (!f.nombre.trim()) e.push('Ponle un nombre al formulario.');
  const propias = propiasLimpias(f);
  if (f.estandar.length + propias.length === 0) e.push('Elige al menos una pregunta.');
  if (propias.length > MAX_PREGUNTAS_PROPIAS) e.push(`Hasta ${MAX_PREGUNTAS_PROPIAS} preguntas propias: cada una de más baja cuántos lo completan.`);
  if (!urlValida(f.privacidadUrl)) e.push('Falta el link a tu política de privacidad: Meta no publica un formulario sin uno.');
  if (!urlValida(f.sitioUrl)) e.push('Falta la web a la que lleva el botón final (tu landing o tu sitio).');
  return e;
}

/** Los parámetros del POST, ya serializados como los pide la Graph API. */
export function paramsFormulario(f: FormularioNuevo): Record<string, string> {
  const sitio = f.sitioUrl.trim();
  const questions = [
    // Orden fijo, el de Meta: los datos del perfil primero, las propias después.
    ...PREGUNTAS_ESTANDAR.filter((t) => f.estandar.includes(t)).map((type) => ({ type })),
    ...propiasLimpias(f).map((label, i) => ({ type: 'CUSTOM', key: `pregunta_${i + 1}`, label })),
  ];
  return {
    name: f.nombre.trim(),
    locale: 'es_LA',
    questions: JSON.stringify(questions),
    privacy_policy: JSON.stringify({ url: f.privacidadUrl.trim(), link_text: 'Política de privacidad' }),
    is_optimized_for_quality: String(f.mayorIntencion),
    follow_up_action_url: sitio,
    thank_you_page: JSON.stringify({
      title: '¡Listo, recibimos tus datos!',
      body: 'Te vamos a contactar muy pronto.',
      button_type: 'VIEW_WEBSITE',
      button_text: 'Ver el sitio',
      website_url: sitio,
    }),
  };
}

/** Un sitio sin la basura de tracking que Meta guarda pegada (?utm_…&fbclid=…). */
export function sitioLimpio(u: string | null | undefined): string | null {
  if (!urlValida(u)) return null;
  const x = new URL(String(u).trim());
  x.search = '';
  x.hash = '';
  return x.toString();
}
