<template>
  <div class="coach-schedule">
    <div class="page-header">
      <h2 class="page-title">我的课表</h2>
      <div class="header-actions">
        <el-date-picker
          v-model="selectedDate"
          type="month"
          placeholder="选择月份"
          value-format="YYYY-MM"
          @change="loadSchedule"
        />
      </div>
    </div>

    <div class="skate-card calendar-card">
      <div class="calendar-header">
        <el-button @click="prevMonth" :icon="ArrowLeft" circle />
        <h3 class="current-month">{{ currentMonthText }}</h3>
        <el-button @click="nextMonth" :icon="ArrowRight" circle />
      </div>

      <div class="calendar-weekdays">
        <div v-for="day in weekdays" :key="day" class="weekday">{{ day }}</div>
      </div>

      <div class="calendar-grid">
        <div
          v-for="(day, index) in calendarDays"
          :key="index"
          class="calendar-day"
          :class="{
            'other-month': !day.inCurrentMonth,
            'today': day.isToday,
            'has-lessons': day.lessons && day.lessons.length > 0,
            'selected': selectedDayDate === day.date
          }"
          @click="selectDay(day)"
        >
          <div class="day-number">{{ day.day }}</div>
          <div v-if="day.lessons && day.lessons.length > 0" class="day-lessons">
            <div
              v-for="lesson in day.lessons.slice(0, 2)"
              :key="lesson.id"
              class="day-lesson"
              :class="'status-' + lesson.status"
            >
              <span class="lesson-time">{{ lesson.start_time }}</span>
              <span class="lesson-student">{{ lesson.username }}</span>
            </div>
            <div v-if="day.lessons.length > 2" class="more-lessons">
              +{{ day.lessons.length - 2 }} 更多
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedDay" class="skate-card day-detail-card">
      <h3 class="card-title">{{ selectedDay.date }} 课程安排</h3>
      <div v-if="selectedDay.lessons && selectedDay.lessons.length === 0" class="empty-state">
        <el-icon :size="48"><Calendar /></el-icon>
        <p>该日暂无课程安排</p>
      </div>
      <div v-else class="day-lessons-list">
        <div
          v-for="lesson in selectedDay.lessons"
          :key="lesson.id"
          class="lesson-card"
          @click="viewBookingDetail(lesson.id)"
        >
          <div class="lesson-time-block">
            <span class="start-time">{{ lesson.start_time }}</span>
            <span class="end-time">{{ lesson.end_time }}</span>
          </div>
          <div class="lesson-details">
            <div class="lesson-student-name">{{ lesson.username }}</div>
            <div class="lesson-student-phone">
              <el-icon :size="14"><Phone /></el-icon>
              {{ lesson.phone || '未提供' }}
            </div>
            <div class="lesson-type">
              {{ lesson.session_type === 'private' ? '私教课' : '团体课' }}
            </div>
          </div>
          <div class="lesson-actions">
            <el-tag :type="getStatusType(lesson.status)" size="small">
              {{ getStatusText(lesson.status) }}
            </el-tag>
          </div>
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
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api'
import { ElMessage } from 'element-plus'
import { Calendar, Phone, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const selectedDate = ref(dayjs().format('YYYY-MM'))
const selectedDayDate = ref('')
const scheduleData = ref([])
const bookingDetailVisible = ref(false)
const currentBooking = ref(null)
const coachNote = ref('')

const currentMonthText = computed(() => {
  return dayjs(selectedDate.value + '-01').format('YYYY年MM月')
})

const calendarDays = computed(() => {
  const startOfMonth = dayjs(selectedDate.value + '-01')
  const startDay = startOfMonth.day()
  const daysInMonth = startOfMonth.daysInMonth()
  const prevMonthDays = startOfMonth.subtract(1, 'month').daysInMonth()
  
  const days = []
  const today = dayjs().format('YYYY-MM-DD')
  
  for (let i = startDay - 1; i >= 0; i--) {
    const date = startOfMonth.subtract(1, 'month').date(prevMonthDays - i)
    days.push({
      day: prevMonthDays - i,
      date: date.format('YYYY-MM-DD'),
      inCurrentMonth: false,
      isToday: false,
      lessons: getLessonsForDate(date.format('YYYY-MM-DD'))
    })
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const date = startOfMonth.date(i)
    const dateStr = date.format('YYYY-MM-DD')
    days.push({
      day: i,
      date: dateStr,
      inCurrentMonth: true,
      isToday: dateStr === today,
      lessons: getLessonsForDate(dateStr)
    })
  }
  
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const date = startOfMonth.add(1, 'month').date(i)
    days.push({
      day: i,
      date: date.format('YYYY-MM-DD'),
      inCurrentMonth: false,
      isToday: false,
      lessons: getLessonsForDate(date.format('YYYY-MM-DD'))
    })
  }
  
  return days
})

