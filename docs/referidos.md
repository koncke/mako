# Referidos de MaKo — la propuesta (10/10/2026)

> **Estado: DECIDIDO por Martín el 10/10/2026, sin aplicar todavía** (la sección «El programa
> decidido», justo abajo, manda sobre el resto). Nada está prometido a nadie. El proyecto «Vender MaKo: Referidos» (P68) sigue
> **tachado** en el Plan desde el 20/09: reabrirlo es parte de esa decisión.

**De dónde sale.** Del audio del 10/10/2026 (28 min, Martín y su socio discutiendo
recomendar vs. plan agencia), transcrito en
`dashboard-marketing-main/audio-referidos-10oct-transcripcion.md` (fuera del repo, ver
[fuentes-fuera-del-repo.md](fuentes-fuera-del-repo.md)), cruzado contra
`app/admin/dev/pricing/modelo.ts` (`UNIT_V2`), `/admin/runway` y el Plan. Corrida
`wf_28690687-a62`: cuatro investigadores con búsqueda web (43 programas: Claude, Dropbox,
Superhuman, YNAB, HighLevel, ClickFunnels, Kajabi, Skool, Systeme, Tiendanube, Mercado
Pago, Hotmart, y la evidencia académica), tres diseños independientes (mínimo viable,
economía primero, atractivo), un crítico adversarial que rehizo las cuentas, y la síntesis
de abajo. **Las cuentas de las secciones 4 y 5 se recalcularon a mano después de la corrida
y dan igual.**

**La base de todas las cuentas es la IA de HOY** (Pro: contribución US$28,87/mes, LTV
US$251,17, techo de CAC US$81,50), no la del ruteo barato, porque el ruteo barato todavía
no tiene código. Entre paréntesis, la IA barata.

---

## ✅ EL PROGRAMA DECIDIDO (10/10/2026) — manda sobre todo lo de abajo

Martín cerró las decisiones el mismo día, en tres vueltas. Lo que sigue es el programa; las
secciones de más abajo son el camino y quedan como respaldo de las cuentas.

### Las tres reglas

| | Regla |
|---|---|
| **Suscripción: qué gana el que refiere** | **Cada cliente nuevo que trae le descuenta su primer mes de la suscripción, una sola vez.** Con un plan de 97: 2 clientes nuevos de 47, o 1 de 97, y ese mes no paga. Con un plan de 47: 1 de 47. Si sobra, **se acumula** para los meses siguientes: el que trae 6 de 47 en un mes tiene ~3 meses gratis por delante. Si al mes siguiente no trae a nadie, paga. |
| **Cuándo cuenta un referido** | Desde su **2º pago**. El que entra y se va al mes no le descuenta nada a nadie. |
| **Qué gana el que entra** | El **2º mes gratis**. Paga el 1º. |
| **Grupal** | **US$300 en plata** por grupal de US$1.500 (decidido), el **20% de cada cuota cobrada**: en 3 cuotas de 500, son 100 por cuota. Si el comprador pide el reembolso de la garantía, no hay comisión. Lo puede referir cualquiera, tenga MaKo o no. Por transferencia local. |
| **Plan agencia** | **Va dentro del de 97.** Cualquier cuenta de 97 puede dar de alta workspaces para sus clientes (`agencia_clientes`, mig 0175), y **cada workspace paga su plan** (47 o 97). Cada workspace nuevo es un referido de la agencia: con 2 clientes de 47, su 97 de ese mes es gratis. No hay plan de 200. |
| **Reglas comunes** | Las de la sección 1: registro previo, el origen que vale es el primero, sólo clientes nuevos, precio de lista, prohibido pautar con la palabra «MaKo». **Todo se cobra**, también a los amigos. |

### Por qué cierra (IA de hoy)

- **Un Pro referido le cuesta a MaKo ~US$73** en valor esperado: el descuento al que refiere
  (47 de lista = 44,03 netos sobre un plan de 97) por 0,7827 de llegar al 2º pago = 34,46, más
  el 2º mes gratis del referido, 43,77 × 0,8847 = 38,72. Techo: **US$81,50**.
- **El costo es por cliente, sin tope:** el que trae 30 cuesta 30 × 73 y deja 30 × 251 de LTV.
  Por eso no hace falta limitar el saldo acumulado.
- **El grupal deja ~US$890** después de la comisión y de la hora de entrega por cabeza
  (1.290 de caja − 100 − 300). Por anuncio, el mismo grupal cuesta entre ~US$500 y ~US$1.000.

### Lo que se descartó en el camino, para que no vuelva

- **El «modo cuenta»** (US$10 por mes menos por cada cliente activo): «¿quién preferiría US$10
  antes que US$47?». Un premio que necesita una cuenta para entenderse no mueve a nadie.
- **«Gratis mientras tus 2 referidos sigan pagando»:** con 2 de 47 activos MaKo pierde
  US$33,13 por mes por referidor (cobra 87,54 netos, gasta 29,80 en servirlos y deja de cobrar
  90,87). Para que esa versión no pierda plata hacen falta 4 de 47 activos.
- **Pagar plata por los referidos de suscripción:** en suscripción el premio es descuento, sin
  transferencias. La plata queda sólo para el grupal.
- **Un plan agencia de 200** y **un plan agencia con N workspaces adentro** (el de 297 con 10
  clientes es venta mayorista a US$29,70 por workspace).

