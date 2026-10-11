# Audit history retention

The API registers `AuditRetentionService` as a hosted service. It runs once immediately after startup and then hourly, independently of user sessions and administrator activity. Each run calculates `cutoff = TimeProvider.GetUtcNow() - 24 hours` and deletes records whose server-generated `CreatedAt` is strictly earlier than the cutoff. It deletes oldest-first in batches of 1,000 and logs the cutoff and total deleted count; failures are logged and retried on the next hourly run.

The timestamp index on `AuditRecords.CreatedAt` supports both retention and history queries. Cleanup is safe to rerun and across multiple API instances: each batch only deletes records still matching the expired timestamp predicate. No business records are included.

Apply the `AddAuditRecords` EF Core migration after all existing migrations before deploying the new API. The API identity needs permission to create/read audit records and delete expired records. Since each running instance executes cleanup independently, deployments should run the same schema migration before starting the updated instances. The migration is not applied automatically by the application.
