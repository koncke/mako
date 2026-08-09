# El embudo real de MaKo: el SaaS no es el negocio, es el filtro

*Síntesis de 4 frentes con verificación adversarial, 09/08/2026. Documento maestro: `docs/costos-ia-y-planes.md`. Cada número dice **medido** (de este repo o de datos propios), **publicado** (fuente externa con URL y fecha) o **supuesto** (puesto por el analista o por el dueño).*

---

## 1. El reencuadre, en cinco líneas

1. El SaaS de US$47/97 deja de ser el producto y pasa a ser el **calificador** de una oferta de US$4.000: el que paga se identifica solo, y la llamada regalada es el mecanismo de traspaso.
2. Eso cambia el LTV, pero **no como suma**: la llamada se le regala a TODOS los que compran, asciendan o no, así que entra como **costo por comprador**, del lado negativo.
3. El recurso escaso deja de ser la plata y pasa a ser **la agenda del dueño**. El ascenso está topeado por el calendario; los canales de volumen, no.
4. Por eso el ascenso **no sirve para justificar canales de volumen**: le sube el techo de CAC a los primeros K compradores del mes y a los demás no les sube nada.
5. Y el modo de falla no es el fracaso: **cuanto mejor funciona el ascenso, antes satura**. El escenario de éxito rompe el diseño actual antes que el de fracaso.

---

## 2. El LTV completo y los techos de CAC

### La fórmula

```
LTV = C_sub  +  t · [ P₁·M₁ + (1−P₁)·P₂·M₂ − c_llamada ]
```

| Parámetro | Valor | Estatus |
|---|---|---|
| **C_sub Pro** | US$41,25/mes × vida útil | **medido** (neto Paddle US$43,77 − IA US$2,52 del mes normal) |
| **C_sub Growth** | US$65,69/mes × vida útil | **medido** (US$90,87 − US$25,18) |
| **Vida útil** | 12 meses (cobro cross-border roto) / 20 meses (arreglado) | **supuesto** — el doc lo escribe como condicional, no como medición |
| **t** (agenda × se presenta) | 0,75 | **supuesto** — sin fuente |
| **M₁ vista CAJA** | US$3.800 (4.000 − 5% − US$0,50 de Paddle) | **medido** (tarifa Paddle publicada) |
| **M₁ vista CAPACIDAD** | US$2.300 (3.800 − 15 h × US$100/h) | **supuesto ×2** — ni las horas ni el precio de la hora existen |
| **M₂ grupal** | US$1.425 caja / US$1.125 capacidad | **supuesto** |
| **P₂** (compra el grupal el que no compró el 1a1) | 5% | **inventado** |
| **c_llamada** | US$150 (1,5 h × US$100) en capacidad · **US$0 en caja** | **supuesto** |

> ⚠️ **Las dos vistas no son dos escenarios: son dos fórmulas distintas.** En la vista CAJA `c_llamada = 0` y por lo tanto **no existe break-even**: cualquier ascenso mayor a cero suma. En la vista CAPACIDAD la hora del dueño cuesta, y ahí sí hay un umbral. Toda cifra de abajo dice cuál de las dos está usando.

### Lo que el ascenso le agrega al LTV de CADA comprador

| P(asciende) | vista CAPACIDAD | vista CAJA |
|---|---|---|
| 1% | **−US$53** | +US$81 |
| 3% | −US$20 | +US$139 |
| **4,18% — break-even** | **US$0** | +US$164 |
| 5% | +US$14 | +US$193 |
| 7% | +US$48 | +US$249 |
| 10% | +US$98 | +US$333 |
| 15% | +US$182 | +US$473 |

**Debajo del 4,2% de ascenso la llamada destruye valor.** A 1%, el LTV del Pro es *menor* con llamada que sin ella.

### El break-even es brutalmente sensible al precio de la hora — y esa cifra no la puso nadie

El error que hay que no cometer: subir el precio de la hora solo en el costo de la llamada. La hora sube **en todos lados**, también en la entrega del 1a1, que es donde más pesa.

| Valor de la hora del dueño | Break-even de P₁ (15 h de entrega) |
|---|---|
| US$50/h | **0,4%** |
| US$100/h | **4,2%** |
| US$150/h | **11,7%** |
| US$200/h | **34,1%** |

| Horas de entrega del 1a1 (a US$100/h) | Break-even de P₁ |
|---|---|
| 5 h | 2,9% |
| 15 h | 4,2% |
| 25 h | 7,5% |
| 40 h | **nunca** — M₁ se vuelve negativo |

**Sin grupal**, el break-even a US$100/h sube de 4,2% a **6,5%**. El grupal aporta poco en plata (~US$40-70 por comprador) pero es lo que separa un umbral cómodo de uno ajustado.

### El dato que no depende de ninguna de esas perillas

**US$150 de llamada son 3,6 meses de contribución de un Pro** (150 / 41,25) y **2,3 de un Growth**. Con la vida útil de 10-12 meses que produce el cobro roto, **un comprador Pro que cancela en el mes 4 pagó la llamada y nada más**. Hoy no hay nada que lo impida, y es exactamente lo que hace un curioso.

### Los techos de CAC, y por qué el número del doc no se puede multiplicar

⚠️ **El doc da tres techos del Pro incompatibles (US$104 laxo, US$53 estricto, US$49-97) y no publica la derivación de ninguno.** No hay fórmula, ni k, ni regla LTV:CAC en el archivo. No se puede tomar un número sin derivación y multiplicarlo por un uplift: hay que rehacerlo con la regla puesta.

**Pro, vista CAPACIDAD, P₁ = 7%:**

| Regla | Vida 12 meses (cobro roto, hoy) | Vida 20 meses (cobro arreglado) |
|---|---|---|
| Payback ≤ 3 meses | US$124 | US$124 |
| LTV:CAC 3:1 (estándar de industria) | **US$181** | **US$291** |
| Break-even (CAC = LTV) | US$543 | US$873 |
| *Referencia del doc, sin derivación* | *US$55-70* | *US$104* |

**Growth, mismas reglas, P₁ = 7%:** payback 3m US$197 · 3:1 con 12 meses US$278 · con 20 meses US$454.

> **El techo del doc es entre 1,6× y 2,6× más estricto que la regla 3:1 estándar.** Eso no está mal necesariamente —un negocio sin capital prefiere payback corto— pero **es una decisión, no un dato**, y hoy gobierna el veredicto de un canal entero sin estar escrita en ningún lado.

