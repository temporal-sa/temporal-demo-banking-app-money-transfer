FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY workflows/dotnet/ .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:8.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "BankingWorker.dll"]
