# Cómo cobrar MaKo: estructura, pasarela y cómo llega la plata
> Investigación del 24/10/2026, pedida por Martín: «quiero la mejor estrategia financiera… tengo recursos en Paraguay, en Brasil, y en todo caso podría con una LLC».
> Seis líneas en paralelo, cada dato con su fuente y su fecha. **Es un relevamiento de hechos públicos, no un consejo profesional: la decisión la firma un contador.**

---

Aclaración, una sola vez: esto es un relevamiento de hechos públicos, cada uno con fuente y fecha, hecho para que llegues a un contador con las opciones medidas y las preguntas correctas. No somos contadores ni abogados y la decisión la firma un profesional.

---

# El titular: el diagnóstico obvio era el equivocado

Entraste a esto buscando una estructura afuera. La medición dice que **el problema no está afuera, y la estructura afuera no lo arregla: lo encarece.**

Dos hechos cambiaron el tablero y son de los últimos seis meses:

1. **La brecha cambiaria está en ~1-2%, no en 30%.** Al cierre del 23/10/2026: oficial BNA 1.500/1.550, MEP ~1.552-1.562 (brecha 1,7-2,1%), blue 1.565 (0,96%), CCL 1.648 (7,8%) — El Cronista e Infobae, 22-23/10/2026. Durante años elegir mal el riel te costaba un tercio de la facturación; hoy te cuesta entre 1 y 3 puntos.
2. **Podés quedarte los dólares, sin tope, y el banco no te puede cobrar comisión.** Texto ordenado "Exterior y Cambios" del BCRA, punto 2.2.2.1, versión 8ª, Comunicación "A" 8481, vigente desde el 15/09/2026. El tope de US$36.000 anuales se eliminó (Com. "A" 8330, 18/09/2025) y la excepción se extendió a todos los conceptos de servicios (Com. "A" 8417, 09/04/2026).

Y el hecho que mata las tres rutas de afuera: **Argentina grava a sus residentes por renta mundial.** Mientras vivas acá, la ganancia de una sociedad del exterior se te imputa igual, aunque no la retires (art. 130 de la Ley de Ganancias). Una LLC unipersonal cae por el inciso e) sin condiciones que cumplir, porque para el IRS no es contribuyente. Paraguay cae por el inciso f) con presunción **que no admite prueba en contrario**, porque está en el listado de jurisdicciones de baja o nula tributación de ARCA (PDF oficial, puesto 36 de 41, leído 24/10/2026).

Traducido: la estructura afuera no reemplaza el impuesto argentino. **Lo suma.**

---

# El titular, puesto a prueba: las tres objeciones de Martín (24/10, a la tarde)

Martín leyó el titular y puso tres objeciones. Las tres son correctas como hechos, y **ninguna cambia la
recomendación**: dos porque el cuerpo del informe ya las contemplaba y el titular las tapaba, y una porque mueve
el calendario, no el destino.

**1. «No puedo tener monotributo si voy a cobrar mucho; el monotributo te restringe por categorías y luego ya es
responsable inscripto.»** Correcto, y está en §2 aunque el titular no lo dijera: el techo de la categoría K es
ARS 126.610.838,75 al año — **US$81.700** al dólar vendedor BNA de 1.550 del 23/10/2026, US$84.400 al comprador de
1.500 que usa la Factura E. Y el monotributo se encarece hacia arriba: en K la cuota sola son ~US$12.900 al año,
~15% de la facturación. El camino es 8,4% → 15% → 22-24%.

Lo que no cambia: **arriba del techo Argentina sigue ganando.** La segunda tabla de §2 ya corre US$200.000 con
responsable inscripto y da **US$70 a US$72 de cada US$100**, contra ~US$69 de la LLC y US$65-74 de Brasil y
Paraguay — y esos tres son ANTES del impuesto argentino, que se paga igual por renta mundial. O sea: «monotributo»
era el envase de la recomendación, no su motivo. El motivo es que ninguna estructura de afuera te saca del fisco
argentino mientras vivas acá.

**2. «¿Y además en Argentina no podría tener Stripe?»** No podés, y queda confirmado: **Argentina no es un país
habilitado por Stripe.** En toda América Latina Stripe soporta directamente sólo a México y Brasil; la ruta que
venden los blogs es abrir una LLC en EE.UU. y poner Stripe debajo (verificado el 24/10/2026).

Pero mirá que **la recomendación no usa Stripe en ningún paso**, y no fue casualidad: justamente porque no está
disponible, el informe eligió *merchant of record*. Paddle y Creem no son pasarelas tuyas: **le venden ellos al
cliente final, en su nombre y con su entidad**, se hacen cargo del IVA de cada país, y te giran una transferencia.
Que vos estés en Argentina les da igual, porque el que cobra no sos vos. Y los dos te aceptan: Creem lista
Argentina entre sus 86 países soportados, con transferencia bancaria local disponible en todos
(docs.creem.io/merchant-of-record/supported-countries, 24/10/2026), y Paddle dice textual que trabaja con
«software businesses anywhere in the world» salvo una lista de prohibidos donde **Argentina no está** (están Cuba,
Haití, Nicaragua y Venezuela; paddle.com/help, 24/10/2026). Para los clientes argentinos, Mercado Pago, por la
razón de §1 punto 3: a un argentino la tarjeta internacional le encarece el plan de US$47 a ~US$71 y te mata la
conversión.

Si algún día necesitás Stripe de verdad — y hay un solo caso, cobrar EN NOMBRE de tus clientes con Stripe Connect,
que ningún merchant of record hace — ahí la LLC deja de ser un gasto inútil y pasa a ser el precio de entrada. Hoy
no lo necesitás.

**3. «El programa de US$1.500 no va por pasarela: ese va por llamada de ventas y yo cobro por otros medios.»** De
acuerdo, y el informe ya lo pedía por el lado contrario (§1, punto 7): **los merchant of record excluyen los
servicios con intervención humana.** Stripe lo dice textual para su propio MoR — no soporta «servicios
profesionales, como consultoría, marketing, diseño, desarrollo o soporte técnico», y «si tu servicio involucra
intervención humana (como coaching 1 a 1 en vivo), no califica como producto digital». Si el programa tiene
llamadas, no entra. Cobrarlo por fuera no es una concesión: es la única forma que no te expone a que te cierren la
cuenta con tu saldo adentro.

Dos consecuencias que sí mueven números, y van acá porque salen de esta aclaración:

- **La comisión de pasarela deja de pesar sobre la parte grande de tu facturación.** Las tablas de §2 cobran
  5,3-6,1% sobre TODO. Si el programa de US$1.500 sale por transferencia o Mercado Pago, esa parte paga ~0-1,8% en
  vez de ~6%. Cuanto más pese el programa en tu mezcla, más barata es la ruta argentina y más grande la diferencia
  contra las otras tres.
- **Pero el techo del monotributo llega mucho antes de lo que sugieren las tablas.** La Factura E del programa
  computa igual: **cuatro ventas por mes de US$1.500 son US$72.000 al año**, y esa línea sola ya te deja a un paso
  del techo sin contar una sola suscripción. Traducido: planificá como responsable inscripto desde el arranque y no
  armes nada que dependa de seguir siendo monotributista. El control mensual de §1 punto 6 deja de ser «por si
  acaso» y pasa a ser el número que mirás todos los meses.

**Lo único que esto sí mueve de la recomendación:** el disparador para volver a abrir este expediente ya no es
«cuando cruces US$70.000». Con el programa vendiendo, lo cruzás en el primer trimestre. El disparador pasa a ser
**la primera venta del programa**: ahí se habla con el contador de Economía del Conocimiento (§3, «el paso 2»)
antes de que el salto a responsable inscripto te agarre sin estructura armada.

---

# 1. Qué hacer el lunes

Esto no espera ninguna estructura y se hace en días. Hoy no cobrás en línea y eso es plata que no entra todos los días.

**1. Poné las columnas de pricing en la página de venta.** Los tres precios visibles (US$47, US$97, y el programa de US$1.500 en 3 cuotas) con un botón por columna. Sin eso, todo lo demás no tiene dónde hacer clic.

**2. Aplicá a Paddle y a Creem el mismo día, en paralelo.** Ninguno de los dos publica la lista de países desde los que acepta vendedores: Paddle solo publica la lista de **prohibidos** (paddle.com/help, leído 24/10/2026 — Argentina, Paraguay y Brasil no están), y Creem lista Argentina entre sus 87 países (docs.creem.io, 24/10/2026). Se sabe si te toman cuando aplicás. El que apruebe primero, va. Los dos son *merchant of record*: facturan ellos al cliente final, se hacen cargo del IVA de cada país, y vos recibís una sola transferencia. Precios: Creem 3,9% + US$0,40 y nada más; Paddle 5% + US$0,50 (páginas oficiales, 24/10/2026).

**3. Habilitá el checkout de Mercado Pago para tus clientes argentinos, con acreditación a 35 días.** 1,49% + IVA = **1,80%**, contra 6,29% + IVA = 7,61% si querés la plata al instante (mercadopago.com.ar, 24/10/2026). Es cuatro veces más barato que cualquier merchant of record. Y hay una razón más fuerte que el precio: un argentino pagando US$47 con tarjeta internacional carga IVA 21% sobre servicio digital del exterior y, si sigue vigente la percepción del 30% (RG 5617 — **las fuentes de 2026 se contradicen sobre esto**), el plan de US$47 le termina saliendo el equivalente a US$71. La conversión se te muere. A los argentinos, cobráles en pesos.

**4. Confirmá en el banco una caja de ahorro en dólares a tu nombre** y declarala en ARCA. Es el requisito i) del punto 2.2.2.1: los fondos tienen que acreditarse en cuenta en moneda extranjera de tu titularidad en entidad financiera local. Y pedí la **exención del impuesto al cheque** (opción "4 – Débitos y Créditos… Sujetos inscriptos en el Régimen Simplificado"): son 1,2% sobre todo lo que entra si no la pedís.

**5. Pedí la exención de Ingresos Brutos por exportación de servicios** en tu jurisdicción. En CABA hay que tramitarla ante AGIP, **no es automática**. En provincia de Buenos Aires la actividad directamente no está gravada.

**6. Poné un control mensual de facturación.** El escalón está a **~US$84.400 anuales** (techo de la categoría K: ARS 126.610.838,75 al dólar comprador BNA de 1.500 del 23/10/2026). A US$47 y US$97 por mes, son unos 100 a 150 clientes activos. Ese es el número que te dice cuándo esta conversación deja de ser teórica.

**7. El programa de US$1.500 NO lo cobres por el merchant of record hasta confirmarlo por escrito.** Stripe lo dice textual en su página de elegibilidad: no soporta "servicios profesionales, como consultoría, marketing, diseño, desarrollo o soporte técnico", y "si tu servicio involucra intervención humana (como coaching 1 a 1 en vivo), no califica como producto digital". Si el programa tiene llamadas, rompe el supuesto en el que se apoyan todos los MoR. Ese cobro va por Mercado Pago o transferencia, con Factura E.

**8. Configurá los payouts al ciclo más corto que te den y no acumules saldo afuera.** El punto 2.2.1 del mismo texto ordenado del BCRA sigue exigiendo **ingresar** los cobros en 20 días hábiles desde su percepción en el exterior. Lo que se eliminó es la obligación de *liquidar* (pasar a pesos), no la de *ingresar*. Dejar seis meses de saldo en Paddle facturando vos es un incumplimiento cambiario.

---

# 2. Las cuatro rutas, en números

Supuestos explícitos, porque sin ellos el número es humo: ticket promedio US$47 (más transacciones, el cargo fijo pesa más), clientes de LatAm y España pagando con tarjeta "internacional", dólar 1.500 (comprador BNA del 23/10/2026, que es el que ARCA usa para la Factura E), y margen operativo 75%. Todos los precios de pasarela leídos el 24/10/2026 en las páginas oficiales.

### Sobre US$50.000 al año

| Ruta | Pasarela | Impuesto | Estructura | Traer la plata | Se va | **Queda de cada US$100** |
|---|---|---|---|---|---|---|
| **Argentina directo** (monotributo H) | 5,75% Creem / 6,06% Paddle | **8,36%** | 0% | 0,7-1,1% | 14,1-15,5% | **US$84,50 a US$85,90** |
| **LLC de EE.UU.** (Delaware vía Atlas) | 6,06-6,24% | 12-19% (Ganancias por escala) | 1,3-1,8% | 0,2-0,7% | 20-28% | **US$72 a US$80** |
| **Brasil** (Lucro Presumido, con procurador) | 6,84% Stripe BR | 16,9% | 2-7,4% | IOF 1,1-3,5% | 27-35% | **US$65 a US$73** · y Argentina todavía no cobró |
| **Paraguay** (EAS, dueña tu hermana, con sustancia) | 6,06% | 10,8% | **31,2%** | 0,5-1% | ~49% | **~US$51** · y Argentina todavía no cobró |

### Sobre US$200.000 al año

| Ruta | Pasarela | Impuesto | Estructura | Traer | Se va | **Queda de cada US$100** |
|---|---|---|---|---|---|---|
| **Argentina directo** (responsable inscripto) | 5,3-6,06% | 22-24% | 0% | 0,2-0,3% | 28-30% | **US$70 a US$72** |
| **LLC de EE.UU.** | 6,06-6,24% | ~24% | 0,3-0,5% | 0,2% | 30-31% | **~US$69** |
| **Brasil** | 6,84% | 17,6% | 0,5-1,9% | 1,1-3,5% | 26-30% | **US$70 a US$74** · más Argentina encima |
| **Paraguay** | 6,06% | 14,8% | 7,8% | 0,5-1% | ~29% | **~US$70** · más Argentina encima |

**Cómo leer estas tablas, que es lo que importa.** A US$50.000 Argentina directo gana por 10 a 35 puntos: no hay discusión. A US$200.000 las cuatro convergen en 28-31%… **pero en las tres rutas de afuera ese número es ANTES del impuesto argentino**, que se paga igual por renta mundial. Con el impuesto argentino arriba, las tres pierden en los dos escenarios.

**De dónde salen los números clave, con fuente:**
- **Monotributo cat. H:** cuota servicios ARS 522.706,68/mes × 12 = ARS 6.272.480 = US$4.182 (tabla de ARCA vigente desde el 1/8/2026, replicada de forma coincidente por calcular.ar, fiscal.com.ar y el Consejo Profesional de Entre Ríos, leída 24/10/2026). IVA cero por exportación, derechos de exportación cero desde el 1/1/2022, Ganancias sustituido por el monotributo. Dato para tener presente: **el monotributo se encarece hacia arriba** — en la categoría K la cuota sola son ARS 1.614.446,04/mes = ~US$12.900 al año, o sea ~15% sobre una facturación de US$84.000. El camino es 8,4% → 15% → 22-24%.
- **Responsable inscripto:** Ganancias sobre la ganancia neta, escala de 9 tramos del 5% al 35%, con deducciones del segundo semestre 2026 de ~ARS 27,1 M. Advertencia honesta: **la tabla oficial del 2º semestre 2026 no la encontramos** y hubo que reconstruirla. Margen de error estimado ±5%, o sea ±US$2.000. La diferencia entre 8% y 22% no se mueve por eso; el decimal sí.
- **Paraguay:** EAS gratis y en 72 horas (ficha oficial del Ministerio de Industria y Comercio, mic.gov.py). IRE General 10% sobre renta neta, IDU 8% al distribuir a tu hermana (residente) o 15% a vos (no residente) — arts. 21, 41 y 43 de la Ley 6380/2019. Los US$15.600 de costos locales (una persona trabajando allá, contador, varios) son **una estimación de orden de magnitud, no un dato**: no conseguimos un solo tarifario confiable. Y a US$50.000 ese costo fijo se come el beneficio completo.
- **Brasil:** Lucro Presumido, presunción 32% para servicios, IRPJ 15% + adicional 10% sobre lo que pase de R$60.000 por trimestre, CSLL 9%. PIS/COFINS e ISS no inciden sobre exportación. Más **10% de retención al remesar dividendos al exterior, sin mínimo exento**, por la Lei 15.270/2025 (sancionada 26/11/2025, vigente 2026). Stripe Brasil 3,99% + 2% tarjeta internacional + 0,7% de Billing ≈ 6,84%, y gira **obligatoriamente en reales a una cuenta brasileña del mismo CNPJ**: la plata queda en Brasil.
- **LLC:** Stripe Atlas US$500 una vez (solo Delaware), después US$100/año de agente registrado + US$400/año de impuesto estatal de Delaware (6 Del. C. § 18-1107(b), subió de US$300 por la House Bill 400 firmada el 21/05/2026) + US$150-400 del Form 5472. Wyoming sale US$310-560/año y New Mexico US$250-500. Impuesto federal estadounidense: US$0 si no hay actividad en EE.UU.

---

# 3. La ruta que recomiendo

**Argentina directo. Monotributo, Factura E, un merchant of record para el mundo, Mercado Pago para los argentinos, y SWIFT a tu caja de ahorro en dólares.**

**Por qué.** Es la más barata de las cuatro en los dos escenarios, no necesita que ningún fisco acepte ninguna explicación, y — el punto decisivo — **no te cierra ninguna puerta**. Las otras tres te obligan a decidir antes de saber si MaKo escala; esta la podés tener andando el viernes y recién discutir la estructura cuando cruces los US$70.000 anuales.

Y hay una razón que no es de plata: con los dólares entrando a tu nombre, a tu cuenta, con tu Factura E, **el acceso a la caja de MaKo no depende de la relación con nadie**.

**Cuánto tarda y cuánto cuesta armarla.** Días, no semanas. Costo de estructura: **US$0**. Costo real: los honorarios de tu contador para las dos exenciones (impuesto al cheque e Ingresos Brutos) y el trámite del CBU. El cuello de botella no es la plata, es la aprobación de la pasarela: por eso aplicás a dos en paralelo el mismo día.

**Qué pasarela, concretamente.** Creem es la más barata del lote (5,75% todo incluido, incluido el 1% del giro) pero es una empresa chica y joven, y su "+0% tarjetas internacionales, +0% suscripciones" sale de **su propia página de comparación contra Stripe**, que es marketing, no de su tabla de tarifas. Paddle sale 6,06%, es la más vieja y grande del grupo, acepta Pix de Brasil y tiene merchant of record en más de 200 países. **Arrancá con la que te apruebe primero y mudate a la otra si la primera falla**: el riesgo de plataforma acá es más grande que los 31 centavos de diferencia por cada US$100.

**El paso 2, que es la palanca grande y está acá adentro, no afuera.** Cuando pases el techo del monotributo, la decisión no es "Paraguay o Brasil": es **Ley de Economía del Conocimiento (27.506 / 27.570)**. Reduce Ganancias hasta 60% para micro y pequeñas (quedaría en torno al 14-15% en vez de 35%), da un bono de crédito fiscal del 70% sobre contribuciones patronales aplicable contra IVA, y estabilidad fiscal hasta el 31/12/2029. Pide persona jurídica (SRL o SA), lo que agrega el 7% sobre distribución de dividendos, así que no es un 35%→15% limpio. Un SaaS vendido a terceros califica, y las microempresas de menos de 3 años tienen condiciones más flexibles (art. 4, texto según Ley 27.570). **El pero, y es grande: no pudimos confirmar que el registro esté abierto hoy** — el sitio oficial está en reconstrucción por el Decreto 146/2026. Verificalo antes de armar cualquier sociedad.

**Cuándo volver a abrir este expediente.** Tres disparadores: (a) cuando cruces US$70.000 anuales de facturación; (b) si la brecha cambiaria pasa de 5% — hoy está en 1-2% y esa es la premisa que sostiene toda la conclusión; (c) si necesitás Stripe específicamente para algo que ningún MoR hace (por ejemplo, cobrar en nombre de tus clientes con Connect, que ningún merchant of record permite).

---

# 4. Lo que descarto, y por qué

**Paraguay con tu hermana.** No reemplaza el impuesto argentino, lo suma: 10% de IRE + 8-15% de IDU + contador paraguayo + estudio de precios de transferencia en los dos países. A US$50.000 pierde por 35 puntos. Y hay dos descubrimientos que nadie menciona en los blogs: **el IRE SIMPLE del 3% no te aplica** (la presentación oficial de la DNIT excluye expresamente a "Sociedades en general" y a quienes "realicen actividades de importación y exportación" — una EAS es sociedad y vender afuera es exportación), y **Paraguay está en el listado JBNT de ARCA**, lo que hace que el requisito de baja tributación del art. 130 inc. f) se presuma sin admitir prueba en contrario. Hay una puerta interesante — el art. 20 de la Ley 6380/2019, renta presunta del 30% para "emisión y recepción de datos por internet protocol… que se presten desde el país al exterior", que daría 3% efectivo sobre el bruto — pero es una interpretación a confirmar con un contador paraguayo, y una vez que optás no podés cambiar por 5 años.

**Brasil.** Se cae en la primera condición, no en los números. El Simples Nacional prohíbe que el titular o un socio esté domiciliado en el exterior (LC 123/2006 art. 17, II, con la redacción de la LC 214/2025, efectos desde el 1/1/2025) y Stripe Brasil exige, textual, que "the legal representative must be resident in Brazil". **Tu hermana tiene residencia brasileña pero vive en Paraguay.** Todo el atractivo de Brasil (el 6% del Anexo III) solo existe si la dueña vive de verdad en Brasil. Forzarlo declarando un domicilio que no tiene es simular residencia, y eso queda fuera de esta investigación por tu propia regla.

**La LLC como ahorro fiscal.** Acá va el hallazgo más contraintuitivo de todo el relevamiento, y es el que probablemente contradice lo que te vendieron: **una LLC unipersonal te saca del monotributo y te mete en Ganancias.** El art. 130 inc. e) imputa al socio residente las ganancias de entidades del exterior que no son sujetos del impuesto en su jurisdicción — y una LLC de un solo miembro es exactamente eso, un *disregarded entity* para el IRS. No tiene condiciones que cumplir ni esquivar, **no da ningún diferimiento** (pagás el año que la LLC gana, aunque la plata quede quieta en Mercury) y no hay crédito que descontar porque la LLC paga US$0 en EE.UU. Tampoco hay tratado Argentina-EE.UU. Resultado: cambiás un régimen plano del 8,4% por la escala progresiva hasta 35%, y encima pagás US$250-900 al año de estructura. La LLC sirve para **cobrar** (Stripe completo, dólares, giro de EE.UU. a EE.UU. sin SWIFT); no sirve para pagar menos. Si alguien te la vende como ahorro impositivo, el ahorro que tiene en la cabeza es no declararla.

Y un riesgo asimétrico que conviene mirar de frente: el Form 5472 se presenta igual aunque no debas un dólar, no se puede presentar electrónicamente (fax o correo a Ogden, Utah), y **la multa por no presentarlo arranca en US$25.000 y suma US$25.000 por cada 30 días después de los 90 días de la notificación, sin tope** (Instructions for Form 5472, rev. 12/2024, irs.gov). Cumplir cuesta US$150-400. No cumplir arranca en US$25.000.

**Lemon Squeezy.** Stripe la compró en julio de 2024, el equipo fundador está trabajando en el producto propio de Stripe, y su propia página de precios tiene hoy el cartel "2026 Update: Lemon Squeezy + Stripe Managed Payments" con el pie "Sold through Link, LLC f/k/a Lemon Squeezy LLC". No hay fecha de cierre anunciada, pero tampoco compromiso de que siga. No construyas nada encima.

**Stripe Managed Payments.** 9,24% todo incluido es el precio más alto de la tabla, exige LLC, y **Brasil no está entre sus países habilitados** (docs.stripe.com, 24/10/2026): la idea de "cuenta de Stripe en Brasil con mi hermana" no te da el merchant of record de Stripe.

**Cobrar en USDT por Bitso o Lemon porque es más barato.** Bitso por ACH cuesta US$2,99 por operación, o US$36 al año: es el riel más barato de toda la lista. Pero acredita USDC, no dólares bancarios, y el punto 2.2.2.1 del BCRA exige "cuentas en moneda extranjera de titularidad del cliente en **entidades financieras locales**". No te descarga la obligación, y la interpretación habitual trata al USDT como criptoactivo: tenencia alcanzada por Bienes Personales al 31/12 y resultado gravado al venderlo. **El riel más barato es el que menos cumple.**

**Y ahora las tres rutas que descarto por lo que son, no por lo que cuestan.** La empresa a nombre de tu hermana pero manejada por vos; los "regalos" mensuales por el monto exacto de tu facturación; la sustancia declarada en Paraguay que no existe. Las tres son simulación, no elusión, y las tres dependen de que nadie mire. Lo concreto: el art. 2 de la Ley 11.683 permite a ARCA mirar el fondo económico por encima de la forma; el art. 130 inc. f) activa la atribución **sin importar el porcentaje** cuando el residente argentino tiene derecho a disponer de los activos, la mayoría de la administración o un derecho actual sobre los beneficios; y el primer intercambio automático de información de Paraguay está previsto para **2027** (reporte del Foro Global de la OCDE citado por EY, 02/06/2026). O sea: ni siquiera funcionan por mucho tiempo. Y hay un costado que no es fiscal: si la plata es legalmente de tu hermana, es de ella — con lo que eso implica ante un divorcio, una deuda o un embargo.

Las dos únicas cosas que de verdad bajan tu factura argentina son: **que te vayas de Argentina** (decisión de vida, no de contabilidad) o **la Ley de Economía del Conocimiento** (decisión de estructura, acá adentro). Todo lo del medio es ruido caro.

---

# 5. Las cinco preguntas para el contador

Llevale estas, en este orden. Son las que valen plata.

**1. ¿Cómo instrumento el cobro por un merchant of record?** Paddle o Creem le facturan al cliente final en su nombre y me giran una sola transferencia mensual. ¿Qué facturo yo, a quién, con qué comprobante, cómo lo encuadro como exportación de servicios, y cómo cumplo el ingreso de divisas en los 20 días hábiles del punto 2.2.1 del BCRA si el que percibe primero es Paddle? **Esta es la pregunta operativa que ninguna de las seis investigaciones pudo resolver con fuentes públicas, y sin respuesta no se factura.**

**2. ¿La facturación de exportación computa para el techo del monotributo?** La página oficial de ARCA (afip.gob.ar/monotributo/exportacion-servicios) dice que el monotributista puede exportar "sin superar los límites de facturación de la categoría máxima". Hay blogs con buen posicionamiento (comolocobro.com, calcusite.com.ar) que afirman lo contrario, sin citar norma. No hay dictamen publicado que lo zanje. Importa porque **la exclusión es retroactiva**: ARCA puede reclamar IVA y Ganancias desde el mes en que superaste el límite, ya tiene mis Facturas E, y hay jurisprudencia de que pasar una factura al mes siguiente no salva.

**3. ¿Mis suscripciones a Claude, OpenAI, Vercel, Supabase y ElevenLabs me pueden encuadrar en la causal de exclusión del monotributo por "importación de servicios para su comercialización"?** Mi lectura es que una herramienta de uso propio no encaja, porque no la revendo como tal. Pero MaKo tiene un matiz incómodo: parte del producto es IA que el cliente consume. **Cero fuentes públicas tratan el caso SaaS.** Es la pregunta más específica de mi situación y la que menos material tiene.

**4. ¿Caja de ahorro en dólares o cuenta corriente, y cómo pido las dos exenciones?** El impuesto al cheque son 0,6% + 0,6% sobre movimientos en cuenta corriente, con 33% computable contra Ganancias. El tipo de cuenta que me abra el banco define si pago 1,2% sobre todo lo que entra o cero. Y la exención de Ingresos Brutos por exportación en mi jurisdicción: ¿cómo se tramita y con qué artículo del Código Fiscal vigente?