### La regla que evita el error caro

> **El ascenso levanta el techo solo hasta la capacidad de llamadas.** Comprador N.º K+1 del mes: no recibe llamada, no asciende, y su techo de CAC es el de solo-suscripción.

De ahí sale el criterio operativo, y es de una línea:

- **Canales que se topean** (referidos, WhatsApp con guion propio, invitaciones manuales): se gobiernan con el techo **con ascenso**.
- **Canales que escalan** (carrito, cualquier cosa con presupuesto de medios): se gobiernan con el techo de **solo suscripción**, porque su comprador marginal nunca ve la llamada.

Y el corolario contra el que no hay defensa: **contabilizar la hora del dueño en cero (vista CAJA) deja de ser cierto exactamente cuando el canal empieza a funcionar.** El carrito escala volumen y el volumen es lo que rompe la premisa que hace cerrar al carrito. Es un círculo, no una escalera.

---

## 3. La cadena única

```
  TOFU (5 puertas, distinto costo y calidad)
  ┌──────────────────────────────────────────────────────────┐
  │ 1 CTWA          2 Prospección   3 Orgánico               │
  │   (mensajes)      fría (chatbot)   (IG/YT)               │
  │ 4 Referidos     5 Carrito a la landing                    │
  └───────────────────────┬──────────────────────────────────┘
                          │   ← acá termina lo que cambia por canal
          ┌───────────────┴───────────────┐
          ▼                               ▼
   REGISTRO FREE                   COMPRA DIRECTA
   [dato: no existe                [CAC US$76-179 · publicado+supuesto]
    conversación→registro]         [BLOQUEADO: no hay /registro,
          │                         /checkout, /precios ni billing — medido]
          ▼
   UPSELL IN-APP  ── free→pago: mediana 8%, freemium 3-5% bueno
   [muro de conexión /  (n=200 productos B2B, ChartMogul+Growth Unhinged
    dosis diaria]        +ProductLed, ene-2026 · publicado)
          │
          └───────────────┬───────────────┘
                          ▼
                   ✦ COMPRÓ (US$47 / US$97) ✦
                          │
                          ▼
              [ se le regala la llamada ]
                          │
             comprador → agenda: ⛔ SIN FUENTE. Ninguna.
                          ▼
             agenda → se presenta: 6,5% de no-show global
             (n=6.428 reuniones B2B, 15 industrias, RevenueHero · publicado)
             y el corte que manda es el TIEMPO, no la relación:
             mismo día ~7% · día siguiente ~10% · 8+ días >23%
                          ▼
                   LLAMADA 1 A 1 (1,5 h cargadas)
                          │
             llamada → compra: ⛔ NO EXISTE BENCHMARK PARA ESTA CELDA.
             Lo más cercano con método: PQL→pago 30% para ACV
             US$1.000-5.000 (ProductLed, encuesta 600+ SaaS,
             AUTORREPORTADO) — pero mide software→software y un lead
             que PIDIÓ la llamada. Acá la oferta es una sorpresa.
                          ▼
              HIGH TICKET US$4.000  (o grupal US$1.500)
```

### La honestidad sobre el eslabón que decide todo

**De los tres eslabones post-compra, uno tiene fuente y dos no.** El show-up está medido con muestra publicable. "Comprador → agenda" no tiene fuente de ningún tipo. "Cierra el 1a1" tampoco: el rango de 10-30% que circula viene de páginas comerciales de agencias que venden ese servicio, y una de ellas —la que se usó para armar el número— **no publica ni la definición ni la separación entre frío y tibio**; el contraste "1,5-2% frío vs 15-25% tibio" que se le atribuyó **no está en esa página**.

Las tres familias de benchmarks que aparecen al buscar están todas rechazadas:

| Claim | Por qué se rechaza |
|---|---|
| «Upsell SaaS 20-30% anual» (ProfitWell) | Sin muestra ni metodología. Y **ni siquiera es el mismo número**: es share de MRR de expansión, no % de clientes que ascienden. Además mide saltos de 1,2×-2×; acá el salto es 85× sobre el mensual |
| «60-70% de probabilidad de venderle a un cliente existente» (*Marketing Metrics*) | Afirmación de manual. Se buscó la fuente primaria y **no existe**: solo repetición circular en blogs |
| «10× más probable de comprar la oferta central tras un tripwire» (Deiss) · «5×» de PQLs (OpenView) | Material del vendedor sobre su propio método / anécdota de portafolio |

**Banda de planificación: 5-12%, base 7% [supuesto, no estimación].** Es una cadena reconstruida y castigada porque la oferta aparece al final de un regalo, no porque haya un dato. Queda **2,8 puntos arriba del break-even de 4,2%**: el diseño funciona sin margen de error, y con la hora a US$150 ya no funciona.

> **Esto no se resuelve con más research. Se resuelve con 30 llamadas propias.**

### El mecanismo sí tiene nombre, aunque no tenga número

Lo que describe el dueño es un **modelo de ascensión con tripwire** (marketing directo) y **foot-in-the-door** (Burger 1999, *Personality and Social Psychology Review* 3(4):303-325 · **publicado**): quien aceptó una petición chica se auto-clasifica como alguien que le compra a MaKo, y la llamada opera sobre esa identidad. Sirve para **diseñar**. No sirve para **proyectar**.

---

## 4. Los cinco canales

### Costo por cliente PAGO, y el costo en horas

| # | Canal | US$ por cliente pago | Horas del dueño | Señal | Estatus del número |
|---|---|---|---|---|---|
| 4 | **Referidos** | ~US$8 (premio en crédito: 15.000 MT ≈ US$7,56 de costo real de IA) | **0** por cliente | meses | costo **medido**, diseño **supuesto** |
| 1 | **CTWA** | **US$83** base | ~0 recurrente (el guion se escribe una vez) | **días** | **supuesto**: 30% conv→registro × 6% free→pago, ninguna de las dos medida |
| 5 | **Carrito** | **US$76-179** | 0 | días — *después de construirlo* | CPC y aprobación **publicados**; tasas **supuestas** |
| 2 | **Prospección fría** | US$0 en dólares | alta varianza | semanas | **medido** el costo, **incalculable** el riesgo |
| 3 | **Orgánico** | **indefinido** (0 clientes hasta el mes 6) | **la misma hora que entrega el 1a1** | 6-12 meses | sin cifra honesta disponible |

