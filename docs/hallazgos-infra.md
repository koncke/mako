# Hallazgos de infraestructura

Lo que gobierna a **todas** las áreas: cómo se lee de Supabase sin perder filas, cómo se
manejan las zonas horarias, las trampas del runner de tests y cómo trabajar con varias
sesiones en el mismo árbol. **No es un changelog.**

Origen: corridas multi-agente de 08/2026. Regla de la cosecha en `AGENTS.md`.

---

## 1. Paginado: leer una tabla entera sin perder filas

### La página 2 no es la continuación de la página 1 si el orden no es único

**Síntoma:** cuatro pantallas distintas, el mismo error de fondo y ninguna avisa nada.
La agenda de WhatsApp mostraba la mitad de los contactos con el número crudo, como si no
tuvieran nombre. El importador del CRM decía "nuevo" sobre un lead que ya estaba en la
base — o sea, **creaba el duplicado que ese código existe para evitar**. El dump del
tablero salía incompleto. El contador de cobertura de anuncios decía que faltaban
analizar anuncios que ya estaban.

**El diagnóstico obvio era el equivocado.** Todos parecían "falta paginar, PostgREST
corta en 1000". Paginar era la mitad: varios de esos bucles **ya** paginaban con
`.range()` y seguían perdiendo filas. `.range(desde, hasta)` es `OFFSET/LIMIT`, y sin
`ORDER BY` el motor no promete el mismo orden entre dos requests: la página 2 repite
filas de la 1 y saltea otras. En `evolution-contactos` el comentario del código
**afirmaba** que el `.range()` había arreglado el síntoma, y el síntoma seguía vivo por
la otra mitad.

Un orden que **se repite** es la misma trampa con otra cara, y es la más fácil de pasar
por alto porque "sí hay ORDER BY":

| Columna | Por qué se repite |
|---|---|
| `wa_timestamp` | 16 mensajes en 4 segundos comparten segundo; los volcados del importador, más |
| `ad_id` en `marketing_metrics_daily` | hay **una fila por anuncio y por día** |
| `fecha`, `created_at` | empates masivos por definición |

**Dónde:** `lib/supabase-paginado.ts` — `leerTodo()` y `leerPorPaginas()`. El orden por
defecto es `'id'`; `orden` acepta una lista (`[{col:'fecha',asc:false},{col:'id'}]`) justo
para desempatar.

**Regla:** el orden de un bucle paginado tiene que ser **único**. Si la columna natural
se repite, se desempata por la PK en el mismo `orden`. Y `.limit()` **no** sube el techo
de 1000 filas del servidor: no es un límite del cliente.

### `leerTodo` vs `leerPorPaginas`: cuándo materializar

`leerTodo` junta todo en un array. Está bien para tablas chicas, y mal cuando de cada
fila sobrevive un contador: un año de 200 anuncios son ~73.000 filas de
`marketing_metrics_daily` para terminar con un `Map` de 200 claves. `leerPorPaginas`
entrega la página y la tira.

El callback devolviendo `false` corta el barrido. **Esa es la única forma legítima de
truncar**, y el punto es que queda **a la vista en el call-site** (`return nro < TOPE`)
en vez de escondida en el `desde < 20000` de un `for` que nadie lee.

### Un tope nuevo es un truncado nuevo

**Síntoma:** el análisis de una landing viva pasó a decir "sin datos de comportamiento" y
el importador de contactos dejó de importar. Nada en el log decía "se cortó".

**Causa:** unificar seis bucles `.range()` en el helper trajo un `MAX_PAGINAS = 100`
(100k filas) que **tres de los seis no tenían**: `indiceContactos` paginaba hasta 200k a
mano, y `landing_visits` / `marketing_metrics_daily` no tenían techo. El `throw` del tope
cae en el `catch` que esos callers ya tenían para degradar —`catch { return vacio; }`— y
ahí un error se lee como "no hay nada".

