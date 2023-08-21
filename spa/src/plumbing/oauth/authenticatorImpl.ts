import axios, {AxiosRequestConfig, Method} from 'axios';
import {Guid} from 'guid-typescript';
import {Configuration} from '../../configuration/configuration';
import {ErrorCodes} from '../errors/errorCodes';
import {ErrorFactory} from '../errors/errorFactory';
import {UIError} from '../errors/uiError';
import {AxiosUtils} from '../utilities/axiosUtils';
import {ConcurrentActionHandler} from '../utilities/concurrentActionHandler';
import {HtmlStorageHelper} from '../utilities/htmlStorageHelper';
import {Authenticator} from './authenticator';
import {EndLoginResponse} from './endLoginResponse';

/*
 * The authenticator implementation
 */
export class AuthenticatorImpl implements Authenticator {

    private readonly _oauthAgentBaseUrl: string;
    private readonly _concurrencyHandler: ConcurrentActionHandler;
    private readonly _sessionId: string;
    private _antiForgeryToken: string | null;

    public constructor(configuration: Configuration, sessionId: string) {

        this._oauthAgentBaseUrl = configuration.oauthAgentBaseUrl;
        this._sessionId = sessionId;
        this._concurrencyHandler = new ConcurrentActionHandler();
        this._antiForgeryToken = null;
        this._setupCallbacks();
    }

    /*
     * Use the anti forgery token in storage as an indicator of whether logged in
     */
    public isLoggedIn(): boolean {
        return !!this._antiForgeryToken;
    }

    /*
     * Trigger the login redirect to the authorization server
     */
    public async login(currentLocation: string): Promise<void> {

        try {

            // Call the API to set up the login
            const response = await this._callOAuthAgent('POST', '/login/start');

            // Store the app location before the login redirect
            HtmlStorageHelper.preLoginLocation = currentLocation;

            // Then redirect the main window
            location.href = response.authorizationRequestUri;

        } catch (e) {

            throw ErrorFactory.fromLoginOperation(e, ErrorCodes.loginRequestFailed);
        }
    }

    /*
     * Check for and handle login responses when the page loads
     */
    public async handlePageLoad(): Promise<string | null> {

        try {

            // Send the full URL to the Token Handler API
            const request = {
                url: location.href,
            };
            const endLoginResponse = await this._callOAuthAgent(
                'POST',
                '/login/end',
                request) as EndLoginResponse;

            // Ensure that no code in the app thinks it is logged out
            if (endLoginResponse.isLoggedIn) {
                HtmlStorageHelper.loggedOut = false;
            }

            // Store the anti forgery token, used for data changing API requests
            if (endLoginResponse.antiForgeryToken) {
                this._antiForgeryToken = endLoginResponse.antiForgeryToken;
            }

            // If a login was handled, then the SPA returns to its pre-login location
            if (endLoginResponse.handled) {
                return HtmlStorageHelper.getAndRemovePreLoginLocation() || '/';
            }

            // Return a no-op result by default
            return null;

        } catch (e: any) {

            // Session expired errors calling the OAuth agent can be caused by cookies with an old encryption key
            // Handle these by returning a default result that results in a loaded state
            // API calls will then fail and a new login redirect will be triggered, to get updated cookies
            if (this._isSessionExpiredError(e)) {
                return null;
            }

            // Rethrow other errors
            throw ErrorFactory.fromLoginOperation(e, ErrorCodes.loginResponseFailed);
        }
    }

    /*
     * Do the logout redirect to clear all cookie and token details
     */
    public async logout(): Promise<void> {

        try {

            const response = await this._callOAuthAgent('POST', '/logout');
            location.href = response.endSessionRequestUri;

        } catch (e) {

            throw ErrorFactory.fromLogoutOperation(e, ErrorCodes.logoutRequestFailed);

        } finally {

            this._antiForgeryToken = null;
        }
    }

    /*
     * Handle logout on another browser tab, or for another micro UI in the same origin
     * Redirect to the shell app, which serves as the post logout landing page
     */
    public onLoggedOut(): void {
        location.href = `${location.origin}/loggedout`;
    }