### Defaults puestos sin preguntar (cambiarlos es una línea)

- El saldo **no se cambia por plata** y se pierde si el que refiere cancela.
- **Sin vencimiento** mientras sea cliente: un vencimiento castigaría justo al que trae mucho.
- Alguien **sin suscripción** que trae un cliente de software no gana nada por ese cliente: su
  canal es el grupal. Si aparece el caso (tu hermana trayendo suscriptores), se decide ahí.

---

## Primera vuelta de respuestas (10/10) — superada por «El programa decidido»

**Contestó las decisiones de la sección 8:**

1. **El plan de 47 y el de 97 existen.**
2. **El grupal** es de US$1.500, se puede pagar en cuotas, y son 3 meses de entrega.
3. **El plan agencia** lo había pensado a US$200; ahora duda entre eso e incluirlo en el de 97.
4. **Todo se cobra**, también a los amigos (Leila, Leandro, Código Inmobiliario, P2P, Brigitte).
5. **La plata se paga por transferencia local** por ahora.

**Y descartó el «modo cuenta» de los partners** (US$10 por mes menos en su plan por cada
cliente activo): «¿quién preferiría US$10 antes que US$47?». Tiene razón, aunque en valor
esperado los US$10 por mes sumen más (~US$62 en la vida de un Pro): el referidor compara
los dos números que ve, y un premio que necesita una cuenta para entenderse no mueve a nadie.
**Desde acá, todo lo que el documento dice de «modo cuenta» está DESCARTADO.**

### El programa, con eso aplicado: un solo número para todos

| | Regla |
|---|---|
| **Qué gana el que refiere** | **El primer mes de cada cliente que trae**: US$47 por un plan de 47, US$97 por uno de 97. El mismo número para un cliente común, un partner o una agencia. |
| **Cómo lo cobra** | A elección: **transferencia local**, o **saldo en su propia cuenta de MaKo**. Con saldo funciona el «un dólar, un peso» del audio: dos clientes de 47 en un mes le pagan su mes de 97. |
| **Cuándo** | 14 días después del **2º pago** del cliente que trajo. Si ese cliente se va antes, no hay premio (MaKo ya cobró un mes). |
| **Qué gana el que entra** | El **2º mes gratis**. Paga el 1º. |
| **Grupal** | **US$300 por grupal** (el 20% de 1.500). Si se cobra en cuotas, se paga el **20% de cada cuota cobrada**: en 3 cuotas de 500, son 100 por cuota. Si el comprador pide el reembolso de la garantía, no hay comisión. |
| **Reglas comunes** | Las de la sección 1 siguen igual: registro previo, el origen que vale es el primero, sólo clientes nuevos, precio de lista, prohibido pautar con la palabra «MaKo». |

**Por qué cierra, con la IA de hoy:**
- Un Pro referido le cuesta a MaKo **US$75,51** en valor esperado (47 × 0,7827 de llegar al 2º
  pago + 43,77 × 0,8847 del 2º mes gratis), contra un techo de **US$81,50**.
- Un cliente de 97 referido cuesta **US$169,93** (97 × 0,8754 + 90,87 × 0,9356, con la
  retención del 45% anual de esa banda). Pasa la regla de payback (US$158) por poco y entra
  holgado en la de 3:1 (US$272). Aceptable; no es el caso más frecuente.
- El grupal deja **US$890** después de la comisión y de la hora de entrega por cabeza
  (1.290 de caja − 100 de la hora − 300). Por anuncio, el mismo grupal cuesta entre ~US$500
  (40% de cierre) y ~US$1.000 (20%).
- Los tres casos de la sección 5.3 en «modo plata» siguen valiendo: Leila con 5 recibe ~184 en
  el año y a MaKo le quedan 587; Juanfran con 10, 368 y 1.173; tu hermana con 30, 1.104 y 3.520.

### El plan agencia: la recomendación es meterlo en el de 97, sin plan de 200

- **Qué es «agencia»:** la capacidad de dar de alta workspaces para sus clientes y verlos en
  un panel (`agencia_clientes`, mig 0175). **Cada workspace de cliente paga su plan** (47 o 97).
- **Por qué en el de 97 y no un plan de 200:** un plan aparte agrega una decisión más en la
  página de precios y un escalón que hay que justificar, cuando lo que le interesa a MaKo de
  una agencia no son sus 97 sino los workspaces que da de alta. Cada uno de esos workspaces es
  un referido: la agencia se lleva su primer mes, como cualquiera.
- **Quién paga el workspace del cliente:** puede pagarlo el cliente directo (y la agencia
  cobra el primer mes como referido), o la agencia, que lo incluye en el precio de SU servicio.
  En el segundo caso lo que cobre la agencia es asunto suyo, porque su cliente no le compra
  MaKo: le compra el servicio. El «sobreprecio» que se prohíbe es vender MaKo por encima de
  la web, no cobrar un servicio que usa MaKo.
- **Lo que NO se hace:** un plan de agencia con N workspaces adentro. Es venta mayorista y
  pierde plata (el de 297 con 10 clientes es US$29,70 por workspace; ver los hallazgos).

### Lo que seguía abierto (CERRADO arriba)
- 300 por grupal: decidido.
- El plan agencia va dentro del de 97: decidido.

---

## La propuesta original de la corrida (con el «modo cuenta», ya descartado)

