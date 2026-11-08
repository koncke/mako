# Encargo: SuperAdmin — 12 pendientes (7/11/2026)

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

### 1. Sin probar en Admin: «Cargar pago», devolver y eliminar con datos reales

_plata · chico · ⟳ estaba anotado 2 veces_

El Cerebro lo dejó anotado como «sin probar». La 0408 ya está aplicada, así que «Cargar pago» debería registrar el pago en el CRM; hasta que se pruebe, no se sabe.

**Dónde:** `C:/dev/wt-puntas/app/admin/ ; docs/relevo/cerebro.md:31`

<details><summary>Las otras formas en que estaba escrito</summary>

- «Cargar pago», devolver y eliminar en Admin, sin probar con datos reales
</details>

### 2. Admin: Runway con la foto del 3/10, el mazo viejo sin borrar y el historial congelado

_plata · mediano · ⟳ estaba anotado 2 veces_

Actualizar capital y fechas del runway (o que mande Strategy); borrar Mazo.tsx, Tablero.tsx y sus rutas-puerta (/tickets/decisiones, /admin/runway) con sus tests, que ya nadie dibuja; el registro de todo lo que hace cada usuario, que Martín pidió y nadie tomó; el historial de /admin/dev congelado al 11/10. Y el arreglo pendiente de la copia de Polar: `porCobrar` le pone a Código 4/12 por US$238 y lo real es 5/12 por US$426.

**Dónde:** `app/admin/runway/datos.ts · app/tickets/decisiones/Mazo.tsx · app/admin/runway/Tablero.tsx · docs/relevo/pendientes-barrido.md §«Para OTROS chats» → Admin · docs/relevo/cerebro.md:85`

<details><summary>Las otras formas en que estaba escrito</summary>

- Restos de Admin: Runway con foto vieja, el mazo viejo y el registro de acciones
</details>

### 3. El Ops Center: etapa 2 (la cuota) y etapa 3 (el señalador) sin empezar

_plata · grande_

Las dos etapas del Centro de Operaciones quedaron escritas y sin hacer. Hecho = la cuota se ve y el señalador funciona.

**Dónde:** `C:/dev/wt-puntas/app/admin/operaciones/ · C:/dev/wt-puntas/docs/relevo/centro-operaciones.md · pendiente en C:/dev/wt-puntas/docs/hallazgos-operaciones.md:2340`

### 4. Customers: seis pendientes de la ficha de un negocio

_plata · grande_

El MRR mes a mes de verdad (hoy se dibuja lo cobrado; el histórico pide una foto por día que nadie guarda); las fichas de agencia con sus clientes adentro; administrar desde el teléfono; pasar onboardingsHechos y leadsDe a leerPorPaginas (con más de 1000 negocios la primera corta en silencio); Activity por negocio dentro de su ficha; y marcar la entrada de una agencia (/api/agencia/entrar) en la fila del cliente para que un cliente de agencia pueda entrar en «Sin uso». Hecho = los seis verificados en /admin.

**Dónde:** `C:/dev/wt-puntas/lib/clientes-plataforma.ts · app/admin/ · app/api/agencia/entrar · pendiente en C:/dev/wt-puntas/docs/hallazgos-customers.md:255`

### 5. El encargo de rehacer la tab Customers como «Admin» (5/11) no lo tomo nadie y ninguna familia lo leyo

_plata · grande_

