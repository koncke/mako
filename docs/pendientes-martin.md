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

## 👥 QUIÉN TIENE QUÉ — repartido el 2/11/2026 ~18:30

Martín: «y ya se está trabajando sobre todo el resto que te pedí también». **No era así: miré las
17 sesiones y estaban TODAS quietas.** Así que el Cerebro repartió. Esto es el estado del reparto,
no una promesa de que esté hecho.

| Ítems | A quién | Estado del envío |
|---|---|---|
| **14** — los 10 referentes que faltan (fichas + caricaturas) | `Ops Center` (local) | entregado |
| **19** — modal de «mensaje de difusión» del CRM | `Automations` (local) | ✅ **TERMINADO** en `difusion-modal-0211` |
| los 20 dashboards | `Replicar los 20 dashboards…` (local) | entregado |
| **13** — compartir las lecturas de Spy entre negocios | `Supabase API proxy access` (nube) | entregado |
| **ticket #44** — cargar un documento al Second Brain desde el chat | `Contexto breve [1c37c8]` (nube) | entregado |
| **2** + **16** — Offer y Ads Manager adentro del Ops Center; elegir gurú en «nuevo chat» | `Metodología Ops Center…` (nube) | entregado |
| **17** + **18** — capa de Second Brain por gurú, con el curso entero | `Contexto breve [21251a]` (nube) | entregado |
| **15** — diseño de la tab de gurús + **el modal roto en prod** | `Design: Continuación del proyecto` (nube) | entregado |

⚠️ **«Entregado» significa que el mensaje llegó al buzón de esa sesión, NO que su Claude lo leyó.**
Y de las sesiones en la NUBE no vuelve nada: el canal es de ida, así que el silencio no es acuerdo.
Lo que cada una hizo se ve en su propio transcript (claude.ai/code) y, cuando commitee, en
`origin/main`.

### ⛔ Y REPARTIR NO AGREGA CUOTA — lo corrigieron las dos sesiones que contestaron

**Las 17 sesiones, locales y de la nube, corren sobre la MISMA cuenta `claude1`.** Pasarle un ítem
a otro chat no suma cuota: gasta la misma. Al 93 % eso significa que el reparto **acelera el corte
en vez de evitarlo**, y que el trabajo grande se corta a mitad de camino en otra sesión en lugar de
en ésta.

Las dos sesiones que contestaron lo vieron antes que yo y las dos se frenaron solas, con razón:

· **`Ops Center`** midió lo que cuesta una ficha: **175–285 mil tokens de subagente** cada una, o
  sea **~2,3 millones por los diez**, sin contar las imágenes. No arranca sin cuenta nueva. Su rama
  `ops-coaches-0111` quedó limpia en `652e94c22` y **atrás de main: no usarla de base.**
· **`Replicar los 20 dashboards`** va **5 de 20** —General, Comercial, Cobranza, Landing y Focus,
  en dos variantes (Pane y Lumora)—, con los mockups en `docs/diseno/mockups-dashboard/` y su
  galería `index.html`. El mapa de qué hoja sale de qué referencia está en
  `docs/templates-dashboard-propuesta.md` §7.3; el relevo en `docs/relevo/templates-dashboard.md`;
  los hallazgos en `docs/hallazgos-templates-dashboard.md`. **No arranca las 15 restantes y tiene
  razón en el motivo: Martín todavía no vio las primeras, y corregir el criterio en 4 hojas es
  barato y en 19 no.** Lo que ya no hay que rehacer: los 24 demos están medidos y el medidor quedó
  en `docs/diseno/mockups-dashboard/medidor/`.

⚠️ **Y avisó de algo que podía borrar 3.430 líneas:** su rama `dashboard-denso-0111` vivía SÓLO en
el worktree `C:/dev/wt-dashboard-3110`, sin upstream y sin estar en ningún remoto, con el worktree
**limpio**. La regla de barrido de worktrees («sólo limpios, subidos, sin uso 24 h») lo habría
leído como limpio y lo habría borrado: *no estaba subido, pero parecía limpio.* **Ya la subí** —
`origin/dashboard-denso-0111`, punta `a4fb06dba`— y subir una rama que no es `integracion` **no
dispara Actions** (`.github/workflows/integracion.yml:28` sólo escucha `branches: [integracion]`),
así que no gastó minutos ni canceló ningún run. **La regla que queda: «limpio» no es «a salvo».
Antes de barrer un worktree hay que mirar si su rama está en un remoto, no si el working tree está
limpio.**

**Lo que hace falta para seguir, y es decisión de Martín: pasar a otra cuenta.** Con cuenta nueva
los briefs sirven tal cual.

