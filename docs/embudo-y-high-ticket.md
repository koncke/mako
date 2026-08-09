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

---

# Segunda corrida (09/08/2026) — el modelo completo, y qué se cayó
Doce agentes, 2,2M tokens, 328 números con origen y **31 fallas del panel adversarial,de las cuales 14 cambiaban el signo del resultado**. Lo que sigue es lo que quedóDESPUÉS de aplicar las correcciones, no lo que el modelo dijo primero.
## Las cinco conclusiones
1. Lo único que cambia el signo del negocio es QUÉ se vende: con la misma máquina, el mismo embudo y el mismo gasto, el escenario base vendiendo Pro mensual deja US$3.073 de caja a 24 meses y vendiendo Pro ANUAL deja US$189.877 — 62×, y en los otros tres escenarios el mensual termina en cero o en rojo.
2. Contra el techo del Pro mensual (US$105,84, regla 3:1) el único canal que entra es REFERIDOS con US$48,56 (46%); el carrito (US$136,22) y el CTWA (US$201,00) entran recién contra el Pro anual, y solo bajo la regla de payback (US$364) — bajo la regla de valor 3:1 del anual (US$155,39) el carrito entra al 88% y el CTWA sigue 29% por encima.
3. El costo del usuario Free es US$4,00 de por vida (US$0,60/mes × 6,67 meses de vida derivada del churn del 15%) — ni los US$0,30 «por única vez» que usaba la tabla de canales ni los US$68,41/mes del punto de quiebre (ese número es la factura de CINCO workspaces, no de un usuario): pesa el 37,8% del CAC del CTWA y es lo que lo saca del techo.
4. Con las horas reales de la llamada (2,0 h, porque el guion promete un análisis POR ESCRITO que no estaba contado) y un 10% de reembolso en un programa de US$4.000, el ascenso al high ticket RESTA US$6,57 por comprador: el break-even de P₁ es 7,47% y la base del repo es 7% — el techo «con ascenso» deja de existir y queda UN solo techo por plan.
5. El calendario del dueño vende los mismos ~1,3 programas de US$4.000 en 24 meses tenga 50 clientes o 4.011 (1,2 / 0,8 / 1,3 / 1,5 en los cuatro escenarios, US$4.250-6.685 acumulados en todos), así que el high ticket pasa del 64% de la caja en el pesimista al 0,4% en el optimista: el SaaS y el 1a1 no compiten por clientes, compiten por la misma hora.

## Las correcciones que se aplicaron
Cada una desmiente algo que este mismo documento o `modelo.ts` daban por bueno.
- BORRADOS los ocho techos «con y sin ascenso» (165/181/263/279/816/832/416/464). El ascenso neto es −US$6,57, o sea ±2% de cualquier techo: no justifica una segunda columna. Queda UN techo por plan y dos reglas nombradas (3:1 y payback ≤3 meses), con cuál gobierna escrito al lado. Con eso se caen también los cinco viejos que ya estaban marcados para borrar: US$104 y US$53 (docs:1058-1059), US$49-97 (docs:620), US$55-70 (modelo.ts:266) y US$194-381 (modelo.ts:271).
- UN SOLO COSTO DEL FREE en las tres secciones: US$0,60/mes × 6,67 meses (= 1/churn del 15%) = US$4,00 de por vida. Antes eran tres valores incompatibles (US$0,30 por única vez en los canales, US$7,20 a 12 meses en unit, US$0,60/mes en la proyección). Se carga en el CAC de cada canal sobre los registros que NO pagan (19 en CTWA, 3 en carrito, 9 en referidos) y se BORRA el punto (8) de unit («25 Frees = US$180»), que era el mismo dato contado dos veces.
- El «punto de quiebre #1» se reescala: US$68,41/mes no es el techo de un Free, es (93,5/41)×30 sobre los CINCO workspaces de MEDICION, uno de ellos ws1 con los crons de Fathom. El techo real de un Free CON el gate de features que la GRILLA ya define (sin webhooks ni crons, 20 mensajes/día) es 20×30×US$0,00038 = US$0,23/mes, y ~US$3/mes en abuso. El paso 5 de ORDEN_DE_TRABAJO (el gate dentro de cada cron y webhook) apaga el riesgo; el ledger (pasos 6-7) deja de ser bloqueante para lanzar.
- El high ticket sale de Paddle: su AUP prohíbe textualmente «pure consulting or advisory services, including… coaching». Va por rail propio (Stripe merchant: 4,4% + US$0,30). M₁ en caja pasa de US$3.799,50 a US$3.823,70 — el fee es MENOR — pero aparecen el IVA del país del comprador, el contracargo de un ticket de US$4.000 y el reembolso, que estaba en cero.
- La llamada pasa de 1,5 h a 2,0 h (prep 0,5 + llamada 1,0 + informe 0,5). El guion promete «el análisis te lo llevás por escrito digas lo que digas» y ese informe no estaba en ninguna hora. costo_llamada = 0,75 × US$100 × 2,0 = US$150,00 (antes US$112,50).
- Reembolso del high ticket a 10% (supuesto, declarado). Estaba en cero, que es el único valor que seguro está mal en un programa de US$4.000 con garantía. Es lo que da vuelta el signo del ascenso: sin reembolso el neto es +US$18,51 y el break-even 5,91%; con 10% es −US$6,57 y 7,47%.
- La entrega del grupal deja de ser 3 h POR CABEZA y pasa a derivarse: horasCohorte 12 h (8 sesiones × 1,5 h) ÷ tamañoCohorte 12 = 1,0 h por comprador. A 3 h/cabeza una cohorte de 12 eran 36 h de entrega por US$1.500, contra 15 h por US$4.000 del 1a1 — imposible. M₂ en capacidad sube de US$1.125 a US$1.190,33.
- Las horas de SOPORTE entran al calendario, no solo a los dólares. Estaban cobradas (US$20/h dentro de `otrosCostos`) y no agendadas. Modeladas: hasta 20 h/mes las hace el dueño; pasado ese umbral se contrata y le quedan al dueño el 15% como gestión. Eso adelanta el mes en que el tope de 60 h se clava: base m7 (no m7 por llamadas: por soporte + producto), conservador m10, optimista m5.
- Aparecen 35 h/mes de PRODUCTO/mantenimiento para siempre, y los meses de construcción cargan 60 h/mes reales. Antes eran 0 h en los dos tramos. La ventana de construcción incluye ahora los pasos 1-11 (con el 10, la key de plataforma, sin la cual un Free EXPLOTA — lib/credenciales.ts:131 — y con el 11, el Image Generator, sin el cual el Growth vende una feature que no existe): 7 / 6 / 5 / 4 meses, no 4 / 3 / 2.
- El neto del Pro ANUAL pasa de US$446,00 a US$442,24, que ya estaba publicado en el repo (docs/costos-ia-y-planes.md:611). No hay ningún «0,8% sin documentar»: Paddle cobra su 5% sobre el bruto CON IVA del país del comprador. Verificado 3 de 3 al centavo. Corolario: el neto del Agencia es US$279,27, no US$279,62, y el mismo Pro en Colombia (IVA 19%) neta US$43,70.
- El plan AGENCIA sale de la mezcla de altas hasta que exista como `Plan['id']` (hoy su cupo es un `?? 150000` hardcodeado en Pricing.tsx:485), y su vida baja de 34,1 a 15,5 meses: la banda GRR 70% de ChartMogul es atributo de la EMPRESA, no del cliente, y modelo.ts:626 ya lo dice. Su techo cae de US$1.824 a US$476 bajo payback.
- registro→pago del caso base baja de 6% a 5%. El 6% es el TECHO de la banda «bueno» (4-6%) del reverse trial, que es la mecánica que el propio repo recomienda en docs:1008. El conservador va a 4% (el piso) y aparece un cuarto escenario en 3%.
- Los CAC que la proyección reporta son los SATURADOS que el motor efectivamente cobró, no los de la fórmula limpia. Y se publica el CAC MARGINAL, que es el único que decide el próximo dólar: con la curva declarada (+15% por duplicación) el marginal es el medio ÷ 0,7984.
- Dos «medido» que no lo eran pasan a «supuesto»: las 0 horas del dueño en el carrito (es «por diseño», y el carrito no está construido — no existen app/registro, app/checkout ni app/precios) y los «CERO clientes pagos hoy» (el dato correcto es DESCONOCIDO: `workspaces` no tiene columna de plan ni de precio). Y los tres netos pasan a «supuesto» hasta que se sepa qué entidad factura: al 3% de IIBB el techo del Pro cae de US$105,84 a US$102,03.
- Descuadres cerrados: prospección 111,11 opt-ins × US$6,82 = US$757,78 (no 757,58); el costo de IA del Agencia queda en UNA sola derivación, 150.000 × (25,18/50.000) = US$75,54; el premio de referidos queda en US$7,55 con su derivación; se borra el `paybackMeses: -1` de la fila Free en vez de rellenarlo.
- El argumento contra la prospección en frío cambia (la conclusión no): NO es que la doc de opt-in de Meta enumere una lista cerrada de canales — Meta dice textual que el opt-in «can be general and not specifically for WhatsApp». La prohibición es la Messaging Policy §1, «(b) you have received opt-in permission from the recipient», y una base comprada no lo tiene en ningún canal. Y el «salvavidas» de reactivar la lista propia tampoco es gratis: Meta excluye explícitamente el consentimiento «assumed… from a purchase», así que haber comprado NO es opt-in.

