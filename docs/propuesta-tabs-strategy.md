# De la tab Strategy a tabs que funcionen (10/10/2026)

> Propuesta, sin construir nada. Sale de la corrida `wf_01c22b1b-91a` (6 lectores, 1 diseñador y
> 3 refutadores contra el código y la base de producción, sólo lectura). Lo que aprendieron va
> a los `docs/hallazgos-*.md` de cada área; acá va sólo lo que tenés que leer para decidir.

## Lo primero: el bloqueo no es de pantallas

**Hoy Strategy no lee nada de la base.** Cada número sale de una foto escrita a mano (el runway
del 03/10) o de un supuesto (el modelo de costos). Para que una tab sea real, MaKo tiene que
usar su propio CRM, y el workspace de MaKo está vacío:

| En el workspace de MaKo | Hoy |
|---|---|
| Ventas cargadas | 3 ganados del 26/09, **sin monto** y sin producto |
| Pagos | **0** |
| Pauta de Meta | **0** filas (falta la cuenta publicitaria, y el token no trae permiso de anuncios) |
| Visitas a la landing | **0** (la landing no manda sus visitas al workspace de MaKo) |
| Agendas | **0** (el Calendly `koncke/asesoria` no está conectado a MaKo) |
| Línea de WhatsApp | **nunca conectó** |
| Objetivos | **0** |

Las pantallas que miden todo eso **ya existen y andan** con los clientes: Graphics
(`/marketing`, `/comercial`), Análisis (`/analisis`, con la proyección hecha con tasas
**medidas**) y `/general`. Lo que falta es meterle datos a MaKo.

Y lo medido ya desmiente los supuestos de la tab. En el ws1, el que más datos tiene, asiste el
**50,8%** (la tab dice 80%) y cierra el **41%**. Cada agenda cuesta unos **US$98** (la tab dice
125). En octubre la IA costó **US$0** (la tab usa US$10,90).

## Las tabs, de un vistazo

| | Tab | Para quién | Dónde | Cuándo |
|---|---|---|---|---|
| 1 | **Números de MaKo** | vos | Graphics + Análisis **en el workspace de MaKo** (no es tab nueva) | **Ahora** |
| 2 | **¿Qué es MaKo?** | vos | tab nueva en Admin, al lado de Strategy | **Ahora** |
| 3 | **Runway** | vos | `/admin/runway`, a la barra de Admin | **Ahora** (chico) |
| 4 | **Objetivos** | vos primero, después cada cliente | `/general`, que ya es FOCUS (no tab nueva) | Después del lanzamiento |
| 5 | **Referidos** | todos | menú del avatar | Después (con pasarela y ventas referidas) |
| 6 | **Mis gráficos** (el selector) | todos | tercera sub-tab de Graphics | Después |
| 7 | **Margen por oferta** (las tortas) | vos | tab en Admin, no en Dev | Después |
| ✕ | Experimento del Loom · «Mi plan» del cliente · Precios públicos | — | — | No se hacen |

«Ahora» es lo que hace falta para medir la ventana del 1/11 al 15/12. Todo lo demás no pasa la
poda: es bueno, pero no es indispensable para vender.

---

## 1. Números de MaKo — ahora

**Qué contesta:** cuánto vendió y cobró MaKo en la ventana, cuántas agendas, asistencias y
cierres trajo cada canal, cuánto costó cada cliente, y cuánto falta para los US$15.000 con las
tasas reales.

**No hay que construir la pantalla:** es `/comercial` (Sold, Cash, CAC, cohortes) y `/analisis`
(«Para llegar a la meta», con `?desde&hasta&cierres&presupuesto`), mirando el workspace de MaKo.

**Falta, operativo (sin código, necesita tu OK):**
- Cargar en el CRM de MaKo cada venta de la ventana, con su producto y sus cuotas. Para eso,
  las ofertas que se venden en la ventana, cargadas como productos. Los 3 de septiembre quedan
  fuera del rango: no hace falta tocarlos (y 2 son sin cobro).
- Conectar el Calendly `koncke/asesoria` a MaKo: token, signing key y el nombre exacto del evento.
- Pegar el Pixel en la landing de MaKo, apuntando a su propio workspace.
- La cuenta publicitaria `act_1426493815659364`. ⚠️ El token de MaKo no tiene permiso de
  anuncios hasta que Meta apruebe la verificación de acceso (enviada el 08/10, sin fecha). Es
  externo y tiene que llegar antes del 1/11.
- ⚠️ **La línea de WhatsApp de MaKo nunca conectó.** La campaña de mensajes trae 16 de las 26
  agendas proyectadas, y sin línea no entra a ningún CRM.
- Un link de agenda con `utm_source` por canal, para separar la prospección de la campaña.

**Falta, código chico:**
- `graphics`, `analisis` y `general` en la capa del super admin (`lib/capas.ts:280`). Por URL ya
  entran; en la barra no están.
- `/comercial` ignora un rango que termine después de hoy, y sin avisar vuelve a los últimos
  30 días (`app/comercial/page.tsx:164-170`). Hasta el 15/12, el rango de la ventana no anda.
