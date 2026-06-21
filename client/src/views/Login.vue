<template>
  <div class="login-page">
    <div class="login-card skate-card">
      <div class="login-logo">
        <svg viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg" class="logo-svg">
          <ellipse cx="8" cy="17" rx="3" ry="3" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
          <ellipse cx="32" cy="17" rx="3" ry="3" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
          <path d="M4 13 Q6 8 20 8 Q34 8 36 13" fill="none" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <h1 class="glow-text">SKATE ZONE</h1>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleLogin">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <button type="submit" class="cyber-btn login-btn" :disabled="loading">
            <span>{{ loading ? '登录中...' : '登录' }}</span>
          </button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        还没有账号？
        <router-link to="/register" class="link">立即注册</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formRef = ref()
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const data = await userStore.login({ username: form.username, password: form.password })
    ElMessage.success('登录成功')
    const redirect = route.query.redirect
    if (redirect) {
      router.push(redirect)
    } else if (data.user.role === 'coach') {
      router.push('/coach')
    } else if (data.user.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/')
    }
  } catch {
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 160px);
  animation: slide-up 0.5s ease;
}

.login-card {
  width: 400px;
  max-width: 90vw;
  padding: 40px;
}

.login-logo {
  text-align: center;
  margin-bottom: 32px;
}

.logo-svg {
  width: 60px;
  height: 30px;
  margin-bottom: 8px;
}

.login-logo h1 {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 4px;
}

.login-btn {
  width: 100%;
  padding: 12px;
  font-size: 16px;
}

.login-footer {
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
