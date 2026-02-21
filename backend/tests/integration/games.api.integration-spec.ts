import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { generateTestToken } from '../../src/auth/__tests__/test-helpers/jwt-token-generator';
import { GameState, Round } from '@prisma/client';

const JWT_SECRET = 'integration-test-jwt-secret';

describe('Games API (integration)', () => {
  let app: INestApplication<App>;
  const testUserId = 'integration-user-1';
  const testEmail = 'integration@test.com';
  const testGameId = 'game-integration-1';
  const testClueId = 'clue-fj-1';

  beforeAll(async () => {
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon';

    const mockPrisma = createMockPrisma(testUserId, testGameId, testClueId, testEmail);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Authentication', () => {
    it('GET /games should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/games')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Authorization');
        });
    });

    it('GET /games should return 401 with invalid token', () => {
      return request(app.getHttpServer())
        .get('/games')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('GET /games should return 200 with valid JWT', () => {
      const token = generateTestToken(
        { sub: testUserId, email: testEmail },
        { secret: JWT_SECRET },
      );
      return request(app.getHttpServer())
        .get('/games')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('games');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.games)).toBe(true);
        });
    });
  });

  describe('Game creation', () => {
    it('POST /games should return 201 with valid JWT and username', () => {
      const token = generateTestToken(
        { sub: testUserId, email: testEmail },
        { secret: JWT_SECRET },
      );
      return request(app.getHttpServer())
        .post('/games')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send({ username: 'IntegrationUser' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('state', GameState.ACTIVE);
          expect(res.body).toHaveProperty('score', 0);
          expect(res.body).toHaveProperty('finalJeopardy');
          expect(res.body.finalJeopardy).toHaveProperty('clue');
          expect(res.body).toHaveProperty('gameClues');
        });
    });

    it('POST /games should reject non-whitelisted body', () => {
      const token = generateTestToken(
        { sub: testUserId, email: testEmail },
        { secret: JWT_SECRET },
      );
      return request(app.getHttpServer())
        .post('/games')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send({ username: 'U', extraField: 'forbidden' })
        .expect(400);
    });
  });

  describe('Game retrieval', () => {
    it('GET /games/:id should return 401 without token', () => {
      return request(app.getHttpServer())
        .get(`/games/${testGameId}`)
        .expect(401);
    });

    it('GET /games/:id should return 200 with valid JWT and own game', () => {
      const token = generateTestToken(
        { sub: testUserId, email: testEmail },
        { secret: JWT_SECRET },
      );
      return request(app.getHttpServer())
        .get(`/games/${testGameId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(testGameId);
          expect(res.body.userId).toBe(testUserId);
        });
    });
  });
});

function createMockPrisma(
  userId: string,
  gameId: string,
  clueId: string,
  email: string,
): { client: any } {
  const finalClue = {
    id: clueId,
    category: 'Integration Category',
    round: Round.FINAL,
    value: 0,
    question: 'Integration Q?',
    answer: 'Integration A',
    dailyDouble: false,
    createdAt: new Date(),
  };
  const jeopardyValues = [200, 400, 600, 800, 1000];
  const doubleJeopardyValues = [400, 800, 1200, 1600, 2000];
  const categories = ['CatA', 'CatB', 'CatC', 'CatD', 'CatE', 'CatF'];
  const createClue = (round: Round, category: string, value: number) => ({
    id: `clue-${round}-${category}-${value}`,
    category,
    round,
    value,
    question: 'Q?',
    answer: 'A',
    dailyDouble: false,
    createdAt: new Date(),
  });
  const game = {
    id: gameId,
    userId,
    state: GameState.PENDING,
    score: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const activeGame = { ...game, state: GameState.ACTIVE };
  const finalJeopardy = {
    id: 'fj-1',
    gameId,
    clueId,
    wager: 0,
    correct: null,
    scoreDelta: null,
    answeredAt: null,
    clue: finalClue,
  };
  const gameClueStub = {
    id: 'gc-1',
    gameId,
    clueId,
    state: 'UNANSWERED',
    wager: null,
    scoreDelta: null,
    answeredAt: null,
    isDailyDouble: false,
    clue: createClue(Round.JEOPARDY, 'CatA', 200),
  };
  const gameWithRelations = {
    ...game,
    gameClues: [],
    finalJeopardy,
  };
  const gameCluesList = Array.from({ length: 60 }, (_, i) => {
    const isJeopardy = i < 30;
    const round = isJeopardy ? Round.JEOPARDY : Round.DOUBLE_JEOPARDY;
    const catIdx = i % 6;
    const valIdx = i % 5;
    const value = isJeopardy ? jeopardyValues[valIdx] : doubleJeopardyValues[valIdx];
    const isDD =
      (isJeopardy && i === 15) || (!isJeopardy && (i === 31 || i === 37));
    return {
      ...gameClueStub,
      id: `gc-${i}`,
      isDailyDouble: isDD,
      clue: createClue(round, categories[catIdx], value),
    };
  });
  const activeGameWithRelations = {
    ...activeGame,
    gameClues: gameCluesList,
    finalJeopardy,
  };

  const client = {
    user: {
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (args?.where?.id === userId) {
          return Promise.resolve({
            id: userId,
            email,
            username: 'IntegrationUser',
          });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue({ id: userId, email, username: 'IntegrationUser' }),
      update: jest.fn().mockResolvedValue({ id: userId, email, username: 'IntegrationUser' }),
    },
    clue: {
      findMany: jest.fn().mockImplementation((args: any) => {
        const where = args?.where || {};
        const distinct = args?.distinct;
        if (where.round === Round.FINAL) {
          return Promise.resolve([finalClue]);
        }
        if (distinct?.includes('category') && where.round) {
          return Promise.resolve(categories.map((c) => ({ category: c })));
        }
        if (where.round && where.category != null && where.value != null) {
          const clue = createClue(where.round, where.category, where.value);
          return Promise.resolve([clue]);
        }
        return Promise.resolve([]);
      }),
    },
    game: {
      create: jest.fn().mockResolvedValue(game),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (args?.where?.id === gameId) {
          const include = args?.include;
          const base = include?.gameClues ? activeGame : game;
          const result: any = { ...base };
          if (include?.gameClues) result.gameClues = activeGameWithRelations.gameClues;
          if (include?.finalJeopardy) result.finalJeopardy = { ...finalJeopardy, clue: finalClue };
          return Promise.resolve(result);
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([game]),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue(activeGame),
    },
    gameClue: {
      create: jest.fn().mockImplementation((args: any) =>
        Promise.resolve({
          id: `gc-${Math.random().toString(36).slice(2)}`,
          gameId: args?.data?.gameId,
          clueId: args?.data?.clueId,
          state: 'UNANSWERED',
          wager: null,
          scoreDelta: null,
          answeredAt: null,
          isDailyDouble: args?.data?.isDailyDouble ?? false,
        }),
      ),
      findMany: jest.fn().mockResolvedValue(activeGameWithRelations.gameClues),
    },
    finalJeopardy: {
      create: jest.fn().mockResolvedValue(finalJeopardy),
    },
    $transaction: jest.fn().mockImplementation((fnOrQueries: any) => {
      if (Array.isArray(fnOrQueries)) {
        return Promise.all(fnOrQueries);
      }
      return fnOrQueries(client);
    }),
  };

  let getGameWithCluesCallCount = 0;
  (client.game.findUnique as jest.Mock).mockImplementation((args: any) => {
    if (args?.where?.id === gameId) {
      const include = args?.include;
      const hasGameCluesInclude = include?.gameClues;
      if (hasGameCluesInclude) getGameWithCluesCallCount += 1;
      const isAfterStartGame = hasGameCluesInclude && getGameWithCluesCallCount > 1;
      const base = hasGameCluesInclude && isAfterStartGame ? activeGame : game;
      const result: any = { ...base };
      if (include?.gameClues) {
        result.gameClues = isAfterStartGame
          ? activeGameWithRelations.gameClues
          : [];
      }
      if (include?.finalJeopardy) result.finalJeopardy = { ...finalJeopardy, clue: finalClue };
      return Promise.resolve(result);
    }
    return Promise.resolve(null);
  });

  (client.$transaction as jest.Mock).mockImplementation((fnOrQueries: any) => {
    if (Array.isArray(fnOrQueries)) {
      return Promise.all(fnOrQueries);
    }
    const txClient = {
      ...client,
      game: {
        ...client.game,
        create: jest.fn().mockResolvedValue(game),
        findUnique: jest.fn().mockResolvedValue(gameWithRelations),
        update: jest.fn().mockResolvedValue(activeGame),
      },
      gameClue: client.gameClue,
      clue: client.clue,
      finalJeopardy: {
        create: jest.fn().mockResolvedValue(finalJeopardy),
      },
    };
    return fnOrQueries(txClient);
  });

  return { client };
}
