// =============================================================================
// /vsl/script — Ads Analyst (el guion de tus anuncios con su retención y tus ventas), con la ESTRUCTURA de Gethookd
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y, desde el 11/11/2026, también el DISEÑO):
//   https://www.gethookd.ai/  (leída el 11/11/2026 con Chromium, de arriba a abajo)
// El diseño copiado vive en ./disenos/script.tsx; los valores medidos de la referencia (Inter con eje óptico, la escala,
// los colores, las cajas), en docs/diseno/landings-competencia/script.md.
// Su orden, que se respeta acá: hero «Your AI cannot see Meta's ad library. Now it can. / Give Your AI 22 Million Live
// Meta Ads» con sus tres chips → «Trusted by teams at» (logos) → «Ask your AI» → «Two ways to run it: Do it yourself, or
// hand it to your AI» (las dos tarjetas) → la columna «In the app» (Explore, Brand Spy, Shops, Boards, Clone Ads) → la
// columna «With your AI agent» (1 Connect, 2 Ask, 3 Your ads are ready) → «Find the store before you find the product» →
// (precios) → «Frequently asked questions» → «Your competitors already found the winning ad» (el cierre) → pie.
// Por qué ganó: docs/competencia/landings-por-funcion.md → «Ads Analyst».
//
// Lo que se cambió de la referencia, y por qué:
//   · Gethookd mira los anuncios del MERCADO; Ads Analyst mira los TUYOS. Donde dice «la biblioteca», acá van tus anuncios,
//     y no se promete ninguna biblioteca de la competencia (eso es Competitor Spy, y lo dice una pregunta).
//   · «Your AI» es, en MaKo, MaKo: se le pregunta desde el chat de la app o por WhatsApp (las lecturas de Ads Analyst de
//     lib/api-mako/areas/ads.def.ts). Su conexión con Claude, ChatGPT o Cursor por MCP no va: MaKo no tiene MCP.
//   · Sus logos de clientes («Trusted by teams at») son suyos: en ese lugar va la prueba de MaKo, el caso de Mauricio.
//   · Sus chips («22M+ active ads»…) son de su biblioteca: los puntos del hero dicen lo que MaKo hace (se actualiza cada día,
//     con los cierres del CRM).
//   · De la columna «In the app»: Explore → cuál de tus anuncios gana (la hoja «Anuncio ganador» y «Hooks y retención»);
//     Boards → tus ángulos y avatares; Brand Spy y Shops miran competidores y tiendas, y no van. Clone Ads («convierte un
//     ganador en tu próximo anuncio») es, en MaKo, valorar tu próximo guion contra lo que ya te rinde: va en el paso 3 de la
//     otra columna, que es donde la referencia dice que terminan los dos caminos.
//   · «Find the store before you find the product» (tiendas de e-commerce) y los precios no tienen equivalente: no van.
//   · De sus 14 preguntas van las que tienen respuesta en MaKo; las de planes, créditos y cancelación, no (ninguna landing de
//     /vsl escribe un precio a mano). Su cierre es la banda de la llamada, la misma de todas las landings.
// De dónde sale lo que se afirma: lib/ads-analyst.ts (transcribir, partir en bloques, cruzar con Meta y con los cierres del
// CRM, valorar un guion nuevo), lib/ads-analyst-patrones.ts (los veredictos y la muestra: alta desde 25.000 impresiones, media
// desde 8.000), lib/graficos-plantillas-analysts.ts (las hojas «Anuncio ganador» y «Hooks y retención»), vercel.json (los
// crons diarios transcribe-ads y ads-analyst-sync) y las lecturas de Ads Analyst de lib/api-mako/areas/ads.def.ts. Los
// gráficos, de la landing anterior de esta ruta (app/vsl/_detalle/feature-visuals.ts): el 2 y el 3 traen voseo, y el 1 pone
// plata y ROAS por guion, que Ads Analyst no calcula (cuenta agendas y cierres): no van.
// =============================================================================

import { IMPR_ALTA, IMPR_MEDIA, VEREDICTO_ROTULO } from '@/lib/ads-analyst-patrones';
import type { LandingCompetencia } from './tipos';

