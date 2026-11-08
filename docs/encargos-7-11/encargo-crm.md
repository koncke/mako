# Encargo: CRM — 20 pendientes (7/11/2026)

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

### 1. El botón «Editar» de la ficha no se pudo sacar y de él cuelgan siete cosas sin otro lugar

_plata · grande_

Darle al DealDetailsCard su propio modo de edición dentro de la pestaña Pagos, y recién entonces mudar motivo de pérdida, deadline de nutrición manual, fecha de agendamiento, links de Fathom R1/R2, «Borrar lead» y la confirmación con el diff a lugares donde se lean. Hecho = el botón se puede borrar sin perder la edición del deal.

**Dónde:** `C:/dev/wt-puntas/app/crm/[id]/DealDetailsCard.tsx (799 líneas, prop `editing`) · app/crm/[id]/EditLeadForm.tsx · app/crm/LeadSheet.tsx:211 y :327 · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:7709`

### 2. /crm/prospectos no tiene pantalla en MaKo Mobile, y buscar/pasar al CRM no está en la API

_plata · mediano_

Página de prospectos en /m, y las escrituras de la API (buscar cuesta plata, pasar escribe en lote: piden pantalla propia). Hecho = en un teléfono se abre prospectos sin la cubierta de «se usa en la computadora».

**Dónde:** `C:/dev/wt-puntas/app/m/crm/ · lib/api-mako/areas/crm.def.ts (listar_prospectos, busquedas_prospeccion) · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:10031`

### 3. El encargo de la suscripcion en la ficha del lead y la vista de edicion (5/11) tampoco lo tomo nadie

_plata · grande_