## Las 14 fallas que cambiaban el signo
Las encontró el panel adversarial —cuatro lentes: aritmética y doble conteo,
capacidad del calendario, supuestos optimistas, y lo que está prohibido— atacando
el modelo con la instrucción de romperlo, no de validarlo.

**El costo del usuario Free vale US$5,00 en la tabla de CAC y US$120-180 en la de unit economics. Es el mismo término, con dos magnitudes, y el veredicto de canales usa el chico.**

La sección CAC carga «registros 16,67 × US$0,30 = US$5,00» (4,4% del CAC de CTWA) y solo cobra IA. La sección unit dice, del MISMO término: «CAC_free_embebido = (1/conversión) × |LTV_free| = 25 × US$7,20 = US$180 — MÁS que el CAC_máximo ENTERO del Pro». A la conversión base del propio modelo (6%, no 4%) son 16,67 × 7,20 = US$120. La diferencia entera es `otrosCostos` del Free (US$0,55/mes de soporte+infra), que la tabla de CAC no carga en NINGÚN canal. Además los 16,67 registros incluyen al que paga: son 15,67 los que no pagan, así que ni los US$5,00 están bien (son US$4,70). Con la vida del Free de la propia proyección (churn 15%/mes → 6,67 meses × US$0,60 = US$4,00 por Free): CTWA = 83,33 + 15,67×4,00 + 25,00 = US$171,00, no US$113,33. Con la vida de unit (12 meses, US$7,20): US$221,13. Carrito = 124,22 + 3×4,00 = US$136,22, no US$125,12. Contra los propios techos finales del modelo (Pro payback US$111,75 · 3:1 US$123,85) los DOS canales que el veredicto declara viables dejan de cerrar. Y en el mes 24 del base, con la mezcla real de canales, la carga de Free por cliente pago es US$44,24 sobre un CAC de medios de US$122,65 → CAC verdadero US$166,89 contra un techo de US$130,59.

*Corrección:* Un solo costo de Free y una sola vida, usados en los dos lados: costo_Free_lifetime = (IA + soporte + infra) × vida_Free derivada del churn del Free de la proyección = US$4,00 en el base. Cargarlo en el CAC de cada canal sobre los registros que NO pagan (15,67 en CTWA, 3 en carrito) y borrar el punto (8) de unit — o al revés, pero no las dos. Si se deja en la P&L (como hace bien la proyección), entonces el techo hay que bajarlo antes de comparar: el presupuesto de MEDIOS del Pro es 111,75 − 62,68 = US$49,07, no US$111,75.

**El «CAC de medios de US$98» del escenario base es el número SIN saturación. La simulación sí saturó: el CAC real del mes 24 es US$122,65 y el MARGINAL es US$153,63 — por encima del techo. La conclusión «el base está subinvirtiendo en medios» se da vuelta.**

