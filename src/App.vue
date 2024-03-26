<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FieldType, ToastType, bitable } from '@lark-base-open/js-sdk'
import axios from 'axios'
import { useTheme } from './hooks/useTheme'

useTheme()

const { t } = useI18n()
const mainFieldOptions = ref([])

const formData = reactive({
  select: '',
  input: '',
  checkbox: [
    'desc',
    'nickname',
    'create_time',
    'digg_count',
    'comment_count',
    'share_count',
    'collect_count',
    'fetch_time',
    'error_tips',
  ],
})
const form = ref(null)

const checkboxOptions = [
  { value: 'desc', label: () => t('labels.checkbox_group.desc') },
  { value: 'nickname', label: () => t('labels.checkbox_group.nickname') },
  { value: 'music_title', label: () => t('labels.checkbox_group.music_title') },
  { value: 'music_author', label: () => t('labels.checkbox_group.music_author') },
  { value: 'create_time', label: () => t('labels.checkbox_group.create_time') },
  { value: 'digg_count', label: () => t('labels.checkbox_group.digg_count') },
  { value: 'comment_count', label: () => t('labels.checkbox_group.comment_count') },
  { value: 'collect_count', label: () => t('labels.checkbox_group.collect_count') },
  { value: 'share_count', label: () => t('labels.checkbox_group.share_count') },
  { value: 'fetch_time', label: () => t('labels.checkbox_group.fetch_time') },
  { value: 'error_tips', label: () => t('labels.checkbox_group.error_tips') },
]

const isLoading = ref(false)
const isForcedEnd = ref(false)
const errorCount = ref(0)
const mappedFieldIds = ref({})
const checkAll = computed(() => checkboxOptions.length === formData.checkbox.length)
const indeterminate = computed(() => !!(checkboxOptions.length > formData.checkbox.length && formData.checkbox.length))
const isDisabled = computed(() => !(formData.select !== '' && formData.input !== '' && formData.checkbox.length > 0))

function handleSelectAll(checked) {
  formData.checkbox = checked ? checkboxOptions.map(option => option.value) : []
}

async function setFieldList() {
  const selection = await bitable.base.getSelection()
  const table = await bitable.base.getTableById(selection.tableId)
  const view = await table.getViewById(selection.viewId)
  const viewMetaList = await view.getFieldMetaList()

  mainFieldOptions.value = viewMetaList.filter(item => item.type === 1)
}

async function onSubmit() {
  errorCount.value = 0
  if (isLoading.value)
    isForcedEnd.value = true

  isLoading.value = true

  const { viewId } = await bitable.base.getSelection()
  const table = await bitable.base.getActiveTable()
  const view = await table.getViewById(viewId)

  const fieldMetaList = await table.getFieldMetaList()
  const fieldTypeMap = {
    desc: FieldType.Text,
    nickname: FieldType.Text,
    music_title: FieldType.Text,
    music_author: FieldType.Text,
    error_tips: FieldType.Text,
    digg_count: FieldType.Number,
    comment_count: FieldType.Number,
    collect_count: FieldType.Number,
    share_count: FieldType.Number,
    fetch_time: FieldType.DateTime,
    create_time: FieldType.DateTime,
  }

  // 检查并创建不存在的字段，并存储字段ID
  for (const checkboxValue of formData.checkbox) {
    const fieldMeta = fieldMetaList.find(field => field.name === t(`labels.checkbox_group.${checkboxValue}`))
    if (fieldMeta) {
      // 如果字段存在，保存字段ID
      mappedFieldIds.value[checkboxValue] = fieldMeta.id
    }
    else {
      // 如果字段不存在，创建字段并保存新字段ID
      const newField = await table.addField({
        name: t(`labels.checkbox_group.${checkboxValue}`),
        type: fieldTypeMap[checkboxValue],
      })
      mappedFieldIds.value[checkboxValue] = newField
    }
  }

  const recordList = await view.getVisibleRecordIdList()

  // localStorage.setItem('cookie', formData.input)

  for (const recordId of recordList) {
    if (isForcedEnd.value)
      break // 如果强制结束，则跳出循环

    // 获取URL字段的值
    const linkField = await table.getFieldById(formData.select)
    let url
    try {
      url = await getCellValueByRFIDS(recordId, linkField)
    }
    catch (error) {
      continue // 如果无法获取URL，跳过当前记录
    }
    if (!url.includes('douyin.com/')) {
      await handleError(t('messages.error.url_error'), recordId)
      continue // 如果URL不包含douyin.com，跳过当前记录
    }

    // 获取快手数据
    let info
    try {
      console.log(100, url, 500, formData.input)
      info = await getDouyin(url, formData.input)
      console.log(200, info)
    }
    catch (error) {
      await handleError(t('messages.error.fetch_error'), recordId)
      continue // 如果无法获取快手数据，跳过当前记录
    }

    // 准备要更新的记录数据
    if (info) {
      const updateData = {}

      for (const field of formData.checkbox) {
        if (field === 'fetch_time') {
          // 如果是fetch_time字段，则设置为当前时间戳
          updateData[mappedFieldIds.value[field]] = Date.now()
        }
        else if (field === 'create_time' && info.data[field]) {
          // 如果是create_time字段，并且info中有这个字段的值，则将秒转换为毫秒
          updateData[mappedFieldIds.value[field]] = info.data[field] * 1000
        }
        else {
          // 否则，设置为info中对应的值
          updateData[mappedFieldIds.value[field]] = info.data[field]
        }
      }

      // 使用setRecords批量更新记录
      try {
        await table.setRecords([{
          recordId,
          fields: updateData,
        }])
      }
      catch (error) {
        // 如果更新失败，处理错误
        await handleError(t('messages.error.set_error'), recordId)
      }
    }
  }

  isLoading.value = false
  await bitable.ui.showToast({
    toastType: ToastType.success,
    message: `${t('messages.finish')} ${errorCount.value}`,
  })
}
async function getCellValueByRFIDS(recordId, field) {
  const cellValue = await field.getValue(recordId)
  if (typeof cellValue == 'object')
    return cellValue[0].link

  return cellValue
}

