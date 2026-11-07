# Cuánto cuesta MaKo y cuántos clientes hacen falta (7/11/2026)

Lo que se gasta, quién lo paga **hoy**, y el punto de equilibrio. Todo medido o consultado a su
API el 7/11; lo que no se pudo leer dice que no se pudo.

Para la estructura fiscal y las rutas de cobro, ver [estrategia-financiera-mako.md](estrategia-financiera-mako.md).
Para el costo de la IA por acción, [costos-ia-y-planes.md](costos-ia-y-planes.md).

---

## 1. El gasto fijo, y quién lo paga hoy

⚠️ **La distinción importa más que el total.** Hoy Mauricio paga una parte, y las cuentas de Claude
que no son suyas se pagan **mitad y mitad con Leandro**. El punto de equilibrio de Martín se calcula
con lo que sale de SU bolsillo, no con el total.

### Sale del bolsillo de Martín

| partida | US$/mes | de dónde sale el número |
|---|---|---|
| Claude × 4 (las que no son de Mauricio), **a mitad con Leandro** | **400,00** | Martín, 7/11: US$200 cada una |
| GitHub Actions | 30,00 | el **tope** configurado, no el gasto real (ver §2) |
| App Store (Apple Developer) | 8,25 | US$99 al año, precio publicado |
| **TOTAL HOY** | **US$438,25** | |

### Lo paga Mauricio (y algún día pasa a Martín)

| partida | US$/mes | |
|---|---|---|
| Claude de Mauricio (la cuenta `claude1`, ver ~/.claude/cuentas.tsv) | 200,00 | |
| Vercel | 60,00 | piso medido US$54 + ~1 build/día a US$0,33 |
| Supabase Pro | 25,00 | **consultado a la API**: la org está en plan `pro` |
| Railway | 21,00 | corre Evolution, el WhatsApp no oficial |
| **se sumaría** | **US$306,00** | → **US$744,25** el día que pague todo |

### Lo que NO se cuenta, y por qué

- **Resend: US$0.** Cada cliente trae su token (BYOK).
- **Apify: US$0.** No hay token de plataforma en el `.env`: también es BYOK.
- **Google Play: US$0 corriente.** Son US$25 una sola vez, ya pagos.
- **Dominio:** anual y chico; decisión de Martín de no prorratearlo.

⚠️ **Claude es el 89% del gasto fijo total.** Todo lo demás junto son US$123. El día que preocupe
la infraestructura, no va a ser Vercel ni Supabase: van a ser las suscripciones.

⚠️ **Supabase está en la org de Mauricio junto a 7 proyectos que NO son MaKo** (`baja-teriyaki`,
`aspro-tableros`, `texx-accountability`…). Los US$25 son del plan de la organización entera: cuando
lo pague Martín, conviene sacar MaKo a su propia org o va a estar pagando los tableros de los otros
clientes de Mauricio.

---

## 2. Dos números que NO se pueden leer, y por qué eso importa

**Vercel: el token está vencido.** `VERCEL_API_TOKEN` devuelve 403 en todo
(`/v1/billing/charges`, `/v9/projects`). Por eso el US$60 sale del piso documentado y no de la
factura en vivo. Y **no se usa el US$278 de la factura en curso**: ese pico fue un accidente ya
corregido (Elastic subió solo a Turbo el 20/10 y `punta.yml` hacía compilar cada llegada a main).

**GitHub Actions: el token de Actions no ve el panel de facturación.** `minutos-actions.mjs` puede
decir «Facturable REAL: **0 min**» y **ese cero significa «no pude leer», no «no gastamos»**. Por eso
en la tabla va el TOPE (US$30) y no un gasto: es el único número honesto que hay.

---

## 3. Lo que cuesta la IA de un cliente

Medido contra la cuenta real el 7/11 (ver [hallazgos-video-pipeline.md](hallazgos-video-pipeline.md)):

**Omni Flash = US$0,15 fijo + US$0,025 por segundo.** Tres puntos: 4 s→0,25 · 6 s→0,30 · 10 s→0,40.
Tope del modelo: 10 s (`invalid duration 60, must be one of 4/6/8/10`).

⚠️ **La parte fija cambia el diseño:** un clip de 4 s sale US$0,0625 el segundo y uno de 10 s sale
US$0,040. **Siempre el clip más largo que el modelo permita.** Partir una pieza en clips cortos la
encarece sin que nadie lo note.

