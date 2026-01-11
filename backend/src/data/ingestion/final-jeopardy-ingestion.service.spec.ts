import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { FinalJeopardyIngestionService } from './final-jeopardy-ingestion.service';
import { Round } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises');

describe('FinalJeopardyIngestionService', () => {
  let service: FinalJeopardyIngestionService;
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
        FinalJeopardyIngestionService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<FinalJeopardyIngestionService>(
      FinalJeopardyIngestionService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateClue', () => {
    it('should return null for valid clue', () => {
      const clue = {
        seasonNumber: 33,
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: 'QUESTION?',
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toBeNull();
    });

    it('should return error for empty category', () => {
      const clue = {
        seasonNumber: 33,
        category: '   ',
        answer: 'ANSWER',
        question: 'QUESTION?',
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toBe('Category is empty or only whitespace');
    });

    it('should return error for empty answer', () => {
      const clue = {
        seasonNumber: 33,
        category: 'CATEGORY',
        answer: '',
        question: 'QUESTION?',
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toBe('Answer is empty or only whitespace');
    });

    it('should return error for empty question', () => {
      const clue = {
        seasonNumber: 33,
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: '\t',
        sourceFile: 'season33.tsv',
      };

      const result = (service as any).validateClue(clue);
      expect(result).toBe('Question is empty or only whitespace');
    });
  });

  describe('createDeduplicationKey', () => {
    it('should create key from clue data (aligned with parser service)', () => {
      const clue = {
        seasonNumber: 33,
        category: 'CATEGORY', // Already trimmed (as from parser)
        answer: 'ANSWER',
        question: 'QUESTION?',
        sourceFile: 'season33.tsv',
      };

      const key = (service as any).createDeduplicationKey(clue);
      expect(key).toBe('CATEGORY|QUESTION?|ANSWER');
    });
  });

  describe('readAndParseFile', () => {
    it('should read and parse valid JSON file', async () => {
      const testData = {
        metadata: { totalClues: 2 },
        clues: [
          {
            seasonNumber: 33,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            sourceFile: 'season33.tsv',
          },
          {
            seasonNumber: 34,
            category: 'CATEGORY B',
            answer: 'Answer B',
            question: 'Question B?',
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
    it('should ingest valid clues successfully', async () => {
      const testData = {
        metadata: { totalClues: 2 },
        clues: [
          {
            seasonNumber: 33,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            sourceFile: 'season33.tsv',
          },
          {
            seasonNumber: 34,
            category: 'CATEGORY B',
            answer: 'Answer B',
            question: 'Question B?',
            sourceFile: 'season34.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      mockPrismaClient.clue.findMany.mockResolvedValue([]); // No duplicates
      mockPrismaClient.clue.create.mockResolvedValue({ id: 'clue-id' });
      // Mock transaction to execute the array of promises
      mockPrismaClient.$transaction.mockImplementation(
        async (promises: Promise<any>[]) => {
          return Promise.all(promises);
        },
      );

      const result = await service.ingestFromParsedFile('/test/file.json');

      expect(result.totalCluesProcessed).toBe(2);
      expect(result.validClues).toBe(2);
      expect(result.cluesInserted).toBe(2);
      expect(result.duplicatesSkipped).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('should skip invalid clues', async () => {
      const testData = {
        metadata: { totalClues: 2 },
        clues: [
          {
            seasonNumber: 33,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            sourceFile: 'season33.tsv',
          },
          {
            seasonNumber: 34,
            category: '', // Invalid
            answer: 'Answer B',
            question: 'Question B?',
            sourceFile: 'season34.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      // Mock findMany to return empty array (no duplicates)
      mockPrismaClient.clue.findMany.mockResolvedValue([]);
      // Mock create to return a created clue
      mockPrismaClient.clue.create.mockResolvedValue({ id: 'clue-id' });
      // Mock transaction to execute the array of promises
      mockPrismaClient.$transaction.mockImplementation(
        async (promises: Promise<any>[]) => {
          return Promise.all(promises);
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

    it('should skip duplicate clues in database', async () => {
      const testData = {
        metadata: { totalClues: 1 },
        clues: [
          {
            seasonNumber: 33,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            sourceFile: 'season33.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      // Simulate existing clue in database (batch query returns matching clue)
      mockPrismaClient.clue.findMany.mockResolvedValue([
        {
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

    it('should skip duplicates within the same batch', async () => {
      const testData = {
        metadata: { totalClues: 2 },
        clues: [
          {
            seasonNumber: 33,
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
            sourceFile: 'season33.tsv',
          },
          {
            seasonNumber: 34,
            category: 'CATEGORY A', // Same as first
            answer: 'Answer A', // Same as first
            question: 'Question A?', // Same as first
            sourceFile: 'season34.tsv',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testData));
      // Mock findMany to return empty array (no duplicates in DB)
      mockPrismaClient.clue.findMany.mockResolvedValue([]);
      // Mock create to return a created clue
      mockPrismaClient.clue.create.mockResolvedValue({ id: 'clue-id' });
      // Mock transaction to execute the array of promises
      mockPrismaClient.$transaction.mockImplementation(
        async (promises: Promise<any>[]) => {
          return Promise.all(promises);
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
            category: 'CATEGORY A',
            answer: 'Answer A',
            question: 'Question A?',
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
  });
});
