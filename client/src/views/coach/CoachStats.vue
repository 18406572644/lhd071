<template>
  <div class="coach-stats">
    <div class="page-header">
      <h2 class="page-title">课时统计</h2>
      <div class="header-actions">
        <el-date-picker
          v-model="selectedMonth"
          type="month"
          placeholder="选择月份"
          value-format="YYYY-MM"
          @change="loadStats"
        />
      </div>
    </div>

    <div class="stats-row">
      <div class="skate-card stat-card">
        <el-icon class="stat-icon" :size="32"><Timer /></el-icon>
        <div class="stat-info">
          <div class="stat-value">{{ stats.monthHours }}</div>
          <div class="stat-label">本月课时</div>
        </div>
      </div>
      <div class="skate-card stat-card">
        <el-icon class="stat-icon" :size="32"><DataLine /></el-icon>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalHours }}</div>
          <div class="stat-label">累计课时</div>
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
        <el-icon class="stat-icon" :size="32"><Wallet /></el-icon>
        <div class="stat-info">
          <div class="stat-value">¥{{ stats.totalEarnings }}</div>
          <div class="stat-label">累计收入</div>
        </div>
      </div>
    </div>

    <div class="skate-card chart-card">
      <h3 class="card-title">本月收入趋势</h3>
      <div ref="chartRef" class="chart-container"></div>
    </div>

    <div class="content-row">
      <div class="skate-card upcoming-card">
        <h3 class="card-title">即将到来的课程</h3>
        <div v-if="upcomingLessons.length === 0" class="empty-state">
          <el-icon :size="36"><Calendar /></el-icon>
          <p>暂无即将到来的课程</p>
        </div>
        <div v-else class="upcoming-list">
          <div v-for="lesson in upcomingLessons" :key="lesson.id" class="upcoming-item">
            <div class="lesson-date">{{ lesson.booking_date }}</div>
            <div class="lesson-time">{{ lesson.start_time }} - {{ lesson.end_time }}</div>
            <div class="lesson-student">{{ lesson.username }}</div>
          </div>
        </div>
      </div>

      <div class="skate-card recent-card">
        <h3 class="card-title">近期学员</h3>
        <div v-if="recentStudents.length === 0" class="empty-state">
          <el-icon :size="36"><User /></el-icon>
          <p>暂无学员数据</p>
        </div>
        <div v-else class="recent-list">
          <div v-for="student in recentStudents" :key="student.id" class="recent-item">
            <div class="student-avatar">{{ student.username.charAt(0) }}</div>
            <div class="student-info">
              <div class="student-name">{{ student.username }}</div>
              <div class="last-lesson">上次上课：{{ student.last_lesson }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { api } from '../../api'
import * as echarts from 'echarts'
import { Timer, DataLine, Coin, Wallet, Calendar, User } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const selectedMonth = ref(dayjs().format('YYYY-MM'))
const chartRef = ref(null)
let chart = null

const stats = reactive({
  monthHours: 0,
  totalHours: 0,
  monthEarnings: 0,
  totalEarnings: 0,
})

const upcomingLessons = ref([])
const recentStudents = ref([])
const dailyStats = ref([])

async function loadStats() {
  try {
    const { data } = await api.get('/coach/stats')
    Object.assign(stats, data.stats)
    dailyStats.value = data.dailyStats || []
    upcomingLessons.value = data.upcomingLessons || []
    recentStudents.value = data.recentStudents || []
    loadChart()
  } catch {}
}

async function loadChart() {
  await nextTick()
  if (!chart && chartRef.value) {
    chart = echarts.init(chartRef.value)
  }
  if (chart) {
    const dates = dailyStats.value.map(d => d.date.slice(8))
    const earnings = dailyStats.value.map(d => d.earnings)
    const lessonCounts = dailyStats.value.map(d => d.lesson_count)

    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['收入', '课时数'],
        textStyle: { color: '#aaa' },
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: '#aaa' },
        axisLine: { lineStyle: { color: '#444' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '收入(元)',
          axisLabel: { color: '#aaa' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        {
          type: 'value',
          name: '课时数',
          axisLabel: { color: '#aaa' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '收入',
          type: 'bar',
          data: earnings,
          itemStyle: { color: '#00E5FF' },
          yAxisIndex: 0,
        },
        {
          name: '课时数',
          type: 'line',
          data: lessonCounts,
          smooth: true,
          lineStyle: { color: '#67C23A' },
          itemStyle: { color: '#67C23A' },
          areaStyle: { color: 'rgba(103, 194, 58, 0.15)' },
          yAxisIndex: 1,
        },
      ],
      grid: { left: 70, right: 70, top: 40, bottom: 30 },
    })
  }
}

watch(selectedMonth, () => {
  loadStats()
})

onMounted(() => {
  loadStats()
})

onUnmounted(() => {
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<style scoped>
.coach-stats {
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

.chart-card {
  padding: 20px;
}

.card-title {
  font-size: 16px;
  color: #00E5FF;
  margin-bottom: 16px;
  font-weight: 600;
}

.chart-container {
  height: 400px;
  width: 100%;
}

.content-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.upcoming-card,
.recent-card {
  padding: 20px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  color: #666;
}

.empty-state p {
  margin-top: 8px;
  font-size: 14px;
}

.upcoming-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upcoming-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #2C2C2C;
  border-radius: 6px;
  border: 1px solid #333;
}

.lesson-date {
  font-size: 13px;
  color: #888;
  min-width: 100px;
}

.lesson-time {
  font-size: 14px;
  font-weight: 600;
  color: #00E5FF;
  min-width: 120px;
}

.lesson-student {
  font-size: 14px;
  color: #F5F7FA;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #2C2C2C;
  border-radius: 6px;
  border: 1px solid #333;
}

.student-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00E5FF, #0099CC);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 16px;
}

.student-info {
  flex: 1;
}

.student-name {
  font-size: 14px;
  font-weight: 600;
  color: #F5F7FA;
  margin-bottom: 2px;
}

.last-lesson {
  font-size: 12px;
  color: #888;
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
