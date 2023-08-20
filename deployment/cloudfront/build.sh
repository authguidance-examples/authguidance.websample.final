#!/bin/bash

##########################################################################
# A script to build all resources ready to upload to AWS S3 and Cloudfront
##########################################################################

cd "$(dirname "${BASH_SOURCE[0]}")"
cd ../..

#
# Two scenarios are supported, where the SPA connects to APIs that use either Serverless or Kubernetes hosting
#
ENVIRONMENT="$1"

#
# Build the shell application, which I use as a simple post logout landing page
#
cd shell
./build.sh 'RELEASE'
if [ $? -ne 0 ]; then
  echo 'Problem encountered building the shell application'
  exit
fi
cd ..

#
# Build the SPA's Javascript bundles
#
cd spa
./build.sh 'RELEASE'
if [ $? -ne 0 ]; then
  echo 'Problem encountered building the SPA'
  exit
fi
cd ..

#
# Build extensions to the Cloudfront web host
#
cd cloudfront-extensions
./build.sh "$ENVIRONMENT"
if [ $? -ne 0 ]; then
  echo 'Problem encountered building Cloudfront extensions'
  exit
fi

#
# Create the package folder
#
rm -rf .package 2> /dev/null
mkdir .package
mkdir .package/spa

#
# Copy HTML assets
#
cp ../shell/dist/index.html  .package
cp ../shell/dist/*.mjs       .package
cp ../shell/dist/*.css       .package
cp ../shell/dist/favicon.ico .package

cp ../spa/dist/index.html   .package/spa
cp ../spa/dist/*.bundle.js  .package/spa
cp ../spa/dist/*.css        .package/spa
