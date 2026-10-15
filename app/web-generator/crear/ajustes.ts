// =============================================================================
// crear/ajustes — CÓMO se genera: los catálogos de los ajustes y lo que trae el cuadro o Crear al abrirse
// =============================================================================
// Tanda 7 (Martín, 15/10/2026), textual: «Y aprovecha el diseño que ya tenemos para meter las opciones... Por ejemplo
// la de "Personalizar", podría ir por defecto en el botón de + o en el desplegable de "plan", ya decide tú con criterio
// dónde iría... […] Todas las opciones como "Español México, la cantidad de secciones, el CTA de Agendar reunión u
// otros, etc... Deben ir dentro de + o en algún desplegable así...»
//
// Decidido: el «+» ADJUNTA (un archivo, una imagen, una indicación reciente) y el desplegable «Plan» dice CÓMO se
// genera: Plan o Express arriba y, debajo, la cantidad de secciones, el objetivo (el CTA) y el idioma; lo que no
// entra ahí («Personalizar»: el largo del texto, a quién le escribe, el tono, las imágenes, la landing de base y las
// instrucciones) es «Más ajustes», un panel pegado al cuadro (crear/AjustesCaja.tsx). Los catálogos vivían en
// CrearConIA.tsx y los usan las dos pantallas (el cuadro y el esquema de Crear): un lugar.
//
// Puro (sin 'use client'): lo importan las pantallas y los tests.
// =============================================================================

import { OBJETIVOS_LANDING, type ObjetivoLanding } from '@/lib/landing-spec';
import type { FuenteImagenes, ParamsGeneracion, TextoPorSeccion } from '@/lib/editor-landing/api-tipos';
import { MAX_INSTRUCCIONES, PARAMS_DEFAULT } from '@/lib/editor-landing/ia-reglas';
import type { OpcionDesplegable } from '../MiniaturaLanding';

export const IDIOMAS: readonly OpcionDesplegable<string>[] = [
  { valor: 'es-MX', texto: 'Español (México)' },
  { valor: 'es-ES', texto: 'Español (España)' },
  { valor: 'en-US', texto: 'English (US)' },
  { valor: 'pt-BR', texto: 'Português (Brasil)' },
];

export const TEXTOS: readonly { valor: TextoPorSeccion; texto: string }[] = [
  { valor: 'breve', texto: 'Breve' },
  { valor: 'medio', texto: 'Medio' },
  { valor: 'detallado', texto: 'Detallado' },
  { valor: 'extenso', texto: 'Extenso' },
];

/**
 * «Tu texto»: qué se hace con un texto largo o con el de un archivo (ex «Pegar texto»: Generar · Condensar ·
 * Conservar). Los valores son los de siempre (`modoTexto` del server); los rótulos dicen qué pasa con TU texto.
 */
export const MODOS_TEXTO: readonly { valor: ParamsGeneracion['modoTexto']; texto: string; ayuda: string; icono: string }[] = [
  { valor: 'generar', texto: 'Usar de guía', ayuda: 'Escribe el copy completo con tu texto como guía', icono: 'destellos' },
  { valor: 'condensar', texto: 'Resumir', ayuda: 'Resume tu texto sin agregar ideas', icono: 'flecha-abajo' },
  { valor: 'conservar', texto: 'Tal cual', ayuda: 'Usa tu texto palabra por palabra', icono: 'candado' },
];

export const FUENTES: readonly OpcionDesplegable<FuenteImagenes>[] = [
  { valor: 'stock', texto: 'Fotos de archivo', sub: 'Buscar fotos gratuitas de alta resolución', icono: 'camara' },
  { valor: 'marcadores', texto: 'Marcadores de posición de imagen', sub: 'Genera marcadores de posición vacíos para tus propias imágenes', icono: 'imagen' },
  { valor: 'ninguna', texto: 'No agregues imágenes', icono: 'ojo-tachado' },
];

export const OBJETIVOS: readonly OpcionDesplegable<ObjetivoLanding>[] = OBJETIVOS_LANDING.map((o) => ({ valor: o.value, texto: o.label, sub: o.hint }));

/** Plan o Express: lo de arriba del desplegable. */
export type ModoGen = 'plan' | 'express';
export const OPCIONES_COMO: readonly { valor: ModoGen; texto: string; sub: string; icono: string; etiqueta?: string }[] = [
  { valor: 'plan', texto: 'Plan', etiqueta: 'Predeterminado', sub: 'Revisa el esquema antes de crear', icono: 'lista' },
  { valor: 'express', texto: 'Express', sub: 'Más rápido, sin revisar el esquema', icono: 'rayo' },
];

/**
 * La landing de base que pide un deep link (`?url=`), sólo si es una de las analizadas de este negocio.
 * Comparación exacta (la URL viaja tal cual la guarda el Analyst): un parecido no es una clave.
 */
export function baseDelDeepLink(url: string | null | undefined, analizadas: readonly { url: string }[]): string | null {
  const u = (url ?? '').trim();
  if (!u) return null;
  return analizadas.some((a) => a.url === u) ? u : null;
}

/** Un objetivo de la query, si es uno de la lista cerrada. */
export function objetivoValido(v: string | null | undefined): ObjetivoLanding | null {
  return OBJETIVOS_LANDING.some((o) => o.value === v) ? (v as ObjetivoLanding) : null;
}

/**
 * Las instrucciones de un ARCHIVO: lo escrito al lado en el cuadro y, después, las de «Más ajustes». Las dos (antes de
 * la tanda 7 lo escrito pisaba las otras, que no existían en el cuadro), con el tope de la ruta.
 */
export function instruccionesConArchivo(escrito: string | null | undefined, ajustes: string | null | undefined): string {
  return [escrito, ajustes].map((s) => (s ?? '').trim()).filter(Boolean).join('\n\n').slice(0, MAX_INSTRUCCIONES);
}

/**
 * Los ajustes con los que abre el cuadro o Crear: los de siempre, lo que traen (la semilla del cuadro, el
 * `arranque` de Crear) y la landing de base VALIDADA contra las analizadas de ESTE negocio (una URL cualquiera en
 * la query no mete un diagnóstico ajeno al prompt).
 */
export function paramsIniciales(
  de: { params?: Partial<ParamsGeneracion>; base?: string; objetivo?: string } | null | undefined,
  analizadas: readonly { url: string }[],
): ParamsGeneracion {
  return {
    ...PARAMS_DEFAULT,
    ...de?.params,
    objetivo: objetivoValido(de?.objetivo) ?? objetivoValido(de?.params?.objetivo) ?? PARAMS_DEFAULT.objetivo,
    basadoEnUrl: baseDelDeepLink(de?.base ?? de?.params?.basadoEnUrl, analizadas),
  };
}