⚠️ **Por qué cinco fueron a la nube y no acá: no hay RAM.** Medido el 2/11 ~18:20 — **2,73 GB
libres de 15,71**, y el guardia corta Bash por debajo de 3 GB. Los procesos `claude` solos ocupan
**5,09 GB**; Chrome no estaba ni abierto, así que no hay nada que cerrar para hacer lugar. Despertar
más sesiones locales habría ahogado la máquina. Martín lo había autorizado: «si tienes problema de
RAM comiénzalos en una sesión en la nube».

**Lo que NO se repartió, y por qué:**

| Ítem | Por qué sigue quieto |
|---|---|
| **9** (mitad CRM) — vista previa del perfil con el @ en el CRM | es de `Automations`, que ya está con el 19. Va después, en la misma área |
| **10** — con un dato traer TODAS sus redes + el desplegable | hace falta un **actor de búsqueda de Apify**. Martín ya dijo que paga; falta elegirlo y medir qué cuesta por búsqueda |
| **21** — probar punta a punta la clave de Apify de ws 9 | gasta del tope diario de un cliente real. Se prueba cuando haya una lectura que de todos modos había que hacer |
| la **caricatura** del competidor | falta UN dato antes de construir: **sobre qué cuenta de Google corre el puente de Flow**. Si corre sobre la de Martín, generar caricaturas para los competidores de cada cliente le gasta a él. Eso se mira en el puente, no se adivina |
| **20** — que desaparezca «Descargar la extensión» | trabado en el consentimiento OAuth de la cuenta de Google de Martín (cliente OAuth borrado). No es código y un asistente no puede hacerlo |
| **ticket #43** | Martín ya lo desbloqueó («una agencia sí puede, inspeccionando»), pero necesita el camino cross-tenant y los adjuntos de WhatsApp. Va DESPUÉS del #44, que es la misma pieza sin esos dos frenos |

---

## ✅ DESPLEGADO — 2/11/2026 ~05:40

`origin/main` = **`bee7d83fd`**. Los 16 commits de la noche entraron juntos y Vercel los desplegó.

**Lo que costó llegar, y es la lección de la noche:** cinco runs de Actions en rojo o cancelados.
Dos causas:

1. **Pushear por ítem CANCELA el run anterior** (`concurrency: integracion`). Lo escribí en este
   mismo tablero y lo hice igual nueve veces seguidas, así que durante horas hubo commits buenos
   sin desplegar. **Se junta, se pushea UNA vez y se espera.**

   ⚠️ **MEDIDO EN ACTIONS EL 2/11 ~19:10, y es la prueba, no la sospecha:** los runs **#349 al
   #358 salieron TODOS «cancelled»**. Ninguno rojo — **ninguno TERMINADO**. El último verde fue el
   **#348** (`63d66d8`), que es exactamente donde quedó clavado `main` mientras doce commits buenos
   esperaban arriba. Y la trampa de lectura: un run cancelado a los 2 minutos **no deja ningún
   error**, así que buscando el fallo no se encuentra nada y parece que el problema es otro. El
   **#359** lleva los 13 juntos.

   ⛔ **POR ESO EL PUSH DEL ÍTEM 9 ESTÁ RETENIDO A PROPÓSITO (2/11 ~19:45).** El ítem está hecho y
   commiteado en `c85e10ec2`, y la orden de trabajo dice pushear al terminar cada ítem — **pero el
   #359 todavía corre con 13 commits de Martín adentro, y pushear ahora lo cancela.** Esperar 15
   minutos cuesta menos que repetir una hora. **El que siga: mirá Actions primero** (si el #359 está
   verde, `main` ya avanzó solo) y recién entonces
   `MAKO_SIN_ANTES_DE_SUBIR=1 git push origin HEAD:integracion`.

   ⚠️ Y hay DOS ramas más esperando el mismo tren, las dos ya a salvo en el remoto:
   `difusion-modal-0211` (`6bf0a40a8`, el ítem 19) y `dashboard-denso-0111` (`a4fb06dba`, 5 de 20
   dashboards). Cuando el #359 cierre, **se juntan y se mandan de una sola vez**, no de a una.
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
2. **Para la FICHA se leen las clases del MÉTODO, no todas** (para la capa del segundo cerebro se leen todas: ver la sección de arriba).** En Social Funnel eran «La fórmula», «La
   estructura» y «Principios de tráfico»: ahí están los marcos. La intro y el bonus no aportan.
   Un curso entero son 80 KB; las del método, la mitad.
