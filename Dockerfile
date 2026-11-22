# One image with the whole HMS: the ASP.NET Core API serves the built React app as well.
# Built in three stages; only the last, small stage is kept.
#   docker build -t hms .

# ---------- Stage 1: build the React frontend ----------
FROM node:22-alpine AS frontend
WORKDIR /src/frontend
# package files first: Docker can reuse the npm install while only the code changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: build the API ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY backend/Hms.Api/Hms.Api.csproj backend/Hms.Api/
RUN dotnet restore backend/Hms.Api/Hms.Api.csproj
COPY backend/Hms.Api/ backend/Hms.Api/
RUN dotnet publish backend/Hms.Api/Hms.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---------- Stage 3: the image that runs ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=backend /app/publish ./
COPY --from=frontend /src/frontend/dist ./wwwroot

# Folders for uploaded patient documents and the cookie keys, owned by the non-root "app" user.
RUN mkdir -p /app/App_Data/patient-documents /app/keys && chown -R $APP_UID /app/App_Data /app/keys

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true \
    Database__MigrateOnStartup=true

# Never run as root inside the container.
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Hms.Api.dll"]
