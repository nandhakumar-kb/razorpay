# Razorpay Buildathon: AI Revenue Recovery

This repository contains our submission for the **Razorpay Buildathon (Track 3: AI Revenue Recovery)**. We have built an intelligent, Next.js-powered dashboard that doesn't just passively report failed payments, but actively diagnoses the *reason* for failure and orchestrates the best recovery action using Google's Gemini AI.

## 🚀 The Vision

Standard payment dashboards tell you *that* a payment failed. Our platform tells you:
1. **What** happened (The context: "₹4,255 payment from Jane Doe failed, 3rd attempt.")
2. **Why** it happened (Plain English Diagnosis: "Their card was declined \u2014 it looks invalid or expired.")
3. **Action Taken** (The AI's Logic: "Sent them a new payment link so they could pay another way.")
4. **Result** (The Outcome: "Recovered \u2014 they completed the payment.")

We replace cryptic error codes (`gateway_timeout`, `insufficient_funds`) with a human-readable narrative Audit Trail, proving exactly how and why revenue is being saved.

## 🏗️ Architecture

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL (via Prisma ORM)
- **AI Engine:** Google Gemini (`gemini-1.5-flash`) via the official `@google/generative-ai` SDK
- **Payments Integration:** Razorpay API (Mocked gracefully for uninterrupted demos)
- **Styling:** Custom CSS with a premium, narrative-focused design system

## ✨ Key Features

- **Live Narrative Audit Trail:** Translates raw database rows into an intuitive "What, Why, Action, Result" timeline.
- **AI vs Naive A/B Testing:** Compare standard retry logic against AI-driven smart actions, proving the superior recovery rate of AI.
- **Robust Next.js Server Actions:** All UI interactions (like "Simulate Pay" and "Approve Live") use strict React transitions coupled with Server Actions for instant, optimistic UI updates without layout jank.
- **Graceful Fallbacks:** Test Razorpay keys that return `401 Unauthorized` or `429 Too Many Requests` are safely mocked so the presentation never crashes.

## 🛠️ Local Setup Guide

Follow these steps to run the dashboard locally:

1. **Clone and Install**
   ```bash
   git clone https://github.com/nandhakumar-kb/razorpay.git
   cd razorpay
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root directory (use `.env.example` as a template):
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/razorpay"
   GEMINI_API_KEY="your_google_gemini_api_key"
   RAZORPAY_KEY_ID="rzp_test_yourkey"
   RAZORPAY_KEY_SECRET="your_razorpay_secret"
   ```

3. **Database Initialization**
   Push the schema to your Postgres database and generate the Prisma Client:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. **Seed the Database**
   Populate the dashboard with synthetic customers and failed transactions:
   ```bash
   npm run demo:reset
   ```

5. **Start the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🚀 Deployment (Vercel)

This project is fully structured for a 1-click Vercel deployment.

1. Push your repository to GitHub.
2. In Vercel, import the project.
3. In the **Environment Variables** section, add your `DATABASE_URL` (You can provision a Vercel Postgres database directly in the Vercel dashboard), `GEMINI_API_KEY`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET`.
4. Vercel will automatically run `npm run build`. The `postinstall: prisma generate` script in `package.json` ensures the database client is built correctly.
5. Once deployed, run `npm run demo:reset` via your local machine (pointing to the production `DATABASE_URL`) to seed the live database.

---
*Built with ❤️ for the Razorpay Buildathon.*
