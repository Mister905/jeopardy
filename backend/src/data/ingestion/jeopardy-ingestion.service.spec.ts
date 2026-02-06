import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { JeopardyIngestionService } from './jeopardy-ingestion.service';
import { Round } from '@prisma/client';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('JeopardyIngestionService', () => {
  let service: JeopardyIngestionService;
  let prismaService: jest.Mocked<PrismaService>;
  let mockPrismaClient: any;

  beforeEach(async () => {
    // Create mock Prisma client
    mockPrismaClient = {
      clue: {
        findMany: jest.fn(),
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
        JeopardyIngestionService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<JeopardyIngestionService>(
      JeopardyIngestionService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateClue', () => {
    it('should return null for valid Jeopardy clue', () => {
      const clue = {
        seasonNumber: 33,
        round: '1' as const,
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: 'QUESTION?',
        value: 200,
        dailyDouble: false,
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toBeNull();
    });

    it('should return null for valid Double Jeopardy clue', () => {
      const clue = {
        seasonNumber: 33,
        round: '2' as const,
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: 'QUESTION?',
        value: 400,
        dailyDouble: false,
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toBeNull();
    });

    it('should return error for empty category', () => {
      const clue = {
        seasonNumber: 33,
        round: '1' as const,
        category: '   ',
        answer: 'ANSWER',
        question: 'QUESTION?',
        value: 200,
        dailyDouble: false,
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toBe('Category is empty or only whitespace');
    });

    it('should return error for empty answer', () => {
      const clue = {
        seasonNumber: 33,
        round: '1' as const,
        category: 'CATEGORY',
        answer: '',
        question: 'QUESTION?',
        value: 200,
        dailyDouble: false,
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toBe('Answer is empty or only whitespace');
    });

    it('should return error for empty question', () => {
      const clue = {
        seasonNumber: 33,
        round: '1' as const,
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: '\t',
        value: 200,
        dailyDouble: false,
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toBe('Question is empty or only whitespace');
    });

    it('should return error for invalid round', () => {
      const clue = {
        seasonNumber: 33,
        round: '3' as any,
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: 'QUESTION?',
        value: 200,
        dailyDouble: false,
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toContain('Invalid round');
      expect(result).toContain('3');
    });

    it('should return error for invalid Jeopardy clue value', () => {
      const clue = {
        seasonNumber: 33,
        round: '1' as const,
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: 'QUESTION?',
        value: 300, // Invalid
        dailyDouble: false,
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toContain('Invalid Jeopardy clue value: 300');
    });

    it('should return error for invalid Double Jeopardy clue value', () => {
      const clue = {
        seasonNumber: 33,
        round: '2' as const,
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: 'QUESTION?',
        value: 500, // Invalid
        dailyDouble: false,
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toContain('Invalid Double Jeopardy clue value: 500');
    });

    it('should return error for non-boolean dailyDouble', () => {
      const clue = {
        seasonNumber: 33,
        round: '1' as const,
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: 'QUESTION?',
        value: 200,
        dailyDouble: 'true' as any,
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toContain('Invalid dailyDouble');
    });
  });

  describe('createDeduplicationKey', () => {
    it('should create key from clue data (aligned with parser service)', () => {
      const clue = {
        seasonNumber: 33,
        round: '1' as const,
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: 'QUESTION?',
        value: 200,
        dailyDouble: false,
        sourceFile: 'season33.tsv',
      };

      const key = (service as any).createDeduplicationKey(clue);
      expect(key).toBe('1|CATEGORY|QUESTION?|ANSWER');
    });
  });

  describe('readAndParseFile', () => {
    it('should read and parse valid JSON file', async () => {
      const testData = {
        metadata: { totalClues: 2 },
        clues: [
          {
            seasonNumber: 33,
            round: '1' as const,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            value: 200,
            dailyDouble: false,
            sourceFile: 'season33.tsv',
          },
          {
            seasonNumber: 34,
            round: '2' as const,
            category: 'CATEGORY B',
            answer: 'Answer B',
            question: 'Question B?',
            value: 400,
            dailyDouble: false,
            sourceFile: 'season34.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));

      const result = await (service as any).readAndParseFile('/test/file.json');

      expect(result.clues.length).toBe(2);
      expect(result.clues[0].category).toBe('CATEGORY A');
    });

    it('should throw error for invalid JSON', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('invalid json');

      await expect(
        (service as any).readAndParseFile('/test/file.json'),
      ).rejects.toThrow('Invalid JSON');
    });

    it('should throw error for missing clues array', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify({ metadata: {} }),
      );

      await expect(
        (service as any).readAndParseFile('/test/file.json'),
      ).rejects.toThrow('Invalid file structure');
    });

    it('should throw error for file not found', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      await expect(
        (service as any).readAndParseFile('/test/file.json'),
      ).rejects.toThrow('File not found');
    });
  });

  describe('ingestFromParsedFile', () => {
    it('should ingest valid Jeopardy and Double Jeopardy clues successfully', async () => {
      const testData = {
        metadata: { totalClues: 2 },
        clues: [
          {
            seasonNumber: 33,
            round: '1' as const,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            value: 200,
            dailyDouble: false,
            sourceFile: 'season33.tsv',
          },
          {
            seasonNumber: 34,
            round: '2' as const,
            category: 'CATEGORY B',
            answer: 'Answer B',
            question: 'Question B?',
            value: 400,
            dailyDouble: true,
            sourceFile: 'season34.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      mockPrismaClient.clue.findMany.mockResolvedValue([]); // No duplicates
      mockPrismaClient.clue.create.mockResolvedValue({ id: 'clue-id' });
      mockPrismaClient.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTx = { clue: mockPrismaClient.clue };
          return callback(mockTx);
        },
      );

      const result = await service.ingestFromParsedFile('/test/file.json');

      expect(result.totalCluesProcessed).toBe(2);
      expect(result.validClues).toBe(2);
      expect(result.cluesInserted).toBe(2);
      expect(result.duplicatesSkipped).toBe(0);
      expect(result.errors.length).toBe(0);

      // Verify correct round mapping (service uses tx.clue.create inside $transaction)
      expect(mockPrismaClient.clue.create).toHaveBeenCalledTimes(2);
      const createCalls = mockPrismaClient.clue.create.mock.calls;
      expect(createCalls[0][0].data.round).toBe(Round.JEOPARDY);
      expect(createCalls[1][0].data.round).toBe(Round.DOUBLE_JEOPARDY);
      expect(createCalls[1][0].data.dailyDouble).toBe(true);
    });

    it('should skip invalid clues', async () => {
      const testData = {
        metadata: { totalClues: 2 },
        clues: [
          {
            seasonNumber: 33,
            round: '1' as const,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            value: 200,
            dailyDouble: false,
            sourceFile: 'season33.tsv',
          },
          {
            seasonNumber: 34,
            round: '1' as const,
            category: '', // Invalid
            answer: 'Answer B',
            question: 'Question B?',
            value: 200,
            dailyDouble: false,
            sourceFile: 'season34.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      mockPrismaClient.clue.findMany.mockResolvedValue([]);
      mockPrismaClient.clue.create.mockResolvedValue({ id: 'clue-id' });
      mockPrismaClient.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTx = { clue: mockPrismaClient.clue };
          return callback(mockTx);
        },
      );

      const result = await service.ingestFromParsedFile('/test/file.json');

      expect(result.totalCluesProcessed).toBe(2);
      expect(result.validClues).toBe(1);
      expect(result.invalidClues).toBe(1);
      expect(result.cluesInserted).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].type).toBe('validation');
    });

    it('should skip duplicate clues in database (Jeopardy)', async () => {
      const testData = {
        metadata: { totalClues: 1 },
        clues: [
          {
            seasonNumber: 33,
            round: '1' as const,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            value: 200,
            dailyDouble: false,
            sourceFile: 'season33.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      // Simulate existing clue in database
      mockPrismaClient.clue.findMany.mockResolvedValue([
        {
          round: Round.JEOPARDY,
          category: 'CATEGORY A',
          question: 'Question A?',
          answer: 'Answer A',
        },
      ]);

      const result = await service.ingestFromParsedFile('/test/file.json');

      expect(result.totalCluesProcessed).toBe(1);
      expect(result.validClues).toBe(1);
      expect(result.cluesInserted).toBe(0);
      expect(result.duplicatesSkipped).toBe(1);
      expect(mockPrismaClient.clue.create).not.toHaveBeenCalled();
    });

    it('should skip duplicate clues in database (Double Jeopardy)', async () => {
      const testData = {
        metadata: { totalClues: 1 },
        clues: [
          {
            seasonNumber: 33,
            round: '2' as const,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            value: 400,
            dailyDouble: false,
            sourceFile: 'season33.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      mockPrismaClient.clue.findMany.mockResolvedValue([
        {
          round: Round.DOUBLE_JEOPARDY,
          category: 'CATEGORY A',
          question: 'Question A?',
          answer: 'Answer A',
        },
      ]);

      const result = await service.ingestFromParsedFile('/test/file.json');

      expect(result.duplicatesSkipped).toBe(1);
      expect(mockPrismaClient.clue.create).not.toHaveBeenCalled();
    });

    it('should skip duplicates within the same batch', async () => {
      const testData = {
        metadata: { totalClues: 2 },
        clues: [
          {
            seasonNumber: 33,
            round: '1' as const,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            value: 200,
            dailyDouble: false,
            sourceFile: 'season33.tsv',
          },
          {
            seasonNumber: 34,
            round: '1' as const,
            category: 'CATEGORY A', // Same as first
            answer: 'Answer A', // Same as first
            question: 'Question A?', // Same as first
            value: 200,
            dailyDouble: false,
            sourceFile: 'season34.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      mockPrismaClient.clue.findMany.mockResolvedValue([]);
      mockPrismaClient.clue.create.mockResolvedValue({ id: 'clue-id' });
      mockPrismaClient.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTx = { clue: mockPrismaClient.clue };
          return callback(mockTx);
        },
      );

      const result = await service.ingestFromParsedFile('/test/file.json');

      expect(result.totalCluesProcessed).toBe(2);
      expect(result.validClues).toBe(1); // One duplicate in batch
      expect(result.duplicatesSkipped).toBe(1);
      expect(result.cluesInserted).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      const testData = {
        metadata: { totalClues: 1 },
        clues: [
          {
            seasonNumber: 33,
            round: '1' as const,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            value: 200,
            dailyDouble: false,
            sourceFile: 'season33.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      mockPrismaClient.clue.findMany.mockRejectedValue(
        new Error('Database connection error'),
      );

      const result = await service.ingestFromParsedFile('/test/file.json');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('database');
    });

    it('should query for duplicates separately by round', async () => {
      const testData = {
        metadata: { totalClues: 2 },
        clues: [
          {
            seasonNumber: 33,
            round: '1' as const,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            value: 200,
            dailyDouble: false,
            sourceFile: 'season33.tsv',
          },
          {
            seasonNumber: 34,
            round: '2' as const,
            category: 'CATEGORY B',
            answer: 'Answer B',
            question: 'Question B?',
            value: 400,
            dailyDouble: false,
            sourceFile: 'season34.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      mockPrismaClient.clue.findMany
        .mockResolvedValueOnce([]) // Jeopardy query
        .mockResolvedValueOnce([]); // Double Jeopardy query
      mockPrismaClient.clue.create.mockResolvedValue({ id: 'clue-id' });
      mockPrismaClient.$transaction.mockImplementation(
        async (promises: Promise<any>[]) => {
          return Promise.all(promises);
        },
      );

      await service.ingestFromParsedFile('/test/file.json');

      // Verify two separate queries were made (one for each round)
      expect(mockPrismaClient.clue.findMany).toHaveBeenCalledTimes(2);
      const findManyCalls = mockPrismaClient.clue.findMany.mock.calls;
      expect(findManyCalls[0][0].where.round).toBe(Round.JEOPARDY);
      expect(findManyCalls[1][0].where.round).toBe(Round.DOUBLE_JEOPARDY);
    });
  });
});
