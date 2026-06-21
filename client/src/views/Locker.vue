<template>
  <div class="locker-page">
    <h2 class="page-title glow-text">储物柜</h2>

    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>

    <template v-else>
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-dot stat-dot--free"></span>
          <span class="stat-label">空闲</span>
          <span class="stat-value">{{ stats.free }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-dot stat-dot--used"></span>
          <span class="stat-label">使用中</span>
          <span class="stat-value">{{ stats.in_use }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-dot stat-dot--fault"></span>
          <span class="stat-label">故障</span>
          <span class="stat-value">{{ stats.fault }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-dot stat-dot--maint"></span>
          <span class="stat-label">维护中</span>
          <span class="stat-value">{{ stats.maintenance }}</span>
        </div>
      </div>

      <div class="filter-bar">
        <el-radio-group v-model="selectedArea" size="small">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="A">A区</el-radio-button>
          <el-radio-button value="B">B区</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="selectedSize" size="small" style="margin-left: 12px;">
          <el-radio-button value="all">全部尺寸</el-radio-button>
          <el-radio-button value="small">小号</el-radio-button>
          <el-radio-button value="medium">中号</el-radio-button>
          <el-radio-button value="large">大号</el-radio-button>
        </el-radio-group>
      </div>

      <div class="layout-section">
        <template v-for="areaKey in displayAreas" :key="areaKey">
          <div class="area-block">
            <h3 class="area-title">{{ areaKey }}区</h3>
            <div class="locker-grid">
              <template v-for="rowIdx in rowCount(areaKey)" :key="rowIdx">
                <div
                  v-for="colIdx in colCount(areaKey, rowIdx)"
                  :key="rowIdx + '-' + colIdx"
                  class="locker-cell"
                  :class="[
                    'locker-cell--' + getLocker(areaKey, rowIdx - 1, colIdx - 1)?.status,
                    'locker-cell--' + getLocker(areaKey, rowIdx - 1, colIdx - 1)?.size,
                    { 'locker-cell--selected': rentLocker && rentLocker.id === getLocker(areaKey, rowIdx - 1, colIdx - 1)?.id }
                  ]"
                  @click="onLockerClick(getLocker(areaKey, rowIdx - 1, colIdx - 1))"
                >
                  <div class="locker-visual">
                    <svg viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="2" width="36" height="44" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
                      <rect x="6" y="6" width="28" height="20" rx="2" fill="currentColor" opacity="0.1"/>
                      <circle cx="20" cy="35" r="2.5" fill="currentColor" opacity="0.6"/>
                      <line v-if="getLocker(areaKey, rowIdx - 1, colIdx - 1)?.status === 'in_use'" x1="4" y1="4" x2="36" y2="44" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
                    </svg>
                  </div>
                  <span class="locker-number">{{ getLocker(areaKey, rowIdx - 1, colIdx - 1)?.locker_number || '' }}</span>
                  <span class="locker-size-tag">{{ sizeLabel(getLocker(areaKey, rowIdx - 1, colIdx - 1)?.size) }}</span>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>

      <div class="my-rentals-section">
        <h3 class="section-title">我的储物柜</h3>
        <div v-if="myRentals.length === 0" class="empty-hint">暂无租用记录</div>
        <div v-else class="rentals-list">
          <div v-for="rental in myRentals" :key="rental.id" class="skate-card rental-item">
            <div class="rental-main">
              <div class="rental-locker-info">
                <span class="rental-number">{{ rental.locker_number }}</span>
                <el-tag size="small" :type="rental.area === 'A' ? '' : 'warning'">{{ rental.area }}区</el-tag>
                <el-tag size="small" type="info">{{ sizeLabel(rental.size) }}</el-tag>
              </div>
              <div class="rental-detail">
                <span class="rental-type">{{ rental.rental_type === 'temporary' ? '临时租赁' : '长期租赁' }}</span>
                <span class="rental-cycle">{{ cycleLabel(rental.billing_cycle) }}</span>
                <span class="rental-amount">¥{{ rental.amount }}</span>
              </div>
              <div class="rental-time">
                <span>{{ rental.start_time }} ~ {{ rental.end_time }}</span>
              </div>
            </div>
            <div class="rental-actions">
              <el-button size="small" type="primary" @click="handleRenew(rental)">续租</el-button>
              <el-button size="small" type="danger" @click="handleReturn(rental)">退租</el-button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <el-dialog v-model="rentDialogVisible" title="租用储物柜" width="460px">
      <div v-if="rentLocker" class="rent-dialog-body">
        <div class="rent-locker-info">
          <span class="rent-locker-number">{{ rentLocker.locker_number }}</span>
          <el-tag size="small">{{ rentLocker.area }}区</el-tag>
          <el-tag size="small" type="info">{{ sizeLabel(rentLocker.size) }}</el-tag>
        </div>
        <el-form label-width="80px" style="margin-top: 16px;">
          <el-form-item label="租用方式">
            <el-radio-group v-model="rentForm.rental_type" @change="onRentalTypeChange">
              <el-radio value="temporary">临时租赁</el-radio>
              <el-radio value="long_term">长期租赁</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="计费周期">
            <el-select v-model="rentForm.billing_cycle" @change="calcRentAmount">
              <el-option v-if="rentForm.rental_type === 'temporary'" label="按小时" value="hour" />
              <el-option v-if="rentForm.rental_type === 'temporary'" label="按天" value="day" />
              <el-option v-if="rentForm.rental_type === 'long_term'" label="按月" value="month" />
              <el-option v-if="rentForm.rental_type === 'long_term'" label="按季" value="quarter" />
            </el-select>
          </el-form-item>
          <el-form-item label="租金">
            <span class="rent-amount-display">¥{{ rentAmount }} / {{ cycleLabel(rentForm.billing_cycle) }}</span>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="rentDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="renting" @click="handleRent">确认租用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'

const loading = ref(false)
const lockers = ref([])
const layout = ref({})
const stats = ref({ total: 0, free: 0, in_use: 0, fault: 0, maintenance: 0 })
const pricing = ref({})
const myRentals = ref([])
const selectedArea = ref('all')
const selectedSize = ref('all')

const rentDialogVisible = ref(false)
const rentLocker = ref(null)
const rentForm = ref({ rental_type: 'temporary', billing_cycle: 'hour' })
const rentAmount = ref(0)
const renting = ref(false)

const displayAreas = computed(() => {
  if (selectedArea.value === 'all') return ['A', 'B']
  return [selectedArea.value]
})

function sizeLabel(size) {
  if (size === 'small') return '小号'
  if (size === 'medium') return '中号'
  if (size === 'large') return '大号'
  return size
}

function cycleLabel(cycle) {
  if (cycle === 'hour') return '小时'
  if (cycle === 'day') return '天'
  if (cycle === 'month') return '月'
  if (cycle === 'quarter') return '季'
  return cycle
}

function getLocker(area, row, col) {
  if (!layout.value[area] || !layout.value[area][row] || !layout.value[area][row][col]) return null
  var l = layout.value[area][row][col]
  if (selectedSize.value !== 'all' && l.size !== selectedSize.value) return null
  return l
}

function rowCount(area) {
  if (!layout.value[area]) return 0
  return Object.keys(layout.value[area]).length
}

function colCount(area, rowIdx) {
  if (!layout.value[area] || !layout.value[area][rowIdx - 1]) return 0
  return Object.keys(layout.value[area][rowIdx - 1]).length
}

function onLockerClick(locker) {
  if (!locker) return
  if (locker.status !== 'free') {
    ElMessage.info('该储物柜当前不可租用')
    return
  }
  rentLocker.value = locker
  rentForm.value = { rental_type: 'temporary', billing_cycle: 'hour' }
  calcRentAmount()
  rentDialogVisible.value = true
}

function onRentalTypeChange() {
  if (rentForm.value.rental_type === 'temporary') {
    rentForm.value.billing_cycle = 'hour'
  } else {
    rentForm.value.billing_cycle = 'month'
  }
  calcRentAmount()
}

function calcRentAmount() {
  if (!rentLocker.value || !pricing.value[rentLocker.value.size]) {
    rentAmount.value = 0
    return
  }
  rentAmount.value = pricing.value[rentLocker.value.size][rentForm.value.billing_cycle] || 0
}

async function handleRent() {
  if (!rentLocker.value) return
  renting.value = true
  try {
    var { data } = await api.post(`/lockers/${rentLocker.value.id}/rent`, rentForm.value)
    ElMessage.success('租用成功')
    rentDialogVisible.value = false
    if (data.balance !== undefined) {
      var user = JSON.parse(localStorage.getItem('user') || 'null')
      if (user) {
        user.balance = data.balance
        user.points = data.points
        localStorage.setItem('user', JSON.stringify(user))
      }
    }
    fetchLayout()
    fetchMyRentals()
  } catch {} finally {
    renting.value = false
  }
}

async function handleRenew(rental) {
  try {
    await ElMessageBox.confirm('确定续租该储物柜吗？将按当前计费周期续费。', '续租确认', { type: 'info' })
    var { data } = await api.post(`/lockers/rentals/${rental.id}/renew`)
    ElMessage.success('续租成功')
    if (data.balance !== undefined) {
      var user = JSON.parse(localStorage.getItem('user') || 'null')
      if (user) {
        user.balance = data.balance
        user.points = data.points
        localStorage.setItem('user', JSON.stringify(user))
      }
    }
    fetchMyRentals()
  } catch {}
}

async function handleReturn(rental) {
  try {
    await ElMessageBox.confirm('确定退租该储物柜吗？', '退租确认', { type: 'warning' })
    await api.post(`/lockers/rentals/${rental.id}/return`)
    ElMessage.success('退租成功')
    fetchMyRentals()
    fetchLayout()
  } catch {}
}

async function fetchLayout() {
  loading.value = true
  try {
    var { data } = await api.get('/lockers/layout')
    layout.value = data.layout || {}
    stats.value = data.stats || { total: 0, free: 0, in_use: 0, fault: 0, maintenance: 0 }
  } catch {} finally {
    loading.value = false
  }
}

async function fetchPricing() {
  try {
    var { data } = await api.get('/lockers/pricing')
    pricing.value = data.pricing || {}
  } catch {}
}

async function fetchMyRentals() {
  try {
    var { data } = await api.get('/lockers/rentals/mine')
    myRentals.value = data.rentals || []
  } catch {
    myRentals.value = []
  }
}

onMounted(() => {
  fetchLayout()
  fetchPricing()
  fetchMyRentals()
})
</script>

<style scoped>
.locker-page {
  animation: slide-up 0.5s ease;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
  letter-spacing: 2px;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 60px;
  color: #00E5FF;
}

.stats-bar {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  padding: 16px 20px;
  background: #2C2C2C;
  border-radius: 10px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.stat-dot--free { background: #67C23A; }
.stat-dot--used { background: #E6A23C; }
.stat-dot--fault { background: #F56C6C; }
.stat-dot--maint { background: #909399; }

.stat-label {
  color: #999;
  font-size: 13px;
}

.stat-value {
  color: #F5F7FA;
  font-weight: 700;
  font-size: 16px;
}

.filter-bar {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 8px;
}

.layout-section {
  margin-bottom: 40px;
}

.area-block {
  margin-bottom: 32px;
}

.area-title {
  font-size: 18px;
  color: #00E5FF;
  margin-bottom: 16px;
  font-weight: 600;
  letter-spacing: 1px;
}

.locker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.locker-cell {
  background: #2C2C2C;
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  border: 2px solid transparent;
  position: relative;
}

.locker-cell:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.locker-cell--free {
  border-color: #67C23A;
}

.locker-cell--free:hover {
  border-color: #85CE61;
  box-shadow: 0 4px 16px rgba(103, 194, 58, 0.3);
}

.locker-cell--in_use {
  border-color: #E6A23C;
  opacity: 0.7;
  cursor: not-allowed;
}

.locker-cell--fault {
  border-color: #F56C6C;
  opacity: 0.6;
  cursor: not-allowed;
}

.locker-cell--maintenance {
  border-color: #909399;
  opacity: 0.5;
  cursor: not-allowed;
}

.locker-cell--selected {
  border-color: #00E5FF !important;
  box-shadow: 0 0 16px rgba(0, 229, 255, 0.4) !important;
}

.locker-cell--free { color: #67C23A; }
.locker-cell--in_use { color: #E6A23C; }
.locker-cell--fault { color: #F56C6C; }
.locker-cell--maintenance { color: #909399; }

.locker-visual {
  width: 40px;
  height: 48px;
  margin: 0 auto 6px;
}

.locker-visual svg {
  width: 100%;
  height: 100%;
}

.locker-number {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #F5F7FA;
  margin-bottom: 2px;
}

.locker-size-tag {
  display: block;
  font-size: 11px;
  color: #999;
}

.section-title {
  font-size: 20px;
  color: #00E5FF;
  margin-bottom: 16px;
  font-weight: 600;
}

.empty-hint {
  text-align: center;
  padding: 32px;
  color: #888;
}

.rentals-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rental-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.rental-main {
  flex: 1;
  min-width: 0;
}

.rental-locker-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.rental-number {
  font-weight: 700;
  font-size: 18px;
  color: #00E5FF;
}

.rental-detail {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.rental-type {
  color: #F5F7FA;
  font-size: 14px;
}

.rental-cycle {
  color: #999;
  font-size: 13px;
}

.rental-amount {
  color: #E6A23C;
  font-weight: 700;
  font-size: 16px;
}

.rental-time {
  color: #888;
  font-size: 12px;
}

.rental-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.rent-dialog-body {
  padding: 4px 0;
}

.rent-locker-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.rent-locker-number {
  font-size: 20px;
  font-weight: 700;
  color: #2C2C2C;
}

.rent-amount-display {
  font-size: 20px;
  font-weight: 700;
  color: #E6A23C;
}

@media (max-width: 768px) {
  .locker-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .stats-bar {
    flex-wrap: wrap;
    gap: 12px;
  }

  .rental-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
