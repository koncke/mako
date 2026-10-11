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

*Corrida del 04/10/2026, 12 agentes. Las refutaciones dieron vuelta nueve afirmaciones; las
tres que más cambiaron el plan están arriba (la cuenta del runway, el margen del 47 y el
tamaño del cartel de upgrade).*