async function handleError(errorMsg, recordId) {
  const table = await bitable.base.getActiveTable()
  errorCount.value++
  await table.setCellValue(mappedFieldIds.value.error_tips, recordId, [{ type: 'text', text: errorMsg }])
}

async function getDouyin(url) {
  // 需要将服务地址更换为生产环境地址
  const api = 'https://163e2b6e-2c6d-488d-bd3c-8951885aa372-00-uqaruydha1ee.worf.replit.dev/douyin'
  return await axios.get(api, {
    params: {
      url,
      cookie: formData.input,
    },
  })
}

onMounted(async () => {
  setFieldList()
  if (localStorage.getItem('cookie') !== null)
    formData.input = localStorage.getItem('cookie')
})
</script>

<template>
  <t-form ref="form" :data="formData" label-align="top" class="m-3" required-mark @submit="onSubmit">
    <t-alert>
      <template #message>
        {{ $t('text.alert_message') }}
        <!-- <t-link theme="primary" href="https://cladonia.feishu.cn/docx/JtjSdIHogoeyCUxDvqocDt38nLb" target="_blank">
          {{ $t('text.alert_link') }}
        </t-link> -->
      </template>
    </t-alert>
    <t-form-item :label="$t('labels.select')" name="select">
      <t-select v-model="formData.select" size="large" :placeholder="$t('labels.placeholder_select')">
        <t-option v-for="meta in mainFieldOptions" :key="meta.id" :value="meta.id" :label="meta.name" />
        <!-- <template #panelBottomContent>
          <t-button block variant="text" size="small" @click="setFieldList">
            {{ $t('labels.refresh') }}
          </t-button>
        </template> -->
      </t-select>
    </t-form-item>
    <!-- <t-form-item :label="$t('labels.input')" name="input" :help="$t('labels.help_input')">
      <t-input v-model="formData.input" size="large" :placeholder="$t('labels.placeholder_input')" />
    </t-form-item> -->

    <t-space direction="vertical">
      <t-checkbox :checked="checkAll" :indeterminate="indeterminate" size="large" :on-change="handleSelectAll">
        {{ $t('labels.checkbox_group.checkall') }}
      </t-checkbox>
      <t-checkbox-group v-model="formData.checkbox" :options="checkboxOptions" size="large" />
      <t-button size="large" :disabled="isDisabled" :loading="isLoading" type="submit">
        {{ $t('labels.submit') }}
      </t-button>
    </t-space>
  </t-form>
</template>
