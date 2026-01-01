import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface CluebaseClue {
  id?: string;
  clue: string;
  answer: string;
  category: string;
  round: string;
  value: number;
  daily_double: boolean;
}

@Injectable()
export class CluebaseService {
  private readonly logger = new Logger(CluebaseService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('CLUEBASE_API_URL') ||
      'https://cluebase.herokuapp.com';
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  /**
   * Fetches clues from Cluebase API
   * Filters and returns clues that match Jeopardy and Double Jeopardy requirements
   */
  async fetchClues(): Promise<CluebaseClue[]> {
    try {
      this.logger.log(`Fetching clues from ${this.baseUrl}`);
      const response = await this.httpClient.get<CluebaseClue[]>('/clues');

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response format from Cluebase API');
      }

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch clues from Cluebase API', error);
      throw new ServiceUnavailableException(
        'Cluebase API is currently unavailable. Please try again later.',
      );
    }
  }

  /**
   * Filters clues to only include valid Jeopardy/Double Jeopardy clues
   * Valid clues must have non-null clue text, answer, and valid dollar values
   */
  filterValidClues(clues: CluebaseClue[]): CluebaseClue[] {
    const jeopardyValues = [200, 400, 600, 800, 1000];
    const doubleJeopardyValues = [400, 800, 1200, 1600, 2000];
    const validValues = [...jeopardyValues, ...doubleJeopardyValues];

    return clues.filter((clue) => {
      // Must have non-null clue text
      if (!clue.clue || clue.clue.trim() === '') {
        return false;
      }

      // Must have non-null answer
      if (!clue.answer || clue.answer.trim() === '') {
        return false;
      }

      // Must have valid dollar value
      if (!clue.value || !validValues.includes(clue.value)) {
        return false;
      }

      // Round must be valid
      if (!clue.round || !['Jeopardy!', 'Double Jeopardy!'].includes(clue.round)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Groups clues by round and category
   */
  groupCluesByRoundAndCategory(
    clues: CluebaseClue[],
  ): {
    jeopardy: Map<string, CluebaseClue[]>;
    doubleJeopardy: Map<string, CluebaseClue[]>;
  } {
    const jeopardy = new Map<string, CluebaseClue[]>();
    const doubleJeopardy = new Map<string, CluebaseClue[]>();

    for (const clue of clues) {
      const category = clue.category || 'Unknown';
      if (clue.round === 'Jeopardy!') {
        if (!jeopardy.has(category)) {
          jeopardy.set(category, []);
        }
        jeopardy.get(category)!.push(clue);
      } else if (clue.round === 'Double Jeopardy!') {
        if (!doubleJeopardy.has(category)) {
          doubleJeopardy.set(category, []);
        }
        doubleJeopardy.get(category)!.push(clue);
      }
    }

    return { jeopardy, doubleJeopardy };
  }
}

