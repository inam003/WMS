# Build context: A:\WMS\WMS.Api
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY WMS.Domain/WMS.Domain.csproj WMS.Domain/
COPY WMS.Application/WMS.Application.csproj WMS.Application/
COPY WMS.Infrastructure/WMS.Infrastructure.csproj WMS.Infrastructure/
COPY WMS.Api/WMS.Api.csproj WMS.Api/
RUN dotnet restore WMS.Api/WMS.Api.csproj

COPY WMS.Domain/ WMS.Domain/
COPY WMS.Application/ WMS.Application/
COPY WMS.Infrastructure/ WMS.Infrastructure/
COPY WMS.Api/ WMS.Api/
RUN dotnet publish WMS.Api/WMS.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_gcServer=0
EXPOSE 8080

USER $APP_UID
ENTRYPOINT ["dotnet", "WMS.Api.dll"]
