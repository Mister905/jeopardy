import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from './user.service';
import { Round } from '@prisma/client';

describe('UserService', () => {
  let service: UserService;
  let prismaService: jest.Mocked<PrismaService>;
  let mockPrismaClient: any;

  beforeEach(async () => {
    // Create mock Prisma client
    mockPrismaClient = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    // Create mock PrismaService
    prismaService = {
      client: mockPrismaClient,
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureUserExists', () => {
    const userId = 'user-123';
    const email = 'test@example.com';
    const username = 'testuser';

    it('should return existing user if found', async () => {
      const existingUser = {
        id: userId,
        email,
        username: 'existinguser',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.ensureUserExists(userId, email, username);

      expect(result).toEqual(existingUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockPrismaClient.user.create).not.toHaveBeenCalled();
      expect(mockPrismaClient.user.update).not.toHaveBeenCalled();
    });

    it('should update username if user exists but username is missing', async () => {
      const existingUser = {
        id: userId,
        email,
        username: null,
      };
      const updatedUser = {
        ...existingUser,
        username,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      const result = await service.ensureUserExists(userId, email, username);

      expect(result).toEqual(updatedUser);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { username: username.trim() },
      });
    });

    it('should create new user if not found', async () => {
      const newUser = {
        id: userId,
        email,
        username,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue(newUser);

      const result = await service.ensureUserExists(userId, email, username);

      expect(result).toEqual(newUser);
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: {
          id: userId,
          email: email.trim(),
          username: username.trim(),
        },
      });
    });

    it('should throw error if username is required but not provided for new user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(
        service.ensureUserExists(userId, email, undefined),
      ).rejects.toThrow('Username is required for new users');
    });

    it('should validate username length', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(
        service.ensureUserExists(userId, email, 'ab'), // Too short
      ).rejects.toThrow('Username must be between 3 and 50 characters');

      await expect(
        service.ensureUserExists(userId, email, 'a'.repeat(51)), // Too long
      ).rejects.toThrow('Username must be between 3 and 50 characters');
    });

    it('should validate username is not empty', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(
        service.ensureUserExists(userId, email, '   '), // Only whitespace
      ).rejects.toThrow('Username must be a non-empty string');
    });

    it('should throw error if email is empty for new user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(
        service.ensureUserExists(userId, '', username),
      ).rejects.toThrow('Email is required for new users');
    });
  });

  describe('getUserProfile', () => {
    const userId = 'user-123';
    const mockUser = {
      id: userId,
      username: 'testuser',
      totalGamesPlayed: 5,
      averageScore: 1000.5,
      bestScore: 2000,
      worstScore: -500,
      totalWinnings: 5000,
      totalCorrectAnswers: 30,
      totalIncorrectAnswers: 20,
      jeopardyCorrect: 10,
      jeopardyIncorrect: 5,
      doubleJeopardyCorrect: 15,
      doubleJeopardyIncorrect: 10,
      finalJeopardyCorrect: 3,
      finalJeopardyIncorrect: 2,
      dailyDoubleCorrect: 2,
      dailyDoubleIncorrect: 1,
      currentCorrectStreak: 5,
      longestCorrectStreak: 10,
      currentIncorrectStreak: 0,
      longestIncorrectStreak: 3,
      largestSuccessfulDailyDoubleWager: 1000,
      largestSuccessfulFinalJeopardyWager: 2000,
      largestUnsuccessfulDailyDoubleWager: 500,
      largestUnsuccessfulFinalJeopardyWager: 1000,
    };

    it('should return user profile with computed accuracy', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserProfile(userId);

      expect(result.username).toBe(mockUser.username);
      expect(result.stats.totalGamesPlayed).toBe(mockUser.totalGamesPlayed);
      expect(result.stats.overallAccuracy).toBeCloseTo(60.0); // 30 / 50 * 100
      expect(result.stats.jeopardyAccuracy).toBeCloseTo(66.67); // 10 / 15 * 100
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should return null accuracy when no answers', async () => {
      const userWithNoAnswers = {
        ...mockUser,
        totalCorrectAnswers: 0,
        totalIncorrectAnswers: 0,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(userWithNoAnswers);

      const result = await service.getUserProfile(userId);

      expect(result.stats.overallAccuracy).toBeNull();
    });

    it('should throw error if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserProfile(userId)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('calculateAccuracy', () => {
    it('should calculate accuracy correctly', () => {
      // Access private method via type assertion for testing
      const serviceAny = service as any;
      expect(serviceAny.calculateAccuracy(10, 5)).toBeCloseTo(66.67);
      expect(serviceAny.calculateAccuracy(0, 5)).toBe(0);
      expect(serviceAny.calculateAccuracy(5, 0)).toBe(100);
    });

    it('should return null when total is zero', () => {
      const serviceAny = service as any;
      expect(serviceAny.calculateAccuracy(0, 0)).toBeNull();
    });
  });

  describe('updateUserStatsOnClueResolved', () => {
    const userId = 'user-123';
    const gameClue = {
      id: 'clue-123',
      isDailyDouble: false,
      wager: null,
      clue: {
        round: Round.JEOPARDY,
      },
    };

    it('should update stats for correct answer in Jeopardy round', async () => {
      const existingUser = {
        currentCorrectStreak: 2,
        currentIncorrectStreak: 0,
        longestCorrectStreak: 5,
        longestIncorrectStreak: 3,
        totalCorrectAnswers: 10,
        totalIncorrectAnswers: 5,
        jeopardyCorrect: 4,
        jeopardyIncorrect: 2,
        doubleJeopardyCorrect: 6,
        doubleJeopardyIncorrect: 3,
        dailyDoubleCorrect: 0,
        dailyDoubleIncorrect: 0,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnClueResolved(
        userId,
        gameClue as any,
        true,
      );

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          totalCorrectAnswers: 11,
          jeopardyCorrect: 5,
          currentCorrectStreak: 3,
          currentIncorrectStreak: 0,
          longestCorrectStreak: 5,
        }),
      });
    });

    it('should update longest streak when current exceeds longest', async () => {
      const existingUser = {
        currentCorrectStreak: 5,
        currentIncorrectStreak: 0,
        longestCorrectStreak: 5,
        longestIncorrectStreak: 3,
        totalCorrectAnswers: 20,
        totalIncorrectAnswers: 10,
        jeopardyCorrect: 8,
        jeopardyIncorrect: 4,
        doubleJeopardyCorrect: 12,
        doubleJeopardyIncorrect: 6,
        dailyDoubleCorrect: 0,
        dailyDoubleIncorrect: 0,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnClueResolved(
        userId,
        gameClue as any,
        true,
      );

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          longestCorrectStreak: 6,
        }),
      });
    });

    it('should update Daily Double stats when applicable', async () => {
      const dailyDoubleClue = {
        ...gameClue,
        isDailyDouble: true,
        wager: 1000,
      };
      const existingUser = {
        currentCorrectStreak: 0,
        currentIncorrectStreak: 0,
        longestCorrectStreak: 0,
        longestIncorrectStreak: 0,
        totalCorrectAnswers: 0,
        totalIncorrectAnswers: 0,
        jeopardyCorrect: 0,
        jeopardyIncorrect: 0,
        doubleJeopardyCorrect: 0,
        doubleJeopardyIncorrect: 0,
        dailyDoubleCorrect: 0,
        dailyDoubleIncorrect: 0,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnClueResolved(
        userId,
        dailyDoubleClue as any,
        true,
      );

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          dailyDoubleCorrect: 1,
        }),
      });
    });

    it('should handle errors gracefully without throwing', async () => {
      mockPrismaClient.user.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.updateUserStatsOnClueResolved(userId, gameClue as any, true),
      ).resolves.not.toThrow();
    });
  });

  describe('updateUserStatsOnGameComplete', () => {
    const userId = 'user-123';
    const finalScore = 1500;

    it('should update game completion stats correctly', async () => {
      const existingUser = {
        totalGamesPlayed: 4,
        averageScore: 1000,
        bestScore: 2000,
        worstScore: -500,
        totalWinnings: 3500,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnGameComplete(userId, finalScore);

      const expectedAverage = (1000 * 4 + 1500) / 5; // 1100

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          totalGamesPlayed: 5,
          averageScore: expectedAverage,
          totalWinnings: 5000,
        }),
      });
    });

    it('should update best score when final score is higher', async () => {
      const existingUser = {
        totalGamesPlayed: 4,
        averageScore: 1000,
        bestScore: 1000,
        worstScore: -500,
        totalWinnings: 3500,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnGameComplete(userId, 2500);

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          bestScore: 2500, // Updated
        }),
      });
    });

    it('should not increment totalWinnings for negative scores', async () => {
      const existingUser = {
        totalGamesPlayed: 4,
        averageScore: 1000,
        bestScore: 2000,
        worstScore: -500,
        totalWinnings: 3500,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnGameComplete(userId, -1000);

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          totalWinnings: 3500, // Unchanged (score was negative)
        }),
      });
    });

    it('should update worst score for negative scores', async () => {
      const existingUser = {
        totalGamesPlayed: 4,
        averageScore: 1000,
        bestScore: 2000,
        worstScore: -500,
        totalWinnings: 3500,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnGameComplete(userId, -1000);

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          worstScore: -1000, // Updated because -1000 < -500
        }),
      });
    });

    it('should update worst score when starting from null with negative score', async () => {
      const existingUser = {
        totalGamesPlayed: 0,
        averageScore: 0,
        bestScore: null,
        worstScore: null,
        totalWinnings: 0,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnGameComplete(userId, -500);

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          worstScore: -500, // Set from null
        }),
      });
    });

    it('should handle null best/worst scores', async () => {
      const existingUser = {
        totalGamesPlayed: 0,
        averageScore: 0,
        bestScore: null,
        worstScore: null,
        totalWinnings: 0,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnGameComplete(userId, 1500);

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          bestScore: 1500, // Set from null
          worstScore: 1500, // Set from null
        }),
      });
    });
  });

  describe('updateUserStatsOnDailyDoubleWager', () => {
    const userId = 'user-123';
    const wager = 1000;

    it('should update largest successful wager when larger', async () => {
      const existingUser = {
        largestSuccessfulDailyDoubleWager: 500,
        largestUnsuccessfulDailyDoubleWager: 200,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnDailyDoubleWager(userId, wager, true);

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          largestSuccessfulDailyDoubleWager: wager,
        },
      });
    });

    it('should not update if wager is smaller', async () => {
      const existingUser = {
        largestSuccessfulDailyDoubleWager: 2000,
        largestUnsuccessfulDailyDoubleWager: 200,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnDailyDoubleWager(userId, wager, true);

      expect(mockPrismaClient.user.update).not.toHaveBeenCalled();
    });

    it('should handle null existing wager', async () => {
      const existingUser = {
        largestSuccessfulDailyDoubleWager: null,
        largestUnsuccessfulDailyDoubleWager: null,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaClient.user.update.mockResolvedValue({});

      await service.updateUserStatsOnDailyDoubleWager(userId, wager, true);

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          largestSuccessfulDailyDoubleWager: wager,
        },
      });
    });
  });
});
