# Ticket #63 — los flujos de comentarios de Instagram no entregan nada (7/11/2026)

## ✅ CERRADO el 8/11/2026: Leandro cambió el ajuste de Meta y quedó andando

Medido contra la base: **el último fallo fue el 7/11 a las 23:53**, y desde las 00:00 del 8/11 los
cuatro envíos salieron bien — **incluidos `nem81on` y `n4wu86y`, los dos que entregaban el recurso y
que fallaban el 42-50% de las veces**. La causa era la que se diagnosticó: el receptor primario de
Meta (subcode 2534037), y el arreglo fue el ajuste de `conversation_routing` de su Página.

### ⚠️⚠️ LA LECCIÓN QUE DEJA, Y ES LA CARA: UN ENVÍO QUE FALLA QUEMA LA VENTANA DE 24 HORAS

**19 leads reales comentaron, recibieron el primer DM, tocaron el botón y no recibieron nada.** Al
arreglarlo, **sólo a 2 se les podía volver a escribir**: a los otros 17 ya se les había pasado la
ventana de 24 horas de Meta (`ig_conversaciones.ventana_expira_at`), y la API no deja.

**O sea que el daño de un envío roto NO es el mensaje perdido: es que para cuando te enterás, ya no
hay forma de alcanzarlos.** Nueve días rotos = 17 personas que levantaron la mano y quedaron
inalcanzables por automatización. Eso convierte «que el sistema avise solo cuando un envío falla» de
una mejora cómoda en la que decide si se recupera o no a la gente.

Lo único que queda es que el dueño de la cuenta les escriba **a mano desde su teléfono**, que no está
sujeto a esa ventana. La lista se le pasó a Leandro el 8/11.

### ⚠️ Y el ticket #64: NO hace falta elegir receptor primario. Sacar la app rival ES el arreglo

Leandro abrió el #64 trabado en el último paso: entró como la Página a `ig_conversation_routing`,
tocó «Selecciona una app de enrutamiento predeterminada» y **el desplegable salió VACÍO**.

**No es un error y no hay que arreglarlo: Meta sólo pide elegir receptor cuando hay más de una app
disputándose la conversación.** Al quitarle los permisos a ManyChat dejó de haber disputa, así que no
hay nada que elegir y los hilos quedan para la única app con permiso. **Por eso ya funcionaba
mientras él creía que le faltaba un paso.**

La app nuestra aparece en «Mensajes avanzados» de la Página como **«Social Media Connector»
(1387147079198980)** — es la de Zernio. ⚠️ **Nadie va a encontrar una que diga «MaKo»**, y esa
confusión es la que lo frenó: conviene decirlo antes de que lo busque.

⚠️ **ManyChat sigue figurando aunque lo deshabilites**, porque entra por **login de Instagram**, que
es otra puerta que las apps de la Página. No molesta mientras no tenga permisos, pero conviene
sacarlo del todo desde Instagram → Configuración → Apps y sitios web, para que no vuelva a reclamar
los hilos más adelante.

### Las dos mejoras que siguen abiertas de nuestro lado

1. **Nadie se entera.** El fallo de un envío no está cableado a `registrarError` (lib/errores-app.ts),
   que existe desde el 17/10 justamente para esto. Va como **configuración del negocio**, no como bug.
2. **Un 409 está marcado para reintentar a 4 h y sin embargo la inscripción se cancela** sin tercer
   intento (ver abajo). Con el reintento andando, estos 19 se habrían recuperado solos.


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

### 1. Los «:00:25» son el cron de nutrición — ⚠️ PERO NO SON LA CANCELACIÓN

`/api/cron/nutricion` corre `0 * * * *` (`vercel.json`), y el `:00:25` es esa corrida. **Pero lo que
hace ahí es SELLAR una inscripción que ya estaba cancelada, no cancelarla** — ver la corrección al
final de este documento. La hora que se ve en `updated_at` no es la hora del hecho.

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
en `null`.

⚠️ **ESTO QUEDÓ DESMENTIDO (8/11).** Acá escribí «son dos fallas distintas y conviene no
mezclarlas». No lo son: con el hilo ya tomado por el receptor primario de Meta, también falla el
PRIMER mensaje, y la inscripción muere igual. Es una sola causa — ver la sección de la causa, abajo.
La guarda `en_curso` existe y es real, pero no es lo que pasó.

