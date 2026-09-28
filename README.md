# Lessing Schulen Coaching

Responsive student and admin web app. Requires Node 22+ locally; on Vercel it requires a PostgreSQL `DATABASE_URL` and, for Lern-KI, `GEMINI_API_KEY` or `OPENAI_API_KEY`. Run `npm install && npm start` for a local test. Local data is stored in `.data/lessing.sqlite`; Vercel uses PostgreSQL. Open `http://localhost:3000`.

## Deployment

Deploy this directory to Vercel as a plain Node.js project. Provision a PostgreSQL database and configure `DATABASE_URL`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_BIG_ADMIN_PASSWORD` and, for Lern-KI, either `GEMINI_API_KEY` or `OPENAI_API_KEY` in Vercel environment variables. Initial passwords must be distinct and at least 10 characters long. The schema and accounts `Lessing` (admin) and `admin` (Big Admin) are installed on the first API request after valid passwords are configured. Setting these variables after accounts were seeded does not rotate existing passwords; the Big Admin can change passwords in the admin area. Optionally set `GEMINI_MODEL` or `OPENAI_MODEL`. Never expose database credentials or API keys in the client.

Students use an anonymous secure session cookie. Chats and KI histories are separated by session; clearing cookies ends access to that visitor's history. An appointment code is a bearer secret: whoever has it can view that appointment's details. Contact messages are available to admins and the originating visitor. The Lern-KI uses the Gemini GenerateContent API when `GEMINI_API_KEY` is set, otherwise the OpenAI Responses API. It displays a clear configuration error if neither key is set. Do not enter sensitive student information into KI prompts without the school's data protection approval.

Appointment requests use a calendar date (within six months) and one school-end option (13:20, 15:50 or later); students do not enter an appointment time. The public calendar shows only whether a date already has confirmed appointments or pending requests; it never reveals names, subjects, codes or appointment details. The coaching team agrees on the actual time through the status note. Existing database appointments are retained; the `school_end` column is added automatically when the app connects.

The Vercel project still requires a PostgreSQL `DATABASE_URL`; the screenshot shows only a Gemini key. Publishing the ZIP does not create a database or set missing environment variables.
