# Lo que NO se puede hacer dentro de MaKo — el registro

**Qué es esto.** Martín (8/11/2026): *«quiero que vayas anotando todo este feedback para luego
implementarlo en la aplicación. Todo lo que no se puede hacer dentro de MaKo deberías ir
anotándolo para luego corregirlo dentro de la app»*.

**La regla:** cada vez que usando MaKo hay que salirse de MaKo —abrir una terminal, tocar la base,
pedirle algo a Martín, o simplemente darse por vencido— **eso se anota acá en el momento**, con lo
que se intentó y qué lo frenó. No es un changelog ni una lista de bugs: es la lista de **huecos del
producto**, vistos usándolo.

Una entrada por hueco. Si se arregla, se marca ✅ con su commit y se deja: saber que estuvo roto
explica decisiones posteriores.

---

## 🔴 AI Avatar: no se puede crear ni guardar un preset propio

**Qué quería hacer.** Replicar el formato de un reel concreto (el de Josep Casas, «planto
pistachos»): tomas caminando en un lugar real alternadas con planos heroicos a contraluz y el
nombre en tipografía gigante. Ninguno de los presets del catálogo es eso.

**Qué lo frena.** El catálogo vive **cableado en `lib/ai-avatar/plantillas.ts`** (una copia de la
galería de Higgsfield). Y **AI Avatar NO está en `lib/creaciones-enchufes.ts`**, así que no tiene
`usePlantillasPropias(tipo)` ni el `<ModalGuardarPlantilla>` del menú «⋯» — los que Copywriter e
Image sí tienen. O sea: **la pieza ya existe en la casa y a esta tab no se le enchufó.**

**Qué hace falta.** Sumar AI Avatar como un enchufe más en `creaciones-enchufes.ts` con su
`paraPublico`, el modal de guardar en el «⋯» y `usePlantillasPropias` en el selector de presets.
Entonces una escena nueva se guarda y se reusa, en vez de tener que tocar código.

---

## 🟠 AI Avatar: «MaKo está subiendo tu foto a Google. Vuelve a intentar»

Al generar la primera imagen, la pantalla pide **reintentar a mano** mientras sube la foto al Flow
del cliente. Es una espera que la app conoce: debería encolar el pedido y avisar cuando está, no
devolverle el trabajo al cliente. Un «vuelve a intentar» es un pedido perdido si nadie vuelve.

---

## 🟠 El checklist del puente dice el motivo equivocado

Con Flow **abierto y con sesión**, el paso 3 seguía diciendo «Abre Google Flow con tu cuenta, desde
el ícono de MaKo». La causa real era otra: **la extensión instalada era vieja** (0.74.4) y no
reconocía `flow.google.com`, así que caía al camino REST de `labs.google` y pedía un token que esa
página nunca da. El dato estaba en la base (`flow_puentes.version`) y la pantalla no lo usaba.

**Qué hace falta.** Que el checklist compare la versión que reporta el puente contra la mínima que
el server necesita, y diga «tu extensión está desactualizada» en vez de mandar a abrir algo que ya
está abierto. Un cartel que pide lo que ya se hizo es peor que ninguno.

---

## 🟠 La extensión cargada descomprimida pierde el emparejamiento, y MaKo no lo dice

Cargar la extensión desde una carpeta le da **otro id de Chrome** y almacenamiento vacío: se pierde
el token del paso 2. MaKo lo vive como «no hay extensión» y repite «instala la extensión», cuando
en realidad hay una instalada y lo que falta es volver a conectarla.

**Qué hace falta.** Detectar «hay extensión pero no está emparejada» y ofrecer «Conectar» en vez
del cartel de instalar.

---

## 🔴 Un competidor se puede dar de alta sin ningún canal, y queda muerto

Se pueden crear competidores con **sólo el nombre** —sin Instagram, YouTube, TikTok ni web—. Para
la biblioteca de anuncios el nombre alcanza, pero para contenido no hay de dónde leer, y la ficha
se abre **vacía y sin decir por qué**: se lee como «se rompió». Pasó con 17 en el ws 9.

**Qué hace falta.** O exigir un canal en el alta, o que la ficha vacía diga qué le falta a ese
competidor para poder leerse.
