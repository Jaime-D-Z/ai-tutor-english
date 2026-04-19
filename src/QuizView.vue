<script setup>
import { ref } from 'vue'
import { apiUrl } from './apiBase'

const levels = ['A1', 'A2', 'B1', 'B2', 'C1']
const sectionOptions = [
  { id: 'reading', label: 'Reading' },
  { id: 'listening', label: 'Listening' },
  { id: 'structure_written_expression', label: 'Structure' }
]
const selectedLevel = ref('B1')
const selectedSections = ref(['reading'])
const questions = ref([])
const userAnswers = ref([])
const loadingQuestions = ref(false)
const evaluating = ref(false)
const errorMessage = ref('')
const score = ref(null)
const feedback = ref([])

const resetEvaluation = () => {
  score.value = null
  feedback.value = []
}

const optionLetter = (index) => ['A', 'B', 'C', 'D'][index] || 'A'

const feedbackFor = (questionIndex) => {
  return feedback.value.find((item) => item.question_index === questionIndex)?.comment || ''
}

const answerStateClass = (question, questionIndex, optionIndex) => {
  if (score.value === null) return ''

  const letter = optionLetter(optionIndex)
  const userChoice = userAnswers.value[questionIndex]

  if (letter === question.correct_answer) return 'option-correct'
  if (letter === userChoice && userChoice !== question.correct_answer) return 'option-incorrect'
  return ''
}

const sectionLabel = (section) => {
  if (section === 'listening') return 'Listening'
  if (section === 'structure_written_expression') return 'Structure'
  return 'Reading'
}

const passageLabel = (section) => {
  if (section === 'listening') return 'Audio transcript'
  if (section === 'structure_written_expression') return 'Prompt'
  return 'Reading passage'
}

const toggleSection = (sectionId) => {
  const exists = selectedSections.value.includes(sectionId)

  if (exists) {
    if (selectedSections.value.length === 1) return
    selectedSections.value = selectedSections.value.filter((item) => item !== sectionId)
    return
  }

  selectedSections.value = [...selectedSections.value, sectionId]
}

const generateQuestions = async () => {
  loadingQuestions.value = true
  errorMessage.value = ''
  questions.value = []
  userAnswers.value = []
  resetEvaluation()

  try {
    const response = await fetch(apiUrl('/generate-questions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        level: selectedLevel.value,
        sections: selectedSections.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'No se pudieron generar preguntas.')
    }

    const generated = Array.isArray(data.questions) ? data.questions : []

    questions.value = generated
    userAnswers.value = generated.map(() => '')
  } catch (error) {
    errorMessage.value = error.message || 'Error al generar preguntas.'
  } finally {
    loadingQuestions.value = false
  }
}

