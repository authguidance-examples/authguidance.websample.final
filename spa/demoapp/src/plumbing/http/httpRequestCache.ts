import {HttpRequestCacheItem} from './httpRequestCacheItem';

/*
 * A cache to prevent redundant HTTP requests
 * This is used when the data for a view has already been retrieved
 * This includes during back navigation and re-entrancy due to React strict mode
 */
export class HttpRequestCache {

    // A map of named API requests to the result
    private readonly _requests: { [name: string]: HttpRequestCacheItem } = {};

    /*
     * Create an item when an API request is triggered
     */
    public createItem(name: string): HttpRequestCacheItem {

        let item = this.getItem(name);
        if (!item) {

            item = new HttpRequestCacheItem();
            this._requests[name] = item;
        }

        return item;
    }

    /*
     * Get an item if it exists
     */
    public getItem(name: string): HttpRequestCacheItem | null {
        return this._requests[name];
    }

    /*
     * Remove an item if it exists
     */
    public removeItem(name: string): void {

        if (this._requests[name]) {
            delete this._requests[name];
        }
    }
}
