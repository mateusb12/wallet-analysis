import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FiiSimulator from '../FiiSimulator';
import * as b3service from '../../services/b3service';
import * as ipcaService from '../../services/ipcaService';

vi.mock('../../services/b3service');
vi.mock('../../services/ipcaService');

vi.mock('../../components/SimulationChart', () => ({
  default: () => <div data-testid="sim-chart">Simulation Chart</div>,
}));

describe('FiiSimulator Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    b3service.fetchUniqueTickers.mockResolvedValue(['HGLG11', 'KNRI11']);
    b3service.fetchFiiDateRange.mockResolvedValue({
      oldest_date: '2020-01-01',
      newest_date: '2023-12-01',
    });
  });

  it('loads tickers on mount', async () => {
    render(<FiiSimulator />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('HGLG11')).toBeInTheDocument();
    });
  });

  it('runs simulation and displays results table', async () => {
    b3service.fetchFiiDividendForMonth.mockResolvedValue({
      price_close: 100,
      dividend_value: 0.01,
    });
    ipcaService.getIpcaRange.mockResolvedValue([]);

    render(<FiiSimulator />);

    await waitFor(() => screen.getByDisplayValue('HGLG11'));

    const investInput = screen.getByLabelText(/Investimento Inicial/i);
    fireEvent.change(investInput, { target: { value: '1000' } });

    const runBtn = screen.getByText(/Rodar Simulação/i);
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Resumo da Simulação/i)).toBeInTheDocument();
    });

    expect(screen.getByTestId('sim-chart')).toBeInTheDocument();

    expect(screen.getByText('Cenário: Reinvestindo')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    b3service.fetchFiiDateRange.mockRejectedValue(new Error('API Down'));

    render(<FiiSimulator />);
  });
});
