# Pendientes de Martín — tablero vivo

**Qué es esto.** La lista única de lo que Martín pidió y todavía no está. Se actualiza **en el mismo
commit** que resuelve cada cosa: una línea que dice `HECHO` sin su commit al lado no vale.

**Por qué existe.** La noche del 1→2/11/2026 los pedidos llegaron más rápido de lo que se podían
hacer, y la cuenta se acerca a su tope semanal (corta sola al 97 %). Cuando corte, **el que siga lee
este archivo y sigue desde acá**, sin leer el chat.

**Cómo se trabaja.** De arriba hacia abajo. Cada ítem terminado se commitea y se pushea a
`integracion` antes de empezar el siguiente — así nada queda a medias en el disco de nadie.
⚠️ **Un push a `integracion` CANCELA el run anterior de Actions**, así que no se pushea de a
tres seguidos: se junta y se manda una vez por ítem.

---

## ✅ DESPLEGADO — 2/11/2026 ~05:40

`origin/main` = **`bee7d83fd`**. Los 16 commits de la noche entraron juntos y Vercel los desplegó.

**Lo que costó llegar, y es la lección de la noche:** cinco runs de Actions en rojo o cancelados.
Dos causas:

1. **Pushear por ítem CANCELA el run anterior** (`concurrency: integracion`). Lo escribí en este
   mismo tablero y lo hice igual nueve veces seguidas, así que durante horas hubo commits buenos
   sin desplegar. **Se junta, se pushea UNA vez y se espera.**
2. ⚠️ **EL RESUMEN DEL RUN NO NOMBRA LOS TESTS ROJOS; EL LOG DEL JOB SÍ.** El resumen sólo dice
   `afectados: 889 s (código 1)`. En el log hay una línea **«Rojos:»** con los archivos y el
   comando para repetirlos solos. Mirar el resumen y adivinar me costó tres runs. Y correr
   `tests-afectados.mjs` en esta máquina da una lista DISTINTA —corta en otra tanda— que me mandó
   a perseguir dos tests lentos sin relación.

### Verificado EN PRODUCCIÓN (2/11 ~05:50, mirando hola-mako.com/competitor-spy)

- La rejilla de tarjetas se dibuja, y **el botón de borrar aparece al pasar por encima**. ✅
- ⚠️ **Las caras todavía no se ven: todas muestran la inicial.** No es un bug — `avatar` se llena
  recién cuando se vuelve a LEER al competidor («Revisar ahora»), y nadie leyó nada desde el
  deploy. Lo mismo vale para las miniaturas guardadas: las piezas que ya estaban en la base siguen
  apuntando al CDN de Meta, con `miniatura_guardada_en` en null. **La primera lectura las arregla.**
- ⚠️ **Los duplicados que ya existen no se van solos.** El arreglo del alta impide los NUEVOS;
  los seis que hay («sofiacontreras» vs «Sofia Contreras», «hormozi» vs «@AlexHormozi» vs
  «acquisition.com») hay que borrarlos a mano, que ahora se puede desde la tarjeta.

### ⛔ #20 · Por qué sigue apareciendo «Descargar la extensión» (medido el 2/11 ~06:00)

**No es un botón que haya que borrar.** El zip ya está detrás de un flag desde el 27/10
(`lib/extension-tienda.ts`): si la tienda está al día se ofrece «Añadir a Chrome», y si va atrás
se ofrece el zip. Lo vigila `tests/extension-sin-zip-con-tienda.test.ts`, probado rompiéndolo.

Lo que pasa es que **la tienda va atrás**. Medido con `node scripts/version-en-tienda.mjs`:

| | versión |
|---|---|
| Lo que decía `VERSION_EN_TIENDA` | `0.39.1` ← **35 versiones atrás, un dato viejo** |
| Lo que la Chrome Web Store publica HOY | `0.74.3` |
| Lo que sirve el repo | `0.74.4` |

**Ya corregí la medición** a `0.74.3`, que es el valor real. Pero la tienda sigue **una versión
atrás** del repo, así que el flag hace lo correcto al seguir ofreciendo el zip: mandar a Google
serviría un paquete viejo.

