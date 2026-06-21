<template>
  <div class="coach-detail-page">
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>

    <div v-else-if="coach" class="coach-content">
      <div class="coach-header skate-card">
        <div class="coach-avatar">
          {{ coach.name.charAt(0) }}
        </div>
        <div class="coach-info">
          <h1 class="coach-name">{{ coach.name }}</h1>
          <div class="coach-meta">
            <span class="coach-specialty">{{ coach.specialty }}</span>
            <span class="coach-experience">{{ coach.experience }}年教学经验</span>
          </div>
          <div class="coach-stats">
            <div class="stat-item">
              <div class="stat-value">{{ avgRating }}</div>
              <div class="stat-label">平均评分</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ reviewCount }}</div>
              <div class="stat-label">评价数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">¥{{ coach.hourly_rate }}</div>
              <div class="stat-label">课时费</div>
            </div>
          </div>
          <el-button type="primary" size="large" @click="goToBooking">
            预约课程
          </el-button>
        </div>
      </div>

      <div class="coach-bio skate-card">
        <h3 class="section-title">教练简介</h3>
        <p class="bio-text">{{ coach.bio || '暂无简介' }}</p>
      </div>

      <div class="coach-photos skate-card">
        <h3 class="section-title">教学照片</h3>
        <div v-if="photoList.length > 0" class="photo-grid">
          <el-image
            v-for="(photo, index) in photoList"
            :key="index"
            :src="photo"
            :preview-src-list="photoList"
            :initial-index="index"
            fit="cover"
            class="photo-item"
          />
        </div>
        <p v-else class="empty-text">暂无照片</p>
      </div>

      <div class="coach-reviews skate-card">
        <div class="reviews-header">
          <h3 class="section-title">学员评价</h3>
          <el-tabs v-model="reviewTab" class="review-tabs">
            <el-tab-pane label="全部评价" name="all" />
            <el-tab-pane label="优质评价" name="featured" />
          </el-tabs>
        </div>

        <div v-if="reviewsLoading" class="reviews-loading">
          <el-icon class="is-loading" :size="24"><Loading /></el-icon>
        </div>

        <div v-else-if="reviews.length === 0" class="empty-reviews">
          <el-icon :size="48"><ChatDotRound /></el-icon>
          <p>暂无评价</p>
        </div>

        <div v-else class="reviews-list">
          <div v-for="review in reviews" :key="review.id" class="review-item">
            <div class="review-header">
              <div class="review-user">
                <div class="user-avatar">{{ review.username.charAt(0) }}</div>
                <div class="user-info">
                  <div class="username">{{ review.username }}</div>
                  <div class="review-date">{{ review.booking_date }}</div>
                </div>
              </div>
              <div class="review-right">
                <el-tag v-if="review.is_featured" type="warning" size="small" effect="dark">
                  优质
                </el-tag>
                <el-rate v-model="review.rating" disabled size="small" />
              </div>
            </div>

            <div v-if="review.tags && review.tags.length > 0" class="review-tags">
              <el-tag v-for="tag in review.tags" :key="tag.id" size="small" class="review-tag">
                {{ tag.name }}
              </el-tag>
            </div>

            <div class="review-content">{{ review.review }}</div>

            <div v-if="review.images && review.images.length > 0" class="review-images">
              <el-image
                v-for="(img, index) in review.images"
                :key="index"
                :src="img.image_url"
                :preview-src-list="review.images.map(i => i.image_url)"
                :initial-index="index"
                fit="cover"
                class="review-image"
              />
            </div>

            <div v-if="review.reply" class="review-reply">
              <div class="reply-header">
                <span class="reply-label">教练回复</span>
                <span class="reply-time">{{ review.reply.created_at }}</span>
              </div>
              <div class="reply-content">{{ review.reply.content }}</div>
            </div>
          </div>
        </div>

        <div v-if="reviews.length > 0 && hasMore" class="load-more">
          <el-button @click="loadMoreReviews" :loading="loadingMore">
            加载更多
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { ElMessage } from 'element-plus'
import { Loading, ChatDotRound } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const coach = ref(null)
const loading = ref(false)
const photoList = ref([])
const reviews = ref([])
const reviewsLoading = ref(false)
const reviewTab = ref('all')
const reviewPage = ref(1)
const reviewPageSize = ref(5)
const hasMore = ref(false)
const loadingMore = ref(false)

const avgRating = computed(() => {
  if (!coach.value || !coach.value.avg_rating) return '5.0'
  return coach.value.avg_rating.toFixed(1)
})

const reviewCount = computed(() => {
  if (!coach.value || !coach.value.review_count) return 0
  return coach.value.review_count
})

