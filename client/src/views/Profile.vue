<template>
  <div class="profile-page">
    <h2 class="page-title glow-text">个人中心</h2>

    <div class="profile-layout">
      <div class="profile-left">
        <div class="skate-card user-info-card">
          <div class="user-avatar-large">
            {{ userStore.user?.username?.charAt(0)?.toUpperCase() }}
          </div>
          <h3 class="user-name">{{ userStore.user?.username }}</h3>
          <div class="user-meta">
            <span>{{ userStore.user?.phone || '未绑定' }}</span>
            <el-tag size="small" :type="userStore.user?.role === 'admin' ? 'danger' : ''">
              {{ userStore.user?.role === 'admin' ? '管理员' : '会员' }}
            </el-tag>
          </div>
          <div class="user-date">注册时间: {{ userStore.user?.created_at?.slice(0, 10) || '-' }}</div>
        </div>

        <div class="skate-card balance-card">
          <div class="balance-item">
            <span class="balance-label">账户余额</span>
            <span class="balance-value glow-text">¥{{ userStore.user?.balance || 0 }}</span>
          </div>
          <div class="balance-item">
            <span class="balance-label">积分</span>
            <span class="balance-value glow-text">{{ userStore.user?.points || 0 }}</span>
          </div>
        </div>

        <div class="skate-card recharge-card">
          <h3 class="card-label">充值</h3>
          <div class="preset-amounts">
            <button
              v-for="amt in presetAmounts"
              :key="amt"
              class="amount-btn"
              :class="{ 'amount-btn--active': rechargeAmount === amt }"
              @click="rechargeAmount = amt"
            >
              ¥{{ amt }}
            </button>
          </div>
          <el-input
            v-model="rechargeAmount"
            type="number"
            placeholder="自定义金额"
            size="large"
            class="recharge-input"
          />
          <el-button type="primary" size="large" :loading="recharging" @click="handleRecharge" class="full-btn">
            充值
          </el-button>
        </div>

        <div class="skate-card points-card">
          <h3 class="card-label">积分兑换</h3>
          <p class="points-info">兑换比例: 100积分 = 1元</p>
          <div class="points-row">
            <el-input-number v-model="exchangePoints" :min="100" :step="100" size="large" />
            <span class="points-result">= ¥{{ (exchangePoints / 100).toFixed(2) }}</span>
          </div>
          <el-button type="primary" size="large" :loading="exchanging" @click="handleExchange" class="full-btn">
            兑换
          </el-button>
        </div>
      </div>

      <div class="profile-right">
        <div class="skate-card edit-card">
          <h3 class="card-label">编辑资料</h3>
          <el-form ref="editFormRef" :model="editForm" label-position="top">
            <el-form-item label="手机号">
              <el-input v-model="editForm.phone" placeholder="输入新手机号" />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input v-model="editForm.password" type="password" placeholder="不修改请留空" show-password />
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input v-model="editForm.confirmPassword" type="password" placeholder="不修改请留空" show-password />
            </el-form-item>
            <el-button type="primary" :loading="saving" @click="handleSaveProfile">保存修改</el-button>
          </el-form>
        </div>

        <div class="skate-card history-card">
          <h3 class="card-label">交易记录</h3>
          <el-table :data="transactions" stripe style="width: 100%" size="small" v-if="transactions.length">
            <el-table-column prop="created_at" label="时间" width="150">
              <template #default="{ row }">{{ row.created_at?.slice(5, 16) }}</template>
            </el-table-column>
            <el-table-column prop="method" label="方式" width="80">
              <template #default="{ row }">{{ row.method === 'balance' ? '余额' : row.method }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag size="small" :type="row.status === 'success' ? 'success' : row.status === 'refunded' ? 'warning' : 'info'">
                  {{ row.status === 'success' ? '成功' : row.status === 'refunded' ? '已退款' : row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="金额">
              <template #default="{ row }">
                <span :class="(row.status === 'success' && !row.booking_id) ? 'text-green' : 'text-red'">
                  {{ (row.status === 'success' && !row.booking_id) ? '+' : '' }}¥{{ row.amount }}
                </span>
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="empty-hint">暂无交易记录</div>
        </div>

        <div class="skate-card messages-card">
          <h3 class="card-label">消息通知</h3>
          <div v-if="messages.length === 0" class="empty-hint">暂无消息</div>
          <div v-else class="messages-list">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="message-item"
              :class="{ 'message-item--unread': !msg.is_read }"
              @click="readMessage(msg)"
            >
              <div class="message-content">
                <span class="message-title">{{ msg.title }}</span>
                <span class="message-time">{{ msg.created_at?.slice(5, 16) }}</span>
              </div>
              <el-button type="danger" size="small" text @click.stop="deleteMessage(msg.id)">
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../api'
import { useUserStore } from '../stores/user'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()

const presetAmounts = [100, 200, 500, 1000]
const rechargeAmount = ref(100)
const recharging = ref(false)

const exchangePoints = ref(100)
const exchanging = ref(false)

const editFormRef = ref()
const saving = ref(false)
const editForm = reactive({
  phone: '',
  password: '',
  confirmPassword: '',
})

const transactions = ref([])
const messages = ref([])

async function handleRecharge() {
  if (!rechargeAmount.value || rechargeAmount.value <= 0) {
    ElMessage.warning('请输入有效金额')
    return
  }
  recharging.value = true
  try {
    await userStore.recharge(rechargeAmount.value)
    ElMessage.success('充值成功')
    fetchHistory()
  } catch {
  } finally {
    recharging.value = false
  }
}

async function handleExchange() {
  if (exchangePoints.value < 100) {
    ElMessage.warning('最少兑换100积分')
    return
  }
  exchanging.value = true
  try {
    const { data } = await api.post('/members/points-exchange', { points: exchangePoints.value })
    ElMessage.success(`兑换成功，获得 ¥${data.gainedBalance}`)
    userStore.user.balance = data.balance
    userStore.user.points = data.points
    localStorage.setItem('user', JSON.stringify(userStore.user))
    fetchHistory()
  } catch {
  } finally {
    exchanging.value = false
  }
}

async function handleSaveProfile() {
  if (editForm.password && editForm.password !== editForm.confirmPassword) {
    ElMessage.warning('两次密码不一致')
    return
  }
  saving.value = true
  try {
    const payload = {}
    if (editForm.phone) payload.phone = editForm.phone
    if (editForm.password) payload.password = editForm.password
    if (Object.keys(payload).length === 0) {
      ElMessage.info('没有需要修改的内容')
      saving.value = false
      return
    }
    await api.put('/auth/profile', payload)
    ElMessage.success('修改成功')
    userStore.fetchProfile()
    editForm.password = ''
    editForm.confirmPassword = ''
  } catch {
  } finally {
    saving.value = false
  }
}

function readMessage(msg) {
  msg.is_read = 1
}

async function deleteMessage(id) {
  try {
    await api.delete(`/messages/${id}`)
    messages.value = messages.value.filter(m => m.id !== id)
    ElMessage.success('已删除')
  } catch {}
}

async function fetchHistory() {
  try {
    const { data } = await api.get('/members/history')
    transactions.value = data.history || []
  } catch {
    transactions.value = []
  }
}

async function fetchMessages() {
  try {
    const { data } = await api.get('/messages')
    messages.value = data.messages || []
  } catch {
    messages.value = []
  }
}

onMounted(() => {
  if (userStore.user?.phone) {
    editForm.phone = userStore.user.phone
  }
  fetchHistory()
  fetchMessages()
})
</script>

<style scoped>
.profile-page {
  animation: slide-up 0.5s ease;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
  letter-spacing: 2px;
}

.profile-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.profile-left {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.user-info-card {
  text-align: center;
  padding: 32px 24px;
}

.user-avatar-large {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #00B8D4;
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.user-name {
  font-size: 20px;
  color: #F5F7FA;
  margin-bottom: 8px;
}

.user-meta {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #888;
  font-size: 14px;
}

.user-date {
  font-size: 13px;
  color: #666;
}

.balance-card {
  display: flex;
  justify-content: space-around;
  padding: 24px;
}

.balance-item {
  text-align: center;
}

.balance-label {
  display: block;
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
}

.balance-value {
  font-size: 28px;
  font-weight: 800;
}

.card-label {
  font-size: 16px;
  color: #00E5FF;
  margin-bottom: 16px;
  font-weight: 600;
}

.preset-amounts {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.amount-btn {
  padding: 8px 20px;
  border: 1.5px solid #3A3A3A;
  background: transparent;
  color: #F5F7FA;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.amount-btn:hover {
  border-color: #00E5FF;
  color: #00E5FF;
}

.amount-btn--active {
  border-color: #00E5FF;
  color: #00E5FF;
  background: rgba(0, 229, 255, 0.1);
}

.recharge-input {
  margin-bottom: 12px;
}

.full-btn {
  width: 100%;
}

.points-info {
  font-size: 14px;
  color: #888;
  margin-bottom: 12px;
}

.points-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.points-result {
  color: #00E5FF;
  font-weight: 600;
  font-size: 18px;
}

.empty-hint {
  text-align: center;
  padding: 24px;
  color: #888;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  background: #3A3A3A;
}

.message-item:hover {
  background: #444;
}

.message-item--unread {
  border-left: 3px solid #00E5FF;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-title {
  font-size: 14px;
  color: #F5F7FA;
}

.message-time {
  font-size: 12px;
  color: #888;
}

.text-green {
  color: #67c23a;
}

.text-red {
  color: #f56c6c;
}

@media (max-width: 768px) {
  .profile-layout {
    flex-direction: column;
  }

  .profile-left {
    width: 100%;
  }

  .balance-card {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
