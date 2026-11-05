FROM ghcr.io/roadrunner-server/roadrunner:3.0.1 AS roadrunner

FROM composer:2 AS vendor
WORKDIR /app
COPY workflows/php/composer.json workflows/php/composer.lock ./
COPY workflows/php/src/ src/
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist \
    --ignore-platform-reqs --optimize-autoloader

FROM php:8.4-cli
RUN docker-php-ext-install sockets

WORKDIR /app
COPY --from=roadrunner /usr/bin/rr /usr/local/bin/rr
COPY --from=vendor /app/vendor/ vendor/
COPY workflows/php/ .

CMD ["rr", "serve", "-c", ".rr.yaml"]
