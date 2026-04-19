import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const FRONTEND_ORIGINS = String(process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://ai-tutor-english.vercel.app",
];
const allowedOrigins = new Set([...defaultAllowedOrigins, ...FRONTEND_ORIGINS]);

const app = express();
const port = 3000;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origen no permitido por CORS."));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Private-Network", "true");
  next();
});
app.use(express.json());

// In serverless platforms like Vercel, requests may arrive as /api/*.
// Normalize to existing routes (/correct, /chat, etc.) so both formats work.
app.use((req, res, next) => {
  if (typeof req.url === "string" && req.url.startsWith("/api/")) {
    req.url = req.url.slice(4);
  }
  next();
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayFromError(error) {
  const message = String(error?.message || "");
  const match = message.match(/try again in\s*(\d+)ms/i);
  const suggested = match ? Number(match[1]) : 300;
  return Number.isFinite(suggested) ? suggested : 300;
}

async function createGroqCompletion(payload, maxRetries = 2) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await groq.chat.completions.create(payload);
    } catch (error) {
      const isRateLimited = Number(error?.status) === 429;
      if (!isRateLimited || attempt === maxRetries) {
        throw error;
      }

      const waitMs = retryDelayFromError(error) + attempt * 200;
      await sleep(waitMs);
      attempt += 1;
    }
  }

  throw new Error("No se pudo completar la solicitud al modelo.");
}

const ALLOWED_LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const ALLOWED_TOEFL_SECTIONS = [
  "reading",
  "listening",
  "structure_written_expression",
];
const MIN_TOEFL_QUESTIONS = 20;

function extractJsonFromContent(content) {
  if (!content || typeof content !== "string") {
    throw new Error("Respuesta vacia del modelo.");
  }

  try {
    return JSON.parse(content);
  } catch {
    const objectMatch = content.match(/\{[\s\S]*\}/);
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    const jsonMatch = arrayMatch || objectMatch;

    if (!jsonMatch) {
      throw new Error("No se pudo extraer JSON de la respuesta del modelo.");
    }

    return JSON.parse(jsonMatch[0]);
  }
}

function tryExtractJsonObject(content) {
  if (!content || typeof content !== "string") return null;

  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (!objectMatch) return null;

    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      return null;
    }
  }
}

function normalizeChoice(choice) {
  const upper = String(choice || "")
    .trim()
    .toUpperCase();
  return ["A", "B", "C", "D"].includes(upper) ? upper : "A";
}

function sanitizeQuestion(question) {
  const rawOptions = Array.isArray(question?.options) ? question.options : [];
  const options = rawOptions.slice(0, 4).map((option) => String(option || ""));

  while (options.length < 4) {
    options.push(`Option ${String.fromCharCode(65 + options.length)}`);
  }

  return {
    question: String(question?.question || ""),
    section: String(question?.section || "reading").toLowerCase(),
    question_type: String(question?.question_type || "reading").toLowerCase(),
    passage: String(question?.passage || ""),
    options,
    correct_answer: normalizeChoice(question?.correct_answer),
  };
}

function normalizeSections(sections) {
  const incoming = Array.isArray(sections) ? sections : [];
  const clean = incoming
    .map((section) =>
      String(section || "")
        .trim()
        .toLowerCase(),
    )
    .filter((section) => ALLOWED_TOEFL_SECTIONS.includes(section));

  if (!clean.length) return ["reading"];
  return Array.from(new Set(clean));
}

function inferSectionFromQuestionType(questionType) {
  const value = String(questionType || "").toLowerCase();
  if (value.startsWith("listening")) return "listening";
  if (value.startsWith("structure")) return "structure_written_expression";
  return "reading";
}

function normalizeQuestionTypeBySection(questionType, section) {
  const value = String(questionType || "").toLowerCase();
  if (section === "listening") {
    return value.startsWith("listening") ? value : "listening_detail";
  }
  if (section === "structure_written_expression") {
    return value.startsWith("structure")
      ? value
      : "structure_sentence_completion";
  }
  return value.startsWith("reading") ? value : "reading_main_idea";
}