Reconstruí la curva declarada (+15% por duplicación sobre US$1.000/mes, aplicada POR CANAL) y reproduce la corrida al centésimo: predice 48,92 clientes de medios en el m24 del base contra 48,95 derivados del stock (Δ+20 clientes + 41,25 de churn − 12,30 de referidos), y en el optimista predice 193,3 contra 193,3. O sea: la corrida saturó y la nota reportó el CAC sin saturar. Base m24: CTWA 83,33 → 106,02 y carrito 124,22 → 151,78; blended 6000/48,92 = US$122,65, no US$98 (25% de error). Base m12: US$106,65, no US$98. Con la misma curva el CAC MARGINAL = CAC_medio/(1 − log₂1,15) = 122,65/0,7984 = US$153,63. La nota concluye «cada dólar adicional de medios compra contribución… el freno NO es el techo de CAC», pero el dólar siguiente compra a US$154 contra el techo de payback mezclado de US$130,59 — que es la regla que el propio modelo dice que debe gobernar.

*Corrección:* Publicar el CAC que salió de la corrida (US$107 en m12 → US$123 en m24), no el de la fórmula sin saturar, y agregar la columna del CAC MARGINAL, que es la única que decide si conviene el próximo dólar. Reescribir la conclusión: el base está EN el límite, no subinvirtiendo — bajo payback ≤3m el gasto óptimo está donde el marginal iguala US$131, alrededor de US$4.400-4.800/mes de medios, no US$6.000.

**Dos juegos de techos de CAC incompatibles con el mismo rótulo dentro del mismo entregable, y el veredicto de los cinco canales usa el que el propio modelo declara obsoleto.**

La sección CAC publica Pro US$165 (sin ascenso) / US$181 (con). La sección unit publica, para el mismo plan, US$123,85 (3:1) y US$111,75 (payback), y la sección proy dice textual que esos son «los NUEVOS» y que «hay que BORRAR los viejos, no dejarlos conviviendo: seis números incompatibles con el mismo rótulo es exactamente cómo se llegó acá» — y el entregable manda ocho más. La brecha sale de dos cosas: vida 12 vs 8,7 meses, y los US$4/mes de soporte+infra que unit agrega y la sección CAC ignora. Recalculado el veredicto con los techos finales del propio modelo: CTWA US$113,33 = 92% de US$123,85 (no «69% del techo») y 101% de US$111,75 → NO entra; CARRITO US$125,12 = 101% de US$123,85 → NO entra (el veredicto dice «entra al 76%»). En la otra dirección Growth sube de US$263 a US$288 y Agencia de US$816 a US$1.824 (2,2×): el error no es de signo uniforme, castiga al Pro y libera a los planes caros, que es justo al revés de cómo está escrito el ruteo de canales.

*Corrección:* Un solo juego, derivado de la contribución completa (neto − IA − soporte − infra) y de la vida por banda GRR: Pro 123,85/111,75 · Growth 288,06/158,07 · Agencia 1.824,04/477,24. Reescribir el veredicto de los cinco canales contra ese juego y borrar 165/181/263/279/816/832/416/464 en el MISMO commit en que se portan a modelo.ts, junto a los cinco viejos que ya estaban marcados para borrar.

**El SOPORTE está en los dólares y NO está en el calendario. La columna `horasDueno` suma canal + llamadas + entrega y nada más; las horas de soporte que el propio modelo declara (Free 0,02 · Pro 0,15 · Growth 0,40 · Agencia 1,50 h/cliente/mes) nunca entran al tope de 60 h.**

Verifiqué la descomposición contra la aritmética de caja del propio modelo y cierra al peso: optimista m24, mrr 137.108 − IA 24.085 − gastoCac 15.000 + HT 3.804 − contribución 78.887 = US$22.940 de otros costos, contra US$22.942 que da mi reconstrucción (Free 11.303×0,55 + Pro 1.566×4 + Growth 447×13 + Ag 100×45 + 150 fijos). O sea: las horas están cobradas y no están agendadas. Con las MISMAS tasas del modelo: CONSERVADOR m24 = 40,4 h de soporte (16,0 Free + 10,4 Pro + 8,0 Growth + 6,0 Agencia) sobre 33,7 declaradas → 74,1 h, 23% POR ENCIMA del tope. Cruza las 60 h en el MES 16 (28,0 + 32,4 = 60,4), no «nunca». BASE m24 = 177,0 h de soporte + 60 = 237 h/mes, y cruza en el MES 5 (13,8 + 54,9 = 68,7), no en el 7. OPTIMISTA m24 = 789,8 h + 60 = 850 h/mes, y cruza en el MES 4 (40,1 + 60 = 100,1). Cae la afirmación central de la corrida: «el conservador nunca toca el techo de horas (33,7 de 60), y por eso también es el único que puede cumplir la promesa de darle la llamada a los 185 compradores» — es falsa desde el mes 16. Y si el soporte se COMPRA (que es lo que dicen los US$20/h), el modelo tiene un plan de contratación invisible: 1,11 FTE en el base m24 y 4,94 FTE en el optimista m24, sin una sola hora del dueño para reclutar, entrenar ni gestionar a nadie, y sin nada que deflecte: `ls app/` no tiene /ayuda, /soporte, /faq ni /docs, y el grep de intercom|zendesk|crisp|tawk|helpscout|freshdesk sobre app/, lib/ y package.json da CERO. Cada pregunta llega a un humano por el mismo hilo de WhatsApp que es el producto. A un 15% de overhead de gestión (conservador para contratistas sin documentación), el dueño se come 26,6 h/mes en el base m24 y 118,5 h/mes en el optimista m24 — y en el optimista las 60 h ya están 100% consumidas por llamadas y entrega.

*Corrección:* Agregar `horasSoporte` como columna propia mes a mes, calculada con las mismas tasas que ya alimentan `otrosCostos` (es el mismo número, no uno nuevo), y meterla ADENTRO del tope de 60 h mientras no exista un contrato de soporte firmado. Cuando se tercerice, dejar en el calendario del dueño un 15% de las horas del equipo como gestión. Y agregar el evento que hoy no existe: el primer mes en que el soporte pasa de ~20 h/mes es el mes de la primera contratación (base m8, optimista m3), con su costo de reclutamiento y sus horas de onboarding. Verificable barato: contar los mensajes de soporte de los 3 clientes actuales durante 30 días y dividir — hoy 0,15 h/mes por Pro (9 minutos) no tiene fuente de ningún tipo y es el segundo término más blando de toda la tabla después del volumen de medios.

**CERO horas de producto durante 20-22 meses seguidos, y la mitad del MRR del mes 24 sale de dos planes cuyas features no tienen código.**

