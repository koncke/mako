# Plantillas reales en Create: el plan (29/10/2026)

**Qué es:** el plan para que «Nuevo …» de las cinco tabs de Create (Copywriter, Video, Image, AI Avatar y Offer) muestre plantillas **llenas** (un ejemplo completo de un negocio ficticio) en lugar de rectángulos con un nombre. Cada tab suma un **agente experto editable en `/configuraciones`** que adapta la plantilla al negocio de quien la abre.
**Estado:** la tanda 0, la base común, está hecha (29/10/2026, rama `plantillas-base-2910`; sección 6). Las tabs, todavía no. Se midió contra `origin/main` `1cf06eba9` (29/10/2026, 13:55), leído con `git show` en un árbol limpio. La copia de OneDrive quedó en el 23/10 y da datos falsos.
**Cómo leerlo:** este README es lo común (unos 10 minutos). Cada tab tiene su archivo, con las plantillas enteras, el prompt base del experto y la implementación sobre el código de hoy.

| Tab | Archivo | Plantillas | El experto |
|---|---|---|---|
| Copywriter | [copywriter.md](copywriter.md) | 12 + «Página en blanco» | el Copywriter: un director de respuesta directa |
| Video | [video.md](video.md) | 11 + la receta de YouTube | el Editor de MaKo |
| Image | [image.md](image.md) | 12 | el Diseñador de MaKo |
| AI Avatar | [avatar.md](avatar.md) | 10 | el Director de avatar |
| Offer | [offer.md](offer.md) | 9 | el experto en ofertas, sobre el chat que ya existe |

**Qué se unificó al juntar las cinco partes** (cada una se escribió por separado):
- el elenco, con cuatro datos corregidos (2.2);
- los nombres de los campos de la tarjeta (sección 6, tanda 0);
- la carpeta de los avisos de licencia (sección 5);
- el botón «Adaptar a mi negocio» y el primer mensaje de MaKo (2.3), salvo en Offer, que abre pidiendo el documento;
- las referencias cruzadas: la miniatura «¿EL TUYO?» del video de YouTube y los números de plantilla que una tab cita de otra.

---

## 1. Qué se pidió

Martín, 29/10/2026, textual:

> «Los templates tienen que ser reales, tanto en las imágenes como en copywriter, como en todos lados, deben ser ejemplos reales, investiga skills o cómo lo hacen otros... Lo mismo investiga e implementa agentes skills o copia repositorios de agentes que sean expertos en guiones de ads, de YouTube, en edición, en "motion graphics", en miniaturas de YT, en todo lo que tenemos, así MaKo al entrar te da el template y te puede ir ayudando a crearlo»

Es la continuación del pedido de Create del mismo día ([diseno-create.md](../diseno-create.md)): «En "nueva" dependiendo de qué tab, deberías ponerme TEMPLATES con la sección de ¿Qué vas a crear hoy?».

Se pide:
1. cada plantilla trae un ejemplo real y completo, también en su miniatura;
2. un experto por tab, armado con lo mejor que haya con licencia abierta;
3. al abrir la plantilla, MaKo la adapta al negocio, de a un paso.

**El diagnóstico obvio era el equivocado en las cinco tabs.** No faltan plantillas ni estructuras: falta el ejemplo lleno y que la tarjeta lo muestre.
- **Copywriter:** ya tiene `pas`, `gancho-historia-cta`, `reel-viral`, `story-dia` y 5 VSL; el cuerpo nace vacío.
- **Video:** los tiempos y los huecos están bien y fijados por test; fallan el copy de e-commerce, el PNG gris «Tu clip» y que Create no dibuja la plantilla.
- **Image:** las 10 de Doory son de bodas, conciertos y currículums, con rectángulos grises donde va la foto. El texto ya está en español desde el 14/10 (`b9a7dae2f`); el comentario de cabecera de `app/image-editor/mako/plantillas.ts` todavía dice que no.
- **AI Avatar:** el preset decide si el avatar habla, y 9 de los 28 lo dejan mudo.
- **Offer:** el agente ya existe; falta la forma de cada tipo de oferta.

---

## 2. La regla común

### 2.1 Qué tiene una plantilla

Lo mismo en las cinco tabs:
- **La forma:** las secciones, los huecos, las capas o las piezas, con los nombres que el código ya usa (las etiquetas de `lib/guion-estructuras.ts`, los huecos de `lib/editor-video/plantillas.ts`, las capas con nombre de Image, `PropuestaOferta` de `lib/offer-marco.ts`).
- **Un ejemplo completo** de un negocio del elenco. El ejemplo no tiene nada «por completar».
- **Cuándo usarla:** una línea. En la tarjeta es el `title` (`ayuda`).
- **`pide`:** los hechos del negocio que el ejemplo usa, en orden. El experto pregunta solo los que el negocio no tiene.

### 2.2 El elenco: uno solo para las cinco tabs

Así hay menos nombres que verificar, y la persona reconoce el mismo negocio en el guion, en el video, en la miniatura y en la oferta. **Estos son los datos que valen.** Offer los corrigió para que cumplan su marco, y las otras cuatro partes ya están alineadas.

