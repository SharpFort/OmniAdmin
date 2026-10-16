<!-- 景点内容抽屉（P2 轮：基本信息 + 子表内容管理）
  描述：8 类内容槽位卡片（同类型 upsert）；票务/联系：增删改；开放时间：只读（写通道后续轮次） -->
<template>
  <ElDrawer
    :model-value="modelValue"
    :title="place?.name || '景点内容'"
    size="620px"
    @update:model-value="emit('update:modelValue', $event)"
    @open="loadAll"
  >
    <ElTabs v-model="activeTab">
      <!-- 基本信息 -->
      <ElTabPane label="基本信息" name="base">
        <el-descriptions v-if="place" :column="1" border size="small">
          <el-descriptions-item label="ID">{{ place.id }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ place.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusLabel(place.status) }}</el-descriptions-item>
          <el-descriptions-item label="实体 ID">
            {{ place.entity_id || '（未生成，发布时自动分配）' }}
          </el-descriptions-item>
          <el-descriptions-item label="Slug">{{ place.slug || '（未发布）' }}</el-descriptions-item>
          <el-descriptions-item label="分类 ID">{{
            place.category_id || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="区县 ID">{{
            place.district_id ?? '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="坐标">
            {{ place.latitude ?? '-' }}, {{ place.longitude ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建/更新">
            {{ formatTime(place.created_at) }} / {{ formatTime(place.updated_at) }}
          </el-descriptions-item>
        </el-descriptions>
      </ElTabPane>

      <!-- 描述（8 类槽位） -->
      <ElTabPane label="描述内容" name="descriptions">
        <div class="pane-toolbar">
          <span class="text-secondary"
            >每类一条，编辑即 upsert；MCA 来历/含义/沿革建议对应 HistoryAndStory 等槽位</span
          >
        </div>
        <div v-for="slot in DESC_SLOTS" :key="slot.type" class="desc-card">
          <div class="desc-card-head">
            <span class="desc-title">{{ slot.label }}</span>
            <ElButton
              v-if="descMap[slot.type]"
              link
              type="primary"
              size="small"
              @click="openDescEdit(slot)"
            >
              编辑
            </ElButton>
            <ElButton v-else link type="primary" size="small" @click="openDescEdit(slot)">
              + 添加
            </ElButton>
          </div>
          <div class="desc-content">
            {{ descMap[slot.type]?.content || '（空）' }}
          </div>
        </div>
      </ElTabPane>

      <!-- 票务 -->
      <ElTabPane :label="`票务（${tickets.length}）`" name="tickets">
        <div class="pane-toolbar">
          <ElButton type="primary" size="small" @click="openTicketEdit()">新增票种</ElButton>
        </div>
        <ElTable :data="tickets" size="small" border>
          <ElTableColumn prop="ticket_type_name" label="票种" min-width="110" />
          <ElTableColumn label="价格" width="110">
            <template #default="{ row }">{{ formatPrice(row.price, row.currency) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="description" label="说明" min-width="130" show-overflow-tooltip />
          <ElTableColumn label="状态" width="70">
            <template #default="{ row }">
              <ElTag size="small" :type="row.is_active ? 'success' : 'info'">
                {{ row.is_active ? '在售' : '停售' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <ElButton
                link
                type="primary"
                size="small"
                @click="openTicketEdit(row as Api.Citywalk.Ticket)"
                >编辑</ElButton
              >
              <ElButton
                link
                type="danger"
                size="small"
                @click="handleTicketDelete(row as Api.Citywalk.Ticket)"
                >删除</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </ElTabPane>

      <!-- 联系方式 -->
      <ElTabPane :label="`联系方式（${contacts.length}）`" name="contacts">
        <div class="pane-toolbar">
          <ElButton type="primary" size="small" @click="openContactEdit()">新增联系方式</ElButton>
        </div>
        <ElTable :data="contacts" size="small" border>
          <ElTableColumn label="类型" width="120">
            <template #default="{ row }">{{
              CONTACT_TYPE_LABELS[row.contact_type] || row.contact_type
            }}</template>
          </ElTableColumn>
          <ElTableColumn prop="contact_value" label="内容" min-width="160" show-overflow-tooltip />
          <ElTableColumn prop="label" label="标签" min-width="100" show-overflow-tooltip />
          <ElTableColumn label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <ElButton
                link
                type="primary"
                size="small"
                @click="openContactEdit(row as Api.Citywalk.Contact)"
                >编辑</ElButton
              >
              <ElButton
                link
                type="danger"
                size="small"
                @click="handleContactDelete(row as Api.Citywalk.Contact)"
                >删除</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </ElTabPane>

      <!-- 开放时间（只读） -->
      <ElTabPane :label="`开放时间（${openingHours.length}）`" name="openingHours">
        <div class="pane-toolbar">
          <span class="text-secondary"
            >规则型数据结构复杂，本页只读展示；写通道与冲突校验后续轮次开放</span
          >
        </div>
        <ElTable :data="openingHours" size="small" border>
          <ElTableColumn prop="rule_name" label="规则" min-width="120" show-overflow-tooltip />
          <ElTableColumn label="日期范围" min-width="180">
            <template #default="{ row }">
              {{ row.start_date || '…' }} ~ {{ row.end_date || '…' }}
            </template>
          </ElTableColumn>
          <ElTableColumn prop="days_of_week" label="星期" min-width="100" show-overflow-tooltip />
          <ElTableColumn label="时间" width="130">
            <template #default="{ row }">
              {{ row.is_closed ? '闭馆' : `${row.open_time || '?'}-${row.close_time || '?'}` }}
            </template>
          </ElTableColumn>
          <ElTableColumn prop="priority" label="优先级" width="70" />
        </ElTable>
      </ElTabPane>
    </ElTabs>

    <!-- 描述编辑对话框 -->
    <ElDialog
      v-model="descEditVisible"
      :title="`编辑：${descEditSlot?.label || ''}`"
      width="560px"
      append-to-body
    >
      <el-form label-width="70px">
        <el-form-item label="标题">
          <el-input v-model="descEditForm.title" placeholder="如：颐和园简介" maxlength="100" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="descEditForm.content"
            type="textarea"
            :rows="10"
            placeholder="支持长文本（MCA 来历/含义/沿革可直接粘贴）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <ElButton @click="descEditVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="handleDescSave">保存</ElButton>
      </template>
    </ElDialog>

    <!-- 票务编辑对话框 -->
    <ElDialog
      v-model="ticketEditVisible"
      :title="ticketEditForm.ticketId ? '编辑票种' : '新增票种'"
      width="480px"
      append-to-body
    >
      <el-form label-width="80px">
        <el-form-item label="票种名">
          <el-input v-model="ticketEditForm.ticketTypeName" placeholder="如 成人票 / 优惠票" />
        </el-form-item>
        <el-form-item label="价格(元)">
          <el-input-number v-model="ticketEditForm.priceYuan" :min="0" :precision="2" :step="1" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="ticketEditForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="预订链接">
          <el-input v-model="ticketEditForm.bookingUrl" placeholder="https://…（可选）" />
        </el-form-item>
        <el-form-item label="在售">
          <el-switch v-model="ticketEditForm.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <ElButton @click="ticketEditVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="handleTicketSave">保存</ElButton>
      </template>
    </ElDialog>

    <!-- 联系方式编辑对话框 -->
    <ElDialog
      v-model="contactEditVisible"
      :title="contactEditForm.contactId ? '编辑联系方式' : '新增联系方式'"
      width="460px"
      append-to-body
    >
      <el-form label-width="80px">
        <el-form-item label="类型">
          <el-select v-model="contactEditForm.contactType" class="w-full">
            <el-option
              v-for="(label, value) in CONTACT_TYPE_LABELS"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="contactEditForm.contactValue" placeholder="电话号码 / 网址 / 邮箱" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="contactEditForm.label" placeholder="如 咨询热线（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <ElButton @click="contactEditVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="handleContactSave">保存</ElButton>
      </template>
    </ElDialog>
  </ElDrawer>
</template>

<script setup lang="ts">
  import {
    getPlaceDescriptions,
    upsertPoiDescription,
    getPlaceTickets,
    upsertPoiTicket,
    deletePoiTicket,
    getPlaceContacts,
    upsertPoiContact,
    deletePoiContact,
    getPlaceOpeningHours
  } from '@/api/citywalk'
  import { ElMessage, ElMessageBox } from 'element-plus'

  interface Props {
    modelValue: boolean
    place: Api.Citywalk.Place | null
  }
  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'refresh'): void
  }
  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const activeTab = ref('base')
  const saving = ref(false)

  const statusLabel = (status: string | null) => {
    if (status === 'Published') return '已发布'
    if (status === 'PendingReview') return '待审核'
    if (status === 'Archived') return '已归档'
    return status || '-'
  }
  const formatTime = (t: string | null) => t?.replace('T', ' ').slice(0, 19) || '-'
  const formatPrice = (price: number, currency: string | null) => {
    const yuan = (price / 100).toFixed(price % 100 === 0 ? 0 : 2)
    return currency === 'CNY' || !currency ? `¥${yuan}` : `${yuan} ${currency}`
  }

  // ------------------------------------------------------------------
  // 描述（8 类槽位）
  // ------------------------------------------------------------------
  const DESC_SLOTS = [
    { type: 'BriefIntroduction', label: '简介' },
    { type: 'HistoryAndStory', label: '历史故事（来历/沿革）' },
    { type: 'ArchitecturalFeature', label: '建筑特色' },
    { type: 'TransportInfo', label: '交通信息' },
    { type: 'OpeningHours', label: '开放时间说明' },
    { type: 'TicketInfo', label: '票务说明' },
    { type: 'TravelTips', label: '游览贴士' },
    { type: 'Other', label: '其他' }
  ]

  const descriptions = ref<Api.Citywalk.Description[]>([])
  const descMap = computed<Record<string, Api.Citywalk.Description>>(() =>
    Object.fromEntries(descriptions.value.map((d) => [d.content_type, d]))
  )

  const descEditVisible = ref(false)
  const descEditSlot = ref<{ type: string; label: string } | null>(null)
  const descEditForm = reactive({ title: '', content: '' })

  const openDescEdit = (slot: { type: string; label: string }) => {
    descEditSlot.value = slot
    const existing = descMap.value[slot.type]
    descEditForm.title = existing?.title || `${props.place?.name || ''}${slot.label}`
    descEditForm.content = existing?.content || ''
    descEditVisible.value = true
  }

  const handleDescSave = async () => {
    if (!props.place || !descEditSlot.value) return
    if (!descEditForm.title.trim()) {
      ElMessage.warning('标题不能为空')
      return
    }
    saving.value = true
    try {
      await upsertPoiDescription(
        props.place.id,
        descEditSlot.value.type,
        descEditForm.title.trim(),
        descEditForm.content
      )
      ElMessage.success('已保存')
      descEditVisible.value = false
      await loadDescriptions()
    } catch (error) {
      console.error('保存描述失败:', error)
    } finally {
      saving.value = false
    }
  }

  // ------------------------------------------------------------------
  // 票务
  // ------------------------------------------------------------------
  const tickets = ref<Api.Citywalk.Ticket[]>([])
  const ticketEditVisible = ref(false)
  const ticketEditForm = reactive({
    ticketId: '',
    ticketTypeName: '',
    priceYuan: 0,
    description: '',
    bookingUrl: '',
    isActive: true
  })

  const openTicketEdit = (row?: Api.Citywalk.Ticket) => {
    ticketEditForm.ticketId = row?.id || ''
    ticketEditForm.ticketTypeName = row?.ticket_type_name || ''
    ticketEditForm.priceYuan = row ? row.price / 100 : 0
    ticketEditForm.description = row?.description || ''
    ticketEditForm.bookingUrl = row?.booking_url || ''
    ticketEditForm.isActive = row ? !!row.is_active : true
    ticketEditVisible.value = true
  }

  const handleTicketSave = async () => {
    if (!props.place) return
    if (!ticketEditForm.ticketTypeName.trim()) {
      ElMessage.warning('票种名不能为空')
      return
    }
    saving.value = true
    try {
      await upsertPoiTicket(props.place.id, {
        ticketId: ticketEditForm.ticketId || undefined,
        ticketTypeName: ticketEditForm.ticketTypeName.trim(),
        price: Math.round(ticketEditForm.priceYuan * 100),
        description: ticketEditForm.description || undefined,
        bookingUrl: ticketEditForm.bookingUrl || undefined,
        isActive: ticketEditForm.isActive
      })
      ElMessage.success('已保存')
      ticketEditVisible.value = false
      await loadTickets()
    } catch (error) {
      console.error('保存票务失败:', error)
    } finally {
      saving.value = false
    }
  }

  const handleTicketDelete = async (row: Api.Citywalk.Ticket) => {
    try {
      await ElMessageBox.confirm(`删除票种「${row.ticket_type_name}」？`, '删除确认', {
        type: 'warning'
      })
    } catch {
      return
    }
    try {
      await deletePoiTicket(row.id)
      ElMessage.success('已删除')
      await loadTickets()
    } catch (error) {
      console.error('删除票务失败:', error)
    }
  }

  // ------------------------------------------------------------------
  // 联系方式
  // ------------------------------------------------------------------
  const CONTACT_TYPE_LABELS: Record<string, string> = {
    Phone: '电话',
    OfficialWebsite: '官网',
    Email: '邮箱',
    WeChatOfficialAccount: '公众号',
    Weibo: '微博',
    Fax: '传真',
    Other: '其他'
  }

  const contacts = ref<Api.Citywalk.Contact[]>([])
  const contactEditVisible = ref(false)
  const contactEditForm = reactive({
    contactId: '',
    contactType: 'Phone',
    contactValue: '',
    label: ''
  })

  const openContactEdit = (row?: Api.Citywalk.Contact) => {
    contactEditForm.contactId = row?.id || ''
    contactEditForm.contactType = row?.contact_type || 'Phone'
    contactEditForm.contactValue = row?.contact_value || ''
    contactEditForm.label = row?.label || ''
    contactEditVisible.value = true
  }

  const handleContactSave = async () => {
    if (!props.place) return
    if (!contactEditForm.contactValue.trim()) {
      ElMessage.warning('内容不能为空')
      return
    }
    saving.value = true
    try {
      await upsertPoiContact(props.place.id, {
        contactId: contactEditForm.contactId || undefined,
        contactType: contactEditForm.contactType,
        contactValue: contactEditForm.contactValue.trim(),
        label: contactEditForm.label || undefined
      })
      ElMessage.success('已保存')
      contactEditVisible.value = false
      await loadContacts()
    } catch (error) {
      console.error('保存联系方式失败:', error)
    } finally {
      saving.value = false
    }
  }

  const handleContactDelete = async (row: Api.Citywalk.Contact) => {
    try {
      await ElMessageBox.confirm(
        `删除该${CONTACT_TYPE_LABELS[row.contact_type] || '联系方式'}？`,
        '删除确认',
        {
          type: 'warning'
        }
      )
    } catch {
      return
    }
    try {
      await deletePoiContact(row.id)
      ElMessage.success('已删除')
      await loadContacts()
    } catch (error) {
      console.error('删除联系方式失败:', error)
    }
  }

  // ------------------------------------------------------------------
  // 开放时间（只读）
  // ------------------------------------------------------------------
  const openingHours = ref<Api.Citywalk.OpeningHour[]>([])

  // ------------------------------------------------------------------
  // 加载
  // ------------------------------------------------------------------
  const loadDescriptions = async () => {
    if (!props.place) return
    try {
      descriptions.value = await getPlaceDescriptions(props.place.id)
    } catch (error) {
      console.warn('加载描述失败:', error)
      descriptions.value = []
    }
  }
  const loadTickets = async () => {
    if (!props.place) return
    try {
      tickets.value = await getPlaceTickets(props.place.id)
    } catch (error) {
      console.warn('加载票务失败:', error)
      tickets.value = []
    }
  }
  const loadContacts = async () => {
    if (!props.place) return
    try {
      contacts.value = await getPlaceContacts(props.place.id)
    } catch (error) {
      console.warn('加载联系方式失败:', error)
      contacts.value = []
    }
  }
  const loadOpeningHours = async () => {
    if (!props.place) return
    try {
      openingHours.value = await getPlaceOpeningHours(props.place.id)
    } catch (error) {
      console.warn('加载开放时间失败:', error)
      openingHours.value = []
    }
  }
  const loadAll = () => {
    activeTab.value = 'base'
    loadDescriptions()
    loadTickets()
    loadContacts()
    loadOpeningHours()
  }
</script>

<style lang="scss" scoped>
  .pane-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .text-secondary {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  .desc-card {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 10px;

    .desc-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      .desc-title {
        font-size: 13px;
        font-weight: 600;
      }
    }
    .desc-content {
      font-size: 13px;
      line-height: 1.7;
      color: var(--el-text-color-regular);
      white-space: pre-wrap;
      max-height: 120px;
      overflow: hidden;
      position: relative;

      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 30px;
        background: linear-gradient(transparent, var(--el-bg-color));
      }
    }
  }
</style>
