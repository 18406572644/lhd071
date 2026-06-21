<template>
  <div class="admin-dashboard">
    <div class="stats-row">
      <div class="skate-card stat-card">
        <el-icon class="stat-icon" :size="32"><Calendar /></el-icon>
        <div class="stat-info">
          <div class="stat-value">{{ stats.todayBookings }}</div>
          <div class="stat-label">今日预约</div>
        </div>
      </div>
      <div class="skate-card stat-card">
        <el-icon class="stat-icon" :size="32"><Coin /></el-icon>
        <div class="stat-info">
          <div class="stat-value">¥{{ stats.todayRevenue }}</div>
          <div class="stat-label">今日营收</div>
        </div>
      </div>
      <div class="skate-card stat-card">
        <el-icon class="stat-icon" :size="32"><User /></el-icon>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalMembers }}</div>
          <div class="stat-label">会员总数</div>
        </div>
      </div>
      <div class="skate-card stat-card">
        <el-icon class="stat-icon" :size="32"><DataAnalysis /></el-icon>
        <div class="stat-info">
          <div class="stat-value">{{ stats.occupancyRate }}%</div>
          <div class="stat-label">入场率</div>
        </div>
      </div>
    </div>

    <div class="month-selector">
      <el-date-picker
        v-model="selectedMonth"
        type="month"
        placeholder="选择月份"
        value-format="YYYY-MM"
      />
    </div>

    <div class="charts-row">
      <div class="skate-card chart-card">
        <h3 class="card-title">月度营收</h3>
        <div ref="revenueChartRef" class="chart-container"></div>
      </div>
      <div class="skate-card chart-card">
        <h3 class="card-title">月度客流</h3>
        <div ref="trafficChartRef" class="chart-container"></div>
      </div>
    </div>

    <div class="skate-card">
      <h3 class="card-title">教练课时汇总</h3>
      <el-table :data="coachHours" :style="darkTableStyle">
        <el-table-column prop="name" label="教练姓名" />
        <el-table-column prop="teachingHours" label="课时数" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { api } from '../../api'
import * as echarts from 'echarts'
import { Calendar, Coin, User, DataAnalysis } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const stats = reactive({
  todayBookings: 0,
  todayRevenue: 0,
  totalMembers: 0,
  occupancyRate: 0,
})

const selectedMonth = ref(dayjs().format('YYYY-MM'))
const revenueChartRef = ref(null)
const trafficChartRef = ref(null)
let revenueChart = null
let trafficChart = null

const coachHours = ref([])

const darkTableStyle = {
  '--el-table-bg-color': '#2C2C2C',
  '--el-table-tr-bg-color': '#2C2C2C',
  '--el-table-header-bg-color': '#3A3A3A',
  '--el-table-row-hover-bg-color': '#363636',
  '--el-table-border-color': '#444',
  '--el-table-text-color': '#F5F7FA',
  '--el-table-header-text-color': '#00E5FF',
}

async function loadDashboard() {
  try {
    const { data } = await api.get('/stats/dashboard')
    Object.assign(stats, data)
  } catch {}
}

async function loadMonthlyData() {
  if (!selectedMonth.value) return
  const [year, month] = selectedMonth.value.split('-')
  loadRevenueChart(year, month)
  loadTrafficChart(year, month)
  loadCoachHours(year, month)
}

async function loadRevenueChart(year, month) {
  try {
    const { data } = await api.get('/stats/monthly', { params: { year, month } })
    const dailyStats = data.dailyStats || []
    const dates = dailyStats.map(d => d.date.slice(8))
    const revenues = dailyStats.map(d => d.revenue)
    await nextTick()
    if (!revenueChart && revenueChartRef.value) {
      revenueChart = echarts.init(revenueChartRef.value)
    }
    if (revenueChart) {
      revenueChart.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: dates,
          axisLabel: { color: '#aaa' },
          axisLine: { lineStyle: { color: '#444' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#aaa' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        series: [{
          type: 'bar',
          data: revenues,
          itemStyle: { color: '#00E5FF' },
        }],
        grid: { left: 60, right: 20, top: 20, bottom: 30 },
      })
    }
  } catch {}
}

async function loadTrafficChart(year, month) {
  try {
    const { data } = await api.get('/stats/traffic', { params: { year, month } })
    const dailyTraffic = data.dailyTraffic || []
    const dates = dailyTraffic.map(d => d.date.slice(8))
    const counts = dailyTraffic.map(d => d.checkin_count)
    await nextTick()
    if (!trafficChart && trafficChartRef.value) {
      trafficChart = echarts.init(trafficChartRef.value)
    }
    if (trafficChart) {
      trafficChart.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: dates,
          axisLabel: { color: '#aaa' },
          axisLine: { lineStyle: { color: '#444' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#aaa' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        series: [{
          type: 'line',
          data: counts,
          smooth: true,
          lineStyle: { color: '#00E5FF' },
          itemStyle: { color: '#00E5FF' },
          areaStyle: { color: 'rgba(0,229,255,0.15)' },
        }],
        grid: { left: 60, right: 20, top: 20, bottom: 30 },
      })
    }
  } catch {}
}

async function loadCoachHours(year, month) {
  try {
    const { data: coachesData } = await api.get('/coaches')
    const coaches = coachesData.coaches || []
    const results = await Promise.all(
      coaches.map(async (coach) => {
        try {
          const { data } = await api.get('/stats/coach-hours', {
            params: { coach_id: coach.id, year, month },
          })
          return { name: coach.name, teachingHours: data.teachingHours || 0 }
        } catch {
          return { name: coach.name, teachingHours: 0 }
        }
      })
    )
    coachHours.value = results
  } catch {}
}

watch(selectedMonth, () => {
  loadMonthlyData()
})

onMounted(() => {
  loadDashboard()
  loadMonthlyData()
})

onUnmounted(() => {
  if (revenueChart) {
    revenueChart.dispose()
    revenueChart = null
  }
  if (trafficChart) {
    trafficChart.dispose()
    trafficChart = null
  }
})
</script>

<style scoped>
.admin-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: slide-up 0.5s ease;
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

.month-selector {
  display: flex;
  justify-content: flex-end;
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
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

@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts-row {
    grid-template-columns: 1fr;
  }
}
</style>
