<template>
  <footer class="app-footer">
    <div class="footer-content">
      <div class="build-info">
        <span class="commit-info">
          Build: 
          <a 
            :href="commitUrl" 
            target="_blank" 
            rel="noopener noreferrer"
            class="commit-link"
            :title="`Built on ${buildDate}`"
          >
            {{ gitHash }}
          </a>
        </span>
        <span class="build-date">{{ formattedBuildDate }}</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'

// Reactive build info
const gitHash = ref('dev')
const repoUrl = ref('https://github.com/tylerrichey/expense-tracker')
const buildDate = ref(new Date().toISOString())

// Load build info asynchronously
onMounted(async () => {
  try {
    // Use explicit import with ?url to get the file path
    const response = await fetch('/build-info.json')
    if (response.ok) {
      const buildInfo = await response.json()
      gitHash.value = buildInfo.gitHash
      repoUrl.value = buildInfo.repoUrl
      buildDate.value = buildInfo.buildDate
    } else {
      // Try importing from src directory (for dev mode)
      try {
        // Use completely dynamic import to avoid TypeScript static analysis
        const buildInfoPath = '../build-info.json'
        const buildInfoModule = await import(/* @vite-ignore */ buildInfoPath)
        const buildInfo = buildInfoModule.default
        gitHash.value = buildInfo.gitHash
        repoUrl.value = buildInfo.repoUrl
        buildDate.value = buildInfo.buildDate
      } catch (importError) {
        console.warn('Build info not available, using defaults')
      }
    }
  } catch (e) {
    console.warn('Build info not available, using defaults')
    // Keep default values
  }
})

const commitUrl = computed(() => {
  return `${repoUrl.value}/commit/${gitHash.value}`
})

const formattedBuildDate = computed(() => {
  try {
    const date = new Date(buildDate.value)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return 'Unknown'
  }
})
</script>

<style scoped>
.app-footer {
  background: #1a1a1a;
  border-top: 1px solid #333;
  padding: 16px 20px;
  margin-top: auto;
  font-size: 12px;
  color: #888;
}

.footer-content {
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.build-info {
  display: flex;
  gap: 16px;
  align-items: center;
}

.commit-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.commit-link {
  color: #007bff;
  text-decoration: none;
  font-family: 'Courier New', monospace;
  font-weight: 500;
  padding: 2px 6px;
  background: rgba(0, 123, 255, 0.1);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.commit-link:hover {
  color: #4dabf7;
  background: rgba(0, 123, 255, 0.2);
  text-decoration: none;
}

.build-date {
  color: #666;
  font-size: 11px;
}


/* Mobile responsiveness */
@media (max-width: 768px) {
  .footer-content {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
  
  .build-info {
    flex-direction: column;
    gap: 4px;
  }
  
  .app-footer {
    padding: 12px 16px;
  }
}
</style>