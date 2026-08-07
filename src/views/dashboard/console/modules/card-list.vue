<template>
  <ElRow :gutter="20" class="flex">
    <ElCol v-for="(item, index) in dataList" :key="index" :sm="12" :md="6" :lg="6">
      <div class="art-card relative flex flex-col justify-center h-35 px-5 mb-5 max-sm:mb-4">
        <span class="text-g-700 text-sm">{{ item.des }}</span>
        <ArtCountTo class="text-[26px] font-medium mt-2" :target="item.num" :duration="1300" />
        <div class="flex-c mt-1">
          <span class="text-xs text-g-600">{{ statsTime }}</span>
        </div>
        <div
          class="absolute top-0 bottom-0 right-5 m-auto size-12.5 rounded-xl flex-cc bg-theme/10"
        >
          <ArtSvgIcon :icon="item.icon" class="text-xl text-theme" />
        </div>
      </div>
    </ElCol>
  </ElRow>
</template>

<script setup lang="ts">
  import { getSystemStats } from '@/api/monitor'

  interface CardDataItem {
    des: string
    icon: string
    num: number
  }

  /**
   * 卡片统计数据（v_system_stats 真实数据，§2.5 dashboard 修正）
   * 展示租户数、活跃用户、用户总数、角色数等核心指标
   */
  const dataList = reactive<CardDataItem[]>([
    { des: '租户数', icon: 'ri:building-line', num: 0 },
    { des: '活跃用户', icon: 'ri:group-line', num: 0 },
    { des: '用户总数', icon: 'ri:user-3-line', num: 0 },
    { des: '角色数', icon: 'ri:shield-user-line', num: 0 }
  ])

  const statsTime = ref('')

  onMounted(async () => {
    try {
      const stats = await getSystemStats()
      if (stats) {
        dataList[0].num = stats.total_tenants
        dataList[1].num = stats.active_users
        dataList[2].num = stats.total_users
        dataList[3].num = stats.total_roles
        statsTime.value = `统计时间 ${(stats.stats_time || '').replace('T', ' ').slice(0, 19)}`
      }
    } catch (error) {
      console.warn('加载系统统计失败:', error)
    }
  })
</script>