| Negocio | Quién (ciudad) | Rubro | La oferta |
|---|---|---|---|
| Cierre Consultivo | Andrea Salcedo (CDMX) | Coach de ventas para coaches | «Cierre Consultivo: 90 días»: 8 semanas en vivo y 5 de práctica revisada (13 semanas, 91 días). USD 1,500 de contado o 2 pagos de USD 800. 15 lugares por cohorte. **El embudo:** el anuncio vende un diagnóstico gratis de 30 minutos, en el que no se revisan grabaciones; la entrada paga es la «Revisión de 3 llamadas», USD 150, entregada en 5 días hábiles, que se acredita al programa. **Prueba:** 52 alumnas en 4 cohortes desde 2025; la mediana pasó de cerrar 2 a 4 de cada 10 llamadas, y 35 llegaron a 3 de cada 10 o más. Más de 80 revisiones vendidas desde mediados de 2025; 1 de cada 5 entró después al programa. |
| Consulta Rentable | Dra. Mariana Ochoa (Guadalajara) | Programa para nutriólogas | «Consultorio Lleno en 90 días»: 12 sesiones semanales y una semana de cierre. USD 1,200 de contado o 2 pagos de USD 650. 20 lugares. 140 alumnas desde 2023. **Lo que enseña a vender:** un plan de 3 meses con nombre y resultado (MXN 2,400 al mes), con una valoración de 20 minutos antes. Mariana atiende 40 pacientes al mes. **El embudo de una alumna** (sin nombre, no es Mariana): 60 mensajes, 18 valoraciones y 11 pacientes en un mes. Clase gratuita de 42 minutos: «Cómo llenar tu consulta online sin publicar todos los días». |
| Pulso Dental | Diego Ferrer (Bogotá) | Agencia para clínicas dentales | «Agenda de Implantes en 90 días»: USD 1,200 al mes más la inversión en anuncios, contrato de 3 meses, 2 clínicas nuevas por mes. Método 5-5-1. **31 clínicas atendidas desde 2022, en Colombia y México** (el total, no las activas: la meta es tener 12 activas). Auditoría gratis de 30 minutos. **Su historia:** en 2021 manejaba los anuncios de seis clínicas y perdió cuatro en un semestre. **Su análisis de 50 anuncios de clínicas:** 43 no traen pacientes y 7 sí; 38 anuncian la limpieza; respuesta promedio de 3 h 40 min, y 11 nunca contestaron. |
| Torre Alameda | Torre Alameda (Querétaro); la desarrolladora no lleva nombre | Inmobiliaria en preventa | 2 recámaras, 2 baños y 78 m², desde MXN 2,400,000 en la etapa 2 (MXN 2,520,000 en la etapa 3). **Enganche del 10 %:** apartado de MXN 20,000 y 18 mensualidades de MXN 12,222. **Crédito estimado:** MXN 18,900 al mes (MXN 2,160,000 a 20 años, con una tasa fija de referencia del 8.6 %; depende del banco). **Renta típica de la zona:** MXN 14,000. Entrega en diciembre de 2027. **Inventario:** quedan 46 de 96; 14 de ellos con vista al parque. La etapa 1 se entregó en la fecha del contrato y la etapa 2 lleva un 60 % de avance. |
| Voz de Líder | Rodrigo Ibarra (Lima) | Oratoria para gerentes | «Voz de Líder: 90 días»: 10 semanas en vivo, los martes, y 3 de práctica con la presentación real. USD 2,000 de contado o 2 pagos de USD 1,050. Equipo de 5: USD 8,500 con factura. 12 por cohorte. 86 gerentes en 8 cohortes desde 2024. Las inscripciones cierran el viernes a las 11:59 p. m. (hora de Lima). |

**Los clientes de los casos también son inventados:**
- el Dr. Felipe Cárdenas, de la Clínica Dental Altamira (Medellín): de 6 a 23 valoraciones al mes en el mes 3, 9 tratamientos, con la misma inversión;
- Lucía Garza, nutrióloga de Monterrey: de 6 a 21 pacientes en la semana 9, y su consulta de MXN 600 a 900;
- Carla, gerente de operaciones (presentó el presupuesto anual sin que la interrumpieran), y Gabriel (le aprobaron su proyecto en el primer comité), alumnos de Voz de Líder;
- Karen Méndez, asesora de Torre Alameda;
- «una clínica de Puebla», sin nombre: bajó las inasistencias del 34 % al 12 %.

**Los cuatro datos que cambiaron.** El marco de Offer y su código (`lib/offer-reglas.ts`) marcaban el elenco viejo (offer.md, trampa 4): 8, 10 y 12 semanas dan menos de 90 días; USD 997 da nivel `medio`, que el código trata como alto; y 3 × USD 550 o 4 × USD 275 cobran menos del 50 % al inicio (marco §6.6). Es la tabla de offer.md 2.0:

| Negocio | Antes | Ahora |
|---|---|---|
| Cierre Consultivo | Programa de 8 semanas | 90 días: 8 semanas en vivo y 5 de práctica revisada |
| Cierre Consultivo | 3 pagos de USD 550 | USD 1,500 de contado, o 2 pagos de USD 800 (hoy y a 30 días) |
| Consulta Rentable | 12 semanas, USD 997 (o 4 pagos de USD 275) | 90 días, USD 1,200 de contado, o 2 pagos de USD 650 |
| Voz de Líder | 10 semanas | 90 días: 10 semanas en vivo y 3 de práctica |

**Los 90 días son de verdad.** La primera corrección decía «8 semanas en vivo y 4 de práctica»: 12 semanas, 84 días, el mismo largo que se rechazó en Consulta Rentable. Pasaba la regla solo porque `duracionEnDias` lee el primer «N unidad» del texto, y el texto empieza con «90 días» (offer.md, trampa 5). Ahora las tres ofertas suman 13 semanas.

Se corrigió en las cinco partes, también en los guiones que repetían esos datos:
- Copywriter: plantillas 3, 6, 8 y 11;
- Video: plantillas 1, 3 y 4;
- Image: plantillas 1, 8 y 12;
- AI Avatar: plantillas 1, 3, 8 y 9.

**Las reglas de los ejemplos:**
- **Nombres:** se buscaron en la web el 29/10. «Cierre consultivo» es un término genérico de ventas, y existe un libro, «La voz del líder». «Sonríe Studio» se quitó por genérico. «Desarrolladora Altavista» también se quitó: en Querétaro existen la constructora «Grupo Altavista» y el desarrollo «Altavista Juriquilla», así que Torre Alameda queda sin desarrolladora con nombre. **La búsqueda se repite antes de publicar.** Ningún ejemplo usa un nombre de la lista `REALES` de `tests/variables-aviso.test.ts` («Martín», «Dental Ramos», «Vértice»…).
- **Español neutro con «tú»:** el guard de voseo (`tests/puente-panel-copy.test.ts`) barre los `.ts` y `.tsx` de `lib/` y `app/`. El texto que vive en `.json` (los lienzos de Image) no lo ve, y necesita su propio test. Tampoco ve los regionalismos que no son voseo, como «dar vuelta» por «darle la vuelta». En AI Avatar el guion hablado sigue el acento del negocio (`acentoEsVoseante`).
- **Cifras:** las de la tabla del elenco. Una cifra que más de una tab repite va en la tabla, así se puede comprobar que todas digan lo mismo. Un dato de una sola pieza (el ejemplo de un mensaje o un minuto de la clase) es texto de muestra y el detector lo marca. No entran:
  - las cifras de afuera sin fuente: el 71 % que decide en 3 s, el 55 % que se va en el primer minuto y el 70 % de retención a los 30 s de claude-youtube;
  - una escasez que no se puede comprobar, como «la cohorte se llenó en 6 días».
- **Resultados:** un resultado con número dice que es un caso y no una promesa. En el anuncio no van la facturación propia ni resultados de salud o de ingresos (políticas de Meta).
- **Escasez:** solo si es real y se puede comprobar (informe de la FTC sobre patrones engañosos). El ejemplo lo marca: «solo si es real».
- **Fechas:**
  - en Offer, el inicio de una cohorte se guarda en días desde hoy y se calcula al mostrar;
  - en Video e Image, la fecha de la clase del ejemplo es un texto de muestra: el detector la marca y el experto la reemplaza por el evento real;
  - un mes suelto en un guion («cohorte de mayo») es texto de muestra y se reemplaza al adaptar.