**Dónde:** `MAX_PAGINAS = 1000` + la opción `maxPaginas` por llamada
(`lib/supabase-paginado.ts:68`). Es un **cinturón** contra un bucle que no converge, no un
límite de producto: tiene que quedar por encima de la lectura legítima más grande de
cualquier caller.

**Regla:** cuando un helper absorbe N copias, **su límite más restrictivo se lo come todo
el mundo**. Antes de unificar, comparar los topes de las N copias, no solo su lógica.

### Romper fuerte río arriba con un `catch` río abajo es un falso all-clear

Corolario del anterior y la trampa más cara de las tres, porque **no parece un error**:
una lectura que pasa a lanzar, más un `.catch(() => [])` río abajo, convierte "se rompió"
en "no hay nada", que son cosas opuestas. Pasó en el worklist del CRM (el ✓ verde "todo
marcado" con la lista incompleta, ver
[hallazgos-crm.md](hallazgos-crm.md) §3) y en el análisis de landings
([hallazgos-landing.md](hallazgos-landing.md)).

**Regla:** si una lectura pasa a lanzar, seguí la excepción **hasta la pantalla**. La
decisión de degradar se toma por dato ("esto es accesorio") y se muestra ("lista
parcial"), nunca por omisión.

---

## 2. Zonas horarias

### Display se migra; una clave persistida, no

**Dónde está el corte:** `lib/calendly.ts:167` (`isoToFechaTijuana`). No es display: es la
**clave de cohorte** que se persiste (`fecha_agenda`, `fecha_junta_1/2`, la fecha de la
llamada en closing) y la escriben cuatro módulos. Sus **lectores** calculan "hoy" con
`hoyEnTijuana()` en `crm-auto`, `leads`, `reportes`, `experimentos` y `app/crm/actions.ts`.

Migrar solo la escritura desfasa los bordes del día: una R1 agendada para hoy dejaría de
contar como de hoy y el No Show automático se dispararía un día corrido.

**Regla:** **escritura y lectura de una clave de fecha se migran en el mismo commit o no
se migran.** Mientras tanto no se pierde precisión: `junta_1_at` guarda el instante ISO
exacto, que es lo que usa el motor.

El literal de `isoToFechaTijuana` quedó **crudo a propósito**, sin `TZ_TIJUANA`: si algún
día cambia la zona por defecto del producto, el ancla de las cohortes ya escritas **no**
debe seguirla.

### Comparar dos fechas de zonas distintas es el bug, no el hardcode

`cancelarJuntaEnLead(lead, fechaCancelada, hoyEnTijuana())`
(`app/api/webhooks/calendly/route.ts`): los dos argumentos **se comparan entre sí**.
Migrar uno solo "para sacar el hardcode" es peor que dejar los dos. Quedaron juntos en TJ
y comentado.

### El literal de la zona por defecto vive en un módulo sin `server-only`

`lib/timezone.ts` es `server-only`, así que un componente de cliente no puede leer de ahí
el fallback. En vez de duplicar el string, `TZ_TIJUANA` se exporta desde
`lib/date-utils.ts` (que a propósito **no** es server-only) y `lib/timezone.ts` hace
`TZ_DEFAULT = TZ_TIJUANA`. Una cosa, un lugar: el segundo literal es el que se queda viejo.

---

## 3. Tests y entorno

| Trampa | Dónde | Qué hacer |
|---|---|---|
| **`server-only` tira al importarse desde el runner de tests** | `lib/etapa-historial.ts` y cía. | Parchear `Module._load` antes del `import()` dinámico (funciona porque tsx compila los tests a CJS). |
| **Los guards de texto leen de más en Windows** | `tests/*.test.ts` | Normalizar CRLF: sin eso el corte por `'\n}\n'` no encuentra el fin de la función. Costó un falso positivo. |
| **`node --test` corre cada archivo en su propio proceso** | ídem | Se aprovecha a favor: para un ciclo de imports, un test importa A primero y otro importa B primero, y así quedan cubiertos los dos órdenes de carga. |
| **El typecheck NO corre en el build** | `.git/hooks/pre-push` | Ver `AGENTS.md`. El hook no se versiona: si se reclona, desaparece en silencio. |

### Un ciclo de imports es inocuo hasta que alguien lo evalúa

`lib/pipeline.ts ⇄ lib/funnel-etapas.ts` se importan mutuamente. Es inocuo **porque
ninguno de los dos usa lo del otro mientras se evalúa el módulo**, solo dentro del cuerpo
de las funciones. La condición exacta que lo rompería está escrita en la cabecera de
`funnel-etapas.ts`: un `const X = DEFAULT_PIPELINE...` a nivel de módulo, y falla distinto
en el server, en el cliente y en los tests según quién se cargue primero.

**Regla:** si dejás un ciclo, escribí la condición que lo activa y cubrí los dos órdenes
de carga con tests en archivos separados.

---

## 4. Proceso: varias sesiones en el mismo árbol

- **El typecheck rompe por archivos que no son tuyos.** Durante estas corridas aparecieron
  y desaparecieron `TS2552: Cannot find name 'Stage'`, `'Opcion'`, y refactors a medio
  terminar. **El verde se toma con el árbol estable**, y lo ajeno se reporta, no se
  "arregla".
- **`git add -A` se lleva los archivos a medias de la otra sesión.** Commitear seguido y
  explícito.
- **Verificá contra el código, no contra el resumen del agente anterior.** Un agente
  reportó como "arreglado" algo que otro seguía editando, y dos reportes se contradecían
  sobre el mismo archivo.
- **La deferencia colectiva deja el doc mintiendo.** Cuatro reportes seguidos anunciaron
  "esta fila del doc quedó obsoleta, no la toqué porque hay otra sesión en el árbol". Los
  cuatro dijeron lo mismo y **ninguno la tocó**: para quien leyera el documento al día
  siguiente, cinco frentes cerrados seguían abiertos. Un `.md` no es código: el conflicto
  se resuelve leyendo. **Si sos el que cierra, cerrá también el documento.**

### Separar las cuentas por `CLAUDE_CONFIG_DIR` también separa la memoria

Para tener cuota los 7 días hay **dos cuentas** de Claude Code sobre este clon, aisladas
con `CLAUDE_CONFIG_DIR` (`~\.claude` y `~\.claude-martin`). El protocolo completo está en
[dos-cuentas.md](dos-cuentas.md); acá va solo la trampa.

**El diagnóstico obvio era el equivocado.** La documentación del esquema decía que los
directorios separados aíslan la sesión pero no los settings del proyecto, «que es lo que
querés». Es cierto y es la mitad: **las 159 memorias viven DENTRO del config dir**
(`<config>\projects\<clave>\memory\`), igual que el `CLAUDE.md` global. La cuenta nueva no
arranca con menos permisos: arranca **ciega**, sin nada de lo aprendido, y no hay ningún
error que lo indique — simplemente no sabe.

Lo que sí comparten las dos es todo lo **versionado**: `AGENTS.md`, `docs/`, las skills de
`.claude/skills`. Por eso el canal de traspaso entre cuentas son estos documentos, no las
memorias.

Se resolvió con **junctions de NTFS**, no con copias: `mklink /J` desde cada ruta a la
carpeta real. Una copia se bifurca en silencio y en dos semanas hay dos verdades. Ojo con
un detalle que multiplica las rutas: la clave de proyecto sale del **cwd**, así que abrir
la sesión desde la carpeta padre o desde el repo genera dos claves distintas y cada una
busca su propia `memory/`.

---

## 5. Pushear no es desplegar

**Síntoma:** el dueño abre el CRM y ve la versión vieja de una feature que se le
reportó como terminada dos veces. Ni el selector de horas nuevo ni la búsqueda
avanzada estaban en vivo, y las dos estaban en `origin/main`.

**Causa real:** el build de Vercel fallaba desde hacía una hora, y producción seguía
servida por el último build exitoso — de hacía tres. Vercel **no revierte ni avisa**:
deja el deploy anterior en pie y el sitio funciona, con el código viejo.

```
./app/crm/actions.ts:65
Export alinearEtapaVista doesn't exist in target module
```

`app/crm/actions.ts` se commiteó; `lib/etapa-historial.ts`, que define esa función,
no. Y lo que hace que esto sea difícil de ver: **las tres redes de seguridad lo dejan
pasar**, porque las tres miran el árbol de trabajo, donde el archivo SÍ está.

| Red | Por qué no lo agarra |
|---|---|
| `npm run build` local | Compila el árbol de trabajo, con el archivo sin commitear ahí |
| `npm test` | Ídem |
| El hook `pre-push` (`tsc --noEmit`) | Ídem — chequea lo que tenés, no lo que subís |

**Por qué se llegó a eso:** con varias sesiones en el mismo árbol hay que commitear
archivo por archivo (`git add -A` se lleva el trabajo a medias de la otra sesión, ver
§4). Al hacerlo a mano es fácil subir el que **importa** y dejarse el que **define**.

**Las reglas que quedan:**

1. **Verificá el deploy, no el push.** Un push no es una entrega:
   ```bash
   npx vercel ls --yes --scope mbustos-4239s-projects
   ```
   La primera fila tiene que decir `● Ready`. Si dice `● Error`, producción está
   sirviendo código viejo AHORA MISMO. El log del build:
   `npx vercel inspect <url> --logs --scope mbustos-4239s-projects`
2. **Confirmá que lo desplegado te incluye.** Con sesiones paralelas, el deploy que
   ves puede ser de la otra: `git merge-base --is-ancestor <tu-sha> origin/main`, y el
   commit desplegado sale del log (`Cloning … Commit: <sha>`).
3. **Antes de pushear, buscá los símbolos huérfanos**: exportaciones que existen en tu
   árbol pero no en `origin/main`, y que ya usa código subido. Es el modo de falla
   exacto de este incidente:
   ```bash
   git status --porcelain | grep -E "^( M|\?\?)" | awk '{print $2}' | grep -E "\.tsx?$"
   # por cada uno: comparar sus `export` contra `git show origin/main:<archivo>`
   ```

**El diagnóstico obvio era el equivocado:** con la captura del dueño delante, todo
apuntaba a que el código estaba mal o se había perdido en un merge. Estaba bien y
estaba pusheado. Antes de volver a escribir una feature que "no aparece",
**comprobá que lo que el usuario mira es lo que vos escribiste**.

---

## 6. Lo que quedó sin hacer

| Qué | Dónde | Por qué |
|---|---|---|
| **Las primitivas de fecha siguen ancladas a Tijuana** (`hoyEnTijuana`, `ayerEnTijuana`, `lunesActualEnTijuana`, `primerDiaDelMesEnTijuana`), ~60 call-sites | `lib/date-utils.ts`, anotado en `lib/timezone.ts:47` | No es display: son bordes de día que deciden cohortes y disparos. Aplica la regla de arriba: escritura y lectura juntas. |
| **Bucles `.range()` a mano que quedaron fuera del barrido** | `scripts/limpiar-seed-clientes.ts:72`, `scripts/probe-historial-largos.ts:28` | Son scripts one-off, pero tienen el mismo techo mudo. |
| **Topes de una sola página** | `lib/cerrar-por-commits.ts:86` (600), `app/api/plan-buscar/route.ts:88` | No son bucles rotos: son techos deliberados sin cartel. Si la tabla crece, cortan en silencio. |

### Descartado a propósito (no volver a "arreglarlo")

- **Aprender el techo real de PostgREST desde la primera página corta.** Se implementó y
  se **revirtió**: una página corta es indistinguible del final de la tabla, así que la
  única detección honesta cuesta un request extra en **cada** lectura chica (3 por carga
  del CRM, +100-180 ms) para blindar una configuración que este proyecto no tiene.
  `PAGINA_POSTGREST = 1000` es el default de Supabase. **Si se baja `db-max-rows`, se baja
  la constante en el mismo commit** — está escrito en el módulo.