async function loadCoachDetail() {
  loading.value = true
  try {
    const { data } = await api.get(`/coaches/${route.params.id}`)
    coach.value = data.coach
    
    if (data.coach.photos && typeof data.coach.photos === 'string' && data.coach.photos.trim()) {
      const rawPhotos = data.coach.photos.split(',')
      photoList.value = [...new Set(rawPhotos)].filter(p => p && p.trim())
    } else {
      photoList.value = []
    }
  } catch {
    ElMessage.error('教练信息加载失败')
  } finally {
    loading.value = false
  }
}

async function loadReviews() {
  reviewsLoading.value = true
  reviewPage.value = 1
  reviews.value = []
  
  try {
    const params = {
      page: 1,
      pageSize: reviewPageSize.value
    }
    
    if (reviewTab.value === 'featured') {
      params.featured = 'true'
    }
    
    const { data } = await api.get(`/bookings/coach/${route.params.id}/reviews`, { params })
    reviews.value = data.reviews || []
    hasMore.value = data.total > reviewPageSize.value
  } catch {
    reviews.value = []
  } finally {
    reviewsLoading.value = false
  }
}

async function loadMoreReviews() {
  if (loadingMore.value || !hasMore.value) return
  
  loadingMore.value = true
  try {
    const nextPage = reviewPage.value + 1
    const params = {
      page: nextPage,
      pageSize: reviewPageSize.value
    }
    
    if (reviewTab.value === 'featured') {
      params.featured = 'true'
    }
    
    const { data } = await api.get(`/bookings/coach/${route.params.id}/reviews`, { params })
    reviews.value = [...reviews.value, ...(data.reviews || [])]
    reviewPage.value = nextPage
    hasMore.value = data.total > nextPage * reviewPageSize.value
  } catch {
  } finally {
    loadingMore.value = false
  }
}

function goToBooking() {
  router.push({
    path: '/booking',
    query: {
      coach_id: route.params.id,
      type: 'private'
    }
  })
}

watch(reviewTab, () => {
  loadReviews()
})

onMounted(() => {
  loadCoachDetail()
  loadReviews()
})
</script>

<style scoped>
.coach-detail-page {
  animation: slide-up 0.5s ease;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 80px;
  color: #00E5FF;
}

.coach-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.coach-header {
  display: flex;
  gap: 32px;
  padding: 32px;
  align-items: flex-start;
}

.coach-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00E5FF, #0099CC);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 48px;
  flex-shrink: 0;
}

.coach-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.coach-name {
  font-size: 28px;
  font-weight: 700;
  color: #F5F7FA;
  margin: 0;
}

.coach-meta {
  display: flex;
  gap: 16px;
  color: #888;
  font-size: 14px;
}

.coach-stats {
  display: flex;
  gap: 40px;
  padding: 16px 0;
  border-top: 1px solid #333;
  border-bottom: 1px solid #333;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #00E5FF;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #888;
}

.section-title {
  font-size: 18px;
  color: #00E5FF;
  margin: 0 0 16px 0;
  font-weight: 600;
}

.coach-bio {
  padding: 24px;
}

.bio-text {
  font-size: 14px;
  line-height: 1.8;
  color: #ccc;
  margin: 0;
}

.coach-photos {
  padding: 24px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.photo-item {
  width: 100%;
  height: 150px;
  border-radius: 8px;
  cursor: pointer;
}

.empty-text {
  color: #666;
  font-size: 14px;
  text-align: center;
  padding: 20px;
}

.coach-reviews {
  padding: 24px;
}

.reviews-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.reviews-header .section-title {
  margin: 0;
}

.review-tabs {
  margin: 0;
}

.reviews-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
  color: #00E5FF;
}

.empty-reviews {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
  gap: 12px;
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.review-item {
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid #333;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.review-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 16px;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.username {
  font-size: 14px;
  font-weight: 600;
  color: #F5F7FA;
}

.review-date {
  font-size: 12px;
  color: #888;
}

.review-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.review-tag {
  margin: 0;
}

.review-content {
  font-size: 14px;
  line-height: 1.6;
  color: #ccc;
  margin-bottom: 12px;
}

.review-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.review-image {
  width: 80px;
  height: 80px;
  border-radius: 6px;
  cursor: pointer;
}

.review-reply {
  margin-top: 12px;
  padding: 14px;
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
  font-size: 13px;
}

.reply-time {
  color: #666;
  font-size: 12px;
}

.reply-content {
  color: #ccc;
  font-size: 13px;
  line-height: 1.6;
}

.load-more {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .coach-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px;
  }

  .coach-stats {
    justify-content: center;
  }

  .coach-info {
    align-items: center;
  }

  .photo-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .reviews-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>
