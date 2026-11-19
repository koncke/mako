# Hallazgos — MaKo Tokens (el medidor del gasto de IA)

Dónde vive el código: `lib/mako-tokens-reglas.ts` (la aritmética), `lib/mako-tokens-costos.ts` (qué cuesta cada
acción), `lib/mako-tokens-caja.ts` (la caja), `lib/mako-tokens-medidor.ts` (la puerta),
`supabase/migrations/0412` y `0416`, y el enganche en `lib/ai-cheap.ts`, `lib/anthropic.ts`,
`lib/anthropic-usage.ts` y `lib/video-desarmar-gemini.ts`.

La propiedad que el medidor existe para dar, y conviene tenerla a mano antes de tocar nada: **si una generación
sólo corre cuando hay saldo, y el saldo entra con el pago, no se puede gastar en IA antes de cobrar.** Todo lo de
abajo se lee contra eso.

---

## La opción B en el código, y la caja que no está en producción (17/11/2026)

**Lo que decidió Martín** (17/11, por el Cerebro): «me gusta la opción B… mientras más compra, más tiene»; «que paguen
como máximo $100 extra y que con esos $100 extra ya le alcance los 30 minutos»; «Lo único que no quiero es cambiar de
modelo»; «descarta completamente Flow»; y en las columnas «0 minutos o 4 minutos, 10 minutos», no clips.

**Lo que quedó, y dónde vive:**
- **El Omni es Omni 1.2 Flash de Google:** `gemini-omni-1.2-flash-ext`, US$0,024 por segundo a 720p, sin cargo fijo, de 3 a
  15 s, 9:16 y con audio. Medido generando el mismo 17/11 (US$0,096 por 4 s, la cara igual que en Flow:
  docs/hallazgos-video-pipeline.md). `MODELO_OMNI` en `lib/apimart-reglas.ts`.
  `USD_POR_SEGUNDO.normal` (`lib/mako-tokens-reglas.ts`) lo lee de ahí. Un minuto son 1.440 MT.
- **El cupo del de US$97** baja de 24.000 a **14.400 MT = 10 minutos** (`MINUTOS_DEL_CUPO_PRO`). Sus imágenes pasan a ser la
  consecuencia: 1.200.
- **El del de US$47 pasa a ser PROPORCIONAL** (el mismo 17/11, Martín: «no tiene sentido de que en el de 97 le demos 14.400 y
  en el de 47 12.000 tokens»): 14.400 × 47 ÷ 97 = 6.977 → **7.000 MT** (`CUPO_ESSENTIAL_MT`). Sigue sin video. Sus imágenes son
  583 y se dicen «580» en las columnas y en la tabla (`redondoParaLeer`, ahora en lib/mako-tokens-paquetes.ts). Según el
  Cerebro, con IVA, cobro y el costo del cliente, deja 47 % si usa todo, 56 % al 50 % y 60 % al 25 %; con 12.000 daba 34, 49 y
  57 %. Un test exige que siga siendo proporcional si se toca el de US$97.
- ⚠️ **Mauricio Bustos (US$47) gastó 8.680 MT en los últimos 30 días** (medido el 17/11 a la tarde): más que los 7.000. Hoy no
  lo frena nada porque la caja no está aplicada. El siguiente es el negocio de prueba, con 2.263; ningún otro pasa de 1.500.
  **Martín lo decidió el mismo día: sin excepción.** «A Mauricio sí le dejamos con los tokens de Essential… Mauricio de por sí
  va a tener el plan de 47». No hay nada especial para él en el código.
- **La tarifa del extra** pasa a **288 MT por dólar, lineal** (`MT_POR_DOLAR`): cada US$10 son 2 minutos, US$100 son 20, y
  el minuto suelto sale US$5 exactos (`USD_POR_MINUTO_SUELTO`). Margen bruto de IA del extra, a precio de lista: 71,2 %
  (`MARGEN_BRUTO_DEL_EXTRA`).
- **La barra** va de US$0 a US$100, de a 10 (`PASOS_USD`). Las columnas dicen «10 minutos de video con IA» y «0 minutos…»
  tachado (`LO_QUE_ALCANZA`), y la línea de abajo dice «+11.520 MaKo Tokens extras al mes = 8 minutos más de video»
  (`htmlExtra`, app/planes/CalculadoraTokens.tsx). La tabla de comparación dice «Hasta 10 minutos al mes»
  (`lib/planes-comparacion.ts`).
- **Un solo precio para los mismos 10 s:** `MT_POR_CLIP` = `mtDeVideo(10)` = 240, y la fila «clip» de
  `lib/mako-tokens-costos.ts` dice lo mismo.

**Los márgenes del Cerebro**, con el 21 % de IVA de pagar ApiMart con tarjeta, el 12,36 % de cobrar y el costo de conseguir
al cliente (US$97 ÷ 9), sin los gastos fijos: el de US$97 deja US$56,81 (59 %); el extra solo, US$52,79 (53 %); juntos, a
US$197, US$109,60 (56 %) con 30 minutos. Los MT van a precio de lista, sin IVA: con IVA, cada MT cuesta US$0,00121.
- **El costo de conseguir un cliente pasó a ser PROPORCIONAL al plan** (17/11, Martín: «Puedes dejarlo también proporcional para
  que quede en 59 %… es una suposición»): el CAC de cada plan es su precio, lo que se lleva un Partner el primer mes
  (`cacDelPlan`, lib/economia-unitaria.ts). Repartido en 9 meses: US$5,22 en el Essential y US$10,78 en el Pro. Con el mismo
  US$97 para todos pesaba 23 % del Essential y 11 % del Pro. Es un supuesto hasta medir los anuncios. La idea de proyectar que
  el cliente del Essential termina pasándose al Pro quedó anotada ahí y sin hacer: no hay una tasa de paso medida.

**Medido en producción antes de bajar el cupo (17/11, sólo lectura):**
- ⚠️ **La caja no está instalada.** No hay ninguna función `mako_tokens_*`. `mako_tokens_saldo` tiene sólo las columnas de
  la 0412, sin `comprado` ni `cupo_mes`, así que **la 0416 no se aplicó**. El libro `mako_tokens_movimientos` tiene **0
  filas**. Hoy no se descuenta nada a nadie: «el texto ya se cobra desde el 15/11» es cierto en el código y falso en
  producción. Por eso el consumo no se puede leer del libro.
- **Se midió con `anthropic_usage`** (30 días). A lo que se anota en US$0 (Gemini gratis) se le puso el precio de Gemini
  pago, como techo. El único negocio con el plan de US$97, Código Inmobiliario, gastó **≈1.082 MT** de los 14.400. El más
  alto de todos, Mauricio Bustos (US$47), gastó **8.827 MT** de 12.000. Ninguno pasa de 14.400: bajar el cupo no le saca
  nada a nadie.

**Trampas de este cambio:**
- **El piso ahora empata, a propósito.** Subir del de US$47 al de US$97 son US$50 por 10 minutos, o sea US$5 el minuto, lo
  mismo que el extra. `respetaElPiso` acepta empatar sólo porque el de US$47 no genera video (`GENERA_VIDEO.pro`). Si algún
  día lo genera, ese test se pone rojo, que es lo que tiene que pasar.
- **El modelo más barato del catálogo es el Omni.** `MODELO_PARA_PROBAR` (el más barato, por regla) pasa a ser el mismo
  que el de entregar. Cambiar el nombre no genera nada.
- **El test del margen decía «el paquete deja el MISMO 75 % que el plan»**, por lo que Martín pidió el 15/11. El 16 y el 17/11
  lo dio vuelta para el extra. Ahora el test exige un solo margen (la tarifa es lineal), que salga de la tarifa y que un
  dólar nunca compre más MT de los que cuesta.

