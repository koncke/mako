# Dashboard de punta a punta, por tipo de persona (10/11/2026)

Pedido de Martín (10/11): «en dashboard, que se puedan editar, que funcione cada editable, que se pueda crear, cargar la data,
etcétera… textos rotos, botones rotos, diseño roto, funcionalidades que no funcionan… screenshot… feedback sobre cómo se podría
mejorar». Se usó la tab en **producción** (hola-mako.com, la versión desplegada el 10/11 a las 18:50 UTC, que ya trae la
«Velocidad de llamada» copiada de Tend), en el navegador de la app y con la sesión de Martín. Se escribió **sólo en el ws 3
(Cliente de Prueba)**. En los negocios de clientes (ws 1 y ws 17) se miró con una traba que impedía guardar; no se escribió nada.

**En números:**
- **51 casos** probados.
- **7 fallas** encontradas, **las 7 arregladas**, cada una con su test probado rompiéndolo.
- **5 casos sin probar** (abajo, con el porqué).
- **10 propuestas** de mejora sin hacer, para que decida Martín.

Los arreglos van en la punta `punta/dashboard-pruebas` y salen con el despliegue automático del 11/11 a las 08:05 UTC. Las capturas
están en `docs/pruebas/dashboard-10-11/`.

## Las personas y las pantallas

| Persona | Dónde | Qué se probó |
|---|---|---|
| Superadmin en el negocio de prueba | ws 3, 1440, claro y oscuro | Todo el editor sobre la hoja Closing nueva; las 23 plantillas de la galería; período, filtro, CSV, PDF, compartir, «Añadir datos», «Editar con MaKo» |
| Cliente de agencia (Código Inmobiliario) mirando | ws 17 (Giselle), 1440 | «Velocidad de llamada» con sus leads de verdad, sin guardar nada |
| Superadmin en el negocio de Mauricio | ws 1 | Sólo mirar: no tiene hojas del Dashboard guardadas ahí |
| Teléfono (375, emulado) | ws 3 | El Dashboard del teléfono (Marketing / Comercial), «Otras hojas» y la hoja Closing |
| Closer | — | Sin probar: la app no tiene «ver como» un rol y no se crean cuentas |
| Esencial contra Pro | — | El Dashboard no cambia por plan (los dos ven la tab entera); cambiar el plan del ws 3 es tocar la cuenta |

## Las 7 fallas, todas arregladas

1. **Ctrl+Z dos veces seguidas perdía el segundo paso** (captura 08). Agrandada una tarjeta dos veces, el doble Ctrl+Z la dejaba
   con el tamaño del medio, el «Deshacer» apagado y la hoja distinta de lo guardado: después, la flecha nueva salió entre dos
   tarjetas encimadas. La grilla avisaba con atraso la posición del primer deshacer y el editor la escribía encima.
   → Sin un arrastre en curso, el editor sólo acepta el reacomodo de lo que le pasó; el final del arrastre escribe lo suyo.
   `app/dashboard/aviso-grilla.ts`, `tests/dashboard-aviso-grilla.test.ts`.
2. **Agrandar desde la línea del borde MOVÍA la tarjeta** (captura 06). En las tarjetas de las hojas copiadas, la franja para
   agrandar quedaba 8 px adentro del borde: apuntando a la línea (donde está el cuadradito) se agarraba la tarjeta y saltaba al
   tope de la hoja. → El tirador va centrado sobre el borde, como en Looker. `app/dashboard/editor-css.ts`, `tests/general-bloques.test.ts`.
3. **«Añadir datos» en una hoja copiada no mostraba nada.** Se abría el panel de la tabla nueva («Presupuestos de Meta») y en la
   hoja no aparecía: caía adentro de «Todas las piezas», que está plegada al final. Pasaba igual con «Añadir un gráfico», los
   elementos y duplicar la última tarjeta. → Lo nuevo entra arriba de «Todas las piezas», como ya lo hacía «Bloques».
   `lib/graficos-secciones.ts` (`agregarALaVista`), `tests/graficos-secciones.test.ts`.
4. **Elegir «General», «Focus» o «Mi día» en la galería mirando un negocio llevaba al Dashboard PROPIO.** La página saltaba a
   `/dashboard?hoja=general` sin el negocio, y la hoja se sumaba en el Dashboard de Martín. **⚠️ Corrección del 11/11:** el
   10/11 escribí que no se había escrito nada; SÍ se sumó una hoja «General» al Dashboard propio de Martín a las 23:38:39 UTC
   (la cuarta pestaña, `gmwbbzth4gvfv`), mientras probaba en el ws 3. No la borré: es su Dashboard y fuera del ws 3 no se escribe;
   el Cerebro decide. → El salto lleva el negocio de la pestaña. `app/dashboard/NuevaHoja.tsx`.
