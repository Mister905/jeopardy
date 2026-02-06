import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs/promises';
import * as path from 'path';
import { JeopardyParserService } from './jeopardy-parser.service';

describe('JeopardyParserService', () => {
  let service: JeopardyParserService;
  let testRawDir: string;
  let testParsedDir: string;

  beforeEach(async () => {
    // Create test directories
    const testRoot = path.join(__dirname, '../../../test-data');
    testRawDir = path.join(testRoot, 'raw');
    testParsedDir = path.join(testRoot, 'parsed');

    await fs.mkdir(testRawDir, { recursive: true });
    await fs.mkdir(testParsedDir, { recursive: true });

    // Create service with test directories
    service = new JeopardyParserService(testRawDir, testParsedDir);
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(path.join(__dirname, '../../../test-data'), {
        recursive: true,
        force: true,
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('parseTsvLine', () => {
    it('should parse a valid TSV line correctly', () => {
      const line = '1\t200\t0\tCATEGORY\t\tANSWER\tQUESTION\t2024-01-01\t';
      const result = (service as any).parseTsvLine(line, 1);

      expect(result.round).toBe('1');
      expect(result.clueValue).toBe('200');
      expect(result.dailyDoubleValue).toBe('0');
      expect(result.category).toBe('CATEGORY');
      expect(result.answer).toBe('ANSWER');
      expect(result.question).toBe('QUESTION');
      expect(result.airDate).toBe('2024-01-01');
    });

    it('should throw error for insufficient columns', () => {
      const line = '1\t200\t0\tCATEGORY';
      expect(() => {
        (service as any).parseTsvLine(line, 1);
      }).toThrow('Expected 9 columns');
    });

    it('should handle trailing tab by padding with empty string', () => {
      const line = '1\t200\t0\tCATEGORY\t\tANSWER\tQUESTION\t2024-01-01\t';
      const result = (service as any).parseTsvLine(line, 1);
      expect(result.notes).toBe('');
    });
  });

  describe('validateRow', () => {
    it('should return null for valid Jeopardy row', () => {
      const row = {
        round: '1',
        clueValue: '200',
        dailyDoubleValue: '0',
        category: 'CATEGORY',
        comments: '',
        answer: 'ANSWER',
        question: 'QUESTION',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).validateRow(row);
      expect(result).toBeNull();
    });

    it('should return null for valid Double Jeopardy row', () => {
      const row = {
        round: '2',
        clueValue: '400',
        dailyDoubleValue: '0',
        category: 'CATEGORY',
        comments: '',
        answer: 'ANSWER',
        question: 'QUESTION',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).validateRow(row);
      expect(result).toBeNull();
    });

    it('should return error for invalid round', () => {
      const row = {
        round: '3',
        clueValue: '200',
        dailyDoubleValue: '0',
        category: 'CATEGORY',
        comments: '',
        answer: 'ANSWER',
        question: 'QUESTION',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).validateRow(row);
      expect(result).toContain('Invalid round');
      expect(result).toContain('3');
    });

    it('should return error for empty category', () => {
      const row = {
        round: '1',
        clueValue: '200',
        dailyDoubleValue: '0',
        category: '   ',
        comments: '',
        answer: 'ANSWER',
        question: 'QUESTION',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).validateRow(row);
      expect(result).toBe('Category is empty or only whitespace');
    });

    it('should return error for empty answer', () => {
      const row = {
        round: '1',
        clueValue: '200',
        dailyDoubleValue: '0',
        category: 'CATEGORY',
        comments: '',
        answer: '',
        question: 'QUESTION',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).validateRow(row);
      expect(result).toBe('Answer is empty or only whitespace');
    });

    it('should return error for empty question', () => {
      const row = {
        round: '1',
        clueValue: '200',
        dailyDoubleValue: '0',
        category: 'CATEGORY',
        comments: '',
        answer: 'ANSWER',
        question: '\t',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).validateRow(row);
      expect(result).toBe('Question is empty or only whitespace');
    });

    it('should return error for invalid Jeopardy clue value', () => {
      const row = {
        round: '1',
        clueValue: '300', // Invalid - not in [200, 400, 600, 800, 1000]
        dailyDoubleValue: '0',
        category: 'CATEGORY',
        comments: '',
        answer: 'ANSWER',
        question: 'QUESTION',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).validateRow(row);
      expect(result).toContain('Invalid Jeopardy clue value: 300');
    });

    it('should return error for invalid Double Jeopardy clue value', () => {
      const row = {
        round: '2',
        clueValue: '500', // Invalid - not in [400, 800, 1200, 1600, 2000]
        dailyDoubleValue: '0',
        category: 'CATEGORY',
        comments: '',
        answer: 'ANSWER',
        question: 'QUESTION',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).validateRow(row);
      expect(result).toContain('Invalid Double Jeopardy clue value: 500');
    });

    it('should accept all valid Jeopardy values', () => {
      const validValues = [200, 400, 600, 800, 1000];
      for (const value of validValues) {
        const row = {
          round: '1',
          clueValue: String(value),
          dailyDoubleValue: '0',
          category: 'CATEGORY',
          comments: '',
          answer: 'ANSWER',
          question: 'QUESTION',
          airDate: '2024-01-01',
          notes: '',
        };

        const result = (service as any).validateRow(row);
        expect(result).toBeNull();
      }
    });

    it('should accept all valid Double Jeopardy values', () => {
      const validValues = [400, 800, 1200, 1600, 2000];
      for (const value of validValues) {
        const row = {
          round: '2',
          clueValue: String(value),
          dailyDoubleValue: '0',
          category: 'CATEGORY',
          comments: '',
          answer: 'ANSWER',
          question: 'QUESTION',
          airDate: '2024-01-01',
          notes: '',
        };

        const result = (service as any).validateRow(row);
        expect(result).toBeNull();
      }
    });
  });

  describe('normalizeClue', () => {
    it('should normalize a valid Jeopardy row correctly', () => {
      const row = {
        round: '1',
        clueValue: '200',
        dailyDoubleValue: '0',
        category: '  CATEGORY  ',
        comments: '',
        answer: '  ANSWER  ',
        question: '  QUESTION  ',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).normalizeClue(row, 33, 'season33.tsv');

      expect(result.seasonNumber).toBe(33);
      expect(result.round).toBe('1');
      expect(result.category).toBe('CATEGORY');
      // TSV "answer" column = clue text (question), TSV "question" column = response (answer)
      expect(result.answer).toBe('QUESTION');
      expect(result.question).toBe('ANSWER');
      expect(result.value).toBe(200);
      expect(result.dailyDouble).toBe(false);
      expect(result.airDate).toBe('2024-01-01');
      expect(result.sourceFile).toBe('season33.tsv');
    });

    it('should normalize a Double Jeopardy row correctly', () => {
      const row = {
        round: '2',
        clueValue: '400',
        dailyDoubleValue: '1000', // Daily Double
        category: '  CATEGORY  ',
        comments: '',
        answer: '  ANSWER  ',
        question: '  QUESTION  ',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).normalizeClue(row, 34, 'season34.tsv');

      expect(result.seasonNumber).toBe(34);
      expect(result.round).toBe('2');
      expect(result.value).toBe(400);
      expect(result.dailyDouble).toBe(true);
    });

    it('should set dailyDouble to true when daily_double_value > 0', () => {
      const row = {
        round: '1',
        clueValue: '200',
        dailyDoubleValue: '500',
        category: 'CATEGORY',
        comments: '',
        answer: 'ANSWER',
        question: 'QUESTION',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).normalizeClue(row, 33, 'season33.tsv');
      expect(result.dailyDouble).toBe(true);
    });

    it('should set dailyDouble to false when daily_double_value = 0', () => {
      const row = {
        round: '1',
        clueValue: '200',
        dailyDoubleValue: '0',
        category: 'CATEGORY',
        comments: '',
        answer: 'ANSWER',
        question: 'QUESTION',
        airDate: '2024-01-01',
        notes: '',
      };

      const result = (service as any).normalizeClue(row, 33, 'season33.tsv');
      expect(result.dailyDouble).toBe(false);
    });

    it('should omit airDate if empty', () => {
      const row = {
        round: '1',
        clueValue: '200',
        dailyDoubleValue: '0',
        category: 'CATEGORY',
        comments: '',
        answer: 'ANSWER',
        question: 'QUESTION',
        airDate: '',
        notes: '',
      };

      const result = (service as any).normalizeClue(row, 33, 'season33.tsv');

      expect(result.airDate).toBeUndefined();
    });
  });

  describe('createDeduplicationKey', () => {
    it('should create a unique key from clue data', () => {
      const clue = {
        seasonNumber: 33,
        round: '1',
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: 'QUESTION',
        value: 200,
        dailyDouble: false,
        sourceFile: 'season33.tsv',
      };

      const key = (service as any).createDeduplicationKey(clue);
      expect(key).toBe('1|CATEGORY|QUESTION|ANSWER');
    });
  });

  describe('parseSeasonFile', () => {
    it('should parse a valid season file with Jeopardy and Double Jeopardy clues', async () => {
      const testFile = path.join(testRawDir, 'season33.tsv');
      const testContent =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '1\t200\t0\tCATEGORY 1\t\tAnswer 1\tQuestion 1\t2024-01-01\t',
          '2\t400\t0\tCATEGORY 2\t\tAnswer 2\tQuestion 2\t2024-01-01\t',
          '3\t0\t0\tCATEGORY 3\t\tAnswer 3\tQuestion 3\t2024-01-02\t', // Final Jeopardy - should be skipped
        ].join('\n') + '\n';

      await fs.writeFile(testFile, testContent, 'utf-8');

      const result = await (service as any).parseSeasonFile(
        'season33.tsv',
        testFile,
      );

      expect(result.totalRowsRead).toBe(3);
      expect(result.jeopardyRowsFound).toBe(2); // Only rounds 1 and 2
      expect(result.parsedClues.length).toBe(2);
      expect(result.parsedClues[0].round).toBe('1');
      expect(result.parsedClues[0].category).toBe('CATEGORY 1');
      expect(result.parsedClues[1].round).toBe('2');
      expect(result.parsedClues[1].category).toBe('CATEGORY 2');
      expect(result.errors.length).toBe(0);
    });

    it('should skip invalid rows', async () => {
      const testFile = path.join(testRawDir, 'season33.tsv');
      const testContent =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '1\t200\t0\tCATEGORY 1\t\tAnswer 1\tQuestion 1\t2024-01-01\t',
          '1\t200\t0\t\tAnswer 2\tQuestion 2\t2024-01-01\t', // Empty category
          '2\t400\t0\tCATEGORY 3\t\tAnswer 3\t\t2024-01-02\t', // Empty question
        ].join('\n') + '\n';

      await fs.writeFile(testFile, testContent, 'utf-8');

      const result = await (service as any).parseSeasonFile(
        'season33.tsv',
        testFile,
      );

      expect(result.totalRowsRead).toBe(3);
      expect(result.jeopardyRowsFound).toBe(3);
      expect(result.parsedClues.length).toBe(1);
      expect(result.invalidRows).toBe(2);
      expect(result.errors.length).toBe(2);
    });

    it('should detect Daily Doubles correctly', async () => {
      const testFile = path.join(testRawDir, 'season33.tsv');
      const testContent =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '1\t200\t500\tCATEGORY 1\t\tAnswer 1\tQuestion 1\t2024-01-01\t', // Daily Double
          '2\t400\t0\tCATEGORY 2\t\tAnswer 2\tQuestion 2\t2024-01-01\t', // Not Daily Double
          '2\t800\t1000\tCATEGORY 3\t\tAnswer 3\tQuestion 3\t2024-01-02\t', // Daily Double
        ].join('\n') + '\n';

      await fs.writeFile(testFile, testContent, 'utf-8');

      const result = await (service as any).parseSeasonFile(
        'season33.tsv',
        testFile,
      );

      expect(result.parsedClues.length).toBe(3);
      expect(result.parsedClues[0].dailyDouble).toBe(true);
      expect(result.parsedClues[1].dailyDouble).toBe(false);
      expect(result.parsedClues[2].dailyDouble).toBe(true);
    });
  });

  describe('parseAllSeasons - Integration Tests', () => {
    it('should parse multiple season files and deduplicate across files', async () => {
      const season33File = path.join(testRawDir, 'season33.tsv');
      const season34File = path.join(testRawDir, 'season34.tsv');

      const season33Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '1\t200\t0\tCATEGORY A\t\tAnswer A\tQuestion A\t2024-01-01\t',
          '2\t400\t0\tCATEGORY B\t\tAnswer B\tQuestion B\t2024-01-02\t',
        ].join('\n') + '\n';

      const season34Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '1\t200\t0\tCATEGORY A\t\tAnswer A\tQuestion A\t2024-01-03\t', // Duplicate
          '2\t800\t0\tCATEGORY C\t\tAnswer C\tQuestion C\t2024-01-04\t', // Unique
        ].join('\n') + '\n';

      await fs.writeFile(season33File, season33Content, 'utf-8');
      await fs.writeFile(season34File, season34Content, 'utf-8');

      const testService = new JeopardyParserService(
        testRawDir,
        testParsedDir,
      );
      (testService as any).minSeason = 33;
      (testService as any).maxSeason = 34;

      const result = await testService.parseAllSeasons();

      expect(result.totalFilesProcessed).toBe(2);
      expect(result.jeopardyRowsFound).toBe(4);
      expect(result.validRows).toBe(3); // 3 unique clues (one duplicate removed)
      expect(result.duplicatesSkipped).toBe(1);
      expect(result.errors.length).toBe(0);

      // Verify output file was created
      const outputFile = path.join(testParsedDir, 'jeopardy-clues.json');
      const outputContent = await fs.readFile(outputFile, 'utf-8');
      const outputData = JSON.parse(outputContent);

      expect(outputData.clues.length).toBe(3);
      expect(outputData.metadata.totalClues).toBe(3);
      expect(outputData.metadata.duplicatesSkipped).toBe(1);
    });

    it('should handle missing files gracefully', async () => {
      const season33File = path.join(testRawDir, 'season33.tsv');
      const season33Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '1\t200\t0\tCATEGORY A\t\tAnswer A\tQuestion A\t2024-01-01\t',
        ].join('\n') + '\n';

      await fs.writeFile(season33File, season33Content, 'utf-8');

      const testService = new JeopardyParserService(
        testRawDir,
        testParsedDir,
      );
      (testService as any).minSeason = 33;
      (testService as any).maxSeason = 35;

      const result = await testService.parseAllSeasons();

      expect(result.totalFilesProcessed).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some(
          (e) => e.file.includes('season34') || e.file.includes('season35'),
        ),
      ).toBe(true);
    });

    it('should create parsed directory if it does not exist', async () => {
      const nonExistentDir = path.join(
        __dirname,
        '../../../test-data-new/parsed',
      );
      const testService = new JeopardyParserService(
        testRawDir,
        nonExistentDir,
      );

      const season33File = path.join(testRawDir, 'season33.tsv');
      const season33Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '1\t200\t0\tCATEGORY A\t\tAnswer A\tQuestion A\t2024-01-01\t',
        ].join('\n') + '\n';
      await fs.writeFile(season33File, season33Content, 'utf-8');

      (testService as any).minSeason = 33;
      (testService as any).maxSeason = 33;

      try {
        await fs.access(nonExistentDir);
        await fs.rm(nonExistentDir, { recursive: true, force: true });
      } catch {
        // Directory doesn't exist, which is what we want
      }

      const result = await testService.parseAllSeasons();

      expect(result.errors.length).toBe(0);
      await expect(fs.access(nonExistentDir)).resolves.not.toThrow();

      await fs.rm(path.dirname(nonExistentDir), {
        recursive: true,
        force: true,
      });
    });

    it('should handle errors in some files and continue processing others', async () => {
      const season33File = path.join(testRawDir, 'season33.tsv');
      const season34File = path.join(testRawDir, 'season34.tsv');

      const season33Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '1\t200\t0\tCATEGORY A\t\tAnswer A\tQuestion A\t2024-01-01\t',
        ].join('\n') + '\n';

      const season34Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '1\t200\t0\tCATEGORY B\t\tAnswer B\t', // Missing columns
        ].join('\n') + '\n';

      await fs.writeFile(season33File, season33Content, 'utf-8');
      await fs.writeFile(season34File, season34Content, 'utf-8');

      const testService = new JeopardyParserService(
        testRawDir,
        testParsedDir,
      );
      (testService as any).minSeason = 33;
      (testService as any).maxSeason = 34;

      const result = await testService.parseAllSeasons();

      expect(result.totalFilesProcessed).toBe(2);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.validRows).toBeGreaterThan(0);
    });
  });
});