**SIN HACER, con dónde vive:**
- ~~Aplicar la 0416 en producción~~ → **APLICADA el 19/11/2026 ~03:20 UTC** con el sí de Martín («Sí, prende el contador de MaKo Tokens»). Ver la entrada «La caja, prendida» al final.
  Es escribir en producción: pide el sí de Martín. ⚠️ **El día que se aplique, Mauricio Bustos se queda corto:** gasta ~8.700
  MT por mes en texto y su cupo de Essential es 7.000, sin excepción (decisión de Martín, 17/11). Va a ver «te quedaste sin
  MaKo Tokens» antes de fin de mes, y los caminos automáticos de su negocio se saltean en silencio (`fallaBlanda`).
- **Los riesgos del canal Ext** (si se corta y hay que pasar al canal normal, el extra deja ~7 %): en «Riesgos sin medir», en
  la entrada de abajo. La cara que habla ya se probó (docs/hallazgos-video-pipeline.md).
- **Que el video salga por ApiMart:** hoy los clips salen por el Flow del cliente (la entrada de abajo). `MODELO_VIDEO_POR_DEFECTO`
  sigue en Hailuo y no se tocó, porque `generarVideo` no tiene llamador.
- **`scripts/probar-0416-pglite.mjs` tiene los cupos viejos escritos a mano** (11.750 y 24.250).
- **Cuántos intentos lleva un clip** sigue sin medir.

---

## El precio de «30 días de contenido» lo decide el MODELO, no el margen (17/11/2026)

**Síntoma:** Martín preguntó cuánto cobrar por un reel por día. El chat de MaKo Tokens había dicho «sólo la IA cuesta
US$102». La corrida `wf_42fb8b45-5da` lo rehízo: según el modelo, el mismo mes cuesta **US$60 o US$127**. Las cuentas
eran 30 reels con 30 s generados, la mitad de los clips rehecha una vez (135 clips de 10 s), 9 carruseles, 13 imágenes y
el texto que el repo presupuesta.

**La causa: el código tiene dos «Omni» y no son el mismo producto.**
- `lib/mako-tokens-paquetes.ts:36-48` dice que «el único Omni del catálogo es kling-v3-omni» y cobra **US$0,896** por clip.
  kling-v3-omni devuelve **16:9** (`lib/apimart-reglas.ts:65-76`), así que un reel vertical sale recortado.
- El 8/11 se generó y se pagó por ApiMart un **Omni-Flash-Ext**, el Omni de Google, el que Martín llama «Omni», a
  **US$0,40**. Salió vertical 720×1280, con voz y labios (`docs/video-avatar-desde-foto.md:15`).
- La fórmula «US$0,15 + 0,025 por s» de `docs/costos-fijos-mako.md:68-79`, que el 15/11 se atribuyó a Flow, da justo 0,40.
- La fila «clip» de `lib/mako-tokens-costos.ts:323-324` explica Omni Flash y pone el número de kling.

**La trampa del medidor: dos precios para los mismos 10 s.**
- `MT_POR_CLIP` = 900 (`paquetes.ts:104`).
- `mtDeVideo` = 384, porque usa seedance a 0,0384 por s (`lib/mako-tokens-reglas.ts:86` y `:210`). Es el que
  `cobrarMediosMt` dice usar (`lib/mako-tokens-medidor.ts:363-368`).
- Si se engancha así, un cliente que agota un paquete de US$297 con kling le hace perder a MaKo unos US$22. Antes de
  vender un paquete, el medidor tiene que cobrar el mismo número que la cuenta del precio.

**Lo que no se reproducía del chat anterior:**
- Los US$102 sólo salen rehaciendo un cuarto de los clips. Con la mitad, son US$122,71.
- Los márgenes de su escala (75, 70, 64 y 55 %) no descuentan el 10,16 % de pasarela e impuesto
  (`lib/economia-unitaria.ts:36-42`). Descontado, quedan 64,8, 59,8, 53,8 y 44,8 %.
- Los pasos de la barra son 0, 10, 20, 40, 60, 80, 100, 120, 160 y 200 (`app/planes/CalculadoraTokens.tsx:141`). Los tramos
  de 25, 50 y 75 de esa escala no existen.

**El diagnóstico obvio era el equivocado.** Parecía que el margen fijaba el precio, y lo fija el modelo. Sobre la factura
entera (Pro + extra), un paquete de US$297 deja 48 %. Ese número esconde que el extra solo deja 39,8 %, contra la regla del
75 % (`paquetes.ts:54-69`) y `PISO_DE_MARGEN_BRUTO` 0,74 (`reglas.ts:152`). Y pasar de US$0,896 a US$0,40 por clip mueve
el precio más que cualquier margen: con Omni Flash, el mes entra en Pro + US$100 y deja ~60 %.

**La regla:** un precio de video se calcula con el modelo que entrega el reel (9:16, con voz), con clips enteros de 10 s y
cobrando cada intento. El margen se mide sobre lo que se agrega, no sobre la factura con el plan adentro.

**SIN HACER, con dónde vive:**
- ~~Martín tiene que decidir cuál Omni se usa~~ **Decidido el 17/11: Omni 1.2 Flash de Google** (ver la entrada de arriba). El
  Omni-Flash-Ext del 8/11 hoy se llama `gemini-omni-1.1-flash-ext`: es el 1.1, otro. Falta generar uno de prueba con el 1.2.
- ~~Unificar el costo de 10 s de video~~ **Hecho el 17/11:** `MT_POR_CLIP` = `mtDeVideo(10)` = 240, y la fila «clip» igual.
- Medir cuántos intentos lleva un clip. La única regla del repo es «3×», de agosto y con otros modelos
  (`docs/costos-ia-y-planes.md:677-679`). Con 3 intentos, el mismo mes cuesta el doble.
- Con qué se recarga ApiMart: no está en el repo. Con tarjeta argentina se suma el IVA del 21 %, y el clip de US$0,896 pasa
  a ~US$1,08.
- Los precios de la competencia, con sus trampas, están en
  [competencia/precios-video-con-ia.md](competencia/precios-video-con-ia.md).

**⚠️ CORRIGE LO DE ARRIBA, el mismo 17/11** (corrida `wf_1d9bf4cd-78d`, 5 agentes con un refutador). El «Omni-Flash-Ext» de
US$0,40 **no** es el Omni de Flow de Martín: hoy ApiMart lo llama `gemini-omni-1.1-flash-ext`, o sea Omni **1.1**. El de Flow es
Omni **1.2** Flash. ApiMart lo vende de dos maneras, según su página oficial (apimart.ai/model/gemini-omni-1-2-flash, leída el 17/11):
- **`gemini-omni-1.2-flash-ext`:**
  - US$0,024 por segundo, lineal, sin cargo fijo;
  - clips de 3 a 15 s, en 9:16, con audio;
  - la foto va en `first_frame_image`.
  - **1 minuto = US$1,44 = 1.440 MT.** 15 s cuestan lo mismo por segundo que 10.
- **`gemini-omni-1.2-flash`, el canal normal:** cobra por tokens, ~US$0,0556 por s, o sea ~US$3,34 el minuto. El 9/11 se midieron
  0,0559 por s.

**El diagnóstico obvio era el equivocado, otra vez.** El repo dice «el 0,412 era Flow y no nuestro costo» en:
- `lib/mako-tokens-paquetes.ts:39`;
- `lib/mako-tokens-costos.ts:324`;
- `docs/costos-fijos-mako.md:70`;
- `docs/hallazgos-video-pipeline.md:1820`;
- `docs/hallazgos-planes-y-cobro.md:3736`.

Es falso. US$0,15 + 0,025 por s es la tabla de ApiMart del 1.1 Ext (4 s 0,25 · 6 s 0,30 · 8 s 0,35 · 10 s 0,40). Flow cobra
créditos, no dólares.

