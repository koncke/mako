# Hallazgos — Copy y voz (el guard de voseo)

El producto se usa en México: la interfaz va en español neutro, y **la voz de MaKo hacia
Martín sí es rioplatense** (AGENTS.md → «La voz de MaKo es rioplatense, y el texto DEL
CLIENTE no»). Lo que separa una cosa de la otra es un solo archivo:
`tests/puente-panel-copy.test.ts`, que recorre `app/`, `lib/` y `components/`.

Todo lo de acá salió de ampliarlo el **03/09/2026**, después de que alguien viera EN LA
PANTALLA —no con el test— que la segunda pregunta del diagnóstico del onboarding decía
«¿Cuánto **invertís** por día en Meta Ads?». Estaba en producción y el test daba verde.

## Lo que más muerde acá

1. **Una lista de formas escrita a mano se queda corta POR CONSTRUCCIÓN** — cubre lo que ya
   se escribió, nunca el verbo que todavía no usó nadie. [→](#la-lista-a-mano-solo-puede-cubrir-el-pasado)
2. **Un `/*` que no abre un comentario borraba 71 líneas de código, en verde** — el guard
   contestaba «está todo bien» sobre un pedazo de archivo que nunca miró. Y el diagnóstico
   obvio (CRLF) era el equivocado. [→](#un--que-no-abre-un-comentario)
3. **Un `\n` ESCRITO adentro de una cadena pega la `n` a la palabra siguiente** — `\ndevolvé`
   no está en ningún diccionario. [→](#un-salto-escrito-no-separa-palabras)
4. **La conjugación correcta puede cambiar el sentido** — `PARÁ TODO` → `PARA TODO` convirtió
   el imperativo en preposición en la alerta más grave que manda MaKo. [→](#reemplazar-bien-no-es-decir-lo-mismo)
5. **El hueco que QUEDA ABIERTO: el imperativo de los -ir** — `escribí`, `subí`, `elegí` se
   escriben igual que el pretérito de MaKo, así que el guard no los puede marcar nunca.
   [→](#lo-que-el-guard-no-puede-marcar-y-hay-que-mirar-a-mano)

---

## El detector

**Vive en:** `tests/puente-panel-copy.test.ts`

### La lista a mano solo puede cubrir el pasado

**Síntoma.** «¿Cuánto invertís por día en Meta Ads?» (`lib/fase-diagnostico.ts:412`), en
producción, con el guard en verde. Revisando copy nuevo aparecieron otras seis en el mismo
estado: `hablás`, `entregás`, `corregís`, `aprobás`, `lanzás`, `agendás`.

**Causa.** El mapa `NEUTRO` eran ~150 formas ENUMERADAS. Cada una entró el día que alguien
la vio; el verbo que nadie usó todavía no está, y no hay forma de que esté. No es una lista
incompleta: es una lista que **no puede** estar completa.

**La regla.** La conjugación voseante es REGULAR y sale sola del infinitivo (-ar → -ás/-á,
-er → -és/-é, -ir → -ís/-í, más el clítico pegado). Lo único irregular está del lado NEUTRO
(`tener` → tienes, `contar` → cuenta, `hacer` → haz), y eso es lo único que se escribe.
**Se listan VERBOS, no formas**: sumar `entregar` trae sus ~30 formas de una. De 150 formas
a la mano se pasó a ~5.900 generadas desde ~230 infinitivos, y con eso aparecieron **224
casos vivos en 96 archivos** que el guard venía dejando pasar.

El corolario, que es el que se olvida: **cuando un chequeo se le queda corto, la pregunta no
es «¿qué le falta a la lista?» sino «¿por qué hay una lista?»**. Agregar las siete formas
que se vieron habría dejado el mismo agujero para las próximas siete.

### Un `/*` que no abre un comentario

**Síntoma.** `lib/archivo-a-texto.ts` tiene, en el copy que le llega a un modelo,
«Transcribí TODO el texto… describí… **Devolvé** solo el texto». El guard nunca lo marcó,
ni con el diccionario generado.

**Causa.** Nueve líneas más arriba hay un comentario:

```
//  · .txt .md .vtt .srt y cualquier text/*  → directo del buffer. Gratis.
```

Ese `text/*` —un MIME con comodín, adentro de un comentario de línea— abría un bloque para
`replace(/\/\*[\s\S]*?\*\//g, …)`, que lo cerraba **71 líneas después**, en el primer `*/`
que apareciera. Todo ese código quedaba en blanco para el guard.

**Por qué es el peor modo de falla.** No dice «no pude leer esto»: dice «está todo bien».
Es exactamente lo que el propio archivo tiene escrito como regla —«No encontré nada que
revisar» y «revisé y está todo bien» son respuestas DISTINTAS— aplicada contra sí mismo.

⚠️ **Y el diagnóstico obvio era el equivocado, dos veces.**

1. La primera hipótesis fue **CRLF**: que `;$` no matcheara antes de un `\r` y el
   `replace` de imports se comiera el archivo. Es falso — en JavaScript, `$` multilínea
   matchea antes de `\r` también. Media hora perdida en la regex que no era.
2. La segunda fue escribir un **scanner** carácter por carácter que supiera si estaba en
   código, en comentario o en cadena. Salió PEOR: cualquier comilla dentro de una regex
   (`/[^:'"`\\]/`) o de un texto JSX lo mete en estado «cadena» y a partir de ahí deja de
   ver los comentarios. Marcó 59 formas nuevas y **58 eran comentarios**.

**La regla.** El arreglo es el **ORDEN**: primero se borra de `//` al fin de línea, y recién
después los bloques `/* … */`. Con eso el `/*` que vivía dentro de un comentario de línea ya
no existe cuando se buscan los bloques. Dos líneas, ninguna heurística nueva.

Lo general: **antes de escribir un parser, probá si el problema es de orden.** Un pipeline de
`replace` donde el paso B puede consumir lo que el paso A tenía que borrar es un bug de
secuencia, no de expresividad.

### Un salto ESCRITO no separa palabras

En un prompt —que suele ser UNA sola cadena con saltos escritos— `'…contexto.\nDevolvé un
JSON'` no tiene ningún espacio entre `\n` y `Devolvé`: para un tokenizador que solo mira
letras, la palabra es **`ndevolvé`**, que no está en ningún diccionario. Así se escondían
`\nacá`, `\narrancá`, `\nvenís` y `\ndevolvé`.

Va `.replace(/\\[nrtvfb]/g, '  ')` — **dos espacios porque son dos caracteres**. En este
archivo nada puede cambiar de largo: el mensaje del hallazgo dice `archivo:línea` y el
arreglo se escribe por COLUMNA, así que una sustitución de otro tamaño corre el renglón y
las dos cosas empiezan a mentir. Lo cubre el test «sacar lo que no es copy no mueve ni una
línea ni una columna».

### La tilde del clítico se RECALCULA, y hay dos tildes distintas

El reemplazo tiene que servir para copiar y pegar, así que `mandale` → `mándale` y
`pedíselo` → `pídeselo` se calculan (sílabas, diptongos, hiatos). Lo que no es obvio:

- Sobre **í/ú** la tilde marca un HIATO y no se va nunca: `envía` + `lo` = `envíalo`.
- Sobre **á/é/ó** marca la tónica de una aguda, y con el clítico la palabra deja de ser
  aguda: `propón` + `lo` = **`proponlo`**, no `propónlo`. Igual `mantén` → `mantenlo`.

Arrastrar la tilde «porque ya estaba» da bien en el primer caso y mal en el segundo.

### Los homógrafos, y por qué la lista de excepciones es CORTA a propósito

Un guard con falsos positivos se termina apagando, y ahí se pierde el guard entero. Dos
familias producen casi todos:

| Patrón | Choca con | Ejemplos medidos en el repo |
|---|---|---|
| `-ar` + clítico `les` | un adjetivo/sustantivo plural | `iniciales` (41), `generales` (9), `terminales` (7), `puntuales` |
| `-ar` + clítico `te` | medio diccionario inglés | `create`, `validate`, `generate`, `activate`, `duplicate` |

El segundo **no se resuelve con excepciones**: el clítico `te` se genera solo para una lista
CERRADA de verbos reflexivos (`fijate`, `quedate`, `apurate`). El primero sí va como
excepción escrita, y `HOMOGRAFOS` tiene su propio test que falla si una entrada deja de
tapar algo que el generador arma — una excepción muerta es ruido que nadie se anima a tocar.

Y hay una tercera fuente que no es un patrón: **el inglés adentro de los prompts**. `moves`
(de `mover`) vive en los prompts de cámara de `lib/escenas.ts`.

### Reemplazar bien no es decir lo mismo

`PARÁ TODO` → `PARA TODO` es la conjugación CORRECTA de `parar`… y en neutro se lee como la
preposición («para todo el mundo»). Era la primera línea de la alerta más grave que manda
MaKo (`lib/alerta-critica-texto.ts`). Quedó **`DETÉN TODO`**.

**La regla:** un reemplazo mecánico es correcto por gramática, no por sentido. Los que hay
que mirar de a uno son los que caen encima de una preposición, un nombre propio o un
sustantivo — y aparecen sobre todo en ALL CAPS, donde no hay tilde que los distinga.

---

## Lo que el guard NO puede marcar, y hay que mirar a mano

**Vive en:** el bloque `IMPERATIVO_IR_SEGURO` de `tests/puente-panel-copy.test.ts`

El imperativo voseo de un `-ir` regular se escribe **igual** que la 1ª persona del
pretérito, y MaKo narra en primera persona todo el tiempo:

| La misma palabra | de vos (imperativo) | de MaKo (pretérito) |
|---|---|---|
| `escribí` | «escribí el mensaje» | «no la escribí» |
| `subí` | «subí el video» | «ya lo subí» |
| `elegí` | «elegí una opción» | «elegí el más común porque…» |

No hay forma de distinguirlos sin entender la frase, así que **no se generan** (las únicas
dos excepciones son `vení` y `decí`, cuyo pretérito es otro: `vine`, `dije`). Quedan
cubiertos a medias por el presente (`abrís`) y por el clítico (`abrilo`).

El 03/09/2026 se revisaron **43 candidatos** en copy visible: 33 eran imperativos y se
pasaron a neutro a mano; **11 quedaron** y son correctos (pretérito de MaKo, frases citadas
del usuario, un `console.warn` de desarrollo y un prefijo de regex).

⚠️ **Esto es un agujero permanente, no una tarea pendiente.** La forma de encontrarlos es
barrer las terminaciones voseantes (`-ás`, `-és`, `-ís`, `-á`, `-é`, `-í`) sobre el copy
visible y descartar a mano; casi todo lo que sale es legítimo (`está`, `aquí`, `después`,
`interés`, el futuro `verá`, el pretérito de MaKo), así que es una revisión, no un chequeo.

## Dos cosas más que conviene saber antes de tocarlo

- **El guard lee `git ls-files`, o sea el ÍNDICE.** Un archivo nuevo SIN commitear no se
  revisa y pasa en verde hasta que alguien lo agrega. Cubre lo que ya está en el repo, no lo
  que está a medio escribir.
- **`\b` de JavaScript es ASCII aunque pongas el flag `u`.** Entre la `á` de `pegá` y el
  espacio no hay borde de palabra, así que `\b(pegá)\b` da **cero coincidencias sin tirar
  ningún error**. Ya está en AGENTS.md y se repite acá porque es la trampa que hace que un
  test de voseo pase en verde sin cubrir nada: **cualquier prueba que se escriba tiene que
  incluir una palabra terminada en vocal acentuada**, o el bug pasa verde.

## Qué queda FUERA de alcance, y por qué

Además de los detectores y de los prompts que nombran el voseo para prohibirlo, desde el
03/09/2026 queda afuera **`app/vsl/`** (32 hallazgos): la landing de venta vende, y la voz de
ahí es la de Martín, no la del producto que se usa adentro. Es una decisión de producto, no
una limitación del guard.
