# Relevo — MaKo Mobile

<sub>Escrito por el chat «MaKo Mobile» (cuenta 3) el 11/10/2026 a las 15:00, al cruzar el 85% de uso
semanal. Material de primera mano: lo hizo este chat.</sub>

## Dónde quedó

- **Está en `main` y desplegado** (commit `ef8626ce`): la app del teléfono en `/m` (Today, Inbox,
  MaKo, CRM, Plan y Cuenta), Web Push por persona, el feed de avisos con workspace y el chat de MaKo
  que propone acciones y se aprueba desde el hilo. Las decisiones, en `docs/diseno-mako-mobile.md`;
  las trampas y lo pendiente, en `docs/hallazgos-mobile.md`.
- **Salió ESCALONADO: el reparto de teléfonos está APAGADO** (`MOBILE_AL_ENTRAR = false` en
  `app/inicio/page.tsx`). Nadie cae en `/m` solo: se abre por URL (`hola-mako.com/m`).
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
2. Si `/m` anda: **poner `MOBILE_AL_ENTRAR = true`** en `app/inicio/page.tsx` y desplegar.
3. **Probar en un iPhone y un Android reales**: agregar a la pantalla de inicio (el ícono viejo hay que
   volver a agregarlo: iOS congela el manifest), activar los avisos desde `/m/cuenta` y «Probar aviso»,
   dictar y mantener el micrófono en MaKo, aprobar una propuesta, agendar desde la ficha de un lead (en
   un lead de prueba: manda invitaciones reales).
4. La lista «Lo que quedó sin hacer» de `docs/hallazgos-mobile.md`.

Para verificar local sin tumbar la máquina: `node_modules/.bin/next dev` SÓLO con más de 6 GB
disponibles, y apagarlo al terminar (regla de AGENTS.md). El puente de capturas a 390 px con UA de
iPhone que usó esta corrida era un script del scratchpad; el método completo está en la memoria
`verificar-en-navegador`.