Los meses de construcción cargan `horasDueno: 0` y una contribución de −150 (solo fijos). En esos 2-4 meses el dueño —único desarrollador— tiene que entregar los pasos 1-9 de ORDEN_DE_TRABAJO (modelo.ts:647): atribución del gasto en anthropic-usage, índice, migración 0125 con workspaces.plan, lib/planes.ts fail-closed, el gate DENTRO de cada cron y cada webhook, presupuestoRestante PRE-FLIGHT en dos libs, ledger append-only + migración 0126, alta pública + callback de Google, y Paddle entero (4 Prices + pack + /precios + /checkout + webhook + campo RFC/NIT) — más las tres páginas legales que HUECOS marca como gate del merchant of record. `ls app/` confirma que no existe /precios, /registro, /checkout, /terminos, /privacidad ni /reembolsos. A un piso explícitamente generoso de 20 h por paso son 180-240 h, o sea 60-120 h/mes en la ventana, contra las 0 que el modelo carga. Y después del lanzamiento el modelo pone 0 h de producto para SIEMPRE. Dos consecuencias con número: (1) el paso 10 («Key de plataforma para el Free») queda FUERA de la ventana declarada (1-9) y es lo único que hace funcionar al Free — verificado en lib/credenciales.ts:131, `if (w === OWNER_WS && esValorReal(process.env[clave]))`: solo el ws1 cae al env, así que un Free sin key propia no gasta, la llamada EXPLOTA. Los 276 Free del base m4 y los 11.303 del optimista m24 revientan en su primera acción de IA. (2) El paso 11 (Image Generator → Video → Reels) tampoco está en la ventana, y el plan Growth vende «Fábrica de creativos (imagen)» (PLANES, modelo.ts:120) con SALVEDADES 'medios-no-existen' diciendo que el grep de fal|replicate|kie|apimart|veo|sora|gpt-image|text-to-video da cero coincidencias ejecutables. El Agencia directamente no existe en PLANES (modelo.ts:110-126: solo free/pro/growth). Cuentas: en el base m24, Growth 91 × US$90,87 = US$8.269 y Agencia 20 × US$279,62 = US$5.592 → US$13.861 de los US$27.879 de MRR, el 49,7%, sale de dos planes cuya feature definitoria tiene cero líneas.

*Corrección:* Tres cosas. (1) Poner horas reales en los meses de construcción (piso 20 h por paso de ORDEN_DE_TRABAJO, declarado como piso) y una línea permanente de mantenimiento/producto que NO baje de ~30-40 h/mes desde el lanzamiento — el propio embudo:364-368 rotula la fila de 40 h/mes como «sigue construyendo el producto», y esta proyección tomó 60 h y después gastó las 60 en vender. (2) Mover el paso 10 adentro de la ventana o el Free no arranca en ningún escenario. (3) O el paso 11 (medios) entra en la ventana —y entonces cada escenario se corre a la derecha, que es lo que el propio supuesto de «meses de construcción» ya advierte— o la mezcla 80/17/3 se cambia a 100/0/0 hasta que exista, y entonces el MRR del base m24 cae de US$27.879 a ~US$14.000. No hay tercera opción: hoy la proyección vende Growth desde el mes 5.

**La agencia —el único ingreso que existe HOY— no aparece en el calendario, y el escenario base la obliga a cerrar en el mes 5.**

El supuesto de estado inicial pone «CERO clientes pagos» y saca a ws1 (Mauricio), ws10 (Leandro) y ws11 (Leila) del INGRESO con un argumento correcto («si son acuerdos de agencia, no son suscripciones self-serve»). Pero los saca también de las HORAS, y ahí el argumento no vale: los atiende la misma persona, dentro del mismo mes. El resultado es que las 60 h/mes se presentan como un presupuesto cuando en realidad son un residuo: horas_disponibles = mes_humano − agencia − producto − soporte, y el modelo hace lo contrario (le da 60 h a MaKo y deja que todo lo demás valga cero). Con el soporte adentro, la holgura para la agencia en el escenario BASE es 60 − 54,9 − 13,8 = −8,7 h ya en el MES 5, y −177 h en el m24: el base exige que la agencia esté en cero desde el quinto mes. Eso cambia el pedido de capital. El modelo dice «poné US$3.241» (mínimo de la serie de caja); el pedido real es «poné US$3.241 Y resigná la facturación de la agencia durante 20 meses». Break-even concreto y chequeable: la contribución del base en los meses 5, 6 y 7 es US$3.581, US$3.197 y US$3.367 (mediana ~US$3.382), así que si la agencia factura más de ~US$3.400/mes, el escenario base deja al dueño PEOR que hoy hasta el mes 8. En el conservador la holgura para la agencia es 15,8 h/mes en el m12 y CERO desde el m16.

*Corrección:* Agregar una fila `horasAgencia` con el dato que solo el dueño tiene (cuántas horas/mes le llevan Mauricio, Leandro y Leila hoy) y restarla del mes humano ANTES de asignar las 60 h. Y publicar el pedido de capital en las dos monedas: los dólares del piso de caja Y los meses de facturación de agencia que hay que resignar. Es la única de las tres fallas de calendario que se cierra con una pregunta de treinta segundos al dueño.

**El escenario BASE no es una base: cada input está en el percentil optimista de su propia banda, y los tres a la vez. Rehecho con el percentil pesimista MODERADO (no el piso), la caja a 24 meses cambia de signo.**

Reconstruí el motor del BASE en Python y reproduce la tabla publicada dentro del 1% (mes 24: 318/90/20 contra 319/91/20; caja +210.539 contra +212.831; 387,5 de 622,6 llamadas servidas contra 387 de 626; 27,1 programas de 1a1 contra 27,1). Sobre ese motor verificado, moviendo cada supuesto a un percentil pesimista MODERADO —free→pago 4% (piso de la banda 'reverse trial 4-6% bueno', docs:970, que es la mecánica que el propio repo recomienda en docs:1008), conversación→registro 22% (el valor que el PROPIO modelo usa en su conservador), costo por conversación US$2,00 (dentro de la banda de planificación US$0,80-2,50 de docs:1117), CPC US$1,30, clic→checkout 0,9% (dentro de 0,8-1,5%), aprobación 68% (dentro de 65-75%), P₁=4% (el propio break-even es 4,18%), P₂=0% (el grupal no existe: 'en evaluación'), M₁ con 10% de reembolso, otros costos ×1,5, mezcla 88/10/2, referidos 1,5%/mes, churn del Free 10%— la caja a 24 meses pasa de +US$212.831 a −US$3.600, los clientes pagos de 430 a 170 y el MRR de US$27.879 a US$9.757. Con el PISO de cada banda publicada: −US$57.271 y 82 clientes pagos. Palancas individuales, cada una sola sobre el base: free→pago 6→4% = −22% de caja; free→pago 6→3% = −34%; conv→registro 30→20% = −18%; costo conversación 1,50→2,50 = −22%; P₁ 7→3% = −21%; horas del dueño 60→30 = −32%; otros costos ×2 = −16%; vida del Pro 8,7→6 meses = −12%; P₂ 5→0% = −10%. Ninguna sola da vuelta el signo; las trece juntas, sí. El modelo publica sensibilidades de a una y nunca la conjunta, que es la única honesta cuando ningún supuesto está medido.

