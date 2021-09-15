import axios from 'axios';
import {Guid} from 'guid-typescript';
import {AppConfiguration} from '../../configuration/appConfiguration';
import {ErrorHandler} from '../../plumbing/errors/errorHandler';
import {CredentialSupplier} from '../../plumbing/oauth/credentialSupplier';
import {AxiosUtils} from '../../plumbing/utilities/axiosUtils';
import {ApiFetchOptions} from './apiFetchOptions';
import {Channel} from './channel';

/*
 * Lower level logic related to calling APIs
 */
export class ApiFetch implements Channel {

    private readonly _apiBaseUrl: string;
    private readonly _sessionId: string;
    private readonly _credentialSupplier: CredentialSupplier;

    public constructor(configuration: AppConfiguration, sessionId: string, credentialSupplier: CredentialSupplier) {

        this._apiBaseUrl = configuration.apiBaseUrl;
        if (!this._apiBaseUrl.endsWith('/')) {
            this._apiBaseUrl += '/';
        }

        this._sessionId = sessionId;
        this._credentialSupplier = credentialSupplier;
    }

    /*
     * A parameterized method containing application specific logic for managing API calls
     */
    public async fetch(options: ApiFetchOptions): Promise<any> {

        // Get the full path
        const url = `${this._apiBaseUrl}${options.path}`;

        try {

            // Call the API
            return await this._callApi(url, options, false);

        } catch (error1) {

            // Report Ajax errors if this is not a 401
            if (!this._isApi401Error(error1)) {
                throw ErrorHandler.getFromHttpError(error1, url, 'Web API');
            }

            try {

                // The general pattern for calling an OAuth secured API is to retry 401s once
                return await this._callApi(url, options, true);

            } catch (error2) {

                // Report Ajax errors for the retry
                throw ErrorHandler.getFromHttpError(error2, url, 'Web API');
            }
        }
    }

    /*
     * Do the work of calling the API
     */
    private async _callApi(url: string, options: ApiFetchOptions, isRetry: boolean): Promise<any> {

        // Configure options
        const axiosOptions = {
            url,
            method: options.method,
            data: options.dataToSend,
            headers: this._getHeaders(options.callerOptions.causeError),
        };

        // Manage sending credentials from the SPA to the API
        await this._credentialSupplier.onCallApi(axiosOptions, isRetry);

        // Make the API request
        const response = await axios.request(options);
        AxiosUtils.checkJson(response.data);
        return response.data;
    }

    /*
     * Add headers for logging and advanced testing purposes
     */
    private _getHeaders(causeError?: boolean | undefined): any {

        const headers: any = {

            // Context headers included in API logs
            'x-mycompany-api-client':     'FinalSPA',
            'x-mycompany-session-id':     this._sessionId,
            'x-mycompany-correlation-id': Guid.create().toString(),
        };

        // A special header can be sent to ask the API to throw a simulated exception
        if (causeError) {
            headers['x-mycompany-test-exception'] = 'SampleApi';
        }

        return headers;
    }

    /*
     * API 401s are handled via a retry with a new token
     */
    private _isApi401Error(error: any) {

        if (error.response && error.response.status === 401) {
            return true;
        }

        return false;
    }
}
