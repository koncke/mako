# Las portadas: qué se ve arriba de cada plantilla

Martín, 14/10/2026, mirando las dos galerías: «A simple vista se tienen que diferenciar MUY
bien de qué es cada template… que se note el objetivo del template con un vistazo… evita que
al principio tenga muchos textos, muchos números… también puedes jugar con los COLORES».

> **HECHO el 15/10/2026** (`2929bc211`, en producción con `0ddeab54d`). Este documento quedó corregido con lo que se
> implementó: los colores finales, la plantilla Instagram (que se apoyaba en un dato que **no existe**, ver «Lo que se
> midió») y lo que cambió de forma. Cómo está armado y lo que costó: `docs/hallazgos-graficos.md` → «Las portadas».
> La tabla de colores vive en `lib/graficos-identidad.ts`; las portadas, en `lib/graficos-portadas.ts` y en
> `PORTADAS_GENERAL` (`lib/general-plantillas.ts`).

**Lo que cambia:** hoy todas las plantillas comparten la misma forma —un número grande arriba
a la izquierda, tres cajitas al lado y un gráfico abajo—, así que son la misma imagen con otro
título. La propuesta es que **cada portada esté hecha de otra cosa**, según lo que esa hoja
viene a contestar. Arriba va UNA pieza a lo ancho; lo demás baja igual que hoy.

Nada de esto inventa un cálculo: son tipos de gráfico que ya existen y datos que ya se leen.
Los colores son tentativos y viven en UNA tabla compartida por las dos galerías, para que no
salgan dos paletas. **El color nunca es lo único que distingue**: cada portada tiene su forma y
su título.

## Dashboard — las 13 hojas

| Hoja | Qué contesta | Qué se ve arriba | Color |
|---|---|---|---|
| Marketing | ¿Cuánto me cuesta un cliente? | El CAC solo, gigante, con una frase: «Cada cliente te cuesta US$X» | Azul Meta |
| Comercial | ¿Cuánto entró y cuánto falta? | La barra cobrado / pendiente a lo ancho, con los dos montos en grande | Dorado MaKo (el verde es de WhatsApp) |
| Ads Analyst | ¿Qué anuncio funciona? | Los anuncios ganadores como tarjetas, **con su miniatura real**, y lo que cuesta cada agenda | Coral (el magenta es de Instagram) |
| Landing | ¿Qué miran y qué tocan? | El mapa de calor: la página real con el calor encima | Celeste |
| VSL Analyst | ¿Dónde se van del video? | La curva de retención, grande | Rojo «play» |
| Chat Analyst | ¿Respondo rápido? | El % respondido en 15 minutos, solo y gigante, como un reloj | Verde WhatsApp |
| Closing | ¿Cuántas llamadas se ganan? | El embudo R1 → R2 → ganadas, en columnas grandes (los trapecios son de CRM) | Violeta |
| CS Analyst | ¿A quién atiendo? | **Personas**: las tarjetas de los clientes que necesitan atención, con su señal | Teal |
| Productividad | ¿Qué hago primero? | La matriz impacto × esfuerzo, grande, con sus cuatro cuadrantes y el nombre de cada proyecto | Lima |
| CRM y pipeline | ¿Dónde se me caen los leads? | El embudo entero: lead → agenda → asistió → cerró | Azul oscuro |
| Cobranza | ¿A quién le cobro? | **Personas**: la lista con su próxima cuota y «Marcar cobrada» en la fila | Ámbar |
| Automatizaciones | ¿Me contestan? | El embudo enviados → abiertos → respondieron | Índigo |
| Contenido e IA | ¿En qué se va la IA? | Un anillo con para qué se usa y el costo total en el centro | Durazno |

## General — las 13 plantillas (las 12 de hoy + Instagram)

General es lo que se **hace** hoy, así que arriba va UNA cosa para hacer o UNA persona, no un
análisis. Donde el Dashboard muestra la lista (Cobranza, CS), General muestra la primera: a
quién le cobrás HOY.

