<!-- 用户岗位分配弹窗（rpc_assign_user_positions：数组参数 + 主岗位单选；支持编辑回填） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="editData ? '编辑岗位分配' : '分配岗位'"
    width="560px"
    @update:model-value="emit('update:visible', $event)"
  >
    <ElForm label-width="90px">
      <ElFormItem label="选择用户" required>
        <ElSelect
          v-model="userId"
          filterable
          remote
          :remote-method="handleUserSearch"
          :loading="userLoading"
          placeholder="输入用户名搜索"
          class="w-full"
        >
          <ElOption
            v-for="user in userOptions"
            :key="user.id"
            :label="`${user.username}（${user.email || '-'}）`"
            :value="user.id"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="岗位" required>
        <el-tree-select
          v-model="positionIds"
          :data="positionTree"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          multiple
          show-checkbox
          placeholder="选择岗位（可多选）"
          class="w-full"
        />
      </ElFormItem>
      <ElFormItem label="主岗位">
        <ElSelect
          v-model="primaryPositionId"
          clearable
          placeholder="选择主岗位（可选）"
          class="w-full"
        >
          <ElOption v-for="id in positionIds" :key="id" :label="positionLabel(id)" :value="id" />
        </ElSelect>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import {
    assignUserPositions,
    getPositionTree,
    searchUsers as apiSearchUsers
  } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'

  const props = defineProps<{
    visible: boolean
    /** 编辑模式回填数据（用户 + 已分配岗位 + 主岗位）；为空则为新增分配 */
    editData?: {
      userId: string
      username: string
      email: string | null
      positionIds: string[]
      primaryPositionId: string | null
    } | null
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }>()

  interface PositionOption {
    id: string
    label: string
    children?: PositionOption[]
  }

  const userId = ref('')
  const positionIds = ref<string[]>([])
  const primaryPositionId = ref<string | null>(null)
  const positionTree = ref<PositionOption[]>([])
  const positionLabelMap = ref<Record<string, string>>({})

  const userOptions = ref<Array<{ id: string; username: string; email: string | null }>>([])
  const userLoading = ref(false)
  const saving = ref(false)

  const positionLabel = (id: string) => positionLabelMap.value[id] || id

  const handleUserSearch = async (query: string) => {
    if (!query) return
    userLoading.value = true
    try {
      const result = await apiSearchUsers({
        p_query: query,
        p_limit: 20,
        p_offset: 0
      })
      userOptions.value = result.items.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email
      }))
    } catch (error) {
      console.error('搜索用户失败:', error)
      userOptions.value = []
    } finally {
      userLoading.value = false
    }
  }

  watch(
    () => props.visible,
    async (val) => {
      if (!val) return
      userOptions.value = []
      if (props.editData) {
        // 编辑：回填用户与已分配岗位（userOptions 注入当前用户保证回显）
        userId.value = props.editData.userId
        userOptions.value = [
          {
            id: props.editData.userId,
            username: props.editData.username,
            email: props.editData.email
          }
        ]
        positionIds.value = [...props.editData.positionIds]
        primaryPositionId.value = props.editData.primaryPositionId
      } else {
        userId.value = ''
        positionIds.value = []
        primaryPositionId.value = null
      }
      try {
        const items = await getPositionTree()
        // 扁平 → 树 + label 映射
        const nodeMap = new Map<string, PositionOption>()
        items.forEach((item) => {
          const node: PositionOption = { id: item.id, label: item.pos_name }
          nodeMap.set(item.id, node)
          positionLabelMap.value[item.id] = item.pos_name
        })
        const roots: PositionOption[] = []
        items.forEach((item) => {
          const node = nodeMap.get(item.id)!
          if (item.parent_id && nodeMap.has(item.parent_id)) {
            const parent = nodeMap.get(item.parent_id)!
            parent.children = parent.children || []
            parent.children.push(node)
          } else {
            roots.push(node)
          }
        })
        positionTree.value = roots
      } catch (error) {
        console.error('加载岗位树失败:', error)
        positionTree.value = []
      }
    }
  )

  const handleSave = async () => {
    if (!userId.value) {
      ElMessage.warning('请选择用户')
      return
    }
    if (positionIds.value.length === 0) {
      ElMessage.warning('请选择岗位')
      return
    }
    saving.value = true
    try {
      await assignUserPositions({
        p_user_id: userId.value,
        p_position_ids: positionIds.value,
        p_primary_position_id: primaryPositionId.value
      })
      ElMessage.success(props.editData ? '更新成功' : '分配成功')
      emit('update:visible', false)
      emit('submit')
    } catch (error) {
      console.error('分配岗位失败:', error)
    } finally {
      saving.value = false
    }
  }
</script>