**Resumen**
- **A. Recomendar** (cualquier cliente que paga). Cuando la persona que trajiste paga por segunda vez, tu factura baja lo mismo que ella pagó en su primer mes, y ella tiene el 2º mes gratis. Funciona uno a uno: un Pro que trae un Pro tiene un mes gratis.
- **B. Partners** (agencias, consultores y gente con audiencia). Por cada cliente que traen eligen una de dos cosas:
  - **Plata:** US$47 una vez, y el cliente tiene el 2º mes gratis.
  - **Cuenta:** mientras el cliente pague, su plan agencia baja US$10 por mes. Con 5 clientes pagan 47; con 10, nada.
- **Grupal, para cualquiera:** US$300 por cada grupal cobrado.
- **Cuándo:** el grupal con referidos sale **esta semana**, antes de los anuncios. El software se activa cuando Paddle cobre y se empuja **después del 15/12**. No se construye nada antes.
- **Por qué cierra:** cada paquete cuesta entre US$73 y 81 por cliente Pro. Con la IA de hoy, el techo de lo que se puede pagar por un cliente es US$81,50. La regla del audio cuesta 101,5 a 97 y 159 a 200.

---

## 1. Reglas comunes a A, B y el grupal (una sola página)

1. **Registro previo.** El que refiere te manda nombre y WhatsApp **antes** de que la persona pague o agende. Si dos registran a la misma persona, gana el primero.
2. **Los anuncios no se pagan dos veces.** Si la persona ya había entrado al CRM por otro canal en los últimos 90 días, no cuenta. El origen que vale es el primero, igual que en `docs/embudo-y-high-ticket.md:401`.
3. **Solo clientes nuevos.** Email, tarjeta, CUIT o RFC y teléfono que MaKo nunca vio. Referirse a uno mismo o entre socios no cuenta. Cada persona deja **un solo premio en toda su vida**: si cancela y vuelve, no se paga de nuevo.
4. **Nunca dos premios por el mismo cliente**, y nunca un premio sobre un mes que se regaló (es la regla de Kajabi).
5. **Precio de lista obligatorio.** Nadie vende MaKo más caro ni más barato que la web. Lo que el partner cobre por implementar o gestionar es todo suyo.
6. **Prohibido pautar con la palabra «MaKo»** y escribirle a bases compradas. Si no, el afiliado le compite el clic a tus anuncios del 1/11 (es la regla de Skool).
7. **Devoluciones.** Si un cliente pide reembolso o desconoce el cargo dentro de los 60 días siguientes a liberarse el premio, el premio se descuenta del próximo pago o del saldo.
8. **Cambios.** Las reglas pueden cambiar con 30 días de aviso, y lo ya ganado se respeta.
9. **Unidades relativas.** El acuerdo dice «el primer mes del plan que pague», no «US$47», para que sobreviva si cambia el precio.

---

## 2. Sistema A: Recomendar

| | Regla |
|---|---|
| **Quién entra** | Cualquier workspace que **paga**. Hoy es solo Mauricio; cuando haya Paddle, todos los clientes. Los amigos que no pagan van al sistema B. |
| **Qué gana el que refiere** | **Saldo igual al primer cobro del referido**: US$47 por un Pro y US$97 por uno de 97. Uno a uno: si tenés Pro, un Pro referido es un mes gratis. Si tenés el de 97, dos Pro o uno de 97. |
| **Qué gana el referido** | **US$47 menos en el 2º mes.** En Pro equivale al 2º mes gratis. El mes 1 lo paga. |
| **Cuándo se acredita** | 14 días después del **2º pago** del referido. En Pro, ese pago es el del mes 3 (alrededor del día 60), así que el saldo se acredita cerca del día 74 y se descuenta en la factura siguiente. |
| **Si el referido cancela antes del 2º pago** | No hay premio. MaKo ya cobró un mes. |
| **Si hay reembolso o contracargo** | Se descuenta del saldo. |
| **Topes** | 12 meses del propio plan por año: US$564 en Pro y US$1.164 en el de 97. Quien lo pasa es partner y se le ofrece el sistema B. |
| **Vencimiento** | El saldo no se cambia por plata. Vence a los 12 meses y se pierde si el que refiere cancela. |
| **Si el referido paga anual (470)** | Se le descuentan US$47 del anual. Al que refiere se le acredita a los 14 días del cobro, porque ya pagó 10 veces el premio. |

**Por qué el 2º mes y no el 1º.** Lo que describiste como «lo que hace Claude» (un mes gratis para cada uno) **no es lo que hace Claude**. Claude da 7 días de prueba con tarjeta y premia al que invita solo si el invitado paga. El «uno a uno» es el modelo de Superhuman y de YNAB. YNAB agrega el mes gratis **después** de pagar. Con un 11,5% de bajas por mes, el que viene a usar el mes gratis y se va igual paga un mes, y MaKo cobra el día 1.

---

## 3. Sistema B: Partners

**Quién entra:** por invitación, con el acuerdo de una página aceptado por WhatsApp.
- Juanfran y Joan (Código Inmobiliario), P2P, Leila, Teo, Brigitte, Jan y tu hermana.
- Mauricio, si quiere meter a sus 14 clientes.
- Leandro es socio, no referidor.

**Por cada cliente, el partner elige un modo al registrarlo.** Después no se cambia.

