import { useState, useEffect } from 'react';
import type { MigrationCostSummary } from '../model/types';
import { apiClient } from '@/shared/api/apiClient';

export function useCostSummary(runId?: string, isActive: boolean = true) {
  const [costSummary, setCostSummary] = useState<MigrationCostSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!runId) {
      setCostSummary(null);
      return;
    }

    let isMounted = true;

    const fetchCost = async () => {
      try {
        const data = await apiClient.getCostSummary(runId);
        if (isMounted && data) {
          setCostSummary(data);
        }
      } catch {
        // Silently ignore polling errors
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    setIsLoading(true);
    fetchCost();

    if (!isActive) return;

    const interval = setInterval(fetchCost, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [runId, isActive]);

  return { costSummary, isLoading };
}