- **Precios:** en formato de México (`USD 1,500`).
  - En las piezas de Offer van completos y con moneda (`MXN 2,400,000`), porque `precioDe` y `nivelDeOferta` los leen.
  - En pantalla vale la forma corta («Desde MXN 2.4 M»).
  - En los guiones hablados de AI Avatar van con letras («mil quinientos dólares»), porque la duración se calcula contando palabras.
- **Caras:**
  - Video no usa personas de stock: las muestras son manos, pantallas, interiores y la obra.
  - En Image, ninguna cara de stock va en un «antes», en un fracaso, en un testimonio ni junto a un pago, una cifra del negocio o una credencial. La tarjeta de la galería es pública y no pasa por la guarda de descarga. Por eso, en las plantillas 1 y 12, «Tu foto» es una silueta propia, sin cara. Solo la versión B de la miniatura 2 usa una cara de Pexels, que no se descarga sin reemplazarla.
  - AI Avatar nunca usa caras de stock: el elenco tiene retratos de personas inexistentes hechos en Flow, uno por persona y con su rótulo.
  - **Pendiente de decidir:** usar esos mismos retratos en Image cuando existan, así Andrea es la misma en las cinco tabs.
- **Lo que falta al adaptar** va como `[DATO: …]`. En Offer va `[completar]`, que ya existe en su código (`seccionesExternas` lo saca del PDF).

### 2.3 Qué pasa al abrir una plantilla

1. **La pieza nace con el ejemplo completo y el rótulo** «Ejemplo: <negocio> (negocio ficticio)».
2. **MaKo, en el chat de la izquierda, manda un mensaje local, sin llamar a la IA** (no gasta la IA del cliente sin que lo pida): «Es un ejemplo de <negocio>, un negocio ficticio. ¿Para cuál de tus ofertas es?», con las ofertas como botones (con una, «¿Es para «X»?»; sin ninguna, «¿Qué vas a vender con esto?»). El último botón depende de la tab. ⚠️ Hasta el 5/11/2026 decía «¿Lo adapto a tu negocio?» con «Adaptar a mi negocio» primero: preguntaba una ACCIÓN, y la primera pregunta de MaKo es de HECHO (docs/mako-iniciativa/plan.md T4; `pasoOferta`, lib/aperturas/comunes.ts).
   - **La excepción es Offer.** Su chat ya existe, y adaptar empieza por el documento de la oferta. Abre con la misma primera frase y sigue con el pedido de siempre: «Es un ejemplo de <negocio>, un negocio ficticio. Para adaptarlo a tu oferta, ¿tienes un documento, tu guion de ventas o el link de tu web? Súbelo o pégalo aquí.». Su único botón es «No tengo, pregúntame» (offer.md, 3.5).
3. **«Adaptar a mi negocio»:**
   - lee el negocio;
   - compara `pide` con lo que hay;
   - pregunta lo que falta de a una pregunta, por hechos, y como máximo tres antes de escribir;
   - escribe la pieza entera como propuesta (Aceptar o Descartar, como hoy);
   - lo que sigue faltando va como `[DATO: …]`.
4. **Mientras queden restos del ejemplo** (bloques o textos iguales a los de la muestra, fotos de muestra o un `[DATO:`), un aviso lo dice antes de copiar, exportar, descargar o filmar. Donde cuesta plata o expone al cliente, la guarda va en el server.

| Tab | Dónde va el rótulo | El segundo botón | La guarda dura |
|---|---|---|---|
| Copywriter | Un destacado 🧪 arriba, fuera de las secciones (no se graba) | «Solo la estructura»: deja el esqueleto, con «Deshacer» | La API de MaKo crea páginas con `esqueleto()`, nunca con el ejemplo |
| Video | El aviso del chat y las marcas `ejemplo: true` de la línea de tiempo | «Lo edito yo» | El diálogo de exportar nombra los textos de muestra que quedan |
| Image | Una tira arriba del lienzo, que se va cuando no quedan muestras | «Lo edito yo» | Una foto `persona-` o `lugar-` de muestra no se descarga |
| AI Avatar | El primer mensaje del Director | «Ver el ejemplo completo» | `crearVideoAction` rechaza un guion con marcas del ejemplo: cada toma gasta créditos |
| Offer | El ejemplo en el centro, en gris; se pliega a «Ver el ejemplo» con la primera pieza propia | Sin «Adaptar a mi negocio»: el primer mensaje pide el documento o la web, como hoy, con el botón «No tengo, pregúntame» | Usarla pide un funnel: sin funnel, la tarjeta lo dice |

### 2.4 Qué lee el agente

- **El negocio:** `contextoDelNegocio` (`lib/copywriter/contexto.ts`: el Second Brain, con un tope de 1,800 tokens). Va a un `lib/` común en la tanda 0, porque hoy Video e Image no leen el negocio.
  - Ese común lee el grafo con `grafoParaChat` (`lib/cerebro-para-chat.ts:33`), que está en `main` desde el 28/10 (`c272b97dd`) y ya lo usa `lib/api-mako/areas/negocio.run.ts`. **Hecho en la tanda 0:** vive en `lib/negocio-para-crear.ts`, y `lib/copywriter/contexto.ts` quedó como re-exportación.
  - **Nombres que ya existen:** `lib/plan-senales.ts` exporta otra `contextoDelNegocio`, con otra firma. Lo mismo pasa con dos nombres que el borrador proponía para la tanda 0: `gruposDePlantillas` (`lib/copywriter/plantillas.ts:162`) y `miniaturaDe` (`app/crm/lead-view/ficha/galeria.ts:99` y `lib/embeds.ts:665`). Las funciones nuevas se llaman `seccionesDeCrear` y `cajaDeMiniatura`.
- **La voz:** `vozDelNegocio` (`lib/nutricion-generator.ts`) y `vozParaPrompt` (`lib/offer-ia.ts`), la misma fuente que el slot `{{voz}}` de los prompts `offer.*`.
- **El ejemplo:** va en el prompt marcado FICTICIO, como forma y nunca como dato del dueño. **Nunca** entra en las fuentes con las que el código valida cifras (`ContextoReglas.fuentes` de Offer). Sí van envueltos con `contenidoNoConfiable` lo que escribió la persona y su negocio.
- **No publica, no envía y no gasta:** cada experto entrega su pieza en su tab y la persona la acepta.

