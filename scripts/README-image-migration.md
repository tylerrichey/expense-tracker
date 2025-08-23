# Image Migration Script

This script migrates existing images in your expense tracker database to optimized WebP format with proper orientation correction.

## What it does

- 🔄 **Converts images to WebP format** with 85% quality for optimal compression
- 📐 **Fixes orientation issues** by applying EXIF rotation data
- 💾 **Reduces database size** by 60-75% on average
- 📊 **Provides detailed progress** and statistics
- 🛡️ **Creates automatic backup** before making changes
- ⚠️ **Skips already optimized images** to avoid reprocessing

## Usage

### Run the migration

```bash
npm run migrate-images
```

### Test image compression (without modifying database)

```bash
npm run test-image-compression
```

## Safety Features

1. **Automatic Backup**: Creates a timestamped database backup before starting
2. **User Confirmation**: Requires explicit "yes" confirmation before proceeding
3. **Validation**: Verifies image validity before processing
4. **Skip Logic**: Avoids reprocessing already optimized WebP images
5. **Error Handling**: Continues processing other images if one fails
6. **Progress Tracking**: Shows detailed progress and statistics

## What to expect

### Before running
- The script will show warnings and ask for confirmation
- It will create a backup file like: `expenses-backup-before-image-migration-2025-08-23T20-15-00-000Z.db`

### During execution
```
[1/5] (20.0%) Processing expense 123...
✅ Expense 123: jpeg 3024x4032 → WebP (2.8MB → 756KB, 73.0% compression)
```

### Results
```
🎉 MIGRATION COMPLETED!
========================
⏱️  Duration: 45.2s
📊 Total images found: 15
✅ Successfully processed: 13
⏭️  Skipped (already optimized): 1
❌ Failed: 1
📦 Size before: 45.2MB
📦 Size after: 12.8MB
💾 Total saved: 32.4MB (71.7% reduction)
```

## When to use this script

- **After implementing image compression**: To optimize existing images
- **When database size is too large**: To reduce storage requirements
- **When images display rotated**: To fix orientation issues
- **Before deployment**: To optimize production database

## Troubleshooting

### "No images found in database"
- This is normal if you haven't uploaded any images yet
- The script will exit gracefully

### "Processing failed" errors
- Usually indicates corrupted or invalid image data
- The script will continue processing other images
- Check the error details in the console output

### "Database update failed"
- Rare error that might indicate database corruption
- The backup can be restored if needed

## Recovery

If something goes wrong, you can restore from the backup:

1. Stop the application
2. Replace your database file with the backup:
   ```bash
   cp expenses-backup-before-image-migration-*.db expenses.db
   ```
3. Restart the application

## Technical details

- Uses Sharp library for high-performance image processing
- Applies automatic EXIF orientation correction
- Converts to WebP with 85% quality setting
- Resizes images larger than 1920px (maintains aspect ratio)
- Processes images sequentially to avoid memory issues
- Creates detailed logs for troubleshooting

## Performance considerations

- Processing time: ~2-3 seconds per image
- Memory usage: Processes one image at a time to minimize RAM usage
- Database locking: Uses SQLite transactions for safe updates
- Backup time: Depends on database size, typically a few seconds

## Best practices

1. **Always backup first** (script does this automatically)
2. **Run during maintenance window** to avoid user disruption
3. **Monitor the process** - don't interrupt once started
4. **Test on development first** if you have a large database
5. **Check results** after completion to verify success