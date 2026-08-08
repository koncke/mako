# VSL Analyst y Generator tareas pendientes

`2026-08-05 20:30` → `2026-08-05 22:01` · 2 mensajes de Martín · 27 respuestas de Claude · sesión `e491f6d6`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-08-05 20:30`

Revisa el plan... Mañana tengo reunión con Mauricio y quiero terminar completamente la funcionalidad de VSL Analyst y VSL Generator, para ello hay muchas tareas pendientes, revisalo.

### Claude

Revisé el plan contra el código real. El resultado principal es incómodo pero es mejor saberlo hoy que mañana:

## En el plan no hay tareas de VSL Analyst ni de VSL Generator

Busqué en el tablero (`plan_tareas` / `plan_proyectos`, ws9). De 37 proyectos, **ninguno es VSL Analyst ni VSL Writer**. Lo único relacionado son 3 tareas sueltas, todas sin puntuar en serio:

| # | Tarea | Score | Proyecto donde cayó |
|---|---|---|---|
| 51 | "Escritor de VSL + escritor de DMs + loop analizar→escribir→producir" | **3** | Chat Agent |
| 204 | "Desarrollar Creador de VSL en 4 fases" | **25** | Fábrica de creativos |
| 210 | "Catálogo multi-producto, múltiples landings/VSL y test A/B" | **16** | Vender MaKo: Landing y VSL |

Las 12 tareas que aparecen con "VSL" en el título son de la **landing propia** (grabar el VSL de MaKo, YouTube, biografía del canal), no del producto. Y hay un problema de fondo: el catálogo cerrado de [lib/plan-proyectos-catalogo.ts](dashboard-marketing/lib/plan-proyectos-catalogo.ts:46) **no tiene entradas para VSL Analyst ni VSL Writer**, así que cualquier tarea nueva que MaKo rutee va a caer en "Vender MaKo: Landing y VSL" — que es el marketing propio, no la funcionalidad. Eso hay que arreglarlo antes de cargar nada.

## Estado real del código

Ambas pantallas son un cartel: `<ComingSoon />` en [vsl-analyst/page.tsx](dashboard-marketing/app/vsl-analyst/page.tsx) y [vsl-writer/page.tsx](dashboard-marketing/app/vsl-writer/page.tsx), con `comingSoon: true` en [nav.ts:87](dashboard-marketing/app/_components/nav.ts:87) y [:95](dashboard-marketing/app/_components/nav.ts:95). Cero registro en `model-registry`, `ia-labels`, `prompt-registry`, `mako-capacidades` ni `tab-activacion`. La Retro ya declara `vsl: 'VSL Analyst'` como fuente pero `TOOL_HREF` no tiene ruta: el "Ver en VSL Analyst →" está muerto.

Lo bueno: no arrancás de cero. Existen los dos scaffolds del repo (`scaffold-mako-analyst`, `scaffold-mako-writer`) y Ads Analyst es el molde exacto — mismo problema (retención por cuartiles × guion × CRM), 1.100 líneas de lib + 9 rutas.

## El bloqueador que no está en ningún lado: no hay datos de retención

Esto es lo más importante para mañana. Consulté producción:

- El tracking **revivió** (199 eventos ayer, 247 el 4/8) — el fix del beacon funcionó.
- Pero **la curva de retención sigue muerta desde el 15/jul**. En 14 días llegaron solo `play` (299) y `exit` (266), y **los 266 `exit` traen `porcentaje = 0`**. Cero hitos p5..p100.
- Los hitos históricos existen y son buenos (p5=226 visitantes → p100=52), pero todos son de antes del 15/jul.

Causa probable: el snippet que generamos escucha `panda_timeupdate` ([landing-token.ts:222](dashboard-marketing/lib/landing-token.ts:222)), y ese evento nunca llega — `panda_play` sí llega, así que el listener está vivo. La migración 0017 documenta que el beacon que **sí funcionaba** escuchaba `panda_watchtime`. Como `pct` nunca se actualiza, el `exit` sale con 0.

**VSL Analyst sin curva de retención no tiene nada que analizar.** Es una tarea de una tarde, pero es la primera de todas.

## Las tareas pendientes reales

**VSL Analyst (13)**
1. Arreglar la captura de hitos: verificar el evento real de Panda y volver a emitir p5..p100 + `exit` con % verdadero
2. Backfill/monitor de que la curva vuelva a entrar (hay 3 semanas de agujero, agosto se pierde)
3. Transcripción del VSL — hoy no existe; traer el audio de Panda → `lib/transcribe.ts` → guardar transcript + secciones (patrón `ad_transcripts`, migs 0025/0026)
4. Mapear % de retención ↔ segundo ↔ sección del guion (los `beats` con `t0` de Ads Analyst)
5. Migración `vsl_analyses` + alta en `TENANT_TABLES`
6. `lib/vsl-analyst.ts` (analyze puro, sync con presupuesto, `getVslAnalystViewData`)
7. Prompts en `prompt-registry` (`vsl-analyst.analyze.system/user`) — sin esto quedan mudos y no editables
8. Alta en `model-registry` + `ia-labels` (override de modelo y desglose de gasto)
9. Rutas `/api/vsl-analyst/{sync,analyze,view}`
10. Pantalla + quitar el `comingSoon`
11. Onboarding de la tab (Conectar → Contexto → Ensayo) en `tab-activacion.ts` — es regla en toda tab
12. Cruce con CRM: quién vio 80% y cerró vs. quién agendó sin ver — **es el diferencial contra Panda**, que solo da el agregado anónimo
13. Enganchar la Retro (`TOOL_HREF.vsl`) y `mako-capacidades`

**VSL Generator (9)**
1. Catálogo de estructuras de VSL largo — hoy `guion-estructuras.ts` solo tiene 7 estructuras de anuncio corto (PAS, AIDA, BAB, 4P); un VSL de 20-40 min necesita las suyas
2. Editables desde `/admin/guiones`, como las de ads
3. `lib/vsl-writer.ts` con el compositor de brief (funnel + perfil + método + ganadores)
4. `{{jsonShape}}` del guion por bloques (contrato con la pantalla de revisión)
5. Los 4 prompts en el registry (suggest/adjust × system/user)
6. `model-registry` + `ia-labels`
7. Ruta `/api/vsl-writer` + tabla de borradores en `TENANT_TABLES`
8. Pantalla + `comingSoon` + onboarding de la tab
9. **El loop**: Analyst detecta el bloque donde se cae → Writer reescribe ESE bloque → se mide la variante. Es la tarea #51, hoy con score 3.

**Antes de cargar nada al plan (3)**: agregar "VSL Analyst" y "VSL Writer" al catálogo cerrado, y decidir qué pasa con la #204 — recomiendo declarar que las fases 2-4 (stock, gráficos, avatar) **no** entran; prometer un editor de video mañana es lo único de esta lista que no podés sostener.

---

Dos cosas para decidir vos:

- **Alcance para la reunión.** Con los datos rotos, "terminar completamente" las dos features no es de un día. Lo que sí es realista mostrar mañana: la curva de retención viva otra vez y el cruce retención × CRM. Eso ya es una demo que Panda no da.
- **Si querés, cargo las 25 tareas al plan.** Van por `plan_propuestas` (skill `plan-tareas`) y te dejo el link `/plan/revisar/<id>` para que las apruebes una por una, con el Perro puntuando después. No las inserto a mano en el tablero.

¿Arranco por el fix de la retención — que es lo que desbloquea todo lo demás — o preferís que primero cargue el plan para llegar con la lista ordenada a la reunión?


---

## Martín

`2026-08-05 20:40`

Si, carga todo al plan y comencemos a desarrollar todo, si llegamos bien, sino, no importa.

### Claude

Voy en dos frentes: cargo el plan y arranco el desarrollo. Primero lanzo la investigación técnica en paralelo mientras armo la propuesta.

### Claude

Propuesta cargada. Ahora necesito que el catálogo esté en producción antes de que la apliques, si no el Perro rutea a un proyecto equivocado.

### Claude

Mientras corre la investigación, verifico en vivo el evento de Panda —es el bloqueador número uno y quiero certeza, no la doc.

### Claude

El panel del navegador está oculto y no responde. Voy por otro camino más determinista: leer el propio player de Panda.

### Claude

Confirmado: **`panda_timeupdate` no existe en el player de Panda.** Voy a ver cómo se emite el evento real.

### Claude

**Encontré el bug exacto**, y no es el nombre del evento. Déjame confirmar el detalle final.

### Claude

Tengo la causa raíz exacta. Antes de tocar nada, reviso el estado actual del archivo (la otra sesión también lo está editando).

### Claude

La investigación llegó a la misma conclusión por otro camino. Leo el plan completo.

### Claude

Tengo el plan completo y coincide con lo que medí. Implemento el fix de captura, que es el bloqueador de todo lo demás.

### Claude

Ahora el fix central del snippet:

### Claude

Ahora el corazón del analista: la curva de retención, aislada y testeable.

### Claude

El test estaba mal, no el código: quien llegó al 90% no está vivo en el corte 100.

### Claude

La curva funciona sobre datos reales, pero encontré un sesgo: el denominador mezcla gente medida con gente sin instrumentar. Lo corrijo.

### Claude

Plan cargado y arrancado el desarrollo. Tres cosas que necesitás saber antes de seguir.

## 1. El plan está cargado

**https://hola-mako.com/plan/revisar/propvslmsgk8q7y** — 25 tareas (16 de VSL Analyst, 9 de VSL Writer) con 9 preguntas de contexto. No las inserté a mano: van como borrador y el Perro las puntúa cuando las aplicás.

Antes agregué **"VSL Analyst"** y **"VSL Writer"** al catálogo cerrado de [plan-proyectos-catalogo.ts](dashboard-marketing/lib/plan-proyectos-catalogo.ts:58): faltaban, y sin ellos el trabajo del producto caía en "Vender MaKo: Landing y VSL", que es tu marketing propio. En el resumen dejé anotadas las tres tareas viejas que se cruzan (#51, #204, #210) para que no se dupliquen.

## 2. Encontré la causa raíz exacta, y no era la que creía

No es el nombre del evento. **`panda_timeupdate` es correcto y sí llega.** Lo bajé del propio player de Panda (`main.964.bundle.js`) y el emisor es este:

```
postMessage({ message: "panda_"+e, video, currentTime, isMutedIndicator, isPreviousProgressLoaded })
```

**No trae `duration`.** Y el snippet hacía `if (!dur) return;` → salía en *todos* los eventos. Por eso cero hitos y `exit` siempre en 0%. También verifiqué que `panda_watchtime` **no existe** como postMessage (es un evento de fbq/gtag interno del iframe) — el comentario de la migración 0017 que decía lo contrario es lo que mandó a perseguir un evento fantasma. Y la duración no se puede pedir: los mensajes que el player acepta del padre son play, pause, currentTime, volume, speed, colors y fullscreen. Ninguno de lectura.

**Lo que hice:** el navegador dejó de ser la autoridad del porcentaje. Ahora manda `segundos` (el `currentTime`, que siempre está) y el servidor deriva el % con la duración que ya da la API de Panda. Es retroactivo y degrada en vez de apagarse.

Hecho y verificado:
- **Migración 0121 aplicada en producción** (columna `segundos` + 2 índices). Confirmado en la base.
- [track/vsl/route.ts](dashboard-marketing/app/api/track/vsl/route.ts) acepta `segundos`, y los tipos desconocidos ya no caen a `play` en silencio.
- [landing-token.ts](dashboard-marketing/lib/landing-token.ts:245) — snippet corregido, con escalera de hitos por tiempo como red de seguridad.
- [vsl-retencion.ts](dashboard-marketing/lib/vsl-retencion.ts) — el motor de la curva, puro y testeado. **12 tests en verde.**

Lo corrí contra tus datos reales de junio-julio y la curva sale bien: de 553 personas medidas, **44% se va antes del 5%** y **9,8% termina el VSL**. Sobre los últimos 14 días devuelve `hayDatos: false` en vez de dibujar ceros — que es la diferencia entre "no miran" y "no medimos", y es justo lo que hizo que 18 días de ceguera pasaran desapercibidos.

Encontré y corregí un sesgo mío en el camino: el denominador incluía a los 372 de 925 que dieron play sin dejar rastro medible, y eso inflaba el abandono con agujeros de instrumentación.

## 3. Dos cosas que me frenan

**Hay otra sesión de Claude trabajando en este mismo directorio**, construyendo Landing Analyst y Landing Writer sin commitear (`lib/landing-analyst.ts`, `lib/landing-writer.ts`, migración 0120, y tocó `landing-token.ts`, `model-registry.ts` y `workspace.ts`). Su `landing-writer.ts` no compila ahora mismo, y como el typecheck vive en el hook de pre-push, **bloquea cualquier push desde este clon** — incluido el mío. No toqué sus archivos. Mi código compila; el suyo es el que traba.

**Y el paso que de verdad enciende la medición es manual:** el snippet está congelado en el index.html de Lovable. Te mandé el archivo con el bloque corregido, token y dominio ya adentro, sintaxis verificada. Pegalo reemplazando el actual y la retención vuelve hoy — la parte de `pNN` funciona incluso contra el backend viejo, así que no depende del deploy.

---

Me queda pendiente saber si `panda_allData` llega en tu landing (no pude manejar el navegador, el panel quedó colgado). Por eso el snippet trae la escalera por segundos: si no llega, igual medimos.

Sigo con el analista —tabla `vsl_analyses`, el motor, la pantalla— salvo que prefieras que primero resuelva algo de esto. ¿Podés pegar el snippet en Lovable y avisarme cuando la otra sesión libere el push?

### Claude

El typecheck terminó y aísla el bloqueo con precisión.

### Claude

Sigo con la base del VSL Writer: el catálogo de estructuras de VSL largo, que hoy no existe.

### Claude

El typecheck terminó: **el único error que queda en todo el árbol es de la otra sesión**, no mío.

```
lib/landing-writer.ts(257,31): error TS2345
```

Mis archivos compilan limpios (había metido dos errores de tipo en `Payload` al agregar `segundos`; ya están corregidos). Así que el push sigue bloqueado por esa única línea de la otra sesión, que no toco.

Mientras tanto avancé con lo que no depende ni del push ni de vos: **el catálogo de estructuras de VSL largo**, que era el cimiento faltante del Generator.

[vsl-estructuras.ts](dashboard-marketing/lib/vsl-estructuras.ts) — 5 estructuras reales de 20 a 40 minutos, con guía bloque por bloque y minutaje:

| Estructura | Bloques | Para qué |
|---|---|---|
| Respuesta directa | 8 | High ticket a tráfico frío (la default) |
| Clase gratuita | 9 | Avatares escépticos o técnicos |
| Contrarian | 8 | Mercados quemados, retargeting |
| Diagnóstico | 9 | B2B y servicios |
| Historia del fundador | 8 | Marca personal, audiencia tibia |

Las siete de hoy en `guion-estructuras.ts` (PAS, AIDA, BAB, 4P…) son de anuncio de 30 a 90 segundos y no sirven para esto: un VSL necesita bloques que en un ad no existen —mecanismo único, prueba, objeciones, garantía—.

Las etiquetas son contrato doble: las lee el parser de la UI **y** el VSL Analyst, que ancla cada bloque a un tramo de la curva. Por eso el normalizador descarta lo que rompería el parser en vez de guardarlo roto, y hay tests que lo fijan: **22 en verde** entre retención y estructuras.

Quedo como antes: falta que pegues el snippet en Lovable para que vuelva la medición, y que se libere el push. Sigo con la tabla `vsl_analyses` y el motor del analista salvo que me digas otra cosa.

### Claude

El otro Claude commiteó y pusheó. Necesito verificar si mi fix del snippet sobrevivió en su commit.

### Claude

Mi fix sobrevivió intacto en su commit. Pero eso deja un desajuste peligroso que tengo que cerrar ya.

### Claude

Estado peligroso: el commit que ya está en `origin/main` incluye mi snippet (que manda `segundos` y `sNN`), pero **el receptor todavía no los acepta** — y coerciona lo desconocido a `play`, inflando los plays. Cierro el desajuste ya.

### Claude

El push lo bloquea un archivo temporal que la otra sesión acaba de crear.

### Claude

Es un script de sondeo que la otra sesión está corriendo ahora mismo (90 segundos de antigüedad). No lo toco. Dejo el push esperando a que desaparezca.

### Claude

Novedad importante y una advertencia urgente para vos.

## El otro Claude pusheó, y se llevó mi fix adentro

Su commit `1f4349d` ("Vigilante del tracking") incluye **mi snippet corregido** en `landing-token.ts` — lo verifiqué, está entero. Pero commiteó solo esa mitad: **el receptor `/api/track/vsl` se quedó afuera**.

Eso dejó el contrato partido. El snippet que hoy genera `/integraciones` manda `segundos` y hitos `sNN`, y el receptor desplegado no los conoce: coerciona lo desconocido a `play`, así que **inflaría los plays y tiraría los segundos a la basura**.

⚠️ **No pegues todavía el snippet que te mandé.** Esperá a que confirme que mi push entró. La landing en producción tiene el snippet viejo, así que ahora mismo no se está rompiendo nada — el riesgo aparece justo cuando lo pegues.

## Lo mío ya está commiteado

`9d9d0f4` — 8 archivos, 826 líneas. Migración 0121, el receptor, la curva de retención, las estructuras de VSL y el catálogo del board. **164 tests en verde**, los 22 nuevos incluidos.

Pero el push se bloqueó, y esta vez por otra cosa:

```
scripts/_tmp-r.mts(1,47): error TS5097
```

Es un script de sondeo que la otra sesión creó hace 90 segundos y está corriendo ahora mismo (prueba su extractor de landings contra multiplicatusresultados.com). No lo toqué ni lo renombré: moverlo le rompería la corrida en pleno vuelo. Tampoco usé `--no-verify` — está prohibido en el AGENTS.md y es el único chequeo de tipos que queda antes de producción.

Dejé el push esperando en segundo plano: apenas ese temporal desaparezca, sale solo. Si en 10 minutos sigue ahí, te aviso y lo resolvemos.

---

Esto ya es la segunda colisión en una hora con la otra sesión, y la primera se llevó código mío a un commit ajeno. Vale la pena que decidas: **¿cerramos esa sesión mientras terminamos el VSL, o seguimos coordinando a mano?** Coordinando funciona, pero cada archivo compartido que toque —`prompt-registry`, `model-registry`, `nav.ts`, la numeración de migraciones— es otro punto de choque, y el analista los toca casi todos.

### Claude

El push entró. Verifico que el contrato quedó completo en producción.

### Claude

El deploy todavía no salió. Dejo corriendo la verificación end-to-end: espera el deploy, manda un evento de prueba, confirma que llega a la base y lo borra.

### Claude

Verificado contra producción de punta a punta. **Ya podés pegar el snippet en Lovable.**

## El contrato quedó completo y probado en vivo

Mandé cuatro eventos sintéticos al endpoint real y revisé qué quedó en la base:

| Evento | porcentaje | segundos | Resultado |
|---|---|---|---|
| `play` | 0 | 0 | ✅ |
| `s300` | **null** | 301.4 | ✅ se guardó como `s300`, no como `play` |
| `p50` | 50 | 900 | ✅ |
| `exit` | **null** | 1002.7 | ✅ NULL, no 0 |

Los cinco chequeos en verde, incluido el ruteo al workspace correcto. Después borré las 4 filas de prueba y confirmé que no quedó basura en `vsl_events`.

Ese `null` de la segunda y la cuarta fila es el punto entero del arreglo: antes ese hueco se guardaba como cero y se leía como "abandonó al instante".

## Cómo se resolvió el bloqueo

El script temporal de la otra sesión desapareció a los ~110 segundos, el push salió solo con el typecheck en verde, y Vercel ya desplegó: `1f4349d..9d9d0f4`. No usé `--no-verify` ni toqué nada de ellos.

## Dónde estamos

**Fase 0 cerrada** — la captura de retención está arreglada, desplegada y verificada. Falta solo tu paso manual: pegar el snippet en el `index.html` de Lovable. Con eso vuelve la medición y en 24-48 horas hay curva nueva.

**Fase 1 arrancada** — `lib/vsl-retencion.ts` (la curva, validada contra tus datos reales de junio-julio) y `lib/vsl-estructuras.ts` (las 5 estructuras de VSL largo). 164 tests en verde.

**Del plan de 25 tareas**, esto cubre las dos primeras del Analyst y la primera del Writer.

Sigo con la migración 0122 (`vsl_analyses` + `vsl_drafts`) y el motor del analista. Dos cosas que siguen abiertas de mi lado y son tuyas:

1. **Pegá el snippet** — ahora sí es seguro.
2. **Decidí qué hacemos con la otra sesión.** Lo que viene toca `prompt-registry`, `model-registry`, `nav.ts` y `tab-activacion` — los archivos que ellos también están editando. Ya chocamos dos veces en una hora.

