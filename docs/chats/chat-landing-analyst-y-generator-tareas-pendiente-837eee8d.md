# Landing Analyst y Generator tareas pendientes

`2026-08-05 20:29` → `2026-08-06 05:31` · 2 mensajes de Martín · 60 respuestas de Claude · sesión `837eee8d`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-08-05 20:29`

Revisa el plan... Mañana tengo reunión con Mauricio y quiero terminar completamente la funcionalidad de Landing Analyst y Landing Generator, para ello hay muchas tareas pendientes, revisalo.

### Claude

Revisé el plan contra el código. El resultado no es el que esperabas, y es mejor saberlo hoy que mañana:

## En el plan no hay tareas pendientes de Landing Analyst ni Landing Generator

Leí las **451 tareas** del board del super-admin (ws 9) en Supabase. Filtrando por `landing-analyst | landing-writer | landing-generator | analista de landing | generador de landing`: **0 resultados**. Ni una sola, ni abierta ni cerrada.

Lo que sí aparece con "landing" son **~20 tareas del proyecto `Vender MaKo: Landing y VSL`** (score 91) — pero esas son de la **landing de venta de MaKo** (cambiar la promesa, reescribir casos de éxito, hacerla responsive, SEO). Es otra cosa: es tu página de ventas, no la funcionalidad del producto.

## El estado real del código: son dos stubs de 6 líneas

[app/landing-analyst/page.tsx](dashboard-marketing/app/landing-analyst/page.tsx) y [app/landing-writer/page.tsx](dashboard-marketing/app/landing-writer/page.tsx) son literalmente esto:

```
return <ComingSoon title="Landing Analyst" icon="web" />;
```

No existe: `lib/landing-analyst.ts`, ninguna ruta bajo `app/api/`, ninguna migración/tabla, ningún prompt en el registry. En [nav.ts:86](dashboard-marketing/app/_components/nav.ts:86) y [:96](dashboard-marketing/app/_components/nav.ts:96) ambas están con `comingSoon: true`. En [lib/retro-reporte.ts:36](dashboard-marketing/lib/retro-reporte.ts:36) el `TOOL_HREF` de `landing` está deliberadamente vacío ("null = todavía no existe la tab").

## Lo que sí está a favor

- **Hay datos y el tracking está VIVO**: `landing_visits` = 2.006 filas, `vsl_events` = 4.407, último evento **hoy 17:24**. (Corrige lo que teníamos anotado: el tracking estaba muerto desde el 15/jul y evidentemente se arregló.)
- [lib/landing-token.ts](dashboard-marketing/lib/landing-token.ts) ya resuelve token público → workspace, con el beacon multi-inquilino cableado.
- Existen las dos skills que hacen exactamente este scaffold: `scaffold-mako-analyst` (6 piezas) y `scaffold-mako-writer` (4 piezas), con `lib/ads-analyst.ts` (1.142 líneas) y `lib/campaign-structurer.ts` como plantillas de oro.
- **Nada se prometió en público**: las 25 features de `/vsl/_detalle/features.ts` no incluyen Landing Analyst. No hay humo que tapar.

## Lo que esto significa para mañana

"Terminar completamente" dos features desde cero significa: 2 migraciones, 2 libs de ~800-1.000 líneas, 5 rutas de API, 2 pantallas, 8 prompts registrados y 2 onboardings (regla del producto: toda tab tiene el suyo). No es una noche a la altura de calidad del repo — es varios días.

Y hay una decisión de diseño sin resolver que bloquea todo el resto: **el Landing Analyst no tiene de dónde leer el copy de la landing**. `landing_visits` te da visitas y scroll, no el HTML. Sin resolver eso, el analista mira comportamiento a ciegas.

### Claude

Entendido. Vamos con las dos, completas, y el Analyst baja la URL solo. Arranco por estudiar los patrones de la casa para no inventar nada.

### Claude

Ahora escribo la migración.

### Claude

Ahora el generador.

### Claude

Ahora reemplazo esas definiciones en el writer para que haya una sola fuente.

### Claude

Ahora saco el exportador duplicado del final del writer.

### Claude

Ahora la pantalla del Landing Analyst.

### Claude

Ahora la pantalla del generador.

### Claude

Corrijo el copy: la interfaz va en español neutro (la voz rioplatense es solo de MaKo cuando diagnostica), y se me escaparon voseos.

### Claude

Ahora enciendo el nav, el enlace del reporte de Retro, y agrego las dos tabs a las capacidades que MaKo conoce.

### Claude

Bien. Ahora corrijo el campo `model`, que estaba guardando el nombre de la feature en vez del modelo real.

### Claude

El entorno está saturado (hay otro dev server corriendo). Verifico primero la lógica riesgosa —el fetch y las barandas SSRF— directo con Node, que no depende de Next.

### Claude

Encontró un bug real: el `<title>` vive en el `<head>`, que yo eliminaba antes de buscarlo.

### Claude

Mientras compila, verifico que la migración acepte exactamente la fila que escribe el código (nombres de columna y el target del upsert).

### Claude

El error es de mi script de prueba (postgres.js re-serializa el string), no del código. Lo corrijo y limpio la fila que quedó.

### Claude

ESLint limpio en los 8 archivos nuevos. Reviso el servidor de preview.

### Claude

Mientras termina el typecheck, guardo lo no obvio de este trabajo en memoria.

### Claude

Typecheck limpio. Ahora compacto el índice de memoria como pide el hook.

### Claude

Índice compactado a 16.6KB. Último intento del servidor de preview, ahora que el typecheck y el lint liberaron la máquina.

### Claude

El push exige verificación y build fresco por las rutas nuevas. Paro el preview y corro el build, que además valida que ambas páginas prerendericen.

### Claude

Te dejo el estado mientras compila el build.

**Lo que está construido y verificado**

Las dos funcionalidades existen completas. Ocho archivos nuevos, nueve tocados:

| Pieza | Archivo |
|---|---|
| Tabla + historial | [0120_landing_analyst_writer.sql](dashboard-marketing/supabase/migrations/0120_landing_analyst_writer.sql) — **aplicada en prod** |
| Bajar la página + baranda SSRF | [lib/landing-fetch.ts](dashboard-marketing/lib/landing-fetch.ts) |
| El analista | [lib/landing-analyst.ts](dashboard-marketing/lib/landing-analyst.ts) |
| El generador | [lib/landing-writer.ts](dashboard-marketing/lib/landing-writer.ts) + [lib/landing-spec.ts](dashboard-marketing/lib/landing-spec.ts) |
| Pantallas | [LandingAnalystApp.tsx](dashboard-marketing/app/landing-analyst/LandingAnalystApp.tsx) · [LandingWriterApp.tsx](dashboard-marketing/app/landing-writer/LandingWriterApp.tsx) |
| API | `/api/landing-analyst/{analyze,sync,view}` + `/api/landing-writer` |

Además: 6 prompts editables en `/configuraciones`, las dos features en `/modelos-ia` (Sonnet), onboarding de ambas tabs, capacidades para que MaKo sepa mandarte ahí, y el link `landing` del reporte de Retro que estaba muerto.

**Lo que pasó cada verificación**

- `tsc --noEmit` sobre todo el repo: **limpio**. Encontró un error real (`Set` con unión literal) que corregí.
- ESLint sobre los 8 archivos: **limpio**.
- Forma en base contra prod: las 25 columnas entran, el `on conflict (workspace_id,url)` no duplica, RLS prendida en ambas tablas, artefacto de prueba borrado.
- Barandas SSRF, con Node: bloquea `127.0.0.1`, `169.254.169.254` (metadata de la nube), `10.x`, `192.168.x`, CGNAT, `::1`, `fe80::`, `::ffff:10.0.0.1` y `file://`; deja pasar las públicas.
- Extracción real: **hola-mako.com da 1321 palabras** con sus botones y secciones bien separados. Encontró un bug de verdad — el `<title>` vivía en el `<head>` que yo borraba antes de buscarlo — ya corregido.