5. **El botón de filtro de un número oscuro era un cuadrado blanco** con el ícono blanco adentro (captura 01, «Leads de esta
   semana» en el Focus del ws 3). → Adentro de los números de color, el botón va transparente. `lib/graficos-corbel.ts`.
6. **Marketing decía «Gastaste US$0 en anuncios, trajeron 3 agendas y cada una costó US$0.00»** (captura 12): sin pauta, como si
   los anuncios las hubieran traído. → Con cero invertido dice «Llegaron 3 agendas.». `lib/marketing-diseno.ts`,
   `tests/dashboard-diseno-marketing.test.ts`.
7. **En el teléfono, la hoja Closing decía dos veces «No pudimos leer estos números. No es nada tuyo» con «Reportar a Soporte»**
   (captura 20), en un negocio sin grabador de llamadas. No falló nada: la compu dice «Conecta tu grabador de reuniones…».
   → El teléfono dice ese mismo texto, una vez, sin Soporte; y con dos errores ya no repite el aviso. `app/m/dashboard/`,
   `lib/graficos-datos.ts`, `tests/m-dashboard-modelo.test.ts`.

## Los casos, uno por uno

**El editor** (ws 3, hoja Closing creada desde la galería, 1440):

| # | Caso | Resultado |
|---|---|---|
| 1 | Mover una tarjeta arrastrándola (las demás se acomodan) | Pasa (05) |
| 2 | Deshacer con el botón | Pasa |
| 3 | Ctrl+Z de a un paso (agrandar, mover, texto) | Pasa |
| 4 | Ctrl+Z dos veces seguidas | Falla → arreglado (1) |
| 5 | Agrandar por el costado de abajo | Pasa (260 → 398 px, empuja lo de abajo) |
| 6 | Agrandar por el costado izquierdo | Pasa |
| 7 | Agrandar apuntando a la línea del borde | Falla → arreglado (2) |
| 8 | Los ocho tiradores reciben el puntero; los círculos de las flechas no los tapan | Pasa |
| 9 | Cambiar el título de una tarjeta con dos toques (sigue al recargar) | Pasa (07) |
| 10 | «Volver al original» | Pasa |
| 11 | Deshacer un texto cambiado | Pasa |
| 12 | Duplicar una tarjeta (sigue al recargar) | Pasa |
| 13 | Borrar con Supr y «Deshacer» del aviso | Pasa |
| 14 | Unir dos tarjetas con una flecha; su panel (Curva · Recta · Codo, punta, color, Quitar) | Pasa |
| 15 | Estilo de la página («Pastel») y deshacerlo | Pasa (09, 10): cambia el fondo y los acentos; las tarjetas copiadas conservan los de su demo |

**Crear y cargar datos:**

| # | Caso | Resultado |
|---|---|---|
| 16 | La galería: 23 plantillas y la hoja en blanco | Pasa (02) |
| 17-32 | Crear Comercial, Closing, Marketing, Anuncio ganador, Hooks y retención, Landing, VSL y YouTube, Chat Analyst, CS Analyst, Productividad, Cobranza, Automatizaciones, Contenido e IA, Inmobiliaria, Cold Calling y Velocidad de llamada | Pasan: ningún texto roto («undefined», «NaN», «null»), nada se sale de su tarjeta a 1440; con los datos del ws 3 (Comercial: 3 agendas, 2 vinieron; Velocidad: 134 leads, 93 esperando) y los vacíos de lo que el ws 3 no tiene (11, 13, 14, 15) |
| 33 | La frase de Marketing sin pauta | Falla → arreglado (6) |
| 34 | Elegir una plantilla de General en la galería mirando un negocio | Falla → arreglado (4) |
| 35-41 | General, Focus, Mi día, Operación diaria, Agencia o servicio, Curso o comunidad, Instagram y redes, en el ws 3 | Pasan (16); en Agencia, los atajos se deslizan de costado con su barrita (17) |
| 42 | «Añadir datos»: un conjunto del catálogo (son 44) | Falla → arreglado (3) |
| 43 | Período: de «Últimos 30 días» a «Todo» | Pasa: Comercial pasa de 3 a 37 agendas |
| 44 | El filtro de una tarjeta, en un número oscuro | Falla → arreglado (5) |
| 45 | Exportar los datos (CSV) | Pasa: `dashboard-comercial-2026-11-10.csv`, cada gráfico con su período |
| 46 | PDF | Pasa: arma la hoja para imprimir y abre la impresión |
| 47 | Compartir | Pasa: abre el modal (cualquiera con el enlace / sólo los invitados) |

**Las personas y las pantallas:**

