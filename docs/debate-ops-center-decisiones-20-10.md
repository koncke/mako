# Debate · cómo aplicar «MaKo = el chat del Ops Center» · para que Martín decida (20/10/2026)

Fuentes: [investigacion-ops-center-19-10.md](investigacion-ops-center-19-10.md) (la cuenta 1, en la nube) y
[plan-todo-ops-center-19-10.md](plan-todo-ops-center-19-10.md) (la llamada con Leila). Los números salen de
`anthropic_usage` y `credenciales` en producción el 20/10. Cuatro verificadores del Cerebro los refutaron y
están corregidos: el detalle quedó en [hallazgos-ia.md](hallazgos-ia.md). Los tokens son medidos; el precio
es el de lista (Haiku 1/5, Sonnet 3/15, Opus 5/25 US$ por millón).

**Ya decidido, no se vuelve a abrir:**
- El Plan nunca paga IA.
- La IA de la plataforma sale del ws9.
- MaKo no usa el token de la suscripción de un cliente.

---

## Decisión 1 · Quién paga el chat: DECIDIDO

> **Martín (20/10, ~18:30 ART): nadie paga el Ops Center de los usuarios.** «Que al igual que yo conecté mis
> cuentas de Claude, ellos puedan conectar sus propias cuentas de Claude y GPT… MaKo sólo actuaría como un
> ejecutador de sus propias suscripciones».

**Cómo se hace sin violar los términos** (medido el 15/10, con fuentes, en [hallazgos-ia.md](hallazgos-ia.md) →
«Que el cliente use SU Claude o su ChatGPT»): lo que corre es el **programa oficial** (Claude Code con el login
de Anthropic y el binario sin tocar), igual que en la PC de Martín. **MaKo nunca toma el token de la suscripción.**

| Dónde corre | Cómo es | Condición |
|---|---|---|
| **En la computadora del cliente** | Como Martín: «con dejar tu computadora prendida» [llamada con Leila, 09:40] | Que la PC esté prendida |
| **En un servidor de MaKo** | El Claude Code oficial de cada cliente, alojado por MaKo | Commercial Terms firmados, binario sin tocar, login de Anthropic, MaKo no paga ni revende el uso |
| **Routines en la nube del cliente** | Claude Code corre en la cuenta del cliente | 30 por hora por routine, 100 por hora por cuenta, arranque en frío |

- **Prohibido** (se hace cumplir sin aviso): que el software de MaKo guarde el login del cliente y llame a
  Claude con ese token.
- **Zona gris:** que MaKo atienda leads las 24 horas con la suscripción del cliente. Antes, consultar a ventas
  de Anthropic. Mientras tanto, eso sigue con la cascada gratis o la API.
- **Sin verificar:** GPT con su programa oficial (Codex) y «Sign in with ChatGPT». El 15/10, «Use your ChatGPT
  plan» para apps de terceros era sólo para socios.

**Falta decidir: dónde corre.**

---

## Lo que choca con lo decidido (Martín lo tiene que ver)

1. **Un Claude o GPT por API key ya se puede conectar.** Ticketera dejó listo hoy que la key de Claude del
   negocio conteste el chat con herramientas (`25f9bbca6`, **todavía no desplegado**). Hasta hoy hubo 0 llamadas
   con la key de un negocio. Va como último intento, después de las IA baratas del negocio.
2. **Datos de clientes en una IA que entrena.** El ws13 usa Gemini **gratis** (se ve en sus errores 429
   «FreeTier»), y MaKo en WhatsApp le mandó datos de su CRM **34 veces desde el 17/10**. MaKo no puede saber de
   antemano si la Gemini de un cliente es la gratis. Es el hueco que quedó abierto el 07/10, cuando se decidió no
   sacarle Gemini a quien sólo tiene Gemini. **Con «cada cliente conecta su Claude y su GPT», ¿se corta la Gemini
   gratis para los datos de clientes, o se le pide al cliente su Claude?**
