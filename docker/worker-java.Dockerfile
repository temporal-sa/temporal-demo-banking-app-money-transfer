FROM gradle:9-jdk21 AS build
WORKDIR /app
COPY workflows/java/ .
RUN gradle installDist --no-daemon

FROM eclipse-temurin:21-jre
COPY --from=build /app/build/install/worker /app
CMD ["/app/bin/worker"]
