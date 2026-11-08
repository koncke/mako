# Ticket #63 — los flujos de comentarios de Instagram no entregan nada (7/11/2026)

**Lo reportó Leandro Tejado (ws 10, plan Completo) el 8/11 00:01**, con evidencia de base. Está
clasificado «esperando decisión de Martín» porque toca envíos.

**La gravedad, antes que nada: del 5 al 7 de noviembre, de 10 leads que tocaron «Obtener recurso»
en las secuencias 707, 708 y 710, NUEVE terminaron cancelados sin recibir nada. En esos tres días no
se entregó un solo recurso.** Por el criterio de Martín (cliente roto > plata > traba > features)
esto va antes que cualquier cosa de la lista depurada.

## El síntoma, en las palabras del reporte

El lead comenta en un reel, entra a la secuencia y recibe el primer DM con el botón «Obtener
recurso». Lo toca, **MaKo avanza bien por el grafo** (sale de `nlcjml0`, pasa la condición `n7ecwkh`
y llega a `nem81on` o a `n4wu86y`), **pero no sale ningún mensaje**: `ultimo_envio` se queda en el
primer DM. Una hora después, **siempre a los `:00:25`**, la inscripción figura cancelada.

## Lo que establecí leyendo el código (sin tocar producción)

### 1. Los «:00:25» son el cron de nutrición

`/api/cron/nutricion` corre `0 * * * *` (`vercel.json`). La cancelación la hace **esa corrida**, 25
segundos adentro. No es un timeout del lead ni nada inmediato. **Eso contesta la pregunta 2 de
Leandro** para los nueve casos del 5 al 7/11.

### 2. El camino de «el DM falló» a «cancelada», y por qué no se ve el motivo

Está en `lib/nutricion-hilos.ts`. Un mensaje que **«no va a poder salir NUNCA»** cierra su hilo, y si
era el último hilo vivo la inscripción termina con estado `cancelada`:

```ts
if (!out.length) {
  const estado = cambio.cierra && cambio.estado === 'cancelada' ? 'cancelada' : 'completada';
  return { hilos: null, resumen: { nodo_actual: null, proximo_envio_at: null, estado }, descartados };
}
```

Por eso en `inscripciones_lead` queda **sólo «cancelada», sin ningún motivo**, y mirando la API
parece que el lead recibió el mensaje. **Ésa es exactamente la pregunta 3 de Leandro**, y ese cierre
es el lugar donde habría que guardar el porqué. ⚠️ Eso pide una migración: vuelve a Martín.

### 3. La hipótesis de Leandro NO explica los nueve, pero sí la segunda prueba de Martín

Leandro pregunta si MaKo cancela una inscripción nueva cuando el lead tuvo otra hace poco. Existe la
guarda `en_curso` (`lib/nutricion-inscripcion-manual.ts`: «ya está en la secuencia y sigue en curso:
no se inscribe dos veces»), **pero ésa IMPIDE inscribir, no cancela una inscripción existente.**

Sin embargo, encaja con la **segunda** prueba en vivo: Martín comentó «Guia» a las 23:53 teniendo
otra inscripción viva de las 23:41, y quedó cancelada **en el acto**, con `ultimo_envio` y `tarjeta`
en `null`. **Son dos fallas distintas y conviene no mezclarlas:** nueve cancelaciones por el cron
tras un envío fallido, y una cancelación inmediata por colisión de inscripciones.

## Lo que falta, y necesita producción

**La pregunta 1: qué error devolvió el envío de `nem81on` / `n4wu86y`.** Está en los logs. Todo lo de
arriba explica **cómo** un envío fallido termina en «cancelada», pero no **por qué** falla el envío
de Instagram justo después del toque del botón.

**La pista más corta:** el único al que SÍ le llegó el mensaje fue **@jarredramirrez (lead 5940,
secuencia 709)**. Comparar esa inscripción con las otras nueve es probablemente el camino.

⚠️ **Y un dato del reporte que descarta la sospecha fácil:** apagaron ManyChat y el problema siguió.
No es otra app contestando en la misma conversación.
