<script setup>
import { ref } from 'vue'
import { requestJson } from './apiBase'

const transcript = ref('')
const isRecording = ref(false)
const isAnalyzing = ref(false)
const errorMessage = ref('')
const result = ref({
  corrected: '',
  fluency_feedback: '',
  pronunciation_tips: ''
})

let recognition = null
let finalTranscript = ''

const clearResult = () => {
  result.value = {
    corrected: '',
    fluency_feedback: '',
    pronunciation_tips: ''
  }
}

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

const analyzeSpeaking = async () => {
  if (!transcript.value.trim()) {
    errorMessage.value = 'No se detecto texto para analizar.'
    return
  }

  isAnalyzing.value = true
  errorMessage.value = ''
  clearResult()

  try {
    const data = await requestJson('/speaking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: transcript.value })
    })

    result.value = {
      corrected: data.corrected || '',
      fluency_feedback: data.fluency_feedback || '',
      pronunciation_tips: data.pronunciation_tips || ''
    }
  } catch (error) {
    errorMessage.value = error.message || 'Error al analizar el speaking.'
  } finally {
    isAnalyzing.value = false
  }
}

const startSpeaking = () => {
  errorMessage.value = ''
  clearResult()
  transcript.value = ''
  finalTranscript = ''

  const SpeechRecognition = getSpeechRecognition()

  if (!SpeechRecognition) {
    errorMessage.value = 'Tu navegador no soporta reconocimiento de voz (Web Speech API).'
    return
  }

  recognition = new SpeechRecognition()
  recognition.lang = 'en-US'
  recognition.interimResults = true
  recognition.continuous = true

  recognition.onstart = () => {
    isRecording.value = true
  }

  recognition.onresult = (event) => {
    let interimTranscript = ''

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const chunk = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += `${chunk} `
      } else {
        interimTranscript += chunk
      }
    }

    transcript.value = `${finalTranscript}${interimTranscript}`.trim()
  }

  recognition.onerror = (event) => {
    isRecording.value = false
    errorMessage.value = `Error de reconocimiento: ${event.error}`
  }

  recognition.onend = async () => {
    isRecording.value = false
    if (transcript.value.trim()) {
      await analyzeSpeaking()
    }
  }

  recognition.start()
}

const stopSpeaking = () => {
  if (recognition && isRecording.value) {
    recognition.stop()
  }
}
</script>

<template>
  <section class="speaking-container">
    <header class="speaking-header">
      <h1>Speaking Practice</h1>
      <span :class="['status-pill', isRecording ? 'status-live' : 'status-idle']">
        {{ isRecording ? 'Grabando' : 'Inactivo' }}
      </span>
    </header>

    <p class="subtitle">Habla en ingles, transcribe tu voz y recibe feedback inteligente.</p>

    <div class="actions">
      <button class="start-btn" :disabled="isRecording || isAnalyzing" @click="startSpeaking">
        🎤 Start Speaking
      </button>
      <button class="stop-btn" :disabled="!isRecording" @click="stopSpeaking">Stop</button>
    </div>

    <div class="transcript-box">
      <h2>Texto reconocido</h2>
      <p>{{ transcript || 'Empieza a hablar para ver la transcripcion en tiempo real.' }}</p>
    </div>

    <p v-if="isAnalyzing" class="loading">Analizando speaking...</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div
      v-if="result.corrected || result.fluency_feedback || result.pronunciation_tips"
      class="results-grid"
    >
      <article class="card">
        <h3>Texto corregido</h3>
        <p>{{ result.corrected }}</p>
      </article>

      <article class="card">
        <h3>Feedback de fluidez</h3>
        <p>{{ result.fluency_feedback }}</p>
      </article>

      <article class="card">
        <h3>Sugerencias de pronunciacion</h3>
        <p>{{ result.pronunciation_tips }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.speaking-container {
  max-width: 920px;
  margin: 0 auto;
  padding: 1.6rem 1.25rem 1.9rem;
  color: var(--text-main);
}

.speaking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.speaking-header h1 {
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.95rem);
}

.status-pill {
  border-radius: 999px;
  font-size: 0.85rem;
  padding: 0.3rem 0.7rem;
  font-weight: 700;
}

.status-live {
  background: var(--danger-bg);
  color: var(--danger-text);
}

.status-idle {
  background: var(--ok-bg);
  color: var(--ok-text);
}

.subtitle {
  margin-top: 0.5rem;
  color: var(--text-soft);
}

.actions {
  margin-top: 1.2rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

button {
  border-radius: 999px;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.start-btn {
  border: 1px solid transparent;
  background: var(--accent);
  color: #fff;
}

.stop-btn {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text-main);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.transcript-box {
  margin-top: 1rem;
  background: var(--surface-strong);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 1rem;
}

.transcript-box h2 {
  margin: 0;
  font-size: 1.1rem;
}

.transcript-box p {
  margin-top: 0.6rem;
  margin-bottom: 0;
  line-height: 1.45;
  white-space: pre-wrap;
}

.loading {
  margin-top: 0.9rem;
  color: var(--accent);
  font-weight: 700;
}

.error {
  margin-top: 0.9rem;
  color: var(--danger-text);
  font-weight: 700;
}

.results-grid {
  margin-top: 1.3rem;
  display: grid;
  gap: 1rem;
}

.card {
  background: var(--surface-strong);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 1rem;
}

.card h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.card p {
  margin: 0;
  white-space: pre-wrap;
}

@media (max-width: 600px) {
  .speaking-container {
    padding: 1.2rem 1rem 2rem;
  }

  .speaking-header h1 {
    font-size: 1.6rem;
  }
}
</style>
