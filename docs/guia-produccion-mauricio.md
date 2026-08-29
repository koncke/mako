# Producir creativos para Mauricio con Flow — guía de trabajo manual

Con el plan de Google AI Pro (origen Jio, 18 meses, 1.000 créditos/mes) y el método
del curso **Creativos UGC Realistas · Avatar Hype**, adaptado a un consultor B2B.

**Decisión tomada: la cara es Mauricio.** Fotos reales suyas, no un avatar inventado.
Esta guía está reescrita sobre esa decisión.

---

## Lo primero, y bloquea todo lo demás

**Mauricio no tiene ni una foto cargada en MaKo.** Verificado: `mako.persona` en el
workspace 1 devuelve **0 filas**. Los únicos workspaces con persona son el 10, el 11 y
el 13. Sin fotos no hay identidad, y sin identidad cada pieza le inventa una cara
distinta.

**Mandale hoy este pedido por WhatsApp:**

> Necesito material tuyo para producir los creativos:
> - **6 a 8 fotos**: frontal, 3/4 izquierda, 3/4 derecha, perfil, una de cuerpo entero,
>   y dos con ropa distinta. Una con luz de ventana y otra con luz de oficina.
> - Que se te vea **la cara nítida y grande**. Sin lentes de sol, sin filtros, sin
>   retoque de piel, y sin otras personas en la foto.
> - **2 minutos de audio** leyendo cualquier cosa, en un lugar silencioso.
> - Confirmame **un solo nombre** para el mecanismo: ¿«Método DOS» o «Director
>   Operating System»? Hoy en la base están los dos para lo mismo y no se puede
>   producir con esa ambigüedad.

Sin filtros no es un detalle estético: el método exige poros, líneas y asimetrías, y
**prohíbe la piel alisada**. Una foto filtrada le borra justo lo que hace que el
resultado parezca real.

Cuando lleguen: subilas en `/onboarding` → Persona del workspace de Mauricio. MaKo
escribe sola la ficha física en ocho secciones (IDENTIDAD, ROSTRO, OJOS, CABELLO,
COMPLEXIÓN, MARCAS DISTINTIVAS, VESTIMENTA, ACTITUD) — eso ya está construido en
`lib/persona.ts:94` y **es exactamente el bloque C1 del método 6C**. Revisá y corregí
lo que salga mal: ese texto sostiene que sea siempre la misma cara.

---

## Mientras las fotos no llegan: mirá las dos clases de Clonación

El **módulo 5 (Clonación, partes 5.1 y 5.2) no está replicado en el repo**: hay dos
documentos huérfanos en `public/cono-doc/` sin clase, sin videoId y sin transcripción
(`curso-creativos-ugc-realistas.ts` no los menciona ni una vez). Es justo el material
que necesitás ahora que la cara es real. Entrá a AvatarHype y miralas.

Lo único que sí sobrevivió en el repo es **el prompt de bloqueo de identidad**, que es
la pieza clave de toda la consistencia:

    Reference image 1 defines the scene, framing, composition and action.
    Reference image 2 is a character sheet provided only as an identity reference:
    match the subject's facial features, proportions and physical traits exactly.
    Do not copy the layout, background, framing or poses from reference image 2.

Y la parte 5.2 recomienda **makeityours.app** con el código `AVATARHYPE` (30% off los
3 primeros meses).

---

## El flujo, en una frase

> «Primero crear la imagen y luego animar la imagen con el modelo de generación de vídeo.»
> — clase «Lo básico»

**Las imágenes en Flow NO descuentan créditos.** La mitad del pipeline es gratis:
podés iterar la cara de Mauricio cincuenta veces sin gastar nada. Los créditos solo se
queman al animar.

**Regla operativa que sale de ahí: no animes nada hasta tener la imagen aprobada.**
Re-imaginar es gratis, re-animar cuesta.

---

## Los pasos

1. **Fotos y audio de Mauricio** → subir a Persona en MaKo. *(0 créditos)*
2. **Elegir UNA celda y bloquear UN ángulo.** Sugerida: avatar «CEO de firma de
   servicios profesionales, Guadalajara» × razón **«Delegar sin perder control»** — el
   propio Mauricio declaró en el onboarding que le compra más rápido un CEO de
   servicios y que su región de más demanda es Guadalajara. Escribilo en un papel y no
   lo toques hasta publicar. *Error #1 del curso: mezclar varios ángulos en un video.*
3. **Escribir el guion clip por clip** (clips de 8 segundos), con rótulo + visual +
   texto hablado.
4. **Character sheet de Mauricio**: a partir de sus fotos reales, generar la lámina de
   tomas controladas en Flow con Nano Banana. *(0 créditos)* Se descarga y se adjunta
   como **segunda imagen de referencia** en todo lo que venga, junto con el prompt de
   bloqueo de identidad de arriba.
5. **Parchear el agente 6C antes de usarlo.** Viene calibrado para e-commerce: arranca
   con «AVATARHYPE ECOM» y su default es *«Instagram influencer, model-level
   aesthetic, polished, aspirational»*. Tres cambios: forzar **Option B** (relatable,
   imperfecto), reemplazar los 14 contextos de nightlife por contextos de negocio
   (oficina, sala de juntas, escritorio), y declarar mercado **México**. Y decile
   explícito que **no genere imágenes, solo el prompt** — las genera igual aunque
   tenga la opción apagada.
6. **Generar las imágenes de escena**, una por clip. *(0 créditos)* Las que vayan
   superpuestas detrás del avatar en CapCut, hacelas 1:1; las de escena completa, 9:16.
