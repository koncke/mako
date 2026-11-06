# Cómo trabaja Código Inmobiliario con sus clientes

Base para el dashboard especial que pidió Martín. Armado el 6/11/2026.

**Cómo leerlo:** cada afirmación dice de dónde sale.
- **Dicho** = lo dijeron Juanfran, Joan o Martín, con fecha. Sale de los resúmenes que manda Fathom al Gmail de Martín (los audios y las transcripciones completas no están en la base: `grabador_reuniones` está vacía) y de `docs/`.
- **Medido** = lo leí en la base de producción, sólo lectura, el 6/11, en agregado y sin ningún dato de un lead.
- **Deduzco** = lo armé yo. Puede estar mal; está marcado.

## 1. Quiénes son

Código Inmobiliario es el negocio 13 de MaKo: una agencia argentina de Juanfran y Joan que hace publicidad para inmobiliarias. Dentro de MaKo es una **agencia con siete negocios de clientes** adentro (15, 17, 18, 19, 20, 22 y 23). Dicho por Martín el 30/10: «Código Inmobiliario es agencia y tiene clientes dentro». Cobran US$97 la agencia y US$47 cada cliente (acuerdo del 30/10, `cobro-agencia-codigo`).

## 2. Dos embudos distintos (hay que no mezclarlos)

**A. El propio de Código: cómo consiguen clientes.** Dicho, 20/8 y 28/8:
1. Anuncios con testimonios en video.
2. Un formulario de Meta que filtra a los poco serios.
3. Un video largo de ventas (VSL).
4. Agenda de una llamada de ventas (Cal.com).
5. Una página de preparación obligatoria antes de la llamada; si el lead no confirma que la vio, la llamada se cancela sola.
6. Llamada de venta con un closer.

Resultado dicho el 30/10: 72 llamadas agendadas en 38 días con unos US$1.000 de pauta; costo por llamada de US$20 a 25 en promedio, y de US$10 a 15 en los mejores anuncios. El anuncio que mejor anda junta un dolor con un testimonio. Lo que se vende es un servicio «Done For You» de 3 meses por US$2.000 (28/8).

**B. El de sus clientes inmobiliarios: lo que Código les corre.** Dicho, 27/9 (Martín, en `docs/comunicar-a-jj.md`): los clientes corren campañas de **Clientes Potenciales de Meta, con formulario**; el comprador de una casa llena el formulario y el lead tiene que llegar al CRM. Medido: los siete clientes tienen un funnel «de captación» (el negocio del inmobiliario es conseguir propiedades en exclusiva, según Código el 20/8), con canales declarados «presencial» o «conversaciones».

El resto del documento es sobre **B**, salvo cuando diga que es de A.

## 3. De punta a punta

| Paso | Cómo es | Qué se sabe | Fuente |
|---|---|---|---|
| 1. Campaña | Código crea y corre la campaña de formulario de Meta de cada cliente | Hecho. Medido: 4 de los 7 clientes ya tienen leads por formulario (1 a 5 campañas y 3 a 16 anuncios) | Dicho 27/9; medido 6/11 |
| 2. Entra el lead | El lead cae al CRM de MaKo del cliente, desde Meta (sin webhook entra por un barrido cada 30 min) | Medido: todos los leads de los clientes tienen origen «formulario instantáneo» | Medido; `nube-codigo.md` |
| 3. Se lo califica | MaKo marca Calificado, En Revisión o No Calificado según las respuestas del formulario | **Propuesto** el 28/8; medido: en los clientes no hay respuestas guardadas del formulario en esos campos (0 de 170) | Dicho 28/8; medido |
| 4. Se avisa al inmobiliario | Alerta de WhatsApp con los datos del lead | **Propuesto** el 28/8 | Dicho 28/8 |
| 5. Se llama rápido | «El agente llama al lead en menos de 60 segundos». Si no se registra la llamada, MaKo insiste con recordatorios | Propuesto el 28/8 como flujo de la oferta. **No sé si hoy es una obligación que Código les impone a sus clientes** (duda 1) | Dicho 28/8 |
| 6. Se actualiza el estado | El agente cambia el estado del lead por voz, desde WhatsApp | Propuesto 28/8 | Dicho 28/8 |
| 7. Se graba | Análisis de llamadas «opcional»: Maco resume y da coaching. La barrera dicha: el agente tiene que instalar una app de grabación. Joan quedó en investigar si es viable | Hoy existe el botón Grabar en la ficha del lead (4/11) | Dicho 28/8; `nube-grabar.md` |
| 8. Se revisa | Hoy, a mano: las grabaciones están en Loom, que no se puede buscar, y eso trababa la revisión de las llamadas. Se pasa a Fathom | Dicho 30/10. Joan crea la cuenta de Fathom de su nuevo closer (Charlie) | Dicho 30/10 |
| 9. Se reporta a cada cliente | **No encontré cómo se hace hoy.** Lo único dicho es el motivo: tener datos concretos para contestar cuando un cliente dice que los leads no sirven | Duda 3 | Dicho 30/10 |

