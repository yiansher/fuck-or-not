import type { ContentListUnion } from '@google/genai'
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai'
import { useDark, useStorage, useToggle } from '@vueuse/core'
import { ref, watch } from 'vue'

export const isDark = useDark()
export const toggleDark = useToggle(isDark)
export const googleApiKey = useStorage('google-api-key', '')
const ai = ref<GoogleGenAI | null>(new GoogleGenAI({ apiKey: googleApiKey.value }))

watch(googleApiKey, (key) => {
  ai.value = key ? new GoogleGenAI({ apiKey: key }) : null
})

// Default model list
export const defaultModelOptions: string[] = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash',
]

// Migrate old format (object array) to new format (string array)
function migrateModelOptions(): string[] {
  const stored = localStorage.getItem('model-options')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].value) {
        const migrated = parsed.map((item: { value: string }) => item.value)
        localStorage.setItem('model-options', JSON.stringify(migrated))
        return migrated
      }
    }
    catch {
      // Parse failed, use default
    }
  }
  return [...defaultModelOptions]
}

export const modelOptions = useStorage<string[]>('model-options', migrateModelOptions())

export function addModel(model: string) {
  modelOptions.value.push(model)
}

export function removeModel(index: number) {
  modelOptions.value.splice(index, 1)
}

export function updateModel(index: number, model: string) {
  modelOptions.value[index] = model
}

export function resetModelOptions() {
  modelOptions.value = [...defaultModelOptions]
}

export function generateContent(model: string, contents: ContentListUnion, systemInstruction: string) {
  return ai.value!.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    },
  })
}

export function uploadFileToAPI(file: File) {
  return ai.value!.files.upload({
    file,
    config: {
      mimeType: file.type,
    },
  })
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1])
      }
      reject(new Error('File reading failed'))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