3. **La ficha** va en `lib/asesores/ficha-<id>.ts`, **≤ 5.200 caracteres**, con la forma de las que
   ya están: MARCOS numerados (Qué es / Cuándo / Regla / «(clase: …)»), CÓMO PIENSA, QUÉ PREGUNTA
   ANTES DE ACONSEJAR, CÓMO HABLA, y un «⚠️ NO SE TRASLADA» con lo que no hay que repetir —los
   resultados de alumnos son ejemplos, nunca promesas—.
   ⚠️ **Español neutro con «tú».** Las transcripciones están en voseo y copiarlas pone ROJO a
   `tests/puente-panel-copy.test.ts`. La ficha es la voz de MaKo, no la del instructor.
   ⚠️ **Las tácticas engañosas del curso NO pasan a la ficha.** Varios cursos enseñan maniobras
   para forzar una respuesta o aparentar algo que no es. La ficha es un asesor que MaKo le pone
   enfrente a un negocio: se destila el MÉTODO, no el truco. Esto salió de las ocho fichas que
   quedaron escritas en el brief del 2/11 y conviene que esté acá, porque es la clase de cosa que
   se copia sin pensar.
   ⚠️ **Toda cifra se busca en la clase que se cita, antes de darla por buena.** Las
   transcripciones son habla: un número dicho al pasar, redondeado o exagerado se lee igual que un
   dato. Si no aparece en la clase citada, no va.
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

**Los diez que faltan, con su curso, están en la tabla de más arriba.**

⚠️ **Dos cosas que aprendí en el segundo y ahorran tiempo en los que vienen:**
· **Un curso puede tener 740 KB de transcripción.** «Inteligencia Viral» son 41 clases. NO se
  lee entero: se eligen cuatro o cinco clases del método por el título y alcanza de sobra.
· **La ficha se va de largo sola.** La primera versión de Alborna salió en 5.692 y el tope es
  5.200. Lo que sobra casi siempre son los «Cuándo:» de cada marco y los ejemplos repetidos:
  se recorta eso antes que un marco entero.

### 🧠 LA FICHA Y EL SEGUNDO CEREBRO SON DOS COSAS DISTINTAS (2/11 ~17:00)

Martín: «me gustaría que se lea entero los cursos, que no haya limitación de caracteres,
justamente la idea es que el segundo cerebro de estos gurús tenga todo el contexto».

**Tiene razón en el objetivo, y por eso el camino NO es sacarle el tope a la ficha.** Son dos
piezas con dos trabajos:

| | La ficha (`lib/asesores/ficha-<id>.ts`) | El segundo cerebro del gurú |
|---|---|---|
| Qué es | cómo piensa, qué pregunta, cómo habla | el curso ENTERO, clase por clase |
| Cuándo viaja | **en cada mensaje**, siempre | **sólo cuando la pregunta lo pide** |
| Por eso | tope de 5.200 | sin tope |

Sacarle el tope a la ficha metería las 740 KB de un curso en **cada turno** de cada chat: caro,
lento, y peor de leer para el modelo —el método se ahoga entre el relleno—. Lo que Martín quiere
«todo el contexto disponible» se resuelve del otro lado, y **el repo ya tiene exactamente ese
mecanismo**: `lib/cerebro-knowledge.ts` (31/10) cuelga Knowledge como una CAPA del Second Brain,
y `lib/cerebro-recuperar.ts` la recupera **sin IA y con presupuesto**. Su propio comentario lo
dice en mayúsculas: «POR QUÉ UNA CAPA Y NO MÁS TEXTO EN EL PROMPT».

Cómo funciona hoy, que es lo que hay que copiar: **el índice viaja siempre, una línea por módulo
y SIN contenido**; el cuerpo largo de un nodo viaja **sólo cuando un chat lo pide por id**. Una
pregunta que nombra «anuncios» trae ese módulo y sus vecinos, no el índice entero.

**Entonces lo que falta (ítems 17 y 18) es una capa POR GURÚ, con un nodo por CLASE**, para que
preguntarle algo a Alborna traiga la clase donde él lo explica — con sus palabras y completa— y
no un resumen. Ahí sí se lee el curso entero: va a la capa, no a la ficha.