**Lo que decidió Martín con esto (17/11), la opción B:**
- El Pro trae 10 min (14.400 MT).
- Con US$100 extra se suman 20 min (288 MT por dólar). La barra llega hasta US$100.
- Las columnas dicen minutos, no clips.
- Lo implementa el chat de MaKo Tokens.
- Margen sin los fijos, con el IVA del 21 % en el video: Pro 59 %, el extra 53 %.

**Riesgos sin medir:**
- **De dónde sale el canal Ext.** Cobra ~65 % menos que Google (US$0,0695 por s) y no lo dice. Su doc prevé
  `503 source_channel_unavailable`. Si se corta y hay que pasar al canal normal, el extra de la opción B deja ~7 %.
- **El 3/12/2026** Google empieza a redirigir la 1.1 a la 1.2 (aistudio.google.com/docs/pricing).
- **La cara que habla nunca se probó por ApiMart con el 1.2 Ext.** El clip de prueba, de US$0,24, espera el sí de Martín.
- **Con kling no se gastó nada:** hoy ningún cliente genera video por ApiMart. `generarVideo` (lib/apimart.ts:66) no tiene
  llamador, y el estudio filma por el puente de Flow (app/ai-avatar/filmar.ts:17-18). Los 900 MT sólo inflaban lo que se mostraba.

---

## ⚠️⚠️ PASÓ: el medidor apagó el grupo de WhatsApp de un cliente, y «fallar cerrado» era lo equivocado (16/11/2026)

**El síntoma.** Tickets #103 y #105. En el grupo de MaKo del ws 23 («Marcela Fernandez», cliente de la agencia Código
Inmobiliario, capa Completo) entró el aviso de un lead nuevo. MaKo quiso contestar y no pudo: el error registrado fue
`anthropic/ANTHROPIC_API_KEY: No pude leer tu saldo de MaKo Tokens`. Doce segundos después le contestó AL GRUPO «⚠️ No
puedo contestar: tu negocio todavía no conectó su IA. Para que te conteste aquí, conecta tu GPT (una clave de OpenAI)».
Y la dejó metida en la guía de conexión: su mensaje siguiente —«Ya contactada», que hablaba del lead— lo leyó la guía
como el «listo» de un paso y le contestó que no había quedado conectado. Le tapó la charla normal del grupo.

**La causa.** La `0416` **nunca se aplicó en producción** y el código sí llegó. Las tres RPC no existían, PostgREST
devolvió `PGRST202`, y `gastarMt` falló **cerrado** — exactamente como estaba escrito que hiciera.

**El diagnóstico obvio era el equivocado, y es el hallazgo.** «Fallar cerrado es lo seguro» parece inatacable: si la
caja no contesta, no se gasta. Pero mezcla dos situaciones que no se parecen:

| | qué significa | qué corresponde |
|---|---|---|
| La caja **está** y no contesta | un 500, un timeout, la red | **fallar cerrado**: hay plata que proteger |
| La caja **no está instalada** | la migración no se aplicó | **dejar pasar**: no hay nada que proteger |

**Una caja que no existe no tiene nada que proteger.** Fallar cerrado ahí no protege plata: apaga el producto. Y es la
tolerancia que este repo ya usa a propósito para que el orden de despliegue no importe — la `0283` (21/10/2026) se leyó
*sin aplicar* durante semanas y no rompió nada, porque el código tolera que la columna falte; lo único que pasa es que
no rige lo que la columna habilita.

**La regla que queda** (`laCajaNoEsta`, `lib/mako-tokens-caja.ts`): se mira el **código** del error, no sólo que haya
error. `PGRST202` (función que no está en el cache de esquema), `PGRST205` (tabla), `42883`, `42P01`, `42703` (columna)
= «no está instalada» → no se cobra, **no se frena**, y queda un aviso fuerte en el log. Cualquier otro error sigue
fallando cerrado.

**Y la segunda cara del mismo bug: un `select` con una columna que no existe falla ENTERO.** `saldoDeWorkspace` pedía
`saldo, comprado, cupo_mes`, y sin la `0416` las dos últimas no existen: el `select` daba `42703`, el saldo quedaba
ilegible (`null`), y `alcanzaElSaldo` —que falla cerrado, y bien— frenaba el AI Avatar de **todos los negocios**. Ahora
reintenta pidiendo sólo lo que la `0412` ya tiene. Quien lee lo viejo no necesita lo nuevo.

---

## ⚠️ Un aviso del orden de despliegue en un mensaje de commit NO es un mecanismo (16/11/2026)

Esto estaba escrito, con estas palabras, antes de que pasara: *«La 0416 va antes del código. Si se invierte, lo que se
rompe tiene nombre»*. Estaba en el mensaje de un commit, en este documento, y en el informe. **No sirvió de nada**, y el
motivo no es que nadie lea: es que un aviso no es un mecanismo. Nada en el camino de un push a producción pregunta si
falta una migración.

Lo que sí es un mecanismo, y es lo que quedó: **el código tolera que la migración falte**. El orden deja de importar,
que es la única versión que no depende de que alguien se acuerde.

Y un detalle que vale para la próxima predicción: el aviso nombraba lo que se iba a romper —«el onboarding de un cliente
que acaba de pagar»— y **lo que se rompió fue otra cosa**: un cliente de agencia que ya opera, contestando en un grupo.
El camino que MaKo paga es el **crédito de Claude**, y el crédito es más ancho que el onboarding. Si una predicción
nombra un caso, conviene buscar la lista entera de los que comparten ese camino, no el primero que vino a la cabeza.

---

## ⚠️ Mi propio comentario afirmaba que la cascada no podía quedarse con esta excepción. Podía (16/11/2026)

En `SinSaldoDeMakoTokens` escribí: *«Se tira ANTES de llamar a cualquier proveedor, así que no hay errores de proveedor
que la cascada pueda clasificar mal… el camino no llega hasta ahí»*. **Es falso**, y la prueba llegó de producción.

El enganche del medidor está **adentro** de las funciones que la cascada llama (`chatCheap`, `chatClaude`,
`leerDocumentoIA`…). Cuando una de ellas se llama sin un medidor abierto, la excepción cae justo en el `catch` por
candidato de quien la llamó, que la convierte en un renglón de texto (`anthropic/ANTHROPIC_API_KEY: …`), la mete en la
lista de fallas **del cliente** y prueba el proveedor siguiente. Con todos agotados, la app traduce esa lista a «tu
negocio no conectó su IA».

**La regla:** un wrapper que se engancha **adentro** de una función no puede razonar sobre dónde cae su excepción
mirando su propio código — cae donde está el `catch` de quien llama. Si la excepción tiene que llegar a la persona, hay
que **re-tirarla** en cada `catch` que convierte excepciones en renglones de error. Y la afirmación de fondo es de
diseño, no de implementación: **ningún otro proveedor arregla una falta de saldo**, porque la caja es del NEGOCIO, no
de la clave. Tratarla como «este candidato falló» es decir algo falso.

Son 12 guardas (`if (esSinSaldoDeMt(e)) throw e;`) en `lib/ai-cheap.ts` y `lib/anthropic.ts`.

---

## El test que no se puede escribir, y el estático que lo reemplaza — encontró 4 `catch` que leyendo no vi (16/11/2026)

Con el enganche donde está, el medidor tira **antes** de que el cuerpo de la cascada corra, así que desde un test **no
se puede forzar** la excepción adentro de un `catch` por candidato: el camino que pasó en producción no es alcanzable
desde el arnés. Es una limitación honesta, y aflojarla hubiera sido peor — un test que afirma lo que no prueba.

Lo que sí se puede afirmar sin ambigüedad es **la forma del código**, y eso es el caso 8e: recorre `lib/ai-cheap.ts` y
`lib/anthropic.ts`, encuentra cada `} catch (e) {` y cada `.catch((e) => {`, **acota el bloque contando llaves**, y si
ese bloque arma un renglón de error exige que re-tire el error del medidor. Se pone rojo nombrando el `catch` nuevo.

Dos cosas que vale registrar:

- **Encontró 4 que leyendo el código no vi**: la cascada de Whisper, la de Gemini en STT, el `fetch` del crédito dentro
  de `chatClaude`, y el `catch` que envuelve la cascada gratis en `chatClaude` — ése llama a `chatCheapCascade`, que
  **sí** tiene el medidor. Doce guardas donde yo había puesto ocho.
- **Mirar «los próximos N caracteres» daba un falso rojo.** El `catch` del `fetch` crudo a Gemini quedaba marcado por un
  `.push(` que estaba *después* de su cierre. Contar llaves no es un lujo: sin eso el test pide un guarda donde la
  excepción no puede llegar, y el que lo lea va a aflojar el test en vez de arreglar el código.

---

## El medidor estaba «hecho» y no existía: era una lista de precios sin caja (15/11/2026)

**El síntoma:** `lib/mako-tokens-reglas.ts`, `lib/mako-tokens-paquetes.ts`, la migración `0412` con sus dos tablas,
`lib/uso-del-cupo.ts`, la calculadora de `/planes` y una tarifa operación por operación en
`app/admin/dev/pricing/modelo.ts`. Seis archivos, todos correctos, todos con sus comentarios. Parecía construido.

**La causa real:** ningún código escribía las tablas. `grep -rn mako_tokens_movimientos app/ lib/ supabase/ scripts/`
devolvía **sólo** la propia migración, dos listas de nombres de tablas (`lib/tablas-de-inquilino.ts`,
`lib/workspace.ts`), un script de prueba y un comentario. Nadie acreditaba un cupo y nadie restaba un gasto.

**La regla que queda:** para saber si un medidor mide, no se lee el archivo de reglas — se busca **quién escribe la
tabla**. Un `grep` del nombre de la tabla contra `app/ lib/ scripts/` contesta en dos segundos lo que leer seis
archivos de aritmética no contesta nunca. Vale para cualquier contador: el dato no es la fórmula, es la escritura.

---

## ⚠️ El diagnóstico obvio era el equivocado: copiar la columna `mt` de la tarifa cobra 2,4× de más

**El síntoma que habría tenido:** clientes viendo «te quedaste sin MaKo Tokens» con tres cuartos de su plan sin
usar, y ningún error en ningún log.

**Lo obvio:** ya existe una tabla de MaKo Tokens por operación, `TARIFA` en `app/admin/dev/pricing/modelo.ts`, con
una columna `mt` por operación. Está medida, está comentada, y la decisión que la creó es de Martín. Copiarla es lo
que cualquiera haría.

**La causa real: las dos tablas están en unidades distintas, y nada en ninguna de las dos lo dice.**

| | `TARIFA` (09/08/2026) | la regla vigente (07/11/2026) |
|---|---|---|
| 1 MT es | US$0,001 de **precio de lista** | US$0,001 de **costo real** |
| el markup (2,4×) vive | **adentro del token** (`MARKUP_MT`) | **en el cupo**: es el 25 % del precio del plan |
| analizar una llamada | 15 MT | 8 MT |

El `CUPO_MENSUAL` de hoy (11.750 MT en el plan de US$47) está dimensionado **en costo real**: son los US$11,75 que
deja el margen objetivo. Si además se cobra con markup, el markup se aplica dos veces: el cupo se agota con US$4,90
de costo gastado, o sea **al 40 % del mes**.

**La regla que queda, y está fijada por `tests/mako-tokens-costos.test.ts` caso 1:** en `lib/mako-tokens-costos.ts`
**no se escribe nunca un número de MT a mano**. Se escribe el `costoUsd` medido y el MT lo deriva `mtDeUsd`. La
columna que se copia de la `TARIFA` es `costoUsd`, nunca `mt`.

**El mismo error con los medios, y por eso conviene mirar la fecha antes que el número:** la `TARIFA` dice US$0,05
por segundo de video, marcado «publicado». La medición del 07/11 contra ApiMart, con cuatro generaciones pagadas,
da **US$0,0384** (`USD_POR_SEGUNDO`). Un número «publicado» envejece y no avisa; un número medido tiene fecha. Los
medios salen de `lib/mako-tokens-reglas.ts`, que es donde se midieron.

---

## ⚠️ El bucle infinito de un wrapper que decide no hacer nada — y es la SEGUNDA vez

**El síntoma:** `tests/mako-tokens-medidor.test.ts` no terminaba. 240 s de timeout de `execFileSync`, `ETIMEDOUT`,
**cero errores** y cero salida del hijo. Nada que leer.

**La causa real:** el enganche del medidor en la capa de IA es una **re-entrada**, copiada de la puerta de D6b:

```ts
if (!medidorAbierto()) return conMedidorDeMt(opts.feature, () => chatCheap(opts));
```

La función se llama a sí misma. El wrapper tiene que dejar una marca para que la segunda pasada siga de largo — y
esa marca es el `AsyncLocalStorage`. Cuando `conMedidorDeMt` decidía que ese pedido **no descuenta** (el negocio
corre con su IA, es la plataforma, no hay workspace) devolvía `fn()` a secas, sin abrir el almacén: la re-entrada
volvía a ver `medidorAbierto() === false` y se llamaba otra vez. Para siempre.

**Y ya estaba pagado en este repo.** Está escrito con todas las letras en `lib/solo-su-ia.ts`, revisión adversarial
de IA6 (22/10/2026): *«sin workspace devolvía `fn()` SIN guardar la decisión, y `fn` es la misma función pública, que
volvía a entrar a la puerta: un bucle de microtareas que CONGELABA el proceso entero»*. Volvió porque se copió la
**forma** del enganche sin copiar su **invariante**.

**La regla que queda:** un wrapper que se engancha por re-entrada **abre su contexto SIEMPRE**, también —y sobre
todo— en la rama donde decide no hacer nada. Esa rama es la que nadie prueba, porque «no hace nada» suena a que no
puede fallar.

**Y cómo se prueba, que es la segunda mitad del hallazgo y lo obvio también estaba mal.** El modo de falla no es un
error: es no terminar. Un `assert` no lo ve — y un **`Promise.race` con un `setTimeout` tampoco**, aunque parezca la
cura y aunque esté escrito así en `tests/_d6b-puerta-hijo.ts`. Medido el 15/11/2026 reintroduciendo el bucle a
propósito: con un tope de 20 s, el caso **no volvió nunca**. El bucle es de **microtareas** (cada vuelta resuelve
promesas ya cumplidas y no cede a la cola de macrotareas), así que el `setTimeout` del tope ni se dispara. Es lo que
la revisión de IA6 ya había escrito: *«ni un `setTimeout` corría»*.

Lo único que lo caza es un **tope de proceso**: el caso corre en un hijo y lo que reporta el rojo es el `timeout` de
`execFileSync`, no un assert. Caso 9 de `tests/mako-tokens-medidor.test.ts` con
`tests/_mako-tokens-medidor-hijo.ts`; en el registro de roturas de abajo, la fila de ese bucle es la que **no imprime
ningún caso**, porque el archivo de test entero muere antes.

---

## El embudo del gasto de IA no son las ~30 rutas: es la PUERTA de la capa de IA

**Lo obvio:** las ~30 rutas que llaman `conSuIADelNegocio` (`grep -rln conSuIADelNegocio app/ lib/`) son el
inventario del gasto de IA. Envolver esa función parece ponerlo «en un solo lugar».

**Por qué no alcanza, y las dos razones se ven mirando UNA ruta:**

1. `conSuIADelNegocio` envuelve el **handler entero**, no la llamada al modelo. En
   `app/api/onboarding/avatares/route.ts` el mismo callback atiende `siguiente`, `describir-archivo`, `afinar` y
   `guardar`: cobrarle al wrapper le cobra a `guardar`, que no llama a ninguna IA, y le cobra **una vez** a `afinar`,
   que llama varias.