### Ranking por lo que de verdad escasea: la hora del dueño

**Referidos ≈ Carrito ≈ CTWA (≈0 h/cliente)  ≫  Prospección fría  ≫  Orgánico.**

El orgánico es el peor de los cinco por una razón estructural, no por su costo: **consume exactamente la misma hora que entrega el high ticket**. Ojo con el argumento circular, igual: hoy, con tres clientes, la agenda está vacía y la hora marginal no vale US$4.000 — vale lo que valga la siguiente mejor actividad. El orgánico se descarta como **adquisición** porque no puede dar señal antes de 6 meses, no porque su hora esté cara hoy.

### Correcciones de hecho que hay que llevarse

- **No hay número honesto de "US$1.600 por cliente" para el orgánico.** Salía de multiplicar tres cifras inventadas (32 h/mes, US$100/h, 2 clientes/mes). El único ancla de esfuerzo con muestra es Orbit Media (3 h 25 min por pieza, n=808, ago-2025 · **publicado**) y mide escribir un post de blog.
- **El "0,30% de engagement en Instagram" (Rival IQ/Quid 2026 · publicado) no es un techo de alcance.** La muestra son 150 empresas por industria sobre marcas establecidas, no segmenta por tamaño de cuenta, y el engagement **por seguidor** no dice nada del alcance en plataformas que distribuyen a no-seguidores (Reels, recomendaciones de YouTube). Para un canal cuya tesis es el descubrimiento, es la métrica equivocada.
- **El carrito está bloqueado por código, no por precio** [**medido**]: no existen `app/registro`, `app/checkout` ni `app/precios`, y el único hit de Stripe en todo el repo es un regex que tapa claves en los logs (`lib/agente-redaccion.ts:49`).
- **Los topes anti-ban de la prospección no son un techo del canal** [**medido**]: `lib/nutricion.ts:98` es `process.env.NUTRICION_MAX_POR_DIA ?? '40'` — un default de entorno que se cambia en Vercel en treinta segundos. Los que sí son constantes duras son `HS_MIN_ENTRE_MSGS=20`, `HS_MIN_PREPARACION=3`, `TZ_OFFSET_MX=−6` y la ventana 9-21.
- **Sobre referidos, la evidencia dice lo contrario de lo intuitivo.** Ryu & Feick (*Journal of Marketing* 71(1):84-94, 2007 · **publicado**), textual: *para vínculos débiles y marcas débiles conviene premiar a quien PROVEE la recomendación*; el premio al referido rinde con marcas fuertes. MaKo es marca débil. **El peso del premio va del lado del que recomienda**, no del referido. Y Schmitt/Skiera/Van den Bulte (*JM* 75(1):46-59, n≈10.000, banco alemán · **publicado**) miden que el referido vale ≥16% más y churnea ~18% más lento — pero es **matching sobre observables, no aleatorización**: el programa selecciona clientes mejores, no los fabrica.
- **Todos los benchmarks de referidos de GrowSurf, Cello y Talkable están rechazados**: son vendedores de software de referidos publicando sobre su propio producto, sin muestra ni metodología.

### Veredicto sobre la prospección en frío: no es "riesgosa", está prohibida

**Política de Meta** (whatsappbusiness.com/policy/, verificado 09/08/2026 · **publicado**), verbatim: *«You may only contact people on WhatsApp if: (a) they have given you their mobile phone number; and (b) you have received opt-in permission from the recipient…»*. Una base comprada no cumple ninguna de las dos. Y la documentación de opt-in de Meta enumera dónde se puede recolectar permiso —SMS, web, IVR, papel— y **WhatsApp no está en la lista**: tampoco se puede mandar un mensaje frío *pidiendo* permiso. La sanción es textual: *«we may prohibit you and your organization from all future use of WhatsApp products and services»*.

**El mecanismo real de muerte no es una revisión humana: es la tasa de bloqueo/reporte**, que estrangula la entrega antes de que exista una violación formal.

**Y el camino barato agrava todo:** Evolution API self-hosted no es un WhatsApp con reglas más laxas — es un cliente no autorizado, sin apelación y sin SLA. Si cae, se pierde el número. **Y el número de WhatsApp de MaKo no es un canal de campaña: es el soporte, la venta, el onboarding y el producto** (el doer de MaKo entra por ahí).

**La ley, y son dos leyes distintas, no "la ley de datos de LATAM":**

| País | Situación |
|---|---|
| **Colombia** | **Ilegal de frente.** Ley 1581/2012 art. 9: autorización *previa e informada*, obtenible por medio consultable después. No existe consentimiento tácito. Encima Ley 2300/2023, ampliada en 2024 a mensajería web (WhatsApp explícito): horarios L-V 7-19, sábado 8-15, un contacto por día, prohibido usar más de un canal por semana, y Registro Nacional de Exclusión en la SIC |
| **México** | **Defendible pero angosto.** La nueva LFPDPPP (DOF 20/03/2025) mantiene el consentimiento **tácito** si el aviso de privacidad se puso a disposición — pero eso, por definición, no pasó cuando el primer contacto ES el mensaje frío. Tope de multa 320.000 UMA (≈ MXN 37,5 M). Y la LFPC art. 18 bis + REPEP de PROFECO es una segunda ley que nadie mira |

**Recomendación: no hacerla en Colombia. En México, solo con aviso de privacidad accesible desde el primer mensaje, opt-out en ese mismo mensaje, cruce contra REPEP, número dedicado y media hora de abogado antes de gastar un peso** — la exposición máxima es dos órdenes de magnitud mayor que todo el presupuesto de adquisición del año. Y modelarla no como "barata" sino como **una apuesta cuyo costo esperado es P(perder el número) × el valor del canal entero**.

### Orden de arranque

1. **CTWA** — único que da señal en días, y su eslabón sin dato (conversación→registro) se mide con US$300-500 de gasto real.
2. **Referidos en paralelo desde ya** — cuesta ~US$8 en crédito de producto y no consume horas. No esperar volumen con base 3: se construye ahora porque es barato y rinde a los 50 clientes.
3. **Carrito**, el día que existan `/registro` y `/checkout`. Antes, la campaña lleva tráfico a una puerta que no abre.
4. **Orgánico como prueba social**, no como adquisición, con tope de horas explícito y contenido reusable como creativo de CTWA. El que va a pagar US$4.000 va a buscar quién sos antes.
5. **Prospección fría**, última, acotada por país, o directamente no.

