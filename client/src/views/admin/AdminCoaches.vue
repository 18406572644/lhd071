<template>
  <div class="admin-coaches">
    <div class="skate-card">
      <div class="toolbar">
        <h3 class="card-title">教练管理</h3>
        <el-button type="primary" @click="openAdd">添加教练</el-button>
      </div>
      <el-table :data="coaches" :style="darkTableStyle">
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="phone" label="电话" />
        <el-table-column prop="specialty" label="专长" />
        <el-table-column prop="hourly_rate" label="时薪" />
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" @click="openSchedule(row)">排班</el-button>
            <el-popconfirm title="确定删除？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button size="small" type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑教练' : '添加教练'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="姓名">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="专长">
          <el-input v-model="form.specialty" />
        </el-form-item>
        <el-form-item label="时薪">
          <el-input-number v-model="form.hourly_rate" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="scheduleVisible" :title="`${currentCoach?.name} 排班管理`" width="600px">
      <div class="schedule-form">
        <el-date-picker
          v-model="scheduleDate"
          type="date"
          placeholder="选择日期"
          value-format="YYYY-MM-DD"
        />
        <el-select v-model="scheduleSlotId" placeholder="选择时段">
          <el-option
            v-for="slot in allSlots"
            :key="slot.id"
            :label="`${slot.start_time}-${slot.end_time}`"
            :value="slot.id"
          />
        </el-select>
        <el-button type="primary" @click="addSchedule">添加排班</el-button>
      </div>
      <el-table :data="scheduleList" :style="darkTableStyle">
        <el-table-column prop="date" label="日期" />
        <el-table-column prop="start_time" label="开始" />
        <el-table-column prop="end_time" label="结束" />
        <el-table-column prop="available" label="可用">
          <template #default="{ row }">
            {{ row.available ? '是' : '否' }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../../api'
import { ElMessage } from 'element-plus'

const coaches = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const scheduleVisible = ref(false)
const currentCoach = ref(null)
const scheduleDate = ref('')
const scheduleSlotId = ref(null)
const scheduleList = ref([])
const allSlots = ref([])

const form = reactive({
  name: '',
  phone: '',
  specialty: '',
  hourly_rate: 100,
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

async function loadCoaches() {
  try {
    const { data } = await api.get('/coaches')
    coaches.value = data.coaches || []
  } catch {}
}

async function loadAllSlots() {
  try {
    const { data } = await api.get('/slots')
    allSlots.value = data.slots || []
  } catch {}
}

function openAdd() {
  isEdit.value = false
  editId.value = null
  Object.assign(form, { name: '', phone: '', specialty: '', hourly_rate: 100 })
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  editId.value = row.id
  Object.assign(form, {
    name: row.name,
    phone: row.phone,
    specialty: row.specialty,
    hourly_rate: row.hourly_rate,
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  try {
    if (isEdit.value) {
      await api.put(`/coaches/${editId.value}`, form)
      ElMessage.success('更新成功')
    } else {
      await api.post('/coaches', form)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadCoaches()
  } catch {}
}

async function handleDelete(id) {
  try {
    await api.delete(`/coaches/${id}`)
    ElMessage.success('删除成功')
    loadCoaches()
  } catch {}
}

async function openSchedule(coach) {
  currentCoach.value = coach
  scheduleDate.value = ''
  scheduleSlotId.value = null
  try {
    const { data } = await api.get(`/coaches/${coach.id}/schedule`)
    scheduleList.value = data.schedule || []
  } catch {}
  scheduleVisible.value = true
}

async function addSchedule() {
  if (!currentCoach.value || !scheduleDate.value || !scheduleSlotId.value) {
    ElMessage.warning('请填写完整排班信息')
    return
  }
  try {
    await api.post(`/coaches/${currentCoach.value.id}/schedule`, {
      date: scheduleDate.value,
      slot_id: scheduleSlotId.value,
      available: 1,
    })
    ElMessage.success('排班成功')
    const { data } = await api.get(`/coaches/${currentCoach.value.id}/schedule`)
    scheduleList.value = data.schedule || []
  } catch {}
}

onMounted(() => {
  loadCoaches()
  loadAllSlots()
})
</script>

<style scoped>
.admin-coaches {
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

.schedule-form {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}
</style>