| # | Caso | Resultado |
|---|---|---|
| 48 | Modo oscuro en la compu (Closing, Comercial, Marketing, General, Landing, Anuncio ganador, Velocidad) | Pasa |
| 49 | Teléfono: el Dashboard (Marketing / Comercial, leads por día, los números del período, «Otras hojas») | Pasa (19); los nombres en inglés («Ad Spend», «More») son la decisión de MaKo Mobile |
| 50 | Teléfono: la hoja Closing en un negocio sin grabador | Falla → arreglado (7) |
| 51 | Cliente de agencia (Código, ws 17): «Velocidad de llamada» con sus leads, sin guardar nada | Pasa (21): 4 leads nuevos, 4 esperando, mediana 18 h |

**Sin probar:**
- **«Editar con MaKo» y «¿Qué vas a crear hoy?»** (18): en el navegador piden instalar la app de escritorio, como está decidido.
- **Crear un enlace para compartir**: da acceso a los datos a cualquiera con el link; no se crea sin el sí de Martín.
- **El closer**: la app no tiene «ver como» un rol y no se crean cuentas. Que vea sólo Closing lo fija el código (`hojaDeRol`).
- **Esencial contra Pro**: el Dashboard no cambia por plan; cambiar el plan del ws 3 es tocar la cuenta.
- **Closing con llamadas de verdad**: el ws 3 no tiene grabador y en el ws 1 el superadmin no tiene la hoja; crearla ahí es escribir
  en un cliente.

## Propuestas de mejora (deciden Martín)

1. **El panel de una tarjeta copiada flota a la izquierda y tapa la hoja** (07); el de un gráfico va a la derecha. En Looker va
   siempre a la derecha, sin tapar.
2. **«Compartir «Comercial»» comparte todas las hojas** («Todas las hojas, sin poder editar»): el título dice una y el link lleva todas.
3. **El PDF se baja como «MaKo - Dashboard»**, no con el nombre de la hoja.
4. **Marketing, «Tendencias contra la primera semana»**: con pocos leads la curva llega a +14.000 % (12). Es la forma de Kestrel;
   con conteos chicos no se lee.
5. **Closing con el período «Todo»** encabeza «TODO · MARTES 10 DE NOVIEMBRE» (03).
6. **En un negocio sin hojas guardadas** (ws 17, ws 1) la pestaña «Focus» aparece elegida mientras abajo está la galería.
7. **Agencia o servicio**: los atajos no entran y se deslizan con una barrita (17).
8. **Las miniaturas de la galería** dicen «Miércoles 4 de noviembre» todos los días (son la muestra).
9. **En el teléfono, las hojas de General** (Focus, Mi día…) no aparecen en «Otras hojas».
10. **«Añadir datos» no deja subir un CSV propio** (Looker sí): sólo los 44 conjuntos de MaKo.

## Lo que falta

- Mirar los 7 arreglos en producción después del despliegue del 11/11 a las 08:05 UTC (ws 3: doble Ctrl+Z, agrandar desde la
  línea, «Añadir datos» en Comercial, el filtro del Focus, la frase de Marketing, la galería con General; y el teléfono en la Closing).
- Los tipos de los archivos tocados no se pudieron chequear en la PC (el vigía de memoria corta el chequeo con 3,7 GB libres): los
  chequea GitHub al llevar la punta a main.
- En el ws 3 quedaron, para revisar, las hojas Closing, Comercial y Velocidad de llamada creadas desde la galería y las siete de
  General; las otras trece de prueba están en Archivados.

---

# Segunda vuelta (11/11/2026): MIRANDO cada pantalla

Martín, por el Cerebro: *«deberían haber detectado esto… Quiero que prueben y miren todo y detecten oportunidades de mejora»*, y
*«Una hoja vacía o con "Sin datos" en producción también es una falla»*. La primera vuelta leyó texto y código; ésta mira cada hoja
con su captura (compu, 1440, claro): las 23 plantillas recién creadas en el ws 3, la galería y la «Velocidad de llamada» de los siete
clientes de Código. El teléfono se revisó leyendo lo que dibuja cada hoja (las capturas del panel en 375 salen recortadas: quedan
para Chrome, cuando Martín tenga ahí su cuenta).

## Lo que se ve, hoja por hoja (capturas 22 a 52)

