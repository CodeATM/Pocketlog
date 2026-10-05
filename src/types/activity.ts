export type Activity = {
  id: string;
  title: string;
  categoryId: string;
  notes: string | null;
  /** ISO 8601, UTC. Source of truth for ordering and range queries. */
  startedAt: string;
  /**
   * `YYYY-MM-DD` in the device's local timezone. Denormalised on purpose: it makes
   * "everything on Thursday" a single indexed equality lookup instead of a
   * timezone-dependent range calculation, and it keeps day grouping correct even
   * if the device timezone changes after an entry is written.
   */
  day: string;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
};

/** Shape accepted by the repository when creating. */
export type ActivityDraft = {
  title: string;
  categoryId: string;
  notes?: string | null;
  startedAt: Date;
  durationMinutes: number;
};

/** Fields the form can change. */
export type ActivityPatch = Omit<ActivityDraft, 'startedAt'> & { startedAt: Date };

export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 24 * 60;