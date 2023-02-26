#!/bin/bash

#####################################################################################
# A script to test local Docker deployment of web resources on a development computer
# This is only for local setups where a Content Delivery Network cannot be used
#####################################################################################

cd "$(dirname "${BASH_SOURCE[0]}")"

#
# Run the docker deployment
#
docker compose --project-name webhost up --force-recreate --detach
if [ $? -ne 0 ]; then
  echo 'Problem encountered running web host Docker image'
  exit 1
fi

#
# Wait for it to become available
#
echo 'Waiting for web content to become available ...'
INDEX_HTML_URL='https://web.authsamples-dev.com/demoapp/index.html'
while [ "$(curl -k -s -o /dev/null -w ''%{http_code}'' "$INDEX_HTML_URL")" != '200' ]; do
  sleep 2
done