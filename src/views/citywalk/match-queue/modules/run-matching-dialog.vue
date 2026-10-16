<!-- 运行匹配对话框（run_source_matching：provider + mca 区县过滤 + R3 阈值调参）
  交互流程（设计文档 §5.5 拍板）：数据源更新 → 前端点击匹配 → 后端运行 → 队列复查 -->
<template>
  <ElDialog
    :model-value="modelValue"
    title="运行匹配引擎"
    width="480px"
    @update:model-value="emit('update:modelValue', $event)"
    @open="resetForm"
  >
    <el-form :model="form" label-width="130px">
      <el-form-item label="数据源">
        <el-radio-group v-model="form.provider">
          <el-radio-button value="mca">mca（国家地名信息库）</el-radio-button>
          <el-radio-button value="osm">osm</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="区县码（可选）">
        <el-input
          v-model="form.districtCode"
          placeholder="仅 mca 有效，如 110101（北京东城）；空=全量"
          clearable
          :disabled="form.provider !== 'mca'"
        />
        <div class="el-form-item__tip">
          首跑建议先填一个区县试水调参；全量 9 万行级务必分批（每次调用一个事务）
        </div>
      </el-form-item>
      <el-form-item label="R3 距离阈值 (m)">
        <el-input-number v-model="form.distanceM" :min="50" :max="2000" :step="50" />
      </el-form-item>
      <el-form-item label="R3 相似度阈值">
        <el-input-number
          v-model="form.simThreshold"
          :min="0.1"
          :max="0.9"
          :step="0.05"
          :precision="2"
        />
      </el-form-item>
    </el-form>

    <!-- 运行结果统计 -->
    <el-result
      v-if="result"
      icon="success"
      :title="`匹配完成：${result.provider}`"
      class="run-result"
    >
      <template #sub-title>
        <div class="result-grid">
          <span>纳入 {{ result.total }}</span>
          <span>跳过 {{ result.skipped }}</span>
          <span>自动绑定 {{ result.auto_bound }}</span>
          <span>待审 {{ result.pending }}</span>
          <span>无候选 {{ result.no_match }}</span>
        </div>
      </template>
    </el-result>

    <template #footer>
      <ElButton @click="emit('update:modelValue', false)">关闭</ElButton>
      <ElButton type="primary" :loading="running" :disabled="!!result" @click="handleRun">
        运行匹配
      </ElButton>
      <ElButton v-if="result" type="success" @click="emit('refresh')">刷新队列</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { runSourceMatching } from '@/api/citywalk'

  interface Props {
    modelValue: boolean
  }
  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'refresh'): void
  }
  defineProps<Props>()
  const emit = defineEmits<Emits>()

  const defaultForm = () => ({
    provider: 'mca' as Api.Citywalk.MatchProvider,
    districtCode: '',
    distanceM: 200,
    simThreshold: 0.3
  })
  const form = ref(defaultForm())
  const running = ref(false)
  const result = ref<Api.Citywalk.RunMatchingResult | null>(null)

  const resetForm = () => {
    form.value = defaultForm()
    result.value = null
  }

  const handleRun = async () => {
    running.value = true
    try {
      result.value = await runSourceMatching(form.value.provider, {
        districtCode: form.value.districtCode || undefined,
        distanceM: form.value.distanceM,
        simThreshold: form.value.simThreshold
      })
      ElMessage.success('匹配运行完成，结果已入队列')
    } catch (error) {
      console.error('运行匹配失败:', error)
    } finally {
      running.value = false
    }
  }
</script>

<style lang="scss" scoped>
  .el-form-item__tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
    margin-top: 4px;
  }
  .result-grid {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    font-size: 13px;
  }
  .run-result {
    :deep(.el-result__title) {
      font-size: 15px;
    }
  }
</style>