⚠️ **Y esto corrige una instrucción que yo mismo escribí más arriba en la receta.** «Leer sólo
las clases del método» vale para ESCRIBIR LA FICHA, que es corta por diseño. Para la capa hay que
procesar **todas** las clases. Son dos pasos distintos sobre el mismo curso, y confundirlos fue
mío.

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
| 9 | **Con el @ traer el perfil** | **HECHO, Spy y CRM** | `c85e10ec2` — en el CRM no faltaba pantalla —estaba desde el 12/10—: la ruta pedía `APIFY_TOKEN`, que no existe en ningún negocio, teniendo al lado la `APIFY_CLAVE_DE_SPY` que Martín pegó el 1/11. Una fuente sin credencial hace `continue`, no error: fallaba en silencio once días. `docs/hallazgos-crm.md` |
| 10 | **Con un dato, traer todas sus redes** + landing/funnel de la bio | **HECHA la mitad GRATIS** | el link de la bio ya se leía, se MOSTRABA y se tiraba a la basura al guardar (`lib/spy.ts` no nombraba `perfil.web` en ninguna línea). Ahora viaja con la confirmación y entra como landing —o como YouTube, si su bio enlaza su canal—, sin pagar una segunda lectura. `canalDeLaBio` en `lib/spy-reglas.ts`, con `tests/spy-canal-de-la-bio.test.ts`. **Falta** la búsqueda por nombre (otro actor de Apify, decisión de Martín) |
| 11 | **Validar con el usuario** antes de guardar | **HECHO** | nada se guarda sin mostrar quién es |
| 12 | **Pasar de 50 publicaciones** | **HECHO a medias** | por Apify, de 25 a 100 (gratis: ya las recibíamos). Por Meta NO se toca, ver abajo |
| 13 | **Spy compartido entre usuarios** | **EMPEZADO: la base está** | migración `0363` **ya aplicada en producción** (tabla global `spy_lecturas_canal`, sin `workspace_id` a propósito, RLS prendida sin políticas como las otras de Spy) + `lib/spy-compartido.ts` con la regla, probada rompiéndola. ⚠️ **FALTA EL CABLEADO**: que `mirarCompetidor` la consulte antes de llamar a Apify/YouTube y la refresque después. Ver abajo |
| 14 | **Los 12 referentes** (fichas + caricaturas) | **2 de 12** | Puigrredón y Alborna hechos. La receta, abajo |
| 15 | **El diseño de la tab principal de gurús** (no el detalle) | pendiente | |
| 16 | **Elegir un gurú desde «nuevo chat»** | pendiente | hoy sólo `funnel` y `offer` |
| 17 | **Base de conocimiento por gurú** | pendiente | |
| 18 | **Botón de Second Brain por gurú** | pendiente | las piezas ya existen |
| 19 | **Modal de «mensaje de difusión» del CRM** con formato por red | **HECHO, esperando el tren** | rama `difusion-modal-0211`, punta `6bf0a40a8`, ya en el remoto. ⚠️ **Vive en `app/automations/difusion/HojaDifusion.tsx`**, NO en `app/crm/AccionesLoteLeads.tsx` ni `app/crm/seleccion-difusion.ts` — esos dos sólo ponen la selección, y el ítem los nombraba mal. No trae selector de número/cuenta: la difusión no lo guarda y mentiría |
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

## 🔎 REVISIÓN COMPLETA DE COMPETITORS SPY — 2/11/2026 ~20:30

Martín la pidió dos veces: «revisá bien todas las cosas que van a faltar de Competitor Spy». Esto es
la lista entera, con lo que YO había marcado mal.

### ⛔ Lo que marqué HECHO y NO lo está

**Ítem 8 — el rediseño del modal de «nuevo competidor».** Martín: «si faltan más cosas de Competitor
Spy, también por ejemplo como el rediseño del modal de nuevo competidor, entonces eso también hace
falta».

**Tiene razón y el error es mío.** Lo marqué HECHO porque le puse **una entrada, vista previa y
confirmación** — o sea arreglé cómo FUNCIONA. El pedido del 2/11 era «rediseña el modal de nuevo
competidor», que es cómo se VE. Es exactamente la confusión que él me corrigió cuatro veces esta
semana con la tab: *«no quiero que corrijas o intentes mejorar lo que ya hiciste»*.

Lo que haría falta, y el método está medido: empezar por `docs/diseno/referencia-spy.md` (la
anatomía de modal sacada del navegador) y NO por `SpyApp.tsx`. Si el primer archivo que se abre es el
nuestro, es una mejora, no un rediseño.

### ✅ Lo que quedó andando hoy

| | qué |
|---|---|
| **Las 22 caricaturas ya dibujadas entran en la tarjeta** | `ff17d32ba`. Se empareja por nombre comparable, sin tabla de @: `alexhormozi`, `hormozi` y «Alex Hormozi» colapsan al mismo texto. ⚠️ **Sin cartel «Inspirado en» y a sangre**: le había puesto el cartel y un 10 % de aire alrededor del dibujo, y Martín sacó las dos cosas — «eso no tiene sentido» y «deberían ocupar todo el ancho, no estar chiquititas en un cuadrado». Foto y caricatura se dibujan IGUAL |
| **No hay dos Hormozi** | el alta guarda el nombre DE VERDAD que ya leía la vista previa (antes: `alexhormozi`, o `UCxxxx` si pegabas su canal — por eso salían dos tarjetas), y el referente entró como tercera llave de deduplicación |
| **El link de su bio** | `4ad25d54d`. Entra como landing, o como YouTube si su bio enlaza su canal |
| **El @ en el CRM** | `c85e10ec2`. Pedía una clave de Apify que no existe |

### ⏳ Lo que falta de Spy, en orden de lo que Martín pidió

