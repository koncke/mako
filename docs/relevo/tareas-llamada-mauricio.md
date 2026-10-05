# Retomar: Tareas de llamada con Mauricio

**Dónde quedó:** 04/10, 22:33. Sesión `48dddbc4`. Cerró limpia: **todo lo mío está
commiteado y pusheado**, nada quedó en el chat.

## Lo primero que tiene que saber el que entre

⚠️ **Hay un documento nuevo con la proyección de los próximos días y NO está cargado en
el tablero.** Es [`docs/proyeccion-04oct.md`](../proyeccion-04oct.md), y está sin cargar a
propósito: **se lo dije a Martín y él todavía no contestó.** Si dice «cargalo», se carga;
si no, no se toca. El porqué está abajo.

⚠️ **Y antes de escribir CUALQUIER cosa en el tablero, leé la regla de AGENTS.md «la
fuente más nueva puede ser el TABLERO MISMO».** El 03/10 una corrida aplicó el plan de una
llamada del 1/10 y le pisó DIEZ deadlines que Martín había depurado a mano catorce minutos
antes. Lo reportó al otro día: *«yo había depurado y sacado muchos deadline como el de
offer analyst y generator etc… me cambiaste todo eso, vuelve a lo que estaba rápido»*. Se
revirtió en `3cc5ecb2` con un cruce contra el historial que dejó intactos otros cinco que
sí se habían vuelto a fijar a propósito. **No lo vuelvas a hacer.**

## El hilo de esta sesión, en orden

1. **Los nueve bugs del plan que Martín dictó en vivo en la llamada con Leila del 1/10.**
   Hechos todos menos el #9, que él mismo descartó. Seis commits.
2. **Cuatro pedidos sobre la selección en lote de `/plan`** (`c7355a27`): que la grilla se
   despliegue sola al seleccionar y se pliegue al soltar, que la barra de acciones baje con
   el scroll, que «quitar deadline» viva adentro del desplegable de fechas y sea texto, que
   el cambio de prioridad en lote ofrezca también el número, y que la selección sobreviva al
   cambio de vista. Verificado en un navegador real, no leyendo el handler.
3. **El revert de los diez deadlines** (`3cc5ecb2`).
4. **La proyección** (`892713b0`, `0cf4fba2`, `09d9182e`): Martín mandó una nota de voz con
   el plan de los próximos días y pidió bajarla a tierra contra `/admin/runway`.

## Lo que Martín tiene que decidir, y está esperando

**Qué se cobra primero en la ventana del 1/11 al 15/12: el grupal de US$1.500 o la app de
US$47.** No es orden: cambia la pasarela, el calendario y qué está en el camino crítico, y
las tres en direcciones opuestas. El audio contesta las dos cosas.

Está todo desarrollado en el documento; lo que no puede hacer nadie más es elegir.

## La corrección que hay que tener a mano

Le dije a Martín —y después lo corregí— que la cuenta del runway describía el embudo viejo.
**Es al revés y conviene no volver a equivocarse:** los US$15.000 son 10 × US$1.500 del
**grupal** (`modelo.ts:871`, caja US$1.290,33), y contra esa caja el CAC medido del carrito
(US$136,22) entra con 7× de margen. La cuenta CIERRA. Lo que no cierra con ese CAC es la app
de 47, cuyo techo está medido en US$105,27 (`modelo.ts:1435`).

## Lo que quedó SIN verificar, dicho en positivo

⚠️ **El auto-scroll del arrastre dentro del modal de la ficha SIGUE SIN PROBARSE.** Viene
del relevo anterior (`72aa1109`, 27/09) y esta sesión **no lo ejercitó**: no se hizo un solo
arrastre real adentro de ese modal. Vive en `app/plan/board/BoardShell.tsx`, resuelve el
scroller una sola vez en el `dragstart` porque durante un arrastre nativo el navegador
congela `requestAnimationFrame` **y** los timers, y **ningún test lo caza: es un gesto**.
Sigue siendo lo primero a mirar si alguien toca el arrastre.

## Dónde leyó y escribió esta sesión

- **`docs/proyeccion-04oct.md`** — el entregable.
- **`docs/hallazgos-planes-y-cobro.md`** — área NUEVA: lo que pasa cuando el producto
  empieza a cobrar y a cortar por plan (`capaDef` es fail-open, el corte por capa es de
  pantalla y no de API, `requireCapa` no puede renderizar, el merchant of record prohíbe
  «coaching» por escrito, el margen del 47 que el pricing afirma y el código desmiente).
- **`AGENTS.md`** — la regla de que `app/vsl/landing-html.ts` es GENERADO y no se edita a
  mano.
- `docs/hallazgos-plan.md` y `docs/hallazgos.md` (el índice).
- `scripts/transcribir-audio.ts` — transcribe una nota de voz con la cascada gratis. Se usa
  seguido; corre con `node --conditions=react-server --import tsx`.

## Para no repetir trabajo

- **La sesión del CRM está trabajando en paralelo y ya cerró cosas que tocan esto**: el
  opt-in de una landing no pasaba `funnel_id` en ninguna línea hasta `865dffb4` de esta
  tarde. La importación sí lo pasaba desde antes (`app/crm/actions.ts:1667`) — **me equivoqué
  al decir que no, midiendo el parser del CSV en vez del que escribe el lead.** Está
  corregido en `09d9182e`.
- **Lo que no cubre nadie es el pago**: el webhook, cuando exista, tiene que cerrar el
  `estado_lead`. Si no, el CRM automático le escribe «no agendaste la llamada» a los 2 días
  a alguien que acaba de pagar. Hoy mide CERO casos y el disparador está identificado.

---

## Lo que vale para cualquier chat de este relevo

- **Esta sesión fue `claude2` (Leandro Tejado); Martín se pasa a `claude1`.** Antes de
  firmar un commit releé el marcador: `head -1 ~/.claude/cuenta-activa.txt`. Lo que te
  inyectó el hook al arrancar es una **foto** y no se entera si Martín cambia de cuenta con
  la sesión abierta.
- El trailer `Claude-Cuenta:` va **pegado** a `Co-Authored-By:`, sin línea en blanco: git
  sólo parsea el último bloque contiguo.
- **Hay TRES sesiones vivas sobre este clon.** `git status` antes de commitear, siempre por
  **ruta explícita**, nunca `git add -A` — y si un documento compartido (`docs/hallazgos.md`)
  tiene trabajo ajeno, se separan hunks: `git checkout HEAD -- <ruta>`, escribir sólo lo
  propio, `git commit -- <ruta>`, devolver el archivo completo.
- ⚠️ **Un typecheck rojo en un archivo que no es tuyo puede ser el vecino tipeando.**
  Pasó hoy: cuatro errores en un `bitacora.ts` ajeno y cero un minuto después, sin que nadie
  tocara nada. Re-correrlo cuesta 7 segundos y evita diagnosticar código sano.
- ⚠️ **Un «remote rejected: cannot lock ref» puede significar que TU commit ya está
  subido**, porque las tres sesiones comparten el `.git` y se arrastran los commits entre
  pushes. Se comprueba con `git merge-base --is-ancestor <tu sha> origin/main` antes de
  rebasar nada.
- ⚠️ **Bootear local ESCRIBE en la Supabase de PRODUCCIÓN.** Un blur del detalle guarda en
  el tablero real de Mauricio.
- ⚠️ **`ws3` está EN CERO.** El clon con datos es **`ws4` «Cliente de Diseño»** (300 leads).
- El estado completo está en [`docs/relevo.md`](../relevo.md).
