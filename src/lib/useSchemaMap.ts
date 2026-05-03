'use client';

// Progressive schema discovery hook (Phase 11c)
//
// Fetches schema progressively: tier 1 (catalogs) -> tier 2 (tables) -> tier 3 (columns)
// Returns whatever tier is available immediately, triggers background upgrade to next tier.

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from './store';
import { apiClient } from './api-client';
import type { SchemaMap, TableMap, HRSubDomain, SchemaTier } from './agents/types';

interface UseSchemaMapResult {
  schemaMap: SchemaMap | null;
  subDomain: HRSubDomain | null;
  tier: SchemaTier | null;
  isResolving: boolean;
  primaryTableMap: TableMap | null;
  refresh: () => void;
}

export function useSchemaMap(): UseSchemaMapResult {
  const {
    schemaMap,
    setSchemaMap,
    schemaSubDomain,
    schemaTier,
    setSchemaTier,
    schemaResolving,
    setSchemaResolving,
    primaryTableMap,
    setPrimaryTableMap,
  } = useAppStore();

  const fetchAttempted = useRef(false);
  const upgradeAttempted = useRef(false);

  // Fetch schema progressively: start with tier 1, then upgrade
  useEffect(() => {
    if (fetchAttempted.current) return;
    if (schemaTier && schemaTier >= 1) return; // already have some data
    fetchAttempted.current = true;

    const fetchProgressive = async () => {
      setSchemaResolving(true);
      try {
        // Tier 1: fast catalogs
        const t1Response = await apiClient('/api/schema?tier=1', { method: 'GET' });
        const t1Data = await t1Response.json();
        setSchemaTier(t1Data.tier || 1);

        if (t1Data.schemaMapSummary) {
          // Server already has a cached schema map from prior discovery
          setSchemaTier(t1Data.tier);
        }
      } catch (err) {
        console.error('[useSchemaMap] Tier 1 fetch failed:', err);
      } finally {
        setSchemaResolving(false);
      }
    };

    fetchProgressive();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Background upgrade to tier 3 once we have tier 1/2
  useEffect(() => {
    if (upgradeAttempted.current) return;
    if (!schemaTier || schemaTier >= 3) return;
    upgradeAttempted.current = true;

    const upgrade = async () => {
      try {
        const response = await apiClient('/api/schema?tier=3', { method: 'GET' });
        const data = await response.json();
        setSchemaTier(data.tier || 3);

        if (data.schemaMapSummary) {
          // Schema map is built server-side; we can fetch it via the schema map summary
          // The full schema map is too large for the API response, so we note the tier
          setSchemaTier(data.tier);
        }
      } catch (err) {
        console.error('[useSchemaMap] Tier 3 upgrade failed:', err);
      }
    };

    upgrade();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaTier]);

  const refresh = useCallback(() => {
    fetchAttempted.current = false;
    upgradeAttempted.current = false;
    setSchemaTier(null);
    setSchemaMap(null);
    setPrimaryTableMap(null);
    setSchemaResolving(false);
  }, [setSchemaTier, setSchemaMap, setPrimaryTableMap, setSchemaResolving]);

  return {
    schemaMap,
    subDomain: schemaSubDomain,
    tier: schemaTier,
    isResolving: schemaResolving,
    primaryTableMap,
    refresh,
  };
}