| | **Modo plata** | **Modo cuenta** |
|---|---|---|
| Qué gana el partner | **US$47 una vez** por cada Pro y US$97 por cada cliente de 97 | **US$10 menos por mes en su plan agencia** por cada mes que ese cliente paga, mientras el cliente siga pagando y sin vencimiento. El descuento no pasa de 97: con 5 activos paga 47, con 10 paga 0. |
| Qué gana el referido | 2º mes gratis (US$47 menos) | Nada de MaKo: el premio entero va al partner |
| Cuándo se paga | El día 10 del mes siguiente a la liberación, es decir, 14 días después del 2º pago del cliente. En Pro, ese pago es el del mes 3, así que cobra en el mes 4. | Se descuenta en su factura del mes. El día 1 se cuentan los activos. |
| Cancelación | Si el cliente se va antes del 2º pago, no hay premio | Ese mes, el cliente que no pagó no descuenta |
| Topes | Ninguno por cantidad: cada cliente paga su propio premio | El descuento no pasa del precio del plan. Lo razonable es poner los primeros 10 clientes en modo cuenta y del 11º en adelante en modo plata. |
| Para quién sirve | Para quien no paga MaKo: tu hermana, Jan, y los amigos mientras no se les cobre | Para quien paga el plan agencia: Juanfran, P2P, Mauricio, Leila si empieza a pagar |
| Con la IA de hoy | Cuesta US$75,51 por cliente | Cuesta US$81,29 por cliente |

**Cómo se paga la plata:**
- **Argentina:** transferencia local desde tu cuenta, contra factura C. Es una operación local: no hay factura E ni divisas.
- **México y Colombia:** Payoneer (de Payoneer a Payoneer no tiene costo) o Wise, cada trimestre o al llegar a US$94, lo que pase primero.
- **PayPal Argentina no:** pesifica al oficial y cobra US$10 + IVA.

**El plan agencia:**
- Cuesta **US$97** y es el plan de 97 con el panel de cartera de agencia (`agencia_clientes`, migración 0175). No es un cuarto plan.
- Incluye el workspace propio y uno de demo. **Cada workspace de cliente paga su plan.**
- No hay 50% de descuento en los primeros 3 meses. El descuento se gana trayendo clientes.

### El grupal (para cualquiera, aunque no tenga cuenta)

- **US$300 por cada grupal de US$1.500** vendido a alguien que el referidor registró antes de la llamada.
- Se paga 14 días después de cobrado el total. Si se cobra en cuotas, se paga el 20% de cada cuota cobrada.
- Si hay reembolso, no hay comisión o se descuenta.
- El comprador paga precio de lista: el ticket no se toca.
- En el guion de la llamada se agrega una sola pregunta: «¿Quién te recomendó?».

---

## 4. Las siete preguntas del audio

**1. ¿Meses gratis o plata?**
**Las dos, nunca sobre el mismo cliente.**
- En A, meses (saldo), sin plata.
- En B, plata **o** descuento en el plan, a elección.
- Cuestan lo mismo: entre US$73 y 81 por Pro, contra un techo de US$81,50 con la IA de hoy. Con eso entran dos de estas tres piezas, nunca las tres: 47 al partner (36,79), 2º mes gratis al referido (38,72) y crédito recurrente (unos 40 por cada US$5 por mes). Por eso los dos modos de B no se suman.

**2. ¿Cada 5 o cada 10?**
**Ninguno como escalón.** Cada cliente activo baja US$10: con 5 se paga 47 y con 10 se paga 0. Así quedan conformes los dos números que discutieron.
- Un escalón «todo o nada» se cae solo. Con 5 clientes, la probabilidad de seguir teniendo los 5 en el mes 2 es 0,8847⁵ = **54%**; con 10, 0,8847¹⁰ = **29%**.
- Ninguno de los 12 programas verificados usa «cada N». Todos premian por cliente, y ClickFunnels, Kajabi y Tiendanube cuentan clientes **activos**.

**3. ¿100% del primer mes o % recurrente?**
**SÍ al 100% del primer mes (US$47 de una vez). NO al % recurrente en plata.**
- 10% de 47 son US$4,70 por mes: ~US$40,77 en la vida del cliente. Cuesta lo mismo que 47 de una vez sin regalo al referido (41,58), pero son unas 9 transferencias y, como dijo tu socio, nadie se mueve por eso.
- 40% (HighLevel, Skool) son ~US$163 por cliente: el doble del techo.
- Lo único recurrente es el descuento sobre su propio plan, que no implica mandar plata a nadie.

**4. ¿La comisión sale de los 47 o el revendedor cobra encima?**
**Sale de los 47. NO al sobreprecio.**
- MaKo no tiene marca blanca y el cliente ve 47 en la web. Ese era tu riesgo en el 9:46 del audio.
- HighLevel solo deja poner precio propio con marca blanca total, y cobra US$497 por mes por eso. Kommo obliga a respetar el precio de lista.
- El partner gana su premio más lo que cobre por implementar («Services stay 100% yours», Brevo).

