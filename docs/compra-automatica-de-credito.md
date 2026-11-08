# La compra automática del crédito de IA — 7/11/2026

**Pedido de Martín, 7/11:** «cuando entra un usuario tenemos que comprar en ApiMart los tokens
necesarios. Pero si el usuario no se gastó sus tokens, al mes que viene no se le vuelve a comprar la
misma cantidad, sino un diferencial. Y esa compra debería ser automática, con el mismo dinero que
entra. Yo quiero que salga ese dinero para no poner de mi propio bolsillo».

## 1. Lo primero, porque cambia la cuenta: el cupo es un TECHO, no un costo

El plan de US$97 incluye `CUPO_MENSUAL.growth` = 24.250 MT = **US$24,25** de video e imagen
(`lib/mako-tokens-reglas.ts`, `MT_POR_USD = 1000`). Eso **sólo se gasta si el cliente genera**.

| Uso del cupo | Deja cada cliente | 20 clientes | Equilibrio |
|---|---:|---:|---:|
| 0 % (no abre AI Avatar) | US$78,08 | US$1.123,36 | 6 clientes |
| 25 % | US$72,02 | US$1.002,11 | 7 clientes |
| 50 % | US$65,96 | US$880,86 | 7 clientes |
| 100 % (lo agota) | US$53,83 | US$638,36 | 9 clientes |

**Entre el mejor y el peor caso hay US$24,25 por cliente por mes.** Con 50 clientes, US$1.212 al mes
de diferencia. Por eso vale medirlo y no suponerlo.

⚠️ **El número de afuera NO sirve acá.** La literatura de cobros habla de 5-15 % de créditos
**comprados** que vencen sin usar, y usarlo subestimaría mucho el margen: un crédito comprado lo pagó
alguien que quería usarlo. Un cupo **incluido** en un plan, para una función que el negocio no
necesita, no se usa **nunca** — no el 10 %, el 100 %. Martín lo dijo con el caso real: Código
Inmobiliario y sus clientes no van a generar video porque no lo necesitan para su negocio.
Por eso `tasaDeUsoMedida` (`lib/uso-del-cupo.ts`) calcula la tasa con **nuestro** gasto contra
**nuestro** cupo, y devuelve `null` —no 0— mientras no haya con qué.

⚠️ **Y el cupo NO se acumula** (decisión de Martín, 7/11): se reinicia cada mes. Si se acumulara, un
cliente que no usó nada en seis meses podría gastar seis cupos de una, y la plata de esos meses ya se
gastó. **Acumular convierte un techo mensual en una deuda sin fecha.**

## 2. ⚠️ La trampa de comprar «por cliente cuando paga»

Es lo que pide la intuición y tiene dos problemas que lo rompen:

1. **La plata no está cuando el cliente paga.** Con Mercado Pago el dinero se puede retirar casi en
   el acto, pero con cualquier otra pasarela hay días de espera. Si la compra se dispara con el pago,
   **en esos días el crédito lo pone Martín de su bolsillo** — justo lo que no quiere.
2. **El crédito de ApiMart no es por cliente: es UNA cuenta.** No existe «el saldo de Pablo». Comprar
   US$24,25 cada vez que alguien paga es comprar N veces algo que vive en un solo lugar.

## 3. La forma que sí funciona: un solo saldo, repuesto por umbral

**No se compra cuando entra un cliente. Se compra cuando el saldo baja.**

```
saldo objetivo = Σ (cupo del plan de cada cliente activo) × tasa de uso medida × colchón
si saldo real < piso  →  comprar hasta el objetivo
```

Lo que esto resuelve de una:

- **La demora de la pasarela deja de importar**, que era el problema de fondo. El saldo tiene colchón
  para semanas, así que la compra nunca depende de que un pago puntual haya acreditado.
- **El diferencial sale solo.** Si nadie generó nada, el saldo no bajó y **no se compra nada**:
  `compraDelMes` ya devuelve 0 con el cupo entero sin gastar. No hay que llevar cuentas por cliente.
- **Menos compras y más grandes**, que es mejor si el proveedor tiene mínimos o comisión por operación.

**Lo que hay que decidir (es de Martín):** el **piso** y el **colchón**. Propuesta para arrancar:
objetivo = un mes de uso medido, piso = 40 % de eso. Con la tasa de uso de hoy (que todavía no está
medida) eso es poca plata inmovilizada.

## 4. Lo que falta construir

1. **Medir la tasa de uso real** y mostrarla en Costs. Sin eso el objetivo se calcula con un número
   inventado. `tasaDeUsoMedida` ya está; falta el cron que la guarde mes a mes para tener serie.
2. **Leer el saldo de ApiMart por API.** Sin eso no hay «saldo real» contra el que comparar. ⚠️ Está
   medido que **ApiMart ignora parámetros desconocidos y contesta 200** (`docs/hallazgos-video-pipeline.md`):
   su API no se descubre probando, y probar cuesta plata. Hay que leer su documentación primero.
3. **El cron de reposición**, con dos guardas que no son opcionales:
   - **un tope de compra por corrida**, porque un error de lectura que devuelva «saldo 0» dispararía
     una compra del objetivo entero;
   - **nunca comprar si no se pudo LEER el saldo** — la regla de esta casa: un 0 que puede significar
     «no pude leer» no es un dato (`scripts/minutos-actions.mjs` ya se quemó con eso).
4. **El aviso a Martín** cuando se compra, con cuánto y por qué.

## 5. Y una cosa que conviene mirar antes

Si la tasa de uso resulta ser tan baja como Martín sospecha, **el cupo de 24.250 MT está mal
dimensionado para lo que la gente hace**, y hay dos caminos: bajarlo y abaratar el plan, o dejarlo
como está y usarlo de argumento de venta («tenés video incluido»), sabiendo que casi nadie lo usa.
Las dos son decisiones de producto, no de código, y las dos necesitan el mismo número medido.
