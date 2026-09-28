# Lessing Schulen Coaching

Responsive student and admin web app. Requires Node 22+ locally; on Vercel it requires a PostgreSQL `DATABASE_URL` and, for Lern-KI, `OPENAI_API_KEY`. Run `npm install && npm start` for a local test. Local data is stored in `.data/lessing.sqlite`; Vercel uses PostgreSQL. Open `http://localhost:3000`.

## Deployment

Deploy this directory to Vercel as a plain Node.js project. Provision a PostgreSQL database and configure `DATABASE_URL`, `OPENAI_API_KEY`, optionally `OPENAI_MODEL`, `INITIAL_ADMIN_PASSWORD` and `INITIAL_BIG_ADMIN_PASSWORD` in Vercel environment variables. The schema and initial accounts are installed on the first API request. The requested initial credentials are `Lessing / Schulen` and `admin / 1234`. **Change the initial passwords before public deployment** by setting the environment variables; changing them after accounts were seeded does not rotate existing passwords. Big Admin can change passwords in the admin area. Never expose database credentials or API keys in the client.

Students use an anonymous secure session cookie. Chats and KI histories are separated by session; clearing cookies ends access to that visitor's history. An appointment code is a bearer secret: whoever has it can view that appointment's details. Contact messages are available to admins and the originating visitor. The Lern-KI uses the OpenAI Responses API from the server and displays a clear configuration error if the API key is missing. Do not enter sensitive student information into KI prompts without the school's data protection approval.

No Vercel project or database credentials were included in the input, so deploying to the existing URL and live end-to-end testing need those external configurations.
