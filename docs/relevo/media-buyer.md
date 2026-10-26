# Relevo — Media Buyer (la tab /ads-manager)

**Escrito el 25/10/2026 por el chat «Media Buyer» (cuenta 5, `claude5`).** Rama `mediabuyer-2510` (worktree
`C:/dev/wt-mediabuyer-2510`). Lo sube el Cerebro en el tren; este chat no pushea.

## Qué es

Desde el 25/10/2026 `/ads-manager` es el **Media Buyer de MaKo**: un agente que mira la cuenta de Meta del negocio una vez
por día y deja DECISIONES (subir o bajar un presupuesto, pausar, prender, variaciones del anuncio ganador), cada una con
su porqué, la tabla de números que la disparó y su deshacer. Las lanza una persona («propone») o el piloto automático
(lo prende cada negocio). Reemplaza a la réplica de Meta Ads Manager, que se borró con sus tests.

- **La referencia** es Madgicx · AI Marketer. Capturas y mapa pantalla por pantalla: `docs/media-buyer/referencia.md`.
  ⚠️ **Copiar de la app por dentro (`referencias/madgicx/vivo-*.jpg`), NO de la imagen de la landing**: son pantallas
  distintas (la app es clara, con pestañas y «Ver detalles»).
  **Desde el 25/10:** la estructura, la limpieza, las medidas (tomadas de la captura) y TODAS las funciones de Madgicx;
  los colores, los de MaKo (`app/ads-manager/mb-paleta.css`, todo token de la casa). Antes de tocar la pantalla, mirar la
  captura de Madgicx: lo que MaKo suma va dentro de un lugar que Madgicx ya tiene (la tuerca, «Pedirle más a MaKo», el
  saludo con globos), nunca como un botón o un cartel más.
- **Lo que se mide y lo que costó:** `docs/hallazgos-ads.md` → «El Media Buyer reemplaza al Ads Manager».
- **El encuadre de seguridad** viene del Autopilot del 13-14/10: `docs/diseno-ads-autopilot.md`.

## Dónde vive

| Qué | Archivo |
|---|---|
| Las tácticas (Surf, Sunsetting, Stop Loss, Revive, Calidad, Ganador) — puro, con test | `lib/media-buyer/motor.ts` |
| Los topes (subida por día, presupuesto máximo, interruptor) — puro, con test | `lib/media-buyer/topes.ts` |
| Leer la cuenta (Meta o Zernio) y el CRM por cohorte | `lib/media-buyer/datos.ts` · `senales.ts` (puro) |
| Lanzar y deshacer (lectura en vivo, topes, reclamo antes de escribir) | `lib/media-buyer/ejecutar.ts` |
| Una corrida (cron 14:30 UTC, «Analizar ahora», la API) | `lib/media-buyer/corrida.ts` · `app/api/cron/media-buyer/route.ts` |
| Variaciones con la IA del negocio | `lib/media-buyer/variaciones.ts` · `variaciones-prompt.ts` (puro) |
| Config y registro (tablas de la 0332) | `lib/media-buyer/store.ts` · `supabase/migrations/0332_media_buyer.sql` |
| Lo que escribe por Zernio | `lib/zernio-ads.ts` (la parte del 25/10) |
| La pantalla (la captura 04 de AdAmigo desde el 25/10 noche) | `app/ads-manager/MediaBuyer.tsx` (Hoy · Campañas · Biblioteca, la hoja del detalle) · `Arbol.tsx` (el árbol y la tarjeta chica) · `Hoy.tsx` (la caja, «¿En qué te ayudo hoy?», Actividad, los números del mes) · `Autopilot.tsx` (la tarjeta entera del detalle, las alertas) · `Lienzo.tsx` · `Biblioteca.tsx` · `Agentes.tsx` (cuelga de la tuerca) · `ArranqueMediaBuyer.tsx` · `aa.css` · `mb-modelo.ts` |
| El teléfono | `app/m/ads/MediaBuyerM.tsx` (las mismas piezas en una columna) · `mb-m.css` |
| Lo que la pantalla lee además de la config (productos, mejores anuncios, arranque, agentes propios) | `lib/media-buyer/vista.ts` · `productos.ts` y `arranque.ts` (puros, con test) |
| Los agentes de MaKo y los propios, y Protect | `lib/media-buyer/agentes.ts` · `agentes-propios.ts` (puros) · `agentes-ia.ts` · `protect.ts` (puro) · en la corrida, `corrida.ts` |
| La API de MaKo (ver, lanzar, deshacer, descartar, analizar, modo, topes, agentes, Biblioteca) | `lib/api-mako/areas/ads.def.ts` / `.run.ts` · lo fija `tests/media-buyer-api.test.ts` |
| Subir creativos nuevos a un conjunto (por Zernio) | `lib/media-buyer/subir.ts` · `creativos.ts` (puro) · el modal en `MediaBuyer.tsx` |
| Los hooks de un video ganador como guiones del Video Generator | `lib/media-buyer/hooks-video.ts` · `hooks-guion.ts` (puro) |
| Los Ajustes (la página «AI Marketer settings») | `app/ads-manager/Ajustes.tsx` (`/ads-manager/ajustes`) |
| Las tácticas como automatizaciones (estado, umbrales, campañas) — puro, con test | `lib/media-buyer/tacticas.ts` · la pantalla `app/ads-manager/Automatizaciones.tsx` (`/ads-manager/automatizaciones`) |
| Lo que trae cada plan (Esencial: 2 por día, sin piloto) | `lib/media-buyer/plan.ts` (puro) · `cupoDe` en `store.ts` · el número en `lib/topes-plan.ts` (de Planes) |

