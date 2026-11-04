# Relevo — Un solo coach: el Funnel Coach con la oferta adentro (sesión en la nube, 4/11/2026)

Pedido de Martín, textual: «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach" y que tenga ambas
funcionalidades dentro... Por defecto, que esté la cara de hormozi.»

**Estado:** subido a `punta/funnel-coach-unico`. Llega sola a `main` si `punta.yml` da verde; «en producción» es recién con el
deploy de Vercel en «Ready». **Sin migraciones**: lo elegido vive en `app_settings` (`coaches.referentes`), y lo nuevo se guarda al
lado de lo de antes. Lo que cambió y por qué, en `docs/hallazgos-ops-center.md` → «Juntar dos coaches».

## Qué quedó

| Qué | Dónde |
|---|---|
| Un solo coach, «Funnel Coach», en la computadora y el teléfono, para el cliente y el super admin. El Offer Coach no aparece en ninguna pantalla ni en la API (un test lo frena). | `app/second-brain/ChatSecondBrain.tsx`, `app/m/second-brain/ChatClienteM.tsx`, `app/m/operaciones/ChatsMovil.tsx`, `app/m/second-brain/HojaDelCoach.tsx` (nuevo) |
| El coach trabaja primero la oferta (la mira, la arma si falta y la guarda) y después el funnel, el presupuesto y el plan. En un chat, sin modos. | `lib/asesores/contexto.ts` → `FASES_DEL_COACH` |
| Sus seis herramientas (`listar_ofertas`, `ver_analisis_oferta`, `guardar_oferta`, `calcular_presupuesto_anuncios`, `ver_plan_funnel`, `guardar_plan_funnel`) viajan siempre, dentro de los 12.000 caracteres. Se sacó la pista que les quitaba el lugar a las demás. | `lib/doer-herramientas.ts` → `propias`, `HERRAMIENTAS_DEL_COACH` |
| Hormozi de fábrica. Quien ya eligió conserva lo suyo: gana lo del Funnel Coach; si sólo eligió en el Offer Coach, esa. | `lib/asesores/catalogo.ts` → `referenteDelCoach` |
| Las conversaciones de oferta de antes cuelgan del Funnel Coach y se siguen con su motor, con la cara del mismo referente. La charla con Hormozi de antes queda en la lista de gurús. | `ChatSecondBrain.tsx`, `ChatClienteM.tsx`, `app/api/offer/route.ts` |
| Quien armó su oferta en una conversación de oferta (aunque no la haya guardado) no vuelve a empezar. | `lib/offer-sesiones.ts` → `hayOfertaArmada`, `lib/funnel-plan.ts` → `hayOfertaParaElCoach` |
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
3. Con oferta: dice «Tu oferta ya está cargada…». «Tengo 1000 dólares por mes para anuncios»: tiene que usar la calculadora.
4. Tocar la criatura: elegir a otro (y a «MaKo»), recargar y ver que quedó. Abrir una conversación de oferta: lleva la misma cara.
5. En el teléfono (`/second-brain` desde un celular, ws 3): la fila «Funnel Coach» abre su hoja; tocar su cara deja elegir quién
   aconseja ahí adentro; «Ver el plan» y «Second Brain de Hormozi» abren adentro de la hoja.

## Lo que hay que medir con la base (una sesión local, sólo lectura)

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

- `tests/funciones-mako.test.ts` (6): `wsEnContexto is not a function` al cargar `lib/api-mako/link.ts`.
- En la nube, `scripts/tests-afectados.mjs` marca tandas rojas «sin el pie del runner» porque node no ve `MAKO_ACCION_TOOLS` de
  `lib/mako-doer-acciones.ts` como ESM (lo mismo anotó `docs/relevo/nube-gurus.md`).
