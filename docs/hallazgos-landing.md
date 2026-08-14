# Hallazgos de Landing / VSL

Lo que hay que saber antes de tocar `/api/track/vsl`, `lib/landing-analyst.ts`, las lecturas
de `landing_visits` / `vsl_events`, y todo lo que vive bajo `app/vsl`. **No es un changelog.**

Lo que más muerde acá:

- El beacon es público y acepta cualquier `landing_url`: un desconocido elige qué páginas
  baja y analiza el server, y quién paga la llamada a Opus → [Landing Analyst](#landing-analyst).
- El semáforo pregunta «¿hubo eventos alguna vez?», así que el tracking estuvo **18 días
  muerto en verde** y nadie se enteró → [Tracking y beacon](#tracking-y-beacon).
- La retención del VSL por lead sigue sin funcionar después de meses, y es un pedido
  explícito y repetido del dueño → [Retención del VSL](#retención-del-vsl).
- Un `throw` nuevo tres niveles abajo se convirtió en un «sin datos de comportamiento»
  perfectamente creíble → [Landing Analyst](#landing-analyst).
- El matiz honesto de cada feature («en construcción») vive en un campo que ningún
  componente pinta → [El catálogo de features y sus landings](#el-catálogo-de-features-y-sus-landings).
- Un cambio en la landing principal que no se replicó en las de feature: el dueño lo tuvo
  que pedir dos veces → [El copy: cómo se escribe](#el-copy-cómo-se-escribe).

⚠️ **Parte de este documento es material de segunda mano.** Las entradas fechadas entre
junio y agosto de 2026 salen de los journals de las corridas multi-agente (261 corridas;
**134 de 260 nunca habían escrito nada en el repo**), no de una relectura del código de hoy.
Antes de actuar sobre una, verificá contra el código: varias pueden estar arregladas. El
registro completo de las corridas está en [corridas-multiagente.md](corridas-multiagente.md).
Cada entrada dice de qué corrida y de qué fecha viene.

---

## Tracking y beacon

### ⚠️ El semáforo pregunta «¿hubo alguna vez?», así que nunca se pone en rojo

**Síntoma:** el tracking estuvo muerto 18 días y el ws1 siguió en VERDE. Nadie se enteró.

**Causa:** `landingRecibioEventos` es un `select id … limit 1` **sin ventana de tiempo**: con
1955 filas históricas, la respuesta es «sí» para siempre. Y el otro extremo tampoco avisa:
`/api/track/vsl` con `ws == null` hace `console.warn` y devuelve **200 `{ok:true,
ignored:'sin workspace'}`** — el beacon del cliente ve un 200 y sigue feliz mandando al
vacío. Encima no hay ningún cron vigilante (grep de `landing_visits` / `vsl_events` sobre
`app/api/cron`: cero) y los dos avisos del catálogo que uno esperaría, `leads-caida` y
`cron-ingesta-fallo`, no tienen **un solo call-site** en el repo.

**Regla:** un chequeo de salud sin ventana temporal no es un chequeo de salud. Y un endpoint
que descarta el evento devuelve algo que el emisor pueda distinguir de un éxito.

**Vive en:** `lib/integraciones.ts:77` (`landingRecibioEventos`) · `app/api/track/vsl/route.ts:150-159`
· `lib/avisos-catalogo.ts` (`leads-caida`, `cron-ingesta-fallo`, sin cablear) · *2026-08-05 ~auditoria-mudanza-dominio*

### Las cuatro tablas de tracking ordenan bien por `id`, y no es casualidad

`landing_visits`, `vsl_events` y `landing_analyses` tienen `id` como PK, que es el orden por
defecto del helper de paginado y el único que garantiza páginas coherentes. Fueron las únicas
del barrido que **no** tenían el bug de `ORDER BY`.

**Regla:** si agregás una tabla de tracking sin `id` autoincremental, hay que elegirle un
orden único explícito. Ver [hallazgos-infra.md](hallazgos-infra.md) §1.

**Vive en:** `lib/supabase-paginado.ts` · las lecturas de `lib/landing-analyst.ts` y `lib/leads.ts`

## Retención del VSL

### ⚠️ Capturar el % de retención por lead sigue sin funcionar, y es el pedido más repetido

**Síntoma:** después de meses, el dato no está. Palabras del dueño: *«dimos muchas vueltas
con esto, quiero que funcione»* (2026-08-06). No es una mejora: es un pendiente vivo con
historia.

**Pista registrada:** el índice de memoria del proyecto atribuye la muerte de la curva del VSL
a que **`panda_timeupdate` no trae `duration`**, así que el porcentaje no se puede calcular en
el cliente. Verificá eso primero antes de rediseñar nada.

**Regla:** esto no se declara hecho hasta verlo en la app con datos reales. *«no veo que se
haya marcado el progreso en la app. Eso no lo hiciste… revisa porque el fallo está de tu
lado»* — si el dueño dice que falla, el fallo es nuestro hasta que se pruebe lo contrario.

**Vive en:** `app/api/track/vsl/route.ts` · `lib/leads.ts` (`getVslEngagement`, `getVslEngagementMap`)

### ⚠️ `video_id` se guarda desde la mig 0061 y no lo lee nadie: el segundo VSL va a contaminar todo

**Síntoma:** hoy no se nota porque en producción hay un solo VSL. El día que se suba el
segundo, plays, `max_pct` y los cortes de retención pasan a mezclar dos videos sin que nada
avise.

**Causa:** la mig 0061 agregó `video_id` y `vsl_titulo` a `vsl_events` justamente para poder
comparar VSLs, y el beacon los recibe. Pero los tres consumidores —`getVslEngagement`,
`getVslEngagementMap` y `getComportamiento` del Landing Analyst— **no filtran ni agrupan por
video**: mezclan todo en un solo número. Ojo: en el camino del insert también se reportó lo
inverso —`video_id` llegando en el payload y quedando fuera del insert— así que verificá los
dos extremos antes de dar por sentado que el dato está completo. Como `PANDA_VSL_VIDEO_IDS`
es una lista (multi-VSL / A-B de VSL), sin esto no hay forma de atribuir la retención por
persona a una versión del video. Es una migración de una columna y una línea en el insert,
más el `group by` en los consumidores.

**Falta además el índice:** `vsl_events` solo tiene índices por `visitor_id` (duplicado) y
`workspace_id`, así que toda consulta por ventana temporal o por video es un seq scan.

**Vive en:** `supabase/migrations/0061_tracking_granular.sql:12-13` · `app/api/track/vsl/route.ts:105`
(payload), `:152-186` (insert) · `lib/leads.ts:1143-1146,1178-1181` · `lib/landing-analyst.ts:156`
· *2026-07-02 audit-automatizaciones-lead · 2026-08-05 ~alta-tab-vsl-analyst*

### ⚠️ El evento de abandono se guarda con el porcentaje exacto y ningún query lo consume

El evento `tipo_evento='exit'` **sí** se persiste con el porcentaje exacto de abandono. El
dato que le diría al closer «abandonó al 62%, antes de la oferta» está en la base **desde el
día uno** y no lo lee nadie.

**Regla:** antes de agregar tracking nuevo, grepeá si el que ya existe tiene consumidor. Acá
había dos columnas y un tipo de evento guardándose para nadie.

**Vive en:** `app/api/track/vsl/route.ts:152-186`

### ⚠️ El snippet medía UN video por página, y el segundo salía mal — no «mezclado»

*2026-08-14*

La pregunta que abrió esto era de producto: «una landing puede tener muchos videos, ¿cómo
sabemos cuál es el VSL?». **El diagnóstico obvio era el equivocado**: no era un problema de
etiquetado sobre datos correctos. Todo el estado del player vivía en variables de la PÁGINA,
no del video:

```js
var yaPlay = false, hitos = {}, seg = {}, pct = 0, dur = 0, segs = 0, vid = null, tit = null;
```

Con dos videos, eso no promedia dos mediciones. Rompe la segunda, de cuatro formas que se
tapan entre sí:

| Variable | Qué pasa con dos videos |
|---|---|
| `yaPlay` | Solo el **primer** video manda un `play`. El segundo no existe para el sistema aunque lo miren entero. |
| `hitos` | El `p25` del segundo se suprime porque el primero ya lo mandó. |
| `dur` | La pisa el último que reporte duración → el % de un video se calcula con la duración de **otro**. |
| `exit` | Uno solo: de dos videos mirados queda el punto de abandono del último que habló. |

Un VSL de 20 min conviviendo con un testimonio de 40 s medía el testimonio como si durara
veinte minutos. Y como `vid` viajaba en cada evento, la base guardaba un `video_id` que hacía
ver el dato como atribuido: **la columna correcta al lado del número equivocado.**

**Por qué sobrevivió tanto:** el síntoma es «la retención da raro», que no apunta a ningún
archivo. Nada falla, nada queda vacío, ningún chequeo se pone en rojo. Y el caso solo aparece
en landings con más de un video, que no es lo que uno prueba.

**Regla:** cuando un script de terceros emite eventos de varias instancias al mismo listener,
el estado va **indexado por emisor** desde el primer día, aunque hoy haya una sola instancia.
Un estado global es correcto exactamente mientras N=1, y el día que pasa a 2 no falla: miente.
El emisor se resuelve por el id que manda el propio evento, con respaldo en el iframe que
originó el `postMessage` (`ev.source`) — sin ese respaldo, dos players que no se identifiquen
vuelven a compartir un estado.

**Y el corolario del test:** afirmá la ESTRUCTURA, no un caso. `tests/landing-optin.test.ts`
verifica que nada mutable del player viva fuera del estado por video. Un contraejemplo pedía
una landing real con dos players, y para cuando se arma, el dato ya salió mal.

**Vive en:** `lib/landing-token.ts` (`est()`, `quien()`, `alSalir()`, `SNIPPET_VERSION = 5`)

### El código pegado en la landing del cliente no se actualiza solo — ni el aviso alcanza

Corolario operativo del anterior: arreglar el snippet **no arregla a nadie**. El código queda
congelado en el HTML del cliente y los eventos del código viejo siguen llegando, así que la
integración se ve en verde. Por eso existe `SNIPPET_VERSION`, que viaja como `sv` en cada
evento, lo persiste el beacon en `landing.snippet_version` y lo compara el cron
`tracking-vigilante`.

**Lo que faltaba, y el test ahora lo exige:** cada versión nueva tiene que traer su renglón en
`NOVEDADES`. Sin eso, el aviso de WhatsApp sale con el fallback «mejoras de medición» — y el
mecanismo entero existe para que el cliente sepa **qué gana** al volver a pegar el código. Un
«actualizá» a secas es una tarea sin motivo, y menos todavía cuando lo que tiene puesto parece
andar.

**Vive en:** `lib/landing-token.ts` (`NOVEDADES`, `novedadesDesde`) ·
`app/api/cron/tracking-vigilante/route.ts`

### ⚠️ Los botones de editar y borrar se gateaban en «está guardada», y nadie tenía guardadas

*2026-08-14*

El desplegable de páginas ofrece dos clases: las **guardadas** (las escribió la persona) y las
**detectadas** (salieron de los eventos). El lápiz y la basura se mostraban solo sobre una
guardada, con un argumento correcto — ofrecer «borrar» sobre una detectada es prometer algo
que no se cumple, porque la próxima visita la vuelve a traer.

El argumento era correcto y la conclusión no. Quien nunca guardó una a mano ve **todas** sus
páginas como detectadas, así que no veía un solo botón y la función entera era invisible. Que
es el caso normal, no el raro.

**Regla:** cuando una condición esconde una acción, contá cuántos usuarios reales caen del lado
que la esconde. Si la mayoría cae ahí, la condición no está protegiendo un caso raro: está
apagando la función. La salida no es sacar el guard sino **pagar lo que el guard estaba
señalando** — acá, una lista de escondidas (`landing.paginas_ocultas`) para que borrar cumpla
también sobre una detectada.

**Y el bug de comparación que lo habría roto igual:** el gate era `paginas.includes(url)`,
string crudo contra lista **normalizada**. Al guardar `tu-pagina.com` la lista pasa a tener
`https://tu-pagina.com`, el `includes` da false y los botones desaparecían justo después de
guardar. Toda comparación de URLs pasa por `mismaPagina()`. En el mismo archivo había un
`includes` de **substring** buscando la recién guardada: daba por iguales una página y otra que
la contiene como prefijo, que es exactamente la forma de los previews de Netlify
(`6a7f2b--que-es-lidermente.netlify.app` contiene a `que-es-lidermente.netlify.app`).

**Vive en:** `lib/landing-paginas.ts` (`mismaPagina`, `conOculta`) ·
`app/integraciones/ProbarTracking.tsx` (`hayElegida`) · `app/integraciones/landing-actions.ts`

### ⚠️ «La única duración conocida» se le aplicaba a CUALQUIER video

*2026-08-14*

Encontrado mapeando el CRM para otra cosa. `durDe` en `lib/leads.ts` resolvía la duración de
un video así:

```ts
if (v && durs.has(v)) return durs.get(v)!;
return durs.size === 1 ? [...durs.values()][0] : null;   // ⛔
```

El respaldo existe por una razón real: el `video_id` de `vsl_events` no siempre coincide con
el que reporta el cron de Panda, y sin él la ficha mostraba «—» para todos. Con **un** video
es correcto. Con dos es un porcentaje **inventado**: al testimonio de 40 s se le aplica la
duración del VSL de 20 minutos y su avance da ~0% para siempre.

Y no falla — contesta mal, que es el modo caro: se ve exactamente igual que un porcentaje
correcto, nadie lo revisa y ninguna pantalla lo dice.

**Regla:** un respaldo que asume «hay uno solo» tiene que **chequear** que haya uno solo. Si
no se sabe de qué video es la duración, va `null` y la pantalla muestra «—», que es la verdad.
`resolverDuracion(videosEnJuego, durs)` cuenta los `video_id` distintos antes de asumir nada.
En el camino del lote (`getVslEngagementMap`) se cuentan sobre el **lote entero**, no sobre las
filas de cada visitor: si un visitor miró uno solo pero el negocio tiene dos, el respaldo
sigue siendo una invención.

**Y el corolario de los eventos huérfanos:** los que no se pueden atribuir a ningún video
(datos anteriores a la v5, o el `exit` de un player anónimo) no se tiran **ni** se le suman a
un video concreto. Van a su propio balde, «Video sin identificar». Descartarlos perdería
mediciones reales; fundirlos contamina una curva sin que se note.

**Vive en:** `lib/leads.ts` (`resolverDuracion`, `videosDe`, `getVslEngagement`,
`getVslEngagementMap`) · `app/crm/lead-view/ComportamientoCard.tsx`

### El número correcto mal ATRIBUIDO es peor que ningún número

La ficha del lead pintaba «Retención del VSL: 80%», y ese 80 era el máximo sobre **todos** los
videos de la página. Con un testimonio de 40 s al lado del VSL, el 80% del testimonio se leía
como que la persona casi terminó la oferta — y es la lectura sobre la que un closer decide
cómo encarar la llamada.

El cálculo nunca estuvo mal. Lo que estaba mal era el **rótulo**, y por eso no había forma de
detectarlo mirando el número.

**Regla de pantalla:** un rótulo en singular («el VSL», «la campaña», «el pago») es una
afirmación de que hay uno solo. Si el modelo de datos permite varios, o el rótulo se hace
plural o la pantalla desglosa — pero el número agregado bajo el nombre de uno de los
componentes es siempre una mentira que se ve creíble.

Cómo quedó, siguiendo las reglas de la casa: con **varios** videos el minicard único no se
pinta y abajo va una lista con filete, un renglón por video, con la barra de avance como
**borde** de la fila (2 px, ancho completo) y el número al lado del color. Con **uno solo** la
pantalla es exactamente la de antes — partir en una lista de un renglón le agrega ruido al 95%
de los casos para resolver el 5%.

**Vive en:** `app/crm/lead-view/ComportamientoCard.tsx` (`FilaVideo`, `varios`)

### Una pregunta, no dos: el nombre del video ES la respuesta a «cuál es el VSL»

El primer diseño tenía un desplegable para el nombre y aparte un control «marcar como VSL».
Dos controles para una decisión, y el segundo se queda sin contestar porque no se entiende qué
agrega — con lo cual `esVsl` queda vacío y todo lo que depende de él no funciona.

Quedó uno solo: los tipos de fábrica (`TIPOS_VIDEO`), los nombres que ya usó ese negocio, y
«Otro tipo de video…» de última opción. Elegir «VSL» marca. Es una heurística sobre texto que
escribe una persona (`esTipoVsl`, palabra suelta), y por eso la fila muestra el distintivo
**VSL al instante**: la consecuencia se ve antes de guardar, que es lo único que vuelve
corregible una heurística.

**Y el bug que encontró el test, no la pantalla:** `conVideo` reconstruía el objeto con solo
`{id, nombre}`, así que **renombrar el VSL lo degradaba en silencio** — la pantalla de
renombrar no manda ese flag porque no está preguntando eso. Ahora `esVsl` tiene **tres**
valores: `true` marca, `false` desmarca y **`undefined` significa «no lo toques»**. Es «cada
pregunta, su campo»: contestar «cómo se llama» no puede contestar «cuál es el VSL» por
omisión.

**Vive en:** `lib/landing-videos.ts` (`conVideo`, `esTipoVsl`, `TIPOS_VIDEO`, `rotuloDe`) ·
`app/integraciones/NombrarVideos.tsx`

### Un test que lee el fuente hace match con el comentario que explica la regla

Cuarta vez en este repo, y esta vez con un agravante nuevo. La aserción era
`!/<select/i.test(fuente)` y falló sobre código que cumple la regla, por dos motivos a la vez:

1. El comentario de al lado dice, textual, «el `<select>` nativo está prohibido».
2. **El flag `/i` prohibía el `<Select>` de la casa que la aserción venía a exigir.** En JSX la
   mayúscula ES la diferencia entre el elemento del DOM y el componente de React.

**Regla:** un test que lee fuente saca los comentarios primero, y **nunca** usa `/i` para
buscar JSX. Lo que se busca es lo que se ejecuta, no lo que está escrito al lado.

**Vive en:** `tests/landing-videos.test.ts` (`sinComentarios`)

### ⚠️ Siete renglones de la misma landing: los previews de deploy de Netlify

*2026-08-14*

Reportado como **«pareciera que se están auto-guardando un montón de URLs iguales con números
enfrente, no entiendo eso»** — y el diagnóstico obvio (el guardado) era el equivocado dos veces:
no se estaba guardando ninguna (todas decían «detectada») y las URLs no eran iguales.

Netlify le da a **cada deploy** una URL inmutable con el id del deploy adelante:

```
6a7f350eb436ad1a599d0dcb--que-es-lidermente.netlify.app
6a7f2bbe8653f3b1e806517f--que-es-lidermente.netlify.app
6a7e28766cf06853a0246d16--que-es-lidermente.netlify.app
```

El snippet mide en todas. Publicando varias veces por día eso llena el desplegable con la misma
página — y, mucho peor que el ruido visual, **reparte la medición entre todas**: la retención de
esa landing quedaba dividida en siete pedazos sin que nada lo dijera.

La causa estaba en `landingDiagnostico`, que deduplicaba sobre el texto **crudo** de
`landing_url`. Ahora normaliza antes, y `normalizarUrl` colapsa esos hosts.

**El colapso es deliberadamente angosto:** solo cuando el prefijo es inconfundiblemente un id de
deploy — 20+ caracteres hexadecimales (los de Netlify tienen 24). Los deploys **por rama**
(`staging--sitio`, `preview--sitio`) quedan intactos: son entornos distintos y fundirlos
mezclaría producción con pruebas. Vercel arma sus previews con guiones simples y sin separador
propio, así que ahí un preview no se distingue de un proyecto que se llama así — y adivinar
sería peor que dejarlos separados.

**Regla:** una lista de «lo que observamos» se deduplica por la **identidad canónica**, nunca
por el string. Cualquier hosting moderno emite una URL por deploy, así que un `new Set` sobre
texto crudo va a mostrar N copias de todo lo que se publique seguido.

**Vive en:** `lib/landing-token.ts` (`landingDiagnostico`, el `urls`) · `lib/landing-paginas.ts`
(`hostCanonico`)

### Una colección que se ELIGE también hay que MANTENERLA

Los botones de corregir y quitar vivían afuera del desplegable y actuaban sobre la página
seleccionada. Con siete renglones de la misma landing, sacar el que sobra obligaba a
**seleccionarlo primero** — o sea, a elegir justo lo que se quiere que desaparezca.

Ahora cada renglón trae los suyos (`DropdownAccion` en `app/components/Dropdown.tsx`), y los de
afuera se quedan porque sirven sin abrir el menú. Dos cosas que no son opcionales al hacerlo:

- **Con acciones, el renglón deja de ser un `<button>`.** Un `<button>` adentro de otro es
  marcado inválido *y* el click del de afuera se dispara igual: «borrar» además seleccionaría
  lo que se acaba de borrar. Van como hermanos en una fila.
- **`stopPropagation` + `preventDefault`.** El menú se cierra por un listener de click en el
  documento; sin frenarlo, la acción corre, el panel desaparece y se lee como que no pasó nada.
- Y sin acciones el renglón sigue siendo **exactamente** el de antes: lo usan decenas de
  pantallas y no tienen por qué cambiar de marcado por una variante nueva.

**Vive en:** `app/components/Dropdown.tsx` (`renderOption`, `DropdownAccion`) ·
`app/integraciones/ProbarTracking.tsx` (`accionesDe`)

### ⚠️⚠️ Ocho leads reales entraron bien y nadie los vio nunca

*2026-08-14 · forense de 8 agentes + consulta a producción*

**El diagnóstico obvio era el equivocado, y por partida doble.** Reportado como «envié el
formulario y no se registró, eso es gravísimo» y «me marca con un check que todo está bien,
eso está muy mal». Consultada la base de producción **antes** de tocar nada:

```
propkektebfllgc2 | landing:3764673479 | «Prueba MaKo»    | 17:16:32 | pendiente
propx8gq58em17vu | landing:9984920076 | «Magdiel Cortes» | 15:36:50 | pendiente
propxnjgz6dj5mhk | landing:998136...  | «Marina Olvera»  | 15:12:15 | pendiente
… OCHO propuestas de lead en `pendiente` en el ws11, cuatro de gente REAL.
```

El opt-in funcionaba. La captura funcionaba. **El check verde decía la verdad.** Lo que no
existía era ningún camino desde un opt-in hasta un humano, y eran **tres huecos encadenados**:

1. **`propuestasPendientes()` tenía CERO call-sites.** Vivía en `lib/propuestas.ts` desde el
   día uno. No había bandeja: la única pantalla era `/crm/revisar/<id>`, que exige el id.
2. **Ese id solo se devolvía en la respuesta HTTP al navegador del visitante anónimo**, y el
   snippet la tira (`.catch(function(){})`, sin `.then`). Los otros canales que escriben en la
   misma tabla **sí** devuelven el link para pasárselo a la persona; la landing es el único que
   no puede — quien completa el formulario ve la página de gracias del cliente.
3. **El feed de eventos del panel se arma solo con `vsl_events` y `landing_visits`**, así que un
   opt-in perfecto no produce ni un renglón ahí. «No se registró nada» estaba garantizado.

**La regla, y es general:** si un canal deja algo para revisar y **no puede devolver el link
por donde entró**, el link sale por un aviso — y además tiene que existir una **lista**. Un
aviso es un EVENTO; una bandeja es un ESTADO. Lo que se pierde siempre es lo que solo era un
evento: un aviso que no se manda, no llega, o se lee y se olvida no deja nada atrás.

**El corolario del chequeo verde, que es lo más sutil de todo esto:** el check decía «llegó al
menos un formulario ✓» y era **cierto**. Mentía por **omisión** — le faltaba el segundo verbo.
Llegó ¿y **entró**? Una propuesta sin confirmar no es un lead: es una persona que dejó su
teléfono y a la que nadie escribió. Un indicador que afirma la mitad verdadera de un proceso
de dos pasos es más peligroso que uno roto, porque nadie lo va a auditar.

**Y el error que casi repito arreglándolo:** la primera versión del fix hacía que el chequeo
linkeara a la propuesta **más reciente**. A las otras siete no se llegaba por ningún lado — o
sea, el arreglo reproducía el problema que venía a cerrar, en chiquito.

**Vive en:** `app/crm/revisar/page.tsx` (la bandeja, nueva) · `app/api/track/optin/route.ts`
(el aviso) · `lib/avisos-catalogo.ts` (`lead-de-landing`) · `lib/landing-token.ts` (el chequeo)

### La llave de idempotencia era el teléfono tal como se tipeó

`ref = landing:${telefono}` usaba el valor **crudo** del input. «998 136 1529» y «9981361529»
son dos llaves distintas, así que la misma persona creaba dos propuestas — justo lo que la
idempotencia venía a evitar. Ahora la llave son los dígitos, últimos 10: el mismo número con y
sin código de país es el mismo número.

**Pendiente, del mismo forense:** `crearPropuesta` matchea la `ref` **sin mirar el estado**, así
que una propuesta ya **descartada** bloquea a esa persona para siempre. Si alguien descarta por
error, ese contacto no puede volver a entrar nunca por la landing.

**Vive en:** `app/api/track/optin/route.ts` (`clave`) · el pendiente en `lib/propuestas.ts`
(`crearPropuesta`)

### Los clicks no se medían, y para esta landing el click ES el embudo

El snippet emitía `pageview`, `play`, `pNN`, `sNN` y `exit`. Nunca un click. En una landing
cuyo CTA es un ancla (`#registro`) y cuyo cierre es un link de WhatsApp, eso deja **cero puntos
intermedios** entre «visitó» y «dejó sus datos»: una página que convierte mal no se distingue
de una que nadie mira.

Resuelto en la v6 del snippet (mig 0133, columna `detalle`). Decisiones que conviene no
revertir:

- **Columna propia, no reusar `vsl_titulo`.** «Cómo se llama el video» y «qué se clickeó» son
  dos preguntas; meterlas en un campo pierde una de las dos.
- **Sin `default` en la columna.** Un evento que no es click no tiene detalle, y NULL dice eso.
  Un default inventaría un dato — el mismo error que dejó las filas `tipo_evento = 'desconocido'`.
- **Nunca `preventDefault`.** Lo que la persona quería hacer tiene que pasar igual aunque el
  envío falle.
- **Tope de 40 por carga**, o un carrusel manda cientos y el ruido tapa lo que importa.
- **El destino manda sobre el texto**: dos botones distintos pueden ir al mismo lado, y lo que
  se cuenta es adónde va la gente.
- Y hubo que **sumar `'click'` a la lista blanca del beacon**: sin eso cada click habría entrado
  como `'desconocido'`.

**Vive en:** `lib/landing-token.ts` (el listener) · `app/api/track/vsl/route.ts` ·
`supabase/migrations/0133_vsl_events_detalle.sql`

### El probador mostraba las últimas 24 h, no tu prueba

*2026-08-14*

Reportado como **«al darle probar te trae TODOS los eventos pasados… lo supe porque vi
diferentes horarios»**. La ventana era de 24 h, así que aparecían visitas de la mañana entre
las de recién y no había forma de saber cuáles eran propias.

Resuelto con el mismo mecanismo que el `test_event_code` de Meta: «Probar» genera un id, abre
la landing con `?mko_test=<id>`, el snippet lo guarda en `sessionStorage` de esa pestaña y lo
devuelve en cada evento; el panel filtra por ese id.

**⚠️ Filtrar por HORA no alcanzaba, y es la parte que importa.** Arrancar la ventana cuando
empieza la prueba deja afuera los eventos viejos pero **no** los de otra gente visitando la
página en ese momento — y esta landing tiene tráfico real, entran leads cada pocos minutos. Un
probador que te muestra la visita de un desconocido como si fuera tuya es **peor** que uno que
muestra de más: te hace creer que tu código anda cuando lo que anda es el de la visita ajena.

Tres decisiones que conviene no revertir:

- **`sessionStorage`, no cookie.** El marcador tiene que sobrevivir a navegar dentro de la
  pestaña (un CTA que va a otra página) y morir al cerrarla. En una cookie contaminaría el
  tráfico real durante un año, marcando como «prueba» visitas que no lo son.
- **El hash va SIEMPRE al final al armar la URL.** `pagina.com/#registro?mko_test=x` deja el
  parámetro **adentro del hash** y `location.search` no lo ve nunca — y esa landing se prueba
  justamente con `#registro`.
- **El marcador viaja en cada consulta, incluida la del intervalo.** Pasar `traer` directo a
  `setInterval` le entrega el contador del timer como primer argumento: la lista arrancaba
  limpia y a los 3 segundos volvían las 24 h.

**Vive en:** `app/integraciones/ProbarTracking.tsx` · `lib/landing-token.ts`
(`landingDiagnostico(prueba?)`, el bloque `mko_test` del snippet) ·
`supabase/migrations/0134_marcador_de_prueba.sql`

### Un opt-in no podía aparecer en el feed del probador, nunca

El feed se armaba con `vsl_events` y `landing_visits` y nada más. Un opt-in vive en
`propuestas` —porque no es un evento: es algo para revisar— así que un formulario que entraba
**perfecto** no producía un solo renglón. Y la instrucción de la pantalla decía, textual,
«completá tu propio formulario, los eventos aparecen acá».

**Regla:** cuando una pantalla instruye «hacé X y vas a ver Y», hay que verificar que el
camino de datos de Y **exista**. Una promesa que la pantalla no puede cumplir no se lee como
un bug de la pantalla: se lee como que lo que hiciste falló.

**Vive en:** `lib/landing-token.ts` (la tercera query de `landingDiagnostico`)

### Descartar una propuesta encadenaba a esa persona para siempre

`crearPropuesta` hacía `select('id, estado')` y **no miraba el estado**: cualquier fila con esa
`ref` bloqueaba, incluida una `descartada`. Descartar no significa «esta persona no existe»:
significa «esto no era un lead» o «me equivoqué». Si mañana vuelve a completar el formulario,
eso es intención nueva y tiene que poder revisarse — con el código viejo no volvía a entrar
nunca más, en silencio.

Las otras dos **sí** bloquean, y por razones distintas: `pendiente` ya está esperando (volver a
proponerla duplica la fila) y `aplicada` significa que el lead **ya** está en el CRM
(re-proponerlo lo duplicaría). La `ref` de la que vuelve a entrar lleva el día, para no chocar
con la vieja sin perder la idempotencia del doble submit.

**Regla general:** un `select` que trae un campo y no lo usa es una decisión que alguien pensó
y no terminó de escribir. Cuando veas uno, la pregunta no es «sobra este campo» sino «qué
tendría que estar decidiendo con él».

**Vive en:** `lib/propuestas.ts` (`crearPropuesta`)

### Lo que NO era un bug (verificado en la base, no deducido)

- **Los «Visitó la landing» repetidos son visitas reales.** `landing_visits` no tiene columna de
  tipo: cada fila **es** una visita. Los `visitor_id` son distintos salvo `6d860227`, que
  recargó cinco veces. Ojo con dos filas cuyo `landing_url` es
  `file:///C:/Users/leilu/…`: la clienta abre el HTML local y eso también mide.
- **Los timestamps no están corridos.** El panel pinta con la zona del navegador (UTC-3) y la
  clienta está en UTC-5, así que los cinco pageviews que se ven a las 12:19–12:29 son las filas
  de las 15:19–15:29 UTC. La lista está bien ordenada; lo que falta es que la hora use la zona
  del workspace, como el resto de la app (`useTzWorkspace`).

### Lo que sigue pendiente sobre videos

- **`curvaRetencion`, `avancePorPersona` e `histogramaAbandono` aceptan un `videoId` desde hace
  meses y nadie se lo pasa.** La capacidad de filtrar por video está implementada y sin usar; lo
  que hoy se muestra en la ficha es el máximo por video, no la curva. Y ojo con la condición de
  `lib/vsl-retencion.ts:115` y `:212`: `if (videoId && ev.video_id && ev.video_id !== videoId)`
  exige que `ev.video_id` sea truthy, así que **un evento sin `video_id` no se descarta nunca y
  entra en la curva de CUALQUIER video**. Es el mismo error que `durDe`, en otro archivo.
- **`TrackingTimelineCard` deduplica rachas de retención sin mirar `video_id`**
  (`app/crm/lead-view/TrackingTimelineCard.tsx:46-52`), así que mezcla rachas de videos
  distintos en una sola.
- El `video_id` no siempre es un id de Panda: cuando el player no se identifica, el snippet cae
  a `iframe0`/`iframe1` **por posición** — que cambia si se reordena la página.

**Vive en:** `lib/vsl-retencion.ts` · `app/crm/lead-view/TrackingTimelineCard.tsx` ·
`lib/landing-token.ts` (`quien`)

## Landing Analyst

### ⚠️ Un tercero elige qué páginas baja y analiza el Analyst, con solo mirar el HTML de la landing

**Síntoma:** ninguno visible. Eso es lo peor.

**Causa:** `landing_visits.landing_url` se escribe desde `/api/track/vsl`, que es **público**
(CORS `*`, sin sesión) y se autentica con el token `mko_…` que viaja a la vista en el snippet
de la landing del cliente. El único saneo es `texto(payload.landing_url, 500)`: texto
arbitrario, sin parsear como URL ni comparar contra ningún dominio del workspace.
`urlsDescubiertas()` lo lee crudo, lo ordena por cantidad de visitas y lo convierte en (a) la
cola del botón «Buscar mis páginas» y (b) los chips «sin analizar» que se ofrecen a un clic en
cada render de la tab. Resultado: alguien **sin credenciales** controla el destino de un fetch
server-side con la IP de egreso de la app, quema una llamada Opus con thinking por URL, y deja
el resultado persistido en el workspace ajeno. La baranda SSRF de `landing-fetch.ts` solo
bloquea IPs privadas: un host público del atacante pasa entero.

**Regla:** que el token sea público por diseño (`docs/lovable-tracking.md`) no significa que lo
que escribe sea confiable. Todo lo que entra por el beacon es entrada de un desconocido, y no
puede decidir sola qué baja el server ni qué se paga en IA.

**Fix natural:** parsear `landing_url` en el beacon y exigir que el host coincida con un
dominio ya declarado del workspace.

**Vive en:** `app/api/track/vsl/route.ts:203` · `lib/landing-analyst.ts:227-238` (`urlsDescubiertas`),
`:745` y `:790` · `lib/landing-token.ts` (`landingSnippet`) · *2026-08-05 review-landing-tabs*

### El módulo tolera la falta de datos, así que traga cualquier error nuevo

**Síntoma:** el análisis de una landing **con tráfico real** decía «sin datos de
comportamiento». No hay error en el log: es una respuesta válida del producto.

**Causa:** `getComportamiento` hace `catch { return vacio; }` **a propósito** —una landing
recién publicada no tiene historial y igual se puede analizar el copy—. Cuando el bucle
paginado privado de este módulo (que no tenía techo) se unificó en `lib/supabase-paginado.ts`,
heredó un tope que **sí** lanza. `landing_visits` es una fila por visita: 100.000 es alcanzable
en una landing viva. El `throw` cayó en ese `catch` y el truncado silencioso que el paginado
existe para matar reapareció **una capa más arriba**.

**El diagnóstico obvio era el equivocado:** no había nada roto en el analista ni en el
tracking. Lo que cambió fue el contrato de errores de una función tres niveles abajo.

**Regla:** antes de meter un `throw` nuevo en una lectura, mirá **qué `catch` lo está
esperando**. En un módulo que degrada por diseño, cada excepción nueva se convierte en un «no
hay nada» que nadie va a poder distinguir de la verdad.

**Descartado a propósito — no volver a «arreglarlo»:** cambiar ese `catch` por propagar el
error. La tolerancia es intencional y está escrita en el JSDoc: el analista tiene que poder
correr sobre una landing sin historial. Con el tope del helper ya corregido, el falso vacío
deja de ser alcanzable en la práctica. Cambiar la semántica de error de este módulo es otra
pasada, con una decisión de producto de por medio: **¿qué ve el usuario si el tracking falla y
el copy sí se puede analizar?**

**Vive en:** `lib/landing-analyst.ts:128` (`leerTabla`) y el `catch` de `getComportamiento` ·
el tope vive en `lib/supabase-paginado.ts`, ver [hallazgos-infra.md](hallazgos-infra.md) §1
(«Un tope nuevo es un truncado nuevo»)

## El catálogo de features y sus landings

### ⚠️ El matiz honesto de cada feature vive en un campo que nadie renderiza

**Síntoma:** la página del CRM se lee como automatización 100% autónoma y desatendida.

**Causa:** las páginas de detalle de `/vsl` declaran los campos `nota` (estado honesto: «en
activación / en construcción») y `quote` por feature, pero **ningún componente los pinta**.
Verificado el 2026-08-07: 19 features llevan `nota` y el grep de `.nota` / `.quote` sobre los
`.tsx` de `/vsl` no devuelve un solo render. Caso concreto: los bullets visibles del CRM
prometen automatización total, y la única aclaración —«la automatización 100% desatendida se
enciende por cuenta, con vos mirando el primer tramo»— está en `nota`, o sea, invisible.

**Regla:** si una salvedad es parte de la promesa, va en un campo que la página renderice. Un
campo del tipo que no se pinta es una salvedad que no existe.

**Vive en:** `app/vsl/_detalle/features.ts` (campos `nota` y `quote`) · los `.tsx` de
`app/vsl/_detalle` · *2026-07-24 auditar-copy-crm*

### ⚠️ Un video publicado congela el nombre de la feature y el destino de su «ver más»

**Síntoma:** dos `verMas` mandan material ya publicado a la ruta equivocada.

**Causa:** al consolidar el catálogo salió una restricción que no es de código pero gobierna el
código: **lo que ya se dijo en voz alta en un video producido no se puede renombrar** (por eso
«Closing Analyst» queda fijo: los videos de crm y semáforo la nombran así), y los `verMas` de
esos videos apuntan a rutas cuyo significado va a cambiar. Concreto y sin hacer:
`features.ts:981` (semáforo, «MaKo por WhatsApp») y `features.ts:462` (crm, «Descubrí cómo MaKo
trabaja tu WhatsApp») caen hoy en `/vsl/whatsapp`, que pasa a ser la bandeja de ventas —
deberían ir a `/vsl/asistente`. Se arregla sin retocar un solo video.

**Vive en:** `app/vsl/features.ts` (líneas 462 y 981) + `app/vsl/content.ts` ·
*2026-07-26 ~consolidar-catalogo-features-landing*

### Card o bloque: si cambia la PROMESA es card; si solo la hace creíble, es bloque

El dilema «recortamos las features de `/vsl` o las mantenemos» es falso: catálogo, landing y
video están pegados 1:1:1 sin motivo. Una landing nueva cuesta **1-2 horas** porque la
infraestructura ya existe (`features.ts` + `feature-visuals.ts` + `Visual.tsx`), un mini-VSL
cuesta **6-10** — recortar el catálogo para ahorrar video es cortar habitaciones de la casa
porque el trailer sale caro.

**Regla permanente, para que la discusión no vuelva cada mes:** una capacidad merece card solo
si pasa los tres filtros (el dueño pagaría por eso solo · alguien lo googlearía sin conocer la
app · se cuenta con UN concepto en 90 segundos). Lo que responde una **objeción** va como
bloque dentro de otra landing. Lo que responde un **miedo** o un **requisito** (BYOK, roles de
equipo) sale de la grilla: eso se compra después, no antes. Se funde lo que es el mismo momento
de compra contado dos veces. Y la sensación de «disperso» se cura con jerarquía (secciones con
encabezado de resultado), **no amputando features que la app sí tiene**.

**Vive en:** `app/vsl/_detalle/features.ts` + `showcase.ts` + `Landing.tsx` ·
*2026-07-26 ~catalogo-de-features-de-la-landing*

### Decisiones de arquitectura de la landing (ya tomadas)

- **La landing de venta vive en una ruta propia, sin botón en ningún lado de la app:** VSL
  arriba, funcionalidades abajo, y después una ruta de detalle por cada funcionalidad.
  Referencia `vturb.com` —diseño y estilo de copy— pero sin copiarla: *«confia en tus
  instintos y en como ya esta el diseño de la app»* (2026-06-24 / 2026-06-29). Donde falte
  funcionalidad van placeholders.
- **Cada feature tiene su propia landing con contenido específico**, no un pop-up ni una
  plantilla repetida; el «ver detalles» lleva directo ahí. El porqué: *«cada pop-up se queda
  corto»* y las landings *«parecen una plantilla, todos tienen las mismas secciones, el mismo
  texto»* (2026-07-19).
- **La landing lista también lo que MaKo TODAVÍA no hace**, y eso se implementa antes de que
  salga. No se recorta el copy por prudencia: *«No pongas el filtro de no Humo, estamos
  haciendo MKT. Luego lo llevamos a la app si no está aún… Solo quiero tener el norte claro»*
  (2026-06-25).
- **Customer Success se saca** de la landing principal y de las landings de feature. Es una
  feature a futuro, y sacándola las cards quedan perfectas en la grilla, sin una suelta abajo
  (2026-07-23).
- **La oferta se vende por capas («oferta cebolla»):** MaKo Project Management, MaKo sin
  atarse al VSL Funnel, MaKo analizador de anuncios, MaKo analizador de llamadas. El catálogo
  de la landing tiene que poder recortarse por capa (2026-07-16).
- **El lead magnet es un «Diagnóstico de anuncios»** (solo el creativo), no del funnel entero:
  *«Eso es fácil de vender en las campañas… y es fácil luego llevarlos a la llamada para ahora
  si diagnosticar todo el funnel»* (2026-07-28).

## El copy: cómo se escribe

Estas son reglas del dueño, no sugerencias. Casi todas se escribieron porque hubo que
corregirlas más de una vez.

### ⚠️ Un cambio en la landing principal se aplica a TODAS las landings de feature, en el mismo commit

Lo tuvo que repetir: *«Estos cambios en la landing principal y en todas… Ya no te debería
repetir esto, siempre los cambios se aplican a ambos»* (2026-07-24). No hay que pedirlo dos
veces. Corolario: **si una sección ya existe en otra pantalla, se copia tal cual, no se rehace
«parecida»** — *«La sección de "Explorá el resto de MaKo" tiene que ser exactamente igual a la
landing principal» / «Que sea IGUAL, ¿no puedes simplemente calcar esa sección? copiarla»*
(2026-07-23).

**Vive en:** `app/vsl/Landing.tsx` · `app/vsl/_detalle/*`

### Cada sección responde ¿PARA QUÉ le sirve al cliente?, no describe la feature

*«No solamente explicar lo obvio y lo técnico… Siempre en cada sección debemos preguntarnos
¿PARA QUÉ le sirve esto al cliente?… y hazlo como regla hacernos esa pregunta»* (2026-07-23).
Y siempre cerrar con **«Descubrí cómo…»** (*«como regla, siempre empezar con "Descubrí
como…"»*). En la venta se dice **el QUÉ se entrega, nunca el CÓMO** (2026-07-28).

### Cada título tiene que entenderse solo, porque el lead desliza

*«los leads muchas veces deslizan… Que sea una regla, esto es storytelling»* (2026-07-23). De
ahí salen cuatro reglas concretas:

- Se le habla **de tú**, personal.
- El **subtítulo no resume: golpea**. *«El subtitulo tiene que ser IMPACTANTE, no debe abarcar
  TODO, solo debe dejar el efecto WOW… Estamos haciendo marketing, muchas veces menos es más»*.
- **Máximo 2 saltos de línea por título** (regla textual).
- Siempre enganchado al **mismo dolor/gatillo** del storytelling de la pieza.

### Un concepto por pieza: si aparece otra feature, se la linkea, no se la explica

*«No mezclemos, esa era una de nuestras reglas»* (2026-07-23). Pero no se la ignora: cuando una
pieza menciona otra feature se deja un **texto corto que redirige** a esa feature, porque todo
está conectado y el usuario suele entrar a **una sola landing** — por limitarse a no mezclar se
pierde la percepción del valor total de MaKo (2026-07-23).

### Cero jerga, cero argentinismos, cero primera persona

- **Nada personal ni en primera persona:** la voz es de IA, no aparece ninguna persona.
  *«No utilices cosas personales como "Para eso construí MaKo" o "Agendá una llamada conmigo"»*
  (2026-07-22).
- **Cero argentinismos en el copy** aunque MaKo hable con acento argentino cuando **asesora**:
  todo lo que se produce **para** el cliente (guiones, copy de anuncios, textos de la app) va en
  español plano. *«Elimina de todos esos diagnosticos el argentino, no digas "Plata"»* ·
  *«A que te referís con que los tableros "banquen"»*.
- **Cero jerga interna y cero tecnicismos:** si el nombre no se entiende solo, se cambia.
  *«Que no ponga "La fabrica de creativos"»* · *«"Vieron tus videos", nuevamente no se entiende.
  ¿Qué videos? ¿mis reels? ¿mis ads? Sería, vieron tus anuncios»* · *«no quiero tecnicismos como
  la matriz 3x3»* (2026-06-30).
- **Los números se escriben como números**, no como palabras (2026-07-24).
- **Nada de clichés apilados ni secciones «por las dudas»:** *«pusiste como 5 frases cliché
  juntas… No pongas cosas de más»* (2026-07-22). Si falta contexto (el dolor del avatar, la
  prioridad), **se pregunta** en vez de rellenar.
- **Cuando se diga que MaKo hace algo «solo», tiene que ser concreto y puntual**, nunca «hace
  TODO solo»: el impacto simple se entiende, *«lo de que MaKo hace todo solo es algo más
  complejo de explicar»* (2026-07-22).

### Los CTA van siempre al ancho de la sección

*«Los botones de CTA te había mencionado que siempre tienen que ser del ancho de la sección»*
(2026-07-23). Es una regla de layout, no una preferencia por pieza.

### No asumas que la estructura actual está bien: auditá y proponé antes de ejecutar

*«Creo que en lugar de asumir las secciones que están ahí, deberíamos hacer una auditoría
primero»* (2026-07-23). Y **el feedback se guarda para reusarlo** en las próximas piezas y en
todos los orígenes, no se pierde en el chat: *«Tienes que ir guardando todos estos feedback
para que nos sea más fácil crear los próximos»* (2026-07-22). Este documento es ese lugar.

## Video, gráficos y capturas

### ⚠️ Nunca uses capturas viejas de la app en material de marketing

*«las capturas que estabas poniendo son de una versión VIEJÍSIMA de la app, nada que ver a lo
que está ahora»* (2026-07-23). Antes de meter una captura o un video de la app, verificá contra
la versión actual **en el navegador** (Preview / Claude in Chrome — hay permiso permanente).

### ⚠️ Nunca crear un gráfico o una animación sin validarlo antes con preguntas

*«siempre que querramos meter un gráfico tu tienes que hacerme preguntas y hasta saber
exactamente lo que quiero ahí lo creas»* (2026-07-23). Los gráficos que salieron mal, salieron
mal por saltarse ese paso: *«Hay muchos gráficos que están mal, te invito a que hagas Claude in
Chrome para verificarlo»* (2026-07-19).

**Y el gráfico explica gráficamente:** *«Muchos gráficos tienen mucho texto, es justamente lo
que queremos evitar, que se explique GRÁFICAMENTE»* (2026-07-19). Si tiene mucho texto, no es un
gráfico.

### El logo de MaKo nunca al ras del borde inferior del video

Siempre un poco más arriba, para que la barra de progreso del player no lo tape. *«Pon el logo
de MaKo de abajo del todo, siempre un poco más arriba… Esto como regla»* (2026-07-24).

### El mini-VSL por funcionalidad se produce en este orden, y no en otro

1. Pulir el **copy de la landing**.
2. Bajarlo a **estructura de VSL corta**.
3. **Voz de ElevenLabs**.
4. Recién ahí el **video**: textos gigantes + capturas y videos reales de la app.

El porqué: *«no queremos un VSL eterno de cada funcionalidad, todo lo contrario, queremos algo
dinámico, algo rápido que presente el dolor y la solución»* (2026-07-22). Y el costo manda:
una landing sale en 1-2 horas, un mini-VSL en 6-10.

### Pendiente: bajar las animaciones del branding «crudas» y por separado

Hoy solo se puede descargar el video entero. Pedido del dueño el 2026-07-27, sin hacer.

---

## Reglas de la casa que también gobiernan esta área

No son de la landing, pero se rompieron acá:

- **Nada es solo para el dueño.** Todo lo que se construye en super admin se construye en la
  misma pasada para los clientes: *«todo esto tiene que modificarse también para los clientes,
  que les aparezca lo mismo, hoy en los clientes, sigue igual que antes»* (2026-07-12). La
  vista de super admin y la del cliente son **la misma pantalla**.
- **Probá vos, no le devuelvas la prueba al usuario.** *«No funciona… Por favor, prueba tú»*
  (2026-07-20). Nada se declara hecho sin verlo en la app: *«Nada funciona… Tienes que realmente
  validar y hacerlo bien»* (2026-08-02).
- **Resolver en una pasada.** Es la queja que más se repite: *«Realmente no entiendo en que te
  estas gastando tantos tokens y aún no solucionas las cosas que te pedí»* (2026-08-07). Si algo
  ya se corrigió dos veces y sigue mal, se lanza multiagente y se cierra de una, con verificación
  en vivo en la preview de Chrome — el dueño prefiere que gastes recursos antes que entregar algo
  a medias: *«si tienes que correr 10000mil multi agentes para hacer esto bien… pero hazlo bien»*.
- **Sin límites arbitrarios.** Ni horas, ni ventanas de días, ni cantidad de resultados: el tope
  lo pone la API, no nosotros (2026-08-07).
- **La documentación se escribe para que la lea ÉL**, no solo otro agente: depurada, con
  títulos, ordenada y visible en super admin. *«si yo lo puedo entender fácil eso me habilita a
  darle mejores prompts al otro claude»* (2026-08-07). Por eso este documento está ordenado por
  subsistema y no por tipo de hallazgo.