**Para que la descarga desaparezca sola hay que PUBLICAR la 0.74.4 y esperar la aprobación de
Google.** Ningún cambio de código lo arregla, y forzar el flag a mano mandaría a cada cliente
nuevo a instalar una versión vieja.

⚠️ **MEDIDO EL 2/11 ~15:30, Y NO ES LO QUE DECÍA ACÁ ANTES.** Las credenciales SÍ existen —están en
`C:/dev/mako-api/.env.local`, no en el `.env.local` del worktree, que es lo que me había hecho
concluir que faltaban—. El problema es otro y lo contesta Google:

```
node --env-file=C:/dev/mako-api/.env.local scripts/publicar-extension.mjs --estado
→ no se pudo renovar el token: {"error":"deleted_client",
  "error_description":"The OAuth client was deleted."}
```

**El cliente OAuth de Google Cloud fue BORRADO.** Por eso el refresh token no sirve, y por eso
nadie pudo publicar aunque las tres variables estén puestas.

**Lo que hace falta, y es trámite de Martín en SU cuenta de Google, no código:**
1. Google Cloud Console → Credenciales → crear un cliente OAuth 2.0 nuevo (tipo «App de escritorio»).
2. Poner el `CWS_CLIENT_ID` y el `CWS_CLIENT_SECRET` nuevos en `C:/dev/mako-api/.env.local`.
3. Autorizar una vez para sacar el `CWS_REFRESH_TOKEN` (`scripts/publicar-extension.mjs --ayuda`
   explica los dos pasos).

Hecho eso, publicar es **un comando**, y la descarga desaparece sola en cuanto Google apruebe.
**Un asistente no puede hacer el paso 1 ni el 3: son el consentimiento OAuth de la cuenta de
Martín.**

### 🎫 Tickets #43 y #44 — SON EL MISMO PEDIDO, y hay un orden (2/11 ~13:15)

Los dos los levantó el mismo cliente (Código Inmobiliario) y piden lo mismo: **cargar un documento
al Second Brain y que MaKo lo incorpore**.

| | #43 | #44 |
|---|---|---|
| Por dónde | WhatsApp | el chat de la app |
| Alcance | el cerebro de OTRO workspace (plan Agencia) | UN solo workspace (ws 23) |
| El contenido | un archivo adjunto | **ya viene como TEXTO en el chat** |

**#44 es el que se puede construir: no tiene ninguno de los dos frenos del #43** (ni adjuntos de
WhatsApp, ni escritura cross-tenant).

**Y la pieza pesada ya está hecha:** `app/api/onboarding/archivero/route.ts` ya ingiere `.txt`,
`.md` y `.docx` (con mammoth) y transcribe documentos e imágenes con IA. **Lo único que falta es
exponerla.**

El área `negocio` de la API de MaKo tiene **cero** funciones de escritura, y
`lib/api-mako/areas/negocio.def.ts` lo explica en su línea 22 **desde el 16/09/2026**:
`agregar_web_archivero` quedó afuera porque su lógica vive INLINE en la ruta y primero hay que
extraerla a `lib/`. O sea que esto no es un bug nuevo: es una deuda anotada hace mes y medio que
recién ahora pidió un cliente.

**El trabajo, en orden:** (1) extraer la ingesta del route a `lib/`; (2) sumar la función de
escritura al área `negocio` con el patrón de las otras; (3) que MaKo la use cuando le peguen un
documento. Hecho eso, **#43 queda a una sola decisión de Martín**: si una agencia puede escribir
en el cerebro de su cliente, y con qué límite.

⚠️ Los dos quedaron en `esperando_decision` con el diagnóstico anotado. No les forcé el estado:
`reclasificar` sólo corre desde «en curso», y están esperando a Martín.

### ⛔ #12 · Por qué el límite de Instagram se subió sólo de un lado

Eran **dos números distintos**, no uno:

- **Por Apify: era 25 y ahora es 100.** El actor YA devolvía todas las publicaciones que traía, y
  nosotros tirábamos a la basura lo que pasaba de 25. Subirlo **no gasta una llamada ni un crédito
  más**: aprovecha lo que ya se pagó. Éste es el camino que funciona hoy.
