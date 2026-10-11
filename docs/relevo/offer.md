# Relevo — la tab Offer

<sub>Escrito por el chat que la construyó (cuenta claude3), 11/10/2026 ~18:00 UTC. Primera mano.</sub>

## Dónde quedó

- **v1 en producción** (commit `18b48ced`, deploy READY): `/offer` = chat con IA → diagnóstico de
  9 dimensiones → oferta nueva → PDF. Análisis pasó a ser la 4ª tab de Experiments. Migración
  0254 (`offer_sesiones`) aplicada. El marco destilado de los cursos: `docs/offer-marco.md`. Lo
  que costó y lo pendiente: `docs/hallazgos-offer.md`. Memoria: `offer-tab-chat-ia`.
- **NO se vio en el navegador**: el vigía de RAM mató el dev server local dos veces compilando
  `/offer` y la extensión de Chrome no estaba conectada.

## El pedido NUEVO de Martín (11/10/2026, textual) — es lo que sigue

> Las ofertas deben estar atados a los productos del CRM... Y quiero cambiar el concepto
> "Producto" por "Funnel" en todos lados... Porque un mismo funnel puede tener varias "ofertas"...
> Configuralo de esa manera, para que yo pueda seleccionar en que funnel analizar o crear una
> nueva oferta. Mandale como tarea al CRM que lo cambie en todos lados.
>
> En la tab de offer, que donde hoy está el título de "Offer" se elimine y ahí se seleccione un
> funnel, y se pueda crear o analizar una oferta.
>
> Y para la funcionalidad de la tab, quiero que aproveches las cosas que ya construimos... Por
> ejemplo "El diagnóstico" (Que en este caso, las preguntas deben ser más personalizadas y el
> resultado del diagnóstico no se debe ver al finalizar esas preguntas, pero si ser parte del PDF
> final). Aprovecha "El archivero", "Avatares", "Razones"...
>
> Puedes ir pidiendole todo por el chat, en el orden que te parezca... Yo creo que si partimos de
> un documento o un link de su web o landing o algo así, sería mucho más fácil... Pero si no tiene
> nada o hay cosas que le faltan, como que nunca pensó en una garantía o no tiene claro su avatar,
> también con preguntas poder ir creando todo.
>
> Elimina el botón de "Ofertas anteriores", para eso ya estará el desplegable... Y ese desplegable
> debe ser modo arbol, como lo hacemos siempre. Primero el paso del funnel y dentro las ofertas que
> hayan.
>
> Quiero que el diseño del chat se vea exactamente igual a lo que ya creamos... Que tenga ese
> formato de grabar audio, la animación de grabando audio, adjuntar archivos, imagenes, emojis...
> Copialo tal cual. Y el que pregunta, que sería MaKo, la foto de perfil que sea la estrella de
> MaKo, que tiene una sola estrella sin una estrellita pequeña arriba, y el fondo negro.

(Mandó una captura del editor de mensajes de WhatsApp de Automations: burbujas con audio y
texto, composer con emoji · clip · `{ }` · micrófono.)

## Cómo lo encaré (estado al escribir esto)

1. **El renombre Producto → Funnel en el CRM es del chat del CRM**: se le mandó la tarea con el
   pedido textual. La tab Offer lee los productos del CRM (`lib/productos.ts`) como «funnels» y
   las ofertas de cada uno por `oferta_productos` (mig 0169/0171); no renombra nada del CRM.
2. **Offer v2** (en curso en este chat): selector en ÁRBOL en el lugar del título (funnel → sus
   ofertas, más «Nueva oferta» en cada funnel), sin el botón de historial; la sesión queda atada a
   `producto_id` + la oferta; el chat con los componentes de WhatsApp (`ChatHilo`/`BurbujaHilo`/
   `ComposerWhatsApp`: audio con su animación, adjuntos, imágenes, emojis) y el avatar de MaKo
   (estrella sola, fondo negro); arrancar pidiendo un documento o el link de la web/landing; el
   diagnóstico de fase (`lib/fase-diagnostico.ts`) preguntado adentro del chat con opciones
   personalizadas, sin mostrar el resultado, y en el PDF; Archivero, Avatares y Razones como
   contexto (y lo que falte, construido con preguntas).

## Si esto lo retoma otra cuenta

`git log --oneline -- app/offer lib/offer-*` dice qué de la v2 ya entró. Lo que no esté
commiteado y aparezca en el árbol es trabajo a medias de este chat: no se pushea sin verlo.
