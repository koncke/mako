# Feedback de Martín del 16/10/2026: CRM, Onboarding y Second Brain

Lo mandó al Cerebro el 16/10 a la tarde con cinco capturas (el editor de etapas con «Asignar campañas», el «Ver» de
datos sin marcar de la ficha, «A revisar», la ficha de un cliente en /customer-success y la de un lead en /crm). Pidió
«Guarda todo este feedback para las próximas cuentas» e «implementa lo que puedas del CRM, sobre todo las cosas
simples». La cuenta 3 estaba al 97% semanal: se hizo lo simple (commit `9f595cc6f`) y el resto queda acá, **con su
archivo**, para la cuenta que siga. Las citas son textuales.

**Quién lo retoma:** el chat **CRM** (relevo: docs/relevo/crm.md, que apunta acá), el chat **Onboarding**
(docs/relevo/onboarding.md) y el chat **Centro de Operaciones** para el Second Brain (docs/relevo/centro-operaciones.md).

## Decisiones tomadas al leerlo (no se le vuelven a preguntar)

- **El punto 5 del CRM reemplaza al 4.4.** Martín se corrigió en el mismo mensaje: «En lugar de hacer lo que te dije
  de "Toda la ficha", del placeholder, etc... Mejor que todas esas opciones sean TEMPLATES, y que el sistema para
  cambiar de hoja sea exactamente el mismo que tenemos en Dashboard y General». No se hace el placeholder.
- **La pestaña «MaKo Analyst» se va** y su lugar es «AI Analyst» en el «⋯» de la ficha (punto 10).
- **«A revisar → Ignorar todos» ignora los leads de la LISTA** (los que se ven, con su tope), no la cola entera del
  workspace: si quedan más, la lista se rellena y se vuelve a tocar. Es reversible lead por lead («Ver más» →
  «Volver a avisar»), por eso no pide confirmación.
- **«Sin empresa ·» se va, la empresa no**: si el lead tiene empresa sigue en el subtítulo. Lo que sobraba era el hueco
  dicho en voz alta.
- **Onboarding: la oferta deja de ser el corazón.** El onboarding junta lo que vende el usuario y lo ordena en un PDF
  (para el contexto de MaKo); el ANÁLISIS de la oferta queda en la tab Offer, después. Esto cambia lo decidido el
  16/10 a la mañana («el onboarding ES el chat de Offer»).

## CRM

### Hecho (commit `9f595cc6f`)
- [x] **2.** El «⋯» de «Lead entrante» dice «Asignar campañas» con el logo de Meta (app/crm/CrmBoard.tsx).
- [x] **6, en parte.** En «A revisar» (app/_components/MakoConfirmGate.tsx): el número va pegado al nombre, la primera
  fila no tiene raya (no choca con la de la cabecera) y la ✕ es un basurero rojo.
- [x] **7, en parte.** «Ver todos» pasó a ser «Ignorar todos»; «Revisar» abre la ficha con el «Ver» de los datos sin
  marcar ya desplegado (LeadEditModal → LeadSheet → DatosSinMarcarCard `abrirAlMontar`).
- [x] **9, en parte.** Subtítulo sin «Sin empresa ·»; la foto pasó de 64 a 88 (como la de Clientes) y el nombre va
  arriba de su fila, pegado a la cara (app/crm/lead-view/CabeceraLead.tsx). **Nadie lo miró en pantalla** (la máquina
  no tenía RAM para `next dev`): mirarlo a 1440, 1024 y 390.

### Sin hacer
1. **Renombrar un CRM se guarda solo.** «Cuando cambio el nombre de un CRM debe cambiarse automáticamente, incluso si
   no le doy "enter" y clickeo afuera del modal de edición del CRM... Si se cambió pero luego de unos segundos y
   debería ser automático... Y fijate el bug que en el modal ya me aparece bien el nombre y luego en la edición del
   CRM me aparece el viejo nombre.» Vive en el desplegable de CRMs (app/crm/CrmToolbar.tsx, el lápiz de cada uno) y el
   pop-up de etapas (app/crm/EtapasModal.tsx). Guardar al salir del campo (blur), al instante en pantalla, y que el
   pop-up lea el nombre nuevo (sospecha: lee una copia del funnel tomada al abrir).
3. **«Asignar evento» en las etapas de reunión.** «...con el logo de Meet, y que ahí se puedan seleccionar de la misma
   manera (en diseño) que la lista de campañas, la lista de eventos de Calendly o Cal o Calendar... Y que tenga la
   opción ahí mismo de crear un nuevo evento para asignarse a esa etapa.» El MOTOR ya está en producción (mig 0293,
   app/crm/agenda-evento-actions.ts, lib/agenda-evento-etapa.ts); falta la pantalla, que era el punto 3 del relevo de
   CRM (worktree C:/dev/wt-crm-agenda, mergear main antes). Nuevo: el «⋯» de la etapa con «Asignar evento», la tabla con
   el diseño de la de campañas, Google Calendar además de Calendly y Cal.com, y «crear evento» ahí mismo.
