# Relevo — MaKo Mobile

<sub>Escrito por el chat «MaKo Mobile» (cuenta 3) el 11/10/2026 a las 15:00, al cruzar el 85% de uso
semanal. Material de primera mano: lo hizo este chat.</sub>

## ⚠️⚠️ EL REDISEÑO PEDIDO (11/10, ~16:30) — ESTO MANDA SOBRE TODO LO DE ABAJO

Martín vio /m en producción (recorrida a ancho de teléfono, las seis tabs andan) y la RECHAZÓ, textual:
«Todo eso se ve bastante mal... Ese no es el icono de MaKo... Tampoco quiero que ese icono tenga tanto
protagonismo... MaKo no es una app de un chat con una IA... Decidiste sacar muchas cosas que tal vez si
sería bueno tenerlas... Pusiste por defecto blackmode, cuando por defecto es white mode. Hay una cantidad
de texto en esas capturas, y otros que estan flotando... No se ve para nada como lo que es MaKo, se ve
bastante feo.»

Y contestó (decisiones, no se rediscuten):
- **Estilo: «Estilo app nativa, pero sin perder el diseño que ya hicimos en MaKo».** Estructura de app de
  iPhone (títulos grandes, listas agrupadas, sheets) con la identidad de MaKo de escritorio: CLARO, la
  paleta Nord + el azul de acción, Geist, las tarjetas de la casa, el dorado sólo para la marca.
- **Secciones que van al teléfono, además de Today, Inbox, CRM y Plan:** Dashboard, Ads Manager,
  Customer Success, Automations, **el editor de video estilo CapCut** (/video-generator, el editor de
  anuncios) y **el constructor de landings estilo Gamma** (/landing-generator), aunque sea en versión
  reducida. (WhatsApp no lo marcó.)
- **El ícono de MaKo:** el del destino central de la barra NO es el logo de MaKo (era una chispa genérica
  del set de íconos). Va el logo real (app/_components/MakoBrand.tsx / Marca.tsx) y SIN protagonismo:
  MaKo no es «una app de chat con una IA», así que el chat deja de ser un destino central de la barra
  (va dentro de «Más» o como acción secundaria).
- **Claro por defecto:** ya arreglado (app/m/_ui/tema.ts y ShellM: oscuro SÓLO si la persona lo eligió;
  antes seguía al sistema operativo).
- **Menos texto y nada flotando:** sacar la «Actualizado hh:mm» flotando al lado del título, los
  subtítulos, las segundas líneas largas, las pills que no deciden nada. Un paso por pantalla, cosas
  grandes (memoria un-paso-por-pantalla).

La barra con más de cinco secciones: cinco destinos máximo (Today · CRM · Inbox · Plan · Más) y «Más»
abre la lista de las demás (Dashboard, Ads Manager, Customer Success, Automations, Video, Landing, MaKo,
Cuenta) — o la composición que se decida con él viendo un prototipo.

`MOVIL_ACTIVO` sigue en `false` hasta que Martín apruebe el rediseño.

**El próximo paso, acordado: un PROTOTIPO antes de implementar.** Un diseñador escribe
`docs/diseno-mako-mobile-v2.md` (barra de 5 con «Más», encabezado nativo con el logo real chico, tarjetas
y listas en claro, qué texto se va, y por sección qué hace el teléfono y qué queda en la computadora —
el editor de video y el de landings en versión reducida honesta) y un HTML autocontenido de 390×844 con
Today, Más, CRM y ficha, Inbox, Dashboard, Ads Manager y el editor de video reducido, con los tokens reales
de globals.css, el SVG real del logo y datos de ejemplo FICTICIOS. Se publica como artifact para que
Martín lo vea en el celular y lo apruebe; recién ahí se implementa.

**HECHO el 11/10 a la noche, ESPERANDO A MARTÍN:** `docs/diseno-mako-mobile-v2.md` y
`docs/prototipos/mako-mobile-v2.html` (las 12 pantallas, navegables; `#more`, `#crm`, `#editor`… abre cada
una). Publicado privado en https://claude.ai/artifact/DiP5DFkdjk5BWzC1khhVa3. Se miró a 390×844 con
Chrome headless + Emulation (ver hallazgos-mobile: `--window-size=390` NO sirve, Chrome topea en ~500 y
recorta la captura): sin desborde horizontal, sin errores de script. **Antes de implementar faltan sus
3 respuestas:** (1) Video y Landing sobre lo que hay en `main` o esperar a mergear el CapCut
(rama `video-editor`) y el Gamma (`wt-gamma`); (2) si el teléfono puede gastar créditos de Flow
(«Filmar de nuevo») o sólo mira, cambia el texto y descarga; (3) Ads Manager con lo que ya existe o con
propuestas de MaKo para aprobar en el Inbox (no existen ni en escritorio).