### 2.5 La miniatura muestra contenido real

| Tab | Qué dibuja la tarjeta | Imágenes |
|---|---|---|
| Copywriter | Una hoja: la insignia («📣 Anuncio · 45 s»), las primeras líneas reales del gancho y los chips de las secciones. Sale del mismo ejemplo (`extractoDe`, `chipsDe`), así que nunca se desfasa. | Ninguna |
| Video | La plantilla misma, dibujada por `MiniaturaPlantilla` (que hoy solo usa la pestaña Plantillas del editor), con las muestras de Pexels y la insignia «Sugerida · 24 s · 1 clip». Si el chunk arrastra el WASM del motor, va un póster WebP. | ~30 clips de Pexels sin caras |
| Image | La pieza terminada (WebP de `public/cv/plantillas/`), **a su proporción**: hoy la tarjeta recorta todo lo que no es 4:3. Insignia «1 de N» o «2 versiones». Ninguna tarjeta muestra una cara de stock. | 5 fotos de Pexels y una silueta propia |
| AI Avatar | El marco 9:16 con el texto en pantalla del gancho, la primera frase y los chips. El póster y el loop llegan cuando el motor ande. | Ninguna por ahora |
| Offer | Una hoja 3:4 con el negocio, el nombre de la oferta, la frase y tres chips: precio, garantía y escasez. | Ninguna |

Las tarjetas se agrupan (`grupo`): Copywriter, por canal; Video, por objetivo; Image, por formato; Offer, por lo que vende el negocio.

---

## 3. Las plantillas, tab por tab

### 3.1 Copywriter · [copywriter.md](copywriter.md)

| # | Plantilla | Cuándo | Negocio |
|---|---|---|---|
| 1 | Anuncio a cámara (PAS), 45 s | Tráfico frío: nombra el problema y vende una llamada | Cierre Consultivo |
| 2 | Testimonio de cliente, 40 s | Un cliente cuenta su antes y después, grabado con su celular | Pulso Dental |
| 3 | Copy de anuncio: 3 ángulos | Tres textos con ángulos distintos para probar en una campaña | Consulta Rentable |
| 4 | 10 ganchos para un anuncio | Diez aperturas para el mismo anuncio: gana la que frena el scroll | Torre Alameda |
| 5 | Reel que trae mensajes, 52 s | Enseña algo útil y termina en una conversación por mensaje | Cierre Consultivo |
| 6 | Stories que venden (7) | Siete stories de una sola idea que terminan en un mensaje directo | Voz de Líder |
| 7 | Carrusel que se guarda (10) | Una lista útil que la gente guarda y que termina en un mensaje | Torre Alameda |
| 8 | Email de cierre | Vende una cohorte con fecha de cierre real | Voz de Líder |
| 9 | 5 emails tras una descarga | Lleva a quien descargó tu guía hasta agendar, en 10 días | Consulta Rentable |
| 10 | VSL para agendar, 10 min | El video de la página de agenda, para tráfico frío | Pulso Dental |
| 11 | Clase gratuita: 3 claves, 42 min | Enseñas de verdad y la oferta llega al final, ganada | Consulta Rentable |
| 12 | YouTube de 12 minutos | Un video largo que sostiene la atención y trae clientes | Pulso Dental |

### 3.2 Video · [video.md](video.md)

| # | Plantilla | Cuándo | Negocio |
|---|---|---|---|
| 1 | Anuncio con gancho, 24 s | Anuncio o reel que vende una llamada a público frío | Cierre Consultivo |
| 2 | Respuesta a un comentario, 28 s | Responde una objeción de precio o de confianza a quien ya considera comprar | Cierre Consultivo |
| 3 | Lo que te llevas, 15 s | Retargeting: tres entregables concretos y agendar | Voz de Líder |
| 4 | Testimonio de cliente, 33 s | Un cliente **real** cuenta su resultado; abre con el resultado | Consulta Rentable (Lucía Garza) |
| 5 | Caso con números, 25 s | Un resultado medible, con la captura del panel encima | Pulso Dental (Altamira) |
| 6 | Historia del fundador, 30 s | Orgánico de conexión: antes, quiebre y hoy | Pulso Dental |
| 7 | Reel de 3 errores, 38 s | Autoridad: enseña algo concreto y termina en un mensaje | Voz de Líder |
| 8 | Clip de podcast o clase, 40 s | Sacar un clip vertical de un video largo | Cierre Consultivo |
| 9 | Invitación a clase en vivo, 16 s | Llenar el registro de una clase gratuita | Consulta Rentable |
| 10 | Tour de propiedad, 24 s | Presentar una propiedad: un espacio por toma y una visita como llamado | Torre Alameda |
| 11 | Antes y después, 14 s | Mostrar un cambio con el mismo encuadre (el avance de una obra) | Torre Alameda |
| — | Receta: YouTube con retención, 12 min (16:9) | El plan de edición del video largo que sube la persona; no es de huecos | Pulso Dental |

Se retiran `gancho-escrito` y `oferta-glitch`: con el ejemplo lleno serían tarjetas repetidas.

### 3.3 Image · [image.md](image.md)

| # | Plantilla | Cuándo | Negocio |
|---|---|---|---|
| 1 | Miniatura · Resultado con cara · Coach | Tu video cuenta un resultado tuyo y vas a salir a cámara | Cierre Consultivo |
| 2 | Miniatura · Número sin cara · Agencia | Tu video revela un número que sorprende, sin que tengas que salir | Pulso Dental |
| 3 | Carrusel · 3 frases que matan la venta · Coach | Quieres que te escriban por mensaje enseñando algo concreto | Cierre Consultivo |
| 4 | Carrusel · Mito vs. realidad · Infoproducto | Tus clientes creen algo que les impide comprar y tienes datos para responder | Consulta Rentable |
| 5 | Carrusel · Caso con números · Agencia | Tienes un cliente con permiso para mostrar su resultado | Pulso Dental |
| 6 | Publicación · Ficha de propiedad · Inmobiliaria | Quieres mostrar una propiedad y que te escriban para visitarla | Torre Alameda |
| 7 | Publicación · Creencia al revés · Formación | Escuchas siempre la misma creencia y quieres darle la vuelta | Voz de Líder |
| 8 | Historia · Últimos lugares · Formación | Cierras inscripciones y quedan lugares de verdad | Voz de Líder |
| 9 | Historia · Invitación a clase · Infoproducto | Das una clase en vivo y quieres que se registren desde tus historias | Consulta Rentable |
| 10 | Anuncio · Carta del fundador · Agencia | Llegar a gente que no te conoce contando por qué empezaste | Pulso Dental |
| 11 | Anuncio · Comparación · Inmobiliaria | Tu cliente duda entre tú y otra opción | Torre Alameda |
| 12 | Presentación · Clase que vende · Infoproducto | Das una clase o un webinar que enseña y termina en tu oferta | Consulta Rentable |

