// =============================================================================
// creaciones-automatizacion — una AUTOMATIZACIÓN como creación publicada: lo PURO
// =============================================================================
// El enchufe del tipo `automatizacion` (lib/creaciones-enchufes.ts) exporta la automatización con el formato de «Copiar
// flujo» (lib/flujo-copia.ts: `copiaDeFlujo`) y la usa con `crearDesdeCopia`, como un token pegado. La diferencia es
// a QUIÉN llega: un token se lo pasa un negocio a quien él elige; una creación la ve CUALQUIER negocio. Por eso, antes
// de publicar, la copia pierde TODO lo que apunta a algo de su negocio (`definicionPublicable`):
//   · las referencias por id (audios, archivos, etiquetas, líneas, etapas de condiciones, «Ir a» a otra automatización):
//     `limpiarReferencias` contra un negocio VACÍO, que es la misma regla de «Pegar y marcar en rojo». Un audio con
//     guion pasa a texto; uno sin guion queda sin audio (el que la use graba el suyo).
//   · los ids del CRON (embudo, producto, etiqueta): queda el tipo y la etapa por su clave. Del otro lado, si la etapa
//     no existe, nace «Elige qué la dispara» (`crearDesdeCopia`).
//   · lo que nombra a una persona o a una cuenta del negocio: el remitente del email, la plantilla de su Meta, la voz
//     clonada que no es «propia» (pasa a «propia»: la del que la use), los ejemplos del ensayo y, en el paso «⚡ Acción»,
//     todo parámetro que sea un id, un email o un teléfono.
// Lo que SÍ viaja es la creación: las tarjetas, sus textos, sus esperas y sus ramas. Los textos se publican tal cual:
// el modal de publicar lo dice antes del botón.
//
// SIN `server-only`: lo prueba tests/creaciones-automatizacion.test.ts.
// =============================================================================

import { copiaDeFlujo, leerCopia, limpiarReferencias, resumenDeCopia, type CopiaFlujo, type CronCopiado, type Existentes, type PasoCopiado } from './flujo-copia';

const NADA: Existentes = {
  audios: new Set(), adjuntos: new Set(), etiquetas: new Set(), secuencias: new Set(), lineas: new Set(), etapas: new Set(),
};

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Un parámetro de una acción que apunta a algo del negocio: un id (`leadId`, `etiquetaIds`, `funnel_id`), un email,
 *  un teléfono, un chat. El de los ids distingue mayúsculas: con /i, `paid` o `valid` serían un id. */
const PARAM_ID = /(^id$|Ids?$|_ids?$)/;
const PARAM_CONTACTO = /(email|correo|tel[eé]fono|phone|jid|n[uú]mero|destinatari)/i;
const esDelNegocio = (k: string) => PARAM_ID.test(k) || PARAM_CONTACTO.test(k);

function sinDatosDelNegocio(p0: PasoCopiado): PasoCopiado {
  const p: PasoCopiado = { ...p0 };
  delete p.remitente;
  delete p.template_wa;
  delete p.template_categoria;
  delete p.template_idioma;
  delete p.template_param;
  delete p.ejemplos;
  if (esObjeto(p.audio) && p.audio.voz !== 'propia') p.audio = { ...p.audio, voz: 'propia' };
  const acc = p.accion;
  if (esObjeto(acc) && esObjeto(acc.params)) {
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(acc.params)) if (!esDelNegocio(k)) params[k] = v;
    p.accion = { ...acc, params };
  }
  return p;
}

const cronSinIds = (d: CronCopiado): CronCopiado => ({
  id: d.id, trigger_tipo: d.trigger_tipo,
  ...(d.etapa != null ? { etapa: d.etapa } : {}),
  ...(Array.isArray(d.etapas) ? { etapas: [...d.etapas] } : {}),
});

/** La copia de una automatización, sin nada de su negocio: lo que se publica. */
export function definicionPublicable(c: CopiaFlujo): CopiaFlujo {
  const pasos = limpiarReferencias(c.pasos, NADA, c.guiones ?? {}).map(sinDatosDelNegocio);
  return copiaDeFlujo({
    nombre: c.nombre ?? 'Automatización',
    emoji: c.emoji,
    pasos,
    posiciones: c.posiciones ?? null,
    disparadores: (c.disparadores ?? []).map(cronSinIds),
    // Los guiones ya se usaron (un audio con guion pasó a texto): no viajan.
  });
}

/** La definición publicada, leída de vuelta (de la base o de una API). null si no es una automatización entera. */
export function leerDefinicionAutomatizacion(def: unknown): CopiaFlujo | null {
  let texto: string;
  try { texto = JSON.stringify(def); } catch { return null; }
  const c = leerCopia(texto);
  return c && c.que === 'flujo' ? c : null;
}

/** Lo que se dice de una automatización publicada sin abrirla. */
export function resumenAutomatizacion(def: unknown): { nombre: string; detalle: string } | null {
  const c = leerDefinicionAutomatizacion(def);
  if (!c) return null;
  const r = resumenDeCopia(c);
  return { nombre: r.nombre, detalle: r.tarjetas === 1 ? '1 tarjeta' : `${r.tarjetas} tarjetas` };
}
