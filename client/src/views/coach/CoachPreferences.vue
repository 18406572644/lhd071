<template>
  <div class="coach-preferences">
    <div class="page-header">
      <h2 class="page-title">可预约时段偏好</h2>
      <div class="header-desc">
        设置您的可预约时段偏好，系统将自动生成排班
      </div>
    </div>

    <el-tabs v-model="activeTab" class="preferences-tabs">
      <el-tab-pane label="时间偏好" name="preferences">
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
      </el-tab-pane>

      <el-tab-pane label="自动生成排班" name="generate">
        <div class="skate-card generate-card">
          <h3 class="card-title">
            <el-icon><MagicStick /></el-icon>
            自动生成排班
          </h3>
          <p class="card-desc">
            根据您设置的时间偏好，自动生成未来几周的可预约时段
          </p>

          <div class="generate-form">
            <div class="form-row">
              <div class="form-item">
                <label class="form-label">生成周数</label>
                <el-radio-group v-model="generateWeeks">
                  <el-radio :value="2">2周</el-radio>
                  <el-radio :value="3">3周</el-radio>
                  <el-radio :value="4">4周</el-radio>
                </el-radio-group>
              </div>
            </div>

            <div class="form-row">
              <div class="form-item">
                <label class="form-label">开始日期</label>
                <el-date-picker
                  v-model="generateStartDate"
                  type="date"
                  placeholder="选择开始日期"
                  value-format="YYYY-MM-DD"
                />
              </div>
            </div>

            <el-button type="primary" @click="generateSchedule" :loading="generating">
              <el-icon><MagicStick /></el-icon>
              一键生成排班
            </el-button>
          </div>

          <div v-if="generateResult" class="generate-result">
            <el-alert
              :title="generateResult.message"
              type="success"
              :closable="false"
              show-icon
            />
            <div class="result-details">
              <div class="result-item">
                <span class="result-label">生成时段数：</span>
                <span class="result-value">{{ generateResult.generated }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">日期范围：</span>
                <span class="result-value">{{ generateResult.start_date }} 至 {{ generateResult.end_date }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="skate-card batch-card">
          <h3 class="card-title">
            <el-icon><Operation /></el-icon>
            批量调整
          </h3>
          <p class="card-desc">
            快速调整已生成排班的可用状态
          </p>

          <div class="batch-form">
            <div class="form-row">
              <div class="form-item">
                <label class="form-label">日期范围</label>
                <el-date-picker
                  v-model="batchDateRange"
                  type="daterange"
                  range-separator="至"
                  start-placeholder="开始日期"
                  end-placeholder="结束日期"
                  value-format="YYYY-MM-DD"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-item">
                <label class="form-label">星期筛选</label>
                <el-select v-model="batchDayOfWeek" placeholder="全部星期" clearable style="width: 150px;">
                  <el-option
                    v-for="(day, index) in weekdays"
                    :key="index"
                    :label="day"
                    :value="index"
                  />
                </el-select>
              </div>
              <div class="form-item">
                <label class="form-label">操作类型</label>
                <el-radio-group v-model="batchAction">
                  <el-radio value="enable">启用</el-radio>
                  <el-radio value="disable">禁用</el-radio>
                  <el-radio value="toggle">切换</el-radio>
                </el-radio-group>
              </div>
            </div>

            <el-button type="warning" @click="batchAdjust" :loading="adjusting">
              <el-icon><Operation /></el-icon>
              批量调整
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="例外日期" name="exceptions">
        <div class="skate-card exceptions-card">
          <div class="card-header">
            <h3 class="card-title">
              <el-icon><Warning /></el-icon>
              例外日期管理
            </h3>
            <el-button type="primary" size="small" @click="showAddException = true">
              <el-icon><Plus /></el-icon>
              添加例外日期
            </el-button>
          </div>

          <div v-if="exceptions.length === 0" class="empty-state">
            <el-icon :size="48"><Calendar /></el-icon>
            <p>暂无例外日期设置</p>
          </div>

          <div v-else class="exceptions-list">
            <div
              v-for="exception in exceptions"
              :key="exception.id"
              class="exception-item"
            >
              <div class="exception-date">
                <el-icon :size="20"><Calendar /></el-icon>
                <span>{{ exception.date }}</span>
              </div>
              <div class="exception-type">
                <el-tag :type="exception.type === 'off' ? 'danger' : 'warning'" size="small">
                  {{ exception.type === 'off' ? '休息' : '自定义' }}
                </el-tag>
              </div>
              <div class="exception-reason">
                {{ exception.reason || '无备注' }}
              </div>
              <div class="exception-actions">
                <el-button type="danger" text size="small" @click="deleteException(exception.id)">
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <div class="skate-card info-card">
      <h4 class="info-title">
        <el-icon><InfoFilled /></el-icon>
        说明
      </h4>
      <ul class="info-list">
        <li>设置周度时间偏好后，系统可自动生成未来 2-4 周的可预约时段</li>
        <li>系统每周一凌晨 2 点会自动为所有教练生成未来 2 周的排班</li>
        <li>使用批量调整功能可以快速修改某段时间内的排班状态</li>
        <li>例外日期（如休息日、假期）会在生成排班时自动跳过</li>
        <li>手动调整过的时段会被标记，不会被自动生成覆盖</li>
      </ul>
    </div>

    <el-dialog v-model="showAddException" title="添加例外日期" width="400px">
      <el-form :model="exceptionForm" label-width="80px">
        <el-form-item label="日期">
          <el-date-picker
            v-model="exceptionForm.date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="exceptionForm.type">
            <el-radio value="off">休息</el-radio>
            <el-radio value="custom">自定义</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="exceptionForm.reason"
            type="textarea"
            :rows="3"
            placeholder="可选，填写原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddException = false">取消</el-button>
        <el-button type="primary" @click="addException" :loading="addingException">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '../../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Clock, Delete, InfoFilled, MagicStick,
  Operation, Warning, Calendar
} from '@element-plus/icons-vue'

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const selectedDay = ref(1)
const saving = ref(false)
const activeTab = ref('preferences')

const preferences = reactive({})

const currentDaySlots = computed({
  get: () => preferences[selectedDay.value] || [],
  set: (val) => {
    preferences[selectedDay.value] = val
  }
})

const generating = ref(false)
const generateWeeks = ref(2)
const generateStartDate = ref('')
const generateResult = ref(null)

const adjusting = ref(false)
const batchDateRange = ref([])
const batchDayOfWeek = ref(null)
const batchAction = ref('disable')

const exceptions = ref([])
const showAddException = ref(false)
const addingException = ref(false)
const exceptionForm = reactive({
  date: '',
  type: 'off',
  reason: ''
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

async function generateSchedule() {
  generating.value = true
  generateResult.value = null
  try {
    const { data } = await api.post('/coach/schedule/generate', {
      weeks: generateWeeks.value,
      start_date: generateStartDate.value || undefined
    })
    generateResult.value = data
    ElMessage.success(data.message)
  } catch (e) {
  } finally {
    generating.value = false
  }
}

async function batchAdjust() {
  if (!batchDateRange.value || batchDateRange.value.length !== 2) {
    ElMessage.warning('请选择日期范围')
    return
  }

  adjusting.value = true
  try {
    const { data } = await api.post('/coach/schedule/batch-adjust', {
      date_range: {
        start: batchDateRange.value[0],
        end: batchDateRange.value[1]
      },
      day_of_week: batchDayOfWeek.value,
      action: batchAction.value
    })
    ElMessage.success(data.message)
  } catch (e) {
  } finally {
    adjusting.value = false
  }
}

async function loadExceptions() {
  try {
    const { data } = await api.get('/coach/schedule/exceptions')
    exceptions.value = data.exceptions || []
  } catch {}
}

async function addException() {
  if (!exceptionForm.date) {
    ElMessage.warning('请选择日期')
    return
  }

  addingException.value = true
  try {
    const { data } = await api.post('/coach/schedule/exceptions', {
      date: exceptionForm.date,
      type: exceptionForm.type,
      reason: exceptionForm.reason
    })
    ElMessage.success(data.message)
    showAddException.value = false
    exceptionForm.date = ''
    exceptionForm.type = 'off'
    exceptionForm.reason = ''
    loadExceptions()
  } catch (e) {
  } finally {
    addingException.value = false
  }
}

async function deleteException(id) {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个例外日期吗？',
      '确认删除',
      { type: 'warning' }
    )
    await api.delete(`/coach/schedule/exceptions/${id}`)
    ElMessage.success('删除成功')
    loadExceptions()
  } catch {}
}

onMounted(() => {
  loadPreferences()
  loadExceptions()
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

.preferences-tabs {
  --el-tabs-header-color: #888;
  --el-tabs-active-text-color: #00E5FF;
}

.preferences-card,
.generate-card,
.batch-card,
.exceptions-card {
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

.card-title {
  font-size: 18px;
  color: #00E5FF;
  margin: 0 0 8px 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-desc {
  font-size: 14px;
  color: #888;
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.generate-form,
.batch-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  color: #888;
  font-weight: 500;
}

.generate-result {
  margin-top: 24px;
}

.result-details {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #2C2C2C;
  border-radius: 8px;
}

.result-item {
  display: flex;
  gap: 8px;
}

.result-label {
  color: #888;
  font-size: 14px;
}

.result-value {
  color: #F5F7FA;
  font-size: 14px;
  font-weight: 500;
}

.exceptions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exception-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #2C2C2C;
  border-radius: 8px;
  border: 1px solid #333;
}

.exception-date {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #00E5FF;
  font-weight: 600;
  min-width: 140px;
}

.exception-type {
  min-width: 80px;
}

.exception-reason {
  flex: 1;
  color: #888;
  font-size: 14px;
}

.exception-actions {
  min-width: 60px;
  text-align: right;
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
  .form-row {
    flex-direction: column;
  }
  .exception-item {
    flex-wrap: wrap;
  }
}
</style>
