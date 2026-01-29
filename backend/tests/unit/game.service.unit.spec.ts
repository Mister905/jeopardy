import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from '../../src/game/game.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UserService } from '../../src/user/user.service';
import { GameState, Round, ClueState } from '@prisma/client';

describe('GameService (unit)', () => {
  let service: GameService;
  let prismaService: jest.Mocked<PrismaService>;
  let userService: jest.Mocked<UserService>;
  let mockPrismaClient: any;

  beforeEach(async () => {
    mockPrismaClient = {
      game: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      gameClue: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: PrismaService, useValue: { client: mockPrismaClient } },
        {
          provide: UserService,
          useValue: {
            updateUserStatsOnClueResolved: jest.fn().mockResolvedValue(undefined),
            updateUserStatsOnDailyDoubleWager: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    prismaService = module.get(PrismaService);
    userService = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('answerClue', () => {
    const gameId = 'game-1';
    const clueId = 'gc-1';
    const userId = 'user-1';
    const baseGame = {
      id: gameId,
      userId,
      state: GameState.ACTIVE,
      score: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const baseClue = {
      id: 'clue-1',
      category: 'Science',
      round: Round.JEOPARDY,
      value: 400,
      question: 'Q?',
      answer: 'A',
      dailyDouble: false,
      createdAt: new Date(),
    };
    const baseGameClue = {
      id: clueId,
      gameId,
      clueId: baseClue.id,
      state: ClueState.UNANSWERED,
      isDailyDouble: false,
      wager: null,
      scoreDelta: null,
      answeredAt: null,
      clue: baseClue,
    };

    it('should throw when game not found', async () => {
      mockPrismaClient.game.findUnique.mockResolvedValue(null);

      await expect(
        service.answerClue(gameId, clueId, userId, true),
      ).rejects.toThrow('Game not found or access denied');
    });

    it('should throw when game is not ACTIVE', async () => {
      mockPrismaClient.game.findUnique.mockResolvedValue({
        ...baseGame,
        state: GameState.PENDING,
        gameClues: [],
        finalJeopardy: null,
      });

      await expect(
        service.answerClue(gameId, clueId, userId, true),
      ).rejects.toThrow(/not in an active state/);
    });

    it('should throw when clue not found', async () => {
      mockPrismaClient.game.findUnique.mockResolvedValue({
        ...baseGame,
        gameClues: [],
        finalJeopardy: null,
      });
      mockPrismaClient.gameClue.findUnique.mockResolvedValue(null);

      await expect(
        service.answerClue(gameId, clueId, userId, true),
      ).rejects.toThrow('Clue not found');
    });

    it('should throw when clue does not belong to game', async () => {
      mockPrismaClient.game.findUnique.mockResolvedValue({
        ...baseGame,
        gameClues: [],
        finalJeopardy: null,
      });
      mockPrismaClient.gameClue.findUnique.mockResolvedValue({
        ...baseGameClue,
        gameId: 'other-game',
      });

      await expect(
        service.answerClue(gameId, clueId, userId, true),
      ).rejects.toThrow('Clue does not belong to this game');
    });

    it('should throw when clue already resolved', async () => {
      mockPrismaClient.game.findUnique.mockResolvedValue({
        ...baseGame,
        gameClues: [],
        finalJeopardy: null,
      });
      mockPrismaClient.gameClue.findUnique.mockResolvedValue({
        ...baseGameClue,
        state: ClueState.RESOLVED,
      });

      await expect(
        service.answerClue(gameId, clueId, userId, true),
      ).rejects.toThrow('Clue has already been resolved');
    });

    it('should calculate correct score for correct regular clue', async () => {
      const updatedGameClue = {
        ...baseGameClue,
        state: ClueState.RESOLVED,
        scoreDelta: 400,
        answeredAt: new Date(),
        clue: baseClue,
      };
      mockPrismaClient.game.findUnique.mockResolvedValue({
        ...baseGame,
        gameClues: [],
        finalJeopardy: null,
      });
      mockPrismaClient.gameClue.findUnique.mockResolvedValue(baseGameClue);
      mockPrismaClient.gameClue.update.mockResolvedValue(updatedGameClue);
      mockPrismaClient.game.update.mockResolvedValue({
        ...baseGame,
        score: 1400,
      });
      mockPrismaClient.$transaction.mockImplementation(
        async (promises: Promise<unknown>[]) => Promise.all(promises),
      );
      mockPrismaClient.gameClue.findMany.mockResolvedValue([
        { ...baseGameClue, id: 'gc-1', state: ClueState.RESOLVED },
      ]);

      const result = await service.answerClue(gameId, clueId, userId, true);

      expect(result.newScore).toBe(1400);
      expect(userService.updateUserStatsOnClueResolved).toHaveBeenCalledWith(
        userId,
        expect.anything(),
        true,
      );
    });

    it('should calculate correct score for incorrect regular clue', async () => {
      mockPrismaClient.game.findUnique.mockResolvedValue({
        ...baseGame,
        gameClues: [],
        finalJeopardy: null,
      });
      mockPrismaClient.gameClue.findUnique.mockResolvedValue(baseGameClue);
      mockPrismaClient.gameClue.update.mockResolvedValue({
        ...baseGameClue,
        state: ClueState.RESOLVED,
        scoreDelta: -400,
        answeredAt: new Date(),
        clue: baseClue,
      });
      mockPrismaClient.game.update.mockResolvedValue({
        ...baseGame,
        score: 600,
      });
      mockPrismaClient.$transaction.mockImplementation(
        async (promises: Promise<unknown>[]) => Promise.all(promises),
      );
      mockPrismaClient.gameClue.findMany.mockResolvedValue([
        { ...baseGameClue, state: ClueState.RESOLVED },
      ]);

      const result = await service.answerClue(gameId, clueId, userId, false);

      expect(result.newScore).toBe(600);
    });

    it('should throw for Daily Double without wager', async () => {
      const ddClue = {
        ...baseGameClue,
        isDailyDouble: true,
        wager: null,
        state: ClueState.UNANSWERED,
      };
      mockPrismaClient.game.findUnique.mockResolvedValue({
        ...baseGame,
        gameClues: [],
        finalJeopardy: null,
      });
      mockPrismaClient.gameClue.findUnique.mockResolvedValue(ddClue);

      await expect(
        service.answerClue(gameId, clueId, userId, true),
      ).rejects.toThrow('Daily Double wager must be submitted before answering');
    });

    it('should use wager for Daily Double score delta', async () => {
      const ddClue = {
        ...baseGameClue,
        isDailyDouble: true,
        wager: 1000,
        state: ClueState.ANSWERED,
        clue: { ...baseClue, value: 800 },
      };
      mockPrismaClient.game.findUnique.mockResolvedValue({
        ...baseGame,
        score: 2000,
        gameClues: [],
        finalJeopardy: null,
      });
      mockPrismaClient.gameClue.findUnique.mockResolvedValue(ddClue);
      mockPrismaClient.gameClue.update.mockResolvedValue({
        ...ddClue,
        state: ClueState.RESOLVED,
        scoreDelta: 1000,
        answeredAt: new Date(),
        clue: ddClue.clue,
      });
      mockPrismaClient.game.update.mockResolvedValue({
        ...baseGame,
        score: 3000,
      });
      mockPrismaClient.$transaction.mockImplementation(
        async (promises: Promise<unknown>[]) => Promise.all(promises),
      );
      mockPrismaClient.gameClue.findMany.mockResolvedValue([
        { ...ddClue, state: ClueState.RESOLVED },
      ]);

      const result = await service.answerClue(gameId, clueId, userId, true);

      expect(result.newScore).toBe(3000);
      expect(userService.updateUserStatsOnDailyDoubleWager).toHaveBeenCalledWith(
        userId,
        1000,
        true,
      );
    });
  });

  describe('startGame', () => {
    const gameId = 'game-1';
    const userId = 'user-1';
    const baseGame = {
      id: gameId,
      userId,
      state: GameState.PENDING,
      score: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      gameClues: [],
      finalJeopardy: null,
    };

    it('should throw when game not found', async () => {
      mockPrismaClient.game.findUnique.mockResolvedValue(null);

      await expect(service.startGame(gameId, userId)).rejects.toThrow(
        'Game not found or access denied',
      );
    });

    it('should throw when game is not PENDING', async () => {
      mockPrismaClient.game.findUnique.mockResolvedValue({
        ...baseGame,
        state: GameState.ACTIVE,
      });

      await expect(service.startGame(gameId, userId)).rejects.toThrow(
        /cannot be started. Current state: ACTIVE/,
      );
    });

    it('should throw when user does not own game', async () => {
      mockPrismaClient.game.findUnique.mockResolvedValue(null);

      await expect(service.startGame(gameId, 'other-user')).rejects.toThrow(
        'Game not found or access denied',
      );
    });
  });
});