**5. ¿A qué facturación me conviene pasar a SRL con Economía del Conocimiento, y el registro está abierto hoy?** Comparame los dos escenarios con mis números reales: monotributo hasta el techo, responsable inscripto como persona humana, y SRL en el régimen promovido (Ganancias -60% más el 7% de dividendos, estabilidad fiscal hasta el 31/12/2029). Y verificá el estado del régimen después del Decreto 146/2026.

**Bonus, si alguien te vuelve a ofrecer una LLC:** preguntale al contador si el art. 130 inc. e) de la Ley de Ganancias le atribuye a un residente argentino la ganancia de una LLC unipersonal estadounidense el año en que se devenga, aunque no la retire. Si la respuesta es sí, el ahorro no existe.

---

# 6. Lo que no se pudo averiguar

Ordenado por cuánto pesa en la decisión.

1. **Cómo se instrumenta un cobro por merchant of record del lado argentino** (pregunta 1 de arriba). Es el único hueco que bloquea la ejecución.
2. **La tabla oficial de ARCA de Ganancias del 2º semestre 2026**, los 9 tramos. Hubo que reconstruirla: los números de responsable inscripto tienen ±5% de margen.
3. **Si Paddle acepta vendedores argentinos.** Solo publica la lista de prohibidos, y "no estar prohibido" no es "estar aprobado": revisa cada negocio al dar de alta. Por eso se aplica a dos en paralelo.
4. **Los recargos reales de Creem** por tarjeta internacional y por suscripción. El "+0% / +0%" sale de su propia página de comparación contra Stripe. Si cobran recargo internacional como todas las demás, Creem deja de ser la más barata. Pedilo por escrito antes de elegirla por precio.
5. **Si el programa de US$1.500 es elegible en un merchant of record.** Stripe lo excluye por escrito si hay intervención humana. De Paddle y Creem no hay respuesta pública.
6. **El precio real de dLocal Go y si actúa como merchant of record.** No publica tarifas (las de terceros van de 0,99% en Pix a 4,22% en Argentina con IVA, sin confirmación) y su sitio no dice nada de hacerse cargo del IVA del comprador. Es la pasarela con mejor encaje para LatAm y la peor documentada: **vale pedir cotización**, podría quedar segunda en la tabla.
7. **Si la percepción del 30% sigue vigente** sobre consumos con tarjeta al exterior (RG 5617). Una nota de enero de 2026 dice que ARCA dejó de cobrarla; notas de agosto de 2026 dicen que sigue. Define cuánto le sale realmente a un cliente argentino pagando en dólares.
8. **El artículo e inciso vigentes del Código Fiscal de CABA 2026** que exime la exportación de servicios en Ingresos Brutos. Tres fuentes citan tres artículos distintos (180 inc. 22, 183, 296), lo que indica que ninguna leyó el texto ordenado actual.
9. **Si el Registro de Economía del Conocimiento está abierto.** El sitio oficial está en reconstrucción por el Decreto 146/2026. Es la pieza más frágil del plan a US$200.000.
10. **El costo real de mantener una EAS paraguaya.** Los US$15.600 del cálculo son una estimación de orden de magnitud. Las únicas cifras que aparecieron son de proveedores que venden el servicio.
11. **Si el art. 20 de la Ley 6380/2019 (renta presunta 30% → 3% efectivo) aplica a un SaaS.** Es la pregunta de mayor impacto económico de la ruta paraguaya (US$11.591/año a US$200.000) y no hay resoluciones, dictámenes ni jurisprudencia públicos.
12. **La alícuota real del IOF brasileño** (1,1% o 3,5%) y si alcanza a dividendos. Las fuentes de 2026 se contradicen abiertamente sobre el efecto de la cautelar del STF del 16/7/2025.
13. **Si Mercado Pago puede cobrarle online a una tarjeta española o mexicana.** La única declaración oficial es un tuit de 2019. Para efectos prácticos, tratalo como una pasarela por país.
14. **La comisión actual de Wise USD→ARS en fuente oficial**, y si su acreditación en pesos "por transferencia local" queda bien registrada como cobro de exportación. Dato aparte: su límite reportado es US$18.000 por mes (El Cronista, sin confirmar en Wise), así que a US$200.000 al año deja de servir.
15. **Si una caja de ahorro en dólares queda fuera del impuesto al cheque en 2026.** Históricamente el gravamen apunta a cuenta corriente, pero no se pudo confirmar para este año.

---

*Esto es un relevamiento con fecha: 24/10/2026. Todo el marco cambiario que te favorece tiene menos de siete meses y es reglamentario, no legal — una comunicación del BCRA se cambia con otra comunicación del BCRA. Los precios de las pasarelas se movieron tres veces este año. La decisión la firma tu contador, y el paso 1 de la lista del lunes no necesita esperarlo.*

---

**Nota para la cosecha (no para Martín):** esto va a `docs/hallazgos-pagos.md`, con `docs/hallazgos.md` actualizado en el mismo commit. Los tres hallazgos que más tiempo ahorran después, porque el diagnóstico obvio era el equivocado: (1) la brecha cambiaria cayó a ~1-2% en 2026, así que la regla vieja "maximizá el tipo de cambio" quedó obsoleta y hace optimizar lo que menos importa — lo que mueve 15-35 puntos es la estructura, no el riel; (2) una LLC unipersonal **no** es neutral, te saca del monotributo y te mete en Ganancias por el art. 130 inc. e), sin diferimiento ni crédito; (3) el riel más barato (Bitso ACH, US$36/año) es el que no cumple el punto 2.2.2.1 del BCRA, porque acredita USDC y no dólares en entidad local. Y lo que quedó SIN resolver y bloquea la ejecución: cómo se instrumenta del lado argentino un cobro por merchant of record (qué se factura, a quién, y cómo se cumple el ingreso en 20 días hábiles).

---

## Línea base: cobrar desde Argentina, sin estructura afuera (medido al 24/10/2026)

**Lo medido**

Aviso antes de todo: no soy contador ni abogado. Esto es un relevamiento de hechos públicos, con fecha, para que llegues a tu contador con las opciones sobre la mesa. No es asesoramiento profesional.

**LA CONCLUSIÓN CORTA (y me sorprendió medirla)**

La línea base argentina NO es el escenario malo. Hasta el techo del monotributo se te va ~8% de lo que cobrás, todo incluido. Eso es MENOS que el Simples Nacional brasileño del Anexo V (15,5% desde el primer real) y menos que casi cualquier estructura afuera una vez que le sumás el costo de mantenerla. El problema de la línea base no es la tasa: es el TECHO. Cuando lo pasás, salta de ~8% a ~22%.

---

**1. El régimen que te toca depende de un solo número: el techo del monotributo**

Tabla vigente desde el 1/8/2026 (ARCA, ajuste del 16,8% sobre el semestre anterior):
- Categoría G: hasta ARS 53.995.798,87/año
- Categoría H: hasta ARS 81.924.660,37/año — cuota servicios ARS 522.706,68/mes
- Categoría K (la última): hasta ARS 126.610.838,75/año — cuota servicios ARS 1.614.446,04/mes

Fuente: tablas de ARCA replicadas por calcular.ar, wynges.com, fiscal.com.ar, iProfesional y el Consejo Profesional de Entre Ríos (cpcef.org.ar), todas coincidentes. Leído 24/10/2026.

Al dólar oficial BNA del 23/10/2026 (comprador ARS 1.500 / vendedor ARS 1.550):
- US$50.000/año = ARS 75.000.000 → **entrás en categoría H**, cómodo.
- US$200.000/año = ARS 300.000.000 → **2,4 veces el techo de la K**. Monotributo imposible. Responsable inscripto obligatorio.

**Dato clave que resolví porque las fuentes se contradecían:** lo que facturás al exterior SÍ cuenta para el techo del monotributo. La página oficial de ARCA (afip.gob.ar/monotributo/exportacion-servicios) dice que el monotributista puede exportar "sin superar los límites de facturación de la categoría máxima". Hay blogs (comolocobro.com, calcusite.com.ar) que afirman lo contrario —que la Factura E no suma al tope— y no citan norma. Están equivocados, y creerles te expone a una exclusión retroactiva con reclamo de IVA y Ganancias hacia atrás. No hay dictamen de ARCA que lo zanje por escrito, por eso lo marco también como pregunta para el contador.

---

**2. Exportación de servicios: lo que NO pagás (y es bastante)**

- **IVA: cero.** La exportación de servicios no está alcanzada (principio de país de destino). Se factura con Factura E, sin IVA. Y si sos responsable inscripto, además **recuperás** el IVA de tus compras locales vinculadas (art. 43 de la Ley de IVA). O sea: el IVA te juega a favor, no en contra.
- **Derechos de exportación: cero.** El derecho sobre exportación de servicios (que llegó a ser 12% y después 5%) rigió hasta el 31/12/2021 y no se renovó. Desde el 1/1/2022 no se paga nada.
- **Ingresos Brutos (provincial): probablemente cero.** En CABA la exportación de servicios está exenta; en provincia de Buenos Aires directamente no está gravada (art. 186 del Código Fiscal bonaerense, según fuentes secundarias). No pude confirmar el artículo e inciso del texto ordenado 2026 de CABA: las fuentes citan art. 180 inc. 22, art. 183 y art. 296, todas distintas. Hay que pedir la exención ante AGIP, no es automática.
- **Registro de exportadores: no hace falta.** ARCA confirma que el monotributista no está obligado a inscribirse.
- **Impuesto al cheque (0,6% + 0,6%): cero para monotributistas**, con trámite. Hay exención para cuentas de uso exclusivo de la actividad; se pide en ARCA al dar de alta el CBU/CVU, opción "4 – Débitos y Créditos... Sujetos inscriptos en el Régimen Simplificado". Requiere CUIT activo, domicilio fiscal electrónico y DDJJ al día.
- **Certificado MiPyME:** si lo tenés vigente, quedás exento de derechos de exportación de servicios desde el primer día del mes en que lo obtenés (ARCA). Hoy es redundante porque el derecho está en cero, pero es gratis y te cubre si vuelve.

---

**3. El dólar que entra: esto cambió fuerte y a tu favor**

**Comunicación "A" 8481 del BCRA, del 14/9/2026** (verificada en el análisis de Allende & Brea, estudio jurídico, publicado 15/9/2026):
- Se **eliminó el tope de USD 36.000 anuales** para exportadores de servicios. También se eliminó la declaración jurada que había que firmar para acreditar que no lo superabas.
- Se **eliminó la nómina cerrada de códigos de concepto**: ya no importa cómo se tipifique tu servicio.
- **No tenés que pesificar.** Podés acreditar los dólares como dólares en una cuenta en moneda extranjera a tu nombre en un banco argentino.

Sobrevivieron exactamente dos condiciones: (1) que los fondos se acrediten en cuenta en moneda extranjera de tu titularidad en entidad local, y (2) que el arbitraje sea fiscalmente neutro. Se mantiene la registración con dos boletos sin movimiento de pesos (concepto "A22") y la prohibición de cobrar comisiones por eso.

Antes hubo la **Com. "A" 8417 del 14/4/2026**, que eximió a las personas humanas de liquidar y extendió la excepción a todos los conceptos de exportación de servicios.

**Y el costo cambiario, que era el impuesto escondido, hoy casi no existe.** Cotizaciones del cierre del viernes 23/10/2026: oficial BNA 1.500/1.550, mayorista 1.546,90, MEP ~1.555-1.562 (brecha 1,7-2,1%), blue 1.565 (brecha 0,96%), CCL 1.648,62 (brecha 7,8%). El techo de la banda del BCRA está en 1.943,56, lejos. Durante años la línea base argentina perdía 30-100% en la brecha: **hoy pierde entre 1% y 8%, según por dónde salgas**. Cualquier comparación con una estructura afuera que use la brecha vieja como argumento está desactualizada.

---

**4. Si pasás el techo: responsable inscripto**

- **IVA:** cero sobre la venta, con recupero de créditos. A favor.
- **Ganancias:** escala progresiva de 9 tramos, del 5% al 35%, sobre la ganancia NETA (no sobre la facturación). Deducciones anuales del segundo semestre 2026: ganancia no imponible ARS 6.019.671,36 y deducción especial para autónomos (3,5 veces) ARS 21.068.849,78 = ~ARS 27,1 M. Si calificás como "nuevo profesional o nuevo emprendedor", la deducción especial sube a 4 veces: ARS 24.078.685,46.
- **Autónomos (jubilación):** desde los vencimientos de octubre 2026, Categoría I = ARS 78.271,56/mes; la V llega a ARS 344.390,34/mes. No pude determinar qué categoría te corresponde.
- **Impuesto al cheque:** 0,6% + 0,6% sobre movimientos en cuenta corriente, con 33% computable como pago a cuenta de Ganancias (neto ~0,8%). La exención de monotributista ya no te aplica.
- **Bienes Personales:** mínimo no imponible ARS 384.728.044,57 para el período fiscal 2025 (~US$256.000 al dólar de hoy). Arriba de eso, alícuotas que las fuentes dan como 0,5%-1% (Mobu, Mi Presupuesto Familiar) o 0,5%-1,75% (hacecuentas). Si cobrás US$200k/año y ahorrás, cruzás ese mínimo en menos de dos años.

---

**5. La palanca grande que nadie te mencionó: Ley de Economía del Conocimiento (27.506 / 27.570)**

Para un SaaS es EL régimen pensado para tu caso. Reduce Ganancias hasta 60% para micro y pequeñas (quedaría en torno al 14-15% en vez de 35%), da un bono de crédito fiscal del 70% sobre contribuciones patronales aplicable contra IVA, y estabilidad fiscal hasta el 31/12/2029.

Las letras chicas que importan para MaKo:
- **Requiere persona jurídica** (SRL/SA). Como persona humana no podés entrar. Eso agrega la capa de dividendos (7% sobre distribuciones), así que no es un 35%→15% limpio.
- **70% de la facturación** tiene que venir de actividades promovidas. MaKo califica.
- **El art. 5 excluye el software desarrollado para uso propio o de empresas vinculadas.** MaKo se vende a terceros, así que estarías del lado bueno, pero es un punto que te van a mirar.
- **Microempresas con menos de 3 años** tienen condiciones más flexibles: les basta acreditar que desarrollan la actividad promovida, sin exigir todavía el 70% ni los requisitos adicionales (art. 4, texto según Ley 27.570).

---

**6. El punto que mata casi cualquier estructura afuera (y por eso esta línea base es el piso real)**

Argentina grava a sus residentes fiscales por **renta mundial**. Si vos seguís viviendo en Argentina y siendo residente fiscal argentino, la ganancia de una LLC estadounidense o de una sociedad paraguaya **se te imputa a vos igual, aunque no la retires**, por el régimen de transparencia fiscal internacional (art. 130 de la Ley de Ganancias, imputación como renta de tercera categoría). Y la participación en esa sociedad va a Bienes Personales. Tampoco hay tratado de doble imposición entre Argentina y EE.UU.

Traducido: una estructura afuera, a tu nombre y declarada, **no te baja la factura argentina**. Te la baja si (a) el dueño real es otra persona que no es residente fiscal argentina —tu hermana, con residencia paraguaya— y entonces la plata es de ella, no tuya, con todo lo que eso implica; o (b) vos dejás de ser residente fiscal argentino, que es una decisión de vida, no de contabilidad. Cualquier camino intermedio —sociedad afuera, dueño real vos, no declarada acá— ya no es elusión: es ocultar ingresos. Eso se descarta y por eso lo digo acá: no es que sea riesgoso, es que es la frontera.

**Cuánto cuesta**

Dólar usado: ARS 1.500 comprador BNA del 23/10/2026 (es el tipo de cambio que, según ARCA, se usa para la Factura E emitida en pesos: comprador BNA del día hábil anterior).

**SOBRE US$50.000 AL AÑO (= ARS 75.000.000) → Monotributo categoría H**

| Concepto | Al año |
|---|---|
| Cuota monotributo cat. H servicios (ARS 522.706,68 × 12) | ARS 6.272.480 = **US$4.182** |
| IVA | US$0 (exportación) |
| Derechos de exportación | US$0 (eliminados desde 1/1/2022) |
| Ingresos Brutos | US$0 (exento/no gravado, hay que pedirlo) |
| Impuesto al cheque | US$0 (exención de monotributista, con trámite) |
| Ganancias | US$0 (el monotributo lo sustituye) |
| Bienes Personales | US$0 hasta ARS 384,7 M de patrimonio |
| **TOTAL** | **US$4.182** |

**De cada US$100 que cobrás, se van US$8,36.** Te quedan US$91,64.

Y ojo: de esos US$8,36, una parte es jubilación y obra social, o sea un servicio que recibís, no impuesto puro. No encontré el desglose de la categoría H (sí el de A y K), así que no puedo decirte cuánto es cada cosa.

Al dólar vendedor (1.550) la cifra baja a US$8,09 por cada 100, misma categoría.

Afuera de impuestos, sumale la comisión de cobro (Payoneer/Wise, 1,5-2% según las fuentes, que no coinciden): **~US$10 de cada US$100, todo incluido**.

---

**SOBRE US$200.000 AL AÑO (= ARS 300.000.000) → Responsable inscripto, obligatorio**

Monotributo descartado: ARS 300 M contra un techo de categoría K de ARS 126.610.838. Estás 2,4 veces arriba.

Acá Ganancias cae sobre la GANANCIA, no sobre la facturación, así que el resultado depende de tu margen. Dos escenarios:

**Escenario A — margen 75% (gastás US$50.000/año en infra, IA, ads, herramientas)**
- Ganancia neta: ARS 225.000.000
- Menos deducciones (~ARS 27,1 M): base imponible ARS 197,9 M
- Ganancias: ~ARS 65,3 M = **US$43.550**
- Autónomos: ARS 939.000 a 4.130.000 = US$626 a US$2.756
- Impuesto al cheque (neto del 33% computable): US$0 a ~US$1.600
- **TOTAL: US$44.200 a US$47.900 → US$22 a US$24 de cada US$100**

**Escenario B — margen 50% (gastás US$100.000/año)**
- Ganancia neta: ARS 150.000.000
- Base imponible: ARS 122,9 M
- Ganancias: ~ARS 39,1 M = **US$26.050**
- Autónomos + cheque: US$626 a US$4.350
- **TOTAL: US$26.700 a US$30.400 → US$13 a US$15 de cada US$100**

En los dos casos, sumale Bienes Personales a partir del segundo año: 0,5% a 1% anual (quizá hasta 1,75%, las fuentes no coinciden) sobre el patrimonio que supere ARS 384.728.044,57.

**Advertencia sobre la precisión de los números de Ganancias:** la escala del segundo semestre 2026 no la pude verificar en fuente oficial. Tengo el tramo del 35% arrancando en ARS 60.750.913,96 para el primer semestre (iProfesional, con la tabla de ARCA), y una actualización confirmada del 16,85% para julio-diciembre (confirmada por el IPC de junio 2026, blogdelcontador). Eso da ~ARS 70.987.000, pero hacecuentas.com publica ARS 65.867.941 y no cierra con ese cálculo. Además tuve que estimar el monto fijo acumulado en el arranque del último tramo, porque no conseguí la tabla completa de 9 tramos. **Los números de Ganancias tienen un margen de error que estimo en ±5%, o sea ±US$2.000 en el escenario A.** La diferencia entre 8% y 22% no se mueve por eso, pero el número exacto hay que sacarlo con la tabla oficial.

---

**EL SALTO, QUE ES LO QUE IMPORTA PARA DECIDIR**

| Facturación anual | Se va | De cada US$100 |
|---|---|---|
| US$50.000 | US$4.182 | US$8,36 |
| US$84.000 aprox. (techo cat. K: ARS 126,6 M) | ~US$19.400 | ~US$23 |
| US$200.000, margen 75% | ~US$44.200-47.900 | US$22-24 |
| US$200.000, margen 50% | ~US$26.700-30.400 | US$13-15 |

Hay un escalón duro al pasar el techo del monotributo, en torno a los **US$84.000 anuales de facturación al dólar de hoy**. A US$47/mes y US$97/mes, eso son aproximadamente 100-150 clientes activos. Ese es el número que te dice cuándo esta conversación deja de ser teórica.

**Riesgos**

**1. El techo del monotributo se mueve con la inflación y el dólar, y no al mismo ritmo.** Facturás en dólares pero el techo está en pesos. Si el peso se aprecia (el dólar sube menos que la inflación, que es lo que viene pasando: los topes subieron 16,8% en agosto y el dólar está lejos del techo de la banda), tu facturación en pesos sube más rápido que el techo y te quedás afuera del monotributo sin haber vendido un cliente más. **Ese es el riesgo más concreto de los que hay acá, y no depende de vos.** Al tipo de cambio de hoy estás a ~US$84.000 anuales del escalón; si el peso se aprecia 20%, ese umbral baja a ~US$70.000.

**2. Si te excluyen del monotributo, es retroactivo.** No es "a partir de ahora pagás más". ARCA puede reclamarte IVA y Ganancias hacia atrás desde el mes en que superaste el límite. Y las exclusiones por facturación son automáticas: ARCA ya tiene tus Facturas E. Pasar una factura al mes siguiente no te salva (hay jurisprudencia explícita sobre eso). Corolario práctico: si estás cerca del techo, el control de facturación mensual deja de ser contabilidad y pasa a ser gestión de riesgo.

**3. Los blogs que te dicen que la Factura E no suma al tope te pueden costar caro.** Hay fuentes con buen posicionamiento en Google (comolocobro.com, calcusite.com.ar) afirmando exactamente eso, sin citar norma. La página oficial de ARCA dice lo contrario. Si decidís con el blog y ARCA aplica su criterio, el costo es el punto 2.

**4. La causal de exclusión por "importaciones de servicios" es una zona gris que te toca de lleno.** El monotributo excluye a quien haya realizado importaciones de bienes o servicios "para su comercialización" en los últimos 12 meses. Vos pagás Claude, OpenAI, Vercel, Supabase, ElevenLabs. Mi lectura de las fuentes es que una suscripción extranjera usada como herramienta propia no encaja en la causal, porque no la revendés como tal. **Pero es una inferencia mía, no un dato: ninguna fuente aborda el caso SaaS.** Y MaKo tiene un matiz incómodo acá, porque parte del producto es IA que el cliente consume. Si ARCA leyera que estás "comercializando" un servicio importado, la causal aplica. Esto va a la lista de preguntas, no lo decidas solo.

**5. La exención de Ingresos Brutos no es automática y no tengo el artículo confirmado.** En CABA hay que pedirla ante AGIP. Si no la pediste y facturás como exento, el reclamo provincial existe. Y las fuentes citan tres artículos distintos del Código Fiscal (180 inc. 22, 183, 296), lo que me dice que ninguna está leyendo el texto ordenado 2026.

**6. Economía del Conocimiento: no pude confirmar que el registro esté abierto hoy.** El sitio oficial de argentina.gob.ar está literalmente en reconstrucción por el Decreto 146/2026 y no muestra el régimen. Lo único que encontré con fecha es una convocatoria de la Agencia I+D+i del 10/4/2026 que figura cerrada, pero es otra convocatoria, no el registro general. **Si tu plan a US$200k depende de este régimen, verificá que exista antes de armar la sociedad.** Es la pieza más frágil de todo lo que relevé.

**7. Todo el marco cambiario que te favorece es de los últimos 6 meses y es reglamentario, no legal.** La Com. "A" 8417 es de abril de 2026 y la "A" 8481 de septiembre de 2026. Una comunicación del BCRA se cambia con otra comunicación del BCRA, sin pasar por el Congreso. El historial argentino de los últimos 15 años es de ida y vuelta. Diseñar la operación asumiendo que podés quedarte los dólares para siempre es asumir una continuidad que no está garantizada por nada. La contracara: hoy el costo cambiario es ~1-8% y eso hace que la línea base argentina compita de verdad; si vuelve el cepo, el cálculo entero se da vuelta y la estructura afuera pasa a tener sentido por razones cambiarias, no impositivas.

**8. Bienes Personales es el impuesto que no se ve venir.** Si cobrás US$200k y ahorrás en dólares, cruzás el mínimo de ARS 384,7 M en menos de dos años y ahí empieza a correr 0,5-1% anual sobre el excedente, todos los años, sobre el stock. En un negocio que acumula caja, eso se va volviendo el costo dominante y no aparece en ninguna cuenta de "cuánto pago por lo que facturo".

**9. La diferencia entre "estructura afuera" y "ocultar ingresos" es más fina de lo que suena.** Por renta mundial y transparencia fiscal internacional (art. 130), una LLC o una sociedad paraguaya **a tu nombre** no te baja nada en Argentina: te imputa la ganancia igual, aunque no la retires. La única forma de que la estructura efectivamente reduzca tu carga argentina es que el dueño real no seas vos, o que dejes de ser residente fiscal argentino. **Si la respuesta a "¿de quién es esa sociedad?" tiene que ser distinta según quién pregunta, la ruta está del lado equivocado de la línea y la descarto acá.** Y hay un riesgo adicional en la variante "la sociedad es de mi hermana": si la plata es legalmente de ella, es de ella. Eso es un riesgo de vida, no fiscal, y no lo resuelve ningún contador.

**10. Mis números de Ganancias están armados con tabla reconstruida, no con la oficial.** Lo detallé en el costo anual. Las magnitudes son sólidas, el decimal no.

**Lo que no se encontró**

**1. La tabla oficial de ARCA de Ganancias para el segundo semestre 2026.** Conseguí el PDF oficial de deducciones de enero-junio 2026 (afip.gob.ar/gananciasYBienes/.../Deducciones-personales-art-30-ene-a-jun-2026.pdf) y la confirmación de que hubo una actualización del 16,85% para julio-diciembre, pero no la tabla publicada de los 9 tramos del segundo semestre. Tuve que reconstruirla y estimar el monto fijo acumulado del último tramo. Dónde está: ARCA, sección Ganancias, tabla del art. 94.

**2. Qué categoría de autónomos te corresponde.** Tengo los montos de octubre 2026 (Cat I ARS 78.271,56/mes hasta Cat V ARS 344.390,34/mes) pero no el criterio vigente de asignación por actividad e ingresos. Las búsquedas me devolvían la tabla del monotributo (A-K) en vez de la de autónomos. La diferencia entre categorías es de hasta ARS 3,2 M al año, así que no es despreciable, pero tampoco cambia la conclusión.

**3. El desglose de la cuota de monotributo categoría H.** Tengo el total (ARS 522.706,68/mes) y el desglose de las categorías A y K, pero no de la H. Por eso no puedo decirte qué parte de tus US$8,36 por cada 100 es impuesto integrado y qué parte es jubilación más obra social. En la K el impuesto integrado es ~85% de la cuota; en la A, solo 11%. La H está en el medio y no sé dónde.

**4. El artículo e inciso vigentes del Código Fiscal de CABA 2026 que exime la exportación de servicios en Ingresos Brutos.** Las fuentes secundarias citan art. 180 inc. 22, art. 183 y art. 296: tres respuestas distintas, lo que indica que ninguna leyó el texto ordenado actual. Dónde está: Código Fiscal CABA TO 2026 en el sitio de AGIP o el Boletín Oficial de la Ciudad (la Ley Impositiva 2026 es la 6927).

**5. Dictamen o resolución de ARCA que diga por escrito si la facturación de exportación computa para el techo del monotributo.** No existe uno publicado, o no lo encontré. Lo que hay es la redacción de la página oficial ("sin superar los límites de facturación de la categoría máxima"), que es indicativa pero no es un dictamen. Varios estudios reconocen abiertamente que hay interpretaciones divergentes entre asesores.

