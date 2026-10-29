# Administrador Tao · TAOS

Tu dinero en orden: gastos en una línea, presupuesto por categoría, metas de ahorro, pagos de tarjeta con aviso 7 y 2 días antes, préstamos y lectura de los correos de tu banco. Funciona sin IA.

## Instalar

[![Instalar en Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frigodlt-maker%2Ftaos-finanzas&project-name=administrador-tao&repository-name=administrador-tao&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,SUPABASE_SECRET_KEY,ALLOWED_EMAIL,CRON_SECRET&envDescription=Datos%20de%20tu%20proyecto%20de%20Supabase%2C%20tu%20correo%20y%20un%20texto%20al%20azar%20para%20los%20avisos)

1. Toca el botón y entra con GitHub.
2. Pega las variables (abajo) y toca **Deploy**.
3. En Supabase › Authentication › URL Configuration, agrega la dirección de tu app + `/auth/callback`.
4. Abre tu app: la primera vez te da el código para Supabase › SQL Editor (un solo pegado).
5. Agrega la app a la pantalla de inicio de tu celular y activa las notificaciones.

| Variable | Qué pegar |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto de Supabase, solo hasta `.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`) |
| `ALLOWED_EMAIL` | Tu correo: solo ese puede entrar |
| `CRON_SECRET` | Un texto al azar (por ejemplo de generate-secret.vercel.app/32) |
| `RESEND_API_KEY` | (Opcional) Llave de resend.com para avisos por correo |
| `RESEND_FROM` | (Opcional) Remitente de los correos |
| `TITULAR_NOMBRE` | (Opcional) Tu nombre como aparece en los correos de tu banco |

## Probar en tu computadora

```bash
npm install
npm run dev
npm test
```

Parte de **TAOS**, un sistema de 4 apps personales para organizar tu vida. Herramienta de organización personal: no es asesoría médica, financiera ni legal.

## Soporte y modificaciones

- El soporte de TAOS cubre **la versión original** de esta app, instalada siguiendo la guía.
- Si cambias el código (tú, otra persona o una IA), la app lo detecta al publicarse y muestra el aviso **“versión modificada”**. Puede dejar de funcionar como se diseñó y ya no tiene soporte.
- Para instalar o arreglar un error de configuración **no necesitas cambiar código**: casi siempre es una variable en Vercel o el SQL de Supabase.
- Tus datos viven en tus propias cuentas (Supabase, Vercel y Google). Nadie más puede verlos.
