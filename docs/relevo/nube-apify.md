# Relevo — Varias claves de Apify, en la nube (pedido de Martín del 5/11/2026)

Lo escribe la sesión de la nube que hizo el trabajo (cuenta `nube`, sesión `cli_1683f70e-5b48-5c27-a14a-2356d87cc0fe`).
**Esta sesión no puede escribirle al Cerebro:** todo lo que hace falta está acá. La nube no llega a la base ni a Apify: lo de
abajo se probó con las funciones REALES contra un Apify de mentira (tests/_spy-claves-hijo.ts), no con una cuenta de verdad.

## El pedido

> «Dame la opción de tener varias claves de apify» y «dame la opción también en integraciones de cargar más api».

Contexto que trajo el Cerebro: la clave de Spy (`APIFY_INSTAGRAM_TOKEN`, tarjeta `apify-instagram`, por negocio) la usan
Competitors Spy y la biblioteca de carruseles de Image, y se queda sin crédito (el 5/11 la de la plataforma iba en US$8,01 de 10).

## Lo hecho

| Qué | Dónde |
|---|---|
| En la tarjeta de Apify: «Agregar otra clave de Apify (de otra cuenta tuya)» abre la clave y su nombre opcional juntos, hasta 5. Cada una se prueba al guardar, se ve enmascarada, se prueba y se quita con su tacho (lo que ya hacía la tarjeta). Abajo, el crédito del mes de cada una y el total libre. La clave nunca vuelve entera. | `lib/metodo-catalogo.ts`, `app/integraciones/ServicioConfigForm.tsx`, `app/integraciones/CreditoApify.tsx`, `lib/metodo-verificar.ts` |
| Spy (leer un perfil, el lote del buscador, buscar por nombre en Instagram y en Google, sus otras redes, la traída larga, el guion de un reel) usa la primera clave con crédito y pasa a la siguiente cuando Apify contesta «sin crédito». Un 401, un 429 o un corte de red NO saltan: se dicen con el número de la clave. La que se agotó se prueba al final durante 30 minutos. | `lib/spy-claves.ts`, `lib/instagram-perfil-server.ts` (`clavesApifyDeSpy`), `lib/spy-buscar.ts`, `lib/spy-otras-redes.ts`, `lib/spy-todo.ts` |
| La traída larga cuenta la reserva de US$2 sobre el crédito libre de TODAS las claves, no pide más de lo que le queda a su clave, y anota con qué clave empezó cada corrida (su huella), porque sólo esa cuenta la lee. | `lib/spy-todo-reglas.ts`, `lib/spy-todo.ts`, `lib/spy-google-corrida.ts` |
| La biblioteca de carruseles (`estado`, `leer`, `buscar`, `verificar`) dice el crédito de cada clave (número y nombre) y el total, sin imprimir ninguna; si una se agota a mitad, sigue con la siguiente. | `scripts/carruseles-biblioteca.mts` |
| El alta del CRM sigue con la clave 1 sola y Offer no usa ninguna (el guard del scraper retirado lo fija y ahora ve también el lector nuevo). | `tests/leads-scraper-retirado.test.ts` |
| La API de MaKo: `ver_integracion` ya lista los campos nuevos, y `probar_conexion_integracion` contesta el crédito de cada clave (el mismo verificador). No hay operación para cargar claves: eso sigue siendo el link, como toda credencial. | `lib/api-mako/areas/integraciones.run.ts` (sin cambios) |
| Bitácora y cosecha. | `app/admin/dev/integraciones/bitacora.ts`, `docs/hallazgos-integraciones.md` («Varias claves de Apify…») |

**Rama:** `punta/apify-varias-claves` (y la de la sesión, `claude/confident-ptolemy-s5y422`). **Sin migración**: cada clave es
una credencial más del negocio, cifrada como las demás.

**Prueba:** `tests/spy-varias-claves.test.ts` (13 casos; 7 roturas medidas en su cabecera: sin saltar, saltar con cualquier
error, el 429 como crédito, el CRM con todas, la clave en un mensaje, la reserva sin el tope de su clave, el parser sin la huella).
Además, los tests de Spy, de Integraciones y de Zernio que tocan lo mismo, y el chequeo de tipos de todo lo tocado, en verde.

## Lo que falta verificar (en producción, después del deploy)

1. Abrir `/integraciones?abrir=apify-instagram` en el ws 3, agregar una segunda clave con nombre y mirar el bloque «Crédito de
   este mes» (en la computadora y el teléfono). Nadie lo vio en pantalla: la nube no puede levantar la app.
2. En la PC, `node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts estado`: tiene
   que listar las claves de Spy de la plataforma con su crédito y el total, sin ninguna clave.
3. El cuerpo REAL que manda Apify cuando una cuenta se queda sin el crédito del mes (no medido; se usó el
   `not-enough-usage-to-run-paid-actor` que ya tenía el test de la traída). Si viene con otro tipo, va en `esFaltaDeCredito`.

## Lo que quedó sin hacer, con su archivo

- El estado de la tarjeta sale de la clave 1 (`lib/integraciones.ts`, `integracionConectada` mira los campos obligatorios): con la
  1 quitada y la 2 puesta, Spy anda y la tarjeta dice «Sin conectar».
- Los topes por día de Spy (150 lecturas, 60 búsquedas, 6 traídas: `lib/instagram-perfil.ts`, `lib/spy-todo-reglas.ts`) siguen
  siendo POR NEGOCIO: más claves no los suben.
- Una clave recién agregada puede tardar hasta un minuto en usarse en una instancia que ya había leído las claves (la caché de
  las extra, como en Zernio).

## Lo que espera una decisión de Martín

- **¿El alta del CRM también rota?** Hoy usa la clave 1 sola, como pedía el brief («no despiertan el buscador del alta del CRM»).
  Si la 1 se queda sin crédito, el CRM deja de leer el @ por Apify mientras Spy sigue. Cambiarlo es sacar `soloLaPrimera` en
  `lib/instagram-perfil-server.ts` y el assert de `variasClaves` en `tests/leads-scraper-retirado.test.ts`.
