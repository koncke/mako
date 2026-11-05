# Relevo — La marca del negocio en Image (y Video y Web Generator), en la nube (5/11/2026)

Lo escribe la sesión de la nube que hizo el trabajo (`cli_45e914c6-514d-5f5d-b151-4d8e5f267b67`, cuenta `nube`). **Esta sesión
no puede escribirle al Cerebro:** todo lo que hace falta está acá. La nube no llega a la base ni a un navegador con sesión: lo de
abajo se probó con tests que ejecutan el código (datos inventados) y con la cascada de IA corriendo contra una base de mentira.

## El pedido (llegó por el Cerebro, 5/11)

> Tres cosas en Image. 1. La marca completa en el chat de Imagen: colores, logo y fuentes en el prompt, con el presupuesto de
> contexto chico. 2. Brand board en el Segundo Cerebro: el negocio sube el PDF o la imagen de su marca, MaKo extrae colores,
> fuentes y logo, y el usuario los confirma. Varios kits por negocio, uno por defecto. Lo usan Image, Video y Web Generator. MaKo
> lo pide cuando falta, sin trabar nada. 3. Sin Gemini por defecto en Image. Además: «Discutir / Editar» en el chat de Imagen y
> en el de Video. Sumalo a la API de MaKo.

El origen: la llamada con Leila del 30/10 (sus carruseles sólo tomaban el fondo de su marca).

## Estado

Rama `claude/epic-brown-mqywl3`, subida a **`punta/image-marca`**. Si `punta.yml` da verde, entra a main sola; «en producción» es
recién con el deploy de Vercel en «Ready».