---

## 5. Los momentos de upsell dentro de la app

### Primero, una decisión pendiente que bloquea el catálogo

⚠️ **El documento maestro define DOS límites del Free que no son compatibles y no dice cuál manda:**

- **Paso 5:** bolsa de **600 MT por única vez** (1 MT = US$0,001). Con eso: 600 mensajes a MaKo, 60 extracciones de reunión, 7 imágenes. **Haciendo texto, el Free no choca nunca.**
- **Paso 6 ("El diseño recomendado"):** **dosis diaria de 3-5 acciones, no acumulables** (molde Lovable). Con eso, el Free choca el muro **el día 1, en la sexta acción**.

**El que ata es la dosis diaria. Hay que decidirlo antes de escribir un solo copy**, porque el momento M3 existe o no existe según cuál sea.

Y el bloqueante de fondo: **hoy "se te acabaron los tokens" es inconstruible porque no hay contador.** No hay tabla de créditos, no hay columna `workspaces.plan`, no hay `lib/planes.ts` y no hay billing [**medido**].

### Los momentos

**M0 — POST-COMPRA. El que vale más que todos los otros juntos y no estaba en la lista.**
Superficie: pantalla de "gracias por tu compra", el mismo día. Es el único momento cuyo valor esperado se mide en miles de dólares, y el show-up está medido: **la variable que más manda es la distancia temporal, no la relación** (mismo día ~7% de no-show, 8+ días >23% · RevenueHero, n=6.428 · **publicado**).
> *«Ya está: MaKo es tuyo. Ahora la parte que no es software. Te regalo una hora conmigo para mirar tu negocio con los datos que MaKo ya tiene. Elegí el horario — hay lugares esta semana.»*

Botón: **«Elegir mi horario»**. Objetivo operativo: **mediana compra→llamada ≤ 2 días**, y alerta si algo queda agendado a más de 5. Va por WhatsApp con el teléfono ya verificado por OTP (`lib/mako-grupo.ts`), que es el canal por el que entró.
⚠️ Hoy no hay dónde ponerlo: el doc marca como bloqueante que *no hay nada entre el "gracias por tu compra" y el primer login*.

**M1 — CONECTAR UNA INTEGRACIÓN** (Fathom, Meta, WhatsApp de empresa). Superficie: `/integraciones` y el paso "Conectar" del onboarding de cada tab.
> *«Para que MaKo trabaje sin que abras la app, la conexión tiene que quedar viva. En el plan gratuito MaKo analiza cuando se lo pedís; con Pro se queda conectado a Fathom y cada reunión nueva entra sola al plan.»*

Botones: **«Activar Pro y conectar Fathom — US$47/mes»** / **«Seguir cargando reuniones a mano»**.
⚠️ **El gate se escribe DENTRO del cron y del webhook, no en el botón.** Los crons iteran todos los workspaces (`lib/cron-workspaces.ts`, filtra por integración conectada, **no por plan**) y los webhooks resuelven el workspace por el payload de un tercero: no pasan por la sesión, así que esconder el botón no frena un dólar.
⚠️ **Corrección al argumento, no a la acción:** decir que "la conexión cubre el 100% de las áreas caras" es falso — `lib/crm-auto.ts`, `lib/crm-auto-plan.ts` y `lib/nutricion.ts` no tienen **un solo hit** de IA [**medido**], y Meeting Reader, Ads Analyst y Closing Analyst tienen camino manual a demanda. Lo que está sin techo no es el costo unitario sino el **volumen disparado por un tercero**: el webhook de Fathom no tiene dedup ni cap (`app/api/webhooks/fathom/route.ts:152`).

**M2 — DESPUÉS DE UN RESULTADO GRANDE** (plan de arranque, primera priorización del Perro, primer análisis de llamada). Superficie: **inline DEBAJO del resultado, nunca encima**.
> *«MaKo armó tu plan: 23 tareas priorizadas y con fecha. Mantenerlo al día solo es del plan Pro: cada reunión y cada mensaje entran sin que lo pidas.»*

Botón único: **«Ver qué mantiene Pro al día»**.

**M3 — DOSIS DIARIA AGOTADA** (si se elige la dosis diaria como límite del Free). Chip inline en el lugar de la acción, **jamás modal**.
> *«Usaste las 5 acciones de hoy. Vuelven mañana.»* + link chico *«Sin límite diario con Pro»*.

**M4 — DÍA 11 DEL REVERSE TRIAL, por WhatsApp**, con **inventario** de lo hecho. Es el único que usa el canal por el que el usuario entró, y la aversión a la pérdida es el único motor real del reverse trial.
> *«En 11 días MaKo te armó 23 tareas, analizó 4 llamadas y escribió 7 seguimientos. El viernes se apagan las automatizaciones y tu plan queda como está. Para que sigan andando: [link]»*

Va por `lib/avisos.ts`, que ya es el choke point único con dedup por TTL [**medido**].

**M5 — INVITAR A ALGUIEN DEL EQUIPO** (usuarios 1/3/10). Costo de IA cero, intent alto, y `rol_ws` ya existe.
> *«El plan gratuito es de una sola persona.»* → **«Invitar a 2 personas con Pro»** / **«Seguir solo»**.

**M6 — GENERAR UN MEDIO** (cuando exista; hoy las seis áreas de medios están en `por-construir` [**medido**, `areas.ts:508-553`]). El costo se muestra **antes**, en unidades:
> *«Esta imagen usa 80 de tus 600 MaKo Tokens: te quedan 6 imágenes.»* → **«Generar la imagen (80 MT)»**

Para video, **muro de capacidad y no de cuota**: *«El video no se compra por cuota: viene con Growth.»*
⚠️ **Corrección:** el Pro **sí** puede comprar packs de overage (1.000 MT = US$15, mínimo un pack). Lo que no puede comprar a ningún precio es **video**. El arbitraje lo cierran el techo duro al 200% y esa prohibición, no la ausencia de packs.

### Las cuatro reglas que gobiernan a todos

