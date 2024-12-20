#!/bin/bash

#################################
# Run the SPA in development mode
#################################

cd "$(dirname "${BASH_SOURCE[0]}")"

#
# Get the platform
#
case "$(uname -s)" in

  Darwin)
    PLATFORM="MACOS"
 	;;

  MINGW64*)
    PLATFORM="WINDOWS"
	;;

  Linux)
    PLATFORM="LINUX"
	;;
esac

#
# First download development SSL certificates
#
./downloadcerts.sh
if [ $? -ne 0 ]; then
  exit
fi

#
# Run webpack dev server to serve static content
# On Linux ensure that you have first granted Node.js permissions to listen on port 443:
# - sudo setcap 'cap_net_bind_service=+ep' $(which node)
#
if [ "$PLATFORM" == 'MACOS' ]; then

  open -a Terminal ./spa/serve.sh

elif [ "$PLATFORM" == 'WINDOWS' ]; then
  
  GIT_BASH="C:\Program Files\Git\git-bash.exe"
  "$GIT_BASH" -c ./spa/serve.sh &

elif [ "$PLATFORM" == 'LINUX' ]; then

  gnome-terminal -- ./spa/serve.sh
fi

#
# When connecting the SPA to a local API, run token handler components in Docker
#
if [ "$LOCALAPI" == 'true' ]; then

  rm -rf localtokenhandler 2>/dev/null
  git clone https://github.com/gary-archer/oauth-agent-node-express localtokenhandler
  if [ $? -ne 0 ]; then
    echo 'Problem encountered downloading local token handler resources'
    exit
  fi

  echo 'Building local token handler components ...'
  ./localtokenhandler/docker/build.sh
  if [ $? -ne 0 ]; then
    echo 'Problem encountered building the local token handler'
    exit
  fi

  ./localtokenhandler/docker/deploy.sh
  if [ $? -ne 0 ]; then
    echo 'Problem encountered deploying the local token handler to Docker'
    exit
  fi
fi

#
# Wait for content to become available
#
WEB_ORIGIN='https://www.authsamples-dev.com'
echo 'Waiting for static content to become available ...'
while [ "$(curl -k -s -o /dev/null -w ''%{http_code}'' "$WEB_ORIGIN/spa/index.html")" != '200' ]; do
  sleep 2
done

#
# Run the SPA in the default browser, then sign in with these credentials:
# - guestuser@example.com
# - Password1
#
if [ "$PLATFORM" == 'MACOS' ]; then

  open "$WEB_ORIGIN/"

elif [ "$PLATFORM" == 'WINDOWS' ]; then

  start "$WEB_ORIGIN/"

elif [ "$PLATFORM" == 'LINUX' ]; then

  xdg-open "$WEB_ORIGIN/"

fi
