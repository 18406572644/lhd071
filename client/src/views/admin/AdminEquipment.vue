<template>
  <div class="admin-equipment">
    <div class="skate-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="器材管理" name="equipment">
          <div class="toolbar">
            <h3 class="card-title">器材列表</h3>
            <el-button type="primary" @click="openAdd">添加器材</el-button>
          </div>
          <el-table :data="equipment" :style="darkTableStyle">
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="type" label="类型" />
            <el-table-column prop="total_count" label="总数" />
            <el-table-column prop="available_count" label="可用数" />
            <el-table-column prop="rental_price" label="租借价格" />
            <el-table-column prop="status" label="状态" />
            <el-table-column label="操作" width="160">
              <template #default="{ row }">
                <el-button size="small" @click="openEdit(row)">编辑</el-button>
                <el-popconfirm title="确定删除？" @confirm="handleDelete(row.id)">
                  <template #reference>
                    <el-button size="small" type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="维修记录" name="repairs">
          <el-table :data="repairs" :style="darkTableStyle">
            <el-table-column prop="equipment_name" label="器材" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="description" label="描述" />
            <el-table-column prop="reporter_name" label="报修人" />
            <el-table-column prop="created_at" label="报修时间" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'pending'"
                  size="small"
                  @click="updateRepair(row.id, 'repairing')"
                >开始维修</el-button>
                <el-button
                  v-if="row.status === 'repairing'"
                  size="small"
                  type="success"
                  @click="updateRepair(row.id, 'done')"
                >完成维修</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="租借记录" name="rentals">
          <el-table :data="rentals" :style="darkTableStyle">
            <el-table-column prop="equipment_name" label="器材" />
            <el-table-column prop="user_name" label="用户" />
            <el-table-column prop="quantity" label="数量" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="created_at" label="租借时间" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'rented'"
                  size="small"
                  type="success"
                  @click="returnRental(row.id)"
                >归还</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑器材' : '添加器材'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="form.type" />
        </el-form-item>
        <el-form-item label="总数">
          <el-input-number v-model="form.total_count" :min="1" />
        </el-form-item>
        <el-form-item label="租借价格">
          <el-input-number v-model="form.rental_price" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="正常" value="normal" />
            <el-option label="维修中" value="repairing" />
            <el-option label="损坏" value="damaged" />
          </el-select>
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
import { ElMessage } from 'element-plus'

const activeTab = ref('equipment')
const equipment = ref([])
const repairs = ref([])
const rentals = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const form = reactive({
  name: '',
  type: '',
  total_count: 1,
  rental_price: 0,
  status: 'normal',
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

async function loadEquipment() {
  try {
    const { data } = await api.get('/equipment')
    equipment.value = data.equipment || []
  } catch {}
}

async function loadRepairs() {
  try {
    const { data } = await api.get('/equipment/repairs')
    repairs.value = data.repairs || []
  } catch {}
}

async function loadRentals() {
  try {
    const { data } = await api.get('/equipment/rentals')
    rentals.value = data.rentals || []
  } catch {}
}

function openAdd() {
  isEdit.value = false
  editId.value = null
  Object.assign(form, {
    name: '',
    type: '',
    total_count: 1,
    rental_price: 0,
    status: 'normal',
  })
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  editId.value = row.id
  Object.assign(form, {
    name: row.name,
    type: row.type,
    total_count: row.total_count,
    rental_price: row.rental_price,
    status: row.status,
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  try {
    if (isEdit.value) {
      await api.put(`/equipment/${editId.value}`, form)
      ElMessage.success('更新成功')
    } else {
      await api.post('/equipment', form)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadEquipment()
  } catch {}
}

async function handleDelete(id) {
  try {
    await api.delete(`/equipment/${id}`)
    ElMessage.success('删除成功')
    loadEquipment()
  } catch {}
}

async function updateRepair(id, status) {
  try {
    await api.put(`/equipment/repairs/${id}`, { status })
    ElMessage.success('状态已更新')
    loadRepairs()
    loadEquipment()
  } catch {}
}

async function returnRental(id) {
  try {
    await api.post(`/equipment/rentals/${id}/return`)
    ElMessage.success('归还成功')
    loadRentals()
    loadEquipment()
  } catch {}
}

onMounted(() => {
  loadEquipment()
  loadRepairs()
  loadRentals()
})
</script>

<style scoped>
.admin-equipment {
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
</style>
