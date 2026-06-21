<template>
  <div class="admin-bookings">
    <div class="skate-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="预约管理" name="bookings">
          <div class="filters">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
            <el-select v-model="filterStatus" placeholder="状态筛选" clearable>
              <el-option label="待支付" value="pending" />
              <el-option label="已支付" value="paid" />
              <el-option label="已签到" value="checked_in" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
            <el-select v-model="filterType" placeholder="类型筛选" clearable>
              <el-option label="散客场" value="venue" />
              <el-option label="私教课" value="private" />
            </el-select>
          </div>
          <el-table :data="filteredBookings" :style="darkTableStyle">
            <el-table-column prop="username" label="用户" />
            <el-table-column prop="booking_date" label="日期" />
            <el-table-column label="时段">
              <template #default="{ row }">
                {{ row.start_time }}-{{ row.end_time }}
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" />
            <el-table-column prop="coach_name" label="教练" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="payment_status" label="支付状态" />
            <el-table-column prop="amount" label="金额" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="扫码签到" name="checkin">
          <div class="checkin-section">
            <div class="checkin-methods">
              <div class="checkin-method">
                <h3 class="card-title">扫码签到</h3>
                <p class="method-desc">使用摄像头扫描用户出示的签到二维码</p>
                <el-button type="primary" @click="startCamera">
                  <el-icon><Camera /></el-icon>
                  <span>打开摄像头扫码</span>
                </el-button>
              </div>
              <div class="divider">或</div>
              <div class="checkin-method">
                <h3 class="card-title">手动输入</h3>
                <p class="method-desc">手动输入签到令牌完成签到</p>
                <div class="manual-input">
                  <el-input
                    v-model="manualToken"
                    placeholder="请输入签到令牌"
                    size="large"
                    @keyup.enter="handleManualCheckin"
                  />
                  <el-button type="success" size="large" @click="handleManualCheckin" :loading="checkingIn">
                    签到
                  </el-button>
                </div>
              </div>
            </div>

            <el-dialog v-model="cameraDialogVisible" title="扫码签到" width="600px">
              <div class="camera-container">
                <video ref="videoRef" class="camera-video" autoplay playsinline></video>
                <canvas ref="canvasRef" style="display: none;"></canvas>
                <div class="scan-overlay">
                  <div class="scan-box"></div>
                </div>
              </div>
              <div v-if="scanning" class="scanning-status">
                <el-icon class="is-loading" :size="20"><Loading /></el-icon>
                <span>正在识别二维码...</span>
              </div>
              <template #footer>
                <el-button @click="stopCamera">取消</el-button>
              </template>
            </el-dialog>

            <div v-if="checkinResult" class="checkin-result" :class="checkinResult.success ? 'success' : 'error'">
              <div class="result-icon">
                <el-icon :size="48">
                  <CircleCheckFilled v-if="checkinResult.success" />
                  <CircleCloseFilled v-else />
                </el-icon>
              </div>
              <div class="result-message">{{ checkinResult.message }}</div>
              <div v-if="checkinResult.booking" class="result-booking-info">
                <div class="info-item">
                  <span class="label">用户</span>
                  <span class="value">{{ checkinResult.booking.username }}</span>
                </div>
                <div class="info-item">
                  <span class="label">手机号</span>
                  <span class="value">{{ checkinResult.booking.phone || '-' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">日期</span>
                  <span class="value">{{ checkinResult.booking.booking_date }}</span>
                </div>
                <div class="info-item">
                  <span class="label">时段</span>
                  <span class="value">{{ checkinResult.booking.start_time }} - {{ checkinResult.booking.end_time }}</span>
                </div>
                <div class="info-item">
                  <span class="label">类型</span>
                  <span class="value">{{ checkinResult.booking.type === 'venue' ? '散客场' : '私教课' }}</span>
                </div>
                <div v-if="checkinResult.booking.coach_name" class="info-item">
                  <span class="label">教练</span>
                  <span class="value">{{ checkinResult.booking.coach_name }}</span>
                </div>
              </div>
            </div>

            <div class="today-checkins">
              <h3 class="card-title">今日签到记录</h3>
              <el-table :data="todayCheckins" :style="darkTableStyle">
                <el-table-column prop="username" label="用户" />
                <el-table-column prop="phone" label="手机号" />
                <el-table-column label="时段">
                  <template #default="{ row }">
                    {{ row.start_time }}-{{ row.end_time }}
                  </template>
                </el-table-column>
                <el-table-column prop="type" label="类型" />
                <el-table-column prop="coach_name" label="教练" />
                <el-table-column prop="check_in_time" label="签到时间" />
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="消息中心" name="messages">
          <div class="message-section">
            <h3 class="card-title">发送消息</h3>
            <el-form :model="msgForm" label-width="80px">
              <el-form-item label="用户">
                <el-select v-model="msgForm.user_id" placeholder="选择用户" filterable>
                  <el-option
                    v-for="u in users"
                    :key="u.id"
                    :label="u.username"
                    :value="u.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="类型">
                <el-select v-model="msgForm.type">
                  <el-option label="通知" value="notification" />
                  <el-option label="提醒" value="reminder" />
                  <el-option label="系统" value="system" />
                </el-select>
              </el-form-item>
              <el-form-item label="标题">
                <el-input v-model="msgForm.title" />
              </el-form-item>
              <el-form-item label="内容">
                <el-input v-model="msgForm.content" type="textarea" :rows="4" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="sendMessage">发送</el-button>
              </el-form-item>
            </el-form>
          </div>
          <div class="message-section">
            <h3 class="card-title">已发消息</h3>
            <el-table :data="sentMessages" :style="darkTableStyle">
              <el-table-column prop="user_id" label="用户ID" />
              <el-table-column prop="type" label="类型" />
              <el-table-column prop="title" label="标题" />
              <el-table-column prop="content" label="内容" />
              <el-table-column label="操作" width="100">
                <template #default="{ $index }">
                  <el-button size="small" type="danger" @click="deleteMessage($index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { api } from '../../api'
import { ElMessage } from 'element-plus'
import { Camera, Loading, CircleCheckFilled, CircleCloseFilled } from '@element-plus/icons-vue'

const activeTab = ref('bookings')
const bookings = ref([])
const dateRange = ref(null)
const filterStatus = ref('')
const filterType = ref('')
const users = ref([])
const sentMessages = ref([])

const msgForm = reactive({
  user_id: null,
  type: 'notification',
  title: '',
  content: '',
})

const manualToken = ref('')
const checkingIn = ref(false)
const checkinResult = ref(null)
const todayCheckins = ref([])
const cameraDialogVisible = ref(false)
const scanning = ref(false)
const videoRef = ref(null)
const canvasRef = ref(null)
let stream = null
let scanInterval = null

async function handleManualCheckin() {
  if (!manualToken.value.trim()) {
    ElMessage.warning('请输入签到令牌')
    return
  }
  
  checkingIn.value = true
  checkinResult.value = null
  try {
    const { data } = await api.post('/checkins/qrcode', { token: manualToken.value.trim() })
    checkinResult.value = {
      success: true,
      message: data.message || '签到成功',
      booking: data.booking
    }
    manualToken.value = ''
    loadTodayCheckins()
  } catch (e) {
    checkinResult.value = {
      success: false,
      message: e.response?.data?.error || '签到失败',
      booking: e.response?.data?.booking || null
    }
  } finally {
    checkingIn.value = false
  }
}

async function loadTodayCheckins() {
  try {
    const { data } = await api.get('/checkins')
    todayCheckins.value = data.checkins || []
  } catch {
    todayCheckins.value = []
  }
}

async function startCamera() {
  cameraDialogVisible.value = true
  scanning.value = false
  checkinResult.value = null
  
  await nextTick()
  
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
    }
    startScanning()
  } catch (e) {
    ElMessage.error('无法访问摄像头，请确保已授权摄像头权限')
    cameraDialogVisible.value = false
  }
}

