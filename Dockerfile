FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/api/main.go

FROM alpine:latest
WORKDIR /root/
# Copia o executável do builder
COPY --from=builder /app/server .
# Se você tiver pastas de templates ou estáticos, copie-as aqui
# COPY --from=builder /app/web ./web 

EXPOSE 8080
CMD ["./server"]
