# Backend Tests

## Structure

- **`tests/unit/`** — Unit tests for services (GameService, UserService). These run with Jest using mocked Prisma and UserService. They validate business logic in isolation.
- **`tests/integration/`** — Integration tests for API endpoints. They use the full `AppModule` with Prisma overridden by a seeded mock so tests run without a real database and are deterministic.
- **`test/`** — E2E tests (e.g. `auth.e2e-spec.ts`) that run with `npm run test:e2e`.

## Running Tests

| Command | Description |
|--------|-------------|
| `npm run test` | Unit tests (src/**/*.spec.ts and tests/unit/**/*.spec.ts) |
| `npm run test:integration` | API integration tests (tests/integration/*.integration-spec.ts) |
| `npm run test:e2e` | E2E tests (test/*.e2e-spec.ts) |
| `npm run test:cov` | Unit tests with coverage |

## Mocking

- **Unit tests**: Prisma and UserService are mocked in the test module. No database or external APIs are used.
- **Integration tests**: Prisma is overridden with a mock that returns deterministic seed data (user, game, Final Jeopardy clue). JWT auth uses `generateTestToken` from `src/auth/__tests__/test-helpers/jwt-token-generator.ts` with a test secret.
- **External dependencies**: There is no Cluebase API in this codebase; clues come from the database (ingested from files). For tests that need clue data, the integration mock provides a single Final Jeopardy clue so `POST /games` and `GET /games/:id` succeed.

## Test Database (Optional)

To run integration tests against a real test database:

1. Set `DATABASE_URL` (or `TEST_DATABASE_URL`) to a dedicated test Postgres instance.
2. Run `npx prisma migrate deploy` and seed clues.
3. Integration tests currently use a **mocked** Prisma by default so they do not require a DB. To add real-DB integration tests, add a separate spec that skips when `TEST_DATABASE_URL` is unset and uses the real PrismaService.
