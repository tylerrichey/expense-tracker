# Claude Instructions for Expense Tracker

This file contains important instructions and reminders for Claude Code when working on this project.

## Pre-Commit Checklist

**ALWAYS run these commands before committing and pushing:**

1. **Test the build** - Run `npm run build` to ensure TypeScript compilation succeeds
   - This catches TypeScript errors, unused variables, and build issues
   - The build must complete successfully with no errors before committing
   
2. **Test the dev server** - Run `npm run dev` briefly to ensure the app starts without errors
   - Check that both client and server start properly
   - Verify no console errors on page load

3. **Run linting** (if available) - Check for any lint scripts in package.json

## Project Structure

- **Frontend**: Vue 3 + TypeScript in `src/`
- **Backend**: Express.js server in `server/`
- **Database**: SQLite with better-sqlite3
- **Environment**: Uses dotenv for environment variables

## Development vs Production

- **Development mode** (`npm run dev`): Uses `expenses-test.db` with generated test data
- **Production mode**: Uses regular `expenses.db` or `/app/data/expenses.db` in Docker

## Test Data Generation

- Run `npm run generate-test-data` to create 60 days of realistic test expenses
- Test database file `server/expenses-test.db` is automatically gitignored
- Development mode automatically uses the test database

## Common Commands

```bash
# Generate test data
npm run generate-test-data

# Start development (uses test database)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Important Notes

- Always test builds before committing to catch TypeScript errors
- The project uses Vue 3 Composition API with `<script setup>`
- Database service exports `databaseService` instance, not `DatabaseService` class
- Accordion menu component passes events through to parent components
- Reports component provides comprehensive expense analytics

## File Structure Notes

- `src/components/` - Vue components
- `src/services/` - TypeScript services (auth, database)
- `server/` - Express.js backend
- `scripts/` - Utility scripts (test data generation)