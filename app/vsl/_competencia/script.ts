// =============================================================================
// /vsl/script — Ads Analyst (qué anuncio te funciona a ti y cuál a tu competencia), con la ESTRUCTURA de Gethookd
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y, desde el 11/11/2026, también el DISEÑO):
//   https://www.gethookd.ai/  (leída el 11/11/2026 y otra vez el 14/11/2026 con Chromium, de arriba a abajo)
// El diseño copiado vive en ./disenos/script.tsx; los valores medidos de la referencia (Inter con eje óptico, la escala,
// los colores, las cajas, lo que se mueve y cuándo), en docs/diseno/landings-competencia/script.md.
// Su orden, que se respeta acá: hero «Your AI cannot see Meta's ad library. Now it can. / Give Your AI 22 Million Live
// Meta Ads» con sus tres chips → «Trusted by teams at» (logos) → «Ask your AI» (la demo que escribe una pregunta y trae
// tarjetas, cuatro escenas) → «Two ways to run it: Do it yourself, or hand it to your AI» (las dos cabezas) → la columna
// «In the app» (Explore, Brand Spy, Shops, Boards, Clone Ads: cinco videos de su app) → la columna «With your AI agent»
// (1 Connect, 2 Ask, 3 Your ads are ready) → «Find the store before you find the product» → (precios) → «Frequently asked
// questions» → «Your competitors already found the winning ad» (el cierre) → pie.
// Por qué ganó: docs/competencia/landings-por-funcion.md → «Ads Analyst».
//
// 14/11/2026, noche (la copia fiel): Ads Analyst es el analista de anuncios de MaKo, el que lee los anuncios PROPIOS (las hojas
// «Anuncio ganador» y «Hooks y retención» del Dashboard, con su gancho, su ángulo, su formato y su retención) y, con Competitor
// Spy, los de la COMPETENCIA (el mismo vocabulario de ganchos: lib/ads-analyst.ts, cabecera), y propone qué grabar. Los ejemplos
// son los anuncios y los videos REALES de Alex Hormozi que ya lee Spy (C:/dev/bancos-portada/banco-spy-gurus/hormozi-funnel.json,
// leído el 14/11; las cuentas con lib/spy-detalle.ts), nunca datos de un cliente.
//
// Lo que se cambió de la referencia, y por qué:
//   · «Your AI» es, en MaKo, MaKo: se le pregunta desde el chat de la app o por WhatsApp. Lo de Competitor Spy NO sale por la
//     API (canales app y whatsapp, lib/api-mako/areas/spy.def.ts): por eso «tu Claude» no se nombra donde se habla de la
//     competencia. La conexión de Gethookd con Claude, ChatGPT o Cursor por MCP no va: MaKo no tiene MCP.
//   · Su biblioteca pública de 22 millones de anuncios y la descarga de anuncios ajenos no existen en MaKo: no se dibujan.
//     Spy lee los anuncios de los referentes que TÚ sigues.
//   · Sus logos de clientes («Trusted by teams at») son suyos: en ese lugar va la prueba de MaKo, el caso de Mauricio.
//   · Sus chips («22M+ active ads»…) son de su biblioteca: los de acá dicen lo que MaKo hace.
//   · Sus cinco videos de la app (Explore, Brand Spy, Shops, Boards, Clone Ads) → cinco pantallas de MaKo grabadas: la hoja
//     «Anuncio ganador», la hoja «Hooks y retención», los anuncios de Hormozi en Spy, su gancho, su ángulo y su formato, y su
//     reel replicado con una oferta (Copywriting, «Replicar»). Los rótulos y los videos van en el diseño (FILAS_DE_LA_APP).
//   · «Find the store before you find the product» (tiendas de e-commerce) y los precios no tienen equivalente: no van.
//   · Las preguntas son las de la portada (LandingCompetencia las pone). Su cierre es la banda de todas las landings.
// De dónde sale lo que se afirma: lib/ads-analyst.ts (transcribir, partir en bloques, cruzar con Meta y con los cierres del
// CRM), lib/ads-analyst-patrones.ts (los veredictos y la muestra: alta desde 25.000 impresiones, media desde 8.000),
// lib/graficos-plantillas-analysts.ts (las hojas «Anuncio ganador» y «Hooks y retención»), vercel.json (los crons diarios
// transcribe-ads y ads-analyst-sync), lib/api-mako/areas/spy.def.ts y copywriter.def.ts (replicar_outlier_copywriter: «replica
// su reel» se le pide a MaKo en el chat).
//
// LOS TEXTOS DE GETHOOKD, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · «Your AI cannot see Meta's ad library. Now it can.» → «Tu IA no puede ver tus anuncios de Meta. Ahora puede.»;
//     «Give Your AI 22 Million Live Meta Ads» → «Dale a tu IA tus anuncios de Meta, leídos palabra por palabra»;
//   · «[ AI agent access ]» / «Ask your AI», «Two ways to run it» / «Do it yourself, or hand it to your AI.» / «Same live
//     ad data either way.», «Click through it yourself.» (→ «Revísalo tú mismo»), «A full interface, built for people who
//     like to look at the ads themselves», «Ask, and skip the clicking.» / «Same data, reached from the chat you already have
//     open», «Type it the way you would say it out loud» / «…does the searching, the filtering and the reading, and hands
//     the answer back inside the same chat», «Both routes end in the same place».
// =============================================================================