const I = {
  guion: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0'],
  trofeo: ['M8 21l8 0', 'M12 17l0 4', 'M7 4l10 0', 'M17 4v8a5 5 0 0 1 -10 0v-8', 'M5 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M19 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0'],
  caida: ['M4 19l16 0', 'M4 6l5 5l4 -3l7 7'],
  nuevo: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  hojas: ['M4 4h6v8h-6z', 'M4 16h6v4h-6z', 'M14 12h6v8h-6z', 'M14 4h6v4h-6z'],
  chat: ['M8 9h8', 'M8 13h6', 'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z'],
};

/** Los veredictos que se nombran, con el rótulo que dibuja la hoja (lib/ads-analyst-patrones.ts). */
const VEREDICTOS = [VEREDICTO_ROTULO.escalar, VEREDICTO_ROTULO.mejorar, VEREDICTO_ROTULO.reescribir, VEREDICTO_ROTULO.repensar]
  .map((v) => v.toLowerCase()).join(', ').replace(/, ([^,]+)$/, ' o $1');
const miles = (n: number) => n.toLocaleString('es-MX').replace(/,/g, '.');
/** Los dos caminos (la columna de la app y la de MaKo): la tarjeta de «Dos formas» y su columna llevan el mismo nombre. */
const EN_LA_APP = 'Míralo tú, anuncio por anuncio';
const CON_MAKO = 'Pregúntale y sáltate los clics';

