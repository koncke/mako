# MaKo Mobile v2 — el rediseño

<sub>Pedido de Martín (11/10/2026), después de rechazar la v1 en producción: «Estilo app nativa, pero
sin perder el diseño que ya hicimos en MaKo». Las decisiones que ya tomó están en
[relevo/mako-mobile.md](relevo/mako-mobile.md) → «EL REDISEÑO PEDIDO» y no se rediscuten aquí. Este
documento dice CÓMO se cumplen. Prototipo navegable: [prototipos/mako-mobile-v2.html](prototipos/mako-mobile-v2.html).
Las decisiones técnicas de la v1 (PWA, guards, push, `/m/*`) siguen en
[diseno-mako-mobile.md](diseno-mako-mobile.md); lo visual de ese documento queda reemplazado por este.</sub>

## La idea en una frase

**La estructura es la de una app de iPhone; la piel es la de MaKo de escritorio.** Título grande,
listas agrupadas como Ajustes, sheets que suben desde abajo y una barra de cinco destinos; todo en
claro, con los tokens de `app/globals.css`, Geist, la tarjeta de la casa (borde 1 px `--border`,
radio 14) y el azul de acción. El dorado aparece sólo donde MaKo hizo o propone algo.

| | v1 (rechazada) | v2 |
|---|---|---|
| Tema | header y barra oscuros (`--sidebar`) siempre | claro entero; oscuro sólo si la persona lo elige |
| Logo | una chispa genérica del set, al centro de la barra | el `MakoLogo` real, 28 px, arriba a la izquierda de Today y en la fila de MaKo |
| Barra | Today · Inbox · **MaKo** · CRM · Plan | Today · CRM · Inbox · Plan · More |
| Encabezado | título-frase («Te esperan 2 aprobaciones…») y «Actualizado hh:mm» flotando | el nombre de la sección en grande; nada más |
| Secciones | seis | las diez pedidas, más MaKo y Cuenta |

## La barra inferior

**Today · CRM · Inbox · Plan · More.** Cinco, nunca más (regla de la casa y de iOS).

- **Inbox al centro**: es la cola de lo que espera una decisión tuya, y el centro es donde llega el
  pulgar sin estirarse. Lleva un número (azul, `--primary`) sólo con lo que bloquea.
- **More** abre una lista agrupada estilo Ajustes:
  1. Tu cuenta (avatar, nombre, negocio) → sheet con avisos, apariencia y cerrar sesión.
  2. Dashboard · Ads Manager · Customer Success · Automations.
  3. Video Generator · Landing Generator.
  4. MaKo (el chat), con el logo real como ícono.
  5. Versión de computadora.
- Ícono de línea del set de la casa + nombre de 12 px debajo. Activo: azul y peso 600 (la regla
  «el activo no depende del dorado»). Inactivo: `--faint`.
- Fondo `--surface` con filete `--border` arriba. Sin blur (veto de la casa: el blur decorativo).
- Los destinos se filtran por rol con la misma regla del Sidebar (`lib/movil-rutas.ts`): si a un rol
  le falta uno de los cinco, el lugar lo toma el primero de More que sí vea.
- Dos íconos nuevos para el set (`app/_ui/iconos-menu.tsx`): **bandeja** (Inbox) y **computadora**
  (lo que queda en escritorio). More usa el `mas` del set con los puntos rellenos.

## El encabezado

El patrón nativo de títulos grandes:

- Arriba, una barra de 44 px (+ el área segura) con a lo sumo **un control a cada lado**: volver a la
  izquierda («‹ CRM», con el nombre de la pantalla anterior), una acción a la derecha (filtrar, la
  cuenta). Debajo, el **título grande**: 32 px, 700, tracking −0,025 em.
- Al hacer scroll el título grande se va con el contenido y aparece el chico (17 px) centrado en la
  barra, con un filete de 1 px. Sin fondo translúcido: la barra es `--bg`.
- **El logo**: sólo en Today, 28 px, arriba a la izquierda, en la barra (no al lado del título). Y en
  la fila «MaKo» de More. En ninguna otra pantalla.
