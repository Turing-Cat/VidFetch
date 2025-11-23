<script setup lang="ts">
import { ref, onMounted } from 'vue'

const videoUrl = ref('')
const downloadPath = ref('')
const selectedQuality = ref('best')
const selectedFormat = ref('mp4')
const isDownloading = ref(false)
const downloadProgress = ref(0)
const statusMessage = ref('')
const statusType = ref<'info' | 'success' | 'error'>('info')

onMounted(async () => {
  const defaultPath = await (window as any).api.getDefaultDownloadPath()
  if (defaultPath) {
    downloadPath.value = defaultPath
  }

  // Listen for progress
  ;(window as any).api.onDownloadProgress((progress: number) => {
    downloadProgress.value = progress
    statusMessage.value = `正在下载... ${progress}%`
  })
})

const handleSelectFolder = async () => {
  const path = await (window as any).api.selectFolder()
  if (path) {
    downloadPath.value = path
  }
}

const handleDownload = async () => {
  if (!videoUrl.value) {
    statusMessage.value = '请输入视频链接'
    statusType.value = 'error'
    return
  }
  
  isDownloading.value = true
  downloadProgress.value = 0
  statusMessage.value = '正在下载...'
  statusType.value = 'info'
  
  try {
    const result = await (window as any).api.downloadVideo({
      url: videoUrl.value,
      format: selectedFormat.value,
      quality: selectedQuality.value,
      outputFolder: downloadPath.value
    })
    
    if (result.success) {
      statusMessage.value = '下载完成！文件已保存至 ' + downloadPath.value
      statusType.value = 'success'
    } else {
      statusMessage.value = '下载失败: ' + result.error
      statusType.value = 'error'
    }
  } catch (e) {
    statusMessage.value = '发生错误'
    statusType.value = 'error'
    console.error(e)
  } finally {
    isDownloading.value = false
  }
}
</script>

<template>
  <div class="container">
    <header>
      <h1>视频下载器</h1>
      <p class="subtitle">将 YouTube, Bilibili 或其他支持的链接粘贴至此进行下载</p>
    </header>

    <main>
      <section class="input-section">
        <label>视频链接 (Video Link)</label>
        <div class="input-wrapper">
          <input 
            v-model="videoUrl" 
            type="text" 
            placeholder="在此粘贴视频链接..."
          />
          <span class="icon-link">🔗</span>
        </div>
      </section>

      <section class="options-section">
        <div class="option-group">
          <label>清晰度 (Quality)</label>
          <select v-model="selectedQuality">
            <option value="best">最佳 (Best)</option>
            <option value="4k">4K</option>
            <option value="1080p">1080P</option>
            <option value="720p">720P</option>
          </select>
        </div>

        <div class="option-group">
          <label>格式 (Format)</label>
          <select v-model="selectedFormat">
            <option value="mp4">MP4 (视频)</option>
            <option value="mkv">MKV (视频)</option>
            <option value="mp3">MP3 (音频)</option>
          </select>
        </div>
      </section>

      <section class="path-section">
        <label>保存至 (Save to)</label>
        <div class="input-wrapper">
          <input v-model="downloadPath" type="text" readonly />
          <button class="folder-btn" @click="handleSelectFolder">📂</button>
        </div>
      </section>

      <button 
        class="download-btn" 
        @click="handleDownload"
        :disabled="isDownloading"
        :class="{ 'is-loading': isDownloading }"
      >
        {{ isDownloading ? '下载中...' : '⬇ 开始下载 (Start Download)' }}
      </button>

      <div v-if="isDownloading" class="progress-bar-container">
        <div class="progress-bar" :style="{ width: downloadProgress + '%' }"></div>
      </div>

      <div v-if="statusMessage" class="status-message" :class="statusType">
        <span v-if="statusType === 'success'">✅</span>
        <span v-if="statusType === 'error'">❗</span>
        {{ statusMessage }}
      </div>
    </main>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
  width: 100%;
  box-sizing: border-box;
}

header {
  margin-bottom: 40px;
}

h1 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #fff;
}

.subtitle {
  color: #787c99;
  font-size: 14px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #c0caf5;
}

.input-section, .options-section, .path-section {
  margin-bottom: 24px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0 12px;
}

.input-wrapper input {
  flex: 1;
  background: transparent;
  color: #fff;
  padding: 12px 0;
  font-size: 14px;
}

.icon-link {
  color: #565f89;
}

.options-section {
  display: flex;
  gap: 20px;
}

.option-group {
  flex: 1;
}

select {
  width: 100%;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: #fff;
  padding: 12px;
  border-radius: 8px;
  outline: none;
  appearance: none; /* Remove default arrow */
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23565f89' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}

.folder-btn {
  background: #3d59a1;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
}

.download-btn {
  width: 100%;
  background: #7aa2f7;
  color: #1a1b26;
  font-weight: 700;
  padding: 16px;
  border-radius: 8px;
  font-size: 16px;
  margin-top: 20px;
}

.download-btn:hover {
  background: #89b4fa;
}

.download-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.status-message {
  margin-top: 20px;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-message.info {
  background: #24283b;
  color: #c0caf5;
}

.status-message.success {
  background: #1a2e26;
  color: #73daca;
  border: 1px solid #254436;
}

.status-message.error {
  background: #2e1a1a;
  color: #f7768e;
  border: 1px solid #442525;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background: #24283b;
  border-radius: 3px;
  margin-top: 20px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #7aa2f7;
  transition: width 0.3s ease;
}
</style>