**6. Cómo juega la causal de exclusión por importación de servicios en un SaaS que usa IA de terceros.** Cero fuentes sobre el caso. Ni blogs, ni consultas, ni dictámenes. Es la pregunta más específica de tu situación y es la que menos material público tiene.

**7. Si el Registro de Beneficiarios de Economía del Conocimiento está abierto hoy.** El sitio oficial está en reconstrucción por el Decreto 146/2026. No encontré el padrón ni una convocatoria vigente. Dónde buscarlo: Secretaría de Economía del Conocimiento (Ministerio de Economía), o el Boletín Oficial buscando el Decreto 146/2026 para ver si el régimen fue modificado o reasignado.

**8. Si el impuesto al cheque te alcanza usando caja de ahorro en dólares en vez de cuenta corriente.** Históricamente el gravamen apunta a cuenta corriente y las cajas de ahorro quedaban afuera, pero no lo pude confirmar para 2026. Encontré el Decreto 475/2026 (publicado 18/6/2026) que agregó una exención para cuentas de proveedores de servicios de pago, pero no vi el tratamiento de tu caso. Como exportador que ahora puede acreditar dólares directamente, el tipo de cuenta que te abra el banco define si pagás 1,2% o cero sobre todo lo que entra. Importa.

**9. Si subsiste un plazo de ingreso de divisas para servicios de personas humanas.** Varias fuentes mencionan 20 días hábiles, pero el análisis de Allende & Brea sobre la Com. "A" 8481 ubica ese plazo en la sección de exportación de BIENES, no de servicios para personas humanas. Quedó sin resolver si tenés plazo o no. Dónde está: Texto Ordenado "Exterior y Cambios" del BCRA en bcra.gob.ar.

**10. Nada sobre tratado Argentina-Paraguay.** Mi línea era la base argentina y no la estructura afuera, pero lo marco porque las búsquedas no devolvieron nada de Paraguay y otra línea de esta investigación lo va a necesitar: no hay tratado de doble imposición Argentina-EE.UU. confirmado, y de Paraguay no tengo dato.

**Para el contador**

**1. ¿La facturación de exportación de servicios con Factura E computa para el techo de mi categoría de monotributo, sí o no, y con qué norma lo sostenés?**
Por qué importa: es la pregunta que define todo lo demás. Si cuenta (que es lo que dice la página de ARCA y lo que creo), a US$50.000 estoy en categoría H pagando ~8% y tengo el escalón a los ~US$84.000 anuales. Si no contara, el monotributo me serviría para siempre. Hay blogs afirmando cada cosa y no hay dictamen de ARCA publicado. Necesito que me digas de qué lado te paras **por escrito**, porque si ARCA aplica el criterio contrario la exclusión es retroactiva con IVA y Ganancias hacia atrás.

**2. Yo pago suscripciones del exterior (Claude, OpenAI, Vercel, Supabase, ElevenLabs) y parte de eso el cliente lo consume como IA dentro de mi producto. ¿Eso activa la causal de exclusión del monotributo por "importación de servicios para su comercialización" del art. 20 de la Ley 24.977?**
Por qué importa: no hay una sola fuente pública sobre el caso SaaS. Mi lectura es que son herramientas de uso propio y no las revendo como tales, pero el matiz de que el cliente consume IA de un tercero me incomoda. Si la causal aplica, estoy excluido del monotributo desde hace meses y no lo sé.

**3. Al techo del monotributo de hoy (ARS 126,6 M en categoría K) y al dólar actual, el escalón me cae alrededor de los US$84.000 anuales. ¿A partir de qué facturación mensual me conviene armar una SRL con Economía del Conocimiento en vez de pasar a responsable inscripto como persona humana, y el régimen está abierto hoy?**
Por qué importa: la diferencia medida es de ~8% a ~22% de lo que cobro. Economía del Conocimiento podría dejar Ganancias en 14-15% en vez de 35%, pero exige persona jurídica, suma la capa de dividendos del 7%, el art. 5 excluye software de uso propio, y no pude confirmar que el registro esté abierto (el sitio oficial está en reconstrucción por el Decreto 146/2026). Necesito saber si existe antes de gastar en una sociedad. Y necesito el número de facturación a partir del cual el salto se paga solo.

**4. Siendo residente fiscal argentino, ¿una LLC o una sociedad paraguaya a mi nombre me reduce algo en Argentina, o la transparencia fiscal internacional del art. 130 me imputa la ganancia igual aunque no la retire?**
Por qué importa: si la respuesta es "te la imputa igual" —que es lo que leí en todas las fuentes—, entonces montar una estructura afuera a mi nombre me agrega costo y complejidad sin bajarme un peso la factura argentina, y toda esta conversación se reduce a dos opciones reales: optimizar dentro de Argentina, o dejar de ser residente fiscal argentino. Quiero que me confirmes eso antes de seguir explorando estructuras, porque cambia cuál es la pregunta.

**5. (Operativa, para resolver en la misma reunión) ¿Qué trámites tengo que hacer ya, y en qué orden: exención de Ingresos Brutos ante AGIP, exención del impuesto al cheque ante ARCA, certificado MiPyME, y qué tipo de cuenta en dólares pido en el banco para que los cobros no queden alcanzados por el 1,2%?**
Por qué importa: son cuatro trámites que no son automáticos, que valen plata todos los meses, y que si no están hechos hoy ya estoy pagando de más o facturando como exento algo que no me exenté formalmente.


---

## Paraguay con tu hermana: la empresa es gratis y se abre en 72 horas, pero Argentina te sigue cobrando igual (y Paraguay está en la lista negra de ARCA)

**Lo medido**

Aclaración antes de todo: no soy contador ni abogado. Esto es un relevamiento de hechos públicos, con fuente y fecha, para que llegues a un profesional con las preguntas correctas. Todo lo consulté hoy, 24/10/2026.

== 1. ABRIR LA EMPRESA: ES GRATIS Y RÁPIDO, Y ESO ES REAL ==

La EAS (Empresa por Acciones Simplificadas, Ley 6480/2020) es el vehículo. Según la ficha oficial del Ministerio de Industria y Comercio paraguayo (mic.gov.py, consultada 24/10/2026):
- Se tramita 100% en línea en eas.mic.gov.py.
- "Se constituye en un máximo de 72 horas y con costo CERO con la utilización de los estatutos estándar". Con estatuto propio: 8 días hábiles.
- No hay capital mínimo ni máximo.
- Se puede constituir con UN solo socio, persona física o jurídica, nacional o extranjera.
- Responsabilidad limitada al aporte (tu patrimonio personal queda separado).
- No necesita inscribirse en el Registro Público de Comercio para operar.

**El cuello de botella es quién firma.** La misma ficha del MIC: "se accede únicamente a través de la identidad electrónica del Representante Legal principal de la empresa de nacionalidad paraguaya o que cuente con cédula paraguaya". Vos, sin cédula paraguaya, NO podés ser el representante legal. Tu hermana sí (tiene residencia fiscal paraguaya y vive allá). Como socio extranjero sí podés entrar con pasaporte o documento de tu país.

Dato de color que importa: Argentina es el principal origen de capital extranjero en las EAS. De las 2.412 EAS constituidas entre febrero 2021 y julio 2022, 70 tenían capital argentino: el 51% del capital extranjero (ficha MIC). Es un camino muy transitado. Lo cual también significa que ARCA lo conoce perfectamente.

Aportes en efectivo: no piden comprobante hasta Gs. 3.060.368.400 (unos US$518.000 al tipo de cambio de referencia del Banco Central del Paraguay, ~5.904 Gs/USD al 12/09/2026 según hacecuentas.com). Arriba de eso, boleta de depósito de garantía del 20%.

== 2. LO QUE NADIE TE CUENTA: LA EAS **NO** PUEDE USAR EL RÉGIMEN BARATO ==

Este es el hallazgo más concreto y el que más contradice lo que circula en blogs.

Todo el mundo recomienda Paraguay por el "IRE SIMPLE" al 3% efectivo. La presentación oficial de la DNIT (ex SET) sobre IRE SIMPLE dice textual, en la diapositiva de quiénes pueden ser contribuyentes:

> "No pueden optar por este régimen quienes: 1. Sean **Sociedades en general**. 2. Realicen actividades de **importación y exportación**. 3. Superen los G 2.000.000.000 de guaraníes de ingresos."

Una EAS es una sociedad. Y vender MaKo a clientes del exterior es exportación de servicios. **Te quedás afuera por dos motivos independientes.** (La cartilla informativa de la DNIT sobre IRE SIMPLE está redactada de forma más ambigua y habla de "entidades y empresas privadas de cualquier naturaleza" — pero después lista solo comisiones vecinales, cooperadoras escolares y entidades religiosas. Las dos son fuentes oficiales de la DNIT y no dicen lo mismo. Hay que preguntarlo.)

Entonces la EAS va al **IRE General: 10% sobre la renta neta real** (art. 21, Ley 6380/2019), con contabilidad completa, declaraciones mensuales y anuales en el sistema Marangatu.

**PERO encontré una puerta que casi nadie menciona.** El art. 20 de la Ley 6380/2019 ("Rentas Netas en Operaciones Internacionales") fija, textual, "sin admitir prueba en contrario, el 30% sobre el monto del ingreso bruto proveniente de: 1. La realización de operaciones de radiogramas; llamadas telefónicas; servicios de transmisión de audio o video; **emisión y recepción de datos por internet protocol y otros servicios similares, que se presten desde el país al exterior**."

Un SaaS vendido desde Paraguay al exterior encaja bastante bien en esa descripción. Si aplica: renta neta = 30% del bruto, impuesto = 10% × 30% = **3% de la facturación bruta**. Igual de barato que el IRE SIMPLE, por otra vía. El mismo artículo dice que el contribuyente "podrá optar" y que una vez adoptado el criterio no puede cambiarlo por 5 años. Hay un detalle que puede trabarlo: el artículo habla de actividades "ejercidas parcialmente dentro del país". Esto lo tiene que confirmar un contador paraguayo; es la pregunta de mayor impacto económico de todo el relevamiento.

== 3. IVA: NO PAGÁS, PERO TAMPOCO RECUPERÁS ==

El art. 81 num. 5 de la Ley 6380/2019 dice que "los servicios digitales se entenderán que son prestados en territorio nacional cuando sean utilizados o aprovechados efectivamente en el país", y define el criterio por IP del dispositivo, código de la SIM, dirección de facturación o banco del cliente. Tus clientes están en LatAm y España → el servicio no se presta en territorio paraguayo → **queda fuera del IVA paraguayo. 0%.**

Ojo con el detalle fino: no es una "exoneración", es que no está alcanzado. Y eso tiene una consecuencia. El régimen de devolución del "IVA Crédito del Exportador" (art. 101) está escrito para "la exportación de **bienes**". El art. 100 num. 2 exonera "la exportación de bienes", no de servicios. Conclusión práctica: el 10% de IVA que la EAS pague en sus compras locales (contador, oficina, servicios) probablemente se lo come, no lo recupera. Es plata chica, pero es plata.

== 4. SACAR LA PLATA DE LA EMPRESA: EL IDU ==

Ley 6380/2019, art. 43, textual:
- **8%** cuando el que cobra el dividendo es residente en Paraguay.
- **15%** cuando el que cobra es **no residente**.

O sea: si la accionista es tu hermana (residente paraguaya), 8%. Si el accionista sos vos (residente argentino), 15%. Casi el doble. Es pago único y definitivo (art. 41).

Si en lugar de dividendos la EAS te PAGA a vos por trabajo (desarrollo, soporte), entra el INR (Impuesto a la Renta del No Residente): tasa 15% (art. 76), sobre una renta neta presunta que según el art. 75 es del 70% para "servicios personales, profesionales o no" → **10,5% efectivo de retención**. Pero cuidado con el num. 6 del mismo art. 75: "el 100% sobre el monto de los importes brutos puestos a disposición, remesados o pagados a socios, accionistas, casa matriz, empresas o entidades **vinculadas**" → eso sería 15% pleno. Cuál de los dos aplica a un pago a un hermano del dueño es exactamente el tipo de cosa que decide un contador, no yo.

Y la EAS tiene que guardar un **Estudio Técnico de precios de transferencia** por esas operaciones: art. 39 de la Ley 6380/2019 obliga a los contribuyentes "que celebren operaciones con partes relacionadas residentes en el país y en el extranjero" a obtener y conservar ese estudio. Es un costo profesional recurrente.

== 5. PASARELAS: QUÉ FUNCIONA CON UNA EMPRESA PARAGUAYA ==

Stripe no está en Paraguay — ya lo sabíamos. Lo que encontré que SÍ funciona:

**Lemon Squeezy** (es un "merchant of record": factura ella al cliente final y te paga a vos, y se hace cargo de los impuestos al consumo de cada país). Su documentación oficial (docs.lemonsqueezy.com/help/getting-started/supported-countries, consultada 24/10/2026) **lista Paraguay entre los países habilitados para payouts bancarios**. Comisión: 5% + US$0,50 por transacción.
→ Advertencia importante: Stripe compró Lemon Squeezy en julio de 2024. A octubre de 2026 sigue aceptando altas y no anunció cierre, pero el equipo fundador está trabajando en el producto propio de Stripe (Stripe Managed Payments) y las fuentes coinciden en que el soporte está más lento y el camino esperado es migrar. Es una dependencia frágil para apoyar una estructura societaria entera.

**dLocal** (uruguaya, especialista en LatAm): tiene documentación específica de Paraguay (docs.dlocal.com/docs/paraguay). Dato operativo relevante: en Paraguay **Visa Crédito NO soporta cobros recurrentes**; sí lo soportan Visa Débito, Mastercard crédito y débito, y Amex. Para un SaaS por suscripción eso es un problema real de conversión. No publica precios: hay que pasar por su equipo comercial.

**Pagopar / uPay** (local, dentro del ecosistema de ueno bank): tiene módulo de suscripciones con reintentos automáticos. Pero cobra en guaraníes, lo cual no te sirve para clientes de España o México. Comisión citada por un blog (Shoperly, no verificada en la fuente oficial): 5,5–7% + IVA + cargo mensual.

**PayPal**: una cuenta registrada en Paraguay no puede RECIBIR dinero ni mantener saldo. Sirve para pagar, no para cobrar.

**Payoneer**: funciona para recibir, pero las cifras que encontré son de guías de hace ~4 años (1% por recibir USD, hasta 2% por retirar, 0,5% de cambio, US$29,95 anuales si la cuenta queda inactiva 12 meses). No hay tarifario oficial de Paraguay vigente 2026.

**El dato incómodo: Lemon Squeezy también lista ARGENTINA para payouts bancarios.** Es decir: podés cobrar con tarjeta en todo el mundo, hoy, como persona física argentina, sin ninguna empresa paraguaya y con la misma comisión.

== 6. CÓMO LLEGA ESA PLATA A VOS EN ARGENTINA (la parte que decide todo) ==

Acá se cae buena parte del atractivo, y por un motivo muy puntual:

**Paraguay está en el listado oficial de "jurisdicciones de baja o nula tributación" (JBNT) de AFIP/ARCA.** Lo verifiqué abriendo el PDF oficial (afip.gob.ar/fiscalidad-internacional/.../JBNT.pdf, consultado 24/10/2026): Paraguay figura en el puesto **36** de 41. El criterio del documento: jurisdicciones "que presentan régimen general de tributación corporativa inferior al 15%", según el art. 20 de la Ley de Impuesto a las Ganancias y el art. 25 del Decreto Reglamentario. Con IRE al 10%, Paraguay entra por la regla misma, no por capricho de una lista. (El propio PDF aclara que el listado "no es taxativo y fue realizado a título orientativo".)

Por separado: Paraguay SALIÓ de la lista de "no cooperantes" con el Decreto 48/2023, pero sigue siendo JBNT. Son dos listas distintas y se confunden todo el tiempo.

**Qué dispara eso. Dos cosas, y son caras.**

(a) **Transparencia fiscal internacional — art. 130 inc. f) de la Ley de Ganancias.** Si se cumplen cuatro requisitos a la vez, la renta de la sociedad del exterior se le atribuye DIRECTAMENTE al residente argentino, como si la sociedad no existiera. Los requisitos son: que no esté tratada en otros incisos; que los residentes tengan al menos el 50% del patrimonio, resultados o votos — **o, sin importar el porcentaje, cuando tengan derecho a disponer de los activos, la mayoría de la administración o un derecho actual sobre los beneficios**; que el ente **no tenga la organización de medios materiales y personales necesaria** (o que su renta sea mayoritariamente pasiva, o que genere gastos deducibles para vinculados residentes); y que el impuesto pagado afuera sea menor al 75% del que correspondería en Argentina — **y este último se presume, SIN ADMITIR PRUEBA EN CONTRARIO, si el ente está en una jurisdicción de baja o nula tributación.** Paraguay lo está.

Traducido: si la EAS es una cáscara que vos manejás desde Argentina, Argentina la ignora y te cobra a vos la escala progresiva (hasta 35%) sobre la renta de la empresa, con el 10% de IRE paraguayo como costo adicional arriba. **Sale más caro que facturar desde Argentina.** La única defensa real es el tercer requisito: que la empresa tenga de verdad "organización de medios materiales y personales" en Paraguay — gente, decisiones, operación. Eso no se simula: se tiene o no se tiene.

(b) **Precios de transferencia del lado argentino.** Toda operación tuya con un sujeto de una JBNT entra al régimen. El art. 38 de la RG 4717 de ARCA exige justificar la totalidad de las operaciones del ejercicio, incluidas las hechas con sujetos de jurisdicciones de baja o nula tributación, y no permite elegirlas por muestreo. Umbrales citados (TPC Group, a verificar contra la RG y su modificación de septiembre 2026): estudio local cuando superan $3.000.000 en total o $300.000 individualmente. Es un informe profesional por año, todos los años.

**No hay convenio para evitar la doble imposición entre Argentina y Paraguay**, salvo uno limitadísimo: el de transporte internacional aéreo, fluvial y terrestre, firmado el 25/10/1996, Ley argentina 25.184, vigente desde el 19/4/2000 (listado oficial de AFIP). No cubre dividendos ni servicios. Lo que pagues en Paraguay solo podría descontarse por el crédito unilateral por impuestos análogos de la ley argentina, no por tratado.

**La parte cambiaria, en cambio, está mejor que nunca.** Comunicación "A" 8417 del BCRA, del 09/04/2026, punto 2 (leí el PDF oficial): "Extender a todos los conceptos de servicios la excepción a la obligación de liquidación de cobros de exportaciones de servicios que realicen personas humanas". Es decir: como persona física exportando servicios, podés quedarte los dólares sin venderlos al tipo de cambio oficial. La obligación de INGRESAR los fondos por el mercado de cambios en los plazos normativos sigue (el punto 1 de la misma comunicación la menciona expresamente como condición). El tope anual de US$36.000 se eliminó el 19/09/2025.

Costo de mover la plata de Paraguay a Argentina: no encontré tarifas verificadas para esa ruta específica. Referencias generales: Wise 0,4–2%, Western Union 0,5–1,3% más el spread de cambio. Hay que simularlo en la app antes de mover.

== 7. EL CRS, QUE VENCE EN 2027 ==

Según el reporte del Foro Global de la OCDE citado por EY (TAX Flash del 02/06/2026), **el primer intercambio automático de información financiera (CRS) de Paraguay está previsto para 2027.** Argentina intercambia desde 2017.

Esto importa para el encuadre, no para la estrategia: si una ruta te conviene solo porque hoy ARCA no ve automáticamente la cuenta paraguaya, eso no es elusión, es esperar que no te miren — y encima tiene fecha de vencimiento. Declarado, el CRS no te cambia nada. Sin declarar, ya no es legal y queda fuera de este relevamiento por tu propia regla.

**Cuánto cuesta**

Supuestos que uso, todos explícitos: pasarela Lemon Squeezy (5% + US$0,50 por cobro), ticket promedio US$47/mes, y una EAS con sustancia real en Paraguay (una persona trabajando allá ~US$12.000/año + contador ~US$2.400 + varios ~US$1.200 = US$15.600 de costos locales). Los montos de sueldo y contador son estimaciones mías de orden de magnitud, NO datos verificados: no encontré tarifarios confiables (ver "lo que no encontré").

=== SOBRE US$50.000 DE FACTURACIÓN ANUAL ===
- Bruto cobrado a clientes: US$50.000
- Pasarela (5% + US$0,50 × ~1.064 cobros): −US$3.032 → la EAS recibe US$46.968
- Costos locales en Paraguay: −US$15.600 → renta neta US$31.368
- IRE 10% sobre renta neta: −US$3.137
- IDU 8% al distribuir a tu hermana (residente paraguaya): −US$2.259
- Transferencia a Argentina (~1%): −US$260
- **Llega a Argentina: ~US$25.712**
- Impuestos y comisiones (sin contar los US$15.600 de costos operativos, que son costos, no impuestos): US$8.688 = **17,4% de la facturación**
- **Y Argentina todavía no cobró nada.** Lo que recibas hay que declararlo y pagarlo acá.

=== SOBRE US$200.000 DE FACTURACIÓN ANUAL ===
- Bruto: US$200.000
- Pasarela (~4.255 cobros): −US$12.128 → la EAS recibe US$187.872
- Costos locales: −US$15.600 → renta neta US$172.272
- IRE 10%: −US$17.227
- IDU 8% a tu hermana: −US$12.404
- Transferencia (~1%): −US$1.426
- **Llega a Argentina: ~US$141.215**
- Impuestos y comisiones: US$43.185 = **21,6% de la facturación**, otra vez antes de Argentina.

=== LAS TRES PALANCAS QUE MUEVEN MUCHO ESTOS NÚMEROS ===

1) **Si aplica el art. 20 (renta presunta 30% → IRE efectivo 3% del bruto):**
   - A US$50.000: IRE baja de US$3.137 a US$1.409 (ahorro US$1.728/año)
   - A US$200.000: IRE baja de US$17.227 a US$5.636 (**ahorro US$11.591/año**)
   Es la pregunta de mayor impacto de todo el relevamiento. Hay que confirmarla.

2) **Si el accionista sos VOS en lugar de tu hermana (IDU 15% en vez de 8%):**
   - A US$50.000: +US$1.976/año
   - A US$200.000: +US$10.853/año
   Y además te metés de lleno en el art. 130: con ≥50% de la empresa, sos el controlante argentino.

3) **Si la EAS NO tiene sustancia real (sin gente ni operación en Paraguay):**
   - El IRE sube porque la base es mayor: a US$200.000, 10% × US$187.872 = US$18.787
   - Y se activa el art. 130: la renta se te atribuye a vos en Argentina. Ganancias a escala progresiva (hasta 35%) sobre ~US$187.872 ≈ **US$65.755**, con crédito por el impuesto análogo pagado afuera. Peor escenario de todos.

=== LA COMPARACIÓN QUE NO TE VA A GUSTAR ===

Cobrando con la MISMA pasarela, como persona física argentina, sin ninguna empresa paraguaya (Lemon Squeezy lista Argentina para payouts bancarios):
- Pasarela: lo mismo (US$3.032 / US$12.128)
- IVA: exportación de servicios a tasa cero
- Ganancias: escala progresiva sobre la renta neta
- Ingresos Brutos: según tu provincia
- Cambiario: Comunicación "A" 8417 te deja quedarte los dólares sin liquidar
- Costo de la estructura: **cero**. Sin art. 130, sin precios de transferencia, sin IDU, sin transferencia internacional, sin contador en dos países.

**No pagás el 10% de IRE, ni el 8–15% de IDU, ni la transferencia.** Y Argentina te cobra lo mismo en los dos casos, porque los residentes argentinos tributan por renta mundial.

=== LA CONCLUSIÓN HONESTA ===

La estructura paraguaya NO reemplaza al impuesto argentino: lo SUMA. Agrega 10% de IRE + 8–15% de IDU + costo de transferencia + contador paraguayo + estudio de precios de transferencia en los dos países, y no te saca de la escala argentina.

Solo gana en tres casos, y los tres son decisiones grandes, no trucos:
(a) **Que el negocio se mude de verdad a Paraguay** — gente, decisiones y operación allá. Es lo único que vence el art. 130 y convierte el 10% en el impuesto final, no en una capa extra.
(b) **Que vos dejes de ser residente fiscal argentino.** Es la única forma de que Argentina no te cobre renta mundial. Es una decisión de vida, no de contador.
(c) **Que la empresa sea genuinamente de tu hermana** — que ella la dirija, asuma el riesgo y tome las decisiones. Entonces la plata es de ella, no tuya. Eso no es una estrategia fiscal para vos: es regalar la empresa.

Lo que NO es una opción: que figure a nombre de ella pero la manejes vos. Eso es simulación, no elusión. Lo atrapa el art. 2 de la Ley 11.683 (realidad económica) y lo atrapa el art. 130 igual, porque el inciso f) activa la atribución "sin importar el porcentaje" cuando el residente tiene derecho a disponer de los activos, la mayoría de la administración o un derecho actual sobre los beneficios. Y encima el CRS llega en 2027. Lo descarto y te digo por qué, como pediste.

**Mi lectura práctica:** a US$50.000 la estructura paraguaya pierde contra facturar desde Argentina, sin discusión. A US$200.000 recién empieza a tener sentido discutirla, y solo si (1) el art. 20 aplica y (2) hay sustancia real en Paraguay. Antes de armar nada, conectá la pasarela y empezá a cobrar desde Argentina: eso lo podés hacer esta semana y no te cierra ninguna puerta.

**Riesgos**

**1. El riesgo que mata la estructura: transparencia fiscal (art. 130 inc. f, Ley de Ganancias).**
Paraguay está en el listado JBNT de ARCA, así que el requisito de "baja tributación" se presume SIN ADMITIR PRUEBA EN CONTRARIO. No se puede discutir. Lo único que queda para defenderse es demostrar que la EAS tiene "organización de medios materiales y personales" en Paraguay. Si es una cáscara, Argentina te atribuye la renta directamente y pagás escala argentina (hasta 35%) con el 10% paraguayo como costo perdido arriba. Y la atribución puede dispararse **sin importar el porcentaje** que tengas, si tenés derecho a disponer de los activos, la mayoría de la administración o un derecho actual sobre los beneficios. Es decir: ponerla a nombre de tu hermana pero manejarla vos no te protege del art. 130.

**2. Lo frágil: la pasarela sostiene toda la estructura y está en transición.**
Lemon Squeezy es la única opción que verifiqué en documentación oficial que paga a Paraguay. Y Stripe la compró en julio de 2024, el equipo fundador está en el producto propio de Stripe, el soporte está más lento y el camino esperado es migrar a Stripe Managed Payments — que es invite-only y, según terceros, más caro (~6,4% + 30¢, sin verificar en la página oficial de Stripe). Si Lemon Squeezy cierra altas o migra, una EAS paraguaya se queda sin forma de cobrar con tarjeta en dólares, porque Stripe no opera en Paraguay. **Montar una sociedad en otro país apoyada en un proveedor en transición es el punto más débil de todo el plan.**

**3. Las suscripciones recurrentes en Paraguay tienen un agujero técnico.**
La documentación de dLocal marca que en Paraguay **Visa Crédito no soporta cobros recurrentes**. Para un SaaS a US$47 y US$97 por mes, eso es pérdida directa de conversión y de retención, no un detalle.

