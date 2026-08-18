# Architecture & System Design

## Overview
This project is a reliable, idempotent email scheduler built to handle delayed execution, hourly rate limiting, and inter-email delays without relying on cron jobs.

## Tech Stack
*   **Frontend:** React, TypeScript, Vite, Tailwind CSS
*   **Backend:** Node.js, Express, TypeScript
*   **Database:** PostgreSQL (via Prisma ORM)
*   **Queue & State:** Redis + BullMQ
*   **Email Provider:** Ethereal SMTP

## Core Workflow
1.  **UI:** User creates a campaign, uploads a CSV of recipients, and sets delay/hourly limits.
2.  **API:** Express validates the request, saves the `Campaign` and individual `Recipient` records in PostgreSQL.
3.  **Queue:** The API calculates the initial delay based on the user's scheduled time and pushes one BullMQ job per recipient to Redis.
4.  **Worker (BullMQ):**
    *   Pulls jobs based on priority and delay.
    *   Checks PostgreSQL to ensure the recipient status is not already `SENT` (Idempotency).
    *   Checks the Redis-backed hourly rate limiter. If the limit is reached, the job is delayed to the next window.
    *   Applies inter-email concurrency delay.
    *   Dispatches email via Ethereal SMTP.
    *   Updates PostgreSQL status to `SENT` or `FAILED`.

## Resilience Guarantees
*   **Restart Persistence:** All scheduled jobs reside in Redis. A server crash does not lose future tasks.
*   **Idempotency:** Unique `campaignId + recipientId` constraints and pre-send database checks prevent duplicate emails during worker retries.