export const LANDING_SCRIPT: LandingCompetencia = {
  slug: 'script',
  nombre: 'Ads Analyst',
  icono: I.guion,
  referencia: { nombre: 'Gethookd — la biblioteca de anuncios de Meta para tu IA', url: 'https://www.gethookd.ai/', leida: '2026-11-11' },
  metaTitle: 'Ads Analyst de MaKo: qué guion de tus anuncios gana, y por qué',
  metaDesc: 'MaKo transcribe tus anuncios de Meta, los parte en bloques y los cruza con su retención, tus agendas y los cierres de tu CRM. Le preguntas cuál escalar o le pegas un guion nuevo para valorarlo.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Meta no lee el guion de tus anuncios. MaKo sí.',
      titulo: 'Tus anuncios, leídos <strong>palabra por palabra</strong>.',
      bajada: 'Conectas tu Meta y MaKo lee cada anuncio solo y lo cruza con tus ventas. Le preguntas cuál escalar y te contesta con el gancho, el ángulo y <strong>los cierres de tu CRM</strong>.',
      puntos: ['Se actualiza solo, cada día', 'Con las agendas de Meta y los cierres de tu CRM'],
      visual: { tipo: 'detalle', slug: 'script' },
    },
    { tipo: 'caso' },
    {
      tipo: 'tarjetas',
      etiqueta: 'Con MaKo',
      titulo: 'Pregúntale a MaKo',
      bajada: 'Desde el chat de la app o tu WhatsApp. Le preguntas por tus anuncios y te contesta con tus números.',
      items: [
        { icono: I.trofeo, titulo: '«¿Qué guion rinde mejor?»', texto: 'Te los ordena por agendas y gasto, con sus cierres del CRM y el gancho que conviene probar.' },
        { icono: I.caida, titulo: '«¿Dónde se me cae la gente?»', texto: 'Te muestra el guion del anuncio por bloques, con la retención que llegó a cada uno.' },
        { icono: I.nuevo, titulo: '«¿Lo publico?»', texto: 'Le pegas un guion que todavía no corrió y lo compara con <strong>lo que ya te rinde</strong>.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      etiqueta: 'Dos formas de usarlo',
      titulo: 'Hazlo tú, o pásaselo a MaKo.',
      bajada: 'Los mismos datos en las dos.',
      columnas: 2,
      // Las dos tarjetas son las cabezas de las dos columnas que siguen (como en Gethookd): se llaman como ellas.
      items: [
        { icono: I.hojas, titulo: EN_LA_APP, texto: 'Las hojas «Anuncio ganador» y «Hooks y retención» del Dashboard, para quien quiere ver sus anuncios uno por uno.', meta: 'En la app' },
        { icono: I.chat, titulo: CON_MAKO, texto: 'Los mismos números desde el chat, sin armar un filtro: le escribes como lo dirías en voz alta.', meta: 'Por chat o WhatsApp' },
      ],
    },
    {
      tipo: 'filas',
      etiqueta: 'En la app',
      titulo: EN_LA_APP,
      slug: 'script',
      items: [
        {
          grafico: 0,
          titulo: 'Cuál de tus anuncios gana, y dónde se va la gente',
          texto: 'Cada guion con su veredicto y con cuánta muestra lo dice, y su <strong>retención bloque por bloque</strong>.',
          puntos: [
            `Qué hacer con cada uno: ${VEREDICTOS}`,
            `La muestra: alta desde ${miles(IMPR_ALTA)} impresiones, media desde ${miles(IMPR_MEDIA)}`,
            'El guion partido en bloques (gancho, problema, prueba, llamado) con la retención encima',
          ],
        },
        {
          grafico: 4,
          titulo: 'Tus ángulos y tus avatares',
          texto: 'Corriges el ángulo o el avatar de un anuncio y MaKo <strong>lo respeta</strong> cuando lo vuelve a analizar.',
          puntos: ['Los ángulos y los avatares son los de tu negocio, y los editas tú'],
        },
      ],
    },
    {
      tipo: 'pasos',
      fondo: true,
      etiqueta: 'Con MaKo',
      titulo: CON_MAKO,
      bajada: 'Los dos caminos terminan en lo mismo: tu próximo guion, valorado antes de grabarlo.',
      pasos: [
        { titulo: 'Conectas tu Meta', texto: 'Una sola vez. Cada día MaKo transcribe tus anuncios nuevos y los analiza.' },
        { titulo: 'Le preguntas como lo dirías', texto: '«¿Qué guion escalo?» o «¿qué ganchos me funcionan?», en el chat de la app o por WhatsApp.' },
        { titulo: 'Tu próximo guion, valorado', texto: 'Le pegas un guion nuevo y te dice si se parece a lo que ya te rinde, con cuánto probarlo y contra cuál medirlo.' },
      ],
    },
    {
      tipo: 'preguntas',
      titulo: 'Preguntas frecuentes',
      items: [
        { p: '¿Tengo que saber de tecnología?', r: 'No. Conectas tu Meta una vez y MaKo transcribe y analiza tus anuncios solo. Para preguntarle, le escribes como a una persona.' },
        { p: '¿Qué anuncios analiza?', r: 'Los tuyos: los de tu cuenta de Meta. De un video lee el guion; de una imagen, su texto.' },
        { p: '¿Y los anuncios de mi competencia?', r: 'Esos no: Ads Analyst lee los tuyos. Los de tu competencia los guarda <strong>Competitor Spy</strong>.' },
        { p: '¿Qué le puedo preguntar?', r: 'Qué guion rinde mejor, cuál escalar o pausar, dónde se te cae la gente, qué ángulos y ganchos te funcionan, y si publicas un guion nuevo.' },
        { p: '¿De dónde salen los números?', r: 'El gasto, el hook rate, la retención y las agendas, de Meta; los cierres, de tu CRM. La retención por bloque es una <strong>estimación</strong> sobre los cuartiles de Meta, y MaKo lo dice.' },
        { p: '¿Cada cuánto se actualiza?', r: 'Cada día MaKo transcribe y analiza tus anuncios nuevos. Los números se vuelven a calcular cada vez que abres la hoja.' },
        { p: '¿Es sólo para Meta?', r: 'Sí: lee tus anuncios de Facebook e Instagram.' },
        { p: '¿Por qué no alcanza con lo que me muestra Meta?', r: 'Meta te da el hook rate y los cuartiles, pero no lee tu guion ni lo cruza con tus ventas. MaKo junta las dos cosas en cada anuncio.' },
        { p: '¿En qué se distingue de una biblioteca de anuncios?', r: 'Una biblioteca te muestra anuncios de otros. Ads Analyst lee los tuyos y te dice cuál te trae agendas y cierres.' },
        { p: '¿Lo puedo usar sin preguntarle a MaKo?', r: 'Sí: las hojas «Anuncio ganador» y «Hooks y retención» del Dashboard te muestran lo mismo.' },
        { p: 'Estoy empezando con anuncios, ¿me sirve?', r: 'Con pocos anuncios, MaKo te marca los de <strong>muestra chica</strong> en vez de darte un ganador que no lo es. Para valorar un guion nuevo necesita anuncios tuyos ya analizados.' },
      ],
    },
  ],
};
