# Relevo — MaKo inteligente: recomendaciones reales y Second Brain (cuenta claude4)

Rama `mako-inteligente-2710-c4`, worktree `C:/dev/wt-mako-inteligente-c4`. Al día: 28/10/2026, 21:40 (hora de Argentina).
Lo que sube a main lo junta y lo sube el Cerebro; cada entrega va por SendMessage como «VERDE <sha>» con la lista de .ts.

## Lo pedido, con sus palabras

- **Martín, 28/10:** «Te pido que el Second Brain de SuperAdmin tenga conocimiento de todas las funcionalidades, para que yo le
  pueda escribir y no haga cualquier cosa... (Supongo que todos los chats ya extraen data del second brain, si no lo hacen está
  mal... y que sea eficiente justamente, por eso tenemos tipo grafo, sin gastar tantos tokens...)». El relevamiento del Cerebro:
  C:/dev/revisiones/2810-second-brain-relevamiento.md.
- **Leila, 27/10:** los «no puedo» falsos de MaKo, y «siempre que MaKo diga que no pudo, un ticket» (Martín).
- **El ticket #16 de Leila:** «No me deja adjuntar un documento ni por arrastrar, ni por adjuntar».

## Lo hecho

| Qué | Commits | Dónde está |
|---|---|---|
| Los «no puedo» falsos, el ticket automático, MaKo no descalifica | hasta aec4ed0d9 | en producción |
| La verificación de aec4ed0d9; el hito del #16 | c49b23d8d, 280dfcf02 | en main |
| La guarda de una herramienta (base 7) y sus agujeros: tragada, «la última», la marca `guarda:true` | e6f58be78, ae1660f9a, 5f0792446, ab2b3904d, 574107963 | en main (tren-u y tren-v) |
| El catálogo de las funciones (lib/funciones-mako.ts), su capa del grafo y `grafoParaChat` | c272b97dd, 5402e7043, 0c80dd3ce | en main (tren-v) |
| La verificación de 0c80dd3ce (lo del super admin, la caché) y el Web Generator con la función que vende | 220a80af6, 3d73a2ea0, c659dc0f4 | en main (tren-v, 23b329b5e) |
| El turno de MaKo trae del Second Brain lo que nombra la pregunta, sin la plata para closers y setters | 809887ac9 … b2c19c445 | VERDE enviado al Cerebro (28/10, 21:35): falta su verificación |

## A medias

- **El ruido de «meta» en el turno de la plataforma:** la capa de funciones sólo en preguntas de producto (en curso).
- **La medición del turno** (ws 9, datos reales, 28/10): suma 588 tokens de promedio (9 de 9 preguntas traen algo) contra 1.256
  del grafo entero; «¿qué no hace la bandeja?» trae sólo Chats (373). Ruido: «¿Cuál es mi meta del trimestre?» trae Ads Manager
  («meta» es también Facebook).

## Falta verificar

- El ruido de «meta» en el turno de la plataforma: usar la capa de funciones sólo en preguntas de producto (la crítica C3 del
  relevamiento).
- Achicar el system fijo por etapas (perfil, funnel y fase cuando el paquete ya los trae; `hechosMako` como nodos).

## Espera a Martín

- El ticket #16 está en «esperando_decision»: el cron lo cierra cuando lo apruebe en el mazo (el hito ya está desplegado).

## La cola (después de esta tanda)

- Los recolectores del Second Brain (C:/dev/revisiones/2810-promesas-teo.md): los chats con MaKo, Offer, las llamadas, los
  anuncios y los reels; «Aprende solo» prendido en el onboarding; mostrar qué aprendió; sin Gemini.
- Del brief original: las notas de voz en toda caja; MK-13; P9 (memoria de la app contra la del grupo, con WhatsApp); la corrida
  real de scripts/probar-no-existe.mts; probar MAU-02 en el ws 3.