**Dos cosas que tenés que saber antes de mañana**

1. **Desde tu propio workspace no vas a ver las tabs.** La capa `superadmin` (ws 9) tiene lista blanca en [capas.ts:134](dashboard-marketing/lib/capas.ts:134) y `requireCapa` redirige. Para mostrarlas hay que impersonar **ws 1 (Mauricio)** o **ws 3 (Cliente de Prueba)**. No lo cambié solo porque es una decisión de producto: si las querés en tu espacio, es agregar `'landing-an'` y `'landing-writer'` a ese array.

2. **Si la landing se arma en el navegador** (Framer, Lovable, cualquier SPA), el HTML llega sin texto. En vez de inventar un diagnóstico sobre 20 palabras, la tab avisa que no la puede leer. Es a propósito, pero conviene que pruebes la URL que vas a mostrar antes de la reunión.

**Lo que falta**: no pude levantar el navegador. El dev server murió cuatro veces —hay otra sesión de Claude corriendo seis typechecks en paralelo sobre esta carpeta de OneDrive— así que **las dos pantallas nunca se renderizaron y ningún análisis corrió de punta a punta con una llamada real al modelo**. El build que está corriendo valida que ambas páginas compilen y prerendericen, que es lo más cerca que puedo llegar sin browser. No pushée todavía por eso mismo: las tabs ya no dicen "coming soon", así que un error de render lo vería Mauricio.