`docs/relevo/suscripciones-ficha-encargo.md` y su medicion (`suscripciones-medicion.md`, 110 lineas) no aparecen en ningun item de la lista. Lo pedido: que la ficha aguante una mensualidad que CAMBIA mes a mes (el caso real de Codigo Inmobiliario: 146 en octubre, 238 en noviembre en dos pagos) y una «vista de edicion» de las pestanas del detalle sin perder la personalizacion. Medido: produccion tiene 15 leads `suscripcion` (3 del ws9, 12 del ws11); los 3 del ws9 tienen `suscripcion_monto_usd` y `suscripcion_meses` en NULL aunque estan en Ganado y pagaron; el lead de Florencia tiene `cliente_ws` en null, asi que su pago no se puede atribuir por dato. Hecho = los 3 leads del ws9 con su monto, y el caso de Codigo entrando sin explicar nada.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/suscripciones-ficha-encargo.md · C:/dev/wt-puntas/docs/relevo/suscripciones-medicion.md · C:/dev/wt-puntas/app/crm/lead-view/ficha/pagos/bloques-cobro.tsx:54,497,756`

### 4. El anuncio programado (la mitad que falta de la promesa 5a)

_traba · grande · ⟳ estaba anotado 2 veces_

Hoy una campaña nace EN PAUSA (`proponer_crear_campana`) y no hay «fecha de inicio». El camino recomendado: enlazar el evento Anuncio a una campaña en pausa del Media Buyer y, a la hora del evento, un cron la prende por `lanzar` (zona, fecha de fin, topes), con la misma revisión adversarial de todo lo que gasta. La alternativa (pasarle a Meta un `start_time`) depende de que Zernio lo acepte y eso no está medido.

**Dónde:** `C:/dev/wt-puntas/lib/media-buyer/ejecutar.ts (lanzar) ; docs/relevo/nube-thiago-migrar.md:51-55`

<details><summary>Las otras formas en que estaba escrito</summary>

- Programar un ANUNCIO desde el Calendario no existe
</details>

### 5. faltantesParaMover decide con hoyEnTijuana() fijo: bloquea o destraba a MaKo un día antes o después

_traba · mediano_

Pasar el gating a la zona del workspace (no es display: decide si una reunión «ya pasó» y si se exige asistencia o Fathom). Hecho = para un workspace en Madrid el borde del día es el suyo.

**Dónde:** `C:/dev/wt-puntas/lib/leads.ts:1570 · lib/date-utils.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-ia.md:1971`

### 6. Código Inmobiliario: 21 fallos y 10 borradores de WhatsApp sin investigar

_feature · chico · ⟳ estaba anotado 2 veces_

El relevo de `crm-bajas-3010` lo deja escrito y dice «puede ser error nuestro». Hay que leer `errores_app` y `wa_borradores` del ws 13 y decir qué pasó. Es de un cliente que paga.

**Dónde:** `docs/relevo/pendientes-barrido.md P15 · docs/relevo/pendientes-0311.md §3 («Código Inmobiliario, sin ticket») · errores_app y wa_borradores del ws 13`

<details><summary>Las otras formas en que estaba escrito</summary>

- P15: Codigo Inmobiliario tiene 21 fallos y 10 borradores de WhatsApp sin mirar
</details>

### 7. «Hacerlo» del chat de MaKo en el CRM puede duplicar entre instancias

_feature · chico_

Reclamar con cambiarSettingSi en la base antes de calcular; hoy el candado EN_CURSO vive en memoria. Hecho = dos pestañas apretando «Hacerlo» crean una sola vez.

**Dónde:** `C:/dev/wt-puntas/lib/sugerencias-crm-server.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:1306`

### 8. Una nota dictada desde el teléfono se recorta a 4000 caracteres en silencio

_feature · chico_

Rechazar con TOPE_NOTA y decirlo en el toast, en vez de cortar antes de llamar al alta (el rechazo del escritorio nunca la ve). Hecho = una nota más larga que el tope da error visible y no se guarda cortada.

**Dónde:** `C:/dev/wt-puntas/app/m/crm/acciones.ts:80 (notaLeadAction, slice(0,4000)) · app/crm/notas-reglas.ts (TOPE_NOTA) · pendiente en C:/dev/wt-puntas/docs/hallazgos-mobile.md:1507`

### 9. saveFunnelAction no valida rol

_feature · chico_

Sumarle el corte de rol como las demás server actions del CRM. Hecho = un closer no puede guardar el funnel.

**Dónde:** `C:/dev/wt-puntas/app/crm/actions.ts:1771 · pendiente en C:/dev/wt-puntas/docs/hallazgos-comunicacion.md:4316`

### 10. El kanban del cliente sigue mostrando las tareas de la Retro y de los experimentos

_feature · chico_

Filtrar en listTareas como ya lo hace «Re-priorizar todo» con esDelPlanCliente. La SPEC lo pedía y ninguna tanda lo hizo. Hecho = el tablero del cliente no muestra tareas de Retro ni de experimentos.

**Dónde:** `C:/dev/wt-puntas/lib/todo.ts (listTareas) · pendiente en C:/dev/wt-puntas/docs/hallazgos-plan.md:2701`

### 11. «Guardar en MaKo» de la extensión nunca se vio en una página real

_feature · chico_

Probar en el Chrome de Martín con un perfil de Instagram y uno de LinkedIn: que el botón aparezca, que el nombre salga bien (sale del título y de las etiquetas «og:»; si no, el campo queda vacío y se escribe a mano) y que el lead nazca con su foto. Después, publicar la 0.77.0.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-thiago-anuncios.md:54-58 ; el manifest de la extensión`

### 12. La busqueda avanzada del CRM, como la del plan

_feature · mediano_

ID, acentos y orden libre ya estan. Faltan elegir campos, la busqueda con IA y la flechita: el `Buscador` sigue siendo un input simple. Martin lo marco como «te lo pedi».

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:178-180 · app/crm/CrmToolbar.tsx:351-362 · lib/buscar-texto.ts`

### 13. Onboarding para inmobiliarias (sin closer, sin R1/R2)

_feature · mediano_

Sin resultados para «inmobil» ni «closer» en `lib/onboarding*` ni `app/onboarding`. Ademas, que nada pida R1/R2 si el negocio no las usa (sacar el «Tipo de evento de R1» obligatorio al conectar Calendly).

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:182-183 · lib/onboarding-crm.ts:1-12 · docs/relevo/pedidos-perdidos-2810.md:86 · lib/calendly-aviso-reglas.ts`

### 14. Los paneles cuentan a un lead migrado el día que se migró

_feature · mediano_

