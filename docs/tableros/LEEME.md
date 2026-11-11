# Los tres tableros de Martín — 7/11/2026

Tres páginas que Martín mira en el panel del costado mientras trabaja. **Viven acá porque antes
vivían sólo en su carpeta de Escritorio, que no es un repo: se perdían con la carpeta.**

> ⚠️ **«Los números» pasaron a SuperAdmin › Analytics › Costs** (`/admin/analytics/costs`, 10/11/2026): a dónde va lo que
> paga un cliente del 47 y del 97 (con los selectores de clientes, CAC, uso del cupo, pasarela, impuesto y fijo), el primer
> mes, el techo del CAC y los cupos por plan. Los arma `loQueSeVaDeUnaSuscripcion` (`lib/economia-unitaria.ts`), la misma
> función que la torta de `/admin/estrategia`. `numeros-mako.html` queda como estaba, para mirar lo que no se mudó (las altas
> del mes y lo que cuesta llegar a 50 clientes; ver `docs/relevo/nube-costs-suscripcion.md`), pero **los números que valen
> son los de Costs**: los del HTML están escritos a mano y no se actualizan solos.

## Cómo se abren

```
node docs/tableros/servir-numeros.mjs
```

| Ruta | Qué muestra |
|---|---|
| `http://localhost:4179/` | **Los números** (ya en Admin › Analytics › Costs): lo que queda por cantidad de clientes, quién paga qué, los cupos por plan |
| `http://localhost:4179/plan` | **Las landings y el contenido**: las 8 landings con su ángulo, y el calendario de 21 piezas |
| `http://localhost:4179/estrategia` | **La estrategia de adquisición**: las tres fases y la cadena eslabón por eslabón |
| `http://localhost:4179/l/<slug>` | **Las landings**, enteras, como las ve un visitante. Siete: `setter`, `paginas`, `anuncios`, `numeros`, `llamadas`, `cursos`, `plan` |

## Las landings: un molde, siete contenidos

```
node docs/tableros/landings-contenido.mjs docs/tableros
```

`generar-landings.mjs` tiene **el diseño, una sola vez**. `landings-contenido.mjs` tiene **sólo
datos**: una entrada por landing. Así las siete son literalmente la misma página con otro texto, y
un cambio de diseño sale en las siete a la vez. El servidor sirve `/l/<slug>` →
`landing-<slug>.html` sin lista a mano.

⚠️ **Falta la octava, `/l/avatar`, a propósito:** `AI_AVATAR_SE_VENDE = false`
(`lib/planes-comparacion.ts`). La tab está abierta en los tres planes desde el 29/10, pero el avatar
**no se vende** y se paga con los créditos de Google Flow de la persona. Venderlo en una landing es
prometer algo que el checkout no da. **Es una decisión de producto de Martín**, no un olvido.

⚠️ **Y `/l/llamadas` NO usa los números del plan** («de 18% a 31% de cierre, −40% de ausencias»):
ésos son resultados de **CloseOS**, un competidor. Ponerlos como prueba en una página de MaKo los
hace pasar por nuestros. La landing dice lo que MaKo hace, que sale del `incluye` del plan.

(Los pendientes depurados van aparte, en `servir-pendientes.mjs`, puerto 4178.)

## De dónde salen los números

**No están escritos a mano.** Cada uno sale de una medición o de un archivo del repo:

| Número | De dónde |
|---|---|
| US$0,412 el clip de 10 s | medido el 7/11 contra ApiMart (`docs/hallazgos-video-pipeline.md`) |
| Pasarela 1,80% / 7,61% / 5,75% | `docs/estrategia-financiera-mako.md` §2 y la recomendación 3 |
| Impuesto 8,36% | ídem, monotributo H |
| Gasto fijo y quién paga cada cosa | `lib/costos-fijos.ts` (`quienPaga`, `parteDeMartin`) |
| 9 meses de vida del cliente (eran 22,2) | decisión de Martín del 10/11 (`MESES_DE_VIDA`), hasta que haya bajas reales; antes, churn 4,5%/mes del benchmark de SaaS pymes |
| Los ángulos de las 8 landings | `docs/como-venden-otros.md` §3 |
| El estado de cada eslabón de la cadena | verificado contra el código el 7/11 |

## ⚠️ Dos cosas que se separaron a propósito y no hay que volver a juntar

1. **La pasarela NO es el impuesto.** Hasta el 7/11 se usaba un 15% único que mezclaba pasarela
   (5,75%), impuesto (8,36%) y giro (0,7-1,1%). Martín: «el impuesto lo puedo diferir, o entrar en un
   plan, y hoy el monotributo lo paga 100% Leandro». Con Mercado Pago a 35 días la pasarela sola es
   **1,80%**, y juntarlas hacía que el negocio pareciera mucho peor de lo que es: la diferencia por
   cliente es de US$79,68 a US$92,48.