`docs/relevo/admin-encargo.md` es un encargo completo del Cerebro, escrito el 5/11 para una sesion de la nube, y no figura en ninguno de los items que trajeron las siete familias. Pide seis bloques: Actividad (quien se conecta y quien dejo de entrar), Uso por tab y por negocio, Errores y tickets, Ingresos (total por cliente, mes a mes, MRR, movimientos, sumando pasarela MAS lo cobrado a mano), Cobros (suscripciones, deudas, proximos, recibos) y Usuarios (alta, suspender, inspeccionar). Sigue sin empezar: `app/customers/` esta entera y `SECCIONES_ADMIN` todavia arranca con 'customers'. La medicion que lo acompana (`admin-medicion.md`, 153 lineas) tampoco se leyo. Hecho = la tab se llama Admin y los seis bloques muestran los numeros de la medicion.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/admin-encargo.md · C:/dev/wt-puntas/docs/relevo/admin-medicion.md · C:/dev/wt-puntas/app/customers/ · C:/dev/wt-puntas/app/_components/nav.ts:225 (SECCIONES_ADMIN)`

### 6. La tab de Admin le muestra a Martin «Lo que entro este mes · US$0» y un texto que es falso

_plata · mediano_

Medido el 5/11 contra produccion: `lib/clientes-plataforma.ts` calcula el MRR solo con filas de `cobros` que tengan `alta_ws` o `cliente_ws` y esten `activa`; las 2 filas que hay no cumplen ninguna de las dos, asi que MRR = 0 y «pagan» = 0. El numero grande que se ve es el del mes en curso, no el cobrado ni el MRR. Y el texto de «sin plata» dice «tus clientes tienen el plan dado a mano» cuando no hay ni una fila `plan.a_mano` en `app_settings`: es una frase falsa en pantalla. Lo cobrado de verdad son US$578 (Leila 97, Codigo 146 + 238 sin cargar, Florencia 97). Hecho = el numero grande dice que es, el MRR cuenta lo manual, y el texto de vacio no afirma algo que la base no dice.

**Dónde:** `C:/dev/wt-puntas/lib/clientes-plataforma.ts (`cobrosDeLugares`, `factura`, `cuotasDeLaPlataforma`) · C:/dev/wt-puntas/app/customers/ (CustomersApp, bloque «Plata») · C:/dev/wt-puntas/docs/relevo/admin-medicion.md §1`

### 7. Faltan los hitos en las bitácoras de /admin/dev de varias áreas

_feature · chico_

Dashboards, Carruseles y Recorrido visual no escribieron su hito porque el brief prohibía tocar app/admin. Los commits y el pedido textual de Martín están en cada relevo, listos para pegar. El Copywriter además no es un área de /admin/dev (ningún `vive[]` declara app/copywriter) y Offer no tiene bitácora.

**Dónde:** `C:/dev/wt-puntas/app/admin/dev/dashboard/bitacora.ts ; app/admin/dev/admin/bitacora.ts ; docs/relevo/nube-dashboards.md:49-50 ; docs/relevo/nube-recorrido-visual.md:81-83`

### 8. Tres arreglos del recorrido visual en Admin que ningún chat tocó

_feature · chico_

SB1: la caja dice «Escribe a Chat nuevo» (app/admin/operaciones/Conversacion.tsx:250 y PiezasCliente.tsx:179). CU1 y CU2: las cuentas de prueba cuentan como clientes, y «Nuevos en 30 días» y «Para mirar» tienen alcances distintos sin decirlo. Quedaron fuera porque el brief decía «No toques Admin».

**Dónde:** `C:/dev/wt-puntas/app/admin/operaciones/Conversacion.tsx:250 ; app/admin/operaciones/PiezasCliente.tsx:179 ; lib/clientes-plataforma.ts:164 ; lib/customers-vista.ts:74,78`

### 9. Avisarle al jefe «Sidebar» que /admin pliega la barra de MaKo

_feature · chico_

/admin pliega la barra como el Ops Center (`pliegaLaBarra` con `SECCIONES_ADMIN`, exportada de app/_components/nav.ts). No cambia las familias ni el menú, pero el jefe Sidebar tiene que saberlo.

**Dónde:** `C:/dev/wt-puntas/app/_components/nav.ts (SECCIONES_ADMIN, pliegaLaBarra) ; docs/relevo/nube-admin-polar.md:131-132`

### 10. El agente del Marketing CoPilot nunca se probo con IA real

_feature · chico_

Hay 14 conversaciones escritas para probarlo. Hecho = las 14 corridas con IA real y su resultado anotado.

**Dónde:** `docs/marketing-copilot/conversaciones.md · docs/relevo/cerebro.md:31`

### 11. Lo que hace cada persona no se dibuja en la ficha de su negocio (Customers)

_feature · mediano_

`vistaDeActividad` ya trae la actividad por negocio; falta pintarla en la ficha. Y queda la opción de Usage como pestaña aparte (hoy vive dentro de Activity, copiado de PostHog): si Martín la quiere aparte, son las mismas cuentas en otra pestaña.

**Dónde:** `C:/dev/wt-puntas/lib/admin-actividad (vistaDeActividad) ; app/admin/ ; docs/relevo/nube-admin.md:80-86`

### 12. Ops Center: nada se miró en la app de verdad, con la sesión de Martín

_feature · mediano_

Falta la sesión de un invitado real (requireMovil; Joan y Juanfran: si comparten fila en usuarios no se puede invitar a los dos), el push tocado en un Android, y el ?ws= de WsFetch contra las rutas del grupo. Hecho = recorrido con la sesión real y lo visto anotado.

**Dónde:** `C:/dev/wt-puntas/app/_chat/grupo/HiloDelGrupo.tsx · app/admin/operaciones/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-ops-center.md:120`