| Qué | Dónde | Cómo se probó |
|---|---|---|
| Kits de marca: varios por negocio, uno por defecto, en `app_settings` (`marca.kits`), con compare-and-set | lib/marca/kits.ts, lib/marca/kits-server.ts | tests/marca-kits.test.ts (9, siete roturas probadas) |
| MaKo lee el manual (PDF con texto sin IA + una llamada; imagen por la visión) y devuelve un BORRADOR | lib/marca/leer-manual.ts, `POST /api/marca` (`leer`) | el armado del borrador, en el test; la lectura real, **sin probar** |
| La pantalla: Second Brain → «Voz y cara» → «Marca» (estructura del Brand Kit de Canva: kits arriba, Logo · Colores · Fuentes) | app/second-brain/MarcaView.tsx | tipos; **sin mirar en un navegador** |
| La marca en el chat de Image: colores, fuentes que el editor tiene, logo como foto `"logo": true`; con varios kits, se elige | lib/image-editor/chat/ia.ts, app/image-editor/mako/chat/* | el bloque, en el test; el chat, **sin probar con IA** |
| La marca en Video (colores y fuentes) y en Web Generator (armar, editar y «Probar nuevo diseño») | lib/editor-video/ia.ts, lib/editor-landing/ia.ts | tipos |
| Los carruseles de MaKo con los colores, las fuentes y el logo del kit (nuevo diseño, «Hacer el mío» y las miniaturas) | lib/carruseles/marca-kit.ts, documento.ts | el test (contraste ≥ 4,5 y el logo en la cabecera) |
| Image sin Gemini: `image-editor-ia` y `marca-leer` con `deSuIA` (su Claude, su GPT, `fallback: []`) y la cascada que saca Gemini | lib/model-catalogo.ts, lib/ai-cheap.ts (`sinGemini`) | tests/solo-su-ia.test.ts corre la cascada de verdad (dos roturas probadas); tests/model-registry.test.ts |
| «Discutir \| Editar» en Image y Video: Discutir contesta sin cambiar nada (el código tira las operaciones) | lib/chat-editor-discutir.ts, los dos paneles | el test |
| La API de MaKo: `ver_kits_marca`, `guardar_kit_marca`, `elegir_kit_marca`, `borrar_kit_marca` (también por HTTP) | lib/api-mako/areas/negocio.*, rest.ts | tests del registro; docs/api-mako.md regenerado |
| El nodo «Tu marca» del grafo del Second Brain (lo ve también un closer: no tiene plata) | lib/cerebro-grafo.ts, lib/cerebro-union.ts | — |

**Sin migración:** los kits son un JSON chico por negocio y el logo es un archivo de «Subidos» del Image Editor (mig 0278, ya
aplicada).

## Qué probar en el negocio de prueba (ws 3), con la sesión de Martín

1. `/second-brain?area=voz&vista=marca`: sin kits dice «Sube tu manual…». «Subir manual de marca» con una imagen de una paleta:
   tiene que volver con colores (los códigos impresos entran aunque la IA no los dé) y, si se ve el logo, un recorte con «Usar
   este logo». Corregir algo y «Guardar». Después con un PDF.
2. «Armar a mano» un segundo kit, «Usar por defecto», y borrar uno (pide confirmación).
3. `/image-editor`: las miniaturas de los carruseles salen con los colores, las fuentes y el logo del kit de por defecto. Crear
   uno y abrirlo.
4. En un diseño, el chat: «Aplica mi marca» tiene que proponer colores, fuentes y poner el logo. Con dos kits aparece «Marca: X».
   Sin kits, el saludo invita a subir el manual. Cambiar a «Discutir» y preguntar «¿Qué mejorarías?»: contesta sin propuesta.
5. En el Video Editor: «Discutir | Editar» arriba de la caja.
6. Por la API (el Claude del cliente): `ver_kits_marca`, `guardar_kit_marca` con colores y el «sí».
7. Un negocio con SÓLO Gemini conectado: el chat de Image dice que conecte su Claude o su GPT (ya no corre con Gemini).

## Lo que queda abierto (y de quién es)

- **Mirar las pantallas en computadora y teléfono** antes de darlo por bueno (Martín lo revisa en producción). La pantalla de la
  marca no tiene versión del teléfono propia: en el teléfono el Second Brain abre las áreas como en la computadora.
- **La lectura con un manual real**: cuánto acierta la visión con la caja del logo (si la caja se sale de la imagen, no se
  recorta y se sube a mano). Un PDF de más de 4 MB se rechaza en la pantalla (el pedido topa en 4 MB): sube una imagen.
- **«MaKo lo pide cuando falta»** quedó como un link en el saludo del chat de Image, no como una apertura de `lib/aperturas/`
  (el chat de Image no monta `AperturaMako`). Si se quiere el formato de apertura, es del chat que lleva las aperturas.
- **El onboarding no pide la marca**, a propósito («sin trabar nada»).
- **D6b**: con «sólo su IA», la lista es `PROVS_SU_IA` (su GPT y su Gemini); `sinGemini` saca Gemini también ahí. La VISIÓN de
  `leerDocumentoIA` (leer una imagen del manual) no pasa por `sinGemini`: si el negocio sólo tiene Gemini, lo lee con su Gemini.
- Las 4 operaciones de la API van al final del área `negocio`. El presupuesto de 12.000 del chat quedó igual
  (`tests/ops-center-bateria.test.ts`, medido el 5/11 en la rama y en main): el CRON va 7.º, 11.682 de 12.000, margen 318
  sobre el piso de 300.

## Los 56 defaults con Gemini que quedan en lib/model-catalogo.ts (no se tocaron)

Medido el 5/11 sobre el catálogo (`def.provider === 'gemini'`). Todos corren con la clave del NEGOCIO (`provsDe`: nunca la
de la plataforma, y la red gratis de la plataforma no corre para ningún negocio desde el 22/10).

**Internos, Gemini a propósito (6):** el Plan, que nunca paga IA (`FEATURES_DEL_PLAN`, lib/veto-claude.ts) y un juicio del super
admin: `mako-guardian` (el Perro), `checklist-coach`, `plan-seed-ia`, `plan-fathom`, `plan-criterio`, `cs-autoasignar`.

**Auxiliares que corren dentro de los chats del cliente (4):** `mako-pedidos`, `Título de chat`, `onboarding-extract`, `ia-barata`.

**Los paga el cliente con su IA (46):**
- MaKo y análisis: `mako-doer-in` (PII), `mako-doer`, `mako-chat`, `second-brain-recolector` (PII), `mako-recomienda` (PII),
  `lead_insights` (PII), `experimentos`, `dashboard-hoja-ia`, `crm-ficha-tab-ia`, `dashboard-analista`, `dashboard-conclusiones`
  (PII), `ads-analyst`, `script-valorador`, `landing-analyst`, `productos`, `offer`, `ofertas`, `cs-propuesta-curso` (PII),
  `cs-sesion` (PII).
- Escribir: `campaign-suggest`, `media-buyer-variaciones`, `media-buyer-agentes`, `landing-writer`, `landing-editor`,
  `landing-editor-ia`, `copywriter-ia`, `newsletter-ia`, `video-editor-ia`, `reels-writer`, `carousels-writer`,
  `stories-writer`, `video-planner`, `video-escenas`, `wa-advisor` (PII), `wa-advisor-chat` (PII), `wa-template`,
  `post-llamada` (PII), `setting-guion-audio`, `chatbot-crear-ia`, `nutri-destilar-voz`, `nutri-generar`, `email-generar`.
- Simples: `ads-rename`, `validador`, `nutri-plantilla`, `avisos` (PII).

Si Martín quiere «sin Gemini» en otros, el molde es el de Image: `def: SU_IA`, `fallback: []`, `deSuIA: true` (y el test del
registro lo exige). `video-editor-ia` y `landing-editor-ia` son los candidatos obvios (mismo trato que Image hasta hoy).
