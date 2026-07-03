import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const useAccounts = () =>
  useQuery({ queryKey: ["accounts"], queryFn: () => api("/api/accounts") });
export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: () => api("/api/categories") });
export const useTransactions = (month: string) =>
  useQuery({ queryKey: ["transactions", month], queryFn: () => api(`/api/transactions?month=${month}`) });
export const useRecurring = () =>
  useQuery({ queryKey: ["recurring"], queryFn: () => api("/api/recurring") });
export const useSavings = () =>
  useQuery({ queryKey: ["savings"], queryFn: () => api("/api/savings/entries") });
export const useGoal = () =>
  useQuery({ queryKey: ["goal"], queryFn: () => api("/api/savings/goal") });
export const usePresets = () =>
  useQuery({ queryKey: ["presets"], queryFn: () => api("/api/presets") });
export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => api("/api/settings") });

export function useMutate(invalidate: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: any }) =>
      api(path, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
}
