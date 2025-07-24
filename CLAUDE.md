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

## Post-Commit Checklist

**ALWAYS monitor GitHub Actions after every commit and push - DO NOT STOP until build is complete:**

1. **Wait for build completion** - Wait at least 60 seconds after push, then use `gh run list --limit 3` to check status
2. **Monitor until completion** - Keep checking every 30-60 seconds until status shows "completed"
   - Status should be "completed" with "success" - not just "queued" or "in_progress"
   - Use `gh run view <run-id>` to get detailed logs if build fails
3. **Take immediate action on failures** - If build fails:
   - View the failure details with `gh run view <run-id>`
   - Fix the issues immediately while context is fresh
   - Commit and push the fixes
   - Monitor the new build until it succeeds
4. **Verify successful deployment** - Only consider the task complete when:
   - Build shows "completed" status with "success" 
   - No red X marks or failure indicators
   - Production deployment has succeeded
5. **Never leave broken builds** - Always follow through until green checkmarks appear

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