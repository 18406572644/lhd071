<template>
  <div class="coach-preferences">
    <div class="page-header">
      <h2 class="page-title">可预约时段偏好</h2>
      <div class="header-desc">
        设置您的可预约时段偏好，管理员排班时会参考这些设置
      </div>
    </div>

    <div class="skate-card preferences-card">
      <div class="weekday-tabs">
        <div
          v-for="(day, index) in weekdays"
          :key="index"
          class="weekday-tab"
          :class="{ active: selectedDay === index }"
          @click="selectedDay = index"
        >
          {{ day }}
        </div>
      </div>

      <div class="time-slots-section">
        <div class="section-header">
          <h3 class="section-title">{{ weekdays[selectedDay] }} 可预约时段</h3>
          <el-button type="primary" size="small" @click="addTimeSlot">
            <el-icon><Plus /></el-icon>
            添加时段
          </el-button>
        </div>

        <div v-if="currentDaySlots.length === 0" class="empty-state">
          <el-icon :size="48"><Clock /></el-icon>
          <p>暂无设置的时段，点击上方按钮添加</p>
        </div>

        <div v-else class="time-slots-list">
          <div
            v-for="(slot, index) in currentDaySlots"
            :key="index"
            class="time-slot-item"
          >
            <div class="slot-time">
              <el-time-picker
                v-model="slot.start_time"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="开始时间"
                size="small"
              />
              <span class="time-separator">-</span>
              <el-time-picker
                v-model="slot.end_time"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="结束时间"
                size="small"
              />
            </div>
            <div class="slot-status">
              <el-switch
                v-model="slot.is_available"
                active-text="可预约"
                inactive-text="不可约"
              />
            </div>
            <div class="slot-actions">
              <el-button type="danger" circle size="small" @click="removeTimeSlot(index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="quick-setup">
        <h4 class="quick-title">快速设置</h4>
        <div class="quick-buttons">
          <el-button size="small" @click="applyWeekdayTemplate">
            工作日模板 (9:00-18:00)
          </el-button>
          <el-button size="small" @click="applyWeekendTemplate">
            周末模板 (10:00-20:00)
          </el-button>
          <el-button size="small" @click="copyToAllDays">
            复制到所有天
          </el-button>
          <el-button size="small" type="danger" @click="clearAll">
            清空所有
          </el-button>
        </div>
      </div>

      <div class="form-actions">
        <el-button @click="resetPreferences">重置</el-button>
        <el-button type="primary" @click="savePreferences" :loading="saving">
          保存设置
        </el-button>
      </div>
    </div>

    <div class="skate-card info-card">
      <h4 class="info-title">
        <el-icon><InfoFilled /></el-icon>
        说明
      </h4>
      <ul class="info-list">
        <li>设置的时段仅作为管理员排班的参考，最终排班以管理员实际安排为准</li>
        <li>如有特殊情况需要调整，请提前与管理员沟通</li>
        <li>建议每周日更新下一周的时段偏好设置</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '../../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Clock, Delete, InfoFilled } from '@element-plus/icons-vue'

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const selectedDay = ref(1)
const saving = ref(false)

const preferences = reactive({})

const currentDaySlots = computed({
  get: () => preferences[selectedDay.value] || [],
  set: (val) => {
    preferences[selectedDay.value] = val
  }
})

async function loadPreferences() {
  try {
    const { data } = await api.get('/coach/preferences')
    const prefs = data.preferences || []
    for (let i = 0; i < 7; i++) {
      preferences[i] = prefs
        .filter(p => p.day_of_week === i)
        .map(p => ({
          start_time: p.start_time,
          end_time: p.end_time,
          is_available: p.is_available === 1
        }))
    }
    for (let i = 0; i < 7; i++) {
      if (!preferences[i]) {
        preferences[i] = []
      }
    }
  } catch {
    for (let i = 0; i < 7; i++) {
      preferences[i] = []
    }
  }
}

function addTimeSlot() {
  if (!preferences[selectedDay.value]) {
    preferences[selectedDay.value] = []
  }
  preferences[selectedDay.value].push({
    start_time: '09:00',
    end_time: '10:00',
    is_available: true
  })
}

function removeTimeSlot(index) {
  preferences[selectedDay.value].splice(index, 1)
}

