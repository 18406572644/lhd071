import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
  },
  {
    path: '/booking',
    name: 'Booking',
    component: () => import('../views/Booking.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/my-bookings',
    name: 'MyBookings',
    component: () => import('../views/MyBookings.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/equipment',
    name: 'Equipment',
    component: () => import('../views/Equipment.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/locker',
    name: 'Locker',
    component: () => import('../views/Locker.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: () => import('../views/admin/AdminDashboard.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/slots',
    name: 'AdminSlots',
    component: () => import('../views/admin/AdminSlots.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/coaches',
    name: 'AdminCoaches',
    component: () => import('../views/admin/AdminCoaches.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/equipment',
    name: 'AdminEquipment',
    component: () => import('../views/admin/AdminEquipment.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/lockers',
    name: 'AdminLockers',
    component: () => import('../views/admin/AdminLockers.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/bookings',
    name: 'AdminBookings',
    component: () => import('../views/admin/AdminBookings.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/messages',
    name: 'AdminMessages',
    component: () => import('../views/admin/AdminBookings.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/coach',
    name: 'CoachDashboard',
    component: () => import('../views/coach/CoachDashboard.vue'),
    meta: { requiresAuth: true, requiresCoach: true },
  },
  {
    path: '/coach/schedule',
    name: 'CoachSchedule',
    component: () => import('../views/coach/CoachSchedule.vue'),
    meta: { requiresAuth: true, requiresCoach: true },
  },
  {
    path: '/coach/students',
    name: 'CoachStudents',
    component: () => import('../views/coach/CoachStudents.vue'),
    meta: { requiresAuth: true, requiresCoach: true },
  },
  {
    path: '/coach/students/:id',
    name: 'CoachStudentDetail',
    component: () => import('../views/coach/CoachStudentDetail.vue'),
    meta: { requiresAuth: true, requiresCoach: true },
  },
  {
    path: '/coach/stats',
    name: 'CoachStats',
    component: () => import('../views/coach/CoachStats.vue'),
    meta: { requiresAuth: true, requiresCoach: true },
  },
  {
    path: '/coach/profile',
    name: 'CoachProfile',
    component: () => import('../views/coach/CoachProfile.vue'),
    meta: { requiresAuth: true, requiresCoach: true },
  },
  {
    path: '/coach/preferences',
    name: 'CoachPreferences',
    component: () => import('../views/coach/CoachPreferences.vue'),
    meta: { requiresAuth: true, requiresCoach: true },
  },
  {
    path: '/coaches/:id',
    name: 'CoachDetail',
    component: () => import('../views/CoachDetail.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else if (to.meta.requiresAdmin) {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (!user || user.role !== 'admin') {
      next('/')
    } else {
      next()
    }
  } else if (to.meta.requiresCoach) {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (!user || user.role !== 'coach') {
      next('/')
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
