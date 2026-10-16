<!-- 景点详情抽屉（v_pois_admin 单行全字段展示；数据准备阶段无写操作） -->
<template>
  <ElDrawer
    :model-value="modelValue"
    :title="place?.name || '景点详情'"
    size="420px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-descriptions v-if="place" :column="1" border size="small">
      <el-descriptions-item label="ID">{{ place.id }}</el-descriptions-item>
      <el-descriptions-item label="名称">{{ place.name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ statusLabel(place.status) }}</el-descriptions-item>
      <el-descriptions-item label="实体 ID">{{ place.entity_id || '-' }}</el-descriptions-item>
      <el-descriptions-item label="Slug">{{ place.slug || '（未发布）' }}</el-descriptions-item>
      <el-descriptions-item label="发布 Slug">
        {{ place.slug_published || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="分类 ID">{{ place.category_id || '-' }}</el-descriptions-item>
      <el-descriptions-item label="区县 ID（district_id）">
        {{ place.district_id ?? '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="父级景点 ID">
        {{ place.parent_place_id || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="纬度">{{ place.latitude ?? '-' }}</el-descriptions-item>
      <el-descriptions-item label="经度">{{ place.longitude ?? '-' }}</el-descriptions-item>
      <el-descriptions-item label="源语言">
        {{ place.source_language_code || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="封面图 URL">
        {{ place.cover_image_url || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="创建时间">
        {{ formatTime(place.created_at) }}
      </el-descriptions-item>
      <el-descriptions-item label="更新时间">
        {{ formatTime(place.updated_at) }}
      </el-descriptions-item>
    </el-descriptions>
  </ElDrawer>
</template>

<script setup lang="ts">
  interface Props {
    modelValue: boolean
    place: Api.Citywalk.Place | null
  }
  interface Emits {
    (e: 'update:modelValue', value: boolean): void
  }
  defineProps<Props>()
  const emit = defineEmits<Emits>()

  const statusLabel = (status: string | null) => {
    if (status === 'Published') return '已发布'
    if (status === 'PendingReview') return '待审核'
    if (status === 'Archived') return '已归档'
    return status || '-'
  }
  const formatTime = (time: string | null) => time?.replace('T', ' ').slice(0, 19) || '-'
</script>
