import { bitable } from '@lark-base-open/js-sdk'
import { onMounted, ref } from 'vue'

export function useTheme() {
  const theme = ref('')

  const setThemeColor = () => {
    const el = document.documentElement

    // 样式主题
    const themeStyles = {
      LIGHT: {
        action: () => el.removeAttribute('theme-mode'),
      },
      DARK: {
        action: () => el.setAttribute('theme-mode', 'dark'),
      },
    }

    // 根据主题执行对应的操作
    themeStyles[theme.value].action()
  }

  // 挂载时处理
  onMounted(async () => {
    theme.value = await bitable.bridge.getTheme()
    setThemeColor()
  })

  // 主题修改时处理
  bitable.bridge.onThemeChange((event) => {
    theme.value = event.data.theme
    setThemeColor()
  })

  // 抛出当前主题变量
  return {
    theme,
  }
}
