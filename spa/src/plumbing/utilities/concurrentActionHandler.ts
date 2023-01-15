// Internal types
type SuccessCallback = () => void;
type ErrorCallback = (error: any) => void;

/*
 * Used when multiple React UI fragments attempt an action that needs to be performed only once
 * Javascript is single threaded so we do not need to lock as in other languages
 */
export class ConcurrentActionHandler {

    private _callbacks: [SuccessCallback, ErrorCallback][];

    public constructor() {
        this._callbacks = [];
    }

    /*
     * Run the supplied action once and return a promise while in progress
     */
    public async execute(action: () => Promise<void>): Promise<void> {

        // Create a promise through which to return the result
        const promise = new Promise<void>((resolve, reject) => {

            const onSuccess = () => {
                resolve();
            };

            const onError = (error: any) => {
                reject(error);
            };

            this._callbacks.push([onSuccess, onError]);
        });

        // Only do the work for the first UI view that calls us
        const performAction = this._callbacks.length === 1;
        if (performAction) {

            try {

                // Do the work
                await action();

                // On success resolve all promises
                this._callbacks.forEach((c) => {
                    c[0]();
                });

            } catch (e) {

                // On failure resolve all promises with the same error
                this._callbacks.forEach((c) => {
                    c[1](e);
                });
            }

            // Reset once complete
            this._callbacks = [];
        }

        // Return the promise
        return promise;
    }
}
