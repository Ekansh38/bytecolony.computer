#!/bin/bash

HUGO_VERSION=0.157.0
ESBUILD_VERSION=0.25.4

# Download and install Hugo extended
curl -L "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz" | tar -xz

# Download esbuild for asset minification
curl -fsSL "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-${ESBUILD_VERSION}.tgz" | tar -xz --strip-components=1 package/bin/esbuild
chmod +x esbuild

# Build Hugo site
./hugo --gc --minify --baseURL "https://${VERCEL_PROJECT_PRODUCTION_URL}"

# Minify JS
for f in public/js/*.js; do
  ./esbuild "$f" --minify --outfile="$f" --allow-overwrite
done

# Minify CSS
for f in public/css/*.css; do
  ./esbuild "$f" --minify --outfile="$f" --allow-overwrite --loader=css
done

# Minify work.css
if [ -f public/work.css ]; then
  ./esbuild public/work.css --minify --outfile=public/work.css --allow-overwrite --loader=css
fi
