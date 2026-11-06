# Relevo — Lead Magnet Generator (nube, 6/11/2026)

> Escrito por la sesión de la nube que hizo el trabajo (`cli_a7d6638b-0aff-5cb9-a16a-98377f9db136`). Es de primera mano sobre
> lo que se escribió y se probó acá. Lo de producción NO se midió: desde la nube no hay base ni claves.

## Lo pedido (por el Cerebro, 6/11; el pedido de Martín es del 29/10)

Martín, 29/10/2026: «me lo imagino como una o varias plantillas... compartir un Notion con prompts, una guía, un checklist; un
quiz (preguntas que llevan a un diagnóstico)... con el Web Generator; si la landing no lo permite, que el editor permita
agregar formularios, enviar emails, conectarlo con el CRM o las automatizaciones; una clase grabada o un curso, que ya está
Classroom... pensá qué más, por ejemplo dashboards».

El «Cómo» del Cerebro, en seis puntos: (1) armar con lo que ya existe, la tab es plantillas y un camino simple, no un editor
nuevo; (2) lo que falte para captar: formulario al CRM, entrega por email o WhatsApp y disparador en Automations, medido
antes; (3) quiz con diagnóstico, con tests que lo rompan; (4) MaKo lo propone desde la oferta y Competitors Spy, cada negocio
con su IA y sin gurús en la galería; (5) copiar el flujo de UNA app real; (6) sus operaciones en la API de MaKo. Escritorio y
teléfono, por `punta/lead-magnets`, en tandas que anden solas. No tocar `app/ads-manager`.

## Dónde está

Rama `punta/lead-magnets` (y la de la sesión, `claude/amazing-johnson-fp86gs`). GitHub la lleva a main con el verde de
`punta.yml`; a producción, el cron del día. **Sin mirar desde la nube:** si la corrida dio verde.

## Tanda 1: la tab (hecha)

- **Cinco plantillas** (`lib/lead-magnets/plantillas.ts`): guía, checklist y prompts para copiar (en Copywriting), planilla
  (una tabla en Copywriting) y clase grabada (una landing del Web Generator, con el objetivo nuevo «Clase grabada»). Cada una
  nace con su ESTRUCTURA y la guía de cada sección; «Ver ejemplo» muestra un negocio ficticio del elenco y nunca entra a la
  pieza.
- **La lista de lead magnets es la de siempre** (`mako.entregable`): cada fila suma dónde vive su pieza, su plantilla y su
  página de captura. La tab la muestra con lo que le falta a cada uno para llegarle a un lead.
- **La página que lo pide:** una landing con formulario (entra al CRM) y su página de gracias con el link. Nace como borrador.
- **El link público:** de solo lectura, para la página de Copywriting (`/compartido/<token>`). No sale con la guía puesta.
- **«Ponerlo primero»:** las automatizaciones mandan el link del primero de la lista.
- **API de MaKo, área `leadmagnet`:** `ver_plantillas_magnet`, `armar_magnet`, `pagina_captura_magnet`,
  `link_publico_magnet`, `primero_magnet`. La lista y su edición ya estaban en `negocio` (`listar_lead_magnets`,
  `editar_lead_magnet`). Ninguna entra a una automatización.
- **Teléfono:** `/lead-magnet-generator` en el teléfono (`app/m/lead-magnet-generator/`), en More para el super admin.
- **De paso:** el paso Entregable del onboarding borraba el link al guardar; arreglado.

Tests: `tests/lead-magnets.test.ts` (8, cada uno probado rompiéndolo), y los del registro de la API, el nav, el teléfono y el
Web Generator actualizados.

## Lo que pide producción

- **Ninguna migración** en la tanda 1. Nada que aplicar.
- **Nada que configurar.** La tab se ve sólo desde la plataforma (el super admin sin mirar a un cliente).

## Lo que decide Martín

1. **¿Se abre a los clientes?** Hoy es sólo de la plataforma. Abrirla es sacar `adminOnly` (nav.ts), la puerta
   (`app/lead-magnet-generator/puerta.ts`) y `soloPlataforma` (`lib/api-mako/areas/leadmagnet.def.ts`), las tres juntas.
2. **¿El mensaje con el link sale al instante?** Hoy el lead del formulario entra al CRM en el acto y su automatización lo toma
   en el barrido de `/api/cron/nutricion`. El lead ya tiene el link en el botón de la página de gracias; lo que espera es el
   WhatsApp o el email. Inscribirlo al alta cambiaría el ritmo de todas las landings de todos los negocios. Recomendación: no
   tocarlo hasta que un negocio lo pida.
3. **¿Un lead puede entrar a Classroom?** Hoy un curso es para clientes que ya compraron. La clase grabada va como landing.
4. **¿El quiz se parece a Typeform?** Se copió de SurveyJS (código abierto) porque Typeform no se abre desde la nube. Si
   quiere otra referencia, se mide en su Chrome.

## Lo que sigue

- **Tanda 2:** quiz con diagnóstico (un bloque nuevo del Web Generator, motor puro con tests, flujo de SurveyJS).
- **Tanda 3:** MaKo propone el lead magnet desde la oferta y Competitors Spy, con la IA del negocio.