const selectedDay = computed(() => {
  return calendarDays.value.find(d => d.date === selectedDayDate.value)
})

function getLessonsForDate(date) {
  return scheduleData.value.filter(s => s.booking_date === date)
}

function prevMonth() {
  selectedDate.value = dayjs(selectedDate.value + '-01').subtract(1, 'month').format('YYYY-MM')
  loadSchedule()
}

function nextMonth() {
  selectedDate.value = dayjs(selectedDate.value + '-01').add(1, 'month').format('YYYY-MM')
  loadSchedule()
}

function selectDay(day) {
  selectedDayDate.value = day.date
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

async function loadSchedule() {
  try {
    const startDate = dayjs(selectedDate.value + '-01').format('YYYY-MM-DD')
    const endDate = dayjs(selectedDate.value + '-01').endOf('month').format('YYYY-MM-DD')
    const { data } = await api.get('/coach/schedule', {
      params: { start: startDate, end: endDate }
    })
    scheduleData.value = data.schedule || []
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
  selectedDayDate.value = dayjs().format('YYYY-MM-DD')
  loadSchedule()
})
</script>

<style scoped>
.coach-schedule {
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

.calendar-card {
  padding: 24px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.current-month {
  font-size: 18px;
  font-weight: 600;
  color: #00E5FF;
  margin: 0;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  padding: 8px;
  font-weight: 600;
  color: #888;
  font-size: 13px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  min-height: 100px;
  padding: 8px;
  background: #2C2C2C;
  border-radius: 4px;
  border: 1px solid #333;
  cursor: pointer;
  transition: all 0.2s ease;
}

.calendar-day:hover {
  border-color: #00E5FF;
  background: #333;
}

.calendar-day.other-month {
  opacity: 0.4;
}

.calendar-day.today {
  border-color: #00E5FF;
  background: rgba(0, 229, 255, 0.1);
}

.calendar-day.selected {
  border-color: #00E5FF;
  background: rgba(0, 229, 255, 0.2);
}

.day-number {
  font-size: 14px;
  font-weight: 600;
  color: #F5F7FA;
  margin-bottom: 4px;
}

.day-lessons {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.day-lesson {
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 2px;
  background: #3A3A3A;
  display: flex;
  justify-content: space-between;
  align-items: center;
  overflow: hidden;
}

.day-lesson.status-paid {
  background: rgba(103, 194, 58, 0.2);
  border-left: 2px solid #67C23A;
}

.day-lesson.status-pending {
  background: rgba(230, 162, 60, 0.2);
  border-left: 2px solid #E6A23C;
}

.day-lesson.status-checked_in {
  background: rgba(64, 158, 255, 0.2);
  border-left: 2px solid #409EFF;
}

.lesson-time {
  color: #00E5FF;
  font-weight: 600;
}

.lesson-student {
  color: #aaa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60px;
}

.more-lessons {
  font-size: 10px;
  color: #888;
  text-align: center;
}

.day-detail-card {
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

.day-lessons-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lesson-card {
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

.lesson-card:hover {
  border-color: #00E5FF;
  background: #333;
}

.lesson-time-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
  padding: 8px 12px;
  background: rgba(0, 229, 255, 0.1);
  border-radius: 6px;
}

.start-time {
  font-size: 18px;
  font-weight: 700;
  color: #00E5FF;
}

.end-time {
  font-size: 12px;
  color: #888;
}

.lesson-details {
  flex: 1;
}

.lesson-student-name {
  font-size: 15px;
  font-weight: 600;
  color: #F5F7FA;
  margin-bottom: 4px;
}

.lesson-student-phone {
  font-size: 13px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.lesson-type {
  font-size: 12px;
  color: #67C23A;
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

@media (max-width: 768px) {
  .calendar-day {
    min-height: 80px;
    padding: 4px;
  }
  .day-lesson {
    font-size: 9px;
  }
  .lesson-student {
    display: none;
  }
}
</style>
