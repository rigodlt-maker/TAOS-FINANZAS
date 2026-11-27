# Servidor de TAOS Nube (F5) · referencia técnica

Un solo proyecto de Supabase para las 4 apps (Administrador Tao, Tao Fit, Segundo Cerebro y Optimizador de Vida), todas
desde la rama `nube-1` de su plantilla y con `TAOS_MODO=nube`. Tu versión propia (Hotmart) no cambia.

## 1. Base de datos
- `instalar-nube.sql`: las 4 apps juntas. Se corre **una vez** en el proyecto nuevo. Generado con `node scripts/nube-sql.cjs`.
- Probado con Postgres real: `npm run prueba:nube` (aislamiento entre dos personas en las 36 tablas, sin llaves cruzadas, y borrar una cuenta no toca a las demás).

## 2. Supabase › Authentication
- **Sign In / Providers › Email:** «Enable email signups» y **«Confirm email»** encendidos.
- **URL Configuration:** *Site URL* = la dirección de Administrador Tao Nube. *Redirect URLs*: `https://<cada app>/auth/callback` (Finanzas, Fit, Cerebro) y `https://<optimizador>/login`.
- **Emails › Templates:** pegar los 4 de `correos/` (cada archivo dice en qué plantilla va y su asunto).
- **Correo propio (SMTP):** el correo de Supabase solo manda unos pocos por hora: sirve para probar, no para abrir al público. Resend (gratis) solo manda a cualquier correo con un **dominio propio verificado** (D10). Hasta entonces, el servidor es de prueba.

## 3. Variables en Vercel (las 4 apps, rama de producción `nube-1`)
| Variable | Valor |
|---|---|
| `TAOS_MODO` | `nube` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | las del proyecto **TAOS Nube** (no las de tu proyecto Finanzas) |
| `CRON_SECRET` | una clave larga nueva (la misma en las 4 está bien) |
| `NEXT_PUBLIC_URL_PRIVACIDAD` | `https://taos-landing.pages.dev/nube/privacidad/` |
| `NEXT_PUBLIC_URL_TERMINOS` | `https://taos-landing.pages.dev/nube/terminos/` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | las de Cloudflare Turnstile (opcional, pero recomendado) |

**No van en Nube:** `ALLOWED_EMAIL`, `CODIGO_COMPRA`, `PANEL_PASSWORD`, `GOOGLE_CLIENT_ID/SECRET`, `ANTHROPIC_API_KEY`.
**Después (F6, con Play Console):** `PLAY_PAQUETE`, `PLAY_CUENTA_SERVICIO` (las 4) y `PLAY_RTDN_CLAVE` (solo Finanzas).

## 4. Plan gratis: lo que hay que saber
- Supabase gratis permite 2 proyectos activos y **pausa un proyecto sin uso por 7 días** (se reactiva con un clic).
- Vercel Hobby es para uso personal y no comercial: sirve para el servidor de **prueba**. Antes de cobrar (F8) se pasa a un plan de pago o a Cloudflare (D5/D6).