- El CAC acumulado no acepta «desde» (`lib/queries.ts:701`). En MaKo hoy muestra **US$0**
  (0 de pauta ÷ 3 cierres) como si fuera un dato.

## 2. ¿Qué es MaKo? — ahora, para vos

**Qué contesta:** qué vendemos, a quién, a cuánto y qué incluye cada oferta.

**MVP:** se mudan la 01 (producto y cliente ideal) y la 02 (oferta), y la tabla de columnas
«de app»: **47 · 97 · grupal 1.500 · 1 a 1 10.000**. Esa grilla ya está dibujada en
`/admin/dev/pricing` (parte 4) y se reusa corregida: sin la columna Free, con la agencia
dentro del 97, y con el 1 a 1 a 10.000 (`modelo.ts:867` todavía dice 4.000).

**Los precios no son una pregunta:** el 10/10 quedaron 47 y 97, el grupal a 1.500, el 1 a 1 a
10.000 y la agencia dentro del 97. Lo que hay que corregir es lo viejo que sigue escrito:
- Las tareas **#771, #783 y #840** todavía citan el precio del 20/09 («el 47 deja de existir»,
  49/400). Hay que actualizarlas antes de que alguien las tome.
- La **#840** pide «sección de precios y **botón de compra**» en la landing. Sin checkout, ese
  botón no lleva a ningún lado, y hoy «a la gente sólo se le habla del grupal». Se corrige a
  sólo el grupal, o se tacha.

⚠️ **«Clientes en cada plan» no sale de la capa:** la capa dice qué tabs ve una cuenta, no qué
paga. Cinco clientes reales están en «completo» y ninguno paga 47, y las tabs del 47 y del 97
son las mismas. Se enlaza `/customer-success`, que ya lista cada cliente con su plan, o se
cuenta por producto cuando las ventas estén en el CRM de MaKo.

**Para los clientes, después** (cuando haya pasarela). **Pública, no.**

## 3. Runway — ahora, chico

- A la barra de Admin, al lado de Strategy. Hoy sólo se llega por un link.
- **Las fechas salen del tablero** (los deadlines de cada proyecto), no de los hitos escritos
  el 03/10. Hoy dice prospección el 18/10 y el tablero dice 31/10. El avance de cada frente ya
  lo calcula Productivity Analyst: se reusa ese lector, no se escribe un tercero.
- Dos errores que hoy se ven: el «hoy» está en UTC y fijado al cargar, así que de 21 a 24 h
  cuenta un día de más; y los «45 días» están escritos a mano y además se calculan aparte.
- Sus tasas (US$100 por agenda, 50% de asistencia) contradicen las de Strategy. Se sacan o se
  alinean antes de subirla a la barra.
- El capital sigue escrito a mano: no hay tabla de caja.
- ⚠️ Otra sesión la editó hoy a las 21:43 (`dae23ffa`). Hay que coordinar.

## 4. Objetivos — después, y es `/general`

Ya existe: `/general` es FOCUS (Q → Objective → KPI → tareas). Una tab aparte duplicaría su
cabecera.

**Lo que le falta para «dinero y tiempo»:** un objetivo **«del … al …»**. Hoy sólo acepta
trimestres, así que la ventana del 1/11 al 15/12 no se puede cargar. Con el rango, los
US$15.000 se cargan en el workspace de MaKo y se miden solos, si las ventas están en el CRM.

- ⚠️ **No cargar la ventana como un objetivo del Q4.** El vigilante cuenta desde el 1/10, diría
  «va atrasado» desde el 14/10 y se lo pasaría al Perro.
- «Tiempo» son los hitos del tablero. En MaKo eso lo muestra el Runway; los clientes casi no
  tienen proyectos con fecha (2 de 62).
- En el workspace de MaKo, `/general` no está en la barra y su «acción del día» lee una tabla
  vacía en vez del tablero.
- Ya hay dos tareas abiertas que piden lo mismo: **#219** (meta de facturación en el hero) y
  **#326** (tablero operativo diario y semanal). Se absorben.
- Para ESTA ventana, el avance se mira en Números de MaKo.

## 5. Referidos — después

Una tab para todos no es el canal ahora. El programa se lanza del 13 al 20/10 con **mensajes
uno a uno**. Jan y tu hermana no tienen workspace. Y como nadie tiene suscripción, lo único
verdadero para un usuario hoy es el grupal.

**Ahora va:** el acuerdo de una página, los mensajes, y **cada venta referida cargada en el CRM
de MaKo con sus cuotas y quién la refirió**. Sin eso, el 20% de cada cuota no se puede pagar.

**La tab, cuando haya pasarela y ventas referidas:** su link, a quién trajo, su saldo de meses,
lo ganado del grupal. Necesita una tabla de referidos y una de liquidaciones; hoy no existe
ninguna de las dos.

> La regla de `docs/referidos.md:392` («nunca antes de 20 referidos pagando») es de la
> propuesta original, no del programa decidido: no te frena. Lo que frena es la poda.

## 6. Gráficos — una pregunta y un después