function buildDiverseFallbackQuestions(level, selectedSections = ["reading"]) {
  const readingSets = [
    {
      passage:
        "In many coastal cities, local governments are building wetlands near urban neighborhoods. These wetlands absorb storm water, reduce flood risks, and provide habitats for birds and fish. Although the projects require initial funding, city planners report lower long-term costs for flood repairs.",
      questions: [
        {
          question_type: "reading_main_idea",
          question: "What is the main idea of the passage?",
          options: [
            "Wetlands are too expensive to maintain.",
            "Urban wetlands can reduce flooding and provide ecological benefits.",
            "Bird populations are declining in all cities.",
            "City planners prefer roads to natural infrastructure.",
          ],
          correct_answer: "B",
        },
        {
          question_type: "reading_detail",
          question:
            "According to the passage, what is one reported benefit of the projects?",
          options: [
            "Immediate profit from tourism.",
            "Lower long-term flood repair costs.",
            "Faster construction of highways.",
            "Reduced need for public transportation.",
          ],
          correct_answer: "B",
        },
        {
          question_type: "reading_inference",
          question:
            "What can be inferred about city planners' view of wetland projects?",
          options: [
            "They see them as useful long-term investments.",
            "They believe wetlands should replace all buildings.",
            "They think wetlands are mainly decorative.",
            "They expect no economic impact from wetlands.",
          ],
          correct_answer: "A",
        },
        {
          question_type: "reading_vocabulary_in_context",
          question:
            'In the passage, the word "absorb" is closest in meaning to:',
          options: ["release", "collect", "measure", "predict"],
          correct_answer: "B",
        },
      ],
    },
    {
      passage:
        "A university library changed its study policy by creating silent zones, collaborative rooms, and technology booths. After one semester, student surveys showed higher satisfaction because learners could choose spaces that matched their tasks.",
      questions: [
        {
          question_type: "reading_purpose",
          question: "Why does the author mention student surveys?",
          options: [
            "To prove that the new policy improved user satisfaction.",
            "To show that libraries should remove technology.",
            "To explain how to build new universities.",
            "To compare libraries in different countries.",
          ],
          correct_answer: "A",
        },
        {
          question_type: "reading_detail",
          question:
            "Which of the following was NOT one of the new spaces in the library?",
          options: [
            "Silent zones",
            "Collaborative rooms",
            "Technology booths",
            "Outdoor sports courts",
          ],
          correct_answer: "D",
        },
        {
          question_type: "reading_inference",
          question: "What can be inferred about student preferences?",
          options: [
            "Students value flexible learning environments.",
            "Students prefer only silent spaces.",
            "Students no longer use libraries.",
            "Students avoid teamwork activities.",
          ],
          correct_answer: "A",
        },
        {
          question_type: "reading_reference",
          question: 'In the passage, the pronoun "their" refers to:',
          options: ["librarians", "learners", "tasks", "surveys"],
          correct_answer: "B",
        },
      ],
    },
    {
      passage:
        "During the last decade, electric buses have become more common in medium-sized cities. Transportation agencies report that, despite higher purchase prices, electric buses often reduce maintenance costs and noise pollution over time.",
      questions: [
        {
          question_type: "reading_main_idea",
          question: "What is the main point of the passage?",
          options: [
            "Electric buses can offer long-term operational benefits.",
            "All cities should stop using buses.",
            "Noise pollution does not affect residents.",
            "Maintenance costs always increase with new technology.",
          ],
          correct_answer: "A",
        },
        {
          question_type: "reading_detail",
          question: "Which challenge is mentioned in the passage?",
          options: [
            "Higher initial purchase prices.",
            "Lack of drivers in all cities.",
            "Shortage of bus routes.",
            "Increase in ticket prices by law.",
          ],
          correct_answer: "A",
        },
        {
          question_type: "reading_vocabulary_in_context",
          question: 'In context, the word "agencies" is closest to:',
          options: ["travelers", "organizations", "stations", "regulations"],
          correct_answer: "B",
        },
        {
          question_type: "reading_inference",
          question:
            "What is most likely true about electric buses according to the passage?",
          options: [
            "They can be a strategic choice beyond immediate cost.",
            "They are always cheaper to buy than diesel buses.",
            "They increase urban noise levels.",
            "They are used only in very large capitals.",
          ],
          correct_answer: "A",
        },
      ],
    },
    {
      passage:
        "Researchers studying sleep found that students who kept a regular bedtime performed better on memory tasks than students with irregular schedules. The study emphasizes consistency rather than sleeping many extra hours before an exam.",
      questions: [
        {
          question_type: "reading_main_idea",
          question: "What does the study emphasize?",
          options: [
            "Consistency in sleep schedules.",
            "Studying all night before exams.",
            "Replacing memory tasks with physical exercise.",
            "Sleeping fewer hours every week.",
          ],
          correct_answer: "A",
        },
        {
          question_type: "reading_detail",
          question:
            "Who performed better on memory tasks according to the passage?",
          options: [
            "Students with irregular schedules.",
            "Students with regular bedtimes.",
            "Students who skipped sleep.",
            "Students who changed schedules daily.",
          ],
          correct_answer: "B",
        },
        {
          question_type: "reading_purpose",
          question: 'Why does the author mention "before an exam"?',
          options: [
            "To contrast short-term cramming habits with consistent routines.",
            "To suggest exams should be removed.",
            "To explain how memory tasks are graded.",
            "To argue that extra sleep is harmful.",
          ],
          correct_answer: "A",
        },
        {
          question_type: "reading_sentence_insertion",
          question:
            'Where would this sentence best fit in the passage? "In other words, daily habits matter more than last-minute changes."',
          options: [
            "Before the first sentence.",
            "After the first sentence.",
            "After the final sentence.",
            "At the very beginning of the title.",
          ],
          correct_answer: "C",
        },
      ],
    },
    {
      passage:
        "A city museum introduced bilingual labels next to major exhibits. Visitor interviews showed that both local families and international tourists spent more time reading exhibit descriptions, and many reported feeling more connected to the stories behind the objects.",
      questions: [
        {
          question_type: "reading_main_idea",
          question: "What is the central idea of the passage?",
          options: [
            "Bilingual labels improved engagement with museum exhibits.",
            "Museums should remove labels from exhibits.",
            "Tourists avoid reading exhibit descriptions.",
            "Local families only visit art museums.",
          ],
          correct_answer: "A",
        },
        {
          question_type: "reading_detail",
          question: "What did visitor interviews indicate?",
          options: [
            "People spent less time in galleries.",
            "People spent more time reading exhibit text.",
            "Only tourists used the labels.",
            "Families preferred audio guides only.",
          ],
          correct_answer: "B",
        },
        {
          question_type: "reading_inference",
          question:
            "What can be inferred about bilingual labels from the passage?",
          options: [
            "They can make cultural content more accessible.",
            "They reduce the need for storytelling.",
            "They are useful only for children.",
            "They cause visitors to skip exhibits.",
          ],
          correct_answer: "A",
        },
        {
          question_type: "reading_vocabulary_in_context",
          question:
            'In the passage, the word "connected" is closest in meaning to:',
          options: ["confused", "engaged", "separated", "delayed"],
          correct_answer: "B",
        },
      ],
    },
  ];

  const listeningSets = [
    {
      passage:
        "Listen to a short conversation: A student asks a professor for an extension on a project because a bus strike delayed access to campus resources.",
      questions: [
        {
          question_type: "listening_main_purpose",
          question: "Why does the student speak to the professor?",
          options: [
            "To request an extension.",
            "To register for a class.",
            "To report a classroom error.",
            "To ask for a grade change.",
          ],
          correct_answer: "A",
        },
        {
          question_type: "listening_detail",
          question: "What problem does the student mention?",
          options: [
            "A library closure for renovations.",
            "A bus strike that caused delays.",
            "A computer virus in the lab.",
            "A canceled final exam.",
          ],
          correct_answer: "B",
        },
      ],
    },
    {
      passage:
        "Listen to part of a lecture: The professor explains that coral reefs support biodiversity and protect coastlines, but warming oceans are increasing coral bleaching events.",
      questions: [
        {
          question_type: "listening_main_idea",
          question: "What is the main topic of the lecture segment?",
          options: [
            "How to build artificial beaches.",
            "The ecological role of coral reefs and current threats.",
            "Why fish species migrate every winter.",
            "How ocean salinity is measured in labs.",
          ],
          correct_answer: "B",
        },
        {
          question_type: "listening_inference",
          question: "What does the professor imply about coral bleaching?",
          options: [
            "It is unrelated to ocean temperature.",
            "It is becoming more frequent due to warming waters.",
            "It only affects deep-sea reefs.",
            "It increases reef biodiversity.",
          ],
          correct_answer: "B",
        },
      ],
    },
  ];

  const structureSets = [
    {
      passage: "Choose the sentence with the best grammar.",
      questions: [
        {
          question_type: "structure_grammar",
          question: "Which sentence is grammatically correct?",
          options: [
            "She don't like early classes.",
            "She doesn't likes early classes.",
            "She doesn't like early classes.",
            "She not like early classes.",
          ],
          correct_answer: "C",
        },
        {
          question_type: "structure_written_expression",
          question:
            "Choose the best revision: 'The results was surprising to the team.'",
          options: [
            "The results were surprising to the team.",
            "The result were surprising to the team.",
            "The results is surprising to the team.",
            "The results be surprising to the team.",
          ],
          correct_answer: "A",
        },
      ],
    },
    {
      passage: "Complete the sentence with the most accurate structure.",
      questions: [
        {
          question_type: "structure_sentence_completion",
          question: "By the time we arrived, the lecture ____.",
          options: [
            "already starts",
            "had already started",
            "has already start",
            "was already start",
          ],
          correct_answer: "B",
        },
        {
          question_type: "structure_parallelism",
          question: "Choose the sentence with correct parallel structure.",
          options: [
            "He enjoys reading, to write, and running.",
            "He enjoys reading, writing, and running.",
            "He enjoys read, writing, and to run.",
            "He enjoys to read, writing, and run.",
          ],
          correct_answer: "B",
        },
      ],
    },
  ];

  const sectionMap = {
    reading: readingSets,
    listening: listeningSets,
    structure_written_expression: structureSets,
  };

  const selectedSets = selectedSections.flatMap(
    (section) => sectionMap[section] || [],
  );
  const usableSets = selectedSets.length ? selectedSets : readingSets;

  const flatQuestions = usableSets.flatMap((set) =>
    set.questions.map((q) => ({
      question: `${q.question} (Level ${level})`,
      section:
        selectedSections.length === 1
          ? selectedSections[0]
          : String(q.question_type).startsWith("listening")
            ? "listening"
            : String(q.question_type).startsWith("structure")
              ? "structure_written_expression"
              : "reading",
      question_type: q.question_type,
      passage: set.passage,
      options: q.options,
      correct_answer: q.correct_answer,
    })),
  );

  const repeated = [];
  while (repeated.length < MIN_TOEFL_QUESTIONS) {
    repeated.push(flatQuestions[repeated.length % flatQuestions.length]);
  }

  return repeated.slice(0, MIN_TOEFL_QUESTIONS);
}