**4. La cuenta bancaria no viene con la empresa.**
Tener la EAS no garantiza que un banco te la abra: cada banco corre su propio KYC y pide documentación extra cuando hay socios extranjeros o no residentes, con declaración jurada de origen de fondos (conta.com.py). Podés tener la empresa constituida en 72 horas y quedarte semanas o meses sin cuenta. Es el riesgo de quedarte a mitad de camino: empresa abierta, obligaciones mensuales corriendo, y sin poder cobrar.

**5. Dos contabilidades, dos estudios de precios de transferencia, para siempre.**
Paraguay: art. 39 Ley 6380/2019 obliga a conservar Estudio Técnico por operaciones con partes relacionadas del exterior. Argentina: RG 4717 art. 38 obliga a justificar la totalidad de las operaciones con sujetos de jurisdicciones de baja o nula tributación, sin poder elegirlas por muestreo. Son dos informes profesionales por año, todos los años, más contador paraguayo con declaraciones mensuales en Marangatu. Ese costo fijo no baja si facturás menos: **a US$50.000 te come el beneficio completo.**

**6. Depende de algo que puede cambiar: dos de los tres pilares del ahorro.**
- El art. 20 (renta presunta 3%) es una interpretación a confirmar, y el propio artículo dice que una vez que optás no podés cambiar por 5 años. Si el contador dice que no aplica, el IRE pasa de 3% a 10% sobre renta real y el caso de US$200.000 pierde US$11.591 al año de ahorro.
- La permanencia de Paraguay en el listado JBNT. Hoy está. Pero incluso si saliera del listado, con IRE al 10% sigue por debajo del umbral legal del 15%, así que el art. 130 lo atraparía igual por la regla, no por la lista.
- Los umbrales de precios de transferencia argentinos se modificaron en septiembre de 2026. Son normas que se mueven.

**7. El riesgo de encuadre, que es el más serio de todos.**
Tres de las variantes que se discuten en esta estructura cruzan de elusión a simulación: que la empresa figure a nombre de tu hermana pero la manejes vos; que ella te gire "regalos" que en realidad son tu facturación; y que la empresa declare sustancia en Paraguay que no tiene. Las descarto por tu propia regla. Y el relevamiento muestra por qué, más allá de lo legal: el art. 2 de la Ley 11.683 permite a ARCA mirar el fondo económico por encima de la forma, el art. 130 no mira porcentajes cuando hay control de hecho, y el CRS paraguayo arranca en 2027. Las tres rutas dependen de que nadie mire. Ninguna es una estrategia.

**8. Un riesgo familiar que no es fiscal pero es real.**
Si la estructura la sostiene tu hermana como representante legal y accionista, ella queda solidariamente expuesta: es la responsable legal ante la DNIT, firma las declaraciones, y los agentes de retención "responderán solidariamente por el pago del impuesto" (arts. 41 y 77, Ley 6380/2019). Si algo sale mal, el problema es de ella, con su nombre y su cédula. Eso hay que conversarlo con ella antes que con el contador.

**Lo que no se encontró**

**Costos de mantenimiento anual: no hay un solo dato confiable.** Es el hueco más grande del relevamiento y afecta directamente el cálculo. No encontré tarifas de contador paraguayo para una EAS exportadora de servicios, ni costos de mantenimiento de cuenta bancaria, ni el precio de un Estudio Técnico de precios de transferencia en Paraguay. Lo único que apareció son estimaciones de proveedores que venden el servicio: honorarios legales ~US$1.500 + registros impositivos y contables ~US$500 (guía de UNIDA), o €1.500–2.500 todo incluido desde España (Nexo Paraguay). Son partes interesadas, no fuentes neutrales. Los US$15.600 de costos locales que usé en el cálculo son una estimación mía de orden de magnitud, no un dato. **Hay que pedir cotizaciones reales a dos o tres contadores paraguayos antes de decidir cualquier cosa.**

**Si el art. 20 aplica a un SaaS.** Es la pregunta de mayor impacto económico (US$11.591/año a US$200.000 de facturación) y no la pude resolver con fuentes públicas. No encontré resoluciones de la DNIT, dictámenes ni jurisprudencia que digan si un software por suscripción entra en "emisión y recepción de datos por internet protocol y otros servicios similares, que se presten desde el país al exterior", ni cómo se interpreta la frase "ejercidas parcialmente dentro del país" del mismo artículo.

**La contradicción del IRE SIMPLE sin resolver.** La presentación oficial de la DNIT excluye expresamente a "Sociedades en general" y a quienes "realicen actividades de importación y exportación". La cartilla informativa de la DNIT, también oficial, habla de "entidades y empresas privadas de cualquier naturaleza, con personería jurídica o sin ella". Las dos son de la misma administración tributaria y no dicen lo mismo. No encontré la norma que zanje cuál manda (habría que leer el art. 2 num. 1 y 8 de la Ley 6380/2019 con el art. 77 del Decreto 3182/2019 y la RG 61/2020).

**Cómo tributa en Argentina un dividendo de una sociedad del exterior cobrado por una persona física. Las fuentes se contradicen de frente.** Una sostiene que va por la escala progresiva del art. 94 de la Ley de Ganancias (hasta 35%). Otra sostiene que va como renta de segunda categoría al 15% sobre el neto. Y todas tratan el caso de CEDEARs, no el de una sociedad extranjera propia con crédito por impuesto análogo. No pude llegar al texto del art. 130 ni del art. 94 en InfoLEG: la página oficial tiene 369.729 caracteres y se corta en el art. 55; lo que tengo del art. 130 viene de una fuente secundaria (leyes-ar.com) que resumió los incisos. **El texto literal del art. 130 habría que verificarlo en el Boletín Oficial.**

**Elegibilidad de vendedores paraguayos en los otros merchants of record.** Paddle: su documentación oficial lista Paraguay y Argentina como mercados donde se puede VENDER (compradores), pero no dice nada sobre desde dónde puede registrarse un VENDEDOR. Esa página además tiene ~899 días de antigüedad. FastSpring, 2Checkout/Verifone, Polar, Creem y Dodo Payments: no encontré listas de países de vendedor para ninguno. Hay que preguntarle a cada proveedor directamente.

**Precios de dLocal.** No los publica. Hay que pasar por su equipo comercial, y los requisitos de onboarding "dependen de tu entidad" según su propio FAQ.

**Costo real de la ruta Paraguay → Argentina.** No encontré ninguna tarifa verificada para esa ruta específica en guaraníes o dólares. Las cifras que usé (~1%) salen de rangos genéricos de comparadores (Wise 0,4–2%, Western Union 0,5–1,3% más spread) que ni siquiera coinciden entre sí. Se simula en la app antes de mover plata.

**Alícuota de Bienes Personales 2026 sobre acciones de una sociedad del exterior.** La Ley 27.743 eliminó la alícuota diferencial agravada para bienes en el exterior, pero no encontré fuente oficial de ARCA con la alícuota vigente 2026 ni el mínimo no imponible confirmado. Una fuente da $384.728.044,57 de mínimo, sin respaldo oficial. Tampoco encontré cómo se valúa una participación en una EAS paraguaya (¿valor patrimonial proporcional? ¿costo de adquisición?).

**Si Paraguay sigue en el listado JBNT en 2026.** El PDF que leí es el que está publicado hoy en el sitio de AFIP, pero no tiene fecha de publicación ni de vigencia. Esto importa menos de lo que parece: con IRE al 10%, Paraguay queda por debajo del umbral legal del 15% por la regla misma, así que la conclusión no depende de la lista.

**Un dato con fuentes enfrentadas: el CRS paraguayo.** El reporte de la OCDE vía EY (02/06/2026) dice que el primer intercambio es en 2027. Un blog de residentes en Paraguay afirma que ya intercambia. Me quedo con la OCDE, pero lo marco.

**Para el contador**

**Llevale estas cuatro, en este orden. Las dos primeras son para un contador PARAGUAYO; las dos últimas para tu contador argentino. Idealmente que se hablen entre ellos: la mitad de los problemas de esta estructura nacen en el cruce.**

**1. (Paraguay — la pregunta de los US$11.591 al año) ¿Puede una EAS que vende un software por suscripción a clientes del exterior liquidar el IRE por el art. 20 de la Ley 6380/2019, con renta neta presunta del 30% sobre el ingreso bruto, quedando el impuesto en un 3% efectivo de la facturación?**
Contexto para que no te manden a averiguar: el art. 20 incluye "emisión y recepción de datos por internet protocol y otros servicios similares, que se presten desde el país al exterior", pero el encabezado habla de actividades "ejercidas parcialmente dentro del país". Pedile que te diga en qué se apoya: resolución de la DNIT, dictamen o jurisprudencia. Y de paso: confirmame que una EAS no puede usar el IRE SIMPLE, porque la presentación oficial de la DNIT excluye a "sociedades en general" y a quienes exportan, pero la cartilla informativa de la misma DNIT parece decir otra cosa.

**2. (Paraguay) Si la EAS me paga a mí, residente argentino, por desarrollo y soporte del software: ¿la retención del INR es del 10,5% (art. 75 num. 4, servicios personales con renta neta presunta del 70%) o del 15% pleno (art. 75 num. 6, pagos a socios, accionistas o entidades vinculadas)? ¿Y ese pago es deducible para el IRE, con qué documentación y qué Estudio Técnico de precios de transferencia hace falta?**
Pedile el presupuesto del Estudio Técnico anual junto con la respuesta. Es un costo fijo que define si la estructura cierra a tu nivel de facturación.

**3. (Argentina — la que decide si todo esto sirve o no) Paraguay está en el listado JBNT de ARCA. ¿En qué configuración concreta de esta estructura NO se me aplica la transparencia fiscal del art. 130 inc. f) de la Ley de Ganancias, y qué sustancia real tiene que tener la empresa en Paraguay para que no se me aplique?**
Dejale claro el dato que no se discute: el requisito de baja tributación se presume sin admitir prueba en contrario porque Paraguay está en el listado. Entonces la pregunta real es solo el requisito de la "organización de medios materiales y personales": ¿cuánta gente, qué decisiones tomadas allá, qué documentación? Y preguntale derecho: **¿me conviene esto o me conviene facturar desde Argentina como exportador de servicios?** Que te dé el número de los dos lados.

**4. (Argentina) Si cobro dividendos de la EAS paraguaya: ¿a qué alícuota tributan en Ganancias — escala progresiva hasta el 35% o 15% cedular? ¿Puedo tomar como crédito el IDU del 8% o 15% que se pagó en Paraguay, sabiendo que NO hay convenio de doble imposición con Paraguay salvo el de transporte internacional (Ley 25.184)? ¿Y cómo valúo y declaro la participación en la EAS en Bienes Personales?**
Esta la hago explícita porque las fuentes públicas se contradicen de frente: unas dicen escala progresiva, otras 15%. No es un detalle: entre 15% y 35% sobre US$142.641 hay más de US$28.000 de diferencia.

**Una quinta, que no es para el contador sino para tu hermana, y que yo pondría primero:** si ella va a ser representante legal y accionista, queda como responsable solidaria del pago de los impuestos ante la DNIT (arts. 41 y 77, Ley 6380/2019), firma las declaraciones mensuales y pone su cédula en todo. ¿Está de acuerdo, sabiendo eso? Porque la estructura no existe sin ella, y ese "sí" vale más que cualquier alícuota.

**Nota de cosecha para el Cerebro:** el hallazgo reutilizable de esta corrida no es fiscal, es de producto — hay dos cosas que conviene dejar escritas donde vive el código de cobros: (a) Stripe no opera en Paraguay ni en Argentina, y el merchant of record que sí paga a ambos (Lemon Squeezy, 5% + US$0,50) está en transición hacia Stripe Managed Payments, así que la integración de pagos no debería acoplarse fuerte a él; (b) en Paraguay, Visa Crédito no soporta cobros recurrentes según la documentación de dLocal, lo que rompe el modelo de suscripción para clientes paraguayos y hay que manejarlo explícitamente en el flujo de cobro. Eso va a `docs/hallazgos-pagos.md` con su entrada en el índice.


---

## Brasil con tu hermana: la ruta se cae en la primera condición (ni el Simples ni Stripe aceptan un dueño que vive afuera), y si la forzás a Lucro Presumido, Brasil te sale ~17% de la facturación

**Lo medido**

**Antes de todo: no soy contador ni abogado.** Esto es un relevamiento de hechos públicos leídos el 24/10/2026, para que llegues al contador con las opciones sobre la mesa. Casi todas las fuentes de alícuotas que hay en la web son blogs contables; marqué cuáles son texto legal y cuáles no.