| | qué falta | por qué no está |
|---|---|---|
| **13** | **compartir el análisis entre todos los usuarios** | la decisión está tomada (caché global por `ref` de canal; la LISTA de cada negocio sigue siendo suya). Falta una migración con RLS y la pantalla. **Es lo más grande que queda y Martín lo volvió a pedir con prioridad.** Delegado a una sesión en la nube; no volvió nada todavía |
| **8** | **el rediseño del modal** (lo de arriba) | se confundió «funciona» con «se ve bien» |
| **10** | **el desplegable con varios perfiles** | es una BÚSQUEDA, y lo que tenemos es lectura por @ exacto. Necesita un actor de búsqueda de Apify: Martín ya dijo que paga, falta elegirlo y medir qué cuesta por búsqueda |
| — | **generar caricaturas NUEVAS** (para quien no es referente) | el camino es Google Flow (`lib/flow-imagen.ts`, acepta foto de referencia). **Falta UN dato antes de construir: sobre qué cuenta de Google corre el puente.** Si corre sobre la de Martín, generar para los competidores de cada cliente le gasta a él |
| **21** | probar punta a punta la clave de Apify de ws 9 | gasta del tope diario de un cliente real; se prueba junto a una lectura que de todos modos había que hacer |
| **12** | pasar de 25 publicaciones POR META | Business Discovery no tiene credencial desde el 22/10. Un límite que Meta no acepte hace fallar la consulta ENTERA: no se toca a ciegas |
| — | elegir publicaciones a dedo desde el perfil | es trabajo de la extensión, no de la tab |

### 🎯 Los 22 que ya tienen cara: Martín pega el @ y sale dibujado

Él pidió los @. **No hace falta que yo los adivine, y es mejor así:** el emparejamiento es por nombre,
y la vista previa ya lee el nombre real del perfil. O sea que pegando el @ que él conoce, el sistema
reconoce a la persona por el nombre que devuelve Instagram y le pone la caricatura. **Un @ puesto de
memoria por mí traería a OTRA persona**, que es el error que ya pagamos con los gurús.

Alex Hormozi · Juan Osorio (Juan ADS) · Julián Otálora · Sofía Contreras · Marcos Razzetti ·
Víctor Heras · Agustín Nievas · Derek Chamizo · David Turu · Ximena Fukuda · Guille Collado ·
Marc Verdú · Ramiro Cubria · Iman Gadzhi · Felipe Vergara · Jaime Higuera · Adrià Sola Pastor ·
Augusto Bianchi · Tino Mossu · Jordi Segués · Emilio Puigrredón · Julián Alborna

⚠️ **Y los duplicados que YA están en la base no se arreglan solos.** El arreglo impide los nuevos.
Los que hay («sofiacontreras» vs «Sofia Contreras», «hormozi» vs «@AlexHormozi» vs «acquisition.com»)
hay que borrarlos a mano desde la tarjeta. ⚠️ **`acquisition.com` no se va a juntar con Hormozi
nunca**: un dominio no se empareja con una persona, y hacerlo necesitaría una tabla de dominios.

## 🎫 EL PROGRESO DE UN TICKET, PARA QUIEN LO LEVANTÓ — 2/11/2026

Joan, por WhatsApp: «¿cómo van esos tickets?». Martín: «que cuando él levante un ticket… le diga,
mira el progreso de tu ticket aquí, y que él pueda ir viendo: tu ticket fue levantado, el equipo lo
revisó, ya lo están desarrollando. Y también… que se le envíe por email los avances. Y solamente
cuando ya esté 100 % finalizado, ahí sí el mensaje de WhatsApp que ya tenemos».

**Lo que YA existía y nadie le había dicho:**
· Los estados de cara al cliente: `EstadoCliente` = recibido · en curso · tu respuesta · resuelto ·
  cerrado (`lib/tickets-reglas.ts:76`).
· La LÍNEA DE TIEMPO con fechas: `pasosDelTicket` (recibido → en curso → arreglado → resuelto →
  cerrado), que dibuja la pantalla `/tickets?t=<id>`.
· Que WhatsApp **ya avisa sólo al final**: `avisarPendientes` (`lib/tickets-cierre.ts:124`) manda
  «cerrados, resueltos o con una pregunta del equipo». O sea que esa parte del pedido ya estaba bien.

**Lo que faltaba de verdad, y es por lo que Joan preguntó:** la respuesta del grupo terminaba en
«te aviso por aquí cuando esté» y **no nombraba la pantalla**. La única forma de saber algo era
esperar o preguntar.

**HECHO** (`53f6f2f26`): la respuesta del grupo lleva «Mirá cómo va acá: …/tickets?t=<id>».
La base viaja por PARÁMETRO y no por import: `lib/despacho-grupo.ts` es puro y sus tests lo ejecutan
directo; importar `APP_BASE_URL` arrastraría `ws-tab` y las landings. Sin base, la frase es la de
antes palabra por palabra, y hay tests de las dos formas.

