# El Centro de Operaciones: una sola pantalla para las tres cuentas

Pedido de Martín (15/10/2026), después de preguntar si se podía armar adentro de MaKo:

> «Crea ese centro de operaciones, es lo más prioritario de todo… Que no solamente se conecte a
> las 3 cuentas, sino que pueda gestionar el USO y advertir cuando se está acercando al límite…
> Que gestione solo el guardado de contexto para las demás cuentas y que también se preocupe por
> ahorrar tokens, por ejemplo si mando una tarea fácil, que le diga a los chats qué modelo de IA
> deben usar… que pueda tener una funcionalidad de ventana emergente o algo así del chat, y que yo
> le pueda indicar QUÉ quiero cambiar como si estuviera eligiendo elementos dentro de cada tab,
> como si estuviera con F12… Fíjate que todo el tiempo te estoy pasando capturas, esto lo evitaría…
> Tal vez incluso que organice los chats para cada cuenta… Así les cuesta menos contexto.»

**Qué resuelve, en una frase:** hoy para trabajar hay que estar sentado en la app de Claude, con
una cuenta por vez, mandando capturas de pantalla para explicar qué hay que cambiar. Con esto se
manda trabajo desde MaKo —también desde el teléfono—, se ve cuánta cuota queda en cada cuenta, y
se señala un elemento de la pantalla en vez de describirlo.

---

## 0. Lo que NO puede hacer, antes de entusiasmarse

Esto vale más que la lista de funciones, porque es lo que decide si sirve:

- **MaKo no puede iniciar una cuenta de Claude.** Las credenciales viven en la máquina de Martín,
  no en la nube. El Centro **encola**; quien entrega es un agente que corre en su PC.
- **Si la PC está apagada, la cola espera.** No es un servicio: es un buzón con un cartero.
- **Las sesiones tienen que estar abiertas.** Un chat cerrado no recibe nada; el Centro lo muestra
  como «no disponible» en vez de tragarse el pedido.
- **El % de cuota no se puede leer desde un servidor.** Lo contesta una herramienta que sólo existe
  dentro de una sesión de Claude: el agente local lo pide y lo sube. O sea que el número que se ve
  **siempre tiene una fecha**, y la pantalla la muestra.

---

## 1. Las tres piezas

| Pieza | Dónde corre | Qué hace |
|---|---|---|
| **La pantalla** | MaKo, `/admin/operaciones`, sólo super admin | escribir el pedido, elegir cuenta y chat, ver el estado y la cuota |
| **El cartero** | la PC de Martín, como el vigía de RAM | lee la cola, entrega a la sesión, devuelve acuses, sube el uso |
| **El señalador** | adentro de MaKo, en cualquier tab | elegir un elemento y que el pedido viaje con su ubicación |

Las tres son independientes: la primera sin la segunda ya sirve para dejar pedidos; la tercera se
puede sumar después.

---

## 2. Mandar un pedido (el corazón)

1. En `/admin/operaciones` se escribe el pedido, se elige **a qué chat** y **con qué cuenta**, y se
   guarda. La fila queda `en cola`.
2. El cartero, que corre en la PC, la toma y se la entrega a la sesión correcta —es el mismo
   mecanismo con el que los chats se hablan entre ellos hoy— y la marca `entregada`.
3. El chat contesta donde contesta siempre: la Ticketera, el repo, un push. El Centro muestra el
   acuse («entregado a Video Editor, 01:42») y el link a lo que haya quedado.

**Reglas que no se negocian**, y son las de la casa:

- **Sólo super admin.** Es una puerta a la máquina de Martín: `getSesionAdmin()` en la primera línea
  de cada acción, y la ruta fuera de `PUBLICOS`.
- **El cartero no abre puertos.** Él consulta a MaKo cada pocos segundos; nadie entra a la PC desde
  afuera. Un puerto abierto en la máquina donde viven tres cuentas de Claude no se abre nunca.
- **Un pedido se entrega UNA vez.** Se reclama con un `update … where estado='en cola'` antes de
  entregarlo, como ya se hace con las pendientes de la API: dos carteros o un reintento no pueden
  mandar dos veces lo mismo.
- **Lo que no se pudo entregar lo DICE**, con el motivo (sesión cerrada, cuenta sin cuota). «No pasó
  nada» y «no se pudo» son dos respuestas.

---

## 3. La cuota de las tres cuentas

El cartero sube, cada vez que pasa, lo que ya existe en el disco:

- `~/.claude/uso-semanal.txt` — el % semanal, con su fecha y **la cuenta** (el archivo lo comparten
  las tres: un número sin cuenta no vale).
- `~/.claude/cuentas.tsv` — quién es cada cuenta.
- `~/.claude/bitacora-sesiones.tsv` — qué sesiones abrieron y cerraron.

Con eso la pantalla muestra, por cuenta: el %, cuándo se midió y cuándo resetea. Y **avisa al 85, 90
y 95%**, que son los umbrales que los hooks ya usan.

⚠️ **El dato envejece.** El % lo mide una sesión cuando se le pide; si la última medición tiene dos
horas, la pantalla dice «hace 2 h», nunca el número pelado. Esto ya mordió: una sesión obedeció un
98% que era de otra cuenta y cortó trabajo que no había que cortar.

**Lo que el Centro hace con eso** (pedido de Martín, «que gestione solo el guardado de contexto»):

- Al cruzar el 85% de una cuenta, **encola solo** un pedido a cada chat de esa cuenta: «escribí tu
  relevo y commitealo». Es la orden que hoy da un hook, y que a veces llega tarde.
- Al 95%, además, propone el reparto a las otras dos cuentas.

---

## 4. Ahorrar tokens: que el Centro diga con qué modelo

