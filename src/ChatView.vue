<script setup>
import { nextTick, ref } from 'vue'
import { requestJson } from './apiBase'

const messages = ref([
  {
    role: 'assistant',
    content: 'Hi! I am your English tutor. Tell me something about your day and I will help you improve.',
    translation: 'Hola, soy tu tutor de ingles. Cuentame algo sobre tu dia y te ayudare a mejorar.'
  }
])
const inputMessage = ref('')
const loading = ref(false)
const errorMessage = ref('')
const messagesContainer = ref(null)

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const sendMessage = async () => {
  const trimmed = inputMessage.value.trim()
  errorMessage.value = ''

  if (!trimmed || loading.value) return

  messages.value.push({
    role: 'user',
    content: trimmed
  })

  inputMessage.value = ''
  await scrollToBottom()
  loading.value = true

  try {
    const payloadMessages = messages.value.map((message) => ({
      role: message.role,
      content: message.content
    }))

    const data = await requestJson('/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messages: payloadMessages })
    })

    const assistantMessage = data?.message

    if (!assistantMessage?.content) {
      throw new Error('La IA no devolvio un mensaje valido.')
    }

    messages.value.push({
      role: 'assistant',
      content: assistantMessage.content,
      translation: assistantMessage.translation || ''
    })

    await scrollToBottom()
  } catch (error) {
    errorMessage.value = error.message || 'Error de conexion con el chat.'
  } finally {
    loading.value = false
  }
}

const handleEnter = async (event) => {
  if (event.shiftKey) return
  event.preventDefault()
  await sendMessage()
}
</script>

<template>
  <section class="chat-wrap">
    <header class="chat-header">
      <h1>English Tutor Chat</h1>
      <p>Practica conversacion, recibe correccion y mejora tu ingles en tiempo real.</p>
    </header>

    <div ref="messagesContainer" class="chat-box">
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="['message-row', message.role === 'user' ? 'row-user' : 'row-assistant']"
      >
        <article :class="['bubble', message.role === 'user' ? 'bubble-user' : 'bubble-assistant']">
          <p>{{ message.content }}</p>
          <p v-if="message.role === 'assistant' && message.translation" class="translation-line">
            ({{ message.translation }})
          </p>
        </article>
      </div>

      <div v-if="loading" class="message-row row-assistant">
        <article class="bubble bubble-assistant loading-bubble">
          <p>Typing...</p>
        </article>
      </div>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div class="composer">
      <textarea
        v-model="inputMessage"
        rows="2"
        placeholder="Write your message in English..."
        :disabled="loading"
        @keydown.enter="handleEnter"
      />
      <button :disabled="loading || !inputMessage.trim()" @click="sendMessage">Enviar</button>
    </div>
  </section>
</template>

<style scoped>
.chat-wrap {
  max-width: 980px;
  margin: 0 auto;
  padding: 1.6rem 1.25rem 1.9rem;
  color: var(--text-main);
}

.chat-header h1 {
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.95rem);
}

.chat-header p {
  margin: 0.45rem 0 0;
  color: var(--text-soft);
}

.chat-box {
  margin-top: 1rem;
  background: var(--surface-strong);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 1rem;
  height: 420px;
  overflow-y: auto;
  display: grid;
  gap: 0.6rem;
}

.message-row {
  display: flex;
}

.row-user {
  justify-content: flex-end;
}

.row-assistant {
  justify-content: flex-start;
}

.bubble {
  display: inline-block;
  width: auto;
  max-width: min(78%, 760px);
  border-radius: 13px;
  padding: 0.48rem 0.64rem;
  line-height: 1.3;
  font-size: 0.95rem;
}

.bubble p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
}

.translation-line {
  margin-top: 0.3rem;
  color: var(--text-soft);
  font-size: 0.83rem;
  font-style: italic;
}

.bubble-user {
  background: var(--accent);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubble-assistant {
  background: color-mix(in srgb, var(--surface-strong) 88%, #fff 12%);
  color: var(--text-main);
  border: 1px solid var(--line);
  border-bottom-left-radius: 4px;
}

.loading-bubble {
  opacity: 0.85;
}

.error {
  margin-top: 0.7rem;
  color: var(--danger-text);
  font-weight: 700;
}

.composer {
  margin-top: 0.9rem;
  display: flex;
  gap: 0.6rem;
  align-items: flex-end;
}

.composer textarea {
  flex: 1;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--surface-strong);
  color: var(--text-main);
  padding: 0.65rem 0.75rem;
  font-size: 1rem;
  resize: vertical;
  min-height: 56px;
}

.composer button {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.65rem 1rem;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.composer button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 700px) {
  .chat-wrap {
    padding: 1.2rem 1rem 2rem;
  }

  .chat-header h1 {
    font-size: 1.6rem;
  }

  .chat-box {
    height: 360px;
  }

  .bubble {
    max-width: min(90%, 520px);
  }
}
</style>
