<template>
  <div class="my-bookings-page">
    <h2 class="page-title glow-text">我的预约</h2>

    <el-tabs v-model="activeTab" class="booking-tabs">
      <el-tab-pane label="全部" name="all" />
      <el-tab-pane label="待支付" name="pending" />
      <el-tab-pane label="已支付" name="paid" />
      <el-tab-pane label="已签到" name="checked_in" />
      <el-tab-pane label="已取消" name="cancelled" />
    </el-tabs>

    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>

    <div v-else-if="filteredBookings.length === 0" class="empty-state">
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" class="empty-svg">
        <rect x="30" y="60" width="60" height="10" rx="5" fill="#3A3A3A" stroke="#00E5FF" stroke-width="1" opacity="0.5"/>
        <circle cx="40" cy="75" r="6" fill="none" stroke="#00E5FF" stroke-width="1" opacity="0.5"/>
        <circle cx="80" cy="75" r="6" fill="none" stroke="#00E5FF" stroke-width="1" opacity="0.5"/>
        <path d="M30 55 Q60 40 90 55" fill="none" stroke="#00E5FF" stroke-width="1.5" opacity="0.3"/>
      </svg>
      <p>暂无预约记录</p>
    </div>

    <div v-else class="bookings-list">
      <div v-for="booking in filteredBookings" :key="booking.id" class="skate-card booking-item">
        <div class="booking-main">
          <div class="booking-info">
            <div class="booking-date">{{ booking.booking_date }}</div>
            <div class="booking-time">{{ booking.start_time }} - {{ booking.end_time }}</div>
          </div>
          <div class="booking-meta">
            <el-tag :type="tagType(booking.status)" size="small">{{ statusLabel(booking.status) }}</el-tag>
            <span class="booking-type">{{ booking.type === 'venue' ? '散客场' : '私教课' }}</span>
            <span v-if="booking.coach_name" class="booking-coach">教练: {{ booking.coach_name }}</span>
          </div>
          <div class="booking-amount glow-text">¥{{ booking.amount }}</div>
        </div>
        <div class="booking-actions">
          <el-button v-if="booking.status === 'pending'" type="primary" size="small" @click="openPayDialog(booking)">支付</el-button>
          <el-button v-if="booking.status === 'paid'" size="small" @click="handleCancel(booking)">取消</el-button>
          <el-button v-if="booking.status === 'paid' && isToday(booking.booking_date)" type="success" size="small" @click="handleCheckin(booking)">签到</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="payDialogVisible" title="确认支付" width="400px">
      <div class="pay-dialog-body">
        <div class="pay-row">
          <span>支付金额</span>
          <span class="glow-text">¥{{ payBooking?.amount }}</span>
        </div>
        <div class="pay-row">
          <span>账户余额</span>
          <span>¥{{ userStore.user?.balance || 0 }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="payDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="paying" @click="handlePay">确认支付</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useUserStore } from '../stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const userStore = useUserStore()

const activeTab = ref('all')
const bookings = ref([])
const loading = ref(false)
const payDialogVisible = ref(false)
const payBooking = ref(null)
const paying = ref(false)

const filteredBookings = computed(() => {
  if (activeTab.value === 'all') return bookings.value
  return bookings.value.filter(b => b.status === activeTab.value)
})

function statusLabel(status) {
  const map = { pending: '待支付', paid: '已支付', checked_in: '已签到', cancelled: '已取消' }
  return map[status] || status
}

function tagType(status) {
  const map = { pending: 'warning', paid: 'success', checked_in: '', cancelled: 'info' }
  return map[status] || ''
}

function isToday(date) {
  return dayjs(date).isSame(dayjs(), 'day')
}

function openPayDialog(booking) {
  payBooking.value = booking
  payDialogVisible.value = true
}

async function handlePay() {
  if (!payBooking.value) return
  paying.value = true
  try {
    await api.post(`/bookings/${payBooking.value.id}/pay`)
    ElMessage.success('支付成功')
    payDialogVisible.value = false
    fetchBookings()
    userStore.fetchProfile()
  } catch {
  } finally {
    paying.value = false
  }
}

async function handleCancel(booking) {
  try {
    await ElMessageBox.confirm('确定取消该预约吗？', '提示', { type: 'warning' })
    await api.put(`/bookings/${booking.id}/cancel`)
    ElMessage.success('已取消')
    fetchBookings()
  } catch {
  }
}

async function handleCheckin(booking) {
  try {
    await api.post('/checkins', { booking_id: booking.id })
    ElMessage.success('签到成功')
    fetchBookings()
  } catch {
  }
}

async function fetchBookings() {
  loading.value = true
  try {
    const { data } = await api.get('/bookings')
    bookings.value = data.bookings || []
  } catch {
    bookings.value = []
  } finally {
    loading.value = false
  }
}

onMounted(fetchBookings)
</script>

<style scoped>
.my-bookings-page {
  animation: slide-up 0.5s ease;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 20px;
  letter-spacing: 2px;
}

.booking-tabs {
  margin-bottom: 20px;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 60px;
  color: #00E5FF;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #888;
}

.empty-svg {
  width: 120px;
  height: 100px;
  margin-bottom: 16px;
}

.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.booking-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.booking-main {
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 1;
  flex-wrap: wrap;
}

.booking-date {
  font-size: 15px;
  font-weight: 600;
  color: #F5F7FA;
}

.booking-time {
  font-size: 13px;
  color: #888;
}

.booking-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.booking-type {
  font-size: 13px;
  color: #ccc;
}

.booking-coach {
  font-size: 13px;
  color: #888;
}

.booking-amount {
  font-size: 20px;
  font-weight: 700;
}

.booking-actions {
  display: flex;
  gap: 8px;
}

.pay-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pay-row {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
}
</style>
