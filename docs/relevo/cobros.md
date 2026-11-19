# Relevo — chat «Cobros» (cuenta claude5), 19/11/2026

Rama `punta/cobros-1911` (worktree `C:/dev/wt-cobros`; la `punta/cobros` vieja quedó en rojo con una versión anterior y no se usa: no se pudo reemplazar sin forzar). GitHub la chequea y la lleva a main sola; sale con el deploy diario de las 11:05 UTC. Lo detallado de cada
tema está en `docs/hallazgos-pagos.md`, `docs/hallazgos-partners.md`, `docs/hallazgos-agencias.md` y `docs/hallazgos-mako-tokens.md` (entradas del 19/11).
El brief de lo que falta de Partners sigue en `docs/pendientes-partners-pagos-1811.md`.

## Hecho
- **Escrito en producción con el sí de Martín en este chat (19/11 ~03:20 UTC):** la **0416** (el contador de MaKo Tokens: cupo del mes y descuento de la IA
  que paga MaKo) y la **0421** (el registro de Partners: un crédito por cada pago). Verificadas; la 0416 probada en una transacción que se deshizo sola.
- **Customers (ya estaba en main):** «Todos» trae agencias y la cuenta de prueba; Código da US$ 426/mes (plan + 7 clientes), no 238.
- **Binance de Código y Leila:** el comprobante del grupo se aplica SÓLO si el pago está en la cuenta de Binance (clave de lectura); si todavía no entró, «lo
  reviso solo» y el cron de cobros lo mira cada media hora; a las 48 h, a Martín.
- **P2P (interruptor «Habilitado sin cobro»):** apagarlo abre 7 días de prueba con «Elegir mi plan» en la esquina; sin plan, la cuenta se pausa y vuelve con el pago
  o si Martín lo prende. Martín todavía NO lo apagó para P2P.
- **Partners:** ser partner exige MaKo Pro activo (pasarela o mensualidad por Binance). Quien ya era partner sigue.
- **Checkout:** los pesos de Mercado Pago al dólar cripto del momento (dolarapi cripto + CriptoYa).

## Sin hacer (con dónde vive)
1. **Panel del partner que suma solo y pago del 1 al 5 (A) + «¿cómo quieres cobrar?» (D):** brief sección 3. Hoy `app/partners/PanelPartner.tsx` y
   `registrarPagoAPartner` («Marcar pagado» a mano). Incluye «en pausa si bajó de Pro».
2. **El cron diario del dólar** (`app/api/cron/dolar-blue`, `lib/dolar-blue-corrida.ts`) sigue con el BLUE para los pesos del setting (reactivar, retención, vitrina):
   pasarlo a cripto y cambiar los textos «blue» de Settings › Payments y los avisos.
3. **Verificación contra Mercado Pago** (transferencias al CVU) y **el checkout de «Transferencia o Binance» con el calce** (sigue oculto: `planes.pago_directo` vacío).
4. **Dato mal copiado en producción:** el pago de Código del 16/11 está anotado como `4660001999873228880` (libro `agencia.mensualidad.13.orden.*`, entradas 17 y 23, y
   el recibo N.º 0005); el real es `466000199987322880`. El código ya lo protege (no se cuenta dos veces); corregirlo es escribir en producción (pide el sí de Martín).
5. **Leila paga Pro y recibe el cupo de Essential** de MaKo Tokens (7.000 en vez de 14.400): `cupoDeCapa` sale de la capa. Hoy usa su propia IA.
6. **Sin ver en pantalla (capturas a 1440 y 375):** la esquina «Prueba hasta el…», la ficha del interruptor, /cuenta-pausada con «Tu prueba gratis terminó», la landing
   de /partners sin Pro. La PC estuvo con 0,4–2 GB libres toda la noche: tampoco se corrió el tsc local (lo corre GitHub en la punta).
7. **Sin probar con un pago real:** el calce de Binance (el primero será el de Leila, el 26/11).

8. **Leila pagó en BTC en octubre:** si vuelve a pagar en BTC, su comprobante va a Martín (no se convierte solo). El aviso del 26/11 dice «Págala por Binance»
   sin pedir USDT (`textoDelAvisoDelMes`, lib/agencia-mes-reglas.ts).

## Qué espera de Martín
- Apagar «Habilitado sin cobro» en P2P Consulting (Admin › Customers) cuando quiera que empiece su prueba.
- Si quiere corregir el número mal copiado del pago de Código del 16/11 (punto 4).
