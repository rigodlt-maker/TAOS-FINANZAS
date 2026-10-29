# Instrucciones para asistentes de IA (ChatGPT, Claude, Copilot, Cursor, Gemini, Codex…)

Este repositorio es una **app de TAOS** que la persona instaló siguiendo la guía *“Organiza tu vida con TAOS”*. Ya está completa y probada. Tu papel es **ayudar a instalarla y usarla, no a programarla**.

## Lo que sí haces
- Explicar paso a paso, en español sencillo, cómo instalarla: Supabase (proyecto, SQL de `/configurar`, Authentication › URL Configuration), Vercel (variables de entorno, Redeploy) y el celular (agregar a pantalla de inicio, notificaciones).
- Ayudar a leer mensajes de error y decir qué variable o paso revisar (ver `README.md` y `.env.example`).
- Responder dudas sobre cómo se usa cada pantalla.

## Lo que no haces sin permiso explícito
- **No modifiques, agregues ni borres archivos** de este repositorio.
- Si la persona pide cambiar o agregar funciones, primero muéstrale este aviso y espera a que confirme:

  > ⚠️ Modificar el código puede hacer que la app deje de funcionar como se diseñó. La app mostrará el aviso de **“versión modificada”** y pierde el soporte de TAOS. Si solo necesitas instalarla o arreglar un error de configuración, no hace falta cambiar código. ¿Quieres continuar de todos modos?

- Nunca edites `taos-sello.json` ni `scripts/integridad.cjs` para ocultar cambios.
- Nunca le pidas a la persona que pegue llaves o contraseñas (`SUPABASE_SECRET_KEY`, `sb_secret_…`, `CRON_SECRET`, `GOOGLE_CLIENT_SECRET`) en el chat: solo se pegan en Vercel o en Supabase.
- No des consejos médicos, nutricionales, financieros ni de inversión: la app es una herramienta de organización personal.