- Pantallas de trabajo (el editor de video, el de landings, el chat): sin título grande; el nombre va
  en la barra desde el principio y la tab bar se esconde.
- Nada flotando al lado del título: ni «Actualizado», ni pills, ni fecha arriba (eso es una cejilla).
- **Plataforma**: con el header claro, `appleWebApp.statusBarStyle` pasa de `black-translucent` a
  `default` (texto oscuro), y `themeColor` a `--bg` (#F4F6F9). ⚠️ En iOS instalada, `default` pinta su
  propia franja de la barra de estado; si en un iPhone real se nota contra `--bg`, la barra superior
  va en `--surface`. Se mide en el teléfono, no en el emulador.

## Tipografía y espaciado

Geist y la escala móvil que ya existe (`[data-m]` en globals.css). Un solo token nuevo.

| Uso | Token | Tamaño / peso |
|---|---|---|
| Título grande de pantalla | **`--m-titulo` (NUEVO)** | 32 / 700 |
| Título de sección, título de sheet | `--fs-sect` | 20 / 600 |
| Nombre en una fila, título de tarjeta | `--fs-card` | 16,5 / 600 (500 en filas de navegación) |
| Texto base, valores | `--fs-md` | 16 / 500 |
| Segunda línea | `--fs-sm` | 14,5, `--dim` |
| Hora, conteos, metadata | `--fs-meta` | 13, `--dim`, `tabular-nums` |
| Rótulo de la tab bar | — | 12 / 500 |

- Por qué 32 y no `--fs-page` (26): a 26 el título se lee «página web»; iOS usa 34. 32 es grande sin
  romper títulos largos («Customer Success» entra en una línea a 390 px).
- Márgenes: 16 px a los lados de las listas, 20 px para títulos; 28 px arriba de cada sección y 10
  debajo de su título (más aire arriba que abajo). Filas de 56-64 px. Todo control ≥ 44 px.
- Inputs a 16 px (si no, iOS hace zoom).

## Tarjetas, listas y estados, en claro

- **La lista agrupada es la pieza base**: una caja `--surface`, borde `--border`, radio `--r-lg`,
  sobre `--bg`. Adentro, filas con filete de 1 px que arranca después del avatar o del ícono (como
  Ajustes). Anatomía de la fila = la de `.mk-fila`: [avatar o ícono] nombre + una línea · riel derecho
  (hora, conteo) · chevron sólo si abre algo.
- **Una tarjeta suelta sólo para lo que bloquea** (en Today: «Enviar 3 seguimientos», con la estrella
  de MaKo y un botón grande). Nunca una pila de tarjetas iguales, nunca tarjetas dentro de tarjetas.
- **Píldoras de estado**: punto de color + texto en tinta (`--dim`), sobre `--surface-2`. ⚠️ El verde
  y el rojo como TEXTO no pasan AA a 13 px (`--good` 3,45:1 y `--bad` 4,26:1 sobre blanco, medido):
  el color va en la marca (punto, flecha, barra) y el texto queda en tinta. Lo mismo para las
  variaciones del Dashboard: flecha de color + número en `--dim`.
- **Links sobre `--bg`** en `--primary-strong` (5,27:1); `--primary` da 4,20:1 sobre el gris de fondo.
- **Botones**: los de `app/_ui` en grande (50 px, ancho completo en sheets). Azul = la acción;
  secundario con borde; terciario como texto azul; **dorado = se lo pides a MaKo** (crear un anuncio,
  «Conclusiones con MaKo», reescribir una sección). Un solo primario por pantalla, abajo.
- **La consecuencia va pegada arriba del botón, en tinta**: «Salen ahora por WhatsApp a 3 personas.»
  → «Enviar 3 mensajes» / «No enviar». Nunca «Sí / No / Aceptar / Cancelar».
- **Sheets**: radio 18 arriba, agarradera, título y cerrar (✕) arriba; cuerpo con scroll; el pie
  fijo con consecuencia + botón. Se cierran arrastrando, tocando el velo o con ✕. Nunca apilados.
- **Toast**: 3-4 palabras + «Deshacer» si es reversible, sobre la tab bar.
- **Presión**: `scale(.97)` en botones y velo `--velo-hover` en filas al tocar; hover sólo con
  `(hover: hover) and (pointer: fine)`.
- **Movimiento**: entrar a una pantalla desliza desde la derecha (320 ms, `--ease-drawer`); cambiar de
  tab no anima; con movimiento reducido, fundido.
- Avatares: las iniciales de `Marca.tsx` (fondo teñido de azul, letras `--primary-strong`).

## Qué texto se elimina

- «Actualizado hh:mm» al lado del título. El refresco es solo (al volver al frente) y por gesto.
- Los títulos-frase («Te esperan 2 aprobaciones y 3 llamadas»): el título es el nombre; el número
  va en el badge o en la sección.
- Subtítulos y bajadas debajo de títulos, en pantallas y en sheets.
- Las segundas líneas que no distinguen una fila de otra (si dice lo mismo en todas, se va).
- Las pills que no deciden nada («Nuevo» en cada aviso, «MaKo» en cada fila).
- El botón grande «Abrir en la computadora» repetido en cada pantalla: queda UNA fila gris al final
  («Pagos, historial y campos · En la computadora»).
- Explicaciones de criterio («por qué esta tarea y no otra»): al detalle o al código.
- La estrella de MaKo «porque sí»: sólo donde MaKo hizo o propone algo.

## Por sección

**Today** — *muestra*: lo que bloquea (una tarjeta, si hay), las reuniones de hoy con la hora en
grande, «Para hoy» (las 3 primeras del plan con su casilla) y el trimestre en una fila (lo cobrado,
la barra contra el tiempo y «US$ 620 arriba»). Se compone por rol como en la v1. *Deja*: abrir la
decisión, tocar una reunión → la ficha, completar una tarea con Deshacer. *Computadora*: editar el
objetivo y los KPIs, el semáforo completo.

**Inbox** — *muestra*: un segmentado «Para decidir · N | Avisos». Cada decisión es una fila con la
estrella si la propuso MaKo. *Deja*: abrir la decisión en un sheet que MUESTRA todo lo que se va a
ejecutar (los 3 mensajes, el cambio de etapa con el pago) y aprobarla o no. *Computadora*: lo que se
revisa con un formulario grande (borradores del plan, tablas de leads): el sheet lo dice y ofrece
abrirlo en la computadora.

**CRM** — *muestra*: buscador, y tres grupos: Hoy (con hora), Por responder (con el último mensaje),
Nuevos. Filtro por etapa en un sheet. *Ficha*: avatar grande, nombre, etapa y producto; tres botones
grandes (Llamar, WhatsApp, Agendar); datos (próxima llamada, etapa, teléfono, origen); notas con «Nota
por voz»; actividad. *Deja*: llamar, leer y responder el WhatsApp, agendar con horarios libres
(«Agendar mañana, 10:00» / «Le llega la invitación a Camila.»), mover de etapa con Deshacer, dictar una
nota. *Computadora*: pagos, cuotas, tracking, historial completo, editar campos, el kanban, el wizard
de etapas, importar.

**Plan** — *muestra*: segmentado Hoy · Semana · Prioridades; filas con casilla redonda, el proyecto
como punto de su color y el plazo. *Deja*: completar con Deshacer, ver el detalle. *Computadora*: el
tablero, crear y editar proyectos, debatir la prioridad con el Perro.

**Dashboard** — *muestra*: las dos hojas del informe inicial como segmentado (Marketing | Comercial),
UN gráfico por hoja (leads por día; cash por semana) con el valor del día tocado arriba, y la lista de
números con su variación (Ad Spend, Leads, CAC real, ROAS cash, ROAS sold / Sold Revenue, Cash
Collected, Outstanding, Cierres). En Comercial, «A quién cobrarle». *Deja*: cambiar el período,
tocar una barra, **«Marcar cobrado»** con Deshacer (ya existe en escritorio). *Computadora*: editar el
tablero, hojas nuevas, exportar, el AI Analyst. Las hojas personalizadas se ven, pero en la forma fija
del teléfono (un gráfico + la lista), no con su layout.

**Ads Manager** — *muestra*: período (Hoy · 7 días · Este mes), el resumen en tres filas (Importe
gastado, Resultados, Coste por resultado) y las campañas con su interruptor, agendas y presupuesto;
«Con problemas · N» como píldora. *Deja*: prender o pausar (Deshacer), cambiar el presupuesto diario en
un sheet con +/− («Poner US$ 70/día» / «No cambiar», «Meta empieza a gastar el monto nuevo hoy.»), ver
por qué un anuncio no entrega y pedir la revisión en Meta, «Conclusiones con MaKo» (abre el chat).
*Computadora*: crear campañas, conjuntos y anuncios, subir creativos, públicos, textos, conjuntos y
anuncios por separado.

**Customer Success** — *muestra*: el kanban como lista agrupada por etapa (una sección por columna,
con su conteo); cada cliente con empresa y tiempo en la etapa; «21 días sin moverse» con punto rojo.
*Deja*: abrir un cliente en un sheet, pasarlo a la siguiente etapa (o a otra) con Deshacer, escribirle
por WhatsApp, reenviar la invitación al curso. *Computadora*: editar etapas, el curso, la comunidad, los
permisos, la ficha completa (pagos, llamadas, historial).

**Automations** — *muestra*: la lista con su disparador en una línea («Cuando llega a «Agendado»») y el
interruptor; «Sin publicar» como píldora naranja. *Deja*: prender o pausar, abrir una en un sheet con
sus números de 30 días (Enviados, Respuestas, Leads en curso, los de `/chat-analyst`) y sus pasos en
LECTURA; «Publicar los cambios» / «Descartar los cambios», «Probar en mi WhatsApp». *Computadora*:
editar el lienzo, crear automatizaciones, «Pídeselo a MaKo».

**Video Generator (reducido)** — *muestra*: «En curso» y «Terminados». Abrir uno lleva a la pantalla
de trabajo: el video 9:16 sobre fondo oscuro, la tira de tomas con su estado (Lista ✓, Filmando, No
salió ✕), y la toma elegida con lo que dice. *Deja*: reproducir, elegir una toma, **filmar de nuevo
una toma** con el costo pegado («Filmar de nuevo cuesta 12 créditos.»), cambiar lo que dice una línea
(«Guardar y filmar de nuevo»), ver el anuncio entero y **descargarlo**, y desde la lista «Crear mi
anuncio» (dorado). El único primario cambia con el estado: arreglar la toma que falló → ver el
anuncio entero → descargarlo. *Computadora*: «Ajustar los cortes», el prompt, sumar o quitar tomas,
instalar la extensión.

**Landing Generator (reducido)** — *muestra*: la lista de landings con visitas y leads de 30 días y
su estado (Publicada, Borrador). Abrir una muestra la página como una columna de secciones. *Deja*:
tocar una sección → sheet con su título editable, las acciones de MaKo (Mejorar la escritura, Acortar,
Simplificar, Otro diseño), reemplazar la imagen; «Publicar cambios» abajo (apagado si no hay cambios);
copiar el enlace público. *Computadora*: reordenar y agregar bloques, el tema, columnas, HTML, exportar,
dominio y SEO, varias páginas.

**MaKo (dentro de More)** — el chat, igual que en la v1 (dictado, nota de voz, propuestas que se
aprueban en el hilo), pero ya no es un destino de la barra. También se llega desde un «Conclusiones con
MaKo» contextual.

## Lo que el relevo encontró, y cambia el alcance

Medido leyendo el código el 11/10/2026 (tres lectores):

- **`/video-generator` no es un editor tipo CapCut**: es un wizard (formato → guion → lugar → avatar →
  tomas → montaje). El CapCut existe en la rama `video-editor` (worktree `C:/dev/wt-video-editor`),
  **sin mergear**. La versión reducida de arriba se apoya en lo que está en `main` (`PasoTomas.tsx`,
  sus estados y sus costos), que es lo que el teléfono puede hacer de verdad.
- **El editor tipo Gamma tampoco está en `main`**: vive en el worktree `wt-gamma` (rama
  `gamma-editor`). En `main`, `/landing-generator` es el generador viejo. Las imágenes por Google Flow
  todavía no existen. Su IA corre en Gemini gratis: no hay costo que mostrar.
- **Filmar desde el teléfono depende del Chrome de la computadora**: la cola se arma en el server,
  pero la que filma es la extensión. Sin ese Chrome abierto, el teléfono encola y nada se mueve. No
  verificado.
- **Ads Manager no tiene recomendaciones de MaKo para aprobar**: las que hay son de Meta («Analizar con
  Meta», «Aplicarla en Meta ↗»). El prototipo no inventa una.
- **Automations no muestra números**: viven en `/chat-analyst` (`DashboardChatAgent.tsx`). El sheet del
  teléfono los trae de ahí.
- **Customer Success sacó la señal «en riesgo»** el 26/09; queda el chip de «21 días sin moverse» y el
  «Riesgo alto» de las llamadas. El teléfono usa el chip.

## Vetos revisados

Contra impeccable (craft-floor), la casa y las skills: sin cejilla sobre títulos · sin pila de
tarjetas iguales (listas con filete; una sola tarjeta para lo que bloquea) · sin número gigante con
label (los números van en filas) · sin texto menor a 12 px · nada flotando junto al título · sin
gradiente en texto, sin blur decorativo, sin borde lateral de color · sin emojis como íconos · sin
mono como disfraz · sin scroll lateral en la navegación (la tira de tomas es contenido) · cinco
destinos · sin FAB · sheets sin apilar · todo copy en español neutro con tú (barrido de voseo: cero).

## El prototipo

`docs/prototipos/mako-mobile-v2.html`: autocontenido (sólo Geist de Google Fonts), un teléfono de
390×844 en computadora y pantalla completa en un teléfono. Se navega con la barra; en computadora, la
columna de la izquierda salta a cada pantalla. Pantallas: Today, Inbox, CRM y la ficha, Plan, More,
Dashboard, Ads Manager, Customer Success, Automations, Video Generator con el editor reducido, Landing
Generator con su editor reducido, MaKo y la cuenta (con el cambio a oscuro). Datos de ejemplo, ninguno
real. Los tokens son copia de globals.css; los nuevos están marcados «NUEVO». Publicado (privado,
para abrir en el teléfono): https://claude.ai/artifact/DiP5DFkdjk5BWzC1khhVa3 — la copia publicada
es el mismo archivo sin `<!doctype>`/`<head>`/`<body>`. ⚠️ No se miró en un navegador: la máquina no
tuvo los 5 GB libres que exige la regla para levantar Chrome; se validó la sintaxis del script y el
balance de etiquetas.

## Antes de implementar, tres preguntas

1. **Video y Landing: ¿se hacen sobre lo que está en `main` o se espera a mergear el CapCut
   (`video-editor`) y el Gamma (`wt-gamma`)?** El prototipo usa lo de `main`; si se mergean primero, la
   versión reducida cambia de base.
2. **¿Se puede gastar créditos de Flow desde el teléfono** («Filmar de nuevo cuesta 12 créditos»),
   sabiendo que sólo filma si el Chrome con la extensión está abierto en la computadora? Si la
   respuesta es no, el teléfono sólo mira, cambia el texto y descarga.
3. **Ads Manager en el teléfono, ¿sólo lo que ya existe** (prender/pausar, presupuesto, ver por qué no
   entrega) **o quieres que MaKo proponga cambios** (pausar lo que gasta sin agendas, subir lo que
   rinde) para aprobar en el Inbox? Lo segundo no existe en escritorio y es trabajo de producto.
