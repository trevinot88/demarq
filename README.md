# Constructor Admin

Sistema de gestión de contratistas por proyecto para empresa constructora.

## Stack

- **Backend**: Node.js + Express + SQLite (better-sqlite3)
- **Frontend**: React 18 + Vite + TailwindCSS
- **Deploy**: Render.com (monorepo, backend sirve el frontend buildeado)

## Desarrollo local

```bash
# Instalar dependencias (root + frontend)
npm install

# Poblar base de datos con datos de ejemplo
npm run seed

# Correr dev (backend en :3001, frontend en :5173 con proxy)
npm run dev
```

Abrir http://localhost:5173

## Deploy en Render

1. Conectar el repositorio en Render.com
2. Build Command: `npm install && npm run build`
3. Start Command: `npm start`
4. Agregar un Persistent Disk en `/var/data` (1 GB)
5. Variable de entorno `DB_PATH=/var/data/constructor.db`

Después del primer deploy, correr el seed desde el Shell de Render:
```bash
npm run seed
```

## Módulos

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard | `/` | KPIs y resumen semana actual |
| Relación Semanal | `/reports` | Semanas, entradas por proyecto |
| Proyectos | `/projects` | CRUD proyectos + contratistas asignados |
| Contratistas | `/contractors` | CRUD contratistas + historial |
| Gasolinas / Caja | `/fuel` | Caja de gasolinas y retiros |

## Roles

Sin autenticación. Selector CEO / Asistente en el navbar (diferencia visual, sin restricciones por ahora).

## Scripts

```bash
npm start          # Producción
npm run dev        # Desarrollo (ambos servicios)
npm run build      # Build del frontend
npm run seed       # Poblar BD con datos de ejemplo
```
