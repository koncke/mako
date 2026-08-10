<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# El typecheck NO corre en el build: lo bloquea un hook de pre-push

`next build` tiene `typescript.ignoreBuildErrors: true` (ver next.config.ts). **No es
descuido**: ese paso eran ~65 de los ~99 segundos de cada compilación, y en Vercel se
factura como Build CPU — 109 horas en una sola semana, el 95% del gasto variable de la
cuenta. El mismo chequeo corre local en ~7 segundos y gratis.

La red de seguridad se movió a **`.git/hooks/pre-push`**: corre `npm run typecheck` y
**bloquea el push** si falla. Vive en `.git`, así que aplica a cualquier sesión que
pushee desde este clon sin que tenga que saberlo (hay varias sesiones en paralelo).

⚠️ **Los hooks de git NO se versionan.** Si se reclona el repo, el hook desaparece **en
silencio** y un error de tipos vuelve a llegar a producción en vez de frenar el build.
Si `.git/hooks/pre-push` no existe, recrealo con este contenido y `chmod +x`:

```sh
#!/bin/sh
echo "[pre-push] Chequeando tipos (npm run typecheck)…"
if ! npm run --silent typecheck; then
  echo "\n  ✖ PUSH BLOQUEADO: hay errores de tipos.\n"
  exit 1
fi
echo "[pre-push] ✓ Tipos OK."
```

Reglas para cualquier agente que trabaje acá:
- **Nunca** uses `git push --no-verify` (saltea el único chequeo de tipos que queda).
- Antes de pushear, si tocaste rutas nuevas, corré `npm run build` una vez: el hook usa
  `tsc --noEmit`, que solo valida los tipos generados de rutas si `.next/types` está fresco.
- **Cada push cuesta ~US$0.09** en build. Agrupá commits y pusheá cuando haya algo que
  probar, no después de cada paso interno.

⚠️ El hook hace DOS chequeos: los tipos y que las skills tengan el contrato del `detalle`
al día (`node scripts/sync-contrato-detalle.mjs --check`). Si lo recreás, poné los dos.

⚠️ **Lo que el hook NO hace es correr los tests** (`npm test`), y por eso hay que acordarse
a mano. Un renombre pasa el typecheck perfecto y rompe una aserción sin que nada avise: al
renombrar la tab «Guiones» a «Ads Writer» el push salió verde, se desplegó a producción, y
el test del título quedó roto en `main`. **Si tocás `nav.ts`, los títulos de pestaña, un
catálogo o cualquier cosa que un test mire por su NOMBRE, corré `npm test` antes de
pushear.** No se suma al hook a propósito: son ~9 segundos más en cada push y la mayoría
de los cambios no los necesita — pero los renombres, sí.

# Hay dos cuentas de Claude trabajando sobre este repo

No estás solo en este clon. Hay **dos cuentas** (`claude1` / `claude2` en el `$PROFILE`)
con cuotas desfasadas: una corre miércoles a viernes, la otra sábado a martes. En
principio no coinciden, pero pueden.

Reglas que salen de eso:

- **Antes de tocar nada, `git status`.** Si hay archivos modificados que no son tuyos,
  son de la otra sesión: dejalos donde están.
- **Nunca `git add -A`.** Commiteá por ruta explícita. El día que coincidan, `add -A` se
  lleva el trabajo a medias de la otra sesión adentro de tu commit y nadie se entera
  hasta que rompe.
- **La sesión que cierra deja escrito dónde quedó** — en `docs/hallazgos-<área>.md`, en
  el board `/plan` o en una memoria. Si la cuota corta a mitad de camino, eso es lo único
  que sobrevive.
- **Dos sesiones no editan la misma skill ni el mismo prompt a la vez.** Se pisan igual
  que el código, pero el efecto aparece días después y en otro lado.