## ✅ LA CAUSA, leída en producción el 8/11/2026

**Está en `nutricion_envios.error`** —una columna que existe desde siempre y que nadie había mirado—
y es **idéntica en los 22 fallos**:

> `Instagram: Zernio 409: This conversation is controlled by another receiver in Meta's conversation
> routing, so it can't be replied to from here right now (Meta subcode 2534037). Make this app the
> default receiver: for Instagram, open https://www.facebook.com/settings/?tab=ig_conversation_routing
> while acting as the Facebook Page linked to the Instagram account, not from your personal profile…`

**Meta subcode 2534037: otra app es el «receptor primario» de esa conversación.** No es un bug de
MaKo ni de Zernio: es el *handover protocol* de Meta. La conversación tiene dueño, y no somos
nosotros.

### Por qué falla justo después del botón, y no antes

| nodo | enviado | fallo | |
|---|---:|---:|---|
| `nlcjml0` — el primer DM, respondiendo al comentario | 73 | 2 | **3%** |
| `nem81on` — la entrega del recurso | 15 | 11 | **42%** |
| `n4wu86y` — la entrega del recurso | 9 | 9 | **50%** |

El primer DM sale porque es una **respuesta privada a un comentario**, que Meta permite sin importar
de quién sea el hilo. En cuanto la persona **contesta** (tocar el botón ES contestar), la
conversación pasa a ser un hilo vivo y manda el receptor primario. Ahí empieza a rebotar.

Los 2 fallos del primer DM son los casos donde el hilo **ya estaba vivo** de una vuelta anterior —
la segunda prueba de Martín de las 23:53 es uno de ellos.

### Lo que esto corrige del reporte

- **No son dos fallas distintas.** La «colisión de inscripciones» que parecía un segundo problema es
  la misma causa: con el hilo ya tomado, también falla el primer mensaje, y la inscripción muere
  igual. Una sola causa explica todo.
- **Apagar ManyChat no alcanza, y por eso «apagarlo y que siguiera» despistó.** Apagar la app no la
  saca de **conversation routing**: el receptor primario es una *configuración de la página*, no un
  interruptor de la app. Mientras siga configurada, el hilo sigue siendo suyo aunque no conteste.
- **Empezó el 30/10/2026 04:31**, no el 5/11. Son **22 fallos**, no 9.
- **Es el ÚNICO error de envío de Instagram que existe en toda la base**: cero filas de cualquier
  otro tipo. El 100% de lo que no se entrega por Instagram es esto.

### El arreglo (no es de código, y no lo puedo hacer yo)

En https://www.facebook.com/settings/?tab=ig_conversation_routing, **actuando como la Página de
Facebook vinculada a la cuenta de Instagram** (no desde el perfil personal), poner la app de
Zernio/MaKo como receptor primario — o sacar de ahí a la que esté puesta.

Es de Leandro, en su cuenta (ws 10).

## ⚠️ Y dos cosas que mi propio diagnóstico anterior decía MAL

**1. «Los :00:25 son el cron, y la cancelación la hace esa corrida» — es falso.** Ese timestamp es
el `updated_at` que escribe el **evaluador de desenlaces** al sellar una inscripción que YA estaba
cancelada (`lib/nutricion-desenlace.ts:219`), y su `const ahora` se calcula **una sola vez** en la
línea 137, antes del bucle de la 214. Por eso cuatro inscripciones de cuatro leads distintos
comparten el timestamp **al milisegundo**, que es lo que lo hacía parecer una cancelación en lote.
**El `:00:25` dice cuándo se SELLÓ, no cuándo se canceló.** Un `updated_at` que comparten muchas
filas no es una operación de lote: puede ser un reloj leído una vez.

**2. Queda abierto por qué se cancela en vez de reintentar.** Un 409 de Zernio está clasificado
como **NO terminal, con reintento a 4 horas** (`lib/canal-zernio.ts:323`, que excluye explícitamente
el 409 del backoff de 24 h), y un fallo no terminal escribe `proximo_envio_at = +4 h`
(`lib/nutricion.ts:6105`). Pero las inscripciones terminan `cancelada` sin un tercer intento. No es
la rama terminal, ni las de email, ni la del emisor, ni `cortaPorCompra`: quedan descartadas.
**Importa aunque se arregle Meta:** significa que un fallo que el código considera pasajero igual
mata al lead para siempre.