1. **Un solo prompt de upsell por sesión**, elegido por prioridad del catálogo. Nunca dos.
2. **Inline debajo del resultado, jamás un modal que lo tape.** Es lo único de esta lista con un número detrás: el interstitial de Google+ hizo que **el 69% de las visitas abandonaran la página** contra 9% que apretó el botón; al sacarlo, los activos de 1 día subieron **17%** y las instalaciones cayeron **2%** (blog oficial de Google Search Central, 2015 · **publicado**). Goldstein/Suri/McAfee/Ekstrand-Abueg/Diaz (*JMR* 51(6):742-752, DOI 10.1509/jmr.13.0439 · **publicado**) miden el diferencial compensatorio: en escenarios plausibles el aviso molesto cuesta más de lo que rinde.
   ⚠️ **Pero el mismo caso de Google respalda el cartel PERSISTENTE**: no eliminó el interstitial a cambio de nada, lo reemplazó por un banner fijo de baja fricción y con eso conservó el 98% de las instalaciones. El cartel del sidebar no está condenado por esta evidencia.
3. **Supresión de 30 días tras 2 descartes** del mismo momento (reusar el dedup por TTL de `lib/avisos.ts`).
4. **Ningún muro disparado por un cron o un webhook.** El usuario no lo disparó ni lo puede parar.

### La lista negra: dos cosas que no se pueden gatear

- **Nunca un muro sobre CRM, leads, contactos, historial ni exportación del dato propio.** No ahorra un centavo de inferencia [**medido**: cero hits de IA en `crm-auto.ts`, `crm-auto-plan.ts`, `nutricion.ts`], y bajo el embudo real la base del Free **es el pipeline de la oferta de US$4.000**. Secuestrarla quema el activo. *(No es literalmente cero: filas, storage y egress cuestan, y el doc marca storage/egress como el COGS que nadie presupuestó.)*
- **Los MT se muestran en la unidad del usuario**, no en tokens: *«te quedan 3 Reels»*, nunca *«te quedan 240 tokens»*. Es lo que hizo Synthesia al migrar a créditos y seguir mostrando minutos.

⚠️ Y queda **derogada** la regla del paso 4 de "no mostrar contador de texto": el paso 5 metió el texto adentro de la cuota por decisión explícita del dueño (1 MT = US$0,001, un mensaje = 1 MT). **Si el texto consume cuota, el contador se muestra** — un muro invisible es peor que uno visible.

---

## 6. La llamada

### A quién: por FASE y TICKET, no por plan

**El plan que compró es el peor predictor disponible.** Un Growth de US$97 en Fase 1 no puede pagar US$4.000; un Pro de US$47 en Fase 4 sí. El plan mide cuánta IA consume; la fase mide cuánta plata tiene.

**Y el calificador ya está escrito en el repo** [**medido**, verificado en código 09/08/2026]:

- `lib/fase-diagnostico.ts` → `PREGUNTAS[0]` es literalmente *«¿Cuánto factura tu negocio por mes?»* con tramos $0-3k / $3-10k / $10-30k / $30-80k / $80k+, y las 6 respuestas **crudas** se persisten en `Diagnostico.respuestas` vía `lib/fase-store.ts`, key `negocio.fase.diagnostico`.
- `lib/onboarding.ts:30` pide `oferta_ticket` — «Precio / ticket (USD)» —, la señal más directa de si el cliente está acostumbrado a transacciones de 4 cifras.

⚠️ **Y hoy ese calificador CONTRADICE la venta.** `FASES[0]` (Validación, $0-3k/mes) tiene en `noHacer` la frase textual **«No sumes equipo ni delegues: todavía no hay un proceso que delegar»** y en `estrategia.inversion` dice *«$300 a $600 el primer mes»*. Venderle un 1a1 de US$4.000 a ese cliente es el producto diciendo una cosa y el fundador otra, con las dos pantallas a mano.

**Criterio propuesto, derivado de los tramos que ya existen:**

| Fase / señal | Qué recibe |
|---|---|
| Fase 1 ($0-3k/mes) | El análisis generado por MaKo. **Ninguna oferta paga.** |
| Fase 2 ($3-10k) — cuello = **conversión** | **Grupal US$1.500.** Un cuello de conversión es el mismo problema en todos los negocios de Fase 2: estandarizable, es lo que un grupal resuelve bien y barato |
| Fase 3-5 ($10k+) **y** `oferta_ticket` ≥ US$1.000 — cuello = sistema / delegación / foco | **1a1 US$4.000.** Problema idiosincrático del dueño y su equipo: no se resuelve en grupo |

**Sin diagnóstico → no califica.** Fail-closed, escrito como dato puro en un módulo **sin `server-only`** para que un test lo pueda importar (mismo criterio que `lib/capas.ts`).

🔧 **Bloqueante de implementación** [**medido**]: `getSetting` (`lib/settings.ts:20-27`) está duro-scopeado con `.eq('workspace_id', await wsActual())`, y el diagnóstico es un blob JSON en `app_settings` — no se puede filtrar ni indexar. **Hoy no hay forma de preguntar "qué clientes están en Fase 3+"**. Se arregla promoviendo `fase` y `oferta_ticket` a columnas de `workspaces` en la misma migración que agrega `plan` (la 0125 ya planificada). Es una línea más en una migración que hay que escribir igual.

Verificación gratis: donde haya Meta conectado, **cruzar la facturación declarada contra la inversión observada** antes de la llamada. El diagnóstico es autodeclarado: sirve para calificar, no para verificar.

### Cómo se dice

**Declarar la agenda al principio de la llamada, no en la invitación.** En la invitación deprime el show-up sin comprar nada.

El costo de declarar está medido en la dirección: el Modelo de Conocimiento de Persuasión (Friestad & Wright, *JCR* 21(1):1-31, 1994) y su meta-análisis (Eisend & Tarrahi, *JCP* 32(1):3-22, k=148 · **publicado**) confirman que detectar intención persuasiva activa afrontamiento y empeora la evaluación, con efectos de pequeños a moderados y varianza considerable.
⚠️ **Pero ninguno midió esta celda** —cliente que ya pagó, oferta post-compra, valor entregado primero— y **no se pudo confirmar si el modelo distingue intención declarada de intención descubierta**, que es justo la pregunta. La recomendación es **inferencia razonada, no evidencia**.

