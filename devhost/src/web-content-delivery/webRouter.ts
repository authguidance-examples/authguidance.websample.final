import {Request, Response} from 'express';
import path from 'path';

/*
 * The relative path to web files
 */
const WEB_FILES_ROOT = '../../../spa';

/*
 * Resolve web requests for static content
 */
export class WebRouter {

    private _configurationFileName: any;

    public constructor(configurationFileName: string) {
        this._configurationFileName = configurationFileName;
        this._setupCallbacks();
    }

    /*
     * Serve up the requested web file
     */
    public getWebResource(request: Request, response: Response): void {

        let resourcePath = request.path.replace('/spa', '/');
        if (resourcePath === '/') {
           resourcePath = 'index.html';
        }

        const webFilePath = path.join(`${__dirname}/${WEB_FILES_ROOT}/${resourcePath}`);
        response.sendFile(webFilePath);
    }

    /*
     * Serve the cloud configuration so that the SPA points to AWS
     */
    public getSpaConfigurationFile(request: Request, response: Response): void {

        const configFilePath = path.join(`${__dirname}/${WEB_FILES_ROOT}/${this._configurationFileName}`);
        response.setHeader('Content-Type', 'application/json');
        response.sendFile(configFilePath);
    }

    /*
     * Serve up the requested web file
     */
    public getWebRootResource(request: Request, response: Response): void {

        const webFilePath = path.join(`${__dirname}/${WEB_FILES_ROOT}/index.html`);
        response.sendFile(webFilePath);
    }

    /*
     * Serve up our favicon
     */
    public getFavicon(request: Request, response: Response): void {

        const webFilePath = path.join(`${__dirname}/${WEB_FILES_ROOT}/favicon.ico`);
        response.sendFile(webFilePath);
    }

    /*
     * Set up async callbacks
     */
    private _setupCallbacks(): void {
        this.getSpaConfigurationFile = this.getSpaConfigurationFile.bind(this);
    }
}