**5. ¿Plan agencia a 200, 97 o 297?**
**97.**
- **A 200:** la regla del audio cuesta US$159 por cliente (1,58×). Y «gratis con 5 activos» pierde plata con la IA de hoy: 5 × 28,87 = 144 de contribución contra 187 netos regalados, unos −43 por mes.
- **El de 297 de `modelo.ts:598`** trae 10 workspaces adentro, US$29,70 cada uno. Es una venta mayorista con 37% de descuento: una agencia con 10 clientes pagaría 297 en vez de 470, y MaKo perdería US$173 por mes. **No hay que publicarlo.**
- **A 97** coincide con el Starter de HighLevel, que es la referencia del mercado. Con 10 activos, el plan gratis le cuesta a MaKo 90,87 contra 288,70 por mes de contribución de esos clientes.

**6. ¿El miedo de «5 × 47 contra 3 meses regalados» es real?**
**A 200, SÍ. A 97, NO, salvo que además se pague el 100% del primer mes mientras la IA cueste lo de hoy.**
- La cuenta del audio compara **un** mes de ingreso con **tres** de regalo. Los 5 pagan 235 **por mes** durante ~8,7 meses: **US$1.256 de contribución** con la IA de hoy (5 × 251,17).

| Regalo | Costo | Le queda a MaKo | LTV : costo |
|---|---|---|---|
| 3 meses a 97 | 272,61 | 983 | 4,6:1 ✓ |
| 3 meses a 200 | 562,08 | 694 | 2,2:1 ✗ |
| 3 meses a 97 + 100% del primer mes | 507,61 | 748 | 2,5:1 ✗ (3,1:1 con la IA barata) |
| 3 meses a 200 + 100% del primer mes | 797,08 | 459 | 1,6:1 ✗ |

- Si la agencia es una amiga que no iba a pagar, los 3 meses solo cuestan servirla: 3 × 38,18 = **US$115**.

**7. ¿Qué pasa cuando se acaban los meses gratis?**
**No hay un día en que se acaban.**
- **Con la regla del audio:** Leila (5 clientes) pasa de pagar 0 a pagar 97 en el mes 4, cuando le quedan 5 × 0,8847³ = **3,5 activos**. Juanfran (10) da el mismo salto en el mes 7, con 4,8 activos. Ese es el «se van de MaKo» del 22:35.
- **Con el modo cuenta:** en el mes 4 Leila paga 97 − 34,6 = **62**. Juanfran paga 49 en el mes 7. El precio sube de a US$10 por cada cliente que se va.
- **En el modo plata** no hay meses gratis, así que no se termina nada.
- Esto importa porque los referidos retienen mejor **solo mientras el que los trajo sigue siendo cliente** (Van den Bulte 2018). Si se va el partner, se van sus clientes.

---

## 5. La matemática

### 5.1 Bases (`modelo.ts`, `UNIT_V2`, l. 1435-1445)

- **La base es la IA de hoy**, porque el ruteo barato no tiene código (`modelo.ts:677`).

| | IA de hoy (base) | IA barata (cuando exista) |
|---|---|---|
| Pro: neto | 43,77 | 43,77 |
| Pro: costo de servir | 14,90 | 7,47 |
| Pro: contribución por mes | **28,87** | 36,30 |
| Pro: LTV | 251,17 | 315,81 |
| Pro: techo de CAC (3:1) | **81,50** | 105,27 |

- **Retención mensual del Pro:** r = 0,23^(1/12) = **0,8847**, o sea que se va el 11,5% por mes. Vida media = 1/(1 − r) = **8,7 meses**.
- **El plan de 97 no se vende hasta el mes 13** (`modelo.ts:1445`). Por eso los clientes referidos de los casos son todos Pro.

**La torta de los 47** (la del 10:37), con la IA de hoy:

| Porción | US$ por mes |
|---|---|
| Cobro (Paddle + IVA) | 3,23 |
| Servir la cuenta | 14,90 |
| **CAC (un tercio de la contribución)** | **9,62** |
| Ganancia | 19,25 |

- 9,62 × 8,7 = ~83,7 en toda la vida del cliente. «El CAC se lo doy al que trae» quiere decir **hasta unos US$81 por Pro**.
- Los paquetes de B le dan exactamente eso al partner y a su cliente, y una sola vez.

### 5.2 Costo por cliente Pro en toda su vida, en valor esperado

| Paquete | Cálculo | Costo | Contra 81,50 | LTV : costo (hoy / barata) |
|---|---|---|---|---|
| **A: saldo + 2º mes gratis** | 43,77 × 0,7827 + 43,77 × 0,8847 | **72,98** | ✓ | 3,44× / 4,33× |
| **B plata: 47 + 2º mes gratis** | 47 × 0,7827 + 38,72 | **75,51** | ✓ | 3,33× / 4,18× |
| **B cuenta: US$10 por mes por activo** | 10 × 0,9368 × 8,675 | **81,29** | ✓ en el techo | 3,09× / 3,88× |
| Audio a 97: 3 meses cada 5 + 100% del primer mes | 3 × 90,87 / 5 + 47 | 101,52 | ✗ | 2,47× / 3,11× |
| Audio a 200 | 3 × 187,36 / 5 + 47 | 159,42 | ✗ | 1,58× / 1,98× |
| 40% recurrente (HighLevel, Skool) | 18,80 × 8,675 | 163,10 | ✗ | 1,54× |

