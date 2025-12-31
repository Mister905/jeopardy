# General Pre-Implementation Guide

This guide outlines the steps to complete **before** writing production code. The goal is to reduce ambiguity, prevent rework, and ensure the system is well-defined before implementation begins.

---

## 1. Define Project Intent

- Clarify the project’s purpose, scope, and constraints.
- Decide what the system will do and what it will explicitly not do.
- Identify primary users and expected outcomes.

---

## 2. Assess Data and Dependencies

- Identify all external data sources, APIs, or integrations.
- Evaluate reliability, limitations, and risk factors.
- Decide whether to use live data, static datasets, or mocks.

---

## 3. Lock Business Rules

- Explicitly document the rules governing core functionality.
- Include edge cases, error handling, and exceptional conditions.
- Declare which components are responsible for enforcing each rule.

---

## 4. Choose Architecture

- Select frontend, backend, database, and middleware technologies.
- Define separation of concerns to prevent accidental rule violations.
- Ensure the architecture supports scalability, maintainability, and testability.

---

## 5. Establish Determinism and Authority

- Identify authoritative sources of truth.
- Avoid hidden state, implicit logic, or runtime-only calculations.
- Persist all data required to reproduce system results.

---

## 6. Model Immutability and Auditability

- Determine which data must never change.
- Track all actions or changes that affect system state.
- Implement audit logs or history tables when traceability is required.

---

## 7. Simplify Early

- Remove unnecessary complexity before implementation.
- Focus on core functionality and postpone optional features.
- Avoid designing for hypothetical or unverified scenarios.

---

## 8. Iterate Schema and Data Model

- Refine until every business rule has a clear representation in the schema.
- Remove fields or abstractions that do not map directly to rules.
- Lock the schema once all rules are fully accounted for.

---

## 9. Define API or Interface Contracts

- Specify endpoints, inputs, outputs, and error responses.
- Include validation rules, preconditions, and postconditions.
- Ensure rules and state transitions are enforceable through the interface.

---

## 10. Lock Everything Before Code Generation

- Confirm all rules, schemas, and interfaces are finalized.
- Begin mechanical code generation, scaffolding, or automation only after everything is locked.

---
