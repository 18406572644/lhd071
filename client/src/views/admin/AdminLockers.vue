<template>
  <div class="admin-lockers">
    <div class="skate-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="储物柜管理" name="lockers">
          <div class="toolbar">
            <h3 class="card-title">储物柜列表</h3>
            <el-button type="primary" @click="openAdd">添加储物柜</el-button>
          </div>
          <el-table :data="lockers" :style="darkTableStyle">
            <el-table-column prop="locker_number" label="编号" width="90" />
            <el-table-column prop="store" label="门店" width="80" />
            <el-table-column prop="area" label="区域" width="70">
              <template #default="{ row }">{{ row.area }}区</template>
            </el-table-column>
            <el-table-column prop="size" label="尺寸" width="80">
              <template #default="{ row }">{{ sizeLabel(row.size) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="row_num" label="行" width="50" />
            <el-table-column prop="col_num" label="列" width="50" />
            <el-table-column label="操作" width="160">
              <template #default="{ row }">
                <el-button size="small" @click="openEdit(row)">编辑</el-button>
                <el-popconfirm title="确定删除？" @confirm="handleDelete(row.id)">
                  <template #reference>
                    <el-button size="small" type="danger" :disabled="row.status === 'in_use'">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="租用记录" name="rentals">
          <el-table :data="rentals" :style="darkTableStyle">
            <el-table-column prop="locker_number" label="储物柜" width="90" />
            <el-table-column prop="username" label="用户" width="100" />
            <el-table-column prop="rental_type" label="类型" width="90">
              <template #default="{ row }">{{ row.rental_type === 'temporary' ? '临时' : '长期' }}</template>
            </el-table-column>
            <el-table-column prop="billing_cycle" label="计费周期" width="90">
              <template #default="{ row }">{{ cycleLabel(row.billing_cycle) }}</template>
            </el-table-column>
            <el-table-column prop="amount" label="金额" width="80" />
            <el-table-column prop="start_time" label="开始时间" width="160" />
            <el-table-column prop="end_time" label="到期时间" width="160" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">{{ row.status === 'active' ? '有效' : '已结束' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'active'"
                  size="small"
                  type="danger"
                  @click="handleForceReturn(row.id)"
                >强制退租</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="价格设置" name="pricing">
          <div class="pricing-grid">
            <div v-for="(sizes, label) in pricing" :key="label" class="pricing-row">
              <span class="pricing-size">{{ sizeLabel(label) }}</span>
              <div class="pricing-cycles">
                <div v-for="(price, cycle) in sizes" :key="cycle" class="pricing-item">
                  <span class="pricing-cycle">{{ cycleLabel(cycle) }}</span>
                  <el-input-number v-model="pricing[label][cycle]" :min="0" :step="10" size="small" />
                </div>
              </div>
            </div>
          </div>
          <el-button type="primary" style="margin-top: 20px;" @click="savePricing">保存价格</el-button>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑储物柜' : '添加储物柜'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="编号">
          <el-input v-model="form.locker_number" placeholder="如 A-01" />
        </el-form-item>
        <el-form-item label="门店">
          <el-input v-model="form.store" placeholder="主店" />
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="form.area">
            <el-option label="A区" value="A" />
            <el-option label="B区" value="B" />
          </el-select>
        </el-form-item>
        <el-form-item label="尺寸">
          <el-select v-model="form.size">
            <el-option label="小号" value="small" />
            <el-option label="中号" value="medium" />
            <el-option label="大号" value="large" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="空闲" value="free" />
            <el-option label="使用中" value="in_use" />
            <el-option label="故障" value="fault" />
            <el-option label="维护中" value="maintenance" />
          </el-select>
        </el-form-item>
        <el-form-item label="行号">
          <el-input-number v-model="form.row_num" :min="0" />
        </el-form-item>
        <el-form-item label="列号">
          <el-input-number v-model="form.col_num" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const activeTab = ref('lockers')
const lockers = ref([])
const rentals = ref([])
const pricing = ref({})
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const form = reactive({
  locker_number: '',
  store: '主店',
  area: 'A',
  size: 'small',
  status: 'free',
  row_num: 0,
  col_num: 0
})

const darkTableStyle = {
  '--el-table-bg-color': '#2C2C2C',
  '--el-table-tr-bg-color': '#2C2C2C',
  '--el-table-header-bg-color': '#3A3A3A',
  '--el-table-row-hover-bg-color': '#363636',
  '--el-table-border-color': '#444',
  '--el-table-text-color': '#F5F7FA',
  '--el-table-header-text-color': '#00E5FF'
}

function sizeLabel(size) {
  if (size === 'small') return '小号'
  if (size === 'medium') return '中号'
  if (size === 'large') return '大号'
  return size
}

function statusLabel(status) {
  if (status === 'free') return '空闲'
  if (status === 'in_use') return '使用中'
  if (status === 'fault') return '故障'
  if (status === 'maintenance') return '维护中'
  return status
}

function statusType(status) {
  if (status === 'free') return 'success'
  if (status === 'in_use') return 'warning'
  if (status === 'fault') return 'danger'
  return 'info'
}

function cycleLabel(cycle) {
  if (cycle === 'hour') return '小时'
  if (cycle === 'day') return '天'
  if (cycle === 'month') return '月'
  if (cycle === 'quarter') return '季'
  return cycle
}

async function loadLockers() {
  try {
    var { data } = await api.get('/lockers')
    lockers.value = data.lockers || []
  } catch {}
}

async function loadRentals() {
  try {
    var { data } = await api.get('/lockers/rentals')
    rentals.value = data.rentals || []
  } catch {}
}

async function loadPricing() {
  try {
    var { data } = await api.get('/lockers/pricing')
    pricing.value = data.pricing || {}
  } catch {}
}

function openAdd() {
  isEdit.value = false
  editId.value = null
  Object.assign(form, {
    locker_number: '',
    store: '主店',
    area: 'A',
    size: 'small',
    status: 'free',
    row_num: 0,
    col_num: 0
  })
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  editId.value = row.id
  Object.assign(form, {
    locker_number: row.locker_number,
    store: row.store,
    area: row.area,
    size: row.size,
    status: row.status,
    row_num: row.row_num,
    col_num: row.col_num
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  try {
    if (isEdit.value) {
      await api.put(`/lockers/${editId.value}`, form)
      ElMessage.success('更新成功')
    } else {
      await api.post('/lockers', form)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadLockers()
  } catch {}
}

async function handleDelete(id) {
  try {
    await api.delete(`/lockers/${id}`)
    ElMessage.success('删除成功')
    loadLockers()
  } catch {}
}

async function handleForceReturn(id) {
  try {
    await ElMessageBox.confirm('确定强制退租该储物柜吗？', '提示', { type: 'warning' })
    await api.post(`/lockers/rentals/${id}/return`)
    ElMessage.success('退租成功')
    loadRentals()
    loadLockers()
  } catch {}
}

async function savePricing() {
  try {
    await api.put('/lockers/pricing', { pricing: pricing.value })
    ElMessage.success('价格已更新')
  } catch {}
}

onMounted(() => {
  loadLockers()
  loadRentals()
  loadPricing()
})
</script>

<style scoped>
.admin-lockers {
  animation: slide-up 0.5s ease;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-title {
  font-size: 16px;
  color: #00E5FF;
  font-weight: 600;
}

.pricing-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pricing-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.pricing-size {
  font-weight: 700;
  color: #00E5FF;
  min-width: 50px;
  line-height: 32px;
}

.pricing-cycles {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.pricing-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pricing-cycle {
  color: #999;
  font-size: 13px;
  min-width: 30px;
}
</style>