**FALTA — el email de avance.** Es lo único del pedido que no está:
· Hoy `avisarPendientes` dispara en resuelto / cerrado / pregunta del equipo. El avance intermedio
  («el equipo lo revisó», «ya lo están desarrollando») **no dispara nada**.
· El camino: colgar el aviso del cambio de `EstadoCliente` —no del estado interno, que tiene ocho
  valores y varios no le dicen nada a nadie— y mandarlo por Resend desde `equipo@hola-mako.com`,
  que es el remitente de la casa (`lib/app-url.ts`, `EMAIL_MAKO`).
· ⚠️ **Con tope por ticket.** Un ticket que rebota entre «en curso» y «esperando cliente» mandaría
  un correo por rebote. El patrón ya existe en el repo: `avisado_at` por hito, no por cambio.
· ⚠️ **Y el WhatsApp NO se toca:** sigue sólo al final, que es lo que Martín pidió y lo que ya hace.

### 💸 DECISIÓN DE PLATA QUE MARTÍN PUEDE REVERTIR — 2/11/2026

**El alta del CRM ahora puede gastar la clave de Apify del negocio.** Hasta el 1/11 la regla era
«Apify: sólo Spy», y `tests/leads-scraper-retirado.test.ts` la hacía cumplir con estas palabras: *«el
alta del CRM y Offer siguen sin poder gastarla»*. Por eso el run #361 salió rojo, y **el rojo era
correcto**: mi cambio del ítem 9 la rompía.

Gana el pedido posterior —Martín, 2/11: «ya con Apify debería funcionar el traer el perfil
escribiendo el @, eso también en el CRM»—, pero **es plata del negocio**, así que queda acá y en el
guard, con fecha y con cómo se revierte, en vez de aflojarse en silencio.

**Qué gasta, exactamente:** cuando ni Meta ni Google traen nada, el buscador lee UN perfil por @
EXACTO con `APIFY_CLAVE_DE_SPY`. Mismo tope diario que Spy (`APIFY_TOPE_POR_DIA`) y la pantalla
espera a que la persona deje de escribir, así que no se gasta por tecla. **El scraper de leads NO
vuelve**: eso es búsqueda masiva, se llamaba `apify` a secas, y el guard lo sigue prohibiendo. Offer
tampoco puede gastarla.

**Para revertirlo:** sacar `'apify-spy'` de las fuentes en `app/api/crm/instagram-buscar/route.ts` y
dejar el guard como estaba.

### 🖼️ Y un rojo que se cazó ANTES de subir

Agrandar las caricaturas a 600 px iba a poner en rojo `tests/coaches-ops-center.test.ts`: exige
menos de **150 KB** por cara porque la lista de chats del Ops Center las baja TODAS, y a 600 px
quedaban en ~159 KB. **Un archivo no puede servir a los dos.** Ahora son dos:
`public/asesores/<id>.png` (200 px, la lista) y `public/asesores/grandes/<id>.png` (600 px, la
tarjeta de Spy), con un test que exige que cada referente tenga las dos.

### 🔗 ÍTEM 13 — CÓMO SE TERMINA EL CABLEADO (la base ya está, 2/11/2026)

**Hecho y aplicado en producción:**
· `supabase/migrations/0363_spy_lecturas_compartidas.sql` — tabla `spy_lecturas_canal`, con clave
  `(canal, ref)`. **Sin `workspace_id` a propósito**: si guardara quién la pidió, diría a quién
  vigila cada negocio, que es justo el dato que NO se comparte. RLS prendida y sin políticas, igual
  que `spy_competidores` y `spy_piezas` (0359): sólo el service role.
· ⚠️ **NO AGREGAR `spy_lecturas_canal` A `TENANT_TABLES`** (`lib/workspace.ts:87`). El proxy le
  estamparía un `workspace_id` que la columna no tiene y rompería toda escritura. Es global a
  propósito, y ese concepto ya existe: lo que no está en esa lista pasa sin scoping.
· `lib/spy-compartido.ts` — la regla, pura y con test probado rompiéndolo
  (`tests/spy-lectura-compartida.test.ts`).

**La regla, que es lo que separa ahorrar de mentir:**

| cuándo se lee | sirve la lectura de otro |
|---|---|
| **alta** de un competidor nuevo | hasta **24 h** — no hay nada en pantalla, y una lectura de ayer vale más que un cuadro vacío mientras se gasta un crédito. **Acá es donde se ahorra de verdad** |
| **rutina** (revisión de fondo) | hasta **6 h** |
| **«Revisar ahora»** | **NUNCA.** Quien toca ese botón está mirando y pide datos de HOY. Ahí se lee de verdad y se refresca la copia compartida para todos |