*Corrección:* Publicar una cuarta columna 'pesimista conjunto' al lado de conservador/base/optimista, con el percentil pesimista de los 13 supuestos a la vez, y decir en una línea que ese es el escenario cuya probabilidad NO es despreciable porque los 13 son supuestos correlacionados (todos dependen del mismo hecho: que el producto todavía no se vendió una vez). Y renombrar el actual 'base' a 'base optimista', porque no hay un solo input suyo por debajo del punto medio de su banda.

**El CAC de CTWA omite el costo NO-IA del usuario Free, que el mismo modelo cobra en las otras dos secciones. Con el número que la propia sección de unit economics llama «el número que rompe el presupuesto», el canal deja de cerrar.**

La fórmula de CTWA carga «registros × costo_IA_de_un_Free» = 16,67 × US$0,30 = US$5,00, y solo cuenta la IA. Pero unit.planes valúa al Free en US$0,60/mes (US$0,05 de IA + US$0,55 de soporte e infra) y la proyección efectivamente le cobra los US$0,60 (lo verifiqué: en el mes 24 del base los 'otros costos' son US$5.092 = 319×4 + 91×13 + 20×45 + 3.136×0,55). O sea: la sección de canales valúa al Free que no paga en US$0,30 y las otras dos en US$4,00 (0,60 × la vida de 6,67 meses que implica el churn del 15% de la propia proyección) o US$7,20 (0,60 × los 12 meses de unit.planes). Recalculado: CAC de CTWA = US$113,33 → US$175,00 → US$228,33. Contra el techo del Pro que la propia unit economics deriva (US$123,85 con 3:1, US$111,75 con payback ≤3m) eso es 92% / 141% / 184% y 101% / 157% / 204%. La sección unit YA escribe este cálculo («A 4% son 25 Frees = US$180 por pagador, 1,45× el CAC_máximo ENTERO del Pro») y lo llama EL NÚMERO QUE ROMPE EL PRESUPUESTO — y después la sección de canales publica el veredicto sin él. Las dos conclusiones no pueden convivir: o el Free cuesta US$0,30 y el CTWA cierra, o cuesta US$4-7 y no cierra ningún canal que pase por el Free.

*Corrección:* Un solo valor del Free en todo el modelo. Elegir vida del Free = 1/churn_free (6,67 meses al 15%), costo US$0,60/mes → US$4,00 de costo embebido, y reescribir los cinco CAC con ese término. Con eso CTWA queda en US$175 y el veredicto de la sección de canales pasa de «entra al 69% del techo» a «no entra bajo ninguna de las dos reglas». Si se prefiere sostener los US$0,30, entonces hay que borrar de unit.notas el párrafo del 'costo del embudo Free' y el −US$0,60/mes del plan Free, porque son el mismo dato contado distinto.

**Hay DOS juegos de techos de CAC incompatibles en el mismo entregable, y el veredicto por canal usa el que el propio documento declara superado. Bajo la regla que el modelo mismo recomienda, los dos canales escalables NO cierran.**

cac.techos publica Pro sin ascenso US$165 y con ascenso US$181 (contribución US$41,25 sin soporte ni infra × 12 meses ÷ 3). unit.planes publica para el MISMO plan cacMaximo US$123,85 (3:1) y US$111,75 (payback ≤3m), porque agrega los otros costos (US$4/mes) y corta la vida a 8,7 meses con la banda GRR de ChartMogul. Son un 33% de diferencia sobre el mismo rótulo, y la nota de cierre de unit dice textual «RECOMENDACIÓN: gobernar con payback ≤3 meses hasta que haya caja». Pero la línea de veredicto de cac.notas usa 165/181. Rehecho contra los techos que el propio modelo recomienda: CTWA US$113,33 = 92% del 3:1 y 101% del payback (NO entra); carrito US$125,12 = 101% del 3:1 y 112% del payback (NO entra bajo ninguna); prospección legal 650%/720% (no 444%); orgánico 1.444%/1.601% (no 988%). O sea el veredicto publicado —«CTWA entra al 69% del techo, carrito al 76%»— se convierte en «los dos únicos canales que escalan con presupuesto no pasan la regla que este mismo documento recomienda para gobernarlos». Encima el carrito nunca pasa el payback del Pro ni siquiera SIN saturación (124,22/111,75 = 111%), y el Pro es el 80% de las altas por supuesto del propio modelo.

*Corrección:* Borrar cac.techos entero y dejar UN solo juego: el de unit.planes (Pro 123,85 / 111,75 · Growth 288,06 / 158,07 · Agencia 816 pero ver la falla del plan Agencia). Reescribir la línea de veredicto con esos números, y decir explícitamente cuál de las dos reglas gobierna ANTES de mirar los canales, no después. Es exactamente la trampa que el propio modelo denuncia en su última nota («seis números incompatibles con el mismo rótulo es cómo se llegó acá») y que vuelve a cometer.

**La recomendación más accionable de toda la corrida —«EL BASE ESTÁ SUBINVIRTIENDO EN MEDIOS, cada dólar adicional compra contribución»— está derivada del CAC SIN saturación, mientras el modelo internamente cobra el CAC CON saturación.**

