<template>
  <div class="equipment-page">
    <h2 class="page-title glow-text">装备租赁</h2>

    <div v-if="equipLoading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>

    <div v-else class="equipment-grid">
      <div v-for="item in equipment" :key="item.id" class="skate-card equip-card">
        <svg class="equip-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="12" width="32" height="24" rx="3" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
          <line x1="8" y1="22" x2="40" y2="22" stroke="#00E5FF" stroke-width="1" opacity="0.5"/>
          <circle cx="18" cy="30" r="2.5" fill="#00E5FF" opacity="0.4"/>
          <circle cx="30" cy="30" r="2.5" fill="#00E5FF" opacity="0.4"/>
        </svg>
        <h3 class="equip-name">{{ item.name }}</h3>
        <div class="equip-meta">
          <el-tag size="small" type="info">{{ item.type }}</el-tag>
          <span class="equip-available">可用: {{ item.available_count }}</span>
        </div>
        <div class="equip-price glow-text">¥{{ item.rental_price }}/次</div>
        <div class="equip-actions">
          <el-button type="primary" size="small" @click="openRentDialog(item)">租赁</el-button>
          <el-button size="small" @click="openRepairDialog(item)">报修</el-button>
        </div>
      </div>
    </div>

    <div class="my-rentals-section">
      <h3 class="section-title">我的租赁</h3>
      <div v-if="myRentals.length === 0" class="empty-hint">暂无租赁记录</div>
      <div v-else class="rentals-list">
        <div v-for="rental in myRentals" :key="rental.id" class="skate-card rental-item">
          <div class="rental-info">
            <span class="rental-name">{{ rental.equipment_name }}</span>
            <span class="rental-qty">x{{ rental.quantity }}</span>
            <span class="rental-date">{{ rental.created_at }}</span>
          </div>
          <el-button type="danger" size="small" @click="handleReturn(rental)">归还</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="rentDialogVisible" title="租赁装备" width="400px">
      <div v-if="rentItem" class="rent-dialog-body">
        <p class="rent-item-name">{{ rentItem.name }}</p>
        <p class="rent-item-price">租金: ¥{{ rentItem.rental_price }}/次</p>
        <el-form-item label="数量">
          <el-input-number v-model="rentQuantity" :min="1" :max="rentItem.available_count" />
        </el-form-item>
      </div>
      <template #footer>
        <el-button @click="rentDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="renting" @click="handleRent">确认租赁</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="repairDialogVisible" title="装备报修" width="400px">
      <div v-if="repairItem" class="repair-dialog-body">
        <p class="repair-item-name">{{ repairItem.name }}</p>
        <el-form-item label="损坏描述">
          <el-input v-model="repairDesc" type="textarea" :rows="3" placeholder="请描述损坏情况" />
        </el-form-item>
      </div>
      <template #footer>
        <el-button @click="repairDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="repairing" @click="handleRepair">提交报修</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'

const equipment = ref([])
const myRentals = ref([])
const equipLoading = ref(false)

const rentDialogVisible = ref(false)
const rentItem = ref(null)
const rentQuantity = ref(1)
const renting = ref(false)

const repairDialogVisible = ref(false)
const repairItem = ref(null)
const repairDesc = ref('')
const repairing = ref(false)

function openRentDialog(item) {
  rentItem.value = item
  rentQuantity.value = 1
  rentDialogVisible.value = true
}

function openRepairDialog(item) {
  repairItem.value = item
  repairDesc.value = ''
  repairDialogVisible.value = true
}

async function handleRent() {
  if (!rentItem.value) return
  renting.value = true
  try {
    await api.post(`/equipment/${rentItem.value.id}/rent`, { quantity: rentQuantity.value })
    ElMessage.success('租赁成功')
    rentDialogVisible.value = false
    fetchEquipment()
    fetchMyRentals()
  } catch {
  } finally {
    renting.value = false
  }
}

async function handleRepair() {
  if (!repairItem.value || !repairDesc.value.trim()) {
    ElMessage.warning('请填写损坏描述')
    return
  }
  repairing.value = true
  try {
    await api.post(`/equipment/${repairItem.value.id}/repair`, { description: repairDesc.value })
    ElMessage.success('报修已提交')
    repairDialogVisible.value = false
  } catch {
  } finally {
    repairing.value = false
  }
}

async function handleReturn(rental) {
  try {
    await ElMessageBox.confirm('确定归还该装备吗？', '提示', { type: 'info' })
    await api.post(`/equipment/rentals/${rental.id}/return`)
    ElMessage.success('归还成功')
    fetchMyRentals()
    fetchEquipment()
  } catch {
  }
}

async function fetchEquipment() {
  equipLoading.value = true
  try {
    const { data } = await api.get('/equipment')
    equipment.value = data.equipment || []
  } catch {
    equipment.value = []
  } finally {
    equipLoading.value = false
  }
}

async function fetchMyRentals() {
  try {
    const { data } = await api.get('/equipment/rentals/mine')
    myRentals.value = data.rentals || []
  } catch {
    myRentals.value = []
  }
}

onMounted(() => {
  fetchEquipment()
  fetchMyRentals()
})
</script>

<style scoped>
.equipment-page {
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

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.equip-card {
  text-align: center;
}

.equip-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
}

.equip-name {
  font-size: 16px;
  color: #F5F7FA;
  margin-bottom: 8px;
}

.equip-meta {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.equip-available {
  font-size: 13px;
  color: #888;
}

.equip-price {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
}

.equip-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
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
  gap: 10px;
}

.rental-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
}

.rental-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.rental-name {
  font-weight: 600;
  color: #F5F7FA;
}

.rental-qty {
  color: #00E5FF;
}

.rental-date {
  color: #888;
  font-size: 13px;
}

.rent-dialog-body,
.repair-dialog-body {
  padding: 8px 0;
}

.rent-item-name,
.repair-item-name {
  font-size: 16px;
  font-weight: 600;
  color: #2C2C2C;
  margin-bottom: 8px;
}

.rent-item-price {
  color: #888;
  margin-bottom: 16px;
}
</style>