Las 10 de Doory salen de «Nuevo diseño». El crédito visible de Doory ya no está: el 29/10/2026 Martín decidió sacarlo, a su riesgo. Su licencia sigue en `app/image-editor/_doory/` mientras quede código suyo (docs/hallazgos-editor-imagen.md).

### 3.4 AI Avatar · [avatar.md](avatar.md)

| # | Plantilla | Cuándo | Negocio | Preset |
|---|---|---|---|---|
| 1 | Confesión en el auto | Público frío, para vender una llamada de diagnóstico; lo-fi | Cierre Consultivo | `auto-testimonio` |
| 2 | Respondo un comentario | Retargeting y la objeción de precio | Cierre Consultivo | `selfie-iphone` |
| 3 | Pizarra: el método en 3 pasos | Invitar a una clase gratuita en vivo | Consulta Rentable | `pizarra-estudio` (nuevo) |
| 4 | Mañana en la cocina | Orgánico o tráfico tibio; el CTA es por mensaje | Consulta Rentable | `cocina-manana` (nuevo) |
| 5 | Episodio de podcast | Autoridad en frío; cierra en la auditoría gratis | Pulso Dental | `podcast-experto` (a medir) |
| 6 | Caso de un cliente, caminando por la oficina | Prueba social contada **por el dueño** | Pulso Dental | `oficina-presentador` |
| 7 | Recorrido de la preventa | Preventa con público tibio; el departamento solo en material oficial | Torre Alameda | `oficina-presentador` |
| 8 | Entrevista en la calle | Público frío: responde la pregunta del cliente ideal | Voz de Líder | `calle-microfono` (nuevo) |
| 9 | Carta del fundador (cierre de cohorte) | Al cierre de inscripciones, con fecha y cupo reales | Voz de Líder | `despacho-noche` (nuevo) |
| 10 | Pantalla dividida: renta o mensualidad | La objeción «rentar o comprar» | Torre Alameda | `sala-de-ventas` (nuevo) |

No hay «Testimonio en el sillón»: un avatar no se presenta como cliente (la regla de la FTC de 2024 y la política de IA generativa de Google). Tampoco van como plantillas de venta los 9 presets en los que el avatar no habla, ni los de cuerpo, gimnasio y lujo.

### 3.5 Offer · [offer.md](offer.md)

| # | Plantilla | Cuándo | Negocio |
|---|---|---|---|
| 1 | Programa con garantía de aplicación | Un programa en grupo donde el cliente aplica una habilidad con tu revisión, y ya tienes casos | Cierre Consultivo |
| 2 | Cohorte con resultado rápido | Un grupo con fecha de inicio y de fin, con un resultado en la primera semana | Consulta Rentable |
| 3 | Servicio hecho por ti | Haces el trabajo por el cliente y cobras por mes con un mínimo | Pulso Dental |
| 4 | Entrada que se acredita | Tu oferta principal ya vende y quieres una entrada barata (fase 2 del marco) | Cierre Consultivo |
| 5 | Precio por tramos | El mismo programa lo compran personas y empresas | Voz de Líder |
| 6 | Preventa por etapas | Un inmueble que se entrega en el futuro, con precio por etapa | Torre Alameda |
| 7 | Primera camada, sin casos | Tu oferta es nueva y todavía no tienes casos con números | Voz de Líder, en su lanzamiento |
| 8 | Revisar tu oferta: antes y después | Ya vendes algo y no cierra como quieres | Pulso Dental, con su oferta vieja |
| 9 | Continuidad para egresados | Tus egresados te piden seguir (fase 2) | Consulta Rentable |

Las de hoy («Crear una oferta nueva» y «Analizar «X»» por funnel) quedan arriba, en «Tus funnels».

---

## 4. El agente experto editable: el patrón

**La regla que lo gobierna:** un slot nuevo en un prompt que alguien ya editó **nunca llega**, porque su versión guardada no lo tiene, y no da ningún error. Además, los system de los chats de Video e Image son `sensitive` y `static-only`, y no se tocan. Por eso el método del experto va en una **key nueva que el código suma** al system de siempre, y el pedido de adaptar va en una **key `user` nueva**. Ningún prompt existente cambia.

| Tab | El experto | Keys nuevas | Cómo entra | Lo que no se toca |
|---|---|---|---|---|
| Copywriter | el Copywriter | `copywriter.experto` (instruction, sin slots) · `copywriter.adaptar.user` (slots: `plantilla`, `ejemplo`, `pide`, `guion`, `estructura`, `negocio`, `charla`) | El código antepone el experto a REGLA_NO_EXISTE en el system de «Discutir» y en el de «Editar». «Adaptar» usa el system de «Editar» con el user nuevo. | `copywriter.discutir.*`, `copywriter.editar.*` |
| Video | el Editor de MaKo | `video_editor.experto` (instruction, sin slots) · `video_editor.adaptar.user` (`plantilla`, `ejemplo`, `huecos`, `negocio`, `voz`, `instruccion`, `linea`) | `brandSystem(experto + chat.system)` en los dos modos | `video_editor.chat.*` |
| Image | el Diseñador de MaKo | `image_editor.experto` (instruction, sin slots) · `image_editor.adaptar.user` (`plantilla`, `ejemplo`, `negocio`, `voz`, `respuestas`, `puede_preguntar`, `diseno`) | Antes del system del chat, en todos los pedidos. «Adaptar» corre con su propia feature, `image-editor-adaptar` (`lib/model-catalogo.ts`). | `image_editor.chat.*` |
| AI Avatar | el Director de avatar | `ai_avatar.director.system` · `ai_avatar.director.user` (`plantilla`, `estructura`, `escena`, `largo`, `ejemplo`, `negocio`, `pide`, `charla`, `pedido`), con `FORMATO_DIRECTOR` en el código | Es un chat nuevo: la tab no tenía uno, así que no hay override que proteger | La regla de identidad del look («la persona inalterada»), que sigue en el código (`lib/ai-avatar/prompt-look.ts`) |
| Offer | el experto en ofertas | `offer.experto` (instruction, `static-only`, slots: `forma`, `ejemplo`, `preguntas`) | El código lo suma al system del turno (antes de `reglaNoExisteEn`) y al de la propuesta, **solo** si la conversación nació de una plantilla. No va en el diagnóstico. | `offer.turno.*`, `offer.propuesta.*`, `offer.diagnostico.*` y la segunda capa de `lib/offer-reglas.ts` |