Verifiqué que la saturación (+15% por duplicación arriba de US$1.000/mes) SÍ está aplicada dentro de las poblaciones del base: sin ella mi reconstrucción da 515 clientes pagos y US$236.984 de caja; con ella da 429 y US$210.539, que es lo publicado (430 y US$212.831). Pero el resumen del base dice «El CAC de medios es US$93-98 por cliente, cómodo bajo los dos techos» — y US$97,82 es exactamente el CAC SIN saturar. El que el modelo cobra en el mes 24 es: CTWA US$106,01, carrito US$151,76, MEZCLADO US$122,65. Contra el techo de payback mezclado (US$130,59) eso es 94%, no «cómodo»; contra el techo del Pro, que es el 80% de las altas (US$111,75), el mezclado ya está 10% arriba y el carrito 36% arriba. El cruce del techo de payback del Pro ocurre a US$3.782/mes de medios: el base lo pasa desde el mes 13 (gasta US$4.500) y llega a US$6.000. O sea que la conclusión correcta es la OPUESTA a la publicada: desde el mes 13 el dólar marginal de medios compra un cliente por encima del techo del plan que compran 8 de cada 10.

*Corrección:* Publicar en la tabla del escenario una columna `cacMediosEfectivo` mes a mes (el saturado, que es el que el motor usa), no el de referencia. Y reemplazar la nota «el base está subinvirtiendo en medios» por su contraria con el número: a US$6.000/mes el CAC mezclado es US$122,65 contra un techo de payback de US$130,59 mezclado y US$111,75 del Pro; el techo de gasto que respeta el payback del Pro es US$3.782/mes. Si igual se quiere escalar, la palanca no es más presupuesto sino apagar el carrito (US$151,76) y dejar CTWA (US$106,01), que es al revés de lo que dice la mezcla 55/45 del base.

**El ascenso al high ticket (US$4.000 1a1 + US$1.500 grupal) está cotizado con la tarifa de Paddle, y Paddle PROHÍBE vender eso. Toda la columna «conAscenso» y el 98% de la caja del escenario conservador dependen de un rail que no existe.**

Paddle AUP, textual (paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle, leído 09/08/2026, categorías prohibidas): «Human services that are not related to a software offering (e.g., pure consulting or advisory services, including but not limited to legal advice, coaching, IT services, and access to a community of experts)». Y arriba: «Paddle is built to serve software companies... If your company's primary offering is human services (such as consultation, support, or design services)... Paddle is not a good fit for your needs». El modelo pone M1 = (4.000 − 5% − US$0,50) = US$3.799,50 y M2 = (1.500 − 5% − US$0,50) = US$1.424,50, ambos con la tarifa de Paddle, con origen «publicado». No hay tarifa publicada para un rail que no acepta el producto. Los números que se caen: el uplift de US$159,98 por comprador, el neto de +US$47,48, los 8 techos «conAscenso» (181/291/278/454/832/460...) y las 18 filas de sensibilidad de P₁. Y el peor: en el CONSERVADOR el high ticket aporta US$25.451 de los US$25.941 de caja acumulada a 24 meses — el 98,1% (el propio modelo lo dice: con P₁=0 y sin grupal la caja queda en +US$490). En el BASE son 27,1 programas × US$4.000 = US$108.400 de facturación de consultoría corriendo por una cuenta aprobada como SaaS: eso no es un canal caro, es la causal de suspensión que se lleva puesto también el MRR del SaaS. Contexto que hace que esto se aplique HOY y no en teoría: la FTC accionó contra Paddle en 2025 por procesar en nombre de terceros, y desde entonces la AUP se hace cumplir con due diligence reforzada.

*Corrección:* El 1a1 y el grupal salen de Paddle a un rail propio (Stripe estándar como merchant propio: 2,9% + US$0,30 + 1,5% internacional = 4,4% + US$0,30 → M1 en caja = 4.000 − 176,00 − 0,30 = US$3.823,70, US$24,20 MEJOR que el 3.799,50 del modelo). Lo que aparece y hoy vale cero en el modelo: (a) el IVA/retención del país del comprador deja de resolverlo el MoR y vuelve a la mesa del que cobra; (b) el riesgo de contracargo de un ticket de US$4.000 lo asume MaKo, que es exactamente para lo que se contrata un MoR; (c) el reembolso, que el repo ya marcó pendiente (embudo:431). Y hay que escribirlo en el modelo: SaaS y high ticket son dos rails distintos, no una fila más de la misma tabla.

**Los cinco canales están cotizados sobre la WhatsApp Cloud API (ventana FEP de 72 h, plantillas a US$0,0305, escalera de sanción 5/7/30 días), pero el rail real del producto es Evolution — WhatsApp NO oficial, por QR, en UNA cuenta de MaKo. Es un cliente no autorizado, y es feature PAGA del Pro y del Growth.**

lib/evolution.ts:1-6, textual: «Evolution API — WhatsApp NO oficial (número por QR, texto libre). Cuenta única de MaKo (env EVOLUTION_BASE_URL / EVOLUTION_API_KEY), UNA instancia por workspace (instance_name = 'mako_ws<id>')». lib/mako-canal.ts:1-8: la línea propia de MaKo (`mako_superadmin`) también es Evolution. modelo.ts PLANES: el Free NO incluye «Integraciones que disparan IA sola (Fathom, Meta, Evolution)» y el Growth vende «Nutrición automática» — o sea Evolution se cobra. WhatsApp (Centro de ayuda oficial): «using these apps or linking your WhatsApp account to unofficial versions of WhatsApp violates our Terms of Service»; Evolution/Baileys son reingeniería de WhatsApp Web y el baneo del número es inmediato, sin escalera. Los números que se mueven: (1) el input «escalera de sanción = 30 días» que el modelo declara «publicado» es del régimen de la Cloud API y NO aplica al rail que se usa; (2) el daño no es de un canal: en el BASE al mes 24 son 430 clientes pagos y US$27.879 de MRR corriendo, en parte, sobre una sola cuenta de Evolution — el churn de 11,53%/mes del Pro sale de ChartMogul y no tiene ningún término para «el canal principal del producto es un cliente no autorizado»; (3) y al pasar al rail legal aparece el número que hoy vale CERO en todo el modelo: la nutrición automática del Growth deja de ser gratis. El propio repo cotiza la mensajería en «~US$1-3 por lead por mes de reactivación» (modelo.ts COBRO 'whatsapp'), y como el WABA es del CLIENTE (lib/chatwoot.ts:576 «cada cliente tiene su propio inbox/WABA»), Meta le factura a él: un Growth que nutre 100 leads paga US$100-300/mes de WhatsApp encima de los US$97 del plan. La feature que justifica el precio del Growth pasa a costarle al cliente 1-3× el plan entero. Eso no es COGS, es una bomba de churn y de precio que el modelo no tiene modelada por ningún lado.

