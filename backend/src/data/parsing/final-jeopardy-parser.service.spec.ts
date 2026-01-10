import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FinalJeopardyParserService } from './final-jeopardy-parser.service';

describe('FinalJeopardyParserService', () => {
  let service: FinalJeopardyParserService;
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
    service = new FinalJeopardyParserService(testRawDir, testParsedDir);
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
      const line = '3\t0\t0\tCATEGORY\t\tANSWER\tQUESTION\t2024-01-01\t';
      const result = (service as any).parseTsvLine(line, 1);

      expect(result.round).toBe('3');
      expect(result.category).toBe('CATEGORY');
      expect(result.answer).toBe('ANSWER');
      expect(result.question).toBe('QUESTION');
      expect(result.airDate).toBe('2024-01-01');
    });

    it('should throw error for insufficient columns', () => {
      const line = '3\t0\t0\tCATEGORY';
      expect(() => {
        (service as any).parseTsvLine(line, 1);
      }).toThrow('Expected 9 columns');
    });
  });

  describe('validateRow', () => {
    it('should return null for valid row', () => {
      const row = {
        round: '3',
        clueValue: '0',
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

    it('should return error for empty category', () => {
      const row = {
        round: '3',
        clueValue: '0',
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
        round: '3',
        clueValue: '0',
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
        round: '3',
        clueValue: '0',
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
  });

  describe('normalizeClue', () => {
    it('should normalize a valid row correctly', () => {
      const row = {
        round: '3',
        clueValue: '0',
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
      expect(result.category).toBe('CATEGORY');
      expect(result.answer).toBe('ANSWER');
      expect(result.question).toBe('QUESTION');
      expect(result.airDate).toBe('2024-01-01');
      expect(result.sourceFile).toBe('season33.tsv');
    });

    it('should omit airDate if empty', () => {
      const row = {
        round: '3',
        clueValue: '0',
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
        category: 'CATEGORY',
        answer: 'ANSWER',
        question: 'QUESTION',
        sourceFile: 'season33.tsv',
      };

      const key = (service as any).createDeduplicationKey(clue);
      expect(key).toBe('CATEGORY|QUESTION|ANSWER');
    });
  });

  describe('parseSeasonFile', () => {
    it('should parse a valid season file', async () => {
      const testFile = path.join(testRawDir, 'season33.tsv');
      // Use explicit tab characters - ensure 9 columns with trailing tab for empty notes
      const testContent =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '3\t0\t0\tCATEGORY 1\t\tAnswer 1\tQuestion 1\t2024-01-01\t',
          '1\t200\t0\tCATEGORY 2\t\tAnswer 2\tQuestion 2\t2024-01-01\t',
          '3\t0\t0\tCATEGORY 3\t\tAnswer 3\tQuestion 3\t2024-01-02\t',
        ].join('\n') + '\n'; // Add trailing newline

      await fs.writeFile(testFile, testContent, 'utf-8');

      const result = await (service as any).parseSeasonFile(
        'season33.tsv',
        testFile,
      );

      expect(result.totalRowsRead).toBe(3);
      expect(result.finalJeopardyRowsFound).toBe(2);
      expect(result.parsedClues.length).toBe(2);
      expect(result.parsedClues[0].category).toBe('CATEGORY 1');
      expect(result.parsedClues[1].category).toBe('CATEGORY 3');
      expect(result.errors.length).toBe(0);
    });

    it('should skip invalid rows', async () => {
      const testFile = path.join(testRawDir, 'season33.tsv');
      // Use explicit tab characters - ensure 9 columns
      const testContent =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '3\t0\t0\tCATEGORY 1\t\tAnswer 1\tQuestion 1\t2024-01-01\t',
          '3\t0\t0\t\tAnswer 2\tQuestion 2\t2024-01-01\t',
          '3\t0\t0\tCATEGORY 3\t\tAnswer 3\t\t2024-01-02\t',
        ].join('\n') + '\n'; // Add trailing newline

      await fs.writeFile(testFile, testContent, 'utf-8');

      const result = await (service as any).parseSeasonFile(
        'season33.tsv',
        testFile,
      );

      expect(result.totalRowsRead).toBe(3);
      expect(result.finalJeopardyRowsFound).toBe(3);
      expect(result.parsedClues.length).toBe(1);
      expect(result.invalidRows).toBe(2);
      expect(result.errors.length).toBe(2);
    });
  });

  describe('parseAllSeasons - Integration Tests', () => {
    it('should parse multiple season files and deduplicate across files', async () => {
      // Create test files with some overlapping clues
      const season33File = path.join(testRawDir, 'season33.tsv');
      const season34File = path.join(testRawDir, 'season34.tsv');

      const season33Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '3\t0\t0\tCATEGORY A\t\tAnswer A\tQuestion A\t2024-01-01\t',
          '3\t0\t0\tCATEGORY B\t\tAnswer B\tQuestion B\t2024-01-02\t',
        ].join('\n') + '\n';

      const season34Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '3\t0\t0\tCATEGORY A\t\tAnswer A\tQuestion A\t2024-01-03\t', // Duplicate
          '3\t0\t0\tCATEGORY C\t\tAnswer C\tQuestion C\t2024-01-04\t', // Unique
        ].join('\n') + '\n';

      await fs.writeFile(season33File, season33Content, 'utf-8');
      await fs.writeFile(season34File, season34Content, 'utf-8');

      // Create service with limited season range for testing
      const testService = new FinalJeopardyParserService(
        testRawDir,
        testParsedDir,
      );
      // Override season range for this test
      (testService as any).minSeason = 33;
      (testService as any).maxSeason = 34;

      const result = await testService.parseAllSeasons();

      expect(result.totalFilesProcessed).toBe(2);
      expect(result.finalJeopardyRowsFound).toBe(4); // 2 from season33, 2 from season34
      expect(result.validRows).toBe(3); // 3 unique clues (one duplicate removed)
      expect(result.duplicatesSkipped).toBe(1);
      expect(result.errors.length).toBe(0);

      // Verify output file was created
      const outputFile = path.join(testParsedDir, 'final-jeopardy-clues.json');
      const outputContent = await fs.readFile(outputFile, 'utf-8');
      const outputData = JSON.parse(outputContent);

      expect(outputData.clues.length).toBe(3);
      expect(outputData.metadata.totalClues).toBe(3);
      expect(outputData.metadata.duplicatesSkipped).toBe(1);
    });

    it('should handle missing files gracefully', async () => {
      // Create only one file, but service expects multiple seasons
      const season33File = path.join(testRawDir, 'season33.tsv');
      const season33Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '3\t0\t0\tCATEGORY A\t\tAnswer A\tQuestion A\t2024-01-01\t',
        ].join('\n') + '\n';

      await fs.writeFile(season33File, season33Content, 'utf-8');

      const testService = new FinalJeopardyParserService(
        testRawDir,
        testParsedDir,
      );
      (testService as any).minSeason = 33;
      (testService as any).maxSeason = 35; // Expects 33, 34, 35

      const result = await testService.parseAllSeasons();

      expect(result.totalFilesProcessed).toBe(1); // Only season33 exists
      expect(result.errors.length).toBeGreaterThan(0); // Should have errors for missing files
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
      const testService = new FinalJeopardyParserService(
        testRawDir,
        nonExistentDir,
      );

      // Create a test file
      const season33File = path.join(testRawDir, 'season33.tsv');
      const season33Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '3\t0\t0\tCATEGORY A\t\tAnswer A\tQuestion A\t2024-01-01\t',
        ].join('\n') + '\n';
      await fs.writeFile(season33File, season33Content, 'utf-8');

      (testService as any).minSeason = 33;
      (testService as any).maxSeason = 33;

      // Verify directory doesn't exist
      try {
        await fs.access(nonExistentDir);
        // If it exists, remove it
        await fs.rm(nonExistentDir, { recursive: true, force: true });
      } catch {
        // Directory doesn't exist, which is what we want
      }

      const result = await testService.parseAllSeasons();

      expect(result.errors.length).toBe(0);
      // Verify directory was created
      await expect(fs.access(nonExistentDir)).resolves.not.toThrow();

      // Cleanup
      await fs.rm(path.dirname(nonExistentDir), {
        recursive: true,
        force: true,
      });
    });

    it('should handle errors in some files and continue processing others', async () => {
      // Create one valid file and one with malformed data
      const season33File = path.join(testRawDir, 'season33.tsv');
      const season34File = path.join(testRawDir, 'season34.tsv');

      const season33Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '3\t0\t0\tCATEGORY A\t\tAnswer A\tQuestion A\t2024-01-01\t',
        ].join('\n') + '\n';

      // Malformed file - wrong number of columns
      const season34Content =
        [
          'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
          '3\t0\t0\tCATEGORY B\t\tAnswer B\t', // Missing columns
        ].join('\n') + '\n';

      await fs.writeFile(season33File, season33Content, 'utf-8');
      await fs.writeFile(season34File, season34Content, 'utf-8');

      const testService = new FinalJeopardyParserService(
        testRawDir,
        testParsedDir,
      );
      (testService as any).minSeason = 33;
      (testService as any).maxSeason = 34;

      const result = await testService.parseAllSeasons();

      expect(result.totalFilesProcessed).toBe(2);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should still process the valid file
      expect(result.validRows).toBeGreaterThan(0);
    });
  });
});
