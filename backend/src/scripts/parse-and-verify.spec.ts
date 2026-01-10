import { FinalJeopardyParserService } from '../data/parsing/final-jeopardy-parser.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ParsedFinalJeopardyClue } from '../data/parsing/types';

/**
 * End-to-end test for the full parse + verify workflow
 * Tests the complete pipeline: parsing raw files → verifying output
 */
describe('Parse and Verify E2E', () => {
  let testRawDir: string;
  let testParsedDir: string;
  let testOutputFile: string;

  beforeEach(async () => {
    // Create test directories
    const testRoot = path.join(__dirname, '../../../test-e2e-data');
    testRawDir = path.join(testRoot, 'raw');
    testParsedDir = path.join(testRoot, 'parsed');
    testOutputFile = path.join(testParsedDir, 'final-jeopardy-clues.json');

    await fs.mkdir(testRawDir, { recursive: true });
    await fs.mkdir(testParsedDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(path.join(__dirname, '../../../test-e2e-data'), {
        recursive: true,
        force: true,
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should parse test files and produce valid output', async () => {
    // Create test TSV files
    const season33Content =
      [
        'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
        '3\t0\t0\tCATEGORY A\t\tAnswer A\tQuestion A?\t2024-01-01\t',
        '1\t200\t0\tCATEGORY B\t\tAnswer B\tQuestion B?\t2024-01-01\t', // Not Final Jeopardy
        '3\t0\t0\tCATEGORY C\t\tAnswer C\tQuestion C?\t2024-01-02\t',
      ].join('\n') + '\n';

    const season34Content =
      [
        'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
        '3\t0\t0\tCATEGORY A\t\tAnswer A\tQuestion A?\t2024-01-03\t', // Duplicate of season33
        '3\t0\t0\tCATEGORY D\t\tAnswer D\tQuestion D?\t2024-01-04\t', // Unique
      ].join('\n') + '\n';

    await fs.writeFile(
      path.join(testRawDir, 'season33.tsv'),
      season33Content,
      'utf-8',
    );
    await fs.writeFile(
      path.join(testRawDir, 'season34.tsv'),
      season34Content,
      'utf-8',
    );

    // Create parser service with test directories
    const parser = new FinalJeopardyParserService(testRawDir, testParsedDir);
    (parser as any).minSeason = 33;
    (parser as any).maxSeason = 34;

    // Execute parsing
    const result = await parser.parseAllSeasons();

    // Verify parsing results
    expect(result.totalFilesProcessed).toBe(2);
    expect(result.finalJeopardyRowsFound).toBe(4); // 2 from season33, 2 from season34
    expect(result.validRows).toBe(3); // 3 unique clues (1 duplicate removed)
    expect(result.duplicatesSkipped).toBe(1);
    expect(result.errors.length).toBe(0);

    // Verify output file exists
    const fileExists = await fs
      .access(testOutputFile)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    // Read and verify output file
    const outputContent = await fs.readFile(testOutputFile, 'utf-8');
    const outputData = JSON.parse(outputContent);

    // Verify metadata
    expect(outputData.metadata).toBeDefined();
    expect(outputData.metadata.totalClues).toBe(3);
    expect(outputData.metadata.totalFilesProcessed).toBe(2);
    expect(outputData.metadata.validRows).toBe(3);
    expect(outputData.metadata.duplicatesSkipped).toBe(1);
    expect(outputData.metadata.finalJeopardyRowsFound).toBe(4);

    // Verify clues array
    expect(Array.isArray(outputData.clues)).toBe(true);
    expect(outputData.clues.length).toBe(3);

    // Verify clue structure
    outputData.clues.forEach((clue: ParsedFinalJeopardyClue) => {
      expect(typeof clue.seasonNumber).toBe('number');
      expect(clue.seasonNumber).toBeGreaterThanOrEqual(33);
      expect(clue.seasonNumber).toBeLessThanOrEqual(34);
      expect(typeof clue.category).toBe('string');
      expect(clue.category.trim().length).toBeGreaterThan(0);
      expect(typeof clue.answer).toBe('string');
      expect(clue.answer.trim().length).toBeGreaterThan(0);
      expect(typeof clue.question).toBe('string');
      expect(clue.question.trim().length).toBeGreaterThan(0);
      expect(typeof clue.sourceFile).toBe('string');
      expect(/^season(3[3-4])\.tsv$/.test(clue.sourceFile)).toBe(true);
    });

    // Verify no duplicates
    const dedupKeys = new Set<string>();
    outputData.clues.forEach((clue: ParsedFinalJeopardyClue) => {
      const key = `${clue.category}|${clue.question}|${clue.answer}`;
      expect(dedupKeys.has(key)).toBe(false); // Should not be duplicate
      dedupKeys.add(key);
    });
    expect(dedupKeys.size).toBe(outputData.clues.length);

    // Verify metadata consistency
    expect(outputData.metadata.totalClues).toBe(outputData.clues.length);
    expect(outputData.metadata.validRows).toBe(outputData.clues.length);
    expect(outputData.metadata.finalJeopardyRowsFound).toBeGreaterThanOrEqual(
      outputData.metadata.totalClues,
    );
  });

  it('should handle invalid rows and continue processing', async () => {
    // Create test file with invalid rows
    const season33Content =
      [
        'round\tclue_value\tdaily_double_value\tcategory\tcomments\tanswer\tquestion\tair_date\tnotes',
        '3\t0\t0\tCATEGORY A\t\tAnswer A\tQuestion A?\t2024-01-01\t', // Valid
        '3\t0\t0\t\tAnswer B\tQuestion B?\t2024-01-01\t', // Invalid: empty category
        '3\t0\t0\tCATEGORY C\t\tAnswer C\t\t2024-01-02\t', // Invalid: empty question
        '3\t0\t0\tCATEGORY D\t\tAnswer D\tQuestion D?\t2024-01-03\t', // Valid
      ].join('\n') + '\n';

    await fs.writeFile(
      path.join(testRawDir, 'season33.tsv'),
      season33Content,
      'utf-8',
    );

    const parser = new FinalJeopardyParserService(testRawDir, testParsedDir);
    (parser as any).minSeason = 33;
    (parser as any).maxSeason = 33;

    const result = await parser.parseAllSeasons();

    // Should process file but skip invalid rows
    expect(result.totalFilesProcessed).toBe(1);
    expect(result.finalJeopardyRowsFound).toBe(4);
    expect(result.validRows).toBe(2); // Only 2 valid clues
    expect(result.invalidRows).toBe(2); // 2 invalid rows

    // Verify output file has correct number of clues
    const outputContent = await fs.readFile(testOutputFile, 'utf-8');
    const outputData = JSON.parse(outputContent);

    expect(outputData.clues.length).toBe(2);
    expect(outputData.metadata.totalClues).toBe(2);
    expect(outputData.metadata.invalidRows).toBe(2);
  });
});
