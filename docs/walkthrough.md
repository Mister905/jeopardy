# Manual Setup + Cursor Workflow

The goal is to ultimately remove ambiguity before it can cost you time.

## Workflow Overview

- `create_brief.md` → locks intent
- `business_rules.md` → locks behavior
- `design_schema.md` → locks Prisma models
- `plan_feature.md` → plans implementation
- Cursor implementation → writes code

## Directory Structure

```
docs/
  commands/
    create_brief.md
    business_rules.md
    design_schema.md
    plan_feature.md
    code_review.md
  features/
    0001_PLAN.md
    0001_REVIEW.md
```

---

## Phase 1: Project Setup + Pre-Cursor Docs

### Step 1: Create Project Structure

```bash
mkdir jeopardy
cd jeopardy
mkdir -p docs/commands docs/features
```

### Step 2: Create Pre-Implementation Documentation

```bash
cd docs/commands
touch create_brief.md
touch business_rules.md
```

**Note:** Customize these files using:
- `general_pre_implementation_guide.md` for `create_brief.md`
- `game_rules_specification.md` for `business_rules.md`

### Step 3: Validate Pre-Cursor Docs with Cursor

Open a new Cursor chat and run:

```
@create_brief.md
"Confirm you understand the project constraints and rules. Do not write code yet."

@business_rules.md
"Confirm you understand the business rules. Do not write code yet."
```

---

## Phase 2: Backend + Prisma Environment

### Step 1: Scaffold NestJS Backend

```bash
cd jeopardy
npx @nestjs/cli new backend
cd backend
```

### Step 2: Install Dependencies

```bash
npm install @nestjs/config @prisma/client prisma
```

### Step 3: Initialize Prisma

```bash
npx prisma init
# Creates prisma/schema.prisma and .env
```

### Step 4: Configure Database Connection

1. Create a Supabase project
2. Copy the Session pooler connection string (IPv4-compatible)
3. Set in `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:[PROJECT_ID]:[PASSWORD]@[POOLER_URL]:5432/postgres"
```

### Step 5: Configure NestJS to Load Environment Variables

Update `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

---

## Phase 3: Lock Prisma Schema via Cursor

### Step 1: Create Schema Design Document

```bash
cd docs/commands
touch design_schema.md
# Paste template for authoritative Prisma schema
```

### Step 2: Generate Schema with Cursor

Open a new Cursor chat and run:

```
@design_schema.md
"Produce a Prisma schema that represents all domain entities,
relationships, and invariants described in create_brief.md and business_rules.md.
Do not write application code yet."
```

### Step 3: Apply Generated Schema

1. Replace `backend/prisma/schema.prisma` with the Cursor-generated schema
2. Run Prisma migration:

```bash
cd backend
npx prisma migrate dev --name init
# Creates tables in Supabase and generates Prisma Client
```

3. Generate Prisma client:

```bash
npx prisma generate
```

### Step 4: Create Prisma Module and Service

```bash
npx nest g module prisma
npx nest g service prisma
```

### Step 5: Implement PrismaService

Update `backend/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

### Step 6: Export PrismaService

Update `backend/src/prisma/prisma.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## Phase 4: Feature Planning + Implementation

### Step 1: Create Feature Plan

```bash
cd docs/features
touch 0001_PLAN.md
```

### Step 2: Generate Feature Plan with Cursor

Open a new Cursor chat and run:

```
@plan_feature.md

Feature: Create Game Endpoint

Purpose: Implement the API endpoint to create a new game for a single authenticated user.
Inputs: User ID from JWT
Outputs: Game object with initial score, board state, and metadata
Rules: Follow business_rules.md for game initialization, deterministic state, and persistence
Dependencies: Prisma schema (design_schema.md), backend modules
```

This will generate a detailed plan in `docs/features/0001_PLAN.md`.

### Step 3: Implement Feature

Open a new Cursor chat and run:

```
"Please implement docs/features/0001_PLAN.md"
```

### Step 4: Code Review

**Important:** Open a **new chat** for unbiased context and run:

```
@code_review.md
@0001_PLAN.md
```

This reviews the implementation in a clean context to catch errors, inconsistencies, or edge cases. This helps remove confirmation bias from the review process.

The review will be documented in `docs/features/0001_REVIEW.md`.

### Step 5: Address Code Review Findings

In the same review chat, fix issues:

```
"Please implement fixes for all the issues found in docs/features/0001_REVIEW.md"
```

This closes the loop and ensures the implementation aligns with the plan and rules.

---

## Key Principles

1. **Manual setup first**: NestJS + Prisma setup prepares the environment for Cursor
2. **Lock intent early**: Pre-cursor docs (`create_brief.md` + `business_rules.md`) lock intent and rules
3. **Cursor generates, you decide**: Cursor generates schema and feature code, never product decisions
4. **Schema before migrations**: Replace `schema.prisma` before running migrations
5. **Follow the order**: This sequence avoids conflicts, redundant steps, or schema drift
6. **Fresh context for reviews**: Always use a new chat for code reviews to remove confirmation bias