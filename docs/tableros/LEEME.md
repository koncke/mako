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

## ⚠️ Y un error de redacción que costó una conversación entera

La pantalla de Costs decía «con 10 clientes son US$43,83 **por cliente**» — que es el gasto fijo
dividido por los clientes. Martín lo leyó como lo que le queda: «¿cómo vendiendo 10 me quedo con 44
dólares?». **Un número suelto en dólares al lado de la palabra «clientes» se lee como ganancia.**
Cuando un número es un costo repartido, la frase tiene que decirlo.
