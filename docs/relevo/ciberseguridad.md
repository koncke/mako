# Relevo — Ciberseguridad

## PENDIENTE para la proxima cuenta: aguantar un ataque (15/10/2026)

**Lo pregunto Martin**, textual: «Te consulto si el chat de ciberseguridad tambien tuvo en cuenta
proteccion contra DDoS, metiendo cloudfare, capcha y load balancer... O bueno, como mejor considere
trabajar eso... Si no lo trabajo, dejalo registrado para la proxima cuenta trabajar eso.»

**Medido en el arbol el 15/10/2026, no supuesto.** La respuesta corta es NO: nada de eso esta.

| Que | Estado medido |
|---|---|
| **Cloudflare (o cualquier WAF) delante de MaKo** | **NO.** Las dos menciones del repo son comentarios sobre errores de TERCEROS (`lib/calendly-error.ts`, `lib/landing-extraer.ts`): hablan del Cloudflare de otros, no del nuestro |
| **Captcha propio** (Turnstile, hCaptcha, reCAPTCHA) | **NO.** Cero de turnstile y hcaptcha. Los 9 archivos con «recaptcha» son del puente a Google Flow (`lib/flow-*.ts`): es el captcha de GOOGLE que la extension se encuentra, no uno nuestro |
| **Balanceador propio** | **NO**, y probablemente no haga falta: Vercel pone el suyo delante. Vale medirlo antes de comprar nada |
| **Limite de pedidos por IP/usuario** | **PARCIAL: 35 de 339 rutas** de `app/api/` lo mencionan, o sea una de cada diez. Hay area propia con bitacora (`app/admin/dev/rate-limiting/`) |

**Por que importa y donde pega primero.** Lo que esta abierto al mundo sin sesion es lo caro: el
opt-in de las landings de los clientes (`/api/track/*`), los webhooks, el login y el «olvide mi
contrasena». Un bombardeo ahi no «tira el sitio» primero: **llena el CRM de un cliente de basura y
gasta IA**, que es plata que sale de su cuenta. Esa es la unica pantalla donde el dano se ve.

**Lo que conviene mirar en ese orden, cuando se retome:**

1. **Contar las rutas publicas sin limite de pedidos** (`PUBLICOS` en `lib/rutas-publicas.ts` cruzado
   con las 35 que ya lo tienen) y taparlas, empezando por las que ESCRIBEN o pagan IA.
2. **Un captcha solo donde hay un formulario que escribe** (el opt-in, el alta), nunca en toda la app:
   un captcha en el camino de un lead cuesta conversion y eso es plata del cliente. Es una decision de
   producto de Martin, no tecnica.
3. **Cloudflare delante** es la cobertura de fondo y cambia el DNS de hola-mako.com, asi que se planea
   con tiempo: hay que medir que pasa con los dominios propios de los clientes, con el Pixel que viaja
   en sus landings y con los webhooks entrantes (Meta, Calendly, Evolution, Zernio).
4. **El balanceador se mide antes de comprarlo.** Vercel ya reparte; sumar otro puede no cambiar nada.

⚠️ Y lo que NO se puede hacer de apuro: poner un captcha o un WAF delante de los webhooks entrantes
los ROMPE en silencio — el proveedor recibe un HTML en vez de un 200, reintenta y despues deshabilita
la suscripcion (ya paso dos veces con Calendly, esta escrito en AGENTS.md). Los webhooks se eximen
explicitamente, por ruta.

