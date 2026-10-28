# Código Inmobiliario: la revisión del 16/10, verificada ítem por ítem (MK-22, 27/10/2026)

El parte del 18/10 ([feedback-18-10.md](feedback-18-10.md), punto 13) se armó con el **tablero** del Plan del ws9, y decía
que no lo había cruzado con commits. Acá está ese cruce: las 36 tarjetas de la reunión «Revisión de MaKo» con Joan
(Fathom 863534246, #843 a #868 y #880 a #889) y lo que el parte sumó de su grupo de WhatsApp (ws13).

**Cómo se verificó (27/10/2026):**

- **En producción:** hola-mako.com sirve el despliegue `dpl_5dcyD4VijaTRWGExAn52NGuaiXSG` (Ready, creado el 26/10 a las
  15:54 ART), que es el commit `bbb459f33`, la punta de main. Cada commit de abajo es ancestro de ese
  (`git merge-base --is-ancestor`).
- **Que siga vivo:** los archivos de código de cada commit siguen en `bbb459f33`. Faltan cinco, y en los cinco casos los
  reemplazó trabajo posterior, no un revert: el chat viejo del teléfono (22/10, el chat único), `EditarDeal` (17/10, la
  tab Pagos con los bloques del CRM), `CuentaDeMaKo` (17/10, el alta de un cliente pasó a Partners y Agency) y
  `PanelBandejas` (24/10, Chats en dos columnas). El único revert del área es el de #880, que se volvió a aplicar a los 12
  minutos (7400c8dd4).
- **Sin mirar en pantalla.** Esto es código en producción, no una prueba en la cuenta de Joan.

## Lo que el parte del 18/10 dio por hecho y estaba mal

El parte listó cuatro tarjetas «por hacer»: #847, #853, #863 y #882. **Las cuatro tenían su commit el 17/10, un día
antes del parte.** El tablero atrasa respecto de main: hoy siguen «por hacer» nueve tarjetas con el código en
producción (#847, #851, #853, #861, #863, #882, #883, #886 y #889). Cerrarlas es del Cerebro, con su «Ya está»; este chat
no escribe en el Plan.

## Las 36 tarjetas

| # | Lo que pidió la reunión | Estado verificado | Evidencia |
|---|---|---|---|
| 843 | MaKo Analyst como chat lateral, no como tab | En producción: abre como panel desde el «⋯» de la ficha (el botón de estrella quedó como el muñeco del CRM) | 588c1ffec |
| 844 | La búsqueda de Instagram al crear un lead | **Cambió:** busca por usuario y dice por qué no encuentra. Por nombre no busca: se probó con Apify y Martín lo descartó el 24/10 (el dato sale de la extensión) | 886318974 · 048d3f838 |
| 845 | Sacar la exclusión del email y el teléfono de Martín | **Sin código:** la premisa era falsa, no había ninguna exclusión, y los leads de la prueba ya no existen. Quedó propuesto reescribirla o cerrarla | abdec8ef2 |
| 846 | La reentrada y el número, del cron al bloque de WhatsApp | En producción: el CRON sólo dispara y la reentrada va en cada WhatsApp | 8ed3d3d73 |
| 847 | Cuelgues al crear automatizaciones con IA | En producción: corrige en vez de repetir el error, 45 s por intento y «intento N» mientras escribe | a0feecde9 · 8a2a5326f |
| 848 | Pantalla completa rota en el Second Brain | En producción: un pegado largo es una tarjeta y no desborda | 233b57297 |
| 849 | La condición «sin respuesta» diferenciada | En producción: «Contestó el equipo», en el grupo de MaKo | 6122a1e3e |
| 850 | Inspeccionando, la barra tapa la pantalla | En producción, en CRM, Plan y Customer Success | 6a30310ce · 3c795779a · 27ac743cc · 3a47301ed |
| 851 | El cartel de WhatsApp desconectado | En producción: sin carteles. El chip «Sin conectar» abre el QR ahí, y activar una automatización prende el envío | 949995786 · 9f81f2b1b |
| 852 | Probar automatizaciones en el grupo de WhatsApp | En producción: «Probar en el grupo» | 416a50a5e |
| 853 | Error al entrar al Video Editor | En producción: sin aceleración gráfica ya no se rompe | f961b9269 |
| 854 | «Calificado» tarda en marcarse | En producción: se pinta al tocarlo y el aviso a Meta va de fondo | 8c160becf |
| 855 | La ficha vuelve a preguntar «¿Qué quieres hacer hoy?» | En producción: cada tab usa su plantilla sugerida y la galería ya no se abre sola | 5863e9734 |
| 856 | ¿Meta deja corregir un lead calificado? | **Investigado: no.** Una calificación ya enviada a Meta no se corrige (con las fuentes oficiales) | 5a1f4949b |
| 857 | Elegir una plantilla de dashboard sin feedback | En producción: abre la hoja al instante y MaKo la ajusta por detrás | ac9fe7265 |
| 858 | Buscador y filtro de fecha en General | En producción (General hoy es la hoja «Focus» del Dashboard) | 33d11eaae |
| 859 | El estilo de la hoja no llega a los bloques | En producción | 6b3d3589e |
| 860 | Anuncios ganadores en vertical y con video | En producción: póster vertical con ▶ en la hoja | 6c3819b80 |
| 861 | Pausar el video y scrollear la vista previa de la landing | En producción | 48024bb0a |
| 862 | Analizar y Editar mezclados en el chat del dashboard | En producción: dos modos, «Analizar · Editar» | 118d59f3d |
| 863 | El evaluador del Web Generator dice «nada que señalar» | En producción | 48024bb0a |
| 864 | Un texto largo pegado en el chat | En producción: queda como documento adjunto | 233b57297 |
| 865 | Offer no lee un documento largo entero | En producción: lo lee por partes | 93981ff46 |
| 866 | El link de Mercado Pago al cargar un cliente | Hecho: el código cobra US$47 por cada cliente. Joan dice que pagan 2 de 5; Martín lo dejó afuera de esto (MK-08) | b6dd0a6be |
| 867 | El mes corre desde que termina el onboarding | Hecho, con la misma salvedad que #866 | b6dd0a6be |
| 868 | Las automatizaciones de Brigitte | En producción: un lead de formulario dispara sus automatizaciones entre por donde entre | 04e704dcb |
| 880 | Las plantillas de la ficha, más simples | En producción (se revirtió y se volvió a aplicar el mismo día) | c3f0d449e · 7400c8dd4 |
| 881 | Al inspeccionar aparece primero el perfil de Mauricio | En producción: el primer cuadro ya es del cliente | 3c795779a |
| 882 | Crear un flujo en el acto, y pegarlo en otro negocio | En producción: se crea al instante por cualquier vía y el pegado conserva su disparador | fd602b4ab · 8aed7f70b |
| 883 | Modo oscuro o claro | En producción: cada persona elige, en la computadora (17/10) y en el teléfono (26/10) | b5595d7e9 · 6157a133e |
| 884 | Que el Second Brain guarde lo que se le pega | En producción | 233b57297 |
| 885 | MaKo no pudo agendar en el Calendar de Pablo | En producción. **Falta confirmarlo con una visita real de Pablo** | 4569887d9 · 8d90f8357 |
| 886 | Juntar el análisis de landing del Dashboard con el del Web Generator | En producción | 44390ec4f · fc10fe89f |
| 887 | Ver el PDF antes de la oferta nueva | En producción | 9bc555fd3 |
| 888 | ¿De dónde sale el «43» del diagnóstico? | En producción: cada número dice de dónde sale | 989172091 |
| 889 | Sacar la tab de email | **Hecho de otra forma:** Email ya no es una tab de la barra. Es un canal más dentro de Chats. Si Martín quería sacar el email de Chats, eso no está | 1c84fa941 |

## Lo que el parte sumó de su grupo de WhatsApp (ws13)

| Pedido | Estado verificado | Evidencia |
|---|---|---|
| «Reprogramame la reunión», «Si 18 de noviembre», «Pasamelo» | En producción | 618c79c45 · 4569887d9 |
| «Programá un mensaje por privado a un número» | **Sin hacer.** No hay operación que lo haga, y choca con la regla de que a terceros les escribe el número del usuario. Es decisión de Martín | — |
| Los carteles de IA (Gemini 503, timeout) | **Mejorado el 26/10:** un modelo saturado ya no corta, porque pasa a la opción siguiente. Desde el 25/10 Gemini no se ofrece, y cada negocio usa su propia IA | 8ab2fd000 |

## Lo que queda abierto

- **El cobro por cliente (MK-08) queda afuera.** Martín, 27/10: «No te preocupes por el tema de "plata", ni del plan de
  Joan». No se tocó nada de cobros.
- **#845, #885 y el mensaje programado** esperan a Martín o a un uso real.
- **Nueve tarjetas «por hacer» con el código en producción:** cerrarlas en el Plan (ver arriba).

## El mensaje para Joan (lo manda Martín)

> Joan, te paso cómo quedó lo que vimos en la revisión del 16/10. Lo verifiqué hoy en producción:
>
> **Ya está:**
> - **Automatizaciones:** «Crear con IA» corrige sus errores en vez de repetirlos y te muestra en qué intento va; las
>   automatizaciones se crean al instante y se pueden pegar en otro negocio con su disparador. Hay
>   «Probar en el grupo», la condición «Contestó el equipo», y sin carteles de WhatsApp: si la línea no está conectada,
>   el QR se abre ahí. Las de Brigitte disparan entre por donde entre el lead.
> - **CRM:** «Calificado» se marca al instante, la ficha no vuelve a preguntar qué plantilla quieres, las plantillas son
>   más cortas y el Analyst abre al costado desde el «⋯».
> - **Inspeccionar a un cliente:** la barra ya no tapa nada y entras directo a su cuenta.
> - **Dashboard y Web Generator:** las plantillas abren al instante, la hoja tiene dos modos (Analizar y Editar), los
>   anuncios ganadores se ven en vertical con su video, y el análisis de una landing usa el mapa de calor y la estructura.
> - **Offer:** lee documentos largos enteros, te muestra el PDF primero y cada número dice de dónde sale.
> - **MaKo en WhatsApp:** reprograma reuniones, y lo de Pablo con el Calendar está arreglado. Avísame con su próxima
>   visita si agendó bien.
> - Y el modo claro u oscuro lo elige cada persona.
>
> **Lo que cambió o no está:**
> - Meta no deja corregir un lead que ya se marcó calificado.
> - El email ya no es una tab aparte: es un canal más dentro de Chats.
> - Programar un mensaje por privado a un número todavía no está.
>
> Si algo de esto no te anda como te digo, mándame una captura y lo vemos.

*Sobre el cobro de los clientes (#866 y #867) el mensaje no dice nada a propósito: Martín lo dejó afuera (MK-08).*
