import { useState, useEffect } from 'react';
import { fetchWalletPerformanceHistory } from '../services/walletDataService';

export function useDataConsistency() {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkConsistency = async () => {
      try {
        setLoading(true);

        const histData = await fetchWalletPerformanceHistory(6);

        if (histData.warnings) {
          setWarnings(histData.warnings);
        }
      } catch (error) {
        console.error('Failed to check data consistency', error);
      } finally {
        setLoading(false);
      }
    };

    checkConsistency();
  }, []);

  return { warnings, loading };
}
