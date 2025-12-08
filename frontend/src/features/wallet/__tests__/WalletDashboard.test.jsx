import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WalletDashboard from '../WalletDashboard';
import * as walletService from '../../../services/walletDataService';

vi.mock('../../../services/walletDataService');

vi.mock('../../../assets/stocks.png', () => ({ default: 'stocks.png' }));
vi.mock('../../../assets/etf.png', () => ({ default: 'etf.png' }));
vi.mock('../../../assets/fiis.png', () => ({ default: 'fiis.png' }));
vi.mock('../../../assets/all.png', () => ({ default: 'all.png' }));

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: '500px', height: '500px' }} data-testid="responsive-container">
        {children}
      </div>
    ),
  };
});

vi.mock('../WalletHistoryChart', () => ({
  default: () => <div data-testid="history-chart">Chart Loaded</div>,
}));

const mockPositions = [
  {
    ticker: 'PETR4',
    type: 'stock',
    total_value: 1000,
    qty: 10,
    price_close: 100,
    name: 'Petrobras',
    purchaseDate: '2023-01-01',
  },
  {
    ticker: 'MXRF11',
    type: 'fii',
    total_value: 500,
    qty: 50,
    price_close: 10,
    name: 'Maxi Renda',
    purchaseDate: '2023-01-01',
  },
];

const mockHistory = {
  stock: [],
  etf: [],
  fii: [],
  total: [],
  warnings: [],
};

describe('WalletDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletService.fetchWalletPositions.mockResolvedValue(mockPositions);
    walletService.fetchWalletPerformanceHistory.mockResolvedValue(mockHistory);
    walletService.fetchSpecificAssetHistory.mockResolvedValue([]);
  });

  it('renders loading state initially', async () => {
    let resolvePositions;
    const pendingPromise = new Promise((resolve) => {
      resolvePositions = resolve;
    });

    walletService.fetchWalletPositions.mockReturnValue(pendingPromise);

    render(<WalletDashboard />);

    expect(screen.getByText(/Carregando carteira.../i)).toBeInTheDocument();

    await act(async () => {
      resolvePositions(mockPositions);
    });
  });

  it('calculates and displays the total portfolio value', async () => {
    render(<WalletDashboard />);

    await waitFor(() => {
      const totalElements = screen.getAllByText(/1.500,00/);
      expect(totalElements.length).toBeGreaterThan(0);
    });
  });

  it('filters view when clicking on category tabs', async () => {
    render(<WalletDashboard />);

    await waitFor(() => expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument());

    const fiiTab = screen.getByText('FIIs');
    fireEvent.click(fiiTab);

    await waitFor(() => {
      const totalValues = screen.getAllByText('R$ 500,00');
      expect(totalValues.length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('PETR4')).not.toBeInTheDocument();

    const mxrfElements = screen.getAllByText('MXRF11');
    expect(mxrfElements.length).toBeGreaterThan(0);
  });
});
