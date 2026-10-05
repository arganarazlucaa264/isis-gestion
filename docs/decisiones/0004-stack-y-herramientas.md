# 0004 · Stack y herramientas del frontend

**Estado:** aceptada

## Decisión

- React + Vite + TypeScript con modo estricto (`strict`, `noUncheckedIndexedAccess`,
  `noUnusedLocals`, etc.). `exactOptionalPropertyTypes` se dejó desactivado: choca con los tipos
  generados por Supabase y con las props de React.
- TanStack Query para estado del servidor; React Router para rutas; Zod para validar datos.
- Tailwind CSS v4 (plugin de Vite). Sin librería de UI pesada hasta que se necesite.
- ESLint (typescript-eslint `strictTypeChecked`) + Prettier; Vitest para tests del frontend.
- Supabase CLI como dependencia de desarrollo (`npx supabase`) para versionarlo con el proyecto.
- Alias `@/` para `src/`.
- Se agregan dependencias solo cuando la etapa que las usa las necesita (por ejemplo
  `react-hook-form` en Etapa 1/2 y la librería de Excel en Etapa 4).

## Consecuencias

- Tipos de base generados con `npm run db:types` (archivo `src/types/database.ts`, no se edita a mano).
- `npm run check` ejecuta typecheck, lint, formato y tests: es lo mismo que corre el CI.
