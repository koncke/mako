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
   `/dashboard?hoja=general` sin el negocio, y la hoja se sumaba en el Dashboard de Martín. Esta vez no se escribió nada (Martín
   ya tenía «General»). → El salto lleva el negocio de la pestaña. `app/dashboard/NuevaHoja.tsx`.
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