- **Cerrá cada commit con el trailer `Claude-Cuenta: claude1` o `claude2`.** Las dos
  cuentas commitean con el mismo autor sobre el mismo clon, así que git no las distingue
  y sin el trailer no hay forma de saber a cuál preguntarle por una decisión. Lo leen
  `/admin/docs` (la ficha de cada documento) y el Change History de `/admin/ui`; donde
  falta muestran «—», que es lo correcto: no se inventa.

El protocolo completo —qué comparten las dos cuentas y qué no, cuándo usar worktrees y
las tres cosas que hay que recrear a mano en uno— está en
[docs/dos-cuentas.md](docs/dos-cuentas.md).

# Una cosa, un lugar

Lo que gobierna a la IA —contratos, catálogos, criterios— vive en UN módulo y todos lo
importan. **Si tenés que copiar la misma regla en dos archivos, el segundo se va a quedar
viejo.** No es una hipótesis: pasó con el contrato del `detalle`. Se actualizó en el camino
de Claude Code, nadie tocó el de WhatsApp, y desde WhatsApp siguió saliendo mal durante
días sin que nada avisara. El dueño lo vio antes que nosotros.

Los que hoy son fuente única:

| Qué | Dónde vive | Quién lo consume |
|---|---|---|
| El contrato del `detalle` | `lib/detalle-contrato.ts` | `plan-fathom`, `mako-doer-acciones`, `checklist-coach`, `agente-skill` |
| Los proyectos del tablero | `lib/plan-proyectos-catalogo.ts` (dueño) · `lib/todo-proyectos-catalogo.ts` (clientes) | el ruteo del Perro, los dos boards |
| Cómo se llama un proyecto nuevo (`Feature: `, `Cliente: `) | `PREFIJO_FEATURE` + `REGLA_NOMBRE_PROYECTO` en `lib/plan-proyectos-catalogo.ts` · `PREFIJO_CLIENTE` en `lib/todo-proyectos-catalogo.ts` | el prompt de ruteo (`mako-guardian`), la skill `plan-tareas` |
| Qué archivos se pueden leer | `lib/formatos-archivo.ts` (**sin `server-only`**, a propósito) | `archivo-a-texto` (el lector), `mako-doer-in` (WhatsApp), `ImportarModal` (el `accept` y los íconos) |
| Qué modelo usa cada feature | `lib/model-registry.ts` | `chatClaude`/`chatCheap`, con override en /modelos-ia |
| Cómo se funden dos descripciones | `lib/detalle-fusion.ts` | el board del dueño y el del cliente |
| Cómo se llama y se ve cada estado de la IA, y el Semáforo | `lib/mako-gramatica.ts` | la primitive `<Mako>`, `meta-health-ui`, `avisos-catalogo` |
| Qué cliente mira ESTA pestaña (`?ws=`) | `lib/ws-tab.ts` + la validación en `proxy.ts` | `getWorkspaceActual`, el `<Link>` de `app/_ui`, el parche de fetch |
| Cómo se escribe **MaKo** (`corregirMarca`, `REGLA_MARCA`) | `lib/mako-gramatica.ts` | `transcribirAudio` (STT), `limpiarTarea`, `MAKO_NUCLEO` |
| Los tipos de pregunta del Perro, su saneo y el texto que leen los modelos | `lib/preguntas-contrato.ts` (**sin `server-only`**, a propósito) | `plan-propuesta`, `plan-fathom`, `mako-doer-acciones`, `PreguntaCampo` |

⚠️ **El rótulo de un estado de MaKo no es un prop.** Sale de `GRAMATICA` y no se puede
pasar por parámetro, a propósito. El día que se pueda, tres pantallas escriben
«Analizando…», «Pensando…» y «MaKo está trabajando» para el mismo estado y el usuario no
tiene forma de saber que son lo mismo — que es exactamente el diagnóstico que la Parte 3
del rediseño vino a cerrar. Si a un estado le falta algo, se le agrega **al catálogo**.

