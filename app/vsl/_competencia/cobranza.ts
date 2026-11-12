// =============================================================================
// /vsl/cobranza — la Cobranza de MaKo, con la ESTRUCTURA de la portada de Rebill (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el DISEÑO):
//   https://www.rebill.com/es  (leída el 11/11/2026 con Chromium)
// El diseño copiado (barra, hero, secciones, tipografía, espacios, pie) es ./disenos/cobranza.tsx; los valores medidos
// con getComputedStyle a 1440 y 390 px, en docs/diseno/landings-competencia/cobranza.md.
// Su orden, que se respeta acá: hero «Infraestructura financiera para las Américas» → «… para tu negocio en las Américas»,
// tres tarjetas con cifras → «Conexiones locales. Pagos locales y cross-border.», sus cinco piezas (links de pago, cuotas,
// suscripciones, notificaciones, dashboard) → «Integración simple. Resultado profesional.» → «Automatiza flujos complejos
// sin escribir código» → «Historias de clientes» → «Preguntas Frecuentes» → el cierre. Por qué ganó:
// docs/competencia/landings-por-funcion.md → «Cobranza».
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus cifras («hasta 20 puntos porcentuales» de aprobación, «cerca del 52 %» de rechazos recuperados) son suyas. Van
//     números contados del código: las pasarelas (lib/cobros-tipos.ts), los días de «vence pronto» (lib/datos-comercial.ts)
//     y los avisos de la plantilla de cuota vencida (lib/plantillas-automatizaciones.ts).
//   · Sus cinco piezas, en su orden, quedan en tres filas: en MaKo el mismo link es de pago único o de suscripción, y las
//     notificaciones son plantillas de Automations (van donde Rebill pone su automatización).
//   · Sus adquirentes locales y sus entidades reguladas no son de MaKo: MaKo cobra con TU cuenta de cada pasarela
//     (lib/cobros.ts, `credDelCliente`). «Integración simple» son esas pasarelas, con el texto de su tarjeta
//     (lib/integraciones-catalogo.ts).
//   · Su automatización con Make → las plantillas de cobranza de la galería, con su nombre y su línea tal cual.
//   · Sus historias de clientes → el caso de Mauricio. Sus tarifas no van.
//   · Una cuota vencida NO le escribe al cliente: el aviso y sus recordatorios van al grupo del negocio («C: nada al
//     cliente», 06/10/2026, lib/avisos-catalogo.ts). Al cliente le escriben sólo el recibo y el pago rechazado.
//   · Gráficos (app/vsl/_detalle/feature-visuals.ts, slug cobranza): 0 (el mes), 2 (el plan de cuotas) y 1 (a quién
//     cobrarle). El 4 nombra la «Vista General», que ya no existe; el 3 (el comprobante) no tiene pieza en Rebill.
//
// De dónde sale lo que se afirma: lib/pagos.ts (el plan de cuotas, marcar una cuota), lib/pagos-vistazo.ts («Debe $500»,
// «Al día»), app/crm/[id]/cobros-actions.ts y lib/cobros.ts (el link, único o suscripción, el que salda una cuota, el paso a
// la etapa de venta), app/crm/lead-view/ficha/pagos/recibo-leido.ts (el comprobante), lib/graficos-plantillas-generales.ts
// (la hoja Cobranza y «A quién perseguir»), lib/cuentas-integracion.ts (varias cuentas por pasarela).
//
// LOS TEXTOS DE REBILL, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · «Infraestructura financiera para las Américas» → «Cobranza en cuotas para las Américas» (MaKo no es una
//     infraestructura financiera: cobra con TU cuenta de cada pasarela), y su H2 «… para tu negocio en las Américas»;
//   · «Acepta pagos locales, ofrece cuotas y gestiona suscripciones…» → con las pasarelas de lib/cobros-tipos.ts (sin
//     «liquidaciones en USD o moneda local», que no son de MaKo);
//   · sus piezas «Links de pago sin escribir una línea de código» / «Genera enlaces… con monto, moneda… listos para
//     enviar», «Pagos en cuotas» (sin «con o sin interés»: MaKo no calcula interés) y «Dashboard» / «Obtén una visión clara
//     de tu rendimiento…» (la hoja Cobranza); sus suscripciones van en el mismo link y sus notificaciones son las
//     plantillas de Automations;
//   · «Integración simple. Resultado profesional.» / «Elige la forma que mejor se adapte a tu modelo de negocio.»,
//     «Automatiza flujos complejos sin escribir código» (→ «flujos de cobranza»), «Preguntas Frecuentes» con «¿Qué métodos
//     de pago locales ofrecen en cada país?» (→ «¿Qué métodos de pago puedo ofrecer en cada país?»).
// =============================================================================