2. Los caminos que gastan IA son muchos más que 30: 18 crons, 6 webhooks, WhatsApp, Automations, los Analyst, la API
   de MaKo. Y los que quedan afuera son justo **los más caros** (`docs/costos-ia-y-planes.md`: el webhook de Fathom
   proyecta US$52/mes para UN cliente, «más que el plan Pro entero»).

**Dónde está el embudo de verdad:** cada función pública de `lib/ai-cheap.ts`, `lib/anthropic.ts` y
`lib/video-desarmar-gemini.ts` que llama a un modelo arranca con las mismas dos líneas (`exigirPermisoIa()` y
`pasaPorLaPuerta(feature) → conD6bDelPedido(...)`). Son **diez** sitios, y por ahí pasa todo: los 39 archivos con
`conSuIADelNegocio`, los crons, los webhooks y lo que se escriba mañana.

**Y los 39 quedan cubiertos sin tocar ninguno.** Medido el 15/11/2026: 11 llaman derecho a una de las diez entradas,
25 llegan por un helper de `lib/`, y 3 a dos saltos (`landing-analyst-auto` → `landing-analyst` → `chatClaude`;
`spy-oferta-servidor` → `offer-ia`; `app/mako/pendientes/acciones.ts` → la API de MaKo). **Cero rutas modificadas**:
el enganche son 10 líneas en 3 archivos.

**Y la trampa que esto esconde, que es la que importa:** `pasaPorLaPuerta()` devuelve **false** cuando alguien ya
decidió D6b — y las ~30 rutas lo deciden, porque `conSuIADelNegocio` llama a `conSoloSuIA`. O sea que meter el
medidor *dentro* de `conD6bDelPedido` lo habría dejado sin cobrarle **exactamente a las 30 rutas del encargo**, y en
verde: el enganche existe, simplemente no se ejecuta en ese camino. El medidor va en una línea **propia**, con su
propia condición (`!medidorAbierto()`), nunca colgada de la del vecino.

**La regla que queda:** antes de colgar una regla nueva de una condición que ya existe, leer qué la apaga. Dos
reglas que se aplican en el mismo lugar no comparten condición: comparten lugar.

---

## ⚠️ Hoy MaKo no le presta su IA a NINGÚN cliente: el medidor es el candado de una puerta soldada

**El síntoma:** el test del medidor afirmaba que, con saldo, la llamada tenía que llegar a algún proveedor. Daba rojo
con tres escenarios distintos, y el negocio tenía saldo de sobra.

**La causa real**, en `lib/ai-cheap.ts` → `provsGratisDePlataforma`:

```ts
if ((await getWorkspaceActual().catch(() => null)) !== ws) return [];
```

con esta nota al lado, del 22/10/2026: *«LA RED NO CORRE PARA NINGÚN NEGOCIO. Martín: "Cada usuario debe poder pagar su
token, su propia IA de gemini". MaKo no paga ni presta IA a los clientes: sin su IA (su Claude, su GPT o su Gemini),
"Conecta tu IA". Las claves de la plataforma son sólo para lo INTERNO de MaKo (el ws9)»*.

O sea: **un negocio que no conectó su clave hoy no puede generar texto en absoluto.** Es lo que
`docs/costos-ia-y-planes.md` ya decía desde otro ángulo — *«lo que hoy contiene el gasto es un accidente, no un techo: un
cliente sin key propia no gasta, la llamada EXPLOTA»*.

**La única excepción, y es todo lo que MaKo paga hoy de texto de un cliente:** el crédito de Claude del onboarding
(`CREDITO_HABILITADO_PARA`, `lib/veto-claude.ts`), habilitado para **tres** features —`El Archivero`,
`onboarding-extract`, `offer`— y **sólo durante el onboarding**. Más los medios (video, imagen, locución), que los paga
MaKo siempre.

**Lo que esto significa para el encargo del 15/11:** el medidor está completo y en el lugar correcto, y descuenta
exactamente donde la IA de MaKo puede pagar. Pero para que *«todo gasta MaKo Tokens»* sea cierto **hay que volver a
prestarle la IA de MaKo al negocio que no conectó la suya**, y ésa es la decisión que falta: es de plata (cuánto) y de
privacidad (D6b: los datos de los clientes de un negocio no van a una IA gratis que entrena con ellos). **No es un
cambio del medidor**: el día que ese `return []` se abra, lo que pase por ahí ya descuenta solo.

Queda como tripwire en `tests/mako-tokens-medidor.test.ts` caso 2c: afirma que hoy la red NO se presta, con el control
de que el arnés sí puede ver la red (el negocio con su clave llega a su proveedor). El día que la puerta se abra, ese
caso se pone en rojo y manda a leer esto.

---

## El gasto de TEXTO no se sabe antes: se RESERVA el estimado y se LIQUIDA el real

Un segundo de video cuesta US$0,0384 y eso se sabe antes de generarlo. Una llamada de texto cuesta lo que salga de
sus tokens, y eso se sabe **después**. Las tres salidas, y por qué la tercera:

- **Cobrar un estimado fijo y no corregir.** Miente siempre: la distribución de tokens de salida es asimétrica a la
  derecha (media 1,9× a 3× la mediana), así que se cobra de más a la mayoría y de menos a la cola, que es la que duele.
- **No cobrar antes y cobrar el real después.** Deja de cumplirse la propiedad: con saldo cero se dispara una tanda
  entera y se paga después. Es justo lo que el medidor existe para impedir.
- **Reservar el estimado antes, liquidar el real después.** ← ésta.

**Y el enganche de la liquidación ya estaba escrito, en el único lugar del repo que sabe cuánto costó de verdad:**
`recordUsage` (`lib/anthropic-usage.ts`) calcula el `cost_usd` de cada llamada. Se le avisa al medidor desde ahí, y
al cerrar se devuelve lo que sobró o se cobra lo que faltó.

Tres propiedades que caen solas de ese diseño, y son el motivo de elegirlo:

- **una llamada que FALLA no se cobra**: nadie reportó costo, así que la reserva entera vuelve en el `finally`;
- **el estimado no tiene que ser exacto**: decide si la llamada arranca, no lo que se paga. Un `estimado` flojo en la
  tabla de costos no le cuesta plata a nadie;
- **una operación que hace cinco llamadas paga las cinco**, con el costo real de cada una.

⚠️ **Y la trampa fina, que es de orden de líneas:** siete call-sites llaman a `recordUsage` **sin `await`** (en
serverless la instancia se congela con el INSERT en vuelo). El aviso al medidor tiene que ser **sincrónico y estar
antes del primer `await`** de `recordUsage`: la parte sincrónica de una función async corre al invocarla, aunque
nadie la espere. Movido después del `insertUsage`, la liquidación cerraría en cero y **se cobraría siempre el
estimado** — sin error, sin log, y con la diferencia a favor o en contra según la feature. Por lo mismo el import es
estático: un `await import` lo volvería asíncrono y rompería la misma cosa.

---

## El «bloqueante #1 del medidor» no era un bloqueante

`docs/costos-ia-y-planes.md` lo pone primero de los cuatro: *«Hoy es imposible saber cuánto gastó cada cliente en
Claude. `wsDeProveedor()` escribe todas las filas de Anthropic en el workspace 1. Es el bloqueante #1 del medidor»*.

Es cierto para el **informe** de gasto y falso para el **medidor**. El MT se descuenta al workspace **en curso**
(`getWorkspaceActual`), que es el que pidió la llamada; en qué fila de `anthropic_usage` termine anotado el consumo
es otro problema, de atribución contable. El medidor no tenía que esperar a que se arregle, y no esperó.

**La regla que queda:** un «bloqueante» de un documento es una afirmación con fecha, y conviene preguntarle
*bloqueante de qué exactamente*. Dos cosas que usan el mismo dato no comparten su bloqueante si lo usan para
decidir cosas distintas.

---

## El cupo y lo comprado son dos baldes con reglas opuestas, y una sola columna los pisa