Lo que Código le quería poder mostrar al cliente (dicho 30/10): cuánto tarda el inmobiliario en contactar a un lead desde que entra al CRM, y el porcentaje de tiempo al aire de quien llama.

## 4. Qué le importa a cada parte

**A la agencia** (dicho, salvo lo marcado):
- Poder **probar de quién es la falla** cuando un cliente dice «los leads no sirven»: del lead o de la velocidad con que lo llamaron. (Dicho 30/10.)
- Que **el lead llegue** (el aviso falso de Meta «todavía no recibe leads» les molestó; `nube-codigo.md`, punto 4).
- Costo por llamada o por agenda, y qué anuncio la trajo. Existe la ficha con Campaña › Conjunto › Anuncio (`comunicar-a-jj.md`, 27/9).
- Revisar las llamadas sin escucharlas enteras (el cuello de botella dicho el 30/10).
- Ver lo mismo que ve cada cliente sin pedirlo (ticket 49, 3/11).
- Pagar una sola vez por mes, entre el 1 y el 5 (30/10).

**A cada cliente inmobiliario** (deduzco, no hay nada dicho por ellos):
- Que le lleguen leads y que sean de la zona que busca (Código pidió el 20/8 segmentación geográfica manual en los anuncios).
- No mirar plata ni cuentas: las alertas de cobro van a la agencia y nunca a su grupo (31/10).
- Poco que hacer: el perfil que Código describe es un agente de 55+ años que desconfía de la IA (28/8). Un dashboard para él tiene que caber en un vistazo.

## 5. Cómo está armado hoy cada uno (base, 6/11/2026, agregado)

| Negocio | Leads (30 días) | Origen | Campañas / anuncios | Etapas | Contacto saliente por WhatsApp visto |
|---|---|---|---|---|---|
| 13, la agencia | 95 (51) | 81 landing, 9 Cal.com, 3 a mano, 1 formulario | campos de Meta vacíos | 90 con agenda, 39 asistieron a la primera llamada, 17 cerraron | 49 de 91 |
| 15 | 46 (42) | todos formulario | 1 / 4 | 17 en «st1», 12 descalificados, 10 sin etapa, 5 agendaron | 0 de 46 |
| 17 | 2 | formulario | sin campaña / 2 | sin mover | 0 de 2 |
| 19 | 118 (118) | todos formulario | 5 / 16 | **ninguno movió de etapa** (118 sin etapa) | 3 de 118 |
| 20 | 4 | formulario | 1 / 3 | 2 agendaron, 1 perdido | 0 de 4 |
| 18, 22, 23 | 0 | sin leads todavía | sin campañas | sin etapas | sin datos |

Lo que se ve (medido):
- Cada cliente tiene **un usuario activo** (el 18 tiene dos; el 17 y el 23 tienen otros sin activar); ninguno tiene etapas propias definidas: usan las de fábrica (en el 15 aparecen «st0» y «st1», que son etapas personalizadas sin nombre en la base: duda 6).
- **Las llamadas grabadas con Grabar son cero**: la tabla existe (la migración 0390 está aplicada) y está vacía. Tampoco hay análisis de Closing para ningún negocio de Código.
- Natalia (negocio 19) es la que más leads recibe: 118 en tres semanas, y ninguno marcado en el CRM. Eso puede significar que no los trabaja en MaKo, no que no los llame. **No se puede decir más desde la base.**

**Tiempo hasta el primer contacto, con lo que MaKo alcanza a ver** (sólo WhatsApp que MaKo vio salir; las llamadas por teléfono no aparecen): en el negocio 13, de 91 leads, 49 tienen un WhatsApp saliente; la mediana desde que entró el lead es de unas 27 horas y 8 contactos cayeron en la primera hora; el percentil 90 son unos 17 días. En el 19 son 3 de 118. **No es una medida de velocidad:** más del 97 % de los mensajes salientes de esos negocios no trae marca de si los mandó una persona o una automatización, y la llamada es el contacto que más importa para Código y no está medida. Es el dato que justifica la métrica nueva, no la métrica.

## 6. Métricas del dashboard: cuáles existen