## Estado (25/10/2026)

- **Hecho y en la rama:** el motor y sus tests (rotos a propósito antes de darlos por buenos), los topes, el ejecutor, la
  corrida y el cron, la pantalla copiada de Madgicx (escritorio y teléfono), el arranque de tres pasos, las variaciones de
  texto y de hook (texto), la API de MaKo, la bitácora de `/admin/dev` y la cosecha.
- **Apagado por defecto en TODOS los negocios.** Nadie tiene el piloto automático: lo prende cada negocio.
- **Automatizaciones (25/10, el «Automation Overview» de Madgicx):** cada táctica apagada / propone / automática, con sus
  umbrales (el recomendado es el que el motor usó siempre) y las campañas que cubre. El modo general de la tuerca es el
  valor de las que no eligieron otro. El piloto lanza SÓLO lo de las tácticas automáticas, y una sola puerta niega
  «automática» sin plan (`guardarConfig`). En la API: `ver_automatizaciones_media_buyer` y `automatizacion_media_buyer`.
- **MaKo Esencial (el Cerebro, 25/10):** «propone», 2 recomendaciones por día, sin piloto. Pro, entero. Sólo al Esencial que
  MaKo cobra por la pasarela. Lo fija `tests/media-buyer-plan.test.ts`. ⚠️ Hasta que Planes saque 'ads-manager' de
  `NAV_SOLO_PRO`, ese Esencial ni entra a la tab.

## Lo que falta, en orden

1. **Hecho el 25/10/2026:** la 0332 aplicada en producción (el Cerebro, con `tacticas`); la cuenta de MaKo conectada a
   Zernio (cuenta de Zernio `6ade25185b6c93612b7cc6a1`); **la medición que escribe**: una decisión real lanzada por Zernio,
   recortada por el tope, leída en Meta y deshecha (`docs/hallazgos-ads.md` → «La medición que escribe, en la cuenta de
   MaKo»). El Media Buyer de MaKo (ws9) quedó **prendido en «propone»** con `act_1426493815659364` en Ajustes. Sin piloto.