| Hoja | Captura | Cómo se ve | Qué falla o qué mejorar |
|---|---|---|---|
| Closing (Halden) | 22, 23 | Calca a Halden; en el ws 3, todas las tarjetas vacías | No dice por qué (falta el grabador) → **arreglado (8)**. «Duración 00:00:00» sin llamadas → **arreglado (9)**. «Todas las piezas · 14 piezas» al pie, mirando → propuesta 11 |
| Comercial (Selvar) | 24 | Completa con los datos del ws 3 | — |
| Marketing (Kestrel) | 28 | Completa | «Costo por agenda US$0.00» con otro «US$0.00» debajo, y «Impresiones 0 0», sin pauta → **arreglado (10)**. La curva a +14.000 % → propuesta 4 |
| Anuncio ganador (Prism) | 26 | Doce tarjetas «Todavía no hay datos» | El ws 3 no tiene anuncios analizados. En el teléfono decía «No pudimos leer… No es nada tuyo» → **arreglado (13)** |
| Hooks y retención (Ondra) | 27 | Vacía | Igual que Anuncio ganador → **arreglado (13)** en el teléfono |
| Landing (Corbel) | 29 | Completa (3 visitas hoy) | — |
| VSL y YouTube (Pelago) | 30 | «0» grande y dos tarjetas altas vacías | El ws 3 no tiene video de ventas |
| Chat Analyst (Parley) | 31 | Rica | La tarjeta naranja muestra los últimos 8 días y todos en cero: un bloque naranja vacío → propuesta 12 |
| CS Analyst (Mender) | 32 | Vacía, con su explicación | El ws 3 no tiene clientes en entrega |
| Productividad (Fernly) | 33 | Vacía, con su explicación | El ws 3 no tiene tareas en el Plan |
| Cobranza (Coffer) | 34 | Todo en US$0 | «Vencido US$0» en ROJO → **arreglado (11)** |
| Automatizaciones (Noria) | 35 | Completa | — |
| Contenido e IA (Orrery) | 36 | Completa | «Costo por llamada US$0.0000» con 705 llamadas, y el eje «US$0.1 · US$0 · US$0» → **arreglado (12)** |
| Inmobiliaria (Torque) | 37 | Rica, con los proyectos | — |
| Cold Calling (Corvane) | 25 | UNA tarjeta («Todavía no grabaste llamadas») y mucho blanco | El ws 3 no graba llamadas; la hoja casi vacía → propuesta 13 |
| Velocidad de llamada (Tend) | 38 | Rica | Los nombres cortados en las columnas son como en Tend. WhatsApp sin nadie esperando = tarjeta en blanco → propuesta 14 |
| General (Orvel) | 39 | Completa | «↗ +US$0» en verde y «Te quedó +US$0» → **arreglado (11)** |
| Focus (Pane) | 40 | Vacía pero dice qué falta («Cargar la meta») | — |
| Mi día (Lumora) | 41 | Se entiende | — |
| Operación diaria (Moorly) | 42 | Se entiende | — |
| Agencia o servicio (Sunrow) | 43 | Completa | Los atajos se deslizan (propuesta 7 de la primera vuelta) |
| Curso o comunidad (Vitrea) | 44 | Vacía, con su explicación | «Tus / alumnos» en dos renglones: igual en Vitrea («Studio / Overview»), es fiel |
| Instagram y redes (Murmura) | 45 | Vacía; arriba dice «Conecta Meta para ver tu audiencia» | — |
| La galería | 46-48 | Las 23 miniaturas completas y a color | Se elige una miniatura llena y la hoja nace vacía sin decir por qué → lo arregla (8) |

**Los clientes de Código («Velocidad de llamada», mirando, sin guardar nada):**

| Cliente | Captura | Leads nuevos | Sin contactar | Espera (mediana) |
|---|---|---|---|---|
| Brigitte (ws 15) | 49 | 40 | 100 % | 15 días |
| Giselle (ws 17) | 21 | 4 | 100 % | 18 h |
| Pablo (ws 18) | 50 | 0 | — (la hoja entera vacía) | — |
| Natalia (ws 19) | 51 | 127 | 98 % | 22 días |
| Sergio (ws 20) | 52 | 7 | 100 % | 5 días |
| Patricia (ws 22) | — | 4 | 75 % | 13 h |
| Marcela (ws 23) | — | 0 | — (la hoja entera vacía) | — |

**Lo que Martín tiene que ver de esta tabla:** en los siete, «Primer contacto» dice «—». Casi nadie sale contactado, porque llaman desde
el celular sin grabar. La hoja de Tend no tiene dónde explicarlo (lo que estaba se sacó el 10/11 por «texto inventado»). Es la decisión
que sigue abierta desde el 9/11: cómo se les dice que graben.

## Las fallas de esta vuelta, todas arregladas (la numeración sigue la de arriba)

8. **Una hoja copiada sin datos no decía por qué.** El lector sabe «Conecta tu grabador de reuniones…» o «Conecta Meta…», pero la hoja
   copiada dibujaba su propio vacío. → Ese texto va una vez arriba, en la franja de avisos. `app/dashboard/falta-conectar.ts`,
   `tests/dashboard-falta-conectar.test.ts`.
