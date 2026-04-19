<script setup>
import { computed, ref } from 'vue'
import WritingView from './WritingView.vue'
import SpeakingView from './SpeakingView.vue'
import ChatView from './ChatView.vue'
import QuizView from './QuizView.vue'

const isDark = ref(false)

const tabs = [
  { id: 'chat', label: 'Chat', component: ChatView },
  { id: 'speaking', label: 'Speaking', component: SpeakingView },
  { id: 'quiz', label: 'Quiz', component: QuizView },
  { id: 'writting', label: 'Writting', component: WritingView }
]

const activeTabId = ref('chat')

const activeIndex = computed(() => tabs.findIndex((tab) => tab.id === activeTabId.value))

const activeComponent = computed(() => {
  const match = tabs.find((tab) => tab.id === activeTabId.value)
  return match ? match.component : ChatView
})

const switchTab = (tabId) => {
  activeTabId.value = tabId
}

const toggleTheme = () => {
  isDark.value = !isDark.value
}
</script>

<template>
  <div :class="['app-shell', isDark ? 'theme-dark' : 'theme-light']">
    <div class="ambient-bg" />

    <header class="top-bar">
      <div>
        <p class="mini-title">Tutor AI Studio</p>
        <h1>English Learning Hub</h1>
      </div>
      <button class="theme-toggle" @click="toggleTheme">
        {{ isDark ? 'Light Mode' : 'Dark Mode' }}
      </button>
    </header>

    <nav class="slider-nav">
      <div
        class="slider-track"
        :style="{
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
          '--tab-count': tabs.length
        }"
      >
        <span class="slider-pill" :style="{ transform: `translateX(${activeIndex * 100}%)` }" />
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['slider-tab', { active: activeTabId === tab.id }]"
          @click="switchTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
    </nav>

    <main class="view-shell">
      <transition name="view-fade" mode="out-in">
        <component :is="activeComponent" :key="activeTabId" />
      </transition>
    </main>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

:root {
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
  min-height: 100vh;
}

.app-shell {
  --bg-main: #f7f8f3;
  --bg-secondary: #fffdf7;
  --surface: rgba(255, 255, 255, 0.8);
  --surface-strong: #ffffff;
  --line: #d8d3c4;
  --text-main: #16140f;
  --text-soft: #575243;
  --accent: #cc4f2d;
  --accent-strong: #9f371d;
  --ok-bg: #e2f6e8;
  --ok-text: #1f7a3b;
  --danger-bg: #ffe5df;
  --danger-text: #9c3020;
  min-height: 100vh;
  position: relative;
  padding: 1.2rem 1rem 2rem;
  color: var(--text-main);
  background: radial-gradient(circle at 20% 10%, #fff2dc 0, transparent 35%),
    radial-gradient(circle at 95% 25%, #ffdcd2 0, transparent 30%),
    linear-gradient(135deg, var(--bg-main), var(--bg-secondary));
}

.theme-dark {
  --bg-main: #0f1218;
  --bg-secondary: #151a23;
  --surface: rgba(28, 34, 47, 0.78);
  --surface-strong: #1e2532;
  --line: #2f3a4f;
  --text-main: #eef3fb;
  --text-soft: #9caac1;
  --accent: #ff8a4c;
  --accent-strong: #f06b21;
  --ok-bg: #163427;
  --ok-text: #8de6b2;
  --danger-bg: #422426;
  --danger-text: #ffb4ad;
}

.ambient-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 38px 38px;
  mask-image: linear-gradient(to bottom, black 20%, transparent 95%);
}

.top-bar {
  max-width: 1020px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
}

.mini-title {
  margin: 0;
  color: var(--accent);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.75rem;
}

.top-bar h1 {
  margin: 0.15rem 0 0;
  font-size: clamp(1.4rem, 3vw, 2.1rem);
}

.theme-toggle {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.55rem 0.95rem;
  background: var(--surface);
  color: var(--text-main);
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.slider-nav {
  max-width: 1020px;
  margin: 1rem auto 0;
}

.slider-track {
  width: min(620px, 100%);
  display: grid;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--line);
  padding: 0.3rem;
  position: relative;
  backdrop-filter: blur(10px);
}

.slider-pill {
  position: absolute;
  top: 0.3rem;
  bottom: 0.3rem;
  left: 0.3rem;
  width: calc((100% - 0.6rem) / var(--tab-count, 4));
  border-radius: 999px;
  background: var(--accent);
  transition: transform 260ms ease;
}

.slider-tab {
  border: none;
  background: transparent;
  border-radius: 999px;
  padding: 0.6rem 0.4rem;
  color: var(--text-soft);
  font-weight: 700;
  z-index: 2;
  cursor: pointer;
}

.slider-tab.active {
  color: #fff;
}

.view-shell {
  max-width: 1040px;
  margin: 1rem auto 0;
  border-radius: 22px;
  border: 1px solid var(--line);
  background: var(--surface);
  backdrop-filter: blur(14px);
  overflow: hidden;
}

.view-fade-enter-active,
.view-fade-leave-active {
  transition: all 240ms ease;
}

.view-fade-enter-from,
.view-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 640px) {
  .top-bar {
    align-items: center;
  }

  .slider-track {
    width: 100%;
  }
}
</style>
