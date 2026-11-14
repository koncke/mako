// =============================================================================
// /vsl/cobranza — la Cobranza de MaKo, con la ESTRUCTURA de la portada de Rebill (11/11/2026; copia fiel el 14/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el DISEÑO):
//   https://www.rebill.com/es  (leída el 11/11/2026 y otra vez el 14/11/2026 con Chromium: capturas, video, getAnimations,
//   sus scripts y su CSS; el relevo, en la carpeta de notas de la sesión, referencias-landings/cobranza/)
// El diseño copiado es ./disenos/cobranza.tsx; los valores medidos, en docs/diseno/landings-competencia/cobranza.md.
// Su orden, que se respeta acá: el hero con el checkout que rota cada 4 s → «Infraestructura financiera para tu negocio en las
// Américas» y sus tres tarjetas que se dan vuelta → «Conexiones locales.» y sus cinco piezas, que pasan con el scroll (links de pago,
// cuotas, suscripciones, notificaciones, dashboard) → «Integración simple. Resultado profesional.» y sus tres formas, que pasan con
// el scroll (la tercera: «Automatiza flujos complejos sin escribir código») → «Historias de clientes» → «Preguntas Frecuentes» → el
// cierre. Por qué ganó: docs/competencia/landings-por-funcion.md → «Cobranza».
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus cifras («hasta 20 puntos porcentuales» de aprobación, «cerca del 52 %» de rechazos recuperados) son suyas. Van números
//     contados del código: las pasarelas (lib/cobros-tipos.ts), los días de «vence pronto» (lib/datos-comercial.ts) y los avisos
//     de la plantilla de cuota vencida (lib/plantillas-automatizaciones.ts). La cara de atrás de cada tarjeta (`DETALLE_CIFRAS`)
//     dice de dónde sale cada número.
//   · Sus adquirentes locales y sus entidades reguladas no son de MaKo: MaKo cobra con TU cuenta de cada pasarela (lib/cobros.ts,
//     `credDelCliente`). Sin pasarela conectada, el pago se registra a mano en la ficha (la cuota, «Marcar pagada»): el link y lo
//     que entra solo son con tu cuenta conectada, y la landing lo dice.
//   · «Pagos en cuotas con o sin interés»: sin el interés (MaKo no lo calcula). «Suscripciones… cobros automáticos»: el que cobra
//     cada mes es TU Stripe o TU Mercado Pago, con el link de suscripción; MaKo anota cada mes en la ficha.
//   · «Notificaciones»: los avisos van a TU grupo de WhatsApp («C: nada al cliente», 06/10/2026, lib/avisos-catalogo.ts). Al
//     cliente le escriben el recibo y, cuando le rechazan el pago, un mensaje que se aprueba antes de salir (`revisar`: «la plata y
//     lo sensible, para aprobar»).
//   · Sus tres formas de integrar (SDK, API, Make) → tus dos pasarelas, con el texto de su tarjeta (lib/integraciones-catalogo.ts),
//     y las plantillas de cobranza de la galería de Automations, con su nombre y su línea tal cual, donde Rebill pone Make.
//   · Sus historias de clientes → el caso de Mauricio. Sus tarifas, sus logos de clientes y «Respaldado por» no van.
//
// De dónde sale lo que se afirma: lib/pagos.ts (el plan de cuotas, marcar una cuota), lib/pagos-vistazo.ts («Debe $1,000»),
// app/crm/[id]/CobrarConLink.tsx y lib/cobros.ts (el link, único o suscripción, el que salda una cuota, el paso a la etapa de
// venta), app/crm/lead-view/ficha/pagos/suscripcion.tsx (la suscripción mes a mes), app/crm/lead-view/ficha/pagos/recibo-leido.ts
// (el comprobante), app/dashboard/disenos/HojaCobranza (la hoja Cobranza y «A quién perseguir»), lib/cuentas-integracion.ts.
//
// LOS TEXTOS DE REBILL, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · «Infraestructura financiera para las Américas» → «Cobranza en cuotas para las Américas» (MaKo no es una infraestructura
//     financiera: cobra con TU cuenta de cada pasarela), con sus dos palabras en celeste, y su H2 «… para tu negocio en las Américas»;
//   · «Acepta pagos locales, ofrece cuotas y gestiona suscripciones…» → con las pasarelas de lib/cobros-tipos.ts (sin
//     «liquidaciones en USD o moneda local», que no son de MaKo);
//   · sus piezas «Links de pago / sin escribir una línea de código», «Genera enlaces… con monto, moneda… listos para enviar»,
//     «Pagos en cuotas», «Suscripciones», «Notificaciones» y «Dashboard» / «Obtén una visión clara de tu rendimiento…»;
//   · «Integración simple. Resultado profesional.» / «Elige la forma que mejor se adapte a tu modelo de negocio.», «Automatiza
//     flujos complejos sin escribir código» (→ «flujos de cobranza»), «Historias de clientes», «Preguntas Frecuentes».
// =============================================================================