9. **Closing: «Duración promedio 00:00:00» sin llamadas** (23). → «—». `tests/dashboard-diseno-closing.test.ts`.
10. **Marketing: ceros que parecen números** (28). → Sin gasto, el costo por agenda y por lead son «—»; un cambio de cero no se
    escribe. `tests/dashboard-diseno-marketing.test.ts`.
11. **General y Cobranza: ceros pintados de verde o de rojo** (34, 39). → Sin flecha ni color. `tests/dashboard-diseno-general.test.ts`.
12. **Contenido e IA: «US$0.0000» y el eje repetido** (36). → Cifras significativas («US$0.000038», «US$0.033»).
    `tests/dashboard-diseno-contenido.test.ts`.
13. **Teléfono: «No pudimos leer… No es nada tuyo» de hojas que se leyeron bien** (Anuncio ganador y Hooks sin datos en el período).
    → Sólo si la lectura falló de verdad. `tests/m-dashboard-modelo.test.ts`.

## Propuestas nuevas (deciden Martín)

11. **«Todas las piezas · N piezas» al pie de cada hoja copiada, mirando** (23): reemplaza a «Ver todo en la grilla», pero a un cliente no
    le dice nada. ¿Que se vea sólo editando?
12. **Chat Analyst, la tarjeta naranja**: muestra los últimos 8 días; si fueron todos en cero queda un bloque naranja vacío (31).
13. **Cold Calling sin llamadas**: una sola tarjeta y mucho blanco (25). Corvane no tiene un vacío medido.
14. **Velocidad de llamada, WhatsApp**: en Tend la tarjeta lista las últimas conversaciones y marca las que esperan; la nuestra lista
    sólo las que esperan y con cero queda en blanco (38, 50).
15. **El negocio de prueba no tiene grabador, anuncios ni video de ventas**: medio Dashboard no se puede MIRAR con datos ahí. Sin eso,
    Closing, Anuncio ganador, Hooks, VSL y Cold Calling sólo se ven vacías.

## Lo que falta de esta vuelta

- Las capturas en el celular de cada hoja (el panel de la app recorta a 375): con Chrome, cuando el Cerebro avise que tiene la cuenta
  de Martín.
- En la PC corrieron en verde, de a uno, los tests de lo tocado: Marketing, Contenido, Closing, General, Cobranza, el teléfono, la
  pantalla del Dashboard, la guarda de textos y «falta conectar» (éste, además, roto de tres formas). Los tipos los chequea GitHub.
- La hoja «General» que quedó en el Dashboard propio de Martín: decide el Cerebro si se archiva.

## El teléfono a 375, con captura (11/11, 05:30 UTC, producción 9818c63cb) — capturas 53 a 64

Hechas en el navegador de la app con el método del Cerebro: `resize_window` en «mobile», recargar, y otra vez `resize_window` justo antes
de cada captura (la segunda captura seguida vuelve como un pedazo de 800×600).

| Hoja | Captura | Cómo se ve | Qué falla |
|---|---|---|---|
| Dashboard (Marketing / Comercial) | 53 | Bien | — |
| Closing | 54 | Dos veces «No pudimos leer… No es nada tuyo» | Arreglado ayer (7), en main, sale a las 11:05 UTC |
| Comercial | 55 | Bien | — |
| Marketing | 56 | «Gastaste US$0 en anuncios · trajeron 3 agendas · cada una costó US$0» y «Costo por agenda US$0» | **Arreglado (14)**: el teléfono decía la frase de la plantilla, no la del diseño |
| Anuncio ganador, Hooks | 57, 58 | Dos veces «No pudimos leer» | Arreglado (13), sale a las 11:05 |
| Landing | 59 | «Entraron 3 visitas de **1 personas**» | **Arreglado (15)** |
| VSL, CS, Productividad, Cobranza | 60, 62-64 | Bien (ceros y «—» del ws 3) | — |
| Chat Analyst | 61 | «Tiempo de respuesta **10**», «Respuesta más lenta (p90) **10**», sin unidad | **Arreglado (16)** |

14. **Marketing en el teléfono:** la hoja copiada dice la frase de su diseño (la misma de la compu, «Llegaron 3 agendas.»), y un costo sobre un
    gasto de cero va «—». `app/m/dashboard/datos.ts`, `tests/m-dashboard-modelo.test.ts`.
15. **«1 personas»:** después de un «1», la palabra de la plantilla va en singular («1 persona», «1 agendó»). Vale para la compu y el teléfono.
    `lib/graficos-frase.ts`, `tests/dashboard-frase-y-destinos.test.ts`.
16. **Números sin unidad en el teléfono:** la unidad que el catálogo dice entre paréntesis («(min)», «(días)») va con el valor si el título no
    la dice. `app/m/dashboard/modelo.ts` (`conUnidad`).