**Tipo de cambio usado:** US$1 = R$5,00 (PTAX del BCB del 23/10/2026: R$5,0377; dólar comercial de cierre ese día: R$4,993 — [Piranot](https://www.piranot.com.br/2026/10/23/noticias/economia/dolar-ptax-fecha-em-r-50377-nesta-sexta-feira-23-10-2026-veja-a/), [NC News](https://ncnews.com.br/2026/10/23/dolar-cai-fech-ibovespa-sobe/)).

---

### 1) El tapón que define todo: el Simples Nacional prohíbe dueño domiciliado en el exterior

La LC 123/2006, art. 17, inciso II, hoy dice textual: *"cujo titular ou sócio seja domiciliado no exterior"* — es decir, la empresa **no puede** estar en el Simples Nacional si el titular o un socio está domiciliado afuera. La redacción fue cambiada por la LC 214/2025 (antes decía sólo "sócio"; ahora alcanza también al titular, o sea al dueño único), con efectos desde el 1/1/2025 ([texto consolidado, leído 24/10/2026](https://modeloinicial.com.br/lei/LCP-123-2006/estatuto-nacional-microempresa-da-empresa-pequeno-porte/art-17); comentarios: [LatamContábil](https://latamcontabil.com/empresa-no-brasil-com-socio-no-exterior-obrigacoes-fiscais/)).

Traducido a tu caso: tu hermana **tiene residencia brasileña pero vive en Paraguay**. Si está domiciliada en Paraguay, la empresa queda fuera del Simples. Y si vos entrás como socio, también, porque vivís en Argentina. O sea: el 6% del Anexo III y el 15,5% del Anexo V — que es todo el atractivo de Brasil — sólo están disponibles si la dueña **vive de verdad en Brasil**. Declararla domiciliada en Brasil sin que lo esté es simular residencia: queda afuera de esta investigación por la regla 1 (elusión sí, simulación no).

### 2) El segundo tapón, y es de Stripe: el representante legal tiene que vivir en Brasil

De la propia página de soporte de Stripe para Brasil (leída 24/10/2026): *"the legal representative must be resident in Brazil"*, el CPF del representante es **obligatorio**, la cuenta bancaria de cobro tiene que ser **brasileña, en reales (BRL) y atada al mismo CNPJ**, y hace falta una dirección comercial en Brasil. Los socios **sí** pueden ser extranjeros, pero los que viven afuera *"will need to add the details of a legal representative in Brazil"* ([Stripe Support – Brazil-specific information](https://support.stripe.com/questions/brazil-specific-information-to-open-a-stripe-account)).

O sea: Brasil + Stripe exige una persona física que viva en Brasil firmando como representante legal, con su CPF y su cara. Tu hermana en Paraguay no cubre eso. El procurador ante la Receita y el Banco Central es otra figura que también tiene que estar en Brasil ([Contabilizei, guía 2026](https://www.contabilizei.com.br/contabilidade-online/abertura-de-empresa-por-estrangeiro-no-brasil/)).

### 3) Si igual la dueña se domiciliara en Brasil: los números del Simples 2026

- **Fator R:** nómina de los últimos 12 meses ÷ facturación de los últimos 12 meses. ≥28% → Anexo III (arranca en 6%); <28% → Anexo V (arranca en 15,5%) ([Contmatic](https://simplifique.contmatic.com.br/blogs/fator-r-simples-nacional-o-que-e-como-calcular), [Trivium](https://triviumcontabil.com.br/fator-r-em-2026/)).
- **Tablas 2026 (blogs coincidentes, no texto legal):** Anexo III: 6% hasta R$180k; 11,2% (deducción R$9.360) hasta R$360k; 13,5% (R$17.640) hasta R$720k; 16% (R$35.640) hasta R$1,8M; 21% (R$125.640) hasta R$3,6M; 33% (R$648.000) hasta R$4,8M. Anexo V: 15,5% / 18% / 19,5% / 20,5% / 23% / 30,5% ([ContaJá](https://contaja.com.br/blog/tabela-simples-nacional/), [Xpertus](https://xpertus.com.br/blog/simples-nacional-2026-tabelas-anexos-fator-r-sublimite-icms)).
- **El descuento por exportar, que es el dato que más importa:** la Resolución CGSN 140/2018, art. 25 §3º manda **sacar de la alícuota los porcentajes de COFINS, PIS, IPI, ICMS e ISS** sobre la facturación exportada (base: LC 123/2006 art. 18 §14; confirmado por la Solución de Consulta Cosit nº 73/2025, que define exportación de servicios como la prestación a persona física o jurídica domiciliada en el exterior — [SC Cosit 73/2025](https://www.econeteditora.com.br/bdi/st/st25/PDF/221963_SC_Cosit_n%C2%BA_73-2025.pdf), [Rotina Fiscal](https://www.rotinafiscal.com.br/operacoes-fiscais/exportacao)). En la 1ª franja del Anexo III el reparto es IRPJ 4,00% / CSLL 3,50% / COFINS 12,82% / PIS 2,78% / CPP 43,40% / ISS 33,50%: sacando COFINS+PIS+ISS se cae **49,1% de la alícuota**, así que el 6% nominal queda en ~3,05% efectivo. (El reparto de las franjas siguientes no lo pude confirmar en fuente oficial; ver "lo que no encontré".)
- **Techo:** R$4,8M al año de mercado interno **más** un adicional de R$4,8M exclusivo de exportación (LC 123/2006 art. 3º §14). Ojo: una fuente sostiene que la exportación igual computa para el límite global y otras que son techos separados — está en discusión ([LogComex](https://blog.logcomex.com/exportacao-simples-nacional), [Hopecont](https://hopecont.com/blog/simples-nacional-para-empresa-de-tecnologia-vale-a-pena-em-2026/)). A tu escala (hasta US$1M/año) ni lo roza.
- **El Fator R no es gratis, y esto nadie lo dice en el titular:** para llegar al 28% hay que pagar de verdad 28% de la facturación como nómina/pro-labore en Brasil. Eso cuesta INSS 11% sobre el pro-labore (base mínima el salario mínimo R$1.621,00, techo R$8.475,55 → máximo R$932,31/mes = R$11.188/año) **más IRPF personal de hasta 27,5%** sobre ese pro-labore ([Agilize](https://artigos.agilize.com.br/pro-labore-inss-simples-nacional/), [ContaJá INSS pró-labore](https://contaja.com.br/blog/inss-pro-labore/)). A US$200.000/año de facturación, el pro-labore necesario es R$280.000/año y el IRPF sobre eso se come casi todo el ahorro de pasar del Anexo V al III.

### 4) La ruta realista con dueña no residente: Lucro Presumido

- Presunción de **32%** para servicios; sobre esa base: IRPJ 15% + adicional 10% sobre la parte del lucro presunto que pase de **R$60.000 por trimestre**; CSLL 9%. Sigue vigente en 2026 ([JetTax](https://www.jettax.com.br/blog/tabela-presuncao-do-lucro-presumido/), [Paulicon](https://paulicon.com.br/2026/01/23/tributacao-pelo-lucro-presumido-em-2026/)).
- **PIS/COFINS: no inciden sobre exportación de servicios** (Lei 10.637/2002 art. 5º, II y Lei 10.833/2003 art. 6º, II), con dos condiciones: tomador residente o domiciliado en el exterior **y** que el pago represente "ingreso de divisas" ([Tributo Devido](https://tributodevido.com.br/ingresso-divisas-exportacao-servicos/), [Contabilizei](https://www.contabilizei.com.br/contabilidade-online/tributacao-sobre-exportacao-de-servicos-o-que-e-e-quais-os-impostos-incidem/)).
- **ISS: no incide** sobre exportación (LC 116/2003 art. 2º, I), salvo el servicio desarrollado en Brasil "cuyo resultado acá se verifique". Esto último es el agujero: ver riesgos.
- **LC 224/2025 sube 10% los porcentajes de presunción** (servicios: de 32% a 35,2%) pero **sólo sobre la facturación anual que pase de R$5 millones**; IRPJ desde el 1/1/2026 y CSLL desde el 1/4/2026 ([Migalhas](https://www.migalhas.com.br/depeso/450267/lc-224-25-nova-regra-eleva-carga-tributaria-do-lucro-presumido), [Calculadora Contábil](https://www.calculadoracontabil.com.br/blog/lucro-presumido-lc-224-2026-maioracao-presuncao)). A tu escala no te toca.

### 5) El impuesto nuevo que rompe la ecuación: 10% al sacar los dividendos

La **Lei nº 15.270/2025** (sancionada el 26/11/2025), §4º, texto legal: *"Os lucros ou dividendos pagos, creditados, entregues, empregados ou remetidos ao exterior ficarão sujeitos à incidência do imposto de renda na fonte à alíquota de 10%"* — **sin mínimo exento**, desde 2026. La franquicia de R$50.000/mes exentos es sólo para residentes en Brasil ([texto en la Cámara](https://www2.camara.leg.br/legin/fed/lei/2025/lei-15270-26-novembro-2025-798354-publicacaooriginal-177117-pl.html), [Mayer Brown](https://www.mayerbrown.com/pt/insights/publications/2025/12/enactment-of-law-no-15270-2025-which-establishes-dividend-taxation-expands-the-exemption-threshold-and-introduces-a-minimum-tax-on-high-incomes), [Felsberg](https://www.felsberg.com.br/lei-15270-tributacao-lucros-dividendos-2026/)). Los lucros acumulados hasta 2025 quedarían afuera, con condiciones.

Esto cambia el titular: **Brasil es barato mientras la plata se queda en Brasil.** Si el dueño vive afuera y quiere la plata afuera, hay un 10% adicional en la puerta.

### 6) Cómo sale la plata de Brasil (IOF y régimen cambiario)

- **Remesa de dividendos y JCP a inversor extranjero: IOF 0%** (Decreto 6.306/2007 con las modificaciones del Decreto 12.499/2025).
- **Ingreso de receita de exportación: IOF 0%** (art. 15-B, I), pero sujeto a plazos y forma fijados por CMN/BCB — hay jurisprudencia del TRF-4 sobre esto y el riesgo es de prueba documental.
- **Cualquier otra salida (transferencia a cuenta propia afuera, pago de servicios, tarjeta internacional): 3,5%**, alícuota del Decreto 12.499/2025, restablecida por cautelar del STF del 16/7/2025 (ADIs 7.827 y 7.839, ADC 96) después de que el Congreso intentara tumbarla con el Decreto Legislativo 176/2025. Antes de mayo de 2025 era 0,38% ([O Tributo, 14/5/2026](https://o-tributo.com/iof-cambio-remessas-exterior-2026), [Barbieri](https://www.barbieriadvogados.com/iof-2025-guia-completo-das-aliquotas-apos-decisao-do-stf-analise-juridica/)).

Es decir: la vía "dividendo declarado" es la única barata para sacar plata. Sacarla como transferencia propia cuesta 3,5% de IOF además del impuesto.

### 7) Tratado con Argentina, y nada con Paraguay

El protocolo de Mendoza (21/7/2017) que modificó la convención Brasil–Argentina fue promulgado por el **Decreto 9.482/2018**; entró en vigor en el plano externo el 29/7/2018 y las retenciones en la fuente aplican desde el 1/1/2019. Limita la retención de dividendos a 10% o 15% según el caso ([Decreto 9.482/2018](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9482.htm), [IBET](https://www.ibet.com.br/protocolo-altera-a-convencao-entre-brasil-e-argentina-para-evitar-dupla-tributacao/)). Conclusión práctica: el 10% de la ley nueva **cabe dentro del límite del tratado**, así que el tratado no te lo baja; lo que sí te da es crédito del lado argentino.

**Con Paraguay, Brasil no tiene tratado vigente**: en el Mercosur su único acuerdo de doble tributación es con Argentina ([CNI/Portal da Indústria](https://noticias.portaldaindustria.com.br/noticias/internacional/acordo-para-evitar-dupla-tributacao-deve-ser-prioridade-com-paraguai/)). Si la dueña está en Paraguay, el 10% de Brasil se paga sin alivio de tratado.

### 8) Abrir y mantener: obligaciones y costos

- Socio extranjero no residente **puede** ser socio; necesita **CPF** y otorgar poder a un **procurador** residente en Brasil, que responde ante la Receita y el Banco Central ([Contabilizei](https://www.contabilizei.com.br/contabilidade-online/abertura-de-empresa-por-estrangeiro-no-brasil/), [Contrato.social](https://www.contrato.social/blog/empresa-com-socio-estrangeiro-regras-e-documentacao-necessaria)).
- **Banco Central (SCE-IED, ex RDE-IED):** la obligación de declarar el capital extranjero es de **la empresa brasileña receptora**, no del inversor. Base: Resolución BCB nº 278/2022. Movimientos a informar en **30 días** (desde el 1/10/2024) y declaración anual con fecha base 31/12 entre enero y marzo. Multas citadas: 1% del valor (tope R$25.000) por fuera de plazo y 10% (tope R$250.000) por información falsa ([Econet](https://blog.econeteditora.com.br/investimento-estrangeiro-direto-ied-obrigacoes-prazos-e-penalidades-junto-ao-banco-central/), [Manual SCE-IED del BCB](https://www.bcb.gov.br/content/estabilidadefinanceira/rde/manuais_RDE/Manual-SCE-IED2.pdf)).
- **Costos (estimaciones de contadores, 2026):** tasa de Junta Comercial R$110–R$609 según el estado (São Paulo ~R$219 para LTDA); honorarios de apertura R$500–R$2.000; **contabilidad mensual en Lucro Presumido R$400–R$1.500/mes**; certificado digital e-CNPJ R$100–R$400/año ([Jornal Contábil](https://jornalcontabil.com.br/noticia/quanto-custa-em-media-abrir-empresa-no-brasil-em-2026/), [Contabilizei](https://www.contabilizei.com.br/contabilidade-online/quanto-custa-abrir-empresa-em-2026/), [oHub](https://www.ohub.com.br/precos/abertura-empresa)).

### 9) Stripe Brasil: lo que de verdad te cobra

Página oficial de precios de Stripe Brasil (leída 24/10/2026): **3,99% + R$0,39** por transacción con tarjeta nacional, **+2%** con tarjeta internacional aplicado *sobre el monto ya convertido a moneda local*, Pix 1,19% (**sólo por invitación**), Boleto R$3,45. Conversión de moneda con Adaptive Pricing "desde 2%" ([stripe.com/en-br/pricing](https://stripe.com/en-br/pricing)).

Como tus clientes están en LatAm y España, lo que pagás no es 3,99% sino **~5,99% + R$0,39 por cobro**. Sobre un cobro de US$47 (R$235) son R$14,47 → **6,2% de tu facturación**, no 4%.

Y un detalle del propio Stripe que conviene tener presente: *"Remittance to or from countries with foreign exchange control (including, but not limited to, Brazil) is carried out exclusively through authorized channels, pursuant to the legislation applicable in those countries"* ([docs.stripe.com/currencies](https://docs.stripe.com/currencies)).

### 10) La reforma tributaria: tu cuenta de hoy no vale para 2027

2026 es **año de prueba** del IBS/CBS: alícuota testigo de 1% (CBS 0,9% + IBS 0,1%, art. 343 de la LC 214/2025) que se informa en los documentos pero no se recauda, y **los optantes del Simples quedan fuera de la fase de prueba** (entran en 2027). La CBS empieza a cobrarse de verdad en enero de 2027, cuando se extinguen PIS y COFINS ([SimTax](https://simtax.com.br/ano-de-testes-do-ibs-e-da-cbs-em-2026/), [Fenacon](https://fenacon.org.br/reforma-tributaria/reforma-tributaria-entra-em-fase-de-testes-em-2026/), [Reforma Tributária](https://www.reformatributaria.com/negocios/empresas-do-simples-nacional-nao-estao-obrigados-as-aliquotas-teste-de-ibs-cbs-em-2026/)). La buena noticia: en el modelo nuevo **la exportación de servicios y bienes inmateriales es inmune, con mantenimiento de créditos** ([Contabilizei](https://www.contabilizei.com.br/reforma-tributaria/artigo/exportacao-de-servicos-reforma-tributaria/)). La mala: las tablas del Simples cambian de composición en 2027-2028 (CBS/IBS reemplazan a PIS/COFINS), así que el cálculo del descuento por exportar hay que rehacerlo.

**Cuánto cuesta**

Base: facturación 100% exportada (clientes fuera de Brasil), US$1 = R$5,00, sin descontar gastos operativos (en Lucro Presumido la base es presunta, los gastos reales no bajan el impuesto).

---

### ESCENARIO REALISTA — Lucro Presumido (dueña NO domiciliada en Brasil), toda la plata repatriada

**A US$50.000/año = R$250.000**
- Lucro presunto: 32% × R$250.000 = R$80.000
- IRPJ 15% × R$80.000 = **R$12.000**
- Adicional 10%: R$80.000 < R$240.000/año → **R$0**
- CSLL 9% × R$80.000 = **R$7.200**
- PIS/COFINS exportación: R$0 · ISS exportación: R$0
- **Subtotal impuesto corporativo: R$19.200 = 7,68% de la facturación = US$3.840**
- IRRF 10% al remesar dividendos (Lei 15.270/2025): 10% × R$230.800 = **R$23.080 = US$4.616**
- **Impuestos Brasil, total: R$42.280 = 16,9% = US$8.456/año**
- Stripe (~6,2% con tarjeta internacional): **US$3.100/año**
- Contabilidad Lucro Presumido (R$400–1.500/mes) + e-CNPJ: **US$1.000–3.700/año**
- Apertura, una vez: junta R$110–609 + honorarios R$500–2.000 = **US$120–520**
- **TOTAL AÑO 1 ≈ US$12.700–15.800 sobre US$50.000 → 25% a 32% de la facturación**

**A US$200.000/año = R$1.000.000**
- Lucro presunto: R$320.000
- IRPJ 15% = **R$48.000**; adicional 10% × (R$320.000 − R$240.000) = **R$8.000**
- CSLL 9% × R$320.000 = **R$28.800**
- **Subtotal corporativo: R$84.800 = 8,48% = US$16.960**
- IRRF 10% dividendos: 10% × R$915.200 = **R$91.520 = US$18.304**
- **Impuestos Brasil, total: R$176.320 = 17,6% = US$35.264/año**
- Stripe (~6,2%): **US$12.400/año**
- Contabilidad: **US$1.000–3.700/año**
- **TOTAL ≈ US$48.700–51.400 sobre US$200.000 → 24% a 26% de la facturación**

**El dato que define la decisión:** si la plata se queda en Brasil (reinversión), pagás 7,7%–8,5%. El 10% de dividendos casi **duplica** la carga apenas la querés afuera. Brasil es barato para una empresa cuyo dueño vive en Brasil.

---

### ESCENARIO "SI LA DUEÑA SE DOMICILIA EN BRASIL DE VERDAD" — Simples Nacional, Anexo III con Fator R

**A US$50.000/año = R$250.000** (2ª franja)
- Alícuota efectiva nominal: (R$250.000 × 11,2% − R$9.360) / R$250.000 = **7,456%**
- Sacando PIS+COFINS+ISS por exportación (≈49% de la alícuota en la 1ª franja; el reparto de la 2ª no lo pude confirmar oficialmente): **≈3,8% → R$9.500 ≈ US$1.900/año**
- Costo del Fator R: pro-labore 28% = R$70.000/año → INSS 11% ≈ R$7.700 + IRPF personal sobre ese pro-labore
- Más 10% de IRRF si los dividendos salen del país

**A US$200.000/año = R$1.000.000** (4ª franja)
- Alícuota efectiva nominal: (R$1.000.000 × 16% − R$35.640) / R$1.000.000 = **12,44%**
- Con la quita por exportación: **≈6,3%–6,6% → R$63.000–66.000 ≈ US$12.600–13.200/año**
- Costo del Fator R: pro-labore R$280.000/año → INSS topeado R$11.188 + **IRPF de hasta 27,5% sobre R$280.000 (≈R$60.000–70.000)**. A esta escala el IRPF del pro-labore se come casi todo el ahorro de pasar del Anexo V (≈20,5% nominal) al Anexo III.
- Más 10% de IRRF si la plata sale

**Comparación honesta:** el Simples con exportación (3,8%–6,5%) es claramente mejor que el Lucro Presumido (7,7%–8,5%) **a nivel corporativo**, pero exige (a) una dueña domiciliada en Brasil y (b) pagar 28% de la facturación como sueldo real en Brasil, con su IRPF. Y en los dos casos, el 10% de dividendos al salir es el mismo.

---

### LO QUE NO SE PUEDE CALCULAR TODAVÍA
- **El impuesto del lado de quien recibe** (Paraguay si la dueña está allá, Argentina cuando llega a vos): es otra línea de la investigación, no la mía. Lo que sí sé: con Paraguay no hay tratado con Brasil, así que no hay crédito por el 10% retenido.
- **El costo si el fisco brasileño no acepta que lo cobrado por Stripe es "ingreso de divisas"**: ahí se caen PIS/COFINS 0% e ISS 0%, y la carga pasaría de ~8,5% a ~13%–16% sobre facturación (PIS/COFINS cumulativo 3,65% + ISS 2%–5%). No se puede estimar sin la opinión del contador.

**Riesgos**

**1. La estructura entera depende de una persona que viva en Brasil, y no la tenés.** Tres cosas distintas la exigen: el Simples Nacional (titular/socio no domiciliado afuera — LC 123 art. 17, II), el representante legal de la cuenta Stripe (*"must be resident in Brazil"*) y el procurador ante la Receita y el Banco Central. Tu hermana vive en Paraguay. Si la solución propuesta es "poner que está domiciliada en Brasil", eso es simular residencia: es la línea donde la elusión se vuelve evasión, y por la regla 1 esta ruta se descarta ahí mismo, no se "optimiza".

**2. La línea roja de la titularidad.** Si la empresa, el CNPJ, la cuenta bancaria y la cuenta de Stripe están a nombre de tu hermana pero el negocio lo manejás, lo cobrás y lo decidís vos, eso es interposición de persona: simulación, no planificación. No es un riesgo de multa, es un riesgo de tipo penal en los dos países, y además destruye el ahorro (ver punto 8). Si ella es dueña de verdad, entonces la plata es legalmente de ella y vos cobrás de ella por algo real (sueldo, servicios, dividendos de tu parte societaria declarada) — con el impuesto que corresponda. No hay una tercera opción.

**3. El "ingreso de divisas" cobrando por Stripe Brasil: el punto más frágil de todos.** La exención de PIS/COFINS y la segregación de exportación del Simples exigen que el pago represente ingreso de divisas. La Receita lo flexibilizó: la SC Cosit 179/2025 (16/9/2025) admite que el ingreso sea en reales o en moneda extranjera, antes, durante o después de la prestación, "observadas las normas cambiarias", y la SC Cosit 160/2024 admitió el pago desde una cuenta en reales del tomador extranjero. **Pero ninguna fuente confirma que una cobranza por adquirencia local de Stripe Brasil, liquidada en BRL a una cuenta del CNPJ, califique.** Las soluciones de consulta sólo vinculan a quien las pidió. Si no califica: se cae ISS 0% y PIS/COFINS 0%, y pasás de ~8,5% a ~13–16% sobre facturación, retroactivo.

**4. El ISS de exportación depende del municipio y del humor del fisco local.** La LC 116/2003 art. 2º, I excluye la exportación, pero exceptúa el servicio desarrollado en Brasil "cuyo resultado acá se verifique". El fisco de São Paulo, por el Parecer Normativo SF 2/2016 (una fuente posterior menciona el SF 4/2016 como versión vigente, no lo pude confirmar), entiende que el "resultado" es la ejecución de la actividad en Brasil, **sin importar dónde se usa el beneficio** — criterio que, aplicado a un SaaS, te deja ISS de 2% a 5%. Hay jurisprudencia del TJSP en contra en algunos casos, y el tema sigue abierto. **Elegir el municipio de la sede no es un detalle administrativo: es una decisión fiscal.**

**5. El 10% sobre dividendos es nuevo y está en discusión.** La Lei 15.270/2025 es de noviembre de 2025, con efectos 2026, y ya hay doctrina sosteniendo que la retención sobre socios residentes en el exterior tiene problemas constitucionales. El tratado con Argentina no la baja (su límite es 10%/15%). Puede cambiar en cualquier dirección: puede caer, o la Receita puede reglamentarla más duro.

**6. Lo que ya cambió en 2026 muestra la velocidad del terreno.** En un año: la LC 214/2025 amplió la prohibición del Simples al "titular"; la LC 224/2025 subió 10% la presunción del Lucro Presumido arriba de R$5M (IRPJ desde enero, CSLL desde abril, y judicializada: hay ADIs y la SC Cosit 6/2026 entró al debate); el IOF de salida pasó de 0,38% a 3,5% por decreto, el Congreso intentó tumbarlo y el STF lo restableció por cautelar el 16/7/2025 — **sigue siendo una medida cautelar, no una decisión final**. Cualquier número de esta investigación tiene fecha, no es un dato estable.

**7. 2027 rompe el cálculo.** La CBS empieza a cobrarse en enero de 2027 y PIS/COFINS se extinguen; el Simples entra al nuevo régimen en 2027 y las tablas cambian de composición. El descuento por exportar (que hoy sale de restar PIS/COFINS/ISS de la alícuota) se recalcula de cero. Si armás esto, agendá la revisión para el segundo semestre de 2026.

**8. El lado argentino puede anular todo el ahorro.** Si vos sos el dueño real y residís en Argentina, el régimen de transparencia fiscal internacional (art. 130 de la Ley de Impuesto a las Ganancias) puede atribuirte la renta de la sociedad del exterior directamente en tu cabeza — entre otros requisitos, cuando el impuesto pagado afuera es menor al 75% del que correspondería en Argentina, o cuando la entidad no tiene medios materiales y personales para su actividad. Una sociedad brasileña sin oficina, sin empleados y sin operación real en Brasil encaja justo en ese segundo supuesto. La reglamentación se modificó por el Decreto 398/2026 (BO 28/5/2026) y no pude leer qué cambió del art. 130. **Esto lo tiene que mirar un contador argentino, no uno brasileño.**

**9. Riesgos operativos de caja, que no son fiscales pero cortan el negocio.** Stripe verifica que el CNPJ esté activo en la Receita y puede restringir o limitar la cuenta si está suspenso o pendiente de regularización; los payouts se pausan si falta el CPF del representante. Tenés un solo CNPJ, un solo banco brasileño y una sola cuenta Stripe: cualquier traba de verificación te deja sin cobranza y sin retiro al mismo tiempo. Y el Pix de Stripe es "invite only", así que no lo cuentes como disponible.

**10. Una obligación silenciosa con multa.** El SCE-IED del Banco Central es responsabilidad de la empresa brasileña, no del inversor: eventos en 30 días y declaración anual. Multas citadas: 1% del valor (tope R$25.000) por fuera de plazo y 10% (tope R$250.000) por información falsa. Es el tipo de trámite que un contador barato no hace y nadie nota hasta la fiscalización.

**Lo que no se encontró**

**1. El texto del art. 17, II de la LC 123/2006 en fuente oficial.** El sitio del Planalto me cortó la conexión (dos intentos, 24/10/2026). La redacción que cito (*"cujo titular ou sócio seja domiciliado no exterior"*) viene de un repositorio de legislación y de comentarios que la atribuyen a la LC 214/2025 con efectos desde el 1/1/2025. Una página de Jusbrasil muestra el inciso como "revogado", lo que contradice todo lo demás (probablemente versión vieja). **Este es el dato que decide la ruta: hay que verificarlo en el Planalto antes de mover un peso.**

**2. El plazo real para abrir un CNPJ con socio no residente.** Ninguna fuente da días hábiles. Hay pasos previos que no se pueden saltear (CPF del socio extranjero, pasaporte con traducción jurada, poder al procurador, registro en la Junta Comercial, SCE-IED), así que no es cuestión de días como Stripe Atlas, pero no tengo el número y no lo voy a estimar.

**3. Si un no residente puede ser administrador.** Fuentes directamente contradictorias: unas dicen que no puede (sólo integrar el consejo de administración), otras que la Lei 14.195/2021 lo permite. Importa porque define si tu hermana puede firmar por la empresa desde Paraguay o si hace falta un tercero en Brasil.

**4. La lista oficial de monedas de presentación para una cuenta Stripe Brasil, y si el payout es sólo en BRL.** El soporte oficial confirma que la **cuenta bancaria** debe ser brasileña, en BRL y del mismo CNPJ, y la página de precios dice que el +2% de tarjeta internacional se aplica "sobre el monto ya convertido a moneda local" (lo que sugiere cobro en BRL). Un blog de terceros (Picnic, julio 2026) afirma que la cuenta brasileña sólo hace payout en reales, pero no cita la página. **No encontré la confirmación oficial de si podés cobrar en USD o EUR desde una cuenta brasileña.** Es una pregunta para el soporte de Stripe, y la respuesta cambia el precio que le mostrás a un cliente español.

**5. La confirmación de que cobrar por Stripe Brasil califica como "ingreso de divisas" de exportación.** Busqué específicamente y no hay nada: ni de la Receita, ni de Stripe, ni de un estudio. Es el punto que decide si la carga es 8,5% o 16%.

**6. El reparto exacto por franja del Anexo III en la tabla oficial de 2026.** Confirmé la 1ª franja (IRPJ 4,00 / CSLL 3,50 / COFINS 12,82 / PIS 2,78 / CPP 43,40 / ISS 33,50) y de ahí sale la quita del 49,1%. Para las franjas 2ª y 4ª (las que te tocan) las fuentes se contradicen — un blog pone el ISS de la 2ª franja en 32,00% y la suma no da 100%. **Los efectivos del Simples que calculé son aproximados por eso, y los marqué como tales.**

**7. La alícuota exacta de dividendos del tratado Brasil–Argentina.** Las fuentes dicen "10% o 15% según el caso" sin detallar el requisito de participación. No cambia la conclusión (el 10% de la ley nueva entra en el límite), pero sí importa para el crédito argentino.

**8. Qué cambió el Decreto 398/2026 en el régimen de transparencia fiscal internacional argentino.** Confirmé que existe y que modificó la reglamentación de Ganancias (BO 28/5/2026), pero los extractos disponibles no muestran el impacto sobre el art. 130.

**9. Qué pasa en Paraguay cuando tu hermana recibe el dividendo brasileño.** No es mi línea de investigación, pero lo anoto porque la cadena no cierra sin eso: Brasil retiene 10% sin tratado que lo alivie, y falta saber qué cobra Paraguay encima.

**Para el contador**

**1. ¿La ruta Brasil existe o no, con mi hermana domiciliada en Paraguay?**
Textual para preguntar: *"Mi hermana tiene residencia fiscal paraguaya y residencia brasileña, pero vive en Paraguay. Si ella es la titular única de una LTDA brasileña, ¿el art. 17, inciso II de la LC 123/2006 (redacción de la LC 214/2025: 'cujo titular ou sócio seja domiciliado no exterior') nos deja fuera del Simples Nacional? ¿El criterio es domicilio real o residencia fiscal formal? Y si quedamos fuera, ¿Lucro Presumido con 32% de presunción es lo mejor para una empresa 100% exportadora de SaaS, o hay otra opción?"*
Esta pregunta va primera porque si la respuesta es "quedan fuera del Simples", Brasil deja de tener la ventaja que lo hacía atractivo y la comparación con Paraguay y con la LLC se rehace de cero.

**2. ¿Cobrar por Stripe Brasil cuenta como exportación con ingreso de divisas?**
Textual: *"Vamos a cobrar suscripciones de clientes de LatAm y España con tarjeta, a través de Stripe Brasil, que liquida en reales a una cuenta brasileña del CNPJ. ¿Eso cumple el requisito de 'ingreso de divisas' de la Lei 10.637/2002 art. 5º, II y la Lei 10.833/2003 art. 6º, II, a la luz de las Soluciones de Consulta Cosit 179/2025 y 160/2024? ¿Y el requisito de la segregación de exportación del art. 25 §3º de la Resolución CGSN 140/2018? ¿Qué documentación tengo que conservar por operación para probarlo en una fiscalización? ¿Conviene cobrar por otra vía para que el ingreso sea inequívocamente cambiario?"*

**3. ¿En qué municipio domiciliamos la empresa, por el ISS?**
Textual: *"Un SaaS desarrollado desde afuera de Brasil y vendido a clientes de afuera de Brasil: ¿dónde se verifica el 'resultado' para el art. 2º, I de la LC 116/2003? Sé que el fisco de São Paulo, por el Parecer Normativo SF 2/2016, considera que el resultado está donde se ejecuta la actividad, sin importar dónde se usa el beneficio. ¿Qué municipio tiene un criterio más claro de no incidencia para exportación de software, y hay algún acto normativo municipal que lo diga por escrito?"*

**4. ¿Cuánto queda cuando la plata llega a Argentina, y qué declaro yo?**
Textual: *"Con el IRRF del 10% de la Lei 15.270/2025 sobre dividendos remitidos al exterior, sin tratado Brasil–Paraguay, y con el tratado Brasil–Argentina (Decreto 9.482/2018) si el socio soy yo: ¿cuál es la carga total puerta a puerta en cada variante? Y la pregunta que necesito que me contestes con honestidad: si la empresa está a nombre de mi hermana pero el negocio lo manejo yo, ¿qué expone eso en Brasil y en Argentina — simulación, interposición de persona, transparencia fiscal internacional del art. 130 de la LIG? ¿Cuál es la versión de esta estructura que es defendible si me fiscalizan, y cuánto cuesta esa versión?"*

**Nota para llevar:** preguntá esto a dos profesionales distintos — uno brasileño para los puntos 1 a 3 y uno argentino para el punto 4. El contador brasileño no va a ver el riesgo argentino y el argentino no va a conocer la Resolución CGSN. La mitad de los errores en estas estructuras pasan en la juntura entre los dos países, que es justo donde nadie es responsable.


---

## La LLC de Estados Unidos: resuelve el cobro, no resuelve el impuesto argentino (medido al 24/10/2026)

**Lo medido**

ACLARACIÓN PRIMERO: no soy contador ni abogado. Esto es un relevamiento de hechos públicos, con fuente y fecha, para que llegues a tu contador con las opciones sobre la mesa. No es un consejo profesional.

LA CONCLUSIÓN, ADELANTADA
La LLC te sirve para COBRAR (Stripe, dólares, no pesificar). Para PAGAR MENOS IMPUESTO EN ARGENTINA no te sirve: la ley argentina mira a través de la LLC y te atribuye su ganancia a vos, la retires o no. El ahorro que te van a vender en Instagram no sale de la LLC, sale de no declararla. Eso no es elusión, es evasión.

1) POR QUÉ ARGENTINA MIRA A TRAVÉS DE LA LLC
El art. 130 de la Ley de Impuesto a las Ganancias (texto ordenado 2019, Decreto 824/2019, leído en InfoLEG el 24/10/2026) tiene dos incisos que te tocan:
- Inciso e): las ganancias de un residente argentino obtenidas por su participación en sociedades u otros entes del exterior que NO son sujetos del impuesto en su jurisdicción se imputan a los socios o titulares residentes, en proporción a su participación. Una LLC de un solo miembro es exactamente eso: para el IRS es un "disregarded entity", no paga impuesto propio. Cae acá, y este inciso NO tiene condiciones que cumplir ni esquivar.
- Inciso f): el régimen de transparencia más conocido, que pide cuatro requisitos concurrentes (control ≥50%, rentas pasivas o falta de medios materiales y personales, y tributación efectiva menor al 75% del impuesto societario argentino). Este es el que discuten los blogs. En tu caso ni hace falta llegar a discutirlo: el inc. e) te alcanza primero.
Consecuencia práctica, y es la decisiva: la LLC no te da NINGÚN diferimiento. El año que la LLC gana plata, esa ganancia es tuya en tu declaración argentina, aunque la dejes quieta en Mercury o en Wise. Cero deferral.
Y el crédito por impuesto análogo (AFIP/ARCA, "Conceptos básicos" de Ganancias) no te salva, porque solo descontás lo que efectivamente pagaste afuera: si la LLC paga US$0 en EE.UU., no hay nada que descontar. Pagás el 35% argentino completo.
No hay convenio para evitar la doble imposición vigente entre Argentina y EE.UU., así que tampoco hay tasa reducida por tratado.

2) QUÉ ESTADO, Y CUÁNTO SALE (precios leídos el 24/10/2026)
- Delaware: constitución ~US$110. El impuesto anual de la LLC es US$400, no US$300: lo dice el propio Código de Delaware, 6 Del. C. § 18-1107(b), que leí hoy. Subió de 300 a 400 por la House Bill 400, firmada el 21/05/2026 con efecto retroactivo al 01/01/2026 (Wolters Kluwer, "2026 Delaware Entity Law Updates"; Withum). Como se paga en forma vencida, el pago del 01/06/2026 todavía fue de US$300 y el primer pago de US$400 cae el 01/06/2027. Vence el 1 de junio; si te pasás, US$200 de multa (§ 18-1107(e)) más 1,5% de interés mensual (§ 18-1107(c)) y pérdida del "good standing".
- Wyoming: ~US$100 de constitución y un mínimo de US$60 al año de informe anual (puede ser más si tenés bienes en Wyoming, que no es tu caso).
- New Mexico: ~US$50 de constitución y CERO informe anual, cero costo recurrente estatal. Es el más barato.
- Los tres: ninguno le cobra impuesto estatal a la renta a un no residente que opera desde afuera sin actividad en el estado.
- Qué conviene: Delaware NO te conviene a vos. Sus ventajas reales (Chancery Court, la DGCL, lo que piden los fondos de inversión) son para una empresa que levanta capital. Para un SaaS de un dueño, Delaware es la opción más cara y la menos discreta. Wyoming es el equilibrio (barato, aceptado por bancos y procesadores, privado). New Mexico es el más barato y el más anónimo, pero su reputación con bancos y pasarelas es peor; eso lo leí en comparadores comerciales y NO lo pude verificar con fuente neutral.
- Stripe Atlas: US$500 una sola vez, incluye las tasas estatales y el primer año de agente registrado, y el EIN sin SSN. Después el agente registrado renueva a US$100 al año. Lo leí hoy en stripe.com/atlas. Ojo con esto: Atlas SOLO constituye en Delaware. Si querés Wyoming o New Mexico, Atlas no es el camino.

3) LA SITUACIÓN FISCAL EN EE.UU. DE UNA LLC UNIPERSONAL DE NO RESIDENTE
Cuándo NO paga impuesto federal: cuando no está "engaged in a trade or business in the US" (ETBUS) y no tiene renta de fuente estadounidense efectivamente conectada. El ingreso por servicios se ubica donde se presta el servicio: si vos desarrollás y operás MaKo desde Argentina, sin oficina ni empleados ni agente dependiente en EE.UU., la renta es de fuente extranjera y no paga impuesto federal. Dos matices reales: (a) si trabajás días desde territorio estadounidense, esa porción cambia de signo; (b) la fuente de una suscripción de software (servicio vs. regalía vs. venta de licencia) es terreno discutido, y tus clientes son LatAm y España, así que casi nada sería de fuente estadounidense de todos modos. Esto lo armé con fuentes secundarias (GW Carter, James Baker CPA, Steptoe) porque no encontré una guía del IRS que lo diga en una sola línea.
Lo que sí tiene que presentar IGUAL, aunque no deba un dólar de impuesto (esto sí es fuente primaria: Instructions for Form 5472, revisión 12/2024, irs.gov, leídas hoy):
- Form 5472 adjunto a un Form 1120 "pro forma". Del 1120 solo se llenan nombre, domicilio y los ítems B y E de la página 1. Se usa la Parte V del 5472.
- Qué se informa: las transacciones con partes vinculadas, y en la Parte V todo lo relacionado con la formación, disolución, adquisición o disposición de la entidad, incluidos LOS APORTES DE CAPITAL Y LAS DISTRIBUCIONES. O sea: cada vez que sacás plata de la LLC, se informa.
- Vencimiento: el del 1120 pro forma, 15 de abril, prorrogable al 15 de octubre con el Form 7004 (presentado antes del 15/4, con "Foreign-owned U.S. DE" escrito arriba).
- Cómo se presenta: NO se puede electrónicamente. Fax al 855-887-7737 (300 DPI o más) o correo a Internal Revenue Service, 1973 Rulon White Blvd, M/S 6112, Attn: PIN Unit, Ogden, UT 84201. Con "Foreign-owned U.S. DE" cruzado arriba del 1120. Y no a las direcciones normales del 1120.
- QUÉ PASA SI NO LO PRESENTÁS: US$25.000 de multa inicial. Si el incumplimiento sigue más de 90 días después de que el IRS te notifica, se agregan US$25.000 MÁS por cada período de 30 días (o fracción), por cada parte vinculada, SIN TOPE. Y además pueden aplicar penas criminales de las secciones 7203, 7206 y 7207. Un formulario olvidado cuesta más que varios años de facturación del plan de US$47.
- Form 1040-NR: solo si hay renta de fuente estadounidense efectivamente conectada. Si no hay, no va.
- W-8BEN / W-8BEN-E: NO es una declaración que se presente al IRS. Es un certificado que le entregás al pagador (Stripe, un cliente estadounidense) para que te trate como no residente y no te retenga el 30%. Al no haber tratado Argentina–EE.UU., no hay tasa reducida que invocar.
- BOI / FinCEN (Corporate Transparency Act): la regla final del 11/08/2026, vigente desde el 14/08/2026, exime a las empresas constituidas en EE.UU. Una LLC de Delaware o Wyoming es una empresa estadounidense, así que queda exenta (fincen.gov/boi, leído hoy; la página no trata expresamente el caso del dueño extranjero de una LLC doméstica).
- Costo de cumplimiento: la preparación del 5472 + 1120 pro forma ronda US$150–400 con un CPA; los paquetes de los proveedores van de US$399 a US$899 al año. Son precios de sitios comerciales, no de un relevamiento neutral.

4) EL DUEÑO: ¿VOS O TU HERMANA?
Si el titular sos vos: art. 130 inc. e), la ganancia es tuya, 35% marginal en Argentina. Fin.
Si la titular es tu hermana, cambia todo, y no para mejor:
- Paraguay (donde vive): la Ley 6380/2019 es territorial, es renta de fuente paraguaya la que viene de actividades desarrolladas en el país, bienes situados ahí o derechos usados económicamente ahí (texto en el portal de la DNIT). Los dividendos del exterior figuran como ingresos no gravados de fuente extranjera. Pero hay un detalle que te importa: si el servicio se presta DESDE territorio paraguayo, aun a clientes extranjeros, la autoridad puede tratarlo como fuente paraguaya. Y en tu caso el servicio no se presta desde Paraguay: se presta desde tu escritorio en Argentina.
- Brasil (donde también es residente): esto es lo más importante y es NUEVO. La Solución de Consulta COSIT nº 56, del 09/04/2026, concluyó que una LLC estadual cuya participación está compuesta por no residentes en EE.UU. y que es tratada como transparente por la ley fiscal estadounidense ES un "régimen fiscal privilegiado" en los términos del inciso VII del art. 2 de la Instrucción Normativa RFB 1.037/2010. Y el régimen fiscal privilegiado es justo el gatillo de la Ley 14.754/2023 ("Lei das Offshores", vigente desde el 01/01/2024), que grava los lucros de la controlada al 15% ANUAL, distribuidos o no. Traducido: si tu hermana es residente fiscal brasileña, poner la LLC a su nombre no es un refugio, es un gatillo. Lo leí en Mariz Advogados, APET, reformatributaria.com y una copia del documento; NO pude abrir la Solución de Consulta en el sitio oficial de la Receita, así que esto hay que confirmarlo.
- Y el problema de fondo, que no es fiscal: si ella es la dueña de verdad, la plata es de ella y tiene que pagarte a vos por tu trabajo. Entonces tu ingreso vuelve a ser renta argentina por servicios, gravada acá igual, más una discusión de precios de transferencia entre partes vinculadas. Si no es la dueña de verdad y vos controlás la plata, es una simulación: eso ya no es elusión. Y hay un agravante concreto en EE.UU.: el Form 5472 identifica al "25% foreign shareholder". Poner a tu hermana ahí mientras vos controlás la cuenta es presentar una declaración falsa, con las secciones 7206 y 7207 que las propias instrucciones del formulario citan.

5) EL INTERCAMBIO DE INFORMACIÓN EE.UU.–ARGENTINA: EL DATO QUE TE VAN A VENDER MAL
Los hechos: el acuerdo FATCA es un IGA Modelo 1 recíproco, firmado el 05/12/2022, vigente desde el 01/01/2023, implementado acá con la RG AFIP 5303/2022. El primer intercambio fue en septiembre de 2024 con datos del ejercicio 2023; el segundo en septiembre de 2025 con datos de 2024.
Qué manda EE.UU. (memorándum de Mercojuris sobre el texto del IGA, 12/12/2022, y nota de Diario de Cuyo del 03/10/2026): identificación del titular, identificación de la institución financiera, monto bruto de intereses, dividendos y otras rentas de fuente estadounidense. En cuentas de depósito, solo si el titular es una persona humana residente en Argentina y los intereses pagados superan los US$10 en el año. En otras cuentas, titulares residentes en Argentina, incluidas "entidades que certifiquen residencia fiscal en Argentina".
Qué NO manda: saldos, el detalle de movimientos, la composición de la cartera. Y el texto no compromete a EE.UU. a mirar a través de una entidad para encontrar al beneficiario final argentino.
Lectura honesta: hoy una LLC de Delaware con cuenta en un banco estadounidense difícilmente aparezca sola en el reporte automático a ARCA, porque la LLC certifica residencia fiscal estadounidense, no argentina. Pero eso es un AGUJERO EN UN CANAL AUTOMÁTICO, no una exención legal. Y acá tengo que ser durísimo con vos, porque es el punto exacto de tu pregunta:
- La obligación de declarar existe igual. El agujero no la borra.
- Existe el intercambio A PEDIDO, que es otro canal: ARCA le puede preguntar al IRS por un contribuyente concreto. El agujero del automático no te cubre de una pregunta dirigida.
- El agujero se está cerrando: el propio IGA dice que EE.UU. se compromete a igualar la información que transmite con la que recibe, y la dirección de los últimos años (CRS 2.0, criptos, billeteras) es de una sola mano.
- La plata deja rastro cuando llega: transferencia a un banco argentino, un exchange, gasto con tarjeta, Payoneer o Wise con tu CUIT. Todo eso se informa localmente.
- Y lo definitivo: una estructura cuyo beneficio fiscal depende de que ARCA no se entere NO es elusión. La elusión es usar una forma legal declarada y que el fisco la acepte. Lo tuyo, si la LLC no se declara, es evasión, con consecuencias penales. No encontré con fuente confiable los montos actualizados del Régimen Penal Tributario, así que no te doy un número, pero el carácter penal no está en duda.

**Cuánto cuesta**

SUPUESTOS, porque sin ellos el número es humo: (a) Ganancias se paga sobre la GANANCIA NETA, no sobre la facturación, así que asumo 25% de costos deducibles (infraestructura, IA, comisiones de pasarela, servicios); (b) tipo de cambio supuesto 1.400 ARS/USD, que NO pude verificar hoy; (c) escala anual del art. 94 del período fiscal 2025 (la de 2026 no la encontré; se actualiza por IPC, así que el impuesto real será algo menor al que calculo); (d) usás la LLC declarada, como corresponde.

PARTE 1 — COSTO FIJO DE LA ESTRUCTURA, igual facture 50 o 200 mil
Alta (una sola vez):
- Vía Stripe Atlas, Delaware: US$500 (incluye tasas estatales y primer año de agente registrado).
- Por tu cuenta: Delaware ~US$110 / Wyoming ~US$100 / New Mexico ~US$50, más agente registrado US$50–150.
Recurrente, por año:
- Delaware: US$400 de impuesto anual (desde el ejercicio 2026, pagadero el 01/06/2027) + US$100 de agente registrado + US$150–400 del Form 5472 y 1120 pro forma = US$650–900 al año.
- Wyoming: US$60 + US$100 + US$150–400 = US$310–560 al año.
- New Mexico: US$0 + US$100 + US$150–400 = US$250–500 al año.
Impuesto federal estadounidense: US$0, si no hay ETBUS ni renta de fuente estadounidense. Cero de IMPUESTO no es cero de PRESENTACIÓN: el 5472 va igual, todos los años, siempre.

PARTE 2 — EL IMPUESTO ARGENTINO, que es el número grande
Sobre facturación de US$50.000 → neto US$37.500 ≈ ARS 52.500.000. Con la escala anual 2025 eso cae justo en el borde del último tramo. Impuesto estimado: ARS 12,6–13,6 millones, o sea US$9.000–9.700. Efectivo sobre la ganancia: ~24–26%. Sobre la facturación: ~18–19%.
Sobre facturación de US$200.000 → neto US$150.000 ≈ ARS 210.000.000. Impuesto estimado: ARS 67–68 millones, o sea US$48.000–48.500. Efectivo sobre la ganancia: ~32%. Sobre la facturación: ~24%.
Bienes Personales, sobre tu participación en la LLC al 31/12: CERO mientras todo tu patrimonio (casa, auto, la LLC, lo que tengas) no pase el mínimo no imponible de ARS 384.728.044,57 del período 2025, que son unos US$275.000 al tipo de cambio supuesto. Pasado eso, 0,50% / 0,75% / 1,00% sobre el excedente según el tramo. Dato que importa: si dejás la plata ACUMULADA dentro de la LLC, el patrimonio de la LLC crece y en dos años de facturar US$200.000 cruzás el mínimo y empezás a pagar Bienes Personales todos los años por no haber sacado la plata.

PARTE 3 — EL TOTAL
Facturando US$50.000: US$9.000–9.700 de Ganancias + US$650–900 de estructura ≈ US$9.650–10.600 al año. Entre el 19% y el 21% de la facturación.
Facturando US$200.000: US$48.000–48.500 de Ganancias + US$650–900 de estructura ≈ US$48.650–49.400 al año. Alrededor del 25% de la facturación.

PARTE 4 — EL NÚMERO QUE DE VERDAD IMPORTA
El impuesto argentino en esos dos escenarios es EL MISMO con LLC y sin LLC, porque el art. 130 inc. e) te atribuye la ganancia igual. Lo único que la LLC cambia en tu bolsillo es que SUMA US$650–900 al año de costo, más el riesgo de la multa de US$25.000. Dicho al revés: la LLC te cuesta plata y te resuelve el cobro con Stripe. Es una decisión operativa, no fiscal. Si alguien te la vende como ahorro impositivo, el ahorro que tiene en la cabeza es no declararla.
Lo que falta para decidir de verdad: el número comparado contra facturar como exportación de servicios desde Argentina (monotributo o responsable inscripto, con IVA a tasa cero por exportación). Esa comparación no la pude hacer con rigor acá porque depende de tu categoría actual, de tus deducciones reales y del régimen cambiario vigente. Es la primera cuenta que tiene que hacer tu contador, y la única que puede cambiar la respuesta.

**Riesgos**

1) EL RIESGO PRINCIPAL ES QUE LA LLC NO HACE LO QUE CREÉS. Si la armás esperando pagar menos impuesto en Argentina, el art. 130 inc. e) te deja en el mismo lugar: 35% marginal sobre la ganancia de la LLC, el año que se devenga, la retires o no. Lo único que agregás es US$650–900 al año de costo y dos jurisdicciones de cumplimiento. El beneficio real de la LLC es operativo (Stripe, dólares, no pesificar), y vale la pena por eso, pero no por el impuesto.

2) LA MULTA DE US$25.000 NO TIENE TOPE. Es por año y por formulario, y después de los 90 días de la notificación del IRS se suman US$25.000 por cada 30 días. Un año que te olvides el 5472 te cuesta más que todo lo que facturaste. Este es el riesgo asimétrico más grande de toda la estructura: el costo de cumplir son US$150–400 y el de no cumplir arranca en US$25.000.

3) EL COSTO ESTATAL NO ES ESTABLE. Delaware subió el impuesto anual de LLC un 33% (300 a 400) con una ley firmada el 21/05/2026 y efecto retroactivo al 01/01/2026. Cualquier cálculo a 5 años con las tarifas de hoy es un cálculo frágil.

4) LA VARIANTE "A NOMBRE DE MI HERMANA" ES LA MÁS FRÁGIL DE TODAS. Si ella es residente fiscal brasileña, la COSIT 56/2026 (del 09/04/2026, o sea de hace seis meses) encuadra exactamente a una LLC transparente de no residentes como régimen fiscal privilegiado, y la Ley 14.754/2023 le cobra 15% anual sobre los lucros sin distribuir. Y si es solo titular de papel mientras vos manejás la plata, es simulación, no elusión, y además el Form 5472 queda mal declarado (secciones 7206 y 7207 de las instrucciones).

5) EL AGUJERO DEL INTERCAMBIO AUTOMÁTICO ES UN HECHO DE HOY, NO UN DERECHO. Depende de que EE.UU. no mire a través de la entidad, de que no haya pedido puntual, de que la plata no toque nunca Argentina y de que el IGA no se endurezca. Cuatro cosas que no controlás. Una estructura que funciona solo mientras cuatro cosas ajenas no cambien no es planificación, es apuesta.

6) LA FUENTE DE LA RENTA DE UN SaaS ES TERRENO DISCUTIDO. "Suscripción de software" puede leerse como servicio, como regalía o como licencia, y cada lectura la ubica en un lugar distinto. A vos te salva que tus clientes son LatAm y España. Si mañana el 40% de tus clientes son estadounidenses, esta parte hay que volver a mirarla.

7) SI ALGÚN DÍA QUERÉS VENDER MaKo O TOMAR INVERSIÓN, una LLC con titularidad de un familiar, sin acuerdo escrito y sin rastro de quién aportó qué, es un problema en la due diligence. Vale más la estructura prolija y declarada que el ahorro de un año.

8) DEPENDENCIA DE UN PROVEEDOR. Stripe Atlas solo constituye en Delaware, el estado más caro de los tres. Si después querés moverte a Wyoming, es redomiciliar o constituir de nuevo.

**Lo que no se encontró**

- La tabla ANUAL del art. 94 para el período fiscal 2026. Solo encontré la oficial de ARCA de enero–junio 2026 (que es del régimen de retención, acumulada del semestre, con el tramo del 35% arrancando en $60.750.913,96) y la anual oficial del período fiscal 2025 (tramo del 35% desde $53.153.256,52, con cuota fija de $12.837.714,51). Usé la de 2025 para los cálculos y lo digo.
- Una página oficial de ARCA con la escala de Bienes Personales. El mínimo no imponible del período fiscal 2025 ($384.728.044,57) está confirmado en varias fuentes que citan la publicación de ARCA; los tramos (0,50% / 0,75% / 1,00%) los saqué de una fuente secundaria (contadoresenred, 14/01/2026) porque la URL de alícuotas de arca.gob.ar me dio 404. No pude citar el número de la resolución general.
- La cotización oficial del dólar del 24/10/2026. No la encontré con fuente confiable, así que todos los números en dólares de abajo llevan un tipo de cambio supuesto, declarado.
- Un dictamen o antecedente de ARCA que diga expresamente que el art. 130 inc. e) se aplica a una LLC unipersonal estadounidense. La lectura del inciso es clara y es texto primario de InfoLEG, pero no encontré el acto administrativo que lo confirme para este caso puntual. Es justo lo que tiene que responder tu contador.
- La definición reglamentaria de "renta pasiva" aplicada a una suscripción de software, para saber si el inc. f) también te alcanzaría. No importa demasiado porque el inc. e) llega primero, pero quedó sin cerrar.
- El texto oficial de la Solución de Consulta COSIT 56/2026 en el sitio de la Receita Federal. Lo leí en reseñas de estudios brasileños y en una copia en PDF de un tercero.
- Si EE.UU. informa o no, bajo el IGA, las cuentas de entidades cuyo beneficiario final es argentino. El memorándum sobre el texto del acuerdo solo menciona "entidades que certifiquen residencia fiscal en Argentina" y no habla del beneficiario final. Que una LLC estadounidense quede afuera es MI INFERENCIA de ese texto, no un dato confirmado.
- Los montos actualizados del Régimen Penal Tributario (umbrales de evasión simple y agravada). No los doy porque no los pude verificar.
- Un precio de mercado del armado del 5472 que no venga de un proveedor que lo vende.
- La vigencia actual del RICOI (RG 5306/2022, que reemplazó el régimen de planificaciones fiscales de la RG 4838). Confirmé que la 4838 está derogada por el art. 9 de la RG 5306 (B.O. 27/12/2022), pero no encontré nada de 2025 ni 2026 sobre si el RICOI sigue vigente ni si te obliga a informar el armado de la LLC. Preguntalo.

**Para el contador**

1) "Mi LLC de un solo miembro en Estados Unidos es transparente allá (disregarded entity, no es sujeto del impuesto federal). ¿Me cae el artículo 130 inciso e) de la Ley de Ganancias, que atribuye sin condiciones la renta de entes del exterior que no son sujetos del impuesto en su jurisdicción, o vos sostenés que el aplicable es el inciso f) con sus cuatro requisitos? ¿Hay algún dictamen, consulta vinculante o antecedente de ARCA sobre LLC unipersonales estadounidenses que pueda leer? De esta respuesta depende si la LLC me diferiere algo o no me diferiere nada."

2) "Hacéme la cuenta comparada, en pesos y sobre mis números reales: facturar MaKo como exportación de servicios desde Argentina (decime si me conviene monotributo o responsable inscripto) contra facturar por la LLC y declararla acá. Quiero el neto en mi bolsillo en los dos casos, con facturación de US$50.000 y de US$200.000 al año, incluyendo Ganancias, Bienes Personales, IVA, Ingresos Brutos y lo que cueste cumplir. Si el número es parecido, la LLC la armo solo para cobrar con Stripe y listo."

3) "Si la LLC no me distribuye nada y la plata queda en la cuenta en Estados Unidos: ¿tengo que declarar y pagar Ganancias igual por el resultado del año? ¿Y cómo se valúa esa participación en Bienes Personales, al patrimonio neto de la LLC o al costo de lo que aporté? ¿Y qué regímenes de información tengo que cumplir, en particular si el RICOI de la RG 5306/2022 sigue vigente y me obliga a informar el armado de la estructura?"

4) "Si la titular de la LLC es mi hermana, que tiene residencia fiscal paraguaya y además residencia brasileña, pero el software lo desarrollo y lo opero yo desde Argentina y los clientes los traigo yo: ¿cómo lo ve ARCA? ¿Hay riesgo de que lo traten como simulación, o de que me imputen un establecimiento permanente, o de que me recalifiquen la renta como mía igual? ¿Y qué le tendría que facturar yo a ella, a precio de mercado entre partes vinculadas, para que la estructura se sostenga? Decime también si te consta la Solución de Consulta COSIT 56/2026 de Brasil, que encuadra a las LLC transparentes de no residentes como régimen fiscal privilegiado y les cobra 15% anual."


---

## Qué pasarela acepta a Martín según la estructura: la matriz país-por-país y cuánto se queda cada una por cada US$100

**Lo medido**

ACLARACIÓN PREVIA, Y NO ES DE FORMA: no soy contador ni abogado. Esto es un relevamiento de precios y condiciones públicas, leído hoy 24/10/2026 en las páginas de cada proveedor, para que Martín llegue al contador con las opciones medidas. No es un consejo profesional.

=====================================================================
1) LO CENTRAL: QUIÉN TE ACEPTA COMO VENDEDOR
=====================================================================
(«Vendedor» = la persona o empresa que abre la cuenta y recibe la plata.)

Pasarela         | Argentina | Paraguay | Brasil | LLC de EE.UU.
-----------------|-----------|----------|--------|---------------
Stripe directo   |    NO     |    NO    |   SÍ   |      SÍ
Stripe Managed P.|    NO     |    NO    |   NO   |      SÍ
Mercado Pago     |    SÍ     |    NO    |   SÍ   |      NO
dLocal Go        |    SÍ     |    SÍ    |   SÍ   |      SÍ
Paddle           |    SÍ     |    SÍ    |   SÍ   |      SÍ
Lemon Squeezy    |    SÍ     |    SÍ    |  NO*   |      SÍ
Polar            |    SÍ     |    SÍ    |  NO*   |      SÍ
Dodo Payments    |    SÍ     |    SÍ    |   SÍ   |      SÍ
Creem            |    SÍ     |    NO    |   SÍ   |      SÍ

* Brasil no está en la lista de países a los que giran plata (Lemon Squeezy sólo por PayPal; Polar no lo lista).

El detalle, con fuente:
- Stripe: stripe.com/global (leído 24/10/2026) lista 51 países. De Latinoamérica SÓLO Brasil y México. Argentina y Paraguay no están. Confirma lo que ya medimos.
- Stripe Managed Payments (el producto «merchant of record» de Stripe, es decir Stripe se pone como vendedor legal y se ocupa del IVA de cada país): docs.stripe.com/payments/managed-payments/eligibility (leído 24/10/2026) lista como países habilitados para el NEGOCIO: Canadá, EE.UU., 31 países de Europa, y Australia, Hong Kong, Japón y Singapur. BRASIL NO ESTÁ. O sea: la opción «cuenta de Stripe en Brasil con tu hermana» NO te da el merchant of record de Stripe. Para eso hace falta una LLC de EE.UU. (o entidad en Europa/Canadá/APAC).
- Mercado Pago: la documentación oficial para desarrolladores (mercadopago.com.ar/developers, leída 24/10/2026) cubre 7 países: Argentina, Brasil, Chile, Colombia, México, Perú, Uruguay. Paraguay NO está. España NO está. Las suscripciones recurrentes existen (endpoints /preapproval_plan y /preapproval).
- dLocal Go: el centro de ayuda oficial (helpcenter.dlocalgo.com, artículo 7240022, leído 24/10/2026) dice que la empresa tiene que estar registrada en al menos uno de: Argentina, Bolivia, Brasil, Chile, Colombia, Costa Rica, Ecuador, Estados Unidos, Guatemala, México, Perú, Paraguay, Uruguay, Indonesia, Kenia, Nigeria, Malasia. Es la ÚNICA que acepta las cuatro estructuras y además cobra con métodos locales latinoamericanos.
- Paddle: paddle.com/help (leído 24/10/2026) no publica lista de países permitidos, publica la de PROHIBIDOS: Afganistán, Bielorrusia, Birmania, Cuba, Corea del Norte, Haití, Irán, Irak, Libia, Mali, Nicaragua, Rusia, Siria, Somalia, Sudán, Sudán del Sur, Venezuela, Yemen, Zimbabue y las regiones ocupadas de Ucrania. Argentina, Paraguay y Brasil NO están prohibidos.
- Lemon Squeezy: docs.lemonsqueezy.com/help/getting-started/supported-countries (leído 24/10/2026) lista los países con giro bancario. Están Argentina, Paraguay, Uruguay y EE.UU. NO está Brasil. Dice textual que si tu país no está ni en la lista bancaria ni en PayPal, no podés usar el servicio.
- Polar: polar.sh/docs/merchant-of-record/supported-countries (leído 24/10/2026): gira plata a 118 países vía Stripe Connect Express. Están Argentina, Paraguay, Uruguay, EE.UU. NO está Brasil.
- Dodo Payments: docs.dodopayments.com/miscellaneous/accepted-countries-and-territories (leído 24/10/2026): Argentina (#5), Brasil (#22), Paraguay (#120), Uruguay (#170), EE.UU. (#169). Ojo con una letra chica importante: «las cuentas de comercio se habilitan según el país que emitió el documento de identidad usado para verificar», no según dónde está registrada la empresa, y para empresas pide el documento de CADA director y dueño real. Textual: registrar una empresa en un país soportado no alcanza por sí solo.
- Creem: docs.creem.io/merchant-of-record/supported-countries (leído 24/10/2026): 87 países. Están Argentina, Brasil, Uruguay, EE.UU. PARAGUAY NO ESTÁ.

=====================================================================
2) CUÁNTO SE QUEDA CADA UNA POR CADA US$100 COBRADOS
=====================================================================
Calculado para TU caso: suscripción con tarjeta de un cliente de Latinoamérica o España (es decir, tarjeta «internacional» para casi cualquier estructura), incluyendo el recargo por divisa y el costo de sacar la plata. Dos tickets, porque el cargo fijo pesa distinto: US$47 y US$97.

                                  por US$100 (ticket 47) | (ticket 97)
Creem (3,9% + 40¢ + 1% retiro)             $5,75         |   $5,31
Stripe directo con LLC + Stripe Tax Basic  $6,24         |   $5,91   ← pero vos declarás el IVA
Paddle (5% + 50¢)                          $6,06         |   $5,52   (+ hasta 1,5% si el giro cambia de moneda)
Dodo Payments (6% + 40¢ + SWIFT)           $6,85         |   $6,41   (+US$25 por giro si el negocio no es de EE.UU.)
Stripe Brasil, tarjetas del exterior       $6,84         |   $6,76   ← sin merchant of record
Mercado Pago Argentina, al instante        $7,61         |   $7,61   ← sólo clientes argentinos, en pesos
Polar plan Pro (3,8% + 40¢, US$20/mes)     $7,45         |   $7,01
Polar plan Starter (5% + 50¢)              $8,86         |   $8,32
Lemon Squeezy (5% + 50¢ + recargos)        $9,06         |   $8,52
Stripe + Managed Payments (LLC)            $9,24         |   $8,91

De dónde sale cada número (todas las páginas leídas el 24/10/2026):
- Stripe EE.UU. (stripe.com/pricing): 2,9% + 30¢ tarjeta doméstica; +1,5% tarjeta internacional; +1% si hay conversión de moneda; Billing (suscripciones) 0,7%; disputa US$15; giros estándar gratis. Managed Payments: «3,5% por transacción, ADEMÁS de las comisiones de Payments». O sea el todo incluido para una tarjeta de LatAm/España es 2,9 + 1,5 + 3,5 + 0,7 = 8,6% + 30¢.
- Stripe Tax (stripe.com/tax/pricing): plan Basic 0,5% por transacción (sólo calcula y cobra el impuesto donde ya estés inscripto). Si querés que además PRESENTEN las declaraciones, es Tax Complete: US$90, 430, 1.000 o 1.500 por mes con contrato de un año; el de US$90 incluye 2 inscripciones, 200 transacciones y 4 declaraciones por año.
- Stripe Brasil (stripe.com/br/pricing): 3,99% + R$0,39 doméstico, +2% tarjeta internacional, Billing 0,7%, disputa R$55. Los giros van obligatoriamente a una cuenta corriente en reales, en Brasil, a nombre del mismo CPF/CNPJ de la cuenta (support.stripe.com, «Supported bank accounts in Brazil»). No podés sacar la plata a otro país.
- Mercado Pago Argentina (mercadopago.com.ar/herramientas-para-vender/check-out): 6,29% + IVA al instante, 4,39% + IVA a 10 días, 3,39% + IVA a 18 días, 1,49% + IVA a 35 días. Con IVA 21%: 7,61% / 5,31% / 4,10% / 1,80%. Dice textual que «los costos pueden variar de acuerdo a los impuestos provinciales». Si esperás 35 días, Mercado Pago es LA MÁS BARATA de todas por lejos (1,80%), pero sólo para clientes argentinos pagando en pesos.
- dLocal Go (dlocalgo.com): sin cargo de alta ni mensual, sólo comisión por transacción. NO publica la tabla por país en su sitio. Fuentes de terceros (comercioelectronico.lat, julio 2026) dan Argentina 3,49% + 21% IVA ≈ 4,22%, México 2,49% + US$0,20 + 16% IVA, Pix en Brasil 0,99% + IVA. Otra guía de 2026 dice que las comisiones se negocian caso por caso. No lo pude confirmar en fuente oficial.
- Paddle (paddle.com/pricing): 5% + 50¢ por transacción, «sin cargos mensuales, de migración ni extras ocultos». Giros: mensuales, mínimo US$100, por transferencia o Payoneer; gratis si la moneda del giro coincide con la del país del banco, US$15 si va por SWIFT en otra moneda, y «hasta 1,5% de margen de conversión» si cobrás en otra moneda que tu saldo. Monedas de giro nombradas: USD, EUR, GBP, CAD, AUD. Para productos de menos de US$10 hay que pedir precio especial.
- Lemon Squeezy (docs.lemonsqueezy.com/help/getting-started/fees): 5% + 50¢ base, +1,5% si la venta es fuera de EE.UU., +0,5% si es suscripción, +1,5% si paga por PayPal. Para tu caso (suscripción, cliente de LatAm/España) es 7% + 50¢. Giro: gratis a banco de EE.UU., 1% a banco de afuera; PayPal 3% con tope de US$30. Paga el 1 y el 15, mínimo US$50, con 13 días de retención.
- Polar (polar.sh/resources/pricing): Starter gratis 5% + 50¢; Pro US$20/mes 3,8% + 40¢; Growth US$100/mes 3,6% + 35¢; Scale US$400/mes 3,4% + 30¢. +1,5% tarjeta no estadounidense. Disputa US$15 y no la devuelven ni si ganás. Giros: US$2 por mes en que gires, 0,25% + 25¢ por giro, y conversión de 0,25% (UE) a 1% (resto). La tarifa vieja «Early Member» (4% + 40¢) quedó cerrada para organizaciones creadas desde el 27/05/2026.
- Dodo Payments (dodopayments.com/pricing): 4% + 40¢ tarjeta de EE.UU.; +1,5% tarjeta internacional; +0,5% suscripciones; +3% PayPal y BNPL; reembolso US$1; disputa US$30; giro SWIFT en USD para negocios de fuera de EE.UU. US$25; US$5 si el giro es menor a US$1.000. Para tu caso: 6% + 40¢. Giros el 18 y el 4, mínimo US$100 (mínimo configurable US$50). Detalle MUY útil (docs.dodopayments.com/features/payouts): la cuenta de cobro puede estar en un país distinto al del documento de identidad, siempre que esté a tu nombre.
- Creem (creem.io/pricing y docs.creem.io): 3,9% + 40¢ y nada más; su propia página de comparación declara «+0% tarjetas internacionales, +0% suscripciones». Giro: US$7 o 1% del monto, el mayor de los dos. Contracargo US$25. Cobra el 1 y el 15, a banco o a billetera USDC. La frase de su documentación es que el 3,9% «cubre los costos de tarjeta, conversión de moneda e impuestos».

=====================================================================
3) ¿SE OCUPA DEL IVA DE CADA PAÍS? (merchant of record)
=====================================================================
Esto es lo que más te cambia si vendés a 10 países. «Merchant of record» significa que el proveedor es el VENDEDOR LEGAL ante el cliente: la factura al cliente la emite él, y él cobra y paga el IVA de España, de Chile, de Colombia, de México, etc. Vos no te inscribís en ningún país: recibís UNA transferencia mensual y eso es tu único ingreso a declarar.

SÍ es merchant of record: Paddle (más de 200 países), Dodo (220+), Lemon Squeezy, Polar, Creem (50+ países de impuestos), Stripe Managed Payments (más de 80 países).
NO lo es: Stripe directo (te vende Stripe Tax aparte, y la inscripción en cada país la hacés vos), Mercado Pago (es un procesador local, la factura la hacés vos).
NO LO PUDE CONFIRMAR: dLocal Go. Su sitio no dice nada de hacerse cargo del IVA del país del comprador. Dar por hecho que sí sería un error.

=====================================================================
4) SUSCRIPCIONES Y REINTENTOS
=====================================================================
Todas soportan suscripción recurrente. Diferencias que importan:
- Stripe: Billing con Smart Retries, es el más maduro, cuesta 0,7% extra.
- Paddle, Lemon Squeezy, Polar, Creem, Dodo: suscripciones y reintentos incluidos. Dodo cobra 5% de lo RECUPERADO si activás sus herramientas de recupero (carrito abandonado, dunning, reintentos) — gratis activarlas, 5% de lo que rescaten.
- Mercado Pago: tiene suscripciones (/preapproval_plan + /preapproval) y permite pausar, cambiar monto o tarjeta y reactivar. Pero una cuenta por país.
- dLocal Go: lista suscripciones y pagos recurrentes como producto.

=====================================================================
5) MÉTODOS LOCALES: EL PUNTO CIEGO DE LOS MERCHANT OF RECORD
=====================================================================
Paddle acepta Pix de Brasil sin entidad local (developer.paddle.com, changelog de Pix). Pero su lista de métodos NO incluye boleto, OXXO ni Mercado Pago. Dodo, Polar, Creem y Lemon Squeezy son esencialmente tarjeta + PayPal + billeteras.
Traducido a tu negocio: con un merchant of record le cobrás a un negocio chico de México o Argentina CON TARJETA Y EN DÓLARES. El que no tiene tarjeta internacional habilitada no te puede pagar. La única que te da métodos locales latinoamericanos de verdad (incluido Pix a 0,99% + IVA) es dLocal Go, y la única que te da el ecosistema argentino completo es Mercado Pago.

=====================================================================
6) LA LECTURA, EN UNA FRASE POR ESTRUCTURA
=====================================================================
- CON TU CUIT ARGENTINO, HOY: Stripe no existe para vos. Te quedan Mercado Pago (barata pero sólo Argentina y en pesos), dLocal Go (todo LatAm, métodos locales, sin merchant of record confirmado) y los merchant of record chicos: Creem 5,75%, Paddle 6,06%, Dodo 6,85%, Polar 7,45%. Todos giran a Argentina, pero en dólares por SWIFT, y entrar dólares a un banco argentino es el cuello de botella real.
- CON ESTRUCTURA EN PARAGUAY: se cae Creem (no lista Paraguay) y se cae Stripe. Quedan Paddle, Dodo, Polar, Lemon Squeezy y dLocal Go. Paraguay es el único de los tres países donde recibir dólares por SWIFT es trivial.
- CON ESTRUCTURA EN BRASIL: se te caen Lemon Squeezy y Polar (no giran a Brasil) y se te cae Stripe Managed Payments (Brasil no está habilitado). Te queda Stripe Brasil directo a 6,84% pero cobrando en reales, liquidando en reales, en una cuenta brasileña a nombre del CNPJ, y con vos (no Stripe) responsable del IVA de cada país. Más Paddle, Dodo, Creem y dLocal Go.
- CON UNA LLC DE EE.UU.: se abre TODO. Stripe completo, Stripe Managed Payments, Paddle, todos. Y además es la única estructura donde el giro es «de EE.UU. a un banco de EE.UU.», sin SWIFT, sin margen de conversión, sin US$25 por giro. Stripe Atlas (stripe.com/atlas, leído 24/10/2026): US$500 una vez, incluye la LLC en Delaware, el EIN, el agente registrado del primer año y la cuenta bancaria vía Stripe Treasury (Fifth Third Bank); después US$100 por año de agente registrado; constitución en un día hábil; «podés aplicar desde casi cualquier parte del mundo».

MI RECOMENDACIÓN DE PASARELA, SEPARADA DE LA DECISIÓN FISCAL (que es del contador):
a) Para arrancar YA, sin tocar nada: Creem (3,9% + 40¢, acepta vendedor argentino y brasileño, es merchant of record, es la más barata del lote). Riesgo: es una empresa chica y joven.
b) La apuesta sólida si hay LLC: Paddle. 5% + 50¢ fijo, merchant of record en 200+ países, es la más vieja y grande del grupo, y acepta Pix. Te sale más caro que Creem pero es la que menos riesgo de plataforma tiene.
c) Para clientes argentinos específicamente: Mercado Pago a 35 días de plazo cuesta 1,80%. Es cuatro veces más barato que cualquier merchant of record. Vale tener las dos cosas: Mercado Pago para Argentina, un merchant of record para el resto.
d) Lo que NO haría: Stripe Managed Payments (9,24% es el precio más alto de la tabla), y no construiría nada sobre Lemon Squeezy (ver riesgos).

NOTA PARA LA COSECHA: esto debería quedar en docs/hallazgos-pagos.md del repo, con el índice docs/hallazgos.md actualizado en el mismo commit. Un hallazgo que sólo existe en este mensaje está perdido.

**Cuánto cuesta**

Calculado sobre tu caso real: suscripción recurrente, cliente de Latinoamérica o España pagando con tarjeta (o sea, tarjeta «internacional» para casi toda estructura), incluyendo el recargo por divisa y el costo de sacar la plata. Doy dos columnas porque el cargo fijo por transacción pesa distinto según el ticket: si el promedio es US$47 hay más transacciones que si es US$97. Todo con precios leídos el 24/10/2026.

SOBRE US$50.000 AL AÑO
                                         ticket US$47 | ticket US$97
Mercado Pago AR, a 35 días (sólo Arg.)      US$  902  |  US$  902
Creem                                       US$2.875  |  US$2.655
Paddle                                      US$3.032  |  US$2.758
Stripe directo con LLC + Stripe Tax Basic   US$3.119  |  US$2.955
Stripe Brasil (tarjetas del exterior)       US$3.420  |  US$3.380
Mercado Pago AR, al instante (sólo Arg.)    US$3.805  |  US$3.805
Polar plan Pro (incluye US$240 de abono)    US$3.965  |  US$3.745
Dodo Payments (incluye US$600 de SWIFT)     US$4.026  |  US$3.806
Polar plan Starter                          US$4.430  |  US$4.160
Lemon Squeezy                               US$4.530  |  US$4.260
Stripe + Managed Payments (LLC)             US$4.619  |  US$4.455

SOBRE US$200.000 AL AÑO
                                         ticket US$47 | ticket US$97
Mercado Pago AR, a 35 días (sólo Arg.)      US$ 3.606 |  US$ 3.606
Creem                                       US$11.500 |  US$10.620
Paddle                                      US$12.128 |  US$11.030
Stripe directo con LLC + Stripe Tax Basic   US$12.476 |  US$11.818
Stripe Brasil (tarjetas del exterior)       US$13.680 |  US$13.520
Dodo Payments (incluye US$600 de SWIFT)     US$14.302 |  US$13.424
Mercado Pago AR, al instante (sólo Arg.)    US$15.218 |  US$15.218
Polar plan Pro (incluye US$240 de abono)    US$15.140 |  US$14.260
Polar plan Starter                          US$17.720 |  US$16.640
Lemon Squeezy                               US$18.120 |  US$17.040
Stripe + Managed Payments (LLC)             US$18.476 |  US$17.818

LAS CUENTAS, PARA QUE PUEDAS AUDITARLAS
- Creem: 3,9% + US$0,40 por venta, más 1% de giro. Sobre un ticket de US$47 son US$2,23 de comisión = 4,75%, más 1% = 5,75%.
- Paddle: 5% + US$0,50. Sobre US$47 son US$2,85 = 6,06%. OJO: si el giro sale en una moneda distinta a tu saldo, Paddle puede sumar «hasta 1,5% de margen de conversión», que sobre US$200.000 son hasta US$3.000 más. Y US$15 por cada transferencia SWIFT.
- Dodo: 4% + 1,5% internacional + 0,5% suscripción = 6% + US$0,40 = 6,85% sobre US$47. Más US$25 por giro SWIFT para negocio de fuera de EE.UU.: con 24 giros al año son US$600, que sobre US$50.000 pesan 1,2% y sobre US$200.000 sólo 0,3%. Dodo mejora bastante al escalar.
- Polar Starter: 5% + 1,5% internacional = 6,5% + US$0,50 = 7,56%, más giros (US$2 por mes, 0,25% + US$0,25 por giro, hasta 1% de conversión) ≈ 8,86%. En Pro bajás a 3,8% + 1,5% = 5,3% + US$0,40 y pagás US$240 al año de abono: conviene desde más o menos US$10.000 al año.
- Lemon Squeezy: 5% + 1,5% internacional + 0,5% suscripción = 7% + US$0,50 = 8,06%, más 1% de giro a banco de afuera de EE.UU. = 9,06%.
- Stripe + Managed Payments: 2,9% + 1,5% internacional + 3,5% de merchant of record + 0,7% de Billing = 8,6% + US$0,30 = 9,24%. Es la más cara de la tabla y encima exige LLC.
- Stripe directo con LLC: 2,9% + 1,5% + 0,7% de Billing + 0,5% de Stripe Tax Basic = 5,6% + US$0,30 = 6,24%. PERO Stripe Tax Basic sólo calcula y cobra el impuesto donde ya estés inscripto: si querés que además presenten las declaraciones hace falta Tax Complete, de US$90 a US$1.500 POR MES con contrato de un año (el de US$90 incluye 2 inscripciones y 4 declaraciones al año, que para 10 países no alcanza). Sumale US$1.080 a US$5.160 al año y la ventaja de precio contra Paddle o Creem desaparece. Más los honorarios del contador que te inscriba en cada país.
- Stripe Brasil: 3,99% + 2% tarjeta internacional + 0,7% de Billing + R$0,39 ≈ 6,84%. No incluye el IVA de cada país del comprador: eso lo tenés que resolver vos aparte. Y la plata queda en reales, en Brasil.
- Mercado Pago Argentina: 6,29% + 21% de IVA = 7,61% si querés la plata al instante; 1,49% + IVA = 1,80% si esperás 35 días. Más retenciones provinciales de Ingresos Brutos que varían por provincia (el sitio avisa que «los costos pueden variar de acuerdo a los impuestos provinciales») y que no cuantifiqué. Sólo sirve para clientes argentinos pagando en pesos, así que esos US$902 no son comparables con el resto de la tabla: son el costo de cobrarle a la porción argentina de tu facturación.
- dLocal Go: NO LO PUEDO CALCULAR con un número que me crea. No publica tarifas; las de terceros van de 0,99% (Pix en Brasil) a 4,22% (Argentina con IVA), sin confirmación oficial y sin saber si se hace cargo del IVA del comprador. Si fuera 4,22% todo incluido, serían US$2.110 sobre US$50.000, el segundo lugar de la tabla. Pero es una estimación de blog, no un hecho: hay que pedir la cotización.

LA DIFERENCIA QUE IMPORTA: entre lo más barato que te sirve de verdad (Creem a US$2.875) y lo más caro (Stripe Managed Payments a US$4.619) hay US$1.744 por año sobre US$50.000, y US$6.976 sobre US$200.000. Es plata, pero no es la decisión grande. La decisión grande es que la pasarela más barata de todas (Mercado Pago a 35 días, 1,80%) sólo funciona para tus clientes argentinos y en pesos: si el 40% de tu facturación es argentina, usar Mercado Pago para esa parte te ahorra más que cualquier elección entre merchant of record. Y lo que probablemente supere a todo esto es el tipo de cambio al que entren los dólares, que no medí y no es una comisión de pasarela.

**Riesgos**

1) LEMON SQUEEZY SE ESTÁ APAGANDO. Su propia página de precios tiene hoy un cartel: «2026 Update: Lemon Squeezy + Stripe Managed Payments», y el pie dice «Sold through Link, LLC f/k/a Lemon Squeezy LLC». Stripe la compró y el camino declarado es migrar a todos a Stripe Managed Payments. Fuentes de terceros (enero y junio de 2026) dicen que el alta de nuevos vendedores está por lista de espera o por invitación, pero se contradicen entre sí y no lo pude confirmar en página oficial. NO construyas sobre esto: no hay fecha de cierre anunciada, pero tampoco hay compromiso de que siga.

2) EL PROGRAMA DE US$1.500 PUEDE NO SER ELEGIBLE EN STRIPE MANAGED PAYMENTS. La página oficial de elegibilidad dice textual que no soporta «servicios profesionales, como consultoría, marketing, diseño, desarrollo o soporte técnico», y que «si tu servicio involucra intervención humana (como coaching 1 a 1 en vivo), no califica como producto digital». Si el programa de US$1.500 incluye llamadas o acompañamiento, Stripe te avisa que la responsabilidad impositiva vuelve a ser tuya y tenés que dejar de usar el producto para ese ítem. Lo mismo hay que chequear con Paddle y los demás: el modelo «suscripción + programa con llamadas» rompe el supuesto de «producto digital automatizado» en el que se apoyan todos los merchant of record.

3) MERCHANT OF RECORD = NO PODÉS SER PLATAFORMA. Stripe Managed Payments dice explícitamente que no soporta Connect (plataformas ni marketplaces). Es decir: si MaKo algún día cobra EN NOMBRE de sus clientes, ese flujo no puede vivir en el mismo producto. El roadmap de MaKo ya tiene «pasarela Stripe + Mercado Pago» para los negocios clientes. Las dos cosas pueden convivir (la suscripción de MaKo por un merchant of record; los cobros de cada cliente con SU propia clave), pero hay que diseñarlo así desde el principio, no descubrirlo después.

4) FRAGILIDAD DE PROVEEDOR. Creem, Polar y Dodo son empresas chicas y nuevas. Son las más baratas de la tabla justamente por eso. Lo que no medí y es el riesgo más grande de todos: congelamiento de cuenta, reservas retenidas, y qué pasa con tu base de suscriptores si la empresa cierra o te da de baja. Polar ya mostró que las condiciones se mueven: subió de 4% + 40¢ a 5% + 50¢ para toda organización creada desde el 27/05/2026. Además, parte de lo que leí sobre Creem, Polar y Lemon Squeezy viene del blog de Dodo Payments, que es su competidor directo: lo tomé sólo cuando coincidía con la página oficial.

5) EL CLIENTE ARGENTINO PAGANDO EN DÓLARES. Si cobrás por un merchant of record de afuera, tu cliente argentino paga en dólares con tarjeta y le cae IVA del 21% sobre servicio digital del exterior más, según varias guías de 2026, la percepción del 30% a cuenta de Ganancias y Bienes Personales (RG 5617). LAS FUENTES SE CONTRADICEN: una nota de enero de 2026 dice que ARCA dejó de cobrar esa percepción en consumos con tarjeta, y notas de agosto de 2026 dicen que sigue vigente. Si sigue vigente, un plan de US$47 le sale a un argentino el equivalente a US$71 y la conversión se te muere. Esto es un argumento fuerte para cobrar en pesos por Mercado Pago a los clientes argentinos, independientemente de la estructura que elijas.

6) LA PLATA EN BRASIL SE QUEDA EN BRASIL (SI USÁS STRIPE). Stripe Brasil gira obligatoriamente a una cuenta corriente en reales, en una institución domiciliada en Brasil, a nombre del mismo CPF/CNPJ de la cuenta de Stripe, y no acepta cajas de ahorro ni cuentas sueldo. No hay forma de pedirle a Stripe Brasil que gire a otro país. Sacar eso de Brasil es un segundo problema, con su propio costo, que no es de la pasarela.

7) ENTRAR DÓLARES A ARGENTINA ES EL COSTO OCULTO MÁS GRANDE. Ninguna de estas pasarelas gira en pesos a una cuenta argentina. Paddle nombra USD, EUR, GBP, CAD y AUD. Dodo gira por SWIFT en dólares con US$25 de cargo. Lemon Squeezy cobra 1% a bancos de afuera de EE.UU. Payoneer (que es la vía que usan Paddle y Dodo) está disponible en Argentina, Paraguay y Brasil, cobra US$29,95 por año si en 12 meses recibís menos de US$6.000, y para retirar a un banco argentino las fuentes dan entre 0,75% y 4% más posibles cargos fijos. Pero lo que no es una comisión y es el costo real: al entrar los dólares se liquidan a tipo de cambio oficial. Ese spread puede superar a TODAS las comisiones de esta investigación juntas. Es la pregunta más importante de todo el expediente y no es una pregunta de pasarela.

8) DEPENDE DE UN DOCUMENTO, NO DE UNA EMPRESA. Dodo dice textual que la elegibilidad se define por el país que emitió el documento de identidad usado para verificar, y para empresas pide el documento de cada director y dueño real: «registrar una empresa en un país soportado no alcanza por sí solo». Es decir, armar una sociedad paraguaya con Martín como director puede disparar la revisión por Argentina igual. Cuidado con asumir que la estructura borra la nacionalidad de las personas.

9) LOS PRECIOS DE ESTA TABLA TIENEN FECHA: 24/10/2026. Polar cambió su tarifa en mayo de 2026. Stripe lanzó Managed Payments en 2026. Estas comisiones se mueven y los contratos de merchant of record son unilaterales. Si esta decisión se toma en dos meses, hay que volver a medir.

