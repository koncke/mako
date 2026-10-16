# Hallazgos — planes, capas y cobro

El área es lo que pasa **cuando el producto empieza a cobrar y a cortar por plan**:
`lib/capas.ts`, `lib/tab-access.ts`, el alta de `app/api/admin/workspaces`, `app/terminos`,
y el modelo de negocio de `app/admin/dev/pricing/modelo.ts`.

Sale de la corrida del 04/10/2026 (seis lectores + seis refutadores) sobre el audio del
plan de los próximos días. El entregable con las fechas es
[proyeccion-04oct.md](proyeccion-04oct.md); acá queda lo que vuelve a morder.

---

## El diagnóstico obvio era el equivocado: la cuenta del runway NO está rota

Al leer el audio —el embudo nuevo entra por una app de ~US$20— la conclusión inmediata fue
que la cuenta de `/admin/runway` (US$2.000 ÷ US$100 por agenda × 50% show up = 10 clientes =
US$15.000) describía el embudo viejo y había que rehacerla.

**Es al revés.** Esos US$15.000 son 10 × US$1.500 del programa **grupal**
(`ASCENSO_PROGRAMAS.grupal`, `modelo.ts:871`, `cajaUsd: 1290.33`), y contra esa caja el CAC
medido del carrito (US$136,22, `modelo.ts:1042`) entra con 7× de margen. La cuenta cierra.

Lo que NO cierra con ese mismo CAC es la app de US$47, cuyo techo de CAC está medido en
**US$105,27** (`modelo.ts:1435`). O sea: **el producto que el audio propone poner adelante
es el que no se puede llenar con pauta**, y el que financia el runway es el que ya estaba.

**La regla:** antes de declarar que una cuenta de negocio describe un modelo viejo, buscá
contra QUÉ producto está medida. Los dos números estaban a tres líneas uno del otro.

---

## `capaDef` es FAIL-OPEN, y por eso el orden de despliegue de una capa nueva no es opcional

`lib/capas.ts:329` cae a `CAPA_DEFAULT` = `completo`, que es `navKeys: null` — **ve todo el
producto**. El comentario de arriba ya lo dice con todas las letras (y cuenta que el
comentario ANTERIOR afirmaba lo contrario). La única red es el CHECK
`workspaces_capa_valida` de la base.

De ahí el orden, que ya está escrito en `supabase/migrations/0177_capa_agencia.sql:30-32` y
hay que respetar al agregar los planes nuevos:

1. **Deploy del código** con la capa nueva en `CAPAS`.
2. **Después** el `alter … drop constraint` + `add constraint` con el valor nuevo, y el
   `update` de los workspaces.

Al revés, un workspace con la capa nueva en la base y el código viejo **no da error: abre
el producto entero**. Y en el otro orden el error es un `23514` crudo en la cara.

⚠️ **Y la lista de lo que ve cada plan son 44 decisiones, no ~60**: `nav.ts` tiene 39 keys
de cliente + 5 de usuario; las otras 54 son del super admin y no entran en ninguna capa.

---

## El corte por capa es de PANTALLA, no de API

64 páginas están guardadas (`requireCapa` / `requireRolWs`) y eso funciona: tipear la URL no
entra. Pero **de las 251 rutas de `app/api`, sólo 5 miran la capa**.

O sea que el día que un plan chico no incluya una tab, su `fetch` sigue contestando. La
puerta que importa no es la página: es el endpoint que la página usaba.

---

## `requireCapa` no puede renderizar nada: devuelve `Promise<void>` con el `redirect()` adentro

`lib/tab-access.ts:83`. Una página que lo llame y siga renderizando pinta su contenido igual
—el `redirect()` corta por excepción, no por valor—, así que **«mostrar un cartel de mejorá
tu plan» no es cambiar el guard: es cambiar 56 call-sites** (10 `requireCapa` + 46
`requireRolWs`).

Hoy el cliente del plan chico que toca una pantalla del grande ve un **redirect mudo** al
CRM, que se lee como que la app está rota. Y el componente que diría la verdad existe desde
agosto con **cero emisores reales**: `app/_ui/Estados.tsx:251`.

**Lo barato y honesto:** hacerlo sólo en las 2-3 tabs que el plan chico no compra, y dejar
el redirect en el resto. Lo caro es creer que es una tarde.

---

## El alta completa YA existe: lo que falta es el disparador

Antes de escribir una cadena de alta por webhook, leer `app/api/admin/workspaces/route.ts:80-143`.
Encadena cinco cosas **con el orden ya pagado**: email único ANTES de la primera escritura,
crear workspace, sembrar onboarding, crear usuario con rollback, y el mail declarado
no-fatal (que se caiga Resend no puede tumbar un alta que una persona aprobó).

Y el mail de acceso es `invitarPorEmail` (`lib/invitaciones.ts:74`), con preflight que corta
si el remitente es sandbox.

El webhook de pago es, entonces: **extraer eso a una función de lib, envolverlo con
`verificarFirmaSvix` (`lib/standard-webhooks.ts:72-106`) y agregarle idempotencia.**
`/api/webhooks` ya es prefijo público en `lib/rutas-publicas.ts`.

⚠️ **CORREGIDO el 11/10/2026, al construirlo:** la extracción se hizo (`lib/alta-cliente.ts`), pero
**la mitad de Svix era falsa** para Stripe y Mercado Pago — ver «La pasarela» más abajo, primera
entrada. Ni Stripe ni Mercado Pago firman como Svix.

---

## El rail de cobro no es UNO: la AUP del merchant of record prohíbe «coaching»

`modelo.ts:845-852` cita textual la AUP de Paddle, que excluye *«pure consulting or advisory
services, including but not limited to legal advice, coaching…»*, y `modelo.ts:1611` lo
cierra: *«Stripe propio. NUNCA Paddle… su botón no puede ir al mismo checkout que los
planes»*.

Consecuencia que no se ve desde el código: **el programa de US$1.500 —el que financia el
runway— y los planes de la app no pueden compartir checkout.** Y el rail del programa
(Stripe propio) es justo el que arranca el reloj de 30 días del RFC mexicano
(`modelo.ts:635`, `:1272`), con representante legal y domicilio en territorio nacional.

⚠️ **Y `/reembolsos` NO es un pie de página: es condición de aprobación.** `MES_0`
(`modelo.ts:1267-1277`, `origen: 'medido'`) dice que el MoR aprueba el negocio **días o
semanas ANTES del primer cobro** y pide esas páginas. `/terminos` y `/privacidad` existen
desde el 5/09; `/reembolsos` no.

---

## El margen del plan de US$47 que afirma el pricing no lo sostiene el código

Tres cosas que hay que leer juntas antes de volver a citar un margen:

- El video **no lo paga MaKo**: sale de los créditos de Google Flow del cliente
  (`lib/costo-clip.ts:32`). El argumento «el 47 con Video Generator no es rentable» tiene la
  premisa al revés.
- **`IA_POR_PRO` (`modelo.ts:1359-1375`, `hoyUsd: 10.90`, `origen: 'medido'`) dice literal
  que REEMPLAZA al US$2,52 de `EXPOSICION`.** Con ese número el margen a 47 es 76,8% (no
  94,2%) y a 23,50 es 53,6% (no 89%). Sobre el único workspace real medido —US$68,39/mes—
  un Pro a 47 es **caja negativa**.
- El cupo que hacía cerrar el 2,52 (`CUPO_MT`) **no tiene un solo call-site fuera de la
  pantalla de pricing**: es una constante que nadie aplica.

**La regla: un número de `modelo.ts` que dice «reemplaza a X» gana sobre X, y el que
describe un mecanismo (un cupo, un tope) no vale hasta que se grepea su call-site.**

---

## Nada corta el gasto de IA de un cliente, y hoy ese gasto es INMEDIBLE

`modelo.ts:148`: no existe ninguna primitiva que corte una llamada por gasto. Y hay **seis
caminos que gastan sin que el cliente abra la app** — el webhook de Fathom sin techo
(≈US$52/mes con 10 llamadas/día), el cron `closing-sync` (≈US$31/mes por workspace),
`fathom-plan`. Con un plan de US$47, eso puede costar más de 47.

Peor, y es lo que hay que arreglar primero: **el gasto de Claude se escribe TODO en el
workspace 1** (`modelo.ts:145`). Hasta que se separe, cualquier afirmación sobre «cuánto
cuesta un cliente» sale de un promedio que no existe.

---

## Quien pague con un mail que no sea de Google no puede entrar NUNCA

`app/api/auth/callback/google/route.ts:8-14`: el login es sólo Google, no hay contraseña y
la tabla no tiene dónde guardarla. El mail de invitación le dice *«entrá con Google desde
ese mismo email»* a alguien que acaba de pagar con un correo que no es Gmail.

No falla en el alta: falla en el primer login, cuando ya cobraste.

---

## Lo que le pasa en el CRM al que PAGA sin agendar

