FROM php:8.4-apache

# Install dependencies
RUN apt-get update -qq && \
    apt-get install -y -qq \
    libzip-dev \
    unzip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-install -j4 pdo pdo_mysql zip

# Enable Apache modules
RUN a2enmod rewrite

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Enable OPcache for performance
RUN docker-php-ext-install opcache

# Configure OPcache for production
RUN echo 'opcache.enable=1' >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini && \
    echo 'opcache.memory_consumption=512' >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini && \
    echo 'opcache.interned_strings_buffer=64' >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini && \
    echo 'opcache.max_accelerated_files=32531' >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini && \
    echo 'opcache.validate_timestamps=0' >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini && \
    echo 'opcache.enable_cli=1' >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini

# Create a php.ini with better settings
RUN echo 'display_errors=Off' >> /usr/local/etc/php/conf.d/app.ini && \
    echo 'log_errors=On' >> /usr/local/etc/php/conf.d/app.ini && \
    echo 'error_log=/var/log/php_errors.log' >> /usr/local/etc/php/conf.d/app.ini

WORKDIR /var/www/html
