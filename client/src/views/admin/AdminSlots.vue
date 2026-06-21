<template>
  <div class="admin-slots">
    <div class="skate-card">
      <div class="toolbar">
        <el-radio-group v-model="slotType" @change="loadSlots">
          <el-radio-button value="weekday">工作日</el-radio-button>
          <el-radio-button value="weekend">周末</el-radio-button>
        </el-radio-group>
        <el-button type="primary" @click="openAdd">添加时段</el-button>
      </div>
      <el-table :data="slots" :style="darkTableStyle">
        <el-table-column prop="type" label="类型" />
        <el-table-column prop="start_time" label="开始时间" />
        <el-table-column prop="end_time" label="结束时间" />
        <el-table-column prop="capacity" label="容量" />
        <el-table-column prop="price" label="价格" />
        <el-table-column prop="session_type" label="场次类型" />
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
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑时段' : '添加时段'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="类型">
          <el-select v-model="form.type">
            <el-option label="工作日" value="weekday" />
            <el-option label="周末" value="weekend" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-input v-model="form.start_time" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-input v-model="form.end_time" />
        </el-form-item>
        <el-form-item label="容量">
          <el-input-number v-model="form.capacity" :min="1" />
        </el-form-item>
        <el-form-item label="价格">
          <el-input-number v-model="form.price" :min="0" />
        </el-form-item>
        <el-form-item label="场次类型">
          <el-select v-model="form.session_type">
            <el-option label="开放场" value="open" />
            <el-option label="私教课" value="private" />
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

const slotType = ref('weekday')
const slots = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const form = reactive({
  type: 'weekday',
  start_time: '',
  end_time: '',
  capacity: 10,
  price: 50,
  session_type: 'open',
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

async function loadSlots() {
  try {
    const { data } = await api.get('/slots', { params: { type: slotType.value } })
    slots.value = data.slots || []
  } catch {}
}

function openAdd() {
  isEdit.value = false
  editId.value = null
  Object.assign(form, {
    type: slotType.value,
    start_time: '',
    end_time: '',
    capacity: 10,
    price: 50,
    session_type: 'open',
  })
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  editId.value = row.id
  Object.assign(form, {
    type: row.type,
    start_time: row.start_time,
    end_time: row.end_time,
    capacity: row.capacity,
    price: row.price,
    session_type: row.session_type,
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  try {
    if (isEdit.value) {
      await api.put(`/slots/${editId.value}`, form)
      ElMessage.success('更新成功')
    } else {
      await api.post('/slots', form)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadSlots()
  } catch {}
}

async function handleDelete(id) {
  try {
    await api.delete(`/slots/${id}`)
    ElMessage.success('删除成功')
    loadSlots()
  } catch {}
}

onMounted(() => {
  loadSlots()
})
</script>

<style scoped>
.admin-slots {
  animation: slide-up 0.5s ease;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>
