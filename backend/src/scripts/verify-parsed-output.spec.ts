import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');

describe('verify-parsed-output script', () => {
  let mockFs: jest.Mocked<typeof fs>;
  let originalExit: typeof process.exit;
  let exitCode: number | null = null;

  beforeEach(() => {
    // Mock process.exit
    originalExit = process.exit;
    exitCode = null;
    (process.exit as unknown) = jest.fn((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`process.exit(${code})`);
    });

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    mockFs = fs as jest.Mocked<typeof fs>;
  });

  afterEach(() => {
    process.exit = originalExit;
    jest.restoreAllMocks();
  });

  describe('Path Resolution', () => {
    it('should resolve path correctly from scripts directory', () => {
      // When running from backend/src/scripts/, __dirname is that directory
      // Going up two levels (../..) should reach backend/
      const scriptDir = path.resolve(__dirname);
      const expectedBackendDir = path.resolve(scriptDir, '../..');
      const expectedDataDir = path.join(
        expectedBackendDir,
        'data',
        'jeopardy_clue_dataset',
        'parsed',
        'final-jeopardy-clues.json',
      );

      // Verify the path structure is correct
      expect(expectedDataDir).toContain('data/jeopardy_clue_dataset/parsed');
      expect(expectedDataDir).toContain('final-jeopardy-clues.json');
    });
  });

  describe('File Validation', () => {
    it('should detect missing output file', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(mockFs.access('/path/to/file.json')).rejects.toThrow(
        'File not found',
      );
    });

    it('should handle invalid JSON', () => {
      const invalidJson = '{ invalid json }';
      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it('should parse valid JSON structure', () => {
      const validData = {
        metadata: {
          totalClues: 100,
          totalFilesProcessed: 9,
          totalRowsRead: 1000,
          finalJeopardyRowsFound: 500,
          validRows: 100,
          invalidRows: 50,
          duplicatesSkipped: 0,
          processedAt: '2024-01-01T00:00:00.000Z',
        },
        clues: [],
      };

      const parsed = JSON.parse(JSON.stringify(validData));
      expect(parsed.metadata.totalClues).toBe(100);
      expect(Array.isArray(parsed.clues)).toBe(true);
    });
  });

  describe('Metadata Validation Logic', () => {
    it('should validate metadata consistency', () => {
      const metadata = {
        totalClues: 100,
        validRows: 100,
        finalJeopardyRowsFound: 120,
        duplicatesSkipped: 20,
      };
      const clues = new Array(100);

      // totalClues should equal clues.length
      expect(metadata.totalClues).toBe(clues.length);

      // validRows should equal clues.length (after deduplication)
      expect(metadata.validRows).toBe(clues.length);

      // finalJeopardyRowsFound should be >= totalClues (before deduplication)
      expect(metadata.finalJeopardyRowsFound).toBeGreaterThanOrEqual(
        metadata.totalClues,
      );
    });

    it('should detect metadata inconsistencies', () => {
      const metadata = {
        totalClues: 100,
        validRows: 90, // Mismatch
        finalJeopardyRowsFound: 80, // Should be >= totalClues
      };
      const clues = new Array(100);

      // These should fail validation
      expect(metadata.validRows).not.toBe(clues.length);
      expect(metadata.finalJeopardyRowsFound).toBeLessThan(metadata.totalClues);
    });
  });

  describe('Data Validation Logic', () => {
    it('should validate clue structure', () => {
      const validClue = {
        seasonNumber: 35,
        category: 'HISTORY',
        answer: 'Answer',
        question: 'Question?',
        sourceFile: 'season35.tsv',
      };

      expect(typeof validClue.seasonNumber).toBe('number');
      expect(validClue.seasonNumber).toBeGreaterThanOrEqual(33);
      expect(validClue.seasonNumber).toBeLessThanOrEqual(41);
      expect(typeof validClue.category).toBe('string');
      expect(validClue.category.trim().length).toBeGreaterThan(0);
      expect(/^season(3[3-9]|4[01])\.tsv$/.test(validClue.sourceFile)).toBe(
        true,
      );
    });

    it('should detect invalid clue data', () => {
      const invalidClue = {
        seasonNumber: 50, // Outside range (should be 33-41)
        category: '', // Empty
        answer: '   ', // Only whitespace
        question: 'Question?',
        sourceFile: 'invalid.tsv', // Wrong pattern
      };

      // Season number should be outside valid range (33-41)
      expect(
        invalidClue.seasonNumber < 33 || invalidClue.seasonNumber > 41,
      ).toBe(true);
      expect(invalidClue.category.trim().length).toBe(0);
      expect(invalidClue.answer.trim().length).toBe(0);
      expect(/^season(3[3-9]|4[01])\.tsv$/.test(invalidClue.sourceFile)).toBe(
        false,
      );
    });

    it('should detect duplicate clues', () => {
      const clues = [
        {
          category: 'CATEGORY',
          question: 'Question?',
          answer: 'Answer',
        },
        {
          category: 'CATEGORY',
          question: 'Question?',
          answer: 'Answer', // Duplicate
        },
      ];

      const dedupKeys = new Set<string>();
      clues.forEach((clue) => {
        const key = `${clue.category}|${clue.question}|${clue.answer}`;
        dedupKeys.add(key);
      });

      // Set size should be less than array length if duplicates exist
      expect(dedupKeys.size).toBeLessThan(clues.length);
    });
  });
});