- 0,7827 = r² es la probabilidad de llegar al 2º pago, que con el 2º mes gratis cae en el mes 3. 0,9368 = 90,87/97 pasa el descuento de lista a ingreso neto perdido.
- **El grupal:** con el cierre del 20% que usa `modelo.ts:1711`, el anuncio cuesta 100 ÷ 0,5 ÷ 0,2 = **~US$1.000 por grupal**. El referido cuesta 300 y le deja a MaKo **US$990** de los 1.290 netos. El runway («2.000 ÷ 100 = 10 ventas») supone que cierra el 100% de los que se presentan, y por eso el premio de 200 se quedaba corto.
- **Gatillo en el 2º pago y no en el 3º:** en el peor caso (el cliente paga el mes 1 y el 3 y se va), MaKo pierde **US$4** por cliente con la IA de hoy (42,84 − 47). Demorar 30 días más la plata del partner para ahorrar eso no vale la pena.

### 5.3 Tres referidores reales (año 1, con la IA de hoy y entre paréntesis la IA barata)

**Cómo se rehace:**
- Meses pagos esperados en el año 1: (1 − 0,23) / (1 − 0,8847) = **6,68**.
- Contribución por cliente en el año 1, sin mes gratis: 6,68 × 28,87 = **192,85**.
- Con el 2º mes gratis: 192,85 − 0,8847 × 43,77 = **154,13**. Con la IA barata: 242,48 y 203,76.
- Premio esperado en modo plata: 47 × 0,7827 = **36,79**.
- Descuento esperado en modo cuenta: 10 × 6,68 = **66,80 de lista** (62,58 netos) por cliente, con el tope de 97 por mes.
- Supuestos: todos los clientes entran en el mes 1, nadie repone clientes y nadie trae un plan de 97.

| Referidor | Modo | Recibe en el mes 1 | Recibe en el año 1 | **Le queda a MaKo en el año 1** | Con la regla del audio (a 97): recibe / le queda |
|---|---|---|---|---|---|
| **Leila trae 5** | Plata | US$0 en mano; US$235 ganados que cobra en el mes 4 | **US$184** en plata (máx. 235) | **US$587** (835): 5 × 154,13 − 5 × 36,79 | 526 / 457 (705) |
| Leila trae 5 | Cuenta (si paga 97) | Paga 47 en vez de 97 | **US$334** de descuento: paga 830 en vez de 1.164 | **US$651** (899): 964,25 − 312,90 | |
| **Juanfran trae 10** | Cuenta | **Paga 0** (descuento 100, tope 97) | **US$665** de descuento = 97 + 100 × (6,68 − 1). En el mes 12 paga 71 si no trajo a nadie más. | **US$1.305** (1.802): 1.928,50 − 623,00 | 1.052 / 913 (1.410). En el mes 7 pasa de 0 a 97. |
| Juanfran trae 10 | Plata | US$0; 470 ganados | **US$368** (máx. 470) | **US$1.173** (1.670) | |
| **Tu hermana trae 30** | Plata (no tiene plan agencia) | US$0; 1.410 ganados | **US$1.104** (máx. 1.410) | **US$3.520** (5.009): 30 × 154,13 − 30 × 36,79 | 1.410 / 4.376 (5.864) |

**Contra la pauta.** Los mismos clientes comprados por WhatsApp a US$83 cada uno, pagados **antes**, dejarían US$549, 1.099 y 3.296 en el año 1. El referido deja lo mismo o más, y se paga **con plata que el cliente ya pagó**.

**El caso de tu hermana.** La regla del audio le deja más a MaKo en el año 1 (4.376 contra 3.520). La diferencia es el 2º mes gratis de sus 30 referidos, que cuesta 1.162. Es una apuesta deliberada: su base son contactos débiles y MaKo es una marca chica. En ese caso, que el referido también gane es lo que saca la sospecha de «me lo vende porque cobra» (Verlegh 2013; Jin y Huang 2014) y sube la conversión (Gershon 2020).

---

## 6. Qué se hace a mano desde ya y qué se construye después

### A mano, esta semana: cero código, unas 3 horas

1. **El acuerdo de una página** (1 h): reglas comunes, A, B y el grupal. Lo puedo redactar.
2. **Una planilla de Google «Referidos»** (30 min).
   - Pestaña *Registros*: fecha de registro, referidor, persona (nombre y WhatsApp), ¿estaba en el CRM en los últimos 90 días?, producto (Pro, 97, grupal), modo (plata o cuenta), 1er pago, 2º pago, estado, premio, fecha de liberación y pagado (fecha y medio).
   - Pestaña *Mes*: activos en modo cuenta por partner, con la fórmula `=MIN(97;10*activos)`.
3. **Mensajes uno a uno, no una difusión** (1,5 h). Primero Jan, Juanfran y tu hermana (por el grupal); después Mauricio, Leila, Teo, P2P y Brigitte. Plantilla:
   > «[Nombre], armé algo para vos. Si alguien que me presentás compra el grupal, te llevás US$300 cuando esté cobrado. Pasame nombre y WhatsApp antes de que agende y queda a tu nombre. Te paso las reglas en una página.»

   Si confirmaste 47 y 97, se agrega: «Cuando abramos la suscripción, también te llevás el primer mes de cada cliente que pague».
4. **Guion de la llamada del grupal:** «¿Quién te recomendó?», anotado en la planilla antes de cobrar.
5. **Ritual mensual:** el día 1, 20 minutos para contar activos y liberar premios. El día 10, los pagos.

### Cuando Paddle cobre, todavía a mano

