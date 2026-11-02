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

## ⚠️ LO PRIMERO: NADA DE ESTO ESTÁ DESPLEGADO TODAVÍA

A las 03:30 del 2/11, `origin/main` seguía en `8a60cd310` con **12 commits esperando** en
`integracion`. Dos motivos, y los dos son míos:

1. **Pushear por ítem CANCELA el run anterior** (`concurrency: integracion`). Lo escribí en el
   tablero y lo hice igual nueve veces seguidas: cada push mataba el chequeo del anterior, así que
   ninguno llegaba a terminar. **La regla de verdad: se junta y se pushea UNA vez, y después se
   espera.** No sirve pushear por ítem si el efecto es que no se despliega ninguno.
2. **El run #335 falló de verdad**, no por cancelación: `tests/guia-catalogo.test.ts` exige que
   todo lo que está en `SIN_GUIA_TODAVIA` siga siendo una tab, y yo saqué `offer` y `ads-manager`
   de la barra sin sacarlos de esa lista.

**Antes de pushear otra vez:** correr a mano los tests de lo tocado. Lo que se rompió esta vez no
lo veía ningún test de Spy — lo veía un guard del catálogo de guías.

### ⛔ Por qué Offer y Ads Manager volvieron a la barra (2/11 ~04:30)

Sacarlos de `app/_components/nav.ts` es UNA línea, y rompe **seis** tests:
`estrategia-tab`, `funciones-mako`, `knowledge-modulos`, `movil-mas-secciones`, `movil-rutas` y
`offer-en-create`. El más claro es `funciones-mako`: «cada key viva del nav es de exactamente una
función, y ninguna función nombra una key que no existe». Esas dos keys **no viven sólo en la
barra** — las nombran el catálogo de funciones de la API de MaKo, las rutas del móvil, los módulos
de Knowledge, Create y Estrategia.

**Se revirtió porque tenerlas afuera a medias dejaba 12 commits buenos sin poder desplegarse.**
El pedido sigue en pie; lo que cambia es que es un trabajo propio: hay que mudar cada consumidor a
donde vivan ahora (el Funnel Coach y Hormozi, adentro del Ops Center), no borrar una línea.

## Estado

| | Ítem | Estado | Commit |
|---|---|---|---|
| 1 | Spy visible para todos (tenía `adminOnly`) | **HECHO** | `91bcafb09` |
| 1b | **Que además FUNCIONE para todos** (las acciones pedían admin) | **HECHO** | mirar y agregar: cualquiera. Borrar: sólo el admin |
| 2 | Offer y Ads Manager fuera de la barra | **REVERTIDO** | rompe 6 tests: esas keys las nombran el catálogo de la API, el móvil, Knowledge, Create y Estrategia. Es un trabajo propio, ver abajo |
| 3 | Miniaturas de IG: `referrerPolicy` + respaldo | **HECHO** | `91bcafb09`, y reemplazado por #4 |
| 4 | **Descargar y GUARDAR la miniatura** | **HECHO** | bucket `spy-miniaturas` (0361) + `lib/spy-miniaturas.ts`. Migración YA APLICADA en prod |
| 5 | **YouTube: que traiga los videos LARGOS** | **HECHO** | pagina la playlist y le reserva cupo a los largos |
| 6 | **Lista de competidores en tarjetas con caricatura** | **HECHO** | la cara es su foto de perfil, bajada (0362) |
| 7 | **Borrar competidor desde la lista** | **HECHO** | el botón vive en la tarjeta |
| 7b | **Deduplicar el alta** (por eso hay 3 «Sofia Contreras») | **HECHO** | deduplica por canal y por nombre comparable |
| 8 | **Rediseñar el modal de «Mirar a alguien más»** | pendiente | |
| 9 | **Con el @ traer el perfil** (Apify), en Spy y en el CRM | pendiente | |
| 10 | **Con un dato, traer todas sus redes** + landing/funnel de la bio | pendiente | |
| 11 | **Validar con el usuario** cada red encontrada antes de guardar | pendiente | |
| 12 | **Pasar de 50 publicaciones** (vista con todas / elegir con la extensión) | pendiente | tope en `lib/spy-reglas.ts:479` |
| 13 | **Spy compartido entre usuarios** | pendiente | la decisión ya está tomada, ver abajo |
| 14 | **Los 12 referentes** (fichas + caricaturas) | pendiente | los 12 cursos ya localizados |
| 15 | **El diseño de la tab principal de gurús** (no el detalle) | pendiente | |
| 16 | **Elegir un gurú desde «nuevo chat»** | pendiente | hoy sólo `funnel` y `offer` |
| 17 | **Base de conocimiento por gurú** | pendiente | |
| 18 | **Botón de Second Brain por gurú** | pendiente | las piezas ya existen |
| 19 | **Modal de «mensaje de difusión» del CRM** con formato por red | pendiente | |
| 20 | **Instalar extensión: sacar la descarga** | pendiente | `Pasos.tsx:76-83` |
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
