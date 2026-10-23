# Guiones de VSL para vender MaKo

Pedido de Martín (audios del 15/10 y del 22/10/2026), textual: «no creo que me llegue a grabar o hacerlos con IA
sino que al menos los guiones». Son para la ventana de anuncios del 1/11 al 15/12 (US$2.000 de pauta, objetivo
US$15.000). Cada guion se lee en 2 minutos y se graba en unos 2.

| Guion | Para quién | Landing (Web Generator) | Empuja | Dura |
|---|---|---|---|---|
| [Principal](principal.md) | Todo el que llega del anuncio | `/` | Acelerador (por la llamada) | ~2:25 |
| [Web Generator](funcionalidad-web-generator.md) | El que paga diseñador por cada landing | `/vsl/crear-landings` | Esencial | ~1:35 |
| [Automations](funcionalidad-automations.md) | El que no hace seguimiento | `/vsl/automatizaciones` | Esencial | ~1:40 |
| [Dashboards](funcionalidad-dashboards.md) | El que mira cinco pantallas para saber cómo va | `/vsl/dashboards` | Esencial / Pro | ~1:40 |
| [Contenidos](funcionalidad-contenidos.md) | El que tiene su contenido en cinco apps | `/vsl/contenidos` | Pro | ~1:35 |
| [Avatares de IA](funcionalidad-avatares-ia.md) | El que no tiene tiempo de grabarse | `/vsl/avatares-ia` (en pausa) | Pro | ~1:35 |
| [Coach o consultor](avatar-coach-consultor.md) | Ya vende high ticket con anuncios | `/vsl/coaches` | Acelerador | ~1:50 |
| [Inmobiliarias](avatar-inmobiliarias.md) | Pauta y reparte interesados entre asesores | `/vsl/inmobiliarias` | Pro o Acelerador | ~1:45 |
| [Infoproductores](avatar-infoproductores.md) | Curso en Skool o Hotmart | `/vsl/infoproductores` | Acelerador | ~1:45 |
| [CRM](funcionalidad-crm.md) | El que pierde leads en el WhatsApp | sin landing | Esencial | ~1:40 |
| [Ads Manager](funcionalidad-ads-manager.md) | El que no sabe qué anuncio le vende | sin landing | Pro | ~1:45 |
| [MaKo, tu consultor](funcionalidad-mako.md) | El que decide solo y a ojo | sin landing | Esencial | ~1:40 |
| [Offer](funcionalidad-offer.md) | El que tiene una oferta que no se entiende | sin landing | Esencial | ~1:35 |
| [Agencia](avatar-agencia.md) | Maneja los anuncios de varios clientes | sin landing | Pro | ~1:45 |
| [Empieza con anuncios](avatar-empieza-con-anuncios.md) | Vende por WhatsApp y quiere pautar | sin landing | Acelerador | ~1:45 |

**Guion y landing alineados** (Landings, 36e52104c en landing-wg-2310; la regla: lo que el video no promete, la
landing tampoco): automatizaciones pasó al SEGUIMIENTO («Escríbele a cada lead hasta que conteste, sin hacerlo a
mano»); contenidos ya no promete un calendario de publicaciones. **avatares-ia queda EN PAUSA**: no se sube ni se
pauta hasta confirmar que un cliente usa AI Avatar (el 17/10 era sólo del super admin).
- Las 6 «sin landing» tienen guion: si Martín las quiere, son una entrada más en
  `scripts/landings-mako-funnels.mts` (rama landing-wg-2310), con el titular y las 3 líneas de cada guion.

Las landings las arma el chat «Landings de MaKo en Web Generator» (todas comparten el lugar del VSL en el hero: se
cambia el src de Panda cuando el video de cada una exista). Si una landing nueva no tiene guion acá, falta escribirlo.

## Cómo se leen

- `//` pausa corta · `///` pausa larga · **negrita** = la palabra que se marca en pantalla · `[corchetes]` = lo que se ve.
- Cada guion tiene el mismo esqueleto: **gancho → dolor → MaKo → prueba → objeción → cierre**. El del medio es el más largo.
- Abajo de cada uno: 3 ganchos para testear como anuncio (≤ 10 palabras) y lo que el guion NO dice a propósito.

## Las reglas (las de `MaKo-VSL/_voz-martin.md`, resumidas)

1. **Impersonal**: lo narra una voz, no Martín. Nada de «construí», «te acompaño», «conmigo». Si Martín lo graba él
   mismo, sólo cambia el cierre a primera persona.
2. **En «tú», español neutro**: «dinero», «aquí», sin voseo.
3. **Un concepto por video.** El principal vende MaKo entero; cada funcionalidad vende sólo lo suyo.
4. **Picante**: preguntas incómodas que el avatar no se hace en voz alta.
5. **Sin jerga**: nada de CAC, ROAS, R1, embudo de conversión, etapa, workspace.
6. **El «solo» es puntual** («te avisa por WhatsApp cuando contesta»), nunca «MaKo hace todo solo».
7. **Una objeción**, con «Y si tu objeción es "…"… déjame decirte algo:».
8. **Cierre de 2 frases como máximo.**
9. **Sólo lo que MaKo hace hoy.** Cada guion dice qué dejó afuera y por qué.
10. Para la voz de IA (ElevenLabs): «MaKo» se escribe «Máko» y «VSL» en minúscula («vsl»).

## Las ofertas (las del Cerebro, 23/10: C:/dev/cerebro-herramientas/ofertas-mako-23-10.md)

| Oferta | Precio | En una línea |
|---|---|---|
| **MaKo Esencial** | US$47 por mes (US$470 por año) | Todo MaKo con topes: 1 funnel, 2.000 leads, 1 WhatsApp, 3 automatizaciones, 3 landings |
| **MaKo Pro** | US$97 por mes (US$970 por año) | Sin topes, más Ads Manager completo (con la calculadora), Closing Analyst, equipo de 5 y agencia |
| **Programa MaKo Acelerador** | US$1.500 en 3 cuotas de US$500 | MaKo Pro 3 meses + la asesoría grupal de Martín cada jueves + el funnel armado en la semana 1. Después, Continuidad a US$297 por mes |

Los planes tienen 14 días de garantía. Cada negocio conecta su propia IA: ningún guion dice que la IA viene incluida.

## El CTA

- **Principal y avatares** (empujan el Acelerador): «Agenda tu diagnóstico gratis» (la llamada de la landing,
  `calendly.com/koncke/asesoria`). En la llamada se ofrece el Acelerador.
- **Funcionalidades** (empujan un plan): «Entra a MaKo», desde US$47 por mes, con el diagnóstico como segunda opción.
  Ads Manager y Agencia nombran el Pro: la calculadora y el modo agencia son del Pro.
- Si la campaña optimiza a conversaciones de WhatsApp (lo aprobado en Strategy), el cierre cambia a
  «Escríbenos por WhatsApp y pide tu diagnóstico».

## La prueba

El caso de Mauricio, tal como lo publica la landing: «de meses por debajo de US$10.000 a más de US$70.000 en tres
meses, sin cambiar la oferta ni el funnel». Es el único caso con números publicados; no se inventan otros.
