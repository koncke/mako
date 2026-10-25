// =============================================================================
// La landing principal de MaKo, con lo que hace la competencia: dos portadas para testear (25/10/2026)
// =============================================================================
// Martín (25/10): «Para las landing de MaKo, y en general la comunicación y la forma de vender, quiero que investigues al
// 100% como lo venden otros... tipo landing page, no saas super consolidados». La investigación (80 productos, precios y
// frases verificados el 25/10) propone la landing sección por sección (§6a): esto la arma como documentos de Web Generator
// del workspace de la plataforma, cada sección un «Diseño editable» (html-editable.ts): se edita a la vista y MaKo cambia
// sus textos desde el chat sin romper el diseño.
//
// EL DISEÑO es el de 100ads.ai, el competidor directo, abierto el 25/10 y copiado en su estructura (la regla de AGENTS.md:
// ninguna pantalla se diseña de cero): la etiqueta chica, el titular grande y apretado con una línea en cursiva serif, las
// tarjetas grises redondeadas, la franja oscura de los precios, las preguntas en dos columnas y el bloque del fundador con
// tres números. Con los colores de MaKo (la tinta #12151B, el azul #2F6FED y la estrella dorada) y su letra, Geist.
//
// LAS REGLAS (el Cerebro, 25/10):
//   · Nada inventado: ni contadores ni testimonios. El caso es el de Mauricio (el que ya contaba la landing), y las cifras del
//     fundador son las de sus testimonios.
//   · El precio a la vista desde la portada, y NUNCA escrito a mano: las marcas de lib/editor-landing/precios-en-landing.ts
//     (`data-mako-desde`, `data-mako-precio`) y el lugar de las columnas (`data-mako-planes`); hola-mako.com pone los de hoy
//     (lib/planes-mako.ts). Lo de adentro es el respaldo, y sale de los mismos planes.
//   · Español neutro, con «tú» (AGENTS.md y tests/puente-panel-copy.test.ts: el voseo no pasa, ni en un script).
//   · Sólo lo que MaKo hace HOY. El media buyer que mueve el presupuesto todavía no está en producción: la portada C («del
//     anuncio a la llamada») y el control de los límites esperan (docs/hallazgos-editor-landing.md).
//   · La garantía de 14 días está decidida (docs/ofertas-mako.md), pero /reembolsos dice que el mes pagado no se devuelve:
//     hasta que Planes la escriba ahí, la landing no la promete (`GARANTIA`).
//
// Uso (desde la raíz del repo; `--conditions=react-server` por los módulos server-only del publicador):
//   node --conditions=react-server --import tsx scripts/landings-mako-v2.mts --salida <carpeta>      → los JSON, sin subir
//   node --conditions=react-server --import tsx scripts/landings-mako-v2.mts --subir [--principal]   → PRODUCCIÓN (ws 9)
// `--subir` crea (o pisa, con `--doc-equipo <id>` / `--doc-todo-junto <id>`) los dos documentos y los publica en
// hola-mako.com/vsl/<slug>; `--principal` marca la portada A como la raíz de hola-mako.com.
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_DEFAULT, type ConfigLanding } from '../lib/editor-landing/api-tipos';
import { NODO, ATTRS_TARJETA_DEFAULT, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { PIXEL_META_MAKO } from '../lib/meta-pixel-mako';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';
import { precioDesde, precioUsd } from '../lib/editor-landing/precios-en-landing';

const APP = 'https://hola-mako.com';

/** La garantía va en la landing cuando /reembolsos la diga (hoy: el mes pagado no se devuelve). */
export const GARANTIA: string | null = null;

/** Las dos portadas que salen hoy. La C («del anuncio a la llamada») sale con el media buyer en producción. */
export const PORTADAS = {
  equipo: {
    slug: 'mako-equipo',
    titulo: 'MaKo · Portada A · El equipo',
    etiqueta: 'Tu equipo de ventas con IA, en español',
    h1: 'Tu media buyer, tu setter y tu diseñador.',
    serif: 'Ya contratados.',
    bajada: 'MaKo arma tus anuncios y los publica, contesta cada WhatsApp y le pasa tu agenda al que está listo para comprar. Tú apruebas y cierras la venta.',
    seo: 'MaKo · Tu equipo de ventas con IA, ya contratado',
  },
  'todo-junto': {
    slug: 'mako-todo-junto',
    titulo: 'MaKo · Portada B · Todo junto',
    etiqueta: 'CRM, páginas, WhatsApp, anuncios y creativos',
    h1: 'Todo lo que hoy pagas por separado,',
    serif: 'en un solo lugar.',
    bajada: '', // se arma con la cuenta del ahorro (más abajo): el número sale de la misma tabla que se muestra
    seo: 'MaKo · Todo lo que pagas por separado, en un solo lugar',
  },
} as const;
export type Portada = keyof typeof PORTADAS;

/**
 * Lo que cuesta afuera, por categoría y sin marcas (el estilo de Paperbell), con los precios de lista verificados el
 * 25/10/2026 en la investigación: 100ads (creativos), SetSmart Pro (setter), Aurora CRM (CRM de WhatsApp con agente) y
 * Skool Pro (cursos y comunidad, lo que usa el cliente). El media buyer (Ryze, US$89) entra cuando el de MaKo esté en
 * producción.
 */
export const AHORRO: ReadonlyArray<{ categoria: string; usd: number }> = [
  { categoria: 'Fábrica de creativos con IA', usd: 57 },
  { categoria: 'Setter con IA para WhatsApp', usd: 97 },
  { categoria: 'CRM de WhatsApp con agente de IA', usd: 99 },
  { categoria: 'Cursos y comunidad', usd: 99 },
];
export const TOTAL_AFUERA = AHORRO.reduce((s, f) => s + f.usd, 0);
/** «Más de US$350»: redondeado hacia abajo, para que la frase sea cierta. */
export const AFUERA_REDONDO = Math.floor(TOTAL_AFUERA / 50) * 50;

// Los precios de respaldo (lo que se ve en el editor): los mismos planes de hoy, nunca un número tipeado.
const PLANES_HOY = PLANES_MAKO_DEFAULT.filter((p) => p.activo);
const precioDe = (id: string): string => {
  const p = PLANES_HOY.find((x) => x.id === id);
  if (!p) throw new Error(`no está el plan ${id} en lib/planes-mako.ts`);
  return precioUsd(p.precioUsd);
};
const DESDE = precioUsd(precioDesde(PLANES_HOY) ?? 0);
export const desde = () => `<span data-mako-desde="">${DESDE}</span>`;
export const pro = () => `<span data-mako-precio="pro">${precioDe('pro')}</span>`;

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const planes = (slug: string) => `${APP}/planes?landing=${slug}`;

/** La estrella de MaKo (la de la criatura y el logo). */
const ESTRELLA = '<svg width="18" height="18" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E"></path></svg>';

export const encabezado = (etiqueta: string, titulo: string, bajada?: string, serif?: string) => `
    <div class="mkv-cabeza">
      <p class="mkv-etiqueta">${esc(etiqueta)}</p>
      <h2 class="mkv-h2">${esc(titulo)}${serif ? ` <em class="mkv-serif">${esc(serif)}</em>` : ''}</h2>
      ${bajada ? `<p class="mkv-bajada">${esc(bajada)}</p>` : ''}
    </div>`;

export const botones = (slug: string) => `
      <div class="mkv-botones">
        <a class="mkv-btn" href="${planes(slug)}">Empezar con MaKo</a>
        <a class="mkv-btn mkv-btn-borde" href="#planes">Ver los planes</a>
      </div>
      <p class="mkv-antiriesgo">Desde ${desde()} al mes · ${GARANTIA ? `${esc(GARANTIA)} · ` : ''}Sin permanencia · Usas tu propia IA</p>`;

// ─────────────────────────────────────────────────────────────────────────────
// Las secciones (en el orden de la investigación, §6a)
// ─────────────────────────────────────────────────────────────────────────────

export function nav(slug: string): string {
  return `<header class="mkv mkv-nav"><div class="mkv-in mkv-nav-in">
    <a class="mkv-logo" href="${APP}/"><span class="mkv-logo-marca">${ESTRELLA}</span><span class="mkv-logo-nombre">MaKo</span></a>
    <nav class="mkv-nav-links"><a href="#equipo">Cómo funciona</a><a href="#planes">Precios</a><a href="#preguntas">Preguntas</a></nav>
    <div class="mkv-nav-acciones"><a class="mkv-nav-entrar" href="${APP}/login">Entrar</a><a class="mkv-btn mkv-btn-chico" href="${planes(slug)}">Empezar</a></div>
  </div></header>`;
}

function portada(cual: Portada): string {
  const p = PORTADAS[cual];
  const bajada = cual === 'todo-junto'
    ? `Lo que afuera cuesta más de US$${AFUERA_REDONDO} al mes, en MaKo Pro cuesta ${pro()}. Con tu propia IA, sin recargo.`
    : esc(p.bajada);
  return `<section class="mkv mkv-portada" id="inicio"><div class="mkv-in">
    <p class="mkv-etiqueta mkv-centro">${esc(p.etiqueta)}</p>
    <h1 class="mkv-h1">${esc(p.h1)}<br><em class="mkv-serif">${esc(p.serif)}</em></h1>
    <p class="mkv-portada-bajada">${bajada}</p>
    ${botones(p.slug)}
    <div class="mkv-recorrido" aria-label="Un contacto, de tu anuncio a tu agenda">
      <div class="mkv-paso-tarjeta">
        <p class="mkv-mini">Tu anuncio en Meta</p>
        <p class="mkv-paso-titulo">Alguien toca «Enviar mensaje»</p>
        <p class="mkv-paso-texto">MaKo guarda de qué anuncio llegó.</p>
      </div>
      <div class="mkv-flecha" aria-hidden="true">→</div>
      <div class="mkv-paso-tarjeta mkv-chat">
        <p class="mkv-mini">WhatsApp</p>
        <p class="mkv-burbuja mkv-burbuja-el">Hola, vi tu anuncio. ¿Cómo funciona?</p>
        <p class="mkv-burbuja mkv-burbuja-mako">¡Hola! Te cuento. ¿Ya vendes por llamada o estás empezando?</p>
      </div>
      <div class="mkv-flecha" aria-hidden="true">→</div>
      <div class="mkv-paso-tarjeta mkv-paso-agenda">
        <p class="mkv-mini">Tu agenda</p>
        <p class="mkv-paso-titulo">Llamada agendada</p>
        <p class="mkv-paso-texto">Tú entras a la llamada y cierras.</p>
      </div>
    </div>
  </div></section>`;
}

export function caso(): string {
  return `<section class="mkv mkv-sec" id="resultados"><div class="mkv-in">
    ${encabezado('Resultados reales', 'Lo que pasó cuando Mauricio lo probó.', 'Mauricio vende su programa con anuncios, un video de venta y llamadas. Con MaKo vio en una sola pantalla qué anuncio le traía a los clientes que pagaban y por qué se ganaba o se perdía cada llamada.')}
    <div class="mkv-caso">
      <div class="mkv-caso-video"><video src="${APP}/vsl-assets/mauricio.mp4#t=0.6" controls preload="metadata" playsinline></video><p class="mkv-mini">Mauricio, en vivo</p></div>
      <div class="mkv-caso-datos">
        <div class="mkv-tarjeta"><p class="mkv-cifra">De menos de US$10K a más de US$70K al mes</p><p class="mkv-texto">En tres meses, sin cambiar la oferta ni el embudo.</p></div>
        <div class="mkv-tarjeta"><p class="mkv-cifra">20 veces más inversión en anuncios</p><p class="mkv-texto">Sin que se le cayera el retorno: ya sabía qué anuncio traía las ventas.</p></div>
        <p class="mkv-firma">Mauricio · Vende su programa con un video de venta y llamadas</p>
      </div>
    </div>
  </div></section>`;
}

function dolor(): string {
  const items: Array<[string, string]> = [
    ['El mensaje de las once de la noche', 'Alguien escribió por tu anuncio y nadie le contestó hasta el otro día. Para entonces, ya habló con otro.'],
    ['El anuncio que vendía se cansó', 'La semana pasada funcionaba. Hoy cuesta el doble y no tienes el siguiente listo.'],
    ['Seis suscripciones que no se hablan', 'El CRM por un lado, el WhatsApp por otro y las páginas en otra app. Pasas datos a mano de una a otra.'],
    ['No saber qué anuncio trajo la venta', 'Meta te dice clics y tu CRM te dice ventas. Nadie te dice cuál llevó a cuál.'],
    ['El setter que se fue', 'Le enseñaste todo y se fue. Volviste a contestar tú, entre llamada y llamada.'],
  ];
  return `<section class="mkv mkv-sec" id="dolor"><div class="mkv-in">
    ${encabezado('El cuello de botella', '¿Te suena?', 'Lo que le pasa a casi todos los que venden por llamada.')}
    <div class="mkv-grilla mkv-grilla-3">
      ${items.map(([t, x]) => `<div class="mkv-tarjeta"><p class="mkv-tarjeta-titulo">${esc(t)}</p><p class="mkv-texto">${esc(x)}</p></div>`).join('\n      ')}
    </div>
    <p class="mkv-remate"><em class="mkv-serif">Cada respuesta tarde es una venta que se va.</em></p>
  </div></section>`;
}

function equipo(): string {
  // Lo que hace HOY cada uno (lib/planes-mako.ts, «incluye», y las tabs que abre el plan). El ritmo, sólo donde es cierto.
  const puestos: Array<[string, string, string | null]> = [
    ['Setter', 'Contesta cada WhatsApp, pregunta lo justo y le pasa tu agenda al que califica.', 'Contesta a toda hora'],
    ['Media buyer', 'Arma tus campañas de Meta, las publica y te muestra cuáles traen ventas.', null],
    ['Diseñador de creativos', 'Hace imágenes, videos y avatares con IA para tus anuncios, con tu marca.', null],
    ['Diseñador web', 'Arma tus páginas de venta y las publica con tu dominio.', null],
    ['Analista de llamadas', 'Escucha tus llamadas de venta y te dice en qué objeción se cae cada cierre.', 'Después de cada llamada'],
    ['Project manager', 'Ordena las tareas de tu negocio y te dice qué hacer primero.', null],
  ];
  return `<section class="mkv mkv-sec mkv-sec-gris" id="equipo"><div class="mkv-in">
    ${encabezado('El equipo', 'Tu equipo, ya contratado.', 'Cada uno tiene un puesto y te avisa cuando te toca decidir. MaKo los coordina a todos.')}
    <div class="mkv-grilla mkv-grilla-3">
      ${puestos.map(([p, x, r], i) => `<div class="mkv-tarjeta mkv-tarjeta-blanca"><p class="mkv-numero">${String(i + 1).padStart(2, '0')}</p><p class="mkv-tarjeta-titulo">${esc(p)}</p><p class="mkv-texto">${esc(x)}</p>${r ? `<p class="mkv-ritmo">${esc(r)}</p>` : ''}</div>`).join('\n      ')}
    </div>
  </div></section>`;
}

export function circuito(): string {
  const pasos: Array<[string, string]> = [
    ['Llega el contacto', 'Desde tu anuncio, con su origen.'],
    ['MaKo conversa', 'Contesta y califica por WhatsApp.'],
    ['Se agenda', 'La llamada queda en tu agenda.'],
    ['Cierras la venta', 'Y queda en tu CRM.'],
    ['Ves qué la trajo', 'El anuncio, la página y la llamada de cada venta.'],
  ];
  return `<section class="mkv mkv-sec" id="como-funciona"><div class="mkv-in">
    ${encabezado('El circuito completo', 'Sabe qué anuncio te trajo cada venta.', 'Porque los anuncios, el WhatsApp, la agenda y el CRM viven en el mismo lugar. MaKo mira llamadas agendadas y ventas, no clics.')}
    <ol class="mkv-pasos">
      ${pasos.map(([t, x], i) => `<li class="mkv-paso"><span class="mkv-paso-n">${i + 1}</span><p class="mkv-tarjeta-titulo">${esc(t)}</p><p class="mkv-texto">${esc(x)}</p></li>`).join('\n      ')}
    </ol>
  </div></section>`;
}

function arranque(): string {
  const pasos: Array<[string, string]> = [
    ['Conecta tu IA', 'Tu Claude, tu ChatGPT o tu Gemini, con tu propia clave.'],
    ['Conecta tu WhatsApp y tu Meta', 'Tu número de siempre y tu cuenta de anuncios.'],
    ['Cuéntale a MaKo qué vendes', 'Arma tu oferta, tu página y tus mensajes. Tú revisas y apruebas.'],
  ];
  return `<section class="mkv mkv-sec mkv-sec-gris" id="arranque"><div class="mkv-in">
    ${encabezado('Cómo arranca', 'Tres pasos y está andando.', 'Conectas tu IA, tu WhatsApp y tu cuenta de Meta. MaKo arma el resto y tú apruebas.')}
    <div class="mkv-grilla mkv-grilla-3">
      ${pasos.map(([t, x], i) => `<div class="mkv-tarjeta mkv-tarjeta-blanca"><p class="mkv-numero">Paso ${i + 1}</p><p class="mkv-tarjeta-titulo">${esc(t)}</p><p class="mkv-texto">${esc(x)}</p></div>`).join('\n      ')}
    </div>
  </div></section>`;
}

export function tuIa(): string {
  const puntos: Array<[string, string]> = [
    ['Lo que gastas, lo ves en tu proveedor', 'Sin créditos de MaKo ni una billetera aparte: pagas lo que consume tu clave.'],
    ['Tus claves, cifradas', 'Se guardan cifradas y sólo las usa tu negocio.'],
    ['Sin sorpresas', 'Lo que trabaja solo usa tu clave: si se queda sin saldo, se detiene hasta que la recargues. Con Gemini puedes empezar gratis, con un tope por día.'],
  ];
  return `<section class="mkv mkv-sec" id="tu-ia"><div class="mkv-in">
    ${encabezado('Tu IA', 'Tu IA, al costo.', 'MaKo trabaja con tu Claude, tu ChatGPT o tu Gemini. La pagas directo a tu proveedor: no te revendemos créditos ni le ponemos recargo.')}
    <div class="mkv-grilla mkv-grilla-3">
      ${puntos.map(([t, x]) => `<div class="mkv-tarjeta"><p class="mkv-tarjeta-titulo">${esc(t)}</p><p class="mkv-texto">${esc(x)}</p></div>`).join('\n      ')}
    </div>
  </div></section>`;
}

function ahorro(): string {
  const veces = Math.floor(TOTAL_AFUERA / (PLANES_HOY.find((p) => p.id === 'pro')?.precioUsd ?? TOTAL_AFUERA));
  return `<section class="mkv mkv-sec" id="ahorro"><div class="mkv-in">
    ${encabezado('La cuenta', 'Lo que te ahorras.', `Lo mismo, comprado por separado, cuesta más de ${veces === 3 ? 'tres' : veces} veces.`)}
    <div class="mkv-tabla-caja"><table class="mkv-tabla">
      <thead><tr><th>Lo que hoy se paga por separado</th><th>Afuera, por mes</th></tr></thead>
      <tbody>
        ${AHORRO.map((f) => `<tr><td>${esc(f.categoria)}</td><td>${precioUsd(f.usd)}</td></tr>`).join('\n        ')}
        <tr class="mkv-tabla-total"><td>Total afuera</td><td>${precioUsd(TOTAL_AFUERA)} al mes</td></tr>
        <tr class="mkv-tabla-mako"><td>MaKo Pro, con todo esto adentro</td><td>${pro()} al mes, más lo que gaste tu IA</td></tr>
      </tbody>
    </table></div>
    <p class="mkv-nota">Y eso sin contar las páginas de venta, los tableros, el análisis de llamadas ni el project manager. Precios de lista de herramientas conocidas de cada categoría, al 25 de octubre de 2026.</p>
    <p class="mkv-nota">Con personas, la cuenta es otra: un setter cuesta entre US$800 y US$2.000 al mes, y un diseñador, unos US$1.500.</p>
  </div></section>`;
}

export function precios(slug: string): string {
  // El lugar de las columnas (app/vsl/PreciosLanding.tsx, con su título): lo de adentro es el respaldo del editor.
  return `<section class="mkv mkv-sec mkv-sec-noche" id="planes"><div class="mkv-in">
    <div class="mkv-planes" data-mako-planes="">
      <p class="mkv-etiqueta mkv-centro">Precios</p>
      <h2 class="mkv-h2 mkv-centro">Elige cómo arrancar.</h2>
      <p class="mkv-bajada mkv-centro">${PLANES_HOY.map((p) => `${esc(p.nombre)}: <span data-mako-precio="${p.id}">${precioUsd(p.precioUsd)}</span> al mes`).join(' · ')}</p>
      <div class="mkv-botones"><a class="mkv-btn" href="${planes(slug)}">Ver los planes</a></div>
    </div>
  </div></section>`;
}

function paraQuien(): string {
  const si = ['Vendes con anuncios y llamadas, o quieres empezar a hacerlo.', 'Ya tienes una oferta y quieres más llamadas en tu agenda.', 'Te cansaste de pagar herramientas que no se hablan entre sí.'];
  const no = ['Todavía no tienes qué vender.', 'Esperas que la IA cierre la venta por ti: MaKo contesta, califica y agenda; la llamada la haces tú.', 'No quieres vender por WhatsApp.'];
  return `<section class="mkv mkv-sec" id="para-quien"><div class="mkv-in">
    ${encabezado('Para quién es', 'MaKo no es para ti si…', '…todavía no tienes una oferta, o esperas que la IA cierre la venta por ti.')}
    <div class="mkv-grilla mkv-grilla-2">
      <div class="mkv-tarjeta"><p class="mkv-tarjeta-titulo">Es para ti si</p><ul class="mkv-lista mkv-lista-si">${si.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="mkv-tarjeta"><p class="mkv-tarjeta-titulo">No es para ti si</p><ul class="mkv-lista mkv-lista-no">${no.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
  </div></section>`;
}

function fundador(): string {
  // Las cifras son las de los testimonios de quienes trabajaron con Martín (la landing de siempre, #testimonios).
  const numeros: Array<[string, string]> = [['+US$60K', 'para una academia de IA'], ['+200M', 'de vistas en canales automatizados'], ['+20', 'nichos con contenido a escala']];
  return `<section class="mkv mkv-sec mkv-sec-gris" id="quien"><div class="mkv-in mkv-fundador">
    <figure class="mkv-fundador-foto"><img src="${APP}/vsl-assets/caso-martin.jpg" alt="Martín y Mauricio" loading="lazy"><figcaption class="mkv-mini">Martín y Mauricio</figcaption></figure>
    <div class="mkv-fundador-texto">
      <p class="mkv-etiqueta">Quién está detrás</p>
      <h2 class="mkv-h2">MaKo lo hizo alguien que arma sistemas de venta para vivir.</h2>
      <p class="mkv-bajada">Detrás de MaKo está Martín. Antes armó la adquisición y las ventas de academias, agencias y canales de contenido. MaKo nació armando el negocio de Mauricio.</p>
      <div class="mkv-numeros">${numeros.map(([n, t]) => `<div><p class="mkv-numero-grande">${esc(n)}</p><p class="mkv-mini">${esc(t)}</p></div>`).join('')}</div>
    </div>
  </div></section>`;
}

const CLAVES_PREGUNTAS = ['tecnologia', 'cierra', 'equivoca', 'numero', 'bloqueo', 'ia', 'equipo', 'permanencia', 'datos', 'chatgpt'] as const;

/** Las preguntas frecuentes, con clave: la principal usa todas; cada landing de funcionalidad o avatar, las suyas. */
export const PREGUNTAS: Record<string, [string, string]> = Object.fromEntries(([
    ['¿Necesito saber de tecnología o escribir prompts?', 'No. Le cuentas a MaKo qué vendes y a quién, y arma tu oferta, tus páginas y tus mensajes. Tú revisas y apruebas.'],
    ['¿La IA cierra la venta?', 'No. MaKo contesta, pregunta lo justo y agenda la llamada. La venta la cierras tú, y después MaKo te dice qué pasó en cada llamada.'],
    ['¿Qué pasa si la IA se equivoca?', 'Todas las conversaciones quedan en tu bandeja y puedes tomar cualquiera cuando quieras. Tú decides qué mensajes salen solos.'],
    ['¿Puedo usar mi número de WhatsApp actual?', 'Sí. Lo conectas escaneando un código QR, como WhatsApp Web, y sigues usando tu teléfono como siempre.'],
    ['¿Me pueden bloquear el WhatsApp?', 'La conexión por QR no es la oficial de WhatsApp: si mandas mensajes masivos a gente que no te escribió, WhatsApp puede bloquear el número. Úsala para contestar y hacer seguimiento, no para mandar en masa.'],
    ['¿Cuánto me sale la IA?', 'Lo que consuma tu clave de Claude, ChatGPT o Gemini, pagado directo a tu proveedor. MaKo no le pone recargo. Con Gemini puedes empezar gratis, con un tope por día.'],
    ['¿Reemplaza a mi equipo o a mi agencia?', 'Hace lo repetido: contestar, hacer seguimiento, armar piezas y ordenar tareas. Tu equipo entra con su propio usuario.'],
    ['¿Tengo permanencia? ¿Cómo cancelo?', 'No hay permanencia. Te das de baja cuando quieras desde tu cuenta, en Configuración del negocio, y no se te cobra el mes siguiente.'],
    ['¿Mis datos entrenan a la IA?', 'MaKo no entrena modelos con tus datos. La IA es la tuya: lo que pide pasa por tu propia cuenta de Claude, ChatGPT o Gemini.'],
    ['¿En qué se diferencia de ChatGPT?', 'ChatGPT conversa contigo. MaKo trabaja dentro de tu negocio: tu CRM, tu WhatsApp, tus anuncios y tu agenda, con tu propia IA.'],
] as Array<[string, string]>).map((qa, i) => [CLAVES_PREGUNTAS[i], qa]));

function preguntas(): string {
  return preguntasCon(CLAVES_PREGUNTAS.map((k) => PREGUNTAS[k]));
}

/** La sección de preguntas con estas (en este orden): la primera, abierta. */
export function preguntasCon(qa: ReadonlyArray<[string, string]>): string {
  return `<section class="mkv mkv-sec" id="preguntas"><div class="mkv-in mkv-faq">
    <div class="mkv-faq-cabeza"><p class="mkv-etiqueta">Preguntas frecuentes</p><h2 class="mkv-h2">Antes de empezar.</h2></div>
    <div class="mkv-faq-lista">
      ${qa.map(([q, a], i) => `<details class="mkv-faq-item"${i === 0 ? ' open=""' : ''}><summary>${esc(q)}</summary><p class="mkv-texto">${esc(a)}</p></details>`).join('\n      ')}
    </div>
  </div></section>`;
}

export function cierre(slug: string): string {
  return `<section class="mkv mkv-cierre" id="empezar"><div class="mkv-in mkv-centro">
    <h2 class="mkv-h1 mkv-h1-chico">Tú cierras.<br><em class="mkv-serif">Del resto se encarga MaKo.</em></h2>
    <p class="mkv-portada-bajada">${GARANTIA ? `${esc(GARANTIA)}. ` : ''}Empieza hoy. Si no te sirve, te das de baja desde tu cuenta, cuando quieras.</p>
    ${botones(slug)}
  </div></section>`;
}

export function pie(): string {
  const col = (t: string, links: Array<[string, string]>) => `<div><p class="mkv-pie-titulo">${esc(t)}</p>${links.map(([x, h]) => `<a href="${h.startsWith('http') ? h : APP + h}">${esc(x)}</a>`).join('')}</div>`;
  return `<footer class="mkv mkv-pie"><div class="mkv-in mkv-pie-in">
    <div class="mkv-pie-marca"><span class="mkv-logo-marca">${ESTRELLA}</span><span class="mkv-logo-nombre">MaKo</span><p class="mkv-mini">Tu equipo de ventas con IA, en español.</p></div>
    ${col('MaKo para', [['Coaches', '/vsl/coaches'], ['Infoproductores', '/vsl/infoproductores'], ['Inmobiliarias', '/vsl/inmobiliarias']])}
    ${col('Lo que hace', [['Páginas de venta', '/vsl/crear-landings'], ['Automatizaciones', '/vsl/automatizaciones'], ['Tableros', '/vsl/dashboards'], ['Contenidos', '/vsl/contenidos'], ['Avatares con IA', '/vsl/avatares-ia']])}
    ${col('MaKo', [['Planes', '/planes'], ['MaKo Partners', '/mako-partners'], ['Entrar', '/login']])}
    ${col('Legal', [['Términos', '/terminos'], ['Privacidad', '/privacidad'], ['Reembolsos', '/reembolsos']])}
  </div></footer>`;
}

/** Las secciones de una portada, en orden: [id, HTML]. */
export function seccionesDe(cual: Portada): Array<[string, string]> {
  const slug = PORTADAS[cual].slug;
  return [
    ['nav', nav(slug)], ['inicio', portada(cual)], ['resultados', caso()], ['dolor', dolor()], ['equipo', equipo()],
    ['como-funciona', circuito()], ['arranque', arranque()], ['tu-ia', tuIa()], ['ahorro', ahorro()], ['planes', precios(slug)],
    ['para-quien', paraQuien()], ['quien', fundador()], ['preguntas', preguntas()], ['empezar', cierre(slug)], ['pie', pie()],
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// La hoja (la de 100ads en estructura, con los colores y la letra de MaKo)
// ─────────────────────────────────────────────────────────────────────────────

export const CSS_MAKO_V2 = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
.mkv { --tinta: #12151B; --gris: #5B6472; --gris2: #454C58; --fondo: #F7F7F5; --tarjeta: #EEF0F3; --borde: #E3E6EB; --azul: #2F6FED; --azul2: #1F55C9; --noche: #0E1626; --oro: #F2B01E; --verde: #1E9E57;
  font-family: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--tinta); background: var(--fondo); box-sizing: border-box; }
/* El reset va con :where (sin peso): si no, le gana a cada clase de abajo y se come sus márgenes. */
:where(.mkv) *, :where(.mkv) *::before, :where(.mkv) *::after { box-sizing: border-box; }
:where(.mkv) :where(p, h1, h2, ul, ol, figure) { margin: 0; }
:where(.mkv) a { color: inherit; }
.mkv-in { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
.mkv-centro { text-align: center; }
.mkv-etiqueta { font-size: 13px; font-weight: 500; color: var(--gris); letter-spacing: .01em; margin-bottom: 14px; }
.mkv-h1 { font-size: clamp(40px, 6.2vw, 72px); line-height: 1.02; letter-spacing: -.045em; font-weight: 800; text-align: center; }
.mkv-h1-chico { font-size: clamp(36px, 5vw, 60px); }
.mkv-serif { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-weight: 400; letter-spacing: -.01em; }
.mkv-h1 .mkv-serif { font-size: .92em; }
.mkv-h2 { font-size: clamp(30px, 3.8vw, 44px); line-height: 1.08; letter-spacing: -.035em; font-weight: 700; max-width: 760px; }
.mkv-h2 .mkv-serif { font-size: 1.04em; }
.mkv-bajada { margin-top: 16px; font-size: 17px; line-height: 1.55; color: var(--gris); max-width: 640px; }
.mkv-centro.mkv-bajada, .mkv-centro .mkv-bajada { margin-left: auto; margin-right: auto; }
.mkv-cabeza { margin-bottom: 40px; }
.mkv-texto { font-size: 15px; line-height: 1.55; color: var(--gris); }
.mkv-mini { font-size: 12.5px; color: var(--gris); }
.mkv-btn { display: inline-flex; align-items: center; justify-content: center; height: 50px; padding: 0 26px; border-radius: 999px; background: var(--azul); color: #fff !important; font-size: 15.5px; font-weight: 600; text-decoration: none; transition: background .15s ease, transform .15s ease; }
.mkv-btn:hover { background: var(--azul2); transform: translateY(-1px); }
.mkv-btn-borde { background: transparent; color: var(--tinta) !important; box-shadow: inset 0 0 0 1.5px var(--borde); }
.mkv-btn-borde:hover { background: #fff; }
.mkv-btn-chico { height: 38px; padding: 0 18px; font-size: 14px; }
.mkv-botones { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 30px; }
.mkv-antiriesgo { margin-top: 16px; text-align: center; font-size: 13.5px; color: var(--gris); }
.mkv-antiriesgo [data-mako-desde] { color: var(--tinta); font-weight: 600; }
/* La barra */
.mkv-nav { position: sticky; top: 0; z-index: 40; background: rgba(247,247,245,.86); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(18,21,27,.06); }
.mkv-nav-in { height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.mkv-logo { display: flex; align-items: center; gap: 9px; text-decoration: none; }
.mkv-logo-marca { width: 34px; height: 34px; border-radius: 10px; background: #1A1712; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.mkv-logo-nombre { font-weight: 700; font-size: 22px; letter-spacing: -.02em; }
.mkv-nav-links { display: flex; gap: 26px; font-size: 14px; }
.mkv-nav-links a { text-decoration: none; color: var(--gris2); }
.mkv-nav-links a:hover { color: var(--tinta); }
.mkv-nav-acciones { display: flex; align-items: center; gap: 18px; font-size: 14px; }
.mkv-nav-entrar { text-decoration: none; color: var(--gris2); }
/* La portada */
.mkv-portada { padding: 88px 0 80px; background: radial-gradient(120% 70% at 50% 0%, #EAF0FD 0%, var(--fondo) 62%); }
.mkv-portada .mkv-etiqueta { text-align: center; }
.mkv-portada-bajada { margin: 22px auto 0; max-width: 640px; text-align: center; font-size: 18px; line-height: 1.55; color: var(--gris); }
.mkv-portada-bajada [data-mako-precio] { color: var(--tinta); font-weight: 600; }
.mkv-recorrido { margin-top: 56px; display: grid; grid-template-columns: 1fr auto 1.25fr auto 1fr; align-items: center; gap: 14px; }
.mkv-paso-tarjeta { background: #fff; border: 1px solid var(--borde); border-radius: 20px; padding: 18px; box-shadow: 0 10px 30px -18px rgba(18,21,27,.25); text-align: left; }
.mkv-paso-titulo { font-weight: 600; font-size: 15.5px; margin-top: 6px; }
.mkv-paso-texto { font-size: 13.5px; color: var(--gris); margin-top: 4px; line-height: 1.45; }
.mkv-paso-agenda { border-color: rgba(30,158,87,.35); }
.mkv-paso-agenda .mkv-paso-titulo { color: var(--verde); }
.mkv-flecha { color: #A2A9B5; font-size: 22px; }
.mkv-chat .mkv-burbuja { font-size: 13.5px; line-height: 1.4; padding: 9px 12px; border-radius: 14px; margin-top: 8px; max-width: 92%; }
.mkv-burbuja-el { background: var(--tarjeta); }
.mkv-burbuja-mako { background: #DCF8C6; margin-left: auto; }
.mkv-chat-grande { max-width: 560px; padding: 22px; }
.mkv-chat-grande .mkv-burbuja { font-size: 15px; padding: 11px 14px; }
.mkv-chat-final { margin-top: 14px; display: inline-block; padding: 7px 12px; border-radius: 999px; background: #E9F6EE; color: var(--verde); font-size: 13.5px; font-weight: 600; }
/* Las secciones */
.mkv-sec { padding: 96px 0; }
.mkv-sec-gris { background: #EFF1F4; }
.mkv-sec-noche { background: var(--noche); color: #fff; }
.mkv-sec-noche .mkv-etiqueta, .mkv-sec-noche .mkv-bajada { color: #AEB8CC; }
.mkv-grilla { display: grid; gap: 16px; }
.mkv-grilla-3 { grid-template-columns: repeat(3, 1fr); }
.mkv-grilla-2 { grid-template-columns: repeat(2, 1fr); }
.mkv-tarjeta { background: var(--tarjeta); border-radius: 22px; padding: 26px; }
.mkv-tarjeta-blanca { background: #fff; border: 1px solid var(--borde); }
.mkv-tarjeta-titulo { font-weight: 650; font-size: 18px; letter-spacing: -.01em; margin-bottom: 8px; }
.mkv-numero { font-size: 12.5px; font-weight: 600; color: var(--azul); margin-bottom: 12px; letter-spacing: .02em; }
.mkv-ritmo { display: inline-block; margin-top: 14px; padding: 5px 10px; border-radius: 999px; background: #E9F6EE; color: var(--verde); font-size: 12.5px; font-weight: 600; }
.mkv-remate { margin-top: 44px; text-align: center; font-size: clamp(24px, 3vw, 34px); }
/* El caso */
.mkv-caso { display: grid; grid-template-columns: 1fr 1.1fr; gap: 20px; align-items: stretch; }
.mkv-caso-video video { width: 100%; height: 100%; max-height: 440px; object-fit: cover; border-radius: 22px; background: #000; display: block; }
.mkv-caso-video .mkv-mini { margin-top: 8px; }
.mkv-caso-datos { display: flex; flex-direction: column; gap: 16px; }
.mkv-cifra { font-size: clamp(24px, 2.6vw, 32px); line-height: 1.1; letter-spacing: -.03em; font-weight: 750; margin-bottom: 10px; }
.mkv-firma { font-size: 14px; color: var(--gris2); font-weight: 500; }
.mkv-prueba { padding: 40px; text-align: center; }
.mkv-prueba .mkv-texto { max-width: 560px; margin: 0 auto; }
/* El circuito */
.mkv-pasos { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; counter-reset: none; }
.mkv-paso { background: var(--tarjeta); border-radius: 20px; padding: 22px 18px; position: relative; }
.mkv-paso-n { display: inline-flex; width: 30px; height: 30px; border-radius: 50%; align-items: center; justify-content: center; background: var(--azul); color: #fff; font-weight: 700; font-size: 14px; margin-bottom: 14px; }
.mkv-paso:last-child { background: #12151B; color: #fff; }
.mkv-paso:last-child .mkv-texto { color: #C3CAD6; }
.mkv-paso:last-child .mkv-paso-n { background: var(--oro); color: #12151B; }
/* La cuenta */
.mkv-tabla-caja { border: 1px solid var(--borde); border-radius: 22px; overflow: hidden; background: #fff; }
.mkv-tabla { width: 100%; border-collapse: collapse; font-size: 15.5px; }
.mkv-tabla th { text-align: left; font-size: 13px; font-weight: 500; color: var(--gris); padding: 16px 24px; background: #FAFAF8; border-bottom: 1px solid var(--borde); }
.mkv-tabla td { padding: 16px 24px; border-bottom: 1px solid var(--borde); }
.mkv-tabla td:last-child, .mkv-tabla th:last-child { text-align: right; white-space: nowrap; }
.mkv-tabla-total td { font-weight: 700; }
.mkv-tabla-mako td { background: #EEF4FF; font-weight: 700; color: var(--azul2); border-bottom: 0; }
.mkv-tabla-3 td:last-child, .mkv-tabla-3 th:last-child { text-align: left; white-space: normal; }
.mkv-tabla-3 td:first-child { font-weight: 600; }
.mkv-tabla-mako-celda { background: #F4F8FF; color: var(--azul2); font-weight: 600; }
.mkv-tabla-3 tr:last-child td { border-bottom: 0; }
.mkv-nota { margin-top: 14px; font-size: 13.5px; color: var(--gris); line-height: 1.5; }
/* Los precios */
.mkv-planes { padding: 8px 0; }
.mkv-planes .mkv-h2 { margin: 0 auto; }
/* Las columnas de Planes (app/vsl/PreciosLanding.tsx) escriben su título en tinta: sobre la franja oscura, claro. */
.mkv-sec-noche .mk-precios-titulo { color: #fff; }
.mkv-sec-noche .mk-precios-sub, .mkv-sec-noche .mk-precios-pie { color: #AEB8CC; }
.mkv-sec-noche .mk-precios-pie a { color: #9DBBFF; }
/* Para quién */
.mkv-lista { list-style: none; padding: 0; display: grid; gap: 12px; }
.mkv-lista li { position: relative; padding-left: 28px; font-size: 15.5px; line-height: 1.5; color: var(--gris2); }
.mkv-lista li::before { position: absolute; left: 0; top: 1px; font-weight: 700; }
.mkv-lista-si li::before { content: '✓'; color: var(--verde); }
.mkv-lista-no li::before { content: '✕'; color: #C0392B; }
/* El fundador */
.mkv-fundador { display: grid; grid-template-columns: .9fr 1.1fr; gap: 48px; align-items: center; }
.mkv-fundador-foto img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 24px; display: block; }
.mkv-fundador-foto .mkv-mini { margin-top: 8px; }
.mkv-numeros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--borde); }
.mkv-numero-grande { font-size: 30px; font-weight: 750; letter-spacing: -.03em; }
/* Las preguntas */
.mkv-faq { display: grid; grid-template-columns: .8fr 1.2fr; gap: 48px; }
.mkv-faq-item { border-bottom: 1px solid var(--borde); padding: 18px 0; }
.mkv-faq-item summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; gap: 16px; font-weight: 600; font-size: 16px; }
.mkv-faq-item summary::-webkit-details-marker { display: none; }
.mkv-faq-item summary::after { content: '+'; color: var(--gris); font-weight: 400; font-size: 20px; line-height: 1; }
.mkv-faq-item[open] summary::after { content: '−'; }
.mkv-faq-item .mkv-texto { margin-top: 10px; max-width: 620px; }
/* El cierre y el pie */
.mkv-cierre { padding: 110px 0; background: radial-gradient(110% 80% at 50% 100%, #EAF0FD 0%, var(--fondo) 60%); }
.mkv-pie { background: #fff; border-top: 1px solid var(--borde); padding: 48px 0 32px; }
.mkv-pie-in { display: grid; grid-template-columns: 1.4fr repeat(4, 1fr); gap: 24px; }
.mkv-pie-marca { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; }
.mkv-pie-marca .mkv-mini { width: 100%; margin-top: 8px; }
.mkv-pie-titulo { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
.mkv-pie a { display: block; font-size: 14px; color: var(--gris); text-decoration: none; margin-bottom: 8px; }
.mkv-pie a:hover { color: var(--tinta); }
/* El teléfono */
@media (max-width: 860px) {
  .mkv-nav-links { display: none; }
  .mkv-portada { padding: 56px 0 56px; }
  .mkv-recorrido { grid-template-columns: 1fr; gap: 10px; }
  .mkv-flecha { transform: rotate(90deg); text-align: center; }
  .mkv-sec { padding: 64px 0; }
  .mkv-grilla-3, .mkv-grilla-2, .mkv-caso, .mkv-fundador, .mkv-faq { grid-template-columns: 1fr; }
  .mkv-pasos { grid-template-columns: 1fr; }
  .mkv-fundador { gap: 28px; }
  .mkv-faq { gap: 12px; }
  .mkv-tabla td, .mkv-tabla th { padding: 14px 16px; }
  .mkv-pie-in { grid-template-columns: 1fr 1fr; }
  .mkv-pie-marca { grid-column: 1 / -1; }
}
@media (max-width: 420px) {
  .mkv-in { padding: 0 16px; }
  .mkv-nav-entrar { display: none; }
  .mkv-btn { width: 100%; }
  .mkv-numeros { grid-template-columns: 1fr; }
}
`;

/**
 * El documento de Web Generator de una portada: una tarjeta por sección, cada una un «Diseño editable». El saneo se importa
 * aquí adentro: lleva `server-only`, y así las secciones se pueden leer desde un test (tests/landings-mako-v2.test.ts).
 */
export async function documentoMakoV2(cual: Portada): Promise<DocumentoLanding> {
  const p = PORTADAS[cual];
  return documentoDeSecciones(p.titulo, p.seo, 'Tu equipo de ventas con IA, en español: anuncios, WhatsApp, agenda, páginas y CRM en un solo lugar, con tu propia IA.', seccionesDe(cual));
}

export type DocumentoLanding = { titulo: string; contenido: LandingContenido; config: ConfigLanding };

/** Un documento de Web Generator con estas secciones, cada una un «Diseño editable», con la hoja de MaKo. */
export async function documentoDeSecciones(titulo: string, seoTitulo: string, seoDescripcion: string, secciones: ReadonlyArray<[string, string]>): Promise<DocumentoLanding> {
  const { sanearHtmlEditable } = await import('../lib/editor-landing/html-editable-seguro');
  const tarjetas: JsonNodo[] = secciones.map(([id, crudo], i) => {
    const html = sanearHtmlEditable(crudo);
    if (!html) throw new Error(`la sección ${id} quedó vacía al sanear (¿pasa el tope?)`);
    return {
      type: NODO.tarjeta,
      attrs: { ...ATTRS_TARJETA_DEFAULT, id: `t${String(i + 1).padStart(2, '0')}${id.replace(/[^a-z0-9]/gi, '').slice(0, 20)}` },
      content: [{ type: NODO.htmlEditable, attrs: { id: `e${i + 1}`, html } }],
    };
  });
  return {
    titulo,
    contenido: { v: 1, paginas: [{ id: 'pinicio', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: tarjetas } }] },
    config: {
      ...CONFIG_DEFAULT,
      sitio: { ...CONFIG_DEFAULT.sitio, nombre: 'MaKo', seoTitulo, seoDescripcion, indexar: true, metaPixelId: PIXEL_META_MAKO, marcaMako: false },
      pagina: { ...CONFIG_DEFAULT.pagina, animaciones: false },
      diseno: { css: CSS_MAKO_V2 },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const esPrincipal = import.meta.url === new URL(`file:///${process.argv[1]?.replace(/\\/g, '/').replace(/^\/+/, '')}`).href;

/** La consola: arma, guarda y sube. En una función (no con await de primer nivel): un test importa este módulo. */
async function main(): Promise<void> {
  const docs = await Promise.all((Object.keys(PORTADAS) as Portada[]).map(async (cual) => ({ cual, doc: await documentoMakoV2(cual) })));
  const salida = arg('--salida');
  if (salida) {
    mkdirSync(salida, { recursive: true });
    for (const { cual, doc } of docs) {
      writeFileSync(join(salida, `${cual}.json`), JSON.stringify(doc));
      // El HTML suelto, para mirarlo en un navegador sin publicar (la hoja + las secciones).
      const html = doc.contenido.paginas[0].doc.content.map((t) => (t.content?.[0]?.attrs as { html?: string } | undefined)?.html ?? '').join('\n');
      writeFileSync(join(salida, `${cual}.html`), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(doc.titulo)}</title><style>body{margin:0}${CSS_MAKO_V2}</style></head><body>${html}</body></html>`);
      console.log(`${cual}: ${doc.contenido.paginas[0].doc.content.length} secciones, ${JSON.stringify(doc).length} bytes → ${salida}`);
    }
  }
  if (args.includes('--subir')) {
    const { subir } = await import('./landing-mako-a-web-generator.mjs');
    for (const { cual, doc } of docs) {
      await subir(doc as never, arg(`--doc-${cual}`), PORTADAS[cual].slug, cual === 'equipo' && args.includes('--principal'));
    }
  }
}

if (esPrincipal) main().catch((e) => { console.error(e); process.exit(1); });