2. **El cupo de IA es un TECHO, no un costo.** Sólo se gasta si el cliente genera. Entre que nadie
   use el cupo y que todos lo agoten hay US$11,09 por cliente por mes (con los cupos nuevos).

## La landing: de dónde sale cada afirmación

`landing-setter.html` es la primera de las 8 de `/plan`. **Las 7 que faltan se copian de ésta**, así
que lo que importa no es el HTML sino de dónde sale cada frase:

| Afirmación en la página | De dónde |
|---|---|
| «un setter: US$800 – 2.000 por mes» | `docs/como-venden-otros.md` §3, el blog en español de SetSmart |
| «dos o tres meses hasta que rinde», «se va» | ídem, Setterflo (rotación del 34%) |
| «no usa la API oficial, sale con tu número» | Evolution — es cómo está construido, no un argumento de venta inventado |
| «la IA la ponés vos» | BYOK: el negocio conecta y paga **su** cuenta. Es lo que explica el precio |
| «para aprobar» / «sólo te avisa» | `lib/nutricion-grafo-motor.ts` ~1554: son los tres ajustes reales por escenario |
| «nunca sola con dinero» | ídem, `libertadesPermitidas` — un caso con plata no se puede poner en «Sola» |
| «cancelas cuando quieras», sin prueba gratis | `LINEA_SIN_PRUEBA`, porque `PRUEBA_GRATIS_PRENDIDA = false` |
| lo que incluye el plan | el `incluye` de `pro` en `lib/planes-mako.ts`, textual |

## ⚠️ Lo que la primera versión de la landing decía y era FALSO

La escribí entera antes de abrir el código, y de las afirmaciones «obvias» **tres estaban mal**.
Sirve de aviso para las 7 que faltan, porque son errores que no da ninguna herramienta:

1. **«7 días gratis, sin tarjeta»**, tres veces, incluido el botón. `PRUEBA_GRATIS_PRENDIDA =
   false` desde el 30/10: **no existe**. Hay hasta una constante puesta para este caso,
   `LINEA_SIN_PRUEBA` («Cancela cuando quieras · Usas tu propia IA»), con el comentario «una
   landing publicada no puede seguir prometiendo días gratis». La inventé yo: nadie la pidió.
2. **«4 minutos de video con avatar por mes».** El avatar con IA **no se vende** todavía
   (`AI_AVATAR_SE_VENDE`), y `lib/planes-mako.ts` lo dice en un comentario al lado del
   `incluye` justamente para que no se cuele. Y el cupo nuevo tampoco está aplicado.
3. **Toda la página estaba escrita de vos** («vos entrás», «cerrás», «anda el primer día»).
   **La audiencia es México**: el copy va en español neutro, y el `incluye` del propio plan
   ya estaba escrito así («¿Ya vendes?», «tú decides»).

**La regla que queda:** el `incluye` del plan y las constantes de `lib/planes-mako.ts` son la
oferta; la landing las copia, no las propone. Y antes de publicar, el voseo se mide con el
diccionario del repo (`voseoEn` de `lib/voseo.ts`), no a ojo — el test que lo vigila barre
`app/`, `lib/` y `components/`, así que un HTML en `docs/` **pasa en verde estando mal**.

**La regla al escribir las otras 7: ninguna frase sin fuente.** Las dos que más tentación dan de
inventar son el número contra el que se compara (el sueldo del humano) y el resultado prometido.
Si no hay de dónde sacarlo, la frase no va: una landing que promete lo que el producto no hace
devuelve el reembolso dos semanas después, con la reseña puesta.

Dos cosas de la página son deliberadas y conviene no «mejorarlas»:

- **La sección «Para quién NO es»** espanta al que iba a pedir reembolso. Está en 1 de cada 3
  competidores que venden caro y en ninguno de los baratos.
- **La conversación del chat no dice «ejemplo»**, dice «Así se ve» y muestra horarios de las 3 de
  la mañana. Es una ilustración honesta, no una captura real: no la presentes como un caso de
  un cliente.

## ⚠️ Y un error de redacción que costó una conversación entera

La pantalla de Costs decía «con 10 clientes son US$43,83 **por cliente**» — que es el gasto fijo
dividido por los clientes. Martín lo leyó como lo que le queda: «¿cómo vendiendo 10 me quedo con 44
dólares?». **Un número suelto en dólares al lado de la palabra «clientes» se lee como ganancia.**
Cuando un número es un costo repartido, la frase tiene que decirlo.
