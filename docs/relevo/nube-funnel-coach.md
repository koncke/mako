# Relevo — Un solo coach: el Funnel Coach con la oferta adentro (sesión en la nube, 4/11/2026)

Pedido de Martín, textual: «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach" y que tenga ambas
funcionalidades dentro... Por defecto, que esté la cara de hormozi.»

**Estado:** el coach único está en `main` (`26c02b09d`, corrida 150 verde). El ticket #57 (abajo) también: `63cb70bad` + la mezcla
`afafba2d7` llegaron a `main` en `77e84c868` (4/11, 14:38 UTC). La primera corrida (165) dio verde en tests y tipos y rebotó al llevarla
a main: en el medio, main le había puesto un `<div className="gr-hilo">` al hilo del grupo en la misma línea que el menú de «Reportar».
Se mezcló main, quedaron las dos cosas, y la segunda llegó sola. El ticket se cierra con el deploy por el hito `tickets: [57]`. El ws 9
es de Martín: no hay grupo de cliente al que avisar.

**Para el Cerebro (el mensaje desde la nube no se entregó: «elevated_session_untrusted_device»):** ese era todo el resultado del #57.
Y para Infra: el pre-push de la nube corre con el Node 22 del contenedor. Al mezclar main, el filtro tomó 151 tests de lo que trajo
main y dio 12 rojos falsos: `mako-no-puedo-falsos` y `onboarding-hilo-carrera` abren un node hijo con mocks ESM, se rompen con el 22 y
tumban su tanda entera. Con `PATH=/opt/node24/bin:$PATH`, el Node de `punta.yml`, pasan los 12 y el push salió sin saltear el filtro. **Sin migraciones**: lo elegido vive en `app_settings` (`coaches.referentes`), y lo nuevo se guarda al
lado de lo de antes. Lo que cambió y por qué, en `docs/hallazgos-ops-center.md` → «Juntar dos coaches».

## Qué quedó

| Qué | Dónde |
|---|---|
| Un solo coach, «Funnel Coach», en la computadora y el teléfono, para el cliente y el super admin. El Offer Coach no aparece en ninguna pantalla ni en la API (un test lo frena). | `app/second-brain/ChatSecondBrain.tsx`, `app/m/second-brain/ChatClienteM.tsx`, `app/m/operaciones/ChatsMovil.tsx`, `app/m/second-brain/HojaDelCoach.tsx` (nuevo) |
| El coach trabaja primero la oferta (la mira, la arma si falta y la guarda) y después el funnel, el presupuesto y el plan. En un chat, sin modos. | `lib/asesores/contexto.ts` → `FASES_DEL_COACH` |
| Sus seis herramientas (`listar_ofertas`, `ver_analisis_oferta`, `guardar_oferta`, `calcular_presupuesto_anuncios`, `ver_plan_funnel`, `guardar_plan_funnel`) viajan siempre, dentro de los 12.000 caracteres. Se sacó la pista que les quitaba el lugar a las demás. | `lib/doer-herramientas.ts` → `propias`, `HERRAMIENTAS_DEL_COACH` |
| Hormozi de fábrica. Quien ya eligió conserva lo suyo: gana lo del Funnel Coach; si sólo eligió en el Offer Coach, esa. | `lib/asesores/catalogo.ts` → `referenteDelCoach` |
| Las conversaciones de oferta de antes cuelgan del Funnel Coach y se siguen con su motor, con la cara del mismo referente. La charla con Hormozi de antes queda en la lista de gurús. | `ChatSecondBrain.tsx`, `ChatClienteM.tsx`, `app/api/offer/route.ts` |
| Quien armó su oferta en una conversación de oferta (aunque no la haya guardado) no vuelve a empezar, y el saludo dice CUÁL usa (ticket #57). | `lib/offer-sesiones.ts` → `ofertaArmada`, `lib/funnel-plan.ts` → `ofertaDelCoach` |
| El motor del coach es uno para la computadora y el teléfono. | `app/second-brain/useChatDelCoach.ts` (nuevo) |

**Links viejos:** nunca hubo una URL del Offer Coach (su fila abría `?guru=<referente>`, que sigue abriendo ese gurú). La tab
`/offer` es la pantalla de Offer, no el coach: se queda como estaba, porque la abren el CRM («Analizar oferta»), las aperturas y
links guardados, y ahí se crean los análisis con PDF. Si Martín quiere que `/offer` lleve al Funnel Coach, es otra decisión: hay
que mudar antes el análisis con PDF.

## Qué probar en producción (en el ws 3, nunca en el ws 1)

1. Ops Center del ws 3 como admin: debajo del Ops Center hay UNA fila «Funnel Coach» con la cara de Hormozi y «Inspirado en Alex
   Hormozi». No hay fila de Offer Coach. Las conversaciones de oferta (si las hay) cuelgan de ella.
2. Abrirlo sin oferta guardada ni armada: dice «Empecemos por tu oferta…». Contestar qué vende y a cuánto: tiene que preguntar de a
   una y, al decirle «guárdala», proponer `guardar_oferta` con su tarjeta.
3. Con oferta: dice «Voy a usar tu oferta «…». Si no es esa, dime cuál.» y pregunta el presupuesto. «Tengo 1000 dólares por mes para
   anuncios»: tiene que usar la calculadora. «No, es la otra»: tiene que buscarla con `listar_ofertas`.
4. Tocar la criatura: elegir a otro (y a «MaKo»), recargar y ver que quedó. Abrir una conversación de oferta: lleva la misma cara.
5. En el teléfono (`/second-brain` desde un celular, ws 3): la fila «Funnel Coach» abre su hoja; tocar su cara deja elegir quién
   aconseja ahí adentro; «Ver el plan» y «Second Brain de Hormozi» abren adentro de la hoja.

## Ticket #57 (4/11/2026, `punta/ticket-57`)

Martín, en el ws 9: «Debajo del mensaje de funnel coach me aparecia un botón de "reportar" eso no tiene sentido...», sobre «Tu oferta ya
está cargada. ¿Cuánto puedes invertir por mes para conseguir clientes?».

- **«Reportar» salió de debajo de cada mensaje** (era `ReportarRespuesta` en `app/_chat/HiloMako.tsx`, la misma pieza en todos los chats
  con MaKo). Lo había puesto el chat de Tiendas el 3/11 porque Play pide denunciar una respuesta de IA sin salir de la app: por eso NO se
  borró, se mudó al **menú del mensaje** (clic derecho o mantener apretado) con `reportable` en `MenuMensajeWA`. Los chats de Claude Code
  del super admin no lo tienen. Si Martín lo quiere fuera también del menú, es otra decisión: choca con lo que pide Play.
- **El saludo decía «ya está cargada» sin haber leído nada:** `hayOfertaParaElCoach` (mío, del mismo día) tomaba «no pude leer» como «hay».
  Ahora son tres estados (`ofertaDelCoach`) y con una oferta dice cuál y de dónde: guardada, la del perfil del negocio (la que se siembra
  sola con el nombre del onboarding, `desde_brief`) o la armada en una conversación sin guardar. El contexto del coach dice lo mismo.
- **Lo que no se pudo saber desde la nube:** cuál de las dos cosas le pasó al ws 9 (una lectura que falló, o una oferta sembrada desde
  su perfil). La consulta, abajo.

## Lo que hay que medir con la base (una sesión local, sólo lectura)

Para el ticket #57: qué oferta tiene el ws 9 y de dónde salió (si `desde_brief` es true, la sembró el onboarding con el nombre del perfil;
si no hay filas ni conversaciones con conclusiones, lo que vio Martín fue una lectura que falló):