**El síntoma que habría tenido:** un cliente compra un paquete de MaKo Tokens el 28 de noviembre y el 1 de diciembre
no está. Plata de alguien que pagó, desapareciendo sola, sin ningún error.

**La causa real:** la `0412` tiene UNA columna `saldo`, y sobre ella rigen dos decisiones contrarias:

- **el cupo del mes se reinicia** (Martín, 07/11: «esos tokens no deberían acumularse»; el porqué entero en
  `lib/uso-del-cupo.ts` — si se acumulara, un cliente que no usó nada en seis meses puede gastar seis cupos de una, y
  la plata de esos meses ya se gastó);
- **lo que compró aparte no se reinicia**: lo pagó («el cupo se reinicia, el saldo comprado no»,
  `docs/costos-ia-y-planes.md` → `compraDelMes`).

Con una sola columna gana el reinicio, porque acreditar el cupo del mes nuevo escribe `saldo = cupo`. Y **no hay
forma de reconstruir el reparto desde el ledger**: una vez gastado, los movimientos no dicen de qué balde salió cada
token.

**Lo que quedó (migración `0416`):** `saldo` pasa a ser *el cupo del mes que queda* y `comprado` es *lo que pagó
aparte*. El gasto sale **primero del cupo**, que es el que se vence. La devolución de una liquidación vuelve **en el
orden inverso** (primero `comprado`, después el cupo), y así la fila queda exactamente como estaba.

⚠️ **Y las dos restas tienen que ser UNA sentencia**, no dos:

```sql
set saldo    = greatest(0, saldo - :cuesta),
    comprado = comprado - greatest(0, :cuesta - saldo)
```

Las dos asignaciones ven el saldo **de antes** (en SQL todas las expresiones del `set` se evalúan contra la fila
vieja), así que `comprado` resta exactamente lo que al cupo le faltó. Escrito como dos `update`, el segundo ve el
cupo ya en cero y le resta todo a `comprado`: **se cobra dos veces**. Caso «las dos asignaciones ven el saldo viejo»
de `scripts/probar-0416-pglite.mjs`.

---

## El cupo se acredita solo, y la idempotencia es un índice, no un `if`

No hay cron que barra todos los workspaces el día 1: el cupo del mes se acredita **la primera vez que ese negocio
necesita saldo ese mes**, dentro de la misma llamada que va a gastar. Un barrido mensual tiene que acertar una fecha
para todos a la vez, y un reintento regala un mes entero de IA; la acreditación perezosa no tiene fecha que errar y
el reintento es gratis.

Lo que la hace segura ya estaba en la `0412`: el índice único **parcial**
`mako_tokens_movimientos_cupo_unico (workspace_id, referencia) where motivo = 'cupo'`, con la referencia siendo el
mes (`cupo:2026-11`).

⚠️ **Y la trampa de SQL que cuesta encontrar: el `on conflict` tiene que REPETIR el predicado del índice parcial.**

```sql
on conflict (workspace_id, referencia) where motivo = 'cupo' and referencia is not null do nothing
```

Sin el `where`, Postgres **no infiere** el índice parcial y el `insert` **tira** en vez de no hacer nada. Probado:
sacándole el predicado, cinco casos de `scripts/probar-0416-pglite.mjs` se van a rojo de una.

Y el orden dentro de la función importa: **primero el movimiento** (que es el candado), **después el saldo**, las dos
en la misma función y por lo tanto en la misma transacción. Si se cayera en el medio, las dos vuelven atrás y el mes
queda sin acreditar — nunca «marcado como acreditado y sin saldo», que sería un mes de IA perdido para el cliente.

---

## Un costo de 0 MT no es «gratis»: es «hoy esta feature rutea a un free tier»

Cuatro features están **medidas en cero**: `mako-guardian` (n=333), `checklist-coach` (n=132), `ads-analyst` (n=18),
`validador` (n=21). El cero es correcto hoy y es una medición del **ruteo**, no de la operación: son free tiers con
límites **por key y por día** que no escalan con la cantidad de clientes (`docs/costos-ia-y-planes.md`: «el free tier
tapa la mitad del costo»; si se agota, el mismo consumo pasa de US$67 a US$99/mes).

Esas features corren con saldo cero, a propósito: no cuestan nada, así que frenarlas no protege ninguna caja. Y se
auto-corrigen: el medidor cobra lo que `recordUsage` midió de verdad, así que el día que una caiga a un modelo pago
empieza a descontar sola, sin que nadie toque la tabla.

**La regla que queda:** una fila con costo 0 lleva escrito POR QUÉ es 0. «Medido en cero» y «gratis» se escriben
igual y se envejecen distinto.

---

## El vocabulario de `feature` no está normalizado, y el costo se busca por igualdad exacta

Medido el 15/11/2026: el código usa **117** valores distintos de `feature`, en cuatro formas que conviven —
`mako-doer-in` (kebab), `second_brain_buscar` (snake), `El Archivero` e `Importar leads` (rótulos con espacios),
`MaKo · nota de voz` (rótulo con separador) — y hay pares que son lo mismo con dos nombres
(`extract-deal-fiscal` / `extract_fiscal`).

`costoDeFeature` busca por **igualdad exacta de string**. Una fila escrita «como debería llamarse» no matchea nada y
esa feature cae al default **sin que nada avise**. Antes de agregar una fila:
`grep -rn "feature: '<lo que sea>'" app/ lib/`.

**Y de paso, medido:** `CATALOGO_MODELOS` (`lib/model-catalogo.ts`) declara **68** de esas 117. Las otras 49 llaman a
un modelo sin declarar cuál usan, así que el override por feature de `/admin` no las alcanza. Queda sin hacer; lo
expone `costosFueraDelCatalogo()` para que el número no haya que volver a medirlo a mano.

---

## Lo automático: la regla de agosto se dio vuelta a medias, y a propósito

La `TARIFA` del 09/08 le puso **0 MT a todo lo automático**, con un argumento que sigue siendo bueno: *«el usuario no
lo dispara ni lo puede parar: cobrarle cuota por un cron es que abra la app y la encuentre vaciada por algo que no
hizo»*.

Pero cobrar 0 por lo automático deja **sin medidor al que más gasta** (el mismo documento proyecta el webhook de
Fathom en US$52/mes para un cliente, y cinco de esos caminos iteran todos los workspaces activos). Un medidor que no
mira al mayor gastador no protege la caja.

Lo que quedó separa **cobrar** de **avisar**: lo automático **descuenta igual** y queda en el ledger; y si no alcanza,
**no se le muestra un error a nadie** — el camino automático saltea a ese negocio esta vuelta
(`SalteadoSinSaldo`) y lo anota. Las dos cosas que la regla de agosto quería, sin el agujero.

**Es una decisión de plata: la decide Martín.** Está marcada así en `lib/mako-tokens-costos.ts` → `fallaBlanda`.

---

## Enganchar el medidor puso en rojo dos tests de D6b que no lo mencionan, y eso avisó de algo peor

**El síntoma:** `tests/d6b-puerta.test.ts`, casos 3 y 4, en rojo. Ninguno habla de MaKo Tokens: prueban que un negocio
sin su IA escucha sus notas de voz con su Groq, y que sin workspace la puerta vuelve.

**La causa real:** esos tests corren **las entradas de verdad** de la capa de IA contra un PostgREST de mentira. Desde
que el medidor vive ahí adentro, toda llamada a un modelo pide saldo antes de salir — y una RPC que nadie mockeó
contesta `[]`, con lo cual el medidor **falla cerrado, como está diseñado**, y frena todo. El arreglo va en
`tests/_postgrest-de-mentira.ts`: la caja contesta «alcanzó» por defecto, para que cada test siga probando lo suyo (la
caja tiene su propia prueba contra un Postgres real).