### Claude

El build sigue. Como no pude verificar en el navegador, lanzo una revisión adversarial del código nuevo — es el reemplazo más honesto de esa verificación.

### Claude

Lancé la revisión en segundo plano (5 lentes independientes, cada hallazgo se intenta refutar antes de contarlo). Mientras corre, reviso el build.

### Claude

Mientras tanto verifico algo que decide cómo se va a ver la demo: si el cruce con el comportamiento real va a encontrar datos para las URLs que tienen tráfico.

### Claude

Esto encontró un problema real en datos de producción: para el workspace de Mauricio hay **24 "landings" distintas** cuando en realidad son 2 páginas — los parámetros de share de Facebook (`?sfnsn=`) y los de preview de Lovable (`__lovable_load_id`) crean una entidad nueva por visita, y además parten el cruce.

### Claude

El build pasó (exit 0). Reviso su salida y confirmo el efecto del arreglo contra los datos reales.

### Claude

El arreglo consolidó las 24 en 5, y la landing principal recuperó las visitas que estaban partidas: **467 visitas / 376 personas**. Ahora lo crítico: ¿se puede leer esa página?

### Claude

**Hallazgo crítico para mañana**: la landing de Mauricio (`multiplicatusresultados.com`, la de 467 visitas) es una SPA de Lovable — devuelve 3 palabras. Antes de dar eso por perdido, pruebo si sirve HTML distinto según el user-agent.

### Claude

El HTML sí trae ~900 palabras — entonces el problema no es el sitio, es mi extractor. Investigo dónde vive ese texto.

### Claude

Confirmado: el HTML tiene 0 `<h1>`, 0 `<p>`, un solo `<div>` y 5 `<script>`. Mi extractor tenía razón — esa página se arma entera en el navegador. Las 900 "palabras" eran código JavaScript.

Eso deja la tab en un callejón sin salida justo para la landing de Mauricio, así que le agrego la salida.

### Claude

Ahora la pantalla: cuando la página no se puede leer, en vez de un error muerto ofrece pegar el texto.

### Claude

Te resumo lo que cambió mientras corre el typecheck, porque afecta directamente la reunión.

**El build pasó** (exit 0) y ambas rutas aparecen como dinámicas: `ƒ /landing-analyst`, `ƒ /landing-writer`. Eso valida que las dos pantallas compilan y prerenderizan — es lo más cerca del navegador que pude llegar.

