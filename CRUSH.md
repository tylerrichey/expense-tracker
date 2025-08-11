# CRUSH.md - Development Commands & Style Guide

## Build & Test Commands
- **Single test**: `vitest run <path-to-test>` (e.g., `vitest run src/utils/weekdayCalculations.test.ts`)
- **All tests**: `npm run test` (includes typecheck + vitest)
- **Watch tests**: `npm run test:watch`
- **Build**: `npm run build` (runs tests then prod build)
- **Type check**: `npm run typecheck`
- **Dev server**: `npm run dev` (uses test DB)
- **Kill ports**: `npx kill-port 3000 5173`

## Code Style
- **TypeScript**: Strict mode enabled, no unused locals/params
- **Vue**: Composition API with `<script setup>`
- **Imports**: Named exports for services (e.g., `export const databaseService`, not `export default`)
- **Naming**: camelCase (vars, funcs), PascalCase (components), UPPER_SNAKE (constants)
- **Error handling**: Use try/catch with specific error messages
- **File structure**: Feature-based components, util functions, service layer
- **Database**: SQLite with better-sqlite3, test DB = `expenses-test.db`

## Safety Check
- Always run `npm run build` before commits
- Monitor GitHub Actions: `gh run list --limit 3` after push