⚠️ **NUNCA leas `?ws=` de la URL para decidir de quién son los datos.** El super admin
abre cada cliente en su propia pestaña y el workspace viaja ahí, pero un parámetro de URL
lo escribe cualquiera: leerlo directo es un IDOR que abre los datos de otro cliente. El
único que lo mira es `proxy.ts`, que lo acepta **solo** si la sesión firmada dice
`rol === 'admin'` y que borra el header interno en cada request. De ahí para adentro se
pregunta siempre a `getWorkspaceActual()`, como siempre. Para links y navegación usá
`import Link, { useRouter } from '@/app/_ui/Link'` en vez de `next/link` y
`next/navigation`: preservan el cliente que estás mirando. Las llamadas a `/api` no hay
que tocarlas — el parche de `app/_components/WsFetch.tsx` les pega el parámetro solo.

Las skills son `.md` y no pueden importar nada. Para esas, el módulo se copia con un
script y **el pre-push falla si quedaron viejas** — esa guarda es lo único que impide que
el problema vuelva. `scripts/sync-contrato-detalle.mjs` copia hoy DOS cosas (el molde del
`detalle` y la regla del nombre de un proyecto), cada una entre sus marcadores. Si agregás
una skill que repite una de estas reglas, sumala a `DESTINOS` en vez de copiar el texto.

# Un guard sobre algo destructivo se escribe en POSITIVO

«Solo ESTE workspace», nunca «cualquiera menos aquél». La condición negativa protege una
cosa y deja pasar todo lo demás, y se queda vieja sola: cada cliente nuevo entra en la
lista de los que NO estaban contemplados, sin que nada avise.

No es hipotético. El Reset que vacía un workspace —50+ tablas y 4 buckets de storage— se
ofrecía adentro de **todos los clientes reales**, porque las tres capas de guard decían
`ws !== OWNER_WS`. La función que lo decidía se llamaba `wsDePrueba()`: el nombre decía la
intención y el código decía otra cosa, así que leerlo por encima no alcanzaba para verlo.

Y donde haya un guard así, dos cosas más:

- **La condición va en un módulo SIN `server-only`**, para que se pueda testear. Si vive
  adentro del que hace el trabajo sucio, ningún test la puede importar — y termina siendo
  lo único sin red justo donde más duele. Ver `exigirClienteDePrueba` en `lib/auth-session.ts`.
- **Esconder el botón no protege nada.** El que decide es el server; la UI solo pinta lo
  que él contesta.

# Una regla en un prompt no es una regla

Si una regla sólo vive en la prosa de un prompt, **no se cumple**: se cumple casi
siempre, que es otra cosa. El contrato de las preguntas del Perro decía desde hacía
meses «una escala sin extremos explicados es una pregunta muerta» y «el tipo y las
opciones tienen que ser coherentes» — en cinco prompts distintos, con cinco redacciones
distintas — y no había **una sola línea de código** que lo mirara. El resultado llegó a
la pantalla del dueño: «¿Cuál es el deadline?» con botones del 1 al 5.

La regla que queda: **toda regla que gobierne la salida de un modelo necesita las dos
capas.** El texto en el prompt (para que el modelo acierte) y una validación
determinista en el saneo (para cuando no acierte). Si la segunda no se puede escribir,
la regla es una expresión de deseo y hay que decirlo en el comentario.

El corolario que más cuesta ver: **un DATO EXACTO que pasa por las manos de un LLM deja
de ser exacto.** El link de un borrador es `…/plan/revisar/propmskimbc4s4b4h` — 17
caracteres al azar, sin ninguna redundancia. El código lo armaba bien y le pedía al
modelo que lo mandara; falló de las dos formas, y la silenciosa es la peor: un link que
resolvía a un borrador REAL pero equivocado. El mismo link, cuando lo escribe el código
(`lib/reunion-destinatarios.ts`), nunca falló. Si un id, un número o una URL tienen que
llegar intactos, **no los transporta el modelo**: los pone el código, o se corrigen
contra el valor real antes de salir (`lib/link-borrador.ts`).

