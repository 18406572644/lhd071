<template>
  <div class="coach-students">
    <div class="page-header">
      <h2 class="page-title">学员管理</h2>
      <div class="header-actions">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索学员姓名或手机号"
          clearable
          style="width: 250px"
          :prefix-icon="Search"
        />
      </div>
    </div>

    <div class="skate-card">
      <el-table
        :data="filteredStudents"
        :style="darkTableStyle"
        v-loading="loading"
      >
        <el-table-column prop="username" label="学员姓名" min-width="120">
          <template #default="{ row }">
            <div class="student-name-cell">
              <div class="student-avatar">{{ row.username.charAt(0) }}</div>
              <span>{{ row.username }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="联系电话" min-width="140">
          <template #default="{ row }">
            <div class="phone-cell">
              <el-icon :size="14"><Phone /></el-icon>
              {{ row.phone || '未提供' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="total_lessons" label="累计课时" min-width="100" align="center" />
        <el-table-column prop="last_lesson_date" label="最近上课" min-width="140" align="center">
          <template #default="{ row }">
            {{ row.last_lesson_date || '暂无' }}
          </template>
        </el-table-column>
        <el-table-column prop="avg_rating" label="平均评分" min-width="120" align="center">
          <template #default="{ row }">
            <div v-if="row.avg_rating" class="rating-cell">
              <el-rate
                v-model="row.avg_rating"
                disabled
                :max="5"
                size="small"
              />
              <span>{{ row.avg_rating.toFixed(1) }}</span>
            </div>
            <span v-else class="no-rating">暂无评分</span>
          </template>
        </el-table-column>
        <el-table-column prop="note" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" min-width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewStudent(row.id)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="filteredStudents.length === 0 && !loading" class="empty-state">
        <el-icon :size="48"><User /></el-icon>
        <p>暂无学员数据</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api'
import { Search, Phone, User } from '@element-plus/icons-vue'

const router = useRouter()

const students = ref([])
const searchKeyword = ref('')
const loading = ref(false)

const darkTableStyle = {
  '--el-table-bg-color': '#2C2C2C',
  '--el-table-tr-bg-color': '#2C2C2C',
  '--el-table-header-bg-color': '#3A3A3A',
  '--el-table-row-hover-bg-color': '#363636',
  '--el-table-border-color': '#444',
  '--el-table-text-color': '#F5F7FA',
  '--el-table-header-text-color': '#00E5FF',
}

const filteredStudents = computed(() => {
  if (!searchKeyword.value) return students.value
  const keyword = searchKeyword.value.toLowerCase()
  return students.value.filter(s =>
    s.username.toLowerCase().includes(keyword) ||
    (s.phone && s.phone.includes(keyword))
  )
})

async function loadStudents() {
  loading.value = true
  try {
    const { data } = await api.get('/coach/students')
    students.value = data.students || []
  } catch {
  } finally {
    loading.value = false
  }
}

function viewStudent(id) {
  router.push(`/coach/students/${id}`)
}

onMounted(() => {
  loadStudents()
})
</script>

<style scoped>
.coach-students {
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

.student-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.student-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00E5FF, #0099CC);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
}

.phone-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #F5F7FA;
}

.rating-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.rating-cell span {
  font-size: 13px;
  color: #00E5FF;
}

.no-rating {
  color: #666;
  font-size: 13px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #666;
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}
</style>
