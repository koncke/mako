# El lanzamiento orgánico: lo que al ws 9 le falta para que exista el eslabón 4 (8/11/2026)

**Medido contra producción, no supuesto.**

## ⛔ El hallazgo: en el workspace de MaKo, el «comentá una palabra» NO EXISTE

| | ws 10 (Leandro) | **ws 9 (MaKo)** |
|---|---|---|
| Instagram conectado | sí, 594 conversaciones | **sí**, 9 conversaciones (última: 7/11 23:41) |
| Webhook de Zernio | `webhook_ok: true` | **`webhook_ok: true`** (desde el 1/11) |
| Secuencias con disparo `instagram` | **10, siete activas** | **CERO** |
| DMs de Instagram mandados por el motor | 97 | **ninguno, nunca** |

Las 26 secuencias del ws 9 son avisos de MaKo, no-shows y reactivaciones. **Ninguna escucha
comentarios.** El canal está conectado y el webhook anda: lo que no hay es la automatización.

**Por qué importa:** todo el plan orgánico —2 reels por día, cada uno con una palabra para
comentar— cuelga de esto. Hoy, si alguien comenta «SETTER» en un reel de MaKo, **no pasa nada**. No
es que falle: no hay nada escuchando.

Esto es distinto del ticket #63. Aquel es un ajuste de Meta en la cuenta de Leandro, y está
diagnosticado. Éste es que en la cuenta de Martín la máquina no está armada.

## Cómo es una que SÍ funciona (ws 10, secuencia 707 «IG - LISTA»)

Seis nodos, 1.724 caracteres de JSON. El disparador:

```json
[{"id":"d1","subtipo":"comentario","palabras":["lista","lizta","list","format"],
  "trigger_tipo":"instagram","cron_proxima_at":null}]
```

⚠️ **Las palabras incluyen las faltas de ortografía** (`lizta`, y en las otras `gacho`, `marc`). La
gente escribe mal la palabra del CTA, y sin la variante ese comentario no dispara nada. Es el
detalle que más barato sale y más caro cuesta olvidar.

El grafo:

| nodo | qué es |
|---|---|
| `entrada` → `nlcjml0` | el primer DM, respondiendo al comentario |
| `n7ecwkh` | una condición |
| `n4wu86y` | **entrega el recurso**, con un botón que lleva a una URL |
| `nem81on` | «Todavía no te veo entre nuestros seguidores…» — la entrega detrás de seguir la cuenta |
| `nfknzem` | otra condición |

O sea que Leandro **condiciona el recurso a que te sigan**. Es una decisión de embudo, no un
detalle técnico: conviene decidirla antes de copiar el molde.

## Lo que hay que crear en el ws 9

Una secuencia por palabra del CTA. Del plan de lanzamiento son siete (la octava, AVATAR, depende de
que el avatar se venda — `AI_AVATAR_SE_VENDE = false`):

| palabra | landing | variantes que conviene agregar |
|---|---|---|
| SETTER | `/l/setter` | seter, setter |
| PÁGINA | `/l/paginas` | pagina, pajina, paginas |
| PAUTA | `/l/anuncios` | pauta, pautas, anuncios |
| NÚMEROS | `/l/numeros` | numeros, numero, números |
| CIERRE | `/l/llamadas` | cierre, cerrar, llamadas |
| CURSO | `/l/cursos` | curso, cursos, comunidad |
| PLAN | `/l/plan` | plan, planes |

⚠️ **Las palabras con tilde se comentan sin tilde casi siempre.** PÁGINA y NÚMEROS necesitan las dos
formas, y conviene elegir palabras del CTA **sin tilde** para los reels que vengan.

## ⚠️ Y una decisión que hay que tomar ANTES: a dónde lleva el botón

Las siete landings están escritas pero **viven en el disco, servidas en `localhost:4179`**. No están
publicadas en ningún lado público. El botón del DM necesita una URL que exista. Dos caminos:

1. **Publicarlas** (Web Generator o donde sea) y que el botón lleve a `/l/<slug>`.
2. **Mandar directo al checkout**, `hola-mako.com/planes/pro?landing=<slug>&…`, que **ya funciona
   hoy** (verificado: los dos planes dan `cobrable: true`, con ARS 151.805 cargados para Pro). Se
   pierde la página de venta, se gana salir ya.

Lo decide Martín. El camino 2 no bloquea nada y el 1 se puede hacer después sin rehacer las
secuencias, cambiándoles la URL del botón.

## ⚠️ Y el mismo riesgo del ticket #63 aplica acá, sin verificar

El 2534037 es **por cuenta de Instagram**. La de Leandro tiene otra app como receptor primario. **La
de MaKo no se probó nunca** —cero DMs mandados por el motor—, así que no se sabe. Se mira en
`facebook.com/settings/?tab=ig_conversation_routing` actuando como la Página vinculada, igual que
en el caso de Leandro, **antes** de publicar el primer reel y no después.

## Lo que NO hice, y por qué

Crear las siete secuencias es una **escritura en producción** que además deja automatizaciones
mandándole mensajes a gente real. Eso pide el sí de Martín en el chat
([[aprobacion-prod-en-el-chat]]). Lo que sí está: el molde medido, las palabras con sus variantes y
las dos decisiones que hay que tomar antes.