Y cuando el saneo tenga que elegir entre dos señales que se contradicen, **gana la más
cara de producir**. Un `tipo` es un token que el modelo tira sin pensar; una lista de
opciones concretas sólo se escribe sabiendo qué contesta la pregunta. El saneo viejo
hacía lo contrario —ante `{tipo:'escala', opciones:[fechas]}` se quedaba con el token y
tiraba las fechas— y esas respuestas no quedaban en ningún lado: ni en la base, ni en la
pantalla, ni en el log.

# Un default que cobra es un cobro silencioso

El `def` de una feature en `lib/model-catalogo.ts` no es «lo que usa hoy el código»: es
**lo que va a pagar cualquier feature que nadie se acordó de configurar**. `/modelos-ia`
escribe un override **solo cuando alguien toca el botón**, así que una feature nueva con
`def: SONNET` cobra desde el día uno y no lo dice en ningún lado.

El caso: el dueño reclamó dos veces el mismo día «el Perro sigue usando Claude para tareas
simples». La segunda vez el Perro no tenía nada que ver — hacía horas que corría en
Mistral a US$0. Lo que cobraba era **`plan-fathom`**, que corre sola en cada reunión nueva
y parte el transcript en cuatro pedazos de ~40k: **US$37 en 30 días**, contra US$0,81 del
Perro. Nunca tuvo override porque nadie se lo tocó. Y **trece features más tenían
`def: SONNET` mientras un override las corría en Gemini**: el catálogo decía una cosa y la
realidad otra.

La regla, con las dos capas de siempre:

1. **El `def` de una feature es un proveedor GRATIS.** No la deja sin red: si el proveedor
   falla se recorre la cascada gratis entera antes de pagar (ver la sección siguiente).
2. **Si cobra, `pagoPorque` dice en una frase qué se compra**, y
   `tests/model-registry.test.ts` **falla si falta**. Hoy son tres, a propósito: `closing`,
   `lead_insights` y `experimentos` — análisis pesado sobre datos reales, que es lo que el
   cliente paga a sabiendas.

Por eso el catálogo vive en `lib/model-catalogo.ts` **sin `server-only`**, separado del
`model-registry.ts` que lee la base: un módulo con `server-only` no lo puede importar
ningún test, y la guarda del gasto quedaba sin red. Es el mismo criterio que
`exigirClienteDePrueba`.

Y para saber qué modelo corre **de verdad** una feature, el catálogo solo no alcanza:
es `override del ws1 ?? def del catálogo`. Los overrides están en `app_settings` con
`key='mako.modelos'`, siempre del workspace 1.

# El precio de un proveedor no es un dato hasta que lo verificás vos

Antes de meter un modelo o un proveedor nuevo en `lib/model-catalogo.ts`, tres chequeos.
Ninguno es opcional y los tres ya fallaron una vez:

1. **Recalculá el precio contra la página del FABRICANTE, ese día.** La columna «precio
   oficial» que publica un revendedor es propaganda: la de APImart es, en las ~200 filas
   revisadas, exactamente su propio precio × 1,25. Y un número sacado de un curso, un blog
   o un benchmark tampoco es un precio — el curso de la casa enseña a comprar Sora a
   US$0,15 por 15s y hoy eso está roto por un factor de **8**.
2. **Leé sus términos de reventa.** Es la otra mitad del dato y es lo único que nadie
   publica de frente. APImart **prohíbe** por escrito facturar encima sin autorización;
   Kie.ai **no dice nada**, que no es lo mismo que permitir; fal.ai y Replicate lo
   contemplan explícitamente. Un SaaS que cobra no se para sobre un vacío contractual.