El costo de NO declararla, en cambio, es concreto: una intención descubierta a los 40 minutos se procesa como engaño, y **el objeto dañado no es la oferta de US$4.000 — es la suscripción que la persona ya pagó**. Eso no se paga en NPS: se paga en reembolsos y contracargos, que es lo que Paddle mira para dejar la cuenta abierta.

**El molde (upfront contract, primeros dos minutos):**
> *«Antes de arrancar, para que sepas cómo viene la mano: vamos a estar una hora, te voy a mostrar lo que veo en tu negocio con los datos que MaKo ya tiene, y el análisis te lo llevás por escrito digas lo que digas. Si al final veo que te sirve trabajar conmigo te lo voy a proponer, y que me digas que no es una respuesta completa: no cambia nada de lo que ya compraste.»*

Esa última cláusula es la que protege la suscripción, que es el activo en riesgo.
🔧 **Y hay que escribir `/reembolsos` antes de la primera llamada**: hoy no existe ninguna página legal, y es el único lugar donde el cliente puede leer qué pasa si se siente estafado.

### Cómo se ordenan los US$4.000 y los US$1.500: NO como downsell

Ofrecer US$4.000 y ante el no conceder US$1.500 es literalmente **door-in-the-face**, y tiene el meta-análisis más grande y el resultado más incómodo: Feeley, Anker & Aloe (*Communication Monographs* 79(3):316-343, 2012 · **publicado**) encuentran efecto significativo sobre el cumplimiento **verbal** (k=78, r=.126) y efecto **NO significativo** sobre el cumplimiento **conductual** (k=39, r=.052).

**Te compra un "sí" que no transfiere plata.** Y hay un moderador que pega justo acá: la dureza del contexto predice **negativamente** la magnitud del efecto. Los estudios son mayormente voluntariado y donaciones; una transferencia de US$1.500 de una PyME latinoamericana es un orden de magnitud más dura que cualquier celda medida. **La predicción honesta no es r=.126: es ~cero, con el riesgo de inflar el pipeline.**

El modo de falla es silencioso: el dueño sale anotando *«me dijo que sí al grupal»*, lo cuenta como venta blanda, y a los 30 días no hay transferencia — y como el "sí" fue real, el diagnóstico obvio va a ser "problema de seguimiento" cuando el problema fue la estructura.

**Y el miedo a ofrecer dos no tiene respaldo:** Scheibehenne, Greifeneder & Todd (*JCR* 37(3):409-425, 63 condiciones / 50 experimentos, N=5.036 · **publicado**) meta-analizaron choice overload y el efecto medio es prácticamente **cero**. O sea: la razón para ofrecer **uno solo** no es la sobrecarga — **es la credibilidad del diagnóstico.** Recomendar el más barato cuando corresponde es la prueba más barata de que el diagnóstico es real.

**Regla de conteo, desde la primera llamada:** un "sí" al grupal **no es una venta ni pipeline** hasta que hay pago o seña. Se registra como *«sí verbal»* en un campo aparte, que es exactamente la métrica que el meta-análisis dice que se infla. Si el gap entre "sí verbal" y transferencia es grande, la estructura está confirmada como rota y se cambia, no se insiste con recordatorios.

### A partir de qué volumen deja de escalar

El cuello **no son las llamadas de venta: es entregar el 1a1 que vendiste.**

Horas/mes = N × (1,125 h de llamada + P₁ × 15 h de entrega)

| Compradores/mes (N) | P₁ = 7% | P₁ = 15% |
|---|---|---|
| 10 | 22 h | 34 h |
| 20 | 44 h | 68 h |
| 30 | **65 h** | **101 h** |
| 50 | 109 h | 169 h |

| Horas/mes que el dueño le dedica | Techo de N con P₁=7% | con P₁=15% |
|---|---|---|
| 40 h (sigue construyendo el producto) | **18** | **12** |
| 80 h (medio tiempo) | 37 | 24 |
| 160 h (full time, y no construye nada) | 73 | 47 |

> ⚠️ **Cuanto MEJOR funciona el ascenso, ANTES satura.** Subir P₁ de 7% a 15% no da aire: duplica la carga de entrega y **baja el techo de N a dos tercios**. El escenario de éxito rompe el diseño antes que el de fracaso.

*(Los cuatro inputs —15 h de entrega, US$100/h, 1,5 h por llamada, horas disponibles— son **supuestos**, ninguno medido. La tabla es lineal en dos de ellos. El dueño sabe los primeros tres y con eso la tabla se vuelve exacta en cinco minutos.)*

### Las cuatro salidas cuando se llega al techo, ordenadas por barato y reversible

1. **Gatear la llamada** (Growth / anual / 60 días de antigüedad). Gratis, reversible, se hace esta semana. **El anual del Pro (US$470) resuelve tres cosas de una vez:** sube la barrera de calificación, elimina el fallo de rebill que corta la vida útil a la mitad, y hace que los US$150 pesen 32% de la contribución en vez de 364%.
2. **Grupal como default, 1a1 por aplicación.** Una sesión de 1,5 h atiende a 12 en vez de a 1. Y el que llena un formulario ya se auto-calificó, lo que sube el cierre.
3. **Que el análisis lo haga MaKo antes de la llamada.** El producto ya diagnostica fase, Norte, cuello e hito, ya tiene El Archivero y el diagnóstico de landing, y cuesta ~US$0,03. El cliente lee el informe y la llamada baja de 60 a 25 minutos con la agenda ya escrita. **Es la única salida que escala con el producto en vez de contra él**, y de paso es la demo más honesta que existe.
4. **Closer a comisión. Último recurso.** 10-20% sobre US$4.000 baja M₁ de US$2.300 a US$1.500-1.900, **lo que sube el break-even de 4,2% a 7,9-10%** — o sea, por encima de la base de 7%. No se contrata antes de tener el dato de las primeras 30 llamadas.

> **Poner el tope de llamadas/mes en el calendario AHORA, mientras N es chico y no duele.** Nacer con tope es gratis, porque nadie extraña lo que nunca tuvo. Sacarle la llamada 1a1 a clientes que ya la tenían es la conversación que no se gana.

### Sobre el precio: no bajarlo, y no hace falta subirlo

Cada comprador consume US$150 de tiempo que no escala, así que **bajar el precio multiplica exactamente el costo que no se puede multiplicar**. En el límite, un front-end de US$9 sería un negocio que *paga* por cada persona que entra.

