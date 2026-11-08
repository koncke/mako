# Encargo: Tickets — 4 pendientes (7/11/2026)

**Qué es esto.** La lista depurada de pendientes de MaKo: de 634 anotadas el 6/11 quedaron 232 de
trabajo real (`docs/pendientes-depurados-7-11.md`). Éstos son los de tu área, ordenados por el
criterio de Martín: **cliente roto > plata > traba > features**.

## ⚠️ LEÉ ESTO ANTES DE TOCAR CÓDIGO, porque es lo que más tiempo ahorra

El 7/11 se verificaron los cuatro primeros de la lista **y tres estaban ya resueltos**. El
inventario es una foto del 6/11 y entre el 6 y el 7 entraron 601 commits a main.

**Entonces: por cada ítem, PRIMERO verificá contra el código que el síntoma siga existiendo.** Si ya
no existe, escribilo y pasá al siguiente — eso vale tanto como arreglarlo.

Tres trampas medidas ese día, las tres reales:

1. **Un pendiente que enumera «N puntas atadas» envejece punta por punta, no entero.** En «la cadena
   de pago sale del dominio del cliente», tres de cuatro puntas ya estaban hechas y el título seguía
   igual que el primer día.
2. **Un pendiente anotado muchas veces NO es más urgente: es uno que se contó muchas veces.** El más
   repetido del inventario (4 entradas) describía un recuadro gris que se había sacado el día anterior.
3. **Si dice «el número X está mal, debería ser Y», fijate si X e Y son del mismo período.** Uno decía
   «US$238 está mal, es US$426»: eran noviembre y diciembre, los dos correctos. «Arreglarlo» rompía
   noviembre.

## Cómo se entrega

Una punta por tema: `git push origin HEAD:refs/heads/punta/<nombre>`. Llega sola a `main` con verde
(`.github/workflows/punta.yml`). **`integracion` se retiró el 4/11: un push ahí da rojo a propósito.**
No hace falta esperar a que termine la anterior.

⚠️ **«En main» no es «en producción»:** el deploy lo hace un cron a las 11:05 UTC.

Lo que aprendas va a `docs/hallazgos-<área>.md` **en el mismo commit**, y el índice
`docs/hallazgos.md` se actualiza ahí mismo. Sobre todo **cuando el diagnóstico obvio era el
equivocado**: eso es lo que más tiempo ahorra después.

---

### 1. Tickets abiertos sin cerrar ni contestar: #38, #39, #43, #58

_plata · chico_

#38 (Fastlane): sólo se hizo la investigación (docs/funnel-coach.md §9, 2a31f80c5); antes de cerrar, ver si el «link de Fastlane» del reparto es el mismo pedido. #39 (Brigitte, ws 15): 8f19b1229 arregló la alarma, no la causa; leer `errores_app` de ese ticket antes de mandar la respuesta, y no se sabe si ese negocio tiene grupo. #43 (agencia): espera la decisión de Martín. #58 (Joan, por audio): agendar el pago de la segunda cuota de Giselle Belanti para el 19/12; lo trabó el eco y hay que pedírselo de nuevo. Los dos primeros se cierran A MANO: el cron no los toma.

**Dónde:** `docs/relevo/pendientes-0311.md §«Tickets a cerrar y avisar» (con los textos ya redactados) · docs/relevo/cerebro.md:152 · scripts/tickets.ts`

### 2. Tickets abiertos sin cerrar: #38 (Fastlane), #39 y #43

_feature · mediano_

Figuran abiertos en el relevo del 4/11 y ninguno aparece cerrado despues. El #38 esta ademas en la lista de decisiones de producto de Martin.

**Dónde:** `docs/relevo/cerebro.md:152 · docs/relevo/pendientes-barrido.md:188`

### 3. Los tickets sin cuenta no tienen dónde guardar «no me escribas»

_feature · mediano_

Un ticket que entra por WhatsApp sin perfil, o de un alumno de un curso, no tiene dónde anotar la baja de los correos. Si hace falta, se necesita una tabla de bajas por email, o sea una migración. Quedó afuera a propósito. Aparte: falta una casilla en Notificaciones para prender y apagar los correos de avance (hoy sólo desde el link del correo, que también los vuelve a prender).

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-tickets.md:33-38 ; lib/tickets`

### 4. La foto de quien levanta un ticket puede ser CUALQUIER https

_feature · mediano_

avatarUrl se guarda sin filtro, así que un cliente que pone una URL suya se entera de cuándo Martín abre la Ticketera (y su IP). Arreglarlo es aceptar sólo el storage propio y Google, para toda la app. Hecho = una foto de perfil externa se rechaza.

**Dónde:** `C:/dev/wt-puntas/lib/perfil.ts (setPerfil, avatarUrl) · lib/tickets-db.ts (aFila) · pendiente en C:/dev/wt-puntas/docs/hallazgos-ticketera.md:642`