import { IMPR_ALTA, IMPR_MEDIA, VEREDICTO_ROTULO } from '@/lib/ads-analyst-patrones';
import type { LandingCompetencia } from './tipos';

const I = {
  guion: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0'],
  hojas: ['M4 4h6v8h-6z', 'M4 16h6v4h-6z', 'M14 12h6v8h-6z', 'M14 4h6v4h-6z'],
  chat: ['M8 9h8', 'M8 13h6', 'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z'],
};

/** Los veredictos que se nombran, con el rótulo que dibuja la hoja (lib/ads-analyst-patrones.ts). */
const VEREDICTOS = [VEREDICTO_ROTULO.escalar, VEREDICTO_ROTULO.mejorar, VEREDICTO_ROTULO.reescribir, VEREDICTO_ROTULO.repensar]
  .map((v) => v.toLowerCase()).join(', ').replace(/, ([^,]+)$/, ' o $1');
const miles = (n: number) => n.toLocaleString('es-MX').replace(/,/g, '.');
/** Los dos caminos (la columna de la app y la de MaKo): la tarjeta de «Dos formas» y su columna llevan el mismo nombre. */
const EN_LA_APP = 'Revísalo tú mismo, anuncio por anuncio';
const CON_MAKO = 'Pregúntale y sáltate los clics';