**Lo que no se encontró**

1) La lista oficial de países desde los que Paddle ACEPTA vendedores. Paddle sólo publica la lista de países prohibidos (y Argentina, Paraguay y Brasil no están en ella). No es lo mismo «no está prohibido» que «está aprobado»: Paddle revisa cada negocio al dar de alta. Tampoco encontré si Paddle gira en pesos argentinos o reales: su página de giros nombra USD, EUR, GBP, CAD y AUD, y una reseña habla de 13 monedas sin confirmar cuáles.

2) La tabla oficial de comisiones de dLocal Go por país. Su sitio dice «sólo pagás comisión por transacción» y no publica los porcentajes. Los números que usé (Argentina ~4,22% con IVA, México 2,49% + US$0,20 + 16%, Pix 0,99% + IVA) son de blogs de terceros de julio de 2026, y otra guía de 2026 directamente dice que las comisiones se negocian caso por caso. HAY QUE PEDIR COTIZACIÓN. Es la pasarela con mejor encaje para LatAm y la que peor documentada tiene el precio.

3) Si dLocal Go actúa como merchant of record, o sea si se hace cargo del IVA del país del comprador. Su sitio no lo menciona. Es la diferencia entre «una sola declaración» y «inscribirte en cada país», así que es la pregunta número uno para ellos.

