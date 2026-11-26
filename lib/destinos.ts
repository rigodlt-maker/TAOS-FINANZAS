// Todas las pantallas de Administrador Tao, ordenadas por grupo y con las palabras con que la gente las busca.
// Lo usan el Menú (agrupado) y el buscador 🔍 del encabezado (components/taos/buscador.tsx).
import {
  ArrowLeftRight,
  Bell,
  Calendar,
  Camera,
  ChartPie,
  FileUp,
  HandCoins,
  Home,
  Inbox,
  KeyRound,
  Landmark,
  List,
  Mail,
  MessageSquareHeart,
  Repeat,
  Settings,
  Sparkles,
  Tags,
  Target,
  Type,
  Wallet,
} from "lucide-react";
import type { Destino } from "@/components/taos/buscador";

export const GRUPOS = ["Registrar", "Ver mis gastos", "Pagos y deudas", "Ahorro", "Configurar"] as const;

export const DESTINOS: Destino[] = [
  // Registrar
  { ruta: "/agregar", nombre: "Agregar un gasto o ingreso", detalle: "A mano o con tu estado de cuenta", grupo: "Registrar", icono: FileUp, palabras: "agregar nuevo registrar anotar gasto ingreso compra importar estado de cuenta pdf excel csv" },
  { ruta: "/agregar#foto", nombre: "Foto del ticket", detalle: "La app lee el total, la fecha y el lugar", grupo: "Registrar", icono: Camera, palabras: "ticket foto camara escanear recibo nota factura" },
  { ruta: "/entre-cuentas", nombre: "Pagar tarjeta o mover dinero", detalle: "Entre tus propias cuentas", grupo: "Registrar", icono: ArrowLeftRight, palabras: "transferir transferencia mover pagar tarjeta abonar traspaso cajita ahorro depositar" },
  { ruta: "/revisar", nombre: "Por revisar", detalle: "Gastos sin categoría", grupo: "Registrar", icono: Inbox, palabras: "revisar pendientes sin categoria clasificar" },
  { ruta: "/correos", nombre: "Avisos del banco", detalle: "Compras que llegan de tu Gmail", grupo: "Registrar", icono: Mail, palabras: "correo gmail banco avisos notificaciones del banco automatico" },
  // Ver mis gastos
  { ruta: "/", nombre: "Inicio", detalle: "Tu dinero libre y lo más importante", grupo: "Ver mis gastos", icono: Home, palabras: "inicio principal resumen dinero libre saldo" },
  { ruta: "/movimientos", nombre: "Movimientos", detalle: "Todos tus gastos e ingresos; edítalos aquí", grupo: "Ver mis gastos", icono: List, palabras: "movimientos historial lista gastos ingresos editar borrar cambiar comercio tienda lugar oxxo" },
  { ruta: "/presupuesto", nombre: "Presupuesto", detalle: "Cuánto llevas de cada categoría", grupo: "Ver mis gastos", icono: ChartPie, palabras: "presupuesto limite categorias graficas me alcanza cuanto puedo gastar hormiga antojos gastitos" },
  { ruta: "/suscripciones", nombre: "Mis suscripciones", detalle: "Lo que pagas cada mes y no usas", grupo: "Ver mis gastos", icono: Repeat, palabras: "suscripciones netflix spotify cobros fijos recurrentes cancelar mensualidades meses sin intereses msi" },
  { ruta: "/asesor", nombre: "Pregúntale a Tao", detalle: "Tu asesor por chat", grupo: "Ver mis gastos", icono: Sparkles, palabras: "tao asesor chat preguntar ayuda" },
  // Pagos y deudas
  { ruta: "/pagos", nombre: "Pagos", detalle: "Qué pagar y cuándo", grupo: "Pagos y deudas", icono: Calendar, palabras: "pagos pagar fecha limite corte vence calendario tarjetas intereses programados recibos" },
  { ruta: "/creditos", nombre: "Mis créditos", detalle: "Carro, personal, casa…", grupo: "Pagos y deudas", icono: Landmark, palabras: "creditos deuda prestamo carro auto hipoteca casa personal nomina mensualidad" },
  { ruta: "/prestamos", nombre: "Me deben", detalle: "Lo que prestaste a otros", grupo: "Pagos y deudas", icono: HandCoins, palabras: "me deben prestamos prestado cobrar amigo" },
  // Ahorro
  { ruta: "/metas", nombre: "Metas de ahorro", detalle: "Cuánto llevas y cuánto falta", grupo: "Ahorro", icono: Target, palabras: "metas ahorro ahorrar objetivo viaje fondo emergencia" },
  // Configurar
  { ruta: "/ajustes#cuentas", nombre: "Mis cuentas y tarjetas", detalle: "Saldos, corte, fecha límite, 4 dígitos", grupo: "Configurar", icono: Wallet, palabras: "cuentas tarjetas agregar tarjeta saldo corte dia limite pago dias para pagar terminacion banco efectivo rendimiento cajita" },
  { ruta: "/ajustes#categorias", nombre: "Editar categorías", detalle: "Crear, renombrar y poner presupuesto", grupo: "Configurar", icono: Tags, palabras: "categorias editar crear renombrar borrar presupuesto subcategoria" },
  { ruta: "/ajustes#avisos", nombre: "Notificaciones", detalle: "Avisos en tu celular antes de cada pago", grupo: "Configurar", icono: Bell, palabras: "notificaciones avisos alertas recordatorios push campana" },
  { ruta: "/ajustes#pantalla", nombre: "Letra grande", detalle: "Tamaño de la letra", grupo: "Configurar", icono: Type, palabras: "letra grande tamano pantalla ver mejor" },
  { ruta: "/ajustes#contrasena", nombre: "Contraseña", detalle: "Para entrar a la app", grupo: "Configurar", icono: KeyRound, palabras: "contrasena clave entrar acceso password" },
  { ruta: "/sugerencias", nombre: "Sugerencias", detalle: "Ideas, fallas o mejoras para TAOS", grupo: "Configurar", icono: MessageSquareHeart, palabras: "sugerencias sugerencia idea ideas falla error mejora comentario opinion soporte" },
  { ruta: "/ajustes", nombre: "Ajustes", detalle: "Todo lo demás de la app", grupo: "Configurar", icono: Settings, palabras: "ajustes configuracion opciones reglas tutorial" },
];