**El método es el mismo en las cinco tabs** (sale de las skills MIT de la sección 5, traducidas y adaptadas a high ticket en Latinoamérica):
1. Lee el negocio antes de preguntar.
2. Dice en una línea en qué caso está: hoja en blanco, borrador con voz propia (la conserva) o cambio puntual (toca solo eso).
3. Propone antes de tocar:
   - Copywriter, 3 ángulos si le piden ideas;
   - Video, la estrategia en 4 a 8 frases, y espera el sí antes de cortar;
   - Image, 2 versiones de la miniatura (con cara y sin cara);
   - AI Avatar, el guion con 3 ganchos para elegir;
   - Offer, de a una palanca por vuelta.
4. Pregunta por hechos, de a una pregunta y solo lo que falta. Como máximo tres antes de escribir (en Offer, las de la forma, en su orden).
5. Escribe la pieza entera como propuesta y deja `[DATO: …]` donde falte algo.
6. Se revisa con su lista antes de entregar: cero datos inventados, nada del ejemplo, las reglas de Meta y el español neutro.
7. Ofrece **un** próximo paso. Las variantes (más ganchos, otro CTA) van en la respuesta del chat, nunca en la pieza: al copiar el texto se leerían como guion.

**Cómo se registra:** con la skill `add-editable-prompt`:
- una entrada en `lib/prompt-registry.ts`;
- el default exportado en el archivo de la tab;
- `renderPrompt(key, default, vars)`.

Antes de subir se corre `verify-prompt-registry-sync`.

**Con qué modelo corre:** con el que se elige en `/modelos-ia`.
- `image-editor-ia` tiene Gemini por defecto (`lib/model-catalogo.ts:241`), y la decisión del 22/10 es «sin Gemini». Por eso Image suma la feature `image-editor-adaptar`, y la contradicción queda abierta.
- En Video hay que verificar qué modelo contesta `video-editor-ia` antes de medir al experto.
- El turno de Offer corre con un modelo chico (`gemini-flash-lite-latest`, 2,000 tokens): el bloque del experto tiene tope y va antes de la regla de lo que no existe.

**Las pruebas del experto** (evals) usan el formato de marketingskills (`prompt`, `expected_output`, `assertions`). Video y Offer ya listan las suyas; las de Copywriter quedan pendientes.

---

## 5. Qué se copia y de dónde

**Solo entra lo que tiene licencia verificada** (el LICENSE se leyó el 29/10/2026 en `raw.githubusercontent.com`, o la página de la licencia) y uso «copiar» o «copiar con crédito». Todo se **traduce y se reescribe** para high ticket en Latinoamérica: no se pega texto en inglés.

**El aviso** (decisión de esta síntesis): una sola copia literal por repo en `lib/avisos/LICENSE-<REPO>`, y la cabecera de cada archivo que toma algo la nombra. Es el molde de `LICENSE-DOORY` y `LICENSE-OPENCUT`, pero en un solo lugar: marketingskills lo usan cuatro tabs, y cuatro copias del mismo archivo se desfasan. Se conserva el aviso aunque solo se tome el método.

