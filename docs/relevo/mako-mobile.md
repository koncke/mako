# Relevo — MaKo Mobile

<sub>Escrito por el chat «MaKo Mobile» (cuenta 3) el 11/10/2026 a las 15:00, al cruzar el 85% de uso
semanal. Material de primera mano: lo hizo este chat.</sub>

## ⚠️ LA DEVOLUCIÓN DE MARTÍN (11/10, 15:16) — arrancá por acá

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
