<template>
  <div class="booking-page">
    <div class="booking-layout">
      <div class="booking-left">
        <div class="skate-card booking-section">
          <h3 class="section-label">选择日期</h3>
          <el-date-picker
            v-model="selectedDate"
            type="date"
            placeholder="选择预约日期"
            size="large"
            :disabled-date="disableDate"
            value-format="YYYY-MM-DD"
            class="full-width"
          />
        </div>

        <div class="skate-card booking-section">
          <h3 class="section-label">预约类型</h3>
          <el-radio-group v-model="sessionType" size="large">
            <el-radio-button value="casual">散客场</el-radio-button>
            <el-radio-button value="private">私教课</el-radio-button>
          </el-radio-group>

          <div v-if="sessionType === 'private'" class="coach-select">
            <el-select
              v-model="selectedCoach"
              placeholder="选择教练"
              size="large"
              class="full-width"
            >
              <el-option
                v-for="coach in coaches"
                :key="coach.id"
                :label="coach.name"
                :value="coach.id"
              />
            </el-select>
          </div>
        </div>

        <div class="skate-card booking-section">
          <div class="section-header">
            <h3 class="section-label">选择时段</h3>
            <div class="multi-select-toggle">
              <el-switch
                v-model="multiSelectMode"
                active-text="连续时段"
                inactive-text="单一时段"
                @change="handleMultiSelectChange"
              />
            </div>
          </div>
          <div v-if="multiSelectMode" class="multi-select-hint">
            <el-icon><InfoFilled /></el-icon>
            可选择 2-3 个连续时段合并下单
          </div>
          <div v-if="slotsLoading" class="loading-hint">
            <el-icon class="is-loading"><Loading /></el-icon>
            加载时段中...
          </div>
          <div v-else-if="slots.length === 0 && selectedDate" class="empty-hint">
            暂无可用时段
          </div>
          <div v-else class="slots-grid">
            <div
              v-for="slot in slots"
              :key="slot.id"
              class="slot-card"
              :class="{
                'slot-card--selected': isSlotSelected(slot.id),
                'slot-card--disabled': slot.remaining <= 0,
                'slot-card--full': slot.status === 'full',
                'slot-card--limited': slot.status === 'limited',
                'slot-card--plenty': slot.status === 'plenty'
              }"
              @click="handleSlotClick(slot)"
            >
              <div class="slot-time">{{ slot.start_time }} - {{ slot.end_time }}</div>
              <div class="slot-info">
                <span class="slot-price">¥{{ slot.price }}</span>
                <span class="slot-remaining">余{{ slot.remaining }}</span>
              </div>
              <div class="slot-status-tag" :class="`slot-status-tag--${slot.status}`">
                {{ getStatusText(slot.status) }}
              </div>
            </div>
          </div>
          <div v-if="multiSelectMode && selectedSlots.length > 0" class="selected-info">
            已选 {{ selectedSlots.length }} 个连续时段：
            <span class="selected-time-range">
              {{ selectedSlots[0].start_time }} - {{ selectedSlots[selectedSlots.length - 1].end_time }}
            </span>
          </div>
        </div>
      </div>

      <div class="booking-right">
        <div class="skate-card summary-card">
          <h3 class="summary-title">预约摘要</h3>
          <div class="summary-list">
            <div class="summary-row">
              <span class="summary-label">日期</span>
              <span class="summary-value">{{ selectedDate || '未选择' }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">类型</span>
              <span class="summary-value">{{ sessionType === 'casual' ? '散客场' : '私教课' }}</span>
            </div>
            <div v-if="sessionType === 'private' && selectedCoach" class="summary-row">
              <span class="summary-label">教练</span>
              <span class="summary-value">{{ coaches.find(c => c.id === selectedCoach)?.name }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">时段</span>
              <span class="summary-value">
                {{ displaySlotText }}
              </span>
            </div>
            <div v-if="totalPrice > 0" class="summary-row summary-row--price">
              <span class="summary-label">价格</span>
              <span class="summary-value glow-text">¥{{ totalPrice }}</span>
            </div>
          </div>
          <button
            class="cyber-btn confirm-btn"
            :disabled="!canSubmit || submitting"
            @click="handleSubmit"
          >
            <span>{{ submitting ? '提交中...' : '确认预约' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { ElMessage } from 'element-plus'
import { Loading, InfoFilled } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const router = useRouter()

const selectedDate = ref('')
const sessionType = ref('casual')
const selectedCoach = ref(null)
const selectedSlot = ref(null)
const selectedSlots = ref([])
const slots = ref([])
const coaches = ref([])
const slotsLoading = ref(false)
const submitting = ref(false)
const multiSelectMode = ref(false)

const canSubmit = computed(() => {
  if (!selectedDate.value) return false
  if (multiSelectMode.value) {
    if (selectedSlots.value.length < 2 || selectedSlots.value.length > 3) return false
  } else {
    if (!selectedSlot.value) return false
  }
  if (sessionType.value === 'private' && !selectedCoach.value) return false
  return true
})

const totalPrice = computed(() => {
  if (multiSelectMode.value) {
    return selectedSlots.value.reduce((sum, s) => sum + s.price, 0)
  }
  return selectedSlot.value ? selectedSlot.value.price : 0
})

const displaySlotText = computed(() => {
  if (multiSelectMode.value && selectedSlots.value.length > 0) {
    return `${selectedSlots.value[0].start_time} - ${selectedSlots.value[selectedSlots.value.length - 1].end_time}`
  }
  return selectedSlot.value ? `${selectedSlot.value.start_time} - ${selectedSlot.value.end_time}` : '未选择'
})

function disableDate(date) {
  return dayjs(date).isBefore(dayjs(), 'day')
}

function getStatusText(status) {
  const map = {
    full: '已约满',
    limited: '紧张',
    plenty: '充足'
  }
  return map[status] || ''
}

function isSlotSelected(slotId) {
  if (multiSelectMode.value) {
    return selectedSlots.value.some(s => s.id === slotId)
  }
  return selectedSlot.value?.id === slotId
}

function handleMultiSelectChange(val) {
  selectedSlot.value = null
  selectedSlots.value = []
  if (!val && selectedDate.value) {
    loadSlots()
  }
}

function areSlotsConsecutive(slot1, slot2) {
  return slot1.end_time === slot2.start_time || slot2.end_time === slot1.start_time
}

function handleSlotClick(slot) {
  if (slot.remaining <= 0) return
  
  if (!multiSelectMode.value) {
    selectedSlot.value = slot
    return
  }
  
  const existingIndex = selectedSlots.value.findIndex(s => s.id === slot.id)
  
  if (existingIndex !== -1) {
    selectedSlots.value.splice(existingIndex, 1)
    return
  }
  
  if (selectedSlots.value.length >= 3) {
    ElMessage.warning('最多只能选择 3 个连续时段')
    return
  }
  
  if (selectedSlots.value.length === 0) {
    selectedSlots.value.push(slot)
    return
  }
  
  const sortedSlots = [...selectedSlots.value, slot].sort((a, b) => a.start_time.localeCompare(b.start_time))
  
  for (let i = 0; i < sortedSlots.length - 1; i++) {
    if (sortedSlots[i].end_time !== sortedSlots[i + 1].start_time) {
      ElMessage.warning('请选择连续的时段')
      return
    }
  }
  
  selectedSlots.value = sortedSlots
}

async function loadSlots() {
  if (!selectedDate.value) {
    slots.value = []
    return
  }
  
  const day = dayjs(selectedDate.value).day()
  const type = (day === 0 || day === 6) ? 'weekend' : 'weekday'
  const targetType = sessionType.value === 'private' ? 'private' : 'open'
  
  slotsLoading.value = true
  try {
    const { data } = await api.get('/slots', { 
      params: { 
        type, 
        date: selectedDate.value,
        session_type: targetType
      } 
    })
    slots.value = data.slots || []
  } catch {
    slots.value = []
  } finally {
    slotsLoading.value = false
  }
}

watch(selectedDate, () => {
  selectedSlot.value = null
  selectedSlots.value = []
  loadSlots()
})

watch(sessionType, () => {
  selectedSlot.value = null
  selectedSlots.value = []
  if (sessionType.value === 'private' && coaches.value.length === 0) {
    fetchCoaches()
  }
  if (selectedDate.value) {
    loadSlots()
  }
})

async function fetchCoaches() {
  try {
    const { data } = await api.get('/coaches')
    coaches.value = data.coaches || []
  } catch {
    coaches.value = []
  }
}

async function handleSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    if (multiSelectMode.value) {
      const payload = {
        slot_ids: selectedSlots.value.map(s => s.id),
        booking_date: selectedDate.value,
        type: sessionType.value === 'private' ? 'private' : 'venue',
      }
      if (sessionType.value === 'private') {
        payload.coach_id = selectedCoach.value
      }
      await api.post('/bookings/batch', payload)
      ElMessage.success('批量预约成功，请前往支付')
    } else {
      const payload = {
        slot_id: selectedSlot.value.id,
        booking_date: selectedDate.value,
        type: sessionType.value === 'private' ? 'private' : 'venue',
      }
      if (sessionType.value === 'private') {
        payload.coach_id = selectedCoach.value
      }
      await api.post('/bookings', payload)
      ElMessage.success('预约成功，请前往支付')
    }
    router.push('/my-bookings')
  } catch (err) {
    const conflictInfo = err.response?.data?.conflict_info
    if (conflictInfo) {
      ElMessage.error(conflictInfo.message || '时段冲突')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.booking-page {
  animation: slide-up 0.5s ease;
}

.booking-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.booking-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.booking-right {
  width: 320px;
  flex-shrink: 0;
  position: sticky;
  top: 84px;
}

.booking-section {
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-label {
  font-size: 16px;
  color: #00E5FF;
  margin-bottom: 0;
  font-weight: 600;
}

.multi-select-toggle :deep(.el-switch__label) {
  color: #888;
  font-size: 12px;
}

.multi-select-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(0, 229, 255, 0.1);
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #00E5FF;
}

.selected-info {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(0, 229, 255, 0.08);
  border-radius: 6px;
  font-size: 13px;
  color: #ccc;
}

.selected-time-range {
  color: #00E5FF;
  font-weight: 600;
  margin-left: 4px;
}

.full-width {
  width: 100%;
}

.coach-select {
  margin-top: 12px;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.slot-card {
  background: #3A3A3A;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  position: relative;
  padding-bottom: 28px;
}

.slot-card:hover:not(.slot-card--disabled) {
  border-color: rgba(0, 229, 255, 0.4);
  transform: translateY(-2px);
}

.slot-card--selected {
  border-color: #00E5FF !important;
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.3);
}

.slot-card--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.slot-card--full {
  background: #3d2c2c;
}

.slot-card--limited {
  background: #3d382c;
}

.slot-card--plenty {
  background: #2c3d32;
}

.slot-time {
  font-size: 14px;
  font-weight: 600;
  color: #F5F7FA;
  margin-bottom: 8px;
}

.slot-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slot-price {
  color: #00E5FF;
  font-weight: 700;
  font-size: 16px;
}

.slot-remaining {
  font-size: 12px;
  color: #888;
}

.slot-status-tag {
  position: absolute;
  bottom: 6px;
  right: 8px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.slot-status-tag--full {
  background: #ff4d4f;
  color: #fff;
}

.slot-status-tag--limited {
  background: #faad14;
  color: #fff;
}

.slot-status-tag--plenty {
  background: #52c41a;
  color: #fff;
}

.loading-hint,
.empty-hint {
  text-align: center;
  padding: 24px;
  color: #888;
}

.summary-card {
  padding: 24px;
}

.summary-title {
  font-size: 18px;
  color: #F5F7FA;
  margin-bottom: 20px;
  font-weight: 700;
}

.summary-list {
  margin-bottom: 24px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #3A3A3A;
  font-size: 14px;
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row--price {
  padding-top: 16px;
  margin-top: 8px;
  border-top: 1px solid #3A3A3A;
  border-bottom: none;
}

.summary-label {
  color: #888;
}

.summary-value {
  color: #F5F7FA;
  font-weight: 500;
}

.confirm-btn {
  width: 100%;
  padding: 12px;
  font-size: 16px;
}

.confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .booking-layout {
    flex-direction: column;
  }

  .booking-right {
    width: 100%;
    position: static;
  }
}
</style>