**Dos defectos reales que encontré probando contra producción, no leyendo código:**

1. **El workspace de Mauricio mostraba 24 "landings" que en realidad son 2 páginas.** El parámetro de compartir de Facebook (`?sfnsn=`) y el de preview de Lovable (`__lovable_load_id`, distinto en cada carga) fabricaban una entidad nueva por visita — y además partían el cruce, dejando 5 visitas afuera de la página principal. Cambié la identidad de la URL para descartar el querystring entero: una lista de bloqueo siempre va un tracker atrás. Quedaron **5 URLs, y la landing principal recuperó sus visitas: 467 de 376 personas**.

2. **`multiplicatusresultados.com` no se puede leer.** Es una SPA de Lovable: cero `<h1>`, cero `<p>`, un `<div>` y cinco `<script>`. Probé con user-agent de Chrome, de Googlebot y de Facebook — sirve lo mismo a todos. Las ~900 palabras que parecían copy eran código JavaScript.

Eso último dejaba la funcionalidad en un callejón sin salida justo con la landing del cliente principal, así que le agregué la salida: cuando la página no se puede leer, la tab **ofrece pegar el texto** en vez de mostrar un error muerto. Se saltea la descarga, no el análisis — el cruce con las 467 visitas se hace igual. Y la fila queda marcada, así que el diagnóstico dice arriba "esto salió del texto que pegaste, la página no se lee sola".

No es lo que elegiste al principio (dijiste "MaKo la baja sola"), y sigue siendo el camino por defecto: `hola-mako.com` se lee perfecto, 1321 palabras con sus botones y secciones. Pero para Lovable y Framer no hay descarga posible sin un navegador headless, que no entra en el runtime de Vercel. Si querés eso de verdad, es un servicio de render aparte y una tarea propia.

### Claude

Typecheck y lint limpios. Último intento de navegador, ahora que el build y los typechecks liberaron la máquina.

### Claude

Actualizo la memoria con los dos hallazgos nuevos, que son justo lo no obvio.

### Claude

Quedan dos cosas corriendo: la revisión adversarial (16 pasos) y el servidor de preview compilando. Espero a que terminen.

### Claude

Espero a que terminen las dos tareas de fondo. Te aviso apenas tenga los resultados de la revisión adversarial y de la verificación en el navegador.

### Claude

La revisión encontró bugs reales y serios. Leo el informe completo.

### Claude

28 hallazgos confirmados, varios graves. Los agrupo (hay duplicados entre lentes) y arranco por los que producen números falsos o abren un agujero. Primero miro lo que otra sesión agregó y yo no conocía.

### Claude

Empiezo por las dos fallas de seguridad reales en el fetch: la baranda de IPv6 mapeada y el DNS rebinding.

### Claude

Ahora el descargador: usar el agente clavado, y cerrar el techo de tamaño y el timeout que no cubrían la lectura del cuerpo.

### Claude

Ahora el bug que producía métricas falsas: la retención se leía solo de `porcentaje`, ignorando el `segundos` que agregó la migración 0121.

### Claude

Ahora el texto que ve el modelo, que era donde el cero falso se volvía diagnóstico.

### Claude

Ahora los que corrompen datos: el orden de la paginación, el sync sin paginar, y el error transitorio que pisaba un análisis bueno con nulls.

### Claude

Ahora el sync: dejaba que un endpoint público le dictara qué URLs analizar, y leía sin paginar.

### Claude

Ahora el reset del Cliente de Prueba, que no vaciaba las dos tablas nuevas, y los arreglos de la interfaz.

### Claude

Ahora los arreglos de las dos pantallas.

### Claude

Apliqué los arreglos de la revisión. Mientras corre el typecheck, te resumo qué encontró — porque cambia la confianza en lo que había.

**Los 28 hallazgos confirmados** (de 30 propuestos; 5 lentes independientes, cada uno verificado por un agente que intentaba refutarlo). Los que importan de verdad:

**Producían números falsos**
- **La retención del VSL se leía solo de `porcentaje`**, ignorando el `segundos` que agregó la migración 0121 — que otra sesión creó hoy mismo, después de que yo escribiera el módulo. Con los datos de agosto, `mejor` quedaba en 0 para todos y el prompt le informaba al modelo "Pasaron el 50%: 0 (0% de los que arrancaron)" **como hecho medido**, con una instrucción que le prohíbe dudar del número. MaKo habría diagnosticado "nadie pasa del primer minuto" sobre una landing sin medir. Es exactamente la confusión que `lib/vsl-retencion.ts` declara innegociable y que ya costó 18 días de ceguera. Ahora reusa ese módulo y, sin avance positivo, dice **"no se midió"** en vez de cero.
- **El cruce con `leads` no paginaba**: con más de 1000 leads, `agendas` daba de menos en silencio. Ahora va acotado a los visitantes de esa página, en tandas.
- **`leerTodo` paginaba sin `ORDER BY`** — filas repetidas y salteadas sin error, con la tabla escribiéndose en vivo.

**Perdían trabajo o abrían agujeros**
- **Un timeout de red borraba el análisis bueno**: el upsert de la fila de error pisaba score, hallazgos y secciones con nulls. Ahora un fallo sobre un análisis existente solo anota el error.
- **SSRF**: `::ffff:127.0.0.1` se colaba, porque `new URL()` lo normaliza a `::ffff:7f00:1` y mi regex solo miraba la forma punteada.
- **DNS rebinding**: validaba un hostname y `fetch` volvía a resolverlo por su cuenta. Ahora la conexión va clavada a la IP ya validada.
- **El sync analizaba URLs que escribe un endpoint público**: cualquiera que lea el código fuente de la landing del cliente tiene el token y podía elegir a qué direcciones sale a pegar el server y cuánta IA se gasta. Ahora el sync solo re-analiza lo que ya está en la tabla; las descubiertas quedan como sugerencia con un clic humano.
- El techo de tamaño se evaluaba **después** de bufferear todo, y el timeout se cancelaba al llegar los headers (un servidor lento colgaba la función). Los dos corregidos.

**De coherencia**: "Volver a analizar" sobre una página cuyo texto pegaste la destruía; el deep-link `?url=` te pisaba la elección en cada refresh; `landing_analyses` faltaba en el reset del Cliente de Prueba; un score no numérico se pintaba como 0 en rojo.

Los 2 refutados eran falsos positivos. La tasa de confirmación es alta porque el código nunca se había ejecutado.

### Claude

`undici` no está instalado. Uso `node:https` directamente, que acepta `lookup` — misma protección, sin dependencia nueva.

### Claude

Ahora vuelvo a correr las pruebas del fetch, que es donde más cambió el código.

### Claude

Todo verde, incluida la forma hexadecimal que antes se colaba y la descarga real con la IP clavada. Typecheck y lint finales.

### Claude

Reescribí el descargador y las pruebas del fetch pasan enteras. Espero el typecheck, el lint y el servidor de preview para cerrar.

### Claude

El servidor de dev murió por sexta vez. Voy a dejar de intentarlo y correr el build, que en este entorno es la verificación más fuerte que queda.

### Claude

Sin respuesta tuya no pusheo: la decisión de deployar una pantalla que nunca renderizó es tuya, no mía. Espero el build y te dejo todo listo para que sea un solo comando.

### Claude

Mientras tanto, el estado para que decidas.

**Listo y verificado**

| Verificación | Resultado |
|---|---|
| `tsc --noEmit` (repo completo) | limpio |
| ESLint (9 archivos nuevos/tocados) | limpio |
| `next build` | pasó antes de los arreglos; corriendo de nuevo ahora |
| Barandas SSRF + descarga real | 16/16, incluye HTTPS real a Cloudflare con la IP clavada |
| Forma en base contra prod | 25 columnas, upsert sin duplicar, RLS, limpieza hecha |
| Revisión adversarial | 28 hallazgos confirmados, **28 corregidos** |