import { CAPACIDADES_PASARELA, NOMBRE_PASARELA, PASARELAS as TODAS_LAS_PASARELAS } from '@/lib/cobros-tipos';

// Creem nos rechazó (definitivo, 5/11/2026): la landing ofrece sólo las pasarelas con las que se cobra hoy, Stripe y Mercado Pago (el
// Cerebro, 14/11, revisando las capturas: «sácalo de todas las landings»).
const PASARELAS = TODAS_LAS_PASARELAS.filter((p) => p !== 'creem');
import { DIAS_PRONTO } from '@/lib/datos-comercial';
import { DEFS } from '@/lib/integraciones-catalogo';
import { plantillaPorId } from '@/lib/plantillas-automatizaciones';
import { EVENTOS_MAKO, EVENTOS_PAGO } from '@/lib/disparadores';
import type { LandingCompetencia } from './tipos';

const I = {
  cobranza: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1', 'M12 6v2', 'M12 16v2'],
  tarjeta: ['M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z', 'M3 10l18 0', 'M7 15l.01 0', 'M11 15l2 0'],
  campana: ['M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6', 'M9 17v1a3 3 0 0 0 6 0v-1'],
};

/** «Stripe y Mercado Pago»: los nombres de las pasarelas, del código. */
const yLista = (n: string[]) => (n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join(''));
const LISTA_PASARELAS = yLista(PASARELAS.map((p) => NOMBRE_PASARELA[p]));
const MO_PASARELAS = PASARELAS.map((p) => NOMBRE_PASARELA[p]).join(', ').replace(/, ([^,]*)$/, ' o $1');

/** La pasarela que sólo le cobra a quien está en el país de su cuenta, y las que cobran en todo el mundo (lib/cobros-tipos.ts). */
const EN_SU_PAIS = PASARELAS.filter((p) => CAPACIDADES_PASARELA[p].soloEnSuPais).map((p) => NOMBRE_PASARELA[p]);
const EN_EL_MUNDO = PASARELAS.filter((p) => !CAPACIDADES_PASARELA[p].soloEnSuPais).map((p) => NOMBRE_PASARELA[p]);

/** Las plantillas de cobranza de la galería de Automations, con su nombre y su línea tal cual. */
const PLANTILLAS_COBRANZA = ['mako-cobranza', 'mako-pago', 'pago-rechazado', 'recibo-al-cobrar', 'comprobante-llego']
  .map((id) => plantillaPorId(id))
  .filter((p): p is NonNullable<typeof p> => p != null);

/**
 * Lo que dispara cada plantilla de cobranza, como lo nombra la app (lib/disparadores.ts): la lista que gira hacia MaKo en la tercera
 * forma de «Integración simple» (Rebill: los disparadores de Pipedrive, Zoho… que entran a Make).
 */
export const DISPAROS_COBRANZA: readonly { disparo: string; plantilla: string }[] = PLANTILLAS_COBRANZA.map((p) => {
  const cron = p.cron as { evento?: string; eventos?: readonly string[] } | undefined;
  const ev = cron?.evento ? EVENTOS_MAKO.find((e) => e.subtipo === cron.evento) : EVENTOS_PAGO.find((e) => e.subtipo === cron?.eventos?.[0]);
  return { disparo: ev?.label ?? p.nombre, plantilla: p.nombre };
});

/** Los avisos que manda «Una Cuota Venció» por cada cuota: los mensajes de la plantilla (las esperas no cuentan). */
const AVISOS_POR_CUOTA = (plantillaPorId('mako-cobranza')?.pasos ?? []).filter((p) => p.nodo !== 'esperar').length;

/**
 * La cara de atrás de cada tarjeta de cifras, en su orden: Rebill da vuelta la tarjeta al pasar el mouse (la frase grande se va y
 * aparece la explicación). Aquí, de dónde sale cada número.
 */
export const DETALLE_CIFRAS: readonly string[] = [
  `Conectas tu cuenta y cobras con tu link. ${yLista(EN_EL_MUNDO)} le cobra a cualquiera, en todo el mundo; ${yLista(EN_SU_PAIS)}, a quien está en el país de tu cuenta.`,
  'En su ficha y en la hoja Cobranza ves lo que vence pronto, lo vencido y cuánto debe cada cliente, sin hacer una cuenta.',
  'Con la plantilla «Una Cuota Venció»: el día que vence, a las 48 h y a las 72 h. Se corta sola al marcar el pago.',
];