Mudado a [hallazgos-crm.md](hallazgos-crm.md) — el código vive ahí
(`lib/crm-auto.ts`, `lib/pipeline.ts`). Queda el puntero y no una copia: dos
documentos con el mismo hallazgo son dos que divergen, y el que se queda viejo no
avisa.

## El workspace de la plataforma (ws9) no tiene CRM, y arreglarlo son DOS cosas que son UNA

La capa `superadmin` no declara `crm`, `whatsapp`, `email` ni `chatbot` (`lib/capas.ts:281`),
así que el server rebota. **Y no se arregla desde el panel**: la ruta rechaza explícitamente
el workspace de la plataforma (*«Ese es el espacio de la plataforma: no tiene plan»*,
`app/api/admin/workspaces/route.ts:170-172`). El único camino es esa línea de `capas.ts`.

⚠️ Y su funnel está `declarado = false`, así que apenas se le abra el CRM va a dibujar el
`DEFAULT_PIPELINE` de high-ticket. **«Darle CRM al ws9» y «declarar su embudo» son una sola
tarea**: hacer la primera sin la segunda entrega una pantalla que miente.

---

## Los términos publicados dicen que no cobrás

`app/terminos/page.tsx:160`: *«No hay cobros automáticos dentro del producto ni se te va a
cobrar nada sin que lo hayas acordado antes»*. Cero cláusulas de suscripción, renovación,
cancelación o reembolso.

Esa URL es pública y la abren los revisores del MoR y de Google. **El día que la pasarela
esté viva, afirma algo falso** — y se arregla en el mismo commit que escribe `/reembolsos`,
no después.

✅ **Hecho el 11/10/2026, como BORRADOR:** la sección 8 de `/terminos` pasó a «Precio, pagos y
cancelación» y existe `/reembolsos` (`app/reembolsos/page.tsx`), las dos en el mismo commit que la
pasarela. Las cláusulas las tiene que revisar Martín (plazo de respuesta de 5 días hábiles, el mes
pagado no se devuelve salvo error o cobro duplicado, el grupal según lo acordado en la llamada).

---

## Dos avisos de medición, para el próximo que mida esto

- **El registro de `/admin/dev` miente en dos lugares**: `areas.ts:797` dice que no existen
  `/terminos` ni `/privacidad`, y los dos existen desde el 5/09 y están linkeados en el
  footer. Quien planifique leyendo el registro reescribe lo que ya está.
- **`app/vsl/landing-html.ts` NO es un template literal**: son 170.816 caracteres de un
  string entre comillas dobles, **auto-generado desde Claude Design**. Editarlo a mano lo
  desincroniza de su fuente y la próxima regeneración se come el cambio. La sección nueva se
  monta desde `Landing.tsx`, que ya inserta nodos sobre ese HTML en cuatro lugares
  (`:66`, `:114`, `:135-142`, `:204`). La regla quedó en `AGENTS.md`.

---

## Referidos (10/10/2026): lo que vuelve a morder al diseñar un premio

Sale de la corrida `wf_28690687-a62` sobre el audio del 10/10. La propuesta entera está en
[referidos.md](referidos.md); acá queda sólo lo que no se deduce de leerla.

**El diagnóstico obvio era el equivocado: «5 × 47 = 235 contra 3 meses de agencia regalados».**
La cuenta del audio compara UN mes de ingreso contra TRES meses de regalo. Los 5 clientes
pagan 235 **por mes** durante ~8,7 meses: US$1.256 de contribución con la IA de hoy. Contra
eso, 3 meses del plan agencia a 97 cuestan US$273 netos si esa persona igual iba a pagar, y
US$115 (3 × 38,18 de servirla) si no. A 97 el miedo no es real; a 200 sí (US$562).
**La regla:** un premio se compara contra el LTV de lo que trae, no contra su primer mes.

**«Meses gratis» no cuesta lo mismo en todos los casos.** Un mes regalado a alguien que
igual iba a pagar es ingreso NETO perdido (43,77 en el Pro); a alguien que no iba a pagar
(un amigo con cuenta de cortesía) cuesta sólo servirlo (14,90 con la IA de hoy). Los tres
diseños de la corrida mezclaron las dos cosas en algún lado; el crítico las separó.

**El escalón «cada N clientes» se cae solo con la retención del Pro.** Con un 11,5% de bajas
por mes (r = 0,23^(1/12) = 0,8847), la probabilidad de seguir teniendo los 5 en el mes
siguiente es 54%, y los 10, 29%. Un premio todo-o-nada por hito se pierde casi siempre en el
mes 2. Ninguno de los 12 programas verificados premia «cada N»: todos por cliente activo.

**Lo que Martín describió como «lo que hace Claude» no es lo que hace Claude.** Claude da 7
días de Pro con tarjeta, sólo a quien nunca pagó, con pases escasos, y premia al que invita
recién cuando el invitado paga (support.claude.com, artículo 13456702). El «un mes para cada
uno» es Superhuman, y la versión segura es la de YNAB: el mes gratis se agrega DESPUÉS de pagar.

**La cuenta del runway supone que cierra el 100% de los que se presentan.**
`app/admin/runway/datos.ts` (`CUENTA`) hace 20 agendas × 50% de show = 10 llamadas = **10
clientes**: no hay tasa de cierre en el medio. La corrida del 04/10 (arriba, «la cuenta del
runway NO está rota») verificó CONTRA QUÉ producto estaba medida, no esto. Con el 20% de
cierre de `modelo.ts:1711` el anuncio cuesta ~US$1.000 por grupal, no 200; con el 40% que
Martín proyectaba en julio, ~US$500. Por eso un referido del grupal a US$300 es el canal más
barato que tiene MaKo en la ventana del 1/11 al 15/12.

**Cuatro trampas del modelo de precios que un diseño de premios pisa:**
- `modelo.ts:1439` dice que el techo de CAC del Pro con la IA de hoy es US$81,50; su propia
  fórmula (28,87 × 8,7 / 3) da 83,72. Se usó el 81,50 por conservador.
- El plan Agencia de US$297 (`modelo.ts:598`) existe sólo en `PRECIOS` y en la `UNIT` vieja,
  no en `UNIT_V2`. Con «hasta 10 clientes» adentro es una venta mayorista a US$29,70 por
  workspace: una agencia con 10 clientes pagaría 297 en vez de 470.
- El plan de 97 «no se vende hasta el mes 13» (`modelo.ts:1445`): todo referido de software
  que se modele hoy es Pro.
- Paddle no acepta el grupal (AUP, `embudo-y-high-ticket.md:547`): la comisión del grupal no
  puede pasar por la pasarela de las suscripciones.

**Herramientas:** Rewardful sólo se integra con Paddle Classic, no con Paddle Billing; Tolt
sí (US$69/mes con pagos manuales). Verificarlo en el trial antes de prometer nada.

---

## La tab /admin/estrategia (10/10/2026): lo que no coincidía entre las fuentes al juntarlas

Martín pidió juntar en UNA tab de super admin la estrategia, el runway, los costos y los
referidos. La tab **importa** de `app/admin/runway/datos.ts` y de `modelo.ts` en vez de copiar
números; al hacerlo aparecieron estas diferencias, que la pantalla resuelve como se dice y
que siguen vivas en las fuentes. Corrida `wf_b425a044-e9e` (4 lectores, 1 constructor, 3
verificadores, 1 corrector).

**El objetivo de US$10.000 no sale de la oferta vigente.** La proyección de la estrategia
(15 agendas → 12 efectivas → 5 ventas) llegaba a 10.000 con una mezcla de «1 a 1 de 4.000 + 4
grupales de 1.500». El 1 a 1 de 4.000 no aparece en ninguna decisión posterior al 20/09. Con
sólo el grupal, 5 ventas son **US$7.500** (neto 6.500 con US$1.000 de anuncios), y el objetivo
pide **7 ventas, ~22 agendas**. La tab dibuja las dos cosas por separado: lo proyectado y la
brecha contra el objetivo. **La regla:** un total rotulado «Facturado» se calcula de ventas ×
precio; si es una meta, se rotula «Objetivo» y se dibuja aparte.

**El runway y la estrategia proyectan dos meses distintos.** Runway: US$2.000 de pauta, US$100
por agenda, 50% de show y — sin decirlo — 100% de cierre (10 clientes, US$15.000). Estrategia:
US$1.000 de campaña, US$125 por agenda, 80% de asistencia, 40% de cierre. La tab usa la de la
estrategia (es la que Martín revisó tasa por tasa) y deja el capital y el calendario del runway.
**Sin resolver: ¿la pauta de noviembre es 1.000 o 2.000?**

**`CAC_CANALES` (modelo.ts:1030) mide la venta autoservicio del Pro CON usuarios Free.** El
«WhatsApp US$176» son 100 de medios + 76 de 19 Free que no pagan; el carrito, 124,22 + 12. En
la oferta vigente no hay Free (`UNIT_V2.free`: «NO EXISTE hasta el mes 10»), y la campaña de
la estrategia vende el GRUPAL por llamada. Dibujado tal cual, la página declaraba «no entra»
al canal pago que ella misma propone. La tab separa dos gráficos, cada uno contra su techo:
el grupal (campaña ~US$390 por venta contra US$1.190 que deja) y el Pro vendido solo, sin el
componente Free. Y el referido de `CAC_CANALES` (43,55) es el premio viejo de tokens: el
decidido el 10/10 cuesta 78,23.