# Producción (11/11, 14:45 a 15:40 UTC): los 16 arreglos mirados en hola-mako.com — capturas 65 a 92

Producción servía `ada98995d` (despliegue de las 11:05 UTC, medido con la API de Vercel), que trae los tres lotes (`git merge-base`).
En el navegador de la app, en mi pestaña, con la sesión de Martín (`/api/auth/me`: martinkoncke, ws 3 «Cliente de Prueba» con
`?ws=3`; ws 19 «Natalia», cliente de Código Inmobiliario, sólo mirando con un bloqueador de escrituras: ninguna salió).

⚠️ A las 14:43 UTC el navegador de la app no tenía sesión (se cerró la app de Claude en la PC) y el Chrome de la extensión tenía la de
LEANDRO (ws 10): no se tocó nada ahí. Martín volvió a entrar y recién ahí se miró.

## Los 16 arreglos, uno por uno

| # | Arreglo | Dónde se miró | Captura | En producción |
|---|---|---|---|---|
| 1 | Doble Ctrl+Z rápido | Comercial ws 3, 1440: agregar una tabla, estirarla y Ctrl+Z dos veces | 75 | ✅ volvió a 13 tarjetas, ninguna encimada |
| 2 | Estirar por el borde no mueve la tarjeta | Comercial, borde derecho | 74 | ✅ 649 → 762 px de ancho, quieta en (92, 548) |
| 3 | «Añadir datos» cae a la vista | Comercial → Añadir datos → Visitas a la landing | 73 | ✅ arriba de «Todas las piezas», seleccionada |
| 4 | La galería no pierde el `?ws=` | Nueva hoja → General | 76 | ✅ `?hoja=general&ws=3`, «Cliente de Prueba» |
| 5 | Botón de filtro sobre la tarjeta oscura | Hoja «Focus» de Martín en ws 3 | 72 | ✅ fondo transparente, se ve el embudo |
| 6 | Marketing con gasto cero | Marketing 1440 | 67 | ✅ «Llegaron 3 agendas.» |
| 7 | Teléfono sin grabador | Closing 375 | 78 | ✅ un solo «Conecta tu grabador…», sin «No pudimos leer» |
| 8 | La franja «falta conectar» | Closing y Marketing 1440 | 65, 67 | ✅ «Conecta tu grabador…» / «Conecta Meta para ver tu audiencia» |
| 9 | Closing sin duración | Closing 1440, «Duración promedio» | 66 | ✅ «—» y «En total —» |
| 10 | Marketing: ceros dobles | Marketing 1440 | 67 | ✅ costos en «—», ningún «0 0» |
| 11 | General y Cobranza: ceros en color | General / Cobranza 1440 | 68, 69 | ✅ «Igual que el mismo período de octubre»; «Vencido US$0» en tinta |
| 12 | Contenido: US$0.0000 y el eje | Contenido 1440 | 70 | ✅ «US$0.000038», eje US$0.05 · 0.033 · 0.017 |
| 13 | Teléfono: «no pudimos leer» de hojas vacías | Anuncio y Hooks 375 | 79, 82 | ✅ «Conecta Meta en Integraciones», una vez |
| 14 | Marketing en el teléfono | 375 | 81 | ✅ «Llegaron 3 agendas.», costos «—» |
| 15 | Singular después de «1» | Landing 1440 y 375 | 77, 83 | ✅ «Entraron 3 visitas de 1 persona» |
| 16 | Unidades en el teléfono | Chat 375 | 84 | ✅ «10 min» |

Además, las cinco hojas que faltaban a 375: Automatizaciones (85), Contenido (86), Inmobiliaria (87), Cold Calling (88) y Velocidad (89).
Y un cliente de Código: Natalia (ws 19) abre en «Focus» vacío con la galería (90, la propuesta de «Focus» de arriba), su Velocidad a
1440 (91) se ve como Tend (129 leads nuevos, 126 esperando, el tablero de leads con «Llamar», WhatsApp con «Urgente»), y en el teléfono
(92) no.

## Lo que se vio mal y se arregló en este lote (17 a 24)

17. **«1 no se presentaron»** (80, Comercial en el teléfono): el singular sólo miraba UNA palabra. Ahora también las frases de las
    plantillas de varias palabras («no se presentó», «te respondió», «ya compró», «lo vio», «persona le dio play», «tarea activa», «ya
    hecha») y «1 de tus 5 clientes **pide** atención». `lib/graficos-frase.ts`, `tests/dashboard-frase-y-destinos.test.ts`.
