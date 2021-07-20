import {Method} from 'axios';
import {ApiRequestOptions} from './apiRequestOptions';

/*
 * The channel could be a 
 */
export interface Channel {

    // A parameterized fetch method
    fetch(path: string, method: Method, dataToSend?: any, options?: ApiRequestOptions): Promise<any>;
}