3. **Desconfiá del descuento redondo.** Un −72% uniforme sobre toda una familia de modelos
   no sale de un acuerdo de reventa: sale de un intermediario que puede desaparecer de un
   día para el otro. 20-40% variando por modelo es creíble; 75-86% parejo, no.

El detalle, con las citas textuales de cada contrato y la tabla de qué modelo barato va en
cada tarea, en [docs/hallazgos-ia.md](docs/hallazgos-ia.md) → «Comprar modelos».

# Claude es el ÚLTIMO recurso, no el segundo

Cuando una feature está ruteada a IA barata en `/modelos-ia` y el proveedor falla, se
recorre **toda la cascada gratis** antes de pagar (`chatCheapCascade` en `lib/anthropic.ts`).
Nunca un solo intento y a Claude.

El caso que lo probó: el Perro Guardián está en Gemini desde hace meses, Gemini devolvió
**HTTP 429** —la cuota del minuto, el error más transitorio y más previsible cuando el
Perro corre en tandas— y el código caía derecho a Sonnet. Dos corridas de priorización
costaron US$0,25 con otros cuatro proveedores gratis configurados y sin usar. Un fallback
que cobra tiene que ser la excepción rara y ruidosa, no la reacción al primer 429.

# Un contrato de datos no es un layout

`exige` en `lib/mako-gramatica.ts` dice qué tiene que **tener** un estado de MaKo para no
ser un consejo genérico. No dice qué tiene que **mostrar de entrada**. Confundir las dos
cosas costó tres rediseños seguidos de la misma pantalla: el dueño la rechazó tres veces
por «cargada», y las tres rondas de arreglos movieron cómo se veían los campos sin
preguntar nunca por qué estaban todos a la vista.

Lo que queda:

- **Lo que se ve sin abrir se elige a mano, nunca por el índice de un array.** La versión
  vieja mostraba `datos[0]` y escondía el resto; en la aprobación eso dejaba «A quiénes»
  arriba y «Qué reciben» detrás de un click, con el botón que manda 340 mensajes
  irreversibles siempre visible. Se podía aprobar un envío sin haber visto qué se enviaba.
  Por eso `consecuencia` es un prop propio de `<Mako>` y **no se deriva de `datos`**.
- **Nada de kicker.** El rótulo del estado no va en monospace arriba del título. Sigue en
  `GRAMATICA` —el contrato de que se llame igual en las cuatro tabs no se toca— y se pinta
  en el chip, en una columna de tabla y adentro del panel abierto. Vale para cualquier
  pieza nueva, no solo para `<Mako>`.
- **Un grupo de cosas del mismo tipo es una lista con filete, no una pila de cajas.** Tres
  tarjetas del mismo tamaño apiladas son el contenedor perezoso; la caja se gana.
- **Ningún botón puede ser «Sí», «No», «Aceptar», «Cancelar» ni «Descartar» a secas.** Cada
  uno nombra su acción y su objeto, y el par de salidas resume qué pasa con cada una:
  «Enviar 340 mensajes» / «No enviar», no «Enviar» / «Cancelar».
- **La consecuencia de lo irreversible va pegada al botón**, en tinta normal y no en gris,
  y **antes** del click. Arriba de todo y en gris no la lee nadie.
- **El único `max-width` del diseño vive en el CONTENEDOR.** Nada adentro lleva ancho
  propio: todo va al 100%. Un `max-width` puesto al texto dentro de una caja más ancha no
  acota nada — deja la mitad de la caja vacía a la derecha y el contenido aplastado a la
  izquierda. Si hay que cuidar la medida de lectura, se acota el contenedor (para eso está
  `Modal`, 600 px) o se centra con `margin-inline: auto`. Medido acá: 603 px de contenido en
  una caja de 1134.
- **`Confirm` pregunta · `Modal` muestra el detalle · `WizardShell` conduce un flujo.** Son
  tres cosas distintas, no tres tamaños de lo mismo. Para el detalle de algo, `Modal`.
