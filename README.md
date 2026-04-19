# tutor-ai

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

## Environment Variables

Create a `.env` file based on `.env.example`.

- `GROQ_API_KEY`: Groq API key (backend only).
- `GROQ_MODEL`: model name, default `llama-3.1-8b-instant`.
- `VITE_API_BASE_URL`: backend base URL used by frontend.
  - Local dev: `http://localhost:3000`
  - Production: your deployed backend URL (do not use localhost)
- `FRONTEND_ORIGINS`: comma-separated origins allowed by backend CORS.

## Production Deployment Notes

- Frontend deployed on Vercel cannot call `http://localhost:3000` in browser.
- Deploy backend separately (Render/Railway/Fly/etc) and set:
  - `VITE_API_BASE_URL=https://your-backend-domain.com`
  - `FRONTEND_ORIGINS=https://ai-tutor-english.vercel.app`
- If you see `POST https://ai-tutor-english.vercel.app/chat 404`, your frontend is calling itself.
  - Go to Vercel Project Settings -> Environment Variables
  - Add `VITE_API_BASE_URL` with your backend public URL
  - Redeploy frontend

## Vercel Same-Domain API

This project includes `vercel.json` rewrites and `api/index.js` so these frontend calls work on the same Vercel domain:

- `/correct`
- `/speaking`
- `/generate-questions`
- `/evaluate-answers`
- `/chat`

For this mode, you can keep local `.env` simple and do not need `VITE_API_BASE_URL` locally.