Los dos comparables directos —software con backend de coaching high ticket— **no tienen un escalón debajo de US$97** [**publicado**, verificado 09/08/2026]: ClickFunnels (Launch US$97 / Scale US$197 / Optimize US$297 / Dominate US$5.997 anual, **sin plan gratis**, trial 14 días) y GoHighLevel (US$97 / US$297 / US$497, sin plan gratis, trial 14 días).

⚠️ **Pero el mecanismo que se suele invocar es falso.** «Lo que pagaste gobierna cuánto usás» **no está** en Gourville & Soman (*JCR* 25(2), 1998): ese estudio varía **cuándo** pagaste, no **cuánto** — todos los socios tenían el mismo precio anual. La prueba directa existe y dice lo contrario: **Ashraf, Berry & Shapiro, «Can Higher Prices Stimulate Product Use?», *American Economic Review* 100(5):2383-2413, 2010** (~1.260 hogares, precios asignados **al azar**, uso medido objetivamente · **publicado**): efectos de **selección** económicamente importantes, y **ninguna evidencia consistente de efecto de costo hundido**. El precio alto **selecciona** a quien iba a usar más; no hace que nadie use más.

**Para calificar al high ticket, la selección alcanza y sobra.** No hace falta el mecanismo causal, que además es falso.

**Conclusión: no toques el Pro a US$47** —subirlo rompe el canal WhatsApp, que es el único que hoy cierra su CAC—. **Mové la perilla reversible, que es quién recibe la llamada.** Si a los 60 días el ascenso del Growth/anual está arriba del 10% y el del Pro mensual no llega al 4%, el dato dice que la llamada nunca debió ser universal, y ahí sí se discute el precio con evidencia.

---

## 7. Qué instrumentar, en orden

**El orden importa: los tres primeros van adentro del registro, que se está por escribir. Después cuestan una migración y un backfill imposible.**

1. **Columna `origen` en `workspaces`**, sellada en el REGISTRO y nunca reescrita. Catálogo cerrado de 5 valores (`ctwa`, `prospeccion`, `organico`, `referido`, `carrito`) más el id crudo del canal. **First-touch, no last-touch**: si fuera de último toque, WhatsApp se lleva el crédito de todo por ser el canal que más re-toca. El código de referido escribe **el mismo campo** con `referido:<ws_id>`, no una tabla aparte, o hay dos verdades.
2. **Link de alta trackeado POR CONVERSACIÓN** en lo que manda el chatbot. Es lo único que mide **conversación→registro**, el eslabón sin dato público y de mayor apalancamiento del modelo entero. **Y no depende de ningún upstream**: no hace falta el `ctwa_clid` de nadie para atribuir el alta de MaKo. Esa es la ruta barata; la cadena Meta→Chatwoot/Evolution es la cara.
3. **Los tres contadores del ascenso, en el CRM que MaKo ya tiene** (`leads`, `pipeline_stages`, `funnel_config`): comprador → **agendó** → **se presentó** → **compró el 1a1**. Con fecha de compra, fecha de llamada, días entre las dos, fase diagnosticada, ticket declarado, si hubo oferta y resultado a 30 días. **Sin esos tres contadores no hay forma de saber en qué fila de la matriz de la sección 2 está el negocio**, y toda la decisión de precio cuelga de eso. Estados `llamada_1a1` y `high_ticket` en el workspace.
4. **Separar churn voluntario de involuntario desde el día 1.** Juntos, el fallo de rebill cross-border es indetectable y se lee como «los clientes se van». Es lo que corta la vida útil de 20 a 10-12 meses y con eso el techo de CAC a la mitad.
5. **Conversions API con tres eventos**: registro, pago **y llamada agendada** — este último es el que predice el ingreso real. Con `action_source=business_messaging` + `messaging_channel=whatsapp` + `ctwa_clid` donde se pueda. Sin esto, Meta optimiza por conversaciones baratas y el tablero informa mejora mientras el CAC sube.
6. **Eventos de producto post-registro.** ⚠️ El agujero es **específicamente post-registro**: `posthog|amplitude|mixpanel|@vercel/analytics` sobre `lib/`, `app/` y `package.json` da **1 hit y es prosa dentro de un curso** [**medido**], y ninguna de las ~72 tablas de migraciones es de eventos de producto. Pero **arriba del registro sí está instrumentado**: `landing_visits` y `vsl_events` (migs 0008, 0061, 0121) ya cubren el canal 5. No reconstruir lo que existe. Cinco eventos por momento: `muro_chocado` (lo emite el server, puede no tener a nadie mirando), `upsell_mostrado`, `upsell_click`, `upsell_descartado` (con tiempo hasta el descarte), `checkout_pagado`, todos con `{momento_id, plan_actual, superficie, ws, sesion}`.
7. **«Sí verbal» y «transferencia» como campos separados** en el grupal.

**Realismo sobre lo que esto va a decidir:** con 3 clientes y sin plan gratuito todavía, ningún A/B entre seis momentos llega a significancia en meses. Lo que sobrevive es la **regla de orden** —instrumentar antes de lanzar, porque el histórico no se retrofitea—, no la promesa de decidir por datos este trimestre.

**Dónde vive todo esto:**
- El modelo y sus 5 parámetros (`t`, `P₁`, `P₂`, `M₁`, `c_llamada`), con las dos vistas como salidas **separadas y con el nombre puesto** —`cajaHoy` y `capacidadEnRegimen`—, van a `app/admin/dev/pricing/modelo.ts`, junto a `TARIFA` y `PERFILES`. Es la misma trampa que el doc ya documenta con `cost_usd`: un número que parece medición y es una convención.
- Esta sección escrita va a `docs/costos-ia-y-planes.md` como paso nuevo.
- Las **trampas de método** —el «60-70%» sin estudio detrás, el «upsell 20-30%» que mide otro salto de precio, el efecto de costo hundido que el experimento de Zambia refuta, y la doble contabilidad caja/capacidad— van al documento de hallazgos del área que corresponda. Son exactamente el tipo de diagnóstico obvio-pero-equivocado que se vuelve a cometer.

---

## 8. Lo que NO se pudo verificar

**Ordenado por cuánto gobierna el resultado.**

