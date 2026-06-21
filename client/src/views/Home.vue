<template>
  <div class="home-page">
    <section class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title glow-text">SKATE ZONE</h1>
        <p class="hero-subtitle">室内滑板场馆 · 极致体验</p>
        <button class="cyber-btn hero-cta" @click="$router.push('/booking')">
          <span>立即预约</span>
        </button>
      </div>
      <div class="hero-illustration">
        <svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg">
          <path d="M40 220 L120 140 L200 180 L280 100 L360 160" fill="none" stroke="#00E5FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
          <path d="M60 240 Q100 180 160 200 Q220 220 280 160 Q320 120 360 140" fill="none" stroke="#00E5FF" stroke-width="2" stroke-dasharray="8 4" opacity="0.3"/>
          <rect x="140" y="180" width="120" height="16" rx="8" fill="#3A3A3A" stroke="#00E5FF" stroke-width="1.5"/>
          <circle cx="155" cy="204" r="10" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
          <circle cx="155" cy="204" r="4" fill="#00E5FF" opacity="0.5"/>
          <circle cx="245" cy="204" r="10" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
          <circle cx="245" cy="204" r="4" fill="#00E5FF" opacity="0.5"/>
          <path d="M80 260 L200 260 L320 260" stroke="#3A3A3A" stroke-width="2"/>
          <path d="M100 120 L160 60 L220 100" fill="none" stroke="#00E5FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
          <path d="M60 260 Q160 180 260 260" fill="rgba(0,229,255,0.05)" stroke="#00E5FF" stroke-width="1.5" opacity="0.4"/>
          <circle cx="200" cy="80" r="6" fill="#00E5FF" opacity="0.2"/>
          <circle cx="300" cy="60" r="4" fill="#00E5FF" opacity="0.15"/>
          <circle cx="100" cy="100" r="3" fill="#00E5FF" opacity="0.1"/>
        </svg>
      </div>
    </section>

    <section class="features-section">
      <h2 class="section-title glow-text">我们的服务</h2>
      <div class="features-grid">
        <div class="skate-card feature-card">
          <svg class="feature-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="8" width="36" height="28" rx="4" fill="none" stroke="#00E5FF" stroke-width="2"/>
            <line x1="14" y1="20" x2="34" y2="20" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
            <line x1="14" y1="26" x2="28" y2="26" stroke="#00E5FF" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
            <circle cx="24" cy="40" r="3" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
          </svg>
          <h3>时段预约</h3>
          <p>灵活选择场地时段，畅享滑板乐趣</p>
        </div>
        <div class="skate-card feature-card">
          <svg class="feature-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="16" r="8" fill="none" stroke="#00E5FF" stroke-width="2"/>
            <path d="M10 40 Q10 28 24 28 Q38 28 38 40" fill="none" stroke="#00E5FF" stroke-width="2"/>
            <path d="M30 18 L36 12" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
            <circle cx="38" cy="10" r="3" fill="none" stroke="#00E5FF" stroke-width="1.5"/>
          </svg>
          <h3>私教课程</h3>
          <p>专业教练一对一指导，快速进阶</p>
        </div>
        <div class="skate-card feature-card">
          <svg class="feature-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="12" width="32" height="24" rx="3" fill="none" stroke="#00E5FF" stroke-width="2"/>
            <line x1="8" y1="22" x2="40" y2="22" stroke="#00E5FF" stroke-width="1.5"/>
            <circle cx="18" cy="30" r="2.5" fill="#00E5FF" opacity="0.5"/>
            <circle cx="30" cy="30" r="2.5" fill="#00E5FF" opacity="0.5"/>
          </svg>
          <h3>装备租赁</h3>
          <p>高品质滑板装备，随时租赁</p>
        </div>
      </div>
    </section>

    <section class="pricing-section">
      <h2 class="section-title glow-text">价格方案</h2>
      <div class="pricing-grid">
        <el-card shadow="hover" class="pricing-card">
          <template #header>
            <div class="pricing-header">
              <h3>工作日</h3>
              <span class="pricing-tag">周一至周五</span>
            </div>
          </template>
          <div class="pricing-body">
            <div class="pricing-price">
              <span class="price-amount">¥60</span>
              <span class="price-unit">/时段</span>
            </div>
            <ul class="pricing-list">
              <li>散客场自由滑行</li>
              <li>基础装备使用</li>
              <li>场地保险</li>
            </ul>
          </div>
        </el-card>
        <el-card shadow="hover" class="pricing-card pricing-card--weekend">
          <template #header>
            <div class="pricing-header">
              <h3>周末及假日</h3>
              <span class="pricing-tag">周六周日</span>
            </div>
          </template>
          <div class="pricing-body">
            <div class="pricing-price">
              <span class="price-amount">¥90</span>
              <span class="price-unit">/时段</span>
            </div>
            <ul class="pricing-list">
              <li>散客场自由滑行</li>
              <li>基础装备使用</li>
              <li>场地保险</li>
              <li>免费饮品</li>
            </ul>
          </div>
        </el-card>
      </div>
    </section>

    <section class="cta-section">
      <div class="cta-content skate-card">
        <h2>加入我们，开启滑板之旅</h2>
        <button class="cyber-btn" @click="$router.push('/register')">
          <span>立即注册</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