*Corrección:* Separar dos cosas que el modelo mezcló: el CAC de un canal y el rail del producto. (a) Antes de la primera campaña, decidir si Evolution se apaga o se acota a lo que no es marketing; mientras siga siendo feature paga, ningún CAC de canal es el número relevante — el riesgo es la caída del producto. (b) Cotizar la migración a Cloud API vía BSP: verificación de negocio en Meta, WABA por cliente y aprobación de nombre a mostrar, ninguno de los cuales está en ORDEN_DE_TRABAJO 1-11 ni en los 4/3/2 meses de construcción. (c) Meter en el modelo de precios el WhatsApp que va a pagar el CLIENTE del Growth (US$100-300/mes a 100 leads) y ver si el plan sigue en pie a US$97: hoy el modelo asume US$0 y ese cero solo es cierto mientras el rail sea ilegal.

**El punto de quiebre #1 («el cupo del Free») se presenta como resoluble con los pasos 1-7 de ingeniería. No lo es: hay DOS diseños de cupo vivos en el repo y el que está de cara al cliente decide, textual, NO medir el texto. El texto es el 100% del COSTO_INTENSIVO de US$68,41/mes.**

modelo.ts TARIFA (líneas 438-478) cobra MT por operaciones de TEXTO — 'Conversar' (mako-msg 1 MT, stt 2 MT), 'Plan' (reunión 10 MT), 'Análisis' (retro 235 MT), 'Escribir' (landing 100 MT) — y de ahí sale EXPOSICION Free = US$0,30 por 600 MT, que es el número que el modelo usa en los cinco canales y en la tabla unit. Pero docs/costos-ia-y-planes.md, sección «El cupo», dice lo contrario y es la versión de cara al cliente: «MaKo Tokens SOLO para medios», «El texto va con uso justo y NO se mide de cara al cliente: cuesta US$1,87 y US$2,82 al mes, y poner un contador de tokens de texto en la cara del cliente mide algo que no cuesta y le enseña a tenerle miedo al producto», y «Al agotarse se frena la generación de medios y nada más. El CRM, WhatsApp, el copy y los análisis siguen andando: quedarse sin tokens nunca puede romper el CRM». Si gana esa versión —y es la que está escrita como decisión de producto, no como opción—, ejecutar los pasos 1-7 NO tapa el agujero del Free: el texto queda sin techo POR DISEÑO. Y el techo real de un Free es COSTO_INTENSIVO = US$68,41/mes (Pricing.tsx:64), que es íntegramente texto, porque los medios no tienen una sola línea de código (SALVEDADES 'medios-no-existen'). Consecuencia numérica exacta: las cifras que el modelo presenta como el escenario de FALLA —caja del base de +US$212.831 a +US$83.752 con 5% de Free intensivos, y a −US$45.327 con 10%— dejan de ser el modo de falla y pasan a ser el DEFAULT después de hacer los 7 pasos. Y de yapa, el cupo del Free bajo esa versión compra «6 imágenes, sin video» — o sea gatea una feature que no existe y no gatea nada de lo que sí corre.

*Corrección:* La decisión pendiente no es «bolsa vs dosis diaria» (que el modelo sí identificó): es «el cupo mide el texto o no». Escribirla antes de los pasos 1-7, porque cambia qué hay que construir. Si el texto NO se mide de cara al cliente, hace falta igual un tope INTERNO invisible (corte por costo, no por MT) o el Free no tiene techo; y entonces el costo del Free en la tabla unit no es US$0,05/mes sino un rango de US$0,05 a US$68,41 que hay que cotizar por percentil, no por media. Nota aparte: el modelo usa dos costos de Free incompatibles en el mismo entregable — US$0,05/mes en la tabla unit (US$0,60 a 12 meses) y US$0,30 «por única vez» en los cinco canales.

**Los tres precios netos (43,77 / 90,87 / 279,62) están rotulados origen «publicado» cuando el propio modelo dice, en la misma ficha, que no son reales hasta saber qué entidad factura y en qué país. Con el impuesto del que cobra adentro, CTWA deja de entrar en el techo del Pro.**

Regla de oro del repo: «publicado» = precio o benchmark de fuente verificable. Un número contingente de un hecho sin resolver es «supuesto». La sensibilidad del propio input lo admite: «ninguno de los tres es real hasta que se sepa qué entidad factura y en qué país (modelo.ts:664)», y modelo.ts:664 dice textual «si es argentina, el payout en USD entra al régimen cambiario y paga Ingresos Brutos». El número: con IIBB al 3% sobre el payout, el neto del Pro pasa de US$43,77 a US$42,46, la contribución mensual de US$37,25 a US$35,94, y el techo de payback ≤3 meses del Pro de US$111,75 a US$107,82. El CAC base de CTWA es US$113,33 → queda 5,1% POR ENCIMA del techo. Al 5% de IIBB: contribución US$35,06, techo US$105,18, CTWA 7,8% por encima. El techo mezclado 80/17/3 baja de US$130,59 a US$124,92 (3%) o US$120,26 (5%). Y hay algo peor que ya está adentro del modelo sin el impuesto: el modelo publica DOS techos de payback para el Pro con el mismo rótulo — US$124 en la tabla de techos (3 × US$41,25, contribución SIN soporte ni infra) y US$111,75 en la tabla unit y en las notas de la proyección (3 × US$37,25, CON soporte e infra, que son términos que el propio modelo agregó). CTWA a US$113,33 cae JUSTO ENTRE LOS DOS: pasa contra uno y falla contra el otro. El veredicto de titular «CTWA entra apenas» solo es cierto contra el techo que ignora los costos que el mismo entregable acaba de sumar. Es exactamente el pecado que el modelo le imputa al repo («seis números incompatibles con el mismo rótulo es cómo se llegó acá»).

*Corrección:* (1) Rotular los tres netos como «supuesto», con la sensibilidad al país de la entidad escrita al lado (0% / 3% / 5% de IIBB → techo de payback del Pro US$111,75 / US$107,82 / US$105,18). (2) Publicar UN solo techo de payback por plan, el que incluye soporte e infra (US$111,75), y borrar el US$124. (3) Con eso escrito, el veredicto de CTWA cambia de «entra apenas» a «no entra bajo la regla de payback ni siquiera antes de impuestos», y la conclusión operativa pasa a ser: el CTWA solo cierra si baja el costo por conversación de US$1,50 al US$1,10 que el propio research deriva (CAC US$83,33), o si se vende Growth/anual en vez de Pro mensual.