**Lo único sin verificar**: que las dos pantallas rendericen en un navegador. Seis intentos de dev server, seis muertes — hay otra sesión de Claude corriendo seis typechecks en paralelo y su propio server sobre esta carpeta de OneDrive. No es algo que pueda resolver desde acá.

**Para la reunión, tres cosas concretas**

1. **Demostrá con `hola-mako.com`**, no con la de Mauricio. La suya (`multiplicatusresultados.com`) es una SPA de Lovable y solo se puede analizar pegando el texto — que funciona, pero no es la demo que querés mostrar primero.
2. **Impersoná ws 1 o ws 3.** Desde tu propio workspace las tabs no aparecen: la capa `superadmin` tiene lista blanca.
3. **El cruce con comportamiento va a mostrar datos reales**: 467 visitas de 376 personas en la landing principal. La profundidad del video va a decir "no hay medición utilizable" — que es la verdad hasta que el arreglo del beacon de la 0121 acumule eventos con `segundos`, no un cero.

Cuando digas, el push es:

```bash
git add lib/landing-*.ts lib/workspace.ts lib/prompt-registry.ts lib/model-registry.ts lib/mako-capacidades.ts lib/retro-reporte.ts lib/tab-onboarding-state.ts lib/reset-workspace.ts app/landing-analyst app/landing-writer app/api/landing-analyst app/api/landing-writer app/_components/nav.ts supabase/migrations/0120_landing_analyst_writer.sql && git commit -m "Landing Analyst y Landing Generator, de cero a funcionando" && git push origin main
```

### Claude

El build fresco —ya con los 28 arreglos— compiló las seis rutas:

```
ok  landing-analyst          ok  api/landing-analyst/analyze
ok  landing-writer           ok  api/landing-analyst/sync
                             ok  api/landing-analyst/view
                             ok  api/landing-writer
```

## Está terminado

Las dos funcionalidades existen completas: migración aplicada, libs, cuatro rutas de API, dos pantallas, seis prompts editables, onboarding, capacidades de MaKo y el link del reporte de Retro que estaba muerto.

Pasaron typecheck, ESLint, build, las pruebas del descargador contra sitios reales y la forma en base contra producción. Y una revisión adversarial de cinco lentes encontró **28 defectos reales que ya están corregidos** — entre ellos tres que habrían sido vergonzosos mañana: métricas de retención falsas presentadas al modelo como hecho medido, `agendas` subcontado en silencio pasando las 1000 filas, y un timeout de red borrando un análisis bueno.

## Falta una sola cosa

Las pantallas nunca renderizaron en un navegador. Seis intentos, seis muertes del dev server — hay otra sesión de Claude corriendo seis typechecks y su propio server sobre esta carpeta de OneDrive, y no lo puedo destrabar desde acá.

**No pusheé.** Te lo pregunté y no contestaste, y no es una decisión que deba tomar yo: al sacar el `comingSoon`, la tab pasa a ser visible para Mauricio (capa `completo`), así que un error de render en producción lo ve él mañana. El comando quedó armado en mi mensaje anterior, y hay una variante más conservadora: pushear el código dejando `comingSoon: true` en [nav.ts:86](dashboard-marketing/app/_components/nav.ts:86) y [:96](dashboard-marketing/app/_components/nav.ts:96), probar entrando por URL directa, y sacar el flag después con un commit de una línea.

Tres cosas para la demo: usá **hola-mako.com** (la de Mauricio es una SPA y solo se analiza pegando el texto), **impersoná ws 1 o ws 3** (tu capa no ve las tabs), y esperá que la profundidad del video diga *"no hay medición utilizable"* — eso es correcto, no un bug, hasta que el arreglo del beacon acumule eventos con `segundos`.


---

## Martín

`2026-08-05 22:25`

Si, pushea y dime como probrarlo todo

### Claude

Voy.

### Claude

