# Docker Migration Guide

This guide explains how to run the image migration script against your production database in Docker.

## Prerequisites

- Your Docker container is running
- You have access to `docker exec` commands
- Your production database has images that need migration

## Running Migration in Docker

### Method 1: Using npm script (Recommended)

```bash
# Get your container ID or name
docker ps

# Execute the production migration script
docker exec -it <container-name-or-id> npm run migrate-images-prod
```

### Method 2: Direct node execution

```bash
# Execute the script directly
docker exec -it <container-name-or-id> node scripts/migrate-existing-images.js
```

### Method 3: Interactive shell (for debugging)

```bash
# Enter the container
docker exec -it <container-name-or-id> sh

# Run the migration from inside
npm run migrate-images-prod

# Exit when done
exit
```

## Example Session

```bash
$ docker exec -it expense-tracker npm run migrate-images-prod

🚨 IMAGE MIGRATION WARNING 🚨
=====================================
This script will:
• Convert all existing images to WebP format with compression
• Apply orientation correction to fix rotated images
• Potentially reduce image file sizes by 60-75%
• PERMANENTLY modify your database images

⚠️  IMPORTANT:
• Make sure you have a database backup before proceeding
• This operation cannot be undone
• The migration may take several minutes depending on image count

🌍 Environment: PRODUCTION
📋 Database path: /app/data/expenses.db

🔴 PRODUCTION ENVIRONMENT DETECTED!
• You are about to modify your live production database
• Consider stopping the application during migration to prevent conflicts
• Backup will be created automatically, but ensure you have external backups

Do you want to proceed with the migration? (yes/no): yes

📥 Creating backup: /app/data/expenses-backup-before-image-migration-2025-08-23T22-15-00-000Z.db
✅ Backup created successfully (15.2MB)

🔍 Finding expenses with images...

📊 Found 25 expenses with images
🚀 Starting migration...

[1/25] (4.0%) Processing expense 123...
✅ Expense 123: jpeg 3024x4032 → WebP (2.8MB → 756KB, 73.0% compression)

[2/25] (8.0%) Processing expense 124...
✅ Expense 124: jpeg 4032x3024 → WebP (3.1MB → 812KB, 74.2% compression)

...

🎉 MIGRATION COMPLETED!
========================
⏱️  Duration: 125.3s
📊 Total images found: 25
✅ Successfully processed: 24
⏭️  Skipped (already optimized): 0
❌ Failed: 1
📦 Size before: 67.2MB
📦 Size after: 18.4MB
💾 Total saved: 48.8MB (72.6% reduction)

✨ Your database images have been optimized and orientation-corrected!
```

## Safety Features

1. **Automatic Backup**: Creates timestamped backup in `/app/data/`
2. **Production Detection**: Warns when running against production database
3. **Interactive Confirmation**: Requires explicit "yes" to proceed
4. **Progress Tracking**: Shows detailed progress for each image

## Database Paths

- **Production**: `/app/data/expenses.db`
- **Backup location**: `/app/data/expenses-backup-before-image-migration-*.db`

## Troubleshooting

### Container not found
```bash
# List all containers
docker ps -a

# Use the correct container name
docker exec -it expense-tracker npm run migrate-images-prod
```

### Permission denied
The script should run as the `nodejs` user inside the container, which has proper permissions.

### Migration fails
- Check container logs: `docker logs <container-name>`
- The backup will remain intact for recovery
- Contact support with error details

## Best Practices

1. **Stop traffic** during migration if possible (maintenance mode)
2. **Monitor progress** - don't interrupt the process
3. **Verify results** after completion
4. **Keep backups** safe until you've verified the migration worked
5. **Test image display** in the app after migration

## Recovery

If something goes wrong, you can restore from backup:

```bash
# Enter container
docker exec -it <container-name> sh

# Stop the app (if needed)
# Replace database with backup
cp /app/data/expenses-backup-before-image-migration-*.db /app/data/expenses.db

# Restart container
exit
docker restart <container-name>
```