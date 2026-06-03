# TurnOS — Gestión de Turnos

App completa de reserva de turnos con panel de administración.

## Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Vercel

## Cómo arrancar

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com)
2. Copiá `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
3. Completá con tus credenciales de Supabase:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```

### 3. Ejecutar el schema SQL

En el SQL Editor de Supabase, pegá y ejecutá el contenido de:
```
supabase/migrations/001_initial_schema.sql
```

Esto crea todas las tablas, políticas RLS y carga datos de ejemplo.

### 4. Crear usuario admin

En **Supabase → Authentication → Users**, creá un usuario con email y contraseña para acceder al panel.

### 5. Correr la app

```bash
npm run dev
```

La app estará disponible en `http://localhost:5173`

---

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Formulario de reserva público (paso a paso) |
| `/admin` | Panel de administración (requiere login) |

## Estructura del proyecto

```
src/
├── components/
│   ├── booking/        # Flujo de reserva público
│   │   ├── BookingFlow.tsx
│   │   ├── ServiceSelector.tsx
│   │   ├── ProfessionalSelector.tsx
│   │   ├── DateTimeSelector.tsx
│   │   └── BookingConfirm.tsx
│   ├── admin/          # Panel de administración
│   │   ├── AdminLayout.tsx
│   │   ├── Dashboard.tsx
│   │   ├── AppointmentList.tsx
│   │   ├── AvailabilityManager.tsx
│   │   ├── ServicesManager.tsx
│   │   └── ProfessionalsManager.tsx
│   └── ui/             # Componentes reutilizables
├── hooks/
│   └── useAvailability.ts
├── lib/
│   └── supabase.ts
├── pages/
│   └── AdminPage.tsx
└── types/
    └── index.ts
```

## Deploy en Vercel

1. Conectá el repositorio a Vercel
2. Configurá las variables de entorno (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`)
3. Deploy automático

## Funcionalidades incluidas

### Reserva pública
- Selección de servicio con duración y precio
- Selección de profesional disponible para el servicio
- Calendario con días habilitados
- Slots de tiempo en tiempo real (respetando turnos existentes y bloqueos)
- Formulario de datos del paciente
- Confirmación y mensaje de éxito

### Panel admin
- **Dashboard**: métricas del día, semana y lista de turnos de hoy
- **Turnos**: lista filtrable por estado, búsqueda, confirmar/cancelar/completar
- **Disponibilidad**: horarios semanales por profesional, activar/desactivar días
- **Servicios**: CRUD completo con colores, duración y precio
- **Profesionales**: CRUD con asignación de servicios

## Preparado para el futuro

El schema incluye campos para:
- **Pagos**: Mercado Pago, Stripe, MODO, PayPal
- **Notificaciones**: WhatsApp, email, SMS (recordatorios 48h y 24h)
- **Multi-sucursal**: tabla `locations`