- **Todo lo que MaKo pone en una lista es `.mk-fila`, y su nombre de estado es `.mk-pill`.**
  Eran cinco tratamientos —fila, línea con barra, tarjeta, caja crema, pastilla— que
  compartían la misma anatomía y diferían en tres números. Antes de estilar una pieza
  «parecida» a otra, poné las dos anatomías al lado: si comparten esqueleto, es una pieza con
  dos configuraciones, y mantenerlas separadas garantiza que diverjan.
- **Adentro de una lista, una barra de progreso es el BORDE de la fila (2 px, ancho completo)
  o no existe.** Una barra con ancho propio deja el mismo hueco muerto que un `max-width`.
- **Si el contenido se EDITA en otra pantalla, el modal NO lo dibuja: lo nombra y linkea**
  (prop `ver`, que sale de `lib/mako-capacidades.ts`, nunca un href a mano). La excepción es
  el estado que BLOQUEA: una aprobación que linkea es una aprobación que se da sin leer, así
  que ahí el modal muestra el texto entero. Cuando linkea, la evidencia es **una muestra y el
  conteo**, nunca la lista. El mapa completo de escenarios, en
  [docs/hallazgos-ia.md](docs/hallazgos-ia.md) → «Dónde vive cada estado de MaKo».

El detalle de cada uno, con las citas de las guías, en
[docs/hallazgos-ui.md](docs/hallazgos-ui.md).

# Dos reglas de layout que se rompen solas

**1. El `<main>` de una pantalla es `Pagina`.** Una pantalla no elige su propio ancho.
Síntoma repetido: se agrega una vista y no llega al borde, queda una franja vacía a la
derecha que nadie puso a propósito.

No había ninguna regla escondida, y ese era el problema: cada pantalla escribía su
propio `<main>`, así que cada una elegía su `maxWidth` por separado — 16 con el mismo
padding, 7 variantes sueltas más, y topes de 720, 980, 1000, 1100 y 1200 según quién la
escribió. Copiar la pantalla de al lado propagaba el número.

```tsx
import { Pagina } from '@/app/_ui';
<Pagina>…</Pagina>   // topea en --pagina-max y CENTRA
                     // ancho="completo" para tablas/tableros · densidad="compacta"
```

El `style` de `Pagina` está tipado sin `maxWidth`, `width` ni `margin`: el compilador
rechaza el ancho. Y si el contenido no llega al tope, va **centrado** — un `maxWidth`
pegado a la izquierda es lo que deja la franja muerta. Si lo que necesita tope es
**texto**, va en el párrafo (`Lectura`, 70ch), nunca en la página: un `maxWidth` en el
`<main>` también angosta las tablas.

**2. Una barra de navegación NO lleva scroll horizontal.** Esconder destinos detrás de
un gesto lateral es esconderlos. Si no entran, bajan de renglón (`flex-wrap`). Esto va
en contra del §19.2 del documento de rediseño, y gana esta regla. El caso que lo probó:
las tabs de la ficha del lead scrolleaban de costado *y* tenían la barra de scroll
oculta por CSS, así que las últimas no daban ni una pista de existir.

El scroll lateral sigue bien donde lo que se corre es **contenido** —una tabla, una
fila de filtros, un bloque de código—: para eso está `.mk-scroll-x`.

El resto del sistema, en [app/_ui/LEEME.md](app/_ui/LEEME.md); el catálogo vivo, en
`/admin/ui`, que además lleva el historial de por qué cada cosa quedó así.

# Una pantalla oscura se hace redefiniendo TOKENS, no reglas