| Métrica | Existe hoy | Dónde |
|---|---|---|
| Tiempo hasta el primer contacto (mediana, % en la primera hora, sin contactar, los más lentos) | Sí, pero vale poco hasta que haya llamadas en MaKo | Hoja Closing (`/dashboard?hoja=closing`), conjunto «Primer contacto» y `tiempo_primer_contacto` (`GET /api/v1/crm/primer-contacto`). Regla en `lib/primer-contacto.ts`. Cuenta WhatsApp, email, Instagram, Messenger y llamadas grabadas; los leads cargados a mano, importados o de prueba no cuentan |
| Llamadas grabadas, % que contestó, % que agenda, cómo terminan, quién llamó | Sí; **sin uso** (0 grabaciones) | Plantilla Cold Calling del Dashboard y botón Grabar de la ficha (`nube-grabar.md`) |
| Calidad de cada llamada (resumen, coaching) | Sí | Closing, con el grabador (Fathom) o con las llamadas grabadas. Ninguno de Código tiene análisis |
| % de tiempo al aire del closer | **No** | Se dijo el 30/10; `nube-codigo.md` punto 2: no se guarda. Es una estimación y la decide Martín |
| Leads por campaña, conjunto y anuncio; costo por agenda | Sí para la ficha y el origen | Ficha del lead › Campaña › Conjunto › Anuncio. Los leads de formulario de los clientes traen campaña y anuncio |
| Embudo por etapa (entró, calificado, agendó, asistió, cerró) | Sí | Hoja Closing y Dashboard. Sólo sirve si el cliente mueve las etapas (en el 19, ninguno) |
| Leads sin contactar, ordenados por antigüedad | Sí (parte de «Primer contacto») | Igual que arriba |
| Calificado / En revisión / No calificado por las respuestas del formulario | **No** | Propuesto el 28/8. Los campos de respuestas están vacíos en los clientes |
| Aviso de «sin llamada registrada» y recordatorios al agente | **No lo encontré** | Propuesto el 28/8 |
| Una fila por cliente en `/agency` | **No** | `nube-codigo.md`: «No hay una columna por cliente»; la agencia entra a cada cliente |
| Cobro: quién pagó, quién vence | Sí | `lib/agencia-cobro*.ts`; no es para el dashboard del cliente |

## 7. Qué debería tener arriba el dashboard de Código (deduzco)

Una sola pantalla para la agencia, con **una fila por cliente**, que hoy no existe y es lo que más cambia el trabajo:
1. Leads de los últimos 7 y 30 días, y los **sin contactar** con su antigüedad.
2. Tiempo al primer contacto y % en la primera hora, aclarando si cuenta llamadas.
3. Llamadas hechas, % que contesta, % que agenda (de Grabar o Fathom).
4. Costo por lead o por agenda y qué anuncio rinde.
5. Etapa del embudo: cuántos se movieron.

Y una vista simple para el cliente, con 1, 2 y 3 solamente. El cliente no ve la plata (regla del 31/10).

## 8. Lo que no encontré

- Transcripciones de las reuniones con Martín: no están en la base. Sólo hay los resúmenes de Fathom del 20/8, 28/8, 2/9, 16/10 y 30/10 (en el Gmail) y cinco análisis de Closing en el negocio 9.
- Cómo reporta hoy Código a cada cliente (formato, frecuencia, qué números).
- Qué script de llamadas usan y cuál es la regla real de velocidad con los clientes: sólo lo propuesto el 28/8. Juanfran quedó en investigar sus scripts.
- Una medición de cuántas llamadas hacen sus clientes: sin Grabar y sin teléfono conectado, MaKo no las ve.

## Dudas para Martín

1. **«Llamar en menos de 60 segundos»:** ¿es una regla que Código ya les exige a sus clientes, o es el diseño de la oferta Done For You del 28/8? Cambia qué se mide y contra qué.
2. **¿Quién llama en cada cliente?** ¿El inmobiliario mismo, un setter de Código, o los dos según el cliente? Hoy casi cada negocio tiene un solo usuario activo.
3. **¿Cómo les reportan hoy a los clientes** (planilla, PDF, mensaje)? Es lo que el dashboard tiene que reemplazar.
4. **¿El dashboard lo ven los clientes o sólo Juanfran y Joan?** Cambia casi todo lo del apartado 7.
5. **¿«Botón de grabar» es el de la ficha?** Ya está en producción pero sin uso; el límite es que no graba la llamada del mismo teléfono (hay que usar altavoz con otro aparato) ni funciona en Safari/Firefox para el otro lado de la llamada. ¿Les sirve así?
6. **Etapas «st0» y «st1»** del negocio 15: son etapas personalizadas sin nombre legible en la base. ¿Qué significan?
7. **¿Fathom o Grabar para el closer de Código?** Dijiste que Joan abre Fathom para Charlie; ¿el % de tiempo al aire se pide de ahí?
8. **El negocio 19 recibe 118 leads sin tocar en MaKo.** ¿Hablaste con ella? Antes de sacar conclusiones sobre «leads que no sirven».