4) Si Lemon Squeezy está abierta hoy a vendedores nuevos. Tres fuentes de 2026 dicen tres cosas distintas (abierta, lista de espera, por invitación) y la página oficial no lo aclara.

5) Los recargos oficiales de Creem por tarjeta internacional y por suscripción. El «+0% / +0%» sale de la página de comparación de Creem contra Stripe, que es marketing propio, no de su tabla de tarifas. Si en realidad cobran un recargo internacional como todas las demás, Creem deja de ser la más barata. Hay que confirmarlo por escrito antes de elegirla por precio.

6) El cargo exacto del giro SWIFT de Dodo para negocios de fuera de EE.UU.: la página de precios dice US$25 y la documentación de giros nombra el cargo sin monto. También quedó sin resolver una contradicción en su propia página de precios: la tabla dice que los giros estándar son gratis y las preguntas frecuentes dicen que hay US$5 si el giro es menor a US$1.000.

7) Si Mercado Pago Argentina puede cobrarle online a una tarjeta española o mexicana, y con qué comisión. La única declaración oficial que encontré es un tuit de la cuenta de Mercado Pago de 2019 diciendo que sí se puede recibir del exterior con tarjetas que admitan pagos internacionales. Guías más recientes dicen que no hay forma directa. Para efectos prácticos tratá a Mercado Pago como una pasarela por país, no como una pasarela regional.

8) El costo real de convertir y entrar los dólares a cada país (el spread contra el oficial en Argentina, las condiciones de ingreso en Paraguay y Brasil). No lo medí porque no es una comisión de pasarela, pero sospecho que es más grande que todo lo demás junto.

9) La letra chica de riesgo de cada proveedor: reservas retenidas, plazos de congelamiento, qué pasa con tus suscriptores si te dan de baja. Ninguno lo publica con números.

**Para el contador**

1) Si cobro por un «merchant of record» (Paddle, Creem, Dodo) que factura al cliente final en su propio nombre y me gira UNA transferencia mensual a mí, ¿qué soy yo frente a ARCA: estoy exportando un servicio a una empresa del exterior, o estoy vendiendo a los clientes finales de cada país? De esa respuesta depende si el merchant of record me simplifica la vida o me la complica, y es la bisagra de toda la decisión.

2) Entre las cuatro estructuras (CUIT argentino, sociedad paraguaya con mi hermana, entidad brasileña con mi hermana, LLC de EE.UU.), ¿en cuál el ingreso de esa transferencia mensual se declara y se liquida más barato Y SIN QUE YO TENGA QUE SIMULAR UNA RESIDENCIA QUE NO TENGO? Concretamente: si la plata entra a nombre de mi hermana en Paraguay o Brasil pero yo soy el que desarrolla y vende desde Argentina, ¿eso es una exportación de servicios mía que estoy omitiendo declarar, o hay una forma legal de documentarlo (contrato de desarrollo, facturación mía a esa sociedad, precios de transferencia)?

3) Si entran dólares de una pasarela del exterior a una cuenta argentina: ¿a qué tipo de cambio se liquidan obligatoriamente hoy, y cuánto me cuesta eso en porcentaje? Necesito ese número al lado de las comisiones de esta tabla, porque sospecho que es más grande que todas ellas. Y lo mismo para Paraguay y para Brasil: ¿hay obligación de liquidar, hay retención a la entrada?

4) ¿Sigue vigente la percepción del 30% (RG 5617) sobre servicios digitales del exterior pagados con tarjeta por un consumidor argentino? Las fuentes de 2026 se contradicen. Si sigue vigente, a mi cliente argentino un plan de US$47 le sale como US$71 y tengo que cobrarle en pesos por Mercado Pago aunque todo el resto lo cobre afuera.

5) Si el programa de US$1.500 incluye llamadas o acompañamiento humano, ¿cambia su tratamiento impositivo respecto de la suscripción de software? Lo pregunto porque Stripe dice explícitamente que ese tipo de producto NO entra en su merchant of record, y si los demás piensan igual, tengo que cobrar la suscripción por un lado y el programa por otro.


---

## Cómo llega la plata a Martín: el tipo de cambio ya no es el problema (el riel cuesta US$120–4.000 al año; la estructura, US$7.500–30.000)

**Lo medido**

Aviso previo, y va en serio: no soy contador ni abogado. Esto es un relevamiento de hechos públicos, con fecha y fuente, para que llegues a un profesional con las preguntas correctas. Nada de acá es un consejo profesional.

=== 1) EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: LA BRECHA CAMBIARIA ESTÁ EN ~1%, NO EN 30% ===

Durante años la pregunta "¿a qué dólar me lo acreditan?" se comía 30 o 40 puntos. Hoy no. Cotizaciones del 23/10/2026 (El Cronista):
- Oficial (Banco Nación, venta): $1.550. Mayorista: $1.546,90.
- MEP: $1.552,50–$1.553.
- CCL: ~$1.638 el 22/10/2026 (Infobae), ~6% arriba del oficial.
- Brecha blue/oficial: 0,97% al 08/10/2026 (indicadores.ar); ~1% (Cronista).

Traducción: entre el peor y el mejor tipo de cambio hay ~1% (MEP vs oficial) o ~6% (CCL vs oficial). Antes elegir mal el riel te costaba un tercio de la facturación. Hoy te cuesta entre 1 y 3 puntos. **Lo que hoy mueve 15 a 35 puntos no es el tipo de cambio: es la estructura societaria y el impuesto de salida del país donde cobre tu hermana.** Toda la energía que pongas en "qué app me da mejor cotización" rinde diez veces menos que la que pongas en "por dónde factura la empresa".

(Esto es lo que vale la pena dejar escrito en el repo: la regla vieja —"maximizá el tipo de cambio"— quedó obsoleta en 2026 y lleva a optimizar lo que menos importa.)

=== 2) EL CAMBIO REGULATORIO QUE TE HABILITA QUEDARTE EN DÓLARES (y su letra chica) ===

Leí el texto ordenado vigente del BCRA "Exterior y Cambios", punto 2.2.2.1, versión 8a, Comunicación "A" 8481, **vigencia 15/09/2026**. Dice, textual, que quedan exceptuados de la obligación de liquidación los cobros de exportaciones de servicios prestados por personas humanas si se cumplen **todas** estas condiciones:
- i) "Los fondos sean acreditados en cuentas en moneda extranjera de titularidad del cliente en entidades financieras locales."
- ii) "La utilización de este mecanismo deberá resultar neutra en materia fiscal."
- Registro: dos boletos sin movimiento de pesos, el de venta bajo el código de concepto "A22".
- Y: "Las entidades no podrán cobrar comisiones por estas operaciones", salvo trasladar a costo los cargos documentados de los bancos del exterior.

Cómo llegó hasta acá: la Com. "A" 8330 (18/09/2025) eliminó el tope anual de USD 36.000 para personas humanas exportadoras de servicios. La Com. "A" 8417 (09/04/2026) —leí el PDF oficial— extendió la excepción "a todos los conceptos de servicios" (punto 2) y la estiró también a exportaciones de bienes de personas humanas (punto 1).

**La letra chica que casi nadie menciona, y es la más importante de toda mi línea:** lo que se eliminó es la obligación de **liquidar** (pasar a pesos). NO se eliminó la obligación de **ingresar**. El punto 2.2.1 del mismo texto ordenado sigue exigiendo que los cobros por servicios de residentes a no residentes "deberán ser ingresados y liquidados en el mercado de cambios en un plazo no mayor a los 20 (veinte) días hábiles a partir de la fecha de su percepción en el exterior". Es decir: si el que factura sos vos, la plata tiene que entrar a Argentina, a una cuenta en dólares a tu nombre en un banco local, dentro de 20 días hábiles. Podés quedarte en dólares; no podés dejarla parada afuera en Wise o Mercury indefinidamente.

