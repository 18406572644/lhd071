import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isLoggedIn = computed(() => !!token.value && !!user.value)

  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials)
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }

  async function register(registerData) {
    await api.post('/auth/register', registerData)
    const { data } = await api.post('/auth/login', {
      username: registerData.username,
      password: registerData.password,
    })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }

  async function fetchProfile() {
    const { data } = await api.get('/auth/profile')
    user.value = data.user
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  async function recharge(amount) {
    const { data } = await api.post('/members/recharge', { amount })
    user.value.balance = data.balance
    user.value.points = data.points
    localStorage.setItem('user', JSON.stringify(user.value))
    return data
  }

  return {
    token,
    user,
    isLoggedIn,
    login,
    register,
    fetchProfile,
    logout,
    recharge,
  }
})