import { CAPACIDADES_PASARELA, NOMBRE_PASARELA, PASARELAS } from '@/lib/cobros-tipos';
import { DIAS_PRONTO } from '@/lib/datos-comercial';
import { DEFS } from '@/lib/integraciones-catalogo';
import { plantillaPorId } from '@/lib/plantillas-automatizaciones';
import type { LandingCompetencia } from './tipos';

const I = {
  cobranza: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1', 'M12 6v2', 'M12 16v2'],
  tarjeta: ['M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z', 'M3 10l18 0', 'M7 15l.01 0', 'M11 15l2 0'],
  campana: ['M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6', 'M9 17v1a3 3 0 0 0 6 0v-1'],
};

/** «Stripe, Mercado Pago y Creem»: los nombres de las pasarelas, del código. */
const LISTA_PASARELAS = (() => {
  const n = PASARELAS.map((p) => NOMBRE_PASARELA[p]);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join('');
})();
const MO_PASARELAS = PASARELAS.map((p) => NOMBRE_PASARELA[p]).join(', ').replace(/, ([^,]*)$/, ' o $1');

/** La pasarela que sólo le cobra a quien está en el país de su cuenta, y las que cobran en todo el mundo (lib/cobros-tipos.ts). */
const EN_SU_PAIS = PASARELAS.filter((p) => CAPACIDADES_PASARELA[p].soloEnSuPais).map((p) => NOMBRE_PASARELA[p]);
const EN_EL_MUNDO = PASARELAS.filter((p) => !CAPACIDADES_PASARELA[p].soloEnSuPais).map((p) => NOMBRE_PASARELA[p]);
const yLista = (n: string[]) => (n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join(''));

/** Las plantillas de cobranza de la galería de Automations, con su nombre y su línea tal cual. */
const PLANTILLAS_COBRANZA = ['mako-cobranza', 'mako-pago', 'pago-rechazado', 'recibo-al-cobrar', 'comprobante-llego']
  .map((id) => plantillaPorId(id))
  .filter((p): p is NonNullable<typeof p> => p != null);

/** Los avisos que manda «Una Cuota Venció» por cada cuota: los mensajes de la plantilla (las esperas no cuentan). */
const AVISOS_POR_CUOTA = (plantillaPorId('mako-cobranza')?.pasos ?? []).filter((p) => p.nodo !== 'esperar').length;

