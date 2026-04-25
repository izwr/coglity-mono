import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

// Managed at runtime by connect-pg-simple. Declared here so drizzle-kit push
// doesn't try to drop it on every run. Do NOT query this table from app code.
export const sessions = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey().notNull(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (t) => ({
    expireIdx: index("IDX_session_expire").on(t.expire),
  }),
);