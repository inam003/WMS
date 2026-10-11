using WMS.Application.Audit;

namespace WMS.Api.Authorization;

public sealed class AuditRetentionService(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    ILogger<AuditRetentionService> logger) : BackgroundService
{
    private static readonly TimeSpan RetentionPeriod = TimeSpan.FromHours(24);
    private const int BatchSize = 1000;
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval, timeProvider);
        do
        {
            try
            {
                var cutoff = timeProvider.GetUtcNow() - RetentionPeriod;
                var deleted = 0;
                await using var scope = scopeFactory.CreateAsyncScope();
                var repository = scope.ServiceProvider.GetRequiredService<IAuditRepository>();
                int batchDeleted;
                do
                {
                    batchDeleted = await repository.DeleteExpiredBatchAsync(
                        cutoff, BatchSize, stoppingToken);
                    deleted += batchDeleted;
                } while (batchDeleted == BatchSize && !stoppingToken.IsCancellationRequested);

                logger.LogInformation(
                    "Audit retention cleanup completed; deletedCount={DeletedCount}, cutoffUtc={CutoffUtc}.",
                    deleted,
                    cutoff);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Audit retention cleanup failed.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
