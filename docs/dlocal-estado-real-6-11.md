# dLocal Go: lo que de verdad pasa, medido el 6/11/2026 a la noche

**Por qué existe este documento.** Esa noche se creyó —yo el primero— que la pasarela estaba lista:
la cuenta decía «Nuestro equipo aprobó tu documentación», las claves estaban cargadas y el conector
escrito. **Nada de eso significa que cobre.** Acá está lo medido contra la API, para que nadie vuelva
a darlo por hecho.

## 1. ⚠️ LA CUENTA TODAVÍA NO PUEDE COBRAR

Leído de `GET /v1/me` con las claves de producción:

| Campo | Valor |
|---|---|
| `kyc_level` | **2** |
| `kyc_level_status` | **PENDING** |
| `is_in_fraud_review` | **true** |
| saldos | **0** |

**«El paso 2 está aprobado» y `kyc_level: 2` se leen igual y NO son lo mismo:** el nivel está
alcanzado, su estado sigue pendiente, y además la cuenta está en revisión por fraude. **Y no hay un
campo `charges_enabled`**: la API contesta 200 a todo y publica sus 32 monedas igual, así que desde
afuera parece habilitada.

**Cómo se comprueba, sin tocar código:** un `GET /v1/me` con las claves. Es lo primero que hay que
mirar antes de decir que la pasarela está lista.

## 2. ⚠️ LAS CLAVES NO VAN EN VERCEL. Fue un error mío y falla EN SILENCIO

El 6/11 cargué `DLOCAL_API_KEY`, `DLOCAL_SECRET_KEY` y `DLOCAL_SMARTFIELDS_KEY` en el proyecto de
Vercel. **No sirven ahí.** Una clave de pasarela se lee sólo con `credDelCliente`, que va a la base
**sin respaldo del entorno**: `aplicarAEnv` se niega a copiarlas y `NO_MIGRAR_A_WS` impide que
migren.

**Van cargadas en la app: `/integraciones` → Pagos**, en el workspace de la plataforma.

⚠️ **Y no falla con un error: el conector dice «falta la credencial».** Alguien puede pasar horas
buscando por qué no toma una clave que está puesta en el lugar equivocado.

`DLOCAL_SMARTFIELDS_KEY` **no hace falta**: MaKo cobra por link de pago, no con el formulario
embebido.

## 3. ⚠️ dLocal Go NO cobra suscripciones por el camino implementado

`POST /v1/payments` es **pago único**. El producto de MaKo son suscripciones de US$47 y US$97 por
mes. dLocal lista sus endpoints de suscripción **por nombre, sin publicar método ni ruta**, así que
hay que **pedírselos por escrito**. Sin eso, el plan no se puede vender por esta pasarela.

## 4. Google Pay y Apple Pay no existen en dLocal Go

Google Pay está documentado para el **gateway empresarial** de dLocal, que es otro producto. De
Apple Pay no hay nada. Y **no hay endpoint que liste los medios de pago**: cuatro rutas candidatas
dieron 404 o 400 y su índice de documentación no tiene esa página. Una lista de medios en el checkout
tendría que ser **una tabla escrita a mano**.

## 5. Dos cosas del checkout que NO son un cambio de texto

- **La nota de Mercado Pago es load-bearing.** La suscripción queda a nombre de ese email y con otra
  cuenta de MP no se autoriza: **borrarla crea el fallo que hoy evita.** La otra nota sí se puede
  sacar.
- **La prueba de 7 días YA EXISTE y es con tarjeta.** Que se «reclame» sin pagar cambia el alta, la
  conversión y abre la puerta al abuso: **es una decisión de producto, no de copy.**

## 6. El barrido de claves de cobro quedó ciego dos veces

Audita por **prefijo**, y por eso no vio ni las de Creem (31/10) ni las de dLocal (6/11):
`credWs('DLOCAL_API_KEY')` pasaba **en verde** mientras le cobraba al ws1, que es el de Mauricio.
Ahora el barrido se deriva del fuente en vez de mirarse a ojo.

## 7. Una corrección a `proveedores-de-cobro.md`

Ese documento se sostiene, con una excepción: **«sólo cobra y paga en pesos argentinos» es falso
para el cobro.** La cuenta es en USD y `currency` y `country` son independientes, así que los planes
**se pueden cobrar en USD**. Lo del pago sí es cierto: el retiro sale en pesos.

## Lo que sigue esperando a Martín

1. **Que dLocal levante la revisión por fraude.** Sin eso no hay nada que probar.
2. **Pedirles por escrito la API de suscripciones.**
3. **Cargar las tres claves en `/integraciones` → Pagos** (y decidir si se sacan de Vercel, donde no
   hacen nada).
4. **Medir el primer retiro real**: es el único número que falta para saber si de cada US$97 quedan
   los 90,98 calculados.
5. **EE.UU. y Europa siguen sin pasarela.** dLocal no los cubre. Ese hueco lo iba a tapar Whop —que
   **nunca contestó**— o FastSpring, al que **nunca se le escribió**. No se arregla dibujando el
   checkout.
