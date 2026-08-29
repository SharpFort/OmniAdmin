<!-- 审计日志详情弹窗（元信息 + 变更内容：UPDATE 字段级对比高亮差异，INSERT/DELETE 单侧展示） -->
<template>
  <ElDialog
    :model-value="visible"
    title="日志详情"
    width="920px"
    top="6vh"
    @update:model-value="emit('update:visible', $event)"
  >
    <template v-if="log">
      <ElDescriptions :column="3" border size="small">
        <ElDescriptionsItem label="表名">{{ log.table_name || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="操作类型">
          <ElTag :type="OPERATION_TAG[log.operation] || 'info'" size="small">
            {{ log.operation || '操作审计' }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="操作人">{{ log.username || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="租户/组织">
          {{ log.organization_name || log.tenant_name || '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="时间">
          {{ log.created_at?.replace('T', ' ').slice(0, 19) || '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="日志 ID">
          <span class="detail-mono">{{ log.id }}</span>
        </ElDescriptionsItem>
      </ElDescriptions>

      <div class="detail-section-header">
        <span class="detail-section-title">变更内容</span>
        <ElSwitch
          v-if="showDiff && hasUnchanged"
          v-model="onlyChanged"
          size="small"
          active-text="仅看变更字段"
        />
      </div>

      <!-- UPDATE：字段级对比（变更前 | 变更后） -->
      <ElTable
        v-if="showDiff"
        :data="visibleDiffRows"
        size="small"
        border
        max-height="480"
        :row-class-name="diffRowClass"
      >
        <ElTableColumn prop="key" label="字段" width="200" show-overflow-tooltip />
        <ElTableColumn label="变更前" min-width="240">
          <template #default="{ row }">
            <pre class="detail-value" :class="{ 'is-missing': row.before === undefined }">{{
              formatValue(row.before)
            }}</pre>
          </template>
        </ElTableColumn>
        <ElTableColumn label="变更后" min-width="240">
          <template #default="{ row }">
            <pre class="detail-value" :class="{ 'is-missing': row.after === undefined }">{{
              formatValue(row.after)
            }}</pre>
          </template>
        </ElTableColumn>
      </ElTable>

      <!-- INSERT / DELETE / 非对象数据：单侧 JSON 展示 -->
      <template v-else>
        <div v-if="oldText" class="detail-json">
          <div class="detail-json-title">变更前</div>
          <pre class="detail-value">{{ oldText }}</pre>
        </div>
        <div v-if="newText" class="detail-json">
          <div class="detail-json-title">变更后</div>
          <pre class="detail-value">{{ newText }}</pre>
        </div>
        <ElEmpty v-if="!oldText && !newText" description="该记录无变更数据" :image-size="60" />
      </template>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { ElTag, ElSwitch, ElEmpty, ElDescriptions, ElDescriptionsItem } from 'element-plus'

  type AuditLog = Api.SystemManage.AuditLog

  interface Props {
    visible: boolean
    log: AuditLog | null
  }
  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
  }>()

  const OPERATION_TAG: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    INSERT: 'success',
    UPDATE: 'warning',
    DELETE: 'danger'
  }

  const onlyChanged = ref(true)

  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v)

  const isUpdate = computed(() => props.log?.operation === 'UPDATE')

  /** 对比模式：UPDATE 且至少一侧是对象（否则退化为原始 JSON 展示） */
  const showDiff = computed(
    () =>
      isUpdate.value && (isPlainObject(props.log?.old_data) || isPlainObject(props.log?.new_data))
  )

  interface DiffRow {
    key: string
    before: unknown
    after: unknown
    changed: boolean
  }

  /** 字段级对比：两侧 key 的并集，值用 stringify 比对（缺失键 vs null 也会判为变更） */
  const diffRows = computed<DiffRow[]>(() => {
    if (!showDiff.value) return []
    const before = isPlainObject(props.log?.old_data) ? props.log!.old_data : {}
    const after = isPlainObject(props.log?.new_data) ? props.log!.new_data : {}
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    return keys.map((key) => ({
      key,
      before: before[key],
      after: after[key],
      changed: JSON.stringify(before[key]) !== JSON.stringify(after[key])
    }))
  })

  const hasUnchanged = computed(() => diffRows.value.some((row) => !row.changed))

  const visibleDiffRows = computed(() =>
    onlyChanged.value ? diffRows.value.filter((row) => row.changed) : diffRows.value
  )

  const diffRowClass = ({ row }: { row: DiffRow }) => (row.changed ? 'is-changed-row' : '')

  const oldText = computed(() =>
    props.log?.old_data != null ? JSON.stringify(props.log.old_data, null, 2) : ''
  )
  const newText = computed(() =>
    props.log?.new_data != null ? JSON.stringify(props.log.new_data, null, 2) : ''
  )

  const formatValue = (v: unknown): string => {
    if (v === undefined) return '（未设置）'
    if (v === null) return 'null'
    if (typeof v === 'object') return JSON.stringify(v, null, 2)
    if (typeof v === 'string' && v === '') return "''"
    return String(v)
  }

  // 每次打开重置为"仅看变更字段"
  watch(
    () => props.visible,
    (val) => {
      if (val) onlyChanged.value = true
    }
  )
</script>

<style scoped>
  .detail-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 16px 0 8px;
  }

  .detail-section-title {
    font-weight: 600;
  }

  .detail-mono {
    font-family: monospace;
    font-size: 12px;
  }

  .detail-value {
    max-height: 200px;
    margin: 0;
    overflow: auto;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.6;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .detail-value.is-missing {
    color: var(--el-text-color-placeholder);
  }

  .detail-json {
    margin-bottom: 12px;
  }

  .detail-json-title {
    margin-bottom: 4px;
    font-size: 13px;
    font-weight: 600;
  }

  :deep(.el-table__row.is-changed-row) {
    background: var(--el-color-warning-light-9);
  }
</style>