function fallbackQuestionByIndex(level, index, selectedSections = ["reading"]) {
  const bank = buildDiverseFallbackQuestions(level, selectedSections);
  return bank[index % bank.length];
}

function looksLikeSpanish(text) {
  const value = String(text || "").toLowerCase();
  if (!value) return false;
  return (
    /[¿¡]/.test(value) ||
    /\b(el|la|los|las|de|del|que|para|con|segun|pregunta|opcion|respuesta)\b/.test(
      value,
    )
  );
}

function coerceQuestionsPayload(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.questions)) return parsed.questions;
  if (Array.isArray(parsed?.data)) return parsed.data;
  return [];
}

function enforceEnglishQuestions(
  questions,
  level,
  selectedSections = ["reading"],
) {
  return questions.map((question, index) => {
    const mergedText = `${question.question} ${question.passage} ${question.options.join(" ")}`;
    if (!looksLikeSpanish(mergedText)) {
      return question;
    }
    return fallbackQuestionByIndex(level, index, selectedSections);
  });
}

function alignQuestionsWithSections(questions, selectedSections) {
  return questions.map((question, index) => {
    const currentSection = String(question.section || "").toLowerCase();
    if (selectedSections.includes(currentSection)) {
      return {
        ...question,
        question_type: normalizeQuestionTypeBySection(
          question.question_type,
          currentSection,
        ),
      };
    }

    const inferred = inferSectionFromQuestionType(question.question_type);
    if (selectedSections.includes(inferred)) {
      return {
        ...question,
        section: inferred,
        question_type: normalizeQuestionTypeBySection(
          question.question_type,
          inferred,
        ),
      };
    }

    const forcedSection = selectedSections[index % selectedSections.length];
    return {
      ...question,
      section: forcedSection,
      question_type: normalizeQuestionTypeBySection(
        question.question_type,
        forcedSection,
      ),
    };
  });
}

