import axios, {AxiosRequestConfig, Method} from 'axios';
import {Guid} from 'guid-typescript';
import {Configuration} from '../../configuration/configuration';
import {BaseErrorFactory, UIError} from '../../plumbing/errors/lib';
import {CurrentLocation} from '../../views/utilities/currentLocation';
import {ErrorFactory} from '../errors/errorFactory';
import {AxiosUtils} from '../utilities/axiosUtils';
import {ConcurrentActionHandler} from '../utilities/concurrentActionHandler';
import {HtmlStorageHelper} from '../utilities/htmlStorageHelper';
import {Authenticator} from './authenticator';
import {OAuthUserInfo} from './oauthUserInfo';

/*
 * The authenticator implementation
 */
export class AuthenticatorImpl implements Authenticator {

    private readonly _oauthAgentBaseUrl: string;
    private readonly _sessionId: string;
    private readonly _concurrencyHandler: ConcurrentActionHandler;

    public constructor(configuration: Configuration, sessionId: string) {

        this._oauthAgentBaseUrl = configuration.oauthAgentBaseUrl;
        this._sessionId = sessionId;
        this._concurrencyHandler = new ConcurrentActionHandler();
        this._setupCallbacks();
    }

    /*
     * Use the anti forgery token in storage as an indicator of whether logged in
     */
    public isLoggedIn(): boolean {
        return !!HtmlStorageHelper.antiForgeryToken;
    }

    /*
     * Login is delegated to the shell application, and the app saves its state first
     * The callback view then receives login responses and can restore state
     */
    public login(): void {

        HtmlStorageHelper.preLoginStore(CurrentLocation.path);
        location.href = `${location.origin}/login`;
    }

    /*
     * Logout is delegated to the shell application
     */
    public logout(): void {
        location.href = `${location.origin}/logout`;
    }

    /*
     * When a logout occurs on another browser tab, or for another micro UI, redirect to the shell app
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

            (options.headers as any)['x-mycompany-csrf'] = HtmlStorageHelper.antiForgeryToken;
        }
    }

    /*
     * Get user info from the authorization server and retry 401s
     */
    public async getUserInfo(): Promise<OAuthUserInfo> {

        if (!this.isLoggedIn()) {
            throw ErrorFactory.fromLoginRequired();
        }

        try {

            return await this._makeUserInfoRequest();

        } catch (e: any) {

            // Report Ajax errors if this is not a 401
            if (e.statusCode !== 401) {
                throw e;
            }

            // Refresh the access token cookie
            await this.synchronizedRefresh();

            // Then retry the user info request with the new access token
            return await this._makeUserInfoRequest();
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
     * Make a user info request to the authorization server
     */
    private async _makeUserInfoRequest(): Promise<OAuthUserInfo> {

        const data = await this._callOAuthAgent('GET', '/userinfo', null);
        return {
            givenName: data['given_name'] || '',
            familyName: data['family_name'] || '',
        };
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
    private async _callOAuthAgent(method: Method, operationPath: string, requestData: any): Promise<any> {

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

            throw BaseErrorFactory.fromHttpError(e, url, 'OAuth agent');
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