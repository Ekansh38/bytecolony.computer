#!/bin/bash

HUGO_VERSION=0.157.0
ESBUILD_VERSION=0.25.4

# Download and install Hugo extended
curl -L "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz" | tar -xz

# Download esbuild for asset minification
npm install --no-save esbuild@${ESBUILD_VERSION}
ESBUILD=./node_modules/.bin/esbuild

# Build Hugo site
./hugo --gc --minify --baseURL "https://${VERCEL_PROJECT_PRODUCTION_URL}"

# Minify JS
for f in public/js/*.js; do
  $ESBUILD "$f" --minify --outfile="$f" --allow-overwrite
done

# Minify CSS
for f in public/css/*.css; do
  $ESBUILD "$f" --minify --outfile="$f" --allow-overwrite
done

# Minify work.css
if [ -f public/work.css ]; then
  $ESBUILD public/work.css --minify --outfile=public/work.css --allow-overwrite
fi