const evaluateAnswers = async () => {
  errorMessage.value = ''

  if (!questions.value.length) {
    errorMessage.value = 'Primero genera preguntas.'
    return
  }

  if (userAnswers.value.some((answer) => !answer)) {
    errorMessage.value = 'Responde todas las preguntas antes de evaluar.'
    return
  }

  evaluating.value = true
  resetEvaluation()

  try {
    const response = await fetch(apiUrl('/evaluate-answers'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        questions: questions.value,
        user_answers: userAnswers.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo evaluar el quiz.')
    }

    score.value = typeof data.score === 'number' ? data.score : null
    feedback.value = Array.isArray(data.feedback) ? data.feedback : []
  } catch (error) {
    errorMessage.value = error.message || 'Error al evaluar respuestas.'
  } finally {
    evaluating.value = false
  }
}
</script>

<template>
  <section class="quiz-wrap">
    <header class="quiz-header">
      <h1>TOEFL Quiz Generator</h1>
      <p>Genera 20 preguntas TOEFL Reading por nivel y recibe evaluacion instantanea con IA.</p>
    </header>

    <div class="toolbar">
      <label for="level" class="field-label">Nivel</label>
      <select id="level" v-model="selectedLevel" :disabled="loadingQuestions || evaluating">
        <option v-for="level in levels" :key="level" :value="level">{{ level }}</option>
      </select>

      <div class="section-picker">
        <p>Seccion TOEFL</p>
        <label
          v-for="section in sectionOptions"
          :key="section.id"
          class="section-option"
        >
          <input
            type="checkbox"
            :checked="selectedSections.includes(section.id)"
            :disabled="loadingQuestions || evaluating"
            @change="toggleSection(section.id)"
          />
          <span>{{ section.label }}</span>
        </label>
      </div>

      <button class="primary" :disabled="loadingQuestions || evaluating" @click="generateQuestions">
        {{ loadingQuestions ? 'Generando 20 preguntas...' : 'Generar 20 preguntas' }}
      </button>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div v-if="questions.length" class="questions-list">
      <article v-for="(question, qIndex) in questions" :key="qIndex" class="question-card">
        <h2>Pregunta {{ qIndex + 1 }}</h2>
        <p class="section-chip">Seccion: {{ sectionLabel(question.section) }}</p>
        <p class="type-chip">Tipo: {{ question.question_type || 'reading' }}</p>
        <div v-if="question.passage" class="passage-box">
          <h3>{{ passageLabel(question.section) }}</h3>
          <p>{{ question.passage }}</p>
        </div>
        <p class="question-text">{{ question.question }}</p>

        <div class="options">
          <label
            v-for="(option, oIndex) in question.options"
            :key="`${qIndex}-${oIndex}`"
            class="option-item"
            :class="answerStateClass(question, qIndex, oIndex)"
          >
            <input
              v-model="userAnswers[qIndex]"
              type="radio"
              :name="`question-${qIndex}`"
              :value="optionLetter(oIndex)"
              :disabled="evaluating"
            />
            <span class="option-letter">{{ optionLetter(oIndex) }}.</span>
            <span>{{ option }}</span>
          </label>
        </div>

        <p v-if="score !== null" class="feedback-text">
          {{ feedbackFor(qIndex) }}
        </p>
      </article>

      <div class="evaluate-bar">
        <button class="primary" :disabled="evaluating" @click="evaluateAnswers">
          {{ evaluating ? 'Evaluando...' : 'Evaluar' }}
        </button>
      </div>
    </div>

    <div v-if="score !== null" class="score-panel">
      <h3>Score final: {{ score }}/100</h3>
    </div>
  </section>
</template>

<style scoped>
.quiz-wrap {
  max-width: 980px;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #17233a;
}

.quiz-header h1 {
  margin: 0;
  font-size: 2rem;
}

.quiz-header p {
  margin: 0.45rem 0 0;
  color: #4e5e7b;
}

.toolbar {
  margin-top: 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.field-label {
  font-weight: 600;
}

.section-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.section-picker p {
  margin: 0;
  font-weight: 700;
}

.section-option {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  padding: 0.3rem 0.6rem;
  background: #fff;
  font-size: 0.9rem;
}

select {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  font-size: 1rem;
}

.primary {
  border: none;
  border-radius: 10px;
  background: #1d4ed8;
  color: #fff;
  font-weight: 700;
  padding: 0.6rem 1rem;
  cursor: pointer;
}

.primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.error {
  margin-top: 0.9rem;
  color: #b42318;
  font-weight: 700;
}

.questions-list {
  margin-top: 1.2rem;
  display: grid;
  gap: 1rem;
}

.question-card {
  border: 1px solid #d8e2f0;
  background: #f7faff;
  border-radius: 12px;
  padding: 1rem;
}

.question-card h2 {
  margin: 0;
  font-size: 1.05rem;
}

.question-text {
  margin: 0.55rem 0 0.9rem;
  font-weight: 600;
}

.type-chip {
  margin: 0.55rem 0 0;
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: #e9efff;
  color: #1e3a8a;
}

.section-chip {
  margin: 0.55rem 0 0;
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: #e8f7ed;
  color: #166534;
}

.passage-box {
  margin-top: 0.65rem;
  border: 1px solid #cdd9ef;
  background: #ffffff;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
}

.passage-box h3 {
  margin: 0;
  font-size: 0.88rem;
}

.passage-box p {
  margin: 0.4rem 0 0;
  line-height: 1.45;
}

.options {
  display: grid;
  gap: 0.45rem;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid #d5dfed;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  background: #fff;
}

.option-letter {
  font-weight: 700;
}

.option-correct {
  border-color: #22c55e;
  background: #ecfdf3;
}

.option-incorrect {
  border-color: #ef4444;
  background: #fef2f2;
}

.feedback-text {
  margin-top: 0.75rem;
  color: #1e40af;
  font-weight: 600;
}

.evaluate-bar {
  margin-top: 0.2rem;
}

.score-panel {
  margin-top: 1.1rem;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  border-radius: 12px;
  padding: 0.85rem 1rem;
}

.score-panel h3 {
  margin: 0;
  color: #1e3a8a;
}

@media (max-width: 680px) {
  .quiz-wrap {
    padding: 1.25rem 1rem 2rem;
  }

  .quiz-header h1 {
    font-size: 1.6rem;
  }
}
</style>