- El 2º mes gratis del referido se carga como un descuento de 100% por un período en su suscripción.
- El saldo del sistema A, como un descuento fijo de US$47 por un período.
- El modo cuenta, como un descuento fijo de 10 × activos que se actualiza a mano cada mes.
- Antes de prometerlo, hay que probar en sandbox que esos descuentos se pueden aplicar a una suscripción que ya existe.

### Qué se construye y cuándo

| Disparador | Qué se construye |
|---|---|
| Paddle cobrando **y** 5 o más referidos pagando | `workspaces.origen = 'referido:<ws_id>'`, sellado en el alta: es el mismo campo de `docs/embudo-y-high-ticket.md:401`, no una tabla aparte. Además, la atribución automática de los workspaces de clientes que da de alta una agencia, usando `agencia_clientes`. |
| Más de 10 partners activos, o más de 2 h por mes de planilla | **Tolt**: US$69 en Basic con pagos manuales, US$99 en Growth con pagos automáticos y 2% de comisión. Su ayuda tiene guía para Paddle Billing; hay que confirmarlo en el trial de 14 días. **Rewardful no**: solo funciona con Paddle Classic. |
| Que exista el alta sin intervención de Martín | «Hecho con MaKo» con el link del dueño en lo que ven sus leads (agenda, reportes), que fue la palanca de Dropbox y Superhuman. Y el mensaje «te refirieron, ahora referí vos» en la bienvenida: +21% de referidos según Gershon y Jiang (2024). |
| El ruteo barato de IA en producción | Recién ahí sube el techo a 105,27 y se pueden revisar los montos. |
| **Nunca antes de 20 referidos pagando** | Ni panel, ni pestaña «Gana dinero», ni niveles, ni comisión de segundo nivel, ni página pública de afiliados, ni venta mayorista. |

---

## 7. Calendario: el grupal antes, nada nuevo durante, el software después

| Cuándo | Qué | Por qué |
|---|---|---|
| **13/10 al 20/10** | Lanzar **solo el grupal con referidos**: acuerdo, planilla y 3 mensajes. | Es lo único que puede traer caja antes del 30/11. Es vender, no construir, y no cuesta nada si no hay venta. Una venta referida deja US$990, lo mismo que unos 6 clientes Pro en todo un año. |
| **1/11 al 30/11** | Nada nuevo. Corren el ritual y las llamadas que ya hacés. **No se empuja el software.** | Ese mes es para los anuncios. Un referido de software deja 47 en noviembre y pide 47 de premio en febrero: no aporta caja neta a la ventana, y cada alta sin pasarela es una cuenta y un cobro a mano. |
| **1/12 al 15/12** | Igual que noviembre. Si Paddle ya cobra, se respeta a quien llegue por referido. | |
| **15/12: decisión de seguir o congelar** | Con **menos de 3 ventas referidas** (grupal o software), el programa queda congelado en la planilla y no se construye nada. Con 3 o más, y con Paddle y los precios confirmados, el sistema A se abre a todos los clientes que pagan y corren los disparadores de la sección 6. | Es la regla de Leila: construir el software hoy es un «puede ser», así que no se hace. |

No uso el dato de «45-50 días hasta la primera venta de un partner»: la revisión no lo encontró en las publicaciones de PartnerStack.

---

## 8. Lo que te queda decidir

1. **¿Existen el plan de 47 y el de 97, y cuándo cobra Paddle?** El 20/09 quedó escrito «MaKo 47 deja de existir», y el audio de hoy vuelve a 47 y 97.
   **Recomendación:** decidilo antes del primer mensaje. Mientras no haya Paddle, a la gente solo se le habla del grupal. Si el de 47 no vuelve, A y B quedan para el de 97 y el grupal, y el acuerdo no cambia porque está escrito en unidades relativas. Ojo: Paddle **no acepta** el grupal, porque es coaching (`docs/embudo-y-high-ticket.md:547`). El grupal se cobra por otro lado.
2. **¿Cuánto se paga por grupal: 200 o 300?**
   **Recomendación: US$300** (20% de la lista), cuando esté cobrado el total más 14 días. Contra un anuncio de ~US$1.000 por grupal, 200 se queda corto en lo único que mueve caja.
3. **¿Qué es el plan agencia?**
   **Recomendación:** US$97, el plan de 97 con el panel de agencia, y cada workspace de cliente paga su plan. Los workspaces de clientes que ya tiene Código Inmobiliario **cuentan como referidos de Juanfran** desde que empiecen a pagar, porque los trajo él.
4. **¿Se les empieza a cobrar a los amigos** (Leila, Leandro, Código Inmobiliario, P2P, Brigitte)?
   **Recomendación:** no decidirlo a través de este programa. El programa funciona igual: mientras no paguen, eligen el modo plata. Si les vas a cobrar, avisá con 60 días y con el modo cuenta disponible. Si se van ellos, se van los clientes que trajeron.
5. **¿Cómo se paga la plata?**
   **Recomendación:**
   - En Argentina, transferencia local contra factura C. Quien no factura acumula hasta 12 meses o elige el modo cuenta.
   - En México y Colombia, Payoneer o Wise, cada trimestre.
   - PayPal Argentina no.

---

## 9. Fuentes de cada decisión