| Fuente | Licencia exacta | Qué se toma | Tab | Aviso |
|---|---|---|---|---|
| https://github.com/coreyhaines31/marketingskills | MIT License, «Copyright (c) 2025 Corey Haines» | **Copywriter:** de `skills/copywriting/SKILL.md`, el diagnóstico del insumo, las tres preguntas (imaginar, comprobar, el competidor), escribir por partes y las muletillas; de `skills/ad-creative/references/hook-system.md`, las tres capas del gancho, la matriz segmento × motivación × formato y una variable por prueba; de `skills/emails/references/sequence-templates.md`, la secuencia de nutrición, comprimida a 5 correos. **Image:** el nivel de cada anuncio estático y «real names, real stats, and real quotes only» (`static-ad-templates.md`). **AI Avatar:** de `skills/video/SKILL.md`, cuándo conviene un avatar, la fórmula sujeto + acción + cámara + estilo + ánimo, los subtítulos siempre y el texto por overlay. **Offer:** de `skills/offers/`, el bucle de diagnóstico, la garantía según el miedo más grande, un bono por objeción, la escasez honesta, el formato antes → diagnóstico → después y `evals.json`. **No** se toma su regla de valor apilado menor a 2 veces el precio, que contradice el marco. | Copywriter, Image, AI Avatar, Offer | `LICENSE-MARKETINGSKILLS` |
| https://github.com/retieedra-profound/skills-marketing-library | MIT License, «Copyright (c) 2026 Profound» | El origen que marketingskills acredita para el diagnóstico, las tres preguntas y escribir por partes | Copywriter | `LICENSE-PROFOUND` |
| https://github.com/agricidaniel/claude-youtube | MIT License, «Copyright (c) 2025 Daniel Agrici» | De `sub-skills/script.md`: el gancho de 30 s en tres tiempos, los bloques que abren con una interrupción y cierran con un resumen y un puente, el CTA al 25 %, el regancho al 60 %, el cierre sin despedida, unas 150 palabras por minuto, el registro de interrupciones y el mapa de riesgos. **Sin** sus metas numéricas. | Copywriter (`youtube-retencion`); Video la edita | `LICENSE-CLAUDE-YOUTUBE` |
| https://github.com/thecraighewitt/skills | MIT License, «Copyright (c) 2026 Craig Hewitt» | De `youtube/retention-editing/SKILL.md`: el ritmo por sección, nada quieto más de 30 s, de 2 a 4 acercamientos por minuto, una toma de apoyo cada 30 a 60 s, menos de 5 s de silencio involuntario, los 5 patrones de la curva de retención y el checklist | Video | `LICENSE-CRAIGHEWITT-SKILLS` |
| https://github.com/browser-use/video-use | MIT License, «Copyright (c) 2026 Browser Use» | De `SKILL.md`: aprobar el plan antes de cortar, no cortar en mitad de una palabra, los subtítulos al final, los umbrales de silencio (400 ms; de 150 a 400 ms con revisión), 50/80 ms de aire, subtítulos de 2 palabras con un mínimo de 0.35 s, la música de 12 a 15 dB debajo de la voz y la autorrevisión en 3 vueltas | Video | `LICENSE-VIDEO-USE` |
| https://github.com/AgriciDaniel/claude-shorts | MIT License, «Copyright (c) 2026 Daniel Agrici» | La lógica del recorte: los pesos 30/25/20/15/10, el umbral de 60, de 8 a 12 candidatos, el gancho en texto en los primeros 3 s, los bordes en palabras y oraciones. **No el render**: depende de Remotion. | Video | `LICENSE-CLAUDE-SHORTS` |
| https://github.com/WyattBlue/auto-editor | The Unlicense (dominio público) | Los valores por defecto del borrado de silencios, como referencia para calibrar `borrar_silencios` (hay que verificarlos en su código) | Video | no exige |
| https://github.com/diffusionstudio/lottie | MIT, «Copyright (c) 2026 Diffusion Studio Inc.» | Más adelante: la skill para que la IA escriba un Lottie con la marca del negocio | Video | `LICENSE-DIFFUSIONSTUDIO-LOTTIE` |
| https://kenney.nl/assets/interface-sounds | Creative Commons CC0 (solo este pack se verificó) | Pop, click y whoosh, cuando las plantillas tengan una pista de audio (hoy no la tienen) | Video, tanda 3 | no exige |
| https://github.com/aabrole/claude-video-thumbnail-skill | MIT License, «Copyright (c) 2026 aabrole» | Las reglas de miniatura: 3 elementos como máximo, las composiciones, la esquina de abajo a la derecha libre, las zonas seguras, la legibilidad a 320 × 180 y el texto que complementa el título; las 2 versiones | Image | `LICENSE-VIDEO-THUMBNAIL-SKILL` |
| https://github.com/charlie947/social-media-skills | MIT License, «Copyright (c) 2026 Charlie Hills» | El brief de miniatura, los topes del carrusel (titular de 8 palabras y cuerpo de 15) y la revisión a ~360 px. **Sin** el circuito de Gemini. | Image | `LICENSE-SOCIAL-MEDIA-SKILLS` |
| https://github.com/jeevanbavandla/instagram-carousel-skill | MIT License, «Copyright (c) 2026 Jeevan Bavandla» | Los estilos según el contenido, la cabecera con iniciales, la barra de progreso, la flecha y la última diapositiva con la acción | Image | `LICENSE-INSTAGRAM-CAROUSEL-SKILL` |
| https://github.com/motion-creative/skills | MIT, «Copyright (c) 2025 Motion» | `hook-writing` (los 8 disparadores y la terna dicho, visual y texto) y `ugc-scriptwriter` (el arco y los errores frecuentes). Sin la promoción de «Motion». | AI Avatar | `LICENSE-MOTION-SKILLS` |
| https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide | Contenido «Creative Commons Attribution 4.0»; código «Apache 2.0» | El vocabulario de cámara, lente y luz de los presets nuevos y la regla del negativo. **Sin** «eye-level», «hair light» ni «skin», que disparan la guarda de cara. | AI Avatar | crédito en la cabecera de `lib/ai-avatar/plantillas.ts` |
| https://www.pexels.com/license/ | Pexels License: uso libre, también comercial, se puede modificar y no exige atribución. **Prohíbe** mostrar a personas identificables de forma negativa, insinuar que respaldan algo, vender copias sin cambios y redistribuir en otras plataformas de stock. | Elegidos a mano en la web, sin la API, y guardados en el storage propio: ~30 clips y fotogramas sin caras (`public/video-editor/plantillas/`, con el crédito «Video de X en Pexels» en `ejemplo.creditos`) y 5 fotos (`public/cv/plantillas/fotos/`). La API (link visible, 200 pedidos por hora y 20,000 por mes) solo si Video busca stock desde el chat, en la tanda 3. | Video, Image | crédito por archivo (no obligatorio) |
| `docs/offer-marco.md` (`origin/main`) | Propio de MaKo | Las 20 secciones, la rúbrica D1-D9 y las reglas de precio, cuotas, garantía, bonos y urgencia | Offer | — |

**Solo como idea** (no se copia ni el texto ni el nombre):

| Fuente | Por qué |
|---|---|
| agency-agents (MIT, verificada) | Solo se leyó `paid-media-creative-strategist.md`: la idea del creativo como hipótesis. |
| canvas-design de anthropics/skills (Apache 2.0, verificada) | La idea de la pieza antes de la composición. No se copia texto. |
| HyperFrames (Apache 2.0) | Cada bloque corre sobre GSAP, cuya licencia gratuita prohíbe usarlo en herramientas de animación sin código: eso es el editor. Se toman los tiempos y el orden por intención. |
| Remotion | Licencia propia: gratis hasta 3 empleados; las demás empresas pagan. Nadie lo mete en el editor. |
| Unsplash (licencia verificada) | Prohíbe compilar sus fotos «to replicate a similar or competing service», y su API exige hotlink. |
| fal-ai-community/skills | El README dice «MIT», pero no hay LICENSE (dos 404). |
| La skill de Higgsfield, las docs de HeyGen | Sin licencia o propietarias: solo los hechos. |
| wondelai `hundred-million-offers`, fabric `create_hormozi_offer`, startup-ideation-kit | La MIT de un repo no da derechos sobre el libro de Hormozi del que salen. «Grand Slam Offer» y «$100M» no van en el producto. |
| Acquisition.com, el memo de MrBeast, «Perfect Webinar», «Hook, Story, Offer», «Hook-Retain-Reward», los estilos «Hormozi» y «Ali Abdaal», los marcos con nombre de los cursos | Copyright, documentos filtrados o nombres de personas y de marcas. |
| Notion, Canva, Jasper, Copy.ai, Swiped, Foreplay, CapCut, Descript, Opus Clip, Submagic, Kapwing, Arcads, Creatify, HeyGen, PandaDoc, Proposify | Productos con copyright: se toma el modelo de mostrar (la tarjeta es la pieza terminada, «View template» abre la página llena). Jasper y Copy.ai son lo que **no** se copia: la tarjeta con nombre y sin ejemplo. |
| Wikipedia («AIDA») | CC BY-SA 4.0, con share-alike. |
| Las políticas de Meta y de Google, la FTC, las guías de TikTok y de YouTube, vidIQ, 1of10, el blog de Jordan Glickman | Se citan los hechos, no el texto. |
| Coverr, Mixkit, la música de Pixabay, la API de Freesound, LottieFiles | Según la investigación (no se releyó), excluyen editores, productos que compiten, la redistribución o el uso como servicio. |

---

## 6. El orden de implementación

**Tanda 0, la base común** (una sola vez, antes de cualquier tab). **Hecha el 29/10/2026**, rama `plantillas-base-2910`:
- la tarjeta: `app/_crear/TarjetaPlantilla.tsx`;
- el rótulo y el primer mensaje: `app/_crear/ejemplo.ts`;
- el negocio: `lib/negocio-para-crear.ts`;
- las once licencias: `lib/avisos/`;
- los tests: `tests/_reales.ts` (`problemasDelEjemplo`) y `tests/avisos-licencias.test.ts`;
- las capturas a los cuatro anchos: `C:/dev/revisiones/plantillas-tanda0/`.