```sql
select id, nombre, desde_brief, origen, es_principal, activa, created_at from ofertas where workspace_id = 9 order by es_principal desc, orden, id;
select id, titulo, jsonb_array_length(conclusiones) as versiones, updated_at from offer_sesiones where workspace_id = 9 and conclusiones <> '[]'::jsonb order by updated_at desc limit 5;
```


Cuántos negocios quedaron con lo único que no se puede distinguir (`{"funnel":null,"offer":"hormozi"}`: o eligió MaKo en el Funnel
Coach o eligió Hormozi en el Offer Coach). Sale Hormozi; si alguno había elegido MaKo, se le vuelve a poner tocando la criatura:

```sql
select workspace_id, value from app_settings where key = 'coaches.referentes' order by workspace_id;
```

## Lo que no se hizo

- **La capa `pm` no tiene la tab Offer**: ahí el coach habla de la oferta sin poder guardarla. No se tocó el gating (qué compra
  cada plan es de Martín).
- **`proponer_crear_campana` (4.129 caracteres) no entra** en un pedido de hacer del coach cuando también se nombra el presupuesto: el
  coach nombra el Ads Manager. Si molesta, se achica su descripción o se suma a las fijas sacando otra.
- **Sin ver en la app corriendo**: la nube no tiene base ni sesión. Los tests corren el turno real de herramientas y el resto se
  mira leyendo el código.

## Rojos que ya estaban en `main` (medidos en un árbol limpio de `origin/main`)

- `tests/funciones-mako.test.ts` (6): `wsEnContexto is not a function` al cargar `lib/api-mako/link.ts`, **sólo con Node 22**: con Node 24
  (el de Actions, `/opt/node24/bin`) da verde.
- En la nube, `scripts/tests-afectados.mjs` marca tandas rojas «sin el pie del runner» porque node no ve `MAKO_ACCION_TOOLS` de
  `lib/mako-doer-acciones.ts` como ESM (lo mismo anotó `docs/relevo/nube-gurus.md`).