- **Por Meta (Business Discovery): sigue en 25 y NO se toca sin poder medirlo.** En la Graph API un
  límite que Meta no acepte hace fallar la consulta ENTERA, y **Business Discovery no tiene
  credencial desde el 22/10/2026**: sólo una conexión de cliente (ws11) la tiene y hoy le funciona.
  Subirlo a ciegas es apostar la lectura de ese cliente a una corazonada. El día que haya una
  credencial para probarlo, se mide y se sube.

**Lo que sigue pendiente del pedido:** elegir publicaciones a dedo desde el perfil con la extensión
de MaKo. Eso es trabajo de la extensión, no de la tab.

### 🔎 Buscar mientras escribís — hecho a medias, y el porqué (2/11 ~14:20)

Martín pidió «cuando vaya escribiendo el arroba... ya me vayan apareciendo opciones, un
desplegable para seleccionar».

**Lo que está hecho:** el modal busca **solo, al dejar de escribir** (900 ms), sin tocar ningún
botón, y no repite lo ya buscado en esa sesión del modal. Se siente como «aparece mientras
escribo» y cuesta UNA lectura por @ entero.

⚠️ **Por qué NO se llama en cada tecla, que es lo que se pidió literalmente:** cada lectura de un
perfil gasta del tope **diario** de Apify (`APIFY_TOPE_POR_DIA`). «leilahormozi» son trece teclas:
con una llamada por tecla, dos o tres altas agotan el día y después **nadie del negocio puede
agregar a nadie**.

⚠️ **Lo que falta y NO es lo mismo: un DESPLEGABLE con varias opciones.** Eso es una BÚSQUEDA («los
perfiles que se parecen a `leilaho`»), y lo que tenemos es una lectura por handle EXACTO. Instagram
no da búsqueda por su API; haría falta un actor de búsqueda de Apify, que es otro costo y otra
decisión de Martín. **Antes de construirlo hay que decidir eso**, no es trabajo de pantalla.

### 🎨 La CARICATURA del competidor — lo entendí mal y está a medias (2/11 ~14:40)

**Martín pidió la MISMA caricatura que la de los gurús** («como la que estamos haciendo con los
gurús de los cursos»), generada **para cada competidor nuevo**, y **con protagonismo en la
tarjeta**. Yo entendí «su foto de perfil» y puse un avatar de 56 px arriba. Las dos cosas estaban
mal.

**Lo que YA está hecho:** la imagen manda en la tarjeta — cuadrada, a sangre, con el texto abajo.
Misma anatomía que la tarjeta de pieza y que la de los referentes. Hoy el hueco lo llena la foto de
perfil bajada; cuando exista la caricatura, entra en el mismo lugar sin tocar la pantalla.

**Lo que FALTA, y es trabajo nuevo:** generar la caricatura.

⚠️ **Las caricaturas de los gurús NO las hace la app: las hice yo a mano**, con Canva, desde este
chat. No hay ningún pipeline de generación en el repo. O sea que «que se ejecute el proceso con
cada nuevo competidor» es construir ese pipeline, no llamar a algo que ya existe.

**Lo que hace falta, en orden:**

1. **El prompt aprobado ya está**, textual, en `docs/hallazgos-ops-center.md`. Va cargado como
   prompt EDITABLE (`.claude/skills/add-editable-prompt`), no hardcodeado: Martín lo va a querer
   ajustar y hoy no podría.
2. **Una foto de origen.** Ya la tenemos bajada: `spy_competidores.avatar` (migración 0362). Sin
   foto de perfil no hay caricatura posible, y eso hay que decirlo en la pantalla, no dejar el
   hueco en blanco.