**«Ese gráfico de torta, con datos reales», ¿es el de MaKo o el de cada cliente?**

- **El de MaKo** (a dónde va cada dólar de cada venta) es el **Margen por oferta** (7).
- **El de cada cliente** (a dónde va su plata) hoy **mentiría**. Con lo que existe sólo hay
  anuncios, cobrado y pendiente. «Lo que te quedó» no descuenta comisiones (los 14 ganados del
  ws1 tienen closer y setter), ni equipo, ni herramientas. Además repite la barra
  cobrado/pendiente y el ROAS que `/comercial` ya tiene. No se hace hasta que el cliente pueda
  cargar sus egresos.

**«Mis gráficos», el selector — después:**
- Tercera sub-tab de Graphics. Hoy Tendencias deja elegir 4 series y se pierde al recargar.
- La selección se guarda **por usuario y workspace**, no por workspace: si no, cuando mirás a un
  cliente le cambiás su vista.
- El catálogo junta TODAS las superficies (Graphics, Análisis, Productivity Analyst, `/general`),
  no sólo Tendencias, o queda un segundo mapa de gráficos.
- Antes, que los números cuadren: las tareas abiertas de Feature: Dashboard (#321: el gráfico
  de tendencias ignora el filtro de fecha). No hay tarea del selector; su casa es la **#326**.

## 7. Margen por oferta — después

- Las tres tortas de la 08 (47, 97, grupal), en una tab de Admin. No en `/admin/dev/pricing`, que
  está en Dev y devolvería la dispersión que Strategy vino a juntar.
- Cada porción con su sello: **4 de cada 5 hoy son supuestos**.
- La 09 (techo de CAC y LTV) ya está en Pricing (parte 3): se borra el duplicado y se enlaza.
- ⚠️ La IA medida de octubre es US$0 porque todo corre gratis, y el medidor no registra todo
  (embeddings, análisis de creativos). Un US$0 ahí no quiere decir que la IA no cueste.

## Lo que no se hace

- **El experimento del Loom.** Con ~10 agendas de prospección son ~1,6 cierres por brazo: no
  contesta nada. Además `/experimentos` no compara leads por etiqueta. La 06 («¿conviene
  personalizado?») se decide **antes del 1/11**. La tarea es la **#246**.
- **«Mi plan» del cliente.** Sin pasarela no le dice nada verdadero que no sepa, y le mostraría
  15 tabs «próximamente».
- **Precios públicos.** Se vende por llamada y no hay checkout.

## Qué queda en Strategy

«Cómo vamos a vender MaKo», como decisiones y no como datos: la intro; una línea con la ventana
(1/11 al 15/12, US$2.000, US$15.000) y el link a Números de MaKo; la 03 (qué se hace en cada
canal, con las tasas rotuladas «supuesto»); la 04; la 05; la 06; la 10, rotulada «supuesto»
hasta que Análisis tenga tasas propias; y la 12 con Jan.

Se van: la 01 y la 02 a ¿Qué es MaKo?; las cifras y la 07 al Runway; la 08 a Margen por oferta;
la 09 a Pricing (ya está); las reglas de la 11 a Referidos, cuando exista.

---

## Lo que tenés que decidir

1. **¿Cargo las ventas de MaKo en su propio CRM, y conecto el Calendly, el Pixel de la landing y
   la cuenta publicitaria al workspace de MaKo?** Es lo único que vuelve reales los números de
   la ventana. Y la línea de WhatsApp de MaKo: ¿cuál es, y la conectamos?
2. **¿Qué es MaKo: ¿para vos ahora?** (recomendado: vos ahora; los clientes cuando haya
   pasarela; pública no).
3. **La torta: ¿la de MaKo o la de cada cliente?**
4. **Referidos: ¿la tab espera y ahora van el acuerdo y los mensajes?**
5. **La 06: ¿Loom personalizado sí o no?** Tiene que estar antes del 1/11.
6. **¿Quién es «nosotros»?** Si tu socio tiene que leer estas tabs, hoy no puede: todo es sólo
   super admin y MaKo tiene un solo usuario.

## Arreglos que no necesitan decisión (los hago si decís que sí)

- El costo del referido de 97: la tab dice **124,98** y `docs/referidos.md:55`, en los cambios
  que mandan, dice **130,46** («con el 50%, el 1er mes ya es un pago: r y no r²»).
- `modelo.ts:867`: el 1 a 1 en 4.000 → 10.000. Y la grilla vieja de Pricing: sin Free, sin la
  agencia a 297.
- Actualizar #771, #783 y #840 con el precio del 10/10.

## De paso, en otras áreas

- **ws11:** 12 cuotas de US$4.235,29 de una sola persona, cargadas el 08/10 y sin monto de
  cierre. Casi seguro son pesos cargados como dólares, e inflan su Outstanding y su MRR.
- **Objetivos:** ningún cliente creó uno a mano (las 8 filas son de la migración), y en el ws13
  están duplicados. Los avisos del vigilante no dejan rastro: la tabla `notificaciones` sigue
  sin existir en producción.