## Lo que NO puede decidir ningún modelo
Diez decisiones del dueño. La primera gobierna a todas las demás y sigue abierta
desde la corrida anterior.

- ⚠️ SIGUE ABIERTA DESDE LA CORRIDA ANTERIOR, Y ES LA PRIMERA PORQUE GOBIERNA TODO LO DEMÁS: ¿cuántas llamadas de venta por mes aguanta Martín, de verdad? El modelo la fija en 60 h/mes de calendario total y de ahí sale que en el escenario base se sirven 24 de 869 llamadas pedidas. No es un supuesto más: es la única perilla que el dueño controla directamente, no está escrita en ningún lado, y decide qué canales se pueden justificar. A 30 h/mes el base pierde ~31% de la caja; a 120 h/mes gana ~36%. Y la pregunta que va pegada: cuando no alcancen las horas, ¿QUIÉN recibe la llamada? Hoy la promesa es «a TODOS los que compran», y el modelo la raciona sin que nadie haya decidido el criterio. La salida barata que el repo ya recomienda (embudo:376) es gatearla al plan anual y al Growth.

- ¿Cuántas horas por mes le llevan HOY Mauricio (ws1), Leandro (ws10) y Leila (ws11)? Es el único número de todo el modelo que se cierra con una pregunta de treinta segundos, y hoy está declarado en CERO, que es falso: los atiende la misma persona dentro del mismo mes. Las 60 h no son un presupuesto, son un residuo (mes humano − agencia − producto − soporte). Con el soporte adentro, la holgura para la agencia en el escenario base es negativa desde el mes 7. Si la agencia factura más de ~US$3.400/mes, el base deja al dueño peor que hoy hasta el mes 8, y entonces el pedido de capital no es «poné US$750», es «poné US$750 y resigná la facturación de la agencia durante 20 meses».

- ¿Se vende el Pro MENSUAL o el Pro ANUAL como default en los canales pagos? Es la decisión que cambia el signo de tres de los cuatro escenarios, y es de producto, no de finanzas: el anual pide un checkout distinto, una promesa distinta y una garantía distinta. Y arrastra una segunda decisión que el modelo no puede tomar: bajo qué regla se gobierna el techo del anual, payback (US$364, protege la caja) o LTV:CAC 3:1 (US$155, protege el valor). Se separan 2,3× y hoy el escenario base compra justo en el medio.

- ¿El cupo de MaKo Tokens mide el TEXTO o no? Hay dos diseños vivos y contradictorios en el repo: modelo.ts TARIFA cobra MT por operaciones de texto (y de ahí sale el US$0,30 del Free), y docs/costos-ia-y-planes.md dice de cara al cliente «MaKo Tokens SOLO para medios» y «el texto va con uso justo y NO se mide». No es un detalle de implementación: si gana la segunda, ejecutar los pasos 1-7 de ORDEN_DE_TRABAJO no tapa el agujero del Free, porque el texto queda sin techo POR DISEÑO — y el texto es el 100% del gasto real, porque los medios no tienen una sola línea de código. Va ANTES de los pasos 1-7, porque cambia qué hay que construir.

- ¿El cupo del Free es una bolsa de 600 MT POR ÚNICA VEZ o una DOSIS DIARIA de 3-5 acciones no acumulables? Son incompatibles y las dos están escritas (modelo.ts:492 contra docs:1014). Con la bolsa, un Free cuesta una vez. Con la dosis diaria cuesta todos los meses mientras viva, y el costo del canal deja de ser proporcional a los registros y pasa a serlo a registros × meses. Todos los CAC de este modelo usan la bolsa.

- ¿Qué entidad factura y en qué país? Condiciona los tres netos, que por eso pasaron de «publicado» a «supuesto». Si es argentina, el payout en USD entra al régimen cambiario y paga Ingresos Brutos: al 3% el techo del Pro baja de US$105,84 a US$102,03 y al 5% a US$99,49 — y el CTWA, que ya no entraba, se aleja más. No hay research que resuelva esto; es una decisión societaria.

- ¿Se apaga Evolution o se acota a lo que no es marketing? Es feature PAGA del Pro y del Growth y es un cliente no autorizado de WhatsApp, con baneo inmediato y sin escalera. Mientras siga siendo feature paga, ningún CAC de canal es el número relevante: el riesgo no es un CAC alto, es la caída del producto sobre todo el MRR a la vez. Y decidirlo abre la cotización que hoy no existe: verificación de negocio en Meta, WABA propio y aprobación de display name, ninguno de los cuales está en los 11 pasos ni en los meses de construcción.

- ¿Existe el programa grupal de US$1.500, y con qué formato? Hoy está «en evaluación» y aporta el 24,5% del valor esperado del ascenso. Y su formato es lo que decide si el ascenso vale la pena bajo restricción de calendario: a 1 h de entrega por cabeza (cohorte de 12) rinde US$1.190 por comprador contra US$1.941 del 1a1 que consume 15 h — o sea 5,6× más ingreso por hora del dueño. «Grupal como default, 1a1 por aplicación» es la única de las cuatro salidas de embudo:374-379 que sube el ingreso por hora en vez de racionar llamadas, y ningún escenario la corre porque nadie decidió si el programa existe.

- ¿Cuál es la tasa de reembolso que se asume para el high ticket? El modelo la puso en 10% porque cero es el único valor que seguro está mal en un programa de US$4.000 con garantía — y es exactamente lo que da vuelta el signo del ascenso (+US$18,51 a 0%, −US$6,57 a 10%). No hay benchmark: es política comercial del dueño, y hay que escribirla antes de que la primera venta la escriba sola.

- Antes de diseñar el programa de referidos: conseguir el PDF de «Unintended reward costs», Journal of the Academy of Marketing Science, DOI 10.1007/s11747-019-00635-z. Su abstract dice que para ofertas INNOVADORAS los premios PÚBLICOS pueden BAJAR la probabilidad de recomendar, y no se pudo leer completo (Springer redirige a login). Apunta justo al diseño intuitivo de «premiá a los dos y contalo en la landing». Referidos es el único canal que entra en el techo del Pro: vale la pena no arruinarlo con el default.
