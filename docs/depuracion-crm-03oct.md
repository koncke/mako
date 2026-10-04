# Depuración de «Feature: CRM» — 03/10/2026

**25 tarjetas abiertas → 6 con fecha, 15 postergadas, 4 se van del tablero.**

Cada una se midió contra el código de hoy, se pasó por las cuatro preguntas de «un
accionable no es una tarea» y se juzgó con el criterio del 21/09 —*«¿es indispensable para
que el negocio esté corriendo?»*, y el empate pierde—. Tres refutadores atacaron por
separado los «cerrar», los «postergar» y los «meter al P1»: **6 veredictos de 25 cayeron**.

El marco está en [el panorama del 03/10](panorama-03oct). Lo que lo cambia todo: el usuario
número uno de este CRM, de acá al 18/10, **es Martín prospectando en frío con 1.000
contactos importados**. Hoy ese CRM —el del super admin— tiene **3 leads**.

## Entra (6)

| | Qué falta de verdad | Cuándo | Horas |
|---|---|---|---|
| **#621** | Al importar toma el nombre y tira el apellido cuando vienen en dos columnas | 7 OCT | 2 |
| **#702** | Un lead cargado a mano, importado o traído del chat nace sin origen, y la lista nunca lo mira | 7 OCT | 6 |
| **#39** | Cuando el dueño es la única persona del equipo, el lead nace sin vendedor y nadie lo rellena | 7 OCT | 2 |
| **#38** | Al pegar la grabación de la 2ª reunión se borra el link de la 1ª, y el buscador no mira las pegadas | 7 OCT | 5 |
| **#174** | Un cliente conecta la agenda sin cargar sus reuniones y las citas se tiran sin un solo aviso | 7 OCT | 4 |
| **NUEVA** | La importación crea el duplicado que la pantalla dice que descartó | **antes del 17 OCT** | 2 |

Las cinco primeras las mandó Martín al P1 el 01/10. Las tres de arriba son además el camino
crítico de la prospección: **#621** porque todo el producto deriva el apellido partiendo el
nombre, **#702** porque es lo único que después puede separar los 1.000 en frío de los que
llegan solos, y **#39** porque en el workspace del super admin el único usuario es `admin` y
`vendedorUnicoDelWorkspace` filtra a los admin: los 1.000 nacen sin setter ni closer.

La nueva es un bug vivo desde el 14/08 que nadie reportó: la fila repetida se dibuja gris,
con la casilla vacía y el cartel «ya existe», **y el server la crea igual** con la guarda
anti-duplicado apagada. El botón dice «Crear 80 leads» y entran 80 más las repetidas. Con
tres bases que se solapan, cada contacto repetido se crea dos veces. El detalle, en
[los hallazgos del CRM](hallazgos-crm).

## Sale (15) — postergadas, no descartadas

| Motivo | Cuáles |
|---|---|
| **Hay un camino a mano que aguanta el volumen de acá al 15/12** | #19 cobranza automática · #622 importar clientes ya pagos · #671 agendar la 2ª desde la ficha · #697 el botón de mensualidad cobrada · #800 aviso de lead quieto |
| **Sirve a un cliente que configura su embudo, no a la venta de estas seis semanas** | #798 métricas del funnel del cliente · #40 el recorrido con más de dos reuniones · #332 completar el formulario con lo de la llamada · #696 la casilla de «landing como entrada» |
| **El dato no se pierde: queda mal ubicado o invisible** | #6 respuestas del formulario de Meta · #701 clics y scroll en la ficha · #623 enriquecer al reimportar · #626 el mismo teléfono con y sin código de país |
| **No es programación: es escribir el texto y prender** | #18 la tanda de «No compró» |
| **Postergar es más seguro que ejecutar** | #20 unificar las dos bases — apagar la automatización vieja cortaría los recordatorios al lead |

⚠️ **#800 sale apoyada en que «eso lo hace el motor automático», y el motor está APAGADO en
el workspace del super admin** (no existe la fila de `crm_auto_enabled`). O se prende antes
del 17/10, o #800 vuelve: con 1.000 leads, darse cuenta de que uno está quieto abriendo su
ficha es exactamente lo que no escala.

## Se van del tablero (4)

| | Por qué |
|---|---|
| **#37** Datos del trato | Está en producción. Lo único vivo —que la ficha diga «no vio el video» sin saberlo— se midió hoy: **0 casos reales** en 10.137 visitantes |
| **#698** Alerta de campos fiscales | Hecha: ya es un renglón, se ignora de a uno o en lote, y guardar nunca se bloquea |
| **#627** Funnels por producto | Construido y en producción. Lo único que falta —medir por producto— **se escribe adentro de #798** antes de cerrarla |
| **#15** Piloto del CRM automático | Se funde en #40, que ya nombra el mismo pendiente. Pero su número medido se guarda: **Mauricio rechazó 35 de las 69 propuestas que resolvió (51%)**, y 3 siguen pendientes desde el 25/09 |

**#689** no se cierra ni se posterga: se funde en **#38** arrastrando sus dos mitades —el
fallo mudo cuando la grabación no engancha, y el lead cargado por teléfono que no engancha
nunca—. Si se funde sin eso, desaparece el síntoma que abrió la tarjeta.

## Lo que el 17/10 necesita y NO tiene tarjeta

Esto es lo más caro de la revisión, y no lo podía ver ninguna auditoría del repo: **el
código está bien; lo que falta son filas que ese workspace nunca creó.**

| Qué | Estado medido hoy |
|---|---|
| **Por dónde escribirles a los 100** | No hay línea de WhatsApp en el workspace del super admin, y el interruptor de envío no tiene fila: apagado |
| **Dónde reservan los que contesten** | Cero credenciales de Calendly o Cal.com, y ninguna ruta de agenda |
| **Quién hace el seguimiento** | El motor automático está apagado ahí (el piloto corrió en otros dos workspaces) |
| **Que entren 1.000 filas de una vez** | La pantalla declara un tope de 3.000 sobre un presupuesto de 60 segundos, con el alta de a una. Al cortar, lo ya creado queda — y reintentar duplica |
| **Que el teléfono sirva para escribir** | Lo que entra por este importador no queda en formato internacional: en el libro de una clienta, 47 de 52 teléfonos no se pueden contactar como están |
| **Filtrar los 100 mejores** | No existe en el CRM: no hay etiquetas ni listas. La salida sin código es filtrar en la planilla **antes** de importar — después no hay cómo separarlos |
| **Separar los 1.000 en frío de los que llegan solos** | #702 guarda el origen y lo muestra. **Ningún motor lo lee**: ni la nutrición ni el CRM automático lo miran, así que una secuencia puede escribirle en frío a alguien que te escribió a vos |

## Las cuatro decisiones que son tuyas

1. **El motor automático en tu workspace**: ¿se prende antes de importar los 1.000? De eso depende que #800 quede afuera.
2. **Filtrar los 100 en la planilla o importar los 1.000**: si entran los 1.000, hace falta una forma de separarlos que hoy no existe.
3. **#697** (el botón que fabrica una cuota impaga): sale como tarjeta, pero el arreglo es **una línea**. ¿Se hace de paso o se posterga de verdad?
4. **«Agente: CRM automático»**: el proyecto gemelo sigue vivo con 0 tareas. Se tacha con su motivo, o se queda partiendo en dos la respuesta a «¿dónde está lo del CRM?».

*Seis lectores midieron contra HEAD, un cruzador buscó solapes y faltantes, tres refutadores
atacaron por clase de afirmación. 457 lecturas de archivo y consultas a producción.*