4. **La ficha en modo edición.**
   - «Primero mejora la eficiencia al abrir el detail de un lead, tarda un montón en cargar.» Medir qué espera
     LeadEditModal (app/crm/LeadEditModal.tsx, la action que trae `LeadFullData`) antes de tocar nada.
   - «Elimina la opción de "Vista previa: Antes de la llamada" y la de "Ahora no"» (app/crm/lead-view/ficha/
     GaleriaTab.tsx: la barra «Vista previa» lleva el botón que elige, así que se va JUNTO con el rediseño del punto 5).
   - «En la vista de edición, elimina la sidebar» (app/crm/lead-view/ficha/PanelFicha.tsx), porque: el **Nombre** se
     cambia en el título mismo; **«Plantilla»** ya está en la barra de edición y se llama **«Templates»**; **«Vista
     épica»** pasa a ser el desplegable **«Estilo de la hoja»** del Dashboard (app/dashboard/EditorInforme.tsx) — «que
     también en los otros lugares deberías mejorar ese desplegable de estilos, ya que quedó limitado»; **«Toda la
     ficha»** → ver punto 5; **«Avisos de datos sin marcar»** deja de ser una lista de interruptores: cada bloque tiene
     la opción **«Obligatorio»**, y eso es lo que lo manda a «datos sin marcar».
5. **Templates con miniaturas propias y el cambio de hoja del Dashboard.** «Las miniaturas de los TEMPLATES son todos
   iguales en todas las tabs, y no debería ser así... Mejor que todas esas opciones sean TEMPLATES, y que el sistema
   para cambiar de hoja sea exactamente el mismo que tenemos en Dashboard y General, el desplegable del título con las
   secciones, entonces ahí mismo se puede crear otra hoja... Y que no salgan las opciones de "Toda la ficha" esos deben
   ser templates... Pero para eso debes crear y mejorar los templates, con sus miniaturas.» Las tabs de la ficha pasan a
   ser HOJAS como las del Dashboard.
6. **El «Ver» de datos sin marcar de la ficha, igual que «A revisar».** «...Solo que en lugar de foto de perfil del
   lead, un ícono del bloque que falta marcar.» (app/crm/lead-view/DatosSinMarcarCard.tsx → `Desplegable`.) Y
   **«Elegir qué datos te avisa MaKo»** (el engranaje de «A revisar», hoy app/crm/lead-view/AvisosDatosModal.tsx con
   interruptores) «debería abrirme el detalle de un lead "ficticio" con el desplegable de "Datos sin marcar" abierto,
   y dentro de ese otro desplegable el botón de Basura rojo, y cuando le doy me pregunta ¿Ignorar siempre? y si le doy
   que sí, se desmarca de obligatorio ese bloque».
7. **Borrar entera la vista `/crm?pendientes`.** «Elimina completamente lo de "/crm?pendientes"... Si quiero ir a
   corregir un dato sin marcar se debe abrir la ficha del lead, nunca redirección a otra ruta.» La entrada de «A
   revisar» ya no existe; quedan la vista (app/crm/CrmBoard.tsx, buscar `pendientes`), la puerta de la barra
   (app/crm/CrmToolbar.tsx, «LA PUERTA NO SE VA CON EL CHIP»), el ejemplo de app/admin/ui/Gramatica.tsx y los tests que
   la sostienen.
8. **El botón de MaKo a la IZQUIERDA y el chat del CRM con la cara del Second Brain.** «El botón de MaKo siempre a la
   izquierda, no a la derecha... aún no se aplicó el diseño de los chats tipo "Second Brain" al chat del CRM... En
   lugar de la estrella de MaKo el ícono debería ser el muñequito que se asignó para CRM, para Dashboard, o para cada
   tab.» (El chat del CRM: app/crm/mako-crm/ChatMakoCrm.tsx; los muñecos por tab salen del Centro de Operaciones.)
9. **El resto del punto 9.** «Como ahora "Resumen" y todas las tabs serán como en dashboard o general, el
   desplegable... Quiero que esté alineado al título del nombre de la persona. No más a la izquierda.»
10. **«Editar» en azul + «⋯» como el Dashboard, sin «Personalizar».** El «⋯»: exportar la hoja del lead, compartir, el
    tutorial de cómo editar y **«AI Analyst»**, que abre el chat de MaKo para analizar a ESE lead — reemplaza la
    pestaña «MaKo Analyst» (app/crm/lead-view/AnalystDelLead.tsx, MakoAnalystLead.tsx; FichaPorBloques.tsx la arma con
    `key: 'insights'`). «Es importante que cuando se abra el chat de MaKo al costado izquierdo, todo el modal del
    detail se desplace a la derecha para darle espacio, y que sean modales diferentes el chat y el detail... Al momento
    de EDITAR, también debería salir automáticamente este modal, pero ahora ya no para analizar al lead, sino para
    editar la vista.»

## Onboarding

1. «Sería bueno que la funcionalidad de "OFFER" no esté en el onboarding, sino que ya luego del onboarding el usuario
   pueda ir a analizar su oferta allí... Pero simular "Offer" en el onboarding simplemente para organizar en un PDF lo
   que vende el usuario. Y eso le sirve a MaKo para crear las cosas que necesite...» Vive en app/onboarding/
   ChatArranque.tsx y lib/onboarding-arranque.ts (el paso de la oferta). Lo que se saca es el diagnóstico y la oferta
   mejorada; lo que queda es preguntar qué vende y armar el PDF con eso.

## Second Brain

1. **«Skills», como skills.sh.** «Quiero copiar y replicar a "Skill.sh" en un botón que sea algo como "Skills", para
   poder tener un repo de skills y traer skills al second brain de todo tipo... Pero a diferencia de la dificultad que
   tiene hoy en día de conectar una skill, entre buscarlas e instalarlas, MaKo te las ofrece con la misma dinámica que
   skill.sh y cuando le das "agregar" se instalan solas... Y se crea un chat con esa skill y todos lo pueden utilizar o
   algo así... Y funcionaría tanto con Claude como GPT dependiendo de que hayas conectado a tu cuenta de MaKo.»
   Antes de diseñarlo, mirar skills.sh entero (copiar tal cual, regla de la casa). Corre con la IA que el cliente
   conectó: el crédito de Claude de la plataforma es sólo para el onboarding.
