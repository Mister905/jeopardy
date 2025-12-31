You are designing the authoritative database schema for this system.

Your task is to produce a complete and correct Prisma schema that represents
the domain, business rules, and invariants described below.

This is a DESIGN step, not an implementation step.

---

## Inputs

You must treat the following documents as authoritative:

- create_brief.md
- business_rules.md

If information is missing, you may ask clarifying questions **before**
producing the schema. Do not make assumptions.

---

## Requirements

1. Produce Prisma models only
   - No NestJS code
   - No controllers or services
   - No feature logic
   - No API routes

2. The schema must:
   - Represent all core domain entities
   - Encode business rules structurally where possible
   - Prevent invalid states through data modeling
   - Clearly distinguish mutable vs immutable data

3. Explicitly consider:
   - Primary keys and foreign keys
   - Required vs optional fields
   - One-to-many and many-to-many relationships
   - State fields and allowed values
   - Uniqueness constraints
   - Indexes required for correctness or performance
   - Audit fields (createdAt, updatedAt, etc.)

4. Do NOT:
   - Add fields “just in case”
   - Design for future features not described
   - Encode business logic that belongs in the service layer
   - Infer rules that are not stated

---

## Determinism & Authority

- The database is the source of truth for persisted state
- All data required to reproduce system behavior must be stored
- Derived or transient values should NOT be persisted unless required

---

## Output Format

1. A short summary (5–10 bullets) explaining:
   - The core entities
   - Key relationships
   - Important invariants enforced by the schema

2. A complete `schema.prisma` file including:
   - datasource
   - generator
   - all models
   - enums (if applicable)

3. Inline comments explaining:
   - Why key fields exist
   - Why constraints or indexes were chosen
   - Any tradeoffs made

---

## Quality Bar

This schema should be stable enough that:
- Feature plans do not casually require schema changes
- Migrations are rare and deliberate
- New developers can understand the domain by reading the models

If you are unsure about a modeling decision, stop and ask.