1. **P₁ (tasa de ascenso) no tiene fuente. Ninguna.** Se verificó que **no existe benchmark publicado** para «suscriptor de SaaS de US$47-97 → programa 1a1 de US$4.000». La banda 5-12% es una cadena reconstruida cuyos tres eslabones son: uno inventado (comprador→agenda), uno mal atribuido (tasa de cierre) y uno sourceado (show-up). **Es el número que decide todo el análisis y es el más débil.** Se resuelve con 30 llamadas propias.
2. **El valor de la hora del dueño (US$100/h) lo puso el analista, no el dueño.** Toda la vista CAPACIDAD cuelga de eso, y la sensibilidad es no lineal: **break-even 0,4% a US$50/h, 4,2% a US$100/h, 11,7% a US$150/h, 34,1% a US$200/h.** Arriba de US$150/h la llamada universal deja de cerrar contra la base de 7%. **Ese número lo tiene que poner el dueño.**
3. **Las horas de entrega del 1a1 (15 h) son supuestas y nadie dijo qué incluye el programa.** A 40 h, M₁ en vista capacidad se vuelve negativo y **el high ticket no aporta nada al LTV**: solo transforma tiempo en plata a ~US$95/h. Es el supuesto con más apalancamiento después de P₁.
4. **P₂ (grupal) al 5% es inventado, y el grupal ni siquiera está decidido** («luego también evaluar el grupal»). Aporta poco en plata pero es lo que separa un break-even de 4,2% de uno de 6,5%.
5. **P₁ se asumió igual para Pro y Growth, y casi seguro no lo es.** El que paga US$97 tiene más chance de comprar US$4.000. Si el Growth asciende al doble, **el ruteo de canales del doc hay que rehacerlo** y la matriz de la sección 2 queda a mitad de camino.
6. **La vida útil (10-12 / 20 meses) es derivación, no medición.** El doc lo escribe como condicional textual: *«SI el fallo de renovación suma 3-5 puntos al churn…»*. **No hay un solo cliente pago con historial de churn**: son tres clientes que el dueño conoce por nombre y ninguno paga por el camino que se está diseñando.
7. **Los techos de CAC del doc (US$104 laxo, US$53 estricto, US$49-97, Growth US$194-381) no tienen derivación publicada.** No hay fórmula ni regla LTV:CAC en el archivo, y ninguno reproduce un múltiplo estándar. Los de este documento se rehicieron con la regla escrita al lado.
8. **El costo de IA del Pro tiene tres valores distintos en el mismo doc**: US$1,87 (paso 3), US$3,57 (paso 4) y US$2,52 (paso 5, medido sobre 2.249 llamadas). Acá se usó US$2,52. La diferencia mueve la contribución ~US$1/mes: no cambia ninguna conclusión, pero hay que unificarlo antes de meterlo en `modelo.ts`.
9. **El límite del plan Free está sin decidir**: 600 MT por única vez (paso 5) contra dosis diaria de 3-5 acciones (paso 6). Son incompatibles y el catálogo de momentos depende de cuál sea.
10. **No se verificó el margen real del 1a1 ni del grupal** contra plataforma, materiales, asistente ni reembolsos. Solo se descontó la comisión de Paddle. **Si hay garantía de devolución —que en high ticket es lo normal— falta descontar la tasa de reembolso**, y en programas de US$4.000 no es despreciable.
11. **Chatwoot #13995 está CERRADO como `completed` desde el 16/06/2026.** O sea que puede haber entrado soporte de `referral` de CTWA hace dos meses. El que sigue abierto y sí es del Cloud API es el **#12560**; el #14047 es del canal **Twilio**, no del Cloud API. **Antes de construir un webhook propio, probar con un mensaje real desde un anuncio CTWA** — media hora, y decide si hace falta.
12. **`evolution-api#2645` sigue abierto** (creado 15/07/2026, sin respuesta de mantenedor) y dice textualmente que el objeto emitido en `messages.upsert` descarta el `referral` entero. **URL correcta: `EvolutionAPI/evolution-api`**, no `evolution-foundation/`.
13. **La tarifa de plantilla de marketing en México no está confirmada**: el doc dice US$0,0305 y circula US$0,0436 (que huele a tarifa vieja — Meta bajó las de México efectivo 01/10/2025). El rate card oficial de Meta viene como CSV/PDF detrás de un selector que no se pudo abrir. **Verificarlo antes de meterlo en un modelo.**
14. **No se pudo confirmar si el REPEP de PROFECO cubre mensajes de WhatsApp o solo llamadas telefónicas.** La LFPC habla de «publicidad» y de «llamada», y no hay criterio de PROFECO que lo resuelva. **En México es la diferencia entre un canal angosto y uno cerrado.**
15. **«Desde 2025 la entrega de marketing de WhatsApp es sensible al engagement»** no se pudo verificar contra fuente oficial de Meta. Tratar como no confirmado.
16. **Eisend & Tarrahi (2022) no se pudo leer completo** (Wiley devuelve 403). Se tiene el k=148, la dirección y la magnitud declarada del abstract, **pero no los tamaños de efecto por moderador** — o sea, no se pudo confirmar si el modelo distingue intención declarada de intención descubierta, que es justo la pregunta.
17. **No se verificó si los 3 clientes actuales** (ws1 Mauricio, ws10 Leandro, ws11 Leila) **completaron el diagnóstico de fase.** Si `negocio.fase.diagnostico` está vacío, el calificador no tiene sobre qué correr y la primera cohorte se califica a mano — que con 3 clientes está perfecto, pero conviene saberlo antes de diseñar el gate.
18. **RevenueCat (n>115.000 apps) es consumer mobile con compra de un toque en la tienda.** El «hard paywall convierte 5× más» **no es B2B ni self-serve de software para PyMEs**, y además son cortes transversales por modelo, no experimentos: los productos que *pueden* correr hard paywall están auto-seleccionados. La dirección puede orientar; el número no se importa.

---

### Las cuatro decisiones que este documento pide

1. **¿Cuánto vale tu hora?** Sin ese número, el break-even de la llamada está entre 0,4% y 34%, y no hay análisis posible.
2. **¿Qué incluye el 1a1 de US$4.000, en horas?** A 40 h el high ticket no aporta nada al LTV.
3. **¿Cuántas llamadas por mes estás dispuesto a dar?** Ese número —no el presupuesto— es el que topea la adquisición.
4. **¿La llamada es para todos, o para Growth y anuales?** Es la única perilla reversible de las cuatro, la que se prueba en una semana, y la que arregla el problema del comprador que cancela en el mes 4.