Esto parte el problema en dos caminos que no se mezclan:
- **Camino A — facturás vos (factura E):** te queda el 2.2.2.1 a favor (cobrás en dólares, sin pesificar, sin tope, y el banco no te puede cobrar comisión), pero con la obligación de ingresar en 20 días hábiles.
- **Camino B — factura una sociedad del exterior (LLC / Paraguay / Brasil):** esa exportación no es tuya, así que el 2.2.2.1 y los 20 días no te aplican a esa facturación. Pero entonces el problema se corre al punto 4 de abajo: cómo te pasa la plata tu hermana, y ahí sí aparecen impuestos nuevos.

=== 3) LOS RIELES, UNO POR UNO (costo, moneda, plazo, límites) ===

**Transferencia bancaria tradicional (SWIFT) a tu cuenta en USD en banco argentino**
- Comisión del banco argentino: **USD 0**. Está prohibido cobrarla (Com. "A" 8330, 18/09/2025, ratificado en el texto ordenado vigente al 15/09/2026).
- Lo único que pagás: el corresponsal del exterior. La tabla de Wise (2025) ubica el costo SWIFT entre USD 20 y USD 150 por giro según el banco.
- Moneda: dólares, en tu cuenta en dólares. Plazo: días.
- **Es el único riel que cumple limpio el 2.2.2.1** (cuenta en moneda extranjera en entidad financiera local). Y, a volumen, es el más barato de todos. Esto es contraintuitivo: la vía "vieja" le gana a las fintechs.

**Wise**
- El propio blog de Wise para Argentina dice que los fondos "llegan directamente a tu cuenta bancaria argentina **en pesos**, a través de una transferencia local". El Cronista agrega que convierte al oficial con un límite de **USD 18.000 por transferencia y por mes calendario**.
- Costo: las fuentes no coinciden. El propio blog de Wise mostraba USD 15,94 sobre USD 1.000 (comparativa fechada 23/08/2025) = 1,59%. Reseñas de 2026 dan 0,4%–0,8%, otra 1,5%.
- **Problema no monetario:** si acredita pesos vía transferencia local, no te sirve para quedarte en dólares bajo el 2.2.2.1, y queda la duda de si ese ingreso queda bien registrado como cobro de exportación. A verificar.
- La tarjeta de débito Wise no está disponible en Argentina (Exiap, 2026).

**Payoneer**
- Retiro a cuenta en pesos: 0,75% a 2% según la fuente, al tipo oficial (Tiendanube, Wise, Exiap, Jonatan Almeira, todas 2026 y todas discrepando).
- Retiro en dólares: hay convenio con Santander, hasta 2% sobre el monto (Tiendanube).
- Cargos fijos: SWIFT entre USD 20 y 150; mantenimiento anual USD 29,95 si no hay movimientos en 12 meses (tabla Wise, 2025).

**Bitso** (datos de LA NACION, 03/10/2026)
- Apertura y mantenimiento de cuenta en dólares: sin costo. Retirar pesos o transferir al banco: sin costo.
- Recibir por **ACH: USD 2,99 por transacción**. Por **Wire: USD 11,99 + 0,17%**. Desde Payoneer: 2,9%.
- Acredita en **USDC**, no en dólares bancarios.

**Lemon** (LA NACION, 03/10/2026)
- Apertura de cuenta virtual: USD 4, único.
- Recibir: ACH 1,5%; Wire 1,5% + USD 12; SEPA 1,5%.
- Límites: hasta **USD 4.000 desde cuentas de terceros** por operación; mínimo USD 1; en euros, máximo 5.000 por operación.
- Acredita en **USDT**. Lemon afirma "hasta 2% más" que MEP u oficial según condiciones de mercado.

**Takenos** (LA NACION, 03/10/2026)
- Cuenta gratis, con cuenta en EE.UU. (ACH, Wire, SWIFT) y en Europa (SEPA). Sin comisión por ACH ni entre usuarios.
- Acredita en "dólares digitales" (USDC/USDT). Una reseña independiente (comercioelectronico.lat) le atribuye 3% total para sueldos, lo que contradice a LA NACION. Sin resolver.

**Prex** (billetera uruguaya, LA NACION 03/10/2026): IBAN virtual para euros; retiro desde Payoneer con 2%.

**Deel**
- No pude confirmar la comisión vigente. El blog de Wise (de hace ~416 días) dice USD 0 por retiro a Wise con mínimo USD 5; un blog contable de 2026 dice que Deel cobra por retiro a Argentina "según plan". Deel aclara que tenés 30 días para retirar.
- Deel es un intermediario de nómina/contratos: suma una capa, no un tipo de cambio mejor.

**Revolut: descartado.** No se puede abrir cuenta con residencia argentina. El BCRA le aprobó comprar Banco Cetelem Argentina, pero Infobae (24/09/2026) dice que todavía falta la autorización final y que habrá que **esperar a 2027**. Argentina no figura entre los países habilitados (análisis de fines de 2026).

**Mercury**
- Requiere LLC o C-Corp en EE.UU. con EIN, domicilio comercial real (no agente registrado ni casilla) y pasaporte de cada dueño con 25% o más.
- El criterio es la **residencia** del fundador, no el pasaporte. Argentina no aparece en ninguna de las listas de países prohibidos que vi (las fuentes hablan de 48 países, con Cuba, Irán, Corea del Norte y zonas ocupadas de Ucrania), pero **no lo confirmé en la página oficial de Mercury**. Hay que chequearlo ahí antes de constituir nada.

**El premio del dólar digital, con números**
Comparativa de Lemon reproducida por CriptoTendencia (01/09/2026), para traer USD 2.000 de EE.UU. a un banco argentino:
- Ya tenés USDT en otra billetera: sin comisión de rampa → $2.060 equivalentes, ~+3%.
- ACH desde banco de EE.UU. (1,5%): $2.029,10, ~+1,4%.
- Wire (1,5% + USD 12): $2.016,74, ~+0,8%.
El "+3%" sale de que el USDT cotiza ~3% arriba del MEP y del oficial. **Ojo: es contenido patrocinado por Lemon**, el premio es variable y no publicaron los valores absolutos del MEP ni del oficial de ese día.

**La trampa del riel más barato.** Bitso por ACH a USD 2,99 por operación es, en papel, el más barato de toda la lista: 12 transferencias al año son USD 36. Pero acredita USDC/USDT, es decir un **criptoactivo**, no "moneda extranjera en una entidad financiera local". Dos consecuencias: (a) no cumple el requisito i) del 2.2.2.1, así que no te descarga la obligación del BCRA; (b) la interpretación habitual trata al USDT como cripto y no como moneda extranjera, lo que puede alcanzar la tenencia al 31/12 por Bienes Personales y generar resultado gravado en Ganancias al venderlo (Rankia, 2026; no hay norma específica de ARCA sobre stablecoins). Y ARCA empieza a recibir información de billeteras del exterior vía CRS ampliado: la vigencia es desde enero de 2026 y el intercambio llega **a principios de 2027** (iProUP). O sea: el riel más barato es el que menos cumple, y el que peor envejece.

=== 4) LO QUE DE VERDAD IMPORTA: CÓMO TE PASA LA PLATA TU HERMANA ===

Primero el costo de salida del país donde cobre, que es el número más grande que encontré en toda mi línea:

**Desde Brasil — IOF sobre remesa al exterior.** Fuentes de 2026 dicen que la remesa de persona física a cuenta propia o de familiar en el exterior pasó de 1,1% a **3,5%**. Pero el estado jurídico está en disputa: unas fuentes dicen que el STF restableció el Decreto 12.499/2025 con el 3,5%, otras que volvió al patrón anterior del Decreto 11.241/2022. Ninguna fuente trató el IOF sobre dividendos. **Hay que confirmarlo en el decreto consolidado (6.306/2007 con sus modificaciones) o con la Receita.**

**Desde Paraguay — IDU sobre dividendos.** La DNIT (fuente oficial) publica: residentes 8%, **no residentes 15%**, con vencimiento mensual. Vos sos no residente paraguayo: 15%. Para honorarios a no residentes, las guías dan 15% y una ~10% efectivo; no está resuelto.

Ahora las cinco formas, y qué implica cada una para los dos:

**a) Sueldo (relación de dependencia).** La empresa de tu hermana te emplea. Implica obligaciones laborales y de seguridad social en ese país, y como el trabajo lo hacés desde Argentina el ingreso es discutiblemente de fuente argentina (se grava por el trabajo realizado acá). Además te vuelve empleado de la empresa de tu hermana, lo que debilita cualquier argumento de que la empresa opera por sí sola. La peor relación costo/beneficio de las cinco.

**b) Honorarios con factura E.** La más limpia y la más defendible: le facturás servicios reales (desarrollo, gestión del producto) a la empresa. Para ella es gasto deducible; para vos es exportación de servicios tuya, con factura E, 20 días hábiles para ingresar y el 2.2.2.1 a favor para quedarte en dólares. Dos contras: (i) retención en origen (Paraguay ~15% reportado, sin confirmar) y después Ganancias en Argentina; (ii) si facturás casi toda la utilidad, a la empresa del exterior no le queda margen ni sustancia, y ahí se cae la estructura. Si facturás poco, la plata queda afuera y no te llega. La tensión no se resuelve con el riel: se resuelve con precios de transferencia razonables, y eso lo tiene que fijar un profesional.

**c) Dividendos.** Requiere que seas socio. Y si sos socio, la dueña no es tu hermana: sos vos, y se cae la premisa. Encima: 15% de IDU en Paraguay en la salida, y en Argentina los dividendos de sociedades del exterior son **renta de fuente extranjera gravada por la escala progresiva (hasta 35%)**, no al 7% de los dividendos locales, y sin agente de retención local (lo declarás vos). Peor todavía, abre el **artículo 130 de la Ley de Ganancias (transparencia fiscal internacional)**: si residentes argentinos tienen más del 50% o el control económico, el impuesto pagado afuera es menor al 75% del argentino (alícuota efectiva bajo ~18,75%) y la entidad **no tiene la organización material y personal para realizar su actividad**, la renta se te imputa como propia **en el ejercicio en que se devenga, aunque no la retires**. Una LLC sin oficina, sin empleados y sin operación propia es el caso de manual.

**d) Préstamo.** No es ingreso, así que no paga Ganancias. Pero tiene que ser un préstamo de verdad: instrumentado por escrito, con fecha, con interés de mercado y **devuelto**. Un préstamo sin interés o que nunca se devuelve se recaracteriza, y el interés es ingreso gravado para tu hermana. Es la forma con más probabilidad de terminar tratada como incremento patrimonial no justificado. Recurrente y por el monto de tu facturación, no se sostiene.

**e) Donación.** A nivel nacional no hay impuesto a herencias y donaciones desde 1976. La única jurisdicción que cobra transmisión gratuita de bienes es la **Provincia de Buenos Aires** (Impuesto a la Transmisión Gratuita de Bienes, Ley 14.044), y alcanza las donaciones de dinero cuando el beneficiario tiene domicilio en la Provincia, superados los mínimos. **Dónde vivís define esto**: en CABA u otra provincia, una donación documentada puede no pagar impuesto a la donación; en PBA, sí.

**Y acá va la parte que te tengo que decir aunque no te guste.** Las formas c), d) y e) sólo son elusión legal **si el negocio es genuinamente de tu hermana**: ella decide, ella trabaja, ella asume el riesgo, y vos le facturás o te hace un regalo. Si el negocio es tuyo y tu hermana figura, entonces no hay forma de transferencia que lo arregle: eso es simular titularidad y residencia, y la regla 1 de esta investigación lo descarta. El artículo 130 es, justamente, la expresión legal de ese límite — el Estado argentino ya escribió el test ("organización material y personal") para distinguir una empresa real de una fachada. Una donación mensual del monto exacto de la facturación de MaKo no pasa ese test ni ninguno.

El camino que no requiere nada de esto, y que la regulación de 2026 te dejó abierto, es el aburrido: **facturás vos desde Argentina, factura E, cobrás por SWIFT a tu cuenta en dólares en un banco argentino, no pesificás, el banco no te puede cobrar comisión.** Cuesta USD 120–360 al año en costos de corresponsal y no depende de que nadie te crea nada.

**Cuánto cuesta**

Esto es sólo el costo de **que la plata llegue** (riel + tipo de cambio + impuesto de salida). No incluye la comisión de la pasarela de cobro ni el impuesto sobre la facturación — son otras líneas de la investigación.

=== SOBRE US$50.000 AL AÑO ===

**Riel A — SWIFT a tu cuenta en USD en banco argentino (facturás vos, factura E)**
- Comisión del banco argentino: US$0 (prohibida, Com. "A" 8330)
- Corresponsal del exterior: US$20–150 por giro (tabla Wise, 2025). Tomo US$30 como piso realista para un giro originado en EE.UU.
- 12 giros al año: **US$360 → 0,72%**
- 4 giros al año (trimestral): **US$120 → 0,24%**
- Pérdida por tipo de cambio: **cero**, te quedás en dólares.

**Riel B — Wise (acredita pesos)**: 0,5%–1,6% → **US$250–800**. Entra cómodo en el límite de US$18.000/mes.
**Riel C — Payoneer**: 0,75%–2% → **US$375–1.000**, más US$29,95 si queda inactiva.
**Riel D — Bitso ACH** (US$2,99 por operación, 12 al año): **US$36 (0,07%)**, pero acredita USDC: no cumple el 2.2.2.1 y suma Bienes Personales/Ganancias como cripto.
**Riel E — Lemon ACH 1,5%**: **US$750** + US$4 de apertura. Mismo problema regulatorio.
**Premio del dólar digital** (si va por cripto): ~+3% sobre MEP según Lemon al 01/09/2026, variable y de fuente patrocinada → hasta +US$1.500, pero no es un ingreso asegurado.

**Si la plata pasa por BRASIL y tu hermana te remite** (se suma a lo de arriba):
- IOF 3,5%: **+US$1.750/año**. Si rige 1,1%: +US$550/año. Estado jurídico en disputa.

**Si la plata pasa por PARAGUAY y te gira dividendos** (se suma a lo de arriba):
- IDU 15% sobre no residentes: **+US$7.500/año**
- Y después Ganancias en Argentina sobre renta de fuente extranjera, escala progresiva hasta 35%, con crédito por el impuesto pagado afuera.
- Si en cambio le facturás honorarios: retención paraguaya reportada 15% → **+US$7.500/año** (dato no confirmado; otra fuente dice ~10%).

=== SOBRE US$200.000 AL AÑO ===

**Riel A — SWIFT a cuenta en USD en banco argentino**
- 12 giros: **US$360 → 0,18%**
- 4 giros: **US$120 → 0,06%**
- El costo es fijo, así que al cuadruplicar la facturación el porcentaje se divide por cuatro. Es el único riel que escala sin castigo.

**Riel B — Wise**: 0,5%–1,6% → **US$1.000–3.200**. **Traba real:** el límite reportado es US$18.000 por transferencia y por mes calendario (Cronista). US$200.000/año son US$16.667/mes: entrás justo, sin margen para un mes bueno. A este volumen Wise deja de servir.
**Riel C — Payoneer**: 0,75%–2% → **US$1.500–4.000**.
**Riel D — Bitso ACH**: **US$36 (0,02%)**, con los mismos problemas regulatorio e impositivo.
**Riel E — Lemon ACH 1,5%**: **US$3.000**. Además el tope de US$4.000 por operación desde cuentas de terceros te obliga a fragmentar en ~50 operaciones al año.

**Si pasa por BRASIL**: IOF 3,5% → **+US$7.000/año** (o +US$2.200 si rige 1,1%).
**Si pasa por PARAGUAY, dividendos**: IDU 15% → **+US$30.000/año**, más Ganancias en Argentina hasta 35%.

=== LA CONCLUSIÓN EN UNA LÍNEA ===
El riel cuesta entre **US$36 y US$4.000 al año**. La estructura cuesta entre **US$1.750 y US$30.000 al año**. La estructura es 10 a 100 veces el riel. Elegir bien la app te ahorra cientos de dólares; elegir bien por dónde factura la empresa te ahorra decenas de miles. Y la opción más barata de todas las que medí —facturar vos desde Argentina y cobrar por SWIFT a tu cuenta en dólares, US$120–360 al año con cero pérdida de tipo de cambio— es también la que no necesita que nadie valide una estructura.

**Riesgos**

**1) El riel más barato es el que no cumple.** Bitso ACH a US$2,99 por operación (US$36/año) acredita USDC, no dólares en un banco local. El punto 2.2.2.1 del BCRA exige expresamente "cuentas en moneda extranjera de titularidad del cliente en entidades financieras locales". Cobrar en stablecoins no te descarga la obligación de ingresar, y encima la tenencia de USDT queda, según la interpretación habitual, tratada como criptoactivo y no como moneda extranjera: Bienes Personales sobre el saldo al 31/12 y resultado gravado al venderlo. Si tu contador te dice que cobrar en USDT "es igual que cobrar dólares", pedile que te lo muestre en la norma.

**2) Sigue viva la obligación de INGRESAR, y eso es frágil si dejás plata afuera.** Si el que factura sos vos, el punto 2.2.1 te da 20 días hábiles desde que percibís la plata en el exterior para ingresarla. Una cuenta de Mercury o Wise con saldo acumulado durante meses, facturando vos, es un incumplimiento cambiario. Esto es lo que hace que la LLC "para no pesificar" sea innecesaria y a la vez riesgosa: ya no necesitás la LLC para quedarte en dólares (el 2.2.2.1 te lo da), y la LLC no te libera de ingresar si la exportación es tuya.

**3) El artículo 130 te puede hacer pagar impuesto por plata que nunca retiraste.** Si vos (o residentes argentinos) controlan más del 50% de la sociedad del exterior, el impuesto pagado afuera es bajo (alícuota efectiva menor a ~18,75%) y la entidad no tiene "organización material y personal" propia, la renta se te imputa en el ejercicio en que se devenga, distribuida o no. Una LLC sin empleados ni oficina es el caso de manual. El ahorro fiscal desaparece y queda el costo de mantener la estructura.

**4) Todo lo frágil está en lo que puede cambiar, y puede cambiar rápido.** La brecha cambiaria de ~1% es la premisa que sostiene toda mi conclusión, y es coyuntural: Infobae (22/10/2026) atribuye la suba de la brecha financiera a la caída de los bonos, con riesgo país que tocó 710 puntos. Si la brecha se vuelve a abrir a 20 o 30 puntos, el orden de los rieles se invierte de nuevo y la vía cripto/CCL vuelve a ser la que manda. Esta investigación tiene fecha: 24/10/2026. Revisala si la brecha pasa de 5%.

**5) El régimen cambiario viene cambiando cada pocos meses.** Com. "A" 8330 en septiembre de 2025, Com. "A" 8417 en abril de 2026, texto ordenado versión 8a en septiembre de 2026. Tres cambios relevantes en trece meses. Cualquier decisión estructural que dependa de que el 2.2.2.1 siga igual es una apuesta.

**6) El IOF brasileño está jurídicamente en disputa.** Unas fuentes de 2026 dicen 3,5%, otras que el STF restableció el patrón anterior con 1,1%. La diferencia entre 1,1% y 3,5% sobre US$200.000 son US$4.800 al año. No podés planificar sobre un dato que las fuentes contradicen: hay que leer el decreto consolidado.

**7) Fragmentar para esquivar un límite es un control, no una optimización.** Lemon topea en US$4.000 por operación desde cuentas de terceros y Wise en US$18.000 por mes. A US$200.000 al año esos topes te empujan a partir los cobros. Partir una operación para quedar por debajo de un umbral de reporte es exactamente lo que la regla 1 de esta investigación descarta. Si un riel no te sirve por volumen, se cambia el riel, no se trocean las transferencias.

**8) El riesgo más grande no es impositivo, es de relato.** Dividendos, préstamo y donación sólo funcionan si el negocio es genuinamente de tu hermana. Si MaKo es tuyo —vos lo desarrollás, vos lo vendés, vos decidís el precio— y ella figura como titular, ninguna de las tres formas es elusión: es simulación, y queda fuera de lo que se puede investigar acá. El test del artículo 130 ("organización material y personal") es el mismo test que aplicaría cualquier inspector. Una transferencia mensual por el monto exacto de tu facturación, llamada donación, no lo pasa.

**9) Un riesgo práctico que no es fiscal:** si ponés el cobro a nombre de tu hermana, el acceso a la plata de MaKo depende de la relación con ella y de su situación personal (divorcio, deudas, un embargo, un problema de salud). El dinero de tu empresa estaría legalmente en su patrimonio. Eso no se arregla con un contador.

**10) Revolut está fuera de la mesa** hasta 2027 por lo menos; no planifiques con eso. **Y la elegibilidad de Mercury para residentes argentinos no la verifiqué en la fuente oficial**: si la estructura depende de abrir Mercury, confirmalo antes de gastar un peso en constituir una LLC.

**Lo que no se encontró**

**No lo encontré, y no lo estimo:**

1. **La comisión actual de Wise para USD→ARS, de fuente oficial de Wise.** La única cifra concreta que da Wise es US$15,94 sobre US$1.000, en una comparativa fechada 23/08/2025 (más de un año). Las reseñas de 2026 dan 0,4%, 0,8%, 1,5% y 1,59% — cuatro números distintos. Hay que correr la calculadora en wise.com, que muestra el costo exacto antes de confirmar.

2. **Si el pago en pesos de Wise queda correctamente registrado como cobro de exportación de servicios** (dos boletos, código A22). El propio blog de Wise dice que acredita "en pesos, a través de una transferencia local". Si es una transferencia local, no es un ingreso por el mercado de cambios, y eso no cierra con lo que exige el 2.2.2.1. Es la pregunta técnica más importante que me quedó abierta y no la pude resolver con fuentes públicas.

3. **Nubank: no lo investigué.** Lo tenía en la lista y no llegué. No sé si permite transferencias internacionales salientes desde Brasil ni a qué costo.

4. **dLocal: busqué y no encontré nada** sobre requisitos de volumen mínimo ni condiciones para una empresa del tamaño de MaKo. Es un proveedor orientado a empresas grandes y no publica tarifas; probablemente haya que pedirlas.

5. **La lista oficial de países prohibidos de Mercury.** Argentina no aparece en ninguna de las listas de terceros que vi, pero no entré a la página de Mercury. No afirmo que podés abrir cuenta.

6. **La comisión vigente de Deel por retiro a Argentina.** Las fuentes se contradicen (US$0 vs "según plan") y la que dice US$0 tiene ~416 días.

7. **El límite de Wise de US$18.000 por transferencia y por mes** viene de El Cronista, no de Wise. Sin confirmar en la fuente.

8. **Si existe algún mínimo exento de la obligación de ingresar** los cobros de exportación de servicios. Busqué en el texto ordenado y no encontré una franquicia por monto chico, pero no revisé las 213 páginas completas. Puede existir y no la vi.

9. **El texto vigente del artículo 94 de la Ley de Ganancias** para dividendos de fuente extranjera. El dato de "escala progresiva hasta 35%" viene de un blog (Rankia, 2026) que cita el artículo, no del texto legal. La Ley 27.743 (2024) modificó cosas y no verifiqué el texto consolidado.

10. **La alícuota real del IOF brasileño hoy** (3,5% o 1,1%, y si aplica a dividendos). Las fuentes se contradicen abiertamente sobre el efecto del fallo del STF, y ninguna trató dividendos.

11. **La retención paraguaya sobre honorarios a no residentes.** Las guías dan 15% y ~10% efectivo. La única fuente oficial que leí (DNIT) confirma el IDU de dividendos (8%/15%) pero no me dio la de honorarios.

12. **En qué jurisdicción vivís.** Es un dato tuyo, no de internet, y define si una donación de tu hermana pagaría el Impuesto a la Transmisión Gratuita de Bienes: sólo lo cobra la Provincia de Buenos Aires (Ley 14.044). Si vivís en PBA la respuesta cambia.

13. **Los mínimos y exenciones del ITGB bonaerense.** No los busqué.

14. **El tipo de cambio efectivo que da cada plataforma, medido.** Todo lo que hay son afirmaciones de las propias plataformas ("hasta 2% más", "hasta 3% más"), y la comparativa más concreta que encontré (CriptoTendencia, 01/09/2026) es contenido patrocinado por Lemon que no publica los valores absolutos del MEP ni del oficial de ese día. La única forma honesta de saberlo es simular la misma operación el mismo día en tres plataformas y anotar el resultado.

**Para el contador**

**1) ¿El 2.2.2.1 me alcanza y me alcanza como estoy hoy?**
Mostrale el texto ordenado del BCRA "Exterior y Cambios", punto 2.2.2.1, versión 8a, Com. "A" 8481, vigencia 15/09/2026, y preguntale: facturando yo desde Argentina con factura E por suscripciones de software a clientes del exterior, ¿puedo cobrar en dólares a mi cuenta en dólares en un banco argentino sin pesificar, sin tope, y sin que el banco me cobre comisión? ¿Qué código de concepto de servicio corresponde a un SaaS por suscripción? ¿Y qué significa en mi caso concreto la condición ii), "que la utilización de este mecanismo deberá resultar neutra en materia fiscal"? Es la condición más vaga de la norma y no la entiendo.

**2) Los 20 días hábiles: ¿cómo los cumplo con una pasarela que me liquida por lotes?**
El punto 2.2.1 me da 20 días hábiles desde que percibo la plata en el exterior para ingresarla. Si la pasarela acumula cobros de suscripciones y me liquida cada 15 días o cada mes, ¿desde cuándo cuentan los 20 días: desde que el cliente paga, o desde que la pasarela me libera el dinero? ¿Y si quedo con saldo en la pasarela al cierre del mes, estoy en incumplimiento? Esto define si puedo usar una cuenta en el exterior como colchón o si tengo que girar todo apenas entra.

**3) Si facturo a través de una sociedad del exterior, ¿me cae el artículo 130?**
Hacele el test del artículo 130 de la Ley de Ganancias a los tres escenarios: LLC en EE.UU. a mi nombre, empresa paraguaya de mi hermana, empresa brasileña de mi hermana. En cada uno: ¿se cumplen las tres condiciones (más del 50% o control económico de residentes argentinos, impuesto pagado afuera menor al 75% del argentino, y falta de organización material y personal propia)? Si se cumplen, ¿termino pagando Ganancias en Argentina sobre la renta de la sociedad aunque no retire nada? Y la pregunta que de verdad importa: **¿qué tendría que tener esa empresa para pasar el test —empleados, oficina, quién decide— y eso es realista para mi hermana?**

**4) De las cinco formas de que mi hermana me pase la plata, ¿cuál sostiene una inspección, y con qué papeles?**
Sueldo, honorarios con factura E, dividendos, préstamo o donación. Para la que recomiende: ¿qué documentación tengo que tener desde el día uno? Y dos preguntas específicas: (a) vivo en [decile tu jurisdicción] — ¿una donación de mi hermana pagaría el Impuesto a la Transmisión Gratuita de Bienes de la Provincia de Buenos Aires, o quedo afuera? (b) si le facturo honorarios, ¿qué monto es defendible por precios de transferencia sin que le quede a la empresa del exterior una utilidad que después no puedo sacar?

**5) ¿Cobrar en USDT/USDC es lo mismo que cobrar dólares, sí o no?**
Si uso Bitso, Lemon o Takenos, me acreditan stablecoins, no dólares bancarios. Preguntale derecho: ¿eso cumple el requisito i) del 2.2.2.1 ("cuentas en moneda extranjera en entidades financieras locales")? ¿La tenencia de USDT al 31/12 entra en Bienes Personales y su venta genera resultado gravado en Ganancias? ¿Y cambia algo que desde principios de 2027 ARCA reciba información de billeteras del exterior por el CRS ampliado? Si la respuesta es que no cumple, el riel más barato queda descartado y quiero saberlo antes de armar nada encima.