La app es **tema claro con islas oscuras** (el sidebar, el tooltip, el toast). No hay
`prefers-color-scheme` ni modo oscuro global, y no se está agregando uno. Cuando una
pantalla tiene que ser oscura —hoy solo `/second-brain`— se marca `<html data-tema="oscuro">`
y se redefinen los tokens en `app/globals.css`. Todo lo que ya consume `var(--surface)`,
`var(--ink)`, `var(--border)`… se da vuelta solo. El inventario de esa pantalla contó **40
usos** repartidos en tres archivos: tocarlos uno por uno era garantizar que el próximo se
olvidara.

Tres cosas que el scope NO resuelve solo, y que hay que mirar a mano:

- **Los tokens que existen PARA un fondo.** `--mako-ink` es, textual, «el dorado bajado de
  luminosidad para que se LEA sobre fondo claro». En oscuro da 2,97:1. No se inventa un
  cuarto dorado: en el scope apunta a `--mako`.
- **Las relaciones invertidas.** Si el estado ENCENDIDO de algo es un gris oscuro y el
  apagado es casi blanco, en oscuro el apagado pasa a ser lo más brillante de la pantalla.
  Pasó con las aristas del grafo.
- **`--focus-ring`**, que trae un halo interno de `var(--surface)`. En oscuro hay que
  apuntarlo al FONDO o pinta un aro blanco puro.

Y dos reglas de valores: en oscuro las superficies **suben** de luminosidad (`--sidebar-2`
es MÁS oscuro que el fondo del lienzo y da 1,06:1), y las líneas van con un color **opaco**
a dos escalones del fondo, nunca un gris claro bajado de `opacity`.

El detalle, con las mediciones, en
[docs/hallazgos-second-brain.md](docs/hallazgos-second-brain.md).

# Una barra de gráfico se recorta al 100%, siempre

`width: ${pct}%` adentro de un carril NO desborda la barra: **desborda la página**.
Un valor 14× por encima del `max` del gráfico se dibujó con `width: 1468%` y llevó el
documento de 1.440 px a **7.656 px** de ancho — con el scroll horizontal en toda la
app, no en el gráfico.

No fue un dato raro: `max` es una prop explícita justamente para que dos gráficos se
puedan comparar, así que un valor por encima del tope es lo NORMAL. Toda escala con
tope fijo necesita las dos cosas:

- `Math.min(100, …)` en el ancho, y `overflow: hidden` en el carril.
- **Que se vea que está cortada.** Una barra recortada con la punta redondeada miente:
  parece que ahí termina el valor. Va a filo, con una marca, y el número al lado —
  que ya es obligatorio por la regla de que el color nunca es el único portador.

Vive en `app/admin/dev/pricing/Piezas.tsx` → `Barras`.

# Un color de acento dice algo, y puede decir lo contrario

`tono="bad"` pinta de rojo la barra DESTACADA. Si lo que se destaca es «el único canal
que sí entra en el techo», el gráfico afirma exactamente lo contrario de lo que afirma
el dato, y se lee antes que el texto.

La regla: **el tono se elige por lo que significa la barra destacada, no por el tema de
la sección.** Un gráfico sobre costos no es «malo» por ser sobre costos.

# Dos gráficos que hay que comparar comparten el ORDEN de las filas, o no se comparan

En «¿Cuánto cuesta conseguir un cliente?» el costo de cada canal se pinta en dos monedas
que nunca se suman: plata y horas. Eran dos `<Barras>` apilados, y cada uno venía
ordenado por SU propio valor —`sort` por `plataPorCliente` en uno, por `horasDe()` en el
otro—. Resultado: un canal estaba en el renglón 1 del gráfico de arriba y en el 4 del de
abajo. La RELACIÓN entre las dos monedas —que era todo lo que la sección tenía para
decir— era exactamente lo único que no se podía seguir con el ojo.

El dueño lo reportó como «no se entiende», y **el diagnóstico obvio era el equivocado**:
no sobraba texto. El texto era correcto; lo roto era que cada gráfico se ordenaba solo.

**La regla: el orden de las filas es UNO, se fija explícitamente en un solo lugar, y lo
fija quien llama.** Un `sort` adentro de cada gráfico es el bug.

