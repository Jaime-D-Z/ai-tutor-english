<script setup>
import { ref } from 'vue'
import { requestJson } from './apiBase'

const inputText = ref('')
const loading = ref(false)
const errorMessage = ref('')
const result = ref({
  corrected: '',
  explanation: '',
  translation: ''
})

const clearResult = () => {
  result.value = {
    corrected: '',
    explanation: '',
    translation: ''
  }
}

const handleCorrection = async () => {
  errorMessage.value = ''

  if (!inputText.value.trim()) {
    errorMessage.value = 'Escribe un texto en ingles antes de corregir.'
    clearResult()
    return
  }

  loading.value = true
  clearResult()

  try {
    const data = await requestJson('/correct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: inputText.value
      })
    })

    result.value = {
      corrected: data.corrected || '',
      explanation: data.explanation || '',
      translation: data.translation || ''
    }
  } catch (error) {
    errorMessage.value = error.message || 'No se pudo completar la correccion.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="writing-container">
    <h1>Writing Correction</h1>
    <p class="subtitle">Escribe en ingles y recibe correccion, explicacion y traduccion.</p>

    <label for="writing-input" class="field-label">Tu texto en ingles</label>
    <textarea
      id="writing-input"
      v-model="inputText"
      class="writing-textarea"
      placeholder="Ejemplo: Yesterday I go to the store and buyed apples."
      rows="8"
    />

    <button class="correct-button" :disabled="loading" @click="handleCorrection">
      {{ loading ? 'Corrigiendo...' : 'Corregir' }}
    </button>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <section v-if="result.corrected || result.explanation || result.translation" class="results-panel">
      <article class="result-item">
        <h2>Texto corregido</h2>
        <p>{{ result.corrected }}</p>
      </article>

      <article class="result-item">
        <h2>Explicacion de errores</h2>
        <p>{{ result.explanation }}</p>
      </article>

      <article class="result-item">
        <h2>Traduccion al espanol</h2>
        <p>{{ result.translation }}</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
.writing-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.6rem 1.25rem 1.9rem;
  color: var(--text-main);
}

h1 {
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.95rem);
}

.subtitle {
  margin-top: 0.4rem;
  color: var(--text-soft);
}

.field-label {
  display: block;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  font-weight: 700;
}

.writing-textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-strong);
  color: var(--text-main);
  padding: 0.9rem;
  font-size: 1rem;
  line-height: 1.45;
  resize: vertical;
}

.correct-button {
  margin-top: 1rem;
  padding: 0.75rem 1.2rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.correct-button:hover {
  background: var(--accent-strong);
}

.correct-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-message {
  margin-top: 0.8rem;
  color: var(--danger-text);
  font-weight: 700;
}

.results-panel {
  margin-top: 1.5rem;
  display: grid;
  gap: 1rem;
}

.result-item {
  background: var(--surface-strong);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 1rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.result-item h2 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.result-item p {
  margin: 0;
  white-space: pre-wrap;
}

@media (max-width: 600px) {
  .writing-container {
    padding: 1.25rem 1rem 2rem;
  }

  h1 {
    font-size: 1.6rem;
  }
}
</style>