function keepOnlySelectedSections(questions, selectedSections) {
  return questions.filter((question) =>
    selectedSections.includes(String(question.section || "").toLowerCase()),
  );
}

function hasReasonableQuizDiversity(questions) {
  if (!questions.length) return false;

  const uniqueQuestionStems = new Set(
    questions.map((q) =>
      String(q.question || "")
        .trim()
        .toLowerCase(),
    ),
  ).size;
  const uniqueTypes = new Set(
    questions.map((q) =>
      String(q.question_type || "reading")
        .trim()
        .toLowerCase(),
    ),
  ).size;
  const uniquePassages = new Set(
    questions
      .map((q) =>
        String(q.passage || "")
          .trim()
          .toLowerCase(),
      )
      .filter((p) => p.length > 0),
  ).size;

  return uniqueQuestionStems >= 12 && uniqueTypes >= 4 && uniquePassages >= 4;
}

function ensureMinimumQuestions(
  questions,
  level,
  selectedSections = ["reading"],
) {
  const completed = [...questions];
  const diverseFallback = buildDiverseFallbackQuestions(
    level,
    selectedSections,
  );
  let fallbackIndex = 0;

  while (completed.length < MIN_TOEFL_QUESTIONS) {
    completed.push(diverseFallback[fallbackIndex % diverseFallback.length]);
    fallbackIndex += 1;
  }

  return completed.slice(0, MIN_TOEFL_QUESTIONS);
}

function sanitizeChatMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((msg) => msg && (msg.role === "user" || msg.role === "assistant"))
    .map((msg) => ({
      role: msg.role,
      content: String(msg.content || "").trim(),
    }))
    .filter((msg) => msg.content.length > 0)
    .slice(-20);
}

app.post("/correct", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: 'El campo "text" es obligatorio y debe ser un string no vacio.',
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "Falta GROQ_API_KEY en variables de entorno.",
      });
    }

    const prompt = `Corrige el siguiente texto en ingles, explica los errores y traducelo al espanol. Responde unicamente en JSON valido con las claves: corrected, explanation, translation.\n\nTexto: ${text}`;

    const completion = await createGroqCompletion({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Eres un tutor de ingles. Devuelves solo JSON valido con las claves: corrected, explanation, translation.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const content = completion.choices?.[0]?.message?.content || "";
    const parsed = extractJsonFromContent(content);

    const response = {
      corrected: String(parsed.corrected || ""),
      explanation: String(parsed.explanation || ""),
      translation: String(parsed.translation || ""),
    };

    return res.json(response);
  } catch (error) {
    console.error("Error en /correct:", error);
    return res.status(500).json({
      error: "No se pudo procesar la correccion en este momento.",
    });
  }
});

app.post("/speaking", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: 'El campo "text" es obligatorio y debe ser un string no vacio.',
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "Falta GROQ_API_KEY en variables de entorno.",
      });
    }

    const prompt = `Analiza el siguiente texto hablado por un estudiante de ingles. Corrige errores, evalua fluidez y da sugerencias de pronunciacion (aunque sea estimada). Responde en JSON con: corrected, fluency_feedback, pronunciation_tips.\n\nTexto: ${text}`;

    const completion = await createGroqCompletion({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Eres un tutor de speaking en ingles. Devuelves solo JSON valido con las claves: corrected, fluency_feedback, pronunciation_tips.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const content = completion.choices?.[0]?.message?.content || "";
    const parsed = extractJsonFromContent(content);

    const response = {
      corrected: String(parsed.corrected || ""),
      fluency_feedback: String(parsed.fluency_feedback || ""),
      pronunciation_tips: String(parsed.pronunciation_tips || ""),
    };

    return res.json(response);
  } catch (error) {
    console.error("Error en /speaking:", error);
    return res.status(500).json({
      error: "No se pudo procesar el analisis de speaking en este momento.",
    });
  }
});