function applyWeekdayTemplate() {
  const template = [
    { start_time: '09:00', end_time: '12:00', is_available: true },
    { start_time: '13:00', end_time: '18:00', is_available: true }
  ]
  for (let i = 1; i <= 5; i++) {
    preferences[i] = JSON.parse(JSON.stringify(template))
  }
  ElMessage.success('已应用工作日模板到周一至周五')
}

function applyWeekendTemplate() {
  const template = [
    { start_time: '10:00', end_time: '12:00', is_available: true },
    { start_time: '13:00', end_time: '20:00', is_available: true }
  ]
  preferences[0] = JSON.parse(JSON.stringify(template))
  preferences[6] = JSON.parse(JSON.stringify(template))
  ElMessage.success('已应用周末模板到周六和周日')
}

function copyToAllDays() {
  const currentSlots = JSON.parse(JSON.stringify(preferences[selectedDay.value]))
  for (let i = 0; i < 7; i++) {
    preferences[i] = JSON.parse(JSON.stringify(currentSlots))
  }
  ElMessage.success(`已将${weekdays[selectedDay.value]}的设置复制到所有天`)
}

async function clearAll() {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有时段设置吗？',
      '确认清空',
      { type: 'warning' }
    )
    for (let i = 0; i < 7; i++) {
      preferences[i] = []
    }
    ElMessage.success('已清空所有设置')
  } catch {}
}

async function savePreferences() {
  saving.value = true
  try {
    const allPrefs = []
    for (let day = 0; day < 7; day++) {
      const slots = preferences[day] || []
      for (const slot of slots) {
        if (slot.start_time && slot.end_time) {
          allPrefs.push({
            day_of_week: day,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_available: slot.is_available ? 1 : 0
          })
        }
      }
    }
    await api.put('/coach/preferences', { preferences: allPrefs })
    ElMessage.success('保存成功')
  } catch {
  } finally {
    saving.value = false
  }
}

function resetPreferences() {
  loadPreferences()
}

onMounted(() => {
  loadPreferences()
})
</script>

<style scoped>
.coach-preferences {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: slide-up 0.5s ease;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #F5F7FA;
  margin: 0;
}

.header-desc {
  font-size: 14px;
  color: #888;
}

.preferences-card {
  padding: 24px;
}

.weekday-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.weekday-tab {
  padding: 10px 20px;
  background: #2C2C2C;
  border: 1px solid #333;
  border-radius: 6px;
  color: #888;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  font-size: 14px;
}

.weekday-tab:hover {
  border-color: #00E5FF;
  color: #00E5FF;
}

.weekday-tab.active {
  background: rgba(0, 229, 255, 0.15);
  border-color: #00E5FF;
  color: #00E5FF;
  font-weight: 600;
}

.time-slots-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  color: #00E5FF;
  margin: 0;
  font-weight: 600;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #666;
  background: #2C2C2C;
  border-radius: 8px;
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

.time-slots-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.time-slot-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #2C2C2C;
  border-radius: 8px;
  border: 1px solid #333;
}

.slot-time {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.time-separator {
  color: #888;
}

.slot-status {
  min-width: 120px;
}

.slot-actions {
  display: flex;
  gap: 8px;
}

.quick-setup {
  padding: 20px;
  background: #2C2C2C;
  border-radius: 8px;
  margin-bottom: 24px;
}

.quick-title {
  font-size: 14px;
  color: #888;
  margin: 0 0 12px 0;
  font-weight: 500;
}

.quick-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #333;
}

.info-card {
  padding: 20px;
  background: rgba(0, 229, 255, 0.05);
  border: 1px solid rgba(0, 229, 255, 0.2);
}

.info-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  color: #00E5FF;
  margin: 0 0 12px 0;
  font-weight: 600;
}

.info-list {
  margin: 0;
  padding-left: 20px;
  color: #888;
  font-size: 14px;
}

.info-list li {
  margin-bottom: 6px;
}

@media (max-width: 768px) {
  .time-slot-item {
    flex-direction: column;
    align-items: stretch;
  }
  .slot-status {
    display: flex;
    justify-content: center;
  }
  .slot-actions {
    justify-content: flex-end;
  }
}
</style>
