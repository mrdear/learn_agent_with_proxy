```
npm install
npm run dev
```

```
open http://localhost:3000
```

Set `OPENAI_BASE_URL` and `OPENAI_API_KEY` in `backend/.env` to point the proxy at any OpenAI-compatible endpoint, including OpenRouter.
If you need a default model for requests that do not specify one, set `OPENAI_DEFAULT_MODEL` as well.
