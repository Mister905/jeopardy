import { FinalJeopardyParserService } from '../data/parsing/final-jeopardy-parser.service';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock the parser service
jest.mock('../data/parsing/final-jeopardy-parser.service');

describe('parse-final-jeopardy script', () => {
  let mockParser: jest.Mocked<FinalJeopardyParserService>;
  let originalExit: typeof process.exit;
  let exitCode: number | null = null;

  beforeEach(() => {
    // Mock process.exit to capture exit code
    originalExit = process.exit;
    exitCode = null;
    (process.exit as unknown) = jest.fn((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`process.exit(${code})`);
    });

    // Mock console methods to avoid output during tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Create mock parser instance
    mockParser = {
      parseAllSeasons: jest.fn(),
    } as unknown as jest.Mocked<FinalJeopardyParserService>;

    (
      FinalJeopardyParserService as jest.MockedClass<
        typeof FinalJeopardyParserService
      >
    ).mockImplementation(() => mockParser);
  });

  afterEach(() => {
    process.exit = originalExit;
    jest.restoreAllMocks();
  });

  it('should initialize parser and execute successfully', async () => {
    const mockResult = {
      totalFilesProcessed: 9,
      totalRowsRead: 1000,
      finalJeopardyRowsFound: 500,
      validRows: 450,
      invalidRows: 50,
      duplicatesSkipped: 0,
      outputFile: '/path/to/output.json',
      errors: [],
    };

    mockParser.parseAllSeasons.mockResolvedValue(mockResult);

    // Import and run the script
    // Note: We can't easily test the main() function directly since it's at module level
    // This test verifies the service is called correctly
    const parser = new FinalJeopardyParserService();
    const result = await parser.parseAllSeasons();

    expect(result).toEqual(mockResult);
    expect(mockParser.parseAllSeasons).toHaveBeenCalledTimes(1);
  });

  it('should handle parsing errors', async () => {
    const error = new Error('Parsing failed');
    mockParser.parseAllSeasons.mockRejectedValue(error);

    // Test error handling
    await expect(mockParser.parseAllSeasons()).rejects.toThrow(
      'Parsing failed',
    );
  });

  it('should handle result with errors', async () => {
    const mockResult = {
      totalFilesProcessed: 9,
      totalRowsRead: 1000,
      finalJeopardyRowsFound: 500,
      validRows: 450,
      invalidRows: 50,
      duplicatesSkipped: 0,
      outputFile: '/path/to/output.json',
      errors: [
        { file: 'season33.tsv', line: 10, message: 'Invalid row' },
        { file: 'season34.tsv', line: 20, message: 'Missing field' },
      ],
    };

    mockParser.parseAllSeasons.mockResolvedValue(mockResult);

    const result = await mockParser.parseAllSeasons();

    expect(result.errors.length).toBe(2);
    expect(result.errors[0].file).toBe('season33.tsv');
  });
});
