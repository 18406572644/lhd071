<template>
  <div class="register-page">
    <div class="register-card skate-card">
      <div class="register-logo">
        <svg viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg" class="logo-svg">
          <ellipse cx="8" cy="17" rx="3" ry="3" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
          <ellipse cx="32" cy="17" rx="3" ry="3" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
          <path d="M4 13 Q6 8 20 8 Q34 8 36 13" fill="none" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <h1 class="glow-text">SKATE ZONE</h1>
        <p class="register-subtitle">创建新账号</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleRegister">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" placeholder="请再次输入密码" size="large" show-password />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" size="large" />
        </el-form-item>
        <el-form-item>
          <button type="submit" class="cyber-btn register-btn" :disabled="loading">
            <span>{{ loading ? '注册中...' : '注册' }}</span>
          </button>
        </el-form-item>
      </el-form>

      <div class="register-footer">
        已有账号？
        <router-link to="/login" class="link">立即登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref()
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  phone: '',
})

const validateConfirm = (rule, value, callback) => {
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const validatePhone = (rule, value, callback) => {
  if (!/^1[3-9]\d{9}$/.test(value)) {
    callback(new Error('请输入正确的手机号'))
  } else {
    callback()
  }
}

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度为3-20个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { validator: validatePhone, trigger: 'blur' },
  ],
}

async function handleRegister() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await userStore.register({
      username: form.username,
      password: form.password,
      phone: form.phone,
    })
    ElMessage.success('注册成功')
    router.push('/')
  } catch {
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 160px);
  animation: slide-up 0.5s ease;
}

.register-card {
  width: 400px;
  max-width: 90vw;
  padding: 40px;
}

.register-logo {
  text-align: center;
  margin-bottom: 24px;
}

.logo-svg {
  width: 60px;
  height: 30px;
  margin-bottom: 8px;
}

.register-logo h1 {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 4px;
}

.register-subtitle {
  color: #888;
  font-size: 14px;
  margin-top: 4px;
}

.register-btn {
  width: 100%;
  padding: 12px;
  font-size: 16px;
}

.register-footer {
  text-align: center;
  margin-top: 16px;
  color: #888;
  font-size: 14px;
}

.link {
  color: #00E5FF;
  margin-left: 4px;
}

.link:hover {
  text-decoration: underline;
}
</style>
