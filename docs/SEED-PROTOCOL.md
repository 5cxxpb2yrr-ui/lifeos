# Seed Protocol

The real Full Life Control seed is immutable.

Import flow:
RAW INPUT → PARSE → VALIDATE → NORMALIZE → RESOLVE IDs → DETECT DUPLICATES → MIGRATE → WRITE → AUDIT → VERIFY

Before import or migration, create a safety backup. Failed validation must leave the current database untouched. Ambiguous duplicate matches become conflicts; never silently merge.