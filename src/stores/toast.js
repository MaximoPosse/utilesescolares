import { reactive } from 'vue'

let counter = 0

export const toastState = reactive({
  items: [],
})

export function notify(message, type = 'success', duration = 4500) {
  const id = ++counter
  toastState.items.push({ id, message, type })
  if (duration > 0) {
    window.setTimeout(() => dismiss(id), duration)
  }
  return id
}

export function dismiss(id) {
  const index = toastState.items.findIndex((t) => t.id === id)
  if (index >= 0) toastState.items.splice(index, 1)
}

export function useToast() {
  return { toastState, notify, dismiss }
}
