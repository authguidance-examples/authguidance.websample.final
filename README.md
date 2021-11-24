# OAuth Final SPA

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/f2c5ede8739440599096fc25010ab6f6)](https://www.codacy.com/gh/gary-archer/oauth.websample.final/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=gary-archer/oauth.websample.final&amp;utm_campaign=Badge_Grade)
 
[![Known Vulnerabilities](https://snyk.io/test/github/gary-archer/oauth.websample.final/badge.svg?targetFile=spa/package.json)](https://snyk.io/test/github/gary-archer/oauth.websample.final?targetFile=spa/package.json)

## Overview

The final secure SPA, which aims for a [Web Architecture](https://authguidance.com/2017/09/08/goal-1-spas/) with best capabilities.\
This includes deployment of web static content to the [AWS Content Delivery Network](https://authguidance.com/2018/12/02/spa-content-deployment/).

The SPA implements OpenID Connect in an API driven manner using Curity's [Token Handler Pattern](https://github.com/curityio/web-oauth-via-bff).\
This combines strongest browser security with all of the benefits of an SPA architecture.

## Quick Start

Ensure that Node.js is installed, then run the following script from a macOS terminal or from Git Bash on Windows:

```bash
./build.sh
```

Custom development domains are used so you must add these entries to your hosts file:

```
127.0.0.1 web.mycompany.com api.mycompany.com
::1       localhost
```

Trust the root certificate that the build step downloads to your computer, in order for SSL to work in the browser.\
Add this file to the system keychain on macOS or the Windows certificate trust store for the local computer:

```
./dependencies/certs/localhost/mycompany.com.ca.pem
```

Then run the following script to run the code for both SPA, API and Token Handler in multiple terminal windows:

```bash
./deploy.sh
```

The browser is then invoked and you can sign in with my AWS test credentials:

- User: `guestuser@mycompany.com`
- Password: `GuestPassword1`

You can then test all lifecycle operations, including token refresh, multi-tab browsing and multi-tab logout

## Further Details

- See the [Final SPA Overview](https://authguidance.com/2019/04/07/local-ui-setup) for the overall behaviour
- See the [Final SPA Instructions](https://authguidance.com/2019/04/08/how-to-run-the-react-js-spa) for details on the setup 