function stopCamera() {
  if (scanInterval) {
    clearInterval(scanInterval)
    scanInterval = null
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  cameraDialogVisible.value = false
  scanning.value = false
}

function startScanning() {
  if (!videoRef.value || !canvasRef.value) return
  
  scanning.value = true
  
  scanInterval = setInterval(() => {
    if (!videoRef.value || !canvasRef.value) return
    
    const video = videoRef.value
    const canvas = canvasRef.value
    const ctx = canvas.getContext('2d')
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQRDecode(imageData)
    
    if (code) {
      clearInterval(scanInterval)
      scanInterval = null
      scanning.value = false
      
      try {
        const qrData = JSON.parse(code)
        if (qrData.token) {
          manualToken.value = qrData.token
          handleManualCheckin()
          stopCamera()
        }
      } catch {
        ElMessage.warning('无法识别二维码内容')
        startScanning()
      }
    }
  }, 500)
}

function jsQRDecode(imageData) {
  return null
}

watch(activeTab, (newTab) => {
  if (newTab === 'checkin') {
    loadTodayCheckins()
  }
})

onUnmounted(() => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
  }
  if (scanInterval) {
    clearInterval(scanInterval)
  }
})

const darkTableStyle = {
  '--el-table-bg-color': '#2C2C2C',
  '--el-table-tr-bg-color': '#2C2C2C',
  '--el-table-header-bg-color': '#3A3A3A',
  '--el-table-row-hover-bg-color': '#363636',
  '--el-table-border-color': '#444',
  '--el-table-text-color': '#F5F7FA',
  '--el-table-header-text-color': '#00E5FF',
}

