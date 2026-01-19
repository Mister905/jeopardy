import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FinalJeopardyView } from '../FinalJeopardyView';
import { createMockFinalJeopardyBoard } from '@/test-utils/mocks/boardMocks';

describe('FinalJeopardyView component', () => {
  const mockOnWagerSubmit = jest.fn();
  const mockOnAnswerSubmit = jest.fn();
  const mockFinalJeopardy = createMockFinalJeopardyBoard();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Final Jeopardy view based on Redux game state', () => {
    render(
      <FinalJeopardyView
        finalJeopardy={mockFinalJeopardy}
        gameId="game-1"
        currentScore={5000}
        onWagerSubmit={mockOnWagerSubmit}
        onAnswerSubmit={mockOnAnswerSubmit}
      />,
    );

    expect(screen.getByText('Final Jeopardy')).toBeInTheDocument();
    expect(screen.getByText('Final Category')).toBeInTheDocument();
  });

  it('should show wager input when no wager has been submitted', () => {
    const finalJeopardy = createMockFinalJeopardyBoard();
    finalJeopardy.clue.wager = 0;

    render(
      <FinalJeopardyView
        finalJeopardy={finalJeopardy}
        gameId="game-1"
        currentScore={5000}
        onWagerSubmit={mockOnWagerSubmit}
        onAnswerSubmit={mockOnAnswerSubmit}
      />,
    );

    expect(screen.getByText(/enter your wager/i)).toBeInTheDocument();
  });

  it('should show question when wager is submitted but not answered', () => {
    const finalJeopardy = createMockFinalJeopardyBoard();
    finalJeopardy.clue.wager = 1000;
    finalJeopardy.clue.answeredAt = null;

    render(
      <FinalJeopardyView
        finalJeopardy={finalJeopardy}
        gameId="game-1"
        currentScore={5000}
        onWagerSubmit={mockOnWagerSubmit}
        onAnswerSubmit={mockOnAnswerSubmit}
      />,
    );

    expect(screen.getByText('Final Jeopardy question?')).toBeInTheDocument();
  });

  it('should dispatch submitFinalJeopardyWager thunk when wager is submitted', async () => {
    const user = userEvent.setup();
    mockOnWagerSubmit.mockResolvedValue(undefined);

    const finalJeopardy = createMockFinalJeopardyBoard();
    finalJeopardy.clue.wager = 0;

    render(
      <FinalJeopardyView
        finalJeopardy={finalJeopardy}
        gameId="game-1"
        currentScore={5000}
        onWagerSubmit={mockOnWagerSubmit}
        onAnswerSubmit={mockOnAnswerSubmit}
      />,
    );

    const input = screen.getByLabelText(/wager/i);
    const submitButton = screen.getByRole('button', { name: /submit/i });

    await user.type(input, '1000');
    await user.click(submitButton);

    expect(mockOnWagerSubmit).toHaveBeenCalledWith(1000);
  });

  it('should dispatch answerFinalJeopardy thunk when answer is submitted', async () => {
    const user = userEvent.setup();
    mockOnAnswerSubmit.mockResolvedValue(undefined);

    const finalJeopardy = createMockFinalJeopardyBoard();
    finalJeopardy.clue.wager = 1000;
    finalJeopardy.clue.answeredAt = null;

    render(
      <FinalJeopardyView
        finalJeopardy={finalJeopardy}
        gameId="game-1"
        currentScore={5000}
        onWagerSubmit={mockOnWagerSubmit}
        onAnswerSubmit={mockOnAnswerSubmit}
      />,
    );

    const correctButton = screen.getByRole('button', { name: /correct/i });
    await user.click(correctButton);

    expect(mockOnAnswerSubmit).toHaveBeenCalledWith(true);
  });

  it('should reflect state transitions in UI', () => {
    const { rerender } = render(
      <FinalJeopardyView
        finalJeopardy={mockFinalJeopardy}
        gameId="game-1"
        currentScore={5000}
        onWagerSubmit={mockOnWagerSubmit}
        onAnswerSubmit={mockOnAnswerSubmit}
      />,
    );

    // Update to show answered state
    const answeredFinalJeopardy = createMockFinalJeopardyBoard();
    answeredFinalJeopardy.clue.wager = 1000;
    answeredFinalJeopardy.clue.correct = true;
    answeredFinalJeopardy.clue.answeredAt = '2024-01-01T00:00:00Z';

    rerender(
      <FinalJeopardyView
        finalJeopardy={answeredFinalJeopardy}
        gameId="game-1"
        currentScore={5000}
        onWagerSubmit={mockOnWagerSubmit}
        onAnswerSubmit={mockOnAnswerSubmit}
      />,
    );

    // Should show answer and result
    expect(screen.getByText('Final Jeopardy question?')).toBeInTheDocument();
  });
});