**La torta del 97 dividía por la regla equivocada.** «Captación» era un tercio de la
contribución (17,56/mes = el techo 3:1 de 272,23), pero `UNIT_V2` dice que en el Growth
gobierna el payback (158,07). Ahora cada porción de captación es el techo que se dibuja ÷ la
vida del cliente: 9,37 en el 47 y 10,20 en el 97.

**El techo del 47 son 81,53, no 81,50.** `UNIT_V2` mezcla el ajuste de `ASCENSO_NETO` (−6,57,
del modelo v1); el 81,50 de `docs/referidos.md` y de `modelo.ts:1439` es el redondeo del
comentario. Su propia fórmula sin el ajuste da 83,72. Diferencias de centavos: no cambian
ninguna decisión.

**Los hitos del runway son los del 03/10.** El audio del 04/10 movió el cierre técnico y la
prospección (18/10 y 19/10), y la «ventana de 45 días» son 29-30 días con plata. La tab importa
`HITOS` tal cual: se corrige en `runway/datos.ts` y se corrige en las dos pantallas.

**`/vsl/costos` seguía pública sin login**, con los costos de la empresa. Era el otro documento
interno bajo `/vsl`; su cabecera decía «igual que /vsl/estrategia», que dejó de ser cierto.
Martín la cerró el mismo día (ver «la tercera vuelta», abajo).

### Y la segunda vuelta, el mismo día: «poco texto» no es «esconder en un hover»

**Síntoma.** Martín abrió la tab y la devolvió: «eliminaste cosas de la antigua tab de
estrategia que estaban buenas, como la intro, que decía el avatar» y «son muchas cosas todas
juntas; quiero tener claridad de qué estoy leyendo en todo momento».

**Causa.** Para cumplir «gráfico, simple, no tanto texto», la primera versión tomó dos atajos
que se leen como acortar y no lo son: sacó lo que no era un número (la intro, el cliente
ideal, la propuesta a Jan) y mandó al `title` de cada tarjeta lo que era una lista (los seis
ejes de la llamada, qué se mira para el Loom, qué se le dice sobre su anuncio, los canales a
futuro). Un `title` no se ve en el celular ni sin el mouse encima: el texto seguía en el
código y para quien lee no existía. Y el «muchas cosas juntas» no era el largo: eran nueve
secciones seguidas sin nada que dijera dónde empieza una y termina la otra.

**La regla que queda.** Cuando una página interna tiene que ser corta Y completa, el recorte
es estructural, no de contenido: cada sección es un `<details>` numerado con la pregunta que
contesta (cerradas, se leen como el índice) y su renglón queda pegado arriba mientras está
abierta. El largo ya no tapa nada, porque lo que no se quiere leer se deja cerrado. Lo que
se saca por chocar con una decisión posterior (la propuesta a Jan contra el programa de
referidos) no se borra: vuelve **marcado**, porque decidir qué se le ofrece a alguien no es
trabajo de la pantalla. **Vive en:** `app/admin/estrategia/Estrategia.tsx` (`Seccion`,
`ColJan`), `app/admin/estrategia/datos.ts` (`JAN_GANA`, `JAN_GANO`), y lo fija
`tests/estrategia-tab.test.ts`, que dibuja la página y busca el texto **sin los `title`**.

### Y la tercera vuelta, el mismo día: las cuatro decisiones

Martín contestó lo que la tab tenía marcado: la proyección se cuenta sobre **la ventana de los
anuncios** (1/11 al 15/12) y no por mes, con **US$2.000 de pauta en total** y un **objetivo de
US$15.000**; el **1 a 1 vuelve a US$10.000** con el contenido a definir por él; la propuesta a
Jan **se reescribe** con el programa de referidos; y `/vsl/costos` **se cierra**. Tres cosas
que no se ven en el diff:

**La propuesta a Jan chocaba en CINCO filas, y la tab marcaba tres.** Las tres marcadas
chocaban con la tabla de premios (reventa, prueba extendida, % de ganancias). Las dos que
nadie marcó chocaban con otra fila del programa, la de **reglas comunes**: «acceso personal de
por vida» contra «todo se cobra, también a los amigos», y «cobra una recurrencia sin mover un
dedo» contra un premio que es **una vez por cliente nuevo**. Las dos se leían como favores, no
como reglas rotas. **Al contrastar una propuesta contra un programa decidido, se contrasta
contra TODAS sus filas**, incluida la de reglas comunes, que es la que no habla de premios.
**Vive en:** `app/admin/estrategia/datos.ts` (el comentario de `JAN_GANA` enumera las cinco);
`tests/estrategia-tab.test.ts` frena que vuelva cualquiera de ellas.

**Un costo por venta sale de las TASAS, no de dividir volúmenes redondeados.** Al estirar la
prospección a 45 días, las agendas dan 10,5 y se cuentan 10 (media agenda no existe). Con eso,
«Looms por venta» calculado como `responden ÷ ventas` pasaba de 89 a 94 **sólo por alargar la
ventana**, sin que cambiara nada del canal. Ahora es `1 ÷ (tasa de agenda × asiste × cierra)`,
y la campaña sigue en US$390,62 por venta y US$125 por agenda con el doble de pauta.

**El guard de `/vsl/costos` vive en la página, no en el proxy.** `/vsl` está en `PUBLICOS` por
la landing, así que el proxy la deja pasar sin sesión; `getSesionAdmin` lee la cookie firmada,
que llega igual en una ruta pública. Es el único cerrojo, y por eso lo fija un test. El link
que tenía Mauricio (un cliente) deja de abrir.

**Lo que sigue sin coincidir con el runway:** la pauta y el objetivo ya son los mismos, pero las
tasas no (el runway dice US$100 por agenda y 50% de asistencia con cierre implícito de 100%; la
tab, US$125, 80% y 40%). La tab usa las que Martín aprobó y no dibuja la diferencia.
## Partir Strategy en tabs (10/10/2026): el bloqueo es el CRM vacío de MaKo, no las pantallas

**Síntoma.** Martín pidió sacar de Strategy lo que «podría tener su propia tab, bien diseñada y
funcional»: ¿Qué es MaKo? con precios en columnas, Referidos para todos, Objetivos de dinero y
tiempo, la torta con datos reales en Graphics. La lectura obvia era una tab nueva por sección.

**Lo que se midió.** Las pantallas que volverían reales esas secciones ya existen y andan con los
clientes: `/comercial`, `/analisis` (la proyección con tasas MEDIDAS) y `/general`. Lo que no
existe son los datos de MaKo en su propio workspace (ws9): 3 ganados sin monto ni producto, 0
pagos, 0 filas de Meta (falta `META_AD_ACCOUNT_ID` y el token no trae `ads_read`), 0
`landing_visits`, 0 agendas (el Calendly `koncke/asesoria` no está conectado), la línea de
WhatsApp `mako_ws9` nunca conectó, 0 objetivos. **MaKo vende un método que no usa con su propio
negocio**, y por eso Strategy tuvo que escribir sus números a mano. Y lo medido en los clientes
desmiente los supuestos de la tab: en ws1 asiste el 50,8% (la tab dice 80%), cada R1 cuesta unos
US$98 (la tab, 125), y la IA de octubre es US$0 en casi todos (la torta usa 10,90). La propuesta
entera, con lo que va ahora y lo que no: [propuesta-tabs-strategy.md](propuesta-tabs-strategy.md).

**Tres trampas para quien construya esas tabs:**

- **La capa no es el plan pagado.** `workspaces.capa` dice qué tabs ve una cuenta y la escribe el
  super admin a mano (`app/api/admin/workspaces/route.ts:180`). Cinco clientes reales están en
  `completo` y ninguno paga 47; `completo` y `agencia` tienen `navKeys: null`
  (`lib/capas.ts:183`, `:251`), así que «las tabs del 47» y «las del 97» salen idénticas. Contar
  clientes por plan desde la capa da un número plausible y falso: se cuenta por producto
  (`leads.producto_id` del CRM de ws9) o se enlaza `/customer-success`, que ya lista el plan de
  cada cliente.
- **Hay tres grillas de precio, y no dicen lo mismo:** Strategy (47 · 97 · 1.500 · 10.000), la
  parte 4 de `/admin/dev/pricing` (`GRILLA` del 09/08, con Free y la agencia a 297) y
  `modelo.ts:867` (el 1 a 1 en 4.000). En el tablero, #771, #783 y #840 siguen citando el precio
  del 20/09 (49/400, «el 47 deja de existir»), y la #840 pide un botón de compra sin checkout.
  Una tab de precios que no jubile las otras es la cuarta.