Ya arreglado en esta tanda (commit de la tarde): el Inbox cuenta y muestra sólo lo que se decide en el
teléfono (los 68 borradores del plan van plegados en «N para revisar en la computadora»), Today corta
«Para hoy» en 5, el globo propio del chat de WhatsApp era ilegible en oscuro, el email de Cuenta.

## LA DEVOLUCIÓN DE MARTÍN (11/10, 15:16)

Abrió MaKo en su teléfono y vio **el escritorio** (/general con el Sidebar en miniatura y botones
chicos): «Se ve bastante mal... Realmente no tiene mucho de app mobile eso... Revisalo bien y vuelvelo
a hacer... Tienes que revisar tab por tab que sea funcional y que se vea bien. Seguro que hay cosas que
deberás sacar en la versión mobile... O incluso tabs que solo se puedan abrir en la versión de desktop».

Lo que vio NO era /m: el reparto estaba apagado, así que el teléfono cayó en el escritorio. Quedó
escrito (y subido INERTE) el arreglo de raíz: **un teléfono no ve el escritorio** —
`lib/movil-desvio.ts` decide, `app/_components/DesvioMovil.tsx` (en el layout raíz) tapa desde el
primer pintado y lleva a /m o dice «Esta pantalla se usa en la computadora» con «Abrirla igual»—, y
un solo interruptor: **`MOVIL_ACTIVO` en lib/movil-desvio.ts, hoy `false`** (gobierna el desvío y el
reparto de /inicio).

**Lo que falta, que es lo que pidió:** revisar /m TAB POR TAB en un teléfono (390 px) — Today,
Inbox, MaKo, CRM (lista, ficha, chat), Plan, Cuenta —, que cada una funcione y se vea como app, sacar
lo que sobre, y recién ahí poner `MOVIL_ACTIVO = true`. Hoy no se pudo: la máquina no tuvo RAM para un
next dev (el vigía lo mata), la extensión de Chrome no estaba conectada y el uso semanal llegó al 92%.

## Dónde quedó

- **Está en `main` y desplegado** (commit `ef8626ce`): la app del teléfono en `/m` (Today, Inbox,
  MaKo, CRM, Plan y Cuenta), Web Push por persona, el feed de avisos con workspace y el chat de MaKo
  que propone acciones y se aprueba desde el hilo. Las decisiones, en `docs/diseno-mako-mobile.md`;
  las trampas y lo pendiente, en `docs/hallazgos-mobile.md`.
- **Salió ESCALONADO: el reparto de teléfonos está APAGADO** (`MOVIL_ACTIVO = false` en
  `lib/movil-desvio.ts`). Nadie cae en `/m` solo: se abre por URL (`hola-mako.com/m`).
- **Ninguna pantalla de `/m` se vio todavía en un navegador.** La máquina no tuvo RAM para un
  `next dev` (el vigía lo mató a los 4 GB). Tampoco se miraron `/general`, `/plan/agencia` y
  `/mako/pendientes` después de las extracciones: se revisaron por diff (sin hallazgos), no por
  pantalla. Typecheck en cero, 195 tests nuevos y 622 de los guards del repo en verde, y una
  revisión adversarial que encontró y cerró tres bugs (chats ajenos, suscripción de la cuenta
  anterior, links con `?ws=9`).
- Ya aplicado en producción: las migraciones 0249 (`push_suscripciones`) y 0250 (`notificaciones`
  con workspace) y la credencial `WEB_PUSH_VAPID` del ws 9.

## Lo próximo, en orden

1. **Abrir `hola-mako.com/m` en el teléfono** (y en escritorio `/general`, `/plan/agencia` y
   `/mako/pendientes`) y mirar que todo se dibuje. Si hay un error de pantalla, se arregla antes que
   nada: hoy no afecta a ningún cliente porque nadie llega solo a `/m`, pero `/general` sí es de todos.
2. Si `/m` anda: **poner `MOVIL_ACTIVO = true`** en `lib/movil-desvio.ts` y desplegar.
3. **Probar en un iPhone y un Android reales**: agregar a la pantalla de inicio (el ícono viejo hay que
   volver a agregarlo: iOS congela el manifest), activar los avisos desde `/m/cuenta` y «Probar aviso»,
   dictar y mantener el micrófono en MaKo, aprobar una propuesta, agendar desde la ficha de un lead (en
   un lead de prueba: manda invitaciones reales).
4. La lista «Lo que quedó sin hacer» de `docs/hallazgos-mobile.md`.

Para verificar local sin tumbar la máquina: `node_modules/.bin/next dev` SÓLO con más de 6 GB
disponibles, y apagarlo al terminar (regla de AGENTS.md). El puente de capturas a 390 px con UA de
iPhone que usó esta corrida era un script del scratchpad; el método completo está en la memoria
`verificar-en-navegador`.