export const LANDING_SCRIPT: LandingCompetencia = {
  slug: 'script',
  nombre: 'Ads Analyst',
  icono: I.guion,
  referencia: { nombre: 'Gethookd — la biblioteca de anuncios de Meta para tu IA', url: 'https://www.gethookd.ai/', leida: '2026-11-14' },
  metaTitle: 'Ads Analyst de MaKo: qué anuncio te funciona a ti y cuál a tu competencia',
  metaDesc: 'MaKo transcribe tus anuncios de Meta y los cruza con su retención y los cierres de tu CRM, lee los de tu competencia con su gancho, su ángulo y su formato, y te propone qué grabar.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Tu IA no puede ver tus anuncios de Meta. Ahora puede.',
      titulo: 'Dale a tu IA tus anuncios de Meta, leídos <strong>palabra por palabra</strong>',
      bajada: 'Conecta tu Meta a MaKo y pregúntale qué anuncios te funcionan a ti y cuáles a tu competencia: te devuelve sus ganchos, sus ángulos y <strong>los cierres de tu CRM</strong>.',
      // Como sus tres chips: lo que importa, en negrita.
      puntos: ['Se actualiza solo, cada <b>día</b>', 'Con los <b>cierres</b> de tu CRM', 'Lo que publica tu <b>competencia</b>, con su gancho'],
      visual: { tipo: 'detalle', slug: 'script' },
    },
    { tipo: 'caso' },
    {
      tipo: 'tarjetas',
      etiqueta: 'Acceso para tu IA',
      titulo: 'Pregúntale a tu IA',
      bajada: 'Desde el chat de MaKo o tu WhatsApp: le preguntas por tus anuncios y por los de tu competencia, y te contesta con sus números.',
      // Las cuatro escenas de la demo (como las cuatro de Gethookd): la pregunta que se escribe y lo que vuelve. Lo que dibuja
      // cada tarjeta (los anuncios de Hormozi, sus destinos, sus formatos y el guion replicado) va en el diseño (ESCENAS).
      items: [
        { titulo: '¿Qué anuncios tiene activos Alex Hormozi?', texto: 'Sus anuncios de Meta, con los días que llevan corriendo.' },
        { titulo: '¿A dónde manda sus anuncios?', texto: 'Las páginas a las que llevan, con cuántos de sus anuncios.' },
        { titulo: '¿Qué le funciona en sus videos cortos?', texto: 'El formato, el gancho y lo que no le rinde, contra la mediana de su cuenta.' },
        { titulo: 'Replica su reel con mi oferta', texto: 'Tu guion con la estructura del suyo: gancho, historia y llamado.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      etiqueta: 'Dos formas de usarlo',
      titulo: 'Hazlo tú, o pásaselo a tu IA.',
      bajada: 'Los mismos datos de tus anuncios, en las dos.',
      columnas: 2,
      // Las dos tarjetas son las cabezas de las dos columnas que siguen (como en Gethookd): se llaman como ellas, y su lista
      // dice lo que trae cada columna.
      items: [
        {
          icono: I.hojas, titulo: EN_LA_APP, meta: 'En la app',
          texto: 'Una interfaz completa, hecha para quien quiere ver sus anuncios uno por uno.',
          puntos: [
            'Cuál de tus anuncios gana, con su veredicto y su muestra',
            'En qué segundo se va la gente de cada video',
            'Los anuncios de tu competencia, con los días que llevan',
            'El gancho, el ángulo y el formato que le funcionan',
            'Su reel, replicado con tu oferta',
          ],
        },
        {
          icono: I.chat, titulo: CON_MAKO, meta: 'Con tu IA',
          texto: 'Los mismos datos, desde el chat que ya tienes abierto.',
          puntos: [
            'Le escribes desde el chat de MaKo o desde tu WhatsApp',
            'Le preguntas como lo dirías en voz alta, sin armar un filtro',
            'Te contesta con tus anuncios y con los de tu competencia',
            'Te avisa cuando la muestra es chica para decidir',
            'Le pides que replique un reel y lo escribe con tu oferta',
          ],
        },
      ],
    },
    {
      tipo: 'filas',
      etiqueta: 'En la app',
      titulo: EN_LA_APP,
      slug: 'script',
      // Una tarjeta por pantalla de la app, como las cinco de Gethookd (su video y su rótulo, en el diseño: FILAS_DE_LA_APP).
      items: [
        { titulo: 'Cuál de tus anuncios gana, y con cuánta muestra.', texto: `Cada guion con su veredicto (${VEREDICTOS}). La muestra es alta desde ${miles(IMPR_ALTA)} impresiones y media desde ${miles(IMPR_MEDIA)}.` },
        { titulo: 'En qué segundo se va la gente.', texto: 'Cuánto ven tus anuncios, qué tipo de gancho retiene más y en qué parte de cada video se van.' },
        { titulo: 'Los anuncios de tu competencia, y cuánto llevan.', texto: 'Cuántos tiene activos, a dónde mandan y qué está probando. En la grabación, los de Alex Hormozi.' },
        { titulo: 'Qué gancho, ángulo y formato le funcionan.', texto: 'Cada pieza con su gancho, su ángulo y su formato, y qué formatos le rinden más que la mediana de su cuenta.' },
        { titulo: 'Su reel, con tu oferta.', texto: 'Tocas «Replicar» y MaKo escribe tu guion con la estructura del suyo: gancho, historia y llamado.' },
      ],
    },
    {
      tipo: 'pasos',
      fondo: true,
      etiqueta: 'Con MaKo',
      titulo: CON_MAKO,
      bajada: 'Los dos caminos terminan en lo mismo: tu próximo guion, con la estructura de lo que ya funciona, listo para grabar.',
      pasos: [
        { titulo: 'Conectas tu Meta', texto: 'Una sola vez. Cada día MaKo transcribe tus anuncios nuevos y los analiza.' },
        { titulo: 'Escríbelo como lo dirías en voz alta', texto: '«¿Qué guion escalo?» o «¿qué le funciona a Hormozi?». MaKo busca, filtra y lee, y te contesta en el mismo chat.' },
        { titulo: 'Tu próximo guion, escrito', texto: 'Le pides que replique el reel que le funcionó y te devuelve tu guion con tu oferta: gancho, historia y llamado.' },
      ],
    },
    {
      tipo: 'preguntas',
      titulo: 'Preguntas frecuentes',
      // LandingCompetencia y el registro ponen las de la portada (app/vsl/_sitio/preguntas.ts): ésta no se dibuja.
      items: [
        { p: '¿Qué anuncios analiza?', r: 'Los tuyos, de tu cuenta de Meta; los de tu competencia, con Competitor Spy.' },
      ],
    },
  ],
};
