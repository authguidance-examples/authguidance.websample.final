import {InMemoryWebStorage, User, UserManager, UserManagerSettings, WebStorageStateStore} from 'oidc-client';
import urlparse from 'url-parse';
import {OAuthConfiguration} from '../../../configuration/oauthConfiguration';
import {ErrorCodes} from '../../errors/errorCodes';
import {ErrorHandler} from '../../errors/errorHandler';
import {ConcurrentActionHandler} from '../../utilities/concurrentActionHandler';
import {Authenticator} from '../authenticator';

/*
 * The entry point for initiating login and token requests
 */
export class OktaAuthenticator implements Authenticator {

    // The OIDC Client does all of the real security processing
    private readonly _userManager: UserManager;

    // A class to prevent multiple UI views initiating the same OAuth operation at once
    private readonly _concurrencyHandler: ConcurrentActionHandler;

    // A session storage key used to minimise full page redirects, such as when opening new browser tabs
    private readonly canRefreshKey = 'canSilentlyRenew';

    /*
     * Initialise OAuth settings and create the UserManager
     */
    public constructor(configuration: OAuthConfiguration) {

        // Okta settings use in memory token storage
        const settings = {
            authority: configuration.authority,
            client_id: configuration.clientId,
            redirect_uri: configuration.appUri,
            silent_redirect_uri: configuration.appUri,
            post_logout_redirect_uri: `${configuration.appUri}${configuration.postLogoutPath}`,
            scope: configuration.scope,

            // Use the Authorization Code Flow (PKCE)
            response_type: 'code',

            // We silently renew explicitly rather than in the background
            automaticSilentRenew: false,

            // We are not using these features and we get extended user info from our API
            loadUserInfo: false,
            monitorSession: false,

            // Tokens are stored only in memory, which generally does best in security reviews and PEN tests
            // https://auth0.com/docs/tokens/guides/store-tokens
            userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),

        } as UserManagerSettings;

        // Initialise state
        this._userManager = new UserManager(settings);
        this._concurrencyHandler = new ConcurrentActionHandler();
        this._setupCallbacks();
    }

    /*
     * Return true if there are tokens
     */
    public async isLoggedIn(): Promise<boolean> {
        const user = await this._userManager.getUser();
        return !!user;
    }

    /*
     * Get an access token and login if required
     */
    public async getAccessToken(): Promise<string> {

        // Get tokens from OIDC client
        const user = await this._userManager.getUser();
        if (user && user.access_token) {
            return user.access_token;
        }

        // Try to refresh the access token otherwise
        return await this.refreshAccessToken();
    }

    /*
     * Try to refresh an access token
     */
    public async refreshAccessToken(): Promise<string> {

        const canRefresh = sessionStorage.getItem(this.canRefreshKey);
        if (canRefresh) {

            try {

                // Refresh the access token via an iframe redirect
                // The concurrency handler will only do the refresh work for the first UI view that requests it
                await this._concurrencyHandler.execute(this._performTokenRefresh);

                // Return the renewed access token
                const user = await this._userManager.getUser();
                if (user && user.access_token) {
                    return user.access_token;
                }

            } catch (e) {

                // Rethrow errors
                throw e;
            }
        }

        // Trigger a login redirect if there are no unexpected errors but we cannot refresh
        throw ErrorHandler.getFromLoginRequired();
    }

    /*
     * Trigger the login redirect
     */
    public async startLogin(returnLocation?: string): Promise<void> {

        // First store the SPA's client side location
        let hash = returnLocation;
        if (!hash) {
            hash = location.hash;
        }
        const data = {
            hash,
        };

        try {
            // Start a login redirect
            await this._userManager.signinRedirect({state: JSON.stringify(data)});

        } catch (e) {

            // Handle OAuth specific errors, such as those calling the metadata endpoint
            throw ErrorHandler.getFromLogoutRequest(e, ErrorCodes.logoutRequestFailed);
        }
    }

    /*
     * Handle the response from the authorization server
     */
    public async handleLoginResponse(): Promise<void> {

        // If the page loads with a state query parameter we classify it as an OAuth response
        const urlData = urlparse(location.href, true);
        if (urlData.query && urlData.query.state) {

            let redirectLocation = '#';
            try {

                // Only try to process a login response if the state exists
                const storedState = await this._userManager.settings.stateStore?.get(urlData.query.state);
                if (storedState) {

                    // Handle the login response
                    const user = await this._userManager.signinRedirectCallback();

                    // Get the hash URL before the login redirect
                    const data = JSON.parse(user.state);
                    redirectLocation = data.hash;

                    // Enable page refresh without a redirect
                    sessionStorage.setItem(this.canRefreshKey, 'true');
                }

            } catch (e) {

                // Handle and rethrow OAuth response errors
                throw ErrorHandler.getFromLoginResponse(e, ErrorCodes.loginResponseFailed);

            } finally {

                // Always replace the browser location, to remove OAuth details from back navigation
                history.replaceState({}, document.title, redirectLocation);
            }
        }
    }

    /*
     * Redirect in order to log out at the authorization server and remove vendor cookies
     */
    public async startLogout(): Promise<void> {

        try {
            // Update state, then do the logout redirect
            sessionStorage.removeItem(this.canRefreshKey);
            await this._userManager.signoutRedirect();

        } catch (e) {
            throw ErrorHandler.getFromLogoutRequest(e, ErrorCodes.loginRequestFailed);
        }
    }

    /*
     * This method is for testing only, to make the access token in storage act like it has expired
     */
    public async expireAccessToken(): Promise<void> {

        const user = await this._userManager.getUser();
        if (user) {

            user.access_token = 'x' + user.access_token + 'x';
            this._userManager.storeUser(user);
        }
    }

    /*
     * For the Okta case we do not use refresh tokens
     */
    public async expireRefreshToken(): Promise<void> {
    }

    /*
     * Redirect on an iframe using the Authorization Server session cookie and prompt=none
     * If required a new token with a different scope could be requested like this
     */
    private async _performTokenRefresh(): Promise<void> {

        try {

            // Redirect on an iframe using the Authorization Server session cookie and prompt=none
            // A different scope could be requested by also supplying an object with a scope= property
            await this._userManager.signinSilent();

        } catch (e) {

            if (e.error === ErrorCodes.loginRequired) {

                // For session expired errors, clear token data and return success, to force a login redirect
                await this._userManager.removeUser();
                sessionStorage.removeItem(this.canRefreshKey);
            }
            else {

                // Rethrow other errors
                throw ErrorHandler.getFromTokenError(e, ErrorCodes.tokenRenewalError);
            }
        }
    }

    /*
     * Plumbing to ensure that the this parameter is available in async callbacks
     */
    private _setupCallbacks(): void {
        this._performTokenRefresh = this._performTokenRefresh.bind(this);
    }
}