7. **CORRIDA DE PRUEBA: un solo clip, 10 créditos.** Animá un clip de b-roll con
   **Veo 3.1 Lite** para confirmar que acepta imagen de referencia en Flow. *Este paso
   decide si el mes te rinde 3 anuncios o 10. No lo saltes ni planifiques antes de
   correrlo.*
8. **Animar los clips.** Todos los de b-roll llevan **`NO TALKING`** en mayúsculas al
   inicio: sin eso el modelo pone a la persona hablando aunque no le des guion, y ese
   clip es crédito quemado.
9. **La voz: que la grabe Mauricio con el celular.** Es lo mejor y es gratis. La
   alternativa es clonarla en ElevenLabs con su audio y su permiso explícito.
10. **Quitar la marca de agua** con la herramienta de AvatarHype. Existe solo por usar
    Flow; publicar un anuncio pago con la marca de Google es peor que no publicar.
11. **CapCut** — acá termina Flow. Cortar silencios, subir la velocidad de los clips
    hablados entre **1.12 y 1.20** escuchando clip por clip (la IA genera gente
    hablando demasiado lento y eso mata el realismo), aplicar la capa de realismo
    guardada como preset, transición Mix.
12. **Publicar y registrar en MaKo**: llenar la celda de la matriz con el guion y las
    imágenes. Sin eso, en la cuarta pieza no vas a saber cuáles de las nueve cubriste.

---

## El presupuesto real

**La tabla del curso está mal.** Dice que Omni 8s son 20 créditos; la tabla oficial de
Flow dice **25**. Son 40 clips por mes, no 50 — el curso promete un 25% más de volumen
del que vas a tener.

**Y los anuncios de Mauricio son largos**: entre 45 y 114 segundos, promedio ~68. Eso
son **~8 clips por anuncio, no 4**. Duplicá cualquier cuenta que hayas leído.

| Formato | Créditos por pieza |
|---|---|
| Voz en off con Veo 3.1 Lite (8 clips) | **80** |
| Talking head con Omni Flash 8s (8 clips) | 200 |
| Pieza corta de 32s talking head | 100 |
| Todas las imágenes | **0** |

Con 1.000 créditos: ~12 piezas de voz en off, o ~5 de talking head. Contá **25-30% de
desperdicio** en reintentos.

**Mezcla recomendada:** 3 piezas de voz en off + 2 talking head cortas = ~440 créditos,
y te queda medio mes de colchón.

- **Quality es una trampa**: a 100 créditos el clip, un anuncio se come 800 de 1.000.
  Guardalo para el clip héroe de una pieza ya validada en pauta.
- **Los créditos NO se acumulan.** El mes que no producís perdés entre 4 y 10 anuncios
  de capacidad ya pagada. Por eso **cadencia semanal fija**, no lotes.
- Horizonte: 18 meses × ~5 piezas/mes ≈ **90 piezas cómodas**, ~180 empujando.
- Si algún mes te quedás corto: otro plan de US$12 con otro mail son otros 1.000
  créditos. Cuesta doce dólares, no doscientos.

---

## Las trampas que más caro salen

**El tono está en las transcripciones, no en los beats.** Los `beats` de
`script_analyses` están reescritos en **voseo argentino** («tenés», «mirá»), pero las
transcripciones reales de sus anuncios están en **tuteo mexicano** («tienes», «da
clic»). Si copiás los beats, el anuncio le habla argentino a un CEO de Guadalajara.

**No uses su voz de WhatsApp para el anuncio.** `mako.voz_guia` es su voz de venta 1 a
1 («Hola estimado», «Bendiciones»). Su voz de anuncio es otra: directa, sin saludo,
segunda persona, arranca con una escena concreta.

**El curso está calibrado para vender champú en Instagram.** La parte técnica se
transfiere entera —las anclas de consistencia, las reglas de realismo, la estructura
de seis bloques—; **Character, Clothing y Context hay que reescribirlos** para un
consultor con autoridad.

**El hueco real de su biblioteca no es dolor, es PRUEBA.** De sus 89 anuncios
analizados, 59 son de ángulo *dolor* y solo hay **2 con tag caso-de-éxito y 1 de
testimonio**. Ahí está el espacio vacío.

---

## Kie.ai y ApiMart

**Para producir a mano: no hacen falta.** Con los US$12 ya pagos tenés 18 meses, y las
imágenes son gratis. Solo tendrían sentido como saldo suelto si un mes te quedás corto.
(Nota: todos los links del curso llevan código de afiliado del instructor.)

**Para el producto MaKo: no sirven, y es contractual.** Los términos de ApiMart dicen
textual: *«You agree not to: Resell, redistribute, or white-label our API services
without explicit authorization»* — que es exactamente la forma de MaKo. Kie.ai ni
siquiera tiene figura de «End Users»: sus términos son una plantilla compartida con
media docena de micrositios de la misma empresa.

El riesgo real no es que te demanden: es que un martes cierran el pool que había
detrás y los clientes dejan de generar a mitad de una campaña paga.

**La alternativa correcta es fal.ai**, el único que define «Client Solution» y «End
Users» y autoriza explícitamente a servir a tus clientes por su API.

---

## Una regla que sale de acá y sirve para el producto

El curso rutea por si el avatar habla o no: **clip con habla = modelo caro con lip
sync; clip sin habla = modelo barato**. Es un orden de magnitud de diferencia y hoy
MaKo no lo decide automáticamente. Cuando se construya el generador, esa regla vale
plata.
