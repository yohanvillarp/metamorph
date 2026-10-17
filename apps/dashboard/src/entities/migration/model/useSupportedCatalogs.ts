import { useState, useEffect } from 'react';
import { apiClient } from '@/shared/api/apiClient';
import type { SupportedFrameworkItem } from '@/shared/api/types';
import { FRAMEWORKS, resolveFrameworkIcon } from '../index';

export function useSupportedCatalogs() {
  const [frameworks, setFrameworks] = useState<SupportedFrameworkItem[]>(FRAMEWORKS);
  const [migrations, setMigrations] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    apiClient
      .getSupportedCatalogs()
      .then((data) => {
        if (!mounted) return;
        const mapped = data.frameworks.map((fw) => ({
          ...fw,
          icon: fw.icon || resolveFrameworkIcon(fw.value),
        }));
        setFrameworks(mapped);
        setMigrations(data.migrations || {});
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { frameworks, migrations, loading, error };
}