Y el corolario, que es la parte que más ahorra después: el método de dataviz manda
**small multiples** para dos medidas de escalas distintas, y hasta ahí todo bien — pero
**small multiples SIN eje de categorías compartido no son small multiples: son dos
gráficos sueltos**. En un gráfico de barras horizontales el eje de categorías ES el orden
de los renglones. Se puede tener la forma correcta del catálogo y un gráfico que igual no
se lee.

Vive en `app/admin/dev/pricing/Piezas.tsx` → `DosMonedas`: un renglón por ítem, dos
carriles con su propia escala y su propio tope, y el orden lo fija quien llama.

# La cosecha: lo que aprende un subagente no vuelve solo

Cuando se despliegan subagentes, **lo único que llega de vuelta es el texto que
devuelven**. Todo lo que leyeron y razonaron se queda afuera. Las transcripciones sí
quedan en disco (`~/.claude/projects/<proyecto>/<sesión>/subagents/workflows/<runId>/`),
pero son megas de crudo que nadie va a abrir y que la próxima sesión ni sabe que
existen. En la práctica: lo que no se escribe, se pierde.

No es hipotético. Una corrida de 14 agentes sobre el formulario "¿Qué hacer ahora?"
encontró 13 problemas reales; los 5 que quedaron fuera de alcance sobrevivieron
únicamente porque se escribieron.

**Regla: toda corrida con subagentes termina escribiendo en `docs/hallazgos-<área>.md`.**

Un documento **por área**, no uno solo: `hallazgos-crm.md`, `hallazgos-plan.md`,
`hallazgos-ia.md`, `hallazgos-ads.md`, `hallazgos-landing.md`,
`hallazgos-comunicacion.md` (WhatsApp/email), `hallazgos-infra.md` (build, deploy,
Supabase, auth). El área es **dónde vive el código**, no de qué hablaba la tarea. Si
el hallazgo cruza áreas, va donde vive el código y se enlaza desde la otra.

Si el área todavía no tiene documento, se crea. `docs/hallazgos.md` es el índice: una
línea por documento, y se actualiza en el mismo commit.

Qué va ahí:

| Sí | No |
|---|---|
| Síntoma visto → causa real → dónde vive → la regla que queda | El changelog de lo que se hizo (ya está en el commit) |
| Las trampas del entorno: una API que devuelve vacío en vez de error, un límite que corta en silencio, un default que inventa un dato | Resúmenes de la corrida |
| **Cuándo el diagnóstico obvio era el equivocado** — lo que más tiempo ahorra después | Relleno |
| Lo que quedó SIN hacer, con el archivo donde vive | |

Una entrada por tema, se integra sin duplicar, se lee en 5 minutos. Si la lección
gobierna código nuevo (no es un hallazgo sino una regla), va acá en `AGENTS.md`, que
es lo que todos leen antes de escribir.

## Y para leerlos: grepeá la ruta, no abras el documento

**Antes de tocar un archivo, `Grep` su ruta en `docs/`.** Cada hallazgo trae adentro
la línea `**Vive en:** <archivo>`, así que buscar `lib/nutricion.ts` te lleva directo a
los tres que importan.

No es una preferencia de estilo, es plata: `docs/hallazgos-comunicacion.md` pasó las 500
líneas y abrirlo entero para encontrar una cosa son ~17.000 tokens, multiplicados por
cada vez que se abre el documento equivocado. Grepear la ruta cuesta dos órdenes de
magnitud menos y no falla por elegir mal el área.

Por la misma razón **no existe un índice inverso**: sería un segundo lugar donde vive el
mismo dato, y se quedaría viejo. La ruta ya está adentro de cada entrada — `Grep` **es**
el índice.

Los mismos documentos se leen con los ojos en `/admin/docs`, que los renderiza desde el
repo (no tiene copia propia, por la regla de arriba).