- **El referido de 97 se calcula con r² en la tab (124,98) y con r en el documento decidido**
  (130,46, `docs/referidos.md:55`: «con el 50%, el 1er mes ya es un pago»). El test fija el de
  la tab.

**De la corrida, para la próxima.** El diseñador volvió a preguntarle a Martín cosas que se habían
decidido ese mismo día (los precios, la agencia dentro del 97): el contexto nombraba las
decisiones sin su procedencia, y las tareas viejas del tablero decían otra cosa. Lo cazaron dos
refutadores leyendo la bitácora de `gtm-oferta-y-precios`. **Al lanzar una corrida de diseño, las
decisiones del día van con su fuente (la bitácora, la hora), y «la fuente más nueva gana» se
escribe en el prompt.**

**Vive en:** `app/admin/estrategia/datos.ts` · `lib/capas.ts:183,251,280` ·
`app/admin/dev/pricing/modelo.ts:526-601,867` · `docs/propuesta-tabs-strategy.md`.
*Corrida `wf_01c22b1b-91a`, 10/10/2026.*


---

## La pasarela (Stripe y Mercado Pago, 11/10/2026): lo que no se ve leyendo el código

Pedido de Martín: «implementes end-to-end la integración con Mercado Pago y con Stripe, tipo pasarela
de pagos... Lo voy a utilizar yo como superadmin para vender MaKo, pero también los usuarios pueden
alojarlo». El contrato (vocabulario, datos, firmas, rutas) está en
[diseno-pasarela-pagos.md](diseno-pasarela-pagos.md); lo de abajo es lo que costó.

### El diagnóstico obvio era el equivocado: el webhook de pago NO es Svix