- **Premiar recién cuando el referido pagó y pasó el reembolso:**
  - Pipedrive (US$100 cuando el referido pagó 100): https://www.pipedrive.com/en/referral-program-terms
  - Proton (30 días después del primer ciclo): https://proton.me/legal/terms-referral-program
  - Later: https://later.com/blog/later-link-referral-program/
  - Google Workspace (90 días pagos): https://workspace.google.com/landing/partners/referral/faqs/
- **El mes gratis al final, no al principio:** YNAB: https://support.ynab.com/en_us/referral-program-an-overview-BJWpA9Rc
- **El «uno a uno» real:**
  - Superhuman: https://new.superhuman.com/two-ways-to-get-superhuman-for-free!-265980
  - Lo que hace Claude en realidad: https://support.claude.com/en/articles/13456702-claude-code-and-cowork-guest-passes
- **El 100% del primer mes una vez, y nunca premio más comisión por el mismo cliente:**
  - Kajabi: https://help.kajabi.com/articles/resources/kajabi-partner-program/partner-program-overview y https://help.kajabi.com/articles/resources/kajabi-partner-program/kajabi-partner-program-faq
  - Semrush (pago único): https://www.semrush.com/lp/affiliate-program/en/
- **Beneficio atado a clientes activos, no a altas acumuladas:**
  - ClickFunnels: https://support.myclickfunnels.com/docs/cf-affiliate-overview
  - Tiendanube: https://ayuda.tiendanube.com/es_AR/socios-comerciales/como-se-calculan-las-comisiones-en-el-partners-program-agencies-de-tiendanube
- **El recurrente de 40% que no cierra, y las condiciones que sí se copian** (mínimo de cobro, devolución del premio, 45 días):
  - https://www.gohighlevel.com/affiliate-policy
  - https://support.myclickfunnels.com/docs/cf-affiliate-the-clickfunnels-affiliate-45-day-cooling-off-period
- **Precio de lista obligatorio y sin sobreprecio:**
  - Kommo: https://support.kommo.com/docs/what-is-the-kommo-partner-program
  - Brevo: https://www.brevo.com/partners/agencies/
  - HighLevel (SaaS Mode a US$497): https://www.gohighlevel.com/pricing
- **Prohibido pautar con la marca:** Skool: https://help.skool.com/article/33-how-to-refer-others-to-skool
- **Premio para los dos lados, contactos débiles y marca chica:**
  - Verlegh 2013: https://scholar.korea.ac.kr/handle/2021.sw.korea/101713
  - Jin y Huang 2014: https://ideas.repec.org/a/eee/ijrema/v31y2014i1p107-116.html
  - Gershon 2020: https://source.washu.edu/2020/07/research-shows-how-businesses-can-win-more-customers-influence-your-friends/
- **Si se va el que refiere, se van sus referidos:** Van den Bulte 2018: https://faculty.wharton.upenn.edu/wp-content/uploads/2017/07/VdB-et-al.-JMR-2018.pdf
- **El referido vale ~16% más, no el doble:** Schmitt 2011: https://faculty.wharton.upenn.edu/wp-content/uploads/2012/04/Schmitt-Skiera-vandenBulte-2011-Referral-Programs-Customer-Value.pdf
- **Herramientas:**
  - Rewardful solo funciona con Paddle Classic: https://help.rewardful.com/en/articles/6252551-integrating-rewardful-with-paddle
  - Tolt con Paddle Billing: https://help.tolt.com/en/articles/8455444-how-to-set-up-paddle-billing-with-tolt
  - Descuentos de Paddle: https://developer.paddle.com/api-reference/discounts/overview
- **Cómo pagar:**
  - Wise a pesos argentinos: https://wise.com/help/articles/2962718/ars-transfers
  - Payoneer en Argentina: https://www.payoneer.com/es/resources/estrategias-para-usar-y-mover-tus-fondos-en-argentina/
- **«Hecho con MaKo» como palanca:** deck de Dropbox: https://www.slideshare.net/slideshow/dropbox-startup-lessons-learned-3836587/3836587

---

## 10. Lo que no está medido

- **La retención del 23% anual es un promedio de mercado (ChartMogul), no un dato de MaKo**, que tiene un solo cliente pagando. Los netos de 43,77 y 90,87 son supuestos. Una diferencia de ±5% contra el techo no decide nada. Lo que sí decide es que la regla del audio a 200 se pasa por ~2 veces.
- **Las cuentas son conservadoras:** los referidos retienen igual que el promedio, aunque Schmitt mide ~18% más. Y el descuento del modo cuenta se valúa como ingreso perdido aunque el amigo no fuera a pagar.
- **El 20% de cierre del grupal** es el supuesto de `modelo.ts` para el closer, no un dato medido de tus llamadas.

**Para docs/hallazgos:**
- (a) `modelo.ts:1439` dice que el techo con la IA de hoy es 81,50, pero su propia fórmula da 83,72 (28,87 × 8,7 / 3). Usé el 81,50 porque es el más conservador.
- (b) El plan Agencia de 297 solo existe en la tabla vieja `UNIT`, no en `UNIT_V2`. No hay que mezclarlas.
- (c) El plan de 97 «no se vende hasta el mes 13» (`modelo.ts:1445`), así que todo referido de software es Pro.
- (d) Paddle no acepta el grupal (`docs/embudo-y-high-ticket.md:547`): la comisión del grupal no puede pasar por Paddle.