| unidad | costo |
|---|---|
| 1 clip de 10 s + su imagen de referencia | **US$0,412** |
| 1 video de 60 s (6 clips) | **US$2,472** |

---

## 4. Lo que cuesta COBRAR, que es lo que más se olvida

De [estrategia-financiera-mako.md §2](estrategia-financiera-mako.md), ruta «Argentina directo»
(monotributo H), precios leídos el 24/10 en las páginas oficiales:

| | |
|---|---|
| Pasarela (Creem: 3,9% + US$0,40 + 1% de cambio) | 5,75% |
| Impuesto | 8,36% |
| Traer la plata | 0,7-1,1% |
| **Se va** | **14,1-15,5%** |

⚠️ **Y la trampa que conviene no pisar: si la suscripción se cobrara DENTRO de la app**, Apple o
Google se quedan 15-30% **encima** de eso. En Growth eso baja el margen de 45% a **15%** — la tienda
se llevaría más que la IA. **El cobro va por web; la app es para usar el producto.**

---

## 5. Cuánto se queda un cliente

Benchmark 2026 de SaaS para pymes: churn mensual **3-5%**, promedio **4,5%** → **vida ≈ 22 meses**
([retentioncheck](https://retentioncheck.com/churn-benchmarks/smb-saas),
[metricrig](https://metricrig.com/answers/saas-churn-rate-benchmarks-2026/)). Planes mensuales sin
compromiso están en la banda alta (3-8%); los anuales prepagos, muy por debajo.

⚠️ **Contra la intuición: un LTV corto EMPEORA el margen, no lo mejora.** El CAC se reparte sobre la
vida del cliente. A 22 meses son US$4,37/mes; si se quedaran 4 meses serían **US$24,25/mes** y no
cerraría nada. **El churn no es una métrica de retención: es un costo.**

---

## 6. La cascada por cliente, con 100 clientes

CAC de US$97 (el Partner cobra el 100% del primer mes; es también el techo que Martín se puso en Meta).

| | Pro US$47 | Growth US$97 |
|---|---|---|
| ingreso | 47,00 — 100% | 97,00 — 100% |
| − cobrar | −7,05 — 15% | −14,55 — 15% |
| − **IA** | −2,47 — 5% | **−29,66 — 31%** |
| − fijo | −4,38 — 9% | −4,38 — 5% |
| − adquisición (CAC/22) | −4,37 — 9% | −4,37 — 5% |
| **queda** | **US$28,73 — 61%** | **US$44,04 — 45%** |

**LTV/CAC: 7,6 en Pro y 11,1 en Growth.** Arriba de 3 se considera sano: la adquisición se paga
sobradamente.

⚠️ **Dónde se va el margen de Growth, y no es donde parece:** la IA se lleva **30,6%**, contra 4,5%
del fijo y 4,5% de la adquisición. Son los **72 clips** de 12 videos de un minuto. **Cada video que
sale del plan devuelve 2,5 puntos de margen:**

| videos/mes | clips | costo IA | margen |
|---|---|---|---|
| 4 | 24 | US$9,89 | 65,8% |
| 8 | 48 | US$19,78 | 55,6% |
| 12 | 72 | US$29,66 | 45,4% |

---

## 7. El punto de equilibrio

Con lo que sale del bolsillo de Martín (US$438,25) y el CAC amortizado sobre la vida real:

| mezcla de clientes | **hoy** | cuando pague todo (US$744) |
|---|---|---|
| todos Growth | **8** | 13 |
| **mitad y mitad** | **10** | **16** |
| todos Pro | **13** | 21 |

**Después del equilibrio** (mitad y mitad): 20 clientes dejan **+US$519/mes**; 50 dejan **+US$1.954**;
100 dejan **+US$4.347**.

⚠️ **Bajar el CAC de US$97 a US$50 mueve el equilibrio de 10 a 9 clientes: casi nada.** A esta escala
el problema no es la adquisición, es el fijo que corre tengas o no tengas clientes. El CAC empieza a
pesar recién al escalar: a 100 clientes, bajarlo a la mitad deja US$392 más por mes.

---

## Cómo rehacer esta cuenta

Los números viven en `lib/mako-tokens-reglas.ts` (cupos y conversión a MT) y
`lib/apimart-reglas.ts` (precios medidos por modelo). Las cuentas de arriba son aritmética sobre
esos dos archivos más el gasto fijo de §1. **Antes de rehacerla, volver a medir el precio del
modelo**: el catálogo de ApiMart no trae precios y sólo aparecen en `/v1/tasks/{id}` al terminar.