**Síntoma (evitado):** este mismo documento decía «envolverlo con `verificarFirmaSvix`». Hecho así, la
firma de Stripe da «no coincide» en el 100% de los eventos — que se lee igual que un secreto mal pegado.
**Causa:** el secreto de Stripe también empieza con `whsec_`, pero Stripe lo usa TAL CUAL como clave
HMAC (UTF-8) y `claveDelSecreto` (Svix) le saca el prefijo y lo decodifica de base64. Además Stripe
firma en hex `${t}.${raw}` y puede mandar VARIOS `v1` mientras se rota el secreto (el parser de
`lib/calendly.ts` se queda con el último y rechazaría tráfico legítimo justo durante la rotación), y
`v0` es una firma falsa de los eventos de prueba. Mercado Pago firma un MANIFIESTO
(`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), no el cuerpo.
**Regla:** cada pasarela con su verificador puro y con vectores fijos; nunca por `standard-webhooks`.
**Vive en:** `lib/pasarela-firma.ts` · `tests/pasarela-firma.test.ts`.

### La primera factura de una suscripción de Stripe llega DOS veces

**Síntoma (cazado en la reconciliación):** la primera cuota de una suscripción entraba duplicada al
CRM. **Causa:** el primer cobro llega por `checkout.session.completed` (que trae `invoice`) Y por
`invoice.paid` con `billing_reason = subscription_create`; si un camino usa el id de la SESIÓN y el otro
el de la FACTURA, el segundo se lee como una RENOVACIÓN (otra cuota). **Regla:** el `proveedorPagoId`
de una suscripción es SIEMPRE la factura (`in_…`) y el de un pago único el payment intent (`pi_…`); sin
factura todavía, no se aplica — entra por `invoice.paid`. La cuota del CRM es idempotente por el índice
`pagos_proveedor_uk (workspace_id, proveedor, proveedor_pago_id)`.
**Vive en:** `lib/cobros-eventos.ts` (`confirmarCheckout`) · `lib/cobros.ts` (`reconciliarCobros`) ·
`supabase/migrations/0255_cobros_pasarela.sql`.

### Mercado Pago: la notificación no trae el pago, y la firma no se le puede exigir a todo

**Causa:** el aviso trae un id; el estado se pide SIEMPRE con `GET /v1/payments/{id}` y el token del
negocio (y `payer` viene con los datos personales en null «por seguridad»: para cruzar sirve
`external_reference`, el token del cobro). La firma: el formato IPN viejo NO se puede validar (lo dice
MP) y no está medido si la `notification_url` de una preferencia llega firmada. **Regla:** el aviso es
sólo «andá a mirar»: se relee el recurso con el token del ws y se exige `collector_id ===
MERCADOPAGO_USER_ID` (con el token del negocio también se leen pagos donde esa cuenta fue la que PAGÓ).
Una notificación falsa sólo provoca una relectura. Se verifica la firma sólo en el formato webhook y si
hay secreto. Y **deduplicar «por id de evento» como en Stripe era el diagnóstico equivocado**: MP manda
varias (created, updated) sin un id estable; la clave es `<tipo>:<id>:<estado resultante>`, y sale de la
relectura.
**Vive en:** `app/api/webhooks/mercadopago/route.ts` · `lib/cobros-webhook.ts` · `lib/cobros-eventos.ts`.

### Un camino sin firma ni dueño que escribe una fila por pedido no tiene techo (15/10/2026)

**Síntoma (revisión del 11/10):** un aviso de Mercado Pago con un `user_id` que no es de ningún negocio dejaba
una fila `sin-workspace` en `pasarela_eventos` por cada `data.id`: cualquiera hacía crecer la tabla mandando
ids al azar (ese camino no tiene firma ni dueño).
**Regla:** el rastro de lo que no es de nadie tiene techo: UNA fila por día (`sin-workspace:<fecha>`) y el
resto al log. Lo que sigue abierto es el otro lado: un aviso sin firma con el `user_id` de un negocio
conectado provoca una relectura con SU token (ver la tabla de abajo).
**Vive en:** `app/api/webhooks/mercadopago/route.ts` · `tests/cobros-webhook-rutas.test.ts`.

### La moneda depende de la PASARELA, y el catálogo está en dólares

**Síntoma (evitado):** el orden obvio del formulario —monto, después pasarela— ofrecía «US$ 97» a una
cuenta de Mercado Pago argentina, que lo rechaza al crear el link. **Causa:** Mercado Pago cobra en la
moneda del sitio de SU cuenta (MLA = ARS) y `productos.monto_usd` está en USD. **Reglas:** en todo
formulario que cobra, la pasarela se pregunta ANTES del monto; `cobros.monto` + `cobros.moneda` son la
verdad, y `monto_usd` es el valor en dólares que DECLARÓ alguien (el producto o quien creó el link) —
**nunca una tasa inventada**: sin ese valor el cobro se registra igual pero no escribe cuota en el CRM
(`pagos.monto_usd` es NOT NULL) y lo dice en `motivo`. Por lo mismo, la API de MaKo no crea links de
Mercado Pago (el precio del catálogo es en USD): hace falta precio en moneda local en el catálogo.
**Vive en:** `lib/cobros-reglas.ts` (`decidirCobro`, `montoUsdDelCobro`) · `app/crm/[id]/CobrarConLink.tsx` ·
`app/admin/cobros/VenderPlan.tsx` · `lib/api-mako/areas/cobros.run.ts`.

### Un link de Stripe VENCE: el que se manda es de MaKo

**Causa:** una Checkout Session dura entre 30 min y 24 h; un link mandado por WhatsApp llega vencido.
**Regla:** el link que sale es `/pagar/<token>` (32 base64url, no se adivina), que redirige al checkout
vivo y crea otra sesión si la vieja vence en menos de 5 min (con una clave de idempotencia atada al
vencimiento anterior: dos clics no crean dos sesiones). ⚠️ **Y Next contesta los `HEAD` llamando al
`GET`**: un bot de vista previa que pedía `HEAD /pagar/<token>` creaba una sesión de Stripe. Un route
handler cuyo GET tiene efectos declara su propio `HEAD`.
**Vive en:** `lib/cobros.ts` (`urlParaPagar`) · `app/pagar/[token]/route.ts`.

### El alta automática de MaKo: en positivo, reclamada, y sin tocar a quien ya tenía cuenta

**Reglas:** corre SÓLO si el cobro es del workspace de la plataforma (`ws === await wsSuperAdmin()`,
escrito en positivo: un cliente que vende con su Stripe NO crea inquilinos aunque su fila trajera
`alta_capa`, y `crearCobro` lo rechaza al crear), sólo con capas vendibles, y se RECLAMA con
compare-and-set (`alta_estado` null|error → pendiente) antes de crear: dos avisos simultáneos no dan
dos altas; un `pendiente` de más de 10 min es una corrida muerta y el cron lo retoma. Si el email ya es
usuario → `ya_tenia_cuenta` y NO se le cambia la capa a ciegas. El login es sólo Google: la página de
retorno deja cambiar el email del acceso (sólo si el cobro está pagado, el alta hecha, el usuario NUNCA
entró y quedan cambios; el usuario se busca por su workspace y no por el email del cobro, que después del
primer cambio ya no coincide).
**Vive en:** `lib/cobros.ts` (`altaSiCorresponde`) · `lib/alta-cliente.ts` · `app/api/pagar/email/route.ts` ·
`app/pagar/acceso.ts`.

### Lo que contesta ANTES de gastar el intento es un oráculo (15/10/2026)

**Síntoma (revisión del 11/10):** el cambio de email de la página de retorno respondía «Ese email ya tiene
una cuenta de MaKo» antes de reclamar uno de los 3 cambios: con un link pagado se podía preguntar, sin
límite, qué emails son usuarios de MaKo. Los topes por IP y por token no lo frenan: viven en memoria, por
instancia.
**Regla:** la pregunta va DESPUÉS del reclamo y el «no» gasta el intento (como mucho tres preguntas por
link), con un texto que no dice por qué (`EMAIL_NO_DISPONIBLE`). Sólo se devuelve el intento cuando falla la
base, que no es culpa de quien compró. El `23505` del único de `usuarios.email` es la misma respuesta.
**Y por qué sus topes pueden quedar en memoria (15/10/2026, se pidió llevarlos a la base y se decidió que no):** el límite
que importa ya es PERSISTENTE: tres cambios por link, con compare-and-set sobre `cobros.alta_email_cambios`, y desde este día
el «ya es de otro» también gasta uno. Lo que queda en memoria es una segunda capa contra ráfagas: llevar el tope por IP a la
base, desde una ruta pública sin sesión, es una fila por IP sin techo (el mismo error que se cerró en el aviso de Mercado
Pago sin dueño); y el tope por token se cuenta ANTES de buscar el cobro, así que en la base aceptaría tokens inventados (y
después de buscarlo sólo repetiría el tope de tres, con una escritura por pedido). El token es de 192 bits: adivinarlo no es
un ataque. Si algún día hace falta un tope duro por IP, es el store compartido (Upstash/Redis) que la bitácora de
rate-limiting tiene en cola, no una tabla.
**Vive en:** `app/api/pagar/email/route.ts` · `tests/pagar-publico.test.ts`.

### Ganar al que pagó es lo que evita el «no agendaste»

`aplicarPagoAprobado` asienta la cuota (`registrarCobroDeProveedor`, que reusa `marcarPago` y corta la
cobranza) y RECIÉN después gana el lead por `setPipelineStage` + `etapaDeGanado` (nunca `estado_lead` a
mano), y RECIÉN después dispara Automations: con `fecha_primer_pago` ya escrita, el WhatsApp al lead sale
solo y no como borrador, y la condición «Pagó» da bien. El CRM automático del workspace de la plataforma
está apagado (medido el 11/10/2026: sin `crm_auto_enabled`, que fuera del ws1 es apagado).
**Vive en:** `lib/cobros.ts` · `lib/pagos.ts`.

### «Pagado» primero y el resto después: lo que se corta a la mitad no lo reintentaba NADIE

**Síntoma (cazado por la revisión adversarial):** con la base lenta, el webhook pasa los 8 s, contesta 200
y sigue en `after()`; si asentar la cuota falla ahí, queda el cobro «pagado», sin cuota, con el lead sin
ganar y —en una venta de MaKo— sin alta. Stripe y MP ya tienen su 200 y no reintentan, y el cron sólo
miraba los PENDIENTES. El cliente pagó y no le llegaba nada. **Causa:** cada paso era idempotente, pero el
único que los volvía a correr era un reintento del proveedor. **Regla:** el cron REPARA los pagados sin su
cuota en el CRM o con el alta sin terminar, pasándolos otra vez por `aplicarPagoAprobado`; un «ya estaba»
de la cuota igual sincroniza lo cobrado; y el aviso y el CRON se atan a que la cuota ESTÉ (deduplicados por
el pago del proveedor), no a que ESTE intento la haya escrito. Además: la ventana de los pendientes cuenta
desde `updated_at` (la preferencia de MP no vence), la RENOVACIÓN de una suscripción cuyo primer pago se
devolvió sigue entrando, y a Mercado Pago una firma que no coincide no se le contesta 401 (la seguridad es la
relectura, y un 401 rebotaba para siempre a un negocio con el secreto renovado).
**Vive en:** `lib/cobros.ts` (`reconciliarCobros`, `aplicarPagoAprobado`) · `lib/pagos.ts` · `app/api/webhooks/mercadopago/route.ts`.

### Un guard de credenciales que no veía lo que importa

**Síntoma:** `tests/pasarela-sin-env.test.ts` daba verde con `credWsEstricta('STRIPE_WEBHOOK_SECRET', ws)`
o `credWs(CLAVE, ws)` puestos en `lib/cobros.ts`. **Causa:** busca el nombre de la clave pegado a
`credWs(`, y `credWsEstricta` es legítima en el ruteo de un webhook, así que no se puede prohibir en todo
el repo. **Regla:** además del barrido, un guard POR MÓDULO que prohíbe `credWs\w*(`, `envCred(`,
`process.env` y `OWNER_WS` en `lib/cobros.ts`. ⚠️ Y nunca se carga una clave de pasarela en el entorno de
Vercel: `credWs`/`credWsEstricta` se la entregarían al ws1 (Mauricio) como si fuera suya.
**Vive en:** `tests/cobros-servicio.test.ts` · `tests/pasarela-sin-env.test.ts` · `lib/credenciales.ts` (`NO_MIGRAR_A_WS`).

### Un link vivo de una cuota ya cobrada se podía pagar dos veces (14/10/2026)

**Síntoma (revisión de la rama `crm-bloques-b2`):** se manda el link de la cuota 2 (500), el cliente paga por
transferencia y el closer la marca pagada. Días después el cliente abre el link del WhatsApp y paga: la pasarela le
cobra 500 de nuevo y el CRM suma otra cuota cobrada. **Causa:** marcar una cuota a mano no tocaba sus cobros
pendientes. El comentario de `registrarCobroDeProveedor` decía que el segundo pago «salda otra del mismo monto»,
y no pasaba: el casamiento por monto es sólo para links SIN cuota (`!p.pagoId`).
**Regla:** al marcar PAGADA una cuota se anulan sus links sin pagar (`anularLinksDeCuota`), y vive en
`marcarPago`, por donde pasan la ficha, el doer, la API y la pasarela, igual que el corte de la cobranza. El cobro
que la está saldando queda afuera (`pagos.cobro_id`; a esa altura ya está `pagado`). Desmarcar no los reabre. Un
segundo pago de un link de la cuota 2 NO salda la cuota 3: es plata que entró dos veces, y entra como cuota nueva
cobrada para que una persona la vea.
**Vive en:** `lib/cobros.ts` (`anularLinksDeCuota`) · `lib/pagos.ts` (`marcarPago` → `anularLinksAlCobrar`) · `tests/pagos-medias-b2.test.ts`.

### «Mercado Pago no cierra una preferencia» no era cierto, y «para que una persona la vea» no la mostraba (15/10/2026)

**Síntoma:** un link de Mercado Pago anulado (porque la cuota se cobró por otro lado, o porque el cobro cambió) se
podía pagar igual, y el pago entraba como una cuota cobrada más, sin una palabra en ningún lado.
**El diagnóstico obvio era el equivocado:** el código decía «Mercado Pago no tiene cómo cerrar una preferencia ya
abierta» y se tomó como un dato. La API de MP sí actualiza una preferencia (`PUT /checkout/preferences/{id}`), y el
código YA usaba `expires` + `expiration_date_to` al crear una con vencimiento: cerrarla es mandar esos mismos campos
con el fin en AHORA (`vencerPreferenciaMp`). Una suscripción de MP es otra cosa (un preapproval): sin autorizar, se
cancela. ⚠️ Que MP respete el vencimiento con el checkout ya abierto NO está medido (necesita las claves de prueba).
**Y la otra mitad:** la entrada del 14/10 decía que el pago doble «entra como cuota nueva cobrada para que una
persona la vea». Una cuota más en una lista no es que alguien la vea. **Regla:** cuando el sistema acepta plata que
no tendría que haber entrado, lo DICE donde se mira: en el cobro (`motivo`, que la ficha muestra) y en el historial
del lead, con el caso concreto si se sabe (la cuota del link ya estaba cobrada por OTRO pago → «la plata entró dos
veces»), y sólo una vez (la corrida que ganó la transición). El cron también relee los anulados que llegaron a la
pasarela: un aviso perdido no lo deja escondido.
**Vive en:** `lib/cobros.ts` (`anularCobro`, `aplicarPagoAprobado` paso 4b, `cuotaCobradaPorOtroLado`,
`reconciliarCobros`) · `lib/cobros-reglas.ts` (`avisoPagoPorLinkAnulado`) · `lib/mercadopago-api.ts`
(`vencerPreferenciaMp`) · `tests/pago-link-anulado.test.ts` · `tests/mercadopago-api.test.ts`.

### Una devolución de Stripe puede fallar DESPUÉS, y tres trampas para escucharlo (15/10/2026)

**Síntoma:** MaKo daba una devolución de Stripe por hecha apenas la creaba (`pending` o `succeeded`): cobro
«Reembolsado», cuota desmarcada. Días después Stripe puede pasarla a `failed` (tarjeta denunciada o dada de baja, una
disputa abierta): devuelve la plata al saldo del negocio y el cargo vuelve a estar cobrado. En MaKo seguía devuelta para
siempre.
**El diagnóstico obvio era el equivocado:** el pendiente decía «`pending` se da por hecho». `pending` está bien darlo por
hecho (Stripe ya muestra el cargo devuelto); lo que faltaba es enterarse de que FALLÓ. Se escucha `refund.failed` (existe
desde 2024-10-28.acacia; `charge.refund.updated` es el nombre viejo), se relee la devolución (que de verdad haya fallado)
y su CARGO, que es lo que dice si sigue devuelto por otra devolución: sólo si ya no, el cobro vuelve a `pagado`
(compare-and-set) y la cuota se vuelve a marcar con la fecha del cargo (`remarcarCobroDeProveedor`, con la guarda del
negocio). Siempre queda en el historial, con la razón en palabras si se conoce.
**Trampa 1 — un nombre de evento que Stripe no conoce rompe CONECTAR.** `enabled_events` se valida al crear el aviso: un
evento inexistente hace fallar `asegurarWebhookStripe`, o sea, ningún negocio podría conectar Stripe. Antes de sumar uno a
`EVENTOS_STRIPE`, confirmar en el changelog de Stripe desde qué versión existe.
**Trampa 2 — cambiar `EVENTOS_STRIPE` no les llega a los avisos ya registrados.** Stripe guarda la lista con la que se
creó cada uno. `asegurarEventosStripe` la pone al día sin tocar el secreto (actualizar no cambia el `whsec_`), y hoy la
llama `reembolsarCobro` ANTES de pedir la devolución. Una devolución hecha desde el panel de Stripe, en una cuenta
conectada antes de este cambio, no avisa su falla hasta que el negocio reconecte o MaKo haga una devolución. Si algún día
se suma un evento que importa sin una acción de MaKo (las disputas), hay que llamarla también desde el cron.
**Trampa 3 — la clave de idempotencia fija contra un reintento.** La del reembolso es la del cobro (una confirmación
repetida no devuelve dos veces); pero después de una devolución FALLIDA, la misma clave dentro de las 24 h le devolvería
a MaKo la respuesta vieja SIN crear otra devolución. El reintento lleva el `updated_at` que dejó la falla.
**Vive en:** `lib/stripe-api.ts` (`EVENTOS_STRIPE`, `asegurarEventosStripe`, `leerReembolsoStripe`) ·
`lib/cobros-eventos.ts` (`refund.failed`, `confirmarDevolucionFallida`) · `lib/cobros-webhook.ts` (rama `reembolso`,
`cobroDelPagoStripe`) · `lib/cobros.ts` (`aplicarReembolsoFallido`, `reembolsarCobro`) · `lib/pagos.ts`
(`remarcarCobroDeProveedor`) · `lib/cobros-reglas.ts` (`textoDevolucionFallida`, `idemReembolso`) ·
`tests/devolucion-fallida.test.ts`.

### «Lo devuelto no es deuda» vivía en un filtro que no todas las lecturas tienen (15/10/2026)

**Síntoma:** después de un reembolso, el Outstanding (sin ventana), «A quién cobrarle» y el Revenue del Dashboard con
«Todo» seguían sumando la cuota devuelta como plata por cobrar.
**Causa:** `desmarcarCobroDeProveedor` deja la cuota devuelta impaga y SIN vencimiento, confiando en que las lecturas de
deuda filtran por `fecha_esperada`. Muchas lo hacen (el Outstanding con ventana, la cobranza, el calendario), y por eso
parecía resuelto. Pero las que suman TODA cuota impaga no filtran: `getOutstandingDetalle` sin ventana,
`getOutstandingTotal`, y el Revenue con «Todo», que suma a propósito las cuotas sin fecha porque una cuota del plan sin
fecha SÍ es deuda.
**Regla:** «sin vencimiento» no alcanza para decir «devuelta» (la cuota del plan sin fecha tampoco tiene). Toda lectura
de cuotas impagas que NO filtre por vencimiento saca las devueltas con `esCuotaDevuelta` (lib/cobrado-lead.ts: impaga +
sin vencimiento + con pasarela), y pide las columnas que la regla mira (`proveedor`, `cobro_id`): sin ellas en el select,
la regla da «no devuelta» para todas y no saca nada, sin error.
**Vive en:** `lib/pagos.ts` (`getOutstandingDetalle`, `getOutstandingTotal`) · `lib/graficos-datos-extra.ts`
(`filasRevenue`) · `tests/outstanding-sin-devueltas.test.ts`.

### Contracargos: la documentación de Mercado Pago se contradice, y en Stripe la plata se lee de la disputa (15/10/2026)

**Síntoma:** un contracargo de Mercado Pago quedaba sólo en una fila de `pasarela_eventos`; Stripe ni lo escuchaba. La
plata se iba de la cuenta del negocio y la cuota seguía «cobrada».
**El diagnóstico obvio era el equivocado (el de este mismo documento, más abajo):** la decisión del 15/10 decía «en MP,
`charged_back` con `settled` es plata debitada al vendedor». Al hacerlo: la documentación de MP se CONTRADICE. La página
de contracargos de Checkout Pro dice que `settled` es una decisión en contra del vendedor y `reimbursed` a favor; la de
estados de transacción dice que `settled` es la plata devuelta al comprador y `reimbursed` acreditada al vendedor; la
de estados de orden dice que `reimbursed` es devuelto al pagador. Lo confiable es `coverage_applied` del objeto del
contracargo (otra API, otro tópico de aviso), que no está medido. **Regla:** en MP el contracargo se CUENTA (historial
y motivo, una vez por cada `status_detail`) y NO mueve la cuota hasta medirlo con las claves de prueba.
**Stripe, en cambio, lo dice sin ambigüedad**, pero no en el tipo del evento: la plata sale con
`charge.dispute.funds_withdrawn` y vuelve con `charge.dispute.funds_reinstated` (nombres verificados en
docs.stripe.com/api/events/types; uno inexistente haría fallar CONECTAR). Los avisos pueden llegar desordenados, así
que dónde está la plata se lee de la disputa RELEÍDA: sus `balance_transactions` (un retiro es negativo, un reintegro
positivo). Con la plata afuera, la cuota se desmarca como un reembolso; si vuelve, se vuelve a marcar; las dos son
idempotentes. Una disputa PARCIAL no mueve la cuota (no se parte), y un cargo ya devuelto entero tampoco.
**Y la trampa 2 de la devolución fallida se cumplió:** un contracargo llega sin que MaKo haga nada, así que poner al día
los eventos del aviso sólo al reembolsar no alcanzaba. El cron de cobros lo hace una vez por día (`esLaVueltaDelDia`, la
vuelta de las 06:17 UTC; `mantenerAvisosStripe`).
**Al probarlo rompiéndolo:** «la plata salió» mirando si hay movimientos (y no su SIGNO) pasaba el test, porque los casos
eran sólo retiro, retiro + reintegro, y nada. Hizo falta el caso de un reintegro solo.
**Vive en:** `lib/stripe-api.ts` (`EVENTOS_STRIPE`, `leerDisputaStripe`) · `lib/cobros-eventos.ts` (`faseDeDisputa`,
`planDePagoMp`) · `lib/cobros-webhook.ts` (rama `disputa`, `contracargo` de MP) · `lib/cobros.ts` (`aplicarContracargo`,
`mantenerAvisosStripe`) · `lib/cobros-reglas.ts` (`textoContracargo`, `esLaVueltaDelDia`) ·
`app/api/cron/cobros-reconciliar/route.ts` · `tests/contracargos.test.ts`.

### Una suscripción con plazo se cobraba para siempre, y el plazo del lead no sirve para reabrir (15/10/2026)

**Síntoma:** un producto del catálogo «6 meses» (`productos.suscripcion_meses`) se cobraba por la pasarela como
suscripción sin fin: al séptimo mes la tarjeta del cliente se seguía cobrando.
**Causa:** los dos checkouts nacían sin fin, y el lead se ganaba con `suscripcion_meses: null`.
**Regla:** el plazo sale del producto (aunque esté inactivo) y cada pasarela lo lleva a su manera. **Stripe:** Checkout
no acepta un fin, así que al PRIMER pago se programa `cancel_at` en el fin del período N (el ancla de facturación + N
meses, día capado como factura Stripe), sin prorrateo: se cobran N mensualidades y la N+1 no sale. Nunca tumba el pago;
si falla, el cobro dice «cancélala a mano». **Mercado Pago:** nace con `auto_recurring.end_date` un día ANTES de ese
fin, porque MP cobra desde que la persona autoriza: si autoriza tarde se pierde una mensualidad, no se cobra una de más
(en lo que es plata ajena, cobrar de menos es el error barato). Sin poder leer el plazo, la suscripción de MP no se
crea. El lead que se GANA con ese pago lleva el plazo (su `fecha_cierre` es hoy), así el MRR deja de contarla.
**La trampa:** el plazo del LEAD se cuenta desde su `fecha_cierre`. Un lead que ya era cliente y vuelve con un link de
suscripción con plazo (`reabrirSuscripcionDelLead`) tiene una fecha de cierre de hace meses: ponerle el plazo lo daba
por vencido antes de tiempo. Ahí queda sin plazo, y el fin lo marca la pasarela al cancelar.
**Vive en:** `lib/cobros.ts` (`plazoDelCobro`, `crearCheckout`, `aplicarPagoAprobado` paso 2a, `programarPlazoStripe`,
`ganarLead`) · `lib/stripe-api.ts` (`programarFinSuscripcionStripe`) · `lib/mercadopago-api.ts` (`crearSuscripcionMp`)
· `lib/cobros-reglas.ts` (`finDelPlazo`) · `tests/suscripcion-plazo.test.ts`.

### La fecha de la cuota es la del PAGO, y «cancelada» no es «terminó su plazo» (15/10/2026)

**Síntoma 1:** la cuota de un pago de la pasarela se asentaba con la fecha en que MaKo procesó el aviso. Un aviso
reintentado, o el cron que repara días después, la corría de día: un pago del 31 caía en el mes siguiente del cash.
**Regla:** la fecha es la del pago según la pasarela: el `created` del EVENTO de Stripe (cuándo pasó, no cuándo
llegó), `date_approved` en Mercado Pago, y el `pagado_at` del cobro al reparar. Sin ninguna, hoy. Lo que queda sin
fecha del pago: la conciliación de Stripe (relee la sesión, que no la tiene) usa la de hoy.
**Síntoma 2:** cancelar una suscripción de la pasarela la pasaba a «plazo = meses transcurridos, mínimo 1»; cancelada
en el primer mes, el MRR la seguía contando hasta cumplir el mes. **Regla:** queda CANCELADA CON FECHA
(`suscripcion_cancelada_at`, como la manual de b2) y el MRR no cuenta ninguna cancelada. Los meses que duró son las
mensualidades que cobró ese cobro (cada factura es una cuota), no los transcurridos (que contaban una de menos si se
cancelaba pasado el aniversario).
**La trampa que apareció al hacerlo:** con plazo en Stripe (`cancel_at`), al cumplirse Stripe borra la suscripción y
llega el MISMO aviso que una cancelación. Marcarla «cancelada» habría dicho eso en la ficha de una que simplemente
terminó. Si ya cobró todas las mensualidades del plazo, terminó: no se toca, y el historial dice «terminada».
**Vive en:** `lib/cobros.ts` (`aplicarPagoAprobado`, `aplicarSuscripcionCancelada`, `cuotasPagadasDelCobro`) ·
`lib/cobros-eventos.ts` (`eventoStripe`: `creado`) · `lib/cobros-webhook.ts` · `lib/queries.ts` (`getMrrActivo`) ·
`tests/cuota-fecha-y-cancelacion.test.ts`.

### Cambiar el email de acceso: un aviso al anterior, no un código (15/10/2026)

**El pendiente decía «falta un código al email actual»** para que quien tiene el link de la compra no pueda quedarse con
la cuenta cambiando el email. **Era el remedio equivocado:** el caso legítimo más común del cambio es que el email se
tipeó MAL al pagar, y ahí no le llega ningún código a nadie: lo bloqueaba justo a quien lo necesita. **Regla, copiada
de Google y GitHub:** el email nuevo se prueba solo (hay que entrar con Google con ESA dirección) y al anterior le llega
un aviso —el nuevo enmascarado, por si el anterior era de un desconocido— con a dónde escribir para revertirlo. Sale
después del cambio, como MaKo (la key y el remitente de la plataforma), y no frena la respuesta.
**Vive en:** `lib/invitaciones.ts` (`avisarCambioDeEmailDeAcceso`) · `app/api/pagar/email/route.ts` · `tests/pagar-publico.test.ts`.

### «Darme de baja»: un botón propio, y lo que la baja todavía NO hace (15/10/2026)

**Qué es:** «Configuración del negocio → Tu plan» (app/configuraciones/plan), con un botón «Darme de baja» propio de MaKo.
Se hizo primero con el portal de cliente de Stripe, y **Estrategia lo corrigió el mismo día**: el portal no cubre
Mercado Pago (que no tiene uno) y un botón propio cumple la Resolución 316/2018 de Argentina si aplica (el botón a la
vista, sin trámites previos, y un código de baja). La 316 nació para telefonía, internet y TV paga y se extendió a
seguros, streaming y planes de ahorro: que alcance a un SaaS para empresas no está claro, pero cumplir su mínimo es barato.
**Cómo, copiado:** Stripe (stripe.com/docs/subscriptions/canceling-pausing) y Paddle
(developer.paddle.com/build/subscriptions/cancel-subscriptions) programan la baja al FINAL del período pagado: quien pagó
el mes lo usa. Vive junto al plan, en la configuración del negocio, y son dos pasos (el botón y una confirmación que dice
qué pasa). Al terminar se ve el código de baja, que también llega por email. Mercado Pago no tiene «al final del período»:
se cancela en el acto.
**Dos trampas:** la columna `suscripcion_estado` tiene un CHECK (`activa`/`cancelada`), así que «baja pedida» (Stripe la
sigue cobrando… hasta el fin del período) vive en el `motivo` con un prefijo, como la renovación fallida; y la clave de
idempotencia de la baja NO puede ser la de cancelar en el acto (`idemBaja`): Stripe rechaza una clave repetida con otro
pedido dentro de las 24 h, y el super admin puede cancelarla del todo el mismo día.
**Lo que la baja NO hace:** dejar de cobrar no le saca el plan al workspace. No existe el estado de suscripción por
workspace (la fila «Estado de suscripción por workspace» de la tabla de abajo): la capa queda. La baja corta la plata, no
el acceso; eso sigue siendo a mano desde /admin.
**Vive en:** `app/configuraciones/plan/*` · `lib/cobros.ts` (`suscripcionDeMakoDe`, `darDeBajaMiPlan`) ·
`lib/stripe-api.ts` (`programarBajaStripe`) · `lib/cobros-reglas.ts` (`codigoDeBaja`, `textoBajaPedida`) ·
`lib/invitaciones.ts` (`mandarCodigoDeBaja`) · la API (`ver_mi_plan`, `dar_de_baja_mi_plan`) · `tests/mi-plan.test.ts`.

### Cuatro «decisiones de Martín» que no eran suyas (15/10/2026)

La tabla de abajo tenía seis filas marcadas «decisión de Martín». Pasadas por la vara de AGENTS.md (lo que copia lo que
hacen Stripe o Mercado Pago, o se contesta con lo escrito o con el código, se decide), cuatro se decidieron sin
preguntarle. Quedan suyas dos: el RFC / Stripe en Argentina (fiscal y precio) y los borradores legales.

- **El lead GANADO al que se le devuelve el pago se queda donde está.** Stripe hace lo mismo (el cliente sigue siendo
  cliente, con el cargo marcado como devuelto), y moverlo solo sería una regla escondida (memoria `mako-nada-por-detras`). Lo
  que sí pasa ya: el cobro queda «Reembolsado», la cuota se desmarca, el historial lo dice y el CRON «Pagos» dispara
  «Se devuelve un pago», así que quien quiera moverlo lo arma con una automatización visible. El monto del cierre
  queda: es lo que se vendió, no lo que se cobró.
- **Un lead de pago único que paga un link de SUSCRIPCIÓN sigue de pago único, y la mensualidad cuenta en el MRR desde
  el cobro.** Copia de Stripe: el MRR son las suscripciones activas, y una compra única no deja de existir porque
  después haya una suscripción. Pasarlo a «suscripción» sacaría el pago único de lo vendido: una
  suscripción no tiene `monto_cierre_usd` (lib/venta-tipo.ts; cambiar el tipo en la ficha lo vacía). **HECHO el 15/10:**
  `getMrrActivo` (lib/queries.ts) suma las suscripciones PAGADAS y ACTIVAS de la pasarela de los leads que no son de
  suscripción (`mrrDeLaPasarela`); las de un lead de suscripción no, porque ya las cuenta el lead. Una suscripción de la
  pasarela SIN lead (fuera del CRM) no entra.
- **Un flujo puede reembolsar: sin guarda de costo `dinero`.** Ya lo había decidido Martín el 08/10, textual: un flujo
  «que pueda hacer todo, sin limitaciones»; el dueño confirma la acción al CONFIGURAR el paso (cabecera de
  `lib/api-mako/flujo.ts`). No era una pregunta abierta.
- **Los pagos que NO creó MaKo se siguen ignorando con rastro; un CONTRACARGO se muestra, y desmarca la cuota sólo
  cuando el proveedor dice que la plata salió.** Un pago sin el token de un cobro no tiene lead: importarlo crearía
  fichas sin dueño o duplicadas. El contracargo, en cambio, es plata de un cobro nuestro: hoy queda sólo en una fila
  de `pasarela_eventos` que nadie mira. Siempre al historial del lead y al motivo del cobro. **HECHO el mismo día, con una
  corrección:** lo que esta entrada decía de Mercado Pago (`settled` = plata debitada) NO se sostiene, su documentación
  se contradice; ver «Contracargos: la documentación de Mercado Pago se contradice…» arriba. En Stripe la plata se lee
  de la disputa (sus `balance_transactions`), no de `closed`/`lost`.

*Corrida del 11/10/2026: relevamiento de 8 agentes, la base escrita a mano, 7 agentes de
implementación en un worktree propio (`C:/dev/wt-pagos`) y una rama aparte para Automations.*

---

## Lo que quedó SIN hacer, con el archivo donde vive

| Qué | Dónde |
|---|---|
| Que el corte por capa llegue a la API | las 246 rutas de `app/api` que no la miran |
| El cartel de «no está en tu plan» | los 56 call-sites de `lib/tab-access.ts` + `app/_ui/Estados.tsx:251` |
| Estado de suscripción por workspace (vencimiento, dunning) | no existe la tabla |
| Corte de gasto de IA por cliente | `modelo.ts:148` lo declara ausente |
| Separar el gasto de Claude del ws1 | `modelo.ts:145` |
| `funnel_id` en el motor de nutrición y en el CRM automático | mig 0170, `lib/nutricion*.ts`, `lib/crm-auto.ts` |
| Contraseña o segundo proveedor de login | `app/api/auth/callback/google/route.ts` |
| Atribución de referidos (`workspaces.origen = 'referido:<ws>'`), sólo con Paddle cobrando y 5+ referidos pagando | `embudo-y-high-ticket.md:401`, [referidos.md](referidos.md) § 6 |
| **Pasarela:** probar con claves REALES — si una clave restringida (`rk_`) puede leer `GET /v1/account` y si la `notification_url` de MP llega firmada; y si MP respeta el vencimiento de una preferencia que se anuló con el checkout ya abierto (`vencerPreferenciaMp`); y en qué estado queda una suscripción de MP al llegar su `end_date` (si sigue `authorized`, `mrrDeLaPasarela` la contaría después del plazo) | `lib/cobros-conexion.ts`, `lib/metodo-catalogo.ts` (tutorial), `app/api/webhooks/mercadopago/route.ts` |
| **Pasarela:** precios en moneda local en el catálogo (para que la API y las automatizaciones creen links de Mercado Pago) | `lib/productos.ts`, `lib/api-mako/areas/cobros.run.ts` |
| **Pasarela:** un contracargo de Mercado Pago se cuenta pero NO mueve la cuota: falta medir con las claves de prueba qué dice `coverage_applied` (GET del contracargo, otro tópico de aviso) y qué significan de verdad `settled`/`reimbursed` | `lib/cobros-eventos.ts` (`planDePagoMp`), `lib/cobros-webhook.ts`, `lib/mercadopago-api.ts` |
| **Pasarela:** `crear_link_pago` en la lista corta del «⚡ Acción» (necesita un control propio para el producto del catálogo) | `lib/editor-acciones.ts` |
| **Pasarela:** vender planes de MaKo a México arranca el reloj del RFC: en la Ticketera de Martín (`cobrar-mako-en-mexico`); con la A se integra la rama `pagos-mexico-guarda`, ya probada. Stripe en Argentina es «segunda ola» (modelo.ts:641) | `lib/cobros.ts` (`crearCobro`), `app/admin/dev/pricing/modelo.ts` |
| **Pasarela:** la garantía del programa grupal (`garantia-grupal`, Ticketera de Martín); y cancelar uno mismo con el portal de cliente de Stripe (decidido por Estrategia el 15/10; hasta entonces, «por email») | `app/reembolsos/page.tsx`, `app/terminos/page.tsx` §8 |
| **Pasarela:** un «Botón de baja» PÚBLICO en la home de MaKo, sin sesión. No se hizo (Estrategia, 15/10): la Resolución 316/2018 nació para telefonía, internet y TV paga y se extendió a seguros, streaming y planes de ahorro, y no está claro que alcance a un SaaS para empresas; el botón de «Tu plan» ya cubre su mínimo (a la vista, sin trámites previos, con código de baja). Si alcanzara, la pieza es un formulario público (`/baja`, linkeado desde la home y el pie de las páginas legales) que pide el email de la cuenta y manda un link firmado para confirmar la baja sin entrar, con topes por IP y por email | `app/configuraciones/plan`, `lib/cobros.ts` (`darDeBajaMiPlan`), `lib/rutas-publicas.ts` |
| **Pasarela:** la baja del plan corta la PLATA, no el ACCESO: el workspace sigue con su capa después de darse de baja (no existe el estado de suscripción por workspace, fila de arriba). Hoy el acceso se saca a mano desde /admin | `lib/cobros.ts` (`aplicarSuscripcionCancelada`), `lib/workspace.ts` (la capa) |
| **Pasarela (revisión):** un aviso de MP sin firma con el `user_id` de un negocio conectado provoca una relectura con SU token (las filas `sin-workspace` ya tienen techo: una por día, 15/10) | `app/api/webhooks/mercadopago/route.ts` |

*Corrida del 04/10/2026, 12 agentes. Las refutaciones dieron vuelta nueve afirmaciones; las
tres que más cambiaron el plan están arriba (la cuenta del runway, el margen del 47 y el
tamaño del cartel de upgrade).*

## El socio que no existe: un rótulo de una transcripción viajó a cuatro documentos (15/10/2026)

**Síntoma:** una tarjeta de la Ticketera le preguntó a Martín «¿Tu socio tiene que poder ver Strategy y Runway?». Contestó: «Que socio? No tengo ni tendré nunca un socio, olvida esto.» Si no la hubiera leído, el supuesto entraba al diseño de permisos de Strategy y de la Ticketera.

**Causa:** la transcripción del audio del 10/10 (referidos) se escribió con una línea de cabecera que decía «Dos voces: Martín proponiendo, su socio refutando». Nadie lo dijo en el audio: lo puso quien transcribió, para nombrar a la segunda voz. De ahí se copió, como dato, a `docs/fuentes-fuera-del-repo.md`, a `docs/referidos.md` («Martín y su socio», «como dijo tu socio» y hasta «Leandro es socio, no referidor», que contradice al mismo documento, donde Leandro está entre «los amigos» a los que se les cobra), a la memoria `referidos-propuesta` y a `docs/propuesta-tabs-strategy.md` («¿Quién es nosotros? Si tu socio tiene que leer estas tabs…»), que es de donde salió la tarjeta.

**El diagnóstico obvio era el equivocado:** se leía como un hecho del negocio (hay dos dueños) y era un ROTULADO. Cada documento lo citaba de otro, así que parecía confirmado cuatro veces: era una sola inferencia, copiada.

**La regla:** al transcribir, una voz que no se presenta se rotula «otra persona» (o por su nombre si lo DICE el audio), nunca por un rol inferido (socio, cliente, closer). Y una pregunta que da por hecha una persona («tu socio», «tu equipo», «tu contador») se verifica contra lo que Martín dijo, no contra un documento nuestro.

**Por qué esa tarjeta no pasaba la regla de la Ticketera (AGENTS.md, 9f4585931):** cualquier cosa escrita por Martín la habría frenado, y yo la armé desde un documento nuestro. La vara no es sólo «¿puedo contestarla con lo escrito?», es también **«¿esto sale de algo que él dijo, o de algo que escribimos nosotros?»**.

**Las dos capas, porque una regla en prosa se cumple «casi siempre»:** el prompt que extrae tareas de una reunión lo pide («QUIÉN ES CADA UNO», lib/plan-fathom.ts), y `rotuloDePersona` (lib/tarea-dueno.ts) lo frena en el saneo: un `dueño` o un `dichoPor` queda si es un invitado, quien mira el tablero o un nombre que se dijo en la reunión; un rol no queda nunca, aunque la palabra se diga en la charla. Todo lo demás pasa a «Otra persona». La regla para quien transcribe a mano está en AGENTS.md (punto 2 bis de «Lo que alguien LEE de la pantalla compartida»). Lo que NO está cubierto: una transcripción escrita a mano por un agente, fuera del producto, no pasa por ningún saneo; ahí manda la regla escrita.

**Corregido en:** `docs/referidos.md`, `docs/fuentes-fuera-del-repo.md`, `docs/propuesta-tabs-strategy.md` (la pregunta 6, contestada), la cabecera de `audio-referidos-10oct-transcripcion.md` (fuera del repo) y la memoria `referidos-propuesta`. Nada construido colgaba del supuesto: no hay rol, capa ni pantalla «para el socio»; Strategy y la Ticketera siguen siendo sólo del super admin.

**Vive en:** `docs/referidos.md` · `docs/propuesta-tabs-strategy.md` · `docs/fuentes-fuera-del-repo.md`
