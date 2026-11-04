# Relevo — chat de tickets (#36, #40, #41, #42, #45; 3/11/2026, cuenta claude5)

Rama `tickets-ia-0311` en `C:/dev/wt-tickets-0311`, desde `origin/main`. Sin pushear: el Cerebro integra. Cada ticket tiene su hito con
`tickets: [n]`: se cierra solo con el deploy. El #44 va aparte, en `brain-docs-0311`.

## Sin verificar

- **Tipos:** `tsc-acotado` dio 99 sobre estos 51 archivos (el vigía de RAM). El Cerebro pidió no esperar: los chequea GitHub.
- **Ningún turno corrió con un modelo de verdad.** Los tests llegan hasta el `system` y las herramientas del turno: que MaKo conteste bien con eso
  se ve en el grupo después del deploy.
- **#36 no se reprodujo:** se arregló la causa probable (`navigator.clipboard` rechazado en la app de Claude).
- **#42:** no se leyó la conversación del grupo de ese día; la lectura de `mako_doer_conv` quedó frenada por los permisos de este chat. Sí se midió que
  ese negocio tiene Google conectado desde el 8/10.

## Sin hacer

- **#42:** `ofrecibles` sigue sin viajar por WhatsApp para el resto de las áreas (docs/hallazgos-ia.md).
- **#45:** lo que está sólo en `hace[]` de lib/funciones-mako.ts sigue sin llegarle a un cliente.
- **#40:** cuántas citas llegan sin texto no se midió. La charla del equipo entre ellos puede no estar en `mako_doer_conv`.
- **#41:** los prompts editados en la base (`getPromptText`, lib/prompt-registry.ts) pueden conservar el texto viejo: no se miró. El repo
  `mbustos-digital/mako-plugin` queda vivo a propósito, porque hay gente que ya lo instaló.
- **Del brief, no entraron:** «Código Inmobiliario: 21 fallos y 10 borradores», y el #43 (espera al #44 en main y la decisión de Martín).

## Para quien siga

- Los dos tests de `todo` que dan «failing» sin fallar (chats-mako-envio, doer-recetas-video-imagen) ya estaban así en main.
- Las roturas se midieron con un script que cambia el archivo, corre el test y lo restaura: mientras corre, otra edición del mismo archivo se pierde.