Lo que se pedía:
- **`PlantillaCrear`** (`app/_crear/reglas.ts`) suma estos campos. **Son todos opcionales:** una tab que no los pasa se dibuja igual que hoy.
  - `grupo?: string`: la sección de la grilla;
  - `insignia?: string`: el formato y la duración («📣 Anuncio · 45 s», «Sugerida · 24 s · 1 clip», «1 de 8»);
  - `ayuda?: string`: cuándo usarla, que va como `title`;
  - `ejemplo?: string`: el nombre del negocio ficticio, que dibuja la cinta «Ejemplo»;
  - `extracto?: string`: el texto real del gancho;
  - `chips?: readonly string[]`;
  - `frase?: string` y `video?: string | null`, que solo usa AI Avatar.
- **Funciones puras**, con su test en `tests/crear-pantalla.test.ts`: `chipsVisibles(chips, max)`, `seccionesDeCrear(plantillas)` y `cajaDeMiniatura(formato)` (la imagen a su proporción, sin recortar). Los nombres obvios, `gruposDePlantillas` y `miniaturaDe`, ya existen con otra firma (2.4).
- **`NuevaCrear`:**
  - acepta `miniatura?: (p, activa) => ReactNode` (Video);
  - dibuja la hoja cuando hay `extracto`;
  - pone una sección por `grupo`.
- **El rótulo y el primer mensaje** de 2.3.
- **`contextoDelNegocio` y `vozDelNegocio`** pasan a un `lib/` común, que lee el grafo con `grafoParaChat` (ya está en `main`; 2.4).
- **Los avisos** van en `lib/avisos/`.
- **Los tests comunes:** la lista `REALES` pasa a `tests/_reales.ts`. Cada tab prueba sus ejemplos con ella y con `marcasDeVoseo` (Image, también sus `.json`).

**Después, una tab por vez, por lo que más usa un negocio high ticket:**

1. **Copywriter.** Es lo que más se usa: cada anuncio, VSL, clase, email y mensaje directo nace como texto.
   - Es lo más barato: no lleva imágenes ni licencias de stock, las estructuras ya existen y solo faltan los ejemplos y `youtube-retencion`.
   - Sus guiones alimentan a Video (la receta de YouTube), a Image (el carrusel, la clase, la miniatura) y a AI Avatar.
   - **Antes de «Adaptar»:** el bloque `tabla` en las operaciones de la IA. Sin él, adaptar borra las tablas del Reel, las Stories, el Carrusel y los Ganchos sin dar error.
2. **Offer.** Una oferta se arma pocas veces, pero es lo primero que hace cada cliente nuevo: el onboarding es el mismo OfferApp (`docs/hallazgos-offer.md`, 29/10). Además, es el dato que leen todos los expertos.
   - También es barato: solo texto, sin imágenes, y el agente ya existe. Las tandas A y B son datos y prompts.
   - **El riesgo:** usar la plantilla pide un funnel (trampa 2 de offer.md). En el onboarding hay que medir si el negocio ya tiene uno.
3. **Video.** El anuncio en video es el canal de adquisición, y el motor ya está bien.
   - La tanda 1, sin IA, es barata: el copy, la tarjeta dibujada por `MiniaturaPlantilla` y retirar dos plantillas.
   - Lo que cuesta es elegir a mano unos 30 clips de Pexels y medir si la miniatura arrastra el WASM del motor.
   - La tanda 2 es el Editor de MaKo.
4. **Image.** Se usa todas las semanas (miniaturas y carruseles), pero es lo más caro de hacer:
   - diseñar 12 plantillas en el editor, con capas con nombre y medidas con la fuente real;
   - elegir 5 fotos;
   - renderizar las miniaturas;
   - sacar las 10 de Doory y reescribir dos tests a propósito.

   Lo bueno es que siete plantillas no llevan ninguna foto de stock.
5. **AI Avatar, al final.** El motor nunca generó un look en producción (medido el 29/10), así que la tab no se vende hasta que ande. La tanda AV-1 (los datos) y la AV-2 (la tarjeta sin imagen) se pueden hacer antes; los retratos, los pósters y los loops, después de la prueba de punta a punta.

Cada paso pasa `tsc` acotado y los tests de su tab. La cosecha va en el mismo commit: las trampas de cada parte, a su `docs/hallazgos-<área>.md`, con su línea en `docs/hallazgos.md`.

---

## 7. Lo que queda sin hacer (con dónde vive)

- **Las tabs no están implementadas** (la tanda 0 sí, sección 6): las secciones 5 de cada archivo.
- **Elegir el material a mano:** los ~30 clips de Pexels (`lib/editor-video/plantillas.ts`, `ejemplo.creditos`) y las 5 fotos (`public/cv/plantillas/fotos/`). Ninguno está elegido.
- **AI Avatar:**
  - la prueba de la plantilla 5 (podcast, dos personas);
  - los 5 retratos, los 10 pósters y los 10 loops (`public/ai-avatar/plantillas/`), que esperan al motor.
- **Ejemplos que faltan en Copywriter:** las VSL `vsl-anti-solucion`, `vsl-diagnostico` y `vsl-historia-fundador` (quedan ocultas), y `reel-nicho`, `aida`, `bab` y `gancho-propuesta-cta`.
- **Offer:**
  - el teléfono (`app/m/offer/HojasOfferM.tsx`) y la API de MaKo con plantillas;
  - la nota del valor apilado en `docs/offer-marco.md` §6.3.
- **Las decisiones abiertas:**
  - Gemini por defecto en `image-editor-ia` contra «sin Gemini»;
  - quién paga la licencia de música de cada cliente (Epidemic Sound sigue «pendiente de alta» en `lib/musica-catalogo.ts`);
  - las caras del elenco en Image (2.2).
- **Sin verificar:**
  - quién es dueño de lo que genera Flow;
  - si los anuncios de vivienda caen en una categoría especial de Meta en México;
  - el CC0 de los otros packs de Kenney;
  - los valores por defecto de auto-editor;
  - la galería de Canva (da 403 a WebFetch).
- **Antes de publicar:** buscar de nuevo en la web cada nombre del elenco.
- **La cosecha:** las entradas están en `docs/hallazgos-create-plantillas.txt`, con el documento al que va cada una. Se integran sin duplicar y con su línea en `docs/hallazgos.md`.