| Plantilla | Qué contesta | Qué se ve arriba | Color |
|---|---|---|---|
| General | ¿Llego a la meta? | La meta como en el teléfono: el anillo gigante y una línea, «Te faltan US$6.000 en 78 días» | Noche (fondo oscuro) |
| Bienvenida | ¿Qué hago hoy? | «Buenos días, Ana» gigante y la acción del día en una frase, con su botón | Durazno |
| Foco de la semana | ¿Avanzo en mis OKRs? | Un anillo grande por OKR (dos o tres), con su nombre | Lima |
| Operación diaria | ¿Qué hago primero? | La tarea #1 del Plan sola y grande («Lo primero de hoy»), con «Completar» | Índigo |
| Ventas del mes | ¿Cuánto vendí? | Lo vendido en el mes, solo y gigante, con la flecha contra el mes anterior | Dorado MaKo |
| Cobros | ¿A quién le cobro hoy? | «A quién cobrarle hoy»: las cuotas más urgentes con su monto y «Marcar cobrada» (el bloque no baja de 4) | Ámbar |
| Anuncios | ¿Qué anuncio funciona? | Los 3 ganadores con su miniatura real, grandes, y lo que trajo cada uno | Azul Meta |
| Funnel de llamadas | ¿Con quién hablo? | «Con quién hablas»: las próximas llamadas con su hora y su closer (el bloque no baja de 3) | Violeta |
| Ventas por WhatsApp | ¿Quién me espera? | Cuántos chats te esperan, gigante, con la burbuja de fondo (el catálogo no tiene un chat por fila: no hay «último mensaje» que listar) | Verde WhatsApp |
| Contenido y lanzamiento | ¿Me miran? | El ▶ de fondo y un reloj con el % que le da play a tu video | Rojo «play» |
| Agencia o servicio | ¿A quién atiendo? | Los 3 clientes que más te necesitan, con sus iniciales, su señal y su deuda | Teal |
| Curso o comunidad | ¿Mis alumnos avanzan? | El avance promedio gigante con su barra hacia el 100 % (el avance de los cursos no tiene un alumno por fila) | Celeste |
| **Instagram** (nueva) | ¿Qué me trae Instagram? | Un anillo: las agendas de Instagram contra Facebook (la audiencia de Meta por plataforma) | Magenta |

## Lo que se midió antes de prometerlo

Esto se consultó en la base de producción (15/10, sólo lectura) y es lo que decide si una
portada se puede dibujar de verdad:

- **Las miniaturas de los anuncios: SÍ.** Los 6 negocios con Meta tienen el 100% de sus
  anuncios de los últimos 30 días con miniatura (entre 11 y 53 cada uno).
- **Los mensajes de WhatsApp: SÍ.** Miles en 30 días (un negocio 8.800, otro 9.900).
- **Las fotos de los leads: casi no** (41 de 1.163 en el negocio con más datos, cero en otros
  dos). Por eso las personas van con sus iniciales y no con foto.
- **Las imágenes de las publicaciones: no.** El calendario no guarda imagen, así que
  «Contenido» abre con el ▶ del video y no con un post.
- **Los DM de Instagram: no.** No hay ningún negocio con Instagram conectado.
- ⚠️ **Los leads «de Instagram»: TAMPOCO** (corregido el 15/10, al implementar). Este documento decía «1.062 en un
  negocio, 277 en otro»: ese número era `origen_lead = instant_form`, los formularios de Meta, que son de Facebook O de
  Instagram. Medido con el lector que dibuja los gráficos (el origen es `origen_lead ?? utm_source`), ningún lead dice
  Instagram; sólo 53 tienen `utm_source = ig`, y los tapa su `origen_lead`. La plantilla abre con lo que SÍ hay para cada
  negocio con Meta: la audiencia por plataforma (agendas, clics e impresiones de Instagram contra Facebook). La lección:
  una portada se promete después de leer el dato con el MISMO lector que la va a dibujar, no contando filas con un `ilike`.

## Los colores

Una sola tabla para las dos galerías. La regla: **el mismo tema lleva el mismo color en las
dos** (WhatsApp verde en «Chat Analyst» y en «Ventas por WhatsApp», azul Meta en «Marketing» y
«Anuncios», ámbar en las dos de cobranza), y dentro de cada galería no se repite.

El choque del magenta se resolvió así: lo toma Instagram y Ads Analyst va en coral. «General» va en Noche: es el único
color libre que no nombra otro tema del Dashboard (el dorado es de las ventas).

## Lo que no cambia

- Arriba, UNA cosa: poco texto y pocos números. Lo que hay que mirar con detalle baja.
- Sólo tokens de la casa, y el contraste se verifica: el color acompaña, no informa solo.
- Los ejemplos de cada portada son **ficticios**, nunca los datos de un cliente real.
- Se mira en escritorio Y en el celular antes de darla por terminada.

<!-- prueba de despliegue tras la transferencia del repositorio a hola-mako (15/10) -->