3. **Mauricio (ws1) sigue sin IA** hasta que conecte la suya: sus 7 keys son copias de las de MaKo (tickets #5 y #6).

---

## Contexto: lo que tienen y lo que usan hoy (corregido)

**Keys de IA, en 11 negocios activos** (el ws5 está pausado):
- **Claude conectado: 2.** El ws11 Leila, con su propia key, y el ws10, con la key del crédito de la cuenta 2
  (la pidió Martín).
- **Sólo Gemini: 5** (ws13, ws15, ws17, ws18, ws19).
- **Sin IA propia: 3** (ws20, ws21 y el ws1, cuyas keys son copias de las de MaKo).

**Uso**, del chat del Ops Center, MaKo en WhatsApp y Offer:
- `anthropic_usage` anota una fila por **paso** del loop de herramientas, y un turno son ~2,1 pasos. Las 336
  llamadas son ~190 turnos.
- El que más usa es el ws13: 129 llamadas, ~68 turnos, en 14 días de uso. Son **~5 turnos por día**.
- Un turno del Ops Center lleva entre 0 y ~40 herramientas, con tope de 12.000 caracteres: ~9.300 tokens por llamada, ~21.000 por turno.
- **Un onboarding:** US$0,13 (ws21, 18/10: 18 llamadas de Offer + 1 de El Archivero). Es una sola muestra; con el tope de la guardia puede llegar a ~US$1.

**Lo que habría costado que MaKo pagara** (la opción descartada, al ritmo de las últimas dos semanas, por mes):

| | El ws13 | Todos |
|---|---|---|
| Haiku | ~US$3,6 | ~US$7 |
| Sonnet | ~US$11 | ~US$21 |
| Opus | ~US$18 | ~US$35 |

Era ~1,7% del crédito de US$400 de las dos cuentas Max. Un plan de 47 deja de cubrir Haiku a los ~1.800 turnos por mes (~60 por día).

---

## Lo que sigue, en el orden de la investigación

| # | Pieza | Qué cambia para el cliente | Chat | ¿Choca con los plazos de esta semana? |
|---|---|---|---|---|
| 0 | **Plazos de esta semana:** landing, VSL, pasarela y Meta Ads | Nada todavía; es para vender | Web Generator, Pagos, Ads | — Van primero. El chat único no hace falta para lanzar |
| 1 | **Conectar su Claude y su GPT** (lo decidido) | Pone sus cuentas una vez y el chat anda con su suscripción | Ops Center 3 (es el que arma el Ops Center de Martín) + Infra si corre en un servidor | No, pero depende de dónde corre |
| 2 | **Bloques en el chat:** tarjeta con lo creado, tres opciones para elegir, vista grande con «Abrir en la app» | Ve y elige lo que MaKo hizo sin salir del chat. Ya se pueden mostrar el PDF de Offer, las tres miniaturas de una landing, un gráfico, una toma de Flow, la miniatura del Image Editor y el kanban del Plan | Ops Center 3 arma el marco; cada tab da su bloque | Un poco: Web Generator está con la landing |
| 3 | **Herramientas y confirmar adentro** | Hoy, de 19 pedidos, 7 no reciben ninguna herramienta («quiero un carrusel», «mandale un WhatsApp a Juan»), y el 42% de las acciones manda a confirmar a otra pantalla | MaKo WhatsApp (el clasificador) + Ops Center 3 | No |
| 4 | **Que proponga al entrar** («vi que tu negocio es X, ¿empezamos con A, B, C?») | Entra y ya tiene qué hacer, como Shopify Sidekick o el resumen diario de Meta | Second Brain + Ops Center 3 | No. Necesita que el cliente tenga su IA conectada |
| 5 | **MaKo como MCP en ChatGPT o Claude** | Usa MaKo desde su chat de siempre | Ya existe la base: la API de MaKo (`/api/v1`, 795 operaciones, un token por negocio; el ws10 la usó 273 veces) y el plugin público de Claude Code (`plugin/`). **Falta sólo el transporte MCP** encima | No. Es para después del lanzamiento |

**Ya repartido** (los bugs que midió la investigación): Chats lento → CRM · el aviso de la cuota con el nombre
del cliente, y «Clientes por cobrar» con las suscripciones → Pagos · la cola de montaje del AI Avatar → Video ·
el modal de Gemini a quien tiene sólo Claude → Ticketera.

---

## Lo que tenés que decidir

1. **Dónde corre el Claude de cada cliente:** en su computadora (como vos), en un servidor de MaKo, o en las
   routines de su nube.
2. **La Gemini gratis con datos de clientes:** ¿se corta, o se le pide al cliente su Claude? (punto 2 de arriba).
3. **Las tabs:** el choque con la investigación es **menor** de lo que parecía.
   - En la llamada dijiste «una sola tab» [14:26], pero también que la edición manual sigue, «más rebuscado»
     [14:51], y dejaste afuera CRM, Chats, Customer Success y quizás el Plan [17:10–19:10].
   - La investigación propone lo mismo: el chat adelante y las pantallas detrás de «Abrir en la app».
   - Falta definir si las demás tabs se esconden del menú o quedan como secundarias.
4. **Sigue abierto de la llamada:** el nombre nuevo de «Clientes», y si el Plan va adentro del chat.
