<template>
  <div class="coach-profile">
    <div class="page-header">
      <h2 class="page-title">个人资料</h2>
    </div>

    <div class="content-wrapper">
      <div class="skate-card profile-card">
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <div class="form-section">
            <h3 class="section-title">基本信息</h3>
            <div class="form-row">
              <el-form-item label="姓名" prop="name" class="form-item-half">
                <el-input v-model="form.name" placeholder="请输入姓名" />
              </el-form-item>
              <el-form-item label="联系电话" prop="phone" class="form-item-half">
                <el-input v-model="form.phone" placeholder="请输入联系电话" />
              </el-form-item>
            </div>
            <div class="form-row">
              <el-form-item label="擅长项目" prop="specialty" class="form-item-half">
                <el-input v-model="form.specialty" placeholder="例如：街式滑板、碗池滑板" />
              </el-form-item>
              <el-form-item label="教学年限" prop="experience" class="form-item-half">
                <el-input-number
                  v-model="form.experience"
                  :min="0"
                  :max="50"
                  placeholder="教学年限"
                  style="width: 100%"
                />
              </el-form-item>
            </div>
            <div class="form-row">
              <el-form-item label="课时费(元/小时)" prop="hourly_rate" class="form-item-half">
                <el-input-number
                  v-model="form.hourly_rate"
                  :min="0"
                  :precision="0"
                  placeholder="课时费"
                  style="width: 100%"
                />
              </el-form-item>
            </div>
          </div>

          <div class="form-section">
            <h3 class="section-title">个人简介</h3>
            <el-form-item prop="bio">
              <el-input
                v-model="form.bio"
                type="textarea"
                :rows="5"
                placeholder="介绍一下自己、教学理念、教学特色等..."
              />
            </el-form-item>
          </div>

          <div class="form-section">
            <h3 class="section-title">教学照片</h3>
            <el-form-item>
              <div class="upload-area">
                <div v-for="(photo, index) in photoList" :key="index" class="photo-item">
                  <img :src="photo" alt="教学照片" class="photo-preview" />
                  <el-button
                    type="danger"
                    size="small"
                    circle
                    @click="removePhoto(index)"
                    class="remove-btn"
                  >
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
                <label v-if="photoList.length < 6" class="upload-btn">
                  <el-icon :size="24"><Plus /></el-icon>
                  <span>添加照片</span>
                  <input
                    ref="photoInputRef"
                    type="file"
                    accept="image/*"
                    style="display: none"
                    @change="handlePhotoUpload"
                  />
                </label>
              </div>
              <div class="tip">最多上传6张教学照片，支持JPG、PNG格式</div>
            </el-form-item>
          </div>

          <div class="form-section">
            <h3 class="section-title">教学视频</h3>
            <el-form-item prop="videos">
              <div v-for="(video, index) in videoList" :key="index" class="video-item">
                <el-input
                  v-model="videoList[index]"
                  placeholder="视频链接地址"
                  style="flex: 1"
                />
                <el-button type="danger" circle @click="removeVideo(index)">
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
              <el-button v-if="videoList.length < 3" type="primary" plain @click="addVideo">
                <el-icon><Plus /></el-icon>
                添加视频链接
              </el-button>
              <div class="tip">最多添加3个教学视频链接</div>
            </el-form-item>
          </div>

          <div class="form-actions">
            <el-button @click="resetForm">重置</el-button>
            <el-button type="primary" @click="saveProfile" :loading="saving">
              保存修改
            </el-button>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../../api'
import { ElMessage } from 'element-plus'
import { Plus, Close } from '@element-plus/icons-vue'

const formRef = ref()
const saving = ref(false)

const form = reactive({
  name: '',
  phone: '',
  specialty: '',
  hourly_rate: null,
  bio: '',
  experience: 0,
})

const photoList = ref([])
const videoList = ref([])

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
}

async function loadProfile() {
  try {
    const { data } = await api.get('/coach/me')
    const coach = data.coach
    form.name = coach.name || ''
    form.phone = coach.phone || ''
    form.specialty = coach.specialty || ''
    form.hourly_rate = coach.hourly_rate || null
    form.bio = coach.bio || ''
    form.experience = coach.experience || 0
    
    if (coach.photos && typeof coach.photos === 'string' && coach.photos.trim()) {
      const rawPhotos = coach.photos.split(',')
      photoList.value = [...new Set(rawPhotos)].filter(p => p && p.trim())
    } else {
      photoList.value = []
    }
    
    if (coach.videos && typeof coach.videos === 'string' && coach.videos.trim()) {
      const rawVideos = coach.videos.split(',')
      videoList.value = [...new Set(rawVideos)].filter(v => v && v.trim())
    } else {
      videoList.value = []
    }
  } catch {}
}

async function saveProfile() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await api.put('/coach/profile', {
      ...form,
      photos: photoList.value.length > 0 ? photoList.value.join(',') : null,
      videos: videoList.value.length > 0 ? videoList.value.join(',') : null,
    })
    ElMessage.success('保存成功')
    await loadProfile()
  } catch {
  } finally {
    saving.value = false
  }
}

function resetForm() {
  formRef.value.resetFields()
  loadProfile()
}

const photoInputRef = ref(null)

function handlePhotoUpload(event) {
  const files = event.target.files
  if (!files || files.length === 0) return
  const remainingSlots = 6 - photoList.value.length
  const filesToProcess = Array.from(files).slice(0, remainingSlots)
  
  filesToProcess.forEach(file => {
    if (!file.type.startsWith('image/')) {
      ElMessage.warning('请选择图片文件')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      photoList.value.push(e.target.result)
    }
    reader.readAsDataURL(file)
  })
  
  if (photoInputRef.value) {
    photoInputRef.value.value = ''
  }
}

function removePhoto(index) {
  photoList.value.splice(index, 1)
}

function addVideo() {
  if (videoList.value.length < 3) {
    videoList.value.push('')
  }
}

function removeVideo(index) {
  videoList.value.splice(index, 1)
}

onMounted(() => {
  loadProfile()
})
</script>

<style scoped>
.coach-profile {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: slide-up 0.5s ease;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #F5F7FA;
  margin: 0;
}

.profile-card {
  padding: 32px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.form-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 16px;
  color: #00E5FF;
  margin: 0 0 20px 0;
  font-weight: 600;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-item-half {
  margin-bottom: 0;
}

.upload-area {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.photo-item {
  position: relative;
  width: 150px;
  height: 150px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #333;
}

.photo-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 4px;
}

.upload-btn {
  width: 150px;
  height: 150px;
  border: 2px dashed #444;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #666;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-btn:hover {
  border-color: #00E5FF;
  color: #00E5FF;
}

.upload-btn span {
  font-size: 13px;
}

.video-item {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.tip {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #333;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .profile-card {
    padding: 20px;
  }
}
</style>