**Y lo que ese rojo destapó, que era lo importante: el medidor rompía el alta de todo cliente nuevo.** Un negocio que
todavía no paga un plan **no tiene cupo** (`cupoDeCapa` devuelve null para cualquier capa que no sea `completo` o
`agencia`). Pero MaKo sí le paga la IA de tres cosas en su primer ingreso, por decisión de Martín: el crédito de Claude
del onboarding, habilitado para `El Archivero`, `onboarding-extract` y `offer` («Por ahora solo en onboarding»). Con el
medidor cobrando parejo, el primer ingreso de cada cliente nuevo se quedaba sin leer sus documentos ni armar su oferta,
con un «te quedaste sin MaKo Tokens» **antes de haber usado nada**.

**Lo que quedó:** esas tres features no se cobran **cuando el negocio no tiene cupo todavía**. Es el único lugar del
medidor que falla ABIERTO, y se justifica porque ese gasto **ya tiene su propio techo, y más angosto que un cupo**:
tres features, sólo durante el onboarding, con una clave que no sirve para nada más y con fecha de vencimiento. El
corte es `cupo == null` y no la feature sola, así la excepción **se cierra sola** el día que el negocio pasa a pagar un
plan.

**La regla que queda:** un medidor nuevo en un camino compartido se prueba contra los tests que YA existen de ese
camino, no sólo contra los propios. Los ajenos son los que conocen los casos que uno no pensó — acá, que hay un negocio
al que MaKo le paga la IA a propósito y que todavía no es cliente.

---

## Dos trampas del arnés de pruebas, que costaron un rojo cada una

Para probar que el medidor le cobra a alguien hace falta un negocio al que la IA se la pague MaKo. Dos elecciones
razonables que no sirven:

- **Darle una clave de Claude, OpenAI o Gemini**: pasa a ser «su IA» (`CLAVES_SU_IA`, `lib/ia-del-negocio.ts`) y queda
  exento. El test no ve nada.
- **Darle una clave de GROQ**: no es «su IA», así que el medidor sí actúa… pero **Groq no contesta texto**
  (`PROVS_SOLO_AUDIO`, IA16, Martín 22/10: «Groq sólo para las notas de voz»), así que la cascada de texto se queda sin
  candidatos y la llamada no sale a ningún proveedor — que es **exactamente** lo que el test afirma cuando NO hay saldo.
  El verde del caso que importa y el rojo del que no se vuelven indistinguibles.

**La regla que queda:** un test que afirma «no salió a ningún proveedor» necesita, al lado, un control que demuestre que
el arnés **sí puede ver** la red. Sin ese control, una lista vacía prueba lo mismo que un arnés roto.

---

## ⚠️ El orden de despliegue: la 0416 va ANTES del código, y qué se rompe si no

La `0412` ya lo dejó escrito, y vale igual para la `0416`: *«esta migración va PRIMERO y el código después. Sin las
tablas… falla CERRADO, así que lo peor que pasa es que no se genere — nunca que se genere gratis»*. Eso era barato
cuando nada usaba el medidor. Ahora algo lo usa, así que conviene saber **exactamente** qué se rompe si el código llega
a producción antes que la migración, porque no es «nada» y tampoco es «todo»:

- **La RPC no existe → PostgREST devuelve error → `gastarMt` falla cerrado → la llamada no corre.** Sólo para los
  pedidos donde `soloSuIA()` es false, o sea los negocios que no conectaron su clave.
- **Casi ninguno de esos puede generar texto hoy de todas formas** (la red de la plataforma no se presta: ver más
  arriba), así que no cambia nada para ellos.
- ⚠️ **Lo que SÍ se rompe: el onboarding de un cliente que acaba de pagar.** Tiene `capa: completo` o `agencia`, así
  que tiene cupo, así que **no** entra por la excepción del crédito del onboarding (que es para quien todavía no paga)
  — y su primer ingreso corre sobre el crédito de Claude de la plataforma. Sin la migración, ese alta queda sin leer
  sus documentos ni armar su oferta.

**Y no hay tabla de migraciones en este repo**: `scripts/apply-migration.mjs` ejecuta el archivo y no deja registro
(por eso existe `scripts/verificar-migraciones-aplicadas.mjs`, que lo comprueba contra el catálogo de Postgres). O sea
que «ya se aplicó» no se puede dar por hecho: se comprueba.

**Al aplicar, correr `scripts/probar-concurrencia-saldo.mjs`**: es lo único que ejercita la carrera de verdad (30
conexiones, 200 pedidos a la vez), y es el motivo de que el chequeo y el descuento sean la misma sentencia. Hoy ese
script prueba el `update` de la `0412`; conviene sumarle las funciones nuevas.

---

## ⚠️ «No tiene ninguna key» dejó de significar «le falta configurar algo» (16/11/2026)

El clasificador de fallas de IA (`causaDelFallo`, `lib/fallo-ia-texto.ts`) empezaba así:

    if (keysDelCliente === 0) return 'sin_keys';

Era un atajo correcto mientras **cada negocio pagaba su IA**: sin una key cargada no había nada que discutir, y
cualquier error era secundario. Desde el 15/11/2026 la IA la paga MaKo, así que **no tener ninguna key es el estado
normal de un cliente que funciona bien** — y ese primer `if` pasó a ganarle a cualquier error, incluido el del medidor.
Resultado: a una clienta que se quedó sin saldo (o cuyo saldo no se pudo leer) la app le contestó «conecta tu GPT (una
clave de OpenAI)». Falso dos veces: no le falta una key, y la IA no la paga ella.

**La regla:** cuando una decisión de producto cambia qué es «normal», hay que revisar los atajos que daban por hecho lo
contrario. Un `if` que era un atajo se vuelve una respuesta equivocada sin que nadie toque una línea.

Quedó la causa `sin_tokens`, chequeada **antes** de «no tiene keys», y su cartel **repite el mensaje del medidor** en
vez de escribir el suyo: ahí está el número que falta y las dos salidas (sumar MaKo Tokens, o conectar su IA y dejar de
descontar del cupo). Un texto propio en el cartel quedaría desincronizado del que la persona ve en la app.
`causaDelCartel` la deja en `null` a propósito: quedarse sin saldo no es un bug ni un problema de configuración, así
que no abre ticket.

---

## ⚠️ Un error mal clasificado no termina en un cartel: SECUESTRA la conversación (16/11/2026)

Esto es la parte del #105 que no se ve venir, y es la que más molesta al cliente. La cadena completa:

1. El medidor falla → la cascada lo clasifica como «este candidato falló».
2. Con la lista de fallas agotada y cero keys, la causa sale `sin_keys` → **«configuración del negocio»**.
3. Eso **ofrece la guía de conexión por WhatsApp**, y la oferta **se guarda** (`setSetting(claveAyuda(jid), …)`).
4. El mensaje **siguiente** de la persona —cualquiera— lo lee la guía como la respuesta a su paso. «Ya contactada», que
   hablaba de un lead, se leyó como el «listo» de «ya conecté mi clave».
5. MaKo le contestó que no había quedado conectado, y abrió un ticket que dice «es de la configuración del negocio, no
   del código: se cierra solo cuando el negocio lo tiene» — un ticket que **nunca se iba a cerrar**, porque no había
   nada que el negocio pudiera configurar.

**La regla:** un error NUESTRO clasificado como «configuración del negocio» no cuesta un cartel, cuesta la
conversación. Toda causa que abra una guía con estado guardado tiene que ser una que la persona pueda **resolver**; si
no, la guía se queda esperando un «listo» que nunca va a llegar y se come los mensajes de verdad.

(La guía en sí no deja estado *después* de verificar: `despuesDeVerificar` con `conectada: false` devuelve
`siguiente: null`. Lo que quedaba pegado era la **oferta**, antes de empezar.)

---

## Qué quedó sin hacer