2. **Lo del ANUNCIO, MEDIDO el 25/10 en la cuenta de MaKo** (Martín: «Ya agregue la tarjeta»): crear en pausa, prender,
   pausar y deshacer por el Media Buyer, variaciones de texto y de hook con su deshacer, borrar; gasto 0
   (`docs/hallazgos-ads.md` → «La medición que escribe»). Para repetirlo: `foto` → `crear --si` → `decisiones-anuncio --si`
   → `interruptor-anuncio --si` → `borrar --si` → `comparar`. Antes, el mismo día, se probó en la cuenta de Mauricio. Martín,
   25/10 ~13:55: «Para probar el Media Buyer, hazlo en la cuenta de Mauricio, que si tiene metodo de pago». La cuenta es
   «Cuenta 1» del portfolio Elévate, `act_185929215397361` (activa, pago ok, MXN, mínimo MXN 18,59/día), conectada a un
   perfil de Zernio APARTE de la plataforma (`6ade389b5bed5c321f2f42d8`, conexión `6ade3a22ef8ec89d32cced61`, «Administrar
   campañas»; la de MaKo no se tocó y sigue con «Control total»). Hecha la foto de la cuenta (18 campañas, 22 conjuntos).
   Con el permiso de Martín escrito en este chat («Autorizo crear, probar y borrar una campaña [PRUEBA MaKo] pausada…»),
   `crear --si` falló en Meta con el mismo 1359188 que la de MaKo, aunque Zernio decía `billingStatus: ok`. La cuenta quedó
   IGUAL que en la foto (40 campañas y conjuntos, nada nuevo); sólo quedó la imagen de prueba («ad_image.jpg», 1200×630,
   subida el 25/10 a las 14:51) en su biblioteca de medios: Zernio no la puede borrar, hay que quitarla a mano en el
   Administrador de anuncios. El perfil de Zernio de la prueba se desconectó y se borró (verificado: queda sólo el Default
   con la conexión de MaKo en «Control total»), y la cuenta salió de `CUENTAS_PERMITIDAS`.
   **Para medir lo del anuncio hace falta una cuenta donde Meta deje crear anuncios**: un método de pago válido en la de
   MaKo (lo más simple: nada de clientes), o el de la «Cuenta 1» actualizado. El script ya tiene todo: `--cuenta=`,
   `foto`/`comparar` y `decisiones-anuncio --si` (prender y deshacer el anuncio, una variación y su deshacer, con el Media
   Buyer de la plataforma en «propone», que vuelve a su cuenta al terminar).
   ⚠️ Prender o pausar una campaña SIN anuncios no se puede por Zernio (404; el endpoint no acepta `accountId`): con un
   anuncio adentro sí.
2b. **La prueba gratis (Martín y el Cerebro, 25/10): sin piloto los 7 días.** `cupoDe` lee `estadoDePrueba(ws).enPrueba`
   (`lib/prueba-uso.ts`, rama planes-2510) y `PlanSinPiloto` dice «Disponible al terminar tu prueba». Espera a que
   planes-2510 entre a main (mergearla acá choca en 4 archivos de otros chats). Sólo del lado del servidor: la pantalla está
   en pausa (abajo). El script del cambio quedó en las notas compartidas del Cerebro (`media-buyer-prueba-gratis.py`): SIN
   las partes de pantalla (Ajustes, Automatizaciones) mientras dure la pausa.
