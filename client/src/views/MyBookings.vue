<template>
  <div class="my-bookings-page">
    <h2 class="page-title glow-text">我的预约</h2>

    <el-tabs v-model="activeTab" class="booking-tabs">
      <el-tab-pane label="全部" name="all" />
      <el-tab-pane label="待支付" name="pending" />
      <el-tab-pane label="已支付" name="paid" />
      <el-tab-pane label="已签到" name="checked_in" />
      <el-tab-pane label="已取消" name="cancelled" />
    </el-tabs>

    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>

    <div v-else-if="filteredBookings.length === 0" class="empty-state">
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" class="empty-svg">
        <rect x="30" y="60" width="60" height="10" rx="5" fill="#3A3A3A" stroke="#00E5FF" stroke-width="1" opacity="0.5"/>
        <circle cx="40" cy="75" r="6" fill="none" stroke="#00E5FF" stroke-width="1" opacity="0.5"/>
        <circle cx="80" cy="75" r="6" fill="none" stroke="#00E5FF" stroke-width="1" opacity="0.5"/>
        <path d="M30 55 Q60 40 90 55" fill="none" stroke="#00E5FF" stroke-width="1.5" opacity="0.3"/>
      </svg>
      <p>暂无预约记录</p>
    </div>

    <div v-else class="bookings-list">
      <div v-for="booking in filteredBookings" :key="booking.id" class="skate-card booking-item">
        <div class="booking-main">
          <div class="booking-info">
            <div class="booking-date">{{ booking.booking_date }}</div>
            <div class="booking-time">{{ booking.start_time }} - {{ booking.end_time }}</div>
          </div>
          <div class="booking-meta">
            <el-tag :type="tagType(booking.status)" size="small">{{ statusLabel(booking.status) }}</el-tag>
            <span class="booking-type">{{ booking.type === 'venue' ? '散客场' : '私教课' }}</span>
            <span v-if="booking.coach_name" class="booking-coach">教练: {{ booking.coach_name }}</span>
          </div>
          <div class="booking-amount glow-text">¥{{ booking.amount }}</div>
        </div>
        <div class="booking-actions">
          <el-button v-if="booking.status === 'pending'" type="primary" size="small" @click="openPayDialog(booking)">支付</el-button>
          <el-button v-if="booking.status === 'paid'" size="small" @click="handleCancel(booking)">取消</el-button>
          <el-button v-if="booking.status === 'paid' && isToday(booking.booking_date)" type="success" size="small" @click="handleCheckin(booking)">签到</el-button>
          <el-button v-if="booking.status === 'paid'" size="small" @click="showQrcode(booking)">
            <el-icon><Picture /></el-icon>
            <span>签到码</span>
          </el-button>
          <el-button v-if="booking.status === 'checked_in' && !booking.review" type="warning" size="small" @click="openReviewDialog(booking)">
            去评价
          </el-button>
          <el-button v-if="booking.status === 'checked_in' && booking.review" size="small" @click="viewReview(booking)">
            查看评价
          </el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="payDialogVisible" title="确认支付" width="400px">
      <div class="pay-dialog-body">
        <div class="pay-row">
          <span>支付金额</span>
          <span class="glow-text">¥{{ payBooking?.amount }}</span>
        </div>
        <div class="pay-row">
          <span>账户余额</span>
          <span>¥{{ userStore.user?.balance || 0 }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="payDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="paying" @click="handlePay">确认支付</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="qrcodeDialogVisible" title="签到二维码" width="400px" align-center>
      <div v-if="qrcodeLoading" class="qrcode-loading">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>生成二维码中...</p>
      </div>
      <div v-else-if="qrcodeData" class="qrcode-content">
        <div class="qrcode-img-wrapper">
          <img :src="qrcodeData.qrcode" alt="签到二维码" class="qrcode-img" />
        </div>
        <div class="qrcode-info">
          <div class="qrcode-info-item">
            <span class="label">预约日期</span>
            <span class="value">{{ qrcodeData.booking.booking_date }}</span>
          </div>
          <div class="qrcode-info-item">
            <span class="label">时段</span>
            <span class="value">{{ qrcodeData.booking.start_time }} - {{ qrcodeData.booking.end_time }}</span>
          </div>
          <div class="qrcode-info-item">
            <span class="label">类型</span>
            <span class="value">{{ qrcodeData.booking.type === 'venue' ? '散客场' : '私教课' }}</span>
          </div>
          <div v-if="qrcodeData.booking.coach_name" class="qrcode-info-item">
            <span class="label">教练</span>
            <span class="value">{{ qrcodeData.booking.coach_name }}</span>
          </div>
          <div class="qrcode-info-item">
            <span class="label">状态</span>
            <el-tag :type="tagType(qrcodeData.booking.status)" size="small">{{ statusLabel(qrcodeData.booking.status) }}</el-tag>
          </div>
        </div>
        <p class="qrcode-tip">请向工作人员出示此二维码完成签到</p>
      </div>
    </el-dialog>

    <el-dialog v-model="reviewDialogVisible" title="评价" width="600px">
      <div v-if="reviewLoading" class="review-loading">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      </div>
      <div v-else-if="isViewingReview && currentReview" class="review-view">
        <div class="review-header">
          <div class="review-rating">
            <el-rate v-model="currentReview.rating" disabled />
            <span class="rating-text">{{ currentReview.rating }}分</span>
          </div>
          <el-tag v-if="currentReview.is_featured" type="warning" size="small">优质评价</el-tag>
        </div>
        <div class="review-tags">
          <el-tag v-for="tag in currentReview.tags" :key="tag.id" size="small" class="review-tag">
            {{ tag.name }}
          </el-tag>
        </div>
        <div class="review-content">{{ currentReview.review }}</div>
        <div v-if="currentReview.images && currentReview.images.length > 0" class="review-images">
          <el-image
            v-for="(img, index) in currentReview.images"
            :key="index"
            :src="img.image_url"
            :preview-src-list="currentReview.images.map(i => i.image_url)"
            :initial-index="index"
            fit="cover"
            class="review-image"
          />
        </div>
        <div v-if="currentReview.reply" class="review-reply">
          <div class="reply-header">
            <span class="reply-label">教练回复</span>
            <span class="reply-time">{{ currentReview.reply.created_at }}</span>
          </div>
          <div class="reply-content">{{ currentReview.reply.content }}</div>
        </div>
      </div>
      <div v-else class="review-form">
        <el-form :model="reviewForm" label-position="top">
          <el-form-item label="评分">
            <el-rate v-model="reviewForm.rating" />
          </el-form-item>
          <el-form-item label="评价标签">
            <div class="tag-selector">
              <el-tag
                v-for="tag in reviewTags"
                :key="tag.id"
                :type="selectedTagIds.includes(tag.id) ? 'primary' : 'info'"
                size="large"
                class="tag-item"
                @click="toggleTag(tag.id)"
              >
                {{ tag.name }}
              </el-tag>
            </div>
          </el-form-item>
          <el-form-item label="评价内容">
            <el-input
              v-model="reviewForm.review"
              type="textarea"
              :rows="4"
              placeholder="分享您的体验..."
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="上传图片">
            <div class="upload-area">
              <div v-for="(img, index) in uploadedImages" :key="index" class="uploaded-image">
                <img :src="img" alt="评价图片" class="uploaded-img" />
                <el-button
                  type="danger"
                  size="small"
                  circle
                  class="remove-img-btn"
                  @click="removeImage(index)"
                >
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
              <label v-if="uploadedImages.length < 9" class="upload-btn">
                <el-icon :size="24"><Plus /></el-icon>
                <span>上传图片</span>
                <input
                  ref="imageInputRef"
                  type="file"
                  accept="image/*"
                  multiple
                  style="display: none"
                  @change="handleImageUpload"
                />
              </label>
            </div>
            <div class="upload-tip">最多上传9张图片，支持JPG、PNG格式</div>
          </el-form-item>
        </el-form>
      </div>
      <template #footer v-if="!isViewingReview">
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submittingReview" @click="submitReview">提交评价</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useUserStore } from '../stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading, Picture, Plus, Close } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const userStore = useUserStore()

const activeTab = ref('all')
const bookings = ref([])
const loading = ref(false)
const payDialogVisible = ref(false)
const payBooking = ref(null)
const paying = ref(false)

const qrcodeDialogVisible = ref(false)
const qrcodeLoading = ref(false)
const qrcodeData = ref(null)

const reviewDialogVisible = ref(false)
const reviewLoading = ref(false)
const isViewingReview = ref(false)
const currentBooking = ref(null)
const currentReview = ref(null)
const submittingReview = ref(false)
const reviewTags = ref([])
const selectedTagIds = ref([])
const uploadedImages = ref([])
const imageInputRef = ref(null)

const reviewForm = ref({
  rating: 5,
  review: ''
})

const filteredBookings = computed(() => {
  if (activeTab.value === 'all') return bookings.value
  return bookings.value.filter(b => b.status === activeTab.value)
})

function statusLabel(status) {
  const map = { pending: '待支付', paid: '已支付', checked_in: '已签到', cancelled: '已取消' }
  return map[status] || status
}

function tagType(status) {
  const map = { pending: 'warning', paid: 'success', checked_in: '', cancelled: 'info' }
  return map[status] || ''
}

function isToday(date) {
  return dayjs(date).isSame(dayjs(), 'day')
}

function openPayDialog(booking) {
  payBooking.value = booking
  payDialogVisible.value = true
}

async function handlePay() {
  if (!payBooking.value) return
  paying.value = true
  try {
    await api.post(`/bookings/${payBooking.value.id}/pay`)
    ElMessage.success('支付成功')
    payDialogVisible.value = false
    fetchBookings()
    userStore.fetchProfile()
  } catch {
  } finally {
    paying.value = false
  }
}

async function handleCancel(booking) {
  try {
    await ElMessageBox.confirm('确定取消该预约吗？', '提示', { type: 'warning' })
    await api.put(`/bookings/${booking.id}/cancel`)
    ElMessage.success('已取消')
    fetchBookings()
  } catch {
  }
}

async function handleCheckin(booking) {
  try {
    await api.post('/checkins', { booking_id: booking.id })
    ElMessage.success('签到成功')
    fetchBookings()
  } catch {
  }
}

async function showQrcode(booking) {
  qrcodeDialogVisible.value = true
  qrcodeLoading.value = true
  qrcodeData.value = null
  try {
    const { data } = await api.get(`/bookings/${booking.id}/qrcode`)
    qrcodeData.value = data
  } catch (e) {
    ElMessage.error('二维码生成失败')
    qrcodeDialogVisible.value = false
  } finally {
    qrcodeLoading.value = false
  }
}

async function loadReviewTags() {
  try {
    const { data } = await api.get('/bookings/review/tags')
    reviewTags.value = data.tags || []
  } catch {
    reviewTags.value = []
  }
}

function toggleTag(tagId) {
  const index = selectedTagIds.value.indexOf(tagId)
  if (index > -1) {
    selectedTagIds.value.splice(index, 1)
  } else {
    selectedTagIds.value.push(tagId)
  }
}

async function openReviewDialog(booking) {
  currentBooking.value = booking
  isViewingReview.value = false
  reviewForm.value = { rating: 5, review: '' }
  selectedTagIds.value = []
  uploadedImages.value = []
  reviewDialogVisible.value = true
  await loadReviewTags()
}

async function viewReview(booking) {
  currentBooking.value = booking
  isViewingReview.value = true
  reviewLoading.value = true
  reviewDialogVisible.value = true
  try {
    const { data } = await api.get(`/bookings/${booking.id}/review`)
    currentReview.value = data.review
  } catch {
  } finally {
    reviewLoading.value = false
  }
}

function handleImageUpload(event) {
  const files = event.target.files
  if (!files || files.length === 0) return
  const remainingSlots = 9 - uploadedImages.value.length
  const filesToProcess = Array.from(files).slice(0, remainingSlots)
  
  filesToProcess.forEach(file => {
    if (!file.type.startsWith('image/')) {
      ElMessage.warning('请选择图片文件')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      uploadedImages.value.push(e.target.result)
    }
    reader.readAsDataURL(file)
  })
  
  if (imageInputRef.value) {
    imageInputRef.value.value = ''
  }
}

function removeImage(index) {
  uploadedImages.value.splice(index, 1)
}

async function submitReview() {
  if (!currentBooking.value) return
  
  if (!reviewForm.value.rating) {
    ElMessage.warning('请选择评分')
    return
  }
  
  if (uploadedImages.value.length > 0) {
    submittingReview.value = true
    try {
      for (const imageDataUrl of uploadedImages.value) {
        const formData = new FormData()
        const blob = dataURLtoBlob(imageDataUrl)
        formData.append('image', blob, 'review-image.jpg')
        await api.post(`/bookings/${currentBooking.value.id}/review/image`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      }
    } catch (e) {
      submittingReview.value = false
      ElMessage.error('图片上传失败')
      return
    }
    submittingReview.value = false
  }
  
  submittingReview.value = true
  try {
    await api.post(`/bookings/${currentBooking.value.id}/review`, {
      rating: reviewForm.value.rating,
      review: reviewForm.value.review,
      tag_ids: selectedTagIds.value
    })
    ElMessage.success('评价提交成功')
    reviewDialogVisible.value = false
    fetchBookings()
  } catch {
  } finally {
    submittingReview.value = false
  }
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

async function fetchBookings() {
  loading.value = true
  try {
    const { data } = await api.get('/bookings')
    bookings.value = data.bookings || []
  } catch {
    bookings.value = []
  } finally {
    loading.value = false
  }
}

onMounted(fetchBookings)
</script>

<style scoped>
.my-bookings-page {
  animation: slide-up 0.5s ease;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 20px;
  letter-spacing: 2px;
}

.booking-tabs {
  margin-bottom: 20px;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 60px;
  color: #00E5FF;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #888;
}

.empty-svg {
  width: 120px;
  height: 100px;
  margin-bottom: 16px;
}

.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.booking-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.booking-main {
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 1;
  flex-wrap: wrap;
}

.booking-info {
  min-width: 120px;
}

.booking-date {
  font-size: 15px;
  font-weight: 600;
  color: #F5F7FA;
}

.booking-time {
  font-size: 13px;
  color: #888;
}

.booking-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.booking-type {
  font-size: 13px;
  color: #ccc;
}

.booking-coach {
  font-size: 13px;
  color: #888;
}

.booking-amount {
  font-size: 20px;
  font-weight: 700;
}

.booking-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.booking-actions .el-button {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pay-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pay-row {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
}

.qrcode-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  gap: 16px;
  color: #888;
}

.qrcode-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.qrcode-img-wrapper {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.qrcode-img {
  width: 250px;
  height: 250px;
  display: block;
}

.qrcode-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 20px;
}

.qrcode-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.qrcode-info-item .label {
  color: #888;
}

.qrcode-info-item .value {
  color: #F5F7FA;
  font-weight: 500;
}

.qrcode-tip {
  color: #666;
  font-size: 13px;
  text-align: center;
}

.review-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.review-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.review-rating {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rating-text {
  font-size: 18px;
  font-weight: 600;
  color: #F5F7FA;
}

.review-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.review-tag {
  margin: 0;
}

.review-content {
  font-size: 14px;
  line-height: 1.6;
  color: #ccc;
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.review-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.review-image {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  cursor: pointer;
}

.review-reply {
  margin-top: 16px;
  padding: 16px;
  background: rgba(0, 229, 255, 0.05);
  border: 1px solid rgba(0, 229, 255, 0.2);
  border-radius: 8px;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.reply-label {
  color: #00E5FF;
  font-weight: 600;
  font-size: 14px;
}

.reply-time {
  color: #666;
  font-size: 12px;
}

.reply-content {
  color: #ccc;
  font-size: 14px;
  line-height: 1.6;
}

.tag-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-item {
  cursor: pointer;
  margin: 0;
  transition: all 0.3s ease;
}

.upload-area {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.uploaded-image {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
}

.uploaded-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-img-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  padding: 2px;
  width: 20px;
  height: 20px;
}

.upload-btn {
  width: 80px;
  height: 80px;
  border: 2px dashed #444;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #666;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-btn:hover {
  border-color: #00E5FF;
  color: #00E5FF;
}

.upload-btn span {
  font-size: 11px;
}

.upload-tip {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

@media (max-width: 768px) {
  .booking-main {
    gap: 12px;
  }
  
  .booking-info {
    min-width: auto;
  }
  
  .booking-amount {
    font-size: 16px;
  }
  
  .booking-actions {
    width: 100%;
    justify-content: flex-start;
  }
  
  .qrcode-img {
    width: 200px;
    height: 200px;
  }
}
</style>