18. **«Todo ······ Todo»** encima del aviso de «falta conectar» (78, 79, 82): el aviso va solo, sin el encabezado del período (sin la
    fuente conectada, cambiar el período no trae nada). `app/m/dashboard/DashboardM.tsx`.
19. **«Salieron 0 mensajes · 4 fallaron · 65 te respondieron»** (85, Automatizaciones): medido en la base (sólo lectura), el ws 3 no
    mandó NINGÚN mensaje en 30 días (172 simulados, 60 acciones, 4 fallos, 3 omitidos), y las 65 «respuestas» se le adjudicaban al
    último envío de cada inscripción que contestó: una acción en 58, un simulado en 6, un omitido en 1. Ahora la respuesta es del
    último envío que SALIÓ, y la tasa de respuesta y la de apertura se calculan sobre lo que salió, no sobre todas las filas.
    `lib/graficos-datos-puro.ts` (`enviosRespondidos`), `lib/graficos-datos.ts`, `lib/graficos-catalogo.ts`, `tests/graficos-datos-puro.test.ts`.
20. **«clase:no_reply» como un modelo** (71, Contenido): la tabla del gasto de IA guarda también lo que NO es una llamada (las decisiones
    de MaKo con `provider: 'mako'`, los vetos `vetado:`, los 429 `rebote429:`, los saltos `rebote:` y los fallos `fallo:`, todos a US$0).
    Contados, inflaban «Usaste la IA 705 veces» y bajaban el costo por llamada. `esLlamadaDeIa` (`lib/graficos-datos-puro.ts`) los deja afuera.
21. **Claves crudas** (71 y 75): «chatbot-crear-ia», «offer», «mako-pedidos» en «Para qué se usa»; «calendly», «carga_manual» en «De dónde
    vienen los que cierran». Ahora dicen el nombre que la app ya les da: el del catálogo de modelos («Crear una automatización con IA
    (Automations)») y el del CRM («Calendly», «Cargado a mano»). Sólo cambia la etiqueta: la clave queda, y un filtro guardado sigue
    filtrando. `lib/graficos-nombres.ts` (nuevo), `tests/dashboard-nombres.test.ts`. Antes de subirlo se probó en la página de producción
    con los nombres puestos a mano: los largos se salían 94 px de la tarjeta, porque la lista es una grilla que no se achica. La
    columna va en `minmax(0, 1fr)` y entran con «…» (captura 93; `app/dashboard/disenos/contenido-css.ts`, docs/hallazgos-templates-dashboard.md §41).
22. **«Costo por llamada US$0»** en el teléfono (86): un costo de US$0.000038 se escribía «US$0». Debajo de un centavo, dos cifras
    significativas («US$0,000038»), como la compu. `lib/graficos-agregar.ts` (`fmtValor`), `tests/graficos.test.ts`.
23. **El eje de lo gastado en «0 · 0 · 0 · 0»** en el teléfono (86): debajo de 1, dos cifras significativas («0,01 · 0,02 · 0,03»), y los
    pasos del eje sin redondear a milésimas. `app/m/dashboard/modelo.ts` (`ejeCompacto`, `geometria`), `tests/m-dashboard-modelo.test.ts`.
24. **Velocidad en el teléfono decía «Leads por día · 0 en 30 días» y «Primer contacto 129»** (89, 92; Natalia tiene 129 leads y 126
    esperando): el teléfono dibuja sólo la PRIMERA métrica de cada pieza, con el título de la pieza. Con varias métricas, ahora el rótulo es
    el de la que se ve: «Contactados · 0 en 30 días» y «Leads 129». `app/m/dashboard/modelo.ts` (`rotuloDePieza`), `datos.ts`.

Todos con su test, corrido de a uno en la PC (los demás, GitHub). Se ven en producción con el próximo despliegue.

## Crítica, al lado de su referencia (deciden Martín)

- **Velocidad en el teléfono (92) contra Tend:** con el rótulo arreglado dice la verdad, pero es un gráfico en cero y un número. Tend en el
  celular es la lista de quién espera, con «Llamar». Propuesta: que el teléfono de Velocidad muestre «Esperando contacto» y los que más
  esperan, como la compu (91).
- **La franja «Conecta tu grabador…» no tiene botón** (65), y la de Claude justo arriba sí («Conectar Claude»). No hay UN modal de
  grabador (son Fathom, tl;dv, Fireflies, Zoom…) y un link a Integraciones saca de la pestaña, que Martín prohibió. Decide Martín cuál abre.