3. ⚠️ **CORRECCIÓN (2/11 ~15:00): SÍ HAY generador de imágenes en el repo, y además acepta una
   FOTO DE REFERENCIA, que es justo lo que la caricatura necesita.** Es **Google Flow**
   (`lib/flow-imagen.ts`, `lib/flow-protocolo.ts`), el que usa el Video Estudio para las imágenes
   de escenario. Lo verificado abriendo los archivos:
   · soporta `referenceEntities` / `referenceLikenesses`, y ya tiene escrito un prompt de
     identidad («The reference image is provided ONLY as an identity reference: match the
     subject's…»);
   · **el token del puente es un BEARER y sirve fuera del navegador** — está escrito así en
     `flow-protocolo.ts`, porque «el puente tiene que trabajar mientras la persona no está». O sea
     que no hace falta que Martín tenga Chrome abierto.

   **Yo le había dicho a Martín que NO existía**, de memoria y sin abrir el archivo — el mismo
   error que ya me costó tres «no está en Knowledge». Esto achica mucho el trabajo: no hay que
   conseguir un proveedor, hay que REUSAR el camino de Flow con el prompt de la caricatura y la
   foto del competidor como referencia.

   **Lo que SÍ queda por averiguar antes de construirlo:** sobre qué cuenta de Google corre el
   puente. Si corre sobre la de Martín, generar caricaturas para los competidores de CADA cliente
   le gasta a él. Eso se mira en el puente, no se adivina.
4. **Guardarla**: el bucket `spy-miniaturas` ya sirve, con una ruta propia.
5. ⚠️ **NO adentro de la lectura.** Generar una imagen tarda bastante más que bajarla, y «Revisar
   ahora» ya casi se pasa del tiempo de la función (ver #4b). Va como trabajo aparte, después de
   crear el competidor, y la tarjeta muestra la foto mientras tanto.

⚠️ **Dos decisiones de Martín antes de construirlo:** (a) **cada caricatura cuesta plata**, y
«para cada competidor nuevo» sin tope puede sumar rápido; (b) es la cara de una persona REAL que no
dio su consentimiento. Para los gurús la regla ya existe y distingue: la galería PÚBLICA va sin
caras ni nombres reales, pero **dentro del análisis PRIVADO de un negocio el competidor que ese
negocio eligió sí se ve** (docs/hallazgos-competitors-spy.md). La tarjeta de Spy es análisis
privado, así que encaja — pero conviene que Martín lo confirme por escrito.

### 📸 Las miniaturas de YouTube NO se estaban guardando — corregido (2/11 ~15:20)

**Le dije a Martín que la miniatura del video largo «ya queda archivada» y era falso.** Lo vi
mirando la base, no suponiendo: de **163 piezas, sólo 12 tenían imagen guardada**, y las 12 eran de
Instagram. Las de YouTube se **derivaban del id al dibujar** y no se bajaban nunca.

Para VERLAS alcanzaba —la URL de YouTube no vence ni bloquea, al revés que la de Meta—, y por eso
nadie lo había notado. Pero Martín las quiere por otro motivo: «que eso también pueda servir de
referencia para crear miniaturas luego para los propios usuarios de MaKo». **Una URL ajena no es
material de referencia; un archivo sí.**

Ahora el mapeo de YouTube pasa la miniatura que YouTube dio —la de mayor resolución— y la baja el
mismo camino que las de Instagram.

⚠️ **La regla, porque es la que lo hizo invisible:** «se ve bien» y «lo tenemos» son dos cosas
distintas. Una imagen que se dibuja desde una URL ajena se ve perfecta y **no está guardada en
ningún lado**. Si alguien la va a usar DESPUÉS para otra cosa, hay que mirar la base, no la pantalla.

**Y algo para saber al revisar:** la última lectura de un competidor fue a las 04:01, **antes** de
que se desplegara el bajador. Por eso hoy hay 0 miniaturas bajadas y 0 caras guardadas. **No está
roto: nadie leyó nada todavía.** Se arregla solo al tocar «Revisar ahora».

### 🧑‍🏫 La RECETA de un referente, probada con Emilio Puigrredón (2/11 ~16:00)

**Hecho: 1 de 12.** Los otros once son esta misma secuencia, sin nada que averiguar.

1. **La transcripción NO está en el archivo del curso.** `curso-*.ts` tiene `transcripcion: []` y
   `resumen: ''` a propósito. El texto vive en **`public/cono-tx/<videoId>.json`**, y el JSON es una
   LISTA de strings. Se sacan los `videoId` del curso y se leen esos archivos.
2. **Se leen las clases del MÉTODO, no todas.** En Social Funnel eran «La fórmula», «La
   estructura» y «Principios de tráfico»: ahí están los marcos. La intro y el bonus no aportan.
   Un curso entero son 80 KB; las del método, la mitad.
3. **La ficha** va en `lib/asesores/ficha-<id>.ts`, **≤ 5.200 caracteres**, con la forma de las que
   ya están: MARCOS numerados (Qué es / Cuándo / Regla / «(clase: …)»), CÓMO PIENSA, QUÉ PREGUNTA
   ANTES DE ACONSEJAR, CÓMO HABLA, y un «⚠️ NO SE TRASLADA» con lo que no hay que repetir —los
   resultados de alumnos son ejemplos, nunca promesas—.
   ⚠️ **Español neutro con «tú».** Las transcripciones están en voseo y copiarlas pone ROJO a
   `tests/puente-panel-copy.test.ts`. La ficha es la voz de MaKo, no la del instructor.
4. **Registrarlo en tres lugares**: el `IdAsesor` y la fila de `ASESORES` en
   `lib/asesores/catalogo.ts`, y el import + la entrada del mapa en `lib/asesores/fichas.ts`.
5. **La caricatura**, que `tests/coaches-ops-center.test.ts` EXIGE («sin imagen su fila saldría
   como un disco vacío»):
   · **la foto de referencia sale de la portada del curso**, `public/cono-portadas/<slug>.webp`,
     que casi siempre tiene la cara del instructor;
   · se sube a Canva con `upload-asset-from-url` apuntando a
     `https://hola-mako.com/cono-portadas/<slug>.webp` (tiene que ser una URL pública);
   · se genera con `generate-image`, `SQUARE_1_1`, pasando ese media id en `imageReferences` y el
     **prompt aprobado textual de `docs/hallazgos-ops-center.md`**, rellenando los huecos con lo
     que se ve en la foto (pelo, barba, anteojos o gorra, piel, gesto, prenda lisa, color de fondo);
   · se guarda como `public/asesores/<id>.png`.

**Los once que faltan, con su curso, están en la tabla de más arriba.**

## Estado

| | Ítem | Estado | Commit |
|---|---|---|---|
| 1 | Spy visible para todos (tenía `adminOnly`) | **HECHO** | `91bcafb09` |
| 1b | **Que además FUNCIONE para todos** (las acciones pedían admin) | **HECHO** | mirar y agregar: cualquiera. Borrar: sólo el admin |
| 2 | Offer y Ads Manager fuera de la barra | **REVERTIDO** | rompe 6 tests: esas keys las nombran el catálogo de la API, el móvil, Knowledge, Create y Estrategia. Es un trabajo propio, ver abajo |
| 3 | Miniaturas de IG: `referrerPolicy` + respaldo | **HECHO** | `91bcafb09`, y reemplazado por #4 |
| 4 | **Descargar y GUARDAR la miniatura** | **HECHO** | bucket `spy-miniaturas` (0361) + `lib/spy-miniaturas.ts`. Migración YA APLICADA en prod |
| 4b | **Que bajar las imágenes no rompa «Revisar ahora»** | **HECHO** | presupuesto de 9 s; lo que no entra lo toma la próxima lectura |
| 4c | **Que no vuelva a bajar lo que ya bajó** | **HECHO** | sin esto el presupuesto se gastaba siempre en las mismas y nunca convergía |
| 4d | **`maxDuration` en la tab** | **HECHO** | Spy no lo declaraba y «Revisar ahora» es lo más caro de la app |
| 5 | **YouTube: que traiga los videos LARGOS** | **HECHO** | pagina la playlist y le reserva cupo a los largos |
| 6 | **Lista de competidores en tarjetas con caricatura** | **HECHO** | la cara es su foto de perfil, bajada (0362) |
| 7 | **Borrar competidor desde la lista** | **HECHO** | el botón vive en la tarjeta |
| 7b | **Deduplicar el alta** (por eso hay 3 «Sofia Contreras») | **HECHO** | deduplica por canal y por nombre comparable |
| 8 | **Rediseñar el modal de «Mirar a alguien más»** | **HECHO** | una entrada, vista previa y confirmación |
| 9 | **Con el @ traer el perfil** | **HECHO en Spy** | falta el CRM |
| 10 | **Con un dato, traer todas sus redes** + landing/funnel de la bio | pendiente | |
| 11 | **Validar con el usuario** antes de guardar | **HECHO** | nada se guarda sin mostrar quién es |
| 12 | **Pasar de 50 publicaciones** | **HECHO a medias** | por Apify, de 25 a 100 (gratis: ya las recibíamos). Por Meta NO se toca, ver abajo |
| 13 | **Spy compartido entre usuarios** | pendiente | la decisión ya está tomada, ver abajo |
| 14 | **Los 12 referentes** (fichas + caricaturas) | **1 de 12** | Emilio Puigrredón hecho. La receta, abajo |
| 15 | **El diseño de la tab principal de gurús** (no el detalle) | pendiente | |
| 16 | **Elegir un gurú desde «nuevo chat»** | pendiente | hoy sólo `funnel` y `offer` |
| 17 | **Base de conocimiento por gurú** | pendiente | |
| 18 | **Botón de Second Brain por gurú** | pendiente | las piezas ya existen |
| 19 | **Modal de «mensaje de difusión» del CRM** con formato por red | pendiente | |
| 20 | **Instalar extensión: sacar la descarga** | **TRABADO, no es código** | el zip YA está detrás de un flag; falta PUBLICAR en la tienda. Ver abajo |
| 21 | **Probar punta a punta la clave de Apify de ws 9** | pendiente | |
| — | Los 20 dashboards | **OTRO CHAT** | `docs/templates-dashboard-propuesta.md` |
| — | ¿Spy trae sólo Reels? | **NO ES UN BUG** | `lib/spy.ts:429` deja pasar todo |

---

## Lo que ya está averiguado, para no volver a averiguarlo

### #5 · YouTube no filtra Shorts: es un tope por RECENCIA

El lector NO filtra por formato. Pide `playlistItems` sobre la playlist de subidas del canal
(`lib/spy-youtube.ts:270`), que trae **todos** los videos, los largos y los Shorts, del más nuevo al
más viejo. Lo que pasa es que se queda con los **últimos 50** (`piezasPorVuelta`), y en un canal que
sube Shorts todos los días los últimos 50 son todos Shorts: **el video largo queda afuera por viejo,
no por formato.**

La duración YA se lee (`lib/spy-youtube.ts:218`, `contentDetails.duration`), así que se puede
clasificar sin pedir nada nuevo. La salida es un cupo por tipo —traer los N largos más nuevos
ADEMÁS de los Shorts— paginando hasta llenarlo.

Y Martín agregó el para qué, que decide el diseño: **la miniatura del video largo tiene que
guardarse igual, porque más adelante sirve de referencia para generarle miniaturas al usuario de
MaKo.** O sea que #5 y #4 son el mismo trabajo: guardar la imagen, no la URL.

### #13 · Cómo compartir Spy sin filtrar datos entre negocios

Hoy es por negocio: `spy_competidores` tiene `workspace_id not null` y `unique (workspace_id,
nombre)` (`supabase/migrations/0359_competitors_spy.sql:67,94`).

**Se comparte lo CARO, no lo privado.** Lo leído de un canal público va a una caché global por `ref`
de canal, que cualquier negocio aprovecha: nadie paga dos veces por leer a Hormozi. **A quién mira
cada negocio sigue siendo suyo.** De ahí sale el borrado que Martín pedía: el usuario saca al
competidor de SU lista y la lectura compartida no se toca; y un competidor sembrado por nosotros va
marcado y no se puede borrar, sólo dejar de ver.

### #14 · Los 12 referentes: el curso de cada uno

Verificado contra el campo `titulo:` de cada archivo, **nunca contra el nombre de la carpeta** (eso
ya puso dos nombres mal en producción: «Jaime Jiguera» por **Higuera** y «Jordi Sigues» por
**Segués**).

| Martín pidió | Curso | Archivo |
|---|---|---|
| Juan Carrizo | Aumenta tu valor y ATV ADVANTAGE | `curso-aumenta-tu-valor-y-atv-advantage.ts` |
| Emilio Puigrredón | Social Funnel | `curso-social-funnel.ts` |
| Vilma Núñez | Certificación en Marketing Digital potenciada por IA | slug `certificacion-marketing-digital-ia` |
| Julián Alborna | Inteligencia Viral 2026 | `curso-inteligencia-viral-2026.ts` |
| Andy Landa | ManyChat Master - Instagram | `curso-manychat-master-instagram.ts` |
| Romuald Fons | Bigseo Academy | `curso-bigseo-academy.ts` |
| Mateo Maffia | BYF | `curso-mateo-maffia-byf.ts` |
| Sergio Begueria | Instituto De Marca Personal | `curso-instituto-de-marca-personal.ts` |
| Álvaro Luque | The perfect launch | `curso-the-perfect-launch.ts` |
| Francisco Doglio | ARCADIA | `curso-arcadia.ts` |
| Gonzalo Seré | Growing Content Specialist | `curso-growing-content-specialist.ts` |
| Samuel Albaa | Growing Closer (con Agustín Nievas) | `curso-growing-closer-agustin-nievas-samuel-albaa.ts` |

⚠️ **Samuel Albaa comparte curso con Agustín Nievas, que ya es referente.** Su ficha tiene que
destilar SU parte —el *appointment setter*: manejar la conversación y conseguir la llamada—, que es
distinto del cierre, que es lo que ya tiene Nievas.

⚠️ **Buscar por el pedazo más corto e inequívoco del apellido** (`Puig`, `Maffi`), nunca por el
nombre tal como lo escribió quien pidió la tarea: «Puigrredon» sin tilde y «Mafia» con una efe no
encuentran nada, y las dos veces concluí que el curso no existía.

Cada referente necesita: su entrada en `ASESORES`, su `IdAsesor`, su `lib/asesores/ficha-<id>.ts`
(≤ 5.200 caracteres, **español neutro con «tú»** — el voseo pone ROJO a
`tests/puente-panel-copy.test.ts`) y su caricatura en `public/asesores/<id>.png` con el prompt
aprobado, que está textual en `docs/hallazgos-ops-center.md`.

---

# Orden de trabajo de lo que falta (escrita el 2/11 ~06:20, al 91 % de la cuenta)

Para cada pendiente: **dónde vive**, **qué pieza ya existe para reusar**, **la trampa** y **qué es
estar hecho**. Lo averiguado acá ya está pago: no hace falta volver a buscarlo.

## #8 · Rediseñar el modal de «Mirar a alguien más»
- **Vive en:** `app/competitor-spy/SpyApp.tsx` → `ModalAlta` (dos pestañas: pegar / a mano).
- **Reusar:** la referencia ya está medida en `docs/diseno/referencia-spy.md` — la ficha de
  producto de fitlo, que es la pantalla análoga.
- **Hecho =** una sola entrada, y lo que se pega se PREVISUALIZA antes de guardar (ver #9 y #11:
  son el mismo modal).

## #9 · Con el @, traer el perfil (Spy y CRM)
- **Ya existe todo el lado servidor:** `leerPerfilInstagram(usuario, { ws, conPiezas })` en
  `lib/instagram-perfil-server.ts` devuelve `{ usuario, nombre, foto, bio, web, seguidores,
  publicaciones }`. Falta sólo una acción que lo exponga.
- **Cómo:** una acción nueva en `app/competitor-spy/actions.ts` copiando el patrón de las otras
  (guard `soloMiembro()`, `try/catch` con `msg(e)`).
- ⚠️ **La trampa:** NO dispararlo en cada tecla. Apify tiene tope diario (`APIFY_TOPE_POR_DIA`,
  `lib/instagram-perfil-server.ts`) y una vista previa por pulsación se lo come en una tarde.
  Va con Enter o al salir del campo.
- **La foto del perfil se baja con lo que ya está hecho:** `guardarMiniaturas([{ canal: 'avatar',
  ref, miniatura: foto }])` de `lib/spy-miniaturas.ts`.

## #10 y #11 · Traer sus otras redes, y VALIDARLAS
- **La landing ya viene gratis:** el campo `web` del perfil de Instagram es el link de su bio.
  Eso solo ya cubre buena parte del pedido.
- **Lo que falta de verdad** es buscar las otras redes por un motor de búsqueda.
- ⚠️ **La trampa, y ya la pagamos con los gurús:** resolver una persona por búsqueda trae a OTRA.
  Por eso Martín pidió explícitamente validar («¿este es el YouTube de esta persona?»).
  **Nada que venga de una búsqueda se guarda sin que el usuario lo confirme.**

## #12 · Pasar de 50 publicaciones
- **El tope es `piezasPorVuelta: 50`** en `lib/spy-reglas.ts` (dentro de `TOPES`).
- **Para YouTube ya está resuelto a medias:** `lib/spy-youtube.ts` ahora pagina con
  `PAGINAS_MAX` y `LARGOS_QUE_QUEREMOS`; el mismo patrón sirve para subir el tope.
- **La otra mitad del pedido** —elegir publicaciones a dedo desde el perfil con la extensión— es
  trabajo de la extensión, no de la tab.

## #13 · Spy compartido entre negocios
- **La decisión ya está tomada** (más arriba en este archivo): se comparte LA LECTURA (caché
  global por `ref` de canal), nunca la lista de a quién mira cada negocio.
- **Media pieza ya está hecha:** las miniaturas se guardan en `spy/<canal>/<ref>` SIN
  `workspace_id` (migración 0361), justamente para que se compartan.
- ⚠️ **Lo que falta toca el aislamiento multi-inquilino**, que es lo más vigilado del repo: leer
  antes `.claude/skills/tenant-safe-query` y `audit-route-cross-tenant`.

## #14 · Los 12 referentes
- **Los 12 cursos ya están localizados** (tabla más arriba), verificados contra el `titulo:` de
  cada archivo. Falta: entrada en `ASESORES`, `IdAsesor`, `lib/asesores/ficha-<id>.ts` y la
  caricatura en `public/asesores/<id>.png` con el prompt de `docs/hallazgos-ops-center.md`.
- ⚠️ **Español neutro con «tú»**: el voseo pone ROJO a `tests/puente-panel-copy.test.ts`. Las
  transcripciones están en voseo, así que la ficha hay que ESCRIBIRLA, no copiarla.

## #16 · Elegir un gurú desde «Nuevo chat»
- **Vive en:** `app/admin/operaciones/ChatNuevo.tsx` (214 líneas, **hoy no nombra referentes en
  ninguna**).
- **Reusar:** el selector ya existe y ya está arreglado — `app/second-brain/ElegirReferente.tsx`
  (el del modal de 1040 px). Lo usan `ChatDelCoach.tsx` y `ChatSecondBrain.tsx`.
- ⚠️ **Lo que lo hace coach es el CONTEXTO, no la pantalla**: lo elige el servidor por
  `desde.tab` en `lib/asesores/contexto.ts`. Poner el selector sin tocar eso deja un chat que se
  ve distinto y contesta igual.

## #18 · Botón de Second Brain por gurú
- **Las piezas están todas:** `app/second-brain/Grafo.tsx` recibe
  `cerebro = { nodos, aristas, cuenta, posiciones, encuadre }`, y `lib/cerebro-knowledge.ts`
  (31/10) ya cuelga Knowledge como una capa del grafo (`conCapa`, `lib/cerebro-union.ts`).
- **Hecho =** un botón en el chat del gurú que abre el grafo filtrado a SU curso.

## #19 · Modal de «mensaje de difusión» del CRM
- **Vive en:** `app/crm/AccionesLoteLeads.tsx` y `app/crm/seleccion-difusion.ts`.
- **Reusar:** el formato por red ya existe en Automations — de ahí sale el «como lo tenemos en
  Automations» que pidió Martín.

## #2 · Sacar Offer y Ads Manager de la barra (revertido)
- **No es borrar una línea de `nav.ts`.** Esas keys las nombran: el catálogo de funciones de la
  API de MaKo, las rutas del móvil, los módulos de Knowledge, Create y Estrategia. Seis tests.
- **Hecho =** cada consumidor mudado a donde viven ahora (Funnel Coach y Hormozi, adentro del
  Ops Center), y recién entonces la línea de menos en `nav.ts`.
