# AI Revenue Recovery System 💰🤖

A Simple, Complete Explanation — Problem, Solution, and How It Works

## 1. The Problem — In Plain Words
Every time a customer tries to pay a business online and the payment fails — a card gets declined, a bank server times out, a UPI mandate doesn't go through — that business loses money. Not because the customer didn't want to pay, but because something technical went wrong.

Today, most businesses handle this badly. They either:
- Do nothing, and just lose the sale.
- Retry the same payment the same way, blindly, without knowing why it failed — which usually fails again for the same reason.
- Rely on a person to manually notice the failure and follow up, which doesn't scale.

This is called "revenue leakage." It happens quietly, on every business day, and most companies have no clear picture of how much money they are actually losing to it.

## 2. What This Project Does
This project is an automated system that watches for failed payments, figures out WHY each one failed, and then takes the right action to try to recover that money — automatically, safely, and with a full record of every decision it made.

In one sentence: 
*"It doesn't just retry a failed payment — it diagnoses the failure first, then chooses the smartest way to fix it."*

## 3. How It Works — Step by Step
Think of it like a doctor's process: check the symptoms, diagnose the illness, then prescribe the right treatment — not the same medicine for every patient.

**Step 1 — Detect the failure**
When a payment fails, the system records exactly what happened: how much money, which payment method (card / UPI / net banking), and the failure code returned by the payment gateway.

**Step 2 — Diagnose the cause**
A rule-based "Classifier" reads the failure code and maps it to a real-world reason, such as:
- Invalid or expired card
- Gateway or bank server timeout
- Insufficient funds
- Bank temporarily offline

This step is deterministic — meaning it follows fixed logic, not guesswork — so the same failure always gets the same diagnosis, every time.

**Step 3 — Decide the right action**
A "Strategy Engine" looks at the diagnosis, the payment type (one-time purchase or recurring subscription), and how many times this payment has already been attempted, then picks one of three actions:
- Create a new payment link and send it to the customer
- Trigger a mandate retry (for subscriptions/UPI Autopay)
- Escalate to a human — if it has already tried enough times, or the amount is large enough to need a person's approval

This engine also has a hard safety rule: it will never keep retrying forever. After 3 attempts, it always stops and hands off to a person. This prevents annoying the customer or breaking payment-network rules.