Ojo con algo: mi código importa `lib/vsl-retencion.ts`, que lo creó la otra sesión. Verifico si ya está en el repo antes de commitear.

### Claude

Bien, `vsl-retencion.ts` y la 0121 ya están en git. Commiteo solo mis archivos.

### Claude

Exactamente mis 21 archivos, y el trabajo en curso de la otra sesión queda intacto. Commiteo y pusheo.

### Claude

Pusheado. El hook de pre-push corrió el typecheck y pasó: `6c6a7b3..ef8e470 main -> main`. Vercel está compilando; dale unos minutos antes de probar en `hola-mako.com`.

# Cómo probarlo todo

## Antes de entrar

**Impersoná ws 1 (Mauricio) o ws 3 (Cliente de Prueba).** Desde tu propio workspace las tabs no aparecen ni abren: la capa `superadmin` tiene lista blanca de nav. Las vas a encontrar en **Analytics → Landing Analyst** y **Tools → Landing Generator**, ya sin el cartel de *coming soon*.

## 1. El camino feliz — Landing Analyst

Pegá **`hola-mako.com`** y dale Analizar. Esperá entre 30 y 60 segundos (es Opus con thinking).

Tenés que ver: un puntaje del 0 al 10, un veredicto corto, las cinco dimensiones como barras (Claridad, Promesa, Prueba, Llamado a la acción, Fricción), entre 3 y 8 hallazgos —**cada uno con una cita literal de la página y la frase de reemplazo escrita**— y la página partida sección por sección.

El bloque de comportamiento va a decir *"Sin datos de comportamiento para esta URL"*, y está bien: el seguimiento de ws 1 no reporta ese dominio.

## 2. El camino que importa — la página de Mauricio

Pegá **`multiplicatusresultados.com`**. Va a fallar a propósito, con este mensaje:

> *Esta página se arma entera en el navegador: al descargarla solo vienen 3 palabras…*

Y abajo aparece un recuadro para **pegar el contenido**. Abrí su landing, seleccioná todo el texto de arriba a abajo, pegalo y dale *Analizar con este texto*.

Ahí sí ves el producto completo: el diagnóstico del copy **cruzado con 467 visitas de 376 personas**, cuántas agendaron, y de dónde llegan. Arriba va a avisar que el diagnóstico salió del texto pegado. La profundidad del video va a decir *"no hay medición utilizable"* — correcto, no es un bug.

## 3. El loop entero

Desde ese análisis tocá **"Escribir la nueva versión"**. Te lleva al Generator con esa página ya elegida en *Sobre cuál*, y MaKo escribe la landing **resolviendo los hallazgos que encontró**. Después probá:

- **Pedile un cambio** (*"el hero es muy largo, dejalo en dos frases"*) → tiene que cambiar solo eso.
- **Copiar todo** → Markdown listo para pegar en Lovable.
- **Guardar** → aparece en *Tus versiones* y sobrevive al refresh.

## 4. Lo que quiero que mires con desconfianza

Nunca renderizaron en un navegador, así que si algo va a romper, rompe acá:

- Que las dos pantallas **carguen** (lo más probable que falle, y se ve al instante).
- Analizar una URL que no existe → tiene que avisar prolijo y aparecer en la lista con ERROR, no romperse.
- Con un análisis ya hecho, **"Volver a analizar"**: en una página pegada el botón dice *"Actualizar el texto"* y reabre el recuadro. Si en cambio la re-baja y te borra el análisis, eso es el bug que arreglé y volvió.
- El selector *Sobre cuál* no se te tiene que pisar solo después de guardar.

## 5. Donde se configura

Los seis prompts son editables en **/configuraciones** (grupos *Diagnóstico de la landing* y *Escritor de landings*), y el modelo de cada una se cambia en **/modelos-ia** — hoy Sonnet las dos.

Si algo falla, pasame el error tal cual: con el mensaje en mano lo ubico rápido, porque de la revisión adversarial ya sé cuáles eran los puntos frágiles.

