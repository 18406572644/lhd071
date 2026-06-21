<template>
  <div class="admin-bookings">
    <div class="skate-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="预约管理" name="bookings">
          <div class="filters">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
            <el-select v-model="filterStatus" placeholder="状态筛选" clearable>
              <el-option label="待支付" value="pending" />
              <el-option label="已支付" value="paid" />
              <el-option label="已签到" value="checked_in" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
            <el-select v-model="filterType" placeholder="类型筛选" clearable>
              <el-option label="散客场" value="venue" />
              <el-option label="私教课" value="private" />
            </el-select>
          </div>
          <el-table :data="filteredBookings" :style="darkTableStyle">
            <el-table-column prop="username" label="用户" />
            <el-table-column prop="booking_date" label="日期" />
            <el-table-column label="时段">
              <template #default="{ row }">
                {{ row.start_time }}-{{ row.end_time }}
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" />
            <el-table-column prop="coach_name" label="教练" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="payment_status" label="支付状态" />
            <el-table-column prop="amount" label="金额" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="消息中心" name="messages">
          <div class="message-section">
            <h3 class="card-title">发送消息</h3>
            <el-form :model="msgForm" label-width="80px">
              <el-form-item label="用户">
                <el-select v-model="msgForm.user_id" placeholder="选择用户" filterable>
                  <el-option
                    v-for="u in users"
                    :key="u.id"
                    :label="u.username"
                    :value="u.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="类型">
                <el-select v-model="msgForm.type">
                  <el-option label="通知" value="notification" />
                  <el-option label="提醒" value="reminder" />
                  <el-option label="系统" value="system" />
                </el-select>
              </el-form-item>
              <el-form-item label="标题">
                <el-input v-model="msgForm.title" />
              </el-form-item>
              <el-form-item label="内容">
                <el-input v-model="msgForm.content" type="textarea" :rows="4" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="sendMessage">发送</el-button>
              </el-form-item>
            </el-form>
          </div>
          <div class="message-section">
            <h3 class="card-title">已发消息</h3>
            <el-table :data="sentMessages" :style="darkTableStyle">
              <el-table-column prop="user_id" label="用户ID" />
              <el-table-column prop="type" label="类型" />
              <el-table-column prop="title" label="标题" />
              <el-table-column prop="content" label="内容" />
              <el-table-column label="操作" width="100">
                <template #default="{ $index }">
                  <el-button size="small" type="danger" @click="deleteMessage($index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '../../api'
import { ElMessage } from 'element-plus'

const activeTab = ref('bookings')
const bookings = ref([])
const dateRange = ref(null)
const filterStatus = ref('')
const filterType = ref('')
const users = ref([])
const sentMessages = ref([])

const msgForm = reactive({
  user_id: null,
  type: 'notification',
  title: '',
  content: '',
})

const darkTableStyle = {
  '--el-table-bg-color': '#2C2C2C',
  '--el-table-tr-bg-color': '#2C2C2C',
  '--el-table-header-bg-color': '#3A3A3A',
  '--el-table-row-hover-bg-color': '#363636',
  '--el-table-border-color': '#444',
  '--el-table-text-color': '#F5F7FA',
  '--el-table-header-text-color': '#00E5FF',
}

const filteredBookings = computed(() => {
  let list = bookings.value
  if (dateRange.value) {
    const [start, end] = dateRange.value
    list = list.filter(b => b.booking_date >= start && b.booking_date <= end)
  }
  if (filterStatus.value) {
    list = list.filter(b => b.status === filterStatus.value)
  }
  if (filterType.value) {
    list = list.filter(b => b.type === filterType.value)
  }
  return list
})

async function loadBookings() {
  try {
    const { data } = await api.get('/bookings/all')
    bookings.value = data.bookings || []
    extractUsers()
  } catch {}
}

function extractUsers() {
  const map = new Map()
  for (const b of bookings.value) {
    if (b.user_id && b.username && !map.has(b.user_id)) {
      map.set(b.user_id, { id: b.user_id, username: b.username })
    }
  }
  users.value = Array.from(map.values())
}

async function sendMessage() {
  if (!msgForm.user_id || !msgForm.title || !msgForm.content) {
    ElMessage.warning('请填写完整消息信息')
    return
  }
  try {
    const { data } = await api.post('/messages', {
      user_id: msgForm.user_id,
      type: msgForm.type,
      title: msgForm.title,
      content: msgForm.content,
    })
    ElMessage.success('发送成功')
    sentMessages.value.unshift({
      user_id: msgForm.user_id,
      type: msgForm.type,
      title: msgForm.title,
      content: msgForm.content,
    })
    Object.assign(msgForm, { user_id: null, type: 'notification', title: '', content: '' })
  } catch {}
}

function deleteMessage(index) {
  sentMessages.value.splice(index, 1)
  ElMessage.success('删除成功')
}

onMounted(() => {
  loadBookings()
})
</script>

<style scoped>
.admin-bookings {
  animation: slide-up 0.5s ease;
}

.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.card-title {
  font-size: 16px;
  color: #00E5FF;
  margin-bottom: 16px;
  font-weight: 600;
}

.message-section {
  margin-bottom: 24px;
}
</style>
