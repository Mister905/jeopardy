import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WagerInput } from '../WagerInput';

describe('WagerInput component', () => {
  const mockOnSubmit = jest.fn();
  const defaultProps = {
    minWager: 0,
    maxWager: 1000,
    currentScore: 1000,
    onSubmit: mockOnSubmit,
    type: 'daily-double' as const,
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render wager input form', () => {
    render(<WagerInput {...defaultProps} />);

    expect(screen.getByLabelText(/wager/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('should validate wager is a number', async () => {
    render(<WagerInput {...defaultProps} />);

    const input = screen.getByLabelText(/wager/i);
    const form = input.closest('form');
    if (!form) throw new Error('Form not found');

    await act(() => {
      fireEvent.change(input, { target: { value: 'abc' } });
    });
    await act(() => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText(/valid number/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should validate minimum wager', async () => {
    const user = userEvent.setup();
    render(<WagerInput {...defaultProps} minWager={100} />);

    const input = screen.getByLabelText(/wager/i);
    const submitButton = screen.getByRole('button', { name: /submit/i });

    await act(async () => {
      await user.type(input, '50');
      await user.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/minimum wager/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should validate maximum wager', async () => {
    render(<WagerInput {...defaultProps} maxWager={1000} />);

    const input = screen.getByLabelText(/wager/i);
    const form = input.closest('form');
    if (!form) throw new Error('Form not found');

    await act(() => {
      fireEvent.change(input, { target: { value: '1500' } });
    });
    await waitFor(() => expect(input).toHaveValue(1500));

    await act(() => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText(/maximum wager/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should submit valid wager', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(<WagerInput {...defaultProps} />);

    const input = screen.getByLabelText(/wager/i);
    const submitButton = screen.getByRole('button', { name: /submit/i });

    await act(async () => {
      await user.type(input, '500');
      await user.click(submitButton);
    });

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(500);
    });
  });

  it('should show loading state', () => {
    render(<WagerInput {...defaultProps} loading={true} />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeDisabled();
  });

  it('should display error from Redux state', () => {
    // This would be tested in integration with Redux
    // For now, test that component handles error prop if passed
    render(<WagerInput {...defaultProps} />);
    // Component should display validation errors
  });

  it('should clear input after successful submission', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(<WagerInput {...defaultProps} />);

    const input = screen.getByLabelText(/wager/i) as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /submit/i });

    await act(async () => {
      await user.type(input, '500');
      await user.click(submitButton);
    });

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });
});
