# Relevo — «Velocidad de llamada» rehecha como la copia de Tend («Today») (sesión en la nube, 10/11/2026)

**Lo pidió el Cerebro, con urgencia:** la hoja la ven hoy los siete clientes de Código Inmobiliario (agencia ws 13; clientes ws 15, 17,
18, 19, 20, 22 y 23). Martín, el 10/11, al verla: «se inventó cosas en lugar de copiar los templates que ya estábamos copiando… Tiene
una cantidad de texto innecesario. Tiene un montón de cosas flotando sin sentido… comparado con los otros dashboards es el más feo de
todos… con urgencia rehacer este dashboard. Y que quede como los otros que tenemos». La de antes juntaba tarjetas de TRES diseños
(Cold Calling, Closing y la tabla de Marketing), la tabla «Cada lead nuevo» y la explicación de cómo grabar (`faltaGrabar`).

**Dónde está:** la rama `punta/velocidad-tend` (un commit con todo, «copiado de Tend, Today»). Medir antes de creerlo:
`git log origin/main --oneline -- lib/velocidad-diseno.ts` (si da un commit, ya llegó a main). «En producción» es recién el deploy
diario de main en «Ready»: el despliegue es del Cerebro.

## 1. Qué quedó (HECHO, con tests)

- **La copia** (paso 1): `docs/diseno/mockups-dashboard/velocidad-tend/copia.html` con `tend.css` y `tend.js`, desde lo medido
  (`demos/tend/`: `INFORME.txt`, las capturas y `valores.json`; el demo da 403 desde la nube). A 1440 la página mide 2.348 px contra
  2.352 de Tend, y cada tarjeta cae en su lugar (flujo, WhatsApp, la línea del día, recordatorios y las tres de abajo). A 390, 4.256
  contra 4.170: la diferencia es la sala de espera de la copia, con una tarjeta más que la captura.
- **La adaptación** (paso 2): `velocidad.html`, GENERADA desde el componente por `armar-velocidad.tsx` (dibuja HojaVelocidad con la
  muestra, le saca el prefijo `vt-` y usa `tend.css` y `tend.js`). Así la maqueta y la hoja no pueden decir cosas distintas.
- **El diseño en el Dashboard** (paso 3), como Torque y Corvane: `lib/velocidad-diseno.ts` (puro, arma cada tarjeta),
  `lib/velocidad-diseno-muestra.ts` (ejemplo ficticio; las cifras cierran entre tarjetas), `app/dashboard/disenos/HojaVelocidad.tsx`,
  `VelocidadVivo.tsx`, `velocidad-css.ts` (generado por `armar-css.py` desde `tend.css` + `adaptacion.css`), las diez partes en
  `lib/disenos-partes.ts` (modelo de bloques §36) y el modo oscuro de Tend (la forma de §36). La barra oscura de Tend NO va.
- **La plantilla** `VELOCIDAD_LLAMADA` (lib/graficos-plantillas.ts): diez piezas de `primer_contacto`, `conversaciones` y
  `llamadas_grabadas`, más el botón «Grabar llamada» (el de Cold Calling); el id `velocidad-llamada` y `HOJA_DE_AGENCIA = { 13: … }`
  quedan iguales, así que cada cliente de Código que nunca guardó su Dashboard la ve nueva sin escribir nada.
- **A los conjuntos les sumé lo mínimo:** `conversaciones` por lead con lo que lleva esperando respuesta; `primer_contacto` con lo
  que lleva esperando cada uno y su mediana; `llamadas_grabadas` con la hora (`horaTj`, lib/graficos-lectura.ts).
- **La grabadora** (`GrabarEnFrio`) acepta un lead inicial: «Llamar» en una tarjeta la abre con ese lead.
- **La guarda nueva:** `tests/dashboard-un-solo-diseno.test.ts` frena toda plantilla ofrecida (Dashboard, General y la hoja inicial de
  una agencia) que junte bloques de más de un diseño. Probada con la hoja de antes: 0 / 3.

## 2. Cómo se mapeó cada tarjeta de Tend (las decisiones, para que nadie las deshaga sin saber)