app.post("/generate-questions", async (req, res) => {
  try {
    const level = String(req.body?.level || "")
      .trim()
      .toUpperCase();
    const sections = normalizeSections(req.body?.sections);

    if (!ALLOWED_LEVELS.includes(level)) {
      return res.status(400).json({
        error: `El nivel debe ser uno de: ${ALLOWED_LEVELS.join(", ")}.`,
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "Falta GROQ_API_KEY en variables de entorno.",
      });
    }

    const prompt = `Generate exactly ${MIN_TOEFL_QUESTIONS} TOEFL-style multiple-choice questions for CEFR level ${level}.\n\nSelected sections: ${sections.join(", ")}.\n\nRequirements:\n- ALL text must be in English only.\n- Match the selected TOEFL sections strictly.\n- Each question has exactly 4 options and one correct answer (A/B/C/D).\n- Include short passages/transcripts when needed.\n- Add section field using one of: reading, listening, structure_written_expression.\n\nReturn valid JSON only in this exact structure:\n[\n  {\n    \"section\": \"reading\",\n    \"question\": \"...\",\n    \"question_type\": \"reading_main_idea\",\n    \"passage\": \"...\",\n    \"options\": [\"...\", \"...\", \"...\", \"...\"],\n    \"correct_answer\": \"A\"\n  }\n]`;

    let normalizedQuestions = [];

    try {
      const completion = await createGroqCompletion({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a TOEFL test generator. Return JSON only. Produce exactly ${MIN_TOEFL_QUESTIONS} questions in English for sections: ${sections.join(", ")}.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
      });

      const content = completion.choices?.[0]?.message?.content || "";
      const parsed = extractJsonFromContent(content);
      const extractedQuestions = coerceQuestionsPayload(parsed);
      normalizedQuestions = extractedQuestions.map(sanitizeQuestion);
      normalizedQuestions = enforceEnglishQuestions(
        normalizedQuestions,
        level,
        sections,
      );
      normalizedQuestions = alignQuestionsWithSections(
        normalizedQuestions,
        sections,
      );
      normalizedQuestions = keepOnlySelectedSections(
        normalizedQuestions,
        sections,
      );
    } catch (aiError) {
      console.warn(
        "Fallo IA en /generate-questions, usando fallback:",
        aiError,
      );
    }

    let questions = ensureMinimumQuestions(
      normalizedQuestions,
      level,
      sections,
    );
    questions = alignQuestionsWithSections(questions, sections);
    questions = keepOnlySelectedSections(questions, sections);
    questions = ensureMinimumQuestions(questions, level, sections);

    if (!hasReasonableQuizDiversity(questions)) {
      const diverseFallback = buildDiverseFallbackQuestions(level, sections);
      const merged = [...questions, ...diverseFallback].map(sanitizeQuestion);
      const seen = new Set();
      questions = merged.filter((q) => {
        const key =
          `${q.question_type}::${q.question}::${q.passage}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      questions = ensureMinimumQuestions(questions, level, sections);
    }

    return res.json({ questions });
  } catch (error) {
    console.error("Error en /generate-questions:", error);
    return res.status(500).json({
      error: "No se pudieron generar preguntas en este momento.",
    });
  }
});

app.post("/evaluate-answers", async (req, res) => {
  try {
    const questions = Array.isArray(req.body?.questions)
      ? req.body.questions
      : [];
    const userAnswers = Array.isArray(req.body?.user_answers)
      ? req.body.user_answers
      : [];

    if (
      !questions.length ||
      !userAnswers.length ||
      questions.length !== userAnswers.length
    ) {
      return res.status(400).json({
        error:
          "Debes enviar questions y user_answers con la misma cantidad de elementos.",
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "Falta GROQ_API_KEY en variables de entorno.",
      });
    }

    const cleanQuestions = questions.map(sanitizeQuestion);
    const cleanUserAnswers = userAnswers.map((answer) =>
      normalizeChoice(answer),
    );

    const prompt = `Evalua las respuestas del estudiante. Devuelve JSON con:\n- score\n- feedback (array, un comentario por pregunta)\n\nQuestions: ${JSON.stringify(
      cleanQuestions,
    )}\n\nUser answers: ${JSON.stringify(cleanUserAnswers)}`;

    const completion = await createGroqCompletion({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Eres un evaluador TOEFL. Devuelves solo JSON valido con score numerico y feedback como array de comentarios por pregunta.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const content = completion.choices?.[0]?.message?.content || "";
    const parsed = extractJsonFromContent(content);

    const correctCount = cleanQuestions.reduce((acc, question, index) => {
      return question.correct_answer === cleanUserAnswers[index]
        ? acc + 1
        : acc;
    }, 0);

    const localScore = Math.round((correctCount / cleanQuestions.length) * 100);
    const aiFeedbackRaw = Array.isArray(parsed?.feedback)
      ? parsed.feedback
      : [];
    const feedback = cleanQuestions.map((question, index) => {
      const aiComment = aiFeedbackRaw[index];
      const fallback =
        question.correct_answer === cleanUserAnswers[index]
          ? "Buena respuesta. Mantienes coherencia con el contexto del enunciado."
          : `Revisa esta pregunta. La respuesta correcta era ${question.correct_answer}.`;

      return {
        question_index: index,
        comment: String(aiComment || fallback),
      };
    });

    return res.json({
      score:
        typeof parsed?.score === "number" && Number.isFinite(parsed.score)
          ? parsed.score
          : localScore,
      feedback,
    });
  } catch (error) {
    console.error("Error en /evaluate-answers:", error);
    return res.status(500).json({
      error: "No se pudieron evaluar las respuestas en este momento.",
    });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const messages = sanitizeChatMessages(req.body?.messages);

    if (!messages.length) {
      return res.status(400).json({
        error: "Debes enviar un historial de mensajes valido.",
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "Falta GROQ_API_KEY en variables de entorno.",
      });
    }

    const completion = await createGroqCompletion({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Eres un profesor de ingles. Nivel del estudiante: A2. Corrige errores suavemente. Responde en ingles. Si el usuario comete errores, primero corrige y luego responde. Manten una conversacion natural y educativa. Devuelve solo JSON con las claves: english y translation.",
        },
        ...messages,
      ],
      temperature: 0.4,
    });

    const assistantContent = completion.choices?.[0]?.message?.content || "";

    if (!assistantContent.trim()) {
      throw new Error("La IA no devolvio respuesta para el chat.");
    }

    const parsed = tryExtractJsonObject(assistantContent);
    const english = String(parsed?.english || assistantContent).trim();
    const translation = String(parsed?.translation || "").trim();

    if (!english) {
      throw new Error("La IA no devolvio el texto en ingles del chat.");
    }

    return res.json({
      message: {
        role: "assistant",
        content: english,
        translation,
      },
    });
  } catch (error) {
    console.error("Error en /chat:", error);
    return res.status(500).json({
      error: "No se pudo procesar el chat en este momento.",
    });
  }
});

app.use((error, req, res, next) => {
  if (error?.message === "Origen no permitido por CORS.") {
    return res.status(403).json({
      error:
        "Origen no permitido. Configura FRONTEND_ORIGINS con tu dominio de frontend.",
    });
  }

  return next(error);
});

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Servidor activo en http://localhost:${port}`);
  });
}

export default app;
