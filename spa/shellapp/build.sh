#!/bin/bash

#################################################################
# A script to build the shell app resources under the dist folder
#################################################################

cd "$(dirname "${BASH_SOURCE[0]}")"
BUILD_CONFIGURATION="$1"

#
# Install dependencies
#
if [ ! -d 'node_modules' ]; then
  
  npm install
  if [ $? -ne 0 ]; then
    echo 'Problem encountered installing shell dependencies'
    exit 1
  fi
fi

#
# Check code quality
#
npm run lint
if [ $? -ne 0 ]; then
  echo 'Shell app code quality checks failed'
  exit 1
fi

#
# Clean the output folder
#
rm -rf ./dist 2>/dev/null
mkdir ./dist

#
# Copy in shared code
#
rm -rf ./build 2>/dev/null
cp -R ../build ./build
rm -rf ./src/plumbing/errors/lib 2>/dev/null
cp -R ../errorlogic ./src/plumbing/errors/lib

#
# Build JavaScript bundles
# On Windows, ensure that you have first set Git bash as the node.js shell
# npm config set script-shell "C:\\Program Files\\git\\bin\\bash.exe"
#
if [ "$BUILD_CONFIGURATION" == 'RELEASE' ]; then
  npm run webpackRelease
else
  npm run webpackDebug
fi
if [ $? -ne 0 ]; then
  echo 'Problem encountered building the shell app'
  exit 1
fi

#
# Reduce the CSS size
#
npm run purgecss
if [ $? -ne 0 ]; then
  echo 'Problem encountered reducing CSS for the shell app'
  exit 1
fi

#
# Copy HTML assets to the output folder
#
cp shellapp.config.json index.html favicon.ico app.css ./dist

#
# Finally, rewrite the index.html in release builds
#
if [ "$BUILD_CONFIGURATION" == 'RELEASE' ]; then

  node --loader ts-node/esm --no-warnings ./build/rewriteIndexHtml.ts
  if [ $? -ne 0 ]; then
    echo 'Problem encountered rewriting the shell app index.html'
    exit 1
  fi
fi