<template>
  <div class="coach-dashboard">
    <div class="coach-header">
      <div class="coach-info">
        <div class="coach-avatar">
          <el-icon :size="40"><User /></el-icon>
        </div>
        <div>
          <h2 class="coach-name">{{ coachInfo.name || '教练' }}</h2>
          <p class="coach-specialty">{{ coachInfo.specialty || '暂无' }}</p>
        </div>
      </div>
    </div>

    <div class="stats-row">
      <div class="skate-card stat-card">
        <el-icon class="stat-icon" :size="32"><Calendar /></el-icon>
        <div class="stat-info">
          <div class="stat-value">{{ stats.todayLessonsCount }}</div>
          <div class="stat-label">今日课程</div>
        </div>
      </div>
      <div class="skate-card stat-card">
        <el-icon class="stat-icon" :size="32"><Timer /></el-icon>
        <div class="stat-info">
          <div class="stat-value">{{ stats.monthHours }}</div>
          <div class="stat-label">本月课时</div>
        </div>
      </div>
      <div class="skate-card stat-card">
        <el-icon class="stat-icon" :size="32"><Coin /></el-icon>
        <div class="stat-info">
          <div class="stat-value">¥{{ stats.monthEarnings }}</div>
          <div class="stat-label">本月收入</div>
        </div>
      </div>
      <div class="skate-card stat-card">
        <el-icon class="stat-icon" :size="32"><User /></el-icon>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalStudents }}</div>
          <div class="stat-label">学员总数</div>
        </div>
      </div>
    </div>

    <div class="content-row">
      <div class="skate-card lessons-card">
        <h3 class="card-title">今日课程</h3>
        <div v-if="todayLessons.length === 0" class="empty-state">
          <el-icon :size="48"><Calendar /></el-icon>
          <p>今日暂无课程安排</p>
        </div>
        <div v-else class="lessons-list">
          <div 
            v-for="lesson in todayLessons" 
            :key="lesson.id" 
            class="lesson-item"
            @click="viewBookingDetail(lesson.id)"
          >
            <div class="lesson-time">
              <span class="time">{{ lesson.start_time }}</span>
              <span class="duration">{{ lesson.start_time }} - {{ lesson.end_time }}</span>
            </div>
            <div class="lesson-info">
              <div class="student-name">{{ lesson.username }}</div>
              <div class="student-phone">
                <el-icon :size="14"><Phone /></el-icon>
                {{ lesson.phone || '未提供' }}
              </div>
            </div>
            <div class="lesson-status">
              <el-tag :type="getStatusType(lesson.status)" size="small">
                {{ getStatusText(lesson.status) }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>

      <div class="skate-card quick-actions-card">
        <h3 class="card-title">快捷入口</h3>
        <div class="quick-actions">
          <router-link to="/coach/schedule" class="quick-action-item">
            <el-icon :size="28"><Calendar /></el-icon>
            <span>我的课表</span>
          </router-link>
          <router-link to="/coach/students" class="quick-action-item">
            <el-icon :size="28"><User /></el-icon>
            <span>学员管理</span>
          </router-link>
          <router-link to="/coach/stats" class="quick-action-item">
            <el-icon :size="28"><DataAnalysis /></el-icon>
            <span>课时统计</span>
          </router-link>
          <router-link to="/coach/profile" class="quick-action-item">
            <el-icon :size="28"><Setting /></el-icon>
            <span>个人资料</span>
          </router-link>
          <router-link to="/coach/preferences" class="quick-action-item">
            <el-icon :size="28"><Clock /></el-icon>
            <span>时段偏好</span>
          </router-link>
        </div>
      </div>
    </div>

    <el-dialog v-model="bookingDetailVisible" title="预约详情" width="500px">
      <div v-if="currentBooking" class="booking-detail">
        <div class="detail-row">
          <span class="label">学员姓名：</span>
          <span class="value">{{ currentBooking.username }}</span>
        </div>
        <div class="detail-row">
          <span class="label">联系电话：</span>
          <span class="value">{{ currentBooking.phone || '未提供' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">课程日期：</span>
          <span class="value">{{ currentBooking.booking_date }}</span>
        </div>
        <div class="detail-row">
          <span class="label">课程时间：</span>
          <span class="value">{{ currentBooking.start_time }} - {{ currentBooking.end_time }}</span>
        </div>
        <div class="detail-row">
          <span class="label">课程类型：</span>
          <span class="value">{{ currentBooking.session_type === 'private' ? '私教课' : '团体课' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">预约状态：</span>
          <el-tag :type="getStatusType(currentBooking.status)" size="small">
            {{ getStatusText(currentBooking.status) }}
          </el-tag>
        </div>
        <div class="detail-row">
          <span class="label">课程金额：</span>
          <span class="value">¥{{ currentBooking.amount }}</span>
        </div>
        <div class="detail-row note-row">
          <span class="label">学员备注：</span>
          <span class="value">{{ currentBooking.student_note || '暂无' }}</span>
        </div>
        <div class="detail-row coach-note-row">
          <span class="label">我的备注：</span>
          <el-input
            v-model="coachNote"
            type="textarea"
            :rows="3"
            placeholder="记录该学员的学习情况..."
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="bookingDetailVisible = false">关闭</el-button>
        <el-button type="primary" @click="saveCoachNote">保存备注</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api'
import { ElMessage } from 'element-plus'
import { Calendar, Timer, Coin, User, DataAnalysis, Setting, Clock, Phone } from '@element-plus/icons-vue'

const router = useRouter()

const coachInfo = reactive({
  name: '',
  specialty: '',
})

const stats = reactive({
  todayLessonsCount: 0,
  monthHours: 0,
  monthEarnings: 0,
  totalStudents: 0,
})

const todayLessons = ref([])
const bookingDetailVisible = ref(false)
const currentBooking = ref(null)
const coachNote = ref('')

const darkTableStyle = {
  '--el-table-bg-color': '#2C2C2C',
  '--el-table-tr-bg-color': '#2C2C2C',
  '--el-table-header-bg-color': '#3A3A3A',
  '--el-table-row-hover-bg-color': '#363636',
  '--el-table-border-color': '#444',
  '--el-table-text-color': '#F5F7FA',
  '--el-table-header-text-color': '#00E5FF',
}

function getStatusType(status) {
  const typeMap = {
    pending: 'warning',
    paid: 'success',
    checked_in: 'primary',
    cancelled: 'info',
  }
  return typeMap[status] || 'info'
}

function getStatusText(status) {
  const textMap = {
    pending: '待支付',
    paid: '已支付',
    checked_in: '已签到',
    cancelled: '已取消',
  }
  return textMap[status] || status
}

async function loadCoachInfo() {
  try {
    const { data } = await api.get('/coach/me')
    Object.assign(coachInfo, data.coach)
  } catch {}
}

async function loadDashboard() {
  try {
    const { data } = await api.get('/coach/dashboard')
    Object.assign(stats, data.stats)
    todayLessons.value = data.todayLessons || []
  } catch {}
}

async function viewBookingDetail(id) {
  try {
    const { data } = await api.get(`/coach/bookings/${id}`)
    currentBooking.value = data.booking
    coachNote.value = data.booking.coach_note || ''
    bookingDetailVisible.value = true
  } catch {}
}

async function saveCoachNote() {
  if (!currentBooking.value) return
  try {
    await api.put(`/coach/bookings/${currentBooking.value.id}/note`, {
      coach_note: coachNote.value,
    })
    ElMessage.success('备注保存成功')
    bookingDetailVisible.value = false
  } catch {}
}

onMounted(() => {
  loadCoachInfo()
  loadDashboard()
})
</script>

<style scoped>
.coach-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: slide-up 0.5s ease;
}

.coach-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.coach-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.coach-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00E5FF, #0099CC);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.coach-name {
  font-size: 24px;
  font-weight: 700;
  color: #F5F7FA;
  margin: 0 0 4px 0;
}

.coach-specialty {
  font-size: 14px;
  color: #888;
  margin: 0;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.stat-icon {
  color: #00E5FF;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #F5F7FA;
}

.stat-label {
  font-size: 13px;
  color: #888;
  margin-top: 4px;
}

.content-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
}

.lessons-card,
.quick-actions-card {
  padding: 20px;
}

.card-title {
  font-size: 16px;
  color: #00E5FF;
  margin-bottom: 16px;
  font-weight: 600;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #666;
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

.lessons-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lesson-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #2C2C2C;
  border-radius: 8px;
  border: 1px solid #333;
  cursor: pointer;
  transition: all 0.3s ease;
}

.lesson-item:hover {
  border-color: #00E5FF;
  background: #333;
}

.lesson-time {
  display: flex;
  flex-direction: column;
  min-width: 120px;
}

.lesson-time .time {
  font-size: 18px;
  font-weight: 700;
  color: #00E5FF;
}

.lesson-time .duration {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}

.lesson-info {
  flex: 1;
}

.student-name {
  font-size: 15px;
  font-weight: 600;
  color: #F5F7FA;
  margin-bottom: 4px;
}

.student-phone {
  font-size: 13px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.quick-action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 12px;
  background: #2C2C2C;
  border-radius: 8px;
  border: 1px solid #333;
  color: #F5F7FA;
  text-decoration: none;
  font-size: 13px;
  transition: all 0.3s ease;
}

.quick-action-item:hover {
  border-color: #00E5FF;
  background: #333;
  color: #00E5FF;
}

.quick-action-item .el-icon {
  color: #00E5FF;
}

.booking-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.detail-row .label {
  min-width: 100px;
  color: #888;
  font-size: 14px;
  padding-top: 4px;
}

.detail-row .value {
  flex: 1;
  color: #F5F7FA;
  font-size: 14px;
}

.note-row .value {
  color: #aaa;
}

.coach-note-row {
  flex-direction: column;
}

.coach-note-row .label {
  margin-bottom: 8px;
}

@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .content-row {
    grid-template-columns: 1fr;
  }
}
</style>