- ⚠️ **Lo más importante: volver a prestarle la IA de MaKo al negocio que no conectó la suya.** Sin eso, «todo gasta MaKo
  Tokens» no se puede cumplir, porque hoy no hay nada que gastar (ver más arriba). Es decisión de Martín: plata y
  privacidad. El medidor ya está listo para cuando se abra.
- **Dos caminos de IA que no pasan por la capa de IA** y por lo tanto no descuentan: `lib/embeddings.ts` (corre en
  CADA búsqueda del RAG y no llama a `recordUsage`) y `lib/transcribe-plataforma.ts` (el audio de las clases de los
  cursos, con `envCred`, que siempre cae al workspace dueño). Son los dos «puntos ciegos» que
  `app/admin/dev/pricing/modelo.ts` → `BLOQUEANTES` ya listaba.
- **Los MEDIOS: la pieza está escrita (`cobrarMediosMt` / `devolverMediosMt`) y no hay a qué engancharla todavía**, y
  conviene saber por qué antes de buscarle el lugar. Medido el 15/11/2026:
  - **el video y las imágenes salen por el Google Flow DEL CLIENTE** (`lib/flow-cola.ts` y compañía), así que MaKo no
    paga nada;
  - **la locución sale por el ElevenLabs DEL CLIENTE**: `lib/elevenlabs.ts` resuelve con `credDelCliente`, no con
    `credWs` («ES `credDelCliente` Y NO `credWs`, Y LA DIFERENCIA ES UNA SOLA LÍNEA SUYA»);
  - **ApiMart sí la paga MaKo** (Martín, 7/11: «para que nosotros costeemos eso») pero `generarVideo`
    (`lib/apimart.ts`) **no lo llama nadie**: `grep -rn "generarVideo(" app/ lib/` devuelve su propia definición y un
    comentario de `lib/flow.ts`. Está escrito de punta a punta y sin conectar.

  O sea que **hoy no existe ningún camino de medios en el que MaKo pague**, y por eso la pieza queda esperando. El día
  que se enganche `generarVideo`, el cobro va ahí y en el mismo commit — un generador que MaKo paga y que no descuenta
  es el agujero más caro que puede abrirse, porque un reel son 412 MT contra los 8 de un análisis de llamada.
- **Nadie acredita una COMPRA todavía.** `acreditarCompra` existe y exige una `referencia` del pago (es lo único que
  impide que un reintento del webhook de la pasarela acredite el paquete dos veces), pero el webhook no la llama: no
  hay pantalla para comprar MaKo Tokens. El mensaje de «te quedaste sin saldo» ofrece sumar más y todavía no hay
  dónde.
- **El Acelerador no tiene cupo**, a propósito: `cupoDeCapa` devuelve null para cualquier capa que no sea `completo`
  o `agencia`. Un negocio en el Acelerador va a poder gastar sólo lo que haya comprado. Nadie decidió el número y el
  código no lo inventa.
- **La concurrencia de verdad no está probada contra la `0416`.** `scripts/probar-0416-pglite.mjs` corre contra un
  Postgres real pero de **una sola conexión**, así que la carrera —que es el motivo de que el chequeo y el descuento
  sean la misma sentencia— no se puede ejercitar ahí. Lo que la prueba es
  `scripts/probar-concurrencia-saldo.mjs` (30 conexiones, 200 pedidos a la vez), y hay que correrlo **después de
  aplicar la migración**; hoy sólo ejercita el `update` de la `0412`, no las funciones nuevas.
- **Los `estimado` de la tabla de costos son 80 de 104 filas.** No le cuestan plata a nadie (el medidor liquida con
  el costo real), pero deciden si una llamada arranca: son lo primero a recalibrar con `anthropic_usage` cuando haya
  meses suficientes.

---

## Probado rompiéndolo

`scripts/probar-0416-pglite.mjs` (18 casos contra un Postgres de verdad), una rotura por vez, restaurada:

| rotura | casos en rojo |
|---|---|
| el cupo del mes se SUMA en vez de reemplazar | 2 (no se acumula · no borra lo comprado) |
| el gasto sale primero de lo comprado | 2 (el orden de los baldes · la devolución) |
| el chequeo mira sólo el cupo y se olvida de lo comprado | 4 |
| el `on conflict` sin el predicado del índice parcial | 5 (la migración ni aplica) |

`tests/mako-tokens-medidor.test.ts` (13 casos, con el hijo corriendo las entradas REALES de la capa de IA contra un
PostgREST de mentira), una rotura por vez, restaurada:

| rotura | casos en rojo |
|---|---|
| el medidor loguea en vez de frenar | 3 (sin saldo sale a la red · la feature sin mapear · lo automático) |
| la exención de «su IA» sacada | 2 (le cobra al que paga su clave · y el control de la red) |
| el bucle de vuelta (`return fn()` sin abrir el almacén) | **ninguno: el archivo de test entero muere por timeout** |
| el enganche sacado de `chatCheapCascade` | 6 |

`tests/mako-tokens-costos.test.ts`: 10 casos, puros.
**Las roturas del arreglo de los tickets #103 y #105 (16/11/2026)**, una por vez, restaurada cada una:

| rotura | casos en rojo |
|---|---|
| la tolerancia a la caja ausente sacada (vuelve a fallar cerrado) | 8c |
| `laCajaNoEsta` devolviendo siempre false | 8c |
| un guarda `esSinSaldoDeMt` sacado de la cascada | 8e, **nombrando el `catch`** |
| el chequeo de `sin_tokens` sacado de antes de `keysDelCliente === 0` | el caso nuevo de `fallo-ia-texto`, con `'sin_keys'` |

`tests/fallo-ia-texto.test.ts`: 20 casos (uno nuevo, el de los tickets).

## La caja, prendida: la 0416 en producción y lo que cambia para los clientes de hoy (19/11/2026)

- **Aplicada y probada en producción** dentro de una transacción que se deshizo sola (ws 3): el primer gasto del mes acredita el cupo UNA vez (7.000), dos gastos
  descuentan 100 cada uno, uno de 999.999 devuelve `ok: false` sin tocar nada, la devolución suma. Después: 0 filas en las dos tablas. No hizo falta desplegar: el
  código ya estaba y toleraba la caja ausente (`laCajaNoEsta`).
- **Medido antes (30 días, `anthropic_usage`, sólo lo que paga MaKo: el crédito de Claude de la plataforma):** Mauricio (ws 1) US$ 4,35 ≈ **4.350 MT de 7.000 (62 %)**;
  Código (ws 13) ≈ 1.010 de 14.400; los demás, menos de 500. Lo que va por la red gratis de Gemini cuesta 0 y no descuenta. **Nadie llega al tope con el uso de hoy.**
  (La medición del 17/11 decía 8.680 para Mauricio porque le ponía precio de Gemini pago a lo gratis.)
- ⚠️ **Lo que el número no muestra:** ~US$ 0,53/mes de ese gasto de Mauricio son «Medición en seco» (pruebas de los chats de Claude que corren con el contexto del
  ws 1): desde hoy le comen cupo a un cliente. ⚠️ **Leila paga Pro (US$ 97) y recibe el cupo de Essential (7.000)**: `cupoDeCapa` sale de la CAPA (`completo` →
  Essential), y su plan Pro vive en la config de su mensualidad (`cicloPropio.plan`). Hoy usa su propia IA (no le descuenta), pero el número está mal.
- ⚠️ **Lo que lee el saldo para MOSTRARLO no suma el cupo del mes todavía no acreditado:** `saldoDeWorkspace` lee la fila tal cual; el cupo se acredita recién con el
  primer gasto del mes. Hoy nadie la llama (el AI Avatar pide `saldoMt` y nadie se lo pasa), pero quien la use para decir «te quedan X» antes del primer gasto
  del mes va a decir 0 o lo del mes pasado.
- **Sin hacer:** `scripts/probar-concurrencia-saldo.mjs` no se corrió (escribe en el ws 9 y prueba el `update` de la 0412, no las funciones nuevas).