const filteredBookings = computed(() => {
  let list = bookings.value
  if (dateRange.value) {
    const [start, end] = dateRange.value
    list = list.filter(b => b.booking_date >= start && b.booking_date <= end)
  }
  if (filterStatus.value) {
    list = list.filter(b => b.status === filterStatus.value)
  }
  if (filterType.value) {
    list = list.filter(b => b.type === filterType.value)
  }
  return list
})

async function loadBookings() {
  try {
    const { data } = await api.get('/bookings/all')
    bookings.value = data.bookings || []
    extractUsers()
  } catch {}
}

function extractUsers() {
  const map = new Map()
  for (const b of bookings.value) {
    if (b.user_id && b.username && !map.has(b.user_id)) {
      map.set(b.user_id, { id: b.user_id, username: b.username })
    }
  }
  users.value = Array.from(map.values())
}

async function sendMessage() {
  if (!msgForm.user_id || !msgForm.title || !msgForm.content) {
    ElMessage.warning('请填写完整消息信息')
    return
  }
  try {
    const { data } = await api.post('/messages', {
      user_id: msgForm.user_id,
      type: msgForm.type,
      title: msgForm.title,
      content: msgForm.content,
    })
    ElMessage.success('发送成功')
    sentMessages.value.unshift({
      user_id: msgForm.user_id,
      type: msgForm.type,
      title: msgForm.title,
      content: msgForm.content,
    })
    Object.assign(msgForm, { user_id: null, type: 'notification', title: '', content: '' })
  } catch {}
}

function deleteMessage(index) {
  sentMessages.value.splice(index, 1)
  ElMessage.success('删除成功')
}

onMounted(() => {
  loadBookings()
})
</script>

<style scoped>
.admin-bookings {
  animation: slide-up 0.5s ease;
}

.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.card-title {
  font-size: 16px;
  color: #00E5FF;
  margin-bottom: 16px;
  font-weight: 600;
}

.message-section {
  margin-bottom: 24px;
}

.checkin-section {
  padding: 20px 0;
}

.checkin-methods {
  display: flex;
  align-items: stretch;
  gap: 30px;
  margin-bottom: 30px;
}

.checkin-method {
  flex: 1;
  padding: 24px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid #333;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkin-method .method-desc {
  color: #888;
  font-size: 14px;
  margin: 0 0 8px 0;
}

.checkin-method .el-button {
  align-self: flex-start;
}

.divider {
  display: flex;
  align-items: center;
  color: #666;
  font-size: 14px;
}

.manual-input {
  display: flex;
  gap: 10px;
}

.manual-input .el-input {
  flex: 1;
}

.camera-container {
  position: relative;
  width: 100%;
  max-height: 400px;
  overflow: hidden;
  border-radius: 8px;
  background: #000;
}

.camera-video {
  width: 100%;
  display: block;
}

.scan-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scan-box {
  width: 200px;
  height: 200px;
  border: 2px solid #00E5FF;
  border-radius: 8px;
  position: relative;
  animation: scan-pulse 2s ease-in-out infinite;
}

.scan-box::before,
.scan-box::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 3px solid #00E5FF;
}

.scan-box::before {
  top: -3px;
  left: -3px;
  border-right: none;
  border-bottom: none;
}

.scan-box::after {
  bottom: -3px;
  right: -3px;
  border-left: none;
  border-top: none;
}

@keyframes scan-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
}

.scanning-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  color: #00E5FF;
}

.checkin-result {
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 30px;
  text-align: center;
}

.checkin-result.success {
  background: rgba(103, 194, 58, 0.1);
  border: 1px solid rgba(103, 194, 58, 0.3);
}

.checkin-result.error {
  background: rgba(245, 108, 108, 0.1);
  border: 1px solid rgba(245, 108, 108, 0.3);
}

.checkin-result.success .result-icon {
  color: #67C23A;
}

.checkin-result.error .result-icon {
  color: #F56C6C;
}

.result-icon {
  margin-bottom: 12px;
}

.result-message {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #F5F7FA;
}

.result-booking-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  text-align: left;
  max-width: 400px;
  margin: 0 auto;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.info-item .label {
  color: #888;
}

.info-item .value {
  color: #F5F7FA;
  font-weight: 500;
}

.today-checkins {
  margin-top: 30px;
}

@media (max-width: 768px) {
  .checkin-methods {
    flex-direction: column;
  }
  
  .result-booking-info {
    grid-template-columns: 1fr;
  }
}
</style>
