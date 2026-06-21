<template>
  <div class="student-detail">
    <div class="page-header">
      <el-button @click="goBack" :icon="ArrowLeft">返回</el-button>
      <h2 class="page-title">学员详情</h2>
    </div>

    <div v-if="student" class="content-wrapper">
      <div class="skate-card profile-card">
        <div class="profile-header">
          <div class="student-avatar">{{ student.username.charAt(0) }}</div>
          <div class="profile-info">
            <h3 class="student-name">{{ student.username }}</h3>
            <div class="student-phone">
              <el-icon :size="16"><Phone /></el-icon>
              {{ student.phone || '未提供' }}
            </div>
            <div class="student-join-date">
              <el-icon :size="16"><Calendar /></el-icon>
              注册时间：{{ student.created_at }}
            </div>
          </div>
          <div class="profile-stats">
            <div class="stat-item">
              <div class="stat-value">{{ student.total_lessons || 0 }}</div>
              <div class="stat-label">累计课时</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ student.last_lesson_date || '暂无' }}</div>
              <div class="stat-label">最近上课</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ avgRating }}</div>
              <div class="stat-label">平均评分</div>
            </div>
          </div>
        </div>

        <div class="note-section">
          <div class="section-header">
            <h4 class="section-title">学员备注</h4>
            <el-button type="primary" size="small" @click="saveNote" :loading="savingNote">
              保存备注
            </el-button>
          </div>
          <el-input
            v-model="noteContent"
            type="textarea"
            :rows="4"
            placeholder="记录该学员的学习情况、特点、注意事项等..."
          />
        </div>
      </div>

      <div class="skate-card lessons-card">
        <h3 class="card-title">历史上课记录</h3>
        <el-table
          :data="lessons"
          :style="darkTableStyle"
          v-loading="loading"
        >
          <el-table-column prop="booking_date" label="日期" min-width="120" />
          <el-table-column label="时间" min-width="120">
            <template #default="{ row }">
              {{ row.start_time }} - {{ row.end_time }}
            </template>
          </el-table-column>
          <el-table-column label="类型" min-width="100">
            <template #default="{ row }">
              {{ row.session_type === 'private' ? '私教课' : '团体课' }}
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" min-width="100">
            <template #default="{ row }">
              ¥{{ row.amount }}
            </template>
          </el-table-column>
          <el-table-column label="状态" min-width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="学员评价" min-width="200">
            <template #default="{ row }">
              <div v-if="row.rating" class="review-cell">
                <el-rate v-model="row.rating" disabled size="small" />
                <span v-if="row.review" class="review-text">{{ row.review }}</span>
              </div>
              <span v-else class="no-review">暂无评价</span>
            </template>
          </el-table-column>
          <el-table-column prop="coach_note" label="我的备注" min-width="150" show-overflow-tooltip />
        </el-table>

        <div v-if="lessons.length === 0 && !loading" class="empty-state">
          <el-icon :size="48"><Calendar /></el-icon>
          <p>暂无上课记录</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../api'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Phone, Calendar } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const student = ref(null)
const lessons = ref([])
const noteContent = ref('')
const loading = ref(false)
const savingNote = ref(false)

const darkTableStyle = {
  '--el-table-bg-color': '#2C2C2C',
  '--el-table-tr-bg-color': '#2C2C2C',
  '--el-table-header-bg-color': '#3A3A3A',
  '--el-table-row-hover-bg-color': '#363636',
  '--el-table-border-color': '#444',
  '--el-table-text-color': '#F5F7FA',
  '--el-table-header-text-color': '#00E5FF',
}

const avgRating = computed(() => {
  if (!student.value || !student.value.avg_rating) return '暂无'
  return student.value.avg_rating.toFixed(1)
})

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

async function loadStudentDetail() {
  loading.value = true
  try {
    const { data } = await api.get(`/coach/students/${route.params.id}`)
    student.value = data.student
    lessons.value = data.lessons || []
    noteContent.value = data.note || ''
  } catch {
  } finally {
    loading.value = false
  }
}

async function saveNote() {
  savingNote.value = true
  try {
    await api.put(`/coach/students/${route.params.id}/note`, {
      note: noteContent.value
    })
    ElMessage.success('备注保存成功')
  } catch {
  } finally {
    savingNote.value = false
  }
}

function goBack() {
  router.back()
}

onMounted(() => {
  loadStudentDetail()
})
</script>

<style scoped>
.student-detail {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: slide-up 0.5s ease;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #F5F7FA;
  margin: 0;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-card {
  padding: 24px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #333;
  margin-bottom: 24px;
}

.student-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00E5FF, #0099CC);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 32px;
}

.profile-info {
  flex: 1;
}

.student-name {
  font-size: 24px;
  font-weight: 700;
  color: #F5F7FA;
  margin: 0 0 8px 0;
}

.student-phone,
.student-join-date {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #888;
  font-size: 14px;
  margin-bottom: 4px;
}

.profile-stats {
  display: flex;
  gap: 32px;
}

.stat-item {
  text-align: center;
}

.stat-item .stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #00E5FF;
  margin-bottom: 4px;
}

.stat-item .stat-label {
  font-size: 12px;
  color: #888;
}

.note-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 16px;
  color: #00E5FF;
  margin: 0;
  font-weight: 600;
}

.lessons-card {
  padding: 20px;
}

.card-title {
  font-size: 16px;
  color: #00E5FF;
  margin-bottom: 16px;
  font-weight: 600;
}

.review-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-text {
  font-size: 12px;
  color: #aaa;
}

.no-review {
  color: #666;
  font-size: 13px;
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
</style>
