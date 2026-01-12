import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { GameService } from './game.service';
import { GameState, Round } from '@prisma/client';

describe('GameService', () => {
  let service: GameService;
  let prismaService: jest.Mocked<PrismaService>;
  let mockPrismaClient: any;

  beforeEach(async () => {
    // Create mock Prisma client
    mockPrismaClient = {
      clue: {
        findMany: jest.fn(),
      },
      game: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      finalJeopardy: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    // Create mock PrismaService
    prismaService = {
      client: mockPrismaClient,
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUserId', () => {
    it('should throw error for empty userId', () => {
      expect(() => (service as any).validateUserId('')).toThrow(
        'User ID is required',
      );
    });

    it('should throw error for whitespace-only userId', () => {
      expect(() => (service as any).validateUserId('   ')).toThrow(
        'User ID is required',
      );
    });

    it('should not throw for valid userId', () => {
      expect(() => (service as any).validateUserId('user-123')).not.toThrow();
    });
  });

  describe('selectFinalJeopardyClue', () => {
    it('should select first available clue', async () => {
      const mockClues = [
        {
          id: 'clue-1',
          category: 'CATEGORY A',
          round: Round.FINAL,
          value: 0,
          question: 'Question A?',
          answer: 'Answer A',
          dailyDouble: false,
          createdAt: new Date(),
        },
        {
          id: 'clue-2',
          category: 'CATEGORY B',
          round: Round.FINAL,
          value: 0,
          question: 'Question B?',
          answer: 'Answer B',
          dailyDouble: false,
          createdAt: new Date(),
        },
      ];

      mockPrismaClient.clue.findMany.mockResolvedValue([mockClues[0]]);

      const result = await (service as any).selectFinalJeopardyClue();

      expect(result).toEqual(mockClues[0]);
      expect(mockPrismaClient.clue.findMany).toHaveBeenCalledWith({
        where: { round: Round.FINAL },
        take: 1,
      });
    });

    it('should throw error when no clues available', async () => {
      mockPrismaClient.clue.findMany.mockResolvedValue([]);

      await expect(
        (service as any).selectFinalJeopardyClue(),
      ).rejects.toThrow('No Final Jeopardy clues available in database');
    });
  });

  describe('createGame', () => {
    const mockUserId = 'user-123';
    const mockClue = {
      id: 'clue-1',
      category: 'CATEGORY A',
      round: Round.FINAL,
      value: 0,
      question: 'Question A?',
      answer: 'Answer A',
      dailyDouble: false,
      createdAt: new Date('2024-01-01'),
    };

    const mockGame = {
      id: 'game-1',
      userId: mockUserId,
      state: GameState.PENDING,
      score: 0,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    const mockFinalJeopardy = {
      id: 'fj-1',
      gameId: mockGame.id,
      clueId: mockClue.id,
      wager: 0,
      correct: null,
      scoreDelta: null,
      answeredAt: null,
    };

    const mockGameWithRelations = {
      ...mockGame,
      finalJeopardy: {
        ...mockFinalJeopardy,
        clue: mockClue,
      },
    };

    it('should create game successfully', async () => {
      // Mock clue selection
      mockPrismaClient.clue.findMany.mockResolvedValue([mockClue]);

      // Mock transaction
      mockPrismaClient.$transaction.mockImplementation(
        async (callback: (prisma: any) => Promise<any>) => {
          const mockTransactionPrisma = {
            clue: mockPrismaClient.clue,
            game: {
              create: jest.fn().mockResolvedValue(mockGame),
              findUnique: jest.fn().mockResolvedValue(mockGameWithRelations),
            },
            finalJeopardy: {
              create: jest.fn().mockResolvedValue(mockFinalJeopardy),
            },
          };
          return callback(mockTransactionPrisma);
        },
      );

      const result = await service.createGame(mockUserId);

      expect(result.game.id).toBe(mockGame.id);
      expect(result.game.userId).toBe(mockUserId);
      expect(result.game.state).toBe(GameState.PENDING);
      expect(result.game.score).toBe(0);
      expect(result.game.finalJeopardy.clueId).toBe(mockClue.id);
      expect(result.game.finalJeopardy.wager).toBe(0);
      expect(result.game.finalJeopardy.clue.category).toBe(mockClue.category);
    });

    it('should throw error for empty userId', async () => {
      await expect(service.createGame('')).rejects.toThrow(
        'User ID is required',
      );
    });

    it('should throw error when no clues available', async () => {
      mockPrismaClient.clue.findMany.mockResolvedValue([]);

      await expect(service.createGame(mockUserId)).rejects.toThrow(
        'No Final Jeopardy clues available in database',
      );
    });

    it('should create game and FinalJeopardy in transaction', async () => {
      mockPrismaClient.clue.findMany.mockResolvedValue([mockClue]);

      let transactionGameCreate: jest.Mock;
      let transactionFinalJeopardyCreate: jest.Mock;

      mockPrismaClient.$transaction.mockImplementation(
        async (callback: (prisma: any) => Promise<any>) => {
          transactionGameCreate = jest.fn().mockResolvedValue(mockGame);
          transactionFinalJeopardyCreate = jest
            .fn()
            .mockResolvedValue(mockFinalJeopardy);

          const mockTransactionPrisma = {
            clue: mockPrismaClient.clue,
            game: {
              create: transactionGameCreate,
              findUnique: jest
                .fn()
                .mockResolvedValue(mockGameWithRelations),
            },
            finalJeopardy: {
              create: transactionFinalJeopardyCreate,
            },
          };
          return callback(mockTransactionPrisma);
        },
      );

      await service.createGame(mockUserId);

      expect(transactionGameCreate).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          state: GameState.PENDING,
          score: 0,
        },
      });

      expect(transactionFinalJeopardyCreate).toHaveBeenCalledWith({
        data: {
          gameId: mockGame.id,
          clueId: mockClue.id,
          wager: 0,
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaClient.clue.findMany.mockResolvedValue([mockClue]);
      mockPrismaClient.$transaction.mockRejectedValue(
        new Error('Database connection error'),
      );

      await expect(service.createGame(mockUserId)).rejects.toThrow(
        'Database connection error',
      );
    });

    it('should use deterministic clue selection (first available)', async () => {
      const clues = [
        { ...mockClue, id: 'clue-1', category: 'FIRST' },
        { ...mockClue, id: 'clue-2', category: 'SECOND' },
        { ...mockClue, id: 'clue-3', category: 'THIRD' },
      ];

      // Mock to return first clue only (take: 1)
      mockPrismaClient.clue.findMany.mockResolvedValue([clues[0]]);

      let selectedClueId: string;
      mockPrismaClient.$transaction.mockImplementation(
        async (callback: (prisma: any) => Promise<any>) => {
          const mockTransactionPrisma = {
            clue: mockPrismaClient.clue,
            game: {
              create: jest.fn().mockResolvedValue(mockGame),
              findUnique: jest.fn().mockResolvedValue({
                ...mockGameWithRelations,
                finalJeopardy: {
                  ...mockFinalJeopardy,
                  clue: clues[0],
                },
              }),
            },
            finalJeopardy: {
              create: jest.fn().mockImplementation((args: any) => {
                selectedClueId = args.data.clueId;
                return Promise.resolve({
                  ...mockFinalJeopardy,
                  clueId: args.data.clueId,
                });
              }),
            },
          };
          return callback(mockTransactionPrisma);
        },
      );

      await service.createGame(mockUserId);

      // Should always select first clue (deterministic)
      expect(selectedClueId).toBe('clue-1');
      expect(mockPrismaClient.clue.findMany).toHaveBeenCalledWith({
        where: { round: Round.FINAL },
        take: 1,
      });
    });
  });
});