**Lo que falta, en orden, y es todo en `lib/spy.ts` → `mirarCompetidor` (línea ~514):**
1. Antes de `leerPerfilInstagram` y del lector de YouTube: armar la clave con `claveDeCanal` y, si
   `sirveLaCompartida(motivo, fila.leido_en, Date.now())`, usar `fila.piezas` en vez de llamar.
2. `mirarCompetidor` necesita recibir el **motivo** (`'alta' | 'rutina' | 'a-pedido'`). Hoy no lo
   tiene: el alta y el botón entran por el mismo camino. **Sin ese parámetro no se puede cumplir la
   regla de arriba**, así que es el primer paso, no un detalle.
3. Después de una lectura de verdad: `upsert` de la fila con las piezas y el perfil.
4. Sumar 1 a `ahorros` cada vez que se sirve sin pagar. Es la medida de si esto sirve: si queda en
   cero, nadie mira a los mismos y la tabla no se ganó el lugar.
5. Podar lo que pase de `DIAS_QUE_SE_GUARDA` (30).

⚠️ **Lo que NO cambia, y conviene no tocarlo:** `spy_piezas` y `spy_competidores` siguen por
negocio, con su borrado de siempre. El usuario saca al competidor de SU lista y la lectura
compartida no se toca. **Nadie ve la lista de nadie.**

### 🧠 ÍTEM 17 — EL SECOND BRAIN DE UN GURÚ: EL MECANISMO YA ESTÁ (2/11/2026)

Martín: «me interesa que se avance con los gurús, y el second brain de cada uno».

**Hecho:** `lib/cerebro-referente.ts` + `tests/cerebro-referente.test.ts` (7/0, probado
rompiéndolo). Es la capa de UN gurú: su raíz, **un nodo por CLASE con la transcripción entera y sin
tope**, y las clases encadenadas en orden.

**Las dos mitades de la regla, y las dos tienen test:**
· el `cuerpo` de una clase **no se recorta** — el tope de 5.200 es de la FICHA, que viaja en cada
  mensaje; esta capa viaja sólo cuando la pregunta la pide;
· el `detalle` **no puede llevar el texto** — el índice sí viaja siempre, así que una clase de 40
  mil caracteres ahí metería el curso entero en cada turno, que es justo lo que se está evitando.

**Por qué esto cuesta horas y no millones de tokens:** el texto va CRUDO a la capa. No pasa por el
modelo. Lo caro de un gurú es la FICHA (175–285 mil tokens de subagente, medido por la sesión del
Ops Center); la capa es copiar archivos.

⚠️ **LO QUE FALTA, en orden:**
1. **El lector del servidor.** `armarReferente` recibe las clases ya leídas, a propósito: es puro y
   los tests lo ejecutan. Falta quien saque los `videoId` del curso (`app/conocimientos/curso-*.ts`)
   y lea `public/cono-tx/<videoId>.json` — que es una **LISTA de strings**, no un string.
2. **Colgarla con `conCapa`** (`lib/cerebro-union.ts:60`), como hace `lib/cerebro-knowledge.ts`.
3. **Cuándo entra la capa en el turno.** Knowledge tiene esa decisión escrita y es la parte fina:
   nombrar al gurú NO alcanza, igual que nombrar un módulo no alcanza para Knowledge. Copiar ese
   criterio, no inventar otro.
4. **El botón del grafo (ítem 18)**, que es la parte chica: las piezas ya existen.

⚠️ **Y no depende de que estén las 12 fichas.** La capa se arma desde el catálogo: sirve hoy para
Puigrredón y Alborna, y los otros diez entran solos cuando se carguen.

**Avance del 2/11 ~20:10 — el lector del servidor ya está** (`lib/cerebro-referente-server.ts`), o
sea el paso 1 de los cuatro de arriba. Lee `public/cono-tx/<videoId>.json`, que es una LISTA de
strings, y arma las clases en el orden del curso. Una clase sin transcribir NO rompe la capa: queda
afuera y el resto se arma igual.

**Medido contra los cursos de verdad, no supuesto:**

| referente | clases | con transcripción | caracteres |
|---|---|---|---|
| Emilio Puigrredón — «Social Funnel» | 11 | **11** | 78.695 |
| Julián Alborna — «Inteligencia Viral» | 41 | **41** | 742.094 |

Ninguna clase sin transcribir. Y esos **742.094 caracteres de un solo gurú** son la prueba de por
qué esto no podía ir en la ficha: ahí viajaría en CADA mensaje de cada chat.

Quedan los pasos 2, 3 y 4: colgarla con `conCapa`, decidir cuándo entra en el turno (copiando el
criterio de Knowledge, que es la parte fina) y el botón del grafo.

