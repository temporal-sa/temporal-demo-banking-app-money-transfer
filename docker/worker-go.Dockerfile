FROM golang:1.26-alpine AS build

WORKDIR /app
COPY workflows/go/go.mod workflows/go/go.sum ./
RUN go mod download
COPY workflows/go/ .
RUN CGO_ENABLED=0 go build -o /worker .

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /worker /worker

CMD ["/worker"]