Migrar 5.000 contactos pinta 5.000 «leads nuevos» ese día. Ya se guarda `fecha_original`: contarlo en su fecha es usar `coalesce(fecha_original, created_at)` en los lectores de leads por período.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-thiago-migrar.md:46-47 ; los lectores de leads por período`

### 15. La iniciativa de MaKo en el CRM está sin hacer

_feature · mediano_

Falta la apertura del funnel sin declarar (necesita el canal y el diagnóstico en la estrella, y `declararEntradasAction`), la guía de la ficha del lead (`recorrido-ficha.ts`, `Senalar`), y `/crm?nuevo=1` («Ver los 12») que tampoco existe.

**Dónde:** `C:/dev/wt-puntas/lib/aperturas/ ; docs/mako-iniciativa/plan.md §5 ; docs/relevo/nube-iniciativa.md:38`

### 16. El evento «Calificado» a Meta no es idempotente para lo mandado antes del 17/10

_feature · mediano_

Hacer idempotente el envío a Meta (hoy un lead marcado antes del 17/10 no tiene la línea del historial y volver a marcarlo pasadas las 48 h del dedup de Meta cuenta dos veces). Hecho = volver a marcar un calificado viejo no manda un segundo evento.

**Dónde:** `C:/dev/wt-puntas/lib/leads.ts:922-946 · lib/meta-capi.ts:33 · lib/calificado-reunion.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:7821`

### 17. El onboarding del CRM: la mitad existe y falta la PUERTA, con tres huecos medidos

_feature · grande_

1) Declarar un onboarding con prefijo crm_ en TAB_ONBOARDINGS (sin pantalla que lo complete deja a todos afuera del CRM, que es la primera tab de todos los roles). 2) Que cambiar «cómo vendo» después mueva el funnel (hoy la siembra corre una sola vez y funnels.canal está NULL en los 11 funnels de producción). 3) Montar EntradasCard también en el onboarding y el Segundo Cerebro (entradas está vacío en 6 workspaces con declarado=true). Hecho = un cliente elige su canal en el onboarding del CRM y sus etapas se siembran, y cambiarlo después las mueve.

**Dónde:** `C:/dev/wt-puntas/lib/tab-onboarding-catalogo.ts · lib/fase-diagnostico.ts (CANALES) · lib/pipeline.ts (FUNNEL_TEMPLATES, templateDeCanal) · app/funnel/EntradasCard.tsx · app/api/onboarding/route.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:1479`

### 18. El filtro «Responsable» no existe en el tablero del dueño

_feature · mediano_

Migración aditiva para plan_tareas.responsable_tipo y alguien que lo escriba, más el filtro en el tablero. Hecho = se puede filtrar el tablero del dueño por responsable.

**Dónde:** `C:/dev/wt-puntas/app/plan/board/ · supabase/migrations/ (plan_tareas.responsable_tipo) · pendiente en C:/dev/wt-puntas/docs/hallazgos-plan.md:2701`

### 19. El inbox de WhatsApp tiene su funnel hardcodeado en cuatro copias y es ciego a funnel_config

_feature · grande_

Que las cuatro lecturas usen el funnel configurado. Hoy todos los leads de un cliente que vende por chat quedan en «Abierto» para siempre, y ese label es lo único que recibe whatsapp-advisor. Hecho = el inbox muestra las etapas reales del funnel del negocio.

**Dónde:** `C:/dev/wt-puntas/lib/wa-etapas.ts:48 · app/api/whatsapp/conversations/route.ts:29 · lib/meta-rules.ts:78 · app/whatsapp/WhatsAppApp.tsx:227 · lib/whatsapp-advisor.ts:175 · pendiente en C:/dev/wt-puntas/docs/hallazgos-comunicacion.md:4316`

### 20. Las clases 2 y 4 de las sugerencias de MaKo en el CRM no se hicieron

_feature · grande_

Gestos repetidos (clase 2), «llega algo nuevo» (clase 4), «Perdidos hace 60 a 90 días» y «la etapa donde se cae la mitad». docs/sugerencias-mako-crm.md:4 todavía dice «Nada de esto existe todavía». Hecho = las cuatro sugerencias aparecen y se pueden callar.

**Dónde:** `C:/dev/wt-puntas/lib/sugerencias-crm.ts · C:/dev/wt-puntas/docs/sugerencias-mako-crm.md:4 · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:1306`
