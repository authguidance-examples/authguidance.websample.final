import React from 'react';
import {ErrorCodes} from '../../plumbing/errors/errorCodes';
import {ErrorHandler} from '../../plumbing/errors/errorHandler';
import {ErrorSummaryView} from '../errors/errorSummaryView';
import {UserInfoViewProps} from './userInfoViewProps';
import {UserInfoViewState} from './userInfoViewState';

/*
 * A simple component to render the logged in user
 */
export class UserInfoView extends React.Component<UserInfoViewProps, UserInfoViewState> {

    /*
     * If the logged out state changes we update state used for rendering
     */
    public static getDerivedStateFromProps(
        nextProps: UserInfoViewProps,
        prevState: UserInfoViewState): UserInfoViewState | null {

        // Return updated state
        if (nextProps.isLoggedOut !== prevState.isLoggedOut) {
            return {...prevState, isLoggedOut: nextProps.isLoggedOut};
        }

        // Indicate no changes to state
        return null;
    }

    public constructor(props: UserInfoViewProps) {
        super(props);

        this.state = {
            isLoggedOut: props.isLoggedOut,
            claims: null,
            error: null,
        };

        this._setupCallbacks();
    }

    /*
     * Render user info both before and after received
     */
    public render(): React.ReactNode {

        // Render errors if there are technical problems getting user info
        if (this.state.error && this.state.error.errorCode !== ErrorCodes.loginRequired) {

            const errorProps = {
                hyperlinkMessage: 'Problem Encountered',
                dialogTitle: 'User Info Error',
                error: this.state.error,
            };
            return (
                <div className='text-right mx-auto'>
                    <ErrorSummaryView {...errorProps}/>
                </div>
            );
        }

        // Render nothing when logged out
        if (this.state.isLoggedOut || !this.state.claims) {
            return (
                <>
                </>
            );
        }

        // Render the logged in user name otherwise
        const name = `${this.state.claims.givenName} ${this.state.claims.familyName}`;
        return  this.state.claims &&
                (
                    <div className='text-right mx-auto'>
                        <p className='font-weight-bold'>{name}</p>
                    </div>
                );
    }

    /*
     * Load user info when not logged out
     */
    public async componentDidMount(): Promise<void> {

        if (!this.state.isLoggedOut) {
            await this._loadData();
        }
    }

    /*
     * Reload data when the user chooses to resume from the logged out page
     */
    public async componentDidUpdate(
        prevProps: UserInfoViewProps,
        prevState: UserInfoViewState): Promise<void> {

        if (prevState.isLoggedOut && !this.state.isLoggedOut) {
            await this._loadData();
        }
    }

    /*
     * Load data when requested
     */
    private async _loadData(): Promise<void> {

        try {

            // Get user info
            const claims = await this.props.apiClient.getUserInfo();

            // Update state with claims in order to render the logged in user info
            this.setState((prevState) => {
                return {...prevState, error: null, claims};
            });
            this.props.onViewLoaded();

        } catch (e) {

            const error = ErrorHandler.getFromException(e);
            this.setState((prevState) => {
                return {...prevState, error};
            });
            this.props.onViewLoadFailed(error);
        }
    }

    /*
     * Plumbing to ensure that the this parameter is available in async callbacks
     */
    private _setupCallbacks(): void {
        this._loadData = this._loadData.bind(this);
    }
}
