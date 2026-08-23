# AI Revenue Recovery System 💰🤖

An autonomous, deterministic, and auditable pipeline designed to recover failed payments via Razorpay. It uses a hybrid approach of hardcoded strategy engines for reliable transaction handling and Large Language Models (LLMs) for personalized customer communication.

## 🌟 Features

- **Synthetic Data Generation**: Automatically seed your local database with 50+ failed transactions using realistic Razorpay failure code distributions.
- **Deterministic Classification & Strategy Engine**: 
  - Accurately maps failure codes (e.g., `BAD_REQUEST_ERROR`, `RISK_FLAGGED`) to underlying causes (e.g., `invalid_card`, `insufficient_funds`, `fraud_suspected`).
  - Decides the next best action (`create_payment_link`, `trigger_mandate_retry`, or immediate `escalate` for fraud) based on payment types (one-time vs. subscription) and risk flags, **respecting a hard 3-attempt cap per transaction before forced escalation**.
- **Continuous Learning Loop**: Every outcome is written back to a `SuccessRates` table to actively track the conversion % of each (cause, action) pair over time.
- **Idempotency & Auditing**: Guarantees that actions are never duplicated on the same failed transaction. Every step (diagnosis, action, reasoning) is tracked in an `Audit Trail`.
- **Human Approval Gates vs. Escalation**: 
  - **Approval Gate (Pre-action)**: Automatically pauses high-value transactions (e.g., > ₹500) into a pending queue requiring human authorization *before* a recovery action runs.
  - **Escalation (Terminal state)**: When the 3-retry cap is hit, or a card is completely invalid, the system automatically abandons automated retries and escalates it.
- **LLM Integration (Gemini)**: 
  - **Message Composer**: Drafts personalized SMS/WhatsApp recovery messages explaining the exact failure reason concisely to the customer.
  - **Exception Summarizer**: Analyzes unrecoverable transactions and generates plain-English insights for merchants.
- **A/B Strategy Testing Dashboard**: Visually compare a "Naive Baseline" approach (blind retries) against the "AI Strategy" (cause-aware actions) side-by-side.

## 📂 Project Structure

```
razorpay/
├── prisma/
│   └── schema.prisma           # DB models (Customer, Transaction, RecoveryEvent, SuccessRate, etc.)
├── scripts/
│   └── seed.ts                 # Script to inject dummy data into the database
├── src/
│   ├── app/
│   │   ├── globals.css         # Clean, Vanilla CSS styling (No Tailwind!)
│   │   ├── layout.tsx          # Root Next.js layout component
│   │   └── page.tsx            # Interactive Dashboard UI and Server Actions
│   ├── lib/
│   │   ├── agents/
│   │   │   ├── exceptionSummarizer.ts # LLM Agent for batch summaries
│   │   │   └── messageComposer.ts     # LLM Agent for composing recovery messages
│   │   ├── engines/
│   │   │   ├── classifier.ts   # Deterministic failure code classification
│   │   │   ├── strategy.ts     # Deterministic recovery action decider (AI/Cause-aware)
│   │   │   └── strategyNaive.ts# Baseline strategy (Blind retries for A/B testing)
│   │   ├── services/
│   │   │   └── razorpay.ts     # Razorpay API Integration (Payment Links & Mandates)
│   │   ├── pipeline.ts         # The core engine orchestrating engines, agents, and DB
│   │   └── prisma.ts           # Prisma ORM instance
├── .env.example                # Template for safe sharing of required environment variables
├── .env                        # Local environment variables (git-ignored)
└── package.json                # Project dependencies and scripts
```

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Node.js (v18+) and npm installed. 
You will also need:
- **Razorpay Test API Keys** (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`)
- **Gemini API Key** (`GEMINI_API_KEY`)

### 2. Environment Setup
Populate the `.env` file at the root of the project with your keys:
```env
RAZORPAY_KEY_ID=your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
GEMINI_API_KEY=your_gemini_key
DATABASE_URL=postgres://user:password@host:port/db_name
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Initialize Database & Seed
Push the Prisma schema to generate the Postgres database schema, and then seed it with synthetic data.
```bash
npx prisma db push
npx tsx scripts/seed.ts
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Revenue Recovery Dashboard!

### 6. Resetting the Demo State
If you are doing a live pitch and want to start with a fresh slate, use the one-click reset command:
```bash
npm run demo:reset
```
This command automatically wipes the current database tables and reseeds them with exactly 50 fresh failed transactions so you can run the batch cleanly again on stage.

## ⚠️ Known Limitations
- **Simulated Real-World Outcomes**: We use Razorpay's real test-mode APIs for every action, but test-mode success/failure is determined by which test card we use. Therefore, we model realistic outcome probabilities rather than claiming real bank behavior.
- **Mocked Messaging**: We do not send real SMS/WhatsApp messages in this demo. We show the AI-drafted message and log it as sent, since actual messaging infrastructure is a separate product integration.
- **Compliance Rules**: Our compliance rules (e.g., retry limits, mandate windows) are modeled after publicly documented NPCI/Razorpay guidelines for demonstration purposes. In production, this would need strict legal and compliance sign-off.

## 🔧 Deployment Notes (Vercel)
This project is built and optimized for Vercel and Vercel Postgres.
1. The project uses `provider = "postgresql"` in `prisma/schema.prisma`.
2. Connect a Vercel Postgres database to your project in the Vercel Dashboard. Vercel will automatically inject connection strings (e.g., `POSTGRES_URL`). We have configured the schema to look for these environment variables.
3. After deployment, run `npx prisma db push` and `npm run demo:reset` to populate your live database with the synthetic hackathon data!
