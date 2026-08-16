# Assets de la bienvenida

## `ojo-neurona.mp4`

Hace **la secuencia entera en un solo clip**, que era lo que se buscaba: ojo humano macro
→ la cámara entra por la pupila → negro → corte a una neurona con sus pulsos eléctricos.

- **Origen:** https://pixabay.com/videos/eye-neuron-zoom-science-15522/
- **Licencia:** [Pixabay Content License](https://pixabay.com/service/license-content/) —
  permite uso comercial y **no exige atribución**.
- **Medido reproduciéndolo, no leído de la ficha:** 1920×1080, 10,05 s, 3.466.325 bytes
  (3,31 MB).

### La línea de tiempo real del clip

Verificada cuadro a cuadro con `scratchpad/tramo.mjs`, no con la descripción del sitio:

| tiempo | qué pasa |
|---|---|
| 0,00 s | el ojo entero: pestañas, esclerótica, iris verde-avellana |
| 0,29 s | las pestañas ya salieron del cuadro — **es la cámara la que entra**, no la pupila la que se dilata |
| 0,58 s | solo iris y pupila |
| 0,73 – 1,31 s | negro: se está adentro del ojo |
| **1,45 s** | corte a la neurona 3D |
| 1,45 – 10,05 s | la neurona con pulsos. **La cámara acá ya no se mueve**: quedarse es mirar un loop |

Por eso `Bienvenida.tsx` lo corta en `SEG_UTILES = 4.6`.

### ⚠️ La cláusula que hay que respetar, y NO es la de uso comercial

La de Pixabay que decide es la de **contenido standalone**, textual:

> «You cannot sell or distribute Content (either in digital or physical form) on a
> Standalone basis. Standalone means where no creative effort has been applied to the
> Content and it remains in substantially the same form as it exists on our website.»

Y Pixabay **define** que aplicar solamente un filtro, un cambio de color, un resize o un
crop **sigue siendo standalone**. O sea que servir el mp4 tal cual no alcanza.

**Lo que nos deja del lado limpio** es que acá el clip no se sirve solo: se corta a 4,6 s,
se le encadena el mapa del negocio del cliente, un fundido y el texto — o sea una obra
compuesta. Si algún día se lo usa pelado (una landing con el video de fondo y nada más),
esa cláusula vuelve a aplicar y hay que revisarlo.

Lo otro, común a estas licencias: **no hay model release y Pixabay no lo garantiza** — la
responsabilidad queda de este lado. En un macro donde la persona no es identificable, con
un uso que no es ofensivo ni sugiere que recomiende MaKo, el riesgo es bajo. Es una
evaluación, no un documento.

### Lo que se descartó, y por qué importa

El primer clip elegido (Pexels 32198166, «close up of a human brown eye flickering») era
un **plano fijo**: medido, el ojo tiene exactamente el mismo tamaño de 0,05 s a 3,46 s, y
lo único que pasa es un parpadeo al final. Se eligió leyendo el título — «flickering» se
interpretó como movimiento de cámara y era el párpado.

**La regla que queda: antes de bajar un clip, mirá la tira de fotogramas.** Está
`scratchpad/inspeccionar.mjs`: recibe el link de la página, saca el mp4 directo y arma seis
cuadros repartidos. Un título dice lo que se ve; solo los fotogramas dicen lo que hace.