export const LANDING_COBRANZA: LandingCompetencia = {
  slug: 'cobranza',
  nombre: 'Cobranza',
  icono: I.cobranza,
  referencia: { nombre: 'Rebill — pagos y cobros recurrentes en las Américas', url: 'https://www.rebill.com/es', leida: '2026-11-11' },
  metaTitle: 'Cobranza de MaKo: cobranza en cuotas para las Américas, con tu CRM',
  metaDesc: `Arma el plan de cuotas de cada cliente, cóbrale con un link de ${MO_PASARELAS} y mira lo que entró, lo que vence y a quién cobrarle hoy.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Cobranza para ventas en cuotas',
      titulo: '<em>Cobranza en cuotas</em> para las Américas',
      bajada: `Acepta pagos con un link de <strong>${MO_PASARELAS}</strong>, ofrece cuotas y gestiona suscripciones, con tu propia cuenta de cada pasarela. Cada pago entra solo a tu CRM, y en una hoja ves lo que entró, lo que vence y a quién cobrarle hoy.`,
      puntos: ['Pago único o suscripción, con tu propia cuenta', '¿Te pagaron por transferencia? MaKo lee el comprobante'],
      visual: { tipo: 'detalle', slug: 'cobranza' },
    },
    {
      tipo: 'cifras',
      titulo: 'Cobranza para tu negocio en las Américas',
      items: [
        { valor: String(PASARELAS.length), label: `pasarelas para cobrar: ${LISTA_PASARELAS}` },
        { valor: String(DIAS_PRONTO), label: 'días antes de que venza, la cuota se marca como próxima a vencer' },
        { valor: String(AVISOS_POR_CUOTA), label: 'avisos en tu grupo por cada cuota vencida, con la plantilla de cobranza' },
      ],
    },
    {
      tipo: 'filas',
      titulo: 'Cobra como vendes: con un link, en cuotas o cada mes',
      slug: 'cobranza',
      items: [
        {
          grafico: 0,
          titulo: 'Links de pago sin escribir una línea de código',
          texto: 'Generas el link con su monto, en la moneda de tu cuenta, de pago único o de suscripción, desde la ficha del cliente, listo para enviar. Cuando paga, el pago entra solo a su ficha y el cliente pasa a la etapa de venta de su embudo.',
        },
        {
          grafico: 2,
          titulo: 'Pagos en cuotas',
          texto: 'Armas el pago inicial y las cuotas con su fecha, o cada cuota a mano. Y en su ficha ves de un vistazo lo que pagó y lo que debe.',
          puntos: ['Cada cuota puede tener su propio link: al pagarse, se marca sola', '¿Te pagaron por fuera? Subes el comprobante, MaKo lee el monto, la fecha y la hora, y tú lo confirmas'],
        },
        {
          grafico: 1,
          titulo: 'Dashboard',
          texto: 'Obtén una visión clara de tu cobranza: la hoja Cobranza te muestra lo que entró, lo que vence y lo que falta, y <strong>a quién perseguir</strong>, el más urgente arriba, con «Marcar cobrada» en la fila.',
        },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Integración simple. <em>Resultado profesional.</em>',
      bajada: 'Elige la pasarela que mejor se adapte a tu modelo de negocio, o conecta varias. Cada una cobra en tu cuenta, no en la de MaKo.',
      items: PASARELAS.map((p) => ({
        icono: I.tarjeta,
        titulo: NOMBRE_PASARELA[p],
        texto: DEFS.find((d) => d.key === p)?.descripcion ?? '',
      })),
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Automatiza flujos de cobranza sin escribir código',
      bajada: 'Plantillas de la galería de Automations: las agregas y las cambias como quieras.',
      items: PLANTILLAS_COBRANZA.map((p) => ({ icono: I.campana, titulo: p.nombre, texto: p.linea })),
    },
    { tipo: 'caso' },
    {
      tipo: 'preguntas',
      titulo: 'Preguntas frecuentes',
      items: [
        { p: '¿Qué métodos de pago puedo ofrecer en cada país?', r: `Con ${LISTA_PASARELAS}: conectas tu cuenta y cobras con un link. ${yLista(EN_SU_PAIS)} le cobra a quien está en el país de su cuenta; ${yLista(EN_EL_MUNDO)} cobran en todo el mundo.` },
        { p: '¿Qué pasa cuando mi cliente paga el link?', r: 'El pago entra solo a su ficha: si el link era de una cuota, la cuota se marca cobrada, y el cliente pasa a la etapa de venta de su embudo. Con la plantilla «Entró un Pago», además te avisa en tu grupo.' },
        { p: '¿MaKo le escribe a mi cliente para cobrarle?', r: 'Por una cuota vencida, no: el aviso y sus recordatorios te llegan a ti, en tu grupo de WhatsApp, para que decidas cómo cobrar. Al cliente le escriben dos plantillas, si las agregas: su recibo en PDF cuando paga, y un mensaje para que lo reintente cuando la pasarela le rechaza el pago.' },
        { p: '¿Y si me paga por transferencia?', r: 'Marcas la cuota como cobrada en su ficha. Si subes el comprobante, MaKo lee el monto, la fecha y la hora y te llena el registro; tú lo confirmas.' },
      ],
    },
  ],
};
