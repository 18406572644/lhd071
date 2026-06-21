<template>
  <div class="app-wrapper">
    <header class="app-header">
      <div class="header-inner">
        <div class="header-left">
          <router-link to="/" class="logo-link">
            <svg class="logo-icon" viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="8" cy="17" rx="3" ry="3" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
              <ellipse cx="32" cy="17" rx="3" ry="3" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
              <path d="M4 13 Q6 8 20 8 Q34 8 36 13" fill="none" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span class="logo-text">SKATE ZONE</span>
          </router-link>
        </div>

        <el-menu
          v-if="userStore.user?.role !== 'coach'"
          :default-active="activeMenu"
          mode="horizontal"
          class="nav-menu"
          :ellipsis="false"
          router
        >
          <el-menu-item index="/">首页</el-menu-item>
          <el-menu-item index="/booking">预约场地</el-menu-item>
          <el-menu-item index="/my-bookings">我的预约</el-menu-item>
          <el-menu-item index="/equipment">装备租赁</el-menu-item>
          <el-menu-item index="/locker">储物柜</el-menu-item>
          <el-menu-item index="/profile">个人中心</el-menu-item>
          <el-menu-item v-if="userStore.user?.role === 'admin'" index="/admin">后台管理</el-menu-item>
        </el-menu>

        <el-menu
          v-else
          :default-active="activeMenu"
          mode="horizontal"
          class="nav-menu"
          :ellipsis="false"
          router
        >
          <el-menu-item index="/coach">工作台</el-menu-item>
          <el-menu-item index="/coach/schedule">我的课表</el-menu-item>
          <el-menu-item index="/coach/students">学员管理</el-menu-item>
          <el-menu-item index="/coach/stats">课时统计</el-menu-item>
          <el-menu-item index="/coach/profile">个人资料</el-menu-item>
          <el-menu-item index="/coach/preferences">时段偏好</el-menu-item>
        </el-menu>

        <div class="header-right">
          <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge">
            <el-icon :size="22" class="bell-icon" @click="handleNotification">
              <Bell />
            </el-icon>
          </el-badge>

          <template v-if="userStore.isLoggedIn">
            <el-dropdown trigger="click" @command="handleCommand">
              <span class="user-dropdown">
                <el-avatar :size="32" class="user-avatar">
                  {{ userStore.user?.username?.charAt(0)?.toUpperCase() }}
                </el-avatar>
                <span class="user-name">{{ userStore.user?.username }}</span>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <template v-if="userStore.user?.role === 'coach'">
                    <el-dropdown-item command="/coach">工作台</el-dropdown-item>
                    <el-dropdown-item command="/coach/schedule">我的课表</el-dropdown-item>
                    <el-dropdown-item command="/coach/students">学员管理</el-dropdown-item>
                    <el-dropdown-item command="/coach/stats">课时统计</el-dropdown-item>
                    <el-dropdown-item command="/coach/profile">个人资料</el-dropdown-item>
                  </template>
                  <template v-else>
                    <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                    <el-dropdown-item command="my-bookings">我的预约</el-dropdown-item>
                  </template>
                  <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <div class="auth-buttons">
              <el-button type="primary" size="small" @click="$router.push('/login')">登录</el-button>
              <el-button size="small" @click="$router.push('/register')">注册</el-button>
            </div>
          </template>
        </div>
      </div>
    </header>

    <main class="app-main">
      <router-view />
    </main>

    <footer class="app-footer">
      <p>&copy; 2026 SKATE ZONE. All rights reserved.</p>
    </footer>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell } from '@element-plus/icons-vue'
import { useUserStore } from './stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeMenu = computed(() => route.path)
const unreadCount = ref(0)

onMounted(async () => {
  if (userStore.isLoggedIn) {
    try {
      await userStore.fetchProfile()
    } catch (e) {
      // ignore
    }
  }
})

function handleCommand(command) {
  if (command === 'logout') {
    userStore.logout()
    router.push('/login')
  } else if (command.startsWith('/')) {
    router.push(command)
  } else {
    router.push(`/${command}`)
  }
}

function handleNotification() {
  if (userStore.isLoggedIn) {
    router.push('/profile')
  }
}
</script>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background: #2C2C2C;
  border-bottom: 2px solid #00E5FF;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: 60px;
  gap: 8px;
}

.header-left {
  flex-shrink: 0;
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.logo-icon {
  width: 40px;
  height: 20px;
}

.logo-text {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #00E5FF;
  text-shadow: 0 0 10px rgba(0, 229, 255, 0.4);
}

.nav-menu {
  flex: 1;
  background: transparent;
  border-bottom: none !important;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: #ccc;
  --el-menu-active-color: #00E5FF;
  --el-menu-hover-bg-color: rgba(0, 229, 255, 0.1);
  --el-menu-hover-text-color: #00E5FF;
}

.nav-menu .el-menu-item {
  border-bottom: none !important;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.notification-badge {
  cursor: pointer;
}

.bell-icon {
  color: #ccc;
  cursor: pointer;
  transition: color 0.2s;
}

.bell-icon:hover {
  color: #00E5FF;
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #ccc;
}

.user-dropdown:hover {
  color: #00E5FF;
}

.user-avatar {
  background: #00B8D4;
  color: #fff;
  font-weight: 700;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
}

.auth-buttons {
  display: flex;
  gap: 8px;
}

.app-main {
  flex: 1;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
}

.app-footer {
  background: #2C2C2C;
  text-align: center;
  padding: 16px;
  color: #888;
  font-size: 13px;
  border-top: 1px solid #3A3A3A;
}

@media (max-width: 768px) {
  .header-inner {
    padding: 0 12px;
    gap: 4px;
  }

  .logo-text {
    font-size: 16px;
  }

  .nav-menu {
    display: none;
  }

  .user-name {
    display: none;
  }
}
</style>