</script>

<style scoped>
.home-page {
  animation: slide-up 0.6s ease;
}

.hero-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 60px 0 40px;
  gap: 40px;
}

.hero-content {
  flex: 1;
}

.hero-title {
  font-size: 64px;
  font-weight: 900;
  letter-spacing: 8px;
  margin-bottom: 16px;
}

.hero-subtitle {
  font-size: 20px;
  color: #999;
  margin-bottom: 32px;
  letter-spacing: 4px;
}

.hero-cta {
  padding: 14px 40px;
  font-size: 16px;
}

.hero-illustration {
  flex-shrink: 0;
  width: 400px;
  height: 280px;
}

.hero-illustration svg {
  width: 100%;
  height: 100%;
}

.section-title {
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 36px;
  letter-spacing: 2px;
}

.features-section {
  padding: 60px 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.feature-card {
  text-align: center;
}

.feature-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
}

.feature-card h3 {
  font-size: 18px;
  margin-bottom: 8px;
  color: #00E5FF;
}

.feature-card p {
  font-size: 14px;
  color: #999;
}

.pricing-section {
  padding: 60px 0;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  max-width: 720px;
  margin: 0 auto;
}

.pricing-card {
  background: #2C2C2C;
  color: #F5F7FA;
}

.pricing-card :deep(.el-card__header) {
  border-bottom-color: #3A3A3A;
  padding: 16px 20px;
}

.pricing-card :deep(.el-card__body) {
  padding: 20px;
}

.pricing-header {
  text-align: center;
}

.pricing-header h3 {
  font-size: 20px;
  color: #00E5FF;
  margin-bottom: 4px;
}

.pricing-tag {
  font-size: 13px;
  color: #888;
}

.pricing-body {
  text-align: center;
}

.pricing-price {
  margin-bottom: 20px;
}

.price-amount {
  font-size: 40px;
  font-weight: 800;
  color: #00E5FF;
}

.price-unit {
  font-size: 14px;
  color: #888;
  margin-left: 4px;
}

.pricing-list {
  list-style: none;
  padding: 0;
  text-align: left;
}

.pricing-list li {
  padding: 8px 0;
  font-size: 14px;
  color: #ccc;
  border-bottom: 1px solid #3A3A3A;
}

.pricing-list li:last-child {
  border-bottom: none;
}

.pricing-card--weekend {
  border: 1px solid #00E5FF;
}

.cta-section {
  padding: 60px 0;
}

.cta-content {
  text-align: center;
  padding: 48px;
}

.cta-content h2 {
  font-size: 24px;
  color: #F5F7FA;
  margin-bottom: 24px;
}

@media (max-width: 768px) {
  .hero-section {
    flex-direction: column;
    text-align: center;
    padding: 40px 0 20px;
  }

  .hero-title {
    font-size: 36px;
    letter-spacing: 4px;
  }

  .hero-subtitle {
    font-size: 16px;
  }

  .hero-illustration {
    width: 280px;
    height: 200px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .pricing-grid {
    grid-template-columns: 1fr;
  }
}
</style>
