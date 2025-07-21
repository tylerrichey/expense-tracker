#!/usr/bin/env node

import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

try {
  // Get git commit hash
  const gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  
  // Get git commit date
  const gitDate = execSync('git log -1 --format=%ci', { encoding: 'utf8' }).trim()
  
  // Get repository URL from git config
  let repoUrl = 'https://github.com/tylerrichey/expense-tracker'
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim()
    if (remoteUrl.includes('github.com')) {
      // Convert SSH or HTTPS git URL to GitHub web URL
      repoUrl = remoteUrl
        .replace('git@github.com:', 'https://github.com/')
        .replace('.git', '')
    }
  } catch (e) {
    console.log('Could not determine repository URL, using default')
  }
  
  const buildInfo = {
    gitHash,
    gitDate,
    repoUrl,
    buildDate: new Date().toISOString()
  }
  
  // Ensure directories exist
  const publicDir = join(__dirname, '../public')
  mkdirSync(publicDir, { recursive: true })
  
  // Write to public directory so it's accessible at runtime
  const publicBuildInfoPath = join(publicDir, 'build-info.json')
  writeFileSync(publicBuildInfoPath, JSON.stringify(buildInfo, null, 2))
  
  // Also write to src directory for development
  const srcBuildInfoPath = join(__dirname, '../src/build-info.json')
  writeFileSync(srcBuildInfoPath, JSON.stringify(buildInfo, null, 2))
  
  console.log('✅ Build info generated:', buildInfo)
  
} catch (error) {
  console.error('❌ Error generating build info:', error.message)
  
  // Create fallback build info
  const fallbackInfo = {
    gitHash: 'unknown',
    gitDate: 'unknown',
    repoUrl: 'https://github.com/tylerrichey/expense-tracker',
    buildDate: new Date().toISOString()
  }
  
  // Ensure directories exist
  const publicDir = join(__dirname, '../public')
  mkdirSync(publicDir, { recursive: true })
  
  const publicBuildInfoPath = join(publicDir, 'build-info.json')
  writeFileSync(publicBuildInfoPath, JSON.stringify(fallbackInfo, null, 2))
  
  const srcBuildInfoPath = join(__dirname, '../src/build-info.json')
  writeFileSync(srcBuildInfoPath, JSON.stringify(fallbackInfo, null, 2))
  
  console.log('⚠️ Using fallback build info')
}