- **«Ad Spend» en inglés** en Marketing del teléfono (81) y en /general, cuando la compu dice «Gasto». Es el título de la plantilla.
- **El «—» de «igual» en el teléfono** («Tasa de cierre 0% — 0,0 pts», 80) se lee como un menos. Es el ícono del diseño.
- **Dos pestañas «Focus»** en el ws 3 de Martín (una hoja suya y la plantilla): con el mismo nombre no se sabe cuál es cuál.
- **Contenido e IA en la compu, «Qué modelo cuesta más»**: lista modelos de US$0.00 con «0% del costo». Con el arreglo 20 se van los que
  no eran llamadas; los gratis de verdad (Gemini) siguen.

## Lo que falta

- ~~Mirar los arreglos 17 a 24 en producción~~: mirados abajo (16:05 UTC).
- La captura 86 salió recortada a la derecha (la trampa del panel oculto); lo que muestra se leyó también del texto de la página.

# Producción, segunda vuelta (11/11, 16:00 a 16:20 UTC, 2507c11c7): los arreglos 17 a 25 — capturas 94 a 103

Despliegue de las 15:55 UTC (Vercel: `2507c11c7`). Mi pestaña del navegador de la app; `/api/auth/me`: Martín en ws 3 y en ws 19
(Natalia, sólo mirando: todo lo que salió fue GET).

| # | Arreglo | Captura | En producción |
|---|---|---|---|
| 17 | Singular de varias palabras | 98 | ✅ «1 no se presentó» |
| 18 | El aviso de «falta conectar» va solo | 99 | ✅ sin «Todo · Todo» |
| 19 | La respuesta es del último envío que salió | 97, 100 | ✅ «Te respondieron —» en la compu; «0 te respondieron» y tasa «—» en el teléfono |
| 20 | La IA cuenta sólo llamadas | 94, 95 | ✅ «Usaste la IA 629 veces» (antes 705), sin «clase:no_reply» ni «cuota» |
| 21 | Nombres en vez de claves | 95, 96 | ✅ «Crear una automatización con IA (A…», «Calendly», «Cargado a mano» (y las iniciales «CA») |
| 22 | Costo de centavos | 94, 101 | ✅ «US$0.000043» en la compu, «US$0,000043» en el teléfono |
| 23 | El eje en centavos | 101 | ✅ «0 · 0,01 · 0,02 · 0,03» |
| 24 | El rótulo es lo que se dibuja | 98, 102, 103 | ✅ Comercial «Vendido»; Velocidad «Contactados · 0» y «Leads 135» (ws 3), «Leads 131» (Natalia) |
| 25 | Los nombres largos con «…» | 95 | ✅ adentro de la tarjeta |

## Lo que se vio mal en esta vuelta y se arregló (26 a 28; salen con el despliegue de mañana)

26. **«Les escribió MaKo · recibieron al menos un mensaje · 109»** (97) con «Salieron 0 mensajes» arriba. El paso contaba los leads con
    CUALQUIER fila de envío (una acción, un simulado, un omitido). Medido en la base (sólo lectura), no es sólo el ws 3: en 30 días, ws 11
    tiene 183 leads con filas y 37 con un mensaje salido, y los clientes de Código (13, 15, 17, 19, 20, 22) tienen filas y CERO mensajes
    salidos (Natalia: 21 y 0). Ahora hay una métrica `escritos` (los leads a los que les SALIÓ un mensaje); `leads` queda como estaba
    porque «Cuántos llegan a cada tarjeta» sí cuenta las acciones. Una hoja copiada antes de esa métrica muestra «—» en ese paso, no el
    número falso. `lib/graficos-catalogo.ts`, `lib/graficos-datos.ts`, `lib/graficos-plantillas-generales.ts`, `lib/automatizaciones-diseno.ts`,
    `tests/dashboard-diseno-automatizaciones.test.ts`.
27. **«Plan de arranque del cliente nuevo · 1 · 0%»** (95): una llamada de 629 no es el 0 %. Debajo de medio punto dice «<1%».
    `lib/contenido-diseno.ts` (`parteEnTexto`), `app/dashboard/disenos/HojaContenido.tsx`, `tests/dashboard-diseno-contenido.test.ts`.
28. **Automatizaciones en el teléfono decía otra frase que la compu** (100: «Salieron 0 mensajes · 4 fallaron · 0 te respondieron»; 97:
    «Salieron 0 mensajes. 4 no salieron y esperan que los mires.»). El teléfono dice la del diseño, como Marketing (14).
    `app/m/dashboard/datos.ts`.

## Crítica de esta vuelta, al lado de Tend

- **Velocidad en el teléfono (102, 103)**: ahora no miente, pero es «Contactados 0» y «Leads 131». La compu de Natalia (91) muestra 126
  esperando, quién espera más y «Llamar»; Tend en el celular es esa lista. Sigue siendo la propuesta para Martín.
- **«Qué modelo cuesta más» lista modelos de US$0.00** (95): son llamadas gratis de verdad (Gemini, gpt-oss), no un error.