export const LANDING_COBRANZA: LandingCompetencia = {
  slug: 'cobranza',
  nombre: 'Cobranza',
  icono: I.cobranza,
  referencia: { nombre: 'Rebill — pagos y cobros recurrentes en las Américas', url: 'https://www.rebill.com/es', leida: '2026-11-14' },
  metaTitle: 'Cobranza de MaKo: cobranza en cuotas para las Américas, con tu CRM',
  metaDesc: `Arma el plan de cuotas de cada cliente, cóbrale con un link de ${MO_PASARELAS} y mira lo que entró, lo que vence y a quién cobrarle hoy.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Cobranza para ventas en cuotas',
      titulo: '<em>Cobranza</em> en cuotas<br>para las <em>Américas</em>',
      bajada: `Acepta pagos con un link de <strong>${MO_PASARELAS}</strong>, ofrece cuotas y gestiona suscripciones, con tu propia cuenta de cada pasarela. Cada pago entra solo a tu CRM.`,
      puntos: ['En una hoja ves lo que entró, lo que vence y a quién cobrarle hoy. ¿Te pagaron por transferencia? MaKo lee el comprobante.'],
      visual: { tipo: 'detalle', slug: 'cobranza' },
    },
    {
      tipo: 'cifras',
      titulo: 'Cobranza para tu negocio en las Américas',
      items: [
        { valor: String(PASARELAS.length), label: `pasarelas para cobrar con tu cuenta: ${LISTA_PASARELAS}` },
        { valor: String(DIAS_PRONTO), label: 'días antes de que venza, la cuota se marca como próxima a vencer' },
        { valor: String(AVISOS_POR_CUOTA), label: 'avisos en tu grupo por cada cuota vencida, sin que hagas nada' },
      ],
    },
    {
      tipo: 'filas',
      titulo: 'Tu propia pasarela.',
      etiqueta: 'Pagos en cuotas, links y suscripciones.',
      bajada: `Conectas tu cuenta de ${MO_PASARELAS} y cobras desde la ficha de cada cliente. La plata entra a tu cuenta, no a la de MaKo.`,
      slug: 'cobranza',
      items: [
        {
          titulo: 'Links de pago <br>sin escribir una línea de código',
          texto: 'Genera el link de cada cuota con su monto y la moneda de tu cuenta, desde la ficha del cliente, listo para enviar por WhatsApp. Cuando paga, la cuota se marca sola.',
        },
        {
          titulo: 'Pagos en cuotas',
          texto: 'Arma el pago inicial y las cuotas con su fecha. En su ficha ves lo que pagó, lo que debe y la cuota que venció. ¿Te pagaron por fuera? La marcas cobrada con un toque.',
        },
        {
          titulo: 'Suscripciones',
          texto: 'Manda un link de suscripción: tu Stripe o tu Mercado Pago le cobra cada mes, y cada mes entra solo a su ficha, con lo que tocaba, lo que entró y lo que debe.',
        },
        {
          titulo: 'Notificaciones',
          texto: 'Te avisa en tu grupo de WhatsApp cuando entra un pago, cuando vence una cuota o cuando la pasarela rechaza un pago, con plantillas que cambias como quieras y los datos de cada cliente puestos.',
        },
        {
          titulo: 'Dashboard',
          texto: 'Obtén una visión clara de tu cobranza: lo que te deben, lo que entró este mes, lo que vence y <strong>a quién perseguir</strong>, el más atrasado arriba.',
        },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Integración simple.<br><em>Resultado profesional.</em>',
      bajada: 'Elige la pasarela que mejor se adapte a tu modelo de negocio, o conecta varias. Cada una cobra en tu cuenta, no en la de MaKo.',
      items: PASARELAS.map((p) => ({
        icono: I.tarjeta,
        titulo: `Cobra con tu ${NOMBRE_PASARELA[p]}`,
        texto: DEFS.find((d) => d.key === p)?.descripcion ?? '',
      })),
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Automatiza flujos de cobranza sin escribir código',
      bajada: 'Las plantillas de cobranza de la galería de Automations: las agregas y las cambias como quieras.',
      items: PLANTILLAS_COBRANZA.map((p) => ({ icono: I.campana, titulo: p.nombre, texto: p.linea })),
    },
    { tipo: 'caso' },
    {
      tipo: 'preguntas',
      titulo: 'Preguntas Frecuentes',
      items: [
        { p: '¿Qué métodos de pago puedo ofrecer en cada país?', r: `Con ${LISTA_PASARELAS}: conectas tu cuenta y cobras con un link. ${yLista(EN_SU_PAIS)} le cobra a quien está en el país de su cuenta; ${yLista(EN_EL_MUNDO)} cobran en todo el mundo.` },
      ],
    },
  ],
};