| Tend | MaKo | Qué cambió y por qué |
|---|---|---|
| Saludo, fecha · clínica | «Buenos días, Ana», fecha · negocio | — |
| «New appointment» (ghost) | «Abrir el CRM» | El botón secundario lleva al CRM |
| «Remind tomorrow · 47» (verde) | «Grabar llamada · N» | N = los sin contactar; abre la grabadora de la ficha |
| Appointments today / In the waiting room / Unread on WhatsApp / No-shows | Leads nuevos / Esperando contacto / Primer contacto / Sin contactar | La píldora de cada uno: contactados, mediana de espera, % en la primera hora, el % del período anterior («era X% antes») |
| Patient flow (Expected · Waiting · In consult · Seen) | Flujo de leads (Entraron · Esperando · Contactados · Sin medir) | Entraron = sin contactar de menos de 1 h; Sin medir = ya hablaban antes o no se sabe. Se sacaron «Finish» y la barra de la consulta |
| WhatsApp · waiting on us | WhatsApp, «N esperan respuesta» | La segunda línea es la etapa, no el texto (MaKo no lee los mensajes); sin el contador de no leídos |
| Clinicians today | Llamadas de hoy (por quién llama) | Sin «Open schedule» ni el almuerzo; el renglón chico es «N llamadas» (el % que contestan, en el `title`) |
| Reminders · Tomorrow | Cuánto tardaron (los cuatro tramos) | Sin «Send reminders» |
| Visits (2W · 30D) | Leads por día (2S · 30D) | Contactados y sin contactar |
| Recalls due | Los que más esperan, con «Llamar» | — |
| Clinician load | Carga por setter | — |
| Team activity | Actividad del equipo | Sólo las llamadas de hoy (no hay un registro de cambios de etapa en estas piezas) |

Los ↗ van a /crm (Tend expande la tarjeta; en MaKo el detalle es el CRM). Sin datos, cada tarjeta queda con «—» y vacía, como la
copia: no se explica nada.

## 3. Autocrítica (lo que cambié al mirarlo, y lo que descarté)

Las capturas están en `docs/diseno/mockups-dashboard/velocidad-tend/captura/`: `copia-*` (la copia), `adaptacion-*` (la maqueta) y
`mako-*` (la hoja en el editor de verdad, con la muestra, mirando y editando, claro y oscuro).

- **A 390 la página corría de costado 737 px** (la copia y la adaptación): la grilla del teléfono heredaba `align-items: start` y la
  tarjeta del flujo medía lo de sus carriles. Va `stretch`; Tend no corre. En el Dashboard pasaba igual dentro del bloque.
- **«Buenos días, An / a»**: el saludo letra por letra se partía adentro de una palabra en la ventana angosta del editor. Cada palabra
  va entera en su caja.
- **Los nombres de «Llamadas de hoy» se pisaban** («5 llamadas · 60% contestan» en dos renglones). Queda «5 llamadas».
- **El tiempo de «Entraron» no se veía** (el ícono de Tend no lleva texto): «hace 12 min» pasó al renglón de arriba, como la hora de Tend.
- **«Ya hablaban o sin dato» partía el título del carril en dos**: ahora «Sin medir», y cada tarjeta dice cuál de las dos es.
- **La píldora «era 24% el período anterior» se salía de su tarjeta en el teléfono**: «era 24% antes».
- **Las dos últimas fechas de la curva se pisaban** en la maqueta del teléfono (`tend.js` no tenía la guarda del componente).
- **En la ventana chica del editor (la hoja mide ~256 px, más angosta que un teléfono)** los botones de arriba van uno debajo del otro y las
  píldoras y las cabeceras bajan de renglón (`adaptacion.css`, `@container vt (max-width: 300px)`).
- **La carga por setter de la muestra no sumaba los leads del resumen**, y el comentario decía que sí: ahora suma, con test.
- Descarté agrandar «Llamadas de hoy» para la muestra (tiene tres setters y Tend cinco): con datos reales trae hasta cinco.

## 4. Lo que falta verificar o hacer

- **Verlo en producción** (el Chrome de Martín o el medidor de la PC, `C:/dev/playwright-medidor`): esta sesión no tiene base, y la
  hoja se vio con la muestra en un banco temporal.
- **Medir en el demo andando** la entrada de las tarjetas de «Today» (vive en un chunk que el INFORME no muestra: quedan quietas) y los
  estados vacíos de Tend. El resumen de «30D» se cuenta de la serie (la captura no lo muestra).
- **Los Dashboards ya guardados** de los negocios de Código (ws 15 y 23, docs/relevo/dashboards-codigo.md) siguen con la hoja de antes:
  reescribirlos es del Cerebro, con el sí de Martín. Lo mismo la hoja de prueba del ws 3.
- `horaTj` pone la hora en la zona de Tijuana, como `fechaTj` y todo lo que lee el Dashboard: no es la zona del negocio.

## 5. Lo que espera una decisión de Martín

Nada nuevo. La única pendiente es la de siempre: reescribir los Dashboards ya guardados de los clientes de Código (sección 4).
