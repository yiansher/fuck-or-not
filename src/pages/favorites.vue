<script setup lang="ts">
import type { FavoriteResult } from '~/types'
import { useMediaQuery, useStorage } from '@vueuse/core'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { computed, nextTick, ref } from 'vue'
import Button from '~/components/Button.vue'
import FavoritesItem from '~/components/FavoritesItem.vue'
import Pagination from '~/components/Pagination.vue'

const isMobile = useMediaQuery('(max-width: 768px)')

const favoriteResults = useIDBKeyval<FavoriteResult[] | undefined>('favorite-results', undefined)
const sortOrder = useStorage<'newest' | 'oldest'>('favorites-sort-order', 'newest')

const sortedResults = computed(() => {
  if (!favoriteResults.data.value)
    return []
  const sorted = [...favoriteResults.data.value]
  if (sortOrder.value === 'oldest') {
    sorted.sort((a, b) => a.time - b.time)
  }
  else {
    sorted.sort((a, b) => b.time - a.time)
  }
  return sorted
})

const pageSize = 5
const page = ref(1)
const paginationRef = ref<InstanceType<typeof Pagination> | null>(null)
const jumpInput = ref('')

const pageCount = computed(() => Math.max(1, Math.ceil((favoriteResults.data.value?.length ?? 0) / pageSize)))

const pagedResults = computed(() => {
  if (!sortedResults.value.length)
    return []
  const start = (page.value - 1) * pageSize
  return sortedResults.value.slice(start, start + pageSize)
})

function onDelete(time: number) {
  if (!confirm('确定要删除这个收藏吗？')) {
    return
  }
  const idx = favoriteResults.data.value?.findIndex(item => item.time === time) ?? -1
  if (idx !== -1) {
    favoriteResults.data.value?.splice(idx, 1)
  }
  nextTick(() => {
    const total = favoriteResults.data.value?.length ?? 0
    const maxPage = Math.max(1, Math.ceil(total / pageSize))
    if (page.value > maxPage) {
      page.value = maxPage
    }
  })
}

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
}

function handleJump() {
  const p = Number.parseInt(jumpInput.value, 10)
  if (!Number.isNaN(p) && p >= 1 && p <= pageCount.value) {
    page.value = p
  }
  jumpInput.value = ''
}

function onDeleteAll() {
  if (!confirm('确定要删除所有收藏吗？')) {
    return
  }
  favoriteResults.data.value = []
  page.value = 1
}

function onExportAll() {
  if (!favoriteResults.data.value || favoriteResults.data.value.length === 0) {
    return
  }
  const data = JSON.stringify(favoriteResults.data.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `favorites-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const fileInputRef = ref<HTMLInputElement | null>(null)

function onImportClick() {
  fileInputRef.value?.click()
}

function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string) as FavoriteResult[]
      if (!Array.isArray(data)) {
        alert('导入失败：文件格式不正确')
        return
      }
      const existingTimes = new Set(favoriteResults.data.value?.map(item => item.time) ?? [])
      const newItems = data.filter(item => !existingTimes.has(item.time))
      if (newItems.length === 0) {
        alert('没有新的收藏可导入')
        return
      }
      favoriteResults.data.value = [...(favoriteResults.data.value ?? []), ...newItems]
        .sort((a, b) => b.time - a.time)
      alert(`成功导入 ${newItems.length} 条收藏`)
    }
    catch {
      alert('导入失败：文件解析错误')
    }
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<template>
  <h1 text-3xl font-bold>
    收藏夹
  </h1>
  <div py-4 />

  <Transition name="fade">
    <div
      :key="favoriteResults.data.value === undefined
        ? 'loading'
        : favoriteResults.data.value.length > 0
          ? 'list'
          : 'empty'"
    >
      <!-- loading: fix the sudden change of favorite results -->
      <template v-if="favoriteResults.data.value === undefined">
        <!-- <div text-center py-10 text-gray-400 flex flex-col items-center>
          <div class="i-carbon-circle-dash animate-spin text-2xl mb-2" />
          加载中...
        </div> -->
      </template>

      <!-- has data -->
      <template v-else-if="favoriteResults.data.value.length > 0">
        <div flex flex-col items-center gap-2>
          <Pagination
            ref="paginationRef"
            v-model="page"
            :page-size="pageSize"
            :total="favoriteResults.data.value.length"
          />
          <div flex items-center gap-4>
            <div v-if="pageCount > 5" flex items-center gap-1 text-sm>
              <input
                v-model="jumpInput"
                type="text"
                inputmode="numeric"
                :placeholder="String(page)"
                class="w-10 px-1 py-0.5 text-center rounded outline-none transition-colors duration-200 border border-base bg-light dark:bg-dark focus:border-teal-600"
                @keyup.enter="handleJump"
              >
              <span opacity-60>/ {{ pageCount }}</span>
            </div>
            <button
              type="button"
              flex items-center gap-1 px-2 py-1
              border="~ base rounded"
              bg="light dark:dark"
              text-sm cursor-pointer
              hover:border-teal-600
              transition-colors duration-200
              @click="toggleSortOrder"
            >
              <div :class="sortOrder === 'newest' ? 'i-carbon-arrow-down' : 'i-carbon-arrow-up'" />
              {{ sortOrder === 'newest' ? '最新' : '最旧' }}
            </button>
          </div>
        </div>
        <div py-2 />

        <TransitionGroup name="list" tag="div">
          <FavoritesItem
            v-for="item in pagedResults"
            :key="item.time"
            :item="item"
            :is-mobile="isMobile"
            @delete="onDelete(item.time)"
          />
        </TransitionGroup>

        <div py-2 />
        <Button @click="onImportClick">
          导入收藏
        </Button>
        <div py-2 />
        <Button @click="onExportAll">
          导出所有收藏
        </Button>
        <div py-2 />
        <Button variant="danger" @click="onDeleteAll">
          删除所有收藏
        </Button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          hidden
          @change="onImportFile"
        >
      </template>

      <!-- empty -->
      <template v-else>
        <div
          p-4 mb-4
          border="~ base rounded-md"
          bg="light/80 dark:dark/80"
          flex flex-col items-center justify-center
          min-h-60
        >
          <div class="i-carbon-bookmark text-4xl mb-4 text-gray-500" />
          <div text-lg font-bold text-gray-500>
            暂无收藏
          </div>
        </div>
        <Button @click="onImportClick">
          导入收藏
        </Button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          hidden
          @change="onImportFile"
        >
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0, 0.1, 1);
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>