Pedido textual: «si mando una tarea fácil, que le diga a los chats qué modelo de IA deben usar».

- Cada pedido lleva un **tamaño**: `chica`, `normal`, `grande`. La pantalla lo pregunta con tres
  botones, no con un desplegable de modelos — el que manda no tiene por qué saber nombres.
- El cartero lo traduce a lo que la sesión entiende: para una tarea chica, baja el modelo y el
  esfuerzo de esa sesión antes de entregar el pedido; para una grande, los deja como están.
- **El default es el de la sesión.** Si el Centro no dice nada, no se toca nada: una herramienta de
  ahorro que degrada por descuido es peor que no tenerla.

---

## 5. El señalador: elegir un elemento en vez de mandar una captura

Esto es lo que más tiempo ahorra y lo que más fácil es de sobrediseñar. **No hace falta ningún
plugin de build ni ninguna extensión**: MaKo puede inspeccionarse a sí misma.

- Se prende «Señalar» desde el Centro (o con un atajo). Queda una capa encima, sólo para super
  admin, que resalta lo que está debajo del cursor.
- Al hacer clic, el elemento se agrega al pedido como un **chip azul con lo que la persona ve** («el
  título "Ventas del mes"»), y por debajo viaja lo que el chat necesita para encontrarlo:
  - la ruta de la pantalla (`/general?tab=…`),
  - el texto exacto del elemento,
  - **sus clases propias de la casa** (`.mazo-carta`, `.gen-pieza`, `.lk-comp--general`), que en este
    repo son únicas y llevan al archivo con un grep,
  - el camino desde la raíz (`main > section.mazo > article.mazo-carta > h2`),
  - y el tamaño y la posición, que es lo que suele estar en discusión.
- El chip se borra como cualquier texto, y se pueden señalar varios.

⚠️ **Por qué NO se manda «archivo:línea»**: eso existe en desarrollo (React lo guarda) y **no** en
producción, que es donde Martín mira. Hacerlo andar en producción obliga a marcar cada elemento en
el build, que pesa en el bundle de todos los clientes. Las clases de la casa resuelven el 90% del
problema con cero costo. Si algún día hace falta la línea exacta, se agrega el marcado **sólo** para
el super admin.

---

## 6. Repartir los chats entre las tres cuentas

Pedido: «que organice los chats para cada cuenta… así les cuesta menos contexto».

El reparto **no es software**: es una convención escrita y el índice que ya existe
(`docs/relevo/chats.md`). Lo que el Centro aporta es mostrarlo y respetarlo al elegir a quién mandar
un pedido.

Propuesta de reparto, por afinidad (los chats que comparten código y se pisan menos):

| Cuenta | Chats | Por qué |
|---|---|---|
| 1 | Video Editor, Image Editor, Web Generator, Ads Manager | los editores: comparten el lienzo, los medios y la API de creación |
| 2 | Dashboard, General, Plan, CRM, Pagos | el tablero y el dinero: comparten `EditorInforme`, el board y las tablas del CRM |
| 3 | Automations, Ciberseguridad, Customer Success, Offer, Leads Scraper | el motor y la plataforma: comparten el registro de la API y los avisos |

Dos cosas que lo hacen funcionar:

- **Un área, una cuenta.** Lo que ahorra contexto no es la cantidad de chats: es que cada cuenta vea
  siempre el mismo código y no tenga que releer medio repo.
- **El reparto se escribe en `docs/relevo/chats.md`**, que es lo único que las tres cuentas ven
  igual. Si vive sólo en la cabeza de alguien, en dos días no se cumple.

---

## 7. Qué tiene que hacer Martín

1. **Abrir un chat nuevo** dedicado («Centro de Operaciones»). Ningún chat vivo tiene lugar para
   esto y repartirlo entre dos es cómo se construye una pieza con dos dueños.
2. **Dejar las sesiones abiertas** de los chats que quiera que reciban pedidos. Un chat cerrado no
   recibe.
3. **Para la cuenta 3**: entrar una vez, con su propio directorio de configuración, y declararla.
   Son los cuatro pasos de [dos-cuentas.md](dos-cuentas.md): la línea en la tabla de titulares, el
   marcador de cuenta activa, el enlace de las memorias y el índice de chats.
4. **Nada más.** No hay que instalar nada ni abrir ningún puerto: el cartero se instala como el
   vigía de RAM, que ya corre.

---

## 8. Por dónde empezar (y qué NO hacer primero)

| Etapa | Qué queda andando | Cuánto pesa |
|---|---|---|
| 1 | La cola: escribir un pedido, elegir chat y cuenta, y que llegue | el corazón; sin esto nada sirve |
| 2 | La cuota de las tres cuentas, con su fecha y los avisos | barato: los datos ya están en el disco |
| 3 | El señalador | medio; es lo que más tiempo ahorra por día |
| 4 | El tamaño de la tarea → el modelo | barato, pero inútil sin la 1 |
| 5 | El relevo automático al 85% y el reparto por cuenta | lo último: necesita que las demás estén probadas |

**Lo que no hay que hacer primero:** las respuestas de los chats dentro del Centro. Es lo más
vistoso y lo menos necesario — las respuestas ya llegan por la Ticketera y por el repo, y mientras
el Centro no sea confiable para MANDAR, mostrar respuestas es decorar una puerta que no abre.

---

## 9. Lo que hay que decidir (va a la Ticketera)

1. **Si el Centro puede cambiar el modelo de una sesión** o sólo sugerirlo en el texto del pedido.
2. **Si el relevo automático al 85% se manda solo** o queda como una propuesta que Martín confirma.
3. **El reparto de chats por cuenta**: si se toma el de arriba o lo arma él.
