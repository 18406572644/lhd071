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
          <h3 class="section-label">选择时段</h3>
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
              :class="{ 'slot-card--selected': selectedSlot?.id === slot.id, 'slot-card--disabled': slot.remaining <= 0 }"
              @click="slot.remaining > 0 && (selectedSlot = slot)"
            >
              <div class="slot-time">{{ slot.start_time }} - {{ slot.end_time }}</div>
              <div class="slot-info">
                <span class="slot-price">¥{{ slot.price }}</span>
                <span class="slot-remaining">余{{ slot.remaining }}</span>
              </div>
            </div>
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
              <span class="summary-value">{{ selectedSlot ? `${selectedSlot.start_time} - ${selectedSlot.end_time}` : '未选择' }}</span>
            </div>
            <div v-if="selectedSlot" class="summary-row summary-row--price">
              <span class="summary-label">价格</span>
              <span class="summary-value glow-text">¥{{ selectedSlot.price }}</span>
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
import { Loading } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const router = useRouter()

const selectedDate = ref('')
const sessionType = ref('casual')
const selectedCoach = ref(null)
const selectedSlot = ref(null)
const slots = ref([])
const coaches = ref([])
const slotsLoading = ref(false)
const submitting = ref(false)

const canSubmit = computed(() => {
  if (!selectedDate.value || !selectedSlot.value) return false
  if (sessionType.value === 'private' && !selectedCoach.value) return false
  return true
})

function disableDate(date) {
  return dayjs(date).isBefore(dayjs(), 'day')
}

watch(selectedDate, async (val) => {
  selectedSlot.value = null
  if (!val) {
    slots.value = []
    return
  }
  const day = dayjs(val).day()
  const type = (day === 0 || day === 6) ? 'weekend' : 'weekday'
  slotsLoading.value = true
  try {
    const { data } = await api.get('/slots', { params: { type } })
    const allSlots = data.slots || []
    const targetType = sessionType.value === 'private' ? 'private' : 'open'
    slots.value = allSlots.filter(s => s.session_type === targetType).map(s => ({
      ...s,
      remaining: s.capacity
    }))
  } catch {
    slots.value = []
  } finally {
    slotsLoading.value = false
  }
})

watch(sessionType, () => {
  selectedSlot.value = null
  if (sessionType.value === 'private' && coaches.value.length === 0) {
    fetchCoaches()
  }
  if (selectedDate.value) {
    const day = dayjs(selectedDate.value).day()
    const type = (day === 0 || day === 6) ? 'weekend' : 'weekday'
    const targetType = sessionType.value === 'private' ? 'private' : 'open'
    api.get('/slots', { params: { type } }).then(res => {
      const allSlots = res.data.slots || []
      slots.value = allSlots.filter(s => s.session_type === targetType).map(s => ({
        ...s,
        remaining: s.capacity
      }))
    }).catch(() => {
      slots.value = []
    })
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
    router.push('/my-bookings')
  } catch {
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

.section-label {
  font-size: 16px;
  color: #00E5FF;
  margin-bottom: 12px;
  font-weight: 600;
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
}

.slot-card:hover:not(.slot-card--disabled) {
  border-color: rgba(0, 229, 255, 0.4);
}

.slot-card--selected {
  border-color: #00E5FF !important;
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.3);
}

.slot-card--disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