**Step 4 — Write a personalized message (AI's job)**
This is where Artificial Intelligence is actually used — not for the money-decision itself, but to write a short, clear, friendly message to the customer explaining what happened and what to do next, in natural language.

**Step 5 — Take the real action**
The system calls Razorpay's real payment APIs to actually create the payment link or trigger the retry — this isn't just a mockup, it performs a real, working action against a real payment platform (in test mode for this project).

**Step 6 — Check if it worked**
The system checks the outcome: did the customer pay through the new link? Did the retry succeed? Every result — recovered, still failed, or escalated — is recorded.

**Step 7 — Keep an audit trail**
Every single decision — what was diagnosed, what action was chosen, why, and what happened — is saved permanently. This means nothing the system does is a "black box." Anyone can look back and see exactly why it acted the way it did.

## 4. Why This Approach (and Not Just "AI Does Everything")
A common mistake is to use AI for every part of a system, even the parts that don't need it. This project deliberately does the opposite:

| Task | Handled By | Why |
|------|------------|-----|
| Diagnosing the failure | Fixed rules (code) | Failure codes are limited and well-known — a rulebook is faster, cheaper, and never makes a mistake here |
| Deciding the action | Fixed decision table | The safe actions are limited and must never be "creative" — a lookup table guarantees consistency and safety |
| Writing the customer message | AI (Language Model) | Language and tone genuinely benefit from AI — this is a task humans are naturally good at judging, and AI can do it fast, at scale, personalized to each customer |

This matters because a system that lets AI make every decision, including money-moving ones, is risky — AI can misunderstand and take the wrong action with real money. By keeping the money-decisions rule-based and only using AI for language, the system stays safe, predictable, and explainable, while still genuinely using AI where it adds real value.

## 5. What Problem This Actually Solves
- **Recovers money** that would otherwise be silently lost — every failed payment is a chance to recover revenue, not just a dead end.
- **Removes guesswork** — instead of "just retry and hope," the system knows why something failed before acting.
- **Prevents annoying customers or breaking rules** — hard limits stop it from retrying endlessly.
- **Removes manual work** — no person has to comb through failed payments and follow up by hand.
- **Builds trust** — every decision is logged, so a business (or a compliance team) can always see exactly what happened and why.

## 6. Proof That It Actually Works (Not Just a Claim)
The system doesn't just say "AI recovers more money" — it proves it, by running two versions on the exact same batch of failed payments and comparing them side by side:

| Approach | What It Does |
|----------|--------------|
| **Naive Baseline** | Blindly retries every failed payment the same way, ignoring the reason it failed |
| **AI-Driven Strategy** | Diagnoses the reason first, then picks the smartest action for that specific reason |

Both strategies are given the exact same 3-attempt limit, so it's a fair comparison — the AI approach isn't "allowed" more tries, it just makes smarter choices within the same limits. The dashboard shows the recovery rate (%) and rupees recovered for both, live, so anyone watching can see the real difference with their own eyes.

## 7. Technologies Used (and Why Each One)
| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend / Dashboard | Next.js (React) | Shows the live results: recovery rates, audit trail, and approval queue, in a browser |
| Backend Logic | TypeScript (Node.js) | Runs the diagnosis, decision, and execution steps via Server Actions |
| Database | Prisma ORM + Postgres | Stores every transaction, every decision, and every outcome permanently |
| Payments | Razorpay Test-Mode API | Actually creates payment links and triggers mandate retries — real API calls, not simulated ones |
| AI / Language Model | Google Gemini API | Writes the personalized recovery message and summarizes unresolved cases in plain English |
| Hosting | Vercel | Makes the dashboard available on the internet, live, for anyone to try |

## 8. How Efficient Is It?
- **Speed**: Each failed payment is processed in a few seconds — the rule-based steps (diagnosis, decision) are near-instant; only the AI message-writing step takes a moment.
- **Cost**: The AI is only used for writing messages and summaries, not for every decision — this keeps the cost per recovery attempt very small (a fraction of a rupee), since the expensive AI reasoning is not wasted on tasks a simple rule can do just as well or better.
- **Safety**: Because money-moving decisions are rule-based, the outcome for any given failure is 100% predictable and repeatable — the same failure always gets the same diagnosis and the same allowed actions, which is important for a system that touches real payments.
- **Scale**: The system processes payments in small batches to stay within cloud hosting limits, and automatically loops until an entire batch of failed payments has been handled — so it works whether there are 5 failed payments or 5,000.
- **Transparency**: Every decision is logged with a plain-English reason, so checking the system's work later takes seconds, not hours of guessing.

## 9. Summary — The Core Idea in One Paragraph
Businesses lose real money every day because failed payments are handled carelessly — either ignored, or retried blindly without understanding why they failed. This project fixes that by first diagnosing the real reason a payment failed, then choosing the safest and smartest way to recover it, using simple fixed rules for the money-related decisions and Artificial Intelligence only where it genuinely helps — writing a clear, human message to the customer. Every action is logged, every action is capped so it can never spiral out of control, and the system proves its value by comparing itself directly against the old "blind retry" approach on the same data, live, in front of anyone watching.

## 10. How is "Failed Method" / Failure Detected? (FAQ for Judges)
Two different things again — be precise which one you mean:

**A) How does the system know a transaction failed at all?**
In a real production design, this would come from Razorpay's webhook — Razorpay automatically sends your server a notification the moment a payment fails, containing a `failureCode`. We deliberately did NOT build this for the demo (webhooks need a public server URL, extra setup) — instead, our seed script fakes this by directly writing "already-failed" transaction records into the database with a scripted `failureCode`, as if the webhook had already told you about them.

**B) How does the system figure out WHY it failed (the payment method issue)?**
This is the Classifier (`classifyFailure` function) — a simple lookup table, not AI:
- `BAD_REQUEST_ERROR` → invalid_card (bad card details)
- `GATEWAY_ERROR` → gateway_timeout (bank/network was slow)
- `INSUFFICIENT_FUNDS` → insufficient_funds
- `BANK_OFFLINE` → bank_offline

Razorpay's real API returns error codes exactly like this on every failed payment — this lookup table logic is genuinely how a production system would work, we just don't have live webhook data feeding it right now, we have scripted fake data standing in for it.

> **The honest one-liner for a judge:** "In production, this would come from Razorpay's payment-failure webhook in real time. For this demo, we generate realistic synthetic failure events with the same failure codes Razorpay actually uses, so the classification logic is real — only the trigger is simulated."

---

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