    /*
     * Add an anti forgery token when sending data changing commands to APIs or the OAuth agent
     */
    public addAntiForgeryToken(options: AxiosRequestConfig): void {

        if (options.method === 'POST'  ||
            options.method === 'PUT'   ||
            options.method === 'PATCH' ||
            options.method === 'DELETE') {

            (options.headers as any)['x-mycompany-csrf'] = this._antiForgeryToken;
        }
    }

    /*
     * Synchronize a refresh call to the OAuth agent, which will rewrite cookies
     */
    public async synchronizedRefresh(): Promise<void> {
        await this._concurrencyHandler.execute(this._performTokenRefresh);
    }

    /*
     * This method is for testing only, so that the SPA can receive expired access token responses
     */
    public async expireAccessToken(): Promise<void> {

        try {

            // Try to rewrite the refresh token within the cookie, using existing cookies as the request credential
            await this._callOAuthAgent('POST', '/expire', {type: 'access'});

        } catch (e: any) {

            // Session expired errors are silently ignored
            if (!this._isSessionExpiredError(e)) {
                throw ErrorFactory.fromTestExpiryError(e, 'access');
            }
        }
    }

    /*
     * This method is for testing only, so that the SPA can receive expired refresh token responses
     */
    public async expireRefreshToken(): Promise<void> {

        try {

            // Try to rewrite the access token within the cookie, using the existing cookies as the request credential
            await this._callOAuthAgent('POST', '/expire', {type: 'refresh'});

        } catch (e: any) {

            // Session expired errors are silently ignored
            if (!this._isSessionExpiredError(e)) {
                throw ErrorFactory.fromTestExpiryError(e, 'refresh');
            }
        }
    }

    /*
     * Do the work of asking the token handler API to refresh the access token stored in the secure cookie
     */
    private async _performTokenRefresh(): Promise<void> {

        try {

            await this._callOAuthAgent('POST', '/refresh', null);

        } catch (e: any) {

            if (e.statusCode === 401) {
                throw ErrorFactory.fromLoginRequired();
            }

            throw ErrorFactory.fromTokenRefreshError(e);
        }
    }

    /*
     * A parameterized method for calling the OAuth agent
     */
    private async _callOAuthAgent(method: Method, operationPath: string, requestData: any = null): Promise<any> {

        const url = `${this._oauthAgentBaseUrl}${operationPath}`;
        try {

            // Same site cookies are also cross origin so the withCredentials flag is needed
            const options: any = {
                url,
                method,
                headers: {
                    accept: 'application/json',
                },
                withCredentials: true,
            };

            // Post data unless the payload is empty
            if (requestData) {
                options.data = requestData;
                options.headers['content-type'] = 'application/json';
            }

            // Add the anti forgery token
            this.addAntiForgeryToken(options);

            // Supply headers for the Token Handler API to write to logs
            options.headers['x-mycompany-api-client'] = 'FinalSPA';
            options.headers['x-mycompany-session-id'] = this._sessionId;
            options.headers['x-mycompany-correlation-id'] = Guid.create().toString();

            // Make the request and return the response
            const response = await axios.request(options as AxiosRequestConfig);
            if (response.data) {

                AxiosUtils.checkJson(response.data);
                return response.data;
            }

            return null;

        } catch (e: any) {

            throw ErrorFactory.fromHttpError(e, url, 'OAuth agent');
        }
    }

    /*
     * When operations fail due to invalid cookies, the OAuth proxy will return a 401 during API calls
     * This could also be caused by a new cookie encryption key or a redeployment of the Authorization Server
     */
    private _isSessionExpiredError(e: any): boolean {

        const uiError = e as UIError;
        return uiError.statusCode === 401;
    }

    /*
     * Plumbing to ensure that the this parameter is available in async callbacks
     */
    private _setupCallbacks(): void {
        this._performTokenRefresh = this._performTokenRefresh.bind(this);
    }
}