⚠️ **CORRECCIÓN AL PASO 3 DE ARRIBA (2/11 ~20:25): la capa de un referente NO lleva el heurístico de
Knowledge, y copiarlo habría sido resolver un problema que acá no existe.**

Knowledge necesita `esPreguntaDeConocimiento` porque va en TODOS los negocios y los nombres de sus
módulos son palabras del negocio: «¿cuál es mi oferta?» no pregunta por el método de armar una. La
capa de un gurú **se cuelga sólo cuando el chat TIENE a ese gurú al frente**, cosa que el servidor
ya sabe (`lib/asesores/contexto.ts`). Si el chat es con Alborna, su curso es pertinente por
definición; si no, la capa ni se arma.

El criterio es **«¿qué referente tiene este chat?»**, no «¿de qué habla la pregunta?»: más barato y
más exacto.

**El punto de enganche exacto:** `lib/cerebro-para-chat.ts` → `armar()`, con `conCapa`, donde hoy se
cuelgan «Lo que hace MaKo» y Knowledge. Y la capa se pide con `cerebroDeReferenteMemo`, que la lee
UNA vez por proceso: sin eso, cada turno abriría los 41 archivos del curso de Alborna.

### ✅ DESPLEGADO Y VERIFICADO EN PRODUCCIÓN — 2/11/2026 ~20:45

`origin/main` = **`90cd7f126`** (run #364 verde). Mirado en hola-mako.com/competitor-spy, no en una
maqueta: **2 tarjetas, las dos tirando de `/asesores/grandes/`, cero carteles «Inspirado en», y la
animación `spy-flota` activa**.

Entró todo lo visible de Spy: caricaturas, movimiento, 600 px, imagen a sangre, «Su web», el @ en el
CRM, el link de la bio, la deduplicación por referente y el link de progreso del ticket. Más el
modal de difusión del CRM, que vino de la sesión de Automations.

⚠️ **Y mirándolo en producción saltó una cosa que la maqueta no mostraba:** una tarjeta decía
**«@AlexHormozi»**. El alta guarda el nombre completo desde hoy, pero **los competidores que YA
estaban se guardaron con lo que se pegó** —un @, o el id de un canal— y esas filas no se arreglan
solas.

**Se arregló al DIBUJAR, no tocando la base** (`nombreDeTarjeta`): el nombre guardado es del negocio
y reescribirlo sería cambiarle un dato sin que lo pida. Y no pisa un nombre que el negocio haya
puesto: «Hormozi (competencia directa)» se respeta tal cual, porque sólo entra cuando lo guardado ES
una de las formas del referente. Con test de las dos mitades.

**La regla que queda:** un arreglo que sólo corre al CREAR no toca lo que ya existe. Si el dato viejo
se ve en pantalla, o se repara la base o se decide al dibujar — pero hay que elegir, porque «lo
arreglé» sobre el camino de alta no arregla lo que el usuario está mirando.

### 📧 EL EMAIL DE AVANCE DEL TICKET — la regla y la migración, 2/11/2026

**Hecho y aplicado en producción:** `0364_ticket_avance_por_email.sql` (columnas `avance_email` y
`avance_email_at` en `tickets`) + `lib/tickets-avance.ts`, con `tests/tickets-avance.test.ts` 7/0
probado rompiéndolo.

**Las dos reglas, que son las que se rompen en silencio:**
1. **Sólo hacia ADELANTE.** Un ticket que rebota entre «en curso» y «esperando cliente» no manda un
   correo por rebote: el tercero va a spam y el cuarto no lo lee nadie. Por eso la columna guarda
   QUÉ hito se avisó y no un booleano.
2. **«cerrado» NO manda correo.** El cierre ya avisa por push, por el chat y por WhatsApp
   (`avisarPendientes`). Un correo más sería el cuarto aviso de lo mismo, y Martín pidió que el
   final siga siendo el WhatsApp que ya existe.

⚠️ **`avisado_at` no se toca**: es del aviso FINAL. Mezclarlos haría que un correo de avance tape el
aviso de cierre.

**FALTA el envío**, y son tres cosas, ninguna difícil:
1. Un camino que mire los tickets cuyo `EstadoCliente` de hoy (`estadoClienteDe`,
   `lib/tickets-reglas.ts:76`) sea posterior a su `avance_email`. ⚠️ **No sirve la consulta de
   `avisarPendientes`**: ésa filtra `estado in ('resuelto','rechazado','duplicado','esperando_cliente')`,
   o sea sólo los finales — justo los que NO son avance.
2. Mandarlo con Resend desde `EMAIL_MAKO` (`lib/app-url.ts`), que es el remitente de la casa.
3. Escribir `avance_email` y `avance_email_at` **después** de que salga, nunca antes: si se marca
   primero y el envío falla, ese hito no se avisa nunca más.
