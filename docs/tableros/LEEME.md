# Los tres tableros de Martín — 7/11/2026

Tres páginas que Martín mira en el panel del costado mientras trabaja. **Viven acá porque antes
vivían sólo en su carpeta de Escritorio, que no es un repo: se perdían con la carpeta.**

## Cómo se abren

```
node docs/tableros/servir-numeros.mjs
```

| Ruta | Qué muestra |
|---|---|
| `http://localhost:4179/` | **Los números**: lo que queda por cantidad de clientes, quién paga qué, los cupos por plan |
| `http://localhost:4179/plan` | **Las landings y el contenido**: las 8 landings con su ángulo, y el calendario de 21 piezas |
| `http://localhost:4179/estrategia` | **La estrategia de adquisición**: las tres fases y la cadena eslabón por eslabón |
| `http://localhost:4179/l/setter` | **La primera landing**, entera, como la ve un visitante — no una especificación |

(Los pendientes depurados van aparte, en `servir-pendientes.mjs`, puerto 4178.)

## De dónde salen los números

**No están escritos a mano.** Cada uno sale de una medición o de un archivo del repo:

| Número | De dónde |
|---|---|
| US$0,412 el clip de 10 s | medido el 7/11 contra ApiMart (`docs/hallazgos-video-pipeline.md`) |
| Pasarela 1,80% / 7,61% / 5,75% | `docs/estrategia-financiera-mako.md` §2 y la recomendación 3 |
| Impuesto 8,36% | ídem, monotributo H |
| Gasto fijo y quién paga cada cosa | `lib/costos-fijos.ts` (`quienPaga`, `parteDeMartin`) |
| 22,2 meses de vida del cliente | churn 4,5%/mes, benchmark SaaS pymes |
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
| «4 minutos de video por mes» | el cupo nuevo del plan de US$97, ver más arriba |
| «7 días, sin tarjeta» | **lo decidió Martín, no está construido todavía** |

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