2c. **LA PANTALLA, CON LA ESTRUCTURA DE ADAMIGO (25/10 ~18:50).** Martín eligió AdAmigo entre las opciones del Cerebro:
   «Me gusta el de "AdAmigo" implementalo de punta en punta... Lo que más me interesa es que en diseño se vea muy bien».
   Hecho en la rama: Resumen · Autopilot · Campañas (por producto, con la asignación de cada campaña ahí mismo) ·
   Biblioteca, el panel «N activos» con los cuatro agentes de MaKo y los propios, Protect arriba de las acciones, el
   arranque como la charla de Offer con la calculadora adentro, y el teléfono con las mismas piezas. Todo por la API
   (`modo_agente_media_buyer`, `agente_media_buyer`, `borrar_agente_media_buyer`, `ver_biblioteca_media_buyer`).
   El Cerebro lo sube cuando este chat le diga «esta punta entra». Falta: Ajustes y Automatizaciones con la estética nueva
   (siguen con `mb.css`), y la `<FranjaPrueba>` de Planes (con 2b).
   **Rechazada el mismo 25/10 ~19:40** («Una cantidad de botones y texto impresionante... la captura que me habias pasado de
   Adamigo no se parece en nada»): había elegido la captura 04 y se copió otra pantalla. **Rehecha como la 04** (Hoy = la
   caja del chat + el árbol de cambios por producto + una línea al pie; cuenta nueva = la captura 2). Las comparaciones lado a
   lado, en las notas del Cerebro (`media-buyer-adamigo/`). El Cerebro las vio («ahora sí se parece a la 04 y a la 2») y se
   las mostró a Martín, que la aprobó el 26/10 («Me gusta como esta quedando el media buyer, pon la foto de perfil, tal como lo
   pone AdAmigo»): la caja lleva la foto de quien pide (MiFoto; sin foto, su inicial) y entra en el tren siguiente.
   **La revisión adversarial de tren-l (26/10) encontró 10 fallas**; están arregladas en 08009e9b5, cada una con su test en
   `tests/media-buyer-revision-l.test.ts` (roto una vez por falla). La más seria: con «Aplicar» en cada tarjeta, los textos de la
   IA salían sin que nadie los leyera; ahora se lanzan sólo desde su hoja. Antes de prender el Media Buyer en un negocio que no
   sea MaKo, que esa punta esté en main. Detalle en hallazgos-ads → «La revisión adversarial de tren-l».
   **La verificación de tren-m (26/10)** cerró 9 de 10; lo que quedaba de 0 (el título de la IA, a la vista), 4 (el monto en
   el arranque y en Ajustes) y 8 (la guarda de «se está creando» con tiempo) está arreglado con sus roturas. Quedan
   ANOTADOS, sin hacer (detalle en las notas del Cerebro, `verificacion-tren-m.md`, bloque [mb]):
   - **1 · un cambio de presupuesto que no es decisión del Media Buyer no se ve** (por chat, `proponer_presupuesto_*` en
     `lib/api-mako/areas/ads.run.ts`, o la tabla): `presupuestoYaCambiado` (`lib/media-buyer/topes.ts`) mira sólo decisiones,
     así que «el mismo % sobre el de hoy» puede componer con un cambio a mano, y el piloto lo hace sin que nadie lo vea. Es el
     diseño de antes («subir 20%, no llevarlo a 60»): decidir si comparar contra el presupuesto de cuando se propuso.
   - **2 · la mezcla de tácticas es por táctica, no por campo** (`mezclarTacticas`, `lib/media-buyer/tacticas.ts`): una pestaña
     vieja que cambia el estado de un agente pisa los umbrales o las campañas que otro cambió en ESA táctica. Arreglo: mezclar
     campo por campo (estado, parametros, campanas) y que el panel mande sólo `{ estado }`.
   - **9 · los agentes propios gastan IA de más** (`lib/media-buyer/corrida.ts` → `propuestasDeAgentesPropios`, antes de
     calcular los lugares): con el cupo lleno por el motor, a un agente se le pregunta en cada corrida y su respuesta se
     descarta. Arreglo: no preguntar si `lugares` ya es 0, o anotar que el agente miró hoy aunque no entre.
   - Y un efecto del freno de ×5 de la falla 4: una baja deliberada de 80% o más ya no se puede hacer desde MaKo (el mensaje
     culpa al separador de miles). Después, Campañas y Biblioteca con el mismo árbol (capturas 8 y
   9). Sigue: Protect, Ajustes y Automatizaciones con esta densidad.
3. **Lo que quedó sin hacer:** filmar SOLO el hook nuevo (depende del puente a Flow, que corre en el navegador del cliente):
   hoy «Filmarlos en Video Generator» deja cada hook + el cuerpo del ganador como guion en la celda «Hooks del Media Buyer»
   y se filma desde ahí; `validate_only` por el token de Meta; el Stop Loss intradía; la API de MaKo para «subir creativos»
   (los archivos los sube el navegador al staging: anotado en `FALTA` de `tests/media-buyer-api.test.ts`); y borrar las rutas viejas de `app/api/ads-manager/*` que sólo usaba la
   vista borrada (`creative-signurl` SÍ se usa: la subida del Media Buyer).
4. **El nombre en la barra** sigue «Ads Manager» (`app/_components/nav.ts` es del chat Sidebar): si Martín quiere «Media
   Buyer», se lo pide el Cerebro a ese chat.

## Rojos de main que no son de esta rama

`tests/zernio-sin-respaldo.test.ts` (la clave de la plataforma para el ws de la plataforma en `lib/zernio-ads.ts`, que ya
estaba en main) y dos de `tests/operaciones.test.ts` (Ops Center). Medidos el 25/10 con la rama; las líneas que marcan
son de main. Más tarde, el mismo 25/10: `tests/ops-center-estrella-desde.test.ts` y `tests/ops-sin-silencio.test.ts` (Ops
Center), y en `tests/zernio-conectar-redes.test.ts` la aserción de `errorDeVentana` (espera una línea que ningún archivo
tiene, también en main). Esa noche, `tests/dashboard-focus.test.ts` (la tira de hojas del editor del Dashboard: el test y
`app/dashboard/` son iguales en `origin/main`).
