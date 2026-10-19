FROM php:8.2-cli-bookworm@sha256:0d6ec82fde85307fd9c672527017fccf9bac55f254756f035e542f8c566b63c9
COPY platform-ca.crt /usr/local/share/ca-certificates/platform-ca.crt
RUN update-ca-certificates
RUN sed -i s/http:/https:/g /etc/apt/sources.list.d/debian.sources && apt-get update && apt-get install -y --no-install-recommends \
    git unzip libicu-dev libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev libonig-dev libxml2-dev libcurl4-openssl-dev libpq-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j2 bcmath curl dom gd intl mbstring pdo_mysql pdo_pgsql zip \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2.8.12@sha256:5248900ab8b5f7f880c2d62180e40960cd87f60149ec9a1abfd62ac72a02577c /usr/bin/composer /usr/local/bin/composer
WORKDIR /app
